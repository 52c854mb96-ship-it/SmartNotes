/**
 * Egne gjenstander til strikkhoppet (k2-strikkhopp), i samme stil som scene-kit-et: fjellvegger i en elvekløft,
 * en betongbru med hoppeplattform og en høydeskala. Toninger fra core.tsx, SCENE-farger, kontur og myke skygger.
 */
import { memo, useMemo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { LinearGradient, PAINTS, SCENE, materialStops, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

type Pt = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`).join('');

/* ---------------------------------------------------------------- Fjellvegg */

/**
 * Fjellvegg i en kløft sett forfra: berg med lagdeling og sprekker, gress og lyng på kanten øverst og noen hyller
 * med gress. Den indre kanten (mot kløfta) er ujevn. Lyset kommer fra venstre, så den venstre veggen har
 * skyggesiden mot kløfta og den høyre har lyssiden.
 *   <Fjellvegg side="venstre" ytre={0} topp={[160, 84]} bunn={[200, 430]} />
 * Ankerpunkt: `topp` og `bunn` er den indre kanten øverst og nederst; veggen fyller ut til `ytre` (x).
 */
export const Fjellvegg = memo(function Fjellvegg({
  side,
  ytre,
  topp,
  bunn,
  seed = 1,
}: {
  side: 'venstre' | 'hoyre';
  ytre: number;
  topp: Pt;
  bunn: Pt;
  seed?: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('sh-fjell');
  const geo = useMemo(() => {
    const rand = sceneRandom(seed * 7919 + (side === 'venstre' ? 1 : 2));
    const dir = side === 'venstre' ? 1 : -1;
    const [tx, ty] = topp;
    const [bx, by] = bunn;
    const n = 14;
    const edge: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      // Bratt øverst, litt utoverhengende hyller nedover (sagtann), glatt mot vannet.
      const base = tx + (bx - tx) * Math.pow(u, 0.9);
      const jag = i === 0 || i === n ? 0 : (rand() - 0.35) * 14 * dir;
      edge.push([base + jag, ty + (by - ty) * u]);
    }
    const outline: Pt[] = [[ytre, ty - 2], ...edge, [ytre, by + 60]];
    // Skygge- eller lyssiden langs kanten: to bånd innover i veggen (bredt og svakt, smalt og sterkere).
    const bandOf = (w: number): string => {
      const inner = edge
        .slice()
        .reverse()
        .map(([x, y]): Pt => [x - dir * w * (1 + 0.35 * Math.sin(y * 0.05)), y]);
      return `${path([...edge, ...inner])}Z`;
    };
    const band = [bandOf(26), bandOf(11)];
    // Lagdeling: svakt skrå linjer fra kanten og innover.
    let strata = '';
    for (let i = 1; i < 7; i++) {
      const y = ty + ((by - ty) * (i + rand() * 0.6)) / 7;
      const len = 40 + rand() * 70;
      const x0 = edgeX(edge, y) - dir * (4 + rand() * 10);
      strata += `M${r1(x0)},${r1(y)}q${r1(-dir * len * 0.5)},${r1(-3 - rand() * 4)} ${r1(-dir * len)},${r1(2 + rand() * 6)}`;
    }
    // Sprekker: korte, nesten loddrette streker.
    let cracks = '';
    for (let i = 0; i < 9; i++) {
      const y = ty + 20 + rand() * (by - ty - 40);
      const x = edgeX(edge, y) - dir * (10 + rand() * 60);
      const len = 12 + rand() * 26;
      cracks += `M${r1(x)},${r1(y)}l${r1(dir * (rand() - 0.5) * 6)},${r1(len * 0.5)}l${r1(dir * (rand() - 0.5) * 6)},${r1(len * 0.5)}`;
    }
    // Hyller med gress (små tuer) et par steder langs kanten.
    const ledges: { x: number; y: number; w: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const y = ty + (by - ty) * (0.22 + 0.26 * i + rand() * 0.08);
      ledges.push({ x: edgeX(edge, y) - dir * (8 + rand() * 18), y, w: 14 + rand() * 12 });
    }
    return { outline: `${path(outline)}Z`, edge: path(edge), band, strata, cracks, ledges, dir };
  }, [side, ytre, topp[0], topp[1], bunn[0], bunn[1], seed]);
  const lit = side === 'hoyre';
  const x0 = Math.min(ytre, topp[0], bunn[0]);
  const x1 = Math.max(ytre, topp[0], bunn[0]);
  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}f`}
        userSpace
        x1={0}
        y1={topp[1]}
        x2={0}
        y2={bunn[1]}
        stops={[
          [0, tint(SCENE.stone, 0.14)],
          [0.6, SCENE.stone],
          [1, shade(SCENE.stone, 0.28)],
        ]}
      />
      <clipPath id={`${id}k`}>
        <path d={geo.outline} />
      </clipPath>
      <path d={geo.outline} fill={`url(#${id}f)`} />
      <g clipPath={`url(#${id}k)`}>
        {geo.band.map((d, i) => (
          <path key={i} d={d} fill={lit ? SCENE.highlight : SCENE.shadow} opacity={lit ? 0.16 : 0.2} />
        ))}
        <path d={geo.strata} fill="none" stroke={shade(SCENE.stone, 0.3)} strokeWidth={1 * ss} opacity={0.55} strokeLinecap="round" />
        <path d={geo.cracks} fill="none" stroke={SCENE.stoneDark} strokeWidth={1.1 * ss} opacity={0.7} strokeLinecap="round" strokeLinejoin="round" />
        {/* Gress og lyng langs toppen */}
        <rect x={x0 - 2} y={topp[1] - 4} width={x1 - x0 + 4} height={7} fill={SCENE.grass} />
        <rect x={x0 - 2} y={topp[1] + 3} width={x1 - x0 + 4} height={3} fill={SCENE.grassDark} opacity={0.7} />
      </g>
      {geo.ledges.map((l, i) => {
        // En hylle i berget (lys overkant, mørk skygge under) med en liten busk.
        const d = geo.dir;
        const x0 = l.x - (d * l.w) / 2;
        const x1 = l.x + (d * l.w) / 2;
        const r = l.w * 0.16;
        return (
          <g key={i}>
            <path
              d={`M${r1(x0)},${r1(l.y)}L${r1(x1 + d * 3)},${r1(l.y)}L${r1(x1)},${r1(l.y + 4)}L${r1(x0)},${r1(l.y + 5)}Z`}
              fill={shade(SCENE.stone, 0.35)}
              opacity={0.75}
            />
            <path d={`M${r1(x0)},${r1(l.y)}L${r1(x1 + d * 3)},${r1(l.y)}`} stroke={tint(SCENE.stone, 0.35)} strokeWidth={1.2 * ss} />
            <g stroke={SCENE.outline} strokeWidth={0.6 * ss}>
              <circle cx={l.x - d * r * 0.9} cy={l.y - r * 0.7} r={r} fill={SCENE.foliageDark} />
              <circle cx={l.x + d * r * 0.5} cy={l.y - r * 1.05} r={r * 1.15} fill={SCENE.foliage} />
              <circle cx={l.x + d * r * 1.6} cy={l.y - r * 0.6} r={r * 0.8} fill={SCENE.foliageDark} />
            </g>
            <circle cx={l.x + d * r * 0.2} cy={l.y - r * 1.5} r={r * 0.45} fill={tint(SCENE.foliage, 0.3)} opacity={0.7} />
          </g>
        );
      })}
      <path d={geo.edge} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
});

function edgeX(edge: Pt[], y: number): number {
  for (let i = 0; i < edge.length - 1; i++) {
    const [ax, ay] = edge[i]!;
    const [bx, by] = edge[i + 1]!;
    if (y >= ay && y <= by) return ax + ((bx - ax) * (y - ay)) / Math.max(1e-6, by - ay);
  }
  return edge[edge.length - 1]?.[0] ?? 0;
}

/* ---------------------------------------------------------------- Bru med hoppeplattform */

/**
 * Betongbru sett fra siden: brubjelke med kantdrager, rekkverk og en hoppeplattform i stål midt på, der strikken er
 * festet. `px` er piksler per meter (bjelken er `tykkelse` m høy, standard 4 m, og rekkverket 1,1 m), så brua kan
 * brukes både i oversikten og i nærbildet. Undersiden av bjelken er et smalt, mørkt bånd, så bjelken leses som et
 * dekk med luft under.
 *   <Bru x1={0} x2={500} y={66} px={4.5} plattformX={250} />
 * Ankerpunkt: y er toppen av brudekket (der hopperen står), og strikken er festet i (feste ?? plattformX, y).
 */
export function Bru({
  x1,
  x2,
  y,
  px,
  plattformX,
  feste,
  plattform = true,
  tykkelse = 4,
}: {
  x1: number;
  x2: number;
  y: number;
  px: number;
  plattformX: number;
  /** Der strikken er festet (x), standard midt på plattformen. */
  feste?: number;
  plattform?: boolean;
  /** Hvor høy brubjelken er (m). */
  tykkelse?: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('sh-bru');
  const T = Math.max(0.5, tykkelse) * px;
  const rail = 1.1 * px;
  const lip = Math.max(2, 0.45 * px);
  const step = Math.max(6, 2.2 * px);
  const w = x2 - x1;
  let posts = '';
  for (let x = x1 + step / 2; x < x2; x += step) posts += `M${r1(x)},${r1(y)}V${r1(y - rail)}`;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}b`} stops={materialStops(SCENE.concrete, 0.9)} />
      {/* Rekkverket bak */}
      <path d={posts} stroke={SCENE.metalDark} strokeWidth={Math.max(0.8, 0.09 * px) * ss} />
      <path d={`M${r1(x1)},${r1(y - rail)}H${r1(x2)}`} stroke={SCENE.metal} strokeWidth={Math.max(1.2, 0.14 * px) * ss} />
      <path d={`M${r1(x1)},${r1(y - rail * 0.5)}H${r1(x2)}`} stroke={SCENE.metalDark} strokeWidth={Math.max(0.6, 0.06 * px) * ss} opacity={0.8} />
      {/* Bjelken og kantdrageren */}
      <rect x={x1} y={y} width={w} height={T} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x1} y={y} width={w} height={lip} fill={tint(SCENE.concrete, 0.25)} />
      <rect x={x1} y={y + lip} width={w} height={Math.max(1, lip * 0.5)} fill={shade(SCENE.concrete, 0.3)} opacity={0.6} />
      <rect x={x1} y={y + T - Math.max(1.5, 0.3 * px)} width={w} height={Math.max(1.5, 0.3 * px)} fill={shade(SCENE.concrete, 0.35)} opacity={0.7} />
      {/* Undersiden: et smalt, mørkt bånd (vi ser litt opp under dekket) */}
      <rect x={x1} y={y + T} width={w} height={Math.max(1, 0.2 * px)} fill={shade(SCENE.concrete, 0.5)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {plattform && <Plattform x={plattformX} y={y} px={px} feste={feste} />}
    </g>
  );
}

/**
 * Hoppeplattformen: gulv av stålrist med gul kant og en rød portal over, og festet til strikken under gulvkanten.
 * Med `stagTil` tegnes to stag fra undersiden av gulvet ned til den y-en, der plattformen er festet i brua bak
 * (i nærbildet står brua lenger unna enn plattformen og er tegnet mindre).
 *   <Plattform x={300} y={200} px={90} feste={320} stagTil={260} />
 * Ankerpunkt: (x, y) er midt på gulvet, oppå; strikken er festet i (feste ?? x) like under gulvet.
 */
export function Plattform({ x, y, px, feste, stagTil }: { x: number; y: number; px: number; feste?: number; stagTil?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('sh-plattform');
  const pw = Math.max(14, 3.4 * px);
  const ph = Math.max(2.2, 0.35 * px);
  const portal = Math.max(8, 2.4 * px);
  const pole = Math.max(1.4, 0.16 * px);
  const under = y + ph * 0.6 + Math.max(1.2, ph * 0.6);
  const stag = stagTil !== undefined && stagTil > under + 2;
  const sw = Math.max(1.2, 0.12 * px);
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}p`} stops={materialStops(PAINTS.rod, 0.8)} />
      {stag && (
        <g stroke={SCENE.outline} strokeWidth={0.6 * ss} fill={SCENE.metalDark}>
          {[-0.32, 0.32].map((u) => {
            const xa = x + u * pw;
            const xb = x + u * pw * 0.55;
            return <path key={u} d={`M${r1(xa - sw / 2)},${r1(under)}L${r1(xa + sw / 2)},${r1(under)}L${r1(xb + sw / 2)},${r1(stagTil!)}L${r1(xb - sw / 2)},${r1(stagTil!)}Z`} />;
          })}
        </g>
      )}
      {/* Portalen */}
      <rect x={x - pw / 2} y={y - portal} width={pole} height={portal} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x + pw / 2 - pole} y={y - portal} width={pole} height={portal} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x - pw / 2} y={y - portal} width={pw} height={pole * 1.2} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {/* Gulvet med gul og svart kant */}
      <rect x={x - pw / 2 - 1} y={y - ph * 0.4} width={pw + 2} height={ph} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={x - pw / 2 - 1} y={y + ph * 0.6} width={pw + 2} height={Math.max(1.2, ph * 0.6)} fill={PAINTS.gul} stroke={SCENE.outline} strokeWidth={0.5 * ss} />
      {/* Festet til strikken */}
      <circle cx={feste ?? x} cy={y + ph * 0.6} r={Math.max(1.6, 0.1 * px)} fill="none" stroke={SCENE.metal} strokeWidth={Math.max(1, 0.04 * px) * ss} />
    </g>
  );
}

/* ---------------------------------------------------------------- Høydeskala */

/**
 * Loddrett skala for høyden over vannet, som en mållatt: streker for hver 10 m og tall for hver 20 m (til venstre
 * eller høyre).
 * Ankerpunkt: (x, yNull) er 0 m (vannflaten) og (x, yTopp) er `hoyde` m.
 */
export function Hoydeskala({
  x,
  yNull,
  yTopp,
  hoyde,
  side = 'venstre',
}: {
  x: number;
  yNull: number;
  yTopp: number;
  hoyde: number;
  /** Hvilken side tallene står på. */
  side?: 'venstre' | 'hoyre';
}) {
  const ss = useStrokeScale();
  const f = useTextScale();
  if (!(hoyde > 0)) return null;
  const pxm = (yNull - yTopp) / hoyde;
  const ticks: number[] = [];
  for (let h = 0; h <= hoyde + 1e-9; h += 10) ticks.push(h);
  const every = pxm * 20 < 34 * f ? 40 : 20;
  return (
    <g>
      <line x1={x} y1={yNull} x2={x} y2={yTopp} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
      <line x1={x} y1={yNull} x2={x} y2={yTopp} stroke={VIZ.ink} strokeWidth={1.3 * ss} />
      {ticks.map((h) => {
        const y = yNull - h * pxm;
        const major = h % every === 0;
        const d = side === 'venstre' ? -1 : 1;
        return (
          <g key={h}>
            <line x1={x + d * (major ? 7 : 4) * ss} y1={y} x2={x} y2={y} stroke={VIZ.ink} strokeWidth={1.3 * ss} />
            {major && (
              <Txt x={x + d * 10 * ss} y={y + 5 * f * 0.8} anchor={d < 0 ? 'end' : 'start'} size={0.78} weight={650}>
                {fmt(h, 0)} m
              </Txt>
            )}
          </g>
        );
      })}
    </g>
  );
}
