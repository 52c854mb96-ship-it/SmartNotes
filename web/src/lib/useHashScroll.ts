import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Ruller til elementet i URL-ens #anker (f.eks. #del-2E fra søket) når det dukker opp,
 * og markerer det kort. `deps` fra kalleren styrer når vi prøver igjen (f.eks. når listen er lastet).
 */
export function useHashScroll(deps: unknown[] = []): void {
  const { hash, key } = useLocation();
  useEffect(() => {
    if (!hash || hash.length < 2) return;
    const id = decodeURIComponent(hash.slice(1));
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('is-flash');
    const t = setTimeout(() => el.classList.remove('is-flash'), 1600);
    return () => clearTimeout(t);
  }, [hash, key, ...deps]);
}
