import { adminServicePort, frontendPort, pidFile, projectRoot, runtimeDir } from "./windows-common.mjs";
import { request as proxyRequest } from "node:http";
import { startAdminService } from "./start-admin-service.mjs";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const distRoot = join(projectRoot, "dist");
const host = "127.0.0.1";
const port = frontendPort;
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

const stopAdminService = await startAdminService();
const server = createServer((request, response) => {
  if (/^\/api\/(backup\/|maintenance(?:\?|$))/.test(request.url ?? "")) {
    const { origin, ...headers } = request.headers;
    if (origin && origin !== `http://${request.headers.host}`) {
      response.writeHead(403).end();
      return;
    }
    const upstream = proxyRequest({ hostname: "127.0.0.1", port: adminServicePort, path: request.url, method: request.method, headers }, (result) => {
      response.writeHead(result.statusCode, result.headers);
      result.pipe(response);
    });
    upstream.on("error", () => {
      if (response.headersSent) return response.destroy();
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Local backup service is unavailable. Check the terminal where the gym app was started." }));
    });
    response.on("close", () => upstream.destroy());
    request.pipe(upstream);
    return;
  }
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
process.on("exit", () => { stopAdminService(); removeOwnPidFile(); });
