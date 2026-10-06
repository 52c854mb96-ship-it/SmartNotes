import { useEffect, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  G_EARTH,
  useSimClock,
} from '../../kit';
import { LIFT_T_END, liftPhases, liftState, scaleForce, type LiftPhase, type LiftTrip } from './model';
import { LIFT_A0, floorBelow, liftHeight, liftMaxAcceleration, liftMaxSpeed, liftStartHeight, nearestFloor, scaleReading } from './model-heis';
import { HeisGraf } from './heis-graf';
import { HeisScene } from './heis-scene';

const TRIPS: { value: LiftTrip; label: string }[] = [
  { value: 'opp', label: 'Tur opp' },
  { value: 'ned', label: 'Tur ned' },
  { value: 'fritt-fall', label: 'Vaierne ryker' },
];

/** Tidspunktet som vises når siden åpnes eller turen byttes (midt i første akselerasjon). */
const T_START = 2;

export default function Heis() {
  const [trip, setTrip] = useState<LiftTrip>('opp');
  const [m, setM] = useState(70);
  const [a0, setA0] = useState(2);
  const [showForces, setShowForces] = useState(true);
  const clock = useSimClock({ tMax: LIFT_T_END });
  const { setT, pause } = clock;
  useEffect(() => setT(T_START), [setT]);

  const changeTrip = (next: LiftTrip) => {
    setTrip(next);
    pause();
    setT(T_START);
  };

  const t = clock.t;
  const phases = liftPhases(trip, a0);
  const st = liftState(phases, t);
  const G = m * G_EARTH;
  const N = scaleForce(m, st.a);
  const reading = scaleReading(m, st.a);
  const h = liftHeight(trip, a0, t);
  const hStart = liftStartHeight(trip, a0);
  const hEnd = liftHeight(trip, a0, LIFT_T_END);
  const floor = nearestFloor(h);
  const below = floorBelow(h);
  const where = floor.level ? `i ${floor.floor}. etasje` : `mellom ${below}. og ${below + 1}. etasje`;
  const floorText = floor.level ? `${floor.floor}. etasje` : `${below}.–${below + 1}. etasje`;
  const fallen = trip === 'fritt-fall';
  const status = statusText(st.phase, trip, where);

  return (
    <VizLayout>
      <Controls>
        <Slider label="Masse m" value={m} onChange={setM} min={40} max={120} step={1} unit="kg" />
        {!fallen && (
          <Slider
            label="Akselerasjon ved start og stopp"
            value={a0}
            onChange={setA0}
            min={LIFT_A0.min}
            max={LIFT_A0.max}
            step={LIFT_A0.step}
            unit="m/s²"
            decimals={2}
          />
        )}
        <Slider
          label="Tid t"
          value={t}
          onChange={(v) => {
            pause();
            setT(v);
          }}
          min={0}
          max={LIFT_T_END}
          step={0.1}
          unit="s"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <Segmented label="Velg heistur" options={TRIPS} value={trip} onChange={changeTrip} />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>
      <Toolbar>
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>

      <HeisScene
        h={h}
        hStart={hStart}
        hEnd={hEnd}
        floor={floor.floor}
        floorText={floorText}
        v={st.v}
        a={st.a}
        vMax={liftMaxSpeed(trip, a0)}
        aMax={liftMaxAcceleration(trip, a0)}
        G={G}
        N={N}
        reading={reading}
        status={status}
        showForces={showForces}
        broken={fallen && t >= 1}
        braking={st.phase.kind === 'nodbrems'}
        braked={fallen && t >= 5}
        label={`Heis i en boligblokk, ${where}. En person på ${fmt(m, 0)} kg står på en badevekt i heisen. ${status}. Vekta viser ${fmt(
          reading,
          1,
        )} kg.`}
      />

      <HeisGraf phases={phases} trip={trip} t={t} m={m} N={N} G={G} />
      <Legend
        items={[
          { color: VIZ.normal, label: 'Normalkraft N fra vekta' },
          { color: VIZ.gravity, label: 'Tyngde G = mg', dashed: true },
          { color: VIZ.acceleration, label: 'Kraftsum ΣF = N − G = ma' },
        ]}
      />

      <Readouts>
        <Readout label="Akselerasjon a" value={fmt(st.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
        <Readout label="Fart v" value={fmt(st.v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Normalkraft N" value={fmt(N, 0)} unit="N" tone={VIZ.normal} />
        <Readout label="Vekta viser" value={fmt(reading, 1)} unit="kg" />
      </Readouts>

      <Formula label="Newtons 2. lov for personen, med positiv retning oppover">
        <FormulaLine>ΣF = N − G = m · a</FormulaLine>
        <FormulaLine>
          N = m(g + a) = {fmt(m, 0)} kg · (9,81 m/s² {st.a < 0 ? '−' : '+'} {fmt(Math.abs(st.a), 2)} m/s²) = {fmt(N, 0)} N
        </FormulaLine>
        <FormulaLine>
          Vekta viser N/g = {fmt(N, 0)} N / 9,81 m/s² = {fmt(reading, 1)} kg
        </FormulaLine>
      </Formula>

      <Explain>
        {explanation(st.phase, trip, st.a, st.v, N, G, m, reading, t, where)}
        {Math.abs(st.v) > 1e-9 && <p>Kameraet følger heisen, så det er sjakta og etasjene som glir forbi.</p>}
        {(st.a < -1e-9 || st.v < -1e-9) && <p>Positiv retning er oppover, så fart og akselerasjon nedover har negativt fortegn.</p>}
      </Explain>
    </VizLayout>
  );
}

function statusText(phase: LiftPhase, trip: LiftTrip, where: string): string {
  const up = trip === 'opp';
  switch (phase.kind) {
    case 'ro':
      return trip === 'fritt-fall' && phase.t0 > 0 ? 'Står fast i sjakta' : `Står i ro ${where}`;
    case 'akselererer':
      return up ? 'Starter oppover' : 'Starter nedover';
    case 'konstant':
      return up ? 'Konstant fart oppover' : 'Konstant fart nedover';
    case 'bremser':
      return up ? 'Bremser på vei opp' : 'Bremser på vei ned';
    case 'fritt-fall':
      return 'Fritt fall';
    case 'nodbrems':
      return 'Nødbremsen tar tak';
  }
}

function explanation(
  phase: LiftPhase,
  trip: LiftTrip,
  a: number,
  v: number,
  N: number,
  G: number,
  m: number,
  reading: number,
  t: number,
  where: string,
): ReactNode {
  const n = (x: number) => `${fmt(x, 0)} N`;
  const kg = `${fmt(reading, 1)} kg`;
  const up = trip === 'opp';
  switch (phase.kind) {
    case 'ro':
      if (trip === 'fritt-fall' && phase.t0 > 0)
        return (
          <p>
            <strong>Heisen står fast {where}.</strong> Fangeren holder heisen fast i skinnene, a = 0 og N = G = {n(G)}. Vekta viser massen din
            igjen, {fmt(m, 0)} kg. Ekte heiser har flere vaiere som hver alene kan holde heisen, og en fartsregulator som utløser fangeren
            lenge før farten blir så stor som her.
          </p>
        );
      return (
        <p>
          <strong>Heisen står i ro {where}.</strong> Da er a = 0, og kraftsummen på deg er null: N = G = mg = {n(G)}. Vekta måler hvor hardt
          føttene trykker på den, og det er like stort som N (Newtons 3. lov). Den deler på g og viser massen din, {fmt(m, 0)} kg.
          {t < 1 && ` Trykk «Spill av» for å se hva som skjer når ${trip === 'fritt-fall' ? 'vaierne ryker' : 'heisen setter i gang'}.`}
        </p>
      );
    case 'akselererer':
      return up ? (
        <p>
          <strong>Heisen øker farten oppover.</strong> Akselerasjonen peker oppover, så kraftsummen må også peke oppover: N må være større
          enn G. N = m(g + a) = {n(N)}, og vekta viser {kg}. Det vekta viser, kalles den tilsynelatende vekten. Det er derfor du kjenner
          et trykk i knærne når heisen setter i gang oppover.
        </p>
      ) : (
        <p>
          <strong>Heisen øker farten nedover.</strong> Akselerasjonen peker nedover, så kraftsummen peker nedover og N er mindre enn G: N =
          m(g − {fmt(Math.abs(a), 2)} m/s²) = {n(N)}. Vekta viser bare {kg}. Det er derfor det kiler i magen når heisen setter i gang
          nedover.
        </p>
      );
    case 'konstant':
      return (
        <p>
          <strong>Konstant fart {up ? 'oppover' : 'nedover'}.</strong> Heisen beveger seg med {fmt(Math.abs(v), 1)} m/s, men farten endrer
          seg ikke, så a = 0 og N = G = {n(G)} (Newtons 1. lov). Vekta viser det samme som når heisen står stille: det er akselerasjonen,
          ikke farten, som bestemmer hva vekta viser. Det er derfor du ikke merker at heisen kjører midt i turen, bare når den starter og
          stopper.
        </p>
      );
    case 'bremser':
      return up ? (
        <p>
          <strong>Heisen bremser på vei opp.</strong> Den beveger seg fortsatt oppover, men farten avtar, så akselerasjonen peker{' '}
          <em>nedover</em>. Da er N mindre enn G: N = {n(N)}, og vekta viser {kg}. Du føler deg lettere selv om du er på vei opp, og det
          kjennes som om du fortsetter litt oppover når heisen stopper.
        </p>
      ) : (
        <p>
          <strong>Heisen bremser på vei ned.</strong> Farten nedover avtar, så akselerasjonen peker <em>oppover</em>, akkurat som når heisen
          starter oppover. N = m(g + a) = {n(N)} er større enn G, og vekta viser {kg}. Det er derfor du kjenner det i knærne når heisen
          stopper i 1. etasje.
        </p>
      );
    case 'fritt-fall':
      return (
        <p>
          <strong>Fritt fall.</strong> Vaierne har røket, og både heisen og du faller med a = g = 9,81 m/s² nedover. Tyngden alene gir deg
          denne akselerasjonen, så vekta trenger ikke å dytte: N = m(g − g) = 0. Vekta viser 0 kg og du er vektløs, men tyngden G = {n(G)}{' '}
          virker fortsatt. Det er den samme følelsen du får i et fritt fall-tårn i en fornøyelsespark.
        </p>
      );
    case 'nodbrems':
      return (
        <p>
          <strong>Nødbremsen tar tak.</strong> Fangeren under heisen kiler seg fast i føringsskinnene og bremser heisen med a = g oppover mens
          den fortsatt faller ({fmt(Math.abs(v), 1)} m/s nedover). N = m(g + g) = 2mg = {n(N)}, så vekta viser dobbelt så mye som i ro: {kg}.
        </p>
      );
  }
}
