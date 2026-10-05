import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Baereprotein,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  Golgiapparat,
  FormulaLine,
  Kanalprotein,
  Legend,
  Lysosom,
  Membran,
  MembranPartikler,
  NaKPumpe,
  PlayBar,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  crossingCounts,
  fmt,
  fmtCount,
  fmtPct,
  hash32,
  jiggle,
  linePath,
  mixColor,
  niceTicks,
  placeParticles,
  planCrossings,
  proteinSlot,
  sample,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  type CrossingGeometry,
  type Track,
} from '../kit';
import {
  GLUT,
  ION,
  K_CHANNEL,
  MT_BASE_RATE,
  MT_PARTICLES_PER_MMOL,
  MT_T_MAX,
  PUMP_STEPS,
  SUBSTANCES,
  VESICLE_PHASES,
  carrierFlux,
  carrierNetMax,
  carrierOccupancy,
  carrierVmax,
  channelFlux,
  endocytosisShape,
  pumpPerCycle,
  pumpSteadyState,
  vesicleArea,
  vesiclePhase,
  type Substance,
  type VesicleKind,
} from './model';

type Mode = 'passiv' | 'fasilitert' | 'aktiv' | 'vesikler';

const MODES: { value: Mode; label: string }[] = [
  { value: 'passiv', label: 'Lipidlaget' },
  { value: 'fasilitert', label: 'Fasilitert diffusjon' },
  { value: 'aktiv', label: 'Aktiv transport' },
  { value: 'vesikler', label: 'Vesikler' },
];

export default function Membrantransport() {
  const [mode, setMode] = useState<Mode>('passiv');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg transportmåte" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'passiv' ? <Passiv /> : mode === 'fasilitert' ? <Fasilitert /> : mode === 'aktiv' ? <Aktiv /> : <Vesikler />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Felles: vannrett membran med utsiden over og cytoplasmaet under          */
/* ====================================================================== */

const X0 = 20;
const X1 = 780;

interface SceneGeom {
  f: number;
  k: number;
  narrow: boolean;
  /** Membranens midtlinje og tykkelse. */
  memY: number;
  T: number;
  /** Rommet over (utsiden) og under (cytoplasma). */
  top: number;
  bottom: number;
  H: number;
}

function sceneGeom(f: number, roomH = 150, thickness = 44): SceneGeom {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const T = Math.round(thickness * (narrow ? 1.25 : 1));
  const top = 30 * f + 10;
  const room = Math.round(roomH * (narrow ? 2.1 : 1));
  const memY = top + room + T / 2;
  const bottom = memY + T / 2 + room;
  return { f, k, narrow, memY, T, top, bottom, H: Math.round(bottom + 12) };
}

/** Fyll og overskrifter for utsiden og cytoplasmaet. */
function Rooms({ g, outside = 'Utsiden (vevsvæske)', right }: { g: SceneGeom; outside?: string; right?: { top?: ReactNode; bottom?: ReactNode } }) {
  const { f, memY, T, top, bottom } = g;
  return (
    <g>
      <rect x={X0} y={top} width={X1 - X0} height={memY - top} fill={BIO.vannFyll} rx={12} />
      <rect x={X0} y={memY} width={X1 - X0} height={bottom - memY} fill={BIO.cytoplasma} rx={12} />
      <Txt x={X0 + 4} y={22 * f} anchor="start" size={0.85} muted>
        {outside}
      </Txt>
      {right?.top && (
        <Txt x={X1 - 4} y={22 * f} anchor="end" size={0.85} weight={700}>
          {right.top}
        </Txt>
      )}
      <Txt x={X0 + 10} y={bottom - 12} anchor="start" size={0.85} muted>
        Cytoplasma (inne i cellen)
      </Txt>
      {right?.bottom && (
        <Txt x={X1 - 10} y={bottom - 12} anchor="end" size={0.85} weight={700}>
          {right.bottom}
        </Txt>
      )}
      <line x1={X0} x2={X1} y1={memY - T / 2 - 1} y2={memY - T / 2 - 1} stroke={BIO.membran} strokeWidth={0.8} opacity={0.4} />
    </g>
  );
}

/** Geometrien partiklene vandrer i (kit-ets transport.ts): A = utsiden, B = cytoplasma. */
function crossingGeom(g: SceneGeom, r: number, gates?: number[], labelPad = 0): CrossingGeometry {
  const { memY, T, top, bottom, f } = g;
  const padTop = 30 * f;
  return {
    a: { x: X0 + 6, y: top + 6 + labelPad, w: X1 - X0 - 12, h: memY - T / 2 - top - 10 - labelPad },
    b: { x: X0 + 6, y: memY + T / 2 + 4, w: X1 - X0 - 12, h: bottom - memY - T / 2 - 8 - padTop },
    orientation: 'horizontal',
    at: memY,
    thickness: T,
    gates,
    r,
    speed: 70,
  };
}

/* ====================================================================== */
/* 1. Gjennom lipidlaget                                                    */
/* ====================================================================== */

const SUB_ORDER: Substance[] = ['O2', 'CO2', 'steroid', 'vann', 'glukose', 'Na'];
const SUB_COLOR: Record<Substance, string> = {
  O2: BIO.oksygenrikt,
  CO2: BIO.oksygenfattig,
  steroid: BIO.signal,
  vann: BIO.vann,
  glukose: BIO.sukker,
  Na: BIO.natrium,
};
/** Typiske startverdier: cellen bruker O₂ og lager CO₂. */
const SUB_START: Record<Substance, [number, number]> = {
  O2: [16, 4],
  CO2: [4, 16],
  steroid: [12, 2],
  vann: [16, 4],
  glukose: [16, 4],
  Na: [16, 4],
};

/** Etiketter til de tynne linjene ved venstre kant (der de er lengst fra hverandre og fra det valgte stoffet). */
function otherLabels(sub: Substance): { text: string; y: number; dy: number; color: string }[] {
  const out: { text: string; y: number; dy: number; color: string }[] = [];
  const slopes = SUB_ORDER.filter((s) => s !== sub && SUBSTANCES[s].rel > 0.3);
  // De bratte linjene: etikett over linja ved x = −19,5
  slopes.forEach((s) => out.push({ text: subLabel(s), y: SUBSTANCES[s].rel * 19.5, dy: -8, color: SUB_COLOR[s] }));
  const flat = SUB_ORDER.filter((s) => s !== sub && SUBSTANCES[s].rel <= 0.3).map(subLabel);
  if (flat.length) out.push({ text: flat.join(', '), y: 0, dy: -10, color: VIZ.muted });
  return out;
}

/** Kort navn i knapper og figurer: formel for små molekyler, navn for de store. */
function subLabel(s: Substance): string {
  return s === 'glukose' ? 'Glukose' : s === 'steroid' ? 'Kortisol' : SUBSTANCES[s].formel;
}

function Passiv() {
  const [sub, setSub] = useState<Substance>('O2');
  const [cOut, setCOut] = useState(16);
  const [cIn, setCIn] = useState(4);
  const clock = useSimClock({ tMax: MT_T_MAX, speed: 1.5 });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const info = SUBSTANCES[sub];
  const rate = MT_BASE_RATE * info.rel;
  const tracks = useMemo(
    () =>
      planCrossings({
        n: [Math.round(cOut * MT_PARTICLES_PER_MMOL), Math.round(cIn * MT_PARTICLES_PER_MMOL)],
        rates: [rate, rate],
        tMax: MT_T_MAX,
        seed: 21,
        transit: 0.6,
      }),
    [cOut, cIn, rate],
  );
  const t = clock.t;
  const [inn, ut] = crossingCounts(tracks, t);
  const reset = clock.reset;
  const change = (fn: () => void) => {
    reset();
    fn();
  };
  const plotH = Math.round(300 + 240 * (f - 1));
  const color = SUB_COLOR[sub];

  return (
    <>
      <Toolbar>
        <Forvalg
          label="Stoff"
          options={SUB_ORDER.map((s) => ({ value: s, label: subLabel(s), detail: SUBSTANCES[s].passasje }))}
          value={sub}
          onPick={(s) =>
            change(() => {
              setSub(s);
              setCOut(SUB_START[s][0]);
              setCIn(SUB_START[s][1]);
            })
          }
        />
      </Toolbar>
      <Controls>
        <Slider label="Konsentrasjon ute" value={cOut} onChange={(v) => change(() => setCOut(v))} min={0} max={20} step={1} unit="mmol/L" />
        <Slider label="Konsentrasjon inne" value={cIn} onChange={(v) => change(() => setCIn(v))} min={0} max={20} step={1} unit="mmol/L" />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <PassiveScene tracks={tracks} t={t} f={f} color={color} label={subLabel(sub)} blocked={info.rel === 0} hex={sub === 'glukose'} />
      </div>
      <Legend
        items={[
          { color, label: `${info.navn} (${info.slag})` },
          { color: BIO.membran, label: 'Lipiddobbeltlag uten transportproteiner' },
        ]}
      />

      <Figure viewBox={`0 0 800 ${plotH}`} label={`Netto transport inn i cellen mot konsentrasjonsforskjellen for ${info.navn.toLowerCase()} og andre stoffer.`}>
        <Plot
          x={{ min: -20, max: 20, label: 'Forskjell ute − inne (mmol/L)' }}
          y={{ min: -20, max: 20, label: 'Netto inn (relativ fart)' }}
          width={800}
          height={plotH}
        >
          {({ sx, sy }) => (
            <g>
              {SUB_ORDER.filter((s) => s !== sub).map((s) => (
                <path
                  key={s}
                  d={linePath(sample((x) => SUBSTANCES[s].rel * x, -20, 20, 2), sx, sy)}
                  fill="none"
                  stroke={SUB_COLOR[s]}
                  strokeWidth={1.5}
                  opacity={0.45}
                />
              ))}
              {otherLabels(sub).map((l) => (
                <Txt key={l.text} x={sx(-19.5)} y={sy(-l.y) + l.dy} anchor="start" size={0.7} color={l.color}>
                  {l.text}
                </Txt>
              ))}
              <path d={linePath(sample((x) => info.rel * x, -20, 20, 2), sx, sy)} fill="none" stroke={color} strokeWidth={3.5} />
              <circle cx={sx(cOut - cIn)} cy={sy(info.rel * (cOut - cIn))} r={7} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />
              <Txt x={sx(15)} y={sy(info.rel * 15) - 12} anchor="end" size={0.8} color={color} weight={700}>
                {subLabel(sub)}
              </Txt>
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color, label: 'Valgt stoff' },
          { color: VIZ.muted, label: 'Tynne linjer: de andre stoffene' },
        ]}
      />

      <Readouts>
        <Readout label="Går gjennom lipidlaget" value={info.passasje.charAt(0).toUpperCase() + info.passasje.slice(1)} tone={color} />
        <Readout label="Krysset inn" value={String(inn)} unit={inn === 1 ? 'partikkel' : 'partikler'} />
        <Readout label="Krysset ut" value={String(ut)} unit={ut === 1 ? 'partikkel' : 'partikler'} />
      </Readouts>

      <Explain>{passiveText(sub, cOut, cIn, t, inn, ut)}</Explain>
    </>
  );
}

function PassiveScene({
  tracks,
  t,
  f,
  color,
  label,
  blocked,
  hex,
}: {
  tracks: readonly Track[];
  t: number;
  f: number;
  color: string;
  label: string;
  blocked: boolean;
  hex?: boolean;
}) {
  const g = sceneGeom(f, 120);
  const geom = crossingGeom(g, 6 * g.k, undefined, 0);
  const counts = useMemo(() => tracks.length, [tracks]);
  return (
    <Figure
      viewBox={`0 0 800 ${g.H}`}
      maxHeight={g.H}
      label={`Membran med ${counts} partikler av ${label}. ${blocked ? 'De kommer ikke gjennom lipidlaget.' : 'De diffunderer gjennom lipidlaget.'}`}
      caption="Hver prikk er mange molekyler. Tidsskalaen er forenklet."
    >
      <Rooms g={g} />
      <Membran x={400} y={g.memY} length={X1 - X0} thickness={g.T} />
      <MembranPartikler
        tracks={tracks}
        t={t}
        geometry={geom}
        fill={color}
        render={hex ? (q) => <Glukose x={q.x} y={q.y} r={q.r * 1.25} /> : undefined}
      />
      {blocked && (
        <Txt x={400} y={g.memY - g.T / 2 - 12} size={0.8} weight={700} color={color}>
          Kommer ikke gjennom lipidlaget
        </Txt>
      )}
    </Figure>
  );
}

function passiveText(sub: Substance, cOut: number, cIn: number, t: number, inn: number, ut: number): ReactNode {
  const info = SUBSTANCES[sub];
  const name = subLabel(sub);
  /** Navnet inne i en setning: «kortisol», «glukose», men O₂ og Na⁺ som før. */
  const inline = sub === 'glukose' || sub === 'steroid' ? name.toLowerCase() : name;
  if (info.rel === 0)
    return (
      <>
        <p>
          <strong>{name} kommer ikke gjennom lipidlaget</strong>, selv om det er {cOut > cIn ? 'mer ute enn inne' : cOut < cIn ? 'mer inne enn ute' : 'like mye på begge sider'}.{' '}
          {sub === 'Na'
            ? 'Ioner har ladning og er omgitt av vannmolekyler, så de stenges ute av den fettløselige (hydrofobe) midten av membranen.'
            : 'Glukose er et stort, polart molekyl som ikke løser seg i den fettløselige (hydrofobe) midten av membranen.'}
        </p>
        <p>
          Cellen slipper slike stoffer inn og ut gjennom transportproteiner: kanalproteiner og bæreproteiner (fasilitert diffusjon) eller
          pumper (aktiv transport). Velg «Fasilitert diffusjon» for å se hvordan glukose kommer inn.
        </p>
      </>
    );
  const dir = cOut > cIn ? 'inn i cellen' : cOut < cIn ? 'ut av cellen' : null;
  if (cOut + cIn === 0)
    return (
      <p>
        Det er ingen {inline}-molekyler på noen av sidene. Flytt glidebryterne for å legge til {inline} ute eller inne. {name} er et{' '}
        {info.slag} og går {info.passasje} gjennom lipidlaget.
      </p>
    );
  return (
    <>
      <p>
        <strong>
          {name} er et {info.slag}
        </strong>{' '}
        og {info.passasje === 'lett' ? 'løser seg i lipidlaget og diffunderer lett rett gjennom det' : 'kommer sakte gjennom lipidlaget'}.{' '}
        {dir === null
          ? 'Konsentrasjonene er like, så like mange krysser hver vei: ingen netto transport.'
          : `Netto transport går ${dir}, fra høy til lav konsentrasjon. Farten er proporsjonal med konsentrasjonsforskjellen: dobbel forskjell gir dobbel fart (rett linje i grafen).`}
      </p>
      {t > 0.05 && dir !== null && (
        <p>
          Så langt har {inn} krysset inn og {ut} krysset ut. Partiklene krysser begge veier, men flest fra siden med høyest konsentrasjon.
        </p>
      )}
      {sub === 'O2' && <p>I kroppen bruker cellene O₂ i celleåndingen, så det er mindre O₂ inne enn ute, og O₂ diffunderer inn.</p>}
      {sub === 'CO2' && <p>I kroppen lager cellene CO₂ i celleåndingen, så det er mer CO₂ inne enn ute, og CO₂ diffunderer ut.</p>}
      {sub === 'steroid' && (
        <p>Steroidhormoner som kortisol og østrogen er laget av kolesterol og er fettløselige. Derfor kan de gå rett inn i cellen og virke på en reseptor inne i den.</p>
      )}
      {sub === 'vann' && <p>Vann er lite, men polart, så det går sakte gjennom lipidlaget. Det meste av vannet går gjennom vannkanaler (akvaporiner) ved osmose.</p>}
      <p>Dette er passiv transport: cellen bruker ingen energi, og partiklene beveger seg tilfeldig.</p>
    </>
  );
}

/* ====================================================================== */
/* 2. Fasilitert diffusjon                                                  */
/* ====================================================================== */

type FacKind = 'baerer' | 'kanal';

function Fasilitert() {
  const [kind, setKind] = useState<FacKind>('baerer');
  return (
    <>
      <Toolbar>
        <Segmented
          label="Velg protein"
          options={[
            { value: 'baerer', label: 'Bæreprotein (glukose)' },
            { value: 'kanal', label: 'Kanalprotein (K⁺)' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </Toolbar>
      {kind === 'baerer' ? <Baerer /> : <Kanal />}
    </>
  );
}

/** Ett bæreprotein: en runde tar CARRIER_PERIOD sekunder i figuren (i virkeligheten ca. 1 ms). */
const CARRIER_PERIOD = 2.4;
const CARRIER_T_MAX = 60;

interface CarrierTrip {
  /** Glukose fraktes inn (fra utsiden) eller ut (fra innsiden) i denne runden. */
  inn: boolean;
  ut: boolean;
}

/** Tilfeldig (men fast) om bæreprotein i har med seg glukose i runde k. */
function carrierTrip(i: number, k: number, pOut: number, pIn: number): CarrierTrip {
  const a = seededRandom(hash32(i, k, 31))();
  const b = seededRandom(hash32(i, k, 57))();
  return { inn: a < pOut, ut: b < pIn };
}

/** Formen (0 = åpen ut, 1 = åpen inn) i andelen u av en runde. */
function carrierState(u: number): number {
  if (u < 0.3) return 0;
  if (u < 0.5) return smooth((u - 0.3) / 0.2);
  if (u < 0.8) return 1;
  return 1 - smooth((u - 0.8) / 0.2);
}

const smooth = (u: number) => {
  const v = Math.min(1, Math.max(0, u));
  return v * v * (3 - 2 * v);
};

/** Hvor mange glukose som er fraktet inn og ut av n bæreproteiner fram til t. */
function carrierCounts(n: number, t: number, pOut: number, pIn: number): [number, number] {
  let inn = 0;
  let ut = 0;
  for (let i = 0; i < n; i++) {
    const off = i * 0.37 * CARRIER_PERIOD;
    const span = t + off;
    const full = Math.floor(span / CARRIER_PERIOD);
    for (let k = 0; k <= full; k++) {
      const u = k < full ? 1 : (span - k * CARRIER_PERIOD) / CARRIER_PERIOD;
      // Runder som startet før t = 0, teller ikke
      if ((k * CARRIER_PERIOD - off) < 0) continue;
      const trip = carrierTrip(i, k, pOut, pIn);
      if (trip.inn && u >= 0.5) inn++;
      if (trip.ut && u >= 1) ut++;
    }
  }
  return [inn, ut];
}

function Baerer() {
  const [cOut, setCOut] = useState(5);
  const [cIn, setCIn] = useState(0.5);
  const [n, setN] = useState(3);
  const clock = useSimClock({ tMax: CARRIER_T_MAX, speed: 1 });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const J = carrierFlux(cOut, cIn, n);
  // Nettoen flater ut under n · kcat når det er glukose inne (noen bæreproteiner frakter glukose ut igjen)
  const netMax = carrierNetMax(cIn, n);
  const occ = carrierOccupancy(cOut);
  const t = clock.t;
  const [inn, ut] = carrierCounts(n, t, carrierOccupancy(cOut), carrierOccupancy(cIn));
  const plotH = Math.round(300 + 240 * (f - 1));
  const yMax = 5000;
  // Mye glukose inne gir netto transport ut (negativ): aksen må gå langt nok ned
  const yMin = -1000 * Math.max(1, Math.ceil((-carrierFlux(0, cIn, n) * 1.05) / 1000));
  const yTicks = yMin < -2000 ? niceTicks(yMin, yMax, 6) : [-1000, 0, 1000, 2000, 3000, 4000, 5000];
  // Tangenten der kurven krysser null (c_ute = c_inne): slik ville farten økt uten metning
  const slope = (n * GLUT.kcat * GLUT.Km) / (cIn + GLUT.Km) ** 2;
  const xEnd = Math.min(20, cIn + (yMax - 200) / slope);

  return (
    <>
      <Controls>
        <Slider label="Glukose ute" value={cOut} onChange={setCOut} min={0} max={20} step={0.5} unit="mmol/L" decimals={1} />
        <Slider label="Glukose inne" value={cIn} onChange={setCIn} min={0} max={20} step={0.5} unit="mmol/L" decimals={1} />
        <Slider label="Antall bæreproteiner" value={n} onChange={setN} min={1} max={5} step={1} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>

      <div ref={ref}>
        <CarrierScene n={n} cOut={cOut} cIn={cIn} t={t} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.sukker, label: 'Glukose' },
          { color: BIO.protein.line, label: 'Bæreprotein (glukosetransportør)' },
        ]}
      />

      <Figure viewBox={`0 0 800 ${plotH}`} label={`Netto glukose inn per sekund mot glukose ute, med ${n} bæreproteiner. Nå ${fmtCount(J)} per sekund.`}>
        <Plot
          x={{ min: 0, max: 20, label: 'Glukose ute (mmol/L)' }}
          y={{ min: yMin, max: yMax, label: 'Netto inn (molekyler per s)', ticks: yTicks }}
          width={800}
          height={plotH}
          margin={{ top: 20 * f, right: 24 * f, bottom: 56 * f, left: 92 * f }}
        >
          {({ sx, sy, x0, x1, y0, y1 }) => (
            <g>
              <rect x={sx(4)} y={y1} width={sx(6) - sx(4)} height={y0 - y1} fill={BIO.sukker} opacity={0.1} />
              <Txt x={(sx(4) + sx(6)) / 2} y={y0 - 8} size={0.72} muted>
                Normalt blodsukker
              </Txt>
              <line x1={x0} x2={x1} y1={sy(netMax)} y2={sy(netMax)} stroke={BIO.protein.line} strokeWidth={1.6} strokeDasharray="6 5" />
              <Txt x={x1 - 6} y={sy(netMax) - 8} anchor="end" size={0.75} color={BIO.protein.line} weight={650}>
                Metning: alle bæreproteinene er opptatt
              </Txt>
              <path
                d={linePath(
                  sample((x) => slope * (x - cIn), Math.max(0, cIn + yMin / slope), xEnd, 2),
                  sx,
                  sy,
                )}
                fill="none"
                stroke={VIZ.muted}
                strokeWidth={1.6}
                strokeDasharray="4 4"
              />
              <path d={linePath(sample((x) => carrierFlux(x, cIn, n), 0, 20, 160), sx, sy)} fill="none" stroke={BIO.sukker} strokeWidth={3.5} />
              <line x1={x0} x2={x1} y1={sy(0)} y2={sy(0)} stroke={VIZ.muted} strokeWidth={1.2} />
              <circle cx={sx(cOut)} cy={sy(J)} r={7} fill={BIO.sukker} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: BIO.sukker, label: 'Bæreproteiner (mettes)' },
          { color: VIZ.muted, label: 'Uten metning (rett linje)', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Netto glukose inn" value={fmtCount(J)} unit="per s" tone={BIO.sukker} />
        <Readout label="Bæreproteinene opptatt" value={fmtPct(occ)} />
        <Readout label="Største netto fart (metning)" value={fmtCount(netMax)} unit="per s" />
        <Readout label="Fraktet inn / ut i figuren" value={`${inn} / ${ut}`} />
      </Readouts>

      <Formula label="Fart gjennom bæreproteiner">
        <FormulaLine>
          Opptatt fra utsiden: c/(c + K<Sub>m</Sub>) = {fmt(cOut, 1)}/({fmt(cOut, 1)} + {GLUT.Km}) = {fmtPct(occ)}
        </FormulaLine>
        <FormulaLine>
          Opptatt fra innsiden: {fmt(cIn, 1)}/({fmt(cIn, 1)} + {GLUT.Km}) = {fmtPct(carrierOccupancy(cIn))}
        </FormulaLine>
        <FormulaLine>
          Netto inn = {n} · {fmtCount(GLUT.kcat)} per s · ({fmtPct(occ)} − {fmtPct(carrierOccupancy(cIn))}) = {fmtCount(J)} molekyler per s
        </FormulaLine>
      </Formula>

      <Explain>{carrierText(cOut, cIn, n, J, occ, netMax)}</Explain>
    </>
  );
}

function CarrierScene({ n, cOut, cIn, t, f }: { n: number; cOut: number; cIn: number; t: number; f: number }) {
  const g = sceneGeom(f, 120);
  const { memY, T, k } = g;
  const xs = Array.from({ length: n }, (_, i) => X0 + ((X1 - X0) * (i + 0.5)) / n);
  const r = 8 * k;
  const pOut = carrierOccupancy(cOut);
  const pIn = carrierOccupancy(cIn);
  // Glukose som ligger i løsningen (fast antall etter konsentrasjonen, dirrer litt)
  const outside = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 600 }, [{ n: Math.round(cOut * 1.6), r: 24 }], 5, 8), [cOut]);
  const inside = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 600 }, [{ n: Math.round(cIn * 1.6), r: 24 }], 9, 8), [cIn]);
  const aBox = { x: X0 + 10, y: g.top + 10, w: X1 - X0 - 20, h: memY - T / 2 - g.top - 26 };
  const bBox = { x: X0 + 10, y: memY + T / 2 + 18, w: X1 - X0 - 20, h: g.bottom - memY - T / 2 - 34 - 26 * f };
  const toBox = (p: { x: number; y: number }, box: typeof aBox) => ({ x: box.x + (box.w * p.x) / 1000, y: box.y + (box.h * p.y) / 600 });
  const moving: ReactNode[] = [];
  const carriers = xs.map((x, i) => {
    const off = i * 0.37 * CARRIER_PERIOD;
    const span = t + off;
    const kc = Math.floor(span / CARRIER_PERIOD);
    const u = span / CARRIER_PERIOD - kc;
    const state = carrierState(u);
    const trip = carrierTrip(i, kc, pOut, pIn);
    const above = memY - T - 26;
    const below = memY + T + 26;
    const siteOut = memY - T * 0.22;
    const siteIn = memY + T * 0.22;
    if (trip.inn) {
      let y: number;
      let op = 1;
      if (u < 0.3) y = above + (siteOut - above) * smooth(u / 0.25);
      else if (u < 0.5) y = siteOut + (siteIn - siteOut) * smooth((u - 0.3) / 0.2);
      else {
        const v = (u - 0.5) / 0.5;
        y = siteIn + (below + 30 - siteIn) * smooth(v);
        op = 1 - smooth((v - 0.4) / 0.6);
      }
      moving.push(<Glukose key={`i${i}`} x={x} y={y} r={r} opacity={op} />);
    }
    if (trip.ut && u >= 0.5) {
      let y: number;
      let op = 1;
      if (u < 0.8) y = below + (siteIn - below) * smooth((u - 0.5) / 0.25);
      else {
        const v = (u - 0.8) / 0.2;
        y = siteIn + (above - 20 - siteIn) * smooth(v);
        op = 1 - smooth((v - 0.6) / 0.4);
      }
      moving.push(<Glukose key={`o${i}`} x={x + 4} y={y} r={r} opacity={op} />);
    }
    return { x, state };
  });
  return (
    <Figure
      viewBox={`0 0 800 ${g.H}`}
      maxHeight={g.H}
      label={`Membran med ${n} bæreproteiner for glukose. ${fmt(cOut, 1)} mmol/L glukose ute og ${fmt(cIn, 1)} inne.`}
      caption="Hvert bæreprotein skifter mellom å være åpent ut og åpent inn. Her tar én runde over 2 s, i virkeligheten ca. 1 ms."
    >
      <Rooms g={g} right={{ top: `${fmt(cOut, 1)} mmol/L`, bottom: `${fmt(cIn, 1)} mmol/L` }} />
      {outside.map((p, i) => {
        const q = toBox(jiggle(p, t, 12), aBox);
        return <Glukose key={`a${i}`} x={q.x} y={q.y} r={r} />;
      })}
      {inside.map((p, i) => {
        const q = toBox(jiggle(p, t, 12), bBox);
        return <Glukose key={`b${i}`} x={q.x} y={q.y} r={r} />;
      })}
      <Membran x={400} y={memY} length={X1 - X0} thickness={T} skip={xs.map((x) => proteinSlot(x, 'baerer', T))} />
      {carriers.map((c, i) => (
        <Baereprotein key={i} x={c.x} y={memY} thickness={T} state={c.state} />
      ))}
      {moving}
    </Figure>
  );
}

/** Glukose som en liten sekskant (ringformet molekyl). */
function Glukose({ x, y, r, opacity = 1 }: { x: number; y: number; r: number; opacity?: number }) {
  if (opacity <= 0.01) return null;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={BIO.sukker} stroke={VIZ.surface} strokeWidth={1.2} opacity={opacity} />;
}

function carrierText(cOut: number, cIn: number, n: number, J: number, occ: number, netMax: number): ReactNode {
  const passive = (
    <p>
      Fasilitert diffusjon er passiv transport: bæreproteinene bruker ingen energi og frakter glukose begge veier. Det er
      konsentrasjonsforskjellen som bestemmer netto retning. Inne i cellen blir glukose raskt brukt eller omdannet, så konsentrasjonen inne
      holder seg lav og glukose fortsetter å strømme inn.
    </p>
  );
  if (Math.abs(cOut - cIn) < 1e-9)
    return (
      <>
        <p>
          <strong>Like konsentrasjoner.</strong> Bæreproteinene frakter like mye glukose inn som ut, så netto transport er null, selv om
          proteinene arbeider hele tida.
        </p>
        {passive}
      </>
    );
  if (cOut < cIn)
    return (
      <>
        <p>
          <strong>Mer glukose inne enn ute</strong>, så netto transport går ut av cellen ({fmtCount(-J)} per s). Slik gir levercellene fra
          seg glukose til blodet når blodsukkeret er lavt.
        </p>
        {passive}
      </>
    );
  const sat = occ > 0.75;
  return (
    <>
      <p>
        {sat ? (
          <>
            <strong>Nesten mettet.</strong> {fmtPct(occ)} av bæreproteinene har bundet glukose fra utsiden, så mer glukose ute gir bare litt
            raskere transport. Kurven flater ut mot {fmtCount(netMax)} molekyler per s: alle bæreproteinene er opptatt (metning)
            {cIn > 0 ? `, og noen av dem frakter glukose ut igjen, så nettoen blir litt mindre enn ${fmtCount(carrierVmax(n))}` : ''}. Bare
            flere bæreproteiner kan øke farten.
          </>
        ) : (
          <>
            <strong>Glukose går inn gjennom bæreproteinene</strong>, {fmtCount(J)} molekyler per s. Glukose er for stort og polart til å gå
            gjennom lipidlaget. Et bæreprotein binder ett glukosemolekyl og skifter form, så glukosen slippes ut på den andre siden. Ved lav
            konsentrasjon øker farten nesten proporsjonalt, men kurven flater ut fordi det er et begrenset antall bæreproteiner (metning).
          </>
        )}
      </p>
      {passive}
      <p>Insulin får muskel- og fettceller til å sette flere glukosetransportører i membranen. Prøv å øke antallet bæreproteiner.</p>
    </>
  );
}

/* ---------- Kanalprotein ---------- */

const K_PER_PARTICLE = 6;

function Kanal() {
  const [kIn, setKIn] = useState<number>(ION.kIn);
  const [kOut, setKOut] = useState<number>(ION.kOut);
  const [n, setN] = useState(2);
  const [open, setOpen] = useState(true);
  const clock = useSimClock({ tMax: MT_T_MAX, speed: 1.5 });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const rate = open ? 0.05 : 0;
  const tracks = useMemo(
    () =>
      planCrossings({
        n: [Math.round(kOut / K_PER_PARTICLE), Math.round(kIn / K_PER_PARTICLE)],
        rates: [rate, rate],
        tMax: MT_T_MAX,
        seed: 33,
        gates: n,
        transit: 0.5,
      }),
    [kIn, kOut, n, rate],
  );
  const t = clock.t;
  const [inn, ut] = crossingCounts(tracks, t);
  const J = open ? channelFlux(kIn, kOut, n) : 0;
  const reset = clock.reset;
  const change = (fn: () => void) => {
    reset();
    fn();
  };
  const plotH = Math.round(300 + 240 * (f - 1));

  return (
    <>
      <Controls>
        <Slider label="K⁺ inne" value={kIn} onChange={(v) => change(() => setKIn(v))} min={0} max={150} step={2} unit="mmol/L" ariaLabel="Kalium inne" />
        <Slider label="K⁺ ute" value={kOut} onChange={(v) => change(() => setKOut(v))} min={0} max={150} step={2} unit="mmol/L" ariaLabel="Kalium ute" />
        <Slider label="Antall kanaler" value={n} onChange={(v) => change(() => setN(v))} min={1} max={3} step={1} />
      </Controls>
      <Toolbar>
        <PlayControls clock={clock} decimals={1} />
        <Toggle label="Kanalene er åpne" checked={open} onChange={(v) => change(() => setOpen(v))} />
      </Toolbar>

      <div ref={ref}>
        <ChannelScene tracks={tracks} t={t} f={f} n={n} open={open} kIn={kIn} kOut={kOut} />
      </div>
      <Legend
        items={[
          { color: BIO.kalium, label: 'K⁺ (hver prikk er mange ioner)' },
          { color: BIO.protein.line, label: 'Kanalprotein for K⁺' },
        ]}
      />

      <Figure viewBox={`0 0 800 ${plotH}`} label={`Netto K⁺ ut per sekund mot konsentrasjonsforskjellen. Nå ${fmt(J / 1e6, 1)} millioner per sekund.`}>
        <Plot
          x={{ min: -150, max: 150, label: 'K⁺ inne − K⁺ ute (mmol/L)' }}
          y={{ min: -50, max: 50, label: 'Netto ut (millioner ioner/s)', ticks: [-50, -25, 0, 25, 50] }}
          width={800}
          height={plotH}
        >
          {({ sx, sy }) => (
            <g>
              <path
                d={linePath(sample((x) => (open ? channelFlux(x, 0, n) / 1e6 : 0), -150, 150, 2), sx, sy)}
                fill="none"
                stroke={BIO.kalium}
                strokeWidth={3.5}
              />
              <circle cx={sx(kIn - kOut)} cy={sy(J / 1e6)} r={7} fill={BIO.kalium} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>

      <Readouts>
        <Readout label="Netto ut per sekund" value={fmt(J / 1e6, 1)} unit="mill. ioner" tone={BIO.kalium} />
        <Readout label="Per kanal per sekund" value={fmt(open ? channelFlux(kIn, kOut, 1) / 1e6 : 0, 1)} unit="mill. ioner" />
        <Readout label="Krysset ut / inn i figuren" value={`${ut} / ${inn}`} />
      </Readouts>

      <Formula label="Fart gjennom kanaler">
        <FormulaLine>
          Netto ut = n · g · (c<Sub>inne</Sub> − c<Sub>ute</Sub>) = {n} · {fmtCount(K_CHANNEL.g)} · ({fmt(kIn, 0)} − {fmt(kOut, 0)}) ={' '}
          {fmt(J / 1e6, 1)} millioner per s
        </FormulaLine>
      </Formula>

      <Explain>
        {!open ? (
          <p>
            <strong>Kanalene er lukket.</strong> Ingen K⁺ kommer gjennom, uansett konsentrasjonsforskjell. Mange kanaler har en «port» som
            åpnes og lukkes av et signal, for eksempel en endring i spenningen over membranen (nerveimpulser) eller et signalstoff.
          </p>
        ) : kIn === kOut ? (
          <p>
            <strong>Like konsentrasjoner.</strong> Ionene går gjennom kanalene begge veier, men like mange hver vei: ingen netto transport.
          </p>
        ) : (
          <p>
            <strong>
              K⁺ strømmer {kIn > kOut ? 'ut' : 'inn'} gjennom kanalene
            </strong>
            , fra høy til lav konsentrasjon. En åpen kanal slipper gjennom millioner av ioner per sekund, tusenvis av ganger mer enn et
            bæreprotein, og farten øker rett proporsjonalt med forskjellen (ingen metning i grafen). Kanalen er spesifikk: K⁺-kanalen slipper
            gjennom K⁺, men ikke Na⁺.
          </p>
        )}
        <p>
          I en vanlig celle er det ca. {ION.kIn} mmol/L K⁺ inne og {ION.kOut} mmol/L ute. Det er natrium-kalium-pumpa (aktiv transport) som
          holder denne forskjellen ved like. Modellen tar bare med konsentrasjonsforskjellen. I en levende celle er innsiden negativ, og den
          negative ladningen holder igjen på de positive K⁺-ionene, så det strømmer mye færre K⁺ ut enn tallene her viser.
        </p>
      </Explain>
    </>
  );
}

function ChannelScene({ tracks, t, f, n, open, kIn, kOut }: { tracks: readonly Track[]; t: number; f: number; n: number; open: boolean; kIn: number; kOut: number }) {
  const g = sceneGeom(f, 120);
  const gates = Array.from({ length: n }, (_, i) => X0 + ((X1 - X0) * (i + 0.5)) / n);
  const geom = crossingGeom(g, 5.5 * g.k, gates, 0);
  return (
    <Figure
      viewBox={`0 0 800 ${g.H}`}
      maxHeight={g.H}
      label={`Membran med ${n} kanalproteiner for K⁺, ${open ? 'åpne' : 'lukket'}. ${fmt(kIn, 0)} mmol/L inne og ${fmt(kOut, 0)} mmol/L ute.`}
      caption="Hver prikk er mange ioner. Tidsskalaen er forenklet."
    >
      <Rooms g={g} right={{ top: `${fmt(kOut, 0)} mmol/L K⁺`, bottom: `${fmt(kIn, 0)} mmol/L K⁺` }} />
      <Membran x={400} y={g.memY} length={X1 - X0} thickness={g.T} skip={gates.map((x) => proteinSlot(x, 'kanal', g.T))} />
      {gates.map((x) => (
        <Kanalprotein key={x} x={x} y={g.memY} thickness={g.T} open={open} />
      ))}
      <MembranPartikler tracks={tracks} t={t} geometry={geom} fill={BIO.kalium} />
    </Figure>
  );
}

/* ====================================================================== */
/* 3. Aktiv transport: natrium-kalium-pumpa                                 */
/* ====================================================================== */

/** Sekunder per pumperunde i figuren (i virkeligheten ca. 10 ms). */
const PUMP_CYCLE = 9;
const ION_PER_DOT = 5;

function Aktiv() {
  const [atp, setAtp] = useState(100);
  const s = pumpSteadyState(atp / 100);
  const clock = useSimClock({ tMax: 100000, speed: s.rate });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const phase = (clock.t / PUMP_CYCLE) % 1;
  const stepF = phase * PUMP_STEPS.length;
  const step = Math.min(PUMP_STEPS.length - 1, Math.floor(stepF));
  const cycles = Math.floor(clock.t / PUMP_CYCLE);
  const plotH = Math.round(300 + 240 * (f - 1));

  return (
    <>
      <Controls>
        <Slider label="ATP-tilgang" value={atp} onChange={setAtp} min={0} max={100} step={1} unit="%" />
        <Slider
          label="Steg i pumperunden"
          value={step + 1}
          onChange={(v) => {
            clock.pause();
            clock.setT((cycles + (v - 1 + 0.55) / PUMP_STEPS.length) * PUMP_CYCLE);
          }}
          min={1}
          max={PUMP_STEPS.length}
          step={1}
          format={(v) => `${v} av ${PUMP_STEPS.length}`}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmtCount(cycles)} ${cycles === 1 ? 'runde' : 'runder'}`} />
      </Toolbar>

      <div ref={ref}>
        <PumpScene stepF={stepF} t={clock.t} f={f} naIn={s.naIn} kIn={s.kIn} running={s.rate > 0} />
      </div>
      <Legend
        items={[
          { color: BIO.natrium, label: 'Na⁺' },
          { color: BIO.kalium, label: 'K⁺' },
          { color: BIO.atp, label: 'ATP og fosfat (P)' },
        ]}
      />

      <Figure viewBox={`0 0 800 ${plotH}`} label={`Na⁺ og K⁺ inne i cellen mot ATP-tilgangen. Nå ${fmt(s.naIn, 0)} mmol/L Na⁺ og ${fmt(s.kIn, 0)} mmol/L K⁺.`}>
        <Plot x={{ min: 0, max: 100, label: 'ATP-tilgang (%)' }} y={{ min: 0, max: 160, label: 'Konsentrasjon (mmol/L)', ticks: [0, 40, 80, 120, 160] }} width={800} height={plotH}>
          {({ sx, sy, x0, x1 }) => (
            <g>
              <line x1={x0} x2={x1} y1={sy(ION.naOut)} y2={sy(ION.naOut)} stroke={BIO.natrium} strokeWidth={1.6} strokeDasharray="6 5" />
              <line x1={x0} x2={x1} y1={sy(ION.kOut)} y2={sy(ION.kOut)} stroke={BIO.kalium} strokeWidth={1.6} strokeDasharray="6 5" />
              <path d={linePath(sample((a) => pumpSteadyState(a / 100).naIn, 0, 100, 120), sx, sy)} fill="none" stroke={BIO.natrium} strokeWidth={3.5} />
              <path d={linePath(sample((a) => pumpSteadyState(a / 100).kIn, 0, 100, 120), sx, sy)} fill="none" stroke={BIO.kalium} strokeWidth={3.5} />
              <circle cx={sx(atp)} cy={sy(s.naIn)} r={7} fill={BIO.natrium} stroke={VIZ.surface} strokeWidth={2.5} />
              <circle cx={sx(atp)} cy={sy(s.kIn)} r={7} fill={BIO.kalium} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: BIO.natrium, label: <span>Na⁺ inne (stiplet: ute, {ION.naOut} mmol/L)</span> },
          { color: BIO.kalium, label: <span>K⁺ inne (stiplet: ute, {ION.kOut} mmol/L)</span> },
        ]}
      />

      <Readouts>
        <Readout label="Na⁺ inne / ute" value={`${fmt(s.naIn, 0)} / ${ION.naOut}`} unit="mmol/L" tone={BIO.natrium} />
        <Readout label="K⁺ inne / ute" value={`${fmt(s.kIn, 0)} / ${ION.kOut}`} unit="mmol/L" tone={BIO.kalium} />
        <Readout label="ATP per pumpe" value={fmt(s.atpPerS, 0)} unit="per s" tone={BIO.atp} />
      </Readouts>

      <Formula label="Natrium-kalium-pumpa">
        <FormulaLine>Én runde: 3 Na⁺ ut + 2 K⁺ inn, og 1 ATP → ADP + P</FormulaLine>
        <FormulaLine>
          {fmt(s.atpPerS, 0)} runder per s: {fmt(pumpPerCycle(s.atpPerS).naOut, 0)} Na⁺ ut og {fmt(pumpPerCycle(s.atpPerS).kIn, 0)} K⁺ inn per s
          for hver pumpe
        </FormulaLine>
      </Formula>

      <Explain>{pumpText(atp, step, s.naIn, s.kIn)}</Explain>
    </>
  );
}

/** Plasseringen av ionene i pumpa (relativt til midten) og deres vei inn og ut. */
function PumpScene({ stepF, t, f, naIn, kIn, running }: { stepF: number; t: number; f: number; naIn: number; kIn: number; running: boolean }) {
  const g = sceneGeom(f, 130, 72);
  const { memY, T, k, narrow } = g;
  const px = 400;
  const step = Math.min(PUMP_STEPS.length - 1, Math.floor(stepF));
  const u = stepF - step;
  const cur = PUMP_STEPS[step]!;
  const prev = PUMP_STEPS[(step + PUMP_STEPS.length - 1) % PUMP_STEPS.length]!;
  // Formen: endres i løpet av steget når state skifter
  let state = cur.state;
  if (prev.state !== cur.state) state = prev.state + (cur.state - prev.state) * smooth(u / 0.6);
  const fosfat = step === 1 ? u > 0.5 : cur.fosfat;
  const r = 9 * k;
  const siteY = (s: number) => memY - T * 0.3 + T * 0.6 * s;
  const naSites = [-1, 0, 1].map((i) => px + i * 2.15 * r);
  const kSites = [-0.6, 0.6].map((i) => px + i * 2.4 * r);
  const ions: ReactNode[] = [];
  const outsideY = memY - T - 50 * (narrow ? 1.3 : 1);
  const insideY = memY + T + 50 * (narrow ? 1.3 : 1);
  // Na⁺
  naSites.forEach((x, i) => {
    let y: number | null = null;
    let xx = x;
    if (step === 0) {
      const v = smooth(u / 0.8);
      y = insideY + (siteY(1) - insideY) * v;
      xx = x + (i - 1) * 40 * (1 - v);
    } else if (step === 1) y = siteY(1);
    else if (step === 2) {
      if (u < 0.6) y = siteY(state);
      else {
        const v = smooth((u - 0.6) / 0.4);
        y = siteY(0) + (outsideY - siteY(0)) * v;
        xx = x + (i - 1) * 40 * v;
      }
    }
    if (y !== null) ions.push(<Ion key={`na${i}`} x={xx} y={y} r={r} color={BIO.natrium} label="Na⁺" />);
  });
  // K⁺
  kSites.forEach((x, i) => {
    let y: number | null = null;
    let xx = x;
    if (step === 3) {
      const v = smooth(u / 0.8);
      y = outsideY + (siteY(0) - outsideY) * v;
      xx = x + (i - 0.5) * 50 * (1 - v);
    } else if (step === 4) y = siteY(state);
    else if (step === 5) {
      const v = smooth(u / 0.8);
      y = siteY(1) + (insideY - siteY(1)) * v;
      xx = x + (i - 0.5) * 50 * v;
    }
    if (y !== null) ions.push(<Ion key={`k${i}`} x={xx} y={y} r={r} color={BIO.kalium} label="K⁺" />);
  });
  // Bakgrunnsioner etter konsentrasjonene, til venstre og høyre for pumpa (halvparten på hver side)
  const clear = 120 * (narrow ? 1.3 : 1);
  const boxes = (y: number, h: number) => [
    { x: X0 + 8, y, w: px - clear - X0 - 8, h },
    { x: px + clear, y, w: X1 - 8 - px - clear, h },
  ];
  const bgA = boxes(g.top + 8, memY - T / 2 - g.top - 16);
  const bgB = boxes(memY + T / 2 + 8, g.bottom - memY - T / 2 - 30 * f - 8);
  const half = (c: number) => Math.max(1, Math.round(c / ION_PER_DOT / 2));
  const nNaOut = half(ION.naOut);
  const nKOut = half(ION.kOut);
  const nNaIn = half(naIn);
  const nKIn = half(kIn);
  const outL = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 500 }, [{ n: nNaOut, r: 30 }, { n: nKOut, r: 30 }], 3, 10), [nNaOut, nKOut]);
  const outR = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 500 }, [{ n: nNaOut, r: 30 }, { n: nKOut, r: 30 }], 13, 10), [nNaOut, nKOut]);
  const inL = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 500 }, [{ n: nNaIn, r: 30 }, { n: nKIn, r: 30 }], 4, 10), [nNaIn, nKIn]);
  const inR = useMemo(() => placeParticles({ x: 0, y: 0, w: 1000, h: 500 }, [{ n: nNaIn, r: 30 }, { n: nKIn, r: 30 }], 14, 10), [nNaIn, nKIn]);
  const bg = (list: typeof outL, box: { x: number; y: number; w: number; h: number }, key: string) =>
    list.map((p, i) => {
      const q = jiggle(p, t, 10);
      const x = box.x + r + ((box.w - 2 * r) * Math.min(1000, Math.max(0, q.x))) / 1000;
      const y = box.y + r + ((box.h - 2 * r) * Math.min(500, Math.max(0, q.y))) / 500;
      return <Ion key={`${key}${i}`} x={x} y={y} r={r * 0.8} color={p.group === 0 ? BIO.natrium : BIO.kalium} faint />;
    });
  const atpX = px + T * 1.4;
  const atpY = memY + T + 18 * k;
  return (
    <Figure
      viewBox={`0 0 800 ${g.H}`}
      maxHeight={g.H}
      label={`Natrium-kalium-pumpe, steg ${step + 1}: ${cur.tittel}.`}
      caption="Prikkene ved siden av pumpa viser konsentrasjonene (hver prikk er mange ioner). En runde tar ca. 10 ms i virkeligheten."
    >
      <Rooms g={g} right={{ top: `Steg ${step + 1}: ${cur.tittel}` }} />
      {bg(outL, bgA[0]!, 'ol')}
      {bg(outR, bgA[1]!, 'or')}
      {bg(inL, bgB[0]!, 'il')}
      {bg(inR, bgB[1]!, 'ir')}
      <Membran x={400} y={memY} length={X1 - X0} thickness={T} skip={[proteinSlot(px, 'pumpe', T)]} />
      <NaKPumpe x={px} y={memY} thickness={T} state={state} fosfat={fosfat} />
      {ions}
      {step === 1 && (
        <g opacity={1}>
          <Txt x={atpX + 6} y={atpY + 6} anchor="start" size={0.8} weight={700} color={BIO.atp}>
            {u < 0.5 ? 'ATP' : 'ADP + P'}
          </Txt>
          {u < 0.5 && <Arrow x1={atpX} y1={atpY} x2={px + T * 0.6} y2={memY + T * 0.8} color={BIO.atp} width={2.5} head={9} />}
        </g>
      )}
      {!running && (
        <Txt x={px} y={memY - T / 2 - 22 * f} size={0.85} weight={700} color={BIO.atp}>
          Ingen ATP: pumpa står stille
        </Txt>
      )}
    </Figure>
  );
}

function Ion({ x, y, r, color, label, faint }: { x: number; y: number; r: number; color: string; label?: string; faint?: boolean }) {
  return (
    <g opacity={faint ? 0.55 : 1}>
      <circle cx={x} cy={y} r={r} fill={color} stroke={VIZ.surface} strokeWidth={1.4} />
      {label && !faint && (
        <text x={x} y={y + r * 0.35} textAnchor="middle" fontSize={r * 0.95} fontWeight={700} fill={VIZ.surface} style={{ pointerEvents: 'none' }}>
          +
        </text>
      )}
    </g>
  );
}

function pumpText(atp: number, step: number, naIn: number, kIn: number): ReactNode {
  const s = PUMP_STEPS[step]!;
  const stepText = (
    <p>
      <strong>
        Steg {step + 1}: {s.tittel}.
      </strong>{' '}
      {s.tekst}
    </p>
  );
  const why = (
    <p>
      Pumpa flytter ionene <em>mot</em> konsentrasjonsgradienten: Na⁺ ut der det allerede er mye Na⁺, og K⁺ inn der det allerede er mye K⁺.
      Det krever energi fra ATP. Gradientene brukes blant annet til nerveimpulser og til å frakte glukose inn i tarmcellene. Pumpene bruker
      ca. en fjerdedel av energien kroppen bruker i hvile, i nerveceller enda mer.
    </p>
  );
  if (atp === 0)
    return (
      <>
        <p>
          <strong>Ingen ATP.</strong> Pumpa står stille, men Na⁺ lekker fortsatt inn og K⁺ ut gjennom kanaler (passiv transport). Etter hvert
          blir konsentrasjonene like inne og ute ({fmt(naIn, 0)} mmol/L Na⁺ inne). Da får cellen også for mye oppløst stoff inne, tar opp vann
          ved osmose og sveller. Det skjer når celler mangler O₂, for eksempel ved hjerneslag.
        </p>
        {why}
      </>
    );
  return (
    <>
      {stepText}
      {atp < 60 ? (
        <p>
          Med bare {atp} % ATP-tilgang går pumpa langsommere. Lekkasjen tar igjen, og det blir {fmt(naIn, 0)} mmol/L Na⁺ og {fmt(kIn, 0)} mmol/L
          K⁺ inne i stedet for {ION.naIn} og {ION.kIn}.
        </p>
      ) : (
        <p>
          Hver runde flytter 3 Na⁺ ut og 2 K⁺ inn og bruker ett ATP. Netto går én positiv ladning ut per runde, og det bidrar til at innsiden av
          cellen er negativ i forhold til utsiden (hvilepotensialet).
        </p>
      )}
      {why}
    </>
  );
}

/* ====================================================================== */
/* 4. Endo- og eksocytose                                                   */
/* ====================================================================== */

const VES_T = 10;

function Vesikler() {
  const [kind, setKind] = useState<VesicleKind>('endo');
  const clock = useSimClock({ tMax: VES_T, speed: 1 });
  const { setT, pause } = clock;
  // Vis et forløp som er i gang når siden åpnes eller du bytter (trykk «Spill av» for hele forløpet)
  useEffect(() => {
    pause();
    setT(VES_T * 0.45);
  }, [kind, pause, setT]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const p = Math.min(1, clock.t / VES_T);
  const phase = vesiclePhase(kind, p);
  const phases = VESICLE_PHASES[kind];
  // Endocytose: membranen blir mindre når vesikkelen snøres av. Eksocytose: større når vesikkelen har smeltet sammen med den.
  const detached = endocytosisShape(kind === 'endo' ? p : 1 - p).detached;
  const changed = kind === 'endo' ? detached : !detached;
  const dA = fmt(vesicleArea(100), 2);

  return (
    <>
      <Toolbar>
        <Segmented
          label="Velg retning"
          options={[
            { value: 'endo', label: 'Endocytose (inn)' },
            { value: 'ekso', label: 'Eksocytose (ut)' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Forløp"
          value={Math.round(p * 100)}
          onChange={(v) => {
            pause();
            setT((v / 100) * VES_T);
          }}
          min={0}
          max={100}
          step={1}
          unit="%"
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`fase ${phase + 1} av ${phases.length}`} />
      </Toolbar>

      <div ref={ref}>
        <VesicleScene kind={kind} p={p} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.lipidHode, label: 'Membran (lipiddobbeltlag)' },
          { color: kind === 'endo' ? BIO.opplost : BIO.signal, label: kind === 'endo' ? 'Stoff som tas inn' : 'Stoff som skilles ut (f.eks. insulin)' },
        ]}
      />

      <Readouts>
        <Readout label="Fase" value={`${phase + 1} av ${phases.length}`} />
        <Readout label="Energi" value="ATP" tone={BIO.atp} />
        <Readout
          label="Cellemembranen"
          value={!changed ? 'Like stor' : kind === 'endo' ? 'Mindre' : 'Større'}
          unit={!changed ? undefined : `(${kind === 'endo' ? '−' : '+'}${dA} µm²)`}
        />
      </Readouts>

      <Explain>
        {kind === 'endo' ? (
          <>
            <p>
              <strong>Fase {phase + 1}: {phases[phase]!.tittel}.</strong> Ved endocytose buler cellemembranen innover rundt stoffet og snøres av
              som en vesikkel (en liten blære med membran rundt). Stoffet går altså aldri gjennom selve lipidlaget: det pakkes inn.
            </p>
            <p>
              Slik tar hvite blodlegemer inn bakterier (fagocytose, «celle-eting»), og mange celler tar inn væske og store molekyler som kolesterol.
              Vesikkelen kan smelte sammen med et lysosom, der enzymer bryter ned innholdet. Prosessen krever energi (ATP).
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>Fase {phase + 1}: {phases[phase]!.tittel}.</strong> Ved eksocytose smelter en vesikkel sammen med cellemembranen, og
              innholdet slippes ut. Det er endocytose «baklengs», og vesikkelmembranen blir en del av cellemembranen.
            </p>
            <p>
              Proteiner som skal ut av cellen, lages på kornet ER og pakkes i vesikler i golgiapparatet. Slik skiller bukspyttkjertelen ut insulin
              og fordøyelsesenzymer, og nerveceller skiller ut signalstoffer. Prosessen krever energi (ATP).
            </p>
          </>
        )}
      </Explain>
    </>
  );
}

function VesicleScene({ kind, p, f }: { kind: VesicleKind; p: number; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const top = 30 * f + 26 * f + 20;
  const Rv = narrow ? 82 : 64;
  const memY = top + Rv * 1.7;
  const T = narrow ? 24 : 20;
  const H = Math.round(memY + Rv * 3.9 + 30 * f + 10);
  const xc = 400;
  const shape = endocytosisShape(kind === 'endo' ? p : 1 - p);
  const travelMax = Rv * 1.6;
  // Midten av lomma/vesikkelen: over membranen (flat), på membranen, under den (snørt av), så videre inn
  const cy = memY + shape.depth * Rv + (shape.detached ? Rv * 0.12 + shape.travel * travelMax : 0);
  const membranePath = (() => {
    if (shape.detached || shape.depth <= -1) return `M${X0},${memY} H${X1}`;
    const half = Rv * Math.sqrt(Math.max(0, 1 - shape.depth ** 2));
    const large = shape.depth > 0 ? 1 : 0;
    return `M${X0},${memY} H${xc - half} A${Rv},${Rv} 0 ${large} 0 ${xc + half},${memY} H${X1}`;
  })();
  // Innholdet: følger midten av vesikkelen; ved eksocytose sprer det seg ut når vesikkelen har åpnet seg
  const rnd = seededRandom(kind === 'endo' ? 5 : 8);
  const n = 9;
  // Innholdet ligger helt inntil membranen før lomma blir dyp (ikke svevende over den)
  const contentY = shape.detached ? cy : Math.max(cy, memY - Rv * 0.62);
  const offs = Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(rnd()) * Rv * 0.55;
    return { x: Math.cos(a) * s, y: Math.sin(a) * s };
  });
  const open = kind === 'ekso' && shape.depth < 0.9 && !shape.detached;
  const spread = kind === 'ekso' ? Math.max(0, (p - 0.4) / 0.6) : 0;
  const color = kind === 'endo' ? BIO.opplost : BIO.signal;
  const phases = VESICLE_PHASES[kind];
  const phase = vesiclePhase(kind, p);
  const stroke = (d: string, key: string) => (
    <g key={key}>
      <path d={d} fill="none" stroke={BIO.lipidHode} strokeWidth={T} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={BIO.lipidHale} strokeWidth={T - 9} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
  const vesicleD = `M${xc - Rv},${cy} A${Rv},${Rv} 0 1 0 ${xc + Rv},${cy} A${Rv},${Rv} 0 1 0 ${xc - Rv},${cy} Z`;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1000 : H}
      label={`${kind === 'endo' ? 'Endocytose' : 'Eksocytose'}, fase ${phase + 1}: ${phases[phase]!.tittel}.`}
      caption="Vesikkelen er tegnet mye større i forhold til cellen enn i virkeligheten (ca. 0,1 µm)."
    >
      <rect x={X0} y={top} width={X1 - X0} height={memY - top} fill={BIO.vannFyll} rx={12} />
      <rect x={X0} y={memY} width={X1 - X0} height={H - 8 - memY} fill={BIO.cytoplasma} rx={12} />
      {/* Lommas indre er utsiden (vevsvæske) helt til den snøres av */}
      {!shape.detached && shape.depth > -1 && (
        <path
          d={`M${xc - Rv * Math.sqrt(Math.max(0, 1 - shape.depth ** 2))},${memY} A${Rv},${Rv} 0 ${shape.depth > 0 ? 1 : 0} 0 ${xc + Rv * Math.sqrt(Math.max(0, 1 - shape.depth ** 2))},${memY} Z`}
          fill={BIO.vannFyll}
        />
      )}
      {shape.detached && <path d={vesicleD} fill={kind === 'endo' ? BIO.vannFyll : mixColor(BIO.vannFyll, BIO.signal, 0.12)} />}
      <Txt x={X0 + 6} y={24 * f} anchor="start" size={0.85} muted>
        Utsiden (vevsvæske)
      </Txt>
      <Txt x={narrow ? X0 + 6 : X1 - 6} y={narrow ? 24 * f + 28 * f : 24 * f} anchor={narrow ? 'start' : 'end'} size={narrow ? 0.8 : 0.85} weight={700}>
        {phase + 1}: {phases[phase]!.tittel}
      </Txt>
      <Txt x={X0 + 10} y={memY + T / 2 + 24 * f} anchor="start" size={0.85} muted>
        Cytoplasma
      </Txt>
      {kind === 'endo' ? (
        <g>
          <Lysosom x={xc + Rv * 2.9} y={memY + Rv * 2.9} r={Rv * 0.55} />
          <Txt x={xc + Rv * 2.9} y={memY + Rv * 2.9 + Rv * 0.55 + 24 * f} size={0.8} muted>
            Lysosom
          </Txt>
        </g>
      ) : (
        <g>
          <Golgiapparat x={xc - Rv * 3.1} y={memY + Rv * 2.8} w={Rv * 2} h={Rv * 1.3} />
          <Txt x={xc - Rv * 3.1} y={memY + Rv * 2.8 + Rv * 0.65 + 24 * f} size={0.8} muted>
            Golgiapparat
          </Txt>
        </g>
      )}
      {offs.map((o, i) => {
        // Ved eksocytose sprer innholdet seg sidelengs ut i vevsvæsken (holdes inne i rommet over membranen)
        const x = xc + o.x * (1 + spread * 4);
        const y = contentY + o.y * (1 - spread * 0.3) - spread * Rv * 0.2;
        const yy = shape.detached || shape.depth > 0 ? y : Math.min(memY - T / 2 - 6 * k, Math.max(top + 8 * k, y));
        return <circle key={i} cx={x} cy={yy} r={6 * k} fill={color} stroke={VIZ.surface} strokeWidth={1.2} />;
      })}
      {stroke(membranePath, 'm')}
      {shape.detached && stroke(vesicleD, 'v')}
      {!open && !shape.detached && shape.depth > 0.6 && (
        <Txt x={xc + Rv + 14} y={memY + Rv * 0.9} anchor="start" size={0.8} muted>
          {kind === 'endo' ? 'snøres av' : 'smelter sammen'}
        </Txt>
      )}
      {shape.detached && (
        <Arrow
          x1={xc + Rv + 24}
          y1={cy + (kind === 'endo' ? -30 : 30)}
          x2={xc + Rv + 24}
          y2={cy + (kind === 'endo' ? 30 : -30)}
          color={VIZ.muted}
          width={2.5}
          head={10}
        />
      )}
    </Figure>
  );
}
