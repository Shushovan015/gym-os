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
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale-1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Invoice ${e(bill.invoice_number)}</title><style>body{font:14px Arial,sans-serif;color:#172033;max-width:800px;margin:24px auto;padding:16px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.totals{margin:20px 0 20px auto;max-width:340px}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body>
    <h1>${e(gym.gym_name)}</h1><p>${e(gym.address)}<br>${e(gym.phone)} | ${e(gym.email)}${gym.pan_vat_number ? `<br>PAN/VAT: ${e(gym.pan_vat_number)}` : ""}</p>
    <h2>Invoice ${e(bill.invoice_number)}</h2><p>${summary.slice(5).map(e).join("<br>")}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${items.map((i) => `<tr><td>${e(i.description)}${customerType(i) ? "<br>" + e(customerType(i)) : ""}${i.membership_period_start ? `<br>${e(i.membership_period_start)} to ${e(i.membership_period_end)}` : ""}</td><td>${e(i.quantity)}</td><td>${e(money(i.unit_price_minor))}</td><td>${e(money(i.line_total_minor))}</td></tr>`).join("")}</tbody></table>
    <table class="totals"><tbody>${totals.map(([label, value]) => `<tr><th>${e(label)}</th><td>${e(money(value))}</td></tr>`).join("")}</tbody></table>
    ${bill.notes ? `<p>Notes: ${e(bill.notes)}</p>` : ""}<p>${e(gym.receipt_footer)}</p><p>Print this email, or open the attached invoice and choose Print / Save as PDF.</p></body></html>`;
  return { html, text };
}

export async function generateBillPDF(bill: Bill, items: BillItem[], gym: Gym, memberName: string): Promise<Uint8Array> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Uint8Array[] = [];

  const customerType = (item: BillItem) => item.customer_type === "wholesale" ? "Wholesale Customer" : item.customer_type === "general" ? "General Member / Customer" : "";
  const precision = Number(gym.currency_minor_unit);
  const money = (minor: number) => `${bill.currency_code} ${(minor / 10 ** precision).toFixed(precision)}`;

  // Header
  doc.fontSize(24).font("Helvetica-Bold").text(gym.gym_name, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(gym.address, { align: "center" });
  doc.text(`${gym.phone} | ${gym.email}`, { align: "center" });
  if (gym.pan_vat_number) doc.text(`PAN/VAT: ${gym.pan_vat_number}`, { align: "center" });
  doc.moveDown(1.5);

  // Invoice title
  doc.fontSize(18).font("Helvetica-Bold").text(`Invoice ${bill.invoice_number}`, { align: "center" });
  doc.moveDown(1);

  // Invoice details
  const details = [
    `Member: ${memberName}`,
    `Billed to: ${bill.customer_name}`,
    `Billing date: ${bill.billing_date}`,
    `Due date: ${bill.due_date ?? "Not specified"}`,
    `Invoice status: ${bill.invoice_status}`,
    `Payment status: ${bill.payment_status.replaceAll("_", " ")}`,
  ];
  doc.fontSize(10).font("Helvetica");
  details.forEach((d) => doc.text(d));
  doc.moveDown(1);

  // Items table
  const tableTop = doc.y;
  const colWidths = [280, 40, 100, 100];
  const colX = [50, 330, 370, 470];
  const headers = ["Item", "Qty", "Unit Price", "Total"];

  doc.font("Helvetica-Bold").fontSize(10);
  headers.forEach((h, i) => doc.text(h, colX[i], tableTop, { width: colWidths[i] }));
  doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();

  doc.font("Helvetica").fontSize(9);
  let rowY = tableTop + 20;
  items.forEach((item) => {
    const desc = `${item.description}${item.customer_type ? ` (${customerType(item)})` : ""}${item.membership_period_start ? ` - ${item.membership_period_start} to ${item.membership_period_end}` : ""}`;
    doc.text(desc, colX[0], rowY, { width: colWidths[0] });
    doc.text(String(item.quantity), colX[1], rowY, { width: colWidths[1], align: "center" });
    doc.text(money(item.unit_price_minor), colX[2], rowY, { width: colWidths[2], align: "right" });
    doc.text(money(item.line_total_minor), colX[3], rowY, { width: colWidths[3], align: "right" });
    rowY += 20;
    if (rowY > 720) { doc.addPage(); rowY = 50; }
  });
  doc.moveTo(50, rowY).lineTo(520, rowY).stroke();
  rowY += 10;

  // Totals
  const totalsData: Array<[string, number]> = [
    ["Subtotal", bill.subtotal_minor],
    ["Discount", -bill.discount_minor],
    [bill.tax_label || "Tax", bill.tax_minor],
    ["Total", bill.total_minor],
    ["Paid", bill.paid_minor],
    ["Balance", bill.balance_minor],
  ];
  totalsData.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(label, colX[0], rowY, { width: colWidths[0] + colWidths[1] + colWidths[2] });
    doc.font("Helvetica").text(money(value), colX[3], rowY, { width: colWidths[3], align: "right" });
    rowY += 18;
  });

  // Notes and footer
  if (bill.notes) {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("Notes:");
    doc.font("Helvetica").text(bill.notes);
  }
  doc.moveDown(1.5);
  doc.font("Helvetica-Oblique").fontSize(9).text(gym.receipt_footer, { align: "center" });

  await new Promise<void>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve());
    doc.on("error", reject);
    doc.end();
  });
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}