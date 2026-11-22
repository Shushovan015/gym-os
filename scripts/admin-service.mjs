import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createServer } from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { backupReadiness, createFullBackup, formatVersion, localEnv, knownBackupPath, listBackups, maintenanceFile, restoreBackup, runtimeRoot, uploadRoot, validateBackup, operationInProgress, verifyApiTarget, withBackupLock } from "./backup-engine.mjs";

const host = "127.0.0.1"; const port = Number(process.env.GYM_BACKUP_PORT || 4174);
const pidFile = join(runtimeRoot, "admin-service.pid");
const configuredUploadMb = Number(process.env.GYM_BACKUP_MAX_UPLOAD_MB);
const maxBytes = (Number.isFinite(configuredUploadMb) && configuredUploadMb > 0 ? configuredUploadMb : 2048) * 1024 * 1024;
const supabaseUrl = (process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY || "").trim();
const configured = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(supabaseUrl) && Boolean(anonKey);


function json(response, status, body, extra = {}) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(body)); }
function safeError(error) { console.error(new Date().toISOString(), error); return error instanceof Error ? error.message : "The backup operation failed."; }
async function requireAdmin(request) {
  const auth = request.headers.authorization || ""; if (!auth.startsWith("Bearer ")) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!configured) throw Object.assign(new Error("Configure the local Supabase URL and anon key before using the backup service."), { status: 503 });
  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
      method: "POST", headers: { apikey: anonKey, Authorization: auth, "Content-Type": "application/json" },
      body: "{}", signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw Object.assign(new Error("Local Supabase API is unreachable. Check that Supabase is running and that its URL and port match .env.local."), { status: 503 });
  }
  if (response.status === 401) throw Object.assign(new Error("Sign in again to use backups."), { status: 401 });
  if (response.status >= 500 || response.status === 404) throw Object.assign(new Error("Supabase could not check administrator access. Confirm all app migrations are installed."), { status: 503 });
  if (!response.ok || await response.json() !== true) throw Object.assign(new Error("Administrator access required."), { status: 403 });
}
async function receiveUpload(request) {
  const rawName = decodeURIComponent(String(request.headers["x-backup-filename"] || ""));
  const extension = /\.(zip|dump)$/i.exec(rawName)?.[0].toLowerCase();
  if (!extension || basename(rawName) !== rawName) throw new Error("Choose a .zip backup or a PostgreSQL .dump file.");
  const length = Number(request.headers["content-length"] || 0);
  if (!Number.isSafeInteger(length) || length < 1) throw new Error("Backup upload is empty or has no content length.");
  if (length > maxBytes) throw Object.assign(new Error(`Backup upload exceeds the ${maxBytes / 1024 / 1024} MB limit.`), { status: 413 });
  mkdirSync(uploadRoot, { recursive: true });
  const id = `${randomUUID()}${extension}`;
  const file = join(uploadRoot, id);
  let received = 0;
  const countBytes = new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      if (received > maxBytes) done(new Error("Backup upload is too large."));
      else done(null, chunk);
    },
  });
  try {
    await pipeline(request, countBytes, createWriteStream(file, { flags: "wx" }));
    if (received !== length) throw new Error("Backup upload was incomplete. Choose the file again.");
    return { id, file, originalName: rawName };
  } catch (error) {
    rmSync(file, { force: true });
    throw error;
  }
}
function uploadedPath(id) {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}\.(zip|dump)$/.test(id)) throw new Error("Invalid uploaded backup identifier."); const file = join(uploadRoot, id); if (!existsSync(file) || !statSync(file).isFile()) throw new Error("Uploaded backup was not found."); return file;
}
const server = createServer(async (request, response) => {
  try {
    if (request.headers.origin) return json(response, 403, { error: "Origin rejected." });
    const { pathname } = new URL(request.url || "/", `http://${host}:${port}`);
    const { method } = request;
    if (method === "GET" && pathname === "/health") {
      return json(response, 200, { ok: true, service: "gym-local-admin" });
    }
    if (method === "GET" && pathname === "/api/maintenance") {
      return json(response, 200, { active: existsSync(maintenanceFile) });
    }

    await requireAdmin(request);
    if (method === "GET" && pathname === "/api/backup/status") {
      let dependencies;
      try {
        verifyApiTarget(supabaseUrl);
        dependencies = backupReadiness();
      } catch (error) {
        dependencies = { ready: false, destinationReady: false, error: error.message };
      }
      const items = dependencies.destinationReady ? listBackups() : [];
      return json(response, 200, {
        dependencies,
        lastSuccessfulBackup: items[0]?.createdAt || null,
        automaticBackupsEnabled: process.env.GYM_BACKUP_AUTOMATIC !== "off",
        backupCount: items.length,
        latest: items[0] || null,
        formatVersion,
        operationInProgress: operationInProgress(),
      });
    }
    verifyApiTarget(supabaseUrl);
    if (method === "GET" && pathname === "/api/backup/list") {
      return json(response, 200, { backups: listBackups() });
    }
    if (method === "POST" && pathname === "/api/backup/create") {
      return json(response, 201, await withBackupLock(() => createFullBackup()));
    }
    if (method === "POST" && pathname === "/api/backup/validate") {
      const upload = await receiveUpload(request);
      try {
        const validated = await validateBackup(upload.file);
        return json(response, 200, { ...validated, uploadId: upload.id, filename: upload.originalName });
      } catch (error) {
        rmSync(upload.file, { force: true });
        throw error;
      }
    }
    if (method === "POST" && pathname === "/api/backup/restore") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 10_000) throw new Error("Restore request is too large.");
      }
      const data = JSON.parse(body);
      if (data.confirmation !== "RESTORE") throw new Error("Type RESTORE exactly to continue.");
      const restored = await withBackupLock(async () => {
        const file = uploadedPath(data.uploadId);
        const result = await restoreBackup(file, { confirmed: true });
        rmSync(file, { force: true });
        return result;
      });
      return json(response, 200, restored);
    }
    if (method === "GET" && pathname.startsWith("/api/backup/download/")) {
      const id = decodeURIComponent(pathname.slice("/api/backup/download/".length));
      const file = knownBackupPath(id);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${basename(file)}"`,
        "Content-Length": statSync(file).size,
      });
      return createReadStream(file).on("error", () => response.destroy()).pipe(response);
    }
    return json(response, 404, { error: "Backup API endpoint was not found." });
  } catch (error) {
    const message = safeError(error);
    if (!response.destroyed) return json(response, error.status || 400, { error: message });
  }
});
server.on("error", (error) => { console.error(`Could not start backup service on ${host}:${port}. ${error.message}`); process.exitCode = 1; });
function cleanup() { try { if (existsSync(pidFile) && Number(readFileSync(pidFile, "utf8")) === process.pid) rmSync(pidFile); } catch {} }
async function automaticBackup() {
  try {
    if (operationInProgress()) return;
    verifyApiTarget(supabaseUrl);
    const latest = listBackups()[0];
    if (!latest || Date.now() - Date.parse(latest.createdAt) >= 86_400_000) {
      await withBackupLock(() => createFullBackup({ automatic: true }));
    }
  } catch (error) { console.error("Automatic backup failed:", error.message); }
}
server.listen(port, host, () => {
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(pidFile, String(process.pid));
  console.log(`Gym local admin service listening on http://${host}:${port}`);
  if (configured && process.env.GYM_BACKUP_AUTOMATIC !== "off") {
    setTimeout(automaticBackup, 30_000).unref();
    setInterval(automaticBackup, 3_600_000).unref();
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { cleanup(); process.exit(0); })); process.on("exit", cleanup);
