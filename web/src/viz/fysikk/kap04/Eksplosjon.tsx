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
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { EksPanel, barDecimals, type EGroup } from './eksplosjon-diagram';
import { RIFLE } from './eksplosjon-deler';
import { RifleScene, rifleLayout, rifleTimeline } from './eksplosjon-gevaer';
import { CartScene, SPRING_TRAVEL, cartLayout, cartTimeline } from './eksplosjon-lab';
import { ARM_PUSH, SkaterScene, phaseAt, phaseTime, skaterLayout, skaterTimeline, useSceneFrame, type Timeline } from './eksplosjon-scene';
import { pushApart, type PushPhase, type PushResult } from './model';
import { useNarrow } from './useNarrow';

type ScenarioId = 'skoyter' | 'fjaer' | 'gevaer';

const OPTIONS: { value: ScenarioId; label: string }[] = [
  { value: 'skoyter', label: 'Skøyteløpere' },
  { value: 'fjaer', label: 'Vogner med fjær' },
  { value: 'gevaer', label: 'Gevær og kule' },
];

const PHASES: { value: PushPhase; label: string }[] = [
  { value: 'for', label: 'Før' },
  { value: 'under', label: 'Under' },
  { value: 'etter', label: 'Etter' },
];

/** Fargene til legeme 1 og 2 i diagrammet (samme fargetone som jakkene og vognene i scenen). */
const C1 = VIZ.series[0] ?? VIZ.velocity;
const C2 = VIZ.series[1] ?? VIZ.gravity;

/** Korte navn til tallene under figuren. */
const SHORT: Record<ScenarioId, [string, string]> = {
  skoyter: ['løper 1', 'løper 2'],
  fjaer: ['vogn 1', 'vogn 2'],
  gevaer: ['geværet', 'kula'],
};

/** Navn på legemene i hver situasjon (bestemt form, til forklaringen). */
const NAMES: Record<ScenarioId, [string, string]> = {
  skoyter: ['skøyteløper 1', 'skøyteløper 2'],
  fjaer: ['vogn 1', 'vogn 2'],
  gevaer: ['geværet', 'kula'],
};

interface SkateInputs {
  m1: number;
  m2: number;
  /** Gjennomsnittskraften i dyttet (N). */
  F: number;
}

interface EnergyInputs {
  m1: number;
  m2: number;
  /** Energien som frigjøres (J). */
  E: number;
}

export default function Eksplosjon() {
  const [id, setId] = useState<ScenarioId>('skoyter');
  const [skate, setSkate] = useState<SkateInputs>({ m1: 80, m2: 40, F: 150 });
  const [carts, setCarts] = useState<EnergyInputs>({ m1: 1, m2: 2, E: 0.75 });
  const [rifle, setRifle] = useState<EnergyInputs>({ m1: 4, m2: 0.01, E: 3500 });
  const [showForces, setShowForces] = useState(true);
  const [sceneRef, frame] = useSceneFrame<HTMLDivElement>();
  const [barsRef, narrow] = useNarrow<HTMLDivElement>();

  // Modellen: to legemer i ro skyves fra hverandre av en konstant kraft mens avstanden mellom dem øker med D.
  const m1 = id === 'skoyter' ? skate.m1 : id === 'fjaer' ? carts.m1 : rifle.m1;
  const m2 = id === 'skoyter' ? skate.m2 : id === 'fjaer' ? carts.m2 : rifle.m2;
  const r: PushResult =
    id === 'skoyter'
      ? pushApart(skate.m1, skate.m2, skate.F, ARM_PUSH)
      : id === 'fjaer'
        ? pushApart(carts.m1, carts.m2, carts.E / SPRING_TRAVEL, SPRING_TRAVEL)
        : pushApart(rifle.m1, rifle.m2, rifle.E / RIFLE.barrel, RIFLE.barrel);
  const spec = { m1, m2, r };

  const skL = skaterLayout(frame.f, frame.narrow);
  const caL = cartLayout(frame.f, frame.narrow);
  const riL = rifleLayout(frame.f, frame.narrow);
  const tl: Timeline = id === 'skoyter' ? skaterTimeline(spec, skL) : id === 'fjaer' ? cartTimeline(spec, caL) : rifleTimeline(spec, riL);
  const H = id === 'skoyter' ? skL.H : id === 'fjaer' ? caL.H : riL.H;

  // Avspillingen: skøyteløperne i ekte tid, vognene i sakte film når de er raske (minst 1,5 s), geværet i sakte film
  // (hele skuddet på ca. 4 s).
  const motion = tl.end - tl.release;
  const speed = id === 'skoyter' ? 1 : id === 'fjaer' ? Math.min(1, motion / 1.5) : tl.end / 4;
  const clock = useSimClock({ tMax: tl.end, speed });
  const { setT, pause } = clock;
  const t = Math.min(clock.t, tl.end);

  // Vis situasjonen etter dyttet når siden åpnes og når situasjonen byttes. «Spill av» starter fra ro.
  const endRef = useRef(tl.end);
  useEffect(() => {
    pause();
    setT(endRef.current);
  }, [id, pause, setT]);
  // Når tallene endres og avspillingen står på slutten, blir den stående på (den nye) slutten.
  useEffect(() => {
    const prev = endRef.current;
    endRef.current = tl.end;
    if (!clock.playing && clock.t >= prev - 1e-12) setT(tl.end);
  }, [tl.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase = phaseAt(tl, r, t);
  const active = phase === 'for' ? 0 : phase === 'etter' ? 1 : null;
  const names = NAMES[id];
  const light = m1 < m2 ? 1 : 2;
  const share2 = (100 * r.Ek2) / Math.max(1e-12, r.Ek1 + r.Ek2);
  const vDec2 = id === 'gevaer' ? 0 : 2;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg situasjon" options={OPTIONS} value={id} onChange={setId} />
      </Toolbar>
      {id === 'skoyter' ? (
        <Controls>
          <Slider
            label={
              <>
                Masse m<Sub>1</Sub>
              </>
            }
            ariaLabel="Masse til skøyteløper 1"
            value={skate.m1}
            onChange={(v) => setSkate((p) => ({ ...p, m1: v }))}
            min={20}
            max={100}
            step={1}
            unit="kg"
          />
          <Slider
            label={
              <>
                Masse m<Sub>2</Sub>
              </>
            }
            ariaLabel="Masse til skøyteløper 2"
            value={skate.m2}
            onChange={(v) => setSkate((p) => ({ ...p, m2: v }))}
            min={20}
            max={100}
            step={1}
            unit="kg"
          />
          <Slider
            label="Dyttekraft F"
            ariaLabel="Gjennomsnittskraften i dyttet"
            value={skate.F}
            onChange={(F) => setSkate((p) => ({ ...p, F }))}
            min={50}
            max={300}
            step={10}
            unit="N"
          />
        </Controls>
      ) : id === 'fjaer' ? (
        <Controls>
          <Slider
            label={
              <>
                Masse m<Sub>1</Sub>
              </>
            }
            ariaLabel="Masse til vogn 1"
            value={carts.m1}
            onChange={(v) => setCarts((p) => ({ ...p, m1: v }))}
            min={0.5}
            max={5}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label={
              <>
                Masse m<Sub>2</Sub>
              </>
            }
            ariaLabel="Masse til vogn 2"
            value={carts.m2}
            onChange={(v) => setCarts((p) => ({ ...p, m2: v }))}
            min={0.5}
            max={5}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label="Energi i fjæra"
            value={carts.E}
            onChange={(E) => setCarts((p) => ({ ...p, E }))}
            min={0.1}
            max={2}
            step={0.05}
            unit="J"
            decimals={2}
          />
        </Controls>
      ) : (
        <Controls>
          <Slider
            label="Masse til geværet"
            value={rifle.m1}
            onChange={(v) => setRifle((p) => ({ ...p, m1: v }))}
            min={2}
            max={8}
            step={0.1}
            unit="kg"
            decimals={1}
          />
          <Slider
            label="Masse til kula"
            value={rifle.m2 * 1000}
            onChange={(g) => setRifle((p) => ({ ...p, m2: g / 1000 }))}
            min={5}
            max={30}
            step={1}
            unit="g"
          />
          <Slider
            label="Energi fra kruttet"
            value={rifle.E / 1000}
            onChange={(kJ) => setRifle((p) => ({ ...p, E: kJ * 1000 }))}
            min={0.5}
            max={4}
            step={0.1}
            unit="kJ"
            decimals={1}
          />
        </Controls>
      )}
      <Toolbar>
        <PlayControls clock={{ ...clock, t }} decimals={id === 'gevaer' ? 4 : 2} />
        <Segmented
          label="Hopp til"
          options={PHASES}
          value={phase}
          onChange={(ph) => {
            pause();
            setT(phaseTime(tl, r, ph));
          }}
        />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure viewBox={`0 0 800 ${H}`} label={sceneLabel(id, m1, m2, r)} maxHeight={460} caption={caption(id, speed)}>
          {id === 'skoyter' ? (
            <SkaterScene spec={spec} layout={skL} tl={tl} t={t} showForces={showForces} />
          ) : id === 'fjaer' ? (
            <CartScene spec={spec} layout={caL} tl={tl} t={t} showForces={showForces} />
          ) : (
            <RifleScene spec={spec} layout={riL} tl={tl} t={t} showForces={showForces} />
          )}
        </Figure>
      </div>

      <div ref={barsRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 2 * BARS_STACKED : BARS_WIDE}`}
          label={`Søylediagram over bevegelsesmengde og kinetisk energi før og etter, for ${names[0]}, ${names[1]} og summen`}
          maxHeight={narrow ? 640 : 360}
        >
          <Bars r={r} stacked={narrow} active={active} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: C1, label: id === 'skoyter' ? 'Skøyteløper 1 (blå jakke)' : id === 'fjaer' ? 'Vogn 1 (blå)' : 'Geværet' },
          { color: C2, label: id === 'skoyter' ? 'Skøyteløper 2 (oransje jakke)' : id === 'fjaer' ? 'Vogn 2 (oransje)' : 'Kula' },
          { color: VIZ.ink, label: 'Sum for begge (Σ)' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <span>
              {id === 'gevaer' ? 'Rekylfart' : `Fart til ${SHORT[id][0]}`}, v<Sub>1</Sub>
            </span>
          }
          value={fmt(r.v1, 2)}
          unit="m/s"
          tone={C1}
        />
        <Readout
          label={
            <span>
              {id === 'gevaer' ? 'Fart til kula' : `Fart til ${SHORT[id][1]}`}, v<Sub>2</Sub>
            </span>
          }
          value={fmt(r.v2, vDec2)}
          unit="m/s"
          tone={C2}
        />
        <Readout label="Σp etter" value={fmt(r.p1 + r.p2, 2)} unit="kg·m/s" />
        <Readout
          label={
            <span>
              Andel av E<Sub>k</Sub> til {SHORT[id][1]}
            </span>
          }
          value={fmt(share2, 1)}
          unit="%"
        />
      </Readouts>

      <Formula label="Bevaring av bevegelsesmengde">
        {id === 'skoyter' && (
          <FormulaLine>
            Impulsloven: I = F · Δt = {fmt(r.F, 0)} N · {fmt(r.dt, 3)} s = {fmt(r.I, 1)} N·s, så p<Sub>2</Sub> = {fmt(r.p2, 1)} kg·m/s og p
            <Sub>1</Sub> = {fmt(r.p1, 1)} kg·m/s
          </FormulaLine>
        )}
        {id === 'gevaer' && (
          <FormulaLine>
            Kraften fra kruttgassen: F = E/s = {fmt(r.E, 0)} J / {fmt(RIFLE.barrel, 2)} m = {fmt(r.F, 0)} N, i Δt = p/F ={' '}
            {fmt(r.dt * 1000, 2)} ms
          </FormulaLine>
        )}
        <FormulaLine>
          Σp = m<Sub>1</Sub>v<Sub>1</Sub> + m<Sub>2</Sub>v<Sub>2</Sub> = {massKg(m1)} · ({fmt(r.v1, 2)} m/s) + {massKg(m2)} · {fmt(r.v2, vDec2)}{' '}
          m/s = 0
        </FormulaLine>
        <FormulaLine>
          v<Sub>2</Sub>/|v<Sub>1</Sub>| = m<Sub>1</Sub>/m<Sub>2</Sub> = {fmt(m1 / m2, m1 / m2 >= 10 ? 0 : 2)}
        </FormulaLine>
        <FormulaLine>
          E<Sub>k</Sub> = p²/(2m) gir E<Sub>k1</Sub> = {energy(r.Ek1)} og E<Sub>k2</Sub> = {energy(r.Ek2)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(id, m1, m2, r, phase, light, showForces)}</Explain>
    </VizLayout>
  );
}

/** Høyden på søylediagrammet: to paneler ved siden av hverandre, eller over hverandre på mobil. */
const BARS_WIDE = 300;
const BARS_STACKED = 400;

function Bars({ r, stacked, active }: { r: PushResult; stacked: boolean; active: number | null }) {
  const height = stacked ? BARS_STACKED : BARS_WIDE;
  const width = stacked ? 800 : 392;
  const zero = (sum: boolean): EGroup => ({
    label: 'Før',
    bars: [
      { value: 0, color: C1, name: '1' },
      { value: 0, color: C2, name: '2' },
      { value: 0, color: VIZ.ink, name: 'Σ', sum },
    ],
  });
  const pGroups: EGroup[] = [
    zero(true),
    {
      label: 'Etter',
      bars: [
        { value: r.p1, color: C1, name: '1' },
        { value: r.p2, color: C2, name: '2' },
        { value: r.p1 + r.p2, color: VIZ.ink, name: 'Σ', sum: true },
      ],
    },
  ];
  const eGroups: EGroup[] = [
    zero(true),
    {
      label: 'Etter',
      bars: [
        { value: r.Ek1, color: C1, name: '1' },
        { value: r.Ek2, color: C2, name: '2' },
        { value: r.Ek1 + r.Ek2, color: VIZ.ink, name: 'Σ', sum: true },
      ],
    },
  ];
  return (
    <>
      <EksPanel
        x={0}
        width={width}
        height={height}
        maxBar={stacked ? 84 : 50}
        decimals={barDecimals([r.p1, r.p2])}
        active={active}
        title={<>Bevegelsesmengde p (kg·m/s)</>}
        groups={pGroups}
        note={{ group: 0, text: 'alt i ro' }}
      />
      {!stacked && <line x1={400} y1={20} x2={400} y2={height - 20} stroke={VIZ.grid} strokeWidth={2} />}
      <g transform={stacked ? `translate(0 ${BARS_STACKED})` : undefined}>
        <EksPanel
          x={stacked ? 0 : 408}
          width={width}
          height={height}
          maxBar={stacked ? 84 : 50}
          decimals={barDecimals([r.Ek1 + r.Ek2])}
          active={active}
          title={
            <>
              Kinetisk energi E<TSub>k</TSub> (J)
            </>
          }
          groups={eGroups}
          note={{ group: 0, text: 'alt i ro' }}
        />
      </g>
    </>
  );
}

/** Masse i kg i utregninger (samme enhet i alle ledd): 0,010 kg, 4,0 kg, 80 kg. */
function massKg(m: number): string {
  return `${fmt(m, m < 0.1 ? 3 : m >= 10 ? 0 : 1)} kg`;
}

function energy(E: number): string {
  return E >= 1000 ? `${fmt(E / 1000, 2)} kJ` : E >= 100 ? `${fmt(E, 0)} J` : E >= 10 ? `${fmt(E, 1)} J` : E >= 1 ? `${fmt(E, 2)} J` : `${fmt(E, 3)} J`;
}

/** Teksten under scenen: hva som er tegnet, og hvor mye saktere avspillingen går. */
function caption(id: ScenarioId, speed: number): string {
  if (id === 'skoyter') return 'Skøyteløperne er tegnet i riktig størrelse etter massen (barn er lavere). Avspillingen går i ekte tid.';
  if (id === 'fjaer')
    return `Snora holder fjæra sammenpresset til den kuttes. ${speed < 0.95 ? `Avspillingen går i sakte film, ${fmt(1 / speed, 1)} ganger saktere.` : 'Avspillingen går i ekte tid.'}`;
  return `Løpet er tegnet gjennomskåret, så du ser kula og kruttgassen inni. Sakte film: 1 ms tar ${fmt(0.001 / speed, 1)} s.`;
}

function sceneLabel(id: ScenarioId, m1: number, m2: number, r: PushResult): string {
  if (id === 'skoyter')
    return `To skøyteløpere på isen, ${fmt(m1, 0)} kg og ${fmt(m2, 0)} kg, dytter hverandre fra hverandre. Etterpå glir skøyteløper 1 med ${fmt(r.v1, 2)} m/s og skøyteløper 2 med ${fmt(r.v2, 2)} m/s.`;
  if (id === 'fjaer')
    return `To dynamikkvogner på en bane i fysikklaben, med en sammenpresset fjær mellom seg. Etter utløsningen får vogn 1 farten ${fmt(r.v1, 2)} m/s og vogn 2 farten ${fmt(r.v2, 2)} m/s.`;
  return `Jaktrifle på sandsekker som skyter ut en kule. Kula får farten ${fmt(r.v2, 0)} m/s, og geværet får rekylfarten ${fmt(r.v1, 2)} m/s.`;
}

function explanation(id: ScenarioId, m1: number, m2: number, r: PushResult, phase: PushPhase, light: 1 | 2, showForces: boolean): ReactNode {
  const p = `${fmt(r.p2, id === 'gevaer' ? 2 : r.p2 >= 10 ? 1 : 2)} kg·m/s`;
  const [n1, n2] = NAMES[id];
  const equal = Math.abs(m1 - m2) < 1e-9;
  const lightName = light === 1 ? n1 : n2;
  const ratio = Math.max(m1, m2) / Math.min(m1, m2);
  const share = (100 * (light === 1 ? r.Ek1 : r.Ek2)) / Math.max(1e-12, r.Ek1 + r.Ek2);

  const start =
    phase === 'for' ? (
      <p>
        <strong>Før {id === 'gevaer' ? 'skuddet' : id === 'fjaer' ? 'utløsningen' : 'dyttet'}</strong> står alt i ro, så Σp = 0 og E
        <Sub>k</Sub> = 0. Trykk «Spill av», eller hopp til «Under» og «Etter».
      </p>
    ) : null;

  const under =
    phase === 'under' ? (
      <p>
        <strong>Under {id === 'gevaer' ? 'skuddet' : 'dyttet'}.</strong>{' '}
        {id === 'skoyter'
          ? 'Skøyteløper 1 dytter på skøyteløper 2, og skøyteløper 2 dytter like hardt tilbake på skøyteløper 1'
          : id === 'fjaer'
            ? 'Fjæra dytter vogn 2 framover og vogn 1 bakover'
            : 'Kruttgassen dytter kula framover og geværet bakover'}{' '}
        med like store krefter (Newtons 3. lov), F = {fmt(r.F, 0)} N. Kreftene virker like lenge, Δt ={' '}
        {id === 'gevaer' ? `${fmt(r.dt * 1000, 2)} ms` : `${fmt(r.dt, 3)} s`}, så begge får like stor impuls, I = F · Δt ={' '}
        {fmt(r.I, 2)} N·s, men i hver sin retning. Midt i dyttet har begge halvparten av sluttfarten, og Σp er fortsatt 0.
      </p>
    ) : null;

  const forces =
    showForces && phase !== 'under' ? (
      <p>
        Med «Vis krefter» ser du kraftparet bare mens det virker: velg «Under», eller spill av og se nøye på
        {id === 'gevaer' ? ' løpet' : id === 'fjaer' ? ' fjæra' : ' hendene'}.
      </p>
    ) : null;

  if (id === 'gevaer') {
    return (
      <>
        {start}
        {under}
        <p>
          <strong>Rekyl.</strong> Kula og geværet får like store og motsatt rettede bevegelsesmengder, p = {p}, så Σp = 0 også etter
          skuddet. Geværet har {fmt(ratio, 0)} ganger så stor masse, så rekylfarten blir bare {fmt(Math.abs(r.v1), 2)} m/s. Fartspila til
          geværet er så kort at den ikke synes i samme skala som pila til kula. Kula får {fmt(share, 1)} % av energien, fordi E
          <Sub>k</Sub> = p²/(2m) er størst for den letteste.
        </p>
        <p>
          Det er derfor geværet slår tilbake i skulderen. Når du holder geværet inntil skulderen, er det du og geværet sammen som får
          rekylen, så massen blir større og farten mindre. Av samme grunn sparker et tungt gevær mindre enn et lett.
        </p>
        {forces}
      </>
    );
  }

  const intern =
    id === 'skoyter' ? (
      <>
        Dyttet er en indre kraft i systemet (begge skøyteløperne). Tyngden og normalkraften fra isen opphever hverandre, og friksjonen
        fra isen er så liten at vi ser bort fra den. Ingen ytre krefter virker vannrett, så Σp kan ikke endre seg.
      </>
    ) : (
      <>Fjærkraften er en indre kraft i systemet (begge vognene), så den kan ikke endre den totale bevegelsesmengden.</>
    );

  return (
    <>
      {start}
      {under}
      <p>
        <strong>Σp = 0 før og etter.</strong> {intern} {id === 'skoyter' ? 'Skøyteløperne' : 'Vognene'} får like store og motsatt rettede
        bevegelsesmengder, p = {p}.{' '}
        {equal ? (
          `Massene er like, så ${id === 'skoyter' ? 'de' : 'vognene'} får like stor fart og deler energien likt.`
        ) : (
          <>
            Den letteste ({lightName}) får {fmt(ratio, ratio >= 10 ? 0 : 1)} ganger så stor fart, fordi |v| = p/m
            {id === 'skoyter' ? ', og glir derfor like mange ganger så langt på samme tid (se s₁ og s₂)' : ''}. Den får også mest energi,{' '}
            {fmt(share, 0)} %, fordi E<Sub>k</Sub> = p²/(2m).
          </>
        )}
      </p>
      <p>
        {id === 'skoyter'
          ? 'Det er derfor du selv glir bakover når du dytter noen på isen: kraften på deg er like stor som kraften på den du dytter. Den som er lettest, får mest fart, uansett hvem som dytter.'
          : 'Det samme skjer når du hopper fra en robåt til brygga: du får fart framover, og båten får like stor bevegelsesmengde bakover. Er båten lett, glir den unna, og du kan havne i vannet.'}
      </p>
      {forces}
    </>
  );
}
