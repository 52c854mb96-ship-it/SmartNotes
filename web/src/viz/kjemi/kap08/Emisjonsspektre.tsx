import { useState, type ReactNode } from 'react';
import {
  Explain,
  Figure,
  Formula,
  FormulaLine,
  KJEMI,
  Readout,
  Readouts,
  Segmented,
  Select,
  Sub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  getElement,
  mixColor,
  scaleLinear,
  useContainerTextScale,
} from '../kit';
import { BURNER_FLAME, FLAME_COLOR, spectrumColor } from './farger';
import {
  C_LIGHT,
  EV,
  FLAME,
  FLAME_ELEMENTS,
  H_PLANCK,
  N_A,
  UNKNOWN_SAMPLES,
  atomicLines,
  colorWord,
  colorWordNeuter,
  levelOf,
  matchElement,
  photonEnergy,
  photonEnergyPerMol,
  sampleLines,
  strongestLine,
  transitionEnergy,
  type EmissionLine,
  type FlameElement,
  type UnknownSample,
} from './model';

type Mode = 'utforsk' | 'ukjent';

/** Bølgelengdene på spekteraksen (nm). */
const L0 = 390;
const L1 = 780;

const ELEMENT_OPTIONS = FLAME_ELEMENTS.map((e) => ({ value: e, label: e }));
/** Ingen knapp er valgt før eleven har gjettet. */
const NO_GUESS = '' as FlameElement;

const lineLabel = (el: FlameElement, l: EmissionLine) => {
  const a = levelOf(el, l.from);
  const b = levelOf(el, l.to);
  return `${fmt(l.nm, 1)} nm (${a?.label ?? ''} → ${b?.label ?? ''})`;
};

export default function Emisjonsspektre() {
  const [mode, setMode] = useState<Mode>('utforsk');
  const [el, setEl] = useState<FlameElement>('Na');
  const [lineIdx, setLineIdx] = useState(0);
  const [sampleId, setSampleId] = useState('A');
  const [guess, setGuess] = useState<FlameElement | null>(null);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const lines = atomicLines(el);
  const line = lines[Math.min(lineIdx, lines.length - 1)]!;
  const sample = UNKNOWN_SAMPLES.find((s) => s.id === sampleId) ?? UNKNOWN_SAMPLES[0]!;
  const match = guess ? matchElement(sample, guess) : null;

  const pickElement = (s: FlameElement) => {
    setEl(s);
    setLineIdx(0);
  };
  const pickSample = (id: string) => {
    setSampleId(id);
    setGuess(null);
  };

  const narrow = f > 1.3;
  const sceneH = sceneHeight(f);
  const diagramH = Math.round(narrow ? 330 + 200 * (f - 1) : 330);
  const unknownH = Math.round(narrow ? 60 * f + 8 * 52 * f : 80 + 8 * 46);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Hva vil du gjøre?"
          options={[
            { value: 'utforsk', label: 'Utforsk grunnstoffene' },
            { value: 'ukjent', label: 'Identifiser en ukjent prøve' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Toolbar>

      <div ref={ref} aria-hidden />
      {mode === 'utforsk' ? (
        <>
          <Toolbar>
            <Segmented label="Velg grunnstoff" options={ELEMENT_OPTIONS} value={el} onChange={pickElement} />
            <Select
              label="Linje"
              value={String(Math.min(lineIdx, lines.length - 1))}
              onChange={(v) => setLineIdx(Number(v))}
              options={lines.map((l, i) => ({ value: String(i), label: lineLabel(el, l) }))}
            />
          </Toolbar>

          <div>
            <Figure
              viewBox={`0 0 800 ${sceneH}`}
              label={`Flammeprøve med ${FLAME[el].name}: flammen er ${FLAME[el].flame}. Linjespekteret har linjer ved ${FLAME[el].lines.map((l) => fmt(l.nm, 0)).join(', ')} nm.`}
              caption="Linjespekteret slik et spektroskop viser det. Smale streker er atomlinjer; brede, uskarpe bånd kommer fra molekyler i flammen (f.eks. CaOH og SrOH)."
              maxHeight={sceneH}
            >
              <FlameScene el={el} line={line} f={f} H={sceneH} />
            </Figure>
          </div>

          <Figure
            viewBox={`0 0 800 ${diagramH}`}
            label={`Energinivåer i ${FLAME[el].name} med overgangene som gir linjene. Valgt linje ${fmt(line.nm, 1)} nm.`}
            caption="Energinivåene er energien til atomet når det ytterste elektronet er i ulike orbitaler (målt fra grunntilstanden). Pilene viser elektronet som faller ned og sender ut et foton. Båndene fra molekyler er ikke med."
            maxHeight={diagramH}
          >
            <LevelDiagram el={el} selected={line} f={f} H={diagramH} />
          </Figure>

          <Readouts>
            <Readout label="Bølgelengde λ" value={fmt(line.nm, 1)} unit="nm" tone={spectrumColor(line.nm)} />
            <Readout label="Farge" value={colorWord(line.nm)} />
            <Readout label="Fotonenergi ΔE" value={fmtSci(photonEnergy(line.nm), 2)} unit="J" />
            <Readout label="Per mol fotoner" value={fmt(photonEnergyPerMol(line.nm), 0)} unit="kJ/mol" />
          </Readouts>

          <Formula label="Utregning">
            <FormulaLine>
              ΔE = E({levelOf(el, line.from)?.label}) − E({levelOf(el, line.to)?.label}) = {fmtSci(transitionEnergy(el, line), 3)} J
            </FormulaLine>
            <FormulaLine>
              λ = hc / ΔE = (6,626 · 10⁻³⁴ J·s · 2,998 · 10⁸ m/s) / {fmtSci(transitionEnergy(el, line), 3)} J ={' '}
              {fmt(((H_PLANCK * C_LIGHT) / transitionEnergy(el, line)) * 1e9, 1)} nm
            </FormulaLine>
            <FormulaLine>
              Per mol: ΔE · N<Sub>A</Sub> = {fmtSci(photonEnergy(line.nm), 3)} J · {fmtSci(N_A, 3)} /mol = {fmt(photonEnergyPerMol(line.nm), 0)} kJ/mol
            </FormulaLine>
          </Formula>

          <Explain>{exploreText(el, line)}</Explain>
        </>
      ) : (
        <>
          <Toolbar>
            <Select
              label="Prøve"
              value={sampleId}
              onChange={pickSample}
              options={UNKNOWN_SAMPLES.map((s) => ({ value: s.id, label: `Prøve ${s.id}` }))}
            />
            <Segmented label="Hvilket grunnstoff er i prøven?" options={ELEMENT_OPTIONS} value={guess ?? NO_GUESS} onChange={(v) => setGuess(v)} />
          </Toolbar>

          <div>
            <Figure
              viewBox={`0 0 800 ${unknownH}`}
              label={`Prøve ${sample.id} sammenlignet med linjespektrene til ${FLAME_ELEMENTS.join(', ')}.`}
              caption="Øverst prøven, under linjespektrene til grunnstoffene. Et grunnstoff er i prøven bare hvis alle linjene dets finnes i prøvespekteret."
              maxHeight={unknownH}
            >
              <UnknownScene sample={sample} guess={guess} f={f} H={unknownH} />
            </Figure>
          </div>

          <Readouts>
            <Readout label="Linjer og bånd i prøven" value={String(sampleLines(sample).length)} />
            <Readout label="Ditt svar" value={guess ? FLAME[guess].name : '–'} />
            <Readout label="Linjer som stemmer" value={match ? `${match.found} av ${match.total}` : '–'} tone={match ? (match.present ? KJEMI.ph[3] : KJEMI.minus) : undefined} />
            <Readout label="Grunnstoffer i prøven" value={match?.present ? (sample.elements.length > 1 ? 'mer enn ett' : 'ett') : '?'} />
          </Readouts>

          <Explain>{unknownText(sample, guess)}</Explain>
        </>
      )}
    </VizLayout>
  );
}

/* ---------- Spekteret ---------- */

/** Et linjespekter i et rektangel: atomlinjer som smale streker, molekylbånd som brede, uskarpe felt. */
function Spectrum({
  x0,
  x1,
  y,
  h,
  lines,
  highlight,
  dim,
}: {
  x0: number;
  x1: number;
  y: number;
  h: number;
  lines: EmissionLine[];
  highlight?: number;
  dim?: boolean;
}) {
  const sx = scaleLinear([L0, L1], [x0, x1]);
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={h} fill={SCOPE_BG} rx={3} />
      <g opacity={dim ? 0.4 : 1}>
      {lines
        .filter((l) => l.band)
        .map((l) => {
          const w = l.band!.width;
          return [2.2, 1.4, 0.7].map((k, i) => (
            <rect
              key={`${l.nm}-${i}`}
              x={sx(l.nm - k * w)}
              y={y + 1}
              width={sx(l.nm + k * w) - sx(l.nm - k * w)}
              height={h - 2}
              fill={spectrumColor(l.nm)}
              opacity={(0.18 + 0.2 * i) * (0.4 + 0.6 * l.strength)}
            />
          ));
        })}
      {lines
        .filter((l) => !l.band)
        .map((l) => (
          <rect
            key={l.nm}
            x={sx(l.nm) - 1.6}
            y={y + 1}
            width={3.2}
            height={h - 2}
            fill={spectrumColor(l.nm)}
            opacity={0.35 + 0.65 * Math.min(1, l.strength)}
          />
        ))}
      </g>
      {highlight !== undefined && (
        <polygon points={`${sx(highlight) - 7},${y - 12} ${sx(highlight) + 7},${y - 12} ${sx(highlight)},${y - 2}`} fill={VIZ.ink} />
      )}
    </g>
  );
}

/** Bakgrunnen i spektroskopet: mørk i begge temaer (samme mørke farge som teksten på hydrogenatomer). */
const SCOPE_BG = KJEMI.atom('H').ink;

function SpectrumAxis({ x0, x1, y, f, every = 50 }: { x0: number; x1: number; y: number; f: number; every?: number }) {
  const sx = scaleLinear([L0, L1], [x0, x1]);
  const ticks: number[] = [];
  for (let v = 400; v <= 750; v += every) ticks.push(v);
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={y} x2={sx(v)} y2={y + 6} className="viz-axis" />
          <text x={sx(v)} y={y + 24 * f} textAnchor="middle" className="viz-tick">
            {v}
          </text>
        </g>
      ))}
    </g>
  );
}

/* ---------- Figur 1: flammen og linjespekteret ---------- */

function Burner({ cx, base, s, color }: { cx: number; base: number; s: number; color: string }) {
  const tubeTop = base - 70 * s;
  const fh = 120 * s;
  const fw = 34 * s;
  const tip = tubeTop - fh;
  return (
    <g>
      <rect x={cx - 34 * s} y={base} width={68 * s} height={12 * s} rx={4} fill={VIZ.bodyStrong} stroke={KJEMI.glass} strokeWidth={1.5} />
      <rect x={cx - 9 * s} y={tubeTop} width={18 * s} height={base - tubeTop} fill={VIZ.body} stroke={KJEMI.glass} strokeWidth={1.5} />
      {/* Ytre flamme i saltets farge og indre blå kjegle */}
      <path
        d={`M${cx - fw / 2},${tubeTop} C${cx - fw},${tubeTop - fh * 0.45} ${cx - fw * 0.2},${tip + fh * 0.25} ${cx},${tip} C${cx + fw * 0.2},${tip + fh * 0.25} ${cx + fw},${tubeTop - fh * 0.45} ${cx + fw / 2},${tubeTop} Z`}
        fill={color}
        opacity={0.85}
      />
      <path
        d={`M${cx - 8 * s},${tubeTop} C${cx - 10 * s},${tubeTop - 20 * s} ${cx - 3 * s},${tubeTop - 34 * s} ${cx},${tubeTop - 40 * s} C${cx + 3 * s},${tubeTop - 34 * s} ${cx + 10 * s},${tubeTop - 20 * s} ${cx + 8 * s},${tubeTop} Z`}
        fill={BURNER_FLAME}
      />
      {/* Magnesiastav med saltet */}
      <line x1={cx + 70 * s} y1={tubeTop - 10 * s} x2={cx + 6 * s} y2={tubeTop - 46 * s} stroke={VIZ.muted} strokeWidth={2.5} />
      <circle cx={cx + 4 * s} cy={tubeTop - 47 * s} r={4 * s} fill={atomInk()} stroke={VIZ.muted} strokeWidth={1.5} />
    </g>
  );
}

/** Saltet på staven (hvitt pulver i begge temaer). */
const atomInk = () => KJEMI.atom('H').fill;

const BURNER_S_NARROW = 1.6;
const BURNER_BASE_NARROW = 16 + 190 * BURNER_S_NARROW;

function sceneHeight(f: number): number {
  return f > 1.3 ? Math.round(BURNER_BASE_NARROW + 12 * BURNER_S_NARROW + 40 * f + 70 + 60 * f + 16) : 300;
}

function FlameScene({ el, line, f, H }: { el: FlameElement; line: EmissionLine; f: number; H: number }) {
  const narrow = f > 1.3;
  const d = FLAME[el];
  // PC: brenneren til venstre og spekteret til høyre. Mobil: brenneren øverst og spekteret over hele bredden under.
  const burner = narrow ? { cx: 250, base: BURNER_BASE_NARROW, s: BURNER_S_NARROW } : { cx: 110, base: H - 50, s: 1.15 };
  const spec = narrow ? { x0: 30, x1: 770, y: burner.base + 12 * BURNER_S_NARROW + 40 * f, h: 70 } : { x0: 250, x1: 770, y: 90, h: 80 };
  const sx = scaleLinear([L0, L1], [spec.x0, spec.x1]);
  const lx = sx(line.nm);
  const labelAnchor = lx > spec.x1 - 80 * f ? 'end' : lx < spec.x0 + 80 * f ? 'start' : 'middle';
  return (
    <g>
      <Burner cx={burner.cx} base={burner.base} s={burner.s} color={FLAME_COLOR[el]} />
      {narrow ? (
        <g>
          <Txt x={410} y={110 * f} anchor="start" weight={700}>
            {capital(d.name)} ({d.salt})
          </Txt>
          <Txt x={410} y={110 * f + 28 * f} anchor="start" size={0.85} muted>
            flammen er
          </Txt>
          <Txt x={410} y={110 * f + 54 * f} anchor="start" size={0.85} weight={700}>
            {d.flame}
          </Txt>
        </g>
      ) : (
        <g>
          <Txt x={burner.cx} y={H - 10} size={0.8} muted>
            flammen er {d.flame}
          </Txt>
          <Txt x={spec.x0} y={36} anchor="start" weight={700}>
            Linjespekteret til {d.name}
          </Txt>
        </g>
      )}
      <Spectrum x0={spec.x0} x1={spec.x1} y={spec.y} h={spec.h} lines={d.lines} highlight={line.nm} />
      <SpectrumAxis x0={spec.x0} x1={spec.x1} y={spec.y + spec.h} f={f} every={narrow ? 100 : 50} />
      <Txt x={(spec.x0 + spec.x1) / 2} y={spec.y + spec.h + 50 * f} size={0.8} muted>
        bølgelengde λ (nm)
      </Txt>
      <Txt x={labelAnchor === 'end' ? lx + 8 : labelAnchor === 'start' ? lx - 8 : lx} y={spec.y - 18} anchor={labelAnchor} size={0.85} weight={700}>
        {fmt(line.nm, 1)} nm
      </Txt>
      {/* Bånd fra molekyler merkes med navnet */}
      {!narrow &&
        d.lines
          .filter((l) => l.band)
          .map((l, i) => (
            <Txt key={l.nm} x={sx(l.nm)} y={spec.y + spec.h + 50 * f + 22 + (i % 2) * 0} size={0.7} muted>
              {l.band!.molecule}
            </Txt>
          ))}
    </g>
  );
}

/* ---------- Figur 2: energinivåene ---------- */

function LevelDiagram({ el, selected, f, H }: { el: FlameElement; selected: EmissionLine; f: number; H: number }) {
  const d = FLAME[el];
  const ie = ((getElement(el)?.ionizationEnergy ?? 500) * 1000) / N_A; // J
  const narrow = f > 1.3;
  const top = 34 * f;
  const bottom = H - 22 * f;
  const sy = scaleLinear([0, ie], [bottom, top]);
  const axisX = 34 + 22 * f;
  const x0 = axisX + 30 + 80 * f;
  const x1 = narrow ? 785 : 620;
  const lines = atomicLines(el).sort((a, b) => b.nm - a.nm);
  const n = lines.length;
  const ax = (i: number) => x0 + 30 + ((x1 - x0 - 60) * (i + 0.5)) / n;
  // Etikettene til nivåene står til venstre for nivåene. Like etiketter på nesten samme høyde (finstruktur) vises én
  // gang, og etiketter som ville overlappe, skyves fra hverandre (med en liten strek til nivået).
  const gap = 17 * f;
  const labels: { y: number; ty: number; label: string }[] = [];
  for (const l of [...d.levels].sort((a, b) => a.eV - b.eV)) {
    const y = sy(l.eV * EV);
    const last = labels[labels.length - 1];
    if (last && last.label === l.label && Math.abs(last.y - y) < gap) continue;
    labels.push({ y, ty: y, label: l.label });
  }
  for (let i = 1; i < labels.length; i++) labels[i]!.ty = Math.min(labels[i]!.ty, labels[i - 1]!.ty - gap);
  const overflow = top + 6 * f - labels[labels.length - 1]!.ty;
  if (overflow > 0) for (const b of labels) b.ty += overflow;
  for (let i = labels.length - 2; i >= 0; i--) labels[i]!.ty = Math.max(labels[i]!.ty, labels[i + 1]!.ty + gap);
  const ticks: number[] = [];
  for (let v = 0; v <= ie * 1e19 + 1e-9; v += ie * 1e19 > 9 ? 4 : 2) ticks.push(v);
  return (
    <g>
      {/* Energiakse i 10⁻¹⁹ J */}
      <line x1={axisX} y1={bottom} x2={axisX} y2={top - 10} className="viz-axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={axisX - 6} y1={sy(v * 1e-19)} x2={axisX} y2={sy(v * 1e-19)} className="viz-axis" />
          <text x={axisX - 10} y={sy(v * 1e-19) + 5 * f} textAnchor="end" className="viz-tick">
            {fmt(v, 0)}
          </text>
        </g>
      ))}
      <Txt x={8} y={top - 18 * f} anchor="start" size={0.72} muted>
        E (10⁻¹⁹ J)
      </Txt>

      {/* Ioniseringsenergien */}
      <line x1={x0} y1={sy(ie)} x2={x1} y2={sy(ie)} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
      <Txt x={x1} y={sy(ie) - 8} anchor="end" size={0.75} muted>
        ionisering ({fmt(getElement(el)?.ionizationEnergy ?? NaN, 0)} kJ/mol)
      </Txt>

      {/* Nivåene */}
      {d.levels.map((l) => (
        <line key={l.id} x1={x0} y1={sy(l.eV * EV)} x2={x1} y2={sy(l.eV * EV)} stroke={VIZ.ink} strokeWidth={l.eV === 0 ? 3 : 2} opacity={0.75} />
      ))}
      {labels.map((b, i) => (
        <g key={b.label + i}>
          {Math.abs(b.ty - b.y) > 2 && <line x1={x0 - 6} y1={b.ty - 5 * f} x2={x0} y2={b.y} stroke={VIZ.muted} strokeWidth={1} />}
          <Txt x={x0 - 8} y={b.ty} anchor="end" size={0.78} weight={600}>
            {b.label}
          </Txt>
        </g>
      ))}
      <Txt x={x0 + 6} y={bottom + 18 * f} anchor="start" size={0.72} muted>
        grunntilstand
      </Txt>

      {/* Overgangene */}
      {lines.map((l, i) => {
        const up = levelOf(el, l.from)!;
        const lo = levelOf(el, l.to)!;
        const x = ax(i);
        const y1 = sy(up.eV * EV);
        const y2 = sy(lo.eV * EV);
        const on = l === selected;
        const c = spectrumColor(l.nm);
        const w = on ? 5 : 3;
        return (
          <g key={l.nm} opacity={on ? 1 : 0.6}>
            <line x1={x} y1={y1} x2={x} y2={y2 - 12} stroke={c} strokeWidth={w} />
            <polygon points={`${x},${y2 - 1} ${x - 7},${y2 - 14} ${x + 7},${y2 - 14}`} fill={c} />
            <circle cx={x} cy={y1} r={on ? 6 : 4} fill={KJEMI.electron} />
            <Txt x={x + 9} y={(y1 + y2) / 2 + 5} anchor="start" size={on ? 0.8 : 0.68} weight={on ? 700 : 500} muted={!on}>
              {fmt(l.nm, 0)}
            </Txt>
          </g>
        );
      })}

      {/* Detaljer om valgt linje (PC) */}
      {!narrow && (
        <g>
          <Txt x={650} y={top + 30} anchor="start" size={0.85} weight={700}>
            {fmt(selected.nm, 1)} nm
          </Txt>
          <Txt x={650} y={top + 58} anchor="start" size={0.8} muted>
            {levelOf(el, selected.from)?.label} → {levelOf(el, selected.to)?.label}
          </Txt>
          <Txt x={650} y={top + 86} anchor="start" size={0.8}>
            ΔE = {fmtSci(photonEnergy(selected.nm), 2)} J
          </Txt>
          <Txt x={650} y={top + 114} anchor="start" size={0.8} muted>
            = {fmt(photonEnergy(selected.nm) / EV, 2)} eV
          </Txt>
          <Txt x={650} y={top + 142} anchor="start" size={0.8} muted>
            {colorWordNeuter(selected.nm)} lys
          </Txt>
        </g>
      )}
    </g>
  );
}

/* ---------- Ukjent prøve ---------- */

function UnknownScene({ sample, guess, f, H }: { sample: UnknownSample; guess: FlameElement | null; f: number; H: number }) {
  const narrow = f > 1.3;
  const labelW = narrow ? 70 : 110;
  const x0 = 20 + labelW;
  const x1 = 780;
  const rowH = narrow ? 52 * f : 46;
  const stripH = narrow ? 30 * f : 30;
  const sx = scaleLinear([L0, L1], [x0, x1]);
  const sLines = sampleLines(sample);
  const sampleY = narrow ? 18 * f : 22;
  const refTop = sampleY + stripH + (narrow ? 56 * f : 56);
  const guessLines = guess ? FLAME[guess].lines : [];
  const flame = mixColor(FLAME_COLOR[sample.elements[0]!], FLAME_COLOR[sample.elements[1] ?? sample.elements[0]!], sample.elements[1] ? 0.3 : 0);
  return (
    <g>
      {/* Prøven, med flammefargen som et lite felt */}
      <rect x={20} y={sampleY} width={labelW - 16} height={stripH} rx={6} fill={flame} opacity={0.85} />
      <Txt x={20 + (labelW - 16) / 2} y={sampleY + stripH / 2 + 6 * f} size={0.85} weight={700} halo={false} color={VIZ.ink}>
        {sample.id}
      </Txt>
      <Spectrum x0={x0} x1={x1} y={sampleY} h={stripH} lines={sLines} />
      <SpectrumAxis x0={x0} x1={x1} y={sampleY + stripH} f={f} every={narrow ? 100 : 50} />

      {/* Linjene til gjetningen trekkes opp gjennom prøven */}
      {guessLines.map((l) => {
        const found = sLines.some((s) => Math.abs(s.nm - l.nm) <= 1);
        return (
          <line
            key={l.nm}
            x1={sx(l.nm)}
            y1={sampleY - 4}
            x2={sx(l.nm)}
            y2={refTop + FLAME_ELEMENTS.indexOf(guess!) * rowH + stripH}
            stroke={found ? KJEMI.ph[3]! : KJEMI.minus}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.85}
          />
        );
      })}

      {FLAME_ELEMENTS.map((e, i) => {
        const y = refTop + i * rowH;
        const on = e === guess;
        return (
          <g key={e}>
            {on && <rect x={14} y={y - 6} width={772} height={stripH + 12} rx={8} fill="none" stroke={VIZ.series[0]} strokeWidth={2} />}
            <Txt x={30} y={y + stripH / 2 + 6 * f} anchor="start" size={0.85} weight={on ? 700 : 500}>
              {e}
            </Txt>
            {!narrow && (
              <Txt x={60} y={y + stripH / 2 + 5} anchor="start" size={0.7} muted>
                {FLAME[e].name}
              </Txt>
            )}
            <Spectrum x0={x0} x1={x1} y={y} h={stripH} lines={FLAME[e].lines} dim={guess !== null && !on} />
          </g>
        );
      })}
      <Txt x={(x0 + x1) / 2} y={H - 8} size={0.75} muted>
        bølgelengde λ (nm), samme skala i alle spektrene
      </Txt>
    </g>
  );
}

/* ---------- Forklaringer ---------- */

function exploreText(el: FlameElement, line: EmissionLine): ReactNode {
  const d = FLAME[el];
  const strongest = strongestLine(el);
  const up = levelOf(el, line.from)?.label;
  const lo = levelOf(el, line.to)?.label;
  const extra: Partial<Record<FlameElement, ReactNode>> = {
    Na: (
      <>
        Natrium har en dobbel gul linje (589,0 og 589,6 nm) fordi 3p-nivået er delt i to nesten like nivåer. Den er så sterk at litt natrium som forurensning
        kan skjule fargen til andre grunnstoffer.
      </>
    ),
    K: (
      <>
        Kaliumflammen er svak fiolett: den røde linja ved 766 nm ligger nesten utenfor det vi ser. Med natrium til stede ser du den bare gjennom blått
        koboltglass, som stopper det gule lyset.
      </>
    ),
    Li: <>Litium og strontium gir begge rød flamme. Spekteret skiller dem: litium har én skarp linje ved 671 nm, strontium brede bånd og en blå linje.</>,
    Ca: (
      <>
        Den oransjerøde flammefargen kommer mest fra CaOH-molekyler i flammen (bånd ved ca. 554 og 622 nm), ikke fra atomlinjene. Den sterkeste atomlinja er
        fiolett (423 nm).
      </>
    ),
    Sr: (
      <>
        Den røde flammefargen kommer fra SrOH-molekyler (bånd ved ca. 606, 646 og 682 nm). Atomlinja ved 461 nm er blå, men svakere i flammen.
      </>
    ),
    Ba: <>Den gulgrønne flammen kommer fra atomlinja ved 554 nm og fra bånd fra BaOH og BaCl i det grønne.</>,
    Cu: <>Kobber gir grønne linjer (510–522 nm). Kobberklorid kan gi en mer blågrønn flamme.</>,
  };
  return (
    <>
      <p>
        <strong>
          {capital(d.name)} gir {d.flame.split(' ')[0]} flamme
        </strong>
        , og det sterkeste lyset i spekteret ligger ved {fmt(strongest.nm, 0)} nm ({colorWordNeuter(strongest.nm)} lys
        {strongest.band ? `, et bånd fra ${strongest.band.molecule}` : ''}). Varmen i flammen gir elektronene energi, så de eksiteres til høyere energinivåer.
        Når et elektron faller tilbake, sendes energiforskjellen ut som ett foton med bølgelengde λ = hc/ΔE.
      </p>
      <p>
        Linja ved {fmt(line.nm, 1)} nm kommer fra overgangen {up} → {lo}: ΔE = {fmtSci(photonEnergy(line.nm), 2)} J per atom, eller{' '}
        {fmt(photonEnergyPerMol(line.nm), 0)} kJ/mol. Større energiforskjell gir kortere bølgelengde (mot blått og fiolett). Siden hvert grunnstoff har sine
        egne energinivåer, er linjespekteret et fingeravtrykk som kan brukes i kvalitativ analyse.
      </p>
      <p>{extra[el]}</p>
    </>
  );
}

function unknownText(sample: UnknownSample, guess: FlameElement | null): ReactNode {
  if (!guess)
    return (
      <>
        <p>
          <strong>Prøve {sample.id}:</strong> {sample.hint} Sammenlign linjene i prøven med linjespektrene under, og velg grunnstoffet du tror prøven inneholder.
        </p>
        <p>
          Flammefargen alene er ikke nok: litium og strontium gir begge rød flamme, og litt natrium som forurensning gjør nesten alle flammer gule. Linjene
          ligger derimot fast, så spekteret avslører grunnstoffet.
        </p>
      </>
    );
  const m = matchElement(sample, guess);
  const d = FLAME[guess];
  const others = sample.elements.filter((e) => e !== guess);
  if (m.present)
    return (
      <>
        <p>
          <strong>Riktig: prøven inneholder {d.name}.</strong> Alle {m.total} {d.lines.some((l) => l.band) ? 'linjene og båndene' : 'linjene'} til {d.name}{' '}
          finnes i prøvespekteret (de grønne stiplede linjene).
        </p>
        <p>
          {others.length > 0 ? (
            <>
              Men prøven har flere linjer enn {d.name} kan forklare, så den inneholder mer enn ett grunnstoff. Finn det andre også (hint: {others.includes('Na') ? 'en gul dobbeltlinje' : 'se på linjene som er igjen'}).
            </>
          ) : (
            <>Alle linjene i prøven er forklart, så {d.name} er det eneste av disse grunnstoffene i prøven.</>
          )}
        </p>
      </>
    );
  return (
    <>
      <p>
        <strong>Nei, ikke {d.name}.</strong> {capital(d.name)} har {m.missing?.band ? 'et bånd' : 'en linje'} ved {fmt(m.missing?.nm ?? NaN, 0)} nm som mangler i
        prøven (rød stiplet linje). Et grunnstoff sender alltid ut alle linjene sine, så én linje som mangler er nok til å utelukke det.
      </p>
      <p>{sample.hint}</p>
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
