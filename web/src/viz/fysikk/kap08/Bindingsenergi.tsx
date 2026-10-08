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
  Segmented,
  Slider,
  Sub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useTextScale,
} from '../../kit';
import { Atomkjerne, LinearGradient, Nukleon, useSceneScale, useSvgId } from '../../kit/scene';
import { elementName, nuclideText } from '../kap07/elements';
import { useNarrow } from '../kap07/useNarrow';
import { BuePil } from './bindingsenergi-deler';
import { BindingScene, CURVE_COLOR, REACTION_COLOR, W, sceneLayout, type SceneMode } from './bindingsenergi-scene';
import {
  bindingEnergy,
  CURVE,
  findNuclide,
  M_H1_U,
  M_NEUTRON_U,
  reactionEnergy,
  REACTIONS,
  type Nuclide,
  type Particle,
  type Reaction,
} from './model';
import { coalEquivalentKg, fusionFragments, massLossPerSecond, SUN_POWER_W } from './model-bindingsenergi';

type Mode = SceneMode;

const MODES: { value: Mode; label: string }[] = [
  { value: 'kurve', label: 'Bindingsenergi' },
  { value: 'fisjon', label: 'Fisjon av uran' },
  { value: 'fusjon', label: 'Fusjon: D + T' },
  { value: 'sola', label: 'Fusjon i sola' },
];

const FE_INDEX = CURVE.findIndex((n) => n.Z === 26 && n.A === 56);

const perNucleon = (n: Pick<Nuclide, 'Z' | 'A' | 'mass'>) => bindingEnergy(n.Z, n.A, n.mass).perNucleon;

export default function Bindingsenergi() {
  const [mode, setMode] = useState<Mode>('kurve');
  const [idx, setIdx] = useState(FE_INDEX);
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const sel = CURVE[idx] ?? CURVE[0]!;
  const b = bindingEnergy(sel.Z, sel.A, sel.mass);
  const reaction = mode === 'kurve' ? null : REACTIONS[mode];
  const re = reaction ? reactionEnergy(reaction) : null;
  const plotH = narrow ? 620 : 430;
  const layout = sceneLayout(mode, narrow);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg visning" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'kurve' && (
        <Controls>
          <Slider
            label="Velg kjerne"
            value={idx}
            onChange={setIdx}
            min={0}
            max={CURVE.length - 1}
            step={1}
            format={(i) => {
              const n = CURVE[i];
              return n ? `${nuclideText(n.Z, n.A)} (${elementName(n.Z)})` : '';
            }}
          />
        </Controls>
      )}

      <div ref={ref}>
        <Figure viewBox={`0 0 ${W} ${layout.H}`} label={sceneLabel(mode, sel)} maxHeight={narrow ? 700 : 320}>
          <BindingScene mode={mode} sel={sel} layout={layout} />
        </Figure>
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={
            mode === 'kurve'
              ? `Bindingsenergi per nukleon som funksjon av nukleontallet, med hydrogen, helium, karbon, jern og uran tegnet som kjerner. Toppen ligger ved jern og nikkel, og piler viser at både fusjon av lette kjerner og fisjon av tunge kjerner går mot jern. Valgt kjerne: ${nuclideText(sel.Z, sel.A)} med ${fmt(b.perNucleon, 2)} MeV per nukleon.`
              : `Bindingsenergi per nukleon med ${mode === 'fisjon' ? 'fisjon av uran-235' : 'fusjon av lette kjerner til helium'} markert.`
          }
          maxHeight={narrow ? 640 : 440}
        >
          <CurvePlot mode={mode} sel={sel} height={plotH} narrow={narrow} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: CURVE_COLOR, label: 'Stabile og langlivede kjerner' },
          {
            color: REACTION_COLOR,
            label:
              mode === 'kurve'
                ? 'Fusjon og fisjon: mot jern frigjøres energi'
                : mode === 'fisjon'
                  ? 'Fisjon: tung kjerne spaltes'
                  : 'Fusjon: lette kjerner smelter sammen',
          },
          ...(mode === 'fisjon' || mode === 'fusjon' ? [{ color: VIZ.velocity, label: 'Fart etter reaksjonen' }] : []),
        ]}
      />

      {mode === 'kurve' || !re ? (
        <Readouts>
          <Readout label="Massedefekt Δm" value={fmt(b.dm, 4)} unit="u" />
          <Readout
            label={
              <>
                Bindingsenergi E<Sub>b</Sub>
              </>
            }
            value={fmt(b.E, b.E < 10 ? 2 : b.E < 100 ? 1 : 0)}
            unit="MeV"
          />
          <Readout
            label={
              <>
                Per nukleon E<Sub>b</Sub>/A
              </>
            }
            value={fmt(b.perNucleon, 2)}
            unit="MeV"
            tone={CURVE_COLOR}
          />
          <Readout label="Nukleontall A" value={String(sel.A)} />
        </Readouts>
      ) : (
        <Readouts>
          <Readout label="Massetap Δm" value={fmt(re.dm, 4)} unit="u" />
          <Readout label="Frigjort energi Q" value={fmt(re.Q, 1)} unit="MeV" tone={REACTION_COLOR} />
          <Readout label="Per nukleon i brenselet" value={fmt(re.perNucleon, 2)} unit="MeV" />
          <Readout label="Per kilogram brensel" value={fmtSci(re.perKg, 1)} unit="J/kg" />
        </Readouts>
      )}

      <Formula label="Massedefekt og energi">{reaction && re ? reactionFormula(reaction, re) : bindingFormula(sel)}</Formula>

      <Explain>{explanation(mode, sel)}</Explain>
    </VizLayout>
  );
}

function sceneLabel(mode: Mode, sel: Nuclide): string {
  const b = bindingEnergy(sel.Z, sel.A, sel.mass);
  if (mode === 'kurve')
    return `Kjernen ${nuclideText(sel.Z, sel.A)} deles opp i ${sel.Z} frie protoner og ${sel.A - sel.Z} frie nøytroner. Det må tilføres ${fmt(b.E, 0)} MeV, og delene veier til sammen mer enn kjernen.`;
  const re = reactionEnergy(REACTIONS[mode]);
  const what =
    mode === 'fisjon'
      ? 'Brenselstaver i en kjernereaktor. Forstørret: et nøytron treffer uran-235, som spaltes i barium-141, krypton-92 og tre nøytroner som farer av gårde.'
      : mode === 'fusjon'
        ? 'Plasma i en fusjonsreaktor. Forstørret: deuterium og tritium smelter sammen til helium-4 og et nøytron, som farer av gårde fire ganger så fort.'
        : 'Sola. Forstørret: fire hydrogenkjerner blir til én heliumkjerne, og energien sendes ut som gammastråling.';
  return `${what} Massen før er ${fmt(re.mBefore, 4)} u og etter ${fmt(re.mAfter, 4)} u, og det frigjøres ${fmt(re.Q, 1)} MeV.`;
}

/** Kjernene som vises i hver reaksjon. */
function reactionPoints(r: Reaction): Nuclide[] {
  const out: Nuclide[] = [];
  for (const p of [...r.reactants, ...r.products]) {
    const n = p.Z > 0 ? findNuclide(p.Z, p.A) : undefined;
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Radius til en kjerne slik Atomkjerne tegner den (radius per nukleon r). */
function nucRadius(A: number, r: number) {
  return A <= 1 ? r : A <= 4 ? r * 2 : r * (1 + 1.1 * Math.cbrt(A));
}

/** Kjent kjerne i grafen: den lille kjernen står ved siden av punktet (forskyvning i px før mobilskalering). */
interface Known {
  Z: number;
  A: number;
  dx: number;
  dy: number;
  label: 'right' | 'left' | 'above';
}

const KNOWN: Known[] = [
  { Z: 1, A: 1, dx: 24, dy: -22, label: 'right' },
  { Z: 2, A: 4, dx: 8, dy: -42, label: 'above' },
  { Z: 6, A: 12, dx: 26, dy: -40, label: 'right' },
  { Z: 26, A: 56, dx: 0, dy: -36, label: 'right' },
  { Z: 92, A: 235, dx: -10, dy: -44, label: 'left' },
];

/** Kjerne til grafen: ett proton for ¹H, ellers Atomkjerne. */
function SmallNucleus({ x, y, Z, A, r }: { x: number; y: number; Z: number; A: number; r: number }) {
  return A === 1 ? <Nukleon x={x} y={y} r={r} type="proton" tegn={false} /> : <Atomkjerne x={x} y={y} Z={Z} N={A - Z} r={r} seed={A} tegn={false} />;
}

function CurvePlot({ mode, sel, height, narrow }: { mode: Mode; sel: Nuclide; height: number; narrow: boolean }) {
  const f = useTextScale();
  const s = useSceneScale();
  const fillId = useSvgId('be-under-kurven');
  const light = mode === 'fusjon' || mode === 'sola';
  const xMax = light ? 30 : 250;
  const reaction = mode === 'kurve' ? null : REACTIONS[mode];
  // Ved fisjon forstørres toppen av kurven, så økningen fra uran til bruddstykkene synes. I oversikten er det
  // plass over kurven til de små kjernene.
  const yAxis =
    mode === 'fisjon'
      ? { min: 7.4, max: 9, ticks: [7.5, 8, 8.5, 9], decimals: 1 }
      : mode === 'kurve'
        ? { min: 0, max: 11, ticks: [0, 2, 4, 6, 8, 10], decimals: 0 }
        : { min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10], decimals: 0 };
  const shown = CURVE.filter((n) => n.A <= xMax && perNucleon(n) >= yAxis.min);
  return (
    <Plot
      x={{ min: 0, max: xMax, label: light ? 'Nukleontall A (bare de letteste kjernene)' : 'Nukleontall A' }}
      y={{ ...yAxis, label: narrow ? 'Per nukleon (MeV)' : 'Bindingsenergi per nukleon (MeV)' }}
      width={800}
      height={height}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const pt = (n: Pick<Nuclide, 'Z' | 'A' | 'mass'>) => ({ x: sx(n.A), y: sy(perNucleon(n)) });
        const pts = shown.map(pt);
        const curve = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const first = pts[0];
        const last = pts[pts.length - 1];
        const area = first && last ? `${curve} ${last.x.toFixed(1)},${y0} ${first.x.toFixed(1)},${y0}` : '';
        const selP = pt(sel);
        const P = (A: number, v: number) => ({ x: sx(A), y: sy(v) });
        return (
          <g>
            {/* Toppen ved jern og nikkel */}
            {!light && (
              <rect x={sx(50)} y={y1} width={sx(66) - sx(50)} height={y0 - y1} fill={VIZ.series[2]} opacity={0.12} />
            )}
            <LinearGradient
              id={fillId}
              stops={[
                [0, CURVE_COLOR, 0.16],
                [1, CURVE_COLOR, 0.02],
              ]}
            />
            {area && <polygon points={area} fill={`url(#${fillId})`} />}
            {mode === 'kurve' && (
              <>
                {/* Valgt kjerne: hjelpelinjer bak alt annet */}
                <line x1={selP.x} x2={selP.x} y1={selP.y} y2={y0} className="viz-guide" />
                <line x1={x0} x2={selP.x} y1={selP.y} y2={selP.y} className="viz-guide" />
              </>
            )}
            <polyline points={curve} fill="none" stroke={CURVE_COLOR} strokeWidth={2.4} strokeLinejoin="round" opacity={0.85} />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={CURVE_COLOR} stroke={VIZ.surface} strokeWidth={1.5} />
            ))}

            {mode === 'kurve' && (
              <>
                <Txt x={sx(50) + 4} y={y0 - 12} anchor="start" muted size={0.85}>
                  mest stabile kjerner
                </Txt>
                {/* Retningene som frigjør energi: begge går mot jern */}
                {(() => {
                  const a = P(9, 2.9);
                  const c = P(16, 7.6);
                  const e = P(46, 7.85);
                  return <BuePil x1={a.x} y1={a.y} cx={c.x} cy={c.y} x2={e.x} y2={e.y} color={REACTION_COLOR} />;
                })()}
                {(() => {
                  const a = P(232, 6.5);
                  const c = P(150, 6.8);
                  const e = P(70, 7.95);
                  return <BuePil x1={a.x} y1={a.y} cx={c.x} cy={c.y} x2={e.x} y2={e.y} color={REACTION_COLOR} />;
                })()}
                <Txt x={sx(26)} y={sy(5.2)} anchor="start" weight={700} color={REACTION_COLOR}>
                  fusjon
                </Txt>
                <Txt x={sx(150)} y={sy(6.1) + 6 * f} weight={700} color={REACTION_COLOR}>
                  fisjon
                </Txt>
                {/* Kjente kjerner tegnet som små kjerner ved punktet sitt */}
                {KNOWN.map((k) => {
                  const n = findNuclide(k.Z, k.A)!;
                  const p = pt(n);
                  const r = 3.6 * s;
                  const R = nucRadius(k.A, r);
                  const c = { x: p.x + k.dx * s, y: p.y + k.dy * s };
                  const len = Math.hypot(c.x - p.x, c.y - p.y);
                  const ux = (c.x - p.x) / len;
                  const uy = (c.y - p.y) / len;
                  const lx = k.label === 'right' ? c.x + R + 6 * f : k.label === 'left' ? c.x - R - 6 * f : c.x;
                  const ly = k.label === 'above' ? c.y - R - 8 * f : c.y + 6 * f;
                  return (
                    <g key={k.A}>
                      <line x1={p.x + ux * 6} y1={p.y + uy * 6} x2={c.x - ux * (R + 2)} y2={c.y - uy * (R + 2)} stroke={VIZ.muted} strokeWidth={1.3} />
                      <SmallNucleus x={c.x} y={c.y} Z={k.Z} A={k.A} r={r} />
                      <Txt x={lx} y={ly} anchor={k.label === 'right' ? 'start' : k.label === 'left' ? 'end' : 'middle'} weight={700}>
                        {nuclideText(k.Z, k.A)}
                      </Txt>
                    </g>
                  );
                })}
                {/* Valgt kjerne */}
                <circle cx={selP.x} cy={selP.y} r={9} fill="none" stroke={VIZ.ink} strokeWidth={2.5} />
                <Txt x={x1 - 8} y={narrow ? y0 - 16 - 40 * f : y0 - 16} anchor="end" weight={700}>
                  {nuclideText(sel.Z, sel.A)}: {fmt(perNucleon(sel), 2)} MeV per nukleon
                </Txt>
              </>
            )}

            {reaction && <ReactionMarks r={reaction} sx={sx} sy={sy} f={f} s={s} />}
          </g>
        );
      }}
    </Plot>
  );
}

function ReactionMarks({ r, sx, sy, f, s }: { r: Reaction; sx: (v: number) => number; sy: (v: number) => number; f: number; s: number }) {
  const pts = reactionPoints(r);
  const fuel = r.fuel.map((p) => findNuclide(p.Z, p.A)!);
  const prods = r.products.filter((p) => p.Z > 0).map((p) => findNuclide(p.Z, p.A)!);
  const P = (n: Nuclide) => ({ x: sx(n.A), y: sy(perNucleon(n)) });
  const rn = (r.id === 'fisjon' ? 2.6 : 5) * s;
  const R = (n: Nuclide) => nucRadius(n.A, rn);
  // Hvor etiketten står i forhold til kjernen
  const place: Record<string, { side: 'below' | 'above' | 'right' | 'left' | 'aboveRight'; text?: string }> = {
    '92-235': { side: 'below' },
    '56-141': { side: 'aboveRight' },
    '36-92': { side: 'below' },
    '1-2': { side: 'right' },
    '1-3': { side: 'right' },
    '2-4': { side: 'left' },
    '1-1': { side: 'right', text: '4 · ¹H' },
  };
  return (
    <g>
      {fuel.flatMap((a) =>
        prods.map((b) => {
          const pa = P(a);
          const pb = P(b);
          const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          const ux = (pb.x - pa.x) / len;
          const uy = (pb.y - pa.y) / len;
          return (
            <Arrow
              key={`${a.A}-${b.A}`}
              x1={pa.x + ux * (R(a) + 4)}
              y1={pa.y + uy * (R(a) + 4)}
              x2={pb.x - ux * (R(b) + 5)}
              y2={pb.y - uy * (R(b) + 5)}
              color={REACTION_COLOR}
              width={3}
            />
          );
        }),
      )}
      {pts.map((n) => {
        const p = P(n);
        const o = place[`${n.Z}-${n.A}`] ?? { side: 'right' as const };
        const rr = R(n);
        const g = 6 * f;
        const pos =
          o.side === 'below'
            ? { x: p.x, y: p.y + rr + 18 * f, a: 'middle' as const }
            : o.side === 'above'
              ? { x: p.x, y: p.y - rr - g, a: 'middle' as const }
              : o.side === 'left'
                ? { x: p.x - rr - g, y: p.y + 6 * f, a: 'end' as const }
                : o.side === 'aboveRight'
                  ? { x: p.x + rr * 0.7, y: p.y - rr - 2 * f, a: 'start' as const }
                  : // Over x-aksen for ¹H, så teksten ikke står på akselinja
                    { x: p.x + rr + g, y: n.A === 1 ? p.y - 8 * f : p.y + 6 * f, a: 'start' as const };
        return (
          <g key={`${n.Z}-${n.A}`}>
            <circle cx={p.x} cy={p.y} r={rr + 3} fill="none" stroke={REACTION_COLOR} strokeWidth={2.5} />
            <SmallNucleus x={p.x} y={p.y} Z={n.Z} A={n.A} r={rn} />
            <Txt x={pos.x} y={pos.y} anchor={pos.a} weight={700} color={REACTION_COLOR}>
              {o.text ?? nuclideText(n.Z, n.A)}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function particleText(p: Particle): string {
  const name = p.Z === 0 ? 'n' : nuclideText(p.Z, p.A);
  return `${p.count > 1 ? `${p.count} ` : ''}m(${name})`;
}

function reactionFormula(r: Reaction, re: ReturnType<typeof reactionEnergy>): ReactNode {
  const left = r.reactants.map(particleText).join(' + ');
  const right = r.products.map(particleText).join(' − ');
  return (
    <>
      <FormulaLine>
        Δm = {left} − {right}
      </FormulaLine>
      <FormulaLine>
        Δm = {fmt(re.mBefore, 6)} u − {fmt(re.mAfter, 6)} u = {fmt(re.dm, 6)} u
      </FormulaLine>
      <FormulaLine>
        Q = Δm · c² = {fmt(re.dm, 6)} · 1,66 · 10⁻²⁷ kg · (3,00 · 10⁸ m/s)² = {fmtSci(re.QJ, 2)} J = {fmt(re.Q, 1)} MeV
      </FormulaLine>
    </>
  );
}

function bindingFormula(n: Nuclide): ReactNode {
  const b = bindingEnergy(n.Z, n.A, n.mass);
  const N = n.A - n.Z;
  const Ed = b.E < 10 ? 2 : b.E < 100 ? 1 : 0;
  return (
    <>
      <FormulaLine>Δm = Z · m(¹H) + N · m(n) − m(atom)</FormulaLine>
      <FormulaLine>
        Δm = {n.Z} · {fmt(M_H1_U, 6)} u + {N} · {fmt(M_NEUTRON_U, 6)} u − {fmt(n.mass, 6)} u = {fmt(b.dm, 6)} u
      </FormulaLine>
      <FormulaLine>
        E<Sub>b</Sub> = Δm · c² = {fmt(b.dm, 6)} · 1,66 · 10⁻²⁷ kg · (3,00 · 10⁸ m/s)² = {fmtSci(b.EJ, 2)} J = {fmt(b.E, Ed)} MeV
      </FormulaLine>
      <FormulaLine>
        E<Sub>b</Sub>/A = {fmt(b.E, Ed)} MeV / {n.A} = {fmt(b.perNucleon, 2)} MeV
      </FormulaLine>
    </>
  );
}

function explanation(mode: Mode, sel: Nuclide): ReactNode {
  if (mode === 'kurve') {
    const iso = nuclideText(sel.Z, sel.A);
    const be = perNucleon(sel);
    let where: ReactNode;
    if (sel.A === 1) where = <>¹H er bare ett proton. Det er ingenting som holdes sammen, så bindingsenergien er null.</>;
    else if (sel.A < 56)
      where = (
        <>
          {iso} ligger til venstre for toppen. Lette kjerner kan frigjøre energi ved å smelte sammen til tyngre kjerner (fusjon), fordi
          nukleonene da blir sterkere bundet.
          {sel.Z === 2 && sel.A === 4
            ? ' ⁴He ligger høyt over naboene sine: den er ekstra godt bundet, og derfor sendes nettopp heliumkjerner ut ved α-stråling.'
            : ''}
        </>
      );
    else if (sel.A <= 62)
      where = (
        <>
          {iso} ligger på toppen ({fmt(be, 2)} MeV per nukleon). Her er nukleonene sterkest bundet, så verken fusjon eller fisjon kan
          frigjøre energi fra jern og nikkel.
        </>
      );
    else
      where = (
        <>
          {iso} ligger til høyre for toppen. Tunge kjerner kan frigjøre energi ved å spaltes i to mellomtunge kjerner (fisjon), som har
          høyere bindingsenergi per nukleon.
        </>
      );
    return (
      <p>
        <strong>Bindingsenergien</strong> er energien som trengs for å dele kjernen opp i frie protoner og nøytroner, som i bildet over.
        {sel.A > 1 ? (
          <>
            {' '}
            Delene veier til sammen mer enn kjernen, og massedefekten Δm svarer til bindingsenergien: E<Sub>b</Sub> = Δm · c².
          </>
        ) : null}{' '}
        {where} Det er derfor både kjernekraftverk og sola gir energi: fisjon og fusjon flytter nukleonene mot toppen ved jern, der de
        er sterkest bundet.
      </p>
    );
  }
  const r = reactionEnergy(REACTIONS[mode]);
  const fis = reactionEnergy(REACTIONS.fisjon);
  if (mode === 'fisjon') {
    const coalTonnes = coalEquivalentKg(fis.perKg / 1000) / 1000;
    return (
      <p>
        <strong>Fisjon.</strong> Et nøytron treffer ²³⁵U, som spaltes i ¹⁴¹Ba og ⁹²Kr og sender ut 3 nye nøytroner. Bruddstykkene ligger
        høyere på kurven (ca. 8,4 MeV per nukleon mot 7,6 for uran), så nukleonene blir sterkere bundet. Massen etter er {fmt(r.dm, 3)} u
        mindre enn før, og energien som svarer til massetapet, {fmt(r.Q, 1)} MeV, blir frigjort, mest som bevegelsesenergi til
        bruddstykkene. De nye nøytronene kan spalte flere urankjerner: en kjedereaksjon. Bruddstykkene bremses i brenselet, og
        bevegelsesenergien blir til varme som koker vann i reaktoren. Det er derfor ett gram uran-235 gir like mye energi som ca.{' '}
        {fmt(coalTonnes, 1)} tonn kull.
      </p>
    );
  }
  if (mode === 'fusjon') {
    const ff = fusionFragments();
    return (
      <p>
        <strong>Fusjon.</strong> Deuterium (²H) og tritium (³H) smelter sammen til ⁴He og et nøytron og frigjør {fmt(r.Q, 1)} MeV. Det er
        bare en tiendedel av energien fra én fisjon, men per nukleon er det {fmt(r.perNucleon, 1)} MeV mot {fmt(fis.perNucleon, 2)} MeV,
        omtrent {fmt(r.perNucleon / fis.perNucleon, 0)} ganger så mye. Men kjernene er positivt ladd og frastøter hverandre, så det trengs
        over 100 millioner grader før de kommer nær nok til å smelte sammen. Derfor er fusjon så vanskelig å få til på jorda. Heliumkjernen
        og nøytronet får like stor bevegelsesmengde i hver sin retning, så det lette nøytronet farer fortest og får{' '}
        {fmt((ff.n.K / ff.Q) * 100, 0)} % av energien ({fmt(ff.n.K, 1)} MeV). Det er derfor en fusjonsreaktor har en tykk vegg som fanger
        nøytronene og blir varm.
      </p>
    );
  }
  const tonnes = massLossPerSecond(SUN_POWER_W) / 1000;
  return (
    <p>
      <strong>Fusjon i sola.</strong> I kjernen av sola blir fire hydrogenkjerner (protoner) til én heliumkjerne i flere trinn. Underveis
      blir to av protonene til nøytroner, og det sendes ut to positroner og to nøytrinoer. Til sammen forsvinner {fmt((r.dm / r.mBefore) * 100, 1)} % av massen, og det gir{' '}
      {fmt(r.Q, 1)} MeV per heliumkjerne. Temperaturen i kjernen av sola er ca. 15 millioner K, og det enorme trykket holder reaksjonene i
      gang. Det er derfor sola blir ca. {fmt(tonnes / 1e6, 0)} millioner tonn lettere hvert sekund: så mye masse blir til lyset og varmen
      den stråler ut.
    </p>
  );
}
