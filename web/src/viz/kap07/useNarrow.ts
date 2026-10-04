import { useEffect, useRef, useState } from 'react';

/**
 * Om elementet er smalere enn `limit` piksler (mobil eller smal kolonne). Brukes til å gi grafer en
 * høyere viewBox når teksten i SVG-en blir stor, så plottene ikke blir flate.
 */
export function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

/**
 * Hvor mye større teksten i en figur blir (samme regel som <Figure> i kit-et: tekst minst 12,5 px på skjermen),
 * målt på et omsluttende element. Brukes når høyden på viewBox-en må gi plass til større tekst på mobil.
 */
export function useFigureTextScale<T extends HTMLElement>(vbWidth = 800) {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      // Figuren har 2 × 8 px luft og 2 × 1 px kant (2 × 4 px luft på mobil).
      const w = el.getBoundingClientRect().width - (window.innerWidth <= 600 ? 10 : 18);
      if (w > 0) setScale(Math.round(Math.max(1, 12.5 / 17 / (w / vbWidth)) * 20) / 20);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth]);
  return [ref, scale] as const;
}
