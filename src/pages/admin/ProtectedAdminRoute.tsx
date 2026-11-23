import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@src/Client/supabase";
import { phpSession, usePhpApi } from "@src/Client/phpApi";

export default function ProtectedAdminRoute() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (usePhpApi) {
      let alive = true;
      phpSession().then(({ user }) => {
        if (alive) setAllowed(user?.role === "admin");
      }).catch(() => {
        if (alive) setAllowed(false);
      }).finally(() => {
        if (alive) setLoading(false);
      });
      return () => { alive = false; };
    }
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setAllowed(data?.role === "admin");
      setLoading(false);
    };

    check();
  }, []);

  if (loading) return <div className="p-6 text-white">Checking admin access...</div>;
  if (!allowed) return <Navigate to="/admin/login" replace />;
  if (usePhpApi && !["/admin", "/admin/members", "/admin/attendance", "/admin/billing", "/admin/inventory", "/admin/reports", "/studio", "/studio/contact", "/studio/footer", "/studio/home", "/studio/facilities"].includes(pathname.replace(/\/$/, ""))) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <p>This workspace is still being migrated.</p>
        <Link className="mt-3 inline-block text-sky-300 underline" to="/admin/members">Open Members</Link>
      </div>
    );
  }
  return <Outlet />;
}
