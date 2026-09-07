import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type Kind = "plan" | "perk";

type Row = {
  id: number;
  kind: Kind;
  title: string;
  price: string;
  cadence: string;
  subtitle: string;
  is_highlighted: boolean;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

type FormState = {
  kind: Kind;
  title: string;
  price: string;
  cadence: string;
  subtitle: string;
  is_highlighted: boolean;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

type SummaryCard = {
  label: string;
  value: string;
  icon: string;
};

type PageContent = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  summary_cards: SummaryCard[];
  benefits_title: string;
  benefits_description: string;
  advisor_title: string;
  advisor_description: string;
  advisor_cta_text: string;
  advisor_cta_link: string;
  popular_badge_text: string;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
};

const iconOptions = ["Crown", "Sparkles", "ShieldCheck", "Zap", "Dumbbell", "Trophy", "Users"];

const emptyForm: FormState = {
  kind: "plan",
  title: "",
  price: "",
  cadence: "/month",
  subtitle: "",
  is_highlighted: false,
  features: [],
  sort_order: 0,
  is_active: true,
};

const emptyPageContent: PageContent = {
  hero_badge: "Membership Plans",
  hero_title: "Transparent pricing for premium training",
  hero_description: "Choose the plan that matches your training intensity. Upgrade anytime as your goals evolve.",
  hero_primary_cta_text: "Get custom plan",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "Talk to a coach",
  hero_secondary_cta_link: "/trainers",
  summary_cards: [
    { label: "Membership Tiers", value: "{plans}", icon: "Crown" },
    { label: "Included Benefits", value: "{perks}+", icon: "Sparkles" },
    { label: "Most Popular", value: "{popular}", icon: "ShieldCheck" },
  ],
  benefits_title: "What you get",
  benefits_description: "Every membership includes core gym access and a serious training environment.",
  advisor_title: "Need plan matching?",
  advisor_description: "Tell us your goal and schedule. We will recommend the right package.",
  advisor_cta_text: "Contact team",
  advisor_cta_link: "/contact",
  popular_badge_text: "Most Popular",
  bottom_cta_title: "Need a custom offer for your goal?",
  bottom_cta_description: "Get a personalized recommendation based on your training level and timeline.",
  bottom_primary_cta_text: "Get custom plan",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "Meet trainers",
  bottom_secondary_cta_link: "/trainers",
};

const normalizeSummaryCards = (value: any): SummaryCard[] => {
  if (!Array.isArray(value)) return emptyPageContent.summary_cards;
  const cleaned = value
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      icon: String(item?.icon ?? "Crown").trim() || "Crown",
    }))
    .filter((item: SummaryCard) => item.label && item.value);
  return cleaned.length ? cleaned : emptyPageContent.summary_cards;
};

function Label({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

export default function AdminPricing() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [featuresInput, setFeaturesInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [pageContent, setPageContent] = useState<PageContent>(emptyPageContent);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageMsg, setPageMsg] = useState("");

  const load = async () => {
    const [{ data: itemData }, { data: pageData }] = await Promise.all([
      supabase
        .from("pricing_items")
        .select("*")
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase.from("pricing_page_content").select("*").eq("id", 1).maybeSingle(),
    ]);

    setRows((itemData as Row[]) || []);

    if (pageData) {
      setPageContent({
        ...emptyPageContent,
        ...(pageData as Partial<PageContent>),
        summary_cards: normalizeSummaryCards((pageData as any)?.summary_cards),
      });
    } else {
      setPageContent(emptyPageContent);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setFeaturesInput("");
    setEditingId(null);
    setMsg("");
  };

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const features = featuresInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...form,
        price: form.kind === "perk" ? "" : form.price,
        cadence: form.kind === "perk" ? "" : form.cadence,
        subtitle: form.kind === "perk" ? "" : form.subtitle,
        is_highlighted: form.kind === "perk" ? false : form.is_highlighted,
        features: form.kind === "perk" ? [] : features,
      };

      if (editingId) {
        const { error } = await supabase.from("pricing_items").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        setMsg("Updated successfully.");
      } else {
        const { error } = await supabase.from("pricing_items").insert(payload);
        if (error) throw new Error(error.message);
        setMsg("Created successfully.");
      }

      resetForm();
      await load();
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (row: Row) => {
    setEditingId(row.id);
    setForm({
      kind: row.kind,
      title: row.title,
      price: row.price,
      cadence: row.cadence,
      subtitle: row.subtitle,
      is_highlighted: row.is_highlighted,
      features: row.features || [],
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setFeaturesInput((row.features || []).join(", "));
    setMsg("");
  };

  const onDelete = async (id: number) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    const { error } = await supabase.from("pricing_items").delete().eq("id", id);
    if (!error) await load();
  };

  const updateSummaryCard = (index: number, key: keyof SummaryCard, value: string) => {
    setPageContent((prev) => {
      const next = [...prev.summary_cards];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, summary_cards: next };
    });
  };

  const addSummaryCard = () => {
    setPageContent((prev) => ({
      ...prev,
      summary_cards: [...prev.summary_cards, { label: "", value: "", icon: "Crown" }],
    }));
  };

  const removeSummaryCard = (index: number) => {
    setPageContent((prev) => ({
      ...prev,
      summary_cards: prev.summary_cards.filter((_, i) => i !== index),
    }));
  };

  const savePageContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPageSaving(true);
    setPageMsg("");

    const payload = {
      id: 1,
      ...pageContent,
      summary_cards: pageContent.summary_cards
        .map((card) => ({
          label: card.label.trim(),
          value: card.value.trim(),
          icon: (card.icon || "Crown").trim(),
        }))
        .filter((card) => card.label && card.value),
    };

    const { error } = await supabase
      .from("pricing_page_content")
      .upsert(payload, { onConflict: "id" });

    setPageMsg(error ? error.message : "Pricing page content saved.");
    setPageSaving(false);
    if (!error) await load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={savePageContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">Pricing Page Content</h2>

        <div className="pt-1 text-sm font-bold text-white">Hero</div>
        <Label>Hero Badge</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_badge} onChange={(e) => setPageContent({ ...pageContent, hero_badge: e.target.value })} />

        <Label>Hero Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_title} onChange={(e) => setPageContent({ ...pageContent, hero_title: e.target.value })} />

        <Label>Hero Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_description} onChange={(e) => setPageContent({ ...pageContent, hero_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Primary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_primary_cta_text} onChange={(e) => setPageContent({ ...pageContent, hero_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Primary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_primary_cta_link} onChange={(e) => setPageContent({ ...pageContent, hero_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Secondary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_secondary_cta_text} onChange={(e) => setPageContent({ ...pageContent, hero_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Secondary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_secondary_cta_link} onChange={(e) => setPageContent({ ...pageContent, hero_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Summary Cards</h3>
            <button type="button" onClick={addSummaryCard} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Card
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {pageContent.summary_cards.map((card, idx) => (
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

        <div className="pt-1 text-sm font-bold text-white">Benefits Sidebar</div>
        <Label>Benefits Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.benefits_title} onChange={(e) => setPageContent({ ...pageContent, benefits_title: e.target.value })} />
        <Label>Benefits Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.benefits_description} onChange={(e) => setPageContent({ ...pageContent, benefits_description: e.target.value })} />

        <Label>Advisor Card Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.advisor_title} onChange={(e) => setPageContent({ ...pageContent, advisor_title: e.target.value })} />
        <Label>Advisor Card Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.advisor_description} onChange={(e) => setPageContent({ ...pageContent, advisor_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Advisor CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.advisor_cta_text} onChange={(e) => setPageContent({ ...pageContent, advisor_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Advisor CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.advisor_cta_link} onChange={(e) => setPageContent({ ...pageContent, advisor_cta_link: e.target.value })} />
          </div>
        </div>

        <Label>Popular Badge Text</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.popular_badge_text} onChange={(e) => setPageContent({ ...pageContent, popular_badge_text: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Bottom CTA</div>
        <Label>Bottom CTA Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_cta_title} onChange={(e) => setPageContent({ ...pageContent, bottom_cta_title: e.target.value })} />
        <Label>Bottom CTA Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_cta_description} onChange={(e) => setPageContent({ ...pageContent, bottom_cta_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bottom Primary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_primary_cta_text} onChange={(e) => setPageContent({ ...pageContent, bottom_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Bottom Primary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_primary_cta_link} onChange={(e) => setPageContent({ ...pageContent, bottom_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bottom Secondary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_secondary_cta_text} onChange={(e) => setPageContent({ ...pageContent, bottom_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Bottom Secondary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.bottom_secondary_cta_link} onChange={(e) => setPageContent({ ...pageContent, bottom_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        {pageMsg && <p className="text-sm text-zinc-300">{pageMsg}</p>}
        <button type="submit" disabled={pageSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
          {pageSaving ? "Saving..." : "Save Pricing Page Content"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{editingId ? "Edit" : "Add"} Membership Plan</h2>
          <p className="text-sm text-zinc-400">Active plan names and prices appear in Billing. Edit the price here whenever a membership rate changes.</p>

          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          >
            <option value="plan">Membership Plan</option>
            <option value="perk">Top Feature Chip</option>
          </select>

          <input
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder={form.kind === "perk" ? "Feature text" : "Plan name"}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          {form.kind === "plan" && (
            <>
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Price (e.g. Rs 3,500)"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Cadence (e.g. /month)"
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value })}
              />
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Subtitle"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                required
              />
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Features (comma separated)"
                value={featuresInput}
                onChange={(e) => setFeaturesInput(e.target.value)}
              />
              <label className="flex items-center gap-2 text-zinc-200">
                <input
                  type="checkbox"
                  checked={form.is_highlighted}
                  onChange={(e) => setForm({ ...form, is_highlighted: e.target.checked })}
                />
                Mark as Most Popular
              </label>
            </>
          )}

          <input
            type="number"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />

          <label className="flex items-center gap-2 text-zinc-200">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active
          </label>

          {msg && <p className="text-sm text-zinc-300">{msg}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Saved Membership Plans and Benefits</h2>
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-xs text-zinc-400">{r.kind === "plan" ? "Plan Card" : "Top Feature Chip"}</div>
              <div className="text-white font-bold mt-1">{r.title}</div>
              {r.kind === "plan" && (
                <>
                  <div className="text-zinc-300 text-sm mt-1">
                    {r.price}
                    {r.cadence}
                  </div>
                  <div className="text-zinc-300 text-sm mt-1">{r.subtitle}</div>
                  <div className="text-xs text-zinc-400 mt-1">{r.is_highlighted ? "Most Popular" : "Normal"}</div>
                </>
              )}
              <div className="text-xs text-zinc-400 mt-1">
                order: {r.sort_order} | {r.is_active ? "active" : "inactive"}
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEdit(r)} className="rounded-lg bg-white/10 px-3 py-1 text-white">
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(r.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">
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
