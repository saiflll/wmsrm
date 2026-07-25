import React, { useState, useEffect, useRef } from 'react';

export function useContainerWidth(fallback = 760) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

export function useBarAnimation(dataSignature: unknown) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const raf = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(raf2);
    });
  }, [dataSignature]);
  return ready;
}

export function labelRotationFor(spacePerLabel: number) {
  if (spacePerLabel > 40) return 0;
  if (spacePerLabel > 22) return -30;
  return -45;
}

export const percentage = (part: number, total: number) => {
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  return total > 0 ? clamp(Math.round((part / total) * 100), 0, 100) : 0;
};
