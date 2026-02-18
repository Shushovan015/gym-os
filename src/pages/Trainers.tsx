import { Link } from "react-router-dom";

type Trainer = {
  name: string;
  role: string;
  experience: string;
  focus: string[];
  bio: string;
};

const trainers: Trainer[] = [
  {
    name: "Arjun K.",
    role: "Head Strength Coach",
    experience: "9+ years experience",
    focus: ["Barbell Mechanics", "Strength Cycles", "Hypertrophy"],
    bio: "Leads advanced strength programming with a strong focus on technique and safe progression.",
  },
  {
    name: "Riya S.",
    role: "Body Recomposition Specialist",
    experience: "7+ years experience",
    focus: ["Fat Loss", "Habit Systems", "Nutrition Structure"],
    bio: "Helps members build sustainable routines for visible fat loss and lean muscle development.",
  },
  {
    name: "Niraj T.",
    role: "Functional Performance Coach",
    experience: "8+ years experience",
    focus: ["Mobility", "Athletic Conditioning", "Movement Quality"],
    bio: "Builds resilient, high-performing bodies through functional strength and conditioning systems.",
  },
];

const process = [
  {
    title: "Assessment",
    desc: "Movement screening and goal mapping to build the right starting point.",
  },
  {
    title: "Structured Plan",
    desc: "Weekly split, intensity targets, and progression timeline tailored to your profile.",
  },
  {
    title: "Performance Review",
    desc: "Consistent check-ins, form correction, and program adjustments based on results.",
  },
];

export default function Trainers() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-16 pb-8">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            Elite Coaching Team
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Train with professionals who deliver outcomes
          </h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Our coaches combine science-backed programming with practical accountability to
            make your progress measurable and consistent.
          </p>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {trainers.map((trainer) => (
            <article key={trainer.name} className="rounded-3xl bg-black/35 p-6 hover:bg-black/45 transition">
              <div className="h-44 rounded-2xl bg-gradient-to-br from-white/20 via-white/8 to-transparent" />
              <div className="mt-5">
                <h2 className="text-2xl font-black text-white">{trainer.name}</h2>
                <p className="text-sm text-zinc-200">{trainer.role}</p>
                <p className="mt-1 text-xs text-zinc-400">{trainer.experience}</p>
              </div>

              <p className="mt-4 text-sm text-zinc-300 leading-relaxed">{trainer.bio}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {trainer.focus.map((item) => (
                  <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                    {item}
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

      <section className={sectionPad}>
        <div className="rounded-3xl bg-white/6 p-6 sm:p-8">
          <h3 className="text-2xl font-black text-white">Our coaching process</h3>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {process.map((step) => (
              <div key={step.title} className="rounded-2xl bg-black/35 p-5">
                <div className="text-lg font-bold text-white">{step.title}</div>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${sectionPad} pb-10`}>
        <div className="rounded-3xl bg-gradient-to-r from-white/10 via-white/6 to-white/10 p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-white">Need a coach recommendation?</h3>
            <p className="mt-2 text-zinc-300">Tell us your goal and we will match you with the right trainer.</p>
          </div>
          <Link
            to="/contact"
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
          >
            Talk to a coach
          </Link>
        </div>
      </section>
    </div>
  );
}
