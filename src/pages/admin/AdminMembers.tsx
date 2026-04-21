import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";
import { supabase } from "@src/Client/supabase";
import Pagination from "@src/components/Pagination";

type MembershipType = "monthly" | "quarterly" | "yearly" | "trial";
type MembershipStatus = "active" | "paused" | "cancelled" | "expired";
type PaymentStatus = "paid" | "unpaid" | "overdue";

type MemberRow = {
  id: number;
  member_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  membership_type: MembershipType;
  membership_status: MembershipStatus;
  start_date: string | null;
  end_date: string | null;
  last_visit_date: string | null;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type MemberForm = Omit<MemberRow, "id" | "created_at" | "updated_at">;

type CsvParsedRow = MemberForm & {
  rowNumber: number;
  errors: string[];
};

type N8nMembersEventPayload = {
  event_type: "member_created" | "member_updated" | "members_imported";
  source: "admin_manual" | "admin_csv_import";
  member_ids: string[];
  count: number;
  occurred_at: string;
};

const membershipTypes: MembershipType[] = ["monthly", "quarterly", "yearly", "trial"];
const membershipStatuses: MembershipStatus[] = ["active", "paused", "cancelled", "expired"];
const paymentStatuses: PaymentStatus[] = ["paid", "unpaid", "overdue"];

const csvHeaders = [
  "member_id",
  "full_name",
  "email",
  "phone",
  "membership_type",
  "membership_status",
  "start_date",
  "end_date",
  "last_visit_date",
  "payment_status",
  "payment_due_date",
  "notes",
] as const;

const emptyForm: MemberForm = {
  member_id: "",
  full_name: "",
  email: "",
  phone: "",
  membership_type: "monthly",
  membership_status: "active",
  start_date: "",
  end_date: "",
  last_visit_date: "",
  payment_status: "unpaid",
  payment_due_date: "",
  notes: "",
};

const rowsPerPage = 10;

const n8nMembersWebhookUrl = (import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_URL as string | undefined)?.trim();
const n8nMembersWebhookSecret = (import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_SECRET as string | undefined)?.trim();

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-semibold text-zinc-300">{children}</label>;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function isValidDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(timestamp);
}

function isValidEmail(value: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeNullable(value: string) {
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function validateRow(row: MemberForm, knownMemberIds: Set<string>) {
  const errors: string[] = [];

  if (!row.member_id.trim()) errors.push("member_id is required");
  if (!row.full_name.trim() || row.full_name.trim().length < 2)
    errors.push("full_name must be at least 2 characters");
  if (!row.phone.trim()) errors.push("phone is required");
  if (!isValidEmail(row.email || "")) errors.push("email is invalid");

  if (!membershipTypes.includes(row.membership_type)) errors.push("membership_type is invalid");
  if (!membershipStatuses.includes(row.membership_status)) errors.push("membership_status is invalid");
  if (!paymentStatuses.includes(row.payment_status)) errors.push("payment_status is invalid");

  if (!isValidDate(row.start_date || "")) errors.push("start_date must be YYYY-MM-DD");
  if (!isValidDate(row.end_date || "")) errors.push("end_date must be YYYY-MM-DD");
  if (!isValidDate(row.last_visit_date || "")) errors.push("last_visit_date must be YYYY-MM-DD");
  if (!isValidDate(row.payment_due_date || "")) errors.push("payment_due_date must be YYYY-MM-DD");

  const memberId = row.member_id.trim();
  if (memberId && knownMemberIds.has(memberId)) errors.push("duplicate member_id in CSV");
  if (memberId) knownMemberIds.add(memberId);

  return errors;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

async function notifyN8nMembers(payload: N8nMembersEventPayload) {
  if (!n8nMembersWebhookUrl) {
    return { ok: false, skipped: true, error: "Webhook URL not configured" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (n8nMembersWebhookSecret) {
      headers["x-gym-secret"] = n8nMembersWebhookSecret;
    }

    const response = await fetch(n8nMembersWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, skipped: false, error: `HTTP ${response.status}` };
    }

    return { ok: true, skipped: false, error: "" };
  } catch (err: any) {
    return { ok: false, skipped: false, error: err?.message || "Unknown webhook error" };
  }
}

export default function AdminMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [csvRows, setCsvRows] = useState<CsvParsedRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [importing, setImporting] = useState(false);
  const n8nEnabled = Boolean(n8nMembersWebhookUrl);
  const isAnyModalOpen = showMemberModal || Boolean(detailMember);

  const validCsvRows = useMemo(() => csvRows.filter((row) => row.errors.length === 0), [csvRows]);
  const invalidCsvRows = useMemo(() => csvRows.filter((row) => row.errors.length > 0), [csvRows]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (member) =>
        member.full_name.toLowerCase().includes(q) ||
        member.member_id.toLowerCase().includes(q) ||
        (member.email || "").toLowerCase().includes(q) ||
        member.phone.toLowerCase().includes(q)
    );
  }, [members, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pagedMembers = filteredMembers.slice(pageStart, pageStart + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers((data as MemberRow[]) || []);
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadMembers();
  }, []);

  const onChange = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeMemberModal = () => {
    setShowMemberModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openAddMemberModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowMemberModal(true);
  };

  const toPayload = (row: MemberForm) => ({
    member_id: row.member_id.trim(),
    full_name: row.full_name.trim(),
    email: normalizeNullable(row.email || ""),
    phone: row.phone.trim(),
    membership_type: row.membership_type,
    membership_status: row.membership_status,
    start_date: normalizeNullable(row.start_date || ""),
    end_date: normalizeNullable(row.end_date || ""),
    last_visit_date: normalizeNullable(row.last_visit_date || ""),
    payment_status: row.payment_status,
    payment_due_date: normalizeNullable(row.payment_due_date || ""),
    notes: normalizeNullable(row.notes || ""),
  });

  const saveMember = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    const payload = toPayload(form);
    const errors = validateRow(
      {
        ...form,
        member_id: payload.member_id,
        full_name: payload.full_name,
        email: payload.email || "",
        phone: payload.phone,
        start_date: payload.start_date || "",
        end_date: payload.end_date || "",
        last_visit_date: payload.last_visit_date || "",
        payment_due_date: payload.payment_due_date || "",
        notes: payload.notes || "",
      },
      new Set<string>()
    );

    if (errors.length) {
      setSaving(false);
      setMessage(errors.join(", "));
      return;
    }

    let error;
    if (editingId) {
      const res = await supabase.from("members").update(payload).eq("id", editingId);
      error = res.error;
    } else {
      const res = await supabase.from("members").insert(payload);
      error = res.error;
    }

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const eventType: N8nMembersEventPayload["event_type"] = editingId
      ? "member_updated"
      : "member_created";
    const webhookResult = await notifyN8nMembers({
      event_type: eventType,
      source: "admin_manual",
      member_ids: [payload.member_id],
      count: 1,
      occurred_at: new Date().toISOString(),
    });

    if (!webhookResult.ok && !webhookResult.skipped) {
      setMessage(
        `${editingId ? "Member updated" : "Member created"} but n8n notification failed: ${webhookResult.error}`
      );
    } else if (webhookResult.skipped) {
      setMessage(`${editingId ? "Member updated" : "Member created"}. n8n webhook is not configured.`);
    } else {
      setMessage(`${editingId ? "Member updated" : "Member created"} and n8n notified.`);
    }

    closeMemberModal();
    await loadMembers();
  };

  const onEdit = (row: MemberRow) => {
    setEditingId(row.id);
    setForm({
      member_id: row.member_id,
      full_name: row.full_name,
      email: row.email || "",
      phone: row.phone,
      membership_type: row.membership_type,
      membership_status: row.membership_status,
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      last_visit_date: row.last_visit_date || "",
      payment_status: row.payment_status,
      payment_due_date: row.payment_due_date || "",
      notes: row.notes || "",
    });
    setDetailMember(null);
    setShowMemberModal(true);
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete this member?")) return;
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Member deleted.");
    await loadMembers();
  };

  const parseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    setMessage("");
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvName(file.name);
      setCsvRows([]);
      setMessage("Only CSV files are supported in this importer.");
      return;
    }

    const text = await file.text();
    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      setCsvName(file.name);
      setCsvRows([]);
      setMessage("CSV is empty.");
      return;
    }

    const headerParts = parseCsvLine(lines[0]).map((h) => h.trim());
    const missing = csvHeaders.filter((header) => !headerParts.includes(header));
    if (missing.length > 0) {
      setCsvName(file.name);
      setCsvRows([]);
      setMessage(`Missing required headers: ${missing.join(", ")}`);
      return;
    }

    const headerIndex: Record<string, number> = {};
    headerParts.forEach((header, idx) => {
      headerIndex[header] = idx;
    });

    const seen = new Set<string>();
    const parsed: CsvParsedRow[] = lines.slice(1).map((line, i) => {
      const values = parseCsvLine(line);
      const row: MemberForm = {
        member_id: values[headerIndex.member_id] || "",
        full_name: values[headerIndex.full_name] || "",
        email: values[headerIndex.email] || "",
        phone: values[headerIndex.phone] || "",
        membership_type: (values[headerIndex.membership_type] || "").toLowerCase() as MembershipType,
        membership_status: (values[headerIndex.membership_status] || "").toLowerCase() as MembershipStatus,
        start_date: values[headerIndex.start_date] || "",
        end_date: values[headerIndex.end_date] || "",
        last_visit_date: values[headerIndex.last_visit_date] || "",
        payment_status: (values[headerIndex.payment_status] || "").toLowerCase() as PaymentStatus,
        payment_due_date: values[headerIndex.payment_due_date] || "",
        notes: values[headerIndex.notes] || "",
      };

      return {
        ...row,
        rowNumber: i + 2,
        errors: validateRow(row, seen),
      };
    });

    setCsvName(file.name);
    setCsvRows(parsed);
  };

  const importCsvRows = async () => {
    if (!validCsvRows.length) {
      setMessage("No valid CSV rows to import.");
      return;
    }

    setImporting(true);
    setMessage("");

    const payload = validCsvRows.map((row) => toPayload(row));

    const { error } = await supabase.from("members").upsert(payload, { onConflict: "member_id" });

    setImporting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const importedMemberIds = payload.map((row) => row.member_id);
    const webhookResult = await notifyN8nMembers({
      event_type: "members_imported",
      source: "admin_csv_import",
      member_ids: importedMemberIds,
      count: importedMemberIds.length,
      occurred_at: new Date().toISOString(),
    });

    if (!webhookResult.ok && !webhookResult.skipped) {
      setMessage(
        `Imported ${validCsvRows.length} members, but n8n notification failed: ${webhookResult.error}`
      );
    } else if (webhookResult.skipped) {
      setMessage(`Imported ${validCsvRows.length} members. n8n webhook is not configured.`);
    } else {
      setMessage(`Imported ${validCsvRows.length} members and n8n notified.`);
    }

    setCsvRows([]);
    setCsvName("");
    await loadMembers();
  };

  return (
    <div className="relative">
      <div className={`space-y-6 transition ${isAnyModalOpen ? "blur-sm pointer-events-none select-none" : ""}`}>
      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">CSV Import</h2>
        <p className="text-sm text-zinc-300">
          Upload members from CSV. Required columns: {csvHeaders.join(", ")}.
        </p>
        <p className="text-xs text-zinc-400">
          n8n webhook: {n8nEnabled ? "configured" : "not configured"} ({`VITE_N8N_MEMBERS_WEBHOOK_URL`})
        </p>
        <a
          href="/members-import-template.csv"
          className="inline-flex rounded-lg bg-white/10 px-3 py-2 text-sm text-white"
          download
        >
          Download CSV Template
        </a>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={parseCsv}
          className="block w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-zinc-100"
        />
        {csvName ? <p className="text-sm text-zinc-300">Selected: {csvName}</p> : null}
        <div className="rounded-xl bg-white/5 p-4 text-sm text-zinc-200">
          Valid rows: <b>{validCsvRows.length}</b> | Invalid rows: <b>{invalidCsvRows.length}</b>
        </div>
        <button
          type="button"
          onClick={importCsvRows}
          disabled={importing || validCsvRows.length === 0}
          className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60"
        >
          {importing ? "Importing..." : "Import Valid Rows"}
        </button>
        {invalidCsvRows.length ? (
          <div className="rounded-xl bg-red-500/10 p-4 space-y-2">
            <div className="text-sm font-semibold text-red-300">Invalid rows</div>
            {invalidCsvRows.slice(0, 20).map((row) => (
              <div key={row.rowNumber} className="text-xs text-red-200">
                Row {row.rowNumber}: {row.errors.join(", ")}
              </div>
            ))}
            {invalidCsvRows.length > 20 ? (
              <div className="text-xs text-red-300">Showing first 20 invalid rows.</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <FieldLabel>Search Members</FieldLabel>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
              placeholder="Search by name, member ID, email, phone"
            />
          </div>
          <button
            type="button"
            onClick={openAddMemberModal}
            className="rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            Add Member
          </button>
        </div>

        {message ? <p className="text-sm text-zinc-300">{message}</p> : null}

        <div className="overflow-auto rounded-xl border border-white/10">
          <table className="min-w-[1400px] w-full text-sm text-zinc-100">
            <thead className="bg-white/10 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left">Member ID</th>
                <th className="px-3 py-3 text-left">Full Name</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Phone</th>
                <th className="px-3 py-3 text-left">Membership Type</th>
                <th className="px-3 py-3 text-left">Membership Status</th>
                <th className="px-3 py-3 text-left">Start Date</th>
                <th className="px-3 py-3 text-left">End Date</th>
                <th className="px-3 py-3 text-left">Last Visit</th>
                <th className="px-3 py-3 text-left">Payment Status</th>
                <th className="px-3 py-3 text-left">Payment Due</th>
                <th className="px-3 py-3 text-left">Notes</th>
                <th className="px-3 py-3 text-left">Created</th>
                <th className="px-3 py-3 text-left">Updated</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedMembers.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setDetailMember(row)}
                  className="border-t border-white/10 cursor-pointer hover:bg-white/5"
                >
                  <td className="px-3 py-3">{row.member_id}</td>
                  <td className="px-3 py-3 font-semibold">{row.full_name}</td>
                  <td className="px-3 py-3">{row.email || "-"}</td>
                  <td className="px-3 py-3">{row.phone}</td>
                  <td className="px-3 py-3">{row.membership_type}</td>
                  <td className="px-3 py-3">{row.membership_status}</td>
                  <td className="px-3 py-3">{row.start_date || "-"}</td>
                  <td className="px-3 py-3">{row.end_date || "-"}</td>
                  <td className="px-3 py-3">{row.last_visit_date || "-"}</td>
                  <td className="px-3 py-3">{row.payment_status}</td>
                  <td className="px-3 py-3">{row.payment_due_date || "-"}</td>
                  <td className="px-3 py-3">{row.notes || "-"}</td>
                  <td className="px-3 py-3">{formatDateTime(row.created_at)}</td>
                  <td className="px-3 py-3">{formatDateTime(row.updated_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(row);
                        }}
                        className="rounded-lg bg-white/10 px-3 py-1 text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row.id);
                        }}
                        className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 ? (
          <p className="text-sm text-zinc-400">No members found for the current search.</p>
        ) : null}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>
      </div>

      {showMemberModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-4">
          <form
            onSubmit={saveMember}
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-300 bg-zinc-100 text-zinc-900 shadow-2xl p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-zinc-900">{editingId ? "Edit" : "Add"} Member</h2>
              <button
                type="button"
                onClick={closeMemberModal}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Member ID</FieldLabel>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.member_id}
                  onChange={(e) => onChange("member_id", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Full Name</FieldLabel>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.full_name}
                  onChange={(e) => onChange("full_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.email || ""}
                  onChange={(e) => onChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Phone</FieldLabel>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.phone}
                  onChange={(e) => onChange("phone", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <FieldLabel>Membership Type</FieldLabel>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.membership_type}
                  onChange={(e) => onChange("membership_type", e.target.value as MembershipType)}
                >
                  {membershipTypes.map((v) => (
                    <option key={v} value={v} className="bg-black">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>Membership Status</FieldLabel>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.membership_status}
                  onChange={(e) => onChange("membership_status", e.target.value as MembershipStatus)}
                >
                  {membershipStatuses.map((v) => (
                    <option key={v} value={v} className="bg-black">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <FieldLabel>Payment Status</FieldLabel>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.payment_status}
                  onChange={(e) => onChange("payment_status", e.target.value as PaymentStatus)}
                >
                  {paymentStatuses.map((v) => (
                    <option key={v} value={v} className="bg-black">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <FieldLabel>Start Date</FieldLabel>
                <input
                  type="date"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.start_date || ""}
                  onChange={(e) => onChange("start_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>End Date</FieldLabel>
                <input
                  type="date"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.end_date || ""}
                  onChange={(e) => onChange("end_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Last Visit Date</FieldLabel>
                <input
                  type="date"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.last_visit_date || ""}
                  onChange={(e) => onChange("last_visit_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel>Payment Due Date</FieldLabel>
                <input
                  type="date"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                  value={form.payment_due_date || ""}
                  onChange={(e) => onChange("payment_due_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900"
                value={form.notes || ""}
                onChange={(e) => onChange("notes", e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-white px-5 py-3 font-black text-black disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Update Member" : "Create Member"}
              </button>
              <button
                type="button"
                onClick={closeMemberModal}
                className="rounded-xl bg-zinc-700 px-5 py-3 font-semibold text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {detailMember ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-300 bg-zinc-100 shadow-2xl p-6 space-y-4 text-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-zinc-900">Member Details</h2>
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Member ID:</span> <span className="font-semibold">{detailMember.member_id}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Full Name:</span> <span className="font-semibold">{detailMember.full_name}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Email:</span> <span className="font-semibold">{detailMember.email || "-"}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Phone:</span> <span className="font-semibold">{detailMember.phone}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Membership Type:</span> <span className="font-semibold">{detailMember.membership_type}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Membership Status:</span> <span className="font-semibold">{detailMember.membership_status}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Start Date:</span> <span className="font-semibold">{detailMember.start_date || "-"}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">End Date:</span> <span className="font-semibold">{detailMember.end_date || "-"}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Last Visit Date:</span> <span className="font-semibold">{detailMember.last_visit_date || "-"}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Payment Status:</span> <span className="font-semibold">{detailMember.payment_status}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Payment Due Date:</span> <span className="font-semibold">{detailMember.payment_due_date || "-"}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Created:</span> <span className="font-semibold">{formatDateTime(detailMember.created_at)}</span></div>
              <div className="rounded-lg bg-white p-3"><span className="text-zinc-600">Updated:</span> <span className="font-semibold">{formatDateTime(detailMember.updated_at)}</span></div>
              <div className="md:col-span-2 rounded-lg bg-white p-3">
                <span className="text-zinc-600">Notes:</span> <span className="font-semibold">{detailMember.notes || "-"}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(detailMember)}
                className="rounded-xl bg-white px-5 py-3 font-black text-black"
              >
                Edit Member
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = detailMember.id;
                  setDetailMember(null);
                  onDelete(targetId);
                }}
                className="rounded-xl bg-red-500/20 px-5 py-3 font-semibold text-red-300"
              >
                Delete Member
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
