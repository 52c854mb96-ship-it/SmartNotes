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

/**
 * Makroene fra LaTeX-malene til notatene (server/latex/<fag>/preamble.tex) og de enkleste fra siunitx, så kort som
 * likevel bruker dem, vises riktig.
 */
const MACROS: Record<string, string> = {
  '\\dd': '\\mathop{}\\!\\mathrm{d}',
  '\\dv': '\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}',
  '\\ddv': '\\frac{\\mathrm{d}^2#1}{\\mathrm{d}#2^2}',
  '\\pdv': '\\frac{\\partial#1}{\\partial#2}',
  '\\vb': '\\mathbf{#1}',
  '\\vu': '\\hat{\\mathbf{#1}}',
  '\\abs': '\\left\\lvert#1\\right\\rvert',
  '\\norm': '\\left\\lVert#1\\right\\rVert',
  '\\enhet': '\\,[\\mathrm{#1}]',
  '\\qty': '#1\\,\\mathrm{#2}',
  '\\SI': '#1\\,\\mathrm{#2}',
  '\\num': '#1',
  '\\unit': '\\mathrm{#1}',
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** HTML for en formel. `trust: false` gjør at KaTeX ikke slipper gjennom lenker, bilder eller HTML fra kortene. */
export function renderTex(k: Katex, tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    try {
      html = k.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        trust: false,
        strict: 'ignore',
        output: 'htmlAndMathml',
        maxSize: 20,
        maxExpand: 300,
        errorColor: 'currentColor',
        // KaTeX endrer objektet (\gdef), så det får en ny kopi hver gang.
        macros: { ...MACROS },
      });
    } catch {
      // Bare syntaksfeil fanges av throwOnError: false; f.eks. mhchem kan kaste andre feil. Da vises koden som tekst.
      html = `<span class="katex-error">${escapeHtml(tex)}</span>`;
    }
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}
