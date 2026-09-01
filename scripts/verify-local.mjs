import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url?.startsWith("http://127.0.0.1:") || !key) {
  throw new Error(".env.local must point to local Supabase before verification.");
}

const docker = process.platform === "win32" ? "docker.exe" : "docker";
const container = "supabase_db_gym-app";
const id = randomUUID();
const email = `local-check-${id}@example.invalid`;
const password = `Local-${randomUUID()}-Aa1!`;
const mediaPath = `verification/${id}.png`;
const memberCode = `VERIFY-${id.slice(0, 8)}`;
const client = createClient(url, key);
let userId = "";
let memberId = null;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

function localSql(sql) {
  const result = spawnSync(
    docker,
    ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

try {
  const publicRead = await client.from("home_content").select("id").limit(1);
  check(!publicRead.error, "public database read works");

  const denied = await client.from("members").insert({
    member_id: memberCode,
    full_name: "Denied anonymous write",
    phone: "0000000000",
    membership_type: "trial",
    membership_status: "active",
    payment_status: "paid",
  });
  check(Boolean(denied.error), "RLS blocks anonymous member writes");

  const signup = await client.auth.signUp({ email, password });
  if (signup.error || !signup.data.user) throw signup.error ?? new Error("Signup returned no user");
  userId = signup.data.user.id;
  check(Boolean(signup.data.session), "local Auth signup and session work");

  const profile = await client.from("profiles").select("role").single();
  check(!profile.error && profile.data.role === "user", "Auth trigger creates the local profile");

  await client.auth.signOut();
  const login = await client.auth.signInWithPassword({ email, password });
  check(!login.error && Boolean(login.data.session), "local Auth login and session restoration work");

  localSql(`update public.profiles set role = 'admin' where id = '${userId}'::uuid;`);
  const inserted = await client
    .from("members")
    .insert({
      member_id: memberCode,
      full_name: "Local verification member",
      phone: "0000000000",
      membership_type: "trial",
      membership_status: "active",
      payment_status: "paid",
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  memberId = inserted.data.id;
  check(Boolean(memberId), "admin database write passes RLS");

  const upload = await client.storage
    .from("gym-media")
    .upload(mediaPath, new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" });
  check(!upload.error, "local Storage admin upload works");
  const publicUrl = client.storage.from("gym-media").getPublicUrl(mediaPath).data.publicUrl;
  const mediaResponse = await fetch(publicUrl);
  check(mediaResponse.ok, "public Storage read works");

  const report = await client.functions.invoke("send-progress-report", { body: { member_id: memberId } });
  check(!report.error && report.data?.ok === true, "local Edge Function and service-role path work");

  const removeMedia = await client.storage.from("gym-media").remove([mediaPath]);
  if (removeMedia.error) throw removeMedia.error;
  const removeMember = await client.from("members").delete().eq("id", memberId);
  if (removeMember.error) throw removeMember.error;
  memberId = null;
  await client.auth.signOut();
  localSql(`delete from auth.users where id = '${userId}'::uuid;`);
  userId = "";
  check(true, "verification data cleaned up");
} finally {
  await client.storage.from("gym-media").remove([mediaPath]);
  if (memberId) localSql(`delete from public.members where id = ${Number(memberId)};`);
  if (userId) localSql(`delete from auth.users where id = '${userId}'::uuid;`);
}
