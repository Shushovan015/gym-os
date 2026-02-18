import { NavLink } from "react-router-dom";
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

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 px-6 lg:px-12 xl:px-20 pb-10">
      <div className="rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-7 sm:p-9">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-300">A&A Health Club</div>
            <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white">
              Premium training environment in Butwal
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              Serious coaching, clean facilities, and structured progress.
            </p>
          </div>

          <NavLink
            to="/contact"
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
          >
            Book a free trial
          </NavLink>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="A&A Health Club"
                className="h-12 w-12 rounded-2xl object-cover"
              />
              <div>
                <div className="font-black tracking-tight text-white">A&amp;A HEALTH CLUB</div>
                <div className="text-sm text-zinc-300">Butwal, Rupandehi</div>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm text-zinc-300 leading-relaxed">
              Built for transformation through elite coaching, premium equipment, and a results-driven culture.
            </p>
          </div>

          <div className="md:col-span-3">
            <div className="text-sm font-bold text-white">Quick links</div>
            <div className="mt-3 grid grid-cols-2 gap-y-2">
              {quickLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="text-sm text-zinc-300 hover:text-white transition"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 space-y-3">
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Hours</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">Daily, 5:00 AM - 9:00 PM</div>
            </div>
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Phone</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">+977 98XXXXXXXX</div>
            </div>
            <div className="rounded-xl bg-black/35 px-4 py-3">
              <div className="text-xs text-zinc-400">Email</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">info@aahealthclub.com</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-400">© {year} A&amp;A Health Club. All rights reserved.</div>
          <div className="text-xs text-zinc-500">Strength • Conditioning • Coaching</div>
        </div>
      </div>
    </footer>
  );
}
