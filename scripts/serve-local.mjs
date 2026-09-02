import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");
const runtimeDir = join(projectRoot, ".runtime");
const pidFile = join(runtimeDir, "frontend.pid");
const host = "127.0.0.1";
const port = 4173;
const contentTypes = { ".css": "text/css; charset=utf-8", ".gif": "image/gif", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };

if (!existsSync(join(distRoot, "index.html"))) throw new Error('Production build is missing. Run "npm run build" first.');

function safeFile(urlPath) {
  try {
    const decoded = decodeURIComponent(urlPath.split("?")[0]);
    const relative = normalize(decoded).replace(/^[/\\]+/, "");
    const candidate = resolve(distRoot, relative);
    return candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`) ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer((request, response) => {
  if (request.url === "/__gym_health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: true, app: "gym-management" }));
    return;
  }
  const requested = safeFile(request.url ?? "/");
  if (!requested) { response.writeHead(400); response.end("Bad request"); return; }
  let file = requested;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) || !statSync(file).isFile()) file = join(distRoot, "index.html");
  const extension = extname(file).toLowerCase();
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "same-origin",
  });
  createReadStream(file).on("error", () => response.destroy()).pipe(response);
});

function removeOwnPidFile() {
  try { if (existsSync(pidFile) && Number(readFileSync(pidFile, "utf8").trim()) === process.pid) rmSync(pidFile); } catch { /* Windows may briefly lock the PID file. */ }
}
server.on("error", (error) => {
  removeOwnPidFile();
  console.error(error.code === "EADDRINUSE" ? `Gym app port ${port} is already in use.` : error);
  process.exit(1);
});
server.listen(port, host, () => {
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(pidFile, String(process.pid), "utf8");
  console.log(`Gym Management System is serving http://${host}:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { removeOwnPidFile(); process.exit(0); }));
process.on("exit", removeOwnPidFile);
