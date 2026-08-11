import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Building2, Camera, ChevronLeft, ChevronRight, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { getFacilitiesRequest } from "@src/redux/actions/facilities";
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

type FacilityItem = {
  id: number;
  kind: "zone" | "amenity";
  title: string;
  description: string;
  tag: string;
  image: string;
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
  zone_explorer_title: string;
  zone_explorer_description: string;
  amenities_title: string;
  amenities_description: string;
  tour_title: string;
  tour_description: string;
  tour_primary_cta_text: string;
  tour_primary_cta_link: string;
  tour_secondary_cta_text: string;
  tour_secondary_cta_link: string;
};

type FacilitiesState = {
  facilities?: {
    items?: FacilityItem[];
    content?: Partial<PageContent> | null;
    loading?: boolean;
    error?: string | null;
  };
};

const fallbackZones: FacilityItem[] = [
  {
    id: -1,
    kind: "zone",
    title: "Strength Floor",
    description: "Racks, benches, barbells, dumbbells and platforms for progressive strength work.",
    tag: "Strength",
    image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
    sort_order: 1,
    is_active: true,
  },
  {
    id: -2,
    kind: "zone",
    title: "Cardio Zone",
    description: "Treadmills, bikes and conditioning equipment for endurance and fat loss.",
    tag: "Conditioning",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop",
    sort_order: 2,
    is_active: true,
  },
];

const fallbackAmenities: FacilityItem[] = [
  { id: -11, kind: "amenity", title: "Locker Rooms", description: "", tag: "", image: "", sort_order: 1, is_active: true },
  { id: -12, kind: "amenity", title: "Showers", description: "", tag: "", image: "", sort_order: 2, is_active: true },
  { id: -13, kind: "amenity", title: "Filtered Water", description: "", tag: "", image: "", sort_order: 3, is_active: true },
];

const fallbackContent: PageContent = {
  hero_badge: "Facilities",
  hero_title: "A training floor built for serious results",
  hero_description: "Strength, conditioning and functional spaces organized for safe, consistent training.",
  hero_primary_cta_text: "Book a gym tour",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View memberships",
  hero_secondary_cta_link: "/pricing",
  summary_cards: [],
  zone_explorer_title: "Explore the floor",
  zone_explorer_description: "Select a zone to preview the training space.",
  amenities_title: "Included amenities",
  amenities_description: "Useful support facilities available with standard membership access.",
  tour_title: "Want to see the gym in person?",
  tour_description: "Visit the club and walk through every training zone with the team.",
  tour_primary_cta_text: "Book a visit",
  tour_primary_cta_link: "/contact",
  tour_secondary_cta_text: "Meet coaches",
  tour_secondary_cta_link: "/trainers",
};

function resolveTokens(value: string, zones: number, amenities: number, photos: number) {
  return value
    .replaceAll("{zones}", String(zones))
    .replaceAll("{amenities}", String(amenities))
    .replaceAll("{photos}", String(photos));
}

export default function Facilities() {
  const dispatch = useDispatch();
  const { items = [], content, loading = false, error = null } = useSelector(
    (state: FacilitiesState) => state.facilities ?? {}
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    dispatch(getFacilitiesRequest());
  }, [dispatch]);

  const zones = useMemo(() => {
    const active = items
      .filter((item) => item.kind === "zone" && item.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
    return active.length ? active : fallbackZones;
  }, [items]);

  const amenities = useMemo(() => {
    const active = items
      .filter((item) => item.kind === "amenity" && item.is_active !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
    return active.length ? active : fallbackAmenities;
  }, [items]);

  const page = { ...fallbackContent, ...(content || {}) };
  const activeZone = zones[Math.min(activeIndex, zones.length - 1)] ?? zones[0];
  const photoCount = zones.filter((zone) => zone.image).length;
  const summaryCards =
    page.summary_cards?.length
      ? page.summary_cards
      : [
          { label: "Training Zones", value: "{zones}", icon: "Building2" },
          { label: "Amenities", value: "{amenities}+", icon: "Sparkles" },
          { label: "Zone Photos", value: "{photos}", icon: "Camera" },
          { label: "Guided Tours", value: "Available", icon: "ShieldCheck" },
        ];

  const iconMap = { Building2, Sparkles, Camera, ShieldCheck };

  const nextZone = () => setActiveIndex((current) => (current + 1) % zones.length);
  const prevZone = () => setActiveIndex((current) => (current === 0 ? zones.length - 1 : current - 1));

  return (
    <PageRoot>
      <PublicSEO
        title="Facilities | A&A Health Club Butwal"
        description="Explore A&A Health Club's strength, cardio, functional training zones and amenities in Butwal, Rupandehi."
      />

      <Section animated={false} className="pt-10 sm:pt-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Badge tone="accent">{page.hero_badge}</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-6xl">
              {page.hero_title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)]">{page.hero_description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.hero_primary_cta_link || "/contact"}>{page.hero_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.hero_secondary_cta_link || "/pricing"}>{page.hero_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.slice(0, 4).map((card) => {
              const Icon = iconMap[card.icon as keyof typeof iconMap] ?? Building2;
              return (
                <Card key={card.label}>
                  <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                  <div className="mt-4 text-2xl font-semibold text-[var(--public-text)]">
                    {resolveTokens(card.value, zones.length, amenities.length, photoCount)}
                  </div>
                  <div className="text-sm text-[var(--public-muted)]">{card.label}</div>
                </Card>
              );
            })}
          </div>
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        {loading ? <LoadingState label="Loading facilities..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <ImageFrame src={activeZone?.image} alt={activeZone?.title || "Training zone"} className="aspect-[16/10]" />
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {activeZone?.tag ? <Badge tone="accent">{activeZone.tag}</Badge> : null}
                  <h2 className="mt-3 text-3xl font-semibold text-[var(--public-text)]">{activeZone?.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--public-muted)]">{activeZone?.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={prevZone}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-text)]"
                    aria-label="Previous zone"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextZone}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-text)]"
                    aria-label="Next zone"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <Surface>
              <h2 className="text-2xl font-semibold text-[var(--public-text)]">{page.zone_explorer_title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{page.zone_explorer_description}</p>
              <div className="mt-5 space-y-3">
                {zones.map((zone, index) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={[
                      "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                      index === activeIndex
                        ? "border-[var(--public-accent)] bg-[rgba(217,154,40,0.1)]"
                        : "border-[var(--public-line)] bg-white/[0.03] hover:border-[var(--public-line-strong)]",
                    ].join(" ")}
                  >
                    <ImageFrame src={zone.image} alt={zone.title} className="h-16 w-20 shrink-0 rounded-lg" />
                    <div>
                      <div className="font-semibold text-[var(--public-text)]">{zone.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--public-muted)]">{zone.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Surface>
          </div>
        ) : null}
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Amenities"
              title={page.amenities_title}
              description={page.amenities_description}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {amenities.length ? (
              amenities.map((amenity) => (
                <span
                  key={amenity.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--public-line)] bg-white/[0.03] px-4 py-2 text-sm text-[var(--public-text)]"
                >
                  <Sparkles className="h-4 w-4 text-[var(--public-accent-strong)]" />
                  {amenity.title}
                </span>
              ))
            ) : (
              <EmptyState title="Amenities coming soon" />
            )}
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--public-text)]">{page.tour_title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{page.tour_description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.tour_primary_cta_link || "/contact"}>{page.tour_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.tour_secondary_cta_link || "/trainers"}>
                {page.tour_secondary_cta_text}
                <MapPinned className="ml-2 h-4 w-4" />
              </SecondaryCTA>
            </div>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
