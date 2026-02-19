import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type HeroMetric = {
  label: string;
  value: string;
  icon: string;
};

type GalleryImage = {
  url: string;
  alt: string;
};

type Content = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;

  hero_metrics: HeroMetric[];

  status_title: string;
  zones_title: string;
  coaches_title: string;
  coaches_subtitle: string;

  maximus_badge: string;
  maximus_title: string;
  maximus_description: string;
  maximus_image: string;
  maximus_learn_more_link: string;
  maximus_instagram_link: string;

  gallery_title: string;
  gallery_images: GalleryImage[];

  testimonials_title: string;
  testimonials_subtitle: string;

  final_cta_title: string;
  final_cta_description: string;
  final_primary_cta_text: string;
  final_primary_cta_link: string;
  final_secondary_cta_text: string;
  final_secondary_cta_link: string;
};

type StatusRow = {
  id: number;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
};

type PointRow = {
  id: number;
  point: string;
  sort_order: number;
  is_active: boolean;
};

const iconOptions = [
  "Dumbbell",
  "ShieldCheck",
  "Star",
  "Trophy",
  "Clock3",
  "Activity",
  "BarChart3",
];

const emptyContent: Content = {
  hero_badge: "A&A Health Club | Butwal, Rupandehi",
  hero_title: "Train hard. Lift right. Stay consistent.",
  hero_description:
    "A serious training environment with proper coaching, modern equipment, and programs for strength, fat loss, and performance.",
  hero_image:
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Book trial session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View membership",
  hero_secondary_cta_link: "/pricing",
  hero_metrics: [
    { label: "Dumbbell Range", value: "2.5kg-50kg", icon: "Dumbbell" },
    { label: "Power Racks", value: "8", icon: "ShieldCheck" },
    { label: "Coaches", value: "3", icon: "Star" },
    { label: "Active Members", value: "500+", icon: "Trophy" },
  ],
  status_title: "Today at A&A",
  zones_title: "Training Zones",
  coaches_title: "Coaches on Floor",
  coaches_subtitle: "Train with experienced coaches for strength, fat loss, and functional performance.",
  maximus_badge: "Maximus Strength",
  maximus_title: "Powerlifting Group",
  maximus_description:
    "Dedicated powerlifting training for lifters focused on Squat, Bench, and Deadlift progression.",
  maximus_image:
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  maximus_learn_more_link: "/about#maximus-strength",
  maximus_instagram_link: "https://www.instagram.com/teammaximusstrength/",
  gallery_title: "Inside Our Gym",
  gallery_images: [
    {
      url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
      alt: "Gym gallery 1",
    },
    {
      url: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
      alt: "Gym gallery 2",
    },
    {
      url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1600&auto=format&fit=crop",
      alt: "Gym gallery 3",
    },
    {
      url: "https://images.unsplash.com/photo-1549476464-37392f717541?q=80&w=1600&auto=format&fit=crop",
      alt: "Gym gallery 4",
    },
  ],
  testimonials_title: "What Members Say",
  testimonials_subtitle: "Real feedback from A&A members.",
  final_cta_title: "Ready to start your transformation?",
  final_cta_description: "Book a trial session and get a personalized training roadmap.",
  final_primary_cta_text: "Book trial",
  final_primary_cta_link: "/contact",
  final_secondary_cta_text: "View pricing",
  final_secondary_cta_link: "/pricing",
};

const emptyStatusForm = {
  label: "",
  value: "",
  sort_order: 0,
  is_active: true,
};

const emptyPointForm = {
  point: "",
  sort_order: 0,
  is_active: true,
};

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

const normalizeHeroMetrics = (value: any): HeroMetric[] => {
  if (!Array.isArray(value)) return emptyContent.hero_metrics;
  const cleaned = value
    .map((m: any) => ({
      label: String(m?.label ?? "").trim(),
      value: String(m?.value ?? "").trim(),
      icon: String(m?.icon ?? "Dumbbell").trim() || "Dumbbell",
    }))
    .filter((m: HeroMetric) => m.label && m.value);
  return cleaned.length ? cleaned : emptyContent.hero_metrics;
};

const normalizeGalleryImages = (value: any): GalleryImage[] => {
  if (!Array.isArray(value)) return emptyContent.gallery_images;
  const cleaned = value
    .map((g: any) =>
      typeof g === "string"
        ? { url: g.trim(), alt: "" }
        : { url: String(g?.url ?? "").trim(), alt: String(g?.alt ?? "").trim() }
    )
    .filter((g: GalleryImage) => g.url);
  return cleaned.length ? cleaned : emptyContent.gallery_images;
};

export default function AdminHome() {
  const [content, setContent] = useState<Content>(emptyContent);
  const [contentMsg, setContentMsg] = useState("");

  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [statusForm, setStatusForm] = useState(emptyStatusForm);
  const [statusEditingId, setStatusEditingId] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const [pointRows, setPointRows] = useState<PointRow[]>([]);
  const [pointForm, setPointForm] = useState(emptyPointForm);
  const [pointEditingId, setPointEditingId] = useState<number | null>(null);
  const [pointMsg, setPointMsg] = useState("");

  const load = async () => {
    const [{ data: contentData }, { data: statusData }, { data: pointsData }] = await Promise.all([
      supabase.from("home_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("home_status_items").select("*").order("sort_order", { ascending: true }),
      supabase.from("home_maximus_points").select("*").order("sort_order", { ascending: true }),
    ]);

    if (contentData) {
      setContent({
        ...emptyContent,
        ...(contentData as Partial<Content>),
        hero_metrics: normalizeHeroMetrics((contentData as any).hero_metrics),
        gallery_images: normalizeGalleryImages((contentData as any).gallery_images),
      });
    } else {
      setContent(emptyContent);
    }

    setStatusRows((statusData as StatusRow[]) || []);
    setPointRows((pointsData as PointRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const updateHeroMetric = (index: number, key: keyof HeroMetric, value: string) => {
    setContent((prev) => {
      const next = [...prev.hero_metrics];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, hero_metrics: next };
    });
  };

  const addHeroMetric = () => {
    setContent((prev) => ({
      ...prev,
      hero_metrics: [...prev.hero_metrics, { label: "", value: "", icon: "Dumbbell" }],
    }));
  };

  const removeHeroMetric = (index: number) => {
    setContent((prev) => ({
      ...prev,
      hero_metrics: prev.hero_metrics.filter((_, i) => i !== index),
    }));
  };

  const updateGalleryImage = (index: number, key: keyof GalleryImage, value: string) => {
    setContent((prev) => {
      const next = [...prev.gallery_images];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, gallery_images: next };
    });
  };

  const addGalleryImage = () => {
    setContent((prev) => ({
      ...prev,
      gallery_images: [...prev.gallery_images, { url: "", alt: "" }],
    }));
  };

  const removeGalleryImage = (index: number) => {
    setContent((prev) => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index),
    }));
  };

  const saveContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      id: 1,
      ...content,
      hero_metrics: content.hero_metrics
        .map((m) => ({
          label: m.label.trim(),
          value: m.value.trim(),
          icon: (m.icon || "Dumbbell").trim(),
        }))
        .filter((m) => m.label && m.value),
      gallery_images: content.gallery_images
        .map((g) => ({
          url: g.url.trim(),
          alt: g.alt.trim(),
        }))
        .filter((g) => g.url),
    };

    const { error } = await supabase.from("home_content").upsert(payload, { onConflict: "id" });
    setContentMsg(error ? error.message : "Home content saved.");
    if (!error) await load();
  };

  const saveStatus = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMsg("");

    if (statusEditingId) {
      const { error } = await supabase
        .from("home_status_items")
        .update(statusForm)
        .eq("id", statusEditingId);
      if (error) return setStatusMsg(error.message);
      setStatusMsg("Status updated.");
    } else {
      const { error } = await supabase.from("home_status_items").insert(statusForm);
      if (error) return setStatusMsg(error.message);
      setStatusMsg("Status created.");
    }

    setStatusForm(emptyStatusForm);
    setStatusEditingId(null);
    await load();
  };

  const onEditStatus = (row: StatusRow) => {
    setStatusEditingId(row.id);
    setStatusForm({
      label: row.label,
      value: row.value,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
  };

  const onDeleteStatus = async (id: number) => {
    const ok = window.confirm("Delete this status item?");
    if (!ok) return;
    await supabase.from("home_status_items").delete().eq("id", id);
    await load();
  };

  const resetStatusForm = () => {
    setStatusEditingId(null);
    setStatusForm(emptyStatusForm);
    setStatusMsg("");
  };

  const savePoint = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPointMsg("");

    if (pointEditingId) {
      const { error } = await supabase
        .from("home_maximus_points")
        .update(pointForm)
        .eq("id", pointEditingId);
      if (error) return setPointMsg(error.message);
      setPointMsg("Point updated.");
    } else {
      const { error } = await supabase.from("home_maximus_points").insert(pointForm);
      if (error) return setPointMsg(error.message);
      setPointMsg("Point created.");
    }

    setPointForm(emptyPointForm);
    setPointEditingId(null);
    await load();
  };

  const onEditPoint = (row: PointRow) => {
    setPointEditingId(row.id);
    setPointForm({
      point: row.point,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
  };

  const onDeletePoint = async (id: number) => {
    const ok = window.confirm("Delete this Maximus point?");
    if (!ok) return;
    await supabase.from("home_maximus_points").delete().eq("id", id);
    await load();
  };

  const resetPointForm = () => {
    setPointEditingId(null);
    setPointForm(emptyPointForm);
    setPointMsg("");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">Home Content</h2>

        <div className="pt-1 text-sm font-bold text-white">Hero</div>
        <FieldLabel>Hero Badge</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_badge} onChange={(e) => setContent({ ...content, hero_badge: e.target.value })} />

        <FieldLabel>Hero Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_title} onChange={(e) => setContent({ ...content, hero_title: e.target.value })} />

        <FieldLabel>Hero Description</FieldLabel>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_description} onChange={(e) => setContent({ ...content, hero_description: e.target.value })} />

        <FieldLabel>Hero Image URL</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_image} onChange={(e) => setContent({ ...content, hero_image: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Primary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_primary_cta_text} onChange={(e) => setContent({ ...content, hero_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Primary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_primary_cta_link} onChange={(e) => setContent({ ...content, hero_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Secondary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_secondary_cta_text} onChange={(e) => setContent({ ...content, hero_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Secondary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.hero_secondary_cta_link} onChange={(e) => setContent({ ...content, hero_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Hero Metrics</h3>
            <button type="button" onClick={addHeroMetric} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Metric
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {content.hero_metrics.map((m, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FieldLabel>Label</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.label} onChange={(e) => updateHeroMetric(idx, "label", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Value</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.value} onChange={(e) => updateHeroMetric(idx, "value", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Icon</FieldLabel>
                  <select className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.icon} onChange={(e) => updateHeroMetric(idx, "icon", e.target.value)}>
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon} className="bg-black">
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeHeroMetric(idx)} className="md:col-span-3 rounded-lg bg-red-500/20 px-3 py-2 text-red-300 text-xs">
                  Remove Metric
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1 text-sm font-bold text-white">Section Titles</div>
        <FieldLabel>Status Section Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.status_title} onChange={(e) => setContent({ ...content, status_title: e.target.value })} />

        <FieldLabel>Zones Section Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.zones_title} onChange={(e) => setContent({ ...content, zones_title: e.target.value })} />

        <FieldLabel>Coaches Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.coaches_title} onChange={(e) => setContent({ ...content, coaches_title: e.target.value })} />

        <FieldLabel>Coaches Subtitle</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.coaches_subtitle} onChange={(e) => setContent({ ...content, coaches_subtitle: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Maximus Section</div>
        <FieldLabel>Maximus Badge</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_badge} onChange={(e) => setContent({ ...content, maximus_badge: e.target.value })} />

        <FieldLabel>Maximus Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_title} onChange={(e) => setContent({ ...content, maximus_title: e.target.value })} />

        <FieldLabel>Maximus Description</FieldLabel>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_description} onChange={(e) => setContent({ ...content, maximus_description: e.target.value })} />

        <FieldLabel>Maximus Image URL</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_image} onChange={(e) => setContent({ ...content, maximus_image: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Maximus Learn More Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_learn_more_link} onChange={(e) => setContent({ ...content, maximus_learn_more_link: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Maximus Instagram Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.maximus_instagram_link} onChange={(e) => setContent({ ...content, maximus_instagram_link: e.target.value })} />
          </div>
        </div>

        <div className="pt-1 text-sm font-bold text-white">Gallery Section</div>
        <FieldLabel>Gallery Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.gallery_title} onChange={(e) => setContent({ ...content, gallery_title: e.target.value })} />

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Gallery Images</h3>
            <button type="button" onClick={addGalleryImage} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Image
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {content.gallery_images.map((g, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel>Image URL</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={g.url} onChange={(e) => updateGalleryImage(idx, "url", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Alt Text</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={g.alt} onChange={(e) => updateGalleryImage(idx, "alt", e.target.value)} />
                </div>
                <button type="button" onClick={() => removeGalleryImage(idx)} className="md:col-span-2 rounded-lg bg-red-500/20 px-3 py-2 text-red-300 text-xs">
                  Remove Image
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-1 text-sm font-bold text-white">Testimonials Section</div>
        <FieldLabel>Testimonials Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.testimonials_title} onChange={(e) => setContent({ ...content, testimonials_title: e.target.value })} />

        <FieldLabel>Testimonials Subtitle</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.testimonials_subtitle} onChange={(e) => setContent({ ...content, testimonials_subtitle: e.target.value })} />

        <div className="pt-1 text-sm font-bold text-white">Final CTA Section</div>
        <FieldLabel>Final CTA Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_cta_title} onChange={(e) => setContent({ ...content, final_cta_title: e.target.value })} />

        <FieldLabel>Final CTA Description</FieldLabel>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_cta_description} onChange={(e) => setContent({ ...content, final_cta_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Final Primary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_primary_cta_text} onChange={(e) => setContent({ ...content, final_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Final Primary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_primary_cta_link} onChange={(e) => setContent({ ...content, final_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Final Secondary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_secondary_cta_text} onChange={(e) => setContent({ ...content, final_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Final Secondary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={content.final_secondary_cta_link} onChange={(e) => setContent({ ...content, final_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        {contentMsg && <p className="text-sm text-zinc-300">{contentMsg}</p>}
        <button className="rounded-xl bg-white px-5 py-3 font-black text-black">Save Home Content</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={saveStatus} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{statusEditingId ? "Edit" : "Add"} Today Status Card</h2>

          <FieldLabel>Label</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={statusForm.label} onChange={(e) => setStatusForm({ ...statusForm, label: e.target.value })} required />

          <FieldLabel>Value</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={statusForm.value} onChange={(e) => setStatusForm({ ...statusForm, value: e.target.value })} required />

          <FieldLabel>Sort Order</FieldLabel>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={statusForm.sort_order} onChange={(e) => setStatusForm({ ...statusForm, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={statusForm.is_active} onChange={(e) => setStatusForm({ ...statusForm, is_active: e.target.checked })} />
            Active
          </label>

          {statusMsg && <p className="text-sm text-zinc-300">{statusMsg}</p>}

          <div className="flex gap-2">
            <button className="rounded-xl bg-white px-5 py-3 font-black text-black">{statusEditingId ? "Update" : "Create"}</button>
            {statusEditingId && (
              <button type="button" onClick={resetStatusForm} className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Today Status Cards</h2>
          {statusRows.map((row) => (
            <div key={row.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-white font-bold">{row.label}</div>
              <div className="text-zinc-300 text-sm mt-1">{row.value}</div>
              <div className="text-xs text-zinc-400 mt-1">
                order: {row.sort_order} | {row.is_active ? "active" : "inactive"}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditStatus(row)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
                <button type="button" onClick={() => onDeleteStatus(row.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={savePoint} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{pointEditingId ? "Edit" : "Add"} Maximus Point</h2>

          <FieldLabel>Point</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pointForm.point} onChange={(e) => setPointForm({ ...pointForm, point: e.target.value })} required />

          <FieldLabel>Sort Order</FieldLabel>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={pointForm.sort_order} onChange={(e) => setPointForm({ ...pointForm, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={pointForm.is_active} onChange={(e) => setPointForm({ ...pointForm, is_active: e.target.checked })} />
            Active
          </label>

          {pointMsg && <p className="text-sm text-zinc-300">{pointMsg}</p>}

          <div className="flex gap-2">
            <button className="rounded-xl bg-white px-5 py-3 font-black text-black">{pointEditingId ? "Update" : "Create"}</button>
            {pointEditingId && (
              <button type="button" onClick={resetPointForm} className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Maximus Points</h2>
          {pointRows.map((row) => (
            <div key={row.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-white font-bold">{row.point}</div>
              <div className="text-xs text-zinc-400 mt-1">
                order: {row.sort_order} | {row.is_active ? "active" : "inactive"}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditPoint(row)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
                <button type="button" onClick={() => onDeletePoint(row.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
