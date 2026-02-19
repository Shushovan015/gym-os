import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getPricingRequest } from "@src/redux/actions/pricing";

type PricingItem = {
  id: number;
  kind: "plan" | "perk";
  title: string;
  price: string;
  cadence: string;
  subtitle: string;
  is_highlighted: boolean;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

export default function Pricing() {
  const dispatch = useDispatch();
  const { items, loading, error } = useSelector(
    (s: any) => s.pricing ?? { items: [], loading: false, error: null }
  );

  const pricingItems: PricingItem[] = items ?? [];
  const plans = pricingItems.filter((i) => i.kind === "plan");
  const perks = pricingItems.filter((i) => i.kind === "perk");

  useEffect(() => {
    dispatch(getPricingRequest());
  }, [dispatch]);

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
            {perks.length === 0 ? (
              <span className="text-zinc-400 text-sm">No features added yet.</span>
            ) : (
              perks.map((perk) => (
                <span key={perk.id} className="rounded-full bg-white/10 px-4 py-2 text-xs text-zinc-200">
                  {perk.title}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        {loading ? (
          <div className="rounded-2xl bg-black/35 p-6 text-zinc-300">Loading pricing...</div>
        ) : error ? (
          <div className="rounded-2xl bg-red-500/10 p-6 text-red-300">{error}</div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl bg-black/35 p-6 text-zinc-400">No plans added yet.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={[
                  "rounded-3xl p-6 transition",
                  plan.is_highlighted
                    ? "bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-white/8"
                    : "bg-white/6 hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">{plan.title}</h2>
                    <p className="text-sm text-zinc-300">{plan.subtitle}</p>
                  </div>
                  {plan.is_highlighted && (
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
                  {(plan.features || []).map((feature) => (
                    <div key={feature} className="rounded-xl bg-black/35 px-4 py-3 text-sm text-zinc-200">
                      {feature}
                    </div>
                  ))}
                </div>

                <Link
                  to="/contact"
                  className={[
                    "mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition",
                    plan.is_highlighted
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-white/10 text-white hover:bg-white/15",
                  ].join(" ")}
                >
                  Choose {plan.title}
                </Link>
              </article>
            ))}
          </div>
        )}
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
