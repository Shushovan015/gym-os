# Inventory prices and bill numbers

## Apply the update

1. Back up the gym database and ensure local Supabase is running. Close other
   billing sessions while applying the update.
2. From the project directory, review pending migrations and apply them:

   ```powershell
   npx supabase migration list --local
   npx supabase migration up --local --include-all
   npm run build
   ```

   The new migration is
   `supabase/migrations/202609220002_inventory_pricing_bill_numbers.sql`.
   After merging main, also apply `202609220003_merge_billing_compatibility.sql`.
   `--include-all` includes main's earlier 20260921 migrations if this installation
   already applied the feature branch's 20260922 migrations. The compatibility
   migration preserves Gmail delivery history and combines manual bill numbers
   with main's configurable starting number and permanent automatic sequence.
   Review any other pending migrations first. Never use `db:reset` on the real
   gym database. This update has only been applied to a disposable test database,
   not your real gym database.
3. Restart using CLOSE GYM APP, then OPEN GYM APP, and reload the browser. This
   also reloads the updated local Send Bill function. If you serve Edge Functions
   separately, restart that process instead.
4. In Inventory, review wholesale prices and set the gym's intended wholesale
   rates. No new environment variables or credentials are required.

For a hosted Supabase project, apply the migration to the correct linked project
with `npx supabase db push`, deploy the updated email template with
`npx supabase functions deploy send-bill`, and publish the rebuilt frontend using
your existing deployment process. Existing Gmail configuration remains required
for sending email.

## Pricing behavior

- Cost and selling prices reuse their existing database fields. Wholesale price
  is added to products and optional variant overrides. Blank variant prices use
  the corresponding product price; an explicit zero is retained as zero.
- Migration initializes existing product wholesale prices to selling prices.
  Existing variant selling overrides are copied into wholesale overrides.
  It does not change existing costs, selling prices or invoice amounts.
- Prices must be non-negative, representable as safe integer minor units, and
  have at most two decimal places in inventory inputs, matching existing inventory
  storage. Wholesale price is not required to be below selling price.
- When creating a product bill, choose General Member / Customer or Wholesale
  Customer before adding a product. General uses selling price; wholesale uses
  wholesale price. The selection applies to subsequent additions, not existing
  lines. Remove and re-add a line to change its pricing category.
- Each line saves its customer type and applied unit price. Later catalog edits
  do not change saved bill prices. The type and price appear during creation,
  in bill details, on the printed bill and in the emailed/attached printable bill.
  Legacy product lines are classified as general without changing their prices.
- Membership, training, payment, tax, stock and cancellation logic is retained.

## Bill numbers

- Optional Bill Number uses the existing `invoices.invoice_number` field, so the
  same value appears in the table, details, printout and emailed invoice.
- Leave it blank to retain the existing prefix/year/sequence automatic format.
  The automatic sequence now follows main's Starting invoice number setting and
  continues across year/prefix changes. Issued or rolled-back automatic numbers
  are not reused. Configure the starting number before automatic numbering begins.
  Enter 1-64 letters, numbers, hyphens, underscores or slashes for a manual number.
  Surrounding whitespace is trimmed. New duplicate numbers are rejected,
  including case differences; legacy numbers are not rewritten.
- Manual and automatic reservations share a database lock and the existing
  unique constraint. Automatic generation skips numbers already reserved manually.
  Custom manual numbers do not reset the automatic counter.
- A manual number is reserved when its draft is saved. If later creation fails,
  that draft retains the number; cancelling it does not free the number. Assigned
  numbers cannot be edited, including on cancelled bills.

## Validation performed

- React TypeScript check, unit tests, production build and Deno Edge Function check.
- PostgreSQL tests on a separate schema-only clone: price validation, manual
  numbers, case-insensitive duplicates, collision skipping, stored prices/types,
  payment totals, stock deduction and cancellation/stock return.
- Separate concurrent PostgreSQL connections tested duplicate manual reservations
  and four simultaneous automatic invoices. Legacy number and price backfill
  checks passed. No live Gmail messages were sent.
- `supabase/inventory-pricing.test.sql` contains the transactional SQL regression
  checks and refuses to run outside a database named `gym_pricing_test_*`.

## Files changed for this update

- `src/pages/admin/AdminInventory.tsx`
- `src/pages/admin/AdminBilling.tsx`
- `src/features/inventory/types.ts`
- `src/features/billing/types.ts`
- `src/features/billing/pricing.ts`
- `src/features/billing/pricing.test.ts`
- `supabase/migrations/202609220002_inventory_pricing_bill_numbers.sql`
- `supabase/functions/send-bill/template.ts`
- `supabase/functions/send-bill/handler.test.ts`
- `supabase/inventory-pricing.test.sql`
- `INVENTORY-BILLING-SETUP.md`
