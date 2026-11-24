import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const extensions = process.env.GYM_PHP_EXTENSION_DIR
  ? ["-d", `extension_dir=${process.env.GYM_PHP_EXTENSION_DIR}`, "-d", "extension=pdo_mysql"]
  : [];

function command(script, args, expected = 0) {
  const result = spawnSync("php", [...extensions, `backend/bin/${script}.php`, ...args], { encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.error?.message);
  return expected ? result.stderr : result.stdout;
}

test("imports a protected PostgreSQL fixture through the actual exporter format and reconciles exact financial data", () => {
  assert.match(process.env.GYM_DB_DSN ?? "", /^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_rehearsal;charset=utf8mb4$/);
  const file = process.env.GYM_PG_FIXTURE_FILE;
  assert.ok(file);
  const input = readFileSync(file);
  assert.ok(!input.includes("excluded-fixture-hash"));
  const digest = createHash("sha256").update(input).digest("hex");
  command("migrate", ["apply"]);
  assert.match(command("import-postgresql", ["plan", file, "0".repeat(64)], 1), /checksum/i);
  const plan = JSON.parse(command("import-postgresql", ["plan", file, digest]));
  assert.equal(plan.applied, false);
  assert.equal(plan.imported.members, 2);
  assert.equal(plan.imported.membership_payment_allocations, 2);
  assert.equal(plan.unmappedFields.members.source_fixture_note, 2);
  assert.equal(plan.archiveOnly.auth_identities, 1);
  assert.deepEqual(plan.historicalEmail, { sent: 1, uncertain: 2 });
  assert.ok(plan.verifiedFinancialFields > 20);
  assert.equal(JSON.parse(command("reconcile", ["snapshot"])).counts.members, "0");
  const applied = JSON.parse(command("import-postgresql", ["apply", file, digest]));
  assert.deepEqual(applied, { ...plan, applied: true });
  const snapshot = JSON.parse(command("reconcile", ["snapshot"]));
  assert.equal(snapshot.counts.admin_accounts, "0");
  assert.equal(snapshot.counts.attendance_records, "1");
  assert.equal(snapshot.counts.bill_email_attempts, "3");
  assert.equal(snapshot.invoiceSequence, "904");
  assert.deepEqual(snapshot.stock, [{ sku: "FIXTURE-121", quantity: "2.125", is_active: 1 }]);
  assert.equal(snapshot.invoices.find((item) => item.invoice_status === "issued").total_minor, "1950");
  assert.equal(snapshot.invoices.find((item) => item.invoice_status === "issued").balance_minor, "500");
  assert.equal(snapshot.membershipFees.find((item) => item.status === "partial").outstanding_minor, "600");
  assert.equal(snapshot.payments.find((item) => item.is_reversal === 1).amount_minor, "900");
  assert.deepEqual(JSON.parse(command("reconcile", ["review"])).invoicePaymentDiscrepancies, []);
  assert.match(command("import-postgresql", ["apply", file, digest], 1), /not empty/i);
});
