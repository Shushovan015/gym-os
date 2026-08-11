import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Phone, X } from "lucide-react";
import { useAppReducedMotion } from "@src/motion/preferences";
import logo from "../assets/logo.jpg";

type NavItem = { label: string; to: string; end?: boolean };

const navItems: NavItem[] = [
  { label: "Home", to: "/", end: true },
  { label: "About", to: "/about" },
  { label: "Facilities", to: "/facilities" },
  { label: "Trainers", to: "/trainers" },
  { label: "Pricing", to: "/pricing" },
  { label: "Pro Shop", to: "/shop" },
  { label: "Contact", to: "/contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useAppReducedMotion();
  const location = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeLabel = useMemo(() => {
    const match = navItems.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
    return match?.label ?? "A&A Health Club";
  }, [location.pathname]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
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
        "sticky top-0 z-[70] border-b transition-colors duration-200",
        scrolled
          ? "border-[var(--public-line)] bg-[#11100e]/92 backdrop-blur-xl"
          : "border-transparent bg-[#11100e]/78 backdrop-blur-md",
      ].join(" ")}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex min-w-0 items-center gap-3" aria-label="A&A Health Club home">
          <img src={logo} alt="A&A Health Club" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[var(--public-line-strong)]" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold tracking-wide text-[var(--public-text)]">A&A Health Club</div>
            <div className="truncate text-xs text-[var(--public-muted)]">Butwal, Rupandehi</div>
          </div>
        </NavLink>

        <nav className="hidden items-center gap-1 rounded-full border border-[var(--public-line)] bg-white/[0.025] p-1 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "relative rounded-full px-4 py-2 text-sm font-semibold transition",
                  isActive ? "text-[#14110d]" : "text-[var(--public-muted)] hover:text-[var(--public-text)]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative z-10">{item.label}</span>
                  {isActive ? (
                    <motion.span
                      layoutId="public-nav-active"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
                      className="absolute inset-0 rounded-full bg-[var(--public-accent)]"
                    />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <NavLink
            to="/contact"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-muted)] transition hover:border-[var(--public-accent)] hover:text-[var(--public-text)]"
            aria-label="Open contact options"
          >
            <Phone className="h-4 w-4" />
          </NavLink>
          <NavLink
            to="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--public-accent)] px-5 py-3 text-sm font-extrabold text-[#14110d] transition hover:bg-[var(--public-accent-strong)]"
          >
            Book a Free Trial
          </NavLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-text)] transition hover:border-[var(--public-accent)] lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[90] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <motion.aside
              initial={reduceMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-[min(88vw,360px)] flex-col border-l border-[var(--public-line)] bg-[#11100e] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-extrabold text-[var(--public-text)]">A&A Health Club</div>
                  <div className="text-xs text-[var(--public-muted)]">Currently: {activeLabel}</div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-text)]"
                  aria-label="Close navigation menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-8 space-y-2" aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        "block rounded-xl px-4 py-3 text-base font-semibold transition",
                        isActive
                          ? "bg-[var(--public-accent)] text-[#14110d]"
                          : "border border-[var(--public-line)] text-[var(--public-text)] hover:border-[var(--public-accent)]",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto grid grid-cols-1 gap-3 pt-6">
                <NavLink
                  to="/contact"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--public-line)] px-5 py-3 text-sm font-semibold text-[var(--public-text)]"
                >
                  <Phone className="h-4 w-4" />
                  Contact Options
                </NavLink>
                <NavLink
                  to="/contact"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--public-accent)] px-5 py-3 text-sm font-extrabold text-[#14110d]"
                >
                  Book a Free Trial
                </NavLink>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
