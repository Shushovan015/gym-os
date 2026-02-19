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

const emptyForm: FormState = {
  kind: "zone",
  title: "",
  description: "",
  tag: "",
  image: "",
  sort_order: 0,
  is_active: true,
};

export default function AdminFacilities() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("facility_items")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });

    if (!error) setRows((data as Row[]) || []);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3">
        <h2 className="text-xl font-black text-white">
          {editingId ? "Edit" : "Add"} Facilities Content
        </h2>

        <select
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
        >
          <option value="zone">Main Facility Card</option>
          <option value="amenity">Included Feature</option>
        </select>

        <input
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          placeholder={
            form.kind === "amenity"
              ? "Feature name (e.g. Shower access)"
              : "Facility name (e.g. Strength Hall)"
          }
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        {form.kind === "zone" && (
          <>
            <input
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
              placeholder="Category label (e.g. Power & Hypertrophy)"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            />

            <textarea
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
              placeholder="Short description"
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
        <h2 className="text-xl font-black text-white">Saved Facilities Content</h2>

        {rows.map((r) => (
          <div key={r.id} className="rounded-xl bg-white/6 p-4">
            <div className="text-xs text-zinc-400">
              {r.kind === "zone" ? "Main Facility Card" : "Small Amenity Tag"}
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
  );
}
