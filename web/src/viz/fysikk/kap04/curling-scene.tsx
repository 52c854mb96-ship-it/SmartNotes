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
  SpeedLines,
  ValueTag,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { placeTagPair, textWidthEm } from './curling-plassering';
import { HOUSE_RADII, SPEED, STONE_DIAMETER, stonesAt, strobeTimes, type CurlingHit, type CurlingTimeline, type HitKind } from './model-curling';

/** Fargene på steinene (lakken på håndtaket), også i søylediagrammet. */
export const RED_STONE = PAINTS.rod;
export const YELLOW_STONE = PAINTS.gul;

/** Hvor flatt huset ser ut sett skrått fra siden (høyde/bredde for ringene). */
const HOUSE_TILT = 0.16;
/** Høyden på steinkroppen i forhold til diameteren (som i Curlingstein). */
const BODY = 0.39;
/** Relativ tekststørrelse på fartsskiltene og statusskiltet. */
const TAG_SIZE = 0.84;
const STATUS_SIZE = 0.88;
/** Luft mellom to skilt, og minste avstand fra spissen til kanten av skiltet. */
const TAG_GAP = 10;
const TAG_PAD = 14;

/** Størrelsen på et fartsskilt (prikk i steinens farge + tekst). */
export function tagSize(text: string, f: number): { w: number; h: number; fs: number; dot: number } {
  const fs = 17 * f * TAG_SIZE;
  const dot = 5.2 * f;
  return { w: 9 * f + 2 * dot + 7 * f + textWidthEm(text) * fs + 10 * f, h: fs * 1.6, fs, dot };
}

export interface CurlingLayout {
  W: number;
  H: number;
  /** Piksler per meter langs isen. */
  s: number;
  /** Piksler per m/s for fartspilene (fast i hele figuren), og den korteste pila farten før støtet får. */
  K: number;
  minArrow: number;
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
  /** Høyden på fartspilene, midten av skiltradene (0 nederst, 1 over) og statusskiltet. */
  arrowY: number;
  rowY: [number, number];
  statusY: number;
  /** Ønsket avstand mellom bildene i stroboskopbildet (m). */
  strobeSpacing: number;
}

/**
 * Plassering av alt i scenen. På smale skjermer (mobil) er figuren smalere (viewBox 520 i stedet for 800) og viser
 * et kortere stykke av isen, så steinene blir store nok. Skalaen er den samme for alle farter og støt, så figuren står
 * stille når eleven endrer noe. Skiltene står på én rad når de får plass ved siden av hverandre også når steinene
 * ligger inntil hverandre, ellers på to rader.
 */
export function curlingLayout(narrow: boolean, f: number): CurlingLayout {
  const W = narrow ? 520 : 800;
  const ss = Math.max(1, f * 0.75);
  const approach = narrow ? 0.55 : 1.2;
  const after = approach;
  const K = narrow ? 30 : 40;
  const left = 16;
  // Plass til høyre for den gule i slutten: den lengste fartspila (største fart) og litt luft.
  const right = 16 + SPEED.max * K + 10;
  const s = (W - left - right) / (approach + after + 1.5 * STONE_DIAMETER);
  const x0 = left + (1.5 * STONE_DIAMETER + approach) * s;
  const D = STONE_DIAMETER * s;
  const xOf = (x: number) => x0 + x * s;

  // Trenger skiltene to rader? Verst er det når steinene ligger inntil hverandre, i støtet og i slutten av et
  // fullstendig uelastisk støt, med de lengste tekstene.
  const wa = tagSize('v₁′ = 1,50 m/s', f).w;
  const wb = tagSize('v₂′ = 3,00 m/s', f).w;
  const needsTwo = [0, after / 2].some(
    (xb) => placeTagPair({ x: xOf(xb - STONE_DIAMETER), w: wa }, { x: xOf(xb), w: wb }, W, TAG_GAP, TAG_PAD).b.row === 1,
  );
  const rows = needsTwo ? 2 : 1;

  // Ovenfra: statusskiltet, skiltradene, fartspilene og steinene.
  const statusH = 17 * f * STATUS_SIZE * 1.55;
  const statusY = 8 + statusH / 2;
  const tagH = tagSize('v', f).h;
  const head = 8.7 * ss; // halve høyden på pilspissen
  const pointer = 7 * ss;
  const stoneH = 0.56 * D; // fra isen til toppen av håndtaket
  const fromLineToTopRow = stoneH + 10 * ss + 2 * head + pointer + 4 + tagH / 2 + (rows - 1) * (tagH + 6);
  const needLine = statusY + statusH / 2 + 8 + tagH / 2 + fromLineToTopRow;
  // Veggen i hallen skal synes litt over vantet.
  const ringRy = HOUSE_RADII[0] * s * HOUSE_TILT;
  const wallMin = narrow ? 50 : 62;
  const lineY = Math.max(needLine, wallMin + 17 + 22 + ringRy);
  const arrowY = lineY - stoneH - 10 * ss - head;
  const row0 = arrowY - head - 4 - pointer - tagH / 2;
  const row1 = row0 - tagH - 6;

  const rail1 = lineY + Math.max(30 * f, 0.36 * D);
  const rail2 = rail1 + 19 * f;
  const H = Math.round(rail2 + 10 + 17 * 0.74 * f + 8);
  return {
    W,
    H,
    s,
    K,
    minArrow: narrow ? 40 : 50,
    approach,
    after,
    xOf,
    lineY,
    iceTop: lineY - ringRy - 22,
    rail1,
    rail2,
    D,
    arrowY,
    rowY: [row0, row1],
    statusY,
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
  const railY = Math.round(boardTop * 0.42);

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
        {/* Veggen i hallen med svake panelskjøter og en list */}
        <rect x={0} y={0} width={W} height={boardTop + 1} fill={`url(#${ids}v)`} />
        <path d={wallSeams} stroke={SCENE.wallShade} strokeWidth={1.2 * ss} />
        <rect x={0} y={railY} width={W} height={3} fill={SCENE.wallShade} opacity={0.8} />
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
 * Skilt med farten over en stein, med en liten prikk i fargen til steinen og spiss ned mot den. `left` er venstre kant
 * av skiltet (fra placeTagPair), `x` er steinen spissen peker mot.
 */
function SpeedTag({ left, y, x, text, stone }: { left: number; y: number; x: number; text: string; stone: string }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { w, h, fs, dot } = tagSize(text, f);
  const px = Math.min(left + w - 10 * ss, Math.max(left + 10 * ss, x));
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
      <Txt x={left + 9 * f + 2 * dot + 7 * f} y={y + fs * 0.35} anchor="start" size={TAG_SIZE} color={VIZ.velocity} weight={700} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

/** Farten på et skilt: «v₁ = 2,00 m/s», «v₂′ = 0». */
export function speedText(name: '1' | '2', after: boolean, u: number): string {
  const sym = `v${name === '1' ? '₁' : '₂'}${after ? '′' : ''}`;
  return Math.abs(u) < 0.005 ? `${sym} = 0` : `${sym} = ${fmt(u, 2)} m/s`;
}

/* ---------- Borrelås og smell ---------- */

/** Borrelås på framsida (side = 1) eller baksida (side = −1) av en stein, sett fra siden. */
function Borrelaas({ x, y, D, side }: { x: number; y: number; D: number; side: 1 | -1 }) {
  const ss = useStrokeScale();
  const hb = BODY * D;
  const w = Math.max(3.6, 0.065 * D);
  const h = 0.5 * hb;
  const left = side === 1 ? x + 0.5 * D - 0.4 * w : x - 0.5 * D - 0.6 * w;
  const top = y - 0.5 * hb - h / 2;
  return (
    <g aria-hidden>
      <rect x={left} y={top} width={w} height={h} rx={1} fill={shade(PAINTS.svart, 0.05)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {[0.25, 0.5, 0.75].map((u) => (
        <line key={u} x1={left + 0.2 * w} x2={left + 0.8 * w} y1={top + u * h} y2={top + u * h} stroke={tint(PAINTS.svart, 0.45)} strokeWidth={0.8 * ss} />
      ))}
    </g>
  );
}

/** Korte streker ut fra kontaktpunktet like etter treffet (smellet). */
function Smell({ x, y, D }: { x: number; y: number; D: number }) {
  const ss = useStrokeScale();
  const r0 = 0.24 * D;
  const r1 = 0.44 * D;
  return (
    <g strokeLinecap="round" aria-hidden>
      {[-28, 0, 28].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const k = deg === 0 ? 1 : 0.85;
        const p = (r: number) => [x + Math.sin(a) * r, y - Math.cos(a) * r] as const;
        const [xa, ya] = p(r0);
        const [xb, yb] = p(r0 + (r1 - r0) * k);
        return (
          <g key={deg}>
            <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={VIZ.surface} strokeWidth={4.4 * ss} opacity={0.8} />
            <line x1={xa} y1={ya} x2={xb} y2={yb} stroke={VIZ.ink} strokeWidth={2 * ss} />
          </g>
        );
      })}
    </g>
  );
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
  const hb = BODY * D;
  // Skalaen for fartspilene er den samme for alle pilene i figuren. Ved små farter blir den større, så pila for
  // farten før støtet alltid er lang nok til å se (den får aldri plass til mer enn ved største fart).
  const K = Math.max(L.K, L.minArrow / Math.max(hit.v, 1e-6));

  // Smellet: like etter treffet, ikke når animasjonen er ferdig
  const sinceHit = t - tl.tHit;
  const flash = sinceHit >= 0 && sinceHit < tl.tEnd * 0.07 && t < tl.tEnd - 1e-9;

  const times = strobe ? strobeTimes(tl, dt, t) : [];
  const shots = times.map((tt) => stonesAt(hit, tl, tt));

  const text1 = speedText('1', st.after, st.u1);
  const text2 = speedText('2', st.after, st.u2);
  const tags = placeTagPair({ x: x1, w: tagSize(text1, f).w }, { x: x2, w: tagSize(text2, f).w }, L.W, TAG_GAP, TAG_PAD);

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

      {/* Fartsstreker bak steinene som glir (den gule bare så langt det er plass bak den, så de ikke havner på den røde) */}
      <SpeedLines x={x1 - D / 2} y={lineY - hb * 0.5} length={Math.min(0.9 * D, st.u1 * K * 0.42)} spread={hb * 0.8} />
      <SpeedLines x={x2 - D / 2} y={lineY - hb * 0.5} length={Math.min(0.9 * D, st.u2 * K * 0.42, x2 - x1 - D - 14)} spread={hb * 0.8} />

      <Curlingstein x={x1} y={lineY} size={D} lakk="rod" title="Rød stein" />
      <Curlingstein x={x2} y={lineY} size={D} lakk="gul" title="Gul stein" />
      {hit.kind === 'fullstendig' && (
        <>
          <Borrelaas x={x1} y={lineY} D={D} side={1} />
          <Borrelaas x={x2} y={lineY} D={D} side={-1} />
        </>
      )}

      {flash && <Smell x={L.xOf(-STONE_DIAMETER / 2)} y={lineY - hb * 0.5} D={D} />}

      {/* Fartspiler med samme skala (K px per m/s). Kortere enn spissen tegnes de ikke; skiltet viser farten. */}
      <ForceArrow x1={x1} y1={L.arrowY} x2={x1 + st.u1 * K} y2={L.arrowY} color={VIZ.velocity} width={6} minLength={11 * ss} />
      <ForceArrow x1={x2} y1={L.arrowY} x2={x2 + st.u2 * K} y2={L.arrowY} color={VIZ.velocity} width={6} minLength={11 * ss} />

      <SpeedTag left={tags.a.left} y={L.rowY[tags.a.row]} x={x1} text={text1} stone={RED_STONE} />
      <SpeedTag left={tags.b.left} y={L.rowY[tags.b.row]} x={x2} text={text2} stone={YELLOW_STONE} />

      <ValueTag x={12} y={L.statusY} anchor="start" text={statusText(hit.kind, st.after)} size={STATUS_SIZE} />
    </>
  );
}

/** Teksten på statusskiltet øverst til venstre. */
function statusText(kind: HitKind, after: boolean): string {
  if (kind === 'fullstendig') return after ? 'Etter støtet: henger sammen' : 'Før støtet: borrelås på steinene';
  return after ? 'Etter støtet' : 'Før støtet';
}
