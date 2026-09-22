import { describe, expect, it, vi } from "vitest";
import { createBillHandler } from "./handler";
import { classifySmtpError } from "./gmail";
import { renderBill, validEmail, type Bill, type Gym } from "./template";

const bill: Bill = {
  id: 7, invoice_number: "GYM-0042", member_ref: 3, customer_name: "Member",
  billing_date: "2026-09-22", due_date: "2026-09-30", currency_code: "NPR",
  subtotal_minor: 10000, discount_minor: 0, tax_minor: 0, tax_label: "Tax",
  total_minor: 10000, paid_minor: 5000, balance_minor: 5000,
  invoice_status: "issued", payment_status: "partially_paid", notes: "Thank you",
};
const gym: Gym = { gym_name: "Our Gym", address: "Gym address", phone: "123", email: "gym@gmail.com", pan_vat_number: "1234", receipt_footer: "Welcome back", currency_minor_unit: 2, bill_sender_email: "gym@gmail.com" };
const items = [{ description: "Membership", quantity: 1, unit_price_minor: 10000, line_total_minor: 10000, membership_period_start: "2026-09-22", membership_period_end: "2026-10-22" }];

function setup(options: { role?: string; delivery?: string; claim?: string; smtpError?: unknown; finishError?: boolean; sender?: string; memberEmail?: string; accepted?: string[] } = {}) {
  const values: Record<string, unknown> = {
    profiles: { role: options.role ?? "admin" },
    invoice_email_deliveries: options.delivery ? { status: options.delivery } : null,
    invoices: bill, admin_settings: { ...gym, bill_sender_email: options.sender ?? gym.bill_sender_email },
    invoice_items: items, members: { full_name: "Saved Member", email: options.memberEmail ?? "member@example.com" },
  };
  const from = vi.fn((table: string) => {
    const result = { data: values[table], error: null };
    const query = { select: () => query, eq: () => query, is: () => query, order: () => query, single: async () => result, maybeSingle: async () => result, then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return query;
  });
  const rpc = vi.fn(async (name: string) => name === "claim_gmail_bill"
    ? { data: { state: options.claim ?? "claimed", attempt_id: "attempt-1" }, error: null }
    : { data: !options.finishError, error: options.finishError ? new Error("Database unavailable") : null });
  const sendMail = vi.fn(async () => {
    if (options.smtpError) throw options.smtpError;
    return { accepted: options.accepted ?? ["member@example.com"], messageId: "message-1" };
  });
  const db = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } }, error: null })) }, from, rpc };
  const handler = createBillHandler(db as unknown as Parameters<typeof createBillHandler>[0], "gym@gmail.com", sendMail);
  const request = (body = { invoice_id: 7, expected_email: "member@example.com" }, authenticated = true) => handler(new Request("http://localhost/send-bill", { method: "POST", headers: authenticated ? { Authorization: "Bearer session" } : {}, body: JSON.stringify(body) }));
  return { request, sendMail, rpc, db };
}

describe("Gmail bill authorization and duplicate prevention", () => {
  it("rejects anonymous users before reading bills", async () => {
    const s = setup(); expect((await s.request(undefined, false)).status).toBe(401);
    expect(s.db.from).not.toHaveBeenCalled(); expect(s.sendMail).not.toHaveBeenCalled();
  });
  it("rejects non-admins", async () => {
    const s = setup({ role: "member" }); expect((await s.request()).status).toBe(403);
    expect(s.rpc).not.toHaveBeenCalled(); expect(s.sendMail).not.toHaveBeenCalled();
  });
  it.each(["sent", "uncertain"])("never sends an existing %s delivery", async (delivery) => {
    const s = setup({ delivery }); await s.request(); expect(s.sendMail).not.toHaveBeenCalled(); expect(s.rpc).not.toHaveBeenCalled();
  });
  it.each(["sending", "sent", "uncertain"])("respects an atomic claim returning %s", async (claim) => {
    const s = setup({ claim }); await s.request(); expect(s.sendMail).not.toHaveBeenCalled();
  });
  it("requires confirmation again when the saved recipient changes", async () => {
    const s = setup({ memberEmail: "changed@example.com" }); expect((await s.request()).status).toBe(409); expect(s.rpc).not.toHaveBeenCalled();
  });
  it("rejects a sender different from the authenticated Gmail account", async () => {
    const s = setup({ sender: "someone@example.com" }); expect((await s.request()).status).toBe(422); expect(s.sendMail).not.toHaveBeenCalled();
  });
  it("sends database content and a printable attachment, then records acceptance", async () => {
    const s = setup(); expect((await s.request()).status).toBe(200);
    expect(s.sendMail).toHaveBeenCalledOnce();
    expect(s.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "member@example.com", from: { name: "Our Gym", address: "gym@gmail.com" }, subject: "Invoice GYM-0042 - Our Gym", text: expect.stringContaining("Saved Member"), attachments: [expect.objectContaining({ filename: "invoice-GYM-0042.html", content: expect.stringContaining("NPR 100.00") })] }));
    expect(s.rpc).toHaveBeenLastCalledWith("finish_gmail_bill", expect.objectContaining({ p_status: "sent", p_attempt_id: "attempt-1" }));
  });
  it("records an explicit authentication rejection as safely retryable", async () => {
    const s = setup({ smtpError: { code: "EAUTH" } }); expect((await s.request()).status).toBe(502);
    expect(s.rpc).toHaveBeenLastCalledWith("finish_gmail_bill", expect.objectContaining({ p_status: "failed" }));
  });
  it("blocks automatic retry after a lost SMTP response", async () => {
    const s = setup({ smtpError: { code: "ETIMEDOUT", command: "DATA" } });
    expect(await (await s.request()).json()).toMatchObject({ status: "uncertain" });
    expect(s.rpc).toHaveBeenLastCalledWith("finish_gmail_bill", expect.objectContaining({ p_status: "uncertain" }));
  });
  it("does not report success if Gmail accepts but recording acceptance fails", async () => {
    const s = setup({ finishError: true }); expect(await (await s.request()).json()).toMatchObject({ status: "uncertain" }); expect(s.sendMail).toHaveBeenCalledOnce();
  });
  it("does not mark an unaccepted recipient sent", async () => {
    const s = setup({ accepted: [] }); expect((await s.request()).status).toBe(502);
    expect(s.rpc).toHaveBeenLastCalledWith("finish_gmail_bill", expect.objectContaining({ p_status: "failed" }));
  });
});

describe("printable bill and SMTP failures", () => {
  it("includes the manual number, customer type and saved price in emailed and printable bills", () => {
    const output = renderBill({ ...bill, invoice_number: "MANUAL/0042" }, [{ ...items[0], customer_type: "wholesale", unit_price_minor: 7500, line_total_minor: 7500 }], gym, "Wholesale member");
    for (const content of [output.html, output.text]) {
      expect(content).toContain("MANUAL/0042");
      expect(content).toContain("Wholesale Customer");
      expect(content).toContain("NPR 75.00");
    }
  });
  it.each(["first,second@example.com", "Name <member@example.com>", "member@example.com\r\nBcc: other@example.com", '"first,second"@example.com'])("rejects SMTP address-list and header syntax: %s", (value) => expect(validEmail(value)).toBe(false));
  it("escapes untrusted HTML and includes dates, totals, statuses and gym details", () => {
    const output = renderBill({ ...bill, notes: '<script>alert("x")</script>' }, items, gym, "<img src=x>");
    expect(output.html).not.toContain("<script>"); expect(output.html).not.toContain("<img src=x>");
    for (const value of ["GYM-0042", "2026-09-30", "NPR 100.00", "partially paid", "Gym address", "&lt;img", "2026-10-22"]) expect(output.html).toContain(value);
    expect(output.html).toContain("default-src 'none'");
  });
  it.each([{ command: "CONN" }, { code: "EDNS" }, { responseCode: 550 }])("allows retry after definite pre-send failure or rejection", (error) => expect(classifySmtpError(error).status).toBe("failed"));
  it("treats unknown exceptions conservatively", () => expect(classifySmtpError(new Error("unknown")).status).toBe("uncertain"));
});
