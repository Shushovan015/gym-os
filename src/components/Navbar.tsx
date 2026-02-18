import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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

  return (
    <header className="sticky top-0 z-50 bg-[#0d1117]">
      <div className="w-full px-6 lg:px-12 xl:px-20">
        <div className="h-16 flex items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-3 min-w-[220px]" aria-label="Go to home">
            <img src={logo} alt="A&A Health Club" className="h-10 w-10 rounded-full object-cover" />
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-white">A&amp;A HEALTH CLUB</div>
              <div className="text-xs text-white/70">Butwal, Rupandehi</div>
            </div>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "px-4 py-2 rounded-xl text-sm font-semibold transition",
                    isActive ? "text-white bg-white/10" : "text-white/80 hover:text-white hover:bg-white/10",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 min-w-[220px] justify-end">
            <NavLink
              to="/contact"
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition"
            >
              Contact
            </NavLink>
            <NavLink
              to="/pricing"
              className="px-4 py-2 rounded-xl bg-white text-black text-sm font-extrabold hover:bg-white/90 transition"
            >
              Join Now
            </NavLink>
          </div>

          <button
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/10 hover:bg-white/15 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <div className="space-y-1.5">
              <div className="h-0.5 w-5 bg-white/90" />
              <div className="h-0.5 w-5 bg-white/90" />
              <div className="h-0.5 w-5 bg-white/90" />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden px-6 lg:px-12 xl:px-20 pb-4">
          <div className="rounded-2xl bg-black/70 p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "block px-4 py-3 rounded-xl text-sm font-semibold transition",
                    isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
