import { Link } from "react-router-dom";
import { useEffect } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ArrowRight, ImageOff } from "lucide-react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@src/motion/preferences";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PublicSEO({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  useEffect(() => {
    document.title = title;
    const metaName = "description";
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${metaName}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = metaName;
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [description, title]);

  return null;
}

export function PageRoot({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("relative overflow-hidden pb-14", className)}>{children}</div>;
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  children,
  className = "",
  containerClassName = "",
  animated = true,
  id,
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  animated?: boolean;
  id?: string;
}) {
  const reduceMotion = useAppReducedMotion();
  const content = <Container className={containerClassName}>{children}</Container>;

  if (!animated || reduceMotion) {
    return <section id={id} className={cx("py-12 sm:py-16 lg:py-20", className)}>{content}</section>;
  }

  return (
    <motion.section
      id={id}
      className={cx("py-12 sm:py-16 lg:py-20", className)}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {content}
    </motion.section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--public-line)] bg-white/[0.03] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--public-accent-strong)]">
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "mb-8 flex flex-col gap-4 lg:mb-10",
        align === "center" ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between"
      )}
    >
      <div className={cx("max-w-3xl", align === "center" && "mx-auto")}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description ? <p className="mt-4 text-base leading-7 text-[var(--public-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-2xl border border-[var(--public-line)] bg-[var(--public-surface)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-6", className)}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article className={cx("rounded-2xl border border-[var(--public-line)] bg-white/[0.035] p-5 transition duration-200 hover:border-[var(--public-line-strong)]", className)}>
      {children}
    </article>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" }) {
  const tones = {
    neutral: "border-[var(--public-line)] bg-white/[0.04] text-[var(--public-muted)]",
    accent: "border-[rgba(217,154,40,0.35)] bg-[rgba(217,154,40,0.12)] text-[var(--public-accent-strong)]",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  };

  return <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function PrimaryCTA({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--public-accent)] px-5 py-3 text-sm font-extrabold text-[#14110d] transition hover:bg-[var(--public-accent-strong)]",
        className
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function SecondaryCTA({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--public-line-strong)] bg-white/[0.025] px-5 py-3 text-sm font-semibold text-[var(--public-text)] transition hover:border-[var(--public-accent)] hover:bg-white/[0.06]",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--public-accent-strong)] hover:text-[var(--public-text)]">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function ImageFrame({
  src,
  alt,
  className = "",
  imgClassName = "",
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-2xl border border-[var(--public-line)] bg-[var(--public-surface-2)]", className)}>
      {src ? (
        <img src={src} alt={alt} loading={loading} className={cx("h-full w-full object-cover", imgClassName)} />
      ) : (
        <div className="grid h-full min-h-56 place-items-center text-center text-sm text-[var(--public-muted)]">
          <div>
            <ImageOff className="mx-auto mb-2 h-6 w-6" />
            Image coming soon
          </div>
        </div>
      )}
    </div>
  );
}

export function SplitFeature({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  children,
  reverse = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  image?: string | null;
  imageAlt: string;
  children?: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={cx("grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center", reverse && "lg:[&>*:first-child]:order-2")}>
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-normal text-[var(--public-text)] sm:text-4xl">{title}</h2>
        {description ? <p className="mt-4 text-base leading-7 text-[var(--public-muted)]">{description}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
      <ImageFrame src={image} alt={imageAlt} className="aspect-[4/3] lg:aspect-[5/4]" />
    </div>
  );
}

export function LoadingState({ label = "Loading content..." }: { label?: string }) {
  return <div className="rounded-2xl border border-[var(--public-line)] bg-white/[0.03] p-5 text-sm text-[var(--public-muted)]">{label}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--public-line)] bg-white/[0.025] p-8 text-center">
      <h3 className="text-lg font-semibold text-[var(--public-text)]">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-100">{message}</div>;
}

export function ExternalAnchor({
  children,
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  return (
    <a
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--public-line-strong)] px-5 py-3 text-sm font-semibold text-[var(--public-text)] transition hover:border-[var(--public-accent)] hover:bg-white/[0.06]",
        className
      )}
    >
      {children}
    </a>
  );
}
