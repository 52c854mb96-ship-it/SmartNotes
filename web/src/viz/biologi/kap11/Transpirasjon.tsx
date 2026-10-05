import { useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Etikett,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Plot,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  G_MAX,
  P_AIR,
  gramsPerHour,
  photosynthesisAt,
  plantState,
  saturationVaporPressure,
  transpirationAt,
  vpd,
  type PlantState,
  type Weather,
} from './model';

type PresetId = 'sommerdag' | 'varm' | 'regn' | 'natt' | 'torke';
const PRESETS: { id: PresetId; label: string; w: Weather }[] = [
  { id: 'sommerdag', label: 'Sommerdag', w: { light: 70, rh: 50, T: 22, wind: 2, soil: 70 } },
  { id: 'varm', label: 'Varm og tørr dag', w: { light: 100, rh: 25, T: 30, wind: 5, soil: 60 } },
  { id: 'regn', label: 'Regnvær', w: { light: 15, rh: 95, T: 14, wind: 3, soil: 100 } },
  { id: 'natt', label: 'Natt', w: { light: 0, rh: 85, T: 12, wind: 1, soil: 70 } },
  { id: 'torke', label: 'Tørke', w: { light: 100, rh: 30, T: 28, wind: 3, soil: 25 } },
];

const LIMIT_TEXT: Record<PlantState['limit'], string> = {
  lys: 'lite lys',
  vann: 'lite vann',
  luft: 'tørr luft',
  temperatur: 'temperaturen',
  ingen: 'ingenting',
};

const C_WATER = BIO.vann;
const C_CO2 = BIO.klorofyll;

export default function Transpirasjon() {
  const [w, setW] = useState<Weather>(PRESETS[0]!.w);
  const s = useMemo(() => plantState(w), [w]);
  const clock = useSimClock({ tMax: 600, loop: true });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const set = (k: keyof Weather) => (v: number) => setW((old) => ({ ...old, [k]: v }));
  const preset = PRESETS.find((p) => (Object.keys(p.w) as (keyof Weather)[]).every((k) => p.w[k] === w[k]))?.id ?? null;
  const D = vpd(w.T, w.rh);

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg label="Vær" options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={preset} onPick={(id) => setW(PRESETS.find((p) => p.id === id)!.w)} />
      </Toolbar>
      <Controls>
        <Slider label="Lys" value={w.light} onChange={set('light')} min={0} max={100} step={5} unit="% av full sol" />
        <Slider label="Luftfuktighet" value={w.rh} onChange={set('rh')} min={20} max={100} step={5} unit="%" />
        <Slider label="Temperatur" value={w.T} onChange={set('T')} min={5} max={40} step={1} unit="°C" />
        <Slider label="Vind" value={w.wind} onChange={set('wind')} min={0} max={10} step={0.5} unit="m/s" decimals={1} />
        <Slider label="Vann i jorda" value={w.soil} onChange={set('soil')} min={10} max={100} step={5} unit="% av feltkapasitet" />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(clock.t, 0)} s`} />
      </Toolbar>

      <div ref={ref}>
        <Scene w={w} s={s} f={f} t={clock.t} />
      </div>
      <Legend
        items={[
          { color: C_WATER, label: 'Vann (i xylemet) og vanndamp' },
          { color: C_CO2, label: 'CO₂ inn til fotosyntesen' },
        ]}
      />

      <TradeOff w={w} s={s} />
      <Legend
        items={[
          { color: C_WATER, label: 'Vanntap (transpirasjon)' },
          { color: C_CO2, label: 'CO₂-opptak (fotosyntese)' },
        ]}
      />

      <Readouts>
        <Readout label="Spalteåpningene" value={fmtPct(s.opening)} unit="åpne" />
        <Readout label="Transpirasjon" value={fmt(s.E, 1)} unit="mmol/(m² · s)" tone={C_WATER} />
        <Readout label="CO₂-opptak" value={fmt(s.A, 1)} unit="µmol/(m² · s)" tone={s.A >= 0 ? C_CO2 : VIZ.muted} />
        <Readout
          label="Vannpotensial i bladet"
          value={fmt(s.psi.leaf, 2)}
          unit={s.turgor <= 0 ? 'MPa (visner)' : s.turgor < 0.35 ? 'MPa (slapp)' : 'MPa'}
          tone={s.turgor <= 0 ? BIO.dod : undefined}
        />
      </Readouts>

      <Formula label="Hvorfor vannet går fra jorda til lufta">
        <FormulaLine>
          Tørr luft: VPD = e<sub>s</sub>(T) · (1 − RF) = {fmt(saturationVaporPressure(w.T), 2)} kPa · (1 − {fmt(w.rh / 100, 2)}) = {fmt(D, 2)} kPa
        </FormulaLine>
        <FormulaLine>
          Vannpotensial: jord {fmt(s.psi.soil, 2)} → rot {fmt(s.psi.root, 2)} → blad {fmt(s.psi.leaf, 2)} → luft {fmt(s.psi.air, 0)} MPa
        </FormulaLine>
        <FormulaLine>
          Transpirasjon: E = g · VPD / p = {fmt((s.E * P_AIR) / 1000 / Math.max(D, 1e-9), 3)} mol/(m² · s) · {fmt(D, 2)} kPa / {fmt(P_AIR, 1)} kPa ={' '}
          {fmt(s.E, 1)} mmol/(m² · s)
        </FormulaLine>
      </Formula>

      <Explain>{explanation(w, s)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Scenen: planten og et snitt av bladet                                    */
/* ====================================================================== */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Scene({ w, s, f, t }: { w: Weather; s: PlantState; f: number; t: number }) {
  const narrow = f > 1.3;
  const plantH = narrow ? 560 : 430;
  const leafH = narrow ? 420 : 430;
  const titleH = 26 * f;
  const P: Box = narrow ? { x: 20, y: titleH, w: 760, h: plantH } : { x: 20, y: titleH, w: 400, h: plantH };
  const L: Box = narrow ? { x: 20, y: P.y + P.h + titleH + 24, w: 760, h: leafH } : { x: 440, y: titleH, w: 340, h: leafH };
  const H = Math.round(L.y + L.h + 8);
  const state = s.turgor <= 0 ? 'visnet' : s.turgor < 0.35 ? 'slapp' : 'spent';
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1500 : H}
      label={`Plante i jord. Spalteåpningene er ${fmtPct(s.opening)} åpne, transpirasjonen er ${fmt(s.E, 1)} mmol per m² per sekund, og bladene er ${state}.`}
    >
      <Txt x={P.x + 4} y={P.y - 10} anchor="start" weight={700}>
        Vannets vei
      </Txt>
      <PlantPanel box={P} w={w} s={s} t={t} />
      <Txt x={L.x + 4} y={L.y - 10} anchor="start" weight={700}>
        Snitt av bladet
      </Txt>
      <LeafSection box={L} s={s} t={t} narrow={narrow} />
    </Figure>
  );
}

/* ---------- Planten ---------- */

function PlantPanel({ box: outer, w, s, t }: { box: Box; w: Weather; s: PlantState; t: number }) {
  const f = useTextScale();
  // Venstre kolonne: vannpotensialet langs veien. Resten: planten.
  const colW = Math.round(outer.w * 0.3);
  const box: Box = { x: outer.x + colW, y: outer.y, w: outer.w - colW, h: outer.h };
  const k = Math.max(1, f * 0.85);
  const X = (u: number) => box.x + u * box.w;
  const Y = (v: number) => box.y + v * box.h;
  const gy = Y(0.66);
  const sx = X(0.58);
  const top = Y(0.12);
  const wilt = 1 - s.turgor;
  // Toppen av stengelen bøyer seg når planten visner
  const tipX = sx + wilt * box.w * 0.12;
  const tipY = top + wilt * box.h * 0.08;
  const stemPath = `M${sx},${gy} L${sx},${Y(0.4)} Q${sx},${Y(0.22)} ${tipX},${tipY}`;
  const dryness = 1 - Math.min(1, w.soil / 100);
  const soilFill = mixColor(BIO.vannFyll, mixColor(VIZ.surface, BIO.ved, 0.45), 0.25 + dryness * 0.75);
  // Bladene: [høyde langs stengelen (0–1), side, lengde]
  const leaves = [
    [0.18, -1, 0.3],
    [0.32, 1, 0.3],
    [0.5, -1, 0.26],
    [0.66, 1, 0.24],
  ] as const;
  const stemAt = (u: number) => {
    // Punkt på stengelen: rett opp til 0,4 av høyden, så en kurve mot toppen
    if (u <= 0.5) return [sx, gy - (gy - Y(0.4)) * (u / 0.5)] as const;
    const v = (u - 0.5) / 0.5;
    const a = [sx, Y(0.4)];
    const c = [sx, Y(0.22)];
    const b = [tipX, tipY];
    const x = (1 - v) ** 2 * a[0]! + 2 * (1 - v) * v * c[0]! + v * v * b[0]!;
    const y = (1 - v) ** 2 * a[1]! + 2 * (1 - v) * v * c[1]! + v * v * b[1]!;
    return [x, y] as const;
  };
  const leafLen = box.w * 0.4;
  const leafShapes = leaves.map(([u, side, len]) => {
    const [lx, ly] = stemAt(u);
    // Opp og ut når bladet er spent, hengende ned når planten visner
    const ang = side < 0 ? 180 + 28 - wilt * 75 : -28 + wilt * 75;
    return { lx, ly, ang, len: leafLen * (len / 0.3), side };
  });
  // Vannets vei: rotspiss → rot → stengel → det øverste bladet → ut i lufta
  const last = leafShapes[3]!;
  const a = (last.ang * Math.PI) / 180;
  const leafTip = [last.lx + Math.cos(a) * last.len * 0.7, last.ly + Math.sin(a) * last.len * 0.7] as const;
  const path: (readonly [number, number])[] = [
    [sx - box.w * 0.12, Y(0.93)],
    [sx - box.w * 0.04, Y(0.8)],
    [sx, gy],
    ...[0.2, 0.4, 0.5, 0.6].map((u) => stemAt(u)),
    [last.lx, last.ly],
    leafTip,
  ];
  const speed = Math.min(0.25, s.E * 0.05);
  const dots = Array.from({ length: 14 }, (_, i) => {
    const u = (i / 14 + speed * t) % 1;
    return pointOn(path, u);
  });
  const vapour = useMemo(() => {
    const r = seededRandom(9);
    return Array.from({ length: 10 }, () => ({ dx: r() * 2 - 1, ph: r() }));
  }, []);
  const vapourN = Math.round(Math.min(10, s.E * 2.5));
  const sunR = 26;
  const sunX = X(0.12);
  const sunY = Y(0.1);
  const light = w.light / 100;
  // Vannpotensialet langs veien, i samme høyde som delen av planten det gjelder
  const ladder = [
    { y: Y(0.07), label: 'luft', v: s.psi.air, d: 0 },
    { y: Math.min(Y(0.3), leafShapes[3]!.ly), label: 'blad', v: s.psi.leaf, d: 2 },
    { y: Y(0.5), label: 'stengel', v: s.psi.stem, d: 2 },
    { y: Y(0.76), label: 'rot', v: s.psi.root, d: 2 },
    { y: Y(0.92), label: 'jord', v: s.psi.soil, d: 2 },
  ];
  const lh = 19 * f * 0.78;
  const arrowX = outer.x + colW - 14;
  return (
    <g>
      {/* Himmel: lyset */}
      <rect x={box.x} y={box.y} width={box.w} height={gy - box.y} rx={14} fill={light > 0 ? BIO.vannFyll : VIZ.bodyStrong} opacity={0.25 + 0.35 * light} />
      {light > 0 ? (
        <g>
          {Array.from({ length: 10 }, (_, i) => {
            const an = (i / 10) * Math.PI * 2;
            const r1 = sunR + 6;
            const r2 = sunR + 6 + 16 * light;
            return (
              <line
                key={i}
                x1={sunX + Math.cos(an) * r1}
                y1={sunY + Math.sin(an) * r1}
                x2={sunX + Math.cos(an) * r2}
                y2={sunY + Math.sin(an) * r2}
                stroke={BIO.sukker}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.4 + 0.6 * light}
              />
            );
          })}
          <circle cx={sunX} cy={sunY} r={sunR} fill={BIO.sukker} opacity={0.35 + 0.65 * light} />
        </g>
      ) : (
        <path d={`M${sunX + 8},${sunY - 22} a24,24 0 1 0 0,44 a18,18 0 1 1 0,-44 Z`} fill={VIZ.muted} />
      )}
      {/* Vind */}
      {w.wind > 0.4 &&
        [0.18, 0.3, 0.42].map((v, i) => {
          const len = Math.min(box.w * 0.25, 18 + w.wind * 9);
          const x0 = X(0.97) - len;
          return (
            <path
              key={v}
              d={`M${x0},${Y(v)} q${len * 0.25},-6 ${len * 0.5},0 t${len * 0.5},0`}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.8 - i * 0.15}
            />
          );
        })}
      {/* Jorda */}
      <rect x={box.x} y={gy} width={box.w} height={box.y + box.h - gy} rx={10} style={{ fill: soilFill }} />
      <line x1={box.x} x2={box.x + box.w} y1={gy} y2={gy} stroke={BIO.ved} strokeWidth={2} />
      {/* Røtter med rothår */}
      <g fill="none" stroke={BIO.ved} strokeLinecap="round">
        <path d={`M${sx},${gy} Q${sx - 4},${Y(0.8)} ${sx - box.w * 0.12},${Y(0.93)}`} strokeWidth={4} />
        <path d={`M${sx},${gy + 10} Q${sx + 20},${Y(0.78)} ${sx + box.w * 0.16},${Y(0.88)}`} strokeWidth={3} />
        <path d={`M${sx - 2},${Y(0.76)} Q${sx - 30},${Y(0.8)} ${sx - box.w * 0.24},${Y(0.82)}`} strokeWidth={2.5} />
        {[
          [sx - box.w * 0.12, Y(0.93)],
          [sx + box.w * 0.16, Y(0.88)],
          [sx - box.w * 0.24, Y(0.82)],
        ].map(([x, y], i) =>
          Array.from({ length: 5 }, (_, j) => (
            <line key={`${i}-${j}`} x1={x! - 12 + j * 6} y1={y! - 4} x2={x! - 14 + j * 6} y2={y! - 12} strokeWidth={1} opacity={0.8} />
          )),
        )}
      </g>
      {/* Stengel med xylem */}
      <path d={stemPath} fill="none" stroke={BIO.plante.line} strokeWidth={10} strokeLinecap="round" />
      <path d={stemPath} fill="none" stroke={C_WATER} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      {/* Blader */}
      {leafShapes.map((l, i) => (
        <path
          key={i}
          d={leafPath(l.lx, l.ly, l.len, l.ang)}
          fill={s.turgor <= 0 ? mixColor(BIO.plante.fill, BIO.dod, 0.4) : BIO.plante.fill}
          stroke={BIO.plante.line}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      ))}
      {/* Vannet i xylemet og vanndamp ut av bladet */}
      {s.E > 0.02 &&
        dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.6 * k} fill={C_WATER} stroke={VIZ.surface} strokeWidth={1} />)}
      {vapour.slice(0, vapourN).map((v, i) => {
        const ph = (v.ph + t * 0.25) % 1;
        return (
          <circle
            key={`v${i}`}
            cx={leafTip[0] + v.dx * 30 + ph * 26}
            cy={leafTip[1] - 10 - ph * 70}
            r={3.4 * k}
            fill="none"
            stroke={C_WATER}
            strokeWidth={1.6}
            opacity={1 - ph}
          />
        );
      })}
      {/* Vannpotensialet langs veien: vannet går fra høyt (jorda) til lavt (lufta) */}
      <Txt x={outer.x + 4} y={outer.y + 14 * f} anchor="start" size={0.78} weight={700}>
        Vannpotensial
      </Txt>
      <Arrow x1={arrowX} y1={ladder[4]!.y + lh * 0.6} x2={arrowX} y2={ladder[0]!.y - lh * 0.2 + 10} color={C_WATER} width={3} head={11} />
      {ladder.map((l) => (
        <g key={l.label}>
          <Txt x={outer.x + 4} y={l.y + lh * 0.5 + 6 * f} anchor="start" size={0.72} muted>
            {l.label}
          </Txt>
          <Txt x={outer.x + 4} y={l.y + lh * 1.5 + 6 * f} anchor="start" size={0.8} weight={700} color={C_WATER}>
            {fmt(l.v, l.d)} MPa
          </Txt>
        </g>
      ))}
      <Txt x={box.x + box.w - 8} y={box.y + box.h - 10} anchor="end" size={0.75} weight={650}>
        {fmt(w.T, 0)} °C · {fmt(w.rh, 0)} % RF
      </Txt>
    </g>
  );
}

/** Blad som peker i retningen `ang` (grader, 0 = mot høyre, med klokka) fra (x, y). */
function leafPath(x: number, y: number, len: number, ang: number): string {
  const a = (ang * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.22;
  const ny = Math.cos(a) * len * 0.22;
  const mx = x + Math.cos(a) * len * 0.45;
  const my = y + Math.sin(a) * len * 0.45;
  return `M${x},${y} Q${mx + nx},${my + ny} ${tx},${ty} Q${mx - nx},${my - ny} ${x},${y} Z`;
}

/** Punkt en andel u langs en brutt linje. */
function pointOn(pts: readonly (readonly [number, number])[], u: number): readonly [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let left = u * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]! || i === seg.length - 1) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const s = seg[i]! > 0 ? Math.min(1, left / seg[i]!) : 0;
      return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    }
    left -= seg[i]!;
  }
  return pts[pts.length - 1]!;
}

/* ---------- Snitt av bladet med en spalteåpning ---------- */

function LeafSection({ box, s, t, narrow }: { box: Box; s: PlantState; t: number; narrow: boolean }) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  // Selve snittet til venstre, etikettene i en kolonne til høyre
  const dw = box.w * (narrow ? 0.58 : 0.6);
  const X = (u: number) => box.x + u * dw;
  const Y = (v: number) => box.y + v * box.h;
  const cols = 6;
  const cw = dw / cols;
  const epiTop = Y(0.06);
  const epiH = box.h * 0.06;
  const palTop = epiTop + epiH;
  const palH = box.h * 0.26;
  const spTop = palTop + palH + 4;
  const spH = box.h * 0.3;
  const loTop = spTop + spH;
  const loH = box.h * 0.06;
  const stomaX = X(0.5);
  const open = s.opening;
  const gap = 3 + open * cw * 0.32;
  const spongy = useMemo(() => {
    const r = seededRandom(21);
    return Array.from({ length: 11 }, (_, i) => ({ u: 0.06 + (i % 6) * 0.17 + r() * 0.05, v: 0.2 + Math.floor(i / 6) * 0.5 + r() * 0.15 }));
  }, []);
  const lx = box.x + dw + 16;
  const flowY = loTop + loH;
  const nOut = Math.round(Math.min(8, s.E * 2));
  const nIn = Math.round(Math.min(8, Math.max(0, s.A) / 3));
  const guard = (side: -1 | 1) => {
    const cx = stomaX + side * (gap / 2 + cw * 0.28);
    return (
      <ellipse
        cx={cx}
        cy={loTop + loH / 2}
        rx={cw * 0.28}
        ry={loH * 0.85}
        fill={BIO.kloroplast.fill}
        stroke={BIO.kloroplast.line}
        strokeWidth={1.8}
      />
    );
  };
  return (
    <g>
      {/* Kutikula og øvre overhud */}
      <rect x={X(0)} y={epiTop - 4} width={dw} height={4} fill={BIO.cellevegg.line} opacity={0.6} />
      {Array.from({ length: cols }, (_, i) => (
        <rect key={`e${i}`} x={X(0) + i * cw} y={epiTop} width={cw} height={epiH} fill={BIO.cytoplasma} stroke={BIO.cellevegg.line} strokeWidth={1.2} />
      ))}
      {/* Palisadevev */}
      {Array.from({ length: cols * 2 }, (_, i) => (
        <g key={`p${i}`}>
          <rect
            x={X(0) + i * (cw / 2) + 2}
            y={palTop + 2}
            width={cw / 2 - 4}
            height={palH - 4}
            rx={8}
            fill={BIO.kloroplast.fill}
            stroke={BIO.kloroplast.line}
            strokeWidth={1.2}
          />
          {[0.25, 0.5, 0.75].map((v) => (
            <circle key={v} cx={X(0) + i * (cw / 2) + cw / 4} cy={palTop + palH * v} r={3.2} fill={BIO.klorofyll} />
          ))}
        </g>
      ))}
      {/* Svampvev med luftrom */}
      <rect x={X(0)} y={spTop} width={dw} height={spH} fill={BIO.vannFyll} opacity={0.5} />
      {spongy.map((c, i) => (
        <ellipse
          key={`s${i}`}
          cx={X(c.u)}
          cy={spTop + spH * c.v}
          rx={cw * 0.42}
          ry={spH * 0.2}
          fill={BIO.kloroplast.fill}
          stroke={BIO.kloroplast.line}
          strokeWidth={1.2}
        />
      ))}
      {/* Ledningsstreng med xylem */}
      <circle cx={X(0.82)} cy={spTop + spH * 0.45} r={Math.min(cw * 0.55, spH * 0.32)} fill={BIO.cytoplasma} stroke={BIO.plante.line} strokeWidth={1.6} />
      <circle cx={X(0.82)} cy={spTop + spH * 0.38} r={Math.min(cw * 0.22, spH * 0.12)} fill={C_WATER} opacity={0.75} />
      {/* Nedre overhud med spalteåpning */}
      {Array.from({ length: cols }, (_, i) => {
        const x0 = X(0) + i * cw;
        if (Math.abs(x0 + cw / 2 - stomaX) < cw) return null;
        return <rect key={`l${i}`} x={x0} y={loTop} width={cw} height={loH} fill={BIO.cytoplasma} stroke={BIO.cellevegg.line} strokeWidth={1.2} />;
      })}
      {guard(-1)}
      {guard(1)}
      {/* Vanndamp ut og CO₂ inn gjennom spalteåpningen */}
      {Array.from({ length: nOut }, (_, i) => {
        const ph = (i / Math.max(1, nOut) + t * 0.35) % 1;
        return (
          <circle
            key={`h${i}`}
            cx={stomaX - gap * 0.3 + Math.sin(i * 2.1) * 10 * ph}
            cy={loTop - 10 + ph * (box.h * 0.36)}
            r={3.2 * k}
            fill="none"
            stroke={C_WATER}
            strokeWidth={1.6}
            opacity={0.9 - ph * 0.6}
          />
        );
      })}
      {Array.from({ length: nIn }, (_, i) => {
        const ph = (i / Math.max(1, nIn) + t * 0.3) % 1;
        return (
          <circle
            key={`c${i}`}
            cx={stomaX + gap * 0.3 + Math.cos(i * 1.7) * 10 * (1 - ph)}
            cy={Y(0.98) - ph * (Y(0.98) - spTop - spH * 0.3)}
            r={3 * k}
            fill={C_CO2}
            opacity={0.85}
          />
        );
      })}
      <Arrow x1={stomaX - 18} y1={flowY + 8} x2={stomaX - 18} y2={flowY + 8 + Math.max(14, 12 * s.E)} color={C_WATER} width={2.5} head={9} minLength={6} />
      {s.A > 0 && <Arrow x1={stomaX + 18} y1={flowY + 50} x2={stomaX + 18} y2={flowY + 12} color={C_CO2} width={2.5} head={9} />}

      {/* Etiketter i egen kolonne */}
      <Etikett x={X(0.9)} y={epiTop - 2} lx={lx} ly={epiTop + 4} anchor="start" size={0.72}>
        kutikula
      </Etikett>
      <Etikett x={X(0.96)} y={palTop + palH / 2} lx={lx} ly={palTop + palH / 2 + 4} anchor="start" size={0.72}>
        palisadevev
      </Etikett>
      <Etikett x={X(0.97)} y={spTop + spH * 0.7} lx={lx} ly={spTop + spH * 0.62 + 4} anchor="start" size={0.72}>
        svampvev
      </Etikett>
      <Etikett x={X(0.82) + Math.min(cw * 0.55, spH * 0.32)} y={spTop + spH * 0.38} lx={lx} ly={spTop + spH * 0.3 + 4} anchor="start" size={0.72}>
        xylem
      </Etikett>
      <Etikett x={stomaX} y={loTop + loH * 0.5} lx={lx} ly={loTop + loH * 0.5 + 18 * f} anchor="start" size={0.72} strong>
        spalteåpning {fmtPct(open)}
      </Etikett>
      <Etikett x={stomaX + gap / 2 + cw * 0.5} y={loTop + loH} lx={lx} ly={loTop + loH + 44 * f} anchor="start" size={0.72}>
        lukkeceller
      </Etikett>
      <Txt x={X(0.04)} y={Y(0.97)} anchor="start" size={0.72} weight={650} color={C_WATER}>
        vanndamp ut
      </Txt>
      {s.A > 0 && (
        <Txt x={X(0.96)} y={Y(0.97)} anchor="end" size={0.72} weight={650} color={C_CO2}>
          CO₂ inn
        </Txt>
      )}
    </g>
  );
}

/* ====================================================================== */
/* Byttet: CO₂ inn mot vann ut                                              */
/* ====================================================================== */

function TradeOff({ w, s }: { w: Weather; s: PlantState }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(320 + 260 * (f - 1));
  const Emax = transpirationAt(G_MAX, w);
  const Amax = photosynthesisAt(G_MAX, w);
  const dark = Amax <= 0;
  const pts = (fn: (g: number) => number, max: number) => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const o = i / 60;
      out.push([o * 100, max > 0 ? Math.max(0, (100 * fn(o * G_MAX)) / max) : 0]);
    }
    return out;
  };
  const eNow = Emax > 0 ? (100 * s.E) / Emax : 0;
  const aNow = Amax > 0 ? Math.max(0, (100 * s.A) / Amax) : 0;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Vanntap og CO₂-opptak mot hvor åpne spalteåpningene er. Nå er de ${fmtPct(s.opening)} åpne.`}
        caption={`Helt åpne spalteåpninger ville gitt ${fmt(Emax, 1)} mmol vann ut og ${fmt(Math.max(0, Amax), 1)} µmol CO₂ inn per m² per sekund i dette været.`}
      >
        <Plot
          x={{ min: 0, max: 100, label: 'Hvor åpne spalteåpningene er (%)' }}
          y={{ min: 0, max: 100, label: 'Prosent av helt åpne', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              <path d={linePath(pts((g) => transpirationAt(g, w), Emax), sx, sy)} fill="none" stroke={C_WATER} strokeWidth={3.5} />
              {!dark && <path d={linePath(pts((g) => photosynthesisAt(g, w), Amax), sx, sy)} fill="none" stroke={C_CO2} strokeWidth={3.5} />}
              <line x1={sx(s.opening * 100)} x2={sx(s.opening * 100)} y1={y0} y2={y1} className="viz-guide" />
              {Emax > 0 && <circle cx={sx(s.opening * 100)} cy={sy(eNow)} r={7} fill={C_WATER} stroke={VIZ.surface} strokeWidth={2.5} />}
              {!dark && <circle cx={sx(s.opening * 100)} cy={sy(aNow)} r={7} fill={C_CO2} stroke={VIZ.surface} strokeWidth={2.5} />}
              {dark && (
                <Txt x={sx(64)} y={sy(18)} size={0.85} weight={650} color={C_CO2}>
                  ingen fotosyntese i mørket
                </Txt>
              )}
              {Emax <= 0 && (
                <Txt x={sx(50)} y={sy(60)} size={0.85} weight={650} color={C_WATER}>
                  mettet luft: ingen transpirasjon
                </Txt>
              )}
            </g>
          )}
        </Plot>
      </Figure>
    </div>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(w: Weather, s: PlantState): ReactNode {
  const cohesion = (
    <p>
      <strong>Kohesjon og spenning.</strong> Planten pumper ikke vannet opp. Når vann fordamper fra cellene inne i bladet og går ut gjennom
      spalteåpningene, drar det i vannet bak: vannmolekylene henger sammen med hydrogenbindinger (kohesjon) og fester seg til veggene i
      vedrørene (adhesjon), så hele vannsøylen fra rota til bladet blir trukket opp. Vannet går alltid fra høyt til lavere vannpotensial:
      fra jorda ({fmt(s.psi.soil, 2)} MPa) til bladet ({fmt(s.psi.leaf, 2)} MPa) og ut i lufta ({fmt(s.psi.air, 0)} MPa).
    </p>
  );
  const tradeoff = (
    <p>
      <strong>Et bytte.</strong> Spalteåpningene er ikke til for å slippe ut vann: planten åpner dem for å få CO₂ til fotosyntesen, og
      vanntapet er prisen. Grafen viser at CO₂-opptaket flater ut når spalteåpningene er godt åpne, mens vanntapet fortsetter å øke. Halvt
      åpne spalteåpninger gir derfor mye CO₂ for lite vann.
    </p>
  );
  let now: ReactNode;
  if (s.turgor <= 0)
    now = (
      <p>
        <strong>Planten visner.</strong> Jorda er så tørr ({fmt(w.soil, 0)} % av feltkapasitet, vannpotensial {fmt(s.psi.soil, 1)} MPa)
        at rota ikke klarer å ta opp nok vann. Lukkecellene har lukket spalteåpningene for å spare vann, så nesten ikke noe CO₂ kommer inn,
        men cellene har likevel mistet turgor, og bladene henger.
      </p>
    );
  else if (w.light === 0)
    now = (
      <p>
        <strong>Natt.</strong> Uten lys er det ingen fotosyntese, så spalteåpningene er lukket. Bare litt vann fordamper gjennom kutikulaen,
        og bladet frigjør CO₂ fra celleåndingen.
      </p>
    );
  else if (s.E < 0.05)
    now = (
      <p>
        <strong>Nesten ingen transpirasjon.</strong> Lufta er nesten mettet med vanndamp ({fmt(w.rh, 0)} %), så det er nesten ingen forskjell
        i vannpotensial mellom bladet og lufta. Spalteåpningene kan stå åpne for CO₂ uten at planten mister vann.
      </p>
    );
  else
    now = (
      <p>
        Spalteåpningene er {fmtPct(s.opening)} åpne, og planten mister ca. {fmt(gramsPerHour(s.E), 0)} g vann per m² bladflate i timen.{' '}
        {s.limit === 'ingen'
          ? 'Ingenting begrenser spalteåpningene mye nå.'
          : `Det er ${LIMIT_TEXT[s.limit]} som begrenser hvor mye de åpner seg${s.limit === 'luft' ? ': i tørr luft lukker lukkecellene seg litt for å spare vann' : s.limit === 'vann' ? ': planten sparer vann ved å lukke dem delvis' : ''}.`}{' '}
        {w.wind >= 5 ? 'Vinden blåser bort den fuktige lufta rett utenfor bladet, så vanndampen går raskere ut. ' : ''}
        {w.T >= 30 ? 'Varm luft kan holde mye vanndamp, så den tørker ut bladet raskt. ' : ''}
      </p>
    );
  return (
    <>
      {now}
      {cohesion}
      {tradeoff}
    </>
  );
}
