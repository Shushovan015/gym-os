import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let gsapInitialized = false;

export function initGsap() {
  if (gsapInitialized) return;
  gsap.registerPlugin(ScrollTrigger);
  gsapInitialized = true;
}

export { gsap, ScrollTrigger };
