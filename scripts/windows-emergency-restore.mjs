import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { restoreBackup, validateBackup } from "./backup-engine.mjs";
import { dockerCommand, isDockerReady, projectRoot, runNpm, waitFor } from "./windows-common.mjs";

function fail(message) { console.error(`\n${message}\nYour current database was not intentionally replaced.\nPlease contact the administrator.`); process.exit(1); }
const source = process.argv[2]; if (!source || !existsSync(source)) fail("The selected backup file was not found.");
if (spawnSync(dockerCommand, ["--version"], { stdio: "ignore" }).status !== 0) fail("Docker Desktop is not installed.");
if (!isDockerReady()) {
  console.log("Starting Docker Desktop...");
  const executable = [join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"), join(process.env.LOCALAPPDATA ?? "", "Docker", "Docker Desktop.exe")].find(existsSync);
  if (!executable) fail("Docker Desktop could not be found."); spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  if (!(await waitFor(isDockerReady, 60, 2000))) fail("Docker Desktop did not become ready.");
}
if (runNpm(["run", "supabase:status"], { stdio: "ignore" }).status !== 0 && runNpm(["run", "supabase:start"]).status !== 0) fail("Local Supabase could not start.");
try { const details = await validateBackup(source); console.log(`\nSelected: ${details.filename}\nType: ${details.type === "legacy" ? "Legacy database-only backup (Storage files are not included)" : "Full database and Storage backup"}`); }
catch (error) { fail(`Backup validation failed: ${error.message}`); }
const prompt = createInterface({ input: stdin, output: stdout }); const confirmation = await prompt.question('\nType "RESTORE" to replace current gym data: '); prompt.close();
if (confirmation !== "RESTORE") { console.log("Restore cancelled. No data was changed."); process.exit(0); }
try {
  console.log("Creating mandatory pre-restore safety backup, then restoring...");
  const result = await restoreBackup(source, { confirmed: true }); console.log(`Safety backup: ${result.safetyBackup}`);
  if (runNpm(["run", "supabase:verify"]).status !== 0) fail("Restore finished, but verification failed. The safety backup was preserved.");
} catch (error) {
  if (/backup/i.test(error.message)) fail("Safety backup failed.\nRestore has been cancelled.\nYour current database was not replaced.");
  fail(`Restore failed: ${error.message}`);
}
