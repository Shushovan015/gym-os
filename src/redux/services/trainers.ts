import { supabase } from "@src/Client/supabase";

export const fetchTrainers = async () => {
  const [
    { data: trainers, error: trainersError },
    { data: ptContent, error: ptContentError },
    { data: plans, error: plansError },
  ] = await Promise.all([
    supabase.from("trainers").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("trainer_page_content").select("*").eq("id", 1).maybeSingle(),
    supabase.from("personal_training_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
  ]);

  if (trainersError) throw new Error(trainersError.message);
  if (ptContentError) throw new Error(ptContentError.message);
  if (plansError) throw new Error(plansError.message);

  return {
    trainers: trainers ?? [],
    ptContent: ptContent ?? null,
    plans: plans ?? [],
  };
};
