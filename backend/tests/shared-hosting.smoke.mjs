import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const origin = process.env.GYM_SMOKE_ORIGIN ?? "";
const browserPath = process.env.GYM_SMOKE_BROWSER ?? "";
const email = process.env.GYM_SMOKE_ADMIN_EMAIL ?? "";
const password = process.env.GYM_SMOKE_ADMIN_PASSWORD ?? "";

async function eventually(check, description) {
  for (let i = 0; i < 100; i++) {
    try {
      const result = await check();
      if (result) return result;
    } catch { /* A navigation can briefly replace the browser execution context. */ }
    await setTimeout(150);
  }
  throw new Error(description);
}

test("loads the Apache PHP package in Chromium with non-local network requests blocked", { timeout: 240000 }, async (t) => {
  assert.match(origin, /^https:\/\/(localhost|127\.0\.0\.1):\d+$/);
  assert.ok(browserPath && email.endsWith("@example.test") && password.length > 15);
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const profile = mkdtempSync(join(tmpdir(), "gym-browser-rehearsal-"));
  const browser = spawn(browserPath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--ignore-certificate-errors", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  t.after(async () => {
    browser.kill();
    for (let i = 0; browser.exitCode === null && browser.signalCode === null && i < 20; i++) await setTimeout(100);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const page = await eventually(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return pages.find((item) => item.type === "page" && item.url === "about:blank");
  }, "The local Chromium debugging page did not start.");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
    socket.addEventListener("close", () => reject(new Error("Chromium closed its debugging page before connecting.")), { once: true });
  });
  t.after(() => socket.close());
  let next = 0;
  const pending = new Map();
  const outboundRequests = [];
  const apiResponses = new Map();
  const runtimeErrors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    if (socket.readyState !== WebSocket.OPEN) {
      reject(new Error(`The Chromium session closed before ${method}.`));
      return;
    }
    const deadline = globalThis.setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chromium timed out during ${method}.`));
    }, 10000);
    pending.set(id, { resolve, reject, method, deadline });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (request) clearTimeout(request.deadline);
      if (message.error) request?.reject(new Error(`${request.method}: ${message.error.message}`));
      else request?.resolve(message.result);
      return;
    }
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      if (request.url.startsWith(origin + "/")) {
        void send("Fetch.continueRequest", { requestId }).catch(() => {});
      } else {
        outboundRequests.push(request.url);
        void send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {});
      }
    }
    if (message.method === "Network.responseReceived") {
      const { url, status } = message.params.response;
      if (url.startsWith(origin + "/api/")) apiResponses.set(new URL(url).pathname, status);
    }
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return result.result.value;
  };
  const visit = async (path, text) => {
    await send("Page.navigate", { url: origin + path });
    await eventually(() => evaluate(`location.pathname === ${JSON.stringify(path)}
      && document.readyState === "complete" && document.body?.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})`),
    `The page did not render as expected at ${path}.`);
  };

  for (const [path, heading, api] of [
    ["/", "Training zones", "/api/public/home"],
    ["/facilities", "Explore the floor", "/api/public/facilities"],
    ["/trainers", "Personal Training", "/api/public/trainers"],
    ["/pricing", "Membership", "/api/public/pricing"],
    ["/shop", "Product Catalog", "/api/public/shop"],
    ["/contact", "Contact", "/api/public/contact"],
  ]) {
    await visit(path, heading);
    await eventually(() => apiResponses.get(api) === 200, `No successful PHP response from ${api}.`);
  }
  await visit("/about", "A simple process, repeated well.");
  assert.equal(apiResponses.get("/api/public/footer"), 200);
  await send("Page.navigate", { url: origin + "/admin/settings" });
  await eventually(() => evaluate('location.pathname === "/admin/login" && !!document.querySelector("input[type=email]")'),
    "Anonymous Settings access did not reach sign-in.");
  await evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [selector, value] of Object.entries(${JSON.stringify({ "input[type=email]": email, "input[type=password]": password })})) {
      const input = document.querySelector(selector);
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.querySelector("form").requestSubmit();
  })()`);
  await eventually(() => evaluate('location.pathname === "/admin/members" && document.body?.innerText.includes("Member management")'),
    "The fixture administrator could not sign in to the PHP package.");
  for (const [path, heading] of [
    ["/admin", "Quick actions"],
    ["/admin/attendance", "Attendance"],
    ["/admin/holidays", "Recurring Holiday Templates"],
    ["/admin/billing", "Billing"],
    ["/admin/inventory", "Inventory"],
    ["/admin/reports", "Monthly reports"],
    ["/admin/settings", "Single-gym settings"],
    ["/admin/legacy-import", "Import Legacy Gym Data"],
    ["/studio", "Edit your public website"],
    ["/studio/home", "Home Content"],
    ["/studio/facilities", "Facilities Page Content"],
    ["/studio/trainers", "Trainer Page Dynamic Content"],
    ["/studio/pricing", "Pricing Page Content"],
    ["/studio/testimonials", "Add Testimonial"],
    ["/studio/proshop", "ProShop Page Content"],
    ["/studio/contact", "Contact Page Content"],
    ["/studio/footer", "Footer Content"],
  ]) await visit(path, heading);
  await send("Page.navigate", { url: origin + "/admin/home" });
  await eventually(() => evaluate('location.pathname === "/studio/home" && document.body?.innerText.includes("Home Content")'),
    "The historical Homepage editor link did not redirect to Studio.");
  assert.equal(apiResponses.get("/api/admin/backups"), 200);
  assert.ok([...apiResponses].every(([, status]) => status < 500));
  assert.deepEqual(runtimeErrors, []);
  assert.ok(!outboundRequests.some((value) => /supabase/i.test(new URL(value).hostname)));
});
