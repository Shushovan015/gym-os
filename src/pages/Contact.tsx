import { Link } from "react-router-dom";

const contactCards = [
  { label: "Phone", value: "+977 98XXXXXXXX" },
  { label: "Email", value: "info@aahealthclub.com" },
  { label: "Hours", value: "Daily, 5:00 AM - 9:00 PM" },
  { label: "Location", value: "Butwal, Rupandehi, Nepal" },
];

const faqs = [
  {
    q: "Do I need prior gym experience?",
    a: "No. We assess your level and build a safe starting plan from day one.",
  },
  {
    q: "Can I take a trial session?",
    a: "Yes, you can book a trial and tour the facility before choosing a plan.",
  },
  {
    q: "Do you offer personal coaching?",
    a: "Yes. We provide one-on-one and structured coaching programs.",
  },
];

export default function Contact() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-16 pb-10">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            Contact A&amp;A Health Club
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Let us plan your fitness journey
          </h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Reach out for membership details, coach consultation, or a free trial booking.
            Our team will guide you to the right program.
          </p>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {contactCards.map((c) => (
            <div key={c.label} className="rounded-2xl bg-white/6 p-5">
              <div className="text-xs uppercase tracking-[0.15em] text-zinc-400">{c.label}</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{c.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article className="rounded-3xl bg-black/35 p-6 sm:p-7">
            <h2 className="text-2xl font-black text-white">Send us a message</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Fill this form and we will contact you shortly.
            </p>

            <form className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Full name"
              />
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Phone number"
              />
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Email address"
              />
              <textarea
                rows={5}
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Tell us your goal"
              />
              <button
                type="button"
                className="w-full rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90 transition"
              >
                Submit inquiry
              </button>
              <p className="text-xs text-zinc-400">
                Form is currently UI-only. Connect your backend/email next.
              </p>
            </form>
          </article>

          <article className="rounded-3xl bg-white/6 p-6 sm:p-7">
            <h2 className="text-2xl font-black text-white">Visit the club</h2>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Butwal, Rupandehi, Nepal. Visit during operating hours for a guided walkthrough.
            </p>

            <div className="mt-5 rounded-2xl bg-black/35 p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-400">Map</div>
              <div className="mt-3 h-56 rounded-xl bg-white/10 grid place-items-center text-sm text-zinc-300">
                Google Maps embed area
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                to="/pricing"
                className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
              >
                See pricing
              </Link>
              <Link
                to="/trainers"
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center"
              >
                Meet coaches
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-black/35 p-6 sm:p-8">
          <h3 className="text-2xl font-black text-white">Frequently asked questions</h3>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {faqs.map((f) => (
              <article key={f.q} className="rounded-2xl bg-white/6 p-5">
                <h4 className="text-base font-bold text-white">{f.q}</h4>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{f.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
