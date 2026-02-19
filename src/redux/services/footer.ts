import { supabase } from "@src/Client/supabase";

export const fetchFooter = async () => {
  const { data, error } = await supabase
    .from("footer_content")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};
