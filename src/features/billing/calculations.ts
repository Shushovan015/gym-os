import type { DraftLine } from "./types";

export function calculateLineSubtotal(line: Pick<DraftLine, "quantity" | "unitPriceMinor">) {
  return Math.round(line.quantity * line.unitPriceMinor);
}

export function calculateInvoiceTotals(lines: DraftLine[], invoiceDiscountMinor: number, taxEnabled: boolean, taxRateBasisPoints: number) {
  const subtotalMinor = lines.reduce((sum, line) => sum + calculateLineSubtotal(line), 0);
  const lineDiscountMinor = lines.reduce((sum, line) => sum + line.discountMinor, 0);
  const discountMinor = Math.max(0, Math.min(subtotalMinor, invoiceDiscountMinor + lineDiscountMinor));
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = taxEnabled ? Math.round((taxableMinor * taxRateBasisPoints) / 10_000) : 0;
  return { subtotalMinor, discountMinor, taxMinor, totalMinor: taxableMinor + taxMinor };
}

export function paymentStatus(totalMinor: number, paidMinor: number) {
  if (paidMinor <= 0) return "unpaid" as const;
  if (paidMinor < totalMinor) return "partially_paid" as const;
  return "paid" as const;
}

