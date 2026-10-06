import { useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
  type SimClock,
} from '../../kit';
import { BallsparkScene, sceneCaption, sceneLabel, sceneViewBox } from './ballspark-scene';
import { ForceGraph, Sammenligning, compareHeight, fDecimals, forceText, impulseText, inUnit, msText } from './ballspark-graf';
import {
  SPORTS,
  SPORT_IDS,
  kick,
  kickAt,
  speedLevel,
  typicalKick,
  type KickResult,
  type KickState,
  type PulseShape,
  type SportId,
  type SportSpec,
} from './model-ballspark';
import { useNarrow } from './useNarrow';

type Values = Record<SportId, { dtMs: number; F: number }>;

const DEFAULTS: Values = {
  fotball: { dtMs: SPORTS.fotball.dtMs.def, F: SPORTS.fotball.F.def },
  tennis: { dtMs: SPORTS.tennis.dtMs.def, F: SPORTS.tennis.F.def },
  golf: { dtMs: SPORTS.golf.dtMs.def, F: SPORTS.golf.F.def },
};

const SHAPES: { value: PulseShape; label: string }[] = [
  { value: 'bue', label: 'Bueform' },
  { value: 'trekant', label: 'Trekantform' },
];

/** Avspillingen starter ett sekund før treffet (i sakte film). */
const preMs = (s: SportSpec) => s.slowmo * 1000;

export default function Ballspark() {
  const [sportId, setSportId] = useState<SportId>('fotball');
  const [shape, setShape] = useState<PulseShape>('bue');
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const sport = SPORTS[sportId];
  const { dtMs, F: Fmax } = values[sportId];
  const shot = { sport, Fmax, dtMs, shape };
  const res = kick(sport.m, Fmax, dtMs / 1000, shape);
  const clock = useSimClock({ tMax: (preMs(sport) + sport.tAxisMs) / 1000, speed: sport.slowmo });
  const snapshot = !playing;
  const tMs = snapshot ? dtMs / 2 : clock.t * 1000 - preMs(sport);
  const st = kickAt(sport.m, Fmax, dtMs / 1000, shape, tMs / 1000);
  const [sceneRef, narrowScene] = useNarrow<HTMLDivElement>();
  const [graphRef, narrowGraph] = useNarrow<HTMLDivElement>();
  const [cmpRef, narrowCmp] = useNarrow<HTMLDivElement>();
  const graphH = narrowGraph ? 560 : 340;

  const stopPlayback = () => {
    clock.reset();
    setPlaying(false);
  };
  const onPlay = () => {
    if (!playing) {
      setPlaying(true);
      clock.setT(0);
      clock.play();
    } else clock.toggle();
  };
  const setValue = (key: 'dtMs' | 'F', v: number) => {
    stopPlayback();
    setValues((prev) => ({ ...prev, [sportId]: { ...prev[sportId], [key]: v } }));
  };
  const kN = sport.forceUnit === 'kN';
  const fDec = fDecimals(sport);
  const tDec = sport.dtMs.step < 0.1 ? 2 : 1;
  const slower = Math.round(1 / sport.slowmo);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg ball"
          options={SPORT_IDS.map((id) => ({ value: id, label: SPORTS[id].label }))}
          value={sportId}
          onChange={(v) => {
            stopPlayback();
            setSportId(v);
          }}
        />
        <Segmented
          label="Form på kraftkurven"
          options={SHAPES}
          value={shape}
          onChange={(v) => {
            stopPlayback();
            setShape(v);
          }}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Kontakttid Δt"
          value={dtMs}
          onChange={(v) => setValue('dtMs', v)}
          min={sport.dtMs.min}
          max={sport.dtMs.max}
          step={sport.dtMs.step}
          unit="ms"
          decimals={tDec}
        />
        <Slider
          label={
            <span>
              Største kraft F<Sub>maks</Sub>
            </span>
          }
          ariaLabel="Største kraft"
          value={kN ? Fmax / 1000 : Fmax}
          onChange={(v) => setValue('F', Math.round(kN ? v * 1000 : v))}
          min={kN ? sport.F.min / 1000 : sport.F.min}
          max={kN ? sport.F.max / 1000 : sport.F.max}
          step={kN ? sport.F.step / 1000 : sport.F.step}
          unit={sport.forceUnit}
          decimals={fDec}
        />
      </Controls>
      <PlayBar
        clock={clock}
        active={playing}
        onPlay={onPlay}
        onReset={stopPlayback}
        time={
          snapshot ? (
            <>t = {msText(sport, tMs)} ms (midt i treffet)</>
          ) : (
            <>
              t = {msText(sport, tMs)} ms ({fmt(slower, 0)} ganger langsommere)
            </>
          )
        }
      />

      <div ref={sceneRef}>
        <Figure viewBox={sceneViewBox(sportId, narrowScene)} label={sceneLabel(sportId, shot)} maxHeight={400} caption={sceneCaption(sportId)}>
          <BallsparkScene shot={shot} sportId={sportId} tMs={tMs} snapshot={snapshot} narrow={narrowScene} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over kraften på ballen under treffet. Arealet under grafen er impulsen.">
          <ForceGraph sport={sport} Fmax={Fmax} dtMs={dtMs} shape={shape} tMs={tMs} playing={playing} height={graphH} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Impuls I = Δp" value={fmt(res.I, res.I < 10 ? 2 : 1)} unit="N·s" tone={VIZ.applied} />
        <Readout
          label={
            <span>
              Gjennomsnittskraft F<Sub>gj</Sub>
            </span>
          }
          value={fmt(inUnit(sport, res.Favg), kN ? 2 : 0)}
          unit={sport.forceUnit}
        />
        <Readout label="Fart etter treffet v" value={fmt(res.v, 1)} unit="m/s" tone={VIZ.velocity} />
        <Readout label="Farten i km/h" value={fmt(res.kmh, 0)} unit="km/h" tone={VIZ.velocity} />
      </Readouts>

      <Formula label="Impulsloven">
        <FormulaLine>
          I = arealet = {shape === 'bue' ? '(2/π)' : '½'} · F<Sub>maks</Sub> · Δt = {shape === 'bue' ? '(2/π)' : '½'} · {fmt(Fmax, 0)} N ·{' '}
          {fmt(dtMs / 1000, dtMs < 1 ? 5 : 4)} s = {impulseText(res.I)}
        </FormulaLine>
        <FormulaLine>
          F<Sub>gj</Sub> = I/Δt = {impulseText(res.I)} / {fmt(dtMs / 1000, dtMs < 1 ? 5 : 4)} s = {fmt(res.Favg, 0)} N
        </FormulaLine>
        <FormulaLine>
          I = Δp = m · v − m · v<Sub>0</Sub> = m · v, fordi ballen lå i ro (v<Sub>0</Sub> = 0)
        </FormulaLine>
        <FormulaLine>
          v = I/m = {impulseText(res.I)} / {fmt(sport.m, 3)} kg = {fmt(res.v, 1)} m/s = {fmt(res.kmh, 0)} km/h
        </FormulaLine>
      </Formula>

      <div ref={cmpRef}>
        <Figure
          viewBox={`0 0 800 ${compareHeight(narrowCmp)}`}
          label="Søylediagram: impuls, masse og fart for fotballen, tennisballen og golfballen."
          caption={`${sport.label}: verdiene du har valgt. De to andre ballene: typiske treff.`}
        >
          <Sammenligning sportId={sportId} Fmax={Fmax} dtMs={dtMs} shape={shape} narrow={narrowCmp} />
        </Figure>
      </div>

      <Explain>{explanation(sport, shot, res, snapshot, st)}</Explain>
    </VizLayout>
  );
}

/** Som PlayBar i «impuls»: spill av treffet i sakte film, eller gå tilbake til øyeblikksbildet midt i treffet. */
function PlayBar({ clock, active, onPlay, onReset, time }: { clock: SimClock; active: boolean; onPlay: () => void; onReset: () => void; time: ReactNode }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={onPlay} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : active ? 'Spill av' : 'Spill av i sakte film'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onReset} disabled={!active}>
        <RotateCcw size={16} aria-hidden />
        Vis midt i treffet
      </button>
      <span className="viz-play-time" aria-live="off">
        {time}
      </span>
      {reducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * a sammenlignet med b i ord: «like lang som i et typisk spark», «dobbelt så stor som …», «1,5 ganger så stor som …»
 * eller «40 % av den i et typisk spark».
 */
function compare(a: number, b: number, adj: string, pron: string, typical: string): string {
  const k = a / b;
  if (Math.abs(k - 1) < 0.005) return `like ${adj} som i ${typical}`;
  if (Math.abs(k - 2) < 0.02) return `dobbelt så ${adj} som i ${typical}`;
  if (Math.abs(k - 0.5) < 0.005) return `halvparten så ${adj} som i ${typical}`;
  if (k > 1) return `${fmt(k, 1)} ganger så ${adj} som i ${typical}`;
  return `${fmt(k * 100, 0)} % av ${pron} i ${typical}`;
}

function explanation(sport: SportSpec, shot: { Fmax: number; dtMs: number; shape: PulseShape }, res: KickResult, snapshot: boolean, st: KickState): ReactNode {
  const { Fmax, dtMs, shape } = shot;
  const level = speedLevel(sport, res.v);
  const typ = typicalKick(sport, shape);
  const ball = sport.ball;
  const Ball = cap(ball);
  const typical = `${sport.hit.a} typisk ${sport.hit.noun}`;
  const sameDt = Math.abs(dtMs - sport.dtMs.def) < 1e-9;
  const sameF = Math.abs(Fmax - sport.F.def) < 1e-9;
  const areaWord = (
    <>
      {shape === 'bue' ? 'Under en halv sinusbue er arealet 2/π ≈ 0,64 av rektangelet' : 'Under en trekant er arealet ½ av rektangelet'} F
      <Sub>maks</Sub> · Δt. Det stiplete rektangelet har samme areal, og høyden er gjennomsnittskraften F<Sub>gj</Sub> = I/Δt ={' '}
      {forceText(sport, res.Favg)}.
    </>
  );

  const p1 = (
    <p>
      <strong>
        {cap(level.text)}: {fmt(res.v, 1)} m/s ({fmt(res.kmh, 0)} km/h).
      </strong>{' '}
      {cap(sport.hitter)} presser på {ball} i Δt = {msText(sport, dtMs)} ms med en kraft som bygges opp til F<Sub>maks</Sub> ={' '}
      {forceText(sport, Fmax, fDecimals(sport))} og avtar igjen. Arealet under F-t-grafen er impulsen I = {impulseText(res.I)}. {Ball} lå i ro, så
      impulsloven gir I = Δp = m · v, og v = I/m = {fmt(res.v, 1)} m/s.
    </p>
  );

  let p2: ReactNode;
  if (!snapshot && st.phase === 'for') {
    p2 = (
      <p>
        {cap(sport.hitter)} er på vei mot ballen. {Ball} ligger i ro, så bevegelsesmengden er p = 0, og {sport.hitter} har ennå ikke
        begynt å skyve på den: F = 0, og arealet under grafen er null.
      </p>
    );
  } else if (!snapshot && st.phase === 'under') {
    p2 = (
      <p>
        Nå presses {ball} flat mot {sport.hitter}. Arealet så langt er I = {impulseText(st.I)}, så ballen har allerede fått v = I/m ={' '}
        {fmt(st.v, 1)} m/s. Farten øker så lenge kraften virker, også mens kraften avtar mot slutten av treffet. Etter Newtons 3. lov
        virker en like stor kraft fra ballen tilbake på {sport.hitter}, så {sport.hitter} bremses litt.
      </p>
    );
  } else if (!snapshot) {
    p2 = (
      <p>
        {Ball} har sluppet {sport.hitter} etter {msText(sport, dtMs)} ms. Nå er F = 0, men ballen fortsetter med {fmt(res.v, 1)} m/s: den
        har fått bevegelsesmengden p = m · v = {fmt(res.p, res.p < 10 ? 2 : 1)} kg·m/s, ikke «kraft i seg». Tyngden og luftmotstanden
        er så små at de ikke merkes i løpet av noen millisekunder. {cap(sport.hitter)} er saktere enn ballen nå, så avstanden
        mellom dem vokser.
      </p>
    );
  } else if (sameDt && sameF) {
    p2 = (
      <p>
        Dette er {typical}. Legg merke til at ballen presses flat: ballen og {sport.hitter} gir etter som fjærer og spretter ut
        igjen, og derfor bygges kraften opp og avtar. Gjør kontakttiden dobbelt så lang, eller den største kraften dobbelt så stor: da
        blir både arealet og farten dobbelt så store. Det er arealet som avgjør farten, ikke bare hvor hard {sport.hitter} treffer.{' '}
        {areaWord}
      </p>
    );
  } else {
    p2 = (
      <p>
        Kontakttiden er {compare(dtMs, sport.dtMs.def, 'lang', 'den', typical)} ({msText(sport, sport.dtMs.def)} ms), og den største
        kraften er {compare(Fmax, sport.F.def, 'stor', 'den', typical)} ({forceText(sport, sport.F.def, fDecimals(sport))}). Da blir
        både arealet og farten {compare(res.I, typ.I, 'store', 'verdiene', typical)} (der farten er {fmt(typ.v, 1)} m/s). Det er
        arealet som avgjør farten, ikke bare hvor hard {sport.hitter} treffer. {areaWord}
      </p>
    );
  }

  // Sammenlign med en annen ball: fotball mot golf, golf og tennis mot fotball.
  const otherId: SportId = sport.id === 'fotball' ? 'golf' : 'fotball';
  const other = SPORTS[otherId];
  const o = typicalKick(other, shape);
  const moreI = res.I > o.I;
  const moreV = res.v > o.v;
  const p3 = (
    <p>
      Sammenlign med {otherId === 'golf' ? 'et typisk golfslag' : 'et typisk spark'}: {other.hitter} treffer {other.ball} på{' '}
      {msText(other, other.dtMs.def)} ms med F<Sub>maks</Sub> = {forceText(other, other.F.def, fDecimals(other))}, og {other.ball} på{' '}
      {fmt(other.m * 1000, other.m < 0.1 ? 1 : 0)} g får I = {impulseText(o.I)} og v = {fmt(o.v, 1)} m/s.{' '}
      {moreI !== moreV
        ? `${moreI ? `${Ball} får større impuls, men mindre fart` : `${Ball} får mindre impuls, men større fart`}, fordi massen er ${sport.m < other.m ? 'mye mindre' : 'mye større'}: større impuls gir ikke alltid større fart, for det er impulsen delt på massen som avgjør (v = I/m).`
        : `Her får ${ball} både ${moreI ? 'større' : 'mindre'} impuls og ${moreV ? 'større' : 'mindre'} fart. Husk at det er impulsen delt på massen som avgjør farten (v = I/m).`}
    </p>
  );

  const p4 =
    level.id === 'ekstrem' ? (
      <p>
        Her kan du velge kraften og kontakttiden hver for seg. I virkeligheten bestemmes begge av hvor fort {sport.hitter} beveger seg og
        hvor stiv ballen er, så en så stor kraft i så lang tid får ingen til.
      </p>
    ) : shape === 'trekant' ? (
      <p>
        I oppgaver tegnes kraften ofte som en trekant. Med samme topp og bredde er arealet under trekanten (½ · F<Sub>maks</Sub> · Δt) litt
        mindre enn under buen (0,64 · F<Sub>maks</Sub> · Δt), så ballen får litt mindre fart.
      </p>
    ) : null;

  return (
    <>
      {p1}
      {p2}
      {p3}
      {p4}
    </>
  );
}
