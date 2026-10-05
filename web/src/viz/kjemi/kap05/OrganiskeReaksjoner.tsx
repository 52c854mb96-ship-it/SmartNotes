import { useMemo, useState, type ReactNode } from 'react';
import {
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Reaksjon,
  Readout,
  Readouts,
  Segmented,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  mixColor,
  formulaText,
  useContainerTextScale,
} from '../kit';
import {
  REACTION_TYPES,
  REACTION_TYPE_NAME,
  bondSummary,
  equationText,
  highlightedBonds,
  reactionsOfType,
  sideTally,
  smallMolecule,
  trackedAtoms,
  type OrgReaction,
  type ReactionType,
  type Species,
} from './model';
import { bounds, functionalGroups, type Mol, type View } from './struktur';
import { BREAK, FORM, GROUP, MoleculeView, fontPx, marginPx, minUnit } from './Struktur';

type Stage = 'alt' | 'grupper' | 'brytes' | 'dannes';
const STAGES: { value: Stage; label: string }[] = [
  { value: 'alt', label: 'Alt' },
  { value: 'grupper', label: 'Funksjonelle grupper' },
  { value: 'brytes', label: 'Brytes' },
  { value: 'dannes', label: 'Dannes' },
];
/** Fargen på atomene vi følger fra utgangsstoffene til produktene. */
const TRACK = VIZ.series[2]!;

export default function OrganiskeReaksjoner() {
  const [type, setType] = useState<ReactionType>('addisjon');
  const [rid, setRid] = useState('add-br2');
  const [stage, setStage] = useState<Stage>('alt');
  const [view, setView] = useState<View>('struktur');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const list = reactionsOfType(type);
  const r = list.find((x) => x.id === rid) ?? list[0]!;
  const built = useMemo(() => ({ re: r.reactants.map((s) => s.build()), pr: r.products.map((s) => s.build()) }), [r]);
  const layout = sceneLayout(r, built.re, built.pr, view, f);
  const small = smallMolecule(r);
  const broken = bondSummary(r.reactants);
  const formed = bondSummary(r.products);
  const tally = sideTally(r.reactants);

  const changeType = (t: ReactionType) => {
    setType(t);
    setRid(reactionsOfType(t)[0]!.id);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Reaksjonstype" options={REACTION_TYPES.map((t) => ({ value: t, label: REACTION_TYPE_NAME[t] }))} value={type} onChange={changeType} />
      </Toolbar>
      <Toolbar>
        {list.length > 1 && <Segmented label="Reaksjon" options={list.map((x) => ({ value: x.id, label: x.label }))} value={r.id} onChange={setRid} />}
        <Segmented label="Marker" options={STAGES} value={stage} onChange={setStage} />
        <Segmented
          label="Visning"
          options={[
            { value: 'struktur', label: 'Strukturformel' },
            { value: 'kule', label: 'Kule-pinne' },
          ]}
          value={view}
          onChange={setView}
        />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${layout.H}`}
          label={`${REACTION_TYPE_NAME[r.type]}: ${r.reactants.map((s) => s.name).join(' og ')} gir ${r.products.map((s) => s.name).join(' og ')}.`}
          caption={
            r.type === 'forbrenning'
              ? 'Ved forbrenning brytes alle bindingene i utgangsstoffene, og atomene setter seg sammen på nytt i CO₂ og H₂O.'
              : 'Stiplet binding brytes, uthevet binding dannes. Atomene med grønn ring kan du følge fra venstre side til høyre side av likningen.'
          }
          maxHeight={layout.H}
        >
          <Scene r={r} layout={layout} stage={stage} view={view} f={f} />
        </Figure>
      </div>
      <Legend items={legendItems(r, stage)} />

      <Readouts>
        <Readout label="Stoffer før → etter" value={`${r.reactants.length} → ${r.products.length}`} tone={VIZ.series[0]} />
        <Readout label="Spaltes av" value={small ? formulaText(small) : 'ingen'} />
        <Readout label="Bindinger brytes" value={String(count(broken))} tone={BREAK} />
        <Readout label="Bindinger dannes" value={String(count(formed))} tone={FORM} />
      </Readouts>

      <Formula label="Likning og bindinger">
        <FormulaLine>
          <Reaksjon r={equationText(r)} /> &nbsp;({r.conditions})
        </FormulaLine>
        <FormulaLine>Brytes: {bondText(broken, r.type === 'addisjon')}</FormulaLine>
        <FormulaLine>Dannes: {bondText(formed, false)}</FormulaLine>
        <FormulaLine>
          Atomer på hver side:{' '}
          {Object.entries(tally)
            .map(([el, n]) => `${n} ${el}`)
            .join(', ')}{' '}
          (ingen atomer forsvinner)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(r, stage)}</Explain>
    </VizLayout>
  );
}

const count = (list: { count: number }[]) => list.reduce((s, b) => s + b.count, 0);

/** Deler en tekst i linjer på høyst `max` tegn (ved mellomrom). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function bondText(list: { label: string; count: number; order: number }[], opens: boolean): string {
  return list
    .map((b) => {
      const n = b.count === 1 ? '' : `${b.count} `;
      const extra = opens && b.label === 'C=C' ? ' (blir C–C)' : '';
      return `${n}${b.label}${extra}`;
    })
    .join(', ');
}

function legendItems(r: OrgReaction, stage: Stage) {
  const items: { color: string; label: ReactNode; dashed?: boolean }[] = [];
  if (stage === 'grupper') items.push({ color: GROUP, label: 'Funksjonell gruppe' });
  if (stage === 'alt' || stage === 'brytes') items.push({ color: BREAK, label: 'Binding som brytes', dashed: true });
  if (stage === 'alt' || stage === 'dannes') items.push({ color: FORM, label: 'Binding som dannes' });
  if (stage !== 'grupper' && r.trackedLabel) items.push({ color: TRACK, label: r.trackedLabel });
  return items;
}

/* ---------- Figuren ---------- */

interface Placed {
  s: Species;
  mol: Mol;
  /** Venstre kant, bredde og høyde for molekylet (med marg). */
  x: number;
  w: number;
  h: number;
  /** Koeffisient foran molekylet. */
  coefX: number | null;
}

interface Row {
  y: number;
  h: number;
  items: Placed[];
  plus: number[];
}

interface SceneLayout {
  u: number;
  rows: [Row, Row];
  arrowY: [number, number];
  label: number;
  H: number;
}

const NAME_H = (f: number) => 26 * f;

function sceneLayout(r: OrgReaction, re: Mol[], pr: Mol[], view: View, f: number): SceneLayout {
  const m = marginPx(view, f);
  const k = Math.max(1, 0.85 * f);
  const plusW = 34 * f;
  const coefW = (s: Species) => (s.coef === 1 ? 0 : fontPx(f, 1.3) * 0.7 * String(s.coef).length + 6);
  const dims = (mols: Mol[]) =>
    mols.map((mol) => {
      const b = bounds(mol, view);
      return { bw: Math.max(0.6, b.maxX - b.minX), bh: Math.max(0.6, b.maxY - b.minY) };
    });
  const dRe = dims(re);
  const dPr = dims(pr);
  const fixed = (list: Species[]) => list.reduce((s, x) => s + coefW(x) + 2 * m, 0) + plusW * (list.length - 1);
  const uFor = (list: Species[], d: { bw: number }[]) => (760 - fixed(list)) / d.reduce((s, x) => s + x.bw, 0);
  const uMax = (view === 'kule' ? 88 : 84) * k;
  const u = Math.max(minUnit(view, f), Math.min(uMax, uFor(r.reactants, dRe), uFor(r.products, dPr)));
  const label = 24 * f;
  const row = (list: Species[], mols: Mol[], d: { bw: number; bh: number }[], y: number): Row => {
    const widths = list.map((s, i) => coefW(s) + d[i]!.bw * u + 2 * m);
    const total = widths.reduce((a, b) => a + b, 0) + plusW * (list.length - 1);
    let x = Math.max(10, 400 - total / 2);
    const items: Placed[] = [];
    const plus: number[] = [];
    list.forEach((s, i) => {
      const cw = coefW(s);
      items.push({ s, mol: mols[i]!, x: x + cw, w: d[i]!.bw * u + 2 * m, h: d[i]!.bh * u + 2 * m, coefX: cw ? x + cw - 4 : null });
      x += widths[i]!;
      if (i < list.length - 1) {
        plus.push(x + plusW / 2);
        x += plusW;
      }
    });
    const h = Math.max(...d.map((x) => x.bh * u + 2 * m)) + NAME_H(f);
    return { y, h, items, plus };
  };
  const r1 = row(r.reactants, re, dRe, label + 6);
  const gapY = 74 * f;
  const r2 = row(r.products, pr, dPr, r1.y + r1.h + gapY + label);
  return { u, rows: [r1, r2], arrowY: [r1.y + r1.h + 8, r2.y - label - 4], label, H: Math.round(r2.y + r2.h + 6) };
}

function Scene({ r, layout, stage, view, f }: { r: OrgReaction; layout: SceneLayout; stage: Stage; view: View; f: number }) {
  const [rowRe, rowPr] = layout.rows;
  const fs = fontPx(f, 1);
  const showBreak = stage === 'alt' || stage === 'brytes';
  const showForm = stage === 'alt' || stage === 'dannes';
  const drawRow = (row: Row, side: 're' | 'pr') => {
    const on = side === 're' ? showBreak : showForm;
    const dim = (side === 're' && stage === 'dannes') || (side === 'pr' && stage === 'brytes');
    const molH = row.h - NAME_H(f);
    return (
      <g>
        {row.items.map((it, i) => {
          const b = bounds(it.mol, view);
          const cx = it.x + it.w / 2;
          const cy = row.y + molH / 2;
          const fit = { u: layout.u, ox: cx - ((b.minX + b.maxX) / 2) * layout.u, oy: cy + ((b.minY + b.maxY) / 2) * layout.u };
          const marks = on ? { bonds: highlightedBonds(it.s, it.mol), kind: side === 're' ? ('brytes' as const) : ('dannes' as const) } : undefined;
          const tracked = on && it.s.tracked ? { atoms: trackedAtoms(it.s, it.mol), color: TRACK } : undefined;
          return (
            <g key={i}>
              <MoleculeView
                mol={it.mol}
                view={view}
                fit={fit}
                marks={marks}
                rings={tracked}
                groups={stage === 'grupper' ? functionalGroups(it.mol) : undefined}
                dim={dim}
              />
              {it.coefX !== null && (
                <Txt x={it.coefX} y={cy + fs * 0.45} anchor="end" size={1.3} weight={700}>
                  {it.s.coef}
                </Txt>
              )}
              <Txt x={cx} y={row.y + row.h - 6 * f} size={0.82} muted>
                {it.s.name}
              </Txt>
            </g>
          );
        })}
        {row.plus.map((x, i) => (
          <Txt key={`p${i}`} x={x} y={row.y + molH / 2 + fs * 0.45} size={1.4} weight={600}>
            +
          </Txt>
        ))}
      </g>
    );
  };
  const [a0, a1] = layout.arrowY;
  const narrow = f > 1.3;
  const ax = 400;
  const head = 12 * Math.max(1, 0.85 * f);
  return (
    <g>
      <Txt x={10} y={layout.label - 4} anchor="start" size={0.8} muted weight={600}>
        Utgangsstoffer
      </Txt>
      {drawRow(rowRe, 're')}
      {r.equilibrium ? (
        <g>
          <line x1={ax - 7} y1={a0} x2={ax - 7} y2={a1 - head} stroke={VIZ.ink} strokeWidth={2.5} />
          <polygon points={`${ax - 7},${a1} ${ax - 14},${a1 - head} ${ax - 7},${a1 - head}`} fill={VIZ.ink} />
          <line x1={ax + 7} y1={a1} x2={ax + 7} y2={a0 + head} stroke={VIZ.ink} strokeWidth={2.5} />
          <polygon points={`${ax + 7},${a0} ${ax + 14},${a0 + head} ${ax + 7},${a0 + head}`} fill={VIZ.ink} />
        </g>
      ) : (
        <g>
          <line x1={ax} y1={a0} x2={ax} y2={a1 - head} stroke={VIZ.ink} strokeWidth={2.5} />
          <polygon points={`${ax},${a1} ${ax - head * 0.55},${a1 - head} ${ax + head * 0.55},${a1 - head}`} fill={VIZ.ink} />
        </g>
      )}
      {wrap(r.conditions, f > 1.3 ? 20 : 34).map((line, i, all) => (
        <Txt key={i} x={ax + 26} y={(a0 + a1) / 2 + 6 * f + (i - (all.length - 1) / 2) * 22 * f} anchor="start" size={0.85} weight={600}>
          {line}
        </Txt>
      ))}
      {!(narrow && r.bromineTest) && (
        <Txt x={ax - 26} y={(a0 + a1) / 2 + 6 * f} anchor="end" size={0.85} weight={700} color={VIZ.series[0]}>
          {REACTION_TYPE_NAME[r.type].toLowerCase()}
        </Txt>
      )}
      {r.bromineTest && <BromineTest x={narrow ? 110 : 720} y={a0 - 4} h={a1 - a0 + 8} kind={r.bromineTest} f={f} captionLeft={narrow} />}
      <Txt x={10} y={rowPr.y - 8} anchor="start" size={0.8} muted weight={600}>
        Produkter
      </Txt>
      {drawRow(rowPr, 'pr')}
    </g>
  );
}

/** To små reagensrør: bromvann før (brunt) og etter (avfarget). */
function BromineTest({ x, y, h, kind, f, captionLeft }: { x: number; y: number; h: number; kind: 'rask' | 'lys'; f: number; captionLeft: boolean }) {
  const k = Math.max(1, 0.85 * f);
  const tw = 18 * k;
  const th = Math.max(30, h - 26 * f);
  const brown = mixColor(KJEMI.liquid, atomColors('Br').line, 0.75);
  const tube = (cx: number, fill: string) => (
    <g>
      <path
        d={`M${cx - tw / 2},${y} L${cx - tw / 2},${y + th - tw / 2} A${tw / 2},${tw / 2} 0 0 0 ${cx + tw / 2},${y + th - tw / 2} L${cx + tw / 2},${y}`}
        fill={KJEMI.glassFill}
        stroke={KJEMI.glass}
        strokeWidth={1.6}
      />
      <path
        d={`M${cx - tw / 2 + 2},${y + th * 0.3} L${cx - tw / 2 + 2},${y + th - tw / 2} A${tw / 2 - 2},${tw / 2 - 2} 0 0 0 ${cx + tw / 2 - 2},${y + th - tw / 2} L${cx + tw / 2 - 2},${y + th * 0.3} Z`}
        fill={fill}
      />
    </g>
  );
  const ay = y + th * 0.6;
  return (
    <g>
      {tube(x - tw * 1.4, brown)}
      {tube(x + tw * 1.4, KJEMI.liquid)}
      <line x1={x - tw * 0.6} x2={x + tw * 0.35} y1={ay} y2={ay} stroke={VIZ.ink} strokeWidth={2} />
      <polygon points={`${x + tw * 0.6},${ay} ${x + tw * 0.3},${ay - 5} ${x + tw * 0.3},${ay + 5}`} fill={VIZ.ink} />
      <Txt x={captionLeft ? 10 : x} y={y + th + 20 * f} anchor={captionLeft ? 'start' : 'middle'} size={0.72} muted>
        {kind === 'rask' ? 'bromvann avfarges' : 'avfarges i lys'}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(r: OrgReaction, stage: Stage): ReactNode {
  const stageText: Record<Stage, ReactNode> = {
    alt: null,
    grupper: (
      <p>
        De funksjonelle gruppene er markert. Det er dem som avgjør hvilken reaksjon stoffet kan gå gjennom: C=C gir addisjon, –OH kan gi eliminasjon eller
        forestring, og et alkan uten funksjonell gruppe kan bare gi substitusjon (og forbrenning).
      </p>
    ),
    brytes: <p>Det koster energi å bryte bindinger. Se hvilke bindinger som er stiplet: {bondText(bondSummary(r.reactants), r.type === 'addisjon')}.</p>,
    dannes: (
      <p>Det frigjøres energi når nye bindinger dannes: {bondText(bondSummary(r.products), false)}. Atomene med grønn ring kommer fra utgangsstoffene.</p>
    ),
  };
  let main: ReactNode;
  switch (r.type) {
    case 'addisjon': {
      const extra =
        r.id === 'add-br2' ? (
          <> Kjennetegn i labben: brunt bromvann avfarges raskt når det ristes med et alken. Det er testen for umettede forbindelser (C=C eller C≡C).</>
        ) : r.id === 'add-h2o' ? (
          <> Vannet legges til som H og OH, og produktet blir en alkohol. Slik lages mye av etanolen i industrien.</>
        ) : (
          <> Dette kalles hydrogenering: alkenet blir til et alkan. Reaksjonen trenger en katalysator, for eksempel nikkel.</>
        );
      main = (
        <p>
          <strong>Addisjon: to stoffer blir til ett.</strong> Den ene bindingen i dobbeltbindingen åpnes (C=C blir C–C), og de to atomene fra{' '}
          {r.reactants[1]!.name} legges til hvert sitt C-atom. Produktet er mettet, og ingen atomer spaltes av.{extra}
        </p>
      );
      break;
    }
    case 'substitusjon': {
      const x = r.reactants[1]!;
      main = (
        <p>
          <strong>Substitusjon: et atom byttes ut med et annet.</strong> Et H-atom i {r.reactants[0]!.name} byttes ut med et {x.formula === 'Br2' ? 'Br' : 'Cl'}
          -atom, og H-atomet blir sammen med det andre halogenatomet til <Formel f={r.products[1]!.formula} />. To stoffer blir til to nye stoffer. Alkaner er
          mettede og lite reaktive, så det trengs UV-lys for å bryte {x.formula === 'Br2' ? 'Br–Br' : 'Cl–Cl'}-bindingen og starte reaksjonen.
          {r.id === 'sub-cl2' || r.id === 'sub-cl2-2'
            ? ' Med mer klor fortsetter substitusjonen: klormetan, diklormetan, triklormetan og tetraklormetan.'
            : ' Bromvann avfarges bare langsomt og i lys. Det skiller et alkan fra et alken, som avfarger bromvann med en gang.'}
        </p>
      );
      break;
    }
    case 'eliminasjon':
      main = (
        <p>
          <strong>Eliminasjon: ett stoff blir til to.</strong> Et lite molekyl spaltes av fra to nabo-C-atomer: OH-gruppa fra det ene og et H-atom fra det andre
          blir til vann. Da dannes en dobbeltbinding mellom C-atomene, så produktet er umettet. Eliminasjon er det motsatte av addisjon av vann, og konsentrert
          svovelsyre trekker til seg vannet.
        </p>
      );
      break;
    case 'kondensasjon':
      main = (
        <p>
          <strong>Kondensasjon: to molekyler slås sammen, og et lite molekyl spaltes av.</strong> OH fra karboksylgruppa i syra og H fra OH-gruppa i alkoholen
          blir til vann, og resten bindes sammen med en esterbinding, –COO–. Navnet på esteren lages av alkoholen (etyl) og syra (etanoat). Reaksjonen er en
          likevekt (⇌): vann kan spalte esteren igjen (hydrolyse). Mange estere lukter fruktig.
        </p>
      );
      break;
    case 'forbrenning':
      main = (
        <p>
          <strong>Fullstendig forbrenning: alle bindinger brytes.</strong> Med nok oksygen blir alt karbonet til <Formel f="CO2" /> og alt hydrogenet til{' '}
          <Formel f="H2O" />. Bindingene som dannes (C=O og O–H), er til sammen sterkere enn dem som brytes, så reaksjonen er eksoterm. Med for lite oksygen
          blir forbrenningen ufullstendig, og det dannes giftig CO og sot.
        </p>
      );
      break;
  }
  return (
    <>
      {main}
      {stageText[stage]}
    </>
  );
}
