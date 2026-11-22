# PHP migration verification

| Area | Status | Evidence or remaining scope |
| --- | --- | --- |
| PHP sessions, login/logout, roles, CSRF, reset and throttling | PASS | HTTP tests against disposable MariaDB 10.11. The CLI reset revokes old sessions. |
| Member records and history | PASS | HTTP tests for create, update, duplicate identity rejection, search, active-state changes, soft delete, restore and viewer denial. Scope is the PHP API. |
| Member plans, renewals, measurements, import/export and all-member actions | NOT TESTED | Full workflow and migration coverage pending. |
| Attendance | PASS | PHP API tests cover mark, removal, restore, history, last visit, locked holidays, weekly closures and invalid leap day. |
| Private portrait storage | PASS | Multipart upload and byte-for-byte download, invalid image, invalid key, CSRF, viewer and anonymous denial. |
| Existing React build and Vitest suite | PASS | Existing Supabase-connected frontend. |
| PHP frontend integration and standalone runtime | FAIL | React still calls Supabase. |
| Membership fee ledger reads | PASS | MariaDB fixture verifies persisted statuses, partial balance, totals, due date, empty ledger and viewer denial. |
| Membership fee generation and payments | NOT TESTED | PHP mutations and financial transactions pending. |
| Billing, invoices, tax, inventory sales and reversals | NOT TESTED | PHP services and financial concurrency tests pending. |
| Reporting, public content and Website Studio | NOT TESTED | PHP API and frontend switch pending. |
| Existing media, documents, SMTP and notifications | NOT TESTED | Object migration and services pending. |
| Backup, restore, legacy import and production reconciliation | NOT TESTED | Disposable rehearsal pending. |
| Integrated Bikram Sambat behavior | NOT TESTED | Existing frontend utility tests pass. The PHP-connected workflow is pending. |
| DirectAdmin/cPanel package and hosting | NOT TESTED | Full application package and host-specific checks pending. |

The checkpoint is for development only. Continue with a transactional fee payment allocator on top of migration `004_fee_ledger.sql`. Port invoice items, code the invoice number allocator and idempotency record, and use the latest `record_membership_fee_payment_multi` and cancellation functions as references. Test January 31 due-day clamping, partial payments, multiple-month allocation and concurrent replay before wiring the Members and Billing views.
