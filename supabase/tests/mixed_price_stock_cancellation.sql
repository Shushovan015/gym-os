-- Run in a disposable clone with the app migrations applied.
\set ON_ERROR_STOP on
begin;

do $$
declare
  actor constant uuid := '00000000-0000-4000-8000-000000000843';
  product_ref bigint;
  variant_ref bigint;
  bill_ref bigint;
begin
  if current_database() not like 'gym_inventory_test_%' then
    raise exception 'Disposable inventory test database required';
  end if;

  insert into auth.users (id, email) values (actor, 'inventory-audit@example.invalid');
  update public.profiles set role = 'admin' where id = actor;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.admin_settings (id) values (1) on conflict (id) do nothing;

  insert into public.shop_items (title, category, inventory_enabled)
  values ('Audit product', 'drinks', true) returning id into product_ref;
  insert into public.inventory_product_variants (product_id, sku, current_quantity)
  values (product_ref, 'AUDIT-MIXED-PRICE', 10) returning id into variant_ref;
  insert into public.invoices (customer_name) values ('Audit walk-in') returning id into bill_ref;
  insert into public.invoice_items (
    invoice_id, product_id, variant_id, item_type, description, quantity,
    unit_price_minor, line_total_minor, customer_type
  ) values
    (bill_ref, product_ref, variant_ref, 'product', 'Audit product', 2, 10000, 20000, 'general'),
    (bill_ref, product_ref, variant_ref, 'product', 'Audit product', 3, 8000, 24000, 'wholesale');

  perform public.finalize_invoice(bill_ref, 44000, 'cash');
  if (select current_quantity from public.inventory_product_variants where id = variant_ref) <> 5 then
    raise exception 'Invoice did not subtract both sale lines';
  end if;
  perform public.cancel_invoice(bill_ref, 'Audit cancellation');
  perform public.cancel_invoice(bill_ref, 'Retried cancellation');
  if (select current_quantity from public.inventory_product_variants where id = variant_ref) <> 10 then
    raise exception 'Cancellation did not return the full quantity exactly once';
  end if;
  if (select count(*) from public.invoice_payments where invoice_id = bill_ref) <> 1 then
    raise exception 'Cancellation changed payment history';
  end if;
end;
$$;

rollback;
