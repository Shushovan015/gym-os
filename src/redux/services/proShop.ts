import { supabase } from "@src/Client/supabase";

export const fetchProShop = async () => {
  const [{ data: items, error: itemsError }, { data: content, error: contentError }, { data: availability }] =
    await Promise.all([
      supabase
        .from("shop_items")
        .select("id,title,category,price,description,image,badge,inquire_link,sort_order,is_featured,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("shop_page_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("public_shop_availability").select("product_id,availability"),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (contentError) throw new Error(contentError.message);

  return {
    items: (items ?? []).map((item) => ({ ...item, availability: availability?.find((row) => row.product_id === item.id)?.availability ?? "not_tracked" })),
    content: content ?? null,
  };
};
