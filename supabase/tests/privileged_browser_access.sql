do $$
declare
  browser_role name;
begin
  foreach browser_role in array array['anon', 'authenticated']::name[] loop
    if has_any_column_privilege(browser_role, 'public.profiles', 'UPDATE') then
      raise exception '% must not be able to update profiles', browser_role;
    end if;
    if has_function_privilege(browser_role, 'public.initialize_membership_fees(bigint)', 'EXECUTE')
       or has_function_privilege(browser_role, 'public.sync_member_fee_state(bigint)', 'EXECUTE') then
      raise exception '% must not be able to invoke internal membership fee helpers', browser_role;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.get_membership_fee_summary(bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_member_membership_fee_status(bigint)', 'EXECUTE') then
    raise exception 'Anonymous users must not be able to query member fees';
  end if;
  if exists (
    select 1 from pg_proc
    where oid in ('public.get_membership_fee_summary(bigint)'::regprocedure,
                  'public.get_member_membership_fee_status(bigint)'::regprocedure)
      and prosecdef
  ) then
    raise exception 'Member fee reads must respect the caller''s row-level security';
  end if;
end
$$;
