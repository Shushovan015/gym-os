import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Clock3,
  Dumbbell,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";

import { getHomeRequest } from "@src/redux/actions/home";
import { getFacilitiesRequest } from "@src/redux/actions/facilities";
import { getTrainersRequest } from "@src/redux/actions/trainers";
import { getTestimonialsRequest } from "@src/redux/actions/testimonials";

import { PageRoot, Section, Surface, PrimaryCTA, SecondaryCTA } from "./PageKit";

type Testimonial = {
  id: number;
  name: string;
  goal: string;
  quote: string;
  image: string;
};

type HeroMetric = {
  label: string;
  value: string;
  icon?: string;
};

type GalleryImage = {
  url: string;
  alt?: string;
};

type HomeContent = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  status_title: string;
  zones_title: string;
  coaches_title: string;
  coaches_subtitle: string;
  maximus_badge: string;
  maximus_title: string;
  maximus_description: string;
  maximus_image: string;
  maximus_learn_more_link: string;
  maximus_instagram_link: string;
  testimonials_title: string;
  testimonials_subtitle: string;
  hero_metrics?: HeroMetric[];
  gallery_title?: string;
  gallery_images?: GalleryImage[] | string[];
  final_cta_title?: string;
  final_cta_description?: string;
  final_primary_cta_text?: string;
  final_primary_cta_link?: string;
  final_secondary_cta_text?: string;
  final_secondary_cta_link?: string;
};

const iconMap: Record<string, React.ElementType> = {
  Dumbbell,
  ShieldCheck,
  Star,
  Trophy,
  Clock3,
  Activity,
  BarChart3,
};

const homeFallback: HomeContent = {
  hero_badge: "A&A Health Club | Butwal, Rupandehi",
  hero_title: "Train hard. Lift right. Stay consistent.",
  hero_description:
    "A serious training environment with proper coaching, modern equipment, and programs for strength, fat loss, and performance.",
  hero_image:
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Book trial session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View membership",
  hero_secondary_cta_link: "/pricing",
  status_title: "Today at A&A",
  zones_title: "Training Zones",
  coaches_title: "Coaches on Floor",
  coaches_subtitle: "Train with experienced coaches for strength, fat loss, and functional performance.",
  maximus_badge: "Maximus Strength",
  maximus_title: "Powerlifting Group",
  maximus_description:
    "Dedicated powerlifting training for lifters focused on Squat, Bench, and Deadlift progression.",
  maximus_image:
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  maximus_learn_more_link: "/about#maximus-strength",
  maximus_instagram_link: "https://www.instagram.com/teammaximusstrength/",
  testimonials_title: "What Members Say",
  testimonials_subtitle: "Real feedback from A&A members.",
  hero_metrics: [],
  gallery_title: "Inside Our Gym",
  gallery_images: [],
  final_cta_title: "Ready to start your transformation?",
  final_cta_description: "Book a trial session and get a personalized training roadmap.",
  final_primary_cta_text: "Book trial",
  final_primary_cta_link: "/contact",
  final_secondary_cta_text: "View pricing",
  final_secondary_cta_link: "/pricing",
};

const fallbackStatus = [
  { label: "Open Gym", value: "5:00 AM - 9:00 PM", icon: Clock3 },
  { label: "Peak Hours", value: "6:00 AM - 9:00 AM / 5:00 PM - 8:00 PM", icon: Star },
  { label: "Powerlifting Session", value: "Mon, Wed, Fri - 6:30 PM", icon: Trophy },
  { label: "Trial Session", value: "Available Daily", icon: ShieldCheck },
];

const fallbackZones = [
  {
    name: "Strength Floor",
    desc: "Racks, benches, barbells, dumbbells, and platforms for progressive strength work.",
    image:
      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  },
  {
    name: "Cardio Zone",
    desc: "Treadmills, bikes, rowers, and conditioning equipment for endurance and fat loss.",
    image:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop",
  },
  {
    name: "Functional Area",
    desc: "Kettlebells, ropes, mobility tools, and bodyweight stations for athletic training.",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
  },
];

const fallbackCoaches = [
  {
    name: "Keshab B. Shakya",
    role: "Strength Coach",
    focus: "Barbell Technique, Power",
    image:
      "https://images.unsplash.com/photo-1567013127542-490d757e6349?q=80&w=1200&auto=format&fit=crop",
  },
  {
    name: "Anmol Shakya",
    role: "Fat Loss Coach",
    focus: "Body Recomposition, Habit Coaching",
    image:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    name: "Niraj T.",
    role: "Functional Trainer",
    focus: "Mobility, Conditioning",
    image:
      "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?q=80&w=1200&auto=format&fit=crop",
  },
];

const fallbackMaximusPoints = [
  "Squat, Bench, Deadlift focused programming",
  "Meet-prep cycles and peaking blocks",
  "Technique breakdown with competition standards",
  "Team sessions for beginner to advanced lifters",
];

const fallbackGallery = [
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549476464-37392f717541?q=80&w=1600&auto=format&fit=crop",
];

export default function Home() {
  const dispatch = useDispatch();

  const { content: homeContent, status: homeStatus, points: homePoints } = useSelector(
    (s: any) => s.home ?? { content: null, status: [], points: [] }
  );
  const { items: facilitiesItems } = useSelector((s: any) => s.facilities ?? { items: [] });
  const { items: trainerItems } = useSelector((s: any) => s.trainers ?? { items: [] });
  const { items: testimonialItems, loading: testimonialsLoading } = useSelector(
    (s: any) => s.testimonials ?? { items: [], loading: false }
  );

  const home: HomeContent = { ...homeFallback, ...(homeContent || {}) };
  const testimonials: Testimonial[] = Array.isArray(testimonialItems) ? testimonialItems : [];

  const gymStatus =
    Array.isArray(homeStatus) && homeStatus.length
      ? homeStatus
          .map((item: any, idx: number) => ({
            label: item?.label ?? "",
            value: item?.value ?? "",
            icon: iconMap[item?.icon] || fallbackStatus[idx % fallbackStatus.length].icon,
          }))
          .filter((item: any) => item.label && item.value)
      : fallbackStatus;

  const zoneCards =
    Array.isArray(facilitiesItems) && facilitiesItems.length
      ? facilitiesItems
          .filter((item: any) => item?.kind === "zone" && item?.is_active !== false)
          .slice(0, 3)
          .map((item: any) => ({
            name: item?.title ?? "Zone",
            desc: item?.description ?? "",
            image: item?.image || fallbackZones[0].image,
          }))
      : fallbackZones;

  const coachCards =
    Array.isArray(trainerItems) && trainerItems.length
      ? trainerItems.slice(0, 3).map((item: any, idx: number) => ({
          name: item?.name ?? "Coach",
          role: item?.role ?? "Trainer",
          focus: Array.isArray(item?.specialties) ? item.specialties.join(", ") : "",
          image: item?.image || fallbackCoaches[idx % fallbackCoaches.length].image,
        }))
      : fallbackCoaches;

  const maximusPoints =
    Array.isArray(homePoints) && homePoints.length
      ? homePoints.map((item: any) => item?.point ?? "").filter((p: string) => p)
      : fallbackMaximusPoints;

  const fallbackHeroMetrics = [
    { label: "Dumbbell Range", value: "2.5kg-50kg", icon: "Dumbbell" },
    { label: "Power Racks", value: "8", icon: "ShieldCheck" },
    { label: "Coaches", value: String(coachCards.length || 3), icon: "Star" },
    { label: "Active Members", value: "500+", icon: "Trophy" },
  ];

  const heroMetrics =
    Array.isArray(home.hero_metrics) && home.hero_metrics.length
      ? home.hero_metrics
      : fallbackHeroMetrics;

  const galleryFromContent =
    Array.isArray(home.gallery_images) && home.gallery_images.length
      ? home.gallery_images
          .map((g: any) => (typeof g === "string" ? g : g?.url))
          .filter(Boolean)
      : [];

  const galleryImages =
    galleryFromContent.length > 0
      ? galleryFromContent
      : Array.isArray(facilitiesItems) && facilitiesItems.length
      ? facilitiesItems
          .filter((item: any) => item?.image)
          .slice(0, 4)
          .map((item: any) => item.image)
      : fallbackGallery;

  useEffect(() => {
    dispatch(getHomeRequest());
    dispatch(getFacilitiesRequest());
    dispatch(getTrainersRequest());
    dispatch(getTestimonialsRequest());
  }, [dispatch]);

  return (
    <PageRoot>
      <section className="relative">
        <div className="relative h-[calc(100dvh-4rem)] min-h-[680px] w-full overflow-hidden rounded-none">
          <img
            src={home.hero_image}
            alt="Gym interior"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.7] saturate-[0.9]"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/72 to-black/58" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/35" />

          <div className="relative z-20 h-full px-6 py-8 sm:px-9 sm:py-10 lg:px-12 xl:px-20">
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-between">
              <div className="max-w-3xl pt-2 sm:pt-4">
                <div className="label-chip">{home.hero_badge}</div>
                <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.03] tracking-tight text-white">
                  {home.hero_title}
                </h1>
                <p className="mt-4 text-zinc-200 leading-relaxed text-lg">{home.hero_description}</p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <PrimaryCTA to={home.hero_primary_cta_link || "/contact"}>
                    {home.hero_primary_cta_text}
                  </PrimaryCTA>
                  <SecondaryCTA to={home.hero_secondary_cta_link || "/pricing"}>
                    {home.hero_secondary_cta_text}
                  </SecondaryCTA>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-2 sm:pb-4">
                {heroMetrics.map((item: any, idx: number) => {
                  const Icon = iconMap[item?.icon] || Dumbbell;
                  return (
                    <div
                      key={`${item?.label}-${idx}`}
                      className="rounded-xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <div className="mt-3 text-2xl font-bold text-white">{item?.value}</div>
                      <div className="text-xs text-zinc-300">{item?.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <Surface>
          <h2 className="text-3xl font-bold text-white">{home.status_title}</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {gymStatus.map((item: any) => {
              const Icon = item.icon || Clock3;
              return (
                <div key={item.label} className="surface-card-soft p-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-white">{item.label}</div>
                  <div className="mt-1 text-sm text-muted">{item.value}</div>
                </div>
              );
            })}
          </div>
        </Surface>
      </Section>

      <Section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">{home.zones_title}</h2>
          <Link to="/facilities" className="btn-secondary text-sm">
            View all zones
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {zoneCards.map((zone: any) => (
            <article key={zone.name} className="surface-card-soft p-4">
              <div className="relative overflow-hidden rounded-2xl bg-white/5 aspect-[16/10]">
                <img src={zone.image} alt={zone.name} className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <h3 className="mt-4 text-2xl font-bold text-white">{zone.name}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{zone.desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <Surface>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">{home.coaches_title}</h2>
              <p className="mt-2 text-muted">{home.coaches_subtitle}</p>
            </div>
            <Link to="/trainers" className="btn-primary inline-flex items-center gap-2">
              View all trainers
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {coachCards.map((coach: any) => (
              <article key={coach.name} className="surface-card-soft p-4">
                <div className="relative overflow-hidden rounded-xl bg-white/5 aspect-[4/3]">
                  <img src={coach.image} alt={coach.name} className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">{coach.name}</h3>
                <p className="mt-1 text-sm text-zinc-300">{coach.role}</p>
                <p className="mt-2 text-sm text-muted">{coach.focus}</p>
              </article>
            ))}
          </div>
        </Surface>
      </Section>

      <Section>
        <Surface className="bg-gradient-to-r from-white/10 via-white/5 to-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="label-chip">{home.maximus_badge}</div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">{home.maximus_title}</h2>
              <p className="mt-3 text-muted leading-relaxed">{home.maximus_description}</p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {maximusPoints.map((point: string) => (
                  <div key={point} className="surface-card-soft p-3 text-sm text-zinc-200">
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <PrimaryCTA to={home.maximus_learn_more_link || "/about#maximus-strength"}>
                  Learn more
                </PrimaryCTA>
                <a
                  href={home.maximus_instagram_link || "https://www.instagram.com/teammaximusstrength/"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-center"
                >
                  Instagram
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white/5 aspect-[16/10]">
              <img
                src={home.maximus_image}
                alt="Maximus Strength powerlifting"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </Surface>
      </Section>

      <Section>
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          {home.gallery_title || "Inside Our Gym"}
        </h2>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {galleryImages.map((img: string, idx: number) => (
            <div key={`${img}-${idx}`} className="relative overflow-hidden rounded-2xl bg-white/5 aspect-[4/5]">
              <img src={img} alt={`Gym gallery ${idx + 1}`} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <Surface>
          <h2 className="text-3xl font-bold text-white">{home.testimonials_title}</h2>
          <p className="mt-2 text-muted">{home.testimonials_subtitle}</p>

          {testimonialsLoading ? (
            <div className="mt-6 text-zinc-300">Loading testimonials...</div>
          ) : testimonials.length === 0 ? (
            <div className="mt-6 text-zinc-400">No testimonials yet.</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.slice(0, 3).map((t) => (
                <article key={t.id} className="surface-card-soft p-5">
                  <div className="flex items-center gap-3">
                    {t.image ? (
                      <img
                        src={t.image}
                        alt={t.name}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-white/20"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-white/10" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="text-xs text-zinc-400">{t.goal}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-zinc-200 leading-relaxed">"{t.quote}"</p>
                </article>
              ))}
            </div>
          )}
        </Surface>
      </Section>

      <Section className="pb-10">
        <Surface className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-bold text-white">
              {home.final_cta_title || "Ready to start your transformation?"}
            </h3>
            <p className="mt-2 text-muted">
              {home.final_cta_description || "Book a trial session and get a personalized training roadmap."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryCTA to={home.final_primary_cta_link || "/contact"}>
              {home.final_primary_cta_text || "Book trial"}
            </PrimaryCTA>
            <SecondaryCTA to={home.final_secondary_cta_link || "/pricing"}>
              {home.final_secondary_cta_text || "View pricing"}
            </SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
