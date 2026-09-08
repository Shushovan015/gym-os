export type InvoiceStatus = "draft" | "issued" | "cancelled";
export type BillingPaymentStatus = "unpaid" | "partially_paid" | "paid";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "digital_wallet" | "other";
export type InvoiceItemType = "membership" | "personal_training" | "product" | "miscellaneous";

export type InvoiceRow = {
  id: number; invoice_number: string | null; member_ref: number | null; customer_name: string;
  customer_phone: string | null; customer_email: string | null; billing_date: string; due_date: string | null;
  invoice_status: InvoiceStatus; payment_status: BillingPaymentStatus; currency_code: string;
  subtotal_minor: number; discount_minor: number; tax_minor: number; total_minor: number;
  paid_minor: number; balance_minor: number; tax_enabled: boolean; tax_label: string;
  tax_rate_basis_points: number; notes: string | null; cancellation_reason: string | null;
  created_at: string;
};

export type InvoiceItemRow = {
  id: number; invoice_id: number; item_type: InvoiceItemType; product_id: number | null;
  variant_id: number | null; description: string; quantity: number; unit_price_minor: number;
  discount_minor: number; tax_minor: number; line_total_minor: number;
  unit_cost_minor?: number | null;
  membership_period_start: string | null; membership_period_end: string | null;
};

export type InvoicePaymentRow = {
  id: number; invoice_id: number; amount_minor: number; payment_method: PaymentMethod;
  payment_date: string; reference: string | null; notes: string | null; created_at: string;
};

export type DraftLine = {
  key: string; itemType: InvoiceItemType; productId: number | null; variantId: number | null;
  description: string; quantity: number; unitPriceMinor: number; discountMinor: number;
  membershipPeriodStart?: string; membershipPeriodEnd?: string;
};
