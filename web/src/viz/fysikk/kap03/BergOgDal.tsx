import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  G_EARTH,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toggle,
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
import { Bergbanevogn, Dimension, ForceArrow, Gran, Himmel, Landskap, Lauvtre, Underlag, ValueTag, alpha, useStrokeScale } from '../../kit/scene';
import { CartShadow, Passasjerer, Skinner, Stotter, coasterBodyLift, useTrackGeometry, type TrackLayout } from './berg-og-dal-deler';
import { arrowHitsBox, boxesOverlap, textBox, textWidth, type Box } from './energibevaring-scene';
import {
  COASTER_MU,
  CREST_RISE,
  H0_MAX,
  H0_MIN,
  MAX_RIDERS,
  POINT_IDS,
  cartMass,
  energyState,
  getPoint,
  makeCoaster,
  minStartHeight,
  pointResults,
  reachHeight,
  rideAt,
  simulateRide,
  turningPoint,
  type Coaster,
  type EnergyState,
  type PointId,
  type PointResult,
  type Ride,
  type TurnPoint,
} from './model-berg-og-dal';
import { useNarrow } from './useNarrow';

/** Hvor vogna står: i start, i et av punktene (fra energibevaring) eller fritt mens animasjonen går. */
type Spot = 'S' | PointId | 'fri';

const SPOTS: { value: Spot; label: string }[] = [
  { value: 'S', label: 'Start' },
  ...POINT_IDS.map((id) => ({ value: id as Spot, label: id })),
];

const C_EP = VIZ.gravity;
const C_EK = VIZ.velocity;
const C_HEAT = VIZ.friction;

/** Synlig del av banen (m) og skalaen i figuren: like mange piksler per meter vannrett og loddrett. */
const X_LEFT = -15;
const X_RIGHT = 122;
const W = 800;
const PPM = W / (X_RIGHT - X_LEFT);

interface CartState {
  x: number;
  h: number;
  /** Strekningen vogna har kjørt langs banen (m). */
  d: number;
  /** Fortegnet til farten (1 framover, −1 bakover, 0 i ro). */
  dir: number;
  e: EnergyState;
}

export default function BergOgDal() {
  const [h0, setH0] = useState(26);
  const [riders, setRiders] = useState(2);
  const [friction, setFriction] = useState(false);
  const [place, setPlace] = useState<Spot>('B');
  const { ref, narrow } = useNarrow();

  const mu = friction ? COASTER_MU : 0;
  const m = cartMass(riders);
  const coaster = useMemo(() => makeCoaster(h0), [h0]);
  const ride = useMemo(() => simulateRide(coaster, mu), [coaster, mu]);
  const results = useMemo(() => pointResults(coaster, mu), [coaster, mu]);
  const turn = useMemo(() => turningPoint(coaster, mu), [coaster, mu]);
  const clock = useSimClock({ tMax: ride.tEnd });
  const { setT, pause } = clock;

  // Velger du et punkt (eller endrer noe), flyttes vogna dit og står i ro.
  const target = place === 'fri' ? null : place === 'S' ? 0 : ride.firstTime[place];
  useEffect(() => {
    if (target === null) return;
    pause();
    setT(target);
  }, [target, pause, setT]);

  const choose = (p: Spot) => setPlace(p);
  const change = (fn: () => void) => {
    fn();
    if (place === 'fri') setPlace('S');
  };
  // Avspilling: vogna går fritt fra der den står
  const playClock: SimClock = {
    ...clock,
    toggle: () => {
      setPlace('fri');
      clock.toggle();
    },
    reset: () => {
      setPlace('S');
      clock.reset();
    },
  };

  const state = cartState({ coaster, ride, results, turn, place, t: clock.t, m, mu });
  const minH = useMemo(() => ({ none: minStartHeight(0), mu: minStartHeight(COASTER_MU) }), []);

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Starthøyde h<Sub>0</Sub>
            </>
          }
          ariaLabel="Starthøyde"
          value={h0}
          onChange={(v) => change(() => setH0(v))}
          min={H0_MIN}
          max={H0_MAX}
          step={0.5}
          unit="m"
          decimals={1}
        />
        <Slider
          label="Passasjerer"
          value={riders}
          onChange={(v) => change(() => setRiders(v))}
          min={0}
          max={MAX_RIDERS}
          step={1}
          format={(v) => `${fmt(v, 0)} (m = ${fmt(cartMass(v), 0)} kg)`}
        />
      </Controls>
      <Toolbar>
        <Toggle label={`Med friksjon og luftmotstand (R = ${fmt(COASTER_MU * 100, 0)} % av G)`} checked={friction} onChange={(on) => change(() => setFriction(on))} />
      </Toolbar>
      <Toolbar>
        <Segmented label="Plasser vogna" options={SPOTS} value={place} onChange={choose} />
        <PlayControls clock={playClock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${W} ${sceneHeight(narrow)}`}
          label={sceneLabel(coaster, results, turn, state, friction)}
          maxHeight={narrow ? 520 : 440}
          caption="Vogna er tegnet større enn i virkeligheten, så den skal synes."
        >
          <Scene coaster={coaster} results={results} turn={turn} state={state} place={place} mu={mu} riders={riders} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.ink, dashed: true, label: 'Så høyt vogna kan komme med energien den har' },
          {
            color: C_EK,
            label: (
              <span>
                E<Sub>k</Sub> som høyde: v²/2g fra prikken på skinnen (der h måles) opp til linja
              </span>
            ),
          },
          ...(friction
            ? [
                {
                  color: C_HEAT,
                  label: (
                    <span>
                      Blitt til termisk energi, −W<Sub>R</Sub>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <Figure
        viewBox={`0 0 ${W} ${narrow ? 850 : 330}`}
        label={`Energistolper for vogna akkurat nå, og farten langs banen som funksjon av vannrett posisjon${friction ? ', med og uten friksjon' : ''}.`}
        maxHeight={narrow ? 820 : 380}
      >
        <EnergyAndSpeed coaster={coaster} ride={ride} results={results} turn={turn} state={state} place={place} t={clock.t} mu={mu} narrow={narrow} />
      </Figure>

      <Readouts>
        {results.map((p) => (
          <Readout
            key={p.id}
            label={`Fart i ${p.id} (${fmt(p.h, 0)} m)`}
            value={p.v === null ? 'når ikke' : fmt(p.v, 1)}
            unit={p.v === null ? undefined : 'm/s'}
            tone={p.v === null ? undefined : C_EK}
          />
        ))}
      </Readouts>

      <EnergyFormula coaster={coaster} state={state} place={place} results={results} m={m} mu={mu} />

      <Explain>
        <ExplainText coaster={coaster} results={results} turn={turn} state={state} place={place} ride={ride} t={clock.t} m={m} mu={mu} minH={minH} />
      </Explain>
    </VizLayout>
  );
}

/* ---------- Tilstanden til vogna ---------- */

function cartState({
  coaster,
  ride,
  results,
  turn,
  place,
  t,
  m,
  mu,
}: {
  coaster: Coaster;
  ride: Ride;
  results: PointResult[];
  turn: TurnPoint | null;
  place: Spot;
  t: number;
  m: number;
  mu: number;
}): CartState {
  const h0 = coaster.h0;
  const make = (x: number, h: number, d: number, dir: number, still = false): CartState => {
    const e = energyState({ m, h0, h, s: d, mu });
    // I ro (start, vendepunkt, stoppet) er E_k = 0, og den blir aldri negativ, selv om avrundingen i simuleringen
    // gir noen få joule for mye eller for lite.
    const Ek = still ? 0 : Math.max(0, e.Ek);
    return { x, h, d, dir: still ? 0 : dir, e: { ...e, Ek, E: e.Ep + Ek, v: Math.sqrt((2 * Ek) / m) } };
  };
  if (place === 'S') return make(0, h0, 0, 0, true);
  if (place !== 'fri') {
    const p = results.find((r) => r.id === place)!;
    if (p.v !== null) return make(p.x, p.h, p.s, 1);
    // Kommer ikke fram: vogna står i vendepunktet
    if (turn) return make(turn.x, turn.h, turn.s, 0, true);
  }
  const s = rideAt(ride, t);
  const still = s.v === 0 || (ride.stopTime !== null && t >= ride.stopTime);
  return make(s.x, coaster.height(s.x), s.d, Math.sign(s.v), still);
}

/* ---------- Scenen ---------- */

/**
 * Utformingen av scenen. På PC vises hele banen. På mobil viser figuren et utsnitt på 72 m som følger vogna
 * (himmel og landskap ruller med parallakse), ellers blir vogna og bakkene for små. Hele banen ses i fartsgrafen.
 */
interface SceneLayout extends TrackLayout {
  H: number;
  /** Bredden på hele banen i figurens enheter (større enn W på mobil). */
  worldW: number;
  /** Lengden på vogna i figurens enheter (8,6 m: vogna er tegnet ca. fire ganger for stor). */
  cart: number;
}

function layoutFor(narrow: boolean): SceneLayout {
  const xLeft = narrow ? -8 : X_LEFT;
  const xRight = narrow ? 124 : X_RIGHT;
  const ppm = narrow ? W / 72 : PPM;
  const top = narrow ? 104 : 66;
  const bottom = narrow ? 62 : 40;
  const H = Math.round(top + (H0_MAX + CREST_RISE + 1.5) * ppm + bottom);
  const groundY = H - bottom;
  const yZero = groundY - 1.5 * ppm;
  return {
    X: (x: number) => (x - xLeft) * ppm,
    Y: (h: number) => yZero - h * ppm,
    ppm,
    groundY,
    xLeft,
    xRight,
    rail: narrow ? 5.2 : 3.4,
    H,
    worldW: (xRight - xLeft) * ppm,
    cart: 8.6 * ppm,
  };
}

const LAYOUTS = { wide: layoutFor(false), narrow: layoutFor(true) };
const sceneHeight = (narrow: boolean) => (narrow ? LAYOUTS.narrow : LAYOUTS.wide).H;

function sceneLabel(c: Coaster, results: PointResult[], turn: TurnPoint | null, s: CartState, friction: boolean): string {
  const tops = results.filter((p) => p.top).map((p) => `${p.id} er ${fmt(p.h, 0)} m høy`);
  const end = turn ? `Vogna kommer ikke over ${results.find((p) => p.v === null)?.id ?? 'neste topp'}, men snur i ${fmt(turn.h, 1)} m høyde.` : 'Vogna kommer over alle toppene og fram til bremsene i D.';
  return `Berg-og-dal-bane der vogna starter i ro ${fmt(c.h0, 1)} m over det laveste punktet A. Toppen ${tops.join(' og toppen ')}. ${end} Vogna er nå ${fmt(s.h, 1)} m over nullnivået med farten ${fmt(s.e.v, 1)} m/s${friction ? ', med friksjon' : ''}.`;
}

/** Trær bak banen: vannrett posisjon (m), høyde (m) og type. */
const TREES: { x: number; size: number; kind: 'gran' | 'lauv'; seed: number }[] = [
  { x: -11, size: 13, kind: 'gran', seed: 2 },
  { x: 31, size: 9, kind: 'lauv', seed: 3 },
  { x: 62, size: 15, kind: 'gran', seed: 4 },
  { x: 66, size: 11, kind: 'gran', seed: 5 },
  { x: 97, size: 9, kind: 'lauv', seed: 6 },
  { x: 117, size: 14, kind: 'gran', seed: 7 },
];

function Scene({
  coaster,
  results,
  turn,
  state,
  place,
  mu,
  riders,
  narrow,
}: {
  coaster: Coaster;
  results: PointResult[];
  turn: TurnPoint | null;
  state: CartState;
  place: Spot;
  mu: number;
  riders: number;
  narrow: boolean;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const L = narrow ? LAYOUTS.narrow : LAYOUTS.wide;
  const { X, Y, groundY, ppm, H } = L;
  const geo = useTrackGeometry(coaster, L);
  const h0 = coaster.h0;
  const horizon = groundY - 34;
  // Kameraet: vogna litt til venstre for midten, men aldri utenfor banen
  const cam = Math.min(Math.max(0, X(state.x) - W * 0.42), Math.max(0, L.worldW - W));
  const viewLeft = L.xLeft + cam / ppm;

  // Linja for hvor høyt energien rekker, fra start til vendepunktet eller bremsene (første tur fram)
  const lineEnd = turn ? turn.x : coaster.xEnd;
  const { reachPath, band } = useMemo(() => {
    const pts: [number, number][] = [];
    for (let x = 0; x < lineEnd; x += 0.5) pts.push([x, reachHeight(coaster, x, mu)]);
    pts.push([lineEnd, reachHeight(coaster, lineEnd, mu)]);
    const d = pts.map(([x, h], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(h).toFixed(1)}`).join('');
    return { reachPath: d, band: mu > 0 ? `${d}L${X(lineEnd).toFixed(1)},${Y(h0).toFixed(1)}L${X(0).toFixed(1)},${Y(h0).toFixed(1)}Z` : '' };
  }, [coaster, mu, lineEnd, X, Y, h0]);

  // Vogna: oppå skinnen, dreid etter tangenten og med krumningen i kurven
  const size = L.cart;
  const k = coaster.slope(state.x);
  const n = Math.sqrt(1 + k * k);
  const px = X(state.x);
  const py = Y(state.h);
  const rot = (-Math.atan(k) * 180) / Math.PI;
  const krumning = coaster.curvature(state.x) / ppm;
  const lift = coasterBodyLift(size, krumning);
  const up = { x: -k / n, y: -1 / n };
  const fwd = { x: 1 / n, y: -k / n };
  const v = state.e.v;
  const reachNow = h0 - mu * state.d;
  const cartH = 0.6 * size;
  // Fartspila foran vogna (bak den når den triller baklengs), midt på høyden av vogna
  const dir = state.dir < 0 ? -1 : 1;
  const vLen = 2.6 * (narrow ? 1.5 : 1) * v;
  const a0 = { x: px + dir * fwd.x * (size * 0.52 + 4) + up.x * cartH * 0.45, y: py + dir * fwd.y * (size * 0.52 + 4) + up.y * cartH * 0.45 };

  // Toppen vogna ikke kommer over
  const failed = turn ? results.find((p) => p.top && p.x >= turn.x - 1e-6) : undefined;
  const placeId = place === 'fri' || place === 'S' ? null : place;
  const atPoint = (p: PointResult) => Math.abs(p.x - state.x) < 0.3;

  // Synlig del av figuren (i verdens koordinater)
  const viewL = cam + 6;
  const viewR = cam + W - 6;
  const tip = { x: a0.x + dir * fwd.x * vLen, y: a0.y + dir * fwd.y * vLen };
  const vText = `v = ${fmt(v, 1)} m/s`;

  // Punktene A–D: markør på skinnen og navn under (bunnene under banen, toppene under buen)
  const pointMarks = results
    .filter((p) => X(p.x) >= viewL - 10 && X(p.x) <= viewR + 10)
    .map((p) => {
      const on = p.id === placeId;
      const size = on ? 1 : 0.9;
      const dy = p.top ? 30 + 16 * f : 18 + 16 * f;
      const text = `${p.id} ${p.h === 0 ? 'nullnivå' : `${fmt(p.h, 0)} m`}`;
      const w = textWidth(text, 0.84 * size, f);
      // Etiketten under punktet, men innenfor figuren (på mobil kan punktet ligge nær kanten av utsnittet)
      const lx = Math.min(viewR - w / 2, Math.max(viewL + w / 2, X(p.x)));
      const ly = Y(p.h) + dy;
      const r = 3.6 * ss;
      return {
        p,
        on,
        size,
        lx,
        ly,
        boxes: [textBox(lx, ly, w, 'middle', size, f), { x0: X(p.x) - r - 4, x1: X(p.x) + r + 4, y0: Y(p.h) - r - 4, y1: Y(p.h) + r + 4 }],
      };
    });

  // E_k som høyde: fra prikken på skinnen midt under vogna (der h måles) opp til linja for hvor høyt energien rekker.
  // Mållinja står like bak vogna, så den ikke går gjennom vogna og fartspila; en stiplet hjelpelinje viser høyden h.
  const marginM = reachNow - state.h;
  const showEk = v > 0.05 && marginM > 0.02;
  const behind = -dir;
  const xd = px + behind * (size * 0.55 + 8 + 6 * f);
  const ekText = `v²/2g = ${fmt(marginM, 1)} m`;
  const ekW = textWidth(ekText, 0.85, f);
  const yReachNow = Y(reachNow);
  const cartBox: Box = { x0: px - size * 0.6, x1: px + size * 0.6, y0: Math.min(py, py + up.y * cartH) - 6, y1: py + 6 };

  // h₀ ved venstre ende av den synlige delen av linja, men til høyre for vogna (når den står nær linja) og mållinja for E_k
  let xLabel = Math.max(narrow ? 3 : 4.5, viewLeft + 1.5);
  const h0W = textWidth(`h₀ = ${fmt(h0, 1)} m`, 0.92, f);
  const lineAt = (x: number) => Y(reachHeight(coaster, Math.min(Math.max(x, 0), lineEnd), mu));
  const busy: [number, number][] = [];
  if (Math.abs(Y(state.h) - lineAt(xLabel)) < cartH + 24 * f || showEk) busy.push([cartBox.x0, cartBox.x1]);
  if (showEk) busy.push([xd - 10, xd + 10]);
  busy.sort((p1, p2) => p1[0] - p2[0]);
  for (const [b0, b1] of busy) if (X(xLabel) < b1 + 4 && X(xLabel) + h0W > b0 - 4) xLabel = Math.max(xLabel, L.xLeft + (b1 + 10) / ppm);
  const yLabel = lineAt(xLabel) - 9 * f;
  const h0Box = textBox(X(xLabel), yLabel, h0W, 'start', 0.92, f);

  // Etiketten for E_k: ved mållinja, helst på siden bort fra vogna, ellers mellom mållinja og vogna eller over linja
  const ekLabel = (() => {
    if (!showEk) return null;
    const ymid = (py + yReachNow) / 2 + 6 * f;
    const an = (d: number): 'start' | 'end' => (d > 0 ? 'start' : 'end');
    const cands = [
      { x: xd + behind * 8 * f, y: ymid, anchor: an(behind) },
      { x: xd + behind * 8 * f, y: yReachNow + 18 * f, anchor: an(behind) },
      { x: xd - behind * 8 * f, y: yReachNow + 18 * f, anchor: an(-behind) },
      { x: xd, y: yReachNow - 9 * f, anchor: 'middle' as const },
      { x: xd - behind * 8 * f, y: yReachNow - 9 * f, anchor: an(-behind) },
      { x: xd + behind * 8 * f, y: yReachNow - 9 * f, anchor: an(behind) },
      { x: xd - behind * 8 * f, y: ymid, anchor: an(-behind) },
    ].map((c) => ({ ...c, box: textBox(c.x, c.y, ekW, c.anchor, 0.85, f) }));
    const inside = (bx: Box) => bx.x0 >= viewL && bx.x1 <= viewR && bx.y0 >= 0;
    const good = cands.find(
      (c) => inside(c.box) && !boxesOverlap(c.box, cartBox) && !boxesOverlap(c.box, h0Box) && !pointMarks.some((m) => m.boxes.some((o) => boxesOverlap(c.box, o))),
    );
    if (good) return good;
    const c = cands[3]!;
    const x = Math.min(viewR - ekW / 2, Math.max(viewL + ekW / 2, c.x));
    return { x, y: c.y, anchor: 'middle' as const, box: textBox(x, c.y, ekW, 'middle', 0.85, f) };
  })();
  const ekBox = ekLabel ? ekLabel.box : null;

  const vLabel = placeSpeedLabel({
    a0,
    tip,
    up,
    text: vText,
    f,
    ss,
    viewL,
    viewR,
    cartBox,
    lineY: (x) => (x >= 0 && x <= lineEnd ? Y(reachHeight(coaster, x, mu)) : null),
    toX: (px2) => L.xLeft + px2 / ppm,
    obstacles: [
      ...pointMarks.flatMap((m) => m.boxes),
      ...(ekBox ? [ekBox] : []),
      h0Box,
      // Mållinja for E_k og hjelpelinjene til den
      ...(showEk
        ? [
            { x0: xd - 7, x1: xd + 7, y0: yReachNow - 4, y1: py + 4 },
            { x0: Math.min(px, xd) - 2, x1: Math.max(px, xd) + 2, y0: py - 3, y1: py + 3 },
          ]
        : []),
    ],
  });


  return (
    <g>
      <Himmel w={W} h={H} sol={{ x: 744, y: 44, r: 18 }} skyer={2} seed={5} forskyvning={cam} />
      <Landskap x={0} y={horizon} w={W} h={96} type="aaser" seed={3} forskyvning={cam} />
      <Underlag x1={0} x2={W} y={groundY} depth={H - groundY} type="gress" horisont={horizon} forskyvning={cam} />
      <g transform={cam ? `translate(${(-cam).toFixed(1)} 0)` : undefined}>
        {TREES.map((t) =>
          t.kind === 'gran' ? (
            <Gran key={t.x} x={X(t.x)} y={groundY - 8} size={t.size * ppm} seed={t.seed} />
          ) : (
            <Lauvtre key={t.x} x={X(t.x)} y={groundY - 8} size={t.size * ppm} seed={t.seed} />
          ),
        )}
        <CartShadow x={px} groundY={groundY} size={size} height={groundY - py} />
        <Stotter geo={geo} groundY={groundY} ppm={ppm} />

        {/* Nullnivået gjennom det laveste punktet (A) */}
        <line x1={0} x2={L.worldW} y1={Y(0)} y2={Y(0)} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="3 5" opacity={0.45} />

        {/* Hvor høyt energien rekker: h₀ uten friksjon, synkende med friksjon */}
        {mu > 0 && (
          <>
            <path d={band} fill={alpha(C_HEAT, 0.2)} />
            <line x1={X(0)} x2={X(lineEnd)} y1={Y(h0)} y2={Y(h0)} stroke={C_HEAT} strokeWidth={1.2 * ss} strokeDasharray="4 4" opacity={0.7} />
          </>
        )}
        <path d={reachPath} fill="none" stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.7} />
        <path d={reachPath} fill="none" stroke={VIZ.ink} strokeWidth={2 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />

        <Skinner geo={geo} rail={L.rail} />

        {/* Vendepunkt og hvor mye energien mangler på toppen */}
        {turn && failed && (
          <TurnMarks
            turn={turn}
            failed={failed}
            L={L}
            viewL={viewL}
            viewR={viewR}
            avoid={pointMarks.find((m) => m.p.id === failed.id)?.boxes[0]}
          />
        )}

        {/* E_k som høyde v²/2g: hjelpelinje i høyden h fra prikken under vogna, og mållinja opp til linja */}
        {showEk && (
          <g>
            <line x1={px} x2={xd + behind * 5} y1={py} y2={py} stroke={C_EK} strokeWidth={1.3 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} opacity={0.9} />
            <line x1={px} x2={xd + behind * 5} y1={Y(reachNow)} y2={Y(reachNow)} stroke={C_EK} strokeWidth={1.3 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} opacity={0.9} />
            <Dimension x1={xd} y1={py} x2={xd} y2={yReachNow} color={C_EK} />
          </g>
        )}

        <Passasjerer n={riders} x={px} y={py} size={size} rotate={rot} lift={lift} />
        <Bergbanevogn x={px} y={py} size={size} rotate={rot} krumning={krumning} skinne={L.rail} lakk="gul" hjulvinkel={(state.d / 0.11) * (180 / Math.PI)} />
        {/* Punktet på skinnen der høyden h måles (midt under vogna) */}
        <circle cx={px} cy={py} r={2.8 * ss} fill={C_EK} stroke={VIZ.surface} strokeWidth={1.4 * ss} />

        {v > 0.05 ? (
          <ForceArrow x1={a0.x} y1={a0.y} x2={tip.x} y2={tip.y} color={C_EK} width={5} />
        ) : (
          <ValueTag x={px} y={py - cartH - 16 * f} text="v = 0" color={C_EK} size={0.85} />
        )}

        {/* Punktene A–D oppå pila, så markøren synes også når vogna kjører forbi */}
        {pointMarks.map(({ p, on, size: sz, lx, ly }) => (
          <g key={p.id}>
            {!atPoint(p) && <circle cx={X(p.x)} cy={Y(p.h)} r={3.6 * ss} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.4 * ss} />}
            <Txt x={lx} y={ly} size={sz} weight={700} color={on ? VIZ.ink : undefined}>
              {p.id}
              <tspan style={{ fill: VIZ.muted, fontWeight: 560 }} fontSize="0.82em">
                {' '}
                {p.h === 0 ? 'nullnivå' : `${fmt(p.h, 0)} m`}
              </tspan>
            </Txt>
          </g>
        ))}

        {ekLabel && (
          <Txt x={ekLabel.x} y={ekLabel.y} anchor={ekLabel.anchor} color={C_EK} weight={650} size={0.85}>
            {ekText}
          </Txt>
        )}
        {v > 0.05 && (
          <Txt x={vLabel.x} y={vLabel.y} anchor={vLabel.anchor} color={C_EK} weight={720} size={0.9}>
            {vText}
          </Txt>
        )}

        {/* h₀ ved starten av linja (eller der den synlige delen begynner) */}
        <Txt x={X(xLabel)} y={yLabel} anchor="start" size={0.92} weight={700}>
          {mu > 0 && xLabel > 6 ? (
            <>
              h<TSub>0</TSub> − μs
            </>
          ) : (
            <>
              h<TSub>0</TSub> = {fmt(h0, 1)} m
            </>
          )}
        </Txt>
      </g>
    </g>
  );
}

/** Vendepunktet (v = 0) og mållinje for hvor mye som mangler opp til toppen vogna ikke klarer. */
function TurnMarks({
  turn,
  failed,
  L,
  viewL,
  viewR,
  avoid,
}: {
  turn: TurnPoint;
  failed: PointResult;
  L: TrackLayout;
  viewL: number;
  viewR: number;
  /** Navnet på toppen (f.eks. «B 20 m»), som målpila ikke skal krysse. */
  avoid?: Box;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { X, Y } = L;
  // Energien rekker opp til vendepunktet; toppen ligger så mye høyere
  const level = turn.h;
  const missing = failed.h - turn.h;
  const text = `mangler ${fmt(missing, missing < 0.95 ? 2 : 1)} m`;
  const w = textWidth(text, 0.85, f);
  // Mållinja til høyre for toppen med teksten til høyre. Er det ikke plass, står teksten over toppen.
  // Står navnet på toppen i høyden til mållinja (på mobil er teksten større), flyttes mållinja forbi det.
  const xd0 = X(failed.x) + 22 + 10 * f;
  const yTop = Math.min(Y(failed.h), Y(level));
  const yBot = Math.max(Y(failed.h), Y(level));
  const blocked = avoid && avoid.x1 + 6 > xd0 - 6 && avoid.x0 < xd0 + 6 && avoid.y0 < yBot && avoid.y1 > yTop;
  const xd = avoid && blocked && avoid.x1 + 10 < viewR - 8 ? avoid.x1 + 10 : xd0;
  const beside = xd + 8 * f + w < viewR;
  const showDim = missing > 0.04;
  if (!showDim) return null;
  return (
    <g>
      <line x1={X(turn.x)} x2={xd + 8} y1={Y(level)} y2={Y(level)} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="2 4" opacity={0.8} />
      <line x1={X(failed.x)} x2={xd + 8} y1={Y(failed.h)} y2={Y(failed.h)} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray="2 4" opacity={0.8} />
      <Dimension x1={xd} y1={Y(failed.h)} x2={xd} y2={Y(level)} label={beside ? text : undefined} labelSize={0.85} />
      {!beside && (
        <Txt x={Math.min(viewR - w / 2, Math.max(viewL + w / 2, X(failed.x)))} y={Y(failed.h) - 14 * f} size={0.85} weight={650}>
          {text}
        </Txt>
      )}
    </g>
  );
}

/**
 * Plassering av fartsetiketten: første ledige av noen kandidater (like forbi spissen, over pila, under pila, ved siden
 * av spissen), innenfor figuren og ikke oppå vogna, pila, punktene A–D med navn, mållinja for E_k eller linja for hvor
 * høyt vogna kan komme.
 */
function placeSpeedLabel({
  a0,
  tip,
  up,
  text,
  f,
  ss,
  viewL,
  viewR,
  cartBox,
  lineY,
  toX,
  obstacles,
}: {
  a0: { x: number; y: number };
  tip: { x: number; y: number };
  /** Normalen ut fra banen (bort fra skinnene). */
  up: { x: number; y: number };
  text: string;
  f: number;
  ss: number;
  viewL: number;
  viewR: number;
  cartBox: Box;
  lineY: (x: number) => number | null;
  toX: (figX: number) => number;
  obstacles: Box[];
}): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const w = textWidth(text, 0.9, f);
  const len = Math.hypot(tip.x - a0.x, tip.y - a0.y) || 1;
  const ux = (tip.x - a0.x) / len;
  const uy = (tip.y - a0.y) / len;
  const seg = { x1: a0.x, y1: a0.y, x2: tip.x, y2: tip.y };
  const mid = { x: (a0.x + tip.x) / 2, y: (a0.y + tip.y) / 2 };
  const side = up.x >= 0 ? 1 : -1;
  type Cand = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  const cands: Cand[] = [
    // Like forbi spissen
    Math.abs(uy) > 0.6
      ? { x: tip.x + side * 10 * f, y: tip.y + (uy > 0 ? -2 : 12) * f, anchor: side > 0 ? 'start' : 'end' }
      : { x: tip.x + ux * 10 * f, y: tip.y + uy * 14 * f + 6 * f, anchor: ux >= 0 ? 'start' : 'end' },
    // Over pila (ut fra banen) og under pila
    { x: mid.x + up.x * 20 * f, y: mid.y + up.y * 20 * f - 2 * f, anchor: 'middle' },
    { x: mid.x - up.x * 20 * f, y: mid.y - up.y * 20 * f + 14 * f, anchor: 'middle' },
    { x: mid.x + up.x * 38 * f, y: mid.y + up.y * 38 * f - 2 * f, anchor: 'middle' },
    // Vannrett ved siden av pila, midt på
    { x: Math.min(a0.x, tip.x) - 12 * f, y: mid.y + 6 * f, anchor: 'end' },
    { x: Math.max(a0.x, tip.x) + 12 * f, y: mid.y + 6 * f, anchor: 'start' },
    // Ved siden av spissen, på begge sider, nær og lenger unna
    { x: tip.x + 10 * f, y: tip.y - 14 * f, anchor: 'start' },
    { x: tip.x - 10 * f, y: tip.y - 14 * f, anchor: 'end' },
    { x: tip.x + 18 * f, y: tip.y + 4 * f, anchor: 'start' },
    { x: tip.x - 18 * f, y: tip.y + 4 * f, anchor: 'end' },
    { x: tip.x + 14 * f, y: tip.y - 30 * f, anchor: 'start' },
    { x: tip.x - 14 * f, y: tip.y - 30 * f, anchor: 'end' },
    // Over vogna
    { x: (cartBox.x0 + cartBox.x1) / 2, y: cartBox.y0 - 6 * f, anchor: 'middle' },
  ];
  // Hvor mye kandidaten kolliderer (0 = ledig): punktene og vogna teller mest, så pila, så linja
  const cost = (c: Cand) => {
    const b = textBox(c.x, c.y, w, c.anchor, 0.9, f);
    if (b.x0 < viewL || b.x1 > viewR || b.y0 < 0) return Infinity;
    let k = 0;
    if (boxesOverlap(b, cartBox)) k += 4;
    k += 4 * obstacles.filter((o) => boxesOverlap(b, o)).length;
    if (arrowHitsBox(seg, b, 5, ss)) k += 2;
    // Linja for hvor høyt vogna kan komme skal helst ikke gå gjennom teksten
    for (const px of [b.x0 + 4, (b.x0 + b.x1) / 2, b.x1 - 4]) {
      const ly = lineY(toX(px));
      if (ly !== null && ly > b.y0 + 2 && ly < b.y1 - 2) {
        k += 1;
        break;
      }
    }
    return k;
  };
  let best: Cand | null = null;
  let bestCost = Infinity;
  for (const c of cands) {
    const k = cost(c);
    if (k < bestCost) {
      best = c;
      bestCost = k;
    }
    if (k === 0) break;
  }
  if (best) return best;
  return { x: Math.min(viewR - w / 2, Math.max(viewL + w / 2, mid.x)), y: Math.min(cartBox.y0 - 4, tip.y - 12 * f), anchor: 'middle' };
}

/* ---------- Energistolper og fart langs banen ---------- */

function EnergyAndSpeed({
  coaster,
  ride,
  results,
  turn,
  state,
  place,
  t,
  mu,
  narrow,
}: {
  coaster: Coaster;
  ride: Ride;
  results: PointResult[];
  turn: TurnPoint | null;
  state: CartState;
  place: Spot;
  t: number;
  mu: number;
  narrow: boolean;
}) {
  if (narrow)
    return (
      <g>
        <EnergyBars e={state.e} width={W} height={400} />
        <g transform="translate(0 400)">
          <SpeedPlot coaster={coaster} ride={ride} results={results} turn={turn} state={state} place={place} t={t} mu={mu} width={W} height={450} />
        </g>
      </g>
    );
  return (
    <g>
      <EnergyBars e={state.e} width={290} height={330} />
      <g transform="translate(300 0)">
        <SpeedPlot coaster={coaster} ride={ride} results={results} turn={turn} state={state} place={place} t={t} mu={mu} width={W - 300} height={330} />
      </g>
    </g>
  );
}

/** Fast akse (kJ), så stolpene vokser med starthøyden og massen. */
const E_AXIS_MAX = 300;

function EnergyBars({ e, width, height }: { e: EnergyState; width: number; height: number }) {
  const f = useTextScale();
  const kJ = (J: number) => J / 1000;
  const bars: { key: string; label: ReactNode; value: number; color: string; stack?: boolean }[] = [
    {
      key: 'p',
      label: (
        <>
          E<TSub>p</TSub>
        </>
      ),
      value: e.Ep,
      color: C_EP,
    },
    {
      key: 'k',
      label: (
        <>
          E<TSub>k</TSub>
        </>
      ),
      value: Math.max(0, e.Ek),
      color: C_EK,
    },
    { key: 'e', label: 'E', value: e.Ep + Math.max(0, e.Ek), color: VIZ.ink, stack: true },
    {
      key: 'r',
      label: (
        <>
          −W<TSub>R</TSub>
        </>
      ),
      value: e.heat,
      color: C_HEAT,
    },
  ];
  return (
    <Plot
      x={{ min: 0, max: bars.length, label: '', ticks: [] }}
      y={{ min: 0, max: E_AXIS_MAX, label: 'Energi (kJ)' }}
      width={width}
      height={height}
      margin={{ top: 40 * f, right: 40 * f, bottom: 40 * f, left: 66 * f }}
      grid
    >
      {({ sx, sy, x0, x1, y0 }) => {
        const slot = sx(1) - sx(0);
        const bw = Math.min(54, slot * 0.58);
        const yE0 = sy(kJ(e.E0));
        return (
          <g>
            <line x1={x0} x2={x1} y1={yE0} y2={yE0} stroke={VIZ.ink} strokeWidth={1.5} strokeDasharray="6 5" />
            {bars.map((b, i) => {
              const cx = sx(i + 0.5);
              const top = sy(kJ(b.value));
              return (
                <g key={b.key}>
                  {b.stack ? (
                    <>
                      <rect x={cx - bw / 2} y={sy(kJ(e.Ep))} width={bw} height={Math.max(0, y0 - sy(kJ(e.Ep)))} fill={C_EP} opacity={0.88} />
                      <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, sy(kJ(e.Ep)) - top)} fill={C_EK} opacity={0.88} />
                      <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, y0 - top)} fill="none" stroke={VIZ.ink} strokeWidth={2} />
                    </>
                  ) : (
                    <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, y0 - top)} fill={b.color} opacity={0.88} rx={1.5} />
                  )}
                  <Txt x={cx} y={top - 7 * f} size={0.74} weight={650} color={b.stack ? VIZ.ink : b.color}>
                    {fmt(kJ(b.value), 1)}
                  </Txt>
                  <Txt x={cx} y={y0 + 24 * f} size={0.95} weight={700} color={b.color}>
                    {b.label}
                  </Txt>
                </g>
              );
            })}
            <Txt x={x1 + 4} y={yE0 + 5 * f} anchor="start" size={0.8} weight={700}>
              E<TSub>0</TSub>
            </Txt>
          </g>
        );
      }}
    </Plot>
  );
}

const V_AXIS_MAX = 30;

function SpeedPlot({
  coaster,
  ride,
  results,
  turn,
  state,
  place,
  t,
  mu,
  width,
  height,
}: {
  coaster: Coaster;
  ride: Ride;
  results: PointResult[];
  turn: TurnPoint | null;
  state: CartState;
  place: Spot;
  t: number;
  mu: number;
  width: number;
  height: number;
}) {
  const f = useTextScale();
  const g = G_EARTH;
  // Farten på første tur fram fra energibevaring, og uten friksjon til sammenligning
  const { main, ref } = useMemo(() => {
    const forward = (muX: number, end: number): [number, number][] => {
      const speed = (x: number) => Math.sqrt(Math.max(0, 2 * g * (reachHeight(coaster, x, muX) - coaster.height(x))));
      const pts: [number, number][] = [];
      for (let x = 0; x < end; x += 0.25) pts.push([x, speed(x)]);
      pts.push([end, speed(end)]);
      return pts;
    };
    const turn0 = mu > 0 ? turningPoint(coaster, 0) : null;
    return { main: forward(mu, turn ? turn.x : coaster.xEnd), ref: mu > 0 ? forward(0, turn0 ? turn0.x : coaster.xEnd) : null };
  }, [coaster, mu, turn, g]);
  // Etter første vendepunkt: resten av turen fra simuleringen (fram og tilbake)
  // Etiketten på kurven uten friksjon: på toppen av den mellom B og C (der den ligger over den andre kurven), ellers ved A
  const refTop = ref?.filter(([x]) => x > 60 && x < 80).sort((a, b) => b[1] - a[1])[0];
  // Snur den før B, står etiketten til høyre for kurven der den faller mot vendepunktet (ikke til venstre, der
  // aksetittelen er)
  const refMax = ref ? Math.max(...ref.map(([, v]) => v)) : 0;
  const refFall = ref?.find(([x, v]) => x > 25 && v < 0.6 * refMax);
  const refLabel = refTop
    ? { x: refTop[0], v: refTop[1], anchor: 'middle' as const, dx: 0, dy: -10 }
    : refFall
      ? { x: refFall[0], v: refFall[1], anchor: 'start' as const, dx: 8, dy: 0 }
      : undefined;
  const turnT = ride.turnTime;
  const rest = turnT !== null ? ride.samples.filter((s) => s.t >= turnT) : [];
  const after = rest.map((s): [number, number] => [s.x, Math.abs(s.v)]);
  const afterSoFar = place === 'fri' ? rest.filter((s) => s.t <= t).map((s): [number, number] => [s.x, Math.abs(s.v)]) : [];

  return (
    <Plot
      x={{ min: 0, max: 110, label: 'Vannrett posisjon x (m)' }}
      y={{ min: 0, max: V_AXIS_MAX, label: 'Fart v (m/s)' }}
      width={width}
      height={height}
      margin={{ top: 40 * f, right: 20 * f, bottom: 56 * f, left: 64 * f }}
    >
      {({ sx, sy, y0, x1, y1 }) => (
        <g>
          {ref && <path d={linePath(ref, sx, sy)} fill="none" stroke={C_EK} strokeWidth={2} strokeDasharray="6 5" opacity={0.55} />}
          {after.length > 1 && <path d={linePath(after, sx, sy)} fill="none" stroke={C_EK} strokeWidth={1.4} opacity={0.35} />}
          {/* Forklaring til de svake buene: resten av turen, fram og tilbake i dalen etter vendepunktet (uten friksjon
              ligger buene oppå kurven for første tur, så da trengs den ikke) */}
          {after.length > 1 && mu > 0 && (
            <g>
              <line x1={x1 - 8 - 26 * f} x2={x1 - 8} y1={y1 + 12 * f} y2={y1 + 12 * f} stroke={C_EK} strokeWidth={1.6} opacity={0.45} />
              <Txt x={x1 - 14 - 26 * f} y={y1 + 17 * f} anchor="end" size={0.72} color={C_EK}>
                fram og tilbake etter vendepunktet
              </Txt>
            </g>
          )}
          {afterSoFar.length > 1 && <path d={linePath(afterSoFar, sx, sy)} fill="none" stroke={C_EK} strokeWidth={2} opacity={0.7} />}
          <path d={linePath(main, sx, sy)} fill="none" stroke={C_EK} strokeWidth={3.2} />
          {refLabel && (
            <Txt x={sx(refLabel.x) + refLabel.dx * f} y={sy(refLabel.v) + refLabel.dy * f} anchor={refLabel.anchor} size={0.74} color={C_EK}>
              uten friksjon
            </Txt>
          )}
          {results.map((p) =>
            p.v === null ? (
              <Txt key={p.id} x={sx(p.x)} y={y0 - 8 * f} size={0.82} weight={700} muted>
                {p.id}
              </Txt>
            ) : (
              <g key={p.id}>
                <circle cx={sx(p.x)} cy={sy(p.v)} r={4.5} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.6} />
                <Txt x={sx(p.x)} y={sy(p.v) - 12 * f} size={0.86} weight={700}>
                  {p.id}
                </Txt>
              </g>
            ),
          )}
          {turn && (
            <Txt x={sx(turn.x) + 10 * f} y={y0 - 28 * f} anchor="start" size={0.76} weight={650} color={C_EK}>
              snur
            </Txt>
          )}
          <circle cx={sx(state.x)} cy={sy(state.e.v)} r={7.5} fill={C_EK} stroke={VIZ.surface} strokeWidth={2.5} />
        </g>
      )}
    </Plot>
  );
}

/* ---------- Utregning ---------- */

function EnergyFormula({
  coaster,
  state,
  place,
  results,
  m,
  mu,
}: {
  coaster: Coaster;
  state: CartState;
  place: Spot;
  results: PointResult[];
  m: number;
  mu: number;
}) {
  const h0 = coaster.h0;
  const p = place !== 'fri' && place !== 'S' ? results.find((r) => r.id === place)! : null;
  // I et punkt regner vi for punktet (også når vogna ikke kommer dit), ellers for vogna der den er nå.
  const h = p ? p.h : state.h;
  const s = p ? p.s : state.d;
  const e = p ? energyState({ m, h0, h: p.h, s: p.s, mu }) : state.e;
  const where = p ? (
    <>
      Fra start til {p.id} ({fmt(p.h, 1)}&nbsp;m over nullnivået, {fmt(s, 1)}&nbsp;m langs banen):
    </>
  ) : place === 'S' ? (
    <>I startpunktet står vogna i ro:</>
  ) : (
    <>
      Vogna nå ({fmt(h, 1)}&nbsp;m over nullnivået, {fmt(s, 1)}&nbsp;m kjørt langs banen):
    </>
  );
  const name = p ? p.id : '';
  const kJ = (J: number) => fmt(J / 1000, 1);
  return (
    <Formula label="Energiregnskapet">
      <FormulaLine>{where}</FormulaLine>
      <FormulaLine>
        E<Sub>0</Sub> = mgh<Sub>0</Sub> = {fmt(m, 0)}&nbsp;kg · 9,81&nbsp;m/s² · {fmt(h0, 1)}&nbsp;m = {kJ(e.E0)}&nbsp;kJ
      </FormulaLine>
      {place !== 'S' && (
        <>
          <FormulaLine>
            E<Sub>p</Sub> = mgh{name && <Sub>{name}</Sub>} = {fmt(m, 0)}&nbsp;kg · 9,81&nbsp;m/s² · {fmt(h, p ? 1 : 2)}&nbsp;m = {kJ(e.Ep)}&nbsp;kJ
          </FormulaLine>
          {mu > 0 && (
            <FormulaLine>
              −W<Sub>R</Sub> = R · s = {fmt(e.R, 0)}&nbsp;N · {fmt(s, 1)}&nbsp;m = {kJ(e.heat)}&nbsp;kJ
            </FormulaLine>
          )}
          <FormulaLine>
            E<Sub>k</Sub> = E<Sub>0</Sub> − E<Sub>p</Sub>
            {mu > 0 && <> − R · s</>} = {kJ(e.Ek)}&nbsp;kJ
            {e.Ek < -1 && <> &lt; 0</>}
          </FormulaLine>
          {e.Ek > 0 ? (
            <FormulaLine>
              v = √(2E<Sub>k</Sub> / m) = √(2 · {fmt(e.Ek, 0)}&nbsp;J / {fmt(m, 0)}&nbsp;kg) = {fmt(e.v, 2)}&nbsp;m/s
            </FormulaLine>
          ) : (
            <FormulaLine>
              {e.Ek < -1 ? (
                <>
                  E<Sub>k</Sub> kan ikke være negativ, så vogna kommer aldri til {name || 'dette punktet'}.
                </>
              ) : (
                <>v = 0: vogna står i ro akkurat her.</>
              )}
            </FormulaLine>
          )}
        </>
      )}
      {place === 'S' && (
        <FormulaLine>
          E<Sub>k</Sub> = 0 og E = E<Sub>p</Sub> = E<Sub>0</Sub>
        </FormulaLine>
      )}
    </Formula>
  );
}

/* ---------- Forklaring ---------- */

function ExplainText({
  coaster,
  results,
  turn,
  state,
  place,
  ride,
  t,
  m,
  mu,
  minH,
}: {
  coaster: Coaster;
  results: PointResult[];
  turn: TurnPoint | null;
  state: CartState;
  place: Spot;
  ride: Ride;
  t: number;
  m: number;
  mu: number;
  minH: { none: number; mu: number };
}) {
  const h0 = coaster.h0;
  const B = getPoint(coaster, 'B');
  const failed = results.find((p) => p.top && p.v === null);
  const friction = mu > 0;
  const D = results.find((p) => p.id === 'D')!;

  // 1. Kommer vogna over?
  let status: ReactNode;
  if (!turn) {
    const marginB = reachHeight(coaster, B.x, mu) - B.h;
    status = (
      <>
        <strong>Vogna kommer over alle toppene og fram til bremsene i D.</strong>{' '}
        {friction ? (
          <>
            Friksjonen gjør negativt arbeid hele veien, W<Sub>R</Sub> = −R · s, så linja for hvor høyt vogna kan komme synker jo lenger den
            kjører. Ved B ligger linja {fmt(marginB, 1)}&nbsp;m over toppen.
          </>
        ) : (
          <>
            Uten friksjon er den mekaniske energien bevart, så vogna kan komme like høyt som den startet ({fmt(h0, 1)}&nbsp;m) hele veien. Den
            kommer over en topp så lenge toppen er lavere: linja ligger {fmt(marginB, 1)}&nbsp;m over B.
          </>
        )}
        {marginB < 1 && <> Det er lite: på toppen av B har vogna bare {fmt(results.find((p) => p.id === 'B')?.v ?? 0, 1)}&nbsp;m/s.</>}
      </>
    );
  } else {
    const name = failed?.id ?? 'B';
    status = friction ? (
      <>
        <strong>Vogna kommer ikke over {name}.</strong> Den startet {fmt(h0, 1)}&nbsp;m over nullnivået, men på veien har friksjonen tatt{' '}
        {fmt(mu * turn.s, 1)}&nbsp;m av høyden energien rekker til. Vogna snur {fmt(turn.h, 1)}&nbsp;m over nullnivået, triller fram og tilbake og blir
        til slutt stående i dalen ved A. Da er nesten all den mekaniske energien blitt termisk energi.
      </>
    ) : (
      <>
        <strong>Vogna kommer ikke over {name}.</strong>{' '}
        {Math.abs(h0 - (failed?.h ?? B.h)) < 1e-9 ? (
          <>
            Starthøyden er nøyaktig like høy som toppen, så vogna stopper akkurat på toppen (i teorien). Den trenger litt fart for å komme
            over, og da må den starte høyere.
          </>
        ) : (
          <>
            Toppen er {fmt(failed?.h ?? B.h, 1)}&nbsp;m høy, men vogna kan aldri komme høyere enn den startet ({fmt(h0, 1)}&nbsp;m). Den snur i{' '}
            {fmt(turn.h, 1)}&nbsp;m høyde og triller tilbake. Uten friksjon pendler den for alltid mellom startpunktet og vendepunktet i
            bakken opp mot {name}, begge i {fmt(h0, 1)}&nbsp;m høyde.
          </>
        )}
      </>
    );
  }

  // 2. Hva skjer der vogna er nå
  const e = state.e;
  let now: ReactNode = null;
  const k = coaster.slope(state.x) * state.dir;
  const stopped = place === 'fri' && ride.stopTime !== null && t >= ride.stopTime;
  if (place === 'S')
    now = (
      <>
        I startpunktet står vogna i ro, så all energien er potensiell: E<Sub>0</Sub> = mgh<Sub>0</Sub> = {fmt(e.E0 / 1000, 1)}&nbsp;kJ.
      </>
    );
  else if (stopped)
    now = (
      <>
        Vogna står stille i dalen. All energien den startet med, {fmt(e.E0 / 1000, 1)}&nbsp;kJ, er nå potensiell energi og termisk energi i hjulene,
        skinnene og lufta.
      </>
    );
  else if (e.v < 0.05)
    now = <>I vendepunktet er farten null et øyeblikk: E<Sub>k</Sub> = 0, og E = E<Sub>p</Sub>.</>;
  else if (place === 'A' || (place === 'fri' && Math.abs(state.x - getPoint(coaster, 'A').x) < 0.6))
    now = (
      <>
        I A er vogna i det laveste punktet, så E<Sub>p</Sub> = 0 og farten er størst: {fmt(e.v, 1)}&nbsp;m/s ({fmt(e.v * 3.6, 0)}&nbsp;km/h). All den
        mekaniske energien er kinetisk.
      </>
    );
  else if (place === 'D' || (place === 'fri' && state.x >= coaster.xEnd - 0.01))
    now = (
      <>
        I D kjører vogna inn i bremsene med {fmt(D.v ?? e.v, 1)}&nbsp;m/s. Bremsene må gjøre arbeidet W = −½mv² = −{fmt(Math.max(0, e.Ek) / 1000, 1)}&nbsp;kJ
        for å stoppe den.
      </>
    );
  else if (place === 'B' || place === 'C')
    now = (
      <>
        På toppen av {place} er farten minst i denne delen av banen, men den er ikke null: vogna har fortsatt E<Sub>k</Sub> ={' '}
        {fmt(e.Ek / 1000, 1)}&nbsp;kJ. Det er nettopp den som får vogna over.
      </>
    );
  else
    now =
      k < 0 ? (
        <>
          På vei ned blir E<Sub>p</Sub> til E<Sub>k</Sub>, og farten øker (nå {fmt(e.v, 1)}&nbsp;m/s).
        </>
      ) : (
        <>
          På vei opp blir E<Sub>k</Sub> til E<Sub>p</Sub>, og farten avtar (nå {fmt(e.v, 1)}&nbsp;m/s).
        </>
      );

  // 3. Hvorfor må første topp være høyest, og massen
  const need = friction ? minH.mu : minH.none;
  return (
    <>
      <p>{status}</p>
      <p>{now}</p>
      <p>
        <strong>Hvorfor må første topp være høyest?</strong> Etter heisebakken er det ingen motor som gir vogna mer energi. Normalkraften fra
        skinnene står vinkelrett på bevegelsen og gjør ikke arbeid, tyngden flytter bare energi mellom E<Sub>p</Sub> og E<Sub>k</Sub>, og
        friksjonen tar bare energi bort. Derfor kan ingen senere topp være like høy som
        startpunktet{friction ? ', og med friksjon må toppene være enda lavere' : ''}. Her må h<Sub>0</Sub> være over {fmt(need, 1)}&nbsp;m
        {friction ? <> (uten friksjon holder {fmt(minH.none, 1)}&nbsp;m)</> : <> (med friksjon minst {fmt(minH.mu, 1)}&nbsp;m)</>}.
      </p>
      <p>
        Flere passasjerer gir mer energi i alle stolpene (nå m = {fmt(m, 0)} kg), men ikke mer fart: m står i både E<Sub>p</Sub> = mgh og E
        <Sub>k</Sub> = ½mv², og forkortes bort.
        {friction && (
          <>
            {' '}
            Det gjelder fordi vi har regnet friksjonen proporsjonal med tyngden. Luftmotstanden er ikke det, så i virkeligheten triller en full
            vogn litt fortere enn en tom.
          </>
        )}
      </p>
    </>
  );
}

