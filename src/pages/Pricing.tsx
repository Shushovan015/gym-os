import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, ChevronRight, Crown, ShieldCheck, Sparkles, Zap, Dumbbell, Trophy, Users } from "lucide-react";
import { getPricingRequest } from "@src/redux/actions/pricing";
import { PageRoot, Section, Surface, SurfaceSoft, PrimaryCTA, SecondaryCTA } from "./PageKit";

type PricingItem = {
  id: number;
  kind: "plan" | "perk";
  title: string;
  price: string;
  cadence: string;
  subtitle: string;
  is_highlighted: boolean;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

type SummaryCard = {
  label: string;
  value: string;
  icon: string;
};

type PageContent = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  summary_cards: SummaryCard[];
  benefits_title: string;
  benefits_description: string;
  advisor_title: string;
  advisor_description: string;
  advisor_cta_text: string;
  advisor_cta_link: string;
  popular_badge_text: string;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
};

const iconMap: Record<string, React.ElementType> = {
  Crown,
  Sparkles,
  ShieldCheck,
  Zap,
  Dumbbell,
  Trophy,
  Users,
};

const fallbackPlans: PricingItem[] = [
  {
    id: -1,
    kind: "plan",
    title: "Starter",
    price: "Rs 2,500",
    cadence: "/month",
    subtitle: "Best for beginners building consistency",
    is_highlighted: false,
    features: ["Gym access", "Basic trainer guidance", "Locker room"],
    sort_order: 1,
    is_active: true,
  },
  {
    id: -2,
    kind: "plan",
    title: "Performance",
    price: "Rs 3,500",
    cadence: "/month",
    subtitle: "For members focused on progression",
    is_highlighted: true,
    features: ["Everything in Starter", "Program check-ins", "Priority floor support"],
    sort_order: 2,
    is_active: true,
  },
  {
    id: -3,
    kind: "plan",
    title: "Elite",
    price: "Rs 5,500",
    cadence: "/month",
    subtitle: "For serious training and performance goals",
    is_highlighted: false,
    features: ["Everything in Performance", "Personalized planning", "Advanced support"],
    sort_order: 3,
    is_active: true,
  },
];

const fallbackPerks = [
  "Clean, disciplined training environment",
  "Professional coaching team",
  "Premium strength equipment",
  "Flexible upgrade options",
];

const fallbackContent: PageContent = {
  hero_badge: "Membership Plans",
  hero_title: "Transparent pricing for premium training",
  hero_description: "Choose the plan that matches your training intensity. Upgrade anytime as your goals evolve.",
  hero_primary_cta_text: "Get custom plan",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "Talk to a coach",
  hero_secondary_cta_link: "/trainers",
  summary_cards: [],
  benefits_title: "What you get",
  benefits_description: "Every membership includes core gym access and a serious training environment.",
  advisor_title: "Need plan matching?",
  advisor_description: "Tell us your goal and schedule. We will recommend the right package.",
  advisor_cta_text: "Contact team",
  advisor_cta_link: "/contact",
  popular_badge_text: "Most Popular",
  bottom_cta_title: "Need a custom offer for your goal?",
  bottom_cta_description: "Get a personalized recommendation based on your training level and timeline.",
  bottom_primary_cta_text: "Get custom plan",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "Meet trainers",
  bottom_secondary_cta_link: "/trainers",
};

function resolveTokens(value: string, plans: number, perks: number, popular: string) {
  return value
    .replaceAll("{plans}", String(plans))
    .replaceAll("{perks}", String(perks))
    .replaceAll("{popular}", popular || "-");
}

export default function Pricing() {
  const dispatch = useDispatch();
  const { items, content, loading, error } = useSelector(
    (s: any) => s.pricing ?? { items: [], content: null, loading: false, error: null }
  );

  const page: PageContent = { ...fallbackContent, ...(content || {}) };

  const pricingItems: PricingItem[] = Array.isArray(items) ? items : [];
  const plansRaw = pricingItems
    .filter((i) => i.kind === "plan" && i.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
  const perksRaw = pricingItems
    .filter((i) => i.kind === "perk" && i.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  const plans = plansRaw.length ? plansRaw : fallbackPlans;
  const perks = perksRaw.length ? perksRaw.map((p) => p.title) : fallbackPerks;

  const popularPlan = useMemo(
    () => plans.find((p) => p.is_highlighted)?.title || plans[0]?.title || "",
    [plans]
  );

  const summaryCards = useMemo(() => {
    const raw = Array.isArray(page.summary_cards) ? page.summary_cards : [];
    const base =
      raw.length > 0
        ? raw
        : [
            { label: "Membership Tiers", value: "{plans}", icon: "Crown" },
            { label: "Included Benefits", value: "{perks}+", icon: "Sparkles" },
            { label: "Most Popular", value: "{popular}", icon: "ShieldCheck" },
          ];

    return base.map((card) => ({
      label: card.label || "",
      value: resolveTokens(String(card.value || ""), plans.length, perks.length, popularPlan),
      icon: card.icon || "Crown",
    }));
  }, [page.summary_cards, plans.length, perks.length, popularPlan]);

  useEffect(() => {
    dispatch(getPricingRequest());
  }, [dispatch]);

  return (
    <PageRoot>
      <Section>
        <div className="surface-card relative overflow-hidden p-7 sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-accent2/20 blur-3xl" />

          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="label-chip">{page.hero_badge}</div>
              <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                {page.hero_title}
              </h1>
              <p className="mt-4 max-w-3xl text-muted leading-relaxed">{page.hero_description}</p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <PrimaryCTA to={page.hero_primary_cta_link || "/contact"}>
                  {page.hero_primary_cta_text}
                </PrimaryCTA>
                <SecondaryCTA to={page.hero_secondary_cta_link || "/trainers"}>
                  {page.hero_secondary_cta_text}
                </SecondaryCTA>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {summaryCards.map((card, idx) => {
                const Icon = iconMap[card.icon] || Crown;
                return (
                  <SurfaceSoft key={`${card.label}-${idx}`} className="p-4 mini-glow">
                    <Icon className="h-5 w-5 text-accent" />
                    <div className="mt-3 text-2xl font-bold text-white">{card.value}</div>
                    <div className="text-xs text-muted">{card.label}</div>
                  </SurfaceSoft>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        {loading ? (
          <Surface className="text-zinc-300">Loading pricing...</Surface>
        ) : error ? (
          <Surface className="text-red-300">{error}</Surface>
        ) : plans.length === 0 ? (
          <Surface className="text-zinc-400">No plans added yet.</Surface>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_2.1fr]">
            <SurfaceSoft className="p-6 lg:sticky lg:top-24 h-fit">
              <h2 className="text-2xl font-bold text-white">{page.benefits_title}</h2>
              <p className="mt-2 text-sm text-muted">{page.benefits_description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {perks.map((perk) => (
                  <span
                    key={perk}
                    className="inline-flex items-center gap-2 rounded-full border border-line/20 bg-white/5 px-3 py-1.5 text-xs text-zinc-200"
                  >
                    <Zap className="h-3.5 w-3.5 text-accent" />
                    {perk}
                  </span>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-line/10 bg-black/30 p-4">
                <div className="text-sm font-semibold text-white">{page.advisor_title}</div>
                <p className="mt-1 text-xs text-muted">{page.advisor_description}</p>
                <Link to={page.advisor_cta_link || "/contact"} className="btn-primary mt-4 w-full text-xs sm:text-sm">
                  {page.advisor_cta_text}
                </Link>
              </div>
            </SurfaceSoft>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={[
                    "surface-card relative overflow-hidden p-6 flex flex-col",
                    plan.is_highlighted ? "ring-1 ring-accent/45" : "",
                  ].join(" ")}
                >
                  {plan.is_highlighted && (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">
                      <Crown className="h-3.5 w-3.5" />
                      {page.popular_badge_text || "Most Popular"}
                    </div>
                  )}

                  <h2 className="text-2xl font-bold text-white">{plan.title}</h2>
                  <p className="mt-1 text-sm text-muted pr-28">{plan.subtitle}</p>

                  <div className="mt-6 flex items-end gap-1">
                    <div className="text-4xl font-bold text-white">{plan.price}</div>
                    <div className="pb-1 text-sm text-zinc-300">{plan.cadence}</div>
                  </div>

                  <div className="mt-6 space-y-2">
                    {(Array.isArray(plan.features) ? plan.features : []).map((feature) => (
                      <div
                        key={feature}
                        className="mini-glow rounded-xl border border-line/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 flex items-start gap-2"
                      >
                        <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/contact"
                    className={[
                      "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition gap-2",
                      plan.is_highlighted
                        ? "bg-accent text-black hover:bg-accent2"
                        : "bg-white/10 text-white hover:bg-white/15",
                    ].join(" ")}
                  >
                    Choose {plan.title}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section className="pb-10">
        <Surface className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-bold text-white">{page.bottom_cta_title}</h3>
            <p className="mt-2 text-muted">{page.bottom_cta_description}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryCTA to={page.bottom_primary_cta_link || "/contact"}>
              {page.bottom_primary_cta_text}
            </PrimaryCTA>
            <SecondaryCTA to={page.bottom_secondary_cta_link || "/trainers"}>
              {page.bottom_secondary_cta_text}
            </SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
