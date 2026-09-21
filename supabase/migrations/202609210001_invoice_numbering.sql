-- Preserve historical numbers. Future numbers never reset by year or prefix.
alter table public.admin_settings
  add column invoice_start_number bigint not null default 1 check (invoice_start_number between 1 and 9007199254740991),
  add column bill_sender_email text;
create sequence public.invoice_serial_seq as bigint minvalue 1 maxvalue 9007199254740991 no cycle;
revoke all on sequence public.invoice_serial_seq from public, anon, authenticated;

do $$
declare first_number bigint;
begin
  select greatest(coalesce((select max(last_number) from public.invoice_number_sequences),0),
    coalesce((select max(substring(invoice_number from '([0-9]+)$')::bigint) from public.invoices),0))+1 into first_number;
  perform setval('public.invoice_serial_seq',first_number,false);
  update public.admin_settings set invoice_start_number=first_number where id=1;
end $$;

create function public.configure_invoice_start() returns trigger
language plpgsql security definer set search_path=public as $$
declare last_value_used bigint; allocated boolean;
begin
  if tg_op = 'INSERT' or new.invoice_start_number is distinct from old.invoice_start_number then
    perform pg_advisory_xact_lock(70921001);
    select last_value,is_called into last_value_used,allocated from public.invoice_serial_seq;
    if allocated then raise exception 'Starting invoice number cannot change after an invoice has been issued'; end if;
    if new.invoice_start_number < last_value_used then raise exception 'Starting invoice number cannot move backwards'; end if;
    perform setval('public.invoice_serial_seq',new.invoice_start_number,false);
  end if;
  return new;
end $$;
create trigger configure_invoice_start before insert or update on public.admin_settings
for each row execute function public.configure_invoice_start();

create function public.assign_invoice_number() returns trigger
language plpgsql security definer set search_path=public as $$
declare serial bigint; prefix text;
begin
  if tg_op = 'DELETE' then
    if old.invoice_number is not null then raise exception 'Numbered invoices must be cancelled, not deleted'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.invoice_number is not null then
    if new.invoice_number is distinct from old.invoice_number or new.invoice_status = 'draft' then
      raise exception 'Issued invoice numbers are permanent';
    end if;
    return new;
  end if;
  if new.invoice_status = 'issued' then
    perform pg_advisory_xact_lock(70921001);
    serial := nextval('public.invoice_serial_seq');
    select invoice_prefix into prefix from public.admin_settings where id=1;
    if prefix is null then raise exception 'Configure gym settings before issuing invoices'; end if;
    new.invoice_number := prefix || '-' || extract(year from new.billing_date)::int || '-' || lpad(serial::text,greatest(6,length(serial::text)),'0');
  elsif new.invoice_number is not null then
    raise exception 'Invoice numbers are assigned only when issuing a bill';
  end if;
  return new;
end $$;
create trigger assign_invoice_number before insert or update or delete on public.invoices
for each row execute function public.assign_invoice_number();
revoke all on function public.configure_invoice_start() from public, anon, authenticated;
revoke all on function public.assign_invoice_number() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint DEFAULT 0, "p_payment_method" "text" DEFAULT 'cash'::"text", "p_payment_reference" "text" DEFAULT NULL::"text") RETURNS "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice public.invoices; v_item record; v_variant public.inventory_product_variants; v_subtotal bigint; v_tax bigint; v_total bigint; v_seq bigint; v_prefix text; v_allow_negative boolean; v_last_item_id bigint;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.invoice_status <> 'draft' then raise exception 'Only draft invoices can be issued'; end if;
  select coalesce(sum(round(quantity * unit_price_minor)),0)::bigint into v_subtotal from public.invoice_items where invoice_id=p_invoice_id;
  if not exists(select 1 from public.invoice_items where invoice_id=p_invoice_id) then raise exception 'Invoice must contain at least one item'; end if;
  if v_invoice.discount_minor > v_subtotal then raise exception 'Discount exceeds invoice subtotal'; end if;
  v_tax := case when v_invoice.tax_enabled then round(((v_subtotal-v_invoice.discount_minor)::numeric*v_invoice.tax_rate_basis_points)/10000)::bigint else 0 end;
  v_total := v_subtotal - v_invoice.discount_minor + v_tax;
  if v_total < 0 then raise exception 'Discount exceeds invoice subtotal'; end if;
  if p_payment_amount_minor < 0 or p_payment_amount_minor > v_total then raise exception 'Invalid payment amount'; end if;
  select invoice_prefix,allow_negative_stock into v_prefix,v_allow_negative from public.admin_settings where id=1;
  for v_item in select * from public.invoice_items where invoice_id=p_invoice_id and item_type='product' order by variant_id loop
    select * into v_variant from public.inventory_product_variants where id=v_item.variant_id for update;
    if not found or not v_variant.is_active then raise exception 'Product variant is unavailable'; end if;
    if not coalesce(v_allow_negative,false) and v_variant.current_quantity < v_item.quantity then raise exception 'Insufficient stock for %',v_item.description; end if;
    update public.inventory_product_variants set current_quantity=current_quantity-v_item.quantity where id=v_item.variant_id;
    insert into public.stock_movements(variant_id,movement_type,quantity_delta,previous_quantity,resulting_quantity,invoice_id,reference)
    values(v_item.variant_id,'sale',-v_item.quantity,v_variant.current_quantity,v_variant.current_quantity-v_item.quantity,p_invoice_id,'Invoice sale');
  end loop;
  update public.invoice_items set tax_minor=0,line_total_minor=round(quantity*unit_price_minor)::bigint-discount_minor where invoice_id=p_invoice_id;
  select id into v_last_item_id from public.invoice_items where invoice_id=p_invoice_id order by sort_order desc,id desc limit 1;
  update public.invoice_items set tax_minor=v_tax,line_total_minor=line_total_minor+v_tax where id=v_last_item_id;
  update public.invoices set invoice_status='issued',subtotal_minor=v_subtotal,tax_minor=v_tax,total_minor=v_total,balance_minor=v_total,inventory_applied_at=now(),updated_by=auth.uid() where id=p_invoice_id;
  if p_payment_amount_minor > 0 then
    if p_payment_method not in ('cash','card','bank_transfer','digital_wallet','other') then raise exception 'Invalid payment method'; end if;
    insert into public.invoice_payments(invoice_id,amount_minor,payment_method,reference) values(p_invoice_id,p_payment_amount_minor,p_payment_method,p_payment_reference);
  end if;
  perform public.recalculate_invoice_payment_state(p_invoice_id);
  update public.members m set payment_status=case when i.payment_status='paid' then 'paid' else 'unpaid' end,payment_due_date=case when i.payment_status='paid' then null else i.due_date end
  from public.invoices i where i.id=p_invoice_id and i.member_ref=m.id and exists(select 1 from public.invoice_items x where x.invoice_id=i.id and x.item_type='membership');
  select * into v_invoice from public.invoices where id=p_invoice_id; return v_invoice;
end $$;
