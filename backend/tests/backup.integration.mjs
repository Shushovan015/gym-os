import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const phpArgs = process.env.GYM_PHP_EXTENSION_DIR
  ? ["-d", `extension_dir=${process.env.GYM_PHP_EXTENSION_DIR}`, "-d", "extension=pdo_mysql", "-d", "extension=gd", "-d", "extension=zip"]
  : [];

function php(env, script, arguments_, expected = 0) {
  const result = spawnSync("php", [...phpArgs, `backend/${script}.php`, ...arguments_], { env, encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.error?.message || result.stdout);
  return expected === 0 ? result.stdout.trim() : result.stderr.trim();
}

test("encrypts a database and uploaded images and restores them into an isolated blank database", (t) => {
  assert.match(process.env.GYM_BACKUP_TEST_SOURCE_DSN ?? "", /^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_backup_fixture;charset=utf8mb4$/);
  assert.match(process.env.GYM_BACKUP_TEST_TARGET_DSN ?? "", /^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_restore_fixture;charset=utf8mb4$/);
  const sandbox = mkdtempSync(join(tmpdir(), "gym-php-backup-"));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  const directory = (name) => {
    const path = join(sandbox, name);
    mkdirSync(path);
    return path;
  };
  const common = {
    ...process.env,
    GYM_BACKUP_DIR: directory("archives"),
    GYM_BACKUP_PASSWORD: randomBytes(32).toString("hex"),
  };
  const source = { ...common, GYM_DB_DSN: process.env.GYM_BACKUP_TEST_SOURCE_DSN,
    GYM_PRIVATE_MEDIA_DIR: directory("source-members"), GYM_PRODUCT_MEDIA_DIR: directory("source-catalog") };
  const target = { ...common, GYM_DB_DSN: process.env.GYM_BACKUP_TEST_TARGET_DSN,
    GYM_PRIVATE_MEDIA_DIR: directory("target-members"), GYM_PRODUCT_MEDIA_DIR: directory("target-catalog") };

  php(source, "bin/migrate", ["apply"]);
  php(target, "bin/migrate", ["apply"]);
  const original = JSON.parse(php(source, "tests/backup-fixture", ["seed"]));
  assert.equal(original.invoice.balance_minor, 800);
  assert.equal(original.payment.amount_minor, 400);
  assert.equal(original.stock.current_quantity, "1.125");

  const { archive } = JSON.parse(php(source, "bin/backup", ["create"]));
  assert.deepEqual(readdirSync(common.GYM_BACKUP_DIR), [archive.split(/[\\/]/).at(-1)]);
  const check = JSON.parse(php(source, "bin/backup", ["check", archive]));
  assert.equal(check.media, 2);
  assert.ok(check.tables > 35);
  assert.match(php({ ...source, GYM_BACKUP_PASSWORD: randomBytes(32).toString("hex") }, "bin/backup", ["check", archive], 1), /decrypt|archive validation/i);
  assert.match(php(source, "bin/backup", ["restore", archive, "gym_backup_fixture"], 1), /different from the backup source/);
  assert.equal(JSON.parse(php(target, "tests/backup-fixture", ["inspect"])).member, false);
  php(source, "tests/backup-fixture", ["break-reference"]);
  let broken;
  try {
    broken = JSON.parse(php(source, "bin/backup", ["create"])).archive;
  } finally {
    php(source, "tests/backup-fixture", ["repair-reference"]);
  }
  assert.match(php(target, "bin/backup", ["restore", broken, "gym_restore_fixture"], 1), /relationship is invalid/);
  assert.equal(JSON.parse(php(target, "tests/backup-fixture", ["inspect"])).member, false);
  assert.deepEqual(readdirSync(target.GYM_PRIVATE_MEDIA_DIR), []);

  assert.deepEqual(JSON.parse(php(target, "bin/backup", ["restore", archive, "gym_restore_fixture"])), { tables: check.tables, media: 2 });
  php(target, "bin/migrate", ["verify"]);
  assert.deepEqual(JSON.parse(php(target, "tests/backup-fixture", ["inspect"])), original);
  for (const variable of ["GYM_PRIVATE_MEDIA_DIR", "GYM_PRODUCT_MEDIA_DIR"]) {
    const [key] = readdirSync(source[variable]);
    assert.deepEqual(readFileSync(join(target[variable], key)), readFileSync(join(source[variable], key)));
  }
  assert.match(php(target, "bin/backup", ["restore", archive, "gym_restore_fixture"], 1), /already contains application data/);
});
