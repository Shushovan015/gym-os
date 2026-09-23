-- Reuse the existing stored invoice number and non-cycling sequence.
-- Settings now express the NEXT bill number to use (not last-used).
-- Existing invoice numbers are never rewritten.
do $$
declare current_value bigint; allocated boolean; base_number bigint;
begin
  perform pg_advisory_xact_lock(70921001);
  select last_value,is_called into current_value,allocated from public.invoice_serial_seq;
  select invoice_start_number into base_number from public.admin_settings where id=1;
  if not allocated then
    if coalesce(base_number,1)>=9007199254740991 then raise exception 'Bill number range exhausted'; end if;
    perform setval('public.invoice_serial_seq',greatest(current_value,coalesce(base_number,1)),false);
  end if;
end $$;

create or replace function public.configure_invoice_start() returns trigger
language plpgsql security definer set search_path=public as $$
declare current_value bigint; allocated boolean; max_used bigint;
begin
  if tg_op='INSERT' and exists(select 1 from public.admin_settings where id=new.id) then return new; end if;
  if tg_op='INSERT' or new.invoice_start_number is distinct from old.invoice_start_number then
    perform pg_advisory_xact_lock(70921001);
    select last_value,is_called into current_value,allocated from public.invoice_serial_seq;
    if allocated then
      -- Get the maximum used bill number to provide a helpful error
      select coalesce(max(
        case when btrim(invoice_number) ~ '^[0-9]+$' then invoice_number::numeric end
      ), 0) into max_used from public.invoices;
      if new.invoice_start_number <= max_used then
        raise exception 'Bill number % has already been issued. The next available number is %.', new.invoice_start_number, max_used + 1;
      end if;
      if new.invoice_start_number < current_value then
        raise exception 'Bill number % has already been issued. The next available number is %.', new.invoice_start_number, current_value;
      end if;
    end if;
    if new.invoice_start_number<1 or new.invoice_start_number>=9007199254740991 then raise exception 'Enter a valid starting bill number'; end if;
    perform setval('public.invoice_serial_seq',new.invoice_start_number,false);
  end if;
  return new;
end $$;

-- Read-only preview: opening, cancelling or refreshing a form consumes no number.
create function public.next_bill_number() returns text
language plpgsql security definer set search_path=public as $$
declare candidate bigint; allocated boolean;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select last_value,is_called into candidate,allocated from public.invoice_serial_seq;
  if allocated then candidate:=candidate+1; end if;
  loop
    if candidate>9007199254740991 then raise exception 'Bill number range exhausted'; end if;
    exit when not exists(select 1 from public.invoices where
      case when btrim(invoice_number) ~ '^[0-9]+$' then invoice_number::numeric end = candidate);
    candidate:=candidate+1;
  end loop;
  return candidate::text;
end $$;
revoke all on function public.next_bill_number() from public,anon;
grant execute on function public.next_bill_number() to authenticated,service_role;

create or replace function public.assign_invoice_number() returns trigger
language plpgsql security definer set search_path=public as $$
declare candidate bigint; next_available bigint; allocated boolean; supplied text;
begin
  if tg_op='DELETE' then
    if old.invoice_number is not null then raise exception 'Numbered invoices must be cancelled, not deleted'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.invoice_number is not null then
    if new.invoice_number is distinct from old.invoice_number or
       (old.invoice_status<>'draft' and new.invoice_status='draft') then
      raise exception 'Issued invoice numbers are permanent';
    end if;
    return new;
  end if;
  if tg_op='UPDATE' and new.invoice_status<>'issued' and new.invoice_number is null then return new; end if;
  perform pg_advisory_xact_lock(20260922,2);
  perform pg_advisory_xact_lock(70921001);
  supplied:=nullif(btrim(new.invoice_number),'');
  if supplied is null then
    loop
      candidate:=nextval('public.invoice_serial_seq');
      exit when not exists(select 1 from public.invoices where
        case when btrim(invoice_number) ~ '^[0-9]+$' then invoice_number::numeric end = candidate);
    end loop;
  else
    if supplied !~ '^[0-9]{1,16}$' then raise exception 'Bill number must be a positive whole number'; end if;
    candidate:=supplied::bigint;
    if candidate<1 or candidate>9007199254740991 then raise exception 'Bill number is outside the supported range'; end if;
    if exists(select 1 from public.invoices where
      case when btrim(invoice_number) ~ '^[0-9]+$' then invoice_number::numeric end = candidate) then
      raise exception 'This bill number is already used' using errcode='23505';
    end if;
    select last_value,is_called into next_available,allocated from public.invoice_serial_seq;
    if allocated then next_available:=next_available+1; end if;
    if candidate<next_available then raise exception 'Bill number must be at least %; choose Use next number to refresh',next_available; end if;
    perform setval('public.invoice_serial_seq',candidate,true);
  end if;
  new.invoice_number:=candidate::text;
  return new;
end $$;
