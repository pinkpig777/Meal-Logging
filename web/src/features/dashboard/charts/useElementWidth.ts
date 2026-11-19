import { useEffect, useRef, useState } from 'react';

/**
 * Width of a container element, updated with ResizeObserver, so SVG charts can
 * be drawn at their real pixel width (crisp 2 px gaps, no scaling of text).
 * Falls back to `fallback` where ResizeObserver is missing (tests).
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(fallback = 300) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
