import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";

const child = spawn(process.platform === "win32" ? "docker.exe" : "docker", ["exec", "-i", "supabase_db_gym-app", "psql", "-U", "postgres", "-d", "postgres"], { stdio: ["pipe", "inherit", "inherit"] });
createReadStream(new URL("./scale-check.sql", import.meta.url)).pipe(child.stdin);
const code = await new Promise((resolve) => child.on("close", resolve));
if (code !== 0) process.exitCode = code;
