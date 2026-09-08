alter table public.invoice_items
  add column if not exists unit_cost_minor bigint;

alter table public.invoice_items
  add constraint invoice_items_unit_cost_minor_check
  check (unit_cost_minor is null or unit_cost_minor >= 0);

comment on column public.invoice_items.unit_cost_minor is
  'Cost per unit captured when a product is sold. Null for legacy sales where historical cost is unknown.';
