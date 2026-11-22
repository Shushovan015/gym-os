-- Keep the last-visit field used by Members and absence filters in step with
-- attended rows. A manually stored newer visit survives historical marks.
create function public.sync_member_visit_from_attendance()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  removed_visit boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.deleted_at is null and old.status in ('present', 'late') then
      if tg_op = 'DELETE' then
        removed_visit := true;
      else
        removed_visit := new.deleted_at is not null or new.status not in ('present', 'late')
          or old.member_ref is distinct from new.member_ref
          or old.attendance_date is distinct from new.attendance_date;
      end if;
      if removed_visit then
        perform 1 from public.members where id = old.member_ref for update;
        update public.members
        set last_visit_date = (
          select max(attendance_date) from public.attendance_records
          where member_ref = old.member_ref and deleted_at is null and status in ('present', 'late')
        )
        where id = old.member_ref and last_visit_date = old.attendance_date;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.deleted_at is null and new.status in ('present', 'late') then
      update public.members set last_visit_date = new.attendance_date
      where id = new.member_ref
        and (last_visit_date is null or last_visit_date < new.attendance_date);
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_member_visit_from_attendance() from public, anon, authenticated;
create trigger attendance_sync_member_visit
after insert or update of member_ref, attendance_date, status, deleted_at or delete
on public.attendance_records
for each row execute function public.sync_member_visit_from_attendance();

-- Profile edits and CSV imports can also write this field. Keep recorded
-- attendance as its lower bound while allowing a newer manually entered date.
create function public.keep_recorded_member_visit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.last_visit_date := greatest(new.last_visit_date, (
    select max(attendance_date)
    from public.attendance_records
    where member_ref = new.id and deleted_at is null and status in ('present', 'late')
  ));
  return new;
end;
$$;

revoke all on function public.keep_recorded_member_visit() from public, anon, authenticated;
create trigger member_keep_recorded_visit
before update of last_visit_date on public.members
for each row execute function public.keep_recorded_member_visit();

-- Advance stale dates only where actual attended rows provide newer evidence.
update public.members m
set last_visit_date = latest.attended_on
from (
  select member_ref, max(attendance_date) as attended_on
  from public.attendance_records
  where deleted_at is null and status in ('present', 'late')
  group by member_ref
) latest
where m.id = latest.member_ref
  and (m.last_visit_date is null or m.last_visit_date < latest.attended_on);
