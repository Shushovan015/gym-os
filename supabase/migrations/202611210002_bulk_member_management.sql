create function public.apply_all_member_action(p_action text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  member_id bigint;
  target_active boolean;
  affected integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  case p_action
    when 'activate' then target_active := true;
    when 'deactivate' then target_active := false;
    when 'delete' then
      update public.members
      set deleted_at = now()
      where deleted_at is null;
      get diagnostics affected = row_count;
      return affected;
    else raise exception 'Unknown bulk member action' using errcode = '22023';
  end case;

  for member_id in
    select m.id
    from public.members m
    where m.deleted_at is null and m.is_active is distinct from target_active
    order by m.id
    for update
  loop
    perform public.set_member_active_status(member_id, target_active, auth.uid(), 'Bulk member action');
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

revoke all on function public.apply_all_member_action(text) from public, anon;
grant execute on function public.apply_all_member_action(text) to authenticated;

create or replace function public.admin_member_summary()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'active', count(*) filter (where deleted_at is null and membership_status = 'active' and
      (end_date is null or end_date >= (timezone('Asia/Kathmandu', now()))::date)),
    'enabled', count(*) filter (where deleted_at is null and is_active),
    'payment_follow_up', count(*) filter (where deleted_at is null and payment_status <> 'paid'),
    'deleted', count(*) filter (where deleted_at is not null)
  )
  from public.members;
$$;
