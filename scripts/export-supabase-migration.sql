\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';

DO $$
BEGIN
    IF current_database() <> 'gym_supabase_migration'
       OR (inet_server_addr() IS NOT NULL AND inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)) THEN
        RAISE EXCEPTION 'Use a local restored PostgreSQL database named gym_supabase_migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(ARRAY['public.members', 'public.invoices', 'public.invoice_payments',
            'public.attendance_records', 'public.shop_items', 'public.inventory_product_variants',
            'public.profiles', 'auth.users']) AS required(name)
        WHERE to_regclass(required.name) IS NULL
    ) THEN
        RAISE EXCEPTION 'The restored source is missing one or more core gym tables.';
    END IF;
END;
$$;

SELECT jsonb_build_object('kind', 'format', 'version', 1);

-- The allowlist excludes extensions, credentials, API keys, Auth tokens and sessions.
WITH export_names(name) AS (VALUES
    ('admin_settings'), ('attendance_holidays'), ('attendance_holiday_templates'), ('attendance_records'),
    ('contact_content'), ('contact_faqs'), ('facilities_page_content'), ('facility_items'), ('footer_content'),
    ('home_content'), ('home_maximus_points'), ('home_status_items'), ('import_logs'), ('inventory_product_variants'),
    ('inventory_suppliers'), ('invoice_email_deliveries'), ('invoice_items'), ('invoice_number_sequences'),
    ('invoice_payments'), ('invoices'), ('member_measurements'), ('member_report_logs'), ('member_status_history'),
    ('member_transformations'), ('members'), ('membership_fees'), ('membership_payment_allocations'),
    ('personal_training_plans'), ('pricing_items'), ('pricing_page_content'), ('profiles'), ('shop_items'),
    ('shop_page_content'), ('stock_movements'), ('testimonials'), ('trainer_page_content'), ('trainers')
)
SELECT CASE WHEN to_regclass(format('public.%I', name)) IS NULL
    THEN format('SELECT jsonb_build_object(''kind'', ''missing'', ''table'', %L)', name)
    ELSE format(
        'SELECT jsonb_build_object(''kind'', ''count'', ''table'', %1$L, ''records'', COUNT(*)::text) FROM public.%2$I;
         SELECT jsonb_build_object(''kind'', ''record'', ''table'', %1$L, ''row'', (
           SELECT jsonb_object_agg(key, CASE WHEN jsonb_typeof(value) = ''number'' THEN to_jsonb(value #>> ''{}'') ELSE value END)
           FROM jsonb_each(to_jsonb(record)))) FROM public.%2$I AS record',
        name, name
    )
END
FROM export_names ORDER BY name
\gexec

SELECT jsonb_build_object('kind', 'count', 'table', 'auth_identities', 'records', COUNT(*)::text) FROM auth.users;
SELECT jsonb_build_object('kind', 'record', 'table', 'auth_identities', 'row', jsonb_build_object(
    'id', u.id, 'email', u.email, 'email_confirmed_at', to_jsonb(u)->'email_confirmed_at',
    'banned_until', to_jsonb(u)->'banned_until', 'deleted_at', to_jsonb(u)->'deleted_at'))
FROM auth.users u;

SELECT CASE WHEN to_regclass('storage.objects') IS NULL
    THEN 'SELECT jsonb_build_object(''kind'', ''missing'', ''table'', ''storage_objects'')'
    ELSE 'SELECT jsonb_build_object(''kind'', ''count'', ''table'', ''storage_objects'', ''records'', COUNT(*)::text) FROM storage.objects;
          SELECT jsonb_build_object(''kind'', ''record'', ''table'', ''storage_objects'', ''row'',
                jsonb_build_object(''bucket_id'', bucket_id, ''name'', name, ''metadata'', metadata))
          FROM storage.objects'
END
\gexec

SELECT jsonb_build_object('kind', 'end', 'version', 1);
ROLLBACK;
