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
import { Bord, ForceArrow, Himmel, Landskap, Lauvtre, Underlag, ValueTag, useSvgId } from '../../kit/scene';
import { Bok, Hand } from './kraftpar-deler';
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
const H = 550;
/** Piksler per meter: boka er 26 cm lang, hagebordet 75 cm bredt og 45 cm høyt, hånda ca. 19 cm lang. */
const PX_PER_M = 600;
/** Piksler per newton for alle kreftene (N er høyst 2,5 kg · 9,81 m/s² + 10 N = 34,5 N, altså 138 px). */
const PX_PER_N = 4;
/** Overflaten av bordplata, der boka ligger. */
const TABLE_TOP = 160;
const TABLE_W = 0.75 * PX_PER_M;
const TABLE_H = 0.45 * PX_PER_M;
/** Gressplenen der bordbeina står. Under plenen er et snitt av jorda. */
const LAWN = TABLE_TOP + TABLE_H;
/** Horisonten: vi ser bordet rett fra siden, så øyehøyden (og horisonten) er omtrent ved bordplata. */
const HORIZON = TABLE_TOP + 10;
const BOOK_X = 400;
const BOOK_W = TEXTBOOK.length * PX_PER_M;
/** Hvor kreftene angriper (x): N og N′ til venstre på boka, G og G′ midt på, F og F′ under håndflata. */
const X_N = 333;
const X_G = 400;
const X_F = 424;
const X_F2 = 457;
/** Hælen på håndflata. */
const HAND_X = 468;
/** Avstanden mellom de to tekstlinjene i en kraftetikett (ganges med tekstskaleringen). */
const LINE = 16;

/** Utsnittet på mobil: bordet, boka, hånda og kreftene, så de blir store nok. */
const NARROW_VIEW = { x: 170, y: 8, w: 460, h: H - 8 };

export default function KraftparTredjeLov() {
  const [mode, setMode] = useState<Mode>('alle');
  const [m, setM] = useState(1.5);
  const [push, setPush] = useState(0);
  const [showForces, setShowForces] = useState(true);
  const r = bookOnTable(m, push);

  // Dyttparet finnes bare når hånda dytter: velger du det uten dytt, presser hånda med 5 N.
  const chooseMode = (next: Mode) => {
    if (next === 'dytt' && push === 0) setPush(5);
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

      <BookScene mode={mode} m={m} r={r} showForces={showForces} />
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
            <FormulaLine>ΣF = N − G − F = 0 (boka ligger i ro)</FormulaLine>
            <FormulaLine>
              N = G + F = {fmt(r.G, 1)}{NB}N + {fmt(r.F, 1)}{NB}N = {fmt(r.N, 1)}{NB}N
            </FormulaLine>
          </>
        )}
        <FormulaLine>Newtons 3. lov: G′ = G, N′ = N{push > 0 ? ' og F′ = F' : ''}</FormulaLine>
      </Formula>

      <Explain>{explanation(mode, r)}</Explain>
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

function BookScene(props: SceneProps) {
  const { m, r } = props;
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const view = narrow ? NARROW_VIEW : { x: 0, y: 0, w: W, h: H };
  return (
    <div ref={ref}>
      <Figure
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        label={`En lærebok på ${fmt(m, 1)} kg ligger på et hagebord som står på plenen${r.F > 0 ? `, og en hånd presser den ned med ${fmt(r.F, 1)} N` : ''}. Under plenen er et snitt av jorda. Kraftparene etter Newtons 3. lov er tegnet som piler.`}
        maxHeight={520}
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

/** Hvilke gjenstander som er med i det som vises (de andre tones ned). Jorda er bakgrunnen, og tones bare ned i frilegemediagrammet. */
function involved(mode: Mode): { table: boolean; hand: boolean; earth: boolean } {
  switch (mode) {
    case 'alle':
      return { table: true, hand: true, earth: true };
    case 'gravitasjon':
      return { table: false, hand: false, earth: true };
    case 'normal':
      return { table: true, hand: false, earth: true };
    case 'dytt':
      return { table: false, hand: true, earth: true };
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
  const g2Tail = H - 10;
  const g2Tip = g2Tail - r.G * k;
  const fTail = bookTop - r.F * k;
  const f2Tip = bookTop - r.F * k;

  // Tekstplassering: etikettene skal ikke havne oppå bordplata, boka eller snittkanten.
  const tableBottom = TABLE_TOP + 24;
  const nLabelY = Math.min(nTip + 12 * f, bookTop - 6 - LINE * f);
  const n2LabelY = Math.max(n2Tip - LINE * f, tableBottom + 14 * f);
  const gLabelY = Math.max(gTip - LINE * f, tableBottom + 14 * f);
  const g2LabelY = Math.min(g2Tip + 12 * f, H - 8 - LINE * f);
  const fLabelY = fTail - 14 - LINE * f;
  const f2LabelY = f2Tip + 12 * f;

  const tag = modeTag(mode, r);

  return (
    <g>
      {/* Hagen: himmel, åser, et epletre og plenen, med et snitt av jorda under */}
      <g opacity={on.earth ? 1 : 0.5}>
        <Garden />
        <ValueTag x={view.x + 16} y={LAWN + 40 * Math.max(1, f * 0.9)} anchor="start" text="Jorda: radius 6 370 km" size={0.8} />
      </g>
      <Bord x={BOOK_X} y={TABLE_TOP} w={TABLE_W} h={TABLE_H} type="tre" dim={!on.table} />
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
          {/* Gravitasjonsparet: jorda på boka (G) og boka på jorda (G′) */}
          <g opacity={op('G')}>
            <ForceArrow x1={X_G} y1={bookMid} x2={X_G} y2={gTip} color={VIZ.gravity} origin />
            <ForceText x={X_G + 12} y={gLabelY} anchor="start" color={VIZ.gravity} name="G" value={r.G} what="jorda på boka" />
          </g>
          {op('G2') > 0 && (
            <g opacity={op('G2')}>
              <ForceArrow x1={X_G} y1={g2Tail} x2={X_G} y2={g2Tip} color={VIZ.gravity} origin />
              <ForceText x={X_G + 12} y={g2LabelY} anchor="start" color={VIZ.gravity} name="G′" value={r.G} what="boka på jorda" />
            </g>
          )}

          {/* Normalkraftparet: bordet på boka (N) og boka på bordet (N′), begge i kontaktflaten */}
          <g opacity={op('N')}>
            <ForceArrow x1={X_N} y1={TABLE_TOP} x2={X_N} y2={nTip} color={VIZ.normal} />
            <ForceText x={X_N - 12} y={nLabelY} anchor="end" color={VIZ.normal} name="N" value={r.N} what="bordet på boka" />
          </g>
          {op('N2') > 0 && (
            <g opacity={op('N2')}>
              <ForceArrow x1={X_N} y1={TABLE_TOP} x2={X_N} y2={n2Tip} color={VIZ.normal} />
              <ForceText x={X_N - 12} y={n2LabelY} anchor="end" color={VIZ.normal} name="N′" value={r.N} what="boka på bordet" />
            </g>
          )}

          {/* Dyttparet: hånda på boka (F) og boka på hånda (F′) */}
          {pushing && (
            <g opacity={op('F')}>
              <ForceArrow x1={X_F} y1={fTail} x2={X_F} y2={bookTop} color={VIZ.applied} />
              <ForceText x={X_F} y={fLabelY} anchor="middle" color={VIZ.applied} name="F" value={r.F} what="hånda på boka" />
            </g>
          )}
          {pushing && op('F2') > 0 && (
            <g opacity={op('F2')}>
              <ForceArrow x1={X_F2} y1={bookTop} x2={X_F2} y2={f2Tip} color={VIZ.applied} />
              <ForceText x={X_F2 + 12} y={f2LabelY} anchor="start" color={VIZ.applied} name="F′" value={r.F} what="boka på hånda" />
            </g>
          )}
        </g>
      )}

      {/* Hva som vises nå: på plenen under bordet, der ingen piler kommer */}
      {showForces && <ValueTag x={BOOK_X} y={LAWN - 34} anchor="middle" text={tag.text} color={tag.color} />}
    </g>
  );
}

/** Bakgrunnen endres ikke, så den tegnes én gang (memo). */
const Garden = memo(function Garden() {
  const clip = useSvgId('kp-hage');
  return (
    <g clipPath={`url(#${clip})`}>
      {/* Landskapet er bredere enn figuren; klipp det, så det ikke synes ved siden av figuren på brede skjermer. */}
      <clipPath id={clip}>
        <rect x={0} y={0} width={W} height={H} />
      </clipPath>
      <Himmel w={W} h={HORIZON + 2} sol={{ x: 700, y: 64, r: 24 }} skyer={2} seed={5} />
      {/* Gården i åsen havner til høyre for bordet (x ≈ 730), ikke bak bordplata der den kunne se ut som en ting på bordet */}
      <Landskap x={-100} y={HORIZON} w={1000} h={90} type="aaser" seed={3} />
      <Underlag x1={0} x2={W} y={LAWN} depth={H - LAWN} type="gress" horisont={HORIZON} />
      {/* Epletreet står noen meter unna, så det er mindre enn i samme skala som bordet */}
      <Lauvtre x={74} y={HORIZON + 20} size={128} epler seed={3} />
    </g>
  );
});

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

function modeTag(mode: Mode, r: BookResult): { text: string; color?: string } {
  switch (mode) {
    case 'alle':
      return { text: r.F > 0 ? 'Tre kraftpar, seks krefter' : 'To kraftpar, fire krefter' };
    case 'gravitasjon':
      return { text: `G = G′ = ${fmt(r.G, 1)} N`, color: VIZ.gravity };
    case 'normal':
      return { text: `N = N′ = ${fmt(r.N, 1)} N`, color: VIZ.normal };
    case 'dytt':
      return r.F > 0 ? { text: `F = F′ = ${fmt(r.F, 1)} N`, color: VIZ.applied } : { text: 'Ingen kontakt, ingen dytt' };
    case 'frilegeme':
      return { text: 'Kraftsum på boka: 0 N' };
  }
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
            virker på <em>hver sin</em> gjenstand. Derfor kan de aldri oppheve hverandre.
          </p>
          <p>
            Velg et av parene for å se det alene. {F > 0 ? 'Det er derfor du kjenner boka mot hånda: kraften du kjenner, er F′ fra boka, og den er like stor som dyttet ditt.' : 'Dytt på boka med hånda, så kommer et tredje kraftpar til.'}
          </p>
        </>
      );
    case 'gravitasjon':
      return (
        <p>
          Jorda trekker boka nedover med G = {fmt(G, 1)} N. Samtidig trekker boka jorda oppover med like stor kraft, G′ = {fmt(G, 1)} N.
          Paret finnes enten boka ligger på bordet eller faller. Hvorfor merker vi ikke at jorda trekkes mot boka? Massen til jorda er enorm,
          så G′ alene ville gitt jorda akselerasjonen a = G′/M ≈ {fmtSci(earthAccel, 1)} m/s². Det er derfor det er boka som faller når du
          slipper den, og ikke jorda som kommer opp til boka.
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
          Det er derfor et skjørt bord kan knekke under en stabel tunge bøker: N′ virker på bordet, og den vokser med tyngden av bøkene og med
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
          <strong>ikke</strong> et kraftpar etter Newtons 3. lov: begge virker på boka, og de kommer fra hver sin gjenstand (jorda og bordet).
          Paret til G er G′ på jorda, og paret til N er N′ på bordet.{' '}
          {F > 0 ? 'Når hånda dytter, blir N større enn G, så de er ikke engang like store.' : 'Dytt på boka med hånda, så ser du at N kan bli større enn G.'}
        </p>
      );
  }
}
