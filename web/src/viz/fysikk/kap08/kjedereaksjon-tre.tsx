/**
 * Det forstørrede utsnittet i «Fisjon og kjedereaksjon» (k8-kjedereaksjon): kjedetreet generasjon for generasjon.
 * Et nøytron spalter en U-235-kjerne i to mindre kjerner og 2–3 nye nøytroner (med et lysglimt for energien). Nøytronene
 * flyr videre til nye U-235-kjerner, eller fanges av en borkjerne i en kontrollstav.
 */
import { useMemo, type ReactElement } from 'react';
import { Txt, VIZ } from '../../kit';
import { Atomkjerne, Nukleon, SCENE, alpha, useStrokeScale } from '../../kit/scene';
import { CHANNELS, fissionTime, neutronProgress, seededRandom, type ChainTree, type Point, type TreeLayout } from './model-kjedereaksjon';
import { Fisjonsglimt, Kontrollstavkjerne, NEUTRON_COLOR } from './kjedereaksjon-deler';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Hvor lenge de to nye kjernene bruker på å fly fra hverandre, og hvor lenge glimtet varer (generasjoner). */
const SPLIT_TIME = 0.35;
const FLASH_TIME = 0.5;

export interface KjedeTreProps {
  tree: ChainTree;
  layout: TreeLayout;
  /** Tida i avspillingen (se fissionTime). */
  t: number;
  /** Radius til U-235-kjernene og til flekkene i kontrollstavene. */
  R: number;
  rA: number;
  /** Radius til nøytronene. */
  rn: number;
}

/** Nukleonradien som gir en kjerne med nukleontall A radius ca. R (Atomkjerne: R ≈ r · (1 + 1,1 · ∛A)). */
const nucleonRadius = (Rk: number, A: number) => Rk / (1 + 1.1 * Math.cbrt(A));

const lerp = (a: Point, b: Point, s: number): Point => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s });

/** Kjedetreet ved tida t. Kjernene er memoisert, så bare nøytronene, banene og glimtene tegnes på nytt per bilde. */
export function KjedeTre({ tree, layout, t, R, rA, rn }: KjedeTreProps) {
  const ss = useStrokeScale();
  const rU = nucleonRadius(R, 235);

  // Retningen de to nye kjernene flyr i (på skrå, så de ikke treffer naboene i samme kolonne) og hvor langt.
  const splits = useMemo(() => {
    const rnd = seededRandom(tree.seed * 31 + 7);
    return tree.fissions.map(() => {
      const up = rnd() < 0.5 ? -1 : 1;
      const a = ((40 + rnd() * 20) * Math.PI) / 180;
      return { ux: Math.cos(a), uy: up * Math.sin(a) };
    });
  }, [tree]);

  const intact = useMemo<ReactElement[]>(
    () =>
      tree.fissions.map((f) => {
        const p = layout.fissions[f.id]!;
        return <Atomkjerne key={f.id} x={p.x} y={p.y} Z={92} N={143} r={rU} seed={f.id + 1} tegn={false} title="Uran-235" />;
      }),
    [tree, layout, rU],
  );

  const fragments = useMemo(
    () =>
      tree.fissions.map((f) => {
        const ch = CHANNELS[f.channel];
        return ch.fragments.map((n, i) => (
          <Atomkjerne
            key={i}
            x={0}
            y={0}
            Z={n.Z}
            N={n.A - n.Z}
            r={nucleonRadius(R * Math.cbrt(n.A / 235) * 0.98, n.A)}
            seed={f.id * 2 + i + 3}
            tegn={false}
            title={n.name[0]!.toUpperCase() + n.name.slice(1)}
          />
        ));
      }),
    [tree, R],
  );

  const absorbers = useMemo(
    () => tree.absorbers.map((a) => <Kontrollstavkjerne key={a.id} x={layout.absorbers[a.id]!.x} y={layout.absorbers[a.id]!.y} r={rA} seed={a.id + 2} />),
    [tree, layout, rA],
  );

  const tracks: ReactElement[] = [];
  const moving: ReactElement[] = [];
  const stuck: ReactElement[] = [];
  for (const n of tree.neutrons) {
    const path = layout.neutrons[n.id]!;
    const s = neutronProgress(path, t);
    if (s <= 0) continue;
    const at = lerp(path.from, path.to, s);
    // Banen starter ved kanten av kjernen som sendte nøytronet ut.
    tracks.push(
      <line
        key={n.id}
        x1={r1(path.from.x)}
        y1={r1(path.from.y)}
        x2={r1(at.x)}
        y2={r1(at.y)}
        stroke={NEUTRON_COLOR}
        strokeWidth={1.6 * ss}
        strokeLinecap="round"
        opacity={0.7}
      />,
    );
    if (s < 1) moving.push(<Nukleon key={n.id} x={at.x} y={at.y} r={rn} type="noytron" />);
    else if (n.fate === 'fanget') {
      // Nøytronet sitter fast i kontrollstavkjernen, på siden det kom fra.
      const dx = path.to.x - path.from.x;
      const dy = path.to.y - path.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = rA * 0.62;
      stuck.push(<Nukleon key={n.id} x={path.to.x - (dx / len) * off} y={path.to.y - (dy / len) * off} r={rn * 0.92} type="noytron" />);
    } else if (n.fate === 'videre') moving.push(<Nukleon key={n.id} x={at.x} y={at.y} r={rn} type="noytron" />);
  }

  const nuclei: ReactElement[] = [];
  const flashes: ReactElement[] = [];
  for (const f of tree.fissions) {
    const tf = fissionTime(f.gen);
    const p = layout.fissions[f.id]!;
    if (t < tf) {
      nuclei.push(intact[f.id]!);
      continue;
    }
    const s = Math.min(1, (t - tf) / SPLIT_TIME);
    const e = 1 - (1 - s) * (1 - s);
    const d = R * 0.62 * e;
    const u = splits[f.id]!;
    const pair = fragments[f.id]!;
    nuclei.push(
      <g key={f.id}>
        <g transform={`translate(${r1(p.x - u.ux * d)} ${r1(p.y - u.uy * d)})`}>{pair[0]}</g>
        <g transform={`translate(${r1(p.x + u.ux * d)} ${r1(p.y + u.uy * d)})`}>{pair[1]}</g>
      </g>,
    );
    const glow = 1 - (t - tf) / FLASH_TIME;
    if (glow > 0) flashes.push(<Fisjonsglimt key={f.id} x={p.x} y={p.y} r={R * 2.3} styrke={glow} />);
  }

  return (
    <g>
      <g>{tracks}</g>
      <g>{absorbers}</g>
      <g>{stuck}</g>
      <g>{flashes}</g>
      <g>{nuclei}</g>
      <g>{moving}</g>
    </g>
  );
}

/** Overskriftene over kolonnene: «g = 0», «g = 1» … */
export function KolonneTitler({ layout, y }: { layout: TreeLayout; y: number }) {
  return (
    <g>
      {layout.columns.map((x, g) => (
        <Txt key={g} x={x} y={y} size={0.78} muted>
          {g === 0 ? 'Generasjon 0' : String(g)}
        </Txt>
      ))}
    </g>
  );
}

/** Bakgrunnen i utsnittet: vann mellom brenselet, svakt blått. */
export function Utsnittbakgrunn({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ss = useStrokeScale();
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={VIZ.surface} />
      <rect x={x} y={y} width={w} height={h} rx={12} fill={alpha(SCENE.water, 0.14)} stroke={alpha(SCENE.outline, 0.6)} strokeWidth={1.2 * ss} />
    </g>
  );
}
