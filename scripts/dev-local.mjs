import { spawn, spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

let status = spawnSync(npx, ["supabase", "status"], { stdio: "ignore" });
if (status.status !== 0) {
  status = spawnSync(npx, ["supabase", "start"], { stdio: "inherit" });
  if (status.status !== 0) process.exit(status.status ?? 1);
}

const frontend = spawn(npm, ["run", "dev"], { stdio: "inherit" });
frontend.on("exit", (code) => process.exit(code ?? 0));
