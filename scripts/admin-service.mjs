import { createServer } from "node:http";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createFullBackup, knownBackupPath, listBackups, maintenanceFile, projectRoot, restoreBackup, runtimeRoot, uploadRoot, validateBackup } from "./backup-engine.mjs";

const host = "127.0.0.1"; const port = 4174; const origin = "http://127.0.0.1:4173";
const pidFile = join(runtimeRoot, "admin-service.pid"); const lockFile = join(runtimeRoot, "backup-operation.lock");
const env = Object.fromEntries(readFileSync(join(projectRoot, ".env.local"), "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
const maxBytes = Math.max(1, Number(process.env.GYM_BACKUP_MAX_UPLOAD_MB || env.GYM_BACKUP_MAX_UPLOAD_MB || 2048)) * 1024 * 1024;
const supabaseUrl = env.VITE_SUPABASE_URL; const anonKey = env.VITE_SUPABASE_ANON_KEY;
let busy = false;

function json(response, status, body, extra = {}) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": origin, "Vary": "Origin", ...extra }); response.end(JSON.stringify(body)); }
function safeError(error) { console.error(new Date().toISOString(), error); return error instanceof Error && /newer version|Unsupported|missing|checksum|not a PostgreSQL|Only \.zip|not found|too large/i.test(error.message) ? error.message : "The operation failed. Your safety backup and detailed local logs have been preserved."; }
async function requireAdmin(request) {
  const auth = request.headers.authorization || ""; if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
  if (!response.ok) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const user = await response.json(); if (!/^[0-9a-f-]{36}$/i.test(user.id || "")) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const sql = `SELECT role FROM public.profiles WHERE id='${user.id}'::uuid LIMIT 1;`;
  const result = spawnSync("docker.exe", ["exec", "supabase_db_gym-app", "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", sql], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || result.stdout.trim() !== "admin") throw Object.assign(new Error("Administrator access required."), { status: 403 });
  return user;
}
async function locked(action) {
  if (busy || existsSync(lockFile)) throw Object.assign(new Error("Another backup or restore operation is already running."), { status: 409 });
  busy = true; writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  try { return await action(); } finally { busy = false; rmSync(lockFile, { force: true }); }
}
function receiveUpload(request) {
  return new Promise((resolve, reject) => {
    const rawName = String(request.headers["x-backup-filename"] || ""); const name = basename(rawName);
    if (!name || name !== rawName || !/^[\w .()-]+\.(zip|dump)$/i.test(name)) return reject(new Error("Invalid backup filename."));
    const length = Number(request.headers["content-length"] || 0); if (!length || length > maxBytes) return reject(new Error(`Backup upload exceeds the ${maxBytes / 1024 / 1024} MB limit.`));
    mkdirSync(uploadRoot, { recursive: true }); const id = `${Date.now()}-${name.replace(/[^\w.-]/g, "_")}`; const file = join(uploadRoot, id); const output = createWriteStream(file, { flags: "wx" }); let received = 0;
    request.on("data", (chunk) => { received += chunk.length; if (received > maxBytes) request.destroy(new Error("Backup upload is too large.")); });
    request.on("error", (error) => { output.destroy(); rmSync(file, { force: true }); reject(error); }); output.on("error", reject); output.on("finish", () => resolve({ id, file, originalName: name })); request.pipe(output);
  });
}
function uploadedPath(id) {
  if (!/^[\w.-]+$/.test(id || "")) throw new Error("Invalid uploaded backup identifier."); const file = join(uploadRoot, id); if (!existsSync(file) || !statSync(file).isFile()) throw new Error("Uploaded backup was not found."); return file;
}
const server = createServer(async (request, response) => {
  try {
    if (request.headers.origin && request.headers.origin !== origin) return json(response, 403, { error: "Origin rejected." });
    if (request.method === "OPTIONS") { response.writeHead(204, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization,content-type,x-backup-filename", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }); return response.end(); }
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, service: "gym-local-admin" });
    if (request.method === "GET" && url.pathname === "/api/maintenance") return json(response, 200, { active: existsSync(maintenanceFile) });
    await requireAdmin(request);
    if (request.method === "GET" && url.pathname === "/api/backup/status") { const items = listBackups(); return json(response, 200, { lastSuccessfulBackup: items[0]?.createdAt || null, automaticBackupsEnabled: true, backupCount: items.length, latest: items[0] || null, formatVersion: 1, operationInProgress: busy }); }
    if (request.method === "GET" && url.pathname === "/api/backup/list") return json(response, 200, { backups: listBackups() });
    if (request.method === "POST" && url.pathname === "/api/backup/create") return json(response, 201, await locked(() => createFullBackup()));
    if (request.method === "POST" && url.pathname === "/api/backup/validate") { const upload = await receiveUpload(request); try { return json(response, 200, { uploadId: upload.id, originalName: upload.originalName, ...(await validateBackup(upload.file)) }); } catch (error) { rmSync(upload.file, { force: true }); throw error; } }
    if (request.method === "POST" && url.pathname === "/api/backup/restore") { let body = ""; for await (const part of request) { body += part; if (body.length > 10000) throw new Error("Invalid request."); } const data = JSON.parse(body); if (data.confirmation !== "RESTORE") throw new Error("Type RESTORE exactly to continue."); const file = uploadedPath(data.uploadId); try { return json(response, 200, await locked(() => restoreBackup(file, { confirmed: true }))); } finally { rmSync(file, { force: true }); } }
    if (request.method === "GET" && url.pathname.startsWith("/api/backup/download/")) { const id = decodeURIComponent(url.pathname.slice("/api/backup/download/".length)); const file = knownBackupPath(id); response.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${basename(file)}"`, "Content-Length": statSync(file).size, "Access-Control-Allow-Origin": origin }); return (await import("node:fs")).createReadStream(file).pipe(response); }
    return json(response, 404, { error: "Not found." });
  } catch (error) { return json(response, error.status || 400, { error: safeError(error) }); }
});
function cleanup() { try { if (existsSync(pidFile) && Number(readFileSync(pidFile, "utf8")) === process.pid) rmSync(pidFile); } catch {} }
server.listen(port, host, () => { mkdirSync(runtimeRoot, { recursive: true }); writeFileSync(pidFile, String(process.pid)); console.log(`Gym local admin service listening on http://${host}:${port}`); setTimeout(async () => { try { const latest = listBackups()[0]; if (!latest || Date.now() - Date.parse(latest.createdAt) >= 86400000) await locked(() => createFullBackup({ automatic: true })); } catch (error) { console.error("Automatic backup failed:", error.message); } }, 30000).unref(); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { cleanup(); process.exit(0); })); process.on("exit", cleanup);
