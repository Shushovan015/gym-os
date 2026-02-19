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

export default function AdminPricing() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [featuresInput, setFeaturesInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("pricing_items")
      .select("*")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });

    if (!error) setRows((data as Row[]) || []);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="rounded-2xl bg-black/35 p-6 space-y-3">
        <h2 className="text-xl font-black text-white">{editingId ? "Edit" : "Add"} Pricing Content</h2>

        <select
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
        >
          <option value="plan">Plan Card</option>
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
        <h2 className="text-xl font-black text-white">Saved Pricing Content</h2>
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl bg-white/6 p-4">
            <div className="text-xs text-zinc-400">{r.kind === "plan" ? "Plan Card" : "Top Feature Chip"}</div>
            <div className="text-white font-bold mt-1">{r.title}</div>
            {r.kind === "plan" && (
              <>
                <div className="text-zinc-300 text-sm mt-1">{r.price}{r.cadence}</div>
                <div className="text-zinc-300 text-sm mt-1">{r.subtitle}</div>
                <div className="text-xs text-zinc-400 mt-1">{r.is_highlighted ? "Most Popular" : "Normal"}</div>
              </>
            )}
            <div className="text-xs text-zinc-400 mt-1">
              order: {r.sort_order} | {r.is_active ? "active" : "inactive"}
            </div>

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onEdit(r)} className="rounded-lg bg-white/10 px-3 py-1 text-white">Edit</button>
              <button type="button" onClick={() => onDelete(r.id)} className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
