import { useEffect, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type MetricItem = {
  label: string;
  value: string;
  sub: string;
  icon: string;
};

type ZoneItem = {
  title: string;
  desc: string;
  icon: string;
};

type TrainerRow = {
  id: number;
  name: string;
  role: string;
  bio: string;
  long_bio: string;
  coaching_style: string;
  availability: string;
  image: string;
  specialties: string[];
  certifications: string[];
  achievements: string[];
  session_focus: string[];
  intro_video_url: string;
  intro_video_thumb: string;
  years_experience: number;
  clients_coached: number;
  offers_personal_training: boolean;
  sort_order: number;
  is_active: boolean;
};

type TrainerForm = {
  name: string;
  role: string;
  bio: string;
  long_bio: string;
  coaching_style: string;
  availability: string;
  image: string;
  specialties: string[];
  certifications: string[];
  achievements: string[];
  session_focus: string[];
  intro_video_url: string;
  intro_video_thumb: string;
  years_experience: number;
  clients_coached: number;
  offers_personal_training: boolean;
  sort_order: number;
  is_active: boolean;
};

type PTContent = {
  pt_badge: string;
  pt_title: string;
  pt_description: string;
  pt_cta_text: string;
  pt_cta_link: string;
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  strength_section_title: string;
  equipment_section_title: string;
  spotlight_count: number;
  strength_metrics: MetricItem[];
  equipment_zones: ZoneItem[];
};

type PlanRow = {
  id: number;
  name: string;
  details: string;
  points: string[];
  sort_order: number;
  is_active: boolean;
};

type PlanForm = {
  name: string;
  details: string;
  points: string[];
  sort_order: number;
  is_active: boolean;
};

const iconOptions = [
  "Dumbbell",
  "ShieldCheck",
  "Trophy",
  "Flame",
  "Activity",
  "Target",
  "BarChart3",
  "Star",
];

const emptyTrainerForm: TrainerForm = {
  name: "",
  role: "",
  bio: "",
  long_bio: "",
  coaching_style: "",
  availability: "",
  image: "",
  specialties: [],
  certifications: [],
  achievements: [],
  session_focus: [],
  intro_video_url: "",
  intro_video_thumb: "",
  years_experience: 0,
  clients_coached: 0,
  offers_personal_training: true,
  sort_order: 0,
  is_active: true,
};

const emptyPTContent: PTContent = {
  pt_badge: "Personal Training",
  pt_title: "One-on-one coaching sessions available",
  pt_description:
    "Train directly with a coach through personalized sessions based on your goal, level, and schedule.",
  pt_cta_text: "Book personal training",
  pt_cta_link: "/contact",
  hero_badge: "Elite Coaching Team",
  hero_title: "Train with coaches who build real strength",
  hero_description:
    "Not generic sessions. We coach with progressive overload, technique standards, and measurable progression.",
  hero_primary_cta_text: "Book a session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View coaching plans",
  hero_secondary_cta_link: "/pricing",
  strength_section_title: "Strength Floor Snapshot",
  equipment_section_title: "Training Zones",
  spotlight_count: 3,
  strength_metrics: [
    {
      label: "Dumbbell Range",
      value: "2.5kg - 50kg",
      sub: "Full progressive loading setup",
      icon: "Dumbbell",
    },
    {
      label: "Power Racks",
      value: "8 Stations",
      sub: "Squat, bench, pull, accessories",
      icon: "ShieldCheck",
    },
    {
      label: "Olympic Platforms",
      value: "6 Platforms",
      sub: "Deadlift and explosive work",
      icon: "Trophy",
    },
    {
      label: "Plate Inventory",
      value: "2.5 Tons+",
      sub: "Calibrated and standard mix",
      icon: "Flame",
    },
  ],
  equipment_zones: [
    {
      title: "Dumbbell Zone",
      desc: "Heavy dumbbells and incline benches for hypertrophy blocks.",
      icon: "Dumbbell",
    },
    {
      title: "Barbell Strength Lane",
      desc: "Racks, benches, and platform access for serious progression.",
      icon: "Trophy",
    },
    {
      title: "Performance Conditioning",
      desc: "Rower, sled, ropes, and loaded carries.",
      icon: "Activity",
    },
  ],
};

const emptyPlanForm: PlanForm = {
  name: "",
  details: "",
  points: [],
  sort_order: 0,
  is_active: true,
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const normalizeMetrics = (value: any): MetricItem[] => {
  if (!Array.isArray(value)) return emptyPTContent.strength_metrics;
  const cleaned = value
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      sub: String(item?.sub ?? "").trim(),
      icon: String(item?.icon ?? "").trim() || "Dumbbell",
    }))
    .filter((item: MetricItem) => item.label && item.value);
  return cleaned.length ? cleaned : emptyPTContent.strength_metrics;
};

const normalizeZones = (value: any): ZoneItem[] => {
  if (!Array.isArray(value)) return emptyPTContent.equipment_zones;
  const cleaned = value
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      desc: String(item?.desc ?? "").trim(),
      icon: String(item?.icon ?? "").trim() || "Activity",
    }))
    .filter((item: ZoneItem) => item.title && item.desc);
  return cleaned.length ? cleaned : emptyPTContent.equipment_zones;
};

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

export default function AdminTrainers() {
  const [trainerRows, setTrainerRows] = useState<TrainerRow[]>([]);
  const [trainerForm, setTrainerForm] = useState<TrainerForm>(emptyTrainerForm);
  const [specialtiesInput, setSpecialtiesInput] = useState("");
  const [certificationsInput, setCertificationsInput] = useState("");
  const [achievementsInput, setAchievementsInput] = useState("");
  const [sessionFocusInput, setSessionFocusInput] = useState("");
  const [trainerEditingId, setTrainerEditingId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [trainerSaving, setTrainerSaving] = useState(false);
  const [trainerMsg, setTrainerMsg] = useState("");

  const [ptContent, setPTContent] = useState<PTContent>(emptyPTContent);
  const [ptMsg, setPTMsg] = useState("");
  const [ptSaving, setPTSaving] = useState(false);

  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [planPointsInput, setPlanPointsInput] = useState("");
  const [planEditingId, setPlanEditingId] = useState<number | null>(null);
  const [planMsg, setPlanMsg] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  const load = async () => {
    const [{ data: trainers }, { data: content }, { data: plans }] = await Promise.all([
      supabase.from("trainers").select("*").order("sort_order", { ascending: true }),
      supabase.from("trainer_page_content").select("*").eq("id", 1).maybeSingle(),
      supabase.from("personal_training_plans").select("*").order("sort_order", { ascending: true }),
    ]);

    setTrainerRows((trainers as TrainerRow[]) || []);

    const merged: PTContent = {
      ...emptyPTContent,
      ...((content as Partial<PTContent>) || {}),
      strength_metrics: normalizeMetrics((content as any)?.strength_metrics),
      equipment_zones: normalizeZones((content as any)?.equipment_zones),
      spotlight_count: Number((content as any)?.spotlight_count || emptyPTContent.spotlight_count),
    };

    setPTContent(merged);
    setPlanRows((plans as PlanRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `trainers/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("gym-media").upload(path, file);
    if (error) throw new Error(error.message);

    return supabase.storage.from("gym-media").getPublicUrl(path).data.publicUrl;
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const resetTrainerForm = () => {
    setTrainerForm(emptyTrainerForm);
    setSpecialtiesInput("");
    setCertificationsInput("");
    setAchievementsInput("");
    setSessionFocusInput("");
    setTrainerEditingId(null);
    setImageFile(null);
    setPreview("");
    setTrainerMsg("");
  };

  const submitTrainer = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTrainerSaving(true);
    setTrainerMsg("");

    try {
      let imageUrl = trainerForm.image.trim();
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const payload = {
        ...trainerForm,
        image: imageUrl,
        specialties: splitCsv(specialtiesInput),
        certifications: splitCsv(certificationsInput),
        achievements: splitCsv(achievementsInput),
        session_focus: splitCsv(sessionFocusInput),
        years_experience: Number(trainerForm.years_experience || 0),
        clients_coached: Number(trainerForm.clients_coached || 0),
      };

      if (trainerEditingId) {
        const { error } = await supabase.from("trainers").update(payload).eq("id", trainerEditingId);
        if (error) throw new Error(error.message);
        setTrainerMsg("Trainer updated.");
      } else {
        const { error } = await supabase.from("trainers").insert(payload);
        if (error) throw new Error(error.message);
        setTrainerMsg("Trainer created.");
      }

      resetTrainerForm();
      await load();
    } catch (err: any) {
      setTrainerMsg(err?.message || "Something went wrong.");
    } finally {
      setTrainerSaving(false);
    }
  };

  const onEditTrainer = (row: TrainerRow) => {
    setTrainerEditingId(row.id);
    setTrainerForm({
      name: row.name || "",
      role: row.role || "",
      bio: row.bio || "",
      long_bio: row.long_bio || "",
      coaching_style: row.coaching_style || "",
      availability: row.availability || "",
      image: row.image || "",
      specialties: row.specialties || [],
      certifications: row.certifications || [],
      achievements: row.achievements || [],
      session_focus: row.session_focus || [],
      intro_video_url: row.intro_video_url || "",
      intro_video_thumb: row.intro_video_thumb || "",
      years_experience: row.years_experience || 0,
      clients_coached: row.clients_coached || 0,
      offers_personal_training: !!row.offers_personal_training,
      sort_order: row.sort_order || 0,
      is_active: row.is_active !== false,
    });

    setSpecialtiesInput((row.specialties || []).join(", "));
    setCertificationsInput((row.certifications || []).join(", "));
    setAchievementsInput((row.achievements || []).join(", "));
    setSessionFocusInput((row.session_focus || []).join(", "));

    setImageFile(null);
    setPreview(row.image || "");
    setTrainerMsg("");
  };

  const onDeleteTrainer = async (id: number) => {
    const ok = window.confirm("Delete this trainer?");
    if (!ok) return;
    await supabase.from("trainers").delete().eq("id", id);
    await load();
  };

  const updateStrengthMetric = (index: number, key: keyof MetricItem, value: string) => {
    setPTContent((prev) => {
      const next = [...prev.strength_metrics];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, strength_metrics: next };
    });
  };

  const addStrengthMetric = () => {
    setPTContent((prev) => ({
      ...prev,
      strength_metrics: [...prev.strength_metrics, { label: "", value: "", sub: "", icon: "Dumbbell" }],
    }));
  };

  const removeStrengthMetric = (index: number) => {
    setPTContent((prev) => ({
      ...prev,
      strength_metrics: prev.strength_metrics.filter((_, i) => i !== index),
    }));
  };

  const updateEquipmentZone = (index: number, key: keyof ZoneItem, value: string) => {
    setPTContent((prev) => {
      const next = [...prev.equipment_zones];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, equipment_zones: next };
    });
  };

  const addEquipmentZone = () => {
    setPTContent((prev) => ({
      ...prev,
      equipment_zones: [...prev.equipment_zones, { title: "", desc: "", icon: "Activity" }],
    }));
  };

  const removeEquipmentZone = (index: number) => {
    setPTContent((prev) => ({
      ...prev,
      equipment_zones: prev.equipment_zones.filter((_, i) => i !== index),
    }));
  };

  const savePTContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPTSaving(true);
    setPTMsg("");

    try {
      const payload = {
        id: 1,
        ...ptContent,
        spotlight_count: Number(ptContent.spotlight_count || 3),
        strength_metrics: (ptContent.strength_metrics || [])
          .map((m) => ({
            label: m.label.trim(),
            value: m.value.trim(),
            sub: m.sub.trim(),
            icon: (m.icon || "Dumbbell").trim(),
          }))
          .filter((m) => m.label && m.value),
        equipment_zones: (ptContent.equipment_zones || [])
          .map((z) => ({
            title: z.title.trim(),
            desc: z.desc.trim(),
            icon: (z.icon || "Activity").trim(),
          }))
          .filter((z) => z.title && z.desc),
      };

      const { error } = await supabase.from("trainer_page_content").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(error.message);

      setPTMsg("Trainer page content saved.");
      await load();
    } catch (err: any) {
      setPTMsg(err?.message || "Save failed.");
    } finally {
      setPTSaving(false);
    }
  };

  const resetPlanForm = () => {
    setPlanForm(emptyPlanForm);
    setPlanPointsInput("");
    setPlanEditingId(null);
    setPlanMsg("");
  };

  const savePlan = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPlanSaving(true);
    setPlanMsg("");

    try {
      const payload = {
        ...planForm,
        points: splitCsv(planPointsInput),
      };

      if (planEditingId) {
        const { error } = await supabase.from("personal_training_plans").update(payload).eq("id", planEditingId);
        if (error) throw new Error(error.message);
        setPlanMsg("Plan updated.");
      } else {
        const { error } = await supabase.from("personal_training_plans").insert(payload);
        if (error) throw new Error(error.message);
        setPlanMsg("Plan created.");
      }

      resetPlanForm();
      await load();
    } catch (err: any) {
      setPlanMsg(err?.message || "Something went wrong.");
    } finally {
      setPlanSaving(false);
    }
  };

  const onEditPlan = (row: PlanRow) => {
    setPlanEditingId(row.id);
    setPlanForm({
      name: row.name,
      details: row.details,
      points: row.points || [],
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setPlanPointsInput((row.points || []).join(", "));
    setPlanMsg("");
  };

  const onDeletePlan = async (id: number) => {
    const ok = window.confirm("Delete this plan?");
    if (!ok) return;
    await supabase.from("personal_training_plans").delete().eq("id", id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={submitTrainer} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{trainerEditingId ? "Edit" : "Add"} Trainer</h2>

          <FieldLabel>Name</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.name} onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })} required />

          <FieldLabel>Role</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.role} onChange={(e) => setTrainerForm({ ...trainerForm, role: e.target.value })} required />

          <FieldLabel>Short Bio (card)</FieldLabel>
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.bio} onChange={(e) => setTrainerForm({ ...trainerForm, bio: e.target.value })} required />

          <FieldLabel>Detailed Bio (popup)</FieldLabel>
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.long_bio} onChange={(e) => setTrainerForm({ ...trainerForm, long_bio: e.target.value })} />

          <FieldLabel>Coaching Style</FieldLabel>
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.coaching_style} onChange={(e) => setTrainerForm({ ...trainerForm, coaching_style: e.target.value })} />

          <FieldLabel>Availability</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.availability} onChange={(e) => setTrainerForm({ ...trainerForm, availability: e.target.value })} placeholder="Mon-Sat | 6AM-10AM, 5PM-8PM" />

          <FieldLabel>Specialties (comma separated)</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={specialtiesInput} onChange={(e) => setSpecialtiesInput(e.target.value)} />

          <FieldLabel>Certifications (comma separated)</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={certificationsInput} onChange={(e) => setCertificationsInput(e.target.value)} />

          <FieldLabel>Achievements (comma separated)</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={achievementsInput} onChange={(e) => setAchievementsInput(e.target.value)} />

          <FieldLabel>Session Focus (comma separated)</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={sessionFocusInput} onChange={(e) => setSessionFocusInput(e.target.value)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <FieldLabel>Years Experience</FieldLabel>
              <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.years_experience} onChange={(e) => setTrainerForm({ ...trainerForm, years_experience: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Clients Coached</FieldLabel>
              <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.clients_coached} onChange={(e) => setTrainerForm({ ...trainerForm, clients_coached: Number(e.target.value) })} />
            </div>
          </div>

          <FieldLabel>Image URL</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.image} onChange={(e) => setTrainerForm({ ...trainerForm, image: e.target.value })} />
          <input type="file" accept="image/*" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" onChange={onFileChange} />

          <FieldLabel>Intro Video URL</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.intro_video_url} onChange={(e) => setTrainerForm({ ...trainerForm, intro_video_url: e.target.value })} />

          <FieldLabel>Intro Video Thumbnail URL</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.intro_video_thumb} onChange={(e) => setTrainerForm({ ...trainerForm, intro_video_thumb: e.target.value })} />

          {(preview || trainerForm.image) && (
            <img src={preview || trainerForm.image} alt="Preview" className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/20" />
          )}

          <FieldLabel>Sort Order</FieldLabel>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={trainerForm.sort_order} onChange={(e) => setTrainerForm({ ...trainerForm, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={trainerForm.offers_personal_training} onChange={(e) => setTrainerForm({ ...trainerForm, offers_personal_training: e.target.checked })} />
            Offers Personal Training
          </label>

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={trainerForm.is_active} onChange={(e) => setTrainerForm({ ...trainerForm, is_active: e.target.checked })} />
            Active
          </label>

          {trainerMsg && <p className="text-sm text-zinc-300">{trainerMsg}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={trainerSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
              {trainerSaving ? "Saving..." : trainerEditingId ? "Update" : "Create"}
            </button>
            {trainerEditingId && (
              <button type="button" onClick={resetTrainerForm} className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Trainers</h2>
          {trainerRows.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/6 p-4">
              <div className="flex items-start gap-3">
                {r.image ? <img src={r.image} alt={r.name} className="h-12 w-12 rounded-lg object-cover" /> : null}
                <div>
                  <div className="text-white font-bold">
                    {r.name} - {r.role}
                  </div>
                  <div className="text-zinc-300 text-sm mt-1">{r.bio}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {r.years_experience} yrs | clients: {r.clients_coached || 0} | PT: {r.offers_personal_training ? "Yes" : "No"} | order: {r.sort_order} | {r.is_active ? "active" : "inactive"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(r.specialties || []).map((s) => (
                      <span key={s} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-zinc-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditTrainer(r)} className="rounded-lg bg-white/10 px-3 py-1 text-white">
                  Edit
                </button>
                <button type="button" onClick={() => onDeleteTrainer(r.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={savePTContent} className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">Trainer Page Dynamic Content</h2>

        <div className="pt-2 text-sm font-bold text-white">Hero</div>

        <FieldLabel>Hero Badge</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_badge} onChange={(e) => setPTContent({ ...ptContent, hero_badge: e.target.value })} />

        <FieldLabel>Hero Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_title} onChange={(e) => setPTContent({ ...ptContent, hero_title: e.target.value })} />

        <FieldLabel>Hero Description</FieldLabel>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_description} onChange={(e) => setPTContent({ ...ptContent, hero_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Primary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_primary_cta_text} onChange={(e) => setPTContent({ ...ptContent, hero_primary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Primary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_primary_cta_link} onChange={(e) => setPTContent({ ...ptContent, hero_primary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Secondary CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_secondary_cta_text} onChange={(e) => setPTContent({ ...ptContent, hero_secondary_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Secondary CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.hero_secondary_cta_link} onChange={(e) => setPTContent({ ...ptContent, hero_secondary_cta_link: e.target.value })} />
          </div>
        </div>

        <div className="pt-2 text-sm font-bold text-white">Sections</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <FieldLabel>Strength Section Title</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.strength_section_title} onChange={(e) => setPTContent({ ...ptContent, strength_section_title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Equipment Section Title</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.equipment_section_title} onChange={(e) => setPTContent({ ...ptContent, equipment_section_title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>Spotlight Coach Count</FieldLabel>
            <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.spotlight_count} onChange={(e) => setPTContent({ ...ptContent, spotlight_count: Number(e.target.value) })} />
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Strength Metrics</h3>
            <button type="button" onClick={addStrengthMetric} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Metric
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {ptContent.strength_metrics.map((m, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel>Label</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.label} onChange={(e) => updateStrengthMetric(idx, "label", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Value</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.value} onChange={(e) => updateStrengthMetric(idx, "value", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Sub Text</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.sub} onChange={(e) => updateStrengthMetric(idx, "sub", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Icon</FieldLabel>
                  <select className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={m.icon} onChange={(e) => updateStrengthMetric(idx, "icon", e.target.value)}>
                    {iconOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-black">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => removeStrengthMetric(idx)} className="md:col-span-2 rounded-lg bg-red-500/20 px-3 py-2 text-red-300 text-xs">
                  Remove Metric
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Equipment Zones</h3>
            <button type="button" onClick={addEquipmentZone} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">
              + Add Zone
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {ptContent.equipment_zones.map((z, idx) => (
              <div key={idx} className="rounded-xl bg-white/5 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel>Title</FieldLabel>
                  <input className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={z.title} onChange={(e) => updateEquipmentZone(idx, "title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel>Icon</FieldLabel>
                  <select className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={z.icon} onChange={(e) => updateEquipmentZone(idx, "icon", e.target.value)}>
                    {iconOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-black">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <FieldLabel>Description</FieldLabel>
                  <textarea className="w-full rounded-lg bg-white/10 px-3 py-2 text-white" value={z.desc} onChange={(e) => updateEquipmentZone(idx, "desc", e.target.value)} />
                </div>
                <button type="button" onClick={() => removeEquipmentZone(idx)} className="md:col-span-2 rounded-lg bg-red-500/20 px-3 py-2 text-red-300 text-xs">
                  Remove Zone
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 text-sm font-bold text-white">Personal Training Section</div>
        <FieldLabel>PT Badge</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.pt_badge} onChange={(e) => setPTContent({ ...ptContent, pt_badge: e.target.value })} />

        <FieldLabel>PT Title</FieldLabel>
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.pt_title} onChange={(e) => setPTContent({ ...ptContent, pt_title: e.target.value })} />

        <FieldLabel>PT Description</FieldLabel>
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.pt_description} onChange={(e) => setPTContent({ ...ptContent, pt_description: e.target.value })} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>PT CTA Text</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.pt_cta_text} onChange={(e) => setPTContent({ ...ptContent, pt_cta_text: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FieldLabel>PT CTA Link</FieldLabel>
            <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={ptContent.pt_cta_link} onChange={(e) => setPTContent({ ...ptContent, pt_cta_link: e.target.value })} />
          </div>
        </div>

        {ptMsg && <p className="text-sm text-zinc-300">{ptMsg}</p>}
        <button type="submit" disabled={ptSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
          {ptSaving ? "Saving..." : "Save Trainer Page Content"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={savePlan} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{planEditingId ? "Edit" : "Add"} Personal Training Plan</h2>

          <FieldLabel>Plan Name</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />

          <FieldLabel>Plan Details</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={planForm.details} onChange={(e) => setPlanForm({ ...planForm, details: e.target.value })} />

          <FieldLabel>Points (comma separated)</FieldLabel>
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={planPointsInput} onChange={(e) => setPlanPointsInput(e.target.value)} />

          <FieldLabel>Sort Order</FieldLabel>
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" value={planForm.sort_order} onChange={(e) => setPlanForm({ ...planForm, sort_order: Number(e.target.value) })} />

          <label className="flex items-center gap-2 text-zinc-200">
            <input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })} />
            Active
          </label>

          {planMsg && <p className="text-sm text-zinc-300">{planMsg}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={planSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
              {planSaving ? "Saving..." : planEditingId ? "Update" : "Create"}
            </button>
            {planEditingId && (
              <button type="button" onClick={resetPlanForm} className="rounded-xl bg-white/10 px-5 py-3 font-semibold text-white">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">Personal Training Plans</h2>
          {planRows.map((p) => (
            <div key={p.id} className="rounded-xl bg-white/6 p-4">
              <div className="text-white font-bold">{p.name}</div>
              <div className="text-zinc-300 text-sm mt-1">{p.details}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(p.points || []).map((pt) => (
                  <span key={pt} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-zinc-200">
                    {pt}
                  </span>
                ))}
              </div>
              <div className="text-xs text-zinc-400 mt-2">
                order: {p.sort_order} | {p.is_active ? "active" : "inactive"}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditPlan(p)} className="rounded-lg bg-white/10 px-3 py-1 text-white">
                  Edit
                </button>
                <button type="button" onClick={() => onDeletePlan(p.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">
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
