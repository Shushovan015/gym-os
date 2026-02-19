import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type ContactForm = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  phone: string;
  email: string;
  hours: string;
  location: string;
  map_embed_url: string;
  visit_text: string;
  cta_primary_text: string;
  cta_primary_link: string;
  cta_secondary_text: string;
  cta_secondary_link: string;
  form_note: string;
};

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

const emptyContent: ContactForm = {
  hero_badge: "",
  hero_title: "",
  hero_description: "",
  phone: "",
  email: "",
  hours: "",
  location: "",
  map_embed_url: "",
  visit_text: "",
  cta_primary_text: "See pricing",
  cta_primary_link: "/pricing",
  cta_secondary_text: "Meet coaches",
  cta_secondary_link: "/trainers",
  form_note: "",
};

export default function AdminContact() {
  const [content, setContent] = useState<ContactForm>(emptyContent);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", sort_order: 0, is_active: true });
  const [faqEditId, setFaqEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from("contact_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("contact_faqs").select("*").order("sort_order", { ascending: true }),
    ]);

    if (c) {
      setContent({
        hero_badge: c.hero_badge ?? "",
        hero_title: c.hero_title ?? "",
        hero_description: c.hero_description ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        hours: c.hours ?? "",
        location: c.location ?? "",
        map_embed_url: c.map_embed_url ?? "",
        visit_text: c.visit_text ?? "",
        cta_primary_text: c.cta_primary_text ?? "",
        cta_primary_link: c.cta_primary_link ?? "/pricing",
        cta_secondary_text: c.cta_secondary_text ?? "",
        cta_secondary_link: c.cta_secondary_link ?? "/trainers",
        form_note: c.form_note ?? "",
      });
    }
    setFaqs((f as FaqRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { error } = await supabase.from("contact_content").upsert({ id: 1, ...content }, { onConflict: "id" });
    setMsg(error ? error.message : "Contact content saved.");
  };

  const saveFaq = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (faqEditId) {
      await supabase.from("contact_faqs").update(faqForm).eq("id", faqEditId);
    } else {
      await supabase.from("contact_faqs").insert(faqForm);
    }
    setFaqForm({ question: "", answer: "", sort_order: 0, is_active: true });
    setFaqEditId(null);
    load();
  };

  const onEditFaq = (row: FaqRow) => {
    setFaqEditId(row.id);
    setFaqForm({
      question: row.question,
      answer: row.answer,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
  };

  const onDeleteFaq = async (id: number) => {
    await supabase.from("contact_faqs").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveContent} className="rounded-2xl bg-black/35 p-6 space-y-3">
        <h2 className="text-xl font-black text-white">Contact Page Content</h2>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero badge" value={content.hero_badge} onChange={(e) => setContent({ ...content, hero_badge: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero title" value={content.hero_title} onChange={(e) => setContent({ ...content, hero_title: e.target.value })} />
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero description" value={content.hero_description} onChange={(e) => setContent({ ...content, hero_description: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Phone" value={content.phone} onChange={(e) => setContent({ ...content, phone: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Email" value={content.email} onChange={(e) => setContent({ ...content, email: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hours" value={content.hours} onChange={(e) => setContent({ ...content, hours: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Location" value={content.location} onChange={(e) => setContent({ ...content, location: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Map embed URL (Google maps embed link)" value={content.map_embed_url} onChange={(e) => setContent({ ...content, map_embed_url: e.target.value })} />
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Visit text" value={content.visit_text} onChange={(e) => setContent({ ...content, visit_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Primary CTA text" value={content.cta_primary_text} onChange={(e) => setContent({ ...content, cta_primary_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Primary CTA link" value={content.cta_primary_link} onChange={(e) => setContent({ ...content, cta_primary_link: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Secondary CTA text" value={content.cta_secondary_text} onChange={(e) => setContent({ ...content, cta_secondary_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Secondary CTA link" value={content.cta_secondary_link} onChange={(e) => setContent({ ...content, cta_secondary_link: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Form note" value={content.form_note} onChange={(e) => setContent({ ...content, form_note: e.target.value })} />
        {msg && <p className="text-sm text-zinc-300">{msg}</p>}
        <button className="rounded-xl bg-white px-5 py-3 font-black text-black">Save Contact Content</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={saveFaq} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{faqEditId ? "Edit" : "Add"} FAQ</h2>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Question" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} />
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Answer" value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} />
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Sort order" value={faqForm.sort_order} onChange={(e) => setFaqForm({ ...faqForm, sort_order: Number(e.target.value) })} />
          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={faqForm.is_active} onChange={(e) => setFaqForm({ ...faqForm, is_active: e.target.checked })} />
            Active
          </label>
          <button className="rounded-xl bg-white px-5 py-3 font-black text-black">{faqEditId ? "Update" : "Create"} FAQ</button>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">FAQs</h2>
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-white font-bold">{f.question}</div>
              <div className="text-zinc-300 text-sm mt-1">{f.answer}</div>
              <div className="text-xs text-zinc-400 mt-1">order: {f.sort_order} | {f.is_active ? "active" : "inactive"}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditFaq(f)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
                <button type="button" onClick={() => onDeleteFaq(f.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
