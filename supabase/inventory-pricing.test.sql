-- Run only on a disposable schema clone after applying the pricing migration.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if current_database() not like 'gym_pricing_test_%' and current_database() not like 'gym_merge_test_%' then raise exception 'Disposable test database required'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000922',true);
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000922','pricing-test@example.invalid') on conflict(id) do nothing;
update public.profiles set role='admin' where id=auth.uid();
insert into public.admin_settings(id) select 1 where not exists(select 1 from public.admin_settings where id=1);
do $$
declare p bigint; v bigint; manual_id bigint; auto_id bigint; wholesale_id bigint; draft_id bigint; result public.invoices; serial bigint; reserved_number text;
begin
  insert into public.shop_items(title,category,cost_price_minor,selling_price_minor,wholesale_price_minor,inventory_enabled)
    values('Test protein','Test',500,1500,1000,true) returning id into p;
  insert into public.inventory_product_variants(product_id,sku,current_quantity) values(p,'TEST-PRICING',10) returning id into v;
  begin
    update public.shop_items set wholesale_price_minor=-1 where id=p;
    raise exception 'Negative wholesale price accepted';
  exception when check_violation then null; end;
  begin
    update public.inventory_product_variants set selling_price_minor=9007199254740992 where id=v;
    raise exception 'Unsafe price accepted';
  exception when check_violation then null; end;
  select last_value + case when is_called then 1 else 0 end into serial from public.invoice_serial_seq;
  reserved_number := 'GYM-2099-'||lpad(serial::text,6,'0');
  insert into public.invoices(customer_name,invoice_number,billing_date) values('Manual',' '||reserved_number||' ','2099-01-01') returning id into manual_id;
  insert into public.invoice_items(invoice_id,item_type,description,quantity,unit_price_minor,line_total_minor)
    values(manual_id,'miscellaneous','Test',1,2000,2000);
  result := public.finalize_invoice(manual_id,1000,'cash',null);
  if result.invoice_number<>reserved_number or result.payment_status<>'partially_paid' or result.balance_minor<>1000 then raise exception 'Manual number or payment regression'; end if;
  begin
    insert into public.invoices(customer_name,invoice_number) values('Duplicate',lower(reserved_number));
    raise exception 'Case-insensitive duplicate accepted';
  exception when unique_violation then null; end;
  insert into public.invoices(customer_name,billing_date) values('Automatic','2099-01-01') returning id into auto_id;
  insert into public.invoice_items(invoice_id,item_type,description,quantity,unit_price_minor,line_total_minor)
    values(auto_id,'miscellaneous','Test',1,2000,2000);
  result := public.finalize_invoice(auto_id);
  if result.invoice_number<>'GYM-2099-'||lpad((serial+1)::text,6,'0') then raise exception 'Automatic numbering did not skip reserved number'; end if;
  insert into public.invoices(customer_name,invoice_number) values('Wholesale','WHOLESALE-42') returning id into wholesale_id;
  insert into public.invoice_items(invoice_id,item_type,product_id,variant_id,description,quantity,unit_price_minor,line_total_minor,customer_type)
    values(wholesale_id,'product',p,v,'Test protein',2,1000,2000,'wholesale');
  update public.shop_items set wholesale_price_minor=3000,selling_price_minor=4000 where id=p;
  result := public.finalize_invoice(wholesale_id,2000,'cash',null);
  if result.total_minor<>2000 or result.payment_status<>'paid' then raise exception 'Catalog change repriced snapshot'; end if;
  if not exists(select 1 from public.invoice_items where invoice_id=wholesale_id and customer_type='wholesale' and unit_price_minor=1000) then raise exception 'Lost customer type or price'; end if;
  if (select current_quantity from public.inventory_product_variants where id=v)<>8 then raise exception 'Stock not deducted correctly'; end if;
  perform public.cancel_invoice(wholesale_id,'Test return');
  if (select current_quantity from public.inventory_product_variants where id=v)<>10 then raise exception 'Cancellation stock regression'; end if;
  begin
    insert into public.invoices(customer_name,invoice_number) values('Reuse cancelled','WHOLESALE-42');
    raise exception 'Cancelled number reused';
  exception when unique_violation then null; end;
  begin
    update public.invoices set invoice_number='CHANGED' where id=manual_id;
    raise exception 'Assigned number changed';
  exception when raise_exception then
    if sqlerrm not in ('An assigned bill number cannot be changed','Issued invoice numbers are permanent') then raise; end if;
  end;
  insert into public.invoices(customer_name) values('Invalid type') returning id into draft_id;
  begin
    insert into public.invoice_items(invoice_id,item_type,product_id,variant_id,description,quantity,unit_price_minor,line_total_minor,customer_type)
      values(draft_id,'product',p,v,'Test',1,1000,1000,'invalid');
    raise exception 'Invalid customer type accepted';
  exception when check_violation then null; end;
end $$;
rollback;
select 'Inventory pricing and bill number tests passed' as result;
