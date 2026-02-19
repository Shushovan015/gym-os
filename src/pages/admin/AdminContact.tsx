import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type SummaryCard = {
  label: string;
  value: string;
  icon: string;
};

type ContactForm = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  cta_primary_text: string;
  cta_primary_link: string;
  cta_secondary_text: string;
  cta_secondary_link: string;
  phone: string;
  email: string;
  hours: string;
  location: string;
  map_embed_url: string;
  visit_text: string;
  form_note: string;
  info_title: string;
  info_description: string;
  form_title: string;
  form_description: string;
  form_button_text: string;
  faq_title: string;
  faq_description: string;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
  summary_cards: SummaryCard[];
};

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

const iconOptions = ["MessageCircle", "Clock3", "Users", "MapPin"];

const emptyContent: ContactForm = {
  hero_badge: "Contact A&A Health Club",
  hero_title: "Let us plan your fitness journey",
  hero_description: "Reach out for membership details, coach consultation, or a free trial booking.",
  hero_image:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1800&auto=format&fit=crop",
  cta_primary_text: "Book trial",
  cta_primary_link: "/contact",
  cta_secondary_text: "View pricing",
  cta_secondary_link: "/pricing",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  hours: "Daily, 5:00 AM - 9:00 PM",
  location: "Butwal, Rupandehi, Nepal",
  map_embed_url: "",
  visit_text: "Visit during operating hours for a guided walkthrough.",
  form_note: "Form is currently UI-only. Connect backend/email next.",
  info_title: "Direct Contact",
  info_description:
    "Call, email, or visit the gym. We usually respond quickly during operating hours.",
  form_title: "Send us a message",
  form_description: "Share your goal and schedule. Our team will suggest the right plan.",
  form_button_text: "Submit inquiry",
  faq_title: "Frequently asked questions",
  faq_description: "Quick answers before you visit or join.",
  bottom_cta_title: "Ready to train with us?",
  bottom_cta_description: "Book a trial or explore membership options.",
  bottom_primary_cta_text: "Book trial session",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "See memberships",
  bottom_secondary_cta_link: "/pricing",
  summary_cards: [
    { label: "Response Time", value: "< 24 hrs", icon: "MessageCircle" },
    { label: "Open Daily", value: "5AM - 9PM", icon: "Clock3" },
    { label: "Coaches Available", value: "3+", icon: "Users" },
    { label: "Location", value: "Butwal", icon: "MapPin" },
  ],
};

const normalizeSummaryCards = (value: any): SummaryCard[] => {
  if (!Array.isArray(value)) return emptyContent.summary_cards;
  const cleaned = value
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      icon: String(item?.icon ?? "MessageCircle").trim() || "MessageCircle",
    }))
    .filter((item: SummaryCard) => item.label && item.value);
  return cleaned.length ? cleaned : emptyContent.summary_cards;
};

function Label({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

export default function AdminContact() {
  const [content, setContent] = useState<ContactForm>(emptyContent);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", sort_order: 0, is_active: true });
  const [faqEditId, setFaqEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from("contact_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("contact_faqs").select("*").order("sort_order", { ascending: true }),
    ]);

    if (c) {
      setContent({
        ...emptyContent,
        ...(c as Partial<ContactForm>),
        summary_cards: normalizeSummaryCards((c as any)?.summary_cards),
      });
    } else {
      setContent(emptyContent);
    }

    setFaqs((f as FaqRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const payload = {
      id: 1,
      ...content,
      summary_cards: (content.summary_cards || [])
        .map((card) => ({
          label: card.label.trim(),
          value: card.value.trim(),
          icon: (card.icon || "MessageCircle").trim(),
        }))
        .filter((card) => card.label && card.value),
    };

    const { error } = await supabase.from("contact_content").upsert(payload, { onConflict: "id" });
    setMsg(error ? error.message : "Contact content saved.");
    setSaving(false);
    if (!error) await load();
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

  const updateSummaryCard = (index: number, key: keyof SummaryCard, value: string) => {
    setContent((prev) => {
      const next = [...prev.summary_cards];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, summary_cards: next };
    });
  };

  const addSummaryCard = () => {
    setContent((prev) => ({
      ...prev,
      summary_cards: [...prev.summary_cards, { label: "", value: "", icon: "MessageCircle" }],
    }));
  };

  const removeSummaryCard = (index: number) => {
    setContent((prev) => ({
      ...prev,
      summary_cards: prev.summary_cards.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">Contact Page Content</h2>

        <div className="pt-1 text-sm font-bold text-white">Hero</div>
        <Label>Hero Badge</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_badge} onChange={(e) => setContent({ ...content, hero_badge: e.target.value })} />

        <Label>Hero Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_title} onChange={(e) => setContent({ ...content, hero_title: e.target.value })} />

        <Label>Hero Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_description} onChange={(e) => setContent({ ...content, hero_description: e.target.value })} />

        <Label>Hero Background Image URL</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_image} onChange={(e) => setContent({ ...content, hero_image: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Primary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.cta_primary_text} onChange={(e) => setContent({ ...content, cta_primary_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Primary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.cta_primary_link} onChange={(e) => setContent({ ...content, cta_primary_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Secondary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.cta_secondary_text} onChange={(e) => setContent({ ...content, cta_secondary_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Secondary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.cta_secondary_link} onChange={(e) => setContent({ ...content, cta_secondary_link: e.target.value })} />
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Hero Summary Cards</h3>
            <button type="button" onClick={addSummaryCard} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Card
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {content.summary_cards.map((card, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Label</Label>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={card.label} onChange={(e) => updateSummaryCard(idx, "label", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Value</Label>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={card.value} onChange={(e) => updateSummaryCard(idx, "value", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Icon</Label>
                  <select className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={card.icon} onChange={(e) => updateSummaryCard(idx, "icon", e.target.value)}>
                    {iconOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-black">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeSummaryCard(idx)} className="md:col-span-3 rounded-lg bg-red-500/20 px-3 py-2 text-red-300 text-xs">
                  Remove Card
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1 text-sm font-bold text-white">Contact Info Block</div>
        <Label>Info Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.info_title} onChange={(e) => setContent({ ...content, info_title: e.target.value })} />

        <Label>Info Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.info_description} onChange={(e) => setContent({ ...content, info_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Phone</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.phone} onChange={(e) => setContent({ ...content, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.email} onChange={(e) => setContent({ ...content, email: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Hours</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hours} onChange={(e) => setContent({ ...content, hours: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.location} onChange={(e) => setContent({ ...content, location: e.target.value })} />
          </div>
        </div>

        <Label>Google Maps Embed URL</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.map_embed_url} onChange={(e) => setContent({ ...content, map_embed_url: e.target.value })} />

        <Label>Visit Text</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.visit_text} onChange={(e) => setContent({ ...content, visit_text: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Form Block</div>
        <Label>Form Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.form_title} onChange={(e) => setContent({ ...content, form_title: e.target.value })} />

        <Label>Form Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.form_description} onChange={(e) => setContent({ ...content, form_description: e.target.value })} />

        <Label>Form Button Text</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.form_button_text} onChange={(e) => setContent({ ...content, form_button_text: e.target.value })} />

        <Label>Form Note</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.form_note} onChange={(e) => setContent({ ...content, form_note: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">FAQ Section Headings</div>
        <Label>FAQ Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.faq_title} onChange={(e) => setContent({ ...content, faq_title: e.target.value })} />

        <Label>FAQ Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.faq_description} onChange={(e) => setContent({ ...content, faq_description: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Bottom CTA</div>
        <Label>Bottom CTA Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_cta_title} onChange={(e) => setContent({ ...content, bottom_cta_title: e.target.value })} />

        <Label>Bottom CTA Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_cta_description} onChange={(e) => setContent({ ...content, bottom_cta_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bottom Primary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_primary_cta_text} onChange={(e) => setContent({ ...content, bottom_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Bottom Primary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_primary_cta_link} onChange={(e) => setContent({ ...content, bottom_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bottom Secondary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_secondary_cta_text} onChange={(e) => setContent({ ...content, bottom_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Bottom Secondary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.bottom_secondary_cta_link} onChange={(e) => setContent({ ...content, bottom_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        {msg && <p className="text-sm text-zinc-300">{msg}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
          {saving ? "Saving..." : "Save Contact Content"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={saveFaq} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{faqEditId ? "Edit" : "Add"} FAQ</h2>

          <Label>Question</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} />

          <Label>Answer</Label>
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} />

          <Label>Sort Order</Label>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={faqForm.sort_order} onChange={(e) => setFaqForm({ ...faqForm, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={faqForm.is_active} onChange={(e) => setFaqForm({ ...faqForm, is_active: e.target.checked })} />
            Active
          </label>

          <button className="rounded-xl bg-white px-5 py-3 font-black text-black">
            {faqEditId ? "Update FAQ" : "Create FAQ"}
          </button>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">FAQs</h2>
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-white font-bold">{f.question}</div>
              <div className="text-zinc-300 text-sm mt-1">{f.answer}</div>
              <div className="text-xs text-zinc-400 mt-1">order: {f.sort_order} | {f.is_active ? "active" : "inactive"}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditFaq(f)} className="rounded-lg bg-white/10 px-3 py-1 text-white">
                  Edit
                </button>
                <button type="button" onClick={() => onDeleteFaq(f.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
