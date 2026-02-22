import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { pageTransitionVariants } from "@src/motion/variants";
import { motionTokens } from "@src/motion/tokens";
import { useAppReducedMotion } from "@src/motion/preferences";

type RouteTransitionProps = {
  children: ReactNode;
};

export default function RouteTransition({ children }: RouteTransitionProps) {
  const reduceMotion = useAppReducedMotion();
  const variants = pageTransitionVariants(Boolean(reduceMotion));
  const veilInitial = reduceMotion ? { opacity: 0 } : { scaleY: 1, transformOrigin: "top center" };
  const veilAnimate = reduceMotion
    ? { opacity: 0 }
    : {
        scaleY: 0,
        transition: {
          duration: 0.58,
          ease: motionTokens.easing.smoothOut,
        },
      };
  const veilExit = reduceMotion
    ? { opacity: 0 }
    : {
        scaleY: 1,
        transformOrigin: "bottom center",
        transition: {
          duration: 0.32,
          ease: motionTokens.easing.smoothInOut,
        },
      };

  return (
    <motion.div initial="initial" animate="animate" exit="exit" variants={variants} className="relative">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-50 bg-[#05080f]"
        initial={veilInitial}
        animate={veilAnimate}
        exit={veilExit}
      />
      {children}
    </motion.div>
  );
}
