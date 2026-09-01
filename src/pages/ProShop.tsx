import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Search, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import Pagination from "@src/components/Pagination";
import { getProShopRequest } from "@src/redux/actions/proShop";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ImageFrame,
  LoadingState,
  PageRoot,
  PrimaryCTA,
  PublicSEO,
  Section,
  SectionHeading,
  SecondaryCTA,
  Surface,
} from "./PageKit";

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
  availability?: "available" | "out_of_stock" | "not_tracked";
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

type ProShopState = {
  proshop?: {
    items?: ShopItem[];
    content?: Partial<PageContent> | null;
    loading?: boolean;
    error?: string | null;
  };
};

const fallbackItems: ShopItem[] = [
  {
    id: -1,
    title: "Whey Protein Isolate",
    category: "Supplements",
    price: "Rs 5,500",
    description: "Fast-absorbing protein for recovery and muscle support.",
    image: "",
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
    description: "Supports strength, power and high-intensity performance.",
    image: "",
    badge: "Coach Pick",
    inquire_link: "/contact",
    sort_order: 2,
    is_featured: true,
    is_active: true,
  },
];

const fallbackContent: PageContent = {
  hero_badge: "A&A Pro Shop",
  hero_title: "Gym essentials without the checkout noise.",
  hero_description: "Browse supplements, accessories and clothing available for inquiry through the gym team.",
  hero_image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1800&auto=format&fit=crop",
  hero_primary_cta_text: "Browse products",
  hero_primary_cta_link: "/shop",
  hero_secondary_cta_text: "Contact team",
  hero_secondary_cta_link: "/contact",
  summary_cards: [],
  catalog_title: "Product catalog",
  catalog_description: "Search by product, category or badge. Inquiries go to the gym team.",
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

const iconMap = { ShoppingBag, Sparkles, ShieldCheck, Truck };

function resolveTokens(value: string, products: number, categories: number, featured: number) {
  return value
    .replaceAll("{products}", String(products))
    .replaceAll("{categories}", String(categories))
    .replaceAll("{featured}", String(featured));
}

export default function ProShop() {
  const dispatch = useDispatch();
  const { items = [], content, loading = false, error = null } = useSelector(
    (state: ProShopState) => state.proshop ?? {}
  );
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(getProShopRequest());
  }, [dispatch]);

  const page = { ...fallbackContent, ...(content || {}) };
  const products = items.length ? items : fallbackItems;
  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((item) => item.category).filter(Boolean)))], [products]);
  const itemsPerPage = Math.max(1, Number(page.items_per_page || 8));
  const featuredCount = products.filter((item) => item.is_featured).length;
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory) return false;
      if (!q) return true;
      return [item.title, item.description, item.category, item.badge].join(" ").toLowerCase().includes(q);
    });
  }, [activeCategory, products, query]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginated = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const summaryCards =
    page.summary_cards?.length
      ? page.summary_cards
      : [
          { label: "Products", value: "{products}+", icon: "ShoppingBag" },
          { label: "Categories", value: "{categories}", icon: "Sparkles" },
          { label: "Featured", value: "{featured}", icon: "ShieldCheck" },
          { label: "Inquiry", value: "Direct", icon: "Truck" },
        ];

  const updateCategory = (category: string) => {
    setActiveCategory(category);
    setCurrentPage(1);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
  };

  return (
    <PageRoot>
      <PublicSEO
        title="Pro Shop | A&A Health Club Butwal"
        description="Browse A&A Health Club supplements, accessories and gym clothing, then inquire with the team."
      />

      <Section animated={false} className="pt-10 sm:pt-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="accent">{page.hero_badge}</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-5xl lg:text-6xl">
              {page.hero_title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--public-muted)]">{page.hero_description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.hero_primary_cta_link || "/shop"}>{page.hero_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.hero_secondary_cta_link || "/contact"}>{page.hero_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
          <ImageFrame src={page.hero_image} alt="A&A Pro Shop" className="aspect-[4/3]" loading="eager" />
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.slice(0, 4).map((card) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap] ?? ShoppingBag;
            return (
              <Card key={card.label}>
                <Icon className="h-5 w-5 text-[var(--public-accent-strong)]" />
                <div className="mt-4 text-2xl font-semibold text-[var(--public-text)]">
                  {resolveTokens(card.value, products.length, Math.max(categories.length - 1, 0), featuredCount)}
                </div>
                <div className="text-sm text-[var(--public-muted)]">{card.label}</div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section className="bg-[var(--public-bg-soft)]">
        <Surface>
          <SectionHeading eyebrow="Catalog" title={page.catalog_title} description={page.catalog_description} />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" />
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Search products..."
                className="min-h-12 w-full rounded-full border border-[var(--public-line)] bg-[#11100e] py-3 pl-11 pr-4 text-sm text-[var(--public-text)] placeholder:text-[var(--public-muted)]"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => updateCategory(category)}
                  className={[
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    activeCategory === category
                      ? "border-[var(--public-accent)] bg-[var(--public-accent)] text-[#14110d]"
                      : "border-[var(--public-line)] text-[var(--public-text)] hover:border-[var(--public-accent)]",
                  ].join(" ")}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="mt-5"><LoadingState label="Loading products..." /></div> : null}
          {error ? <div className="mt-5"><ErrorState message={error} /></div> : null}

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {paginated.map((item) => (
              <Card key={`${item.id}-${item.title}`} className="flex flex-col p-0">
                <ImageFrame src={item.image} alt={item.title} className="aspect-square rounded-b-none border-0" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{item.category}</Badge>
                    {item.is_featured ? <Badge tone="accent"><Star className="mr-1 h-3 w-3" />Featured</Badge> : null}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-tight text-[var(--public-text)]">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--public-muted)]">{item.description}</p>
                  <div className="mt-5 flex items-center justify-between gap-3"><div className="text-2xl font-semibold text-[var(--public-text)]">{item.price}</div>{item.availability === "out_of_stock" ? <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-300">Out of stock</span> : item.availability === "available" ? <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Available</span> : null}</div>
                  <Link
                    to={item.inquire_link || page.inquiry_link_default || "/contact"}
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--public-line-strong)] px-4 py-3 text-sm font-semibold text-[var(--public-text)] transition hover:border-[var(--public-accent)]"
                  >
                    {page.inquiry_button_text}
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {!loading && paginated.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="No products found" description="Try a different category or search term." />
            </div>
          ) : null}

          <div className="mt-8">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </Surface>
      </Section>

      <Section>
        <Surface>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[var(--public-text)]">{page.bottom_cta_title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">{page.bottom_cta_description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCTA to={page.bottom_primary_cta_link || "/contact"}>{page.bottom_primary_cta_text}</PrimaryCTA>
              <SecondaryCTA to={page.bottom_secondary_cta_link || "/pricing"}>{page.bottom_secondary_cta_text}</SecondaryCTA>
            </div>
          </div>
        </Surface>
      </Section>
    </PageRoot>
  );
}
