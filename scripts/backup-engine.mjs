import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const backupRoot = join(projectRoot, "backups");
export const runtimeRoot = join(projectRoot, ".runtime");
export const uploadRoot = join(runtimeRoot, "backup-uploads");
export const maintenanceFile = join(runtimeRoot, "maintenance.json");
const logFile = join(backupRoot, "backup-operations.jsonl");
const dbContainer = "supabase_db_gym-app";
const storageContainer = "supabase_storage_gym-app";
const storageVolume = "supabase_storage_gym-app";
export const formatVersion = 1;

const localEnvFile = join(projectRoot, ".env.local");
if (existsSync(localEnvFile)) {
  for (const line of readFileSync(localEnvFile, "utf8").split(/\r?\n/)) {
    const at = line.indexOf("="); if (at < 1 || line.startsWith("#")) continue;
    const key = line.slice(0, at).trim();
    if (key.startsWith("GYM_BACKUP_") && process.env[key] === undefined) process.env[key] = line.slice(at + 1).trim();
  }
}

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: projectRoot, encoding: "utf8", ...options });
}
function assertInside(root, target) {
  const exact = resolve(root); const candidate = resolve(target);
  if (candidate !== exact && !candidate.startsWith(`${exact}${sep}`)) throw new Error("Unsafe backup path rejected.");
  return candidate;
}
function ps(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sha256(file) {
  const hash = createHash("sha256"); hash.update(readFileSync(file)); return hash.digest("hex");
}
function log(operation, filename, success, started, details = {}) {
  mkdirSync(backupRoot, { recursive: true });
  appendFileSync(logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), operation, filename: filename || null, success, durationMs: Date.now() - started, ...details })}\n`);
}
export function databaseIsRunning() {
  const result = run("docker.exe", ["ps", "--filter", `name=^/${dbContainer}$`, "--format", "{{.Names}}"]).stdout?.trim();
  return result === dbContainer;
}
async function dumpDatabase(destination) {
  if (!databaseIsRunning()) throw new Error("Local Supabase database is not running.");
  const output = createWriteStream(destination, { flags: "wx" });
  const child = spawn("docker.exe", ["exec", dbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--schema=public", "--schema=auth", "--schema=storage"], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = ""; child.stderr.on("data", (part) => { stderr += part; }); child.stdout.pipe(output);
  const finished = once(output, "finish"); const code = await new Promise((done) => child.on("close", done)); await finished;
  if (code !== 0 || !existsSync(destination) || statSync(destination).size < 5) throw new Error(`Database backup failed. ${stderr}`.trim());
}
async function validateDump(file) {
  if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size < 5) throw new Error("Database dump is missing or empty.");
  const magic = readFileSync(file).subarray(0, 5).toString("ascii");
  if (magic !== "PGDMP") throw new Error("The selected file is not a PostgreSQL custom-format dump.");
  if (databaseIsRunning()) {
    const child = spawn("docker.exe", ["exec", "-i", dbContainer, "pg_restore", "--list"], { stdio: ["pipe", "ignore", "pipe"] });
    createReadStream(file).pipe(child.stdin); const code = await new Promise((done) => child.on("close", done));
    if (code !== 0) throw new Error("PostgreSQL could not read the selected dump.");
  }
  return { type: "legacy", filename: basename(file), size: statSync(file).size, databaseIncluded: true, storageIncluded: false, verificationPassed: true };
}
function exportStorage(destination) {
  mkdirSync(destination, { recursive: true });
  const inspect = run("docker.exe", ["inspect", storageContainer, "--format", "{{range .Mounts}}{{if eq .Name \"supabase_storage_gym-app\"}}{{.Destination}}{{end}}{{end}}"]).stdout?.trim();
  if (inspect !== "/mnt") throw new Error("Supabase Storage volume mount did not match the inspected safe configuration.");
  const copied = run("docker.exe", ["cp", `${storageContainer}:/mnt/.`, destination]);
  if (copied.status !== 0) throw new Error("Supabase Storage files could not be exported.");
}
function compress(source, destination) {
  const command = `Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath ${ps(source)}).FullName -DestinationPath ${ps(destination)} -CompressionLevel Optimal`;
  const result = run("powershell.exe", ["-NoProfile", "-Command", command]);
  if (result.status !== 0 || !existsSync(destination)) throw new Error(`ZIP creation failed. ${result.stderr}`.trim());
}
function expand(source, destination) {
  mkdirSync(destination, { recursive: true });
  const result = run("powershell.exe", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath ${ps(source)} -DestinationPath ${ps(destination)} -Force`]);
  if (result.status !== 0) throw new Error("The selected file is not a readable ZIP backup.");
}
function appVersion() {
  const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
  const git = run("git.exe", ["-c", `safe.directory=${projectRoot.replaceAll("\\", "/")}`, "rev-parse", "--short", "HEAD"]);
  return { version: pkg.version, commit: git.status === 0 ? git.stdout.trim() : null };
}
function migrationVersion() {
  const dir = join(projectRoot, "supabase", "migrations"); return readdirSync(dir).filter((x) => x.endsWith(".sql")).sort().at(-1)?.split("_")[0] ?? null;
}
export async function validateBackup(source) {
  const file = resolve(source); if (!existsSync(file) || !statSync(file).isFile()) throw new Error("Backup file was not found.");
  if (file.toLowerCase().endsWith(".dump")) return validateDump(file);
  if (!file.toLowerCase().endsWith(".zip")) throw new Error("Only .zip packages and legacy .dump backups are supported.");
  const temp = join(runtimeRoot, `validate-${process.pid}-${Date.now()}`); assertInside(runtimeRoot, temp);
  try {
    expand(file, temp); const infoPath = join(temp, "backup-info.json"); const dump = join(temp, "database.dump");
    if (!existsSync(infoPath)) throw new Error("backup-info.json is missing.");
    const info = JSON.parse(readFileSync(infoPath, "utf8"));
    if (info.formatVersion !== formatVersion) throw new Error(info.formatVersion > formatVersion ? "This backup was created by a newer version and cannot be restored here." : "Unsupported backup format version.");
    if (!info.databaseIncluded || !existsSync(dump)) throw new Error("database.dump is missing.");
    if (info.storageIncluded && !existsSync(join(temp, "storage"))) throw new Error("Storage files are missing from this package.");
    if (info.checksums?.databaseSha256 && sha256(dump) !== info.checksums.databaseSha256) throw new Error("Database checksum verification failed.");
    await validateDump(dump);
    return { type: "full", filename: basename(file), size: statSync(file).size, ...info, verificationPassed: true };
  } finally { if (existsSync(temp)) rmSync(temp, { recursive: true, force: true }); }
}
function copySecondary(file) {
  const configured = process.env.GYM_BACKUP_SECONDARY_DIR?.trim(); if (!configured) return { configured: false, copied: false };
  const destinationRoot = resolve(configured); mkdirSync(destinationRoot, { recursive: true }); copyFileSync(file, join(destinationRoot, basename(file)));
  return { configured: true, copied: true };
}
export function applyRetention() {
  mkdirSync(backupRoot, { recursive: true });
  const files = readdirSync(backupRoot).filter((name) => /^gym-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/.test(name)).sort().reverse();
  const keep = new Set(files.slice(0, 7)); const weeks = new Set(); const months = new Set();
  for (const name of files) {
    const date = new Date(`${name.slice(11, 21)}T12:00:00`); const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const week = monday.toISOString().slice(0, 10); const month = name.slice(11, 18);
    if (weeks.size < 4 && !weeks.has(week)) { weeks.add(week); keep.add(name); }
    if (months.size < 6 && !months.has(month)) { months.add(month); keep.add(name); }
  }
  for (const name of files) if (!keep.has(name)) rmSync(assertInside(backupRoot, join(backupRoot, name)));
}
export async function createFullBackup({ prefix = "gym-backup", automatic = false } = {}) {
  const started = Date.now(); mkdirSync(backupRoot, { recursive: true }); mkdirSync(runtimeRoot, { recursive: true });
  const name = `${prefix}-${stamp()}.zip`; const destination = assertInside(backupRoot, join(backupRoot, name)); const temp = assertInside(runtimeRoot, join(runtimeRoot, `backup-${process.pid}-${Date.now()}`));
  try {
    mkdirSync(join(temp, "storage"), { recursive: true }); const dump = join(temp, "database.dump"); await dumpDatabase(dump); exportStorage(join(temp, "storage"));
    const app = appVersion(); const info = { formatVersion, createdAt: new Date().toISOString(), applicationVersion: app.version, commitSha: app.commit, schemaVersion: migrationVersion(), databaseIncluded: true, storageIncluded: true, verificationPassed: true, automatic, checksums: { databaseSha256: sha256(dump) } };
    writeFileSync(join(temp, "backup-info.json"), JSON.stringify(info, null, 2)); compress(temp, destination); const verified = await validateBackup(destination);
    let secondary = { configured: Boolean(process.env.GYM_BACKUP_SECONDARY_DIR?.trim()), copied: false };
    try { secondary = copySecondary(destination); } catch (error) { secondary = { configured: true, copied: false, error: error.message }; }
    applyRetention(); log("backup", name, true, started, { verificationPassed: true, secondaryCopied: secondary.copied }); return { ...verified, secondary };
  } catch (error) { if (existsSync(destination)) rmSync(destination, { force: true }); log("backup", name, false, started, { error: error.message }); throw error; }
  finally { if (existsSync(temp)) rmSync(temp, { recursive: true, force: true }); }
}
export function listBackups() {
  mkdirSync(backupRoot, { recursive: true });
  return readdirSync(backupRoot).filter((name) => /^(gym-backup|pre-restore)-.*\.zip$/.test(name)).map((name) => { const file = join(backupRoot, name); return { id: name, filename: name, size: statSync(file).size, createdAt: statSync(file).mtime.toISOString(), verified: true }; }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export function knownBackupPath(id) {
  if (typeof id !== "string" || !/^(gym-backup|pre-restore)-[\w.-]+\.zip$/.test(id)) throw new Error("Unknown backup file.");
  const file = assertInside(backupRoot, join(backupRoot, id)); if (!existsSync(file)) throw new Error("Backup file was not found."); return file;
}
export async function restoreBackup(source, { confirmed = false } = {}) {
  if (!confirmed) throw new Error("Restore confirmation is required.");
  const started = Date.now(); const validated = await validateBackup(source); const safety = await createFullBackup({ prefix: "pre-restore" });
  mkdirSync(runtimeRoot, { recursive: true }); writeFileSync(maintenanceFile, JSON.stringify({ active: true, startedAt: new Date().toISOString() }));
  const temp = join(runtimeRoot, `restore-${process.pid}-${Date.now()}`);
  try {
    let dump = source; let storage = null;
    if (validated.type === "full") { expand(source, temp); dump = join(temp, "database.dump"); storage = join(temp, "storage"); }
    const child = spawn("docker.exe", ["exec", "-i", dbContainer, "sh", "-c", 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -U supabase_admin -d postgres --clean --if-exists --exit-on-error'], { stdio: ["pipe", "inherit", "inherit"] });
    createReadStream(dump).pipe(child.stdin); const code = await new Promise((done) => child.on("close", done)); if (code !== 0) throw new Error("Database restore failed.");
    if (storage) {
      const stopped = run("docker.exe", ["stop", storageContainer]); if (stopped.status !== 0) throw new Error("Storage service could not enter maintenance mode.");
      const helper = run("docker.exe", ["run", "--rm", "--entrypoint", "sh", "-v", `${storageVolume}:/target`, "public.ecr.aws/supabase/storage-api:v1.70.3", "-c", "find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +"]); if (helper.status !== 0) throw new Error("Storage volume could not be prepared.");
      const copy = run("docker.exe", ["cp", `${storage}${sep}.`, `${storageContainer}:/mnt`]); if (copy.status !== 0) throw new Error("Storage files could not be restored.");
    }
    const restarted = run("docker.exe", ["restart", dbContainer, storageContainer]); if (restarted.status !== 0) throw new Error("Supabase services could not restart after restore.");
    let healthy = false;
    for (let attempt = 0; attempt < 30; attempt += 1) { try { const response = await fetch("http://127.0.0.1:54321/auth/v1/health"); if (response.ok) { healthy = true; break; } } catch {} await new Promise((done) => setTimeout(done, 2000)); }
    if (!healthy) throw new Error("Restore completed, but Supabase verification did not become healthy.");
    const integrity = run("docker.exe", ["exec", dbContainer, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", "select 1 from public.profiles limit 1;"]);
    if (integrity.status !== 0) throw new Error("Restore completed, but database integrity verification failed.");
    log("restore", basename(source), true, started, { verificationPassed: true, safetyBackup: safety.filename }); return { restored: basename(source), safetyBackup: safety.filename };
  } catch (error) { log("restore", basename(source), false, started, { error: error.message, safetyBackup: safety.filename }); throw error; }
  finally { if (existsSync(temp)) rmSync(temp, { recursive: true, force: true }); rmSync(maintenanceFile, { force: true }); }
}
