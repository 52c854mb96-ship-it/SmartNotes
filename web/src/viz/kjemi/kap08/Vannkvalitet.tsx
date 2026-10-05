import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Sub,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formulaText,
  mixColor,
  scaleLinear,
  superscript,
  useContainerTextScale,
} from '../kit';
import {
  POLLUTANTS,
  V_M,
  airUnits,
  formatLimit,
  getPollutant,
  limitRatio,
  limitStatus,
  logPosition,
  logValue,
  niceRound,
  pollutantMolarMass,
  waterUnits,
  type Medium,
  type Pollutant,
} from './model';

const MEDIA: { value: Medium; label: string }[] = [
  { value: 'vann', label: 'Drikkevann' },
  { value: 'luft', label: 'Uteluft' },
];

const GOOD = KJEMI.ph[3]!;
const BAD = KJEMI.ph[0]!;
const AMBER = KJEMI.ph[1]!;

export default function Vannkvalitet() {
  const [id, setId] = useState('nitrat');
  const p = getPollutant(id);
  const [t, setT] = useState(logPosition(p.min, p.max, p.value));
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const value = niceRound(logValue(p.min, p.max, t));
  const M = pollutantMolarMass(p);

  const choose = (nextId: string) => {
    const q = getPollutant(nextId);
    setId(nextId);
    setT(logPosition(q.min, q.max, q.value));
  };
  const chooseMedium = (m: Medium) => {
    if (m === p.medium) return;
    choose(POLLUTANTS.find((q) => q.medium === m)!.id);
  };

  const narrow = f > 1.3;
  const chain = chainFor(p, value, M);
  const chainH = narrow ? Math.round(chain.length * 62 * f + (chain.length - 1) * 42 * f + 16) : Math.round(150 + 30 * (f - 1));
  const scaleH = scaleHeight(p, f);
  const main = p.limits[0]!;
  const ratio = limitRatio(value, main);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Vann eller luft" options={MEDIA} value={p.medium} onChange={chooseMedium} />
        <Select
          label="Stoff"
          value={id}
          onChange={choose}
          options={POLLUTANTS.filter((q) => q.medium === p.medium).map((q) => ({ value: q.id, label: q.formula ? `${q.name} (${formulaText(q.formula)})` : q.name }))}
        />
      </Toolbar>
      <Controls>
        <Slider
          label="Målt konsentrasjon"
          value={t}
          onChange={setT}
          min={0}
          max={1}
          step={0.002}
          format={() => `${fmtSig(value, 2)} ${p.unit}`}
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${chainH}`}
          label={`${capital(p.name)}: ${fmtSig(value, 2)} ${p.unit} omregnet til andre enheter.`}
          caption={
            p.medium === 'vann'
              ? 'Den uthevede boksen er den målte verdien. For fortynnede vannløsninger veier 1 L omtrent 1 kg, så 1 mg/L ≈ 1 mg/kg = 1 ppm (milliondel) og 1 µg/L ≈ 1 ppb (milliarddel).'
              : `Den uthevede boksen er den målte verdien. I luft er ppm og ppb volumandeler (eller stoffmengdeandeler): 1 ppb er 1 nL gass per liter luft. Molvolumet Vₘ = ${fmt(V_M, 1)} L/mol ved 25 °C og 1 atm.`
          }
          maxHeight={chainH}
        >
          <Chain chain={chain} f={f} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${scaleH}`}
        label={`Logaritmisk skala: ${fmtSig(value, 2)} ${p.unit} er ${fmtSig(ratio, 2)} ganger grenseverdien ${formatLimit(main.value)} ${p.unit}.`}
        caption={`Hvert merke er ti ganger så mye som det forrige. Grønt er under grenseverdien, rødt over (oransje: mellom to grenseverdier for ulike midlingstider). Grenseverdiene er fra ${p.medium === 'vann' ? 'drikkevannsforskriften' : 'forurensningsforskriften (kapittel 7)'}.`}
        maxHeight={scaleH}
      >
        <LimitScale p={p} value={value} f={f} />
      </Figure>

      <Readouts>
        {p.medium === 'vann' ? (
          <>
            <Readout label="Konsentrasjon" value={M ? fmtSig(waterUnits(value, p.unit, M).molPerL, 2) : '–'} unit="mol/L" />
            <Readout label="mg/L ≈ ppm" value={fmtSig(waterUnits(value, p.unit, M ?? 1).ppm, 2)} unit="ppm" />
            <Readout label="µg/L ≈ ppb" value={fmtSig(waterUnits(value, p.unit, M ?? 1).ppb, 2)} unit="ppb" />
          </>
        ) : (
          <>
            <Readout label="Massekonsentrasjon" value={fmtSig(airUnits(value, p.unit, M).ugPerM3, 2)} unit="µg/m³" />
            <Readout label="Volumandel" value={M ? fmtSig(airUnits(value, p.unit, M).ppb, 2) : '–'} unit="ppb" />
            <Readout label="Volumandel" value={M ? fmtSig(airUnits(value, p.unit, M).ppm, 2) : '–'} unit="ppm" />
          </>
        )}
        <Readout
          label={`Andel av grenseverdien (${main.label})`}
          value={fmt(ratio * 100, ratio < 0.1 ? 1 : 0)}
          unit="%"
          tone={valueColor(p, value)}
        />
      </Readouts>

      <Formula label="Omregning">{formulaLines(p, value, M)}</Formula>

      <Explain>{explanation(p, value, M)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: omregningskjeden ---------- */

interface ChainBox {
  title: ReactNode;
  value: string;
  measured?: boolean;
  disabled?: boolean;
}

interface ChainStep {
  box: ChainBox;
  /** Operasjonen fram til neste boks. */
  op?: { label: ReactNode; detail: string };
}

function chainFor(p: Pollutant, value: number, M: number | null): ChainStep[] {
  if (p.medium === 'vann') {
    const u = waterUnits(value, p.unit, M ?? 1);
    return [
      {
        box: { title: 'stoffmengde per liter', value: M ? `${fmtSig(u.molPerL, 2)} mol/L` : '–' },
        op: { label: <>· M · 1000</>, detail: M ? `M = ${fmt(M, 2)} g/mol` : '' },
      },
      { box: { title: 'mg/L ≈ ppm', value: `${fmtSig(u.mgPerL, 2)} mg/L`, measured: p.unit === 'mg/L' }, op: { label: <>· 1000</>, detail: '1 mg = 1000 µg' } },
      { box: { title: 'µg/L ≈ ppb', value: `${fmtSig(u.ugPerL, 2)} µg/L`, measured: p.unit === 'µg/L' } },
    ];
  }
  const u = airUnits(value, p.unit, M);
  const none = M === null;
  return [
    {
      box: { title: 'masse per m³', value: p.unit === 'mg/m³' ? `${fmtSig(u.mgPerM3, 2)} mg/m³` : `${fmtSig(u.ugPerM3, 2)} µg/m³`, measured: true },
      op: { label: <>÷ M</>, detail: M ? `M = ${fmt(M, 2)} g/mol` : 'ingen M' },
    },
    {
      box: { title: 'stoffmengde per m³', value: none ? 'ikke definert' : `${fmtSig(u.umolPerM3, 2)} µmol/m³`, disabled: none },
      op: {
        label: (
          <>
            · V<TSub>m</TSub>
          </>
        ),
        detail: `${fmt(V_M, 1)} L/mol`,
      },
    },
    {
      box: { title: 'volumandel', value: none ? 'ikke definert' : `${fmtSig(u.ppb, 2)} ppb`, disabled: none },
      op: { label: <>÷ 1000</>, detail: '1 ppm = 1000 ppb' },
    },
    { box: { title: 'volumandel', value: none ? 'ikke definert' : `${fmtSig(u.ppm, 2)} ppm`, disabled: none } },
  ];
}

function Chain({ chain, f }: { chain: ChainStep[]; f: number }) {
  const narrow = f > 1.3;
  const n = chain.length;
  if (!narrow) {
    const gap = n === 3 ? 120 : 64;
    const w = (796 - (n - 1) * gap) / n;
    const y = 18;
    const h = 92;
    return (
      <g>
        {chain.map((c, i) => {
          const x = 2 + i * (w + gap);
          const b = c.box;
          return (
            <g key={i} opacity={b.disabled ? 0.5 : 1}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={12}
                fill={b.measured ? mixColor(VIZ.surface, VIZ.series[0], 0.08) : VIZ.surface}
                stroke={b.measured ? VIZ.series[0] : VIZ.muted}
                strokeWidth={b.measured ? 2.5 : 1.5}
                strokeDasharray={b.disabled ? '6 5' : undefined}
              />
              <Txt x={x + w / 2} y={y + 28} size={n === 3 ? 0.8 : 0.74} muted>
                {b.title}
              </Txt>
              <Txt x={x + w / 2} y={y + 64} size={n === 3 ? 1.05 : 0.9} weight={700} color={b.measured ? VIZ.series[0] : undefined}>
                {b.value}
              </Txt>
              {c.op && (
                <g>
                  <line x1={x + w + 6} y1={y + h / 2} x2={x + w + gap - 16} y2={y + h / 2} stroke={VIZ.ink} strokeWidth={2} />
                  <polygon points={`${x + w + gap - 6},${y + h / 2} ${x + w + gap - 16},${y + h / 2 - 6} ${x + w + gap - 16},${y + h / 2 + 6}`} fill={VIZ.ink} />
                  <Txt x={x + w + gap / 2} y={y + h / 2 - 10} size={0.8} weight={700}>
                    {c.op.label}
                  </Txt>
                  <Txt x={x + w + gap / 2} y={y + h + 26} size={0.7} muted>
                    {c.op.detail}
                  </Txt>
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  }
  const bh = 62 * f;
  const gap = 42 * f;
  const x = 30;
  const w = 740;
  return (
    <g>
      {chain.map((c, i) => {
        const y = 8 + i * (bh + gap);
        const b = c.box;
        return (
          <g key={i} opacity={b.disabled ? 0.5 : 1}>
            <rect
              x={x}
              y={y}
              width={w}
              height={bh}
              rx={12}
              fill={b.measured ? mixColor(VIZ.surface, VIZ.series[0], 0.08) : VIZ.surface}
              stroke={b.measured ? VIZ.series[0] : VIZ.muted}
              strokeWidth={b.measured ? 2.5 : 1.5}
              strokeDasharray={b.disabled ? '6 5' : undefined}
            />
            <Txt x={x + 16} y={y + bh / 2 + 6 * f} anchor="start" size={0.8} muted>
              {b.title}
            </Txt>
            <Txt x={x + w - 16} y={y + bh / 2 + 6 * f} anchor="end" size={0.95} weight={700} color={b.measured ? VIZ.series[0] : undefined}>
              {b.value}
            </Txt>
            {c.op && (
              <g>
                <line x1={x + 70} y1={y + bh + 4} x2={x + 70} y2={y + bh + gap - 14} stroke={VIZ.ink} strokeWidth={2} />
                <polygon points={`${x + 70},${y + bh + gap - 4} ${x + 64},${y + bh + gap - 14} ${x + 76},${y + bh + gap - 14}`} fill={VIZ.ink} />
                <Txt x={x + 92} y={y + bh + gap / 2 + 6 * f} anchor="start" size={0.8} weight={700}>
                  {c.op.label}
                </Txt>
                <Txt x={x + 92 + 120 * f} y={y + bh + gap / 2 + 6 * f} anchor="start" size={0.72} muted>
                  {c.op.detail}
                </Txt>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Figur 2: logaritmisk skala med grenseverdier ---------- */

function scaleHeight(p: Pollutant, f: number): number {
  return Math.round(70 * f + 26 + 6 * f + (54 + (p.limits.length - 1) * 26) * f + 44 * f + 12);
}

/** Fargen til en måling: rød over den viktigste grensen, gul over en annen grense, ellers serie 0. */
function valueColor(p: Pollutant, value: number): string {
  if (value > p.limits[0]!.value) return BAD;
  if (p.limits.some((l) => value > l.value)) return AMBER;
  return VIZ.series[0]!;
}

function LimitScale({ p, value, f }: { p: Pollutant; value: number; f: number }) {
  const H = scaleHeight(p, f);
  // Luft til akseverdiene i endene (de vokser på mobil)
  const X0 = 20 + 20 * f;
  const X1 = 780 - 22 * f;
  const e0 = Math.floor(Math.log10(p.min));
  const e1 = Math.ceil(Math.log10(p.max));
  const sx = scaleLinear([e0, e1], [X0, X1]);
  const lx = (v: number) => sx(Math.log10(v));
  const main = p.limits[0]!;
  const sorted = [...p.limits].sort((a, b) => a.value - b.value);
  const xLow = lx(sorted[0]!.value);
  const xHigh = lx(sorted[sorted.length - 1]!.value);
  const barY = 70 * f;
  const barH = 26 + 6 * f;
  const xv = lx(value);
  const ratio = limitRatio(value, main);
  const ticks: number[] = [];
  for (let e = e0; e <= e1; e++) ticks.push(e);
  const step = f > 1.3 && ticks.length > 5 ? 2 : 1;
  const tickText = (e: number) => (e >= 0 && e <= 3 ? fmt(10 ** e, 0) : e < 0 && e >= -2 ? fmt(10 ** e, -e) : `10${superscript(e)}`);
  const unitLabel = p.unit;
  const color = valueColor(p, value);
  // Etiketten til målingen står over skalaen, grenseverdiene under
  const valueText = `målt: ${fmtSig(value, 2)} ${unitLabel}`;
  const valW = valueText.length * 0.56 * 17 * f * 0.95;
  const vAnchor = xv + valW / 2 > 790 ? 'end' : xv - valW / 2 < 10 ? 'start' : 'middle';
  const factor =
    ratio >= 1 ? `${fmtSig(ratio, 2)} ganger grenseverdien (${main.label})` : `grenseverdien (${main.label}) er ${fmtSig(1 / ratio, 2)} ganger så høy`;
  const textW = (t: string) => t.length * 0.56 * 17 * f * 0.8;
  // Grenseverdiene: den laveste på første rad, den høyeste på neste. Streken til den laveste stopper på første rad, så
  // etiketten på andre rad aldri krysses; etiketten på første rad står til venstre for streken når den får plass.
  const labels = sorted.map((l, i) => {
    const x = lx(l.value);
    const text = `${formatLimit(l.value)} ${unitLabel} (${l.label})`;
    const w = textW(text);
    const y = barY + barH + (54 + i * 26) * f;
    let anchor: 'start' | 'end';
    if (sorted.length === 1) anchor = x < 400 ? 'start' : 'end';
    else if (i === 0) anchor = x - 6 - w > 4 ? 'end' : 'start';
    else anchor = x + 6 + w < 796 ? 'start' : 'end';
    return { l, x, y, text, anchor, main: l === main };
  });
  return (
    <g>
      {/* Under den laveste grensen, mellom grensene og over den høyeste */}
      <rect x={X0} y={barY} width={Math.max(0, xLow - X0)} height={barH} fill={mixColor(VIZ.surface, GOOD, 0.35)} />
      {xHigh > xLow && <rect x={xLow} y={barY} width={xHigh - xLow} height={barH} fill={mixColor(VIZ.surface, AMBER, 0.4)} />}
      <rect x={xHigh} y={barY} width={Math.max(0, X1 - xHigh)} height={barH} fill={mixColor(VIZ.surface, BAD, 0.35)} />
      <rect x={X0} y={barY} width={X1 - X0} height={barH} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      {ticks.map((e) => (
        <g key={e}>
          <line x1={sx(e)} y1={barY + barH} x2={sx(e)} y2={barY + barH + 7} className="viz-axis" />
          {(e - e0) % step === 0 && (
            <text x={sx(e)} y={barY + barH + 26 * f} textAnchor="middle" className="viz-tick">
              {tickText(e)}
            </text>
          )}
        </g>
      ))}

      {labels.map((b) => (
        <g key={b.l.label}>
          <line x1={b.x} y1={barY - 8} x2={b.x} y2={b.y - 16 * f} stroke={VIZ.ink} strokeWidth={b.main ? 2.5 : 1.5} strokeDasharray={b.main ? undefined : '5 4'} />
          <Txt x={b.anchor === 'start' ? b.x + 6 : b.x - 6} y={b.y} anchor={b.anchor} size={0.8} weight={b.main ? 700 : 500} muted={!b.main}>
            {b.text}
          </Txt>
        </g>
      ))}

      {/* Målingen */}
      <line x1={xv} y1={barY - 4} x2={xv} y2={barY + barH + 4} stroke={color} strokeWidth={4} />
      <polygon points={`${xv - 8},${barY - 14} ${xv + 8},${barY - 14} ${xv},${barY - 3}`} fill={color} />
      <Txt x={vAnchor === 'end' ? Math.min(xv + 8, 790) : vAnchor === 'start' ? Math.max(xv - 8, 10) : xv} y={barY - 22} anchor={vAnchor} size={0.95} weight={700} color={color}>
        {valueText}
      </Txt>
      <Txt x={400} y={barY - 22 - 28 * f} size={0.8} muted>
        {factor}
      </Txt>
      <Txt x={400} y={H - 10} size={0.8} muted>
        konsentrasjon i {unitLabel} (logaritmisk skala)
      </Txt>
    </g>
  );
}

/* ---------- Utregning ---------- */

function formulaLines(p: Pollutant, value: number, M: number | null): ReactNode {
  const F = p.formula ? <Formel f={p.formula} /> : null;
  if (p.medium === 'vann') {
    const u = waterUnits(value, p.unit, M ?? 1);
    return (
      <>
        {p.unit === 'µg/L' && (
          <FormulaLine>
            {fmtSig(value, 2)} µg/L = {fmtSig(u.mgPerL, 2)} mg/L
          </FormulaLine>
        )}
        <FormulaLine>
          c = {fmtSig(u.mgPerL, 2)} mg/L = {fmtSig(u.mgPerL / 1000, 2)} g/L, n per liter = {fmtSig(u.mgPerL / 1000, 2)} g / {fmt(M ?? NaN, 2)} g/mol ={' '}
          {fmtSig(u.molPerL, 2)} mol/L
        </FormulaLine>
        <FormulaLine>
          1 L vann ≈ 1 kg: {fmtSig(u.mgPerL, 2)} mg/L ≈ {fmtSig(u.ppm, 2)} mg/kg = {fmtSig(u.ppm, 2)} ppm = {fmtSig(u.ppb, 2)} ppb
        </FormulaLine>
        {F && (
          <FormulaLine>
            M({F}) = {fmt(M ?? NaN, 2)} g/mol
          </FormulaLine>
        )}
      </>
    );
  }
  const u = airUnits(value, p.unit, M);
  if (M === null)
    return (
      <>
        <FormulaLine>Svevestøv har ingen molar masse, så bare masse per volum gir mening:</FormulaLine>
        <FormulaLine>
          {fmtSig(u.ugPerM3, 2)} µg/m³ = {fmtSig(u.ugPerM3 / 1000, 2)} mg/m³
        </FormulaLine>
      </>
    );
  return (
    <>
      {p.unit === 'mg/m³' && (
        <FormulaLine>
          {fmtSig(value, 2)} mg/m³ = {fmtSig(u.ugPerM3, 2)} µg/m³
        </FormulaLine>
      )}
      <FormulaLine>
        n per m³ = {fmtSig(u.ugPerM3, 2)} µg / {fmt(M, 2)} g/mol = {fmtSig(u.umolPerM3, 2)} µmol (i 1 m³ = 1000 L luft)
      </FormulaLine>
      <FormulaLine>
        V(gass) = n · V<Sub>m</Sub> = {fmtSig(u.umolPerM3, 2)} µmol · {fmt(V_M, 1)} L/mol = {fmtSig(u.ppb, 2)} µL per m³ = {fmtSig(u.ppb, 2)} nL per L
      </FormulaLine>
      <FormulaLine>
        Volumandel = {fmtSig(u.ppb, 2)} ppb = {fmtSig(u.ppm, 2)} ppm
      </FormulaLine>
    </>
  );
}

/* ---------- Forklaring ---------- */

function explanation(p: Pollutant, value: number, M: number | null): ReactNode {
  const main = p.limits[0]!;
  const ratio = limitRatio(value, main);
  const st = limitStatus(ratio);
  const name = p.formula ? (
    <>
      {p.name} (<Formel f={p.formula} />)
    </>
  ) : (
    <>{p.name}</>
  );
  const v = `${fmtSig(value, 2)} ${p.unit}`;
  const lim = `${formatLimit(main.value)} ${p.unit}`;
  const verdict =
    st === 'over' ? (
      <>
        <strong>
          {v} er over grenseverdien ({lim}, {main.label}).
        </strong>{' '}
        Konsentrasjonen er {fmtSig(ratio, 2)} ganger grenseverdien.
      </>
    ) : st === 'nær' ? (
      <>
        <strong>{v} er {ratio >= 0.995 ? 'akkurat på' : 'like under'} grenseverdien</strong> ({lim}, {main.label}): {fmt(ratio * 100, 0)} % av grensen.
      </>
    ) : (
      <>
        <strong>
          {v} er {st === 'langt under' ? 'langt under' : 'under'} grenseverdien
        </strong>{' '}
        ({lim}, {main.label}): {fmt(ratio * 100, ratio < 0.1 ? 1 : 0)} % av grensen.
      </>
    );
  const second = p.limits[1];
  const units =
    p.medium === 'vann' ? (
      <>
        I vann er ppm og ppb masseandeler: 1 ppm er 1 mg stoff per kg løsning. Fordi 1 L vann veier omtrent 1 kg, er {fmtSig(value, 2)} {p.unit} det samme
        som {p.unit === 'mg/L' ? `${fmtSig(value, 2)} ppm` : `${fmtSig(value, 2)} ppb`}. Stoffmengdekonsentrasjonen (mol/L) får du ved å dele massen på den
        molare massen{M ? `, ${fmt(M, 2)} g/mol` : ''}.
      </>
    ) : M === null ? (
      <>
        Svevestøv (PM10 og PM2,5 er partikler mindre enn 10 og 2,5 µm) er ikke ett stoff, så det har ingen molar masse og kan ikke regnes om til ppm. Det
        måles alltid som masse per volum luft, µg/m³.
      </>
    ) : (
      <>
        I luft er ppm og ppb volumandeler, ikke masseandeler: {fmtSig(value, 2)} {p.unit} <Formel f={p.formula!} /> er {fmtSig(airUnits(value, p.unit, M).ppb, 2)} ppb.
        Samme volumandel gir ulik masse for ulike gasser, fordi massen avhenger av den molare massen ({fmt(M, 2)} g/mol her).
      </>
    );
  return (
    <>
      <p>
        {verdict}
        {second &&
          (value <= second.value ? (
            <>
              {' '}
              Den er også under grensen for {second.label} ({formatLimit(second.value)} {p.unit}). Grenseverdier gjelder et gjennomsnitt over en bestemt tid.
            </>
          ) : st === 'over' ? (
            <>
              {' '}
              Den er også over grensen for {second.label} ({formatLimit(second.value)} {p.unit}). Grenseverdier gjelder et gjennomsnitt over en bestemt tid, så
              en enkelt måling må sammenlignes med grensen for riktig midlingstid.
            </>
          ) : (
            <>
              {' '}
              Men verdien er over grensen for {second.label} ({formatLimit(second.value)} {p.unit}): er dette gjennomsnittet for hele perioden, er den grensen
              overskredet. Grenseverdier gjelder alltid et gjennomsnitt over en bestemt tid, så en enkelt måling må sammenlignes med riktig grense.
            </>
          ))}
      </p>
      <p>{units}</p>
      <p>
        Kilder til {name}: {p.origin}.
      </p>
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
