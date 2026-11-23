# PHP migration development

The PHP API currently implements authentication, attendance, member records and private portraits. The React app still uses Supabase. Use a separate development database for this branch.

## Windows

Install PHP 8.2 or newer and enable `pdo_mysql` in the active `php.ini`. Install MariaDB or MySQL locally. Create a blank database and a database user with access to it. Set `GYM_DB_DSN`, `GYM_DB_USER` and `GYM_DB_PASSWORD` in the PowerShell process that runs PHP. The example environment file lists the variables. PHP reads the process environment.

```powershell
php -m
php backend/bin/migrate.php apply
php backend/bin/migrate.php verify
```

Use a separate migration user with DDL privileges. The online PHP user needs only the DML permissions used by the application. The verify command checks migration versions and checksums, InnoDB engines, and the expected foreign keys.

Provision accounts with `php backend/bin/account.php create UUID EMAIL admin`. Reuse existing administrator UUIDs only after verifying the account and its role with a trusted operator. The command reads a password of 15–72 bytes from standard input. On Windows, pass it via a secret prompt and a pipe, keeping it out of shell history and the argument list. Use `php backend/bin/account.php reset UUID` with the same input method to reset a password and revoke existing sessions. Account provisioning and resets are restricted to the CLI.

The integration suite requires a disposable loopback database named `gym_migration_test`. It creates fixture records. Run `node --test backend/tests/auth.integration.mjs`. For a portable PHP install without an active `php.ini`, set `GYM_PHP_EXTENSION_DIR` to the PHP extension directory so the test runner can load `pdo_mysql`.

Run both suites with `node --test --test-concurrency=1 backend/tests/auth.integration.mjs backend/tests/billing.integration.mjs`. The billing tests temporarily install a failure-injection trigger and modify the tax setting in the disposable database.

## API

Use HTTPS. Load `GET /api/auth/session` to obtain the anonymous session cookie and CSRF token. Send JSON with `X-CSRF-Token` to `POST /api/auth/login`, then retain the returned session cookie and token. `GET /api/auth/admin` verifies the administrator role and `POST /api/auth/logout` clears the authenticated session. `POST /api/attendance/change` requires an administrator session and accepts `memberId`, `date` in ISO format, and `action` of `mark`, `remove` or `restore`. `GET /api/attendance/history?memberId=123` returns the 60 latest attendance records for the member, including soft-deleted rows, and also requires administrator access.

`GET /api/attendance/grid` returns a page of members, their attendance records and recently removed records, and the dates marked as holidays. Supply inclusive `start` and `end` Nepal calendar dates in Gregorian ISO format, with an optional `offset`, `limit`, `search`, and `enabled` of `active`, `inactive` or `all`. The maximum range is 63 days. `POST /api/attendance/holiday` uses `date` and `action` of `save` or `remove`, with a `name` for saves. Both routes require administrator access, and writes require CSRF.

Keep backend source, SQL, tests and credentials outside the document root. A production web entry point must expose only the API entry script and route through it. The test router emulates HTTPS on the loopback PHP development server. Use the hosting web server's HTTPS integration for deployment.

### Member endpoints

| Endpoint | Request |
| --- | --- |
| `GET /api/members` | `offset`, `limit`, `search`, `deleted`, `enabled`, `sort`, `membership_type`, `membership_status`, `payment_status` |
| `GET /api/members/details?id=123` | Member and recent activation history |
| `GET /api/members/fees?id=123` | Read-only fee ledger, outstanding balances and recent paid fees |
| `POST /api/members/save` | Profile fields, with numeric `id` for edits |
| `POST /api/members/change` | `action` and `ids`, or explicit `all: true` for bulk activation, deactivation or deletion |
| `POST /api/members/upload-photo` | Multipart `memberId` and `photo` |
| `GET /api/members/photo?key=…` | The private image returned by the upload endpoint |

All endpoints require an administrator session. Writes require the CSRF header. Configure `GYM_PRIVATE_MEDIA_DIR` as an existing writable directory outside the document root. Allow 5 MiB for `upload_max_filesize` and at least 6 MiB for `post_max_size`. Only JPEG, PNG, and WebP are accepted. Replaced images remain on disk and only the current portrait URL is served. Existing external image URLs still require a verified object migration.

### Membership billing

`POST /api/membership/payments` requires administrator access, CSRF and an `Idempotency-Key` of 16–128 URL-safe characters. Send `memberId`, `feeIds`, `paymentMethod` and optionally `amountMinor`, `paymentDate`, `reference` and `notes`. The amount is the pre-tax amount applied to fees, in integer minor units. Omit it to settle the selected balance. The API allocates oldest selected months first and adds configured tax to the receipt. A successful retry returns the original invoice and payment. Keep the same key and payload after a timeout. A new payment requires a new key.

`GET /api/membership/payment-history?id=123` reads recent payment records for the member. `GET /api/invoices/receipt?id=123` returns the issued receipt, items and payments. Both require administrator access. Financial mutations affect existing fee periods only.

`GET /api/invoices` returns the invoice list and Nepal-local billing summary. It accepts `search`, `invoiceStatus`, `paymentStatus`, inclusive ISO dates `from` and `to`, and `limit` and `offset`. The list identifies invoices issued by the PHP product and membership flows so a client can choose the matching cancellation action.

`POST /api/membership/cancel-invoice` accepts `invoiceId` and `reason` for invoices issued by the PHP membership payment endpoint. It requires administrator access and CSRF. It restores the allocated fee balances and records a linked reversal in the same transaction. Retrying returns the original reversal.

`POST /api/invoices/payments` records a subsequent payment on an issued invoice. It takes `invoiceId`, `amountMinor`, `paymentMethod` and an `Idempotency-Key`. It locks the invoice and rejects overpayments.

The PHP Billing preview saves a payment snapshot using `POST /api/billing/attempt/change` with `action: prepare`. The execute action uses the saved payload through the existing idempotent allocator. `GET /api/billing/attempt` retrieves only the signed-in operator's active attempt. If a payment committed before the response was lost, Billing opens its original receipt after reload. An unfinished attempt can be retried or explicitly discarded. Dismissal and discard clear the stored payload and preserve the key and fingerprint to prevent key reuse.

`GET /api/invoices/training-plans` lists active personal-training plans. `POST /api/invoices/services/issue` uses the same customer, payment, date and idempotency fields as product checkout, plus a `service` with `kind`, `unitPriceMinor`, optional `discountMinor`, and either a training `planId` or a miscellaneous `description`. The existing PHP invoice cancellation endpoint also reverses payments on PHP-issued service invoices.

`GET /api/admin/dashboard` supplies Nepal-local dashboard metrics, charts and follow-up lists. It accepts a `period` of 7, 30 or 90 days and an optional `horizon` of 7, 15 or 30 days. Today’s collections sum persisted payment rows on issued invoices by Nepal payment date, subtracting reversals. The outstanding-bills card uses issued invoices dated within the selected period. Membership cards keep the existing lifecycle and payment-status rules.

### Inventory adjustments

`POST /api/inventory/stock` records a manual movement for an existing variant. Send `variantId`, `type` and a signed decimal string in `quantityDelta` with up to three decimal places. Optional fields are `supplierId`, `reference` and `notes`. The API locks the variant when updating its balance and recording the movement. `GET /api/inventory/stock-history?variantId=123` returns recent movements. Both routes require administrator access, and the adjustment requires CSRF. Treat adjustments as individual submissions and reconcile the history after a timeout before submitting again.

`GET /api/inventory/variants` lists tracked variants using `search`, `category`, `active`, `stock`, `limit` and `offset`. A product save can include `openingStock` and a SKU to create its default variant and opening movement in the same transaction. Send `costPriceMinor` on a purchase to update the variant cost atomically. `POST /api/inventory/catalog/activation` applies an activation or deactivation to selected products and their variants.

### React migration preview

Set `VITE_GYM_BACKEND=php` and `GYM_PHP_DEV_URL=http://127.0.0.1:8082` in the Vite process environment. Use a disposable database and the test router on loopback. Set `GYM_AUTH_TEST=1` and `GYM_AUTH_TEST_ADDRESS=127.0.0.1` in the PHP process, then run `php -S 127.0.0.1:8082 -t backend/public backend/tests/router.php`. Start Vite and open the login on `localhost`. Use a local Supabase configuration for the remaining public routes. The preview uses PHP for login, session checks, sign-out, Dashboard, Members, Attendance, Billing and Inventory. Other private screens are blocked in this mode while their APIs are being connected. CSV import, fee generation, pricing administration, legacy invoice cancellation, email and product image uploads remain outside the preview.
