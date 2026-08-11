import { NavLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Clock3, Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { getFooterRequest } from "@src/redux/actions/footer";
import logo from "../assets/logo.jpg";
import { Container, PrimaryCTA } from "./PageKit";

type FooterContent = {
  brand_name: string;
  location: string;
  banner_title: string;
  banner_subtitle: string;
  cta_text: string;
  cta_link: string;
  about_text: string;
  hours_text: string;
  phone: string;
  email: string;
  copyright_text: string;
  bottom_tags: string;
};

type FooterState = {
  footer?: {
    item?: Partial<FooterContent> | null;
    loading?: boolean;
  };
};

const defaults: FooterContent = {
  brand_name: "A&A Health Club",
  location: "Butwal, Rupandehi",
  banner_title: "Train with structure in Butwal",
  banner_subtitle: "Coaching, equipment and a serious environment for consistent progress.",
  cta_text: "Book a free trial",
  cta_link: "/contact",
  about_text: "A disciplined training space for strength, conditioning, coaching and long-term progress.",
  hours_text: "Daily, 5:00 AM - 9:00 PM",
  phone: "+977 98XXXXXXXX",
  email: "info@aahealthclub.com",
  copyright_text: "(c) A&A Health Club. All rights reserved.",
  bottom_tags: "Strength | Conditioning | Coaching",
};

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Facilities", to: "/facilities" },
  { label: "Trainers", to: "/trainers" },
  { label: "Pricing", to: "/pricing" },
  { label: "Pro Shop", to: "/shop" },
  { label: "Contact", to: "/contact" },
];

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "Facebook", href: "https://facebook.com", icon: Facebook },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

export default function Footer() {
  const dispatch = useDispatch();
  const { item, loading } = useSelector((state: FooterState) => state.footer ?? { item: null, loading: false });

  useEffect(() => {
    dispatch(getFooterRequest());
  }, [dispatch]);

  const content: FooterContent = { ...defaults, ...(item || {}) };
  const tags = useMemo(
    () =>
      String(content.bottom_tags || "")
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [content.bottom_tags]
  );
  const year = new Date().getFullYear();
  const phoneHref = `tel:${String(content.phone || "").replace(/[^\d+]/g, "")}`;
  const mailHref = `mailto:${content.email || ""}`;
  const hasYear = new RegExp(String(year)).test(content.copyright_text);

  return (
    <footer className="border-t border-[var(--public-line)] bg-[#0d0c0b]">
      <Container className="py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="A&A Health Club" className="h-12 w-12 rounded-full object-cover ring-1 ring-[var(--public-line-strong)]" />
              <div>
                <div className="font-extrabold text-[var(--public-text)]">{content.brand_name}</div>
                <div className="text-sm text-[var(--public-muted)]">{content.location}</div>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--public-muted)]">{content.about_text}</p>
            {loading ? <p className="mt-3 text-xs text-[var(--public-muted)]">Updating footer...</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--public-line)] px-3 py-1 text-xs text-[var(--public-muted)]">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[var(--public-text)]">Navigate</h2>
            <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="Footer navigation">
              {quickLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className="text-sm text-[var(--public-muted)] transition hover:text-[var(--public-text)]">
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <div className="rounded-2xl border border-[var(--public-line)] bg-white/[0.03] p-5">
              <h2 className="text-xl font-semibold text-[var(--public-text)]">{content.banner_title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{content.banner_subtitle}</p>
              <PrimaryCTA to={content.cta_link || "/contact"} className="mt-5 w-full">
                {content.cta_text}
              </PrimaryCTA>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 border-t border-[var(--public-line)] pt-6 text-sm text-[var(--public-muted)] md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[var(--public-accent-strong)]" />
            {content.hours_text}
          </div>
          <a href={phoneHref} className="flex items-center gap-2 transition hover:text-[var(--public-text)]">
            <Phone className="h-4 w-4 text-[var(--public-accent-strong)]" />
            {content.phone}
          </a>
          <a href={mailHref} className="flex items-center gap-2 transition hover:text-[var(--public-text)]">
            <Mail className="h-4 w-4 text-[var(--public-accent-strong)]" />
            {content.email}
          </a>
        </div>

        <div className="mt-6 flex flex-col gap-4 text-xs text-[var(--public-muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {content.location}
          </div>
          <div className="flex gap-2">
            {socialLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-muted)] transition hover:border-[var(--public-accent)] hover:text-[var(--public-text)]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
          <div>
            {content.copyright_text}
            {!hasYear ? ` ${year}` : ""}
          </div>
        </div>
      </Container>
    </footer>
  );
}
