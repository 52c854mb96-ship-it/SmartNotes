import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Sup,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useTextScale,
} from '../kit';
import { SOLAR_CONSTANT, radiationBalance, type Balance } from './model';
import { ColorDot, Tag, useNarrow } from './marks';

type Preset = 'uten' | 'idag' | 'mer' | 'sno';

const PRESETS: { value: Preset; label: string; albedo: number; eps: number }[] = [
  { value: 'uten', label: 'Uten atmosfære', albedo: 0.3, eps: 0 },
  { value: 'idag', label: 'Jorda i dag', albedo: 0.3, eps: 0.78 },
  { value: 'mer', label: 'Mer drivhusgasser', albedo: 0.3, eps: 0.82 },
  { value: 'sno', label: 'Mer is og snø', albedo: 0.45, eps: 0.78 },
];

const SUNLIGHT = VIZ.series[1];
const HEAT = VIZ.series[4];
const ATM = VIZ.series[0];
/** Piksler bredde per W/m² for pilene. */
const PX_PER_W = 0.065;
const T_TODAY = 288;
/** Dagens jord i modellen (α = 0,30, ε = 0,78), som de andre tilstandene sammenlignes med. */
const TODAY = PRESETS[1]!;
const TS_TODAY = radiationBalance(TODAY.albedo, TODAY.eps).Tsurface;
/** Celsius fra en temperatur som vises avrundet i kelvin, så «255 K = −18 °C» henger sammen. */
const celsius = (K: number) => Math.round(K) - 273.15;

export default function Stralingsbalanse() {
  const [albedo, setAlbedo] = useState(0.3);
  const [eps, setEps] = useState(0.78);
  const [sceneRef, narrow] = useNarrow<HTMLDivElement>();
  const b = radiationBalance(albedo, eps);
  const preset = PRESETS.find((p) => Math.abs(p.albedo - albedo) < 1e-9 && Math.abs(p.eps - eps) < 1e-9)?.value ?? ('egen' as Preset);
  const graphH = narrow ? 440 : 330;
  const choose = (v: Preset) => {
    const p = PRESETS.find((x) => x.value === v);
    if (!p) return;
    setAlbedo(p.albedo);
    setEps(p.eps);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg et eksempel" options={PRESETS} value={preset} onChange={choose} />
      </Toolbar>
      <Controls>
        <Slider label="Albedo α" value={albedo} onChange={setAlbedo} min={0} max={0.9} step={0.01} decimals={2} />
        <Slider
          label="Varmestråling atmosfæren absorberer, ε"
          value={eps}
          onChange={setEps}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${fmt(v * 100, 0)} %`}
        />
      </Controls>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 800 ${narrow ? 600 : 460}`}
          label={`Energistrømmer for jorda. Albedo ${fmt(albedo, 2)}, atmosfæren absorberer ${fmt(eps * 100, 0)} prosent av varmestrålingen. Temperaturen ved bakken blir ${fmt(b.Tsurface, 0)} K.`}
          maxHeight={narrow ? 600 : 480}
          caption="Tallene er energistrømmer i W/m², i snitt over hele jordoverflaten. Bredden på pilene viser hvor stor strømmen er."
        >
          <Flows b={b} eps={eps} height={narrow ? 600 : 460} tall={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: SUNLIGHT, label: 'Sollys (synlig lys)' },
          { color: HEAT, label: 'Varmestråling (infrarødt)' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${graphH}`}
        label="Graf over temperaturen ved bakken som funksjon av hvor mye varmestråling atmosfæren absorberer"
      >
        <TempGraph albedo={albedo} eps={eps} Ts={b.Tsurface} Tbare={b.Tbare} height={graphH} />
      </Figure>

      <Readouts>
        <Readout label="Absorbert sollys (1 − α)·S/4" value={fmt(b.absorbed, 0)} unit="W/m²" tone={SUNLIGHT} />
        <Readout label="Uten atmosfære" value={fmt(b.Tbare, 0)} unit="K" />
        <Readout label={`Ved bakken (${fmt(celsius(b.Tsurface), 0)} °C)`} value={fmt(b.Tsurface, 0)} unit="K" tone={HEAT} />
        <Readout label="Drivhuseffekten gir" value={`+${fmt(b.Tsurface - b.Tbare, 0)}`} unit="K" />
      </Readouts>

      <Formula label="Strålingsbalansen">
        <FormulaLine>
          S/4 = {fmt(SOLAR_CONSTANT, 0)} W/m² / 4 = {fmt(b.incoming, 0)} W/m²
        </FormulaLine>
        <FormulaLine>
          (1 − α) · S/4 = σT<Sub>uten</Sub>
          <Sup>4</Sup> &nbsp;⇒&nbsp; T<Sub>uten</Sub> = ({fmt(b.absorbed, 1)} W/m² / 5,67 · 10<Sup>−8</Sup> W/(m²·K<Sup>4</Sup>))
          <Sup>1/4</Sup> = {fmt(b.Tbare, 0)} K
        </FormulaLine>
        <FormulaLine>
          T<Sub>bakke</Sub> = T<Sub>uten</Sub> · (2 / (2 − ε))<Sup>1/4</Sup> = {fmt(b.Tbare, 0)} K · (2 / (2 − {fmt(eps, 2)}))<Sup>1/4</Sup> ={' '}
          {fmt(b.Tsurface, 0)} K
        </FormulaLine>
      </Formula>

      <Explain>{explanation(b, albedo, eps)}</Explain>
    </VizLayout>
  );
}

/** Tykk loddrett pil der bredden viser energistrømmen. */
function FlowArrow({
  x,
  y1,
  y2,
  flux,
  color,
  opacity = 1,
}: {
  x: number;
  y1: number;
  y2: number;
  flux: number;
  color: string;
  opacity?: number;
}) {
  const w = flux * PX_PER_W;
  if (w < 1) return null;
  const dir = y2 > y1 ? 1 : -1;
  const headL = Math.min(Math.abs(y2 - y1) * 0.5, 12 + 0.45 * w);
  const headW = w + 16;
  const yb = y2 - dir * headL;
  const d = `M ${x - w / 2} ${y1} L ${x - w / 2} ${yb} L ${x - headW / 2} ${yb} L ${x} ${y2} L ${x + headW / 2} ${yb} L ${x + w / 2} ${yb} L ${x + w / 2} ${y1} Z`;
  return <path d={d} fill={color} opacity={opacity} />;
}

function Flows({ b, eps, height, tall }: { b: Balance; eps: number; height: number; tall: boolean }) {
  const f = useTextScale();
  const top = 34;
  const atmTop = tall ? 190 : 150;
  const atmBot = tall ? 300 : 236;
  const ground = height - 90;
  const w = (v: number) => v * PX_PER_W;
  const xSun = 120;
  const xRefl = 240;
  const xSurf = 400;
  const xTrans = xSurf + w(b.atmAbsorbed) / 2 + w(b.transmitted) / 2 + 6;
  const xUp = 660;
  const xDown = 750;
  const midLow = (atmBot + ground) / 2;
  const midHigh = (top + atmTop) / 2 + 10;
  const num = (v: number) => fmt(v, 0);
  // Etiketten for atmosfæren står i åpningen mellom varmestrålingen fra bakken og pila som går opp fra atmosfæren.
  // Uten drivhuseffekt er det ingen piler fra atmosfæren, så den får hele plassen til høyre.
  const surfRight = Math.max(xSurf + w(b.atmAbsorbed) / 2, b.transmitted >= 0.5 ? xTrans + w(b.transmitted) / 2 : 0);
  const atmLabelX = eps > 0 ? (surfRight + xUp - w(b.atmUp) / 2) / 2 : 600;
  // Venstre kant av pilene som går opp fra bakken (uten atmosfære er det bare én pil, rett ved xSurf)
  const surfLeft = xSurf - (eps > 0 ? w(b.atmAbsorbed) : w(b.transmitted)) / 2;
  return (
    <g>
      {/* Atmosfæren: tettere farge jo mer varmestråling den absorberer */}
      <rect x={0} y={atmTop} width={800} height={atmBot - atmTop} fill={ATM} opacity={0.06 + 0.22 * eps} />
      <Tag x={atmLabelX} y={(atmTop + atmBot) / 2 - 2}>
        atmosfæren
      </Tag>
      <Tag x={atmLabelX} y={(atmTop + atmBot) / 2 + 22 * f} muted>
        {eps > 0 ? `${fmt(b.Tatm, 0)} K` : 'slipper alt gjennom'}
      </Tag>

      {/* Bakken */}
      <rect x={0} y={ground} width={800} height={height - ground} fill={VIZ.body} />
      <Ground x1={0} x2={800} y={ground} hatch={false} />
      <Tag x={400} y={ground + 30 + 12 * (f - 1)} weight={700}>
        bakken: {fmt(b.Tsurface, 0)} K = {fmt(celsius(b.Tsurface), 0)} °C
      </Tag>

      {/* Sola og sollyset */}
      <circle cx={46} cy={30} r={24} fill={SUNLIGHT} />
      <FlowArrow x={xSun} y1={top} y2={ground} flux={b.incoming} color={SUNLIGHT} />
      <Tag x={xSun + w(b.incoming) / 2 + 8} y={midLow + 6} anchor="start" color={SUNLIGHT}>
        {num(b.incoming)}
      </Tag>
      <FlowArrow x={xRefl} y1={ground} y2={top} flux={b.reflected} color={SUNLIGHT} opacity={0.55} />
      {b.reflected >= 0.5 && (
        <Tag x={xRefl + w(b.reflected) / 2 + 8} y={midHigh} anchor="start" color={SUNLIGHT}>
          {num(b.reflected)}
        </Tag>
      )}

      {/* Varmestråling fra bakken: delen atmosfæren tar opp, og delen som slipper ut */}
      {b.atmAbsorbed >= 0.5 && <FlowArrow x={xSurf} y1={ground} y2={(atmTop + atmBot) / 2 + 8} flux={b.atmAbsorbed} color={HEAT} />}
      {b.transmitted >= 0.5 && (
        <FlowArrow x={eps > 0 ? xTrans : xSurf} y1={ground} y2={top} flux={b.transmitted} color={HEAT} opacity={0.75} />
      )}
      <Tag x={surfLeft - 10} y={midLow + 6} anchor="end" color={HEAT}>
        {num(b.surfaceEmit)}
      </Tag>
      {b.transmitted >= 0.5 && (
        <Tag x={(eps > 0 ? xTrans : xSurf) + w(b.transmitted) / 2 + 8} y={midHigh} anchor="start" color={HEAT}>
          {num(b.transmitted)}
        </Tag>
      )}

      {/* Atmosfæren stråler like mye opp som ned */}
      {b.atmUp >= 0.5 && (
        <>
          <FlowArrow x={xUp} y1={atmTop} y2={top} flux={b.atmUp} color={HEAT} />
          <Tag x={xUp + w(b.atmUp) / 2 + 8} y={midHigh} anchor="start" color={HEAT}>
            {num(b.atmUp)}
          </Tag>
          <FlowArrow x={xDown} y1={atmBot} y2={ground} flux={b.atmDown} color={HEAT} />
          <Tag x={xDown - w(b.atmDown) / 2 - 8} y={midLow + 6} anchor="end" color={HEAT}>
            {num(b.atmDown)}
          </Tag>
        </>
      )}
    </g>
  );
}

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

function TempGraph({ albedo, eps, Ts, Tbare, height }: { albedo: number; eps: number; Ts: number; Tbare: number; height: number }) {
  const f = useTextScale();
  const curve = sample((e) => radiationBalance(albedo, e).Tsurface, 0, 1, 100);
  return (
    <Plot
      x={{ min: 0, max: 100, label: 'Varmestråling atmosfæren absorberer (%)' }}
      y={{ min: 140, max: 340, label: f > 1.3 ? 'T ved bakken (K)' : 'Temperatur ved bakken (K)', ticks: [150, 200, 250, 300] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        // Etikettene plasseres der de ikke treffer kurven eller hverandre (omtrentlig tekstboks i piksler)
        const font = 17 * f;
        const box = (x: number, y: number, anchor: 'start' | 'end', text: string): Box => {
          const w = text.length * 0.56 * font;
          const l = anchor === 'start' ? x : x - w;
          return { l, r: l + w, t: y - 0.8 * font, b: y + 0.25 * font };
        };
        const pts = curve.map(([e, T]) => [sx(e * 100), sy(T)] as const);
        const hitsCurve = (bx: Box) => pts.some(([px, py]) => px > bx.l - 3 && px < bx.r + 3 && py > bx.t - 3 && py < bx.b + 3);
        const inside = (bx: Box) => bx.l >= x0 && bx.r <= x1 && bx.t >= y1 - 4 && bx.b <= y0;
        const refPlaces = (T: number, text: string) =>
          (['start', 'end'] as const).flatMap((anchor) =>
            [sy(T) - 8, sy(T) + 22 * f].map((y) => ({
              x: anchor === 'start' ? x0 + 8 : x1 - 8,
              y,
              anchor,
              text,
              box: box(anchor === 'start' ? x0 + 8 : x1 - 8, y, anchor, text),
            })),
          );
        const a288 = refPlaces(T_TODAY, 'målt i dag: 288 K');
        const a255 = refPlaces(Tbare, `uten atmosfære: ${fmt(Tbare, 0)} K`);
        let best = { score: Infinity, p: a288[0]!, q: a255[0]! };
        a288.forEach((p, i) =>
          a255.forEach((q, j) => {
            const score =
              10 * (Number(hitsCurve(p.box)) + Number(hitsCurve(q.box)) + Number(overlaps(p.box, q.box))) +
              (i < 2 ? 0 : 1) +
              (j >= 2 ? 0 : 1) +
              (i % 2) * 0.1 +
              (j % 2) * 0.1;
            if (score < best.score) best = { score, p, q };
          }),
        );
        const dx = sx(eps * 100);
        const dy = sy(Ts);
        const valueText = `${fmt(Ts, 0)} K`;
        const dotPlaces = [
          { x: dx + 14, y: dy - 14, anchor: 'start' as const },
          { x: dx - 14, y: dy - 14, anchor: 'end' as const },
          { x: dx + 14, y: dy + 26 * f, anchor: 'start' as const },
          { x: dx - 14, y: dy + 26 * f, anchor: 'end' as const },
        ].map((d) => ({ ...d, box: box(d.x, d.y, d.anchor, valueText) }));
        const dot = dotPlaces
          .map((d) => ({
            d,
            score:
              10 * (Number(overlaps(d.box, best.p.box)) + Number(overlaps(d.box, best.q.box)) + Number(!inside(d.box))) +
              3 * Number(hitsCurve(d.box)),
          }))
          .sort((u, v) => u.score - v.score)[0];
        return (
          <g>
            <line x1={x0} x2={x1} y1={sy(T_TODAY)} y2={sy(T_TODAY)} className="viz-guide" />
            <line x1={x0} x2={x1} y1={sy(Tbare)} y2={sy(Tbare)} className="viz-guide" />
            {[best.p, best.q].map((l) => (
              <Tag key={l.text} x={l.x} y={l.y} anchor={l.anchor} muted>
                {l.text}
              </Tag>
            ))}
            <path
              d={linePath(
                curve.map(([e, T]) => [e * 100, T]),
                sx,
                sy,
              )}
              fill="none"
              stroke={HEAT}
              strokeWidth={3.5}
            />
            <ColorDot x={dx} y={dy} r={8} color={HEAT} />
            {dot && dot.score < 10 && (
              <Tag x={dot.d.x} y={dot.d.y} anchor={dot.d.anchor} color={HEAT}>
                {valueText}
              </Tag>
            )}
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(b: Balance, albedo: number, eps: number): ReactNode {
  const first = (
    <p>
      <strong>Inn = ut.</strong> Jorda tar i snitt opp {fmt(b.absorbed, 0)} W/m² sollys, og i likevekt må den stråle ut like mye som
      varmestråling. Uten atmosfære gir det σT<Sup>4</Sup> = {fmt(b.absorbed, 0)} W/m², altså T = {fmt(b.Tbare, 0)} K ={' '}
      {fmt(celsius(b.Tbare), 0)} °C.
    </p>
  );
  const second =
    eps > 0 ? (
      <p>
        Atmosfæren slipper sollyset gjennom, men tar opp {fmt(eps * 100, 0)} % av varmestrålingen fra bakken og sender halvparten tilbake
        ned ({fmt(b.atmDown, 0)} W/m²). Bakken må da bli varmere, {fmt(b.Tsurface, 0)} K, for å bli kvitt energien. {greenhouse(b, albedo, eps)}
      </p>
    ) : (
      <p>
        Uten drivhusgasser slipper all varmestrålingen rett ut, og bakken får bare {fmt(b.Tsurface, 0)} K. Den naturlige drivhuseffekten
        gjør altså jorda beboelig. Øk andelen atmosfæren absorberer, og se temperaturen stige.
      </p>
    );
  const third =
    Math.abs(albedo - 0.3) > 0.005 ? (
      <p>
        Med albedo {fmt(albedo, 2)} reflekteres {fmt(albedo * 100, 0)} % av sollyset. Mer is, snø og skyer gir høyere albedo og kaldere
        jord, mens smeltende is gir lavere albedo og mer oppvarming.
      </p>
    ) : null;
  return (
    <>
      {first}
      {second}
      {third}
    </>
  );
}

/** Naturlig eller forsterket drivhuseffekt, sammenlignet med dagens jord (ε = 0,78). */
function greenhouse(b: Balance, albedo: number, eps: number): string {
  if (Math.abs(albedo - TODAY.albedo) > 0.005)
    return `Drivhuseffekten gjør bakken ${fmt(b.Tsurface - b.Tbare, 0)} K varmere enn uten atmosfære.`;
  const diff = b.Tsurface - TS_TODAY;
  if (Math.abs(eps - TODAY.eps) < 0.005)
    return `Dette er den naturlige drivhuseffekten, og den er nødvendig: uten den ville middeltemperaturen vært ${fmt(celsius(b.Tbare), 0)} °C i stedet for ${fmt(celsius(T_TODAY), 0)} °C.`;
  if (eps > TODAY.eps)
    return `Atmosfæren tar opp mer varmestråling enn i dag, og bakken blir ${fmt(diff, 1)} K varmere. Slik virker den menneskeskapte (forsterkede) drivhuseffekten: utslipp av CO₂ og andre drivhusgasser kommer i tillegg til den naturlige drivhuseffekten, som vi trenger.`;
  return `Atmosfæren tar opp mindre varmestråling enn i dag, og bakken blir ${fmt(-diff, 1)} K kaldere. Uten noen drivhuseffekt ville middeltemperaturen vært ${fmt(celsius(b.Tbare), 0)} °C.`;
}
