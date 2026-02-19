import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X, ChevronRight } from "lucide-react";
import logo from "../assets/logo.jpg";

type NavItem = { label: string; to: string; end?: boolean };

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Home", to: "/", end: true },
      { label: "About", to: "/about" },
      { label: "Facilities", to: "/facilities" },
      { label: "Trainers", to: "/trainers" },
      { label: "Pricing", to: "/pricing" },
      { label: "Pro Shop", to: "/shop" },
      { label: "Contact", to: "/contact" },
    ],
    []
  );

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line/20 bg-[#070c13]/85 backdrop-blur-xl">
      <div className="w-full px-6 lg:px-12 xl:px-20">
        <div className="h-16 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-3 min-w-[210px]" aria-label="Go to home">
            <img src={logo} alt="A&A Health Club" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20" />
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-white">A&A HEALTH CLUB</div>
              <div className="text-xs text-zinc-300">Butwal, Rupandehi</div>
            </div>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-1 rounded-2xl border border-line/20 bg-white/5 p-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "px-4 py-2 rounded-xl text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-black"
                      : "text-zinc-200 hover:text-white hover:bg-white/10",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2 min-w-[220px] justify-end">
            <NavLink
              to="/contact"
              className="rounded-xl border border-line/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Contact
            </NavLink>
            <NavLink
              to="/pricing"
              className="inline-flex items-center gap-1 rounded-xl bg-accent px-4 py-2 text-sm font-black text-black hover:bg-accent2 transition"
            >
              Join Now
              <ChevronRight className="h-4 w-4" />
            </NavLink>
          </div>

          <button
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-line/20 bg-white/5 text-white hover:bg-white/10 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden px-6 lg:px-12 xl:px-20 pb-4">
          <div className="rounded-2xl border border-line/20 bg-[#0b111a]/95 p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "block px-4 py-3 rounded-xl text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-black"
                      : "text-zinc-200 hover:bg-white/10 hover:text-white",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <NavLink
                to="/contact"
                className="rounded-xl border border-line/20 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Contact
              </NavLink>
              <NavLink
                to="/pricing"
                className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-black text-black hover:bg-accent2 transition"
              >
                Join Now
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
