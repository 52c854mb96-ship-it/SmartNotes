/**
 * Egne gjenstander til scenen i «Spektre»: den mørklagte skolelaben, glødelampa på en lampejekk, spektralrøret på
 * spenningskilden, glasskolben med kald gass, spalteplata, prismet på prismebordet og skjermen med spekteret, og
 * lysstrålene mellom dem. Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger, kontur og myk skygge.
 * Geometrien (hvor alt står, og hvor hver farge treffer skjermen) står i spektre-scene.ts.
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  ContactShadow,
  LinearGradient,
  Lyspaere,
  Lysstraale,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  bolgelengdeFarge,
  materialStops,
  mix,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { VISIBLE_MAX, VISIBLE_MIN } from './model';
import { GEAR, hitY, screenAt, screenCorners, screenPoint, type Pt, type SpectrumMode, type SpektreScene } from './spektre-scene';

/** En linje i spekteret som tegnes i scenen: bølgelengden (nm) og relativ styrke 0–1. */
export interface SceneLine {
  nm: number;
  I: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pts = (p: Pt[]) => p.map((q) => `${r2(q.x)},${r2(q.y)}`).join(' ');

/* ---------- Tekst på mørk bunn ---------- */

/** Lys tekst med mørk glorie (rommet er mørkt i begge temaene). `size` er relativ (1 = vanlig etikett) og vokser på mobil. */
export function DarkTxt({
  x,
  y,
  children,
  anchor = 'middle',
  size = 0.8,
  weight = 600,
  muted,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: number;
  muted?: boolean;
}) {
  const style: CSSProperties & Record<'--kj-fs', number> = {
    fill: muted ? mix(SCENE.star, SCENE.space, 0.3) : SCENE.star,
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

/* ---------- Rommet ---------- */

/**
 * Skolelaben med lyset slått av: mørk vegg, labbenk med lys kant og navnelapper på forkanten. Mørkt også i lyst tema
 * (spektre ses best i mørket). Lyskilden lyser opp veggen og benken rundt seg i sin egen farge.
 */
export function LabRom({ g, light, children }: { g: SpektreScene; light: string; children?: ReactNode }) {
  const ss = useStrokeScale();
  const clip = useSvgId('spektre-rom');
  const wallId = useSvgId('spektre-vegg');
  const topId = useSvgId('spektre-benk');
  const frontId = useSvgId('spektre-front');
  const haloId = useSvgId('spektre-glod');
  const W = g.width;
  const H = g.height;
  const wall = mix(SCENE.wall, SCENE.space, 0.74);
  const back = g.floorY - 0.03 * g.S;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} rx={12} />
        </clipPath>
      </defs>
      <LinearGradient id={wallId} stops={[[0, shade(wall, 0.3)], [0.75, wall], [1, mix(wall, SCENE.space, 0.2)]]} />
      <LinearGradient id={topId} stops={[[0, mix(SCENE.bench, SCENE.space, 0.62)], [1, mix(SCENE.bench, SCENE.space, 0.48)]]} />
      <LinearGradient id={frontId} stops={[[0, mix(SCENE.benchEdge, SCENE.space, 0.6)], [1, mix(SCENE.benchEdge, SCENE.space, 0.78)]]} />
      <RadialGradient
        id={haloId}
        userSpace
        cx={g.src.x}
        cy={g.src.y}
        r={0.62 * g.S}
        stops={[
          [0, light, 0.34],
          [0.3, light, 0.12],
          [1, light, 0],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={0} width={W} height={back} fill={`url(#${wallId})`} />
        {/* Fliser i veggen, nesten usynlige i mørket */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={W * t} y1={0} x2={W * t} y2={back} stroke={alpha(SCENE.star, 0.035)} strokeWidth={1 * ss} />
        ))}
        <line x1={0} y1={back * 0.45} x2={W} y2={back * 0.45} stroke={alpha(SCENE.star, 0.03)} strokeWidth={1 * ss} />
        <Persienner g={g} />
        <rect x={0} y={back} width={W} height={g.benchY - back} fill={`url(#${topId})`} />
        <rect x={0} y={g.benchY} width={W} height={H - g.benchY} fill={`url(#${frontId})`} />
        <rect x={0} y={g.benchY - 1} width={W} height={2.2 * ss} fill={alpha(SCENE.star, 0.16)} />
        <rect x={0} y={0} width={W} height={H} fill={`url(#${haloId})`} />
      </g>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Gjenstandene og lyset tegnes utenfor klippingen: Chrome tegner ellers et mørkt rektangel rundt streker med
          opacity inne i en gruppe med clip-path. Alt står uansett innenfor rammen. */}
      {children}
    </g>
  );
}

/** Vindu med persiennene trukket ned (rommet er mørklagt). Litt dagslys siver inn mellom lamellene. */
function Persienner({ g }: { g: SpektreScene }) {
  const ss = useStrokeScale();
  const { x1, x2, y1, y2 } = g.window;
  const frame = mix(SCENE.wall, SCENE.space, 0.82);
  const slat = mix(SCENE.wall, SCENE.space, 0.72);
  const pitch = 6 * Math.max(1, ss * 0.85);
  const n = Math.max(2, Math.floor((y2 - y1 - 6) / pitch));
  return (
    <g>
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={2} fill={frame} stroke={alpha(SCENE.star, 0.08)} strokeWidth={1 * ss} />
      {Array.from({ length: n }, (_, i) => {
        const y = y1 + 3 + i * pitch;
        return (
          <g key={i}>
            <rect x={x1 + 3} y={y} width={x2 - x1 - 6} height={pitch - 1.4} fill={slat} />
            <line x1={x1 + 4} y1={y + pitch - 0.9} x2={x2 - 4} y2={y + pitch - 0.9} stroke={alpha(SCENE.star, 0.1)} strokeWidth={0.8 * ss} />
          </g>
        );
      })}
      <line x1={(x1 + x2) / 2} y1={y1 + 2} x2={(x1 + x2) / 2} y2={y2 - 2} stroke={alpha(SCENE.star, 0.06)} strokeWidth={1 * ss} />
      <rect x={x1 - 4} y={y2 - 1} width={x2 - x1 + 8} height={3 * ss} rx={1} fill={mix(SCENE.wall, SCENE.space, 0.62)} />
    </g>
  );
}

/** Navnelappene på forkanten av benken. */
export function BenkeNavn({ g }: { g: SpektreScene }) {
  return (
    <g>
      {g.labels.map((l) => (
        <DarkTxt key={l.text} x={l.x} y={g.benchY + 8 + g.labelRowH * (l.row + 0.78)} size={0.8} weight={600}>
          {l.text}
        </DarkTxt>
      ))}
    </g>
  );
}

/* ---------- Lyskildene ---------- */

/** Ledning som ligger på benken og går ut av bildet til venstre (til stikkontakten). */
function Ledning({ from, g }: { from: Pt; g: SpektreScene }) {
  const ss = useStrokeScale();
  const y = g.floorY - 2;
  return (
    <path
      d={`M${r2(from.x)} ${r2(from.y)} C ${r2(from.x - 18)} ${r2(from.y)}, ${r2(from.x - 22)} ${r2(y)}, ${r2(from.x - 40)} ${r2(y)} L 2 ${r2(y + 1)}`}
      fill="none"
      stroke={mix(SCENE.rubber, SCENE.space, 0.2)}
      strokeWidth={0.008 * g.S * Math.max(1, ss * 0.8)}
      strokeLinecap="round"
    />
  );
}

/**
 * Lampejekk (labjekk) med en vanlig glødelampe (E27) i en fatning. Jekken løfter lampa så glødetråden står i samme
 * høyde som lyset i spektralrøret.
 */
export function Glodelampe({ g }: { g: SpektreScene }) {
  const ss = useStrokeScale();
  const plateId = useSvgId('spektre-jekk');
  const x = g.src.x;
  const w = 0.15 * g.S;
  const t = 0.012 * g.S;
  const top = g.jackTop;
  const bot = g.floorY;
  const armTop = top + t;
  const armBot = bot - t;
  const steel = SCENE.metal;
  const knobY = (armTop + armBot) / 2;
  return (
    <g>
      <Ledning from={{ x: x - 0.035 * g.S, y: top - 0.006 * g.S }} g={g} />
      <ContactShadow cx={x} cy={bot} rx={w * 0.56} opacity={0.8} />
      <LinearGradient id={plateId} stops={materialStops(steel, 1.3)} />
      {/* Saksearmene: to kryss, det bakerste mørkere */}
      {[
        { dx: 4, c: shade(steel, 0.45) },
        { dx: 0, c: shade(steel, 0.12) },
      ].map(({ dx, c }, i) => (
        <g key={i} stroke={c} strokeWidth={Math.max(2.2, 0.007 * g.S) * ss} strokeLinecap="round">
          <line x1={x - w * 0.38 + dx} y1={armBot} x2={x + w * 0.38 + dx} y2={armTop} />
          <line x1={x - w * 0.38 + dx} y1={armTop} x2={x + w * 0.38 + dx} y2={armBot} />
        </g>
      ))}
      {/* Skruen med rattet til høyre */}
      <line x1={x - w * 0.42} y1={knobY} x2={x + w * 0.62} y2={knobY} stroke={SCENE.metalLight} strokeWidth={1.6 * ss} />
      <rect x={x + w * 0.6} y={knobY - 0.016 * g.S} width={0.012 * g.S} height={0.032 * g.S} rx={2} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={x} cy={knobY} r={2.4 * ss} fill={SCENE.metalLight} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x - w / 2} y={bot - t} width={w} height={t} rx={t * 0.3} fill={`url(#${plateId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - w * 0.46} y={top} width={w * 0.92} height={t} rx={t * 0.3} fill={`url(#${plateId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Lyspaere x={x} y={top} size={g.bulbSize} lysstyrke={1} fatning modell="e27" title="Glødelampe som lyser" />
    </g>
  );
}

/** Spenningskilden er 0,085 m høy og 0,24 m bred, søylen bak røret 0,36 m og røret 0,26 m (vanlige mål i skolelaben). */
export function Spektralror({ g, glow, symbol }: { g: SpektreScene; glow: string; symbol: string }) {
  const ss = useStrokeScale();
  const caseId = useSvgId('spektre-kasse');
  const colId = useSvgId('spektre-soyle');
  const glassId = useSvgId('spektre-glass');
  const haloId = useSvgId('spektre-ror');
  const { S } = g;
  const x = g.src.x;
  const baseW = GEAR.supplyW * S;
  const baseH = GEAR.supplyH * S;
  const colW = GEAR.columnW * S;
  const baseTop = g.floorY - baseH;
  const casing = mix(PAINTS.graa, SCENE.rubber, 0.55);
  const bx = x - baseW * 0.42;
  const lamp = { x: bx + baseW * 0.13, y: baseTop + baseH * 0.52 };
  const tri = { x: bx + baseW * 0.36, y: baseTop + baseH * 0.56, s: 0.022 * S };
  const bulbW = 0.03 * S;
  const bulbH = 0.052 * S;
  const capW = 0.009 * S * Math.min(g.k, 1.4);
  const capTop = g.tubeTop + bulbH;
  const capBottom = g.tubeBottom - bulbH;
  const clampH = 0.026 * S;
  return (
    <g>
      <Ledning from={{ x: bx + 3, y: baseTop + baseH * 0.6 }} g={g} />
      <ContactShadow cx={bx + baseW / 2} cy={g.floorY} rx={baseW * 0.56} />
      <LinearGradient id={caseId} stops={materialStops(casing, 1.2)} />
      <LinearGradient id={colId} x2={1} y2={0} stops={[[0, tint(casing, 0.12)], [0.5, casing], [1, shade(casing, 0.3)]]} />
      <rect x={x - colW / 2} y={g.columnTop} width={colW} height={baseTop - g.columnTop + 2} rx={colW * 0.18} fill={`url(#${colId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={bx} y={baseTop} width={baseW} height={baseH} rx={baseH * 0.16} fill={`url(#${caseId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={bx + 2} y={baseTop + 1.5} width={baseW - 4} height={baseH * 0.16} rx={baseH * 0.08} fill={SCENE.highlight} opacity={0.3} />
      {/* Bryter, kontrollampe og varselskilt for høyspenning */}
      <rect x={bx + baseW * 0.64} y={baseTop + baseH * 0.3} width={baseW * 0.16} height={baseH * 0.42} rx={2} fill={shade(casing, 0.45)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={bx + baseW * 0.64 + 2} y={baseTop + baseH * 0.3 + 2} width={baseW * 0.16 - 4} height={baseH * 0.17} rx={1.5} fill={tint(casing, 0.35)} />
      <circle cx={lamp.x} cy={lamp.y} r={0.02 * S} fill={alpha(PAINTS.rod, 0.35)} />
      <circle cx={lamp.x} cy={lamp.y} r={0.009 * S} fill={tint(PAINTS.rod, 0.25)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <path
        d={`M${tri.x} ${tri.y - tri.s} L${tri.x + tri.s * 0.95} ${tri.y + tri.s * 0.7} L${tri.x - tri.s * 0.95} ${tri.y + tri.s * 0.7} Z`}
        fill={PAINTS.gul}
        stroke={shade(PAINTS.gul, 0.6)}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <path
        d={`M${tri.x + tri.s * 0.12} ${tri.y - tri.s * 0.5} L${tri.x - tri.s * 0.2} ${tri.y + tri.s * 0.1} L${tri.x + tri.s * 0.12} ${tri.y + tri.s * 0.05} L${tri.x - tri.s * 0.12} ${tri.y + tri.s * 0.55}`}
        fill="none"
        stroke={shade(PAINTS.gul, 0.75)}
        strokeWidth={Math.max(0.9, 0.005 * S) * ss}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Gløden rundt røret */}
      <RadialGradient
        id={haloId}
        userSpace
        cx={x}
        cy={(capTop + capBottom) / 2}
        r={(capBottom - capTop) * 0.85}
        stops={[
          [0, glow, 0.55],
          [0.35, glow, 0.2],
          [1, glow, 0],
        ]}
      />
      <ellipse cx={x} cy={(capTop + capBottom) / 2} rx={(capBottom - capTop) * 0.55} ry={(capBottom - capTop) * 0.85} fill={`url(#${haloId})`} />
      {/* Glassrøret: to vide ender med elektroder og et smalt kapillærrør som lyser sterkest */}
      <LinearGradient id={glassId} x2={1} y2={0} stops={[[0, alpha(SCENE.glass, 0.5)], [0.35, alpha(SCENE.highlight, 0.55)], [1, alpha(SCENE.glass, 0.35)]]} />
      {[g.tubeTop, capBottom].map((bt, i) => (
        <g key={i}>
          <rect x={x - bulbW / 2} y={bt} width={bulbW} height={bulbH} rx={bulbW * 0.45} fill={alpha(glow, 0.35)} stroke={SCENE.glassEdge} strokeWidth={0.9 * ss} />
          <line
            x1={x}
            x2={x}
            y1={i === 0 ? bt + 2 : bt + bulbH * 0.35}
            y2={i === 0 ? bt + bulbH * 0.65 : bt + bulbH - 2}
            stroke={SCENE.metal}
            strokeWidth={Math.max(1.2, 0.004 * S) * ss}
            strokeLinecap="round"
          />
        </g>
      ))}
      <rect x={x - capW / 2} y={capTop - 1} width={capW} height={capBottom - capTop + 2} fill={glow} stroke={SCENE.glassEdge} strokeWidth={0.8 * ss} />
      <rect x={x - capW * 0.18} y={capTop} width={capW * 0.36} height={capBottom - capTop} fill={tint(glow, 0.7)} />
      {[g.tubeTop - clampH * 0.45, g.tubeBottom - clampH * 0.55].map((cy, i) => (
        <rect key={i} x={x - bulbW * 0.75} y={cy} width={bulbW * 1.5} height={clampH} rx={clampH * 0.3} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      ))}
      {/* Merkelappen på røret: hvilken gass det er fylt med */}
      <DarkTxt x={x + bulbW * 0.95} y={g.tubeTop + bulbH * 0.75} anchor="start" size={0.72} weight={700}>
        {symbol}
      </DarkTxt>
    </g>
  );
}

/** Tynn stang med fot, som holder spalteplata, kolben og prismebordet. */
function Stang({ x, top, g, footW = 0.07 }: { x: number; top: number; g: SpektreScene; footW?: number }) {
  const ss = useStrokeScale();
  const rodId = useSvgId('spektre-stang');
  const fw = footW * g.S;
  const fh = 0.012 * g.S;
  const rw = Math.max(3, 0.01 * g.S) * Math.min(g.k, 1.3);
  return (
    <g>
      <ContactShadow cx={x} cy={g.floorY} rx={fw * 0.6} opacity={0.7} />
      <LinearGradient id={rodId} x2={1} y2={0} stops={[[0, tint(SCENE.metal, 0.25)], [0.45, SCENE.metal], [1, shade(SCENE.metal, 0.35)]]} />
      <rect x={x - rw / 2} y={top} width={rw} height={g.floorY - fh - top + 1} fill={`url(#${rodId})`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x - fw / 2} y={g.floorY - fh} width={fw} height={fh} rx={fh * 0.45} fill={mix(PAINTS.svart, SCENE.metal, 0.25)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/** Glasskolbe med kald gass, på en ring på ei stang. Lyset fra glødelampa går gjennom gassen. */
export function Gasskolbe({ g, tintColor }: { g: SpektreScene; tintColor: string }) {
  const ss = useStrokeScale();
  const glassId = useSvgId('spektre-kolbe');
  const { x, y, r } = g.flask;
  const neckW = r * 0.36;
  const neckTop = y - r * 1.75;
  return (
    <g>
      <Stang x={x} top={y + r * 0.9} g={g} />
      <RadialGradient
        id={glassId}
        fx={0.35}
        fy={0.3}
        stops={[
          [0, alpha(SCENE.highlight, 0.4)],
          [0.5, alpha(tintColor, 0.16)],
          [1, alpha(SCENE.glassEdge, 0.4)],
        ]}
      />
      <path
        d={`M${r2(x - neckW / 2)} ${r2(y - r * 0.93)} L${r2(x - neckW / 2)} ${r2(neckTop + neckW * 0.5)} Q${r2(x)} ${r2(neckTop - neckW * 0.6)} ${r2(x + neckW / 2)} ${r2(neckTop + neckW * 0.5)} L${r2(x + neckW / 2)} ${r2(y - r * 0.93)}`}
        fill={alpha(SCENE.glass, 0.35)}
        stroke={SCENE.glassEdge}
        strokeWidth={0.9 * ss}
      />
      <circle cx={x} cy={y} r={r} fill={`url(#${glassId})`} stroke={SCENE.glassEdge} strokeWidth={1 * ss} />
      <path d={`M${r2(x - r * 0.62)} ${r2(y - r * 0.2)} A${r2(r * 0.66)} ${r2(r * 0.66)} 0 0 1 ${r2(x - r * 0.12)} ${r2(y - r * 0.64)}`} fill="none" stroke={alpha(SCENE.highlight, 0.7)} strokeWidth={1.4 * ss} strokeLinecap="round" />
      {/* Ringen kolben står i */}
      <ellipse cx={x} cy={y + r * 0.9} rx={r * 0.62} ry={r * 0.16} fill="none" stroke={SCENE.metal} strokeWidth={2 * ss} />
    </g>
  );
}

/**
 * Spalteplata: ei svart metallplate med en smal, vannrett spalte, på ei stang. Plata står på skrå mot oss (samme
 * perspektiv som skjermen), så spalten synes. Bare lyset som går gjennom spalten, når prismet.
 */
export function Spalteplate({ g, lit }: { g: SpektreScene; lit: string }) {
  const ss = useStrokeScale();
  const plateId = useSvgId('spektre-plate');
  const { x, y, h } = g.slit;
  const w = 0.05 * g.S;
  const far = 0.9;
  const xl = x - w / 2;
  const xr = x + w / 2;
  const top = y - h / 2;
  const bot = y + h / 2;
  const fy = (v: number) => y + (v - y) * far;
  const gap = Math.max(1.6, 0.004 * g.S) * Math.min(g.k, 1.4);
  const black = mix(PAINTS.svart, SCENE.space, 0.2);
  return (
    <g>
      <Stang x={x} top={bot - 2} g={g} />
      <LinearGradient id={plateId} x2={1} y2={0} stops={[[0, shade(black, 0.2)], [1, tint(black, 0.12)]]} />
      <polygon points={pts([{ x: xl, y: fy(top) }, { x: xr, y: top }, { x: xr, y: bot }, { x: xl, y: fy(bot) }])} fill={`url(#${plateId})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Lyset som faller på plata rundt spalten */}
      <ellipse cx={x} cy={y} rx={w * 0.55} ry={h * 0.22} fill={alpha(lit, 0.22)} />
      <line x1={xl + 2} y1={y - gap / 2} x2={xr - 2} y2={y - gap / 2} stroke={tint(lit, 0.4)} strokeWidth={gap} strokeLinecap="round" />
    </g>
  );
}

/** Prismet av glass på et lite prismebord. Spissen peker opp, så lyset brytes ned mot grunnflaten. */
export function Prisme({ g }: { g: SpektreScene }) {
  const ss = useStrokeScale();
  const glassId = useSvgId('spektre-prisme');
  const tableId = useSvgId('spektre-bord');
  const p = g.prism;
  const tableR = p.a * 0.72;
  const tableH = 0.014 * g.S;
  const baseY = p.baseL.y;
  const inset = (q: Pt, k: number) => ({ x: p.c.x + (q.x - p.c.x) * k, y: p.c.y + (q.y - p.c.y) * k });
  return (
    <g>
      <Stang x={p.c.x} top={baseY + tableH} g={g} footW={0.09} />
      <LinearGradient id={tableId} stops={materialStops(mix(PAINTS.svart, SCENE.metal, 0.35), 1.4)} />
      <rect x={p.c.x - tableR} y={baseY + 1} width={tableR * 2} height={tableH} rx={tableH * 0.4} fill={`url(#${tableId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <LinearGradient
        id={glassId}
        x1={0}
        y1={0}
        x2={1}
        y2={1}
        stops={[
          [0, alpha(SCENE.highlight, 0.42)],
          [0.5, alpha(SCENE.glass, 0.3)],
          [1, alpha(SCENE.glassEdge, 0.45)],
        ]}
      />
      <polygon points={pts([p.apex, p.baseR, p.baseL])} fill={`url(#${glassId})`} stroke={tint(SCENE.glassEdge, 0.25)} strokeWidth={1.4 * ss} strokeLinejoin="round" />
      {/* Fasettene: en lys kant innenfor, som i slipt glass */}
      <polygon points={pts([inset(p.apex, 0.78), inset(p.baseR, 0.78), inset(p.baseL, 0.78)])} fill="none" stroke={alpha(SCENE.highlight, 0.28)} strokeWidth={1 * ss} strokeLinejoin="round" />
      <line x1={p.apex.x - 1.5} y1={p.apex.y + 4} x2={p.baseL.x + p.a * 0.18} y2={p.baseL.y - 3} stroke={alpha(SCENE.highlight, 0.55)} strokeWidth={1.3 * ss} strokeLinecap="round" />
    </g>
  );
}

/** Skjermen: en hvit plate på en fot, dreid litt mot oss så flaten synes. Spekteret (barna) tegnes på flaten. */
export function Skjerm({ g, children }: { g: SpektreScene; children?: ReactNode }) {
  const ss = useStrokeScale();
  const faceId = useSvgId('spektre-flate');
  const footId = useSvgId('spektre-fot');
  const clipId = useSvgId('spektre-skjermklipp');
  const [tl, tr, br, bl] = screenCorners(g);
  const { xL, xR } = g.screen;
  const footTop = g.screen.bottom;
  const white = mix(SCENE.star, SCENE.space, 0.62);
  return (
    <g>
      <ContactShadow cx={(xL + xR) / 2} cy={g.floorY} rx={(xR - xL) * 0.7} opacity={0.8} />
      <LinearGradient id={footId} stops={materialStops(mix(PAINTS.svart, SCENE.metal, 0.3), 1.3)} />
      <polygon
        points={pts([
          { x: xL + 4, y: footTop - 2 },
          { x: xR + 6, y: footTop - 2 },
          { x: xR + 6, y: g.floorY },
          { x: xL + 2, y: g.floorY - 3 },
        ])}
        fill={`url(#${footId})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <LinearGradient id={faceId} x2={1} y2={0} stops={[[0, shade(white, 0.25)], [1, white]]} />
      <defs>
        <clipPath id={clipId}>
          <polygon points={pts([tl, tr, br, bl])} />
        </clipPath>
      </defs>
      {/* Kanten på plata (den nære kanten har tykkelse) */}
      <polygon points={pts([tr, { x: tr.x + 3, y: tr.y + 1 }, { x: br.x + 3, y: br.y }, br])} fill={shade(white, 0.45)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <polygon points={pts([tl, tr, br, bl])} fill={`url(#${faceId})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </g>
  );
}

/* ---------- Lyset ---------- */

/** Farget lysstråle med glød (samme utseende som Lysstraale i scene-kit-et, men med en hvilken som helst farge). */
export function Straale({ from, to, color, width = 4, strength = 1, arrow = true }: { from: Pt; to: Pt; color: string; width?: number; strength?: number; arrow?: boolean }) {
  const ss = useStrokeScale();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const b = width * Math.max(1, ss * 0.9);
  const line = { x1: r2(from.x), y1: r2(from.y), x2: r2(to.x), y2: r2(to.y) };
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const a = b * 1.5 + 5 * ss;
  const head = [
    { x: mx + ux * a * 0.6, y: my + uy * a * 0.6 },
    { x: mx - ux * a * 0.4 - uy * a * 0.55, y: my - uy * a * 0.4 + ux * a * 0.55 },
    { x: mx - ux * a * 0.4 + uy * a * 0.55, y: my - uy * a * 0.4 - ux * a * 0.55 },
  ];
  return (
    <g>
      <line {...line} stroke={color} strokeWidth={b * 3.4} strokeLinecap="round" opacity={0.13 * strength} />
      <line {...line} stroke={color} strokeWidth={b} opacity={0.35 + 0.6 * strength} />
      <line {...line} stroke={tint(color, 0.6)} strokeWidth={b * 0.34} opacity={0.85 * strength} />
      {arrow && len > a * 3 && <polygon points={pts(head)} fill={color} stroke={shade(color, 0.55)} strokeWidth={1.1 * ss} strokeLinejoin="round" />}
    </g>
  );
}

const STEP = 5;
const SLICES: number[] = [];
for (let nm = VISIBLE_MIN; nm < VISIBLE_MAX; nm += STEP) SLICES.push(nm);

/**
 * Vifta av farger ut av prismet og fram til midtlinja på skjermen. Kontinuerlig og absorpsjon: alle fargene (et tynt
 * kileformet stykke per 5 nm), med mørke sprekker der gassen har tatt opp lys. Emisjon: én stråle per linje.
 * `mark` er linja ved markøren, som tegnes litt kraftigere.
 */
export function Vifte({ g, mode, lines, mark }: { g: SpektreScene; mode: SpectrumMode; lines: SceneLine[]; mark: number | null }) {
  const ss = useStrokeScale();
  const o = g.prism.outPt;
  const mid = g.screen.mid;
  if (mode === 'emisjon')
    return (
      <g>
        {lines.map((l) => {
          const hit = mark !== null && Math.abs(l.nm - mark) < 0.01;
          return (
            <Lysstraale
              key={l.nm}
              x1={o.x}
              y1={o.y}
              x2={mid}
              y2={hitY(g, l.nm)}
              bolgelengde={l.nm}
              bredde={(hit ? 3.6 : 1.6 + 1.6 * l.I) * Math.min(g.k, 1.3)}
              styrke={hit ? 1 : 0.4 + 0.6 * l.I}
              pil={false}
            />
          );
        })}
      </g>
    );
  const y380 = hitY(g, VISIBLE_MIN);
  const y750 = hitY(g, VISIBLE_MAX);
  return (
    <g>
      <polygon points={pts([o, { x: mid, y: y750 }, { x: mid, y: y380 }])} fill={alpha(SCENE.star, 0.07)} />
      {SLICES.map((nm) => (
        <polygon
          key={nm}
          points={pts([o, { x: mid, y: hitY(g, nm) }, { x: mid, y: hitY(g, nm + STEP) }])}
          fill={bolgelengdeFarge(nm + STEP / 2, false)}
          opacity={0.42}
          stroke={bolgelengdeFarge(nm + STEP / 2, false)}
          strokeOpacity={0.42}
          strokeWidth={0.6}
        />
      ))}
      {mode === 'absorpsjon' &&
        lines.map((l) => {
          const y = hitY(g, l.nm);
          const w = (1.2 + 1.2 * l.I) * ss;
          return <polygon key={l.nm} points={pts([o, { x: mid, y: y - w / 2 }, { x: mid, y: y + w / 2 }])} fill={SCENE.space} opacity={0.35 + 0.55 * l.I} />;
        })}
    </g>
  );
}

/**
 * Spekteret på skjermflaten: hver farge er en strek på tvers av skjermen (bildet av spalten), i perspektiv.
 * Tegnes inne i <Skjerm>.
 */
export function SkjermSpekter({ g, mode, lines, mark }: { g: SpektreScene; mode: SpectrumMode; lines: SceneLine[]; mark: number | null }) {
  const ss = useStrokeScale();
  const t0 = 0.1;
  const t1 = 0.9;
  const band = (a: number, b: number) => [screenPoint(g, a, t0), screenPoint(g, a, t1), screenPoint(g, b, t1), screenPoint(g, b, t0)];
  // Linjene i emisjonsspekteret begynner like før midtlinja, der strålen treffer, så strålen ikke ser ut til å knekke.
  const stroke = (nm: number): [Pt, Pt] =>
    mode === 'emisjon' ? [screenPoint(g, nm, 0.28), screenPoint(g, nm, 0.84)] : [screenPoint(g, nm, t0), screenPoint(g, nm, t1)];
  if (mode === 'emisjon')
    return (
      <g>
        {lines.map((l) => {
          const [a, b] = stroke(l.nm);
          const c = bolgelengdeFarge(l.nm, false);
          const w = (1.6 + 1.6 * l.I) * Math.max(1, ss * 0.9) * (mark !== null && Math.abs(l.nm - mark) < 0.01 ? 1.3 : 1);
          const hit = screenPoint(g, l.nm, 0.5);
          return (
            <g key={l.nm}>
              {/* Der strålen treffer, lyser skjermen litt opp */}
              <ellipse cx={hit.x} cy={hit.y} rx={(g.screen.xR - g.screen.xL) * 0.36} ry={w * 2.4} fill={c} opacity={0.16 * (0.4 + 0.6 * l.I)} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={w * 3.2} opacity={0.22 * (0.4 + 0.6 * l.I)} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={w} opacity={0.45 + 0.55 * l.I} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={tint(c, 0.6)} strokeWidth={w * 0.34} opacity={0.8 * l.I} strokeLinecap="round" />
            </g>
          );
        })}
      </g>
    );
  return (
    <g>
      {/* Lyset sprer seg litt rundt spekteret på den hvite flaten */}
      <polygon points={pts(band(VISIBLE_MAX + 12, VISIBLE_MIN - 6))} fill={alpha(SCENE.star, 0.12)} />
      {SLICES.map((nm) => (
        <polygon key={nm} points={pts(band(nm, nm + STEP))} fill={bolgelengdeFarge(nm + STEP / 2)} stroke={bolgelengdeFarge(nm + STEP / 2)} strokeWidth={0.6} />
      ))}
      {mode === 'absorpsjon' &&
        lines.map((l) => {
          const [a, b] = stroke(l.nm);
          return (
            <line key={l.nm} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={SCENE.space} strokeWidth={(1.4 + 1.4 * l.I) * Math.max(1, ss * 0.9)} opacity={0.4 + 0.55 * l.I} />
          );
        })}
    </g>
  );
}

/**
 * Markøren i scenen: en stiplet linje langs strålen med bølgelengden λ og en liten trekant ved kanten av skjermen,
 * der λ treffer.
 */
export function SkjermMarkor({ g, nm }: { g: SpektreScene; nm: number }) {
  const ss = useStrokeScale();
  const o = g.prism.outPt;
  const y = hitY(g, nm);
  const edge = screenAt(g, y, 1);
  const s = 7 * Math.min(g.k, 1.4);
  const tx = edge.x + 5 * ss;
  return (
    <g>
      <line x1={o.x} y1={o.y} x2={g.screen.mid} y2={y} stroke={alpha(SCENE.star, 0.55)} strokeWidth={1.1 * ss} strokeDasharray={`${4 * ss} ${4 * ss}`} />
      <path d={`M${r2(tx)} ${r2(edge.y)} l${r2(s * 1.5)} ${r2(-s)} v${r2(2 * s)} z`} fill={SCENE.star} stroke={SCENE.space} strokeWidth={1.2 * ss} strokeLinejoin="round" />
    </g>
  );
}
