import { useState, type ReactNode } from 'react';
import {
  Atom,
  Bond,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Select,
  Sub,
  TFormel,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomRadius,
  capitalize,
  fmt,
  formula,
  formulaText,
  mixColor,
  polar,
  useContainerTextScale,
} from '../kit';
import {
  ALKANES,
  HYDRIDES,
  KELVIN,
  alkaneParts,
  electronCount,
  forceParts,
  hydridesInGroup,
  modelBoilingPoint,
  spreadLabels,
  trendEstimate,
  type Alkane,
  type ForceParts,
  type ForceSwitches,
  type Hydride,
} from './model';

type Mode = 'hydrider' | 'alkaner';

const GROUP_COLOR: Record<number, string> = { 14: VIZ.series[0]!, 15: VIZ.series[2]!, 16: VIZ.series[4]!, 17: VIZ.series[1]! };
/** Farger for de tre typene krefter (samme i partikkelbildet, søylen og forklaringen). */
const LONDON = KJEMI.electron;
const DIPOLE = KJEMI.valence;
const HBOND = KJEMI.hbond;

const fmtC = (v: number | null) => (v === null ? '–' : `${fmt(v, 1)} °C`);

export default function SvakeBindinger() {
  const [mode, setMode] = useState<Mode>('hydrider');
  const [sel, setSel] = useState('H2O');
  const [selA, setSelA] = useState('C5H12');
  const [on, setOn] = useState<ForceSwitches>({ london: true, dipole: true, hbond: true });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const k = Math.max(1, 0.85 * f);
  const h = HYDRIDES.find((x) => x.formula === sel)!;
  const a = ALKANES.find((x) => x.formula === selA)!;
  const parts = mode === 'hydrider' ? forceParts(h) : alkaneParts(a);
  const measured = mode === 'hydrider' ? h.bp : a.bp;
  const model = modelBoilingPoint(parts, on);
  const allOn = on.london && on.dipole && on.hbond;
  const subject = mode === 'hydrider' ? h : a;
  const scene = sceneLayout(f, k);
  const graphH = f <= 1.3 ? 420 : 660;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg stoffgruppe"
          options={[
            { value: 'hydrider', label: 'Hydrider i gruppe 14–17' },
            { value: 'alkaner', label: 'Alkaner' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'hydrider' ? (
          <Select label="Stoff" value={sel} onChange={setSel} options={HYDRIDES.map((x) => ({ value: x.formula, label: `${x.name} (${formulaText(x.formula)})` }))} />
        ) : (
          <Select label="Stoff" value={selA} onChange={setSelA} options={ALKANES.map((x) => ({ value: x.formula, label: `${x.name} (${formulaText(x.formula)})` }))} />
        )}
      </Toolbar>
      <Toolbar>
        <Toggle label="London-krefter" checked={on.london} onChange={(v) => setOn({ ...on, london: v })} />
        <Toggle label="Dipol-dipol" checked={on.dipole} onChange={(v) => setOn({ ...on, dipole: v })} />
        <Toggle label="Hydrogenbindinger" checked={on.hbond} onChange={(v) => setOn({ ...on, hbond: v })} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${graphH}`}
          label={
            mode === 'hydrider'
              ? 'Kokepunktet til hydridene i gruppe 14–17 mot perioden. Vann, hydrogenfluorid og ammoniakk koker mye høyere enn trenden.'
              : 'Kokepunktet til alkanene stiger med antall karbonatomer.'
          }
          caption={allOn ? 'Målte kokepunkter ved 1 atm.' : 'Heltrukne linjer: modellen med bare de valgte kreftene. Grå stiplet: målt.'}
          maxHeight={graphH}
        >
          {mode === 'hydrider' ? <HydrideGraph on={on} sel={sel} onPick={setSel} height={graphH} f={f} /> : <AlkaneGraph on={on} sel={selA} onPick={setSelA} height={graphH} f={f} />}
        </Figure>
      </div>
      <Legend
        items={
          mode === 'hydrider'
            ? [14, 15, 16, 17].map((g) => ({ color: GROUP_COLOR[g]!, label: `Gruppe ${g}` }))
            : [{ color: VIZ.series[0]!, label: 'Rettkjedede alkaner' }]
        }
      />

      <Figure
        viewBox={`0 0 800 ${scene.H}`}
        label={`Utsnitt av flytende ${subject.name} med kreftene mellom molekylene, og kokepunktet delt opp i bidrag fra hver type krefter.`}
        caption="Utsnittet er en skisse: avstander og vinkler er forenklet. Søylen viser kokepunktet i kelvin, delt opp etter hvilke krefter som holder molekylene sammen (grov modell)."
        maxHeight={scene.H}
      >
        {mode === 'hydrider' ? <MoleculeRing h={h} on={on} cx={scene.ring.x} cy={scene.ring.y} f={f} k={k} /> : <AlkaneChains a={a} on={on} cx={scene.ring.x} cy={scene.ring.y} f={f} k={k} />}
        <ForceBar parts={parts} on={on} measured={measured} box={scene.bar} f={f} />
      </Figure>
      <Legend
        items={[
          { color: LONDON, label: 'London-krefter (mellom alle molekyler)' },
          { color: DIPOLE, label: 'Dipol-dipol', dashed: true },
          { color: HBOND, label: 'Hydrogenbinding', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Kokepunkt (målt)" value={fmtC(measured)} />
        <Readout label="Modell med valgte krefter" value={model === null ? 'Ingen' : fmtC(model)} tone={allOn ? undefined : KJEMI.valence} />
        <Readout label="Elektroner per molekyl" value={String(electronCount(subject.formula))} />
        <Readout label="Største bidrag" value={strongest(parts)} />
      </Readouts>

      <Formula label="Kokepunktet delt opp i bidrag">
        <FormulaLine>
          T<Sub>k</Sub> ≈ {fmt(parts.london, 0)} K (London){parts.dipole > 0 ? ` + ${fmt(parts.dipole, 0)} K (dipol-dipol)` : ''}
          {parts.hbond > 0 ? ` + ${fmt(parts.hbond, 0)} K (hydrogenbindinger)` : ''} = {fmt(measured + KELVIN, 0)} K = {fmt(measured, 1)} °C
        </FormulaLine>
        {!allOn && (
          <FormulaLine>
            Med bare de valgte kreftene: {model === null ? 'ingen krefter holder molekylene sammen' : `${fmt(model + KELVIN, 0)} K = ${fmt(model, 1)} °C`}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{mode === 'hydrider' ? hydrideText(h, on, model) : alkaneText(a, on, model)}</Explain>
    </VizLayout>
  );
}

function strongest(p: ForceParts): string {
  const max = Math.max(p.london, p.dipole, p.hbond);
  return max === p.hbond ? 'H-bindinger' : max === p.dipole ? 'Dipol-dipol' : 'London';
}

/* ---------- Grafene ---------- */

function yRange(on: ForceSwitches): [number, number] {
  return on.london ? [-180, 120] : [-280, 120];
}

function HydrideGraph({ on, sel, onPick, height, f }: { on: ForceSwitches; sel: string; onPick: (f: string) => void; height: number; f: number }) {
  const [y0, y1] = yRange(on);
  const allOn = on.london && on.dipole && on.hbond;
  return (
    <Plot
      x={{ min: 1.4, max: 5.3, label: 'Periode', ticks: [2, 3, 4, 5] }}
      y={{ min: y0, max: y1, label: 'Kokepunkt (°C)', ticks: on.london ? [-150, -100, -50, 0, 50, 100] : [-250, -200, -150, -100, -50, 0, 50, 100] }}
      width={800}
      height={height}
      margin={{ top: 16 * f, right: 104 * f, bottom: 56 * f, left: 74 * f }}
    >
      {({ sx, sy, x0, x1 }) => {
        const groups = [14, 15, 16, 17].map((g) => {
          const hs = hydridesInGroup(g);
          return { g, hs, model: hs.map((x) => modelBoilingPoint(forceParts(x), on)) };
        });
        // Etiketter ved enden av linjene (periode 5) og ved periode 2
        const endY = spreadLabels(
          groups.map((G) => sy(G.model[3] ?? y0)),
          22 * f,
          16 * f,
          height - 60 * f,
        );
        const startY = spreadLabels(
          groups.map((G) => sy(G.model[0] ?? y0) + 6 * f),
          22 * f,
          16 * f,
          height - 60 * f,
        );
        return (
          <g>
            {!on.london && (
              <g>
                <line x1={x0} x2={x1} y1={sy(-273.15)} y2={sy(-273.15)} stroke={VIZ.muted} strokeDasharray="6 5" />
                <Txt x={x0 + 8} y={sy(-273.15) - 8} anchor="start" muted size={0.75}>
                  absolutt nullpunkt (0 K)
                </Txt>
              </g>
            )}
            {/* Trendlinjene uten hydrogenbindinger når de er slått av */}
            {!on.hbond &&
              [15, 16, 17].map((g) => (
                <line key={`t${g}`} x1={sx(2)} y1={sy(trendEstimate(g, 2))} x2={sx(3)} y2={sy(trendEstimate(g, 3))} stroke={GROUP_COLOR[g]} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.6} />
              ))}
            {/* Målte verdier som grå skygge når modellen avviker */}
            {!allOn &&
              groups.map((G) => (
                <g key={`m${G.g}`} opacity={0.75}>
                  <polyline points={G.hs.map((x) => `${sx(x.period)},${sy(x.bp)}`).join(' ')} fill="none" stroke={VIZ.muted} strokeWidth={1.6} strokeDasharray="5 5" />
                  {G.hs.map((x) => (
                    <circle key={x.formula} cx={sx(x.period)} cy={sy(x.bp)} r={4} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.5} />
                  ))}
                </g>
              ))}
            {groups.map((G) => {
              const pts = G.hs.map((x, i) => ({ x, v: G.model[i] ?? null })).filter((p): p is { x: Hydride; v: number } => p.v !== null);
              return (
                <g key={G.g}>
                  <polyline points={pts.map((p) => `${sx(p.x.period)},${sy(p.v)}`).join(' ')} fill="none" stroke={GROUP_COLOR[G.g]} strokeWidth={3} strokeLinejoin="round" />
                  {pts.map((p) => {
                    const isSel = p.x.formula === sel;
                    const hb = p.x.hbond && on.hbond;
                    return (
                      <g key={p.x.formula} onClick={() => onPick(p.x.formula)} style={{ cursor: 'pointer' }}>
                        {hb && <circle cx={sx(p.x.period)} cy={sy(p.v)} r={12} fill="none" stroke={HBOND} strokeWidth={2.5} />}
                        {isSel && <circle cx={sx(p.x.period)} cy={sy(p.v)} r={hb ? 16 : 11} fill="none" stroke={VIZ.ink} strokeWidth={2} />}
                        <circle cx={sx(p.x.period)} cy={sy(p.v)} r={6.5} fill={GROUP_COLOR[G.g]} stroke={VIZ.surface} strokeWidth={1.5} />
                        <circle cx={sx(p.x.period)} cy={sy(p.v)} r={16} fill="transparent" />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {groups.map((G, i) => (
              <g key={`l${G.g}`}>
                {G.model[3] !== null && (
                  <Txt x={sx(5) + 14} y={endY[i]! + 6 * f} anchor="start" size={0.85} weight={650} color={GROUP_COLOR[G.g]}>
                    <TFormel f={G.hs[3]!.formula} />
                  </Txt>
                )}
                {G.model[0] !== null && (
                  <Txt x={sx(2) - 14} y={startY[i]!} anchor="end" size={0.85} weight={650} color={GROUP_COLOR[G.g]}>
                    <TFormel f={G.hs[0]!.formula} />
                  </Txt>
                )}
              </g>
            ))}
            {[...groups].map((G) => {
              const x = G.hs.find((y) => y.formula === sel);
              const v = x ? G.model[G.hs.indexOf(x)] : null;
              if (!x || v === null || v === undefined || x.period === 2 || x.period === 5) return null;
              return (
                <Txt key={`s${G.g}`} x={sx(x.period)} y={sy(v) - 18} size={0.85} weight={700}>
                  <TFormel f={x.formula} />
                </Txt>
              );
            })}
          </g>
        );
      }}
    </Plot>
  );
}

function AlkaneGraph({ on, sel, onPick, height, f }: { on: ForceSwitches; sel: string; onPick: (f: string) => void; height: number; f: number }) {
  const [y0, y1] = on.london ? [-180, 140] : [-280, 140];
  const pts = ALKANES.map((a) => ({ a, v: modelBoilingPoint(alkaneParts(a), on) }));
  const shown = pts.filter((p): p is { a: Alkane; v: number } => p.v !== null);
  return (
    <Plot
      x={{ min: 0.5, max: 8.5, label: 'Antall karbonatomer', ticks: [1, 2, 3, 4, 5, 6, 7, 8] }}
      y={{ min: y0, max: y1, label: 'Kokepunkt (°C)', ticks: on.london ? [-150, -100, -50, 0, 50, 100] : [-250, -200, -150, -100, -50, 0, 50, 100] }}
      width={800}
      height={height}
      margin={{ top: 16 * f, right: 24 * f, bottom: 56 * f, left: 74 * f }}
    >
      {({ sx, sy, x0, x1 }) => (
        <g>
          {/* Romtemperatur */}
          <line x1={x0} x2={x1} y1={sy(25)} y2={sy(25)} stroke={VIZ.muted} strokeDasharray="6 5" />
          <Txt x={x0 + 8} y={sy(25) - 8} anchor="start" muted size={0.75}>
            romtemperatur (25 °C)
          </Txt>
          {!on.london && (
            <g>
              <line x1={x0} x2={x1} y1={sy(-273.15)} y2={sy(-273.15)} stroke={VIZ.muted} strokeDasharray="6 5" />
              <Txt x={x1 - 6} y={sy(-273.15) - 8} anchor="end" muted size={0.75}>
                absolutt nullpunkt (0 K)
              </Txt>
              <polyline points={ALKANES.map((a) => `${sx(a.carbons)},${sy(a.bp)}`).join(' ')} fill="none" stroke={VIZ.muted} strokeWidth={1.6} strokeDasharray="5 5" />
              <Txt x={(x0 + x1) / 2} y={sy(-200)} size={0.95} weight={600}>
                Uten London-krefter blir alkanene aldri flytende
              </Txt>
            </g>
          )}
          <polyline points={shown.map((p) => `${sx(p.a.carbons)},${sy(p.v)}`).join(' ')} fill="none" stroke={VIZ.series[0]} strokeWidth={3} />
          {shown.map((p) => (
            <g key={p.a.formula} onClick={() => onPick(p.a.formula)} style={{ cursor: 'pointer' }}>
              {p.a.formula === sel && <circle cx={sx(p.a.carbons)} cy={sy(p.v)} r={11} fill="none" stroke={VIZ.ink} strokeWidth={2} />}
              <circle cx={sx(p.a.carbons)} cy={sy(p.v)} r={6.5} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={1.5} />
              <circle cx={sx(p.a.carbons)} cy={sy(p.v)} r={16} fill="transparent" />
              <Txt x={sx(p.a.carbons) - 8} y={sy(p.v) - 14} anchor="end" size={0.8} weight={p.a.formula === sel ? 700 : 500}>
                <TFormel f={p.a.formula} />
              </Txt>
            </g>
          ))}
        </g>
      )}
    </Plot>
  );
}

/* ---------- Partikkelbildet og søylen ---------- */

function sceneLayout(f: number, k: number) {
  const wide = f <= 1.3;
  // Ringen: radius 150k, og elektronskyen rundt hvert molekyl rekker opptil ca. 90k utenfor
  const reach = 150 * k + 92 * k;
  const title = 34 * f;
  if (wide) {
    const H = Math.round(title + 2 * reach + 12);
    return { wide, ring: { x: 250, y: title + reach + 4 }, bar: { x: 610, top: 46 * f, bottom: H - 36 * f, w: 54 }, H };
  }
  const ringBottom = title + 2 * reach + 10;
  const barTop = ringBottom + 50 * f;
  const barH = 440;
  return { wide, ring: { x: 400, y: title + reach + 4 }, bar: { x: 250, top: barTop, bottom: barTop + barH, w: 90 }, H: Math.round(barTop + barH + 40 * f) };
}

/** Grunnstoffet som er bundet til hydrogen (C i CH₄, O i H₂O). */
function centralOf(f: string): string {
  return Object.keys(formula(f).atoms).find((s) => s !== 'H') ?? 'H';
}

/** Retningene (grader) til H-atomene i et 2D-bilde av molekylet; den første er den som peker mot nabomolekylet. */
function hydrogenDirs(group: number, toward: number, outward: number): number[] {
  const side = ((outward - toward + 540) % 360) - 180 > 0 ? 1 : -1;
  if (group === 17) return [toward];
  if (group === 16) return [toward, toward + side * 104.5];
  if (group === 15) return [toward, toward + side * 112, toward - side * 112];
  return [toward + 45, toward + 135, toward + 225, toward + 315];
}

/**
 * Seks molekyler i en ring der hvert molekyl peker et H-atom mot det neste. Viser hydrogenbindinger, dipol-dipol-krefter
 * og London-krefter (elektronsky rundt molekylene) etter hvilke krefter som er slått på.
 */
function MoleculeRing({ h, on, cx, cy, f, k }: { h: Hydride; on: ForceSwitches; cx: number; cy: number; f: number; k: number }) {
  const X = centralOf(h.formula);
  const rX = atomRadius(X, { scale: k });
  const rH = atomRadius('H', { scale: k });
  const b = rX + rH + 12 * k;
  const R = 150 * k;
  const n = 6;
  const pos = Array.from({ length: n }, (_, i) => polar(cx, cy, R, 90 + (360 / n) * i));
  const hb = h.hbond && on.hbond;
  const dd = h.polar && on.dipole && !hb;
  const mols = pos.map((p, i) => {
    const next = pos[(i + 1) % n]!;
    const toward = (Math.atan2(-(next.y - p.y), next.x - p.x) * 180) / Math.PI;
    const outward = 90 + (360 / n) * i;
    const dirs = h.group === 14 ? hydrogenDirs(14, toward + 15 * i, outward) : hydrogenDirs(h.group, toward, outward);
    return { p, next, dirs, Hs: dirs.map((d) => ({ ...polar(p.x, p.y, b, d), d })) };
  });
  const cloudR = b + rH + 8 * k;
  // Midlertidig dipol (London) i molekyl 0 (øverst), som lager en indusert dipol i molekyl 5 (oppe til høyre)
  const m0 = mols[0]!;
  const m5 = mols[5]!;
  const dir05 = (Math.atan2(-(m5.p.y - m0.p.y), m5.p.x - m0.p.x) * 180) / Math.PI;
  const tempDipole = on.london && !h.polar;
  const shiftOf = (i: number) => (tempDipole && (i === 0 || i === 5) ? polar(0, 0, 12 * k, dir05) : { x: 0, y: 0 });
  return (
    <g>
      <Txt x={16} y={26 * f} anchor="start" size={0.95} weight={700}>
        Flytende {h.name} (<TFormel f={h.formula} />)
      </Txt>
      {on.london &&
        mols.map((m, i) => {
          const shift = shiftOf(i);
          return <circle key={`c${i}`} cx={m.p.x + shift.x} cy={m.p.y + shift.y} r={cloudR} fill={mixColor(VIZ.surface, LONDON, 0.14)} stroke={LONDON} strokeOpacity={0.35} strokeWidth={1.2} />;
        })}
      {/* Kreftene mellom molekylene: fra H i ett molekyl til X i det neste */}
      {(hb || dd) &&
        mols.map((m, i) => {
          const H = m.Hs[0]!;
          const end = polar(m.next.x, m.next.y, rX + 3 * k, (Math.atan2(-(H.y - m.next.y), H.x - m.next.x) * 180) / Math.PI);
          const start = polar(H.x, H.y, rH + 3 * k, m.dirs[0]!);
          return (
            <line
              key={`f${i}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={hb ? HBOND : DIPOLE}
              strokeWidth={(hb ? 3.2 : 2.2) * k}
              strokeDasharray={hb ? `${6 * k} ${4 * k}` : `${2 * k} ${4 * k}`}
              strokeLinecap="round"
            />
          );
        })}
      {mols.map((m, i) => (
        <g key={`m${i}`}>
          {m.Hs.map((H, j) => (
            <Bond key={j} a={{ x: m.p.x, y: m.p.y, r: rX }} b={{ x: H.x, y: H.y, r: rH }} />
          ))}
          {m.Hs.map((H, j) => (
            <Atom key={`h${j}`} x={H.x} y={H.y} el="H" r={rH} />
          ))}
          <Atom x={m.p.x} y={m.p.y} el={X} r={rX} />
        </g>
      ))}
      {/* Delladninger på ett molekyl når dipolene er med */}
      {h.polar && (on.dipole || hb) && (
        <g>
          <Txt x={m0.p.x - rX - 14 * k} y={m0.p.y - rX * 0.6} anchor="end" color={KJEMI.minus} weight={700}>
            δ−
          </Txt>
          {m0.Hs.slice(0, 1).map((H, j) => {
            const p = polar(H.x, H.y, rH + 14 * f, m0.dirs[0]! + 70);
            return (
              <Txt key={j} x={p.x} y={p.y + 6 * f} color={KJEMI.plus} weight={700}>
                δ+
              </Txt>
            );
          })}
        </g>
      )}
      {tempDipole &&
        [m0, m5].map((m, i) => {
          const c = { x: m.p.x + shiftOf(i === 0 ? 0 : 5).x, y: m.p.y + shiftOf(i === 0 ? 0 : 5).y };
          const minus = polar(c.x, c.y, cloudR + 12 * f, dir05 + 35);
          const plus = polar(c.x, c.y, cloudR + 12 * f, dir05 + 215);
          return (
            <g key={`td${i}`}>
              <Txt x={minus.x} y={minus.y + 6 * f} color={KJEMI.minus} weight={700} size={0.9}>
                δ−
              </Txt>
              <Txt x={plus.x} y={plus.y + 6 * f} color={KJEMI.plus} weight={700} size={0.9}>
                δ+
              </Txt>
            </g>
          );
        })}
      <RingLabels h={h} on={on} mols={mols} cx={cx} cy={cy} cloudR={cloudR} f={f} />
    </g>
  );
}

/** Forklarende etiketter inne i ringen, med strek til det de peker på: hydrogenbinding/dipol-dipol og kovalent binding. */
function RingLabels({
  h,
  on,
  mols,
  cx,
  cy,
  cloudR,
  f,
}: {
  h: Hydride;
  on: ForceSwitches;
  mols: { p: { x: number; y: number }; next: { x: number; y: number }; dirs: number[]; Hs: { x: number; y: number; d: number }[] }[];
  cx: number;
  cy: number;
  cloudR: number;
  f: number;
}) {
  const hb = h.hbond && on.hbond;
  const dd = h.polar && on.dipole && !hb;
  const items: ReactNode[] = [];
  if (hb || dd) {
    // Forbindelsen fra molekyl 1 (oppe til venstre) til molekyl 2 (nede til venstre)
    const m = mols[1]!;
    const H = m.Hs[0]!;
    const mid = { x: (H.x + m.next.x) / 2, y: (H.y + m.next.y) / 2 };
    items.push(
      <g key="f">
        <line x1={mid.x + 4} y1={mid.y} x2={cx - 10 * f} y2={cy - 18 * f} stroke={VIZ.muted} strokeWidth={1} />
        <Txt x={cx} y={cy - 12 * f} size={0.8} weight={700} color={hb ? HBOND : DIPOLE}>
          {hb ? 'hydrogenbinding' : 'dipol-dipol'}
        </Txt>
      </g>,
    );
  }
  // Kovalent binding i molekyl 4 (nede til høyre)
  const m4 = mols[4]!;
  const H4 = m4.Hs[0]!;
  const bm = { x: (m4.p.x + H4.x) / 2, y: (m4.p.y + H4.y) / 2 };
  items.push(
    <g key="k">
      <line x1={bm.x - 2} y1={bm.y} x2={cx + 10 * f} y2={cy + 22 * f} stroke={VIZ.muted} strokeWidth={1} />
      <Txt x={cx} y={cy + 20 * f} size={0.8} muted>
        kovalent binding
      </Txt>
    </g>,
  );
  if (on.london && !h.polar) {
    const m5 = mols[5]!;
    items.push(
      <Txt key="l" x={m5.p.x} y={m5.p.y - cloudR - 30 * f} size={0.8} weight={600} color={LONDON}>
        midlertidige dipoler
      </Txt>,
    );
  }
  return <g>{items}</g>;
}

/** To parallelle karbonkjeder: jo lengre kjede, jo flere kontaktpunkter med London-krefter. */
function AlkaneChains({ a, on, cx, cy, f, k }: { a: Alkane; on: ForceSwitches; cx: number; cy: number; f: number; k: number }) {
  const n = a.carbons;
  const rC = atomRadius('C', { scale: k });
  const rH = atomRadius('H', { scale: k }) * 0.85;
  const s = 50 * k;
  const zig = 15 * k;
  const hLen = rC + rH + 4 * k;
  const hUp = hLen * Math.sin((55 * Math.PI) / 180);
  const reach = zig + hUp + rH;
  const gapY = 2 * reach + 34 * k;
  const w = (n - 1) * s;
  const x0 = cx - w / 2;
  const chains = [-0.5, 0.5].map((row) => {
    const y = cy + row * gapY;
    const Cs = Array.from({ length: n }, (_, j) => ({ x: x0 + j * s, y: y + (j % 2 === 0 ? -zig : zig), up: j % 2 === 0 }));
    return { y, Cs };
  });
  const top = chains[0]!;
  const bottom = chains[1]!;
  return (
    <g>
      <Txt x={16} y={26 * f} anchor="start" size={0.95} weight={700}>
        Flytende {a.name} (<TFormel f={a.formula} />)
      </Txt>
      {on.london &&
        chains.map((c, i) => (
          <rect
            key={`c${i}`}
            x={x0 - hLen - rH - 6 * k}
            y={c.y - reach - 6 * k}
            width={w + 2 * (hLen + rH + 6 * k)}
            height={2 * (reach + 6 * k)}
            rx={34 * k}
            fill={mixColor(VIZ.surface, LONDON, 0.14)}
            stroke={LONDON}
            strokeOpacity={0.35}
          />
        ))}
      {on.london &&
        top.Cs.map((C, j) => {
          const D = bottom.Cs[j]!;
          return (
            <line
              key={`l${j}`}
              x1={C.x}
              y1={top.y + reach + 2 * k}
              x2={D.x}
              y2={bottom.y - reach - 2 * k}
              stroke={LONDON}
              strokeWidth={2.2 * k}
              strokeDasharray={`${2 * k} ${4 * k}`}
              strokeLinecap="round"
            />
          );
        })}
      {chains.map((c, i) => (
        <g key={i}>
          {c.Cs.map((C, j) => {
            const base = C.up ? 90 : 270;
            const dirs = [base - 35, base + 35];
            if (j === 0) dirs.push(180);
            if (j === n - 1) dirs.push(0);
            if (n === 1) dirs.splice(0, dirs.length, 45, 135, 225, 315);
            const Hs = dirs.map((d) => polar(C.x, C.y, hLen, d));
            return (
              <g key={j}>
                {j > 0 && <Bond a={{ x: c.Cs[j - 1]!.x, y: c.Cs[j - 1]!.y, r: rC }} b={{ x: C.x, y: C.y, r: rC }} />}
                {Hs.map((H, m) => (
                  <g key={m}>
                    <Bond a={{ x: C.x, y: C.y, r: rC }} b={{ x: H.x, y: H.y, r: rH }} />
                    <Atom x={H.x} y={H.y} el="H" r={rH} />
                  </g>
                ))}
                <Atom x={C.x} y={C.y} el="C" r={rC} />
              </g>
            );
          })}
        </g>
      ))}
      {on.london && (
        <Txt x={cx} y={bottom.y + reach + 40 * f} size={0.85} weight={600} color={LONDON}>
          {n === 1 ? 'London-krefter mellom små molekyler' : `${n} kontaktpunkter mellom to molekyler`}
        </Txt>
      )}
    </g>
  );
}

/** Søyle for kokepunktet i kelvin, delt i London, dipol-dipol og hydrogenbindinger. Avslåtte bidrag er stiplet. */
function ForceBar({ parts, on, measured, box, f }: { parts: ForceParts; on: ForceSwitches; measured: number; box: { x: number; top: number; bottom: number; w: number }; f: number }) {
  const max = 420;
  const y = (K: number) => box.bottom - ((box.bottom - box.top) * K) / max;
  const segs = [
    { key: 'london' as const, v: parts.london, color: LONDON, name: 'London' },
    { key: 'dipole' as const, v: parts.dipole, color: DIPOLE, name: 'dipol-dipol' },
    { key: 'hbond' as const, v: parts.hbond, color: HBOND, name: 'H-bindinger' },
  ].filter((s) => s.v > 0.5);
  let acc = 0;
  let accOn = 0;
  const rects = segs.map((s) => {
    const from = acc;
    acc += s.v;
    const active = on[s.key];
    const fromOn = accOn;
    if (active) accOn += s.v;
    return { ...s, from, to: acc, active, fromOn };
  });
  const labelYs = spreadLabels(
    rects.map((r) => y((r.from + r.to) / 2) + 5 * f),
    22 * f,
    box.top,
    box.bottom,
  );
  const ticks = [0, 100, 200, 273, 373];
  return (
    <g>
      <Txt x={box.x + box.w / 2} y={box.top - 14 * f} size={0.85} muted>
        Kokepunkt i kelvin
      </Txt>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={box.x - 6} x2={box.x} y1={y(t)} y2={y(t)} stroke={VIZ.muted} />
          <text x={box.x - 10} y={y(t) + 5} textAnchor="end" className="viz-tick">
            {t === 273 ? '273 (0 °C)' : t === 373 ? '373 (100 °C)' : fmt(t, 0)}
          </text>
        </g>
      ))}
      <line x1={box.x} x2={box.x} y1={box.bottom} y2={box.top} stroke={VIZ.muted} />
      {rects.map((r) => (
        <rect
          key={r.key}
          x={box.x + 4}
          y={y(r.to)}
          width={box.w}
          height={Math.max(0, y(r.from) - y(r.to))}
          fill={r.active ? r.color : 'none'}
          fillOpacity={r.active ? 0.85 : 0}
          stroke={r.color}
          strokeWidth={r.active ? 1 : 2}
          strokeDasharray={r.active ? undefined : '5 4'}
        />
      ))}
      {rects.map((r, i) => (
        <Txt key={`t${r.key}`} x={box.x + box.w + 14} y={labelYs[i]!} anchor="start" size={0.8} weight={600} color={r.active ? r.color : VIZ.muted}>
          {r.name} {fmt(r.v, 0)} K
        </Txt>
      ))}
      {/* Målt kokepunkt */}
      <line x1={box.x - 2} x2={box.x + box.w + 10} y1={y(measured + KELVIN)} y2={y(measured + KELVIN)} stroke={VIZ.ink} strokeWidth={2} />
    </g>
  );
}

/* ---------- Forklaring ---------- */

function hydrideText(h: Hydride, on: ForceSwitches, model: number | null): ReactNode {
  const name = capitalize(h.name);
  const F = <Formel f={h.formula} />;
  const e = electronCount(h.formula);
  const est = trendEstimate(h.group);
  const allOn = on.london && on.dipole && on.hbond;
  const parts: ReactNode[] = [];
  if (h.hbond) {
    parts.push(
      on.hbond ? (
        <p key="a">
          <strong>
            {name} ({F}) koker ved {fmt(h.bp, 0)} °C,
          </strong>{' '}
          omtrent {fmt(h.bp - est, 0)} grader høyere enn trenden i gruppe {h.group} tilsier (ca. {fmt(est, 0)} °C). H er bundet til et lite og
          svært elektronegativt atom ({centralOf(h.formula)}), så H blir sterkt δ+ og trekkes mot et fritt elektronpar på naboen:{' '}
          <strong>hydrogenbindinger</strong>. Når {h.name} koker, er det disse bindingene mellom molekylene som brytes, ikke de kovalente bindingene
          inne i molekylene.
        </p>
      ) : (
        <p key="a">
          <strong>Uten hydrogenbindinger</strong> ville {h.name} fulgt trenden i gruppe {h.group} og kokt ved ca. {fmt(model ?? est, 0)} °C
          {h.formula === 'H2O' ? ', og vann ville vært en gass ved romtemperatur' : ''}. Det er hydrogenbindingene som gjør at {F} skiller seg ut
          i grafen.
        </p>
      ),
    );
  } else if (!h.polar) {
    parts.push(
      <p key="a">
        <strong>
          {name} ({F}) er upolart:
        </strong>{' '}
        bare London-krefter virker mellom molekylene. Elektronskyen forskyves tilfeldig et øyeblikk og gir en midlertidig dipol, som lager en
        dipol i nabomolekylet. Nedover gruppe 14 får molekylene flere elektroner ({e} i {F}), skyen blir lettere å forskyve, og kokepunktet
        stiger.
      </p>,
    );
  } else {
    parts.push(
      <p key="a">
        <strong>
          {name} ({F}) er polart,
        </strong>{' '}
        men H er ikke bundet til N, O eller F, så det blir ingen hydrogenbindinger, bare dipol-dipol-krefter og London-krefter. I periode{' '}
        {h.period} har alle hydridene {e} elektroner, så London-kreftene er omtrent like store, og dipolen gir litt ekstra.
        {h.period >= 4 ? ' Legg merke til at London-kreftene står for mesteparten av kokepunktet: store elektronskyer gir sterke London-krefter.' : ''}
      </p>,
    );
  }
  if (!allOn) {
    let t: ReactNode = null;
    if (!on.london && !on.dipole && !on.hbond) t = 'Uten noen krefter mellom molekylene ville stoffene aldri blitt flytende.';
    else if (!on.london)
      t = `Uten London-krefter faller alle kokepunktene kraftig, mest for de store molekylene. London-krefter virker mellom alle molekyler og er ofte det største bidraget.`;
    else if (!on.dipole && on.hbond)
      t = 'Med bare London-krefter (og hydrogenbindinger) samler hydridene i hver periode seg nesten i samme punkt, fordi de har like mange elektroner.';
    else if (!on.dipole) t = 'Med bare London-krefter koker hydridene i samme periode ved samme temperatur, fordi de har like mange elektroner.';
    if (t) parts.push(<p key="b">{t}</p>);
  } else if (!h.hbond && h.group !== 14) {
    parts.push(
      <p key="b">
        Slå av hydrogenbindingene og se hvordan {h.group === 16 ? 'vann' : h.group === 17 ? 'HF' : 'ammoniakk'} faller ned til trenden i gruppa.
      </p>,
    );
  }
  return <>{parts}</>;
}

function alkaneText(a: Alkane, on: ForceSwitches, model: number | null): ReactNode {
  const F = <Formel f={a.formula} />;
  const state = a.bp < 25 ? 'en gass' : 'en væske';
  return (
    <>
      <p>
        <strong>
          {capitalize(a.name)} ({F}) koker ved {fmt(a.bp, 1)} °C og er {state} ved romtemperatur.
        </strong>{' '}
        Alkaner er upolare, så bare London-krefter holder molekylene sammen. Jo lengre kjeden er, jo flere elektroner har molekylet ({electronCount(a.formula)}{' '}
        her) og jo større kontaktflate får det med naboene. Da blir London-kreftene sterkere, og kokepunktet stiger for hvert karbonatom.
      </p>
      {!on.london ? (
        <p>Uten London-krefter er det ingen krefter igjen mellom alkanmolekylene{model === null ? ', og de blir aldri flytende' : ''}.</p>
      ) : !on.dipole || !on.hbond ? (
        <p>Dipol-dipol-krefter og hydrogenbindinger betyr ingenting for alkanene: molekylene har ingen dipol og ingen H bundet til N, O eller F.</p>
      ) : null}
    </>
  );
}
