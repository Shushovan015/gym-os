# Send Bill setup

1. Back up your database. Apply migrations `202609210001_invoice_numbering.sql`
   and `202609210002_bill_email.sql` before deploying the updated frontend.
   For the existing local project, run `npx supabase migration up --local`.
   For a hosted project, link the intended project and review pending migrations
   before running `npx supabase db push`. Do not reset a database containing records.
2. Verify a domain you own in Resend and complete its DNS verification. Create a
   sending API key. See [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction).
3. Hosted Supabase: put `RESEND_API_KEY=re_...` in a private, ignored environment
   file, then run `npx supabase secrets set --env-file <your-private-file>` and
   `npx supabase functions deploy send-bill`. Supabase supplies the server URL and
   service-role key. Never put a service-role key or Resend key in `VITE_` variables.
4. Local Supabase: copy this directory's `.env.example` to `.env.local`, fill in
   the key, then run `npx supabase functions serve send-bill --env-file supabase/functions/send-bill/.env.local`.
   Keep that process running when sending bills. Existing app startup scripts are
   unchanged. The Edge Function needs internet access to Resend.
5. In System Settings → Billing and inventory, save **Bill sender email**, using
   an address on the verified domain. Set **Starting invoice number** before
   issuing the first invoice after the migration. Existing numbers are preserved;
   the default starts beyond historical counters. Starting numbers cannot move
   backwards or change after the first allocation. Prefix/year formatting stays
   the same, but the numeric sequence no longer resets each year. Cancelled and
   failed/rolled-back allocations are never reused, so gaps are possible.
6. Save the member's email on their profile. Use **Send Bill** in the billing
   table, mobile bill card, or bill details, check the recipient, and confirm.
   Walk-in and draft/cancelled bills cannot be sent. To email a bill it must be
   linked to a member. The server rechecks the signed-in user's admin role and
   reads invoice content, recipient and sender from the database.

## Printable invoice and delivery status

The existing application prints HTML using the browser and has no saved bill PDF
or PDF storage column. Email therefore includes the complete, escaped printable
invoice both in the body and as a self-contained `.html` attachment. The recipient
can print the email, or open the attachment and choose Print / Save as PDF. There
are no public invoice URLs, scripts, external resources or frontend API keys.

“Bill sent” means Resend accepted the email, not that it reached the inbox. Check
Resend logs for bounces/delivery. Each invoice can be sent once. The database claim
prevents simultaneous sends and persists across browser restarts. Ambiguous
network failures retry the original frozen payload with the same Resend
idempotency key; a failed lease becomes retryable after 90 seconds. Since Resend
retains keys for 24 hours, ambiguous attempts older than 23 hours are blocked for
manual provider-log review. Never delete/reset a delivery record unless you have
confirmed that no email was accepted. Definite provider rejections allow a retry
with corrected sender/settings. See [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Sending is not automatic. No real emails are sent by the automated tests.

## Validation

- `npx tsc -b` — frontend TypeScript.
- `npm test` — billing, inventory, popup, debounce, template and mocked sender tests.
- `npm run build` — production bundle.
- `deno check supabase/functions/send-bill/index.ts` — Edge Function TypeScript.
- `supabase/tests/invoice_billing.sql` — run only on a disposable schema clone
  with both migrations applied. It refuses databases whose names do not start
  with `gym_changes_test`. It tests numbering, immutability, rollback consumption,
  send claims, frozen retries, expiry and permissions using synthetic records.

Database migrations and the function must be deployed to the same Supabase
project used by the frontend. No additional frontend environment variables are needed.
