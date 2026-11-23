import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { startSmtp } from "./fake-smtp.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const phpArgs = process.env.GYM_PHP_EXTENSION_DIR
  ? ["-d", `extension_dir=${process.env.GYM_PHP_EXTENSION_DIR}`, "-d", "extension=pdo_mysql", "-d", "extension=gd", "-d", "extension=fileinfo"]
  : [];

function php(script, args, input, env = process.env) {
  const result = spawnSync("php", [...phpArgs, script, ...args], { cwd: root, input, encoding: "utf8", env });
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
  const smtp = await startSmtp(t);
  const mediaDirectory = mkdtempSync(join(tmpdir(), "gym-member-photos-"));
  const catalogMediaDirectory = mkdtempSync(join(tmpdir(), "gym-catalog-photos-"));
  t.after(() => rmSync(mediaDirectory, { recursive: true, force: true }));
  t.after(() => rmSync(catalogMediaDirectory, { recursive: true, force: true }));
  const server = spawn("php", [...phpArgs, "-S", `127.0.0.1:${port}`, "-t", "backend/public", "backend/tests/router.php"], {
    cwd: root,
    env: {
      ...process.env,
      GYM_AUTH_TEST: "1",
      GYM_AUTH_TEST_ADDRESS: "2001:db8:" + randomBytes(12).toString("hex").match(/.{4}/g).join(":"),
      GYM_PRIVATE_MEDIA_DIR: mediaDirectory,
      GYM_PRODUCT_MEDIA_DIR: catalogMediaDirectory,
      GYM_SMTP_TEST: "1",
      GYM_SMTP_HOST: "127.0.0.1",
      GYM_SMTP_PORT: String(smtp.port),
      GYM_SMTP_ENCRYPTION: "test",
      GYM_SMTP_FROM: "billing@example.test",
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
    const response = await fetch(`http://127.0.0.1:${port}/api/${path.includes("/") || path.includes("?") ? path : "auth/" + path}`, {
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
  await request("studio/contact", 401);
  await request("studio/home", 401);
  await request("studio/facilities", 401);
  await request("studio/trainers", 401);
  await request("studio/pricing", 401);
  await request("studio/testimonials", 401);
  await request("studio/proshop", 401);
  await request("admin/settings", 401);
  await request("public/home", 200);
  await request("public/contact", 200);
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
  const contactSave = "studio/contact/save";
  const contactFields = ("hero_badge hero_title hero_description hero_image cta_primary_text cta_primary_link " +
    "cta_secondary_text cta_secondary_link phone email hours location map_embed_url visit_text form_note info_title " +
    "info_description form_title form_description form_button_text faq_title faq_description bottom_cta_title " +
    "bottom_cta_description bottom_primary_cta_text bottom_primary_cta_link bottom_secondary_cta_text bottom_secondary_cta_link").split(" ");
  const contact = Object.fromEntries(contactFields.map((key) => [key, ""]));
  contact.hero_title = "Fixture gym contact";
  contact.summary_cards = [{ label: "Location", value: "Butwal", icon: "MapPin" }];
  await request(contactSave, 403, { action: "content", content: contact }, false);
  await request(contactSave, 422, { action: "content", content: { ...contact, cta_primary_link: "javascript:alert(1)" } });
  await request(contactSave, 200, { action: "content", content: contact });
  assert.deepEqual((await request("studio/contact", 200)).content, contact);
  const question = randomUUID();
  const faq = { question, answer: "Fixture answer", sort_order: 12, is_active: false };
  await request(contactSave, 200, { action: "faq", faq });
  const savedFaq = (await request("studio/contact", 200)).faqs.find((entry) => entry.question === question);
  assert.equal(savedFaq.is_active, false);
  cookie = undefined;
  const publicContact = await request("public/contact", 200);
  assert.deepEqual(publicContact.content, contact);
  assert.ok(publicContact.faqs.every((entry) => entry.id !== savedFaq.id));
  cookie = authenticatedCookie;
  await request(contactSave, 200, { action: "faq", id: savedFaq.id, faq: { ...faq, is_active: true } });
  assert.ok((await request("public/contact", 200)).faqs.some((entry) => entry.id === savedFaq.id && entry.is_active));
  await request(contactSave, 200, { action: "delete-faq", id: savedFaq.id });
  assert.ok((await request("public/contact", 200)).faqs.every((entry) => entry.id !== savedFaq.id));
  const footerSave = "studio/footer/save";
  const homeSave = "studio/home/save";
  const homeFields = ("hero_badge hero_title hero_description hero_image hero_primary_cta_text hero_primary_cta_link " +
    "hero_secondary_cta_text hero_secondary_cta_link status_title zones_title coaches_title coaches_subtitle maximus_badge " +
    "maximus_title maximus_description maximus_image maximus_learn_more_link maximus_instagram_link gallery_title " +
    "testimonials_title testimonials_subtitle final_cta_title final_cta_description final_primary_cta_text final_primary_cta_link " +
    "final_secondary_cta_text final_secondary_cta_link").split(" ");
  const home = Object.fromEntries(homeFields.map((field) => [field, ""]));
  Object.assign(home, { hero_title: "Fixture homepage", hero_image: "/media/fixture-hero.webp", hero_metrics: [],
    gallery_images: [{ url: "/media/fixture-gallery.webp", alt: "Fixture gallery" }] });
  await request(homeSave, 403, { action: "content", content: home }, false);
  await request(homeSave, 422, { action: "content", content: { ...home, hero_image: "javascript:alert(1)" } });
  await request(homeSave, 200, { action: "content", content: home });
  const statusPrefix = randomUUID();
  for (const [label, sort_order, is_active] of [["first", -20, true], ["hidden", -30, false], ["second", -10, true]]) {
    await request(homeSave, 200, { action: "item", list: "status", item: { label: statusPrefix + label, value: label, sort_order, is_active } });
  }
  await request(homeSave, 422, { action: "item", list: "points", item: { point: "Test", sort_order: "1", is_active: true } });
  await request(homeSave, 200, { action: "item", list: "points", item: { point: statusPrefix, sort_order: 1, is_active: false } });
  const editorHome = await request("studio/home", 200);
  assert.deepEqual(editorHome.content, home);
  const savedStatuses = editorHome.status.filter(({ label }) => label.startsWith(statusPrefix));
  assert.deepEqual(savedStatuses.map(({ value }) => value), ["hidden", "first", "second"]);
  assert.equal(editorHome.points.find(({ point }) => point === statusPrefix).is_active, false);
  const firstStatus = savedStatuses.find(({ value }) => value === "first");
  await request(homeSave, 200, { action: "item", list: "status", id: firstStatus.id, item: { ...firstStatus, sort_order: 10 } });
  cookie = undefined;
  const visitorHome = await request("public/home", 200);
  assert.deepEqual(visitorHome.content, home);
  assert.deepEqual(visitorHome.status.filter(({ label }) => label.startsWith(statusPrefix)).map(({ value }) => value), ["second", "first"]);
  assert.ok(!visitorHome.points.some(({ point }) => point === statusPrefix));
  cookie = authenticatedCookie;
  for (const { id } of savedStatuses) await request(homeSave, 200, { action: "delete", list: "status", id });
  await request(homeSave, 200, { action: "delete", list: "points", id: editorHome.points.find(({ point }) => point === statusPrefix).id });
  const footer = {
    brand_name: "Fixture gym", location: "Butwal", banner_title: "Fixture footer", banner_subtitle: "Train locally",
    cta_text: "Contact", cta_link: "/contact", about_text: "Fixture gym details", hours_text: "Monday",
    phone: "", email: "", copyright_text: "", bottom_tags: "Strength | Coaching",
  };
  await request(footerSave, 403, { content: footer }, false);
  await request(footerSave, 422, { content: { ...footer, cta_link: "javascript:alert(1)" } });
  await request(footerSave, 200, { content: footer });
  cookie = undefined;
  assert.deepEqual((await request("public/footer", 200)).content, footer);
  cookie = authenticatedCookie;
  const dashboardPath = "admin/dashboard?period=7&horizon=15";
  const beforeDashboard = await request(dashboardPath, 200);
  const fixtureDashboard = JSON.parse(php("backend/tests/dashboard-fixture.php", []));
  const reportPath = `admin/reports?start=${fixtureDashboard.today}&end=${fixtureDashboard.today}`;
  await request("admin/reports?start=2025-02-29&end=2025-02-29", 422);
  await request("admin/reports?start=2090-01-01&end=2090-01-01", 422);
  const updatedDashboard = await request(dashboardPath, 200);
  assert.equal(updatedDashboard.today, fixtureDashboard.today);
  assert.equal(updatedDashboard.attendanceLabels.length, 7);
  assert.equal(updatedDashboard.attendanceLabels.at(-1), fixtureDashboard.today);
  assert.equal(updatedDashboard.horizon, 15);
  for (const [key, delta] of Object.entries({
    liveCount: 1, activeCount: 1, newCount: 1, unpaidCount: 1, attendanceTodayCount: 1, lowCount: 1, outCount: 1,
    revenueToday: 300, outstanding: 500,
  })) {
    assert.equal(updatedDashboard.metrics[key] - beforeDashboard.metrics[key], delta, key);
  }
  assert.equal(updatedDashboard.attendanceValues.at(-1) - beforeDashboard.attendanceValues.at(-1), 1);
  assert.equal(updatedDashboard.attendanceValues.at(-2), beforeDashboard.attendanceValues.at(-2));
  assert.ok(updatedDashboard.upcomingHolidays.some(({ name }) => name === "Dashboard fixture holiday"));
  assert.equal((await request(`members/fees?id=${fixtureDashboard.memberId}`, 200)).summary.total_due, 600);
  await request("members/change", 200, { action: "deactivate", ids: [fixtureDashboard.memberId] });
  assert.equal((await request(dashboardPath, 200)).metrics.activeCount, updatedDashboard.metrics.activeCount);
  assert.equal((await request("admin/dashboard?period=90", 200)).attendanceLabels.length, 90);
  await request("admin/dashboard?period=8", 422);
  const planTitle = `Plan ${randomUUID()}`;
  const pricingSave = "studio/pricing/save";
  const pricingFields = ("hero_badge hero_title hero_description hero_primary_cta_text hero_primary_cta_link hero_secondary_cta_text " +
    "hero_secondary_cta_link benefits_title benefits_description advisor_title advisor_description advisor_cta_text advisor_cta_link " +
    "popular_badge_text bottom_cta_title bottom_cta_description bottom_primary_cta_text bottom_primary_cta_link " +
    "bottom_secondary_cta_text bottom_secondary_cta_link").split(" ");
  const pricingContent = Object.fromEntries(pricingFields.map((name) => [name, ""]));
  Object.assign(pricingContent, { hero_title: "Fixture pricing", summary_cards: [{ label: "Plans", value: "{plans}", icon: "Crown" }] });
  await request(pricingSave, 403, { action: "content", content: pricingContent }, false);
  await request(pricingSave, 422, { action: "content", content: { ...pricingContent, advisor_cta_link: "javascript:alert(1)" } });
  await request(pricingSave, 200, { action: "content", content: pricingContent });
  const pricingPlan = { kind: "plan", title: planTitle, price: "NPR 2,000", cadence: "/month", subtitle: "Gym access",
    is_highlighted: true, features: ["Training floor"], sort_order: -20, is_active: false };
  await request(pricingSave, 200, { action: "item", item: pricingPlan });
  const planId = (await request("studio/pricing", 200)).items.find(({ title }) => title === planTitle).id;
  assert.ok(!(await request("public/pricing", 200)).items.some(({ id }) => id === planId));
  assert.ok(!(await request("members/plans", 200)).plans.some(({ id }) => id === planId));
  await request(pricingSave, 200, { action: "item", id: planId, item: { ...pricingPlan, is_active: true } });
  cookie = undefined;
  const publicPricing = await request("public/pricing", 200);
  assert.deepEqual(publicPricing.content, pricingContent);
  assert.deepEqual(publicPricing.items.find(({ id }) => id === planId), { ...pricingPlan, id: planId, is_active: true });
  cookie = authenticatedCookie;
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
  const recipient = `${randomUUID()}@example.test`;
  const emailMember = (await request("members/save", 201, {
    ...profile, member_id: randomUUID(), phone: String(Date.now()), email: recipient,
  })).member;
  const mailBill = async () => {
    const { invoice_id: invoiceId } = await request("invoices/services/issue", 201, {
      memberId: emailMember.id, service: { kind: "miscellaneous", description: "Printable charge", unitPriceMinor: 12345 },
    }, true, paymentKey());
    return { invoiceId, expectedEmail: recipient };
  };
  const mail = await mailBill();
  const sendMail = "invoices/email/send";
  await request(sendMail, 409, { ...mail, expectedEmail: "different@example.test" });
  await request(sendMail, 403, mail, false);
  const mailResults = await Promise.all([request(sendMail, 200, mail), request(sendMail, 200, mail)]);
  assert.equal(mailResults[0].delivery.status, "sent");
  assert.equal(mailResults[1].delivery.id, mailResults[0].delivery.id);
  assert.equal(smtp.messages.length, 1);
  assert.match(smtp.messages[0], /filename="?invoice\.html"?/);
  assert.match(smtp.messages[0], /NPR 123\.45/);
  assert.match(smtp.messages[0], new RegExp(`\\b${recipient.replace(".", "\\.")}\\b`));
  const retryMail = await mailBill();
  smtp.behavior = "reject";
  const failed = (await request(sendMail, 200, retryMail)).delivery;
  assert.equal(failed.status, "failed");
  assert.equal((await request(sendMail, 200, retryMail)).delivery.id, failed.id);
  smtp.behavior = "accept";
  assert.equal((await request(sendMail, 200, { ...retryMail, retryId: failed.id })).delivery.status, "sent");
  const uncertain = await mailBill();
  smtp.behavior = "drop";
  const unknown = (await request(sendMail, 200, uncertain)).delivery;
  assert.equal(unknown.status, "uncertain");
  const mailCount = smtp.messages.length;
  assert.equal((await request(sendMail, 200, { ...uncertain, retryId: unknown.id })).delivery.status, "uncertain");
  assert.equal(smtp.messages.length, mailCount);
  const mailStatus = (await request(`invoices/email?id=${uncertain.invoiceId}`, 200)).delivery;
  assert.equal(mailStatus.message_token, unknown.message_token);
  assert.equal((await request("invoices/email/reconcile", 200, {
    invoiceId: uncertain.invoiceId, evidence: "SMTP fixture queue confirmed acceptance",
  })).delivery.status, "sent");
  smtp.behavior = "accept";
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
  const transactions = await request(`membership/payment-history?id=${member.id}`, 200);
  assert.deepEqual(transactions.payments.map(({ is_reversal }) => is_reversal), [true, false]);
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
  const shopSave = "studio/proshop/save";
  const shopFields = ("hero_badge hero_title hero_description hero_image hero_primary_cta_text hero_primary_cta_link " +
    "hero_secondary_cta_text hero_secondary_cta_link catalog_title catalog_description inquiry_button_text inquiry_link_default " +
    "bottom_cta_title bottom_cta_description bottom_primary_cta_text bottom_primary_cta_link bottom_secondary_cta_text bottom_secondary_cta_link").split(" ");
  const shopContent = Object.fromEntries(shopFields.map((field) => [field, ""]));
  Object.assign(shopContent, { hero_title: "Fixture shop", items_per_page: 8, summary_cards: [], inquiry_link_default: "/contact" });
  await request(shopSave, 403, { action: "content", content: shopContent }, false);
  await request(shopSave, 200, { action: "content", content: shopContent });
  const shopItem = { title: "Protein", category, price: "NPR 500", description: "Fixture product", image: "", badge: "",
    inquire_link: "/contact", sort_order: -20, is_featured: true, is_active: true };
  await request(shopSave, 422, { action: "item", id: product.id, item: { ...shopItem, inquire_link: "javascript:alert(1)" } });
  await request(shopSave, 200, { action: "item", id: product.id, item: shopItem });
  const readPublicShop = async () => {
    const response = await fetch(`http://127.0.0.1:${port}/api/public/shop`);
    assert.equal(response.status, 200);
    return response.json();
  };
  const emptyShop = await readPublicShop();
  assert.deepEqual(emptyShop.content, shopContent);
  assert.deepEqual(emptyShop.items.find(({ id }) => id === product.id), { id: product.id, ...shopItem, availability: "out_of_stock" });
  assert.equal((await request("studio/proshop", 200)).items.find(({ id }) => id === product.id).price, "NPR 500");
  await request(shopSave, 409, { action: "delete", id: product.id });
  await saveCatalog("variant", { product_id: product.id, sku }, 409);
  await saveCatalog("variant", { current_quantity: "400" }, 422, variant.id);
  await saveCatalog("variant", { name: "Vanilla" }, 200, variant.id);
  await saveCatalog("product", { title: "Protein" }, 200, product.id);
  await request("inventory/stock", 201, { variantId: variant.id, type: "opening", quantityDelta: "1.250" });
  assert.equal((await readPublicShop()).items.find(({ id }) => id === product.id).availability, "available");
  await request(shopSave, 200, { action: "item", id: product.id, item: { ...shopItem, is_active: false } });
  assert.ok(!(await readPublicShop()).items.some(({ id }) => id === product.id));
  await request(shopSave, 200, { action: "item", id: product.id, item: shopItem });
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
  const productReport = await request(reportPath, 200);
  assert.equal(productReport.invoices.find(({ id }) => id === sale.invoice_id).total_minor, 188);
  assert.equal(productReport.items.find(({ invoice_id }) => invoice_id === sale.invoice_id).quantity, 0.25);
  const invoiceList = "invoices?search=Test%20buyer&invoiceStatus=issued&paymentStatus=paid&limit=1";
  const overview = await request(invoiceList, 200);
  assert.equal(overview.invoices[0].id, sale.invoice_id);
  assert.equal(overview.invoices[0].php_product, true);
  assert.ok(overview.summary.revenue_today >= 188);
  assert.deepEqual((await request(invoiceList + `&offset=${overview.count}`, 200)).invoices, []);
  await request("invoices?from=2025-02-29", 422);
  await request("invoices/products/cancel", 200, { invoiceId: sale.invoice_id, reason: "Returned" });
  assert.ok(!(await request(invoiceList, 200)).invoices.some(({ id }) => id === sale.invoice_id));
  const partiallyPaid = await request("invoices/products/issue", 201, {
    ...productInvoice, paymentMinor: 50, dueDate: "2030-01-01", expectedTotalMinor: 188,
    customerPhone: "9800000000", notes: "Fixture invoice",
  }, true, paymentKey());
  const balanceBody = { invoiceId: partiallyPaid.invoice_id, amountMinor: 100, paymentMethod: "cash" };
  const balanceKey = paymentKey();
  await request("invoices/payments", 403, balanceBody, false, balanceKey);
  await request("invoices/payments", 409, { ...balanceBody, amountMinor: 139 }, true, paymentKey());
  const recorded = await request("invoices/payments", 201, balanceBody, true, balanceKey);
  assert.deepEqual(await request("invoices/payments", 200, balanceBody, true, balanceKey), recorded);
  await request("invoices/payments", 409, { ...balanceBody, amountMinor: 1 }, true, balanceKey);
  const partReceipt = await request(`invoices/receipt?id=${partiallyPaid.invoice_id}`, 200);
  assert.equal(partReceipt.invoice.balance_minor, 38);
  assert.equal(partReceipt.invoice.customer_phone, "9800000000");
  assert.equal(partReceipt.invoice.notes, "Fixture invoice");
  assert.equal(partReceipt.payments.length, 2);
  const cancelPartial = { invoiceId: partiallyPaid.invoice_id, reason: "Returned" };
  await request("invoices/products/cancel", 200, cancelPartial);
  await request("invoices/products/cancel", 200, cancelPartial);
  const reversed = await request(`invoices/receipt?id=${partiallyPaid.invoice_id}`, 200);
  assert.equal(reversed.payments.filter((p) => p.is_reversal).length, 2);
  const trainingName = `Training ${randomUUID()}`;
  const trainersSave = "studio/trainers/save";
  const trainerPageFields = ("pt_badge pt_title pt_description pt_cta_text pt_cta_link hero_badge hero_title hero_description " +
    "hero_primary_cta_text hero_primary_cta_link hero_secondary_cta_text hero_secondary_cta_link strength_section_title equipment_section_title").split(" ");
  const trainerPage = Object.fromEntries(trainerPageFields.map((field) => [field, ""]));
  Object.assign(trainerPage, { hero_title: "Fixture coaching page", spotlight_count: 3,
    strength_metrics: [{ label: "Racks", value: "8", sub: "Strength floor", icon: "Dumbbell" }], equipment_zones: [] });
  await request(trainersSave, 200, { action: "content", content: trainerPage });
  assert.deepEqual((await request("public/trainers", 200)).ptContent, trainerPage);
  const plan = { name: trainingName, details: "NPR 1,500", points: ["Technique review"], sort_order: -20, is_active: false };
  await request(trainersSave, 403, { action: "item", entity: "plan", item: plan }, false);
  await request(trainersSave, 200, { action: "item", entity: "plan", item: plan });
  const trainingId = (await request("studio/trainers", 200)).plans.find(({ name }) => name === trainingName).id;
  assert.ok(!(await request("public/trainers", 200)).plans.some(({ id }) => id === trainingId));
  assert.ok(!(await request("invoices/training-plans", 200)).plans.some(({ id }) => id === trainingId));
  await request(trainersSave, 200, { action: "item", entity: "plan", id: trainingId, item: { ...plan, is_active: true } });
  assert.deepEqual((await request("public/trainers", 200)).plans.find(({ id }) => id === trainingId).points, ["Technique review"]);
  assert.ok((await request("invoices/training-plans", 200)).plans.some((plan) => plan.id === trainingId && plan.price === "NPR 1,500"));
  const trainingBill = { customerName: "Training buyer", paymentMinor: 40000, dueDate: "2030-01-01",
    expectedTotalMinor: 145000, service: { kind: "personal_training", planId: trainingId, unitPriceMinor: 150000, discountMinor: 5000 } };
  const trainingKey = paymentKey();
  const training = await request("invoices/services/issue", 201, trainingBill, true, trainingKey);
  assert.deepEqual(await request("invoices/services/issue", 200, trainingBill, true, trainingKey), training);
  const trainingReceipt = await request(`invoices/receipt?id=${training.invoice_id}`, 200);
  assert.equal(trainingReceipt.items[0].description, trainingName);
  assert.equal(trainingReceipt.items[0].item_type, "personal_training");
  assert.equal(trainingReceipt.invoice.balance_minor, 105000);
  await request("invoices/products/cancel", 200, { invoiceId: training.invoice_id, reason: "Service cancelled" });
  assert.equal((await request(`invoices/receipt?id=${training.invoice_id}`, 200)).payments.filter((p) => p.is_reversal).length, 1);
  await request("invoices/services/issue", 422, { customerName: "Miscellaneous buyer", service: { kind: "miscellaneous", unitPriceMinor: 700 } }, true, paymentKey());
  const misc = await request("invoices/services/issue", 201, {
    customerName: "Miscellaneous buyer", service: { kind: "miscellaneous", description: "Replacement card", unitPriceMinor: 700 },
  }, true, paymentKey());
  assert.equal((await request(`invoices/receipt?id=${misc.invoice_id}`, 200)).items[0].description, "Replacement card");
  assert.deepEqual((await request(catalogPath + "&offset=1", 200)).products, []);
  assert.ok((await request("inventory/suppliers", 200)).suppliers.some(({ id }) => id === supplier.id));
  const setupSku = randomUUID();
  const stocked = await request("inventory/catalog/save", 201, {
    entity: "product", openingStock: "2.750", fields: { title: "Stocked fixture", category, sku: setupSku, inventory_enabled: true, low_stock_threshold: "3" },
  });
  const inventoryPage = `inventory/variants?category=${category}&search=${setupSku}&active=active&stock=low`;
  const stockedPage = await request(inventoryPage, 200);
  assert.equal(stockedPage.total, 1);
  assert.equal(stockedPage.rows[0].product.id, stocked.id);
  const stockedVariant = stockedPage.rows[0].variant;
  assert.equal(stockedVariant.current_quantity, "2.750");
  const stockAdjust = { type: "purchase", variantId: stockedVariant.id, quantityDelta: "1.125", costPriceMinor: 500 };
  await request("inventory/stock", 201, stockAdjust);
  assert.equal((await request(inventoryPage, 200)).total, 0);
  const inStockPage = await request(inventoryPage.replace("stock=low", "stock=in"), 200);
  assert.equal(inStockPage.rows[0].variant.cost_price_minor, 500);
  assert.equal(inStockPage.rows[0].variant.current_quantity, "3.875");
  assert.equal((await request(`inventory/stock-history?variantId=${stockedVariant.id}`, 200)).movements.length, 2);
  await request("inventory/catalog/activation", 200, { ids: [stocked.id], active: false });
  assert.equal((await request(inventoryPage.replace("active=active&stock=low", "active=inactive"), 200)).total, 1);
  await request("inventory/catalog/activation", 200, { ids: [stocked.id], active: true });
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
  const catalogUpload = "inventory/media/upload";
  const catalogBytes = Buffer.from(php("backend/tests/billing-worker.php", ["media-fixture"], "null"), "base64");
  const catalogPhoto = () => {
    const image = new FormData();
    image.set("photo", new Blob([catalogBytes], { type: "application/octet-stream" }), "untrusted.php");
    return image;
  };
  const publicFetch = (path) => fetch(`http://127.0.0.1:${port}${path}`);
  const facilitiesSave = "studio/facilities/save";
  const facilityUpload = "studio/media/upload";
  const facilityFields = ("hero_badge hero_title hero_description hero_primary_cta_text hero_primary_cta_link hero_secondary_cta_text " +
    "hero_secondary_cta_link zone_explorer_title zone_explorer_description amenities_title amenities_description tour_title " +
    "tour_description tour_primary_cta_text tour_primary_cta_link tour_secondary_cta_text tour_secondary_cta_link").split(" ");
  const facilityContent = Object.fromEntries(facilityFields.map((field) => [field, ""]));
  Object.assign(facilityContent, { hero_title: "Fixture Facilities", summary_cards: [{ label: "Zones", value: "{zones}", icon: "Building2" }] });
  await request(facilitiesSave, 403, { action: "content", content: facilityContent }, false);
  await request(facilitiesSave, 200, { action: "content", content: facilityContent });
  await request(facilityUpload, 403, catalogPhoto(), false);
  const facilityImage = (await request(facilityUpload, 201, catalogPhoto())).url;
  assert.equal((await publicFetch(facilityImage)).status, 404);
  const facility = { kind: "zone", title: randomUUID(), description: "Fixture training space", tag: "Strength",
    image: facilityImage, sort_order: -100, is_active: false };
  await request(facilitiesSave, 422, { action: "item", item: { ...facility, image: "javascript:alert(1)" } });
  await request(facilitiesSave, 200, { action: "item", item: facility });
  const facilityRead = await request("studio/facilities", 200);
  assert.deepEqual(facilityRead.content, facilityContent);
  const savedFacility = facilityRead.items.find(({ title }) => title === facility.title);
  assert.equal(savedFacility.is_active, false);
  assert.equal((await publicFetch(facilityImage)).status, 404);
  const anonymousFacilities = async () => (await publicFetch("/api/public/facilities")).json();
  assert.ok(!(await anonymousFacilities()).items.some(({ id }) => id === savedFacility.id));
  await request(facilitiesSave, 200, { action: "item", id: savedFacility.id, item: { ...facility, is_active: true } });
  assert.equal((await publicFetch(facilityImage)).headers.get("content-type"), "image/png");
  const publishedFacilities = await anonymousFacilities();
  assert.deepEqual(publishedFacilities.content, facilityContent);
  assert.equal(publishedFacilities.items.find(({ id }) => id === savedFacility.id).image, facilityImage);
  assert.ok((await (await publicFetch("/api/public/home")).json()).zones.some(({ id }) => id === savedFacility.id));
  const trainerImage = (await request(facilityUpload, 201, catalogPhoto())).url;
  const trainer = { name: randomUUID(), role: "Coach", bio: "Short biography", long_bio: "Extended profile",
    coaching_style: "Technique first", availability: "Monday", image: trainerImage, intro_video_url: "https://example.test/video",
    intro_video_thumb: "", specialties: ["Strength"], certifications: ["Fixture certificate"], achievements: [], session_focus: ["Squat"],
    years_experience: 4, clients_coached: 12, offers_personal_training: true, sort_order: -50, is_active: false };
  await request(trainersSave, 422, { action: "item", entity: "trainer", item: { ...trainer, intro_video_url: "javascript:alert(1)" } });
  await request(trainersSave, 200, { action: "item", entity: "trainer", item: trainer });
  const trainerId = (await request("studio/trainers", 200)).trainers.find(({ name }) => name === trainer.name).id;
  assert.equal((await publicFetch(trainerImage)).status, 404);
  const anonymousTrainers = async () => (await publicFetch("/api/public/trainers")).json();
  assert.ok(!(await anonymousTrainers()).trainers.some(({ id }) => id === trainerId));
  await request(trainersSave, 200, { action: "item", entity: "trainer", id: trainerId, item: { ...trainer, is_active: true } });
  assert.equal((await publicFetch(trainerImage)).headers.get("content-type"), "image/png");
  assert.deepEqual((await anonymousTrainers()).trainers.find(({ id }) => id === trainerId), { id: trainerId, ...trainer, is_active: true });
  assert.ok((await (await publicFetch("/api/public/home")).json()).trainers.some(({ id }) => id === trainerId));
  await request(trainersSave, 200, { action: "delete", entity: "trainer", id: trainerId });
  assert.equal((await publicFetch(trainerImage)).status, 404);
  const testimonialSave = "studio/testimonials/save";
  const testimonialImage = (await request(facilityUpload, 201, catalogPhoto())).url;
  const testimonial = { name: randomUUID(), goal: "Strength", quote: "Fixture story", image: testimonialImage, sort_order: -99, is_active: false };
  await request(testimonialSave, 403, { action: "item", item: testimonial }, false);
  await request(testimonialSave, 422, { action: "item", item: { ...testimonial, quote: "" } });
  await request(testimonialSave, 200, { action: "item", item: testimonial });
  const testimonialId = (await request("studio/testimonials", 200)).items.find(({ name }) => name === testimonial.name).id;
  const anonymousHome = async () => (await publicFetch("/api/public/home")).json();
  assert.ok(!(await anonymousHome()).testimonials.some(({ id }) => id === testimonialId));
  assert.equal((await publicFetch(testimonialImage)).status, 404);
  await request(testimonialSave, 200, { action: "item", id: testimonialId, item: { ...testimonial, is_active: true } });
  assert.equal((await publicFetch(testimonialImage)).headers.get("content-type"), "image/png");
  assert.deepEqual((await anonymousHome()).testimonials.find(({ id }) => id === testimonialId), { id: testimonialId, ...testimonial, is_active: true });
  await request(testimonialSave, 200, { action: "delete", id: testimonialId });
  assert.equal((await publicFetch(testimonialImage)).status, 404);
  await request(catalogUpload, 403, catalogPhoto(), false);
  const invalidPhoto = new FormData();
  invalidPhoto.set("photo", new Blob(["<?php echo 1; ?>"], { type: "image/png" }), "fake.png");
  await request(catalogUpload, 422, invalidPhoto);
  const firstMedia = (await request(catalogUpload, 201, catalogPhoto())).url;
  assert.match(firstMedia, /[a-f0-9]{48}\.png$/);
  assert.equal((await publicFetch(firstMedia)).status, 404);
  assert.equal((await publicFetch("/api/media/product?key=..%2Findex.php")).status, 404);
  await request("inventory/catalog/save", 200, { entity: "product", id: product.id, fields: { image: firstMedia } });
  const visibleImage = await publicFetch(firstMedia);
  assert.equal(visibleImage.status, 200);
  assert.equal(visibleImage.headers.get("content-type"), "image/png");
  assert.equal(visibleImage.headers.get("x-content-type-options"), "nosniff");
  const replacement = (await request(catalogUpload, 201, catalogPhoto())).url;
  await request("inventory/catalog/save", 200, { entity: "variant", id: variant.id, fields: { image: replacement } });
  await request("inventory/catalog/save", 200, { entity: "product", id: product.id, fields: { image: "" } });
  assert.equal((await publicFetch(firstMedia)).status, 404);
  assert.equal((await publicFetch(replacement)).status, 200);
  const keyOf = (url) => new URL(url, "https://fixture.example.test").searchParams.get("key");
  for (const url of [firstMedia, replacement, facilityImage]) php("backend/tests/billing-worker.php", ["media-age"], JSON.stringify(keyOf(url)));
  const mediaEnv = { ...process.env, GYM_PRODUCT_MEDIA_DIR: catalogMediaDirectory };
  php("backend/bin/product-media.php", ["cleanup"], undefined, mediaEnv);
  assert.equal(existsSync(join(catalogMediaDirectory, keyOf(firstMedia))), false);
  assert.equal(existsSync(join(catalogMediaDirectory, keyOf(replacement))), true);
  assert.equal(existsSync(join(catalogMediaDirectory, keyOf(facilityImage))), true);
  await request(facilitiesSave, 200, { action: "delete", id: savedFacility.id });
  assert.equal((await publicFetch(facilityImage)).status, 404);
  php("backend/bin/product-media.php", ["cleanup"], undefined, mediaEnv);
  assert.equal(existsSync(join(catalogMediaDirectory, keyOf(facilityImage))), false);
  const legacyUrl = "https://fixtures.example.test/shop/legacy.png";
  await request("inventory/catalog/save", 200, { entity: "product", id: product.id, fields: { image: legacyUrl } });
  const legacyFile = join(mediaDirectory, "migration-fixture.png");
  writeFileSync(legacyFile, catalogBytes);
  const migratedPhoto = php("backend/bin/product-media.php", ["import", "product", String(product.id), legacyUrl, legacyFile], undefined, mediaEnv).trim();
  assert.equal((await publicFetch(migratedPhoto)).status, 200);
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
  const grid = "attendance/grid?start=2024-02-28&end=2024-03-02&search=Test%20member&limit=50";
  assert.ok((await request(grid, 200)).holidays.some(({ holiday_date }) => holiday_date === "2024-03-01"));
  for (const action of ["mark", "mark", "remove", "remove", "restore", "restore"]) {
    await request(attendance, 200, { ...mark, action, date: "2024-02-29" });
    const next = await request(grid, 200);
    const active = next.records.filter((row) => row.member_ref === memberId && row.attendance_date === "2024-02-29");
    const deleted = next.deletedRecords.filter((row) => row.member_ref === memberId && row.attendance_date === "2024-02-29");
    assert.equal(active.length, action === "remove" ? 0 : 1);
    assert.equal(deleted.length, action === "remove" ? 1 : 0);
  }
  for (const range of ["start=2023-02-29&end=2024-03-01", "start=2024-03-02&end=2024-03-01", "start=2024-01-01&end=2024-04-01"]) {
    await request(`attendance/grid?${range}`, 422);
  }
  await request(`${grid}&offset=-1`, 422);
  await request(`${grid}&enabled=invalid`, 422);
  const yearGrid = "attendance/grid?start=2024-12-31&end=2025-01-01&search=Test%20member&limit=50";
  for (const date of ["2024-12-31", "2025-01-01"]) await request(attendance, 200, { ...mark, date });
  assert.deepEqual((await request(yearGrid, 200)).records.filter((row) => row.member_ref === memberId)
    .map((row) => row.attendance_date), ["2025-01-01", "2024-12-31"]);
  const holidayBody = { action: "save", name: "Test closure", date: "2025-01-01" };
  await request("attendance/holiday", 403, holidayBody, false);
  await request("attendance/holiday", 200, holidayBody);
  assert.equal((await request(yearGrid, 200)).holidays[0].name, "Test closure");
  await request(attendance, 409, { ...mark, date: holidayBody.date });
  await request("attendance/holiday", 200, { ...holidayBody, action: "remove" });
  await request("members/change", 200, { action: "deactivate", ids: [memberId] });
  assert.ok(!(await request(yearGrid, 200)).members.some(({ id }) => id === memberId));
  assert.ok((await request(yearGrid + "&enabled=inactive", 200)).records.some((row) => row.member_ref === memberId));
  await request(attendance, 409, { ...mark, date: "2025-01-02" });
  const staged = JSON.parse(php("backend/tests/billing-worker.php", ["fixture"], JSON.stringify([["2025-01-10", 1000], ["2025-02-10", 1000]])));
  const recoveryKey = randomUUID();
  const recoveryChange = "billing/attempt/change";
  const prepareRecovery = { action: "prepare", key: recoveryKey, path: "/membership/payments",
    payload: { ...staged, paymentMethod: "cash", amountMinor: 1500 } };
  await request(recoveryChange, 403, prepareRecovery, false);
  assert.equal((await request(recoveryChange, 200, prepareRecovery)).attempt.status, "pending");
  await request(recoveryChange, 409, { ...prepareRecovery, payload: { ...prepareRecovery.payload, amountMinor: 20 } });
  await request("membership/payments", 409, prepareRecovery.payload, true, { "Idempotency-Key": recoveryKey });
  // Consume the response as the transport would, but discard its invoice data.
  await request(recoveryChange, 201, { action: "execute", key: recoveryKey });
  await request("logout", 200, {});
  await request("billing/attempt", 401);
  const otherAdmin = `${randomUUID()}@example.test`;
  php("backend/bin/account.php", ["create", randomUUID(), otherAdmin, "admin"], password);
  await request("session", 200);
  await request("login", 200, { email: otherAdmin, password });
  assert.equal((await request("billing/attempt", 200)).attempt, null);
  await request(recoveryChange, 404, { action: "execute", key: recoveryKey });
  await request("logout", 200, {});
  await request("login", 200, { email: admin, password });
  const recovered = (await request("billing/attempt", 200)).attempt;
  assert.equal(recovered.status, "committed");
  const replayed = await request(recoveryChange, 200, { action: "execute", key: recoveryKey });
  assert.equal(replayed.invoice_id, recovered.result.invoice_id);
  const reconciled = JSON.parse(php("backend/tests/billing-worker.php", ["state"], JSON.stringify(staged.memberId)));
  assert.equal(reconciled.invoices, 1);
  assert.equal(reconciled.payments, 1);
  assert.equal(reconciled.allocations, 2);
  assert.equal(reconciled.allocated, 1500);
  const feeReport = await request(reportPath, 200);
  assert.ok(feeReport.items.some((item) => item.invoice_id === replayed.invoice_id && item.item_type === "membership"));
  assert.deepEqual(feeReport.payments.filter((payment) => payment.invoice_id === replayed.invoice_id).map(({ amount_minor }) => amount_minor), [1500]);
  assert.ok(!feeReport.invoices.some(({ id }) => id === sale.invoice_id));
  await request("membership/cancel-invoice", 200, { invoiceId: replayed.invoice_id, reason: "Test reversal" });
  assert.ok(!(await request(reportPath, 200)).payments.some((payment) => payment.invoice_id === replayed.invoice_id));
  assert.equal((await request("billing/attempt", 200)).attempt.result.invoice_status, "cancelled");
  await request(recoveryChange, 409, { action: "discard", key: recoveryKey });
  await request(recoveryChange, 200, { action: "dismiss", key: recoveryKey });
  assert.equal((await request("billing/attempt", 200)).attempt, null);
  await request(recoveryChange, 409, prepareRecovery);
  const settingsSave = "admin/settings/save";
  const currentSettings = await request("admin/settings", 200);
  assert.equal(currentSettings.smtpConfigured, true);
  assert.deepEqual(Object.keys(currentSettings).sort(), ["settings", "smtpConfigured"]);
  const historicalReceiptPath = `invoices/receipt?id=${replayed.invoice_id}`;
  const historicalInvoice = (await request(historicalReceiptPath, 200)).invoice;
  const currentNumber = Number(historicalInvoice.invoice_number);
  const floor = currentNumber + 5;
  const revisedSettings = { ...currentSettings.settings, gym_name: "Fixture Gym Settings",
    invoice_start_number: floor, tax_enabled: true, tax_label: "Fixture Tax", tax_rate_basis_points: 1000,
    weekly_closing_day: (currentSettings.settings.weekly_closing_day + 1) % 7 };
  await request(settingsSave, 403, revisedSettings, false);
  await request(settingsSave, 422, { ...revisedSettings, weekly_closing_day: 7 });
  await request(settingsSave, 422, { ...revisedSettings, tax_rate_basis_points: 10001 });
  await request(settingsSave, 409, { ...revisedSettings, invoice_start_number: currentNumber });
  const savedSettings = (await request(settingsSave, 200, revisedSettings)).settings;
  assert.equal(savedSettings.gym_name, revisedSettings.gym_name);
  assert.equal(savedSettings.weekly_closing_day, revisedSettings.weekly_closing_day);
  assert.equal((await request("admin/settings", 200)).settings.invoice_start_number, floor);
  const settingsBill = await request("invoices/services/issue", 201, {
    customerName: "Fixture settings buyer", service: { kind: "miscellaneous", description: "Fixture charge", unitPriceMinor: 5000 },
  }, true, paymentKey());
  const settingsReceipt = await request(`invoices/receipt?id=${settingsBill.invoice_id}`, 200);
  assert.equal(Number(settingsReceipt.invoice.invoice_number), floor);
  assert.equal(settingsReceipt.invoice.tax_minor, 500);
  assert.equal(settingsReceipt.invoice.tax_label, "Fixture Tax");
  assert.deepEqual((await request(historicalReceiptPath, 200)).invoice, historicalInvoice);
  await request(settingsSave, 200, { ...currentSettings.settings, invoice_start_number: floor });
  php("backend/bin/account.php", ["reset", id], randomBytes(24).toString("hex"));
  await request("admin", 401);
  await request("session", 200);
  await request("login", 401, { email: admin, password });
  assert.equal((await request("login", 200, { email: viewer, password, role: "admin" })).user.role, "viewer");
  await request("admin", 403);
  await request(dashboardPath, 403);
  await request(reportPath, 403);
  await request("studio/contact", 403);
  await request(contactSave, 403, { action: "content", content: contact });
  await request(footerSave, 403, { content: footer });
  await request("studio/home", 403);
  await request(homeSave, 403, { action: "content", content: home });
  await request("billing/attempt", 403);
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
  await request(catalogUpload, 403, catalogPhoto());
  await request(facilityUpload, 403, catalogPhoto());
  await request(facilitiesSave, 403, { action: "content", content: facilityContent });
  await request("studio/trainers", 403);
  await request(trainersSave, 403, { action: "item", entity: "plan", item: plan });
  await request("studio/pricing", 403);
  await request(pricingSave, 403, { action: "delete", id: planId });
  await request("studio/testimonials", 403);
  await request(testimonialSave, 403, { action: "delete", id: testimonialId });
  await request("studio/proshop", 403);
  await request(shopSave, 403, { action: "delete", id: product.id });
  await request("admin/settings", 403);
  await request(settingsSave, 403, revisedSettings);
  await request(history, 403);
  await request(grid, 403);
  await request(invoiceList, 403);
  await request(sendMail, 403, mail);
  await request("invoices/payments", 403, balanceBody, true, paymentKey());
  await request("invoices/services/issue", 403, trainingBill, true, paymentKey());
  await request(inventoryPage, 403);
  await request("inventory/catalog/activation", 403, { ids: [stocked.id], active: false });
  await request("attendance/holiday", 403, holidayBody);
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
