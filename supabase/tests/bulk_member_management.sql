begin;

do $$
begin
  if has_function_privilege('anon', 'public.apply_all_member_action(text)', 'EXECUTE') then
    raise exception 'Anonymous users must not be able to invoke bulk member actions';
  end if;
end;
$$;

set local role authenticated;

do $$
begin
  perform public.apply_all_member_action('deactivate');
  raise exception 'A session without an administrator identity was allowed to deactivate members';
exception
  when insufficient_privilege then null;
end;
$$;

rollback;
