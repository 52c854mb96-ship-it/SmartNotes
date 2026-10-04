import { useMemo, useState, type ReactNode } from 'react';
import {
  Akvaporin,
  Arrow,
  BIO,
  Celle,
  Cellekjerne,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Kanalprotein,
  Kloroplast,
  Legend,
  Membran,
  MembranPartikler,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  RodtBlodlegeme,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  cellInterior,
  countSides,
  crossingCounts,
  fmt,
  fmtPct,
  jiggle,
  linePath,
  mixColor,
  placeParticles,
  planCrossings,
  proteinSlot,
  sample,
  useContainerTextScale,
  useSimClock,
  type CrossingGeometry,
  type Track,
} from '../kit';
import {
  CROSS_RATE,
  C_ISO,
  DIFFUSION_T_MAX,
  OSMOSIS_T_MAX,
  OSMOSIS_V0,
  PARTICLES_PER_MMOL,
  RBC_INACTIVE,
  cellInSolution,
  diffusionConcentrations,
  diffusionHalfTime,
  lysisConcentration,
  makeDiffusionTracks,
  osmolarity,
  osmosis,
  osmosisAt,
  osmoticPressure,
  waterColumn,
  type CellResult,
} from './model';

type Mode = 'diffusjon' | 'osmose' | 'celle';

const MODES: { value: Mode; label: string }[] = [
  { value: 'diffusjon', label: 'Diffusjon' },
  { value: 'osmose', label: 'Osmose' },
  { value: 'celle', label: 'Celle i løsning' },
];

/** Farger for venstre og høyre side i grafene. */
const LEFT = BIO.serie[0];
const RIGHT = BIO.serie[1];

export default function DiffusjonOgOsmose() {
  const [mode, setMode] = useState<Mode>('diffusjon');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg forsøk" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'diffusjon' ? <Diffusjon /> : mode === 'osmose' ? <Osmose /> : <CelleILosning />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Felles: to rom med en membran imellom                                    */
/* ====================================================================== */

const X0 = 30;
const X1 = 770;
const MID = 400;
const MEMBRANE_T = 40;

/** Overskrifter over de to rommene: navn og en verdi (konsentrasjon). */
function SideHeaders({ f, left, right, centre }: { f: number; left: ReactNode; right: ReactNode; centre?: ReactNode }) {
  const y1 = 22 * f;
  const y2 = y1 + 25 * f;
  return (
    <g>
      <Txt x={X0 + 6} y={y1} anchor="start" muted size={0.85}>
        Venstre side
      </Txt>
      <Txt x={X1 - 6} y={y1} anchor="end" muted size={0.85}>
        Høyre side
      </Txt>
      <Txt x={X0 + 6} y={y2} anchor="start" weight={700} color={LEFT}>
        {left}
      </Txt>
      <Txt x={X1 - 6} y={y2} anchor="end" weight={700} color={RIGHT}>
        {right}
      </Txt>
      {centre && (
        <Txt x={MID} y={y1} muted size={0.8}>
          {centre}
        </Txt>
      )}
    </g>
  );
}

const headerHeight = (f: number) => 22 * f + 25 * f + 16;

/* ====================================================================== */
/* Diffusjon                                                                */
/* ====================================================================== */

function Diffusjon() {
  const [cL, setCL] = useState(16);
  const [cR, setCR] = useState(2);
  const [channels, setChannels] = useState(false);
  const clock = useSimClock({ tMax: DIFFUSION_T_MAX, speed: 1.5 });
  const tracks = useMemo(() => makeDiffusionTracks(cL, cR, channels), [cL, cR, channels]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const t = clock.t;
  const [nL, nR] = countSides(tracks, t);
  const [toRight, toLeft] = crossingCounts(tracks, t);
  const expected = diffusionConcentrations(cL, cR, t);
  const reset = clock.reset;
  const change = (fn: () => void) => {
    reset();
    fn();
  };
  const plotH = Math.round(300 + 240 * (f - 1));
  const N0L = Math.round(cL * PARTICLES_PER_MMOL);
  const N0R = Math.round(cR * PARTICLES_PER_MMOL);

  return (
    <>
      <Controls>
        <Slider
          label="Konsentrasjon til venstre"
          value={cL}
          onChange={(v) => change(() => setCL(v))}
          min={0}
          max={20}
          step={1}
          unit="mmol/L"
        />
        <Slider
          label="Konsentrasjon til høyre"
          value={cR}
          onChange={(v) => change(() => setCR(v))}
          min={0}
          max={20}
          step={1}
          unit="mmol/L"
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Gjennom kanalproteiner (fasilitert diffusjon)" checked={channels} onChange={(v) => change(() => setChannels(v))} />
      </Toolbar>

      <div ref={ref}>
        <DiffusionScene tracks={tracks} t={t} f={f} channels={channels} nL={nL} nR={nR} />
      </div>
      <Legend
        items={[
          { color: BIO.opplost, label: channels ? 'Ioner (oppløst stoff)' : 'Oppløst stoff, f.eks. O₂' },
          { color: BIO.membran, label: channels ? 'Membran med kanalproteiner' : 'Membran (lipiddobbeltlag)' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Konsentrasjonen på hver side over tid. Etter ${fmt(t, 0)} s: venstre ${fmt(nL / PARTICLES_PER_MMOL, 1)} og høyre ${fmt(nR / PARTICLES_PER_MMOL, 1)} mmol/L.`}
      >
        <DiffusionPlot tracks={tracks} t={t} cL={cL} cR={cR} height={plotH} />
      </Figure>
      <Legend
        items={[
          { color: LEFT, label: 'Venstre side' },
          { color: RIGHT, label: 'Høyre side' },
          { color: VIZ.muted, label: 'Tynn linje: telte partikler i figuren', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Venstre side" value={fmt(nL / PARTICLES_PER_MMOL, 1)} unit="mmol/L" tone={LEFT} />
        <Readout label="Høyre side" value={fmt(nR / PARTICLES_PER_MMOL, 1)} unit="mmol/L" tone={RIGHT} />
        <Readout label="Krysset mot høyre" value={String(toRight)} unit={toRight === 1 ? 'partikkel' : 'partikler'} />
        <Readout label="Krysset mot venstre" value={String(toLeft)} unit={toLeft === 1 ? 'partikkel' : 'partikler'} />
      </Readouts>

      <Formula label="Hvor mange som krysser per sekund">
        <FormulaLine>Hver partikkel krysser med sannsynligheten k = {fmt(CROSS_RATE, 2)} per sekund, like stor begge veier.</FormulaLine>
        <FormulaLine>
          Mot høyre: k · N<Sub>v</Sub> = {fmt(CROSS_RATE, 2)} · {nL} = {fmt(CROSS_RATE * nL, 2)} per s · mot venstre: k · N<Sub>h</Sub> ={' '}
          {fmt(CROSS_RATE, 2)} · {nR} = {fmt(CROSS_RATE * nR, 2)} per s
        </FormulaLine>
        <FormulaLine>
          Netto mot høyre: k · (N<Sub>v</Sub> − N<Sub>h</Sub>) = {fmt(CROSS_RATE * (nL - nR), 2)} per s. Forskjellen halveres omtrent hvert{' '}
          {fmt(diffusionHalfTime(), 1)} s.
        </FormulaLine>
      </Formula>

      <Explain>{diffusionText({ t, N0L, N0R, nL, nR, toRight, toLeft, channels, expected })}</Explain>
    </>
  );
}

function DiffusionScene({
  tracks,
  t,
  f,
  channels,
  nL,
  nR,
}: {
  tracks: readonly Track[];
  t: number;
  f: number;
  channels: boolean;
  nL: number;
  nR: number;
}) {
  const k = Math.max(1, f * 0.85);
  const Y0 = headerHeight(f);
  // Høyere rom på mobil, så figuren ikke blir flat
  const BH = Math.round(230 + 130 * (f - 1));
  const Y1 = Y0 + BH;
  const H = Math.round(Y1 + 12);
  const gates = [0.2, 0.5, 0.8].map((u) => Y0 + BH * u);
  const geom: CrossingGeometry = {
    a: { x: X0 + 4, y: Y0 + 4, w: MID - MEMBRANE_T / 2 - X0 - 6, h: BH - 8 },
    b: { x: MID + MEMBRANE_T / 2 + 2, y: Y0 + 4, w: X1 - MID - MEMBRANE_T / 2 - 6, h: BH - 8 },
    orientation: 'vertical',
    at: MID,
    thickness: MEMBRANE_T,
    gates: channels ? gates : undefined,
    r: 6 * k,
    speed: 70,
  };
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`To rom skilt av en membran. ${nL} partikler til venstre og ${nR} til høyre etter ${fmt(t, 0)} s.`}
      caption="Hver prikk er mange molekyler. Tidsskalaen er forenklet."
    >
      <SideHeaders
        f={f}
        left={`${fmt(nL / PARTICLES_PER_MMOL, 1)} mmol/L`}
        right={`${fmt(nR / PARTICLES_PER_MMOL, 1)} mmol/L`}
        centre="membran"
      />
      <rect x={X0} y={Y0} width={X1 - X0} height={BH} rx={14} fill={BIO.vannFyll} />
      <Membran
        x={MID}
        y={Y0 + BH / 2}
        length={BH}
        thickness={MEMBRANE_T}
        vertical
        skip={channels ? gates.map((g) => proteinSlot(g, 'kanal', MEMBRANE_T)) : []}
      />
      {channels && gates.map((g) => <Kanalprotein key={g} x={MID} y={g} thickness={MEMBRANE_T} vertical />)}
      <MembranPartikler tracks={tracks} t={t} geometry={geom} fill={BIO.opplost} />
      <rect x={X0} y={Y0} width={X1 - X0} height={BH} rx={14} fill="none" stroke={VIZ.muted} strokeWidth={1.5} />
    </Figure>
  );
}

function DiffusionPlot({ tracks, t, cL, cR, height }: { tracks: readonly Track[]; t: number; cL: number; cR: number; height: number }) {
  const yMax = Math.max(4, Math.ceil(Math.max(cL, cR) / 4) * 4);
  // Telte konsentrasjoner i figuren (trapper), regnet ut én gang per plan
  const counted = useMemo(() => {
    const l: [number, number][] = [];
    const r: [number, number][] = [];
    for (let s = 0; s <= DIFFUSION_T_MAX; s += 0.25) {
      const [a, b] = countSides(tracks, s);
      l.push([s, a / PARTICLES_PER_MMOL]);
      r.push([s, b / PARTICLES_PER_MMOL]);
    }
    return { l, r };
  }, [tracks]);
  const upTo = (pts: [number, number][]) => pts.filter(([s]) => s <= t + 1e-9);
  const [nL, nR] = countSides(tracks, t);
  return (
    <Plot
      x={{ min: 0, max: DIFFUSION_T_MAX, label: 'Tid t (s)' }}
      y={{ min: 0, max: yMax, label: 'Konsentrasjon (mmol/L)' }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, y1 }) => (
        <g>
          <path
            d={linePath(
              sample((s) => diffusionConcentrations(cL, cR, s).left, 0, DIFFUSION_T_MAX, 160),
              sx,
              sy,
            )}
            fill="none"
            stroke={LEFT}
            strokeWidth={3}
          />
          <path
            d={linePath(
              sample((s) => diffusionConcentrations(cL, cR, s).right, 0, DIFFUSION_T_MAX, 160),
              sx,
              sy,
            )}
            fill="none"
            stroke={RIGHT}
            strokeWidth={3}
          />
          <path d={linePath(upTo(counted.l), sx, sy)} fill="none" stroke={LEFT} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.75} />
          <path d={linePath(upTo(counted.r), sx, sy)} fill="none" stroke={RIGHT} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.75} />
          {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />}
          <circle cx={sx(t)} cy={sy(nL / PARTICLES_PER_MMOL)} r={6} fill={LEFT} stroke={VIZ.surface} strokeWidth={2.5} />
          <circle cx={sx(t)} cy={sy(nR / PARTICLES_PER_MMOL)} r={6} fill={RIGHT} stroke={VIZ.surface} strokeWidth={2.5} />
        </g>
      )}
    </Plot>
  );
}

function diffusionText(s: {
  t: number;
  N0L: number;
  N0R: number;
  nL: number;
  nR: number;
  toRight: number;
  toLeft: number;
  channels: boolean;
  expected: { left: number; right: number };
}): ReactNode {
  const { t, N0L, N0R, nL, nR, toRight, toLeft, channels } = s;
  const what = channels ? (
    <p>
      Ioner og andre ladde eller store partikler kommer ikke gjennom lipiddobbeltlaget. Her går de gjennom <strong>kanalproteiner</strong>{' '}
      (fasilitert diffusjon). Kanalene bestemmer hvor partiklene kan krysse, men ikke hvilken vei: det er fortsatt konsentrasjonsforskjellen
      som gir nettotransporten, og cellen bruker ingen energi.
    </p>
  ) : (
    <p>
      Små, upolare molekyler som O₂ og CO₂ kan diffundere rett gjennom lipiddobbeltlaget. Det kalles passiv transport fordi cellen ikke
      bruker energi.
    </p>
  );
  if (N0L + N0R === 0)
    return (
      <>
        <p>Det er ingen oppløste partikler på noen av sidene. Flytt glidebryterne for å legge til partikler.</p>
        {what}
      </>
    );
  if (N0L === N0R)
    return (
      <>
        <p>
          <strong>Like konsentrasjoner.</strong> Partiklene krysser membranen like ofte begge veier ({toRight} mot høyre og {toLeft} mot
          venstre så langt), så det blir ingen netto transport. Dette kalles dynamisk likevekt: bevegelsen stopper aldri, men
          konsentrasjonene holder seg like.
        </p>
        {what}
      </>
    );
  const high = N0L > N0R ? 'venstre' : 'høyre';
  const low = N0L > N0R ? 'høyre' : 'venstre';
  const nearlyEqual = Math.abs(nL - nR) <= 2 && t > 2 * diffusionHalfTime();
  let main: ReactNode;
  if (t < 0.05)
    main = (
      <p>
        Det er flest partikler til {high}. Trykk «Spill av». Hver partikkel beveger seg <strong>tilfeldig</strong> (varmebevegelse) og har
        like stor sjanse for å krysse membranen den ene veien som den andre. Partiklene «vil» ikke jevne ut noe som helst.
      </p>
    );
  else if (nearlyEqual)
    main = (
      <p>
        <strong>Nå er konsentrasjonene omtrent like.</strong> Partiklene fortsetter å krysse begge veier ({toRight} mot høyre og {toLeft}{' '}
        mot venstre til sammen), men omtrent like mange hver vei, så det blir ingen netto transport lenger: dynamisk likevekt. Små
        tilfeldige svingninger er helt normalt.
      </p>
    );
  else
    main = (
      <p>
        Så langt har {N0L > N0R ? toRight : toLeft} partikler krysset mot {low} og {N0L > N0R ? toLeft : toRight} mot {high}. Begge veier er
        like lette, men fordi det står flere partikler til {high}, er det flere som treffer membranen og krysser derfra. Derfor går{' '}
        <strong>nettotransporten fra høy til lav konsentrasjon</strong>, ned konsentrasjonsgradienten. Jo mindre forskjellen blir, jo
        langsommere går det.
      </p>
    );
  return (
    <>
      {main}
      {what}
    </>
  );
}

/* ====================================================================== */
/* Osmose                                                                   */
/* ====================================================================== */

/** Sukkerpartikler per mol/L i figuren. */
const SUGAR_PER_MOL = 24;
const N_WATER = 26;

function Osmose() {
  const [cL, setCL] = useState(0.5);
  const [cR, setCR] = useState(0);
  const clock = useSimClock({ tMax: OSMOSIS_T_MAX, speed: 1.5 });
  const r = useMemo(() => osmosis(cL, cR), [cL, cR]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const t = clock.t;
  const s = osmosisAt(r, t);
  const reset = clock.reset;
  const change = (fn: () => void) => {
    reset();
    fn();
  };
  const plotH = Math.round(280 + 240 * (f - 1));
  const dir = Math.abs(s.flow) < 0.02 ? null : s.flow > 0 ? 'høyre' : 'venstre';
  const nSugar = (cL * OSMOSIS_V0) / 1000;

  return (
    <>
      <Controls>
        <Slider
          label="Sukker til venstre"
          value={cL}
          onChange={(v) => change(() => setCL(v))}
          min={0}
          max={1}
          step={0.05}
          unit="mol/L"
          decimals={2}
        />
        <Slider
          label="Sukker til høyre"
          value={cR}
          onChange={(v) => change(() => setCR(v))}
          min={0}
          max={1}
          step={0.05}
          unit="mol/L"
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <OsmosisScene cL={cL} cR={cR} t={t} f={f} VL={s.VLeft} VR={s.VRight} flow={s.flow} cNowL={s.cLeft} cNowR={s.cRight} />
      </div>
      <Legend
        items={[
          { color: BIO.sukker, label: 'Sukker (kommer ikke gjennom)' },
          { color: BIO.vann, label: 'Vann (går gjennom akvaporiner)' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Volumet på hver side over tid. Etter ${fmt(t, 0)} s: venstre ${fmt(s.VLeft, 0)} mL og høyre ${fmt(s.VRight, 0)} mL.`}
      >
        <Plot
          x={{ min: 0, max: OSMOSIS_T_MAX, label: 'Tid t (s)' }}
          y={{ min: 40, max: 160, label: 'Volum (mL)', ticks: [40, 70, 100, 130, 160] }}
          width={800}
          height={plotH}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              <line x1={sx(0)} x2={sx(OSMOSIS_T_MAX)} y1={sy(100)} y2={sy(100)} className="viz-guide" />
              <path
                d={linePath(
                  sample((x) => osmosisAt(r, x).VLeft, 0, OSMOSIS_T_MAX, 150),
                  sx,
                  sy,
                )}
                fill="none"
                stroke={LEFT}
                strokeWidth={3}
              />
              <path
                d={linePath(
                  sample((x) => osmosisAt(r, x).VRight, 0, OSMOSIS_T_MAX, 150),
                  sx,
                  sy,
                )}
                fill="none"
                stroke={RIGHT}
                strokeWidth={3}
              />
              {t > 0 && <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} className="viz-guide" />}
              <circle cx={sx(t)} cy={sy(s.VLeft)} r={6} fill={LEFT} stroke={VIZ.surface} strokeWidth={2.5} />
              <circle cx={sx(t)} cy={sy(s.VRight)} r={6} fill={RIGHT} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: LEFT, label: 'Venstre side' },
          { color: RIGHT, label: 'Høyre side' },
        ]}
      />

      <Readouts>
        <Readout label="Volum venstre" value={fmt(s.VLeft, 0)} unit="mL" tone={LEFT} />
        <Readout label="Volum høyre" value={fmt(s.VRight, 0)} unit="mL" tone={RIGHT} />
        <Readout label="Sukker nå (venstre / høyre)" value={`${fmt(s.cLeft, 2)} / ${fmt(s.cRight, 2)}`} unit="mol/L" />
        <Readout
          label="Netto vannstrøm"
          value={dir ? fmt(Math.abs(s.flow), 1) : '0'}
          unit={dir ? `mL/s mot ${dir}` : 'mL/s'}
          tone={BIO.vann}
        />
      </Readouts>

      <Formula label="Sukkeret blir der det er">
        <FormulaLine>
          Sukker til venstre: n = c · V = {fmt(s.cLeft, 2)} mol/L · {fmt(s.VLeft / 1000, 3)} L = {fmt((s.cLeft * s.VLeft) / 1000, 3)} mol
          (som ved start: {fmt(nSugar, 3)} mol)
        </FormulaLine>
        <FormulaLine>Konsentrasjonen endres fordi volumet endres, ikke fordi sukkeret flytter seg.</FormulaLine>
      </Formula>

      <Explain>{osmosisText(cL, cR, s.cLeft, s.cRight, t, dir)}</Explain>
    </>
  );
}

function OsmosisScene({
  cL,
  cR,
  t,
  f,
  VL,
  VR,
  flow,
  cNowL,
  cNowR,
}: {
  cL: number;
  cR: number;
  t: number;
  f: number;
  VL: number;
  VR: number;
  flow: number;
  cNowL: number;
  cNowR: number;
}) {
  const k = Math.max(1, f * 0.85);
  const Y0 = headerHeight(f) + 6;
  const TH = Math.round(270 + 110 * (f - 1));
  const Yb = Y0 + TH;
  const H = Math.round(Yb + 14);
  const H0 = TH * 0.6;
  const hL = (H0 * VL) / OSMOSIS_V0;
  const hR = (H0 * VR) / OSMOSIS_V0;
  const leftBox = { x: X0 + 3, y: Yb - hL, w: MID - MEMBRANE_T / 2 - X0 - 3, h: hL };
  const rightBox = { x: MID + MEMBRANE_T / 2, y: Yb - hR, w: X1 - MID - MEMBRANE_T / 2 - 3, h: hR };
  // Membranen er et «vindu» nederst i skilleveggen, alltid under vannflaten (laveste mulige nivå er ca. 0,63 · H0)
  const WIN = 100;
  const winTop = Yb - WIN;
  const gates = [Yb - WIN / 2];
  const water = useMemo(
    () => planCrossings({ n: [N_WATER / 2, N_WATER / 2], rates: [0.12, 0.12], tMax: OSMOSIS_T_MAX, seed: 4, gates: 1, transit: 0.5 }),
    [],
  );
  const geom: CrossingGeometry = {
    a: { x: MID - MEMBRANE_T / 2 - 150, y: winTop + 2, w: 148, h: WIN - 6 },
    b: { x: MID + MEMBRANE_T / 2 + 2, y: winTop + 2, w: 148, h: WIN - 6 },
    orientation: 'vertical',
    at: MID,
    thickness: MEMBRANE_T,
    gates,
    r: 3.6 * k,
    speed: 50,
    jitter: 1.5,
  };
  const arrowY = Yb - WIN / 2;
  const len = Math.min(170, 90 + Math.abs(flow) * 28);
  const dir = Math.abs(flow) < 0.02 ? 0 : flow > 0 ? 1 : -1;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Kar med halvgjennomtrengelig membran. Venstre side ${fmt(VL, 0)} mL med ${fmt(cNowL, 2)} mol/L sukker, høyre side ${fmt(VR, 0)} mL med ${fmt(cNowR, 2)} mol/L.`}
      caption="Membranen sitter i et vindu nederst i skilleveggen. Høydeforskjellen er ikke i målestokk (se forklaringen)."
    >
      <SideHeaders f={f} left={`${fmt(cNowL, 2)} mol/L`} right={`${fmt(cNowR, 2)} mol/L`} centre="membran" />
      <rect x={leftBox.x} y={leftBox.y} width={leftBox.w} height={leftBox.h} fill={BIO.vannFyll} />
      <rect x={rightBox.x} y={rightBox.y} width={rightBox.w} height={rightBox.h} fill={BIO.vannFyll} />
      <line x1={leftBox.x} x2={leftBox.x + leftBox.w} y1={leftBox.y} y2={leftBox.y} stroke={BIO.vann} strokeWidth={2} />
      <line x1={rightBox.x} x2={rightBox.x + rightBox.w} y1={rightBox.y} y2={rightBox.y} stroke={BIO.vann} strokeWidth={2} />
      {/* Startnivået */}
      <line x1={X0} x2={X1} y1={Yb - H0} y2={Yb - H0} className="viz-guide" opacity={0.7} />
      <Txt x={X1 - 8} y={Yb - H0 - 8} anchor="end" muted size={0.75}>
        startnivå
      </Txt>
      <Sugar box={leftBox} n={Math.round(cL * SUGAR_PER_MOL)} seed={3} t={t} k={k} />
      <Sugar box={rightBox} n={Math.round(cR * SUGAR_PER_MOL)} seed={8} t={t} k={k} />
      {/* Skilleveggen over membranvinduet */}
      <rect
        x={MID - MEMBRANE_T / 2}
        y={Y0 - 4}
        width={MEMBRANE_T}
        height={winTop - Y0 + 4}
        rx={4}
        fill={VIZ.bodyStrong}
        stroke={VIZ.muted}
        strokeWidth={1.5}
      />
      <Membran
        x={MID}
        y={winTop + WIN / 2}
        length={WIN}
        thickness={MEMBRANE_T}
        vertical
        skip={gates.map((g) => proteinSlot(g, 'akvaporin', MEMBRANE_T))}
      />
      {gates.map((g) => (
        <Akvaporin key={g} x={MID} y={g} thickness={MEMBRANE_T} vertical />
      ))}
      <MembranPartikler tracks={water} t={t} geometry={geom} fill={BIO.vann} markCrossing={false} />
      {dir !== 0 ? (
        <g>
          <line
            x1={MID - (dir * len) / 2}
            y1={arrowY}
            x2={MID + (dir * len) / 2 - dir * 14}
            y2={arrowY}
            stroke={VIZ.surface}
            strokeWidth={10}
            strokeLinecap="round"
          />
          <Arrow x1={MID - (dir * len) / 2} y1={arrowY} x2={MID + (dir * len) / 2} y2={arrowY} color={BIO.vann} width={5} head={16} />
        </g>
      ) : (
        <g>
          <Arrow x1={MID - 50} y1={arrowY - 9} x2={MID + 50} y2={arrowY - 9} color={BIO.vann} width={2.5} head={10} />
          <Arrow x1={MID + 50} y1={arrowY + 9} x2={MID - 50} y2={arrowY + 9} color={BIO.vann} width={2.5} head={10} />
        </g>
      )}
      {/* Karet */}
      <path
        d={`M${X0},${Y0} V${Yb - 12} Q${X0},${Yb} ${X0 + 12},${Yb} H${X1 - 12} Q${X1},${Yb} ${X1},${Yb - 12} V${Y0}`}
        fill="none"
        stroke={VIZ.muted}
        strokeWidth={2}
      />
    </Figure>
  );
}

/** Sukkerpartikler spredt i væsken. Plasseringen er relativ, så de sprer seg når volumet øker (antallet er det samme). */
function Sugar({
  box,
  n,
  seed,
  t,
  k,
}: {
  box: { x: number; y: number; w: number; h: number };
  n: number;
  seed: number;
  t: number;
  k: number;
}) {
  const unit = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 700 }, [{ n, r: 38 }], seed, 10), [n, seed]);
  const r = 7.5 * k;
  const pad = r + 3;
  return (
    <g>
      {unit.map((p, i) => {
        const j = jiggle(p, t, 10);
        const x = box.x + pad + ((box.w - 2 * pad) * Math.min(1000, Math.max(0, j.x))) / 1000;
        const y = box.y + pad + ((box.h - 2 * pad) * Math.min(700, Math.max(0, j.y))) / 700;
        return <circle key={i} cx={x} cy={y} r={r} fill={BIO.sukker} stroke={VIZ.surface} strokeWidth={1.5} />;
      })}
    </g>
  );
}

function osmosisText(cL: number, cR: number, cNowL: number, cNowR: number, t: number, dir: string | null): ReactNode {
  const pi = osmoticPressure(0.1, 298);
  const scale = (
    <p>
      Høydeforskjellen i figuren er sterkt forminsket. I virkeligheten gir bare 0,1 mol/L sukker et osmotisk trykk på ca. {fmt(pi, 1)} bar,
      nok til å løfte vann omtrent {fmt(waterColumn(pi), 0)} m. Det er det samme trykket som holder planter oppreiste (turgor).
    </p>
  );
  if (cL === cR)
    return (
      <>
        <p>
          <strong>Like konsentrasjoner.</strong> Vannmolekylene går gjennom membranen begge veier hele tida, men like mange hver vei, så
          volumene endres ikke. Gjør konsentrasjonene ulike for å se osmose.
        </p>
        {scale}
      </>
    );
  const high = cL > cR ? 'venstre' : 'høyre';
  return (
    <>
      <p>
        <strong>Det er vannet som flytter seg, ikke sukkeret.</strong> Membranen er halvgjennomtrengelig: vannmolekylene er små og går
        gjennom akvaporinene, men sukkermolekylene er for store. Sukkeret binder en del av vannmolekylene, så på siden med mest sukker er
        det færre frie vannmolekyler som kan krysse. Derfor går flere vannmolekyler inn til {high} side enn ut, og nettostrømmen av vann går{' '}
        <strong>mot den høyeste konsentrasjonen av oppløst stoff</strong>.
      </p>
      {t > 0.05 && dir === null ? (
        <p>
          Nå har strømmen stoppet: trykket fra den høyere vannsøylen til {high} presser like mye vann tilbake som osmosen trekker inn.
          Konsentrasjonene er fortsatt ulike ({fmt(cNowL, 2)} og {fmt(cNowR, 2)} mol/L).
        </p>
      ) : (
        <p>
          Vannstanden stiger til {high}, og sukkerløsningen der blir tynnere fordi det samme sukkeret fordeles på mer vann. Strømmen stopper
          når trykket fra den høyere vannsøylen veier opp for forskjellen i osmotisk trykk.
        </p>
      )}
      {scale}
    </>
  );
}

/* ====================================================================== */
/* Celle i løsning                                                          */
/* ====================================================================== */

const PRESETS = [
  { value: 'vann', label: 'Rent vann', c: 0 },
  { value: 'fysiologisk', label: 'Fysiologisk saltvann', c: 0.9 },
  { value: 'sjovann', label: 'Sjøvann', c: 3.5 },
] as const;

const TONICITY_LABEL = { hypoton: 'Hypoton', isoton: 'Isoton', hyperton: 'Hyperton' } as const;

function CelleILosning() {
  const [c, setC] = useState(0.6);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const r = cellInSolution(c);
  const preset = PRESETS.find((p) => Math.abs(p.c - c) < 1e-9)?.value ?? null;
  const tone = r.tonicity === 'isoton' ? VIZ.muted : BIO.vann;
  const oOut = osmolarity(c);
  const oIn = osmolarity(C_ISO);

  return (
    <>
      <Controls>
        <Slider label="Saltkonsentrasjon utenfor (NaCl)" value={c} onChange={setC} min={0} max={4} step={0.05} unit="%" decimals={2} />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Løsning"
          options={PRESETS.map((p) => ({ value: p.value, label: p.label, detail: `${fmt(p.c, 1)} %` }))}
          value={preset}
          onPick={(v) => setC(PRESETS.find((p) => p.value === v)!.c)}
        />
      </Toolbar>

      <div ref={ref}>
        <CellScene c={c} r={r} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.vann, label: 'Netto vannstrøm gjennom membranen' },
          { color: VIZ.muted, label: 'Normal størrelse', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Løsningen er" value={TONICITY_LABEL[r.tonicity]} tone={tone} />
        <Readout
          label="Blodlegemets volum"
          value={r.rbc.burst ? 'Sprukket' : fmtPct(r.rbc.volume)}
          unit={r.rbc.burst ? undefined : 'av normalt'}
          tone={r.rbc.burst ? BIO.rodtBlodlegeme.line : undefined}
        />
        {r.plant.state === 'plasmolyse' ? (
          <Readout label="Protoplastens volum" value={fmtPct(r.plant.volume)} unit="av normalt" />
        ) : (
          <Readout label="Turgortrykk i plantecellen" value={fmt(r.plant.turgor, 1)} unit="bar" />
        )}
      </Readouts>

      <Formula label="Konsentrasjon av oppløste stoffer inne og ute">
        <FormulaLine>
          Ute: {fmt(c, 2)} % NaCl ≈ {fmt(oOut, 2)} osmol/L · inne i cellene: som {fmt(C_ISO, 1)} % NaCl ≈ {fmt(oIn, 2)} osmol/L
        </FormulaLine>
        {c > 0 ? (
          <FormulaLine>
            Blodlegemet: V/V<Sub>0</Sub> = {fmt(RBC_INACTIVE, 1)} + {fmt(1 - RBC_INACTIVE, 1)} · {fmt(C_ISO, 1)} / {fmt(c, 2)} ={' '}
            {fmt(r.rbc.volume, 2)}
            {r.rbc.burst ? ` (over 1,6: sprekker)` : ''}
          </FormulaLine>
        ) : (
          <FormulaLine>Blodlegemet i rent vann tar opp vann til det sprekker.</FormulaLine>
        )}
        {r.plant.state === 'turgid' && (
          <FormulaLine>
            Turgortrykk ≈ (c<Sub>inne</Sub> − c<Sub>ute</Sub>) · R · T = ({fmt(oIn, 2)} − {fmt(oOut, 2)}) · 0,0831 · 293 ={' '}
            {fmt(r.plant.turgor, 1)} bar
          </FormulaLine>
        )}
      </Formula>

      <Explain>{cellText(c, r)}</Explain>
    </>
  );
}

function CellScene({ c, r, f }: { c: number; r: CellResult; f: number }) {
  const k = Math.max(1, f * 0.85);
  // På mobil står panelene under hverandre og cellene tegnes større
  const narrow = f > 1.3;
  const sc = narrow ? 1.7 : 1;
  const W = narrow ? 760 : 370;
  const PH = Math.round(250 * sc);
  const titleH = 24 * f + 14;
  const stateH = 26 * f + 14 * f;
  const block = titleH + PH + stateH;
  const panels = [
    { x: 20, y: 0, title: 'Rødt blodlegeme' },
    { x: narrow ? 20 : 410, y: narrow ? block + 10 : 0, title: 'Plantecelle' },
  ];
  const H = Math.round(narrow ? 2 * block + 10 : block);
  const solution = mixColor(BIO.vannFyll, BIO.opplost, Math.min(1, c / 4) * 0.3);
  const top = (i: number) => panels[i]!.y + titleH;
  // Blodlegemet
  const bx = panels[0]!.x + W / 2;
  const by = top(0) + PH / 2;
  const baseD = 104 * sc;
  const V = Math.min(r.rbc.volume, 1.6);
  const d = baseD * Math.cbrt(V);
  const rbcState = { hemolyse: 'Sprekker (hemolyse)', svulmer: 'Sveller', normal: 'Normal', skrumper: 'Skrumper' }[r.rbc.state];
  // Plantecellen
  const px = panels[1]!.x + W / 2;
  const py = top(1) + PH / 2;
  const pw = 250 * sc;
  const ph = 170 * sc;
  const pBox = { x: px - pw / 2, y: py - ph / 2, w: pw, h: ph };
  const s = r.plant.state === 'plasmolyse' ? Math.sqrt(r.plant.volume) : 1;
  const inner = cellInterior('plante', pBox, s);
  const plantState = { turgid: 'Spent (turgor)', slapp: 'Slapp', plasmolyse: 'Plasmolyse' }[r.plant.state];
  const label = `Rødt blodlegeme: ${rbcState.toLowerCase()}. Plantecelle: ${plantState.toLowerCase()}.`;
  const chW = (28 * s + 6) * sc;
  const chH = (12 * s + 3) * sc;

  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={narrow ? 1200 : H} label={`Celler i ${fmt(c, 2)} % saltløsning. ${label}`}>
      {panels.map((p, i) => (
        <g key={p.title}>
          <Txt x={p.x + 8} y={p.y + 24 * f} anchor="start" weight={650} size={0.95}>
            {p.title}
          </Txt>
          <rect x={p.x} y={top(i)} width={W} height={PH} rx={14} fill={solution} stroke={VIZ.grid} strokeWidth={1.5} />
        </g>
      ))}

      {/* Rødt blodlegeme */}
      <RodtBlodlegeme
        x={bx}
        y={by}
        size={d * (40 / 34)}
        swelling={Math.min(1, Math.max(0, (V - 1) / 0.6))}
        crenation={Math.min(1, Math.max(0, (1 - V) / 0.42))}
        burst={r.rbc.burst}
        title="Rødt blodlegeme"
      />
      {r.rbc.state !== 'normal' && (
        <circle cx={bx} cy={by} r={baseD / 2} fill="none" stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      )}
      <WaterArrows cx={bx} cy={by} r={Math.max(d, baseD) / 2 + 8} dir={r.water} k={k} />

      {/* Plantecelle */}
      <Celle type="plante" x={pBox.x} y={pBox.y} w={pw} h={ph} protoplast={s} ytre={solution} vakuole={0.6}>
        <Cellekjerne x={inner.x + inner.w * 0.13} y={inner.y + inner.h * 0.2} r={Math.min(16 * sc, inner.h * 0.13)} kromatin={false} />
        <Kloroplast x={inner.x + inner.w * 0.3} y={inner.y + inner.h * 0.085} w={chW} h={chH} grana={2} />
        <Kloroplast x={inner.x + inner.w * 0.91} y={inner.y + inner.h * 0.27} w={chW} h={chH} grana={2} rotate={90} />
        <Kloroplast x={inner.x + inner.w * 0.72} y={inner.y + inner.h * 0.915} w={chW} h={chH} grana={2} />
        <Kloroplast x={inner.x + inner.w * 0.09} y={inner.y + inner.h * 0.72} w={chW} h={chH} grana={2} rotate={90} />
      </Celle>
      {r.plant.state === 'turgid' &&
        [
          [px, pBox.y + 14 * sc, 0, -1],
          [px, pBox.y + ph - 14 * sc, 0, 1],
          [pBox.x + 14 * sc, py, -1, 0],
          [pBox.x + pw - 14 * sc, py, 1, 0],
        ].map(([x, y, dx, dy], i) => (
          <Arrow key={i} x1={x! - dx! * 22 * sc} y1={y! - dy! * 22 * sc} x2={x!} y2={y!} color={BIO.membran} width={2.5} head={8} />
        ))}
      <WaterArrows cx={px} cy={py} r={0} rect={{ w: pw / 2 + 10, h: ph / 2 + 10 }} dir={r.water} k={k} />

      <Txt x={bx} y={top(0) + PH + 26 * f} weight={700} color={r.rbc.burst ? BIO.rodtBlodlegeme.line : undefined}>
        {rbcState}
      </Txt>
      <Txt x={px} y={top(1) + PH + 26 * f} weight={700}>
        {plantState}
      </Txt>
    </Figure>
  );
}

/** Piler for netto vannstrøm inn i eller ut av en celle (fire retninger), eller like mye begge veier. */
function WaterArrows({
  cx,
  cy,
  r,
  rect,
  dir,
  k,
}: {
  cx: number;
  cy: number;
  r: number;
  rect?: { w: number; h: number };
  dir: CellResult['water'];
  k: number;
}) {
  const L = 26 * Math.min(1.3, k);
  const spots = rect
    ? [
        [cx - rect.w * 0.55, cy - rect.h, 0, -1],
        [cx + rect.w * 0.55, cy + rect.h, 0, 1],
        [cx - rect.w, cy + rect.h * 0.45, -1, 0],
        [cx + rect.w, cy - rect.h * 0.45, 1, 0],
      ]
    : [45, 135, 225, 315].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)];
      });
  return (
    <g>
      {spots.map(([x, y, ux, uy], i) => {
        const outer = { x: x! + ux! * L, y: y! + uy! * L };
        if (dir === 'ingen')
          return (
            <g key={i} opacity={0.75}>
              <Arrow
                x1={outer.x + uy! * 5}
                y1={outer.y - ux! * 5}
                x2={x! + uy! * 5}
                y2={y! - ux! * 5}
                color={BIO.vann}
                width={2}
                head={7}
              />
              <Arrow
                x1={x! - uy! * 5}
                y1={y! + ux! * 5}
                x2={outer.x - uy! * 5}
                y2={outer.y + ux! * 5}
                color={BIO.vann}
                width={2}
                head={7}
              />
            </g>
          );
        return dir === 'inn' ? (
          <Arrow key={i} x1={outer.x} y1={outer.y} x2={x!} y2={y!} color={BIO.vann} width={3.5} head={11} />
        ) : (
          <Arrow key={i} x1={x!} y1={y!} x2={outer.x} y2={outer.y} color={BIO.vann} width={3.5} head={11} />
        );
      })}
    </g>
  );
}

function cellText(c: number, r: CellResult): ReactNode {
  const misconception = (
    <p>
      Legg merke til at det er <strong>vannet</strong> som flytter seg gjennom membranen (gjennom akvaporiner), ikke saltet. Natrium- og
      kloridioner kommer bare sakte gjennom, så det er forskjellen i konsentrasjon av oppløste stoffer som bestemmer hvilken vei vannet går.
    </p>
  );
  if (r.tonicity === 'isoton')
    return (
      <>
        <p>
          <strong>Isoton løsning.</strong> Utenfor er konsentrasjonen av oppløste stoffer like stor som inne i cellene ({fmt(C_ISO, 1)} %
          NaCl, fysiologisk saltvann). Vannet går like mye inn som ut, så cellene beholder formen. Plantecellen er likevel <em>slapp</em>:
          den har ikke noe overtrykk mot celleveggen. Derfor visner planter som ikke får nok vann.
        </p>
        {misconception}
      </>
    );
  if (r.tonicity === 'hypoton')
    return (
      <>
        <p>
          <strong>Hypoton løsning</strong> ({fmt(c, 2)} % NaCl, lavere enn {fmt(C_ISO, 1)} % inne). Det er lavere konsentrasjon av oppløste
          stoffer ute enn inne, så netto strømmer vann <strong>inn</strong> i cellene ved osmose.
        </p>
        <p>
          {r.rbc.burst ? (
            <>
              Det røde blodlegemet har ingen cellevegg. Det sveller til membranen ikke tåler mer og <strong>sprekker</strong> (hemolyse),
              noe som skjer under ca. {fmt(lysisConcentration(), 2)} % NaCl.
            </>
          ) : (
            <>
              Det røde blodlegemet sveller og blir rundere, men tåler fortsatt trykket. Under ca. {fmt(lysisConcentration(), 2)} % NaCl
              sprekker det (hemolyse).
            </>
          )}{' '}
          Plantecellen sprekker ikke: celleveggen holder igjen, og det bygger seg opp et <strong>turgortrykk</strong> på ca.{' '}
          {fmt(r.plant.turgor, 1)} bar som gjør cellen spent og planten stiv.
        </p>
        {misconception}
      </>
    );
  return (
    <>
      <p>
        <strong>Hyperton løsning</strong> ({fmt(c, 2)} % NaCl, høyere enn {fmt(C_ISO, 1)} % inne). Det er høyere konsentrasjon av oppløste
        stoffer ute enn inne, så netto strømmer vann <strong>ut</strong> av cellene.
      </p>
      <p>
        Det røde blodlegemet skrumper og får en takkete overflate. I plantecellen krymper vakuolen og protoplasten, og cellemembranen
        slipper celleveggen: <strong>plasmolyse</strong>. Mellom celleveggen og membranen fylles det med saltløsning, fordi celleveggen
        slipper gjennom både vann og salt. Derfor tørker planter ut i saltvann.
      </p>
      {misconception}
    </>
  );
}
