import { spawn } from "node:child_process";
import { adminHealthUrl, adminServiceIsHealthy, projectRoot, waitFor } from "./windows-common.mjs";

export async function startAdminService() {
  if (await adminServiceIsHealthy()) return () => {};
  const child = spawn(process.execPath, ["scripts/admin-service.mjs"], {
    cwd: projectRoot, stdio: "inherit", windowsHide: true,
  });
  let failure;
  child.on("error", (error) => { failure = error.message; });
  child.on("exit", (code) => { failure = `exit code ${code}`; });
  const ready = await waitFor(async () => failure || await adminServiceIsHealthy(), 20, 250);
  if (failure || !ready) console.error(`Backup service could not start at ${adminHealthUrl}. ${failure ?? "Health check timed out."}`);
  return () => { if (!child.killed) child.kill(); };
}
