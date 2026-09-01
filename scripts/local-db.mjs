import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const projectId = "gym-app";
const docker = process.platform === "win32" ? "docker.exe" : "docker";

function databaseContainer() {
  const result = spawnSync(
    docker,
    [
      "ps",
      "--filter",
      `label=com.supabase.cli.project=${projectId}`,
      "--filter",
      "name=supabase_db_",
      "--format",
      "{{.Names}}",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Docker is unavailable: ${result.stderr || result.stdout}`);
  }
  const containers = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  if (containers.length !== 1 || containers[0] !== `supabase_db_${projectId}`) {
    throw new Error(
      `The local Supabase database is not running. Run "npm run supabase:start" first. Found: ${containers.join(", ") || "none"}`,
    );
  }
  return containers[0];
}

function timestamp() {
  const now = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}`;
}

async function backup() {
  const container = databaseContainer();
  const directory = resolve("backups");
  mkdirSync(directory, { recursive: true });
  const destination = resolve(directory, `gym-management-${timestamp()}.dump`);
  const output = createWriteStream(destination, { flags: "wx" });
  const child = spawn(
    docker,
    ["exec", container, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--no-owner", "--no-privileges"],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  child.stdout.pipe(output);
  const finished = once(output, "finish");
  const code = await new Promise((done) => child.on("close", done));
  await finished;
  if (code !== 0 || !existsSync(destination) || statSync(destination).size === 0) {
    throw new Error("pg_dump failed; no usable backup was created.");
  }
  console.log(`Backup created: ${destination}`);
}

async function restore(fileArgument) {
  if (!fileArgument) {
    throw new Error("A backup file is required. Example: npm run db:restore -- backups/gym-management-YYYY-MM-DD-HHMMSS.dump");
  }
  const source = resolve(fileArgument);
  if (!existsSync(source) || !statSync(source).isFile() || statSync(source).size === 0) {
    throw new Error(`Backup file is missing or empty: ${source}`);
  }
  if (!source.toLowerCase().endsWith(".dump")) {
    throw new Error("Restore accepts only an explicit .dump file.");
  }
  const container = databaseContainer();
  console.warn(`WARNING: this will replace data in LOCAL container ${container} using ${basename(source)}.`);
  const prompt = createInterface({ input: stdin, output: stdout });
  const confirmation = await prompt.question('Type "RESTORE LOCAL" to continue: ');
  prompt.close();
  if (confirmation !== "RESTORE LOCAL") {
    throw new Error("Restore cancelled; confirmation did not match.");
  }
  const child = spawn(
    docker,
    ["exec", "-i", container, "pg_restore", "-U", "postgres", "-d", "postgres", "--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error"],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const input = (await import("node:fs")).createReadStream(source);
  input.pipe(child.stdin);
  const code = await new Promise((done) => child.on("close", done));
  if (code !== 0) throw new Error(`pg_restore failed with exit code ${code}.`);
  console.log("Local database restore completed.");
}

try {
  const command = process.argv[2];
  if (command === "backup") await backup();
  else if (command === "restore") await restore(process.argv[3]);
  else throw new Error("Expected backup or restore command.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
