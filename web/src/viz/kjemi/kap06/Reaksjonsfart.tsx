import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  PlayControls,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TFormel,
  TSub,
  atomColors,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  linePath,
  niceTicks,
  sample,
  scaleLinear,
  superscript,
  useContainerTextScale,
  useSimClock,
} from '../kit';
import {
  BOX_H,
  BOX_W,
  CATALYST_FACTOR,
  PARTICLE_R,
  T0,
  arrheniusFactor,
  boxPosition,
  energyDensity,
  fractionAbove,
  simulateBox,
  solidPieces,
  temperatureFactor,
  type BoxRun,
  type SolidPiece,
} from './model';

const C1 = VIZ.series[0]!;
const C2 = VIZ.series[1]!;
const T_REF = 25 + T0;
/** Modellen for produktenergien i energidiagrammet (eksoterm, kJ/mol). */
const DH_MODEL = -40;
/** Syrepartikler per mol/L i boksen. */
const PER_MOL = 16;
const BOX_T = 12;

export default function Reaksjonsfart() {
  const [Tc, setTc] = useState(25);
  const [dT, setDT] = useState(10);
  const [Ea, setEa] = useState(50);
  const [cat, setCat] = useState(false);
  const [c, setC] = useState(1);
  const [k, setK] = useState(1);
  const clock = useSimClock({ tMax: BOX_T, loop: true });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const T1 = Tc + T0;
  const T2 = Tc + dT + T0;
  const EaEff = cat ? Ea * CATALYST_FACTOR : Ea;
  const F1 = fractionAbove(EaEff, T1);
  const F2 = fractionAbove(EaEff, T2);
  const tempF = temperatureFactor(EaEff, T1, T2);
  const catF = fractionAbove(Ea * CATALYST_FACTOR, T1) / fractionAbove(Ea, T1);
  const fromRef = temperatureFactor(EaEff, T_REF, T1) * (cat ? fractionAbove(EaEff, T_REF) / fractionAbove(Ea, T_REF) : 1);
  const total = c * k * fromRef;
  const narrow = f > 1.3;
  const energyH = narrow ? Math.round(300 + 220 * (f - 1)) * 2 + 20 : Math.round(330 + 160 * (f - 1));
  const boxH = Math.round(475 + 40 * f + 10);

  return (
    <VizLayout>
      <Controls>
        <Slider
          label={
            <>
              Temperatur T<Sub>1</Sub>
            </>
          }
          ariaLabel="Temperatur"
          value={Tc}
          onChange={setTc}
          min={0}
          max={100}
          step={5}
          unit="°C"
        />
        <Slider label="Sammenlign med ΔT høyere" ariaLabel="Temperaturøkning" value={dT} onChange={setDT} min={5} max={50} step={5} unit="°C" />
        <Slider
          label={
            <>
              Aktiveringsenergi E<Sub>a</Sub>
            </>
          }
          ariaLabel="Aktiveringsenergi"
          value={Ea}
          onChange={setEa}
          min={20}
          max={100}
          step={5}
          unit="kJ/mol"
        />
      </Controls>
      <Toolbar>
        <Toggle label={`Med katalysator (Eₐ ${fmt(Ea * CATALYST_FACTOR, 0)} kJ/mol)`} checked={cat} onChange={setCat} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${energyH}`}
          label={`Energidiagram og energifordeling ved ${fmt(Tc, 0)} °C og ${fmt(Tc + dT, 0)} °C. Andelen med energi minst ${fmt(EaEff, 0)} kJ/mol er ${fmtSig(F1, 2)} og ${fmtSig(F2, 2)}.`}
          caption="Energifordelingen (Maxwell–Boltzmann) for partikler i gass. Arealet under hver kurve er 1, og det skraverte arealet er andelen partikler med energi minst Eₐ. Den lille ruta forstørrer halen."
          maxHeight={energyH}
        >
          <EnergyScene Ea={Ea} cat={cat} T1={T1} T2={T2} f={f} H={energyH} />
        </Figure>
      </div>
      <Legend
        items={[
          {
            color: C1,
            label: (
              <span>
                T<Sub>1</Sub> = {fmt(Tc, 0)} °C
              </span>
            ),
          },
          {
            color: C2,
            label: (
              <span>
                T<Sub>2</Sub> = {fmt(Tc + dT, 0)} °C
              </span>
            ),
          },
          {
            color: VIZ.ink,
            label: (
              <span>
                Aktiveringsenergi E<Sub>a</Sub>
              </span>
            ),
            dashed: true,
          },
          ...(cat ? [{ color: VIZ.series[2]!, label: 'Med katalysator', dashed: true }] : []),
        ]}
      />

      <Controls>
        <Slider
          label="Konsentrasjon av syre c"
          ariaLabel="Konsentrasjon av syre"
          value={c}
          onChange={setC}
          min={0.25}
          max={2}
          step={0.25}
          unit="mol/L"
          decimals={2}
        />
        <Slider
          label="Oppdeling av det faste stoffet"
          ariaLabel="Oppdeling"
          value={k}
          onChange={setK}
          min={1}
          max={4}
          step={1}
          format={(v) => (v === 1 ? 'én bit' : `${v * v} biter`)}
        />
      </Controls>
      <PlayControls clock={clock} decimals={1} />
      <Figure
        viewBox={`0 0 800 ${boxH}`}
        label={`Syrepartikler som kolliderer med et fast stoff delt i ${k * k} biter. Konsentrasjon ${fmt(c, 2)} mol/L.`}
        caption="Saltsyre på marmor (CaCO₃). Partiklene beveger seg raskere når temperaturen øker. Andelen effektive kollisjoner er sterkt forstørret: i virkeligheten har bare en svært liten andel nok energi."
        maxHeight={boxH}
      >
        <BoxScene c={c} k={k} T={T1} pEff={visualP(EaEff, Ea, T1)} t={clock.t} f={f} />
      </Figure>
      <Legend
        items={[
          {
            color: KJEMI.plus,
            label: (
              <span>
                Syrepartikler (H<Sub>3</Sub>O<sup>+</sup>)
              </span>
            ),
          },
          { color: VIZ.muted, label: 'Kollisjon uten nok energi' },
          { color: KJEMI.exo, label: 'Effektiv kollisjon (reaksjon)' },
        ]}
      />

      <Readouts>
        <Readout
          label={
            <>
              Andel med E ≥ E<Sub>a</Sub> ved T<Sub>1</Sub>
            </>
          }
          value={fmtSig(F1, 2)}
          tone={C1}
        />
        <Readout
          label={
            <>
              Fart ved T<Sub>2</Sub> mot T<Sub>1</Sub>
            </>
          }
          value={`× ${fmtSig(tempF, 3)}`}
          tone={C2}
        />
        <Readout label="Katalysator gir" value={cat ? `× ${fmtSig(catF, 2)}` : 'ingen'} tone={cat ? VIZ.series[2] : undefined} />
        <Readout label="Fart mot utgangspunktet" value={`× ${fmtSig(total, 3)}`} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          Andel med nok energi: {fmtSig(F2, 3)} ved {fmt(Tc + dT, 0)} °C og {fmtSig(F1, 3)} ved {fmt(Tc, 0)} °C, forholdet er {fmtSig(F2 / F1, 3)}
        </FormulaLine>
        <FormulaLine>
          Med raskere partikler (√T<Sub>2</Sub>/T<Sub>1</Sub> = {fmt(Math.sqrt(T2 / T1), 3)}): farten blir × {fmtSig(tempF, 3)} (Arrhenius: e
          <sup>−Eₐ/R·(1/T₂ − 1/T₁)</sup> = {fmtSig(arrheniusFactor(EaEff, T1, T2), 3)})
        </FormulaLine>
        <FormulaLine>
          Fart mot utgangspunktet (1 mol/L, én bit, 25 °C, uten katalysator): {fmt(c, 2)} · {k} · {fmtSig(fromRef, 3)} = {fmtSig(total, 3)}
        </FormulaLine>
      </Formula>

      <Explain>{explanation({ Tc, dT, Ea, EaEff, cat, F1, tempF, catF, c, k })}</Explain>
    </VizLayout>
  );
}

/** Sannsynligheten for at en kollisjon i boksen vises som effektiv: forstørret, men med samme forhold som andelene. */
function visualP(EaEff: number, Ea: number, T: number): number {
  return Math.min(0.9, 0.12 * (fractionAbove(EaEff, T) / fractionAbove(Ea, T_REF)));
}

/* ---------- Figur 1: energidiagram og energifordeling ---------- */

function EnergyScene({ Ea, cat, T1, T2, f, H }: { Ea: number; cat: boolean; T1: number; T2: number; f: number; H: number }) {
  const narrow = f > 1.3;
  const profile = narrow ? { x: 0, y: 0, w: 800, h: (H - 20) / 2 } : { x: 0, y: 0, w: 290, h: H };
  const dist = narrow ? { x: 0, y: (H - 20) / 2 + 20, w: 800, h: (H - 20) / 2 } : { x: 300, y: 0, w: 500, h: H };
  return (
    <g>
      <g transform={`translate(${profile.x} ${profile.y})`}>
        <Profile Ea={Ea} cat={cat} w={profile.w} h={profile.h} f={f} />
      </g>
      <g transform={`translate(${dist.x} ${dist.y})`}>
        <Distribution Ea={Ea} cat={cat} T1={T1} T2={T2} w={dist.w} h={dist.h} f={f} />
      </g>
    </g>
  );
}

/** Energidiagram: reaktanter, toppen (aktivert kompleks) og produkter, med og uten katalysator. */
function Profile({ Ea, cat, w, h, f }: { Ea: number; cat: boolean; w: number; h: number; f: number }) {
  const m = { top: 34 * f, bottom: 30 * f, left: 46 * f, right: 12 };
  const y0 = DH_MODEL - 24;
  const y1 = Ea + 18;
  const sx = scaleLinear([0, 1], [m.left, w - m.right]);
  const sy = scaleLinear([y0, y1], [h - m.bottom, m.top]);
  const path = (peak: number) =>
    `M${sx(0)},${sy(0)} L${sx(0.12)},${sy(0)} C${sx(0.3)},${sy(0)} ${sx(0.36)},${sy(peak)} ${sx(0.5)},${sy(peak)} C${sx(0.64)},${sy(peak)} ${sx(0.7)},${sy(DH_MODEL)} ${sx(0.88)},${sy(DH_MODEL)} L${sx(1)},${sy(DH_MODEL)}`;
  const EaC = Ea * CATALYST_FACTOR;
  const arrow = (x: number, top: number, color: string) => (
    <g>
      <line x1={x} x2={x} y1={sy(0)} y2={sy(top) + 8} stroke={color} strokeWidth={2} />
      <polygon points={`${x},${sy(top)} ${x - 5},${sy(top) + 9} ${x + 5},${sy(top) + 9}`} fill={color} />
    </g>
  );
  return (
    <g>
      <Txt x={m.left} y={20 * f} anchor="start" size={0.85} weight={650}>
        Energidiagram
      </Txt>
      <line x1={m.left} x2={m.left} y1={sy(y1)} y2={sy(y0)} className="viz-axis" />
      <line x1={m.left} x2={w - m.right} y1={sy(y0)} y2={sy(y0)} className="viz-axis" />
      <text x={16 * f} y={(sy(y0) + sy(y1)) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${16 * f} ${(sy(y0) + sy(y1)) / 2})`}>
        energi
      </text>
      <Txt x={(m.left + w - m.right) / 2} y={h - 8} size={0.75} muted>
        reaksjonsforløp
      </Txt>
      <line x1={sx(0)} x2={sx(1)} y1={sy(0)} y2={sy(0)} stroke={VIZ.grid} strokeWidth={1.2} strokeDasharray="4 4" />
      <path d={path(Ea)} fill="none" stroke={VIZ.ink} strokeWidth={3} />
      {cat && <path d={path(EaC)} fill="none" stroke={VIZ.series[2]} strokeWidth={3} strokeDasharray="8 5" />}
      {arrow(sx(0.5), Ea, VIZ.ink)}
      <Txt x={sx(0.5) - 7} y={sy(Ea / 2) + 6} anchor="end" size={0.85} weight={700}>
        E<TSub>a</TSub>
      </Txt>
      {cat && arrow(sx(0.56), EaC, VIZ.series[2]!)}
      <Txt x={sx(0.04)} y={sy(0) + 20 * f} anchor="start" size={0.72} muted>
        reaktanter
      </Txt>
      <Txt x={sx(1)} y={sy(DH_MODEL) + 20 * f} anchor="end" size={0.72} muted>
        produkter
      </Txt>
    </g>
  );
}

/** Energifordelingen ved T1 og T2 med skravert hale over Ea, og en forstørret rute av halen. */
function Distribution({ Ea, cat, T1, T2, w, h, f }: { Ea: number; cat: boolean; T1: number; T2: number; w: number; h: number; f: number }) {
  const clip = `kj-hale${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const EaEff = cat ? Ea * CATALYST_FACTOR : Ea;
  const xMax = Math.max(30, Ea * 1.12);
  const peak = energyDensity((((8.314 * T1) / 1000) * 1) / 2, T1);
  const yMax = peak * 1.15;
  const curve = (T: number, a: number, b: number) => sample((E) => energyDensity(E, T), a, b, 300);
  return (
    <Plot
      x={{ min: 0, max: xMax, label: 'kinetisk energi E (kJ/mol)', ticks: niceTicks(0, xMax, f > 1.3 ? 5 : 5) }}
      y={{ min: 0, max: yMax, label: 'andel partikler', ticks: [] }}
      width={w}
      height={h}
      margin={{ top: 30 * f, right: 14, bottom: 56 * f, left: 40 * f }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const tail = (T: number) => [...curve(T, EaEff, xMax), [xMax, 0] as [number, number], [EaEff, 0] as [number, number]];
        // Forstørret rute øverst til høyre: halen rundt Ea, skalert så T2-kurven står midt i ruta ved Ea
        const RT = (8.314 * T1) / 1000;
        const z0 = Math.max(0.5, EaEff - 2 * RT);
        const z1 = EaEff + 5 * RT;
        const zTop = energyDensity(EaEff, T2) / 0.5;
        const mag = Math.round(Math.log10(yMax / zTop));
        const box = { x: x0 + (x1 - x0) * 0.42, y: y1 + 4, w: (x1 - x0) * 0.56, h: (y0 - y1) * 0.62 };
        const zx = scaleLinear([z0, z1], [box.x + 6, box.x + box.w - 6]);
        const zy = scaleLinear([0, zTop], [box.y + box.h - 6, box.y + 26 * f]);
        const zCurve = (T: number) => sample((E) => energyDensity(E, T), z0, z1, 120);
        const zTail = (T: number) => [...sample((E) => energyDensity(E, T), EaEff, z1, 100), [z1, 0] as [number, number], [EaEff, 0] as [number, number]];
        const eaX = sx(EaEff);
        const eaTop = eaX > box.x - 4 && eaX < box.x + box.w + 4 ? box.y + box.h + 4 : y1;
        return (
          <g>
            <path d={`${linePath(tail(T2), sx, sy)}Z`} fill={C2} opacity={0.25} />
            <path d={`${linePath(tail(T1), sx, sy)}Z`} fill={C1} opacity={0.3} />
            <path d={linePath(curve(T1, 0, xMax), sx, sy)} fill="none" stroke={C1} strokeWidth={3} />
            <path d={linePath(curve(T2, 0, xMax), sx, sy)} fill="none" stroke={C2} strokeWidth={3} />
            {cat && (
              <line
                x1={sx(Ea)}
                x2={sx(Ea)}
                y1={y0}
                y2={sx(Ea) > box.x - 4 && sx(Ea) < box.x + box.w + 4 ? box.y + box.h + 4 : y1}
                stroke={VIZ.ink}
                strokeWidth={1.5}
                strokeDasharray="6 5"
                opacity={0.4}
              />
            )}
            <line x1={eaX} x2={eaX} y1={y0} y2={eaTop} stroke={cat ? VIZ.series[2] : VIZ.ink} strokeWidth={2} strokeDasharray="6 5" />
            <Txt x={sx(EaEff) - 6} y={y0 - 10} anchor="end" size={0.8} weight={700} color={cat ? VIZ.series[2] : undefined}>
              E<TSub>a</TSub>
            </Txt>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.2} />
            <Txt x={box.x + 10} y={box.y + 18 * f} anchor="start" size={0.72} muted>
              halen forstørret × 10{superscript(Math.max(0, mag))}
            </Txt>
            <clipPath id={clip}>
              <rect x={box.x} y={box.y + 22 * f} width={box.w} height={box.h - 22 * f} />
            </clipPath>
            {zTop > 0 && (
              <g clipPath={`url(#${clip})`}>
                <path d={`${linePath(zTail(T2), zx, zy)}Z`} fill={C2} opacity={0.25} />
                <path d={`${linePath(zTail(T1), zx, zy)}Z`} fill={C1} opacity={0.3} />
                <path d={linePath(zCurve(T1), zx, zy)} fill="none" stroke={C1} strokeWidth={2.5} />
                <path d={linePath(zCurve(T2), zx, zy)} fill="none" stroke={C2} strokeWidth={2.5} />
                <line
                  x1={zx(EaEff)}
                  x2={zx(EaEff)}
                  y1={box.y + box.h - 6}
                  y2={box.y + 24 * f}
                  stroke={cat ? VIZ.series[2] : VIZ.ink}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              </g>
            )}
            <line x1={box.x + 6} x2={box.x + box.w - 6} y1={box.y + box.h - 6} y2={box.y + box.h - 6} stroke={VIZ.muted} strokeWidth={1} />
          </g>
        );
      }}
    </Plot>
  );
}

/* ---------- Figur 2: partikkelboksen ---------- */

function BoxScene({ c, k, T, pEff, t, f }: { c: number; k: number; T: number; pEff: number; t: number; f: number }) {
  const n = Math.round(c * PER_MOL);
  const pieces = useMemo(() => solidPieces(k), [k]);
  const speed = 0.6 * Math.sqrt(T / T_REF);
  const run = useMemo(() => simulateBox({ n, pieces, speed, pEffective: pEff, tMax: BOX_T, seed: 4 }), [n, pieces, speed, pEff]);
  const s = 760 / BOX_W;
  const ox = 20;
  const oy = 34 * f;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const kk = Math.max(1, 0.85 * f);
  const r = Math.max(PARTICLE_R * s, 6.5 * kk);
  const tt = ((t % BOX_T) + BOX_T) % BOX_T;
  const window = 0.35;
  const recent = run.hits.filter((h) => h.t <= tt && h.t > tt - window);
  const per = (run.hits.length / BOX_T).toFixed(0);
  const eff = run.hits.filter((h) => h.effective).length / BOX_T;
  return (
    <g>
      <Txt x={ox} y={22 * f} anchor="start" size={0.85} weight={650}>
        {Number(per) === 0
          ? 'Ingen kollisjoner'
          : f > 1.3
            ? `${per} ${Number(per) === 1 ? 'kollisjon' : 'kollisjoner'}/s, ${fmt(eff, 1)} effektive`
            : `${per} ${Number(per) === 1 ? 'kollisjon' : 'kollisjoner'} per sekund med overflaten, ${fmt(eff, 1)} effektive`}
      </Txt>
      <rect x={X(0)} y={Y(0)} width={BOX_W * s} height={BOX_H * s} rx={10} fill={KJEMI.liquid} stroke={KJEMI.glass} strokeWidth={2} />
      {pieces.map((p, i) => (
        <Piece key={i} p={p} X={X} Y={Y} s={s} label={k === 1} />
      ))}
      {Array.from({ length: run.n }, (_, i) => {
        const pos = boxPosition(run, i, t);
        return <circle key={i} cx={X(pos.x)} cy={Y(pos.y)} r={r} fill={KJEMI.plus} stroke={VIZ.surface} strokeWidth={1} />;
      })}
      {recent.map((h, i) => {
        const age = (tt - h.t) / window;
        return h.effective ? (
          <g key={i} opacity={1 - age}>
            <circle cx={X(h.x)} cy={Y(h.y)} r={(10 + 14 * age) * kk} fill="none" stroke={KJEMI.exo} strokeWidth={3 * kk} />
            <circle cx={X(h.x)} cy={Y(h.y) - 16 * age * kk} r={4 * kk} fill={KJEMI.exo} />
          </g>
        ) : (
          <circle key={i} cx={X(h.x)} cy={Y(h.y)} r={7 * kk} fill="none" stroke={VIZ.muted} strokeWidth={2 * kk} opacity={1 - age} />
        );
      })}
      <BoxCaption run={run} k={k} X={X} Y={Y} />
    </g>
  );
}

/** Marmorbit (beige, samme farge som halvmetallene i kit-et). */
const MARBLE = atomColors('Si');

function Piece({ p, X, Y, s, label }: { p: SolidPiece; X: (v: number) => number; Y: (v: number) => number; s: number; label: boolean }) {
  const size = p.s * s;
  return (
    <g>
      <rect x={X(p.x)} y={Y(p.y)} width={size} height={size} rx={Math.min(6, size * 0.12)} fill={MARBLE.fill} stroke={MARBLE.line} strokeWidth={2} />
      {label && (
        <Txt x={X(p.x) + size / 2} y={Y(p.y) + size / 2 + 6} size={0.9} weight={650} color={MARBLE.ink} halo={false}>
          <TFormel f="CaCO3" />
        </Txt>
      )}
    </g>
  );
}

function BoxCaption({ run, k, X, Y }: { run: BoxRun; k: number; X: (v: number) => number; Y: (v: number) => number }) {
  return (
    <Txt x={X(BOX_W) - 10} y={Y(BOX_H) - 12} anchor="end" size={0.75} muted halo>
      {run.n} syrepartikler · overflate × {k}
    </Txt>
  );
}

/* ---------- Forklaring ---------- */

function explanation(p: {
  Tc: number;
  dT: number;
  Ea: number;
  EaEff: number;
  cat: boolean;
  F1: number;
  tempF: number;
  catF: number;
  c: number;
  k: number;
}): ReactNode {
  const { Tc, dT, Ea, EaEff, cat, F1, tempF, catF, c, k } = p;
  const rule =
    dT === 10 ? (
      tempF > 1.7 && tempF < 2.4 ? (
        <>
          Det er derfor tommelfingerregelen sier at <strong>10 °C høyere omtrent dobler farten</strong>: for en typisk E<Sub>a</Sub> rundt 50 kJ/mol blir
          andelen med nok energi omtrent dobbelt så stor.
        </>
      ) : tempF <= 1.7 ? (
        <>Med så lav aktiveringsenergi øker farten mindre enn tommelfingerregelen («10 °C dobler farten») sier, fordi en stor andel allerede har nok energi.</>
      ) : (
        <>
          Med så høy aktiveringsenergi øker farten mer enn tommelfingerregelen («10 °C dobler farten») sier: regelen gjelder for E<Sub>a</Sub> rundt 50 kJ/mol.
        </>
      )
    ) : (
      <>Velg ΔT = 10 °C for å se tommelfingerregelen «10 °C høyere dobler farten».</>
    );
  return (
    <>
      <p>
        <strong>Kollisjonsteorien:</strong> partiklene må kollidere, med riktig orientering og med minst aktiveringsenergien E<Sub>a</Sub>, for å reagere. Ved{' '}
        {fmt(Tc, 0)} °C har bare {fmtSig(F1, 2)} av partiklene så mye energi (E<Sub>a</Sub> = {fmt(EaEff, 0)} kJ/mol), så de aller fleste kollisjonene fører
        ikke til reaksjon.
      </p>
      <p>
        Øker du temperaturen med {fmt(dT, 0)} °C, flytter fordelingen seg mot høyere energi, og den skraverte halen blir {fmtSig(tempF, 2)} ganger så stor (med
        litt raskere partikler). {rule} Temperaturen endrer ikke E<Sub>a</Sub>, bare hvor mange partikler som klarer den.
      </p>
      {cat ? (
        <p>
          <strong>Katalysatoren</strong> gir en annen reaksjonsvei med lavere aktiveringsenergi ({fmt(EaEff, 0)} i stedet for {fmt(Ea, 0)} kJ/mol). Da får
          omtrent {fmtSig(catF, 2)} ganger så mange partikler nok energi. Katalysatoren gir ikke partiklene mer energi, og den brukes ikke opp.
        </p>
      ) : (
        <p>Slå på katalysatoren for å se hva en lavere aktiveringsenergi betyr.</p>
      )}
      <p>
        I boksen reagerer saltsyre med marmor: <Formel f="CaCO3(s)" /> + 2 <Formel f="H3O^+(aq)" /> → <Formel f="Ca^2+(aq)" /> + <Formel f="CO2(g)" /> + 3{' '}
        <Formel f="H2O(l)" />. {c >= 1.5 ? 'Høy' : c <= 0.5 ? 'Lav' : 'Middels'} konsentrasjon ({fmt(c, 2)} mol/L) gir{' '}
        {c > 1 ? 'flere' : c < 1 ? 'færre' : 'like mange'} syrepartikler per volum og dermed {c === 1 ? 'like mange' : c > 1 ? 'flere' : 'færre'} kollisjoner
        per sekund.{' '}
        {k > 1
          ? `Delt i ${k * k} biter har marmoren ${k} ganger så stor overflate (samme mengde stoff), så det skjer ${k} ganger så mange kollisjoner med overflaten. Derfor reagerer pulver mye raskere enn en klump.`
          : 'Del marmoren i flere biter for å se hvordan større overflate gir flere kollisjoner.'}
      </p>
    </>
  );
}
