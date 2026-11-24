-- Proposal A. Execute only after separate production approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
REVOKE ALL PRIVILEGES ON TABLE public.shop_items, public.shop_page_content,
  public.facilities_page_content, public.pricing_page_content FROM anon RESTRICT;
GRANT SELECT ON TABLE public.shop_items, public.shop_page_content,
  public.facilities_page_content, public.pricing_page_content TO anon;
DO $verify$
DECLARE
  relation regclass;
BEGIN
  FOREACH relation IN ARRAY ARRAY[
    'public.shop_items'::regclass, 'public.shop_page_content'::regclass,
    'public.facilities_page_content'::regclass, 'public.pricing_page_content'::regclass
  ] LOOP
    IF NOT has_table_privilege('anon', relation, 'SELECT')
      OR has_table_privilege('anon', relation, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      OR has_any_column_privilege('anon', relation, 'INSERT, UPDATE, REFERENCES')
    THEN
      RAISE EXCEPTION 'Unexpected effective anon privileges on %; rolling back', relation;
    END IF;
    IF current_setting('server_version_num')::integer >= 170000 THEN
      IF has_table_privilege('anon', relation, 'MAINTAIN') THEN
        RAISE EXCEPTION 'Unexpected effective anon maintenance privilege on %; rolling back', relation;
      END IF;
    END IF;
  END LOOP;
END;
$verify$;
COMMIT;
