import { useDebouncedValue } from "@src/hooks/useDebouncedValue";
import { useLatestRequest } from "@src/hooks/useLatestRequest";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ReceiptText,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { supabase } from "@src/Client/supabase";
import {
  AdminBadge,
  AdminBsDateInput,
  AdminButton,
  AdminCard,
  AdminDialog,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminSearchField,
  AdminSectionTitle,
  AdminSelect,
  AdminTableScroll,
  AdminTableShell,
  AdminTextarea,
} from "@src/components/admin/AdminUI";
import type {
  AdminSettings,
  AttendanceRow,
  GeneratedProgressReport,
  MeasurementRow,
  MemberForm,
  MemberReportLogRow,
  MemberRow,
  MembershipStatus,
  MembershipType,
  PaymentStatus,
  SendProgressReportResponse,
  TransformationRow,
} from "./adminTypes";
import { membershipStatuses, paymentStatuses } from "./adminTypes";
import {
  addDays,
  cx,
  defaultAdminSettings,
  emptyMemberForm,
  formatDateTime,
  formatDisplayDate,
  getMemberLifecycle,
  getNepalTodayAdDate,
  hasValidationErrors,
  normalizePhone,
  statusLabel,
  toMemberPayload,
  toNullableNumber,
  validateMemberForm,
} from "./adminUtils";

type DeletedFilter = "active" | "deleted" | "all";
type MembershipFilter = "all" | MembershipStatus | "expiring";
type PaymentFilter = "all" | PaymentStatus;
type SortKey = "updated_desc" | "name_asc" | "end_date_asc" | "created_desc";
type MembershipPlan = { id: number; title: string; is_active: boolean };

type CsvParsedRow = MemberForm & {
  rowNumber: number;
  errors: string[];
  warnings: string[];
};

type N8nMembersEventPayload = {
  event_type: "member_created" | "member_updated" | "members_imported";
  source: "admin_manual" | "admin_csv_import";
  member_ids: string[];
  count: number;
  occurred_at: string;
};

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

const n8nMembersWebhookUrl = (import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_URL as string | undefined)?.trim();
const n8nMembersWebhookSecret = (import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_SECRET as string | undefined)?.trim();

const rowsPerPage = 10;
const membershipOptions = [{ value: "all", label: "All memberships" }, ...membershipStatuses.map((value) => ({ value, label: statusLabel(value) })), { value: "expiring", label: "Expiring soon" }];
const paymentOptions = [{ value: "all", label: "All payment statuses" }, ...paymentStatuses.map((value) => ({ value, label: statusLabel(value) }))];
const deletedOptions = [
  { value: "active", label: "Active list" },
  { value: "deleted", label: "Deleted list" },
  { value: "all", label: "All records" },
];
const sortOptions = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "end_date_asc", label: "Membership end date" },
  { value: "created_desc", label: "Recently created" },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
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

async function notifyN8nMembers(payload: N8nMembersEventPayload) {
  if (!n8nMembersWebhookUrl) return { ok: false, skipped: true, error: "Webhook URL not configured" };

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (n8nMembersWebhookSecret) headers["x-gym-secret"] = n8nMembersWebhookSecret;

    const response = await fetch(n8nMembersWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) return { ok: false, skipped: false, error: `HTTP ${response.status}` };
    return { ok: true, skipped: false, error: "" };
  } catch (error) {
    return { ok: false, skipped: false, error: errorMessage(error) };
  }
}

function memberStatusTone(member: MemberRow, todayAd: string) {
  const lifecycle = getMemberLifecycle(member, todayAd);
  if (member.deleted_at) return "muted" as const;
  if (lifecycle === "expired") return "danger" as const;
  if (lifecycle === "expiring") return "warning" as const;
  if (member.membership_status === "paused") return "warning" as const;
  if (member.membership_status === "cancelled") return "danger" as const;
  return "success" as const;
}

function paymentTone(payment: PaymentStatus) {
  if (payment === "paid") return "success" as const;
  if (payment === "overdue") return "danger" as const;
  return "warning" as const;
}

function MiniLineChart({ values, stroke }: { values: Array<number | null>; stroke: string }) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (clean.length < 2) return <div className="text-xs text-slate-500">Not enough data for a chart yet.</div>;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const points = clean
    .map((value, index) => {
      const x = (index / (clean.length - 1 || 1)) * 220;
      const y = 54 - ((value - min) / range) * 44;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="220" height="60" viewBox="0 0 220 60" className="rounded-lg border border-slate-800 bg-slate-950">
      <polyline fill="none" stroke={stroke} strokeWidth="2.5" points={points} />
    </svg>
  );
}

function BsAdDateField({
  label,
  adValue,
  onChangeAd,
  error,
}: {
  label: string;
  adValue: string | null;
  onChangeAd: (value: string) => void;
  error?: string;
}) {
  return <AdminField label={`${label} (BS)`} error={error}><AdminBsDateInput value={adValue} onChange={onChangeAd} /></AdminField>;
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-400">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex gap-2">
        <AdminButton type="button" variant="secondary" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          Previous
        </AdminButton>
        <AdminButton type="button" variant="secondary" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          Next
        </AdminButton>
      </div>
    </div>
  );
}

export default function AdminMembers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const todayAd = useMemo(() => getNepalTodayAdDate(), []);
  const initialExpiring = Number(searchParams.get("expiring") || defaultAdminSettings.expiry_warning_days);
  const initialAbsent = Number(searchParams.get("absent") || 0);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [memberSummary, setMemberSummary] = useState({ active: 0, payment_follow_up: 0, deleted: 0 });
  const [settings, setSettings] = useState<AdminSettings>(defaultAdminSettings);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>(
    searchParams.get("expiring") ? "expiring" : ((searchParams.get("membership") as MembershipFilter | null) ?? "all")
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>((searchParams.get("payment") as PaymentFilter | null) ?? "all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");
  const expiringDays = Number.isFinite(initialExpiring) ? initialExpiring : defaultAdminSettings.expiry_warning_days;
  const [absentDays, setAbsentDays] = useState(Number.isFinite(initialAbsent) ? initialAbsent : 0);
  const [createdSince, setCreatedSince] = useState(searchParams.get("created_since") ?? "");
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState<MemberForm>(emptyMemberForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof MemberForm, string>>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("action") === "add");
  const [saving, setSaving] = useState(false);
  const [memberPhotoFile, setMemberPhotoFile] = useState<File | null>(null);

  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [transformations, setTransformations] = useState<TransformationRow[]>([]);
  const [reportLogs, setReportLogs] = useState<MemberReportLogRow[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<AttendanceRow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<GeneratedProgressReport | null>(null);

  const [measurementForm, setMeasurementForm] = useState({
    recorded_at: todayAd,
    weight_kg: "",
    body_fat_percent: "",
    chest_cm: "",
    waist_cm: "",
    hips_cm: "",
    arm_cm: "",
    thigh_cm: "",
    notes: "",
  });
  const [transformationForm, setTransformationForm] = useState({
    captured_at: todayAd,
    milestone_title: "",
    milestone_notes: "",
  });
  const [transformationPhotoFile, setTransformationPhotoFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CsvParsedRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [importing, setImporting] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const beginRequest = useLatestRequest(JSON.stringify([searchTerm, absentDays, createdSince, deletedFilter, membershipFilter, paymentFilter, planFilter, sortKey, currentPage]));
  const loadMembers = async () => {
    if (searchTerm !== debouncedSearch) return;
    const isCurrent = beginRequest();
    setResultsLoading(true);
    let query = supabase.from("members").select("*", { count: "exact" });
    if (deletedFilter === "active") query = query.is("deleted_at", null);
    if (deletedFilter === "deleted") query = query.not("deleted_at", "is", null);
    if (debouncedSearch.trim()) {
      const term = debouncedSearch.trim().replace(/[,%()]/g, " ");
      query = query.or(`full_name.ilike.%${term}%,member_id.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }
    if (planFilter !== "all") query = query.eq("membership_type", planFilter);
    if (paymentFilter !== "all") query = query.eq("payment_status", paymentFilter);
    if (createdSince) query = query.gte("created_at", `${createdSince}T00:00:00`);
    if (absentDays > 0) query = query.eq("membership_status", "active").or(`last_visit_date.is.null,last_visit_date.lt.${addDays(todayAd, -absentDays)}`);
    if (membershipFilter === "expiring") query = query.gte("end_date", todayAd).lte("end_date", addDays(todayAd, expiringDays));
    else if (membershipFilter === "expired") query = query.or(`membership_status.eq.expired,end_date.lt.${todayAd}`);
    else if (membershipFilter !== "all") query = query.eq("membership_status", membershipFilter);
    if (sortKey === "name_asc") query = query.order("full_name").order("id");
    else if (sortKey === "end_date_asc") query = query.order("end_date", { ascending: true, nullsFirst: false }).order("id");
    else if (sortKey === "created_desc") query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
    else query = query.order("updated_at", { ascending: false }).order("id", { ascending: false });
    const from = (currentPage - 1) * rowsPerPage;
    const membersRes = await query.range(from, from + rowsPerPage - 1);
    if (!isCurrent()) return;
    if (membersRes.error) {
      setMembers([]); setMemberCount(0);
      setMessage(membersRes.error.message);
      setLoading(false); setResultsLoading(false);
      return;
    }
    setMembers((membersRes.data ?? []) as MemberRow[]);
    setMemberCount(membersRes.count ?? 0);
    const summaryRes = await supabase.rpc("admin_member_summary");
    if (!isCurrent()) return;
    if (summaryRes.data) setMemberSummary(summaryRes.data as typeof memberSummary);
    setLoading(false); setResultsLoading(false);
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("pricing_items").select("id,title,is_active").eq("kind", "plan").eq("is_active", true).order("sort_order"),
    ]).then(([settingsRes, plansRes]) => {
      if (!alive) return;
      if (settingsRes.data) setSettings({ ...defaultAdminSettings, ...(settingsRes.data as AdminSettings) });
      setMembershipPlans((plansRes.data ?? []) as MembershipPlan[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => { void loadMembers(); }, [absentDays, createdSince, deletedFilter, membershipFilter, paymentFilter, planFilter, searchTerm, debouncedSearch, sortKey, currentPage]);

  const totalPages = Math.max(1, Math.ceil(memberCount / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedMembers = members;
  const validCsvRows = csvRows.filter((row) => row.errors.length === 0);
  const invalidCsvRows = csvRows.filter((row) => row.errors.length > 0);
  const activePlanNames = membershipPlans.map((plan) => plan.title.trim()).filter(Boolean);
  const filterPlanNames = Array.from(new Set([...activePlanNames, ...members.map((member) => member.membership_type)])).sort();
  const formPlanNames = Array.from(new Set([...activePlanNames, form.membership_type].filter(Boolean)));

  const resetPage = () => setCurrentPage(1);

  const openAddMember = () => {
    setEditingId(null);
    const defaultPlan = activePlanNames.find((plan) => plan.toLowerCase() === settings.default_membership_type.toLowerCase());
    setForm({ ...emptyMemberForm, membership_type: defaultPlan ?? activePlanNames[0] ?? "" });
    setFormErrors({});
    setMemberPhotoFile(null);
    setFormOpen(true);
  };

  const openEditMember = (member: MemberRow) => {
    setEditingId(member.id);
    setForm({
      member_id: member.member_id,
      full_name: member.full_name,
      email: member.email ?? "",
      phone: member.phone,
      address: member.address ?? "",
      photo_url: member.photo_url ?? "",
      membership_type: member.membership_type,
      membership_status: member.membership_status,
      start_date: member.start_date ?? "",
      end_date: member.end_date ?? "",
      last_visit_date: member.last_visit_date ?? "",
      payment_status: member.payment_status,
      payment_due_date: member.payment_due_date ?? "",
      notes: member.notes ?? "",
    });
    setFormErrors({});
    setMemberPhotoFile(null);
    setFormOpen(true);
  };

  const updateForm = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const saveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setMessage("");

    const normalizedForm = { ...form, phone: normalizePhone(form.phone) };
    const errors = validateMemberForm(normalizedForm, members, editingId);
    setFormErrors(errors);
    if (hasValidationErrors(errors)) return;

    setSaving(true);
    const normalizedEmail = normalizedForm.email?.trim() ?? "";
    const conflictFilters = [
      `member_id.eq.${normalizedForm.member_id.replace(/[,()]/g, "")}`,
      `phone.eq.${normalizedForm.phone.replace(/[,()]/g, "")}`,
      ...(normalizedEmail ? [`email.ilike.${normalizedEmail.replace(/[,()]/g, "")}`] : []),
    ];
    let conflictQuery = supabase.from("members").select("id,member_id,phone,email").or(conflictFilters.join(",")).limit(1);
    if (editingId) conflictQuery = conflictQuery.neq("id", editingId);
    const { data: conflicts, error: conflictError } = await conflictQuery;
    if (conflictError) {
      setSaving(false);
      setMessage(conflictError.message);
      return;
    }
    if (conflicts?.length) {
      setSaving(false);
      setFormErrors({ member_id: "Member ID, phone or email is already used by another member." });
      return;
    }
    let photoUrl = normalizedForm.photo_url;
    if (memberPhotoFile) {
      const extension = memberPhotoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `members/${normalizedForm.member_id}-${Date.now()}.${extension}`;
      const upload = await supabase.storage.from("gym-media").upload(path, memberPhotoFile);
      if (upload.error) {
        setSaving(false);
        setMessage(`Member photo could not be uploaded: ${upload.error.message}`);
        return;
      }
      photoUrl = supabase.storage.from("gym-media").getPublicUrl(path).data.publicUrl;
    }
    const payload = toMemberPayload({ ...normalizedForm, photo_url: photoUrl });
    const result = editingId
      ? await supabase.from("members").update(payload).eq("id", editingId)
      : await supabase.from("members").insert(payload);

    if (result.error) {
      setSaving(false);
      setMessage(result.error.message);
      return;
    }

    const webhookResult = await notifyN8nMembers({
      event_type: editingId ? "member_updated" : "member_created",
      source: "admin_manual",
      member_ids: [payload.member_id],
      count: 1,
      occurred_at: new Date().toISOString(),
    });

    setSaving(false);
    setFormOpen(false);
    await loadMembers();
    setMessage(
      webhookResult.ok
        ? `${editingId ? "Member updated" : "Member created"} and webhook notified.`
        : webhookResult.skipped
          ? `${editingId ? "Member updated" : "Member created"}. Webhook is not configured.`
          : `${editingId ? "Member updated" : "Member created"} but webhook failed: ${webhookResult.error}`
    );
  };

  const softDeleteMember = async (member: MemberRow) => {
    if (!window.confirm(`Move ${member.full_name} to deleted members?`)) return;
    const { error } = await supabase.from("members").update({ deleted_at: new Date().toISOString() }).eq("id", member.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Member moved to deleted list.");
    setDetailMember(null);
    await loadMembers();
  };

  const restoreMember = async (member: MemberRow) => {
    const { error } = await supabase.from("members").update({ deleted_at: null }).eq("id", member.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Member restored.");
    await loadMembers();
  };

  const bulkSetMembersDeleted = async (deleted: boolean) => {
    const ids = Array.from(selectedMemberIds);
    if (!ids.length) return;
    const action = deleted ? "move to the deleted list" : "restore";
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${ids.length} selected members?`)) return;
    const { error } = await supabase.from("members").update({ deleted_at: deleted ? new Date().toISOString() : null }).in("id", ids);
    if (error) { setMessage(error.message); return; }
    setSelectedMemberIds(new Set());
    setMessage(`${ids.length} members ${deleted ? "moved to the deleted list" : "restored"}.`);
    await loadMembers();
  };

  const toggleMemberSelection = (id: number) => {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadMemberProfile = async (member: MemberRow) => {
    setDetailMember(member);
    setGeneratedReport(null);
    setLoadingProfile(true);
    setMeasurements([]);
    setTransformations([]);
    setReportLogs([]);
    setMemberAttendance([]);

    const [measurementsRes, transformationsRes, logsRes, attendanceRes] = await Promise.all([
      supabase.from("member_measurements").select("*").eq("member_ref", member.id).order("recorded_at", { ascending: true }).limit(500),
      supabase.from("member_transformations").select("*").eq("member_ref", member.id).order("captured_at", { ascending: false }).limit(200),
      supabase.from("member_report_logs").select("*").eq("member_ref", member.id).order("sent_at", { ascending: false }).limit(20),
      supabase.from("attendance_records").select("id, member_ref, attendance_date, status, deleted_at").eq("member_ref", member.id).order("attendance_date", { ascending: false }).limit(60),
    ]);

    if (measurementsRes.error || transformationsRes.error || logsRes.error || attendanceRes.error) {
      setMessage(
        measurementsRes.error?.message ||
          transformationsRes.error?.message ||
          logsRes.error?.message ||
          attendanceRes.error?.message ||
          "Profile load failed."
      );
    } else {
      setMeasurements((measurementsRes.data ?? []) as MeasurementRow[]);
      setTransformations((transformationsRes.data ?? []) as TransformationRow[]);
      setReportLogs((logsRes.data ?? []) as MemberReportLogRow[]);
      setMemberAttendance((attendanceRes.data ?? []) as AttendanceRow[]);
    }
    setLoadingProfile(false);
  };
  const markPresentToday = async (member: MemberRow) => {
    const attendanceDate = getNepalTodayAdDate();
    const { error } = await supabase.from("attendance_records").upsert({ member_ref: member.id, attendance_date: attendanceDate, status: "present", deleted_at: null }, { onConflict: "member_ref,attendance_date" });
    if (error) { setMessage(error.message); return; }
    await supabase.from("members").update({ last_visit_date: attendanceDate }).eq("id", member.id);
    setMessage(`${member.full_name} marked present for today.`);
    await loadMemberProfile(member);
  };

  const addMeasurement = async () => {
    if (!detailMember) return;
    const { error } = await supabase.from("member_measurements").insert({
      member_ref: detailMember.id,
      recorded_at: measurementForm.recorded_at,
      weight_kg: toNullableNumber(measurementForm.weight_kg),
      body_fat_percent: toNullableNumber(measurementForm.body_fat_percent),
      chest_cm: toNullableNumber(measurementForm.chest_cm),
      waist_cm: toNullableNumber(measurementForm.waist_cm),
      hips_cm: toNullableNumber(measurementForm.hips_cm),
      arm_cm: toNullableNumber(measurementForm.arm_cm),
      thigh_cm: toNullableNumber(measurementForm.thigh_cm),
      notes: measurementForm.notes.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }
    setMeasurementForm({
      recorded_at: todayAd,
      weight_kg: "",
      body_fat_percent: "",
      chest_cm: "",
      waist_cm: "",
      hips_cm: "",
      arm_cm: "",
      thigh_cm: "",
      notes: "",
    });
    await loadMemberProfile(detailMember);
  };

  const deleteMeasurement = async (id: number) => {
    if (!detailMember || !window.confirm("Delete this measurement log?")) return;
    const { error } = await supabase.from("member_measurements").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await loadMemberProfile(detailMember);
  };

  const uploadMilestoneImage = async (file: File, memberId: number) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `member-transformations/${memberId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("gym-media").upload(path, file);
    if (error) throw error;
    return supabase.storage.from("gym-media").getPublicUrl(path).data.publicUrl;
  };

  const addTransformation = async () => {
    if (!detailMember) return;
    let photoUrl: string | null = null;
    if (transformationPhotoFile) {
      try {
        photoUrl = await uploadMilestoneImage(transformationPhotoFile, detailMember.id);
      } catch (error) {
        setMessage(errorMessage(error));
        return;
      }
    }

    const { error } = await supabase.from("member_transformations").insert({
      member_ref: detailMember.id,
      captured_at: transformationForm.captured_at,
      milestone_title: transformationForm.milestone_title.trim() || null,
      milestone_notes: transformationForm.milestone_notes.trim() || null,
      photo_url: photoUrl,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTransformationForm({ captured_at: todayAd, milestone_title: "", milestone_notes: "" });
    setTransformationPhotoFile(null);
    await loadMemberProfile(detailMember);
  };

  const deleteTransformation = async (id: number) => {
    if (!detailMember || !window.confirm("Delete this transformation entry?")) return;
    const { error } = await supabase.from("member_transformations").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await loadMemberProfile(detailMember);
  };

  const sendProgressReport = async () => {
    if (!detailMember) return;
    const { data, error } = await supabase.functions.invoke("send-progress-report", {
      body: { member_id: detailMember.id },
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    const response = data as SendProgressReportResponse;
    if (!response.ok) {
      setMessage(response.error || "Progress report failed.");
      return;
    }
    setGeneratedReport(response.report ?? null);
    setMessage("Progress report generated.");
    await loadMemberProfile(detailMember);
  };

  const parseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    setCsvRows([]);
    setMessage("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Only CSV files are supported.");
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      setMessage("CSV is empty.");
      return;
    }

    const headerParts = parseCsvLine(lines[0]);
    const missingHeaders = csvHeaders.filter((header) => !headerParts.includes(header));
    if (missingHeaders.length > 0) {
      setMessage(`Missing CSV columns: ${missingHeaders.join(", ")}`);
      return;
    }

    const headerIndex = Object.fromEntries(headerParts.map((header, index) => [header, index]));
    const seen = new Set<string>();
    const existingIds = new Set(members.map((member) => member.member_id));

    const parsed = lines.slice(1).map((line, index) => {
      const values = parseCsvLine(line);
      const row: MemberForm = {
        member_id: values[headerIndex.member_id] || "",
        full_name: values[headerIndex.full_name] || "",
        email: values[headerIndex.email] || "",
        phone: values[headerIndex.phone] || "",
        address: "",
        photo_url: "",
        membership_type: (values[headerIndex.membership_type] || "monthly").toLowerCase() as MembershipType,
        membership_status: (values[headerIndex.membership_status] || "active").toLowerCase() as MembershipStatus,
        start_date: values[headerIndex.start_date] || "",
        end_date: values[headerIndex.end_date] || "",
        last_visit_date: values[headerIndex.last_visit_date] || "",
        payment_status: (values[headerIndex.payment_status] || "unpaid").toLowerCase() as PaymentStatus,
        payment_due_date: values[headerIndex.payment_due_date] || "",
        notes: values[headerIndex.notes] || "",
      };
      const rowErrors = validateMemberForm(row, [], null);
      const errors = Object.values(rowErrors).filter((value): value is string => Boolean(value));
      const warnings: string[] = [];

      if (seen.has(row.member_id)) errors.push("Duplicate member_id inside CSV.");
      if (row.member_id) seen.add(row.member_id);
      if (existingIds.has(row.member_id)) warnings.push("Existing member ID will be updated.");

      return { ...row, rowNumber: index + 2, errors, warnings };
    });

    setCsvRows(parsed);
  };

  const importCsvRows = async () => {
    if (validCsvRows.length === 0 || importing) return;
    setImporting(true);
    const payload = validCsvRows.map((row) => toMemberPayload(row));
    const { error } = await supabase.from("members").upsert(payload, { onConflict: "member_id" });

    if (error) {
      setImporting(false);
      setMessage(error.message);
      return;
    }

    const webhookResult = await notifyN8nMembers({
      event_type: "members_imported",
      source: "admin_csv_import",
      member_ids: payload.map((row) => row.member_id),
      count: payload.length,
      occurred_at: new Date().toISOString(),
    });

    setImporting(false);
    setCsvRows([]);
    setCsvName("");
    setCsvOpen(false);
    await loadMembers();
    setMessage(
      webhookResult.ok
        ? `Imported ${payload.length} members and webhook notified.`
        : webhookResult.skipped
          ? `Imported ${payload.length} members. Webhook is not configured.`
          : `Imported ${payload.length} members but webhook failed: ${webhookResult.error}`
    );
  };

  if (loading) return <AdminLoading label="Loading members..." />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Members"
        title="Member management"
        description="Search, filter, create, edit, restore and review member records without losing existing history."
        actions={
          <>
            <AdminButton type="button" variant="secondary" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4" />
              CSV import
            </AdminButton>
            <AdminButton type="button" variant="primary" onClick={openAddMember}>
              <Plus className="h-4 w-4" />
              Add member
            </AdminButton>
          </>
        }
      />

      {message ? <AdminNotice tone={message.toLowerCase().includes("failed") || message.toLowerCase().includes("error") ? "danger" : "success"}>{message}</AdminNotice> : null}

      <AdminCard>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
          <AdminSearchField
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              resetPage();
            }}
            placeholder="Search by name, phone, email or member ID"
          />
          <AdminSelect
            options={membershipOptions}
            value={membershipFilter}
            onChange={(event) => {
              setMembershipFilter(event.target.value as MembershipFilter);
              resetPage();
            }}
          />
          <AdminSelect
            options={paymentOptions}
            value={paymentFilter}
            onChange={(event) => {
              setPaymentFilter(event.target.value as PaymentFilter);
              resetPage();
            }}
          />
          <AdminSelect
            options={[{ value: "all", label: "All plans" }, ...filterPlanNames.map((value) => ({ value, label: value }))]}
            value={planFilter}
            onChange={(event) => {
              setPlanFilter(event.target.value);
              resetPage();
            }}
          />
          <AdminSelect
            options={deletedOptions}
            value={deletedFilter}
            onChange={(event) => {
              setDeletedFilter(event.target.value as DeletedFilter);
              resetPage();
            }}
          />
          <AdminSelect
            options={sortOptions}
            value={sortKey}
            onChange={(event) => {
              setSortKey(event.target.value as SortKey);
              resetPage();
            }}
          />
        </div>

        {(membershipFilter === "expiring" || createdSince || absentDays > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {membershipFilter === "expiring" ? (
              <AdminBadge tone="warning">Expiring within {expiringDays} days</AdminBadge>
            ) : null}
            {createdSince ? <AdminBadge tone="accent">Created since {formatDisplayDate(createdSince, "bs")}</AdminBadge> : null}
            {absentDays > 0 ? <AdminBadge tone="warning">No last visit for {absentDays}+ days</AdminBadge> : null}
            <AdminButton
              type="button"
              variant="ghost"
              onClick={() => {
                setMembershipFilter("all");
                setCreatedSince("");
                setAbsentDays(0);
                resetPage();
              }}
            >
              Clear dashboard filters
            </AdminButton>
          </div>
        )}
      </AdminCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminCard className="p-4">
          <div className="text-xs text-slate-500">Visible records</div>
          <div className="mt-1 text-2xl font-black text-white">{memberCount}</div>
        </AdminCard>
        <AdminCard className="p-4">
          <div className="text-xs text-slate-500">Active members</div>
          <div className="mt-1 text-2xl font-black text-white">{memberSummary.active}</div>
        </AdminCard>
        <AdminCard className="p-4">
          <div className="text-xs text-slate-500">Payment follow-up</div>
          <div className="mt-1 text-2xl font-black text-white">{memberSummary.payment_follow_up}</div>
        </AdminCard>
        <AdminCard className="p-4">
          <div className="text-xs text-slate-500">Deleted members</div>
          <div className="mt-1 text-2xl font-black text-white">{memberSummary.deleted}</div>
        </AdminCard>
      </div>

      {selectedMemberIds.size > 0 ? (
        <AdminCard className="flex flex-col gap-3 border-amber-400/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold text-white">{selectedMemberIds.size} member{selectedMemberIds.size === 1 ? "" : "s"} selected</div>
          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" variant="danger" onClick={() => bulkSetMembersDeleted(true)}><Trash2 className="h-4 w-4" />Delete selected</AdminButton>
            <AdminButton type="button" variant="secondary" onClick={() => bulkSetMembersDeleted(false)}><RotateCcw className="h-4 w-4" />Restore selected</AdminButton>
            <AdminButton type="button" variant="ghost" onClick={() => setSelectedMemberIds(new Set())}>Clear selection</AdminButton>
          </div>
        </AdminCard>
      ) : null}

      {resultsLoading || searchTerm !== debouncedSearch ? <AdminLoading label="Searching members..." /> : null}
      <div hidden={resultsLoading || searchTerm !== debouncedSearch}>
      <AdminCard padded={false}>
        <div className="hidden lg:block">
          <AdminTableShell>
            <AdminTableScroll>
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all members on this page"
                        checked={pagedMembers.length > 0 && pagedMembers.every((member) => selectedMemberIds.has(member.id))}
                        onChange={(event) => setSelectedMemberIds((current) => {
                          const next = new Set(current);
                          pagedMembers.forEach((member) => event.target.checked ? next.add(member.id) : next.delete(member.id));
                          return next;
                        })}
                        className="h-4 w-4 accent-amber-300"
                      />
                    </th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Membership</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pagedMembers.map((member) => (
                    <tr key={member.id} className="bg-slate-950/60 hover:bg-slate-900/65">
                      <td className="px-4 py-4"><input type="checkbox" aria-label={`Select ${member.full_name}`} checked={selectedMemberIds.has(member.id)} onChange={() => toggleMemberSelection(member.id)} className="h-4 w-4 accent-amber-300" /></td>
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => loadMemberProfile(member)} className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
                          <div className="font-semibold text-white">{member.full_name}</div>
                          <div className="text-xs text-slate-500">{member.member_id} | {member.phone}</div>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{statusLabel(member.membership_type)}</td>
                      <td className="px-4 py-4">
                        <AdminBadge tone={memberStatusTone(member, todayAd)}>{member.deleted_at ? "Deleted" : statusLabel(getMemberLifecycle(member, todayAd))}</AdminBadge>
                      </td>
                      <td className="px-4 py-4">
                        <AdminBadge tone={paymentTone(member.payment_status)}>{statusLabel(member.payment_status)}</AdminBadge>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        <div>End: {formatDisplayDate(member.end_date, settings.date_display_preference)}</div>
                        <div>Due: {formatDisplayDate(member.payment_due_date, settings.date_display_preference)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <AdminButton type="button" variant="secondary" onClick={() => openEditMember(member)} aria-label={`Edit ${member.full_name}`}>
                            <Pencil className="h-4 w-4" />
                          </AdminButton>
                          {member.deleted_at ? (
                            <AdminButton type="button" variant="secondary" onClick={() => restoreMember(member)} aria-label={`Restore ${member.full_name}`}>
                              <RotateCcw className="h-4 w-4" />
                            </AdminButton>
                          ) : (
                            <AdminButton type="button" variant="danger" onClick={() => softDeleteMember(member)} aria-label={`Delete ${member.full_name}`}>
                              <Trash2 className="h-4 w-4" />
                            </AdminButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
          </AdminTableShell>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {pagedMembers.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${member.full_name}`} checked={selectedMemberIds.has(member.id)} onChange={() => toggleMemberSelection(member.id)} className="mt-1 h-4 w-4 accent-amber-300" /><button type="button" onClick={() => loadMemberProfile(member)} className="text-left"><div className="font-semibold text-white">{member.full_name}</div><div className="text-xs text-slate-500">{member.member_id}</div></button></div>
                <AdminBadge tone={memberStatusTone(member, todayAd)}>{member.deleted_at ? "Deleted" : statusLabel(getMemberLifecycle(member, todayAd))}</AdminBadge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>Phone: {member.phone}</div>
                <div>Plan: {statusLabel(member.membership_type)}</div>
                <div>End: {formatDisplayDate(member.end_date, settings.date_display_preference)}</div>
                <div>Due: {formatDisplayDate(member.payment_due_date, settings.date_display_preference)}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <AdminButton type="button" variant="secondary" className="flex-1" onClick={() => openEditMember(member)}>
                  Edit
                </AdminButton>
                {member.deleted_at ? (
                  <AdminButton type="button" variant="secondary" className="flex-1" onClick={() => restoreMember(member)}>
                    Restore
                  </AdminButton>
                ) : (
                  <AdminButton type="button" variant="danger" className="flex-1" onClick={() => softDeleteMember(member)}>
                    Delete
                  </AdminButton>
                )}
              </div>
            </article>
          ))}
        </div>

        {pagedMembers.length === 0 ? (
          <div className="p-4">
            <AdminEmptyState title="No members found" description="Try a different search or filter, or add a new member." />
          </div>
        ) : null}
        <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </AdminCard>
      </div>

      <AdminDialog
        open={formOpen}
        title={editingId ? "Edit member" : "Create member"}
        description="Fields are grouped for front-desk entry. All dates use the Nepali calendar (BS)."
        onClose={() => setFormOpen(false)}
        size="2xl"
      >
        <form onSubmit={saveMember} className="space-y-6">
          <AdminCard>
            <AdminSectionTitle title="Identity and contact" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <AdminField label="Member ID" error={formErrors.member_id}>
                <AdminInput value={form.member_id} onChange={(event) => updateForm("member_id", event.target.value)} />
              </AdminField>
              <AdminField label="Full name" error={formErrors.full_name}>
                <AdminInput value={form.full_name} onChange={(event) => updateForm("full_name", event.target.value)} />
              </AdminField>
              <AdminField label="Phone" error={formErrors.phone}>
                <AdminInput value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
              </AdminField>
              <AdminField label="Email" error={formErrors.email}>
                <AdminInput value={form.email ?? ""} onChange={(event) => updateForm("email", event.target.value)} />
              </AdminField>
              <AdminField label="Address">
                <AdminInput value={form.address ?? ""} onChange={(event) => updateForm("address", event.target.value)} placeholder="Member's home address" />
              </AdminField>
              <AdminField label="Member photo" hint="JPG, PNG, WebP or GIF, up to 10 MB">
                <AdminInput type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setMemberPhotoFile(event.target.files?.[0] ?? null)} />
                {memberPhotoFile || form.photo_url ? (
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    {form.photo_url ? <img src={form.photo_url} alt="Current member" className="h-14 w-14 rounded-lg object-cover" /> : null}
                    <span>{memberPhotoFile?.name ?? "Current photo"}</span>
                  </div>
                ) : null}
              </AdminField>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Membership and payment" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <AdminField label="Plan" error={formErrors.membership_type}>
                <AdminSelect<MembershipType>
                  options={[
                    { value: "", label: membershipPlans.length ? "Choose a membership plan" : "No active plans available" },
                    ...formPlanNames.map((value) => ({ value, label: value })),
                  ]}
                  value={form.membership_type}
                  onChange={(event) => updateForm("membership_type", event.target.value as MembershipType)}
                />
                {!membershipPlans.length ? (
                  <AdminButton type="button" variant="secondary" className="mt-2" onClick={() => navigate("/admin/pricing")}>Manage membership plans</AdminButton>
                ) : null}
              </AdminField>
              <AdminField label="Membership status" error={formErrors.membership_status}>
                <AdminSelect<MembershipStatus>
                  options={membershipStatuses.map((value) => ({ value, label: statusLabel(value) }))}
                  value={form.membership_status}
                  onChange={(event) => updateForm("membership_status", event.target.value as MembershipStatus)}
                />
              </AdminField>
              <AdminField label="Payment status" error={formErrors.payment_status}>
                <AdminSelect<PaymentStatus>
                  options={paymentStatuses.map((value) => ({ value, label: statusLabel(value) }))}
                  value={form.payment_status}
                  onChange={(event) => updateForm("payment_status", event.target.value as PaymentStatus)}
                />
              </AdminField>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <BsAdDateField label="Start date" adValue={form.start_date} onChangeAd={(value) => updateForm("start_date", value)} error={formErrors.start_date} />
              <BsAdDateField label="End date" adValue={form.end_date} onChangeAd={(value) => updateForm("end_date", value)} error={formErrors.end_date} />
              <BsAdDateField label="Last visit" adValue={form.last_visit_date} onChangeAd={(value) => updateForm("last_visit_date", value)} error={formErrors.last_visit_date} />
              <BsAdDateField label="Payment due" adValue={form.payment_due_date} onChangeAd={(value) => updateForm("payment_due_date", value)} error={formErrors.payment_due_date} />
            </div>
          </AdminCard>

          <AdminCard>
            <AdminField label="Notes">
              <AdminTextarea rows={4} value={form.notes ?? ""} onChange={(event) => updateForm("notes", event.target.value)} />
            </AdminField>
          </AdminCard>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AdminButton type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update member" : "Create member"}
            </AdminButton>
          </div>
        </form>
      </AdminDialog>

      <AdminDrawer
        open={Boolean(detailMember)}
        title={detailMember?.full_name ?? "Member profile"}
        description={detailMember ? `${detailMember.member_id} | ${detailMember.phone}` : undefined}
        onClose={() => setDetailMember(null)}
        size="2xl"
        footer={
          detailMember ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <AdminButton type="button" variant="secondary" onClick={() => openEditMember(detailMember)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </AdminButton>
                <AdminButton type="button" variant="secondary" onClick={() => navigate("/admin/billing", { state: { memberId: detailMember.id } })}>
                  <ReceiptText className="h-4 w-4" />
                  Record payment / Create bill
                </AdminButton>
                {!detailMember.deleted_at ? <AdminButton type="button" variant="primary" onClick={() => void markPresentToday(detailMember)}><CheckCircle2 className="h-4 w-4"/>Mark Present</AdminButton> : null}
              </div>
              {detailMember.deleted_at ? (
                <AdminButton type="button" variant="secondary" onClick={() => restoreMember(detailMember)}>
                  Restore member
                </AdminButton>
              ) : (
                <AdminButton type="button" variant="danger" onClick={() => softDeleteMember(detailMember)}>
                  Delete member
                </AdminButton>
              )}
            </div>
          ) : null
        }
      >
        {detailMember ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <AdminCard className="lg:col-span-2">
                <div className="flex items-start gap-3">
                  {detailMember.photo_url ? (
                    <img src={detailMember.photo_url} alt={detailMember.full_name} className="h-20 w-20 shrink-0 rounded-xl border border-slate-800 object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
                      <UserRound className="h-8 w-8" />
                    </div>
                  )}
                  <div>
                    <div className="text-xl font-black text-white">{detailMember.full_name}</div>
                    <div className="text-sm text-slate-400">{detailMember.email || "No email"} | {detailMember.phone}</div>
                    <div className="mt-1 text-sm text-slate-400">{detailMember.address || "No address added"}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminBadge tone={memberStatusTone(detailMember, todayAd)}>{detailMember.deleted_at ? "Deleted" : statusLabel(getMemberLifecycle(detailMember, todayAd))}</AdminBadge>
                      <AdminBadge tone={paymentTone(detailMember.payment_status)}>{statusLabel(detailMember.payment_status)}</AdminBadge>
                    </div>
                  </div>
                </div>
              </AdminCard>
              <AdminCard>
                <div className="text-xs text-slate-500">Membership end</div>
                <div className="mt-2 text-sm font-semibold text-white">{formatDisplayDate(detailMember.end_date, settings.date_display_preference)}</div>
              </AdminCard>
              <AdminCard>
                <div className="text-xs text-slate-500">Payment due</div>
                <div className="mt-2 text-sm font-semibold text-white">{formatDisplayDate(detailMember.payment_due_date, settings.date_display_preference)}</div>
              </AdminCard>
            </div>

            <AdminCard>
              <AdminSectionTitle title="Membership details" />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm text-slate-300">Plan: <b>{statusLabel(detailMember.membership_type)}</b></div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm text-slate-300">Start: <b>{formatDisplayDate(detailMember.start_date, settings.date_display_preference)}</b></div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm text-slate-300">Last visit: <b>{formatDisplayDate(detailMember.last_visit_date, settings.date_display_preference)}</b></div>
              </div>
              {detailMember.notes ? <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm text-slate-300">{detailMember.notes}</div> : null}
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle title="Recent attendance" description="Latest saved records for this member." />
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                {memberAttendance.slice(0, 9).map((record) => (
                  <div key={record.id} className={cx("rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm", record.deleted_at ? "text-slate-500" : "text-slate-200")}>
                    <div className="font-semibold">{formatDisplayDate(record.attendance_date, settings.date_display_preference)}</div>
                    <div className="text-xs text-slate-500">{record.deleted_at ? "Deleted" : statusLabel(record.status)}</div>
                  </div>
                ))}
                {!loadingProfile && memberAttendance.length === 0 ? <AdminEmptyState title="No attendance records" /> : null}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle title="Body measurements" />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <AdminBsDateInput value={measurementForm.recorded_at} onChange={(value) => setMeasurementForm((current) => ({ ...current, recorded_at: value }))} />
                <AdminInput placeholder="Weight kg" value={measurementForm.weight_kg} onChange={(event) => setMeasurementForm((current) => ({ ...current, weight_kg: event.target.value }))} />
                <AdminInput placeholder="Body fat %" value={measurementForm.body_fat_percent} onChange={(event) => setMeasurementForm((current) => ({ ...current, body_fat_percent: event.target.value }))} />
                <AdminButton type="button" variant="primary" onClick={addMeasurement}>Add measurement</AdminButton>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
                <AdminInput placeholder="Chest cm" value={measurementForm.chest_cm} onChange={(event) => setMeasurementForm((current) => ({ ...current, chest_cm: event.target.value }))} />
                <AdminInput placeholder="Waist cm" value={measurementForm.waist_cm} onChange={(event) => setMeasurementForm((current) => ({ ...current, waist_cm: event.target.value }))} />
                <AdminInput placeholder="Hips cm" value={measurementForm.hips_cm} onChange={(event) => setMeasurementForm((current) => ({ ...current, hips_cm: event.target.value }))} />
                <AdminInput placeholder="Arm cm" value={measurementForm.arm_cm} onChange={(event) => setMeasurementForm((current) => ({ ...current, arm_cm: event.target.value }))} />
                <AdminInput placeholder="Thigh cm" value={measurementForm.thigh_cm} onChange={(event) => setMeasurementForm((current) => ({ ...current, thigh_cm: event.target.value }))} />
              </div>
              <AdminTextarea className="mt-3" rows={2} placeholder="Measurement notes" value={measurementForm.notes} onChange={(event) => setMeasurementForm((current) => ({ ...current, notes: event.target.value }))} />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">Weight trend</div>
                  <MiniLineChart values={measurements.map((item) => item.weight_kg)} stroke="#38bdf8" />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-slate-400">Waist trend</div>
                  <MiniLineChart values={measurements.map((item) => item.waist_cm)} stroke="#34d399" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {measurements.slice().reverse().slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-xs text-slate-300">
                    <span>{item.recorded_at} | W {item.weight_kg ?? "-"} | BF {item.body_fat_percent ?? "-"} | Waist {item.waist_cm ?? "-"}</span>
                    <AdminButton type="button" variant="danger" className="min-h-8 px-2 py-1 text-xs" onClick={() => deleteMeasurement(item.id)}>Delete</AdminButton>
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle title="Transformation timeline" />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <AdminBsDateInput value={transformationForm.captured_at} onChange={(value) => setTransformationForm((current) => ({ ...current, captured_at: value }))} />
                <AdminInput placeholder="Milestone title" value={transformationForm.milestone_title} onChange={(event) => setTransformationForm((current) => ({ ...current, milestone_title: event.target.value }))} />
                <AdminInput type="file" accept="image/*" onChange={(event) => setTransformationPhotoFile(event.target.files?.[0] ?? null)} />
                <AdminButton type="button" variant="primary" onClick={addTransformation}>Add timeline entry</AdminButton>
              </div>
              <AdminTextarea className="mt-3" rows={2} placeholder="Milestone notes" value={transformationForm.milestone_notes} onChange={(event) => setTransformationForm((current) => ({ ...current, milestone_notes: event.target.value }))} />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {transformations.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.milestone_title || "Milestone"}</div>
                        <div className="text-xs text-slate-500">{formatDisplayDate(item.captured_at, settings.date_display_preference)}</div>
                      </div>
                      <AdminButton type="button" variant="danger" className="min-h-8 px-2 py-1 text-xs" onClick={() => deleteTransformation(item.id)}>Delete</AdminButton>
                    </div>
                    {item.milestone_notes ? <p className="mt-2 text-sm text-slate-400">{item.milestone_notes}</p> : null}
                    {item.photo_url ? <img src={item.photo_url} alt={item.milestone_title || "Transformation milestone"} className="mt-3 h-44 w-full rounded-lg object-cover" /> : null}
                  </article>
                ))}
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle
                title="Progress report"
                description="Generated by the existing Supabase Edge Function."
                action={
                  <AdminButton type="button" variant="secondary" onClick={sendProgressReport}>
                    <FileText className="h-4 w-4" />
                    Generate
                  </AdminButton>
                }
              />
              {generatedReport ? (
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/55 p-4">
                  <div className="text-sm font-semibold text-white">{generatedReport.member_name}</div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {generatedReport.summary_lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 space-y-2">
                {reportLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-xs text-slate-400">
                    {formatDateTime(log.sent_at)} | {log.status}
                    {log.error_message ? ` | ${log.error_message}` : ""}
                  </div>
                ))}
              </div>
            </AdminCard>

            {loadingProfile ? <AdminLoading label="Refreshing profile data..." /> : null}
          </div>
        ) : null}
      </AdminDrawer>

      <AdminDialog
        open={csvOpen}
        title="CSV member import"
        description="Imports valid rows and upserts by member_id. Existing n8n webhook behavior is preserved."
        onClose={() => setCsvOpen(false)}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href="/members-import-template.csv" className="text-sm font-semibold text-amber-200 hover:text-amber-100">
              Download CSV template
            </a>
            <div className="flex gap-2">
              <AdminButton type="button" variant="secondary" onClick={() => setCsvOpen(false)}>
                Close
              </AdminButton>
              <AdminButton type="button" variant="primary" disabled={validCsvRows.length === 0 || invalidCsvRows.length > 0 || importing} onClick={importCsvRows}>
                {importing ? "Importing..." : `Import ${validCsvRows.length} rows`}
              </AdminButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <AdminNotice tone={n8nMembersWebhookUrl ? "success" : "warning"}>
            n8n webhook: {n8nMembersWebhookUrl ? "configured" : "not configured"}. Secret value is masked.
          </AdminNotice>
          <AdminField label="CSV file">
            <AdminInput type="file" accept=".csv,text/csv" onChange={parseCsv} />
          </AdminField>
          {csvName ? <div className="text-sm text-slate-400">Selected: {csvName}</div> : null}
          {csvRows.length > 0 ? (
            <div className="rounded-lg border border-slate-800">
              <div className="border-b border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                Valid rows: {validCsvRows.length} | Invalid rows: {invalidCsvRows.length}
              </div>
              <div className="max-h-72 overflow-y-auto p-3">
                {csvRows.slice(0, 20).map((row) => (
                  <div key={`${row.member_id}-${row.rowNumber}`} className="mb-2 rounded-lg border border-slate-800 bg-slate-900/55 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-white">Row {row.rowNumber}: {row.full_name || "Unnamed member"}</div>
                      <AdminBadge tone={row.errors.length ? "danger" : row.warnings.length ? "warning" : "success"}>
                        {row.errors.length ? "Invalid" : row.warnings.length ? "Warning" : "Valid"}
                      </AdminBadge>
                    </div>
                    {row.errors.length ? <div className="mt-1 text-xs text-rose-300">{row.errors.join(", ")}</div> : null}
                    {row.warnings.length ? <div className="mt-1 text-xs text-amber-300">{row.warnings.join(", ")}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </AdminDialog>
    </div>
  );
}
