import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cwd = fileURLToPath(new URL("../../", import.meta.url));
const php = process.env.GYM_PHP_EXTENSION_DIR
  ? ["-d", `extension_dir=${process.env.GYM_PHP_EXTENSION_DIR}`, "-d", "extension=pdo_mysql"]
  : [];

function work(mode, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("php", [...php, "backend/tests/billing-worker.php", mode], { cwd });
    let output = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.stdin.once("error", reject);
    child.once("close", (code) => {
      try {
        assert.equal(code, 0, stderr);
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

test("membership billing allocates and reconciles integer payments atomically", async () => {
  assert.match(process.env.GYM_DB_DSN ?? "", /^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/);
  for (const mode of ["apply", "apply", "verify"]) {
    const result = spawnSync("php", [...php, "backend/bin/migrate.php", mode], { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const fixture = (periods) => work("fixture", periods);
  const pay = (record, overrides = {}, key = randomUUID()) => work("pay", {
    payment: { ...record, paymentMethod: "cash", ...overrides },
    key,
  });

  const single = await fixture([["2024-01-31", 10000]]);
  assert.equal((await pay(single, { amountMinor: 10001 }))[0], 409);
  assert.equal((await work("state", single.memberId)).payments, 0);
  const [fullStatus, full] = await pay(single, { paymentDate: "2024-02-29" });
  assert.equal(fullStatus, 201);
  assert.equal(full.total_amount_minor, 10000);
  assert.equal(full.next_due_date, "2024-02-29");
  assert.equal((await pay(single))[0], 409);
  const nonLeap = await fixture([["2025-01-31", 10000]]);
  assert.equal((await pay(nonLeap, { paymentDate: "2025-02-29" }))[0], 422);
  assert.equal((await pay(nonLeap))[1].next_due_date, "2025-02-28");

  const multi = await fixture([["2024-01-31", 10000], ["2024-02-29", 15000]]);
  const [partialStatus, partial] = await pay(multi, { feeIds: [multi.feeIds[0]], amountMinor: 5001 });
  assert.equal(partialStatus, 201);
  assert.equal(partial.allocations[0].status, "partial");
  assert.equal(partial.next_due_date, "2024-01-31");
  assert.equal((await work("state", multi.memberId)).member.payment_status, "overdue");
  const [multiStatus, paid] = await pay(multi, { feeIds: [...multi.feeIds].reverse() });
  assert.equal(multiStatus, 201);
  assert.deepEqual(paid.allocations.map(({ amount_minor }) => amount_minor), [4999, 15000]);
  const multiState = await work("state", multi.memberId);
  assert.equal(multiState.allocated, 25000);
  assert.equal(multiState.fee_paid, 25000);
  assert.equal(multiState.line_total, multiState.invoice_total);
  assert.equal(multiState.paid_total, multiState.invoice_total);
  assert.equal(multiState.allocations, 3);
  assert.equal(multiState.audits, 2);
  assert.equal(multiState.requests, 2);
  const reversals = await Promise.all([work("cancel", partial.invoice_id), work("cancel", partial.invoice_id)]);
  assert.equal(reversals[0][0], 200);
  assert.deepEqual(reversals[0], reversals[1]);
  const reversed = await work("state", multi.memberId);
  assert.equal(reversed.paid_total, 19999);
  assert.equal(reversed.fee_paid, 19999);
  assert.equal(reversed.payments, 3);
  assert.equal(reversed.audits, 3);
  assert.equal(reversed.member.payment_due_date, "2024-01-31");

  const contested = await fixture([["2024-03-31", 10000]]);
  const competing = await Promise.all([pay(contested), pay(contested)]);
  assert.deepEqual(competing.map(([status]) => status).sort(), [201, 409]);
  assert.equal((await work("state", contested.memberId)).invoices, 1);

  const retried = await fixture([["2024-03-31", 10000], ["2024-04-30", 10000]]);
  const retryKey = randomUUID();
  const [first, second] = await Promise.all([
    pay(retried, {}, retryKey),
    pay(retried, { feeIds: [...retried.feeIds].reverse() }, retryKey),
  ]);
  assert.deepEqual([first[0], second[0]].sort(), [200, 201]);
  assert.deepEqual(first[1], second[1]);
  assert.equal((await pay(retried, { amountMinor: 5000 }, retryKey))[0], 409);
  assert.equal((await work("state", retried.memberId)).payments, 1);
  assert.equal((await pay(single, { feeIds: retried.feeIds }))[0], 409);

  const independent = await Promise.all(Array.from({ length: 6 }, () => fixture([["2024-04-30", 10000]])));
  const issued = await Promise.all(independent.map((record) => pay(record)));
  assert.ok(issued.every(([status]) => status === 201));
  const numbers = issued.map(([, receipt]) => Number(receipt.invoice_number)).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 6 }, (_, index) => numbers[0] + index));

  const failed = await fixture([["2024-03-31", 10000]]);
  const before = await work("state", failed.memberId);
  const failedKey = randomUUID();
  await work("inject", failed.memberId);
  try {
    assert.equal((await pay(failed, {}, failedKey))[0], 500);
    assert.deepEqual(await work("state", failed.memberId), before);
  } finally {
    await work("clear", null);
  }
  assert.equal((await pay(failed, {}, failedKey))[0], 201);

  const taxable = await fixture([["2024-04-30", 101]]);
  await work("tax", 1300);
  try {
    const [status, receipt] = await pay(taxable);
    assert.equal(status, 201);
    assert.equal(receipt.tax_minor, 13);
    assert.equal(receipt.total_amount_minor, 114);
    const state = await work("state", taxable.memberId);
    assert.equal(state.allocated, 101);
    assert.equal(state.paid_total, 114);
    assert.equal(state.line_total, 114);
  } finally {
    await work("tax", 0);
  }

  const variantId = await work("stock-fixture", null);
  const stock = (type, quantityDelta) => work("stock", { variantId, type, quantityDelta });
  assert.equal((await stock("opening", "2.250"))[1].current_quantity, "2.250");
  assert.equal((await stock("sale", "-1"))[0], 422);
  const deductions = await Promise.all([stock("manual_decrease", "-1.500"), stock("manual_decrease", "-1.500")]);
  assert.deepEqual(deductions.map(([status]) => status).sort(), [201, 409]);
  const [, history] = await work("stock-history", variantId);
  assert.equal(history.movements.length, 2);
  assert.equal(history.movements[0].previous_quantity, "2.250");
  assert.equal(history.movements[0].resulting_quantity, "0.750");
});

test("saved attempts survive rollback and concurrent execution", async () => {
  const fixture = await work("fixture", [["2025-04-10", 1000]]);
  const key = randomUUID();
  assert.equal((await work("attempt", { action: "prepare", key, path: "/membership/payments",
    payload: { ...fixture, amountMinor: 500, paymentMethod: "cash" } }))[0], 200);
  const execute = { action: "execute", key };
  await work("inject", fixture.memberId);
  try {
    assert.equal((await work("attempt", execute))[0], 500);
    assert.equal((await work("state", fixture.memberId)).invoices, 0);
  } finally {
    await work("clear", null);
  }
  const results = await Promise.all([work("attempt", execute), work("attempt", execute)]);
  assert.deepEqual(results.map(([status]) => status).sort(), [200, 201]);
  assert.deepEqual(results[0][1], results[1][1]);
  const state = await work("state", fixture.memberId);
  assert.equal(state.invoices, 1);
  assert.equal(state.payments, 1);
  assert.equal(state.allocations, 1);
  assert.equal(state.allocated, 500);
  await work("attempt", { action: "dismiss", key });
});

test("legacy cancellation restores reconciled stock and rejects inconsistent histories", async () => {
  const clean = await work("legacy-fixture", "balanced");
  const result = await Promise.all([work("product-cancel", clean.invoiceId), work("product-cancel", clean.invoiceId)]);
  assert.ok(result.every(([status]) => status === 200));
  const [, receipt] = await work("product-receipt", clean.invoiceId);
  assert.equal(receipt.invoice.invoice_status, "cancelled");
  assert.equal(receipt.payments.length, 2);
  assert.equal(receipt.payments[1].reverses_payment_id, receipt.payments[0].id);
  const [, history] = await work("stock-history", clean.variantId);
  assert.equal(history.movements[0].resulting_quantity, "3.250");
  assert.equal(history.movements.filter(({ movement_type }) => movement_type === "cancellation_reversal").length, 1);
  for (const invalid of ["bad-stock", "bad-payment"]) {
    const fixture = await work("legacy-fixture", invalid);
    assert.equal((await work("product-cancel", fixture.invoiceId))[0], 409);
    assert.equal((await work("product-receipt", fixture.invoiceId))[1].invoice.invoice_status, "issued");
    assert.equal((await work("stock-history", fixture.variantId))[1].movements.length, 1);
  }
});

test("stock-linked invoices preserve line prices and reverse the combined sale once", async () => {
  const fixture = async () => {
    const variantId = await work("stock-fixture", null);
    assert.equal((await work("stock", { variantId, type: "opening", quantityDelta: "5.500" }))[0], 201);
    return variantId;
  };
  const a = await fixture();
  const b = await fixture();
  const invoice = {
    customerName: "Counter customer",
    lines: [
      { variantId: a, quantity: "1.125", customerType: "general" },
      { variantId: a, quantity: "2.250", customerType: "wholesale" },
      { variantId: b, quantity: "0.500", customerType: "general" },
    ],
  };
  const issue = (body, key = randomUUID()) => work("product-issue", { invoice: body, key });
  const key = randomUUID();
  const duplicate = await Promise.all([issue(invoice, key), issue(invoice, key)]);
  assert.deepEqual(duplicate.map(([status]) => status).sort(), [200, 201]);
  assert.deepEqual(duplicate[0][1], duplicate[1][1]);
  assert.equal((await issue({ ...invoice, customerName: "Different customer" }, key))[0], 409);
  const issued = duplicate[0][1];
  assert.equal(issued.total_minor, 3750);
  const [, receipt] = await work("product-receipt", issued.invoice_id);
  assert.deepEqual(receipt.items.map(({ quantity, unit_price_minor }) => [quantity, unit_price_minor]),
    [["1.125", 1200], ["2.250", 800], ["0.500", 1200]]);
  assert.equal(receipt.payments.length, 1);
  assert.equal(receipt.payments[0].amount_minor, 3750);
  const stock = async (id) => (await work("stock-history", id))[1].movements;
  assert.equal((await stock(a))[0].quantity_delta, "-3.375");
  assert.equal((await stock(a))[0].resulting_quantity, "2.125");

  const cancellations = await Promise.all([work("product-cancel", issued.invoice_id), work("product-cancel", issued.invoice_id)]);
  assert.deepEqual(cancellations[0], cancellations[1]);
  assert.equal(cancellations[0][0], 200);
  const restored = await stock(a);
  assert.equal(restored[0].quantity_delta, "3.375");
  assert.equal(restored[0].resulting_quantity, "5.500");
  assert.equal(restored.filter(({ movement_type }) => movement_type === "cancellation_reversal").length, 1);
  assert.equal((await stock(b))[0].resulting_quantity, "5.500");
  const [, cancelled] = await work("product-receipt", issued.invoice_id);
  assert.equal(cancelled.invoice.invoice_status, "cancelled");
  assert.equal(cancelled.payments.length, 2);
  assert.equal(cancelled.payments[1].reverses_payment_id, issued.payment_id);
  assert.equal(cancelled.payments[1].amount_minor, 3750);

  const contested = { ...invoice, lines: [{ variantId: a, quantity: "4" }] };
  const concurrent = await Promise.all([issue(contested), issue(contested)]);
  assert.deepEqual(concurrent.map(([status]) => status).sort(), [201, 409]);
  assert.equal((await stock(a))[0].resulting_quantity, "1.500");
  assert.equal((await issue({ ...contested, lines: [{ variantId: b, quantity: "-1" }] }))[0], 422);

  const failure = { ...invoice, lines: [{ variantId: b, quantity: "1" }] };
  const before = await stock(b);
  const retryKey = randomUUID();
  await work("stock-inject", b);
  try {
    assert.equal((await issue(failure, retryKey))[0], 500);
    assert.deepEqual(await stock(b), before);
  } finally {
    await work("stock-clear", null);
  }
  assert.equal((await issue(failure, retryKey))[0], 201);
  assert.equal((await stock(b))[0].resulting_quantity, "4.500");
});
