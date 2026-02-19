import { useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type Row = {
  id: number;
  title: string;
  category: string;
  price: string;
  description: string;
  image: string;
  badge: string;
  inquire_link: string;
  sort_order: number;
  is_featured: boolean;
  is_active: boolean;
};

type FormState = {
  title: string;
  category: string;
  price: string;
  description: string;
  image: string;
  badge: string;
  inquire_link: string;
  sort_order: number;
  is_featured: boolean;
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
  hero_image: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  summary_cards: SummaryCard[];
  catalog_title: string;
  catalog_description: string;
  inquiry_button_text: string;
  inquiry_link_default: string;
  items_per_page: number;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
};

const iconOptions = ["ShoppingBag", "Sparkles", "ShieldCheck", "Truck", "Shirt", "Pill", "Dumbbell"];

const emptyForm: FormState = {
  title: "",
  category: "Supplements",
  price: "",
  description: "",
  image: "",
  badge: "",
  inquire_link: "/contact",
  sort_order: 0,
  is_featured: false,
  is_active: true,
};

const emptyPageContent: PageContent = {
  hero_badge: "A&A Pro Shop",
  hero_title: "Supplements, Accessories & Clothing",
  hero_description: "Curated gym essentials for strength, performance, and recovery.",
  hero_image:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Browse products",
  hero_primary_cta_link: "/shop",
  hero_secondary_cta_text: "Contact team",
  hero_secondary_cta_link: "/contact",
  summary_cards: [
    { label: "Products", value: "{products}+", icon: "ShoppingBag" },
    { label: "Categories", value: "{categories}", icon: "Sparkles" },
    { label: "Featured", value: "{featured}", icon: "ShieldCheck" },
    { label: "Fast Inquiry", value: "< 24 hrs", icon: "Truck" },
  ],
  catalog_title: "Product Catalog",
  catalog_description: "Select a category to browse what is available in the gym.",
  inquiry_button_text: "Inquire now",
  inquiry_link_default: "/contact",
  items_per_page: 8,
  bottom_cta_title: "Need help choosing?",
  bottom_cta_description: "Message us with your goal and we will suggest the right product.",
  bottom_primary_cta_text: "Contact support",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "View memberships",
  bottom_secondary_cta_link: "/pricing",
};

const normalizeSummaryCards = (value: any): SummaryCard[] => {
  if (!Array.isArray(value)) return emptyPageContent.summary_cards;
  const cleaned = value
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      icon: String(item?.icon ?? "ShoppingBag").trim() || "ShoppingBag",
    }))
    .filter((item: SummaryCard) => item.label && item.value);
  return cleaned.length ? cleaned : emptyPageContent.summary_cards;
};

function Label({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

export default function AdminProShop() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [pageContent, setPageContent] = useState<PageContent>(emptyPageContent);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageMsg, setPageMsg] = useState("");

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))),
    [rows]
  );

  const load = async () => {
    const [{ data: itemData }, { data: pageData }] = await Promise.all([
      supabase
        .from("shop_items")
        .select("*")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase.from("shop_page_content").select("*").eq("id", 1).maybeSingle(),
    ]);

    setRows((itemData as Row[]) || []);

    if (pageData) {
      setPageContent({
        ...emptyPageContent,
        ...(pageData as Partial<PageContent>),
        summary_cards: normalizeSummaryCards((pageData as any)?.summary_cards),
        items_per_page: Number((pageData as any)?.items_per_page || 8),
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
    setEditingId(null);
    setMsg("");
  };

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        category: form.category.trim(),
        price: form.price.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        badge: form.badge.trim(),
        inquire_link: (form.inquire_link || "/contact").trim(),
        sort_order: Number(form.sort_order || 0),
      };

      if (!payload.title || !payload.category) {
        setMsg("Product title and category are required.");
        setSaving(false);
        return;
      }

      if (editingId) {
        const { error } = await supabase.from("shop_items").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        setMsg("Product updated.");
      } else {
        const { error } = await supabase.from("shop_items").insert(payload);
        if (error) throw new Error(error.message);
        setMsg("Product created.");
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
      title: row.title || "",
      category: row.category || "",
      price: row.price || "",
      description: row.description || "",
      image: row.image || "",
      badge: row.badge || "",
      inquire_link: row.inquire_link || "/contact",
      sort_order: row.sort_order || 0,
      is_featured: !!row.is_featured,
      is_active: row.is_active !== false,
    });
    setMsg("");
  };

  const onDelete = async (id: number) => {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;
    const { error } = await supabase.from("shop_items").delete().eq("id", id);
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
      summary_cards: [...prev.summary_cards, { label: "", value: "", icon: "ShoppingBag" }],
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
      items_per_page: Math.max(1, Number(pageContent.items_per_page || 8)),
      summary_cards: pageContent.summary_cards
        .map((card) => ({
          label: card.label.trim(),
          value: card.value.trim(),
          icon: (card.icon || "ShoppingBag").trim(),
        }))
        .filter((card) => card.label && card.value),
    };

    const { error } = await supabase.from("shop_page_content").upsert(payload, { onConflict: "id" });
    setPageMsg(error ? error.message : "ProShop page content saved.");
    setPageSaving(false);
    if (!error) await load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={savePageContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">ProShop Page Content</h2>

        <div className="pt-1 text-sm font-bold text-white">Hero</div>
        <Label>Hero Badge</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_badge} onChange={(e) => setPageContent({ ...pageContent, hero_badge: e.target.value })} />

        <Label>Hero Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_title} onChange={(e) => setPageContent({ ...pageContent, hero_title: e.target.value })} />

        <Label>Hero Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_description} onChange={(e) => setPageContent({ ...pageContent, hero_description: e.target.value })} />

        <Label>Hero Background Image URL</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.hero_image} onChange={(e) => setPageContent({ ...pageContent, hero_image: e.target.value })} />

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

        <div className="pt-1 text-sm font-bold text-white">Catalog Section</div>
        <Label>Catalog Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.catalog_title} onChange={(e) => setPageContent({ ...pageContent, catalog_title: e.target.value })} />

        <Label>Catalog Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.catalog_description} onChange={(e) => setPageContent({ ...pageContent, catalog_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Inquiry Button Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.inquiry_button_text} onChange={(e) => setPageContent({ ...pageContent, inquiry_button_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Default Inquiry Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.inquiry_link_default} onChange={(e) => setPageContent({ ...pageContent, inquiry_link_default: e.target.value })} />
          </div>
        </div>

        <Label>Items Per Page</Label>
        <input
          type="number"
          min={1}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          value={pageContent.items_per_page}
          onChange={(e) => setPageContent({ ...pageContent, items_per_page: Number(e.target.value) || 8 })}
        />

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
          {pageSaving ? "Saving..." : "Save ProShop Page Content"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{editingId ? "Edit" : "Add"} Product</h2>

          <Label>Product Title</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />

          <Label>Category</Label>
          <input
            list="proshop-category-options"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          />
          <datalist id="proshop-category-options">
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat} />
            ))}
            <option value="Supplements" />
            <option value="Accessories" />
            <option value="Clothing" />
          </datalist>

          <Label>Price</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />

          <Label>Description</Label>
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <Label>Image URL</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />

          <Label>Badge (optional)</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />

          <Label>Inquire Link</Label>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.inquire_link} onChange={(e) => setForm({ ...form, inquire_link: e.target.value })} />

          <Label>Sort Order</Label>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            Featured product
          </label>

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>

          {msg && <p className="text-sm text-zinc-300">{msg}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Saved Products</h2>

          {rows.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-xs text-zinc-400">{r.category}</div>
              <div className="text-white font-bold mt-1">{r.title}</div>
              <div className="text-zinc-300 text-sm mt-1">{r.price}</div>
              <div className="text-zinc-300 text-sm mt-1">{r.description}</div>
              <div className="text-xs text-zinc-400 mt-1">
                order: {r.sort_order} | {r.is_featured ? "featured" : "normal"} | {r.is_active ? "active" : "inactive"}
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
