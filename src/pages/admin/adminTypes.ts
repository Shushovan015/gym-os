export type MembershipType = "monthly" | "quarterly" | "yearly" | "trial";
export type MembershipStatus = "active" | "paused" | "cancelled" | "expired";
export type PaymentStatus = "paid" | "unpaid" | "overdue";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type DateDisplayPreference = "bs" | "ad" | "both";

export type MemberRow = {
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
  deleted_at: string | null;
};

export type MemberForm = Omit<MemberRow, "id" | "created_at" | "updated_at" | "deleted_at">;

export type MeasurementRow = {
  id: number;
  member_ref: number;
  recorded_at: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
};

export type TransformationRow = {
  id: number;
  member_ref: number;
  captured_at: string;
  milestone_title: string | null;
  milestone_notes: string | null;
  photo_url: string | null;
  created_at: string;
};

export type MemberReportLogRow = {
  id: number;
  member_ref: number;
  recipient_email: string | null;
  status: "sent" | "failed";
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
  created_at: string;
};

export type GeneratedReportMilestone = {
  captured_at: string;
  milestone_title: string;
  milestone_notes: string | null;
  photo_url: string | null;
};

export type GeneratedProgressReport = {
  gym_name: string;
  member_id: string;
  member_name: string;
  generated_at: string;
  summary_lines: string[];
  recent_milestones: GeneratedReportMilestone[];
};

export type SendProgressReportResponse = {
  ok: boolean;
  error?: string;
  report?: GeneratedProgressReport;
};

export type AttendanceRow = {
  id: number;
  member_ref: number;
  attendance_date: string;
  status: AttendanceStatus;
  deleted_at: string | null;
};

export type HolidayRow = {
  id: number;
  holiday_date: string;
  name: string | null;
};

export type HolidayTemplateRow = {
  id: number;
  name: string;
  bs_month: number;
  bs_day: number;
  is_active: boolean;
};

export type AdminSettings = {
  id: number;
  gym_name: string;
  logo_url: string | null;
  phone: string;
  email: string;
  address: string;
  operating_hours: string;
  weekly_closing_day: number;
  expiry_warning_days: number;
  absent_after_days: number;
  default_membership_type: MembershipType;
  date_display_preference: DateDisplayPreference;
  attendance_holiday_lock: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SelectOption<T extends string | number = string> = {
  label: string;
  value: T;
};

export const membershipTypes: MembershipType[] = ["monthly", "quarterly", "yearly", "trial"];
export const membershipStatuses: MembershipStatus[] = ["active", "paused", "cancelled", "expired"];
export const paymentStatuses: PaymentStatus[] = ["paid", "unpaid", "overdue"];
export const attendanceStatuses: AttendanceStatus[] = ["present", "late", "absent", "excused"];
