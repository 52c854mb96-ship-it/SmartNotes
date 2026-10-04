import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  Partikler,
  Readout,
  Readouts,
  Reaksjon,
  Segmented,
  Select,
  Slider,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formulaText,
  molarMass,
  useContainerTextScale,
  type ParticleGroup,
  type Term,
} from '../kit';
import { LIMITING_REACTIONS, ceilTo, limitingResult, niceStep, parsedEquation, percentYield, pictureCounts, type LimitingResult } from './model';
import { MiniMolecule, miniRadius } from './molekyler';

type Mode = 'n' | 'm';

/** Hver tegnet partikkel er så mange mol. */
const UNIT = 0.5;
/** Farge for reaktanten som blir til overs, og for den begrensende. */
const LEFT_OVER = VIZ.series[1]!;
const PRODUCT = VIZ.series[2]!;

const bare = (f: string) => f.replace(/\((aq|s|l|g)\)$/i, '');

export default function BegrensendeReaktant() {
  const [id, setId] = useState(LIMITING_REACTIONS[0]!.id);
  const L = LIMITING_REACTIONS.find((x) => x.id === id) ?? LIMITING_REACTIONS[0]!;
  const [mode, setMode] = useState<Mode>('n');
  const [n, setN] = useState<number[]>(L.n0);
  /** Faktisk utbytte som andel av det teoretiske (0–1,2). */
  const [yieldFrac, setYieldFrac] = useState(0.8);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const rx = parsedEquation(L);
  const terms = [...rx.reactants, ...rx.products];
  const M = terms.map((t) => molarMass(t.formula));
  const res = limitingResult(rx, n);
  const pic = pictureCounts(rx, n, UNIT);
  const nR = rx.reactants.length;
  const pIdx = nR + L.yieldOf;
  const product = terms[pIdx]!;
  const theo = res.after[pIdx]! * M[pIdx]!;
  const actual = yieldFrac * theo;
  const pct = percentYield(actual, theo);
  const rounded = mode === 'm' || n.some((v) => Math.abs(v / UNIT - Math.round(v / UNIT)) > 1e-9);

  const choose = (next: string) => {
    const nl = LIMITING_REACTIONS.find((x) => x.id === next) ?? L;
    setId(next);
    setN(nl.n0);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    if (m === 'n') setN((prev) => prev.map((v) => Math.round(v / UNIT) * UNIT));
  };

  // På mobil tegnes partikkelbildet i en smalere viewBox (420 bred), så molekylene blir store nok å se.
  const narrow = f > 1.3;
  const picW = narrow ? 420 : 800;
  const picF = narrow ? 1 : f;
  const picH = pictureHeight(terms.length, nR, picF, narrow);
  const tab = tableLayout(mode, f);

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Reaksjon" value={id} onChange={choose} options={LIMITING_REACTIONS.map((x) => ({ value: x.id, label: x.name }))} />
        <Segmented
          label="Oppgi mengden som"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'n', label: 'Stoffmengde n' },
            { value: 'm', label: 'Masse m' },
          ]}
        />
      </Toolbar>
      <Controls>
        {rx.reactants.map((t, i) => {
          const fx = bare(t.formula);
          if (mode === 'n')
            return (
              <Slider
                key={`n${i}`}
                label={
                  <>
                    n(<Formel f={fx} />)
                  </>
                }
                ariaLabel={`Stoffmengde ${formulaText(fx)}`}
                value={n[i] ?? 0}
                onChange={(v) => setN((prev) => prev.map((x, j) => (j === i ? v : x)))}
                min={0}
                max={L.nMax[i] ?? 4}
                step={UNIT}
                format={(v) => `${fmt(v, 1)} mol`}
              />
            );
          const step = niceStep(((L.nMax[i] ?? 4) * M[i]!) / 150);
          const max = ceilTo((L.nMax[i] ?? 4) * M[i]!, step);
          const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
          return (
            <Slider
              key={`m${i}`}
              label={
                <>
                  m(<Formel f={fx} />)
                </>
              }
              ariaLabel={`Masse ${formulaText(fx)}`}
              value={(n[i] ?? 0) * M[i]!}
              onChange={(v) => setN((prev) => prev.map((x, j) => (j === i ? v / M[i]! : x)))}
              min={0}
              max={max}
              step={step}
              format={(v) => `${fmt(v, dec)} g`}
            />
          );
        })}
        <Slider
          label={
            <>
              Faktisk utbytte <Formel f={bare(product.formula)} />
            </>
          }
          ariaLabel="Faktisk utbytte"
          value={Math.round(yieldFrac * 100)}
          onChange={(v) => setYieldFrac(v / 100)}
          min={0}
          max={120}
          step={1}
          format={(v) => `${fmtSig((v / 100) * theo)} g`}
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${picW} ${picH}`}
          label={`Partikkelbilde før og etter reaksjonen. ${limitingText(rx.reactants, res)}`}
          caption={`Hver partikkel er ${fmt(UNIT, 1)} mol.${rounded ? ' Antallene er rundet av til hele partikler.' : ''}`}
          maxHeight={picH}
        >
          <ParticleScene terms={terms} nR={nR} pic={pic} res={res} f={picF} narrow={narrow} n={n} />
        </Figure>
      </div>

      <Figure viewBox={`0 0 800 ${tab.H}`} label="Støkiometrisk tabell med stoffmengdene før, endringen og etter reaksjonen." caption="Stoffmengder n i mol, masser m i gram og molar masse M i g/mol." maxHeight={tab.H}>
        <StoichTable terms={terms} nR={nR} M={M} res={res} layout={tab} f={f} yieldIdx={pIdx} />
      </Figure>

      <Readouts>
        <Readout label="Begrensende reaktant" value={limitingShort(rx.reactants, res)} tone={LEFT_OVER} />
        <Readout
          label={
            <>
              Teoretisk utbytte <Formel f={bare(product.formula)} />
            </>
          }
          value={fmtSig(theo)}
          unit="g"
          tone={PRODUCT}
        />
        <Readout label="Faktisk utbytte" value={fmtSig(actual)} unit="g" />
        <Readout label="Prosentvis utbytte" value={Number.isFinite(pct) ? fmt(pct, 0) : '–'} unit="%" tone={pct > 100 ? LEFT_OVER : undefined} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          <Reaksjon r={rx} />
        </FormulaLine>
        {mode === 'm' &&
          rx.reactants.map((t, i) => (
            <FormulaLine key={i}>
              n(<Formel f={bare(t.formula)} />) = m / M = {fmtSig((n[i] ?? 0) * M[i]!)} g / {fmt(M[i]!, 2)} g/mol = {fmtSig(n[i] ?? 0)} mol
            </FormulaLine>
          ))}
        <FormulaLine>
          {rx.reactants.map((t, i) => (
            <span key={i}>
              {i > 0 && ' og '}
              n(<Formel f={bare(t.formula)} />) / {t.coef} = {fmtSig(res.ratios[i] ?? 0)}
            </span>
          ))}
          {res.limiting.length > 0 && !res.exact && <> → minst for {limitingShort(rx.reactants, res)}</>}
          {res.exact && <> → like store: alt brukes opp</>}
        </FormulaLine>
        <FormulaLine>
          n(<Formel f={bare(product.formula)} />) = {product.coef} · {fmtSig(res.extent)} mol = {fmtSig(res.after[pIdx]!)} mol, m = n · M = {fmtSig(res.after[pIdx]!)} mol ·{' '}
          {fmt(M[pIdx]!, 2)} g/mol = {fmtSig(theo)} g
        </FormulaLine>
        <FormulaLine>
          Prosentvis utbytte = faktisk / teoretisk · 100 % = {fmtSig(actual)} g / {fmtSig(theo)} g · 100 % = {Number.isFinite(pct) ? `${fmt(pct, 0)} %` : '–'}
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ rx: rx.reactants, n, M, res, mode, product, theo, pct })}</Explain>
    </VizLayout>
  );
}

function limitingShort(reactants: Term[], res: LimitingResult): string {
  if (res.limiting.length === 0) return '–';
  if (res.exact) return 'Ingen (alt brukes opp)';
  return res.limiting.map((i) => formulaText(bare(reactants[i]!.formula))).join(' og ');
}

function limitingText(reactants: Term[], res: LimitingResult): string {
  if (res.extent === 0) return 'Ingenting reagerer.';
  if (res.exact) return 'Begge reaktantene brukes opp.';
  return `${limitingShort(reactants, res)} er begrensende reaktant.`;
}

/* ---------- Figur 1: partikkelbildet ---------- */

const ROW = 30;

const BOX_H = 250;

function pictureHeight(nTerms: number, nR: number, f: number, narrow: boolean): number {
  if (narrow) {
    // Under hverandre: tittel, boks, forklaring (reaktantene), pil, tittel, boks, forklaring (alle stoffene)
    return Math.round(2 * (34 * f + BOX_H + 14 * f) + (nR + nTerms) * ROW * f + 40 * f);
  }
  return Math.round(34 * f + BOX_H + 18 * f + nTerms * ROW * f + 6);
}

function ParticleScene({
  terms,
  nR,
  pic,
  res,
  f,
  narrow,
  n,
}: {
  terms: Term[];
  nR: number;
  pic: { before: number[]; after: number[] };
  res: LimitingResult;
  f: number;
  narrow: boolean;
  n: number[];
}) {
  const k = Math.max(1, 0.85 * f);
  const scale = (narrow ? 1.75 : 2.0) / k;
  const boxH = BOX_H;
  const top = 34 * f;
  const cx = narrow ? 210 : 400;
  const boxes = narrow
    ? [
        { x: 10, y: top, w: 400 },
        { x: 10, y: top + boxH + 14 * f + nR * ROW * f + 40 * f + 34 * f, w: 400 },
      ]
    : [
        { x: 16, y: top, w: 350 },
        { x: 434, y: top, w: 350 },
      ];
  const groups = (counts: number[], after: boolean): ParticleGroup[] =>
    terms.map((t, i) => {
      const fx = bare(t.formula);
      const left = after && i < nR && (counts[i] ?? 0) > 0;
      return {
        n: counts[i] ?? 0,
        r: miniRadius(fx) * scale,
        render: (p) => <MiniMolecule f={fx} x={p.x} y={p.y} scale={p.r / miniRadius(fx)} angle={p.angle} ring={left ? LEFT_OVER : undefined} />,
      };
    });
  const legend = (box: { x: number; y: number; w: number }, after: boolean) => {
    const idx = after ? terms.map((_, i) => i) : terms.slice(0, nR).map((_, i) => i);
    return idx.map((i, row) => {
      const t = terms[i]!;
      const fx = bare(t.formula);
      const count = (after ? pic.after : pic.before)[i] ?? 0;
      const mol = after ? res.after[i]! : (n[i] ?? 0);
      const y = box.y + boxH + 14 * f + (row + 0.75) * ROW * f;
      const isLim = res.limiting.includes(i) && i < nR && res.extent >= 0 && !res.exact;
      let note = '';
      let color: string | undefined;
      if (!after && i < nR && isLim) {
        note = 'begrensende';
        color = LEFT_OVER;
      } else if (after && i < nR) {
        note = count > 0 ? 'til overs' : 'brukt opp';
        color = count > 0 ? LEFT_OVER : undefined;
      } else if (after) {
        note = 'dannet';
        color = PRODUCT;
      }
      const s = Math.min(0.9, 9 / miniRadius(fx)) * Math.max(1, 0.85 * f);
      return (
        <g key={`${after ? 'a' : 'b'}${i}`}>
          <MiniMolecule f={fx} x={box.x + 14 * f} y={y - 6 * f} scale={s} />
          <Txt x={box.x + 32 * f} y={y} anchor="start" size={0.9} weight={650}>
            {fmt(count, 0)} <TFormel f={fx} />
            <tspan dx={6} className="is-muted" fontWeight={500} style={{ fill: VIZ.muted }}>
              ({fmtSig(mol, 2)} mol)
            </tspan>
            {note && (
              <tspan dx={8} fontWeight={note === 'brukt opp' ? 500 : 650} style={{ fill: color ?? VIZ.muted }}>
                {note}
              </tspan>
            )}
          </Txt>
        </g>
      );
    });
  };
  const [b0, b1] = boxes as [{ x: number; y: number; w: number }, { x: number; y: number; w: number }];
  return (
    <g>
      {[b0, b1].map((b, i) => (
        <g key={i}>
          <Txt x={b.x + 4} y={b.y - 12 * f} anchor="start" weight={700}>
            {i === 0 ? 'Før reaksjonen' : 'Etter reaksjonen'}
          </Txt>
          <rect x={b.x} y={b.y} width={b.w} height={boxH} rx={16} fill={VIZ.body} fillOpacity={0.35} stroke={VIZ.muted} strokeOpacity={0.55} strokeWidth={2} />
          <Partikler box={{ x: b.x + 8, y: b.y + 8, w: b.w - 16, h: boxH - 16 }} groups={groups(i === 0 ? pic.before : pic.after, i === 1)} seed={i === 0 ? 11 : 23} gap={4} />
          {legend(b, i === 1)}
        </g>
      ))}
      {narrow ? (
        <g>
          <line x1={cx} y1={b1.y - 34 * f - 36 * f} x2={cx} y2={b1.y - 34 * f - 8} stroke={VIZ.ink} strokeWidth={3} />
          <polygon points={`${cx - 9},${b1.y - 34 * f - 14} ${cx + 9},${b1.y - 34 * f - 14} ${cx},${b1.y - 34 * f + 2}`} fill={VIZ.ink} />
        </g>
      ) : (
        <g>
          <line x1={376} y1={b0.y + boxH / 2} x2={416} y2={b0.y + boxH / 2} stroke={VIZ.ink} strokeWidth={3} />
          <polygon points={`${426},${b0.y + boxH / 2} ${412},${b0.y + boxH / 2 - 8} ${412},${b0.y + boxH / 2 + 8}`} fill={VIZ.ink} />
        </g>
      )}
    </g>
  );
}

/* ---------- Figur 2: støkiometrisk tabell ---------- */

interface TabLayout {
  rows: { key: string; label: string }[];
  headH: number;
  rowH: number;
  labelW: number;
  H: number;
}

function tableLayout(mode: Mode, f: number): TabLayout {
  const rows = [
    { key: 'M', label: 'M' },
    ...(mode === 'm' ? [{ key: 'm0', label: 'm før' }] : []),
    { key: 'n0', label: 'n før' },
    { key: 'dn', label: 'endring' },
    { key: 'n1', label: 'n etter' },
    { key: 'm1', label: 'm etter' },
  ];
  const headH = 54 * f;
  const rowH = 34 * f;
  return { rows, headH, rowH, labelW: 150 * Math.min(1.25, f), H: Math.round(headH + rows.length * rowH + 10) };
}

function StoichTable({
  terms,
  nR,
  M,
  res,
  layout,
  f,
  yieldIdx,
}: {
  terms: Term[];
  nR: number;
  M: number[];
  res: LimitingResult;
  layout: TabLayout;
  f: number;
  yieldIdx: number;
}) {
  const { rows, headH, rowH, labelW } = layout;
  const x0 = 10;
  const colW = (790 - x0 - labelW) / terms.length;
  const cx = (i: number) => x0 + labelW + colW * (i + 0.5);
  const signedSig = (v: number) => (Math.abs(v) < 1e-12 ? '0' : `${v > 0 ? '+' : '−'}${fmtSig(Math.abs(v))}`);
  const value = (key: string, i: number): string => {
    switch (key) {
      case 'M':
        return fmt(M[i]!, 2);
      case 'm0':
        return fmtSig(res.before[i]! * M[i]!);
      case 'n0':
        return fmtSig(res.before[i]!);
      case 'dn':
        return signedSig(res.change[i]!);
      case 'n1':
        return fmtSig(res.after[i]!);
      default:
        return fmtSig(res.after[i]! * M[i]!);
    }
  };
  return (
    <g>
      {terms.map((t, i) => {
        const lim = i < nR && res.limiting.includes(i) && !res.exact && res.extent >= 0;
        const prod = i === yieldIdx;
        return (
          <g key={i}>
            {(lim || prod) && (
              <rect x={x0 + labelW + colW * i + 3} y={4} width={colW - 6} height={headH + rows.length * rowH - 2} rx={10} fill={lim ? LEFT_OVER : PRODUCT} opacity={0.12} />
            )}
            <Txt x={cx(i)} y={22 * f} weight={700}>
              {t.coef > 1 ? `${t.coef} ` : ''}
              <TFormel f={bare(t.formula)} />
            </Txt>
            <Txt x={cx(i)} y={44 * f} size={0.72} muted={!lim && !prod} color={lim ? LEFT_OVER : prod ? PRODUCT : undefined} weight={lim || prod ? 650 : 500}>
              {lim ? 'begrensende' : prod ? 'utbytte' : i < nR ? 'reaktant' : 'produkt'}
            </Txt>
          </g>
        );
      })}
      <line x1={x0} y1={headH} x2={790} y2={headH} stroke={VIZ.grid} strokeWidth={2} />
      {rows.map((r, j) => {
        const y = headH + j * rowH;
        return (
          <g key={r.key}>
            {j > 0 && <line x1={x0} y1={y} x2={790} y2={y} stroke={VIZ.grid} strokeWidth={1} />}
            <Txt x={x0 + 4} y={y + rowH / 2 + 6 * f} anchor="start" size={0.85} muted={r.key === 'M'} weight={r.key === 'n1' ? 700 : 600}>
              {r.label}
            </Txt>
            {terms.map((_, i) => (
              <Txt key={i} x={cx(i)} y={y + rowH / 2 + 6 * f} size={0.9} muted={r.key === 'M'} weight={r.key === 'n1' ? 700 : 500}>
                {value(r.key, i)}
              </Txt>
            ))}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  rx,
  n,
  M,
  res,
  mode,
  product,
  theo,
  pct,
}: {
  rx: Term[];
  n: number[];
  M: number[];
  res: LimitingResult;
  mode: Mode;
  product: Term;
  theo: number;
  pct: number;
}): ReactNode {
  const F = (t: Term) => <Formel f={bare(t.formula)} />;
  const [a, b] = rx as [Term, Term];
  const ratio = `${a.coef} : ${b.coef}`;
  let first: ReactNode;
  const zero = rx.findIndex((_, i) => (n[i] ?? 0) <= 0);
  if (zero >= 0) {
    first = (
      <p>
        <strong>Ingenting reagerer.</strong> Det er ingen {F(rx[zero]!)}, så reaksjonen kan ikke skje, og det dannes ikke noe {F(product)}. Øk
        stoffmengden av begge reaktantene.
      </p>
    );
  } else if (res.exact) {
    first = (
      <p>
        <strong>Støkiometrisk blanding.</strong> Stoffmengdene står i samme forhold som koeffisientene ({F(a)} : {F(b)} = {ratio}), så begge reaktantene brukes opp
        samtidig og ingenting blir til overs.
      </p>
    );
  } else {
    const li = res.limiting[0]!;
    const oi = li === 0 ? 1 : 0;
    const lim = rx[li]!;
    const other = rx[oi]!;
    const needed = (other.coef / lim.coef) * (n[li] ?? 0);
    const leftover = res.after[oi]!;
    const lessOfLimiting = (n[li] ?? 0) > (n[oi] ?? 0);
    const massMisleads = mode === 'm' && (n[li] ?? 0) * M[li]! > (n[oi] ?? 0) * M[oi]!;
    first = (
      <p>
        <strong>{F(lim)} er begrensende reaktant.</strong> I likningen er forholdet {F(a)} : {F(b)} = {ratio}, så {fmtSig(n[li] ?? 0)} mol {F(lim)} trenger{' '}
        {fmtSig(needed)} mol {F(other)}. Det er {fmtSig(n[oi] ?? 0)} mol {F(other)}, så {fmtSig(leftover)} mol {F(other)} blir til overs når all{' '}
        {F(lim)} er brukt opp.
        {lessOfLimiting && (
          <>
            {' '}
            Legg merke til at det er <em>mer</em> {F(lim)} enn {F(other)}, men {F(lim)} er likevel begrensende fordi den trengs i større mengde.
            Sammenlign alltid n delt på koeffisienten, ikke stoffmengdene direkte.
          </>
        )}
        {massMisleads && !lessOfLimiting && (
          <>
            {' '}
            Massen av {F(lim)} er størst, men det er stoffmengden som teller: regn alltid om fra masse til mol før du sammenligner.
          </>
        )}
      </p>
    );
  }
  const yieldPart =
    theo > 0 ? (
      pct > 100 ? (
        <p>
          <strong>Prosentvis utbytte {fmt(pct, 0)} %.</strong> Mer enn 100 % er umulig, fordi det ikke kan dannes mer {F(product)} enn den begrensende
          reaktanten gir ({fmtSig(theo)} g). Et så høyt resultat betyr at produktet ikke er tørt eller inneholder urenheter.
        </p>
      ) : (
        <p>
          <strong>Prosentvis utbytte {fmt(pct, 0)} %.</strong> Det teoretiske utbyttet, {fmtSig(theo)} g {F(product)}, er det som dannes hvis all den
          begrensende reaktanten reagerer. I praksis blir utbyttet lavere: noe reagerer ikke, noe går tapt ved filtrering og overføring, og det kan
          dannes biprodukter.
        </p>
      )
    ) : null;
  return (
    <>
      {first}
      {yieldPart}
    </>
  );
}
