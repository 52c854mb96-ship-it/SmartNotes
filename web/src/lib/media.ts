import { useEffect, useState } from 'react';

/** Under denne bredden blir sidepanelet en skuff. */
export const NARROW_QUERY = '(max-width: 899.98px)';
/** Fra denne bredden vises tre kolonner: sidepanel | notatliste | innhold. */
export const WIDE_QUERY = '(min-width: 1180px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
