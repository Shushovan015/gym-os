import { supabase } from "@src/Client/supabase";

export const fetchFacilities = async () => {
  const [{ data: items, error: itemsError }, { data: content, error: contentError }] =
    await Promise.all([
      supabase
        .from("facility_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("facilities_page_content").select("*").eq("id", 1).maybeSingle(),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (contentError) throw new Error(contentError.message);

  return {
    items: items ?? [],
    content: content ?? null,
  };
};
