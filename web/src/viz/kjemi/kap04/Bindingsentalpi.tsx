import { useState, type ReactNode } from 'react';
import {
  Atom,
  Bond,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Reaksjon,
  Select,
  Slider,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomRadius,
  fmt,
  fmtSig,
  reaction,
  scaleLinear,
  useContainerTextScale,
  useSimClock,
  type Term,
} from '../kit';
import { BOND_REACTIONS, bondEstimate, moleculeTemplate, onlyDiatomic, type BondEstimate, type BondTally } from './model';

const BREAK = KJEMI.endo;
const FORM = KJEMI.exo;
/** Animasjonen tar 4 s: 0–2 s brytes bindingene, 2–4 s dannes de nye. */
const T_MAX = 4;

const signed = (v: number, d = 0) => (v > 0 ? `+${fmt(v, d)}` : fmt(v, d));
const ease = (u: number) => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

export default function Bindingsentalpi() {
  const [id, setId] = useState(BOND_REACTIONS[1]!.id);
  const clock = useSimClock({ tMax: T_MAX });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const br = BOND_REACTIONS.find((b) => b.id === id) ?? BOND_REACTIONS[0]!;
  const rx = reaction(br.equation);
  const est = bondEstimate(rx);
  const p = (clock.t / T_MAX) * 2;
  const k = Math.max(1, 0.85 * f);
  const scene = sceneLayout(rx.reactants, rx.products, k, f);
  const eNarrow = f > 1.3;
  const eF = eNarrow ? 1 : f;
  const E = energyLayout(eNarrow, eF);
  const diff = est.dH - br.tabulated;

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Reaksjon"
          value={id}
          onChange={(v) => {
            setId(v);
            clock.reset();
          }}
          options={BOND_REACTIONS.map((b) => ({ value: b.id, label: b.name }))}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Trinn"
          value={Math.round(p * 50)}
          onChange={(v) => {
            clock.pause();
            clock.setT((v / 100) * T_MAX);
          }}
          min={0}
          max={100}
          step={1}
          format={(v) => stageName(v / 50)}
        />
      </Controls>
      <PlayControls clock={clock} label="t" />

      <div ref={ref}>
        <Figure viewBox={`0 0 800 ${scene.H}`} label={`${stageName(p)}. Bindinger som brytes er blå, bindinger som dannes er oransje.`} maxHeight={scene.H}>
          <MoleculeScene scene={scene} p={p} k={k} f={f} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: BREAK, label: 'Bindinger som brytes (energi inn)' },
          { color: FORM, label: 'Bindinger som dannes (energi ut)' },
        ]}
      />

      <Figure
        viewBox={`0 0 ${E.W} ${E.H}`}
        label={`Energidiagram: ${fmt(est.sumBroken, 0)} kJ inn for å bryte bindingene, ${fmt(est.sumFormed, 0)} kJ ut når nye dannes. ΔH ≈ ${signed(est.dH)} kJ.`}
        caption="Alle tall i kJ, regnet med gjennomsnittlige bindingsentalpier for gasser."
        maxHeight={E.H}
      >
        <EnergyStairs est={est} rx={rx.reactants} products={rx.products} p={p} E={E} f={eF} />
      </Figure>

      <Readouts>
        <Readout label="Bindinger brutt (inn)" value={signed(est.sumBroken)} unit="kJ" tone={BREAK} />
        <Readout label="Bindinger dannet (ut)" value={signed(-est.sumFormed)} unit="kJ" tone={FORM} />
        <Readout label="ΔH beregnet" value={signed(est.dH)} unit="kJ" />
        <Readout label="ΔH fra tabell" value={signed(br.tabulated, 1)} unit="kJ" />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          <Reaksjon r={rx} />
        </FormulaLine>
        <FormulaLine>
          Brutt: {tallyText(est.broken)} = {fmt(est.sumBroken, 0)} kJ
        </FormulaLine>
        <FormulaLine>
          Dannet: {tallyText(est.formed)} = {fmt(est.sumFormed, 0)} kJ
        </FormulaLine>
        <FormulaLine>
          ΔH ≈ Σ brutte − Σ dannede = {fmt(est.sumBroken, 0)} kJ − {fmt(est.sumFormed, 0)} kJ = {signed(est.dH)} kJ
        </FormulaLine>
      </Formula>

      <Explain>{explanation(br.tabulated, br.liquid, est, diff, p)}</Explain>
    </VizLayout>
  );
}

function tallyText(t: BondTally[]): string {
  return t.map((b) => `${b.count} · ${fmt(b.each, 0)} (${b.bond})`).join(' + ');
}

function stageName(p: number): string {
  if (p <= 0.02) return 'Før reaksjonen';
  if (p < 0.98) return 'Bindinger brytes';
  if (p <= 1.02) return 'Frie atomer';
  if (p < 1.98) return 'Nye bindinger dannes';
  return 'Etter reaksjonen';
}

/* ---------- Figur 1: molekylene ---------- */

interface SceneAtom {
  el: string;
  /** Plassering før (reaktanter), som frie atomer og etter (produkter). */
  a: { x: number; y: number };
  free: { x: number; y: number };
  b: { x: number; y: number };
  r: number;
}

interface SceneBond {
  i: number;
  j: number;
  order: 1 | 2 | 3;
}

interface SceneLayout {
  atoms: SceneAtom[];
  before: SceneBond[];
  after: SceneBond[];
  /** Etiketter under molekylene: (x, formel med koeffisient). */
  labelsA: { x: number; t: Term }[];
  labelsB: { x: number; t: Term }[];
  plusA: number[];
  plusB: number[];
  cy: number;
  labelY: number;
  H: number;
}

interface Placed {
  el: string;
  x: number;
  y: number;
  r: number;
}

/** Legger molekylene på én side etter hverandre, sentrert. Gir atomer, bindinger, etiketter og plusstegn. */
function layoutSide(terms: Term[], k: number, cy: number) {
  const gap = 22 * k;
  const plusW = 34 * k;
  const mols: { atoms: Placed[]; bonds: { i: number; j: number; order: 1 | 2 | 3 }[]; w: number; species: number }[] = [];
  terms.forEach((t, si) => {
    const m = moleculeTemplate(t.formula);
    const rc = atomRadius(m.center, { scale: k });
    for (let c = 0; c < t.coef; c++) {
      const atoms: Placed[] = [{ el: m.center, x: 0, y: 0, r: rc }];
      const bonds: { i: number; j: number; order: 1 | 2 | 3 }[] = [];
      m.ligands.forEach((l, li) => {
        const rl = atomRadius(l.el, { scale: k });
        const d = rc + rl + 20 * k;
        atoms.push({ el: l.el, x: l.dx * d, y: l.dy * d, r: rl });
        bonds.push({ i: 0, j: li + 1, order: l.order });
      });
      const minX = Math.min(...atoms.map((a) => a.x - a.r));
      const maxX = Math.max(...atoms.map((a) => a.x + a.r));
      for (const a of atoms) a.x -= minX;
      mols.push({ atoms, bonds, w: maxX - minX, species: si });
    }
  });
  let total = 0;
  mols.forEach((m, i) => {
    total += m.w;
    if (i > 0) total += mols[i - 1]!.species === m.species ? gap : plusW + gap;
  });
  const avail = 760;
  const s = Math.min(1, avail / total);
  let x = 400 - (total * s) / 2;
  const atoms: Placed[] = [];
  const bonds: { i: number; j: number; order: 1 | 2 | 3 }[] = [];
  const labels: { x: number; t: Term }[] = [];
  const plus: number[] = [];
  let groupStart = x;
  mols.forEach((m, mi) => {
    if (mi > 0) {
      if (mols[mi - 1]!.species === m.species) x += gap * s;
      else {
        labels.push({ x: (groupStart + x) / 2, t: terms[mols[mi - 1]!.species]! });
        plus.push(x + ((plusW + gap) * s) / 2);
        x += (plusW + gap) * s;
        groupStart = x;
      }
    }
    const offset = atoms.length;
    for (const a of m.atoms) atoms.push({ el: a.el, x: x + a.x * s, y: cy + a.y * s, r: a.r * s });
    for (const b of m.bonds) bonds.push({ i: b.i + offset, j: b.j + offset, order: b.order });
    x += m.w * s;
  });
  labels.push({ x: (groupStart + x) / 2, t: terms[mols[mols.length - 1]!.species]! });
  return { atoms, bonds, labels, plus };
}

function sceneLayout(reactants: Term[], products: Term[], k: number, f: number): SceneLayout {
  const top = 34 * f;
  // Hvor langt molekylene strekker seg over og under midtlinja (NH₃ har et H rett opp).
  const probeA = layoutSide(reactants, k, 0);
  const probeB = layoutSide(products, k, 0);
  const ext = Math.max(...[...probeA.atoms, ...probeB.atoms].map((a) => Math.abs(a.y) + a.r));
  const rMax0 = Math.max(...probeA.atoms.map((a) => a.r));
  const half = Math.max(ext, 2 * rMax0 + 10 * k) + 8 * k;
  const cy = top + half;
  const A = layoutSide(reactants, k, cy);
  const B = layoutSide(products, k, cy);
  // Par opp atomene grunnstoff for grunnstoff, fra venstre mot høyre.
  const order = (list: Placed[], el: string) =>
    list
      .map((a, i) => ({ a, i }))
      .filter((x) => x.a.el === el)
      .sort((p, q) => p.a.x - q.a.x)
      .map((x) => x.i);
  const els = [...new Set(A.atoms.map((a) => a.el))];
  const pairOfB = new Map<number, number>();
  for (const el of els) {
    const la = order(A.atoms, el);
    const lb = order(B.atoms, el);
    la.forEach((ia, n) => pairOfB.set(ia, lb[n] ?? ia));
  }
  // Frie atomer: jevnt fordelt i én eller to rader, i rekkefølge etter gjennomsnittlig x.
  const idx = A.atoms.map((_, i) => i).sort((i, j) => A.atoms[i]!.x + B.atoms[pairOfB.get(i)!]!.x - (A.atoms[j]!.x + B.atoms[pairOfB.get(j)!]!.x));
  const n = idx.length;
  const rMax = Math.max(...A.atoms.map((a) => a.r));
  const oneRow = 760 / n >= 2 * rMax + 12 * k;
  const perRow = oneRow ? n : Math.ceil(n / 2);
  const free = new Map<number, { x: number; y: number }>();
  idx.forEach((ai, pos) => {
    const row = oneRow ? 0 : pos % 2;
    const col = oneRow ? pos : Math.floor(pos / 2);
    const spacing = 760 / (oneRow ? n : perRow + 0.5);
    const x = 20 + spacing * (col + 0.5 + row * 0.5);
    const y = oneRow ? cy : cy + (row === 0 ? -1 : 1) * (rMax + 10 * k);
    free.set(ai, { x, y });
  });
  // Atomindeks i B-lista → indeks i A-lista, så produktbindingene kan tegnes mellom de samme atomene.
  const aOfB = new Map<number, number>();
  for (const [ia, ib] of pairOfB) aOfB.set(ib, ia);
  const atoms: SceneAtom[] = A.atoms.map((a, i) => {
    const b = B.atoms[pairOfB.get(i)!]!;
    return { el: a.el, a: { x: a.x, y: a.y }, free: free.get(i)!, b: { x: b.x, y: b.y }, r: Math.min(a.r, b.r) };
  });
  const after = B.bonds.map((bd) => ({ i: aOfB.get(bd.i)!, j: aOfB.get(bd.j)!, order: bd.order }));
  const labelY = cy + half + 26 * f;
  return { atoms, before: A.bonds, after, labelsA: A.labels, labelsB: B.labels, plusA: A.plus, plusB: B.plus, cy, labelY, H: Math.round(labelY + 16 * f) };
}

function MoleculeScene({ scene, p, k, f }: { scene: SceneLayout; p: number; k: number; f: number }) {
  const u1 = ease(p);
  const u2 = ease(p - 1);
  const pos = (a: SceneAtom) =>
    p <= 1
      ? { x: a.a.x + (a.free.x - a.a.x) * u1, y: a.a.y + (a.free.y - a.a.y) * u1 }
      : { x: a.free.x + (a.b.x - a.free.x) * u2, y: a.free.y + (a.b.y - a.free.y) * u2 };
  const P = scene.atoms.map((a) => ({ ...pos(a), el: a.el, r: a.r }));
  const beforeOpacity = p < 1 ? 1 - ease(p * 1.25) : 0;
  const afterOpacity = p > 1 ? ease((p - 1) * 1.25 - 0.25) : 0;
  const stage = stageName(p);
  return (
    <g>
      <Txt x={20} y={24 * f} anchor="start" weight={700} size={0.95}>
        {stage}
      </Txt>
      {beforeOpacity > 0.01 && (
        <g opacity={beforeOpacity}>
          {scene.before.map((b, i) => (
            <Bond key={i} a={P[b.i]!} b={P[b.j]!} order={b.order} color={BREAK} width={3.2 * k} dashed={p > 0.02} />
          ))}
        </g>
      )}
      {afterOpacity > 0.01 && (
        <g opacity={afterOpacity}>
          {scene.after.map((b, i) => (
            <Bond key={i} a={P[b.i]!} b={P[b.j]!} order={b.order} color={FORM} width={3.2 * k} dashed={p < 1.98} />
          ))}
        </g>
      )}
      {P.map((a, i) => (
        <Atom key={i} x={a.x} y={a.y} el={a.el} r={a.r} />
      ))}
      {p <= 0.02 &&
        scene.plusA.map((x, i) => (
          <Txt key={`pa${i}`} x={x} y={scene.cy + 8 * f} size={1.3} weight={700} muted>
            +
          </Txt>
        ))}
      {p >= 1.98 &&
        scene.plusB.map((x, i) => (
          <Txt key={`pb${i}`} x={x} y={scene.cy + 8 * f} size={1.3} weight={700} muted>
            +
          </Txt>
        ))}
      {(p <= 0.02 ? scene.labelsA : p >= 1.98 ? scene.labelsB : []).map((l, i) => (
        <Txt key={`l${i}`} x={l.x} y={scene.labelY} size={0.9} weight={650}>
          <TFormel f={l.t.formula} coef={l.t.coef} />
        </Txt>
      ))}
      {p > 0.02 && p < 1.98 && (
        <Txt x={400} y={scene.labelY} size={0.85} muted>
          {p < 1 ? 'bindingene strekkes og brytes: energi tilføres' : p <= 1.02 ? 'alle bindinger er brutt' : 'nye bindinger dannes: energi frigjøres'}
        </Txt>
      )}
    </g>
  );
}

/* ---------- Figur 2: energitrappa ---------- */

/** På mobil tegnes energitrappa i en smalere viewBox (460 bred) med vanlig tekststørrelse (f = 1). */
function energyLayout(narrow: boolean, f: number) {
  const W = narrow ? 460 : 800;
  const top = 74 * f;
  const plotH = narrow ? 330 : 300;
  const low = top + plotH;
  return {
    narrow,
    W,
    top,
    low,
    col1: narrow ? { x: 64, w: 104 } : { x: 150, w: 120 },
    col2: narrow ? { x: 252, w: 104 } : { x: 470, w: 120 },
    dhX: narrow ? 392 : 700,
    H: Math.round(low + 26 * f + 16),
  };
}

function EnergyStairs({
  est,
  rx,
  products,
  p,
  E,
  f,
}: {
  est: BondEstimate;
  rx: Term[];
  products: Term[];
  p: number;
  E: ReturnType<typeof energyLayout>;
  f: number;
}) {
  const hMax = est.sumBroken;
  const hMin = Math.min(0, est.dH);
  const sy = scaleLinear([hMin, hMax], [E.low, E.top]);
  const y0 = sy(0);
  const yTop = sy(est.sumBroken);
  const yP = sy(est.dH);
  const { col1, col2 } = E;
  const tone = est.dH < 0 ? KJEMI.exo : KJEMI.endo;
  const dot = p <= 1 ? { x: col1.x + col1.w / 2, y: y0 + (yTop - y0) * ease(p) } : { x: col2.x + col2.w / 2, y: yTop + (yP - yTop) * ease(p - 1) };
  const segments = (list: BondTally[], x: number, w: number, from: number, dir: -1 | 1, color: string, activeCol: boolean) => {
    let h = from;
    return list.map((b, i) => {
      const y1 = sy(h);
      h += dir * b.energy;
      const y2 = sy(h);
      const yTopSeg = Math.min(y1, y2);
      const hh = Math.abs(y2 - y1);
      const fits = hh > 44 * f;
      return (
        <g key={b.bond}>
          <rect
            x={x}
            y={yTopSeg}
            width={w}
            height={hh}
            fill={color}
            fillOpacity={(i % 2 ? 0.2 : 0.32) * (activeCol ? 1.3 : 1)}
            stroke={color}
            strokeWidth={2}
          />
          {fits ? (
            <>
              <Txt x={x + w / 2} y={yTopSeg + hh / 2 - 2} size={0.85} weight={700}>
                {b.count} {b.bond}
              </Txt>
              <Txt x={x + w / 2} y={yTopSeg + hh / 2 + 20 * f} size={0.85}>
                {fmt(b.energy, 0)}
              </Txt>
            </>
          ) : (
            hh > 22 * f && (
              <Txt x={x + w / 2} y={yTopSeg + hh / 2 + 6 * f} size={0.75} weight={700}>
                {b.count} {b.bond}
              </Txt>
            )
          )}
        </g>
      );
    });
  };
  const sideText = (terms: Term[]) =>
    terms.map((t, i) => (
      <tspan key={i}>
        {i > 0 ? ' + ' : ''}
        <TFormel f={t.formula} coef={t.coef} />
      </tspan>
    ));
  const atomsText = freeAtomsText(rx);
  return (
    <g>
      {/* Nivåer */}
      {/* Hjelpelinja fra startnivået går rundt søylene, så den ikke krysser tallene i dem */}
      <line x1={10} y1={y0} x2={col1.x} y2={y0} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      <line x1={col1.x + col1.w} y1={y0} x2={col2.x} y2={y0} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      <line x1={col2.x + col2.w} y1={y0} x2={E.dhX + 20} y2={y0} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      <line x1={10} y1={y0} x2={col1.x + col1.w} y2={y0} stroke={VIZ.ink} strokeWidth={3.5} />
      <line x1={col1.x} y1={yTop} x2={col2.x + col2.w} y2={yTop} stroke={VIZ.ink} strokeWidth={3.5} />
      <line x1={col2.x} y1={yP} x2={E.W - 10} y2={yP} stroke={VIZ.ink} strokeWidth={3.5} />

      {segments(est.broken, col1.x, col1.w, 0, 1, BREAK, p <= 1)}
      {segments(est.formed, col2.x, col2.w, est.sumBroken, -1, FORM, p > 1)}

      {/* Overskrifter på søylene */}
      <Txt x={col1.x + col1.w / 2} y={yTop - 12 * f} size={0.85} weight={700} color={BREAK}>
        +{fmt(est.sumBroken, 0)} inn
      </Txt>
      <Txt x={col2.x + col2.w / 2} y={yTop - 12 * f} size={0.85} weight={700} color={FORM}>
        −{fmt(est.sumFormed, 0)} ut
      </Txt>
      <Txt x={(col1.x + col2.x + col2.w) / 2} y={yTop - 54 * f} size={0.8} muted>
        frie atomer
      </Txt>
      <Txt x={(col1.x + col2.x + col2.w) / 2} y={yTop - 34 * f} size={0.8} muted>
        {atomsText}
      </Txt>

      {/* ΔH */}
      {Math.abs(yP - y0) > 6 && (
        <g>
          <line x1={E.dhX} y1={y0} x2={E.dhX} y2={yP + (yP > y0 ? -11 : 11)} stroke={tone} strokeWidth={3} />
          <polygon points={`${E.dhX},${yP} ${E.dhX - 6},${yP + (yP > y0 ? -12 : 12)} ${E.dhX + 6},${yP + (yP > y0 ? -12 : 12)}`} fill={tone} />
        </g>
      )}
      {Math.abs(yP - y0) > 50 * f ? (
        <>
          <Txt x={E.dhX + 10} y={(y0 + yP) / 2 - 4} anchor="start" weight={700} color={tone}>
            ΔH
          </Txt>
          <Txt x={E.dhX + 10} y={(y0 + yP) / 2 + 20 * f} anchor="start" weight={700} color={tone} size={0.9}>
            {signed(est.dH)}
          </Txt>
        </>
      ) : (
        // Liten ΔH: etiketten over hjelpelinja, så den ikke kolliderer med produktnavnet under
        <Txt x={E.W - 10} y={Math.min(y0, yP) - 10} anchor="end" weight={700} color={tone} size={0.9}>
          ΔH = {signed(est.dH)}
        </Txt>
      )}

      {/* Stoffene */}
      <Txt x={10} y={y0 + 26 * f} anchor="start" size={0.85} weight={650}>
        {sideText(rx)}
      </Txt>
      <Txt x={E.W - 10} y={yP + 26 * f} anchor="end" size={0.85} weight={650}>
        {sideText(products)}
      </Txt>

      <circle cx={dot.x} cy={dot.y} r={8} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={2.5} />
    </g>
  );
}

/** «C + 4 H + 4 O»: alle atomene når bindingene er brutt. */
function freeAtomsText(terms: Term[]): string {
  const map = new Map<string, number>();
  for (const t of terms) {
    const m = moleculeTemplate(t.formula);
    map.set(m.center, (map.get(m.center) ?? 0) + t.coef);
    for (const l of m.ligands) map.set(l.el, (map.get(l.el) ?? 0) + t.coef);
  }
  return [...map].map(([el, n]) => `${n === 1 ? '' : `${n} `}${el}`).join(' + ');
}

/* ---------- Forklaring ---------- */

function explanation(tabulated: number, liquid: number | undefined, est: BondEstimate, diff: number, p: number): ReactNode {
  const exo = est.dH < 0;
  const pct = (Math.abs(diff) / Math.abs(tabulated)) * 100;
  return (
    <>
      <p>
        <strong>
          ΔH ≈ Σ brutte − Σ dannede = {fmt(est.sumBroken, 0)} − {fmt(est.sumFormed, 0)} = {signed(est.dH)} kJ.
        </strong>{' '}
        Å bryte en binding krever alltid energi, og når den samme bindingen dannes, frigjøres like mye energi som det kostet å bryte den. Reaksjonen er{' '}
        {exo ? 'eksoterm' : 'endoterm'} fordi
        bindingene i produktene til sammen er {exo ? 'sterkere' : 'svakere'} enn bindingene i reaktantene. Det frigjøres altså ikke energi når bindinger brytes,
        selv om det er en vanlig misforståelse.
      </p>
      <p>
        Tabellverdien er {signed(tabulated, 1)} kJ.{' '}
        {onlyDiatomic(est) ? (
          <>
            Her finnes alle bindingene i toatomige molekyler, så bindingsentalpiene gjelder nettopp disse stoffene, og avviket på {fmt(Math.abs(diff), 1)} kJ (
            {fmtSig(pct, 1)} %) skyldes bare avrunding. Bindinger som C–H og O–H finnes i mange stoffer, og der er tabellverdien et gjennomsnitt.
          </>
        ) : (
          <>
            Bindinger som C–H, O–H og N–H finnes i mange forskjellige stoffer, og tabellverdien er et gjennomsnitt, så beregningen blir et anslag: her er
            avviket {fmt(Math.abs(diff), 1)} kJ ({fmtSig(pct, 1)} %).
          </>
        )}
        {liquid !== undefined && (
          <>
            {' '}
            Bindingsentalpier gjelder for gasser. Dannes flytende vann, er ΔH = {signed(liquid, 1)} kJ, fordi det frigjøres ekstra energi når vanndampen
            kondenserer.
          </>
        )}
      </p>
      <p>
        {p <= 0.02 ? (
          <>Start animasjonen eller dra i trinn-glidebryteren. De blå bindingene i reaktantene brytes først, og atomene blir frie.</>
        ) : p < 1.98 ? (
          <>
            {p <= 1
              ? 'Bindingene i reaktantene brytes. Energien som trengs, tilføres fra omgivelsene, og punktet i energidiagrammet går opp.'
              : 'Atomene binder seg sammen på nye måter. Energien som frigjøres, avgis til omgivelsene, og punktet går ned.'}{' '}
            I virkeligheten skjer bruddene og dannelsene samtidig, men regnestykket blir det samme.
          </>
        ) : (
          <>
            Alle de oransje bindingene i produktene er dannet.{' '}
            {exo ? 'Det ble frigjort mer energi enn det kostet å bryte bindingene.' : 'Det kostet mer energi å bryte bindingene enn det som ble frigjort.'}
          </>
        )}
      </p>
    </>
  );
}
