-- Read-path indexes for multi-year member, attendance, billing and inventory growth.
create index if not exists members_updated_at_idx on public.members (updated_at desc);
create index if not exists members_active_name_idx on public.members (full_name) where deleted_at is null;
create index if not exists members_phone_idx on public.members (phone);
create index if not exists members_last_visit_idx on public.members (last_visit_date) where deleted_at is null;
create index if not exists attendance_records_date_live_idx on public.attendance_records (attendance_date desc, member_ref) where deleted_at is null;
create index if not exists attendance_records_member_date_idx on public.attendance_records (member_ref, attendance_date desc);
create index if not exists invoices_billing_date_idx on public.invoices (billing_date desc);
create index if not exists invoices_created_at_idx on public.invoices (created_at desc);
create index if not exists shop_items_inventory_active_idx on public.shop_items (title) where inventory_enabled = true and is_active = true;
create index if not exists inventory_variants_product_active_idx on public.inventory_product_variants (product_id, sku) where is_active = true;
