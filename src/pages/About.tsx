import { Link } from "react-router-dom";

const stats = [
  { value: "10+", label: "Years of Coaching" },
  { value: "5000+", label: "Member Transformations" },
  { value: "12", label: "Certified Trainers" },
  { value: "2000 m2", label: "Training Floor" },
];

const principles = [
  {
    title: "Structured Programming",
    desc: "Clear training plans built around your level, goal, and timeline.",
  },
  {
    title: "Technique & Safety",
    desc: "Form-first coaching that improves performance and reduces injury risk.",
  },
  {
    title: "Consistency Systems",
    desc: "Weekly tracking and accountability to keep progress steady.",
  },
];

const process = [
  {
    step: "01",
    title: "Assessment",
    desc: "Goal setting, movement review, and baseline measurements.",
  },
  {
    step: "02",
    title: "Plan Design",
    desc: "Personalized split, training load, and recovery strategy.",
  },
  {
    step: "03",
    title: "Execution",
    desc: "Coach-led sessions and smart progression week by week.",
  },
  {
    step: "04",
    title: "Review",
    desc: "Performance checks and updates based on real results.",
  },
];

const maximusHighlights = [
  "Squat, Bench Press, Deadlift focused programming",
  "Meet-prep cycles and peaking blocks",
  "Technique breakdown and competition standards",
  "Supportive team culture for beginners to advanced lifters",
];

const maximusGallery = [
  "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1596357395217-80de13130e92?q=80&w=1600&auto=format&fit=crop",
];


export default function About() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";
  const card = "rounded-3xl p-6 sm:p-7 lg:p-8";

  return (
    <div className="space-y-14 pb-10">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            About A&A Health Club
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Professional coaching. Premium training culture.
          </h1>
          <p className="mt-4 max-w-4xl text-zinc-300 leading-relaxed">
            A&A Health Club is built for members who want measurable progress. We combine expert coaching,
            modern equipment, and disciplined systems to deliver lasting transformation.
          </p>

          <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-black/35 px-4 py-4">
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-zinc-300">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {principles.map((p) => (
            <article key={p.title} className={`${card} bg-white/6`}>
              <h2 className="text-xl font-black text-white">{p.title}</h2>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="maximus-strength" className={sectionPad}>
        <div className={`${card} bg-gradient-to-r from-white/10 via-white/6 to-white/10`}>
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            Maximus Strength
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-white">
            Powerlifting Group at A&A Health Club
          </h2>
          <p className="mt-3 text-zinc-300 leading-relaxed max-w-4xl">
            Maximus Strength is our dedicated powerlifting community for athletes focused on strength,
            technique, and platform performance. The group trains with structured plans and a serious team mindset.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {maximusHighlights.map((item) => (
              <div key={item} className="rounded-xl bg-black/35 px-4 py-3 text-sm text-zinc-200">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href="https://www.instagram.com/teammaximusstrength/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
            >
              Visit Instagram
            </a>
            <Link
              to="/contact"
              className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center"
            >
              Join Maximus Strength
            </Link>
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {maximusGallery.map((img, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-2xl bg-white/5"
              style={{ aspectRatio: "4 / 3" }}
            >
              <img
                src={img}
                alt={`Maximus Strength powerlifting ${idx + 1}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            </div>
          ))}
        </div>
      </section>


      <section className={sectionPad}>
        <div className={`${card} bg-black/35`}>
          <h2 className="text-3xl font-black text-white">How We Work</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {process.map((p) => (
              <div key={p.step} className="rounded-2xl bg-white/6 p-5">
                <div className="text-xs font-bold tracking-[0.15em] text-zinc-400">STEP {p.step}</div>
                <div className="mt-2 text-lg font-bold text-white">{p.title}</div>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${sectionPad} pb-10`}>
        <div className={`${card} bg-gradient-to-r from-white/10 via-white/6 to-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6`}>
          <div>
            <h3 className="text-3xl font-black text-white">Ready to train with a serious system?</h3>
            <p className="mt-2 text-zinc-300">Book a trial session and get your personalized starting plan.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/contact"
              className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
            >
              Book trial
            </Link>
            <Link
              to="/pricing"
              className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
