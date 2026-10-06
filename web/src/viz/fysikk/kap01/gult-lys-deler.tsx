/**
 * Egne gjenstander til «Gult lys: stoppe eller kjøre?» (k1-gult-lys), i samme stil som scene-kit-et: toninger fra
 * core.tsx, SCENE-farger, kontur og myk skygge. Bare denne visualiseringen trenger dem.
 *
 *   <Trafikklys x={x} y={fot} top={y0} size={44} lys="gul" />   lyssignal på stolpe (hodet er `size` høyt)
 *   <Kryss X={X} roadY={y} B={34} horizon={h} bottom={H} />       fortau, tverrvei, gangfelt og stopplinje
 *   <BilLupe x={x} y={y} carLen={150} text="50 km/h" … />          innfelt utsnitt med bilen forstørret og farten
 *
 * Signalhodet tegnes større enn i virkeligheten (et ekte er ca. 1 m høyt), så lampene synes også på mobil.
 */
import { memo } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  SpeedLines,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type PaintName,
} from '../../kit/scene';
import { KRYSS } from './model-gult-lys';

const r2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ Trafikklys */

export type Lys = 'rod' | 'gul' | 'gronn' | 'av';

/**
 * Fargen på lampene når de lyser. Lampene sender ut lys, så de bygger på de sterke lysfargene (sun, warm, hot) og
 * ikke på lakkfargene, som er dempet i mørkt tema.
 */
export const LAMPE = {
  rod: mix(SCENE.hot, PAINTS.rod, 0.2),
  gul: mix(SCENE.sun, SCENE.warm, 0.55),
  gronn: mix(PAINTS.gronn, SCENE.cold, 0.25),
} as const;

/** Midten av lampene i signalhodet, som andel av høyden fra toppen. */
const LAMP_Y = [0.18, 0.5, 0.82] as const;
const LAMP_R = 0.118;

/**
 * Lyssignal på stolpe: mørkt signalhode med bakskjerm, tre lamper (rødt øverst, gult, grønt) med skjermer over, og en
 * stolpe i stål ned til bakken. Hodet er vendt mot bilen, men tegnes rett forfra, så lampene synes.
 * (x, y) er foten av stolpen på bakken, `top` overkanten av hodet og `size` høyden av hodet.
 */
export const Trafikklys = memo(function Trafikklys({ x, y, top, size, lys, title }: { x: number; y: number; top: number; size: number; lys: Lys; title?: string }) {
  const ss = useStrokeScale();
  const id = useSvgId('trafikklys');
  const s = Math.max(12, size);
  const hw = 0.2 * s; // halve bredden av huset
  const pw = Math.max(2.6 * ss, 0.085 * s); // stolpen
  const capY = top - 0.07 * s;
  const lamps: { key: Exclude<Lys, 'av'>; cy: number }[] = [
    { key: 'rod', cy: top + LAMP_Y[0] * s },
    { key: 'gul', cy: top + LAMP_Y[1] * s },
    { key: 'gronn', cy: top + LAMP_Y[2] * s },
  ];
  const r = LAMP_R * s;
  return (
    <g role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <LinearGradient
        id={`${id}-stolpe`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.metal, 0.35)],
          [0.4, SCENE.metal],
          [1, shade(SCENE.metal, 0.4)],
        ]}
      />
      <LinearGradient
        id={`${id}-hus`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(PAINTS.svart, 0.16)],
          [0.5, PAINTS.svart],
          [1, shade(PAINTS.svart, 0.35)],
        ]}
      />
      {/* Stolpen med fot og skygge */}
      <ContactShadow cx={x} cy={y} rx={pw * 2.4} ry={pw * 0.6} />
      <rect x={r2(x - pw / 2)} y={r2(capY)} width={r2(pw)} height={r2(Math.max(0, y - capY))} fill={`url(#${id}-stolpe)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={r2(x - pw * 0.9)} y={r2(y - pw * 0.9)} width={r2(pw * 1.8)} height={r2(pw * 0.9)} rx={r2(pw * 0.2)} fill={shade(SCENE.metal, 0.15)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <ellipse cx={x} cy={capY} rx={pw * 0.62} ry={pw * 0.32} fill={tint(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * ss} />

      {/* Bakskjerm og hus */}
      <rect
        x={r2(x - hw * 1.6)}
        y={r2(top - 0.04 * s)}
        width={r2(hw * 3.2)}
        height={r2(s * 1.08)}
        rx={r2(0.07 * s)}
        fill={shade(PAINTS.svart, 0.2)}
        stroke={tint(PAINTS.svart, 0.45)}
        strokeWidth={r2(Math.max(0.8 * ss, 0.022 * s))}
      />
      <rect x={r2(x - hw)} y={r2(top)} width={r2(2 * hw)} height={r2(s)} rx={r2(0.08 * s)} fill={`url(#${id}-hus)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />

      {/* Glød rundt lampen som lyser: lyser opp huset og litt utenfor bakskjermen */}
      {lamps.map((l) =>
        lys === l.key ? (
          <g key={`glod-${l.key}`}>
            <RadialGradient
              id={`${id}-glod-${l.key}`}
              stops={[
                [0, LAMPE[l.key], 0.9],
                [0.3, LAMPE[l.key], 0.5],
                [0.6, LAMPE[l.key], 0.14],
                [1, LAMPE[l.key], 0],
              ]}
            />
            <circle cx={x} cy={l.cy} r={r * 3.6} fill={`url(#${id}-glod-${l.key})`} />
          </g>
        ) : null,
      )}

      {/* Lampene: den som lyser har lys kjerne, de andre er mørke med en liten refleks */}
      {lamps.map((l) => {
        const on = lys === l.key;
        const c = LAMPE[l.key];
        return (
          <g key={l.key}>
            <RadialGradient
              id={`${id}-lampe-${l.key}`}
              fx={0.4}
              fy={0.38}
              stops={
                on
                  ? [
                      [0, tint(c, 0.55)],
                      [0.32, c],
                      [1, shade(c, 0.16)],
                    ]
                  : [
                      [0, shade(c, 0.42)],
                      [1, shade(c, 0.68)],
                    ]
              }
            />
            <circle cx={x} cy={l.cy} r={r} fill={`url(#${id}-lampe-${l.key})`} stroke={shade(PAINTS.svart, 0.4)} strokeWidth={0.6 * ss} />
            {!on && (
              <path
                d={`M${r2(x - r * 0.62)},${r2(l.cy - r * 0.2)}A${r2(r * 0.66)},${r2(r * 0.66)} 0 0 1 ${r2(x - r * 0.1)},${r2(l.cy - r * 0.66)}`}
                fill="none"
                stroke={SCENE.highlight}
                strokeWidth={r2(Math.max(0.7 * ss, r * 0.16))}
                strokeLinecap="round"
                opacity={0.7}
              />
            )}
            {/* Skjermen over lampen (mot sollys), litt lengre mot venstre der bilen kommer fra */}
            <path
              d={`M${r2(x - r * 1.32)},${r2(l.cy - r * 0.05)}A${r2(r * 1.3)},${r2(r * 1.3)} 0 0 1 ${r2(x + r * 1.18)},${r2(l.cy - r * 0.32)}L${r2(x + r * 1.0)},${r2(l.cy - r * 0.3)}A${r2(r * 1.08)},${r2(r * 1.08)} 0 0 0 ${r2(x - r * 1.08)},${r2(l.cy + r * 0.02)}Z`}
              fill={shade(PAINTS.svart, 0.15)}
              stroke={SCENE.outline}
              strokeWidth={0.5 * ss}
            />
          </g>
        );
      })}
    </g>
  );
});

/* ------------------------------------------------------------------ Krysset */

/** Midtlinja på veien (samme farge som Vei i scene-kit-et). */
const MIDTLINJE = 'var(--sc-bakgrunn-midtlinje)';

/**
 * Det som gjør veien til et lyskryss, tegnet oppå `Vei`: fortau med kantstein foran og bak veien, en tverrvei som går
 * bakover mot horisonten og framover mot betrakteren (i svakt perspektiv mot `vpX`), gangfelt like etter
 * stopplinja og selve stopplinja i kjørefeltet. `X` gjør meter fra stopplinja om til x i figuren. Veien har bredden
 * B og hjulene i `roadY` (som `Vei`).
 */
export const Kryss = memo(function Kryss({
  X,
  roadY,
  B,
  horizon,
  bottom,
  sidewalk,
  vpX = 400,
  w = 800,
}: {
  X: (m: number) => number;
  roadY: number;
  B: number;
  horizon: number;
  bottom: number;
  /** Høyden av fortauet foran og bak veien (figurens enheter). */
  sidewalk: number;
  vpX?: number;
  w?: number;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('kryss');
  const roadTop = roadY - 0.7 * B;
  const roadBot = roadY + 0.3 * B;
  // Svakt perspektiv: linjer på tvers av veien går mot et forsvinningspunkt høyt over horisonten.
  const vpY = horizon - 6 * Math.max(10, roadY - horizon);
  const P = (m: number, y: number) => vpX + (X(m) - vpX) * ((y - vpY) / (roadY - vpY));
  const quad = (m1: number, m2: number, yA: number, yB: number) =>
    `M${r2(P(m1, yA))},${r2(yA)}L${r2(P(m2, yA))},${r2(yA)}L${r2(P(m2, yB))},${r2(yB)}L${r2(P(m1, yB))},${r2(yB)}Z`;
  const t = KRYSS.tverrvei;
  const backSw = roadTop - sidewalk;
  const frontSw = roadBot + sidewalk;
  const kerb = Math.max(1.4 * ss, 0.07 * B);

  // Fuger i fortauet hver 2. meter (bare der det er fortau, ikke over tverrveien)
  const seams = (yA: number, yB: number) => {
    let d = '';
    const lo = Math.floor((-(X(0) - 0) / Math.max(1e-6, X(1) - X(0))) / 2) * 2 - 2;
    const hi = Math.ceil(((w - X(0)) / Math.max(1e-6, X(1) - X(0))) / 2) * 2 + 2;
    for (let m = lo; m <= hi; m += 2) {
      if (m > t.fra - 0.5 && m < t.til + 0.5) continue;
      d += `M${r2(P(m, yA))},${r2(yA)}L${r2(P(m, yB))},${r2(yB)}`;
    }
    return d;
  };

  // Gangfeltet: sju striper parallelt med kjøreretningen, fra bakre til fremre kant av veien
  const nStripes = 7;
  const sh = (roadBot - roadTop) / (2 * nStripes - 1);
  let zebra = '';
  for (let i = 0; i < nStripes; i++) {
    const yA = roadTop + 2 * i * sh;
    zebra += quad(KRYSS.gangfelt.fra, KRYSS.gangfelt.til, yA, yA + sh);
  }

  // Midtlinja i tverrveien (stiplet, mot horisonten og mot betrakteren)
  const mid = (t.fra + t.til) / 2;
  const dashes = (yA: number, yB: number, n: number) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = yA + ((yB - yA) * i) / n;
      const b = a + ((yB - yA) / n) * 0.45;
      d += `M${r2(P(mid, a))},${r2(a)}L${r2(P(mid, b))},${r2(b)}`;
    }
    return d;
  };

  return (
    <g aria-hidden>
      <LinearGradient
        id={`${id}-fortau`}
        stops={[
          [0, tint(SCENE.concrete, 0.12)],
          [1, shade(SCENE.concrete, 0.06)],
        ]}
      />
      <LinearGradient
        id={`${id}-bak`}
        userSpace
        x1={0}
        y1={horizon}
        x2={0}
        y2={roadTop}
        stops={[
          [0, mix(SCENE.asphalt, SCENE.skyBottom, 0.4)],
          [1, tint(SCENE.asphalt, 0.1)],
        ]}
      />
      <LinearGradient
        id={`${id}-vei`}
        userSpace
        x1={0}
        y1={roadTop}
        x2={0}
        y2={roadBot}
        stops={[
          [0, tint(SCENE.asphalt, 0.12)],
          [1, shade(SCENE.asphalt, 0.06)],
        ]}
      />
      <LinearGradient
        id={`${id}-foran`}
        userSpace
        x1={0}
        y1={roadBot}
        x2={0}
        y2={bottom}
        stops={[
          [0, shade(SCENE.asphalt, 0.04)],
          [1, shade(SCENE.asphalt, 0.16)],
        ]}
      />

      {/* Fortau bak og foran veien */}
      <rect x={0} y={r2(backSw)} width={w} height={r2(sidewalk)} fill={`url(#${id}-fortau)`} />
      <rect x={0} y={r2(roadBot)} width={w} height={r2(sidewalk)} fill={`url(#${id}-fortau)`} />
      <path d={seams(backSw, roadTop - kerb) + seams(roadBot + kerb, frontSw)} stroke={shade(SCENE.concrete, 0.22)} strokeWidth={0.7 * ss} opacity={0.7} />
      {/* Kantstein: siden av kantsteinen bak (vendt mot oss) og toppen av den foran */}
      <rect x={0} y={r2(roadTop - kerb)} width={w} height={r2(kerb)} fill={shade(SCENE.concrete, 0.2)} />
      <rect x={0} y={r2(roadBot)} width={w} height={r2(kerb)} fill={tint(SCENE.concrete, 0.25)} />
      <line x1={0} x2={w} y1={r2(frontSw)} y2={r2(frontSw)} stroke={shade(SCENE.concrete, 0.25)} strokeWidth={0.8 * ss} />

      {/* Tverrveien: bakover mot horisonten, over veien vår og framover mot betrakteren */}
      <path d={quad(t.fra, t.til, horizon, roadTop)} fill={`url(#${id}-bak)`} />
      <path d={quad(t.fra, t.til, roadTop - 0.5, roadBot + 0.5)} fill={`url(#${id}-vei)`} />
      <path d={quad(t.fra, t.til, roadBot, bottom)} fill={`url(#${id}-foran)`} />
      <path
        d={`M${r2(P(t.fra, horizon))},${r2(horizon)}L${r2(P(t.fra, backSw))},${r2(backSw)}M${r2(P(t.til, horizon))},${r2(horizon)}L${r2(P(t.til, backSw))},${r2(backSw)}` +
          `M${r2(P(t.fra, frontSw))},${r2(frontSw)}L${r2(P(t.fra, bottom))},${r2(bottom)}M${r2(P(t.til, frontSw))},${r2(frontSw)}L${r2(P(t.til, bottom))},${r2(bottom)}`}
        stroke={shade(SCENE.concrete, 0.1)}
        strokeWidth={1.4 * ss}
      />
      <path d={dashes(horizon + 2, backSw, 4) + dashes(frontSw + 3, bottom, 4)} stroke={MIDTLINJE} strokeWidth={Math.max(1 * ss, 0.05 * B)} strokeLinecap="butt" />

      {/* Gangfelt */}
      <path d={zebra} fill={SCENE.roadLine} opacity={0.92} />
    </g>
  );
});

/**
 * Stopplinja i kjørefeltet vårt, fra midtlinja til forkanten av veien, 0,5 m bred og med samme perspektiv som
 * gangfeltet. Tegnes etter malingen i kjørefeltet, så den alltid synes.
 */
export function Stopplinje({ X, roadY, B, horizon, vpX = 400 }: { X: (m: number) => number; roadY: number; B: number; horizon: number; vpX?: number }) {
  const vpY = horizon - 6 * Math.max(10, roadY - horizon);
  const P = (m: number, y: number) => vpX + (X(m) - vpX) * ((y - vpY) / (roadY - vpY));
  const yA = roadY - 0.24 * B;
  const yB = roadY + 0.28 * B;
  return (
    <path
      d={`M${r2(P(-0.5, yA))},${r2(yA)}L${r2(P(0, yA))},${r2(yA)}L${r2(P(0, yB))},${r2(yB)}L${r2(P(-0.5, yB))},${r2(yB)}Z`}
      fill={SCENE.roadLine}
      stroke={shade(SCENE.roadLine, 0.15)}
      strokeWidth={0.5}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------------ Bilen forstørret */

/** Høyden av vinduet med bilen i BilLupe, som andel av billengden: bilen (1,5/4,4), veien under og litt himmel over. */
const LUPE_WIN_H = 0.56;
/** Bredden av vinduet, som andel av billengden (plass til fartsstrekene bak bilen). */
const LUPE_WIN_W = 1.3;

/** Målene på BilLupe: bredde og høyde av skiltet (figurenheter), med `textW` plass til teksten og kanten `inset`. */
export function bilLupeSize(carLen: number, textW: number, inset: number, gap: number): { w: number; h: number } {
  return { w: inset + LUPE_WIN_W * carLen + gap + textW + gap, h: LUPE_WIN_H * carLen + 2 * inset };
}

/**
 * Innfelt utsnitt av bilen: et skilt med bilen forstørret på et lite stykke vei (med bremselys og fartsstreker), og
 * farten ved siden av. Brukes når bilen i scenen er så liten at den knapt synes (på mobil, og når veien i bildet er
 * lang). Spissen under skiltet peker ned på bilen i scenen, i `pointerX`. (x, y) er midten av skiltet, og `carLen`
 * lengden på bilen i skiltet (figurenheter). Bilen i skiltet står stille i bildet; veien under den viser farten med
 * fartsstreker.
 */
export function BilLupe({
  x,
  y,
  w,
  h,
  inset,
  gap,
  carLen,
  pointer,
  pointerX,
  text,
  color,
  speed,
  lakk,
  hjulvinkel,
  bremselys,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  inset: number;
  gap: number;
  carLen: number;
  /** Høyden på spissen fra underkanten av skiltet ned mot bilen, og hvor den peker. */
  pointer: number;
  pointerX: number;
  text: string;
  color: string;
  /** Lengden på fartsstrekene bak bilen (0 når den står stille). */
  speed: number;
  lakk: PaintName | string;
  hjulvinkel: number;
  bremselys: boolean;
  title: string;
}) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('bil-lupe');
  const left = x - w / 2;
  const top = y - h / 2;
  const winW = LUPE_WIN_W * carLen;
  const winH = h - 2 * inset;
  const wx = left + inset;
  const wy = top + inset;
  const q = carLen / BIL_MAAL.lengde;
  const ground = wy + winH * 0.84;
  const roadTop = wy + winH * 0.7;
  // Bilen litt til høyre i vinduet, så fartsstrekene får plass bak den
  const front = wx + winW - 0.06 * carLen;
  const anchorX = front - BIL_MAAL.foran * q;
  const rear = front - carLen;
  const r = Math.min(h * 0.22, 10 * ss);
  const px = Math.min(left + w - r - 7 * ss, Math.max(left + r + 7 * ss, pointerX));
  return (
    <g role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <clipPath id={`${id}-vindu`}>
          <rect x={wx} y={wy} width={winW} height={winH} rx={r * 0.7} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${id}-himmel`}
        stops={[
          [0, SCENE.skyTop],
          [1, SCENE.skyBottom],
        ]}
      />
      <LinearGradient
        id={`${id}-vei`}
        stops={[
          [0, tint(SCENE.asphalt, 0.08)],
          [1, SCENE.asphaltDark],
        ]}
      />
      {pointer > 0 && (
        <polygon
          points={`${r2(px - 6 * ss)},${r2(top + h - 1)} ${r2(px + 6 * ss)},${r2(top + h - 1)} ${r2(px)},${r2(top + h + pointer)}`}
          fill={VIZ.surface}
          stroke={SCENE.outline}
          strokeWidth={1 * ss}
        />
      )}
      <rect x={left} y={top} width={w} height={h} rx={r} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.97} />
      <g clipPath={`url(#${id}-vindu)`}>
        <rect x={wx} y={wy} width={winW} height={roadTop - wy} fill={`url(#${id}-himmel)`} />
        <rect x={wx} y={roadTop} width={winW} height={wy + winH - roadTop} fill={`url(#${id}-vei)`} />
        <line x1={wx} x2={wx + winW} y1={roadTop + 0.6 * ss} y2={roadTop + 0.6 * ss} stroke={SCENE.concrete} strokeWidth={1.4 * ss} opacity={0.8} />
        {speed > 4 && <SpeedLines x={rear} y={ground - 0.45 * BIL_MAAL.hoyde * q} length={speed} spread={0.62 * BIL_MAAL.hoyde * q} />}
        <Bil x={anchorX} y={ground} size={carLen} lakk={lakk} hjulvinkel={hjulvinkel} bremselys={bremselys} />
      </g>
      <rect x={wx} y={wy} width={winW} height={winH} rx={r * 0.7} fill="none" stroke={SCENE.outline} strokeWidth={0.8 * ss} opacity={0.35} />
      <Txt x={wx + winW + gap} y={y + 17 * 0.9 * f * 0.34} anchor="start" size={0.9} weight={700} color={color} halo={false}>
        {text}
      </Txt>
    </g>
  );
}
