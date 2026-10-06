/**
 * Scenen i eksempeloppgaven «Bil i bytrafikk» (k1-eks-vt-graf): en gate sett fra siden, med bilen der den er ved
 * tiden i steget, fart- og akselerasjonspil, lyskrysset i nærheten og strekningen mellom de to stopplinjene øverst.
 *
 * «Kameraet» følger bilen, så bilen, krysset, trærne, lyktestolpene og skiltene har ekte mål (én skala px/m). Hele
 * strekningen (150–470 m) får ikke plass i samme skala, så den vises som en linje øverst med bilen som et punkt.
 * Der vises også delstrekningene (c) og hvor bilen er hvert sekund (e).
 *
 * Egen gjenstand (bare denne scenen trenger den): `Gatelykt`, i samme stil som scene-kit-et.
 */
import { memo } from 'react';
import { Figure, Txt, VIZ, fmt, useTextScale } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  ContactShadow,
  ForceArrow,
  Himmel,
  Landskap,
  Lauvtre,
  LinearGradient,
  PAINTS,
  SCENE,
  SpeedLines,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { PHASE_COLOR, type TripView } from './eks-vt-graf-graf';
import { Fartsskilt } from './fartskontroll-deler';
import { Kryss, Stopplinje, Trafikklys, type Lys } from './gult-lys-deler';
import {
  accelerationAt,
  phaseAt,
  phaseOf,
  positionAt,
  strobePositions,
  velocityAt,
  type CityTripSolution,
  type CityTripTask,
  type PhaseNo,
} from './model-eks-vt-graf';

interface SceneLayout {
  W: number;
  H: number;
  /** Figurenheter per meter for bilen, krysset, trærne og skiltene. */
  p: number;
  /** Fronten av bilen står vanligvis her i bildet; gata ruller forbi. */
  frontX: number;
  /** Der hjulene står, og bredden av veibanen i perspektiv. */
  roadY: number;
  B: number;
  horizon: number;
  landH: number;
  /** Signalhodet i lyskrysset: overkant og høyde. */
  headTop: number;
  headH: number;
  /** Strekningslinja øverst. */
  rail: { x1: number; x2: number; y: number };
  /** Skiltene med tid og fart: midten av første rad. */
  tagY: number;
  /** Figurenheter per m/s (fartspila) og per m/s² (akselerasjonspila). */
  kv: number;
  ka: number;
  sun: { x: number; y: number };
}

/*
 * Himmelen øverst har plass til strekningslinja og skiltene med tid og fart. Trærne og lyktestolpene (høyst 6 m)
 * når ikke opp til skiltene, og signalhodet står under dem.
 */
const WIDE: SceneLayout = {
  W: 800,
  H: 340,
  p: 26,
  frontX: 372,
  roadY: 298,
  B: 44,
  horizon: 218,
  landH: 84,
  headTop: 136,
  headH: 48,
  rail: { x1: 96, x2: 704, y: 40 },
  tagY: 88,
  kv: 8,
  ka: 26,
  sun: { x: 742, y: 150 },
};

const NARROW: SceneLayout = {
  W: 440,
  H: 362,
  p: 20,
  frontX: 178,
  roadY: 320,
  B: 40,
  horizon: 244,
  landH: 76,
  headTop: 162,
  headH: 44,
  rail: { x1: 52, x2: 388, y: 40 },
  tagY: 88,
  kv: 6,
  ka: 18,
  sun: { x: 404, y: 180 },
};

/**
 * Tiden scenen viser i hvert steg: start, midt i del 2, tidlig i del 1 (bilen er ca. 6 m forbi stopplinja, så
 * lyskrysset synes bak den), midt i del 3, og ellers når bilen har stoppet.
 */
export function sceneTime(task: CityTripTask, view: TripView): number {
  switch (view) {
    case 'oppgave':
      return 0;
    case 'les':
      return (task.t1 + task.t2) / 2;
    case 'a1': {
      const a1 = task.vMax / task.t1;
      return Math.min(task.t1 / 2, Math.max(1, Math.round(2 * Math.sqrt(12 / a1)) / 2));
    }
    case 'a23':
      return (task.t2 + task.t3) / 2;
    default:
      return task.t3;
  }
}

/** 0 → «0», 2,5 → «2,5», 6 → «6,0», 16 → «16» (to gjeldende siffer, men null uten desimaler). */
function num2(v: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  return Math.abs(v) >= 10 && Math.abs(v - Math.round(v)) < 1e-9 ? fmt(v, 0) : fmt(v, 1);
}

export function TripScene({ task, sol, view, narrow }: { task: CityTripTask; sol: CityTripSolution; view: TripView; narrow: boolean }) {
  const L = narrow ? NARROW : WIDE;
  const t = sceneTime(task, view);
  const s = positionAt(task, t);
  const v = velocityAt(task, t);
  const where = s < 0.5 ? 'ved stopplinja i lyskryss 1' : s > sol.s - 0.5 ? 'ved stopplinja i lyskryss 2' : `${fmt(s, 0)} m etter stopplinja i lyskryss 1`;
  return (
    <Figure
      viewBox={`0 0 ${L.W} ${L.H}`}
      label={`En rød bil i gata ${where}, ved t = ${num2(t)} s, med farten ${num2(v)} m/s. Strekningen mellom de to stopplinjene er ${fmt(sol.s, 0)} m.`}
      maxHeight={narrow ? 440 : 400}
    >
      <SceneBody task={task} sol={sol} view={view} L={L} t={t} />
    </Figure>
  );
}

/** Lyktestolper, trær og skilt langs fortauet bak veien (meter fra den første stopplinja), utenfor kryssene. */
function streetFurniture(L: number, sLes: number) {
  // Ikke i kryssene: fra 8 m før stopplinja til 24 m etter (gangfelt og tverrvei), og ikke helt inntil lyssignalet.
  const free = (q: number) => (q > 24 || q < -8) && q < L - 5;
  const signs = [20, sLes + 7].filter((q) => q < L - 14);
  const lamps: number[] = [];
  for (let q = -30; q < L; q += 34) if (free(q) && !signs.some((g) => Math.abs(g - q) < 5)) lamps.push(q);
  const rand = sceneRandom(11);
  const trees: { q: number; size: number; seed: number }[] = [];
  for (let q = -47; q < L; q += 13) {
    const at = q + (rand() - 0.5) * 6;
    const size = 4.8 + rand() * 1.2;
    const seed = 1 + Math.floor(rand() * 6);
    if (free(at) && ![...signs, ...lamps].some((g) => Math.abs(g - at) < 3.5)) trees.push({ q: at, size, seed });
  }
  return { signs, lamps, trees };
}

function SceneBody({ task, sol, view, L, t }: { task: CityTripTask; sol: CityTripSolution; view: TripView; L: SceneLayout; t: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { W, H, p, roadY, B, horizon } = L;
  const s = positionAt(task, t);
  const v = velocityAt(task, t);
  const a = view === 'oppgave' ? 0 : accelerationAt(task, t);
  const phase = phaseAt(task, t);
  // I del 1 flyttes kameraet litt, så lyskrysset bak bilen synes.
  const frontX = view === 'a1' ? Math.min(W - 7 * p, Math.max(L.frontX, 34 + (s + 0.6) * p)) : L.frontX;
  /** x i bildet for et punkt `m` meter fra den første stopplinja. */
  const X = (m: number) => frontX + (m - s) * p;
  const roadTop = roadY - 0.7 * B;
  const sidewalk = 0.3 * B;
  const backFoot = roadTop - sidewalk * 0.45;

  // Det nærmeste lyskrysset (bare ett får plass i bildet om gangen).
  const near = s < sol.s / 2 ? 0 : sol.s;
  const Xk = (m: number) => X(near + m);
  const vpX = Xk(10);
  const lys: Lys = near === 0 ? 'gronn' : t >= task.t2 ? 'rod' : 'gronn';

  const { signs, lamps, trees } = streetFurniture(sol.s, positionAt(task, (task.t1 + task.t2) / 2));
  const visible = (x: number, margin = 80) => x > -margin && x < W + margin;

  const carLen = BIL_MAAL.lengde * p;
  const carX = frontX - BIL_MAAL.foran * p;
  const roofY = roadY - BIL_MAAL.hoyde * p;
  const vY = roofY - 14 * ss;
  const aY = vY - 26 * ss;
  const showArrows = view !== 'oppgave';
  const braking = phase === 3;

  // Skiltene med tid, fart og akselerasjon, fra venstre mot høyre (ny rad hvis de ikke får plass).
  const tags: { text: string; color?: string }[] = [{ text: `t = ${num2(t)} s` }];
  if (showArrows) tags.push({ text: v === 0 ? 'v = 0' : `v = ${num2(v)} m/s`, color: VIZ.velocity });
  if (showArrows && (view === 'a1' || view === 'a23' || view === 'les')) tags.push({ text: a === 0 ? 'a = 0' : `a = ${fmt(a, 1)} m/s²`, color: VIZ.acceleration });
  const fsTag = 17 * 0.85 * f;
  const tagW = (text: string) => Math.max(fsTag * 1.6, text.length * fsTag * 0.6 + 16 * f);
  const tagH = fsTag * 1.55;
  let tx = 12;
  let ty = L.tagY;
  const placed = tags.map((tg) => {
    const w = tagW(tg.text);
    if (tx > 12 && tx + w > W - 12) {
      tx = 12;
      ty += tagH + 6;
    }
    const at = { ...tg, x: tx, y: ty };
    tx += w + 8;
    return at;
  });

  return (
    <g>
      <Backdrop L={L} scroll={s * p} />
      <Vei x1={0} x2={W} y={roadY} bredde={B} type="asfalt" horisont={horizon} depth={H - roadY} forskyvning={s * p} seed={5} />
      <Kryss X={Xk} roadY={roadY} B={B} horizon={horizon} bottom={H} sidewalk={sidewalk} vpX={vpX} w={W} />
      <Stopplinje X={Xk} roadY={roadY} B={B} horizon={horizon} vpX={vpX} />

      {trees
        .filter((tr) => visible(X(tr.q), 100))
        .map((tr) => (
          <Lauvtre key={tr.q} x={X(tr.q)} y={backFoot - 1} size={tr.size * p} seed={tr.seed} />
        ))}
      {lamps
        .filter((q) => visible(X(q), 40))
        .map((q) => (
          <Gatelykt key={q} x={X(q)} y={backFoot} p={p} />
        ))}
      {signs
        .filter((q) => visible(X(q), 30))
        .map((q) => (
          <Fartsskilt key={q} x={X(q)} y={backFoot + 1} m={p} grense={task.limitKmh} />
        ))}
      {visible(Xk(-0.6), 40) && (
        <Trafikklys
          x={Xk(-0.6)}
          y={backFoot}
          top={L.headTop}
          size={L.headH}
          lys={lys}
          title={near === 0 ? 'Lyskryss 1: grønt lys' : lys === 'rod' ? 'Lyskryss 2: rødt lys' : 'Lyskryss 2: grønt lys'}
        />
      )}

      {v > 0.5 && <SpeedLines x={frontX - carLen} y={roadY - 0.6 * p} length={Math.min(60, v * L.kv * 0.5)} spread={0.6 * p} />}
      <Bil
        x={carX}
        y={roadY}
        size={carLen}
        lakk="rod"
        hjulvinkel={hjulvinkelFraStrekning(s)}
        bremselys={braking}
        title={braking ? 'Bilen bremser' : v > 0 ? 'Bilen kjører' : 'Bilen står stille'}
      />

      {showArrows && v > 0.05 && <ForceArrow x1={carX} y1={vY} x2={carX + v * L.kv} y2={vY} color={VIZ.velocity} width={6} label="v" />}
      {showArrows && Math.abs(a) > 0.05 && <ForceArrow x1={carX} y1={aY} x2={carX + a * L.ka} y2={aY} color={VIZ.acceleration} width={5} label="a" />}

      {placed.map((tg) => (
        <ValueTag key={tg.text} x={tg.x} y={tg.y} text={tg.text} color={tg.color} anchor="start" size={0.85} />
      ))}

      <Rail task={task} sol={sol} view={view} L={L} s={s} />
    </g>
  );
}

/** Himmel og by i bakgrunnen. Ruller litt med bilen, så bildet ved det andre krysset ikke er likt det første. */
const Backdrop = memo(function Backdrop({ L, scroll }: { L: SceneLayout; scroll: number }) {
  return (
    <g>
      <Himmel w={L.W} h={L.horizon + 4} sol={L.sun} skyer={2} seed={7} forskyvning={scroll * 0.3} />
      <Landskap x={0} y={L.horizon} w={L.W} h={L.landH} type="by" seed={4} forskyvning={scroll * 0.3} />
    </g>
  );
});

/**
 * Gatelykt på fortauet: stolpe i grålakkert stål som smalner oppover, en bøyd arm og et flatt lampehus med lys
 * glassflate under. 6 m høy. Ankerpunkt: foten av stolpen (x, y); `p` er figurenheter per meter.
 */
const Gatelykt = memo(function Gatelykt({ x, y, p }: { x: number; y: number; p: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('gatelykt');
  const h = 6 * p;
  const w0 = Math.max(3, 0.16 * p);
  const w1 = Math.max(2, 0.09 * p);
  const top = y - h;
  const arm = 1.1 * p;
  const headW = 0.75 * p;
  const headH = Math.max(3, 0.16 * p);
  const hx = x + arm;
  const hy = top + 0.22 * p;
  const pole = `M${x - w0 / 2},${y}L${x - w1 / 2},${top + 0.3 * p}L${x + w1 / 2},${top + 0.3 * p}L${x + w0 / 2},${y}Z`;
  const armPath = `M${x},${top + 0.6 * p}C${x},${top - 0.05 * p} ${x + 0.3 * p},${top} ${hx - headW * 0.3},${hy}`;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={0.45 * p} ry={0.08 * p} />
      <LinearGradient
        id={`${id}-stolpe`}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.metal, 0.3)],
          [0.45, SCENE.metal],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <path d={pole} fill={`url(#${id}-stolpe)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} strokeLinejoin="round" />
      {/* Fot med sokkel */}
      <rect x={x - w0 * 0.9} y={y - 0.35 * p} width={w0 * 1.8} height={0.35 * p} rx={w0 * 0.3} fill={shade(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <path d={armPath} fill="none" stroke={SCENE.outline} strokeWidth={w1 + 1.4 * ss} strokeLinecap="round" />
      <path d={armPath} fill="none" stroke={shade(SCENE.metal, 0.1)} strokeWidth={w1} strokeLinecap="round" />
      {/* Lampehuset og den lyse glassflaten under */}
      <rect x={hx - headW / 2} y={hy - headH / 2} width={headW} height={headH} rx={headH / 2} fill={shade(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <rect x={hx - headW * 0.38} y={hy + headH * 0.3} width={headW * 0.76} height={Math.max(1.6, headH * 0.42)} rx={headH * 0.2} fill={mix(SCENE.sun, PAINTS.hvit, 0.4)} opacity={0.9} />
    </g>
  );
});

/**
 * Strekningen fra stopplinja i lyskryss 1 til stopplinja i lyskryss 2 som en linje øverst i scenen, med bilen som et
 * punkt. I c) vises delstrekningene, i d) hele strekningen og tiden, og i e) hvor bilen er hvert sekund.
 */
function Rail({ task, sol, view, L, s }: { task: CityTripTask; sol: CityTripSolution; view: TripView; L: SceneLayout; s: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { x1, x2, y } = L.rail;
  const X = (d: number) => x1 + ((x2 - x1) * Math.min(sol.s, Math.max(0, d))) / sol.s;
  const segments = view === 'deler' || view === 'st1' || view === 'st2' || view === 'alle';
  const strobe = view === 'st1' || view === 'st2' || view === 'alle';
  const below = y + 9 * ss + 15 * f;
  const segText = (n: PhaseNo) => `${fmt(phaseOf(sol, n).s, 0)} m`;
  const p2 = phaseOf(sol, 2);

  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={VIZ.surface} strokeWidth={12 * ss} strokeLinecap="round" opacity={0.85} />
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={VIZ.muted} strokeWidth={3 * ss} strokeLinecap="round" />
      {segments ? (
        sol.phases.map((ph) => (
          <line key={ph.n} x1={X(ph.start)} x2={X(ph.start + ph.s)} y1={y} y2={y} stroke={PHASE_COLOR[ph.n]} strokeWidth={6 * ss} />
        ))
      ) : (
        <line x1={x1} x2={X(s)} y1={y} y2={y} stroke={alpha(VIZ.ink, 0.6)} strokeWidth={5 * ss} strokeLinecap="round" />
      )}
      {/* Stopplinjene */}
      {[x1, x2].map((x) => (
        <line key={x} x1={x} x2={x} y1={y - 9 * ss} y2={y + 9 * ss} stroke={VIZ.ink} strokeWidth={2.6 * ss} />
      ))}
      <Txt x={x1} y={y - 14 * ss} size={0.8} weight={700}>
        Lyskryss 1
      </Txt>
      <Txt x={x2} y={y - 14 * ss} size={0.8} weight={700}>
        Lyskryss 2
      </Txt>

      {strobe ? (
        strobePositions(task).map((pt) => <circle key={pt.t} cx={X(pt.s)} cy={y} r={3.3 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2 * ss} />)
      ) : (
        <circle cx={X(s)} cy={y} r={6.5 * ss} fill={PAINTS.rod} stroke={VIZ.surface} strokeWidth={2.2 * ss} />
      )}

      {/* Under linja */}
      {view === 'deler' && (
        <>
          <Txt x={x1} y={below} anchor="start" size={0.82} weight={750} color={PHASE_COLOR[1]}>
            {segText(1)}
          </Txt>
          <Txt x={X(p2.start + p2.s / 2)} y={below} size={0.82} weight={750} color={PHASE_COLOR[2]}>
            {segText(2)}
          </Txt>
          <Txt x={x2} y={below} anchor="end" size={0.82} weight={750} color={PHASE_COLOR[3]}>
            {segText(3)}
          </Txt>
        </>
      )}
      {view === 'areal' && (
        <Txt x={(x1 + x2) / 2} y={below} size={0.82} weight={700}>
          s = ?
        </Txt>
      )}
      {(view === 'snitt' || view === 'hvorfor') && (
        <Txt x={(x1 + x2) / 2} y={below} size={0.82} weight={700}>
          s = {fmt(sol.s, 0)} m på t = {fmt(task.t3, 0)} s
        </Txt>
      )}
      {strobe && (
        <Txt x={(x1 + x2) / 2} y={below} size={0.8} weight={650}>
          Bilen hvert sekund
        </Txt>
      )}
    </g>
  );
}
