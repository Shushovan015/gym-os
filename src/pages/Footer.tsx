import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
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
  about_text: "Built for transformation through elite coaching, premium equipment, and a results-driven culture.",
  hours_text: "Daily, 5:00 AM - 9:00 PM",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  copyright_text: "(c) A&A Health Club. All rights reserved.",
  bottom_tags: "Strength | Conditioning | Coaching",
};

export default function Footer() {
  const dispatch = useDispatch();
  const { item } = useSelector((s: any) => s.footer ?? { item: null, loading: false, error: null });

  useEffect(() => {
    dispatch(getFooterRequest());
  }, [dispatch]);

  const content = { ...defaults, ...(item || {}) };
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 px-6 lg:px-12 xl:px-20 pb-10">
      <div className="rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-7 sm:p-9">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-300">{content.brand_name}</div>
            <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white">{content.banner_title}</h3>
            <p className="mt-2 text-sm text-zinc-300">{content.banner_subtitle}</p>
          </div>

          <NavLink
            to={content.cta_link || "/contact"}
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
          >
            {content.cta_text}
          </NavLink>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <img src={logo} alt="A&A Health Club" className="h-12 w-12 rounded-2xl object-cover" />
              <div>
                <div className="font-black tracking-tight text-white">{content.brand_name}</div>
                <div className="text-sm text-zinc-300">{content.location}</div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm text-zinc-300 leading-relaxed">{content.about_text}</p>
          </div>

          <div className="md:col-span-3">
            <div className="text-sm font-bold text-white">Quick links</div>
            <div className="mt-3 grid grid-cols-2 gap-y-2">
              {quickLinks.map((itemLink) => (
                <NavLink key={itemLink.to} to={itemLink.to} className="text-sm text-zinc-300 hover:text-white transition">
                  {itemLink.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Hours</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{content.hours_text}</div>
            </div>
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Phone</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{content.phone}</div>
            </div>
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Email</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">{content.email}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-400">{content.copyright_text} {year}</div>
          <div className="text-xs text-zinc-500">{content.bottom_tags}</div>
        </div>
      </div>
    </footer>
  );
}
