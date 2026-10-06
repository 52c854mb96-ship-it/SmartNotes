/**
 * Scenen til «Sentrale støt»: to dynamikkvogner på en aluminiumsbane med målebånd, på en labbenk i fysikklaben.
 * Vognene (`Vogn` fra scene-kit-et) har fjær (elastisk), gummidemper (uelastisk) eller borrelås (fullstendig
 * uelastisk) der de møtes, og alt tegnes i én fast skala px/m. Oppå: fartspiler med skilt (én skala px per m/s, valgt så
 * ingen pil går ut av figuren), massene, kraftparet under selve støtet (bryteren «Vis krefter»: pilene fra møtepunktet og
 * inn i hver vogn, og kraften der massen ellers står) og Σp og ΣE_k øverst til høyre.
 *
 * Egne gjenstander for kapittel 4 i samme stil som scene-kit-et (toninger fra core, SCENE-farger, kontur, myk skygge):
 * `Labbane` (aluminiumsprofil med føtter) og `Gummidemper` (gummikloss på enden av vogna).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  ContactShadow,
  ForceArrow,
  LinearGradient,
  Maalebaand,
  Rom,
  SCENE,
  Underlag,
  Vogn,
  hjulvinkelFraStrekning,
  materialStops,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { runAt, type Bumper, type Run, type RunSpec, type RunState } from './model-sentrale-stot';

/* ================================================================================================
 * Mål
 * ============================================================================================== */

/** Figuren er 800 bred. Målebåndet går fra x = X0 (0 m) til x = 800 − X0. */
const W = 800;
const X0 = 20;
/** Banebiten som vises (m): på mobil en kortere bit, så vognene blir store nok. */
export const TRACK_WIDE = 1.0;
export const TRACK_NARROW = 0.8;
/** Vogna (scene-kit-et): 0,2 m lang, endestykkene til ±0,101 m, hjulradius 0,014 m. */
const CART_LEN = 0.2;
const CART_END = 0.101;
const WHEEL_R = 0.014;
/** Høyden på vogna med tre lodd oppå (m), og midten av støtfangeren over banen. */
const CART_TALL = 0.111;
const BUMPER_Y = 0.04;
/** Hvor langt støtfangeren stikker ut fra enden av vogna (m). */
export const BUMPER_LEN: Record<Bumper, number> = { fjaer: 0.03, gummi: 0.011, borrelaas: 0.0082 };
/** Fjæra i Vogn blir 72 % kortere når den er helt sammentrykt. */
const SPRING_TRAVEL = 0.72 * BUMPER_LEN.fjaer;

/** Fra tuppen av støtfangeren til bakenden av vogna (m). */
export function cartReach(bumper: Bumper): number {
  return BUMPER_LEN[bumper] + 2 * CART_END;
}

/** Høyden på vogna (m) fra banen til toppen, med `lodd` lodd oppå (0–3). */
function cartHeight(lodd: number): number {
  return lodd > 0 ? 0.074 + 0.0124 * (lodd - 1) : 0.062;
}

/** Antall lodd oppå vogna (0–3), så tunge vogner ser tunge ut. Den tomme vogna er 0,5 kg. */
export function loddFor(m: number): number {
  return Math.min(3, Math.max(0, Math.round((m - 0.5) / 1.5)));
}

/** Tekstskaleringen figuren vil få (samme regel som Figure i kit/controls), målt på beholderen før figuren tegnes. */
export function useSceneFrame<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [frame, setFrame] = useState({ f: 1, narrow: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      // Bredden på selve SVG-en (uten rammen rundt figuren), slik Figure måler den
      const w = (el.querySelector('svg') ?? el).getBoundingClientRect().width;
      if (!(w > 0)) return;
      const f = Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20;
      const narrow = w < 560;
      setFrame((old) => (old.f === f && old.narrow === narrow ? old : { f, narrow }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, frame] as const;
}

/** Luft mellom grunnlinja til masseetiketten og toppen av vogna (senket skrift går under grunnlinja). */
const labelGap = (f: number) => 4 + 5 * f;

/** Høyden på et skilt (ValueTag-stil) med relativ tekststørrelse `size`. */
const tagHeight = (f: number, size: number) => 17 * f * size * 1.55;
const TAG_SIZE = 0.9;
const INFO_SIZE = 0.85;

export interface SceneLayout {
  /** Piksler per meter. */
  P: number;
  /** Banebiten (m). */
  length: number;
  H: number;
  /** Midten av skiltene øverst til høyre (Σp og ΣE_k). På PC står alt øverst på én rad (info1 = info2). */
  info1: number;
  info2: number;
  /** Overskriften og summene på én rad (PC), eller på to rader (mobil). */
  oneRow: boolean;
  /** Fartsskiltene (midten). */
  tagY: number;
  /** Fartspilene like over vognene, og raden over når to piler ellers ville ligge oppå hverandre. */
  arrowLow: number;
  arrowHigh: number;
  /** Banens overkant (der hjulene ruller), profilhøyden, benkeplata. */
  trackY: number;
  trackH: number;
  benchY: number;
}

/** Grunnlinja til masseetiketten over en pilrad i høyde `arrowY` (pila er ca. 9 · ss høy på hver side av midten). */
export function massBaseAbove(arrowY: number, f: number): number {
  const ss = Math.max(1, f * 0.75);
  return arrowY - 9 * ss - labelGap(f);
}

/**
 * Plasseringen i høyden. `f` er tekstskaleringen, `ss` strekskaleringen. Radene ovenfra: Σp og ΣE_k, fartsskilt,
 * massene, fartspilene (én rad like over vognene, eller to rader) og vognene, banen med målebånd og benken. Fartspila
 * står rett over vogna den hører til, under masseetiketten.
 */
export function sceneLayout(f: number, narrow: boolean): SceneLayout {
  const ss = Math.max(1, f * 0.75);
  const length = narrow ? TRACK_NARROW : TRACK_WIDE;
  const P = (W - 2 * X0) / length;
  const ti = tagHeight(f, INFO_SIZE);
  const tv = tagHeight(f, TAG_SIZE);
  const info1 = 8 + ti / 2;
  const oneRow = !narrow;
  const info2 = oneRow ? info1 : info1 + ti + 5;
  const tagY = info2 + ti / 2 + 9 + tv / 2;
  // Masseetiketten (ca. 12 · f høy over grunnlinja) under skiltene, så to pilrader, så vogna med tre lodd.
  const massTop = tagY + tv / 2 + 6 + 12 * f;
  const arrowHigh = massTop + labelGap(f) + 9 * ss;
  const arrowLow = arrowHigh + 20 * ss;
  const trackY = arrowLow + 9 * ss + 4 + CART_TALL * P;
  const tapeH = 11.5 * f * 1.75;
  const trackH = Math.max(0.03 * P, tapeH + 7);
  const benchY = trackY + trackH + 5 + 0.008 * P;
  const H = Math.round(benchY + 40 + 6 * f);
  return { P, length, H, info1, info2, oneRow, tagY, arrowLow, arrowHigh, trackY, trackH, benchY };
}

/* ================================================================================================
 * Egne gjenstander
 * ============================================================================================== */

/**
 * Aluminiumsbane for dynamikkvogner sett fra siden: profil med to spor på oversiden, et spor i siden og
 * justerbare føtter. (x1, x2) er endene, y overkanten der hjulene ruller, h høyden på profilen, `foot` benkeplata.
 */
function Labbane({ x1, x2, y, h, foot, feet }: { x1: number; x2: number; y: number; h: number; foot: number; feet: number[] }) {
  const id = useSvgId('bane');
  const ss = useStrokeScale();
  const lip = Math.max(2.5, h * 0.12);
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}p`} stops={[[0, tint(SCENE.metalLight, 0.2)], [0.18, SCENE.metalLight], [0.6, SCENE.metal], [1, SCENE.metalDark]]} />
      <LinearGradient id={`${id}f`} x2={1} y2={0} stops={[[0, tint(SCENE.rubber, 0.25)], [0.5, SCENE.rubber], [1, shade(SCENE.rubber, 0.25)]]} />
      <ContactShadow cx={(x1 + x2) / 2} cy={foot} rx={(x2 - x1) * 0.52} ry={4} opacity={0.55} />
      {/* Føtter med stilleskrue */}
      {feet.map((fx) => {
        const fw = Math.max(10, h * 0.9);
        return (
          <g key={fx}>
            <ContactShadow cx={fx} cy={foot} rx={fw * 0.8} ry={2.5} />
            <rect x={fx - 1.6 * ss} y={y + h - 1} width={3.2 * ss} height={foot - y - h} fill={SCENE.metalDark} />
            <path
              d={`M${fx - fw / 2},${foot}L${fx - fw * 0.36},${foot - (foot - y - h) * 0.55}L${fx + fw * 0.36},${foot - (foot - y - h) * 0.55}L${fx + fw / 2},${foot}Z`}
              fill={`url(#${id}f)`}
              stroke={SCENE.outline}
              strokeWidth={0.8 * ss}
            />
          </g>
        );
      })}
      {/* Profilen */}
      <rect x={x1} y={y} width={x2 - x1} height={h} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x1} y={y} width={x2 - x1} height={lip} fill={tint(SCENE.metalLight, 0.35)} />
      <line x1={x1} y1={y + lip} x2={x2} y2={y + lip} stroke={shade(SCENE.metal, 0.3)} strokeWidth={0.9 * ss} />
      <line x1={x1} y1={y + h - 1.6 * ss} x2={x2} y2={y + h - 1.6 * ss} stroke={shade(SCENE.metal, 0.35)} strokeWidth={1.1 * ss} opacity={0.7} />
      <line x1={x1} y1={y + 0.6 * ss} x2={x2} y2={y + 0.6 * ss} stroke={SCENE.highlight} strokeWidth={1.1 * ss} />
    </g>
  );
}

/**
 * Gummidemper på enden av en vogn: en avrundet gummikloss på en liten plate. (x, y) er midten av festet på enden
 * av vogna, `dir` = 1 når den peker mot høyre, `len` lengden ut fra vogna og `h` høyden (figurens enheter).
 * `squash` (0–1) er hvor mye den er presset sammen: den blir kortere og litt høyere.
 */
function Gummidemper({ x, y, dir, len, h, squash }: { x: number; y: number; dir: 1 | -1; len: number; h: number; squash: number }) {
  const id = useSvgId('gummi');
  const ss = useStrokeScale();
  const q = Math.min(0.85, Math.max(0, squash));
  const plate = len * 0.18;
  const L = (len - plate) * (1 - q);
  const hh = h * (1 + 0.28 * q);
  const x0 = x + dir * plate;
  const xl = Math.min(x0, x0 + dir * L);
  const r = Math.min(hh * 0.3, L * 0.5);
  return (
    <g aria-hidden>
      <LinearGradient id={id} stops={materialStops(SCENE.rubber, 1.4)} />
      <rect
        x={Math.min(x, x + dir * plate)}
        y={y - h * 0.62}
        width={plate}
        height={h * 1.24}
        fill={SCENE.metal}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
      <rect x={xl} y={y - hh / 2} width={Math.max(0.5, L)} height={hh} rx={r} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <line
        x1={xl + r * 0.6}
        y1={y - hh / 2 + 1.4 * ss}
        x2={xl + Math.max(r * 0.6, L - r * 0.6)}
        y2={y - hh / 2 + 1.4 * ss}
        stroke={SCENE.rubberLight}
        strokeWidth={1 * ss}
        strokeLinecap="round"
        opacity={0.8}
      />
    </g>
  );
}

/** Skilt med en verdi (som ValueTag), men med vanlig SVG-innhold (senket skrift). `measure` er teksten som gir bredden. */
function Skilt({
  x,
  y,
  children,
  measure,
  color,
  anchor = 'middle',
  size = TAG_SIZE,
}: {
  x: number;
  y: number;
  children: ReactNode;
  measure: string;
  color?: string;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * size;
  const w = tagWidth(measure, f, size);
  const h = fs * 1.55;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
  return (
    <g>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h * 0.32} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.96} />
      <Txt x={left + w / 2} y={y + fs * 0.34} anchor="middle" size={size} color={color} weight={700} halo={false}>
        {children}
      </Txt>
    </g>
  );
}

/** Bredden på et skilt med teksten `text` (samme regel som ValueTag). */
function tagWidth(text: string, f: number, size: number): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

/* ================================================================================================
 * Scenen
 * ============================================================================================== */

export interface SceneProps {
  spec: RunSpec;
  run: Run;
  t: number;
  layout: SceneLayout;
  showForces: boolean;
  /** Sakte film: hvor mange ganger saktere avspillingen går akkurat nå (vises bare når den spiller). */
  slowFactor: number | null;
}

/** Fart i et skilt: «2,00 m/s», og «0 m/s» når vogna står stille. */
const speedText = (v: number) => (Math.abs(v) < 0.005 ? '0 m/s' : `${fmt(v, 2)} m/s`);

/**
 * Piksler per m/s for fartspilene: den største farten i forsøket gir en pil på ca. 150 (høyst 60 per m/s), litt lengre
 * på mobil (`f` er tekstskaleringen), så pilene synes. `rooms` er plassen (piksler) foran hver pil i løpet av forsøket,
 * som [plass, fart]: skalaen blir så liten at ingen pil går ut av figuren.
 */
export function arrowScale(speeds: number[], f = 1, rooms: [number, number][] = []): number {
  const vmax = Math.max(0.1, ...speeds.map(Math.abs));
  const k = 1 + 0.4 * (Math.max(1, f) - 1);
  let S = Math.min(60 * k, (150 * k) / vmax);
  for (const [room, v] of rooms) if (Math.abs(v) > 0.005) S = Math.min(S, Math.max(0, room) / Math.abs(v));
  return Math.max(4, S);
}

export function StotScene({ spec, run, t, layout, showForces, slowFactor }: SceneProps) {
  const f = useTextScale();
  const { P, trackY, trackH, benchY, H } = layout;
  const bumper = spec.bumper;
  const bl = BUMPER_LEN[bumper];
  const px = (x: number) => X0 + x * P;
  const st = runAt(spec, run, t);
  const r = run.result;
  const stuck = bumper === 'borrelaas' && st.phase === 'etter';

  // Midten av vognene (ankerpunktet til Vogn) i figuren
  const c1 = px(st.tip1 - bl - CART_END);
  const c2 = px(st.tip2 + bl + CART_END);
  const lodd1 = loddFor(spec.m1);
  const lodd2 = loddFor(spec.m2);
  const half = st.squeeze / 2;

  // Skalaen for fartspilene (ingen pil går ut av figuren), og to rader med fartspiler når pilene ellers ville ligge
  // oppå hverandre en gang i løpet av forsøket.
  const { S, twoRows } = useMemo(() => {
    const samples = Array.from({ length: 121 }, (_, i) => runAt(spec, run, (i / 120) * run.tEnd));
    const arrows = (s: RunState): [number, number][] =>
      bumper === 'borrelaas' && s.phase === 'etter'
        ? [[px((s.tip1 + s.tip2) / 2), s.v1]]
        : [
            [px(s.tip1 - bl - CART_END), s.v1],
            [px(s.tip2 + bl + CART_END), s.v2],
          ];
    const rooms = samples.flatMap((s) => arrows(s).map(([a, v]): [number, number] => [v > 0 ? W - 10 - a : a - 10, v]));
    const scale = arrowScale([spec.v1, spec.v2, r.u1, r.u2], f, rooms);
    const overlap = samples.some((s) => {
      const [p1, p2] = arrows(s);
      if (!p1 || !p2 || Math.abs(p1[1]) < 0.005 || Math.abs(p2[1]) < 0.005) return false;
      const lo1 = Math.min(p1[0], p1[0] + p1[1] * scale) - 12;
      const hi1 = Math.max(p1[0], p1[0] + p1[1] * scale) + 12;
      const lo2 = Math.min(p2[0], p2[0] + p2[1] * scale) - 12;
      const hi2 = Math.max(p2[0], p2[0] + p2[1] * scale) + 12;
      return lo1 < hi2 && lo2 < hi1;
    });
    return { S: scale, twoRows: overlap };
    // px avhenger bare av P
  }, [spec, run, bumper, bl, P, f, r.u1, r.u2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fartspilene like over den høyeste vogna, og pila til vogn 2 en rad høyere når pilene ellers ville ligge oppå
  // hverandre en gang i løpet av forsøket. Massene står over pilene.
  const ss = Math.max(1, f * 0.75);
  const cartTop = trackY - Math.max(cartHeight(lodd1), cartHeight(lodd2)) * P;
  const y1 = Math.max(layout.arrowLow, cartTop - 9 * ss - 4);
  const y2 = twoRows ? y1 - (layout.arrowLow - layout.arrowHigh) : y1;
  const massY = massBaseAbove(y2, f);
  // Fartsskiltene rett over massene, så skilt, masse, pil og vogn står i en søyle.
  const tagY = Math.max(layout.tagY, massY - 12 * f - 6 - tagHeight(f, TAG_SIZE) / 2);

  // Fartsskiltene: over hver vogn, skjøvet fra hverandre så de ikke overlapper, og innenfor figuren.
  const prime = st.phase === 'etter' ? '′' : '';
  const tag1 = `v₁${prime} = ${speedText(st.v1)}`;
  const tag2 = `v₂${prime} = ${speedText(st.v2)}`;
  const tagStuck = `v′ = ${speedText(st.v1)}`;
  const joint = px((st.tip1 + st.tip2) / 2);
  const tags = (() => {
    if (stuck) {
      const w = tagWidth(tagStuck, f, TAG_SIZE);
      return [{ x: clampX(joint, w), text: tagStuck }];
    }
    const w1 = tagWidth(tag1, f, TAG_SIZE);
    const w2 = tagWidth(tag2, f, TAG_SIZE);
    const gap = 10;
    let a = c1;
    let b = c2;
    const overlap = a + w1 / 2 + gap - (b - w2 / 2);
    if (overlap > 0) {
      a -= overlap / 2;
      b += overlap / 2;
    }
    b = clampX(b, w2);
    a = Math.min(a, b - w2 / 2 - gap - w1 / 2);
    a = clampX(a, w1);
    b = Math.max(b, a + w1 / 2 + gap + w2 / 2);
    return [
      { x: a, text: tag1 },
      { x: b, text: tag2 },
    ];
  })();

  // Kraftparet under støtet: like lange piler (én skala), fra møtepunktet og inn i hver vogn.
  const Fmax = (Math.PI / 2) * (r.collides && run.tau > 0 ? (spec.m1 * (spec.v1 - r.u1)) / run.tau : 0);
  const fLen = Fmax > 0 ? (st.F / Fmax) * 0.13 * P : 0;
  const fy = trackY - BUMPER_Y * P;
  const forcesNow = showForces && st.phase === 'under';

  // Overskrift øverst til venstre
  const phaseText = st.phase === 'for' ? 'Før støtet' : st.phase === 'under' ? 'Under støtet' : st.phase === 'etter' ? 'Etter støtet' : 'Ingen støt';
  const p = spec.m1 * st.v1 + spec.m2 * st.v2;
  const ek = 0.5 * spec.m1 * st.v1 ** 2 + 0.5 * spec.m2 * st.v2 ** 2;
  const eDec = r.EkBefore < 0.1 ? 3 : 2;
  const pText = `Σp = ${fmt(p, 2)} kg·m/s`;
  const subtitle =
    slowFactor !== null
      ? `Sakte film, ${fmt(slowFactor, 0)} ganger saktere`
      : showForces && run.collides && st.phase !== 'under'
        ? 'Kraftparet virker bare under støtet'
        : null;
  const ekText = `ΣEk = ${fmt(ek, eDec)} J`;

  const backdrop = useMemo(
    () => (
      <>
        <Rom x={0} y={0} w={W} h={H} gulvY={H - 4} gulv="betong" />
        <Underlag x1={0} x2={W} y={benchY} depth={H - benchY} type="labbenk" />
        <Labbane x1={-4} x2={W + 4} y={trackY} h={trackH} foot={benchY} feet={[W * 0.12, W * 0.5, W * 0.88]} />
        <Maalebaand x1={X0} x2={W - X0} y={trackY + 3} til={layout.length} />
      </>
    ),
    [H, benchY, trackY, trackH, layout.length],
  );

  const sizeCart = CART_LEN * P;
  const bumperFor = (dir: 1 | -1, cx: number) => {
    if (bumper !== 'gummi') return null;
    return <Gummidemper x={cx + dir * CART_END * P} y={fy} dir={dir} len={bl * P} h={0.026 * P} squash={half / (bl * 0.82)} />;
  };
  const springSqueeze = bumper === 'fjaer' ? Math.min(1, half / SPRING_TRAVEL) : 0;
  const stotfanger = bumper === 'gummi' ? 'ingen' : bumper;

  return (
    <>
      {backdrop}

      {/* Vognene */}
      <Vogn
        x={c1}
        y={trackY}
        size={sizeCart}
        lakk="blaa"
        stotfanger={stotfanger}
        side="hoyre"
        lodd={lodd1}
        hjulvinkel={hjulvinkelFraStrekning(st.tip1, WHEEL_R)}
        sammentrykk={springSqueeze}
        title={`Vogn 1, ${fmt(spec.m1, 1)} kg`}
      />
      {bumperFor(1, c1)}
      <Vogn
        x={c2}
        y={trackY}
        size={sizeCart}
        lakk="oransje"
        stotfanger={stotfanger}
        side="venstre"
        lodd={lodd2}
        hjulvinkel={hjulvinkelFraStrekning(st.tip2, WHEEL_R)}
        sammentrykk={springSqueeze}
        title={`Vogn 2, ${fmt(spec.m2, 1)} kg`}
      />
      {bumperFor(-1, c2)}

      {/* Kraftparet under støtet: pilene fra møtepunktet og inn i hver vogn, og kraften der massen ellers står */}
      {forcesNow && (
        <>
          <ForceArrow x1={joint} y1={fy} x2={joint - fLen} y2={fy} color={VIZ.applied} width={6} minLength={2} />
          <ForceArrow x1={joint} y1={fy} x2={joint + fLen} y2={fy} color={VIZ.applied} width={6} minLength={2} origin />
        </>
      )}

      {/* Massene over vognene og fartspilene (under støtet: kraften på hver vogn, med fortegn: mot venstre er negativ) */}
      <Txt x={c1} y={massY} size={0.85} weight={forcesNow ? 700 : 650} color={forcesNow ? VIZ.applied : undefined}>
        {forcesNow ? (
          <>
            F<TSub>1</TSub> = {fmt(st.F >= 0.5 ? -st.F : 0, 0)} N
          </>
        ) : (
          <>
            m<TSub>1</TSub> = {fmt(spec.m1, 1)} kg
          </>
        )}
      </Txt>
      <Txt x={c2} y={massY} size={0.85} weight={forcesNow ? 700 : 650} color={forcesNow ? VIZ.applied : undefined}>
        {forcesNow ? (
          <>
            F<TSub>2</TSub> = {fmt(st.F, 0)} N
          </>
        ) : (
          <>
            m<TSub>2</TSub> = {fmt(spec.m2, 1)} kg
          </>
        )}
      </Txt>

      {/* Fartspiler (bare prikken når pila er kortere enn spissen; skiltet viser farten) */}
      {stuck ? (
        <VelocityArrow x={joint} y={y1} len={st.v1 * S} />
      ) : (
        <>
          <VelocityArrow x={c1} y={y1} len={st.v1 * S} />
          <VelocityArrow x={c2} y={y2} len={st.v2 * S} />
        </>
      )}
      {tags.map((tg, i) => (
        <Skilt key={i} x={tg.x} y={tagY} measure={tg.text} color={VIZ.velocity}>
          {tg.text}
        </Skilt>
      ))}

      {/* Overskrift og summene: på én rad på PC (undertittelen etter overskriften, ΣE_k til venstre for Σp) */}
      <Txt x={X0} y={layout.info1 + 6 * f} anchor="start" size={1} weight={700}>
        {phaseText}
      </Txt>
      {subtitle && (
        <Txt
          x={layout.oneRow ? X0 + phaseText.length * 17 * f * 0.6 + 14 : X0}
          y={layout.info2 + 6 * f}
          anchor="start"
          size={0.8}
          muted
        >
          {subtitle}
        </Txt>
      )}
      <Skilt x={W - 10} y={layout.info1} anchor="end" measure={pText} size={INFO_SIZE}>
        Σp = {fmt(p, 2)} kg·m/s
      </Skilt>
      <Skilt
        x={layout.oneRow ? W - 10 - tagWidth(pText, f, INFO_SIZE) - 8 : W - 10}
        y={layout.info2}
        anchor="end"
        measure={ekText}
        size={INFO_SIZE}
      >
        ΣE<TSub>k</TSub> = {fmt(ek, eDec)} J
      </Skilt>
    </>
  );
}

/**
 * Fartspil fra (x, y) med lengden `len` (negativ mot venstre). Er den kortere enn pilspissen, ville den sett ut som en
 * knekt vinkel: da tegnes bare prikken i angrepspunktet, og skiltet over viser farten.
 */
function VelocityArrow({ x, y, len }: { x: number; y: number; len: number }) {
  const ss = useStrokeScale();
  const min = 15 * ss;
  if (Math.abs(len) >= min) return <ForceArrow x1={x} y1={y} x2={x + len} y2={y} color={VIZ.velocity} width={6} origin />;
  return <circle cx={x} cy={y} r={3.6 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.6 * ss} />;
}

function clampX(x: number, w: number): number {
  return Math.min(W - 6 - w / 2, Math.max(6 + w / 2, x));
}
