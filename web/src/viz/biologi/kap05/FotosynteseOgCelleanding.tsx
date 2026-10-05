import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Celle,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Kloroplast,
  Legend,
  Mitokondrie,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  cellInterior,
  fmt,
  linePath,
  sample,
  useContainerTextScale,
} from '../kit';
import {
  CO2_AIR,
  PS,
  compensationLight,
  grossPhotosynthesis,
  leafExchange,
  limitingFactor,
  respiration,
  saturationLight,
  type Limiting,
} from './model';

type Axis = 'lys' | 'co2' | 'temp';

const AXES: { value: Axis; label: string }[] = [
  { value: 'lys', label: 'Mot lys' },
  { value: 'co2', label: 'Mot CO₂' },
  { value: 'temp', label: 'Mot temperatur' },
];

interface Preset {
  value: string;
  label: string;
  I: number;
  C: number;
  T: number;
}

const PRESETS: Preset[] = [
  { value: 'natt', label: 'Natt', I: 0, C: CO2_AIR, T: 12 },
  { value: 'overskyet', label: 'Overskyet dag', I: 8, C: CO2_AIR, T: 14 },
  { value: 'sol', label: 'Solrik sommerdag', I: 80, C: CO2_AIR, T: 24 },
  { value: 'drivhus', label: 'Drivhus med CO₂', I: 80, C: 1000, T: 24 },
  { value: 'hete', label: 'Hetebølge', I: 100, C: CO2_AIR, T: 40 },
];

/** Farger: fotosyntese grønn (klorofyll), celleånding som mitokondriene, netto mørk. */
const C_PS = BIO.klorofyll;
const C_R = BIO.mitokondrie.line;
const C_NET = VIZ.ink;
const C_O2 = BIO.oksygenrikt;
const C_CO2 = BIO.oksygenfattig;
const C_SUGAR = BIO.sukker;
/** Energi: sollys og ATP. */
const C_ENERGY = BIO.atp;

const LIMIT_TEXT: Record<Limiting, string> = { lys: 'Lys', co2: 'CO₂', temperatur: 'Temperatur' };

export default function FotosynteseOgCelleanding() {
  const [I, setI] = useState(30);
  const [C, setC] = useState(CO2_AIR);
  const [T, setT] = useState(20);
  const [axis, setAxis] = useState<Axis>('lys');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const P = grossPhotosynthesis(I, C, T);
  const R = respiration(T);
  const net = P - R;
  const limit = limitingFactor(I, C, T);
  const Ic = compensationLight(C, T);
  const preset = PRESETS.find((p) => p.I === I && p.C === C && p.T === T)?.value ?? null;
  const plotH = Math.round(320 + 260 * (f - 1));

  return (
    <VizLayout>
      <Controls>
        <Slider label="Lys (% av fullt sollys)" value={I} onChange={setI} min={0} max={100} step={1} unit="%" />
        <Slider label="CO₂ i lufta" value={C} onChange={setC} min={100} max={1500} step={10} unit="ppm" ariaLabel="CO2 i lufta" />
        <Slider label="Temperatur" value={T} onChange={setT} min={0} max={45} step={1} unit="°C" />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Eksempel"
          options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
          value={preset}
          onPick={(v) => {
            const p = PRESETS.find((x) => x.value === v);
            if (!p) return;
            setI(p.I);
            setC(p.C);
            setT(p.T);
          }}
        />
      </Toolbar>

      <div ref={ref}>
        <LeafCell I={I} P={P} R={R} f={f} />
      </div>
      <Legend
        items={[
          { color: C_ENERGY, label: 'Energi: sollys og ATP' },
          { color: C_SUGAR, label: 'Glukose' },
          { color: C_O2, label: 'O₂' },
          { color: C_CO2, label: 'CO₂' },
          { color: BIO.vann, label: 'H₂O' },
        ]}
      />

      <Toolbar>
        <Segmented label="Velg hva grafen viser" options={AXES} value={axis} onChange={setAxis} />
      </Toolbar>
      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Fotosyntese, celleånding og netto O₂-produksjon ${axis === 'lys' ? 'mot lys' : axis === 'co2' ? 'mot CO₂' : 'mot temperatur'}. Nå: fotosyntese ${fmt(P, 0)}, celleånding ${fmt(R, 1)}, netto ${fmt(net, 1)}.`}
        caption="Fartene er i relative enheter: 100 er den største fotosyntesen bladet kan få."
      >
        <RatePlot axis={axis} I={I} C={C} T={T} height={plotH} />
      </Figure>
      <Legend
        items={[
          { color: C_PS, label: 'Fotosyntese (brutto)' },
          { color: C_R, label: 'Celleånding' },
          { color: C_NET, label: 'Netto O₂-produksjon', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Fotosyntese" value={fmt(P, 1)} tone={C_PS} />
        <Readout label="Celleånding" value={fmt(R, 1)} tone={C_R} />
        <Readout label="Netto O₂-produksjon" value={fmt(net, 1)} unit={net < -0.05 ? '(tar opp O₂)' : undefined} />
        <Readout label="Begrensende faktor" value={I === 0 ? 'Lys (mørkt)' : LIMIT_TEXT[limit]} />
      </Readouts>

      <Formula label="Fotosyntese og celleånding">
        <FormulaLine>Fotosyntese (kloroplast): 6 CO₂ + 6 H₂O + lysenergi → C₆H₁₂O₆ + 6 O₂</FormulaLine>
        <FormulaLine>Celleånding (mitokondrie): C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + energi (ATP)</FormulaLine>
        <FormulaLine>
          Netto O₂ = fotosyntese − celleånding = {fmt(P, 1)} − {fmt(R, 1)} = {fmt(net, 1)}
        </FormulaLine>
      </Formula>

      <Explain>{explain(I, C, T, P, R, limit, Ic)}</Explain>
    </VizLayout>
  );
}

/* ---------- Bladcellen ---------- */

/** Pilbredde for en fart (relative enheter): kvadratrot, så små farter også synes. */
const widthOf = (rate: number) => 1.5 + 11 * Math.sqrt(Math.max(0, rate) / 100);

function LeafCell({ I, P, R, f }: { I: number; P: number; R: number; f: number }) {
  const narrow = f > 1.3;
  const top = 26 * f + 30;
  // Stoffbalansen: mitokondrien og kloroplasten bytter min(P, R); bare nettoen går inn og ut av cellen
  const ex = leafExchange(P, R);
  const shared = ex.internal;
  const net = ex.o2Out;
  const surplus = Math.max(0, ex.starch);
  const deficit = Math.max(0, -ex.starch);
  const labelSize = narrow ? 0.72 : 0.78;
  // To oppsett: side om side på PC, kloroplasten over mitokondrien på mobil
  const L = narrow
    ? (() => {
        const box = { x: 150, y: top + 40, w: 500, h: 600 };
        return {
          box,
          K: { x: 400, y: box.y + 150, w: 220, h: 94 },
          M: { x: 400, y: box.y + 430, w: 190, h: 80 },
          starch: { x: 222, y: box.y + 290 },
          H: Math.round(box.y + box.h + 44 + 28 * f),
        };
      })()
    : (() => {
        const box = { x: 140, y: top, w: 520, h: 250 };
        const cy = box.y + box.h / 2;
        return {
          box,
          K: { x: box.x + box.w * 0.27, y: cy, w: 150, h: 64 },
          M: { x: box.x + box.w * 0.73, y: cy, w: 132, h: 54 },
          starch: { x: box.x + box.w * 0.15, y: box.y + box.h - 40 },
          H: Math.round(box.y + box.h + 40 * f + 20),
        };
      })();
  const { box, K, M, starch, H } = L;
  const inner = cellInterior('plante', box, 1);
  const sun = { x: 64, y: top + 6 };
  const rays = 10;
  const w = (rate: number) => widthOf(rate);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1100 : H}
      label={`Bladcelle med kloroplast og mitokondrie. Fotosyntese ${fmt(P, 0)}, celleånding ${fmt(R, 1)}. ${net >= 0 ? 'Cellen gir fra seg O₂' : 'Cellen tar opp O₂'}.`}
      caption="Pilene er bredere jo raskere prosessen går. Kloroplasten og mitokondrien er tegnet mye større enn i virkeligheten."
    >
      {/* Sola: strålene blir lengre og tydeligere med mer lys */}
      <g opacity={I > 0 ? 1 : 0.35}>
        {Array.from({ length: rays }, (_, i) => {
          const a = (i / rays) * Math.PI * 2;
          const r0 = 26;
          const r1 = r0 + 5 + 11 * (I / 100);
          return (
            <line
              key={i}
              x1={sun.x + Math.cos(a) * r0}
              y1={sun.y + Math.sin(a) * r0}
              x2={sun.x + Math.cos(a) * r1}
              y2={sun.y + Math.sin(a) * r1}
              stroke={C_ENERGY}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={I > 0 ? 0.4 + 0.6 * (I / 100) : 0}
            />
          );
        })}
        <circle cx={sun.x} cy={sun.y} r={20} fill={I > 0 ? C_ENERGY : VIZ.grid} opacity={I > 0 ? 0.35 + 0.65 * (I / 100) : 1} />
      </g>
      <Txt x={sun.x} y={sun.y + 46 + 10 * f} size={labelSize} color={I > 0 ? C_ENERGY : undefined} muted={I === 0} weight={650}>
        {I > 0 ? `Lys ${fmt(I, 0)} %` : 'Mørkt'}
      </Txt>

      <Celle type="plante" x={box.x} y={box.y} w={box.w} h={box.h} vakuole={false}>
        <Kloroplast x={K.x} y={K.y} w={K.w} h={K.h} grana={4} />
        <Mitokondrie x={M.x} y={M.y} w={M.w} h={M.h} />
        {/* Stivelseskorn: lager av glukose */}
        <g>
          {[
            [-12, -4, 15],
            [10, -8, 12],
            [2, 9, 13],
          ].map(([dx, dy, r], i) => (
            <ellipse key={i} cx={starch.x + dx!} cy={starch.y + dy!} rx={r!} ry={r! * 0.8} fill={C_SUGAR} fillOpacity={0.35} stroke={C_SUGAR} strokeWidth={1.5} />
          ))}
        </g>
      </Celle>
      <Txt x={starch.x + (narrow ? 0 : 32)} y={narrow ? starch.y + 34 + 10 * f : starch.y + 6 * f} anchor={narrow ? 'middle' : 'start'} size={labelSize} color={C_SUGAR} weight={650}>
        Stivelse
      </Txt>
      {I > 0 && (
        <Arrow
          x1={sun.x + 24}
          y1={sun.y + 10}
          x2={narrow ? K.x - K.w * 0.47 : K.x - K.w * 0.28}
          y2={narrow ? K.y - K.h * 0.3 : K.y - K.h / 2 - 2}
          color={C_ENERGY}
          width={w(I)}
          head={10 + w(I)}
        />
      )}

      {/* Mellom organellene: glukose og O₂ den ene veien, CO₂ og H₂O den andre */}
      {shared > 0.05 &&
        (narrow ? (
          <g>
            <Arrow x1={315} y1={K.y + K.h / 2 + 12} x2={315} y2={M.y - M.h / 2 - 12} color={C_SUGAR} width={w(shared)} head={10 + w(shared)} />
            <Txt x={327 + w(shared) / 2} y={K.y + 100} anchor="start" size={labelSize} color={C_SUGAR} weight={650}>
              glukose
            </Txt>
            <Txt x={327 + w(shared) / 2} y={K.y + 100 + 24 * f} anchor="start" size={labelSize} color={C_SUGAR} weight={650}>
              + O₂
            </Txt>
            <Arrow x1={485} y1={M.y - M.h / 2 - 12} x2={485} y2={K.y + K.h / 2 + 12} color={C_CO2} width={w(shared)} head={10 + w(shared)} />
            <Txt x={473 - w(shared) / 2} y={M.y - M.h / 2 - 66} anchor="end" size={labelSize} color={C_CO2} weight={650}>
              CO₂
            </Txt>
            <Txt x={473 - w(shared) / 2} y={M.y - M.h / 2 - 66 + 24 * f} anchor="end" size={labelSize} color={C_CO2} weight={650}>
              + H₂O
            </Txt>
          </g>
        ) : (
          <g>
            <Arrow x1={K.x + K.w * 0.3} y1={K.y - K.h / 2 - 14} x2={M.x - M.w * 0.3} y2={K.y - K.h / 2 - 14} color={C_SUGAR} width={w(shared)} head={10 + w(shared)} />
            <Txt x={(K.x + M.x) / 2} y={K.y - K.h / 2 - 14 - w(shared) / 2 - 8} size={labelSize} color={C_SUGAR} weight={650}>
              glukose + O₂
            </Txt>
            <Arrow x1={M.x - M.w * 0.3} y1={K.y + K.h / 2 + 14} x2={K.x + K.w * 0.3} y2={K.y + K.h / 2 + 14} color={C_CO2} width={w(shared)} head={10 + w(shared)} />
            <Txt x={(K.x + M.x) / 2} y={K.y + K.h / 2 + 14 + w(shared) / 2 + 20 * f} size={labelSize} color={C_CO2} weight={650}>
              CO₂ + H₂O
            </Txt>
          </g>
        ))}

      {/* Ut og inn av cellen: CO₂ og H₂O til venstre, O₂ til høyre */}
      <Exchange
        x0={10}
        x1={inner.x + 6}
        y={K.y - 26}
        rate={Math.abs(ex.co2In)}
        dir={ex.co2In > 0 ? 'in' : 'out'}
        color={C_CO2}
        label={ex.co2In > 0 ? 'CO₂ inn' : 'CO₂ ut'}
        side="left"
      />
      {/* Vann: som CO₂ kommer resten fra celleåndingen i mitokondrien, så bare nettoen tas inn utenfra */}
      {ex.h2oIn > 0.05 && (
        <Exchange x0={10} x1={K.x - K.w / 2 - 4} y={K.y + 30} rate={ex.h2oIn} dir="in" color={BIO.vann} label="H₂O inn" side="left" />
      )}
      <Exchange
        x0={inner.x + inner.w - 6}
        x1={790}
        y={K.y - 26}
        rate={Math.abs(net)}
        dir={net >= 0 ? 'out' : 'in'}
        color={C_O2}
        label={net >= 0 ? 'O₂ ut' : 'O₂ inn'}
        side="right"
      />
      {/* ATP til cellens arbeid */}
      {R > 0.05 && (
        <g>
          <Arrow
            x1={narrow ? M.x + M.w * 0.45 : M.x + M.w * 0.25}
            y1={narrow ? M.y + M.h * 0.3 : M.y + M.h / 2 + 4}
            x2={narrow ? M.x + M.w * 0.75 : M.x + M.w * 0.5}
            y2={box.y + box.h + 22}
            color={C_ENERGY}
            width={w(R)}
            head={10 + w(R)}
          />
          <Txt x={narrow ? 790 : M.x + M.w * 0.5 + 10} y={box.y + box.h + 22 + 20 * f} anchor={narrow ? 'end' : 'start'} size={labelSize} color={C_ENERGY} weight={650}>
            ATP til cellens arbeid
          </Txt>
        </g>
      )}
      {/* Overskudd lagres som stivelse, eller lageret brukes */}
      {surplus > 0.05 && (
        <Arrow
          x1={narrow ? K.x - K.w * 0.43 : K.x - K.w * 0.3}
          y1={narrow ? K.y + K.h / 2 - 6 : K.y + K.h / 2 + 2}
          x2={starch.x + (narrow ? 4 : 10)}
          y2={starch.y - 22}
          color={C_SUGAR}
          width={w(surplus)}
          head={10 + w(surplus)}
        />
      )}
      {deficit > 0.05 && (
        <Arrow
          x1={starch.x + (narrow ? 22 : 16)}
          y1={starch.y + (narrow ? 14 : -16)}
          x2={M.x - M.w / 2 - 4}
          y2={M.y + (narrow ? 0 : M.h / 3)}
          color={C_SUGAR}
          width={w(deficit)}
          head={10 + w(deficit)}
          dashed
        />
      )}
      <Txt
        x={narrow ? K.x + 35 : K.x}
        y={narrow ? K.y - K.h / 2 - 16 : box.y + 22 * f + 4}
        anchor="middle"
        size={labelSize}
        weight={700}
        color={C_PS}
      >
        Kloroplast: fotosyntese
      </Txt>
      <Txt
        x={narrow ? M.x + 40 : M.x}
        y={narrow ? M.y + M.h / 2 + 30 * f : box.y + 22 * f + 4}
        anchor={narrow ? 'end' : 'middle'}
        size={labelSize}
        weight={700}
        color={C_R}
      >
        Mitokondrie: celleånding
      </Txt>
    </Figure>
  );
}

/** Pil for stoffer som går inn i eller ut av cellen, med etikett over pila. */
function Exchange({
  x0,
  x1,
  y,
  rate,
  dir,
  color,
  label,
  side,
}: {
  x0: number;
  x1: number;
  y: number;
  rate: number;
  dir: 'in' | 'out';
  color: string;
  label: string;
  side: 'left' | 'right';
}) {
  if (!(rate > 0.05)) return null;
  const w = widthOf(rate);
  // «Inn» peker mot cellen: til høyre på venstre side, til venstre på høyre side
  const towardsCell = side === 'left' ? [x0, x1] : [x1, x0];
  const [a, b] = dir === 'in' ? towardsCell : [towardsCell[1]!, towardsCell[0]!];
  const tx = side === 'left' ? x0 + 4 : x1 - 4;
  return (
    <g>
      <Arrow x1={a!} y1={y} x2={b!} y2={y} color={color} width={w} head={10 + w} />
      <Txt x={tx} y={y - w / 2 - 8} anchor={side === 'left' ? 'start' : 'end'} size={0.78} color={color} weight={700}>
        {label}
      </Txt>
    </g>
  );
}

/* ---------- Grafen ---------- */

function RatePlot({ axis, I, C, T, height }: { axis: Axis; I: number; C: number; T: number; height: number }) {
  const spec =
    axis === 'lys'
      ? { min: 0, max: 100, label: 'Lys (% av fullt sollys)', x: I, fn: (x: number) => [grossPhotosynthesis(x, C, T), respiration(T)] as const }
      : axis === 'co2'
        ? { min: 0, max: 1500, label: 'CO₂ i lufta (ppm)', x: C, fn: (x: number) => [grossPhotosynthesis(I, x, T), respiration(T)] as const }
        : { min: 0, max: 45, label: 'Temperatur (°C)', x: T, fn: (x: number) => [grossPhotosynthesis(I, C, x), respiration(x)] as const };
  const yMin = axis === 'temp' ? -48 : -Math.max(10, Math.ceil((respiration(T) + 4) / 10) * 10);
  const ticks = axis === 'temp' ? [-40, -20, 0, 20, 40, 60, 80, 100] : yMin === -10 ? [-10, 0, 20, 40, 60, 80, 100] : [yMin, 0, 20, 40, 60, 80, 100];
  const P = sample((x) => spec.fn(x)[0], spec.min, spec.max, 240);
  const Rs = sample((x) => spec.fn(x)[1], spec.min, spec.max, 240);
  const N = sample((x) => spec.fn(x)[0] - spec.fn(x)[1], spec.min, spec.max, 240);
  const [p0, r0] = spec.fn(spec.x);
  const Ic = axis === 'lys' ? compensationLight(C, T) : null;
  const Is = axis === 'lys' ? saturationLight(C, T) : null;
  return (
    <Plot x={{ min: spec.min, max: spec.max, label: spec.label }} y={{ min: yMin, max: 100, label: 'Fart (relativ)', ticks }} width={800} height={height}>
      {({ sx, sy, y0, y1 }) => (
        <g>
          {axis === 'co2' && <Marker x={sx(CO2_AIR)} y0={y0} y1={y1} text="Luft i dag" />}
          {axis === 'temp' && <Marker x={sx(PS.Topt)} y0={y0} y1={y1} text="Optimum" />}
          {Is !== null && Is > 2 && Is < 100 && <Marker x={sx(Is)} y0={y0} y1={y1} text="Lysmetning" />}
          <line x1={sx(spec.min)} x2={sx(spec.max)} y1={sy(0)} y2={sy(0)} stroke={VIZ.muted} strokeWidth={1.4} />
          <path d={linePath(Rs, sx, sy)} fill="none" stroke={C_R} strokeWidth={3} />
          <path d={linePath(P, sx, sy)} fill="none" stroke={C_PS} strokeWidth={3} />
          <path d={linePath(N, sx, sy)} fill="none" stroke={C_NET} strokeWidth={2.2} strokeDasharray="7 5" />
          {Ic !== null && Ic <= 100 && (
            <g>
              <circle cx={sx(Ic)} cy={sy(0)} r={6} fill={VIZ.surface} stroke={C_NET} strokeWidth={2.2} />
              <Txt x={sx(Ic) + 10} y={sy(0) + 24} anchor="start" size={0.75} muted>
                Kompensasjonspunkt
              </Txt>
            </g>
          )}
          <line x1={sx(spec.x)} x2={sx(spec.x)} y1={y0} y2={y1} className="viz-guide" />
          <circle cx={sx(spec.x)} cy={sy(r0)} r={6} fill={C_R} stroke={VIZ.surface} strokeWidth={2.5} />
          <circle cx={sx(spec.x)} cy={sy(p0 - r0)} r={6} fill={C_NET} stroke={VIZ.surface} strokeWidth={2.5} />
          <circle cx={sx(spec.x)} cy={sy(p0)} r={7} fill={C_PS} stroke={VIZ.surface} strokeWidth={2.5} />
        </g>
      )}
    </Plot>
  );
}

function Marker({ x, y0, y1, text }: { x: number; y0: number; y1: number; text: string }) {
  return (
    <g>
      <line x1={x} x2={x} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.2} strokeDasharray="3 4" />
      <Txt x={x + 6} y={y1 + 16} anchor="start" size={0.72} muted>
        {text}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explain(I: number, C: number, T: number, P: number, R: number, limit: Limiting, Ic: number | null): ReactNode {
  const always = (
    <p>
      Planter har celleånding hele døgnet, ikke bare om natta: mitokondriene bryter ned glukose til CO₂ og vann for å lage ATP. Om dagen lager
      fotosyntesen vanligvis mer O₂ enn celleåndingen bruker, så det er <em>nettoen</em> vi merker.
    </p>
  );
  const comp =
    Ic !== null ? (
      <p>
        Ved {fmt(Ic, 1)} % lys er fotosyntesen like stor som celleåndingen: <strong>kompensasjonspunktet</strong>. Under det bruker bladet
        mer O₂ og glukose enn det lager.
      </p>
    ) : (
      <p>
        Med {fmt(C, 0)} ppm CO₂ og {fmt(T, 0)} °C klarer ikke fotosyntesen å ta igjen celleåndingen, uansett hvor mye lys det er.
      </p>
    );
  if (I === 0)
    return (
      <>
        <p>
          <strong>Mørkt: ingen fotosyntese.</strong> Uten lys stopper fotosyntesen, men celleåndingen fortsetter ({fmt(R, 1)}). Bladet tar
          derfor opp O₂ og gir fra seg CO₂, og bruker glukose fra stivelse det lagret om dagen.
        </p>
        {always}
      </>
    );
  if (T >= 38)
    return (
      <>
        <p>
          <strong>For varmt.</strong> Ved {fmt(T, 0)} °C {P < 0.05 ? 'er enzymene i fotosyntesen denaturert, så fotosyntesen har stoppet helt, uansett hvor mye lys det er' : 'begynner enzymene i fotosyntesen å denatureres, så fotosyntesen faller'}{' '}
          ({fmt(P, 1)}), mens celleåndingen øker med temperaturen ({fmt(R, 1)}).{' '}
          {P < R ? 'Nå bruker bladet mer enn det lager, og planten tærer på lagrene sine.' : 'Nettoen blir mye mindre enn ved lavere temperatur.'}
        </p>
        {comp}
        {always}
      </>
    );
  if (P < R)
    return (
      <>
        <p>
          <strong>Under kompensasjonspunktet.</strong> Det er litt fotosyntese ({fmt(P, 1)}), men celleåndingen ({fmt(R, 1)}) er større. Bladet
          tar opp O₂ og gir fra seg CO₂, selv om det er lyst.
        </p>
        {comp}
        {always}
      </>
    );
  const limitText: Record<Limiting, ReactNode> = {
    lys: (
      <p>
        <strong>Lys er den begrensende faktoren.</strong> Lysreaksjonene får for lite energi, så mer lys gir nesten tilsvarende mer
        fotosyntese. Mer CO₂ eller en litt annen temperatur hjelper lite så lenge det er så lite lys.
      </p>
    ),
    co2:
      C < 900 ? (
        <p>
          <strong>CO₂ er den begrensende faktoren.</strong> Kurven mot lys har flatet ut (lysmetning): kloroplastene får mer lysenergi enn
          Calvin-syklusen rekker å bruke. Enzymet som binder CO₂ (rubisco), trenger mer CO₂. Derfor tilsetter gartnere CO₂ i drivhus (ca.
          1000 ppm).
        </p>
      ) : (
        <p>
          <strong>CO₂ er fortsatt den begrensende faktoren, men den begrenser mindre.</strong> Med {fmt(C, 0)} ppm CO₂ (mer enn dobbelt så
          mye som i lufta) går fotosyntesen mye raskere enn ute, men enzymet som binder CO₂ (rubisco), nærmer seg metning. Enda mer CO₂ gir
          bare litt mer fotosyntese, så gartnere går sjelden over ca. 1000 ppm.
        </p>
      ),
    temperatur: (
      <p>
        <strong>Temperaturen er den begrensende faktoren.</strong>{' '}
        {T < PS.Topt
          ? `Ved ${fmt(T, 0)} °C går enzymreaksjonene i Calvin-syklusen sakte. Varmere (opp mot ca. ${PS.Topt} °C) gir raskere fotosyntese.`
          : `Ved ${fmt(T, 0)} °C er det over optimum (ca. ${PS.Topt} °C), og enzymene virker dårligere.`}
      </p>
    ),
  };
  return (
    <>
      {limitText[limit]}
      <p>
        Fotosyntesen lager {fmt(P, 1)} og celleåndingen bruker {fmt(R, 1)}, så bladet gir fra seg netto {fmt(P - R, 1)} O₂ og bygger opp
        glukose som blir til stivelse, cellulose og vekst. Det er bare den <strong>begrensende faktoren</strong> som øker fotosyntesen når du
        skrur den opp. Lysintensitet {fmt(I, 0)} %, CO₂ {fmt(C, 0)} ppm og {fmt(T, 0)} °C.
      </p>
      {comp}
    </>
  );
}
