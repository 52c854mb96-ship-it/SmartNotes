/**
 * Scene-kit: kjøretøy – bil, sykkel, akebrett, kjelke, dynamikkvogn fra fysikklaben, heis og berg-og-dal-vogn.
 *
 *   <Bil x={300} y={260} size={260} lakk="rod" hjulvinkel={hjulvinkelFraStrekning(s)} bremselys={bremser} />
 *   <Sykkel x={200} y={260} size={180} pedalvinkel={vinkel} />
 *   <Vogn x={250} y={200} size={140} stotfanger="fjaer" lodd={2} />
 *
 * Felles regler:
 * - Ankerpunktet (x, y) er midt på det gjenstanden står på (bakken, skinnen, gulvet), så den kan settes rett på et
 *   underlag. `rotate` (grader med klokka) dreier om ankerpunktet: på en bakke som stiger mot høyre med vinkelen α
 *   bruker du `rotate={-α}`.
 * - `size` er lengden i figurens enheter. Gjenstandene har ekte proporsjoner, så 1 m = size / (lengden i meter).
 * - Kjøretøyene kjører mot høyre. `flip` speilvender (kjører mot venstre).
 * - Bevegelige deler (hjul, pedaler, dører, fjær) styres med props. Ingen egne klokker: regn ut vinkelen fra
 *   strekningen i kapittelet (`hjulvinkelFraStrekning`).
 */
import type { ReactNode } from 'react';
import './kjoretoy.css';
import { ContactShadow, LinearGradient, Place, RadialGradient, SCENE_DIM, alpha, materialStops, mix, shade, tint, useStrokeScale, useSvgId, type SceneObjectProps } from './core';
import { SCENE, paint, type PaintName } from './palette';

/** Ekstra farger for kjøretøyene (kjoretoy.css). */
const KC = {
  window: 'var(--sc-kjoretoy-window)',
  windowSky: 'var(--sc-kjoretoy-window-sky)',
  tail: 'var(--sc-kjoretoy-tail)',
  brake: 'var(--sc-kjoretoy-brake)',
  headlight: 'var(--sc-kjoretoy-headlight)',
  beam: 'var(--sc-kjoretoy-beam)',
  trim: 'var(--sc-kjoretoy-trim)',
  rope: 'var(--sc-kjoretoy-rope)',
  seat: 'var(--sc-kjoretoy-seat)',
} as const;

/** Lakk: et navn fra PAINTS («rod», «blaa» …) eller en hvilken som helst CSS-farge (f.eks. SCENE.wood). */
type Lakk = PaintName | (string & {});

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Vinkel for rotate(): endelig og innenfor ±360, så transform-strengen holder seg kort i lange animasjoner. */
const turn = (deg: number | undefined) => r2(num(deg, 0) % 360);

/** Strektykkelse i lokale enheter når gruppen er skalert med k: `w` er tykkelsen i figurens enheter (før mobilfaktor). */
function useLocalStroke(k: number): (w: number) => number {
  const ss = useStrokeScale();
  return (w: number) => (w * ss) / k;
}

/** Eiker som kiler fra nav til felg (bilfelg), som én sti. Vinkel 0 = rett opp. */
function wedgeSpokes(n: number, r0: number, r1: number, w0: number, w1: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const p = (r: number, w: number) => `${r2(ux * r - uy * w)},${r2(uy * r + ux * w)}`;
    d += `M${p(r0, w0 / 2)}L${p(r1, w1 / 2)}L${p(r1, -w1 / 2)}L${p(r0, -w0 / 2)}Z`;
  }
  return d;
}

/** Krysslagte eiker (sykkelhjul): annenhver eike går litt fram og litt tilbake fra navet. */
function lacedSpokes(n: number, hub: number, rim: number, offset: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    const b = a + (i % 2 === 0 ? offset : -offset);
    d += `M${r2(hub * Math.cos(a))},${r2(hub * Math.sin(a))}L${r2(rim * Math.cos(b))},${r2(rim * Math.sin(b))}`;
  }
  return d;
}

/** Bue med radius r fra vinkel a0 til a1 (grader, med klokka fra +x), til høylys på dekk. */
function arcPath(r: number, a0: number, a1: number): string {
  const p = (a: number) => `${r2(r * Math.cos((a * Math.PI) / 180))},${r2(r * Math.sin((a * Math.PI) / 180))}`;
  return `M${p(a0)}A${r},${r} 0 0 1 ${p(a1)}`;
}

/* ================================================================================================
 * Bil
 * ============================================================================================== */

/**
 * Målene til bilen i meter (en vanlig kompaktbil). Bilen tegnes med disse proporsjonene, så
 * 1 m = size / BIL_MAAL.lengde i figuren.
 *   const pxPerM = size / BIL_MAAL.lengde;
 *   const front = x + BIL_MAAL.foran * pxPerM;          // støtfangeren foran
 *   const tp = { x, y: y - BIL_MAAL.tyngdepunkt * pxPerM }; // tyngdepunktet (G-pila)
 */
export const BIL_MAAL = {
  /** Lengde fra støtfanger til støtfanger. */
  lengde: 4.4,
  /** Høyde fra bakken til taket. */
  hoyde: 1.5,
  /** Hjulradius (dekket). */
  hjulradius: 0.32,
  /** Avstanden mellom akslingene. Ankerpunktet ligger midt mellom dem. */
  akselavstand: 2.7,
  /** Fra ankerpunktet fram til støtfangeren foran. */
  foran: 2.26,
  /** Fra ankerpunktet bak til støtfangeren bak. */
  bak: 2.14,
  /** Høyden til tyngdepunktet over bakken (rett over ankerpunktet). */
  tyngdepunkt: 0.55,
} as const;

/**
 * Hjulvinkelen (grader) etter at et hjul har rullet strekningen `s` (meter) uten å skli: s / r i radianer.
 * Gi resultatet til `hjulvinkel` på Bil, Sykkel eller Vogn, så ruller hjulene i takt med bevegelsen.
 *   <Bil x={x0 + s * pxPerM} y={260} size={240} hjulvinkel={hjulvinkelFraStrekning(s)} />
 *   <Sykkel … hjulvinkel={hjulvinkelFraStrekning(s, 0.34)} />   // sykkelhjulet har radius 0,34 m
 */
export function hjulvinkelFraStrekning(s: number, radius: number = BIL_MAAL.hjulradius): number {
  if (!Number.isFinite(s) || !(radius > 0)) return 0;
  return (s / radius) * (180 / Math.PI);
}

export interface BilProps extends SceneObjectProps {
  /** Lengden på bilen i figurens enheter (standard 240). Høyden blir 0,34 · size. */
  size?: number;
  /** Lakkfarge (standard «rod»). */
  lakk?: Lakk;
  /** Hvor langt hjulene har rotert (grader, med klokka = framover). Se `hjulvinkelFraStrekning`. */
  hjulvinkel?: number;
  /** Bremselysene lyser. */
  bremselys?: boolean;
  /** Frontlyktene er på, med en svak lyskjegle foran bilen. */
  frontlys?: boolean;
  /** Personbil (kombikupé) eller stasjonsvogn (langt tak og bratt bakluke). */
  type?: 'personbil' | 'stasjonsvogn';
}

// Bilen tegnes i centimeter med ankerpunktet midt mellom hjulene på bakken (y opp er negativ).
const CAR_LEN = 440;
const CAR_WHEEL_X = 135;
const CAR_R = 32;
const CAR_ARCHES = 'L-171,-20A38,38 0 1 1 -99,-20L99,-20A38,38 0 1 1 171,-20Z';
const CAR_FRONT = 'M212,-20C220,-22 226,-34 226,-50C226,-64 222,-72 212,-77C172,-86 112,-93 70,-97C46,-114 22,-140 -4,-147';
const CAR_BODY = {
  personbil: `${CAR_FRONT}C-44,-153 -96,-151 -128,-146C-152,-142 -178,-133 -197,-124L-203,-121C-209,-112 -213,-96 -214,-80L-214,-60C-214,-40 -213,-26 -206,-21${CAR_ARCHES}`,
  stasjonsvogn: `${CAR_FRONT}C-44,-153 -100,-152 -150,-148C-170,-146 -184,-143 -192,-138C-202,-120 -212,-90 -214,-62C-214,-40 -213,-26 -206,-21${CAR_ARCHES}`,
};
const CAR_DLO_FRONT = 'M62,-100C44,-116 22,-135 0,-140';
const CAR_DLO = {
  personbil: `${CAR_DLO_FRONT}C-40,-146 -92,-145 -120,-140C-134,-131 -148,-118 -157,-108C-159,-105 -158,-103 -154,-103Z`,
  stasjonsvogn: `${CAR_DLO_FRONT}C-40,-146 -100,-146 -150,-143C-166,-142 -178,-139 -184,-132L-191,-110C-192,-106 -190,-104 -186,-104Z`,
};
const CAR_DOORS = {
  personbil: 'M72,-97C86,-82 94,-62 95,-26M-26,-101L-28,-26M-154,-103C-150,-88 -134,-74 -114,-64',
  stasjonsvogn: 'M72,-97C86,-82 94,-62 95,-26M-26,-101L-28,-26M-117,-103C-116,-86 -114,-74 -110,-62',
};
const CAR_HANDLES = { personbil: [-12, -138], stasjonsvogn: [-12, -108] };
const CAR_TAIL = {
  personbil: 'M-204,-118C-196,-117 -186,-115 -178,-113C-176,-112 -176,-108 -178,-107.5C-190,-106 -202,-104 -211,-101C-210,-108 -208,-114 -204,-118Z',
  stasjonsvogn: 'M-196,-127C-200,-116 -205,-102 -208,-88L-202,-88C-200,-101 -196,-114 -190,-125Z',
};
/** Gløden rundt bremselyset: senter på lykta og radier [cx, cy, rx, ry]. */
const CAR_TAIL_GLOW = { personbil: [-195, -110, 16, 12], stasjonsvogn: [-200, -107, 11, 20] } as const;
const CAR_PILLARS = {
  personbil: 'M-22,-150L-31,-150L-32,-99L-23,-99Z',
  stasjonsvogn: 'M-22,-150L-31,-150L-32,-99L-23,-99ZM-113,-150L-123,-150L-121,-99L-111,-99Z',
};
const CAR_REFLECT = {
  personbil: 'M34,-98L49,-98L12,-144L-1,-144ZM55,-98L60,-98L22,-144L18,-144ZM-66,-98L-58,-98L-86,-148L-94,-148Z',
  stasjonsvogn: 'M34,-98L49,-98L12,-144L-1,-144ZM55,-98L60,-98L22,-144L18,-144ZM-66,-98L-58,-98L-86,-148L-94,-148ZM-150,-98L-145,-98L-165,-146L-170,-146Z',
};
const CAR_SPOKES = wedgeSpokes(5, 4.6, 17.8, 4.6, 8.6);

/**
 * Moderne personbil sett fra siden, som kjører mot høyre: lakk med lys og skygge, tonede ruter med refleks, felger,
 * dekk, dørlinjer og lykter. Ankerpunktet (x, y) er på bakken midt mellom hjulene. Målene står i `BIL_MAAL`.
 *   <Bil x={320} y={280} size={260} lakk="blaa" hjulvinkel={hjulvinkelFraStrekning(s)} bremselys />
 *   <Bil x={x} y={y} size={200} rotate={-12} />   // på en bakke som stiger 12° mot høyre
 */
export function Bil({ x, y, size = 240, lakk = 'rod', hjulvinkel = 0, bremselys = false, frontlys = false, type = 'personbil', rotate, flip, dim, title }: BilProps) {
  const k = Math.max(0.01, num(size, 240)) / CAR_LEN;
  const sw = useLocalStroke(k);
  const id = useSvgId('bil');
  const t = type === 'stasjonsvogn' ? 'stasjonsvogn' : 'personbil';
  const color = paint(lakk);
  const spin = turn(hjulvinkel);
  const [hx1, hx2] = CAR_HANDLES[t];
  const [gx, gy, grx, gry] = CAR_TAIL_GLOW[t];
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={4} cy={0} rx={226} ry={9} />
      <LinearGradient id={`${id}-lakk`} stops={materialStops(color, 1.15)} />
      <LinearGradient id={`${id}-glass`} stops={[[0, KC.windowSky], [0.5, KC.window], [1, shade(KC.window, 0.18)]]} />
      <RadialGradient id={`${id}-dekk`} stops={[[0.62, SCENE.rubberLight], [0.8, SCENE.rubber], [1, shade(SCENE.rubber, 0.25)]]} />
      <LinearGradient id={`${id}-felg`} x2={1} y2={1} stops={[[0, SCENE.metalLight], [0.55, SCENE.metal], [1, SCENE.metalDark]]} />
      {frontlys && (
        <>
          <LinearGradient id={`${id}-kjegle`} x2={1} y2={0} stops={[[0, KC.beam, 0.55], [1, KC.beam, 0]]} />
          <path d="M222,-73L430,-108L430,0L222,-61Z" fill={`url(#${id}-kjegle)`} />
        </>
      )}
      {/* Hjulbuene (mørke) bak karosseriet */}
      <path d={`M-171,-20A38,38 0 1 1 -99,-20ZM99,-20A38,38 0 1 1 171,-20Z`} fill={KC.trim} />
      <path d={CAR_BODY[t]} fill={`url(#${id}-lakk)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
      {/* Sidelist og luftinntak i svart plast */}
      <path d="M97,-27L-97,-27L-97,-20L97,-20ZM224,-41L198,-37L198,-31L222,-31Z" fill={KC.trim} opacity={0.88} />
      {/* Ruter med himmelrefleks, stolper og lysrefleks */}
      <clipPath id={`${id}-dlo`}>
        <path d={CAR_DLO[t]} />
      </clipPath>
      <path d={CAR_DLO[t]} fill={`url(#${id}-glass)`} stroke={shade(color, 0.45)} strokeWidth={sw(1.2)} strokeLinejoin="round" />
      <g clipPath={`url(#${id}-dlo)`}>
        <path d={CAR_PILLARS[t]} fill={KC.trim} />
        <path d={CAR_REFLECT[t]} fill={SCENE.highlight} opacity={0.7} />
      </g>
      {/* Dørlinjer, håndtak og høylys langs skulderen og taket */}
      <path d={CAR_DOORS[t]} fill="none" stroke={shade(color, 0.5)} strokeWidth={sw(0.9)} strokeLinecap="round" opacity={0.85} />
      <rect x={hx1} y={-93} width={14} height={3.4} rx={1.7} fill={shade(color, 0.32)} />
      <rect x={t === 'personbil' ? -186 : -176} y={-96} width={12} height={10} rx={3} fill="none" stroke={shade(color, 0.4)} strokeWidth={sw(0.7)} opacity={0.8} />
      <rect x={hx2} y={-93} width={14} height={3.4} rx={1.7} fill={shade(color, 0.32)} />
      <path
        d="M204,-76C150,-85 60,-90 -60,-92C-140,-93 -190,-93 -211,-89M-8,-145C-44,-150 -92,-149 -118,-143M206,-78.5C170,-86 112,-92 76,-96"
        fill="none"
        stroke={SCENE.highlight}
        strokeWidth={sw(1.5)}
        strokeLinecap="round"
      />
      {/* Speil */}
      <path d="M68,-99C69,-105 74,-108 83,-108C87.5,-108 89.5,-106 89,-102.5L87.6,-100C86.4,-98.6 82,-98.4 75,-98.4Z" fill={color} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      {/* Lykter */}
      <path d="M224,-66C218,-72 204,-76 184,-79L183,-74C200,-72 214,-68 222,-62Z" fill={frontlys ? SCENE.glow : KC.headlight} stroke={SCENE.outline} strokeWidth={sw(0.7)} strokeLinejoin="round" />
      <path d={CAR_TAIL[t]} fill={bremselys ? tint(KC.brake, 0.15) : KC.tail} stroke={SCENE.outline} strokeWidth={sw(0.7)} strokeLinejoin="round" />
      {frontlys && (
        <>
          <RadialGradient id={`${id}-front`} stops={[[0, KC.beam, 0.95], [0.4, KC.beam, 0.5], [1, KC.beam, 0]]} />
          <ellipse cx={214} cy={-71} rx={30} ry={20} fill={`url(#${id}-front)`} />
        </>
      )}
      {bremselys && (
        <>
          <RadialGradient id={`${id}-brems`} stops={[[0, KC.brake, 0.7], [0.4, KC.brake, 0.32], [0.8, KC.brake, 0]]} />
          <ellipse cx={gx} cy={gy} rx={grx} ry={gry} fill={`url(#${id}-brems)`} />
        </>
      )}
      {[-CAR_WHEEL_X, CAR_WHEEL_X].map((cx) => (
        <g key={cx} transform={`translate(${cx} ${-CAR_R})`}>
          <circle r={CAR_R} fill={`url(#${id}-dekk)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
          <path d={arcPath(CAR_R - 2.5, 195, 255)} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.2)} strokeLinecap="round" opacity={0.6} />
          <circle r={20.5} fill={`url(#${id}-felg)`} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={sw(0.8)} />
          <circle r={17.8} fill={shade(SCENE.metalDark, 0.4)} />
          <g transform={spin ? `rotate(${spin})` : undefined}>
            <path d={CAR_SPOKES} fill={tint(SCENE.metal, 0.15)} stroke={shade(SCENE.metalDark, 0.25)} strokeWidth={sw(0.5)} strokeLinejoin="round" />
            <circle r={5.2} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={sw(0.6)} />
          </g>
        </g>
      ))}
    </Place>
  );
}

/* ================================================================================================
 * Sykkel
 * ============================================================================================== */

// Sykkelen tegnes i centimeter: hjulradius 34, akselavstand 104, lengde 172 (hybridsykkel med 28-tommers hjul og
// 51 cm ramme). Setet står 21,6 cm bak og 59,8 cm over kranklageret (sadeltoppen ca. 0,88 m over bakken, et avslappet
// bysykkeloppsett), og håndtakene 6 cm over setet og 60 cm foran. Da når en Person på 1,75 m (pose 'sykle') pedalene
// i alle stillinger med litt bøy i kneet nederst.
const BIKE_LEN = 172;
const BIKE_R = 34;
const BIKE_AXLE = 52;
const BIKE_BB = { x: -10, y: -27 };
const BIKE_CRANK = 17.5;
const BIKE_SEAT = { x: -31.6, y: -86.8 };
const BIKE_BAR = { x: 28.3, y: -93.1 };
/** Høyden til rytteren som sykkelen er tilpasset (meter), og lengden på sykkelen (meter). */
const BIKE_RIDER_M = 1.75;
const BIKE_LEN_M = 1.72;
const BIKE_MAIN = 'M-10,-27L-23.9,-76.1L33.8,-84M37.7,-71.5L-10,-27';
const BIKE_STAYS = 'M-23.2,-73.4L-52,-34L-10,-27';
const BIKE_HEAD = 'M32.6,-88L38.4,-69.5';
const BIKE_FORK = 'M38.2,-70C40.5,-60 45,-44 52,-34';
/** Gaffelrøret over styrelageret og frempinnen skrått fram og opp til styreklemmen. */
const BIKE_STEM = 'M32.6,-88L31.9,-90.4L39.6,-92';
/** Styret fra klemmen bakover og litt opp til håndtaket. */
const BIKE_HANDLEBAR = 'M39.6,-92C37.6,-92.9 35,-93.2 31.6,-93.1';
const BIKE_GRIP = 'M32.1,-93.1L24.5,-93.1';
/** Setepinnen (langs setrøret) og salen. */
const BIKE_POST = 'M-23.9,-76.1L-26,-83.5';
const BIKE_SADDLE =
  'M-43.6,-84.8C-43.6,-88.3 -37.6,-89 -29.6,-87.8L-16.6,-85.6C-14.2,-85.1 -14.2,-83.1 -16.6,-82.8L-29.6,-81.8C-37.6,-81.2 -43.6,-81.4 -43.6,-84.8Z';
const BIKE_SADDLE_SHINE = 'M-40.6,-86.4C-35.6,-87.6 -28.6,-87.2 -20.6,-85.4';
const BIKE_SPOKES = lacedSpokes(18, 2.6, 29.6, 0.42);
const BIKE_CHAIN = 'M-10,-36.6L-52,-38.7A4.7,4.7 0 0 0 -52,-29.3L-10,-17.4A9.6,9.6 0 0 0 -10,-36.6Z';

function pedalPoint(vinkel: number, far: boolean): { x: number; y: number } {
  const a = ((num(vinkel, 0) + (far ? 180 : 0)) * Math.PI) / 180;
  return { x: BIKE_BB.x + BIKE_CRANK * Math.cos(a), y: BIKE_BB.y + BIKE_CRANK * Math.sin(a) };
}

/** Et punkt i figuren (eller i forhold til ankerpunktet). */
type Punkt = { x: number; y: number };

export interface SykkelPunkter {
  /** Toppen av setet, der rytteren sitter. */
  sete: Punkt;
  /** Midt på håndtaket på styret. */
  styre: Punkt;
  /** Kranklageret (midten pedalene går rundt). */
  pedalNav: Punkt;
  /** Pedalen på den bortre siden (venstre fot når sykkelen kjører mot høyre). */
  venstrePedal: (pedalvinkel: number) => Punkt;
  /** Pedalen på den nære siden (høyre fot), samme vinkel som `pedalvinkel` på Sykkel. */
  hoyrePedal: (pedalvinkel: number) => Punkt;
  /** Navene på hjulene. */
  bakhjul: Punkt;
  forhjul: Punkt;
  /** Hjulradius i figurens enheter. */
  hjulradius: number;
  /** `size` til en Person på 1,75 m som passer på sykkelen (samme skala, 1 m = size / 1,72). */
  rytterHoyde: number;
}

/**
 * Punktene på sykkelen der en person skal sitte og ha hendene og føttene, så en figur kan settes på sykkelen.
 * Uten `plass` er punktene relative til ankerpunktet (bakken midt mellom hjulene) for en sykkel som kjører mot høyre.
 * Med `plass` (samme x, y, rotate og flip som på Sykkel) er de i figurens koordinater.
 *   const p = sykkelPunkter(180, { x: 300, y: 260, rotate: -8 });
 *   <Sykkel x={300} y={260} size={180} rotate={-8} pedalvinkel={v} />
 *   <Person x={p.sete.x} y={p.sete.y} size={p.rytterHoyde} rotate={-8} pose="sykle" fase={v / 360}
 *     fest={{ venstreHand: p.styre, hoyreHand: p.styre, venstreFot: p.venstrePedal(v), hoyreFot: p.hoyrePedal(v) }} />
 * Gi Person samme `rotate` og `flip` som sykkelen. `fase` på Person er pedalvinkel / 360 (begge har 0 = den nære
 * pedalen rett fram og 90° / 0,25 = nederst). Sykkelen er tilpasset en rytter på 1,75 m (`rytterHoyde`): da står
 * føttene på pedalene i alle stillinger.
 */
export function sykkelPunkter(size: number, plass?: { x?: number; y?: number; rotate?: number; flip?: boolean }): SykkelPunkter {
  const k = Math.max(0, num(size, 0)) / BIKE_LEN;
  const px = num(plass?.x, 0);
  const py = num(plass?.y, 0);
  const a = (num(plass?.rotate, 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const fl = plass?.flip ? -1 : 1;
  const map = (p: Punkt): Punkt => {
    const lx = p.x * fl * k;
    const ly = p.y * k;
    return { x: r2(px + lx * c - ly * s), y: r2(py + lx * s + ly * c) };
  };
  return {
    sete: map(BIKE_SEAT),
    styre: map(BIKE_BAR),
    pedalNav: map(BIKE_BB),
    venstrePedal: (v) => map(pedalPoint(v, true)),
    hoyrePedal: (v) => map(pedalPoint(v, false)),
    bakhjul: map({ x: -BIKE_AXLE, y: -BIKE_R }),
    forhjul: map({ x: BIKE_AXLE, y: -BIKE_R }),
    hjulradius: r2(BIKE_R * k),
    rytterHoyde: r2((BIKE_RIDER_M / BIKE_LEN_M) * BIKE_LEN * k),
  };
}

export interface SykkelProps extends SceneObjectProps {
  /** Total lengde fra bakhjulet til forhjulet (akselavstand + hjul) i figurens enheter (standard 180). 1 m = size / 1,72; setet er 0,5 · size over bakken. */
  size?: number;
  /** Rammefarge (standard «blaa»). */
  lakk?: Lakk;
  /** Hvor langt hjulene har rotert (grader, med klokka = framover). Hjulradius 0,34 m. */
  hjulvinkel?: number;
  /** Krankvinkelen (grader, med klokka = tråkke framover). 0 = høyre (nære) pedal rett fram, venstre rett bak. */
  pedalvinkel?: number;
}

function BikeWheel({ cx, spin, sw }: { cx: number; spin: number; sw: (w: number) => number }) {
  return (
    <g transform={`translate(${cx} ${-BIKE_R})`}>
      <circle r={BIKE_R - 1.8} fill="none" stroke={SCENE.rubber} strokeWidth={3.6} />
      <circle r={BIKE_R + 0.2} fill="none" stroke={SCENE.outline} strokeWidth={sw(0.8)} />
      <path d={arcPath(BIKE_R - 1.6, 198, 252)} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1)} strokeLinecap="round" opacity={0.7} />
      <circle r={BIKE_R - 4.4} fill="none" stroke={SCENE.metal} strokeWidth={Math.max(1.8, sw(1.1))} />
      <g transform={spin ? `rotate(${spin})` : undefined}>
        <path d={BIKE_SPOKES} stroke={SCENE.metal} strokeWidth={sw(0.45)} opacity={0.9} />
        <rect x={-1.4} y={-24} width={2.8} height={7.5} rx={1.2} fill={SCENE.warm} stroke={SCENE.outline} strokeWidth={sw(0.4)} />
      </g>
      <circle r={3.2} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={sw(0.6)} />
    </g>
  );
}

/** Rør i rammen: kontur, lakk og et smalt høylys oppå (lys fra øvre venstre). */
function Tube({ d, w, color, sw }: { d: string; w: number; color: string; sw: (w: number) => number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={SCENE.outline} strokeWidth={w + sw(1.3)} />
      <path d={d} stroke={color} strokeWidth={w} />
      <path d={d} stroke={SCENE.highlight} strokeWidth={w * 0.28} transform={`translate(${-w * 0.16} ${-w * 0.22})`} />
    </g>
  );
}

/**
 * Sykkel (hybridsykkel med 28-tommers hjul) sett fra siden, som kjører mot høyre: ramme i lakk, krysslagte eiker
 * med refleks, kjede og pedaler. Ankerpunktet (x, y) er på bakken midt mellom hjulene. Bruk `sykkelPunkter` for å
 * sette en person på setet med hendene på styret og føttene på pedalene.
 *   <Sykkel x={300} y={260} size={180} hjulvinkel={hjulvinkelFraStrekning(s, 0.34)} pedalvinkel={v} />
 */
export function Sykkel({ x, y, size = 180, lakk = 'blaa', hjulvinkel = 0, pedalvinkel = 0, rotate, flip, dim, title }: SykkelProps) {
  const k = Math.max(0.01, num(size, 180)) / BIKE_LEN;
  const sw = useLocalStroke(k);
  const color = paint(lakk);
  const spin = turn(hjulvinkel);
  const near = pedalPoint(pedalvinkel, false);
  const far = pedalPoint(pedalvinkel, true);
  const metalW = Math.max(2.2, sw(1.4));
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={0} cy={0} rx={86} ry={4.5} />
      <BikeWheel cx={-BIKE_AXLE} spin={spin} sw={sw} />
      <BikeWheel cx={BIKE_AXLE} spin={spin} sw={sw} />
      {/* Den bortre pedalen bak rammen */}
      <line x1={BIKE_BB.x} y1={BIKE_BB.y} x2={far.x} y2={far.y} stroke={SCENE.metalDark} strokeWidth={metalW * 1.1} strokeLinecap="round" />
      <rect x={far.x - 4.5} y={far.y - 1.4} width={9} height={2.8} rx={1} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
      <path d={BIKE_CHAIN} fill="none" stroke={SCENE.metalDark} strokeWidth={Math.max(1.3, sw(0.9))} strokeLinejoin="round" />
      <circle cx={-BIKE_AXLE} cy={-BIKE_R} r={4.6} fill="none" stroke={SCENE.metal} strokeWidth={1.4} />
      <Tube d={BIKE_STAYS} w={2.2} color={color} sw={sw} />
      <Tube d={BIKE_MAIN} w={3.6} color={color} sw={sw} />
      <Tube d={BIKE_HEAD} w={4.6} color={shade(color, 0.12)} sw={sw} />
      <Tube d={BIKE_FORK} w={2.8} color={color} sw={sw} />
      {/* Setepinne og sete */}
      <Tube d={BIKE_POST} w={2.4} color={SCENE.metal} sw={sw} />
      <path d={BIKE_SADDLE} fill={SCENE.rubberLight} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      <path d={BIKE_SADDLE_SHINE} fill="none" stroke={SCENE.highlight} strokeWidth={sw(0.9)} strokeLinecap="round" />
      {/* Frempinne, styre og håndtak */}
      <Tube d={BIKE_STEM} w={2.8} color={SCENE.metalDark} sw={sw} />
      <Tube d={BIKE_HANDLEBAR} w={2.2} color={SCENE.metalDark} sw={sw} />
      <path d={BIKE_GRIP} stroke={SCENE.outline} strokeWidth={3.6 + sw(1.2)} strokeLinecap="round" />
      <path d={BIKE_GRIP} stroke={SCENE.rubberLight} strokeWidth={3.6} strokeLinecap="round" />
      {/* Krankdrev og den nære pedalen */}
      <circle cx={BIKE_BB.x} cy={BIKE_BB.y} r={9.6} fill={alpha(SCENE.metalDark, 0.35)} stroke={SCENE.metal} strokeWidth={1.8} />
      <line x1={BIKE_BB.x} y1={BIKE_BB.y} x2={near.x} y2={near.y} stroke={SCENE.metalLight} strokeWidth={metalW * 1.15} strokeLinecap="round" />
      <line x1={BIKE_BB.x} y1={BIKE_BB.y} x2={near.x} y2={near.y} stroke={SCENE.outline} strokeWidth={sw(0.5)} strokeLinecap="round" opacity={0.6} />
      <rect x={near.x - 4.8} y={near.y - 1.5} width={9.6} height={3} rx={1} fill={SCENE.rubberLight} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
      <circle cx={BIKE_BB.x} cy={BIKE_BB.y} r={2.6} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={sw(0.6)} />
    </Place>
  );
}

/* ================================================================================================
 * Akebrett og kjelke
 * ============================================================================================== */

export interface AkebrettProps extends SceneObjectProps {
  /**
   * Lengden på brettet i figurens enheter (standard 80). Brettet er 0,8 m langt og 0,15 m høyt (nesa 0,28 m). Den flate
   * bunnen går fra 0,3 · size bak til 0,3 · size foran ankerpunktet, og bunnen inni ligger ca. 0,04 · size over bakken.
   */
  size?: number;
  /** Plastfarge (standard «rod»). */
  lakk?: Lakk;
  /** Tauet foran (standard på). */
  tau?: boolean;
}

/**
 * Akebrett i plast (rumpebrett med bøyd nese og grep i siden) sett fra siden, nesa mot høyre.
 * Ankerpunktet (x, y) er midt under den flate bunnen, på snøen. Nesa stikker 0,62 · size fram og bakkanten 0,38 · size bak.
 *   <Akebrett x={x} y={y} size={90} rotate={20} lakk="blaa" />    // i en bakke som går 20° ned mot høyre
 */
export function Akebrett({ x, y, size = 80, lakk = 'rod', tau = true, rotate, flip, dim, title }: AkebrettProps) {
  const k = Math.max(0.01, num(size, 80)) / 80;
  const sw = useLocalStroke(k);
  const id = useSvgId('akebrett');
  const color = paint(lakk);
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={4} cy={0} rx={38} ry={2.8} />
      <LinearGradient id={id} stops={[[0, tint(color, 0.32)], [0.4, color], [1, shade(color, 0.3)]]} />
      {tau && <path d="M44,-24C56,-26 62,-14 59,-6C57.4,-0.6 63,0.4 70,0" fill="none" stroke={KC.rope} strokeWidth={Math.max(1.4, sw(1.2))} strokeLinecap="round" />}
      {/* Innsiden av den bortre sideveggen, sett litt ovenfra */}
      <path d="M-27,-14C-27,-17 -25.6,-19 -23,-19L28,-19C32,-19 35.4,-20.6 38,-23.4L32,-16.6C30,-15.4 28,-15 25,-15Z" fill={shade(color, 0.38)} stroke={SCENE.outline} strokeWidth={sw(0.7)} strokeLinejoin="round" />
      <path
        d="M-24,0L26,0C36,0 43,-5 47,-13C49.5,-18 50,-23 47.6,-26C46,-28 42.4,-28.4 40.6,-26.4C38.6,-24.2 37,-19.6 32,-16.6C30,-15.4 28,-15 25,-15L-24,-15C-27.6,-15 -30,-13 -30,-10L-30,-5C-30,-2 -27.6,0 -24,0Z"
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={sw(1)}
        strokeLinejoin="round"
      />
      {/* Grep i sideveggen, hull til tauet og høylys langs kanten og nesa */}
      <rect x={-21} y={-10.6} width={11} height={3.6} rx={1.8} fill={shade(color, 0.55)} />
      <rect x={5} y={-10.6} width={11} height={3.6} rx={1.8} fill={shade(color, 0.55)} />
      <path d="M-25,-13.4L25,-13.4C29,-13.6 32,-15 34.4,-17.6M48.4,-21.6C47.8,-15 44.4,-8.4 38.6,-4.4" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.2)} strokeLinecap="round" />
      <circle cx={43.8} cy={-24.2} r={1.5} fill={shade(color, 0.6)} />
    </Place>
  );
}

export interface KjelkeProps extends SceneObjectProps {
  /** Lengden på kjelken i figurens enheter (standard 90). Kjelken er 0,9 m lang og 0,32 m høy til oversiden av setet. */
  size?: number;
  /** Tauet foran (standard på). */
  tau?: boolean;
}

/**
 * Tradisjonell trekjelke med meier (med stålskinne under), tre stolper og sete av tre, sett fra siden med
 * fronten mot høyre. Ankerpunktet (x, y) er midt under den flate delen av meien, på snøen. Midten av setet ligger
 * rett over, 0,36 · size over bakken, og setet er 0,9 · size langt. Den bøyde fronten stikker 0,6 · size fram.
 *   <Kjelke x={x} y={y} size={110} rotate={15} />    // i en bakke som går 15° ned mot høyre
 */
export function Kjelke({ x, y, size = 90, tau = true, rotate, flip, dim, title }: KjelkeProps) {
  const k = Math.max(0.01, num(size, 90)) / 90;
  const sw = useLocalStroke(k);
  const id = useSvgId('kjelke');
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={2} cy={0} rx={46} ry={2.8} />
      <LinearGradient id={`${id}-sete`} stops={materialStops(SCENE.woodLight, 1.2)} />
      <LinearGradient id={`${id}-tre`} x2={1} y2={0} stops={[[0, tint(SCENE.wood, 0.15)], [1, shade(SCENE.wood, 0.2)]]} />
      {tau && <path d="M49.5,-25C59.5,-24 63.5,-12 61.5,-5C60.5,-0.5 65.5,0.4 73.5,0" fill="none" stroke={KC.rope} strokeWidth={Math.max(1.4, sw(1.2))} strokeLinecap="round" />}
      {/* Stolper mellom meien og setet */}
      <path d="M-30.5,-4L-26.5,-4L-27.1,-27L-30.1,-27ZM-0.5,-4L3.5,-4L2.9,-27L-0.1,-27ZM28.5,-4L32.5,-4L31.9,-27L28.9,-27Z" fill={`url(#${id}-tre)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      {/* Meien med bøyd front */}
      <path
        d="M-35.5,0L37.5,0C47.5,0 54,-6 54,-16C54,-24 49,-30 42,-30.5L41.3,-26.6C46.3,-26.2 49.9,-22 49.9,-16C49.9,-9 45.1,-4 37.5,-4L-35.5,-4C-36.9,-4 -37.5,-3 -37.5,-2C-37.5,-0.8 -36.7,0 -35.5,0Z"
        fill={SCENE.wood}
        stroke={SCENE.outline}
        strokeWidth={sw(0.9)}
        strokeLinejoin="round"
      />
      <path d="M-36.5,0.2L37.5,0.2C47.5,0.2 54.1,-6 54.2,-14" fill="none" stroke={SCENE.metalLight} strokeWidth={Math.max(1.2, sw(1.1))} strokeLinecap="round" />
      <path d="M-34.5,-3.2L37.5,-3.2" fill="none" stroke={SCENE.highlight} strokeWidth={sw(0.8)} strokeLinecap="round" />
      {/* Setet */}
      <rect x={-40.5} y={-32} width={82} height={5.4} rx={1.6} fill={`url(#${id}-sete)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
      <path d="M-34.5,-29.6C-14.5,-30.4 5.5,-28.6 19.5,-29.6M-0.5,-28.2C13.5,-28.6 25.5,-28 35.5,-28.8" fill="none" stroke={shade(SCENE.wood, 0.15)} strokeWidth={sw(0.5)} strokeLinecap="round" opacity={0.7} />
      <path d="M-38.5,-31.2L39.5,-31.2" stroke={SCENE.highlight} strokeWidth={sw(0.8)} strokeLinecap="round" />
    </Place>
  );
}

/* ================================================================================================
 * Dynamikkvogn
 * ============================================================================================== */

export interface VognProps extends SceneObjectProps {
  /** Lengden på vogna (uten støtfanger) i figurens enheter (standard 140). Vogna er 0,2 m lang og 0,062 m høy (0,31 · size). */
  size?: number;
  /** Farge på vogna (standard «blaa»; bruk f.eks. «rod» på den andre vogna i et støtforsøk). */
  lakk?: Lakk;
  /** Støtfanger: fjær (elastisk støt), borrelås (vognene henger sammen etter støtet) eller ingen. */
  stotfanger?: 'fjaer' | 'borrelaas' | 'ingen';
  /** Hvilken ende støtfangeren sitter på (standard høyre, fronten når vogna kjører mot høyre). */
  side?: 'venstre' | 'hoyre' | 'begge';
  /** Antall ekstra lodd oppå vogna (0–3). */
  lodd?: number;
  /** Hvor langt hjulene har rotert (grader, med klokka = framover). Hjulradius 0,014 m. */
  hjulvinkel?: number;
  /** Hvor mye fjæra er trykt sammen (0 = slakk, 1 = helt sammen), f.eks. under støtet. */
  sammentrykk?: number;
}

// Vogna tegnes i millimeter: lengde 200, kropp 36 høy, hjul med radius 14 ved x = ±66, støtfangeren midt på enden.
const CART_LEN = 200;
const CART_R = 14;
const CART_WHEEL_X = 66;
const CART_MID = -40;
const CART_WHEEL_HOLES = wedgeSpokes(3, 3.8, 9.4, 3.8, 5.6);

function cartBumper(kind: 'fjaer' | 'borrelaas', dir: 1 | -1, squeeze: number, sw: (w: number) => number): ReactNode {
  const face = 101 * dir;
  if (kind === 'borrelaas') {
    // Puten med kroker: flat mot vogna, ru (sagtann) ytterst
    let d = `M${face},${CART_MID - 14}L${face + 5 * dir},${CART_MID - 14}`;
    for (let i = 0; i < 14; i++) d += `L${face + (i % 2 === 0 ? 8.2 : 5.6) * dir},${r2(CART_MID - 13 + i * 2)}`;
    d += `L${face + 5 * dir},${CART_MID + 14}L${face},${CART_MID + 14}Z`;
    return <path key={dir} d={d} fill={KC.trim} stroke={SCENE.outline} strokeWidth={sw(0.6)} strokeLinejoin="round" />;
  }
  const len = 30 * (1 - 0.72 * clamp(num(squeeze, 0), 0, 1));
  const tip = face + len * dir;
  const coils = 7;
  let d = `M${face},${CART_MID}`;
  for (let i = 0; i < coils * 2; i++) {
    const cx = face + ((i + 0.5) / (coils * 2)) * (len - 3) * dir;
    d += `L${r2(cx)},${CART_MID + (i % 2 === 0 ? -6.5 : 6.5)}`;
  }
  d += `L${r2(tip - 3 * dir)},${CART_MID}`;
  return (
    <g key={dir}>
      <line x1={face} y1={CART_MID} x2={tip} y2={CART_MID} stroke={SCENE.metalDark} strokeWidth={2} />
      <path d={d} fill="none" stroke={SCENE.metal} strokeWidth={Math.max(1.6, sw(0.9))} strokeLinejoin="round" />
      <rect x={dir > 0 ? tip - 3.4 : tip} y={CART_MID - 11} width={3.4} height={22} rx={1.4} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
    </g>
  );
}

/**
 * Dynamikkvogn fra fysikklaben (lav vogn med fire små hjul) sett fra siden, som i støtforsøk på en bane.
 * Ankerpunktet (x, y) er på banen midt mellom hjulene. Støtfangeren sitter midt på enden, 0,2 · size over banen.
 * Fjæra stikker ca. 0,15 · size ut fra enden (mindre med `sammentrykk`), borrelåsen ca. 0,04 · size.
 *   <Vogn x={xA} y={260} size={140} lakk="rod" stotfanger="fjaer" lodd={1} />
 *   <Vogn x={xB} y={260} size={140} stotfanger="borrelaas" side="venstre" />
 */
export function Vogn({
  x,
  y,
  size = 140,
  lakk = 'blaa',
  stotfanger = 'fjaer',
  side = 'hoyre',
  lodd = 0,
  hjulvinkel = 0,
  sammentrykk = 0,
  rotate,
  flip,
  dim,
  title,
}: VognProps) {
  const k = Math.max(0.01, num(size, 140)) / CART_LEN;
  const sw = useLocalStroke(k);
  const id = useSvgId('vogn');
  const color = paint(lakk);
  const spin = turn(hjulvinkel);
  const n = clamp(Math.round(num(lodd, 0)), 0, 3);
  const ends: (1 | -1)[] = side === 'begge' ? [-1, 1] : side === 'venstre' ? [-1] : [1];
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={0} cy={0} rx={98} ry={4} />
      <LinearGradient id={`${id}-lakk`} stops={materialStops(color, 1.2)} />
      <LinearGradient id={`${id}-metall`} stops={[[0, SCENE.metalLight], [0.6, SCENE.metal], [1, SCENE.metalDark]]} />
      {stotfanger !== 'ingen' && ends.map((dir) => cartBumper(stotfanger === 'borrelaas' ? 'borrelaas' : 'fjaer', dir, sammentrykk, sw))}
      {/* Lodd oppå */}
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={-62} y={-74 - i * 12.4} width={124} height={12} rx={2} fill={`url(#${id}-metall)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
          <line x1={-58} y1={-72.4 - i * 12.4} x2={58} y2={-72.4 - i * 12.4} stroke={SCENE.highlight} strokeWidth={sw(0.8)} strokeLinecap="round" />
        </g>
      ))}
      {/* Kropp med toppskinne, spor i siden og endestykker */}
      <rect x={-96} y={-62} width={192} height={5.4} rx={1.6} fill={`url(#${id}-metall)`} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      <rect x={-100} y={-58} width={200} height={36} rx={6} fill={`url(#${id}-lakk)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
      <rect x={-86} y={-45} width={172} height={6} rx={3} fill={shade(color, 0.35)} />
      <path d="M-94,-55.4L94,-55.4" stroke={SCENE.highlight} strokeWidth={sw(1.1)} strokeLinecap="round" />
      <path d="M-101,-56L-95,-56L-95,-24L-101,-24ZM101,-56L95,-56L95,-24L101,-24Z" fill={KC.trim} opacity={0.9} />
      {[-CART_WHEEL_X, CART_WHEEL_X].map((cx) => (
        <g key={cx} transform={`translate(${cx} ${-CART_R})`}>
          <circle r={CART_R} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
          <circle r={10.2} fill={SCENE.plastic} stroke={shade(SCENE.plasticShade, 0.2)} strokeWidth={sw(0.5)} />
          <path d={CART_WHEEL_HOLES} fill={shade(SCENE.plasticShade, 0.5)} transform={spin ? `rotate(${spin})` : undefined} />
          <circle r={2.6} fill={SCENE.metalDark} />
          <path d={arcPath(CART_R - 1.7, 200, 250)} fill="none" stroke={SCENE.highlight} strokeWidth={sw(0.9)} strokeLinecap="round" />
        </g>
      ))}
    </Place>
  );
}

/* ================================================================================================
 * Heis
 * ============================================================================================== */

export interface HeisProps {
  /** Midt på gulvet inne i heisen, der personer og ting står. */
  x: number;
  y: number;
  /** Innvendig bredde i figurens enheter (standard 150). */
  w?: number;
  /** Innvendig høyde fra gulv til tak (standard 210). */
  h?: number;
  /** Dørene foran: 0 = lukket, 1 = helt åpne (standard). */
  dorer?: number;
  /** Stålvaierne over heisen (standard på). */
  tau?: boolean;
  /** Hvor høyt vaierne går (y i figuren, standard 0 = toppen av en viewBox som starter på 0). */
  tauTopp?: number;
  /** Ton ned heisen. */
  dim?: boolean;
  /** Tekst for skjermlesere. */
  title?: string;
  /** Det som står i heisen (person, badevekt). Tegnes foran bakveggen og bak dørene, i figurens koordinater. */
  children?: ReactNode;
}

/**
 * Heisstol sett forfra i snitt, så man ser inn: bakvegg med gelender, sidevegger, tak med lys, gulv, ramme,
 * skyvedører og stålvaiere over. (x, y) er midt på gulvet, der en person eller en badevekt settes. Vaierne er
 * festet midt på toppen, i (x, y − h − 0,08 · w): der virker snordraget S.
 *   <Heis x={300} y={y} w={160} h={220}>
 *     <Badevekt x={300} y={y} … />
 *     <Person x={300} y={y - 12} … />
 *   </Heis>
 */
export function Heis({ x, y, w = 150, h = 210, dorer = 1, tau = true, tauTopp = 0, dim, title, children }: HeisProps) {
  const ss = useStrokeScale();
  const id = useSvgId('heis');
  const W = Math.max(20, num(w, 150));
  const H = Math.max(20, num(h, 210));
  const e = W * 0.08;
  const t = W * 0.05;
  const L = x - W / 2;
  const R = x + W / 2;
  const yF = y + e / 2;
  const yB = y - e / 2;
  const yC = yF - H;
  const yBT = yC + e;
  const top = yC - 2.4 * t;
  const open = clamp(num(dorer, 1), 0, 1);
  const rail = yB - (yB - yBT) * 0.42;
  const cables = [-0.45, 0, 0.45].map((f) => r2(x + f * t));
  const ropeTop = num(tauTopp, 0);
  const pts = (...p: number[]) => p.map(r2).join(' ');
  return (
    <g opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}-ramme`} x2={1} y2={0} stops={[[0, tint(SCENE.metalDark, 0.18)], [0.5, SCENE.metalDark], [1, shade(SCENE.metalDark, 0.25)]]} />
      <LinearGradient id={`${id}-vegg`} stops={[[0, mix(SCENE.wall, SCENE.metalLight, 0.5)], [1, mix(SCENE.wallShade, SCENE.metal, 0.5)]]} />
      <LinearGradient id={`${id}-side`} x2={1} y2={0} stops={materialStops(SCENE.metal, 0.8)} />
      <LinearGradient id={`${id}-gulv`} stops={[[0, SCENE.stoneDark], [1, SCENE.stone]]} />
      {tau && ropeTop < top && (
        <g strokeLinecap="round">
          <path d={cables.map((c) => `M${c},${r2(ropeTop)}L${c},${r2(top)}`).join('')} stroke={SCENE.outline} strokeWidth={2.6 * ss} />
          <path d={cables.map((c) => `M${c},${r2(ropeTop)}L${c},${r2(top)}`).join('')} stroke={SCENE.metal} strokeWidth={1.4 * ss} />
        </g>
      )}
      {/* Åk over taket og selve stolen */}
      <rect x={x - W * 0.3} y={top} width={W * 0.6} height={1.6 * t} rx={t * 0.3} fill={`url(#${id}-ramme)`} stroke={SCENE.outline} strokeWidth={ss} />
      <rect x={x - t * 0.9} y={top - t * 0.2} width={t * 1.8} height={t * 0.9} rx={t * 0.3} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={ss} />
      <rect x={L - t} y={yC - t} width={W + 2 * t} height={H + 2.1 * t} rx={t * 0.4} fill={`url(#${id}-ramme)`} stroke={SCENE.outline} strokeWidth={ss} />
      {/* Innsiden i perspektiv: tak, bakvegg, sidevegger og gulv */}
      <polygon points={pts(L, yC, R, yC, R - e, yBT, L + e, yBT)} fill={mix(SCENE.wallShade, SCENE.metal, 0.35)} />
      <rect x={x - W * 0.26} y={yC + e * 0.3} width={W * 0.52} height={e * 0.4} rx={e * 0.2} fill={SCENE.glow} opacity={0.9} />
      <rect x={L + e} y={yBT} width={W - 2 * e} height={yB - yBT} fill={`url(#${id}-vegg)`} />
      <path
        d={`M${r2(L + e + (W - 2 * e) / 3)},${r2(yBT)}V${r2(yB)}M${r2(L + e + ((W - 2 * e) * 2) / 3)},${r2(yBT)}V${r2(yB)}`}
        stroke={SCENE.wallShade}
        strokeWidth={1.2 * ss}
      />
      <polygon points={pts(L, yC, L + e, yBT, L + e, yB, L, yF)} fill={`url(#${id}-side)`} />
      <polygon points={pts(R, yC, R - e, yBT, R - e, yB, R, yF)} fill={shade(SCENE.metal, 0.15)} />
      <polygon points={pts(L, yF, R, yF, R - e, yB, L + e, yB)} fill={`url(#${id}-gulv)`} />
      <path d={`M${r2(L + e + 6)},${r2(rail)}H${r2(R - e - 6)}`} stroke={SCENE.metalDark} strokeWidth={3.4 * ss} strokeLinecap="round" />
      <path d={`M${r2(L + e + 6)},${r2(rail - 0.6 * ss)}H${r2(R - e - 6)}`} stroke={SCENE.metalLight} strokeWidth={1.3 * ss} strokeLinecap="round" />
      <rect x={L} y={yF - 1.2 * ss} width={W} height={3 * ss} fill={SCENE.metal} />
      {children}
      {/* Skyvedørene glir inn bak rammen */}
      {open < 1 && (
        <>
          <clipPath id={`${id}-apning`}>
            <rect x={L} y={yC} width={W} height={yF - yC} />
          </clipPath>
          <LinearGradient id={`${id}-dor`} x2={1} y2={0} stops={[[0, SCENE.metalLight], [0.7, SCENE.metal], [1, shade(SCENE.metal, 0.1)]]} />
          <g clipPath={`url(#${id}-apning)`} stroke={SCENE.outline} strokeWidth={ss}>
            <rect x={L - (W / 2) * open} y={yC} width={W / 2} height={yF - yC} fill={`url(#${id}-dor)`} />
            <rect x={x + (W / 2) * open} y={yC} width={W / 2} height={yF - yC} fill={`url(#${id}-dor)`} />
          </g>
        </>
      )}
      <rect x={L} y={yC} width={W} height={yF - yC} fill="none" stroke={SCENE.outline} strokeWidth={ss} />
    </g>
  );
}

/* ================================================================================================
 * Berg-og-dal-vogn
 * ============================================================================================== */

export interface BergbanevognProps extends SceneObjectProps {
  /**
   * Lengden på vogna i figurens enheter (standard 160). Vogna er 2,0 m lang og 1,1 m høy over skinnen.
   * Uten `krumning` er vogna stiv: hold da size under ca. R / 3 (R = krumningsradien til banen), ellers synker
   * hjulene inn i skinna i en dal og løfter seg over en topp.
   */
  size?: number;
  /** Lakkfarge (standard «gul»). */
  lakk?: Lakk;
  /** Tykkelsen på skinnen du tegner (figurens enheter, standard 0,07 · size). Opp-stopphjulene ruller under den. */
  skinne?: number;
  /** Hvor langt hjulene har rotert (grader, med klokka = framover). Kjørehjulet har radius 0,11 m: hjulvinkelFraStrekning(s, 0.11). */
  hjulvinkel?: number;
  /**
   * Krumningen til skinna under vogna, 1 / R i figurens enheter: positiv i en dal (banen bøyer oppover), negativ over
   * en topp, 0 på rett bane (standard). Hjulboggiene vippes og flyttes langs skinna, så hjulene ligger på den også i
   * kurver. For en bane y(x) i figurens koordinater (y nedover) er krumningen −y″ / (1 + y′²)^1,5.
   */
  krumning?: number;
}

// Vogna tegnes i centimeter: lengde 200, to hjulboggier ved x = ±62, kjørehjul med radius 11 og opp-stopphjul med radius 7.
const COASTER_LEN = 200;
const COASTER_WHEEL_X = 62;
const COASTER_R = 11;
const COASTER_UP_R = 7;
const COASTER_SHELL =
  'M-98,-30L92,-30C102,-30 108,-40 108,-52C108,-64 100,-74 88,-77L58,-79C50,-79 46,-76 44,-71L41,-63L-3,-63C-6,-63 -8,-65 -9,-68L-12,-80L-24,-80C-28,-80 -30,-76 -32,-71L-35,-63L-84,-63C-88,-63 -90,-66 -91,-70L-94,-82C-99,-82 -103,-78 -103,-72L-103,-38C-103,-33 -101,-30 -98,-30Z';
/** Seteryggen med nakkestøtte (for den fremre raden; den bakre er flyttet 84 cm bakover). */
const COASTER_SEAT = 'M6,-62C4.6,-74 3.4,-84 2.6,-92C4.4,-94.6 5,-99 4.4,-104C3.6,-110 -1.2,-113.2 -7,-113C-12.8,-112.8 -16.4,-109 -16.2,-103L-15,-62Z';
const COASTER_SEAT_SEAM = 'M2.6,-92C-3,-93.6 -9.6,-93.8 -15.6,-92.6';
const COASTER_SEAT_SHINE = 'M1.4,-106C0,-109.4 -3.4,-111 -7.4,-110.8M1.8,-88L3.8,-70';
/** Bøylen: en stang som kommer opp foran i setet og bøyer bakover ned mot fanget, med en polstret ende. */
const COASTER_BAR = 'M41.4,-63C41,-72 39.4,-80 35.4,-85.4C32,-89.8 26.4,-90.4 22.4,-87';
const COASTER_PAD = 'M23.6,-88.2L18.4,-82.4';

/**
 * Vogn i berg-og-dal-bane med to seterader, bøyle over fanget og hjulboggier som griper om skinnen
 * (kjørehjul oppå, opp-stopphjul under), sett fra siden med fronten mot høyre. Ankerpunktet (x, y) er oppå skinna
 * midt under vogna. Drei vogna med tangenten til banen (`rotate`), og gi `krumning` i kurver.
 *   <Bergbanevogn x={p.x} y={p.y} size={150} rotate={vinkelGrader} skinne={10} krumning={1 / R} />
 */
export function Bergbanevogn({ x, y, size = 160, lakk = 'gul', skinne, hjulvinkel = 0, krumning = 0, rotate, flip, dim, title }: BergbanevognProps) {
  const S = Math.max(0.01, num(size, 160));
  const k = S / COASTER_LEN;
  const sw = useLocalStroke(k);
  const id = useSvgId('bergbane');
  const color = paint(lakk);
  const spin = turn(hjulvinkel);
  const spinUp = turn(-num(hjulvinkel, 0) * (COASTER_R / COASTER_UP_R));
  const rail = Math.max(2, num(skinne, S * 0.07)) / k;
  // Krumningen i vognas egne enheter. Boggien i x = c står på sirkelen: løftet og vinkelen følger av sin θ = κ·c.
  const kap = num(krumning, 0) * k;
  const bogie = (c: number) => {
    const q = clamp(kap * c, -0.9, 0.9);
    return { lift: kap ? (1 - Math.sqrt(1 - q * q)) / kap : 0, angle: r2((-Math.asin(q) * 180) / Math.PI) };
  };
  const lift = bogie(COASTER_WHEEL_X).lift;
  const seat = KC.seat;
  return (
    <Place x={x} y={y} rotate={rotate} flip={flip} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <LinearGradient id={`${id}-lakk`} stops={[[0, tint(color, 0.35)], [0.35, color], [1, shade(color, 0.3)]]} />
      <LinearGradient id={`${id}-sete`} x2={1} y2={0} stops={[[0, tint(seat, 0.22)], [0.6, seat], [1, shade(seat, 0.22)]]} />
      <RadialGradient id={`${id}-hjul`} fx={0.36} fy={0.32} stops={[[0, tint(SCENE.plastic, 0.4)], [0.55, SCENE.plastic], [1, shade(SCENE.plasticShade, 0.12)]]} />
      {/* Hjulboggiene rundt skinnen: kjørehjul oppå, opp-stopphjul under. De vippes langs skinna i kurver. */}
      {[-COASTER_WHEEL_X, COASTER_WHEEL_X].map((cx) => {
        const b = bogie(cx);
        return (
          <g key={cx} transform={`translate(${cx} ${r2(-b.lift)})${b.angle ? ` rotate(${b.angle})` : ''}`}>
            <rect x={-7} y={-28} width={14} height={rail + COASTER_UP_R + 28} rx={4} fill={shade(SCENE.metalDark, 0.15)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
            {[
              { cy: -COASTER_R, r: COASTER_R, a: spin },
              { cy: rail + COASTER_UP_R, r: COASTER_UP_R, a: spinUp },
            ].map((wh) => (
              <g key={wh.r} transform={`translate(0 ${r2(wh.cy)})`}>
                <circle r={wh.r} fill={`url(#${id}-hjul)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
                <circle r={wh.r * 0.46} fill={SCENE.metalDark} stroke={shade(SCENE.metalDark, 0.35)} strokeWidth={sw(0.5)} />
                <circle r={wh.r * 0.16} fill={SCENE.metalLight} />
                <path
                  d={`M0,${r2(-wh.r * 0.6)}L0,${r2(-wh.r * 0.86)}`}
                  transform={wh.a ? `rotate(${wh.a})` : undefined}
                  stroke={shade(SCENE.plasticShade, 0.5)}
                  strokeWidth={Math.max(wh.r * 0.16, sw(0.9))}
                  strokeLinecap="round"
                />
              </g>
            ))}
          </g>
        );
      })}
      <g transform={lift ? `translate(0 ${r2(-lift)})` : undefined}>
        {/* Seteryggene med nakkestøtte og bøylene står inne i vogna, bak sideveggen */}
        {[0, -84].map((dx) => (
          <g key={dx} transform={dx ? `translate(${dx} 0)` : undefined}>
            <path d={COASTER_SEAT} fill={`url(#${id}-sete)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
            <path d={COASTER_SEAT_SEAM} fill="none" stroke={shade(seat, 0.4)} strokeWidth={sw(0.8)} strokeLinecap="round" />
            <path d={COASTER_SEAT_SHINE} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.1)} strokeLinecap="round" />
            <path d={COASTER_BAR} fill="none" stroke={SCENE.outline} strokeWidth={2.8 + sw(1)} strokeLinecap="round" strokeLinejoin="round" />
            <path d={COASTER_BAR} fill="none" stroke={SCENE.metalDark} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            <path d={COASTER_PAD} stroke={SCENE.outline} strokeWidth={6.4 + sw(1)} strokeLinecap="round" />
            <path d={COASTER_PAD} stroke={tint(seat, 0.08)} strokeWidth={6.4} strokeLinecap="round" />
          </g>
        ))}
        {/* Understell og skallet */}
        <rect x={-84} y={-31} width={168} height={9} rx={2} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <path d={COASTER_SHELL} fill={`url(#${id}-lakk)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
        <path d="M-98,-44L104,-44L106,-38L-101,-38Z" fill={tint(color, 0.55)} opacity={0.75} />
        <path d="M90,-75C100,-72 105,-63 105.5,-54M57,-77L86,-75.6M-82,-61.5L-38,-61.5M-1,-61.5L39,-61.5" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.4)} strokeLinecap="round" />
      </g>
    </Place>
  );
}
