import { APP_BRANDING } from "@src/config/branding";

export default function DeveloperCredit({ collapsed = false }: { collapsed?: boolean }) {
  const year = new Date().getFullYear();
  if (collapsed) {
    return <div className="flex justify-center border-t border-slate-800 pt-3" title={`${APP_BRANDING.developerLabel} ${APP_BRANDING.developerName} · © ${year} Gym Management System`}><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-[10px] font-bold tracking-wide text-slate-500">SS</span></div>;
  }
  return (
    <footer className="border-t border-slate-700 pt-3 text-center text-xs leading-5 text-slate-400">
      <div className="font-medium">{APP_BRANDING.developerLabel}</div>
      <div className="font-bold text-slate-200">{APP_BRANDING.developerName}</div>
      <div className="mt-1 text-[11px] text-slate-500">© {year} Gym Management System</div>
    </footer>
  );
}
