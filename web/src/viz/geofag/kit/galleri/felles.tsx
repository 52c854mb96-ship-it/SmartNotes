/**
 * Byggeklosser for galleriet over geofag-kit-et (bare utvikling):
 *   http://localhost:5173/viz-preview.html?galleri=geo-snitt&theme=dark      (én familie, med fagtemaet «Fjell»)
 *   node scripts/galleri-shot.mjs --port 5173 --galleri geo-snitt --out /tmp/galleri
 * Hver familie har sin egen fil i denne mappen (geo-<filnavn>) med en standardeksport som viser byggeklossene i flere
 * varianter. Galleriet importerer ikke kit-ets index.ts, så fargene lastes her.
 */
import type { CSSProperties, ReactNode } from 'react';
import '../../../kit/scene/scene.css';
import '../geofag.css';
import { Figure } from '../../../kit/controls';
import { useContainerTextScale } from '../../../kjemi/kit/controls';

type MedSkala<T> = T | ((f: number) => T);

/**
 * Én rute i galleriet: en figur med tittel. `viewBox` og `children` kan være funksjoner av tekstskaleringen `f`
 * (1 på PC, ca. 1,8 på mobil for en 800 bred figur), så ruten kan bli høyere eller bytte oppsett på mobil:
 *   <GalleryItem title="Lagpakke" viewBox={(f) => `0 0 800 ${geoHoyde(f, 300)}`}>{(f) => …}</GalleryItem>
 * `wide` gir ruten hele bredden i rutenettet. `note` er en kort forklaring under tittelen.
 */
export function GalleryItem({
  title,
  viewBox = '0 0 400 240',
  wide,
  note,
  children,
}: {
  title: string;
  viewBox?: MedSkala<string>;
  wide?: boolean;
  note?: ReactNode;
  children: MedSkala<ReactNode>;
}) {
  const vb1 = typeof viewBox === 'function' ? viewBox(1) : viewBox;
  const vbWidth = Number(vb1.split(/[\s,]+/)[2]) || 400;
  const [ref, f] = useContainerTextScale<HTMLDivElement>(vbWidth);
  const vb = typeof viewBox === 'function' ? viewBox(f) : viewBox;
  return (
    <section className="sc-gallery-item" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 650 }}>{title}</h3>
      {note && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-2)' }}>{note}</p>}
      <div ref={ref}>
        <Figure viewBox={vb} label={title} maxHeight={wide ? 1400 : 560}>
          {typeof children === 'function' ? children(f) : children}
        </Figure>
      </div>
    </section>
  );
}

/** Rutenett med galleriruter (to kolonner på store skjermer, én på mobil). */
export function GalleryGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 18 }}>{children}</div>;
}

/** Én fargeprøve: navnet i koden (f.eks. «GEO.magma»), fyllfargen og eventuelt kantfargen. */
export interface Fargeprove {
  navn: string;
  fill: string;
  line?: string;
}

/**
 * Fargeprøver i HTML (ikke SVG), med navnet slik det skrives i koden. Ruten har figurens bakgrunn (`--viz-surface`),
 * så kontrasten blir som i visualiseringene. `line` vises som kant og som en strek oppå fyllet.
 */
export function Fargeprover({ title, farger, note }: { title: string; farger: readonly Fargeprove[]; note?: ReactNode }) {
  return (
    <section className="sc-gallery-item" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 650 }}>{title}</h3>
      {note && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-2)' }}>{note}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: '8px 14px',
          padding: 12,
          background: 'var(--viz-surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        {farger.map((p) => (
          <div key={p.navn} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={chip(p)} aria-hidden>
              {p.line && <span style={{ position: 'absolute', left: 6, right: 6, top: '50%', height: 2, marginTop: -1, background: p.line, borderRadius: 1 }} />}
            </span>
            <code style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.navn}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function chip(p: Fargeprove): CSSProperties {
  return {
    position: 'relative',
    flex: '0 0 auto',
    width: 40,
    height: 24,
    borderRadius: 5,
    background: p.fill,
    border: `1.5px solid ${p.line ?? 'var(--border-strong)'}`,
  };
}
