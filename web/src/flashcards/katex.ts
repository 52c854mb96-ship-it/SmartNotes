/**
 * KaTeX (med mhchem for \ce{…}) lastes først når flashcards åpnes, så resten av appen ikke blir tyngre.
 * Filene precaches av service workeren, så formlene vises også offline.
 */
import { useSyncExternalStore } from 'react';

type Katex = (typeof import('katex'))['default'];

let katex: Katex | null = null;
let loading: Promise<Katex | null> | null = null;
let failed = false;
const listeners = new Set<() => void>();

export function loadKatex(): Promise<Katex | null> {
  loading ??= (async () => {
    try {
      const [mod] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')]);
      await import('katex/contrib/mhchem');
      katex = mod.default;
    } catch {
      // Uten KaTeX vises formlene som LaTeX-tekst.
      failed = true;
    }
    for (const l of listeners) l();
    return katex;
  })();
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** KaTeX når den er lastet, ellers null (og lasting startes). */
export function useKatex(): { katex: Katex | null; failed: boolean } {
  const k = useSyncExternalStore(subscribe, () => katex);
  const f = useSyncExternalStore(subscribe, () => failed);
  if (!k && !f) void loadKatex();
  return { katex: k, failed: f };
}

const cache = new Map<string, string>();

/** HTML for en formel. `trust: false` gjør at KaTeX ikke slipper gjennom lenker, bilder eller HTML fra kortene. */
export function renderTex(k: Katex, tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    html = k.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      trust: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
      maxSize: 20,
      maxExpand: 300,
      errorColor: 'currentColor',
    });
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}
