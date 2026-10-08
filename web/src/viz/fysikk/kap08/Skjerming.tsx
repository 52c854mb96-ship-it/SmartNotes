import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Sup,
  Toolbar,
  VizLayout,
  fmt,
  useSimClock,
  type SimClock,
} from '../../kit';
import { useFigureTextScale } from '../kap07/useNarrow';
import {
  ALPHA_RANGE,
  ALPHA_RANGE_AIR,
  BACKGROUND,
  BETA,
  GAMMA_HALF,
  MATERIALS,
  MATERIAL_IDS,
  MEASURE_TIME,
  RADIATIONS,
  RADIATION_IDS,
  SHEET,
  arrivalTimes,
  countUpTo,
  emissions,
  maxThickness,
  netRate,
  registered,
  timeSinceLastClick,
  trackDraws,
  transmission,
  type MaterialId,
  type RadiationId,
} from './model-skjerming';
import { TransmissionPlot, fmtPct } from './skjerming-graf';
import { BACKGROUND_COLOR, LabStrip, N_TRACKS, RAD_COLOR, ZoomPanel, sceneLabel, skLayout } from './skjerming-scene';

const RAD_OPTIONS = RADIATION_IDS.map((r) => ({ value: r, label: RADIATIONS[r].name }));
const MAT_OPTIONS = MATERIAL_IDS.map((m) => ({ value: m, label: MATERIALS[m].name }));

/** Startverdiene for tykkelsen i hvert materiale: ett ark papir, 1 mm aluminium og 1 cm bly. */
const START: Record<MaterialId, number> = { papir: 0.1, aluminium: 1, bly: 10 };

/** Frøet til sporene i forstørrelsen (fast, så figuren ikke hopper ved en ny måling). */
const TRACK_SEED = 2;

/** Små tall uten overflødige nuller: 0,050 → «0,05», 0,025 → «0,025». */
function fmtShort(v: number): string {
  return fmt(v, 3).replace(/0+$/, '').replace(/,$/, '');
}

/** Tykkelsen som tekst: «0,3 mm (3 ark)», «2,0 mm», «10 mm», «0 mm (ingen skjerm)». */
function thicknessText(mat: MaterialId, d: number): string {
  if (!(d > 0)) return '0 mm (ingen skjerm)';
  if (mat === 'papir') {
    const n = Math.round(d / SHEET);
    return `${fmt(d, 1)} mm (${n} ark)`;
  }
  return `${fmt(d, mat === 'bly' ? 0 : 1)} mm`;
}

export default function Skjerming() {
  const [rad, setRad] = useState<RadiationId>('alfa');
  const [mat, setMat] = useState<MaterialId>('papir');
  const [thick, setThick] = useState<Record<MaterialId, number>>(START);
  const [seed, setSeed] = useState(1);
  const clock = useSimClock({ tMax: MEASURE_TIME, speed: 4 });
  const { setT, playing } = clock;
  // Siden åpnes med en ferdig måling på ett minutt
  useEffect(() => setT(MEASURE_TIME), [setT]);
  const [ref, f] = useFigureTextScale<HTMLDivElement>();
  const narrow = f > 1.05;
  const L = skLayout(narrow, f);

  const maxD = maxThickness(rad, mat);
  const d = Math.min(thick[mat], maxD);
  const T = transmission(rad, mat, d);
  const t = clock.t;
  const em = useMemo(() => emissions(RADIATIONS[rad].rate0, MEASURE_TIME, seed * 3 + RADIATION_IDS.indexOf(rad)), [rad, seed]);
  const bg = useMemo(() => arrivalTimes(BACKGROUND, MEASURE_TIME, seed * 5 + 1000), [seed]);
  const draws = useMemo(() => trackDraws(N_TRACKS, TRACK_SEED), []);
  const count = registered(em, T, t) + countUpTo(bg, t);
  const measuring = t < MEASURE_TIME;
  const since = timeSinceLastClick(em, T, bg, t);
  const blink = measuring && t > 0 ? Math.max(0, 1 - since / 0.4) : 0;
  const perMin = t > 0.5 ? (count / t) * 60 : Number.NaN;

  /** Ny innstilling: uten en måling på gang vises resultatet av en hel måling med én gang. */
  const settle = () => {
    if (!playing) setT(MEASURE_TIME);
  };
  const changeRad = (r: RadiationId) => {
    setRad(r);
    settle();
  };
  const changeMat = (m: MaterialId) => {
    setMat(m);
    settle();
  };
  const changeD = (v: number) => {
    setThick((old) => ({ ...old, [mat]: v }));
    settle();
  };
  const newMeasurement = () => {
    setSeed((s) => s + 1);
    clock.play();
  };

  const plotH = narrow ? 560 : 340;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg stråling" options={RAD_OPTIONS} value={rad} onChange={changeRad} />
        <Segmented label="Velg skjerm" options={MAT_OPTIONS} value={mat} onChange={changeMat} />
      </Toolbar>
      <Controls>
        <Slider label="Tykkelse d" value={d} onChange={changeD} min={0} max={maxD} step={MATERIALS[mat].step} format={(v) => thicknessText(mat, v)} />
      </Controls>
      <Toolbar>
        <MeasureBar clock={clock} onNew={newMeasurement} />
      </Toolbar>

      <div ref={ref}>
        <Figure viewBox={`0 0 800 ${L.H}`} label={sceneLabel(rad, mat, d, T, count)} maxHeight={narrow ? 1400 : 600}>
          <LabStrip L={L} rad={rad} mat={mat} d={d} count={count} blink={blink} />
          <ZoomPanel L={L} rad={rad} mat={mat} d={d} T={T} draws={draws} seed={TRACK_SEED} t={t} animate={measuring} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: RAD_COLOR[rad], label: `${RADIATIONS[rad].name} fra ${RADIATIONS[rad].source}: sporet ender der strålingen stoppes eller treffer røret` },
          { color: BACKGROUND_COLOR, label: 'Bakgrunnsstråling fra omgivelsene', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label={`Klikk på ${fmt(t, 0)} s`} value={fmt(count, 0)} />
        <Readout label="Bakgrunn (målt uten kilde)" value={fmt(BACKGROUND, 0)} unit="klikk/min" />
        <Readout label="Fra kilden: målt minus bakgrunn" value={fmt(perMin - BACKGROUND, 0)} unit="klikk/min" />
        <Readout label="Slipper gjennom skjermen" value={fmtPct(T)} />
      </Readouts>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Graf over andelen som slipper gjennom ${MATERIALS[mat].name.toLowerCase()} som funksjon av tykkelsen, for α, β og γ. Ved ${thicknessText(mat, d)} slipper ${fmtPct(T)} av ${RADIATIONS[rad].name} gjennom.`}
      >
        <TransmissionPlot rad={rad} mat={mat} d={d} height={plotH} />
      </Figure>
      <Legend
        items={RADIATION_IDS.map((r) => ({
          color: RAD_COLOR[r],
          label: `${RADIATIONS[r].name} (${RADIATIONS[r].source})`,
        }))}
      />

      <Formula label="Hvor mye slipper gjennom?">
        <FormulaLines rad={rad} mat={mat} d={d} T={T} count={count} t={t} />
      </Formula>

      <Explain>{explanation(rad, mat, d, T, count, t)}</Explain>
    </VizLayout>
  );
}

/** Knappene for målingen: «Ny måling» (ett minutt, med nye tilfeldige klikk), «Pause»/«Fortsett» og «Hopp til slutten». */
function MeasureBar({ clock, onNew }: { clock: SimClock; onNew: () => void }) {
  const running = clock.t < MEASURE_TIME;
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={running ? clock.toggle : onNew} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : running ? 'Fortsett målingen' : 'Ny måling'}
      </button>
      {running && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            clock.pause();
            clock.setT(MEASURE_TIME);
          }}
        >
          <SkipForward size={16} aria-hidden />
          Hopp til slutten
        </button>
      )}
      <span className="viz-play-time" aria-live="off">
        t = {fmt(clock.t, 0)} s av {MEASURE_TIME} s
      </span>
    </div>
  );
}

/** Utregningen med levende tall. I = tellerate fra kilden, I₀ = uten skjerm. */
function FormulaLines({ rad, mat, d, T, count, t }: { rad: RadiationId; mat: MaterialId; d: number; T: number; count: number; t: number }) {
  const r = RADIATIONS[rad];
  const I0 = r.rate0;
  const I = netRate(rad, mat, d);
  const matName = MATERIALS[mat].name.toLowerCase();
  const dTxt = fmt(d, mat === 'bly' ? 0 : 1);
  const expected = I + BACKGROUND;
  const lines: ReactNode[] = [];
  if (!(d > 0)) {
    lines.push(
      <>
        Uten skjerm: I = I<Sub>0</Sub> = {fmt(I0, 0)} klikk/min
      </>,
    );
  } else if (rad === 'alfa') {
    lines.push(
      <>
        Rekkevidde for α: ca. {fmt(ALPHA_RANGE_AIR / 10, 0)} cm i luft og ca. {fmtShort(ALPHA_RANGE[mat])} mm i {matName}
      </>,
    );
    lines.push(
      <>
        d = {dTxt} mm er mer enn rekkevidden, så alle stoppes: I = 0
      </>,
    );
  } else if (rad === 'beta' && d >= BETA[mat].range) {
    lines.push(
      <>
        d = {dTxt} mm ≥ R = {fmt(BETA[mat].range, BETA[mat].range < 2 ? 1 : 0)} mm (største rekkevidde for β i {matName}), så alle stoppes: I = 0
      </>,
    );
  } else {
    const half = rad === 'beta' ? BETA[mat].half : GAMMA_HALF[mat];
    const hTxt = fmt(half, half < 1 ? 2 : half < 10 ? 1 : 0);
    lines.push(
      <>
        I = I<Sub>0</Sub> · (1/2)<Sup>d/d½</Sup> = {fmt(I0, 0)} klikk/min · (1/2)<Sup>{dTxt} / {hTxt}</Sup> = {fmt(I, 0)} klikk/min
        {rad === 'beta' ? ` (omtrent, for d < ${fmt(BETA[mat].range, BETA[mat].range < 2 ? 1 : 0)} mm)` : ''}
      </>,
    );
  }
  lines.push(
    <>
      Forventet på telleren: I + bakgrunn = {fmt(I, 0)} + {BACKGROUND} = {fmt(expected, 0)} klikk/min, tilfeldig variasjon ca. ±{' '}
      <span className="viz-root">√</span>
      {fmt(expected, 0)} ≈ ± {fmt(Math.sqrt(expected), 0)}
    </>,
  );
  if (t >= MEASURE_TIME)
    lines.push(
      <>
        Målt: {fmt(count, 0)} klikk på ett minutt, så fra kilden: {fmt(count, 0)} − {BACKGROUND} = {fmt(count - BACKGROUND, 0)} klikk/min
        {T < 1 && d > 0 ? ` (${fmtPct(T)} av ${fmt(I0, 0)})` : ''}
      </>,
    );
  return (
    <>
      {lines.map((l, i) => (
        <FormulaLine key={i}>{l}</FormulaLine>
      ))}
    </>
  );
}

/** «Ett papirark», «5 ark papir», «2,0 mm aluminium», «10 mm bly». */
function screenWords(mat: MaterialId, d: number): string {
  if (mat === 'papir') {
    const n = Math.round(d / SHEET);
    return n === 1 ? 'Ett papirark' : `${n} ark papir`;
  }
  return `${fmt(d, mat === 'bly' ? 0 : 1)} mm ${MATERIALS[mat].name.toLowerCase()}`;
}

function explanation(rad: RadiationId, mat: MaterialId, d: number, T: number, count: number, t: number): ReactNode {
  const pct = fmtPct(T);
  const done = t >= MEASURE_TIME;
  const statistics = done ? (
    <>
      {' '}
      Telleren viste {fmt(count, 0)} klikk. Tallet blir litt forskjellig fra måling til måling (omtrent ± √N), fordi henfallene skjer
      tilfeldig. Trykk «Ny måling» og se.
    </>
  ) : null;
  const backgroundOnly = (
    <p>
      Telleren viser likevel ca. {BACKGROUND} klikk i minuttet. Det er ikke stråling fra kilden som slipper gjennom, men bakgrunnsstråling: fra
      radon i lufta, fra berggrunnen og byggematerialene og fra verdensrommet. Den kommer fra alle kanter, også gjennom veggen på røret (de stiplede
      sporene), så en geigerteller viser aldri 0. Skjermen blir heller ikke radioaktiv av å stoppe strålingen.
      {done && count !== BACKGROUND
        ? ` Telleren viste ${fmt(count, 0)} klikk, ikke nøyaktig ${BACKGROUND}: også bakgrunnen kommer tilfeldig, og varierer med omtrent ± √N fra måling til måling. Trykk «Ny måling» og se.`
        : ''}
    </p>
  );

  if (rad === 'alfa') {
    const protect = (
      <p>
        Utenfor kroppen er α nesten ufarlig: det ytterste laget av huden er døde celler, og det stopper α. Derfor kan røykvarsleren i taket ha en
        liten α-kilde med americium-241. Inne i kroppen er α den farligste av de tre, fordi all energien havner på et lite område. Radon er en gass
        som siver inn i hus fra berggrunnen. Når vi puster den inn, henfaller radonet og datterkjernene i lungene, og α-partiklene treffer levende
        celler direkte. Radon er den viktigste årsaken til lungekreft i Norge etter røyking.
      </p>
    );
    if (!(d > 0))
      return (
        <>
          <p>
            Uten skjerm når α-partiklene fram til røret, fordi det bare er {fmt(RADIATIONS.alfa.gap / 10, 1)} cm luft mellom kilden og
            vinduet. α-partikler er heliumkjerner
            (to protoner og to nøytroner): tunge og med dobbel ladning. De river løs elektroner fra svært mange atomer på kort strekning (de
            ioniserer sterkt) og mister energien fort. I luft stopper de etter ca. 4 cm, så med røret 5 cm unna hadde telleren bare vist
            bakgrunnen. Legg inn ett papirark.{statistics}
          </p>
          {protect}
        </>
      );
    return (
      <>
        <p>
          <strong>{screenWords(mat, d)}</strong> stopper alle α-partiklene. Rekkevidden deres i {MATERIALS[mat].name.toLowerCase()} er bare ca.{' '}
          {fmtShort(ALPHA_RANGE[mat])} mm, og etter {fmt(RADIATIONS.alfa.gap / 10, 0)} cm luft er {fmt((100 * RADIATIONS.alfa.gap) / ALPHA_RANGE_AIR, 0)} % av
          den allerede brukt opp. Sporene ender i forsiden av skjermen.
        </p>
        {backgroundOnly}
        {protect}
      </>
    );
  }

  if (rad === 'beta') {
    const R = BETA[mat].range;
    const intro = (
      <>
        β-partikler er elektroner som skytes ut av kjernen når et nøytron blir til et proton. De er lette og har enkel ladning, så de ioniserer
        mindre enn α og går lenger: flere meter i luft.
      </>
    );
    const leadNote = (
      <p>
        Mot β bruker man plast eller aluminium, ikke bly: når elektronene bremses brått av de store blykjernene, sender de ut røntgenstråling
        (bremsestråling). β kan trenge noen millimeter inn i huden og skade øynene, så kilden holdes på en stav eller med tang, aldri med fingrene.
      </p>
    );
    if (!(d > 0))
      return (
        <>
          <p>
            Uten skjerm når β-partiklene fram til røret. {intro} Prøv papir, og så noen millimeter aluminium.{statistics}
          </p>
          {leadNote}
        </>
      );
    if (mat === 'papir')
      return (
        <>
          <p>
            β går ganske lett gjennom papir: omtrent halvparten stoppes for hver 1,3 mm (13 ark), så med {screenWords(mat, d).toLowerCase()}{' '}
            slipper <strong>{pct}</strong> gjennom. Elektronene har ulik fart, og de langsomste stoppes først. Sporene går i sikksakk inne i
            papiret fordi elektronene støter mot atomene og blir avbøyd.{statistics}
          </p>
          <p>
            Dette brukes i papirfabrikker: en β-kilde under papirbanen og en teller over måler hele tida hvor tykt papiret er. Blir papiret
            tykkere, faller tellerraten, og maskinen justeres.
          </p>
        </>
      );
    if (d >= R)
      return (
        <>
          <p>
            <strong>{screenWords(mat, d)}</strong> stopper alle β-partiklene: ingen kommer gjennom mer enn ca. {fmt(R, R < 2 ? 1 : 0)} mm{' '}
            {MATERIALS[mat].name.toLowerCase()}.{' '}
            {mat === 'aluminium'
              ? 'Det er derfor vi sier at β stoppes av noen millimeter aluminium.'
              : 'Bly er over fire ganger så tett som aluminium, så her holder ca. 1 mm.'}
          </p>
          {backgroundOnly}
          {leadNote}
        </>
      );
    return (
      <>
        <p>
          Aluminium stopper β mye raskere enn papir: omtrent halvparten for hver 0,4 mm. Med {fmt(d, 1)} mm slipper <strong>{pct}</strong>{' '}
          gjennom. Elektronene har ulik fart, så de langsomste stoppes først, og ingen kommer gjennom mer enn ca. 4 mm.{statistics}
        </p>
        {leadNote}
      </>
    );
  }

  // γ
  const xray = (
    <p>
      Røntgenstråling er også fotoner, men med lavere energi, så der holder det med mye tynnere bly. Den som tar røntgenbilder, går ut av rommet
      eller står bak en skjerm med bly: hen tar bilder mange ganger hver dag, og avstand og skjerming holder dosen lav. Tre regler for strålevern:
      kort tid, stor avstand og god skjerming.
    </p>
  );
  if (!(d > 0))
    return (
      <>
        <p>
          Uten skjerm når γ-strålingen fram til røret. γ-stråling er fotoner, elektromagnetisk stråling som lys, men med svært høy energi. De har
          ingen ladning og ioniserer sjelden, så de kan gå langt gjennom stoff. Telleren registrerer bare en liten del av fotonene som går gjennom
          røret, derfor gir γ-kilden færre klikk enn α- og β-kildene.{statistics}
        </p>
        {xray}
      </>
    );
  if (mat === 'papir')
    return (
      <>
        <p>
          Papir merkes nesten ikke: halveringstykkelsen for γ er ca. 14 cm papir, så med {screenWords(mat, d).toLowerCase()} slipper{' '}
          <strong>{pct}</strong> gjennom. Prøv bly.{statistics}
        </p>
        {xray}
      </>
    );
  if (mat === 'aluminium')
    return (
      <>
        <p>
          Aluminium svekker γ lite: halveringstykkelsen er ca. 4,7 cm, så med {fmt(d, 1)} mm slipper <strong>{pct}</strong> gjennom. Det er
          massen som skjermer. Bly er over fire ganger så tett som aluminium, og 1 cm bly skjermer omtrent like godt som 4,7 cm aluminium.
          {statistics}
        </p>
        {xray}
      </>
    );
  const halvings = d / GAMMA_HALF.bly;
  return (
    <>
      <p>
        Hver centimeter bly halverer γ-strålingen fra kobolt-60 (halveringstykkelsen d<Sub>½</Sub> er ca. 1,0 cm). {fmt(d, 0)} mm er{' '}
        {fmt(halvings, 1)} halveringstykkelser, så <strong>{pct}</strong> slipper gjennom. Strålingen blir aldri helt borte, bare svakere og
        svakere, på samme måte som antall kjerner som er igjen etter hver halveringstid.
        {d >= 50 ? ' Med 5 cm bly kommer det like mye stråling fra kilden som fra bakgrunnen.' : ''}
        {statistics}
      </p>
      <p>
        Bly stopper altså ikke γ, det svekker den. For å få strålingen ned til 1 % trengs ca. 6,6 halveringstykkelser, altså 6,6 cm bly. Rom med
        sterke γ-kilder på sykehus og i industrien har derfor tykke vegger av betong eller bly.
      </p>
      {xray}
    </>
  );
}
