import { useState, type ReactNode } from 'react';
import {
  BIO,
  Explain,
  Figure,
  Forvalg,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Select,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  useContainerTextScale,
} from '../kit';
import { OrganismGlyph } from './Glyfer';
import {
  ORGANISMS,
  QUESTIONS,
  TREES,
  TREE_MODE_NAMES,
  closer,
  depthOf,
  isLeaf,
  layoutTree,
  mrca,
  organism,
  pathTo,
  softHyphens,
  type Organism,
  type OrganismId,
  type PlacedNode,
  type Question,
  type TreeMode,
  type TreeNode,
} from './model';

const COL_Y = BIO.serie[0];
const COL_Z = BIO.serie[1];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const OPTIONS = ORGANISMS.map((o) => ({ value: o.id, label: cap(o.name) }));
const MODES: { value: TreeMode; label: string }[] = [
  { value: 'utseende', label: 'Ytre likhet' },
  { value: 'anatomi', label: 'Anatomi' },
  { value: 'dna', label: 'DNA' },
];

/** Organismenavn i HTML, i kursiv når det er et vitenskapelig navn (E. coli). */
function nm(o: { name: string; short: string; italic?: boolean }, which: 'name' | 'short' = 'name', capital = false): ReactNode {
  const t = capital ? cap(o[which]) : o[which];
  return o.italic ? <em>{t}</em> : t;
}

/** Navnet på et knutepunkt i tekst. */
const nodeName = (tree: TreeNode, n: TreeNode) => (n === tree ? 'rota (alt liv)' : isLeaf(n) ? organism(n.leaf).name : (n.name ?? 'en felles stamform uten navn'));

export default function Slektskapstre() {
  const [mode, setMode] = useState<TreeMode>('dna');
  const [q, setQ] = useState<{ x: OrganismId; y: OrganismId; z: OrganismId }>({ x: 'fluesopp', y: 'eik', z: 'menneske' });
  const tree = TREES[mode];
  const question = QUESTIONS.find((c) => c.x === q.x && c.y === q.y && c.z === q.z) ?? null;
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const valid = q.x !== q.y && q.x !== q.z && q.y !== q.z;
  const mY = mrca(tree, q.x, q.y);
  const mZ = mrca(tree, q.x, q.z);
  const answer = closer(tree, q.x, q.y, q.z);
  const X = organism(q.x);
  const Y = organism(q.y);
  const Z = organism(q.z);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Hva treet bygger på" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Spørsmål"
          options={QUESTIONS.map((c) => ({ value: c.id, label: c.label }))}
          value={question?.id ?? null}
          onPick={(id) => {
            const c = QUESTIONS.find((x) => x.id === id)!;
            setQ({ x: c.x, y: c.y, z: c.z });
          }}
        />
      </Toolbar>
      <Toolbar>
        <Select label="Er" value={q.x} options={OPTIONS} onChange={(x) => setQ((p) => ({ ...p, x }))} />
        <Select label="nærmest i slekt med" value={q.y} options={OPTIONS} onChange={(y) => setQ((p) => ({ ...p, y }))} />
        <Select label="eller" value={q.z} options={OPTIONS} onChange={(z) => setQ((p) => ({ ...p, z }))} />
      </Toolbar>

      <div ref={ref}>
        <TreeFigure tree={tree} mode={mode} f={f} x={q.x} y={q.y} z={q.z} mY={mY} mZ={mZ} />
      </div>
      <Legend
        items={[
          {
            color: COL_Y,
            label: (
              <span>
                Felles stamform og greiner: {nm(X, 'short')} og {nm(Y, 'short')}
              </span>
            ),
          },
          {
            color: COL_Z,
            label: (
              <span>
                Felles stamform og greiner: {nm(X, 'short')} og {nm(Z, 'short')}
              </span>
            ),
          },
          { color: VIZ.muted, label: 'Hvert knutepunkt er en felles stamform' },
        ]}
      />

      <Readouts>
        <Readout label={<>Felles stamform med {nm(Y, 'short')}</>} value={valid ? softHyphens(cap(nodeName(tree, mY))) : '–'} tone={COL_Y} />
        <Readout label={<>Felles stamform med {nm(Z, 'short')}</>} value={valid ? softHyphens(cap(nodeName(tree, mZ))) : '–'} tone={COL_Z} />
        <Readout
          label={<>{nm(X, 'short', true)} er nærmest</>}
          value={!valid ? '–' : answer === 'y' ? cap(Y.short) : answer === 'z' ? cap(Z.short) : 'Like nær'}
          tone={answer === 'y' ? COL_Y : answer === 'z' ? COL_Z : undefined}
        />
      </Readouts>

      <Explain>{explanation({ tree, mode, question, X, Y, Z, mY, mZ, answer, valid })}</Explain>
    </VizLayout>
  );
}

/* ---------- Kladogrammet ---------- */

const X0 = 18;
const X1 = 790;

interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const overlaps = (a: LabelBox, b: LabelBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function TreeFigure({
  tree,
  mode,
  f,
  x,
  y,
  z,
  mY,
  mZ,
}: {
  tree: TreeNode;
  mode: TreeMode;
  f: number;
  x: OrganismId;
  y: OrganismId;
  z: OrganismId;
  mY: TreeNode;
  mZ: TreeNode;
}) {
  const k = Math.max(1, 0.85 * f);
  const narrow = f > 1.3;
  const { nodes } = layoutTree(tree);
  const nameSize = narrow ? 1 : 0.88;
  const labelSize = narrow ? 0.82 : 0.72;
  const charW = 0.58 * 17 * f * nameSize;
  const glyph = 24 * k;
  const longest = Math.max(...ORGANISMS.map((o) => o.short.length));
  const nameW = longest * charW;
  const xLeaf = X1 - (8 + glyph + 8 + nameW);
  const rowH = narrow ? 31 * f : Math.max(27, 26 * f);
  const top = 10;
  const H = Math.round(top + nodes.filter((n) => n.children.length === 0).length * rowH + 10);
  // Rota får navnet sitt loddrett helt til venstre
  const fs = 17 * f * labelSize;
  const xRoot = X0 + fs + 10;
  // Høyde = avstand til tuppene, så søstergrupper nær tuppene står tett
  const height = new Map<PlacedNode, number>();
  const h = (n: PlacedNode): number => {
    const v = n.children.length ? 1 + Math.max(...n.children.map(h)) : 0;
    height.set(n, v);
    return v;
  };
  const rootH = h(nodes[0]!);
  const dx = (xLeaf - xRoot) / rootH;
  const px = (n: PlacedNode) => xLeaf - (height.get(n) ?? 0) * dx;
  const py = (n: PlacedNode) => top + n.row * rowH + rowH / 2;
  const placed = new Map(nodes.map((n) => [n.node, n]));

  // Greiner som skal fremheves: fra den felles stamformen ned til hver av de tre
  const edgesTo = (from: TreeNode, leaf: OrganismId) => {
    const p = pathTo(tree, leaf)!;
    const i = p.indexOf(from);
    return p.slice(i);
  };
  const pathY = edgesTo(mY, y);
  const pathZ = edgesTo(mZ, z);
  const shallow = depthOf(tree, mY) <= depthOf(tree, mZ) ? mY : mZ;
  const pathX = edgesTo(shallow, x);
  const elbow = (a: TreeNode, b: TreeNode) => {
    const pa = placed.get(a)!;
    const pb = placed.get(b)!;
    return `M${px(pa)},${py(pa)} V${py(pb)} H${px(pb)}`;
  };
  const chain = (path: TreeNode[]) => path.slice(1).map((n, i) => elbow(path[i]!, n)).join(' ');

  // Etiketter på navngitte knutepunkter. De skal ikke overlappe hverandre eller krysse greiner (da ser teksten
  // overstrøket ut), så greinene er hindringer. De felles stamformene plasseres først.
  const branches: LabelBox[] = [];
  const taken: LabelBox[] = [];
  for (const n of nodes) {
    if (!n.children.length) continue;
    const x = px(n);
    branches.push({ x0: x - 1.5, x1: x + 1.5, y0: py(n.children[0]!), y1: py(n.children.at(-1)!) });
    for (const c of n.children) branches.push({ x0: x, x1: px(c), y0: py(c) - 1.5, y1: py(c) + 1.5 });
  }
  // Markeringene av de to felles stamformene skal heller ikke dekkes av tekst
  for (const m of [mY, mZ]) {
    const p = placed.get(m)!;
    const rr = 10 * k;
    taken.push({ x0: px(p) - rr, x1: px(p) + rr, y0: py(p) - rr, y1: py(p) + rr });
  }
  const labels: ReactNode[] = [];
  const root = nodes[0]!;
  const rootName = (root.node as { name?: string }).name;
  if (rootName)
    labels.push(
      <Txt
        key="rot"
        x={0}
        y={0}
        size={labelSize}
        muted={root.node !== mY && root.node !== mZ}
        weight={root.node === mY || root.node === mZ ? 700 : 520}
        color={root.node === mY ? COL_Y : root.node === mZ ? COL_Z : undefined}
      >
        <tspan>{rootName}</tspan>
      </Txt>,
    );
  const order = nodes
    .filter((n) => n.parent && n.children.length && (n.node as { name?: string }).name)
    .sort((a, b) => {
      const pa = a.node === mY || a.node === mZ ? 0 : 1;
      const pb = b.node === mY || b.node === mZ ? 0 : 1;
      return pa - pb || a.depth - b.depth;
    });
  for (const n of order) {
    const full = (n.node as { name?: string }).name!;
    const isY = n.node === mY;
    const isZ = n.node === mZ;
    const strong = isY || isZ;
    const nx = px(n);
    const ny = py(n);
    // De fremhevede knutepunktene har en stor markering; hold teksten klar av den
    const gapL = strong ? 9 * k + 3 : 7;
    const gapR = strong ? 9 * k + 4 : 9;
    const candidates: { x: number; y: number; anchor: 'start' | 'end' }[] = [
      { x: nx - gapL, y: ny - 6, anchor: 'end' },
      { x: nx - gapL, y: ny + fs + 3, anchor: 'end' },
      { x: nx + gapR, y: ny - 6, anchor: 'start' },
      { x: nx + gapR, y: ny + fs + 3, anchor: 'start' },
    ];
    // Først uten å krysse greiner; de to fremhevede stamformene får navnet sitt uansett (teksten har en glorie, så den
    // kan krysse en grein), men aldri oppå en annen etikett. Får ikke hele navnet plass, prøves navnet uten parentes.
    const variants = strong && full.includes(' (') ? [full, full.split(' (')[0]!] : [full];
    let chosen: { x: number; y: number; anchor: 'start' | 'end' } | null = null;
    let name = full;
    search: for (const v of variants) {
      const w = v.length * (strong ? 0.62 : 0.57) * fs;
      for (const avoidBranches of strong ? [true, false] : [true]) {
        for (const c of candidates) {
          const box: LabelBox = {
            x0: c.anchor === 'end' ? c.x - w : c.x,
            x1: c.anchor === 'end' ? c.x : c.x + w,
            y0: c.y - fs * 0.8,
            y1: c.y + 2,
          };
          if (box.x0 < xRoot || box.x1 > xLeaf + 4 || box.y0 < 0 || box.y1 > H) continue;
          if (taken.some((t) => overlaps(t, box))) continue;
          if (avoidBranches && branches.some((t) => overlaps(t, box))) continue;
          taken.push(box);
          chosen = c;
          name = v;
          break search;
        }
      }
    }
    if (!chosen) continue;
    labels.push(
      <Txt
        key={`${full}-${n.row}`}
        x={chosen.x}
        y={chosen.y}
        anchor={chosen.anchor}
        size={labelSize}
        weight={strong ? 700 : 520}
        color={isY ? COL_Y : isZ ? COL_Z : undefined}
        muted={!strong}
      >
        {name}
      </Txt>,
    );
  }
  const rootX = X0 + fs * 0.8;
  // Loddrett navn langs venstre kant, så nær rota som mulig uten å gå ut av figuren
  const half = ((rootName?.length ?? 0) * 0.57 * fs) / 2 + 6;
  // Loddrett ved siden av rota, men over eller under markeringen av den (rota kan være en felles stamform)
  const clear = 14 * k;
  const aboveY = py(root) - clear - half;
  const rootY = aboveY >= half ? aboveY : Math.min(H - half, py(root) + clear + half);

  const leafNodes = nodes.filter((n) => n.children.length === 0);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Slektskapstre etter ${TREE_MODE_NAMES[mode].toLowerCase()} med ${leafNodes.length} organismer. Nærmeste felles stamform for ${organism(x).name} og ${organism(y).name}: ${nodeName(tree, mY)}. For ${organism(x).name} og ${organism(z).name}: ${nodeName(tree, mZ)}.`}
      caption="Rota til venstre er felles stamform for alle. Les mot høyre: hvert knutepunkt er en felles stamform for alt som vokser ut fra det."
    >
      {/* Alle greiner */}
      {nodes
        .filter((n) => n.children.length)
        .map((n) => (
          <g key={`b${n.row}-${n.depth}`}>
            <line x1={px(n)} x2={px(n)} y1={py(n.children[0]!)} y2={py(n.children.at(-1)!)} stroke={VIZ.muted} strokeWidth={1.6} />
            {n.children.map((c) => (
              <line key={`${c.row}`} x1={px(n)} x2={px(c)} y1={py(c)} y2={py(c)} stroke={VIZ.muted} strokeWidth={1.6} />
            ))}
          </g>
        ))}
      {/* Fremhevede greiner */}
      <path d={chain(pathZ)} fill="none" stroke={COL_Z} strokeWidth={4} strokeLinejoin="round" />
      <path d={chain(pathY)} fill="none" stroke={COL_Y} strokeWidth={4} strokeLinejoin="round" />
      <path d={chain(pathX)} fill="none" stroke={VIZ.ink} strokeWidth={3} strokeLinejoin="round" />
      {/* Knutepunkter */}
      {nodes
        .filter((n) => n.children.length)
        .map((n) => (
          <circle key={`n${n.row}-${n.depth}`} cx={px(n)} cy={py(n)} r={3.2 * k} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.5} />
        ))}
      {[
        { node: mZ, col: COL_Z, r: 9 },
        { node: mY, col: COL_Y, r: mY === mZ ? 5.5 : 9 },
      ].map(({ node, col, r }) => {
        const p = placed.get(node)!;
        return <circle key={`m${r}${col}`} cx={px(p)} cy={py(p)} r={r * k} fill={col} stroke={VIZ.surface} strokeWidth={2} />;
      })}
      <g transform={`translate(${rootX} ${rootY}) rotate(-90)`}>{labels[0] && rootName ? labels[0] : null}</g>
      {rootName ? labels.slice(1) : labels}
      {/* Bladene: symbol og navn */}
      {leafNodes.map((n) => {
        const id = (n.node as { leaf: OrganismId }).leaf;
        const o = organism(id);
        const cy = py(n);
        const role = id === x ? VIZ.ink : id === y ? COL_Y : id === z ? COL_Z : null;
        return (
          <g key={id}>
            <OrganismGlyph id={id} x={xLeaf + 8 + glyph / 2} y={cy} size={glyph} flagell={false} />
            <Txt x={xLeaf + 8 + glyph + 8} y={cy + 6 * f} anchor="start" size={nameSize} weight={role ? 700 : 500} color={role ?? undefined}>
              {o.italic ? <tspan fontStyle="italic">{o.short}</tspan> : o.short}
            </Txt>
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

const SPECIFIC: Record<Question['id'], Record<TreeMode, ReactNode>> = {
  hval: {
    utseende: (
      <>
        Etter ytre likhet havner blåhvalen sammen med laks og torsk: alle er strømlinjeformet, har finner og lever i vann. Derfor het den
        lenge «hvalfisk». Men likheten skyldes samme levevis, ikke slektskap: fiskeformen er utviklet flere ganger (konvergent utvikling).
      </>
    ),
    anatomi: (
      <>
        Anatomien avslører hvalen: den har lunger, varmt blod, melkekjertler og de samme knoklene i luffen som i en hundepote. Linné plasserte
        hvalene blant pattedyrene allerede i 1758. Nå har blåhvalen en nyere felles stamform med hunden enn med laksen.
      </>
    ),
    dna: (
      <>
        DNA bekrefter at hvalen er et pattedyr, og viser mer: hvalene er nærmere i slekt med rovdyrene (og med klovdyr som flodhesten) enn
        med primatene. Det kunne ikke anatomien avgjøre.
      </>
    ),
  },
  fugl: {
    utseende: (
      <>
        Etter ytre likhet står kongeørnen alene blant «dyr som flyr». Treet sier ingenting om hvem den er nærmest i slekt med: den har like
        langt til krokodillen som til hunden.
      </>
    ),
    anatomi: (
      <>
        Etter anatomien er krypdyr, fugler og pattedyr tre likestilte klasser. Krokodillen og firfisla står sammen som krypdyr fordi de
        har skjell og er vekselvarme, mens kongeørnen står for seg med fjær og varmt blod. Hvem fuglene er nærmest i slekt med, sier ikke
        treet noe om: tre greiner går ut fra samme knutepunkt.
      </>
    ),
    dna: (
      <>
        DNA og fossiler viser at fuglene stammer fra dinosaurene, og at krokodillene er fuglenes nærmeste nålevende slektninger (arkosaurer).
        Varmt blod har altså oppstått to ganger, hos pattedyr og hos fugler. Krypdyr uten fugler er derfor ingen ekte slektskapsgruppe.
      </>
    ),
  },
  sopp: {
    utseende: (
      <>
        Sopp står fast og vokser opp av jorda, og ble regnet som planter i over 2000 år. Etter ytre likhet er fluesoppen nærmest eika.
      </>
    ),
    anatomi: (
      <>
        Mikroskop og kjemi viste at sopp mangler klorofyll og har cellevegg av kitin, ikke cellulose. I 1969 ble sopp et eget rike, men om
        sopp var nærmest planter eller dyr, kunne ikke anatomien avgjøre: tre greiner går ut fra samme knutepunkt.
      </>
    ),
    dna: (
      <>
        DNA viser at sopper og dyr har en felles stamform som ikke er stamform for plantene. Fluesoppen er altså nærmere i slekt med deg enn
        med eika. Både sopp og dyr lagrer for eksempel karbohydrat som glykogen, mens planter lagrer stivelse.
      </>
    ),
  },
  arke: {
    utseende: (
      <>
        Arker, bakterier og gjærceller er for små til å sees uten mikroskop. Ingen visste at det fantes mikroorganismer før Antoni van
        Leeuwenhoek så bakterier i mikroskopet sitt i 1670-årene, så etter ytre likhet havner de i én gruppe av «små organismer».
      </>
    ),
    anatomi: (
      <>
        I mikroskopet har arker og bakterier ingen cellekjerne, så arkene ble regnet som bakterier (prokaryoter). Gjæren har cellekjerne og
        står blant eukaryotene.
      </>
    ),
    dna: (
      <>
        Carl Woese sammenlignet ribosomalt RNA i 1977 og fant at arkene er en helt egen gruppe. I dag deler vi livet i tre domener:
        bakterier, arker og eukaryoter. Arkene er nærmere i slekt med eukaryotene, som gjæren og oss, enn med bakteriene.
      </>
    ),
  },
};

const TECHNOLOGY: Record<TreeMode, ReactNode> = {
  utseende: (
    <>
      <strong>Ytre likhet</strong> var det første kriteriet: grupper etter hvordan organismene ser ut og lever. Slike grupper sier mer om
      levevis enn om slektskap.
    </>
  ),
  anatomi: (
    <>
      <strong>Anatomi (morfologi)</strong>: disseksjon og mikroskop gjorde det mulig å sammenligne indre bygning og celler. Dette treet viser
      omtrent hva skolebøkene viste før DNA-sekvensering (ca. 1970). Der kriteriene ikke kunne avgjøre rekkefølgen, går flere greiner ut fra
      samme knutepunkt.
    </>
  ),
  dna: (
    <>
      <strong>DNA (molekylære data)</strong>: siden 1970-tallet sammenligner vi baserekkefølgen i DNA og RNA. Jo flere forskjeller, jo lenger
      siden den felles stamformen levde. Molekylære data har endret mange grupper, men bekreftet de fleste.
    </>
  ),
};

function explanation(s: {
  tree: TreeNode;
  mode: TreeMode;
  question: Question | null;
  X: Organism;
  Y: Organism;
  Z: Organism;
  mY: TreeNode;
  mZ: TreeNode;
  answer: 'y' | 'z' | 'lik';
  valid: boolean;
}): ReactNode {
  const { tree, mode, question, X, Y, Z, mY, mZ, answer, valid } = s;
  let main: ReactNode;
  if (!valid) main = <>Velg tre ulike organismer for å sammenligne slektskapet.</>;
  else if (question) main = SPECIFIC[question.id][mode];
  else if (answer === 'lik')
    main = (
      <>
        {nm(X, 'name', true)} har den samme nærmeste felles stamformen med {nm(Y)} og med {nm(Z)} ({nodeName(tree, mY)}). Etter dette
        treet er {nm(X, 'short')} like nær i slekt med begge.
      </>
    );
  else {
    const near = answer === 'y' ? Y : Z;
    const far = answer === 'y' ? Z : Y;
    main = (
      <>
        {nm(X, 'name', true)} og {nm(near)} har en nyere felles stamform ({nodeName(tree, answer === 'y' ? mY : mZ)}) enn {nm(X)} og{' '}
        {nm(far)} ({nodeName(tree, answer === 'y' ? mZ : mY)}). Derfor er {nm(X, 'short')} nærmest i slekt med {nm(near, 'short')}.
      </>
    );
  }
  return (
    <>
      <p>{main}</p>
      <p>{TECHNOLOGY[mode]}</p>
      <p>
        <strong>Slik leser du treet:</strong> følg greinene fra to organismer bakover mot venstre til de møtes. Der står deres nærmeste
        felles stamform. Av to slektninger er den som møter {nm(X)} i en nyere stamform (lenger til høyre langs greina til {nm(X, 'short')}),
        nærmest i slekt. Treet viser bare rekkefølgen av forgreiningene, ikke tid: avstanden mellom knutepunktene sier ingenting om hvor
        lenge siden de levde. Rekkefølgen ovenfra og ned betyr heller ingenting, for greinene kan dreies om knutepunktene. Ingen nålevende
        art er stamform til en annen: mennesket stammer ikke fra sjimpansen, men begge stammer fra en felles stamform.
      </p>
    </>
  );
}
