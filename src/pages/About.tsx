import { CheckCircle2, Dumbbell, Gauge, HeartPulse, ShieldCheck, Target, Trophy, Users } from "lucide-react";
import {
  Badge,
  Card,
  ImageFrame,
  PageRoot,
  PrimaryCTA,
  PublicSEO,
  Section,
  SectionHeading,
  SecondaryCTA,
  SplitFeature,
  Surface,
} from "./PageKit";

const stats = [
  { label: "Years Coaching", value: "10+", icon: Gauge },
  { label: "Member Transformations", value: "5000+", icon: Users },
  { label: "Certified Coaches", value: "12", icon: ShieldCheck },
  { label: "Floor Size", value: "2000 m2", icon: Dumbbell },
];

const principles = [
  {
    title: "Programming first",
    desc: "Members train with structure instead of random workouts.",
    icon: Target,
  },
  {
    title: "Technique standards",
    desc: "Form quality, safe mechanics and repeatable execution matter on every session.",
    icon: ShieldCheck,
  },
  {
    title: "Track and adjust",
    desc: "Progress is reviewed through real performance, consistency and feedback.",
    icon: Gauge,
  },
];

const method = [
  ["01", "Assessment", "Mobility, strength baseline and goal profiling."],
  ["02", "Program design", "Training split, progression model and recovery guidance."],
  ["03", "Coached execution", "On-floor correction and intensity targets."],
  ["04", "Review", "Plan updates based on real training response."],
];

const maximusPoints = [
  "Squat, Bench and Deadlift specialization",
  "Meet-prep cycles and peaking blocks",
  "Competition-standard technique feedback",
  "Beginner to advanced team progression",
];

const gallery = [
  "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1596357395217-80de13130e92?q=80&w=1600&auto=format&fit=crop",
];

export default function About() {
  return (
    <PageRoot>
      <PublicSEO
        title="About A&A Health Club | Coaching and Strength Culture in Butwal"
        description="Learn about A&A Health Club's coaching philosophy, training process and Maximus Strength powerlifting group in Butwal."
      />

      <Section animated={false} className="pt-10 sm:pt-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Badge tone="accent">About A&A Health Club</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-6xl">
              Built for measurable training, not fitness noise.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)]">
              A&A Health Club combines disciplined coaching, proper equipment and a focused gym floor in Butwal.
              Members train with clear progression, structured sessions and regular check-ins.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to="/contact">Book a trial</PrimaryCTA>
              <SecondaryCTA to="/pricing">View pricing</SecondaryCTA>
            </div>
          </div>
          <ImageFrame
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop"
            alt="A&A Health Club training space"
            className="aspect-[4/3] lg:aspect-[5/4]"
            loading="eager"
          />
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                <div className="mt-4 text-3xl font-semibold text-[var(--public-text)]">{stat.value}</div>
                <div className="mt-1 text-sm text-[var(--public-muted)]">{stat.label}</div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <SectionHeading
          eyebrow="Coaching philosophy"
          title="A simple process, repeated well."
          description="A&A’s approach is practical: assess properly, program clearly, coach execution and adjust based on what actually happens in training."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <Card key={principle.title}>
                <Icon className="h-6 w-6 text-[var(--public-accent-strong)]" />
                <h2 className="mt-5 text-2xl font-semibold text-[var(--public-text)]">{principle.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{principle.desc}</p>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section>
        <SplitFeature
          eyebrow="How we work"
          title="Structure first, motivation second."
          description="The training floor is built around consistency. Members are guided through technique, effort, recovery and long-term progression."
          image={gallery[1]}
          imageAlt="Coached gym training"
          reverse
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {method.map(([step, title, desc]) => (
              <div key={step} className="rounded-xl border border-[var(--public-line)] bg-white/[0.03] p-4">
                <div className="text-xs font-semibold text-[var(--public-accent-strong)]">STEP {step}</div>
                <h3 className="mt-2 text-lg font-semibold text-[var(--public-text)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </SplitFeature>
      </Section>

      <Section id="maximus-strength" className="bg-[var(--public-bg-soft)]">
        <Surface>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge tone="accent">Maximus Strength</Badge>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--public-text)] sm:text-4xl">
                Powerlifting has a dedicated identity here.
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--public-muted)]">
                Maximus Strength is the focused lifting group at A&A for athletes pursuing technical and competitive growth.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {maximusPoints.map((point) => (
                  <div key={point} className="flex gap-3 rounded-xl border border-[var(--public-line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--public-muted)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-accent-strong)]" />
                    {point}
                  </div>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="https://www.instagram.com/teammaximusstrength/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--public-accent)] px-5 py-3 text-sm font-extrabold text-[#14110d]"
                >
                  <Trophy className="h-4 w-4" />
                  Visit Instagram
                </a>
                <SecondaryCTA to="/contact">Join Maximus</SecondaryCTA>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ImageFrame src={gallery[0]} alt="Powerlifting training" className="aspect-[4/5]" />
              <div className="space-y-3 pt-8">
                <ImageFrame src={gallery[1]} alt="Gym strength training" className="aspect-square" />
                <ImageFrame src={gallery[2]} alt="Gym equipment" className="aspect-square" />
              </div>
            </div>
          </div>
        </Surface>
      </Section>

      <Section>
        <Surface className="text-center">
          <HeartPulse className="mx-auto h-7 w-7 text-[var(--public-accent-strong)]" />
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold text-[var(--public-text)] sm:text-4xl">
            Ready to train with intent?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">
            Start with a trial and discuss your goals, current level and schedule with the team.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCTA to="/contact">Book trial</PrimaryCTA>
            <SecondaryCTA to="/facilities">See facilities</SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
