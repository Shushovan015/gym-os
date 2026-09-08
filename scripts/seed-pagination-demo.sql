\set ON_ERROR_STOP on

begin;

-- Re-running this development-only script replaces only records carrying the
-- reserved DEMO prefixes. It never touches normal member or inventory data.
delete from public.inventory_product_variants where sku like 'DEMO-V-%';
delete from public.shop_items where sku like 'DEMO-P-%';

insert into public.members (
  member_id, full_name, email, phone, address, membership_type,
  membership_status, start_date, end_date, last_visit_date,
  payment_status, payment_due_date, notes
)
select
  'DEMO-M-' || lpad(g::text, 3, '0'),
  'Demo Member ' || lpad(g::text, 2, '0'),
  'demo.member.' || g || '@example.invalid',
  '+977-98000' || lpad(g::text, 5, '0'),
  'Demo Address ' || g || ', Butwal',
  case when g % 3 = 0 then 'Annual' else 'Monthly' end,
  case when g % 11 = 0 then 'paused' else 'active' end,
  current_date - (g * interval '3 days'),
  current_date + ((30 + g) * interval '1 day'),
  current_date - ((g % 12) * interval '1 day'),
  case when g % 7 = 0 then 'overdue' when g % 4 = 0 then 'unpaid' else 'paid' end,
  case when g % 4 = 0 or g % 7 = 0 then current_date + ((g % 10) * interval '1 day') else null end,
  'Pagination demo data'
from generate_series(1, 50) g
on conflict (member_id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  membership_type = excluded.membership_type,
  membership_status = excluded.membership_status,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  last_visit_date = excluded.last_visit_date,
  payment_status = excluded.payment_status,
  payment_due_date = excluded.payment_due_date,
  notes = excluded.notes,
  deleted_at = null;

insert into public.shop_items (
  title, category, price, description, badge, sort_order, is_active,
  sku, brand, unit, inventory_enabled, cost_price_minor,
  selling_price_minor, low_stock_threshold, inventory_notes
)
select
  'Demo Product ' || lpad(g::text, 2, '0'),
  (array['Supplements','Accessories','Apparel','Drinks'])[(g % 4) + 1],
  'NPR ' || (500 + g * 25),
  'Pagination demo inventory product',
  case when g % 8 = 0 then 'Popular' else '' end,
  1000 + g,
  true,
  'DEMO-P-' || lpad(g::text, 3, '0'),
  'Demo Brand',
  'piece',
  true,
  30000 + g * 1000,
  50000 + g * 2500,
  5,
  'Pagination demo data'
from generate_series(1, 50) g;

insert into public.inventory_product_variants (
  product_id, name, sku, cost_price_minor, selling_price_minor,
  current_quantity, low_stock_threshold, is_active
)
select
  p.id,
  'Default',
  'DEMO-V-' || lpad(g::text, 3, '0'),
  30000 + g * 1000,
  50000 + g * 2500,
  case when g % 13 = 0 then 0 when g % 7 = 0 then 3 else 15 + (g % 25) end,
  5,
  true
from generate_series(1, 50) g
join public.shop_items p on p.sku = 'DEMO-P-' || lpad(g::text, 3, '0')
on conflict (sku) do update set
  product_id = excluded.product_id,
  current_quantity = excluded.current_quantity,
  cost_price_minor = excluded.cost_price_minor,
  selling_price_minor = excluded.selling_price_minor,
  low_stock_threshold = excluded.low_stock_threshold,
  is_active = true;

commit;

select count(*) as demo_members from public.members where member_id like 'DEMO-M-%';
select count(*) as demo_products from public.shop_items where sku like 'DEMO-P-%';
select count(*) as demo_variants from public.inventory_product_variants where sku like 'DEMO-V-%';
