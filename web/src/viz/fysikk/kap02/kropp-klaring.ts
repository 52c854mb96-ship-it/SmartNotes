/**
 * Hvor en loddrett kraftpil kan stå uten å dekke en person, til k2-luftmotstand og k2-strikkhopp. Kroppen er en
 * samling «pølser» (linjestykker med en radius) laget av punktene fra personPunkter. Ren geometri uten React, testet
 * i kropp-klaring.test.ts.
 *
 * Bruk: når en person henger eller stuper loddrett, går G-pila fra tyngdepunktet langs hele kroppen. Da tegnes pila
 * litt til siden (`ledigX`) med en stiplet strek inn til tyngdepunktet, så kroppen fortsatt synes.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Et linjestykke fra a til b med tykkelsen 2r (en arm, et bein, overkroppen) eller en sirkel (a = b, hodet). */
export interface KroppsDel {
  a: Pt;
  b: Pt;
  r: number;
}

/** Punktene fra personPunkter som trengs her. */
export interface KroppsPunkter {
  hode: Pt;
  nakke: Pt;
  skulder: Pt;
  hofte: Pt;
  venstreHand: Pt;
  hoyreHand: Pt;
  venstreAnkel: Pt;
  hoyreAnkel: Pt;
  venstreFot: Pt;
  hoyreFot: Pt;
}

/**
 * Kroppen som linjestykker med radius, for en person som er `size` høy (fra sålene til toppen av hodet).
 * Albuer og knær er ikke med (armer og bein regnes som rette), så bruk litt luft (`gap`) i ledigX.
 * `ekstra` gjør overkroppen tykkere, f.eks. for en fallskjermsekk.
 */
export function kroppsdeler(p: KroppsPunkter, size: number, ekstra = 0): KroppsDel[] {
  const s = Math.max(0, size);
  return [
    { a: p.hode, b: p.hode, r: 0.085 * s },
    { a: p.nakke, b: p.hofte, r: (0.075 + ekstra) * s },
    { a: p.skulder, b: p.venstreHand, r: 0.035 * s },
    { a: p.skulder, b: p.hoyreHand, r: 0.035 * s },
    { a: p.hofte, b: p.venstreAnkel, r: 0.05 * s },
    { a: p.hofte, b: p.hoyreAnkel, r: 0.05 * s },
    { a: p.venstreAnkel, b: p.venstreFot, r: 0.035 * s },
    { a: p.hoyreAnkel, b: p.hoyreFot, r: 0.035 * s },
  ];
}

export interface LedigOpts {
  /** Der streken helst skal stå (x for en loddrett strek, y for en vannrett). */
  start: number;
  /** Streken går fra `fra` til `til` på den andre aksen (rekkefølgen spiller ingen rolle). */
  fra: number;
  til: number;
  /** Minste avstand mellom streken og kroppen. */
  gap: number;
  /** Hvilken vei streken flyttes: +1 = mot større x (eller y), −1 = mot mindre. */
  dir?: 1 | -1;
  /**
   * Et stykke langs streken [fra, til] der kroppen ikke teller: pila får gå gjennom kroppen like ved angrepspunktet
   * (tykkelsen av en kropp som ligger på tvers), men ikke langs kroppen.
   */
  fri?: [number, number];
}

/** Punkter langs alle delene, tett nok til at ingen del slipper mellom. */
function samples(deler: KroppsDel[]): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (const d of deler) {
    if (!(d.r > 0) || ![d.a.x, d.a.y, d.b.x, d.b.y].every(Number.isFinite)) continue;
    const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
    const n = Math.max(1, Math.ceil(len / Math.max(1, d.r * 0.5)));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      out.push({ x: d.a.x + (d.b.x - d.a.x) * u, y: d.a.y + (d.b.y - d.a.y) * u, r: d.r });
    }
  }
  return out;
}

function ledig(deler: KroppsDel[], o: LedigOpts, axis: 'x' | 'y'): number {
  const dir = o.dir ?? 1;
  const lo = Math.min(o.fra, o.til);
  const hi = Math.max(o.fra, o.til);
  // Intervallene på aksen der streken ville kommet for nær et punkt på kroppen.
  const iv: [number, number][] = [];
  for (const s of samples(deler)) {
    const along = axis === 'x' ? s.y : s.x;
    if (o.fri && along > Math.min(o.fri[0], o.fri[1]) && along < Math.max(o.fri[0], o.fri[1])) continue;
    const across = axis === 'x' ? s.x : s.y;
    const d = Math.max(0, lo - along, along - hi);
    const R = s.r + o.gap;
    if (d >= R) continue;
    const w = Math.sqrt(R * R - d * d);
    iv.push([across - w, across + w]);
  }
  let x = o.start;
  for (let pass = 0; pass <= iv.length; pass++) {
    let moved = false;
    for (const [a, b] of iv) {
      if (x > a && x < b) {
        x = dir > 0 ? b : a;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return x;
}

/**
 * Den nærmeste x fra `start` (i retning `dir`) der en loddrett strek fra y = `fra` til y = `til` holder minst `gap`
 * fra kroppen. Er det ledig allerede, kommer `start` tilbake.
 */
export function ledigX(deler: KroppsDel[], o: LedigOpts): number {
  return ledig(deler, o, 'x');
}

/** Som ledigX, men for en vannrett strek fra x = `fra` til x = `til`: den nærmeste ledige y fra `start`. */
export function ledigY(deler: KroppsDel[], o: LedigOpts): number {
  return ledig(deler, o, 'y');
}
