import { useReducedMotion } from "framer-motion";

type MotionMode = "auto" | "on" | "off";

const MOTION_MODE_KEY = "aa_motion_mode";
const DEFAULT_MOTION_MODE: MotionMode = "on";

function normalizeMotionMode(value: string | null | undefined): MotionMode | null {
  if (value === "auto" || value === "on" || value === "off") return value;
  return null;
}

export function getMotionMode(): MotionMode {
  if (typeof window === "undefined") return DEFAULT_MOTION_MODE;

  const stored = normalizeMotionMode(window.localStorage.getItem(MOTION_MODE_KEY));
  return stored ?? DEFAULT_MOTION_MODE;
}

export function applyMotionModeClass(mode: MotionMode = getMotionMode()) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.toggle("force-motion", mode === "on");
  root.classList.toggle("force-reduced-motion", mode === "off");
}

export function initializeMotionMode() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const queryMode = normalizeMotionMode(params.get("motion"));

  if (queryMode) {
    window.localStorage.setItem(MOTION_MODE_KEY, queryMode);
  } else {
    window.localStorage.setItem(MOTION_MODE_KEY, DEFAULT_MOTION_MODE);
  }

  applyMotionModeClass();
}

export function useAppReducedMotion(): boolean {
  const systemReducedMotion = useReducedMotion();
  const mode = getMotionMode();

  if (mode === "on") return false;
  if (mode === "off") return true;
  return Boolean(systemReducedMotion);
}
