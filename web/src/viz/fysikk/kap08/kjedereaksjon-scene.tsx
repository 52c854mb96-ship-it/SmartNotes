/**
 * Hele figuren i «Fisjon og kjedereaksjon» (k8-kjedereaksjon): reaktorbassenget med kontrollstavene til venstre (på
 * mobil øverst), et forstørret utsnitt av brenselet med kjedetreet, og en forklaring av symbolene nederst.
 */
import { useMemo, type ReactNode } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import { Atomkjerne, Callout, Nukleon, useSceneScale, useStrokeScale } from '../../kit/scene';
import { Bakgrunnskjerner, Kontrollstavkjerne, URAN_COLOR, Reaktorbasseng, ZoomRamme, reaktorGeometri, rodInsertion } from './kjedereaksjon-deler';
import { KjedeTre, KolonneTitler, Utsnittbakgrunn } from './kjedereaksjon-tre';
import { backgroundNuclei, layoutChainTree, treeNucleusRadius, type ChainTree } from './model-kjedereaksjon';

export const SCENE_W = 800;

interface SceneLayout {
  h: number;
  reactor: { x: number; y: number; w: number; h: number };
  panel: { x: number; y: number; w: number; h: number };
  /** Symbolforklaringen: øverste rad og antall kolonner. */
  key: { y: number; cols: number; rowH: number };
}

/** Plasseringen av delene. På mobil (`narrow`) står bassenget over utsnittet. */
export function kjedeLayout(narrow: boolean): SceneLayout {
  if (narrow) {
    return {
      h: 1040,
      reactor: { x: 210, y: 6, w: 380, h: 330 },
      panel: { x: 6, y: 352, w: 788, h: 520 },
      key: { y: 906, cols: 2, rowH: 52 },
    };
  }
  return {
    h: 500,
    reactor: { x: 4, y: 6, w: 300, h: 420 },
    panel: { x: 320, y: 8, w: 474, h: 418 },
    key: { y: 452, cols: 3, rowH: 30 },
  };
}

export interface KjedeSceneProps {
  tree: ChainTree;
  /** Andelen nøytroner som fanges av kontrollstavene (0–1). */
  capture: number;
  t: number;
  /** Effekten nå i forhold til starten (styrer det blå skjæret), 0–1 etter klemming. */
  glow: number;
  narrow: boolean;
}

export function KjedeScene({ tree, capture, t, glow, narrow }: KjedeSceneProps) {
  const f = useTextScale();
  const sc = useSceneScale();
  const ss = useStrokeScale();
  const L = kjedeLayout(narrow);
  const geo = reaktorGeometri(L.reactor.x, L.reactor.y, L.reactor.w, L.reactor.h);
  const P = L.panel;

  const headerH = 30 * f;
  const box = { x: P.x + 4, y: P.y + headerH + 4, w: P.w - 8, h: P.h - headerH - 10 };
  // Kjernene blir så store som det er plass til: store når kjeden er smal, mindre når den vokser.
  const R = treeNucleusRadius(Math.max(...tree.counts), box.h, box.w / (tree.generations + 1), 22 * sc);
  const rA = 0.46 * R;
  const rn = Math.max(4.4 * sc, 0.3 * R);
  const keyR = 13 * sc;
  const { layout, bg } = useMemo(() => {
    const lay = layoutChainTree(tree, box, { R, rA });
    return { layout: lay, bg: backgroundNuclei(lay, box, R, rA, 0.56 * R, tree.seed) };
  }, [tree, box.x, box.y, box.w, box.h, R, rA]); // eslint-disable-line react-hooks/exhaustive-deps

  const z = geo.zoom;
  const ctrl = geo.slots.filter((s) => s.kind === 'kontroll');
  const fuel = geo.slots.filter((s) => s.kind === 'brensel');
  const ch = geo.core.bottom - geo.core.top;
  const ins = rodInsertion(capture);
  const rodPointY = geo.core.top + ins * ch - ch * 0.55;

  return (
    <g>
      <Reaktorbasseng geo={geo} innsetting={ins} glod={glow} />
      <ZoomRamme x={z.x} y={z.y} w={z.w} h={z.h} color={VIZ.ink} />

      {/* Etiketter til bassenget */}
      {narrow ? (
        <>
          <Callout x={ctrl[0]!.x} y={rodPointY} lx={L.reactor.x - 12} ly={geo.floorY + 40} anchor="end">
            Kontrollstaver
          </Callout>
          <Callout x={fuel[0]!.x} y={geo.core.bottom - ch * 0.2} lx={L.reactor.x - 12} ly={geo.core.bottom - 6} anchor="end">
            Brensel (uran)
          </Callout>
          <Callout x={geo.pool.x2 - 18} y={geo.waterY + 30} lx={L.reactor.x + L.reactor.w + 12} ly={geo.waterY + 36} anchor="start">
            Vann
          </Callout>
        </>
      ) : (
        <>
          <Callout x={ctrl[0]!.x} y={rodPointY} lx={geo.pool.x1 + 8} ly={geo.waterY + 26 * f} anchor="start">
            Kontrollstaver
          </Callout>
          <Callout x={fuel[1]!.x} y={geo.core.bottom - ch * 0.22} lx={geo.core.cx} ly={geo.pool.bottom - 6} anchor="middle">
            Brensel (uran)
          </Callout>
        </>
      )}

      {/* Utsnittet */}
      <Utsnittbakgrunn x={P.x} y={P.y} w={P.w} h={P.h} />
      {narrow ? (
        <g stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="5 4" fill="none" opacity={0.85}>
          <line x1={z.x} y1={z.y + z.h} x2={P.x + 14} y2={P.y} />
          <line x1={z.x + z.w} y1={z.y + z.h} x2={P.x + P.w - 14} y2={P.y} />
        </g>
      ) : (
        <g stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="5 4" fill="none" opacity={0.85}>
          <line x1={z.x + z.w} y1={z.y} x2={P.x} y2={P.y + 14} />
          <line x1={z.x + z.w} y1={z.y + z.h} x2={P.x} y2={P.y + P.h - 14} />
        </g>
      )}
      <Bakgrunnskjerner points={bg} r={0.56 * R} />
      <KolonneTitler layout={layout} y={P.y + headerH - 6} left={P.x + 12} />
      <KjedeTre tree={tree} layout={layout} t={t} R={R} rA={rA} rn={rn} />

      <Symbolforklaring L={L} R={keyR} rA={0.5 * keyR} rn={4.4 * sc} f={f} />
    </g>
  );
}

/** Forklaring av symbolene under figuren: U-235, nøytron, spaltet kjerne og fanget nøytron. */
function Symbolforklaring({ L, R, rA, rn, f }: { L: SceneLayout; R: number; rA: number; rn: number; f: number }) {
  const items: { label: string; icon: (x: number, y: number) => ReactNode }[] = [
    { label: 'Uran-235', icon: (x, y) => <Atomkjerne x={x} y={y} Z={92} N={143} r={(R * 0.8) / 7.8} tegn={false} /> },
    { label: 'Nøytron', icon: (x, y) => <Nukleon x={x} y={y} r={rn} type="noytron" /> },
    {
      label: 'Spaltet i to kjerner',
      icon: (x, y) => (
        <>
          <Atomkjerne x={x - R * 0.42} y={y - R * 0.12} Z={56} N={85} r={(R * 0.62) / 6.7} tegn={false} seed={4} />
          <Atomkjerne x={x + R * 0.48} y={y + R * 0.14} Z={36} N={56} r={(R * 0.54) / 6} tegn={false} seed={5} />
        </>
      ),
    },
    {
      label: 'Fanget i kontrollstav',
      icon: (x, y) => (
        <>
          <Kontrollstavkjerne x={x} y={y} r={rA * 0.9} seed={9} />
          <Nukleon x={x - rA * 0.55} y={y} r={rn * 0.9} type="noytron" />
        </>
      ),
    },
    {
      label: 'Andre urankjerner',
      icon: (x, y) => <circle cx={x} cy={y} r={R * 0.62} fill={URAN_COLOR} opacity={0.4} />,
    },
  ];
  const colW = (SCENE_W - 20) / L.key.cols;
  return (
    <g>
      {items.map((it, i) => {
        const col = i % L.key.cols;
        const row = Math.floor(i / L.key.cols);
        const x = 14 + col * colW + R * 1.1;
        const y = L.key.y + row * L.key.rowH;
        return (
          <g key={it.label}>
            {it.icon(x, y)}
            <Txt x={x + R * 1.2 + 4} y={y + 5.5 * f * 0.8} anchor="start" size={0.8}>
              {it.label}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}
