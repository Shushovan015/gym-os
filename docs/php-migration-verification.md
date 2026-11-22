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
| Membership fee ledger and payments | NOT TESTED | PHP services and transactions pending. |
| Billing, invoices, tax, inventory sales and reversals | NOT TESTED | PHP services and financial concurrency tests pending. |
| Reporting, public content and Website Studio | NOT TESTED | PHP API and frontend switch pending. |
| Existing media, documents, SMTP and notifications | NOT TESTED | Object migration and services pending. |
| Backup, restore, legacy import and production reconciliation | NOT TESTED | Disposable rehearsal pending. |
| Integrated Bikram Sambat behavior | NOT TESTED | Existing frontend utility tests pass. The PHP-connected workflow is pending. |
| DirectAdmin/cPanel package and hosting | NOT TESTED | Full application package and host-specific checks pending. |

The checkpoint is for development only. The next implementation task is to port the invoice and membership-fee schemas from the PostgreSQL baseline and follow-up migrations, including historical identifiers and fee-to-invoice relationships. Implement the fee status query and transactional payment allocator using the latest `record_membership_fee_payment_multi` and cancellation functions as references. Test imported status preservation, January 31 due-day clamping, partial payment, multiple-month allocation and idempotent replay before wiring the Members and Billing views.
