import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  dockerCommand,
  isDockerReady,
  projectRoot,
  runNpm,
  waitFor,
} from "./windows-common.mjs";

function fail(message) {
  console.error(`\n${message}\n\nThe Gym Management System could not start.`);
  console.error(
    "Please take a photo of this window and send it to the administrator."
  );
  process.exit(1);
}

console.log("Starting Gym Management System...");

// ------------------------------------------------------------
// Basic checks
// ------------------------------------------------------------

if (!existsSync(join(projectRoot, "package.json"))) {
  fail("Project files are missing.");
}

if (!existsSync(join(projectRoot, "node_modules"))) {
  fail('Setup is incomplete: run "npm install" first.');
}

if (!existsSync(join(projectRoot, ".env.local"))) {
  fail("Setup is incomplete: .env.local is missing.");
}

if (
  spawnSync(dockerCommand, ["--version"], {
    stdio: "ignore",
    shell: true,
  }).status !== 0
) {
  fail("Docker Desktop is not installed or not available.");
}

// ------------------------------------------------------------
// Docker
// ------------------------------------------------------------

if (!isDockerReady()) {
  console.log("Starting Docker Desktop...");

  const candidates = [
    join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "Docker",
      "Docker",
      "Docker Desktop.exe"
    ),
    join(
      process.env.LOCALAPPDATA ?? "",
      "Docker",
      "Docker Desktop.exe"
    ),
  ];

  const executable = candidates.find(existsSync);

  if (!executable) {
    fail("Docker Desktop could not be found. Please start it manually.");
  }

  spawn(executable, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();

  console.log("Waiting for Docker Desktop...");

  if (!(await waitFor(isDockerReady, 60, 2000))) {
    fail("Docker Desktop did not become ready within two minutes.");
  }

  console.log("Docker Desktop is ready.");
} else {
  console.log("Docker is already running.");
}

// ------------------------------------------------------------
// Supabase
// ------------------------------------------------------------

console.log("Starting local Supabase...");

let supabaseResult = runNpm(["run", "supabase:start"]);

if (supabaseResult.status !== 0) {
  console.log(
    "Supabase is already running or still starting. Waiting for it to become ready..."
  );
}

const supabaseReady = await waitFor(
  async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:54321/rest/v1/",
        {
          method: "GET",
        }
      );

      return response.status < 500;
    } catch {
      return false;
    }
  },
  60,
  2000
);

if (!supabaseReady) {
  fail(
    "Local Supabase did not become ready within two minutes."
  );
}

console.log("Local Supabase is ready.");

// ------------------------------------------------------------
// Local Edge Function
// ------------------------------------------------------------

console.log("Starting local send-bill Edge Function...");

const edgeFunction = spawn(
  "npm",
  ["run", "supabase:functions:serve"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  }
);

let edgeFunctionExited = false;

edgeFunction.on("exit", (code, signal) => {
  edgeFunctionExited = true;

  if (!signal && code !== 0) {
    console.error(
      `\nThe send-bill Edge Function stopped unexpectedly (exit code ${code}).`
    );
  }
});

edgeFunction.on("error", (error) => {
  console.error(
    `\nCould not start the send-bill Edge Function: ${error.message}`
  );
});

// Give the Edge Function a little time to start before starting Vite.
// We intentionally do not call the function with OPTIONS because
// verify_jwt=true means an unauthenticated request can return 401
// even when the function is working correctly.
console.log("Waiting for send-bill Edge Function...");

await new Promise((resolve) => setTimeout(resolve, 4000));

if (edgeFunctionExited) {
  fail(
    "The send-bill Edge Function stopped during startup. Check the Edge Function output above."
  );
}

console.log("send-bill Edge Function is running.");

// ------------------------------------------------------------
// Vite
// ------------------------------------------------------------

console.log("Starting development server...");

const dev = spawn(
  "npm",
  ["run", "dev"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  }
);

dev.on("error", (error) => {
  console.error(`\nDevelopment server failed to start: ${error.message}`);
});

dev.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});

// ------------------------------------------------------------
// Browser
// ------------------------------------------------------------

await new Promise((resolve) => setTimeout(resolve, 2000));

console.log("Opening browser...");

spawn(
  "cmd.exe",
  ["/c", "start", "", "http://localhost:5173/admin"],
  {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }
).unref();

console.log(`
Gym Management System is ready.

Application:
http://localhost:5173/admin

Supabase:
http://127.0.0.1:54321

Send Bill:
Local Edge Function is running

Press Ctrl+C to stop.
`);

// ------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------

function shutdown() {
  console.log("\nStopping local development processes...");

  if (edgeFunction && !edgeFunction.killed) {
    edgeFunction.kill();
  }

  if (dev && !dev.killed) {
    dev.kill();
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);