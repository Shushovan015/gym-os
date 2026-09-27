import { existsSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { dockerCommand, isDockerReady, projectRoot, runNpm } from "./windows-common.mjs";

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

console.log("Starting local Supabase...");
if (runNpm(["run", "supabase:start"]).status !== 0) fail("Local Supabase could not start.");

console.log("Starting development server...");
const dev = spawn("npm", ["run", "dev"], { cwd: projectRoot, stdio: "inherit", shell: true });
dev.on("exit", (code) => process.exit(code ?? 0));

console.log("Opening browser...");
spawn("cmd.exe", ["/c", "start", "", "http://localhost:5173/admin"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
console.log("\nGym Management System is ready.\nhttp://localhost:5173/admin");
console.log("Press Ctrl+C to stop.");
