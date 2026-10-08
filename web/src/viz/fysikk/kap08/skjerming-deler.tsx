/**
 * Gjenstandene i «Skjerming»: skinna (optisk benk) med ryttere, strålekilden på en stav, holderen med skjermplatene
 * (papir, aluminium eller bly), fronten av geiger-müller-røret i forstørrelsen og kabelen til telleapparatet.
 * Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger, kontur og myk skygge. Alle mål er i meter og
 * tegnes med skalaen P (px/m). Liggende sylindre har lyset ovenfra (lyst øverst, mørkt nederst).
 */
import type { ReactNode } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  SCENE,
  alpha,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type GradientStop,
} from '../../kit/scene';
import { Faresymbol, GM } from './halveringstid-deler';
import type { MaterialId } from './model-skjerming';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Strålekilden (m): håndtak, stav og koppen med det radioaktive stoffet i enden. */
export const KILDE = { handle: 0.042, handleR: 0.0085, stem: 0.032, stemR: 0.0035, cup: 0.011, cupR: 0.006, spotR: 0.0032 } as const;
export const KILDE_LENGDE = KILDE.handle + KILDE.stem + KILDE.cup;

/** Skinna og rytterne (m). */
export const SKINNE = { h: 0.012 } as const;
export const RYTTER = { w: 0.03, h: 0.011, postR: 0.003 } as const;

/** Skjermplatene er 5 cm høye og står i en klype under (m). */
export const PLATE = { h: 0.05, clip: 0.008 } as const;

/** Fargen på hvert skjermmateriale. */
export const MATERIAL_COLOR: Record<MaterialId, string> = {
  papir: mix(PAINTS.hvit, SCENE.woodLight, 0.14),
  aluminium: SCENE.metalLight,
  bly: shade(mix(SCENE.metal, SCENE.cold, 0.18), 0.32),
};

/** Toning for en liggende sylinder (stav, rør): høylys litt under toppen, mørk underkant. */
export function cylinderStops(color: string, strength = 1): GradientStop[] {
  return [
    [0, shade(color, 0.2 * strength)],
    [0.2, tint(color, 0.45 * strength)],
    [0.5, color],
    [1, shade(color, 0.42 * strength)],
  ];
}

/** Toning for en stående stang (lys fra venstre). */
function rodStops(color: string): GradientStop[] {
  return [
    [0, shade(color, 0.2)],
    [0.3, tint(color, 0.5)],
    [1, shade(color, 0.35)],
  ];
}

/**
 * Skinne (optisk benk) i aluminium på benken, med centimeterstreker på forsiden (lengre for hver 5. cm).
 * (x1, x2) er endene; underkanten står på benken i `benchY`. Toppen er i benchY − SKINNE.h · P.
 */
export function Skinne({ x1, x2, benchY, P, zero }: { x1: number; x2: number; benchY: number; P: number; zero: number }) {
  const id = useSvgId('sk-skinne');
  const ss = useStrokeScale();
  const h = SKINNE.h * P;
  const top = benchY - h;
  const cm = 0.01 * P;
  const ticks: ReactNode[] = [];
  const first = Math.ceil((x1 + 4 - zero) / cm);
  const last = Math.floor((x2 - 4 - zero) / cm);
  for (let i = first; i <= last; i++) {
    const x = zero + i * cm;
    const long = i % 5 === 0;
    ticks.push(<line key={i} x1={x} y1={top + h * 0.4} x2={x} y2={top + h * (long ? 0.9 : 0.68)} stroke={alpha(SCENE.outline, long ? 0.75 : 0.5)} strokeWidth={(long ? 1 : 0.7) * ss} />);
  }
  return (
    <g aria-hidden>
      <ContactShadow cx={(x1 + x2) / 2} cy={benchY} rx={(x2 - x1) * 0.52} ry={4} />
      <LinearGradient id={id} stops={materialStops(SCENE.metalLight, 1.3)} />
      <rect x={x1} y={top} width={x2 - x1} height={h} rx={2} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Toppflaten og sporet rytterne glir i */}
      <rect x={x1 + 2} y={top + 1.2} width={x2 - x1 - 4} height={h * 0.22} fill={tint(SCENE.metalLight, 0.45)} opacity={0.8} />
      <line x1={x1 + 3} y1={top + h * 0.3} x2={x2 - 3} y2={top + h * 0.3} stroke={alpha(SCENE.outline, 0.45)} strokeWidth={0.8 * ss} />
      {ticks}
      {/* Endestykker */}
      {[x1, x2 - 0.006 * P].map((x) => (
        <rect key={x} x={x} y={top - 1} width={0.006 * P} height={h + 1} rx={1.5} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      ))}
    </g>
  );
}

/**
 * Rytter på skinna: en vogn med låseskrue og en stang opp til `topY`, der en klemme holder kilden, skjermen eller
 * røret. (x, railTop) er midt på toppen av skinna.
 */
export function Rytter({ x, railTop, topY, P }: { x: number; railTop: number; topY: number; P: number }) {
  const id = useSvgId('sk-rytter');
  const ss = useStrokeScale();
  const w = RYTTER.w * P;
  const h = RYTTER.h * P;
  const pr = RYTTER.postR * P;
  const top = railTop - h * 0.55;
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}p`} x2={1} y2={0} stops={rodStops(SCENE.metal)} />
      <LinearGradient id={`${id}v`} stops={materialStops(SCENE.metalDark, 1.2)} />
      <rect x={x - pr} y={topY} width={2 * pr} height={top - topY + 1} fill={`url(#${id}p)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path
        d={`M${r2(x - w / 2)},${r2(railTop + h * 0.45)} V${r2(top + 2)} Q${r2(x - w / 2)},${r2(top)} ${r2(x - w / 2 + 2)},${r2(top)} H${r2(x + w / 2 - 2)} Q${r2(x + w / 2)},${r2(top)} ${r2(x + w / 2)},${r2(top + 2)} V${r2(railTop + h * 0.45)} Z`}
        fill={`url(#${id}v)`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
      <circle cx={x + w * 0.22} cy={top + h * 0.5} r={Math.max(1.5, 0.0026 * P)} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
    </g>
  );
}

/** Klemme rundt en liggende stav eller et rør med radius `r` (sett fra siden: et loddrett bånd med en skrue på toppen). */
export function Klemmering({ x, y, r, P }: { x: number; y: number; r: number; P: number }) {
  const id = useSvgId('sk-klemme');
  const ss = useStrokeScale();
  const hw = 0.0042 * P;
  const ext = Math.max(1.5, 0.0022 * P);
  return (
    <g aria-hidden>
      <LinearGradient id={id} x2={1} y2={0} stops={rodStops(SCENE.metalDark)} />
      <rect x={x - hw} y={y - r - ext} width={2 * hw} height={2 * (r + ext)} rx={Math.min(hw, 3)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - hw * 0.45} y={y - r - ext - 0.004 * P} width={hw * 0.9} height={0.004 * P} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
    </g>
  );
}

/**
 * Strålekilden: en stav med svart håndtak og gul faremerking, metallstav og en kopp i enden der det radioaktive stoffet
 * ligger bak et beskyttende nett. Enden (tuppen) er i (tipX, y), og staven peker mot høyre.
 */
export function Kildestav({ tipX, y, P, short }: { tipX: number; y: number; P: number; short: string }) {
  const id = useSvgId('sk-kilde');
  const ss = useStrokeScale();
  const x0 = tipX - KILDE_LENGDE * P;
  const hx1 = x0 + KILDE.handle * P;
  const sx1 = hx1 + KILDE.stem * P;
  const hr = KILDE.handleR * P;
  const sr = KILDE.stemR * P;
  const cr = KILDE.cupR * P;
  const band = { x: x0 + 0.012 * P, w: 0.018 * P };
  const lip = Math.max(1, 0.0008 * P);
  const foil = mix(SCENE.gold, SCENE.metalDark, 0.45);
  const fs = 0.0062 * P;
  return (
    <g>
      <title>{`Strålekilde (${short})`}</title>
      <LinearGradient id={`${id}h`} stops={cylinderStops(SCENE.rubber, 1.2)} />
      <LinearGradient id={`${id}y`} stops={cylinderStops(PAINTS.gul, 0.8)} />
      <LinearGradient id={`${id}m`} stops={cylinderStops(SCENE.metal)} />
      {/* Håndtaket */}
      <rect x={x0} y={y - hr} width={hx1 - x0 + 1} height={2 * hr} rx={Math.min(hr * 0.6, 0.004 * P)} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={band.x} y={y - hr} width={band.w} height={2 * hr} fill={`url(#${id}y)`} stroke={alpha(SCENE.outline, 0.6)} strokeWidth={0.7 * ss} />
      <Faresymbol x={band.x + band.w * 0.3} y={y} r={hr * 0.62} bunn={false} />
      {fs >= 5 && (
        <text x={band.x + band.w * 0.62} y={y + fs * 0.36} style={{ fill: PAINTS.svart, fontSize: fs, fontWeight: 700 }} textAnchor="start">
          {short}
        </text>
      )}
      {/* Kragen mellom håndtaket og staven */}
      <rect x={hx1 - 0.003 * P} y={y - hr * 0.82} width={0.006 * P} height={hr * 1.64} rx={1} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Staven */}
      <rect x={hx1 + 0.003 * P} y={y - sr} width={sx1 - hx1 - 0.003 * P + 1} height={2 * sr} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Koppen med stoffet */}
      <rect x={sx1} y={y - cr} width={tipX - sx1} height={2 * cr} rx={Math.min(2, 0.001 * P)} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={tipX - lip - Math.max(1.2, 0.0007 * P)} y={y - KILDE.spotR * P} width={Math.max(1.2, 0.0007 * P)} height={2 * KILDE.spotR * P} fill={foil} />
      <rect x={tipX - lip} y={y - KILDE.spotR * P} width={lip} height={2 * KILDE.spotR * P} fill={shade(SCENE.metalDark, 0.25)} opacity={0.85} />
    </g>
  );
}

/** Hvor bred skjermen tegnes (px): tykkelsen i målestokk, men aldri tynnere enn `min` (ett papirark synes). */
export function plateWidth(d: number, P: number, min: number): number {
  if (!(d > 0)) return 0;
  return Math.max(min, (d / 1000) * P);
}

/**
 * Selve skjermen sett fra siden: en stabel papirark, aluminiumsplater eller blyplater fra x0 til x1 og fra yTop til yBot.
 * Skjøtene mellom arkene og platene tegnes når de ligger langt nok fra hverandre.
 */
export function Plater({ x0, x1, yTop, yBot, mat, d, rounded = true }: { x0: number; x1: number; yTop: number; yBot: number; mat: MaterialId; d: number; rounded?: boolean }) {
  const id = useSvgId('sk-plate');
  const ss = useStrokeScale();
  const w = x1 - x0;
  if (!(w > 0) || !(d > 0)) return null;
  const color = MATERIAL_COLOR[mat];
  // Skjøter: hvert ark (0,1 mm), hver aluminiumsplate (1 mm) og hver blyplate (5 mm)
  const unit = mat === 'papir' ? 0.1 : mat === 'aluminium' ? 1 : 5;
  const n = Math.round(d / unit);
  let every = 1;
  while (n > 1 && (w / n) * every < 3.2) every += 1;
  const seams: number[] = [];
  for (let i = every; i < n; i += every) seams.push(x0 + (w * i) / n);
  const stops: GradientStop[] =
    mat === 'papir'
      ? [
          [0, tint(color, 0.3)],
          [1, shade(color, 0.08)],
        ]
      : mat === 'aluminium'
        ? [
            [0, shade(color, 0.12)],
            [0.3, tint(color, 0.45)],
            [0.75, color],
            [1, shade(color, 0.2)],
          ]
        : [
            [0, tint(color, 0.18)],
            [0.4, color],
            [1, shade(color, 0.25)],
          ];
  const rr = rounded ? Math.min(2, w / 3) : 0;
  return (
    <g>
      <LinearGradient id={id} x2={1} y2={0} stops={stops} />
      <rect x={x0} y={yTop} width={w} height={yBot - yTop} rx={rr} fill={`url(#${id})`} />
      {seams.map((x) => (
        <line key={x} x1={x} y1={yTop + 1} x2={x} y2={yBot - 1} stroke={alpha(SCENE.outline, mat === 'papir' ? 0.28 : 0.45)} strokeWidth={0.8 * ss} />
      ))}
      {/* Lys kant på venstre side (lyset kommer fra venstre) */}
      {w > 4 && <line x1={x0 + 1} y1={yTop + 2} x2={x0 + 1} y2={yBot - 2} stroke={tint(color, 0.6)} strokeWidth={1 * ss} opacity={0.7} />}
      <rect x={x0} y={yTop} width={w} height={yBot - yTop} rx={rr} fill="none" stroke={SCENE.outline} strokeWidth={(mat === 'papir' ? 0.8 : 1) * ss} />
    </g>
  );
}

/**
 * Holderen for skjermen på en rytter: en klype med spor som platene står i, og platene oppå, sentrert om strålen i
 * `axisY`. `x` er midten av skjermen. Uten skjerm (d = 0) står klypa tom.
 */
export function Skjermholder({ x, railTop, axisY, mat, d, P, minW }: { x: number; railTop: number; axisY: number; mat: MaterialId; d: number; P: number; minW: number }) {
  const id = useSvgId('sk-holder');
  const ss = useStrokeScale();
  const w = plateWidth(d, P, minW);
  const yTop = axisY - (PLATE.h / 2) * P;
  const yBot = axisY + (PLATE.h / 2) * P;
  const clipW = Math.max(0.022 * P, w + 0.008 * P);
  const clipH = PLATE.clip * P;
  return (
    <g>
      <title>Holder med skjerm</title>
      <Rytter x={x} railTop={railTop} topY={yBot + clipH - 1} P={P} />
      <LinearGradient id={id} stops={materialStops(SCENE.rubber, 1.4)} />
      <Plater x0={x - w / 2} x1={x + w / 2} yTop={yTop} yBot={yBot + clipH * 0.4} mat={mat} d={d} />
      <rect x={x - clipW / 2} y={yBot} width={clipW} height={clipH} rx={Math.min(3, clipH / 3)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {w === 0 && <rect x={x - 0.0015 * P} y={yBot + 0.5} width={0.003 * P} height={clipH * 0.45} fill={shade(SCENE.rubber, 0.5)} />}
    </g>
  );
}

/**
 * Fronten av geiger-müller-røret i forstørrelsen: metallrør med krage rundt det tynne vinduet av glimmer. Vinduet er i
 * `windowX` og røret går mot høyre til `x2` (klippes av rammen). `y` er midten (strålen).
 */
export function GmFront({ windowX, x2, y, P }: { windowX: number; x2: number; y: number; P: number }) {
  const id = useSvgId('sk-gm');
  const ss = useStrokeScale();
  const r = GM.r * P;
  const collar = 0.006 * P;
  const cr = r * 1.08;
  const win = Math.max(2, 0.0006 * P);
  const label = { x: windowX + collar + 0.014 * P, w: 0.02 * P };
  return (
    <g>
      <title>Geiger-müller-rør</title>
      <LinearGradient id={`${id}m`} stops={cylinderStops(SCENE.metal)} />
      <LinearGradient id={`${id}c`} stops={cylinderStops(SCENE.metalDark, 0.9)} />
      <LinearGradient id={`${id}l`} stops={cylinderStops(SCENE.plastic, 0.6)} />
      <rect x={windowX + collar - 1} y={y - r} width={Math.max(0, x2 - windowX - collar + 1)} height={2 * r} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {label.x < x2 && (
        <g>
          <rect x={label.x} y={y - r} width={Math.min(label.w, x2 - label.x)} height={2 * r} fill={`url(#${id}l)`} opacity={0.55} />
          <line x1={label.x + 0.004 * P} y1={y - r * 0.2} x2={Math.min(x2, label.x + label.w * 0.75)} y2={y - r * 0.2} stroke={alpha(SCENE.outline, 0.7)} strokeWidth={1.4 * ss} />
          <line x1={label.x + 0.004 * P} y1={y + r * 0.12} x2={Math.min(x2, label.x + label.w * 0.5)} y2={y + r * 0.12} stroke={alpha(SCENE.outline, 0.45)} strokeWidth={1.1 * ss} />
        </g>
      )}
      {/* Kragen rundt vinduet */}
      <rect x={windowX} y={y - cr} width={collar} height={2 * cr} rx={Math.min(3, collar / 3)} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Vinduet av tynn glimmer */}
      <rect x={windowX - win * 0.4} y={y - r * 0.78} width={win} height={r * 1.56} rx={win / 2} fill={mix(SCENE.woodDark, SCENE.rubber, 0.45)} />
    </g>
  );
}

/** Kabel med myke bøyer gjennom punktene: svart, rund gummi med et lite høylys. */
export function Kabel({ points, r }: { points: [number, number][]; r: number }) {
  const ss = useStrokeScale();
  let d = '';
  points.forEach(([x, y], i) => {
    if (i === 0) {
      d += `M${r2(x)},${r2(y)}`;
      return;
    }
    const prev = points[i - 1]!;
    const next = points[i + 1];
    if (!next) {
      d += ` L${r2(x)},${r2(y)}`;
      return;
    }
    const lenIn = Math.hypot(x - prev[0], y - prev[1]) || 1;
    const lenOut = Math.hypot(next[0] - x, next[1] - y) || 1;
    const rr = Math.min(r, lenIn / 2, lenOut / 2);
    const ax = x - ((x - prev[0]) / lenIn) * rr;
    const ay = y - ((y - prev[1]) / lenIn) * rr;
    const bx = x + ((next[0] - x) / lenOut) * rr;
    const by = y + ((next[1] - y) / lenOut) * rr;
    d += ` L${r2(ax)},${r2(ay)} Q${r2(x)},${r2(y)} ${r2(bx)},${r2(by)}`;
  });
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} stroke={SCENE.outline} strokeWidth={5.6 * ss} />
      <path d={d} stroke={SCENE.rubber} strokeWidth={4 * ss} />
      <path d={d} stroke={SCENE.rubberLight} strokeWidth={1.1 * ss} opacity={0.7} transform="translate(-0.7 -0.7)" />
    </g>
  );
}
