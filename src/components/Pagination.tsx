type Dots = "dots-left" | "dots-right";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
};

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const buildPages = (): Array<number | Dots> => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let left = Math.max(safePage - siblingCount, 2);
    let right = Math.min(safePage + siblingCount, totalPages - 1);

    if (safePage <= 2 + siblingCount) right = Math.min(3 + siblingCount * 2, totalPages - 1);
    if (safePage >= totalPages - (1 + siblingCount)) left = Math.max(totalPages - (2 + siblingCount * 2), 2);

    const pages: Array<number | Dots> = [1];
    if (left > 2) pages.push("dots-left");
    for (let p = left; p <= right; p += 1) pages.push(p);
    if (right < totalPages - 1) pages.push("dots-right");
    pages.push(totalPages);

    return pages;
  };

  const pages = buildPages();

  const goTo = (page: number) => {
    if (page < 1 || page > totalPages || page === safePage) return;
    onPageChange(page);
  };

  return (
    <div className={`mt-6 w-full flex items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => goTo(safePage - 1)}
        disabled={safePage === 1}
        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        typeof p === "number" ? (
          <button
            key={p}
            type="button"
            onClick={() => goTo(p)}
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold transition",
              p === safePage ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15",
            ].join(" ")}
          >
            {p}
          </button>
        ) : (
          <span key={`${p}-${idx}`} className="px-1 text-zinc-400">
            ...
          </span>
        )
      )}

      <button
        type="button"
        onClick={() => goTo(safePage + 1)}
        disabled={safePage === totalPages}
        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
