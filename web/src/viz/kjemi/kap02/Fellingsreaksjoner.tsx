import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Begerglass,
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  PlayControls,
  Reaksjon,
  Readout,
  Readouts,
  Select,
  Slider,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  capitalize,
  fmt,
  fmtSig,
  formulaText,
  mixColor,
  molarMass,
  placeParticles,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  type Box,
} from '../kit';
import {
  ANIONS,
  CATIONS,
  CONCENTRATIONS,
  mixSolutions,
  pairInfo,
  spectatorIons,
  unitParticles,
  zoomCounts,
  type Ion,
  type MixResult,
  type PairInfo,
  type PrecipitateColor,
  type SolubilityKind,
} from './model';

const T_END = 3;

/** Fargen på bunnfallet (fra fargetokenene, så de virker i begge temaer). */
const WHITE = atomColors('H').fill;
const PRECIPITATE_COLOR: Record<PrecipitateColor, string> = {
  hvitt: WHITE,
  lysegult: mixColor(WHITE, KJEMI.indicator.btbSur, 0.5),
  gult: KJEMI.indicator.btbSur,
  blått: mixColor(WHITE, KJEMI.indicator.btbBasisk, 0.65),
  blågrønt: KJEMI.ph[4]!,
  rustbrunt: mixColor(KJEMI.valence, atomColors('Br').line, 0.5),
  // Brom-fyll og -kant bytter lys/mørk mellom temaene, så en jevn blanding gir samme brune farge i begge
  brunt: mixColor(atomColors('Br').fill, atomColors('Br').line, 0.5),
};
const COLOR_WORD: Record<PrecipitateColor, string> = {
  hvitt: 'hvitt',
  lysegult: 'lysegult',
  gult: 'sterkt gult',
  blått: 'lyseblått',
  blågrønt: 'blågrønt',
  rustbrunt: 'rustbrunt',
  brunt: 'brunt',
};
/** Mørke bunnfall får lys tekst; de lyse (hvitt, gult, blått) og det mellombrune får vanlig tekst i begge temaer. */
const DARK: PrecipitateColor[] = ['rustbrunt', 'blågrønt'];
const inkOn = (c: PrecipitateColor) => (DARK.includes(c) ? VIZ.surface : c === 'brunt' ? VIZ.ink : atomColors('H').ink);
const KIND_CODE: Record<SolubilityKind, string> = { løselig: 'L', 'lite løselig': 'lite', tungtløselig: 'T', reagerer: 'R' };

const ionLabel = (f: string) => formulaText(f);

export default function Fellingsreaksjoner() {
  const [cat, setCat] = useState('Pb');
  const [an, setAn] = useState('I');
  const [ci, setCi] = useState(CONCENTRATIONS.indexOf(0.1));
  const c = CONCENTRATIONS[ci] ?? 0.1;
  const cation = CATIONS.find((x) => x.id === cat)!;
  const anion = ANIONS.find((x) => x.id === an)!;
  const info = pairInfo(cat, an);
  const mix = mixSolutions(cat, an, c);
  const clock = useSimClock({ tMax: T_END });
  const { setT } = clock;
  useEffect(() => setT(T_END), [cat, an, ci, setT]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, 0.85 * f);
  const scene = sceneLayout(f, k);
  const table = tableLayout(f);
  const spect = spectatorIons(cat, an);
  const p = info.precipitate;
  const shownP = mix.precipitates && p;

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Løsning 1" value={cat} onChange={setCat} options={CATIONS.map((x) => ({ value: x.id, label: `${x.saltName} (${ionLabel(x.formula)})` }))} />
        <Select label="Løsning 2" value={an} onChange={setAn} options={ANIONS.map((x) => ({ value: x.id, label: `${x.saltName} (${ionLabel(x.formula)})` }))} />
      </Toolbar>
      <Controls>
        <Slider
          label="Konsentrasjon i hver løsning"
          value={ci}
          onChange={setCi}
          min={0}
          max={CONCENTRATIONS.length - 1}
          step={1}
          format={(i) => `${fmt(CONCENTRATIONS[i] ?? 0, (CONCENTRATIONS[i] ?? 0) < 0.01 ? 3 : 2)} mol/L`}
          ariaLabel="Konsentrasjon i hver løsning"
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${scene.H}`}
          label={`${capitalize(cation.saltName)} blandes med ${anion.saltName}. ${shownP ? `Det dannes et ${COLOR_WORD[p.color]} bunnfall av ${p.name}.` : 'Det dannes ikke bunnfall.'}`}
          caption="50 mL av hver løsning blandes. Utsnittet viser ionene i blandingen; tilskuerionene er tegnet blekere. Vannmolekylene er ikke tegnet."
          maxHeight={scene.H}
        >
          <Scene cation={cation} anion={anion} info={info} mix={mix} t={clock.t} layout={scene} f={f} k={k} />
        </Figure>
      </div>
      <PlayControls clock={clock} decimals={1} />
      <Legend
        items={[
          { color: KJEMI.plus, label: 'Positive ioner' },
          { color: KJEMI.minus, label: 'Negative ioner' },
          // Hvitt bunnfall vises med en lys grå strek, ellers synes den ikke mot bakgrunnen
          ...(shownP ? [{ color: p.color === 'hvitt' ? mixColor(WHITE, VIZ.muted, 0.45) : PRECIPITATE_COLOR[p.color], label: `Bunnfall (${COLOR_WORD[p.color]})` }] : []),
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${table.H}`}
        label="Løselighetstabell for kationene og anionene. Trykk på en rute for å velge paret."
        caption="L = løselig, lite = lite løselig, T = tungtløselig (bunnfall), R = reagerer på en annen måte. Trykk på en rute for å blande de to ionene."
        maxHeight={table.H}
      >
        <SolubilityTable cat={cat} an={an} onPick={(a, b) => (setCat(a), setAn(b))} layout={table} f={f} />
      </Figure>

      <Readouts>
        <Readout label="Bunnfall" value={shownP ? formulaText(p.formula) : 'Ingen'} />
        <Readout label="Farge" value={shownP ? capitalize(COLOR_WORD[p.color]) : '–'} />
        <Readout label="Masse bunnfall" value={shownP ? fmtSig(mix.mass, 3) : '0'} unit="g" />
        <Readout label="Tilskuerioner" value={spect.map(ionLabel).join(', ')} />
      </Readouts>

      <Formula label="Likninger og mengder">
        {info.net && (mix.precipitates || !p) ? (
          <>
            <FormulaLine>
              Nettolikning: <Reaksjon r={info.net} />
            </FormulaLine>
            <FormulaLine>
              Med saltene: <Reaksjon r={info.full!} />
            </FormulaLine>
          </>
        ) : (
          <FormulaLine>Ingen reaksjon: alle ionene blir i løsningen.</FormulaLine>
        )}
        <FormulaLine>
          Etter blanding: c(<Formel f={cation.formula} />) = c(<Formel f={anion.formula} />) = {fmtSig(c / 2, 2)} mol/L
        </FormulaLine>
        {shownP && (
          <FormulaLine>
            m = n · M = {fmtSig(mix.n, 3)} mol · {fmt(molarMass(p.formula), 2)} g/mol = {fmtSig(mix.mass, 3)} g
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(cation, anion, info, mix, c)}</Explain>
    </VizLayout>
  );
}

/* ---------- Begerglassene og partikkelbildet ---------- */

function sceneLayout(f: number, k: number) {
  const wide = f <= 1.3;
  if (wide) {
    const by = 60;
    return {
      wide,
      A: { x: 18, y: by, w: 86, h: 130 },
      B: { x: 144, y: by, w: 86, h: 130 },
      M: { x: 272, y: by - 10, w: 140, h: 200 },
      zoom: { x: 446, y: 14, w: 340, h: 304 },
      H: Math.round(330 + 10 * f),
    };
  }
  const by = 40 * f;
  const bh = 190;
  const zy = by + bh + 70 * f;
  const zh = 420 * Math.min(1.25, k / 1.3);
  return {
    wide,
    A: { x: 40, y: by + 40, w: 150, h: bh - 40 },
    B: { x: 290, y: by + 40, w: 150, h: bh - 40 },
    M: { x: 560, y: by, w: 200, h: bh },
    zoom: { x: 20, y: zy, w: 760, h: zh },
    H: Math.round(zy + zh + 20),
  };
}

/** Løsningens farge: Cu²⁺ blå, Fe³⁺ gulbrun og jod (I₂) brun. */
function solutionTint(ionId: string, amount: number, base: string = KJEMI.liquid): string {
  if (ionId === 'Cu') return mixColor(base, KJEMI.indicator.btbBasisk, 0.32 * amount);
  if (ionId === 'Fe') return mixColor(base, KJEMI.indicator.btbSur, 0.32 * amount);
  return base;
}

interface P {
  /** Start (rett etter blanding) og slutt (etter reaksjonen). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
  kind: 'kation' | 'anion' | 'tilskuer+' | 'tilskuer-';
  inSolid: boolean;
  /** Flytter seg fra `from` til `to` mens reaksjonen skjer. */
  moves: boolean;
  /** Ny tekst etter reaksjonen (Fe³⁺ → Fe²⁺, Cu²⁺ → Cu⁺ i CuI, OH⁻ → O²⁻ i Ag₂O, I⁻ → I₂). */
  labelAfter?: string;
  /** Blir et nøytralt molekyl (CO₂, H₂O, I₂). */
  neutralAfter?: boolean;
  /** Forsvinner (CO₂ som bobler ut, vann som blandes med resten av vannet, I⁻ som går sammen med et annet til I₂). */
  fades?: boolean;
  /** Kommer til underveis (OH⁻ fra vannet i Fe(OH)₃). */
  appears?: boolean;
  phase: number;
}

function Scene({ cation, anion, info, mix, t, layout, f, k }: { cation: Ion; anion: Ion; info: PairInfo; mix: MixResult; t: number; layout: ReturnType<typeof sceneLayout>; f: number; k: number }) {
  const { zoom, A, B, M } = layout;
  const pr = Math.min(1, t / T_END);
  const r = (layout.wide ? 13 : 17) * k;
  const p = info.precipitate;
  const key = `${cation.id}-${anion.id}`;
  const parts = useMemo(() => buildParticles(cation, anion, mix, zoom, r, 34 * f), [cation, anion, mix, zoom.x, zoom.y, zoom.w, zoom.h, r, f]);
  const tintCat = cation.id === 'Cu' || cation.id === 'Fe' ? cation.id : '';
  // Hvor mye av det fargede kationet som er igjen i løsningen (Fe³⁺ blir til Fe²⁺ med jodid)
  const consumed = cation.id === 'Fe' && anion.id === 'I' ? 1 : mix.precipitates && p ? Math.min(1, (mix.x * p.a) / mix.cCation) : 0;
  const leftCat = 1 - consumed * pr;
  const brown = info.solutionColor === 'brun' && (mix.precipitates || !p) ? pr : 0;
  let liquid = solutionTint(tintCat, leftCat);
  if (brown > 0) liquid = mixColor(liquid, atomColors('Br').line, 0.4 * brown);
  const solid = p && mix.precipitates ? PRECIPITATE_COLOR[p.color] : null;
  const amount = mix.precipitates ? Math.min(1, mix.mass / 2) : 0;
  return (
    <g>
      <Begerglass x={A.x} y={A.y} w={A.w} h={A.h} level={0.62} liquid={solutionTint(tintCat, 1)} label={<TFormel f={cation.salt} state="aq" />} />
      <Txt x={(A.x + A.w + B.x) / 2} y={A.y + A.h * 0.6} size={1.2} weight={700}>
        +
      </Txt>
      <Begerglass x={B.x} y={B.y} w={B.w} h={B.h} level={0.62} label={<TFormel f={anion.salt} state="aq" />} />
      <Txt x={(B.x + B.w + M.x) / 2} y={A.y + A.h * 0.6} size={1.2} weight={700}>
        →
      </Txt>
      <Begerglass x={M.x} y={M.y} w={M.w} h={M.h} level={0.7} liquid={liquid} label={solid ? <TFormel f={p!.formula} state="s" /> : 'ingen bunnfall'}>
        {(box: Box) => <Suspension box={box} color={solid} amount={amount} pr={pr} gas={!!info.gas && mix.precipitates} seed={key.length} k={k} />}
      </Begerglass>
      {/* Lupe fra blandingen til utsnittet */}
      {layout.wide ? (
        <>
          <circle cx={M.x + M.w * 0.62} cy={M.y + M.h * 0.6} r={14} fill="none" stroke={VIZ.ink} strokeWidth={2} />
          <line x1={M.x + M.w * 0.62} y1={M.y + M.h * 0.6 - 14} x2={zoom.x} y2={zoom.y + 10} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <line x1={M.x + M.w * 0.62} y1={M.y + M.h * 0.6 + 14} x2={zoom.x} y2={zoom.y + zoom.h - 10} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
        </>
      ) : (
        <>
          <circle cx={M.x + M.w * 0.5} cy={M.y + M.h * 0.62} r={16} fill="none" stroke={VIZ.ink} strokeWidth={2} />
          <line x1={M.x + M.w * 0.5 - 16} y1={M.y + M.h * 0.62} x2={zoom.x + 20} y2={zoom.y} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
          <line x1={M.x + M.w * 0.5 + 16} y1={M.y + M.h * 0.62} x2={zoom.x + zoom.w - 20} y2={zoom.y} stroke={KJEMI.glass} strokeWidth={1.2} strokeDasharray="4 4" />
        </>
      )}
      <rect x={zoom.x} y={zoom.y} width={zoom.w} height={zoom.h} rx={16} fill={liquid} stroke={KJEMI.glass} strokeWidth={2} />
      {parts.map((q, i) => (
        <Particle key={i} q={q} pr={pr} t={t} r={r} solid={solid} solidInk={p ? inkOn(p.color) : VIZ.ink} k={k} />
      ))}
      {solid && pr > 0.6 && (
        <Txt x={zoom.x + 14} y={zoom.y + 26 * f} anchor="start" size={0.8} weight={700} color={VIZ.ink}>
          bunnfall av <TFormel f={p!.formula} state="s" /> nederst
        </Txt>
      )}
    </g>
  );
}

/** Svevende korn som synker til bunns (bunnfallet) og eventuelt gassbobler. */
function Suspension({ box, color, amount, pr, gas, seed, k }: { box: Box; color: string | null; amount: number; pr: number; gas: boolean; seed: number; k: number }) {
  if (!color) return null;
  const rnd = seededRandom(31 + seed);
  const n = Math.round(10 + 40 * amount);
  const settledH = Math.max(6, box.h * 0.22 * Math.max(0.15, amount)) * pr;
  const bottom = box.y + box.h;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = box.x + rnd() * box.w;
        const y0 = box.y + rnd() * box.h;
        const y = y0 + (bottom - 4 - y0) * Math.min(1, pr * (0.8 + rnd() * 0.4));
        return <circle key={i} cx={x} cy={y} r={(1.6 + rnd() * 1.6) * k} fill={color} stroke={VIZ.muted} strokeWidth={0.6} opacity={0.9} />;
      })}
      <rect x={box.x - 4} y={bottom - settledH} width={box.w + 8} height={settledH + 6} fill={color} stroke={VIZ.muted} strokeWidth={0.8} />
      {gas &&
        Array.from({ length: 6 }, (_, i) => (
          <circle key={`g${i}`} cx={box.x + ((i + 0.5) * box.w) / 6} cy={bottom - settledH - 10 - ((pr * 90 + i * 23) % (box.h * 0.7))} r={4 * k} fill="none" stroke={KJEMI.glass} strokeWidth={1.4} />
        ))}
    </g>
  );
}

/** Bygger partiklene i utsnittet: ionene fra begge løsningene, og hvor hver av dem ender (se unitParticles i model.ts). */
function buildParticles(
  cation: Ion,
  anion: Ion,
  mix: MixResult,
  zoom: { x: number; y: number; w: number; h: number },
  r: number,
  labelBand: number,
): P[] {
  const u = unitParticles(cation.id, anion.id);
  const { ions, units } = zoomCounts(cation.id, anion.id, mix);
  const nNO3 = ions * cation.charge;
  const nNa = ions * -anion.charge;
  // Na⁺ og NO₃⁻ fra begge løsningene er tilskuerioner; velger eleven dem selv, tegnes de også blekt.
  const catSpect = cation.id === 'Na';
  const anSpect = anion.id === 'NO3';
  const groups = [
    { n: ions, r: catSpect ? r * 0.8 : r },
    { n: ions, r: anSpect ? r * 0.8 : r },
    { n: nNO3, r: r * 0.8 },
    { n: nNa, r: r * 0.8 },
  ];
  const nCatSolid = u ? units * u.cationsInSolid : 0;
  const nCatConv = u ? units * u.cationsConverted : 0;
  const nAnSolid = u ? units * u.anionsInSolid : 0;
  const nAnConv = u ? units * u.anionsConverted : 0;
  const nWater = u ? units * u.fromWater : 0;
  // Gitteret nederst i utsnittet
  const solidCount = nCatSolid + nAnSolid + nWater;
  const d = 2 * r + 2;
  const cols = Math.max(1, Math.min(Math.floor((zoom.w - 40) / d), Math.ceil(Math.sqrt(solidCount * 3))));
  const slots: { x: number; y: number; even: boolean }[] = [];
  const rows = Math.ceil(solidCount / cols);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x0 = zoom.x + zoom.w / 2 - ((cols - 1) * d) / 2;
      slots.push({ x: x0 + col * d, y: zoom.y + zoom.h - r - 8 - row * d * 0.92, even: (row + col) % 2 === 0 });
    }
  // De frie ionene holder seg over gitteret
  const band = rows > 0 ? rows * d * 0.92 + 12 : 0;
  const top = rows > 0 ? labelBand : 0;
  const box = { x: zoom.x + 6, y: zoom.y + 6 + top, w: zoom.w - 12, h: zoom.h - 12 - band - top };
  const placed = placeParticles(box, groups, 9 + cation.charge * 3 - anion.charge);
  const at = (g: number, i: number) => placed.find((q) => q.group === g && q.index === i);
  const evenSlots = slots.filter((s) => s.even);
  const oddSlots = slots.filter((s) => !s.even);
  const nextSlot = (pref: 'even' | 'odd') => (pref === 'even' ? evenSlots.shift() ?? oddSlots.shift() : oddSlots.shift() ?? evenSlots.shift());
  const out: P[] = [];
  const cl = ionLabel(cation.formula);
  const al = ionLabel(anion.formula);
  for (let i = 0; i < ions; i++) {
    const q = at(0, i)!;
    const solid = i < nCatSolid;
    const conv = !solid && i < nCatSolid + nCatConv;
    const s = solid ? nextSlot('even') : undefined;
    const after = solid && u && u.cationInSolid !== cation.formula ? ionLabel(u.cationInSolid) : conv && u?.cationAfter ? ionLabel(u.cationAfter) : undefined;
    out.push({ from: q, to: s ?? q, label: cl, kind: catSpect ? 'tilskuer+' : 'kation', inSolid: solid, moves: solid, labelAfter: after, phase: q.phase });
  }
  for (let i = 0; i < ions; i++) {
    const q = at(1, i)!;
    const kind = anSpect ? 'tilskuer-' : 'anion';
    if (i < nAnSolid) {
      const s = nextSlot('odd');
      const after = u && u.anionInSolid !== anion.formula ? ionLabel(u.anionInSolid) : undefined;
      out.push({ from: q, to: s ?? q, label: al, kind, inSolid: true, moves: true, labelAfter: after, phase: q.phase });
      continue;
    }
    const j = i - nAnSolid;
    if (u && j < nAnConv) {
      if (u.convertedTo === 'I2') {
        // To og to jodidioner blir ett I₂-molekyl: det ene blir stående og får navnet I₂, det andre glir inn i det og
        // forsvinner (så I₂ havner på en ledig plass og ikke oppå andre ioner).
        if (j % 2 === 0) out.push({ from: q, to: q, label: al, kind, inSolid: false, moves: false, labelAfter: 'I₂', neutralAfter: true, phase: q.phase });
        else out.push({ from: q, to: at(1, i - 1) ?? q, label: al, kind, inSolid: false, moves: true, fades: true, phase: q.phase });
      } else if (u.convertedTo === 'CO2') {
        out.push({ from: q, to: { x: q.x, y: zoom.y + 4 }, label: al, kind, inSolid: false, moves: true, labelAfter: 'CO₂', neutralAfter: true, fades: true, phase: q.phase });
      } else {
        // OH⁻ som tar opp et H⁺ fra det andre OH⁻ (som blir O²⁻ i Ag₂O): blir vann og blandes med resten av vannet.
        out.push({ from: q, to: { x: q.x, y: q.y + 10 }, label: al, kind, inSolid: false, moves: true, labelAfter: 'H₂O', neutralAfter: true, fades: true, phase: q.phase });
      }
      continue;
    }
    out.push({ from: q, to: q, label: al, kind, inSolid: false, moves: false, phase: q.phase });
  }
  for (let i = 0; i < nWater; i++) {
    const s = nextSlot('odd');
    if (!s) break;
    out.push({ from: { x: s.x, y: zoom.y + zoom.h * 0.3 }, to: s, label: 'OH⁻', kind: 'anion', inSolid: true, moves: true, appears: true, phase: i });
  }
  for (let i = 0; i < nNO3; i++) {
    const q = at(2, i)!;
    out.push({ from: q, to: q, label: 'NO₃⁻', kind: 'tilskuer-', inSolid: false, moves: false, phase: q.phase });
  }
  for (let i = 0; i < nNa; i++) {
    const q = at(3, i)!;
    out.push({ from: q, to: q, label: 'Na⁺', kind: 'tilskuer+', inSolid: false, moves: false, phase: q.phase });
  }
  return out;
}

function Particle({ q, pr, t, r, solid, solidInk, k }: { q: P; pr: number; t: number; r: number; solid: string | null; solidInk: string; k: number }) {
  // Hver partikkel starter litt forskjøvet i tid
  const delay = (q.phase / 6.28) * 0.35;
  const m = q.moves ? Math.min(1, Math.max(0, (pr - delay) / (1 - delay))) : 0;
  const e = m * m * (3 - 2 * m);
  const amp = q.inSolid ? 3 * k * (1 - e) : 3 * k;
  const jx = amp * Math.sin(1.3 * t + q.phase);
  const jy = amp * Math.cos(1.1 * t + q.phase * 1.7);
  const x = q.from.x + (q.to.x - q.from.x) * e + jx;
  const y = q.from.y + (q.to.y - q.from.y) * e + jy;
  const spect = q.kind === 'tilskuer+' || q.kind === 'tilskuer-';
  const positive = q.kind === 'kation' || q.kind === 'tilskuer+';
  const changed = q.labelAfter !== undefined && pr > 0.5;
  const sign = changed && q.neutralAfter ? VIZ.muted : positive ? KJEMI.plus : KJEMI.minus;
  const rr = spect ? r * 0.8 : r;
  const opacity = q.fades ? 1 - e : q.appears ? Math.min(1, pr * 3) : spect ? 0.45 : 1;
  const inSolidNow = q.inSolid && solid && pr > 0.5;
  const fill = inSolidNow ? solid : changed && q.neutralAfter ? mixColor(VIZ.surface, KJEMI.molecule, 0.25) : mixColor(VIZ.surface, positive ? KJEMI.plus : KJEMI.minus, 0.22);
  const label = changed ? q.labelAfter! : q.label;
  if (opacity <= 0.02) return null;
  if (changed && q.labelAfter === 'I₂') {
    const c = atomColors('I');
    return (
      <g opacity={opacity}>
        <circle cx={x - r * 0.45} cy={y} r={r * 0.75} fill={c.fill} stroke={c.line} strokeWidth={1.5} />
        <circle cx={x + r * 0.45} cy={y} r={r * 0.75} fill={c.fill} stroke={c.line} strokeWidth={1.5} />
        <text x={x} y={y + r * 0.3} textAnchor="middle" className="kj-atom-symbol" style={{ fill: c.ink, fontSize: r * 0.75 }}>
          I₂
        </text>
      </g>
    );
  }
  return (
    <g opacity={opacity}>
      <circle cx={x} cy={y} r={rr} fill={fill} stroke={sign} strokeWidth={spect ? 1.2 : 2} />
      <text x={x} y={y + rr * 0.3} textAnchor="middle" className="kj-atom-symbol" style={{ fill: inSolidNow ? solidInk : VIZ.ink, fontSize: rr * (label.length > 3 ? 0.62 : 0.78) }}>
        {label}
      </text>
    </g>
  );
}

/* ---------- Løselighetstabellen ---------- */

function tableLayout(f: number) {
  const head = 42 * f;
  const rowH = 34 * f;
  const x0 = 150 * Math.min(1.3, f);
  const colW = (800 - x0 - 6) / ANIONS.length;
  return { head, rowH, x0, colW, H: Math.round(head + CATIONS.length * rowH + 10) };
}

function SolubilityTable({ cat, an, onPick, layout, f }: { cat: string; an: string; onPick: (c: string, a: string) => void; layout: ReturnType<typeof tableLayout>; f: number }) {
  const { head, rowH, x0, colW } = layout;
  const ci = CATIONS.findIndex((c) => c.id === cat);
  const ai = ANIONS.findIndex((a) => a.id === an);
  return (
    <g>
      <rect x={x0 + ai * colW} y={4} width={colW} height={head + CATIONS.length * rowH - 2} rx={6} fill={mixColor(VIZ.surface, VIZ.ink, 0.06)} />
      <rect x={4} y={head + ci * rowH} width={x0 + ANIONS.length * colW - 4} height={rowH} rx={6} fill={mixColor(VIZ.surface, VIZ.ink, 0.06)} />
      {ANIONS.map((a, j) => (
        <Txt key={a.id} x={x0 + (j + 0.5) * colW} y={head - 12 * f} size={0.9} weight={j === ai ? 800 : 600}>
          <TFormel f={a.formula} />
        </Txt>
      ))}
      {CATIONS.map((c, i) => (
        <Txt key={c.id} x={x0 - 16} y={head + (i + 0.5) * rowH + 6 * f} anchor="end" size={0.9} weight={i === ci ? 800 : 600}>
          <TFormel f={c.formula} />
        </Txt>
      ))}
      {CATIONS.map((c, i) =>
        ANIONS.map((a, j) => {
          const info = pairInfo(c.id, a.id);
          const col = info.precipitate ? PRECIPITATE_COLOR[info.precipitate.color] : null;
          const on = i === ci && j === ai;
          const fill =
            info.kind === 'tungtløselig' && col ? col : info.kind === 'lite løselig' && col ? mixColor(VIZ.surface, col, 0.5) : info.kind === 'reagerer' && col ? mixColor(VIZ.surface, col, 0.6) : VIZ.surface;
          return (
            <g key={`${c.id}-${a.id}`} onClick={() => onPick(c.id, a.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={x0 + j * colW + 3}
                y={head + i * rowH + 3}
                width={colW - 6}
                height={rowH - 6}
                rx={5}
                fill={fill}
                stroke={on ? VIZ.ink : info.kind === 'løselig' ? VIZ.grid : VIZ.muted}
                strokeWidth={on ? 3 : 1}
                strokeDasharray={info.kind === 'reagerer' ? '4 3' : undefined}
              />
              <text
                x={x0 + (j + 0.5) * colW}
                y={head + (i + 0.5) * rowH + 5 * f}
                textAnchor="middle"
                className="viz-tick"
                style={{
                  fill: info.kind === 'løselig' ? VIZ.muted : info.kind === 'tungtløselig' && info.precipitate ? inkOn(info.precipitate.color) : VIZ.ink,
                  fontWeight: info.kind === 'løselig' ? 500 : 800,
                }}
              >
                {KIND_CODE[info.kind]}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}

/* ---------- Forklaring ---------- */

const gcdOf = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcdOf(b, a % b));

function explanation(cation: Ion, anion: Ion, info: PairInfo, mix: MixResult, c: number): ReactNode {
  const C = <Formel f={cation.formula} />;
  const A = <Formel f={anion.formula} />;
  const p = info.precipitate;
  const spect = (
    <>
      <Formel f="Na^+" /> og <Formel f="NO3^-" />
    </>
  );
  if (info.kind === 'løselig') {
    const always = cation.id === 'Na' || cation.id === 'K' || anion.id === 'NO3';
    return (
      <p>
        <strong>Ingen bunnfall.</strong> {C} og {A} danner et løselig salt, så ionene blir værende hver for seg i løsningen. Alle ionene er
        tilskuerioner, og det skjer ingen reaksjon.
        {always ? ' Natrium-, kalium- og nitratsalter er alltid løselige, derfor brukes de til å lage løsningene.' : ''}
      </p>
    );
  }
  if (info.kind === 'reagerer' && !p)
    return (
      <p>
        <strong>Ingen bunnfall, men en reaksjon.</strong> {info.note} Nettolikningen: <Reaksjon r={info.net!} />.
      </p>
    );
  const word = COLOR_WORD[p!.color];
  const P = <Formel f={p!.formula} />;
  // Forholdet mellom ionene i nettolikningen, forkortet (CuI: 4 I⁻ per 2 Cu²⁺ = 2 per 1)
  const g = gcdOf(p!.a, p!.b);
  const ra = p!.a / g;
  const rb = p!.b / g;
  const limit =
    mix.limiting === 'anion' ? (
      <>
        {' '}
        Det trengs {rb} {A} per {ra === 1 ? '' : `${ra} `}
        {C}, så {A} blir brukt opp først, og det blir {C} igjen i løsningen.
      </>
    ) : mix.limiting === 'kation' ? (
      <>
        {' '}
        Det trengs {ra} {C} per {rb === 1 ? '' : `${rb} `}
        {A}, så {C} blir brukt opp først, og det blir {A} igjen i løsningen.
      </>
    ) : null;
  if (!mix.precipitates)
    return (
      <p>
        <strong>
          {P} er {info.kind}, men det blir ikke bunnfall ved {fmt(c, c < 0.01 ? 3 : 2)} mol/L.
        </strong>{' '}
        Etter blandingen er konsentrasjonene bare {fmtSig(c / 2, 2)} mol/L, og så lite {P} kan løses helt i vannet.
        {info.kind === 'tungtløselig' ? ' Selv tungtløselige salter løses litt.' : ''} Øk konsentrasjonen, så felles {p!.name} ut som et {word}{' '}
        bunnfall.
      </p>
    );
  return (
    <>
      <p>
        <strong>
          {capitalize(word)} bunnfall av {p!.name} ({P}).
        </strong>{' '}
        Når løsningene blandes, møtes {C} og {A}.{' '}
        {info.kind === 'reagerer'
          ? info.note
          : `${formulaText(p!.formula)} er ${info.kind} (${KIND_CODE[info.kind]} i tabellen), så ionene binder seg til et fast stoff som felles ut.`}{' '}
        {spect} er tilskuerioner: de er i løsningen både før og etter og står ikke i nettolikningen.
        {limit}
      </p>
      <p>
        {info.kind === 'lite løselig'
          ? `${capitalize(p!.name)} er lite løselig: ved lave konsentrasjoner blir alt værende i løsningen. Prøv å senke konsentrasjonen. `
          : ''}
        Det faste stoffet er {P}, ikke natriumnitrat: <Formel f="NaNO3" /> er løselig og blir i løsningen. Med 50 mL av hver løsning dannes{' '}
        {fmtSig(mix.mass, 3)} g bunnfall.
        {info.kind !== 'reagerer' && info.note ? ` ${info.note}` : ''}
      </p>
    </>
  );
}

