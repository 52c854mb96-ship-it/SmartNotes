import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
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
  Sup,
  Toolbar,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
  type SimClock,
} from '../../kit';
import { KjedeScene, SCENE_W, kjedeLayout } from './kjedereaksjon-scene';
import { BAR_COLOR, CURVE_COLOR, KjedeGraf, sigText } from './kjedereaksjon-graf';
import {
  CAPTURE_PCT,
  CHANNELS,
  GRAPH_GENERATIONS,
  NU,
  NUCLIDES,
  PRESETS,
  REACTOR_THERMAL_W,
  TREE_GENERATIONS,
  buildChainTree,
  expectedFissions,
  fissionEnergy,
  fissionTime,
  fissionsPerSecond,
  generationAt,
  generationsToDoubleOrHalve,
  multiplicationFactor,
  presetFor,
  regime,
  treeTMax,
  u235KgPerDay,
  type ChainTree,
  type PresetId,
} from './model-kjedereaksjon';

/** Én generasjon i avspillingen tar ca. 1,1 s. */
const SPEED = 0.9;
const T_MAX = treeTMax(TREE_GENERATIONS);

const PRESET_LABELS: Record<PresetId, string> = {
  ned: 'k < 1: dør ut',
  jevn: 'k = 1: jevn',
  opp: 'k > 1: vokser',
};

/** Om elementet er smalere enn `limit` piksler (mobil): da står bassenget over utsnittet. */
function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Spill av / pause, start på nytt, ny kjede og hvilken generasjon som er i gang. */
function GenerasjonsBar({ clock, text, onNewChain }: { clock: SimClock; text: string; onNewChain: () => void }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onNewChain}>
        <Shuffle size={16} aria-hidden />
        Ny kjede
      </button>
      <span className="viz-play-time" aria-live="off">
        {text}
      </span>
      {prefersReducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}

/**
 * Fisjon og kjedereaksjon (8B, 8C): et nøytron spalter U-235 i to mindre kjerner og 2–3 nye nøytroner. Eleven styrer
 * hvor stor andel av nøytronene kontrollstavene fanger, og ser kjedereaksjonen dø ut (k < 1), holde seg jevn (k = 1,
 * slik et kjernekraftverk går) eller vokse (k > 1). Treet er deterministisk med frø.
 */
export default function Kjedereaksjon() {
  const [pct, setPct] = useState<number>(CAPTURE_PCT.initial);
  const [seed, setSeed] = useState(1);
  const clock = useSimClock({ tMax: T_MAX, speed: SPEED });
  const { setT, pause } = clock;
  // Siden åpner med hele treet. «Spill av» starter fra startnøytronet.
  useEffect(() => setT(T_MAX), [setT]);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();

  const f = pct / 100;
  const k = multiplicationFactor(f);
  const reg = regime(k, 1e-9);
  const tree = useMemo<ChainTree>(() => buildChainTree(k, seed), [k, seed]);
  const t = clock.t;
  const done = t >= T_MAX - 1e-9;
  const gen = generationAt(t);
  const shownGen = Math.max(0, gen);
  const fissionsNow = tree.counts[shownGen] ?? 0;
  // Effekten nå: antall fisjoner i generasjonen som er i gang (0 før startnøytronet treffer).
  const glow = gen < 0 ? 0 : Math.min(1, 0.25 + 0.75 * Math.min(1, fissionsNow / 4));
  const happened = tree.fissions.filter((x) => fissionTime(x.gen) <= t + 1e-9);
  const energyNow = happened.reduce((s, x) => s + fissionEnergy(CHANNELS[x.channel]).EMeV, 0);

  const change = (v: number) => {
    setPct(Math.round(v));
    pause();
    setT(T_MAX);
  };
  const pick = (id: PresetId | 'egen') => {
    const p = PRESETS.find((x) => x.id === id);
    if (p) change(p.capturePct);
  };
  const newChain = () => {
    setSeed((s) => s + 1);
    pause();
    setT(T_MAX);
  };

  const L = kjedeLayout(narrow);
  const graphH = narrow ? 520 : 340;
  const k10 = expectedFissions(k, GRAPH_GENERATIONS);
  const died = tree.counts.findIndex((n) => n === 0);
  const timeText = gen < 0 ? 'Startnøytronet er på vei' : done ? `Alle ${TREE_GENERATIONS + 1} generasjonene` : `Generasjon ${gen} av ${TREE_GENERATIONS}`;

  const sceneLabel =
    `Reaktorbasseng med kontrollstavene ${fmt(f * 100, 0)} prosent nede i kjernen, og et forstørret utsnitt av brenselet. ` +
    `Kjedetreet har ${tree.counts.join(', ')} fisjoner i generasjon 0 til ${TREE_GENERATIONS}. ` +
    `Hver fisjon gir 2 eller 3 nøytroner, og kontrollstavene fanger ${fmt(f * 100, 0)} prosent av dem, så k = ${fmt(k, 2)}.`;
  const graphLabel = `Søylediagram over fisjoner per generasjon i treet, og kurven k opphøyd i g. Etter ${GRAPH_GENERATIONS} generasjoner er det ${sigText(k10)} ganger så mange fisjoner som i starten.`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg formeringsfaktor"
          options={PRESETS.map((p) => ({ value: p.id, label: PRESET_LABELS[p.id] }))}
          value={presetFor(pct) ?? ('egen' as PresetId)}
          onChange={pick}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Nøytroner som fanges av kontrollstavene"
          value={pct}
          onChange={change}
          min={CAPTURE_PCT.min}
          max={CAPTURE_PCT.max}
          step={CAPTURE_PCT.step}
          format={(v) => `${fmt(v, 0)} %`}
        />
      </Controls>
      <Toolbar>
        <GenerasjonsBar clock={clock} text={timeText} onNewChain={newChain} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure viewBox={`0 0 ${SCENE_W} ${L.h}`} label={sceneLabel} maxHeight={narrow ? 1000 : 520}>
          <KjedeScene tree={tree} capture={f} t={t} glow={glow} narrow={narrow} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${graphH}`} label={graphLabel}>
        <KjedeGraf k={k} counts={tree.counts} current={done ? -1 : gen} width={800} height={graphH} />
      </Figure>

      <Readouts>
        <Readout label="Formeringsfaktor k" value={fmt(k, 2)} tone={CURVE_COLOR} />
        <Readout label={`Fisjoner i generasjon ${shownGen}`} value={String(fissionsNow)} tone={BAR_COLOR} />
        <Readout label={`Effekt etter ${GRAPH_GENERATIONS} generasjoner`} value={sigText(k10 * 100)} unit="%" />
        <Readout label="Energi frigjort i treet" value={fmt(energyNow, 0)} unit="MeV" />
      </Readouts>

      <Formula label="Kjedereaksjonen og energien med levende tall">
        <Calculation k={k} f={f} tree={tree} />
      </Formula>

      <Explain>{explanation({ k, f, reg, tree, died })}</Explain>
    </VizLayout>
  );
}

/* ---------- Utregningen ---------- */

const u4 = (v: number) => fmt(v, 4);

function Reaction({ neutrons }: { neutrons: 2 | 3 }) {
  const ch = neutrons === 3 ? CHANNELS['ba-kr'] : CHANNELS['xe-sr'];
  const [a, b] = ch.fragments;
  return (
    <>
      <Sup>235</Sup>U + n → <Sup>{a.A}</Sup>
      {a.symbol} + <Sup>{b.A}</Sup>
      {b.symbol} + {neutrons}n
    </>
  );
}

function Calculation({ k, f, tree }: { k: number; f: number; tree: ChainTree }) {
  const first = tree.fissions[0]!;
  const ch = CHANNELS[first.channel];
  const E = fissionEnergy(ch);
  const [a, b] = ch.fragments;
  const { n, U235 } = NUCLIDES;
  const perS = fissionsPerSecond(REACTOR_THERMAL_W, E.EJ);
  return (
    <>
      <FormulaLine>
        k = ν · (1 − andel fanget) = {fmt(NU, 1)} · (1 − {fmt(f, 2)}) = {fmt(k, 2)}
      </FormulaLine>
      <FormulaLine>
        N = N<Sub>0</Sub> · k<Sup>g</Sup> gir etter {GRAPH_GENERATIONS} generasjoner N = 1 · {fmt(k, 2)}
        <Sup>{GRAPH_GENERATIONS}</Sup> = {sigText(expectedFissions(k, GRAPH_GENERATIONS))}
      </FormulaLine>
      <FormulaLine>
        Første fisjon i treet: <Reaction neutrons={ch.neutrons} />. Nukleontall: {E.A[0]} = {E.A[1]}, ladning: {E.Z[0]} = {E.Z[1]}
      </FormulaLine>
      <FormulaLine>
        Δm = ({u4(U235.mass)} u + {u4(n.mass)} u) − ({u4(a.mass)} u + {u4(b.mass)} u + {ch.neutrons} · {u4(n.mass)} u) = {u4(E.dm)} u
      </FormulaLine>
      <FormulaLine>
        E = Δm · c<Sup>2</Sup> = {u4(E.dm)} · 1,66 · 10<Sup>−27</Sup> kg · (3,00 · 10<Sup>8</Sup> m/s)<Sup>2</Sup> = {fmtSci(E.EJ, 2)} J ={' '}
        {fmt(E.EMeV, 0)} MeV
      </FormulaLine>
      <FormulaLine>
        En reaktor på {fmt(REACTOR_THERMAL_W / 1e6, 0)} MW trenger {fmtSci(REACTOR_THERMAL_W, 2)} W / {fmtSci(E.EJ, 2)} J = {fmtSci(perS, 2)} fisjoner
        per sekund
      </FormulaLine>
      <FormulaLine>
        Det er ca. {fmt(u235KgPerDay(REACTOR_THERMAL_W, E.EJ), 1)} kg U-235 i døgnet
      </FormulaLine>
    </>
  );
}

/* ---------- Forklaringen ---------- */

function explanation({ k, f, reg, tree, died }: { k: number; f: number; reg: ReturnType<typeof regime>; tree: ChainTree; died: number }): ReactNode {
  const kTxt = fmt(k, 2);
  const caught = NU * f;
  const k10 = expectedFissions(k, GRAPH_GENERATIONS);
  const gens = generationsToDoubleOrHalve(k);
  const flatTree = tree.counts.every((c) => c === 1);
  const ba = fissionEnergy(CHANNELS['ba-kr']);

  let main: ReactNode;
  if (reg === 'jevn') {
    main = (
      <p>
        <strong>k = 1,00: kjedereaksjonen går jevnt (kritisk).</strong> Hver fisjon gir 2 eller 3 nøytroner, i gjennomsnitt {fmt(NU, 1)}. Kontrollstavene
        fanger {fmt(f * 100, 0)} %, altså {fmt(caught, 1)} av dem, så nøyaktig ett nøytron per fisjon spalter en ny kjerne. Da er det like mange fisjoner i
        hver generasjon, og reaktoren gir jevn effekt. Slik går et kjernekraftverk nesten hele tida. «Kritisk» høres farlig ut, men betyr bare at
        kjedereaksjonen holder seg selv i gang uten å vokse.
      </p>
    );
  } else if (reg === 'dor-ut') {
    main = (
      <p>
        <strong>k = {kTxt} &lt; 1: kjedereaksjonen dør ut (underkritisk).</strong> Kontrollstavene fanger {fmt(f * 100, 0)} % av nøytronene, så av de{' '}
        {fmt(NU, 1)} nøytronene fra hver fisjon spalter i gjennomsnitt bare {kTxt} en ny kjerne. Antallet fisjoner ganges med {kTxt} for hver
        generasjon og halveres etter ca. {fmt(gens, 1)} generasjoner. Etter {GRAPH_GENERATIONS} generasjoner er bare {sigText(k10 * 100)} % igjen.{' '}
        {died > 0 ? (
          <>
            I treet dør kjeden ut etter generasjon {died - 1}: alle nøytronene derfra fanges, og ingen spalter en ny U-235-kjerne.{' '}
          </>
        ) : flatTree ? (
          <>Med k så nær 1 synes det ikke i de seks generasjonene i treet, men grafen viser at det går nedover. </>
        ) : null}
        Slik stenges en reaktor: kontrollstavene senkes helt ned. Uranet er ikke brukt opp, det er nøytronene som mangler.
      </p>
    );
  } else {
    main = (
      <p>
        <strong>k = {kTxt} &gt; 1: kjedereaksjonen vokser (overkritisk).</strong> Kontrollstavene fanger bare {fmt(f * 100, 0)} %, så hver fisjon gir i
        gjennomsnitt {kTxt} nye. Antallet ganges med {kTxt} for hver generasjon og dobles etter ca. {fmt(gens, 1)} generasjoner: etter{' '}
        {GRAPH_GENERATIONS} generasjoner er det {sigText(k10)} ganger så mange fisjoner. Det er eksponentiell vekst.
        {flatTree && <> Med k så nær 1 synes det knapt i treet, men grafen viser at det går oppover.</>} I et kraftverk trekkes stavene bare litt opp
        når reaktoren startes eller effekten skal økes, og så senkes de til k = 1 igjen. En ekte reaktor bruker k bare litt over 1, for eksempel 1,001,
        ellers ville effekten vokse altfor fort.
      </p>
    );
  }

  return (
    <>
      {main}
      <p>
        <strong>Fisjon:</strong> nøytronet blir fanget av U-235-kjernen, som blir ustabil og spaltes i to mindre kjerner, for eksempel barium-141 og
        krypton-92, og 2 eller 3 nye nøytroner. Nukleontallet (236) og ladningen (92) er bevart, men massen etter er {fmt(ba.dm, 3)} u mindre. Den
        «forsvunne» massen er frigjort som energi, E = Δm · c<Sup>2</Sup> ≈ {fmt(ba.EMeV, 0)} MeV, mest som bevegelsesenergi til de to kjernene
        (glimtet i figuren). Energien blir til varme i brenselet og vannet. Det er ikke nøytronet som knuser kjernen med stor fart: vannet (moderatoren)
        bremser nøytronene, fordi U-235 lettere fanger langsomme nøytroner. Nøytroner virker fordi de ikke har ladning og derfor ikke frastøtes av
        kjernen.
      </p>
      <p>
        <strong>Fra fisjon til stikkontakten:</strong> varmen koker vann til damp som driver en turbin og en generator. En stor reaktor gir ca.{' '}
        {fmt(REACTOR_THERMAL_W / 1e6, 0)} MW varme og ca. 1 000 MW strøm. Det krever ca. {fmtSci(fissionsPerSecond(REACTOR_THERMAL_W, ba.EJ), 1)} fisjoner
        i sekundet, men bare noen få kilo U-235 i døgnet. Norge har ingen kjernekraftverk, men i Sverige kommer omtrent 30 % av strømmen fra
        kjernekraft. Et kjernekraftverk kan ikke eksplodere som en atombombe: brenselet har bare 3–5 % U-235, mens en bombe trenger nesten ren U-235.
        Det blå skjæret i bassenget blir sterkere jo flere fisjoner det er.
      </p>
      <p>
        Modellen er forenklet: kontrollstavene står for alle tapene, men i en ekte reaktor lekker også noen nøytroner ut av kjernen, og noen fanges av
        U-238 og vannet. Hvilke nøytroner som fanges, og om en fisjon gir 2 eller 3, er tilfeldig (trykk «Ny kjede»), men antallet fisjoner i treet
        følger gjennomsnittet. Treet starter med ett nøytron. I en ekte reaktor er det enormt mange i hver generasjon, og da er det bare gjennomsnittet k
        som betyr noe. En generasjon tar under ett tusendels sekund, men noen få nøytroner kommer litt forsinket, og det gjør at reaktoren kan styres.
      </p>
    </>
  );
}
