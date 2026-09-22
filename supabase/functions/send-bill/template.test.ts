import { describe, expect, it } from 'vitest';
import { escapeHtml, renderBill, validEmail, type Bill, type BillItem, type Gym } from './template';

const bill: Bill = {
  id: 1,
  invoice_number: 'GYM-2026-000500',
  member_ref: 1,
  customer_name: 'Alice',
  billing_date: '2026-09-21',
  due_date: '2026-09-30',
  currency_code: 'NPR',
  subtotal_minor: 10000,
  discount_minor: 1000,
  tax_minor: 0,
  tax_label: 'Tax',
  total_minor: 9000,
  paid_minor: 5000,
  balance_minor: 4000,
  invoice_status: 'issued',
  payment_status: 'partially_paid',
  notes: '<script>alert(1)</script>',
};
const gym: Gym = { gym_name: 'A&A Gym', address: 'Butwal', phone: '123', email: 'gym@example.com', pan_vat_number: '12345', receipt_footer: 'Thank you', currency_minor_unit: 2, bill_sender_email: 'gym@example.com' };
const items: BillItem[] = [{ description: 'Monthly membership', quantity: 1, unit_price_minor: 10000, line_total_minor: 10000, membership_period_start: '2026-09-21', membership_period_end: '2026-10-20', customer_type: 'general' }];

describe('printable bill email', () => {
  it('includes invoice identity, member, dates, line items, payment status and all totals', () => {
    const { html } = renderBill(bill, items, gym, 'Alice Member');
    for (const text of [bill.invoice_number, 'Alice Member', '2026-09-21', '2026-09-30', 'Monthly membership', 'partially paid', 'NPR 90.00', 'NPR 50.00', 'NPR 40.00', 'PAN/VAT: 12345']) expect(html).toContain(text);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/(?:src|href)="https?:/);
    expect(html).toContain("default-src 'none'");
  });
  it('escapes untrusted content', () => {
    expect(escapeHtml('<img src=x onerror="bad()">')).toBe('&lt;img src=x onerror=&quot;bad()&quot;&gt;');
  });
  it('rejects missing or injected email addresses', () => {
    for (const value of [null, '', 'not-email', 'a@example.com\r\nBcc: b@example.com', '<a@example.com>']) expect(validEmail(value)).toBe(false);
    expect(validEmail('billing@example.com')).toBe(true);
  });
});
