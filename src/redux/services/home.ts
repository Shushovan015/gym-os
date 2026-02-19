import { supabase } from "@src/Client/supabase";

export const fetchHome = async () => {
  const [{ data: content, error: contentError }, { data: status, error: statusError }, { data: points, error: pointsError }] =
    await Promise.all([
      supabase.from("home_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("home_status_items").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("home_maximus_points").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    ]);

  if (contentError) throw new Error(contentError.message);
  if (statusError) throw new Error(statusError.message);
  if (pointsError) throw new Error(pointsError.message);

  return { content, status: status ?? [], points: points ?? [] };
};
