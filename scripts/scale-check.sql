\set ON_ERROR_STOP on
begin;
insert into public.members (member_id, full_name, email, phone, membership_type, membership_status, start_date, end_date, payment_status)
select 'SCALE-' || g, 'Scale Test Member ' || g, 'scale-' || g || '@example.invalid', '+977-TEST-' || g, 'monthly', 'active', current_date - 1200, current_date + 30, 'paid'
from generate_series(1, 1500) g;

insert into public.attendance_records (member_ref, attendance_date, status)
select m.id, d::date, 'present'
from (select id from public.members where member_id like 'SCALE-%' order by id limit 400) m
cross join generate_series(current_date - 1094, current_date, interval '1 day') d;

insert into public.shop_items (title, category, sku, inventory_enabled, is_active)
select 'Scale Test Product ' || g, 'Performance test', 'SCALE-SKU-' || g, true, true from generate_series(1, 400) g;

analyze public.members;
analyze public.attendance_records;
analyze public.shop_items;
\timing on
select count(*) as generated_members from public.members where member_id like 'SCALE-%';
select count(*) as generated_attendance from public.attendance_records where member_ref in (select id from public.members where member_id like 'SCALE-%');
select count(*) as generated_inventory from public.shop_items where sku like 'SCALE-SKU-%';
explain (analyze, buffers) select id, member_ref, attendance_date, status from public.attendance_records where attendance_date between current_date - 30 and current_date and deleted_at is null order by attendance_date desc, id desc;
explain (analyze, buffers) select * from public.members where deleted_at is null order by updated_at desc, id desc limit 50;
rollback;
