-- Reverse the complete quantity sold for each variant, even when the same
-- variant appeared on multiple lines at different customer prices.
create or replace function public.cancel_invoice(p_invoice_id bigint, p_reason text)
returns public.invoices
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_move record;
  v_variant public.inventory_product_variants;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.invoice_status = 'cancelled' then return v_invoice; end if;
  if v_invoice.invoice_status <> 'issued' then raise exception 'Only issued invoices can be cancelled'; end if;

  for v_move in
    select variant_id, sum(abs(quantity_delta)) as returned_quantity
    from public.stock_movements
    where invoice_id = p_invoice_id and movement_type = 'sale'
    group by variant_id
    order by variant_id
  loop
    select * into v_variant from public.inventory_product_variants where id = v_move.variant_id for update;
    if not exists (
      select 1 from public.stock_movements
      where invoice_id = p_invoice_id and variant_id = v_move.variant_id
        and movement_type = 'cancellation_reversal'
    ) then
      update public.inventory_product_variants
      set current_quantity = current_quantity + v_move.returned_quantity
      where id = v_move.variant_id;
      insert into public.stock_movements (
        variant_id, movement_type, quantity_delta, previous_quantity,
        resulting_quantity, invoice_id, reference, notes
      ) values (
        v_move.variant_id, 'cancellation_reversal', v_move.returned_quantity, v_variant.current_quantity,
        v_variant.current_quantity + v_move.returned_quantity, p_invoice_id, 'Invoice cancellation', p_reason
      );
    end if;
  end loop;

  update public.invoices
  set invoice_status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      cancellation_reason = nullif(trim(p_reason), ''), updated_by = auth.uid()
  where id = p_invoice_id returning * into v_invoice;
  return v_invoice;
end;
$$;
