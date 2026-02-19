import { supabase } from "@src/Client/supabase";

export const fetchContact = async () => {
  const [{ data: content, error: contentError }, { data: faqs, error: faqsError }] = await Promise.all([
    supabase
      .from("contact_content")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("contact_faqs")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (contentError) throw new Error(contentError.message);
  if (faqsError) throw new Error(faqsError.message);

  return { content, faqs: faqs ?? [] };
};
