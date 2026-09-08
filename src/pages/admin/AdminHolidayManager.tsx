import { useEffect, useMemo, useState } from "react";
import NepaliDate from "nepali-date-converter";
import { supabase } from "@src/Client/supabase";

type HolidayRow = {
  id: number;
  holiday_date: string;
  name: string | null;
};

type HolidayTemplateRow = {
  id: number;
  name: string;
  bs_month: number;
  bs_day: number;
  is_active: boolean;
};

type BsDayCell = {
  bsDay: number;
  adDate: string;
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

function buildBsMonthDays(bsYear: number, bsMonthIndex: number) {
  const result: BsDayCell[] = [];
  for (let day = 1; day <= 32; day += 1) {
    const bsDate = new NepaliDate(bsYear, bsMonthIndex, day);
    if (bsDate.getYear() !== bsYear || bsDate.getMonth() !== bsMonthIndex) break;
    result.push({ bsDay: day, adDate: formatAdDate(bsDate.toJsDate()) });
  }
  return result;
}

function adToBsText(adDate: string) {
  try {
    const bs = new NepaliDate(new Date(`${adDate}T00:00:00`));
    return bs.format("YYYY-MM-DD");
  } catch {
    return adDate;
  }
}

export default function AdminHolidayManager() {
  const nowBs = new NepaliDate();
  const [selectedBsYear, setSelectedBsYear] = useState<number>(nowBs.getYear());
  const [selectedBsMonth, setSelectedBsMonth] = useState<number>(nowBs.getMonth());
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [templates, setTemplates] = useState<HolidayTemplateRow[]>([]);
  const [occasionName, setOccasionName] = useState("");
  const [manualDay, setManualDay] = useState<number>(1);
  const [templateName, setTemplateName] = useState("");
  const [templateMonth, setTemplateMonth] = useState<number>(nowBs.getMonth());
  const [templateDay, setTemplateDay] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const bsDays = useMemo(
    () => buildBsMonthDays(selectedBsYear, selectedBsMonth),
    [selectedBsYear, selectedBsMonth]
  );

  const maxDayInTemplateMonth = useMemo(
    () => buildBsMonthDays(selectedBsYear, templateMonth).length || 32,
    [selectedBsYear, templateMonth]
  );

  const years = useMemo(() => {
    const start = nowBs.getYear() - 5;
    const end = nowBs.getYear() + 5;
    const list: number[] = [];
    for (let y = start; y <= end; y += 1) list.push(y);
    return list;
  }, [nowBs]);

  const loadHolidays = async (bsYear: number, bsMonth: number) => {
    const days = buildBsMonthDays(bsYear, bsMonth);
    if (!days.length) {
      setHolidays([]);
      return;
    }

    const start = days[0].adDate;
    const end = days[days.length - 1].adDate;

    const { data, error } = await supabase
      .from("attendance_holidays")
      .select("id, holiday_date, name")
      .gte("holiday_date", start)
      .lte("holiday_date", end)
      .order("holiday_date", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setHolidays((data as HolidayRow[]) || []);
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("attendance_holiday_templates")
      .select("id, name, bs_month, bs_day, is_active")
      .order("bs_month", { ascending: true })
      .order("bs_day", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }
    setTemplates((data as HolidayTemplateRow[]) || []);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMessage("");
      await Promise.all([loadHolidays(selectedBsYear, selectedBsMonth), loadTemplates()]);
      setLoading(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    init();
  }, []);

  const onMonthChange = async (year: number, month: number) => {
    setSelectedBsYear(year);
    setSelectedBsMonth(month);
    setLoading(true);
    setMessage("");
    await loadHolidays(year, month);
    setLoading(false);
  };

  const addManualHoliday = async () => {
    if (!occasionName.trim()) {
      setMessage("Please enter holiday occasion name.");
      return;
    }
    const dayInfo = bsDays.find((d) => d.bsDay === manualDay);
    if (!dayInfo) {
      setMessage("Invalid day for selected month.");
      return;
    }

    setSaving(true);
    const payload = { holiday_date: dayInfo.adDate, name: occasionName.trim() };
    const { error } = await supabase
      .from("attendance_holidays")
      .upsert(payload, { onConflict: "holiday_date" });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Holiday saved.");
    setOccasionName("");
    await loadHolidays(selectedBsYear, selectedBsMonth);
  };

  const editHoliday = async (holiday: HolidayRow) => {
    const next = window.prompt("Edit holiday occasion:", holiday.name || "");
    if (next === null) return;
    const updatedName = next.trim() || "Holiday";
    const { error } = await supabase
      .from("attendance_holidays")
      .update({ name: updatedName })
      .eq("id", holiday.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Holiday updated.");
    await loadHolidays(selectedBsYear, selectedBsMonth);
  };

  const deleteHoliday = async (holiday: HolidayRow) => {
    const { error } = await supabase.from("attendance_holidays").delete().eq("id", holiday.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Holiday removed.");
    await loadHolidays(selectedBsYear, selectedBsMonth);
  };

  const addTemplate = async () => {
    if (!templateName.trim()) {
      setMessage("Template name is required.");
      return;
    }
    if (templateDay < 1 || templateDay > 32) {
      setMessage("Template day must be between 1 and 32.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("attendance_holiday_templates").insert({
      name: templateName.trim(),
      bs_month: templateMonth,
      bs_day: templateDay,
      is_active: true,
    });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTemplateName("");
    setTemplateDay(1);
    setMessage("Holiday template created.");
    await loadTemplates();
  };

  const toggleTemplateActive = async (template: HolidayTemplateRow) => {
    const { error } = await supabase
      .from("attendance_holiday_templates")
      .update({ is_active: !template.is_active })
      .eq("id", template.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadTemplates();
  };

  const deleteTemplate = async (templateId: number) => {
    const { error } = await supabase.from("attendance_holiday_templates").delete().eq("id", templateId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Template removed.");
    await loadTemplates();
  };

  const applyTemplatesToMonth = async () => {
    const monthTemplates = templates.filter(
      (t) => t.is_active && t.bs_month === selectedBsMonth && t.bs_day <= bsDays.length
    );
    if (monthTemplates.length === 0) {
      setMessage("No active templates to apply for this month.");
      return;
    }

    setSaving(true);
    const payload = monthTemplates.map((t) => {
      const targetDay = bsDays.find((d) => d.bsDay === t.bs_day);
      return {
        holiday_date: targetDay?.adDate,
        name: t.name,
      };
    }).filter((x) => Boolean(x.holiday_date));

    const { error } = await supabase
      .from("attendance_holidays")
      .upsert(payload, { onConflict: "holiday_date" });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Applied ${payload.length} template holiday(s).`);
    await loadHolidays(selectedBsYear, selectedBsMonth);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h2 className="text-2xl font-black text-white">Holiday Manager</h2>
        <p className="text-sm text-zinc-300">
          Manage monthly holidays and recurring holiday templates with occasion names.
        </p>
        {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Year (BS)</label>
            <select
              value={selectedBsYear}
              onChange={(e) => onMonthChange(Number(e.target.value), selectedBsMonth)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-black">
                  {formatNepaliNumber(y)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Month (BS)</label>
            <select
              value={selectedBsMonth}
              onChange={(e) => onMonthChange(selectedBsYear, Number(e.target.value))}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
            >
              {BS_MONTHS.map((m, idx) => (
                <option key={m} value={idx} className="bg-black">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyTemplatesToMonth}
              disabled={saving || loading}
              className="w-full rounded-xl bg-white px-4 py-3 font-black text-black disabled:opacity-60"
            >
              Apply Templates
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl">
          <select
            value={manualDay}
            onChange={(e) => setManualDay(Number(e.target.value))}
            className="rounded-xl bg-white/10 px-4 py-3 text-white"
          >
            {bsDays.map((d) => (
              <option key={d.bsDay} value={d.bsDay} className="bg-black">
                Day {formatNepaliNumber(d.bsDay)}
              </option>
            ))}
          </select>
          <input
            value={occasionName}
            onChange={(e) => setOccasionName(e.target.value)}
            placeholder="Occasion name"
            className="rounded-xl bg-white/10 px-4 py-3 text-white"
          />
          <button
            type="button"
            onClick={addManualHoliday}
            disabled={saving || loading}
            className="rounded-xl bg-white px-4 py-3 font-black text-black disabled:opacity-60"
          >
            Save Holiday
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-3">
        <h3 className="text-lg font-black text-white">Holidays In Selected Month</h3>
        {loading ? <p className="text-sm text-zinc-300">Loading holidays...</p> : null}
        {!loading && holidays.length === 0 ? <p className="text-sm text-zinc-400">No holidays yet.</p> : null}
        {holidays.map((holiday) => (
          <div key={holiday.id} className="rounded-xl bg-white/8 p-3 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-100">
              <b>{holiday.name || "Holiday"}</b> | {adToBsText(holiday.holiday_date)} BS
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editHoliday(holiday)}
                className="rounded-lg bg-white/10 px-3 py-1 text-white"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteHoliday(holiday)}
                className="rounded-lg bg-red-500/20 px-3 py-1 text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-4">
        <h3 className="text-lg font-black text-white">Recurring Holiday Templates (Yearly BS)</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template occasion"
            className="rounded-xl bg-white/10 px-4 py-3 text-white"
          />
          <select
            value={templateMonth}
            onChange={(e) => setTemplateMonth(Number(e.target.value))}
            className="rounded-xl bg-white/10 px-4 py-3 text-white"
          >
            {BS_MONTHS.map((m, idx) => (
              <option key={m} value={idx} className="bg-black">
                {m}
              </option>
            ))}
          </select>
          <select
            value={templateDay}
            onChange={(e) => setTemplateDay(Number(e.target.value))}
            className="rounded-xl bg-white/10 px-4 py-3 text-white"
          >
            {Array.from({ length: maxDayInTemplateMonth }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day} className="bg-black">
                Day {formatNepaliNumber(day)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTemplate}
            disabled={saving}
            className="rounded-xl bg-white px-4 py-3 font-black text-black disabled:opacity-60"
          >
            Add Template
          </button>
        </div>

        {templates.length === 0 ? <p className="text-sm text-zinc-400">No templates created yet.</p> : null}
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl bg-white/8 p-3 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-100">
              <b>{template.name}</b> | {BS_MONTHS[template.bs_month]} {formatNepaliNumber(template.bs_day)} |{" "}
              {template.is_active ? "Active" : "Inactive"}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleTemplateActive(template)}
                className="rounded-lg bg-white/10 px-3 py-1 text-white"
              >
                {template.is_active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                onClick={() => deleteTemplate(template.id)}
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
