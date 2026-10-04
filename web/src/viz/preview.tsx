/**
 * Forhåndsvisning av én visualisering uten resten av appen (ingen innlogging, server eller database).
 * Kun for utvikling: http://localhost:5173/viz-preview.html?fag=kjemi&id=k3-mol&theme=dark&width=390
 *
 * `fag` er fysikk (standard), kjemi eller biologi, og gir også fagets fargetema.
 * Laster bare kapittelet som trengs, så en feil i et annet kapittel ikke stopper forhåndsvisningen.
 * Uten `id` vises en liste over visualiseringene i kapittelet `chapter` (eller alle kapitler i faget).
 */
import { StrictMode, Suspense, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/pages.css';
import '../styles/subjects.css';
import '../styles/viz.css';
import type { VizMeta } from './types';

// `<fag>/kapNN/index.ts`
const chapters = import.meta.glob<{ default: VizMeta[] }>('./*/kap*/index.ts');
const SUBJECT_THEME: Record<string, string | null> = { fysikk: null, kjemi: 'chemistry', biologi: 'biology' };

const params = new URLSearchParams(location.search);
const id = params.get('id') ?? '';
const fag = params.get('fag') ?? 'fysikk';
const subjectTheme = SUBJECT_THEME[fag];
if (subjectTheme) document.documentElement.setAttribute('data-subject', subjectTheme);
const theme = params.get('theme');
const width = Number(params.get('width')) || 0;
if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);

const root = document.getElementById('root');
if (!root) throw new Error('Mangler #root');
root.style.padding = '24px 16px';
root.style.margin = '0 auto';
root.style.maxWidth = width ? `${width}px` : '980px';

/** Kapittelmodulene i faget, sortert etter kapittelnummer (mappene heter kap01, kap02 …). */
function chapterKeys(): string[] {
  return Object.keys(chapters)
    .filter((k) => k.startsWith(`./${fag}/kap`))
    .sort();
}

async function loadChapter(no: string): Promise<VizMeta[]> {
  const dir = `kap${no.padStart(2, '0')}`;
  const key = chapterKeys().find((k) => k.endsWith(`/${dir}/index.ts`));
  const mod = key ? chapters[key] : undefined;
  if (!mod) throw new Error(`Fant ikke ${fag}/${dir}/index.ts`);
  return (await mod()).default;
}

async function main() {
  const match = /^k(\d+)-(.+)$/.exec(id);
  if (!match) {
    const only = params.get('chapter');
    const keys = chapterKeys();
    const lists = await Promise.all(
      keys.filter((k) => !only || k.endsWith(`/kap${only.padStart(2, '0')}/index.ts`)).map(async (k) => (await chapters[k]!()).default),
    );
    if (lists.flat().length === 0) {
      root!.innerHTML = `<p data-viz-empty>Ingen visualiseringer i ${fag}${only ? `, kapittel ${only}` : ''}.</p>`;
      return;
    }
    createRoot(root!).render(
      <ul>
        {lists.flat().map((m) => (
          <li key={`${m.chapter}-${m.id}`}>
            <a href={`?fag=${fag}&id=k${m.chapter}-${m.id}${theme ? `&theme=${theme}` : ''}`}>
              k{m.chapter}-{m.id}: {m.title}
            </a>
          </li>
        ))}
      </ul>,
    );
    return;
  }
  const [, chapterNo, vizId] = match;
  const meta = (await loadChapter(chapterNo!)).find((m) => m.id === vizId);
  if (!meta) throw new Error(`Fant ikke visualiseringen «${id}»`);
  const Component: ComponentType = lazy(meta.load);
  createRoot(root!).render(
    <StrictMode>
      <header className="page-header">
        <div className="page-heading">
          <p className="eyebrow">
            Kapittel {meta.chapter} · {meta.sections.join(', ')}
          </p>
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.summary}</p>
        </div>
      </header>
      <Suspense fallback={<p className="viz-loading">Laster …</p>}>
        <div data-viz-ready>
          <Component />
        </div>
      </Suspense>
    </StrictMode>,
  );
}

main().catch((err: unknown) => {
  root.textContent = `Feil: ${err instanceof Error ? err.message : String(err)}`;
  root.setAttribute('data-viz-error', 'true');
  console.error(err);
});
