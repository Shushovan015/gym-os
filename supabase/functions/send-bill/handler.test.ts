import { describe, expect, it, vi } from "vitest";
import { createSendBillHandler } from "./handler";

function fixture(options: { signedIn?: boolean; role?: string; email?: string; existing?: string; state?: string } = {}) {
  const rows: Record<string, unknown> = {
    profiles: { role: options.role ?? "admin" },
    invoice_email_deliveries: options.existing ? { status: options.existing } : null,
    invoices: { id: 1, invoice_number: "GYM-2026-000500", member_ref: 2, invoice_status: "issued", payment_status: "paid", customer_name: "Member", billing_date: "2026-09-21", currency_code: "NPR", total_minor: 100, subtotal_minor: 100, discount_minor: 0, paid_minor: 100, balance_minor: 0, tax_minor: 0 },
    members: { email: options.email ?? "member@example.com", full_name: "Member" },
    admin_settings: { bill_sender_email: "billing@gym.example", gym_name: "Gym", currency_minor_unit: 2 },
    invoice_items: [{ description: "Membership", quantity: 1, unit_price_minor: 100, line_total_minor: 100 }],
  };
  const frozenPayload = { to: ["member@example.com"], from: "billing@gym.example", html: "Frozen original bill" };
  const rpc = vi.fn(async (name: string) => ({ error: null, data: name === "claim_bill_email" ? { state: options.state ?? "claimed", delivery: { payload: frozenPayload, delivery_key: "stable-key", lease_token: "lease", recipient_email: "member@example.com" } } : null }));
  const from = vi.fn((table: string) => {
    const result = { data: rows[table], error: null };
    const chain = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, single: async () => result, maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  });
  const db = { auth: { getUser: async () => ({ data: { user: options.signedIn === false ? null : { id: "admin" } }, error: null }) }, from, rpc } as unknown as Parameters<typeof createSendBillHandler>[0];
  const send = vi.fn(async () => new Response(JSON.stringify({ id: "resend-id" }), { status: 200 }));
  const handler = createSendBillHandler(db, "server-only-key", send);
  const request = () => new Request("http://localhost/send-bill", { method: "POST", headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: 1, expected_email: "member@example.com" }) });
  return { handler, request, send, rpc, from, frozenPayload };
}
describe("send-bill authorization and delivery", () => {
  it("rejects unauthenticated and non-admin callers before sending or claiming", async () => {
    for (const options of [{ signedIn: false }, { role: "member" }]) {
      const f = fixture(options); const response = await f.handler(f.request());
      expect([401, 403]).toContain(response.status); expect(f.send).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
    }
  });
  it("requires the member's saved email to match the confirmation", async () => {
    const f = fixture({ email: "changed@example.com" });
    expect((await f.handler(f.request())).status).toBe(409);
    expect(f.send).not.toHaveBeenCalled();
  });
  it("does not resend a sent bill or a busy/expired send", async () => {
    for (const options of [{ existing: "sent" }, { state: "sent" }, { state: "busy" }, { state: "review_required" }]) {
      const f = fixture(options); await f.handler(f.request()); expect(f.send).not.toHaveBeenCalled();
    }
  });
  it("sends only the database-claimed payload using the stable idempotency key", async () => {
    const f = fixture(); const response = await f.handler(f.request());
    expect(response.status).toBe(200);
    const call = f.send.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual(f.frozenPayload);
    expect(call[1].headers).toMatchObject({ "Idempotency-Key": "gym-bill/stable-key" });
    expect(f.rpc).toHaveBeenLastCalledWith("finish_bill_email", expect.objectContaining({ p_status: "sent", p_provider_id: "resend-id" }));
  });
  it("persists an uncertain outcome after a network timeout", async () => {
    const f = fixture(); f.send.mockRejectedValueOnce(new Error("Timeout"));
    expect((await f.handler(f.request())).status).toBe(502);
    expect(f.rpc).toHaveBeenLastCalledWith("finish_bill_email", expect.objectContaining({ p_status: "uncertain" }));
  });
  it("allows a corrected retry after a definite provider rejection", async () => {
    const f = fixture(); f.send.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Unverified domain" }), { status: 403 }));
    expect((await f.handler(f.request())).status).toBe(502);
    expect(f.rpc).toHaveBeenLastCalledWith("finish_bill_email", expect.objectContaining({ p_status: "failed" }));
  });
});
