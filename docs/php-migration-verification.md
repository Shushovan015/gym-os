# PHP migration verification

| Area | Status | Evidence or remaining scope |
| --- | --- | --- |
| PHP sessions, login/logout, roles, CSRF, reset and throttling | PASS | HTTP tests against disposable MariaDB 10.11. The CLI reset revokes old sessions. |
| Member records and history | PASS | HTTP tests for create, update, duplicate identity rejection, search, active-state changes, soft delete, restore and viewer denial. Scope is the PHP API. |
| Member plans, renewals, measurements, import/export and all-member actions | NOT TESTED | Full workflow and migration coverage pending. |
| Attendance | PASS | PHP API tests cover mark, removal, restore, history, last visit, locked holidays, weekly closures and invalid leap day. |
| React Attendance workspace | PASS | PHP preview loads paginated Nepal calendar ranges, holiday dates and activation filters. MariaDB tests cover leap day, year boundaries, duplicate changes, inactive members and authorization. React tests cover loading and errors, month changes, search, mark, remove, restore and reload. The separate Holiday Manager remains pending. |
| Private portrait storage | PASS | Multipart upload and byte-for-byte download, invalid image, invalid key, CSRF, viewer and anonymous denial. |
| React authentication and Members preview | PASS | React flow test covers PHP login, CSRF, the protected route and the existing Members screen's PHP reads. Backend HTTP tests cover member edits, settings, plan loading and portraits. PHP mode is opt-in. |
| Complete PHP frontend integration and standalone runtime | FAIL | Supabase remains in the frontend. Billing, Inventory and other admin screens still require migration. |
| Membership fee ledger reads | PASS | MariaDB fixture verifies persisted statuses, partial balance, totals, due date, empty ledger and viewer denial. |
| Membership payments and receipts | PASS | MariaDB 10.11 and HTTP tests cover full, partial and multi-month allocations, oversize and already-paid rejection, same-key replay and payload conflicts, concurrent invoice numbers, integer tax, financial reconciliation, receipt and history endpoints, and rollback after a database-injected audit failure. |
| Billing overview and member payment history | PASS | PHP invoice listing, filters, pagination and summary are covered by HTTP tests. The React Members profile reads and displays invoice transactions and reversals from PHP. The Billing workspace itself remains pending. |
| Membership due-date updates | PASS | Outstanding dates, overdue state and January 31 clamping in leap and non-leap years. |
| Membership payment reversals | PASS | Concurrent cancellation returns one reversal, selected allocations are restored, other payments remain intact, and the route rejects missing CSRF and viewer sessions. PHP-issued membership invoices only. |
| Inventory stock adjustments and history | PASS | MariaDB verifies exact fractional quantities, serialized concurrent deductions, insufficient-stock rejection and matching movement history. HTTP tests verify administrator and CSRF restrictions. |
| Product invoice issue and cancellation | PASS | MariaDB verifies price and quantity snapshots, combined stock deduction and restoration for multiple lines of one variant, concurrent cancellation and issuance, idempotency, and transaction rollback. Scope is PHP-issued product invoices. |
| Fee generation, general billing and legacy reversals | NOT TESTED | Fee generation, mixed invoices, legacy reversal reconciliation and PDF receipts pending. |
| Catalog and supplier administration | PASS | HTTP tests cover product and variant creation, editing, deletion, SKU conflicts, filtered pagination, stock valuation, low stock, suppliers and role checks. |
| Reporting, public content and Website Studio | NOT TESTED | PHP API and frontend switch pending. |
| Existing media, documents, SMTP and notifications | NOT TESTED | Object migration and services pending. |
| Backup, restore, legacy import and production reconciliation | NOT TESTED | Disposable rehearsal pending. |
| Integrated Bikram Sambat behavior | NOT TESTED | Existing frontend utility tests pass. The PHP-connected workflow is pending. |
| DirectAdmin/cPanel package and hosting | NOT TESTED | Full application package and host-specific checks pending. |

The checkpoint is for development only. Continue with membership collection in `AdminBilling.tsx`. Use `GET /api/invoices` for its list and summary, connect its active member and fee selectors and receipt drawer, and submit to `POST /api/membership/payments` with a stable idempotency key that survives a failed response. Test a payment and retry from React before enabling Billing in the preview. Product checkout and general invoice management still need their own UI and API coverage.
