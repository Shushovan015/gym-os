import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("staff recovery dry run validates approval and blocks role elevation", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "gym-staff-recovery-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, "source.csv");
  const roster = join(directory, "approved.json");
  const a = { id: "11111111-1111-4111-8111-111111111111", email: "admin@example.test", role: "admin" };
  const v = { id: "22222222-2222-4222-8222-222222222222", email: "viewer@example.test", role: "viewer" };
  const csv = [
    "id,email,email_confirmed_at,banned_until,deleted_at,source_role",
    `${a.id},${a.email},2026-01-01,,,admin`,
    `${v.id},${v.email},2026-01-01,,,user`,
  ].join("\n") + "\n";
  writeFileSync(source, csv);
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  function plan(entries, sourceHash = hash(csv)) {
    const json = JSON.stringify(entries);
    writeFileSync(roster, json);
    return spawnSync("php", ["backend/bin/staff-recovery-plan.php", source, sourceHash, roster, hash(json)], { encoding: "utf8" });
  }
  const successful = plan([a, v]);
  assert.equal(successful.status, 0, successful.stderr);
  assert.deepEqual(JSON.parse(successful.stdout).eligibleByRole, { admin: 1, viewer: 1 });
  const blocked = plan([a, { ...v, role: "admin" }, a]);
  assert.equal(blocked.status, 1);
  assert.deepEqual(JSON.parse(blocked.stdout).blockedEntries, [2, 3]);
  assert.ok(!blocked.stdout.includes("@"));
  assert.equal(plan([a], "0".repeat(64)).status, 2);
});
