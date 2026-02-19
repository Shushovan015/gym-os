import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { getHomeRequest } from "@src/redux/actions/home";
import { getFacilitiesRequest } from "@src/redux/actions/facilities";
import { getTrainersRequest } from "@src/redux/actions/trainers";
import { getTestimonialsRequest } from "@src/redux/actions/testimonials";

type Testimonial = {
  id: number;
  name: string;
  goal: string;
  quote: string;
  image: string;
};

const homeFallback = {
  hero_badge: "A&A Health Club | Butwal, Rupandehi",
  hero_title: "Train hard. Lift right. Stay consistent.",
  hero_description:
    "A serious training environment with proper coaching, modern equipment, and programs for strength, fat loss, and performance.",
  hero_image:
    "https://images.unsplash.com/photo-1549476464-37392f717541?q=80&w=2070&auto=format&fit=crop",
  hero_primary_cta_text: "Book trial session",
  hero_primary_cta_link: "/contact",
  hero_secondary_cta_text: "View membership",
  hero_secondary_cta_link: "/pricing",
  status_title: "Today at A&A",
  zones_title: "Training Zones",
  coaches_title: "Coaches on Floor",
  coaches_subtitle: "Train with experienced coaches for strength, fat loss, and functional performance.",
  maximus_badge: "Maximus Strength",
  maximus_title: "Powerlifting Group",
  maximus_description:
    "Dedicated powerlifting training for lifters focused on Squat, Bench, and Deadlift progression.",
  maximus_image:
    "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  maximus_learn_more_link: "/about#maximus-strength",
  maximus_instagram_link: "https://www.instagram.com/teammaximusstrength/",
  testimonials_title: "What Members Say",
  testimonials_subtitle: "Real feedback from A&A members.",
};

const fallbackStatus = [
  { label: "Open Gym", value: "5:00 AM - 9:00 PM" },
  { label: "Peak Hours", value: "6:00 AM - 9:00 AM / 5:00 PM - 8:00 PM" },
  { label: "Powerlifting Session", value: "Mon, Wed, Fri - 6:30 PM" },
  { label: "Trial Session", value: "Available Daily" },
];

const fallbackZones = [
  {
    name: "Strength Floor",
    desc: "Racks, benches, barbells, dumbbells, and platforms for progressive strength work.",
    image:
      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1600&auto=format&fit=crop",
  },
  {
    name: "Cardio Zone",
    desc: "Treadmills, bikes, rowers, and conditioning equipment for endurance and fat loss.",
    image:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop",
  },
  {
    name: "Functional Area",
    desc: "Kettlebells, ropes, mobility tools, and bodyweight stations for athletic training.",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop",
  },
];

const fallbackCoaches = [
  { name: "Keshab B. Shakya", role: "Strength Coach", focus: "Barbell Technique • Power" },
  { name: "Anmol Shakya", role: "Fat Loss Coach", focus: "Body Recomposition • Habit Coaching" },
  { name: "Niraj T.", role: "Functional Trainer", focus: "Mobility • Conditioning" },
];

const fallbackMaximusPoints = [
  "Squat, Bench, Deadlift focused programming",
  "Meet-prep cycles and peaking blocks",
  "Technique breakdown with competition standards",
  "Team sessions for beginner to advanced lifters",
];

export default function Home() {
  const dispatch = useDispatch();

  const { content: homeContent, status: homeStatus, points: homePoints } = useSelector(
    (s: any) => s.home ?? { content: null, status: [], points: [] }
  );
  const { items: facilitiesItems } = useSelector((s: any) => s.facilities ?? { items: [] });
  const { items: trainerItems } = useSelector((s: any) => s.trainers ?? { items: [] });
  const { items: testimonialItems, loading: testimonialsLoading } = useSelector(
    (s: any) => s.testimonials ?? { items: [], loading: false, error: null }
  );

  const home = { ...homeFallback, ...(homeContent || {}) };
  const testimonials: Testimonial[] = testimonialItems ?? [];

  const gymStatus =
    Array.isArray(homeStatus) && homeStatus.length
      ? homeStatus
          .map((item: any) => ({
            label: item?.label ?? "",
            value: item?.value ?? "",
          }))
          .filter((item: any) => item.label && item.value)
      : fallbackStatus;

  const zoneCards =
    Array.isArray(facilitiesItems) && facilitiesItems.length
      ? facilitiesItems
          .filter((item: any) => item?.kind === "zone" && item?.is_active !== false)
          .slice(0, 3)
          .map((item: any) => ({
            name: item?.title ?? "Zone",
            desc: item?.description ?? "",
            image: item?.image || fallbackZones[0].image,
          }))
      : fallbackZones;

  const coachCards =
    Array.isArray(trainerItems) && trainerItems.length
      ? trainerItems.slice(0, 3).map((item: any) => ({
          name: item?.name ?? "Coach",
          role: item?.role ?? "Trainer",
          focus: Array.isArray(item?.specialties) ? item.specialties.join(" • ") : "",
        }))
      : fallbackCoaches;

  const maximusPoints =
    Array.isArray(homePoints) && homePoints.length
      ? homePoints
          .map((item: any) => item?.point ?? "")
          .filter((point: string) => point)
      : fallbackMaximusPoints;

  const testimonialCount = testimonials.length;
  const [slideIndex, setSlideIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    dispatch(getHomeRequest());
    dispatch(getFacilitiesRequest());
    dispatch(getTrainersRequest());
    dispatch(getTestimonialsRequest());
  }, [dispatch]);

  useEffect(() => {
    setSlideIndex(1);
  }, [testimonialCount]);

  const slides = useMemo(() => {
    if (testimonialCount === 0) return [];
    return [testimonials[testimonialCount - 1], ...testimonials, testimonials[0]];
  }, [testimonials, testimonialCount]);

  const activeTestimonial =
    testimonialCount > 0 ? ((slideIndex - 1 + testimonialCount) % testimonialCount) : 0;

  const nextTestimonial = () => {
    if (isSliding || testimonialCount <= 1) return;
    setIsSliding(true);
    setSlideIndex((prev) => prev + 1);
  };

  const prevTestimonial = () => {
    if (isSliding || testimonialCount <= 1) return;
    setIsSliding(true);
    setSlideIndex((prev) => prev - 1);
  };

  const onSlideTransitionEnd = () => {
    setIsSliding(false);

    if (slideIndex === testimonialCount + 1) {
      setAnimate(false);
      setSlideIndex(1);
    } else if (slideIndex === 0) {
      setAnimate(false);
      setSlideIndex(testimonialCount);
    }
  };

  useEffect(() => {
    if (!animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [animate]);

  useEffect(() => {
    if (testimonialCount <= 1) return;
    const id = setInterval(() => {
      if (!isSliding) {
        setIsSliding(true);
        setSlideIndex((prev) => prev + 1);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [testimonialCount, isSliding]);

  const sectionPad = "px-6 lg:px-12 xl:px-20";

  return (
    <div className="space-y-14 pb-10">
      <section className="relative isolate overflow-hidden min-h-[calc(100dvh-4rem)] bg-[#090d13]">
        <img
          src={home.hero_image}
          alt="Gym floor"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />

        <div className={`relative ${sectionPad} min-h-[calc(100dvh-4rem)] flex items-center`}>
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-black/45 px-4 py-2 text-xs font-semibold text-zinc-200">
              {home.hero_badge}
            </div>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
              {home.hero_title}
            </h1>

            <p className="mt-4 max-w-2xl text-zinc-200 leading-relaxed">{home.hero_description}</p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                to={home.hero_primary_cta_link || "/contact"}
                className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
              >
                {home.hero_primary_cta_text}
              </Link>
              <Link
                to={home.hero_secondary_cta_link || "/pricing"}
                className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center"
              >
                {home.hero_secondary_cta_text}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-black/35 p-6 sm:p-7 lg:p-8">
          <h2 className="text-3xl font-black text-white">{home.status_title}</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {gymStatus.map((item: any) => (
              <div key={item.label} className="rounded-2xl bg-white/6 px-4 py-4">
                <div className="text-sm font-bold text-white">{item.label}</div>
                <div className="mt-1 text-sm text-zinc-300">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <h2 className="text-3xl sm:text-4xl font-black text-white">{home.zones_title}</h2>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {zoneCards.map((zone: any) => (
            <article key={zone.name} className="rounded-3xl bg-black/35 p-5">
              <div className="relative overflow-hidden rounded-2xl bg-white/5" style={{ aspectRatio: "16 / 10" }}>
                <img src={zone.image} alt={zone.name} className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <h3 className="mt-4 text-xl font-black text-white">{zone.name}</h3>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{zone.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-white/6 p-6 sm:p-7 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-white">{home.coaches_title}</h2>
              <p className="mt-2 text-zinc-300">{home.coaches_subtitle}</p>
            </div>
            <Link
              to="/trainers"
              className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
            >
              View all trainers
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {coachCards.map((coach: any) => (
              <article key={coach.name} className="rounded-2xl bg-black/35 p-5">
                <h3 className="text-xl font-black text-white">{coach.name}</h3>
                <p className="mt-1 text-sm text-zinc-300">{coach.role}</p>
                <p className="mt-3 text-sm text-zinc-400">{coach.focus}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-gradient-to-r from-white/10 via-white/6 to-white/10 p-6 sm:p-7 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
                {home.maximus_badge}
              </div>
              <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">{home.maximus_title}</h2>
              <p className="mt-3 text-zinc-300 leading-relaxed">{home.maximus_description}</p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {maximusPoints.map((point: string) => (
                  <div key={point} className="rounded-xl bg-black/35 px-4 py-3 text-sm text-zinc-200">
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={home.maximus_learn_more_link || "/about#maximus-strength"}
                  className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black hover:bg-white/90 transition text-center"
                >
                  Learn more
                </Link>
                <a
                  href={home.maximus_instagram_link || "https://www.instagram.com/teammaximusstrength/"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition text-center"
                >
                  Instagram
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-white/5" style={{ aspectRatio: "16 / 10" }}>
              <img
                src={home.maximus_image}
                alt="Maximus Strength powerlifting"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={sectionPad}>
        <div className="rounded-3xl bg-black/35 p-6 sm:p-7 lg:p-8">
          <h2 className="text-3xl font-black text-white">{home.testimonials_title}</h2>
          <p className="mt-2 text-zinc-300">{home.testimonials_subtitle}</p>

          {testimonialsLoading ? (
            <div className="mt-6 text-zinc-300">Loading testimonials...</div>
          ) : testimonialCount === 0 ? (
            <div className="mt-6 text-zinc-400">No testimonials yet.</div>
          ) : (
            <>
              <div className="relative mt-6 px-12">
                <button
                  type="button"
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
                  aria-label="Previous testimonial"
                >
                  <span className="text-lg leading-none">{"<"}</span>
                </button>

                <button
                  type="button"
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
                  aria-label="Next testimonial"
                >
                  <span className="text-lg leading-none">{">"}</span>
                </button>

                <div className="overflow-hidden rounded-2xl">
                  <div
                    onTransitionEnd={onSlideTransitionEnd}
                    className={`flex ${animate ? "transition-transform duration-500 ease-out" : ""}`}
                    style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                  >
                    {slides.map((t, idx) => (
                      <article key={`${t.name}-${idx}`} className="min-w-full rounded-2xl bg-white/6 p-6 sm:p-7">
                        <div className="flex items-center gap-4">
                          {t.image ? (
                            <img
                              src={t.image}
                              alt={t.name}
                              className="h-14 w-14 rounded-full object-cover ring-2 ring-white/20"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-white/10" />
                          )}
                          <div>
                            <div className="text-sm font-bold text-white">{t.name}</div>
                            <div className="text-xs text-zinc-400">{t.goal}</div>
                          </div>
                        </div>

                        <p className="mt-5 text-lg text-zinc-200 leading-relaxed">"{t.quote}"</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-center gap-2">
                {testimonials.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSlideIndex(idx + 1)}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition",
                      idx === activeTestimonial ? "bg-white" : "bg-white/30 hover:bg-white/50",
                    ].join(" ")}
                    aria-label={`Go to testimonial ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
