/**
 * Plassering av etiketter i grafene til eksempeloppgaven «Golfball kastet rett opp fra en balkong»
 * (k1-eks-kast-balkong). Ren geometri uten React, så plasseringen kan testes for alle tallsettene og bredder.
 */

/** Omtrentlig bredde (figurenheter) av en tekst i fet skrift med relativ størrelse `size` og tekstskaleringen `f`. */
export function labelWidth(text: string, size: number, f: number): number {
  return text.length * 17 * size * f * 0.62;
}

export interface PassLabelInput {
  /** Punktet der ballen passerer hånda på vei ned, (t, v) = (2v₀/g, −v₀), i figurens koordinater. */
  px: number;
  py: number;
  /** Venstre og høyre kant av grafområdet. */
  x0: number;
  x1: number;
  /** Tekstskaleringen (1 på PC, større på mobil). */
  f: number;
  /** Hele teksten på én linje og den samme delt på to linjer. */
  text: string;
  head: string;
  tail: string;
  /** Relativ skriftstørrelse. */
  size: number;
}

export interface PassLabel {
  /** Linjene i etiketten (én eller to). */
  lines: string[];
  /** x for teksten og hvilken ende av teksten x er. */
  x: number;
  anchor: 'start' | 'end';
  /** Grunnlinjen til hver linje. */
  ys: number[];
  /** Venstre og høyre kant av den bredeste linja (til testene). */
  left: number;
  right: number;
}

/**
 * Etiketten «forbi hånda: −7,50 m/s» ved punktet der v-t-linja passerer v = −v₀. Linja går skrått ned mot høyre gjennom
 * punktet, og den stiplede hjelpelinja går vannrett inn fra v-aksen. Under hjelpelinja til venstre for punktet og over
 * den til høyre for punktet går v-t-linja utenom teksten. Vi prøver i denne rekkefølgen:
 *   1. én linje under hjelpelinja, til venstre for punktet
 *   2. én linje over hjelpelinja, til høyre for punktet
 *   3. to linjer («forbi hånda:» og «−7,50 m/s») under hjelpelinja, til venstre for punktet
 *   4. to linjer over hjelpelinja, til høyre for punktet
 *   5. to linjer under hjelpelinja, så langt til venstre som grafområdet tillater
 * Teksten holder seg alltid innenfor [x0 + 4, x1 − 4].
 */
export function placePassLabel({ px, py, x0, x1, f, text, head, tail, size }: PassLabelInput): PassLabel {
  const gap = 12 * f;
  const lo = x0 + 4;
  const hi = x1 - 4;
  const below = py + 22 * f;
  const lineH = 17 * size * f * 1.2;
  const w1 = labelWidth(text, size, f);
  const w2 = Math.max(labelWidth(head, size, f), labelWidth(tail, size, f));
  if (px - gap - w1 >= lo) return { lines: [text], x: px - gap, anchor: 'end', ys: [below], left: px - gap - w1, right: px - gap };
  if (px + gap + w1 <= hi) return { lines: [text], x: px + gap, anchor: 'start', ys: [py - 10 * f], left: px + gap, right: px + gap + w1 };
  if (px - gap - w2 >= lo) return { lines: [head, tail], x: px - gap, anchor: 'end', ys: [below, below + lineH], left: px - gap - w2, right: px - gap };
  const above = py - 10 * f;
  if (px + gap + w2 <= hi) return { lines: [head, tail], x: px + gap, anchor: 'start', ys: [above - lineH, above], left: px + gap, right: px + gap + w2 };
  const x = Math.max(lo + w2, Math.min(px - gap, hi));
  return { lines: [head, tail], x, anchor: 'end', ys: [below, below + lineH], left: x - w2, right: x };
}
