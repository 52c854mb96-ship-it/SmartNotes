import { useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Readout,
  Readouts,
  Reaksjon,
  Select,
  Slider,
  Sub,
  TFormel,
  TSub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  formulaText,
  reaction,
  scaleLinear,
  useContainerTextScale,
  type Term,
} from '../kit';
import {
  CUSTOM_ID,
  ENTHALPY_PRESETS,
  bare,
  catalysedEa,
  enthalpyKind,
  pathH,
  pathPoints,
  perGram,
  reverseEa,
  validEa,
  type EnthalpyPreset,
  type PathPoint,
} from './model';

const signed = (v: number, d = 0) => (v > 0 ? `+${fmt(v, d)}` : fmt(v, d));
const dec = (v: number) => (Number.isInteger(v) ? 0 : 1);

interface Current {
  name: string;
  equation: string | null;
  dH: number;
  ea: number;
  eaKnown: boolean;
  catalyst: { name: string; ea: number; known: boolean } | null;
  perGramOf: string | null;
  note: string | null;
}

export default function Entalpidiagram() {
  const [id, setId] = useState(ENTHALPY_PRESETS[0]!.id);
  const [cat, setCat] = useState(false);
  const [progress, setProgress] = useState(0.48);
  const [customDH, setCustomDH] = useState(-150);
  const [customEa, setCustomEa] = useState(120);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const preset = ENTHALPY_PRESETS.find((p) => p.id === id);
  const cur: Current = preset
    ? {
        name: preset.name,
        equation: preset.equation,
        dH: preset.dH,
        ea: preset.ea,
        eaKnown: preset.eaKnown,
        catalyst: preset.catalyst ?? null,
        perGramOf: preset.perGram,
        note: preset.note,
      }
    : {
        name: 'Egen reaksjon',
        equation: null,
        dH: customDH,
        ea: validEa(customDH, customEa),
        eaKnown: true,
        catalyst: { name: 'en katalysator', ea: catalysedEa(customDH, customEa), known: true },
        perGramOf: null,
        note: null,
      };
  const useCat = cat && !!cur.catalyst;
  const eaCat = cur.catalyst?.ea ?? cur.ea;
  const pts = pathPoints(cur.dH, cur.ea);
  const ptsCat = cur.catalyst ? pathPoints(cur.dH, cur.ea, eaCat) : null;
  const kind = enthalpyKind(cur.dH);
  const tone = cur.dH < 0 ? KJEMI.exo : KJEMI.endo;
  const pg = preset ? perGram(preset.equation, preset.dH, preset.perGram) : Number.NaN;
  const stage = stageAt(progress, useCat);

  const setDH = (v: number) => {
    setCustomDH(v);
    // Toppen må alltid ligge over både reaktantene og produktene.
    setCustomEa((ea) => validEa(v, ea));
  };

  // På mobil tegnes figurene i en smalere viewBox (460 bred) med vanlig tekststørrelse, så kurven blir høy nok.
  const narrow = f > 1.3;
  const W = narrow ? 460 : 800;
  const fi = narrow ? 1 : f;
  const L = diagramLayout(W, fi);
  const S = systemLayout(W, fi);

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Reaksjon"
          value={id}
          onChange={(v) => setId(v)}
          options={[...ENTHALPY_PRESETS.map((p) => ({ value: p.id, label: p.name })), { value: CUSTOM_ID, label: 'Egen reaksjon' }]}
        />
        {cur.catalyst && <Toggle label={preset ? `Med katalysator (${cur.catalyst.name})` : 'Med katalysator'} checked={cat} onChange={setCat} />}
      </Toolbar>
      <Controls>
        {!preset && (
          <>
            <Slider label="Reaksjonsentalpi ΔH" value={customDH} onChange={setDH} min={-500} max={500} step={5} format={(v) => `${signed(v)} kJ`} />
            <Slider
              label={
                <>
                  Aktiveringsenergi E<Sub>a</Sub>
                </>
              }
              ariaLabel="Aktiveringsenergi"
              value={cur.ea}
              onChange={(v) => setCustomEa(validEa(customDH, v))}
              min={5}
              max={600}
              step={5}
              format={(v) => `${fmt(v, 0)} kJ/mol`}
            />
          </>
        )}
        <Slider label="Reaksjonsforløp" value={Math.round(progress * 100)} onChange={(v) => setProgress(v / 100)} min={0} max={100} step={1} unit="%" />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${W} ${L.H}`}
          label={`Entalpidiagram: ${kind} reaksjon med ΔH = ${signed(cur.dH, dec(cur.dH))} kJ.${useCat ? ' Med katalysator er toppen lavere, men ΔH er den samme.' : ''}`}
          maxHeight={L.H}
        >
          <Diagram cur={cur} pts={pts} ptsCat={ptsCat} useCat={useCat} progress={progress} stage={stage} L={L} f={fi} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: tone, label: cur.dH < 0 ? 'Eksoterm: produktene har lavere entalpi' : 'Endoterm: produktene har høyere entalpi' },
          ...(useCat ? [{ color: VIZ.series[0]!, label: 'Med katalysator (en annen reaksjonsvei)', dashed: true }] : []),
        ]}
      />

      <Figure
        viewBox={`0 0 ${W} ${S.H}`}
        label={cur.dH < 0 ? 'Systemet avgir varme til omgivelsene.' : 'Systemet tar opp varme fra omgivelsene.'}
        maxHeight={S.H}
      >
        <SystemScene cur={cur} S={S} f={fi} />
      </Figure>

      <Readouts>
        <Readout label="Reaksjonsentalpi ΔH" value={signed(cur.dH, dec(cur.dH))} unit="kJ" tone={tone} />
        <Readout label="Type" value={kind === 'eksoterm' ? 'Eksoterm' : kind === 'endoterm' ? 'Endoterm' : 'Termonøytral'} tone={tone} />
        {preset && (
          <Readout
            label={
              <>
                ΔH per gram <Formel f={preset.perGram} />
              </>
            }
            value={signed(pg, Math.abs(pg) < 10 ? 2 : 1)}
            unit="kJ/g"
          />
        )}
        {cur.eaKnown && (
          <Readout
            label={
              <>
                E<Sub>a</Sub>
                {useCat ? ' med katalysator' : ''}
              </>
            }
            value={fmt(useCat ? eaCat : cur.ea, 0)}
            unit="kJ/mol"
          />
        )}
        {!preset && <Readout label="Eₐ for motsatt reaksjon" value={fmt(reverseEa(cur.dH, useCat ? eaCat : cur.ea), 0)} unit="kJ/mol" />}
      </Readouts>

      <Formula label="Utregning">
        {cur.equation && (
          <FormulaLine>
            <Reaksjon r={cur.equation} /> &nbsp; ΔH = {signed(cur.dH, dec(cur.dH))} kJ
          </FormulaLine>
        )}
        <FormulaLine>
          ΔH = H(produkter) − H(reaktanter) = {signed(cur.dH, dec(cur.dH))} kJ {cur.dH < 0 ? '< 0' : '> 0'}
        </FormulaLine>
        {cur.eaKnown && (
          <FormulaLine>
            E<Sub>a</Sub>(motsatt vei) = E<Sub>a</Sub> − ΔH = {fmt(useCat ? eaCat : cur.ea, 0)} − ({signed(cur.dH, dec(cur.dH))}) ={' '}
            {fmt(reverseEa(cur.dH, useCat ? eaCat : cur.ea), 0)} kJ/mol
          </FormulaLine>
        )}
        {preset && Number.isFinite(pg) && <PerGramLine preset={preset} pg={pg} />}
      </Formula>

      <Explain>{explanation(cur, useCat, eaCat, stage, preset)}</Explain>
    </VizLayout>
  );
}

function PerGramLine({ preset, pg }: { preset: EnthalpyPreset; pg: number }) {
  const rx = reaction(preset.equation);
  const t = [...rx.reactants, ...rx.products].find((x) => bare(x.formula) === preset.perGram)!;
  const M = preset.dH / pg / t.coef;
  return (
    <FormulaLine>
      ΔH per gram = ΔH / (n · M) = {signed(preset.dH, dec(preset.dH))} kJ / ({t.coef === 0.5 ? '½' : fmt(t.coef, 0)} mol · {fmt(M, 2)} g/mol) ={' '}
      {signed(pg, Math.abs(pg) < 10 ? 2 : 1)} kJ/g
    </FormulaLine>
  );
}

/* ---------- Hvor på kurven er vi? ---------- */

type Stage = 'reaktanter' | 'brytes' | 'topp' | 'mellomprodukt' | 'dannes' | 'produkter';

function stageAt(x: number, cat: boolean): Stage {
  if (x <= 0.14) return 'reaktanter';
  if (x >= 0.86) return 'produkter';
  if (!cat) return Math.abs(x - 0.48) <= 0.05 ? 'topp' : x < 0.48 ? 'brytes' : 'dannes';
  if (Math.abs(x - 0.34) <= 0.04 || Math.abs(x - 0.66) <= 0.04) return 'topp';
  if (Math.abs(x - 0.5) <= 0.05) return 'mellomprodukt';
  return x < 0.34 ? 'brytes' : x < 0.5 ? 'brytes' : 'dannes';
}

const STAGE_TITLE: Record<Stage, string> = {
  reaktanter: 'Reaktantene',
  brytes: 'Bindinger svekkes',
  topp: 'Overgangstilstand',
  mellomprodukt: 'Mellomprodukt',
  dannes: 'Nye bindinger dannes',
  produkter: 'Produktene',
};

/* ---------- Figur 1: entalpidiagrammet ---------- */

interface DiagramLayout {
  x0: number;
  x1: number;
  /** Øverste og nederste entalpi i figuren tegnes her. */
  top: number;
  low: number;
  /** x-aksen (under plassen til stoffnavnene). */
  bottom: number;
  H: number;
}

function diagramLayout(W: number, f: number): DiagramLayout {
  const top = 40 * f + 10;
  const low = top + (W < 600 ? 250 : 290);
  // Plass til to linjer med stoffnavn under det laveste nivået
  const bottom = low + 2 * 22 * f + 18;
  return { x0: 40 + 24 * f, x1: W - 30, top, low, bottom, H: Math.round(bottom + 34 * f + 8) };
}

/** Deler en side av likningen i linjer som får plass i bredden `maxW` (omtrentlig tekstbredde). */
function splitTerms(terms: Term[], maxW: number, fs: number): Term[][] {
  const width = (t: Term) => (formulaText(t.formula, true).length + (t.coef !== 1 ? 2 : 0) + 3) * 0.56 * fs;
  const lines: Term[][] = [[]];
  let w = 0;
  for (const t of terms) {
    const tw = width(t);
    if (w + tw > maxW && lines[lines.length - 1]!.length > 0) {
      lines.push([]);
      w = 0;
    }
    lines[lines.length - 1]!.push(t);
    w += tw;
  }
  return lines;
}

function SideLabel({
  terms,
  x,
  y,
  anchor,
  maxW,
  f,
  lineH,
}: {
  terms: Term[];
  x: number;
  y: number;
  anchor: 'start' | 'end';
  maxW: number;
  f: number;
  lineH: number;
}) {
  const lines = splitTerms(terms, maxW, 17 * f * 0.9);
  return (
    <g>
      {lines.map((line, i) => (
        <Txt key={i} x={x} y={y + i * lineH} anchor={anchor} size={0.9} weight={650}>
          {line.map((t, j) => (
            <tspan key={j}>
              {j > 0 ? ' + ' : ''}
              <TFormel f={t.formula} coef={t.coef} />
            </tspan>
          ))}
          {i < lines.length - 1 ? ' +' : ''}
        </Txt>
      ))}
    </g>
  );
}

function Diagram({
  cur,
  pts,
  ptsCat,
  useCat,
  progress,
  stage,
  L,
  f,
}: {
  cur: Current;
  pts: PathPoint[];
  ptsCat: PathPoint[] | null;
  useCat: boolean;
  progress: number;
  stage: Stage;
  L: DiagramLayout;
  f: number;
}) {
  const allH = [...pts, ...(ptsCat ?? [])].map((p) => p.H);
  const hMax = Math.max(...allH);
  const hMin = Math.min(...allH);
  const span = hMax - hMin || 1;
  // Plass under laveste nivå til stoffnavnene, og litt luft over toppen.
  const sy = scaleLinear([hMin, hMax + 0.04 * span], [L.low, L.top]);
  const sx = scaleLinear([0, 1], [L.x0 + 10, L.x1]);
  const curve = (p: PathPoint[]) => {
    let d = '';
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(pathH(p, x)).toFixed(1)}`;
    }
    return d;
  };
  const tone = cur.dH < 0 ? KJEMI.exo : KJEMI.endo;
  const y0 = sy(0);
  const yP = sy(cur.dH);
  const eaTop = sy(pathH(pts, 0.48));
  const catTop = ptsCat ? sy(Math.max(...ptsCat.map((p) => p.H))) : 0;
  const lineH = 22 * f;
  const rx = cur.equation ? reaction(cur.equation) : null;
  const reactants: Term[] | null = rx ? rx.reactants : null;
  const products: Term[] | null = rx ? rx.products : null;
  const dot = { x: sx(progress), y: sy(pathH(useCat && ptsCat ? ptsCat : pts, progress)) };
  const arrowV = (x: number, ya: number, yb: number, color: string, width = 2.5) => {
    const dir = yb < ya ? -1 : 1;
    const len = Math.abs(yb - ya);
    if (len < 4) return null;
    const h = Math.min(11, len * 0.4);
    return (
      <g>
        <line x1={x} y1={ya} x2={x} y2={yb - dir * h} stroke={color} strokeWidth={width} />
        <polygon points={`${x},${yb} ${x - 6},${yb - dir * h} ${x + 6},${yb - dir * h}`} fill={color} />
      </g>
    );
  };
  return (
    <g>
      {/* Akser */}
      <line x1={L.x0} y1={L.bottom + 6} x2={L.x0} y2={L.top - 14} stroke={VIZ.ink} strokeWidth={2} />
      <polygon points={`${L.x0},${L.top - 24} ${L.x0 - 6},${L.top - 12} ${L.x0 + 6},${L.top - 12}`} fill={VIZ.ink} />
      <line x1={L.x0} y1={L.bottom + 6} x2={L.x1} y2={L.bottom + 6} stroke={VIZ.ink} strokeWidth={2} />
      <polygon points={`${L.x1 + 10},${L.bottom + 6} ${L.x1 - 2},${L.bottom} ${L.x1 - 2},${L.bottom + 12}`} fill={VIZ.ink} />
      <text x={18 * f} y={(L.top + L.bottom) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${18 * f} ${(L.top + L.bottom) / 2})`}>
        Entalpi H
      </text>
      <Txt x={L.x1} y={L.bottom + 34 * f} anchor="end" muted size={0.85}>
        Reaksjonsforløp
      </Txt>

      {/* Nivåene: hjelpelinje fra reaktantene */}
      <line x1={sx(0)} y1={y0} x2={sx(0.98)} y2={y0} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      <line x1={sx(0)} y1={y0} x2={sx(0.14)} y2={y0} stroke={VIZ.ink} strokeWidth={3.5} />
      <line x1={sx(0.86)} y1={yP} x2={sx(1)} y2={yP} stroke={VIZ.ink} strokeWidth={3.5} />

      {/* Kurvene */}
      {ptsCat && useCat && <path d={curve(ptsCat)} fill="none" stroke={VIZ.series[0]} strokeWidth={3} strokeDasharray="7 6" />}
      <path d={curve(pts)} fill="none" stroke={tone} strokeWidth={useCat ? 2.2 : 3.5} opacity={useCat ? 0.45 : 1} />

      {/* Eₐ og ΔH */}
      {arrowV(sx(0.48), y0, eaTop, useCat ? VIZ.muted : VIZ.ink)}
      <Txt x={sx(0.48) + 8} y={(y0 + eaTop) / 2 + 6} anchor="start" muted={useCat}>
        E<TSub>a</TSub>
      </Txt>
      {useCat && ptsCat && (
        <g>
          {arrowV(sx(0.34), y0, catTop, VIZ.series[0]!)}
          <Txt x={sx(0.34) - 8} y={y0 + (catTop - y0) * 0.3 + 6} anchor="end" color={VIZ.series[0]}>
            E<TSub>a</TSub>
          </Txt>
        </g>
      )}
      {arrowV(sx(0.95), y0, yP, tone, 3)}
      <Txt x={sx(0.95) + 8} y={(y0 + yP) / 2 + 6} anchor="start" color={tone} weight={700}>
        ΔH
      </Txt>

      {/* Stoffene */}
      {reactants ? (
        <SideLabel terms={reactants} x={sx(0)} y={y0 + 24 * f} anchor="start" maxW={sx(0.45) - sx(0)} f={f} lineH={lineH} />
      ) : (
        <Txt x={sx(0)} y={y0 + 24 * f} anchor="start" size={0.9} weight={650}>
          reaktanter
        </Txt>
      )}
      {products ? (
        <SideLabel terms={products} x={sx(0.92)} y={yP + 24 * f} anchor="end" maxW={sx(0.92) - sx(0.56)} f={f} lineH={lineH} />
      ) : (
        <Txt x={sx(0.92)} y={yP + 24 * f} anchor="end" size={0.9} weight={650}>
          produkter
        </Txt>
      )}

      {/* Punktet som følger forløpet */}
      <circle cx={dot.x} cy={dot.y} r={8} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={2.5} />
      <Txt x={L.x0 + 16} y={L.top - 12 * f} anchor="start" weight={700} size={0.9}>
        {STAGE_TITLE[stage]}
      </Txt>
    </g>
  );
}

/* ---------- Figur 2: system og omgivelser ---------- */

function systemLayout(W: number, f: number) {
  const top = 34 * f;
  const boxH = 70 + 2 * 22 * f;
  return { W, top, boxH, H: Math.round(top + boxH + 40 + 30 * f) };
}

function SystemScene({ cur, S, f }: { cur: Current; S: ReturnType<typeof systemLayout>; f: number }) {
  const exo = cur.dH < 0;
  const tone = exo ? KJEMI.exo : KJEMI.endo;
  const W = S.W;
  const cx = W / 2;
  const bw = Math.min(340, W - 190);
  const bx = cx - bw / 2;
  const by = S.top + 20;
  const rx = cur.equation ? reaction(cur.equation) : null;
  const wave = (x1: number, x2: number, y: number) => {
    // Bølget varmepil fra x1 til x2
    const dir = x2 > x1 ? 1 : -1;
    const len = Math.abs(x2 - x1) - 12;
    let d = `M${x1},${y}`;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const xa = x1 + (dir * (len * (i + 0.5))) / n;
      const xb = x1 + (dir * (len * (i + 1))) / n;
      d += ` Q${xa},${y + (i % 2 ? 7 : -7)} ${xb},${y}`;
    }
    const tip = x1 + dir * (len + 12);
    return (
      <g>
        <path d={d} fill="none" stroke={tone} strokeWidth={3} strokeLinecap="round" />
        <polygon points={`${tip},${y} ${tip - dir * 13},${y - 7} ${tip - dir * 13},${y + 7}`} fill={tone} />
      </g>
    );
  };
  const midY = by + S.boxH / 2;
  const outerL = 20;
  const outerR = W - 20;
  return (
    <g>
      <rect x={6} y={6} width={W - 12} height={S.H - 12} rx={16} fill="none" stroke={VIZ.muted} strokeOpacity={0.5} strokeDasharray="6 6" strokeWidth={1.5} />
      <Txt x={20} y={S.top} anchor="start" muted size={0.85}>
        Omgivelsene: alt rundt systemet
      </Txt>
      <rect x={bx} y={by} width={bw} height={S.boxH} rx={14} fill={tone} fillOpacity={0.1} stroke={tone} strokeWidth={2.5} />
      <Txt x={cx} y={by + 26 * f} weight={700} size={0.9}>
        {W < 600 ? 'Systemet' : 'Systemet: stoffene som reagerer'}
      </Txt>
      {rx ? (
        <>
          <Txt x={cx} y={by + 26 * f + 26 * f} size={0.85}>
            {rx.reactants.map((t, i) => (
              <tspan key={i}>
                {i > 0 ? ' + ' : ''}
                <TFormel f={t.formula} coef={t.coef} />
              </tspan>
            ))}{' '}
            →
          </Txt>
          <Txt x={cx} y={by + 26 * f + 48 * f} size={0.85}>
            {rx.products.map((t, i) => (
              <tspan key={i}>
                {i > 0 ? ' + ' : ''}
                <TFormel f={t.formula} coef={t.coef} />
              </tspan>
            ))}
          </Txt>
        </>
      ) : (
        <Txt x={cx} y={by + 26 * f + 36 * f} size={0.85}>
          reaktanter → produkter
        </Txt>
      )}
      {exo ? (
        <>
          {wave(bx - 6, outerL + 14, midY)}
          {wave(bx + bw + 6, outerR - 14, midY)}
        </>
      ) : (
        <>
          {wave(outerL + 14, bx - 6, midY)}
          {wave(outerR - 14, bx + bw + 6, midY)}
        </>
      )}
      <Txt x={(outerL + bx) / 2} y={midY - 16} size={0.85} color={tone} weight={700}>
        varme
      </Txt>
      <Txt x={(outerR + bx + bw) / 2} y={midY - 16} size={0.85} color={tone} weight={700}>
        varme
      </Txt>
      <Txt x={cx} y={by + S.boxH + 30 * f} size={0.9} weight={650} color={tone}>
        {exo ? 'Omgivelsene blir varmere: ΔH < 0' : 'Omgivelsene blir kaldere: ΔH > 0'}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(cur: Current, useCat: boolean, eaCat: number, stage: Stage, preset: EnthalpyPreset | undefined): ReactNode {
  const exo = cur.dH < 0;
  const dH = `${signed(cur.dH, dec(cur.dH))} kJ`;
  const catName = cur.catalyst?.name;
  const stageText: Record<Stage, ReactNode> = {
    reaktanter: 'Punktet står ved reaktantene. Partiklene må kollidere med nok energi for å komme over toppen.',
    brytes: 'På vei opp bakken strekkes og svekkes bindingene i reaktantene. Det krever energi, så entalpien øker.',
    topp: (
      <>
        Punktet er på toppen: overgangstilstanden (det aktiverte komplekset), der gamle bindinger er delvis brutt og nye delvis dannet. Bare kollisjoner med
        minst E<Sub>a</Sub> kommer hit.
      </>
    ),
    mellomprodukt: 'Punktet er i dalen mellom de to toppene: et mellomprodukt som dannes på katalysatoren og reagerer videre.',
    dannes: 'På vei ned bakken dannes nye bindinger, og det frigjøres energi.',
    produkter: 'Punktet står ved produktene. Forskjellen fra startnivået er ΔH.',
  };
  return (
    <>
      <p>
        <strong>
          {exo ? 'Eksoterm' : 'Endoterm'} {preset?.id === 'ammoniumnitrat' ? 'prosess' : 'reaksjon'}: ΔH = {dH}.
        </strong>{' '}
        {exo ? (
          <>
            Produktene har lavere entalpi enn reaktantene, og forskjellen avgis som varme til omgivelsene. Systemet (stoffene som reagerer) taper energi, så ΔH
            er negativ, selv om det er omgivelsene som blir varmere.
          </>
        ) : (
          <>Produktene har høyere entalpi enn reaktantene. Systemet tar opp varme fra omgivelsene, som blir kaldere, og ΔH er positiv.</>
        )}
      </p>
      <p>
        {exo ? 'Også en eksoterm reaksjon trenger aktiveringsenergi for å komme i gang.' : 'Reaktantene må over toppen før reaksjonen kan skje.'}{' '}
        {useCat && catName ? (
          <>
            Med {catName} som katalysator går reaksjonen en annen vei med lavere topp
            {cur.eaKnown ? (
              <>
                {' '}
                (E<Sub>a</Sub> fra {fmt(cur.ea, 0)} til {fmt(eaCat, 0)} kJ/mol)
              </>
            ) : null}
            , så flere kollisjoner har nok energi og reaksjonen går raskere. Start- og sluttnivået er de samme, så ΔH er uendret: katalysatoren gir ikke mer
            varme, den gjør bare at reaksjonen går fortere.
          </>
        ) : catName ? (
          <>Slå på katalysatoren og se at bare toppen flyttes, mens ΔH er den samme.</>
        ) : preset?.id === 'ammoniumnitrat' ? (
          <>
            Når saltet løses, brytes ionebindingene i krystallet (krever energi), og ionene omgis av vannmolekyler (frigjør energi). Her krever bruddet mer enn
            hydratiseringen gir tilbake.
          </>
        ) : (
          <>Det trengs høy temperatur for at mange nok partikler skal ha energi til å komme over toppen.</>
        )}
      </p>
      <p>{stageText[stage]}</p>
      {cur.note && <p>{cur.note}</p>}
      {!preset && (
        <p>
          Prøv å gjøre E<Sub>a</Sub> mindre enn ΔH for en endoterm reaksjon: toppen kan aldri ligge under produktene, så E<Sub>a</Sub> følger med opp.
        </p>
      )}
    </>
  );
}
