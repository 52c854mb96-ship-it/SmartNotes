/**
 * Figuren til eksempeloppgaven «Hydrogen i en stjernetåke»: Orion-tåken med en lupe som viser ett hydrogenatom
 * (Bohrs baner), et energinivådiagram med brutt akse og et spektrum fra ultrafiolett til infrarødt. Figuren bygger
 * seg opp med stegene (se figureFlags).
 */
import type { CSSProperties, ReactNode } from 'react';
import { Figure, Txt, VIZ, fmt, useTextScale, type FigureState } from '../../kit';
import {
  Elektron,
  Foton,
  Nukleon,
  RadialGradient,
  SCENE,
  Spektrum,
  Stjerne,
  Stjernehimmel,
  Taake,
  alpha,
  bolgelengdeFarge,
  mix,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { VISIBLE_MAX, VISIBLE_MIN, levelEnergy, type HydrogenSolution, type Region } from './model-eks-hydrogen';
import { useFigureTextScale } from './useNarrow';

/* ---------- Hva figuren viser i hvert steg ---------- */

export interface FigFlags {
  /** Energiene står ved nivåene (a1 og videre). */
  energies: boolean;
  /** «Fritt elektron» over ∞-linja (a2 og videre). */
  free: boolean;
  /** Hva som skjer i atomet i lupen. */
  atom: 'eksitert' | 'emisjon' | 'ion1' | 'ionL';
  /** Spranget og fotonet i diagrammet. */
  emission: 'off' | 'on' | 'dim';
  /** Fotonet har fått fargen sin (c2). */
  colored: boolean;
  /** Merket for fotonet i spekteret: bare bølgelengden (c1) eller også fargen (c2). */
  marker: 'off' | 'nm' | 'farge';
  /** Ionisering fra grunntilstanden (d). */
  ion1: 'off' | 'on' | 'dim';
  /** Ioniseringsfotonet har fått fargen sin (d2 og e2). */
  ionColored: boolean;
  /** Grensen 91,2 nm i spekteret (d2). */
  ion1Marker: boolean;
  /** Ionisering fra det nederste nivået i overgangen (e). */
  ionL: boolean;
  /** Klammen for bølgelengdene som kan ionisere fra det nederste nivået (e2). */
  bracket: boolean;
  /** Området i spekteret som utheves. */
  zone: Region | null;
}

/** Stegene: 1–2 a), 3 b), 4–5 c), 6–7 d), 8–9 e). */
export function figureFlags(step: number, showAll: boolean, s: HydrogenSolution): FigFlags {
  if (showAll) {
    return {
      energies: true,
      free: true,
      atom: 'emisjon',
      emission: 'on',
      colored: true,
      marker: 'farge',
      ion1: 'on',
      ionColored: true,
      ion1Marker: true,
      ionL: true,
      bracket: true,
      zone: null,
    };
  }
  return {
    energies: step >= 1,
    free: step >= 2,
    atom: step <= 2 ? 'eksitert' : step <= 5 ? 'emisjon' : step <= 7 ? 'ion1' : 'ionL',
    emission: step >= 3 && step <= 5 ? 'on' : step > 5 ? 'dim' : 'off',
    colored: step >= 5,
    marker: step === 4 ? 'nm' : step >= 5 ? 'farge' : 'off',
    ion1: step === 6 || step === 7 ? 'on' : step > 7 ? 'dim' : 'off',
    ionColored: step === 7 || step === 9,
    ion1Marker: step === 7,
    ionL: step >= 8,
    bracket: step >= 9,
    zone: step === 5 ? s.region : step === 7 ? 'uv' : step === 9 ? s.ionLower.region : null,
  };
}

/* ---------- Oppsett ---------- */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Circle {
  x: number;
  y: number;
  r: number;
}
interface Pt {
  x: number;
  y: number;
}

/** Spekteret går fra 250 til 870 nm: litt ultrafiolett, hele det synlige og litt infrarødt (821 nm får plass). */
const LO = 250;
const HI = 870;

interface Layout {
  stacked: boolean;
  H: number;
  panel: Box;
  lupe: Circle;
  ring: Circle;
  /** Stjernehopen (de unge, varme stjernene) i tåken. */
  stars: Pt;
  title: Pt;
  caption: Pt & { anchor: 'start' | 'middle' };
  diagram: Box;
  spec: SpecGeom;
}

interface SpecGeom {
  x0: number;
  x1: number;
  bracketLabelY: number;
  bracketY: number;
  markerLabelY: number;
  stripY: number;
  stripH: number;
  zonesY: number;
}

function specGeom(y0: number, x0: number, x1: number, f: number): SpecGeom {
  const ss = Math.max(1, f * 0.75);
  const bracketLabelY = y0 + 14 * f;
  const bracketY = bracketLabelY + 8 + 2 * f;
  const markerLabelY = bracketY + 8 + 14 * f;
  const stripY = markerLabelY + 16 + 3 * f;
  const stripH = 26 + 8 * (f - 1);
  // Tallene under stripa (Spektrum med skala) tar ca. 6 · strekskala + 13,4 · f.
  const zonesY = stripY + stripH + 6 * ss + 13.4 * f + 8 + 14 * f;
  return { x0, x1, bracketLabelY, bracketY, markerLabelY, stripY, stripH, zonesY };
}

/** PC: tåken og lupen til venstre, diagrammet til høyre og spekteret under. Mobil: alt under hverandre. */
function layout(f: number): Layout {
  if (f <= 1.3) {
    const spec = specGeom(372, 40, 760, f);
    return {
      stacked: false,
      H: Math.round(spec.zonesY + 10),
      panel: { x: 6, y: 6, w: 270, h: 352 },
      lupe: { x: 141, y: 216, r: 116 },
      ring: { x: 212, y: 62, r: 7 },
      stars: { x: 66, y: 74 },
      title: { x: 18, y: 32 },
      caption: { x: 141, y: 350, anchor: 'middle' },
      diagram: { x: 292, y: 4, w: 504, h: 356 },
      spec,
    };
  }
  const spec = specGeom(926, 30, 770, f);
  return {
    stacked: true,
    H: Math.round(spec.zonesY + 12),
    panel: { x: 6, y: 6, w: 788, h: 404 },
    lupe: { x: 588, y: 208, r: 188 },
    ring: { x: 300, y: 196, r: 9 },
    stars: { x: 120, y: 180 },
    title: { x: 24, y: 48 },
    caption: { x: 24, y: 388, anchor: 'start' },
    diagram: { x: 0, y: 424, w: 800, h: 486 },
    spec,
  };
}

/* ---------- Figuren ---------- */

export function HydrogenFigure({ s, state }: { s: HydrogenSolution; state: FigureState }) {
  const [ref, f] = useFigureTextScale<HTMLDivElement>(800);
  const L = layout(f);
  const flags = figureFlags(state.step, state.showAll, s);
  const { upper: u, lower: l } = s.task;
  const label = state.showAll
    ? `Hele løsningen: energinivådiagram for hydrogen med spranget fra n = ${u} til n = ${l}, ioniseringen fra n = 1 og fra n = ${l}, og spekteret med bølgelengdene.`
    : flags.atom === 'ion1'
      ? 'Et ultrafiolett foton river løs elektronet fra grunntilstanden n = 1, og elektronet blir fritt (E = 0).'
      : flags.atom === 'ionL'
        ? `Et foton river løs elektronet fra nivå n = ${l}, som ligger nærmere E = 0 enn grunntilstanden.`
        : flags.atom === 'emisjon'
          ? `Elektronet faller fra n = ${u} til n = ${l}, og atomet sender ut et foton med bølgelengde ${fmt(s.photon.nm, 0)} nm.`
          : `Et hydrogenatom i Orion-tåken med elektronet i nivå n = ${u}, og energinivåene E = −B/n² i et diagram.`;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${L.H}`} label={label} maxHeight={L.stacked ? undefined : 560}>
        <NebulaPanel L={L} />
        <AtomLupe c={L.lupe} s={s} flags={flags} />
        <LevelDiagram b={L.diagram} s={s} flags={flags} />
        <SpectrumBar g={L.spec} s={s} flags={flags} />
      </Figure>
    </div>
  );
}

/* ---------- Tekst på mørk bunn ---------- */

/** Lys skrift med mørk glorie (i tåken og i lupen), i begge temaer. `size` er relativ og vokser på mobil. */
function NightTxt({
  x,
  y,
  children,
  anchor = 'middle',
  size = 0.8,
  weight = 600,
  color,
  muted,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
  color?: string;
  muted?: boolean;
}) {
  const style: CSSProperties & Record<'--kj-fs', number> = {
    fill: color ?? (muted ? mix(SCENE.star, SCENE.space, 0.38) : SCENE.star),
    stroke: SCENE.space,
    fontWeight: weight,
    '--kj-fs': size,
  };
  return (
    <text x={x} y={y} textAnchor={anchor} className="kj-txt" style={style}>
      {children}
    </text>
  );
}

/* ---------- Tåken med stjernehopen ---------- */

/** Ytre tangenter mellom to sirkler (strekene fra ringen i tåken ut til lupen). */
function outerTangents(a: Circle, b: Circle): [Pt, Pt][] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!(d > Math.abs(a.r - b.r))) return [];
  const base = Math.atan2(dy, dx);
  const al = Math.acos((a.r - b.r) / d);
  return [base + al, base - al].map((t) => [
    { x: a.x + a.r * Math.cos(t), y: a.y + a.r * Math.sin(t) },
    { x: b.x + b.r * Math.cos(t), y: b.y + b.r * Math.sin(t) },
  ]);
}

/** Orion-tåken: mørk himmel, rød hydrogengass og en hop av unge, blå stjerner som sender ut ultrafiolett stråling. */
function NebulaPanel({ L }: { L: Layout }) {
  const ss = useStrokeScale();
  const sc = useSceneScale();
  const clip = useSvgId('eks-h-taake');
  const { panel: p, ring, lupe, stars: st } = L;
  const hop = [
    { dx: 0, dy: 0, r: 3.4, glimt: true },
    { dx: 15, dy: -8, r: 2.6, glimt: false },
    { dx: 8, dy: 12, r: 2.4, glimt: false },
    { dx: 22, dy: 7, r: 2.2, glimt: false },
  ];
  // Et ultrafiolett foton fra stjernehopen mot gassen ved ringen (det som holder gassen ionisert).
  const uvFrom = { x: st.x + 34 * sc, y: st.y + 2 };
  const uvTo = { x: ring.x - ring.r - 8, y: ring.y + (L.stacked ? 0 : 2) };
  return (
    <g>
      <clipPath id={clip}>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <Stjernehimmel x={p.x} y={p.y} w={p.w} h={p.h} seed={7} melkevei={0.25} />
        <Taake x={p.x - 30} y={p.y - 10} w={p.w + 60} h={p.h * 0.85} farge="rod" seed={5} stjerner={false} />
        {hop.map((h, i) => (
          <Stjerne key={i} x={st.x + h.dx * sc} y={st.y + h.dy * sc} r={h.r * sc} temperatur={32000} glod={0.9} glimt={h.glimt} />
        ))}
        <Foton x1={uvFrom.x} y1={uvFrom.y} x2={uvTo.x} y2={uvTo.y} bolgelengde={100} amplitude={4 * sc} />
      </g>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      <NightTxt x={L.title.x} y={L.title.y} anchor="start" size={0.95} weight={700}>
        Orion-tåken
      </NightTxt>
      <NightTxt x={L.title.x} y={L.title.y + 20 * (L.stacked ? 1.7 : 1)} anchor="start" size={0.7} muted>
        unge, varme stjerner
      </NightTxt>
      {/* Ringen rundt et sted i gassen og strekene ut til lupen. */}
      <g aria-hidden>
        {outerTangents(ring, lupe).map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SCENE.star} strokeWidth={1 * ss} opacity={0.45} />
        ))}
        <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={SCENE.star} strokeWidth={1.4 * ss} opacity={0.8} />
      </g>
      <NightTxt x={L.caption.x} y={L.caption.y} anchor={L.caption.anchor} size={0.7} muted>
        Ett hydrogenatom, forstørret
      </NightTxt>
    </g>
  );
}

/* ---------- Atomet i lupen ---------- */

/** Der en stråle fra p i retning (ux, uy) treffer sirkelen med sentrum c og radius rr. */
function rayToCircle(p: Pt, ux: number, uy: number, c: Pt, rr: number): Pt {
  const px = p.x - c.x;
  const py = p.y - c.y;
  const b = px * ux + py * uy;
  const cc = px * px + py * py - rr * rr;
  const t = -b + Math.sqrt(Math.max(0, b * b - cc));
  return { x: p.x + t * ux, y: p.y + t * uy };
}

/** Stiplet, svakt buet pil for spranget mellom to baner, med spiss. Stopper `gap` fra elektronene. */
function JumpArrow({ from, to, ctrl, gap }: { from: Pt; to: Pt; ctrl: Pt; gap: number }) {
  const ss = useStrokeScale();
  // Start og slutt et stykke inn på kurven (retningen mot kontrollpunktet), så pila ikke dekker elektronene.
  const toward = (p: Pt, q: Pt, d: number) => {
    const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: p.x + ((q.x - p.x) * d) / L, y: p.y + ((q.y - p.y) * d) / L };
  };
  const a = toward(from, ctrl, gap);
  const b = toward(to, ctrl, gap);
  const L = Math.hypot(b.x - ctrl.x, b.y - ctrl.y) || 1;
  const ux = (b.x - ctrl.x) / L;
  const uy = (b.y - ctrl.y) / L;
  const hl = 7 * ss;
  const hw = 4 * ss;
  const bx = b.x - ux * hl;
  const by = b.y - uy * hl;
  return (
    <g aria-hidden>
      <path d={`M${a.x} ${a.y}Q${ctrl.x} ${ctrl.y} ${bx} ${by}`} fill="none" stroke={SCENE.star} strokeWidth={1.7 * ss} strokeDasharray={`${3.5 * ss} ${2.5 * ss}`} />
      <path d={`M${b.x} ${b.y}L${bx - uy * hw} ${by + ux * hw}L${bx + uy * hw} ${by - ux * hw}Z`} fill={SCENE.star} />
    </g>
  );
}

/** Lys versjon av ioniseringsfargen (lilla), så streken synes på mørk bunn. */
const ION_LIGHT = mix(VIZ.series[3]!, 'var(--sc-star)', 0.45);

function AtomLupe({ c, s, flags }: { c: Circle; s: HydrogenSolution; flags: FigFlags }) {
  const ss = useStrokeScale();
  const sc = useSceneScale();
  const bg = useSvgId('eks-h-lupe');
  const R = c.r;
  // Kjernen litt til venstre for midten, så fotonet får plass til høyre. Banene er ikke i målestokk (r ∝ n²).
  const N = { x: c.x - 0.2 * R, y: c.y + 0.05 * R };
  const rn = (n: number) => R * (0.16 + 0.03 * n * n);
  const pos = (n: number, deg: number) => ({ x: N.x + rn(n) * Math.cos((deg * Math.PI) / 180), y: N.y - rn(n) * Math.sin((deg * Math.PI) / 180) });
  const re = 6.5 * sc;
  const { upper: u, lower: l } = s.task;
  const mode = flags.atom;
  const ionN = mode === 'ion1' ? 1 : l;
  const active = mode === 'eksitert' ? [u] : mode === 'emisjon' ? [u, l] : [ionN];

  // Emisjon: elektronet var på bane u (svakt) og er nå på bane l; fotonet går ut fra der elektronet var.
  const TH = 28;
  const ghost = pos(u, TH);
  const landed = pos(l, TH - 34);
  const ux = Math.cos((TH * Math.PI) / 180);
  const uy = -Math.sin((TH * Math.PI) / 180);
  const phStart = { x: ghost.x + ux * (re + 6), y: ghost.y + uy * (re + 6) };
  const phEnd = rayToCircle(phStart, ux, uy, c, R - 10 * sc);
  const jumpCtrl = pos((u + l) / 2 + 0.25, TH - 14);

  // Ionisering: elektronet på bane ionN treffes av et foton fra venstre og blir fritt (oppe til venstre).
  const ionStart = pos(ionN, 155);
  const freeDeg = 122;
  const free = { x: N.x + 0.78 * R * Math.cos((freeDeg * Math.PI) / 180), y: N.y - 0.78 * R * Math.sin((freeDeg * Math.PI) / 180) };
  // Fotonet kommer fra venstre, litt nedenfra (retningen d), og stopper like før elektronet.
  const d = { x: Math.cos((20 * Math.PI) / 180), y: -Math.sin((20 * Math.PI) / 180) };
  const inFrom = rayToCircle(ionStart, -d.x, -d.y, c, R - 10 * sc);
  const inTo = { x: ionStart.x - d.x * (re + 5), y: ionStart.y - d.y * (re + 5) };
  const ion = mode === 'ion1' ? s.ionGround : s.ionLower;
  const ionNm = ion.maxNm * 0.85;

  // Tallene på banene står på forskjellige vinkler nede, så de ikke kolliderer.
  const LABEL_DEG: Record<number, number> = { 1: 270, 2: 238, 3: 300, 4: 256 };

  return (
    <g>
      <RadialGradient id={bg} stops={[[0, SCENE.spaceGlow], [1, SCENE.space]]} />
      <circle cx={c.x + 2.5} cy={c.y + 4} r={c.r + 3} fill={SCENE.shadow} opacity={0.25} aria-hidden />
      <circle cx={c.x} cy={c.y} r={c.r} fill={`url(#${bg})`} />
      <circle cx={c.x} cy={c.y} r={c.r} fill={alpha(bolgelengdeFarge(656), 0.05)} aria-hidden />
      {[1, 2, 3, 4].map((n) => {
        const on = active.includes(n);
        return (
          <circle
            key={n}
            cx={N.x}
            cy={N.y}
            r={rn(n)}
            fill="none"
            stroke={alpha(SCENE.star, on ? 0.75 : 0.28)}
            strokeWidth={(on ? 1.8 : 1.1) * ss}
          />
        );
      })}
      <Nukleon x={N.x} y={N.y} r={9 * sc} type="proton" />

      {mode === 'eksitert' && <Elektron x={ghost.x} y={ghost.y} r={re} />}

      {mode === 'emisjon' && (
        <g>
          <Elektron x={ghost.x} y={ghost.y} r={re} dim />
          <JumpArrow from={ghost} to={landed} ctrl={jumpCtrl} gap={re + 2} />
          <Elektron x={landed.x} y={landed.y} r={re} />
          <Foton
            x1={phStart.x}
            y1={phStart.y}
            x2={phEnd.x}
            y2={phEnd.y}
            bolgelengde={s.photon.nm}
            farge={flags.colored ? undefined : SCENE.star}
            amplitude={5 * sc}
          />
        </g>
      )}

      {(mode === 'ion1' || mode === 'ionL') && (
        <g>
          <Foton
            x1={inFrom.x}
            y1={inFrom.y}
            x2={inTo.x}
            y2={inTo.y}
            bolgelengde={ionNm}
            farge={flags.ionColored ? undefined : SCENE.star}
            amplitude={5 * sc}
          />
          <Elektron x={ionStart.x} y={ionStart.y} r={re} dim />
          <path
            d={`M${ionStart.x} ${ionStart.y - re - 2} Q${ionStart.x - 0.05 * R} ${free.y + 0.12 * R} ${free.x + re * 0.6} ${free.y + re + 3}`}
            fill="none"
            stroke={ION_LIGHT}
            strokeWidth={1.8 * ss}
            strokeDasharray={`${4 * ss} ${3 * ss}`}
            aria-hidden
          />
          <Elektron x={free.x} y={free.y} r={re} />
          <NightTxt x={free.x + re + 6} y={free.y + 4} anchor="start" size={0.72}>
            fritt elektron
          </NightTxt>
        </g>
      )}

      {[1, 2, 3, 4].map((n) => {
        const p = pos(n, LABEL_DEG[n] ?? 270);
        const on = active.includes(n);
        return (
          <NightTxt key={n} x={p.x} y={p.y + 4.5 * sc} size={0.66} weight={on ? 700 : 500} muted={!on}>
            {String(n)}
          </NightTxt>
        );
      })}

      {/* Kanten på lupen, som glass. */}
      <g aria-hidden>
        <circle cx={c.x} cy={c.y} r={c.r} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
        <circle cx={c.x} cy={c.y} r={c.r + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
        <circle cx={c.x} cy={c.y} r={c.r - 3 * ss} fill="none" stroke={alpha(SCENE.star, 0.25)} strokeWidth={0.8 * ss} />
      </g>
    </g>
  );
}

/* ---------- Energinivådiagrammet ---------- */

/** Mantissen og eksponenten til et tall på standardform, som SVG-tekst: −5,45 · 10⁻¹⁹ J. */
function sciText(v: number, decimals = 2): string {
  if (v === 0) return '0 J';
  let exp = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** exp;
  if (Math.abs(Math.round(m * 10 ** decimals) / 10 ** decimals) >= 10) {
    m /= 10;
    exp += 1;
  }
  const sup: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return `${fmt(m, decimals)} · 10${String(exp)
    .split('')
    .map((ch) => sup[ch] ?? ch)
    .join('')} J`;
}

function diagramGeom(b: Box, f: number) {
  const top = b.y + 12 + 22 * f; // ∞-linja (E = 0)
  const gap = 50 + 10 * f; // bruddet mellom n = 2 og n = 1
  const bottomPad = 14 + 6 * f;
  const k = (b.h - (top - b.y) - gap - bottomPad) / 5.45; // px per 10⁻¹⁹ J over bruddet
  const y2 = top + 5.45 * k;
  const y1 = y2 + gap;
  const yOf = (n: number) => (n === 1 ? y1 : top + (-levelEnergy(n) / 1e-19) * k);
  const axisX = b.x + 14;
  const nLabX = b.x + 22 + 50 * f;
  const lx0 = nLabX + 10;
  const lx1 = b.x + b.w - 10 - 128 * f;
  const Lw = lx1 - lx0;
  return {
    top,
    y1,
    y2,
    yOf,
    axisX,
    nLabX,
    lx0,
    lx1,
    Lw,
    breakY: y2 + 0.36 * gap,
    xt: lx0 + 0.14 * Lw,
    xi1: lx0 + 0.56 * Lw,
    xiL: lx0 + 0.72 * Lw,
  };
}

/** Pil for et sprang eller en ionisering, med lys glorie. `breakAt` lager et brudd i skaftet (som på aksen). */
function LevelArrow({ x, y1, y2, color, breakAt, opacity = 1 }: { x: number; y1: number; y2: number; color: string; breakAt?: number; opacity?: number }) {
  const ss = useStrokeScale();
  const dir = Math.sign(y2 - y1) || 1;
  const hl = 11 * ss;
  const hw = 6 * ss;
  const shaftEnd = y2 - dir * hl;
  const gap = 4 * ss;
  const segs: [number, number][] =
    breakAt === undefined
      ? [[y1, shaftEnd]]
      : [
          [y1, breakAt - dir * gap],
          [breakAt + dir * gap, shaftEnd],
        ];
  const head = `M${x} ${y2}L${x - hw} ${shaftEnd}L${x + hw} ${shaftEnd}Z`;
  return (
    <g opacity={opacity}>
      {segs.map(([a, b], i) => (
        <line key={`h${i}`} x1={x} y1={a} x2={x} y2={b} stroke={VIZ.surface} strokeWidth={7 * ss} strokeLinecap="round" opacity={0.85} />
      ))}
      <path d={head} fill={VIZ.surface} stroke={VIZ.surface} strokeWidth={4 * ss} strokeLinejoin="round" opacity={0.85} />
      {segs.map(([a, b], i) => (
        <line key={i} x1={x} y1={a} x2={x} y2={b} stroke={color} strokeWidth={3.2 * ss} strokeLinecap="round" />
      ))}
      <path d={head} fill={color} />
      {breakAt !== undefined && <BreakMarks x={x} y={breakAt} color={color} />}
    </g>
  );
}

/** To skrå streker som viser at aksen (eller pila) er brutt: avstanden er ikke i målestokk. */
function BreakMarks({ x, y, color }: { x: number; y: number; color: string }) {
  const ss = useStrokeScale();
  const w = 8 * ss;
  const d = 4 * ss;
  return (
    <g aria-hidden>
      {[-d, d].map((o) => (
        <line key={o} x1={x - w} y1={y + o + 3 * ss} x2={x + w} y2={y + o - 3 * ss} stroke={color} strokeWidth={1.6 * ss} strokeLinecap="round" />
      ))}
    </g>
  );
}

function LevelDiagram({ b, s, flags }: { b: Box; s: HydrogenSolution; flags: FigFlags }) {
  const ss = useStrokeScale();
  const sc = useSceneScale();
  const f = useTextScale();
  const g = diagramGeom(b, f);
  const { upper: u, lower: l } = s.task;
  const asked = new Set(s.asked);
  const re = 6 * sc;
  const levels = [1, 2, 3, 4, 5, 6, 7, 8];
  const yu = g.yOf(u);
  const yl = g.yOf(l);
  const ym = (yu + yl) / 2;
  const phLen = 0.27 * g.Lw;

  const nLabel = (n: number) => (n <= 4 ? `n = ${n}` : null);
  const ionColor = VIZ.series[3]!;

  // Elektronet i diagrammet: på nivå u før spranget, på nivå l etter, og over ∞-linja når det er ionisert.
  let electron: { x: number; y: number; ghost?: { x: number; y: number } } | null = null;
  if (flags.atom === 'eksitert') electron = { x: g.xt - 14 * sc, y: yu - re - 1 };
  else if (flags.atom === 'emisjon') electron = { x: g.xt - 14 * sc, y: yl - re - 1, ghost: { x: g.xt - 14 * sc, y: yu - re - 1 } };
  else if (flags.atom === 'ion1') electron = { x: g.xi1 + 14 * sc, y: g.top - re - 3, ghost: { x: g.xi1 - 14 * sc, y: g.y1 - re - 1 } };
  else electron = { x: g.xiL + 14 * sc, y: g.top - re - 3, ghost: { x: g.xiL - 14 * sc, y: yl - re - 1 } };

  return (
    <g>
      {/* Området over ∞-linja: elektronet er fritt. */}
      {flags.free && (
        <g>
          <rect x={g.lx0} y={b.y + 4} width={g.lx1 - g.lx0} height={g.top - b.y - 4} fill={alpha(ionColor, 0.08)} rx={4} />
          <Txt x={g.lx0 + 8} y={g.top - 9} anchor="start" size={0.72} muted>
            fritt elektron
          </Txt>
        </g>
      )}

      {/* Aksen med brudd mellom n = 2 og n = 1. */}
      <g>
        <line x1={g.axisX} y1={g.y1 + 12} x2={g.axisX} y2={g.breakY + 5 * ss} stroke={VIZ.muted} strokeWidth={1.6 * ss} />
        <line x1={g.axisX} y1={g.breakY - 5 * ss} x2={g.axisX} y2={b.y + 14} stroke={VIZ.muted} strokeWidth={1.6 * ss} />
        <path d={`M${g.axisX} ${b.y + 4}L${g.axisX - 5 * ss} ${b.y + 14}L${g.axisX + 5 * ss} ${b.y + 14}Z`} fill={VIZ.muted} />
        <BreakMarks x={g.axisX} y={g.breakY} color={VIZ.muted} />
        <Txt x={g.axisX + 10} y={b.y + 18} anchor="start" size={0.85} weight={700}>
          E
        </Txt>
      </g>

      {/* Nivåene. Over n = 4 ligger de så tett at de bare antydes. */}
      {levels.map((n) => {
        const y = g.yOf(n);
        const on = asked.has(n) && flags.energies;
        return (
          <line
            key={n}
            x1={g.lx0}
            x2={g.lx1}
            y1={y}
            y2={y}
            stroke={n <= 4 ? VIZ.ink : VIZ.muted}
            strokeWidth={(on ? 2.8 : n <= 4 ? 1.6 : 1) * ss}
            opacity={n <= 4 ? (on || !flags.energies ? 1 : 0.55) : 0.5}
          />
        );
      })}
      <line x1={g.lx0} x2={g.lx1} y1={g.top} y2={g.top} stroke={VIZ.ink} strokeWidth={1.6 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} />

      {levels.map((n) => {
        const lab = nLabel(n);
        if (!lab) return null;
        return (
          <Txt key={n} x={g.nLabX} y={g.yOf(n) + 5 * f} anchor="end" size={0.8} weight={asked.has(n) ? 700 : 500} muted={!asked.has(n)}>
            {lab}
          </Txt>
        );
      })}
      <Txt x={g.nLabX} y={g.top + 5 * f} anchor="end" size={0.8} weight={600}>
        n = ∞
      </Txt>

      {flags.energies && (
        <g>
          {s.asked.map((n) => (
            <Txt key={n} x={g.lx1 + 8} y={g.yOf(n) + 5 * f} anchor="start" size={0.8} weight={650}>
              {sciText(levelEnergy(n))}
            </Txt>
          ))}
          <Txt x={g.lx1 + 8} y={g.top + 5 * f} anchor="start" size={0.8} weight={650}>
            0 J
          </Txt>
        </g>
      )}

      {/* Spranget og fotonet. */}
      {flags.emission !== 'off' && (
        <g opacity={flags.emission === 'dim' ? 0.28 : 1}>
          <LevelArrow x={g.xt} y1={yu + 2} y2={yl - 2} color={VIZ.ink} />
          <Foton
            x1={g.xt + 12}
            y1={ym}
            x2={g.xt + 12 + phLen}
            y2={ym}
            bolgelengde={s.photon.nm}
            farge={flags.colored ? undefined : VIZ.muted}
            amplitude={Math.min(7 * sc, (yl - yu) * 0.22)}
          />
        </g>
      )}

      {/* Ionisering fra grunntilstanden og fra nivå l. */}
      {flags.ion1 !== 'off' && (
        <g opacity={flags.ion1 === 'dim' ? 0.28 : 1}>
          <LevelArrow x={g.xi1} y1={g.y1 - 2} y2={g.top + 2} color={ionColor} breakAt={g.breakY} />
          <Txt x={g.xi1 + 9} y={g.y1 - 9} anchor="start" size={0.8} weight={700} color={ionColor}>
            {fmt(s.ionGround.eV, 1)} eV
          </Txt>
        </g>
      )}
      {flags.ionL && (
        <g>
          <LevelArrow x={g.xiL} y1={yl - 2} y2={g.top + 2} color={ionColor} />
          <Txt x={g.xiL + 9} y={yl - 9} anchor="start" size={0.8} weight={700} color={ionColor}>
            {fmt(s.ionLower.eV, 2)} eV
          </Txt>
        </g>
      )}

      {electron && (
        <g>
          {electron.ghost && <Elektron x={electron.ghost.x} y={electron.ghost.y} r={re} dim />}
          <Elektron x={electron.x} y={electron.y} r={re} />
        </g>
      )}
    </g>
  );
}

/* ---------- Spekteret ---------- */

/** Bølgelengden som tekst med tre gjeldende siffer: 91,2 nm, 657 nm, 1,88 µm. */
export function nmText(nm: number): string {
  if (nm >= 1000) return `${fmt(nm / 1000, 2)} µm`;
  if (nm < 100) return `${fmt(nm, 1)} nm`;
  return `${fmt(nm, 0)} nm`;
}

/** «rødt lys», «blågrønt lys» … */
const NEUTER_LIGHT: Record<string, string> = {
  rød: 'rødt',
  oransje: 'oransje',
  gul: 'gult',
  grønn: 'grønt',
  blågrønn: 'blågrønt',
  blå: 'blått',
  blåfiolett: 'blåfiolett',
  fiolett: 'fiolett',
};

const ZONE_NAME: Record<Region, string> = { uv: 'ultrafiolett', synlig: 'synlig lys', ir: 'infrarødt' };

function SpectrumBar({ g, s, flags }: { g: SpecGeom; s: HydrogenSolution; flags: FigFlags }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const sx = (nm: number) => g.x0 + ((g.x1 - g.x0) * (nm - LO)) / (HI - LO);
  const ionColor = VIZ.series[3]!;
  const nm = s.photon.nm;
  const markerText = flags.marker === 'farge' ? `${nmText(nm)}, ${s.color ? `${NEUTER_LIGHT[s.color] ?? s.color} lys` : 'infrarødt'}` : nmText(nm);
  const zoneY = g.zonesY;
  const zones: { r: Region; x: number; anchor: 'start' | 'middle' | 'end' }[] = [
    { r: 'uv', x: g.x0, anchor: 'start' },
    { r: 'synlig', x: sx((VISIBLE_MIN + VISIBLE_MAX) / 2), anchor: 'middle' },
    { r: 'ir', x: g.x1, anchor: 'end' },
  ];
  const lMax = s.ionLower.maxNm;
  const bx1 = sx(Math.min(lMax, HI));
  const ion1Text = `${nmText(s.ionGround.maxNm)} (fra n = 1)`;
  // Den stiplede streken fra klammen ned til spekteret får et opphold der den ville krysset et merke for en
  // bølgelengde utenfor spekteret: infrarødt til høyre (tallsett 3) eller 91,2 nm til venstre. Bredden er anslått.
  const textW = (t: string) => t.length * 0.56 * 17 * 0.8 * f;
  const rightLabel = flags.marker !== 'off' && nm > HI ? [g.x1 - 16 * ss - textW(markerText), g.x1 - 16 * ss] : null;
  const leftLabel = flags.ion1Marker ? [g.x0 + 16 * ss, g.x0 + 16 * ss + textW(ion1Text)] : null;
  const crossesLabel = [rightLabel, leftLabel].some((r) => r !== null && bx1 > r[0]! - 6 && bx1 < r[1]! + 6);
  const connector: [number, number][] = crossesLabel
    ? [
        [g.bracketY - 6 * ss, g.markerLabelY - 14 * f],
        [g.markerLabelY + 5, g.stripY + g.stripH],
      ]
    : [[g.bracketY - 6 * ss, g.stripY + g.stripH]];
  return (
    <g>
      <Spektrum x={g.x0} y={g.stripY} w={g.x1 - g.x0} h={g.stripH} fra={LO} til={HI} skala />

      {/* Ultrafiolett, synlig og infrarødt under tallene, med skillestreker ved 380 og 750 nm. */}
      {[VISIBLE_MIN, VISIBLE_MAX].map((b) => (
        <line key={b} x1={sx(b)} x2={sx(b)} y1={zoneY - 14 * f} y2={zoneY + 3} stroke={VIZ.muted} strokeWidth={1.2 * ss} opacity={0.7} />
      ))}
      {zones.map((z) => {
        const on = flags.zone === z.r;
        return (
          <Txt key={z.r} x={z.x} y={zoneY} anchor={z.anchor} size={0.75} weight={on ? 750 : 500} muted={!on}>
            {ZONE_NAME[z.r]}
          </Txt>
        );
      })}

      {/* Fotonet fra spranget. */}
      {flags.marker !== 'off' &&
        (nm <= HI ? (
          <SpecMarker x={sx(nm)} g={g} color={VIZ.ink}>
            {markerText}
          </SpecMarker>
        ) : (
          <EdgeMarker x={g.x1} y={g.markerLabelY} side="hoyre" color={VIZ.ink}>
            {markerText}
          </EdgeMarker>
        ))}

      {/* Grensen for ionisering fra grunntilstanden (91,2 nm) er langt til venstre for spekteret. */}
      {flags.ion1Marker && (
        <EdgeMarker x={g.x0} y={g.markerLabelY} side="venstre" color={ionColor}>
          {ion1Text}
        </EdgeMarker>
      )}

      {/* Bølgelengdene som kan ionisere fra nivå l: alt til venstre for grensen. */}
      {flags.bracket && (
        <g>
          <line x1={g.x0 + 2} x2={bx1} y1={g.bracketY} y2={g.bracketY} stroke={ionColor} strokeWidth={2.6 * ss} />
          <path d={`M${g.x0} ${g.bracketY}L${g.x0 + 9 * ss} ${g.bracketY - 5 * ss}L${g.x0 + 9 * ss} ${g.bracketY + 5 * ss}Z`} fill={ionColor} />
          {connector.map(([y1, y2], i) => (
            <line key={i} x1={bx1} x2={bx1} y1={y1} y2={y2} stroke={ionColor} strokeWidth={2 * ss} strokeDasharray={`${4 * ss} ${3 * ss}`} />
          ))}
          <Txt x={g.x0} y={g.bracketLabelY} anchor="start" size={0.75} weight={700} color={ionColor}>
            {`λ ≤ ${nmText(lMax)} kan ionisere fra n = ${s.task.lower}`}
          </Txt>
        </g>
      )}
    </g>
  );
}

/** Merke over spekteret: en trekant som peker ned på bølgelengden, en strek gjennom stripa og teksten over. */
function SpecMarker({ x, g, color, children }: { x: number; g: SpecGeom; color: string; children: ReactNode }) {
  const ss = useStrokeScale();
  const tw = 6 * ss;
  const ty = g.stripY - 3;
  return (
    <g>
      <line x1={x} x2={x} y1={g.stripY} y2={g.stripY + g.stripH} stroke={VIZ.surface} strokeWidth={4.5 * ss} />
      <line x1={x} x2={x} y1={g.stripY} y2={g.stripY + g.stripH} stroke={color} strokeWidth={2 * ss} />
      <path d={`M${x} ${ty}L${x - tw} ${ty - 9 * ss}L${x + tw} ${ty - 9 * ss}Z`} fill={color} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
      <Txt x={x} y={g.markerLabelY} anchor="middle" size={0.8} weight={700} color={color}>
        {children}
      </Txt>
    </g>
  );
}

/** Merke for en bølgelengde utenfor spekteret: en liten pil mot kanten og teksten ved siden av. */
function EdgeMarker({ x, y, side, color, children }: { x: number; y: number; side: 'venstre' | 'hoyre'; color: string; children: ReactNode }) {
  const ss = useStrokeScale();
  const dir = side === 'venstre' ? -1 : 1;
  const cy = y - 5 * ss;
  const tip = x;
  const back = x - dir * 11 * ss;
  return (
    <g>
      <path d={`M${tip} ${cy}L${back} ${cy - 6 * ss}L${back} ${cy + 6 * ss}Z`} fill={color} />
      <Txt x={back - dir * 5 * ss} y={y} anchor={side === 'venstre' ? 'start' : 'end'} size={0.8} weight={700} color={color}>
        {children}
      </Txt>
    </g>
  );
}
