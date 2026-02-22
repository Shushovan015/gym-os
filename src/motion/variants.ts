import type { Variants } from "framer-motion";
import { motionTokens } from "./tokens";

export function pageTransitionVariants(reduceMotion: boolean): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: motionTokens.distance.lg, scale: 0.985, filter: "blur(10px)" },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.74,
        ease: motionTokens.easing.smoothOut,
      },
    },
    exit: {
      opacity: 0,
      y: -motionTokens.distance.sm,
      scale: 0.992,
      filter: "blur(6px)",
      transition: {
        duration: 0.38,
        ease: motionTokens.easing.smoothInOut,
      },
    },
  };
}

export function revealUpVariants(reduceMotion: boolean, distance = motionTokens.distance.md): Variants {
  if (reduceMotion) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0 },
    };
  }

  return {
    hidden: { opacity: 0, y: distance, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: motionTokens.duration.slow,
        ease: motionTokens.easing.smoothOut,
      },
    },
  };
}
