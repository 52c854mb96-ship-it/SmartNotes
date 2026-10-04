import { useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Sup,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  linePath,
  niceTicks,
  useTextScale,
} from '../kit';
import { VISIBLE, blackbodyRgb, planck, stefanBoltzmann, visibleFraction, wavelengthRgb, wienPeak } from './model';
import { Tag, useNarrow } from './marks';

type Preset = 'lampe' | 'betelgeuse' | 'sola' | 'sirius' | 'rigel';

const PRESETS: { value: Preset; label: string; T: number }[] = [
  { value: 'lampe', label: 'Glødelampe', T: 2800 },
  { value: 'betelgeuse', label: 'Betelgeuse', T: 3500 },
  { value: 'sola', label: 'Sola', T: 5800 },
  { value: 'sirius', label: 'Sirius', T: 9900 },
  { value: 'rigel', label: 'Rigel', T: 12000 },
];

const T_SUN = 5800;
const L_MAX_NM = 3000;
const CURVE = VIZ.ink;
const SUN = VIZ.series[1];
/** Toppen på kurven for Sola, som alle intensitetene måles i forhold til. */
const SUN_PEAK = planck(wienPeak(T_SUN), T_SUN);

const nm = (v: number) => v * 1e9;

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const c of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (c * mag >= v - 1e-12) return c * mag;
  return 10 * mag;
}

export default function SvartLegeme() {
  const [T, setT] = useState(T_SUN);
  const [showSun, setShowSun] = useState(true);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const peak = wienPeak(T);
  const I = stefanBoltzmann(T);
  const vis = visibleFraction(T);
  const ratioSun = (T / T_SUN) ** 4;
  const preset = PRESETS.find((p) => p.T === T)?.value ?? ('egen' as Preset);
  const height = narrow ? 620 : 400;
  // Er Sola mye sterkere, går kurven dens langt over grafen. Da står forholdet i fargeforklaringen i stedet.
  const sunRatio = SUN_PEAK / planck(peak, T);
  const sunOnScale = sunRatio < 2.5;
  const sunVisible = showSun && T !== T_SUN;

  return (
    <VizLayout>
      <Controls>
        <Slider label="Temperatur T" value={T} onChange={setT} min={2000} max={12000} step={50} unit="K" />
      </Controls>
      <Toolbar>
        <Segmented
          label="Velg et legeme"
          options={PRESETS}
          value={preset}
          onChange={(v) => setT(PRESETS.find((p) => p.value === v)?.T ?? T)}
        />
        <Toggle label="Vis Sola til sammenligning" checked={showSun} onChange={setShowSun} />
      </Toolbar>

      <div ref={graphRef}>
        <Figure
          viewBox={`0 0 800 ${height}`}
          label={`Plancks strålingskurve for et svart legeme på ${fmt(T, 0)} K. Toppen ligger ved ${fmt(nm(peak), 0)} nanometer.`}
          maxHeight={620}
        >
          <Spectrum T={T} showSun={sunVisible && sunOnScale} height={height} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: CURVE, label: `Svart legeme, ${fmt(T, 0)} K` },
          ...(sunVisible
            ? [
                {
                  color: SUN,
                  label: sunOnScale
                    ? `Sola, ${fmt(T_SUN, 0)} K`
                    : `Sola, ${fmt(T_SUN, 0)} K: toppen er ${fmt(sunRatio, 0)} ganger høyere og går utenfor grafen`,
                  dashed: true,
                },
              ]
            : []),
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Toppen λ<Sub>maks</Sub>
            </>
          }
          value={fmt(nm(peak), 0)}
          unit="nm"
        />
        <Readout label="Intensitet I = σT⁴" value={fmtSci(I, 2)} unit="W/m²" />
        <Readout label="I forhold til Sola" value={fmt(ratioSun, ratioSun < 0.1 ? 3 : ratioSun < 1 ? 2 : 1)} unit="ganger" />
        <Readout label="Andel synlig lys" value={fmt(vis * 100, vis < 0.1 ? 1 : 0)} unit="%" />
      </Readouts>

      <Formula label="Wiens forskyvningslov og Stefan–Boltzmanns lov">
        <FormulaLine>
          λ<Sub>maks</Sub> = b / T = 2,90 · 10<Sup>−3</Sup> m·K / {fmt(T, 0)} K = {fmtSci(peak, 2)} m = {fmt(nm(peak), 0)} nm
        </FormulaLine>
        <FormulaLine>
          I = σT<Sup>4</Sup> = 5,67 · 10<Sup>−8</Sup> W/(m²·K<Sup>4</Sup>) · ({fmt(T, 0)} K)<Sup>4</Sup> = {fmtSci(I, 2)} W/m²
        </FormulaLine>
      </Formula>

      <Explain>{explanation(T, peak, vis)}</Explain>
    </VizLayout>
  );
}

function Spectrum({ T, showSun, height }: { T: number; showSun: boolean; height: number }) {
  const f = useTextScale();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const peak = wienPeak(T);
  const rel = (lambdaNm: number, temp: number) => planck(lambdaNm * 1e-9, temp) / SUN_PEAK;
  const yMax = niceCeil(1.12 * rel(nm(peak), T));
  const yTicks = niceTicks(0, yMax, f > 1.3 ? 4 : 5);
  const step = (yTicks[1] ?? yMax) - (yTicks[0] ?? 0);
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
  const pts: [number, number][] = [];
  const sunPts: [number, number][] = [];
  for (let i = 0; i <= 500; i++) {
    const l = 5 + (i * (L_MAX_NM - 5)) / 500;
    pts.push([l, rel(l, T)]);
    sunPts.push([l, rel(l, T_SUN)]);
  }
  const stops: ReactNode[] = [];
  for (let l = 380; l <= 750; l += 10) {
    const [r, g, b] = wavelengthRgb(l);
    stops.push(<stop key={l} offset={(l - 380) / 370} stopColor={`rgb(${r},${g},${b})`} />);
  }
  const [cr, cg, cb] = blackbodyRgb(T);
  return (
    <Plot
      x={{ min: 0, max: L_MAX_NM, label: 'Bølgelengde λ (nm)', ticks: f > 1.3 ? [0, 1000, 2000, 3000] : niceTicks(0, L_MAX_NM, 6) }}
      y={{ min: 0, max: yMax, label: f > 1.3 ? 'Intensitet (Sola = 1)' : 'Intensitet (toppen for Sola = 1)', ticks: yTicks, decimals }}
      width={800}
      height={height}
      margin={{ top: 46 * f, right: 24 * f, bottom: 56 * f, left: 72 * f + (decimals > 1 ? 16 * f : 0) }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const px = sx(nm(peak));
        const peakY = sy(rel(nm(peak), T));
        const labelX = Math.min(x1 - 90 * f, Math.max(x0 + 90 * f, px));
        const area = `${linePath(pts, sx, sy)}L${sx(L_MAX_NM)},${y0}L${sx(5)},${y0}Z`;
        // Etiketten for UV og IR står der den verken treffer kurven eller den stiplede linja for toppen:
        // først prøves øverst i grafen, så nederst (under kurven), på noen få steder langs aksen.
        const font = 17 * f;
        const fits = (cx: number, base: number, text: string) => {
          const half = (text.length * 0.56 * font) / 2 + 6;
          const top = base - 0.8 * font - 3;
          const bottom = base + 0.25 * font + 3;
          if (cx - half < x0 || cx + half > x1) return false;
          // Den stiplede linja for toppen går fra aksen opp til toppen av kurven
          if (px > cx - half - 4 && px < cx + half + 4 && bottom > peakY) return false;
          const atTop = base < (y0 + y1) / 2;
          // Fargeprøven står øverst til høyre
          if (atTop && cx + half > x1 - 76 * f) return false;
          for (let k = 0; k <= 12; k++) {
            const xx = cx - half + (2 * half * k) / 12;
            const cy = sy(rel(((xx - x0) / (x1 - x0)) * L_MAX_NM, T));
            // Øverst må kurven ligge under teksten, nederst over den (teksten står da i det skyggelagte feltet)
            if (atTop ? cy < bottom : cy > top) return false;
          }
          return true;
        };
        const RegionLabel = ({ xs, text }: { xs: number[]; text: string }) => {
          const spots = [y1 + 22 * f, y0 - 12].flatMap((base) => xs.map((x) => ({ x: sx(x), base })));
          const spot = spots.find((p) => fits(p.x, p.base, text)) ?? spots[0]!;
          return (
            <Tag x={spot.x} y={spot.base} muted>
              {text}
            </Tag>
          );
        };
        return (
          <g>
            <defs>
              <linearGradient id={`${uid}-rainbow`} x1="0" x2="1" y1="0" y2="0">
                {stops}
              </linearGradient>
              <clipPath id={`${uid}-clip`}>
                <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
              </clipPath>
            </defs>
            {/* Det synlige området */}
            <rect
              x={sx(nm(VISIBLE[0]))}
              y={y1}
              width={sx(nm(VISIBLE[1])) - sx(nm(VISIBLE[0]))}
              height={y0 - y1}
              fill={`url(#${uid}-rainbow)`}
              opacity={0.45}
            />
            <RegionLabel xs={[190, 120, 290]} text="UV" />
            <RegionLabel xs={[1700, 2200, 1200, 2500]} text="infrarødt (IR)" />

            <path d={area} fill={CURVE} opacity={0.08} />
            {showSun && (
              <path
                d={linePath(sunPts, sx, sy)}
                fill="none"
                stroke={SUN}
                strokeWidth={2.5}
                strokeDasharray="7 6"
                clipPath={`url(#${uid}-clip)`}
              />
            )}
            <path d={linePath(pts, sx, sy)} fill="none" stroke={CURVE} strokeWidth={3.5} strokeLinejoin="round" />

            {/* Wiens lov: toppen */}
            <line x1={px} x2={px} y1={y0} y2={peakY} className="viz-guide" />
            <Tag x={labelX} y={y1 - 14}>
              λ
              <tspan dy="0.32em" fontSize="0.72em">
                maks
              </tspan>
              <tspan dy="-0.32em"> = {fmt(nm(peak), 0)} nm</tspan>
            </Tag>

            {/* Fargen legemet ser ut til å ha */}
            <circle cx={x1 - 44 * f} cy={y1 + 42 * f} r={26 * f} fill={`rgb(${cr},${cg},${cb})`} stroke={VIZ.muted} strokeWidth={1.5} />
            <Tag x={x1 - 44 * f} y={y1 + 42 * f + 26 * f + 22 * f} muted>
              fargen
            </Tag>
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(T: number, peak: number, vis: number): ReactNode {
  const p = nm(peak);
  const pct = fmt(vis * 100, vis < 0.1 ? 1 : 0);
  let first: ReactNode;
  if (p > 750)
    first = (
      <p>
        <strong>Toppen ligger i infrarødt</strong> (λ<Sub>maks</Sub> = {fmt(p, 0)} nm), så det meste av strålingen er usynlig varmestråling,
        og bare {pct} % er synlig lys. Det synlige lyset er mest rødt og gult, så legemet gløder rødt-oransje.{' '}
        {T <= 3000 ? 'Derfor gir en glødelampe mest varme og lite lys.' : ''}
      </p>
    );
  else if (p >= 380)
    first = (
      <p>
        <strong>Toppen ligger i det synlige området</strong> (λ<Sub>maks</Sub> = {fmt(p, 0)} nm). Alle fargene er med, så lyset ser hvitt
        eller gulhvitt ut, og {pct} % av strålingen er synlig lys. {T === 5800 ? 'Sola er et slikt legeme.' : ''}
      </p>
    );
  else
    first = (
      <p>
        <strong>Toppen ligger i ultrafiolett</strong> (λ<Sub>maks</Sub> = {fmt(p, 0)} nm). I det synlige området er det mer blått enn rødt,
        så legemet ser blåhvitt ut.
      </p>
    );
  return (
    <>
      {first}
      <p>
        Dobler du temperaturen, blir λ<Sub>maks</Sub> halvparten så stor (Wiens lov), og intensiteten, som er arealet under kurven, blir 2
        <Sup>4</Sup> = 16 ganger så stor (Stefan–Boltzmanns lov). T må alltid være i kelvin. Alle legemer stråler, også du: ved 310 K ligger
        toppen på omtrent {fmt(Math.round(nm(wienPeak(310)) / 100) * 100, 0)} nm, langt inne i infrarødt.
      </p>
    </>
  );
}
