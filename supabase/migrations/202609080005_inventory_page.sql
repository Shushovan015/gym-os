create or replace function public.admin_inventory_page(
  p_search text default '', p_category text default 'all', p_stock text default 'all',
  p_active text default 'active', p_offset integer default 0, p_limit integer default 10
) returns jsonb language sql stable security invoker set search_path = public as $$
with base as (
  select p, v, coalesce(v.low_stock_threshold, p.low_stock_threshold) threshold
  from public.inventory_product_variants v join public.shop_items p on p.id=v.product_id
  where p.inventory_enabled
    and (p_search='' or concat_ws(' ',p.title,p.category,p.sku,p.brand,v.name,v.sku) ilike '%'||p_search||'%')
    and (p_category='all' or p.category=p_category)
    and (p_active='all' or (p_active='active' and p.is_active and v.is_active) or (p_active='inactive' and (not p.is_active or not v.is_active)))
    and (p_stock='all' or (p_stock='out' and v.current_quantity<=0) or (p_stock='low' and v.current_quantity>0 and v.current_quantity<=coalesce(v.low_stock_threshold,p.low_stock_threshold)) or (p_stock='in' and v.current_quantity>coalesce(v.low_stock_threshold,p.low_stock_threshold)))
), page_rows as (
  select * from base order by (p).title, (v).id offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)
), all_stock as (
  select p, v from public.inventory_product_variants v join public.shop_items p on p.id=v.product_id where p.inventory_enabled
)
select jsonb_build_object(
 'total', (select count(*) from base),
 'rows', coalesce((select jsonb_agg(jsonb_build_object('product',to_jsonb(p),'variant',to_jsonb(v))) from page_rows),'[]'::jsonb),
 'categories', coalesce((select jsonb_agg(category order by category) from (select distinct (p).category category from all_stock) c),'[]'::jsonb),
 'summary', (select jsonb_build_object('units',coalesce(sum((v).current_quantity),0),'low',count(*) filter(where (v).current_quantity>0 and (v).current_quantity<=coalesce((v).low_stock_threshold,(p).low_stock_threshold)),'out',count(*) filter(where (v).current_quantity<=0),'cost',coalesce(sum((v).current_quantity*coalesce((v).cost_price_minor,(p).cost_price_minor)),0),'retail',coalesce(sum((v).current_quantity*coalesce((v).selling_price_minor,(p).selling_price_minor)),0)) from all_stock)
);
$$;
revoke all on function public.admin_inventory_page(text,text,text,text,integer,integer) from public;
grant execute on function public.admin_inventory_page(text,text,text,text,integer,integer) to authenticated;
