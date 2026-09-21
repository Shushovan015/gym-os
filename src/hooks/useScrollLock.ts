import { useLayoutEffect } from "react";

let locks = 0;
let restore: (() => void) | undefined;

export function lockPageScroll() {
  if (locks++ === 0) {
    const body = document.body;
    const root = document.documentElement;
    const previous = { overflow: body.style.overflow, padding: body.style.paddingRight, rootOverflow: root.style.overflow };
    const gap = window.innerWidth - root.clientWidth;
    if (gap > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gap}px`;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    restore = () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.padding;
      root.style.overflow = previous.rootOverflow;
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) { restore?.(); restore = undefined; }
  };
}

export function useScrollLock(open: boolean) {
  useLayoutEffect(() => open ? lockPageScroll() : undefined, [open]);
}
