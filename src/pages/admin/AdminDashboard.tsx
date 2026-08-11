import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Clock3,
  CreditCard,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@src/Client/supabase";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminLoading,
  AdminMetricCard,
  AdminNotice,
  AdminPageHeader,
  AdminSectionTitle,
  AdminSelect,
} from "@src/components/admin/AdminUI";
import type { AdminSettings, AttendanceRow, HolidayRow, MemberRow } from "./adminTypes";
import {
  addDays,
  cx,
  defaultAdminSettings,
  diffInDays,
  formatDisplayDate,
  getMemberLifecycle,
  getNepalTodayAdDate,
  statusLabel,
  WEEKDAYS,
} from "./adminUtils";

type PeriodDays = 7 | 30 | 90;
type DashboardState = {
  members: MemberRow[];
  attendance: AttendanceRow[];
  holidays: HolidayRow[];
  settings: AdminSettings;
};

const periodOptions: Array<{ value: PeriodDays; label: string }> = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const horizonOptions: Array<{ value: 7 | 15 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
];

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function MiniBarChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const max = Math.max(...values, 1);

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-3" aria-label="Attendance trend">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end">
              <div
                className="w-full rounded-t bg-amber-300/80"
                style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
                title={`${labels[index]}: ${value}`}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-slate-500">{labels[index].slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-sm bg-amber-300" />
        Present or late records, deleted records excluded
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const [expiryHorizon, setExpiryHorizon] = useState<7 | 15 | 30>(7);
  const [state, setState] = useState<DashboardState>({
    members: [],
    attendance: [],
    holidays: [],
    settings: defaultAdminSettings,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const todayAd = useMemo(() => getNepalTodayAdDate(), []);
  const periodStartAd = useMemo(() => addDays(todayAd, -(periodDays - 1)), [periodDays, todayAd]);

  useEffect(() => {
    let alive = true;

    Promise.all([
      supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("members")
        .select(
          "id, member_id, full_name, email, phone, membership_type, membership_status, start_date, end_date, last_visit_date, payment_status, payment_due_date, notes, created_at, updated_at, deleted_at"
        )
        .order("updated_at", { ascending: false })
        .limit(5000),
      supabase
        .from("attendance_records")
        .select("id, member_ref, attendance_date, status, deleted_at")
        .gte("attendance_date", periodStartAd)
        .lte("attendance_date", todayAd)
        .limit(30000),
      supabase
        .from("attendance_holidays")
        .select("id, holiday_date, name")
        .gte("holiday_date", todayAd)
        .lte("holiday_date", addDays(todayAd, 30))
        .order("holiday_date", { ascending: true }),
    ]).then(([settingsRes, membersRes, attendanceRes, holidaysRes]) => {
      if (!alive) return;

      if (membersRes.error) {
        setError(membersRes.error.message);
        setLoading(false);
        return;
      }
      if (attendanceRes.error) {
        setError(attendanceRes.error.message);
        setLoading(false);
        return;
      }
      if (holidaysRes.error) {
        setError(holidaysRes.error.message);
        setLoading(false);
        return;
      }

      const settings = settingsRes.error
        ? defaultAdminSettings
        : { ...defaultAdminSettings, ...((settingsRes.data as AdminSettings | null) ?? {}) };

      setState({
        settings,
        members: (membersRes.data ?? []) as MemberRow[],
        attendance: (attendanceRes.data ?? []) as AttendanceRow[],
        holidays: (holidaysRes.data ?? []) as HolidayRow[],
      });
      setExpiryHorizon(settings.expiry_warning_days as 7 | 15 | 30);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [periodStartAd, todayAd]);

  const changePeriod = (next: PeriodDays) => {
    setLoading(true);
    setError("");
    setPeriodDays(next);
  };

  const dashboard = useMemo(() => {
    const liveMembers = state.members.filter((member) => !member.deleted_at);
    const activeMembers = liveMembers.filter((member) => getMemberLifecycle(member, todayAd) === "active");
    const newMembers = liveMembers.filter((member) => member.created_at.slice(0, 10) >= periodStartAd);
    const expiringMembers = liveMembers
      .map((member) => ({ member, daysLeft: member.end_date ? diffInDays(todayAd, member.end_date) : null }))
      .filter(({ member, daysLeft }) => member.membership_status !== "cancelled" && daysLeft !== null && daysLeft >= 0 && daysLeft <= expiryHorizon)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    const expiredMembers = liveMembers.filter((member) => getMemberLifecycle(member, todayAd) === "expired");
    const unpaidMembers = liveMembers.filter((member) => member.payment_status === "unpaid" || member.payment_status === "overdue");
    const usableAttendance = state.attendance.filter((record) => !record.deleted_at && (record.status === "present" || record.status === "late"));
    const attendanceToday = usableAttendance.filter((record) => record.attendance_date === todayAd);
    const attendanceByDate = new Map<string, number>();

    for (let offset = 0; offset < periodDays; offset += 1) {
      attendanceByDate.set(addDays(periodStartAd, offset), 0);
    }
    usableAttendance.forEach((record) => {
      attendanceByDate.set(record.attendance_date, (attendanceByDate.get(record.attendance_date) ?? 0) + 1);
    });

    const recentAttendanceByMember = new Map<number, string>();
    usableAttendance.forEach((record) => {
      const existing = recentAttendanceByMember.get(record.member_ref);
      if (!existing || record.attendance_date > existing) {
        recentAttendanceByMember.set(record.member_ref, record.attendance_date);
      }
    });

    const absentCutoff = addDays(todayAd, -state.settings.absent_after_days);
    const absentMembers = activeMembers
      .map((member) => ({ member, lastAttendance: recentAttendanceByMember.get(member.id) ?? member.last_visit_date }))
      .filter(({ lastAttendance }) => !lastAttendance || lastAttendance < absentCutoff)
      .sort((a, b) => String(a.lastAttendance ?? "").localeCompare(String(b.lastAttendance ?? "")));

    const planDistribution = countBy(liveMembers.map((member) => member.membership_type));
    const todayHoliday = state.holidays.find((holiday) => holiday.holiday_date === todayAd);

    return {
      liveMembers,
      activeMembers,
      newMembers,
      expiringMembers,
      expiredMembers,
      unpaidMembers,
      attendanceToday,
      attendanceLabels: Array.from(attendanceByDate.keys()),
      attendanceValues: Array.from(attendanceByDate.values()),
      absentMembers,
      planDistribution,
      todayHoliday,
      upcomingHolidays: state.holidays.slice(0, 5),
    };
  }, [expiryHorizon, periodDays, periodStartAd, state.attendance, state.holidays, state.members, state.settings.absent_after_days, todayAd]);

  if (loading) {
    return <AdminLoading label="Loading dashboard metrics..." />;
  }

  if (error) {
    return (
      <AdminNotice tone="danger" title="Dashboard failed to load">
        {error}
      </AdminNotice>
    );
  }

  const today = new Date(`${todayAd}T00:00:00`);
  const todayWeekday = WEEKDAYS[today.getDay()] ?? "Today";
  const isClosingDay = today.getDay() === state.settings.weekly_closing_day;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operations dashboard"
        title="Today at A&A Health Club"
        description={`Nepal date boundary: ${formatDisplayDate(todayAd, state.settings.date_display_preference)}. Dashboard uses real member and attendance records only.`}
        actions={
          <>
            <AdminSelect<PeriodDays>
              options={periodOptions}
              value={periodDays}
              onChange={(event) => changePeriod(Number(event.target.value) as PeriodDays)}
              aria-label="Dashboard period"
              className="w-40"
            />
            <AdminSelect<7 | 15 | 30>
              options={horizonOptions}
              value={expiryHorizon}
              onChange={(event) => setExpiryHorizon(Number(event.target.value) as 7 | 15 | 30)}
              aria-label="Membership expiry horizon"
              className="w-36"
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AdminNotice tone={dashboard.todayHoliday || isClosingDay ? "warning" : "success"} title="Today status">
          {dashboard.todayHoliday
            ? `Holiday: ${dashboard.todayHoliday.name || "Holiday"}`
            : isClosingDay
              ? `${todayWeekday} is the configured weekly closing day.`
              : `${todayWeekday} is open for attendance entry.`}
        </AdminNotice>
        <AdminNotice tone="muted" title="Payment amount tracking">
          The current schema tracks payment status and due date, but not amounts. Collected/outstanding money totals are intentionally not shown.
        </AdminNotice>
        <AdminNotice tone="neutral" title="Data scope">
          Single-gym dashboard. No tenant or location filters have been added.
        </AdminNotice>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/members?membership=active">
          <AdminMetricCard
            label="Active members"
            value={dashboard.activeMembers.length}
            description="Status is active and membership is not logically expired."
            icon={Users}
            tone="success"
          />
        </Link>
        <Link to={`/admin/members?created_since=${periodStartAd}`}>
          <AdminMetricCard
            label="New members"
            value={dashboard.newMembers.length}
            description={`Created in the selected ${periodDays}-day period.`}
            icon={UserPlus}
            tone="accent"
          />
        </Link>
        <Link to={`/admin/members?expiring=${expiryHorizon}`}>
          <AdminMetricCard
            label="Expiring soon"
            value={dashboard.expiringMembers.length}
            description={`Memberships ending within ${expiryHorizon} days.`}
            icon={CalendarClock}
            tone="warning"
          />
        </Link>
        <Link to="/admin/members?membership=expired">
          <AdminMetricCard
            label="Expired"
            value={dashboard.expiredMembers.length}
            description="Expired by status or end date."
            icon={AlertTriangle}
            tone="danger"
          />
        </Link>
        <Link to="/admin/members?payment=unpaid">
          <AdminMetricCard
            label="Unpaid or overdue"
            value={dashboard.unpaidMembers.length}
            description="Payment status needs front-desk follow-up."
            icon={CreditCard}
            tone="danger"
          />
        </Link>
        <Link to="/admin/attendance">
          <AdminMetricCard
            label="Attendance today"
            value={dashboard.attendanceToday.length}
            description="Present or late records saved for today."
            icon={UserCheck}
            tone="success"
          />
        </Link>
        <Link to={`/admin/members?absent=${state.settings.absent_after_days}`}>
          <AdminMetricCard
            label="Absent follow-up"
            value={dashboard.absentMembers.length}
            description={`Active members without attendance in ${state.settings.absent_after_days}+ days.`}
            icon={Clock3}
            tone="warning"
          />
        </Link>
        <AdminMetricCard
          label="Deleted records"
          value={state.members.length - dashboard.liveMembers.length}
          description="Soft-deleted members can still be restored."
          icon={CalendarDays}
          tone="muted"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminCard>
          <AdminSectionTitle title="Attendance trend" description={`Present and late records from ${periodStartAd} to ${todayAd}.`} />
          <div className="mt-4">
            {dashboard.attendanceValues.some((value) => value > 0) ? (
              <MiniBarChart values={dashboard.attendanceValues} labels={dashboard.attendanceLabels} />
            ) : (
              <AdminEmptyState title="No attendance in this period" description="Attendance records will appear here once front desk marks members present." />
            )}
          </div>
        </AdminCard>

        <AdminCard>
          <AdminSectionTitle title="Membership plans" description="Current non-deleted members by plan." />
          <div className="mt-4 space-y-3">
            {Object.entries(dashboard.planDistribution).length === 0 ? (
              <AdminEmptyState title="No members yet" />
            ) : (
              Object.entries(dashboard.planDistribution).map(([plan, count]) => {
                const percent = dashboard.liveMembers.length ? Math.round((count / dashboard.liveMembers.length) * 100) : 0;
                return (
                  <div key={plan}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-200">{statusLabel(plan)}</span>
                      <span className="text-slate-400">{count} members</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-amber-300" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AdminCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AdminCard>
          <AdminSectionTitle
            title="Membership expiry"
            description={`Next ${expiryHorizon} days.`}
            action={
              <Link to={`/admin/members?expiring=${expiryHorizon}`}>
                <AdminButton type="button" variant="secondary">Open members</AdminButton>
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {dashboard.expiringMembers.length === 0 ? (
              <AdminEmptyState title="No expiring memberships" />
            ) : (
              dashboard.expiringMembers.slice(0, 8).map(({ member, daysLeft }) => (
                <div key={member.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{member.full_name}</div>
                      <div className="text-xs text-slate-500">{member.member_id}</div>
                    </div>
                    <AdminBadge tone={daysLeft === 0 ? "danger" : "warning"}>{daysLeft} day{daysLeft === 1 ? "" : "s"}</AdminBadge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{formatDisplayDate(member.end_date, state.settings.date_display_preference)}</div>
                </div>
              ))
            )}
          </div>
        </AdminCard>

        <AdminCard>
          <AdminSectionTitle title="Dues follow-up" description="Payment status only. Amounts are not stored." />
          <div className="mt-4 space-y-2">
            {dashboard.unpaidMembers.length === 0 ? (
              <AdminEmptyState title="No unpaid dues" />
            ) : (
              dashboard.unpaidMembers.slice(0, 8).map((member) => (
                <div key={member.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{member.full_name}</div>
                      <div className="text-xs text-slate-500">{member.phone}</div>
                    </div>
                    <AdminBadge tone={member.payment_status === "overdue" ? "danger" : "warning"}>
                      {statusLabel(member.payment_status)}
                    </AdminBadge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">Due: {formatDisplayDate(member.payment_due_date, state.settings.date_display_preference)}</div>
                </div>
              ))
            )}
          </div>
        </AdminCard>

        <AdminCard>
          <AdminSectionTitle title="Recent operational activity" />
          <div className="mt-4 space-y-2">
            {state.members.slice(0, 6).map((member) => (
              <div key={member.id} className={cx("rounded-lg border border-slate-800 bg-slate-900/55 p-3", member.deleted_at && "opacity-70")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{member.full_name}</div>
                    <div className="text-xs text-slate-500">Updated {formatDisplayDate(member.updated_at.slice(0, 10), state.settings.date_display_preference)}</div>
                  </div>
                  <AdminBadge tone={member.deleted_at ? "muted" : "neutral"}>{member.deleted_at ? "Deleted" : statusLabel(member.membership_status)}</AdminBadge>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <AdminSectionTitle title="Upcoming holidays" description="Next saved holiday records. Recurring templates are managed in Holidays." />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {dashboard.upcomingHolidays.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-5">
              <AdminEmptyState title="No upcoming holidays saved" description="Add holidays or apply recurring BS templates from the Holidays page." />
            </div>
          ) : (
            dashboard.upcomingHolidays.map((holiday) => (
              <div key={holiday.id} className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
                <div className="text-sm font-semibold text-white">{holiday.name || "Holiday"}</div>
                <div className="mt-1 text-xs text-slate-400">{formatDisplayDate(holiday.holiday_date, state.settings.date_display_preference)}</div>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </div>
  );
}
