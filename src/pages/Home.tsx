import { Link } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Clock3,
  Dumbbell,
  ShieldCheck,
  Star,
  Trophy,
  type LucideIcon,
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

const iconMap: Record<string, LucideIcon> = {
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

function RevealSection({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 28, filter: "blur(8px)" }}
      whileInView={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const dispatch = useDispatch();
  const reduceMotion = useReducedMotion();

  const { scrollY } = useScroll();
  const heroImageY = useTransform(scrollY, [0, 800], [0, reduceMotion ? 0 : 120]);
  const heroImageScale = useTransform(scrollY, [0, 700], [1, reduceMotion ? 1 : 1.08]);
  const heroOverlayY = useTransform(scrollY, [0, 700], [0, reduceMotion ? 0 : 48]);
  const heroContentY = useTransform(scrollY, [0, 560], [0, reduceMotion ? 0 : 64]);
  const heroContentOpacity = useTransform(scrollY, [0, 440], [1, reduceMotion ? 1 : 0.22]);

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
          <motion.img
            src={home.hero_image}
            alt="Gym interior"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.68] saturate-[0.95]"
            style={reduceMotion ? undefined : { y: heroImageY, scale: heroImageScale }}
          />
          <motion.div
            className="absolute inset-0 bg-black/45"
            style={reduceMotion ? undefined : { y: heroOverlayY }}
          />
          <div className="hero-grid-overlay absolute inset-0 opacity-35" />
          <div className="hero-spotlight absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/72 to-black/58" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/22 to-black/36" />
          <motion.div
            className="relative z-20 h-full px-6 py-8 sm:px-9 sm:py-10 lg:px-12 xl:px-20"
            style={reduceMotion ? undefined : { y: heroContentY, opacity: heroContentOpacity }}
          >
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col justify-between">
              <div className="max-w-3xl pt-2 sm:pt-4">
                <div className="label-chip">{home.hero_badge}</div>
                <h1 className="premium-heading mt-5 text-4xl font-bold leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-7xl">
                  {home.hero_title}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-200">{home.hero_description}</p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <PrimaryCTA to={home.hero_primary_cta_link || "/contact"}>
                    {home.hero_primary_cta_text}
                  </PrimaryCTA>
                  <SecondaryCTA to={home.hero_secondary_cta_link || "/pricing"}>
                    {home.hero_secondary_cta_text}
                  </SecondaryCTA>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2 sm:pb-4 md:grid-cols-4">
                {heroMetrics.map((item: any, idx: number) => {
                  const Icon: LucideIcon = iconMap[String(item?.icon)] ?? Dumbbell;
                  return (
                    <motion.div
                      key={`${item?.label}-${idx}`}
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.46, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      className="tilt-card card-glow parallax-float rounded-xl border border-white/20 bg-black/35 p-4 backdrop-blur-md"
                    >
                      <div className="tilt-content">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                          <Icon className="h-4 w-4 text-accent" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-white">{item?.value}</div>
                        <div className="text-xs text-zinc-300">{item?.label}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Section>
        <RevealSection>
          <Surface>
            <h2 className="text-3xl font-bold text-white">{home.status_title}</h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {gymStatus.map((item: any, idx: number) => {
                const Icon: LucideIcon = item.icon ?? Clock3;
                return (
                  <motion.div
                    key={item.label}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.44, delay: idx * 0.05 }}
                    className="tilt-card card-glow surface-card-soft p-4"
                  >
                    <div className="tilt-content">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <div className="mt-3 text-sm font-bold text-white">{item.label}</div>
                      <div className="mt-1 text-sm text-muted">{item.value}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Surface>
        </RevealSection>
      </Section>

      <Section>
        <RevealSection delay={0.03}>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">{home.zones_title}</h2>
            <Link to="/facilities" className="btn-secondary text-sm">
              View all zones
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {zoneCards.map((zone: any, idx: number) => (
              <motion.article
                key={zone.name}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.48, delay: idx * 0.06 }}
                className="group tilt-card surface-card-soft p-4"
              >
                <div className="tilt-content">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                    <img
                      src={zone.image}
                      alt={zone.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-85" />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-white">{zone.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{zone.desc}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </RevealSection>
      </Section>

      <Section>
        <RevealSection delay={0.04}>
          <Surface className="surface-premium">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">{home.coaches_title}</h2>
                <p className="mt-2 text-muted">{home.coaches_subtitle}</p>
              </div>
              <Link to="/trainers" className="btn-primary inline-flex items-center gap-2">
                View all trainers
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {coachCards.map((coach: any, idx: number) => (
                <motion.article
                  key={coach.name}
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.48, delay: idx * 0.06 }}
                  className="group tilt-card surface-card-soft p-4"
                >
                  <div className="tilt-content">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
                      <img
                        src={coach.image}
                        alt={coach.name}
                        className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-white">{coach.name}</h3>
                    <p className="mt-1 text-sm text-zinc-300">{coach.role}</p>
                    <p className="mt-2 text-sm text-muted">{coach.focus}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </Surface>
        </RevealSection>
      </Section>

      <Section>
        <RevealSection delay={0.03}>
          <Surface className="surface-premium bg-gradient-to-r from-white/10 via-white/5 to-white/10">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <div>
                <div className="label-chip">{home.maximus_badge}</div>
                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{home.maximus_title}</h2>
                <p className="mt-3 leading-relaxed text-muted">{home.maximus_description}</p>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {maximusPoints.map((point: string, idx: number) => (
                    <motion.div
                      key={point}
                      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.42, delay: idx * 0.04 }}
                      className="tilt-card surface-card-soft p-3 text-sm text-zinc-200"
                    >
                      <div className="tilt-content">{point}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

              <div className="tilt-card relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                <div className="tilt-content h-full w-full">
                  <img
                    src={home.maximus_image}
                    alt="Maximus Strength powerlifting"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
                </div>
              </div>
            </div>
          </Surface>
        </RevealSection>
      </Section>

      <Section>
        <RevealSection delay={0.03}>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{home.gallery_title || "Inside Our Gym"}</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {galleryImages.map((img: string, idx: number) => (
              <motion.div
                key={`${img}-${idx}`}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.28 }}
                transition={{ duration: 0.45, delay: idx * 0.05 }}
                className="group tilt-card relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/5"
              >
                <div className="tilt-content h-full w-full">
                  <img
                    src={img}
                    alt={`Gym gallery ${idx + 1}`}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-70" />
                </div>
              </motion.div>
            ))}
          </div>
        </RevealSection>
      </Section>

      <Section>
        <RevealSection delay={0.03}>
          <Surface>
            <h2 className="text-3xl font-bold text-white">{home.testimonials_title}</h2>
            <p className="mt-2 text-muted">{home.testimonials_subtitle}</p>

            {testimonialsLoading ? (
              <div className="mt-6 text-zinc-300">Loading testimonials...</div>
            ) : testimonials.length === 0 ? (
              <div className="mt-6 text-zinc-400">No testimonials yet.</div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.slice(0, 3).map((t, idx) => (
                  <motion.article
                    key={t.id}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: idx * 0.05 }}
                    className="tilt-card card-glow surface-card-soft p-5"
                  >
                    <div className="tilt-content">
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
                      <p className="mt-4 text-sm leading-relaxed text-zinc-200">"{t.quote}"</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </Surface>
        </RevealSection>
      </Section>

      <Section className="pb-10">
        <RevealSection delay={0.02}>
          <Surface className="surface-premium flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="premium-heading text-3xl font-bold text-white">
                {home.final_cta_title || "Ready to start your transformation?"}
              </h3>
              <p className="mt-2 text-muted">
                {home.final_cta_description || "Book a trial session and get a personalized training roadmap."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={home.final_primary_cta_link || "/contact"}>
                {home.final_primary_cta_text || "Book trial"}
              </PrimaryCTA>
              <SecondaryCTA to={home.final_secondary_cta_link || "/pricing"}>
                {home.final_secondary_cta_text || "View pricing"}
              </SecondaryCTA>
            </div>
          </Surface>
        </RevealSection>
      </Section>
    </PageRoot>
  );
}
