import { startAdminService } from "./start-admin-service.mjs";
import { spawn, spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let status = spawnSync(npx, ["supabase", "status"], { stdio: "ignore", shell: process.platform === "win32" });
if (status.status !== 0) {
  status = spawnSync(npx, ["supabase", "start"], { stdio: "inherit", shell: process.platform === "win32" });
  if (status.status !== 0) process.exit(status.status ?? 1);
}

const stopAdminService = await startAdminService();
const frontend = spawn(npm, ["run", "dev"], { stdio: "inherit", shell: process.platform === "win32" });
frontend.on("exit", (code) => { stopAdminService(); process.exit(code ?? 0); });
frontend.on("error", (error) => { console.error(error.message); stopAdminService(); process.exit(1); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopAdminService(); frontend.kill(); });
