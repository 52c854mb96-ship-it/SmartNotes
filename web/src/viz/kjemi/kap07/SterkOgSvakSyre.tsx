import { useState, type ReactNode } from 'react';
import {
  Begerglass,
  Controls,
  Dot,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Partikler,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Sub,
  TFormel,
  TReaksjon,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formulaText,
  linePath,
  superscript,
  useContainerTextScale,
  useTextScale,
  type ParticleGroup,
} from '../kit';
import { liquidWithIndicator } from './indikator';
import { KB_NH3, WEAK_ACIDS, protolysedCount, strongAcid, strongBase, weakAcid, weakBase, type AcidSolution } from './model';

type Mode = 'syre' | 'base';

/** Antall syre- eller basemolekyler (formelenheter) per glass i partikkelbildet, før protolysen. */
const N = 24;
const LG_MIN = -4;
const LG_MAX = 0;

interface Side {
  formula: string;
  name: string;
  kind: string;
  equation: string;
  /** Kation og anion etter protolysen. */
  cation: string;
  anion: string;
  /** Tekst i molekylet som ikke har reagert (HA eller NH₃). */
  molLabel: string;
  sol: AcidSolution;
}

function sides(mode: Mode, weakId: string, c: number): { strong: Side; weak: Side; K: number; Kname: string } {
  if (mode === 'syre') {
    const a = WEAK_ACIDS.find((x) => x.id === weakId) ?? WEAK_ACIDS[0]!;
    return {
      K: a.Ka,
      Kname: 'a',
      strong: {
        formula: 'HCl',
        name: 'saltsyre',
        kind: 'sterk syre',
        equation: 'HCl(aq) + H2O(l) → H3O^+(aq) + Cl^-(aq)',
        cation: 'H3O^+',
        anion: 'Cl^-',
        molLabel: 'HCl',
        sol: strongAcid(c),
      },
      weak: {
        formula: a.formula,
        name: a.name,
        kind: 'svak syre',
        equation: `${a.formula}(aq) + H2O(l) ⇌ H3O^+(aq) + ${a.base}(aq)`,
        cation: 'H3O^+',
        anion: a.base,
        molLabel: 'HA',
        sol: weakAcid(c, a.Ka),
      },
    };
  }
  return {
    K: KB_NH3,
    Kname: 'b',
    strong: {
      formula: 'NaOH',
      name: 'natriumhydroksid',
      kind: 'sterk base',
      equation: 'NaOH(s) → Na^+(aq) + OH^-(aq)',
      cation: 'Na^+',
      anion: 'OH^-',
      molLabel: 'NaOH',
      sol: strongBase(c),
    },
    weak: {
      formula: 'NH3',
      name: 'ammoniakk',
      kind: 'svak base',
      equation: 'NH3(aq) + H2O(l) ⇌ NH4^+(aq) + OH^-(aq)',
      cation: 'NH4^+',
      anion: 'OH^-',
      molLabel: 'NH₃',
      sol: weakBase(c, KB_NH3),
    },
  };
}

const pct = (a: number) => (a >= 0.995 ? '100' : fmtSig(a * 100, 2));

export default function SterkOgSvakSyre() {
  const [mode, setMode] = useState<Mode>('syre');
  const [weakId, setWeakId] = useState('eddiksyre');
  const [lgc, setLgc] = useState(-1);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const c = 10 ** lgc;
  const { strong, weak, K, Kname } = sides(mode, weakId, c);
  const stacked = f > 1.3;
  const scene = sceneLayout(stacked, f);
  const plotH = Math.round(330 + 220 * (f - 1));
  // Fortynning ti ganger (eller konsentrering helt til venstre på aksen)
  const step = lgc - 1 >= LG_MIN - 1e-9 ? -1 : 1;
  const strongNext = sides(mode, weakId, 10 ** (lgc + step)).strong.sol;
  const weakNext = sides(mode, weakId, 10 ** (lgc + step)).weak.sol;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Sammenlign syrer eller baser"
          options={[
            { value: 'syre', label: 'Sterk og svak syre' },
            { value: 'base', label: 'Sterk og svak base' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'syre' && (
          <Select
            label="Svak syre"
            value={weakId}
            onChange={setWeakId}
            options={WEAK_ACIDS.map((a) => ({ value: a.id, label: `${a.name} (${formulaText(a.formula)})` }))}
          />
        )}
      </Toolbar>
      <Controls>
        <Slider
          label="Konsentrasjon c"
          ariaLabel="Konsentrasjon"
          value={lgc}
          onChange={(v) => setLgc(Math.round(v * 10) / 10)}
          min={LG_MIN}
          max={LG_MAX}
          step={0.1}
          format={(v) => `${fmtSig(10 ** v, 2)} mol/L`}
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${scene.H}`}
          label={`${strong.formula} og ${weak.formula}, begge ${fmtSig(c, 2)} mol/L: pH ${fmt(strong.sol.pH, 2)} og ${fmt(weak.sol.pH, 2)}. Protolysegrad ${pct(strong.sol.alpha)} % og ${pct(weak.sol.alpha)} %.`}
          caption={`Hvert glass viser ${N} ${mode === 'syre' ? 'syremolekyler' : 'formelenheter eller molekyler'} før de reagerer med vann. Vannmolekylene er ikke tegnet, og ${weak.name} har minst én protolysert partikkel i bildet selv om andelen er mindre. Fargen er universalindikator.`}
          maxHeight={scene.H}
        >
          {[strong, weak].map((s, i) => (
            <Panel key={i} side={s} weak={i === 1} layout={scene.panels[i]!} />
          ))}
        </Figure>
      </div>
      <Legend
        items={
          mode === 'syre'
            ? [
                { color: KJEMI.plus, label: <Formel f="H3O^+" /> },
                {
                  color: KJEMI.minus,
                  label: (
                    <span>
                      <Formel f="Cl^-" /> eller <Formel f={weak.anion} />
                    </span>
                  ),
                },
                {
                  color: KJEMI.molecule,
                  label: (
                    <span>
                      HA = <Formel f={weak.formula} /> (ikke protolysert)
                    </span>
                  ),
                },
              ]
            : [
                {
                  color: KJEMI.plus,
                  label: (
                    <span>
                      <Formel f="Na^+" /> eller <Formel f="NH4^+" />
                    </span>
                  ),
                },
                { color: KJEMI.minus, label: <Formel f="OH^-" /> },
                {
                  color: KJEMI.molecule,
                  label: (
                    <span>
                      <Formel f="NH3" /> (ikke protolysert)
                    </span>
                  ),
                },
              ]
        }
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`pH som funksjon av konsentrasjonen for ${strong.formula} og ${weak.formula}.`}
        caption="Logaritmisk konsentrasjonsakse: hvert steg mot venstre er en fortynning ti ganger. Trappene viser hvor mye pH endrer seg."
        maxHeight={plotH}
      >
        <DilutionPlot mode={mode} weakId={weakId} lgc={lgc} step={step} strong={strong} weak={weak} strongNext={strongNext} weakNext={weakNext} H={plotH} />
      </Figure>
      <Legend
        items={[
          { color: VIZ.series[0]!, label: <span>{strong.formula === 'HCl' ? 'HCl (sterk syre)' : 'NaOH (sterk base)'}</span> },
          {
            color: VIZ.series[1]!,
            label: (
              <span>
                <Formel f={weak.formula} /> ({weak.kind})
              </span>
            ),
          },
        ]}
      />

      <Readouts>
        <Readout label={<>pH i {strong.formula}</>} value={fmt(strong.sol.pH, 2)} tone={VIZ.series[0]} />
        <Readout
          label={
            <>
              pH i <Formel f={weak.formula} />
            </>
          }
          value={fmt(weak.sol.pH, 2)}
          tone={VIZ.series[1]}
        />
        <Readout
          label={
            <>
              Protolysegrad, <Formel f={weak.formula} />
            </>
          }
          value={pct(weak.sol.alpha)}
          unit="%"
        />
        <Readout
          label={
            <>
              K<Sub>{Kname}</Sub>
            </>
          }
          value={fmtSig(K, 2)}
        />
      </Readouts>

      <Formula label="Utregning">
        {mode === 'syre' ? (
          <FormulaLine>
            Sterk syre: [<Formel f="H3O^+" />] = c = {fmtSig(c, 2)} mol/L, pH = −lg {fmtSig(strong.sol.h3o, 3)} = {fmt(strong.sol.pH, 2)}
          </FormulaLine>
        ) : (
          <FormulaLine>
            Sterk base: [<Formel f="OH^-" />] = c = {fmtSig(c, 2)} mol/L, pOH = {fmt(14 - strong.sol.pH, 2)}, pH = 14,00 − pOH = {fmt(strong.sol.pH, 2)}
          </FormulaLine>
        )}
        <FormulaLine>
          Svak {mode}: K<Sub>{Kname}</Sub> = x² / (c − x), der x = [{mode === 'syre' ? <Formel f="H3O^+" /> : <Formel f="OH^-" />}] ⇒ x² + K<Sub>{Kname}</Sub>
          ·x − K<Sub>{Kname}</Sub>·c = 0
        </FormulaLine>
        <FormulaLine>
          x = (−K<Sub>{Kname}</Sub> + √(K<Sub>{Kname}</Sub>² + 4K<Sub>{Kname}</Sub>·c)) / 2 = {fmtSig(mode === 'syre' ? weak.sol.h3o : weak.sol.oh, 3)} mol/L
          {mode === 'syre' ? (
            <>, pH = {fmt(weak.sol.pH, 2)}</>
          ) : (
            <>
              , pOH = {fmt(14 - weak.sol.pH, 2)}, pH = {fmt(weak.sol.pH, 2)}
            </>
          )}
        </FormulaLine>
        <FormulaLine>
          Protolysegrad = x / c = {fmtSig(mode === 'syre' ? weak.sol.h3o : weak.sol.oh, 3)} / {fmtSig(c, 2)} = {pct(weak.sol.alpha)} %
        </FormulaLine>
      </Formula>

      <Explain>{explanation(mode, c, strong, weak, step, strongNext, weakNext, K)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur 1: to glass med partikler ---------- */

interface PanelLayout {
  x: number;
  w: number;
  title: number;
  eq: number;
  beaker: { x: number; y: number; w: number; h: number };
  stats: { x: number; y: number; anchor: 'start' | 'middle' }[];
}

function sceneLayout(stacked: boolean, f: number): { H: number; panels: PanelLayout[] } {
  if (!stacked) {
    const panels = [20, 410].map((x) => {
      const w = 370;
      const title = 24 * f;
      const eq = title + 30 * f;
      const beaker = { x: x + w / 2 - 110, y: eq + 34, w: 220, h: 200 };
      const sy = beaker.y + beaker.h + 34 * f;
      return { x, w, title, eq, beaker, stats: [{ x: x + w / 2, y: sy, anchor: 'middle' as const }] };
    });
    return { H: Math.round(panels[0]!.stats[0]!.y + 16 * f), panels };
  }
  const panelH = 26 * f + 30 * f + 290;
  const panels = [0, 1].map((i) => {
    const y0 = i * (panelH + 20 * f);
    const title = y0 + 24 * f;
    const eq = title + 30 * f;
    const beaker = { x: 30, y: eq + 30, w: 340, h: 250 };
    return {
      x: 20,
      w: 760,
      title,
      eq,
      beaker,
      stats: [0, 1, 2].map((j) => ({ x: 410, y: beaker.y + 50 + j * 44 * f, anchor: 'start' as const })),
    };
  });
  return { H: Math.round(2 * panelH + 30 * f), panels };
}

function Panel({ side, weak, layout: L }: { side: Side; weak: boolean; layout: PanelLayout }) {
  const nP = weak ? protolysedCount(side.sol.alpha, N) : N;
  const groups: ParticleGroup[] = [
    { n: N - nP, r: 11, fill: KJEMI.molecule, label: side.molLabel },
    { n: nP, r: 8, fill: KJEMI.plus, label: '+' },
    { n: nP, r: 8, fill: KJEMI.minus, label: '−' },
  ];
  const B = L.beaker;
  const color = weak ? VIZ.series[1] : VIZ.series[0];
  const stats: ReactNode[] = [
    <>pH {fmt(side.sol.pH, 2)}</>,
    <>{pct(side.sol.alpha)} % protolysert</>,
    <>
      {nP} av {N} har reagert
    </>,
  ];
  return (
    <g>
      <Txt x={L.x} y={L.title} anchor="start" weight={700} color={color}>
        <TFormel f={side.formula} />
        <tspan fontWeight={500} className="is-muted">
          {' '}
          ({side.kind})
        </tspan>
      </Txt>
      <Txt x={L.x} y={L.eq} anchor="start" size={0.8}>
        <TReaksjon r={side.equation} />
      </Txt>
      <Begerglass x={B.x} y={B.y} w={B.w} h={B.h} level={0.9} liquid={liquidWithIndicator('universal', side.sol.pH, 0.42)}>
        {(box) => <Partikler box={box} groups={groups} seed={weak ? 11 : 7} />}
      </Begerglass>
      {L.stats.length === 1 ? (
        <Txt x={L.stats[0]!.x} y={L.stats[0]!.y} weight={700}>
          pH {fmt(side.sol.pH, 2)}
          <tspan fontWeight={500} className="is-muted">
            {'  ·  '}
            {pct(side.sol.alpha)} % protolysert
          </tspan>
        </Txt>
      ) : (
        L.stats.map((p, i) => (
          <Txt key={i} x={p.x} y={p.y} anchor={p.anchor} weight={i === 0 ? 700 : 500} muted={i === 2} size={i === 0 ? 1.1 : 0.9} color={i === 0 ? color : undefined}>
            {stats[i]}
          </Txt>
        ))
      )}
    </g>
  );
}

/* ---------- Figur 2: pH som funksjon av konsentrasjonen ---------- */

function DilutionPlot({
  mode,
  weakId,
  lgc,
  step,
  strong,
  weak,
  strongNext,
  weakNext,
  H,
}: {
  mode: Mode;
  weakId: string;
  lgc: number;
  step: number;
  strong: Side;
  weak: Side;
  strongNext: AcidSolution;
  weakNext: AcidSolution;
  H: number;
}) {
  const pts = (which: 'strong' | 'weak'): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const lg = LG_MIN + ((LG_MAX - LG_MIN) * i) / 120;
      out.push([lg, sides(mode, weakId, 10 ** lg)[which].sol.pH]);
    }
    return out;
  };
  const f = useTextScale();
  const y = mode === 'syre' ? { min: 0, max: 7 } : { min: 7, max: 14 };
  return (
    <Plot x={{ min: LG_MIN, max: LG_MAX, label: 'Konsentrasjon c (mol/L)', ticks: [] }} y={{ ...y, label: 'pH' }} width={800} height={H}>
      {({ sx, sy, y0, y1 }) => (
        <g>
          {[-4, -3, -2, -1, 0].map((e) => (
            <g key={e}>
              <line x1={sx(e)} x2={sx(e)} y1={y0} y2={y1} className="viz-gridline" />
              <text x={sx(e)} y={y0 + 22 * f} textAnchor="middle" className="viz-tick">
                {e === 0 ? '1' : `10${superscript(e)}`}
              </text>
            </g>
          ))}
          <path d={linePath(pts('strong'), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3} />
          <path d={linePath(pts('weak'), sx, sy)} fill="none" stroke={VIZ.series[1]} strokeWidth={3} />
          <line x1={sx(lgc)} x2={sx(lgc)} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          <Stair x0={sx(lgc)} x1={sx(lgc + step)} ya={sy(strong.sol.pH)} yb={sy(strongNext.pH)} d={strongNext.pH - strong.sol.pH} color={VIZ.series[0]!} />
          <Stair x0={sx(lgc)} x1={sx(lgc + step)} ya={sy(weak.sol.pH)} yb={sy(weakNext.pH)} d={weakNext.pH - weak.sol.pH} color={VIZ.series[1]!} />
          <Dot x={sx(lgc)} y={sy(strong.sol.pH)} color={VIZ.series[0]} />
          <Dot x={sx(lgc)} y={sy(weak.sol.pH)} color={VIZ.series[1]} />
        </g>
      )}
    </Plot>
  );
}

/** Trapp fra (x0, ya) vannrett til x1 og loddrett til yb, med endringen i pH som etikett. */
function Stair({ x0, x1, ya, yb, d, color }: { x0: number; x1: number; ya: number; yb: number; d: number; color: string }) {
  const left = x1 < x0;
  return (
    <g>
      <line x1={x0} y1={ya} x2={x1} y2={ya} stroke={color} strokeWidth={1.8} strokeDasharray="4 3" />
      <line x1={x1} y1={ya} x2={x1} y2={yb} stroke={color} strokeWidth={2.2} />
      <circle cx={x1} cy={yb} r={4} fill={color} />
      <Txt x={left ? x1 - 8 : x1 + 8} y={(ya + yb) / 2 + 6} anchor={left ? 'end' : 'start'} size={0.85} weight={700} color={color}>
        {d >= 0 ? '+' : '−'}
        {fmt(Math.abs(d), 2)}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(mode: Mode, c: number, strong: Side, weak: Side, step: number, strongNext: AcidSolution, weakNext: AcidSolution, K: number): ReactNode {
  const W = <Formel f={weak.formula} />;
  const dS = Math.abs(strongNext.pH - strong.sol.pH);
  const dW = Math.abs(weakNext.pH - weak.sol.pH);
  const diluted = step < 0;
  const contrast =
    mode === 'syre' ? (
      <>
        Sterk og svak sier hvor stor andel av molekylene som protolyseres, ikke hvor mye syre det er. 0,0010 mol/L HCl har pH{' '}
        {fmt(strongAcid(0.001).pH, 2)}, mens 1,0 mol/L {weak.name} har pH {fmt(weakAcid(1, K).pH, 2)}: den svake syra er surest fordi det er
        så mye mer av den.
      </>
    ) : (
      <>
        Også en svak base gir en basisk løsning, men bare en liten del av <Formel f="NH3" />
        -molekylene tar opp et proton fra vannet. Basen trenger ikke selv inneholde <Formel f="OH^-" />: ionene dannes i protolysen.
      </>
    );
  return (
    <>
      <p>
        <strong>Samme konsentrasjon ({fmtSig(c, 2)} mol/L), ulik pH.</strong>{' '}
        {mode === 'syre' ? (
          <>
            HCl er en sterk syre og protolyseres fullstendig (→), så [<Formel f="H3O^+" />] = c og pH = {fmt(strong.sol.pH, 2)}. {capital(weak.name)} er en
            svak syre: bare {pct(weak.sol.alpha)} % av {W}-molekylene gir fra seg et proton (⇌), så pH blir {fmt(weak.sol.pH, 2)}.
          </>
        ) : (
          <>
            NaOH er en ionisk forbindelse som gir like mye <Formel f="OH^-" /> som c, så pH = {fmt(strong.sol.pH, 2)}. Ammoniakk er en svak base:
            bare {pct(weak.sol.alpha)} % av molekylene tar opp et proton fra vann (⇌), så pH blir {fmt(weak.sol.pH, 2)}.
          </>
        )}
      </p>
      <p>
        {diluted ? 'Fortynner du ti ganger' : 'Gjør du løsningen ti ganger sterkere'}, endres pH med {fmt(dS, 2)} for {strong.formula}, men bare{' '}
        {fmt(dW, 2)} for {W}. Protolysegraden til den svake {mode === 'syre' ? 'syra' : 'basen'} {diluted ? 'øker' : 'synker'} da fra {pct(weak.sol.alpha)} % til{' '}
        {pct(weakNext.alpha)} %: jo mer fortynnet, desto større andel reagerer med vannet.
      </p>
      <p>{contrast}</p>
    </>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
