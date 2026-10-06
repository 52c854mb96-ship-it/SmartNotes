/**
 * Tegnehjelp til «Eksplosjon og rekyl» (ingen React, så det kan testes): høyden til en skøyteløper etter massen,
 * beina til en person som står med flate såler i en skrittstilling, når det første legemet når kanten av figuren, og
 * størrelsen på en geværkule.
 */
import { SHIN, SOLE, THIGH } from '../../kit/scene/figurer-skjelett';

/** Typisk høyde (m) for et barn eller en voksen med massen m (kg), så et barn på 30 kg ser ut som et barn. */
const HEIGHTS: [number, number][] = [
  [20, 1.15],
  [30, 1.33],
  [40, 1.48],
  [50, 1.6],
  [60, 1.69],
  [70, 1.76],
  [80, 1.81],
  [100, 1.88],
];

/** Høyden (m) til en person med massen m (kg), lineært mellom typiske verdier for barn og voksne. */
export function skaterHeight(m: number): number {
  const first = HEIGHTS[0]!;
  const last = HEIGHTS[HEIGHTS.length - 1]!;
  if (!(m > first[0])) return first[1];
  if (m >= last[0]) return last[1];
  for (let i = 1; i < HEIGHTS.length; i++) {
    const [m1, h1] = HEIGHTS[i]!;
    const [m0, h0] = HEIGHTS[i - 1]!;
    if (m <= m1) return h0 + ((h1 - h0) * (m - m0)) / (m1 - m0);
  }
  return last[1];
}

export interface LegAngles {
  venstreHofte: number;
  hoyreHofte: number;
  venstreKne: number;
  hoyreKne: number;
  venstreAnkel: number;
  hoyreAnkel: number;
}

/**
 * Leddvinklene (grader, som `Leddvinkler` i scene-kit-et) for en person som står med begge sålene flatt på bakken
 * i en skrittstilling. Personen er 100 enheter høy; hofteleddet er i origo, x fram og y ned. `rygg` er overkroppens
 * helning (positiv forover), `drop` hvor høyt hofta er over sålene (et strakt bein gir ca. 52,7), og `back`/`front`
 * hvor ankelen på det bakerste (venstre) og fremste (høyre) beinet står, målt fram fra hofta.
 */
export function stanceLegs(rygg: number, drop: number, back: number, front: number): LegAngles {
  const leg = (u: number) => {
    // Ankelen står SOLE over sålen (flat fot), og kneet bøyes fram (to-ledds invers kinematikk).
    const ax = u;
    const ay = drop - SOLE;
    const d = Math.min(Math.max(Math.hypot(ax, ay), Math.abs(THIGH - SHIN) + 0.01), THIGH + SHIN - 0.01);
    const base = Math.atan2(ax, ay);
    const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
    const phiT = base + Math.acos(Math.min(1, Math.max(-1, cosA)));
    const kx = Math.sin(phiT) * THIGH;
    const ky = Math.cos(phiT) * THIGH;
    const ex = (ax / Math.hypot(ax, ay)) * d;
    const ey = (ay / Math.hypot(ax, ay)) * d;
    const phiS = Math.atan2(ex - kx, ey - ky);
    const deg = 180 / Math.PI;
    // Hofte = lårets vinkel mot overkroppen, kne = bøyen, ankel = flat såle (foten rett vinkel mot bakken).
    return { hofte: phiT * deg + rygg, kne: (phiT - phiS) * deg, ankel: phiS * deg };
  };
  const b = leg(back);
  const f = leg(front);
  return {
    venstreHofte: b.hofte,
    hoyreHofte: f.hofte,
    venstreKne: b.kne,
    hoyreKne: f.kne,
    venstreAnkel: b.ankel,
    hoyreAnkel: f.ankel,
  };
}

/**
 * Tiden (s) til det første legemet når kanten av området [lo, hi], når legemene starter i `starts` og har farten
 * `speeds` (samme enhet). Legemer som står stille, når aldri kanten. Høyst `cap`, og aldri negativ.
 */
export function exitTime(starts: number[], speeds: number[], lo: number, hi: number, cap: number): number {
  let t = cap;
  starts.forEach((x, i) => {
    const v = speeds[i] ?? 0;
    if (v > 1e-9) t = Math.min(t, (hi - x) / v);
    else if (v < -1e-9) t = Math.min(t, (lo - x) / v);
  });
  return Math.max(0, t);
}

/** Lengden og diameteren (m) på en geværkule med massen m (kg): en kule på 10 g er ca. 30 mm lang og 7,8 mm tykk. */
export function bulletSize(m: number): { length: number; diameter: number } {
  const k = Math.cbrt(Math.max(1e-6, m) / 0.01);
  return { length: 0.03 * k, diameter: 0.0078 * k };
}
