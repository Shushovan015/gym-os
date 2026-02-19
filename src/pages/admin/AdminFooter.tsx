import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type FormState = {
  brand_name: string;
  location: string;
  banner_title: string;
  banner_subtitle: string;
  cta_text: string;
  cta_link: string;
  about_text: string;
  hours_text: string;
  phone: string;
  email: string;
  copyright_text: string;
  bottom_tags: string;
};

const emptyForm: FormState = {
  brand_name: "",
  location: "",
  banner_title: "",
  banner_subtitle: "",
  cta_text: "Book a free trial",
  cta_link: "/contact",
  about_text: "",
  hours_text: "",
  phone: "",
  email: "",
  copyright_text: "",
  bottom_tags: "",
};

export default function AdminFooter() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("footer_content")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      setForm({
        brand_name: data.brand_name ?? "",
        location: data.location ?? "",
        banner_title: data.banner_title ?? "",
        banner_subtitle: data.banner_subtitle ?? "",
        cta_text: data.cta_text ?? "Book a free trial",
        cta_link: data.cta_link ?? "/contact",
        about_text: data.about_text ?? "",
        hours_text: data.hours_text ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        copyright_text: data.copyright_text ?? "",
        bottom_tags: data.bottom_tags ?? "",
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const payload = { id: 1, ...form };

    const { error } = await supabase
      .from("footer_content")
      .upsert(payload, { onConflict: "id" });

    if (error) setMsg(error.message);
    else setMsg("Footer content saved.");

    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3 max-w-3xl">
      <h2 className="text-xl font-black text-white">Footer Content</h2>

      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Brand name" value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Top banner title" value={form.banner_title} onChange={(e) => setForm({ ...form, banner_title: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Top banner subtitle" value={form.banner_subtitle} onChange={(e) => setForm({ ...form, banner_subtitle: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="CTA text" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="CTA link (e.g. /contact)" value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} />
      <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="About text" value={form.about_text} onChange={(e) => setForm({ ...form, about_text: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hours text" value={form.hours_text} onChange={(e) => setForm({ ...form, hours_text: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Copyright text" value={form.copyright_text} onChange={(e) => setForm({ ...form, copyright_text: e.target.value })} />
      <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Bottom tags (e.g. Strength | Conditioning | Coaching)" value={form.bottom_tags} onChange={(e) => setForm({ ...form, bottom_tags: e.target.value })} />

      {msg && <p className="text-sm text-zinc-300">{msg}</p>}

      <button type="submit" disabled={saving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
        {saving ? "Saving..." : "Save Footer"}
      </button>
    </form>
  );
}
