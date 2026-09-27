import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const projectRef = process.argv[2] || process.env.SUPABASE_PROJECT_REF;
const accessToken = process.argv[3] || process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error(`
Usage:
  node scripts/deploy-hosted.mjs <project-ref> <access-token>

Or set environment variables:
  SUPABASE_PROJECT_REF=abc123 SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/deploy-hosted.mjs

Get project ref from: https://supabase.com/dashboard/project/<project-id>/settings/general
Get access token from: https://supabase.com/dashboard/account/tokens
`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) {
    console.error(`\n❌ Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

console.log("🚀 Deploying to hosted Supabase project...");

run("npx", ["supabase", "login", "--token", accessToken]);
run("npx", ["supabase", "link", "--project-ref", projectRef]);
run("npx", ["supabase", "db", "push"]);
run("npx", ["supabase", "functions", "deploy", "send-bill", "send-progress-report"]);

console.log("\n✅ Deployment complete!");
console.log("Share .env.local with team:");
console.log(`VITE_SUPABASE_URL=https://${projectRef}.supabase.co`);
console.log("VITE_SUPABASE_ANON_KEY=<from hosted project dashboard>");