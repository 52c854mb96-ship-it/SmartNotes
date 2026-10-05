import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  Legend,
  Reaksjon,
  Readout,
  Readouts,
  Select,
  Slider,
  Sub,
  Sup,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formulaText,
  niceTicks,
  scaleLinear,
  useContainerTextScale,
} from '../kit';
import { ICE_PRESETS, direction, iceEquation, quotient, solveEquilibrium, type IcePreset, type IceSpecies } from './model';

const START_C = VIZ.muted;
const EQ_C = VIZ.series[0]!;

export default function Likevektsberegning() {
  const [pid, setPid] = useState('hi');
  const preset = ICE_PRESETS.find((p) => p.id === pid) ?? ICE_PRESETS[0]!;
  const [c0, setC0] = useState<number[]>(preset.c0);
  const [logK, setLogK] = useState(0.6);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const K = preset.K ?? 10 ** logK;
  const nu = preset.species.map((s) => s.nu);
  const start = preset.species.map((_, i) => c0[i] ?? 0);
  const r = solveEquilibrium(nu, start, K);
  const dir = direction(r.q0, K);
  const possible = Math.abs(r.x) > 0 || dir === 'likevekt';
  const xAbs = Math.abs(r.x);
  const table = tableLayout(preset, f);
  const barsH = Math.round(250 + 150 * (f - 1));

  const pick = (id: string) => {
    const p = ICE_PRESETS.find((x) => x.id === id) ?? ICE_PRESETS[0]!;
    setPid(p.id);
    setC0(p.c0);
  };
  const setC = (i: number, v: number) => setC0((old) => preset.species.map((_, j) => (j === i ? v : (old[j] ?? 0))));

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Reaksjon" value={preset.id} options={ICE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} onChange={pick} />
      </Toolbar>
      <Controls>
        {preset.species.map((s, i) => (
          <Slider
            key={`${preset.id}-${s.formula}`}
            label={
              <>
                [{speciesHtml(preset, s)}]<Sub>0</Sub>
              </>
            }
            ariaLabel={`Startkonsentrasjon av ${s.formula}`}
            value={start[i]!}
            onChange={(v) => setC(i, v)}
            min={0}
            max={2}
            step={0.05}
            unit="mol/L"
            decimals={2}
          />
        ))}
        {preset.K === null && (
          <Slider label="Likevektskonstant K" value={logK} onChange={setLogK} min={-4} max={4} step={0.1} format={(v) => fmtSig(10 ** v, 2)} />
        )}
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${table.H}`}
          label={`Tabell med start, endring og likevekt. ${preset.species.map((s, i) => `${s.formula}: start ${fmt(start[i]!, 2)}, likevekt ${fmtSig(r.c[i]!, 3)} mol/L`).join('; ')}.`}
          caption="Alle tall er konsentrasjoner i mol/L. Endringen følger koeffisientene i likningen; likevektskonsentrasjonene gjør det ikke."
          maxHeight={table.H}
        >
          <IceTable preset={preset} start={start} eq={r.c} x={r.x} layout={table} f={f} possible={possible} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${barsH}`}
        label={`Startkonsentrasjoner og likevektskonsentrasjoner som søyler.`}
        caption={preset.Ktext ? `K = ${fmtSig(K, 3)} ${preset.Ktext}.` : `K = ${fmtSig(K, 3)}, valgt med glidebryteren.`}
        maxHeight={barsH}
      >
        <Bars preset={preset} start={start} eq={r.c} height={barsH} f={f} />
      </Figure>
      <Legend
        items={[
          { color: START_C, label: 'Start' },
          { color: EQ_C, label: 'Likevekt' },
        ]}
      />

      <Readouts>
        <Readout label="Q i startblandingen" value={Number.isNaN(r.q0) ? '–' : r.q0 === Infinity ? '∞' : fmtSig(r.q0, 3)} />
        <Readout label={preset.Ktext ? `K ${preset.Ktext.replace(/ \(omtrent\)$/, '')}` : 'K'} value={fmtSig(K, 3)} tone={EQ_C} />
        <Readout label="Omsetning x" value={fmtSig(xAbs, 3)} unit="mol/L" />
        <Readout label="Netto reaksjon" value={!possible ? 'ingen' : dir === 'høyre' ? 'mot høyre' : dir === 'venstre' ? 'mot venstre' : 'ingen'} />
      </Readouts>

      <Formula label="Likevektsuttrykket">
        <FormulaLine>{preset.generic ? <>aA + bB ⇌ cC + dD: </> : <Reaksjon r={iceEquation(preset)} />}</FormulaLine>
        <FormulaLine>
          K = <KExpression preset={preset} /> = <KNumbers preset={preset} c={r.c} /> = {possible ? fmtSig(quotient(nu, r.c), 3) : '–'}
        </FormulaLine>
        {preset.id === 'ester' && <FormulaLine>Vannet er et produkt her (ikke løsemiddel), så det er med i K.</FormulaLine>}
      </Formula>

      <Explain>{explanation(preset, K, r.q0, dir, possible, start, xAbs)}</Explain>
    </VizLayout>
  );
}

/* ---------- Tekst for artene ---------- */

function speciesHtml(p: IcePreset, s: IceSpecies): ReactNode {
  return p.generic ? s.formula : <Formel f={s.formula} />;
}

function speciesSvg(p: IcePreset, s: IceSpecies): ReactNode {
  return p.generic ? s.formula : <TFormel f={s.formula} />;
}

/** «[C]²[D] / ([A][B]³)» med hevet skrift. */
function KExpression({ preset }: { preset: IcePreset }) {
  const term = (s: IceSpecies) => (
    <span key={s.formula}>
      [{speciesHtml(preset, s)}]{Math.abs(s.nu) > 1 && <Sup>{Math.abs(s.nu)}</Sup>}
    </span>
  );
  const prod = preset.species.filter((s) => s.nu > 0);
  const reac = preset.species.filter((s) => s.nu < 0);
  return (
    <>
      {joinDot(prod.map(term))} / {reac.length > 1 ? <>({joinDot(reac.map(term))})</> : joinDot(reac.map(term))}
    </>
  );
}

function KNumbers({ preset, c }: { preset: IcePreset; c: number[] }) {
  const term = (s: IceSpecies, i: number) => (
    <span key={s.formula}>
      {fmtSig(c[i] ?? 0, 3)}
      {Math.abs(s.nu) > 1 && <Sup>{Math.abs(s.nu)}</Sup>}
    </span>
  );
  const prod = preset.species.map((s, i) => ({ s, i })).filter(({ s }) => s.nu > 0);
  const reac = preset.species.map((s, i) => ({ s, i })).filter(({ s }) => s.nu < 0);
  return (
    <>
      {joinDot(prod.map(({ s, i }) => term(s, i)))} /{' '}
      {reac.length > 1 ? <>({joinDot(reac.map(({ s, i }) => term(s, i)))})</> : joinDot(reac.map(({ s, i }) => term(s, i)))}
    </>
  );
}

function joinDot(parts: ReactNode[]): ReactNode {
  return parts.map((p, i) => (
    <span key={i}>
      {i > 0 && ' · '}
      {p}
    </span>
  ));
}

/** Skriftstørrelse (relativ, som Txt) som får en formel til å passe i en kolonne med bredden w. */
function fitSize(formulaSrc: string, w: number, f: number, max: number): number {
  const chars = formulaSrc.replace(/\d/g, '').length + formulaSrc.replace(/\D/g, '').length * 0.7;
  return Math.max(0.6, Math.min(max, (w - 26) / (chars * 0.72 * 17 * f)));
}

/* ---------- Figur 1: tabellen ---------- */

interface TableLayout {
  labelW: number;
  colW: number;
  head: number;
  rows: { y: number; h: number }[];
  top: number;
  H: number;
}

function tableLayout(p: IcePreset, f: number): TableLayout {
  const labelW = f > 1.3 ? 150 : 170;
  const colW = (800 - labelW) / p.species.length;
  const top = 40 * f;
  const head = 44 * f;
  const rowH = [40 * f, 64 * f, 64 * f];
  let y = top + head;
  const rows = rowH.map((h) => {
    const r = { y, h };
    y += h;
    return r;
  });
  return { labelW, colW, head, rows, top, H: Math.round(y + 8) };
}

/** «−3x», «+2x», «−x». */
function changeText(nu: number, sign: number): string {
  const v = nu * sign;
  const a = Math.abs(v);
  return `${v < 0 ? '−' : '+'}${a === 1 ? '' : a}x`;
}

/** «1,00 − x», «2x», «0,20 + 2x». */
function eqText(c0: number, nu: number, sign: number): string {
  const ch = changeText(nu, sign);
  if (c0 === 0) return ch.startsWith('+') ? ch.slice(1) : ch;
  return `${fmt(c0, 2)} ${ch[0]} ${ch.slice(1)}`;
}

function IceTable({
  preset,
  start,
  eq,
  x,
  layout,
  f,
  possible,
}: {
  preset: IcePreset;
  start: number[];
  eq: number[];
  x: number;
  layout: TableLayout;
  f: number;
  possible: boolean;
}) {
  const { labelW, colW, head, rows, top } = layout;
  const sign = x >= 0 ? 1 : -1;
  const xAbs = Math.abs(x);
  const cx = (i: number) => labelW + colW * (i + 0.5);
  const small = f > 1.3 && preset.species.length > 3;
  const rowLabels = ['Start', 'Endring', 'Likevekt'];
  return (
    <g>
      <Txt x={0} y={top - 14 * f} anchor="start" size={0.9} weight={650}>
        {!possible
          ? 'Ingen reaksjon er mulig med disse startkonsentrasjonene'
          : xAbs < 1e-9
            ? 'Startblandingen er allerede i likevekt: x = 0'
            : `x = ${fmtSig(xAbs, 3)} mol/L, reaksjonen går mot ${sign > 0 ? 'høyre' : 'venstre'}`}
      </Txt>
      <rect x={0} y={top} width={800} height={layout.H - top - 8} rx={10} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <rect x={0} y={top} width={800} height={head} rx={10} fill={VIZ.grid} opacity={0.5} />
      {preset.species.map((s, i) => (
        <Txt key={s.formula} x={cx(i)} y={top + head / 2 + 7 * f} size={fitSize(s.formula, colW, f, small ? 0.85 : 1)} weight={700}>
          {speciesSvg(preset, s)}
        </Txt>
      ))}
      {rows.map((r, k) => (
        <g key={k}>
          <line x1={0} x2={800} y1={r.y} y2={r.y} stroke={VIZ.grid} strokeWidth={1.5} />
          <Txt x={14} y={r.y + (k === 0 ? r.h / 2 + 6 * f : 26 * f)} anchor="start" weight={650} size={0.9}>
            {rowLabels[k]}
          </Txt>
        </g>
      ))}
      <line x1={labelW} x2={labelW} y1={top} y2={layout.H - 8} stroke={VIZ.grid} strokeWidth={1.5} />
      {preset.species.map((s, i) => {
        const [r0, r1, r2] = rows as [{ y: number; h: number }, { y: number; h: number }, { y: number; h: number }];
        const ch = s.nu * sign * xAbs;
        const color = ch < 0 ? VIZ.series[1] : VIZ.series[2];
        const sz = small ? 0.8 : 0.9;
        return (
          <g key={s.formula}>
            <Txt x={cx(i)} y={r0.y + r0.h / 2 + 6 * f} size={sz} weight={600}>
              {fmt(start[i]!, 2)}
            </Txt>
            <Txt x={cx(i)} y={r1.y + 24 * f} size={sz} muted>
              {possible && xAbs > 1e-9 ? changeText(s.nu, sign) : '0'}
            </Txt>
            <Txt x={cx(i)} y={r1.y + 50 * f} size={sz} weight={650} color={possible && xAbs > 1e-9 ? color : undefined}>
              {possible && xAbs > 1e-9 ? `${ch < 0 ? '−' : '+'}${fmtSig(Math.abs(ch), 3)}` : '0'}
            </Txt>
            <Txt x={cx(i)} y={r2.y + 24 * f} size={sz} muted>
              {possible && xAbs > 1e-9 ? eqText(start[i]!, s.nu, sign) : fmt(start[i]!, 2)}
            </Txt>
            <Txt x={cx(i)} y={r2.y + 50 * f} size={sz} weight={700} color={EQ_C}>
              {fmtSig(eq[i] ?? 0, 3)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Figur 2: søyler ---------- */

function Bars({ preset, start, eq, height, f }: { preset: IcePreset; start: number[]; eq: number[]; height: number; f: number }) {
  const vMax = Math.max(0.5, ...start, ...eq) * 1.15;
  const x0 = 70 * f;
  const x1 = 790;
  const y0 = height - 46 * f;
  const y1 = 30 * f;
  const sy = scaleLinear([0, vMax], [y0, y1]);
  const n = preset.species.length;
  const gw = (x1 - x0) / n;
  const bw = Math.min(70, gw * 0.3);
  const ticks = niceTicks(0, vMax, f > 1.3 ? 3 : 4);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={sy(t)} y2={sy(t)} className="viz-gridline" />
          <text x={x0 - 10} y={sy(t) + 5 * f} textAnchor="end" className="viz-tick">
            {fmt(t, vMax < 2 ? 1 : 0)}
          </text>
        </g>
      ))}
      <line x1={x0} x2={x1} y1={y0} y2={y0} className="viz-axis" />
      <text x={16 * f} y={(y0 + y1) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${16 * f} ${(y0 + y1) / 2})`}>
        mol/L
      </text>
      {preset.species.map((s, i) => {
        const gx = x0 + gw * (i + 0.5);
        const a = start[i]!;
        const b = eq[i] ?? 0;
        return (
          <g key={s.formula}>
            <rect x={gx - bw - 3} y={sy(a)} width={bw} height={Math.max(0, y0 - sy(a))} fill="none" stroke={START_C} strokeWidth={2.5} strokeDasharray="6 4" />
            <rect x={gx + 3} y={sy(b)} width={bw} height={Math.max(0, y0 - sy(b))} fill={EQ_C} opacity={0.85} />
            <Txt x={gx + 3 + bw / 2} y={sy(b) - 8} size={0.75} weight={650} color={EQ_C}>
              {fmtSig(b, 2)}
            </Txt>
            <Txt x={gx} y={y0 + 28 * f} size={fitSize(s.formula, gw, f, 0.9)} weight={700}>
              {speciesSvg(preset, s)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(p: IcePreset, K: number, q0: number, dir: string, possible: boolean, start: number[], x: number): ReactNode {
  if (!possible) {
    return (
      <p>
        Ingen reaksjon er mulig: for at reaksjonen skal gå mot høyre, må alle reaktantene finnes, og for at den skal gå mot venstre, må alle produktene finnes.
        Øk en av startkonsentrasjonene.
      </p>
    );
  }
  const size =
    K >= 1000 ? (
      <>
        <strong>K = {fmtSig(K, 3)} er svært stor,</strong> så likevekten ligger helt mot høyre: reaksjonen går nesten fullstendig, og den begrensende reaktanten
        blir nesten helt brukt opp.
      </>
    ) : K > 10 ? (
      <>
        <strong>K = {fmtSig(K, 3)} er stor,</strong> så likevekten ligger mot høyre: det er mest produkter ved likevekt, men litt av reaktantene er igjen.
      </>
    ) : K >= 0.1 ? (
      <>
        <strong>K = {fmtSig(K, 3)} ligger nær 1,</strong> så det finnes merkbare mengder av både reaktanter og produkter ved likevekt.
      </>
    ) : K > 0.001 ? (
      <>
        <strong>K = {fmtSig(K, 3)} er liten,</strong> så likevekten ligger mot venstre: det er mest reaktanter ved likevekt.
      </>
    ) : (
      <>
        <strong>K = {fmtSig(K, 3)} er svært liten,</strong> så likevekten ligger helt mot venstre: nesten ingenting av reaktantene blir til produkt.
      </>
    );
  const way =
    dir === 'likevekt' ? (
      <>Startblandingen har Q = K, så den er allerede i likevekt.</>
    ) : dir === 'høyre' ? (
      <>I startblandingen er Q = {fmtSig(q0, 3)} mindre enn K, så reaksjonen går mot høyre til Q = K. Reaktantene får «−» i endringsraden og produktene «+».</>
    ) : (
      <>
        I startblandingen er Q {q0 === Infinity ? 'uendelig stor (ingen reaktanter)' : `= ${fmtSig(q0, 3)}`}, altså større enn K, så reaksjonen går mot venstre.
        Da får produktene «−» og reaktantene «+» i endringsraden.
      </>
    );
  const sym = p.id === 'hi' && Math.abs(start[0]! - start[1]!) < 1e-9 && start[2] === 0;
  return (
    <>
      <p>
        {size} {way}
      </p>
      <p>
        Slik regner du: sett opp tabellen, uttrykk likevektskonsentrasjonene med x, sett dem inn i likevektsuttrykket og løs for x.
        {sym ? (
          <>
            {' '}
            Her er [H<Sub>2</Sub>] = [I<Sub>2</Sub>], så du kan ta kvadratroten på begge sider: √{fmtSig(K, 3)} = 2x / ({fmt(start[0]!, 2)} − x), som gir x ={' '}
            {fmtSig(x, 3)} mol/L.
          </>
        ) : (
          <> Likningen blir ofte av høyere grad, så her løses den numerisk ved halvering: x prøves til Q = K.</>
        )}
      </p>
      <p>
        Vanlige feil: likevekt betyr ikke at konsentrasjonene er like. Endringen følger koeffisientene ({changesText(p)}), men det gjør ikke
        likevektskonsentrasjonene. Og K endres bare når temperaturen endres, ikke når du endrer startkonsentrasjonene.
      </p>
    </>
  );
}

function changesText(p: IcePreset): string {
  return p.species.map((s) => `${changeText(s.nu, 1)} for ${p.generic ? s.formula : formulaText(s.formula)}`).join(', ');
}
