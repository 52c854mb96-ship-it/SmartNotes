import { useState, type ReactNode } from 'react';
import {
  BIO,
  Explain,
  Figure,
  Forvalg,
  Readout,
  Readouts,
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
  PAIRS,
  RANKS,
  RANK_NAMES,
  abbreviateSpecies,
  lowestSharedRankIndex,
  organism,
  type Organism,
  type OrganismId,
  type Rank,
  type Taxon,
} from './model';

const COL_A = BIO.serie[0];
const COL_B = BIO.serie[1];
const SHARED = BIO.serie[2];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const OPTIONS = ORGANISMS.map((o) => ({ value: o.id, label: `${cap(o.name)} (${o.sci})` }));

export default function Klassifisering() {
  const [a, setA] = useState<OrganismId>('menneske');
  const [b, setB] = useState<OrganismId>('sjimpanse');
  const A = organism(a);
  const B = organism(b);
  const s = lowestSharedRankIndex(A, B);
  const pair = PAIRS.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))?.id ?? null;
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const sharedTaxon = s >= 0 ? A.lineage[RANKS[s]!] : null;

  return (
    <VizLayout>
      <Toolbar>
        <Select label="Organisme A" value={a} options={OPTIONS} onChange={setA} />
        <Select label="Organisme B" value={b} options={OPTIONS} onChange={setB} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Eksempler"
          options={PAIRS.map((p) => ({ value: p.id, label: p.label }))}
          value={pair}
          onPick={(id) => {
            const p = PAIRS.find((x) => x.id === id)!;
            setA(p.a);
            setB(p.b);
          }}
        />
      </Toolbar>

      <div ref={ref}>
        <Ladder A={A} B={B} s={s} f={f} />
      </div>

      <Readouts>
        <Readout label="Laveste felles nivå" value={s >= 0 ? RANK_NAMES[RANKS[s]!] : 'Ingen'} tone={SHARED} />
        <Readout label="Felles gruppe" value={sharedTaxon ? (sharedTaxon.no ?? sharedTaxon.sci) : 'Bare livet selv'} />
        <Readout label="Felles nivåer" value={`${s + 1} av 8`} />
      </Readouts>

      <Explain>{explanation(A, B, s)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figuren: to stiger som deler seg der organismene skilles ---------- */

const X0 = 14;
const X1 = 786;

interface Geo {
  narrow: boolean;
  colA: { x: number; w: number };
  colB: { x: number; w: number };
  /** Toppen av hver rad (rad −1 = «alt liv»). */
  rowTop: (i: number) => number;
  boxTop: (i: number) => number;
  boxH: number;
  rootTop: number;
  rootH: number;
  headerH: number;
  glyph: number;
  H: number;
}

function geometry(f: number): Geo {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const labelW = narrow ? 0 : 108;
  const gap = 12;
  const left = X0 + labelW;
  const w = (X1 - left - gap) / 2;
  const glyph = 62 * k;
  const headerH = glyph + 12 + 24 * f + 22 * f + 14;
  const rootH = 30 * f;
  const rootTop = headerH + 6;
  const rankLabel = narrow ? 22 * f : 0;
  const boxH = 16 + 36 * f;
  const rowGap = narrow ? 12 : 12;
  const rowH = rankLabel + boxH + rowGap;
  const first = rootTop + rootH + 18;
  const rowTop = (i: number) => first + i * rowH;
  const boxTop = (i: number) => rowTop(i) + rankLabel;
  return {
    narrow,
    colA: { x: left, w },
    colB: { x: left + w + gap, w },
    rowTop,
    boxTop,
    boxH,
    rootTop,
    rootH,
    headerH,
    glyph,
    H: Math.round(rowTop(8) + 4),
  };
}

/** Tekstlinjene i en boks: norsk navn og vitenskapelig navn (kursiv for slekt og art). */
function boxLines(t: Taxon, rank: Rank, narrow: boolean, ids: OrganismId[]): { main: ReactNode; sub: ReactNode | null } {
  if (rank === 'slekt' || rank === 'art') {
    const sci = narrow && rank === 'art' && t.sci.length > 18 ? abbreviateSpecies(t.sci) : t.sci;
    let sub: string | null = t.no ?? null;
    if (rank === 'art' && t.sci === 'Canis lupus') {
      if (ids.includes('hund') && ids.includes('ulv')) sub = 'ulv og hund (tam underart)';
      else if (ids.includes('hund')) sub = 'hunden er en underart av ulv';
    }
    return { main: <tspan fontStyle="italic">{sci}</tspan>, sub };
  }
  return t.no ? { main: t.no, sub: t.sci } : { main: t.sci, sub: null };
}

function TaxonBox({
  x,
  y,
  w,
  h,
  t,
  rank,
  color,
  strong,
  narrow,
  ids,
  tag,
  f,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  t: Taxon;
  rank: Rank;
  color: string;
  strong?: boolean;
  narrow: boolean;
  ids: OrganismId[];
  tag?: string;
  f: number;
}) {
  const { main, sub } = boxLines(t, rank, narrow, ids);
  const cx = x + w / 2;
  const tagged = tag !== undefined;
  // Med merkelapp står navnet til venstre og merkelappen til høyre
  const tx = tagged ? x + 14 : cx;
  const anchor = tagged ? 'start' : 'middle';
  const y1 = sub ? y + h / 2 - 3 * f : y + h / 2 + 6 * f;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={color}
        fillOpacity={strong ? 0.2 : 0.1}
        stroke={color}
        strokeWidth={strong ? 3 : 1.5}
      />
      <Txt x={tx} y={y1} anchor={anchor} size={0.88} weight={650} halo={false}>
        {main}
      </Txt>
      {sub && (
        <Txt x={tx} y={y1 + 19 * f} anchor={anchor} size={0.78} muted halo={false}>
          {sub}
        </Txt>
      )}
      {tagged && (
        <Txt x={x + w - 14} y={y + h / 2 + 6 * f} anchor="end" size={0.8} weight={700} color={color} halo={false}>
          {tag}
        </Txt>
      )}
    </g>
  );
}

function Ladder({ A, B, s, f }: { A: Organism; B: Organism; s: number; f: number }) {
  const g = geometry(f);
  const { colA, colB, boxH, narrow } = g;
  const full = { x: colA.x, w: colB.x + colB.w - colA.x };
  const cA = colA.x + colA.w / 2;
  const cB = colB.x + colB.w / 2;
  const cM = full.x + full.w / 2;
  const ids = [A.id, B.id];
  const same = A.id === B.id;
  // Tagg på det laveste felles nivået (bare plass på brede bokser)
  const tagText = narrow ? 'laveste felles' : 'laveste felles nivå';
  const label =
    s >= 0
      ? `${A.name} og ${B.name} har felles ${RANKS.slice(0, s + 1).join(', ')}. Laveste felles nivå er ${RANK_NAMES[RANKS[s]!].toLowerCase()}.`
      : `${A.name} og ${B.name} hører til ulike domener og har ingen nivåer felles.`;

  return (
    <Figure viewBox={`0 0 800 ${g.H}`} maxHeight={g.H} label={`Klassifisering av ${label}`}>
      {/* Overskrift: de to organismene */}
      {[
        { o: A, cx: cA, col: COL_A, tag: 'A' },
        { o: B, cx: cB, col: COL_B, tag: 'B' },
      ].map(({ o, cx, col, tag }) => (
        <g key={tag}>
          <circle cx={cx} cy={g.glyph / 2 + 6} r={g.glyph * 0.62} fill={col} fillOpacity={0.1} stroke={col} strokeWidth={1.5} />
          <OrganismGlyph id={o.id} x={cx} y={g.glyph / 2 + 6} size={g.glyph * 0.92} />
          <Txt x={cx - g.glyph * 0.62 - 10} y={22 * f} anchor="end" size={0.85} weight={700} color={col}>
            {tag}
          </Txt>
          <Txt x={cx} y={g.glyph + 12 + 22 * f} weight={700}>
            {cap(o.name)}
          </Txt>
          <Txt x={cx} y={g.glyph + 12 + 44 * f} size={0.85} muted>
            <tspan fontStyle="italic">{narrow && o.sci.length > 20 ? abbreviateSpecies(o.sci) : o.sci}</tspan>
          </Txt>
        </g>
      ))}

      {/* «Alt liv» øverst: alle organismer har en felles stamform */}
      <rect x={full.x} y={g.rootTop} width={full.w} height={g.rootH} rx={g.rootH / 2} fill={VIZ.grid} opacity={0.6} />
      <Txt x={cM} y={g.rootTop + g.rootH / 2 + 5.5 * f} size={0.78} muted halo={false}>
        Alt liv har en felles stamform
      </Txt>

      {/* Forbindelser: stamme så lenge de er felles, så en gaffel */}
      {(() => {
        const lines: ReactNode[] = [];
        const top0 = g.boxTop(0);
        const rootBottom = g.rootTop + g.rootH;
        const fork = (yFrom: number, yTo: number, key: string) => {
          const mid = (yFrom + yTo) / 2;
          lines.push(
            <path
              key={key}
              d={`M${cM},${yFrom} V${mid} M${cA},${mid} H${cB} M${cA},${mid} V${yTo} M${cB},${mid} V${yTo}`}
              fill="none"
              stroke={VIZ.muted}
              strokeWidth={2}
            />,
          );
        };
        if (s < 0) fork(rootBottom, top0, 'f0');
        else lines.push(<line key="r" x1={cM} x2={cM} y1={rootBottom} y2={top0} stroke={SHARED} strokeWidth={2.5} />);
        for (let i = 0; i < 7; i++) {
          const yb = g.boxTop(i) + boxH;
          const yt = g.boxTop(i + 1);
          if (i < s) lines.push(<line key={`m${i}`} x1={cM} x2={cM} y1={yb} y2={yt} stroke={SHARED} strokeWidth={2.5} />);
          else if (i === s) fork(yb, yt, `f${i}`);
          else
            lines.push(
              <g key={`s${i}`}>
                <line x1={cA} x2={cA} y1={yb} y2={yt} stroke={COL_A} strokeWidth={2} />
                <line x1={cB} x2={cB} y1={yb} y2={yt} stroke={COL_B} strokeWidth={2} />
              </g>,
            );
        }
        return lines;
      })()}

      {/* Rader */}
      {RANKS.map((rank, i) => {
        const tA = A.lineage[rank];
        const tB = B.lineage[rank];
        const shared = i <= s;
        const y = g.boxTop(i);
        return (
          <g key={rank}>
            {narrow ? (
              <Txt x={X0 + 4} y={g.rowTop(i) + 15 * f} anchor="start" size={0.78} muted>
                {RANK_NAMES[rank]}
              </Txt>
            ) : (
              <Txt x={X0 + 2} y={y + boxH / 2 + 6} anchor="start" size={0.9} weight={i === s ? 700 : 560} color={i === s ? SHARED : undefined} muted={i !== s}>
                {RANK_NAMES[rank]}
              </Txt>
            )}
            {shared ? (
              <TaxonBox
                x={full.x}
                y={y}
                w={full.w}
                h={boxH}
                t={tA}
                rank={rank}
                color={SHARED}
                strong={i === s}
                narrow={narrow}
                ids={ids}
                tag={i === s && !same ? tagText : undefined}
                f={f}
              />
            ) : (
              <>
                <TaxonBox x={colA.x} y={y} w={colA.w} h={boxH} t={tA} rank={rank} color={COL_A} narrow={narrow} ids={[A.id]} f={f} />
                <TaxonBox x={colB.x} y={y} w={colB.w} h={boxH} t={tB} rank={rank} color={COL_B} narrow={narrow} ids={[B.id]} f={f} />
              </>
            )}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

function explanation(A: Organism, B: Organism, s: number): ReactNode {
  const a = A.name;
  const b = B.name;
  const ids = new Set([A.id, B.id]);
  const has = (id: OrganismId) => ids.has(id);
  const general = (
    <p>
      Klassifiseringen er et <strong>hierarki</strong>: hvert nivå samler grupper fra nivået under, fra domene ned til art. Jo lavere
      nivå to organismer har felles, jo nærmere i slekt regner vi dem. Artsnavnet er todelt (Linnés binære navnsystem): slektsnavnet med
      stor forbokstav og et artsepitet, skrevet i kursiv, som <em>Homo sapiens</em>.
    </p>
  );
  let main: ReactNode;
  if (A.id === B.id)
    main = (
      <p>
        Du har valgt samme organisme to ganger, så alle åtte nivåene er felles. Velg en annen organisme som B for å sammenligne.
      </p>
    );
  else if (s < 0)
    main = (
      <p>
        <strong>
          {cap(a)} og {b} har ikke ett eneste nivå felles.
        </strong>{' '}
        {has('ecoli') && has('arke') ? (
          <>
            Begge er encellede og uten cellekjerne, og i mikroskopet ser de nesten like ut. Likevel hører de til hvert sitt domene: Carl
            Woese sammenlignet ribosomalt RNA i 1977 og viste at arkene er like forskjellige fra bakteriene som fra oss. Arkene er faktisk
            nærmere i slekt med eukaryotene enn med bakteriene.
          </>
        ) : (
          <>
            De hører til ulike domener. Det eneste de har felles, er at alt liv stammer fra én felles stamform for nesten 4 milliarder år
            siden: alle bruker DNA, den samme genetiske koden og ribosomer.
          </>
        )}
      </p>
    );
  else {
    const rank = RANKS[s]!;
    const t = A.lineage[rank];
    const next = RANKS[s + 1];
    const tName = (
      <>
        {t.no ? t.no.toLowerCase() : rank === 'slekt' || rank === 'art' ? <em>{t.sci}</em> : t.sci}
        {t.no ? (
          <>
            {' '}
            ({rank === 'slekt' || rank === 'art' ? <em>{t.sci}</em> : t.sci})
          </>
        ) : null}
      </>
    );
    if (rank === 'art')
      main = (
        <p>
          <strong>
            {cap(a)} og {b} er samme art,
          </strong>{' '}
          <em>Canis lupus</em>. Hunden er temmet fra ulv for minst 15 000 år siden og regnes som en underart, <em>Canis lupus familiaris</em>.
          At de er samme art, betyr at de kan få unger sammen som selv kan få unger (fertilt avkom). Hunderasene ser svært ulike ut, men
          forskjellene skyldes avl, ikke at de er ulike arter.
        </p>
      );
    else
      main = (
        <p>
          <strong>
            {cap(a)} og {b} har felles {RANK_NAMES[rank].toLowerCase()}: {tName}.
          </strong>{' '}
          Fra {RANK_NAMES[next!].toLowerCase()} og nedover skilles de ({A.lineage[next!].no ?? A.lineage[next!].sci} og{' '}
          {B.lineage[next!].no ?? B.lineage[next!].sci}).{' '}
          {s >= 5
            ? 'Det er et lavt nivå, så de er nære slektninger.'
            : s >= 3
              ? 'De har en del felles bygning, men har utviklet seg hver for seg i lang tid.'
              : 'Det er et høyt nivå, så slektskapet er fjernt.'}
        </p>
      );
  }
  const extra: ReactNode[] = [];
  if (has('menneske') && has('sjimpanse'))
    extra.push(
      <p key="ape">
        Mennesket og sjimpansen har omtrent 98–99 % likt DNA og en felles stamform som levde for 6–7 millioner år siden. Før DNA-analysene
        sto mennesket alene i familien Hominidae, mens de andre menneskeapene var i en egen familie.
      </p>,
    );
  if (has('blahval') && (has('laks') || has('torsk')))
    extra.push(
      <p key="hval">
        <strong>Hvalen er ikke en fisk.</strong> Den puster med lunger, er varmblodig, føder levende unger og gir dem melk, og den har hår
        som foster. Derfor er den et pattedyr. Fiskeformen er en tilpasning til livet i vann som hval og fisk har utviklet hver for seg.
      </p>,
    );
  if ((has('fluesopp') || has('bakegjaer')) && (has('eik') || has('gran')))
    extra.push(
      <p key="sopp">
        Sopp ble lenge regnet som planter, fordi de står fast og vokser opp av jorda. Men sopp har ikke klorofyll og kan ikke drive
        fotosyntese, og celleveggen er av kitin (som skallet til insekter), ikke cellulose. Sopp er et eget rike.
      </p>,
    );
  if (has('kongeorn') && (has('krokodille') || has('firfisle')))
    extra.push(
      <p key="fugl">
        I klassifiseringen er fugler og krypdyr to klasser. Slektskapstreet viser noe annet: fuglene stammer fra dinosaurene, og
        krokodillen er nærmere i slekt med kongeørnen enn med firfisla.
      </p>,
    );
  if (has('blahval') && !(has('laks') || has('torsk')))
    extra.push(
      <p key="hvalorden">
        Hvaler står her som egen orden (Cetacea), som i de fleste skolebøker. DNA viser at flodhesten er hvalenes nærmeste nålevende
        slektning, så nyere systematikk plasserer hvalene blant klovdyrene.
      </p>,
    );
  return (
    <>
      {main}
      {extra}
      {general}
    </>
  );
}
