import { useEffect, useMemo, useState } from "react";
import NepaliDate from "nepali-date-converter";
import { supabase } from "@src/Client/supabase";

type AttendanceStatus = "present" | "late" | "absent" | "excused";

type MemberOption = {
  id: number;
  member_id: string;
  full_name: string;
};

type AttendanceRow = {
  id: number;
  member_ref: number;
  attendance_date: string;
  status: AttendanceStatus;
};

type HolidayRow = {
  id: number;
  holiday_date: string;
  name: string | null;
};

type BsDayCell = {
  bsDay: number;
  adDate: string;
  weekday: string;
  isSaturday: boolean;
};

const BS_MONTHS = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
];

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function formatAdDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatNepaliNumber(value: number) {
  return value.toLocaleString("ne-NP-u-nu-deva");
}

function cellKey(memberId: number, adDate: string) {
  return `${memberId}:${adDate}`;
}

function buildBsMonthDays(bsYear: number, bsMonthIndex: number) {
  const result: BsDayCell[] = [];

  for (let day = 1; day <= 32; day += 1) {
    const bsDate = new NepaliDate(bsYear, bsMonthIndex, day);
    if (bsDate.getYear() !== bsYear || bsDate.getMonth() !== bsMonthIndex) {
      break;
    }

    result.push({
      bsDay: day,
      adDate: formatAdDate(bsDate.toJsDate()),
      weekday: bsDate.format("dd", "np"),
      isSaturday: bsDate.getDay() === 6,
    });
  }

  return result;
}

export default function AdminAttendance() {
  const todayBs = new NepaliDate();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [selectedBsYear, setSelectedBsYear] = useState<number>(todayBs.getYear());
  const [selectedBsMonth, setSelectedBsMonth] = useState<number>(todayBs.getMonth());
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState<string>("");
  const [activeHolidayDate, setActiveHolidayDate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const bsDays = useMemo(
    () => buildBsMonthDays(selectedBsYear, selectedBsMonth),
    [selectedBsYear, selectedBsMonth]
  );

  const yearOptions = useMemo(() => {
    const startYear = todayBs.getYear() - 6;
    const endYear = todayBs.getYear() + 3;
    const values: number[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
      values.push(year);
    }
    return values;
  }, [todayBs]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    records.forEach((record) => {
      map.set(cellKey(record.member_ref, record.attendance_date), record);
    });
    return map;
  }, [records]);

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);
  const holidayByDate = useMemo(() => {
    const map = new Map<string, HolidayRow>();
    holidays.forEach((h) => map.set(h.holiday_date, h));
    return map;
  }, [holidays]);

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.full_name.toLowerCase().includes(query) || member.member_id.toLowerCase().includes(query)
    );
  }, [members, searchTerm]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("members")
      .select("id, member_id, full_name")
      .order("full_name", { ascending: true })
      .limit(1000);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMembers((data as MemberOption[]) || []);
  };

  const loadRecords = async (bsYear: number, bsMonth: number) => {
    const days = buildBsMonthDays(bsYear, bsMonth);
    if (days.length === 0) {
      setRecords([]);
      return;
    }

    const startDate = days[0].adDate;
    const endDate = days[days.length - 1].adDate;

    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, member_ref, attendance_date, status")
      .gte("attendance_date", startDate)
      .lte("attendance_date", endDate)
      .order("attendance_date", { ascending: false })
      .limit(5000);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRecords((data as AttendanceRow[]) || []);
  };

  const loadHolidays = async (bsYear: number, bsMonth: number) => {
    const days = buildBsMonthDays(bsYear, bsMonth);
    if (days.length === 0) {
      setHolidays([]);
      return;
    }

    const startDate = days[0].adDate;
    const endDate = days[days.length - 1].adDate;

    const { data, error } = await supabase
      .from("attendance_holidays")
      .select("id, holiday_date, name")
      .gte("holiday_date", startDate)
      .lte("holiday_date", endDate)
      .order("holiday_date", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setHolidays((data as HolidayRow[]) || []);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMessage("");
      await loadMembers();
      await loadRecords(selectedBsYear, selectedBsMonth);
      await loadHolidays(selectedBsYear, selectedBsMonth);
      setLoading(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    init();
  }, []);

  const onMonthOrYearChange = async (nextYear: number, nextMonth: number) => {
    setSelectedBsYear(nextYear);
    setSelectedBsMonth(nextMonth);
    setMessage("");
    setLoading(true);
    await loadRecords(nextYear, nextMonth);
    await loadHolidays(nextYear, nextMonth);
    setLoading(false);
  };

  const toggleAttendance = async (member: MemberOption, dayInfo: BsDayCell, checked: boolean) => {
    if (dayInfo.isSaturday || holidayDateSet.has(dayInfo.adDate)) return;

    const key = cellKey(member.id, dayInfo.adDate);
    const existing = attendanceMap.get(key);

    setActiveCell(key);
    setMessage("");

    if (checked) {
      const payload = {
        member_ref: member.id,
        attendance_date: dayInfo.adDate,
        status: "present" as AttendanceStatus,
      };
      const { error } = await supabase.from("attendance_records").upsert(payload, {
        onConflict: "member_ref,attendance_date",
      });
      if (error) {
        setMessage(error.message);
        setActiveCell("");
        return;
      }
    } else if (existing) {
      const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
      if (error) {
        setMessage(error.message);
        setActiveCell("");
        return;
      }
    }

    await loadRecords(selectedBsYear, selectedBsMonth);
    setActiveCell("");
  };

  const setHolidayOccasion = async (dayInfo: BsDayCell) => {
    if (dayInfo.isSaturday) return;

    setActiveHolidayDate(dayInfo.adDate);
    setMessage("");

    const existing = holidayByDate.get(dayInfo.adDate);
    const defaultName = existing?.name || "";
    const nameInput = window.prompt("Enter holiday occasion for this day:", defaultName);
    if (nameInput === null) {
      setActiveHolidayDate("");
      return;
    }

    const holidayName = nameInput.trim() || "Holiday";

    if (existing) {
      const { error } = await supabase
        .from("attendance_holidays")
        .update({ name: holidayName })
        .eq("id", existing.id);
      if (error) {
        setMessage(error.message);
        setActiveHolidayDate("");
        return;
      }
    } else {
      const payload = { holiday_date: dayInfo.adDate, name: holidayName };
      const { error } = await supabase.from("attendance_holidays").insert(payload);
      if (error) {
        setMessage(error.message);
        setActiveHolidayDate("");
        return;
      }
    }

    await loadHolidays(selectedBsYear, selectedBsMonth);
    setActiveHolidayDate("");
  };

  const clearHoliday = async (dayInfo: BsDayCell) => {
    if (dayInfo.isSaturday) return;
    const existing = holidayByDate.get(dayInfo.adDate);
    if (!existing) return;

    setActiveHolidayDate(dayInfo.adDate);
    setMessage("");

    const { error } = await supabase.from("attendance_holidays").delete().eq("id", existing.id);
    if (error) {
      setMessage(error.message);
      setActiveHolidayDate("");
      return;
    }

    await loadHolidays(selectedBsYear, selectedBsMonth);
    setActiveHolidayDate("");
  };

  if (loading) {
    return <div className="rounded-2xl bg-black/35 p-6 text-zinc-200">हाजिरी लोड हुँदैछ...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-xl font-black text-white">मासिक हाजिरी तालिका (BS)</h2>
        <p className="text-xs text-zinc-400">यो फिचर केवल एडमिनका लागि मात्र उपलब्ध छ।</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">वर्ष (BS)</label>
            <select
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
              value={selectedBsYear}
              onChange={(e) => onMonthOrYearChange(Number(e.target.value), selectedBsMonth)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year} className="bg-black">
                  {formatNepaliNumber(year)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">महिना (BS)</label>
            <select
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
              value={selectedBsMonth}
              onChange={(e) => onMonthOrYearChange(selectedBsYear, Number(e.target.value))}
            >
              {BS_MONTHS.map((monthName, idx) => (
                <option key={monthName} value={idx} className="bg-black">
                  {monthName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-zinc-400">
          {BS_MONTHS[selectedBsMonth]} {formatNepaliNumber(selectedBsYear)} मा चेक गर्नुभयो भने उपस्थित चिन्ह
          हुन्छ, अनचेक गर्नुभयो भने सो दिनको हाजिरी हट्छ।
        </p>
        {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
      </div>

      <div className="rounded-2xl bg-black/35 p-6">
        <div className="mb-4 max-w-md space-y-1">
          <label className="text-xs font-semibold text-zinc-300">Search Member</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by member name or ID"
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          />
        </div>
        {members.length > 0 && filteredMembers.length === 0 ? (
          <p className="mb-4 text-sm text-zinc-400">No matching members found.</p>
        ) : null}
        {members.length === 0 ? <p className="text-sm text-zinc-400">कुनै सदस्य फेला परेन।</p> : null}
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/10">
          <table className="min-w-max text-sm text-white border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-zinc-900 rounded-md px-3 py-2 text-left min-w-[220px]">
                  सदस्य
                </th>
                {bsDays.map((dayInfo) => {
                  const holiday = holidayByDate.get(dayInfo.adDate);
                  const isHoliday = Boolean(holiday);
                  const isOffDay = dayInfo.isSaturday || isHoliday;
                  const holidayBusy = activeHolidayDate === dayInfo.adDate;
                  return (
                  <th
                    key={dayInfo.adDate}
                    className={[
                      "sticky top-0 z-10 rounded-md px-2 py-2 text-center min-w-[48px]",
                      isOffDay ? "bg-amber-400 text-black" : "bg-zinc-800",
                    ].join(" ")}
                  >
                    <div>{formatNepaliNumber(dayInfo.bsDay)}</div>
                    <div className={isOffDay ? "text-[10px] text-black/80" : "text-[10px] text-zinc-400"}>
                      {dayInfo.weekday}
                    </div>
                    {isHoliday ? (
                      <div
                        className="mt-1 text-[9px] leading-tight text-black/90 max-w-[44px] mx-auto break-words"
                        title={holiday?.name || "Holiday"}
                      >
                        {holiday?.name || "Holiday"}
                      </div>
                    ) : null}
                    {!dayInfo.isSaturday ? (
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={holidayBusy}
                          onClick={() => setHolidayOccasion(dayInfo)}
                          className={[
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            isHoliday ? "bg-black text-amber-300" : "bg-white/25 text-black",
                            holidayBusy ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                          title={isHoliday ? "Edit holiday occasion" : "Set holiday occasion"}
                        >
                          {isHoliday ? "Edit" : "Set"}
                        </button>
                        {isHoliday ? (
                          <button
                            type="button"
                            disabled={holidayBusy}
                            onClick={() => clearHoliday(dayInfo)}
                            className={[
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/25 text-black",
                              holidayBusy ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                            title="Clear holiday"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] font-semibold text-black/80">Off</div>
                    )}
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td className="sticky left-0 z-10 bg-zinc-900 rounded-md px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold">{member.full_name}</div>
                    <div className="text-[11px] text-zinc-400">{member.member_id}</div>
                  </td>
                  {bsDays.map((dayInfo) => {
                    const key = cellKey(member.id, dayInfo.adDate);
                    const record = attendanceMap.get(key);
                    const checked = Boolean(record && record.status !== "absent");
                    const busy = activeCell === key;
                    const holiday = holidayByDate.get(dayInfo.adDate);
                    const isHoliday = Boolean(holiday);
                    const disabled = busy || dayInfo.isSaturday || isHoliday;
                    return (
                      <td
                        key={key}
                        className={[
                          "rounded-md text-center p-1",
                          dayInfo.isSaturday || isHoliday ? "bg-amber-300/30" : "bg-white/5",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => toggleAttendance(member, dayInfo, e.target.checked)}
                          className={[
                            "h-4 w-4 accent-emerald-400",
                            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                          ].join(" ")}
                          title={
                            dayInfo.isSaturday
                              ? "Off day (Saturday)"
                              : isHoliday
                                ? `Holiday: ${holiday?.name || "Holiday"}`
                                : "Toggle attendance"
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
