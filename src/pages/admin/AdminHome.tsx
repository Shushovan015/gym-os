import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type Content = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
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
  testimonials_title: string;
  testimonials_subtitle: string;
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

const emptyContent: Content = {
  hero_badge: "",
  hero_title: "",
  hero_description: "",
  hero_image: "",
  hero_primary_cta_text: "Book trial session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View membership",
  hero_secondary_cta_link: "/pricing",
  status_title: "Today at A&A",
  zones_title: "Training Zones",
  coaches_title: "Coaches on Floor",
  coaches_subtitle: "",
  maximus_badge: "Maximus Strength",
  maximus_title: "Powerlifting Group",
  maximus_description: "",
  maximus_image: "",
  maximus_learn_more_link: "/about#maximus-strength",
  maximus_instagram_link: "https://www.instagram.com/teammaximusstrength/",
  testimonials_title: "What Members Say",
  testimonials_subtitle: "Real feedback from A&A members.",
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

    if (contentData) setContent({ ...emptyContent, ...contentData });
    setStatusRows((statusData as StatusRow[]) || []);
    setPointRows((pointsData as PointRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { error } = await supabase
      .from("home_content")
      .upsert({ id: 1, ...content }, { onConflict: "id" });

    setContentMsg(error ? error.message : "Home content saved.");
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
      <form onSubmit={saveContent} className="rounded-2xl bg-black/35 p-6 space-y-3 max-w-4xl">
        <h2 className="text-xl font-black text-white">Home Content</h2>

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero badge" value={content.hero_badge} onChange={(e) => setContent({ ...content, hero_badge: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero title" value={content.hero_title} onChange={(e) => setContent({ ...content, hero_title: e.target.value })} />
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero description" value={content.hero_description} onChange={(e) => setContent({ ...content, hero_description: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Hero image URL" value={content.hero_image} onChange={(e) => setContent({ ...content, hero_image: e.target.value })} />

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Primary CTA text" value={content.hero_primary_cta_text} onChange={(e) => setContent({ ...content, hero_primary_cta_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Primary CTA link" value={content.hero_primary_cta_link} onChange={(e) => setContent({ ...content, hero_primary_cta_link: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Secondary CTA text" value={content.hero_secondary_cta_text} onChange={(e) => setContent({ ...content, hero_secondary_cta_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Secondary CTA link" value={content.hero_secondary_cta_link} onChange={(e) => setContent({ ...content, hero_secondary_cta_link: e.target.value })} />

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Status section title (Today at A&A)" value={content.status_title} onChange={(e) => setContent({ ...content, status_title: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Zones section title" value={content.zones_title} onChange={(e) => setContent({ ...content, zones_title: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Coaches title" value={content.coaches_title} onChange={(e) => setContent({ ...content, coaches_title: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Coaches subtitle" value={content.coaches_subtitle} onChange={(e) => setContent({ ...content, coaches_subtitle: e.target.value })} />

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus badge" value={content.maximus_badge} onChange={(e) => setContent({ ...content, maximus_badge: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus title" value={content.maximus_title} onChange={(e) => setContent({ ...content, maximus_title: e.target.value })} />
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus description" value={content.maximus_description} onChange={(e) => setContent({ ...content, maximus_description: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus image URL" value={content.maximus_image} onChange={(e) => setContent({ ...content, maximus_image: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus learn more link" value={content.maximus_learn_more_link} onChange={(e) => setContent({ ...content, maximus_learn_more_link: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Maximus instagram link" value={content.maximus_instagram_link} onChange={(e) => setContent({ ...content, maximus_instagram_link: e.target.value })} />

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Testimonials title" value={content.testimonials_title} onChange={(e) => setContent({ ...content, testimonials_title: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Testimonials subtitle" value={content.testimonials_subtitle} onChange={(e) => setContent({ ...content, testimonials_subtitle: e.target.value })} />

        {contentMsg && <p className="text-sm text-zinc-300">{contentMsg}</p>}
        <button className="rounded-xl bg-white px-5 py-3 font-black text-black">Save Home Content</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={saveStatus} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{statusEditingId ? "Edit" : "Add"} Today Status Card</h2>

          <input
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Label (e.g. Open Gym)"
            value={statusForm.label}
            onChange={(e) => setStatusForm({ ...statusForm, label: e.target.value })}
            required
          />
          <input
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Value (e.g. 5:00 AM - 9:00 PM)"
            value={statusForm.value}
            onChange={(e) => setStatusForm({ ...statusForm, value: e.target.value })}
            required
          />
          <input
            type="number"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Sort order"
            value={statusForm.sort_order}
            onChange={(e) => setStatusForm({ ...statusForm, sort_order: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-zinc-200">
            <input
              type="checkbox"
              checked={statusForm.is_active}
              onChange={(e) => setStatusForm({ ...statusForm, is_active: e.target.checked })}
            />
            Active
          </label>

          {statusMsg && <p className="text-sm text-zinc-300">{statusMsg}</p>}

          <div className="flex gap-2">
            <button className="rounded-xl bg-white px-5 py-3 font-black text-black">
              {statusEditingId ? "Update" : "Create"}
            </button>
            {statusEditingId && (
              <button
                type="button"
                onClick={resetStatusForm}
                className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white"
              >
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

          <input
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Point text"
            value={pointForm.point}
            onChange={(e) => setPointForm({ ...pointForm, point: e.target.value })}
            required
          />
          <input
            type="number"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            placeholder="Sort order"
            value={pointForm.sort_order}
            onChange={(e) => setPointForm({ ...pointForm, sort_order: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-zinc-200">
            <input
              type="checkbox"
              checked={pointForm.is_active}
              onChange={(e) => setPointForm({ ...pointForm, is_active: e.target.checked })}
            />
            Active
          </label>

          {pointMsg && <p className="text-sm text-zinc-300">{pointMsg}</p>}

          <div className="flex gap-2">
            <button className="rounded-xl bg-white px-5 py-3 font-black text-black">
              {pointEditingId ? "Update" : "Create"}
            </button>
            {pointEditingId && (
              <button
                type="button"
                onClick={resetPointForm}
                className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white"
              >
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
