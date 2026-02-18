import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Pagination from "@src/components/Pagination";

const ITEMS_PER_PAGE = 8;

type Category = "All" | "Supplements" | "Accessories" | "Clothing";

type ShopItem = {
  name: string;
  category: Category;
  price: string;
  desc: string;
  image: string;
  badge?: string;
};

const tabs: Category[] = ["All", "Supplements", "Accessories", "Clothing"];

const items: ShopItem[] = [
  // Supplements
  {
    name: "Whey Protein Isolate",
    category: "Supplements",
    price: "Rs 5,500",
    desc: "Fast-absorbing protein for post-workout recovery.",
    image: "https://picsum.photos/seed/whey-isolate/800/800",
    badge: "Best Seller",
  },
  {
    name: "Creatine Monohydrate",
    category: "Supplements",
    price: "Rs 2,200",
    desc: "Supports strength, power, and muscle performance.",
    image: "https://picsum.photos/seed/creatine/800/800",
    badge: "Coach Pick",
  },
  {
    name: "Pre-Workout Blast",
    category: "Supplements",
    price: "Rs 3,100",
    desc: "Energy and focus support before intense sessions.",
    image: "https://picsum.photos/seed/preworkout/800/800",
  },
  {
    name: "Mass Gainer Pro",
    category: "Supplements",
    price: "Rs 4,900",
    desc: "High-calorie blend for muscle and weight gain goals.",
    image: "https://picsum.photos/seed/mass-gainer/800/800",
  },
  {
    name: "BCAA + Electrolytes",
    category: "Supplements",
    price: "Rs 2,700",
    desc: "Hydration and endurance support during training.",
    image: "https://picsum.photos/seed/bcaa/800/800",
  },
  {
    name: "Fish Oil Omega 3",
    category: "Supplements",
    price: "Rs 1,800",
    desc: "Daily wellness and joint support supplement.",
    image: "https://picsum.photos/seed/fishoil/800/800",
  },
  {
    name: "Multivitamin Daily",
    category: "Supplements",
    price: "Rs 1,500",
    desc: "Micronutrient support for active lifestyles.",
    image: "https://picsum.photos/seed/multivitamin/800/800",
  },
  {
    name: "Casein Night Protein",
    category: "Supplements",
    price: "Rs 5,200",
    desc: "Slow-release protein ideal for nighttime recovery.",
    image: "https://picsum.photos/seed/casein/800/800",
  },

  // Accessories
  {
    name: "Lifting Belt",
    category: "Accessories",
    price: "Rs 2,900",
    desc: "Core support for heavy compound lifts.",
    image: "https://picsum.photos/seed/lifting-belt/800/800",
  },
  {
    name: "Wrist Straps",
    category: "Accessories",
    price: "Rs 950",
    desc: "Improves pulling grip for back and deadlift days.",
    image: "https://picsum.photos/seed/wrist-straps/800/800",
  },
  {
    name: "Knee Sleeves (Pair)",
    category: "Accessories",
    price: "Rs 1,700",
    desc: "Compression support for squat and leg sessions.",
    image: "https://picsum.photos/seed/knee-sleeves/800/800",
  },
  {
    name: "Gym Gloves",
    category: "Accessories",
    price: "Rs 1,100",
    desc: "Comfort grip and palm protection for training.",
    image: "https://picsum.photos/seed/gym-gloves/800/800",
  },
  {
    name: "Shaker Bottle",
    category: "Accessories",
    price: "Rs 550",
    desc: "Leak-proof shaker for protein and pre-workout.",
    image: "https://picsum.photos/seed/shaker-bottle/800/800",
  },
  {
    name: "Jump Rope Pro",
    category: "Accessories",
    price: "Rs 800",
    desc: "Speed rope for warm-up and conditioning work.",
    image: "https://picsum.photos/seed/jump-rope/800/800",
  },
  {
    name: "Resistance Bands Set",
    category: "Accessories",
    price: "Rs 1,300",
    desc: "Versatile bands for warm-up and mobility drills.",
    image: "https://picsum.photos/seed/bands-set/800/800",
  },

  // Clothing
  {
    name: "A&A Oversized Gym Tee",
    category: "Clothing",
    price: "Rs 1,600",
    desc: "Breathable oversized fit for training comfort.",
    image: "https://picsum.photos/seed/oversized-tee/800/800",
    badge: "New",
  },
  {
    name: "A&A Dry-Fit Tank",
    category: "Clothing",
    price: "Rs 1,400",
    desc: "Lightweight tank for high-sweat sessions.",
    image: "https://picsum.photos/seed/dryfit-tank/800/800",
  },
  {
    name: "A&A Training Joggers",
    category: "Clothing",
    price: "Rs 2,200",
    desc: "Stretch-friendly joggers for lower body days.",
    image: "https://picsum.photos/seed/training-joggers/800/800",
  },
  {
    name: "A&A Compression Tee",
    category: "Clothing",
    price: "Rs 1,900",
    desc: "Slim compression fit for performance training.",
    image: "https://picsum.photos/seed/compression-tee/800/800",
  },
  {
    name: "A&A Zip Hoodie",
    category: "Clothing",
    price: "Rs 2,800",
    desc: "Warm-up layer with premium street-gym look.",
    image: "https://picsum.photos/seed/zip-hoodie/800/800",
  },
  {
    name: "A&A Training Shorts",
    category: "Clothing",
    price: "Rs 1,500",
    desc: "Flexible shorts for cardio and mobility work.",
    image: "https://picsum.photos/seed/training-shorts/800/800",
  },
];

export default function ProShop() {

  const sectionPad = "px-6 lg:px-12 xl:px-20";
  const cardPad = "p-4 sm:p-4";
  const [activeTab, setActiveTab] = useState<Category>("All");

  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = useMemo(
    () => (activeTab === "All" ? items : items.filter((item) => item.category === activeTab)),
    [activeTab]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);


  return (
    <div className="space-y-12 pb-10">
      <section className={sectionPad}>
        <div className="rounded-[30px] bg-gradient-to-br from-white/12 via-white/8 to-white/4 py-8 sm:py-10 lg:py-10">
          <div className="inline-flex rounded-full bg-black/35 px-4 py-2 text-xs font-semibold text-zinc-200">
            A&A Pro Shop
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Supplements, Accessories & Clothing
          </h1>
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Select a category to browse products available in the gym.
          </p>
        </div>
      </section>

      <section className={`${sectionPad} relative z-10`}>
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition",
                activeTab === tab
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/15",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedItems.map((item) => (
            <article
              key={item.name}
              className={`rounded-3xl bg-black/35 hover:bg-black/45 transition ${cardPad}`}
            >
              <div
                className="relative w-full overflow-hidden rounded-2xl bg-white/5"
                style={{ aspectRatio: "1 / 1" }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                  {item.category}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-xl font-black text-white">{item.name}</h2>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{item.desc}</p>
              <div className="mt-5 text-2xl font-black text-white">{item.price}</div>

              <Link
                to="/contact"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-white/90 transition"
              >
                Inquire now
              </Link>
            </article>
          ))}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </section>
    </div>
  );
}
