import { useEffect, useMemo } from "react";
import type { ElementType } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Users,
} from "lucide-react";
import { getContactRequest } from "@src/redux/actions/contact";
import { PageRoot, Section, Surface, SurfaceSoft, PrimaryCTA, SecondaryCTA } from "./PageKit";

type SummaryCard = {
  label: string;
  value: string;
  icon: string;
};

type ContactContent = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  cta_primary_text: string;
  cta_primary_link: string;
  cta_secondary_text: string;
  cta_secondary_link: string;
  phone: string;
  email: string;
  hours: string;
  location: string;
  map_embed_url: string;
  visit_text: string;
  form_note: string;
  info_title: string;
  info_description: string;
  form_title: string;
  form_description: string;
  form_button_text: string;
  faq_title: string;
  faq_description: string;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
  summary_cards: SummaryCard[];
};

const iconMap: Record<string, ElementType> = {
  MessageCircle,
  Clock3,
  Users,
  MapPin,
};

const fallback: ContactContent = {
  hero_badge: "Contact A&A Health Club",
  hero_title: "Let us plan your fitness journey",
  hero_description:
    "Reach out for membership details, coach consultation, or a free trial booking.",
  hero_image:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1800&auto=format&fit=crop",
  cta_primary_text: "Book trial",
  cta_primary_link: "/contact",
  cta_secondary_text: "View pricing",
  cta_secondary_link: "/pricing",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  hours: "Daily, 5:00 AM - 9:00 PM",
  location: "Butwal, Rupandehi, Nepal",
  map_embed_url: "",
  visit_text: "Visit during operating hours for a guided walkthrough.",
  form_note: "Form is currently UI-only. Connect backend/email next.",
  info_title: "Direct Contact",
  info_description:
    "Call, email, or visit the gym. We usually respond quickly during operating hours.",
  form_title: "Send us a message",
  form_description: "Share your goal and schedule. Our team will suggest the right plan.",
  form_button_text: "Submit inquiry",
  faq_title: "Frequently asked questions",
  faq_description: "Quick answers before you visit or join.",
  bottom_cta_title: "Ready to train with us?",
  bottom_cta_description: "Book a trial or explore membership options.",
  bottom_primary_cta_text: "Book trial session",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "See memberships",
  bottom_secondary_cta_link: "/pricing",
  summary_cards: [],
};

const fallbackSummaryCards: SummaryCard[] = [
  { label: "Response Time", value: "< 24 hrs", icon: "MessageCircle" },
  { label: "Open Daily", value: "5AM - 9PM", icon: "Clock3" },
  { label: "Coaches Available", value: "3+", icon: "Users" },
  { label: "Location", value: "Butwal", icon: "MapPin" },
];

export default function Contact() {
  const dispatch = useDispatch();
  const { content, faqs, loading, error } = useSelector(
    (s: any) => s.contact ?? { content: null, faqs: [], loading: false, error: null }
  );

  useEffect(() => {
    dispatch(getContactRequest());
  }, [dispatch]);

  const c: ContactContent = { ...fallback, ...(content || {}) };

  const summaryCards = useMemo(() => {
    const raw = Array.isArray(c.summary_cards) ? c.summary_cards : [];
    return raw.length
      ? raw.map((card) => ({
          label: card?.label || "",
          value: card?.value || "",
          icon: card?.icon || "MessageCircle",
        }))
      : fallbackSummaryCards;
  }, [c.summary_cards]);

  const contactCards = [
    { label: "Phone", value: c.phone, icon: Phone, href: `tel:${c.phone}` },
    { label: "Email", value: c.email, icon: Mail, href: `mailto:${c.email}` },
    { label: "Hours", value: c.hours, icon: Clock3 },
    { label: "Location", value: c.location, icon: Navigation },
  ];

  return (
    <PageRoot>
      <Section>
        <div className="surface-card relative overflow-hidden p-0">
          <img
            src={c.hero_image}
            alt="Contact A&A"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.45] saturate-[0.85]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/45" />

          <div className="relative z-10 p-7 sm:p-9 lg:p-10">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="label-chip">{c.hero_badge}</div>
                <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                  {c.hero_title}
                </h1>
                <p className="mt-4 max-w-2xl text-zinc-200 leading-relaxed">{c.hero_description}</p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <PrimaryCTA to={c.cta_primary_link || "/contact"}>{c.cta_primary_text}</PrimaryCTA>
                  <SecondaryCTA to={c.cta_secondary_link || "/pricing"}>
                    {c.cta_secondary_text}
                  </SecondaryCTA>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {summaryCards.map((card, idx) => {
                  const Icon = iconMap[card.icon] || MessageCircle;
                  return (
                    <div
                      key={`${card.label}-${idx}`}
                      className="rounded-xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <Icon className="h-5 w-5 text-accent" />
                      <div className="mt-3 text-2xl font-bold text-white">{card.value}</div>
                      <div className="text-xs text-zinc-300">{card.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        {loading ? <Surface className="text-zinc-300">Loading contact info...</Surface> : null}
        {error ? <Surface className="text-red-300">{error}</Surface> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <SurfaceSoft className="p-6">
            <h2 className="text-2xl font-bold text-white">{c.info_title}</h2>
            <p className="mt-2 text-sm text-muted">{c.info_description}</p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contactCards.map((card) => (
                <article key={card.label} className="surface-card-soft p-4">
                  <card.icon className="h-4 w-4 text-accent" />
                  <div className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-400">{card.label}</div>
                  {card.href ? (
                    <a href={card.href} className="mt-1 block text-sm font-semibold text-white hover:text-accent transition">
                      {card.value}
                    </a>
                  ) : (
                    <div className="mt-1 text-sm font-semibold text-white">{card.value}</div>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-line/10 bg-black/30 p-4">
              <div className="text-sm text-zinc-200">{c.visit_text}</div>
            </div>

            <div className="mt-5 rounded-xl overflow-hidden border border-line/10 bg-white/5 h-60">
              {c.map_embed_url ? (
                <iframe
                  title="Gym location map"
                  src={c.map_embed_url}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-sm text-zinc-300">
                  Add Google Maps embed URL in Admin Contact
                </div>
              )}
            </div>
          </SurfaceSoft>

          <Surface className="p-6">
            <h2 className="text-2xl font-bold text-white">{c.form_title}</h2>
            <p className="mt-2 text-sm text-muted">{c.form_description}</p>

            <form className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Full name"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                  placeholder="Phone number"
                />
                <input
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                  placeholder="Email address"
                />
              </div>
              <textarea
                rows={5}
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-400 outline-none focus:bg-white/15"
                placeholder="Tell us your goal, experience, and preferred training time"
              />
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-black text-black hover:bg-accent2 transition"
              >
                {c.form_button_text}
                <Send className="h-4 w-4" />
              </button>
              <p className="text-xs text-zinc-400">{c.form_note}</p>
            </form>
          </Surface>
        </div>
      </Section>

      <Section>
        <Surface>
          <h3 className="text-3xl font-bold text-white">{c.faq_title}</h3>
          <p className="mt-2 text-muted">{c.faq_description}</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(faqs || []).length ? (
              (faqs || []).map((f: any) => (
                <article key={f.id} className="surface-card-soft p-5">
                  <h4 className="text-base font-bold text-white">{f.question}</h4>
                  <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{f.answer}</p>
                </article>
              ))
            ) : (
              <div className="text-sm text-zinc-400">No FAQs added yet.</div>
            )}
          </div>
        </Surface>
      </Section>

      <Section className="pb-10">
        <Surface className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h3 className="text-3xl font-bold text-white">{c.bottom_cta_title}</h3>
            <p className="mt-2 text-muted">{c.bottom_cta_description}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryCTA to={c.bottom_primary_cta_link || "/contact"}>
              {c.bottom_primary_cta_text}
            </PrimaryCTA>
            <SecondaryCTA to={c.bottom_secondary_cta_link || "/pricing"}>
              {c.bottom_secondary_cta_text}
            </SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
