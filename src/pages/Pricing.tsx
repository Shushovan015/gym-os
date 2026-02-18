import { Link } from "react-router-dom";

type Plan = {
  name: string;
  price: string;
  subtitle: string;
  cadence: string;
  highlighted?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Essential",
    price: "Rs 3,500",
    cadence: "/month",
    subtitle: "For disciplined self-training",
    features: [
      "Full gym access",
      "Locker facility",
      "Equipment orientation",
      "Standard support",
    ],
  },
  {
    name: "Performance",
    price: "Rs 6,900",
    cadence: "/month",
    subtitle: "Most popular for visible progress",
    highlighted: true,
    features: [
      "Everything in Essential",
      "1 personal coaching session / week",
      "Monthly training review",
      "Program updates and tracking",
    ],
  },
  {
    name: "Elite",
    price: "Rs 11,900",
    cadence: "/month",
    subtitle: "High-accountability transformation",
    features: [
      "Everything in Performance",
      "2 coaching sessions / week",
      "Nutrition structure guidance",
      "Priority scheduling",
    ],
  },
];

const perks = [
  "No hidden joining fees",
  "Flexible plan upgrades",
  "Professional support team",
  "Clean and premium environment",
];

export default function Pricing() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-16 pb-8">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            Membership Plans
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Transparent pricing for premium training
          </h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Choose the plan that matches your training intensity. Upgrade anytime as your goals evolve.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {perks.map((perk) => (
              <span key={perk} className="rounded-full bg-white/10 px-4 py-2 text-xs text-zinc-200">
                {perk}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={[
                "rounded-3xl p-6 transition",
                plan.highlighted
                  ? "bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-white/8"
                  : "bg-white/6 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white">{plan.name}</h2>
                  <p className="text-sm text-zinc-300">{plan.subtitle}</p>
                </div>
                {plan.highlighted && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white">
                    Most Popular
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-end gap-1">
                <div className="text-4xl font-black text-white">{plan.price}</div>
                <div className="pb-1 text-sm text-zinc-300">{plan.cadence}</div>
              </div>

              <div className="mt-6 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="rounded-xl bg-black/35 px-4 py-3 text-sm text-zinc-200">
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                to="/contact"
                className={[
                  "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition",
                  plan.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/10 text-white hover:bg-white/15",
                ].join(" ")}
              >
                Choose {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={`${sectionPad} pb-10`}>
        <div className="rounded-3xl bg-black/35 p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-white">Need a custom offer for your goal?</h3>
            <p className="mt-2 text-zinc-300">
              Get a personalized recommendation based on your training level and timeline.
            </p>
          </div>
          <Link
            to="/contact"
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
          >
            Get custom plan
          </Link>
        </div>
      </section>
    </div>
  );
}
