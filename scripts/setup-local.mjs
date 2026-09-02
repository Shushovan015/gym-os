import { existsSync } from "node:fs";
import { join } from "node:path";
import { projectRoot, runNpm } from "./windows-common.mjs";

if (!existsSync(join(projectRoot, ".env.local"))) {
  console.error(".env.local is missing. Copy .env.example and add the local Supabase publishable key.");
  process.exit(1);
}
if (runNpm(["run", "supabase:start"]).status !== 0) process.exit(1);
if (runNpm(["run", "build"]).status !== 0) process.exit(1);
console.log("\nLocal production setup is ready. You can now double-click OPEN GYM APP.");
