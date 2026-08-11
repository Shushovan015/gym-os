import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Clock3, Dumbbell, ShieldCheck, Star, Trophy, Users } from "lucide-react";
import { getFacilitiesRequest } from "@src/redux/actions/facilities";
import { getHomeRequest } from "@src/redux/actions/home";
import { getTestimonialsRequest } from "@src/redux/actions/testimonials";
import { getTrainersRequest } from "@src/redux/actions/trainers";
import {
  Badge,
  Card,
  EmptyState,
  ImageFrame,
  PageRoot,
  PrimaryCTA,
  PublicSEO,
  Section,
  SectionHeading,
  SecondaryCTA,
  SplitFeature,
  Surface,
  TextLink,
} from "./PageKit";

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

type FacilityItem = {
  id: number;
  kind: "zone" | "amenity";
  title: string;
  description: string;
  tag?: string;
  image?: string;
  sort_order: number;
  is_active: boolean;
};

type TrainerItem = {
  id: number;
  name: string;
  role: string;
  image?: string;
  specialties?: string[];
};

type Testimonial = {
  id: number;
  name: string;
  goal: string;
  quote: string;
  image?: string;
};

type HomeState = {
  home?: {
    content?: Partial<HomeContent> | null;
    status?: Array<{ label: string; value: string; icon?: string }>;
    points?: Array<{ point: string }>;
  };
  facilities?: {
    items?: FacilityItem[];
  };
  trainers?: {
    items?: TrainerItem[];
  };
  testimonials?: {
    items?: Testimonial[];
    loading?: boolean;
  };
};

const fallbackHome: HomeContent = {
  hero_badge: "A&A Health Club | Butwal, Rupandehi",
  hero_title: "Serious training, coached with structure.",
  hero_description:
    "A disciplined gym environment for strength, fat loss and performance training in Butwal.",
  hero_image:
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Book a Free Trial",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View Memberships",
  hero_secondary_cta_link: "/pricing",
  status_title: "Today at A&A",
  zones_title: "Training zones",
  coaches_title: "Coaching that keeps training focused",
  coaches_subtitle: "Train with experienced coaches across strength, conditioning and body recomposition.",
  maximus_badge: "Maximus Strength",
  maximus_title: "Powerlifting group at A&A",
  maximus_description:
    "A focused strength community for lifters who want better Squat, Bench and Deadlift progression.",
  maximus_image:
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  maximus_learn_more_link: "/about#maximus-strength",
  maximus_instagram_link: "https://www.instagram.com/teammaximusstrength/",
  testimonials_title: "Member feedback",
  testimonials_subtitle: "Real words from people training at A&A.",
  gallery_title: "Inside the gym",
  final_cta_title: "Ready to train with more structure?",
  final_cta_description: "Book a trial or visit the gym to see the floor, coaches and membership options.",
  final_primary_cta_text: "Book a trial",
  final_primary_cta_link: "/contact",
  final_secondary_cta_text: "Explore pricing",
  final_secondary_cta_link: "/pricing",
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
    description: "Conditioning equipment for endurance, fat loss and warm-up work.",
    tag: "Conditioning",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop",
    sort_order: 2,
    is_active: true,
  },
  {
    id: -3,
    kind: "zone",
    title: "Functional Area",
    description: "Open training space for mobility, kettlebells, carries and athletic work.",
    tag: "Functional",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
    sort_order: 3,
    is_active: true,
  },
];

const fallbackStatus = [
  { label: "Open Gym", value: "5:00 AM - 9:00 PM", icon: "Clock3" },
  { label: "Trial Sessions", value: "Available daily", icon: "ShieldCheck" },
  { label: "Training Focus", value: "Strength + Conditioning", icon: "Dumbbell" },
];

const fallbackGallery = [
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549476464-37392f717541?q=80&w=1600&auto=format&fit=crop",
];

const iconMap = {
  Clock3,
  ShieldCheck,
  Dumbbell,
  Trophy,
  Star,
  Users,
};

function metricIcon(name?: string) {
  return iconMap[name as keyof typeof iconMap] ?? Dumbbell;
}

export default function Home() {
  const dispatch = useDispatch();
  const { homeSlice, facilitiesSlice, trainersSlice, testimonialsSlice } = useSelector((state: HomeState) => ({
    homeSlice: state.home,
    facilitiesSlice: state.facilities,
    trainersSlice: state.trainers,
    testimonialsSlice: state.testimonials,
  }));

  useEffect(() => {
    dispatch(getHomeRequest());
    dispatch(getFacilitiesRequest());
    dispatch(getTrainersRequest());
    dispatch(getTestimonialsRequest());
  }, [dispatch]);

  const home = { ...fallbackHome, ...(homeSlice?.content ?? {}) };
  const statusItems = homeSlice?.status?.length ? homeSlice.status : fallbackStatus;
  const points = homeSlice?.points?.map((item) => item.point).filter(Boolean) ?? [
    "Squat, Bench and Deadlift focused training",
    "Technique feedback and progression planning",
    "Team sessions for beginner to advanced lifters",
  ];

  const zones = useMemo(() => {
    const items = facilitiesSlice?.items ?? [];
    const activeZones = items.filter((item) => item.kind === "zone" && item.is_active !== false).slice(0, 3);
    return activeZones.length ? activeZones : fallbackZones;
  }, [facilitiesSlice?.items]);

  const trainers = (trainersSlice?.items ?? []).slice(0, 3);
  const testimonials = testimonialsSlice?.items ?? [];

  const heroMetrics =
    home.hero_metrics?.length
      ? home.hero_metrics
      : [
          { label: "Training Zones", value: String(zones.length), icon: "Dumbbell" },
          { label: "Coaches", value: String(Math.max(trainers.length, 1)), icon: "Users" },
          { label: "Location", value: "Butwal", icon: "ShieldCheck" },
        ];

  const cmsGalleryImages =
    home.gallery_images
      ?.map((item) => (typeof item === "string" ? item : item.url))
      .filter(Boolean) ?? [];
  const zoneGalleryImages = zones.map((zone) => zone.image).filter((image): image is string => Boolean(image));
  const galleryImages = cmsGalleryImages.length
    ? cmsGalleryImages
    : zoneGalleryImages.length >= 3
      ? zoneGalleryImages
      : fallbackGallery;

  return (
    <PageRoot>
      <PublicSEO
        title="A&A Health Club Butwal | Strength, Coaching and Fitness"
        description="A&A Health Club in Butwal, Rupandehi offers structured strength training, coaching, facilities, memberships and trial sessions."
      />

      <section className="relative overflow-hidden border-b border-[var(--public-line)]">
        <div className="absolute inset-0">
          <img src={home.hero_image} alt="A&A Health Club training floor" className="h-full w-full object-cover opacity-64" loading="eager" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,16,14,0.96),rgba(16,16,14,0.74)_48%,rgba(16,16,14,0.48))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,14,0.1),rgba(16,16,14,0.9))]" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl grid-cols-1 items-end gap-10 px-5 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-16">
          <div className="max-w-3xl pb-6">
            <Badge tone="accent">{home.hero_badge}</Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-7xl">
              {home.hero_title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)] sm:text-lg">{home.hero_description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={home.hero_primary_cta_link || "/contact"}>{home.hero_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={home.hero_secondary_cta_link || "/pricing"}>{home.hero_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-3 lg:grid-cols-1">
            {heroMetrics.slice(0, 3).map((metric) => {
              const Icon = metricIcon(metric.icon);
              return (
                <div key={metric.label} className="rounded-2xl border border-white/16 bg-[#11100e]/72 p-4 backdrop-blur-sm">
                  <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                  <div className="mt-3 text-2xl font-semibold text-[var(--public-text)]">{metric.value}</div>
                  <div className="text-sm text-[var(--public-muted)]">{metric.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {statusItems.slice(0, 3).map((item) => {
            const Icon = metricIcon(item.icon);
            return (
              <Card key={item.label}>
                <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                <h2 className="mt-4 text-xl font-semibold text-[var(--public-text)]">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{item.value}</p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading
          eyebrow="Facilities"
          title={home.zones_title || "Training zones built for focused work"}
          description="The gym floor is organized around strength, conditioning and practical movement so members can train with purpose."
          action={<TextLink to="/facilities">Explore facilities</TextLink>}
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {zones.map((zone, index) => (
            <Link key={zone.id} to="/facilities" className={index === 0 ? "lg:col-span-2" : ""}>
              <ImageFrame src={zone.image} alt={zone.title} className={index === 0 ? "aspect-[16/10]" : "aspect-[4/3]"} />
              <div className="mt-4">
                {zone.tag ? <Badge>{zone.tag}</Badge> : null}
                <h3 className="mt-3 text-2xl font-semibold text-[var(--public-text)]">{zone.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{zone.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Coaching"
          title={home.coaches_title}
          description={home.coaches_subtitle}
          action={<TextLink to="/trainers">Meet trainers</TextLink>}
        />
        {trainers.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {trainers.map((trainer) => (
              <Card key={trainer.id} className="p-0">
                <ImageFrame src={trainer.image} alt={trainer.name} className="aspect-[4/5] rounded-b-none border-0" />
                <div className="p-5">
                  <h3 className="text-xl font-semibold text-[var(--public-text)]">{trainer.name}</h3>
                  <p className="mt-1 text-sm text-[var(--public-muted)]">{trainer.role}</p>
                  {trainer.specialties?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {trainer.specialties.slice(0, 3).map((specialty) => (
                        <Badge key={specialty}>{specialty}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Trainer profiles are being prepared" description="Trainer data can be managed from the existing admin content tools." />
        )}
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SplitFeature
          eyebrow={home.maximus_badge}
          title={home.maximus_title}
          description={home.maximus_description}
          image={home.maximus_image}
          imageAlt="Maximus Strength powerlifting training"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {points.slice(0, 4).map((point) => (
              <div key={point} className="rounded-xl border border-[var(--public-line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--public-muted)]">
                {point}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <PrimaryCTA to={home.maximus_learn_more_link || "/about#maximus-strength"}>Learn more</PrimaryCTA>
            <a
              href={home.maximus_instagram_link || "https://www.instagram.com/teammaximusstrength/"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--public-line-strong)] px-5 py-3 text-sm font-semibold text-[var(--public-text)] transition hover:border-[var(--public-accent)]"
            >
              Instagram
            </a>
          </div>
        </SplitFeature>
      </Section>

      <Section>
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Badge tone="accent">Membership</Badge>
              <h2 className="mt-4 text-3xl font-semibold text-[var(--public-text)]">Choose a plan that matches your training routine.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">
                Compare memberships, then contact the team for the plan that fits your goals, schedule and current level.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to="/pricing">View memberships</PrimaryCTA>
              <SecondaryCTA to="/contact">Ask for guidance</SecondaryCTA>
            </div>
          </div>
        </Surface>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading eyebrow="Proof" title={home.testimonials_title} description={home.testimonials_subtitle} />
        {testimonials.length ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {testimonials.slice(0, 3).map((testimonial) => (
              <Card key={testimonial.id}>
                <div className="flex items-center gap-3">
                  <ImageFrame src={testimonial.image} alt={testimonial.name} className="h-12 w-12 shrink-0 rounded-full" />
                  <div>
                    <h3 className="font-semibold text-[var(--public-text)]">{testimonial.name}</h3>
                    <p className="text-xs text-[var(--public-muted)]">{testimonial.goal}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-[var(--public-muted)]">"{testimonial.quote}"</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No testimonials added yet" description="The page will show testimonials once they are available in the CMS." />
        )}
      </Section>

      <Section>
        <SectionHeading eyebrow="Gallery" title={home.gallery_title || "Inside A&A Health Club"} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {galleryImages.slice(0, 4).map((image, index) => (
            <ImageFrame key={`${image}-${index}`} src={image} alt={`A&A Health Club gallery ${index + 1}`} className="aspect-[4/5]" />
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <Surface className="text-center">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold leading-tight text-[var(--public-text)] sm:text-4xl">
            {home.final_cta_title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{home.final_cta_description}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCTA to={home.final_primary_cta_link || "/contact"}>{home.final_primary_cta_text}</PrimaryCTA>
            <SecondaryCTA to={home.final_secondary_cta_link || "/pricing"}>{home.final_secondary_cta_text}</SecondaryCTA>
          </div>
        </Surface>
      </Section>

      <div className="fixed inset-x-0 bottom-3 z-[55] px-4 sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-full border border-[var(--public-line)] bg-[#11100e]/94 p-1.5 backdrop-blur-xl">
          <Link to="/contact" className="rounded-full bg-[var(--public-accent)] px-4 py-2.5 text-center text-xs font-extrabold text-[#14110d]">
            Book Trial
          </Link>
          <Link to="/pricing" className="rounded-full border border-[var(--public-line)] px-4 py-2.5 text-center text-xs font-semibold text-[var(--public-text)]">
            Plans
          </Link>
        </div>
      </div>
    </PageRoot>
  );
}
