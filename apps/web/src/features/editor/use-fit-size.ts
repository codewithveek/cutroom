"use client";

import { type RefObject, useEffect, useState } from "react";

/** The observed element's size, kept current with a ResizeObserver. */
export function useElementSize(containerRef: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);
  return size;
}

/** The largest width × height with `aspect` (w / h) that fits inside the observed element. */
export function useFitSize(options: { containerRef: RefObject<HTMLElement | null>; aspect: number }): {
  width: number;
  height: number;
} {
  const container = useElementSize(options.containerRef);
  const width = Math.floor(Math.min(container.width, container.height * options.aspect));
  return { width, height: Math.floor(width / options.aspect) };
}
