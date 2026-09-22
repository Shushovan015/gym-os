# Send gym bills using Gmail

Use an existing Gmail or Google Workspace mailbox. No domain purchase or Resend
account is needed. Sending requires internet and a running Supabase Edge Functions
service, even when the gym app runs locally.

## Local setup

1. Enable **2-Step Verification** on the gym's Google account, then create an
   App Password at <https://myaccount.google.com/apppasswords> (name it Gym Bills).
   Use the generated password, **not your regular Google password**.
   [Google instructions](https://support.google.com/accounts/answer/185833?hl=en).
   Some account security settings and Workspace policies prevent App Passwords;
   if unavailable, check the account settings or ask your Workspace administrator.
2. Copy `supabase/functions/.env.example` to `supabase/functions/.env` and edit:

   ```dotenv
   GMAIL_USER=yourgym@gmail.com
   GMAIL_APP_PASSWORD=your_google_app_password
   ```

   This file is ignored by Git. Never put this password in a `VITE_` variable,
   the frontend `.env.local`, System Settings, source code, screenshots or chat.
3. Back up your database. With local Supabase running, review pending migrations
   and apply them from the project directory:

   ```powershell
   npx supabase migration list --local
   npx supabase migration up --local
   npm run build
   ```

   This feature adds `202609220001_gmail_bill_delivery.sql`. Review any other
   pending migrations before applying them. Do not reset your real gym database.
4. Use **CLOSE GYM APP**, then **OPEN GYM APP** to reload the server configuration.
   Supabase loads `supabase/functions/.env` on startup. If you normally run the
   function separately, restart it with:

   ```powershell
   npx supabase functions serve send-bill --env-file supabase/functions/.env
   ```
5. As admin, open **System Settings**, set **Bill sender email** to the exact
   `GMAIL_USER` address and save. Check the gym name, contact and invoice details.
   Save the member's email on their member profile.
6. In **Billing**, choose an issued invoice linked to a member, click **Send Bill**,
   check the addresses and click **Confirm and send**. Use a designated test
   member and invoice for the first send; a successful send marks it as sent.

## Hosted Supabase, if applicable

Target the correct linked project, apply the migration and deploy:

```powershell
npx supabase db push
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy send-bill
```

Set the same sender address in that project's System Settings. Never expose a
service-role key or Gmail password to React. SMTP uses verified TLS on port 465.

## Delivery behavior

- Only authenticated admins can send. The server reads database bill details,
  validates the saved recipient and sender, and obtains an atomic database
  reservation before contacting Gmail. Concurrent requests cannot both reserve
  the same invoice.
- The email includes invoice number, member, items, totals, dates, payment status
  and gym information. This checkout has no stored bill PDF, so it attaches an
  escaped, self-contained printable HTML invoice. Open it in a browser and use
  Print / Save as PDF. No public link to member records is created.
- “Bill sent” means Gmail accepted the message, not guaranteed inbox delivery.
  Check spam folders and bounce messages if needed.
- Explicit connection, login and SMTP rejection failures can be retried after
  fixing the cause. SMTP has no idempotency key: a lost response or interrupted
  send leaves the result uncertain and blocks automatic resending. Check Gmail
  Sent for the invoice number. Do not delete the tracking record or blindly reset
  its status. Manual recovery requires confirming the original request has
  finished and whether Gmail accepted the message.
- Gmail sending limits apply. Changing the Google password can revoke App
  Passwords; replace the App Password and restart the function when necessary.

## Verification

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
npm test
npm run build
deno check --config supabase/functions/send-bill/deno.json supabase/functions/send-bill/index.ts
```

Unit tests cover authorization, address validation, reservation states, SMTP
failures, recording failures and escaped printable content. They mock database
and SMTP operations; they do not validate live Gmail delivery or SQL locking.

## Changed files

- `src/pages/admin/AdminBilling.tsx`: Send Bill actions in both layouts and details.
- `src/pages/admin/AdminSettings.tsx`: sender email setting and validation.
- `src/pages/admin/adminTypes.ts`, `src/pages/admin/adminUtils.ts`: setting type/default.
- `src/features/billing/useBillEmail.tsx`: confirmation, loading and delivery states.
- `src/components/admin/AdminUI.tsx`: preserve scroll locking and Escape behavior
  when the email confirmation opens above the invoice drawer.
- `supabase/migrations/202609220001_gmail_bill_delivery.sql`: delivery records,
  admin-only reads and service-only atomic reservation/completion functions.
- `supabase/config.toml`: authenticated Send Bill function configuration.
- `supabase/functions/.env.example`: server-side Gmail configuration template.
- `supabase/functions/send-bill/index.ts`: Gmail SMTP transport.
- `supabase/functions/send-bill/handler.ts`: authorization and sending workflow.
- `supabase/functions/send-bill/gmail.ts`: SMTP result classification.
- `supabase/functions/send-bill/template.ts`: email and printable invoice content.
- `supabase/functions/send-bill/handler.test.ts`: mocked delivery and template tests.
- `supabase/functions/send-bill/deno.json`, `deno.lock`: function dependency setup.
- `supabase/functions/send-bill/README.md`: setup and operation guide.
