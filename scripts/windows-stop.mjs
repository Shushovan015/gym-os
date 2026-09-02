import { existsSync } from "node:fs";
import { join } from "node:path";
import { frontendIsHealthy, pidBelongsToGymServer, projectRoot, readFrontendPid, removePidFile, runNpm } from "./windows-common.mjs";

function fail(message) {
  console.error(`\n${message}`);
  console.error("The database has NOT been stopped.");
  console.error("Please take a photo of this window and send it to the administrator.");
  process.exit(1);
}

console.log("Closing Gym Management System safely...");
if (!existsSync(join(projectRoot, "node_modules"))) fail("Setup is incomplete: project dependencies are missing.");
console.log("Creating database backup...");
if (runNpm(["run", "db:backup"]).status !== 0) fail("Backup failed.");

const pid = readFrontendPid();
if (pid) {
  if (!pidBelongsToGymServer(pid)) fail(`Safety check failed: PID ${pid} does not belong to the Gym frontend server.`);
  console.log("Stopping application...");
  try { process.kill(pid, "SIGTERM"); } catch (error) { if (error?.code !== "ESRCH") fail(`The Gym frontend process could not be stopped: ${error.message}`); }
  for (let attempt = 0; attempt < 10 && (await frontendIsHealthy()); attempt += 1) await new Promise((done) => setTimeout(done, 500));
  if (await frontendIsHealthy()) fail("The Gym frontend process did not stop.");
  removePidFile();
} else if (await frontendIsHealthy()) fail("The Gym frontend is running, but its PID file is missing. It was not stopped for safety.");
else { console.log("Application is already stopped."); removePidFile(); }

console.log("Stopping database...");
if (runNpm(["run", "supabase:stop"]).status !== 0) fail("The database could not be stopped after backup.");
console.log("\nGym Management System closed safely.\nBackup completed successfully.");
