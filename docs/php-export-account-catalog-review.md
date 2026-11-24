# Proposal B — Export account after production catalog review

The operator-provided CSV confirms all 27 core tables and five of the six optional tables. This is a catalog review. No rows, live routine bodies, or object contents were received. The [previous provisioning SQL](php-export-role-proposal.md) stays on hold.

## Login and callable routines

The CSV shows `PUBLIC USAGE` on `public` and 12 public SECURITY DEFINER routines with `PUBLIC EXECUTE`. Omitting an explicit schema grant or revoking a grant only from the login leaves its effective PUBLIC access intact. The proposed read-only transaction default is configurable and cannot close an RPC write path.

| Observed routines | Checked-in behavior and decision |
| --- | --- |
| `recalculate_invoice_payment_state` | Writes invoice payment state without a caller check in the checked-in body. Resolve under [Proposal A](php-production-security-proposal.md) and verify effective closure. |
| `record_membership_fee_payment`, `record_membership_fee_payment_multi`, `set_member_active_status`, `update_overdue_membership_fees` | Write paths with a checked-in `is_admin()` guard. Review actual bodies, callable dependencies and session claim handling before relying on the guard. Remove PUBLIC and unintended direct EXECUTE grants only after verifying existing callers and preparing a separate ACL change. |
| `handle_new_user`, `on_member_activated_initialize_fees`, `on_member_created`, `on_member_dates_changed_initialize_fees`, `prevent_inactive_attendance`, `validate_bill_number` | Trigger routines in checked-in SQL. Trigger return types prevent ordinary direct calls. Verify current return types and trigger bindings. Keep ownership and all trigger creation or replacement privileges outside the export role. |
| `is_admin` | Checked-in helper reads the profile role for the current Auth UID. Review its actual definition and legitimate RLS callers before changing its ACL. |

The observed `cancel_invoice`, `finalize_invoice`, `record_invoice_payment`, and `record_stock_movement` routines lack PUBLIC EXECUTE in the CSV. Check inherited and direct grants anyway. The previous report truncated long composite labels, so use the [corrected catalog query](../scripts/review-production-export-catalog.sql) for exact signatures before drafting any additional function changes.

**Preferred path.** Use an approved provider snapshot restored to a network-isolated PostgreSQL environment. Provision any export account there against reviewed tables and scoped projections, with no application RPC access. Confirm freshness, exact counts and bucket coverage independently. If the approved snapshot is unavailable or a live export role is required, leave the live login disabled until the project owner verifies actual routine definitions, dependency paths, closed effective writes, no unrelated reads, and exact approved row coverage. Review and approve the required ACL changes separately. The live login would keep the existing NOLOGIN permission group and disabled, time-limited login design. It receives no administrative membership, Auth or Storage base table grants, or RLS bypass.

## RLS and approved projections

All 85 reported policies are permissive. The report contains authenticated-only and PUBLIC SELECT policies and does not establish actual predicate outcomes. An authenticated-only policy cannot be assumed to apply to the proposed custom role. If a live role is pursued, review and approve a narrowly assigned SELECT policy for every RLS-enabled table that should export all rows. Review owner-side RLS and scoped view predicates for staff UUIDs and `gym-media`. Compare complete primary-key sets and counts using one repeatable-read snapshot. Compare the bucket inventory and all object keys, including root files, independently. Keep the account disabled if coverage differs.

## Source-to-MariaDB decisions

| Source | Disposition |
| --- | --- |
| 27 core tables | Existing importer maps compatible columns and reports unmapped fields. Newly observed wholesale pricing, invoice line customer type and cost, invoice counter settings, sender, legacy sale/payment references, and member activation/address/photo fields need exact type and value checks in PLAN. Preserve sequence-year context in the archive. |
| `attendance_holiday_templates`, `member_status_history`, `membership_fees` | Present. Target tables and same-named fields exist. Verify Bikram Sambat month range, source statuses, fee uniqueness, invoice references, and exact paid and outstanding amounts with the actual export. |
| `membership_payment_allocations` | Absent. Keep the missing-table marker. Import only evidenced ledger records. Do not infer allocations, create debt, or enable cancellation of ambiguous invoices. |
| `invoice_email_deliveries` | Present with primary key `invoice_id`. Use only `invoice_id`, `status`, `recipient_email`, and `sent_at` for the importer. Exclude payloads, lease fields and operational secrets. Incomplete evidence stays uncertain and prevents automatic resend. |
| `import_logs` | Present and archive-only. Review exclusion of free-text errors and paths before any protected archive export. |
| `member_measurements`, `member_report_logs`, `member_transformations` | Present and archive-only. Require explicit authorization and restricted preservation for measurements, report logs, transformation metadata and images. Keep images private pending publication review. |
| `profiles` | Use only the approved staff UUID and role in the restricted staff projection. Existing importer treats this evidence as archive-only and creates no accounts automatically. |

The existing source exporter uses whole rows for ordinary tables. Before any real export, adapt or stage the restricted delivery, import-log and staff projections so excluded fields never enter the transferable export. Verify that the resulting allowed markers and fields match the importer before PLAN.
