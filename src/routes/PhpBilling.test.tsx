import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminBilling from "../pages/admin/AdminBilling";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy data access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function withAttempts(next: (url: string, options?: RequestInit) => Promise<Response>, recovered?: () => object | null) {
  let snapshot: { key: string; path: string; payload: object } | null = null;
  return async (url: string, options?: RequestInit) => {
    if (url === "/api/billing/attempt") return json({ attempt: recovered?.() ?? null });
    if (url !== "/api/billing/attempt/change") return next(url, options);
    const headers = new Headers(options?.headers);
    expect(headers.get("X-CSRF-Token")).toBe("csrf");
    const request = JSON.parse(String(options?.body));
    if (request.action === "prepare") {
      if (snapshot) expect(request).toEqual(snapshot);
      snapshot = request;
      return json({});
    }
    expect(request.key).toBe(snapshot?.key);
    if (request.action === "execute" && snapshot) {
      headers.set("Idempotency-Key", snapshot.key);
      return next(`/api${snapshot.path}`, { headers, body: JSON.stringify(snapshot.payload) });
    }
    snapshot = null;
    return json({});
  };
}

it("retains the payment snapshot after a lost response and loads the original receipt", async () => {
  const requests: { key: string | null; body: string }[] = [];
  let committed = false;
  const invoice = {
    id: 41, invoice_number: "901", member_ref: 3, customer_name: "Test Member", invoice_status: "issued",
    payment_status: "paid", billing_date: "2026-10-01", subtotal_minor: 12500, discount_minor: 0,
    tax_minor: 0, total_minor: 12500, paid_minor: 12500, balance_minor: 0, currency_code: "NPR", php_membership: true,
  };
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/admin/settings") return json({ settings: {} });
    if (url === "/api/invoices/training-plans") return json({ plans: [] });
    if (url.startsWith("/api/invoices?")) return json({
      invoices: committed ? [invoice] : [], count: Number(committed),
      summary: { revenue_today: 0, revenue_month: 0, invoices_today: 0, outstanding: 0, unpaid: 0, partially_paid: 0 },
    });
    if (url.startsWith("/api/members?")) return json({ members: [{
      id: 3, full_name: "Test Member", member_id: "T-03", phone: "9800000000", membership_type: "Monthly", is_active: true,
    }] });
    if (url === "/api/members/fees?id=3") return json({ outstanding_fees: [
      { id: 11, due_date: "2026-09-01", amount_minor: 10000, paid_amount_minor: 0, currency_code: "NPR", status: "unpaid" },
      { id: 12, due_date: "2026-10-01", amount_minor: 10000, paid_amount_minor: 0, currency_code: "NPR", status: "unpaid" },
    ], summary: { total_due: committed ? 7500 : 20000 } });
    if (url === "/api/auth/session") return json({ csrfToken: "csrf" });
    if (url === "/api/membership/payments") {
      const headers = new Headers(options?.headers);
      expect(headers.get("X-CSRF-Token")).toBe("csrf");
      requests.push({ key: headers.get("Idempotency-Key"), body: String(options?.body) });
      if (!committed) {
        committed = true;
        throw new TypeError("Simulated lost response after commit");
      }
      return json({ invoice_id: 41, invoice_number: "901" });
    }
    if (url === "/api/invoices/receipt?id=41") return json({
      invoice, items: [{ id: 51, description: "Membership fee allocation", item_type: "membership", quantity: 1, unit_price_minor: 12500, line_total_minor: 12500 }],
      payments: [{ id: 61, payment_date: "2026-10-01", payment_method: "cash", amount_minor: 12500 }],
    });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", withAttempts(fetchMock, () => committed ? {
    key: requests[0].key, path: "/membership/payments", status: "committed",
    result: { invoice_id: 41, invoice_number: "901" },
  } : null));
  const mounted = render(<MemoryRouter><AdminBilling /></MemoryRouter>);
  const newBill = await screen.findByRole("button", { name: "New Bill" });
  await waitFor(() => expect(newBill).toBeEnabled());
  fireEvent.click(newBill);
  fireEvent.change(screen.getByPlaceholderText("Start typing a name"), { target: { value: "Test" } });
  fireEvent.click(await screen.findByRole("button", { name: /Test Member/ }));
  const dialog = screen.getByRole("dialog", { name: "New Bill" });
  const periods = await within(dialog).findAllByRole("checkbox");
  fireEvent.click(periods[1]);
  fireEvent.change(within(dialog).getByLabelText("Fee amount before tax"), { target: { value: "125.00" } });
  const submit = within(dialog).getByRole("button", { name: "Create Bill" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(await within(dialog).findByRole("button", { name: "Retry payment" })).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].key).toMatch(/^[a-f\d-]{36}$/);
  expect(JSON.parse(requests[0].body)).toMatchObject({ memberId: 3, feeIds: [11, 12], amountMinor: 12500 });
  mounted.unmount();
  render(<MemoryRouter><AdminBilling /></MemoryRouter>);
  expect(await screen.findByText("Recovered payment")).toBeInTheDocument();
  expect(await screen.findByText("Membership fee allocation")).toBeInTheDocument();
  expect(await screen.findByText(/Outstanding membership fees:/)).toBeInTheDocument();
  expect(requests).toHaveLength(1);
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/invoices?")).length).toBeGreaterThan(1));
});

it("issues a product invoice and asks for confirmation before recording a reversal", async () => {
  let issued = false;
  let cancelled = false;
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    const invoice = {
      id: 42, invoice_number: "902", customer_name: "Walk-in Customer", invoice_status: cancelled ? "cancelled" : "issued",
      payment_status: cancelled ? "unpaid" : "paid", billing_date: "2026-10-01", subtotal_minor: 9900,
      discount_minor: 0, tax_minor: 0, total_minor: 9900, paid_minor: cancelled ? 0 : 9900,
      balance_minor: cancelled ? 9900 : 0, currency_code: "NPR", php_product: true,
      cancellation_reason: cancelled ? "Returned by buyer" : null,
    };
    if (url === "/api/admin/settings") return json({ settings: {} });
    if (url === "/api/invoices/training-plans") return json({ plans: [] });
    if (url.startsWith("/api/invoices?")) return json({ invoices: issued ? [invoice] : [], count: Number(issued), summary: {} });
    if (url.startsWith("/api/inventory/catalog?")) return json({ products: [{
      id: 1, title: "Training bottle", selling_price_minor: 9900, wholesale_price_minor: 8000, cost_price_minor: 4000,
      variants: [{ id: 2, product_id: 1, name: "Default", is_active: true, current_quantity: "5.000" }],
    }] });
    if (url === "/api/auth/session") return json({ csrfToken: "csrf" });
    if (url === "/api/invoices/products/issue") {
      expect(new Headers(options?.headers).get("Idempotency-Key")).toBeTruthy();
      expect(JSON.parse(String(options?.body))).toMatchObject({
        customerName: "Walk-in Customer", paymentMinor: 9900, expectedTotalMinor: 9900,
        lines: [{ variantId: 2, quantity: "1", expectedUnitPriceMinor: 9900 }],
      });
      issued = true;
      return json({ invoice_id: 42, invoice_number: "902" });
    }
    if (url === "/api/invoices/products/cancel") {
      expect(JSON.parse(String(options?.body))).toEqual({ invoiceId: 42, reason: "Returned by buyer" });
      cancelled = true;
      return json({ invoice_id: 42, invoice_status: "cancelled" });
    }
    if (url === "/api/invoices/receipt?id=42") return json({
      invoice, items: [{ id: 52, description: "Training bottle", item_type: "product", quantity: 1,
        customer_type: "general", unit_price_minor: 9900, line_total_minor: 9900 }],
      payments: cancelled ? [{ id: 62, payment_date: "2026-10-01", payment_method: "cash", amount_minor: 9900, is_reversal: true }] : [],
    });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", withAttempts(fetchMock));
  render(<MemoryRouter initialEntries={["/admin/billing?mode=shop"]}><AdminBilling /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Training bottle/ }));
  fireEvent.click(screen.getByRole("button", { name: "Create Bill" }));
  const cancel = await screen.findByRole("button", { name: "Cancel Bill" });
  fireEvent.click(cancel);
  expect(cancelled).toBe(false);
  fireEvent.change(screen.getByPlaceholderText("Example: Customer returned the products"), { target: { value: "Returned by buyer" } });
  const dialog = screen.getByRole("dialog", { name: /Cancel bill 902/ });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Bill" }));
  expect(await screen.findByText(/Reversal.*cash/)).toBeInTheDocument();
});

it("sends a miscellaneous charge through the shared PHP checkout", async () => {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/admin/settings") return json({ settings: {} });
    if (url === "/api/invoices/training-plans") return json({ plans: [{ id: 2, title: "Training", price: "NPR 1500" }] });
    if (url.startsWith("/api/invoices?")) return json({ invoices: [], count: 0, summary: {} });
    if (url === "/api/auth/session") return json({ csrfToken: "csrf" });
    if (url === "/api/invoices/services/issue") {
      expect(new Headers(options?.headers).get("Idempotency-Key")).toBeTruthy();
      expect(JSON.parse(String(options?.body))).toMatchObject({
        customerName: "Walk-in Customer", paymentMinor: 700, expectedTotalMinor: 700,
        service: { kind: "miscellaneous", description: "Replacement card", unitPriceMinor: 700 },
      });
      return json({ invoice_id: 43, invoice_number: "903" });
    }
    if (url === "/api/invoices/receipt?id=43") return json({
      invoice: { id: 43, invoice_number: "903", customer_name: "Walk-in Customer", invoice_status: "issued",
        payment_status: "paid", billing_date: "2026-10-01", subtotal_minor: 700, discount_minor: 0,
        tax_minor: 0, total_minor: 700, paid_minor: 700, balance_minor: 0, currency_code: "NPR" },
      items: [{ id: 53, description: "Replacement card", item_type: "miscellaneous", quantity: 1,
        unit_price_minor: 700, line_total_minor: 700 }],
      payments: [],
    });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", withAttempts(fetchMock));
  render(<MemoryRouter><AdminBilling /></MemoryRouter>);
  const newBill = await screen.findByRole("button", { name: "New Bill" });
  await waitFor(() => expect(newBill).toBeEnabled());
  fireEvent.click(newBill);
  const dialog = screen.getByRole("dialog", { name: "New Bill" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Walk-in Customer" }));
  const chargeTypes = within(dialog).getByText("What are they paying for?").closest("section")!;
  fireEvent.click(within(chargeTypes).getByRole("button", { name: "Other" }));
  fireEvent.change(within(dialog).getByLabelText("What is this charge for?"), { target: { value: "Replacement card" } });
  fireEvent.change(within(dialog).getByLabelText("Amount (NPR)"), { target: { value: "7" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Bill" }));
  expect(await screen.findByText("Replacement card")).toBeInTheDocument();
});
