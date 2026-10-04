import { useState, type ReactNode } from 'react';
import {
  Arrow,
  Block,
  Controls,
  Explain,
  Figure,
  Label,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
} from '../../kit';
import { bookOnTable } from './model';

type Mode = 'alle' | 'gravitasjon' | 'normal' | 'frilegeme';

const MODES: { value: Mode; label: string }[] = [
  { value: 'alle', label: 'Alle fire kreftene' },
  { value: 'gravitasjon', label: 'Gravitasjonsparet' },
  { value: 'normal', label: 'Normalkraftparet' },
  { value: 'frilegeme', label: 'Frilegemediagram for boka' },
];

/** Piksler per newton. */
const K = 3.2;
const FADED = 0.12;

// Geometri (viewBox 800 × 480)
const BOOK = { x: 340, y: 100, w: 120, h: 50 };
const BOOK_CY = BOOK.y + BOOK.h / 2;
const BOOK_BOTTOM = BOOK.y + BOOK.h;
const TABLE_TOP = 230;
const X_GRAV = 375;
const X_NORM = 425;
const X_HAND = 352;

/** Jordoverflaten er en kvadratisk Bézier fra (80, 480) via (400, 320) til (720, 480). */
function earthSurfaceY(x: number): number {
  const t = (x - 80) / 640;
  return 480 - 320 * t * (1 - t);
}

export default function KraftparTredjeLov() {
  const [mode, setMode] = useState<Mode>('alle');
  const [m, setM] = useState(1.5);
  const [push, setPush] = useState(0);
  const r = bookOnTable(m, push);

  const show = (kind: 'grav' | 'norm' | 'hand' | 'grav2' | 'norm2'): number => {
    if (mode === 'alle') return 1;
    if (mode === 'gravitasjon') return kind === 'grav' || kind === 'grav2' ? 1 : FADED;
    if (mode === 'normal') return kind === 'norm' || kind === 'norm2' ? 1 : FADED;
    return kind === 'grav2' || kind === 'norm2' ? 0 : 1;
  };
  const otherBodies = mode === 'frilegeme' ? 0.25 : 1;
  const earthY = earthSurfaceY(X_GRAV);
  const gLen = r.G * K;
  const nLen = r.N * K;
  const hLen = push * K;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg hvilke krefter som vises" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      <Controls>
        <Slider label="Masse til boka" value={m} onChange={setM} min={0.5} max={2.5} step={0.1} unit="kg" decimals={1} />
        <Slider label="Dytt fra hånda" value={push} onChange={setPush} min={0} max={10} step={0.5} unit="N" decimals={1} />
      </Controls>

      <Figure viewBox="0 0 800 480" label="Bok som ligger på et bord som står på jorda, med kreftene mellom dem" maxHeight={480}>
        {/* Jorda og bordet */}
        <g opacity={otherBodies}>
          <path d="M 80 480 Q 400 320 720 480 Z" fill={VIZ.body} className="viz-block" />
          <Label x={560} y={462} muted>
            jorda
          </Label>
          <rect x={230} y={TABLE_TOP} width={340} height={30} rx={4} fill={VIZ.bodyStrong} className="viz-block" />
          <rect x={250} y={TABLE_TOP + 30} width={16} height={74} fill={VIZ.bodyStrong} className="viz-block" />
          <rect x={534} y={TABLE_TOP + 30} width={16} height={74} fill={VIZ.bodyStrong} className="viz-block" />
          <Label x={300} y={TABLE_TOP + 21}>
            bordet
          </Label>
        </g>
        <Block x={BOOK.x} y={BOOK.y} w={BOOK.w} h={BOOK.h} />
        <Label x={BOOK.x + BOOK.w / 2} y={BOOK_CY + 6}>
          boka
        </Label>

        {/* Gravitasjonsparet */}
        <g opacity={show('grav')}>
          <Arrow x1={X_GRAV} y1={BOOK_CY} x2={X_GRAV} y2={BOOK_CY + gLen} color={VIZ.gravity} />
          <ForceLabel x={X_GRAV - 12} y={BOOK_CY + gLen - 2} anchor="end" name="G" what="jorda på boka" color={VIZ.gravity} />
        </g>
        <g opacity={show('grav2')}>
          <Arrow x1={X_GRAV} y1={earthY} x2={X_GRAV} y2={earthY - gLen} color={VIZ.gravity} />
          <ForceLabel x={X_GRAV - 12} y={earthY - gLen + 14} anchor="end" name="G′" what="boka på jorda" color={VIZ.gravity} />
        </g>

        {/* Normalkraftparet */}
        <g opacity={show('norm')}>
          <Arrow x1={X_NORM} y1={BOOK_BOTTOM} x2={X_NORM} y2={BOOK_BOTTOM - nLen} color={VIZ.normal} />
          <ForceLabel x={X_NORM + 12} y={Math.min(BOOK_BOTTOM - nLen + 14, BOOK.y - 8)} anchor="start" name="N" what="bordet på boka" color={VIZ.normal} />
        </g>
        <g opacity={show('norm2')}>
          <Arrow x1={X_NORM} y1={TABLE_TOP} x2={X_NORM} y2={TABLE_TOP + nLen} color={VIZ.normal} />
          <ForceLabel x={X_NORM + 12} y={TABLE_TOP + nLen} anchor="start" name="N′" what="boka på bordet" color={VIZ.normal} />
        </g>

        {/* Dytt fra hånda (paret virker på hånda, som ikke er tegnet) */}
        {push > 0 && (
          <g opacity={show('hand')}>
            <Arrow x1={X_HAND} y1={BOOK.y - hLen} x2={X_HAND} y2={BOOK.y} color={VIZ.applied} />
            <ForceLabel x={X_HAND - 12} y={BOOK.y - hLen / 2 + 6} anchor="end" name="F" what="hånda på boka" color={VIZ.applied} />
          </g>
        )}
      </Figure>
      <Legend
        items={[
          { color: VIZ.gravity, label: 'Gravitasjon' },
          { color: VIZ.normal, label: 'Normalkraft' },
          ...(push > 0 ? [{ color: VIZ.applied, label: 'Dytt fra hånda' }] : []),
        ]}
      />

      <Readouts>
        <Readout label="G = G′" value={fmt(r.G, 1)} unit="N" tone={VIZ.gravity} />
        <Readout label="N = N′" value={fmt(r.N, 1)} unit="N" tone={VIZ.normal} />
        {mode === 'gravitasjon' ? (
          <Readout label="Akselerasjonen jorda får" value={fmtSci(r.earthAccel, 1)} unit="m/s²" />
        ) : (
          <Readout label="Kraftsum på boka" value={fmt(r.N - r.G - push, 1)} unit="N" />
        )}
      </Readouts>

      <Explain>{explanation(mode, r.G, r.N, push, r.earthAccel)}</Explain>
    </VizLayout>
  );
}

function ForceLabel({ x, y, anchor, name, what, color }: { x: number; y: number; anchor: 'start' | 'end'; name: string; what: string; color: string }) {
  return (
    <Label x={x} y={y} anchor={anchor} color={color}>
      {name}
      <tspan className="is-muted" dx={6}>
        ({what})
      </tspan>
    </Label>
  );
}

function explanation(mode: Mode, G: number, N: number, push: number, earthAccel: number): ReactNode {
  switch (mode) {
    case 'alle':
      return (
        <p>
          <strong>Fire krefter, to par.</strong> Oransje er gravitasjon, blått er normalkraft. Kreftene i et par er like store,
          motsatt rettet og virker på <em>hver sin</em> gjenstand. Derfor kan de aldri oppheve hverandre. Velg et av parene for å se
          det alene.
        </p>
      );
    case 'gravitasjon':
      return (
        <p>
          Jorda trekker boka nedover med G = {fmt(G, 1)} N. Samtidig trekker boka jorda oppover med like stor kraft, G′ ={' '}
          {fmt(G, 1)} N. Vi merker ikke at jorda trekkes mot boka fordi massen til jorda er enorm: a = G′/M ≈{' '}
          {fmtSci(earthAccel, 1)} m/s².
        </p>
      );
    case 'normal':
      return (
        <p>
          Boka og bordet presses mot hverandre. Bordet dytter boka opp med N = {fmt(N, 1)} N, og boka dytter bordet ned med like
          stor kraft N′. {push > 0 ? 'Når hånda dytter på boka, presses flatene hardere sammen, og begge kreftene i paret blir større.' : 'Prøv å dytte på boka med hånda: begge kreftene i paret blir større.'}
        </p>
      );
    case 'frilegeme':
      return (
        <p>
          Her er bare kreftene som virker <em>på</em> boka. Boka ligger i ro, så kraftsummen er null (Newtons 1. lov):{' '}
          {push > 0 ? `N = G + F = ${fmt(G, 1)} N + ${fmt(push, 1)} N = ${fmt(N, 1)} N.` : `N = G = ${fmt(G, 1)} N.`} G og N er likevel{' '}
          <strong>ikke</strong> et kraftpar etter Newtons 3. lov: begge virker på boka, og de har ulik opprinnelse.{' '}
          {push > 0 ? 'Kraftparet til dyttet virker på hånda.' : 'Dytt på boka med hånda, så ser du at N kan bli større enn G.'}
        </p>
      );
  }
}
