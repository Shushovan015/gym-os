-- Run ONLY in a disposable schema clone with all billing migrations applied.
-- Sequence tests intentionally consume numbers, even when a transaction aborts.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() not like 'gym_merge_test%' then raise exception 'Disposable test database required'; end if;
end $$;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000021','billing-test@example.test');
update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000021';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',false);
insert into public.admin_settings(id) values(1);
update public.admin_settings set invoice_start_number=500 where id=1;
insert into public.members(id,member_id,full_name,email,phone,membership_type,membership_status,payment_status)
values(900001,'TEST-001','Test member','member@example.test','1234567890','monthly','active','unpaid');
insert into public.invoices(id,customer_name,member_ref) values(900001,'Test member',900001),(900002,'Test member',900001);
insert into public.invoice_items(invoice_id,item_type,description,quantity,unit_price_minor,line_total_minor)
values(900001,'miscellaneous','Test charge',1,10000,10000),(900002,'miscellaneous','Test charge',1,10000,10000);
select public.finalize_invoice(900001);
select public.finalize_invoice(900002);
do $$ declare n1 text; n2 text; before_seq bigint; rejected boolean; c jsonb; retry jsonb;
begin
  select invoice_number into n1 from public.invoices where id=900001;
  select invoice_number into n2 from public.invoices where id=900002;
  if n1 not like '%-000500' or n2 not like '%-000501' then raise exception 'Starting number/increment failed: %, %',n1,n2; end if;
  rejected:=false;
  begin update public.admin_settings set invoice_start_number=1 where id=1; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Number reset was permitted'; end if;
  insert into public.admin_settings(id,invoice_start_number,gym_name) values(1,500,'Settings saved after numbering')
    on conflict(id) do update set invoice_start_number=excluded.invoice_start_number,gym_name=excluded.gym_name;
  if (select gym_name from public.admin_settings where id=1)<>'Settings saved after numbering' then raise exception 'Settings upsert failed'; end if;
  rejected:=false;
  begin update public.invoices set invoice_number='REUSED' where id=900001; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Number editing was permitted'; end if;
  rejected:=false;
  begin delete from public.invoices where id=900001; exception when others then rejected:=true; end;
  if not rejected then raise exception 'Numbered invoice deletion was permitted'; end if;
  select last_value into before_seq from public.invoice_serial_seq;
  begin
    insert into public.invoices(customer_name,invoice_status) values('Rollback test','issued');
    raise exception 'Simulated transaction failure';
  exception when others then null;
  end;
  if (select last_value from public.invoice_serial_seq) <> before_seq+1 then raise exception 'Rolled-back number was not consumed'; end if;
  update public.admin_settings set bill_sender_email='gym@example.test' where id=1;
  c:=public.claim_gmail_bill(900001,'member@example.test','gym@example.test',auth.uid());
  if c->>'state'<>'claimed' then raise exception 'First send not claimed'; end if;
  if public.claim_gmail_bill(900001,'member@example.test','gym@example.test',auth.uid())->>'state'<>'sending' then raise exception 'Concurrent send not blocked'; end if;
  perform public.finish_gmail_bill(900001,(c->>'attempt_id')::uuid,'uncertain');
  retry:=public.claim_gmail_bill(900001,'member@example.test','gym@example.test',auth.uid());
  if retry->>'state'<>'uncertain' then raise exception 'Uncertain SMTP delivery could be retried'; end if;
  perform public.finish_gmail_bill(900001,(c->>'attempt_id')::uuid,'sent','provider-test');
  if public.claim_gmail_bill(900001,'member@example.test','gym@example.test',auth.uid())->>'state'<>'sent' then raise exception 'Sent bill could be resent'; end if;
  c:=public.claim_gmail_bill(900002,'member@example.test','gym@example.test',auth.uid());
  update public.invoice_email_deliveries set started_at=now()-interval '6 minutes' where invoice_id=900002;
  if public.claim_gmail_bill(900002,'member@example.test','gym@example.test',auth.uid())->>'state'<>'uncertain' then raise exception 'Expired send could be duplicated'; end if;
  if has_function_privilege('authenticated','public.claim_gmail_bill(bigint,text,text,uuid)','EXECUTE') or has_function_privilege('anon','public.claim_gmail_bill(bigint,text,text,uuid)','EXECUTE') then raise exception 'Client can claim sends directly'; end if;
  if has_sequence_privilege('authenticated','public.invoice_serial_seq','UPDATE') then raise exception 'Client can reset sequence'; end if;
end $$;
select 'PASS: numbering, rollback, immutability, send leases, idempotency, expiry and grants' as result;
