/**
 * SVG-byggeklosser for molekyler og atomer i 2D: atomkuler, bindinger (enkelt, dobbelt, trippel, kile, stiplet),
 * frie elektronpar, dipolpil, Bohr-modell med elektronskall og VSEPR-former.
 *
 * Alle størrelser vokser på mobil med `useAtomScale()` (samme faktor som teksten), så figurene kan leses på telefon.
 * Bruk samme faktor på avstandene du velger selv: `const k = useAtomScale(); const bond = 90 * k;`.
 * Vinkler er i grader mot klokka med y opp (se geometri.ts).
 */
import type { ReactNode } from 'react';
import { Arrow, VIZ, fmt, useTextScale } from '../../kit';
import { KJEMI, atomColors } from './colors';
import { atomRadius, polar, trimSegment, vsepr, type Geometry, type Pt, type Stereo } from './geometri';
import { chargeText, getElement } from './grunnstoffer';
import { Txt } from './txt';

/** Hvor mye atomer, bindinger og elektroner forstørres (1 på PC, ca. 1,5 på mobil). Bare inne i en <Figure>. */
export function useAtomScale(): number {
  return Math.max(1, useTextScale() * 0.85);
}

/** Et atom (eller bare et punkt) som bindinger og elektronpar kan festes til. */
export interface AtomLike {
  x: number;
  y: number;
  /** Grunnstoffsymbol; gir radiusen hvis `r` mangler. */
  el?: string;
  /** Radius i figurens enheter (overstyrer størrelsen fra grunnstoffet). */
  r?: number;
  /** Ladning: ioner tegnes med ioneradius når den er kjent. */
  charge?: number;
}

function radiusOf(a: AtomLike, k: number): number {
  return a.r ?? (a.el ? atomRadius(a.el, { charge: a.charge, scale: k }) : 0);
}

/** Radiusen et atom får med gjeldende skalering (samme som <Atom> tegner). */
export function useAtomRadius(a: AtomLike): number {
  return radiusOf(a, useAtomScale());
}

export interface AtomProps extends AtomLike {
  el: string;
  /** Tekst i kula (standard: symbolet). */
  label?: ReactNode;
  /** Vis ladningen (standard når `charge` er satt). */
  showCharge?: boolean;
  /** Delladning δ+ eller δ− ved atomet. */
  partial?: 'plus' | 'minus' | null;
  /** Retning (grader) fra sentrum til δ-etiketten (standard 90 = over). */
  partialAngle?: number;
  /** Tonet ned (f.eks. atomer som ikke er i fokus). */
  dim?: boolean;
  /** Ekstra ring rundt atomet i denne fargen (markering). */
  ring?: string;
}

/**
 * Atomkule med symbol, farget etter grunnstoffet (KJEMI.atom). Størrelsen følger den kovalente radiusen
 * (ioneradiusen for ioner), og vokser på mobil.
 *
 *   <Atom x={400} y={200} el="O" partial="minus" />
 *   <Atom x={300} y={200} el="Na" charge={1} />
 */
export function Atom({ x, y, el, r, charge, label, showCharge, partial, partialAngle = 90, dim, ring }: AtomProps) {
  const k = useAtomScale();
  const f = useTextScale();
  const R = radiusOf({ x, y, el, r, charge }, k);
  const c = atomColors(el);
  const text = label ?? el;
  // Lange symboler (Cl) og egne etiketter (Mg med hevet ladning) får mindre skrift, så de holder seg inne i kula.
  const long = typeof text !== 'string' || text.length > 1;
  const fs = R * (long ? 0.8 : 0.95);
  const q = charge ?? 0;
  const p = partial ? polar(x, y, R + 9 + 9 * f, partialAngle) : null;
  return (
    <g opacity={dim ? 0.35 : undefined}>
      {ring && <circle cx={x} cy={y} r={R + 4 * k} fill="none" stroke={ring} strokeWidth={2.5 * k} />}
      <circle cx={x} cy={y} r={R} fill={c.fill} stroke={c.line} className="kj-atom" />
      <ellipse cx={x - R * 0.36} cy={y - R * 0.42} rx={R * 0.32} ry={R * 0.2} fill={KJEMI.glassShine} transform={`rotate(-30 ${x - R * 0.36} ${y - R * 0.42})`} />
      <text x={x} y={y + fs * 0.36} className="kj-atom-symbol" style={{ fill: c.ink, fontSize: fs }}>
        {text}
      </text>
      {q !== 0 && showCharge !== false && (
        <Txt x={x + R * 0.74 + 2} y={y - R * 0.72} anchor="start" color={q > 0 ? KJEMI.plus : KJEMI.minus} weight={700}>
          {chargeText(q)}
        </Txt>
      )}
      {p && (
        <Txt x={p.x} y={p.y + 6 * f} color={partial === 'plus' ? KJEMI.plus : KJEMI.minus} weight={700}>
          δ{partial === 'plus' ? '+' : '−'}
        </Txt>
      )}
    </g>
  );
}

export interface BondProps {
  a: AtomLike;
  b: AtomLike;
  /** 1 = enkelt, 2 = dobbelt, 3 = trippel. */
  order?: 1 | 2 | 3;
  /** Kile (mot deg, bred ende ved b) eller stiplet kile (bort fra deg). Bare for enkeltbindinger. */
  stereo?: Stereo;
  /** Stiplet strek for hydrogenbindinger og andre svake bindinger (standardfarge KJEMI.hbond). */
  dashed?: boolean;
  color?: string;
  /** Strektykkelse (standard 2,6 · skala). */
  width?: number;
  /** Luft mellom streken og atomkula (standard 0 for bindinger, 4 for stiplede). */
  gap?: number;
}

/** Binding mellom to atomer. Strekene stopper ved kanten av kulene, så de kan tegnes over eller under atomene. */
export function Bond({ a, b, order = 1, stereo = 'plane', dashed, color, width, gap }: BondProps) {
  const k = useAtomScale();
  const ra = radiusOf(a, k);
  const rb = radiusOf(b, k);
  const stroke = color ?? (dashed ? KJEMI.hbond : KJEMI.bond);
  const w = width ?? 2.6 * k;
  const g = gap ?? (dashed ? 4 * k : 0);
  if (stereo !== 'plane' && order === 1 && !dashed) {
    const s = trimSegment(a, b, ra, rb, g);
    if (!s) return null;
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const nx = -(s.y2 - s.y1) / len;
    const ny = (s.x2 - s.x1) / len;
    const wide = 5 * k;
    if (stereo === 'wedge') {
      const pts = [
        [s.x1 + nx * 0.8, s.y1 + ny * 0.8],
        [s.x2 + nx * wide, s.y2 + ny * wide],
        [s.x2 - nx * wide, s.y2 - ny * wide],
        [s.x1 - nx * 0.8, s.y1 - ny * 0.8],
      ];
      return <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={stroke} />;
    }
    const n = Math.max(4, Math.round(len / (6 * k)));
    const lines: ReactNode[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const cx = s.x1 + (s.x2 - s.x1) * t;
      const cy = s.y1 + (s.y2 - s.y1) * t;
      const hw = 1 + (wide - 1) * t;
      lines.push(<line key={i} x1={cx - nx * hw} y1={cy - ny * hw} x2={cx + nx * hw} y2={cy + ny * hw} stroke={stroke} strokeWidth={1.6 * k} />);
    }
    return <g>{lines}</g>;
  }
  const sep = 8.5 * k;
  const offsets = order === 1 ? [0] : order === 2 ? [-sep / 2, sep / 2] : [-sep, 0, sep];
  return (
    <g>
      {offsets.map((o) => {
        const s = trimSegment(a, b, ra, rb, g, o);
        return s ? (
          <line key={o} {...s} stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeDasharray={dashed ? `${5 * k} ${5 * k}` : undefined} />
        ) : null;
      })}
    </g>
  );
}

/** Fritt elektronpar: to prikker ved atomet i retning `angle` (grader, 90 = over). */
export function LonePair({ at, angle, distance, color = KJEMI.electron }: { at: AtomLike; angle: number; distance?: number; color?: string }) {
  const k = useAtomScale();
  const d = distance ?? radiusOf(at, k) + 7 * k;
  const c = polar(at.x, at.y, d, angle);
  const t = polar(0, 0, 4.6 * k, angle + 90);
  return (
    <g>
      <circle cx={c.x + t.x} cy={c.y + t.y} r={3.3 * k} fill={color} />
      <circle cx={c.x - t.x} cy={c.y - t.y} r={3.3 * k} fill={color} />
    </g>
  );
}

/**
 * Dipolpil fra den positive (δ+) til den negative (δ−) enden av en binding eller et molekyl, med tverrstrek ved
 * den positive enden (⟼).
 */
export function DipoleArrow({ from, to, color = VIZ.ink }: { from: Pt; to: Pt; color?: string }) {
  const k = useAtomScale();
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (!(len > 4)) return null;
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const cx = from.x + ux * Math.min(16 * k, len * 0.25);
  const cy = from.y + uy * Math.min(16 * k, len * 0.25);
  const h = 8 * k;
  return (
    <g>
      <Arrow x1={from.x} y1={from.y} x2={to.x} y2={to.y} color={color} width={2.4 * k} head={12 * k} />
      <line x1={cx + uy * h} y1={cy - ux * h} x2={cx - uy * h} y2={cy + ux * h} stroke={color} strokeWidth={2.4 * k} strokeLinecap="round" />
    </g>
  );
}

/** Bue som viser en bindingsvinkel ved (x, y) mellom retningene `from` og `to` (grader), med etikett. */
export function AngleArc({ x, y, from, to, r, label, color = VIZ.muted }: { x: number; y: number; from: number; to: number; r: number; label?: ReactNode; color?: string }) {
  const f = useTextScale();
  // Den minste buen fra `from` til `to`; ved 180° går buen mot klokka fra `from`.
  let span = (((to - from) % 360) + 360) % 360;
  let start = from;
  if (span > 180 + 1e-9) {
    start = to;
    span = 360 - span;
  }
  const p0 = polar(x, y, r, start);
  const p1 = polar(x, y, r, start + span);
  const mid = polar(x, y, r + 8 + 12 * f, start + span / 2);
  return (
    <g>
      <path d={`M${p0.x},${p0.y} A${r},${r} 0 0 0 ${p1.x},${p1.y}`} fill="none" stroke={color} strokeWidth={1.8} />
      {label !== undefined && (
        <Txt x={mid.x} y={mid.y + 5 * f} color={color} size={0.85}>
          {label}
        </Txt>
      )}
    </g>
  );
}

export interface VseprMoleculeProps {
  x: number;
  y: number;
  geometry: Geometry;
  /** Sentralatomet, f.eks. «O». */
  center: string;
  /** Nabotomene: ett symbol for alle («H») eller ett per binding. */
  ligands: string | readonly string[];
  /** Bindingsorden per binding (standard 1), f.eks. [2, 2] for CO₂. */
  orders?: readonly (1 | 2 | 3)[];
  /** Avstand sentrum–sentrum (standard ut fra atomstørrelsene). */
  bond?: number;
  rotate?: number;
  /** Overstyr bindingsvinkelen (bare vinklede molekyler). */
  angle?: number;
  /** Tegn de frie elektronparene på sentralatomet (standard true). */
  lonePairs?: boolean;
  /** Vis bindingsvinkelen med bue og etikett. */
  showAngle?: boolean;
  /** Delladninger: på sentralatomet og på nabotomene. */
  partials?: { center: 'plus' | 'minus'; ligands: 'plus' | 'minus' };
}

/**
 * Et helt molekyl med VSEPR-form: sentralatom, bindinger (med kile og stiplet kile for tetraedre), frie elektronpar
 * og eventuelt bindingsvinkelen.
 *
 *   <VseprMolecule x={200} y={160} geometry="bent" center="O" ligands="H" showAngle />
 *   <VseprMolecule x={600} y={160} geometry="linear" center="C" ligands="O" orders={[2, 2]} />
 */
export function VseprMolecule({ x, y, geometry, center, ligands, orders, bond, rotate, angle, lonePairs = true, showAngle, partials }: VseprMoleculeProps) {
  const k = useAtomScale();
  const first = typeof ligands === 'string' ? ligands : (ligands[0] ?? 'H');
  const rc = atomRadius(center, { scale: k });
  const L = bond ?? (rc + atomRadius(first, { scale: k })) * 1.3 + 14 * k;
  const lay = vsepr(geometry, { x, y, bond: L, rotate, angle });
  const lig = lay.ligands.map((p, i) => ({ ...p, el: typeof ligands === 'string' ? ligands : (ligands[i] ?? first) }));
  const c: AtomLike = { x, y, el: center };
  const [i0, i1] = lay.angle.between;
  const a0 = lig[i0];
  const a1 = lig[i1];
  // Atomene bak papirplanet (stiplet kile) tegnes først, så de havner bak.
  const order = lig.map((_, i) => i).sort((p, q) => (lig[p]!.stereo === 'hash' ? -1 : 0) - (lig[q]!.stereo === 'hash' ? -1 : 0));
  return (
    <g>
      {showAngle && a0 && a1 && <AngleArc x={x} y={y} from={a0.angle} to={a1.angle} r={rc + 12 * k} label={`${fmt(lay.angle.value, Number.isInteger(lay.angle.value) ? 0 : 1)}°`} />}
      {order.map((i) => {
        const l = lig[i]!;
        return <Bond key={`b${i}`} a={c} b={l} order={orders?.[i] ?? 1} stereo={l.stereo} />;
      })}
      {order.map((i) => {
        const l = lig[i]!;
        return <Atom key={`a${i}`} x={l.x} y={l.y} el={l.el} partial={partials?.ligands} partialAngle={l.angle} />;
      })}
      <Atom x={x} y={y} el={center} partial={partials?.center} partialAngle={lay.lonePairs.length ? lay.lonePairs[0]! + 180 : 90} />
      {lonePairs && lay.lonePairs.map((deg) => <LonePair key={`lp${deg}`} at={c} angle={deg} />)}
    </g>
  );
}

export interface ElectronShellsProps {
  /** Sentrum av atomet. */
  x: number;
  y: number;
  /** Grunnstoffsymbol. */
  el: string;
  /** Elektroner per skall (standard: Bohr-skallene, eller skallene etter n for Z > 20). Gi egne for ioner. */
  shells?: readonly number[];
  /** Ladning som vises ved det ytterste skallet (for ioner). */
  charge?: number;
  /** Radius til det innerste skallet (standard 34 · skala). */
  r0?: number;
  /** Avstand mellom skallene (standard 22 · skala). */
  dr?: number;
  /** Fremhev det ytterste skallet og valenselektronene (standard true). */
  highlightValence?: boolean;
  /** «even»: jevnt fordelt (standard). «pairs»: som Lewis-strukturer, inntil 8 elektroner i fire par (N, Ø, S, V). */
  layout?: 'even' | 'pairs';
  /** De siste n elektronene i ytterste skall er tatt opp fra et annet atom (tegnes med ring i KJEMI.minus). */
  gained?: number;
  /** Tegn et tomt, stiplet skall utenfor (skallet et positivt ion har mistet). */
  emptyShell?: boolean;
  /** Vis kjerneladningen (f.eks. «11+») under symbolet (standard true). */
  showZ?: boolean;
}

/** Ytre radius til en Bohr-modell med `n` skall (for å plassere ting rundt den). */
export function shellRadius(n: number, r0: number, dr: number): number {
  return r0 + Math.max(0, n - 1) * dr;
}

/**
 * Bohrs atommodell: kjerne med symbol og kjerneladning, skallene som ringer og elektronene som prikker. Det ytterste
 * skallet (valensskallet) fremheves.
 *
 *   <ElectronShells x={200} y={200} el="Na" />                         2, 8, 1
 *   <ElectronShells x={500} y={200} el="Cl" shells={[2, 8, 8]} charge={-1} gained={1} />
 */
export function ElectronShells({
  x,
  y,
  el,
  shells,
  charge = 0,
  r0,
  dr,
  highlightValence = true,
  layout = 'even',
  gained = 0,
  emptyShell = false,
  showZ = true,
}: ElectronShellsProps) {
  const k = useAtomScale();
  const e = getElement(el);
  const sh = shells ?? e?.bohrShells ?? e?.shells ?? [];
  const R0 = r0 ?? 34 * k;
  const DR = dr ?? 22 * k;
  const nucleusR = R0 * 0.62;
  const c = atomColors(el);
  const er = 4.6 * k;
  const outer = sh.length - 1;
  const rings: ReactNode[] = [];
  const dots: ReactNode[] = [];
  sh.forEach((count, i) => {
    const R = R0 + i * DR;
    const valence = highlightValence && i === outer;
    rings.push(
      <circle key={`r${i}`} cx={x} cy={y} r={R} fill="none" stroke={valence ? KJEMI.valence : KJEMI.shell} strokeWidth={valence ? 2 : 1.5} opacity={valence ? 0.75 : 1} />,
    );
    const pos = electronAngles(count, layout === 'pairs' && count <= 8, i, R, er);
    pos.forEach((deg, j) => {
      const p = polar(x, y, R, deg);
      const isGained = valence && j >= count - gained;
      dots.push(
        <circle
          key={`e${i}-${j}`}
          cx={p.x}
          cy={p.y}
          r={er}
          fill={valence ? KJEMI.valence : KJEMI.electron}
          stroke={isGained ? KJEMI.minus : VIZ.surface}
          strokeWidth={isGained ? 2.2 * k : 1.5}
        />,
      );
    });
  });
  const outerR = R0 + Math.max(sh.length, 1) * DR - DR + (emptyShell ? DR : 0);
  const symFs = nucleusR * (el.length > 1 ? 0.78 : 0.9);
  return (
    <g>
      {emptyShell && <circle cx={x} cy={y} r={R0 + sh.length * DR} fill="none" stroke={KJEMI.shell} strokeWidth={1.5} strokeDasharray={`${4 * k} ${5 * k}`} />}
      {rings}
      <circle cx={x} cy={y} r={nucleusR} fill={c.fill} stroke={c.line} className="kj-atom" />
      <text x={x} y={showZ && e ? y + symFs * 0.12 : y + symFs * 0.36} className="kj-atom-symbol" style={{ fill: c.ink, fontSize: symFs }}>
        {el}
      </text>
      {showZ && e && (
        <text x={x} y={y + symFs * 0.12 + nucleusR * 0.5} className="kj-atom-symbol" style={{ fill: c.ink, fontSize: nucleusR * 0.42, fontWeight: 600 }}>
          {e.Z}+
        </text>
      )}
      {dots}
      {charge !== 0 && (
        <Txt x={x + outerR * 0.74 + 6 * k} y={y - outerR * 0.74} anchor="start" color={charge > 0 ? KJEMI.plus : KJEMI.minus} weight={700} size={1.1}>
          {chargeText(charge)}
        </Txt>
      )}
    </g>
  );
}

/** Vinklene til elektronene i ett skall. «pairs» følger Lewis: ett elektron på hver side først, så par. */
function electronAngles(count: number, pairs: boolean, shell: number, R: number, er: number): number[] {
  if (count <= 0) return [];
  if (!pairs) {
    const start = 90 + shell * 17;
    return Array.from({ length: count }, (_, j) => start + (360 * j) / count);
  }
  const sides = [90, 0, 270, 180];
  // Halv avstand mellom to elektroner i et par, som vinkel
  const half = (((er * 1.25) / R) * 180) / Math.PI;
  const per = [0, 0, 0, 0];
  for (let j = 0; j < count; j++) per[j % 4]!++;
  const out: number[] = [];
  sides.forEach((s, i) => {
    if (per[i] === 1) out.push(s);
    else if (per[i] === 2) out.push(s + half, s - half);
  });
  return out;
}

/** Lite vannmolekyl for partikkelbilder (O med to H, 104,5°), uten tekst. `size` 1 gir O med radius 7. */
export function WaterMolecule({ x, y, angle = 0, size = 1 }: { x: number; y: number; angle?: number; size?: number }) {
  const o = atomColors('O');
  const h = atomColors('H');
  const rO = 7 * size;
  const rH = 4.6 * size;
  const d = rO + rH * 0.55;
  const h1 = polar(x, y, d, 270 - 52.25 + angle);
  const h2 = polar(x, y, d, 270 + 52.25 + angle);
  return (
    <g>
      <circle cx={h1.x} cy={h1.y} r={rH} fill={h.fill} stroke={h.line} strokeWidth={1.2} />
      <circle cx={h2.x} cy={h2.y} r={rH} fill={h.fill} stroke={h.line} strokeWidth={1.2} />
      <circle cx={x} cy={y} r={rO} fill={o.fill} stroke={o.line} strokeWidth={1.4} />
    </g>
  );
}
