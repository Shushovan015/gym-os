alter table public.import_logs add column if not exists imported_by uuid default auth.uid();

drop policy if exists import_logs_insert_admin on public.import_logs;
create policy import_logs_insert_admin on public.import_logs for insert to authenticated
  with check (public.is_admin() and imported_by = auth.uid());

create function public.import_legacy_bill(p_invoice jsonb, p_payment jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  member_row public.members%rowtype;
  legacy_id bigint := (p_invoice->>'legacy_bill_id')::bigint;
  invoice_id_value bigint;
  payment_added boolean := false;
  total bigint;
  paid bigint;
begin
  if actor is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_invoice is null then return jsonb_build_object('ready', true); end if;

  paid := (p_invoice->>'paid_minor')::bigint;
  total := paid + (p_invoice->>'balance_minor')::bigint;
  if legacy_id is null or legacy_id <= 0 or total is null or total < 0 or paid < 0 or paid > total
     or (p_payment is not null and (p_payment->>'amount_minor')::bigint is distinct from paid) then
    raise exception 'Invalid legacy bill data' using errcode = '22023';
  end if;

  select * into strict member_row
  from public.members
  where id = (p_invoice->>'member_ref')::bigint and legacy_source = 'legacy_mysql';

  -- Serialize retries for the same source bill without changing existing invoices.
  perform pg_advisory_xact_lock(hashtextextended('legacy_mysql:bill:' || legacy_id, 0));
  select id into invoice_id_value
  from public.invoices
  where legacy_source = 'legacy_mysql' and legacy_bill_id = legacy_id;
  if found then
    if not exists (
      select 1 from public.invoices where id = invoice_id_value and member_ref = member_row.id
    ) then
      raise exception 'Legacy bill already belongs to a different member';
    end if;
    return jsonb_build_object('invoice_added', false, 'payment_added', false);
  end if;
    insert into public.invoices (
      member_ref, customer_name, customer_phone, customer_email, billing_date, due_date,
      invoice_status, payment_status, currency_code, subtotal_minor, total_minor, paid_minor,
      balance_minor, notes, legacy_bill_id, legacy_source, created_by, updated_by
    ) values (
      member_row.id, member_row.full_name, member_row.phone, member_row.email,
      (p_invoice->>'billing_date')::date, (p_invoice->>'due_date')::date,
      'issued', case when paid = total then 'paid' when paid > 0 then 'partially_paid' else 'unpaid' end,
      'NPR', total, total, paid, total - paid, p_invoice->>'notes',
      legacy_id, 'legacy_mysql', actor, actor
    ) returning id into invoice_id_value;
    if p_payment is not null and paid > 0 then
      insert into public.invoice_payments (
        invoice_id, amount_minor, payment_method, payment_date, reference, notes,
        legacy_bill_id, legacy_source, received_by
      ) values (
        invoice_id_value, paid, 'cash', (p_payment->>'payment_date')::date,
        p_payment->>'reference', p_payment->>'notes', legacy_id, 'legacy_mysql', actor
      );
      payment_added := true;
    end if;
    return jsonb_build_object('invoice_added', true, 'payment_added', payment_added);
end;
$$;

revoke all on function public.import_legacy_bill(jsonb, jsonb) from public, anon;
grant execute on function public.import_legacy_bill(jsonb, jsonb) to authenticated;
