import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const phpArgs = process.env.GYM_PHP_EXTENSION_DIR
  ? ["-d", `extension_dir=${process.env.GYM_PHP_EXTENSION_DIR}`, "-d", "extension=pdo_mysql"]
  : [];

function php(script, args, input) {
  const result = spawnSync("php", [...phpArgs, script, ...args], { cwd: root, input, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

async function testPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("authentication, members, private photos and attendance on MariaDB", async (t) => {
  assert.match(process.env.GYM_DB_DSN ?? "", /^mysql:host=127\.0\.0\.1;port=\d+;dbname=gym_migration_test;charset=utf8mb4$/);
  php("backend/bin/migrate.php", ["apply"]);
  php("backend/bin/migrate.php", ["apply"]);
  php("backend/bin/migrate.php", ["verify"]);

  const id = randomUUID();
  const admin = `${id}@example.test`;
  const viewer = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("hex");
  php("backend/bin/account.php", ["create", id, admin, "admin"], password);
  php("backend/bin/account.php", ["create", randomUUID(), viewer, "viewer"], password);

  const port = await testPort();
  const mediaDirectory = mkdtempSync(join(tmpdir(), "gym-member-photos-"));
  t.after(() => rmSync(mediaDirectory, { recursive: true, force: true }));
  const server = spawn("php", [...phpArgs, "-S", `127.0.0.1:${port}`, "-t", "backend/public", "backend/tests/router.php"], {
    cwd: root,
    env: {
      ...process.env,
      GYM_AUTH_TEST: "1",
      GYM_AUTH_TEST_ADDRESS: "2001:db8:" + randomBytes(12).toString("hex").match(/.{4}/g).join(":"),
      GYM_PRIVATE_MEDIA_DIR: mediaDirectory,
    },
    stdio: "ignore",
  });
  t.after(() => server.kill());

  let cookie;
  let csrf;
  async function request(path, expected, body, includeCsrf = true, headers = {}) {
    if (cookie) headers.Cookie = cookie;
    if (csrf && includeCsrf) headers["X-CSRF-Token"] = csrf;
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(`http://127.0.0.1:${port}/api/${path.includes("/") || path.startsWith("members?") ? path : "auth/" + path}`, {
      headers,
      method: body === undefined ? "GET" : "POST",
      body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
    });
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      for (const attribute of ["__Host-gym=", "Secure", "HttpOnly", "SameSite=Lax", "path=/"]) {
        assert.ok(setCookie.toLowerCase().includes(attribute.toLowerCase()), attribute);
      }
      assert.doesNotMatch(setCookie, /domain=/i);
      cookie = setCookie.split(";")[0];
    }
    if (response.headers.get("content-type") === "image/png") {
      return Buffer.from(await response.arrayBuffer());
    }
    const data = await response.json();
    csrf = data.csrfToken ?? csrf;
    return data;
  }

  for (let attempt = 0; ; attempt++) {
    try {
      assert.equal((await request("session", 200)).user, null);
      break;
    } catch (error) {
      if (!(error instanceof TypeError) || attempt === 20) throw error;
      await setTimeout(100);
    }
  }

  await request("admin", 401);
  await request("login", 403, { email: admin, password }, false);
  await request("login", 401, { email: admin, password: "wrong' OR 1=1" });
  const anonymousCookie = cookie;
  assert.equal((await request("login", 200, { email: admin, password })).user.id, id);
  assert.notEqual(cookie, anonymousCookie);
  const authenticatedCookie = cookie;
  cookie = anonymousCookie;
  await request("admin", 401);
  cookie = authenticatedCookie;
  await request("admin", 200);
  const planTitle = `Plan ${randomUUID()}`;
  const planId = Number(php("backend/tests/billing-worker.php", ["plan-fixture"], JSON.stringify(planTitle)));
  assert.ok((await request("members/plans", 200)).plans.some(({ id, title }) => id === planId && title === planTitle));
  assert.equal((await request("admin/settings", 200)).settings.attendance_holiday_lock, true);
  const profile = {
    member_id: randomUUID(),
    full_name: "Mina Sharma",
    phone: "+977" + randomBytes(6).toString("hex"),
    membership_type: "Monthly",
    membership_status: "active",
    start_date: "2024-02-29",
    end_date: "2024-03-29",
  };
  const { member } = await request("members/save", 201, profile);
  const details = `members/details?id=${member.id}`;
  const ledger = `members/fees?id=${member.id}`;
  assert.equal((await request(ledger, 200)).has_outstanding, false);
  php("backend/tests/fee-fixture.php", [String(member.id)]);
  const feeStatus = await request(ledger, 200);
  assert.equal(feeStatus.summary.total_due, 80000);
  assert.equal(feeStatus.summary.total_paid, 70000);
  assert.equal(feeStatus.summary.next_due_date, "2024-02-29");
  assert.deepEqual(feeStatus.outstanding_fees.map(({ status }) => status), ["partial", "unpaid"]);
  assert.equal(feeStatus.paid_fees.length, 1);
  const paymentBody = {
    memberId: member.id,
    feeIds: [feeStatus.outstanding_fees[0].id],
    amountMinor: 12000,
    paymentMethod: "cash",
  };
  const paymentKey = () => ({ "Idempotency-Key": randomUUID() });
  const key = paymentKey();
  await request("membership/payments", 403, paymentBody, false, key);
  const payment = await request("membership/payments", 201, paymentBody, true, key);
  assert.deepEqual(await request("membership/payments", 200, paymentBody, true, key), payment);
  const receiptPath = `invoices/receipt?id=${payment.invoice_id}`;
  const receipt = await request(receiptPath, 200);
  assert.equal(receipt.invoice.invoice_number, payment.invoice_number);
  assert.equal(receipt.items[0].line_total_minor, 12000);
  assert.equal(receipt.payments[0].id, payment.payment_id);
  assert.equal((await request(`membership/payment-history?id=${member.id}`, 200)).payments[0].id, payment.payment_id);
  const cancellation = { invoiceId: payment.invoice_id, reason: "Duplicate collection" };
  await request("membership/cancel-invoice", 403, cancellation, false);
  const reversal = await request("membership/cancel-invoice", 200, cancellation);
  assert.deepEqual(await request("membership/cancel-invoice", 200, cancellation), reversal);
  const cancelled = await request(receiptPath, 200);
  assert.equal(cancelled.invoice.invoice_status, "cancelled");
  assert.equal(cancelled.payments.length, 2);
  assert.equal(cancelled.payments[1].reverses_payment_id, payment.payment_id);
  const restoredLedger = await request(ledger, 200);
  assert.deepEqual(restoredLedger.summary, feeStatus.summary);
  assert.deepEqual(
    restoredLedger.outstanding_fees.map(({ updated_at, ...fee }) => fee),
    feeStatus.outstanding_fees.map(({ updated_at, ...fee }) => fee),
  );
  const variantId = Number(php("backend/tests/billing-worker.php", ["stock-fixture"], "null"));
  const stock = { variantId, type: "opening", quantityDelta: "12.125" };
  const stockHistory = `inventory/stock-history?variantId=${variantId}`;
  await request("inventory/stock", 403, stock, false);
  assert.equal((await request("inventory/stock", 201, stock)).current_quantity, "12.125");
  assert.equal((await request(stockHistory, 200)).movements[0].quantity_delta, "12.125");
  const category = randomUUID();
  const saveCatalog = (entity, fields, expected = 201, id) =>
    request("inventory/catalog/save", expected, { entity, fields, id });
  const supplier = await saveCatalog("supplier", { name: category });
  const product = await saveCatalog("product", {
    title: "Protein powder", category, supplier_id: supplier.id, inventory_enabled: true,
    cost_price_minor: 400, selling_price_minor: 750, low_stock_threshold: "2",
  });
  const sku = randomUUID();
  const variant = await saveCatalog("variant", { product_id: product.id, sku });
  await saveCatalog("variant", { product_id: product.id, sku }, 409);
  await saveCatalog("variant", { current_quantity: "400" }, 422, variant.id);
  await saveCatalog("variant", { name: "Vanilla" }, 200, variant.id);
  await saveCatalog("product", { title: "Protein" }, 200, product.id);
  await request("inventory/stock", 201, { variantId: variant.id, type: "opening", quantityDelta: "1.250" });
  const catalogPath = `inventory/catalog?category=${category}&search=${sku}&stock=low&active=active&limit=1`;
  const catalog = await request(catalogPath, 200);
  assert.equal(Number(catalog.summary.count), 1);
  assert.equal(Number(catalog.summary.value_minor), 500);
  assert.equal(catalog.products[0].title, "Protein");
  assert.equal(catalog.products[0].variants[0].name, "Vanilla");
  assert.equal(catalog.products[0].availability, "in_stock");
  const productInvoice = { customerName: "Test buyer", lines: [{ variantId: variant.id, quantity: "0.250" }] };
  await request("invoices/products/issue", 422, productInvoice);
  const sale = await request("invoices/products/issue", 201, productInvoice, true, paymentKey());
  assert.equal(sale.total_minor, 188);
  await request("invoices/products/cancel", 200, { invoiceId: sale.invoice_id, reason: "Returned" });
  assert.deepEqual((await request(catalogPath + "&offset=1", 200)).products, []);
  assert.ok((await request("inventory/suppliers", 200)).suppliers.some(({ id }) => id === supplier.id));
  await request("inventory/catalog/delete", 409, { entity: "product", id: product.id });
  const spare = await saveCatalog("product", { title: "Spare", category });
  const spareVariant = await saveCatalog("variant", { product_id: spare.id, sku: randomUUID() });
  await request("inventory/catalog/delete", 200, { entity: "variant", id: spareVariant.id });
  await request("inventory/catalog/delete", 200, { entity: "product", id: spare.id });
  await request("members/save", 409, profile);
  await request("members/save", 422, { id: member.id, payment_status: "paid" });
  await request("members/save", 422, { id: member.id, end_date: "2024-02-28" });
  assert.equal((await request("members/save", 200, { id: member.id, full_name: "Mina Karki" })).member.full_name, "Mina Karki");
  assert.ok((await request("members?search=kAr", 200)).members.some(({ id }) => id === member.id));
  await request("members/change", 422, { action: "delete" });
  assert.equal((await request("members/change", 200, { action: "deactivate", ids: [member.id] })).affected, 1);
  assert.equal((await request(details, 200)).statusHistory[0].status, "inactive");
  await request("members/change", 200, { action: "activate", ids: [member.id] });
  await request("members/change", 200, { action: "delete", ids: [member.id] });
  assert.ok((await request(details, 200)).member.deleted_at);
  await request("members/change", 200, { action: "restore", ids: [member.id] });
  assert.equal((await request(details, 200)).member.deleted_at, null);
  const buildUpload = (contents) => {
    const form = new FormData();
    form.set("memberId", member.id);
    form.set("photo", new Blob([contents], { type: "image/png" }), "portrait.png");
    return form;
  };
  const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKnEAAAAASUVORK5CYII=", "base64");
  await request("members/upload-photo", 403, buildUpload(photo), false);
  await request("members/upload-photo", 422, buildUpload("invalid image"));
  const upload = await request("members/upload-photo", 201, buildUpload(photo));
  const photoPath = upload.url.replace(/^\/api\//, "");
  assert.equal((await request(details, 200)).member.photo_url, upload.url);
  assert.deepEqual(await request(photoPath, 200), photo);
  await request("members/photo?key=..%2Findex.php", 404);
  const memberId = Number(php("backend/tests/attendance-fixture.php", []));
  const attendance = "attendance/change";
  const mark = { memberId, action: "mark" };
  await request(attendance, 403, { ...mark, date: "2024-02-29" }, false);
  await request(attendance, 422, { ...mark, date: "2023-02-29" });
  await request(attendance, 409, { ...mark, date: "2024-03-01" });
  await request(attendance, 409, { ...mark, date: "2024-03-02" });
  assert.equal((await request(attendance, 200, { ...mark, date: "2024-02-28" })).lastVisitDate, "2024-02-28");
  assert.equal((await request(attendance, 200, { ...mark, date: "2024-02-29" })).lastVisitDate, "2024-02-29");
  assert.equal((await request(attendance, 200, { ...mark, date: "2024-02-29", action: "remove" })).lastVisitDate, "2024-02-28");
  const history = `attendance/history?memberId=${memberId}`;
  const { records } = await request(history, 200);
  assert.deepEqual(records.map((record) => record.attendance_date), ["2024-02-29", "2024-02-28"]);
  assert.match(records[0].deleted_at, /Z$/);
  assert.equal((await request(attendance, 200, { ...mark, date: "2024-02-29", action: "restore" })).lastVisitDate, "2024-02-29");
  php("backend/bin/account.php", ["reset", id], randomBytes(24).toString("hex"));
  await request("admin", 401);
  await request("session", 200);
  await request("login", 401, { email: admin, password });
  assert.equal((await request("login", 200, { email: viewer, password, role: "admin" })).user.role, "viewer");
  await request("admin", 403);
  await request(details, 403);
  await request(ledger, 403);
  await request(receiptPath, 403);
  await request("membership/payments", 403, paymentBody, true, paymentKey());
  await request("membership/cancel-invoice", 403, cancellation);
  await request("inventory/stock", 403, stock);
  await request(stockHistory, 403);
  await request(catalogPath, 403);
  await saveCatalog("product", { title: "Unauthorized", category }, 403);
  await request("invoices/products/issue", 403, productInvoice, true, paymentKey());
  await request("members/save", 403, profile);
  await request(photoPath, 403);
  await request(history, 403);
  await request(attendance, 403, { ...mark, date: "2024-02-29" });
  await request("logout", 200, {});
  await request("admin", 401);
  await request(photoPath, 401);
  const missing = `${randomUUID()}@example.test`;
  for (let count = 0; count < 10; count++) {
    await request("login", 401, { email: missing, password });
  }
  await request("login", 429, { email: missing, password });
});
