/**
 * Felles hjelpere for figurene i kapittel 7: etiketter med strek rundt en celle (i sidekolonner på PC og i hjørnene
 * på mobil), en klokke som går gjennom fasene steg for steg, og sentromeret (som kit-et tegner internt i
 * <Delingsfigur>).
 */
import { useCallback, useEffect, useMemo } from 'react';
import { VIZ, Txt, kromosomFarge, useSimClock, useTextScale, type Box, type Opphav, type SimClock } from '../kit';

/* ---------- Steg for steg ---------- */

export interface StepClock {
  clock: SimClock;
  /** Steget som vises (0 … count − 1). */
  step: number;
  /** Hvor langt i steget (0–1). */
  u: number;
  /** Gå til et steg (midt i steget) og sett avspillingen på pause. */
  goTo: (i: number) => void;
}

/**
 * Klokke der hvert steg får like lang avspillingstid (`seconds`). Glidebryteren for fase og avspillingen bruker samme
 * tid, så de er alltid i takt. `initial` er steget som vises før eleven trykker på noe.
 */
export function useStepClock(count: number, seconds: number, initial: number, initialU = 0.5): StepClock {
  const tMax = count * seconds;
  const clock = useSimClock({ tMax, speed: 1 });
  const { setT, pause } = clock;
  // Vis steget `initial` når siden åpnes («Start på nytt» går til det første steget)
  useEffect(() => {
    setT((initial + initialU) * seconds);
  }, [setT, initial, initialU, seconds]);
  const t = clock.t;
  const step = Math.min(count - 1, Math.max(0, Math.floor(t / seconds - 1e-9)));
  const u = Math.min(1, Math.max(0, t / seconds - step));
  const goTo = useCallback(
    (i: number) => {
      pause();
      setT(Math.max(1e-6, (Math.min(count - 1, Math.max(0, i)) + initialU) * seconds));
    },
    [pause, setT, count, seconds, initialU],
  );
  return { clock, step, u, goTo };
}

/* ---------- Sentromer ---------- */

/** Sentromeret som holder to søsterkromatider sammen (samme tegning som i kit-et, glir med `bio-anim`). */
export function Sentromer({ x, y, rot, W, par, opphav }: { x: number; y: number; rot: number; W: number; par: number; opphav: Opphav }) {
  return (
    <g className="bio-anim" style={{ transform: `translate(${x}px, ${y}px) rotate(${rot}deg)` }}>
      <ellipse rx={W + 0.9} ry={W * 0.42} fill={kromosomFarge(par, opphav)} />
      <ellipse rx={W * 0.55} ry={W * 0.3} fill={VIZ.ink} opacity={0.45} />
    </g>
  );
}

/* ---------- Etiketter rundt en figur ---------- */

export interface Callout {
  /** Punktet etiketten peker på. */
  x: number;
  y: number;
  /** Tekst; to linjer på mobil når den er en liste. */
  text: string | readonly [string, string];
  /** Uthevet (det viktigste i fasen). */
  strong?: boolean;
}

/** Plass som trengs til etikettene: sidekolonner på PC, bånd over og under på mobil. */
export function calloutSpace(f: number): { side: number; band: number } {
  const narrow = f > 1.3;
  return narrow ? { side: 0, band: bandHeight(f) } : { side: 175, band: 0 };
}

/** Høyden på et etikettbånd over eller under figuren (to linjer). */
export function bandHeight(f: number): number {
  return Math.round(2 * 19 * f + 14);
}

export interface SceneFrame {
  /** Høyden på viewBox-en. */
  H: number;
  /** Området cella tegnes i (figurkoordinater), brukt til å plassere etikettene. */
  box: Box;
  /** Området cella tegnes i, i de indre koordinatene (før skalering). */
  inner: Box;
  /** Skalering av den indre tegningen (1 på PC, større på mobil så kromosomene synes). */
  k: number;
  /** Transform for den indre tegningen. */
  transform: string;
  /** Etikettene står i bånd over og under figuren (mobil, eller brede figurer på PC). */
  bands: boolean;
  /** Regner et punkt i indre koordinater om til figurkoordinater. */
  map: (p: { x: number; y: number }) => { x: number; y: number };
}

export interface FrameOptions {
  /** Høyden på PC. */
  desktopH: number;
  /** Bredde/høyde for cella på mobil. */
  aspect?: number;
  /** Skalering på mobil. */
  k?: number;
  /** Bånd over og under også på PC (for brede figurer, f.eks. to celler ved siden av hverandre). */
  bands?: boolean;
}

/**
 * Ramme for en cellefigur med etiketter. På PC: sidekolonner til etikettene og en celle i midten. På mobil: bånd
 * over og under til etikettene, og cella tegnes i et mindre koordinatsystem som skaleres opp `k` ganger, fordi
 * kit-et har en største kromosomlengde (ellers blir kromosomene små i forhold til cella).
 */
export function sceneFrame(f: number, { desktopH, aspect = 1.35, k = 1.35, bands = false }: FrameOptions): SceneFrame {
  if (f <= 1.3 && !bands) {
    const side = calloutSpace(f).side;
    const box = { x: side, y: 12, w: 800 - 2 * side, h: desktopH - 24 };
    return { H: desktopH, box, inner: box, k: 1, transform: '', bands: false, map: (p) => p };
  }
  const band = bandHeight(f);
  if (f <= 1.3) {
    const box = { x: 16, y: band, w: 768, h: desktopH - 2 * band };
    return { H: desktopH, box, inner: box, k: 1, transform: '', bands: true, map: (p) => p };
  }
  const H = Math.round(320 + 260 * (f - 1) + 2 * band);
  const hb = H - 2 * band;
  const ih = hb / k;
  const iw = Math.min(768 / k, ih * aspect);
  const ox = (800 - iw * k) / 2;
  const oy = band;
  return {
    H,
    box: { x: ox, y: oy, w: iw * k, h: hb },
    inner: { x: 0, y: 0, w: iw, h: ih },
    k,
    transform: `translate(${ox} ${oy}) scale(${k})`,
    bands: true,
    map: (p) => ({ x: ox + k * p.x, y: oy + k * p.y }),
  };
}

/**
 * Etiketter med strek til det de peker på. På PC står de i en kolonne til venstre og til høyre for `box` (den
 * siden punktet ligger nærmest), jevnt fordelt i høyden. På mobil står de i hjørnene over og under `box`
 * (maks to over og to under). Viser maks fire (eller seks på PC) etiketter.
 */
export function Callouts({ items, box, width = 800, bands }: { items: readonly Callout[]; box: Box; width?: number; bands?: boolean }) {
  const f = useTextScale();
  const narrow = bands ?? f > 1.3;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const placed = useMemo(() => {
    const out: {
      c: Callout;
      lx: number;
      ly: number;
      anchor: 'start' | 'end';
      lines: string[];
    }[] = [];
    const lineH = 19 * f;
    if (!narrow) {
      for (const side of ['left', 'right'] as const) {
        const list = items.filter((c) => (side === 'left' ? c.x < cx : c.x >= cx)).sort((a, b) => a.y - b.y);
        const n = list.length;
        list.forEach((c, i) => {
          const lines = typeof c.text === 'string' ? [c.text] : [...c.text];
          // Jevnt fordelt, men så nær punktet som mulig; to linjer sentreres om plassen
          const slot = box.y + ((i + 0.5) / Math.max(1, n)) * box.h;
          const mid = n === 1 ? Math.min(box.y + box.h - 14, Math.max(box.y + 14, c.y)) : slot;
          const ly = mid + 5 * f - ((lines.length - 1) * lineH) / 2;
          const lx = side === 'left' ? box.x - 14 : box.x + box.w + 14;
          out.push({ c, lx, ly, anchor: side === 'left' ? 'end' : 'start', lines });
        });
      }
      return out;
    }
    for (const band of ['top', 'bottom'] as const) {
      const list = items
        .filter((c) => (band === 'top' ? c.y < cy : c.y >= cy))
        .sort((a, b) => a.x - b.x)
        .slice(0, 2);
      list.forEach((c, i) => {
        const left = list.length === 1 ? c.x < cx : i === 0;
        const lines = typeof c.text === 'string' ? [c.text] : [...c.text];
        const ly = band === 'top' ? box.y - 10 - (lines.length - 1) * lineH : box.y + box.h + lineH + 6;
        out.push({
          c,
          lx: left ? 14 : width - 14,
          ly,
          anchor: left ? 'start' : 'end',
          lines,
        });
      });
    }
    return out;
  }, [items, box.x, box.y, box.w, box.h, cx, cy, narrow, f, width]);
  const lineH = 19 * f;
  return (
    <g>
      {placed.map(({ c, lx, ly, anchor, lines }, i) => {
        // Streken går til enden av teksten nærmest punktet
        const textTop = ly - 13 * f;
        const textBottom = ly + (lines.length - 1) * lineH + 4;
        const ex = narrow ? (c.x < lx ? lx - 4 : lx + 4) : anchor === 'end' ? lx + 6 : lx - 6;
        const ey = narrow
          ? c.y < textTop
            ? textTop - 2
            : c.y > textBottom
              ? textBottom
              : ly - 5 * f
          : ly - 5 * f + ((lines.length - 1) * lineH) / 2;
        const exNarrow = narrow ? Math.min(Math.max(ex, 10), width - 10) : ex;
        return (
          <g key={i}>
            <line x1={c.x} y1={c.y} x2={exNarrow} y2={ey} stroke={VIZ.muted} strokeWidth={1.3} strokeLinecap="round" />
            <circle cx={c.x} cy={c.y} r={3} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2} />
            {lines.map((line, j) => (
              <Txt key={j} x={lx} y={ly + j * lineH} anchor={anchor} size={0.85} weight={c.strong ? 700 : 560}>
                {line}
              </Txt>
            ))}
          </g>
        );
      })}
    </g>
  );
}
