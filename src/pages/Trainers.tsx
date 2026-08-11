import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { Activity, BarChart3, Dumbbell, PlayCircle, ShieldCheck, Target, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getTrainersRequest } from "@src/redux/actions/trainers";
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

type TrainersState = {
  trainers?: {
    items?: TrainerRow[];
    ptContent?: PTContent | null;
    plans?: PTPlan[];
    loading?: boolean;
    error?: string | null;
  };
};

const fallbackContent: Required<
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
  pt_description: "Train directly with a coach through personalized sessions based on your goal, level and schedule.",
  pt_cta_text: "Book personal training",
  pt_cta_link: "/contact",
  hero_badge: "Coaching Team",
  hero_title: "Train with coaches who build real strength.",
  hero_description: "Progression, technique standards and practical coaching for members who want consistency.",
  hero_primary_cta_text: "Book a session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View plans",
  hero_secondary_cta_link: "/pricing",
  strength_section_title: "Strength floor snapshot",
  equipment_section_title: "Training zones",
  spotlight_count: 3,
};

const fallbackPlans: PTPlan[] = [
  { name: "Starter PT", details: "2 sessions / week", points: ["Form correction", "Basic split design", "Habit coaching"] },
  { name: "Progress PT", details: "3 sessions / week", points: ["Strength progression", "Body recomposition", "Weekly check-ins"] },
  { name: "Elite PT", details: "5 sessions / week", points: ["Advanced programming", "Nutrition guidance", "Performance tracking"] },
];

const fallbackMetrics: MetricItem[] = [
  { label: "Dumbbell Range", value: "2.5kg - 50kg", sub: "Progressive loading setup", icon: "Dumbbell" },
  { label: "Power Racks", value: "8 Stations", sub: "Squat, bench and accessories", icon: "ShieldCheck" },
  { label: "Coaching Focus", value: "Technique", sub: "On-floor correction", icon: "Target" },
];

const fallbackZones: ZoneItem[] = [
  { title: "Dumbbell Zone", desc: "Heavy dumbbells and benches for hypertrophy blocks.", icon: "Dumbbell" },
  { title: "Barbell Strength Lane", desc: "Racks, benches and platform access for serious progression.", icon: "BarChart3" },
  { title: "Performance Conditioning", desc: "Rower, sled, ropes and loaded carries.", icon: "Activity" },
];

const iconMap = { Activity, Dumbbell, ShieldCheck, Target, BarChart3 };

function getIcon(icon?: string) {
  return iconMap[icon as keyof typeof iconMap] ?? Dumbbell;
}

function trainerDetails(trainer: TrainerRow) {
  return {
    longBio: trainer.long_bio || trainer.bio || "Professional trainer focused on sustainable strength, technique quality and progression.",
    coachingStyle:
      trainer.coaching_style || "Form-first coaching with progressive overload, individualized intensity and performance review.",
    availability: trainer.availability || "Mon-Sat | Morning and evening slots available",
    sessionFocus:
      trainer.session_focus?.length
        ? trainer.session_focus
        : trainer.specialties?.length
          ? trainer.specialties.slice(0, 5)
          : ["Strength", "Fat loss", "Mobility", "Technique"],
    certifications: trainer.certifications ?? [],
    achievements: trainer.achievements ?? [],
  };
}

export default function Trainers() {
  const dispatch = useDispatch();
  const { items = [], ptContent, plans = [], loading = false, error = null } = useSelector(
    (state: TrainersState) => state.trainers ?? {}
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(getTrainersRequest());
  }, [dispatch]);

  const page = { ...fallbackContent, ...(ptContent || {}) };
  const trainers = items;
  const selectedTrainer = useMemo(() => trainers.find((trainer) => trainer.id === selectedId) ?? null, [selectedId, trainers]);
  const details = selectedTrainer ? trainerDetails(selectedTrainer) : null;
  const ptPlans = plans.length ? plans : fallbackPlans;
  const metrics = page.strength_metrics?.length ? page.strength_metrics : fallbackMetrics;
  const zones = page.equipment_zones?.length ? page.equipment_zones : fallbackZones;

  useEffect(() => {
    if (!selectedTrainer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedTrainer]);

  return (
    <PageRoot>
      <PublicSEO
        title="Trainers | A&A Health Club Butwal"
        description="Meet A&A Health Club trainers and explore personal training options for strength, fat loss and performance goals."
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
          <Surface>
            <h2 className="text-xl font-semibold text-[var(--public-text)]">{page.strength_section_title}</h2>
            <div className="mt-5 space-y-4">
              {metrics.slice(0, 4).map((metric) => {
                const Icon = getIcon(metric.icon);
                return (
                  <div key={metric.label} className="flex items-start justify-between gap-4 border-b border-[var(--public-line)] pb-4 last:border-0 last:pb-0">
                    <div className="flex gap-3">
                      <Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--public-accent-strong)]" />
                      <div>
                        <div className="font-semibold text-[var(--public-text)]">{metric.label}</div>
                        <div className="text-sm text-[var(--public-muted)]">{metric.sub}</div>
                      </div>
                    </div>
                    <div className="text-right font-semibold text-[var(--public-text)]">{metric.value}</div>
                  </div>
                );
              })}
            </div>
          </Surface>
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading eyebrow="Training environment" title={page.equipment_section_title} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {zones.map((zone) => {
            const Icon = getIcon(zone.icon);
            return (
              <Card key={zone.title}>
                <Icon className="h-6 w-6 text-[var(--public-accent-strong)]" />
                <h2 className="mt-5 text-2xl font-semibold text-[var(--public-text)]">{zone.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{zone.desc}</p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Coach profiles"
          title="Professional profiles, clear specialties."
          description="Review each trainer’s role, focus areas and available profile details before booking."
        />
        {loading ? <LoadingState label="Loading trainers..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && trainers.length === 0 ? <EmptyState title="No trainers added yet" /> : null}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {trainers.map((trainer) => (
            <Card key={trainer.id} className="group p-0">
              <button type="button" onClick={() => setSelectedId(trainer.id)} className="block w-full text-left">
                <ImageFrame src={trainer.image} alt={trainer.name} className="aspect-[4/5] rounded-b-none border-0" imgClassName="object-contain bg-[#11100e]" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--public-text)]">{trainer.name}</h2>
                      <p className="mt-1 text-sm text-[var(--public-muted)]">{trainer.role}</p>
                    </div>
                    {trainer.offers_personal_training ? <Badge tone="accent">PT</Badge> : null}
                  </div>
                  {trainer.bio ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--public-muted)]">{trainer.bio}</p> : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(trainer.specialties ?? []).slice(0, 3).map((specialty) => (
                      <Badge key={specialty}>{specialty}</Badge>
                    ))}
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading eyebrow={page.pt_badge} title={page.pt_title} description={page.pt_description} action={<PrimaryCTA to={page.pt_cta_link || "/contact"}>{page.pt_cta_text}</PrimaryCTA>} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {ptPlans.map((plan, index) => (
            <Card key={plan.id ?? `${plan.name}-${index}`}>
              <h2 className="text-2xl font-semibold text-[var(--public-text)]">{plan.name}</h2>
              <p className="mt-1 text-sm text-[var(--public-muted)]">{plan.details}</p>
              <div className="mt-5 space-y-3">
                {plan.points.map((point) => (
                  <div key={point} className="flex gap-3 text-sm leading-6 text-[var(--public-muted)]">
                    <Target className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent-strong)]" />
                    {point}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Users className="h-6 w-6 text-[var(--public-accent-strong)]" />
              <h2 className="mt-4 text-3xl font-semibold text-[var(--public-text)]">Need help choosing a coach?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">
                Share your goal, schedule and current level. The team can recommend a good fit.
              </p>
            </div>
            <PrimaryCTA to="/contact">Get matched</PrimaryCTA>
          </div>
        </Surface>
      </Section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {selectedTrainer && details ? (
                <motion.div className="fixed inset-0 z-[120] bg-black/72 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)}>
                  <motion.div
                    className="mx-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--public-line)] bg-[#11100e]"
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 18, opacity: 0 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--public-line)] px-5 py-4">
                      <div className="text-sm font-semibold text-[var(--public-muted)]">Trainer profile</div>
                      <button type="button" onClick={() => setSelectedId(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--public-line)] text-[var(--public-text)]" aria-label="Close trainer profile">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="overflow-y-auto">
                      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr]">
                        <ImageFrame src={selectedTrainer.image} alt={selectedTrainer.name} className="h-[360px] rounded-none border-0 lg:h-full" imgClassName="object-contain bg-[#0d0c0b]" />
                        <div className="p-5 sm:p-7">
                          <h2 className="text-4xl font-semibold text-[var(--public-text)]">{selectedTrainer.name}</h2>
                          <p className="mt-1 text-sm text-[var(--public-muted)]">{selectedTrainer.role}</p>
                          <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-[var(--public-line)] p-4">
                              <div className="text-xs text-[var(--public-muted)]">Experience</div>
                              <div className="mt-1 text-xl font-semibold text-[var(--public-text)]">{selectedTrainer.years_experience}+ yrs</div>
                            </div>
                            <div className="rounded-xl border border-[var(--public-line)] p-4">
                              <div className="text-xs text-[var(--public-muted)]">Availability</div>
                              <div className="mt-1 text-sm font-semibold text-[var(--public-text)]">{details.availability}</div>
                            </div>
                          </div>
                          <div className="mt-5 space-y-4">
                            <div>
                              <h3 className="font-semibold text-[var(--public-text)]">Profile</h3>
                              <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{details.longBio}</p>
                            </div>
                            <div>
                              <h3 className="font-semibold text-[var(--public-text)]">Coaching style</h3>
                              <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{details.coachingStyle}</p>
                            </div>
                            <div>
                              <h3 className="font-semibold text-[var(--public-text)]">Session focus</h3>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {details.sessionFocus.map((item) => (
                                  <Badge key={item}>{item}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <PrimaryCTA to="/contact">Book with {selectedTrainer.name.split(" ")[0] || "coach"}</PrimaryCTA>
                            {selectedTrainer.intro_video_url ? (
                              <a href={selectedTrainer.intro_video_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--public-line)] px-5 py-3 text-sm font-semibold text-[var(--public-text)]">
                                <PlayCircle className="h-4 w-4" />
                                Watch intro
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </PageRoot>
  );
}
