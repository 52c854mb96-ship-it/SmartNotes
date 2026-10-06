/**
 * Scenen til «Curling: rett treff på en stein i ro»: et curlingark sett fra siden i en hall, med huset malt under isen,
 * to curlingsteiner, fartspiler, skilt med farten og et stroboskopbilde av posisjonene.
 *
 * Bare dette kapittelet trenger curlingarket og huset, så de ligger her og ikke i scene-kit-et (samme stil:
 * toninger fra core.tsx, SCENE-farger, kontur og myke skygger). Steinene er `Curlingstein` fra scene-kit-et.
 */
import { memo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  Curlingstein,
  ForceArrow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  ValueTag,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { HOUSE_RADII, SPEED, STONE_DIAMETER, stonesAt, strobeTimes, type CurlingHit, type CurlingTimeline } from './model-curling';

/** Fargene på steinene (lakken på håndtaket), også i søylediagrammet. */
export const RED_STONE = PAINTS.rod;
export const YELLOW_STONE = PAINTS.gul;

/** Hvor flatt huset ser ut sett skrått fra siden (høyde/bredde for ringene). */
const HOUSE_TILT = 0.16;

export interface CurlingLayout {
  W: number;
  H: number;
  /** Piksler per meter langs isen. */
  s: number;
  /** Piksler per m/s for fartspilene (fast i hele figuren). */
  K: number;
  /** Avstanden mellom steinene i starten og lengden på glidet etterpå (m), se curlingTimeline. */
  approach: number;
  after: number;
  /** Piksel-x for posisjonen x (m) langs isen; midten av huset er x = 0. */
  xOf: (x: number) => number;
  /** Midtlinja (der steinene står), bakkanten av isen og skinnene i stroboskopbildet. */
  lineY: number;
  iceTop: number;
  rail1: number;
  rail2: number;
  /** Diameteren på steinene i figuren. */
  D: number;
  /** Ønsket avstand mellom bildene i stroboskopbildet (m). */
  strobeSpacing: number;
}

/**
 * Plassering av alt i scenen. På smale skjermer (mobil) er figuren smalere (viewBox 520 i stedet for 800) og viser
 * et kortere stykke av isen, så steinene blir store nok. Skalaen er den samme for alle farter, så figuren står stille
 * når eleven endrer farten.
 */
export function curlingLayout(narrow: boolean, f: number): CurlingLayout {
  const W = narrow ? 520 : 800;
  const approach = narrow ? 0.65 : 1.2;
  const after = approach;
  const K = narrow ? 34 : 40;
  const left = 16;
  // Plass til høyre for den gule i slutten: den lengste fartspila (største fart) og litt luft.
  const right = 16 + SPEED.max * K + 10;
  const s = (W - left - right) / (approach + after + 1.5 * STONE_DIAMETER);
  const x0 = left + (1.5 * STONE_DIAMETER + approach) * s;
  const H = Math.round(narrow ? 250 + 70 * f : 300 + 40 * (f - 1));
  const rail2 = H - 12 - 22 * f;
  const rail1 = rail2 - 19 * f;
  const lineY = rail1 - 30 * f;
  return {
    W,
    H,
    s,
    K,
    approach,
    after,
    xOf: (x: number) => x0 + x * s,
    lineY,
    iceTop: lineY - HOUSE_RADII[0] * s * HOUSE_TILT - 26,
    rail1,
    rail2,
    D: STONE_DIAMETER * s,
    strobeSpacing: approach / 6,
  };
}

/* ---------- Hallen, isen og huset (statisk, memoisert) ---------- */

const CurlingSheet = memo(function CurlingSheet({ L }: { L: CurlingLayout }) {
  const ids = useSvgId('curling-ark');
  const ss = useStrokeScale();
  const { W, H, iceTop, lineY, s } = L;
  const bx = L.xOf(0);
  const boardH = 17;
  const boardTop = iceTop - boardH;

  // Småprikker i isen («pebble») og noen svake riper, med fast frø.
  const rnd = sceneRandom(41);
  let pebble = '';
  const n = Math.round((W * (H - iceTop)) / 520);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const v = rnd();
    const y = iceTop + 4 + v * (H - iceTop - 6);
    const r = 0.5 + 0.9 * v * rnd();
    pebble += `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r.toFixed(2)},${(r * 0.6).toFixed(2)} 0 1,0 ${(2 * r).toFixed(2)},0a${r.toFixed(2)},${(r * 0.6).toFixed(2)} 0 1,0 ${(-2 * r).toFixed(2)},0Z`;
  }
  let scratches = '';
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W;
    const y = iceTop + 8 + rnd() * (H - iceTop - 14);
    const len = 40 + rnd() * 120;
    scratches += `M${x.toFixed(1)},${y.toFixed(1)}l${len.toFixed(1)},${((rnd() - 0.5) * 3).toFixed(1)}`;
  }
  // Panelskjøter i veggen og i vantet
  let seams = '';
  for (let x = 70; x < W; x += 150) seams += `M${x},${boardTop + 2}V${iceTop - 2}`;
  let wallSeams = '';
  for (let x = 0; x < W; x += 230) wallSeams += `M${x + 115},0V${boardTop}`;

  // Ringene i huset er malt under isen: litt blekere enn lakken, og blått ytterst, hvitt, rødt og hvitt i midten.
  const under = (c: string) => mix(c, SCENE.ice, 0.32);
  const rings: { r: number; fill: string }[] = [
    { r: HOUSE_RADII[0], fill: under(PAINTS.blaa) },
    { r: HOUSE_RADII[1], fill: under(PAINTS.hvit) },
    { r: HOUSE_RADII[2], fill: under(PAINTS.rod) },
    { r: HOUSE_RADII[3], fill: under(PAINTS.hvit) },
  ];
  const line = SCENE.outline;

  return (
    <g aria-hidden>
      <defs>
        <clipPath id={`${ids}k`}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <LinearGradient
        id={`${ids}v`}
        stops={[
          [0, shade(SCENE.wall, 0.1)],
          [0.7, SCENE.wall],
          [1, SCENE.wallShade],
        ]}
      />
      <LinearGradient
        id={`${ids}b`}
        stops={[
          [0, tint(mix(PAINTS.blaa, SCENE.wall, 0.35), 0.12)],
          [1, shade(mix(PAINTS.blaa, SCENE.wall, 0.35), 0.18)],
        ]}
      />
      <LinearGradient
        id={`${ids}i`}
        userSpace
        x1={0}
        y1={iceTop}
        x2={0}
        y2={H}
        stops={[
          [0, mix(SCENE.ice, SCENE.iceShine, 0.55)],
          [0.35, SCENE.ice],
          [1, shade(SCENE.ice, 0.1)],
        ]}
      />
      <RadialGradient
        id={`${ids}g`}
        stops={[
          [0, SCENE.iceShine, 0.55],
          [1, SCENE.iceShine, 0],
        ]}
      />
      <g clipPath={`url(#${ids}k)`}>
        {/* Veggen i hallen med svake panelskjøter */}
        <rect x={0} y={0} width={W} height={boardTop + 1} fill={`url(#${ids}v)`} />
        <path d={wallSeams} stroke={SCENE.wallShade} strokeWidth={1.2 * ss} />
        <rect x={0} y={boardTop - 34} width={W} height={3} fill={SCENE.wallShade} opacity={0.8} />
        {/* Vantet langs siden av arket */}
        <rect x={0} y={boardTop} width={W} height={boardH} fill={`url(#${ids}b)`} />
        <rect x={0} y={boardTop} width={W} height={2.5} fill={SCENE.highlight} />
        <path d={seams} stroke={line} strokeWidth={0.8 * ss} opacity={0.35} />
        {/* Isen */}
        <rect x={0} y={iceTop} width={W} height={H - iceTop} fill={`url(#${ids}i)`} />
        {/* Speilbilde av vantet i den blanke isen */}
        <rect x={0} y={iceTop} width={W} height={boardH * 0.9} fill={mix(PAINTS.blaa, SCENE.ice, 0.55)} opacity={0.32} />
        <line x1={0} x2={W} y1={iceTop + 0.5} y2={iceTop + 0.5} stroke={line} strokeWidth={1 * ss} opacity={0.55} />
        {/* Huset, malt under isen */}
        {rings.map((ring) => (
          <ellipse key={ring.r} cx={bx} cy={lineY} rx={ring.r * s} ry={ring.r * s * HOUSE_TILT} fill={ring.fill} />
        ))}
        {rings.map((ring) => (
          <ellipse
            key={`k${ring.r}`}
            cx={bx}
            cy={lineY}
            rx={ring.r * s}
            ry={ring.r * s * HOUSE_TILT}
            fill="none"
            stroke={SCENE.iceShine}
            strokeWidth={0.8 * ss}
            opacity={0.6}
          />
        ))}
        {/* Midtlinja langs arket, t-linja gjennom midten av huset og baklinja bak huset */}
        <line x1={0} x2={W} y1={lineY} y2={lineY} stroke={line} strokeWidth={1.1 * ss} opacity={0.45} />
        <line x1={bx} x2={bx} y1={iceTop + 2} y2={H} stroke={line} strokeWidth={1.1 * ss} opacity={0.45} />
        <line x1={bx + HOUSE_RADII[0] * s} x2={bx + HOUSE_RADII[0] * s} y1={iceTop + 2} y2={H} stroke={line} strokeWidth={1.6 * ss} opacity={0.4} />
        {/* Glans fra taklysene og småprikker i isen */}
        {[0.16, 0.5, 0.84].map((u) => (
          <ellipse key={u} cx={W * u} cy={iceTop + (lineY - iceTop) * 0.55} rx={W * 0.13} ry={7} fill={`url(#${ids}g)`} />
        ))}
        <path d={scratches} stroke={SCENE.iceShine} strokeWidth={0.7 * ss} opacity={0.5} fill="none" />
        <path d={pebble} fill={SCENE.iceShine} opacity={0.55} />
      </g>
    </g>
  );
});

/* ---------- Skilt med farten ---------- */

/**
 * Skilt med farten over en stein, med en liten prikk i fargen til steinen og spiss ned mot den. Skiltet holdes
 * innenfor figuren, men spissen står alltid over steinen.
 */
function SpeedTag({ x, y, text, stone, W }: { x: number; y: number; text: string; stone: string; W: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const fs = 17 * f * 0.88;
  const dot = 5.5 * f;
  const w = text.length * fs * 0.57 + 22 * f + dot * 2;
  const h = fs * 1.55;
  const left = Math.min(W - 6 - w, Math.max(6, x - w / 2));
  const px = Math.min(left + w - 10, Math.max(left + 10, x));
  return (
    <g>
      <polygon
        points={`${px - 6 * ss},${y + h / 2 - 1} ${px + 6 * ss},${y + h / 2 - 1} ${px},${y + h / 2 + 7 * ss}`}
        fill={VIZ.surface}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h * 0.32} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.97} />
      <rect x={px - 6 * ss + 1} y={y + h / 2 - 2.5} width={12 * ss - 2} height={3} fill={VIZ.surface} />
      <circle cx={left + 9 * f + dot} cy={y} r={dot} fill={stone} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <Txt x={left + 15 * f + 2 * dot} y={y + fs * 0.34} anchor="start" size={0.88} color={VIZ.velocity} weight={700} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

/** Farten på et skilt: «v₁ = 2,00 m/s», «v₂′ = 0». */
function speedText(name: '1' | '2', after: boolean, u: number): string {
  const sym = `v${name === '1' ? '₁' : '₂'}${after ? '′' : ''}`;
  return Math.abs(u) < 0.005 ? `${sym} = 0` : `${sym} = ${fmt(u, 2)} m/s`;
}

/* ---------- Hele scenen ---------- */

export function CurlingScene({
  L,
  hit,
  tl,
  t,
  strobe,
  dt,
}: {
  L: CurlingLayout;
  hit: CurlingHit;
  tl: CurlingTimeline;
  t: number;
  /** Vis stroboskopbildet. */
  strobe: boolean;
  /** Tid mellom bildene i stroboskopbildet (s). */
  dt: number;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const st = stonesAt(hit, tl, t);
  const x1 = L.xOf(st.x1);
  const x2 = L.xOf(st.x2);
  const { lineY, D } = L;
  const stoneTop = lineY - D * 0.6;
  const arrowY = stoneTop - 12 * f;
  const tag1Y = arrowY - 27 * f;
  const tag2Y = tag1Y - 33 * f;

  // Smellet: noen korte streker ut fra kontaktpunktet like etter treffet
  const sinceHit = t - tl.tHit;
  const flash = sinceHit >= 0 && sinceHit < tl.tEnd * 0.07 && t < tl.tEnd - 1e-9;
  const cx = L.xOf(-STONE_DIAMETER / 2);
  const cy = lineY - D * 0.2;

  const times = strobe ? strobeTimes(tl, dt, t) : [];
  const shots = times.map((tt) => stonesAt(hit, tl, tt));

  return (
    <>
      <CurlingSheet L={L} />

      {/* Stroboskopbildet: midten av hver stein med like lang tid mellom bildene */}
      {strobe && (
        <g>
          {[L.rail1, L.rail2].map((y) => (
            <line key={y} x1={8} x2={L.W - 8} y1={y} y2={y} stroke={VIZ.surface} strokeWidth={3 * ss} opacity={0.55} />
          ))}
          {[L.rail1, L.rail2].map((y) => (
            <line key={`s${y}`} x1={8} x2={L.W - 8} y1={y} y2={y} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="4 4" />
          ))}
          {shots.map((p, i) => (
            <circle key={`a${i}`} cx={L.xOf(p.x1)} cy={L.rail1} r={4.6 * ss} fill={RED_STONE} stroke={SCENE.outline} strokeWidth={1 * ss} />
          ))}
          {shots.map((p, i) => (
            <circle key={`b${i}`} cx={L.xOf(p.x2)} cy={L.rail2} r={4.6 * ss} fill={YELLOW_STONE} stroke={SCENE.outline} strokeWidth={1 * ss} />
          ))}
          <Txt x={10} y={L.H - 8} anchor="start" size={0.74} muted>
            Stroboskopbilde: midten av steinene hvert {fmt(dt, 2)} s
          </Txt>
        </g>
      )}

      {/* Speilbilder i den blanke isen */}
      {[
        { x: x1, lakk: 'rod' },
        { x: x2, lakk: 'gul' },
      ].map((p) => (
        <g key={p.lakk} transform={`translate(${p.x.toFixed(2)} ${lineY.toFixed(2)}) scale(1 -0.55)`} opacity={0.13}>
          <Curlingstein x={0} y={0} size={D} lakk={p.lakk} skygge={false} />
        </g>
      ))}
      <Curlingstein x={x1} y={lineY} size={D} lakk="rod" title="Rød stein" />
      <Curlingstein x={x2} y={lineY} size={D} lakk="gul" title="Gul stein" />

      {flash && (
        <g stroke={VIZ.ink} strokeWidth={2 * ss} strokeLinecap="round">
          {[-60, -25, 25, 60].map((deg) => {
            const r0 = D * 0.42;
            const r1 = D * 0.68;
            const a = (deg * Math.PI) / 180;
            return <line key={deg} x1={cx + Math.sin(a) * 0} y1={cy - Math.cos(a) * r0} x2={cx + Math.sin(a) * r1 * 0.5} y2={cy - Math.cos(a) * r1} />;
          })}
        </g>
      )}

      {/* Fartspiler med fast skala (K px per m/s) */}
      <ForceArrow x1={x1} y1={arrowY} x2={x1 + st.u1 * L.K} y2={arrowY} color={VIZ.velocity} width={6} />
      <ForceArrow x1={x2} y1={arrowY} x2={x2 + st.u2 * L.K} y2={arrowY} color={VIZ.velocity} width={6} />

      <SpeedTag x={x1} y={tag1Y} text={speedText('1', st.after, st.u1)} stone={RED_STONE} W={L.W} />
      <SpeedTag x={x2} y={tag2Y} text={speedText('2', st.after, st.u2)} stone={YELLOW_STONE} W={L.W} />

      <ValueTag x={12} y={22 * f} anchor="start" text={st.after ? 'Etter støtet' : 'Før støtet'} size={0.9} />
    </>
  );
}
