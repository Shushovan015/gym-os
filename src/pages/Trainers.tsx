import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Medal,
  PlayCircle,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTrainersRequest } from "@src/redux/actions/trainers";
import { PageRoot, Section } from "./PageKit";

type TrainerRow = {
  id: number;
  name: string;
  role: string;
  bio: string;
  image: string;
  specialties: string[];
  years_experience: number;
  offers_personal_training: boolean;
  certifications?: string[];
  achievements?: string[];
  clients_coached?: number;
  intro_video_url?: string;
  intro_video_thumb?: string;
  long_bio?: string;
  coaching_style?: string;
  availability?: string;
  session_focus?: string[];
};

type MetricItem = {
  label: string;
  value: string;
  sub: string;
  icon?: string;
};

type ZoneItem = {
  title: string;
  desc: string;
  icon?: string;
};

type PTContent = {
  pt_badge?: string;
  pt_title?: string;
  pt_description?: string;
  pt_cta_text?: string;
  pt_cta_link?: string;

  hero_badge?: string;
  hero_title?: string;
  hero_description?: string;
  hero_primary_cta_text?: string;
  hero_primary_cta_link?: string;
  hero_secondary_cta_text?: string;
  hero_secondary_cta_link?: string;

  strength_section_title?: string;
  equipment_section_title?: string;
  spotlight_count?: number;

  strength_metrics?: MetricItem[];
  equipment_zones?: ZoneItem[];
};

type PTPlan = {
  id?: number;
  name: string;
  details: string;
  points: string[];
};

const fallbackPlans: PTPlan[] = [
  {
    name: "Starter PT",
    details: "2 sessions / week",
    points: ["Form correction", "Basic split design", "Habit coaching"],
  },
  {
    name: "Progress PT",
    details: "3 sessions / week",
    points: ["Strength progression", "Body recomposition", "Weekly check-ins"],
  },
  {
    name: "Elite PT",
    details: "5 sessions / week",
    points: ["Advanced programming", "Nutrition guidance", "Performance tracking"],
  },
];

const fallbackPageContent: Required<
  Pick<
    PTContent,
    | "pt_badge"
    | "pt_title"
    | "pt_description"
    | "pt_cta_text"
    | "pt_cta_link"
    | "hero_badge"
    | "hero_title"
    | "hero_description"
    | "hero_primary_cta_text"
    | "hero_primary_cta_link"
    | "hero_secondary_cta_text"
    | "hero_secondary_cta_link"
    | "strength_section_title"
    | "equipment_section_title"
    | "spotlight_count"
  >
> = {
  pt_badge: "Personal Training",
  pt_title: "One-on-one coaching sessions available",
  pt_description:
    "Train directly with a coach through personalized sessions based on your goal, level, and schedule.",
  pt_cta_text: "Book personal training",
  pt_cta_link: "/contact",

  hero_badge: "Elite Coaching Team",
  hero_title: "Train with coaches who build real strength",
  hero_description:
    "Not generic sessions. We coach with progressive overload, technique standards, and measurable progression.",
  hero_primary_cta_text: "Book a session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View coaching plans",
  hero_secondary_cta_link: "/pricing",

  strength_section_title: "Strength Floor Snapshot",
  equipment_section_title: "Training Zones",
  spotlight_count: 3,
};

const fallbackStrengthMetrics: MetricItem[] = [
  { label: "Dumbbell Range", value: "2.5kg - 50kg", sub: "Full progressive loading setup", icon: "Dumbbell" },
  { label: "Power Racks", value: "8 Stations", sub: "Squat, bench, pull, accessories", icon: "ShieldCheck" },
  { label: "Olympic Platforms", value: "6 Platforms", sub: "Deadlift and explosive work", icon: "Trophy" },
  { label: "Plate Inventory", value: "2.5 Tons+", sub: "Calibrated and standard mix", icon: "Flame" },
];

const fallbackEquipmentZones: ZoneItem[] = [
  {
    title: "Dumbbell Zone",
    desc: "Heavy dumbbells and incline benches for hypertrophy blocks.",
    icon: "Dumbbell",
  },
  {
    title: "Barbell Strength Lane",
    desc: "Racks, benches, and platform access for serious progression.",
    icon: "Trophy",
  },
  {
    title: "Performance Conditioning",
    desc: "Rower, sled, ropes, and loaded carries.",
    icon: "Activity",
  },
];

const coachingProcess = [
  {
    title: "Assessment",
    desc: "Movement screening and goal mapping to build the right starting point.",
    icon: Target,
  },
  {
    title: "Structured Plan",
    desc: "Weekly split, intensity targets, and progression timeline tailored to your profile.",
    icon: BarChart3,
  },
  {
    title: "Performance Review",
    desc: "Consistent check-ins, form correction, and program updates based on results.",
    icon: Activity,
  },
];

const iconMap: Record<string, LucideIcon> = {
  Activity,
  Dumbbell,
  ShieldCheck,
  Trophy,
  Flame,
  Target,
  BarChart3,
  Star,
};

function firstName(name: string) {
  return name?.trim()?.split(" ")?.[0] || "Coach";
}

function getTrainerDetails(trainer: TrainerRow) {
  return {
    longBio:
      trainer.long_bio ||
      trainer.bio ||
      "Professional trainer focused on sustainable strength, technique quality, and long-term progression.",
    coachingStyle:
      trainer.coaching_style ||
      "Form-first coaching with progressive overload, individualized intensity, and weekly performance review.",
    availability: trainer.availability || "Mon-Sat | Morning & Evening slots available",
    sessionFocus:
      trainer.session_focus?.length
        ? trainer.session_focus
        : trainer.specialties?.length
          ? trainer.specialties.slice(0, 5)
          : ["Strength", "Fat loss", "Mobility", "Technique"],
    certifications:
      trainer.certifications?.length
        ? trainer.certifications
        : ["Personal Trainer Certification", "Strength & Conditioning Fundamentals"],
    achievements:
      trainer.achievements?.length
        ? trainer.achievements
        : ["Client transformation support", "Progressive program design", "Form correction expertise"],
  };
}

function normalizeMetrics(input: unknown): MetricItem[] {
  if (!Array.isArray(input) || input.length === 0) return fallbackStrengthMetrics;
  const data = input
    .map((item: any) => ({
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      sub: String(item?.sub ?? "").trim(),
      icon: String(item?.icon ?? "").trim(),
    }))
    .filter((x) => x.label && x.value);
  return data.length ? data : fallbackStrengthMetrics;
}

function normalizeZones(input: unknown): ZoneItem[] {
  if (!Array.isArray(input) || input.length === 0) return fallbackEquipmentZones;
  const data = input
    .map((item: any) => ({
      title: String(item?.title ?? "").trim(),
      desc: String(item?.desc ?? "").trim(),
      icon: String(item?.icon ?? "").trim(),
    }))
    .filter((x) => x.title && x.desc);
  return data.length ? data : fallbackEquipmentZones;
}

function resolveIcon(iconName: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!iconName) return fallback;
  return iconMap[iconName] || fallback;
}

function ProImage({
  src,
  alt,
  heightClass,
  layoutId,
}: {
  src?: string;
  alt: string;
  heightClass: string;
  layoutId?: string;
}) {
  return (
    <div className={`relative w-full overflow-hidden bg-[#0b1118] ${heightClass}`}>
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 z-0 h-full w-full scale-110 object-cover blur-2xl opacity-35"
          />
          <div className="absolute inset-0 z-[1] bg-black/25" />
          {layoutId ? (
            <motion.img
              layoutId={layoutId}
              src={src}
              alt={alt}
              className="relative z-[2] h-full w-full object-contain object-center"
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            />
          ) : (
            <img src={src} alt={alt} className="relative z-[2] h-full w-full object-contain object-center" />
          )}
        </>
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-white/20 via-white/10 to-transparent" />
      )}
    </div>
  );
}

function TrainerCard({
  trainer,
  imageHeight,
  onOpen,
}: {
  trainer: TrainerRow;
  imageHeight: string;
  onOpen: (id: number) => void;
}) {
  const highlight = (trainer.specialties || []).slice(0, 3);

  return (
    <article
      className="group surface-card h-full overflow-hidden transition duration-300 hover:-translate-y-1 flex flex-col cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(trainer.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(trainer.id);
        }
      }}
    >
      <div className="relative isolate">
        <ProImage src={trainer.image} alt={trainer.name} heightClass={imageHeight} layoutId={`trainer-image-${trainer.id}`} />

        <div className="absolute left-4 top-4 z-30 label-chip gap-2">
          <Star className="h-4 w-4 text-accent" />
          Elite Coach
        </div>

        {trainer.offers_personal_training && (
          <span className="absolute right-4 top-4 z-30 inline-flex items-center gap-1 rounded-full border border-line/20 bg-black/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-100">
            <Dumbbell className="h-3.5 w-3.5 text-accent" />
            PT
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold tracking-tight text-white">{trainer.name}</h3>
            <p className="text-sm text-zinc-300">{trainer.role}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
            {trainer.years_experience}+ yrs
          </span>
        </div>

        {!!trainer.bio && (
          <p
            className="mt-2 text-sm leading-snug text-muted"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {trainer.bio}
          </p>
        )}

        {highlight.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {highlight.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-line/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200"
              >
                <Target className="h-3 w-3 text-accent" />
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(trainer.id);
            }}
            className="btn-secondary w-full !py-2 text-xs sm:text-sm"
          >
            View profile
          </button>
          <Link
            to="/contact"
            onClick={(e) => e.stopPropagation()}
            className="btn-primary w-full gap-1 !py-2 text-xs sm:text-sm"
          >
            Book
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function Trainers() {
  const dispatch = useDispatch();

  const { items, ptContent, plans, loading, error } = useSelector(
    (s: any) =>
      s.trainers ?? {
        items: [],
        ptContent: null,
        plans: [],
        loading: false,
        error: null,
      }
  );

  const trainers: TrainerRow[] = Array.isArray(items) ? items : [];
  const page = { ...fallbackPageContent, ...(ptContent || {}) } as PTContent & typeof fallbackPageContent;
  const personalTrainingPlans: PTPlan[] =
    Array.isArray(plans) && plans.length > 0 ? plans : fallbackPlans;

  const strengthMetricsData = useMemo(() => normalizeMetrics(page.strength_metrics), [page.strength_metrics]);
  const equipmentZonesData = useMemo(() => normalizeZones(page.equipment_zones), [page.equipment_zones]);

  const spotlightCount = Math.max(1, Math.min(12, Number(page.spotlight_count) || 3));
  const spotlightCoaches = trainers.slice(0, spotlightCount);
  const coachGrid = trainers.length > spotlightCount ? trainers.slice(spotlightCount) : [];

  const totalExperience = trainers.reduce((sum, t) => sum + (t.years_experience || 0), 0);
  const avgExperience = trainers.length > 0 ? Math.round(totalExperience / trainers.length) : 0;
  const ptCount = trainers.filter((t) => t.offers_personal_training).length;
  const totalClients = trainers.reduce((sum, t) => sum + (t.clients_coached || 0), 0);

  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const selectedTrainer = useMemo(
    () => trainers.find((t) => t.id === selectedTrainerId) || null,
    [trainers, selectedTrainerId]
  );
  const selectedDetails = selectedTrainer ? getTrainerDetails(selectedTrainer) : null;

  useEffect(() => {
    dispatch(getTrainersRequest());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedTrainer) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTrainerId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTrainer]);

  const uniformImageHeight = "aspect-[3/4]";
  const canUsePortal = typeof document !== "undefined";

  return (
    <PageRoot>
      <Section>
        <div className="surface-card relative overflow-hidden p-7 sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-accent2/20 blur-3xl" />

          <div className="relative grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div>
              <div className="label-chip gap-2">
                <Dumbbell className="h-4 w-4 text-accent" />
                {page.hero_badge}
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
                {page.hero_title}
              </h1>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted">{page.hero_description}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link to={page.hero_primary_cta_link || "/contact"} className="btn-primary gap-2">
                  {page.hero_primary_cta_text}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link to={page.hero_secondary_cta_link || "/pricing"} className="btn-secondary">
                  {page.hero_secondary_cta_text}
                </Link>
              </div>
            </div>

            <div className="surface-card-soft mini-glow p-5">
              <h3 className="text-xl font-bold text-white">{page.strength_section_title}</h3>
              <div className="mt-4 space-y-3">
                {strengthMetricsData.map((metric) => {
                  const Icon = resolveIcon(metric.icon, Dumbbell);
                  return (
                    <div key={`${metric.label}-${metric.value}`} className="mini-glow rounded-2xl border border-line/10 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                            <Icon className="h-4 w-4 text-accent" />
                          </span>
                          <span className="text-sm font-semibold text-zinc-200">{metric.label}</span>
                        </div>
                        <span className="text-sm font-extrabold text-white">{metric.value}</span>
                      </div>
                      {!!metric.sub && <p className="mt-2 text-xs text-muted">{metric.sub}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="mb-4 text-2xl font-bold text-white">{page.equipment_section_title}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {equipmentZonesData.map((zone) => {
            const Icon = resolveIcon(zone.icon, Activity);
            return (
              <article key={zone.title} className="surface-card-soft mini-glow p-5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">{zone.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{zone.desc}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="surface-card-soft mini-glow p-5">
            <div className="text-xs uppercase tracking-wide text-muted">Coaching Team</div>
            <div className="mt-2 text-3xl font-bold text-white">{trainers.length}</div>
          </div>
          <div className="surface-card-soft mini-glow p-5">
            <div className="text-xs uppercase tracking-wide text-muted">Avg Experience</div>
            <div className="mt-2 text-3xl font-bold text-white">{avgExperience}+ yrs</div>
          </div>
          <div className="surface-card-soft mini-glow p-5">
            <div className="text-xs uppercase tracking-wide text-muted">1-to-1 Coaches</div>
            <div className="mt-2 text-3xl font-bold text-white">{ptCount}</div>
          </div>
          <div className="surface-card-soft mini-glow p-5">
            <div className="text-xs uppercase tracking-wide text-muted">Clients Coached</div>
            <div className="mt-2 text-3xl font-bold text-white">{totalClients > 0 ? `${totalClients}+` : "500+"}</div>
          </div>
        </div>
      </Section>

      {!loading && !error && spotlightCoaches.length > 0 && (
        <Section>
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
            {spotlightCoaches.map((coach) => (
              <TrainerCard key={coach.id} trainer={coach} imageHeight={uniformImageHeight} onOpen={setSelectedTrainerId} />
            ))}
          </div>
        </Section>
      )}

      <Section>
        {loading ? (
          <div className="surface-card p-6 text-zinc-300">Loading trainers...</div>
        ) : error ? (
          <div className="surface-card p-6 text-red-300">{error}</div>
        ) : coachGrid.length === 0 ? null : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
            {coachGrid.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} imageHeight={uniformImageHeight} onOpen={setSelectedTrainerId} />
            ))}
          </div>
        )}
      </Section>

      <Section>
        <div className="surface-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="label-chip">{page.pt_badge}</div>
              <h3 className="mt-4 text-3xl font-bold text-white">{page.pt_title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{page.pt_description}</p>
            </div>
            <Link to={page.pt_cta_link || "/contact"} className="btn-primary">
              {page.pt_cta_text}
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {personalTrainingPlans.map((plan, idx) => (
              <article key={plan.id ?? `${plan.name}-${idx}`} className="surface-card-soft mini-glow p-5">
                <h4 className="text-2xl font-bold text-white">{plan.name}</h4>
                <p className="mt-1 text-sm text-muted">{plan.details}</p>
                <div className="mt-4 space-y-2">
                  {(Array.isArray(plan.points) ? plan.points : []).map((point) => (
                    <div key={point} className="rounded-lg border border-line/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="surface-card-soft p-6 sm:p-8">
          <h3 className="text-3xl font-bold text-white">Our Coaching Process</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {coachingProcess.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="mini-glow rounded-2xl border border-line/10 bg-black/30 p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                    <Icon className="h-4.5 w-4.5 text-accent" />
                  </span>
                  <div className="mt-3 text-lg font-bold text-white">{step.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section className="pb-10">
        <div className="surface-card flex flex-col gap-6 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-3xl font-bold text-white">Need a Coach Recommendation?</h3>
            <p className="mt-2 text-muted">Tell us your goal, schedule, and current level. We will match you with the right coach.</p>
          </div>
          <Link to="/contact" className="btn-primary inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            Get matched now
          </Link>
        </div>
      </Section>

      {canUsePortal &&
        createPortal(
          <AnimatePresence>
            {selectedTrainer && selectedDetails && (
              <motion.div
                className="fixed inset-0 z-[140] bg-black/70 p-3 backdrop-blur-sm sm:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTrainerId(null)}
              >
                <motion.div
                  className="mx-auto max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-line/20 bg-[#0b1118] shadow-2xl"
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.98 }}
                  transition={{ duration: 0.28 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line/10 bg-[#0b1118]/95 px-4 py-3 backdrop-blur">
                    <div className="text-sm font-semibold text-zinc-300">Trainer Profile</div>
                    <button
                      type="button"
                      onClick={() => setSelectedTrainerId(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr]">
                    <div className="border-b border-line/10 lg:border-r lg:border-b-0 lg:border-line/10">
                      <ProImage
                        src={selectedTrainer.image}
                        alt={selectedTrainer.name}
                        heightClass="h-[340px] sm:h-[420px] lg:h-[560px]"
                        layoutId={`trainer-image-${selectedTrainer.id}`}
                      />
                    </div>

                    <div className="p-5 sm:p-7">
                      <h2 className="text-4xl font-bold text-white">{selectedTrainer.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-zinc-200">{selectedTrainer.role}</p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-line/10 bg-white/5 p-3">
                          <div className="text-xs text-muted">Experience</div>
                          <div className="mt-1 text-lg font-bold text-white">{selectedTrainer.years_experience}+ yrs</div>
                        </div>
                        <div className="rounded-xl border border-line/10 bg-white/5 p-3">
                          <div className="text-xs text-muted">Clients Coached</div>
                          <div className="mt-1 text-lg font-bold text-white">
                            {selectedTrainer.clients_coached ? `${selectedTrainer.clients_coached}+` : "100+"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-line/10 bg-white/5 p-4">
                        <div className="text-sm font-bold text-white">Detailed Profile</div>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{selectedDetails.longBio}</p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-line/10 bg-white/5 p-4">
                        <div className="text-sm font-bold text-white">Coaching Style</div>
                        <p className="mt-2 text-sm leading-relaxed text-muted">{selectedDetails.coachingStyle}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-line/10 bg-white/5 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <Target className="h-4 w-4 text-accent" />
                            Session Focus
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedDetails.sessionFocus.map((item) => (
                              <span key={item} className="rounded-full border border-line/20 bg-black/25 px-3 py-1 text-xs text-zinc-200">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-line/10 bg-white/5 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <Clock3 className="h-4 w-4 text-accent" />
                            Availability
                          </div>
                          <p className="mt-3 text-sm text-muted">{selectedDetails.availability}</p>
                        </div>

                        <div className="rounded-2xl border border-line/10 bg-white/5 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <ShieldCheck className="h-4 w-4 text-accent" />
                            Certifications
                          </div>
                          <ul className="mt-3 space-y-2 text-sm text-muted">
                            {selectedDetails.certifications.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-line/10 bg-white/5 p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-white">
                            <Medal className="h-4 w-4 text-accent" />
                            Achievements
                          </div>
                          <ul className="mt-3 space-y-2 text-sm text-muted">
                            {selectedDetails.achievements.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Link to="/contact" className="btn-primary gap-2" onClick={() => setSelectedTrainerId(null)}>
                          Book with {firstName(selectedTrainer.name)}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <a
                          href={selectedTrainer.intro_video_url || "#"}
                          target={selectedTrainer.intro_video_url ? "_blank" : undefined}
                          rel={selectedTrainer.intro_video_url ? "noreferrer" : undefined}
                          className="btn-secondary gap-2"
                        >
                          <PlayCircle className="h-4 w-4" />
                          {selectedTrainer.intro_video_url ? "Watch intro reel" : "Intro reel coming soon"}
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </PageRoot>
  );
}
