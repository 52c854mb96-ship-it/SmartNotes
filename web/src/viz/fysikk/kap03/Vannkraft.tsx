import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  PlayControls,
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
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  Callout,
  Dimension,
  Himmel,
  Landskap,
  Lauvtre,
  SCENE,
  Stoppeklokke,
  Terreng,
  ValueTag,
  Vann,
  mix,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import {
  ETA_MAX,
  ETA_MIN,
  FLOW_STEPS,
  HEAD_STEPS,
  HOUSEHOLD_KWH_PER_YEAR,
  HOUSEHOLD_POWER,
  PLANT_SIZE_NAMES,
  PRESETS,
  RHO_WATER,
  hydroPower,
  matchPreset,
  nearestIndex,
  pictogramUnit,
  plantSize,
  roundSig,
  settlementName,
  stepDecimals,
  volumeComparison,
  withPrefix,
  type HydroResult,
  type PresetId,
} from './model-vannkraft';
import { Demning, FjellSnitt, Hus, Inntak, Kraftmast, Kraftstasjon, Linjer, Rorgate, Utlop, bygdPlasser, mastPunkter, stationPoints } from './vannkraft-deler';
import {
  HYDRO_NARROW,
  HYDRO_WIDE,
  hydroScene,
  placeLabel,
  pointAlong,
  polylineLength,
  type Box,
  type HydroScene,
  type LabelSpot,
} from './vannkraft-scene';
import { useNarrow } from './useNarrow';

/** Potensiell energi (som i resten av kapittelet), elektrisk energi (nyttig) og varme (tap). */
const C_EP = VIZ.gravity;
const C_EL = VIZ.applied;
const C_HEAT = VIZ.friction;

/** Den største effekten i et norsk vannkraftverk (litt over 1 200 MW). */
const LARGEST_NORWEGIAN = 1.24e9;
/** Tiden avspillingen varer (s). */
const PLAY_SECONDS = 60;

type Choice = PresetId | 'egne';

/** Tallet og enheten hver for seg: 4 169 250 W → { value: «4,17», unit: «MW» }. */
function siParts(v: number, unit: string): { value: string; unit: string } {
  const p = withPrefix(v, unit);
  return { value: fmt(p.value, p.decimals), unit: p.unit };
}

/** «4,17 MW», «5,49 kW», «196 W»: tre gjeldende siffer med prefiks. */
function si(v: number, unit: string): string {
  const p = siParts(v, unit);
  return `${p.value} ${p.unit}`;
}

/** Antall husstander: én desimal under 10, ellers tre gjeldende siffer (2 283 → «2 280»). */
function householdsText(n: number): string {
  return n < 10 ? fmt(n, 1) : fmt(roundSig(n, 3), 0);
}

/** Vannføringen med så mange desimaler som trengs: 0,012 · 2,5 · 250. */
function flowText(Q: number): string {
  return fmt(Q, stepDecimals(Q));
}

export default function Vannkraft() {
  const start = PRESETS.find((p) => p.id === 'smaa') ?? PRESETS[0]!;
  const [hi, setHi] = useState(() => nearestIndex(HEAD_STEPS, start.h));
  const [qi, setQi] = useState(() => nearestIndex(FLOW_STEPS, start.Q));
  const [etaPct, setEtaPct] = useState(Math.round(start.eta * 100));
  const { ref, narrow } = useNarrow();
  const clock = useSimClock({ tMax: PLAY_SECONDS });

  const h = HEAD_STEPS[hi] ?? start.h;
  const Q = FLOW_STEPS[qi] ?? start.Q;
  const eta = etaPct / 100;
  const r = hydroPower({ h, Q, eta });
  const choice: Choice = matchPreset({ h, Q, eta }) ?? 'egne';
  const lay = narrow ? HYDRO_NARROW : HYDRO_WIDE;
  const sc = useMemo(() => hydroScene(h, Q, lay), [h, Q, lay]);

  const pick = (id: Choice) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setHi(nearestIndex(HEAD_STEPS, p.h));
    setQi(nearestIndex(FLOW_STEPS, p.Q));
    setEtaPct(Math.round(p.eta * 100));
  };

  const flow = narrow ? FLOW_NARROW : FLOW_WIDE;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Fallhøyde h"
          ariaLabel="Fallhøyde"
          value={hi}
          onChange={setHi}
          min={0}
          max={HEAD_STEPS.length - 1}
          step={1}
          format={(i) => `${fmt(HEAD_STEPS[i] ?? h, 0)} m`}
        />
        <Slider
          label="Vannføring Q"
          ariaLabel="Vannføring"
          value={qi}
          onChange={setQi}
          min={0}
          max={FLOW_STEPS.length - 1}
          step={1}
          format={(i) => `${flowText(FLOW_STEPS[i] ?? Q)} m³/s`}
        />
        <Slider
          label="Virkningsgrad η"
          ariaLabel="Virkningsgrad"
          value={etaPct}
          onChange={setEtaPct}
          min={Math.round(ETA_MIN * 100)}
          max={Math.round(ETA_MAX * 100)}
          step={1}
          unit="%"
        />
      </Controls>
      <Toolbar>
        <Segmented<Choice> label="Velg et kraftverk" options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={choice} onChange={pick} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${lay.W} ${lay.H}`}
          label={sceneLabel(h, Q, r)}
          maxHeight={narrow ? 620 : 500}
          caption="Høydene er ikke tegnet i målestokk: fallhøyden kan være alt fra 5 m til 1 000 m, så den er tegnet sammentrykt."
        >
          <Scene sc={sc} h={h} Q={Q} r={r} t={clock.t} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 ${flow.W} ${flow.H}`}
        label={`Energien hvert sekund: vannet mister ${si(r.inputPower, 'J')} potensiell energi. ${fmt(etaPct, 0)} %, ${si(r.power, 'J')}, blir elektrisk energi, og ${si(r.loss, 'J')} blir varme og lyd. Det holder til omtrent ${householdsText(r.households)} husstander.`}
        maxHeight={narrow ? 640 : 330}
      >
        <EnergyFlow r={r} eta={eta} lay={flow} />
      </Figure>

      <Readouts>
        <Readout label="Vann gjennom turbinen hvert sekund" value={fmt(r.massPerSecond, 0)} unit="kg" />
        <Readout label="Elektrisk effekt P" value={siParts(r.power, 'W').value} unit={siParts(r.power, 'W').unit} tone={C_EL} />
        <Readout label="Antall husstander (omtrent)" value={householdsText(r.households)} />
        <Readout label="Energi på ett år med full effekt" value={siParts(r.energyPerYearKWh * 1000, 'Wh').value} unit={siParts(r.energyPerYearKWh * 1000, 'Wh').unit} />
      </Readouts>

      <Formula label="Effekten fra vannet">
        <FormulaLine>
          m = ρV = {fmt(RHO_WATER, 0)} kg/m³ · {flowText(Q)} m³ = {fmt(r.massPerSecond, 0)} kg &nbsp;(vannet som renner gjennom turbinen på 1 s)
        </FormulaLine>
        <FormulaLine>
          P<Sub>tilført</Sub> = mgh / t = {fmt(r.massPerSecond, 0)} kg · 9,81 m/s² · {fmt(h, 0)} m / 1 s = {si(r.inputPower, 'W')}
        </FormulaLine>
        <FormulaLine>
          P = η · P<Sub>tilført</Sub> = {fmt(eta, 2)} · {si(r.inputPower, 'W')} = {si(r.power, 'W')}
        </FormulaLine>
        <FormulaLine>
          Husstander: P / P<Sub>hus</Sub> = {si(r.power, 'W')} / {si(HOUSEHOLD_POWER, 'W')} ≈ {householdsText(r.households)}
        </FormulaLine>
      </Formula>

      <Explain>
        <ExplainText h={h} Q={Q} eta={eta} r={r} preset={choice} />
      </Explain>
    </VizLayout>
  );
}

function sceneLabel(h: number, Q: number, r: HydroResult): string {
  return `Vannkraftverk i fjellet: vann fra et magasin bak en demning renner gjennom en rørgate ned fjellsida til en kraftstasjon i dalen. Fallhøyden er ${fmt(h, 0)} m og vannføringen ${flowText(Q)} m³/s. I stasjonen driver vannet turbinen, som driver generatoren. Effekten er ${si(r.power, 'W')}, og strømmen går med kraftlinjer til bygda.`;
}

/* ---------- Scenen ---------- */

function Scene({ sc, h, Q, r, t }: { sc: HydroScene; h: number; Q: number; r: HydroResult; t: number }) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const clip = useSvgId('vk-ramme');
  const { lay, dam, surfaceY, turbine, station, river, village, pipe, pipeW } = sc;
  const { W, H, groundY } = lay;
  const SP = stationPoints(station, turbine.x, turbine.y);
  const lakeDepth = dam.baseY - surfaceY;
  const spin = 0.6;

  // Rørgata: sadlene fra foten av demningen til stasjonen
  const L = polylineLength(pipe);
  const total = L[L.length - 1] ?? 0;
  const startSlope = L[pipe.findIndex(([x]) => x >= dam.toeX + 4)] ?? 0;
  const endSlope = L[pipe.findIndex(([x]) => x >= station.x - 6)] ?? total;

  // Trær i lia (bak rørgata) og i bygda
  // Kraftmasta og bygda til høyre for elva
  const mastSize = station.h * 0.92;
  const mastX = Math.min(village.x1 + 16 * k, W - 12);
  const mast = mastPunkter(mastX, groundY, mastSize);
  const houseSize = 22 * k;
  const homesFrom = mastX + 20 * k;
  const nHomes = Math.max(0, Math.min(6, Math.floor((W - 4 - homesFrom) / (houseSize * 1.5))));
  const homes = bygdPlasser(homesFrom, W - 4, nHomes, houseSize);

  // Avspillingen: stoppeklokke og levert energi øverst til høyre
  const showPanel = t > 0;
  const fs = 17 * f;
  const clockR = 22 * k;
  const energyText = si(r.power * t, 'J');
  const panelTitle = 'Levert energi P · t';
  const panelW = clockR * 2 + 24 + Math.max(panelTitle.length * 0.62 * fs * 0.8, energyText.length * 0.68 * fs * 1.1) + 16;
  const panelH = clockR * 2 + 20;
  const panel: Box = { x1: W - 10 - panelW, y1: 10, x2: W - 10, y2: 10 + panelH };

  // Etikettene: plasseres der de ikke kolliderer med stasjonen, demningen, skiltet eller hverandre
  const lf = 17 * 0.85 * f;
  const frame: Box = { x1: 4, y1: 4, x2: W - 4, y2: H - 4 };
  const stationBox: Box = { x1: station.x - 8, y1: SP.roof.ridgeY - 12, x2: station.x + station.w + 8, y2: groundY + 4 };
  const damBox: Box = { x1: dam.x - 2, y1: dam.crestY - 8, x2: dam.toeX, y2: dam.baseY };
  const pText = `P = ${si(r.power, 'W')}`;
  const pTagY = SP.roof.ridgeY - 26 * f;
  // Halve bredden på skiltet (samme regel som ValueTag)
  const pTagHalf = Math.max(fs * 0.9 * 1.6, pText.length * fs * 0.9 * 0.6 + 16 * f) / 2;
  const pTagMaxX = W - pTagHalf - 6;
  let pTagX = Math.min(station.x + station.w * 0.7, pTagMaxX);
  const pTagBox: Box = { x1: pTagX - pTagHalf - 4, y1: pTagY - fs * 0.8, x2: pTagX + pTagHalf + 4, y2: pTagY + fs * 0.8 + 6 };
  const dimX = 22;
  // Rørgata (prøvd langs røret) og målet for fallhøyden er også i veien for etikettene
  const pipeBoxes: Box[] = [];
  for (let d = 0; d < total; d += 10) {
    const a = pointAlong(pipe, d);
    if (a.x < dam.x) continue;
    const half = pipeW / 2 + 5;
    pipeBoxes.push({ x1: a.x - half, y1: a.y - half, x2: a.x + half, y2: a.y + half });
  }
  // Inntaket i magasinet
  pipeBoxes.push({ x1: sc.intake.x - 6, y1: sc.intake.y - pipeW / 2 - 6, x2: dam.x, y2: sc.intake.y + pipeW / 2 + 6 });
  const dimBox: Box = { x1: dimX - 7, y1: surfaceY - 4, x2: dimX + 5, y2: turbine.y + 4 };
  const obstacles: Box[] = [stationBox, damBox, pTagBox, dimBox, ...pipeBoxes, ...(showPanel ? [panel] : [])];

  const hText = `h = ${fmt(h, 0)} m`;
  // «Magasin» står i vannet når det er plass, ellers over vannet med en strek ned til det
  const lakeY = surfaceY + lakeDepth * 0.5 + lf * 0.35;
  const lakeLabel = placeLabel(
    [
      { lx: (dimX + 10 * f + sc.intake.x - 8) / 2, ly: lakeY, anchor: 'middle', callout: false },
      { lx: dam.x - 8, ly: lakeY, anchor: 'end', callout: false },
      { lx: dimX + 12 * f, ly: surfaceY - 22 * f, anchor: 'start', callout: true },
      { lx: dam.x * 0.5, ly: surfaceY - 40 * f, anchor: 'middle', callout: true },
    ],
    7,
    lf,
    obstacles,
    frame,
  );
  obstacles.push(lakeLabel.box);
  const midDrop = (surfaceY + turbine.y) / 2;
  const hLabel = placeLabel(
    [midDrop, (surfaceY + 3 * turbine.y) / 4, surfaceY + lakeDepth + 22 * f, turbine.y - 8 * f].map((y) => ({ lx: dimX + 12 * f, ly: y + 6 * f, anchor: 'start' as const })),
    hText.length,
    17 * 0.95 * f,
    obstacles,
    frame,
  );
  obstacles.push(hLabel.box);

  const damPt = { x: dam.x + dam.crestW + 0.72 * (dam.baseY - dam.crestY) * 0.45, y: dam.crestY + (dam.baseY - dam.crestY) * 0.45 };
  const damLabel = placeLabel(
    [
      { lx: dam.toeX + 12 * f, ly: dam.crestY - 6 * f, anchor: 'start' },
      { lx: dam.x + dam.crestW / 2, ly: dam.crestY - 16 * f, anchor: 'middle' },
      { lx: dam.toeX + 16 * f, ly: damPt.y + 4 * f, anchor: 'start' },
      { lx: dam.x - 10, ly: dam.crestY - 14 * f, anchor: 'end' },
    ],
    7,
    lf,
    obstacles,
    frame,
  );
  obstacles.push(damLabel.box);


  const G = SP.generator;
  const genPt = { x: G.x - G.w / 2 + 3, y: (G.top + G.bottom) / 2 };
  const genLabel = placeLabel(
    [
      { lx: station.x - 12, ly: G.top - 2, anchor: 'end' },
      { lx: station.x - 12, ly: SP.roof.eaveY - 4, anchor: 'end' },
      { lx: station.x - 12, ly: SP.roof.ridgeY - 4, anchor: 'end' },
      { lx: station.x + 4, ly: SP.roof.ridgeY - 18 * f, anchor: 'end' },
      { lx: station.x + 10, ly: SP.roof.ridgeY - 18 * f, anchor: 'start' },
      { lx: G.x, ly: SP.roof.ridgeY - 50 * f, anchor: 'middle' },
    ],
    9,
    lf,
    obstacles,
    frame,
  );
  obstacles.push(genLabel.box);
  // Går streken fra «Generator» gjennom skiltet med effekten, flyttes skiltet mot høyre (så langt det er plass)
  {
    const ex = genLabel.anchor === 'start' ? genLabel.lx - 5 : genLabel.anchor === 'end' ? genLabel.lx + 5 : genLabel.lx;
    const ey = genLabel.anchor === 'middle' ? (genLabel.ly > genPt.y ? genLabel.ly - 15 * f * 0.85 : genLabel.ly + 6) : genLabel.ly - 5.5 * f * 0.85;
    const y1 = pTagBox.y1;
    const y2 = pTagBox.y2 + 10 * f;
    const lo = Math.min(ey, genPt.y);
    const hi = Math.max(ey, genPt.y);
    if (hi > y1 && lo < y2 && Math.abs(genPt.y - ey) > 1e-6) {
      const xAt = (y: number) => genPt.x + ((ex - genPt.x) * (Math.min(hi, Math.max(lo, y)) - genPt.y)) / (ey - genPt.y);
      const right = Math.max(xAt(y1), xAt(y2));
      const left = Math.min(xAt(y1), xAt(y2));
      if (right + 6 > pTagBox.x1 && left - 6 < pTagBox.x2) {
        const shift = Math.min(pTagMaxX, pTagX + (right + 8 - pTagBox.x1)) - pTagX;
        pTagX += shift;
        pTagBox.x1 += shift;
        pTagBox.x2 += shift;
      }
    }
  }
  const turbPt = { x: turbine.x - SP.casingW * 0.28, y: turbine.y + SP.casingH * 0.32 };
  const turbLabel = placeLabel(
    [
      { lx: turbine.x - SP.casingW * 0.1, ly: groundY + 30 * f + 10, anchor: 'middle' },
      { lx: station.x - 12, ly: groundY + 24 * f, anchor: 'end' },
      { lx: station.x - 12, ly: turbine.y + 4 * f, anchor: 'end' },
    ],
    6,
    lf,
    obstacles,
    frame,
  );
  obstacles.push(turbLabel.box);

  // Rørgata: prøv noen punkter langs lia, og helst etiketten til høyre for røret eller under det (i fjellet)
  const qText = `Q = ${flowText(Q)} m³/s`;
  const pipeSpots: (LabelSpot & { px: number; py: number })[] = [];
  for (const side of ['right', 'below', 'rightLow', 'rightHigh'] as const) {
    for (const frac of [0.42, 0.3, 0.56]) {
      const a = pointAlong(pipe, startSlope + (endSlope - startSlope) * frac);
      const base = { px: a.x, py: a.y };
      if (side === 'right') pipeSpots.push({ ...base, lx: a.x + pipeW / 2 + 20 * f, ly: a.y - 14 * f, anchor: 'start' });
      if (side === 'below') pipeSpots.push({ ...base, lx: a.x - pipeW / 2 - 14 * f, ly: a.y + 26 * f, anchor: 'end' });
      if (side === 'rightLow') pipeSpots.push({ ...base, lx: a.x + pipeW / 2 + 14 * f, ly: a.y + 10 * f, anchor: 'start' });
      if (side === 'rightHigh') pipeSpots.push({ ...base, lx: a.x + pipeW / 2 + 20 * f, ly: a.y - 40 * f, anchor: 'start' });
    }
  }
  const pipeLabel = placeLabel(pipeSpots, Math.max(7, qText.length), lf, obstacles, frame, 2);
  const pipePt = { x: pipeLabel.px, y: pipeLabel.py };
  obstacles.push(pipeLabel.box);

  return (
    <g clipPath={`url(#${clip})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <Himmel w={W} h={groundY + 10} sol={{ x: W * 0.6, y: 44, r: 17 }} skyer={2} seed={8} />
      <Landskap x={0} y={groundY - 4} w={W} h={Math.min(250, (groundY - 40) * 0.62)} type="fjell" seed={5} />
      {/* Magasinet og elva (terrenget dekker det som er under bunnen) */}
      <Vann x={-4} y={surfaceY} w={dam.x + 6} h={lakeDepth + 8} />
      <Vann x={river.x1 - 2} y={river.y} w={river.x2 - river.x1 + 4} h={river.depth} />
      <Terreng points={sc.terrain} bottom={H + 10} type="gress" seed={6} />
      <FjellSnitt terrain={sc.terrain} top={surfaceY} bottom={H} k={k} />

      <Rorgate path={pipe} w={pipeW} t={t} ground={sc.terrain} supportsFrom={startSlope} supportsTo={endSlope} />
      <Inntak x={sc.intake.x} y={sc.intake.y} w={pipeW} />
      <Demning dam={dam} />

      <Kraftstasjon s={station} turbineX={turbine.x} turbineY={turbine.y} pipeW={pipeW} t={t} spin={spin} />
      <Utlop x={SP.outlet.x} y={SP.outlet.y + 2} t={t} w={Math.min(28, river.x2 - SP.outlet.x)} />

      {/* Kraftlinja fra stasjonen til masta og videre ut av bildet */}
      <Kraftmast x={mastX} y={groundY} size={mastSize} />
      <Linjer
        spans={[
          ...SP.bushings.map((b, i) => [b, mast[i]!] as [{ x: number; y: number }, { x: number; y: number }]),
          ...mast.map((m, i) => [m, { x: W + 40, y: m.y + 6 + i * 2 }] as [{ x: number; y: number }, { x: number; y: number }]),
        ]}
        sag={0.05}
      />
      {homes.map((hs, i) => (
        <Hus key={i} x={hs.x} y={groundY} size={hs.size} farge={hs.farge} pipe={i % 2 === 0} />
      ))}
      {homes.length >= 2 && <Lauvtre x={(homes[0]!.x + homes[1]!.x) / 2} y={groundY} size={34 * k} seed={4} />}

      {/* Fallhøyden: fra vannflata i magasinet ned til turbinen */}
      <line
        x1={dimX}
        y1={turbine.y}
        x2={Math.max(dimX, sc.slope[sc.slope.length - 1]![0] - 4)}
        y2={turbine.y}
        stroke={VIZ.ink}
        strokeWidth={1.1 * ss}
        strokeDasharray={`${4 * ss} ${3.5 * ss}`}
        opacity={0.6}
      />
      <circle cx={turbine.x} cy={turbine.y} r={3 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2 * ss} />
      <Dimension x1={dimX} y1={surfaceY} x2={dimX} y2={turbine.y} />
      <Txt x={hLabel.lx} y={hLabel.ly} anchor="start" weight={720} size={0.95}>
        {hText}
      </Txt>

      {/* Navn på delene */}
      {lakeLabel.callout ? (
        <Callout x={Math.min(dam.x - 10, lakeLabel.lx + 26 * f)} y={surfaceY + lakeDepth * 0.45} lx={lakeLabel.lx} ly={lakeLabel.ly} anchor={lakeLabel.anchor}>
          Magasin
        </Callout>
      ) : (
        <Txt x={lakeLabel.lx} y={lakeLabel.ly} anchor={lakeLabel.anchor} size={0.85} weight={650}>
          Magasin
        </Txt>
      )}
      <Callout x={damPt.x} y={damPt.y} lx={damLabel.lx} ly={damLabel.ly} anchor={damLabel.anchor}>
        Demning
      </Callout>
      <Callout x={pipePt.x} y={pipePt.y} lx={pipeLabel.lx} ly={pipeLabel.ly} anchor={pipeLabel.anchor}>
        Rørgate
      </Callout>
      <Txt x={pipeLabel.lx} y={pipeLabel.ly + 1.25 * lf} anchor={pipeLabel.anchor} size={0.85} weight={700} color={VIZ.ink}>
        {qText}
      </Txt>
      <Callout x={genPt.x} y={genPt.y} lx={genLabel.lx} ly={genLabel.ly} anchor={genLabel.anchor}>
        Generator
      </Callout>
      <Callout x={turbPt.x} y={turbPt.y} lx={turbLabel.lx} ly={turbLabel.ly} anchor={turbLabel.anchor}>
        Turbin
      </Callout>
      <ValueTag x={pTagX} y={pTagY} text={pText} color={C_EL} pointer={10 * f} />

      {showPanel && (
        <g>
          <rect x={panel.x1} y={panel.y1} width={panelW} height={panelH} rx={10} fill={VIZ.surface} opacity={0.94} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <Stoppeklokke x={panel.x1 + 10 + clockR} y={panel.y1 + 6 + clockR * 1.3} r={clockR} t={t} desimaler={1} title={`Stoppeklokke: ${fmt(t, 1)} s`} />
          <Txt x={panel.x1 + clockR * 2 + 24} y={panel.y1 + panelH * 0.42} anchor="start" size={0.8} muted halo={false}>
            {panelTitle}
          </Txt>
          <Txt x={panel.x1 + clockR * 2 + 24} y={panel.y1 + panelH * 0.42 + 24 * f} anchor="start" size={1.1} weight={760} color={C_EL} halo={false}>
            {energyText}
          </Txt>
        </g>
      )}
    </g>
  );
}

/* ---------- Energiflyt hvert sekund og husstander ---------- */

interface FlowLayout {
  W: number;
  H: number;
  /** Båndet: venstre ende, maskinen, enden av pila og toppen. */
  x0: number;
  xs: number;
  xe: number;
  y0: number;
  band: number;
  /** Hvor pila for tapet ender. */
  yEnd: number;
  /** Bildediagrammet: venstre kant, toppen, ikonbredde og antall kolonner. */
  px: number;
  py: number;
  icon: number;
  cols: number;
}

const FLOW_WIDE: FlowLayout = { W: 800, H: 300, x0: 18, xs: 236, xe: 468, y0: 78, band: 116, yEnd: 272, px: 548, py: 22, icon: 28, cols: 7 };
const FLOW_NARROW: FlowLayout = { W: 560, H: 640, x0: 14, xs: 226, xe: 500, y0: 92, band: 128, yEnd: 330, px: 24, py: 372, icon: 40, cols: 10 };

function EnergyFlow({ r, eta, lay }: { r: HydroResult; eta: number; lay: FlowLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('vk-flyt');
  const { x0, xs, xe, y0, band } = lay;
  const y1 = y0 + eta * band;
  const y2 = y0 + band;
  const machineW = 18;
  const xm = xs + machineW;
  // Tapet bøyer ned (kvart sirkel) og går loddrett ned til en pil
  const tl = y2 - y1;
  const rin = 12;
  const rout = rin + tl;
  const xc = xm + 14;
  const cy = y2 + rin;
  const yEnd = lay.yEnd;
  const lossPath = [
    `M${xm},${y1}`,
    `H${xc}`,
    `A${rout},${rout} 0 0 1 ${xc + rout},${cy}`,
    `V${yEnd}`,
    `H${xc + rin}`,
    `V${cy}`,
    `A${rin},${rin} 0 0 0 ${xc},${y2}`,
    `H${xm}`,
    'Z',
  ].join('');
  const headL = 16;
  const lossHead = `M${xc + rin - 7},${yEnd}L${xc + rout + 7},${yEnd}L${(xc + rin + xc + rout) / 2},${yEnd + headL}Z`;
  const elHead = `M${xe},${y0 - 8}L${xe + 24},${(y0 + y1) / 2}L${xe},${y1 + 8}Z`;
  const pctEl = `${fmt(eta * 100, 0)} %`;
  const pctLoss = `${fmt(100 - eta * 100, 0)} %`;
  const elInside = y1 - y0 >= 36 * f;
  // Tapet står til venstre for pila ned, under båndet med potensiell energi
  const lossX = xc + rin - 12;
  const lossY = Math.max(y2 + 30 * f, (cy + yEnd) / 2);

  return (
    <g>
      <LinearGradientX id={`${id}a`} from={C_EP} to={C_EL} />
      <LinearGradientX id={`${id}b`} from={C_EP} to={C_HEAT} />
      <Txt x={x0} y={24 * f} anchor="start" weight={700} size={0.95}>
        Energien hvert sekund{' '}
        <tspan style={{ fill: VIZ.muted, fontWeight: 500 }}>(1 W = 1 J/s)</tspan>
      </Txt>
      {/* Tilført: potensiell energi */}
      <rect x={x0} y={y0} width={xs - x0} height={band} fill={C_EP} opacity={0.92} />
      <Txt x={x0 + 12} y={y0 + band / 2 - 6 * f} anchor="start" size={0.85} weight={650} color={VIZ.surface} halo={false}>
        Potensiell energi
      </Txt>
      <Txt x={x0 + 12} y={y0 + band / 2 + 18 * f} anchor="start" size={1.15} weight={760} color={VIZ.surface} halo={false}>
        {si(r.inputPower, 'J')}
      </Txt>
      {/* Nyttig: elektrisk energi */}
      <rect x={xm} y={y0} width={xe - xm} height={y1 - y0} fill={`url(#${id}a)`} />
      <path d={elHead} fill={C_EL} />
      {/* Tap: varme og lyd */}
      {tl > 0.5 && <path d={lossPath} fill={`url(#${id}b)`} />}
      {tl > 0.5 && <path d={lossHead} fill={C_HEAT} />}
      {/* Turbin og generator */}
      <rect x={xs} y={y0 - 8} width={machineW} height={band + 16} rx={4} fill={mix(SCENE.metal, VIZ.surface, 0.3)} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <Txt x={xs + machineW / 2} y={y0 - 16} anchor="middle" size={0.8} weight={650}>
        Turbin og generator
      </Txt>
      {elInside ? (
        <>
          <Txt x={xm + 26} y={(y0 + y1) / 2 - 7 * f} anchor="start" size={0.85} weight={650} color={VIZ.surface} halo={false}>
            Elektrisk energi
          </Txt>
          <Txt x={xm + 26} y={(y0 + y1) / 2 + 15 * f} anchor="start" size={1.05} weight={760} color={VIZ.surface} halo={false}>
            {si(r.power, 'J')} ({pctEl})
          </Txt>
        </>
      ) : (
        <>
          <Txt x={xc + rout + 18} y={y1 + 30 * f} anchor="start" size={0.85} weight={650} color={C_EL}>
            Elektrisk energi
          </Txt>
          <Txt x={xc + rout + 18} y={y1 + 52 * f} anchor="start" size={1.05} weight={760} color={C_EL}>
            {si(r.power, 'J')} ({pctEl})
          </Txt>
        </>
      )}
      <Txt x={lossX} y={lossY - 4 * f} anchor="end" size={0.85} weight={650} color={C_HEAT}>
        Varme og lyd
      </Txt>
      <Txt x={lossX} y={lossY + 19 * f} anchor="end" size={1.05} weight={760} color={C_HEAT}>
        {si(r.loss, 'J')} ({pctLoss})
      </Txt>

      <Households n={r.households} lay={lay} />
    </g>
  );
}

/** Vannrett toning fra én farge til en annen: overgangen skjer like etter maskinen (turbinen og generatoren). */
function LinearGradientX({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <defs>
      <linearGradient id={id} x1={0} y1={0} x2={1} y2={0}>
        <stop offset={0} style={{ stopColor: mix(from, to, 0.55) }} />
        <stop offset={0.18} style={{ stopColor: to }} />
        <stop offset={1} style={{ stopColor: to }} />
      </linearGradient>
    </defs>
  );
}

/** Bildediagram: ett hus per `unit` husstander, og en del av et hus for resten. */
function Households({ n, lay }: { n: number; lay: FlowLayout }) {
  const f = useTextScale();
  const clipBase = useSvgId('vk-hus-del');
  const unit = pictogramUnit(n);
  const count = n / unit;
  const full = Math.floor(count + 1e-9);
  const frac = count - full;
  const icons: { i: number; part: number }[] = [];
  for (let i = 0; i < full; i++) icons.push({ i, part: 1 });
  if (frac >= 0.05 || full === 0) icons.push({ i: full, part: Math.max(frac, 0.02) });
  const { px, py, icon, cols } = lay;
  const cellW = icon * 1.24;
  const cellH = icon * 1.2 + 6;
  const top = py + 62 * f;
  const unitText = unit === 1 ? 'Ett hus = én husstand' : `Ett hus = ${fmt(unit, 0)} husstander`;
  const rows = Math.max(1, Math.ceil(icons.length / cols));
  return (
    <g>
      <Txt x={px} y={py + 18 * f} anchor="start" size={0.85} muted>
        Nok strøm til omtrent
      </Txt>
      <Txt x={px} y={py + 44 * f} anchor="start" size={1.2} weight={760} color={C_EL}>
        {householdsText(n)} husstander
      </Txt>
      {icons.map(({ i, part }) => {
        const cx = px + (i % cols) * cellW + icon / 2 + 2;
        const gy = top + Math.floor(i / cols) * cellH + icon * 1.12;
        const cid = `${clipBase}${i}`;
        return (
          <g key={i}>
            {part < 1 && <Hus x={cx} y={gy} size={icon} farge="rod" dempet skygge={false} />}
            {part < 1 && (
              <defs>
                <clipPath id={cid}>
                  <rect x={cx - icon * 0.62} y={gy - icon * 1.3} width={icon * 1.24 * part} height={icon * 1.4} />
                </clipPath>
              </defs>
            )}
            <g clipPath={part < 1 ? `url(#${cid})` : undefined}>
              <Hus x={cx} y={gy} size={icon} farge="rod" skygge={false} />
            </g>
          </g>
        );
      })}
      <Txt x={px} y={top + rows * cellH + 16 * f} anchor="start" size={0.8} muted>
        {unitText}
      </Txt>
      <Txt x={px} y={top + rows * cellH + 36 * f} anchor="start" size={0.8} muted>
        (i snitt over året)
      </Txt>
    </g>
  );
}

/* ---------- Forklaringen ---------- */

function ExplainText({ h, Q, eta, r, preset }: { h: number; Q: number; eta: number; r: HydroResult; preset: Choice }) {
  const vol = volumeComparison(Q);
  const one = (n: number) => Math.abs(n - 1) < 0.05;
  const volText =
    vol.kind === 'botter'
      ? one(vol.count)
        ? 'omtrent én bøtte med vann'
        : `omtrent ${fmt(vol.count, vol.count < 3 ? 1 : 0)} bøtter med vann`
      : vol.kind === 'badekar'
        ? one(vol.count)
          ? 'omtrent ett fullt badekar'
          : `omtrent ${fmt(vol.count, vol.count < 3 ? 1 : 0)} fulle badekar`
        : `nok til å fylle et 25-metersbasseng på ${fmt(vol.seconds, vol.seconds < 10 ? 1 : 0)} s`;
  const pct = fmt(eta * 100, 0);
  const size = plantSize(r.power);
  const etaComment: ReactNode =
    eta >= 0.93
      ? 'Det er på grensen av hva de beste anleggene klarer, og 100 % er umulig fordi det alltid er litt friksjon. Til sammenligning gjør en bensinmotor bare rundt 25–30 % av energien om til bevegelse.'
      : eta >= 0.85
      ? 'Vannkraftverk er blant de beste energiomformerne vi har: en bensinmotor gjør bare rundt 25–30 % av energien om til bevegelse, og musklene dine rundt 25 %.'
      : eta >= 0.7
        ? 'Så lav virkningsgrad kan et lite eller gammelt anlegg ha. Store, moderne kraftverk ligger på rundt 90 %.'
        : 'Så lav virkningsgrad er dårlig for et vannkraftverk: moderne anlegg gjør rundt 90 % av energien om til elektrisk energi.';
  const v = r.freeFallSpeed;
  let context: ReactNode;
  if (h <= 30) {
    context = (
      <>
        Med bare {fmt(h, 0)} m fall trengs enorme vannmengder for å gi stor effekt. Derfor ligger elvekraftverkene i store elver, og
        demningen er lav.
      </>
    );
  } else if (h >= 300) {
    context = (
      <>
        Et fjellkraftverk utnytter en stor høydeforskjell, så det klarer seg med mye mindre vann for samme effekt: vannet fra et magasin høyt
        oppe i fjellet føres i rør og tunneler ned til stasjonen i dalen.
      </>
    );
  } else {
    context = <>Like stor effekt med halve fallhøyden krever dobbelt så stor vannføring.</>;
  }
  const yearText = si(r.energyPerYearKWh * 1000, 'Wh');
  return (
    <>
      <p>
        <strong>Hvert sekund renner {flowText(Q)} m³ vann gjennom turbinen</strong>, det vil si {fmt(r.massPerSecond, 0)} kg ({volText}). Vannet
        faller {fmt(h, 0)} m fra vannflata i magasinet ned til turbinen og mister den potensielle energien mgh = {si(r.inputPower, 'J')} hvert sekund.
        Siden 1 W = 1 J/s, gir vannet kraftverket effekten {si(r.inputPower, 'W')}.
      </p>
      <p>
        <strong>
          Kraftverket gjør {pct} % av energien om til elektrisk energi: P = η · P<Sub>tilført</Sub> = {si(r.power, 'W')}.
        </strong>{' '}
        Resten, {si(r.loss, 'W')}, blir varme og lyd: friksjon mellom vannet og røret, virvler i turbinen og varme i generatoren. Energien blir
        ikke borte, men den blir til termisk energi med lav temperatur, som vi ikke får brukt til noe nyttig (lav energikvalitet). {etaComment}
      </p>
      <p>
        <strong>Fallhøyde og vannføring teller like mye.</strong> P = η·ρ·g·Q·h er proporsjonal med både h og Q:{' '}
        {2 * h <= HEAD_STEPS[HEAD_STEPS.length - 1]!
          ? `dobler du fallhøyden til ${fmt(2 * h, 0)} m, dobles effekten til ${si(2 * r.power, 'W')}.`
          : `halverer du fallhøyden til ${fmt(h / 2, 0)} m, halveres effekten til ${si(r.power / 2, 'W')}.`}{' '}
        {context}
      </p>
      <p>
        Med full effekt hele året gir kraftverket {yearText} elektrisk energi. En norsk husstand bruker rundt {fmt(HOUSEHOLD_KWH_PER_YEAR, 0)} kWh i
        året ({si(HOUSEHOLD_POWER, 'W')} i snitt), så det holder til omtrent {householdsText(r.households)} husstander,{' '}
        {r.households < 1 ? 'altså mindre enn én' : settlementName(r.households)}. Dette er et {PLANT_SIZE_NAMES[size]}
        {size === 'mikro' ? ' (under 100 kW)' : size === 'mini' ? ' (0,1–1 MW)' : size === 'smaa' ? ' (1–10 MW)' : ''}. Et kraftverk går sjelden
        for fullt hele året, fordi vannet i magasinet må spares til vinteren, så det virkelige tallet er lavere.
        {r.power > LARGEST_NORWEGIAN && ' Så stort er ikke noe norsk kraftverk: det største har en effekt på litt over 1 200 MW.'}
        {preset === 'hytte' && ' Det er likevel nok til lys, kjøleskap og lading på hytta.'}
      </p>
      <p>
        <strong>Kraftverket lager ikke energi, det gjør den om.</strong> Vannet har fått den potensielle energien fra sola: sola varmer opp hav og
        innsjøer, vanndampen stiger til værs og faller som regn og snø i fjellet. Faller vannet fritt {fmt(h, 0)} m, får det farten v = √(2gh) ={' '}
        {fmt(v, v < 10 ? 1 : 0)} m/s nederst (fra mgh = ½mv²). Dobbelt så stor fallhøyde gir bare √2 ≈ 1,4 ganger så stor fart, men dobbelt så
        mye energi per kilo, fordi E<Sub>k</Sub> = ½mv² vokser med kvadratet av farten. I rørgata er røret fullt av vann, så vannet får ikke
        denne farten der: energien kommer fram til turbinen som et stort trykk. Rundt 90 % av strømmen i Norge kommer fra vannkraft.
      </p>
    </>
  );
}
