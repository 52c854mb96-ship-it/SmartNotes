/**
 * Figuren til eksempeloppgaven «Fotoner fra laserpekere»: en rød og en grønn laserpeker på labbenken med fotonene
 * som bølgepakker langs strålene, en sommerdag der sollyset treffer huden (med en lupe som viser DNA i en hudcelle),
 * og et søylediagram med energien per foton, antall fotoner per sekund og grensen for DNA-skade. Figuren bygger seg
 * opp med stegene (se fotonFlags).
 *
 * PC: de to scenene ved siden av hverandre og diagrammet under; scenen som ikke hører til steget, er tonet ned.
 * Mobil: viewBox-en er bare én scene bred (420), så teksten ikke må vokse; bare scenen som hører til steget, vises
 * (begge med «Vis hele løsningen»), og diagrammet legges under.
 */
import type { ReactNode } from 'react';
import { Figure, Txt, VIZ, fmt, fmtSci, type FigureState } from '../../kit';
import {
  Foton,
  Himmel,
  Landskap,
  LinearGradient,
  Lysstraale,
  Person,
  RadialGradient,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  bolgelengdeFarge,
  mix,
  personPunkter,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { DnaTraad, Laserpeker, Lysprikk, Skjerm, Stativ, Varme } from './eks-foton-deler';
import type { Photon, PhotonSolution } from './model-eks-foton';
import { useNarrow } from './useNarrow';

/* ---------- Hva figuren viser i hvert steg ---------- */

export interface FotonFlags {
  /** Scenen steget handler om: laserpekerne (a–c) eller sola og huden (d–e). */
  focus: 'begge' | 'laser' | 'sol';
  /** Fotonene langs den røde strålen (a og videre). */
  redPhotons: boolean;
  /** Energien ved det røde fotonet: i joule (a1) eller elektronvolt (a2 og videre). */
  redLabel: 'off' | 'J' | 'eV';
  /** Antall røde fotoner per sekund (b og videre). */
  redCount: boolean;
  /** Fotonene langs den grønne strålen, med energi og antall (c og videre). */
  greenPhotons: boolean;
  /** Prosentene i sammenligningen (c2). */
  compare: boolean;
  /** Søylene i diagrammet. */
  bars: { red: 'off' | 'J' | 'eV'; green: boolean; uv: boolean };
  /** Grensen 4,0 eV for DNA-skade (d og videre). */
  threshold: boolean;
  /** Den største bølgelengden som kan skade (d2 og videre). */
  maxNm: boolean;
  /** UV-fotonet fra sola er merket med energien (d og videre). */
  uvEnergy: boolean;
  /** Lupen med DNA: ett synlig foton og ett UV-foton (e1), eller mange synlige (e2). */
  lupe: 'off' | 'en' | 'mange';
}

/** Stegene: 1–2 a), 3 b), 4–5 c), 6–7 d), 8–9 e). */
export function fotonFlags(step: number, showAll: boolean): FotonFlags {
  if (showAll) {
    return {
      focus: 'begge',
      redPhotons: true,
      redLabel: 'eV',
      redCount: true,
      greenPhotons: true,
      // Prosentene står i svaret; i hele løsningen ville de kommet for nær grenselinja i diagrammet.
      compare: false,
      bars: { red: 'eV', green: true, uv: true },
      threshold: true,
      maxNm: true,
      uvEnergy: true,
      lupe: 'mange',
    };
  }
  const red = step === 0 ? 'off' : step === 1 ? 'J' : 'eV';
  return {
    focus: step === 0 ? 'begge' : step <= 5 ? 'laser' : 'sol',
    redPhotons: step >= 1,
    redLabel: red,
    redCount: step >= 3,
    greenPhotons: step >= 4,
    compare: step === 5,
    bars: { red, green: step >= 4, uv: step >= 6 },
    threshold: step >= 6,
    maxNm: step >= 7,
    uvEnergy: step >= 6,
    lupe: step === 8 ? 'en' : step >= 9 ? 'mange' : 'off',
  };
}

/* ---------- Oppsett ---------- */

/** Hver scene er 420 × 290. */
const PW = 420;
const PH = 290;
const GAP = 14;
const CHART_WIDE = 202;
const CHART_NARROW = 258;
/** Gjennomsiktighet for scenen som ikke hører til steget (PC). */
const DIM = 0.45;

interface Pt {
  x: number;
  y: number;
}

interface Layout {
  W: number;
  H: number;
  a: Pt | null;
  b: Pt | null;
  chart: Pt & { w: number; wide: boolean };
}

function makeLayout(narrow: boolean, flags: FotonFlags, showAll: boolean): Layout {
  if (!narrow) {
    const W = 2 * PW + GAP;
    return { W, H: PH + 12 + CHART_WIDE, a: { x: 0, y: 0 }, b: { x: PW + GAP, y: 0 }, chart: { x: 0, y: PH + 12, w: W, wide: true } };
  }
  // Mobil: scenen som hører til steget (laserpekerne i oppgaven og a–c, sola i d–e), begge med hele løsningen.
  const showA = showAll || flags.focus !== 'sol';
  const showB = showAll || flags.focus === 'sol';
  let y = 0;
  const a = showA ? { x: 0, y } : null;
  if (showA) y += PH + 10;
  const b = showB ? { x: 0, y } : null;
  if (showB) y += PH + 10;
  return { W: PW, H: y + CHART_NARROW, a, b, chart: { x: 0, y, w: PW, wide: false } };
}

const eVText = (v: number) => `${fmt(v, 2)} eV`;
const JText = (v: number) => `${fmtSci(v, 2)} J`;
/** Antall fotoner per sekund med to gjeldende siffer: «3,3 · 10¹⁵». */
const NText = (v: number) => fmtSci(v, 1);

/* ---------- Figuren ---------- */

export function PhotonFigure({ s, state }: { s: PhotonSolution; state: FigureState }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const flags = fotonFlags(state.step, state.showAll);
  const L = makeLayout(narrow, flags, state.showAll);
  const dimA = !narrow && flags.focus === 'sol';
  const dimB = !narrow && flags.focus === 'laser';
  const label =
    `En rød laserpeker (${fmt(s.red.nm, 0)} nm) og en grønn (${fmt(s.green.nm, 0)} nm) med samme effekt lyser på en skjerm, ` +
    `og sollys med UV-B-stråling (${fmt(s.uv.nm, 0)} nm) treffer huden til en person. Diagrammet viser energien per foton: ` +
    `${eVText(s.red.eV)}, ${eVText(s.green.eV)} og ${eVText(s.uv.eV)}, og grensen ${fmt(s.task.damageEV, 1)} eV for skade på DNA.`;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 ${L.W} ${L.H}`} label={label} maxHeight={narrow ? 900 : 560}>
        {L.a && <LaserPanel s={s} flags={flags} at={L.a} dim={dimA} />}
        {L.b && <SunPanel s={s} flags={flags} at={L.b} dim={dimB} />}
        <EnergyChart s={s} flags={flags} at={L.chart} />
      </Figure>
    </div>
  );
}

/** Ramme med avrundede hjørner rundt en scene, med tittel øverst. */
function Panel({ at, dim, title, titleAnchor = 'start', children }: { at: Pt; dim: boolean; title: string; titleAnchor?: 'start' | 'end'; children: ReactNode }) {
  const ss = useStrokeScale();
  const clip = useSvgId('eks-foton-panel');
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <clipPath id={clip}>
        <rect x={0} y={0} width={PW} height={PH} rx={10} />
      </clipPath>
      <g clipPath={`url(#${clip})`} opacity={dim ? DIM : 1}>
        {children}
        <Txt x={titleAnchor === 'start' ? 14 : PW - 14} y={26} anchor={titleAnchor} size={0.85} weight={700}>
          {title}
        </Txt>
      </g>
      <rect x={0} y={0} width={PW} height={PH} rx={10} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.7} />
    </g>
  );
}

/* ---------- Laserpekerne på labbenken ---------- */

const BENCH = 214;
const Y_RED = 112;
const Y_GREEN = 170;
/** Åpningen på laserpekerne (der strålen kommer ut). */
const TIP = 124;
const SCREEN_X = 384;
/** Bølgepakkene: lengde og avstand langs den røde strålen. Avstanden for grønt er større (færre fotoner per sekund). */
const PACKET = 48;
const SPACING_RED = 60;
/** Svingninger per pakke ∝ 1/λ (som Foton i kit-et, men skalert så pakkene kan være korte). */
const cycles = (nm: number) => 2600 / nm;

function packetsAlong(spacing: number): number[] {
  const out: number[] = [];
  for (let x = TIP + 10; x + PACKET <= SCREEN_X - 10; x += spacing) out.push(x);
  return out;
}

function LaserPanel({ s, flags, at, dim }: { s: PhotonSolution; flags: FotonFlags; at: Pt; dim: boolean }) {
  const redX = packetsAlong(SPACING_RED);
  const greenX = packetsAlong(SPACING_RED / s.ratioN);
  const mid = (TIP + SCREEN_X) / 2;
  return (
    <Panel at={at} dim={dim} title="Laserpekerne">
      <Rom x={0} y={0} w={PW} h={PH} gulvY={272} gulv="betong" />
      <Underlag x1={-10} x2={PW + 10} y={BENCH} depth={90} type="labbenk" />
      <Stativ
        x={30}
        y={BENCH}
        topp={Y_RED - 34}
        klemmer={[
          { y: Y_RED, tilX: 82, r: 5.5 },
          { y: Y_GREEN, tilX: 82, r: 5.5 },
        ]}
      />
      <Laserpeker x={TIP} y={Y_RED} bolgelengde={s.red.nm} />
      <Laserpeker x={TIP} y={Y_GREEN} bolgelengde={s.green.nm} />
      <Skjerm x={SCREEN_X} y={BENCH} hoyde={150} />
      <Lysstraale x1={TIP + 2} y1={Y_RED} x2={SCREEN_X} y2={Y_RED} bolgelengde={s.red.nm} bredde={2} pil={false} styrke={flags.redPhotons ? 0.45 : 0.8} />
      <Lysstraale x1={TIP + 2} y1={Y_GREEN} x2={SCREEN_X} y2={Y_GREEN} bolgelengde={s.green.nm} bredde={2} pil={false} styrke={flags.greenPhotons ? 0.45 : 0.8} />
      <Lysprikk x={SCREEN_X} y={Y_RED} nm={s.red.nm} />
      <Lysprikk x={SCREEN_X} y={Y_GREEN} nm={s.green.nm} />

      {flags.redPhotons &&
        redX.map((x) => <Foton key={x} x1={x} y1={Y_RED} x2={x + PACKET} y2={Y_RED} bolgelengde={s.red.nm} amplitude={6.5} svingninger={cycles(s.red.nm)} />)}
      {flags.greenPhotons &&
        greenX.map((x) => (
          <Foton key={x} x1={x} y1={Y_GREEN} x2={x + PACKET} y2={Y_GREEN} bolgelengde={s.green.nm} amplitude={6.5} svingninger={cycles(s.green.nm)} />
        ))}

      {flags.redLabel !== 'off' && (
        <Txt x={TIP + 10 + PACKET / 2} y={Y_RED - 18} size={0.8} weight={700}>
          {flags.redLabel === 'J' ? JText(s.red.E) : eVText(s.red.eV)}
        </Txt>
      )}
      {flags.greenPhotons && (
        <Txt x={TIP + 10 + PACKET / 2} y={Y_GREEN - 18} size={0.8} weight={700}>
          {eVText(s.green.eV)}
        </Txt>
      )}
      {flags.redCount && <ValueTag x={mid + 14} y={Y_RED - 50} text={`${NText(s.red.N)} fotoner/s`} size={0.8} />}
      {flags.greenPhotons && <ValueTag x={mid + 14} y={Y_GREEN + 28} text={`${NText(s.green.N)} fotoner/s`} size={0.8} />}
    </Panel>
  );
}

/* ---------- Sola og huden ---------- */

const SUN = { x: 54, y: 52, r: 22 };
const HORIZON = 214;
const GROUND = 238;
const PERSON = { x: 350, y: 266, size: 150 };
const LUPE = { x: 188, y: 166, r: 106 };

interface Ray {
  nm: number;
  to: Pt;
}

/** Bølgepakken på slutten av strålen fra sola mot `to`: `len` lang og `gap` fra målet. */
function rayPacket(to: Pt, len: number, gap: number) {
  const dx = to.x - SUN.x;
  const dy = to.y - SUN.y;
  const d = Math.hypot(dx, dy);
  const ux = dx / d;
  const uy = dy / d;
  const x2 = to.x - ux * gap;
  const y2 = to.y - uy * gap;
  return { x1: x2 - ux * len, y1: y2 - uy * len, x2, y2, ux, uy };
}

/** Ytre tangenter mellom to sirkler (strekene fra ringen på kinnet ut til lupen). */
function outerTangents(a: Pt & { r: number }, b: Pt & { r: number }): [Pt, Pt][] {
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

function SunPanel({ s, flags, at, dim }: { s: PhotonSolution; flags: FotonFlags; at: Pt; dim: boolean }) {
  const ss = useStrokeScale();
  const pts = personPunkter('staa', PERSON.size, undefined, { x: PERSON.x, y: PERSON.y, flip: true });
  const face = { x: pts.hode.x - 10, y: pts.hode.y + 4 };
  const hand = pts.hoyreHand;
  const rays: Ray[] = [
    { nm: s.uv.nm, to: face },
    { nm: 590, to: { x: hand.x - 4, y: hand.y - 2 } },
  ];
  const uvP = rayPacket(rays[0]!.to, 96, 12);
  const visP = rayPacket(rays[1]!.to, 96, 12);
  const ring = { x: face.x + 2, y: face.y + 2, r: 11 };
  const showLupe = flags.lupe !== 'off';
  return (
    <Panel at={at} dim={dim} title="Sola og huden" titleAnchor="end">
      <Himmel w={PW} h={GROUND} sol={SUN} skyer={1} seed={6} />
      <Landskap x={0} y={HORIZON} w={PW} h={70} type="kyst" seed={3} />
      <Underlag x1={-10} x2={PW + 10} y={GROUND} depth={PH - GROUND + 10} type="gress" horisont={HORIZON} />
      <Person x={PERSON.x} y={PERSON.y} size={PERSON.size} flip jakke="gul" bukse="blaa" frisyre="hestehale" har="brun" />
      {!showLupe && (
        <>
          <Foton {...uvP} bolgelengde={s.uv.nm} amplitude={6} svingninger={cycles(s.uv.nm)} />
          <Foton {...visP} bolgelengde={rays[1]!.nm} amplitude={6} svingninger={cycles(rays[1]!.nm)} />
          {/* Etikettene: UV-fotonet over strålen, det synlige under. */}
          <Txt x={(uvP.x1 + uvP.x2) / 2 + 8} y={(uvP.y1 + uvP.y2) / 2 - 18} size={0.8} weight={700}>
            {flags.uvEnergy ? `UV-B: ${eVText(s.uv.eV)}` : 'UV-B'}
          </Txt>
          <Txt x={(visP.x1 + visP.x2) / 2 - 6} y={(visP.y1 + visP.y2) / 2 + 30} size={0.8} weight={600}>
            Synlig lys
          </Txt>
        </>
      )}
      {showLupe && (
        <>
          <g aria-hidden>
            {outerTangents(ring, LUPE).map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={VIZ.ink} strokeWidth={1 * ss} opacity={0.45} />
            ))}
            <circle cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} opacity={0.75} />
          </g>
          <DnaLupe s={s} many={flags.lupe === 'mange'} />
        </>
      )}
    </Panel>
  );
}

/**
 * Lupen: DNA i en hudcelle. Fotonene kommer fra sola (oppe til venstre). UV-B-fotonet bryter et basepar (skade),
 * fotonene i synlig lys gir bare litt varme. Med `many` treffer flere synlige fotoner, men ingen av dem skader.
 */
function DnaLupe({ s, many }: { s: PhotonSolution; many: boolean }) {
  const ss = useStrokeScale();
  const clip = useSvgId('eks-foton-lupe');
  const bg = useSvgId('eks-foton-hud');
  const { x: cx, y: cy, r: R } = LUPE;
  const dnaY = cy + 12;
  const uvX = cx + 0.2 * R;
  const hits: { x: number; p: Photon }[] = many
    ? [
        { x: cx - 0.52 * R, p: s.red },
        { x: cx - 0.16 * R, p: s.green },
        { x: uvX, p: s.uv },
        { x: cx + 0.56 * R, p: s.red },
      ]
    : [
        { x: cx - 0.45 * R, p: s.red },
        { x: uvX, p: s.uv },
      ];
  const vis = hits[0]!;
  // Fotonene kommer skrått ovenfra, fra sola.
  const dir = { x: Math.cos(1.0), y: Math.sin(1.0) };
  const len = 64;
  return (
    <g>
      <clipPath id={clip}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
      <RadialGradient
        id={bg}
        fx={0.35}
        fy={0.3}
        stops={[
          [0, mix(SCENE.skin, VIZ.surface, 0.55)],
          [1, mix(SCENE.skin, VIZ.surface, 0.3)],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <circle cx={cx} cy={cy} r={R} fill={`url(#${bg})`} />
        <DnaTraad x1={cx - R - 10} x2={cx + R + 10} y={dnaY} skade={[uvX]} />
        {hits.map((h, i) => {
          const isUv = h.p.nm === s.uv.nm;
          const end = { x: h.x - dir.x * 6, y: dnaY - 14 - dir.y * 6 };
          return (
            <g key={i}>
              {!isUv && <Varme x={h.x + 7} y={dnaY - 16} h={16} />}
              <Foton
                x1={end.x - dir.x * len}
                y1={end.y - dir.y * len}
                x2={end.x}
                y2={end.y}
                bolgelengde={h.p.nm}
                amplitude={5}
                svingninger={cycles(h.p.nm)}
              />
            </g>
          );
        })}
        <Txt x={cx} y={cy - R + 28} size={0.75} weight={700}>
          DNA i en hudcelle
        </Txt>
        {/* Under treffene: energien til fotonet og hva som skjer. */}
        <Txt x={vis.x} y={dnaY + 38} size={0.72} weight={700}>
          {eVText(vis.p.eV)}
        </Txt>
        <Txt x={vis.x} y={dnaY + 54} size={0.72} weight={600} muted>
          varme
        </Txt>
        <Txt x={uvX} y={dnaY + 38} size={0.72} weight={700}>
          {eVText(s.uv.eV)}
        </Txt>
        <Txt x={uvX} y={dnaY + 54} size={0.72} weight={700}>
          skade
        </Txt>
      </g>
      {/* Kanten på lupen, som glass. */}
      <g aria-hidden>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={VIZ.surface} strokeWidth={6 * ss} />
        <circle cx={cx} cy={cy} r={R + 3 * ss} fill="none" stroke={alpha(VIZ.ink, 0.45)} strokeWidth={1.3 * ss} />
      </g>
    </g>
  );
}

/* ---------- Diagrammet: energi per foton ---------- */

/** Søyle i lysets farge, med lys overkant og litt mørkere underkant (som et blankt bånd). */
function Bar({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('eks-foton-soyle');
  if (!(w > 0)) return null;
  return (
    <>
      <LinearGradient
        id={id}
        stops={[
          [0, tint(color, 0.45)],
          [0.45, color],
          [1, shade(color, 0.2)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} rx={4} fill={`url(#${id})`} stroke={shade(color, 0.45)} strokeWidth={0.9 * ss} />
    </>
  );
}

interface ChartGeom {
  x0: number;
  x1: number;
  headY: number;
  head2Y: number;
  /** Midten av søylen i rad i. */
  barY: (i: number) => number;
  /** Grunnlinja til navnet i rad i. */
  nameY: (i: number) => number;
  nameX: number;
  /** Midten av kolonnen med antall (PC) eller høyre kant (mobil). */
  nX: number;
  axisY: number;
}

function chartGeom(at: Pt & { w: number; wide: boolean }): ChartGeom {
  const { x, y, w, wide } = at;
  if (wide) {
    // Én overskriftslinje: grensen for DNA-skade står mellom de to overskriftene.
    const row = (i: number) => y + 52 + i * 36;
    return {
      x0: x + 236,
      x1: x + 636,
      headY: y + 18,
      head2Y: y + 18,
      barY: row,
      nameY: (i) => row(i) + 5,
      nameX: x + 34,
      nX: x + w - 92,
      axisY: row(2) + 26,
    };
  }
  const row = (i: number) => y + 72 + i * 50;
  return {
    x0: x + 14,
    x1: x + 314,
    headY: y + 18,
    head2Y: y + 42,
    barY: (i) => row(i) + 12,
    nameY: (i) => row(i) - 8,
    nameX: x + 30,
    nX: x + w - 10,
    axisY: row(2) + 34,
  };
}

function EnergyChart({ s, flags, at }: { s: PhotonSolution; flags: FotonFlags; at: Pt & { w: number; wide: boolean } }) {
  const ss = useStrokeScale();
  const g = chartGeom(at);
  const wide = at.wide;
  const maxEV = 5;
  const sx = (eV: number) => g.x0 + ((g.x1 - g.x0) * eV) / maxEV;
  const xt = sx(s.task.damageEV);
  const rows: { name: string; p: Photon; bar: 'off' | 'J' | 'eV'; N: boolean | null; extraE?: string; extraN?: string }[] = [
    { name: 'Rød laser', p: s.red, bar: flags.bars.red, N: flags.redCount },
    {
      name: 'Grønn laser',
      p: s.green,
      bar: flags.bars.green ? 'eV' : 'off',
      N: flags.greenPhotons,
      extraE: flags.compare ? ` (+${s.morePct} %)` : '',
      extraN: flags.compare ? ` (−${s.fewerPct} %)` : '',
    },
    { name: 'UV-B fra sola', p: s.uv, bar: flags.bars.uv ? 'eV' : 'off', N: null },
  ];
  const barH = 16;
  const top = g.barY(0) - 20;
  return (
    <g>
      {/* Overskriftene */}
      <Txt x={wide ? g.x0 : g.x0} y={g.headY} anchor="start" size={0.85} weight={700}>
        Energi per foton
      </Txt>
      <Txt x={g.nX} y={g.headY} anchor={wide ? 'middle' : 'end'} size={0.85} weight={700}>
        Fotoner per sekund
      </Txt>

      {/* Grensen for DNA-skade */}
      {flags.threshold && (
        <g>
          <rect x={xt} y={top} width={g.x1 - xt} height={g.axisY - top} fill={alpha(bolgelengdeFarge(s.uv.nm, false), 0.1)} />
          <line x1={xt} y1={top} x2={xt} y2={g.axisY} stroke={VIZ.ink} strokeWidth={1.6 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
          <Txt x={xt} y={g.head2Y} size={0.8} weight={700}>
            {`${fmt(s.task.damageEV, 1)} eV: nok til å skade DNA`}
          </Txt>
        </g>
      )}

      {rows.map((r, i) => {
        const c = bolgelengdeFarge(r.p.nm, false);
        const by = g.barY(i);
        const end = sx(r.p.eV);
        const value = r.bar === 'J' ? JText(r.p.E) : `${eVText(r.p.eV)}${r.extraE ?? ''}`;
        return (
          <g key={r.name}>
            <circle cx={g.nameX - 14} cy={g.nameY(i) - 5} r={5.5} fill={c} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
            <Txt x={g.nameX} y={g.nameY(i)} anchor="start" size={0.8} weight={600}>
              {`${r.name}, ${fmt(r.p.nm, 0)} nm`}
            </Txt>
            {/* Sporet og søylen */}
            <rect x={g.x0} y={by - barH / 2} width={g.x1 - g.x0} height={barH} rx={4} fill={alpha(VIZ.grid, 0.35)} />
            {r.bar !== 'off' ? (
              <>
                <Bar x={g.x0} y={by - barH / 2} w={end - g.x0} h={barH} color={c} />
                <Txt x={end + 8} y={by + 5} anchor="start" size={0.8} weight={700}>
                  {value}
                </Txt>
              </>
            ) : (
              <Txt x={g.x0 + 10} y={by + 5} anchor="start" size={0.8} weight={600} muted>
                ?
              </Txt>
            )}
            {r.N !== null && (
              <Txt x={g.nX} y={wide ? by + 5 : g.nameY(i)} anchor={wide ? 'middle' : 'end'} size={0.8} weight={r.N ? 700 : 600} muted={!r.N}>
                {r.N ? `${NText(r.p.N)}${r.extraN ?? ''}` : '?'}
              </Txt>
            )}
          </g>
        );
      })}

      {/* Aksen i elektronvolt (søylene står i samme skala fra første steg) */}
      <g>
        <line x1={g.x0} y1={g.axisY} x2={g.x1} y2={g.axisY} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={g.axisY} x2={sx(v)} y2={g.axisY + 5} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
            <Txt x={sx(v)} y={g.axisY + 21} size={0.75} muted>
              {v === maxEV ? `${v} eV` : String(v)}
            </Txt>
          </g>
        ))}
      </g>
      {flags.maxNm && (
        <Txt x={xt} y={g.axisY + 41} size={0.75} weight={700}>
          {`λ = ${fmt(s.maxNm, 0)} nm`}
        </Txt>
      )}
    </g>
  );
}
