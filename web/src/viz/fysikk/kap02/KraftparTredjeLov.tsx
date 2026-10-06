import { memo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useTextScale,
} from '../../kit';
import { Bord, ForceArrow, Panelovn, Rom, SCENE, Stikkontakt, ValueTag, useStrokeScale } from '../../kit/scene';
import { Blyant, Bok, Hand, JordSnitt, Vegghylle, VinduUtsnitt } from './kraftpar-deler';
import { EARTH_MASS, TEXTBOOK, bookOnTable, bookThickness, type BookResult } from './model';
import { useNarrow } from './useNarrow';

type Mode = 'alle' | 'gravitasjon' | 'normal' | 'dytt' | 'frilegeme';

const MODES: { value: Mode; label: string }[] = [
  { value: 'alle', label: 'Alle kraftparene' },
  { value: 'gravitasjon', label: 'Gravitasjonsparet' },
  { value: 'normal', label: 'Normalkraftparet' },
  { value: 'dytt', label: 'Dyttparet' },
  { value: 'frilegeme', label: 'Frilegemediagram for boka' },
];

/** Kreftene i figuren: G og N på boka, G′ på jorda, N′ på bordet, F på boka og F′ på hånda. */
type ForceId = 'G' | 'G2' | 'N' | 'N2' | 'F' | 'F2';

/** Hardt mellomrom mellom tall og enhet, så de ikke deles over to linjer. */
const NB = '\u00a0';

/** Nedtonede krefter når ett kraftpar vises. */
const FADED = 0.13;

/* ---------- Scenen: én fast skala for lengder og én for krefter ---------- */

const W = 800;
const H = 722;
/**
 * Piksler per meter i rommet: boka er 26 cm lang, skrivebordet 100 cm bredt og 72 cm høyt, hånda ca. 19 cm lang og
 * vinduskarmen 90 cm over gulvet. Under bruddlinja er avstanden ned til jordas sentrum (6 370 km) ikke i målestokk.
 */
const PX_PER_M = 420;
/** Piksler per newton for alle kreftene, også G′ i jordas sentrum (N er høyst 2,5 kg · 9,81 m/s² + 10 N = 34,5 N, altså 173 px). */
const PX_PER_N = 5;
/** Største normalkraft på glidebryterne (2,5 kg og 10 N dytt), så skiltet under bordet kan stå fast under den lengste N′-pila. */
const N_MAX = bookOnTable(2.5, 10).N;
/** Overflaten av bordplata, der boka ligger. */
const TABLE_TOP = 190;
const DESK_W = 1.0 * PX_PER_M;
const DESK_H = 0.72 * PX_PER_M;
/** Der veggen møter gulvet (bak bordet), og forkanten av gulvet der snittet begynner. */
const WALL_FOOT = 456;
const FLOOR_FRONT = 520;
/** Bruddlinja i grunnen og jordas sentrum (spissen av kilen), rett under boka. */
const BREAK = 568;
const EARTH = { x: 400, y: H - 18 };
const BOOK_X = 400;
const BOOK_W = TEXTBOOK.length * PX_PER_M;
/**
 * Hvor kreftene angriper (x): N til venstre på boka og N′ litt til høyre for den (begge i kontaktflaten, forskjøvet
 * så de ikke ser ut som én dobbelpil), G midt på, F under håndflata og F′ ved hælen på hånda, så den peker opp i
 * håndleddet. F og F′ står godt fra hverandre, så de ikke ser ut som én dobbelpil.
 */
const X_N = 356;
const X_N2 = 373;
const X_G = 400;
const X_F = 414;
const X_F2 = 450;
/** Korteste pil for F og F′ (figurens enheter): et lite dytt tegnes litt lengre enn målestokken, så paret synes. */
const MIN_F_LEN = 14;
/** Hælen på håndflata. Fingertuppene når ca. 19 cm til venstre (x ≈ 370). */
const HAND_X = 450;
/** Etikettene til dyttparet står til høyre for underarmen. */
const X_F_LABEL = 496;
/** Avstanden mellom de to tekstlinjene i en kraftetikett (ganges med tekstskaleringen). */
const LINE = 16;
/**
 * Øverste kant av skiltet eller sjekklista under bordet: under den lengste G-pila (2,5 kg), og i normalkraftparet
 * under den lengste N′-pila.
 */
const CARD_TOP = 338;
const CARD_TOP_NORMAL = TABLE_TOP + N_MAX * PX_PER_N + 14;

/** Utsnittet på mobil: bordet, boka, hånda, kreftene og kilen ned til jordas sentrum, så de blir store nok. */
const NARROW_VIEW = { x: 180, y: 0, w: 440, h: H };

export default function KraftparTredjeLov() {
  const [mode, setMode] = useState<Mode>('alle');
  const [m, setM] = useState(1.5);
  const [push, setPush] = useState(0);
  const [showForces, setShowForces] = useState(true);
  const r = bookOnTable(m, push);

  // Dyttparet finnes bare når hånda dytter: velger du det uten dytt, presser hånda med 10 N, så pilene blir lange nok.
  const chooseMode = (next: Mode) => {
    if (next === 'dytt' && push === 0) setPush(10);
    setMode(next);
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg hvilke krefter som vises" options={MODES} value={mode} onChange={chooseMode} />
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
      </Toolbar>
      <Controls>
        <Slider label="Masse til boka" value={m} onChange={setM} min={0.5} max={2.5} step={0.1} unit="kg" decimals={1} />
        <Slider label="Dytt fra hånda" value={push} onChange={setPush} min={0} max={10} step={0.5} unit="N" decimals={1} />
      </Controls>

      <DeskScene mode={mode} m={m} r={r} showForces={showForces} />
      <Legend
        items={[
          { color: VIZ.gravity, label: 'Gravitasjon: G og G′' },
          { color: VIZ.normal, label: 'Normalkraft: N og N′' },
          ...(push > 0 ? [{ color: VIZ.applied, label: 'Dytt fra hånda: F og F′' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="G = G′" value={fmt(r.G, 1)} unit="N" tone={VIZ.gravity} />
        <Readout label="N = N′" value={fmt(r.N, 1)} unit="N" tone={VIZ.normal} />
        {push > 0 && mode !== 'gravitasjon' && <Readout label="F = F′" value={fmt(r.F, 1)} unit="N" tone={VIZ.applied} />}
        {mode === 'gravitasjon' ? (
          <Readout label="Akselerasjonen G′ gir jorda" value={fmtSci(r.earthAccel, 1)} unit="m/s²" />
        ) : (
          <Readout label="Kraftsum på boka" value={fmt(Math.abs(r.net) < 0.05 ? 0 : r.net, 1)} unit="N" />
        )}
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          G = mg = {fmt(m, 1)}{NB}kg · 9,81{NB}m/s² = {fmt(r.G, 1)}{NB}N
        </FormulaLine>
        {mode === 'gravitasjon' ? (
          <FormulaLine>
            a = G′/M = {fmt(r.G, 1)}{NB}N / ({fmtSci(EARTH_MASS, 2)}{NB}kg) = {fmtSci(r.earthAccel, 1)}{NB}m/s²
          </FormulaLine>
        ) : (
          <>
            {r.F > 0 ? (
              <>
                <FormulaLine>ΣF = N − G − F = 0 (boka ligger i ro)</FormulaLine>
                <FormulaLine>
                  N = G + F = {fmt(r.G, 1)}{NB}N + {fmt(r.F, 1)}{NB}N = {fmt(r.N, 1)}{NB}N
                </FormulaLine>
              </>
            ) : (
              <>
                <FormulaLine>ΣF = N − G = 0 (boka ligger i ro)</FormulaLine>
                <FormulaLine>
                  N = G = {fmt(r.N, 1)}{NB}N
                </FormulaLine>
              </>
            )}
          </>
        )}
        <FormulaLine>Newtons 3. lov: G′ = G, N′ = N{push > 0 ? ' og F′ = F' : ''}</FormulaLine>
      </Formula>

      <Explain>
        {explanation(mode, r)}
        {showForces && r.F > 0 && r.F * PX_PER_N < MIN_F_LEN && mode !== 'gravitasjon' && mode !== 'normal' && (
          <p>Dyttet er så lite at pilene for F og F′ er tegnet litt lengre enn målestokken, så de synes.</p>
        )}
      </Explain>
    </VizLayout>
  );
}

/* ---------- Scenen ---------- */

interface SceneProps {
  mode: Mode;
  m: number;
  r: BookResult;
  showForces: boolean;
}

function DeskScene(props: SceneProps) {
  const { m, r } = props;
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const view = narrow ? NARROW_VIEW : { x: 0, y: 0, w: W, h: H };
  return (
    <div ref={ref}>
      <Figure
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        label={`En lærebok på ${fmt(m, 1)} kg ligger på et skrivebord i et rom${r.F > 0 ? `, og en hånd presser den ned med ${fmt(r.F, 1)} N` : ''}. Under gulvet er et snitt gjennom grunnen, og under en bruddlinje en kile av jorda ned til jordas sentrum (ikke i målestokk). Kraftparene etter Newtons 3. lov er tegnet som piler.`}
        maxHeight={620}
      >
        <SceneContent {...props} view={view} />
      </Figure>
    </div>
  );
}

/** Hvilke krefter som vises, og hvor sterkt, i hver visning (1 = tydelig, FADED = nedtonet, 0 = skjult). */
function forceOpacity(mode: Mode, id: ForceId): number {
  switch (mode) {
    case 'alle':
      return 1;
    case 'gravitasjon':
      return id === 'G' || id === 'G2' ? 1 : FADED;
    case 'normal':
      return id === 'N' || id === 'N2' ? 1 : FADED;
    case 'dytt':
      return id === 'F' || id === 'F2' ? 1 : FADED;
    case 'frilegeme':
      return id === 'G' || id === 'N' || id === 'F' ? 1 : 0;
  }
}

/** Hvilke gjenstander som er med i det som vises (de andre tones ned). */
function involved(mode: Mode): { table: boolean; hand: boolean; earth: boolean } {
  switch (mode) {
    case 'alle':
      return { table: true, hand: true, earth: true };
    case 'gravitasjon':
      return { table: false, hand: false, earth: true };
    case 'normal':
      return { table: true, hand: false, earth: false };
    case 'dytt':
      return { table: false, hand: true, earth: false };
    case 'frilegeme':
      return { table: false, hand: false, earth: false };
  }
}

function SceneContent({ mode, m, r, showForces, view }: SceneProps & { view: { x: number; y: number; w: number; h: number } }) {
  const f = useTextScale();
  const k = PX_PER_N;
  const t = bookThickness(m) * PX_PER_M;
  const bookTop = TABLE_TOP - t;
  const bookMid = TABLE_TOP - t / 2;
  const on = involved(mode);
  const op = (id: ForceId) => forceOpacity(mode, id);
  const pushing = r.F > 0;
  // Hånda vises når den dytter, og i dyttparet også uten dytt (da holdes den like over boka).
  const showHand = pushing || mode === 'dytt';

  // Spissene og halene til pilene
  const nTip = TABLE_TOP - r.N * k;
  const n2Tip = TABLE_TOP + r.N * k;
  const gTip = bookMid + r.G * k;
  const g2Tip = EARTH.y - r.G * k;
  const fLen = Math.max(r.F * k, MIN_F_LEN);
  const fTail = bookTop - fLen;
  const f2Tip = bookTop - fLen;

  // Tekstplassering: etikettene skal ikke havne oppå bordplata, boka, hånda eller hverandre.
  const deskBottom = TABLE_TOP + 24;
  const nLabelY = Math.min(nTip + 12 * f, bookTop - 6 - LINE * f);
  const n2LabelY = Math.max(n2Tip - LINE * f, deskBottom + 14 * f);
  const gLabelY = Math.max(gTip - LINE * f, deskBottom + 14 * f);
  // F står like over bordplata til høyre for hånda, F′ over den igjen (ved spissen når det er plass).
  const fLabelY = TABLE_TOP - 6 - LINE * f;
  const f2LabelY = Math.min(f2Tip + 12 * f, fLabelY - 24 * f - LINE * f);
  const g2LabelY = Math.min(g2Tip + 12 * f, H - 8 - LINE * f);

  return (
    <g>
      {/* Rommet: vegg med vindu, hylle og panelovn, tregulv, og snittet gjennom grunnen ned til jordas sentrum */}
      <Room />
      <JordSnitt x1={view.x - 2} x2={view.x + view.w + 2} y={FLOOR_FRONT} brudd={BREAK} cx={EARTH.x} cy={EARTH.y} dim={!on.earth} />
      <EarthCentreLabel dim={!on.earth} />

      <Bord x={BOOK_X} y={TABLE_TOP} w={DESK_W} h={DESK_H} type="tre" dim={!on.table} />
      <g opacity={on.table ? 1 : 0.38}>
        <Blyant x={BOOK_X - DESK_W / 2 + 70} y={TABLE_TOP} k={PX_PER_M} />
      </g>
      <Bok x={BOOK_X} y={TABLE_TOP} w={BOOK_W} t={t} perm="rod" />
      {showHand && <Hand x={HAND_X} y={bookTop} k={PX_PER_M} top={view.y} loft={pushing ? 0 : 0.035 * PX_PER_M} genser="gul" dim={!on.hand} />}

      {/* Frilegemediagram: systemgrensen rundt boka */}
      {mode === 'frilegeme' && (
        <rect
          x={BOOK_X - BOOK_W / 2 - 9}
          y={bookTop - 9}
          width={BOOK_W + 18}
          height={t + 15}
          rx={8}
          fill="none"
          stroke={VIZ.ink}
          strokeWidth={1.4}
          strokeDasharray="6 5"
          opacity={0.7}
        />
      )}

      {showForces && (
        <g>
          {/* Gravitasjonsparet: jorda på boka (G) og boka på jorda (G′), som angriper i jordas sentrum */}
          <g opacity={op('G')}>
            <ForceArrow x1={X_G} y1={bookMid} x2={X_G} y2={gTip} color={VIZ.gravity} origin />
            {op('G') === 1 && <ForceText x={X_G + 14} y={gLabelY} anchor="start" color={VIZ.gravity} name="G" value={r.G} what="jorda på boka" />}
          </g>
          {op('G2') > 0 && (
            <g opacity={op('G2')}>
              <ForceArrow x1={EARTH.x} y1={EARTH.y} x2={EARTH.x} y2={g2Tip} color={VIZ.gravity} origin />
              {op('G2') === 1 && <ForceText x={EARTH.x + 14} y={g2LabelY} anchor="start" color={VIZ.gravity} name="G′" value={r.G} what="boka på jorda" />}
            </g>
          )}

          {/* Normalkraftparet: bordet på boka (N) og boka på bordet (N′), begge i kontaktflaten */}
          <g opacity={op('N')}>
            <ForceArrow x1={X_N} y1={TABLE_TOP} x2={X_N} y2={nTip} color={VIZ.normal} />
            {op('N') === 1 && <ForceText x={X_N - 14} y={nLabelY} anchor="end" color={VIZ.normal} name="N" value={r.N} what="bordet på boka" />}
          </g>
          {op('N2') > 0 && (
            <g opacity={op('N2')}>
              <ForceArrow x1={X_N2} y1={TABLE_TOP} x2={X_N2} y2={n2Tip} color={VIZ.normal} />
              {op('N2') === 1 && (
                <ForceText x={X_N2 - 15} y={n2LabelY} anchor="end" color={VIZ.normal} name="N′" value={r.N} what="boka på bordet" />
              )}
            </g>
          )}

          {/* Dyttparet: hånda på boka (F) og boka på hånda (F′) */}
          {pushing && (
            <g opacity={op('F')}>
              <ForceArrow x1={X_F} y1={fTail} x2={X_F} y2={bookTop} color={VIZ.applied} />
              {op('F') === 1 && <ForceText x={X_F_LABEL} y={fLabelY} anchor="start" color={VIZ.applied} name="F" value={r.F} what="hånda på boka" />}
            </g>
          )}
          {pushing && op('F2') > 0 && (
            <g opacity={op('F2')}>
              <ForceArrow x1={X_F2} y1={bookTop} x2={X_F2} y2={f2Tip} color={VIZ.applied} />
              {op('F2') === 1 && <ForceText x={X_F_LABEL} y={f2LabelY} anchor="start" color={VIZ.applied} name="F′" value={r.F} what="boka på hånda" />}
            </g>
          )}
        </g>
      )}

      {/* Hva som vises nå: på veggen under bordet, der ingen piler kommer */}
      {showForces && <ModeCard mode={mode} r={r} />}
    </g>
  );
}

/** Bakgrunnen endres ikke, så den tegnes én gang (memo). */
const Room = memo(function Room() {
  return (
    <g>
      <Rom x={-2} y={0} w={W + 4} h={FLOOR_FRONT} gulvY={WALL_FOOT} gulv="tre" />
      {/* Tingene på veggen er tonet litt mot veggen, så de ikke tar oppmerksomheten fra boka og kreftene */}
      <g opacity={0.85}>
        {/* Vinduskarmen er 90 cm over gulvet; vinduet fortsetter opp og ut av bildet */}
        <VinduUtsnitt x={712} w={124} top={0} bunn={WALL_FOOT - 0.9 * PX_PER_M - 10} />
        {/* Hylla slutter godt til venstre for utsnittet på mobil (x = 180), så ingen blader stikker inn i kanten */}
        <Vegghylle x={12} y={162} w={0.34 * PX_PER_M} k={PX_PER_M} />
        <Stikkontakt x={110} y={WALL_FOOT - 0.3 * PX_PER_M} size={0.08 * PX_PER_M} />
      </g>
      {/* Den hvite lakken på panelovnen tones mer, ellers lyser den i mørkt tema */}
      <g opacity={0.72}>
        <Panelovn x={712} y={WALL_FOOT - 0.16 * PX_PER_M} w={0.4 * PX_PER_M} h={0.28 * PX_PER_M} fotter={false} />
      </g>
    </g>
  );
});

/** «Jordas sentrum» ved spissen av kilen, med hvor langt ned det er. */
function EarthCentreLabel({ dim }: { dim: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  return (
    <g opacity={dim ? 0.45 : 1}>
      <circle cx={EARTH.x} cy={EARTH.y} r={3.2 * ss} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.4 * ss} />
      <Txt x={EARTH.x - 14} y={EARTH.y - 3 * f} anchor="end" size={0.82} weight={680}>
        Jordas sentrum
      </Txt>
      <Txt x={EARTH.x - 14} y={EARTH.y + 12 * f} anchor="end" size={0.74} muted>
        6 370 km under gulvet
      </Txt>
    </g>
  );
}

/** Etikett ved en kraftpil: symbol og verdi på første linje, og hvem som virker på hvem under. */
function ForceText({
  x,
  y,
  anchor,
  color,
  name,
  value,
  what,
}: {
  x: number;
  /** Grunnlinjen til første linje. */
  y: number;
  anchor: 'start' | 'middle' | 'end';
  color: string;
  name: string;
  value: number;
  what: string;
}) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={y} anchor={anchor} color={color} weight={740} size={1}>
        {name} = {fmt(value, 1)} N
      </Txt>
      <Txt x={x} y={y + LINE * f} anchor={anchor} color={color} weight={560} size={0.8}>
        {what}
      </Txt>
    </g>
  );
}

/* ---------- Sjekklista: er de to kreftene et kraftpar? ---------- */

interface Check {
  ok: boolean;
  text: string;
}

interface CardContent {
  title: string;
  color?: string;
  rows: Check[];
}

/** Innholdet i skiltet under bordet: en sjekkliste for kraftparet som vises, eller for G og N i frilegemediagrammet. */
function cardContent(mode: Mode, r: BookResult): CardContent {
  const pair = (title: string, color: string, value: number, dirs: string, bodies: string, kind: string): CardContent => ({
    title,
    color,
    rows: [
      { ok: true, text: `Like store: ${fmt(value, 1)} N` },
      { ok: true, text: `Motsatt rettet: ${dirs}` },
      { ok: true, text: `På hver sin gjenstand: ${bodies}` },
      { ok: true, text: `Samme type kraft: ${kind}` },
    ],
  });
  switch (mode) {
    case 'alle':
      return { title: r.F > 0 ? 'Tre kraftpar, seks krefter' : 'To kraftpar, fire krefter', rows: [] };
    case 'gravitasjon':
      return pair('G og G′ er et kraftpar', VIZ.gravity, r.G, 'ned og opp', 'boka og jorda', 'gravitasjon');
    case 'normal':
      return pair('N og N′ er et kraftpar', VIZ.normal, r.N, 'opp og ned', 'boka og bordet', 'kontaktkraft');
    case 'dytt':
      return r.F > 0
        ? pair('F og F′ er et kraftpar', VIZ.applied, r.F, 'ned og opp', 'boka og hånda', 'kontaktkraft')
        : { title: 'Ingen kontakt, ingen dytt', rows: [] };
    case 'frilegeme':
      return {
        title: 'G og N er ikke et kraftpar',
        rows: [
          r.F > 0 ? { ok: false, text: 'Like store: nei, N er større' } : { ok: true, text: 'Like store: ja, men bare uten dytt' },
          { ok: true, text: 'Motsatt rettet: ned og opp' },
          { ok: false, text: 'På hver sin gjenstand: nei, begge på boka' },
          { ok: false, text: 'Samme type kraft: nei' },
        ],
      };
  }
}

/**
 * Skilt under bordet. Uten rader er det et vanlig verdiskilt; med rader er det en sjekkliste med hake (oppfylt) eller
 * kryss (ikke oppfylt) foran hvert kjennetegn på et kraftpar.
 */
function ModeCard({ mode, r }: { mode: Mode; r: BookResult }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const c = cardContent(mode, r);
  const top = mode === 'normal' ? CARD_TOP_NORMAL : CARD_TOP;
  if (c.rows.length === 0) return <ValueTag x={BOOK_X} y={CARD_TOP_NORMAL + 20} anchor="middle" text={c.title} />;
  const fsTitle = 17 * f * 0.9;
  const fsRow = 17 * f * 0.76;
  const rowH = fsRow * 1.55;
  const padX = 15 * f;
  const glyph = fsRow * 0.95;
  const textW = Math.max(c.title.length * fsTitle * 0.6, ...c.rows.map((row) => row.text.length * fsRow * 0.55 + glyph + 8 * f));
  const w = textW + 2 * padX;
  const h = fsTitle * 1.25 + 10 * f + c.rows.length * rowH + 8 * f;
  const left = BOOK_X - w / 2;
  const titleY = top + 8 * f + fsTitle * 0.95;
  return (
    <g>
      <rect x={left} y={top} width={w} height={h} rx={9} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.96} />
      {c.color && <rect x={left + 5} y={top + 8} width={4 * ss} height={h - 16} rx={2 * ss} fill={c.color} />}
      <Txt x={left + padX} y={titleY} anchor="start" size={0.9} weight={760} color={c.color} halo={false}>
        {c.title}
      </Txt>
      {c.rows.map((row, i) => {
        const yy = titleY + 8 * f + (i + 1) * rowH - fsRow * 0.35;
        const gx = left + padX;
        const gy = yy - fsRow * 0.36;
        const s = glyph * 0.42;
        return (
          <g key={i}>
            {row.ok ? (
              <path
                d={`M${gx},${gy}l${s * 0.75},${s * 0.8}l${s * 1.35},${-s * 1.6}`}
                fill="none"
                stroke={VIZ.ink}
                strokeWidth={2 * ss}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d={`M${gx + s * 0.15},${gy - s * 0.85}l${s * 1.7},${s * 1.7}m0,${-s * 1.7}l${-s * 1.7},${s * 1.7}`}
                fill="none"
                stroke={VIZ.ink}
                strokeWidth={2 * ss}
                strokeLinecap="round"
              />
            )}
            <Txt x={gx + glyph + 8 * f} y={yy} anchor="start" size={0.76} weight={row.ok ? 520 : 720} halo={false}>
              {row.text}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Forklaringen ---------- */

function explanation(mode: Mode, r: BookResult): ReactNode {
  const { G, N, F, earthAccel } = r;
  switch (mode) {
    case 'alle':
      return (
        <>
          <p>
            <strong>{F > 0 ? 'Tre kraftpar, seks krefter.' : 'To kraftpar, fire krefter.'}</strong> Jorda trekker boka ned (G), og boka
            trekker jorda opp (G′). Bordet presser boka opp (N), og boka presser bordet ned (N′).
            {F > 0 && <> Hånda presser boka ned (F), og boka presser hånda opp (F′).</>} Kreftene i et par er like store, motsatt rettet og
            virker på <em>hver sin</em> gjenstand. Derfor kan de aldri oppheve hverandre på én gjenstand.
          </p>
          <p>
            Velg et av parene for å se det alene, med en sjekkliste over kjennetegnene.{' '}
            {F > 0
              ? 'Det er derfor du kjenner boka mot hånda: kraften du kjenner, er F′ fra boka, og den er like stor som dyttet ditt.'
              : 'Dytt på boka med hånda, så kommer et tredje kraftpar til.'}
          </p>
        </>
      );
    case 'gravitasjon':
      return (
        <p>
          Jorda trekker boka nedover med G = {fmt(G, 1)} N. Samtidig trekker boka hele jorda oppover med like stor kraft, G′ = {fmt(G, 1)} N.
          G′ virker på jorda som helhet, så vi tegner den i jordas sentrum, 6 370 km under gulvet (kilen under bruddlinja er ikke i
          målestokk). Paret finnes enten boka ligger på bordet
          eller faller. Hvorfor merker vi ikke at jorda trekkes mot boka? Massen til jorda er enorm, så G′ alene ville gitt jorda
          akselerasjonen a = G′/M ≈ {fmtSci(earthAccel, 1)} m/s². Det er derfor det er boka som faller når du dytter den ut over kanten av
          bordet, og ikke jorda som kommer opp til boka.
        </p>
      );
    case 'normal':
      return (
        <p>
          Boka og bordplata presser mot hverandre der de er i kontakt. Bordet dytter boka opp med N = {fmt(N, 1)} N, og boka dytter bordet ned
          med like stor kraft N′.{' '}
          {F > 0
            ? 'Når hånda dytter på boka, presses flatene hardere sammen, og begge kreftene i paret blir større.'
            : 'Dytt på boka med hånda, så presses flatene hardere sammen, og begge kreftene i paret blir større.'}{' '}
          Det er derfor en skjør hylle kan knekke under en stabel tunge bøker: N′ virker på hylla, og den vokser med tyngden av bøkene og med
          dyttet ditt.
        </p>
      );
    case 'dytt':
      return F > 0 ? (
        <p>
          Hånda presser boka ned med F = {fmt(F, 1)} N, og boka presser hånda opp med F′ = {fmt(F, 1)} N. Det er F′ du kjenner i
          håndflata. Kreftene er like store hele tiden, uansett hvor hardt du presser. Det er derfor det gjør vondt å slå hånda i bordet: jo
          hardere du slår, jo hardere slår bordet tilbake.
        </p>
      ) : (
        <p>
          Nå holder du hånda like over boka uten å røre den. Da dytter ikke hånda på boka, og boka dytter ikke på hånda: uten kontakt finnes ikke
          dette kraftparet. Kontaktkrefter oppstår alltid i par når to gjenstander presser mot hverandre. Dra i «Dytt fra hånda» for å presse
          boka ned.
        </p>
      );
    case 'frilegeme':
      return (
        <p>
          Her er bare kreftene som virker <em>på</em> boka. Boka ligger i ro, så kraftsummen er null (Newtons 1. lov):{' '}
          {F > 0 ? `N = G + F = ${fmt(G, 1)} N + ${fmt(F, 1)} N = ${fmt(N, 1)} N.` : `N = G = ${fmt(G, 1)} N.`} G og N er likevel{' '}
          <strong>ikke</strong> et kraftpar etter Newtons 3. lov: begge virker på boka, og de er ulike typer krefter fra hver sin gjenstand
          (gravitasjon fra jorda og kontaktkraft fra bordet). Paret til G er G′ på jorda, og paret til N er N′ på bordet.{' '}
          {F > 0 ? 'Når hånda dytter, blir N større enn G, så de er ikke engang like store.' : 'Dytt på boka med hånda, så ser du at N kan bli større enn G.'}
        </p>
      );
  }
}
