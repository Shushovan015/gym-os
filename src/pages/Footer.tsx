import { NavLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowUpRight,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { getFooterRequest } from "@src/redux/actions/footer";
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

export default function Footer() {
  const dispatch = useDispatch();
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

  return (
    <footer className="mt-20 px-6 lg:px-12 xl:px-20 pb-10">
      <div className="relative overflow-hidden rounded-[30px] border border-line/20 bg-[#060b12]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-accent2/20 blur-3xl" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="rounded-2xl border border-white/15 bg-gradient-to-r from-white/10 via-white/5 to-white/10 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-200">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {content.brand_name}
                </div>
                <h3 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {content.banner_title}
                </h3>
                <p className="mt-2 text-sm text-zinc-300">{content.banner_subtitle}</p>
              </div>

              <NavLink
                to={content.cta_link || "/contact"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-black text-black transition hover:bg-accent2"
              >
                {content.cta_text}
                <ArrowUpRight className="h-4 w-4" />
              </NavLink>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3">
                <img src={logo} alt="A&A Health Club" className="h-12 w-12 rounded-2xl object-cover" />
                <div>
                  <div className="font-black tracking-tight text-white">{content.brand_name}</div>
                  <div className="text-sm text-zinc-300">{content.location}</div>
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-300">{content.about_text}</p>
              {loading ? <p className="mt-3 text-xs text-zinc-500">Updating footer...</p> : null}
            </div>

            <div className="lg:col-span-3">
              <div className="text-sm font-bold uppercase tracking-[0.12em] text-zinc-200">
                Quick Links
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-3">
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

            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Clock3 className="h-3.5 w-3.5" />
                  Hours
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{content.hours_text}</div>
              </div>

              <div className="rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{content.phone}</div>
              </div>

              <div className="rounded-xl border border-line/20 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">{content.email}</div>
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-line/15 pt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
              {content.copyright_text} {year}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
