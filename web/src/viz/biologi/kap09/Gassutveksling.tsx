import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  Mitokondrie,
  Plot,
  Readout,
  Readouts,
  RodtBlodlegeme,
  Slider,
  Sub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  roundedRectPath,
  sample,
  useContainerTextScale,
  useLineScale,
  type BioPaint,
} from '../kit';
import {
  HB,
  O2_PER_G_HB,
  P50_STANDARD,
  TISSUE_PRESETS,
  airPressure,
  capillaryPO2,
  gasExchange,
  saturation,
  type GasExchange,
} from './model';

const RED = BIO.oksygenrikt;
const BLUE = BIO.oksygenfattig;
const O2C = BIO.serie[0];
const CO2C = BIO.serie[1];
const TISSUE_C = BIO.serie[3];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Fargen på blodet ved metningen S (blått → rødt). */
const bloodColor = (S: number) => mixColor(BLUE, RED, Math.min(1, Math.max(0, (S - 0.2) / 0.78)));

const ALTITUDES = [
  { value: 'hav', label: 'Havnivå', h: 0 },
  { value: 'galdhopiggen', label: 'Galdhøpiggen', h: 2469 },
  { value: 'everest', label: 'Mount Everest', h: 8849 },
] as const;

export default function Gassutveksling() {
  const [PO2, setPO2] = useState(TISSUE_PRESETS.hvile.PO2);
  const [pH, setPH] = useState(TISSUE_PRESETS.hvile.pH);
  const [T, setT] = useState(TISSUE_PRESETS.hvile.T);
  const [h, setH] = useState(0);
  const g = gasExchange(h, { PO2, pH, T });
  const tissuePreset =
    (Object.keys(TISSUE_PRESETS) as (keyof typeof TISSUE_PRESETS)[]).find((k) => {
      const p = TISSUE_PRESETS[k];
      return Math.abs(p.PO2 - PO2) < 1e-9 && Math.abs(p.pH - pH) < 1e-9 && Math.abs(p.T - T) < 1e-9;
    }) ?? null;
  const altPreset = ALTITUDES.find((a) => a.h === h)?.value ?? null;

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Vev"
          options={(Object.keys(TISSUE_PRESETS) as (keyof typeof TISSUE_PRESETS)[]).map((k) => ({
            value: k,
            label: TISSUE_PRESETS[k].name,
          }))}
          value={tissuePreset}
          onPick={(k) => {
            const p = TISSUE_PRESETS[k];
            setPO2(p.PO2);
            setPH(p.pH);
            setT(p.T);
          }}
        />
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              O<Sub>2</Sub>-trykk i vevet
            </>
          }
          ariaLabel="Oksygentrykk i vevet"
          value={PO2}
          onChange={setPO2}
          min={1}
          max={8}
          step={0.1}
          unit="kPa"
          decimals={1}
        />
        <Slider label="pH i vevet" value={pH} onChange={setPH} min={6.9} max={7.6} step={0.01} decimals={2} />
        <Slider label="Temperatur i vevet" value={T} onChange={setT} min={35} max={42} step={0.5} unit="°C" decimals={1} />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Høyde"
          options={ALTITUDES.map((a) => ({ value: a.value, label: a.label, detail: `${fmt(a.h, 0)} moh.` }))}
          value={altPreset}
          onPick={(v) => setH(ALTITUDES.find((a) => a.value === v)!.h)}
        />
      </Toolbar>
      <Controls>
        <Slider label="Høyde over havet" value={h} onChange={setH} min={0} max={8849} step={1} unit="m" />
      </Controls>

      <ExchangeFigure g={g} />
      <Legend
        items={[
          { color: O2C, label: 'O₂ diffunderer' },
          { color: CO2C, label: 'CO₂ diffunderer' },
          { color: RED, label: 'Blod med mye O₂' },
          { color: BLUE, label: 'Blod med lite O₂' },
        ]}
      />

      <CurveFigure g={g} />
      <Legend
        items={[
          { color: RED, label: `Metningskurve i lungene (pH ${fmt(g.pHa, 2)}, 37 °C)` },
          { color: TISSUE_C, label: `Metningskurve i vevet (pH ${fmt(pH, 2)}, ${fmt(T, 1)} °C)`, dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Metning, blod fra lungene" value={fmtPct(g.SaO2, 1)} tone={RED} />
        <Readout label="Metning, blod fra vevet" value={fmtPct(g.SvO2, 0)} tone={BLUE} />
        <Readout label="O₂ avgitt til vevet" value={fmt(g.released, 0)} unit="mL per liter blod" tone={TISSUE_C} />
        <Readout label="P50 i vevet" value={fmt(g.p50Tissue, 2)} unit="kPa" />
      </Readouts>

      <Formula label="Oksygen i blodet">
        <FormulaLine>
          O<Sub>2</Sub> avgitt ≈ {fmt(O2_PER_G_HB, 2)} mL/g · {HB} g/L · ({fmtPct(g.SaO2, 1)} − {fmtPct(g.SvO2, 1)}) = {fmt(g.released, 0)}{' '}
          mL per liter blod
        </FormulaLine>
        <FormulaLine>Uten Bohr-effekten (samme kurve som i lungene): {fmt(g.releasedNoBohr, 0)} mL per liter blod</FormulaLine>
        <FormulaLine>
          Lufttrykk {fmt(airPressure(h), 1)} kPa · O<Sub>2</Sub> i alveolene {fmt(g.PAO2, 1)} kPa · P50 = {fmt(g.p50Tissue, 2)} kPa i vevet
          (normalt {fmt(P50_STANDARD, 1)} kPa)
        </FormulaLine>
        {g.PvO2 < PO2 - 0.05 && (
          <FormulaLine>
            Vevet trenger {fmt(g.demand, 0)} mL O<Sub>2</Sub> per liter blod: O<Sub>2</Sub>-trykket i vevet faller fra {fmt(PO2, 1)} til{' '}
            {fmt(g.PvO2, 1)} kPa{g.limited ? ', og det er likevel ikke nok' : ''}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(g, h, PO2, pH, T)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Lungene og vevet                                                         */
/* ====================================================================== */

function ExchangeFigure({ g }: { g: GasExchange }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const panelW = narrow ? 780 : 385;
  // Lungepanelet trenger plass til alveolen, kapillæren og to linjer med tall under den
  const alvR = narrow ? 120 : 100;
  const need = 2 * alvR + 12 + 34 * Math.min(1.4, k) + 20 * Math.min(1.3, k) + 46 * f + 18;
  const panelH = Math.round(Math.max(narrow ? 0 : 300, need));
  const head = 28 * f;
  const panels = [
    { x: 10, y: 0 },
    { x: narrow ? 10 : 405, y: narrow ? panelH + head + 16 : 0 },
  ];
  const H = Math.round(narrow ? 2 * (panelH + head) + 16 : panelH + head);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 1300 : Math.round(H * 1.15)}
        label={`Gassutveksling. I lungene: O₂ ${fmt(g.PAO2, 1)} kPa i alveolene, blodet blir ${fmtPct(g.SaO2)} mettet. I vevet: O₂ ${fmt(g.PvO2, 1)} kPa, blodet går ut ${fmtPct(g.SvO2)} mettet.`}
        caption="Tallene er partialtrykk i kPa. Gassene diffunderer fra høyt til lavt partialtrykk."
      >
        <LungPanel x={panels[0]!.x} y={panels[0]!.y} w={panelW} h={panelH} head={head} g={g} f={f} k={k} lw={lw} alvR={alvR} />
        <TissuePanel x={panels[1]!.x} y={panels[1]!.y} w={panelW} h={panelH} head={head} g={g} f={f} k={k} lw={lw} />
      </Figure>
    </div>
  );
}

interface PanelProps {
  x: number;
  y: number;
  w: number;
  h: number;
  head: number;
  g: GasExchange;
  f: number;
  k: number;
  lw: number;
}

/** Kapillær med røde blodlegemer der fargen viser metningen langs kapillæren. */
function Capillary({
  x0,
  x1,
  y,
  hh,
  S,
  k,
  lw,
}: {
  x0: number;
  x1: number;
  y: number;
  hh: number;
  S: (u: number) => number;
  k: number;
  lw: number;
}) {
  const n = 6;
  return (
    <g>
      <path
        d={roundedRectPath(x0, y - hh / 2, x1 - x0, hh, hh / 2)}
        fill={mixColor(BIO.vannFyll, RED, 0.12)}
        stroke={BIO.oksygenrikt}
        strokeWidth={1.4 * lw}
        strokeOpacity={0.6}
      />
      {Array.from({ length: n }, (_, i) => {
        const u = (i + 0.5) / n;
        const c = bloodColor(S(u));
        const paint: BioPaint = { fill: c, line: c };
        return <RodtBlodlegeme key={i} x={x0 + (x1 - x0) * u} y={y} size={Math.min(hh * 0.9, 34 * Math.min(1.3, k))} paint={paint} />;
      })}
    </g>
  );
}

function LungPanel({ x, y, w, h, head, g, f, k, lw, alvR }: PanelProps & { alvR: number }) {
  const cy = y + head;
  const ax = x + w / 2;
  const ay = cy + alvR + 12;
  const capY = ay + alvR + 34 * Math.min(1.4, k);
  const hh = 40 * Math.min(1.3, k);
  const x0 = x + 20;
  const x1 = x + w - 20;
  const Pv = g.PvO2;
  const S = (u: number) => saturation(capillaryPO2(u, Pv, g.PaO2), g.p50Lung);
  const dO2 = Math.max(0, g.PAO2 - Pv);
  const dCO2 = Math.max(0, g.PvCO2 - g.PACO2);
  return (
    <g>
      <Txt x={x + 8} y={y + head - 8} anchor="start" weight={700}>
        I lungene
      </Txt>
      {/* Alveolen */}
      <circle cx={ax} cy={ay} r={alvR} fill={BIO.vannFyll} stroke={BIO.membran} strokeWidth={2.2 * lw} />
      <Txt x={ax} y={ay - alvR * 0.42} weight={650} size={0.85}>
        Alveole (luft)
      </Txt>
      <Txt x={ax} y={ay - alvR * 0.42 + 24 * f} size={0.85} color={O2C} weight={700}>
        {`O₂ ${fmt(g.PAO2, 1)}`}
      </Txt>
      <Txt x={ax} y={ay - alvR * 0.42 + 46 * f} size={0.85} color={CO2C} weight={700}>
        {`CO₂ ${fmt(g.PACO2, 1)}`}
      </Txt>
      {/* Diffusjon */}
      {[0.32, 0.5].map((u, i) => (
        <Arrow
          key={`o${i}`}
          x1={x0 + (x1 - x0) * u}
          y1={ay + alvR * 0.55}
          x2={x0 + (x1 - x0) * u}
          y2={capY - hh / 2 - 4}
          color={O2C}
          width={Math.min(10, 1.5 + dO2 * 0.9 * (i === 0 ? 1 : 0.4))}
          head={11}
        />
      ))}
      <Arrow
        x1={x0 + (x1 - x0) * 0.68}
        y1={capY - hh / 2 - 4}
        x2={x0 + (x1 - x0) * 0.68}
        y2={ay + alvR * 0.55}
        color={CO2C}
        width={Math.min(10, 1.5 + dCO2 * 2)}
        head={11}
      />
      <Capillary x0={x0} x1={x1} y={capY} hh={hh} S={S} k={k} lw={lw} />
      <Txt x={x0} y={capY + hh / 2 + 24 * f} anchor="start" size={0.75} color={BLUE} weight={650}>
        {`inn: O₂ ${fmt(Pv, 1)}`}
      </Txt>
      <Txt x={x1} y={capY + hh / 2 + 24 * f} anchor="end" size={0.75} color={RED} weight={650}>
        {`ut: O₂ ${fmt(g.PaO2, 1)}`}
      </Txt>
      <Txt x={x0} y={capY + hh / 2 + 46 * f} anchor="start" size={0.75} color={CO2C}>
        {`CO₂ ${fmt(g.PvCO2, 1)}`}
      </Txt>
      <Txt x={x1} y={capY + hh / 2 + 46 * f} anchor="end" size={0.75} color={CO2C}>
        {`CO₂ ${fmt(g.PACO2, 1)}`}
      </Txt>
      <rect x={x} y={cy} width={w} height={h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
    </g>
  );
}

function TissuePanel({ x, y, w, h, head, g, f, k, lw }: PanelProps) {
  const cy = y + head;
  const hh = 40 * Math.min(1.3, k);
  const capY = cy + 30 + hh / 2 + 22 * f;
  const x0 = x + 20;
  const x1 = x + w - 20;
  // O₂-trykket faller jevnt langs kapillæren fra arterieblodet til veneblodet
  const P = (u: number) => g.PaO2 + (g.PvO2 - g.PaO2) * Math.min(1, u * 1.2);
  const S = (u: number) => saturation(P(u), u < 0.15 ? g.p50Lung : g.p50Tissue);
  const cellTop = capY + hh / 2 + 70 * Math.min(1.3, f);
  const cellH = cy + h - 12 - cellTop;
  const cells = [0.25, 0.75].map((u) => ({ x: x + 14 + (w - 28) * u, w: (w - 28) / 2 - 10 }));
  const dO2 = Math.max(0, g.PaO2 - g.PvO2);
  return (
    <g>
      <Txt x={x + 8} y={y + head - 8} anchor="start" weight={700}>
        I vevet (f.eks. en muskel)
      </Txt>
      <Capillary x0={x0} x1={x1} y={capY} hh={hh} S={S} k={k} lw={lw} />
      <Txt x={x0} y={capY - hh / 2 - 10} anchor="start" size={0.75} color={RED} weight={650}>
        {`inn: O₂ ${fmt(g.PaO2, 1)}`}
      </Txt>
      <Txt x={x1} y={capY - hh / 2 - 10} anchor="end" size={0.75} color={BLUE} weight={650}>
        {`ut: O₂ ${fmt(g.PvO2, 1)}`}
      </Txt>
      {cells.map((c, i) => (
        <g key={i}>
          <path
            d={roundedRectPath(c.x - c.w / 2, cellTop, c.w, cellH, 12)}
            fill={BIO.cytoplasma}
            stroke={BIO.membran}
            strokeWidth={2 * lw}
          />
          <Mitokondrie
            x={c.x - c.w * 0.18}
            y={cellTop + cellH * 0.62}
            w={Math.min(70, c.w * 0.38)}
            h={Math.min(30, cellH * 0.3)}
            rotate={-12}
          />
          <Mitokondrie
            x={c.x + c.w * 0.22}
            y={cellTop + cellH * 0.38}
            w={Math.min(70, c.w * 0.38)}
            h={Math.min(30, cellH * 0.3)}
            rotate={15}
          />
        </g>
      ))}
      {(() => {
        const c0 = cells[0]!;
        return (
          <g>
            <Txt x={c0.x - c0.w / 2 + 12} y={cellTop + 22 * f} anchor="start" size={0.75} muted>
              Celleånding
            </Txt>
            <Txt x={c0.x - c0.w / 2 + 12} y={cellTop + 42 * f} anchor="start" size={0.75} muted>
              bruker O₂
            </Txt>
          </g>
        );
      })()}
      {[0.25, 0.5].map((u, i) => (
        <Arrow
          key={i}
          x1={x0 + (x1 - x0) * u}
          y1={capY + hh / 2 + 4}
          x2={x0 + (x1 - x0) * u}
          y2={cellTop - 4}
          color={O2C}
          width={Math.min(10, 1.5 + dO2 * 0.9 * (i === 0 ? 1 : 0.6))}
          head={11}
        />
      ))}
      <Arrow
        x1={x0 + (x1 - x0) * 0.75}
        y1={cellTop - 4}
        x2={x0 + (x1 - x0) * 0.75}
        y2={capY + hh / 2 + 4}
        color={CO2C}
        width={Math.min(10, 1.5 + (g.PvCO2 - 4) * 2)}
        head={11}
      />
      <Txt x={x0 + (x1 - x0) * 0.75 + 10} y={(capY + hh / 2 + cellTop) / 2 + 5} anchor="start" size={0.75} color={CO2C} weight={650}>
        {`CO₂ ${fmt(g.PvCO2, 1)}`}
      </Txt>
      <rect x={x} y={cy} width={w} height={h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
    </g>
  );
}

/* ====================================================================== */
/* Metningskurven                                                           */
/* ====================================================================== */

function CurveFigure({ g }: { g: GasExchange }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(340 + 260 * (f - 1));
  const lung = sample((P) => saturation(P, g.p50Lung) * 100, 0, 14, 160);
  const tissue = sample((P) => saturation(P, g.p50Tissue) * 100, 0, 14, 160);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Hemoglobinets metningskurve. Arterieblod ${fmtPct(g.SaO2)} mettet, veneblod ${fmtPct(g.SvO2)} mettet.`}
      >
        <Plot
          x={{ min: 0, max: 14, label: 'O₂-trykk (kPa)', ticks: [0, 2, 4, 6, 8, 10, 12, 14] }}
          y={{ min: 0, max: 100, label: 'Metning av hemoglobin (%)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, x0, y0 }) => {
            const ax = sx(g.PaO2);
            const ay = sy(g.SaO2 * 100);
            const vx = sx(g.PvO2);
            const vy = sy(g.SvO2 * 100);
            return (
              <g>
                <line x1={x0} x2={sx(14)} y1={sy(50)} y2={sy(50)} stroke={VIZ.muted} strokeWidth={1} strokeDasharray="3 5" />
                <path d={linePath(lung, sx, sy)} fill="none" stroke={RED} strokeWidth={3.2} />
                <path d={linePath(tissue, sx, sy)} fill="none" stroke={TISSUE_C} strokeWidth={3} strokeDasharray="8 6" />
                {/* P50 */}
                <line x1={sx(g.p50Lung)} x2={sx(g.p50Lung)} y1={sy(50)} y2={y0} stroke={RED} strokeWidth={1.2} strokeDasharray="3 4" />
                <line
                  x1={sx(g.p50Tissue)}
                  x2={sx(g.p50Tissue)}
                  y1={sy(50)}
                  y2={y0}
                  stroke={TISSUE_C}
                  strokeWidth={1.2}
                  strokeDasharray="3 4"
                />
                <Txt x={sx(Math.max(g.p50Lung, g.p50Tissue)) + 8} y={sy(50) + 18 * f} anchor="start" size={0.75} muted>
                  P50
                </Txt>
                {/* Avgitt O₂ */}
                <line x1={vx} x2={vx} y1={ay} y2={vy} stroke={TISSUE_C} strokeWidth={4} opacity={0.5} />
                <line x1={vx - 8} x2={ax} y1={ay} y2={ay} stroke={RED} strokeWidth={1.4} strokeDasharray="4 4" />
                <Txt
                  x={vx - 10 - 10 * 0.58 * 17 * 0.85 * f > x0 + 4 ? vx - 10 : vx + 10}
                  y={(ay + vy) / 2 + 5}
                  anchor={vx - 10 - 10 * 0.58 * 17 * 0.85 * f > x0 + 4 ? 'end' : 'start'}
                  size={0.85}
                  weight={700}
                  color={TISSUE_C}
                >
                  {`avgitt ${fmtPct(g.SaO2 - g.SvO2)}`}
                </Txt>
                <circle cx={ax} cy={ay} r={8} fill={RED} stroke={VIZ.surface} strokeWidth={2.5} />
                <circle cx={vx} cy={vy} r={8} fill={BLUE} stroke={VIZ.surface} strokeWidth={2.5} />
                <Txt x={ax - 12} y={ay - 12} anchor="end" size={0.8} weight={650} color={RED}>
                  lungene
                </Txt>
                <Txt x={vx + 12} y={vy + 22 * f} anchor="start" size={0.8} weight={650} color={BLUE}>
                  vevet
                </Txt>
              </g>
            );
          }}
        </Plot>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(g: GasExchange, h: number, PO2: number, pH: number, T: number): ReactNode {
  const shifted = g.p50Tissue > g.p50Lung + 0.15;
  const gain = g.released - g.releasedNoBohr;
  const diffusion = (
    <p>
      <strong>Diffusjon etter partialtrykk.</strong> I alveolene er O<Sub>2</Sub>-trykket {fmt(g.PAO2, 1)} kPa, mens blodet som kommer fra
      kroppen har {fmt(g.PvO2, 1)} kPa. O<Sub>2</Sub> diffunderer derfor fra luften gjennom de tynne veggene i alveolen og kapillæren og inn
      i blodet, der det bindes til hemoglobin i de røde blodlegemene. CO<Sub>2</Sub> går motsatt vei, fra blodet ({fmt(g.PvCO2, 1)} kPa) til
      alveolene ({fmt(g.PACO2, 1)} kPa). I vevet snur forskjellene: cellene bruker O<Sub>2</Sub> i celleåndingen og lager CO<Sub>2</Sub>.
    </p>
  );
  const causes = [pH < 7.36 ? 'lav pH (mer CO₂, som gir karbonsyre, og melkesyre)' : null, T > 37.4 ? 'høy temperatur' : null].filter(
    (c): c is string => c !== null,
  );
  const bohr = shifted ? (
    <p>
      <strong>Bohr-effekten.</strong> I vevet er pH {fmt(pH, 2)} og temperaturen {fmt(T, 1)} °C
      {g.pHa > 7.42 ? `, mens blodet i lungene har pH ${fmt(g.pHa, 2)}` : ''}.{' '}
      {causes.length ? `${capitalize(causes.join(' og '))} gjør` : 'Forskjellen i pH mellom lungene og vevet gjør'} at hemoglobinet slipper
      oksygenet lettere i vevet: kurven der ligger mer mot høyre (P50 = {fmt(g.p50Tissue, 2)} kPa i stedet for {fmt(g.p50Lung, 1)} kPa i
      lungene). Blodet avgir {fmt(g.released, 0)} mL O<Sub>2</Sub> per liter, {fmt(Math.max(0, gain), 0)} mL mer enn uten Bohr-effekten.
      Slik får muskler som arbeider hardt, mest oksygen.
    </p>
  ) : g.p50Tissue < g.p50Lung - 0.15 ? (
    <p>
      <strong>Kurven er flyttet mot venstre</strong> (P50 = {fmt(g.p50Tissue, 2)} kPa) fordi pH er høy eller temperaturen lav. Da holder
      hemoglobinet bedre på oksygenet, og vevet får mindre ({fmt(g.released, 0)} mL O<Sub>2</Sub> per liter blod). Det motsatte skjer i
      arbeidende muskler.
    </p>
  ) : (
    <p>
      <strong>Hvilende vev.</strong> Blodet avgir bare en del av oksygenet ({fmtPct(g.extraction)} av det som var bundet), og veneblodet er
      fortsatt omtrent {fmtPct(g.SvO2)} mettet. Det er en reserve: når en muskel arbeider, faller O<Sub>2</Sub>-trykket, pH synker og
      temperaturen stiger, og da avgir hemoglobinet mye mer. Velg «Arbeidende muskel».
    </p>
  );
  const altitude =
    h >= 1500 ? (
      <p>
        <strong>I høyden ({fmt(h, 0)} moh.)</strong> er lufttrykket lavere, så O<Sub>2</Sub>-trykket i alveolene er bare {fmt(g.PAO2, 1)}{' '}
        kPa. Vi puster mer, CO<Sub>2</Sub> faller og blodet blir litt basisk (pH {fmt(g.pHa, 2)}), så kurven i lungene flyttes litt mot
        venstre og hemoglobinet binder O<Sub>2</Sub> lettere.{' '}
        {g.SaO2 > 0.9
          ? `Fordi kurven er flat øverst, er blodet likevel ${fmtPct(g.SaO2)} mettet. Den S-formede kurven beskytter oss.`
          : `Nå er vi på den bratte delen av kurven, og blodet er bare ${fmtPct(g.SaO2)} mettet.`}{' '}
        {g.limited
          ? `Arterieblodet har ikke nok oksygen til at vevet får de ${fmt(g.demand, 0)} mL per liter blod det trenger, så musklene klarer ikke å arbeide like hardt. Derfor bruker fjellklatrere ofte ekstra oksygen på de høyeste toppene.`
          : g.PvO2 < PO2 - 0.05
            ? `For at vevet skal få like mye oksygen som ved havet, må O₂-trykket i vevet falle fra ${fmt(PO2, 1)} til ${fmt(g.PvO2, 1)} kPa.`
            : ''}
      </p>
    ) : (
      <p>
        Kurven er S-formet fordi hemoglobinets fire hemgrupper samarbeider: når ett O<Sub>2</Sub> er bundet, binder de neste lettere. Den
        flate toppen gjør at blodet blir nesten fullt mettet i lungene selv om O<Sub>2</Sub>-trykket varierer litt, og den bratte delen gjør
        at mye oksygen slippes ved de lave trykkene i vevet{PO2 < 3 ? ', som her' : ''}.
      </p>
    );
  return (
    <>
      {diffusion}
      {bohr}
      {altitude}
    </>
  );
}
