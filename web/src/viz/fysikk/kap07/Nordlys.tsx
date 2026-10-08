import { useMemo, useState, type ReactNode } from 'react';
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
  Toggle,
  Toolbar,
  VizLayout,
  fmt,
  fmtSci,
  useSimClock,
  useTextScale,
} from '../../kit';
import { Stjernehimmel, alpha, bolgelengdeFarge, SCENE, useSvgId } from '../../kit/scene';
import {
  DEFAULT_ENERGY_INDEX,
  ENERGY_STEPS,
  H_MAX,
  H_MIN,
  LINES,
  LINE_ORDER,
  auroraProfile,
  dominantLine,
  emissionRange,
  excitationEnergy,
  lightenRgb,
  lineShares,
  lowerEdge,
  oxygenLevels,
  parseRgb,
  photonFromNm,
  rgbText,
  transitionLevels,
  type LineId,
  type Rgb,
} from './model-nordlys';
import { Draperi, ELEKTRON_FARGE, Elektroner, HoydeGraf, Nattlandskap } from './nordlys-deler';
import { NordlysNivaer, levelsLayout, lifetimeText } from './nordlys-nivaer';
import { useFigureTextScale } from './useNarrow';

const LINE_RGB: Record<LineId, Rgb> = {
  gronn: parseRgb(bolgelengdeFarge(LINES.gronn.nm, false)),
  rod: parseRgb(bolgelengdeFarge(LINES.rod.nm, false)),
  blaa: parseRgb(bolgelengdeFarge(LINES.blaa.nm, false)),
};

/** Strekfarger i grafen på den mørke himmelen (det blåfiolette lyses litt opp, ellers drukner det). */
const LINE_STROKE: Record<LineId, string> = {
  gronn: bolgelengdeFarge(LINES.gronn.nm, false),
  rod: bolgelengdeFarge(LINES.rod.nm, false),
  blaa: rgbText(lightenRgb(LINE_RGB.blaa, 0.3)),
};

const OPTIONS: { value: LineId; label: string }[] = [
  { value: 'gronn', label: 'Grønt (O)' },
  { value: 'rod', label: 'Rødt (O)' },
  { value: 'blaa', label: 'Blåfiolett (N₂⁺)' },
];

const TICKS = [100, 200, 300, 400];

/** Høyden på scenen: høyere på mobil, så himmelen og høydeaksen får plass til den store teksten. */
const sceneHeight = (f: number) => Math.round(470 + 260 * (f - 1));

const energyText = (keV: number) => `${fmt(keV, keV < 1 ? 1 : 0)} keV`;

export default function Nordlys() {
  const [line, setLine] = useState<LineId>('gronn');
  const [ei, setEi] = useState(DEFAULT_ENERGY_INDEX);
  const [showHeights, setShowHeights] = useState(true);
  const clock = useSimClock({ tMax: 120, loop: true });
  const [sceneRef, fs] = useFigureTextScale<HTMLDivElement>();
  const [levelsRef, fl] = useFigureTextScale<HTMLDivElement>();

  const keV = ENERGY_STEPS[ei] ?? 5;
  const shares = useMemo(() => lineShares(keV), [keV]);
  const range = useMemo(() => emissionRange(line, keV), [line, keV]);
  const edge = useMemo(() => lowerEdge(keV), [keV]);
  const dominant = useMemo(() => dominantLine(keV), [keV]);
  const p = photonFromNm(LINES[line].nm);
  const H = sceneHeight(fs);
  const LH = levelsLayout(fl).H;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg farge i nordlyset" options={OPTIONS} value={line} onChange={setLine} />
        <Toggle label="Vis høyder" checked={showHeights} onChange={setShowHeights} />
      </Toolbar>
      <Controls>
        <Slider
          label="Typisk energi til elektronene"
          value={ei}
          onChange={setEi}
          min={0}
          max={ENERGY_STEPS.length - 1}
          step={1}
          format={(v) => energyText(ENERGY_STEPS[v] ?? 5)}
        />
      </Controls>
      <PlayControls clock={clock} decimals={1} />

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          maxHeight={Math.round(H * 1.16)}
          label={`Nordlys over fjell og fjord om natta. Elektroner med typisk energi ${energyText(keV)} stopper ca. ${fmt(edge, 0)} km over bakken. ${
            showHeights ? `Grafen viser at halvparten av det ${LINES[line].colorDef} lyset kommer fra ${range[0]}–${range[1]} km høyde.` : ''
          }`}
        >
          <Scene keV={keV} line={line} range={range} shares={shares} showHeights={showHeights} t={clock.t} H={H} edge={edge} />
        </Figure>
      </div>
      <Legend
        items={[
          ...LINE_ORDER.map((id) => ({
            color: bolgelengdeFarge(LINES[id].nm, false),
            label: <span>{legendText(id)}</span>,
          })),
          { color: ELEKTRON_FARGE, label: 'Elektroner fra solvinden' },
        ]}
      />

      <div ref={levelsRef}>
        <Figure
          viewBox={`0 0 800 ${LH}`}
          maxHeight={Math.max(440, LH)}
          label={`Energinivådiagram. ${levelsLabel(line)} Spekteret fra nordlyset har tre linjer: 427,8 nm, 557,7 nm og 630,0 nm.`}
        >
          <NordlysNivaer selected={line} shares={shares} t={clock.t} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Bølgelengde λ" value={fmt(LINES[line].nm, 1)} unit="nm" />
        <Readout label="Fotonenergi E" value={fmt(p.eV, 2)} unit="eV" />
        <Readout label={`Halvparten av det ${LINES[line].colorDef} lyset`} value={`${range[0]}–${range[1]}`} unit="km" />
        <Readout label="Nedre kant av nordlyset" value={fmt(edge, 0)} unit="km" />
      </Readouts>

      <Formula label="Frekvens og energi til fotonet">
        <FormulaLine>
          f = c/λ = 3,00 · 10⁸ m/s / ({fmt(LINES[line].nm, 1)} · 10⁻⁹ m) = {fmtSci(p.f, 2)} Hz
        </FormulaLine>
        <FormulaLine>
          E = hf = 6,63 · 10⁻³⁴ J s · {fmtSci(p.f, 2)} Hz = {fmtSci(p.E, 2)} J
        </FormulaLine>
        <FormulaLine>
          E = {fmtSci(p.E, 2)} J / (1,60 · 10⁻¹⁹ J/eV) = {fmt(p.eV, 2)} eV
        </FormulaLine>
        <FormulaLine>{levelLine(line)}</FormulaLine>
      </Formula>

      <Explain>
        <p>{lineExplanation(line, range)}</p>
        <p>{energyExplanation(keV, edge, dominant, line)}</p>
        <p>{misconception(line, keV)}</p>
      </Explain>
    </VizLayout>
  );
}

function legendText(id: LineId): string {
  const l = LINES[id];
  const who = l.emitter === 'O' ? 'O' : 'N₂⁺';
  return `${l.color.charAt(0).toUpperCase()}${l.color.slice(1)} ${fmt(l.nm, 1)} nm (${who})`;
}

function levelsLabel(id: LineId): string {
  const t = transitionLevels(id);
  if (id === 'blaa') return `Nitrogenionet N₂⁺ faller ${fmt(t.upper - t.lower, 2)} eV og sender ut 427,8 nm.`;
  return `Oksygenatomet faller fra ${fmt(t.upper, 2)} eV til ${fmt(t.lower, 2)} eV og sender ut ${fmt(LINES[id].nm, 1)} nm.`;
}

function levelLine(id: LineId): ReactNode {
  const t = transitionLevels(id);
  if (id === 'gronn')
    return (
      <>
        E = E<Sub>2</Sub> − E<Sub>1</Sub> = {fmt(t.upper, 2)} eV − {fmt(t.lower, 2)} eV = {fmt(t.upper - t.lower, 2)} eV
      </>
    );
  if (id === 'rod')
    return (
      <>
        E = E<Sub>1</Sub> − E<Sub>0</Sub> = {fmt(t.upper, 2)} eV − 0 eV = {fmt(t.upper, 2)} eV
      </>
    );
  return <>Støtet må gi N₂ minst 15,6 eV + 3,2 eV ≈ {fmt(excitationEnergy('blaa'), 1)} eV (ionisering og eksitasjon)</>;
}

function lineExplanation(id: LineId, range: [number, number]): string {
  const o = oxygenLevels();
  const where = `Nå kommer halvparten av det ${LINES[id].colorDef} lyset fra ${range[0]}–${range[1]} km høyde.`;
  if (id === 'gronn') {
    return `Det grønne lyset kommer fra oksygenatomer. Et elektron fra solvinden støter borti et O-atom og løfter det til nivået ${fmt(o.second, 2)} eV over grunntilstanden. Etter i snitt 0,7 s faller atomet ned til nivået ${fmt(o.first, 2)} eV og sender ut et foton med energien ${fmt(o.second, 2)} eV − ${fmt(o.first, 2)} eV = ${fmt(o.second - o.first, 2)} eV. Det er grønt lys med bølgelengde 557,7 nm. ${where} Under ca. 100 km er lufta så tett at atomet ofte støter i andre partikler før det rekker å lyse.`;
  }
  if (id === 'rod') {
    return `Det røde lyset kommer også fra oksygenatomer, men fra overgangen fra nivået ${fmt(o.first, 2)} eV ned til grunntilstanden. Fotonet har mindre energi (${fmt(o.first, 2)} eV) og derfor lengre bølgelengde (630,0 nm). Dette nivået lever ${lifetimeText('rod')}, nesten to minutter. Lenger ned enn ca. 200 km støter atomet i andre partikler mange ganger i løpet av den tida og mister energien uten å lyse. Derfor kommer det røde lyset bare fra stor høyde, der lufta er tynn. ${where}`;
  }
  return `Det blåfiolette lyset kommer fra nitrogen. Et raskt elektron slår løs et elektron fra et N₂-molekyl, og igjen står et nitrogenion N₂⁺ i en eksitert tilstand. Den lever bare ${lifetimeText('blaa')} (milliarddels sekunder) før ionet sender ut et foton på ${fmt(photonFromNm(LINES.blaa.nm).eV, 2)} eV, så det rekker å lyse også i tett luft. Fotonet har mest energi av de tre fordi bølgelengden er kortest. ${where} Det er den nedre kanten av nordlyset, der bare de raskeste elektronene kommer.`;
}

function energyExplanation(keV: number, edge: number, dominant: LineId, id: LineId): string {
  const n = Math.floor((keV * 1000) / excitationEnergy(id));
  const each = `Ett elektron på ${energyText(keV)} = ${fmt(keV * 1000, 0)} eV har energi nok til i beste fall ${fmt(n, 0)} slike støt (${fmt(keV * 1000, 0)} eV / ${fmt(excitationEnergy(id), 2)} eV), så hvert elektron får mange atomer til å lyse.`;
  if (keV <= 0.5) {
    return `Langsomme elektroner (${energyText(keV)}) har gitt fra seg all energien før de kommer lenger ned enn ca. ${fmt(edge, 0)} km over bakken. Der oppe er det mest O-atomer og tynn luft, så nordlyset får mye rødt og ingen blåfiolett kant. ${each}`;
  }
  if (keV < 3) {
    return `Med elektroner på ${energyText(keV)} slutter nordlyset nederst ca. ${fmt(edge, 0)} km over bakken. Mest av lyset er ${LINES[dominant].color}, med en rød topp over. ${each}`;
  }
  return `Raske elektroner (${energyText(keV)}) kommer helt ned til ca. ${fmt(edge, 0)} km før de har gitt fra seg all energien. Nordlyset blir ${LINES[dominant].color} med en blåfiolett nedre kant, og bare en svak rød topp. ${each}`;
}

function misconception(id: LineId, keV: number): string {
  if (id === 'blaa' || keV >= 5) {
    return `Vanlig misforståelse: at raskere elektroner gir «blåere» lys. Fargen til hvert foton bestemmes bare av energinivåene i atomet eller ionet som lyser, ikke av farten til elektronet. Farten bestemmer hvor langt ned elektronene kommer, og dermed hvilke atomer og nivåer som får lyse.`;
  }
  if (id === 'rod') {
    return `Vanlig misforståelse: at det røde lyset kommer fra et eget lag med oksygen høyt oppe. Det finnes oksygen i alle høydene. Forskjellen er at det røde nivået lever så lenge at atomet bare rekker å lyse der lufta er tynn.`;
  }
  return `Vanlig misforståelse: at nordlyset gløder fordi lufta blir varm. Glødende stoffer gir et kontinuerlig spekter med alle farger. Nordlyset gir et linjespekter med bare noen få bølgelengder, fordi hvert foton kommer fra en bestemt overgang mellom to energinivåer.`;
}

/* ---------- Scenen ---------- */

function Scene({
  keV,
  line,
  range,
  shares,
  showHeights,
  t,
  H,
  edge,
}: {
  keV: number;
  line: LineId;
  range: [number, number];
  shares: Record<LineId, number>;
  showHeights: boolean;
  t: number;
  H: number;
  edge: number;
}) {
  const f = useTextScale();
  const curtainId = useSvgId('nordlys-draperi');
  const clip = useSvgId('nordlys-scene');
  const profile = useMemo(() => auroraProfile(keV, 5), [keV]);
  const W = 800;
  const fsz = 17 * f * 0.78;
  const top = Math.max(34, fsz * 2.2 + 8);
  const shore = H - (30 + 22 * (f - 1));
  const horizon = shore - (40 + 18 * (f - 1));
  const mountain = 48 + 16 * (f - 1);
  const yBot = horizon - mountain - 8;
  const k = (yBot - top) / (H_MAX - H_MIN);
  const yOf = (h: number) => yBot - (h - H_MIN) * k;
  const panelX0 = showHeights ? W - (196 + 110 * (f - 1)) : W;
  const cx0 = 14;
  const cx1 = showHeights ? panelX0 - 10 : W - 14;
  const glow = useMemo(() => {
    // Lyset som faller på snøen: fargen i den sterkeste høyden.
    const tot = profile.h.map((_, i) => LINE_ORDER.reduce((s, id) => s + (profile.I[id][i] ?? 0), 0));
    const i = tot.indexOf(Math.max(...tot));
    const w = LINE_ORDER.map((id) => ({ rgb: LINE_RGB[id], w: profile.I[id][i] ?? 0 }));
    const sum = w.reduce((a, b) => a + b.w, 0) || 1;
    return [0, 1, 2].map((c) => Math.round(w.reduce((a, b) => a + b.rgb[c]! * b.w, 0) / sum)) as Rgb;
  }, [profile]);
  const span = cx1 - cx0;
  const xs = [0.16, 0.4, 0.63, 0.85].map((u) => cx0 + u * span);
  return (
    <g clipPath={`url(#${clip})`}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={W} height={H} rx={6} />
        </clipPath>
      </defs>
      <Stjernehimmel x={0} y={0} w={W} h={horizon + 2} seed={4} melkevei={0.22} t={t} />
      {/* Svak høydeskala over hele himmelen, så aksen i grafen gjelder for draperiet */}
      {showHeights &&
        TICKS.map((h) => (
          <line key={h} x1={cx0} x2={panelX0} y1={yOf(h)} y2={yOf(h)} stroke={alpha(SCENE.star, 0.1)} strokeWidth={1} strokeDasharray="5 7" />
        ))}
      <Draperi id={curtainId} x0={cx0} x1={cx1} yOf={yOf} profile={profile} colors={LINE_RGB} t={t} />
      <Elektroner xs={xs} top={-12} stopY={yOf(edge + 12)} t={t} />
      <Nattlandskap w={W} horizon={horizon} shore={shore} bottom={H} mountain={mountain} glow={glow} reflect={curtainId} hytte={92 * Math.max(1, f * 0.8)} />
      {showHeights && (
        <HoydeGraf
          x0={panelX0}
          x1={W - 6}
          yOf={yOf}
          profile={profile}
          colors={LINE_STROKE}
          selected={line}
          range={range}
          shares={shares}
          ticks={TICKS}
          title="Lys fra hver høyde"
        />
      )}
    </g>
  );
}
