/**
 * Forhåndsvisning av én visualisering uten resten av appen (ingen innlogging, server eller database).
 * Kun for utvikling: http://localhost:5173/viz-preview.html?id=k2-friksjon&theme=dark&width=390
 *
 * Laster bare kapittelet som trengs, så en feil i et annet kapittel ikke stopper forhåndsvisningen.
 * Uten `id` vises en liste over visualiseringene i kapittelet `chapter` (eller alle kapitler).
 */
import { StrictMode, Suspense, lazy, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/pages.css';
import '../styles/viz.css';
import type { VizMeta } from './types';

const chapters = import.meta.glob<{ default: VizMeta[] }>('./kap*/index.ts');

const params = new URLSearchParams(location.search);
const id = params.get('id') ?? '';
const theme = params.get('theme');
const width = Number(params.get('width')) || 0;
if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);

const root = document.getElementById('root');
if (!root) throw new Error('Mangler #root');
root.style.padding = '24px 16px';
root.style.margin = '0 auto';
root.style.maxWidth = width ? `${width}px` : '980px';

async function loadChapter(no: string): Promise<VizMeta[]> {
  const key = `./kap${no.padStart(2, '0')}/index.ts`;
  const mod = chapters[key];
  if (!mod) throw new Error(`Fant ikke ${key}`);
  return (await mod()).default;
}

async function main() {
  const match = /^k(\d+)-(.+)$/.exec(id);
  if (!match) {
    const only = params.get('chapter');
    const keys = Object.keys(chapters).sort();
    const lists = await Promise.all(
      keys.filter((k) => !only || k.includes(`kap${only.padStart(2, '0')}`)).map(async (k) => (await chapters[k]!()).default),
    );
    createRoot(root!).render(
      <ul>
        {lists.flat().map((m) => (
          <li key={`${m.chapter}-${m.id}`}>
            <a href={`?id=k${m.chapter}-${m.id}${theme ? `&theme=${theme}` : ''}`}>
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
