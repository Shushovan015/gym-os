create or replace function public.admin_billing_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select (timezone('Asia/Kathmandu', now()))::date as today
  )
  select jsonb_build_object(
    'revenue_today', coalesce(sum(paid_minor) filter (where billing_date = bounds.today and invoice_status = 'issued'), 0),
    'revenue_month', coalesce(sum(paid_minor) filter (where billing_date >= date_trunc('month', bounds.today)::date and invoice_status = 'issued'), 0),
    'invoices_today', count(*) filter (where billing_date = bounds.today and invoice_status <> 'draft'),
    'unpaid', count(*) filter (where invoice_status = 'issued' and payment_status = 'unpaid'),
    'partially_paid', count(*) filter (where invoice_status = 'issued' and payment_status = 'partially_paid'),
    'outstanding', coalesce(sum(balance_minor) filter (where invoice_status = 'issued'), 0)
  )
  from public.invoices cross join bounds;
$$;

revoke all on function public.admin_billing_summary() from public;
grant execute on function public.admin_billing_summary() to authenticated;
