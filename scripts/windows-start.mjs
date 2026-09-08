import { existsSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { adminServiceIsHealthy, dockerCommand, edgeRuntimeIsHealthy, frontendIsHealthy, isDockerReady, launchUrl, projectRoot, runtimeDir, runNpm, waitFor } from "./windows-common.mjs";

function fail(message) {
  console.error(`\n${message}\n\nThe Gym Management System could not start.`);
  console.error("Please take a photo of this window and send it to the administrator.");
  process.exit(1);
}

console.log("Starting Gym Management System...");
if (!existsSync(join(projectRoot, "package.json"))) fail("Project files are missing.");
if (!existsSync(join(projectRoot, "node_modules"))) fail('Setup is incomplete: run "npm install" first.');
if (!existsSync(join(projectRoot, ".env.local"))) fail("Setup is incomplete: .env.local is missing.");
if (spawnSync(dockerCommand, ["--version"], { stdio: "ignore" }).status !== 0) fail("Docker Desktop is not installed or not available.");

if (!isDockerReady()) {
  console.log("Starting Docker Desktop...");
  const candidates = [
    join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Docker", "Docker Desktop.exe"),
  ];
  const executable = candidates.find(existsSync);
  if (!executable) fail("Docker Desktop could not be found. Please start it manually.");
  spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  if (!(await waitFor(isDockerReady, 60, 2000))) fail("Docker Desktop did not become ready within two minutes.");
} else console.log("Docker is already running.");

console.log("Starting database...");
const status = runNpm(["run", "supabase:status"], { stdio: "ignore" });
if (status.status !== 0) {
  if (runNpm(["run", "supabase:start"]).status !== 0) fail("The local database could not start.");
} else if (!(await edgeRuntimeIsHealthy())) {
  console.log("Restarting Supabase to recover a stopped service...");
  if (runNpm(["run", "supabase:stop"]).status !== 0 || runNpm(["run", "supabase:start"]).status !== 0) fail("The complete local database stack could not start.");
} else console.log("Local Supabase is already running.");

if (!(await waitFor(edgeRuntimeIsHealthy, 30, 1000))) fail("The member report service did not start.");

if (!existsSync(join(projectRoot, "dist", "index.html"))) {
  console.log("Production build is missing. Building the application...");
  if (runNpm(["run", "build"]).status !== 0) fail("The production application could not be built.");
}

if (!(await adminServiceIsHealthy())) {
  console.log("Starting backup service...");
  mkdirSync(runtimeDir, { recursive: true });
  const log = openSync(join(runtimeDir, "admin-service.log"), "a");
  const child = spawn(process.execPath, [join(projectRoot, "scripts", "admin-service.mjs")], { cwd: projectRoot, detached: true, windowsHide: true, stdio: ["ignore", log, log] });
  child.unref();
  if (!(await waitFor(adminServiceIsHealthy, 30, 1000))) fail(`The local backup service did not respond. Check ${join(runtimeDir, "admin-service.log")}.`);
} else console.log("Backup service is already running.");

if (!(await frontendIsHealthy())) {
  console.log("Starting application...");
  mkdirSync(runtimeDir, { recursive: true });
  const log = openSync(join(runtimeDir, "frontend.log"), "a");
  const child = spawn(process.execPath, [join(projectRoot, "scripts", "serve-local.mjs")], { cwd: projectRoot, detached: true, windowsHide: true, stdio: ["ignore", log, log] });
  child.unref();
  if (!(await waitFor(frontendIsHealthy, 30, 1000))) fail(`The frontend did not respond. Check ${join(runtimeDir, "frontend.log")}.`);
} else console.log("Gym app is already running.");

console.log("Opening browser...");
spawn("cmd.exe", ["/c", "start", "", launchUrl], { detached: true, stdio: "ignore", windowsHide: true }).unref();
console.log(`\nGym Management System is ready.\n${launchUrl}`);
