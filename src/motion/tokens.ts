export const motionTokens = {
  duration: {
    instant: 0,
    fast: 0.24,
    base: 0.42,
    slow: 0.62,
  },
  easing: {
    smoothOut: [0.22, 1, 0.36, 1] as const,
    smoothInOut: [0.42, 0, 0.2, 1] as const,
  },
  stagger: {
    tight: 0.04,
    base: 0.08,
  },
  distance: {
    sm: 12,
    md: 24,
    lg: 36,
  },
} as const;

export type MotionTokens = typeof motionTokens;
