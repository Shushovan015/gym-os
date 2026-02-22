import { NavLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Youtube,
} from "lucide-react";
import { getFooterRequest } from "@src/redux/actions/footer";
import { useAppReducedMotion } from "@src/motion/preferences";
import logo from "../assets/logo.jpg";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "Facilities", to: "/facilities" },
  { label: "Trainers", to: "/trainers" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
  { label: "Pro Shop", to: "/shop" },
  { label: "Contact", to: "/contact" },
];

const defaults = {
  brand_name: "A&A HEALTH CLUB",
  location: "Butwal, Rupandehi",
  banner_title: "Premium training environment in Butwal",
  banner_subtitle: "Serious coaching, clean facilities, and structured progress.",
  cta_text: "Book a free trial",
  cta_link: "/contact",
  about_text:
    "Built for transformation through elite coaching, premium equipment, and a results-driven culture.",
  hours_text: "Daily, 5:00 AM - 9:00 PM",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  copyright_text: "(c) A&A Health Club. All rights reserved.",
  bottom_tags: "Strength | Conditioning | Coaching",
};

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "Facebook", href: "https://facebook.com", icon: Facebook },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

export default function Footer() {
  const dispatch = useDispatch();
  const reduceMotion = useAppReducedMotion();

  const { item, loading } = useSelector(
    (s: any) => s.footer ?? { item: null, loading: false, error: null }
  );

  useEffect(() => {
    dispatch(getFooterRequest());
  }, [dispatch]);

  const content = { ...defaults, ...(item || {}) };
  const year = new Date().getFullYear();

  const tags = useMemo(
    () =>
      String(content.bottom_tags || "")
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean),
    [content.bottom_tags]
  );

  const telHref = `tel:${String(content.phone || "").replace(/[^\d+]/g, "")}`;
  const mailHref = `mailto:${content.email || ""}`;
  const hasYearInCopyright = new RegExp(String(year)).test(String(content.copyright_text || ""));

  return (
    <footer className="section-pad mt-20 pb-10">
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[30px] border border-line/20 bg-[#060b12]"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-accent2/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_55%)]" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="surface-premium rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="label-chip inline-flex items-center gap-2 !text-zinc-200">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {content.brand_name}
                </div>
                <h3 className="premium-heading mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {content.banner_title}
                </h3>
                <p className="mt-2 text-sm text-zinc-300">{content.banner_subtitle}</p>
              </div>

              <NavLink
                to={content.cta_link || "/contact"}
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                {content.cta_text}
                <ArrowUpRight className="h-4 w-4" />
              </NavLink>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="A&A Health Club"
                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/20"
                />
                <div>
                  <div className="font-black tracking-tight text-white">{content.brand_name}</div>
                  <div className="text-sm text-zinc-300">{content.location}</div>
                </div>
              </div>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-300">{content.about_text}</p>
              {loading ? <p className="mt-3 text-xs text-zinc-500">Updating footer...</p> : null}

              <div className="mt-4 flex gap-2">
                {socialLinks.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.label}
                      className="tilt-card card-glow inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line/20 bg-white/5 text-zinc-200 transition hover:text-white"
                    >
                      <span className="tilt-content">
                        <Icon className="h-4 w-4" />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="text-sm font-bold uppercase tracking-[0.12em] text-zinc-200">Quick Links</div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {quickLinks.map((itemLink) => (
                  <NavLink
                    key={itemLink.to}
                    to={itemLink.to}
                    className="text-sm text-zinc-300 transition hover:text-white"
                  >
                    {itemLink.label}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="space-y-3 lg:col-span-4">
              <div className="tilt-card card-glow rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <div className="tilt-content">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Clock3 className="h-3.5 w-3.5" />
                    Hours
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">{content.hours_text}</div>
                </div>
              </div>

              <a href={telHref} className="tilt-card card-glow block rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <span className="tilt-content block">
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-zinc-100">{content.phone}</span>
                </span>
              </a>

              <a href={mailHref} className="tilt-card card-glow block rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <span className="tilt-content block">
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-zinc-100">{content.email}</span>
                </span>
              </a>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-line/15 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
              <MapPin className="h-3.5 w-3.5" />
              <span>{content.location}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line/20 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="text-xs text-zinc-500">
              {content.copyright_text}
              {!hasYearInCopyright ? ` ${year}` : ""}
            </div>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
