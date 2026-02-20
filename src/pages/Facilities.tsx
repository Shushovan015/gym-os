import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getFacilitiesRequest } from "@src/redux/actions/facilities";
import { PageRoot, Section, Surface, SurfaceSoft, PrimaryCTA, SecondaryCTA } from "./PageKit";

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

const iconMap: Record<string, React.ElementType> = {
  Building2,
  Sparkles,
  Camera,
  ShieldCheck,
};

const fallbackZones: FacilityItem[] = [
  {
    id: -1,
    kind: "zone",
    title: "Strength Floor",
    description: "Racks, benches, barbells, dumbbells, and platforms for progressive strength work.",
    tag: "Strength",
    image:
      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
    sort_order: 1,
    is_active: true,
  },
  {
    id: -2,
    kind: "zone",
    title: "Cardio Zone",
    description: "Treadmills, bikes, rowers, and conditioning equipment for endurance and fat loss.",
    tag: "Conditioning",
    image:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop",
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
  hero_badge: "Premium Infrastructure",
  hero_title: "Facilities built for serious results",
  hero_description:
    "Every zone is designed for performance, safety, and consistency.",
  hero_primary_cta_text: "Book a gym tour",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View memberships",
  hero_secondary_cta_link: "/pricing",
  summary_cards: [],
  zone_explorer_title: "Zone Explorer",
  zone_explorer_description: "Select a zone to preview the training space.",
  amenities_title: "Included Features",
  amenities_description: "Everything available with standard membership access.",
  tour_title: "Want a guided gym tour?",
  tour_description: "Visit the club and explore every training zone with our team.",
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
  const { items, content, loading, error } = useSelector(
    (s: any) => s.facilities ?? { items: [], content: null, loading: false, error: null }
  );

  const facilityItems: FacilityItem[] = Array.isArray(items) ? items : [];

  const zones = facilityItems
    .filter((i) => i.kind === "zone" && i.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  const amenities = facilityItems
    .filter((i) => i.kind === "amenity" && i.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  const displayZones = zones.length ? zones : fallbackZones;
  const displayAmenities = amenities.length ? amenities : fallbackAmenities;

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    dispatch(getFacilitiesRequest());
  }, [dispatch]);

  useEffect(() => {
    if (activeIndex >= displayZones.length) setActiveIndex(0);
  }, [activeIndex, displayZones.length]);

  const activeZone = displayZones[activeIndex];
  const photoCount = useMemo(() => displayZones.filter((z) => !!z.image).length, [displayZones]);

  const page: PageContent = { ...fallbackContent, ...(content || {}) };

  const summaryCards = useMemo(() => {
    const raw = Array.isArray(page.summary_cards) ? page.summary_cards : [];
    const base =
      raw.length > 0
        ? raw
        : [
            { label: "Training Zones", value: "{zones}", icon: "Building2" },
            { label: "Amenities", value: "{amenities}+", icon: "Sparkles" },
            { label: "Zone Photos", value: "{photos}", icon: "Camera" },
            { label: "Hours", value: "5:00 AM - 9:00 PM", icon: "ShieldCheck" },
          ];

    return base.map((card) => ({
      label: card.label || "",
      value: resolveTokens(String(card.value || ""), displayZones.length, displayAmenities.length, photoCount),
      icon: card.icon || "Building2",
    }));
  }, [page.summary_cards, displayZones.length, displayAmenities.length, photoCount]);

  const nextZone = () => {
    setActiveIndex((prev) => (prev === displayZones.length - 1 ? 0 : prev + 1));
  };

  const prevZone = () => {
    setActiveIndex((prev) => (prev === 0 ? displayZones.length - 1 : prev - 1));
  };

  return (
    <PageRoot>
      <Section>
        <div className="surface-card relative overflow-hidden p-7 sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-accent2/20 blur-3xl" />

          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <div className="label-chip">{page.hero_badge}</div>
              <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                {page.hero_title}
              </h1>
              <p className="mt-4 max-w-2xl text-muted leading-relaxed">{page.hero_description}</p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <PrimaryCTA to={page.hero_primary_cta_link || "/contact"}>
                  {page.hero_primary_cta_text}
                </PrimaryCTA>
                <SecondaryCTA to={page.hero_secondary_cta_link || "/pricing"}>
                  {page.hero_secondary_cta_text}
                </SecondaryCTA>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {summaryCards.map((card, idx) => {
                const Icon = iconMap[card.icon] || Building2;
                return (
                  <SurfaceSoft key={`${card.label}-${idx}`} className="p-4">
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
          <Surface className="text-zinc-300">Loading facilities...</Surface>
        ) : error ? (
          <Surface className="text-red-300">{error}</Surface>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Surface className="p-0 overflow-hidden">
              <div className="relative aspect-[16/10] bg-white/5">
                {activeZone?.image ? (
                  <img src={activeZone.image} alt={activeZone.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                  <div>
                    {!!activeZone?.tag && (
                      <span className="inline-flex rounded-full border border-white/20 bg-black/45 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                        {activeZone.tag}
                      </span>
                    )}
                    <h2 className="mt-3 text-3xl font-bold text-white">{activeZone?.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-200">{activeZone?.description}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={prevZone}
                      className="h-10 w-10 rounded-full border border-white/20 bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                      aria-label="Previous zone"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={nextZone}
                      className="h-10 w-10 rounded-full border border-white/20 bg-black/45 text-white flex items-center justify-center hover:bg-black/60"
                      aria-label="Next zone"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Surface>

            <Surface className="p-4">
              <h3 className="text-xl font-bold text-white">{page.zone_explorer_title}</h3>
              <p className="mt-1 text-sm text-muted">{page.zone_explorer_description}</p>

              <div className="mt-4 space-y-3 max-h-[480px] overflow-auto pr-1">
                {displayZones.map((zone, idx) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={[
                      "w-full text-left rounded-xl border p-3 transition mini-glow",
                      idx === activeIndex
                        ? "border-accent/50 bg-accent/10"
                        : "border-line/10 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-black/30 shrink-0">
                        {zone.image ? <img src={zone.image} alt={zone.title} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{zone.title}</div>
                        <div className="mt-1 text-xs text-muted line-clamp-2">{zone.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Surface>
          </div>
        )}
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceSoft className="p-6">
            <h3 className="text-2xl font-bold text-white">{page.amenities_title}</h3>
            <p className="mt-2 text-sm text-muted">{page.amenities_description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {displayAmenities.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full border border-line/20 bg-white/5 px-4 py-2 text-sm text-zinc-200"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {item.title}
                </span>
              ))}
            </div>
          </SurfaceSoft>

          <Surface className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <h3 className="text-3xl font-bold text-white">{page.tour_title}</h3>
              <p className="mt-2 text-muted">{page.tour_description}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryCTA to={page.tour_primary_cta_link || "/contact"}>
                {page.tour_primary_cta_text}
              </PrimaryCTA>
              <SecondaryCTA to={page.tour_secondary_cta_link || "/trainers"}>
                {page.tour_secondary_cta_text}
                <MapPinned className="h-4 w-4 ml-1" />
              </SecondaryCTA>
            </div>
          </Surface>
        </div>
      </Section>
    </PageRoot>
  );
}
