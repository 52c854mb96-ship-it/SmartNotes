/**
 * Gjenstander og bakgrunn til scenen i k1-simulering (fallskjermhopper i fritt fall), i samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE-farger, tynn kontur og myke overganger.
 *
 *   <FallHimmel w={588} h={380} horisont={318} falt={s} />      // himmel, skyer som glir oppover og dalen langt nede
 *   <Hopper x={cx} y={cy} size={112} hodeNed={false} />          // ankerpunkt i tyngdepunktet
 *   <Hoydemaaler x={700} y={262} r={54} hoyde={3866} />          // armbåndshøydemåler (0–4 000 m)
 */
import { memo, useMemo } from 'react';
import {
  LinearGradient,
  Landskap,
  PAINTS,
  Person,
  RadialGradient,
  SCENE,
  SpeedLines,
  alpha,
  materialStops,
  mix,
  personPunkter,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import { MEK, ObjectText } from '../../kit/scene/mekanikk-felles';
import { VIZ, fmt } from '../../kit';

const r2 = (v: number) => Math.round(v * 100) / 100;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/* ---------------------------------------------------------------- Himmel med skyer som glir forbi */

interface CloudSpec {
  x: number;
  y: number;
  w: number;
  d: string;
}

/** Haugsky med flat bunn (fire «puter» og et rektangel) som i Himmel, sentrert på bunnen i (0, 0). */
function cloudPath(w: number, rand: () => number): string {
  const h = w / 2.6;
  const j = () => 0.88 + rand() * 0.24;
  const c = (cx: number, cy: number, r: number) =>
    // Med klokka, som rektangelet, så putene smelter sammen med det (nonzero) i stedet for å bli hull.
    `M${r2(cx - r)},${r2(cy)}a${r2(r)},${r2(r)} 0 1,1 ${r2(2 * r)},0a${r2(r)},${r2(r)} 0 1,1 ${r2(-2 * r)},0Z`;
  const puffs: [number, number, number][] = [
    [-0.36 * w, -0.3 * h * j(), 0.3 * h * j()],
    [-0.12 * w, -0.5 * h, 0.5 * h * j()],
    [0.14 * w, -0.44 * h, 0.42 * h * j()],
    [0.36 * w, -0.27 * h, 0.27 * h * j()],
  ];
  let d = `M${r2(-0.36 * w)},${r2(-0.3 * h)}L${r2(0.36 * w)},${r2(-0.27 * h)}L${r2(0.36 * w)},0L${r2(-0.36 * w)},0Z`;
  for (const [px, py, pr] of puffs) d += c(px, Math.min(py, -pr), pr);
  return d;
}

function planLayer(w: number, h: number, n: number, size: number, seed: number): CloudSpec[] {
  const rand = sceneRandom(seed);
  const out: CloudSpec[] = [];
  for (let i = 0; i < n; i++) {
    const cw = size * (0.7 + rand() * 0.6);
    // Jevnt fordelt i høyden (så det alltid er skyer i bildet), litt tilfeldig sidelengs
    out.push({ x: w * (0.08 + 0.84 * rand()), y: (h / n) * (i + 0.3 + rand() * 0.4), w: cw, d: cloudPath(cw, rand) });
  }
  return out;
}

interface FallHimmelProps {
  /** Øverste venstre hjørne. */
  x?: number;
  y?: number;
  w: number;
  h: number;
  /** Horisonten (figurens y): fjellene står på den, og dalen langt nede fyller under den. */
  horisont: number;
  /** Hvor langt hopperen har falt (m). Skyene glir oppover når kameraet følger hopperen ned. */
  falt: number;
  /** Hvor mange figurenheter de nære skyene flytter seg per meter fall (de fjerne mindre). */
  parallakse?: number;
  /** Skystørrelse (standard etter bredden). */
  sky?: number;
}

/**
 * Himmel sett fra ca. 3–4 km høyde: lys toning, fjell langt borte i dis på horisonten, dalen med fjord og jorder
 * langt nede under horisonten, og to lag haugskyer som glir oppover når kameraet følger hopperen ned (de nære
 * raskere enn de fjerne). Klippes til rammen med avrundede hjørner.
 */
export const FallHimmel = memo(function FallHimmel({ x = 0, y = 0, w, h, horisont, falt, parallakse = 1.6, sky }: FallHimmelProps) {
  const clip = useSvgId('sim-himmel');
  const skyGrad = useSvgId('sim-luft');
  const dal = useSvgId('sim-dal');
  const dis = useSvgId('sim-dis');
  const cloudG = useSvgId('sim-sky');
  const ss = useStrokeScale();
  const cw = sky ?? Math.max(90, w * 0.24);
  const near = useMemo(() => planLayer(w, h, 3, cw, 11), [w, h, cw]);
  const far = useMemo(() => planLayer(w, h, 4, cw * 0.55, 23), [w, h, cw]);
  const fields = useMemo(() => {
    // Jorder og skog i dalen: flate firkanter som blir smalere og tettere mot horisonten (perspektiv).
    const rand = sceneRandom(7);
    const out: { d: string; fill: string; o: number }[] = [];
    const depth = y + h - horisont;
    for (let row = 0; row < 7; row++) {
      const t0 = (row / 7) ** 1.7;
      const t1 = ((row + 1) / 7) ** 1.7;
      const y0 = horisont + 2 + t0 * depth;
      const y1 = horisont + 2 + t1 * depth;
      const n = 9 - row;
      for (let i = 0; i < n; i++) {
        if (rand() < 0.35) continue;
        const span = w / n;
        const xa = x + span * (i + 0.1 + rand() * 0.2);
        const xb = xa + span * (0.45 + rand() * 0.35);
        const skew = (rand() - 0.5) * span * 0.25;
        const fill = rand() < 0.45 ? SCENE.foliageDark : rand() < 0.6 ? SCENE.grass : SCENE.grassDark;
        out.push({
          d: `M${r2(xa)},${r2(y0)}L${r2(xb)},${r2(y0)}L${r2(xb + skew)},${r2(y1 - 1)}L${r2(xa + skew)},${r2(y1 - 1)}Z`,
          fill,
          o: 0.35 + 0.4 * (row / 7),
        });
      }
    }
    return out;
  }, [x, y, w, h, horisont]);
  const fjord = useMemo(() => {
    // Fjorden snor seg fra horisonten mot oss og blir bredere nærmere.
    const depth = y + h - horisont;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const yy = horisont + 1 + t ** 1.5 * depth;
      const cx = x + w * (0.62 - 0.22 * t + 0.06 * Math.sin(t * 5));
      pts.push([cx, yy, 3 + t * t * w * 0.11]);
    }
    const left = pts.map(([cx, yy, hw]) => `${r2(cx - hw)},${r2(yy)}`);
    const right = pts
      .slice()
      .reverse()
      .map(([cx, yy, hw]) => `${r2(cx + hw)},${r2(yy)}`);
    return `M${left.join('L')}L${right.join('L')}Z`;
  }, [x, y, w, h, horisont]);
  if (!(w > 0) || !(h > 0)) return null;
  const s = Number.isFinite(falt) ? Math.max(0, falt) : 0;
  const layer = (clouds: CloudSpec[], k: number, opacity: number) =>
    clouds.map((c, i) => {
      const span = h + c.w;
      // Skyene glir oppover (mot mindre y) når hopperen faller, og kommer inn igjen nedenfra.
      const cy = y + mod(c.y - s * k + c.w * 0.5, span) - c.w * 0.25;
      return <path key={i} d={c.d} transform={`translate(${r2(x + c.x)} ${r2(cy)})`} fill={`url(#${cloudG})`} opacity={opacity} />;
    });
  return (
    <g aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={w} height={h} rx={10} />
        </clipPath>
      </defs>
      <LinearGradient
        id={skyGrad}
        userSpace
        x1={0}
        y1={y}
        x2={0}
        y2={horisont}
        stops={[
          [0, SCENE.skyTop],
          [0.75, mix(SCENE.skyTop, SCENE.skyBottom, 0.6)],
          [1, SCENE.skyBottom],
        ]}
      />
      <LinearGradient
        id={dal}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={y + h}
        stops={[
          [0, mix(SCENE.hillFar, SCENE.skyBottom, 0.55)],
          [1, mix(SCENE.grassDark, SCENE.hillFar, 0.45)],
        ]}
      />
      <LinearGradient
        id={dis}
        userSpace
        x1={0}
        y1={horisont}
        x2={0}
        y2={y + h}
        stops={[
          [0, SCENE.skyBottom, 0.85],
          [0.5, SCENE.skyBottom, 0.35],
          [1, SCENE.skyBottom, 0.12],
        ]}
      />
      <LinearGradient
        id={cloudG}
        stops={[
          [0, tint(SCENE.cloud, 0.3)],
          [0.55, SCENE.cloud],
          [1, SCENE.cloudShade],
        ]}
      />
      <g clipPath={`url(#${clip})`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${skyGrad})`} />
        {/* Dalen langt nede: jorder, skog og en fjord, med dis over */}
        <rect x={x} y={horisont} width={w} height={y + h - horisont} fill={`url(#${dal})`} />
        {fields.map((f, i) => (
          <path key={i} d={f.d} fill={f.fill} opacity={f.o} />
        ))}
        <path d={fjord} fill={mix(SCENE.waterDeep, SCENE.skyBottom, 0.3)} />
        <path d={fjord} fill="none" stroke={tint(SCENE.water, 0.4)} strokeWidth={0.8 * ss} opacity={0.6} />
        <rect x={x} y={horisont} width={w} height={y + h - horisont} fill={`url(#${dis})`} />
        <Landskap x={x} y={horisont + 1} w={w} h={Math.min(46, (horisont - y) * 0.16)} type="fjell" seed={4} />
        {layer(far, parallakse * 0.35, 0.7)}
        {layer(near, parallakse, 0.95)}
      </g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill="none" stroke={alpha(SCENE.outline, 0.35)} strokeWidth={1 * ss} />
    </g>
  );
});

/* ---------------------------------------------------------------- Hopperen */

/** Leddene for hodet ned (stuping): strak kropp, armene over hodet (mot bakken) og beina samlet, så flaten er liten. */
const HODE_NED: Partial<Leddvinkler> = {
  rygg: 0,
  nakke: -6,
  venstreSkulder: 166,
  hoyreSkulder: 176,
  venstreAlbue: 10,
  hoyreAlbue: 6,
  venstreHofte: 4,
  hoyreHofte: -2,
  venstreKne: 12,
  hoyreKne: 6,
  venstreAnkel: 30,
  hoyreAnkel: 26,
};

/**
 * Hvordan hopperen er dreid: magen ned (liggende, hodet mot høyre) eller hodet ned, litt på skrå (hodet nede til
 * venstre), så de loddrette kraftpilene fra tyngdepunktet går forbi hodet og beina i stedet for langs hele kroppen.
 */
function placement(hodeNed: boolean) {
  return hodeNed ? { rotate: 200, ledd: HODE_NED } : { rotate: 90, ledd: undefined };
}

/**
 * Fallskjermhopper i fritt fall, med ankerpunktet (x, y) i tyngdepunktet (der G angriper). Gul hoppdress, svart hjelm
 * og fallskjermsekken på ryggen. Magen ned er den vanlige stillingen; med hodet ned er flaten mot lufta mye mindre.
 * `size` er høyden stående (1,75 m i scenens skala).
 */
export function Hopper({ x, y, size, hodeNed }: { x: number; y: number; size: number; hodeNed: boolean }) {
  const { rotate, ledd } = placement(hodeNed);
  return (
    <Person
      x={x}
      y={y}
      size={size}
      pose="falle"
      anker="tyngdepunkt"
      rotate={rotate}
      ledd={ledd}
      jakke="gul"
      bukse="gul"
      hjelm="svart"
      sekk="svart"
      sko="svart"
      skygge={false}
    />
  );
}

/** Hvor langt kroppen når opp og til sidene fra tyngdepunktet (til fartsstrekene og plasseringen av pilene). */
export function hopperOmriss(size: number, hodeNed: boolean): { top: number; left: number; right: number } {
  const { rotate, ledd } = placement(hodeNed);
  const p = personPunkter('falle', size, ledd, { x: 0, y: 0, anker: 'tyngdepunkt', rotate });
  const pts = Object.values(p);
  return {
    top: Math.min(...pts.map((q) => q.y)),
    left: Math.min(...pts.map((q) => q.x)),
    right: Math.max(...pts.map((q) => q.x)),
  };
}

/**
 * Luft som strømmer forbi hopperen: fartsstreker som går oppover fra (x, y) (hopperen faller nedover, så lufta går
 * oppover i forhold til ham). Legg dem like utenfor endene av kroppen, så de ikke kommer borti kraftpilene og
 * etikettene over tyngdepunktet. `length` bør være proporsjonal med farten; ved 0 tegnes ingenting.
 */
export function Luftstrom({ xs, y, length, spread }: { xs: number[]; y: number; length: number; spread: number }) {
  if (!(length > 4)) return null;
  return (
    <g opacity={0.9}>
      {xs.map((x, i) => (
        <g key={i} transform={`rotate(90 ${r2(x)} ${r2(y)})`}>
          <SpeedLines x={x} y={y} length={length * (i ? 0.85 : 1)} spread={spread} color={VIZ.muted} />
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------------------- Høydemåler */

const DEG = Math.PI / 180;

/**
 * Analog høydemåler for fallskjermhopping (på armen): svart urskive med én runde = 4 000 m (tallene er km),
 * rødt felt under 1 000 m der skjermen skal være ute, hvit viser og et lite digitalt vindu med høyden i meter.
 * Ankerpunkt: sentrum. Remmen går ut 0,3 · r over og under.
 */
export function Hoydemaaler({ x, y, r, hoyde, runde = 4000, rodt = 1000 }: { x: number; y: number; r: number; hoyde: number; runde?: number; rodt?: number }) {
  const id = useSvgId('sim-hoyde');
  const ss = useStrokeScale();
  const R = Math.max(10, r);
  const h = Math.max(0, Number.isFinite(hoyde) ? hoyde : 0);
  const dial = R * 0.84;
  // Viseren: 0 m rett opp, med klokka; ved 4 000 m er den en hel runde rundt (rett opp igjen).
  const ang = (h >= runde ? 360 : (h / runde) * 360) - 90;
  const pt = (a: number, rr: number) => `${r2(Math.cos(a * DEG) * rr)},${r2(Math.sin(a * DEG) * rr)}`;
  let major = '';
  let minor = '';
  const n = Math.round(runde / 100);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 - 90;
    const big = i % 5 === 0;
    const seg = `M${pt(a, dial * 0.97)}L${pt(a, dial * (big ? (i % 10 === 0 ? 0.78 : 0.84) : 0.9))}`;
    if (big) major += seg;
    else minor += seg;
  }
  const redEnd = (Math.min(rodt, runde) / runde) * 360 - 90;
  const redArc = `M${pt(-90, dial * 0.94)}A${r2(dial * 0.94)},${r2(dial * 0.94)} 0 0,1 ${pt(redEnd, dial * 0.94)}`;
  const npx = R * 0.24;
  const nums = [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * 360 - 90;
    // «2» nederst flyttes litt ned, så det ikke rører det digitale vinduet
    const rr = dial * (k === 2 ? 0.7 : 0.6);
    return { k, x: Math.cos(a * DEG) * rr, y: Math.sin(a * DEG) * rr };
  });
  const face = shade(PAINTS.svart, 0.15);
  const ink = tint(PAINTS.hvit, 0.15);
  const hand = `M${pt(ang - 90, R * 0.05)}L${pt(ang, dial * 0.86)}L${pt(ang + 90, R * 0.05)}L${pt(ang + 180, R * 0.18)}Z`;
  const dW = dial * 1.02;
  const dH = R * 0.3;
  const dY = R * 0.28;
  const strapW = R * 0.95;
  const strapL = R * 0.3;
  return (
    <g transform={`translate(${r2(x)} ${r2(y)})`}>
      <title>{`Høydemåler: ${fmt(h, 0)} m over bakken`}</title>
      <LinearGradient id={`${id}s`} x1={0} x2={1} y1={0} y2={0} stops={materialStops(SCENE.rubber, 1.4)} />
      <RadialGradient
        id={`${id}k`}
        fx={0.34}
        fy={0.3}
        stops={[
          [0, SCENE.metalLight],
          [0.55, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <RadialGradient
        id={`${id}f`}
        cx={0.45}
        cy={0.4}
        r={0.7}
        stops={[
          [0, tint(face, 0.12)],
          [1, shade(face, 0.25)],
        ]}
      />
      {/* Remmen over og under */}
      {[-1, 1].map((sgn) => (
        <rect
          key={sgn}
          x={-strapW / 2}
          y={sgn < 0 ? -R - strapL : R - R * 0.1}
          width={strapW}
          height={strapL + R * 0.1}
          rx={R * 0.08}
          fill={`url(#${id}s)`}
          stroke={SCENE.outline}
          strokeWidth={0.8 * ss}
        />
      ))}
      <circle r={R} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle r={dial} fill={`url(#${id}f)`} stroke={shade(SCENE.metal, 0.45)} strokeWidth={1 * ss} />
      <path d={redArc} fill="none" stroke={PAINTS.rod} strokeWidth={dial * 0.1} />
      <path d={minor} stroke={ink} strokeWidth={Math.max(0.5, R * 0.012) * ss} opacity={0.7} />
      <path d={major} stroke={ink} strokeWidth={Math.max(0.9, R * 0.03) * ss} />
      <g fill={ink} fontWeight={700} fontSize={r2(npx)} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {nums.map((q) => (
          <text key={q.k} x={r2(q.x)} y={r2(q.y + npx * 0.36)}>
            {q.k}
          </text>
        ))}
      </g>
      {/* Tallene er kilometer. Oppe til høyre (0–1 000 m) kommer viseren sjelden, for i fritt fall går den fra 4 000 m mot klokka */}
      <text x={r2(dial * 0.3)} y={r2(-dial * 0.24)} textAnchor="middle" fill={ink} fontSize={r2(R * 0.15)} fontWeight={650} opacity={0.85}>
        km
      </text>
      <path d={hand} fill={PAINTS.hvit} stroke={shade(PAINTS.svart, 0.2)} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <circle r={R * 0.07} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Vinduet ligger over viseren, så høyden alltid kan leses */}
      <rect x={-dW / 2} y={dY - dH / 2} width={dW} height={dH} rx={dH * 0.2} fill={SCENE.display} stroke={shade(SCENE.metal, 0.35)} strokeWidth={0.7 * ss} />
      <ObjectText x={0} y={dY} w={dW * 0.9} h={dH * 0.95} text={`${fmt(h, 0)} m`} color={SCENE.displayText} weight={650} max={15} />
      {/* Glasset */}
      <path
        d={`M${pt(195, dial * 0.88)}A${r2(dial * 0.88)},${r2(dial * 0.88)} 0 0,1 ${pt(250, dial * 0.88)}`}
        fill="none"
        stroke={alpha(SCENE.metalLight, 0.9)}
        strokeWidth={Math.max(0.8 * ss, R * 0.05)}
        strokeLinecap="round"
        opacity={0.55}
      />
      <circle r={dial} fill="none" stroke={MEK.print} strokeWidth={0.4 * ss} opacity={0.4} />
    </g>
  );
}
