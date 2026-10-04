import { useState, type ReactNode } from 'react';
import {
  Arrow,
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sup,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  useSimClock,
  useTextScale,
} from '../../kit';
import { GAS_MOLAR_U, GAS_N, PISTON_AREA, ZERO_CELSIUS, gasPressure, toCelsius, typicalSpeed } from './model';
import { ColorDot, PlayToggle, Tag, Thermometer, useGasSim, useNarrow } from './marks';

const T_MAX = 600;
const V_MIN = 1.0;
const V_MAX = 3.0;
/** Utgangspunktet: romtemperatur og et volum som gir omtrent lufttrykket. */
const T_REF = 293;
const V_REF = 2.4;
/** Volumene som vises som tynne linjer i grafen. */
const OTHER_V = [1.0, 2.0, 3.0];

// Geometri i scenen (viewBox 800 × 380, eller 800 × 540 på smale skjermer, så sylinderen blir høyere)
const CYL_LEFT = 230;
const WALL = 6;
const GEO = {
  wide: { top: 70, bottom: 300, height: 380 },
  tall: { top: 80, bottom: 440, height: 540 },
};
const GAS_LEFT = CYL_LEFT + WALL;
/** Bredden på gassen (piksler) når V = V_MAX. */
const GAS_W_MAX = 340;
const PISTON_W = 18;
const CYL_RIGHT = GAS_LEFT + GAS_W_MAX + PISTON_W + 14;
/** Piksler per newton for kraften på stempelet. */
const PX_PER_N = 0.16;
const PARTICLE_R = 6;
/** Partikkelfart i figuren (piksler per sekund) ved 300 K. Ekte molekyler er mange tusen ganger raskere. */
const SPEED_PX = 110;

export default function Gassmodell() {
  const [T, setT] = useState(T_REF);
  const [V, setV] = useState(V_REF);
  const clock = useSimClock({ tMax: 3600, loop: true });
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const [sceneRef, sceneNarrow] = useNarrow<HTMLDivElement>();
  const geo = sceneNarrow ? GEO.tall : GEO.wide;

  const p = gasPressure(GAS_N, T, V * 1e-3);
  const F = p * PISTON_AREA;
  const tC = toCelsius(T);
  const vTyp = typicalSpeed(T, GAS_MOLAR_U);
  const graphH = narrow ? 460 : 360;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Temperatur T"
          value={T}
          onChange={setT}
          min={0}
          max={T_MAX}
          step={1}
          format={(v) => `${fmt(v, 0)} K = ${fmt(toCelsius(v), 0)} °C`}
        />
        <Slider label="Volum V" value={V} onChange={setV} min={V_MIN} max={V_MAX} step={0.05} unit="L" decimals={2} />
      </Controls>
      <Toolbar>
        <PlayToggle clock={clock} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={`0 0 800 ${geo.height}`}
          label={`Gass i en sylinder med stempel. Temperatur ${fmt(T, 0)} K, volum ${fmt(V, 2)} liter, trykk ${fmt(p / 1000, 0)} kilopascal.`}
          maxHeight={400}
        >
          <Scene t={clock.t} T={T} V={V} F={F} geo={geo} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over trykket som funksjon av temperaturen i celsius for ulike volum">
          <PressureGraph T={T} V={V} p={p} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: VIZ.series[0], label: `Trykket ved ${fmt(V, 2)} L` },
          { color: VIZ.muted, label: 'Ved 1,0 L, 2,0 L og 3,0 L', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Temperatur T" value={fmt(T, 0)} unit="K" tone={VIZ.series[1]} />
        <Readout label="I celsius" value={fmt(tC, 0)} unit="°C" tone={VIZ.series[1]} />
        <Readout label="Trykk p" value={fmt(p / 1000, 0)} unit="kPa" tone={VIZ.series[0]} />
        <Readout label="Kraft på stempelet F" value={fmt(F, 0)} unit="N" tone={VIZ.applied} />
      </Readouts>

      <Formula label="Utregning av trykket med tilstandslikningen for idealgass">
        <FormulaLine>
          t = T − 273,15 = {fmt(T, 0)} − 273,15 = {fmt(tC, 2)} °C
        </FormulaLine>
        <FormulaLine>
          p = nRT / V = 0,10 mol · 8,31 J/(mol·K) · {fmt(T, 0)} K / ({fmt(V, 2)} · 10<Sup>−3</Sup> m³) = {fmt(p / 1000, 1)} kPa
        </FormulaLine>
        <FormulaLine>
          F = p · A = {fmt(p / 1000, 1)} kPa · 50 cm² = {fmt(F, 0)} N
        </FormulaLine>
      </Formula>

      <Explain>{explanation(T, V, p, F, vTyp)}</Explain>
    </VizLayout>
  );
}

function Scene({ t, T, V, F, geo }: { t: number; T: number; V: number; F: number; geo: { top: number; bottom: number } }) {
  const f = useTextScale();
  const CYL = { left: CYL_LEFT, top: geo.top, bottom: geo.bottom, wall: WALL };
  const gasW = (V / V_MAX) * GAS_W_MAX;
  const xp = GAS_LEFT + gasW;
  const gasTop = CYL.top + CYL.wall;
  const gasH = CYL.bottom - CYL.wall - gasTop;
  const sim = useGasSim(t, {
    count: 36,
    seed: 20240905,
    speed: SPEED_PX,
    scale: Math.sqrt(Math.max(0, T) / 300),
    width: gasW - 2 * PARTICLE_R,
    height: gasH - 2 * PARTICLE_R,
  });
  const scale = Math.sqrt(Math.max(0, T) / 300);
  const r = PARTICLE_R * (f > 1.3 ? 1.4 : 1);
  const midY = (CYL.top + CYL.bottom) / 2;
  const arrowY = midY - 52;
  const fLen = F * PX_PER_N;

  // Termometer: 0–600 K, med kelvin til venstre og celsius til høyre
  const kTicks = (f > 1.3 ? [0, 200, 400, 600] : [0, 100, 200, 300, 400, 500, 600]).map((v) => ({ value: v, label: fmt(v, 0) }));
  const cTicks = [-273.15, -100, 0, 100, 200, 300]
    .filter((c) => f <= 1.3 || c !== 200)
    .map((c) => ({ value: c + ZERO_CELSIUS, label: c < -200 ? '−273' : fmt(c, 0) }));

  return (
    <>
      <Thermometer x={100} yTop={CYL.top} yBottom={CYL.bottom + 16} min={0} max={T_MAX} value={T} color={VIZ.series[1]} left={kTicks} right={cTicks} />
      <Tag x={78} y={CYL.top - 26} anchor="end" muted>
        K
      </Tag>
      <Tag x={122} y={CYL.top - 26} anchor="start" muted>
        °C
      </Tag>

      {/* Sylinderen: vegger oppe, nede og til venstre. Høyre ende er åpen. */}
      <path
        d={`M ${CYL_RIGHT} ${CYL.top} H ${CYL.left} V ${CYL.bottom} H ${CYL_RIGHT}`}
        fill="none"
        stroke={VIZ.muted}
        strokeWidth={CYL.wall * 2}
        strokeLinejoin="round"
        opacity={0.55}
      />
      <rect x={GAS_LEFT} y={gasTop} width={gasW} height={gasH} fill={VIZ.series[0]} opacity={0.07} />

      {/* Partiklene med en hale som viser farten */}
      {sim.particles.map((pt, i) => {
        const x = GAS_LEFT + PARTICLE_R + pt.u * (gasW - 2 * PARTICLE_R);
        const y = gasTop + PARTICLE_R + pt.w * (gasH - 2 * PARTICLE_R);
        const tail = 0.16 * scale;
        const tx = Math.max(GAS_LEFT, Math.min(xp, x - pt.vx * tail));
        const ty = Math.max(gasTop, Math.min(gasTop + gasH, y - pt.vy * tail));
        return (
          <g key={i}>
            {scale > 0 && (
              <line x1={tx} y1={ty} x2={x} y2={y} stroke={VIZ.series[0]} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
            )}
            <circle cx={x} cy={y} r={r} fill={VIZ.series[0]} />
          </g>
        );
      })}

      {/* Stempel og stempelstang */}
      <rect x={xp} y={gasTop - 2} width={PISTON_W} height={gasH + 4} rx={3} fill={VIZ.bodyStrong} className="viz-block" />
      <rect x={xp + PISTON_W} y={midY - 6} width={796 - xp - PISTON_W} height={12} rx={3} fill={VIZ.body} className="viz-block" />

      {/* Støt mot stempelet */}
      {sim.flashes.map((h, i) => {
        const y = gasTop + PARTICLE_R + h.w * (gasH - 2 * PARTICLE_R);
        return (
          <line
            key={i}
            x1={xp + 5}
            x2={xp + 5}
            y1={y - 13}
            y2={y + 13}
            stroke={VIZ.applied}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={1 - 0.8 * h.age}
          />
        );
      })}

      {/* Kraften fra gassen på stempelet */}
      {fLen > 3 ? (
        <Arrow x1={xp + PISTON_W} y1={arrowY} x2={xp + PISTON_W + fLen} y2={arrowY} color={VIZ.applied} width={4} head={14} />
      ) : null}
      <Tag x={xp + PISTON_W + 10} y={arrowY - 16} anchor="start" color={VIZ.applied}>
        F = {fmt(F, 0)} N
      </Tag>

      <Tag x={GAS_LEFT + gasW / 2} y={CYL.bottom + 14 + 22 * f} muted>
        V = {fmt(V, 2)} L
      </Tag>
      <Tag x={GAS_LEFT} y={CYL.top - 22} anchor="start" muted>
        0,10 mol nitrogen
      </Tag>
    </>
  );
}

function PressureGraph({ T, V, p, height }: { T: number; V: number; p: number; height: number }) {
  const f = useTextScale();
  const tLo = -ZERO_CELSIUS;
  const tHi = T_MAX - ZERO_CELSIUS;
  const line = (vol: number): [number, number][] => [
    [tLo, 0],
    [tHi, gasPressure(GAS_N, T_MAX, vol * 1e-3) / 1000],
  ];
  return (
    <Plot
      x={{ min: -300, max: 350, label: 'Temperatur (°C)', ticks: [-300, -200, -100, 0, 100, 200, 300] }}
      y={{ min: 0, max: 520, label: 'Trykk p (kPa)', ticks: [0, 100, 200, 300, 400, 500] }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, y1 }) => {
        const px = sx(toCelsius(T));
        const py = sy(p / 1000);
        const zeroX = sx(tLo);
        const pText = `${fmt(p / 1000, 0)} kPa`;
        const labelRight = px < x0 + 130 * f;
        // Hvor mye linja stiger (piksler) fra punktet til høyre kant av etiketten
        const textW = 12 + pText.length * 0.6 * 17 * f;
        const slope = (sy(0) - sy(gasPressure(GAS_N, 100, V * 1e-3) / 1000)) / (sx(100 + tLo) - sx(tLo));
        const rise = slope * textW;
        return (
          <g>
            {OTHER_V.map((v) => (
              <path
                key={v}
                d={linePath(line(v), sx, sy)}
                fill="none"
                stroke={VIZ.muted}
                strokeWidth={1.5}
                strokeDasharray="6 5"
                opacity={0.8}
              />
            ))}
            <path d={linePath(line(V), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5} strokeLinecap="round" />
            {/* Det absolutte nullpunktet */}
            <line x1={zeroX} x2={zeroX} y1={sy(0)} y2={y1 + 6} className="viz-guide" />
            <Tag x={zeroX + 10} y={y1 + 18 * f} anchor="start">
              0 K = −273,15 °C
            </Tag>
            <Tag x={zeroX + 10} y={y1 + 18 * f + 24 * f} anchor="start" muted>
              alle linjene møtes her
            </Tag>
            {/* Nåværende tilstand */}
            <line x1={px} x2={px} y1={sy(0)} y2={py} stroke={VIZ.series[1]} strokeWidth={1.5} strokeDasharray="4 4" />
            <ColorDot x={px} y={py} r={8} color={VIZ.series[0]} />
            {/* Linja stiger mot høyre: til venstre for punktet står etiketten over linja. Nær venstre kant må den
                stå til høyre, og da løftes den så mye som linja stiger under teksten. */}
            <Tag x={labelRight ? px + 12 : px - 12} y={labelRight ? py - 8 - rise : py - 14} anchor={labelRight ? 'start' : 'end'} color={VIZ.series[0]}>
              {pText}
            </Tag>
          </g>
        );
      }}
    </Plot>
  );
}

function explanation(T: number, V: number, p: number, F: number, vTyp: number): ReactNode {
  const tC = toCelsius(T);
  if (T < 0.5)
    return (
      <p>
        <strong>Det absolutte nullpunktet.</strong> Ved 0 K = −273,15 °C har partiklene så lite kinetisk energi som mulig. I modellen står
        de helt stille, treffer aldri stempelet, og trykket er null. Lavere temperatur finnes ikke, og derfor starter kelvinskalaen her. (En
        ekte gass blir flytende og fast lenge før.)
      </p>
    );
  const kPa = fmt(p / 1000, 0);
  const first = (
    <p>
      <strong>Trykk kommer fra støt.</strong> Partiklene farer rundt med en typisk fart på {fmt(vTyp, 0)} m/s og treffer veggene hele tiden.
      Hvert støt gir stempelet et lite dytt, og til sammen blir det kraften F = {fmt(F, 0)} N på arealet A = 50 cm², altså p = F/A = {kPa}{' '}
      kPa.
    </p>
  );
  const atRef = Math.abs(T - T_REF) < 2;
  const vRatio = V_REF / V;
  let second: ReactNode;
  if (atRef && Math.abs(V - V_REF) < 0.03) {
    second = (
      <p>
        Ved 20 °C og 2,40 L er trykket omtrent som lufttrykket. Øk temperaturen: partiklene får mer kinetisk energi og treffer stempelet
        både oftere og hardere.
      </p>
    );
  } else if (atRef) {
    second = (
      <p>
        Med {fmt(V, 2)} L i stedet for 2,40 L treffer partiklene stempelet {fmt(vRatio, 2)} ganger så ofte, så trykket blir {fmt(vRatio, 2)}{' '}
        ganger så stort. Halvt volum gir dobbelt trykk når temperaturen er den samme (pV = nRT).
      </p>
    );
  } else if (tC < 0) {
    second = (
      <p>
        Grafen viser at trykket går mot null ved −273,15 °C, uansett volum. Det er det absolutte nullpunktet, 0 K. I tilstandslikningen pV =
        nRT må T derfor alltid være i kelvin.
      </p>
    );
  } else if (tC >= 30) {
    const ratioC = tC / 20;
    const ratioK = T / T_REF;
    second = (
      <p>
        Pass på celsius: tallet {fmt(tC, 0)} er {fmt(ratioC, 1)} ganger så stort som 20, men ved samme volum blir trykket bare {fmt(ratioK, 2)}{' '}
        ganger så stort som ved 20 °C. Trykket er proporsjonalt med temperaturen i kelvin, {fmt(T, 0)} K mot 293 K.
      </p>
    );
  } else if (T > T_REF) {
    second = (
      <p>
        Høyere temperatur gir raskere partikler, som treffer stempelet oftere og hardere. Trykket er proporsjonalt med temperaturen i kelvin:{' '}
        {fmt(T, 0)} K / 293 K = {fmt(T / T_REF, 2)}.
      </p>
    );
  } else {
    second = (
      <p>
        Lavere temperatur gir langsommere partikler, som treffer stempelet sjeldnere og svakere. Trykket er proporsjonalt med temperaturen i
        kelvin: {fmt(T, 0)} K / 293 K = {fmt(T / T_REF, 2)}.
      </p>
    );
  }
  return (
    <>
      {first}
      {second}
    </>
  );
}
