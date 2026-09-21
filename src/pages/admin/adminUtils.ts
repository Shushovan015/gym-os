import NepaliDate from "nepali-date-converter";
import type {
  AdminSettings,
  DateDisplayPreference,
  MemberForm,
  MemberRow,
  MembershipStatus,
  MembershipType,
  PaymentStatus,
} from "./adminTypes";
import { membershipStatuses, membershipTypes, paymentStatuses } from "./adminTypes";

export const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Ashoj",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const defaultAdminSettings: AdminSettings = {
  id: 1,
  gym_name: "A&A Health Club",
  logo_url: null,
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  address: "Butwal, Rupandehi, Nepal",
  operating_hours: "Daily, 5:00 AM - 9:00 PM",
  weekly_closing_day: 6,
  expiry_warning_days: 7,
  absent_after_days: 8,
  default_membership_type: "monthly",
  date_display_preference: "bs",
  attendance_holiday_lock: true,
  invoice_prefix: "GYM",
  invoice_start_number: 1,
  bill_sender_email: null,
  currency_code: "NPR",
  currency_minor_unit: 2,
  tax_enabled: false,
  tax_label: "Tax",
  tax_rate_basis_points: 0,
  pan_vat_number: null,
  receipt_footer: "Thank you for choosing us.",
  allow_negative_stock: false,
};

export const emptyMemberForm: MemberForm = {
  member_id: "",
  full_name: "",
  email: "",
  phone: "",
  address: "",
  photo_url: "",
  membership_type: "monthly",
  membership_status: "active",
  start_date: "",
  end_date: "",
  last_visit_date: "",
  payment_status: "unpaid",
  payment_due_date: "",
  notes: "",
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function friendlyAdminError(message: string, context?: string) {
  const text = message.toLowerCase();
  if (text.includes("insufficient stock")) return context ? `There is not enough ${context} available. Reduce the quantity or add more stock.` : "There is not enough stock available. Reduce the quantity or add more stock.";
  if (text.includes("duplicate") || text.includes("unique constraint")) return "This information is already in use. Check the product code, barcode, member ID or bill number.";
  if (text.includes("payment exceeds") || text.includes("outside invoice balance")) return "The payment cannot be more than the remaining bill balance.";
  if (text.includes("variant is unavailable")) return "This product option is no longer available. Choose another product.";
  if (text.includes("row-level security") || text.includes("admin access required")) return "Your admin session does not have permission for this action. Sign in again and retry.";
  return message;
}

export function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatAdDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getNepalTodayAdDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function parseAdDate(adDate: string | null | undefined) {
  if (!adDate) return null;
  const date = new Date(`${adDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(adDate: string, days: number) {
  const date = parseAdDate(adDate);
  if (!date) return adDate;
  date.setDate(date.getDate() + days);
  return formatAdDate(date);
}

export function diffInDays(fromAdDate: string, toAdDate: string) {
  const from = parseAdDate(fromAdDate);
  const to = parseAdDate(toAdDate);
  if (!from || !to) return null;
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function isValidAdDate(value: string | null | undefined) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parseAdDate(value) !== null;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatBsDateFromAd(value.slice(0, 10))} BS · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatBsDateFromAd(adDate: string | null | undefined) {
  if (!adDate) return "-";
  try {
    const date = parseAdDate(adDate);
    if (!date) return adDate;
    return new NepaliDate(date).format("YYYY-MM-DD");
  } catch {
    return adDate;
  }
}

export function adToBsString(adDate: string | null | undefined) {
  const bs = formatBsDateFromAd(adDate);
  return bs === "-" ? "" : bs;
}

export function bsStringToAdDate(bsDate: string) {
  const value = bsDate.trim();
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    const bs = new NepaliDate(value);
    if (bs.format("YYYY-MM-DD") !== value) return null;
    return formatAdDate(bs.toJsDate());
  } catch {
    return null;
  }
}

export function formatDisplayDate(adDate: string | null | undefined, _preference: DateDisplayPreference) {
  if (!adDate) return "-";
  const bs = formatBsDateFromAd(adDate);
  return `${bs} BS`;
}

export function normalizeNullable(value: string | null | undefined) {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : null;
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+\s-]/g, "").replace(/\s+/g, " ").trim();
}

export function isValidEmail(value: string | null | undefined) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getMemberLifecycle(member: Pick<MemberRow, "membership_status" | "end_date" | "deleted_at">, todayAd = getNepalTodayAdDate()) {
  if (member.deleted_at) return "deleted";
  if (member.membership_status === "paused") return "paused";
  if (member.membership_status === "cancelled") return "cancelled";
  const daysLeft = member.end_date ? diffInDays(todayAd, member.end_date) : null;
  if (daysLeft !== null && daysLeft < 0) return "expired";
  if (member.membership_status === "expired") return "expired";
  if (daysLeft !== null && daysLeft <= 7) return "expiring";
  return "active";
}

export function validateMemberForm(form: MemberForm, existing: MemberRow[], editingId: number | null) {
  const errors: Partial<Record<keyof MemberForm, string>> = {};
  const memberId = form.member_id.trim();

  if (!memberId) errors.member_id = "Member ID is required.";
  if (!form.full_name.trim() || form.full_name.trim().length < 2) {
    errors.full_name = "Full name must be at least 2 characters.";
  }
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (!isValidEmail(form.email)) errors.email = "Enter a valid email address.";
  if (!form.membership_type.trim()) errors.membership_type = "Select a plan.";
  if (!membershipStatuses.includes(form.membership_status)) errors.membership_status = "Select a valid status.";
  if (!paymentStatuses.includes(form.payment_status)) errors.payment_status = "Select a valid payment status.";

  if (!isValidAdDate(form.start_date)) errors.start_date = "Choose a valid Nepali date.";
  if (!isValidAdDate(form.end_date)) errors.end_date = "Choose a valid Nepali date.";
  if (!isValidAdDate(form.last_visit_date)) errors.last_visit_date = "Choose a valid Nepali date.";
  if (!isValidAdDate(form.payment_due_date)) errors.payment_due_date = "Choose a valid Nepali date.";

  const duplicate = existing.find((member) => member.member_id.trim() === memberId && member.id !== editingId);
  if (duplicate) errors.member_id = "Another member already uses this ID.";
  const normalizedPhone = normalizePhone(form.phone);
  const duplicatePhone = existing.find((member) => normalizePhone(member.phone) === normalizedPhone && member.id !== editingId);
  if (normalizedPhone && duplicatePhone) errors.phone = `This phone belongs to ${duplicatePhone.full_name}${duplicatePhone.deleted_at ? " in Deleted members" : ""}. Open that existing record instead.`;
  const normalizedEmail = form.email?.trim().toLowerCase() ?? "";
  const duplicateEmail = normalizedEmail && existing.find((member) => member.email?.trim().toLowerCase() === normalizedEmail && member.id !== editingId);
  if (duplicateEmail) errors.email = `This email belongs to ${duplicateEmail.full_name}${duplicateEmail.deleted_at ? " in Deleted members" : ""}. Open that existing record instead.`;

  return errors;
}

export function hasValidationErrors(errors: Partial<Record<keyof MemberForm, string>>) {
  return Object.values(errors).some(Boolean);
}

export function toMemberPayload(form: MemberForm) {
  return {
    member_id: form.member_id.trim(),
    full_name: form.full_name.trim(),
    email: normalizeNullable(form.email),
    phone: normalizePhone(form.phone),
    address: normalizeNullable(form.address),
    photo_url: normalizeNullable(form.photo_url),
    membership_type: form.membership_type,
    membership_status: form.membership_status,
    start_date: normalizeNullable(form.start_date),
    end_date: normalizeNullable(form.end_date),
    last_visit_date: normalizeNullable(form.last_visit_date),
    payment_status: form.payment_status,
    payment_due_date: normalizeNullable(form.payment_due_date),
    notes: normalizeNullable(form.notes),
  };
}

export function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildBsMonthDays(bsYear: number, bsMonthIndex: number, closingDay: number) {
  const result: Array<{
    bsDay: number;
    adDate: string;
    weekday: string;
    weekdayIndex: number;
    isClosingDay: boolean;
  }> = [];

  for (let day = 1; day <= 32; day += 1) {
    const bsDate = new NepaliDate(bsYear, bsMonthIndex, day);
    if (bsDate.getYear() !== bsYear || bsDate.getMonth() !== bsMonthIndex) break;
    const weekdayIndex = bsDate.getDay();
    result.push({
      bsDay: day,
      adDate: formatAdDate(bsDate.toJsDate()),
      weekday: WEEKDAYS[weekdayIndex] ?? "Day",
      weekdayIndex,
      isClosingDay: weekdayIndex === closingDay,
    });
  }

  return result;
}

export function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMembershipStatus(value: string): value is MembershipStatus {
  return membershipStatuses.includes(value as MembershipStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus);
}

export function isMembershipType(value: string): value is MembershipType {
  return membershipTypes.includes(value as MembershipType);
}
