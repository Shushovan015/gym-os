import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const runtimeDir = join(projectRoot, ".runtime");
export const pidFile = join(runtimeDir, "frontend.pid");
export const adminPidFile = join(runtimeDir, "admin-service.pid");
export const appUrl = "http://127.0.0.1:4173";
export const launchUrl = `${appUrl}/admin`;
export const healthUrl = `${appUrl}/__gym_health`;
export const adminHealthUrl = "http://127.0.0.1:4174/health";
export const edgeFunctionUrl = "http://127.0.0.1:54321/functions/v1/send-progress-report";
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
export const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

export function run(command, args, options = {}) { return spawnSync(command, args, { cwd: projectRoot, stdio: "inherit", ...options }); }
export function runNpm(args, options = {}) {
  return spawnSync(npmCommand, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}
export function isDockerReady() { return spawnSync(dockerCommand, ["info"], { cwd: projectRoot, stdio: "ignore" }).status === 0; }
export async function waitFor(check, attempts, delayMs) {
  for (let attempt = 0; attempt < attempts; attempt += 1) { if (await check()) return true; await new Promise((done) => setTimeout(done, delayMs)); }
  return false;
}
export async function frontendIsHealthy() {
  try { const response = await fetch(healthUrl, { cache: "no-store" }); const body = response.ok ? await response.json() : null; return body?.ok === true && body?.app === "gym-management"; } catch { return false; }
}
export async function adminServiceIsHealthy() {
  try { const response = await fetch(adminHealthUrl, { cache: "no-store" }); const body = response.ok ? await response.json() : null; return body?.ok === true && body?.service === "gym-local-admin"; } catch { return false; }
}
export async function edgeRuntimeIsHealthy() {
  try {
    const response = await fetch(edgeFunctionUrl, { method: "OPTIONS", cache: "no-store" });
    return response.ok;
  } catch { return false; }
}
export function readFrontendPid() {
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
export function removePidFile() { if (existsSync(pidFile)) rmSync(pidFile); }
export function readAdminPid() {
  if (!existsSync(adminPidFile)) return null;
  const pid = Number(readFileSync(adminPidFile, "utf8").trim());
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
export function removeAdminPidFile() { if (existsSync(adminPidFile)) rmSync(adminPidFile); }
export function pidBelongsToGymServer(pid) {
  if (process.platform !== "win32") return true;
  const command = `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\").CommandLine`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 && (result.stdout?.trim().toLowerCase() ?? "").includes("serve-local.mjs");
}
export function pidBelongsToAdminService(pid) {
  if (process.platform !== "win32") return true;
  const command = `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\").CommandLine`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { cwd: projectRoot, encoding: "utf8", windowsHide: true });
  return result.status === 0 && (result.stdout?.trim().toLowerCase() ?? "").includes("admin-service.mjs");
}
