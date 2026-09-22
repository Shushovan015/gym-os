-- Preserve the current catalog prices and invoice numbers.
alter table public.shop_items add column wholesale_price_minor bigint;
update public.shop_items set wholesale_price_minor = selling_price_minor;
alter table public.shop_items alter column wholesale_price_minor set not null;
alter table public.shop_items add constraint shop_items_wholesale_price_check
  check (wholesale_price_minor between 0 and 9007199254740991);

alter table public.inventory_product_variants add column wholesale_price_minor bigint;
-- Existing variant selling overrides become the initial wholesale overrides.
update public.inventory_product_variants set wholesale_price_minor = selling_price_minor;
alter table public.inventory_product_variants add constraint variants_wholesale_price_check
  check (wholesale_price_minor is null or wholesale_price_minor between 0 and 9007199254740991);

-- Existing catalog editors that do not know wholesale pricing retain their behavior.
create function public.default_inventory_wholesale() returns trigger language plpgsql
set search_path=public as $$
begin
  if new.wholesale_price_minor is null then new.wholesale_price_minor := new.selling_price_minor; end if;
  return new;
end $$;
create trigger shop_items_default_wholesale before insert on public.shop_items
for each row execute function public.default_inventory_wholesale();

alter table public.shop_items add constraint shop_items_safe_prices
  check (cost_price_minor between 0 and 9007199254740991 and selling_price_minor between 0 and 9007199254740991) not valid;
alter table public.inventory_product_variants add constraint variants_safe_prices
  check ((cost_price_minor is null or cost_price_minor between 0 and 9007199254740991)
    and (selling_price_minor is null or selling_price_minor between 0 and 9007199254740991)) not valid;

alter table public.invoice_items add column customer_type text;
update public.invoice_items set customer_type='general' where item_type='product';
create function public.default_invoice_customer_type() returns trigger language plpgsql
set search_path=public as $$
begin
  if new.item_type='product' and new.customer_type is null then new.customer_type := 'general'; end if;
  return new;
end $$;
create trigger invoice_items_default_customer_type before insert on public.invoice_items
for each row execute function public.default_invoice_customer_type();
alter table public.invoice_items add constraint invoice_items_customer_type_check check (
  (item_type='product' and customer_type is not null and customer_type in ('general','wholesale'))
  or (item_type<>'product' and customer_type is null)
);
comment on column public.invoice_items.customer_type is 'Customer pricing category saved with the unit_price_minor snapshot; catalog edits never reprice existing lines.';

-- Manual and automatic numbers share the existing invoice_number namespace.
-- Serialize reservations; also compare case-insensitively without rewriting legacy values.
create function public.validate_bill_number() returns trigger language plpgsql security definer
set search_path=public as $$
begin
  if tg_op='UPDATE' then
    if new.invoice_number is not distinct from old.invoice_number then return new; end if;
    if old.invoice_number is not null then raise exception 'An assigned bill number cannot be changed'; end if;
  end if;
  new.invoice_number := nullif(btrim(new.invoice_number),'');
  if new.invoice_number is null then return new; end if;
  if new.invoice_number !~ '^[A-Za-z0-9/_-]{1,64}$' then
    raise exception 'Bill number must contain 1-64 letters, numbers, hyphens, underscores or slashes';
  end if;
  perform pg_advisory_xact_lock(20260922,2);
  if exists(select 1 from public.invoices where lower(btrim(invoice_number))=lower(new.invoice_number) and id<>new.id) then
    raise exception 'This bill number is already used' using errcode='23505';
  end if;
  return new;
end $$;
create trigger invoices_validate_bill_number before insert or update of invoice_number on public.invoices
for each row execute function public.validate_bill_number();

CREATE OR REPLACE FUNCTION "public"."finalize_invoice"("p_invoice_id" bigint, "p_payment_amount_minor" bigint DEFAULT 0, "p_payment_method" "text" DEFAULT 'cash'::"text", "p_payment_reference" "text" DEFAULT NULL::"text") RETURNS "public"."invoices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_invoice public.invoices; v_item record; v_variant public.inventory_product_variants; v_subtotal bigint; v_tax bigint; v_total bigint; v_seq bigint; v_prefix text; v_allow_negative boolean; v_last_item_id bigint; v_number text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  perform pg_advisory_xact_lock(20260922,2);
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
  v_number := v_invoice.invoice_number;
  if v_number is null then
    loop
      insert into public.invoice_number_sequences(sequence_year,last_number) values(extract(year from v_invoice.billing_date)::int,1)
      on conflict(sequence_year) do update set last_number=public.invoice_number_sequences.last_number+1,updated_at=now() returning last_number into v_seq;
      v_number := v_prefix||'-'||extract(year from v_invoice.billing_date)::int||'-'||lpad(v_seq::text,greatest(6,length(v_seq::text)),'0');
      exit when not exists(select 1 from public.invoices where lower(btrim(invoice_number))=lower(v_number));
    end loop;
  end if;
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
  update public.invoices set invoice_number=v_number,invoice_status='issued',subtotal_minor=v_subtotal,tax_minor=v_tax,total_minor=v_total,balance_minor=v_total,inventory_applied_at=now(),updated_by=auth.uid() where id=p_invoice_id;
  if p_payment_amount_minor > 0 then
    if p_payment_method not in ('cash','card','bank_transfer','digital_wallet','other') then raise exception 'Invalid payment method'; end if;
    insert into public.invoice_payments(invoice_id,amount_minor,payment_method,reference) values(p_invoice_id,p_payment_amount_minor,p_payment_method,p_payment_reference);
  end if;
  perform public.recalculate_invoice_payment_state(p_invoice_id);
  update public.members m set payment_status=case when i.payment_status='paid' then 'paid' else 'unpaid' end,payment_due_date=case when i.payment_status='paid' then null else i.due_date end
  from public.invoices i where i.id=p_invoice_id and i.member_ref=m.id and exists(select 1 from public.invoice_items x where x.invoice_id=i.id and x.item_type='membership');
  select * into v_invoice from public.invoices where id=p_invoice_id; return v_invoice;
end $$;
