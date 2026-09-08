import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChartNoAxesCombined,
  CalendarDays,
  Globe2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  PackageSearch,
  ReceiptText,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@src/Client/supabase";
import { AdminButton } from "@src/components/admin/AdminUI";
import { cx } from "./adminUtils";
import DeveloperCredit from "@src/components/branding/DeveloperCredit";
import LoginIntro from "@src/components/branding/LoginIntro";

type AdminNavItem = {
  label: string;
  to: string;
  end?: boolean;
  icon: LucideIcon;
};

type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

const navSections: AdminNavSection[] = [
  {
    label: "Daily work",
    items: [
      { label: "Dashboard", to: "/admin", end: true, icon: BarChart3 },
      { label: "Members", to: "/admin/members", icon: Users },
      { label: "Attendance", to: "/admin/attendance", icon: CalendarDays },
      { label: "Billing", to: "/admin/billing", icon: ReceiptText },
      { label: "Reports", to: "/admin/reports", icon: ChartNoAxesCombined },
      { label: "Inventory", to: "/admin/inventory", icon: PackageSearch },
      { label: "Holidays", to: "/admin/holidays", icon: CalendarDays },
      { label: "Website", to: "/admin/website", icon: Globe2 },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

function AdminNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6" aria-label="Admin navigation">
      {navSections.map((section) => (
        <div key={section.label}>
          {!collapsed ? (
            <div className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {section.label}
            </div>
          ) : null}
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      "group flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "border-amber-400/40 bg-amber-400/12 text-white"
                        : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
                    )
                  }
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem("aa-admin-nav-collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("aa-admin-nav-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      setUser(sessionData.session?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const userLabel = useMemo(() => user?.email ?? "Admin user", [user?.email]);

  const finishLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const logout = () => setLoggingOut(true);

  if (loggingOut) return <LoginIntro statusText="Logging out..." onComplete={finishLogout} />;

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 lg:flex lg:items-start">
      <aside
        className={cx(
          "sticky top-0 z-[90] hidden h-screen shrink-0 self-start overflow-hidden border-r border-slate-800 bg-slate-950/98 transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[276px]"
        )}
      >
        <div className="flex h-full flex-col">
          <div className={cx("flex h-16 items-center border-b border-slate-800 px-4", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed ? (
              <div>
                <div className="text-sm font-black tracking-normal text-white">A&A Admin</div>
                <div className="text-xs text-slate-500">Single gym operations</div>
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/12 text-amber-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            {!collapsed ? (
              <AdminButton
                type="button"
                variant="ghost"
                className="h-9 w-9 p-0"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </AdminButton>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <AdminNav collapsed={collapsed} />
          </div>

          <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-3">
            {collapsed ? (
              <AdminButton
                type="button"
                variant="ghost"
                className="h-10 w-10 p-0"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </AdminButton>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-200">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{userLabel}</div>
                    <div className="text-xs text-slate-500">Admin access</div>
                  </div>
                </div>
                <AdminButton type="button" variant="ghost" className="mt-3 w-full justify-start" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </AdminButton>
              </div>
            )}
            <div className="mt-3"><DeveloperCredit collapsed={collapsed} /></div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[80] border-b border-slate-800 bg-slate-950/88 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <AdminButton type="button" variant="ghost" className="h-10 w-10 p-0 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </AdminButton>
              <div>
                <div className="text-sm font-black text-white lg:hidden">A&A Admin</div>
                <div className="hidden text-xs text-slate-500 sm:block">Butwal gym management workspace</div>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-sm font-semibold text-white">{userLabel}</div>
                <div className="text-xs text-slate-500">Authenticated admin</div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[110] lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col border-r border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
              <div>
                <div className="text-sm font-black text-white">A&A Admin</div>
                <div className="text-xs text-slate-500">Daily operations</div>
              </div>
              <AdminButton type="button" variant="ghost" className="h-9 w-9 p-0" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-4 w-4" />
              </AdminButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <AdminNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-4">
              <div className="truncate text-sm font-semibold text-white">{userLabel}</div>
              <AdminButton type="button" variant="secondary" className="mt-3 w-full justify-start" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </AdminButton>
              <div className="mt-4"><DeveloperCredit /></div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
