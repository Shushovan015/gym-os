import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Gauge,
  HeartPulse,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  ChevronLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PageRoot, Section, Surface, SurfaceSoft, PrimaryCTA, SecondaryCTA } from "./PageKit";

const stats = [
  { label: "Years Coaching", value: "10+", icon: Clock3 },
  { label: "Member Transformations", value: "5000+", icon: Users },
  { label: "Certified Coaches", value: "12", icon: ShieldCheck },
  { label: "Floor Size", value: "2000 m2", icon: Dumbbell },
];

const principles = [
  {
    title: "Programming First",
    desc: "Every member gets a structured path instead of random workouts.",
    icon: BarChart3,
  },
  {
    title: "Technique Standards",
    desc: "Form quality and safe mechanics are non-negotiable.",
    icon: ShieldCheck,
  },
  {
    title: "Track and Adjust",
    desc: "Weekly review and progression updates based on performance.",
    icon: Target,
  },
];

const method = [
  {
    step: "01",
    title: "Assessment",
    desc: "Mobility, strength baseline, and goal profiling.",
  },
  {
    step: "02",
    title: "Program Design",
    desc: "Split, progression model, and recovery guidance.",
  },
  {
    step: "03",
    title: "Coached Execution",
    desc: "On-floor correction, effort targets, and consistency checks.",
  },
  {
    step: "04",
    title: "Performance Review",
    desc: "Update the plan from real data, not guesswork.",
  },
];

const maximusPoints = [
  "Squat, Bench, Deadlift specialization",
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
  const [isPaused, setIsPaused] = useState(false);


  const [galleryIndex, setGalleryIndex] = useState(0);
  const totalGallery = gallery.length;

  const prevGallery = () => {
    setGalleryIndex((prev) => (prev === 0 ? totalGallery - 1 : prev - 1));
  };

  const nextGallery = () => {
    setGalleryIndex((prev) => (prev === totalGallery - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (isPaused || totalGallery <= 1) return;

    const id = setInterval(() => {
      setGalleryIndex((prev) => (prev === totalGallery - 1 ? 0 : prev + 1));
    }, 4000);

    return () => clearInterval(id);
  }, [isPaused, totalGallery]);
  return (
    <PageRoot>
      <Section className="pt-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="surface-card relative overflow-hidden p-7 sm:p-8 lg:col-span-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/20 blur-3xl" />
            <div className="label-chip">About A&A Health Club</div>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] text-white">
              Built for measurable results, not fitness noise.
            </h1>
            <p className="mt-4 max-w-3xl text-muted leading-relaxed">
              A&A Health Club combines disciplined coaching, proper equipment, and performance
              systems. Members train with clear progression, structured sessions, and regular
              check-ins.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <PrimaryCTA to="/contact">Book trial</PrimaryCTA>
              <SecondaryCTA to="/pricing">View pricing</SecondaryCTA>
            </div>
          </div>

          <div className="surface-card-soft overflow-hidden lg:col-span-4">
            <img
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop"
              alt="Gym interior"
              className="h-full w-full min-h-[300px] object-cover"
            />
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <SurfaceSoft key={s.label} className="mini-glow">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                  <Icon className="h-4.5 w-4.5 text-accent" />
                </div>
                <div className="mt-3 text-3xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </SurfaceSoft>
            );
          })}
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Surface className="lg:col-span-7">
            <div className="text-xs font-semibold tracking-[0.15em] text-zinc-400">WHY MEMBERS STAY</div>
            <h2 className="mt-3 text-3xl font-bold text-white">Our Coaching Principles</h2>
            <div className="mt-6 space-y-4">
              {principles.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className="mini-glow rounded-2xl border border-line/10 bg-white/5 p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                        <Icon className="h-4.5 w-4.5 text-accent" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-white">{p.title}</h3>
                        <p className="mt-1 text-sm text-muted">{p.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>

          <SurfaceSoft className="lg:col-span-5">
            <h3 className="text-2xl font-bold text-white">Training Philosophy</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Strength is built with repeatable process, not motivation spikes. Our floor culture
              is simple: execute correctly, progress consistently, recover smartly.
            </p>
            <div className="mt-5 space-y-3">
              {[
                { label: "Effort Quality", icon: Gauge },
                { label: "Movement Integrity", icon: HeartPulse },
                { label: "Long-Term Progress", icon: Trophy },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="mini-glow rounded-xl border border-line/10 bg-black/25 px-4 py-3 text-sm text-zinc-200 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-accent" />
                    {item.label}
                  </div>
                );
              })}
            </div>
          </SurfaceSoft>
        </div>
      </Section>

      <Section>
        <Surface>
          <h2 className="text-3xl font-bold text-white">How We Work</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {method.map((m) => (
              <div key={m.step} className="mini-glow rounded-2xl border border-line/10 bg-white/5 p-5">
                <div className="text-xs font-bold tracking-[0.18em] text-zinc-400">STEP {m.step}</div>
                <div className="mt-2 text-xl font-bold text-white">{m.title}</div>
                <p className="mt-2 text-sm text-muted">{m.desc}</p>
              </div>
            ))}
          </div>
        </Surface>
      </Section>

      <Section>
        <Surface className="bg-gradient-to-r from-white/10 via-white/5 to-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="label-chip">Maximus Strength</div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">
                Powerlifting Group at A&A
              </h2>
              <p className="mt-3 text-muted leading-relaxed">
                A focused strength community for athletes pursuing technical and competitive growth.
              </p>

              <div className="mt-5 space-y-2">
                {maximusPoints.map((point) => (
                  <div key={point} className="mini-glow rounded-xl border border-line/10 bg-black/25 px-4 py-3 text-sm text-zinc-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href="https://www.instagram.com/teammaximusstrength/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  <Trophy className="h-4 w-4" />
                  Visit Instagram
                </a>
                <SecondaryCTA to="/contact">Join Maximus</SecondaryCTA>
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl bg-white/5 aspect-[16/10]"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onFocusCapture={() => setIsPaused(true)}
              onBlurCapture={() => setIsPaused(false)}
            >
              <div
                className="flex h-full w-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${galleryIndex * 100}%)` }}
              >
                {gallery.map((img, idx) => (
                  <img
                    key={`${img}-${idx}`}
                    src={img}
                    alt={`Maximus gallery ${idx + 1}`}
                    className="h-full w-full shrink-0 object-cover"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={prevGallery}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center hover:bg-black/60"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={nextGallery}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/45 border border-white/20 text-white flex items-center justify-center hover:bg-black/60"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {gallery.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGalleryIndex(idx)}
                    className={`h-2 w-2 rounded-full ${idx === galleryIndex ? "bg-white" : "bg-white/45"}`}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

          </div>
        </Surface>
      </Section>

      <Section className="pb-10">
        <Surface className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-bold text-white">Ready to train with intent?</h3>
            <p className="mt-2 text-muted">Start with a trial and get your personalized training roadmap.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryCTA to="/contact">
              Book trial
              <ChevronRight className="h-4 w-4" />
            </PrimaryCTA>
            <SecondaryCTA to="/pricing">View pricing</SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
