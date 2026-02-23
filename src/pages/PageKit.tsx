import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { revealUpVariants } from "@src/motion/variants";
import { motionTokens } from "@src/motion/tokens";
import { useAppReducedMotion } from "@src/motion/preferences";

export function PageRoot({ children }: { children: ReactNode }) {
    return <div className="space-y-16 pb-10">{children}</div>;
}

export function Section({
    children,
    className = "",
    animated = true,
    delay = 0,
}: {
    children: ReactNode;
    className?: string;
    animated?: boolean;
    delay?: number;
}) {
    const reduceMotion = useAppReducedMotion();

    if (!animated) {
        return <section className={`section-pad ${className}`}>{children}</section>;
    }

    return (
        <motion.section
            className={`section-pad ${className}`}
            variants={revealUpVariants(Boolean(reduceMotion), motionTokens.distance.md)}
            initial={reduceMotion ? "show" : "hidden"}
            animate="show"
            transition={{
                duration: motionTokens.duration.slow,
                delay,
                ease: motionTokens.easing.smoothOut,
            }}
        >
            {children}
        </motion.section>
    );
}

export function HeroCard({ badge, title, desc, children }: { badge: string; title: string; desc: string; children?: ReactNode }) {
    return (
        <div className="surface-card relative overflow-hidden p-7 sm:p-9 lg:p-10">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-accent2/20 blur-3xl" />
            <div className="relative">
                <div className="label-chip">{badge}</div>
                <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">{title}</h1>
                <p className="mt-4 max-w-3xl text-muted leading-relaxed">{desc}</p>
                {children}
            </div>
        </div>
    );
}

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`surface-card p-6 sm:p-8 ${className}`}>{children}</div>;
}

export function SurfaceSoft({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`surface-card-soft p-5 ${className}`}>{children}</div>;
}

export function PrimaryCTA({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} className="btn-primary">
            {children}
        </Link>
    );
}

export function SecondaryCTA({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} className="btn-secondary">
            {children}
        </Link>
    );
}
