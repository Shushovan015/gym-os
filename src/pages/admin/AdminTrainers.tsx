import { useEffect, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";

type TrainerRow = {
  id: number;
  name: string;
  role: string;
  bio: string;
  image: string;
  specialties: string[];
  years_experience: number;
  offers_personal_training: boolean;
  sort_order: number;
  is_active: boolean;
};

type TrainerForm = {
  name: string;
  role: string;
  bio: string;
  image: string;
  specialties: string[];
  years_experience: number;
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

const emptyTrainerForm: TrainerForm = {
  name: "",
  role: "",
  bio: "",
  image: "",
  specialties: [],
  years_experience: 0,
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
};

const emptyPlanForm: PlanForm = {
  name: "",
  details: "",
  points: [],
  sort_order: 0,
  is_active: true,
};

export default function AdminTrainers() {
  const [trainerRows, setTrainerRows] = useState<TrainerRow[]>([]);
  const [trainerForm, setTrainerForm] = useState<TrainerForm>(emptyTrainerForm);
  const [specialtiesInput, setSpecialtiesInput] = useState("");
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
    if (content) setPTContent({ ...emptyPTContent, ...(content as PTContent) });
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

      const specialties = specialtiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...trainerForm,
        image: imageUrl,
        specialties,
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
      name: row.name,
      role: row.role,
      bio: row.bio,
      image: row.image,
      specialties: row.specialties || [],
      years_experience: row.years_experience,
      offers_personal_training: row.offers_personal_training,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setSpecialtiesInput((row.specialties || []).join(", "));
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

  const savePTContent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPTSaving(true);
    setPTMsg("");

    const { error } = await supabase
      .from("trainer_page_content")
      .upsert({ id: 1, ...ptContent }, { onConflict: "id" });

    setPTMsg(error ? error.message : "Personal training section saved.");
    setPTSaving(false);
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
      const points = planPointsInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const payload = {
        ...planForm,
        points,
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
          <h2 className="text-xl font-black text-white">
            {trainerEditingId ? "Edit" : "Add"} Trainer
          </h2>

          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Name" value={trainerForm.name} onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })} required />
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Role (e.g. Strength Coach)" value={trainerForm.role} onChange={(e) => setTrainerForm({ ...trainerForm, role: e.target.value })} required />
          <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Bio" value={trainerForm.bio} onChange={(e) => setTrainerForm({ ...trainerForm, bio: e.target.value })} required />

          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Specialties (comma separated)" value={specialtiesInput} onChange={(e) => setSpecialtiesInput(e.target.value)} />
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Years experience" value={trainerForm.years_experience} onChange={(e) => setTrainerForm({ ...trainerForm, years_experience: Number(e.target.value) })} />
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Image URL (optional)" value={trainerForm.image} onChange={(e) => setTrainerForm({ ...trainerForm, image: e.target.value })} />
          <input type="file" accept="image/*" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" onChange={onFileChange} />

          {(preview || trainerForm.image) && (
            <img src={preview || trainerForm.image} alt="Preview" className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/20" />
          )}

          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Sort order" value={trainerForm.sort_order} onChange={(e) => setTrainerForm({ ...trainerForm, sort_order: Number(e.target.value) })} />

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
                  <div className="text-white font-bold">{r.name} - {r.role}</div>
                  <div className="text-zinc-300 text-sm mt-1">{r.bio}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {r.years_experience} yrs | PT: {r.offers_personal_training ? "Yes" : "No"} | order: {r.sort_order} | {r.is_active ? "active" : "inactive"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(r.specialties || []).map((s) => (
                      <span key={s} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-zinc-200">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onEditTrainer(r)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
                <button type="button" onClick={() => onDeleteTrainer(r.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={savePTContent} className="rounded-2xl bg-black/35 p-6 space-y-3 max-w-4xl">
        <h2 className="text-xl font-black text-white">Personal Training Section Content</h2>

        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Badge text" value={ptContent.pt_badge} onChange={(e) => setPTContent({ ...ptContent, pt_badge: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Section title" value={ptContent.pt_title} onChange={(e) => setPTContent({ ...ptContent, pt_title: e.target.value })} />
        <textarea className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Section description" value={ptContent.pt_description} onChange={(e) => setPTContent({ ...ptContent, pt_description: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="CTA text" value={ptContent.pt_cta_text} onChange={(e) => setPTContent({ ...ptContent, pt_cta_text: e.target.value })} />
        <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="CTA link (e.g. /contact)" value={ptContent.pt_cta_link} onChange={(e) => setPTContent({ ...ptContent, pt_cta_link: e.target.value })} />

        {ptMsg && <p className="text-sm text-zinc-300">{ptMsg}</p>}
        <button type="submit" disabled={ptSaving} className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60">
          {ptSaving ? "Saving..." : "Save PT Section"}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={savePlan} className="rounded-2xl bg-black/35 p-6 space-y-3">
          <h2 className="text-xl font-black text-white">{planEditingId ? "Edit" : "Add"} Personal Training Plan</h2>

          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Plan name (e.g. Starter PT)" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Details (e.g. 2 sessions / week)" value={planForm.details} onChange={(e) => setPlanForm({ ...planForm, details: e.target.value })} />
          <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Points (comma separated)" value={planPointsInput} onChange={(e) => setPlanPointsInput(e.target.value)} />
          <input type="number" className="w-full rounded-xl bg-white/10 px-4 py-3 text-white" placeholder="Sort order" value={planForm.sort_order} onChange={(e) => setPlanForm({ ...planForm, sort_order: Number(e.target.value) })} />

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
                <button type="button" onClick={() => onEditPlan(p)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
                <button type="button" onClick={() => onDeletePlan(p.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
