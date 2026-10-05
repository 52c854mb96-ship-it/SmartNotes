/**
 * Byggeklosser for galleriet over scene-kit-et (bare utvikling):
 *   http://localhost:5173/viz-preview.html?galleri=kjoretoy&theme=dark
 * Hver familie har sin egen fil i denne mappen med en standardeksport som viser gjenstandene i flere varianter.
 */
import type { ReactNode } from 'react';
import '../scene.css';
import { Figure } from '../../controls';

/** Én rute i galleriet: en figur med tittel. Tegn gjenstandene inne i viewBox-en. */
export function GalleryItem({ title, viewBox = '0 0 400 240', children }: { title: string; viewBox?: string; children: ReactNode }) {
  return (
    <section className="sc-gallery-item">
      <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 650 }}>{title}</h3>
      <Figure viewBox={viewBox} label={title} maxHeight={520}>
        {children}
      </Figure>
    </section>
  );
}

/** Rutenett med galleriruter (to kolonner på store skjermer, én på mobil). */
export function GalleryGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 18 }}>{children}</div>;
}
