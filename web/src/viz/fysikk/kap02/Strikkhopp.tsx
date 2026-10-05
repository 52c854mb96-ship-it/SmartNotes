import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Dot,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  useSimClock,
  useTextScale,
  type SimClock,
} from '../../kit';
import {
  ForceArrow,
  Gran,
  Himmel,
  Landskap,
  Person,
  SCENE,
  Strikk,
  ValueTag,
  Vann,
  alpha,
  personPunkter,
  useStrokeScale,
  useSvgId,
  type Leddvinkler,
} from '../../kit/scene';
import {
  BRIDGE_HEIGHT,
  BUNGEE_RANGES,
  bungeeKeyPoints,
  bungeeState,
  inG,
  momentTime,
  type BungeeKeyPoints,
  type BungeeMoment,
  type BungeeParams,
  type BungeeState,
} from './model-strikkhopp';
import { Bru, Fjellvegg, Hoydeskala } from './strikkhopp-scene';
import { useNarrow } from './useNarrow';

/**
 * Strikkhopp fra en bro over en elv (2E, 2F): fritt fall til strikken strammes, deretter en strikkraft S = k · Δx som
 * vokser. Eleven velger masse, strikklengde og stivhet, og ser kreftene, grafene for h, v og a og det laveste punktet.
 */
export default function Strikkhopp() {
  const R = BUNGEE_RANGES;
  const [m, setM] = useState<number>(R.m.start);
  const [L0, setL0] = useState<number>(R.L0.start);
  const [k, setK] = useState<number>(R.k.start);
  const p: BungeeParams = useMemo(() => ({ m, L0, k }), [m, L0, k]);
  const key = useMemo(() => bungeeKeyPoints(p), [p]);

  // «Gå til»: tiden følger øyeblikket også når glidebryterne endres. Spill av og tidsbryteren slipper det.
  const [lock, setLock] = useState<BungeeMoment | null>('bunn');
  const clock = useSimClock({ tMax: key.tEnd, speed: 1 });
  const { setT, pause } = clock;
  const lockT = lock ? momentTime(key, lock) : null;
  useEffect(() => {
    if (lockT !== null) setT(lockT);
  }, [lockT, setT]);
  // Tidsbryteren går i steg på 0,01 s; helt i enden viser vi øyeblikket strikken blir slakk.
  const tFree = Math.min(clock.t, key.tEnd);
  const t = lockT ?? (key.tEnd - tFree < 0.011 ? key.tEnd : tFree);
  const st = bungeeState(p, t, key);
  const play: SimClock = {
    ...clock,
    t,
    toggle: () => {
      setLock(null);
      clock.toggle();
    },
    reset: () => {
      setLock(null);
      clock.reset();
    },
  };

  const [ref, narrow] = useNarrow<HTMLDivElement>();

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={R.m.min} max={R.m.max} step={R.m.step} unit="kg" />
        <Slider
          label={
            <>
              Strikklengde L<Sub>0</Sub>
            </>
          }
          ariaLabel="Strikklengde uten strekk"
          value={L0}
          onChange={setL0}
          min={R.L0.min}
          max={R.L0.max}
          step={R.L0.step}
          unit="m"
        />
        <Slider label="Stivhet k" value={k} onChange={setK} min={R.k.min} max={R.k.max} step={R.k.step} unit="N/m" />
        <Slider
          label="Tid t"
          value={t}
          onChange={(v) => {
            setLock(null);
            pause();
            setT(v);
          }}
          min={0}
          max={Math.floor(key.tEnd * 100) / 100}
          step={0.01}
          unit="s"
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={play} decimals={2} />
        <Segmented<BungeeMoment | 'fri'>
          label="Gå til et øyeblikk i hoppet"
          value={lock ?? 'fri'}
          onChange={(v) => {
            if (v === 'fri') return;
            pause();
            setLock(v);
          }}
          options={[
            { value: 'stram', label: 'Strikken strammes' },
            { value: 'vmaks', label: 'Størst fart' },
            { value: 'bunn', label: 'Laveste punkt' },
          ]}
        />
      </Toolbar>

      <div ref={ref}>
        <SceneFigure p={p} k={key} st={st} narrow={narrow} />
        <GraphFigure p={p} k={key} st={st} narrow={narrow} />
      </div>
      <Legend
        items={[
          { color: VIZ.tension, label: 'Strikken strammes', dashed: true },
          {
            color: VIZ.velocity,
            label: <span>Størst fart: ΣF = 0, a = 0</span>,
            dashed: true,
          },
          { color: VIZ.acceleration, label: <span>Laveste punkt: v = 0, størst a</span>, dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Laveste punkt over vannet" value={fmt(key.hMin, 1)} unit="m" />
        <Readout
          label={
            <span>
              Største akselerasjon ({fmt(inG(key.aMax), 1)}&nbsp;g)
            </span>
          }
          value={fmt(key.aMax, 1)}
          unit="m/s²"
          tone={VIZ.acceleration}
        />
        <Readout label="Størst fart" value={fmt(key.vMax, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout
          label={
            <span>
              Største strikkraft ({fmt(key.SMax / key.G, 1)}&nbsp;·&nbsp;G)
            </span>
          }
          value={fmt(key.SMax, 0)}
          unit="N"
          tone={VIZ.tension}
        />
      </Readouts>

      <Formula label="Kreftene og akselerasjonen ved tiden t (positiv retning oppover)">
        <FormulaLine>G = mg = {fmt(m, 0)} kg · 9,81 m/s² = {fmt(key.G, 0)} N</FormulaLine>
        {st.dx > 0 ? (
          <FormulaLine>
            S = k · Δx = {fmt(k, 0)} N/m · ({fmt(st.s, 1)} m − {fmt(L0, 0)} m) = {fmt(st.S, 0)} N
          </FormulaLine>
        ) : (
          <FormulaLine>
            Strikken er slakk ({fmt(st.s, 1)} m &lt; L<Sub>0</Sub> = {fmt(L0, 0)} m): S = 0 N
          </FormulaLine>
        )}
        <FormulaLine>
          ΣF = S − G = {fmt(st.S, 0)} N − {fmt(key.G, 0)} N = {fmt(st.sumF, 0)} N
        </FormulaLine>
        <FormulaLine>
          a = ΣF / m = {fmt(st.sumF, 0)} N / {fmt(m, 0)} kg = {fmt(st.a, 1)} m/s²
        </FormulaLine>
        <FormulaLine>
          Størst fart der ΣF = 0: k · Δx = mg ⇒ Δx = mg / k = {fmt(key.G, 0)} N / {fmt(k, 0)} N/m = {fmt(key.dEq, 2)} m
        </FormulaLine>
      </Formula>

      <Explain>{explanation(p, key, st)}</Explain>
    </VizLayout>
  );
}

/* ================================================================================================
 * Scenen: oversikt over kløfta og nærbilde av hopperen
 * ============================================================================================== */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Leddene til hopperen: strake bein og armene «over hodet» (mot vannet når hun henger opp ned). */
const LEDD: Partial<Leddvinkler> = {
  rygg: 0,
  nakke: -18,
  venstreSkulder: 158,
  hoyreSkulder: 172,
  venstreAlbue: 14,
  hoyreAlbue: 8,
  venstreHofte: 4,
  hoyreHofte: -2,
  venstreKne: 10,
  hoyreKne: 4,
  venstreAnkel: 18,
  hoyreAnkel: 12,
};

/** Dreiningen (grader med klokka om føttene): lener seg ut fra plattformen, stuper og henger med hodet ned. */
function jumperRotation(t: number): number {
  const u = Math.min(1, Math.max(0, t / 1.15));
  return 18 + 162 * u * u * (3 - 2 * u);
}

/** Punktene på hopperen (føttene er ankerpunktet, der strikken er festet). */
function jumperPoints(size: number, x: number, y: number, rotate: number) {
  const pts = personPunkter('falle', size, LEDD, { x, y, rotate });
  // Hvor langt kroppen går til venstre og høyre (hodet har radius ca. 0,07 · size).
  const xs = [pts.venstreHand.x, pts.hoyreHand.x, pts.venstreFot.x, pts.hoyreFot.x, pts.hode.x - 0.08 * size, pts.hode.x + 0.08 * size];
  return {
    ankel: { x: (pts.venstreAnkel.x + pts.hoyreAnkel.x) / 2, y: (pts.venstreAnkel.y + pts.hoyreAnkel.y) / 2 },
    tp: pts.tyngdepunkt,
    hode: pts.hode,
    hofte: pts.hofte,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
  };
}

function Jumper({ x, y, size, rotate }: { x: number; y: number; size: number; rotate: number }) {
  return <Person x={x} y={y} size={size} pose="falle" ledd={LEDD} rotate={rotate} jakke="blaa" bukse={SCENE.denim} har="brun" hjelm="gul" skygge={false} />;
}

/** Strikken fra festet til anklene: slakk (henger i en U under hopperen) til den strammes, så rett og strukket. */
function Cord({
  ax,
  ay,
  fx,
  fy,
  s,
  L0,
  px,
  thick,
  maxDrop,
}: {
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  s: number;
  L0: number;
  px: number;
  thick: number;
  maxDrop: number;
}) {
  const span = Math.hypot(fx - ax, fy - ay);
  if (s >= L0) return <Strikk x1={ax} y1={ay} x2={fx} y2={fy} tykkelse={thick} hvilelengde={(span * L0) / Math.max(s, 1e-6)} />;
  // Bukta er (L₀ − s)/2 under hopperen (strikken er dobbel fra festet ned til bukta og opp igjen).
  const drop = Math.min(maxDrop, ((L0 - s) / 2) * px);
  const slakk = Math.min(1, drop / (0.55 * Math.max(span, 30)));
  return <Strikk x1={ax} y1={ay} x2={fx} y2={fy} tykkelse={thick} slakk={slakk} />;
}

function SceneFigure({ p, k, st, narrow }: { p: BungeeParams; k: BungeeKeyPoints; st: BungeeState; narrow: boolean }) {
  // Oversikten til venstre og nærbildet til høyre, begge høye. På mobil blir figuren høyere, så hopperen og
  // kreftene i nærbildet blir store nok.
  const W = 800;
  const H = narrow ? 1000 : 500;
  const ov = narrow ? { box: { x: 0, y: 0, w: 440, h: H }, anchorY: 92, px: 10.4 } : { box: { x: 0, y: 0, w: 494, h: H }, anchorY: 66, px: 4.85 };
  const inset: Box = narrow ? { x: 452, y: 10, w: 340, h: 980 } : { x: 508, y: 8, w: 284, h: 484 };
  return (
    <Figure
      viewBox={`0 0 ${W} ${H}`}
      maxHeight={narrow ? 1100 : 560}
      label={`Strikkhopp fra en bro ${fmt(BRIDGE_HEIGHT, 0)} m over en elv. Hopperen er ${fmt(st.h, 1)} m over vannet med farten ${fmt(Math.abs(st.v), 1)} m/s ${st.v < -0.05 ? 'nedover' : st.v > 0.05 ? 'oppover' : ''}. Strikkraften er ${fmt(st.S, 0)} N og tyngden ${fmt(st.G, 0)} N.`}
    >
      <Overview p={p} k={k} st={st} {...ov} inset={inset} narrow={narrow} />
      <Closeup p={p} k={k} st={st} box={inset} narrow={narrow} />
    </Figure>
  );
}

/** Oversikten: brua, kløfta og elva i én fast skala (px per meter), med strikken, hopperen og de tre øyeblikkene. */
function Overview({
  p,
  k,
  st,
  box,
  anchorY,
  px,
  inset,
  narrow,
}: {
  p: BungeeParams;
  k: BungeeKeyPoints;
  st: BungeeState;
  box: Box;
  anchorY: number;
  px: number;
  inset: Box;
  narrow: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  // Hoppestedet litt til høyre for midten (plass til etikettene til venstre); kløfta følger med.
  const cx = box.x + box.w * 0.54;
  const waterY = anchorY + BRIDGE_HEIGHT * px;
  const bottom = box.y + box.h;
  const deckBottom = anchorY + 4 * px;
  const feetY = anchorY + st.s * px;
  // Hopperen er tegnet 1,5 ganger så stor som skalaen, ellers blir hun en prikk.
  const size = 1.75 * px * 1.5;
  const rot = jumperRotation(st.t);
  const jp = jumperPoints(size, cx, feetY, rot);
  const ringC = jp.hofte;
  const ringR = size * 0.62 + 5 * ss;

  // Merker for de tre øyeblikkene, med etikettene spredt så de ikke overlapper.
  const marks = [
    { y: anchorY + p.L0 * px, color: VIZ.tension, text: narrow ? 'Strikken stram' : 'Strikken strammes' },
    { y: anchorY + k.sEq * px, color: VIZ.velocity, text: 'Størst fart' },
    { y: anchorY + k.sMax * px, color: VIZ.acceleration, text: 'Laveste punkt' },
  ];
  const labelYs = spreadLabels(
    marks.map((mk) => mk.y),
    19 * f,
    deckBottom + 12 * f,
    waterY - 6 * f,
  );
  const labelX = cx - (narrow ? 24 : 30) * ss;
  const clip = useSvgId('sh-oversikt');
  const scaleX = cx + (narrow ? 44 : 48);

  // Linjer fra lupen rundt hopperen til nærbildet.
  const targets = narrow
    ? [
        { x: inset.x + 14, y: inset.y },
        { x: inset.x + inset.w - 14, y: inset.y },
      ]
    : [
        { x: inset.x, y: inset.y + 14 },
        { x: inset.x, y: inset.y + inset.h - 14 },
      ];

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={box.x} y={0} w={box.w} h={waterY + 2} sol={{ x: box.x + box.w * 0.86, y: 30, r: 14 }} skyer={2} seed={3} />
        <Landskap x={box.x} y={waterY + 1} w={box.w} h={(waterY - anchorY) * 0.5} type="fjell" seed={5} />
        <Landskap x={box.x} y={waterY + 1} w={box.w} h={narrow ? 60 : 46} type="skog" seed={2} />
        <Vann x={box.x} y={waterY} w={box.w} h={bottom - waterY + 2} />
        <Gran x={box.x + 0.05 * box.w} y={deckBottom + 2} size={11 * px} seed={1} />
        <Gran x={box.x + 0.13 * box.w} y={deckBottom + 4} size={8.5 * px} seed={2} />
        <Gran x={box.x + 0.9 * box.w} y={deckBottom + 2} size={10 * px} seed={3} />
        <Gran x={box.x + 0.97 * box.w} y={deckBottom + 4} size={12 * px} seed={4} />
        <Fjellvegg side="venstre" ytre={box.x - 4} topp={[cx - 0.37 * box.w, deckBottom - 3]} bunn={[cx - 0.2 * box.w, bottom + 4]} seed={2} />
        <Fjellvegg side="hoyre" ytre={box.x + box.w + 4} topp={[cx + 0.37 * box.w, deckBottom - 3]} bunn={[cx + 0.21 * box.w, bottom + 4]} seed={5} />
        <Bru x1={box.x - 2} x2={box.x + box.w + 2} y={anchorY} px={px} plattformX={cx} />
      </g>

      <Hoydeskala x={scaleX} yNull={waterY} yTopp={anchorY} hoyde={BRIDGE_HEIGHT} side="hoyre" />

      {marks.map((mk, i) => {
        const ly = labelYs[i]!;
        return (
          <g key={mk.text}>
            <line x1={cx - 14 * ss} x2={cx + 24 * ss} y1={mk.y} y2={mk.y} stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.7} />
            <line x1={cx - 14 * ss} x2={cx + 24 * ss} y1={mk.y} y2={mk.y} stroke={mk.color} strokeWidth={2.2 * ss} strokeDasharray={`${5 * ss} ${3 * ss}`} />
            {Math.abs(ly - mk.y) > 2 && <line x1={cx - 16 * ss} y1={mk.y} x2={labelX + 3} y2={ly - 5 * f} stroke={mk.color} strokeWidth={1.2 * ss} />}
            <Txt x={labelX} y={ly} anchor="end" size={narrow ? 0.7 : 0.82} weight={700} color={mk.color}>
              {mk.text}
            </Txt>
          </g>
        );
      })}

      {/* Lupen rundt hopperen og linjene til nærbildet */}
      {targets.map((tg, i) => {
        const dx = tg.x - ringC.x;
        const dy = tg.y - ringC.y;
        const d = Math.hypot(dx, dy) || 1;
        return (
          <line
            key={i}
            x1={ringC.x + (dx / d) * ringR}
            y1={ringC.y + (dy / d) * ringR}
            x2={tg.x}
            y2={tg.y}
            stroke={VIZ.muted}
            strokeWidth={1 * ss}
            opacity={0.55}
          />
        );
      })}

      <Cord ax={cx} ay={anchorY + 1} fx={jp.ankel.x} fy={jp.ankel.y} s={st.s} L0={p.L0} px={px} thick={narrow ? 3 : 2.4} maxDrop={Infinity} />
      <Jumper x={cx} y={feetY} size={size} rotate={rot} />
      <circle cx={ringC.x} cy={ringC.y} r={ringR} fill="none" stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.75} />
      <circle cx={ringC.x} cy={ringC.y} r={ringR} fill="none" stroke={VIZ.ink} strokeWidth={1.4 * ss} />
    </g>
  );
}

/** Sprer etiketter loddrett så de har minst `gap` mellom seg, innenfor [lo, hi]. Rekkefølgen beholdes. */
function spreadLabels(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y: y + gap * 0.3, i })).sort((a, b) => a.y - b.y);
  const out = order.map((o) => Math.max(lo, o.y));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]! + gap);
  const over = out[out.length - 1]! - hi;
  if (over > 0) {
    out[out.length - 1] = hi;
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i]!, out[i + 1]! - gap);
  }
  const res = new Array<number>(ys.length);
  order.forEach((o, j) => (res[o.i] = out[j]!));
  return res;
}

/** Nærbildet: kameraet følger hopperen. Kreftene G og S og kraftsummen ΣF er tegnet med én fast skala (px/N). */
function Closeup({ p, k, st, box, narrow }: { p: BungeeParams; k: BungeeKeyPoints; st: BungeeState; box: Box; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const P = narrow ? 250 : 160;
  const pxm = P / 1.75;
  const hx = box.x + box.w * 0.4;
  // Føttene står fast i bildet. Plasser dem så både den største strikkraften (opp fra anklene) og tyngden (ned fra
  // tyngdepunktet) får plass med samme skala.
  const hang = personPunkter('falle', P, LEDD, { x: 0, y: 0, rotate: 180 });
  const c = hang.tyngdepunkt.y;
  // Det nederste på hopperen: hendene (armene er strake mot vannet) eller toppen av hjelmen.
  const reach = Math.max(hang.venstreHand.y, hang.hoyreHand.y, hang.hode.y + 0.08 * P) + 6;
  const topLimit = box.y + 34 * f;
  const bottom = box.y + box.h - 10 * f;
  const r = k.G / k.SMax;
  const fy = Math.min(bottom - reach, (bottom - c - 6 * f + topLimit * r) / (1 + r));
  const kN = (fy - topLimit) / k.SMax;

  const rot = jumperRotation(st.t);
  // Når hopperen stuper (ligger nesten vannrett), flyttes hun sidelengs så hele kroppen er i bildet.
  const j0 = jumperPoints(P, hx, fy, rot);
  const margin = 10;
  let shift = Math.min(0, box.x + box.w - margin - j0.maxX);
  if (j0.minX + shift < box.x + margin) shift = box.x + margin - j0.minX;
  const jx = hx + shift;
  const jp = shift === 0 ? j0 : jumperPoints(P, jx, fy, rot);
  const deckY = fy - st.s * pxm;
  const showDeck = deckY + 4.2 * pxm > box.y && deckY < box.y + box.h + 1.2 * pxm;

  // Fartsstriper i lufta som flytter seg oppover når hopperen faller.
  const streaks = useMemo(() => [0.08, 0.2, 0.71, 0.86, 0.94].map((u, i) => ({ x: box.x + u * box.w, y0: ((i * 0.37) % 1) * box.h })), [box.x, box.w, box.h]);
  const speed = Math.abs(st.v);
  // Kraftsummen til høyre for hopperen, med plass til G-etiketten når hun lener seg ut fra plattformen.
  // Til venstre for tyngdepunktet når det ikke er plass til høyre (mens hopperen stuper).
  const sfRight = Math.max(hx + (narrow ? 70 : 54) * ss, jp.tp.x + 46 * f);
  const sfLeft = sfRight + 34 * f > box.x + box.w - 8;
  const sfX = sfLeft ? jp.tp.x - 46 * f : sfRight;
  const sumLen = st.sumF * kN;
  const clip = useSvgId('sh-naerbilde');
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel x={box.x} y={box.y} w={box.w} h={box.h} skyer={1} seed={8} />
        {/* Fjerne fjell lavt i bildet (foten er utenfor), så det ikke ser ut som hopperen er nær bakken. */}
        <Landskap x={box.x} y={box.y + box.h + box.h * 0.12} w={box.w} h={box.h * 0.3} type="fjell" seed={7} />
        {speed > 0.5 &&
          streaks.map((sk, i) => {
            const y = box.y + ((((sk.y0 - st.s * pxm * 0.35) % box.h) + box.h) % box.h);
            const len = 10 + speed * 2.6;
            return <line key={i} x1={sk.x} x2={sk.x} y1={y} y2={y + len} stroke={alpha(SCENE.cloud, 0.9)} strokeWidth={2.4 * ss} strokeLinecap="round" />;
          })}
        {showDeck && <Bru x1={box.x - 4} x2={box.x + box.w + 4} y={deckY} px={pxm} plattformX={hx - 1.5 * pxm} feste={hx - 1} />}
        <Cord
          ax={hx - 1}
          ay={deckY + 0.2 * pxm}
          fx={jp.ankel.x}
          fy={jp.ankel.y}
          s={st.s}
          L0={p.L0}
          px={pxm}
          thick={narrow ? 7 : 6}
          maxDrop={box.y + box.h - fy + 10}
        />
        <Jumper x={jx} y={fy} size={P} rotate={rot} />
      </g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="none" stroke={SCENE.outline} strokeWidth={1.5 * ss} />
      {!narrow && <ValueTag x={box.x + 10} y={box.y + 18 * f} text="Nærbilde" anchor="start" size={0.78} />}

      {/* Kreftene: S i anklene (langs strikken), G i tyngdepunktet og kraftsummen ved siden av */}
      <ForceArrow x1={jp.ankel.x} y1={jp.ankel.y} x2={jp.ankel.x} y2={jp.ankel.y - st.S * kN} color={VIZ.tension} label="S" origin minLength={6} />
      <ForceArrow x1={jp.tp.x} y1={jp.tp.y} x2={jp.tp.x} y2={jp.tp.y + k.G * kN} color={VIZ.gravity} label="G" origin />
      {Math.abs(sumLen) >= 8 ? (
        <ForceArrow
          x1={sfX}
          y1={jp.tp.y}
          x2={sfX}
          y2={jp.tp.y - sumLen}
          color={VIZ.ink}
          dashed
          label="ΣF"
          labelAnchor={sfLeft ? 'end' : undefined}
          labelX={sfLeft ? sfX - 10 * f : undefined}
        />
      ) : (
        <Txt x={sfLeft ? sfX + 8 : sfX - 8} y={jp.tp.y + 6} anchor={sfLeft ? 'end' : 'start'} size={0.9} weight={700}>
          ΣF = 0
        </Txt>
      )}
      <ValueTag
        x={narrow ? box.x + 10 : box.x + box.w - 10}
        y={box.y + 18 * f}
        anchor={narrow ? 'start' : 'end'}
        size={0.78}
        color={VIZ.velocity}
        text={`v = ${fmt(st.v, 1)} m/s`}
      />
    </g>
  );
}

/* ================================================================================================
 * Grafene: h, v og a mot tiden
 * ============================================================================================== */

function GraphFigure({ p, k, st, narrow }: { p: BungeeParams; k: BungeeKeyPoints; st: BungeeState; narrow: boolean }) {
  const heights = narrow ? [300, 300, 350] : [196, 196, 236];
  const bar = narrow ? 52 : 34;
  const H = bar + heights.reduce((a, b) => a + b, 0);
  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={narrow ? 1200 : 700} label="Grafer for høyden over vannet, farten og akselerasjonen mot tiden">
      <Graphs p={p} k={k} st={st} heights={heights} bar={bar} narrow={narrow} />
    </Figure>
  );
}

const PLOTS = [
  { id: 'h', label: 'Høyde h (m)', short: 'h (m)', min: 0, max: BRIDGE_HEIGHT, ticks: [0, 20, 40, 60, 80], narrowTicks: [0, 40, 80], color: VIZ.series[0]! },
  { id: 'v', label: 'Fart v (m/s)', short: 'v (m/s)', min: -30, max: 30, ticks: [-30, -20, -10, 0, 10, 20, 30], narrowTicks: [-30, 0, 30], color: VIZ.velocity },
  { id: 'a', label: 'Akselerasjon a (m/s²)', short: 'a (m/s²)', min: -20, max: 60, ticks: [-20, 0, 20, 40, 60], narrowTicks: [-20, 0, 20, 40, 60], color: VIZ.acceleration },
] as const;

function Graphs({
  p,
  k,
  st,
  heights,
  bar,
  narrow,
}: {
  p: BungeeParams;
  k: BungeeKeyPoints;
  st: BungeeState;
  heights: number[];
  bar: number;
  narrow: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const tMax = k.tEnd;
  const series = useMemo(() => {
    const n = 320;
    const h: [number, number][] = [];
    const v: [number, number][] = [];
    const a: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = (tMax * i) / n;
      const s = bungeeState(p, t, k);
      h.push([t, s.h]);
      v.push([t, s.v]);
      a.push([t, s.a]);
    }
    return { h, v, a };
  }, [p, k, tMax]);
  const step = narrow ? (tMax > 6 ? 2 : 1) : tMax <= 3.5 ? 0.5 : 1;
  const xt: number[] = [];
  for (let x = 0; x <= tMax + 1e-9; x += step) xt.push(Math.round(x * 10) / 10);
  const dec = step < 1 ? 1 : 0;
  const margin = (last: boolean) => ({ top: 12 * f, right: 24 * f, bottom: (last ? 56 : 32) * f, left: 72 * f });
  const events = [
    { t: k.tTaut, color: VIZ.tension },
    { t: k.tVmax, color: VIZ.velocity },
    { t: k.tBottom, color: VIZ.acceleration },
  ];
  // Fasestripa over grafene: fritt fall og strikken drar (samme x-skala som plottene).
  const m0 = margin(false);
  const sxBar = (t: number) => m0.left + ((800 - m0.left - m0.right) * t) / tMax;
  let y = bar;
  return (
    <>
      <g>
        <rect x={sxBar(0)} y={4} width={sxBar(k.tTaut) - sxBar(0)} height={bar - 10} rx={6} fill={alpha(VIZ.gravity, 0.14)} stroke={alpha(VIZ.gravity, 0.5)} strokeWidth={1 * ss} />
        <rect x={sxBar(k.tTaut)} y={4} width={sxBar(tMax) - sxBar(k.tTaut)} height={bar - 10} rx={6} fill={alpha(VIZ.tension, 0.16)} stroke={alpha(VIZ.tension, 0.55)} strokeWidth={1 * ss} />
        <Txt x={(sxBar(0) + sxBar(k.tTaut)) / 2} y={4 + (bar - 10) / 2 + 5.5 * f * 0.8} size={0.8} weight={650}>
          Fritt fall
        </Txt>
        <Txt x={(sxBar(k.tTaut) + sxBar(tMax)) / 2} y={4 + (bar - 10) / 2 + 5.5 * f * 0.8} size={0.8} weight={650}>
          Strikken drar
        </Txt>
      </g>
      {PLOTS.map((pl, i) => {
        const ph = heights[i]!;
        const last = i === PLOTS.length - 1;
        const top = y;
        y += ph;
        const pts = series[pl.id];
        const cur = pl.id === 'h' ? st.h : pl.id === 'v' ? st.v : st.a;
        return (
          <g key={pl.id} transform={`translate(0 ${top})`}>
            <Plot
              x={{ min: 0, max: tMax, label: last ? 'Tid t (s)' : '', ticks: xt, decimals: dec }}
              y={{ min: pl.min, max: pl.max, label: narrow ? pl.short : pl.label, ticks: narrow ? [...pl.narrowTicks] : [...pl.ticks] }}
              width={800}
              height={ph}
              margin={margin(last)}
            >
              {({ sx, sy, y0, y1 }) => (
                <g>
                  <rect x={sx(k.tTaut)} y={y1} width={sx(tMax) - sx(k.tTaut)} height={y0 - y1} fill={alpha(VIZ.tension, 0.07)} />
                  {events.map((ev, j) => (
                    <line key={j} x1={sx(ev.t)} x2={sx(ev.t)} y1={y0} y2={y1} stroke={ev.color} strokeWidth={1.8 * ss} strokeDasharray={`${6 * ss} ${4 * ss}`} opacity={0.9} />
                  ))}
                  {pl.id === 'h' && (
                    <line x1={sx(0)} x2={sx(tMax)} y1={sy(k.hMin)} y2={sy(k.hMin)} stroke={VIZ.acceleration} strokeWidth={1.2 * ss} strokeDasharray={`${2 * ss} ${4 * ss}`} opacity={0.8} />
                  )}
                  <path d={linePath(pts, sx, sy)} fill="none" stroke={pl.color} strokeWidth={3.2 * ss} strokeLinejoin="round" />
                  {pl.id === 'v' && <Dot x={sx(k.tVmax)} y={sy(-k.vMax)} r={5 * ss} color={VIZ.velocity} />}
                  {pl.id === 'a' && <Dot x={sx(k.tBottom)} y={sy(k.aMax)} r={5 * ss} color={VIZ.acceleration} />}
                  {pl.id === 'h' && <Dot x={sx(k.tBottom)} y={sy(k.hMin)} r={5 * ss} color={VIZ.acceleration} />}
                  <line x1={sx(st.t)} y1={y0} x2={sx(st.t)} y2={y1} className="viz-guide" />
                  <Dot x={sx(st.t)} y={sy(cur)} color={VIZ.ink} r={7 * ss} />
                </g>
              )}
            </Plot>
          </g>
        );
      })}
    </>
  );
}

/* ================================================================================================
 * Forklaringen
 * ============================================================================================== */

function explanation(p: BungeeParams, k: BungeeKeyPoints, st: BungeeState): ReactNode {
  const n = (x: number) => `${fmt(x, 0)} N`;
  const ms = (x: number) => `${fmt(Math.abs(x), 1)} m/s`;
  // Det nærmeste av de tre øyeblikkene, hvis tiden er like ved det.
  const moments: [BungeeMoment, number][] = [
    ['stram', k.tTaut],
    ['vmaks', k.tVmax],
    ['bunn', k.tBottom],
  ];
  let near: BungeeMoment | null = null;
  let best = 0.04;
  for (const [id, tm] of moments) {
    const d = Math.abs(st.t - tm);
    if (d < best) {
      best = d;
      near = id;
    }
  }
  const nearTaut = near === 'stram';
  const nearV = near === 'vmaks';
  const nearBottom = near === 'bunn';
  const atEnd = st.t >= k.tEnd - 0.01;
  let main: ReactNode;
  if (st.t < 0.02) {
    main = (
      <p>
        <strong>Hopperen lener seg ut.</strong> Strikken er festet i plattformen og ligger slakk. Så snart føttene slipper, er tyngden G ={' '}
        {n(k.G)} den eneste kraften, og hopperen faller fritt med a = −g = −9,81 m/s². Trykk «Spill av» eller velg et øyeblikk.
      </p>
    );
  } else if (nearTaut) {
    main = (
      <p>
        <strong>Strikken strammes.</strong> Hopperen har falt L<Sub>0</Sub> = {fmt(p.L0, 0)} m på {fmt(k.tTaut, 2)} s og har farten √(2gL
        <Sub>0</Sub>) = {ms(k.vTaut)}. Strikken er rett, men ennå ikke strukket, så S = 0 og a = −g akkurat nå. Herfra vokser S = k · Δx jo
        lenger hopperen faller. Farten er likevel ikke størst her: den fortsetter å øke til S har blitt like stor som G, {fmt(k.dEq, 1)} m
        lenger ned.
      </p>
    );
  } else if (st.phase === 'fritt-fall-ned') {
    main = (
      <p>
        <strong>Fritt fall.</strong> Strikken henger slakk i en løkke og drar ikke (S = 0), så ΣF = −G og a = −9,81 m/s², uansett masse.
        Farten øker med 9,81 m/s hvert sekund og er nå {ms(st.v)}. Strikken strammes etter {fmt(k.tTaut, 2)} s, når hopperen har falt L
        <Sub>0</Sub> = {fmt(p.L0, 0)} m og har farten √(2gL<Sub>0</Sub>) = {ms(k.vTaut)}.
      </p>
    );
  } else if (nearV) {
    main = (
      <p>
        <strong>Størst fart: ΣF = 0.</strong> Her drar strikken like hardt opp som tyngden drar ned: S = G = {n(k.G)}. Kraftsummen er null,
        så a = 0, og farten slutter å øke: v<Sub>maks</Sub> = {ms(k.vMax)}. Strikken er da strukket Δx = mg/k = {fmt(k.dEq, 2)} m, altså{' '}
        {fmt(k.sEq, 1)} m under brua. Legg merke til at a = 0 ikke betyr at hopperen står stille, bare at farten ikke endrer seg akkurat nå (som i Newtons 1. lov).
      </p>
    );
  } else if (nearBottom) {
    main = (
      <p>
        <strong>Laveste punkt: v = 0, men a er størst.</strong> Hopperen er {fmt(k.sMax, 1)} m under brua, {fmt(k.hMin, 1)} m over vannet
        (hodet ca. {fmt(k.headClearance, 0)} m over). Strikken er strukket {fmt(k.dxMax, 1)} m og drar med S = {n(k.SMax)}, hele{' '}
        {fmt(k.SMax / k.G, 1)} ganger tyngden. Da er ΣF = {n(k.SMax - k.G)} oppover og a = {fmt(k.aMax, 1)} m/s² ({fmt(inG(k.aMax), 1)} g). Mange
        tror at a = 0 når v = 0, men akselerasjonen sier hvordan farten endrer seg: like etterpå er farten rettet oppover.
      </p>
    );
  } else if (st.phase === 'strukket-ned' && st.t < k.tVmax) {
    main = (
      <p>
        <strong>Strikken er stram, men farten øker fortsatt.</strong> Strikken drar med S = {n(st.S)}, som er mindre enn G = {n(k.G)}. Kraftsummen
        ΣF = {n(st.sumF)} peker fortsatt nedover, så hopperen går fortere, bare langsommere enn før (|a| = {fmt(Math.abs(st.a), 1)} m/s² &lt; g).
        Mange tror hopperen bremser med en gang strikken strammes, men det skjer først når S blir større enn G.
      </p>
    );
  } else if (st.phase === 'strukket-ned') {
    main = (
      <p>
        <strong>Oppbremsing.</strong> Nå er S = {n(st.S)} større enn G, så kraftsummen ΣF = {n(st.sumF)} peker oppover, mot bevegelsen, og
        farten avtar ({ms(st.v)}). Jo lenger strikken strekkes, jo større blir S, og jo kraftigere bremser den. Akselerasjonen blir størst i det
        laveste punktet.
      </p>
    );
  } else if (st.phase === 'strukket-opp' && !atEnd) {
    main = (
      <p>
        <strong>På vei opp.</strong> Strikken trekker hopperen opp igjen. Under likevektspunktet ({fmt(k.sEq, 1)} m under brua) er S &gt; G og
        farten oppover øker; over det er S &lt; G og farten avtar. Bevegelsen er et speilbilde av turen ned: kraften avhenger bare av hvor langt
        strikken er strukket.
      </p>
    );
  } else {
    main = (
      <p>
        <strong>Strikken er slakk igjen.</strong> Hopperen er tilbake der strikken ble stram, med {ms(st.v)} oppover, og fortsetter oppover i
        fritt fall (a = −g). I modellen kommer hopperen helt opp til brua igjen, fordi vi har sett bort fra luftmotstand og varme i strikken. I
        virkeligheten tapes litt energi i hver svingning, så hoppene blir lavere og lavere.
      </p>
    );
  }
  const clearanceWarn = k.headClearance < 12;
  return (
    <>
      {main}
      <p>
        Positiv retning er oppover, så v og a er negative når de peker nedover. S = k · Δx endrer seg hele tiden, så akselerasjonen er ikke konstant, og bevegelseslikningene for konstant akselerasjon gjelder ikke når
        strikken drar. Grafene viser løsningen av Newtons 2. lov, ΣF = ma, som en datamaskin finner ved å regne i små tidssteg (2F). Stigningstallet
        i h-grafen er v, og stigningstallet i v-grafen er a: der v-grafen har bunnpunkt, er a = 0.
      </p>
      {clearanceWarn ? (
        <p>
          <strong>For nær vannet!</strong> Hodet kommer bare ca. {fmt(k.headClearance, 0)} m over vannet. En tyngre hopper, en lengre strikk eller
          en mykere strikk gir et lavere laveste punkt. Derfor veier de deg før hoppet og velger strikk etter vekta.
        </p>
      ) : (
        <p>
          Prøv en stivere strikk: hoppet blir kortere, men oppbremsingen brå og a<Sub>maks</Sub> stor. En tyngre hopper med samme strikk kommer
          lenger ned, men får mindre akselerasjon. Modellen ser bort fra luftmotstand og regner hopperen som et punkt i enden av strikken.
        </p>
      )}
    </>
  );
}
