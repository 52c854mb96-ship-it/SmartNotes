import { useMemo, useState, type ReactNode } from 'react';
import {
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Select,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  capitalize,
  fmt,
  formulaText,
  molarMass,
  niceTicks,
  scaleLinear,
  useContainerTextScale,
} from '../kit';
import { ISOMER_SETS, RELATION_NAME, isomerRelation, pairLayout, type Isomer, type IsomerRelation, type IsomerSet, type PairLayout } from './model';
import { bounds, functionalGroups, type Mol, type View } from './struktur';
import { GROUP, MoleculeView, fitMolecule, fontPx, marginPx, minUnit } from './Struktur';

/** Fargene til stoff 1 og stoff 2 i sammenligningen. */
const C1 = VIZ.series[0]!;
const C2 = VIZ.series[1]!;
const fmtC = (v: number) => `${fmt(v, 1)} °C`;

const RELATION_HINT: Record<IsomerRelation, string> = {
  samme: '',
  kjede: ' (samme stoffgruppe, ulikt karbonskjelett)',
  posisjon: ' (samme funksjonelle gruppe på et annet sted i kjeden)',
  funksjon: ' (ulik funksjonell gruppe, altså ulik stoffgruppe)',
  'cis-trans': ' (samme bindinger, ulik plassering rundt dobbeltbindingen)',
};

export default function Isomeri() {
  const [setId, setSetId] = useState('C5H12');
  const set = ISOMER_SETS.find((s) => s.id === setId) ?? ISOMER_SETS[0]!;
  const [pick, setPick] = useState<[number, number]>(set.compare);
  const [view, setView] = useState<View>('struktur');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const ia = Math.min(pick[0], set.isomers.length - 1);
  const ib = Math.min(pick[1], set.isomers.length - 1);
  const A = set.isomers[ia]!;
  const B = set.isomers[ib]!;
  const rel = isomerRelation(A, B);
  const mols = useMemo(() => set.isomers.map((i) => i.build()), [set]);
  const cards = cardLayout(set, mols, view, f);
  const pairs = useMemo(() => [pairLayout(mols[ia]!, A.hbond), pairLayout(mols[ib]!, B.hbond)] as const, [mols, ia, ib, A.hbond, B.hbond]);
  const pairL = pairSceneLayout(pairs, f);
  const dotH = dotHeight(set, f);
  const M = molarMass(set.formula);

  const changeSet = (id: string) => {
    const s = ISOMER_SETS.find((x) => x.id === id) ?? ISOMER_SETS[0]!;
    setSetId(s.id);
    setPick(s.compare);
  };
  const options = set.isomers.map((i, k) => ({ value: String(k), label: i.alt ? `${i.name} (${i.alt})` : i.name }));

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Molekylformel"
          options={ISOMER_SETS.map((s) => ({ value: s.id, label: <Formel f={s.formula} /> }))}
          value={set.id}
          onChange={changeSet}
        />
      </Toolbar>
      <Toolbar>
        <Select label="Stoff 1" value={String(ia)} options={options} onChange={(v) => setPick([Number(v), ib])} />
        <Select label="Stoff 2" value={String(ib)} options={options} onChange={(v) => setPick([ia, Number(v)])} />
        <Segmented
          label="Visning"
          options={[
            { value: 'struktur', label: 'Strukturformel' },
            { value: 'skjelett', label: 'Skjelettformel' },
          ]}
          value={view}
          onChange={setView}
        />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${cards.H}`}
          label={`Isomerene med formelen ${formulaText(set.formula)}: ${set.isomers.map((i) => `${i.name} (kokepunkt ${fmtC(i.bp)})`).join(', ')}.`}
          caption={
            view === 'skjelett'
              ? 'Skjelettformel: hvert hjørne og hver ende er et C-atom. Alle isomerene har samme molekylformel, men atomene er bundet sammen på ulike måter.'
              : 'Strukturformel med alle atomer. Alle isomerene har samme molekylformel, men atomene er bundet sammen på ulike måter.'
          }
          maxHeight={cards.H}
        >
          <Cards set={set} mols={mols} view={view} layout={cards} a={ia} b={ib} f={f} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${pairL.H}`}
        label={`To molekyler av hvert stoff inntil hverandre: ${A.name} og ${B.name}.`}
        caption="Forenklet modell i planet: hver kule er et C-atom med H-atomene sine (CH₃, CH₂, CH). Stiplede streker viser nærkontakter mellom molekylene, der London-kreftene virker."
        maxHeight={pairL.H}
      >
        <PairScene pairs={pairs} isomers={[A, B]} layout={pairL} f={f} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.muted, label: 'Nærkontakt (London-krefter)', dashed: true },
          ...(A.hbond || B.hbond ? [{ color: KJEMI.hbond, label: 'Hydrogenbinding', dashed: true }] : []),
          ...(mols.some((m) => functionalGroups(m).length > 0) ? [{ color: GROUP, label: 'Funksjonell gruppe' }] : []),
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${dotH}`}
        label={`Kokepunktene til isomerene av ${formulaText(set.formula)}.`}
        caption="Kokepunkt ved 1 atm (CRC Handbook). Stiplet linje: romtemperatur 25 °C."
        maxHeight={dotH}
      >
        <BoilingDots set={set} a={ia} b={ib} f={f} height={dotH} />
      </Figure>

      <Readouts>
        <Readout label={`Kokepunkt ${A.name}`} value={fmt(A.bp, 1)} unit="°C" tone={C1} />
        <Readout label={`Kokepunkt ${B.name}`} value={fmt(B.bp, 1)} unit="°C" tone={C2} />
        <Readout label="Forskjell" value={fmt(Math.abs(A.bp - B.bp), 1)} unit="°C" />
      </Readouts>

      <Formula label="Samme molekylformel">
        <FormulaLine>
          {set.isomers.length === 2 ? 'Begge' : `Alle ${set.isomers.length}`} stoffene har formelen <Formel f={set.formula} /> og M = {fmt(M, 2)} g/mol: like
          mange atomer og like mange elektroner.
        </FormulaLine>
        <FormulaLine>
          Stoff 1 og 2 ({A.name} og {B.name}): {RELATION_NAME[rel]}
          {RELATION_HINT[rel]}
        </FormulaLine>
      </Formula>

      <Explain>{explanation(rel, A, B, pairs, M)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: alle isomerene ---------- */

interface CardLayout {
  cols: number;
  cardW: number;
  cardH: number;
  head: number;
  areaH: number;
  u: number;
  gap: number;
  H: number;
}

function cardLayout(set: IsomerSet, mols: Mol[], view: View, f: number): CardLayout {
  const n = set.isomers.length;
  const narrow = f > 1.3;
  const gap = 16;
  const m = marginPx(view, f);
  // På mobil: to kort i bredden når alle molekylene får plass med minste lesbare størrelse, ellers ett
  const widest = Math.max(
    ...mols.map((mol) => {
      const b = bounds(mol, view);
      return b.maxX - b.minX;
    }),
  );
  const twoFit = widest * minUnit(view, f) + 2 * m + 16 <= (800 - gap) / 2;
  const cols = narrow ? (n > 1 && twoFit ? 2 : 1) : Math.min(3, n);
  const cardW = (800 - gap * (cols - 1)) / cols;
  const head = 52 * f;
  const foot = 30 * f;
  const k = Math.max(1, 0.85 * f);
  const uMax = (view === 'skjelett' ? 62 : 54) * k * (narrow && cols === 1 ? 1.3 : 1);
  const maxMolH = (view === 'skjelett' ? 170 : 210) * k * (narrow ? 1.2 : 1);
  let u = uMax;
  for (const mol of mols) {
    const b = bounds(mol, view);
    const bw = Math.max(1e-6, b.maxX - b.minX);
    const bh = Math.max(1e-6, b.maxY - b.minY);
    u = Math.min(u, (cardW - 16 - 2 * m) / bw, (maxMolH - 2 * m) / bh);
  }
  u = Math.max(minUnit(view, f), u);
  const areaH = Math.max(
    ...mols.map((mol) => {
      const b = bounds(mol, view);
      return (b.maxY - b.minY) * u + 2 * m;
    }),
    1.2 * u + 2 * m,
  );
  const cardH = head + areaH + foot;
  const rows = Math.ceil(n / cols);
  return { cols, cardW, cardH, head, areaH, u, gap, H: Math.round(rows * cardH + (rows - 1) * gap + 4) };
}

function Cards({ set, mols, view, layout, a, b, f }: { set: IsomerSet; mols: Mol[]; view: View; layout: CardLayout; a: number; b: number; f: number }) {
  const { cols, cardW, cardH, head, areaH, u, gap } = layout;
  return (
    <g>
      {set.isomers.map((iso, k) => {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const x = col * (cardW + gap);
        const y = 2 + row * (cardH + gap);
        const mol = mols[k]!;
        const fit = fitMolecule(mol, view, { x, y: y + head, w: cardW, h: areaH }, f, u);
        const role = k === a ? 1 : k === b ? 2 : 0;
        const color = role === 1 ? C1 : role === 2 ? C2 : VIZ.muted;
        const title = iso.name;
        // Lange navn får litt mindre skrift, så de holder seg inne i kortet
        const size = Math.min(1, (cardW - 70 * f) / Math.max(1, title.length * 0.56 * fontPx(f, 1)));
        return (
          <g key={iso.id}>
            <rect
              x={x + 1}
              y={y}
              width={cardW - 2}
              height={cardH - 2}
              rx={12}
              fill={VIZ.surface}
              stroke={color}
              strokeWidth={role ? 3 : 1.2}
              strokeOpacity={role ? 1 : 0.5}
            />
            <Txt x={x + 14} y={y + 26 * f} anchor="start" weight={700} size={size}>
              {title}
            </Txt>
            {iso.alt && (
              <Txt x={x + 14} y={y + 46 * f} anchor="start" muted size={0.78}>
                {iso.alt}
              </Txt>
            )}
            {role > 0 && (
              <g>
                <circle cx={x + cardW - 22 * f} cy={y + 22 * f} r={12 * f} fill={color} />
                <Txt x={x + cardW - 22 * f} y={y + 28 * f} size={0.82} weight={700} color={VIZ.surface} halo={false}>
                  {role}
                </Txt>
              </g>
            )}
            <MoleculeView mol={mol} view={view} fit={fit} groups={functionalGroups(mol)} dim={role === 0} />
            <Txt x={x + 14} y={y + cardH - 14 * f} anchor="start" size={0.85} weight={650} color={role ? color : undefined} muted={!role}>
              Kp. {fmtC(iso.bp)}
            </Txt>
            <Txt x={x + cardW - 14} y={y + cardH - 14 * f} anchor="end" size={0.78} muted>
              {iso.group}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Figur 2: to molekyler inntil hverandre ---------- */

interface PairSceneLayout {
  stacked: boolean;
  panelW: number;
  panelH: number;
  title: number;
  u: number;
  H: number;
}

/** Plassen under molekylene til teksten «3 nærkontakter». */
const noteH = (f: number) => 34 * f;

function pairSceneLayout(pairs: readonly [PairLayout, PairLayout], f: number): PairSceneLayout {
  const stacked = f > 1.3;
  const panelW = stacked ? 800 : 390;
  const title = 34 * f;
  const k = Math.max(1, 0.85 * f);
  // Kulene har radius u/2 rundt atomsentrene, så molekylene trenger (bredde + 1) · u, pluss litt luft
  const gap = 12 * k;
  const maxH = (stacked ? 300 : 280) * k;
  let u = (stacked ? 80 : 60) * k;
  for (const p of pairs) {
    const bw = Math.max(1e-6, p.bounds.maxX - p.bounds.minX);
    const bh = Math.max(1e-6, p.bounds.maxY - p.bounds.minY);
    u = Math.min(u, (panelW - 2 * gap) / (bw + 1), (maxH - 2 * gap) / (bh + 1));
  }
  u = Math.max(24 * k, u);
  const tallest = Math.max(...pairs.map((p) => p.bounds.maxY - p.bounds.minY));
  const panelH = title + (tallest + 1) * u + 2 * gap + noteH(f);
  return { stacked, panelW, panelH, title, u, H: Math.round(stacked ? 2 * panelH + 10 : panelH) };
}

function PairScene({ pairs, isomers, layout, f }: { pairs: readonly [PairLayout, PairLayout]; isomers: [Isomer, Isomer]; layout: PairSceneLayout; f: number }) {
  return (
    <g>
      {pairs.map((p, k) => {
        const x = layout.stacked ? 0 : k * (layout.panelW + 20);
        const y = layout.stacked ? k * (layout.panelH + 10) : 0;
        return <PairPanel key={k} pair={p} iso={isomers[k]!} role={(k + 1) as 1 | 2} x={x} y={y} layout={layout} f={f} />;
      })}
    </g>
  );
}

function PairPanel({
  pair,
  iso,
  role,
  x,
  y,
  layout,
  f,
}: {
  pair: PairLayout;
  iso: Isomer;
  role: 1 | 2;
  x: number;
  y: number;
  layout: PairSceneLayout;
  f: number;
}) {
  const k = Math.max(1, 0.85 * f);
  const { u, panelW, panelH, title } = layout;
  const color = role === 1 ? C1 : C2;
  const b = pair.bounds;
  const cx = x + panelW / 2;
  const top = y + title + (panelH - title - noteH(f)) / 2;
  const P = (i: number) => {
    const a = pair.atoms[i]!;
    return { x: cx + (a.x - (b.minX + b.maxX) / 2) * u, y: top - (a.y - (b.minY + b.maxY) / 2) * u };
  };
  // Kalottmodell: kulene i samme molekyl berører hverandre (radius = halv bindingslengde)
  const R = (i: number) => (pair.atoms[i]!.el === 'H' ? 0.3 : 0.5) * u;
  const seg = (i: number, j: number, gapPx = 0) => {
    const p = P(i);
    const q = P(j);
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const ux = (q.x - p.x) / len;
    const uy = (q.y - p.y) / len;
    const a = R(i) + gapPx;
    const c = R(j) + gapPx;
    return { x1: p.x + ux * a, y1: p.y + uy * a, x2: q.x - ux * c, y2: q.y - uy * c };
  };
  const hb = pair.hbond;
  const note = hb
    ? `Hydrogenbinding${pair.contacts.length ? ` og ${pair.contacts.length} nærkontakt${pair.contacts.length === 1 ? '' : 'er'}` : ''}`
    : `${pair.contacts.length} nærkontakt${pair.contacts.length === 1 ? '' : 'er'}${iso.polar ? ', svakt polart' : ''}`;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={panelW - 2} height={panelH - 2} rx={12} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />
      <circle cx={x + 22 * f} cy={y + 20 * f} r={11 * f} fill={color} />
      <Txt x={x + 22 * f} y={y + 26 * f} size={0.78} weight={700} color={VIZ.surface} halo={false}>
        {role}
      </Txt>
      <Txt x={x + 40 * f} y={y + 26 * f} anchor="start" weight={700} size={0.95}>
        {iso.name}
      </Txt>
      {pair.contacts.map(([i, j], n) => {
        const s = seg(i, j, 2 * k);
        return <line key={`c${n}`} {...s} stroke={VIZ.ink} strokeOpacity={0.55} strokeWidth={2.4 * k} strokeDasharray={`${3 * k} ${3 * k}`} />;
      })}
      {hb && <line {...seg(hb[0], hb[1], 2 * k)} stroke={KJEMI.hbond} strokeWidth={3.2 * k} strokeDasharray={`${4 * k} ${3 * k}`} />}
      {pair.atoms.map((a, i) => {
        const p = P(i);
        const c = atomColors(a.el);
        return (
          <g key={`a${i}`}>
            <circle cx={p.x} cy={p.y} r={R(i)} fill={c.fill} stroke={c.line} strokeWidth={1.4 * k} />
            {a.el !== 'C' && (
              <text x={p.x} y={p.y + R(i) * 0.36} className="kj-atom-symbol" style={{ fill: c.ink, fontSize: R(i) * 1.05 }}>
                {a.el}
              </text>
            )}
          </g>
        );
      })}
      <Txt x={cx} y={y + panelH - 14 * f} size={0.82} weight={600} color={hb ? KJEMI.hbond : undefined} muted={!hb}>
        {note}
      </Txt>
    </g>
  );
}

/* ---------- Figur 3: kokepunktene ---------- */

const dotHeight = (set: IsomerSet, f: number) => Math.round(50 * f + set.isomers.length * 34 * f + 46 * f);

function BoilingDots({ set, a, b, f, height }: { set: IsomerSet; a: number; b: number; f: number; height: number }) {
  const bps = set.isomers.map((i) => i.bp);
  const lo = Math.min(...bps, 25);
  const hi = Math.max(...bps, 25);
  const pad = Math.max(6, (hi - lo) * 0.08);
  // Plass til tallet til høyre for det høyeste punktet
  const room = Math.max(12, (hi - lo) * (f > 1.3 ? 0.75 : 0.32));
  const ticks = niceTicks(lo - pad, hi + room, f > 1.3 ? 4 : 6).filter((t) => t >= lo - pad && t <= hi + room);
  const t0 = lo - pad;
  const t1 = hi + room;
  const labelW = f > 1.3 ? 330 : 230;
  const x0 = labelW;
  const x1 = 770;
  const sx = scaleLinear([t0, t1], [x0, x1]);
  const rowH = 34 * f;
  const top = 16 * f;
  const axisY = top + set.isomers.length * rowH + 6;
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={top - 6} y2={axisY} className="viz-gridline" />
          <text x={sx(t)} y={axisY + 22 * f} textAnchor="middle" className="viz-tick">
            {fmt(t, 0)}
          </text>
        </g>
      ))}
      <line x1={x0} x2={x1} y1={axisY} y2={axisY} className="viz-axis" />
      <line x1={sx(25)} x2={sx(25)} y1={top - 6} y2={axisY} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={(x0 + x1) / 2} y={height - 8} textAnchor="middle" className="viz-axis-label">
        Kokepunkt (°C)
      </text>
      {set.isomers.map((iso, k) => {
        const y = top + k * rowH + rowH / 2;
        const role = k === a ? 1 : k === b ? 2 : 0;
        const color = role === 1 ? C1 : role === 2 ? C2 : VIZ.muted;
        return (
          <g key={iso.id}>
            <Txt x={x0 - 14} y={y + 6 * f} anchor="end" size={0.85} weight={role ? 700 : 500} muted={!role}>
              {iso.name}
            </Txt>
            <line x1={x0} x2={sx(iso.bp)} y1={y} y2={y} stroke={color} strokeWidth={role ? 3 : 1.5} opacity={role ? 0.8 : 0.5} />
            <circle cx={sx(iso.bp)} cy={y} r={(role ? 8 : 5) * Math.max(1, 0.85 * f)} fill={color} stroke={VIZ.surface} strokeWidth={2} />
            <Txt x={sx(iso.bp) + 14 * f} y={y + 6 * f} anchor="start" size={0.8} weight={600} color={role ? color : undefined} muted={!role}>
              {fmtC(iso.bp)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(rel: IsomerRelation, A: Isomer, B: Isomer, pairs: readonly [PairLayout, PairLayout], M: number): ReactNode {
  const hi = A.bp >= B.bp ? A : B;
  const lo = hi === A ? B : A;
  const d = fmt(hi.bp - lo.bp, 1);
  const both = <>Begge har M = {fmt(M, 2)} g/mol og like mange elektroner</>;
  switch (rel) {
    case 'samme':
      return (
        <p>
          Du har valgt samme stoff to ganger. Velg et annet stoff 2 for å sammenligne to isomerer: samme molekylformel, men atomene er bundet sammen på ulike
          måter.
        </p>
      );
    case 'kjede': {
      const ring = A.group === 'sykloalkan' && B.group === 'sykloalkan';
      const branched = A.branches === B.branches ? null : A.branches > B.branches ? A : B;
      const straight = branched === A ? B : A;
      const cb = branched ? pairs[branched === A ? 0 : 1].contacts.length : 0;
      const cs = branched ? pairs[branched === A ? 1 : 0].contacts.length : 0;
      const contactNote =
        cb < cs ? ` (${cb} mot ${cs} nærkontakter i figuren)` : ' (den flate modellen i figuren viser ikke hele forskjellen, for formen er tredimensjonal)';
      return (
        <>
          <p>
            <strong>Samme formel, ulik form.</strong> {capitalize(A.name)} og {B.name} er kjedeisomerer: karbonskjelettet er bygd opp på ulik måte. {both}, så
            forskjellen i kokepunkt ({d} °C) skyldes formen på molekylene.
          </p>
          <p>
            {branched && ring ? (
              <>
                I {straight.name} er alle fire C-atomene med i ringen, mens {branched.name} har en mindre ring med en metylgruppe som stikker ut. Den
                forgrenede formen gir mindre kontaktflate mellom nabomolekylene, svakere London-krefter og lavere kokepunkt.
              </>
            ) : branched ? (
              <>
                {capitalize(branched.name)} er mer forgrenet og derfor mer kompakt og kuleformet enn {straight.name}. Da blir kontaktflaten mellom
                nabomolekylene mindre{contactNote}, London-kreftene blir svakere, og stoffet koker {Math.abs(A.bp - B.bp) < 2 ? 'litt ' : ''}lavere.
              </>
            ) : (
              <>
                Begge er like mye forgrenet, så formene og kokepunktene ligger nær hverandre.{' '}
                {lo.name.startsWith('2,2-')
                  ? `I ${lo.name} sitter begge metylgruppene på samme C-atom, så molekylet blir mest kuleformet og koker lavest.`
                  : 'Så små forskjeller kommer av detaljer i formen. Hovedregelen er at flere forgreninger gir lavere kokepunkt.'}
              </>
            )}{' '}
            Misforståelse å unngå: et forgrenet molekyl er ikke «større» eller tyngre. Det har nøyaktig de samme atomene.
          </p>
        </>
      );
    }
    case 'posisjon':
      return A.group === 'alkohol' ? (
        <p>
          <strong>Samme funksjonelle gruppe, et annet sted.</strong> {capitalize(A.name)} og {B.name} er posisjonsisomerer: begge er alkoholer og danner
          hydrogenbindinger mellom molekylene, så begge koker høyt. I propan-2-ol sitter OH-gruppa midt i molekylet, mer skjermet av CH<sub>3</sub>-gruppene, og
          molekylet er mer kompakt. Det gir litt svakere krefter mellom molekylene og {d} °C lavere kokepunkt. Tallet i navnet viser hvor gruppa sitter.
        </p>
      ) : (
        <p>
          <strong>Dobbeltbindingen sitter et annet sted.</strong> {capitalize(A.name)} og {B.name} er posisjonsisomerer. Alkener er nesten upolare, så det er
          særlig London-kreftene som avgjør, og kokepunktene er nokså like ({d} °C forskjell).
          {lo.polar && !hi.polar
            ? ` Legg merke til at ${hi.name}, som er upolart, koker høyere enn det svakt polare ${lo.name}: dipolene i alkenene er så svake at formen på molekylene betyr mer.`
            : ''}{' '}
          Tallet i navnet viser hvor dobbeltbindingen starter.
        </p>
      );
    case 'funksjon':
      if (A.hbond !== B.hbond) {
        const alc = A.hbond ? A : B;
        const eth = alc === A ? B : A;
        return (
          <>
            <p>
              <strong>Ulik funksjonell gruppe gir ulike stoffer.</strong> {capitalize(alc.name)} er en alkohol med en OH-gruppe. H-atomet er bundet til det
              elektronegative O-atomet, så det dannes hydrogenbindinger mellom molekylene. I {eth.name} sitter O-atomet mellom to C-atomer og har ingen H, så
              eteren kan ikke danne hydrogenbindinger med seg selv, bare svakere dipol-dipol-krefter og London-krefter.
            </p>
            <p>
              Derfor koker {alc.name} {d} °C høyere enn {eth.name}, selv om formelen er den samme. Molekylformelen alene forteller altså ikke hvilket stoff du
              har: du trenger strukturformelen.
            </p>
          </>
        );
      }
      return (
        <>
          <p>
            <strong>Ring eller dobbeltbinding.</strong> {capitalize(A.name)} og {B.name} hører til ulike stoffgrupper ({A.group} og {B.group}). En ring bruker
            opp to H-plasser på samme måte som en dobbeltbinding, så sykloalkaner har samme generelle formel som alkenene, C<sub>n</sub>H<sub>2n</sub>.
          </p>
          <p>
            Kokepunktene er nokså like ({d} °C forskjell), fordi begge er nesten upolare og holdes sammen av London-krefter. Kjemisk er de svært ulike: alkenet reagerer med brom ved addisjon til C=C og
            avfarger bromvann, mens sykloalkanet ikke gjør det.
          </p>
        </>
      );
    case 'cis-trans': {
      const cis = A.name.startsWith('cis') ? A : B;
      const trans = cis === A ? B : A;
      return (
        <p>
          <strong>Dobbeltbindingen kan ikke rotere.</strong> I {cis.name} er CH<sub>3</sub>-gruppene låst på samme side av C=C, i {trans.name} på hver sin side.
          Bindingene er de samme, men formen er ulik. I cis-formen peker de små bindingsdipolene samme vei, så molekylet er svakt polart og får
          dipol-dipol-krefter i tillegg til London-kreftene. Derfor koker {cis.name} ved {fmtC(cis.bp)} og {trans.name} ved {fmtC(trans.bp)}.
        </p>
      );
    }
  }
}
