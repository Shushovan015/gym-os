-- One-off repair for missing membership fee rows.
--
-- Run this in the SQL Editor of the SAME database your app is connected to.
--
-- Important: Vite loads .env.local after .env, so `.env.local` wins.
--   .env        -> https://<your-project>.supabase.co  (hosted)
--   .env.local  -> http://127.0.0.1:54321               (local Supabase)
-- If you ran migrations against the hosted project but the app is using the
-- local URL (or the other way round), the repair never reaches the app.
--
-- This script is idempotent and safe to re-run.

begin;

-- 0. Allow authenticated admins to query membership_fees directly.
--    Without these policies the table (RLS enabled, no policies) returns zero
--    rows to the client, which is why the "Collect Membership Fee" screen said
--    "No unpaid membership fees" even when unpaid rows existed.
alter table public.membership_fees enable row level security;

drop policy if exists "membership_fees_select_admin" on public.membership_fees;
create policy "membership_fees_select_admin" on public.membership_fees
  for select to authenticated using (public.is_admin());

drop policy if exists "membership_fees_insert_admin" on public.membership_fees;
create policy "membership_fees_insert_admin" on public.membership_fees
  for insert to authenticated with check (public.is_admin());

drop policy if exists "membership_fees_update_admin" on public.membership_fees;
create policy "membership_fees_update_admin" on public.membership_fees
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "membership_fees_delete_admin" on public.membership_fees;
create policy "membership_fees_delete_admin" on public.membership_fees
  for delete to authenticated using (public.is_admin());

-- Keep members.payment_due_date / payment_status aligned with fee rows.
create or replace function public.sync_member_fee_state(p_member_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_next_due date;
  v_has_outstanding boolean;
  v_has_overdue boolean;
begin
  select
    min(due_date) filter (where status in ('unpaid', 'overdue', 'partial')),
    coalesce(bool_or(status in ('unpaid', 'overdue', 'partial')), false),
    coalesce(bool_or(status = 'overdue'), false)
  into v_next_due, v_has_outstanding, v_has_overdue
  from public.membership_fees
  where member_id = p_member_id;

  update public.members
  set payment_due_date = v_next_due,
      payment_status = case
        when v_has_overdue then 'overdue'
        when v_has_outstanding then 'unpaid'
        else 'paid'
      end,
      updated_at = now()
  where id = p_member_id;
end $$;

-- 1. Activate members that were imported / never deliberately deactivated.
update public.members
set is_active = true,
    activated_at = coalesce(activated_at, now()),
    updated_at = now()
where deleted_at is null
  and is_active = false
  and deactivated_at is null
  and membership_status <> 'cancelled';

-- 2. Create every missing monthly fee row for active members.
do $$
declare
  v_member record;
begin
  for v_member in
    select id from public.members
    where deleted_at is null and is_active = true
  loop
    perform public.initialize_membership_fees(v_member.id);
  end loop;
end $$;

-- 3. Mark past-due periods as overdue.
update public.membership_fees
set status = 'overdue',
    updated_at = now()
where status in ('unpaid', 'partial')
  and due_date < public.get_nepal_today_ad();

-- 4. Refresh every member's payment status and payment due date.
do $$
declare
  v_member record;
begin
  for v_member in
    select id from public.members
    where deleted_at is null and is_active = true
  loop
    perform public.sync_member_fee_state(v_member.id);
  end loop;
end $$;

commit;

-- Verification: one row per member with their fee counts.
select
  m.member_id,
  m.full_name,
  m.is_active,
  m.payment_status,
  m.payment_due_date,
  count(f.id) as fee_rows,
  count(*) filter (where f.status in ('unpaid', 'overdue', 'partial')) as outstanding_rows
from public.members m
left join public.membership_fees f on f.member_id = m.id
where m.deleted_at is null
group by m.id
order by outstanding_rows desc, m.member_id
limit 50;
