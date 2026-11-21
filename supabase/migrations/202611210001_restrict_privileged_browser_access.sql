-- Account roles are assigned through trusted database administration.
drop policy if exists profiles_update_own on public.profiles;
revoke update on table public.profiles from public, anon, authenticated;

-- These helpers are called by owner-executed trigger functions and maintenance.
revoke execute on function public.initialize_membership_fees(bigint)
  from public, anon, authenticated;
revoke execute on function public.sync_member_fee_state(bigint)
  from public, anon, authenticated;

-- These queries must respect the caller's members and membership_fees policies.
alter function public.get_membership_fee_summary(bigint) security invoker;
alter function public.get_member_membership_fee_status(bigint) security invoker;
revoke execute on function public.get_membership_fee_summary(bigint)
  from public, anon;
revoke execute on function public.get_member_membership_fee_status(bigint)
  from public, anon;
