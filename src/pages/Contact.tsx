import { useEffect, useMemo, useState } from "react";
import type { ElementType, FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  CheckCircle2,
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
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ImageFrame,
  LoadingState,
  PageRoot,
  PrimaryCTA,
  PublicSEO,
  Section,
  SectionHeading,
  SecondaryCTA,
  Surface,
} from "./PageKit";

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

type FaqRow = {
  id: number;
  question: string;
  answer: string;
  is_active?: boolean;
};

type ContactState = {
  contact?: {
    content?: Partial<ContactContent> | null;
    faqs?: FaqRow[];
    loading?: boolean;
    error?: string | null;
  };
};

type ContactForm = {
  name: string;
  phone: string;
  email: string;
  message: string;
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
  summary_cards: [
    { label: "Response Time", value: "< 24 hrs", icon: "MessageCircle" },
    { label: "Open Daily", value: "5AM - 9PM", icon: "Clock3" },
    { label: "Coaches Available", value: "3+", icon: "Users" },
    { label: "Location", value: "Butwal", icon: "MapPin" },
  ],
};

function normalizeSummaryCards(value: SummaryCard[] | undefined) {
  const cards = Array.isArray(value) ? value : [];
  const cleaned = cards
    .map((card) => ({
      label: String(card?.label ?? "").trim(),
      value: String(card?.value ?? "").trim(),
      icon: String(card?.icon ?? "MessageCircle").trim() || "MessageCircle",
    }))
    .filter((card) => card.label && card.value);

  return cleaned.length ? cleaned : fallback.summary_cards;
}

function contactHref(kind: "phone" | "email", value: string) {
  const cleanValue = value.trim();
  if (!cleanValue || cleanValue.includes("X")) return "";
  return kind === "phone"
    ? `tel:${cleanValue.replace(/[^\d+]/g, "")}`
    : `mailto:${cleanValue}`;
}

export default function Contact() {
  const dispatch = useDispatch();
  const { content, faqs = [], loading = false, error = null } = useSelector(
    (state: ContactState) => state.contact ?? {}
  );
  const [form, setForm] = useState<ContactForm>({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    dispatch(getContactRequest());
  }, [dispatch]);

  const page = { ...fallback, ...(content || {}) };
  const summaryCards = useMemo(
    () => normalizeSummaryCards(page.summary_cards),
    [page.summary_cards]
  );
  const activeFaqs = faqs.filter((faq) => faq.is_active !== false);
  const phoneHref = contactHref("phone", page.phone);
  const emailHref = contactHref("email", page.email);

  const contactCards = [
    { label: "Phone", value: page.phone, icon: Phone, href: phoneHref },
    { label: "Email", value: page.email, icon: Mail, href: emailHref },
    { label: "Hours", value: page.hours, icon: Clock3 },
    { label: "Location", value: page.location, icon: Navigation },
  ];

  const updateForm = (key: keyof ContactForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setFormMessage("");
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      setFormMessage("");
      setFormError("Name, phone and message are required before we can guide you.");
      return;
    }

    setFormError("");
    setFormMessage(
      "Your inquiry details are ready, but online submission is not connected yet. Please call or email the gym team using the contact details on this page."
    );
  };

  return (
    <PageRoot>
      <PublicSEO
        title="Contact A&A Health Club | Trial Sessions and Membership Help"
        description="Contact A&A Health Club in Butwal for gym visits, trial sessions, coaching questions and membership support."
      />

      <Section animated={false} className="pt-10 sm:pt-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="accent">{page.hero_badge}</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-6xl">
              {page.hero_title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)]">
              {page.hero_description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.cta_primary_link || "/contact"}>{page.cta_primary_text}</PrimaryCTA>
              <SecondaryCTA to={page.cta_secondary_link || "/pricing"}>{page.cta_secondary_text}</SecondaryCTA>
            </div>
          </div>

          <div className="space-y-4">
            <ImageFrame
              src={page.hero_image}
              alt="A&A Health Club contact"
              className="aspect-[4/3]"
              loading="eager"
            />
            <div className="grid grid-cols-2 gap-3">
              {summaryCards.slice(0, 4).map((card) => {
                const Icon = iconMap[card.icon] || MessageCircle;
                return (
                  <Card key={card.label}>
                    <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                    <div className="mt-3 text-xl font-semibold text-[var(--public-text)]">{card.value}</div>
                    <div className="text-xs text-[var(--public-muted)]">{card.label}</div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading
          eyebrow="Visit or Message"
          title={page.info_title}
          description={page.info_description}
        />

        {loading ? <LoadingState label="Loading contact details..." /> : null}
        {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Surface>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contactCards.map((card) => (
                <Card key={card.label} className="h-full">
                  <card.icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--public-muted)]">
                    {card.label}
                  </div>
                  {card.href ? (
                    <a
                      href={card.href}
                      className="mt-1 block break-words text-sm font-semibold text-[var(--public-text)] transition hover:text-[var(--public-accent-strong)]"
                    >
                      {card.value}
                    </a>
                  ) : (
                    <div className="mt-1 break-words text-sm font-semibold text-[var(--public-text)]">
                      {card.value}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--public-line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--public-muted)]">
              {page.visit_text}
            </div>

            <div className="mt-5 h-72 overflow-hidden rounded-2xl border border-[var(--public-line)] bg-[#11100e]">
              {page.map_embed_url ? (
                <iframe
                  title="A&A Health Club location map"
                  src={page.map_embed_url}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="grid h-full place-items-center px-5 text-center text-sm text-[var(--public-muted)]">
                  Add the Google Maps embed URL from the existing admin Contact content.
                </div>
              )}
            </div>
          </Surface>

          <Surface>
            <Badge>Inquiry</Badge>
            <h2 className="mt-4 text-3xl font-semibold text-[var(--public-text)]">{page.form_title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{page.form_description}</p>

            <form className="mt-6 space-y-4" onSubmit={submitForm}>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--public-muted)]">Full name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[var(--public-line)] bg-[#11100e] px-4 text-sm text-[var(--public-text)] placeholder:text-[var(--public-muted)]"
                  placeholder="Your name"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--public-muted)]">Phone number</span>
                  <input
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-[var(--public-line)] bg-[#11100e] px-4 text-sm text-[var(--public-text)] placeholder:text-[var(--public-muted)]"
                    placeholder="98..."
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--public-muted)]">Email address</span>
                  <input
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-[var(--public-line)] bg-[#11100e] px-4 text-sm text-[var(--public-text)] placeholder:text-[var(--public-muted)]"
                    placeholder="you@example.com"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--public-muted)]">Training goal</span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateForm("message", event.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-xl border border-[var(--public-line)] bg-[#11100e] px-4 py-3 text-sm text-[var(--public-text)] placeholder:text-[var(--public-muted)]"
                  placeholder="Tell us your goal, experience level and preferred training time"
                />
              </label>

              {formError ? (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100" role="alert">
                  {formError}
                </div>
              ) : null}
              {formMessage ? (
                <div className="flex gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100" role="status">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formMessage}</span>
                </div>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--public-accent)] px-5 py-3 text-sm font-extrabold text-[#14110d] transition hover:bg-[var(--public-accent-strong)]"
              >
                {page.form_button_text}
                <Send className="h-4 w-4" />
              </button>
              <p className="text-xs leading-5 text-[var(--public-muted)]">{page.form_note}</p>
            </form>
          </Surface>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="FAQ"
          title={page.faq_title}
          description={page.faq_description}
        />
        {activeFaqs.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeFaqs.map((faq) => (
              <Card key={faq.id}>
                <h3 className="text-lg font-semibold text-[var(--public-text)]">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{faq.answer}</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No FAQs added yet" description="FAQs can be managed from the existing admin Contact tools." />
        )}
      </Section>

      <Section className="pt-0">
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--public-text)]">{page.bottom_cta_title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">
                {page.bottom_cta_description}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.bottom_primary_cta_link || "/contact"}>{page.bottom_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.bottom_secondary_cta_link || "/pricing"}>{page.bottom_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
