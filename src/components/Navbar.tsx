import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import logo from "../assets/logo.jpg";

type NavItem = { label: string; to: string; end?: boolean };

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={[
        "sticky top-0 z-[60] border-b transition-all duration-300",
        scrolled
          ? "border-line/20 bg-[#080d14]/88 shadow-[0_14px_38px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
          : "border-line/10 bg-[#070c13]/72 backdrop-blur-xl",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />

      <div className="section-pad w-full">
        <div className="flex h-16 items-center justify-between gap-3">
          <NavLink to="/" className="group flex min-w-[220px] items-center gap-3" aria-label="Go to home">
            <div className="relative">
              <img
                src={logo}
                alt="A&A Health Club"
                className="h-10 w-10 rounded-full object-cover ring-1 ring-white/25 transition group-hover:ring-accent/60"
              />
              <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-accent/15 via-transparent to-accent2/20" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-white">A&A HEALTH CLUB</div>
              <div className="text-xs text-zinc-300">Butwal, Rupandehi</div>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-1 rounded-2xl border border-line/20 bg-white/[0.04] p-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "relative rounded-xl px-4 py-2 text-sm font-semibold transition",
                    isActive ? "text-white" : "text-zinc-300 hover:bg-white/10 hover:text-white",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative z-10">{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-pill"
                        transition={
                          reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                        }
                        className="absolute inset-0 rounded-xl border border-white/20 bg-white/12"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden min-w-[220px] items-center justify-end gap-2 lg:flex">
            <NavLink
              to="/contact"
              className="rounded-xl border border-line/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Contact
            </NavLink>
            <NavLink
              to="/pricing"
              className="group relative inline-flex items-center gap-1 overflow-hidden rounded-xl bg-accent px-4 py-2 text-sm font-black text-black transition hover:bg-accent2"
            >
              <span className="absolute left-[-55%] top-0 h-full w-[45%] -skew-x-12 bg-white/40 transition-all duration-500 group-hover:left-[120%]" />
              <span className="relative">Join Now</span>
              <ChevronRight className="relative h-4 w-4" />
            </NavLink>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line/20 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line/20 lg:hidden"
          >
            <div className="section-pad py-3">
              <div className="rounded-2xl border border-line/20 bg-[#0b111a]/95 p-2 backdrop-blur-xl">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        "block rounded-xl px-4 py-3 text-sm font-semibold transition",
                        isActive ? "bg-white text-black" : "text-zinc-200 hover:bg-white/10 hover:text-white",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NavLink
                    to="/contact"
                    className="rounded-xl border border-line/20 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Contact
                  </NavLink>
                  <NavLink
                    to="/pricing"
                    className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-black text-black transition hover:bg-accent2"
                  >
                    Join Now
                  </NavLink>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
