import { supabase } from "@src/Client/supabase";

export const fetchFacilities = async () => {
  const { data, error } = await supabase
    .from("facility_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
};
