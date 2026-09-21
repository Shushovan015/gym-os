type Invoice = {
  invoice_number: string; customer_name: string; billing_date: string; due_date: string | null;
  currency_code: string; subtotal_minor: number; discount_minor: number; tax_minor: number;
  tax_label: string; total_minor: number; paid_minor: number; balance_minor: number;
  invoice_status: string; payment_status: string; notes: string | null;
};
type Item = { description: string; quantity: number; unit_price_minor: number; line_total_minor: number; membership_period_start: string | null; membership_period_end: string | null };
type Gym = { gym_name: string; address: string; phone: string; email: string; pan_vat_number: string | null; receipt_footer: string; currency_minor_unit: number };

export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export const validEmail = (value: unknown): value is string => typeof value === "string" && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

// No external resources, scripts, public invoice URLs, or unescaped member data.
// The same document is printable from the email or the attached HTML file.
export function renderBill(invoice: Invoice, items: Item[], gym: Gym, memberName: string) {
  const e = escapeHtml;
  const money = (minor: number) => e(`${invoice.currency_code} ${(minor / 10 ** gym.currency_minor_unit).toFixed(gym.currency_minor_unit)}`);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Invoice ${e(invoice.invoice_number)}</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:800px;margin:24px auto;padding:16px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}h1{font-size:24px}.totals{margin:20px 0 20px auto;max-width:340px}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body>
    <h1>${e(gym.gym_name)}</h1><p>${e(gym.address)}<br>${e(gym.phone)} · ${e(gym.email)}${gym.pan_vat_number ? `<br>PAN/VAT: ${e(gym.pan_vat_number)}` : ""}</p>
    <h2>Invoice ${e(invoice.invoice_number)}</h2><p>Member: <strong>${e(memberName)}</strong><br>Billed to: ${e(invoice.customer_name)}<br>Billing date (AD): ${e(invoice.billing_date)}<br>Due date (AD): ${e(invoice.due_date ?? "Not specified")}<br>Invoice status: ${e(invoice.invoice_status)}<br>Payment status: ${e(invoice.payment_status.replaceAll("_", " "))}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${items.map((item) => `<tr><td>${e(item.description)}${item.membership_period_start ? `<br>${e(item.membership_period_start)} to ${e(item.membership_period_end)}` : ""}</td><td>${e(item.quantity)}</td><td>${money(item.unit_price_minor)}</td><td>${money(item.line_total_minor)}</td></tr>`).join("")}</tbody></table>
    <table class="totals"><tbody>${[["Subtotal", invoice.subtotal_minor], ["Discount", -invoice.discount_minor], [invoice.tax_label || "Tax", invoice.tax_minor], ["Total", invoice.total_minor], ["Paid", invoice.paid_minor], ["Balance", invoice.balance_minor]].map(([label, amount]) => `<tr><th>${e(label)}</th><td>${money(Number(amount))}</td></tr>`).join("")}</tbody></table>
    ${invoice.notes ? `<p>Notes: ${e(invoice.notes)}</p>` : ""}<p>${e(gym.receipt_footer)}</p><p>You can print this email or open the attached invoice and use your browser's Print command.</p></body></html>`;
}

export function encodeAttachment(html: string) {
  const bytes = new TextEncoder().encode(html);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
