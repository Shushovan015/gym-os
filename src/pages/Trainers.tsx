import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getTrainersRequest } from "@src/redux/actions/trainers";

type TrainerRow = {
  id: number;
  name: string;
  role: string;
  bio: string;
  image: string;
  specialties: string[];
  years_experience: number;
  offers_personal_training: boolean;
};

type PTContent = {
  pt_badge: string;
  pt_title: string;
  pt_description: string;
  pt_cta_text: string;
  pt_cta_link: string;
};

type PTPlan = {
  id?: number;
  name: string;
  details: string;
  points: string[];
};

const fallbackPTContent: PTContent = {
  pt_badge: "Personal Training",
  pt_title: "One-on-one coaching sessions available",
  pt_description:
    "Train directly with a coach through personalized sessions based on your goal, level, and schedule.",
  pt_cta_text: "Book personal training",
  pt_cta_link: "/contact",
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
  const ptSection: PTContent = { ...fallbackPTContent, ...(ptContent || {}) };
  const personalTrainingPlans: PTPlan[] =
    Array.isArray(plans) && plans.length > 0 ? plans : fallbackPlans;

  useEffect(() => {
    dispatch(getTrainersRequest());
  }, [dispatch]);

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
        {loading ? (
          <div className="rounded-2xl bg-black/35 p-6 text-zinc-300">Loading trainers...</div>
        ) : error ? (
          <div className="rounded-2xl bg-red-500/10 p-6 text-red-300">{error}</div>
        ) : trainers.length === 0 ? (
          <div className="rounded-2xl bg-black/35 p-6 text-zinc-400">No trainers available yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainers.map((trainer) => (
              <article
                key={trainer.id}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-[#0b1016] shadow-[0_18px_40px_rgba(0,0,0,0.4)] transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="relative overflow-hidden">
                  <div className="aspect-[3/4] w-full bg-[#090d13]">
                    {trainer.image ? (
                      <img
                        src={trainer.image}
                        alt={trainer.name}
                        className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-white/20 via-white/10 to-transparent" />
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />

                  {trainer.offers_personal_training && (
                    <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-zinc-100">
                      Personal Training
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-2xl font-black tracking-tight text-white">{trainer.name}</h3>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-200">{trainer.role}</p>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                      {trainer.years_experience}+ yrs
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{trainer.bio}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(trainer.specialties || []).slice(0, 4).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <Link
                    to="/contact"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-black transition hover:bg-zinc-100"
                  >
                    Book a session
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-gradient-to-r from-white/10 via-white/6 to-white/10 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
                {ptSection.pt_badge}
              </div>
              <h3 className="mt-4 text-3xl font-black text-white">{ptSection.pt_title}</h3>
              <p className="mt-2 text-zinc-300 leading-relaxed">{ptSection.pt_description}</p>
            </div>

            <Link
              to={ptSection.pt_cta_link || "/contact"}
              className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
            >
              {ptSection.pt_cta_text}
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {personalTrainingPlans.map((plan, idx) => (
              <article
                key={plan.id ?? `${plan.name}-${idx}`}
                className="rounded-2xl bg-black/35 p-5"
              >
                <h4 className="text-xl font-black text-white">{plan.name}</h4>
                <p className="mt-1 text-sm text-zinc-300">{plan.details}</p>

                <div className="mt-4 space-y-2">
                  {(Array.isArray(plan.points) ? plan.points : []).map((point) => (
                    <div key={point} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-zinc-200">
                      {point}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
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
