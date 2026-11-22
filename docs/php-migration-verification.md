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
| Membership payments and receipts | PASS | MariaDB 10.11 and HTTP tests cover full, partial and multi-month allocations, oversize and already-paid rejection, same-key replay and payload conflicts, concurrent invoice numbers, integer tax, financial reconciliation, receipt and history endpoints, and rollback after a database-injected audit failure. |
| Membership due-date updates | PASS | Outstanding dates, overdue state and January 31 clamping in leap and non-leap years. |
| Membership payment reversals | PASS | Concurrent cancellation returns one reversal, selected allocations are restored, other payments remain intact, and the route rejects missing CSRF and viewer sessions. PHP-issued membership invoices only. |
| Inventory stock adjustments and history | PASS | MariaDB verifies exact fractional quantities, serialized concurrent deductions, insufficient-stock rejection and matching movement history. HTTP tests verify administrator and CSRF restrictions. |
| Fee generation, general billing and stock-linked invoice cancellation | NOT TESTED | Fee generation, inventory-linked billing, legacy reversal reconciliation and PDF receipts pending. |
| Catalog and supplier administration | NOT TESTED | Schema installed. Catalog write and listing APIs pending. |
| Reporting, public content and Website Studio | NOT TESTED | PHP API and frontend switch pending. |
| Existing media, documents, SMTP and notifications | NOT TESTED | Object migration and services pending. |
| Backup, restore, legacy import and production reconciliation | NOT TESTED | Disposable rehearsal pending. |
| Integrated Bikram Sambat behavior | NOT TESTED | Existing frontend utility tests pass. The PHP-connected workflow is pending. |
| DirectAdmin/cPanel package and hosting | NOT TESTED | Full application package and host-specific checks pending. |

The checkpoint is for development only. Continue with catalog CRUD and the inventory list used by AdminInventory and AdminBilling. Then implement product invoice issue and cancellation in one transaction using the numbering row, invoice items, variants and stock movement ledger. Port the latest cancellation logic to aggregate all sold quantities per variant. Test two sale lines for one variant with different prices, concurrent insufficient stock, and a retried cancellation before switching the frontend.
