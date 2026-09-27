-- Nepal date helper functions for database

CREATE OR REPLACE FUNCTION public.get_nepal_today_ad()
RETURNS date LANGUAGE sql STABLE AS $$
    SELECT timezone('Asia/Kathmandu', now())::date
$$;

GRANT EXECUTE ON FUNCTION public.get_nepal_today_ad() TO anon, authenticated, service_role;