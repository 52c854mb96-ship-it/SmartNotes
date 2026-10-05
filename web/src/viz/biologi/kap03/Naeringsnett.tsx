import { useMemo, useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Fugl,
  Insekt,
  Legend,
  Pattedyr,
  Plante,
  Readout,
  Readouts,
  Select,
  Slider,
  Sopp,
  Toolbar,
  Tre,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  useContainerTextScale,
  useLineScale,
  type BioPaint,
} from '../kit';
import {
  LEVEL_NAMES,
  PRIMARY_ENERGY,
  REMOVAL_PRESETS,
  WEB,
  cascade,
  energyPyramid,
  isProducer,
  preyOf,
  summarizeEffects,
  trophicLevels,
  webRow,
  webSpecies,
  type Effect,
  type EffectKind,
  type EffectSummary,
  type WebId,
  type WebSpecies,
} from './model';

const KIND_COLOR: Record<EffectKind, string> = {
  fjernet: VIZ.muted,
  'dor-ut': VIZ.ink,
  oker: VIZ.series[2]!,
  minker: BIO.sir.I,
  usikker: BIO.sukker,
};
const KIND_SIGN: Record<EffectKind, string> = { fjernet: '×', 'dor-ut': '×', oker: '↑', minker: '↓', usikker: '?' };
const KIND_WORD: Record<Exclude<EffectKind, 'fjernet' | 'usikker'>, string> = { 'dor-ut': 'dør ut', oker: 'øker', minker: 'minker' };

/** Energinivåene i pyramiden (samme farger som trofiske nivåer i nettet). */
const LEVEL_COLOR = [BIO.plante.line, BIO.serie[0], BIO.serie[1], BIO.serie[3]];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const join = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} og ${items.at(-1)}`);
const names = (ids: WebId[]) => join(ids.map((id) => webSpecies(id).short));

const OPTIONS = [
  { value: 'ingen', label: 'Ingen (hele nettet)' },
  ...WEB.map((s) => ({ value: s.id, label: cap(s.short) })),
] as { value: WebId | 'ingen'; label: string }[];

export default function Naeringsnett() {
  const [removed, setRemoved] = useState<WebId | null>('ulv');
  const [eff, setEff] = useState(0.1);
  const effects = useMemo(() => cascade(removed), [removed]);
  const sum = useMemo(() => summarizeEffects(effects), [effects]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [ref2, f2] = useContainerTextScale<HTMLDivElement>();
  const nDirect = Object.values(sum.direct).flat().length;
  const nIndirect = Object.values(sum.indirect).flat().length;
  const nGone = sum.direct['dor-ut'].length + sum.indirect['dor-ut'].length;
  const toggle = (id: WebId) => setRemoved((r) => (r === id ? null : id));
  const E = energyPyramid(eff);

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Fjern"
          options={REMOVAL_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          value={REMOVAL_PRESETS.some((p) => p.id === removed) ? removed : null}
          onPick={setRemoved}
        />
      </Toolbar>
      <Toolbar>
        <Select label="Art som fjernes" value={removed ?? 'ingen'} options={OPTIONS} onChange={(v) => setRemoved(v === 'ingen' ? null : v)} />
      </Toolbar>

      <div ref={ref}>
        <WebFigure effects={effects} removed={removed} onToggle={toggle} f={f} />
      </div>
      <Legend
        items={[
          { color: KIND_COLOR.oker, label: '↑ øker' },
          { color: KIND_COLOR.minker, label: '↓ minker' },
          { color: KIND_COLOR.usikker, label: '? usikkert (både mer og mindre)' },
          { color: KIND_COLOR['dor-ut'], label: '× dør ut' },
          { color: VIZ.ink, label: 'Stiplet ring: indirekte virkning', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Fjernet" value={removed ? cap(webSpecies(removed).short) : 'Ingen'} />
        <Readout label="Direkte påvirket" value={String(nDirect)} unit={nDirect === 1 ? 'art' : 'arter'} />
        <Readout label="Indirekte påvirket" value={String(nIndirect)} unit={nIndirect === 1 ? 'art' : 'arter'} />
        <Readout label="Dør ut" value={String(nGone)} unit={nGone === 1 ? 'art' : 'arter'} tone={nGone ? KIND_COLOR['dor-ut'] : undefined} />
      </Readouts>

      <Explain>{webText(removed, sum)}</Explain>

      <Controls>
        <Slider
          label="Energi som går videre til neste nivå"
          value={Math.round(eff * 100)}
          onChange={(v) => setEff(v / 100)}
          min={5}
          max={20}
          step={1}
          unit="%"
        />
      </Controls>
      <div ref={ref2}>
        <Pyramid E={E} eff={eff} f={f2} />
      </div>
      <Formula label="Energi på hvert nivå">
        <FormulaLine>
          Produsentene: ca. {fmt(PRIMARY_ENERGY, 0)} kJ per m² per år (netto primærproduksjon i barskog)
        </FormulaLine>
        <FormulaLine>
          Hvert nivå: E<sub>n+1</sub> = {fmt(eff, 2)} · E<sub>n</sub>, så nivå 4 får {fmt(eff, 2)}
          <sup>3</sup> = {fmt(eff ** 3, 4)} = {fmtPct(eff ** 3, eff ** 3 < 0.001 ? 2 : 1)} av energien til produsentene
        </FormulaLine>
      </Formula>
      <Explain>{energyText(E, eff)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Næringsnettet                                                            */
/* ====================================================================== */

/** Vannrett plass (0–800) for hver art, ordnet så linjene krysser minst mulig. */
const X: Record<WebId, number> = {
  gras: 230,
  blabaer: 390,
  lauvtraer: 550,
  bartraer: 710,
  smagnagere: 175,
  hare: 270,
  radyr: 365,
  elg: 460,
  insekter: 555,
  ekorn: 650,
  storfugl: 745,
  mar: 185,
  rev: 300,
  kongeorn: 410,
  gaupe: 510,
  ulv: 615,
  meis: 725,
  spurvehauk: 725,
  nedbrytere: 470,
};

/** Smal skjerm: samme rekkefølge, men hele bredden og vekselvis høyt og lavt i hver rad (så navnene får plass). */
const X_NARROW: Record<WebId, number> = {
  gras: 110,
  blabaer: 300,
  lauvtraer: 500,
  bartraer: 690,
  smagnagere: 92,
  hare: 192,
  radyr: 296,
  elg: 400,
  insekter: 506,
  ekorn: 612,
  storfugl: 716,
  mar: 90,
  rev: 210,
  kongeorn: 340,
  gaupe: 470,
  ulv: 600,
  meis: 716,
  spurvehauk: 600,
  nedbrytere: 400,
};

interface Node {
  s: WebSpecies;
  x: number;
  y: number;
  row: number;
}

function layout(f: number): {
  nodes: Map<WebId, Node>;
  rowY: (row: number) => number;
  H: number;
  r: number;
  decompY: number;
  narrow: boolean;
  band: number;
} {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const r = 21 * k;
  const tl = trophicLevels();
  const band = narrow ? 150 + 80 * f : 112;
  const top = narrow ? band / 2 : 20 + r + 4;
  // Rad 4 øverst, rad 1 nederst, nedbrytere under
  const rowY = (row: number) => top + (4 - row) * band;
  const decompY = rowY(1) + (narrow ? 90 + 60 * f : 92);
  const nodes = new Map<WebId, Node>();
  const byRow = new Map<number, WebSpecies[]>();
  for (const s of WEB) {
    if (s.id === 'nedbrytere') continue;
    const row = webRow(s.id, tl);
    byRow.set(row, [...(byRow.get(row) ?? []), s]);
  }
  for (const [row, list] of byRow) {
    const sorted = [...list].sort((a, b) => (narrow ? X_NARROW : X)[a.id] - (narrow ? X_NARROW : X)[b.id]);
    sorted.forEach((s, i) => {
      // Altetende arter (f.eks. meis 2,75) står litt mellom nivåene
      const between = ((tl.get(s.id) ?? row) - row) * band * (narrow ? 0.2 : 0.55);
      const stagger = narrow && row !== 1 && list.length > 3 ? (i % 2 ? 0.2 : -0.2) * band : 0;
      nodes.set(s.id, { s, x: (narrow ? X_NARROW : X)[s.id], y: rowY(row) - between + stagger, row });
    });
  }
  const d = webSpecies('nedbrytere');
  nodes.set('nedbrytere', { s: d, x: (narrow ? X_NARROW : X).nedbrytere, y: decompY, row: 0 });
  const H = Math.round(decompY + r + 30 * f + 10);
  return { nodes, rowY, H, r, decompY, narrow, band };
}

function Glyph({ s, x, y, size }: { s: WebSpecies; x: number; y: number; size: number }) {
  const g = { x, y, size, title: s.name };
  const fox: BioPaint = BIO.mitokondrie;
  const wolf: BioPaint = BIO.menneske;
  switch (s.glyph) {
    case 'plante':
      return <Plante {...g} />;
    case 'blabaer':
      return (
        <g>
          <Plante {...g} />
          {[
            [-0.28, -0.05],
            [0.22, 0.02],
            [-0.05, 0.16],
          ].map(([dx, dy], i) => (
            <circle key={i} cx={x + dx! * size} cy={y + dy! * size} r={size * 0.09} fill={BIO.dna} stroke={VIZ.surface} strokeWidth={1} />
          ))}
        </g>
      );
    case 'tre':
      return <Tre {...g} />;
    case 'bartre':
      return <Tre {...g} bartre />;
    case 'pattedyr':
      return <Pattedyr {...g} paint={s.id === 'rev' ? fox : s.id === 'ulv' ? wolf : undefined} />;
    case 'smapattedyr':
      return <Pattedyr {...g} size={size * 0.78} paint={s.id === 'ekorn' ? fox : undefined} />;
    case 'insekt':
      return <Insekt {...g} size={size * 0.8} />;
    case 'fugl':
      return <Fugl {...g} />;
    case 'rovfugl':
      return <Fugl {...g} paint={BIO.pattedyr} />;
    case 'sopp':
      return <Sopp {...g} />;
  }
}

function WebFigure({
  effects,
  removed,
  onToggle,
  f,
}: {
  effects: Map<WebId, Effect>;
  removed: WebId | null;
  onToggle: (id: WebId) => void;
  f: number;
}) {
  const lw = useLineScale();
  const { nodes, rowY, H, r, decompY, narrow, band } = layout(f);
  const gone = (id: WebId) => {
    const e = effects.get(id);
    return e?.kind === 'fjernet' || e?.kind === 'dor-ut';
  };
  const edges: ReactNode[] = [];
  for (const s of WEB) {
    for (const p of preyOf(s.id)) {
      const a = nodes.get(p)!;
      const b = nodes.get(s.id)!;
      const share = s.diet[p] ?? 0;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const x1 = a.x + ux * (r + 2);
      const y1 = a.y + uy * (r + 2);
      const x2 = b.x - ux * (r + 3);
      const y2 = b.y - uy * (r + 3);
      const broken = gone(p) || gone(s.id);
      const w = (1 + 3.4 * share) * lw;
      const head = 7 + w;
      const hx = x2 - ux * head;
      const hy = y2 - uy * head;
      edges.push(
        <g key={`${p}-${s.id}`} opacity={broken ? 0.55 : 0.6}>
          <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={broken ? BIO.sir.I : VIZ.muted} strokeWidth={w} strokeDasharray={broken ? '5 5' : undefined} />
          <polygon
            points={`${x2},${y2} ${hx - uy * head * 0.45},${hy + ux * head * 0.45} ${hx + uy * head * 0.45},${hy - ux * head * 0.45}`}
            fill={broken ? BIO.sir.I : VIZ.muted}
          />
        </g>,
      );
    }
  }
  // Næringsstoffer fra nedbryterne tilbake til produsentene
  const d = nodes.get('nedbrytere')!;
  const nutrient = WEB.filter(isProducer).map((p) => {
    const n = nodes.get(p.id)!;
    const broken = gone('nedbrytere');
    return (
      <path
        key={p.id}
        d={`M${d.x + (n.x - d.x) * 0.25},${d.y - r} Q${n.x},${(d.y + n.y) / 2 + 10} ${n.x},${n.y + r + 18 * f + 6}`}
        fill="none"
        stroke={broken ? BIO.sir.I : BIO.ved}
        strokeWidth={1.6 * lw}
        strokeDasharray="3 5"
        opacity={0.8}
      />
    );
  });
  const levelLabel = (row: number) => {
    const name = LEVEL_NAMES[row - 1]!.toLowerCase();
    return narrow ? (
      <Txt key={row} x={10} y={rowY(row) - band / 2 + 20 * f} anchor="start" size={0.8} weight={650} muted>
        Trofisk nivå {row}: {name}
      </Txt>
    ) : (
      <g key={row}>
        <Txt x={10} y={rowY(row) - 4} anchor="start" size={0.74} weight={650} muted>
          Trofisk nivå {row}
        </Txt>
        <Txt x={10} y={rowY(row) + 15} anchor="start" size={0.7} muted>
          {name}
        </Txt>
      </g>
    );
  };
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1500 : H}
      label={`Næringsnett i norsk barskog med ${WEB.length} arter og grupper.${removed ? ` ${cap(webSpecies(removed).name)} er fjernet.` : ''}`}
      caption="Pilene går fra det som blir spist til den som spiser, samme vei som energien. Tykke piler er en stor del av maten. Trykk på en art for å fjerne den."
    >
      {[1, 2, 3, 4].map((row) => (
        <line key={row} x1={narrow ? 6 : 150} x2={794} y1={rowY(row)} y2={rowY(row)} stroke={VIZ.grid} strokeWidth={1.4} strokeDasharray="6 6" />
      ))}
      {[1, 2, 3, 4].map(levelLabel)}
      <rect x={6} y={decompY - r - 10} width={788} height={2 * r + 20 + 26 * f} rx={12} fill={BIO.ved} opacity={0.12} />
      {edges}
      {nutrient}
      {[...nodes.values()].map((n) => (
        <NodeMark key={n.s.id} n={n} r={r} f={f} e={effects.get(n.s.id)} onToggle={onToggle} decomp={n.s.id === 'nedbrytere'} narrow={narrow} />
      ))}
    </Figure>
  );
}

function NodeMark({
  n,
  r,
  f,
  e,
  onToggle,
  decomp,
  narrow,
}: {
  n: Node;
  r: number;
  f: number;
  e: Effect | undefined;
  onToggle: (id: WebId) => void;
  decomp: boolean;
  narrow: boolean;
}) {
  const lw = useLineScale();
  const kind = e?.kind;
  const color = kind ? KIND_COLOR[kind] : VIZ.muted;
  const out = kind === 'fjernet' || kind === 'dor-ut';
  const badge = r * 0.42;
  const bx = n.x + r * 0.78;
  const by = n.y - r * 0.78;
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onToggle(n.s.id)}>
      <circle cx={n.x} cy={n.y} r={r} fill={VIZ.surface} stroke={color} strokeWidth={(kind ? 3 : 1.5) * lw} strokeDasharray={e && e.round >= 2 ? '5 4' : undefined} />
      <g opacity={out ? 0.3 : 1}>
        <Glyph s={n.s} x={n.x} y={n.y} size={r * 1.65} />
      </g>
      {out && (
        <g stroke={color} strokeWidth={2.6 * lw} strokeLinecap="round">
          <line x1={n.x - r * 0.55} y1={n.y - r * 0.55} x2={n.x + r * 0.55} y2={n.y + r * 0.55} />
          <line x1={n.x - r * 0.55} y1={n.y + r * 0.55} x2={n.x + r * 0.55} y2={n.y - r * 0.55} />
        </g>
      )}
      {kind && kind !== 'fjernet' && kind !== 'dor-ut' && (
        <g>
          <circle cx={bx} cy={by} r={badge} fill={color} stroke={VIZ.surface} strokeWidth={1.5} />
          <Txt x={bx} y={by + badge * 0.45} size={0.7} weight={800} color={VIZ.surface} halo={false}>
            {KIND_SIGN[kind]}
          </Txt>
        </g>
      )}
      <Txt x={n.x} y={n.y + r + 17 * f} size={narrow ? 0.86 : decomp ? 0.8 : 0.76} weight={kind ? 700 : 560} color={kind ? color : undefined}>
        {decomp && !narrow ? n.s.name : n.s.short}
      </Txt>
    </g>
  );
}

/* ====================================================================== */
/* Energipyramiden                                                          */
/* ====================================================================== */

function Pyramid({ E, eff, f }: { E: number[]; eff: number; f: number }) {
  const barH = 26 + 8 * f;
  const lineH = 24 * f;
  const step = lineH + barH + 10;
  const W = 760;
  const H = Math.round(4 * step + 10);
  const cx = 400;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Energipyramide med ${fmtPct(eff)} videre per nivå: ${E.map((e, i) => `${LEVEL_NAMES[i]} ${fmt(e, 0)} kJ`).join(', ')}.`}
      caption="Energi i kJ per m² per år. Bredden på søylene er i riktig forhold til energien, så toppnivåene blir nesten borte."
    >
      {E.map((e, i) => {
        // Nederst: produsentene. Øverst: tertiærkonsumentene.
        const top = (3 - i) * step + 6;
        const w = (W * e) / E[0]!;
        const thin = w < 6;
        return (
          <g key={i}>
            <Txt x={20} y={top + lineH - 6} anchor="start" size={0.82} weight={650} color={LEVEL_COLOR[i]}>
              {i + 1}. {LEVEL_NAMES[i]}
            </Txt>
            <Txt x={780} y={top + lineH - 6} anchor="end" size={0.82} weight={650}>
              {fmt(e, e < 10 ? 1 : 0)} kJ/m² · {fmtPct(e / E[0]!, e / E[0]! < 0.001 ? 2 : e / E[0]! < 0.01 ? 1 : 0)}
            </Txt>
            <rect
              x={cx - Math.max(w, 2) / 2}
              y={top + lineH}
              width={Math.max(w, 2)}
              height={barH}
              rx={Math.min(6, w / 2)}
              fill={LEVEL_COLOR[i]}
              opacity={0.75}
            />
            {thin && (
              <rect x={cx - 30} y={top + lineH} width={60} height={barH} rx={6} fill="none" stroke={LEVEL_COLOR[i]} strokeDasharray="4 4" />
            )}
          </g>
        );
      })}
    </Figure>
  );
}

/* ====================================================================== */
/* Forklaringer                                                             */
/* ====================================================================== */

const SPECIAL: Partial<Record<WebId, ReactNode>> = {
  ulv: (
    <>
      Dette er en <strong>trofisk kaskade</strong>: virkningen går ned gjennom nettet. Da ulven kom tilbake til Yellowstone i USA i 1995,
      beitet hjortene mindre langs elvene, og vier og osp vokste opp igjen.
    </>
  ),
  smagnagere: (
    <>
      I virkeligheten bytter reven og måren til andre byttedyr i år med lite smågnagere, og tar da flere egg og kyllinger av skogsfugl. Slike
      bytter av byttedyr er ikke med i modellen.
    </>
  ),
  meis: (
    <>
      Spurvehauken dør ut her fordi den bare spiser meis i dette forenklede nettet. En art med én matkilde er sårbar, mens arter med mange
      matkilder klarer seg bedre.
    </>
  ),
  nedbrytere: (
    <>
      Uten nedbrytere hoper døde planter og dyr seg opp, og næringsstoffene (nitrogen, fosfor) kommer ikke tilbake til jorda. Modellen viser
      bare to ledd, men på sikt rammes hele nettet: nedbryterne er like viktige som produsentene.
    </>
  ),
  lauvtraer: (
    <>
      Produsentene er grunnlaget for hele nettet: når lauvtrærne forsvinner, får planteeterne mindre mat, og det merkes helt opp til ulven og
      gaupa.
    </>
  ),
};

function list(kind: Exclude<EffectKind, 'fjernet'>, ids: WebId[]): string | null {
  if (!ids.length) return null;
  return kind === 'usikker' ? `virkningen på ${names(ids)} er usikker` : `${names(ids)} ${KIND_WORD[kind]}`;
}

function webText(removed: WebId | null, sum: EffectSummary): ReactNode {
  if (!removed)
    return (
      <>
        <p>
          <strong>Et næringsnett</strong> viser hvem som spiser hvem i et økosystem. Produsentene (planter) lager organisk stoff med
          fotosyntese, planteeterne (primærkonsumenter) spiser dem, og rovdyrene (sekundær- og tertiærkonsumenter) spiser andre dyr.
          Nedbryterne bryter ned alt som dør, og gir næringsstoffene tilbake til plantene.
        </p>
        <p>Trykk på en art i nettet, eller velg en i lista, for å se hva som skjer når den forsvinner.</p>
      </>
    );
  const s = webSpecies(removed);
  const parts = (r: EffectSummary['direct']) =>
    (['dor-ut', 'oker', 'minker', 'usikker'] as const).map((k) => list(k, r[k])).filter((x): x is string => x !== null);
  const direct = parts(sum.direct);
  const indirect = parts(sum.indirect);
  const why = isProducer(s)
    ? `de spiser ${s.short}`
    : s.id === 'nedbrytere'
      ? 'de får næringsstoffer fra nedbryterne'
      : `de spiser eller blir spist av ${s.short}`;
  return (
    <>
      <p>
        <strong>Uten {s.short}:</strong>{' '}
        {direct.length ? (
          <>
            {cap(join(direct))} (direkte virkninger, fordi {why}).
          </>
        ) : (
          <>Ingen andre arter merker det direkte.</>
        )}{' '}
        {indirect.length ? (
          <>
            Indirekte, ett ledd lenger unna: {join(indirect)}. En art kan altså påvirke arter den aldri spiser eller blir spist av.
          </>
        ) : null}
      </p>
      {SPECIAL[removed] && <p>{SPECIAL[removed]}</p>}
      <p>
        Modellen er forenklet: den viser bare retningen på endringene to ledd ut, og regner med at alle andre forhold (jakt, vær, sykdom) er
        like. Pilene er grove anslag på hvor stor del av maten hver art utgjør.
      </p>
    </>
  );
}

function energyText(E: number[], eff: number): ReactNode {
  return (
    <>
      <p>
        <strong>Bare ca. {fmtPct(eff)} av energien går videre</strong> fra ett trofisk nivå til det neste. Resten brukes i celleåndingen og
        blir til varme, eller blir ikke spist eller fordøyd og går til nedbryterne. Derfor får tertiærkonsumentene bare{' '}
        {fmt(E[3]!, E[3]! < 10 ? 1 : 0)} kJ per m² per år, {fmtPct(eff ** 3, eff ** 3 < 0.001 ? 2 : 1)} av det produsentene laget.
      </p>
      <p>
        Det forklarer hvorfor næringskjeder sjelden har mer enn fire–fem ledd, og hvorfor det er langt færre ulver og gauper enn elg og
        rådyr. En toppredator trenger store områder for å finne nok mat. Ca. 10 % er en tommelfingerregel; i virkeligheten varierer det fra
        noen få til ca. 20 %.
      </p>
    </>
  );
}
