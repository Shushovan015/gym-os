import { supabase } from "@src/Client/supabase";
import { phpGet, usePhpApi } from "@src/Client/phpApi";

export const fetchFooter = async <T = unknown>(): Promise<T | null> => {
  if (usePhpApi) return (await phpGet<{ content: T | null }>("/public/footer")).content;
  const { data, error } = await supabase
    .from("footer_content")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as T | null;
};
