import { createFullBackup, listBackups, restoreBackup, validateBackup } from "./backup-engine.mjs";

try {
  const command = process.argv[2];
  if (command === "create") console.log(JSON.stringify(await createFullBackup(), null, 2));
  else if (command === "list") console.table(listBackups());
  else if (command === "validate") console.log(JSON.stringify(await validateBackup(process.argv[3]), null, 2));
  else if (command === "restore") {
    if (process.argv[4] !== "RESTORE LOCAL") throw new Error('Append "RESTORE LOCAL" as the explicit confirmation.');
    console.log(JSON.stringify(await restoreBackup(process.argv[3], { confirmed: true }), null, 2));
  } else throw new Error("Expected create, list, validate, or restore.");
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
