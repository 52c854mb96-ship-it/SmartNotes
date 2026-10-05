import { useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Readout,
  Readouts,
  Slider,
  Sub,
  Sup,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  useContainerTextScale,
  useLineScale,
} from '../kit';
import {
  DIVERSITY_PRESETS,
  FOREST_SPECIES,
  INDIVIDUALS,
  MAX_SPECIES,
  counts,
  pielou,
  plotIndividuals,
  shannon,
  simpson,
  simpsonMax,
  type Community,
} from './model';

const COL_A = BIO.serie[0];
const COL_B = BIO.serie[1];

/** Seks farger og seks former gir tolv arter som kan skilles fra hverandre (også uten fargesyn). */
const COLORS = [BIO.serie[0], BIO.serie[1], BIO.serie[2], BIO.serie[3], BIO.signal, BIO.kalium];
const SHAPES = ['sirkel', 'trekant', 'kvadrat', 'rombe', 'stjerne', 'sekskant'] as const;
const speciesColor = (i: number) => COLORS[(i + (i >= 6 ? 3 : 0)) % 6]!;

export default function Artsmangfold() {
  const [a, setA] = useState<Community>({ S: 8, evenness: 0.9 });
  const [b, setB] = useState<Community>({ S: 8, evenness: 0.1 });
  const [showShannon, setShowShannon] = useState(false);
  const cA = useMemo(() => counts(a.S, a.evenness), [a]);
  const cB = useMemo(() => counts(b.S, b.evenness), [b]);
  const dA = simpson(cA);
  const dB = simpson(cB);
  const preset =
    DIVERSITY_PRESETS.find(
      (p) => p.a.S === a.S && p.b.S === b.S && Math.abs(p.a.evenness - a.evenness) < 1e-9 && Math.abs(p.b.evenness - b.evenness) < 1e-9,
    )?.id ?? null;
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  return (
    <VizLayout>
      <Controls>
        <Slider label="Arter i flate A" value={a.S} onChange={(S) => setA((p) => ({ ...p, S }))} min={1} max={MAX_SPECIES} step={1} />
        <Slider
          label="Jevnhet i flate A"
          value={Math.round(a.evenness * 100)}
          onChange={(v) => setA((p) => ({ ...p, evenness: v / 100 }))}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
        <Slider label="Arter i flate B" value={b.S} onChange={(S) => setB((p) => ({ ...p, S }))} min={1} max={MAX_SPECIES} step={1} />
        <Slider
          label="Jevnhet i flate B"
          value={Math.round(b.evenness * 100)}
          onChange={(v) => setB((p) => ({ ...p, evenness: v / 100 }))}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Eksempler"
          options={DIVERSITY_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          value={preset}
          onPick={(id) => {
            const p = DIVERSITY_PRESETS.find((x) => x.id === id)!;
            setA(p.a);
            setB(p.b);
          }}
        />
        <Toggle label="Vis Shannons indeks" checked={showShannon} onChange={setShowShannon} />
      </Toolbar>

      <div ref={ref}>
        <PlotsFigure cA={cA} cB={cB} f={f} />
      </div>

      <Readouts>
        <Readout label="Simpson D, flate A" value={fmt(dA, 2)} tone={COL_A} />
        <Readout label="Simpson D, flate B" value={fmt(dB, 2)} tone={COL_B} />
        {showShannon ? (
          <>
            <Readout label="Shannon H, flate A" value={fmt(shannon(cA), 2)} tone={COL_A} />
            <Readout label="Shannon H, flate B" value={fmt(shannon(cB), 2)} tone={COL_B} />
          </>
        ) : (
          <Readout
            label="Størst mangfold"
            value={Math.abs(dA - dB) < 0.005 ? 'Like stort' : dA > dB ? 'Flate A' : 'Flate B'}
            tone={Math.abs(dA - dB) < 0.005 ? undefined : dA > dB ? COL_A : COL_B}
          />
        )}
      </Readouts>

      <Formula label="Simpsons diversitetsindeks">
        <FormulaLine>
          D = 1 − Σ p<Sub>i</Sub>
          <Sup>2</Sup>, der p<Sub>i</Sub> = n<Sub>i</Sub> / N er andelen individer av art i
        </FormulaLine>
        <SimpsonLine name="A" c={cA} />
        <SimpsonLine name="B" c={cB} />
        {showShannon && (
          <FormulaLine>
            H = −Σ p<Sub>i</Sub> · ln p<Sub>i</Sub>: A = {fmt(shannon(cA), 2)}, B = {fmt(shannon(cB), 2)} · jevnhet H / ln S: A ={' '}
            {fmt(pielou(cA), 2)}, B = {fmt(pielou(cB), 2)}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(a, b, cA, cB, showShannon)}</Explain>
    </VizLayout>
  );
}

function SimpsonLine({ name, c }: { name: string; c: number[] }) {
  const N = c.reduce((x, y) => x + y, 0);
  const shown = c.slice(0, 3);
  const terms = shown.map((n, i) => (
    <span key={i}>
      {i > 0 ? ' + ' : ''}({n}/{N})<Sup>2</Sup>
    </span>
  ));
  return (
    <FormulaLine>
      Flate {name}: D = 1 − [{terms}
      {c.length > 3 ? ' + …' : ''}] = 1 − {fmt(1 - simpson(c), 3)} = {fmt(simpson(c), 2)}
    </FormulaLine>
  );
}

/* ---------- Artstegn ---------- */

function SpeciesMark({ i, x, y, r }: { i: number; x: number; y: number; r: number }) {
  const lw = useLineScale();
  const color = speciesColor(i);
  const shape = SHAPES[i % 6]!;
  const common = { fill: color, fillOpacity: 0.85, stroke: VIZ.surface, strokeWidth: 1.2 * lw, strokeLinejoin: 'round' as const };
  const poly = (n: number, rot: number, inner?: number) => {
    const pts: string[] = [];
    const m = inner ? n * 2 : n;
    for (let k = 0; k < m; k++) {
      const a = rot + (k / m) * Math.PI * 2;
      const rr = inner && k % 2 ? r * inner : r;
      pts.push(`${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`);
    }
    return <polygon points={pts.join(' ')} {...common} />;
  };
  return (
    <g>
      {shape === 'sirkel' && <circle cx={x} cy={y} r={r * 0.9} {...common} />}
      {shape === 'trekant' && poly(3, -Math.PI / 2)}
      {shape === 'kvadrat' && <rect x={x - r * 0.78} y={y - r * 0.78} width={r * 1.56} height={r * 1.56} rx={r * 0.15} {...common} />}
      {shape === 'rombe' && poly(4, -Math.PI / 2)}
      {shape === 'stjerne' && poly(5, -Math.PI / 2, 0.48)}
      {shape === 'sekskant' && poly(6, 0)}
      {i >= 6 && <circle cx={x} cy={y} r={r * 0.28} fill={VIZ.surface} />}
    </g>
  );
}

/* ---------- Figuren: to prøveflater med individer og søylediagram ---------- */

function PlotsFigure({ cA, cB, f }: { cA: number[]; cB: number[]; f: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const W = narrow ? 760 : 370;
  const titleH = 30 * f;
  const plotH = narrow ? 380 : 230;
  const gaugeH = 26 * f + 14;
  const barsH = narrow ? 170 : 110;
  const panelH = titleH + plotH + 12 + gaugeH + barsH + 22 * f;
  const panels = [
    { name: 'A', c: cA, x: 20, y: 0, col: COL_A, seed: 11 },
    { name: 'B', c: cB, x: narrow ? 20 : 410, y: narrow ? panelH + 20 : 0, col: COL_B, seed: 29 },
  ];
  const shown = Math.max(cA.length, cB.length);
  // Artsnøkkel nederst: navn og tegn for artene som finnes i minst én flate
  const keyCols = narrow ? 2 : 4;
  const keyRowH = 28 * f;
  const keyTop = (narrow ? 2 * panelH + 20 : panelH) + 18;
  const keyRows = Math.ceil(shown / keyCols);
  const H = Math.round(keyTop + 22 * f + keyRows * keyRowH + 8);
  const r = 9.5 * k;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 2000 : H}
      label={`To prøveflater med ${INDIVIDUALS} planter hver. Flate A: ${cA.length} arter, Simpson ${fmt(simpson(cA), 2)}. Flate B: ${cB.length} arter, Simpson ${fmt(simpson(cB), 2)}.`}
      caption={`Hvert tegn er én plante (${INDIVIDUALS} i hver flate). Søylene viser hvor mange planter det er av hver art.`}
    >
      {panels.map((p) => {
        const S = p.c.length;
        const D = simpson(p.c);
        const Dmax = simpsonMax(S);
        const plotTop = p.y + titleH;
        const ind = plotIndividuals(p.c, p.seed);
        const pad = r + 4;
        const gTop = plotTop + plotH + 12;
        const gx0 = p.x + 8;
        const gx1 = p.x + W - 8;
        const gy = gTop + 18 * f;
        const gScale = (v: number) => gx0 + (gx1 - gx0) * v;
        const bTop = gTop + gaugeH;
        const maxN = Math.max(...p.c, 1);
        const bw = (W - 16) / MAX_SPECIES;
        return (
          <g key={p.name}>
            <Txt x={p.x + 4} y={p.y + 22 * f} anchor="start" weight={700} color={p.col}>
              Flate {p.name}
            </Txt>
            <Txt x={p.x + W - 4} y={p.y + 22 * f} anchor="end" size={0.85} muted>
              {S} {S === 1 ? 'art' : 'arter'}, {INDIVIDUALS} planter
            </Txt>
            <rect x={p.x} y={plotTop} width={W} height={plotH} rx={12} fill={BIO.plante.fill} fillOpacity={0.45} stroke={p.col} strokeWidth={1.5} />
            {ind.map((d, i) => (
              <SpeciesMark key={i} i={d.species} x={p.x + pad + d.x * (W - 2 * pad)} y={plotTop + pad + d.y * (plotH - 2 * pad)} r={r} />
            ))}
            {/* Måler: D mellom 0 og 1, med største mulige verdi for dette artsantallet */}
            <line x1={gx0} x2={gx1} y1={gy} y2={gy} stroke={VIZ.grid} strokeWidth={10} strokeLinecap="round" />
            {D > 0 && <line x1={gx0} x2={gScale(D)} y1={gy} y2={gy} stroke={p.col} strokeWidth={10} strokeLinecap="round" />}
            {S > 1 && <line x1={gScale(Dmax)} x2={gScale(Dmax)} y1={gy - 10} y2={gy + 10} stroke={VIZ.ink} strokeWidth={2} />}
            <Txt x={gx0} y={gy - 10} anchor="start" size={0.8} weight={650} color={p.col}>
              D = {fmt(D, 2)}
            </Txt>
            {S > 1 && (
              <Txt x={Math.min(gx1, gScale(Dmax) + 6)} y={gy - 10} anchor={gScale(Dmax) > gx1 - 150 * f ? 'end' : 'start'} size={0.72} muted>
                maks {fmt(Dmax, 2)}
              </Txt>
            )}
            {/* Søyler: antall av hver art, vanligste først */}
            {p.c.map((n, i) => {
              const h = Math.max(3, ((barsH - 22 * f) * n) / maxN);
              const x = p.x + 8 + i * bw;
              const yb = bTop + barsH;
              return (
                <g key={i}>
                  <rect x={x + bw * 0.14} y={yb - h} width={bw * 0.72} height={h} rx={3} fill={speciesColor(i)} fillOpacity={0.75} />
                  <Txt x={x + bw / 2} y={yb - h - 5} size={0.66} muted>
                    {n}
                  </Txt>
                </g>
              );
            })}
            <line x1={p.x + 6} x2={p.x + W - 6} y1={bTop + barsH} y2={bTop + barsH} stroke={VIZ.muted} strokeWidth={1.5} />
            <Txt x={p.x + 8} y={bTop + barsH + 20 * f} anchor="start" size={0.72} muted>
              antall per art, vanligste først
            </Txt>
          </g>
        );
      })}
      {/* Artsnøkkel */}
      <Txt x={20} y={keyTop + 14 * f} anchor="start" size={0.8} muted>
        Arter
      </Txt>
      {FOREST_SPECIES.slice(0, shown).map((s, i) => {
        const col = i % keyCols;
        const row = Math.floor(i / keyCols);
        const x = 20 + col * (760 / keyCols);
        const y = keyTop + 22 * f + row * keyRowH + keyRowH / 2;
        return (
          <g key={s.name}>
            <SpeciesMark i={i} x={x + r} y={y} r={r} />
            <Txt x={x + 2 * r + 8} y={y + 6 * f} anchor="start" size={0.8}>
              {s.name}
            </Txt>
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

function explanation(a: Community, b: Community, cA: number[], cB: number[], showShannon: boolean): ReactNode {
  const dA = simpson(cA);
  const dB = simpson(cB);
  const jA = pielou(cA);
  const jB = pielou(cB);
  let main: ReactNode;
  if (a.S === 1 && b.S === 1)
    main = (
      <p>
        <strong>Begge flatene har bare én art</strong>, så det er ikke noe artsmangfold å måle: D = 0. Øk antall arter for å se hvordan
        indeksen vokser.
      </p>
    );
  else if (Math.abs(dA - dB) < 0.005)
    main = (
      <p>
        <strong>Flatene har omtrent like stort mangfold</strong> (D = {fmt(dA, 2)}).{' '}
        {a.S !== b.S
          ? 'Den ene har flere arter, men den andre har jevnere fordeling, og det veier opp.'
          : 'De har like mange arter og like jevn fordeling.'}
      </p>
    );
  else {
    const hi = dA > dB ? { n: 'A', S: a.S, j: jA, D: dA } : { n: 'B', S: b.S, j: jB, D: dB };
    const lo = dA > dB ? { n: 'B', S: b.S, j: jB, D: dB } : { n: 'A', S: a.S, j: jA, D: dA };
    let why: string;
    if (hi.S === lo.S) why = `Begge har ${hi.S} arter, men i flate ${hi.n} er individene jevnere fordelt på artene.`;
    else if (hi.S < lo.S)
      why = `Flate ${hi.n} har færre arter (${hi.S} mot ${lo.S}), men individene er jevnere fordelt. I flate ${lo.n} dominerer noen få arter, og de fleste andre er sjeldne.`;
    else if (hi.j >= lo.j) why = `Flate ${hi.n} har både flere arter (${hi.S} mot ${lo.S}) og jevnere fordeling.`;
    else why = `Flate ${hi.n} har flere arter (${hi.S} mot ${lo.S}), og det veier opp for at fordelingen er litt mindre jevn.`;
    main = (
      <p>
        <strong>
          Flate {hi.n} har størst mangfold (D = {fmt(hi.D, 2)} mot {fmt(lo.D, 2)}).
        </strong>{' '}
        {why}
      </p>
    );
  }
  const meaning =
    dA === 0 && dB === 0 ? (
      <p>Med bare én art er D = 0: to planter du plukker, er alltid av samme art.</p>
    ) : (
      <p>
        Simpsons indeks er sannsynligheten for at to tilfeldig valgte planter er av ulik art: D = {fmt(Math.max(dA, dB), 2)} betyr at det
        skjer i {fmtPct(Math.max(dA, dB))} av tilfellene. Artsmangfold handler altså både om <strong>hvor mange arter</strong> det er
        (artsrikdom) og om <strong>hvor jevnt</strong> individene er fordelt. Med S arter kan D aldri bli større enn 1 − 1/S.
      </p>
    );
  return (
    <>
      {main}
      {meaning}
      {showShannon && (
        <p>
          Shannons indeks H = −Σ p · ln p måler det samme, men legger mer vekt på sjeldne arter. Den har ingen fast øvre grense (den
          største verdien, ln S, vokser med antall arter), så den brukes gjerne sammen med jevnheten H / ln S (1 betyr helt jevn
          fordeling): her {fmt(jA, 2)} i A og {fmt(jB, 2)} i B.
        </p>
      )}
      <p>
        Biologisk mangfold er mer enn artsmangfold: <strong>genetisk mangfold</strong> er variasjonen innenfor en art (som ulike
        laksestammer i hver elv), og <strong>økosystemmangfold</strong> er variasjonen av naturtyper i et område, som skog, myr, fjell og
        kyst. Mange ulike nisjer gir plass til mange arter.
      </p>
    </>
  );
}
