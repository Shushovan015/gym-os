import { useLayoutEffect, useRef } from "react";

// Invalidate in-flight responses as soon as the input/filter changes, including
// during the debounce window, and when the component unmounts.
export function useLatestRequest(key: string) {
  const version = useRef(0);
  useLayoutEffect(() => {
    version.current += 1;
    return () => { version.current += 1; };
  }, [key]);
  return () => {
    const current = ++version.current;
    return () => current === version.current;
  };
}
