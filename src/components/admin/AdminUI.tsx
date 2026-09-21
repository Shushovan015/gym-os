import { createPortal } from "react-dom";
import { useScrollLock } from "@src/hooks/useScrollLock";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { adToBsString, buildBsMonthDays, bsStringToAdDate, cx, getNepalTodayAdDate } from "@src/pages/admin/adminUtils";
import type { SelectOption } from "@src/pages/admin/adminTypes";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent" | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-700 bg-slate-900 text-slate-100",
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
  warning: "border-amber-500/35 bg-amber-500/12 text-amber-200",
  danger: "border-rose-500/35 bg-rose-500/12 text-rose-200",
  accent: "border-amber-400/35 bg-amber-400/12 text-amber-100",
  muted: "border-slate-700 bg-slate-800/70 text-slate-300",
};

const modalStack: Array<{ token: symbol; layer: number }> = [];
const topModal = () => modalStack.reduce<(typeof modalStack)[number] | undefined>((top, item) => !top || item.layer >= top.layer ? item : top, undefined)?.token;

function useAdminModal(open: boolean, onClose: () => void) {
  useScrollLock(open);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    const layer = Number.parseInt(getComputedStyle(panelRef.current?.parentElement ?? document.body).zIndex, 10) || 0;
    modalStack.push({ token, layer });
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => { if (topModal() === token) panelRef.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button")?.focus(); }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (topModal() !== token) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") {
        const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (!first) { event.preventDefault(); panelRef.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { modalStack.splice(modalStack.findIndex((item) => item.token === token), 1); window.clearTimeout(timer); document.removeEventListener("keydown", onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return panelRef;
}

export function AdminCard({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-slate-800 bg-slate-950/72 shadow-[0_18px_48px_rgba(0,0,0,0.24)]",
        padded && "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </section>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-black tracking-normal text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminButton({
  variant = "secondary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "border-amber-400 bg-amber-400 text-slate-950 hover:bg-amber-300",
    secondary: "border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600 hover:bg-slate-800",
    danger: "border-rose-500/50 bg-rose-500/12 text-rose-100 hover:bg-rose-500/18",
    ghost: "border-transparent bg-transparent text-slate-300 hover:bg-slate-900 hover:text-white",
  };

  return (
    <button
      {...props}
      type={type}
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function AdminLinkButton({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300",
        className
      )}
    >
      {children}
    </span>
  );
}

export function AdminBadge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function AdminField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-rose-300">{error}</span> : null}
      {!error && hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function AdminInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const { onFocus, onClick, type, ...inputProps } = props;
  return (
    <input
      {...inputProps}
      type={type}
      onFocus={(event) => {
        if (type === "number" && /^0(?:\.0+)?$/.test(event.currentTarget.value)) {
          event.currentTarget.select();
        }
        onFocus?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (
          type === "date" &&
          !event.defaultPrevented &&
          !event.currentTarget.disabled &&
          !event.currentTarget.readOnly
        ) {
          try {
            event.currentTarget.showPicker?.();
          } catch {
            // The browser can still open its native picker from the calendar icon.
          }
        }
      }}
      className={cx(
        "min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100",
        type === "date" && "[color-scheme:dark]",
        className
      )}
    />
  );
}

const BS_MONTH_LABELS = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const BS_YEARS = Array.from({ length: 41 }, (_, index) => 2070 + index);

export function AdminBsDateInput({ value, onChange, className = "", required = false }: { value: string | null | undefined; onChange: (adDate: string) => void; className?: string; required?: boolean }) {
  const currentBs = adToBsString(getNepalTodayAdDate());
  const selectedBs = adToBsString(value);
  const initial = (selectedBs || currentBs).split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial[0]);
  const [viewMonth, setViewMonth] = useState(initial[1] - 1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useAdminModal(open, () => setOpen(false));
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const days = buildBsMonthDays(viewYear, viewMonth, -1);
  const firstOffset = days[0]?.weekdayIndex ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node) && !calendarRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const bounds = rootRef.current?.getBoundingClientRect();
      if (bounds) setPosition({ left: Math.max(16, Math.min(bounds.left, window.innerWidth - 368)), top: Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - 440)) });
    };
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  const moveMonth = (amount: number) => {
    const next = viewMonth + amount;
    if (next < 0) { setViewYear((year) => year - 1); setViewMonth(11); }
    else if (next > 11) { setViewYear((year) => year + 1); setViewMonth(0); }
    else setViewMonth(next);
  };
  const toggleCalendar = () => {
    if (!open) {
      const shown = (selectedBs || currentBs).split("-").map(Number);
      setViewYear(shown[0]);
      setViewMonth(shown[1] - 1);
    }
    const bounds = rootRef.current?.getBoundingClientRect();
    if (bounds) setPosition({ left: Math.max(16, Math.min(bounds.left, window.innerWidth - 368)), top: Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - 440)) });
    setOpen((shown) => !shown);
  };

  return <div ref={rootRef} className={cx("relative", className)}>
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={toggleCalendar} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm outline-none transition hover:border-slate-600 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20">
      <span className={selectedBs ? "text-white" : "text-slate-500"}>{selectedBs ? `${selectedBs} BS` : "Choose Nepali date"}</span><CalendarDays className="h-4 w-4 shrink-0 text-amber-300" />
    </button>
    {required ? <input tabIndex={-1} aria-hidden="true" required value={value ?? ""} onChange={() => undefined} className="pointer-events-none absolute inset-0 -z-10 opacity-0" /> : null}
    {open ? createPortal(<div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)}><section ref={calendarRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Nepali calendar" style={position} onClick={(event) => event.stopPropagation()} className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain fixed w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => moveMonth(-1)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Previous Nepali month"><ChevronLeft className="h-4 w-4"/></button><div className="text-center"><div className="font-black text-white">{BS_MONTH_LABELS[viewMonth]}</div><div className="text-xs text-amber-300">{viewYear} BS</div></div><button type="button" onClick={() => moveMonth(1)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Next Nepali month"><ChevronRight className="h-4 w-4"/></button></div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-500">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-1">{Array.from({ length: firstOffset }, (_, index) => <span key={`empty-${index}`} />)}{days.map((item) => { const itemBs = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(item.bsDay).padStart(2,"0")}`; const selected = itemBs === selectedBs; const today = itemBs === currentBs; return <button key={item.bsDay} type="button" onClick={() => { onChange(item.adDate); setOpen(false); }} className={cx("aspect-square rounded-lg text-sm font-semibold transition", selected ? "bg-amber-400 text-slate-950" : today ? "border border-amber-400 text-amber-200" : "text-slate-300 hover:bg-slate-800")}>{item.bsDay}</button>; })}</div>
      <div className="mt-4 flex justify-between border-t border-slate-800 pt-3"><button type="button" onClick={() => { onChange(getNepalTodayAdDate()); setOpen(false); }} className="text-xs font-semibold text-amber-300">Today</button>{value ? <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs font-semibold text-rose-300">Clear date</button> : null}</div>
    </section></div>, document.body) : null}
  </div>;
}

export function LegacyAdminBsDateInput({ value, onChange, className = "", required = false }: { value: string | null | undefined; onChange: (adDate: string) => void; className?: string; required?: boolean }) {
  const currentBs = adToBsString(getNepalTodayAdDate());
  const bs = adToBsString(value) || currentBs;
  const [year, month, day] = bs.split("-").map(Number);
  const commit = (nextYear: number, nextMonth: number, nextDay: number) => {
    let safeDay = nextDay;
    let ad = bsStringToAdDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
    while (!ad && safeDay > 1) {
      safeDay -= 1;
      ad = bsStringToAdDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
    }
    if (ad) onChange(ad);
  };
  return <div className={cx("grid grid-cols-[1.25fr_1.8fr_1fr_auto] gap-2", className)}>
    <select aria-label="BS year" value={value ? year : ""} required={required} onChange={(event) => event.target.value ? commit(Number(event.target.value), month, day) : onChange("")} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="">Year</option>{BS_YEARS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    <select aria-label="BS month" value={value ? month : ""} required={required} onChange={(event) => event.target.value ? commit(year, Number(event.target.value), day) : onChange("")} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="">Month</option>{BS_MONTH_LABELS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
    <select aria-label="BS day" value={value ? day : ""} required={required} onChange={(event) => event.target.value ? commit(year, month, Number(event.target.value)) : onChange("")} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white"><option value="">Day</option>{Array.from({ length: 32 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}</select>
    {value ? <button type="button" aria-label="Clear Nepali date" onClick={() => onChange("")} className="rounded-lg border border-slate-700 px-2 text-slate-400 hover:text-white">×</button> : <span />}
  </div>;
}

export function AdminBsMonthInput({ value, onChange, max }: { value: string; onChange: (bsMonth: string) => void; max?: string }) {
  const adValue = bsStringToAdDate(`${value}-01`) || "";
  return <AdminBsDateInput value={adValue} required onChange={(adDate) => {
    if (!adDate) return;
    const next = adToBsString(adDate).slice(0, 7);
    if (!max || next <= max) onChange(next);
  }} />;
}

export function AdminTextarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    />
  );
}

export function AdminSelect<T extends string | number>({
  options,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<SelectOption<T>>;
}) {
  return (
    <select
      {...props}
      className={cx(
        "min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <AdminInput value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function AdminMetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "neutral",
  footer,
}: {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  footer?: ReactNode;
}) {
  return (
    <AdminCard className="min-h-[140px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <div className="mt-3 text-3xl font-black tracking-normal text-white">{value}</div>
        </div>
        {Icon ? (
          <span className={cx("inline-flex h-10 w-10 items-center justify-center rounded-lg border", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-3 text-sm leading-5 text-slate-400">{description}</p> : null}
      {footer ? <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">{footer}</div> : null}
    </AdminCard>
  );
}

export function AdminNotice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-lg border p-3 text-sm", toneClasses[tone])}>
      {title ? <div className="mb-1 font-semibold">{title}</div> : null}
      <div className="leading-5">{children}</div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/55 p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-bold text-white">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
      <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
      {label}
    </div>
  );
}

export function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "xl",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "lg" | "xl" | "2xl";
}) {
  const panelRef = useAdminModal(open, onClose);
  if (!open) return null;
  const sizes = {
    lg: "max-w-lg",
    xl: "max-w-3xl",
    "2xl": "max-w-5xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <button type="button" tabIndex={-1} aria-hidden="true" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true" aria-label={title} tabIndex={-1}
        className={cx(
          "absolute right-0 top-0 flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-950 shadow-2xl",
          sizes[size]
        )}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-xl font-black tracking-normal text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <AdminButton type="button" variant="ghost" onClick={onClose} className="h-9 w-9 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="shrink-0 max-h-[30dvh] overflow-auto border-t border-slate-800 px-4 py-4 sm:px-5">{footer}</div> : null}
      </aside>
    </div>, document.body
  );
}

export function AdminDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "lg",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
}) {
  const panelRef = useAdminModal(open, onClose);
  if (!open) return null;

  const sizes = { md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-3xl", "2xl": "max-w-4xl" };
  return createPortal(
    <div className="fixed inset-0 z-[130] grid place-items-center p-4">
      <button type="button" tabIndex={-1} aria-hidden="true" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" />
      <section ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={cx("relative z-10 flex max-h-[calc(100dvh-2rem)] min-w-0 w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl", sizes[size])}>
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-xl font-black tracking-normal text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <AdminButton type="button" variant="ghost" onClick={onClose} className="h-9 w-9 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 max-h-[30dvh] overflow-auto border-t border-slate-800 px-5 py-4">{footer}</div> : null}
      </section>
    </div>, document.body
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-slate-800">{children}</div>;
}

export function AdminTableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function AdminSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-black tracking-normal text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
