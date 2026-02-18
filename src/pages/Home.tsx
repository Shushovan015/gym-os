import { Link } from "react-router-dom";

const stats = [
  { value: "2000 m2", label: "Luxury Training Floor" },
  { value: "50+", label: "Imported Machines" },
  { value: "12", label: "Elite Coaches" },
  { value: "5AM-9PM", label: "Open Daily" },
];

const pillars = [
  {
    title: "Performance Lab",
    desc: "Strength zones, progressive loading setup, and smart station flow for uninterrupted sessions.",
  },
  {
    title: "Body Recomposition",
    desc: "Structured plans for fat loss and muscle gain with weekly check-ins and coach tracking.",
  },
  {
    title: "Recovery First",
    desc: "Mobility tools, guided cooldown protocols, and injury-aware programming for sustainable progress.",
  },
];

const programs = [
  {
    name: "Executive Physique",
    subtitle: "12-week transformation",
    points: ["Custom split", "Nutrition roadmap", "Weekly progress review"],
  },
  {
    name: "Strength Foundation",
    subtitle: "Technique + power",
    points: ["Form correction", "Progressive overload", "Performance logs"],
  },
  {
    name: "Athletic Conditioning",
    subtitle: "Speed, stamina, agility",
    points: ["HIIT protocols", "Functional circuits", "Endurance tracking"],
  },
];

const coaches = [
  {
    name: "Arjun K.",
    role: "Head Strength Coach",
    focus: ["Barbell Mechanics", "Hypertrophy", "Athlete Prep"],
  },
  {
    name: "Riya S.",
    role: "Body Recomp Specialist",
    focus: ["Fat Loss", "Lifestyle Systems", "Accountability"],
  },
  {
    name: "Niraj T.",
    role: "Functional Performance",
    focus: ["Mobility", "Core Control", "Conditioning"],
  },
];

const testimonials = [
  {
    quote:
      "The environment feels premium and focused. I stayed consistent for the first time in years.",
    author: "Member, 8 months",
  },
  {
    quote:
      "Programming and coaching quality are excellent. My strength numbers improved every month.",
    author: "Member, 1 year",
  },
  {
    quote:
      "Clean setup, serious culture, and real results. It feels like a private performance club.",
    author: "Member, 6 months",
  },
];

export default function Home() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-24">
      {/* HERO */}
      <section className="relative isolate overflow-hidden min-h-[calc(100dvh-4rem)] bg-[#090d13]">
        <img
          src="https://images.unsplash.com/photo-1549476464-37392f717541?q=80&w=2070&auto=format&fit=crop"
          alt="Premium gym interior"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/65 to-black/45" />
        <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className={`relative ${sectionPad} min-h-[calc(100dvh-4rem)] flex items-center py-10 lg:py-12`}>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur">
                A&A Health Club | Butwal, Rupandehi
              </div>

              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.02]">
                Train in a space
                <span className="block text-white/75">built for elite results.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base sm:text-lg text-zinc-200/90 leading-relaxed">
                Premium equipment, expert-led programming, and a disciplined culture
                designed for people who expect visible progress.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  to="/pricing"
                  className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition"
                >
                  View membership
                </Link>
                <Link
                  to="/contact"
                  className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition backdrop-blur"
                >
                  Book a free trial
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-black/40 px-4 py-4 backdrop-blur">
                    <div className="text-xl font-black text-white">{item.value}</div>
                    <div className="mt-1 text-[11px] text-zinc-300">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="self-end rounded-3xl bg-white/10 p-6 backdrop-blur-md">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-300">Elite Member Track</div>
              <div className="mt-3 text-2xl font-black text-white">90 Days. Real Change.</div>
              <p className="mt-3 text-sm text-zinc-200 leading-relaxed">
                Personalized training split, nutrition guidance, and weekly check-ins
                to keep your transformation on schedule.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-black/40 p-3 text-zinc-100">Coach Assigned</div>
                <div className="rounded-xl bg-black/40 p-3 text-zinc-100">Progress Metrics</div>
                <div className="rounded-xl bg-black/40 p-3 text-zinc-100">Diet Strategy</div>
                <div className="rounded-xl bg-black/40 p-3 text-zinc-100">Weekly Review</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className={sectionPad}>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Why serious members choose us
          </h2>
          <p className="mt-3 text-zinc-300 leading-relaxed">
            Every detail is designed to produce better training sessions and better outcomes.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {pillars.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 p-6 hover:from-white/15 hover:to-white/10 transition"
            >
              <div className="text-lg font-bold text-white">{item.title}</div>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PROGRAMS */}
      <section className={sectionPad}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Signature training programs
            </h2>
            <p className="mt-3 text-zinc-300 leading-relaxed">
              High-impact coaching paths for physique, power, and performance.
            </p>
          </div>
          <Link
            to="/facilities"
            className="w-fit rounded-xl bg-white text-black px-5 py-3 text-sm font-black hover:bg-white/90 transition"
          >
            Explore facilities
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {programs.map((program, idx) => (
            <div
              key={program.name}
              className={[
                "rounded-3xl p-6",
                idx === 0
                  ? "bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-white/5"
                  : "bg-white/5",
              ].join(" ")}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">{program.subtitle}</div>
              <h3 className="mt-2 text-2xl font-black text-white">{program.name}</h3>

              <div className="mt-5 space-y-2">
                {program.points.map((point) => (
                  <div key={point} className="rounded-xl bg-black/35 px-3 py-2 text-sm text-zinc-200">
                    {point}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COACHES */}
      <section className={sectionPad}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Train with top-tier coaches
            </h2>
            <p className="mt-3 text-zinc-300 leading-relaxed">
              Personalized guidance, better technique, and clear progression.
            </p>
          </div>

          <Link
            to="/trainers"
            className="rounded-xl bg-white text-black px-5 py-3 text-sm font-black hover:bg-white/90 transition"
          >
            Meet all coaches
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <article key={coach.name} className="rounded-3xl bg-black/35 p-6 hover:bg-black/45 transition">
              <div className="h-44 rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
              <h3 className="mt-6 text-2xl font-black text-white">{coach.name}</h3>
              <p className="text-sm text-zinc-300">{coach.role}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {coach.focus.map((f) => (
                  <span key={f} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                    {f}
                  </span>
                ))}
              </div>

              <Link
                to="/contact"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 transition"
              >
                Book a session
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={sectionPad}>
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Premium experience. Proven results.
          </h2>
          <p className="mt-3 text-zinc-300 leading-relaxed">
            Real member feedback from consistent training journeys.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <article key={t.quote} className="rounded-3xl bg-white/5 p-6">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Rated 5/5</div>
              <p className="mt-3 text-sm text-zinc-200 leading-relaxed">"{t.quote}"</p>
              <div className="mt-5 text-xs text-zinc-400">{t.author}</div>
            </article>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={`${sectionPad} pb-20`}>
        <div className="rounded-[32px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 p-8 sm:p-10 lg:p-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Start your elite transformation now
              </h3>
              <p className="mt-3 text-zinc-300 leading-relaxed">
                Join A&A Health Club and train in a premium space that is built to deliver results.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/pricing"
                className="rounded-xl bg-white text-black px-6 py-3 text-sm font-black hover:bg-white/90 transition"
              >
                See pricing
              </Link>
              <Link
                to="/contact"
                className="rounded-xl bg-white/10 text-white px-6 py-3 text-sm font-semibold hover:bg-white/15 transition"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
