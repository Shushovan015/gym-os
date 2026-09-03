import { APP_BRANDING } from "@src/config/branding";

export default function DeveloperCredit({ collapsed = false }: { collapsed?: boolean }) {
  const year = new Date().getFullYear();
  if (collapsed) {
    return <div className="flex justify-center border-t border-slate-800 pt-3" title={`${APP_BRANDING.developerLabel} ${APP_BRANDING.developerName} · © ${year} Gym Management System`}><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-[10px] font-bold tracking-wide text-slate-500">SS</span></div>;
  }
  return (
    <footer className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-3 text-center leading-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-300">{APP_BRANDING.developerLabel}</div>
      <div className="mt-0.5 text-sm font-extrabold text-white">{APP_BRANDING.developerName}</div>
      <div className="mt-1 text-xs font-medium text-slate-400">© {year} Gym Management System</div>
    </footer>
  );
}
