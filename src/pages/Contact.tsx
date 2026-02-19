import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getContactRequest } from "@src/redux/actions/contact";

const fallback = {
  hero_badge: "Contact A&A Health Club",
  hero_title: "Let us plan your fitness journey",
  hero_description: "Reach out for membership details, coach consultation, or a free trial booking. Our team will guide you to the right program.",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  hours: "Daily, 5:00 AM - 9:00 PM",
  location: "Butwal, Rupandehi, Nepal",
  map_embed_url: "",
  visit_text: "Butwal, Rupandehi, Nepal. Visit during operating hours for a guided walkthrough.",
  cta_primary_text: "See pricing",
  cta_primary_link: "/pricing",
  cta_secondary_text: "Meet coaches",
  cta_secondary_link: "/trainers",
  form_note: "Form is currently UI-only. Connect your backend/email next.",
};

export default function Contact() {
  const dispatch = useDispatch();
  const { content, faqs, loading, error } = useSelector(
    (s: any) => s.contact ?? { content: null, faqs: [], loading: false, error: null }
  );

  useEffect(() => {
    dispatch(getContactRequest());
  }, [dispatch]);

  const c = { ...fallback, ...(content || {}) };
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  const contactCards = [
    { label: "Phone", value: c.phone },
    { label: "Email", value: c.email },
    { label: "Hours", value: c.hours },
    { label: "Location", value: c.location },
  ];

  return (
    <div className="space-y-16 pb-10">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            {c.hero_badge}
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">{c.hero_title}</h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">{c.hero_description}</p>
        </div>
      </section>

      <section className={sectionPad}>
        {loading ? <div className="text-zinc-300">Loading contact info...</div> : null}
        {error ? <div className="text-red-300">{error}</div> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {contactCards.map((card) => (
            <div key={card.label} className="rounded-2xl bg-white/6 p-5">
              <div className="text-xs uppercase tracking-[0.15em] text-zinc-400">{card.label}</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article className="rounded-3xl bg-black/35 p-6 sm:p-7">
            <h2 className="text-2xl font-black text-white">Send us a message</h2>
            <p className="mt-2 text-sm text-zinc-300">Fill this form and we will contact you shortly.</p>

            <form className="mt-5 space-y-3">
              <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15" placeholder="Full name" />
              <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15" placeholder="Phone number" />
              <input className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15" placeholder="Email address" />
              <textarea rows={5} className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15" placeholder="Tell us your goal" />
              <button type="button" className="w-full rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90 transition">Submit inquiry</button>
              <p className="text-xs text-zinc-400">{c.form_note}</p>
            </form>
          </article>

          <article className="rounded-3xl bg-white/6 p-6 sm:p-7">
            <h2 className="text-2xl font-black text-white">Visit the club</h2>
            <p className="mt-2 text-zinc-300 leading-relaxed">{c.visit_text}</p>

            <div className="mt-5 rounded-2xl bg-black/35 p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-zinc-400">Map</div>
              <div className="mt-3 h-56 rounded-xl overflow-hidden bg-white/10">
                {c.map_embed_url ? (
                  <iframe title="Gym location map" src={c.map_embed_url} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-sm text-zinc-300">Google Maps embed area</div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link to={c.cta_primary_link} className="rounded-xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center">
                {c.cta_primary_text}
              </Link>
              <Link to={c.cta_secondary_link} className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center">
                {c.cta_secondary_text}
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-black/35 p-6 sm:p-8">
          <h3 className="text-2xl font-black text-white">Frequently asked questions</h3>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(faqs || []).map((f: any) => (
              <article key={f.id} className="rounded-2xl bg-white/6 p-5">
                <h4 className="text-base font-bold text-white">{f.question}</h4>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{f.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
