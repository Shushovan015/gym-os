-- Durable idempotency: a sent invoice cannot be sent again, even after Resend's
-- 24-hour idempotency window. Only the Edge Function can claim/finish a send.
create table if not exists public.invoice_email_deliveries (
  invoice_id bigint primary key references public.invoices(id),
  delivery_key uuid not null default gen_random_uuid(),
  status text not null check (status in ('sending','sent','failed','uncertain')),
  payload jsonb not null,
  recipient_email text not null,
  created_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  provider_id text,
  error_message text
);
alter table public.invoice_email_deliveries enable row level security;
revoke all on public.invoice_email_deliveries from public, anon, authenticated;
grant select(invoice_id,status,recipient_email,sent_at,error_message) on public.invoice_email_deliveries to authenticated;
grant all on public.invoice_email_deliveries to service_role;
drop policy if exists invoice_email_admin_read on public.invoice_email_deliveries;
create policy invoice_email_admin_read on public.invoice_email_deliveries for select to authenticated using (public.is_admin());

create function public.claim_bill_email(p_invoice_id bigint, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare delivery public.invoice_email_deliveries; bill public.invoices;
begin
  select * into bill from public.invoices where id=p_invoice_id for update;
  if not found or bill.invoice_status <> 'issued' or bill.invoice_number is null or bill.member_ref is null then
    raise exception 'Only issued member invoices can be emailed';
  end if;
  select * into delivery from public.invoice_email_deliveries where invoice_id=p_invoice_id for update;
  if found then
    if delivery.status='sent' then return jsonb_build_object('state','sent'); end if;
    if delivery.status='sending' and delivery.lease_until > now() then return jsonb_build_object('state','busy'); end if;
    if delivery.status <> 'failed' and delivery.created_at < now()-interval '23 hours' then
      return jsonb_build_object('state','review_required');
    end if;
    -- A definite provider rejection can safely use corrected settings/data.
    if delivery.status='failed' then
      delivery.payload := p_payload;
      delivery.delivery_key := gen_random_uuid();
      delivery.created_at := now();
    end if;
    update public.invoice_email_deliveries set status='sending', payload=delivery.payload,
      delivery_key=delivery.delivery_key, created_at=delivery.created_at,
      recipient_email=delivery.payload->'to'->>0, lease_until=now()+interval '90 seconds',
      lease_token=gen_random_uuid(), error_message=null
    where invoice_id=p_invoice_id returning * into delivery;
  else
    insert into public.invoice_email_deliveries(invoice_id,status,payload,recipient_email,lease_until,lease_token)
    values(p_invoice_id,'sending',p_payload,p_payload->'to'->>0,now()+interval '90 seconds',gen_random_uuid()) returning * into delivery;
  end if;
  return jsonb_build_object('state','claimed','delivery',to_jsonb(delivery));
end $$;

create function public.finish_bill_email(p_invoice_id bigint, p_lease_token uuid, p_status text, p_provider_id text default null, p_error text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('sent','failed','uncertain') then raise exception 'Invalid delivery status'; end if;
  update public.invoice_email_deliveries set status=p_status, provider_id=p_provider_id,
    sent_at=case when p_status='sent' then now() else null end, error_message=p_error, lease_until=null
  where invoice_id=p_invoice_id and lease_token=p_lease_token and status='sending';
  if not found then raise exception 'Send lease changed; check delivery status before retrying'; end if;
end $$;
revoke all on function public.claim_bill_email(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.finish_bill_email(bigint,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_bill_email(bigint,jsonb) to service_role;
grant execute on function public.finish_bill_email(bigint,uuid,text,text,text) to service_role;
