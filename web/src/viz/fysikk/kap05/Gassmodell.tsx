import { useMemo, useState, type ReactNode } from 'react';
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
  Slider,
  Sup,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  useSimClock,
  useTextScale,
} from '../../kit';
import {
  Dimension,
  ForceArrow,
  Kokeplate,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  sphereStops,
  RadialGradient,
  useSceneScale,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { GAS_MOLAR_U, GAS_N, ZERO_CELSIUS, gasPressure, toCelsius, typicalSpeed } from './model';
import { ColorDot, PlayToggle, useGasSim, useNarrow } from './marks';
import {
  MANOMETER_MAX,
  MAAL,
  PX_PER_M,
  T_MAX,
  T_REF,
  V_MAX,
  V_MIN,
  V_REF,
  cylinderAt,
  forceArrowLength,
  frostAmount,
  gasWarmth,
  gaugeAngle,
  frontArcDepth,
  particlePoint,
  pistonForce,
  plateEffect,
  sceneLayout,
  type SceneLayout,
} from './gassmodell-scene';
import {
  Bunnplate,
  DigitalTermometer,
  Foler,
  Gass,
  Klemme,
  Manometer,
  Rim,
  Slange,
  Stempel,
  StativBak,
  SylinderBak,
  SylinderForan,
} from './gassmodell-deler';

/** Volumene som vises som tynne linjer i grafen. */
const OTHER_V = [1.0, 2.0, 3.0];
const PARTICLE_R = 5;
/** Partikkelfart i figuren (piksler per sekund) ved 300 K. Ekte molekyler er mange tusen ganger raskere. */
const SPEED_PX = 95;
/** Tverrsnittsarealet i cm² (til tekstene). */
const AREA_CM2 = 200;

export default function Gassmodell() {
  const [T, setT] = useState(T_REF);
  const [V, setV] = useState(V_REF);
  const [showForces, setShowForces] = useState(true);
  const clock = useSimClock({ tMax: 3600, loop: true });
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const [sceneRef, sceneNarrow] = useNarrow<HTMLDivElement>();
  const layout = sceneLayout(sceneNarrow);

  const p = gasPressure(GAS_N, T, V * 1e-3);
  const F = pistonForce(p);
  const tC = toCelsius(T);
  const vTyp = typicalSpeed(T, GAS_MOLAR_U);
  // På mobil får grafen en smalere viewBox, så teksten ikke blir så stor i forhold til plottet
  const graphW = narrow ? 540 : 800;
  const graphH = narrow ? 440 : 380;

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
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>

      <div ref={sceneRef}>
        <Figure
          viewBox={layout.viewBox}
          label={`Glassylinder med stempel på en kokeplate. Gassen inni har temperatur ${fmt(T, 0)} K (${fmt(tC, 0)} °C) og volum ${fmt(V, 2)} liter. Manometeret viser ${fmt(p / 1000, 0)} kilopascal, og gassen skyver på stempelet med ${fmt(F, 0)} newton.`}
          maxHeight={540}
        >
          <Scene t={clock.t} T={T} V={V} p={p} F={F} layout={layout} showForces={showForces} />
        </Figure>
      </div>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 ${graphW} ${graphH}`} label="Graf over trykket som funksjon av temperaturen i celsius og kelvin for ulike volum">
          <PressureGraph T={T} V={V} p={p} width={graphW} height={graphH} />
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
          F = p · A = {fmt(p / 1000, 1)} kPa · {AREA_CM2} cm² = {fmt(p, 0)} Pa · 0,0200 m² = {fmt(F, 0)} N
        </FormulaLine>
      </Formula>

      <Explain>{explanation(T, V, p, F, vTyp)}</Explain>
    </VizLayout>
  );
}

/* ---------------------------------------------------------------- Scenen */

function Scene({
  t,
  T,
  V,
  p,
  F,
  layout,
  showForces,
}: {
  t: number;
  T: number;
  V: number;
  p: number;
  F: number;
  layout: SceneLayout;
  showForces: boolean;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const pid = useSvgId('partikkel');
  const { cx, benchY, poleX } = layout;
  const g = cylinderAt(layout, V);
  const e = g.ellipse;
  const pr = PARTICLE_R * Math.min(1.35, k);
  const scale = Math.sqrt(Math.max(0, T) / 300);
  const sim = useGasSim(t, {
    count: 36,
    seed: 20240905,
    speed: SPEED_PX,
    scale,
    width: g.gasH - 2 * pr,
    height: 2 * (g.r - pr),
  });

  const heat = plateEffect(T);
  const frost = frostAmount(T);
  const rodW = MAAL.stang * PX_PER_M;
  const flensR = g.flensR;
  const flensBottom = g.plateTop;

  // Bakgrunnen endrer seg ikke når partiklene beveger seg
  const backdrop = useMemo(
    () => (
      <>
        <Rom x={layout.left} y={0} w={layout.right - layout.left} h={layout.bottom} gulvY={benchY + (layout.bottom - benchY) * 0.8} gulv="betong" />
        <Underlag x1={layout.left - 10} x2={layout.right + 10} y={benchY} depth={layout.bottom - benchY + 4} type="labbenk" />
      </>
    ),
    [layout.left, layout.right, layout.bottom, benchY],
  );

  // Manometeret på stativstanga og slangen fra bunnplata
  const gaugeR = MAAL.manometerR * PX_PER_M;
  const gaugeY = benchY - 212;
  const gaugeBottom = gaugeY + gaugeR * 1.08 + 6;
  const nipple = { x: cx + flensR + 10, y: g.flensTop + (flensBottom - g.flensTop) / 2 };
  const hose = `M${nipple.x},${nipple.y} C${nipple.x + 70},${nipple.y + 26} ${poleX},${nipple.y + 24} ${poleX},${gaugeBottom}`;

  // Termometeret og ledningen til føleren (gjennom bunnplata foran)
  const thermo = layout.narrow ? { x: layout.thermoX, w: 64, h: 98 } : { x: layout.thermoX, w: 72, h: 112 };
  const plugX = thermo.x + thermo.w * 0.25;
  const plugY = benchY - thermo.h - 7;
  const portX = cx + (layout.narrow ? 0.42 : -0.42) * flensR;
  const port = { x: portX, y: flensBottom + flensR * e * Math.sqrt(1 - 0.42 ** 2) - (flensBottom - g.flensTop) / 2 };
  const cable = layout.narrow
    ? `M${port.x},${port.y} C${port.x + 30},${benchY + 24} ${plugX - 60},${benchY - 4} ${plugX},${plugY}`
    : `M${port.x},${port.y} C${port.x - 20},${benchY + 22} ${plugX + 70},${benchY - 4} ${plugX},${plugY}`;
  const probeX = cx + (layout.narrow ? 0.42 : -0.42) * g.r;

  // Kraftpila: fra undersiden av stempelet (der gassen skyver) og opp, til venstre for stanga
  const fLen = forceArrowLength(p);
  const arrowX = cx - g.r * 0.5;
  const arrowY0 = g.gasTop + frontArcDepth(g, cx, arrowX);
  const fText = `F = ${fmt(F, 0)} N`;

  const gasMidY = (g.gasTop + g.flensTop) / 2;
  const dimOffset = layout.narrow ? 12 : 18;
  const dimX = cx - g.rOuter - dimOffset;

  // Skiltet med trykket over manometeret, men innenfor høyre kant av utsnittet (samme bredde som ValueTag regner ut)
  const pTag = `p = ${fmt(p / 1000, 0)} kPa`;
  const tagFs = 17 * f * 0.9;
  const tagHalf = Math.max(tagFs * 1.6, pTag.length * tagFs * 0.6 + 16 * f) / 2;
  const pTagX = Math.min(poleX, layout.right - tagHalf - 6);

  return (
    <>
      {backdrop}

      <StativBak poleX={poleX} benchY={benchY} topY={g.clampY - 30} footL={poleX - 80} footR={poleX + 34} />
      <Kokeplate x={cx} y={benchY} w={g.plateW} effekt={heat} title={heat > 0 ? 'Kokeplate som står på' : 'Kokeplate, slått av'} />
      <Bunnplate cx={cx} top={g.flensTop} R={flensR} thick={flensBottom - g.flensTop} e={e} heat={heat} portX={portX} />

      {/* Glassylinderen med gassen, partiklene og stempelet */}
      <SylinderBak cx={cx} r={g.r} rOuter={g.rOuter} rimY={g.rimY} bottom={g.flensTop} e={e} />
      <Gass cx={cx} r={g.r} top={g.gasTop} bottom={g.flensTop} e={e} warmth={gasWarmth(T)} />
      <Foler x={probeX} bottom={g.flensTop + g.r * e * 0.5} len={34} />
      <RadialGradient id={pid} fx={0.35} fy={0.32} stops={sphereStops(VIZ.series[0])} />
      <g aria-hidden>
        {sim.particles.map((pt, i) => {
          const { x, y } = particlePoint(g, cx, pr, pt.u, pt.w);
          // Simuleringen: vx er mot stempelet (opp), vy bortover
          const tail = 0.16 * scale;
          const tx = Math.max(cx - g.r, Math.min(cx + g.r, x - pt.vy * tail));
          const td = frontArcDepth(g, cx, tx);
          const ty = Math.max(g.gasTop + td, Math.min(g.flensTop + td, y + pt.vx * tail));
          return (
            <g key={i}>
              {scale > 0 && <line x1={tx} y1={ty} x2={x} y2={y} stroke={alpha(VIZ.series[0], 0.4)} strokeWidth={2.6 * ss} strokeLinecap="round" />}
              <circle cx={x} cy={y} r={pr} fill={`url(#${pid})`} stroke={alpha(VIZ.surface, 0.5)} strokeWidth={0.6 * ss} />
            </g>
          );
        })}
      </g>
      <Stempel cx={cx} r={g.r - 0.5} top={g.pistonTop} bottom={g.gasTop} e={e} rodTop={g.rodTop} rodW={rodW} />
      {/* Støt mot stempelet: korte grønne blink langs underkanten, der partikkelen traff */}
      <g aria-hidden>
        {sim.flashes.map((h, i) => {
          const x = cx - (g.r - pr) + h.w * 2 * (g.r - pr);
          const y = g.gasTop + frontArcDepth(g, cx, x) + 1.5;
          return (
            <line
              key={i}
              x1={x - 11}
              x2={x + 11}
              y1={y}
              y2={y}
              stroke={VIZ.applied}
              strokeWidth={5 * ss}
              strokeLinecap="round"
              opacity={1 - 0.8 * h.age}
            />
          );
        })}
      </g>
      <SylinderForan cx={cx} r={g.r} rOuter={g.rOuter} rimY={g.rimY} bottom={g.flensTop} e={e} />
      <Rim cx={cx} rOuter={g.rOuter} top={g.rimY} bottom={g.flensTop} amount={frost} />
      <Klemme poleX={poleX} y={g.clampY} rodX={cx} rodW={rodW} />

      {/* Manometeret og termometeret */}
      <Slange d={hose} width={6 * Math.min(1.3, ss)} color={SCENE.rubberLight} />
      <Manometer x={poleX} y={gaugeY} r={gaugeR} angle={gaugeAngle(p / 1000)} max={MANOMETER_MAX} title={`Manometer som viser ${fmt(p / 1000, 0)} kPa`} />
      <Slange d={cable} width={3.4 * Math.min(1.3, ss)} color={SCENE.rubber} />
      <DigitalTermometer x={thermo.x} y={benchY} w={thermo.w} h={thermo.h} tekst={`${fmt(toCelsius(T), 0)} °C`} title={`Digitalt termometer som viser ${fmt(toCelsius(T), 0)} °C`} />

      {/* Fysikken oppå */}
      <Dimension x1={cx - g.rOuter} y1={g.flensTop} x2={cx - g.rOuter} y2={g.gasTop} offset={dimOffset} label={`V = ${fmt(V, 2)} L`} />
      {/* Stoffmengden står rett over volumet, på samme side av sylinderen */}
      <Txt x={dimX - 8 * f} y={gasMidY + 6 * f - 21 * f} anchor="end" size={0.8} weight={600} muted>
        0,10 mol N₂
      </Txt>
      <ValueTag x={pTagX} y={gaugeY - gaugeR - 24 * f} text={pTag} color={VIZ.series[0]} pointer={8} />
      <ValueTag x={thermo.x} y={benchY - thermo.h - 34 * f} text={`T = ${fmt(T, 0)} K`} color={VIZ.series[1]} pointer={8} />
      {showForces &&
        (fLen > 3 ? (
          <ForceArrow
            x1={arrowX}
            y1={arrowY0}
            x2={arrowX}
            y2={arrowY0 - fLen}
            color={VIZ.applied}
            label={fText}
            labelX={arrowX - 14}
            labelY={arrowY0 - fLen + 14 * f}
            labelAnchor="end"
            origin
          />
        ) : (
          <Txt x={arrowX - 14} y={g.pistonTop - 10} anchor="end" color={VIZ.applied} weight={720}>
            {fText}
          </Txt>
        ))}
    </>
  );
}

/* ---------------------------------------------------------------- Grafen */

function PressureGraph({ T, V, p, width, height }: { T: number; V: number; p: number; width: number; height: number }) {
  const f = useTextScale();
  const tLo = -ZERO_CELSIUS;
  const tHi = T_MAX - ZERO_CELSIUS;
  const line = (vol: number): [number, number][] => [
    [tLo, 0],
    [tHi, gasPressure(GAS_N, T_MAX, vol * 1e-3) / 1000],
  ];
  const kTicks = f > 1.3 ? [0, 200, 400, 600] : [0, 100, 200, 300, 400, 500, 600];
  return (
    <Plot
      x={{ min: -300, max: 350, label: 'Temperatur t (°C)', ticks: [-300, -200, -100, 0, 100, 200, 300] }}
      y={{ min: 0, max: 520, label: 'Trykk p (kPa)', ticks: [0, 100, 200, 300, 400, 500] }}
      width={width}
      height={height}
      margin={{ top: 52 * f, right: 58 * f, bottom: 56 * f, left: 72 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const px = sx(toCelsius(T));
        const py = sy(p / 1000);
        const zeroX = sx(tLo);
        const pText = `${fmt(p / 1000, 0)} kPa`;
        const labelRight = px < x0 + 150 * f;
        // Hvor mye linja stiger (piksler) fra punktet til kanten av etiketten
        const textW = 16 * f + pText.length * 0.6 * 17 * 0.9 * f;
        const slope = (sy(0) - sy(gasPressure(GAS_N, 100, V * 1e-3) / 1000)) / (sx(100 + tLo) - sx(tLo));
        const rise = slope * textW;
        const area = `M${sx(tLo)},${sy(0)} L${px},${py} L${px},${sy(0)} Z`;
        return (
          <g>
            {/* Kelvinskalaen øverst, rett over celsiusskalaen */}
            <line x1={x0} x2={x1} y1={y1} y2={y1} className="viz-axis" />
            {kTicks.map((kv) => {
              const x = sx(kv - ZERO_CELSIUS);
              return (
                <g key={kv}>
                  <line x1={x} x2={x} y1={y1} y2={y1 - 6} className="viz-axis" />
                  <text x={x} y={y1 - 11} textAnchor="middle" className="viz-tick">
                    {fmt(kv, 0)}
                  </text>
                </g>
              );
            })}
            <Txt x={x0 - 10} y={y1 - 11} anchor="end" size={0.85} weight={650} muted>
              T (K)
            </Txt>

            {/* Arealet under linja fram til tilstanden nå, og linjene for de andre volumene */}
            {T > 0.5 && <path d={area} fill={alpha(VIZ.series[0], 0.08)} />}
            {OTHER_V.map((v) => {
              const end = line(v)[1]!;
              const ex = sx(end[0]);
              const ey = sy(end[1]);
              return (
                <g key={v}>
                  <path d={linePath(line(v), sx, sy)} fill="none" stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="6 5" opacity={0.8} />
                  {/* Etiketten ved enden skjules når punktet for tilstanden nå ligger oppå den */}
                  {!(Math.abs(V - v) < 0.03 && T > T_MAX - 60) && (
                    <Txt x={ex + 12} y={ey + 5 * f} anchor="start" size={0.72} muted>
                      {fmt(v, 1)} L
                    </Txt>
                  )}
                </g>
              );
            })}
            <path d={linePath(line(V), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3.5} strokeLinecap="round" />

            {/* Det absolutte nullpunktet */}
            <line x1={zeroX} x2={zeroX} y1={sy(0)} y2={y1} className="viz-guide" />
            <Txt x={zeroX + 10} y={y1 + 22 * f} anchor="start" weight={650}>
              0 K = −273,15 °C
            </Txt>
            <Txt x={zeroX + 10} y={y1 + 22 * f + 23 * f} anchor="start" muted size={0.9}>
              alle linjene møtes her
            </Txt>

            {/* Tilstanden nå: stiplede linjer ned til temperaturen og bort til trykket */}
            <line x1={px} x2={px} y1={y0} y2={py} stroke={VIZ.series[1]} strokeWidth={1.6} strokeDasharray="4 4" />
            <line x1={x0} x2={px} y1={py} y2={py} stroke={VIZ.series[0]} strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7} />
            <ColorDot x={px} y={py} r={8} color={VIZ.series[0]} />
            <ValueTag
              x={labelRight ? px + 14 : px - 14}
              y={labelRight ? py - 16 * f - rise : py - 20 * f}
              anchor={labelRight ? 'start' : 'end'}
              text={pText}
              color={VIZ.series[0]}
              size={0.85}
            />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------------------------------------------------------------- Forklaringen */

function explanation(T: number, V: number, p: number, F: number, vTyp: number): ReactNode {
  const tC = toCelsius(T);
  if (T < 0.5)
    return (
      <p>
        <strong>Det absolutte nullpunktet.</strong> Ved 0 K = −273,15 °C har partiklene så lite kinetisk energi som mulig. I modellen står
        de helt stille, treffer aldri stempelet, og manometeret viser null. Lavere temperatur finnes ikke, og derfor starter kelvinskalaen
        her. (En ekte gass blir flytende og fast lenge før.)
      </p>
    );
  const kPa = fmt(p / 1000, 0);
  const first = (
    <p>
      <strong>Trykk kommer fra støt.</strong> Partiklene farer rundt med en typisk fart på {fmt(vTyp, 0)} m/s og treffer veggene hele tiden.
      Hvert støt gir stempelet et lite dytt (de grønne blinkene), og til sammen blir det kraften F = {fmt(F, 0)} N på arealet A ={' '}
      {AREA_CM2} cm². Det er trykket p = F/A = {kPa} kPa som manometeret viser. Klemmen på stativet holder stempelet fast, så volumet
      endrer seg ikke.
    </p>
  );
  const atRef = Math.abs(T - T_REF) < 2;
  const vRatio = V_REF / V;
  let second: ReactNode;
  if (atRef && Math.abs(V - V_REF) < 0.03) {
    second = (
      <p>
        Ved 20 °C og 2,40 L er trykket omtrent som lufttrykket utenfor. Skru på kokeplata (øk temperaturen): partiklene får mer kinetisk
        energi og treffer stempelet både oftere og hardere.
      </p>
    );
  } else if (atRef) {
    second = (
      <p>
        Med {fmt(V, 2)} L i stedet for 2,40 L treffer partiklene stempelet {fmt(vRatio, 2)} ganger så ofte, så trykket blir {fmt(vRatio, 2)}{' '}
        ganger så stort. Halvt volum gir dobbelt trykk når temperaturen er den samme (pV = nRT).
        {V < V_REF
          ? ' Det er derfor det blir tungt å presse inn en sykkelpumpe når du holder tommelen over ventilen.'
          : ' Mer plass betyr at hver partikkel bruker lengre tid mellom hvert støt mot stempelet.'}
      </p>
    );
  } else if (tC < 0) {
    second = (
      <p>
        Gassen er kjølt ned under 0 °C (se rimet på glasset). Grafen viser at trykket går mot null ved −273,15 °C, uansett volum. Det er det
        absolutte nullpunktet, 0 K. I tilstandslikningen pV = nRT må T derfor alltid være i kelvin. Det er derfor lufttrykket i bildekkene
        synker når det blir kaldt om vinteren.
      </p>
    );
  } else if (tC >= 30) {
    const ratioC = tC / 20;
    const ratioK = T / T_REF;
    second = (
      <p>
        Pass på celsius: termometeret viser {fmt(tC, 0)} °C, som er {fmt(ratioC, 1)} ganger så mye som 20, men ved samme volum blir trykket
        bare {fmt(ratioK, 2)} ganger så stort som ved 20 °C. Trykket er proporsjonalt med temperaturen i kelvin, {fmt(T, 0)} K mot 293 K.
        Det er derfor spraybokser aldri skal ligge i sola eller nær en varmekilde.
      </p>
    );
  } else if (T > T_REF) {
    second = (
      <p>
        Høyere temperatur gir raskere partikler, som treffer stempelet oftere og hardere. Trykket er proporsjonalt med temperaturen i kelvin:{' '}
        {fmt(T, 0)} K / 293 K = {fmt(T / T_REF, 2)}. Det er derfor dekktrykket skal måles mens dekkene er kalde: etter en lang kjøretur er
        lufta i dem varmere, og trykket høyere.
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

