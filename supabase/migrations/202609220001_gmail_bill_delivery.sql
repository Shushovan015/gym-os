-- Gmail credentials remain in Edge Function secrets, never in this table.
alter table public.admin_settings add column bill_sender_email text;

create table public.invoice_email_deliveries (
  invoice_id bigint primary key references public.invoices(id),
  status text not null check (status in ('sending', 'sent', 'failed', 'uncertain')),
  attempt_id uuid not null default gen_random_uuid(),
  recipient_email text not null,
  sender_email text not null,
  sent_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  sent_at timestamptz,
  message_id text,
  error_message text
);
alter table public.invoice_email_deliveries enable row level security;
revoke all on public.invoice_email_deliveries from public, anon, authenticated;
grant select(invoice_id,status,recipient_email,sender_email,sent_at,error_message) on public.invoice_email_deliveries to authenticated;
grant all on public.invoice_email_deliveries to service_role;
create policy invoice_email_admin_read on public.invoice_email_deliveries
for select to authenticated using (public.is_admin());

create function public.claim_gmail_bill(p_invoice_id bigint, p_recipient text, p_sender text, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare bill public.invoices; delivery public.invoice_email_deliveries; current_email text; current_sender text;
begin
  if not exists(select 1 from public.profiles where id=p_admin_id and role='admin') then
    raise exception 'Admin access required';
  end if;
  -- Locking the bill also serializes the first insert, before a delivery exists.
  select * into bill from public.invoices where id=p_invoice_id for update;
  if not found or bill.invoice_status <> 'issued' or bill.invoice_number is null or bill.member_ref is null then
    raise exception 'Only issued member invoices can be emailed';
  end if;
  select * into delivery from public.invoice_email_deliveries where invoice_id=p_invoice_id for update;
  if found then
    if delivery.status='sent' then return jsonb_build_object('state','sent'); end if;
    if delivery.status='uncertain' then return jsonb_build_object('state','uncertain'); end if;
    if delivery.status='sending' then
      if delivery.started_at < now()-interval '5 minutes' then
        update public.invoice_email_deliveries set status='uncertain',error_message='The previous send did not finish. Check Gmail Sent before retrying.' where invoice_id=p_invoice_id;
        return jsonb_build_object('state','uncertain');
      end if;
      return jsonb_build_object('state','sending');
    end if;
  end if;
  select email into current_email from public.members where id=bill.member_ref and deleted_at is null;
  select bill_sender_email into current_sender from public.admin_settings where id=1;
  if current_email is null or lower(btrim(current_email)) <> lower(btrim(p_recipient)) then
    raise exception 'Member email changed; open the confirmation again';
  end if;
  if current_sender is null or lower(btrim(current_sender)) <> lower(btrim(p_sender)) then
    raise exception 'Sender email changed; check System Settings';
  end if;
  insert into public.invoice_email_deliveries(invoice_id,status,recipient_email,sender_email,sent_by)
  values(p_invoice_id,'sending',p_recipient,p_sender,p_admin_id)
  on conflict(invoice_id) do update set status='sending',attempt_id=gen_random_uuid(),
    recipient_email=excluded.recipient_email,sender_email=excluded.sender_email,sent_by=excluded.sent_by,
    started_at=now(),sent_at=null,message_id=null,error_message=null
  returning * into delivery;
  return jsonb_build_object('state','claimed','attempt_id',delivery.attempt_id);
end $$;

create function public.finish_gmail_bill(p_invoice_id bigint,p_attempt_id uuid,p_status text,p_message_id text default null,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('sent','failed','uncertain') then raise exception 'Invalid delivery status'; end if;
  update public.invoice_email_deliveries set status=p_status,message_id=p_message_id,
    sent_at=case when p_status='sent' then now() else null end,error_message=p_error
  where invoice_id=p_invoice_id and attempt_id=p_attempt_id and status in ('sending','uncertain');
  return found;
end $$;
revoke all on function public.claim_gmail_bill(bigint,text,text,uuid) from public, anon, authenticated;
revoke all on function public.finish_gmail_bill(bigint,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_gmail_bill(bigint,text,text,uuid) to service_role;
grant execute on function public.finish_gmail_bill(bigint,uuid,text,text,text) to service_role;
