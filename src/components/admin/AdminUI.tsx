import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { cx } from "@src/pages/admin/adminUtils";
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
  return (
    <input
      {...props}
      className={cx(
        "min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    />
  );
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
  if (!open) return null;
  const sizes = {
    lg: "max-w-lg",
    xl: "max-w-3xl",
    "2xl": "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-[120]">
      <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <aside
        className={cx(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l border-slate-800 bg-slate-950 shadow-2xl",
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-xl font-black tracking-normal text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <AdminButton type="button" variant="ghost" onClick={onClose} className="h-9 w-9 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="border-t border-slate-800 px-4 py-4 sm:px-5">{footer}</div> : null}
      </aside>
    </div>
  );
}

export function AdminDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center p-4">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" />
      <section className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-xl font-black tracking-normal text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <AdminButton type="button" variant="ghost" onClick={onClose} className="h-9 w-9 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </AdminButton>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-slate-800 px-5 py-4">{footer}</div> : null}
      </section>
    </div>
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
