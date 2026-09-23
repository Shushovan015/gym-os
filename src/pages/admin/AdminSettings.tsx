import { useEffect, useMemo, useState } from "react";
import { Database, LockKeyhole, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminPageHeader,
  AdminSectionTitle,
  AdminSelect,
  AdminTextarea,
} from "@src/components/admin/AdminUI";
import type { AdminSettings as AdminSettingsType, MembershipType } from "./adminTypes";
import { defaultAdminSettings, WEEKDAYS } from "./adminUtils";
import { membershipTypes } from "./adminTypes";
import BackupRestorePanel from "./BackupRestorePanel";

type SettingsErrors = Partial<Record<keyof AdminSettingsType, string>>;

const n8nWebhookConfigured = Boolean((import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_URL as string | undefined)?.trim());
const n8nSecretConfigured = Boolean((import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_SECRET as string | undefined)?.trim());

const membershipOptions = membershipTypes.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));
const warningOptions = [
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
];
const dayOptions = WEEKDAYS.map((label, value) => ({ value, label }));

function validateSettings(form: AdminSettingsType) {
  const errors: SettingsErrors = {};
  if (!form.gym_name.trim()) errors.gym_name = "Gym name is required.";
  if (!form.phone.trim()) errors.phone = "Phone is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid email.";
  if (!form.address.trim()) errors.address = "Address is required.";
  if (!form.operating_hours.trim()) errors.operating_hours = "Operating hours are required.";
  if (form.weekly_closing_day < 0 || form.weekly_closing_day > 6) errors.weekly_closing_day = "Select a valid weekly closing day.";
  if (![7, 15, 30].includes(form.expiry_warning_days)) errors.expiry_warning_days = "Choose 7, 15 or 30 days.";
  if (form.absent_after_days < 1 || form.absent_after_days > 60) errors.absent_after_days = "Use a value between 1 and 60 days.";
if (!/^[A-Z0-9-]{1,12}$/.test(form.invoice_prefix)) errors.invoice_prefix = "Use 1-12 uppercase letters, numbers or hyphens.";
  if (!/^[A-Z]{3}$/.test(form.currency_code)) errors.currency_code = "Use a three-letter currency code.";
  if (form.tax_rate_basis_points < 0 || form.tax_rate_basis_points > 10000) errors.tax_rate_basis_points = "Tax rate must be between 0% and 100%.";
  if (!Number.isSafeInteger(form.invoice_start_number) || form.invoice_start_number < 1 || form.invoice_start_number >= Number.MAX_SAFE_INTEGER) errors.invoice_start_number = "Enter a positive whole number.";
  if (form.bill_sender_email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(form.bill_sender_email.trim())) errors.bill_sender_email = "Enter a valid Gmail or Google Workspace email address.";
  return errors;
}

function hasErrors(errors: SettingsErrors) {
  return Object.values(errors).some(Boolean);
}

export default function AdminSettings() {
  const [form, setForm] = useState<AdminSettingsType>(defaultAdminSettings);
  const [saved, setSaved] = useState<AdminSettingsType>(defaultAdminSettings);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadWarning, setLoadWarning] = useState("");

  useEffect(() => {
    let alive = true;

    supabase
      .from("admin_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setLoadWarning(
            "Admin settings table is not available yet. Apply supabase/admin_settings_setup.sql to persist settings."
          );
          setForm(defaultAdminSettings);
          setSaved(defaultAdminSettings);
        } else {
          const next = { ...defaultAdminSettings, ...((data as AdminSettingsType | null) ?? {}) };
          setForm(next);
          setSaved(next);
        }
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  const update = <K extends keyof AdminSettingsType>(key: K, value: AdminSettingsType[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const nextErrors = validateSettings(form);
    setErrors(nextErrors);
    setMessage("");
    if (hasErrors(nextErrors)) return;

    if (form.weekly_closing_day !== saved.weekly_closing_day) {
      const confirmed = window.confirm(
        "Changing the weekly closing day affects attendance availability. Save this change?"
      );
      if (!confirmed) return;
    }

    setSaving(true);
    const payload = {
      id: 1,
      gym_name: form.gym_name.trim(),
      logo_url: form.logo_url?.trim() || null,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      operating_hours: form.operating_hours.trim(),
      weekly_closing_day: form.weekly_closing_day,
      expiry_warning_days: form.expiry_warning_days,
      absent_after_days: form.absent_after_days,
      default_membership_type: form.default_membership_type,
      date_display_preference: "bs",
      attendance_holiday_lock: form.attendance_holiday_lock,
invoice_prefix: form.invoice_prefix.trim().toUpperCase(),
      invoice_start_number: form.invoice_start_number,
      bill_sender_email: form.bill_sender_email?.trim() || null,
      currency_code: form.currency_code.trim().toUpperCase(),
      currency_minor_unit: form.currency_minor_unit,
      tax_enabled: form.tax_enabled,
      tax_label: form.tax_label.trim() || "Tax",
      tax_rate_basis_points: form.tax_rate_basis_points,
      pan_vat_number: form.pan_vat_number?.trim() || null,
      receipt_footer: form.receipt_footer.trim(),
      allow_negative_stock: form.allow_negative_stock,
    };

    const { data, error } = await supabase
      .from("admin_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const next = { ...defaultAdminSettings, ...(data as AdminSettingsType) };
    setForm(next);
    setSaved(next);
    setMessage("Settings saved.");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Admin settings"
        title="Single-gym settings"
        description="Operational settings that affect this A&A Health Club admin workspace. Sensitive server keys are never shown here."
        actions={
          <AdminButton type="button" variant="primary" onClick={save} disabled={saving || loading || !isDirty}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </AdminButton>
        }
      />

      {loadWarning ? <AdminNotice tone="warning">{loadWarning}</AdminNotice> : null}
      {message ? <AdminNotice tone={message === "Settings saved." ? "success" : "danger"}>{message}</AdminNotice> : null}
      {isDirty ? <AdminNotice tone="warning">You have unsaved settings changes.</AdminNotice> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <AdminCard>
            <AdminSectionTitle title="Gym profile" description="Public identity and front-desk contact information for this gym." />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <AdminField label="Gym name" error={errors.gym_name}>
                <AdminInput value={form.gym_name} onChange={(event) => update("gym_name", event.target.value)} />
              </AdminField>
              <AdminField label="Logo URL" hint="Optional. Existing local assets are not changed.">
                <AdminInput value={form.logo_url ?? ""} onChange={(event) => update("logo_url", event.target.value)} placeholder="https://..." />
              </AdminField>
              <AdminField label="Phone" error={errors.phone}>
                <AdminInput value={form.phone} onChange={(event) => update("phone", event.target.value)} />
              </AdminField>
              <AdminField label="Email" error={errors.email}>
                <AdminInput value={form.email} onChange={(event) => update("email", event.target.value)} />
              </AdminField>
              <AdminField label="Address" error={errors.address}>
                <AdminTextarea rows={3} value={form.address} onChange={(event) => update("address", event.target.value)} />
              </AdminField>
              <AdminField label="Operating hours" error={errors.operating_hours}>
                <AdminTextarea rows={3} value={form.operating_hours} onChange={(event) => update("operating_hours", event.target.value)} />
              </AdminField>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Membership defaults" description="Used by dashboard warnings and member creation defaults." />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <AdminField label="Default membership type">
                <AdminSelect<MembershipType>
                  options={membershipOptions}
                  value={form.default_membership_type}
                  onChange={(event) => update("default_membership_type", event.target.value as MembershipType)}
                />
              </AdminField>
              <AdminField label="Expiry warning" error={errors.expiry_warning_days}>
                <AdminSelect<number>
                  options={warningOptions}
                  value={form.expiry_warning_days}
                  onChange={(event) => update("expiry_warning_days", Number(event.target.value))}
                />
              </AdminField>
              <AdminField label="Date system" hint="All dates and calendars throughout admin use Bikram Sambat."><AdminInput value="Nepali calendar (BS)" readOnly /></AdminField>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Billing and inventory" description="Currency, tax, invoice numbering and stock safeguards." />
<div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <AdminField label="Bill sender email" error={errors.bill_sender_email} hint="Your Gmail / Google Workspace address. Must match the server's GMAIL_USER. The App Password belongs only in the server environment file."><AdminInput type="email" value={form.bill_sender_email ?? ""} onChange={(event) => update("bill_sender_email", event.target.value)} placeholder="yourgym@gmail.com" /></AdminField>
              <AdminField label="Invoice prefix" error={errors.invoice_prefix}><AdminInput value={form.invoice_prefix} onChange={(event) => update("invoice_prefix", event.target.value.toUpperCase())} /></AdminField>
              <AdminField label="Currency code" error={errors.currency_code}><AdminInput maxLength={3} value={form.currency_code} onChange={(event) => update("currency_code", event.target.value.toUpperCase())} /></AdminField>
              <AdminField label="Tax behavior"><AdminSelect options={[{value:"false",label:"Tax disabled"},{value:"true",label:"Tax enabled"}]} value={String(form.tax_enabled)} onChange={(event) => update("tax_enabled", event.target.value === "true")} /></AdminField>
              <AdminField label="Tax label"><AdminInput value={form.tax_label} onChange={(event) => update("tax_label", event.target.value)} /></AdminField>
              <AdminField label="Tax rate (%)" error={errors.tax_rate_basis_points}><AdminInput type="number" min={0} max={100} step="0.01" value={form.tax_rate_basis_points / 100} onChange={(event) => update("tax_rate_basis_points", Math.round(Number(event.target.value) * 100))} /></AdminField>
              <AdminField label="PAN / VAT number"><AdminInput value={form.pan_vat_number ?? ""} onChange={(event) => update("pan_vat_number", event.target.value)} /></AdminField>
              <AdminField label="Bill Number" error={errors.invoice_start_number} hint="Next bill number to use. Set 1120 to make the next bill 1120. Cannot be set lower than already issued bills."><AdminInput type="number" min={1} max={Number.MAX_SAFE_INTEGER - 1} step={1} value={form.invoice_start_number} onChange={(event) => update("invoice_start_number", Number(event.target.value))} /></AdminField>
              <AdminField label="Receipt footer"><AdminTextarea value={form.receipt_footer} onChange={(event) => update("receipt_footer", event.target.value)} /></AdminField>
              <AdminField label="Negative inventory"><AdminSelect options={[{value:"false",label:"Prevent negative stock"},{value:"true",label:"Allow negative stock"}]} value={String(form.allow_negative_stock)} onChange={(event) => update("allow_negative_stock", event.target.value === "true")} /></AdminField>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Attendance behavior" description="Controls off-day and absence logic in dashboard and attendance views." />
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <AdminField label="Weekly closing day" error={errors.weekly_closing_day}>
                <AdminSelect<number>
                  options={dayOptions}
                  value={form.weekly_closing_day}
                  onChange={(event) => update("weekly_closing_day", Number(event.target.value))}
                />
              </AdminField>
              <AdminField label="Absent after days" error={errors.absent_after_days} hint="Dashboard flags active members below this period.">
                <AdminInput
                  type="number"
                  min={1}
                  max={60}
                  value={form.absent_after_days}
                  onChange={(event) => update("absent_after_days", Number(event.target.value))}
                />
              </AdminField>
              <AdminField label="Holiday attendance lock">
                <AdminSelect
                  options={[
                    { value: "true", label: "Disable attendance on holidays" },
                    { value: "false", label: "Allow attendance on holidays" },
                  ]}
                  value={String(form.attendance_holiday_lock)}
                  onChange={(event) => update("attendance_holiday_lock", event.target.value === "true")}
                />
              </AdminField>
            </div>
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard>
            <AdminSectionTitle title="Notification status" description="Read-only frontend configuration status." />
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-amber-300" />
                  n8n member webhook URL
                </div>
                <AdminBadge tone={n8nWebhookConfigured ? "success" : "muted"}>
                  {n8nWebhookConfigured ? "Configured" : "Not configured"}
                </AdminBadge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <LockKeyhole className="h-4 w-4 text-amber-300" />
                  Webhook secret
                </div>
                <AdminBadge tone={n8nSecretConfigured ? "success" : "muted"}>
                  {n8nSecretConfigured ? "Masked" : "Not configured"}
                </AdminBadge>
              </div>
            </div>
            <AdminNotice tone="warning" title="Secret handling">
              Browser-visible `VITE_` values are not server secrets. Keep Supabase service-role keys and true signing secrets out of frontend code.
            </AdminNotice>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Admin account and security" />
            <div className="mt-5 space-y-3 text-sm text-slate-400">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                Admin access is still enforced by Supabase Auth plus the `profiles.role = admin` check.
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                RLS policies must stay enabled for member, attendance, holiday and settings tables.
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title="Import and backup" />
            <div className="mt-5 space-y-3 text-sm text-slate-400">
              <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <UploadCloud className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                CSV member import remains available from the Members page and uses the existing template.
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                Database backups should be handled from Supabase. This app does not expose private backup credentials.
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
      <BackupRestorePanel />
    </div>
  );
}
