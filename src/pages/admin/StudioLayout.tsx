import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@src/Client/supabase";
import { phpSignOut, usePhpApi } from "@src/Client/phpApi";
import { AdminButton } from "@src/components/admin/AdminUI";

const editors = [
  ["Overview", "/studio"],
  ["Homepage", "/studio/home"],
  ["Facilities", "/studio/facilities"],
  ["Trainers & training plans", "/studio/trainers"],
  ["Membership pricing", "/studio/pricing"],
  ["Pro Shop catalog", "/studio/proshop"],
  ["Testimonials", "/studio/testimonials"],
  ["Contact & FAQs", "/studio/contact"],
  ["Footer", "/studio/footer"],
];

export default function StudioLayout() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      if (usePhpApi) await phpSignOut();
      else {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      }
      navigate("/admin/login", { replace: true });
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b101a] text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/studio" className="font-bold text-sky-200">A&A Website Studio</Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link className="py-2 hover:underline" to="/">View public website</Link>
            <Link className="py-2 hover:underline" to="/admin">Gym Operations</Link>
            <AdminButton variant="secondary" onClick={signOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </AdminButton>
          </div>
          {error && <p role="alert" className="w-full text-sm text-rose-300">{error}</p>}
        </div>
      </header>
      <div className="mx-auto max-w-screen-2xl lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Website Studio navigation" className="flex flex-wrap gap-1 border-b border-slate-800 p-4 lg:flex-col lg:border-b-0 lg:border-r">
          {editors.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-sky-950 text-sky-100" : "text-slate-300 hover:bg-slate-800"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 px-4 py-6 sm:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
