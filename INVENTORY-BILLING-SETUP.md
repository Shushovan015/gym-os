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
   The editable numeric preview is added by
   `202609230001_editable_bill_number.sql`; apply it before using Create Bill.
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

- Bill Number uses the existing `invoices.invoice_number` field, so the
  same value appears in the table, details, printout and emailed invoice.
- In Settings > Billing and inventory, **Bill Number** sits beside PAN / VAT.
  It is the starting/last-used number: setting **1001** makes the first new bill
  **1002**, followed by **1003**, **1004**, etc. Configure it before numbering
  starts; it cannot move backwards or reset an already-used sequence.
- Create Bill loads a visible, editable suggestion. Opening or cancelling the
  form consumes no number. Use next number refreshes the suggestion.
- New bill numbers are plain positive integers. Existing formatted/custom bill
  numbers remain unchanged. The legacy prefix setting does not prefix new numbers.
- You may edit the suggestion to a higher unused number. Saving **2000** makes
  the next suggestion **2001**. Lower numbers and duplicates are rejected;
  leading zeroes are normalized, so **002000** cannot duplicate **2000**.
- Automatic and edited numbers share database locks and the existing unique
  constraint. If another user saves first, an unchanged suggestion is allocated
  again atomically; the saved bill shows the actual number. Explicit edits are
  validated and never silently replaced.
- A number is reserved when its draft is saved. If later creation fails,
  that draft retains the number; cancelling it does not free the number. Assigned
  numbers cannot be edited, including on cancelled bills. Rolled-back allocations
  are not reused, so gaps are possible after a failed save.

The numeric update adds `src/features/billing/useNextBillNumber.ts` and its
`.test.tsx` tests, the `202609230001_editable_bill_number.sql` migration, and
`supabase/tests/editable_bill_number.sql`. It updates the existing billing and
settings pages. No new environment variables or email changes are needed.
The new SQL tests require a disposable database named `gym_bill_number_test_*`.

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
