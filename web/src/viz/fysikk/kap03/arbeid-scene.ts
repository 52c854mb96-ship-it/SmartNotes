/**
 * Geometrien i scenen «Arbeid: dra en kjelke på skrå» (ren matematikk uten React, så den kan testes):
 * hvor tauet er festet på kjelken, og hvor hendene til den som drar, må være for at tauet skal danne
 * vinkelen α med bevegelsesretningen.
 *
 * Alle mål er i meter, med origo midt under meiene på snøen, x i bevegelsesretningen (mot høyre) og y opp.
 */

const DEG = Math.PI / 180;

export interface Vec {
  x: number;
  y: number;
}

/** Tauet er bundet rundt den bøyde fronten på meien (foran) eller bakerst på setet (bak). */
export const ATTACH_FRONT: Vec = { x: 0.5, y: 0.25 };
export const ATTACH_REAR: Vec = { x: -0.4, y: 0.29 };

/** Hvor høyt hendene holder tauet når personen står og drar (m): 1,0 m for vannrett drag, høyere jo brattere. */
export function naturalHandHeight(alphaEffDeg: number): number {
  return 1.0 + 0.55 * Math.sin(clamp(alphaEffDeg, 0, 90) * DEG);
}

/** Det laveste hendene kommer når personen bøyer knærne og drar lavt (m). */
export const HAND_LOW = 0.7;

export interface PullLayout {
  /** +1: personen står foran kjelken (α ≤ 90°). −1: personen står bak og holder igjen (α > 90°). */
  side: 1 | -1;
  /** Vinkelen mellom tauet og snøen (0–90°): α foran, 180° − α bak. */
  alphaEff: number;
  /** Festet for tauet på kjelken. */
  attach: Vec;
  /** Enhetsvektor langs tauet fra festet mot hendene: (cos α, sin α). Samme retning som kraften F. */
  dir: Vec;
  /** Vannrett avstand fra festet til hendene (m). Uendelig når tauet er vannrett. */
  d: number;
  /** Høyden til hendene over snøen (m). */
  handHeight: number;
  /** Hendene (m), langs tauet. */
  hand: Vec;
  /** Tauets lengde fra festet til hendene (m). */
  ropeLength: number;
  /** Hvor mye personen bøyer knærne for å holde tauet lavt nok (0 = står, 1 = dypt). */
  crouch: number;
  /** Om hendene er innenfor `dMax` fra festet (ellers står personen utenfor bildet). */
  visible: boolean;
}

/**
 * Hvor tauet går og hvor personen står, for vinkelen α (0–180°) mellom kraften og bevegelsesretningen.
 * Personen står så tauet får akkurat vinkelen α: hendene holder tauet i naturlig høyde, og bøyer knærne når det
 * ellers ville blitt for langt (mer enn `dMax` meter vannrett). Ved svært små vinkler står personen likevel lenger
 * unna enn `dMax`, og da er `visible` usann (tauet går ut av bildet).
 */
export function pullLayout(alphaDeg: number, dMax: number): PullLayout {
  const a = clamp(Number.isFinite(alphaDeg) ? alphaDeg : 0, 0, 180);
  const side: 1 | -1 = a <= 90 ? 1 : -1;
  const alphaEff = side === 1 ? a : 180 - a;
  const attach = side === 1 ? ATTACH_FRONT : ATTACH_REAR;
  const cos = Math.abs(Math.cos(a * DEG)) < 1e-12 ? 0 : Math.cos(a * DEG);
  const sin = Math.abs(Math.sin(a * DEG)) < 1e-12 ? 0 : Math.sin(a * DEG);
  const dir = { x: cos, y: sin };
  const tan = Math.tan(alphaEff * DEG);
  const hNat = naturalHandHeight(alphaEff);

  let handHeight: number;
  let d: number;
  if (alphaEff >= 90 - 1e-9) {
    handHeight = hNat;
    d = 0;
  } else if (!(tan > 0)) {
    // Vannrett tau: hendene måtte vært like lavt som festet. Personen står langt utenfor bildet.
    handHeight = attach.y;
    d = Infinity;
  } else {
    const dNat = (hNat - attach.y) / tan;
    if (dNat <= dMax) {
      handHeight = hNat;
      d = dNat;
    } else {
      handHeight = Math.max(HAND_LOW, attach.y + dMax * tan);
      d = (handHeight - attach.y) / tan;
    }
  }
  const visible = Number.isFinite(d) && d <= dMax + 1e-9;
  const ropeLength = Number.isFinite(d) ? Math.hypot(d, handHeight - attach.y) : Infinity;
  const hand = Number.isFinite(d) ? { x: attach.x + side * d, y: handHeight } : { x: attach.x + side * dMax, y: attach.y };
  const crouch = clamp((naturalHandHeight(0) - handHeight) / (naturalHandHeight(0) - HAND_LOW), 0, 1);
  return { side, alphaEff, attach, dir, d, handHeight, hand, ropeLength, crouch, visible };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
