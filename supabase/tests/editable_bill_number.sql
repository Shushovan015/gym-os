-- Use a disposable schema clone with all migrations applied. Never production.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() not like 'gym_bill_number_test_%' then raise exception 'Disposable test database required'; end if;
end $$;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000923','bill-number-test@example.invalid') on conflict(id) do nothing;
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000923';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000923',false);
insert into public.admin_settings(id) select 1 where not exists(select 1 from public.admin_settings where id=1);
update public.admin_settings set invoice_start_number=1001 where id=1;

do $$
declare first_id bigint; edited_id bigint; bill public.invoices; rejected boolean; before_rollback text;
begin
  if public.next_bill_number()<>'1002' or public.next_bill_number()<>'1002' then raise exception 'Preview did not start at base + 1, or consumed a number'; end if;
  if (select is_called from public.invoice_serial_seq) then raise exception 'Preview reserved a number'; end if;
  insert into public.invoices(customer_name) values('First numeric bill') returning id into first_id;
  insert into public.invoice_items(invoice_id,item_type,description,quantity,unit_price_minor,line_total_minor)
    values(first_id,'miscellaneous','Test charge',1,10000,10000);
  bill:=public.finalize_invoice(first_id,5000,'cash',null);
  if bill.invoice_number<>'1002' or bill.balance_minor<>5000 or bill.payment_status<>'partially_paid' then raise exception 'Saved number or existing payment behavior changed'; end if;
  if public.next_bill_number()<>'1003' then raise exception 'Next bill did not increment'; end if;
  insert into public.invoices(customer_name,invoice_number) values('Edited number','002000') returning id into edited_id;
  if (select invoice_number from public.invoices where id=edited_id)<>'2000' or public.next_bill_number()<>'2001' then raise exception 'Edited number did not advance counter'; end if;
  begin
    insert into public.invoices(customer_name,invoice_number) values('Duplicate','02000');
    raise exception 'Duplicate accepted';
  exception when unique_violation then null; end;
  rejected:=false;
  begin insert into public.invoices(customer_name,invoice_number) values('Backward','1500'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Counter could move backwards'; end if;
  rejected:=false;
  begin update public.invoices set invoice_number='2005' where id=first_id; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Saved bill number changed'; end if;
  perform public.cancel_invoice(first_id,'Test cancellation');
  if (select invoice_number from public.invoices where id=first_id)<>'1002' then raise exception 'Cancellation changed number'; end if;
  rejected:=false;
  begin delete from public.invoices where id=first_id; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Numbered bill deleted'; end if;
  before_rollback:=public.next_bill_number();
  begin
    insert into public.invoices(customer_name) values('Rolled-back bill');
    raise exception 'Simulated failure';
  exception when raise_exception then null; end;
  if public.next_bill_number()::bigint<>before_rollback::bigint+1 then raise exception 'Rolled-back number reused'; end if;
  insert into public.admin_settings(id,invoice_start_number,gym_name) values(1,1001,'Settings still save')
    on conflict(id) do update set invoice_start_number=excluded.invoice_start_number,gym_name=excluded.gym_name;
  rejected:=false;
  begin update public.admin_settings set invoice_start_number=1000 where id=1; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Starting number reset after allocation'; end if;
  if has_function_privilege('anon','public.next_bill_number()','EXECUTE') then raise exception 'Anonymous user can preview'; end if;
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ declare rejected boolean:=false; begin
  begin perform public.next_bill_number(); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Non-admin preview allowed'; end if;
end $$;
select 'PASS: previews, edits, duplicates, snapshots, payments, cancellations, rollback, settings and authorization' as result;
