/**
 * Celler og organeller i SVG på lærebok-nivå: flate, avrundede former med samme strektykkelser, farget med BIO.
 *
 *   <Celle type="dyr" x={200} y={40} w={400} h={300}>
 *     <Cellekjerne x={390} y={190} />
 *     <Mitokondrie x={280} y={120} rotate={25} highlight />
 *   </Celle>
 *
 * Eller hele cella med organellene på faste plasser: <Cellemodell type="plante" x y w h highlight="kloroplast" />.
 * Plasseringene får du fra `organelleLayout(type, box)`, f.eks. for å sette etiketter med <Etikett>.
 *
 * Organellene tegnes rundt (x, y) og kan roteres (`rotate`, grader med klokka). Alle har `highlight` (glorie) og `dim`.
 * Størrelsene er i figurens enheter og vokser ikke på mobil; strekene blir litt tykkere der (useLineScale).
 */
import { type ReactNode } from 'react';
import { seededRandom, type Box } from '../../kjemi/kit/random';
import { BIO, type BioPaint } from './colors';
import { DIM_OPACITY, Halo, useLineScale, useSvgId, type MarkProps } from './felles';
import { smoothClosedPath, type Pt } from './kromosomer';

/* ---------- Geometri ---------- */

/** Avrundet rektangel som sti. */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr} V${y + h - rr} A${rr},${rr} 0 0 1 ${x + w - rr},${y + h} H${x + rr} A${rr},${rr} 0 0 1 ${x},${y + h - rr} V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y} Z`;
}

/** Kapselform (avlang med halvsirkler i endene), sentrert i (cx, cy). */
export function capsulePath(cx: number, cy: number, w: number, h: number): string {
  return roundedRectPath(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2);
}

/** Myk, litt ujevn form (dyrecelle, vakuole) rundt en ellipse. Alltid lik for samme frø. */
export function blobPath(cx: number, cy: number, rx: number, ry: number, wobble = 0.06, seed = 3, n = 10): string {
  const rnd = seededRandom(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const k = 1 + (rnd() * 2 - 1) * wobble;
    pts.push({ x: cx + rx * k * Math.cos(th), y: cy + ry * k * Math.sin(th) });
  }
  return smoothClosedPath(pts);
}

/** Bånd med avrundede ender langs en midtlinje (sekker i ER og golgiapparatet). */
export function bandPath(center: readonly Pt[], thickness: number): string {
  const n = center.length;
  if (n < 2) return '';
  const t = thickness / 2;
  const normal = (i: number) => {
    const a = center[Math.max(0, i - 1)]!;
    const b = center[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  };
  const top = center.map((p, i) => ({ x: p.x + normal(i).x * t, y: p.y + normal(i).y * t }));
  const bottom = center.map((p, i) => ({ x: p.x - normal(i).x * t, y: p.y - normal(i).y * t })).reverse();
  const f = (p: Pt) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  return `M${f(top[0]!)} ${top
    .slice(1)
    .map((p) => `L${f(p)}`)
    .join(' ')} A${t},${t} 0 0 1 ${f(bottom[0]!)} ${bottom
    .slice(1)
    .map((p) => `L${f(p)}`)
    .join(' ')} A${t},${t} 0 0 1 ${f(top[0]!)} Z`;
}

/* ---------- Felles innpakning ---------- */

export interface OrganelleProps extends MarkProps {
  /** Midtpunktet. */
  x: number;
  y: number;
  /** Rotasjon i grader (med klokka). */
  rotate?: number;
}

function Place({ x, y, rotate, dim, children }: { x: number; y: number; rotate?: number; dim?: boolean; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ''}`} opacity={dim ? DIM_OPACITY : undefined}>
      {children}
    </g>
  );
}

/* ---------- Organeller ---------- */

/** Cellekjerne med dobbel kjernemembran (med kjerneporer), kromatin og kjernelegeme. */
export function Cellekjerne({
  x,
  y,
  r = 46,
  ry,
  rotate,
  kjernelegeme = true,
  kromatin = true,
  highlight,
  dim,
}: OrganelleProps & { r?: number; ry?: number; kjernelegeme?: boolean; kromatin?: boolean }) {
  const lw = useLineScale();
  const RY = ry ?? r * 0.88;
  const c = BIO.kjerne;
  const outline = `M${-r},0 A${r},${RY} 0 1 0 ${r},0 A${r},${RY} 0 1 0 ${-r},0 Z`;
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} />}
      <ellipse rx={r} ry={RY} fill={c.fill} />
      {kromatin &&
        [-0.45, -0.05, 0.38].map((v, i) => (
          <path
            key={i}
            d={`M${-r * 0.62},${RY * v} q${r * 0.2},${-RY * 0.22} ${r * 0.4},0 t${r * 0.4},0 t${r * 0.36},${RY * 0.08}`}
            fill="none"
            stroke={BIO.dna}
            strokeOpacity={0.45}
            strokeWidth={1.2 * lw}
            strokeLinecap="round"
          />
        ))}
      {kjernelegeme && <circle cx={r * 0.24} cy={-RY * 0.1} r={r * 0.26} fill={BIO.kjernelegeme} />}
      {/* Dobbel membran med porer: like streklengder på begge ellipsene (pathLength), så porene står rett overfor hverandre */}
      <ellipse rx={r} ry={RY} fill="none" stroke={c.line} strokeWidth={2 * lw} pathLength={100} strokeDasharray="10.5 2" />
      <ellipse rx={r - 3.6} ry={RY - 3.6} fill="none" stroke={c.line} strokeWidth={1.1 * lw} pathLength={100} strokeDasharray="10.5 2" />
    </Place>
  );
}

/** Mitokondrie: glatt ytre membran og indre membran foldet i cristae. */
export function Mitokondrie({ x, y, w = 70, h = 32, rotate, highlight, dim }: OrganelleProps & { w?: number; h?: number }) {
  const lw = useLineScale();
  const c = BIO.mitokondrie;
  const outline = capsulePath(0, 0, w, h);
  const inset = 3.6;
  const iw = w - 2 * inset;
  const ih = h - 2 * inset;
  const folds = Math.max(3, Math.round(w / 14));
  const step = iw / (folds + 1);
  const depth = ih * 0.62;
  const cw = Math.min(5, step * 0.45);
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} />}
      <path d={outline} fill={c.fill} stroke={c.line} strokeWidth={2 * lw} />
      <path d={capsulePath(0, 0, iw, ih)} fill="none" stroke={c.line} strokeWidth={1.1 * lw} />
      {Array.from({ length: folds }, (_, i) => {
        const fx = -iw / 2 + step * (i + 1) - cw / 2;
        const fromTop = i % 2 === 0;
        const y0 = fromTop ? -ih / 2 : ih / 2;
        const dir = fromTop ? 1 : -1;
        return (
          <path
            key={i}
            d={`M${fx},${y0} v${dir * (depth - cw / 2)} a${cw / 2},${cw / 2} 0 0 ${fromTop ? 0 : 1} ${cw},0 v${-dir * (depth - cw / 2)}`}
            fill="none"
            stroke={c.line}
            strokeWidth={1.1 * lw}
            strokeLinejoin="round"
          />
        );
      })}
    </Place>
  );
}

/** Kloroplast: dobbel membran, grana (stabler av tylakoider) og lameller mellom dem. */
export function Kloroplast({
  x,
  y,
  w = 78,
  h = 36,
  grana = 3,
  rotate,
  highlight,
  dim,
}: OrganelleProps & { w?: number; h?: number; grana?: number }) {
  const lw = useLineScale();
  const c = BIO.kloroplast;
  const rx = w / 2;
  const ry = h / 2;
  const outline = `M${-rx},0 A${rx},${ry} 0 1 0 ${rx},0 A${rx},${ry} 0 1 0 ${-rx},0 Z`;
  const n = Math.max(1, grana);
  const span = w * 0.66;
  const tw = Math.min(12, (span / n) * 0.62);
  const th = Math.max(2.4, h * 0.085);
  const stack = Math.max(3, Math.round((h * 0.52) / (th + 1)));
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} />}
      <ellipse rx={rx} ry={ry} fill={c.fill} stroke={c.line} strokeWidth={2 * lw} />
      <ellipse rx={rx - 3.2} ry={ry - 3.2} fill="none" stroke={c.line} strokeWidth={1 * lw} />
      <line x1={-span / 2} y1={0} x2={span / 2} y2={0} stroke={c.line} strokeWidth={1 * lw} />
      {Array.from({ length: n }, (_, i) => {
        const gx = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
        const top = -((stack * (th + 1) - 1) / 2);
        return (
          <g key={i}>
            {Array.from({ length: stack }, (_, j) => (
              <rect
                key={j}
                x={gx - tw / 2}
                y={top + j * (th + 1)}
                width={tw}
                height={th}
                rx={th / 2}
                fill={BIO.klorofyll}
                stroke={c.line}
                strokeWidth={0.6 * lw}
              />
            ))}
          </g>
        );
      })}
    </Place>
  );
}

/** Endoplasmatisk nettverk: flate, bølgete sekker. Kornet ER har ribosomer på utsiden, glatt ER har det ikke. */
export function EndoplasmatiskNettverk({
  x,
  y,
  w = 110,
  h = 64,
  kornet = true,
  sekker = 3,
  bue = 0,
  rotate,
  highlight,
  dim,
}: OrganelleProps & {
  w?: number;
  h?: number;
  kornet?: boolean;
  sekker?: number;
  /**
   * Krumningsradius for sekkene (0 = rette, bølgete sekker). Med bue > 0 bøyer sekkene seg rundt et punkt `bue` til
   * venstre for midten (før rotasjon), slik kornet ER ligger rundt cellekjernen.
   */
  bue?: number;
}) {
  const lw = useLineScale();
  const c = BIO.er;
  const n = Math.max(1, sekker);
  const t = Math.min(9, (h / n) * 0.48);
  const bands = Array.from({ length: n }, (_, i) => {
    const y0 = n === 1 ? 0 : -h / 2 + t / 2 + ((h - t) * i) / (n - 1);
    const len = w * (1 - 0.12 * Math.abs(i - (n - 1) / 2));
    const amp = kornet ? t * 0.35 : t * 0.9;
    const pts: Pt[] =
      bue > 0
        ? Array.from({ length: 17 }, (_, j) => {
            // Bue rundt (−bue, 0): sekk i ligger i avstand bue + y0 fra sentrum
            const rho = bue + y0;
            const span = len / Math.max(1, rho);
            const a = -span / 2 + (span * j) / 16;
            const wob = amp * 0.35 * Math.sin((j / 16) * Math.PI * 3 + i);
            return { x: -bue + (rho + wob) * Math.cos(a), y: (rho + wob) * Math.sin(a) };
          })
        : Array.from({ length: 17 }, (_, j) => {
            const u = j / 16;
            return { x: -len / 2 + len * u, y: y0 + amp * Math.sin(u * Math.PI * (kornet ? 2 : 3) + i * 0.9) };
          });
    return { pts, d: bandPath(pts, t) };
  });
  const outline = roundedRectPath(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 14);
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} width={6} />}
      {bands.map((b, i) => (
        <path key={i} d={b.d} fill={c.fill} stroke={c.line} strokeWidth={1.3 * lw} strokeLinejoin="round" />
      ))}
      {kornet &&
        bands.map((b, i) =>
          b.pts.flatMap((p, j) => {
            if (j % 2 === 1 || j === 0 || j === b.pts.length - 1) return [];
            const q = b.pts[j + 1] ?? p;
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const l = Math.hypot(dx, dy) || 1;
            const off = t / 2 + 2.6;
            return [-1, 1].map((s) => (
              <circle key={`${i}-${j}-${s}`} cx={p.x - (dy / l) * off * s} cy={p.y + (dx / l) * off * s} r={1.8} fill={BIO.ribosom} />
            ));
          }),
        )}
    </Place>
  );
}

/** Golgiapparat: en stabel buede, flate sekker med vesikler som snøres av i endene. */
export function Golgiapparat({
  x,
  y,
  w = 76,
  h = 52,
  sekker = 4,
  rotate,
  highlight,
  dim,
}: OrganelleProps & { w?: number; h?: number; sekker?: number }) {
  const lw = useLineScale();
  const c = BIO.golgi;
  const n = Math.max(2, sekker);
  const t = Math.min(8, (h / n) * 0.55);
  const bow = h * 0.22;
  const sacs = Array.from({ length: n }, (_, i) => {
    const y0 = -h / 2 + bow + t / 2 + ((h - bow - t) * i) / (n - 1);
    const len = w * (0.62 + 0.38 * (i / (n - 1)));
    const pts: Pt[] = Array.from({ length: 13 }, (_, j) => {
      const u = j / 12;
      const xx = -len / 2 + len * u;
      return { x: xx, y: y0 - bow * (1 - (2 * u - 1) ** 2) };
    });
    return { d: bandPath(pts, t), len, y0 };
  });
  const outline = roundedRectPath(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 14);
  const last = sacs[n - 1]!;
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} width={6} />}
      {sacs.map((s, i) => (
        <path key={i} d={s.d} fill={c.fill} stroke={c.line} strokeWidth={1.3 * lw} strokeLinejoin="round" />
      ))}
      {[
        { x: -last.len / 2 - t * 0.9, y: last.y0 + t * 0.6 },
        { x: last.len / 2 + t * 0.9, y: last.y0 + t * 0.6 },
        { x: last.len * 0.18, y: last.y0 + t * 1.8 },
      ].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={t * 0.62} fill={c.fill} stroke={c.line} strokeWidth={1.1 * lw} />
      ))}
    </Place>
  );
}

/** Frie ribosomer: små prikker spredt i et område (alltid likt for samme frø). */
export function Ribosomer({
  x,
  y,
  w = 60,
  h = 40,
  n = 12,
  r = 1.9,
  seed = 5,
  highlight,
  dim,
}: OrganelleProps & { w?: number; h?: number; n?: number; r?: number; seed?: number }) {
  const rnd = seededRandom(seed);
  const pts = Array.from({ length: Math.max(0, n) }, () => {
    // Jevnt innenfor en ellipse
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(rnd());
    return { x: (w / 2) * s * Math.cos(a), y: (h / 2) * s * Math.sin(a) };
  });
  return (
    <Place x={x} y={y} dim={dim}>
      {highlight && pts.map((p, i) => <circle key={`h${i}`} cx={p.x} cy={p.y} r={r * 2.8} fill={BIO.ribosom} opacity={0.25} />)}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={r} fill={BIO.ribosom} />
      ))}
    </Place>
  );
}

/** Lysosom: liten blære med fordøyelsesenzymer. */
export function Lysosom({ x, y, r = 13, highlight, dim }: OrganelleProps & { r?: number }) {
  const lw = useLineScale();
  const c = BIO.lysosom;
  const outline = `M${-r},0 A${r},${r} 0 1 0 ${r},0 A${r},${r} 0 1 0 ${-r},0 Z`;
  return (
    <Place x={x} y={y} dim={dim}>
      {highlight && <Halo d={outline} color={c.line} />}
      <circle r={r} fill={c.fill} stroke={c.line} strokeWidth={1.6 * lw} />
      {[
        [-0.35, -0.25],
        [0.3, -0.3],
        [0.05, 0.1],
        [-0.3, 0.35],
        [0.38, 0.3],
      ].map(([u, v], i) => (
        <circle key={i} cx={u! * r} cy={v! * r} r={Math.max(1.2, r * 0.12)} fill={c.line} />
      ))}
    </Place>
  );
}

/** Vakuole (blære med cellesaft), med tonoplasten som kant. Stor og sentral i planteceller. */
export function Vakuole({
  x,
  y,
  w = 60,
  h = 44,
  seed = 7,
  rotate,
  highlight,
  dim,
}: OrganelleProps & { w?: number; h?: number; seed?: number }) {
  const lw = useLineScale();
  const c = BIO.vakuole;
  const d = blobPath(0, 0, w / 2, h / 2, 0.05, seed, 9);
  return (
    <Place x={x} y={y} rotate={rotate} dim={dim}>
      {highlight && <Halo d={d} color={c.line} />}
      <path d={d} fill={c.fill} stroke={c.line} strokeWidth={1.6 * lw} />
    </Place>
  );
}

/** Vesikkel (transportblære). Standardfarge som golgiapparatet. */
export function Vesikkel({ x, y, r = 6, paint = BIO.golgi, highlight, dim }: OrganelleProps & { r?: number; paint?: BioPaint }) {
  const lw = useLineScale();
  const outline = `M${-r},0 A${r},${r} 0 1 0 ${r},0 A${r},${r} 0 1 0 ${-r},0 Z`;
  return (
    <Place x={x} y={y} dim={dim}>
      {highlight && <Halo d={outline} color={paint.line} width={8} />}
      <circle r={r} fill={paint.fill} stroke={paint.line} strokeWidth={1.2 * lw} />
    </Place>
  );
}

/** Cytoskjelett: tynne proteintråder på kryss og tvers i et område. */
export function Cytoskjelett({
  x,
  y,
  w = 200,
  h = 140,
  n = 7,
  seed = 11,
  highlight,
  dim,
}: OrganelleProps & { w?: number; h?: number; n?: number; seed?: number }) {
  const lw = useLineScale();
  const rnd = seededRandom(seed);
  const lines = Array.from({ length: n }, () => {
    const a = { x: (rnd() - 0.5) * w, y: (rnd() - 0.5) * h };
    const b = { x: (rnd() - 0.5) * w, y: (rnd() - 0.5) * h };
    const m = { x: (a.x + b.x) / 2 + (rnd() - 0.5) * w * 0.25, y: (a.y + b.y) / 2 + (rnd() - 0.5) * h * 0.25 };
    return `M${a.x},${a.y} Q${m.x},${m.y} ${b.x},${b.y}`;
  });
  return (
    <Place x={x} y={y} dim={dim}>
      {lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={BIO.cytoskjelett} strokeWidth={(highlight ? 2.4 : 1.2) * lw} strokeLinecap="round" />
      ))}
    </Place>
  );
}

/* ---------- Hele celler ---------- */

export type Celletype = 'dyr' | 'plante' | 'bakterie';

/** Deler av selve cella som kan fremheves i <Celle>. */
export type CelleDel =
  | 'cellemembran'
  | 'cytoplasma'
  | 'cellevegg'
  | 'vakuole'
  | 'kapsel'
  | 'flagell'
  | 'nukleoid'
  | 'plasmid'
  | 'ribosomer';

export interface CelleProps {
  type: Celletype;
  /** Ytre ramme (med cellevegg og kapsel). */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Bare plantecelle: hvor stor protoplasten (cellemembran med innhold) er i forhold til plassen innenfor celleveggen.
   * 1 = presset mot veggen (turgor), under 1 = plasmolyse (membranen slipper veggen). Standard 1.
   */
  protoplast?: number;
  /** Fyllet mellom celleveggen og membranen ved plasmolyse (løsningen utenfor). Standard BIO.vannFyll. */
  ytre?: string;
  /** Plantecelle: den store sentrale vakuolen (standard true). Størrelse som andel av protoplasten (standard 0,62). */
  vakuole?: boolean | number;
  /** Bakteriecelle: kapsel (standard true), antall flageller (standard 1) og innhold (nukleoid, plasmider, ribosomer). */
  kapsel?: boolean;
  flageller?: number;
  innhold?: boolean;
  /** Dyrecelle: frø for den myke formen. */
  seed?: number;
  /** Fremhev en del av cella. */
  highlight?: CelleDel | null;
  /** Ton ned hele cella. */
  dim?: boolean;
  /** Organeller og annet innhold (klippes til innsiden av cellemembranen). */
  children?: ReactNode;
}

/** Plassen innenfor cellemembranen (for å legge organeller og partikler). */
export function cellInterior(type: Celletype, box: Box, protoplast = 1): Box {
  if (type === 'plante') {
    const tw = wallThickness(box);
    const s = Math.min(1, Math.max(0.3, protoplast));
    const iw = (box.w - 2 * tw - 2) * s;
    const ih = (box.h - 2 * tw - 2) * s;
    return { x: box.x + (box.w - iw) / 2, y: box.y + (box.h - ih) / 2, w: iw, h: ih };
  }
  if (type === 'bakterie') {
    const g = bacteriumGeom(box);
    return { x: g.cx - g.w / 2 + 6, y: g.cy - g.h / 2 + 6, w: g.w - 12, h: g.h - 12 };
  }
  return { x: box.x + box.w * 0.06, y: box.y + box.h * 0.06, w: box.w * 0.88, h: box.h * 0.88 };
}

const wallThickness = (b: Box) => Math.min(11, Math.max(5, Math.min(b.w, b.h) * 0.035));

function bacteriumGeom(b: Box) {
  // Plass til kapselen rundt og flagellen til høyre
  const cap = Math.min(10, b.h * 0.08);
  const h = b.h - 2 * cap;
  const w = Math.min(b.w * 0.72, Math.max(h * 1.4, b.w - 2 * cap - b.w * 0.26));
  return { cx: b.x + cap + w / 2, cy: b.y + b.h / 2, w, h, cap };
}

/**
 * Omrisset av en celle med cytoplasma og cellemembran (dobbel strek), og for planteceller cellevegg og stor vakuole,
 * for bakterieceller cellevegg, kapsel, flageller, nukleoid, plasmider og ribosomer.
 */
export function Celle(props: CelleProps) {
  if (props.type === 'plante') return <Plantecelle {...props} />;
  if (props.type === 'bakterie') return <Bakteriecelle {...props} />;
  return <Dyrecelle {...props} />;
}

/** Cellemembranen som dobbel strek (antyder lipiddobbeltlaget). Egen komponent så den kan brukes på egne former. */
export function Cellemembran({ d, highlight, dim, inner = BIO.cytoplasma }: MarkProps & { d: string; inner?: string }) {
  const lw = useLineScale();
  return (
    <g opacity={dim ? DIM_OPACITY : undefined}>
      {highlight && <Halo d={d} color={BIO.membran} width={12} />}
      <path d={d} fill="none" stroke={BIO.membran} strokeWidth={4.6 * lw} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={inner} strokeWidth={1.5 * lw} strokeLinejoin="round" />
    </g>
  );
}

function Dyrecelle({ x, y, w, h, seed = 4, highlight, dim, children }: CelleProps) {
  const id = useSvgId('bio-celle');
  const d = blobPath(x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 4, 0.045, seed, 11);
  return (
    <g opacity={dim ? DIM_OPACITY : undefined}>
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      {highlight === 'cytoplasma' && <Halo d={d} color={BIO.membran} width={16} />}
      <path d={d} fill={BIO.cytoplasma} />
      <g clipPath={`url(#${id})`}>{children}</g>
      <Cellemembran d={d} highlight={highlight === 'cellemembran'} />
    </g>
  );
}

function Plantecelle({ x, y, w, h, protoplast = 1, ytre = BIO.vannFyll, vakuole = true, highlight, dim, children }: CelleProps) {
  const lw = useLineScale();
  const id = useSvgId('bio-plante');
  const tw = wallThickness({ x, y, w, h });
  const outer = roundedRectPath(x, y, w, h, 16);
  const innerWall = roundedRectPath(x + tw, y + tw, w - 2 * tw, h - 2 * tw, Math.max(4, 16 - tw));
  const s = Math.min(1, Math.max(0.3, protoplast));
  const box = cellInterior('plante', { x, y, w, h }, s);
  // Ved plasmolyse blir protoplasten rundere
  const radius = 10 + (1 - s) * Math.min(box.w, box.h) * 0.9;
  const proto = s >= 0.999 ? roundedRectPath(box.x, box.y, box.w, box.h, 10) : roundedRectPath(box.x, box.y, box.w, box.h, radius);
  const vFrac = typeof vakuole === 'number' ? vakuole : 0.62;
  const vw = box.w * vFrac;
  const vh = box.h * vFrac;
  const vac = roundedRectPath(box.x + (box.w - vw) / 2, box.y + (box.h - vh) / 2 + box.h * 0.03, vw, vh, Math.min(vw, vh) * 0.3);
  const c = BIO.cellevegg;
  return (
    <g opacity={dim ? DIM_OPACITY : undefined}>
      <clipPath id={id}>
        <path d={proto} />
      </clipPath>
      {highlight === 'cellevegg' && <Halo d={outer} color={c.line} width={14} />}
      {/* Celleveggen som en ramme mellom ytre og indre kant */}
      <path d={`${outer} ${innerWall}`} fill={c.fill} fillRule="evenodd" />
      <path d={outer} fill="none" stroke={c.line} strokeWidth={2 * lw} />
      <path d={innerWall} fill={s < 0.999 ? ytre : 'none'} stroke={c.line} strokeWidth={1 * lw} />
      {highlight === 'cytoplasma' && <Halo d={proto} color={BIO.membran} width={16} />}
      <path d={proto} fill={BIO.cytoplasma} />
      <g clipPath={`url(#${id})`}>
        {vakuole !== false && (
          <g>
            {highlight === 'vakuole' && <Halo d={vac} color={BIO.vakuole.line} />}
            <path d={vac} fill={BIO.vakuole.fill} stroke={BIO.vakuole.line} strokeWidth={1.6 * lw} />
          </g>
        )}
        {children}
      </g>
      <Cellemembran d={proto} highlight={highlight === 'cellemembran'} />
    </g>
  );
}

function Bakteriecelle({ x, y, w, h, kapsel = true, flageller = 1, innhold = true, highlight, dim, children }: CelleProps) {
  const lw = useLineScale();
  const id = useSvgId('bio-bakt');
  const g = bacteriumGeom({ x, y, w, h });
  const c = BIO.bakterie;
  const caps = capsulePath(g.cx, g.cy, g.w + 2 * g.cap, g.h + 2 * g.cap);
  const wall = capsulePath(g.cx, g.cy, g.w, g.h);
  const mem = capsulePath(g.cx, g.cy, g.w - 9, g.h - 9);
  const right = g.cx + g.w / 2;
  const flag = Array.from({ length: Math.max(0, flageller) }, (_, i) => {
    const y0 = g.cy + (i - (flageller - 1) / 2) * g.h * 0.28;
    const len = Math.max(30, x + w - right - 4);
    const amp = Math.min(9, g.h * 0.12);
    const pts: string[] = [];
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      pts.push(`${(right + len * u).toFixed(1)},${(y0 + amp * Math.sin(u * Math.PI * 3.5) * Math.min(1, u * 4)).toFixed(1)}`);
    }
    return `M${pts.join(' L')}`;
  });
  const nucleoid = blobPath(g.cx - g.w * 0.06, g.cy, g.w * 0.2, g.h * 0.22, 0.25, 21, 12);
  const rnd = seededRandom(31);
  const ribos = Array.from({ length: Math.round(g.w / 9) }, () => ({
    x: g.cx + (rnd() - 0.5) * (g.w - g.h * 0.7),
    y: g.cy + (rnd() - 0.5) * (g.h - 22),
  }));
  return (
    <g opacity={dim ? DIM_OPACITY : undefined}>
      <clipPath id={id}>
        <path d={mem} />
      </clipPath>
      {flag.map((d, i) => (
        <g key={i}>
          {highlight === 'flagell' && <Halo d={d} color={c.line} width={8} />}
          <path d={d} fill="none" stroke={c.line} strokeWidth={1.8 * lw} strokeLinecap="round" />
        </g>
      ))}
      {kapsel && (
        <g>
          {highlight === 'kapsel' && <Halo d={caps} color={c.line} width={12} />}
          <path d={caps} fill={BIO.kapsel} stroke={c.line} strokeOpacity={0.5} strokeWidth={1 * lw} strokeDasharray="5 4" />
        </g>
      )}
      {highlight === 'cellevegg' && <Halo d={wall} color={c.line} width={12} />}
      <path d={wall} fill={c.fill} stroke={c.line} strokeWidth={2.2 * lw} />
      <path d={mem} fill={BIO.cytoplasma} />
      <g clipPath={`url(#${id})`}>
        {innhold && (
          <g>
            {ribos.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={highlight === 'ribosomer' ? 2.8 : 1.9} fill={BIO.ribosom} />
            ))}
            {highlight === 'nukleoid' && <Halo d={nucleoid} color={BIO.dna} width={10} />}
            <path d={nucleoid} fill="none" stroke={BIO.dna} strokeWidth={1.7 * lw} />
            <path
              d={blobPath(g.cx - g.w * 0.04, g.cy + 2, g.w * 0.13, g.h * 0.13, 0.3, 22, 9)}
              fill="none"
              stroke={BIO.dna}
              strokeWidth={1.4 * lw}
              strokeOpacity={0.8}
            />
            {[
              { x: g.cx + g.w * 0.27, y: g.cy - g.h * 0.18 },
              { x: g.cx + g.w * 0.22, y: g.cy + g.h * 0.2 },
            ].map((p, i) => (
              <g key={i}>
                {highlight === 'plasmid' && <circle cx={p.x} cy={p.y} r={g.h * 0.08 + 6} fill={BIO.dna} opacity={0.2} />}
                <circle cx={p.x} cy={p.y} r={Math.max(4, g.h * 0.07)} fill="none" stroke={BIO.dna} strokeWidth={1.5 * lw} />
              </g>
            ))}
          </g>
        )}
        {children}
      </g>
      <Cellemembran d={mem} highlight={highlight === 'cellemembran'} />
    </g>
  );
}

/* ---------- Ferdig cellemodell ---------- */

/** Organeller og deler som kan pekes på og fremheves i en cellemodell. */
export type OrganelleId =
  | 'cellekjerne'
  | 'kjernelegeme'
  | 'mitokondrie'
  | 'kloroplast'
  | 'kornetER'
  | 'glattER'
  | 'golgi'
  | 'ribosomer'
  | 'lysosom'
  | 'vakuole'
  | 'cellemembran'
  | 'cellevegg'
  | 'cytoplasma'
  | 'kapsel'
  | 'flagell'
  | 'nukleoid'
  | 'plasmid';

/**
 * Navn og kort funksjon for hver del, slik læreboka beskriver dem. `kort` er et kortere navn til etiketter der det er
 * trangt (mobil), f.eks. «Kornet ER».
 */
export const ORGANELLER: Record<OrganelleId, { navn: string; kort: string; funksjon: string }> = {
  cellekjerne: { navn: 'Cellekjerne', kort: 'Cellekjerne', funksjon: 'Inneholder DNA (arvestoffet) og styrer cellens aktivitet.' },
  kjernelegeme: { navn: 'Kjernelegeme', kort: 'Kjernelegeme', funksjon: 'Her lages ribosomene.' },
  mitokondrie: { navn: 'Mitokondrie', kort: 'Mitokondrie', funksjon: 'Celleånding: frigjør energi fra glukose og lagrer den i ATP.' },
  kloroplast: {
    navn: 'Kloroplast',
    kort: 'Kloroplast',
    funksjon: 'Fotosyntese: bruker lysenergi til å lage glukose av karbondioksid og vann.',
  },
  kornetER: {
    navn: 'Kornet endoplasmatisk nettverk',
    kort: 'Kornet ER',
    funksjon: 'Har ribosomer på utsiden og lager proteiner som skal ut av cellen eller inn i membraner.',
  },
  glattER: { navn: 'Glatt endoplasmatisk nettverk', kort: 'Glatt ER', funksjon: 'Lager lipider og bryter ned giftstoffer.' },
  golgi: { navn: 'Golgiapparat', kort: 'Golgiapparat', funksjon: 'Bearbeider, sorterer og pakker proteiner i vesikler.' },
  ribosomer: { navn: 'Ribosomer', kort: 'Ribosomer', funksjon: 'Lager proteiner etter oppskriften i mRNA.' },
  lysosom: { navn: 'Lysosom', kort: 'Lysosom', funksjon: 'Inneholder enzymer som bryter ned avfall, utslitte celledeler og bakterier.' },
  vakuole: { navn: 'Vakuole', kort: 'Vakuole', funksjon: 'Lagrer vann og oppløste stoffer. Den store vakuolen gir plantecellen turgor.' },
  cellemembran: { navn: 'Cellemembran', kort: 'Cellemembran', funksjon: 'Avgrenser cellen og regulerer hva som går inn og ut.' },
  cellevegg: {
    navn: 'Cellevegg',
    kort: 'Cellevegg',
    funksjon: 'Gir form og støtte. Av cellulose hos planter, av peptidoglykan hos bakterier.',
  },
  cytoplasma: { navn: 'Cytoplasma', kort: 'Cytoplasma', funksjon: 'Væsken inne i cellen, der mange av cellens kjemiske reaksjoner skjer.' },
  kapsel: { navn: 'Kapsel', kort: 'Kapsel', funksjon: 'Slimlag utenpå celleveggen som beskytter bakterien.' },
  flagell: { navn: 'Flagell', kort: 'Flagell', funksjon: 'Svepe som bakterien svømmer med.' },
  nukleoid: { navn: 'Arvestoff (nukleoid)', kort: 'Arvestoff', funksjon: 'Ett ringformet kromosom som ligger fritt i cytoplasmaet.' },
  plasmid: { navn: 'Plasmid', kort: 'Plasmid', funksjon: 'Små DNA-ringer, for eksempel med gener for antibiotikaresistens.' },
};

/** Hvilke deler som finnes i hver celletype (i rekkefølgen de bør listes). */
export const CELL_PARTS: Record<Celletype, OrganelleId[]> = {
  dyr: ['cellemembran', 'cytoplasma', 'cellekjerne', 'kjernelegeme', 'mitokondrie', 'kornetER', 'glattER', 'golgi', 'ribosomer', 'lysosom'],
  plante: [
    'cellevegg',
    'cellemembran',
    'cytoplasma',
    'vakuole',
    'cellekjerne',
    'kloroplast',
    'mitokondrie',
    'kornetER',
    'golgi',
    'ribosomer',
  ],
  bakterie: ['kapsel', 'cellevegg', 'cellemembran', 'cytoplasma', 'nukleoid', 'plasmid', 'ribosomer', 'flagell'],
};

export interface PlacedOrganelle {
  id: OrganelleId;
  /** Kornet ER som bøyer seg rundt kjernen: krumningsradius (se EndoplasmatiskNettverk). */
  bue?: number;
  /** Midtpunkt (organellen) eller et punkt på delen (membran, vegg) som en etikett kan peke på. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
}

/**
 * Faste plasser for organellene i en cellemodell i boksen. Første forekomst av hver id er punktet en etikett bør
 * peke på. Ren funksjon, så du kan plassere etiketter uten å tegne cella først.
 */
export function organelleLayout(type: Celletype, box: Box): PlacedOrganelle[] {
  const { x, y, w, h } = box;
  const S = Math.min(w, h * 1.35);
  const at = (id: OrganelleId, u: number, v: number, ow: number, oh: number, rotate = 0): PlacedOrganelle => ({
    id,
    x: x + u * w,
    y: y + v * h,
    w: ow,
    h: oh,
    rotate,
  });
  if (type === 'dyr') {
    const r = S * 0.14;
    return [
      at('cellemembran', 0.5, 0.02, 0, 0),
      at('cytoplasma', 0.36, 0.84, 0, 0),
      at('cellekjerne', 0.45, 0.5, 2 * r, 1.76 * r),
      at('kjernelegeme', 0.45 + (r * 0.24) / w, 0.5 - (r * 0.88 * 0.1) / h, r * 0.52, r * 0.52),
      // Kornet ER i buer rundt kjernen: bue = avstanden fra midten av ER-et til midten av kjernen
      { id: 'kornetER', x: x + 0.45 * w + r * 1.42, y: y + 0.5 * h, w: S * 0.26, h: S * 0.11, rotate: 0, bue: r * 1.42 },
      at('glattER', 0.3, 0.19, S * 0.17, S * 0.08, 12),
      at('golgi', 0.7, 0.73, S * 0.16, S * 0.11, -18),
      at('mitokondrie', 0.17, 0.42, S * 0.15, S * 0.068, 70),
      at('mitokondrie', 0.3, 0.8, S * 0.15, S * 0.068, -12),
      at('mitokondrie', 0.72, 0.17, S * 0.14, S * 0.065, 14),
      at('mitokondrie', 0.86, 0.5, S * 0.14, S * 0.065, 82),
      at('lysosom', 0.55, 0.84, S * 0.06, S * 0.06),
      at('lysosom', 0.18, 0.64, S * 0.05, S * 0.05),
      at('ribosomer', 0.5, 0.2, S * 0.18, S * 0.08),
      at('ribosomer', 0.83, 0.75, S * 0.1, S * 0.12),
    ];
  }
  if (type === 'plante') {
    const tw = wallThickness(box);
    const band = (Math.min(w, h) - 2 * tw) * 0.19;
    const r = Math.min(S * 0.09, band * 0.95);
    const ch = Math.min(S * 0.07, band * 0.62);
    const cw = ch * 2.1;
    const yTop = (tw + band * 0.55) / h;
    const yBot = 1 - (tw + band * 0.5) / h;
    const xL = (tw + band * 0.5) / w;
    const xR = 1 - (tw + band * 0.5) / w;
    return [
      at('cellevegg', 0.5, tw / 2 / h, 0, 0),
      at('cellemembran', 0.5, (tw + 2) / h, 0, 0),
      at('cytoplasma', 0.62, yBot, 0, 0),
      at('vakuole', 0.5, 0.53, w * 0.5, h * 0.5),
      at('cellekjerne', (tw + band * 0.62 + r) / w, yTop + 0.02, 2 * r, 1.76 * r),
      at('kjernelegeme', (tw + band * 0.62 + r + r * 0.24) / w, yTop + 0.02 - (r * 0.09) / h, r * 0.5, r * 0.5),
      at('kloroplast', 0.6, yTop, cw, ch),
      at('kloroplast', xR, 0.36, cw, ch, 90),
      at('kloroplast', xR, 0.72, cw, ch, 84),
      at('kloroplast', 0.36, yBot, cw, ch, 4),
      at('kloroplast', xL, 0.62, cw, ch, 94),
      at('mitokondrie', 0.82, yBot, cw * 0.8, ch * 0.8, -6),
      at('mitokondrie', xL, 0.36, cw * 0.8, ch * 0.8, 86),
      at('golgi', 0.8, yTop, cw * 0.8, ch * 1.05, 0),
      at('kornetER', 0.42, yTop, cw * 0.95, ch * 1.05, 0),
      at('ribosomer', 0.17, yBot, cw * 0.9, ch * 0.7),
    ];
  }
  const g = bacteriumGeom(box);
  return [
    at('kapsel', (g.cx - x - g.w * 0.25) / w, (g.cy - g.h / 2 - g.cap / 2 - y) / h, 0, 0),
    at('cellevegg', (g.cx - x + g.w * 0.05) / w, (g.cy - g.h / 2 + 1 - y) / h, 0, 0),
    at('cellemembran', (g.cx - x - g.w * 0.08) / w, (g.cy + g.h / 2 - 5 - y) / h, 0, 0),
    at('cytoplasma', (g.cx - x - g.w * 0.33) / w, (g.cy - y) / h, 0, 0),
    at('nukleoid', (g.cx - x - g.w * 0.06 - g.w * 0.2) / w, (g.cy - y) / h, g.w * 0.4, g.h * 0.44),
    at('plasmid', (g.cx - x + g.w * 0.27) / w, (g.cy - g.h * 0.18 - y) / h, g.h * 0.14, g.h * 0.14),
    at('ribosomer', (g.cx - x + g.w * 0.08) / w, (g.cy + g.h * 0.28 - y) / h, 0, 0),
    at('flagell', (g.cx + g.w / 2 + Math.max(30, x + w - (g.cx + g.w / 2)) * 0.55 - x) / w, (g.cy - y) / h, 0, 0),
  ];
}

/**
 * Ferdig celle med organellene på faste plasser (se `organelleLayout`). Fremhev én del med `highlight`; med
 * `dimOthers` tones resten ned.
 */
export function Cellemodell({
  type,
  x,
  y,
  w,
  h,
  highlight = null,
  dimOthers = false,
}: {
  type: Celletype;
  x: number;
  y: number;
  w: number;
  h: number;
  highlight?: OrganelleId | null;
  dimOthers?: boolean;
}) {
  const parts = organelleLayout(type, { x, y, w, h });
  const on = (id: OrganelleId) => highlight === id;
  const dim = (id: OrganelleId) =>
    dimOthers && highlight !== null && highlight !== id && !(highlight === 'kjernelegeme' && id === 'cellekjerne');
  // Deler som tegnes av selve <Celle> (ikke egne organellkomponenter)
  const own: Record<Celletype, CelleDel[]> = {
    dyr: ['cellemembran', 'cytoplasma'],
    plante: ['cellemembran', 'cytoplasma', 'cellevegg', 'vakuole'],
    bakterie: ['cellemembran', 'cytoplasma', 'cellevegg', 'kapsel', 'flagell', 'nukleoid', 'plasmid', 'ribosomer'],
  };
  const cellPart = highlight && (own[type] as string[]).includes(highlight) ? (highlight as CelleDel) : null;
  const drawn = parts.map((p, i) => {
    const k = `${p.id}-${i}`;
    const common = { x: p.x, y: p.y, rotate: p.rotate, highlight: on(p.id), dim: dim(p.id) };
    switch (p.id) {
      case 'cellekjerne':
        return <Cellekjerne key={k} {...common} r={p.w / 2} ry={p.h / 2} rotate={0} />;
      case 'kjernelegeme':
        return on('kjernelegeme') ? (
          <circle key={k} cx={p.x} cy={p.y} r={p.w / 2 + 4} fill="none" stroke={BIO.kjerne.line} strokeOpacity={0.5} strokeWidth={4} />
        ) : null;
      case 'mitokondrie':
        return <Mitokondrie key={k} {...common} w={p.w} h={p.h} />;
      case 'kloroplast':
        return <Kloroplast key={k} {...common} w={p.w} h={p.h} grana={p.w > 60 ? 3 : 2} />;
      case 'kornetER':
        return <EndoplasmatiskNettverk key={k} {...common} w={p.w} h={p.h} kornet bue={p.bue} />;
      case 'glattER':
        return <EndoplasmatiskNettverk key={k} {...common} w={p.w} h={p.h} kornet={false} sekker={2} />;
      case 'golgi':
        return <Golgiapparat key={k} {...common} w={p.w} h={p.h} />;
      case 'lysosom':
        return <Lysosom key={k} {...common} r={p.w / 2} />;
      case 'ribosomer':
        return type === 'bakterie' ? null : (
          <Ribosomer key={k} {...common} w={p.w} h={p.h} n={Math.round((p.w * p.h) / 120) + 6} seed={i + 3} />
        );
      default:
        return null;
    }
  });
  return (
    <Celle
      type={type}
      x={x}
      y={y}
      w={w}
      h={h}
      highlight={cellPart}
      innhold={type === 'bakterie'}
      dim={false}
      vakuole={type === 'plante' ? 0.6 : undefined}
    >
      {drawn}
    </Celle>
  );
}
