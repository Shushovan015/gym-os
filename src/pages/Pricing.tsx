import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Check, Crown, Dumbbell, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import { getPricingRequest } from "@src/redux/actions/pricing";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageRoot,
  PrimaryCTA,
  PublicSEO,
  Section,
  SectionHeading,
  SecondaryCTA,
  Surface,
} from "./PageKit";

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

type PricingState = {
  pricing?: {
    items?: PricingItem[];
    content?: Partial<PageContent> | null;
    loading?: boolean;
    error?: string | null;
  };
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
  "Strength equipment access",
  "Flexible upgrade options",
];

const fallbackContent: PageContent = {
  hero_badge: "Membership Plans",
  hero_title: "Clear pricing for structured training.",
  hero_description: "Choose the plan that matches your routine. Contact the team for help selecting the right option.",
  hero_primary_cta_text: "Get custom guidance",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "Meet trainers",
  hero_secondary_cta_link: "/trainers",
  summary_cards: [],
  benefits_title: "Included with membership",
  benefits_description: "Every plan keeps the basics clear: access, coaching support and a disciplined floor.",
  advisor_title: "Need plan matching?",
  advisor_description: "Tell us your goal and schedule. We will recommend the right package.",
  advisor_cta_text: "Contact team",
  advisor_cta_link: "/contact",
  popular_badge_text: "Popular",
  bottom_cta_title: "Not sure which membership fits?",
  bottom_cta_description: "Get a recommendation based on your training level, schedule and goal.",
  bottom_primary_cta_text: "Get guidance",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "Meet trainers",
  bottom_secondary_cta_link: "/trainers",
};

const iconMap = { Crown, Sparkles, ShieldCheck, Zap, Dumbbell, Users };

function resolveTokens(value: string, plans: number, perks: number, popular: string) {
  return value
    .replaceAll("{plans}", String(plans))
    .replaceAll("{perks}", String(perks))
    .replaceAll("{popular}", popular || "-");
}

export default function Pricing() {
  const dispatch = useDispatch();
  const { items = [], content, loading = false, error = null } = useSelector(
    (state: PricingState) => state.pricing ?? {}
  );

  useEffect(() => {
    dispatch(getPricingRequest());
  }, [dispatch]);

  const page = { ...fallbackContent, ...(content || {}) };
  const plansRaw = items
    .filter((item) => item.kind === "plan" && item.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
  const perksRaw = items
    .filter((item) => item.kind === "perk" && item.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
  const plans = plansRaw.length ? plansRaw : fallbackPlans;
  const perks = perksRaw.length ? perksRaw.map((perk) => perk.title) : fallbackPerks;
  const popularPlan = plans.find((plan) => plan.is_highlighted)?.title || plans[0]?.title || "";
  const summaryCards =
    page.summary_cards?.length
      ? page.summary_cards
      : [
          { label: "Membership Tiers", value: "{plans}", icon: "Crown" },
          { label: "Included Benefits", value: "{perks}+", icon: "Sparkles" },
          { label: "Popular Choice", value: "{popular}", icon: "ShieldCheck" },
        ];

  return (
    <PageRoot>
      <PublicSEO
        title="Pricing | A&A Health Club Butwal"
        description="Compare A&A Health Club membership plans, included benefits and contact options for custom guidance."
      />

      <Section animated={false} className="pt-10 sm:pt-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="accent">{page.hero_badge}</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-6xl">
              {page.hero_title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)]">{page.hero_description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.hero_primary_cta_link || "/contact"}>{page.hero_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.hero_secondary_cta_link || "/trainers"}>{page.hero_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {summaryCards.slice(0, 3).map((card) => {
              const Icon = iconMap[card.icon as keyof typeof iconMap] ?? Crown;
              return (
                <Card key={card.label}>
                  <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                  <div className="mt-4 text-2xl font-semibold text-[var(--public-text)]">
                    {resolveTokens(card.value, plans.length, perks.length, popularPlan)}
                  </div>
                  <div className="text-sm text-[var(--public-muted)]">{card.label}</div>
                </Card>
              );
            })}
          </div>
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        {loading ? <LoadingState label="Loading pricing..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && plans.length === 0 ? <EmptyState title="No pricing plans added yet" /> : null}
        {!loading && !error && plans.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.6fr]">
            <Surface className="h-fit lg:sticky lg:top-24">
              <h2 className="text-2xl font-semibold text-[var(--public-text)]">{page.benefits_title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{page.benefits_description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {perks.map((perk) => (
                  <Badge key={perk}>{perk}</Badge>
                ))}
              </div>
              <div className="mt-7 rounded-2xl border border-[var(--public-line)] bg-white/[0.03] p-5">
                <h3 className="font-semibold text-[var(--public-text)]">{page.advisor_title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{page.advisor_description}</p>
                <PrimaryCTA to={page.advisor_cta_link || "/contact"} className="mt-5 w-full">
                  {page.advisor_cta_text}
                </PrimaryCTA>
              </div>
            </Surface>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={[
                    "relative flex flex-col rounded-2xl border bg-[var(--public-surface)] p-6",
                    plan.is_highlighted ? "border-[var(--public-accent)]" : "border-[var(--public-line)]",
                  ].join(" ")}
                >
                  {plan.is_highlighted ? (
                    <Badge tone="accent">{page.popular_badge_text || "Popular"}</Badge>
                  ) : null}
                  <h2 className="mt-4 text-2xl font-semibold text-[var(--public-text)]">{plan.title}</h2>
                  <p className="mt-2 min-h-[3rem] text-sm leading-6 text-[var(--public-muted)]">{plan.subtitle}</p>
                  <div className="mt-6 flex items-end gap-2">
                    <div className="text-4xl font-semibold text-[var(--public-text)]">{plan.price}</div>
                    <div className="pb-1 text-sm text-[var(--public-muted)]">{plan.cadence}</div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex gap-3 text-sm leading-6 text-[var(--public-muted)]">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent-strong)]" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/contact"
                    className={[
                      "mt-auto inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-extrabold transition",
                      plan.is_highlighted
                        ? "bg-[var(--public-accent)] text-[#14110d] hover:bg-[var(--public-accent-strong)]"
                        : "border border-[var(--public-line-strong)] text-[var(--public-text)] hover:border-[var(--public-accent)]",
                    ].join(" ")}
                  >
                    Choose {plan.title}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Compare with confidence"
          title="No fake urgency. Just the details you need."
          description="Memberships are presented with existing plan names, prices, durations and included benefits from the current CMS."
          align="center"
        />
      </Section>

      <Section className="pt-0">
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--public-text)]">{page.bottom_cta_title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{page.bottom_cta_description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.bottom_primary_cta_link || "/contact"}>{page.bottom_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.bottom_secondary_cta_link || "/trainers"}>{page.bottom_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
