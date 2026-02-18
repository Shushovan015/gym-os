import { Link } from "react-router-dom";

const zones = [
  {
    title: "Strength Hall",
    desc: "Competition racks, calibrated plates, platforms, and premium dumbbell range for progressive training.",
    tag: "Power & Hypertrophy",
  },
  {
    title: "Cardio Studio",
    desc: "Treadmills, assault bikes, rowers, and guided endurance stations for high-performance conditioning.",
    tag: "Endurance",
  },
  {
    title: "Functional Arena",
    desc: "Kettlebells, sleds, ropes, mobility tools, and movement lanes built for athletic training.",
    tag: "Athletic Performance",
  },
  {
    title: "Coaching Floor",
    desc: "Dedicated space for personal training, movement correction, and one-on-one progress sessions.",
    tag: "Personal Coaching",
  },
  {
    title: "Recovery Zone",
    desc: "Cooldown area with mobility support, stretch stations, and guided post-session recovery.",
    tag: "Longevity",
  },
  {
    title: "Luxury Locker Rooms",
    desc: "Clean lockers, private changing zones, and shower facilities maintained through the day.",
    tag: "Comfort",
  },
];

const amenities = [
  "Air-conditioned floors",
  "Filtered drinking water",
  "Secure lockers",
  "Shower access",
  "Music-ready training vibe",
  "Hygiene maintained daily",
];

export default function Facilities() {
  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-16 pb-8">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            Premium Infrastructure
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Facilities built for serious results
          </h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Every zone is designed for performance, safety, and consistency. From heavy
            lifting to conditioning and recovery, your entire training cycle is covered.
          </p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-black/35 px-4 py-4">
              <div className="text-2xl font-black text-white">2000 m2</div>
              <div className="text-xs text-zinc-300">Training Area</div>
            </div>
            <div className="rounded-2xl bg-black/35 px-4 py-4">
              <div className="text-2xl font-black text-white">50+</div>
              <div className="text-xs text-zinc-300">Machines & Stations</div>
            </div>
            <div className="rounded-2xl bg-black/35 px-4 py-4">
              <div className="text-2xl font-black text-white">12</div>
              <div className="text-xs text-zinc-300">Coaching Experts</div>
            </div>
            <div className="rounded-2xl bg-black/35 px-4 py-4">
              <div className="text-2xl font-black text-white">Daily</div>
              <div className="text-xs text-zinc-300">5AM - 9PM</div>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {zones.map((zone) => (
            <article key={zone.title} className="rounded-3xl bg-white/6 p-6 hover:bg-white/10 transition">
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                {zone.tag}
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">{zone.title}</h2>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{zone.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-black/35 p-6 sm:p-8">
          <h3 className="text-2xl font-black text-white">Included amenities</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {amenities.map((item) => (
              <span key={item} className="rounded-full bg-white/10 px-4 py-2 text-sm text-zinc-200">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={`${sectionPad} pb-10`}>
        <div className="rounded-3xl bg-gradient-to-r from-white/10 via-white/6 to-white/10 p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-black text-white">Want a guided gym tour?</h3>
            <p className="mt-2 text-zinc-300">Visit the club and explore every training zone with our team.</p>
          </div>
          <Link
            to="/contact"
            className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
          >
            Book a visit
          </Link>
        </div>
      </section>
    </div>
  );
}
