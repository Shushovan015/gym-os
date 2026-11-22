import { namePrefixPattern, normalizeNameSearch } from "@src/utils/nameSearch";
import { useLatestRequest } from "@src/hooks/useLatestRequest";
import { useDebouncedValue } from "@src/hooks/useDebouncedValue";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NepaliDate from "nepali-date-converter";
import { CalendarDays, Check, Info, RotateCcw, Search, UserRound, X } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { phpGet, phpPost, usePhpApi } from "@src/Client/phpApi";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDrawer,
  AdminEmptyState,
  AdminInput,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminSectionTitle,
  AdminSelect,
  AdminTableScroll,
  AdminTableShell,
} from "@src/components/admin/AdminUI";
import type { AdminSettings, AttendanceRow, HolidayRow, MemberRow, MemberMembershipFeeStatus } from "./adminTypes";
import {
  BS_MONTHS,
  buildBsMonthDays,
  cx,
  defaultAdminSettings,
  formatDisplayDate,
  formatBillingPeriodFromDueDate,
  formatMembershipFeeAmount,
  getNepalTodayAdDate,
  isPayableFee,
  isZeroAmountFee,
  membershipFeeStatusTone,
  statusLabel,
} from "./adminUtils";

type ViewMode = "month" | "week" | "day";
type DayCell = ReturnType<typeof buildBsMonthDays>[number];

function cellKey(memberId: number, adDate: string) {
  return `${memberId}:${adDate}`;
}

function todayBsDate(todayAd: string) {
  return new NepaliDate(new Date(`${todayAd}T00:00:00`));
}

function formatNepaliNumber(value: number) {
  return value.toLocaleString("ne-NP-u-nu-deva");
}

export default function AdminAttendance() {
  const todayAd = useMemo(() => getNepalTodayAdDate(), []);
  const initialBs = useMemo(() => todayBsDate(todayAd), [todayAd]);

  const [settings, setSettings] = useState<AdminSettings>(defaultAdminSettings);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<AttendanceRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [selectedBsYear, setSelectedBsYear] = useState(initialBs.getYear());
  const [selectedBsMonth, setSelectedBsMonth] = useState(initialBs.getMonth());
  const [focusDay, setFocusDay] = useState(initialBs.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeCell, setActiveCell] = useState("");
  const [activeHolidayDate, setActiveHolidayDate] = useState("");
  const [profileMember, setProfileMember] = useState<MemberRow | null>(null);
  const [memberFeeStatus, setMemberFeeStatus] = useState<MemberMembershipFeeStatus | null>(null);
  const [page, setPage] = useState(1);
  const [memberCount, setMemberCount] = useState(0);
  const [enabled, setEnabled] = useState("active");
  const [refresh, setRefresh] = useState(0);
  const pageSize = 10;

  const bsDays = useMemo(
    () => buildBsMonthDays(selectedBsYear, selectedBsMonth, settings.weekly_closing_day),
    [selectedBsMonth, selectedBsYear, settings.weekly_closing_day]
  );

  const todayDay = bsDays.find((day) => day.adDate === todayAd);
  const selectedMonthStart = bsDays[0]?.adDate ?? todayAd;
  const selectedMonthEnd = bsDays[bsDays.length - 1]?.adDate ?? todayAd;

  const yearOptions = useMemo(() => {
    const start = initialBs.getYear() - 6;
    const end = initialBs.getYear() + 3;
    const years: Array<{ value: number; label: string }> = [];
    for (let year = start; year <= end; year += 1) years.push({ value: year, label: formatNepaliNumber(year) });
    return years;
  }, [initialBs]);

  const monthOptions = BS_MONTHS.map((label, value) => ({ value, label }));

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    records.forEach((record) => map.set(cellKey(record.member_ref, record.attendance_date), record));
    return map;
  }, [records]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayRow>();
    holidays.forEach((holiday) => map.set(holiday.holiday_date, holiday));
    return map;
  }, [holidays]);

  const visibleDays = useMemo(() => {
    if (viewMode === "month") return bsDays;
    if (viewMode === "day") return bsDays.filter((day) => day.bsDay === focusDay);
    const start = Math.floor((focusDay - 1) / 7) * 7 + 1;
    return bsDays.filter((day) => day.bsDay >= start && day.bsDay <= start + 6);
  }, [bsDays, focusDay, viewMode]);

  const filteredMembers = members;
  const pageCount = Math.max(1, Math.ceil(memberCount / pageSize));

  const selectedDayInfo = visibleDays[0] ?? todayDay ?? bsDays[0];
  const selectedHoliday = selectedDayInfo ? holidayByDate.get(selectedDayInfo.adDate) : undefined;
  const selectedDayUnavailable = Boolean(selectedDayInfo?.isClosingDay || (settings.attendance_holiday_lock && selectedHoliday));
  const todayHoliday = holidayByDate.get(todayAd);

  const loadAttendanceData = async (bsYear: number, bsMonth: number, memberIds: number[], nextSettings = settings, isCurrent = () => true) => {
    const days = buildBsMonthDays(bsYear, bsMonth, nextSettings.weekly_closing_day);
    const start = days[0]?.adDate ?? todayAd;
    const end = days[days.length - 1]?.adDate ?? todayAd;

    const recordsQuery = supabase
      .from("attendance_records")
      .select("id, member_ref, attendance_date, status, deleted_at")
      .gte("attendance_date", start).lte("attendance_date", end).is("deleted_at", null)
      .order("attendance_date", { ascending: false }).order("id", { ascending: false });
    const deletedQuery = supabase
      .from("attendance_records")
      .select("id, member_ref, attendance_date, status, deleted_at")
      .gte("attendance_date", start)
      .lte("attendance_date", end)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(10);

    const [recordsRes, deletedRes, holidaysRes] = await Promise.all([
      memberIds.length ? recordsQuery.in("member_ref", memberIds) : Promise.resolve({ data: [], error: null }),
      memberIds.length ? deletedQuery.in("member_ref", memberIds) : Promise.resolve({ data: [], error: null }),
      supabase
        .from("attendance_holidays")
        .select("id, holiday_date, name")
        .gte("holiday_date", start)
        .lte("holiday_date", end)
        .order("holiday_date", { ascending: true }),
    ]);

    if (!isCurrent()) return;
    if (recordsRes.error || deletedRes.error || holidaysRes.error) {
      setMessage(recordsRes.error?.message || deletedRes.error?.message || holidaysRes.error?.message || "Attendance load failed.");
      return;
    }

    setRecords((recordsRes.data ?? []) as AttendanceRow[]);
    setDeletedRecords((deletedRes.data ?? []) as AttendanceRow[]);
    setHolidays((holidaysRes.data ?? []) as HolidayRow[]);
  };

  useEffect(() => {
    let alive = true;
    if (usePhpApi) {
      phpGet<{ settings: AdminSettings }>("/admin/settings").then(({ settings }) => {
        if (alive) setSettings({ ...defaultAdminSettings, ...settings });
      }).catch((error: Error) => { if (alive) setMessage(error.message); });
      return () => { alive = false; };
    }
    supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) setMessage(error.message);
      setSettings(data ? { ...defaultAdminSettings, ...(data as AdminSettings) } : defaultAdminSettings);
    });

    return () => {
      alive = false;
    };
  }, []);

  const beginSearch = useLatestRequest(JSON.stringify([searchTerm, page, selectedBsMonth, selectedBsYear, settings.weekly_closing_day, enabled, refresh]));
  useEffect(() => {
    if (searchTerm !== debouncedSearch) return;
    const isCurrent = beginSearch();
    setResultsLoading(true);
    if (usePhpApi) {
      const query = new URLSearchParams({
        start: selectedMonthStart, end: selectedMonthEnd, search: debouncedSearch,
        enabled, limit: String(pageSize), offset: String((page - 1) * pageSize),
      });
      phpGet<{
        members: MemberRow[]; count: number; records: AttendanceRow[]; deletedRecords: AttendanceRow[]; holidays: HolidayRow[];
      }>(`/attendance/grid?${query}`).then((result) => {
        if (!isCurrent()) return;
        setMembers(result.members);
        setMemberCount(result.count);
        setRecords(result.records);
        setDeletedRecords(result.deletedRecords);
        setHolidays(result.holidays);
      }).catch((error: Error) => {
        if (!isCurrent()) return;
        setMembers([]);
        setMemberCount(0);
        setRecords([]);
        setDeletedRecords([]);
        setHolidays([]);
        setMessage(error.message);
      }).finally(() => {
        if (isCurrent()) { setLoading(false); setResultsLoading(false); }
      });
      return;
    }
    let query = supabase.from("members").select("*", { count: "exact" }).is("deleted_at", null);
    const term = normalizeNameSearch(debouncedSearch);
    if (term) query = query.filter("full_name", "imatch", namePrefixPattern(term));
    query.eq("is_active", true).order("full_name", { ascending: true }).order("id").range((page - 1) * pageSize, page * pageSize - 1).then(async ({ data, count, error }) => {
      if (!isCurrent()) return;
      if (error) setMessage(error.message);
      const nextMembers = (data ?? []) as MemberRow[];
      setMembers(nextMembers);
      setMemberCount(count ?? 0);
      await loadAttendanceData(selectedBsYear, selectedBsMonth, nextMembers.map((member) => member.id), settings, isCurrent);
      if (isCurrent()) { setLoading(false); setResultsLoading(false); }
    });
    // settings changes only after its initial database load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, debouncedSearch, selectedBsMonth, selectedBsYear, settings.weekly_closing_day, enabled, refresh]);

  // Load membership fee status when profile member changes
  useEffect(() => {
    if (!profileMember) {
      setMemberFeeStatus(null);
      return;
    }
    let alive = true;
    if (usePhpApi) {
      setMemberFeeStatus(null);
      phpGet<MemberMembershipFeeStatus>(`/members/fees?id=${profileMember.id}`).then((result) => {
        if (alive) setMemberFeeStatus(result);
      }).catch((error: Error) => { if (alive) setMessage(error.message); });
      return () => { alive = false; };
    }
    supabase.rpc("get_member_membership_fee_status", { p_member_id: profileMember.id }).then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        console.error("Failed to load membership fee status:", error.message);
      } else {
        setMemberFeeStatus(data as MemberMembershipFeeStatus);
      }
    });
    return () => { alive = false; };
  }, [profileMember]);

  const changeMonth = async (year: number, month: number) => {
    setMessage("");
    setSelectedBsYear(year);
    setSelectedBsMonth(month);
    setFocusDay((day) => Math.min(day, buildBsMonthDays(year, month, settings.weekly_closing_day).length || 1));
    setPage(1);
  };

  const setAttendance = async (member: MemberRow, day: DayCell, present: boolean) => {
    const holiday = holidayByDate.get(day.adDate);
    const unavailable = day.isClosingDay || (settings.attendance_holiday_lock && Boolean(holiday));
    if (unavailable) return;

    // Prevent attendance for inactive members
    if (!member.is_active) {
      setMessage("Cannot mark attendance for inactive member");
      return;
    }

    const key = cellKey(member.id, day.adDate);
    const existing = attendanceMap.get(key);
    setActiveCell(key);
    setMessage("");

    if (usePhpApi) {
      try {
        await phpPost("/attendance/change", { memberId: member.id, date: day.adDate, action: present ? "mark" : "remove" });
        setResultsLoading(true);
        setRefresh((value) => value + 1);
        setMessage(present ? `${member.full_name} marked present.` : `${member.full_name}'s attendance was removed. You can restore it below.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Attendance update failed.");
      } finally {
        setActiveCell("");
      }
      return;
    }

    if (present) {
      const { error } = await supabase.from("attendance_records").upsert(
        {
          member_ref: member.id,
          attendance_date: day.adDate,
          status: "present",
          deleted_at: null,
        },
        { onConflict: "member_ref,attendance_date" }
      );
      if (error) {
        setMessage(error.message);
        setActiveCell("");
        return;
      }
    } else if (existing) {
      const { error } = await supabase.from("attendance_records").update({ deleted_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) {
        setMessage(error.message);
        setActiveCell("");
        return;
      }
    }

    await loadAttendanceData(selectedBsYear, selectedBsMonth, members.map((item) => item.id));
    setMessage(present ? `${member.full_name} marked present.` : `${member.full_name}'s attendance was removed. You can restore it below.`);
    setActiveCell("");
  };

  const restoreAttendance = async (record: AttendanceRow) => {
    if (usePhpApi) {
      setActiveCell(cellKey(record.member_ref, record.attendance_date));
      try {
        await phpPost("/attendance/change", { memberId: record.member_ref, date: record.attendance_date, action: "restore" });
        setResultsLoading(true);
        setRefresh((value) => value + 1);
        setMessage("Attendance restored.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Restore failed.");
      } finally {
        setActiveCell("");
      }
      return;
    }
    const { error } = await supabase.from("attendance_records").update({ deleted_at: null }).eq("id", record.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Attendance restored.");
    await loadAttendanceData(selectedBsYear, selectedBsMonth, members.map((item) => item.id));
  };

  const writePhpHoliday = async (date: string, action: "save" | "remove", name?: string) => {
    try {
      await phpPost("/attendance/holiday", { date, action, name });
      setResultsLoading(true);
      setRefresh((value) => value + 1);
      setMessage(action === "save" ? "Holiday saved." : "Holiday removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Holiday update failed.");
    } finally {
      setActiveHolidayDate("");
    }
  };

  const setHoliday = async (day: DayCell) => {
    if (day.isClosingDay) return;
    const existing = holidayByDate.get(day.adDate);
    const next = window.prompt("Holiday occasion:", existing?.name || "");
    if (next === null) return;
    const name = next.trim() || "Holiday";
    setActiveHolidayDate(day.adDate);
    if (usePhpApi) return writePhpHoliday(day.adDate, "save", name);
    const request = existing
      ? supabase.from("attendance_holidays").update({ name }).eq("id", existing.id)
      : supabase.from("attendance_holidays").insert({ holiday_date: day.adDate, name });
    const { error } = await request;
    if (error) setMessage(error.message);
    else {
      setMessage("Holiday saved.");
      await loadAttendanceData(selectedBsYear, selectedBsMonth, members.map((item) => item.id));
    }
    setActiveHolidayDate("");
  };

  const clearHoliday = async (day: DayCell) => {
    const existing = holidayByDate.get(day.adDate);
    if (!existing) return;
    setActiveHolidayDate(day.adDate);
    if (usePhpApi) return writePhpHoliday(day.adDate, "remove");
    const { error } = await supabase.from("attendance_holidays").delete().eq("id", existing.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Holiday removed.");
      await loadAttendanceData(selectedBsYear, selectedBsMonth, members.map((item) => item.id));
    }
    setActiveHolidayDate("");
  };

  const presentCountForSelectedDays = visibleDays.reduce((sum, day) => {
    return (
      sum +
      filteredMembers.filter((member) => {
        const record = attendanceMap.get(cellKey(member.id, day.adDate));
        return record && (record.status === "present" || record.status === "late");
      }).length
    );
  }, 0);

  if (loading) return <AdminLoading label="Loading attendance..." />;

  const payableFees = (memberFeeStatus?.outstanding_fees ?? []).filter(isPayableFee);
  const overdueFeeCount = payableFees.filter((fee) => fee.due_date < todayAd).length;
  const upcomingFeeCount = payableFees.length - overdueFeeCount;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Attendance"
        title="Front-desk attendance"
        description="Mark attendance deliberately. Present records save immediately; removed records are soft-deleted and restorable."
        actions={
          <Link to="/admin/holidays">
            <AdminButton type="button" variant="secondary">
              <CalendarDays className="h-4 w-4" />
              Holiday templates
            </AdminButton>
          </Link>
        }
      />

      {message ? <AdminNotice tone={message.toLowerCase().includes("failed") || message.toLowerCase().includes("error") ? "danger" : "success"}>{message}</AdminNotice> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AdminNotice tone={todayHoliday ? "warning" : todayDay?.isClosingDay ? "warning" : "success"} title="Today">
          {formatDisplayDate(todayAd)}
          {todayHoliday ? ` | Holiday: ${todayHoliday.name || "Holiday"}` : todayDay?.isClosingDay ? " | Weekly closing day" : " | Open day"}
        </AdminNotice>
        <AdminNotice tone="neutral" title="Save behavior">
          Attendance changes are saved immediately. There is no hidden draft state to discard.
        </AdminNotice>
        <AdminNotice tone="muted" title="Holiday behavior">
          {settings.attendance_holiday_lock ? "Attendance is locked on holidays." : "Attendance can still be marked on holidays."}
        </AdminNotice>
      </div>

      <AdminCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_0.6fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <AdminInput value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search members by name" className="pl-9" />
          </div>
          <AdminSelect<number> aria-label="Attendance year" options={yearOptions} value={selectedBsYear} onChange={(event) => changeMonth(Number(event.target.value), selectedBsMonth)} />
          <AdminSelect<number> aria-label="Attendance month" options={monthOptions} value={selectedBsMonth} onChange={(event) => changeMonth(selectedBsYear, Number(event.target.value))} />
          {usePhpApi && <AdminSelect
            aria-label="Member activation filter"
            options={[{ value: "active", label: "Active members" }, { value: "inactive", label: "Inactive members" }, { value: "all", label: "All members" }]}
            value={enabled}
            onChange={(event) => { setEnabled(event.target.value); setPage(1); }}
          />}
            <AdminSelect<number>
            options={bsDays.map((day) => ({ value: day.bsDay, label: `Day ${formatNepaliNumber(day.bsDay)}` }))}
            value={focusDay}
            onChange={(event) => setFocusDay(Number(event.target.value))}
          />
          <AdminSelect<ViewMode>
            options={[
              { value: "day", label: "Day view" },
              { value: "week", label: "Week view" },
              { value: "month", label: "Month view" },
            ]}
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as ViewMode)}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <div className="text-xs text-slate-500">Visible members</div>
            <div className="mt-1 text-2xl font-black text-white">{memberCount}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <div className="text-xs text-slate-500">Marked present</div>
            <div className="mt-1 text-2xl font-black text-white">{presentCountForSelectedDays}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">
            <div className="text-xs text-slate-500">Date range</div>
            <div className="mt-1 text-sm font-semibold text-white">{formatDisplayDate(selectedMonthStart)} to {formatDisplayDate(selectedMonthEnd)}</div>
          </div>
        </div>
      </AdminCard>

      {selectedDayInfo ? (
        <AdminCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  {BS_MONTHS[selectedBsMonth]} {formatNepaliNumber(selectedDayInfo.bsDay)}, {formatNepaliNumber(selectedBsYear)}
                </h2>
                <AdminBadge tone={selectedDayUnavailable ? "warning" : "success"}>
                  {selectedHoliday ? selectedHoliday.name || "Holiday" : selectedDayInfo.isClosingDay ? "Weekly closing day" : "Available"}
                </AdminBadge>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {formatDisplayDate(selectedDayInfo.adDate)} | {selectedDayInfo.weekday}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!selectedDayInfo.isClosingDay ? (
                <AdminButton type="button" variant="secondary" disabled={activeHolidayDate === selectedDayInfo.adDate} onClick={() => setHoliday(selectedDayInfo)}>
                  {selectedHoliday ? "Edit holiday" : "Set holiday"}
                </AdminButton>
              ) : null}
              {selectedHoliday ? (
                <AdminButton type="button" variant="danger" disabled={activeHolidayDate === selectedDayInfo.adDate} onClick={() => clearHoliday(selectedDayInfo)}>
                  Clear holiday
                </AdminButton>
              ) : null}
            </div>
          </div>
        </AdminCard>
      ) : null}

      {resultsLoading || searchTerm !== debouncedSearch ? <AdminLoading label="Searching attendance..." /> : filteredMembers.length === 0 ? (
        <AdminEmptyState title="No members available" description="Add members first or adjust the search field." />
      ) : (
        <>
          <div className="hidden lg:block">
            <AdminTableShell>
              <AdminTableScroll>
                <table className="min-w-max border-separate border-spacing-1 text-sm text-slate-100">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-20 min-w-[240px] rounded-lg bg-slate-900 px-3 py-3 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                        Member
                      </th>
                      {visibleDays.map((day) => {
                        const holiday = holidayByDate.get(day.adDate);
                        const unavailable = day.isClosingDay || (settings.attendance_holiday_lock && Boolean(holiday));
                        return (
                          <th
                            key={day.adDate}
                            className={cx(
                              "sticky top-0 z-10 min-w-[74px] rounded-lg px-2 py-2 text-center",
                              unavailable ? "bg-amber-300/18 text-amber-100" : "bg-slate-900 text-slate-200"
                            )}
                          >
                            <div className="font-black">{formatNepaliNumber(day.bsDay)}</div>
                            <div className="text-[10px] text-slate-500">{day.weekday.slice(0, 3)}</div>
                            {holiday ? <div className="mt-1 max-w-[64px] truncate text-[10px] text-amber-200">{holiday.name || "Holiday"}</div> : null}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id}>
                        <td className="sticky left-0 z-10 rounded-lg bg-slate-950 px-3 py-2">
                          <button type="button" onClick={() => setProfileMember(member)} className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
                            <div className="font-semibold text-white">{member.full_name}</div>
                            <div className="text-xs text-slate-500">{member.member_id} | {member.phone}</div>
                          </button>
                        </td>
                        {visibleDays.map((day) => {
                          const holiday = holidayByDate.get(day.adDate);
                          const unavailable = day.isClosingDay || (settings.attendance_holiday_lock && Boolean(holiday));
                          const key = cellKey(member.id, day.adDate);
                          const record = attendanceMap.get(key);
                          const checked = Boolean(record && record.status !== "absent");
                          const busy = activeCell === key;

                          return (
                            <td key={key} className={cx("rounded-lg p-1 text-center", unavailable ? "bg-slate-900/45" : "bg-slate-900")}>
                              <button
                                type="button"
                                disabled={busy || unavailable || (usePhpApi && !member.is_active)}
                                onClick={() => setAttendance(member, day, !checked)}
                                className={cx(
                                  "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50",
                                  checked
                                    ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                    : unavailable
                                      ? "border-slate-700 bg-slate-800 text-slate-500"
                                      : "border-slate-700 bg-slate-950 text-slate-400 hover:border-amber-300"
                                )}
                                title={unavailable ? "Unavailable day" : checked ? "Remove attendance" : "Mark present"}
                              >
                                {checked ? <Check className="h-4 w-4" /> : unavailable ? <X className="h-4 w-4" /> : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableScroll>
            </AdminTableShell>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredMembers.map((member) => (
              <article key={member.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setProfileMember(member)} className="text-left">
                    <div className="font-semibold text-white">{member.full_name}</div>
                    <div className="text-xs text-slate-500">{member.member_id}</div>
                  </button>
                  <AdminBadge tone="neutral">{member.membership_status}</AdminBadge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {visibleDays.map((day) => {
                    const holiday = holidayByDate.get(day.adDate);
                    const unavailable = day.isClosingDay || (settings.attendance_holiday_lock && Boolean(holiday));
                    const record = attendanceMap.get(cellKey(member.id, day.adDate));
                    const checked = Boolean(record && record.status !== "absent");
                    return (
                      <button
                        key={day.adDate}
                        type="button"
                        disabled={unavailable || (usePhpApi && (!member.is_active || activeCell === cellKey(member.id, day.adDate)))}
                        onClick={() => setAttendance(member, day, !checked)}
                        className={cx(
                          "rounded-lg border p-3 text-left text-sm",
                          checked
                            ? "border-emerald-400 bg-emerald-400/15 text-emerald-100"
                            : unavailable
                              ? "border-slate-800 bg-slate-900 text-slate-500"
                              : "border-slate-800 bg-slate-900 text-slate-200"
                        )}
                      >
                        <div className="font-semibold">Day {formatNepaliNumber(day.bsDay)}</div>
                        <div className="text-xs">{unavailable ? "Unavailable" : checked ? "Present" : "Not recorded"}</div>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              Showing {memberCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, memberCount)} of {memberCount} members
            </div>
            <div className="flex items-center gap-2">
              <AdminButton type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</AdminButton>
              <span className="min-w-20 text-center text-sm text-slate-300">{page} / {pageCount}</span>
              <AdminButton type="button" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</AdminButton>
            </div>
          </div>
        </>
      )}

      <AdminCard>
        <AdminSectionTitle title="Recently removed attendance" description="Soft-deleted attendance records for the selected BS month." />
        <div className="mt-4 space-y-2">
          {deletedRecords.length === 0 ? (
            <AdminEmptyState title="No removed attendance records" />
          ) : (
            deletedRecords.map((record) => {
              const member = members.find((item) => item.id === record.member_ref);
              return (
                <div key={record.id} className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-300">
                    <b className="text-white">{member?.full_name || "Member"}</b> | {formatDisplayDate(record.attendance_date)} | {statusLabel(record.status)}
                  </div>
                  <AdminButton type="button" variant="secondary" disabled={usePhpApi && (resultsLoading || activeCell === cellKey(record.member_ref, record.attendance_date))} onClick={() => restoreAttendance(record)}>
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </AdminButton>
                </div>
              );
            })
          )}
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminNotice tone="success">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Present or late
          </div>
        </AdminNotice>
        <AdminNotice tone="neutral">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Not recorded
          </div>
        </AdminNotice>
        <AdminNotice tone="muted">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Holiday or closing day
          </div>
        </AdminNotice>
      </div>

      <AdminDrawer
        open={Boolean(profileMember)}
        title={profileMember?.full_name ?? "Member profile"}
        description={profileMember ? `${profileMember.member_id} | ${profileMember.phone}` : undefined}
        onClose={() => setProfileMember(null)}
        size="lg"
        footer={profileMember?.is_active ? (
          <AdminButton type="button" variant="primary" onClick={() => navigate("/admin/billing", { state: { memberId: profileMember.id } })}>
            Record Payment
          </AdminButton>
        ) : null}
      >
        {profileMember ? (
          <div className="space-y-4">
            <AdminCard>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{profileMember.full_name}</div>
                  <div className="text-sm text-slate-400">{profileMember.email || "No email"}</div>
                </div>
              </div>
            </AdminCard>
            <AdminCard>
              <AdminSectionTitle title="Membership" />
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div>Plan: <b>{statusLabel(profileMember.membership_type)}</b></div>
                <div>Status: <b>{statusLabel(profileMember.membership_status)}</b></div>
                <div>Start: <b>{formatDisplayDate(profileMember.start_date)}</b></div>
                <div>End: <b>{formatDisplayDate(profileMember.end_date)}</b></div>
              </div>
            </AdminCard>
            <AdminCard>
              <AdminSectionTitle title="Payment and notes" />
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div>Payment: <b>{statusLabel(profileMember.payment_status)}</b></div>
                <div>Due: <b>{memberFeeStatus?.summary?.next_due_date ? formatDisplayDate(memberFeeStatus.summary.next_due_date) : formatDisplayDate(profileMember.payment_due_date)}</b></div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/55 p-3">{profileMember.notes || "No notes."}</div>
              </div>
            </AdminCard>

            <AdminCard>
              <AdminSectionTitle title="Membership fee status" />
              <div className="mt-4 space-y-4">
                {memberFeeStatus ? (
                  <>
                    {memberFeeStatus.has_outstanding ? (
                      <>
                        <AdminNotice tone="warning" title={memberFeeStatus.summary.total_due > 0 ? "Outstanding membership fees" : "No amount available to collect"}>
                          Total due: <b>{formatMembershipFeeAmount(memberFeeStatus.summary.total_due, memberFeeStatus.summary.currency_code)}</b>
                          {overdueFeeCount > 0 && (
                            <span className="ml-3 text-amber-300"><b>{overdueFeeCount}</b> overdue</span>
                          )}
                          {upcomingFeeCount > 0 && (
                            <span className="ml-3 text-slate-300"><b>{upcomingFeeCount}</b> upcoming</span>
                          )}
                        </AdminNotice>
                        {memberFeeStatus.outstanding_fees?.some(isZeroAmountFee) ? (
                          <AdminNotice tone="warning" title="Fee periods with a zero amount">
                            Billing can only collect a positive balance. Check the member's plan and confirm which periods should be charged.
                          </AdminNotice>
                        ) : null}
                        {memberFeeStatus.outstanding_fees && memberFeeStatus.outstanding_fees.length > 0 && (
                          <div className="space-y-2">
                            {memberFeeStatus.outstanding_fees.map((fee) => (
                              <div
                                key={fee.id}
                                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="font-semibold text-white">{formatBillingPeriodFromDueDate(fee.due_date)}</div>
                                  <div className="text-xs text-slate-400">
                                    Due: {formatDisplayDate(fee.due_date)} |
                                    Amount: {formatMembershipFeeAmount(fee.amount_minor, fee.currency_code)} | 
                                    Outstanding: <b>{formatMembershipFeeAmount(fee.amount_minor - fee.paid_amount_minor, fee.currency_code)}</b>
                                  </div>
                                </div>
                                <AdminBadge tone={isZeroAmountFee(fee) ? "neutral" : membershipFeeStatusTone(fee.status)}>{isZeroAmountFee(fee) ? "Zero amount" : statusLabel(fee.status)}</AdminBadge>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : !profileMember.is_active ? (
                      <AdminNotice tone="neutral">
                        This member is inactive. Activate the member to generate and manage membership fees.
                      </AdminNotice>
                    ) : (
                      <AdminNotice tone="success">
                        No outstanding membership fees. All payments are up to date.
                      </AdminNotice>
                    )}
                    {memberFeeStatus.paid_fees && memberFeeStatus.paid_fees.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">Recent payment history</h4>
                        <div className="space-y-2">
                          {memberFeeStatus.paid_fees.slice(0, 6).map((fee) => (
                            <div
                              key={fee.id}
                              className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/55 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="font-semibold text-white">{formatBillingPeriodFromDueDate(fee.due_date)}</div>
                                <div className="text-xs text-slate-400">
                                  Paid: {formatMembershipFeeAmount(fee.paid_amount_minor, fee.currency_code)} on {fee.paid_at ? formatDisplayDate(fee.paid_at.split("T")[0]) : "Unknown date"}
                                </div>
                              </div>
                              <AdminBadge tone="success">Paid</AdminBadge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <AdminLoading label="Loading membership fee status..." />
                )}
              </div>
            </AdminCard>
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}
