"use client";

import { useEffect, useState } from "react";

/** Tailwind's breakpoints, for layout decisions CSS alone cannot make. */
export const breakpoints = {
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

/** Whether a media query matches; `initial` is used during server render and the first paint. */
export function useMediaQuery(query: string, initial = true): boolean {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}
