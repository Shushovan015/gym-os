import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("verifies protected media and reports failures without emitting source paths", (t) => {
  const base = mkdtempSync(join(tmpdir(), "gym-media-verify-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const media = join(base, "objects");
  for (const folder of ["first", "second"]) mkdirSync(join(media, folder), { recursive: true });
  const bytes = Buffer.from("synthetic object data");
  for (const folder of ["first", "second"]) writeFileSync(join(media, folder, "fixture.txt"), bytes);
  const entry = (path) => ({ path, bytes: bytes.length, sha256: hash(bytes), visibility: "private" });
  const files = [entry("first/fixture.txt"), entry("second/fixture.txt"), entry("first/fixture.txt"),
    entry("../outside.txt"), entry("missing.txt"), { ...entry("first/wrong.txt"), sha256: "0".repeat(64) }];
  writeFileSync(join(media, "first", "wrong.txt"), bytes);
  const manifest = JSON.stringify({ version: 1, files });
  const manifestPath = join(base, "manifest.json");
  writeFileSync(manifestPath, manifest);
  const verify = (digest) => spawnSync(process.execPath, ["scripts/verify-migration-media.mjs", media, manifestPath, digest], { encoding: "utf8" });
  assert.equal(verify("0".repeat(64)).status, 2);
  const result = verify(hash(manifest));
  assert.equal(result.status, 1);
  assert.ok(!result.stdout.includes("fixture.txt"));
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.entries.map(({ status }) => status),
    ["verified", "verified", "duplicate-path", "invalid-entry", "missing", "checksum-mismatch"]);
  assert.equal(report.entries[1].duplicateName, true);
  assert.equal(report.entries[1].duplicateContent, true);
});
