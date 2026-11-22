-- Run only in a disposable clone.
\set ON_ERROR_STOP on
begin;

do $$
declare
  member_ref_id bigint;
  latest_id bigint;
begin
  if current_database() not like 'gym_attendance_test_%' then
    raise exception 'Disposable attendance test database required';
  end if;
  insert into public.admin_settings (id) values (1) on conflict (id) do nothing;
  insert into public.members (member_id, full_name, phone, membership_type,
    membership_status, payment_status, start_date, last_visit_date, is_active)
  values ('AUDIT-LAST-VISIT', 'Audit attendance', '0000000000', 'monthly',
    'active', 'unpaid', '2026-11-01', '2026-11-01', true)
  returning id into member_ref_id;

  insert into public.attendance_records (member_ref, attendance_date, status)
  values (member_ref_id, '2026-11-10', 'present') returning id into latest_id;
  insert into public.attendance_records (member_ref, attendance_date, status)
  values (member_ref_id, '2026-11-05', 'late'), (member_ref_id, '2026-11-15', 'absent');
  if (select last_visit_date from public.members where id = member_ref_id) is distinct from date '2026-11-10' then
    raise exception 'A historical or absent entry replaced the latest visit';
  end if;

  update public.attendance_records set deleted_at = now() where id = latest_id;
  if (select last_visit_date from public.members where id = member_ref_id) is distinct from date '2026-11-05' then
    raise exception 'Removing the latest visit did not fall back to the prior visit';
  end if;
  update public.attendance_records set deleted_at = null where id = latest_id;
  if (select last_visit_date from public.members where id = member_ref_id) is distinct from date '2026-11-10' then
    raise exception 'Restoring an attendance entry did not restore last visit';
  end if;
  update public.members set last_visit_date = null where id = member_ref_id;
  if (select last_visit_date from public.members where id = member_ref_id) is distinct from date '2026-11-10' then
    raise exception 'Editing a member erased the latest recorded visit';
  end if;

  update public.members set last_visit_date = '2026-11-12' where id = member_ref_id;
  delete from public.attendance_records where id = latest_id;
  if (select last_visit_date from public.members where id = member_ref_id) is distinct from date '2026-11-12' then
    raise exception 'Removing an older entry replaced a newer manually recorded visit';
  end if;
end;
$$;

rollback;
