/**
 * Energinivådiagrammet i «Nordlys»: overgangene i oksygenatomet (grønt og rødt) og i nitrogenionet N₂⁺
 * (blåfiolett) på samme energiskala, så lengden på pilene kan sammenlignes, og spekteret nordlyset gir.
 * Brukes inne i en <Figure> (tekst og strektykkelser følger mobilskaleringen).
 */
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Elektron, Foton, SCENE, Spektrum, bolgelengdeFarge, shade, useSceneScale, useStrokeScale } from '../../kit/scene';
import { LINES, LINE_ORDER, lightenRgb, oxygenLevels, parseRgb, photonFromNm, rgbText, transitionLevels, type LineId } from './model-nordlys';
import { ELEKTRON_FARGE } from './nordlys-deler';

const DIM = 0.32;

interface LevelsLayout {
  /** Panelene under hverandre (mobil) i stedet for ved siden av hverandre. */
  stacked: boolean;
  /** px per eV, lik for begge panelene. */
  k: number;
  oBox: PanelBox;
  nBox: PanelBox;
  /** Øverste kant av spekteret og høyden på stripa. */
  specY: number;
  specH: number;
  /** Høyden på hele figuren (viewBox). */
  H: number;
}

/** Plasseringen av panelene for tekstskaleringen `f` (ved siden av hverandre på PC, under hverandre på mobil). */
export function levelsLayout(f: number): LevelsLayout {
  const o = oxygenLevels();
  const up = transitionLevels('blaa').upper;
  const stacked = f > 1.3;
  const specH = 30 * Math.max(1, f * 0.8);
  if (stacked) {
    const k = 60;
    const head = 44 * f;
    const oBox = { x: 0, y: 0, w: 800, base: head + o.second * k + 30 };
    const nY = oBox.base + 58 * f;
    const nBox = { x: 0, y: nY, w: 800, base: nY + head + up * k + 30 };
    const specY = nBox.base + 80 * f;
    return { stacked, k, oBox, nBox, specY, specH, H: Math.round(specY + specH + 30 * f + 6) };
  }
  const k = 52;
  const base = 40 * f + o.second * k + 28;
  const specY = base + 88 * f;
  return {
    stacked,
    k,
    oBox: { x: 0, y: 0, w: 480, base },
    nBox: { x: 490, y: 0, w: 310, base },
    specY,
    specH,
    H: Math.round(specY + specH + 30 * f + 6),
  };
}

/** Tekst om hvor lenge nivået lever: «ca. 0,7 s», «ca. 110 s», «ca. 70 ns». */
export function lifetimeText(id: LineId): string {
  const tau = LINES[id].lifetime;
  if (tau >= 10) return `ca. ${fmt(tau, 0)} s`;
  if (tau >= 0.1) return `ca. ${fmt(tau, 1)} s`;
  return `ca. ${fmt(tau * 1e9, 0)} ns`;
}

interface PanelBox {
  x: number;
  y: number;
  w: number;
  /** y for 0 eV (nederste nivå). */
  base: number;
}

/** Tykk pil for en overgang nedover, i fotonets farge med mørk kant (lyse farger synes også på hvit bunn). */
function TransitionArrow({ x, y1, y2, color, dim }: { x: number; y1: number; y2: number; color: string; dim: boolean }) {
  const ss = useStrokeScale();
  const hl = 13 * ss;
  const hw = 7.5 * ss;
  const dir = y2 > y1 ? 1 : -1;
  const by = y2 - dir * hl;
  const edge = shade(color, 0.45);
  return (
    <g opacity={dim ? DIM : 1}>
      <line x1={x} y1={y1} x2={x} y2={by} stroke={edge} strokeWidth={6.4 * ss} strokeLinecap="round" />
      <line x1={x} y1={y1} x2={x} y2={by} stroke={color} strokeWidth={4 * ss} strokeLinecap="round" />
      <path d={`M${x} ${y2}L${x - hw} ${by}L${x + hw} ${by}Z`} fill={color} stroke={edge} strokeWidth={1.2 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Stiplet pil oppover: et elektron fra solvinden støter og løfter atomet (ionet) opp. */
function ExcitationArrow({ x, y1, y2, dim, label }: { x: number; y1: number; y2: number; dim: boolean; label: string }) {
  const ss = useStrokeScale();
  const s = useSceneScale();
  const f = useTextScale();
  const hl = 11 * ss;
  const hw = 6 * ss;
  const by = y2 + hl;
  return (
    <g opacity={dim ? DIM : 1}>
      <line x1={x} y1={y1} x2={x} y2={by} stroke={ELEKTRON_FARGE} strokeWidth={2.4 * ss} strokeDasharray={`${7 * ss} ${5 * ss}`} />
      <path d={`M${x} ${y2}L${x - hw} ${by}L${x + hw} ${by}Z`} fill={ELEKTRON_FARGE} />
      <Elektron x={x - 16 * s} y={y1 + 14 * s} r={6 * s} />
      <Txt x={x - 4 * s} y={y1 + 14 * s + 24 * f * 0.78} anchor="middle" size={0.72} muted>
        {label}
      </Txt>
    </g>
  );
}

/**
 * Ett energinivå. Med `label` (energien) står merknaden (levetiden) under energien til venstre, ellers til høyre for
 * streken (der fotonene ikke går).
 */
function Level({ x1, x2, y, label, note, dim, f }: { x1: number; x2: number; y: number; label?: string; note: string; dim: boolean; f: number }) {
  const ss = useStrokeScale();
  return (
    <g opacity={dim ? 0.55 : 1}>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={VIZ.ink} strokeWidth={2.6 * ss} strokeLinecap="round" />
      {label && (
        <Txt x={x1 - 10} y={y + 6 * f} anchor="end" size={0.8} weight={650}>
          {label}
        </Txt>
      )}
      {label ? (
        <Txt x={x1 - 10} y={y + 6 * f + 17 * f * 0.9} anchor="end" size={0.68} muted>
          {note}
        </Txt>
      ) : (
        <Txt x={x2 + 10} y={y + 6 * f} anchor="start" size={0.72} muted>
          {note}
        </Txt>
      )}
    </g>
  );
}

function photonLabel(id: LineId): string {
  const p = photonFromNm(LINES[id].nm);
  return `${fmt(LINES[id].nm, 1)} nm · ${fmt(p.eV, 2)} eV`;
}

/** Oksygenatomet: tre nivåer, grønt fra nivå 2 til 1 og rødt fra 1 til grunntilstanden. */
function OxygenPanel({ box, k, selected, f, t }: { box: PanelBox; k: number; selected: LineId; f: number; t: number }) {
  const o = oxygenLevels();
  const yE = (E: number) => box.base - E * k;
  const lx1 = box.x + 118 * f + 6;
  const lx2 = lx1 + Math.max(150, box.w * 0.36);
  const ax = lx1 + (lx2 - lx1) * 0.55;
  const exX = lx1 + (lx2 - lx1) * 0.17;
  const oDim = selected === 'blaa';
  const upper = selected === 'rod' ? o.first : o.second;
  const items: { id: LineId; from: number; to: number }[] = [
    { id: 'gronn', from: o.second, to: o.first },
    { id: 'rod', from: o.first, to: o.ground },
  ];
  return (
    <g>
      <Txt x={box.x + 10} y={box.y + 26 * f} anchor="start" size={0.9} weight={700}>
        Oksygenatom (O)
      </Txt>
      <Level x1={lx1} x2={lx2} y={yE(o.second)} label={`${fmt(o.second, 2)} eV`} note={`lever ${lifetimeText('gronn')}`} dim={oDim} f={f} />
      <Level x1={lx1} x2={lx2} y={yE(o.first)} label={`${fmt(o.first, 2)} eV`} note={`lever ${lifetimeText('rod')}`} dim={oDim} f={f} />
      <Level x1={lx1} x2={lx2} y={yE(0)} label="0 eV" note="grunntilstand" dim={oDim} f={f} />
      <ExcitationArrow x={exX} y1={yE(0)} y2={yE(upper)} dim={oDim} label="støt" />
      {items.map(({ id, from, to }) => {
        const nm = LINES[id].nm;
        const color = bolgelengdeFarge(nm, false);
        const dim = selected !== id;
        const mid = (yE(from) + yE(to)) / 2;
        return (
          <g key={id}>
            <TransitionArrow x={ax} y1={yE(from) + 3} y2={yE(to) - 3} color={color} dim={dim} />
            <g opacity={dim ? DIM : 1}>
              <Foton x1={ax + 12} y1={mid} x2={box.x + box.w - 12} y2={mid} bolgelengde={nm} label={photonLabel(id)} fase={-t * 6} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Nitrogenionet N₂⁺: støtet slår løs et elektron fra N₂ og gir et eksitert ion, som faller ned og sender ut 427,8 nm. */
function NitrogenPanel({ box, k, selected, f, t }: { box: PanelBox; k: number; selected: LineId; f: number; t: number }) {
  const tl = transitionLevels('blaa');
  const yE = (E: number) => box.base - E * k;
  const dim = selected !== 'blaa';
  const exX = box.x + 40 * f + 10;
  const lx1 = exX + 24 * f;
  const lx2 = lx1 + Math.max(100, box.w * 0.3);
  const ax = lx1 + (lx2 - lx1) * 0.5;
  const nm = LINES.blaa.nm;
  const mid = (yE(tl.upper) + yE(tl.lower)) / 2;
  // Fiolett er mørkt i seg selv: litt lysere på pila og fotonet, så de synes også i mørkt tema.
  const violet = rgbText(lightenRgb(parseRgb(bolgelengdeFarge(nm, false)), 0.25));
  return (
    <g>
      <Txt x={box.x + 10} y={box.y + 26 * f} anchor="start" size={0.9} weight={700}>
        Nitrogenion (N₂⁺)
      </Txt>
      <Level x1={lx1} x2={lx2} y={yE(tl.upper)} note={`lever ${lifetimeText('blaa')}`} dim={dim} f={f} />
      <Level x1={lx1} x2={lx2} y={yE(tl.lower)} note="nedre nivå" dim={dim} f={f} />
      <ExcitationArrow x={exX} y1={yE(0)} y2={yE(tl.upper)} dim={dim} label="støt fra N₂" />
      <TransitionArrow x={ax} y1={yE(tl.upper) + 3} y2={yE(tl.lower) - 3} color={violet} dim={dim} />
      <g opacity={dim ? DIM : 1}>
        <Foton x1={ax + 12} y1={mid} x2={box.x + box.w - 12} y2={mid} bolgelengde={nm} farge={violet} fase={-t * 6} />
        {/* Etiketten starter ved pila (sentrert over et kort foton ville den gått inn i pila) */}
        <Txt x={ax + 16} y={mid - 8 - 15 * f} anchor="start" weight={700}>
          {photonLabel('blaa')}
        </Txt>
      </g>
    </g>
  );
}

/**
 * Hele figuren: oksygen og nitrogenion med samme energiskala (px per eV), og nordlysets linjespekter nederst med
 * linjestyrken fra modellen. Den valgte linja er sterk, de andre nedtonet.
 */
export function NordlysNivaer({ selected, shares, t }: { selected: LineId; shares: Record<LineId, number>; t: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const { stacked: st, k, oBox, nBox, specY, specH } = levelsLayout(f);
  const maxShare = Math.max(...LINE_ORDER.map((id) => shares[id]));
  const lines = LINE_ORDER.map((id) => ({ nm: LINES[id].nm, styrke: maxShare > 0 ? 0.25 + (0.75 * shares[id]) / maxShare : 1 }));
  const sx0 = 40;
  const sx1 = 760;
  const lo = 380;
  const hi = 700;
  const selX = sx0 + ((LINES[selected].nm - lo) / (hi - lo)) * (sx1 - sx0);
  return (
    <g>
      <OxygenPanel box={oBox} k={k} selected={selected} f={f} t={t} />
      {!st && <line x1={485} x2={485} y1={14} y2={oBox.base + 10} stroke={VIZ.grid} strokeWidth={1 * ss} />}
      <NitrogenPanel box={nBox} k={k} selected={selected} f={f} t={t} />
      <Txt x={sx0} y={specY - 16 * f} anchor="start" size={0.8} weight={650}>
        Spekteret fra nordlyset
      </Txt>
      <Spektrum x={sx0} y={specY} w={sx1 - sx0} h={specH} type="emisjon" linjer={lines} fra={lo} til={hi} skala />
      <path
        d={`M${selX} ${specY - 3}L${selX - 7 * ss} ${specY - 13 * ss}L${selX + 7 * ss} ${specY - 13 * ss}Z`}
        fill={bolgelengdeFarge(LINES[selected].nm, false)}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
    </g>
  );
}
