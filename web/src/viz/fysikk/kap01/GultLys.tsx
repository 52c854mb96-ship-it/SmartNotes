import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  BIL_MAAL,
  Bil,
  Dimension,
  ForceArrow,
  Himmel,
  Landskap,
  Person,
  SpeedLines,
  ValueTag,
  Vei,
  alpha,
  hjulvinkelFraStrekning,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { Veikant } from './bremselengde-deler';
import { DilemmaGraph, ZONE_COLOR } from './gult-lys-graf';
import { BilLupe, Kryss, Stopplinje, Trafikklys, bilLupeSize } from './gult-lys-deler';
import {
  BRAKE,
  CAR_LENGTH,
  CLEAR_DISTANCE,
  KRYSS,
  SLIDERS,
  dilemmaLength,
  goOutcome,
  kmhToMs,
  minGoSpeed,
  msToKmh,
  noDilemmaSpeeds,
  planAcceleration,
  planEndTime,
  planPosition,
  planVelocity,
  reactionDistance,
  brakingDistance,
  requiredDeceleration,
  sceneRange,
  situation,
  stopOutcome,
  yellowDistance,
  yellowNeeded,
  zones,
  type GoOutcome,
  type Plan,
  type Situation,
  type StopOutcome,
  type YellowInput,
  type Zones,
} from './model-gult-lys';
import { useNarrow } from './useNarrow';

const SIT_TEXT: Record<Situation, string> = {
  stopp: 'Må stoppe',
  kjor: 'Må kjøre',
  dilemma: 'Dilemma',
  begge: 'Begge går',
};

const m1 = (v: number) => `${fmt(v, 1)} m`;
const clearTxt = m1(CLEAR_DISTANCE);

export default function GultLys() {
  const [kmh, setKmh] = useState(50);
  const [D, setD] = useState(35);
  const [tr, setTr] = useState(1.0);
  const [a, setA] = useState<number>(BRAKE.rolig);
  const [tg, setTg] = useState(3.0);
  const [plan, setPlan] = useState<Plan>('bremse');
  const { ref, narrow } = useNarrow();

  const input: YellowInput = { v0: kmhToMs(kmh), tr, a, tg };
  const z = zones(input);
  const sit = situation(input, D);
  const so = stopOutcome(input, D);
  const go = goOutcome(input, D);
  const clock = useSimClock({ tMax: planEndTime(input, D, plan) });
  const t = clock.t;
  const need = requiredDeceleration(input, D);

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Fart v<Sub>0</Sub>
            </>
          }
          ariaLabel="Fart"
          value={kmh}
          onChange={setKmh}
          min={SLIDERS.kmh.min}
          max={SLIDERS.kmh.max}
          step={SLIDERS.kmh.step}
          unit="km/h"
          decimals={0}
        />
        <Slider
          label="Avstand til stopplinja D"
          value={D}
          onChange={setD}
          min={SLIDERS.D.min}
          max={SLIDERS.D.max}
          step={SLIDERS.D.step}
          unit="m"
          decimals={0}
        />
        <Slider
          label={
            <>
              Reaksjonstid t<Sub>r</Sub>
            </>
          }
          ariaLabel="Reaksjonstid"
          value={tr}
          onChange={setTr}
          min={0.5}
          max={2}
          step={0.1}
          unit="s"
          decimals={1}
        />
        <Slider label="Bremseakselerasjon a" value={a} onChange={setA} min={1} max={8} step={0.5} unit="m/s²" decimals={1} />
        <Slider
          label={
            <>
              Gultid t<Sub>g</Sub>
            </>
          }
          ariaLabel="Gultid"
          value={tg}
          onChange={setTg}
          min={2}
          max={6}
          step={0.5}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <Segmented<Plan>
          label="Hva sjåføren gjør"
          options={[
            { value: 'bremse', label: 'Sjåføren bremser' },
            { value: 'kjore', label: 'Sjåføren kjører videre' },
          ]}
          value={plan}
          onChange={(p) => {
            setPlan(p);
            clock.reset();
          }}
        />
      </Toolbar>
      <Toolbar>
        <PlayControls clock={clock} />
      </Toolbar>

      <Scene input={input} kmh={kmh} D={D} z={z} plan={plan} t={t} so={so} go={go} />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 560 : 340}`}
          label={`Graf over avstanden til stopplinja mot farten. Over den blå kurven kan bilen stoppe, under den grønne linja rekker den over krysset, og mellom dem er dilemmasonen. Bilen din er ${fmt(D, 0)} m unna i ${fmt(kmh, 0)} km/h: ${SIT_TEXT[sit].toLowerCase()}.`}
          maxHeight={narrow ? 600 : 380}
          caption="Klikk i grafen (eller dra med musa) for å velge fart og avstand."
        >
          <DilemmaGraph
            input={input}
            kmh={kmh}
            D={D}
            height={narrow ? 560 : 340}
            onPick={(k, d) => {
              setKmh(k);
              setD(d);
            }}
          />
        </Figure>
      </div>
      <Legend
        items={[
          { color: ZONE_COLOR.stopp, label: 'Kan stoppe før stopplinja' },
          { color: ZONE_COLOR.kjor, label: 'Rekker helt over krysset før rødt' },
          { color: ZONE_COLOR.dilemma, label: 'Dilemmasone: ingen av delene går' },
          { color: ZONE_COLOR.begge, label: 'Begge deler går' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Kan stoppe når D ≥ s<Sub>r</Sub> + s<Sub>b</Sub>
            </>
          }
          value={fmt(z.dStop, 1)}
          unit="m"
          tone={ZONE_COLOR.stopp}
        />
        <Readout label="Rekker over når D ≤" value={z.dGo >= 0 ? fmt(z.dGo, 1) : 'Aldri'} unit={z.dGo >= 0 ? 'm' : undefined} tone={ZONE_COLOR.kjor} />
        <Readout label={`Med D = ${fmt(D, 0)} m`} value={SIT_TEXT[sit]} tone={ZONE_COLOR[sit]} />
        <Readout
          label="Bremsing som trengs for å stoppe ved linja"
          value={Number.isFinite(need) ? fmt(need, 1) : 'Umulig'}
          unit={Number.isFinite(need) ? 'm/s²' : undefined}
          tone={VIZ.acceleration}
        />
      </Readouts>

      <Formula label="Utregning av stopplengden, strekningen på gultiden og dilemmasonen">
        <FormulaLine>
          v<Sub>0</Sub> = {fmt(kmh, 0)} km/h : 3,6 = {fmt(input.v0, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          Stoppe: s<Sub>r</Sub> = v<Sub>0</Sub>t<Sub>r</Sub> = {fmt(input.v0, 1)} m/s · {fmt(tr, 1)} s = {m1(reactionDistance(input))}
        </FormulaLine>
        <FormulaLine>
          s<Sub>b</Sub> = v<Sub>0</Sub>² / (2a) = ({fmt(input.v0, 1)} m/s)² / (2 · {fmt(a, 1)} m/s²) = {m1(brakingDistance(input))}, så s<Sub>r</Sub> + s
          <Sub>b</Sub> = {m1(z.dStop)}
        </FormulaLine>
        <FormulaLine>
          Kjøre: på gultiden kjører bilen v<Sub>0</Sub>t<Sub>g</Sub> = {fmt(input.v0, 1)} m/s · {fmt(tg, 1)} s = {m1(yellowDistance(input))}
        </FormulaLine>
        <FormulaLine>
          Den må kjøre D + {fmt(KRYSS.bredde, 0)} m + {fmt(CAR_LENGTH, 1)} m (krysset og bilen), så den rekker over når D ≤ {m1(yellowDistance(input))} − {clearTxt} ={' '}
          {m1(z.dGo)}
        </FormulaLine>
        <FormulaLine>{conclusion(input, D, z)}</FormulaLine>
        <FormulaLine>
          Ingen dilemmasone: t<Sub>g</Sub> ≥ t<Sub>r</Sub> + v<Sub>0</Sub> / (2a) + {clearTxt} / v<Sub>0</Sub> = {fmt(tr, 1)} s + {fmt(input.v0 / (2 * a), 1)} s +{' '}
          {fmt(CLEAR_DISTANCE / input.v0, 1)} s = {fmt(yellowNeeded(input), 1)} s
        </FormulaLine>
      </Formula>

      <Explain>{explanation(input, kmh, D, z, sit, so, go, plan)}</Explain>
    </VizLayout>
  );
}

/** «Med D = 35 m: 35 m < 46,0 m (kan ikke stoppe) og 35 m > 22,3 m (rekker ikke over): dilemmasonen». */
function conclusion(input: YellowInput, D: number, z: Zones): ReactNode {
  const s = situation(input, D);
  const d = `${fmt(D, 0)} m`;
  const stopPart = D >= z.dStop ? `${d} ≥ ${m1(z.dStop)} (kan stoppe)` : `${d} < ${m1(z.dStop)} (kan ikke stoppe)`;
  const goPart = D <= z.dGo ? `${d} ≤ ${m1(z.dGo)} (rekker over)` : `${d} > ${m1(z.dGo)} (rekker ikke over)`;
  const tail = { dilemma: ': dilemmasonen', begge: ': begge går', stopp: ': stopp', kjor: ': kjør videre' }[s];
  return (
    <>
      Med D = {d}: {stopPart} og {goPart}
      {tail}
    </>
  );
}

/* ---------- Scenen: lyskrysset sett fra siden ---------- */

const W = 800;
const PAD = 12;
/** Lakken på bilen: hvit synes på alle sonefargene (en rød bil forsvinner i den oransje dilemmasonen). */
const CAR_PAINT = 'hvit';

/**
 * Tekstskaleringen figuren vil få (samme regel som i <Figure>), målt på beholderen før figuren tegnes, og hvor
 * mange skjermpiksler én figurenhet blir (til å avgjøre om bilen er for liten til å synes).
 */
function useContainerTextScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ f: 1, unitPx: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        const f = Math.round(Math.max(1, 12.5 / 17 / (w / W)) * 20) / 20;
        const unitPx = Math.round((w / W) * 100) / 100;
        setM((old) => (old.f === f && old.unitPx === unitPx ? old : { f, unitPx }));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, f: m.f, unitPx: m.unitPx };
}

/** Bilen tegnes høyst så mange ganger for stor i scenen (sentrert om den ekte midten, så fronten er høyst 0,9 m feil). */
const carScale = (f: number) => Math.min(Math.max(1, f * 0.85), 1.4);
/** Er bilen kortere enn dette på skjermen (CSS-piksler), vises den også forstørret i et innfelt utsnitt (BilLupe). */
const LUPE_MIN_PX = 40;
/** Lengden på bilen i utsnittet (CSS-piksler). */
const LUPE_PX = 56;

/** Lengden på bilen i det innfelte utsnittet (figurenheter), eller 0 når bilen i scenen er stor nok. */
function lupeCarLength(p: number, f: number, unitPx: number): number {
  const onScreen = BIL_MAAL.lengde * p * carScale(f) * unitPx;
  return onScreen < LUPE_MIN_PX && unitPx > 0 ? LUPE_PX / unitPx : 0;
}

/**
 * Plassen i scenen, regnet ut fra tekstskaleringen f og skalaen p (figurenheter per meter). Øverst står
 * signalhodet, under det skiltet med farten over bilen, så veien med fortau, og under veien tre rader: navnene på
 * sonene (og krysset), avstanden D og strekningen bilen kjører i valget.
 */
function sceneLayout(f: number, p: number, lupe: number) {
  const k = Math.max(1, f * 0.85);
  const ss = Math.max(1, f * 0.75);
  const headTop = 8;
  const headH = 48 * k;
  // Skiltet med farten, eller det innfelte utsnittet med bilen forstørret når bilen er for liten (lupe > 0)
  const lupeInset = 4 * ss;
  const lupeGap = 10 * f;
  const tagH = lupe > 0 ? bilLupeSize(lupe, 0, lupeInset, lupeGap).h : 17 * f * 0.9 * 1.55;
  const tagY = headTop + headH + 6 + tagH / 2;
  // Bilen tegnes litt større på mobil (som useSceneScale, men høyst 1,4), sentrert om den ekte midten, så
  // fronten og bakenden er høyst 0,9 m feil (et par skjermpiksler).
  const carK = carScale(f);
  const carH = BIL_MAAL.hoyde * p * carK;
  const roadY = tagY + tagH / 2 + 7 * ss + carH + 2;
  const B = 34 * k;
  const roadTop = roadY - 0.7 * B;
  const roadBot = roadY + 0.3 * B;
  const sidewalk = 0.3 * B;
  const horizon = roadTop - sidewalk - 0.75 * B;
  const laneTop = roadY - 0.2 * B;
  const laneBot = roadY + 0.19 * B;
  const zoneY = roadBot + sidewalk + 6 + 17 * 0.85 * f;
  const dY = zoneY + 10 * ss + 22 * f;
  const planY = dY + 12 * ss + 22 * f;
  const H = Math.round(planY + 9 * ss + 19 * f + 6);
  return { f, k, ss, headTop, headH, lupe, lupeInset, lupeGap, tagH, tagY, carK, carH, roadY, B, roadTop, roadBot, sidewalk, horizon, laneTop, laneBot, zoneY, dY, planY, H };
}

type SceneLayout = ReturnType<typeof sceneLayout>;

function Scene({
  input,
  kmh,
  D,
  z,
  plan,
  t,
  so,
  go,
}: {
  input: YellowInput;
  kmh: number;
  D: number;
  z: Zones;
  plan: Plan;
  t: number;
  so: StopOutcome;
  go: GoOutcome;
}) {
  const { ref, f, unitPx } = useContainerTextScale();
  const view = sceneRange(D, z);
  const p = (W - 2 * PAD) / (view.max - view.min);
  const L = sceneLayout(f, p, lupeCarLength(p, f, unitPx));
  const sit = situation(input, D);
  const label =
    `Lyskryss sett fra siden. Lyset har akkurat blitt gult, og en bil i ${fmt(kmh, 0)} km/h er ${fmt(D, 0)} m fra stopplinja. ` +
    `Stopplengden er ${m1(z.dStop)}, og på gultiden kjører bilen ${m1(yellowDistance(input))}. ` +
    `Situasjonen: ${SIT_TEXT[sit].toLowerCase()}. ` +
    (plan === 'bremse'
      ? so.place === 'foer'
        ? `Sjåføren bremser og stopper ${m1(so.margin)} før stopplinja.`
        : `Sjåføren bremser, men stopper ${m1(so.over)} etter stopplinja.`
      : go.status === 'over'
        ? 'Sjåføren kjører videre og er over krysset før rødt.'
        : go.status === 'i-krysset'
          ? 'Sjåføren kjører videre, men er fortsatt i krysset når lyset blir rødt.'
          : 'Sjåføren kjører videre, men når ikke stopplinja før lyset blir rødt.');
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 ${W} ${L.H}`}
        label={label}
        maxHeight={420}
        caption="Fargene i kjørefeltet viser hva sjåføren kan gjøre hvis fronten av bilen er der når lyset blir gult."
      >
        <Road L={L} view={view} p={p} input={input} D={D} z={z} plan={plan} t={t} so={so} go={go} />
      </Figure>
    </div>
  );
}

function Road({
  L,
  view,
  p,
  input,
  D,
  z,
  plan,
  t,
  so,
  go,
}: {
  L: SceneLayout;
  view: { min: number; max: number };
  p: number;
  input: YellowInput;
  D: number;
  z: Zones;
  plan: Plan;
  t: number;
  so: StopOutcome;
  go: GoOutcome;
}) {
  const f = useTextScale();
  const clip = useSvgId('gult-scene');
  const hatch = useSvgId('gult-sone');
  const X = (m: number) => PAD + (m - view.min) * p;
  const vpX = X((KRYSS.tverrvei.fra + KRYSS.tverrvei.til) / 2);
  const edge = W - 2;

  // Bilen ved tiden t: fronten er posisjonen s fra stopplinja.
  const s = planPosition(input, D, plan, t);
  const v = planVelocity(input, plan, t);
  const acc = planAcceleration(input, plan, t);
  const braking = plan === 'bremse' && t > input.tr && v > 0;
  const red = t >= input.tg - 1e-9;
  const q = p * L.carK;
  const carSize = BIL_MAAL.lengde * q;
  /** Ankerpunktet til Bil (midt mellom hjulene) når fronten er i s: bilen sentreres om sin ekte midte. */
  const carX = (front: number) => X(front - CAR_LENGTH / 2) - ((BIL_MAAL.foran - BIL_MAAL.bak) / 2) * q;
  const rearX = X(s - CAR_LENGTH / 2) - (BIL_MAAL.lengde / 2) * q;

  // Spøkelsesbilen: der bilen ender (bremse) eller er når lyset blir rødt (kjøre videre)
  const ghostS = plan === 'bremse' ? so.stopAt : go.atRed;
  const ghostDone = plan === 'bremse' ? t >= so.tStop - 1e-6 : t >= input.tg - 1e-6;
  const showGhost = !ghostDone && ghostS - s > CAR_LENGTH * 0.9 && X(ghostS - CAR_LENGTH) < edge;

  // Skiltet med farten over bilen, pila for v til høyre og pila for a til venstre (fast skala i px per m/s og m/s²)
  const tagText = v > 0.05 ? `${fmt(msToKmh(v), 0)} km/h` : 'Står stille';
  const fs = 17 * f * 0.9;
  const widthOf = (txt: string) => Math.max(fs * 1.6, txt.length * fs * 0.6 + 16 * f);
  const tagTexts = [`${fmt(msToKmh(input.v0), 0)} km/h`, 'Står stille'];
  // Med innfelt utsnitt er skiltet bredere: bilen forstørret og farten ved siden av
  const lupeW = bilLupeSize(L.lupe, Math.max(...tagTexts.map((txt) => txt.length * fs * 0.6)), L.lupeInset, L.lupeGap).w;
  const tagW = L.lupe > 0 ? lupeW : Math.max(...tagTexts.map(widthOf));
  const mid = X(s - CAR_LENGTH / 2);
  // Bilen har kjørt ut av bildet (bare når den kjører videre forbi krysset)
  const gone = rearX > W - 2;
  const tagX = Math.min(W - tagW / 2 - 6, Math.max(tagW / 2 + 6, mid));
  const pointer = Math.max(0, L.roadY - L.carH - 2 - (L.tagY + L.tagH / 2));
  const kk = Math.min(L.k, 1.15);
  const vx = tagX + tagW / 2 + 5;
  const ax = tagX - tagW / 2 - 5;
  const room = 26 * f;
  const vRoom = W - 4 - room - vx;
  const vLen = vRoom >= 18 ? Math.max(0, Math.min(v * 4 * kk, vRoom)) : 0;
  const aLen = acc < 0 ? Math.max(0, Math.min(-acc * 9 * kk, ax - 4 - room)) : 0;

  // Lyssignalet står bak veien ved stopplinja (venstre side for sjåføren), med nedtelling av gultiden
  const lightX = X(-0.6);
  const lightFoot = L.roadTop - L.sidewalk * 0.45;
  const lys = red ? 'rod' : 'gul';
  const tLeft = fmt(Math.max(0, input.tg - t), 1);
  const plateW = 0.33 * L.headH + 6;
  const tagWidth = (txt: string) => Math.max(fs * 1.6, txt.length * fs * 0.6 + 16 * f);
  const countOptions = red ? ['Rødt'] : [`Gult, ${tLeft} s igjen`, `Gult, ${tLeft} s`];
  let count = { text: countOptions[countOptions.length - 1]!, x: lightX + plateW, anchor: 'start' as 'start' | 'end' };
  for (const txt of countOptions) {
    if (lightX + plateW + tagWidth(txt) < W - 4) {
      count = { text: txt, x: lightX + plateW, anchor: 'start' };
      break;
    }
    if (lightX - plateW - tagWidth(txt) > 4) {
      count = { text: txt, x: lightX - plateW, anchor: 'end' };
      break;
    }
  }

  // Sonene i kjørefeltet foran stopplinja (m før linja → x)
  const goTop = Math.max(0, Math.min(z.dGo, z.dStop));
  const segs: { kind: Situation; from: number; to: number }[] = [];
  if (goTop > 0) segs.push({ kind: 'kjor', from: 0, to: goTop });
  if (z.dStop > Math.max(0, z.dGo)) segs.push({ kind: 'dilemma', from: Math.max(0, z.dGo), to: z.dStop });
  else if (z.dGo > z.dStop) segs.push({ kind: 'begge', from: z.dStop, to: z.dGo });
  segs.push({ kind: 'stopp', from: Math.max(z.dStop, z.dGo, 0), to: Infinity });
  const left = X(view.min);
  const visible = segs
    .map((sg) => ({ ...sg, x1: Math.max(left, X(-Math.min(sg.to, 1e6))), x2: Math.min(X(0), X(-sg.from)) }))
    .filter((sg) => sg.x2 - sg.x1 > 0.5);

  const charW = 17 * 0.85 * f * 0.6;
  const zoneNames: Record<Situation, [string, string]> = {
    stopp: ['Kan stoppe', 'Stopp'],
    kjor: ['Rekker over', 'Kjør'],
    dilemma: ['Dilemmasone', 'Dilemma'],
    begge: ['Begge går', 'Begge'],
  };

  // Strekningen bilen kjører i valget, målt fra startposisjonen til fronten
  const planEnd = plan === 'bremse' ? so.stopAt : go.atRed;
  const planColor = plan === 'bremse' ? ZONE_COLOR.stopp : ZONE_COLOR.kjor;
  // Det som mangler: hvor langt over linja bilen stopper, eller hvor langt bakenden er fra å være ute av krysset ved rødt
  const deficit =
    plan === 'bremse'
      ? so.over > 0.05
        ? { from: X(0), to: X(so.stopAt), texts: [`${m1(so.over)} over linja`, m1(so.over)] }
        : null
      : go.missing > 0.05
        ? { from: X(go.atRed - CAR_LENGTH), to: X(KRYSS.bredde), texts: [`mangler ${m1(go.missing)}`, m1(go.missing)] }
        : null;
  const charP = 17 * 0.9 * f * 0.58;
  const fits = (w: number, text: string) => w > text.length * charP + 14 * f;
  const planLabel = (w: number): ReactNode => {
    if (plan === 'bremse') {
      const val = m1(z.dStop);
      if (fits(w, `sr + sb = ${val}`))
        return (
          <>
            s<TSub>r</TSub> + s<TSub>b</TSub> = {val}
          </>
        );
      return fits(w, val) ? val : undefined;
    }
    const val = m1(yellowDistance(input));
    if (fits(w, `v0tg = ${val}`))
      return (
        <>
          v<TSub>0</TSub>t<TSub>g</TSub> = {val}
        </>
      );
    return fits(w, val) ? val : undefined;
  };

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={L.H} rx={4} />
        </clipPath>
        <pattern id={hatch} width={8 * L.ss} height={8 * L.ss} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1={0} y1={0} x2={0} y2={8 * L.ss} stroke={ZONE_COLOR.dilemma} strokeWidth={2.4 * L.ss} opacity={0.75} />
        </pattern>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Himmel w={W} h={L.horizon + 4} skyer={2} seed={6} sol={{ x: 96, y: Math.max(22, L.horizon * 0.42) }} />
        <Landskap x={0} y={L.horizon} w={W} h={Math.max(40 * L.k, L.horizon * 0.62)} type="by" seed={4} />
        <Vei x1={0} x2={W} y={L.roadY} bredde={L.B} type="asfalt" horisont={L.horizon} depth={L.H - L.roadY} seed={5} />
        <Veikant y={L.roadBot + L.sidewalk} h={L.H - L.roadBot - L.sidewalk} w={W} type="gress" />
        <Kryss X={X} roadY={L.roadY} B={L.B} horizon={L.horizon} bottom={L.H} sidewalk={L.sidewalk} vpX={vpX} />

        {/* Sonene malt i kjørefeltet: der fronten av bilen er når lyset blir gult */}
        {visible.map((sg) => (
          <g key={sg.kind}>
            <rect x={sg.x1} y={L.laneTop} width={sg.x2 - sg.x1} height={L.laneBot - L.laneTop} fill={alpha(ZONE_COLOR[sg.kind], sg.kind === 'dilemma' ? 0.42 : 0.55)} />
            {sg.kind === 'dilemma' && <rect x={sg.x1} y={L.laneTop} width={sg.x2 - sg.x1} height={L.laneBot - L.laneTop} fill={`url(#${hatch})`} />}
          </g>
        ))}

        <Stopplinje X={X} roadY={L.roadY} B={L.B} horizon={L.horizon} vpX={vpX} />

        {/* En fotgjenger venter ved gangfeltet på fortauet bak veien */}
        <Person x={X(KRYSS.gangfelt.fra + 1.2)} y={L.roadTop - L.sidewalk * 0.5} size={1.72 * q} jakke="gul" flip title="Fotgjenger som venter ved gangfeltet" />

        <Trafikklys x={lightX} y={lightFoot} top={L.headTop} size={L.headH} lys={lys} title={red ? 'Lyssignal: rødt' : 'Lyssignal: gult'} />

        {/* Spøkelsesbilen der valget ender */}
        {showGhost && (
          <Bil x={carX(ghostS)} y={L.roadY} size={carSize} lakk={CAR_PAINT} dim title={plan === 'bremse' ? 'Her stopper bilen' : 'Her er bilen når lyset blir rødt'} />
        )}

        {/* Bilen */}
        {v > 0.3 && <SpeedLines x={rearX} y={L.roadY - L.carH * 0.45} length={Math.min(50 * L.k, (5 + 2 * v) * L.k)} spread={L.carH * 0.6} />}
        <Bil
          x={carX(s)}
          y={L.roadY}
          size={carSize}
          lakk={CAR_PAINT}
          hjulvinkel={hjulvinkelFraStrekning(s + D)}
          bremselys={braking || (plan === 'bremse' && t > input.tr)}
          title={braking ? 'Bilen bremser' : 'Bil'}
        />

        {gone ? (
          <ValueTag x={W - 6} y={L.tagY} text={`${tagText} →`} anchor="end" color={VIZ.velocity} />
        ) : (
          <>
            {L.lupe > 0 ? (
              <BilLupe
                x={tagX}
                y={L.tagY}
                w={tagW}
                h={L.tagH}
                inset={L.lupeInset}
                gap={L.lupeGap}
                carLen={L.lupe}
                pointer={pointer}
                pointerX={mid}
                text={tagText}
                color={VIZ.velocity}
                speed={Math.min(0.24 * L.lupe - 6, L.lupe * v * 0.012)}
                lakk={CAR_PAINT}
                hjulvinkel={hjulvinkelFraStrekning(s + D)}
                bremselys={braking || (plan === 'bremse' && t > input.tr)}
                title={`Bilen forstørret: ${tagText}`}
              />
            ) : (
              <ValueTag x={tagX} y={L.tagY} text={tagText} color={VIZ.velocity} pointer={pointer} />
            )}
            {vLen > 3 && <ForceArrow x1={vx} y1={L.tagY} x2={vx + vLen} y2={L.tagY} color={VIZ.velocity} width={6} label="v" />}
            {aLen > 3 && <ForceArrow x1={ax} y1={L.tagY} x2={ax - aLen} y2={L.tagY} color={VIZ.acceleration} width={5} label="a" />}
          </>
        )}

        <ValueTag x={count.x} y={L.headTop + L.headH / 2} text={count.text} anchor={count.anchor} color={VIZ.ink} />

        {/* Rad 1: navnene på sonene */}
        {visible.map((sg) => {
          const w = sg.x2 - sg.x1;
          const [long, short] = zoneNames[sg.kind];
          const text = w > long.length * charW + 10 ? long : w > short.length * charW + 8 ? short : null;
          return (
            <g key={`n-${sg.kind}`}>
              {sg.x1 > left + 1 && (
                <line x1={sg.x1} x2={sg.x1} y1={L.laneBot} y2={L.zoneY + 3} stroke={VIZ.ink} strokeWidth={1 * L.ss} strokeDasharray="2 3" opacity={0.45} />
              )}
              {text && (
                <Txt x={(sg.x1 + sg.x2) / 2} y={L.zoneY} size={0.85} weight={700} color={ZONE_COLOR[sg.kind]}>
                  {text}
                </Txt>
              )}
            </g>
          );
        })}
        {/* Rad 2: avstanden D når lyset blir gult, og videre bredden av krysset (en kjede av mål fra stopplinja) */}
        <Dimension
          x1={X(0)}
          y1={L.laneBot}
          x2={X(KRYSS.bredde)}
          y2={L.laneBot}
          offset={-(L.dY - L.laneBot)}
          color={VIZ.muted}
          labelSize={0.8}
          label={fits(X(KRYSS.bredde) - X(0), 'krysset 15 m') ? `krysset ${fmt(KRYSS.bredde, 0)} m` : `${fmt(KRYSS.bredde, 0)} m`}
        />

        {D > 0.4 && <Dimension x1={X(-D)} y1={L.laneBot} x2={X(0)} y2={L.laneBot} offset={-(L.dY - L.laneBot)} label={fits(X(0) - X(-D), 'D = 100 m') ? `D = ${fmt(D, 0)} m` : fits(X(0) - X(-D), `${fmt(D, 0)} m`) ? `${fmt(D, 0)} m` : undefined} />}

        {/* Rad 3: strekningen bilen kjører i valget */}
        <PlanRow x0={X(-D)} x1={X(planEnd)} y={L.planY} edge={edge} color={planColor} label={planLabel} deficit={deficit} />
      </g>
    </g>
  );
}

/**
 * Mållinja for valget: fra startposisjonen til der fronten ender (bremse) eller er ved rødt (kjøre videre). Går den
 * ut av bildet, får den en pil i høyre ende. Under den viser en oransje klamme det som ikke går: hvor langt over
 * stopplinja bilen stopper, eller hvor langt bakenden er fra å være ute av krysset når det blir rødt.
 */
function PlanRow({
  x0,
  x1,
  y,
  edge,
  color,
  label,
  deficit,
}: {
  x0: number;
  x1: number;
  y: number;
  edge: number;
  color: string;
  label: (w: number) => ReactNode;
  deficit: { from: number; to: number; texts: string[] } | null;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const end = Math.min(x1, edge);
  const open = x1 > edge;
  const h = 9 * ss;
  const lbl = label(end - x0);
  const dA = deficit ? Math.max(4, Math.min(deficit.from, edge)) : 0;
  const dB = deficit ? Math.min(deficit.to, edge) : 0;
  const dy = y + 7 * ss;
  // Teksten under klammen: midt under den, men skjøvet inn fra kanten når klammen ligger helt ute ved kanten
  const textW = (txt: string) => txt.length * 17 * 0.8 * f * 0.58 + 6 * f;
  const dText = deficit?.texts.find((txt) => textW(txt) < edge - 8);
  const dW = dText ? textW(dText) : 0;
  const dX = Math.min(edge - 4 - dW / 2, Math.max(4 + dW / 2, (dA + dB) / 2));
  return (
    <g>
      {end - x0 > 2 &&
        (!open ? (
          <Dimension x1={x0} y1={y} x2={end} y2={y} color={color} label={lbl} labelSize={0.9} />
        ) : (
          <g>
            <line x1={x0} y1={y} x2={end} y2={y} stroke={VIZ.surface} strokeWidth={4 * ss} opacity={0.8} />
            <line x1={x0} y1={y} x2={end - 2} y2={y} stroke={color} strokeWidth={1.4 * ss} strokeDasharray={`${8 * ss} ${4 * ss}`} />
            <polygon points={`${x0},${y} ${x0 + h},${y - h * 0.42} ${x0 + h},${y + h * 0.42}`} fill={color} />
            <polygon points={`${end},${y} ${end - h * 1.3},${y - h * 0.6} ${end - h * 1.3},${y + h * 0.6}`} fill={color} />
            {lbl !== undefined && (
              <Txt x={(x0 + end) / 2} y={y - 9 * f} size={0.9} color={color} weight={650}>
                {lbl}
              </Txt>
            )}
          </g>
        ))}
      {deficit && dB - dA > 1.5 && (
        <g>
          <line x1={dA} y1={dy} x2={dB} y2={dy} stroke={VIZ.surface} strokeWidth={4.5 * ss} opacity={0.8} />
          <line x1={dA} y1={dy} x2={dB} y2={dy} stroke={ZONE_COLOR.dilemma} strokeWidth={2.4 * ss} />
          <line x1={dA} y1={dy - 5 * ss} x2={dA} y2={dy + 4 * ss} stroke={ZONE_COLOR.dilemma} strokeWidth={1.6 * ss} />
          <line x1={dB} y1={dy - 5 * ss} x2={dB} y2={dy + 4 * ss} stroke={ZONE_COLOR.dilemma} strokeWidth={1.6 * ss} />
          {dText && (
            <Txt x={dX} y={dy + 17 * 0.8 * f + 2} size={0.8} color={ZONE_COLOR.dilemma} weight={700}>
              {dText}
            </Txt>
          )}
        </g>
      )}
    </g>
  );
}

/* ---------- Forklaring ---------- */

/** «a, b og c» */
function joinList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} og ${xs[xs.length - 1]}`;
}

/**
 * Lengden av dilemmasonen ved noen farter, f.eks. «Med disse verdiene er dilemmasonen 14,3 m lang ved 30 km/h, 23,8 m
 * ved 50 km/h og 43,5 m ved 70 km/h.» eller «… finnes det ingen dilemmasone ved 30 og 50 km/h, men den er 4,6 m lang
 * ved 70 km/h.»
 */
function lengthsText(lens: { kmh: number; len: number }[]): string {
  const gone = lens.filter((l) => l.len <= 0).map((l) => fmt(l.kmh, 0));
  const present = lens.filter((l) => l.len > 0).map((l, i) => `${m1(l.len)}${i === 0 ? ' lang' : ''} ved ${fmt(l.kmh, 0)} km/h`);
  if (!gone.length) return `Med disse verdiene er dilemmasonen ${joinList(present)}.`;
  if (!present.length) return `Med disse verdiene finnes det ingen dilemmasone ved ${joinList(gone)} km/h.`;
  return `Med disse verdiene finnes det ingen dilemmasone ved ${joinList(gone)} km/h, men den er ${joinList(present)}.`;
}

function explanation(input: YellowInput, kmh: number, D: number, z: Zones, sit: Situation, so: StopOutcome, go: GoOutcome, plan: Plan): ReactNode {
  const { tr, a, tg } = input;
  const need = requiredDeceleration(input, D);
  const lens = [30, 50, 70].map((k) => ({ kmh: k, len: dilemmaLength({ ...input, v0: kmhToMs(k) }) }));
  const [l30, l50, l70] = lens.map((l) => l.len) as [number, number, number];
  const noneTypical = lens.every((l) => l.len <= 0);
  const growing = l70 > l50 && l50 > 0 && l50 >= l30;
  const tNeed = yellowNeeded(input);
  const ok = noDilemmaSpeeds(input);
  const stopPlace: Record<StopOutcome['place'], string> = {
    foer: '',
    'over-linja': 'like over stopplinja',
    gangfelt: 'i gangfeltet',
    krysset: 'midt i krysset',
    forbi: 'på andre siden av krysset',
  };
  const goText =
    go.status === 'over'
      ? `Kjører den videre, er hele bilen ute av krysset ${fmt(go.margin, 1)} s før det blir rødt.`
      : go.status === 'i-krysset'
        ? `Kjører den videre, er den fortsatt i krysset når det blir rødt: den rekker bare ${m1(yellowDistance(input))} på ${fmt(tg, 1)} s, men må kjøre ${m1(D + CLEAR_DISTANCE)}.`
        : `Kjører den videre, er den ikke kommet til stopplinja når det blir rødt, så den kjører på rødt.`;
  const stopText =
    so.place === 'foer'
      ? `Bremser den, stopper den ${m1(so.margin)} før stopplinja.`
      : `Bremser den med ${fmt(a, 1)} m/s², stopper den ${m1(so.over)} etter stopplinja, ${stopPlace[so.place]}.`;

  return (
    <>
      <p>
        {sit === 'dilemma' ? (
          <>
            <strong>Bilen er i dilemmasonen.</strong> Den er for nær til å stoppe (stopplengden er {m1(z.dStop)}, men{' '}
            {D < 0.5 ? 'den står allerede ved stopplinja' : `den er bare ${fmt(D, 0)} m unna`}) og{' '}
            {z.dGo < 0 ? (
              // Grensen for å rekke over er negativ: farten er for lav, ikke avstanden for lang.
              <>
                for sakte til å rekke over krysset før rødt, selv fra stopplinja: for å kjøre {clearTxt} (krysset og bilen) på{' '}
                {fmt(tg, 1)} s må farten være minst {fmt(msToKmh(minGoSpeed(tg)), 0)} km/h.
              </>
            ) : (
              'for langt unna til å rekke over krysset før rødt.'
            )}{' '}
            {stopText} {goText}
          </>
        ) : sit === 'stopp' ? (
          <>
            <strong>Sjåføren skal stoppe.</strong> Stopplengden er {m1(z.dStop)}, og bilen er {fmt(D, 0)} m unna. {stopText} {goText}
          </>
        ) : sit === 'kjor' ? (
          <>
            <strong>Sjåføren bør kjøre videre.</strong> Bilen er for nær til å stoppe før linja. {stopText} {goText}
          </>
        ) : (
          <>
            <strong>Her går begge deler.</strong> Gultiden er lang nok til at bilen rekker over, og avstanden er lang nok til å stoppe. {stopText} {goText}
          </>
        )}{' '}
        {plan === 'bremse' ? 'Velg «Sjåføren kjører videre» og spill av for å se det andre valget.' : 'Velg «Sjåføren bremser» og spill av for å se det andre valget.'}
      </p>
      <p>
        <strong>{noneTypical ? 'Ingen dilemmasone ved 30–70 km/h.' : growing ? 'Dilemmasonen vokser med farten.' : 'Dilemmasonen avhenger av farten.'}</strong>{' '}
        Bremselengden v<Sub>0</Sub>²/(2a) øker med kvadratet av farten, mens reaksjonslengden v<Sub>0</Sub>t<Sub>r</Sub> og strekningen bilen rekker på
        gultiden, v<Sub>0</Sub>t<Sub>g</Sub>, bare øker proporsjonalt med farten. Ved høy fart vokser derfor stopplengden raskere enn grensen for å rekke
        over. {noneTypical ? '' : `${lengthsText(lens)} `}I grafen er dilemmasonen det oransje området mellom den blå kurven og den grønne linja.{' '}
        {ok ? (
          ok[1] > kmhToMs(150) ? (
            <>
              Med t<Sub>r</Sub>, a og t<Sub>g</Sub> som nå finnes dilemmasonen bare under {fmt(msToKmh(ok[0]), 0)} km/h (og ved urealistisk høy fart): så
              sakte bruker bilen for lang tid over krysset.
            </>
          ) : (
            <>
              Med t<Sub>r</Sub>, a og t<Sub>g</Sub> som nå er det bare mellom {fmt(msToKmh(ok[0]), 0)} og {fmt(msToKmh(ok[1]), 0)} km/h at det ikke finnes
              noen dilemmasone: saktere biler bruker for lang tid over krysset, og raskere biler har for lang stopplengde.
            </>
          )
        ) : (
          <>
            Med t<Sub>r</Sub>, a og t<Sub>g</Sub> som nå finnes dilemmasonen ved alle farter.
          </>
        )}{' '}
        {tNeed > tg + 1e-9
          ? `Ved ${fmt(kmh, 0)} km/h forsvinner den først når gultiden er minst ${fmt(tNeed, 1)} s.`
          : `Ved ${fmt(kmh, 0)} km/h holder det med en gultid på ${fmt(tNeed, 1)} s, og den er ${fmt(tg, 1)} s.`}
      </p>
      <p>
        <strong>Reaksjonstiden teller bare når du bremser.</strong> Kjører du videre, holder bilen bare farten, så t<Sub>r</Sub> påvirker ikke den grønne
        linja. Men den flytter den blå kurven: med t<Sub>r</Sub> = {fmt(tr, 1)} s kjører bilen {m1(reactionDistance(input))} før bremsingen i det hele tatt
        begynner.{' '}
        {Number.isFinite(need)
          ? need > BRAKE.full
            ? `For å stoppe ved linja fra ${fmt(D, 0)} m måtte bilen ha bremset med ${fmt(need, 1)} m/s², mer enn full bremsing på tørr asfalt (ca. ${fmt(BRAKE.full, 0)} m/s²).`
            : need > a + 1e-9
              ? `For å stoppe ved linja fra ${fmt(D, 0)} m måtte bilen ha bremset med ${fmt(need, 1)} m/s². Det går på tørr asfalt (full bremsing er ca. ${fmt(BRAKE.full, 0)} m/s²), men en rolig oppbremsing er ca. ${fmt(BRAKE.rolig, 0)} m/s², og bråbremser du, kan bilen bak kjøre inn i deg.`
              : `For å stoppe ved linja fra ${fmt(D, 0)} m holder det å bremse med ${fmt(need, 1)} m/s².`
          : `Fra ${fmt(D, 0)} m er bilen forbi stopplinja før sjåføren rekker å begynne å bremse, så ingen bremser kan stoppe den før linja.`}
      </p>
      <p>
        Mange tror at gult betyr «gass på». Etter trafikkreglene betyr gult lys stopp, men den som er så nær at den ikke kan stoppe trygt, kan kjøre videre.
        Her regner vi strengt: hele bilen skal være ute av krysset før rødt, og den gasser ikke. Ekte lyskryss har i tillegg en kort tid der alle har rødt,
        så en bil som er på vei over, rekker ut før kryssende trafikk får grønt. Det sikreste er likevel å holde lavere fart inn mot krysset: da blir
        stopplengden kortere, og du kan stoppe selv om lyset skifter når du er nær.
      </p>
    </>
  );
}
