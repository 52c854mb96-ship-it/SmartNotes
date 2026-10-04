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
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useTextScale,
} from '../kit';
import { elementName, nuclideText } from '../kap07/elements';
import { Txt } from '../kap07/parts';
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
import { useNarrow } from '../kap07/useNarrow';

type Mode = 'kurve' | Reaction['id'];

const MODES: { value: Mode; label: string }[] = [
  { value: 'kurve', label: 'Bindingsenergi' },
  { value: 'fisjon', label: 'Fisjon av uran' },
  { value: 'fusjon', label: 'Fusjon: D + T' },
  { value: 'sola', label: 'Fusjon i sola' },
];

const CURVE_COLOR = VIZ.series[0]!;
const REACTION_COLOR = VIZ.series[1]!;
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
        <Figure
          viewBox={`0 0 800 ${plotH}`}
          label={
            mode === 'kurve'
              ? `Bindingsenergi per nukleon som funksjon av nukleontallet. Toppen ligger ved jern og nikkel. Valgt kjerne: ${nuclideText(sel.Z, sel.A)} med ${fmt(b.perNucleon, 2)} MeV per nukleon.`
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
          ...(mode === 'kurve'
            ? []
            : [
                {
                  color: REACTION_COLOR,
                  label: mode === 'fisjon' ? 'Fisjon: tung kjerne spaltes' : 'Fusjon: lette kjerner smelter sammen',
                },
              ]),
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
          <Readout label="Per kilogram brensel" value={fmtSci(re.perKg, 1)} unit="J" />
        </Readouts>
      )}

      <Formula label="Massedefekt og energi">{reaction && re ? reactionFormula(reaction, re) : bindingFormula(sel)}</Formula>

      <Explain>{explanation(mode, sel)}</Explain>
    </VizLayout>
  );
}

/** Kjernene som vises i hver reaksjon, med etikett. */
function reactionPoints(r: Reaction): Nuclide[] {
  const out: Nuclide[] = [];
  for (const p of [...r.reactants, ...r.products]) {
    const n = p.Z > 0 ? findNuclide(p.Z, p.A) : undefined;
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function CurvePlot({ mode, sel, height, narrow }: { mode: Mode; sel: Nuclide; height: number; narrow: boolean }) {
  const f = useTextScale();
  const light = mode === 'fusjon' || mode === 'sola';
  const xMax = light ? 30 : 250;
  const reaction = mode === 'kurve' ? null : REACTIONS[mode];
  // Ved fisjon forstørres toppen av kurven, så økningen fra uran til bruddstykkene synes.
  const yAxis =
    mode === 'fisjon'
      ? { min: 7.4, max: 9, ticks: [7.5, 8, 8.5, 9], decimals: 1 }
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
        const curve = shown.map((n) => `${pt(n).x.toFixed(1)},${pt(n).y.toFixed(1)}`).join(' ');
        const selP = pt(sel);
        const fe = findNuclide(26, 56)!;
        return (
          <g>
            {/* Toppen ved jern og nikkel */}
            {!light && (
              <>
                <rect x={sx(50)} y={y1} width={sx(66) - sx(50)} height={y0 - y1} fill={VIZ.series[2]} opacity={0.12} />
                <Txt x={sx(66) + 6} y={y1 + 20 * f} anchor="start" muted>
                  mest stabile kjerner
                </Txt>
              </>
            )}
            <polyline points={curve} fill="none" stroke={CURVE_COLOR} strokeWidth={2} strokeLinejoin="round" opacity={0.8} />
            {shown.map((n) => {
              const p = pt(n);
              return <circle key={`${n.Z}-${n.A}`} cx={p.x} cy={p.y} r={4.5} fill={CURVE_COLOR} stroke={VIZ.surface} strokeWidth={1.5} />;
            })}

            {mode === 'kurve' && (
              <>
                {/* Retningene som frigjør energi */}
                <Arrow x1={sx(14)} y1={sy(2.4)} x2={sx(48)} y2={sy(2.4)} color={VIZ.muted} width={2} />
                <Txt x={sx(31)} y={sy(2.4) - 12} muted>
                  fusjon
                </Txt>
                <Arrow x1={sx(240)} y1={sy(5.6)} x2={sx(90)} y2={sy(5.6)} color={VIZ.muted} width={2} />
                <Txt x={sx(165)} y={sy(5.6) - 12} muted>
                  fisjon
                </Txt>
                <PointLabel x={sx(4)} y={sy(perNucleon(findNuclide(2, 4)!))} dx={34} dy={50 * f} text="⁴He" />
                <PointLabel x={sx(56)} y={sy(perNucleon(fe))} dx={-12} dy={-14} text="⁵⁶Fe" anchor="end" plain />
                <PointLabel x={sx(238)} y={sy(perNucleon(findNuclide(92, 238)!))} dx={4} dy={-16} text="²³⁸U" anchor="end" plain />
                {/* Valgt kjerne */}
                <line x1={selP.x} x2={selP.x} y1={selP.y} y2={y0} className="viz-guide" />
                <line x1={x0} x2={selP.x} y1={selP.y} y2={selP.y} className="viz-guide" />
                <circle cx={selP.x} cy={selP.y} r={9} fill="none" stroke={VIZ.ink} strokeWidth={2.5} />
                <Txt x={x1 - 8} y={y0 - 16} anchor="end" weight={700}>
                  {nuclideText(sel.Z, sel.A)}: {fmt(perNucleon(sel), 2)} MeV per nukleon
                </Txt>
              </>
            )}

            {reaction && <ReactionMarks r={reaction} sx={sx} sy={sy} f={f} />}
          </g>
        );
      }}
    </Plot>
  );
}

function PointLabel({
  x,
  y,
  dx,
  dy,
  text,
  anchor = 'start',
  plain = false,
  color,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Uten strek fra punktet til etiketten. */
  plain?: boolean;
  color?: string;
}) {
  return (
    <g>
      {!plain && <line x1={x} y1={y} x2={x + dx - (anchor === 'start' ? 4 : 0)} y2={y + dy - 6} stroke={VIZ.muted} strokeWidth={1.2} />}
      <Txt x={x + dx} y={y + dy} anchor={anchor} weight={700} color={color}>
        {text}
      </Txt>
    </g>
  );
}

function ReactionMarks({ r, sx, sy, f }: { r: Reaction; sx: (v: number) => number; sy: (v: number) => number; f: number }) {
  const pts = reactionPoints(r);
  const fuel = r.fuel.map((p) => findNuclide(p.Z, p.A)!);
  const prods = r.products.filter((p) => p.Z > 0).map((p) => findNuclide(p.Z, p.A)!);
  const P = (n: Nuclide) => ({ x: sx(n.A), y: sy(perNucleon(n)) });
  // Etikettplassering per kjerne (forskyvning i piksler)
  const offsets: Record<string, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; text?: string }> = {
    // Under punktet, så etiketten ikke ligger oppå pilene som går ut fra uran
    '92-235': { dx: 0, dy: 30 * f, anchor: 'middle' },
    // Under pilen til ⁹²Kr, som går rett under ¹⁴¹Ba
    '56-141': { dx: 0, dy: 54 * f, anchor: 'middle' },
    '36-92': { dx: 0, dy: 34 * f, anchor: 'middle' },
    '1-2': { dx: 14, dy: 6, anchor: 'start' },
    '1-3': { dx: 14, dy: 6, anchor: 'start' },
    '2-4': { dx: -14, dy: -10, anchor: 'end' },
    '1-1': { dx: 14, dy: -4, anchor: 'start', text: '4 · ¹H' },
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
              x1={pa.x + ux * 10}
              y1={pa.y + uy * 10}
              x2={pb.x - ux * 11}
              y2={pb.y - uy * 11}
              color={REACTION_COLOR}
              width={3}
            />
          );
        }),
      )}
      {pts.map((n) => {
        const p = P(n);
        const o = offsets[`${n.Z}-${n.A}`] ?? { dx: 12, dy: -10, anchor: 'start' as const };
        return (
          <g key={`${n.Z}-${n.A}`}>
            <circle cx={p.x} cy={p.y} r={7} fill={REACTION_COLOR} stroke={VIZ.surface} strokeWidth={2} />
            <Txt x={p.x + o.dx} y={p.y + o.dy} anchor={o.anchor} weight={700} color={REACTION_COLOR}>
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
        <strong>Bindingsenergien</strong> er energien som trengs for å dele kjernen opp i frie protoner og nøytroner.
        {sel.A > 1 ? (
          <>
            {' '}
            Kjernen veier mindre enn nukleonene hver for seg, og massedefekten Δm svarer til bindingsenergien: E<Sub>b</Sub> = Δm · c².
          </>
        ) : null}{' '}
        {where}
      </p>
    );
  }
  const r = reactionEnergy(REACTIONS[mode]);
  const fis = reactionEnergy(REACTIONS.fisjon);
  if (mode === 'fisjon')
    return (
      <p>
        <strong>Fisjon.</strong> Et nøytron treffer ²³⁵U, som spaltes i ¹⁴¹Ba og ⁹²Kr og sender ut 3 nye nøytroner. Bruddstykkene ligger
        høyere på kurven (ca. 8,4 MeV per nukleon mot 7,6 for uran), så nukleonene blir sterkere bundet. Massen etter er {fmt(r.dm, 3)} u
        mindre enn før, og den manglende massen er blitt {fmt(r.Q, 1)} MeV, mest som bevegelsesenergi til bruddstykkene. De nye nøytronene
        kan spalte flere urankjerner: en kjedereaksjon.
      </p>
    );
  if (mode === 'fusjon')
    return (
      <p>
        <strong>Fusjon.</strong> Deuterium (²H) og tritium (³H) smelter sammen til ⁴He og et nøytron og frigjør {fmt(r.Q, 1)} MeV. Det er
        bare en tiendedel av energien fra én fisjon, men per nukleon er det {fmt(r.perNucleon, 1)} MeV mot {fmt(fis.perNucleon, 2)} MeV,
        omtrent {fmt(r.perNucleon / fis.perNucleon, 0)} ganger så mye. Men kjernene er positivt ladd og frastøter hverandre, så det trengs
        over 100 millioner grader før de kommer nær nok til å smelte sammen. Derfor er fusjon så vanskelig å få til på jorda.
      </p>
    );
  return (
    <p>
      <strong>Fusjon i sola.</strong> I kjernen av sola blir fire hydrogenkjerner (protoner) til én heliumkjerne i flere trinn. Underveis
      blir to protoner til nøytroner ved β⁺-henfall. Til sammen forsvinner {fmt((r.dm / r.mBefore) * 100, 1)} % av massen, og det gir{' '}
      {fmt(r.Q, 1)} MeV per heliumkjerne. Temperaturen i kjernen av sola er ca. 15 millioner K, og det enorme trykket holder reaksjonene i
      gang.
    </p>
  );
}
