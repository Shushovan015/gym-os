import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, openSync, closeSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const formatVersion = 2;
export const localEnv = Object.assign({}, ...[".env", ".env.local"].map((name) => {
  const file = join(projectRoot, name);
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8").replace(/^\uFEFF/, "")) : {};
}));
for (const [name, value] of Object.entries(localEnv)) {
  // Frontend launchers share the service port through the process environment.
  if (name.startsWith("GYM_BACKUP_") && name !== "GYM_BACKUP_PORT" && process.env[name] === undefined) process.env[name] = value;
}

export const backupRoot = resolve(process.env.GYM_BACKUP_DIR || join(projectRoot, "backups"));
export const runtimeRoot = resolve(process.env.GYM_BACKUP_RUNTIME_DIR || join(projectRoot, ".runtime"));
export const uploadRoot = join(runtimeRoot, "backup-uploads");
export const maintenanceFile = join(runtimeRoot, "maintenance.json");
const logFile = join(backupRoot, "backup-operations.jsonl");
const projectId = process.env.GYM_BACKUP_PROJECT_ID || "gym-app";
const dbContainer = `supabase_db_${projectId}`;
const storageContainer = `supabase_storage_${projectId}`;
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const zipCommand = process.platform === "win32" ? "tar.exe" : "bsdtar";
const lockFile = join(runtimeRoot, "backup-operation.lock");

export function operationInProgress() {
  if (!existsSync(lockFile)) return false;
  let lock;
  try { lock = JSON.parse(readFileSync(lockFile, "utf8")); } catch { return true; }
  if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) return true;
  try {
    process.kill(lock.pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

export async function withBackupLock(action) {
  mkdirSync(runtimeRoot, { recursive: true });
  if (operationInProgress()) throw Object.assign(new Error("Another backup or restore operation is already running."), { status: 409 });
  if (existsSync(lockFile)) {
    throw Object.assign(new Error("A previous operation stopped unexpectedly. Check the backup log and remove the stale backup-operation.lock before retrying."), { status: 409 });
  }
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") throw Object.assign(new Error("Another backup or restore operation is already running."), { status: 409 });
    throw error;
  }
  try { return await action(); } finally { rmSync(lockFile, { force: true }); }
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
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function storageChecksums(root, relative = "") {
  const checksums = [];
  for (const name of readdirSync(join(root, relative)).sort()) {
    const path = relative ? `${relative}/${name}` : name;
    const file = join(root, path);
    const stat = lstatSync(file);
    if (stat.isDirectory()) checksums.push(...await storageChecksums(root, path));
    else if (stat.isFile()) checksums.push([path, await sha256(file)]);
    else throw new Error("Unsupported link or special file in backup storage.");
  }
  return checksums;
}
function log(operation, filename, success, started, details = {}) {
  try {
    appendFileSync(logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), operation, filename, success, durationMs: Date.now() - started, ...details })}\n`);
  } catch (error) { console.error("Could not write backup log:", error.message); }
}
function dockerResult(args, message) {
  const result = run(docker, args);
  if (result.status !== 0) throw new Error(`${message} ${result.error?.message || result.stderr?.trim() || ""}`.trim());
  return result.stdout.trim();
}
function databaseQuery(sql, error) {
  return dockerResult(["exec", dbContainer, "psql", "-XAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql], error);
}
function postgresMajor() {
  return Math.floor(Number(databaseQuery("SHOW server_version_num", "Could not determine the local PostgreSQL version.")) / 10000);
}
function checkDatabase() {
  dockerResult(["info", "--format", "{{.ServerVersion}}"], "Docker is unavailable or access was denied.");
  databaseQuery("SELECT 1", `Cannot connect to local PostgreSQL container ${dbContainer}.`);
}
export function verifyApiTarget(apiUrl) {
  const gateway = `supabase_kong_${projectId}`;
  const ports = JSON.parse(dockerResult(["inspect", gateway, "--format", "{{json .NetworkSettings.Ports}}"], `Cannot verify the local Supabase API in ${gateway}. Check Docker and Supabase.`));
  const port = new URL(apiUrl).port || "80";
  if (!ports?.["8000/tcp"]?.some((binding) => binding.HostPort === port)) {
    throw new Error(`The Supabase URL points to port ${port}, but that port is not mapped to the ${projectId} backup target. Check VITE_SUPABASE_URL in .env.local.`);
  }
}
function storageImage() {
  const mounts = JSON.parse(dockerResult(["inspect", storageContainer, "--format", "{{json .Mounts}}"], "Cannot inspect local Supabase Storage."));
  if (!mounts.some((mount) => mount.Type === "volume" && mount.Destination === "/mnt" && mount.RW)) {
    throw new Error("Supabase Storage needs a writable Docker volume mounted at /mnt.");
  }
  return dockerResult(["inspect", storageContainer, "--format", "{{.Image}}"], "Cannot identify the local Supabase Storage image.");
}
export function backupReadiness() {
  let destinationReady = false;
  try {
    for (const directory of [backupRoot, runtimeRoot]) {
      mkdirSync(directory, { recursive: true });
      const probe = join(directory, `.write-${randomUUID()}`);
      closeSync(openSync(probe, "wx"));
      rmSync(probe);
      destinationReady = directory === backupRoot || destinationReady;
    }
    checkDatabase();
    storageImage();
    const archive = run(zipCommand, ["--version"]);
    if (archive.status !== 0) throw new Error("The ZIP-capable tar utility is required. Use the tar included with Windows or install bsdtar.");
    return { ready: true, destinationReady };
  } catch (error) {
    return { ready: false, destinationReady, error: error.message };
  }
}
async function runStream(args, { input, output } = {}) {
  const child = spawn(docker, args, {
    cwd: projectRoot, windowsHide: true,
    stdio: [input ? "pipe" : "ignore", output ? "pipe" : "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr = (stderr + chunk).slice(-12000); });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `Docker exited with code ${code}.`)));
  });
  const transfer = input
    ? pipeline(createReadStream(input), child.stdin)
    : output ? pipeline(child.stdout, createWriteStream(output, { flags: "wx" })) : Promise.resolve();
  const results = await Promise.allSettled([done, transfer]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
}
async function dumpDatabase(destination) {
  try {
    await runStream(["exec", dbContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--schema=public", "--schema=auth", "--schema=storage"], { output: destination });
  } catch (error) { throw new Error(`PostgreSQL dump failed. ${error.message}`); }
}
async function validateDump(file) {
  if (!existsSync(file) || !lstatSync(file).isFile() || statSync(file).size < 5) throw new Error("Database dump is missing or empty.");
  const { bytesRead, magic } = await new Promise((resolve, reject) => {
    const stream = createReadStream(file, { start: 0, end: 4 });
    stream.once("error", reject);
    stream.once("data", (chunk) => resolve({ bytesRead: chunk.length, magic: chunk.toString("ascii") }));
  });
  if (bytesRead !== 5 || magic !== "PGDMP") throw new Error("The selected file is not a PostgreSQL custom-format dump.");
  try {
    // Decode the whole dump to detect truncated data as well as invalid archive headers.
    await runStream(["exec", "-i", dbContainer, "pg_restore", "--file=/dev/null"], { input: file });
    await runStream([
      "exec", "-i", dbContainer, "pg_restore", "--file=/dev/null", "--strict-names", "--schema=public",
      "--table=members", "--table=profiles", "--table=attendance_records", "--table=invoices", "--table=admin_settings",
    ], { input: file });
  } catch (error) { throw new Error(`PostgreSQL could not read a compatible gym application schema from this dump. ${error.message}`); }
  return { type: "legacy", filename: basename(file), size: statSync(file).size, databaseIncluded: true, storageIncluded: false, verificationPassed: true };
}
function exportStorage(destination) {
  mkdirSync(destination, { recursive: true });
  dockerResult(["cp", `${storageContainer}:/mnt/.`, destination], "Supabase Storage files could not be exported.");
}
function archive(args, message) {
  const result = run(zipCommand, args);
  if (result.status !== 0) throw new Error(`${message} ${result.error?.message || result.stderr?.trim() || ""}`.trim());
}
function compress(source, destination) {
  archive(["-a", "-cf", destination, "-C", source, "."], "ZIP creation failed.");
}
function expand(source, destination) {
  mkdirSync(destination, { recursive: true });
  archive(["-xf", source, "-C", destination], "The selected file is not a readable ZIP backup.");
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
  const temp = join(runtimeRoot, `validate-${randomUUID()}`); assertInside(runtimeRoot, temp);
  try {
    expand(file, temp); const infoPath = join(temp, "backup-info.json"); const dump = join(temp, "database.dump");
    if (!existsSync(infoPath) || !lstatSync(infoPath).isFile()) throw new Error("backup-info.json is missing.");
    const info = JSON.parse(readFileSync(infoPath, "utf8"));
    if (info.formatVersion !== 1 && info.formatVersion !== formatVersion) throw new Error(info.formatVersion > formatVersion ? "This backup was created by a newer version and cannot be restored here." : "Unsupported backup format version.");
    if (!info.databaseIncluded || !existsSync(dump) || !lstatSync(dump).isFile()) throw new Error("database.dump is missing.");
    if (info.storageIncluded && !existsSync(join(temp, "storage"))) throw new Error("Storage files are missing from this package.");
    if (!/^[0-9a-f]{64}$/.test(info.checksums?.databaseSha256 || "") || await sha256(dump) !== info.checksums.databaseSha256) throw new Error("Database checksum verification failed.");
    if (info.schemaVersion && info.schemaVersion > migrationVersion()) throw new Error("This backup requires a newer application database schema.");
    if (info.postgresMajor && info.postgresMajor !== postgresMajor()) throw new Error(`This backup requires PostgreSQL ${info.postgresMajor}.`);
    if (info.storageIncluded) {
      if (!lstatSync(join(temp, "storage")).isDirectory()) throw new Error("Storage directory is invalid.");
      const checksums = await storageChecksums(join(temp, "storage"));
      if (info.formatVersion >= 2 && !Array.isArray(info.checksums.storageSha256)) throw new Error("Storage checksums are missing.");
      if (info.checksums.storageSha256 && JSON.stringify(checksums) !== JSON.stringify(info.checksums.storageSha256)) throw new Error("Storage checksum verification failed.");
    }
    await validateDump(dump);
    return { type: "full", filename: basename(file), size: statSync(file).size, createdAt: info.createdAt, formatVersion: info.formatVersion, schemaVersion: info.schemaVersion, databaseIncluded: true, storageIncluded: Boolean(info.storageIncluded), verificationPassed: true };
  } finally { if (existsSync(temp)) rmSync(temp, { recursive: true, force: true }); }
}
function copySecondary(file) {
  const configured = process.env.GYM_BACKUP_SECONDARY_DIR?.trim(); if (!configured) return { configured: false, copied: false };
  const destinationRoot = resolve(configured); mkdirSync(destinationRoot, { recursive: true }); copyFileSync(file, join(destinationRoot, basename(file)));
  return { configured: true, copied: true };
}
export function applyRetention() {
  mkdirSync(backupRoot, { recursive: true });
  const files = readdirSync(backupRoot).filter((name) => /^gym-backup-\d{4}-\d{2}-\d{2}-\d{6}(?:-[\da-f]{8})?\.zip$/.test(name)).sort().reverse();
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
  const name = `${prefix}-${stamp()}-${randomUUID().slice(0, 8)}.zip`; const destination = assertInside(backupRoot, join(backupRoot, name)); const temp = assertInside(runtimeRoot, join(runtimeRoot, `backup-${process.pid}-${Date.now()}`));
  try {
    const readiness = backupReadiness();
    if (!readiness.ready) throw new Error(readiness.error);
    mkdirSync(join(temp, "storage"), { recursive: true }); const dump = join(temp, "database.dump"); await dumpDatabase(dump); exportStorage(join(temp, "storage"));
    const app = appVersion(); const info = { formatVersion, createdAt: new Date().toISOString(), applicationVersion: app.version, commitSha: app.commit, schemaVersion: migrationVersion(), postgresMajor: postgresMajor(), databaseIncluded: true, storageIncluded: true, verificationPassed: true, automatic, checksums: { databaseSha256: await sha256(dump), storageSha256: await storageChecksums(join(temp, "storage")) } };
    writeFileSync(join(temp, "backup-info.json"), JSON.stringify(info, null, 2)); const partial = `${destination}.partial`;
    const packagePath = join(runtimeRoot, `verified-${randomUUID()}.zip`);
    let verified;
    try {
      compress(temp, packagePath);
      verified = await validateBackup(packagePath);
      copyFileSync(packagePath, partial);
      renameSync(partial, destination);
    } finally { rmSync(packagePath, { force: true }); rmSync(partial, { force: true }); }
    verified.filename = name;
    let secondary = { configured: Boolean(process.env.GYM_BACKUP_SECONDARY_DIR?.trim()), copied: false };
    try { secondary = copySecondary(destination); } catch (error) { secondary = { configured: true, copied: false, error: error.message }; }
    try { applyRetention(); } catch (error) { console.error("Could not prune old backups:", error.message); }
    log("backup", name, true, started, { verificationPassed: true, secondaryCopied: secondary.copied });
    return { ...verified, secondary };
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
async function waitForStorage() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = dockerResult(["inspect", storageContainer, "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"], "Could not verify local Storage after restore.");
    if (status === "healthy" || status === "running") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Storage did not become healthy after restore.");
}

function replaceStorage(source, image) {
  dockerResult(["run", "--rm", "--volumes-from", storageContainer, "--entrypoint", "sh", image, "-c", "find /mnt -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +"], "Storage volume could not be prepared.");
  dockerResult(["cp", `${source}${sep}.`, `${storageContainer}:/mnt`], "Storage files could not be restored.");
}

export async function restoreBackup(source, { confirmed = false } = {}) {
  if (!confirmed) throw new Error("Restore confirmation is required.");
  const started = Date.now();
  const validated = await validateBackup(source);
  const temp = join(runtimeRoot, `restore-${randomUUID()}`);
  const image = storageImage();
  let safety;
  let storageStopped = false;
  let storageChanged = false;
  let databaseRestored = false;
  let maintenanceStarted = false;
  try {
    let dump = source;
    if (validated.type === "full") {
      expand(source, temp);
      dump = join(temp, "database.dump");
    }
    writeFileSync(maintenanceFile, JSON.stringify({ active: true, startedAt: new Date().toISOString() }), { flag: "wx" });
    maintenanceStarted = true;
    // Quiesce Storage across the safety snapshot and replacement.
    dockerResult(["stop", storageContainer], "Storage service could not enter maintenance mode.");
    storageStopped = true;
    safety = await createFullBackup({ prefix: "pre-restore" });
    if (validated.storageIncluded) {
      storageChanged = true;
      replaceStorage(join(temp, "storage"), image);
    }
    try {
      await runStream(["exec", "-i", dbContainer, "sh", "-c", 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore -U supabase_admin -d postgres --clean --if-exists --single-transaction'], { input: dump });
    } catch (error) { throw new Error(`Database restore failed and its transaction was rolled back. ${error.message}`); }
    databaseRestored = true;
    dockerResult(["start", storageContainer], "Storage service could not restart after restore.");
    storageStopped = false;
    databaseQuery("SELECT count(*) FROM public.profiles; NOTIFY pgrst, 'reload schema';", "Database integrity check failed after restore.");
    await waitForStorage();
    log("restore", basename(source), true, started, { verificationPassed: true, safetyBackup: safety.filename });
    return { restored: basename(source), safetyBackup: safety.filename };
  } catch (error) {
    let rollbackError;
    if (storageChanged && !databaseRestored && safety) {
      try {
        const previous = join(temp, "safety");
        expand(knownBackupPath(safety.filename), previous);
        replaceStorage(join(previous, "storage"), image);
      } catch (failure) { rollbackError = failure; }
    }
    log("restore", basename(source), false, started, { error: error.message, safetyBackup: safety?.filename, rollbackError: rollbackError?.message });
    if (rollbackError) throw new Error(`${error.message} Storage rollback failed. Recover from ${safety.filename}. ${rollbackError.message}`);
    if (databaseRestored && safety) throw new Error(`${error.message} The database replacement committed. Safety backup: ${safety.filename}.`);
    throw error;
  } finally {
    if (storageStopped) {
      const result = run(docker, ["start", storageContainer]);
      if (result.status !== 0) console.error("Could not restart local Storage:", result.stderr);
    }
    rmSync(temp, { recursive: true, force: true });
    if (maintenanceStarted) rmSync(maintenanceFile, { force: true });
  }
}
