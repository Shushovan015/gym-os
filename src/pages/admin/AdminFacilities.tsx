import { useEffect, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type Kind = "zone" | "amenity";

type Row = {
  id: number;
  kind: Kind;
  title: string;
  description: string;
  tag: string;
  image: string;
  sort_order: number;
  is_active: boolean;
};

type FormState = {
  kind: Kind;
  title: string;
  description: string;
  tag: string;
  image: string;
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
  zone_explorer_title: string;
  zone_explorer_description: string;
  amenities_title: string;
  amenities_description: string;
  tour_title: string;
  tour_description: string;
  tour_primary_cta_text: string;
  tour_primary_cta_link: string;
  tour_secondary_cta_text: string;
  tour_secondary_cta_link: string;
};

const iconOptions = ["Building2", "Sparkles", "Camera", "ShieldCheck"];

const emptyForm: FormState = {
  kind: "zone",
  title: "",
  description: "",
  tag: "",
  image: "",
  sort_order: 0,
  is_active: true,
};

const emptyPageContent: PageContent = {
  hero_badge: "Premium Infrastructure",
  hero_title: "Facilities built for serious results",
  hero_description: "Every zone is designed for performance, safety, and consistency.",
  hero_primary_cta_text: "Book a gym tour",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View memberships",
  hero_secondary_cta_link: "/pricing",
  summary_cards: [
    { label: "Training Zones", value: "{zones}", icon: "Building2" },
    { label: "Amenities", value: "{amenities}+", icon: "Sparkles" },
    { label: "Zone Photos", value: "{photos}", icon: "Camera" },
    { label: "Hours", value: "5:00 AM - 9:00 PM", icon: "ShieldCheck" },
  ],
  zone_explorer_title: "Zone Explorer",
  zone_explorer_description: "Select a zone to preview the training space.",
  amenities_title: "Included Features",
  amenities_description: "Everything available with standard membership access.",
  tour_title: "Want a guided gym tour?",
  tour_description: "Visit the club and explore every training zone with our team.",
  tour_primary_cta_text: "Book a visit",
  tour_primary_cta_link: "/contact",
  tour_secondary_cta_text: "Meet coaches",
  tour_secondary_cta_link: "/trainers",
};

const normalizeSummaryCards = (value: any): SummaryCard[] => {
  if (!Array.isArray(value)) return emptyPageContent.summary_cards;
  const cleaned = value
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      icon: String(item?.icon ?? "Building2").trim() || "Building2",
    }))
    .filter((item: SummaryCard) => item.label && item.value);
  return cleaned.length ? cleaned : emptyPageContent.summary_cards;
};

function Label({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

export default function AdminFacilities() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [pageContent, setPageContent] = useState<PageContent>(emptyPageContent);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageMsg, setPageMsg] = useState("");

  const load = async () => {
    const [{ data: itemData }, { data: pageData }] = await Promise.all([
      supabase
        .from("facility_items")
        .select("*")
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase.from("facilities_page_content").select("*").eq("id", 1).maybeSingle(),
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

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `facilities/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("gym-media").upload(path, file);
    if (error) throw new Error(error.message);
    return supabase.storage.from("gym-media").getPublicUrl(path).data.publicUrl;
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setImageFile(null);
    setPreview("");
    setMsg("");
  };

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      let imageUrl = form.image.trim();

      if (form.kind === "zone" && imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const payload = {
        ...form,
        image: form.kind === "amenity" ? "" : imageUrl,
        description: form.kind === "amenity" ? "" : form.description,
        tag: form.kind === "amenity" ? "" : form.tag,
      };

      if (editingId) {
        const { error } = await supabase.from("facility_items").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
        setMsg("Updated successfully.");
      } else {
        const { error } = await supabase.from("facility_items").insert(payload);
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
      description: row.description,
      tag: row.tag,
      image: row.image,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setImageFile(null);
    setPreview(row.image || "");
    setMsg("");
  };

  const onDelete = async (id: number) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    const { error } = await supabase.from("facility_items").delete().eq("id", id);
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
      summary_cards: [...prev.summary_cards, { label: "", value: "", icon: "Building2" }],
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
          icon: (card.icon || "Building2").trim(),
        }))
        .filter((card) => card.label && card.value),
    };

    const { error } = await supabase
      .from("facilities_page_content")
      .upsert(payload, { onConflict: "id" });

    setPageMsg(error ? error.message : "Facilities page content saved.");
    setPageSaving(false);
    if (!error) await load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={savePageContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">Facilities Page Content</h2>

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

        <div className="pt-1 text-sm font-bold text-white">Zone Explorer</div>
        <Label>Explorer Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.zone_explorer_title} onChange={(e) => setPageContent({ ...pageContent, zone_explorer_title: e.target.value })} />
        <Label>Explorer Description</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.zone_explorer_description} onChange={(e) => setPageContent({ ...pageContent, zone_explorer_description: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Amenities Section</div>
        <Label>Amenities Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.amenities_title} onChange={(e) => setPageContent({ ...pageContent, amenities_title: e.target.value })} />
        <Label>Amenities Description</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.amenities_description} onChange={(e) => setPageContent({ ...pageContent, amenities_description: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Bottom CTA</div>
        <Label>Tour Title</Label>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_title} onChange={(e) => setPageContent({ ...pageContent, tour_title: e.target.value })} />
        <Label>Tour Description</Label>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_description} onChange={(e) => setPageContent({ ...pageContent, tour_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Primary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_primary_cta_text} onChange={(e) => setPageContent({ ...pageContent, tour_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Primary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_primary_cta_link} onChange={(e) => setPageContent({ ...pageContent, tour_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Secondary CTA Text</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_secondary_cta_text} onChange={(e) => setPageContent({ ...pageContent, tour_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Secondary CTA Link</Label>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pageContent.tour_secondary_cta_link} onChange={(e) => setPageContent({ ...pageContent, tour_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        {pageMsg && <p className="text-sm text-zinc-300">{pageMsg}</p>}
        <button type="submit" disabled={pageSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
          {pageSaving ? "Saving..." : "Save Facilities Page Content"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">
            {editingId ? "Edit" : "Add"} Facilities Item
          </h2>

          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          >
            <option value="zone">Zone</option>
            <option value="amenity">Amenity</option>
          </select>

          <input
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder={form.kind === "amenity" ? "Amenity title" : "Zone title"}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          {form.kind === "zone" && (
            <>
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Tag"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />

              <textarea
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />

              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                placeholder="Image URL (optional)"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />

              <input
                type="file"
                accept="image/*"
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
                onChange={onFileChange}
              />

              {(preview || form.image) && (
                <img
                  src={preview || form.image}
                  alt="Preview"
                  className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/20"
                />
              )}
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
          <h2 className="text-xl font-black text-white">Saved Facilities Items</h2>

          {rows.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-xs text-zinc-400">
                {r.kind === "zone" ? "Zone" : "Amenity"}
              </div>

              <div className="text-white font-bold mt-1">{r.title}</div>
              {!!r.tag && <div className="text-zinc-300 text-xs mt-1">{r.tag}</div>}
              {!!r.description && <div className="text-zinc-300 text-sm mt-1">{r.description}</div>}
              <div className="text-xs text-zinc-400 mt-1">
                order: {r.sort_order} | {r.is_active ? "active" : "inactive"}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  className="rounded-lg bg-white/10 px-3 py-1 text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300"
                >
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
