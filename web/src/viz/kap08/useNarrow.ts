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
