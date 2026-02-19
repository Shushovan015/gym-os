import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  ChevronRight,
  Dumbbell,
  Pill,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";

import Pagination from "@src/components/Pagination";
import { getProShopRequest } from "@src/redux/actions/proShop";
import { PageRoot, Section, Surface, PrimaryCTA, SecondaryCTA } from "./PageKit";

type ShopItem = {
  id: number;
  title: string;
  category: string;
  price: string;
  description: string;
  image: string;
  badge: string;
  inquire_link: string;
  sort_order: number;
  is_featured: boolean;
  is_active: boolean;
};

type SummaryCard = {
  label: string;
  value: string;
  icon: string;
};

type PageContent = {
  hero_badge: string;
  hero_title: string;
  hero_description: string;
  hero_image: string;
  hero_primary_cta_text: string;
  hero_primary_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  summary_cards: SummaryCard[];
  catalog_title: string;
  catalog_description: string;
  inquiry_button_text: string;
  inquiry_link_default: string;
  items_per_page: number;
  bottom_cta_title: string;
  bottom_cta_description: string;
  bottom_primary_cta_text: string;
  bottom_primary_cta_link: string;
  bottom_secondary_cta_text: string;
  bottom_secondary_cta_link: string;
};

const iconMap: Record<string, ElementType> = {
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Truck,
  Shirt,
  Pill,
  Dumbbell,
};

const fallbackItems: ShopItem[] = [
  {
    id: -1,
    title: "Whey Protein Isolate",
    category: "Supplements",
    price: "Rs 5,500",
    description: "Fast-absorbing protein for recovery and muscle support.",
    image: "https://picsum.photos/seed/whey-isolate/800/800",
    badge: "Best Seller",
    inquire_link: "/contact",
    sort_order: 1,
    is_featured: true,
    is_active: true,
  },
  {
    id: -2,
    title: "Creatine Monohydrate",
    category: "Supplements",
    price: "Rs 2,200",
    description: "Supports strength, power, and high-intensity performance.",
    image: "https://picsum.photos/seed/creatine/800/800",
    badge: "Coach Pick",
    inquire_link: "/contact",
    sort_order: 2,
    is_featured: true,
    is_active: true,
  },
  {
    id: -3,
    title: "Lifting Belt",
    category: "Accessories",
    price: "Rs 2,900",
    description: "Core support for heavy compound lifts.",
    image: "https://picsum.photos/seed/lifting-belt/800/800",
    badge: "",
    inquire_link: "/contact",
    sort_order: 3,
    is_featured: false,
    is_active: true,
  },
  {
    id: -4,
    title: "A&A Oversized Gym Tee",
    category: "Clothing",
    price: "Rs 1,600",
    description: "Breathable oversized fit for training comfort.",
    image: "https://picsum.photos/seed/oversized-tee/800/800",
    badge: "New",
    inquire_link: "/contact",
    sort_order: 4,
    is_featured: true,
    is_active: true,
  },
];

const fallbackContent: PageContent = {
  hero_badge: "A&A Pro Shop",
  hero_title: "Supplements, Accessories & Clothing",
  hero_description: "Curated gym essentials for strength, performance, and recovery.",
  hero_image:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Browse products",
  hero_primary_cta_link: "/shop",
  hero_secondary_cta_text: "Contact team",
  hero_secondary_cta_link: "/contact",
  summary_cards: [],
  catalog_title: "Product Catalog",
  catalog_description: "Select a category to browse what is available in the gym.",
  inquiry_button_text: "Inquire now",
  inquiry_link_default: "/contact",
  items_per_page: 8,
  bottom_cta_title: "Need help choosing?",
  bottom_cta_description: "Message us with your goal and we will suggest the right product.",
  bottom_primary_cta_text: "Contact support",
  bottom_primary_cta_link: "/contact",
  bottom_secondary_cta_text: "View memberships",
  bottom_secondary_cta_link: "/pricing",
};

const fallbackSummaryCards: SummaryCard[] = [
  { label: "Products", value: "{products}+", icon: "ShoppingBag" },
  { label: "Categories", value: "{categories}", icon: "Sparkles" },
  { label: "Featured", value: "{featured}", icon: "ShieldCheck" },
  { label: "Fast Inquiry", value: "< 24 hrs", icon: "Truck" },
];

function resolveTokens(value: string, products: number, categories: number, featured: number) {
  return value
    .replaceAll("{products}", String(products))
    .replaceAll("{categories}", String(categories))
    .replaceAll("{featured}", String(featured));
}

export default function ProShop() {
  const dispatch = useDispatch();
  const { items, content, loading, error } = useSelector(
    (s: any) => s.proshop ?? { items: [], content: null, loading: false, error: null }
  );

  const page: PageContent = { ...fallbackContent, ...(content || {}) };
  const remoteItems: ShopItem[] = Array.isArray(items) ? items : [];
  const shopItems = remoteItems.length ? remoteItems : fallbackItems;

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(shopItems.map((item) => item.category).filter(Boolean)))],
    [shopItems]
  );

  const [activeTab, setActiveTab] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");

  const itemsPerPage = Math.max(1, Number(page.items_per_page || 8));

  useEffect(() => {
    dispatch(getProShopRequest());
  }, [dispatch]);

  useEffect(() => {
    if (!categories.includes(activeTab)) setActiveTab("All");
  }, [categories, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, itemsPerPage, query]);

  const filteredItems = useMemo(() => {
    const base =
      activeTab === "All"
        ? shopItems
        : shopItems.filter((item) => item.category === activeTab);

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((item) =>
      [item.title, item.description, item.category, item.badge]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [shopItems, activeTab, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const featuredCount = useMemo(
    () => shopItems.filter((item) => item.is_featured).length,
    [shopItems]
  );

  const summaryCards = useMemo(() => {
    const raw = Array.isArray(page.summary_cards) ? page.summary_cards : [];
    const base = raw.length ? raw : fallbackSummaryCards;

    return base.map((card) => ({
      label: card.label || "",
      value: resolveTokens(
        String(card.value || ""),
        shopItems.length,
        Math.max(categories.length - 1, 0),
        featuredCount
      ),
      icon: card.icon || "ShoppingBag",
    }));
  }, [page.summary_cards, shopItems.length, categories.length, featuredCount]);

  return (
    <PageRoot>
      <Section>
        <div className="surface-card relative overflow-hidden p-0">
          <img
            src={page.hero_image}
            alt="A&A Pro Shop"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.45] saturate-[0.85]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/74 to-black/56" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/25 to-black/45" />

          <div className="relative z-10 p-7 sm:p-9 lg:p-10">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <div className="label-chip">{page.hero_badge}</div>
                <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                  {page.hero_title}
                </h1>
                <p className="mt-4 max-w-2xl text-zinc-200 leading-relaxed">{page.hero_description}</p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3">
                  <PrimaryCTA to={page.hero_primary_cta_link || "/shop"}>
                    {page.hero_primary_cta_text}
                  </PrimaryCTA>
                  <SecondaryCTA to={page.hero_secondary_cta_link || "/contact"}>
                    {page.hero_secondary_cta_text}
                  </SecondaryCTA>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {summaryCards.map((card, idx) => {
                  const Icon = iconMap[card.icon] || ShoppingBag;
                  return (
                    <div
                      key={`${card.label}-${idx}`}
                      className="rounded-xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm transition duration-300 hover:bg-black/45"
                    >
                      <Icon className="h-5 w-5 text-accent" />
                      <div className="mt-3 text-2xl font-bold text-white">{card.value}</div>
                      <div className="text-xs text-zinc-300">{card.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <Surface className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">{page.catalog_title}</h2>
              <p className="mt-1 text-sm text-muted">{page.catalog_description}</p>
            </div>
            <div className="text-xs text-zinc-400">
              Showing {filteredItems.length} product{filteredItems.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-line/20 bg-white/10 py-3 pl-10 pr-3 text-sm text-white placeholder:text-zinc-400 outline-none transition focus:border-accent/50"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-semibold transition",
                    activeTab === tab
                      ? "bg-accent text-black"
                      : "bg-white/10 text-white hover:bg-white/15",
                  ].join(" ")}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="text-zinc-300">Loading products...</div> : null}
          {error ? <div className="text-red-300">{error}</div> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {paginatedItems.map((item) => (
              <article
                key={`${item.id}-${item.title}`}
                className="group rounded-2xl border border-line/15 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-1 hover:border-accent/35 hover:bg-white/[0.06]"
              >
                <div className="relative w-full overflow-hidden rounded-xl bg-white/5 aspect-square">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  {item.is_featured ? (
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-[10px] font-semibold text-accent">
                      <Star className="h-3 w-3" />
                      Featured
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-start justify-between gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                    {item.category}
                  </span>
                  {item.badge ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 min-h-[3.25rem] text-lg font-bold leading-tight text-white">{item.title}</h3>
                <p className="mt-2 min-h-[3.5rem] text-sm leading-relaxed text-zinc-300">{item.description}</p>
                <div className="mt-4 text-2xl font-bold text-white">{item.price}</div>

                <Link
                  to={item.inquire_link || page.inquiry_link_default || "/contact"}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-black transition hover:bg-white/90"
                >
                  {page.inquiry_button_text}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>

          {!loading && paginatedItems.length === 0 ? (
            <div className="rounded-xl border border-line/20 bg-white/5 p-5 text-zinc-400">
              No products found for this filter/search.
            </div>
          ) : null}

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </Surface>
      </Section>

      <Section className="pb-10">
        <Surface className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h3 className="text-3xl font-bold text-white">{page.bottom_cta_title}</h3>
            <p className="mt-2 text-muted">{page.bottom_cta_description}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryCTA to={page.bottom_primary_cta_link || "/contact"}>
              {page.bottom_primary_cta_text}
            </PrimaryCTA>
            <SecondaryCTA to={page.bottom_secondary_cta_link || "/pricing"}>
              {page.bottom_secondary_cta_text}
            </SecondaryCTA>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
