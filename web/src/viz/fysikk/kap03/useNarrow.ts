import { useEffect, useRef, useState } from 'react';

/**
 * Om beholderen er smal (mobil). Brukes til å gi stablede grafer en høyere viewBox på smale skjermer,
 * der teksten i SVG-en blir større og ellers ville spist opp grafene.
 * Legg `ref` på en <div> rundt figuren.
 */
export function useNarrow<T extends HTMLElement = HTMLDivElement>(threshold = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < threshold);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [threshold]);
  return { ref, narrow };
}
