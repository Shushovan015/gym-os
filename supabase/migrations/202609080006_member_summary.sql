create or replace function public.admin_member_summary()
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
  'active', count(*) filter (where deleted_at is null and membership_status='active' and (end_date is null or end_date >= (timezone('Asia/Kathmandu',now()))::date)),
  'payment_follow_up', count(*) filter (where deleted_at is null and payment_status<>'paid'),
  'deleted', count(*) filter (where deleted_at is not null)
) from public.members;
$$;
revoke all on function public.admin_member_summary() from public;
grant execute on function public.admin_member_summary() to authenticated;
