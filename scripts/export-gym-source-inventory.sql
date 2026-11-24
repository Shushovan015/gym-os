\set ON_ERROR_STOP on
\if :{?approved_export}
\else
  \echo 'Run from the approved private export directory with -v approved_export=on.'
  \quit
\endif

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';

\copy (SELECT transaction_timestamp() AS snapshot_utc, table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name) TO 'public-tables.csv' CSV HEADER
\copy (SELECT u.id, u.email, u.email_confirmed_at, u.banned_until, u.deleted_at, p.role AS source_role FROM auth.users AS u INNER JOIN public.profiles AS p ON p.id = u.id WHERE p.role IS NOT NULL ORDER BY u.id) TO 'staff-identities.csv' CSV HEADER
\copy (SELECT id, public FROM storage.buckets ORDER BY id) TO 'storage-buckets.csv' CSV HEADER
\copy (SELECT bucket_id, name, metadata->>'size' AS bytes, metadata->>'mimetype' AS mime, metadata->>'eTag' AS etag, updated_at FROM storage.objects ORDER BY bucket_id, name) TO 'storage-objects.csv' CSV HEADER

ROLLBACK;
