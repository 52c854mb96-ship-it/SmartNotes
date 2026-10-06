/**
 * Plassering av tekst i figurene til «Curling: rett treff på en stein i ro», uten React, så den kan testes:
 * bredden på en tekst, to fartsskilt over steinene som ikke overlapper, og tall under søylene som ikke overlapper.
 */

/**
 * Omtrentlig bredde på tekst i fet skrift, i em (ganger skriftstørrelsen). Tallene er målt i DejaVu Sans Bold, som er
 * den bredeste skrifta appen kan få; systemskriftene på Mac, iPad og Windows er smalere, så anslaget er på den sikre siden.
 */
export function textWidthEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) em += 0.7;
    else if (ch === ' ') em += 0.35;
    else if (/[,.·:;]/.test(ch)) em += 0.38;
    else if (/[′'|]/.test(ch)) em += 0.27;
    else if (/[₀-₉⁰-⁹]/.test(ch)) em += 0.44;
    else if (/[mMwW%ΣÆæ]/.test(ch)) em += 1.05;
    else if (/[=+−<>]/.test(ch)) em += 0.84;
    else if (/[()/[\]]/.test(ch)) em += 0.46;
    else if (/[iljtfr]/.test(ch)) em += 0.42;
    else if (/[A-ZÆØÅ]/.test(ch)) em += 0.78;
    else em += 0.66;
  }
  return em;
}

/** Et skilt som skal stå over et punkt: `x` er punktet (spissen på skiltet), `w` bredden. */
export interface TagWant {
  x: number;
  w: number;
}

/** Hvor skiltet havnet: venstre kant, og rad 0 (nederst, nærmest steinene) eller 1 (over). */
export interface TagSpot {
  left: number;
  row: 0 | 1;
}

/**
 * To skilt over to punkter der `a` står til venstre for `b`. Først prøver vi å sette dem på samme rad, rett over
 * punktene. Overlapper de, skyver vi dem fra hverandre (a mot venstre, b mot høyre), men aldri så langt at spissen
 * havner nærmere kanten av skiltet enn `pad`. Er det fortsatt ikke plass, kommer b på raden over.
 * Alt holdes innenfor [margin, W − margin].
 */
export function placeTagPair(a: TagWant, b: TagWant, W: number, gap: number, pad: number, margin = 6): { a: TagSpot; b: TagSpot } {
  const lo = margin;
  const hi = W - margin;
  const clampLeft = (left: number, w: number) => Math.min(hi - w, Math.max(lo, left));
  // Lengst til venstre og høyre skiltet kan stå og fortsatt ha spissen innenfor.
  const range = (t: TagWant) => ({
    min: clampLeft(t.x + pad - t.w, t.w),
    max: clampLeft(t.x - pad, t.w),
  });
  const ra = range(a);
  const rb = range(b);
  let la = clampLeft(a.x - a.w / 2, a.w);
  let lb = clampLeft(b.x - b.w / 2, b.w);
  let overlap = la + a.w + gap - lb;
  if (overlap > 0) {
    // Del forskyvningen likt, og gi resten til den som har plass igjen.
    const roomA = Math.max(0, la - ra.min);
    const roomB = Math.max(0, rb.max - lb);
    let da = Math.min(roomA, overlap / 2);
    let db = Math.min(roomB, overlap / 2);
    const rest = overlap - da - db;
    if (rest > 0) {
      const moreA = Math.min(roomA - da, rest);
      da += moreA;
      db += Math.min(roomB - db, rest - moreA);
    }
    la -= da;
    lb += db;
    overlap = la + a.w + gap - lb;
  }
  if (overlap <= 1e-9) return { a: { left: la, row: 0 }, b: { left: lb, row: 0 } };
  return {
    a: { left: clampLeft(a.x - a.w / 2, a.w), row: 0 },
    b: { left: clampLeft(b.x - b.w / 2, b.w), row: 1 },
  };
}

/**
 * Tall på én linje (f.eks. under en søyle) som helst skal stå midt under hvert sitt segment (`x` = ønsket midte, `w` =
 * bredde), uten å overlappe. De holder rekkefølgen, har minst `gap` mellom seg og holdes innenfor [lo, hi].
 * Gir venstre kant for hver. Er det ikke plass til alle, stables de tett fra `lo`.
 */
export function spreadLabels(items: { x: number; w: number }[], lo: number, hi: number, gap: number): number[] {
  const n = items.length;
  if (n === 0) return [];
  const lefts = items.map((it) => it.x - it.w / 2);
  // Fra venstre: ikke før lo og ikke oppå forrige.
  for (let i = 0; i < n; i++) {
    const min = i === 0 ? lo : lefts[i - 1]! + items[i - 1]!.w + gap;
    lefts[i] = Math.max(lefts[i]!, min);
  }
  // Fra høyre: ikke forbi hi og ikke oppå neste.
  for (let i = n - 1; i >= 0; i--) {
    const max = i === n - 1 ? hi - items[i]!.w : lefts[i + 1]! - gap - items[i]!.w;
    lefts[i] = Math.min(lefts[i]!, max);
  }
  // Er det ikke plass til alle, går lo foran hi.
  if (lefts[0]! < lo) {
    let x = lo;
    for (let i = 0; i < n; i++) {
      lefts[i] = x;
      x += items[i]!.w + gap;
    }
  }
  return lefts;
}
