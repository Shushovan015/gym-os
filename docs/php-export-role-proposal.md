# Restricted export role proposal

For review only. The scope is based on the November 22 local schema, the checked-in migrations, and the importer allowlist. Production catalog, ACLs and RLS remain unverified. All provisioning, password setup and cleanup below require separate authorization in project `akhbjjggcftyzlunrxwk`.

## Scope for approval

- Core application tables are the 27 names in the first SQL block. All columns in each require review against the current catalog before approval. No schema-wide, default, future-table or sequence grants.
- Optional tables require separate column and purpose review before adding their exact names to the list. These are `public.member_status_history`, `public.attendance_holiday_templates`, `public.membership_fees`, `public.membership_payment_allocations`, `public.invoice_email_deliveries`, and `public.import_logs`. Check whether each currently exists. Audit text or JSON may contain unrelated personal data or secrets and may need a projection.
- `public.member_measurements`, `public.member_report_logs`, and `public.member_transformations` remain archive-only and excluded from this grant. Review their separate handling. The Storage projection inventories all objects in the approved bucket, including transformation objects, for protected preservation.
- Staff output is `id, email, email_confirmed_at, banned_until, deleted_at, source_role`, limited to approved roster UUIDs. Profile access is limited to the join and role lookup. Storage bucket output is `id, public`. Storage object output is `bucket_id, name, bytes, mime, etag, updated_at`, limited to `gym-media`. The login receives view access only for these projections. Storage downloads use a separately approved list/read identity.

## 1. Provision disabled roles and scoped reads

Run as the authorized provisioning owner only after approval. Review existing schema grants, role memberships and SECURITY DEFINER functions executable by `PUBLIC` first. Stop if those grant unrelated access or writes. Use the approved roster in the protected change session. The empty roster guard rolls the transaction back until populated.

```sql
BEGIN;
CREATE ROLE gym_export_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
CREATE ROLE gym_export_login NOLOGIN INHERIT NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 PASSWORD NULL;
GRANT gym_export_reader TO gym_export_login;
ALTER ROLE gym_export_login IN DATABASE postgres SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE postgres TO gym_export_reader;
GRANT USAGE ON SCHEMA public TO gym_export_reader;

DO $scope$
DECLARE
  t text;
  rls boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_settings', 'attendance_holidays', 'attendance_records',
    'contact_content', 'contact_faqs', 'facilities_page_content',
    'facility_items', 'footer_content', 'home_content', 'home_maximus_points',
    'home_status_items', 'inventory_product_variants', 'inventory_suppliers',
    'invoice_items', 'invoice_number_sequences', 'invoice_payments', 'invoices',
    'members', 'personal_training_plans', 'pricing_items', 'pricing_page_content',
    'shop_items', 'shop_page_content', 'stock_movements', 'testimonials',
    'trainer_page_content', 'trainers'
  ] LOOP
    SELECT c.relrowsecurity INTO STRICT rls
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r';
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO gym_export_reader', t);
    IF rls THEN
      EXECUTE format('CREATE POLICY gym_export_select ON public.%I
        FOR SELECT TO gym_export_reader USING (true)', t);
    END IF;
  END LOOP;
END
$scope$;

CREATE SCHEMA gym_export_scope;
REVOKE ALL ON SCHEMA gym_export_scope FROM PUBLIC;
CREATE TABLE gym_export_scope.approved_staff (id uuid PRIMARY KEY);
-- Insert the individually approved UUIDs here in the protected operator session.
DO $roster$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gym_export_scope.approved_staff) THEN
    RAISE EXCEPTION 'Approved staff roster required';
  END IF;
END
$roster$;

CREATE VIEW gym_export_scope.staff WITH (security_barrier = true) AS
SELECT u.id, u.email, u.email_confirmed_at, u.banned_until, u.deleted_at,
       p.role AS source_role
FROM gym_export_scope.approved_staff approved
JOIN auth.users u ON u.id = approved.id
JOIN public.profiles p ON p.id = approved.id
WHERE p.role IS NOT NULL;

CREATE VIEW gym_export_scope.storage_buckets WITH (security_barrier = true) AS
SELECT id, public FROM storage.buckets WHERE id = 'gym-media';

CREATE VIEW gym_export_scope.storage_objects WITH (security_barrier = true) AS
SELECT bucket_id, name, metadata->>'size' AS bytes,
       metadata->>'mimetype' AS mime, metadata->>'eTag' AS etag, updated_at
FROM storage.objects WHERE bucket_id = 'gym-media';

GRANT USAGE ON SCHEMA gym_export_scope TO gym_export_reader;
GRANT SELECT ON gym_export_scope.staff, gym_export_scope.storage_buckets,
               gym_export_scope.storage_objects TO gym_export_reader;
COMMIT;
```

The views use their owner's access to the underlying tables, including the owner's effective RLS policies. The export login needs neither `USAGE` on `auth` or `storage` nor direct access to either schema's tables. The provisioning owner must be authorized to create the views and read the exact projected fields. If managed schema permissions or owner-side RLS prevent complete projections, use a separately approved operator-side restricted projection. Do not grant the login access to Auth base tables or a bypass role. [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)

## 2. Verify effective privileges and coverage before enabling the login

Run as the authorized operator after provisioning. The effective read inventory must match the exact approved tables and the three views. Any unexpected object, write access, role membership, ownership or callable privileged function blocks activation. PostgreSQL may expose ordinary system catalog metadata through public grants.

```sql
BEGIN READ ONLY;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
       rolbypassrls, pg_has_role(rolname, 'pg_read_all_data', 'MEMBER') AS global_read
FROM pg_roles WHERE rolname IN ('gym_export_login', 'gym_export_reader');

SELECT rolname FROM pg_roles
WHERE rolname <> 'gym_export_login'
  AND pg_has_role('gym_export_login', oid, 'MEMBER');
-- Expected membership is gym_export_reader only.

SELECT has_database_privilege('gym_export_login', 'postgres', 'CONNECT') AS can_connect,
       has_database_privilege('gym_export_login', 'postgres', 'CREATE') AS can_create_schema,
       has_schema_privilege('gym_export_login', 'public', 'CREATE') AS can_create_public,
       has_any_column_privilege('gym_export_login', 'auth.users', 'SELECT') AS reads_auth_base,
       has_any_column_privilege('gym_export_login', 'storage.objects', 'SELECT') AS reads_storage_base;
-- Expected true, false, false, false, false.

SELECT n.nspname, c.relname,
       has_any_column_privilege('gym_export_login', c.oid, 'SELECT') AS can_read,
       has_table_privilege('gym_export_login', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER')
         OR has_any_column_privilege('gym_export_login', c.oid, 'INSERT, UPDATE') AS can_write
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND (has_any_column_privilege('gym_export_login', c.oid, 'SELECT, INSERT, UPDATE')
       OR has_table_privilege('gym_export_login', c.oid, 'DELETE, TRUNCATE, TRIGGER'))
ORDER BY 1, 2;

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND has_schema_privilege('gym_export_login', n.oid, 'USAGE')
  AND has_function_privilege('gym_export_login', p.oid, 'EXECUTE');
ROLLBACK;
```

As an authorized role that can assume the new login, compare protected independent owner counts and identifier sets with export-role results inside the same repeatable-read snapshot. Verify every approved table, exact staff roster coverage, the single bucket, and its complete object-key set, including root files. Existing restrictive policies may still filter rows. Stop on any mismatch. Never disable RLS. Whole-table `pg_dump` defaults to turning row security off and will fail on RLS-protected tables for this login. Use reviewed `psql \copy (SELECT ...) TO ...` projections or a reviewed `pg_dump --enable-row-security --inserts` for the exact whole-table list after proving completeness. The existing inventory script reads managed base tables and must be adapted to these views before use with this role. [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) · [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)

After separate activation approval, set the password privately using `psql`'s `\password gym_export_login`, set a finite `VALID UNTIL` for the approved window, and enable `LOGIN`. Configure the Windows service with `gym_export_login.akhbjjggcftyzlunrxwk` and the Dashboard-confirmed Session pooler. Keep the password in protected local storage.

```sql
-- Replace the placeholder with the approved expiry timestamp with an explicit UTC offset.
ALTER ROLE gym_export_login LOGIN VALID UNTIL 'APPROVED_EXPIRY_UTC';
```

## 3. Revoke and clean up after the export

After cleanup approval, disable the login, close its export sessions, and remove only the dedicated objects. Inspect dependencies before removal. Use the following in the project database.

```sql
ALTER ROLE gym_export_login NOLOGIN PASSWORD NULL;
REVOKE gym_export_reader FROM gym_export_login;
-- Close any remaining verified gym_export_login sessions before cleanup.
BEGIN;
DO $cleanup$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schemaname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'gym_export_select'
      AND roles = ARRAY['gym_export_reader']::name[]
  LOOP
    EXECUTE format('DROP POLICY gym_export_select ON %I.%I', t.schemaname, t.tablename);
  END LOOP;
END
$cleanup$;
DROP VIEW gym_export_scope.staff, gym_export_scope.storage_buckets, gym_export_scope.storage_objects;
DROP TABLE gym_export_scope.approved_staff;
DROP SCHEMA gym_export_scope;
-- Verify both roles own no objects before running DROP OWNED, which revokes their remaining grants.
DROP OWNED BY gym_export_login, gym_export_reader RESTRICT;
DROP ROLE gym_export_login, gym_export_reader;
COMMIT;
```

Remove the local service password and any dedicated Storage session credentials. Preserve the verified encrypted export and its sign-off separately.
