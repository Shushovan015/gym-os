export type Bill = {
  id: number; invoice_number: string; member_ref: number | null; customer_name: string;
  billing_date: string; due_date: string | null; currency_code: string;
  subtotal_minor: number; discount_minor: number; tax_minor: number; tax_label: string;
  total_minor: number; paid_minor: number; balance_minor: number;
  invoice_status: string; payment_status: string; notes: string | null;
};
export type BillItem = { customer_type?: "general" | "wholesale" | null; description: string; quantity: number; unit_price_minor: number; line_total_minor: number; membership_period_start: string | null; membership_period_end: string | null };
export type Gym = { gym_name: string; address: string; phone: string; email: string; pan_vat_number: string | null; receipt_footer: string; currency_minor_unit: number; bill_sender_email: string | null };
// Accept one bare mailbox only, never SMTP address lists or display-name syntax.
export const validEmail = (value: unknown): value is string => typeof value === "string" && value.length <= 254 && /^[^\s@<>,;:"\\()[\]]+@[^\s@<>,;:"\\()[\]]+\.[^\s@<>,;:"\\()[\]]+$/.test(value);
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderBill(bill: Bill, items: BillItem[], gym: Gym, memberName: string) {
  const e = escapeHtml;
  const customerType = (item: BillItem) => item.customer_type === "wholesale" ? "Wholesale Customer" : item.customer_type === "general" ? "General Member / Customer" : "";
  const precision = Number(gym.currency_minor_unit);
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) throw new Error("Invalid currency precision");
  const money = (minor: number) => `${bill.currency_code} ${(minor / 10 ** precision).toFixed(precision)}`;
  const summary = [
    gym.gym_name, gym.address, `${gym.phone} | ${gym.email}`, gym.pan_vat_number ? `PAN/VAT: ${gym.pan_vat_number}` : "",
    `Invoice: ${bill.invoice_number}`, `Member: ${memberName}`, `Billed to: ${bill.customer_name}`,
    `Billing date (AD): ${bill.billing_date}`, `Due date (AD): ${bill.due_date ?? "Not specified"}`,
    `Invoice status: ${bill.invoice_status}`, `Payment status: ${bill.payment_status.replaceAll("_", " ")}`,
  ];
  const totals: Array<[string, number]> = [["Subtotal", bill.subtotal_minor], ["Discount", -bill.discount_minor], [bill.tax_label || "Tax", bill.tax_minor], ["Total", bill.total_minor], ["Paid", bill.paid_minor], ["Balance", bill.balance_minor]];
  const text = [...summary, "", ...items.map((i) => `${i.description}${customerType(i) ? " | " + customerType(i) : ""} | ${i.quantity} x ${money(i.unit_price_minor)} | ${money(i.line_total_minor)}`), "", ...totals.map(([label, value]) => `${label}: ${money(value)}`), bill.notes ?? "", gym.receipt_footer].filter(Boolean).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Invoice ${e(bill.invoice_number)}</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:800px;margin:24px auto;padding:16px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.totals{margin:20px 0 20px auto;max-width:340px}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body>
    <h1>${e(gym.gym_name)}</h1><p>${e(gym.address)}<br>${e(gym.phone)} | ${e(gym.email)}${gym.pan_vat_number ? `<br>PAN/VAT: ${e(gym.pan_vat_number)}` : ""}</p>
    <h2>Invoice ${e(bill.invoice_number)}</h2><p>${summary.slice(5).map(e).join("<br>")}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${items.map((i) => `<tr><td>${e(i.description)}${customerType(i) ? "<br>" + e(customerType(i)) : ""}${i.membership_period_start ? `<br>${e(i.membership_period_start)} to ${e(i.membership_period_end)}` : ""}</td><td>${e(i.quantity)}</td><td>${e(money(i.unit_price_minor))}</td><td>${e(money(i.line_total_minor))}</td></tr>`).join("")}</tbody></table>
    <table class="totals"><tbody>${totals.map(([label, value]) => `<tr><th>${e(label)}</th><td>${e(money(value))}</td></tr>`).join("")}</tbody></table>
    ${bill.notes ? `<p>Notes: ${e(bill.notes)}</p>` : ""}<p>${e(gym.receipt_footer)}</p><p>Print this email, or open the attached invoice and choose Print / Save as PDF.</p></body></html>`;
  return { html, text };
}
