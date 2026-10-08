/**
 * Figuren til eksempeloppgaven «Energi fra en kjernereaksjon». Øverst står reaksjonen med kjernene over symbolene.
 * Under bytter innholdet med deloppgaven:
 *   a) regnskapet for nukleontall og ladning, og et utsnitt av periodesystemet (eller en liste med partikler),
 *   b–c) en skålvekt med partiklene før og etter: siden før er tyngst, og massedefekten blir til energi,
 *   d–e) 1,0 kg brensel på en labbenk ved siden av haugen med kull (eller tanken med bensin) som gir like mye energi.
 * Med «Vis hele løsningen» står alle delene under hverandre.
 *
 * Stegene (WorkedExample teller fra 1): 1–2 a, 3–4 b, 5–6 c, 7–8 d og 9–10 e (se EksMassedefekt.tsx).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Figure, Txt, VIZ, fmt, fmtSci, useTextScale, type FigureState } from '../../kit';
import {
  Atomkjerne,
  Ball,
  Bil,
  Dimension,
  ForceArrow,
  Himmel,
  Kloss,
  Landskap,
  Nukleon,
  PAINTS,
  Person,
  Rom,
  SCENE,
  Underlag,
  ValueTag,
  alpha,
  shade,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { elementName, elementSymbol } from '../kap07/elements';
import { NuclideSymbol, PARTICLE, nuclideSymbolWidth, textWidthEm } from '../kap07/parts';
import { Gassflaske, Kullhaug, Lagertank, Skaalvekt, skaalvektMaal } from './massedefekt-deler';
import { FUEL_KG, sig, type MassSolution, type MassTask, type Particle, type Term } from './model-eks-massedefekt';

/** Nukleontall (blått) og ladning (oransje), som i «Kjernereaksjoner: α, β og γ». */
export const COLOR_A = VIZ.series[0]!;
export const COLOR_Z = PARTICLE.proton;
/** Massedefekten og energien. */
export const COLOR_DM = VIZ.series[4]!;
export const COLOR_E = VIZ.series[2]!;

/** Høyden på reaksjonen øverst og på feltet under (lik i alle stegene, så knappene står stille). */
const DIM = {
  wide: { W: 800, react: 184, band: 300 },
  narrow: { W: 480, react: 176, band: 440 },
};

/** Om figuren er smal (mobil): da får den en smalere viewBox, og delene står under hverandre. */
function useNarrow<T extends HTMLElement>(limit = 560) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setNarrow(w < limit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [limit]);
  return [ref, narrow] as const;
}

/** Prosent med to gjeldende siffer: 8,44 · 10⁻⁴ → «0,084». */
function fmtPct(v: number): string {
  const p = sig(v * 100, 2);
  return fmt(p, Math.max(0, 1 - Math.floor(Math.log10(Math.abs(p)))));
}

/* ---------- Tekst for partiklene ---------- */

/** Nukleontall og ladning slik de står i likningen: tall, eller «A» og «Z» for X før deloppgave a er løst. */
function indices(t: Term, known: boolean): { A: string; Z: string } {
  if (t.unknown && !known) return { A: 'A', Z: 'Z' };
  return { A: String(t.p.A), Z: String(t.p.Z) };
}

const symbolOf = (t: Term, revealed: boolean) => (t.unknown && !revealed ? 'X' : t.p.symbol);

/* ---------- Reaksjonen: plassering ---------- */

interface TermCol {
  kind: 'term';
  term: Term;
  /** Midten av kolonnen. */
  cx: number;
  w: number;
  /** Radius til én kjerne i leddet. */
  R: number;
}
interface OpCol {
  kind: 'op';
  op: '+' | '→';
  cx: number;
  w: number;
}
type Col = TermCol | OpCol;

export interface ReactionLayout {
  cols: Col[];
  /** Skriftstørrelsen på symbolene og radius til ett nukleon. */
  S: number;
  rn: number;
  left: number;
  right: number;
}

/** Radius til en kjerne med nukleontall A når ett nukleon har radius rn (som Atomkjerne). */
function nucleusRadius(A: number, rn: number): number {
  if (A <= 1) return rn;
  if (A <= 4) return rn * 2.1;
  return rn * (1 + 1.1 * Math.cbrt(A));
}

const coefW = (count: number, S: number) => (count > 1 ? (textWidthEm(String(count)) + 0.18) * S : 0);

function symbolWidth(t: Term, S: number): number {
  // Den bredeste av «ᴬ_Z X» og det endelige symbolet, så likningen står stille når X blir funnet.
  const final = nuclideSymbolWidth(t.p.A, t.p.Z, t.p.symbol, S);
  const unknown = t.unknown ? nuclideSymbolWidth(Math.max(t.p.A, 10), t.p.Z, 'X', S) : 0;
  return coefW(t.count, S) + Math.max(final, unknown);
}

export function reactionLayout(task: MassTask, W: number, narrow: boolean): ReactionLayout {
  const items: (Term | '+' | '→')[] = [];
  task.reactants.forEach((t, i) => items.push(...(i > 0 ? (['+', t] as const) : ([t] as const))));
  items.push('→');
  task.products.forEach((t, i) => items.push(...(i > 0 ? (['+', t] as const) : ([t] as const))));
  const Amax = Math.max(...[...task.reactants, ...task.products].map((t) => t.p.A));
  const S0 = narrow ? 36 : 46;
  const maxR = narrow ? 36 : 44;
  const rn0 = Math.min(17, maxR / (nucleusRadius(Amax, 1) || 1));
  const opW = (op: '+' | '→', S: number) => (op === '→' ? 1.75 : 1.2) * S;
  const termW = (t: Term, S: number, rn: number) => {
    const R = nucleusRadius(t.p.A, rn);
    const nuc = t.count * 2 * R + (t.count - 1) * 0.35 * R;
    return Math.max(symbolWidth(t, S), nuc) + 0.3 * S;
  };
  const total = (S: number, rn: number) => items.reduce((w, it) => w + (typeof it === 'string' ? opW(it, S) : termW(it, S, rn)), 0);
  const margin = narrow ? 10 : 24;
  const k = Math.min(1, (W - 2 * margin) / total(S0, rn0));
  const S = S0 * k;
  const rn = rn0 * k;
  let x = W / 2 - total(S, rn) / 2;
  const left = x;
  const cols: Col[] = items.map((it) => {
    const w = typeof it === 'string' ? opW(it, S) : termW(it, S, rn);
    const col: Col = typeof it === 'string' ? { kind: 'op', op: it, cx: x + w / 2, w } : { kind: 'term', term: it, cx: x + w / 2, w, R: nucleusRadius(it.p.A, rn) };
    x += w;
    return col;
  });
  return { cols, S, rn, left, right: x };
}

/* ---------- Partikler ---------- */

/** Én partikkel: kjerne, nøytron eller proton. (x, y) er sentrum. */
function Particle1({ p, x, y, rn, seed = 1 }: { p: Particle; x: number; y: number; rn: number; seed?: number }) {
  if (p.kind === 'noytron') return <Nukleon x={x} y={y} r={rn} type="noytron" title="nøytron" />;
  if (p.kind === 'proton') return <Nukleon x={x} y={y} r={rn} type="proton" title="proton" />;
  return <Atomkjerne x={x} y={y} Z={p.Z} N={p.A - p.Z} r={rn} seed={seed} title={p.name} />;
}

/** Den ukjente partikkelen før den er funnet: en stiplet kule med spørsmålstegn. */
function Ghost({ x, y, R }: { x: number; y: number; R: number }) {
  const ss = useStrokeScale();
  return (
    <g>
      <circle cx={x} cy={y} r={R} fill={alpha(VIZ.muted, 0.08)} stroke={VIZ.muted} strokeWidth={1.4 * ss} strokeDasharray={`${4 * ss} ${3.5 * ss}`} />
      <Txt x={x} y={y + Math.min(R, 26) * 0.38} px={Math.max(13, Math.min(R, 26) * 1.05)} weight={700} muted halo={false}>
        ?
      </Txt>
    </g>
  );
}

/** Kjernene i ett ledd ved siden av hverandre (count stykker), med sentrum i (cx, y). */
function TermParticles({ t, cx, y, R, rn, show }: { t: Term; cx: number; y: number; R: number; rn: number; show: boolean }) {
  const gap = 0.35 * R;
  const w = t.count * 2 * R + (t.count - 1) * gap;
  return (
    <>
      {Array.from({ length: t.count }, (_, i) => {
        const x = cx - w / 2 + R + i * (2 * R + gap);
        return show ? <Particle1 key={i} p={t.p} x={x} y={y} rn={rn} seed={i + 2} /> : <Ghost key={i} x={x} y={y} R={R} />;
      })}
    </>
  );
}

/* ---------- Reaksjonen øverst ---------- */

function ReactionBand({ L, h, known, revealed }: { L: ReactionLayout; h: number; known: boolean; revealed: boolean }) {
  const nucY = h * 0.35;
  const symY = h * 0.84;
  return (
    <g>
      {L.cols.map((c, i) => {
        if (c.kind === 'op')
          return (
            <Txt key={i} x={c.cx} y={symY - L.S * 0.06} px={L.S * 0.9} weight={500} halo>
              {c.op}
            </Txt>
          );
        const t = c.term;
        const idx = indices(t, known);
        const sym = symbolOf(t, revealed);
        const cw = coefW(t.count, L.S);
        const sw = nuclideSymbolWidth(idx.A, idx.Z, sym, L.S);
        const x0 = c.cx - (cw + sw) / 2;
        return (
          <g key={i}>
            <TermParticles t={t} cx={c.cx} y={nucY} R={c.R} rn={L.rn} show={!t.unknown || revealed} />
            {t.count > 1 && (
              <Txt x={x0} y={symY} anchor="start" px={L.S} weight={500}>
                {t.count}
              </Txt>
            )}
            <NuclideSymbol
              x={x0 + cw}
              y={symY}
              A={idx.A}
              Z={idx.Z}
              symbol={sym}
              size={L.S}
              colorA={COLOR_A}
              colorZ={COLOR_Z}
              color={t.unknown ? (revealed ? COLOR_DM : VIZ.ink) : undefined}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ---------- a) Regnskapet og periodesystemet ---------- */

/** Tall i en avrundet brikke med svak fyll i fargen (som i «Kjernereaksjoner»). */
function Chip({ x, y, text, color, strong }: { x: number; y: number; text: string; color: string; strong?: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const h = 28 * f;
  const fs = 17 * f * 0.95;
  const w = Math.max(h * 1.4, textWidthEm(text) * fs * 0.92 + 18 * f);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={h * 0.32}
        fill={alpha(color, strong ? 0.22 : 0.12)}
        stroke={strong ? color : alpha(color, 0.65)}
        strokeWidth={(strong ? 2.4 : 1.2) * ss}
      />
      <Txt x={x} y={y + fs * 0.35} size={0.95} weight={700} color={color} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

function LedgerBand({ s, L, W, h: band, step, all }: { s: MassSolution; L: ReactionLayout; W: number; h: number; step: number; all: boolean }) {
  const f = useTextScale();
  // På mobil er feltet høyere enn innholdet (ca. 300): flytt innholdet ned til midten.
  const yOff = Math.max(0, (band - 300 * f) / 2);
  const h = band - 2 * yOff;
  const known = all || step >= 1;
  const revealed = all || step >= 2;
  const rowA = 50 * f;
  const rowZ = rowA + 70 * f;
  const chipText = (t: Term, which: 'A' | 'Z') => {
    const v = which === 'A' ? t.p.A : t.p.Z;
    const val = t.unknown && !known ? which : String(v);
    return t.count > 1 ? `${t.count} · ${val}` : val;
  };
  const row = (y: number, which: 'A' | 'Z') =>
    L.cols.map((c, i) =>
      c.kind === 'op' ? (
        <Txt key={i} x={c.cx} y={y + 6 * f} size={1.1} weight={650}>
          {c.op === '→' ? '=' : '+'}
        </Txt>
      ) : (
        <Chip key={i} x={c.cx} y={y} text={chipText(c.term, which)} color={which === 'A' ? COLOR_A : COLOR_Z} strong={c.term.unknown && known} />
      ),
    );
  const labelX = Math.max(10, L.left + 4);
  const stripY = rowZ + 40 * f;
  return (
    <g transform={`translate(0 ${yOff})`}>
      <Txt x={labelX} y={rowA - 22 * f} anchor="start" size={0.85} color={COLOR_A} weight={650}>
        Nukleontall A
      </Txt>
      {row(rowA, 'A')}
      <Txt x={labelX} y={rowZ - 22 * f} anchor="start" size={0.85} color={COLOR_Z} weight={650}>
        Ladning Z
      </Txt>
      {row(rowZ, 'Z')}
      {revealed ? (
        <IdentifyStrip s={s} W={W} y={stripY} h={h - stripY - 8} />
      ) : (
        <g>
          {(step === 0
            ? ['Nukleontall og ladning er like store', 'før og etter en kjernereaksjon.']
            : [`X har A = ${s.A.X} og Z = ${s.Z.X}.`, s.Z.X >= 3 ? `Hvilket grunnstoff har Z = ${s.Z.X}?` : 'Hvilken partikkel er det?']
          ).map((line, i) => (
            <Txt key={i} x={W / 2} y={stripY + (h - stripY) * 0.36 + i * 24 * f} size={0.9} muted={step === 0} weight={step === 0 ? 500 : 650}>
              {line}
            </Txt>
          ))}
        </g>
      )}
    </g>
  );
}

interface Tile {
  key: string;
  A?: number;
  Z: number;
  symbol: string;
  name: string;
  match: boolean;
}

/** Utsnitt av periodesystemet rundt Z for X, eller en liste med små partikler når X er et nukleon. */
function IdentifyStrip({ s, W, y, h }: { s: MassSolution; W: number; y: number; h: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const small = s.Z.X <= 2 && s.A.X <= 4;
  const tiles: Tile[] = small
    ? [
        { key: 'e', A: 0, Z: -1, symbol: 'e', name: 'elektron', match: false },
        { key: 'n', A: 1, Z: 0, symbol: 'n', name: 'nøytron', match: s.A.X === 1 && s.Z.X === 0 },
        { key: 'p', A: 1, Z: 1, symbol: 'p', name: 'proton', match: s.A.X === 1 && s.Z.X === 1 },
        { key: 'a', A: 4, Z: 2, symbol: 'α', name: 'alfapartikkel', match: s.A.X === 4 && s.Z.X === 2 },
      ]
    : [-2, -1, 0, 1, 2].map((d) => {
        const Z = s.Z.X + d;
        return { key: String(Z), Z, symbol: elementSymbol(Z), name: elementName(Z), match: d === 0 };
      });
  const n = tiles.length;
  const gap = 8;
  const tw = Math.min(small ? 104 : 92, (W - 24 - (n - 1) * gap) / n);
  const th = Math.min(h - 26 * f, tw * 1.08);
  const x0 = W / 2 - (n * tw + (n - 1) * gap) / 2;
  const top = y + 24 * f;
  return (
    <g>
      <Txt x={W / 2} y={y + 8 * f} size={0.8} muted>
        {small ? 'Små partikler i kjernereaksjoner' : 'Utsnitt av periodesystemet'}
      </Txt>
      {tiles.map((t, i) => {
        const x = x0 + i * (tw + gap);
        const cx = x + tw / 2;
        const col = t.match ? COLOR_DM : VIZ.muted;
        const zText = t.Z < 0 ? `−${-t.Z}` : String(t.Z);
        return (
          <g key={t.key} opacity={t.match ? 1 : 0.75}>
            <rect
              x={x}
              y={top}
              width={tw}
              height={th}
              rx={6 * ss}
              fill={t.match ? alpha(COLOR_DM, 0.14) : alpha(VIZ.grid, 0.25)}
              stroke={t.match ? COLOR_DM : alpha(VIZ.muted, 0.5)}
              strokeWidth={(t.match ? 2.4 : 1) * ss}
            />
            {small ? (
              <NuclideSymbol x={cx} y={top + th * 0.56} A={t.A ?? 0} Z={zText} symbol={t.symbol} size={Math.min(30, th * 0.34)} anchor="middle" colorA={COLOR_A} colorZ={COLOR_Z} />
            ) : (
              <>
                <Txt x={x + 7 * ss} y={top + 17 * f} anchor="start" size={0.78} color={COLOR_Z} weight={700} halo={false}>
                  {t.Z}
                </Txt>
                <Txt x={cx} y={top + th * 0.62} px={Math.min(30, th * 0.34)} weight={700} color={t.match ? COLOR_DM : VIZ.ink} halo={false}>
                  {t.symbol}
                </Txt>
              </>
            )}
            <Txt x={cx} y={top + th - 9 * f} size={0.7} color={col} weight={t.match ? 700 : 500} halo={false}>
              {t.name}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- b og c) Skålvekta ---------- */

/** Partiklene i et ledd-sett lagt ved siden av hverandre i skålen, med bunnen på skålen. */
function PanLoad({ terms, x, y, maxW, rnMax }: { terms: Term[]; x: number; y: number; maxW: number; rnMax: number }) {
  const list = terms.flatMap((t) => Array.from({ length: t.count }, () => t.p));
  const gap = 4;
  const widthAt = (rn: number) => list.reduce((w, p) => w + 2 * nucleusRadius(p.A, rn), 0) + (list.length - 1) * gap;
  const rn = Math.min(rnMax, rnMax * (maxW / Math.max(1, widthAt(rnMax))));
  let px = x - widthAt(rn) / 2;
  return (
    <>
      {list.map((p, i) => {
        const R = nucleusRadius(p.A, rn);
        const cx = px + R;
        px += 2 * R + gap;
        return <Particle1 key={i} p={p} x={cx} y={y - R - 1} rn={rn} seed={i + 5} />;
      })}
    </>
  );
}

/** Bredden til et ValueTag-skilt (samme regel som i scene-kit-et), så skiltene kan holdes inne i kortene. */
function tagWidth(text: string, size: number, f: number): number {
  const fs = 17 * f * size;
  return Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
}

/** Midten av et skilt som skal stå ved x, men flyttet inn så hele skiltet er mellom lo og hi. */
function clampTag(x: number, text: string, size: number, f: number, lo: number, hi: number): number {
  const half = tagWidth(text, size, f) / 2 + 4;
  return Math.min(hi - half, Math.max(lo + half, x));
}

interface Card {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Et kort med avrundede hjørner: innholdet klippes til kortet, og kortet får en tynn kant. */
function CardFrame({ c, children }: { c: Card; children: ReactNode }) {
  const id = useSvgId('kort');
  const ss = useStrokeScale();
  return (
    <g>
      <clipPath id={id}>
        <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={10} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.7} />
    </g>
  );
}

function BalanceBand({ task, s, W, h, narrow, step, all }: { task: MassTask; s: MassSolution; W: number; h: number; narrow: boolean; step: number; all: boolean }) {
  const f = useTextScale();
  const showDm = all || step >= 4;
  const showEJ = all || step >= 5;
  const showMeV = all || step >= 6;
  const card: Card = { x: 12, y: 8, w: W - 24, h: h - 16 };
  const arm = narrow ? 128 : 210;
  const skaal = narrow ? 86 : 104;
  const bench = h - (narrow ? 58 : 34);
  const { box, post } = skaalvektMaal(arm);
  const utslag = narrow ? 16 : 14;
  const panTop = bench - box - post;
  const cx = W / 2;
  // Skilt og tekst. PC: forklaringen oppe til venstre, Δm og energien i midten mellom skålene, massene over skålene.
  // Mobil: alt i midten over vekta, i rader.
  const capY = narrow ? 32 : 30;
  const dmY = narrow ? 72 : 32;
  const eY = narrow ? 124 : 92;
  const meVY = narrow ? 162 : 130;
  const massY = narrow ? 222 : 74;
  const loadH = panTop - massY - 20 * f;
  const Amax = Math.max(...[...task.reactants, ...task.products].map((t) => t.p.A));
  // Radius til ett nukleon i skålene: så stort at den største kjernen fyller ca. halve høyden over skålen (høyst 13).
  const rnMax = Math.min(13, loadH / 2 / Math.max(1, nucleusRadius(Amax, 1)));
  const before = `Før: ${fmt(s.mBefore, 6)} u`;
  const after = `Etter: ${fmt(s.mAfter, 6)} u`;
  return (
    <CardFrame c={card}>
      <Rom x={card.x} y={card.y} w={card.w} h={card.h} gulvY={bench - 4} gulv="fliser" />
      <Underlag x1={card.x} x2={card.x + card.w} y={bench} depth={h - bench + 4} type="labbenk" />
      <Skaalvekt
        x={cx}
        y={bench}
        arm={arm}
        skaal={skaal}
        utslag={utslag}
        venstre={(x, y) => <PanLoad terms={task.reactants} x={x} y={y} maxW={skaal * 1.7} rnMax={rnMax} />}
        hoyre={(x, y) => <PanLoad terms={task.products} x={x} y={y} maxW={skaal * 1.7} rnMax={rnMax} />}
      />
      {narrow ? (
        <Txt x={cx} y={capY} size={0.78} muted>
          Tankeforsøk: utslaget er sterkt overdrevet
        </Txt>
      ) : (
        <>
          <Txt x={card.x + 14} y={capY} anchor="start" size={0.78} muted>
            Tankeforsøk:
          </Txt>
          <Txt x={card.x + 14} y={capY + 18 * f} anchor="start" size={0.78} muted>
            utslaget er overdrevet
          </Txt>
        </>
      )}
      <ValueTag x={clampTag(cx - arm, before, 0.9, f, card.x, card.x + card.w)} y={massY} text={before} pointer={6} />
      <ValueTag x={clampTag(cx + arm, after, 0.9, f, card.x, card.x + card.w)} y={massY} text={after} pointer={6} />
      {showDm && <ValueTag x={cx} y={dmY} text={`Δm = ${fmt(s.dm, 6)} u`} color={COLOR_DM} size={0.95} />}
      {showEJ && (
        <>
          <ForceArrow x1={cx} y1={dmY + 14 * f} x2={cx} y2={eY - 13 * f} color={COLOR_E} width={4} />
          <ValueTag x={cx} y={eY} text={`E = ${fmtSci(sig(s.EJ, 3), 2)} J`} color={COLOR_E} size={0.95} />
        </>
      )}
      {showMeV && <ValueTag x={cx} y={meVY} text={`= ${fmt(sig(s.EMeV, 3), s.EMeV >= 100 ? 0 : 1)} MeV`} color={COLOR_E} size={0.95} />}
    </CardFrame>
  );
}

/* ---------- d og e) 1,0 kg brensel mot kull eller bensin ---------- */

/** Golfballen ved siden av urankuben har diameter 4,27 cm. */
const GOLF_CM = 4.27;

/** Kortet med 1,0 kg brensel: en kube av uranmetall ved siden av en golfball på et bord, eller en gassflaske. */
function FuelCard({ task, s, c, step, all }: { task: MassTask; s: MassSolution; c: Card; step: number; all: boolean }) {
  const f = useTextScale();
  const showN = all || step >= 7;
  const showE = all || step >= 8;
  const showFrac = all || step >= 10;
  const floor = c.y + c.h * 0.8;
  const wide = c.w >= 400;
  const objX = wide ? c.x + c.w * 0.24 : c.x + c.w / 2;
  const tagX = wide ? c.x + c.w * 0.71 : c.x + c.w / 2;
  const row = (i: number) => c.y + 24 * f + i * 34 * f;
  const fuelLabel = task.id === 'fusjon' ? '1,0 kg ²H + ³H' : `${fmt(FUEL_KG, 1)} kg ${task.fuelName}`;
  // Uranet: bordet nær, med en golfball til sammenligning (samme skala, px per cm).
  const tagsBottom = wide ? c.y : row(3) + 14 * f;
  const pxPerCm = Math.min(wide ? 12 : 18, (floor - tagsBottom - 14) / (s.cubeSide ? s.cubeSide * 100 : 1), (c.w * 0.3) / GOLF_CM);
  const side = (s.cubeSide ?? 0) * 100 * pxPerCm;
  const ballR = (GOLF_CM / 2) * pxPerCm;
  // Mållinja med teksten til venstre, så kuben og golfballen. Gruppen står midt i kolonnen sin.
  const dimText = `${fmt((s.cubeSide ?? 0) * 100, 1)} cm`;
  const labelW = dimText.length * 17 * f * 0.8 * 0.58 + 8;
  const groupW = labelW + 12 + side + 0.25 * side + 2 * ballR;
  const gx = Math.max(c.x + 10, objX - groupW / 2);
  const dimX = gx + labelW;
  const cubeX = dimX + 12 + side / 2;
  const ballX = cubeX + side / 2 + 0.25 * side + ballR;
  const bottle = Math.min(c.h * 0.62, floor - tagsBottom - 6);
  return (
    <CardFrame c={c}>
      {s.cubeSide !== null ? (
        <>
          <Rom x={c.x} y={c.y} w={c.w} h={c.h} gulvY={c.y + c.h + 40} gulv="tre" />
          <Underlag x1={c.x} x2={c.x + c.w} y={floor} depth={c.h} type="tregulv" />
          <Kloss x={cubeX} y={floor} w={side} h={side} materiale="metall" />
          <Ball x={ballX} y={floor - ballR} r={ballR} type="golf" bakke={floor} />
          <Dimension x1={dimX} y1={floor} x2={dimX} y2={floor - side} label={dimText} labelSize={0.8} />
          <Txt x={ballX} y={floor + 20 * f} size={0.75} weight={600}>
            golfball
          </Txt>
        </>
      ) : (
        <>
          <Rom x={c.x} y={c.y} w={c.w} h={c.h} gulvY={floor - c.h * 0.08} gulv="fliser" />
          <Gassflaske x={objX} y={floor + c.h * 0.04} h={bottle} skulder={task.id === 'fusjon' ? PAINTS.rod : shade(SCENE.wood, 0.25)} />
        </>
      )}
      <ValueTag x={tagX} y={row(0)} text={fuelLabel} size={0.88} />
      {showN && <ValueTag x={tagX} y={row(1)} text={`N = ${fmtSci(sig(s.N, 3), 2)}`} size={0.88} />}
      {showE && <ValueTag x={tagX} y={row(2)} text={`E = ${fmtSci(sig(s.Etot, 2), 1)} J`} color={COLOR_E} size={0.88} />}
      {showFrac && <ValueTag x={tagX} y={row(3)} text={`${fmtPct(s.fraction)} % blir energi`} color={COLOR_DM} size={0.88} />}
    </CardFrame>
  );
}

/** Kortet med kullhaugen eller bensintanken som gir like mye energi, med en bil og en person som målestokk. */
function CompareCard({ task, s, c, step, all }: { task: MassTask; s: MassSolution; c: Card; step: number; all: boolean }) {
  const f = useTextScale();
  const showPile = all || step >= 9;
  const showFrac = all || step >= 10;
  const ground = c.y + c.h * 0.8;
  const kull = task.compare.id === 'kull';
  const widthM = kull ? 2 * s.heap.r : s.tank.d;
  const heightM = kull ? s.heap.h : s.tank.h;
  // Høyt kort (PC): skiltene over haugen. Lavt og bredt kort (mobil): skiltene i en kolonne til høyre.
  const side = c.h / c.w < 0.5;
  const row = (i: number) => c.y + 24 * f + i * 34 * f;
  const tagsBottom = side ? c.y : row(1) + 16 * f;
  // Én skala (px per meter) for haugen, bilen og personen. Bilen og personen står til høyre for haugen.
  const roomW = side ? c.w * 0.58 : c.w - 24;
  const pxPerM = Math.min((roomW - 20) / (widthM + (side ? 0 : 10)), (ground - tagsBottom - 14) / heightM);
  const pileX = c.x + 16 + (widthM / 2) * pxPerM;
  const carX = side ? c.x + c.w - 4.4 * pxPerM * 0.5 - 10 - 3 * pxPerM : pileX + (widthM / 2 + 4.2) * pxPerM;
  const personX = carX + 3.6 * pxPerM;
  const t = sig(s.compareKg / 1000, 2);
  const tagX = side ? c.x + c.w * 0.79 : Math.min(c.x + c.w - 130 * f, Math.max(c.x + 130 * f, pileX));
  const top = ground - heightM * pxPerM;
  const tag0 = showPile ? `${fmt(t, 0)} tonn ${task.compare.name}` : `Hvor mye ${task.compare.name}?`;
  const tag1 = `${fmtSci(sig(s.chemFraction * 100, 2), 1)} % blir energi`;
  return (
    <CardFrame c={c}>
      <Himmel x={c.x} y={c.y} w={c.w} h={ground - c.y} skyer={1} seed={7} />
      <Landskap x={c.x} y={ground} w={c.w} h={Math.min(60, c.h * 0.24)} type="aaser" seed={3} />
      <Underlag x1={c.x} x2={c.x + c.w} y={ground} depth={c.h} type="grus" />
      {showPile ? (
        kull ? (
          <Kullhaug x={pileX} y={ground} r={s.heap.r * pxPerM} h={heightM * pxPerM} />
        ) : (
          <Lagertank x={pileX} y={ground} w={widthM * pxPerM} h={heightM * pxPerM} />
        )
      ) : (
        <Txt x={pileX} y={ground - 0.4 * heightM * pxPerM} size={2} weight={700} muted>
          ?
        </Txt>
      )}
      <Bil x={carX} y={ground} size={4.4 * pxPerM} lakk="blaa" />
      <Person x={personX} y={ground} size={1.75 * pxPerM} jakke="rod" />
      {showPile && (
        <Dimension
          x1={kull ? pileX : pileX + (widthM / 2) * pxPerM + 10}
          y1={ground}
          x2={kull ? pileX : pileX + (widthM / 2) * pxPerM + 10}
          y2={top}
          label={`${fmt(heightM, 0)} m`}
          labelSize={0.8}
        />
      )}
      <ValueTag x={clampTag(tagX, tag0, 0.88, f, c.x, c.x + c.w)} y={row(0)} text={tag0} size={0.88} />
      {showFrac && <ValueTag x={clampTag(tagX, tag1, 0.88, f, c.x, c.x + c.w)} y={row(1)} text={tag1} color={COLOR_DM} size={0.88} />}
    </CardFrame>
  );
}

function CompareBand({ task, s, W, h, narrow, step, all }: { task: MassTask; s: MassSolution; W: number; h: number; narrow: boolean; step: number; all: boolean }) {
  const m = 12;
  const c1: Card = narrow ? { x: m, y: 8, w: W - 2 * m, h: h * 0.46 } : { x: m, y: 8, w: W * 0.36, h: h - 16 };
  const c2: Card = narrow
    ? { x: m, y: c1.y + c1.h + 12, w: W - 2 * m, h: h - c1.h - 28 }
    : { x: c1.x + c1.w + 12, y: 8, w: W - c1.w - 3 * m, h: h - 16 };
  return (
    <g>
      <FuelCard task={task} s={s} c={c1} step={step} all={all} />
      <CompareCard task={task} s={s} c={c2} step={step} all={all} />
    </g>
  );
}

/* ---------- Hele figuren ---------- */

export function MassFigure({ task, s, state }: { task: MassTask; s: MassSolution; state: FigureState }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const { step, showAll } = state;
  const d = narrow ? DIM.narrow : DIM.wide;
  const L = reactionLayout(task, d.W, narrow);
  const known = showAll || step >= 1;
  const revealed = showAll || step >= 2;
  const panel: 'a' | 'bc' | 'de' = step <= 2 ? 'a' : step <= 6 ? 'bc' : 'de';
  const bands: { key: string; h: number; node: ReactNode }[] = [];
  const ledger = <LedgerBand s={s} L={L} W={d.W} h={d.band} step={step} all={showAll} />;
  const balance = <BalanceBand task={task} s={s} W={d.W} h={d.band} narrow={narrow} step={step} all={showAll} />;
  const compare = <CompareBand task={task} s={s} W={d.W} h={d.band} narrow={narrow} step={step} all={showAll} />;
  if (showAll || panel === 'a') bands.push({ key: 'a', h: d.band, node: ledger });
  if (showAll || panel === 'bc') bands.push({ key: 'bc', h: d.band, node: balance });
  if (showAll || panel === 'de') bands.push({ key: 'de', h: d.band, node: compare });
  const H = d.react + bands.reduce((sum, b) => sum + b.h, 0);
  let y = d.react;
  const x = s.X;
  const label = revealed
    ? `Reaksjonen med ${task.reactants.map((t) => t.p.name).join(' og ')} før og ${task.products.map((t) => t.p.name).join(', ')} etter. Den ukjente partikkelen er ${x?.name ?? 'ukjent'}.`
    : `Reaksjonen med ${task.reactants.map((t) => t.p.name).join(' og ')} før og en ukjent partikkel X etter.`;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 ${d.W} ${H}`} label={label} maxHeight={showAll ? 2200 : narrow ? 640 : 480}>
        <ReactionBand L={L} h={d.react} known={known} revealed={revealed} />
        {bands.map((b) => {
          const node = (
            <g key={b.key} transform={`translate(0 ${y})`}>
              {b.node}
            </g>
          );
          y += b.h;
          return node;
        })}
      </Figure>
    </div>
  );
}
