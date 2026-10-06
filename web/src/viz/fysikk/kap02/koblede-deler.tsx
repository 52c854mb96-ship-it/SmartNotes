/**
 * Egne gjenstander til «Bil med tilhenger» (k2-koblede-klosser) som scene-kit-et ikke har: en enakslet tilhenger med
 * storsekker med ved, hengerfestet (kula) bak på bilen, systemgrensen og en kraftpil med brudd for krefter som er
 * tegnet forkortet. Samme stil som scene-kit-et: toninger fra core, SCENE- og PAINTS-farger, tynn kontur og myk
 * skygge. Ingen filtre og ingen bilder.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, useTextScale } from '../../kit';
import {
  ContactShadow,
  ForceArrow,
  LinearGradient,
  PAINTS,
  Place,
  RadialGradient,
  SCENE,
  SCENE_DIM,
  alpha,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Svart plast og gummilister, og baklyset (fargene til kjøretøyene i scene-kit-et). */
const TRIM = 'var(--sc-kjoretoy-trim)';
const TAIL = 'var(--sc-kjoretoy-tail)';
/** Fargen på systemgrensen (samme som `Boundary` i kit-et). */
export const BOUNDARY = 'var(--viz-boundary)';

/* ================================================================================================
 * Tilhenger
 * ============================================================================================== */

/**
 * Målene til tilhengeren i meter. Ankerpunktet er på bakken rett under akslingen, og hengeren kjører mot høyre.
 * Kula i hengerfestet sitter `kobling` foran akslingen og `koblingHoyde` over bakken.
 */
export const HENGER_MAAL = {
  /** Lengden på kassa (akslingen står midt under). */
  kasse: 2.9,
  /** Fra akslingen fram til midten av kula (koblingspunktet). */
  kobling: 2.7,
  /** Høyden til midten av kula over bakken. */
  koblingHoyde: 0.42,
  hjulradius: 0.29,
  /** Golvet i kassa og overkanten av sidene over bakken. */
  golv: 0.58,
  sideTopp: 0.92,
  /** Høyden til en full storsekk med ved, og hvor høyt veden stikker opp over kanten. */
  sekk: 1.0,
  ved: 0.1,
  /** Tyngdepunktet med last (rett over akslingen, siden lasten er fordelt likt foran og bak). */
  tyngdepunkt: 0.72,
} as const;

/** Midten av de tre sekkene langs hengeren (m fra akslingen): bakerst, midt og fremst. */
const SACK_X = [-0.95, 0, 0.95] as const;
const SACK_W = 0.86;

/** Toppen av lasten (m over bakken) når sekkene er så fulle som `fill` sier: til planlegging av figuren. */
export function hengerTopp(fill: readonly number[]): number {
  const most = Math.max(0, ...fill.map(clamp01));
  if (most < 0.02) return HENGER_MAAL.sideTopp;
  return Math.max(HENGER_MAAL.sideTopp, HENGER_MAAL.golv + most * HENGER_MAAL.sekk + HENGER_MAAL.ved);
}

// Tilhengeren tegnes i centimeter med ankerpunktet på bakken under akslingen (y opp er negativ).
const BOX = 145;
const SIDE_TOP = -92;
const SIDE_BOT = -55;
const FLOOR = -58;
const WHEEL_R = 29;
const BALL = { x: 270, y: -42 };

/**
 * Enakslet tilhenger med galvaniserte sider, skjerm over hjulet, dragstang med kulekobling og støttehjul, sett fra
 * siden. Lasten er storsekker med kløyvd ved: `fill` sier hvor full hver sekk er (bakerst, midt, fremst; 0–1).
 * En halvfull sekk er lavere, og en tom sekk tegnes ikke. Ankerpunktet (x, y) er på bakken under akslingen;
 * `pxPerM` er skalaen i figuren. Kula i hengerfestet er i (x + 2,7 m, y − 0,42 m), se `HENGER_MAAL`.
 */
export function Tilhenger({
  x,
  y,
  pxPerM,
  fill,
  hjulvinkel = 0,
  dim,
  title,
}: {
  x: number;
  y: number;
  pxPerM: number;
  fill: readonly number[];
  hjulvinkel?: number;
  dim?: boolean;
  title?: string;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('henger');
  const k = Math.max(0.01, num(pxPerM, 56)) / 100;
  const sw = (w: number) => (w * ss) / k;
  const spin = r2(num(hjulvinkel, 0) % 360);
  const galv = SCENE.metal;
  return (
    <Place x={x} y={y} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={4} cy={0} rx={150} ry={7} opacity={0.75} />
      <ContactShadow cx={0} cy={0} rx={34} ry={5} />
      <LinearGradient id={`${id}-side`} stops={[[0, tint(galv, 0.3)], [0.35, galv], [0.75, shade(galv, 0.08)], [1, shade(galv, 0.22)]]} />
      <LinearGradient id={`${id}-stal`} stops={[[0, SCENE.metalLight], [0.5, SCENE.metal], [1, SCENE.metalDark]]} />
      <LinearGradient id={`${id}-plast`} stops={[[0, tint(TRIM, 0.22)], [0.6, TRIM], [1, shade(TRIM, 0.3)]]} />
      <RadialGradient id={`${id}-dekk`} stops={[[0.6, SCENE.rubberLight], [0.8, SCENE.rubber], [1, shade(SCENE.rubber, 0.25)]]} />

      {/* Dragstang (A-ramma sett fra siden) fra kassa fram til kulekoblingen */}
      <path
        d={`M${BOX - 8},${SIDE_BOT}L${BALL.x - 32},${BALL.y - 6}L${BALL.x - 32},${BALL.y + 3}L${BOX - 8},${SIDE_BOT + 9}Z`}
        fill={`url(#${id}-stal)`}
        stroke={SCENE.outline}
        strokeWidth={sw(0.8)}
        strokeLinejoin="round"
      />
      <path d={`M${BOX - 6},${SIDE_BOT + 1.5}L${BALL.x - 33},${BALL.y - 4.5}`} stroke={SCENE.highlight} strokeWidth={sw(1)} strokeLinecap="round" />

      {/* Støttehjulet, sveivet opp under kjøring */}
      <g>
        <rect x={203} y={-74} width={20} height={4} rx={2} fill={TRIM} />
        <rect x={210} y={-71} width={6} height={44} rx={1.5} fill={`url(#${id}-stal)`} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <rect x={206} y={-52} width={14} height={8} rx={1.5} fill={shade(galv, 0.15)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <path d="M211,-29L211,-19M215,-29L215,-19" stroke={SCENE.metalDark} strokeWidth={sw(1.6)} />
        <circle cx={213} cy={-17} r={8} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <circle cx={213} cy={-17} r={3.2} fill={SCENE.metal} />
      </g>

      {/* Ledningen til lysene, som henger ned mellom dragstanga og stikkontakten på bilen */}
      <path d={`M${BALL.x - 46},${BALL.y + 2}C${BALL.x - 30},${BALL.y + 18} ${BALL.x - 2},${BALL.y + 18} ${BALL.x + 12},${BALL.y + 10}`} fill="none" stroke={TRIM} strokeWidth={sw(1.6)} strokeLinecap="round" />

      {/* Kulekoblingen: et hus som griper om kula på bilen, med håndtak oppå */}
      <path
        d={`M${BALL.x - 34},${BALL.y - 8}L${BALL.x - 10},${BALL.y - 11}C${BALL.x + 1},${BALL.y - 12} ${BALL.x + 10},${BALL.y - 8} ${BALL.x + 11},${BALL.y - 1}C${BALL.x + 11},${BALL.y + 5} ${BALL.x + 7},${BALL.y + 8} ${BALL.x + 1},${BALL.y + 8}L${BALL.x - 6},${BALL.y + 8}C${BALL.x - 10},${BALL.y + 8} ${BALL.x - 12},${BALL.y + 5} ${BALL.x - 16},${BALL.y + 4}L${BALL.x - 34},${BALL.y + 4}Z`}
        fill={`url(#${id}-stal)`}
        stroke={SCENE.outline}
        strokeWidth={sw(0.8)}
        strokeLinejoin="round"
      />
      <path
        d={`M${BALL.x - 26},${BALL.y - 10}L${BALL.x - 4},${BALL.y - 17}`}
        stroke={SCENE.outline}
        strokeWidth={sw(4.6)}
        strokeLinecap="round"
      />
      <path d={`M${BALL.x - 26},${BALL.y - 10}L${BALL.x - 4},${BALL.y - 17}`} stroke={PAINTS.rod} strokeWidth={sw(3)} strokeLinecap="round" />

      {/* Ramme under kassa */}
      <rect x={-BOX + 6} y={SIDE_BOT} width={2 * BOX - 12} height={8} rx={1.5} fill={shade(galv, 0.25)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />

      {/* Storsekkene med ved (bak sidene, så bare toppen synes over kanten) */}
      {SACK_X.map((sx, i) => (
        <Storsekk key={i} cx={sx * 100} bottom={FLOOR} fill={clamp01(fill[i] ?? 0)} seed={i + 3} sw={sw} />
      ))}

      {/* Sida i galvanisert stål med to pregede riller, hjørnestolper og overkant */}
      <rect x={-BOX} y={SIDE_TOP} width={2 * BOX} height={SIDE_BOT - SIDE_TOP} rx={2} fill={`url(#${id}-side)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
      {[-80, -68].map((ry) => (
        <g key={ry}>
          <line x1={-BOX + 8} x2={BOX - 8} y1={ry} y2={ry} stroke={shade(galv, 0.28)} strokeWidth={sw(1.2)} />
          <line x1={-BOX + 8} x2={BOX - 8} y1={ry + 1.6} y2={ry + 1.6} stroke={SCENE.highlight} strokeWidth={sw(1)} />
        </g>
      ))}
      <rect x={-BOX - 1} y={SIDE_TOP - 3} width={2 * BOX + 2} height={4.5} rx={1.5} fill={tint(galv, 0.35)} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      <path d={`M${-BOX},${SIDE_TOP}L${-BOX + 7},${SIDE_TOP}L${-BOX + 7},${SIDE_BOT}L${-BOX},${SIDE_BOT}ZM${BOX - 7},${SIDE_TOP}L${BOX},${SIDE_TOP}L${BOX},${SIDE_BOT}L${BOX - 7},${SIDE_BOT}Z`} fill={shade(galv, 0.12)} />
      <line x1={0} x2={0} y1={SIDE_TOP + 2} y2={SIDE_BOT - 1} stroke={shade(galv, 0.2)} strokeWidth={sw(1)} opacity={0.7} />
      {/* Refleks på sida og lyktene bak */}
      <rect x={BOX - 26} y={SIDE_BOT - 8} width={10} height={4} rx={1} fill={PAINTS.oransje} />
      <rect x={-BOX + 16} y={SIDE_BOT - 8} width={10} height={4} rx={1} fill={PAINTS.oransje} />
      <rect x={-BOX - 4} y={SIDE_BOT - 1} width={16} height={8} rx={2} fill={TRIM} />
      <rect x={-BOX - 4} y={SIDE_BOT} width={9} height={6} rx={1.5} fill={TAIL} />

      {/* Skjermen over hjulet og hjulet (stålfelg med fire bolter) */}
      <path d={fenderPath(WHEEL_R)} fill={`url(#${id}-plast)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      <g transform={`translate(0 ${-WHEEL_R})`}>
        <circle r={WHEEL_R} fill={`url(#${id}-dekk)`} stroke={SCENE.outline} strokeWidth={sw(1)} />
        <circle r={16.5} fill={`url(#${id}-stal)`} stroke={shade(SCENE.metalDark, 0.3)} strokeWidth={sw(0.8)} />
        <circle r={12} fill="none" stroke={shade(galv, 0.2)} strokeWidth={sw(1)} />
        <g transform={spin ? `rotate(${spin})` : undefined}>
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx={r2(7 * Math.cos((a * Math.PI) / 180))} cy={r2(7 * Math.sin((a * Math.PI) / 180))} r={1.6} fill={SCENE.metalDark} />
          ))}
          <circle r={4} fill={SCENE.metalLight} stroke={SCENE.metalDark} strokeWidth={sw(0.6)} />
          <rect x={-1} y={-15.5} width={2} height={4} rx={1} fill={shade(galv, 0.35)} />
        </g>
      </g>
    </Place>
  );
}

/** Skjermen over hjulet: en bue i svart plast rundt den øvre delen av hjulet, med en flat kant ut til sidene. */
function fenderPath(r: number): string {
  const cy = -r;
  const ro = r + 9;
  const ri = r + 4;
  const a0 = (200 * Math.PI) / 180;
  const a1 = (340 * Math.PI) / 180;
  const p = (rad: number, a: number) => `${r2(rad * Math.cos(a))},${r2(cy + rad * Math.sin(a))}`;
  return `M${p(ri, a0)}L${p(ro, a0)}A${ro},${ro} 0 0 1 ${p(ro, a1)}L${p(ri, a1)}A${ri},${ri} 0 0 0 ${p(ri, a0)}Z`;
}

/** Storsekk i hvit, vevd plast med løfteløkker og kløyvd ved som stikker opp. (cx, bottom) er midt på bunnen. */
function Storsekk({ cx, bottom, fill, seed, sw }: { cx: number; bottom: number; fill: number; seed: number; sw: (w: number) => number }) {
  const id = useSvgId('storsekk');
  if (fill < 0.02) return null;
  const w = SACK_W * 100;
  const h = Math.max(14, HENGER_MAAL.sekk * 100 * fill);
  const top = bottom - h;
  const bag = mix(PAINTS.hvit, SCENE.wall, 0.25);
  const half = w / 2;
  const bulge = 3 + 3 * fill;
  const body = `M${r2(cx - half + 2)},${bottom}Q${r2(cx - half - bulge)},${r2((bottom + top) / 2)} ${r2(cx - half)},${r2(top + 3)}Q${r2(cx)},${r2(top + 7)} ${r2(cx + half)},${r2(top + 3)}Q${r2(cx + half + bulge)},${r2((bottom + top) / 2)} ${r2(cx + half - 2)},${bottom}Z`;
  // Veden: kubbeender i en haug som er høyest på midten, og et par kubber sett fra siden bak dem.
  const rand = sceneRandom(seed * 97 + 11);
  const ends: { x: number; y: number; r: number }[] = [];
  const mound = HENGER_MAAL.ved * 100;
  for (let i = 0; i < 10; i++) {
    const u = (i + 0.5) / 10 - 0.5 + (rand() - 0.5) * 0.06;
    const x = cx + u * (w - 16);
    const r = 4.6 + rand() * 2.6;
    const y = top + 5 - mound * (1 - (2 * u) ** 2) * (0.55 + 0.45 * rand());
    ends.push({ x, y, r });
  }
  ends.sort((a, b) => a.y - b.y);
  return (
    <g>
      <LinearGradient id={`${id}-pose`} x2={1} y2={0} stops={[[0, tint(bag, 0.25)], [0.4, bag], [1, shade(bag, 0.2)]]} />
      <RadialGradient id={`${id}-ende`} fx={0.4} fy={0.4} stops={[[0, tint(SCENE.woodLight, 0.15)], [0.7, SCENE.woodLight], [1, SCENE.wood]]} />
      {/* Kubber sett fra siden (bark) bak kubbeendene */}
      <path
        d={`M${r2(cx - half + 8)},${r2(top + 2)}L${r2(cx - 6)},${r2(top - mound * 0.8)}L${r2(cx + 10)},${r2(top - mound * 0.75)}L${r2(cx + half - 6)},${r2(top + 2)}Z`}
        fill={SCENE.trunk}
        stroke={SCENE.outline}
        strokeWidth={sw(0.6)}
        strokeLinejoin="round"
      />
      {ends.map((e, i) => (
        <g key={i}>
          <circle cx={r2(e.x)} cy={r2(e.y)} r={r2(e.r)} fill={`url(#${id}-ende)`} stroke={shade(SCENE.trunk, 0.15)} strokeWidth={sw(1.1)} />
          <circle cx={r2(e.x)} cy={r2(e.y)} r={r2(e.r * 0.42)} fill="none" stroke={SCENE.wood} strokeWidth={sw(0.6)} opacity={0.8} />
        </g>
      ))}
      {/* Sekken (dekker den nederste delen av veden), sømmer og løfteløkker */}
      <path d={body} fill={`url(#${id}-pose)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
      <path
        d={`M${r2(cx - half + 10)},${r2(top + 8)}L${r2(cx - half + 11)},${bottom - 2}M${r2(cx + half - 10)},${r2(top + 8)}L${r2(cx + half - 11)},${bottom - 2}`}
        stroke={shade(bag, 0.22)}
        strokeWidth={sw(0.9)}
        opacity={0.7}
      />
      <path d={`M${r2(cx - half + 2)},${r2(top + 5)}Q${r2(cx)},${r2(top + 9)} ${r2(cx + half - 2)},${r2(top + 5)}`} fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.2)} />
      {[-1, 1].map((s) => (
        <path
          key={s}
          d={`M${r2(cx + s * (half - 3))},${r2(top + 5)}Q${r2(cx + s * (half - 9))},${r2(top - 9)} ${r2(cx + s * (half - 16))},${r2(top + 6)}`}
          fill="none"
          stroke={shade(PAINTS.blaa, 0.05)}
          strokeWidth={sw(2.2)}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/* ================================================================================================
 * Hengerfestet bak på bilen
 * ============================================================================================== */

/**
 * Hengerfeste bak på bilen: en svart stålbøyle som kommer fram under støtfangeren, med kula øverst. Tegnes før
 * Bil (så bilen dekker roten) og før Tilhenger (så kulekoblingen griper over kula). (x, y) er ankerpunktet til
 * bilen (bakken midt mellom hjulene); kula er 2,26 m bak og 0,42 m over det.
 */
export function Hengerfeste({ x, y, pxPerM, dim }: { x: number; y: number; pxPerM: number; dim?: boolean }) {
  const ss = useStrokeScale();
  const k = Math.max(0.01, num(pxPerM, 56)) / 100;
  const sw = (w: number) => (w * ss) / k;
  return (
    <Place x={x} y={y} scale={k} opacity={dim ? SCENE_DIM : undefined}>
      <path d="M-196,-25C-212,-26 -222,-29 -225,-36L-226,-41" fill="none" stroke={SCENE.outline} strokeWidth={sw(6.2)} strokeLinecap="round" />
      <path d="M-196,-25C-212,-26 -222,-29 -225,-36L-226,-41" fill="none" stroke={TRIM} strokeWidth={sw(4.6)} strokeLinecap="round" />
      <rect x={-214} y={-34} width={6} height={7} rx={1.2} fill={TRIM} stroke={SCENE.outline} strokeWidth={sw(0.5)} />
      <circle cx={-226} cy={-42} r={2.6} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
    </Place>
  );
}

/** Kula i hengerfestet i forhold til ankerpunktet til bilen (m): 2,26 m bak og 0,42 m over bakken. */
export const KULE = { bak: 2.26, hoyde: HENGER_MAAL.koblingHoyde } as const;

/* ================================================================================================
 * Systemgrense og forkortet kraftpil
 * ============================================================================================== */

/**
 * Systemgrensen: stiplet ramme med avrundede hjørner rundt det som er med i systemet, med en svak tone inni og en
 * glorie, så den synes oppå himmel, vei og bil.
 */
export function Systemgrense({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ss = useStrokeScale();
  if (!(w > 0 && h > 0)) return null;
  return (
    <g aria-hidden className="kk-grense">
      <rect x={x} y={y} width={w} height={h} rx={14} fill={alpha(BOUNDARY, 0.07)} stroke={VIZ.surface} strokeWidth={5 * ss} opacity={0.75} />
      <rect x={x} y={y} width={w} height={h} rx={14} fill="none" stroke={BOUNDARY} strokeWidth={2.2 * ss} strokeDasharray={`${9 * ss} ${6 * ss}`} />
    </g>
  );
}

/**
 * Kraftpil med brudd i skaftet: kraften er mye større enn de andre pilene og er tegnet forkortet (ikke i samme
 * målestokk). Bruddet er et skrått gap i skaftet midt mellom angrepspunktet og spissen.
 */
export function BruttPil({
  x1,
  y1,
  x2,
  y2,
  color,
  label,
  labelX,
  labelY,
  labelAnchor,
  origin,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label?: ReactNode;
  labelX?: number;
  labelY?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  origin?: boolean;
}) {
  const ss = useStrokeScale();
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!Number.isFinite(len) || len < 24) return null;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = -uy;
  const ny = ux;
  // Bruddet: to skrå streker over skaftet med et smalt gap i flatefargen mellom.
  const c = 0.42 * len;
  const gap = 4.5 * ss;
  const reach = 9 * ss;
  const slant = 3.5 * ss;
  const pt = (t: number, s: number) => `${r2(x1 + ux * t + nx * s)},${r2(y1 + uy * t + ny * s)}`;
  const cut = (t: number) => `M${pt(t - slant, -reach)}L${pt(t + slant, reach)}`;
  const gapPath = `M${pt(c - gap / 2 - slant, -reach)}L${pt(c + gap / 2 - slant, -reach)}L${pt(c + gap / 2 + slant, reach)}L${pt(c - gap / 2 + slant, reach)}Z`;
  return (
    <g>
      <ForceArrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} label={label} labelX={labelX} labelY={labelY} labelAnchor={labelAnchor} origin={origin} />
      <path d={gapPath} fill={VIZ.surface} />
      <path d={`${cut(c - gap / 2)}${cut(c + gap / 2)}`} stroke={shade(color, 0.2)} strokeWidth={1.6 * ss} strokeLinecap="round" />
    </g>
  );
}

/** Etikett med navnet på kraften og verdien under: «F = 3 300 N» over «veien på bilen». */
export function KraftTekst({ x, y, anchor, color, name, value, what }: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; color: string; name: ReactNode; value?: string; what?: string }) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={y} anchor={anchor} color={color} weight={720}>
        {name}
        {value !== undefined && <> = {value}</>}
      </Txt>
      {what && (
        <Txt x={x} y={y + 15 * f} anchor={anchor} color={color} size={0.75} weight={600}>
          {what}
        </Txt>
      )}
    </g>
  );
}

/* ================================================================================================
 * Lupe på hengerfestet
 * ============================================================================================== */

interface HengerLupeProps {
  /** Midten og radiusen til lupen. */
  cx: number;
  cy: number;
  r: number;
  /** Kula i scenen (det lupen forstørrer) og radiusen til ringen rundt den. */
  tx: number;
  ty: number;
  tr: number;
  /** Lakken på bilen (samme som på Bil). */
  lakk: string;
  /** Hvilke deler som er med i systemet (de andre tones ned), og om kreftene skal vises. */
  withH: boolean;
  withB: boolean;
  showForces: boolean;
}

/**
 * Lupe som forstørrer hengerfestet: kula på bilen (stålbøyle under støtfangeren), kulekoblingen på hengeren som
 * griper over kula, håndtaket, bruddwiren og ledningen til lysene. Med `showForces` viser to piler kraftparet i
 * kula: bilen drar hengeren fremover og hengeren drar bilen bakover, like store (stiplet når begge er i systemet).
 * Pilene i lupen er et nærbilde av retningene, ikke i samme målestokk som pilene i scenen.
 * En ring rundt kula i scenen og en strek viser hva lupen forstørrer. Ankerpunkt: (cx, cy) er midten av lupen.
 */
export function HengerLupe({ cx, cy, r, tx, ty, tr, lakk, withH, withB, showForces }: HengerLupeProps) {
  const ss = useStrokeScale();
  const clip = useSvgId('kulelupe');
  const paintId = useSvgId('kulelupe-lakk');
  const steelId = useSvgId('kulelupe-stal');
  const ballId = useSvgId('kulelupe-kule');
  if (!(r > 8) || ![cx, cy, tx, ty, tr].every(Number.isFinite)) return null;
  // Lupen viser ca. 42 cm: 1 cm = r/21. Kula ligger litt over midten, så støtfangerkanten og bøylen synes.
  const z = r / 21;
  const bx = cx;
  const by = cy - 4 * z;
  const P = (x: number, y: number) => `${r2(bx + x * z)},${r2(by + y * z)}`;
  const w = (cm: number) => cm * z;
  const car = { opacity: withB ? 1 : SCENE_DIM };
  const trailer = { opacity: withH ? 1 : SCENE_DIM };
  const internal = withH && withB;
  const L = 0.66 * r;

  // Streken fra ringen rundt kula ut til lupen
  const dx = cx - tx;
  const dy = cy - ty;
  const d = Math.hypot(dx, dy) || 1;
  const lx1 = tx + (dx / d) * tr;
  const ly1 = ty + (dy / d) * tr;
  const lx2 = cx - (dx / d) * (r + 2);
  const ly2 = cy - (dy / d) * (r + 2);

  const rand = sceneRandom(29);
  let grains = '';
  for (let i = 0; i < 22; i++) {
    const gx = cx - r + rand() * 2 * r;
    const gy = cy - r + rand() * 2 * r;
    const gr = (0.5 + rand() * 0.9) * ss;
    grains += `M${r2(gx - gr)},${r2(gy)}a${r2(gr)},${r2(gr)} 0 1,0 ${r2(2 * gr)},0a${r2(gr)},${r2(gr)} 0 1,0 ${r2(-2 * gr)},0`;
  }

  return (
    <g aria-hidden>
      <g fill="none" strokeLinecap="round">
        <circle cx={tx} cy={ty} r={tr} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.85} />
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={VIZ.surface} strokeWidth={3.6 * ss} opacity={0.85} />
        <circle cx={tx} cy={ty} r={tr} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={VIZ.ink} strokeWidth={1.4 * ss} />
      </g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <LinearGradient id={paintId} stops={[[0, tint(lakk, 0.18)], [0.6, lakk], [1, shade(lakk, 0.3)]]} />
      <LinearGradient id={steelId} stops={[[0, SCENE.metalLight], [0.5, SCENE.metal], [1, SCENE.metalDark]]} />
      <RadialGradient id={ballId} fx={0.35} fy={0.3} stops={[[0, SCENE.metalLight], [0.5, SCENE.metal], [1, SCENE.metalDark]]} />
      <circle cx={cx + 2} cy={cy + 3} r={r + 1} fill={alpha(SCENE.shadow, 0.35)} />
      <g clipPath={`url(#${clip})`}>
        {/* Bak hengerfestet: veibanen i det andre feltet */}
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={mix(SCENE.asphalt, SCENE.skyBottom, 0.12)} />
        <path d={grains} fill={tint(SCENE.asphalt, 0.3)} opacity={0.7} />

        {/* Bilen: støtfangeren bak (lakk), diffusor i svart plast og en refleks */}
        <g {...car}>
          <path d={`M${P(12, -40)}L${P(12, 15)}Q${P(12, 21)} ${P(18, 21)}L${P(40, 21)}L${P(40, -40)}Z`} fill={`url(#${paintId})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
          <path d={`M${P(13, 13)}L${P(40, 13)}L${P(40, 21)}L${P(18, 21)}Q${P(13, 21)} ${P(13, 16)}Z`} fill={TRIM} />
          <rect x={bx + w(13.2)} y={by + w(-2)} width={w(2.6)} height={w(9)} rx={w(0.8)} fill={TAIL} />
          <path d={`M${P(12.8, -40)}L${P(12.8, 10)}`} stroke={SCENE.highlight} strokeWidth={1.2 * ss} />
          {/* Bøylen fra under støtfangeren opp til kula, og stikkontakten for lysene */}
          <path d={`M${P(24, 27)}C${P(10, 26)} ${P(1, 20)} ${P(0, 8)}L${P(0, 2)}`} fill="none" stroke={SCENE.outline} strokeWidth={w(4.4)} strokeLinecap="round" />
          <path d={`M${P(24, 27)}C${P(10, 26)} ${P(1, 20)} ${P(0, 8)}L${P(0, 2)}`} fill="none" stroke={TRIM} strokeWidth={w(3.4)} strokeLinecap="round" />
          <rect x={bx + w(4.5)} y={by + w(13)} width={w(6)} height={w(6)} rx={w(1.2)} fill={TRIM} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <circle cx={bx + w(7.5)} cy={by + w(16)} r={w(1.6)} fill={tint(TRIM, 0.2)} />
          <circle cx={bx} cy={by} r={w(2.5)} fill={`url(#${ballId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
        </g>

        {/* Hengeren: dragstanga, kulekoblingen over kula, håndtaket, bruddwiren og ledningen */}
        <g {...trailer}>
          <path d={`M${P(-40, -5.5)}L${P(-24, -6.5)}L${P(-24, 1)}L${P(-40, 1)}Z`} fill={`url(#${steelId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
          <path
            d={`M${P(-26, -7.5)}L${P(-9, -9)}C${P(-3, -9.5)} ${P(3, -7)} ${P(3.8, -1.5)}C${P(4.1, 1.4)} ${P(3, 3)} ${P(1, 3)}L${P(-1.6, 3)}C${P(-3, 3)} ${P(-4, 1.6)} ${P(-6, 1.6)}L${P(-26, 2)}Z`}
            fill={`url(#${steelId})`}
            stroke={SCENE.outline}
            strokeWidth={1 * ss}
            strokeLinejoin="round"
          />
          <path d={`M${P(-24, -6.4)}L${P(-9, -7.8)}C${P(-4, -8.2)} ${P(0, -6.6)} ${P(1.8, -4)}`} fill="none" stroke={SCENE.highlight} strokeWidth={1.2 * ss} strokeLinecap="round" />
          <path d={`M${P(-20, -8.2)}L${P(-6, -13)}`} stroke={SCENE.outline} strokeWidth={w(3)} strokeLinecap="round" />
          <path d={`M${P(-20, -8.2)}L${P(-6, -13)}`} stroke={PAINTS.rod} strokeWidth={w(2.2)} strokeLinecap="round" />
          <path d={`M${P(-14, 2)}C${P(-15, 13)} ${P(-5, 18)} ${P(1, 13)}`} fill="none" stroke={SCENE.metalDark} strokeWidth={w(0.7)} />
          <path d={`M${P(-30, 2)}C${P(-22, 22)} ${P(0, 24)} ${P(6, 17)}`} fill="none" stroke={TRIM} strokeWidth={w(1.3)} strokeLinecap="round" />
        </g>

        {showForces && (
          <g>
            {withH && <ForceArrow x1={bx} y1={by} x2={bx + L} y2={by} color={VIZ.tension} width={6} dashed={internal} minLength={0.5} />}
            {withB && <ForceArrow x1={bx} y1={by} x2={bx - L} y2={by} color={VIZ.tension} width={6} dashed={internal} minLength={0.5} />}
            <circle cx={bx} cy={by} r={3.2 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.5 * ss} />
          </g>
        )}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={SCENE.outline} strokeWidth={1.6 * ss} />
      <circle cx={cx} cy={cy} r={r - 2.6 * ss} fill="none" stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.5} />
    </g>
  );
}
