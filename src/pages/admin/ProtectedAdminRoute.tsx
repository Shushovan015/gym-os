import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@src/Client/supabase";

export default function ProtectedAdminRoute() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
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
  return <Outlet />;
}
