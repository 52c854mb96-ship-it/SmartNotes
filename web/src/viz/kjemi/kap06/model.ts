/**
 * Kapittel 6 Likevekter (Kjemi 1): reaksjonsfart og kollisjonsteori, likevekt som innstilles (dynamisk likevekt),
 * likevektsberegninger (start, endring, likevekt) og Le Chateliers prinsipp. Ren kjemi uten React, testet i
 * model.test.ts.
 *
 * Konvensjoner: konsentrasjoner i mol/L, K er konsentrasjonslikevektskonstanten K (Kc) uten enhet slik lærebøkene
 * skriver den, rene væsker og løsemiddelet (vann i vannløsning) er ikke med i K. ν (ny) er koeffisienten med fortegn:
 * negativ for reaktanter, positiv for produkter.
 */
import { seededRandom } from '../kit/random';

/** Gasskonstanten R (J/(mol·K)). */
export const R_GAS = 8.314;
/** 0 °C i kelvin. */
export const T0 = 273.15;

/* ====================================================================== */
/* Likevektsberegning                                                       */
/* ====================================================================== */

/** Reaksjonskvotienten Q = Π cᵢ^νᵢ. Q = 0 når et produkt mangler, ∞ når en reaktant mangler (og produktene finnes). */
export function quotient(nu: readonly number[], c: readonly number[]): number {
  let num = 1;
  let den = 1;
  nu.forEach((v, i) => {
    const ci = Math.max(0, c[i] ?? 0);
    if (v > 0) num *= ci ** v;
    else if (v < 0) den *= ci ** -v;
  });
  if (den === 0) return num === 0 ? Number.NaN : Infinity;
  return num / den;
}

/**
 * Grensene for omsetningen x (mol/L, positiv mot høyre) slik at ingen konsentrasjon blir negativ:
 * x ≥ −cᵢ/νᵢ for produktene og x ≤ cᵢ/|νᵢ| for reaktantene.
 */
export function extentBounds(nu: readonly number[], c0: readonly number[]): [number, number] {
  let lo = -Infinity;
  let hi = Infinity;
  nu.forEach((v, i) => {
    const c = Math.max(0, c0[i] ?? 0);
    if (v > 0) lo = Math.max(lo, -c / v + 0);
    else if (v < 0) hi = Math.min(hi, c / -v);
  });
  return [lo, hi];
}

export interface EquilibriumResult {
  /** Omsetningen x (mol/L): positiv når reaksjonen går mot høyre, negativ mot venstre. */
  x: number;
  /** Likevektskonsentrasjonene. */
  c: number[];
  /** Q i startblandingen. */
  q0: number;
  /** Antall halveringer. */
  iterations: number;
}

/**
 * Likevektskonsentrasjonene fra startkonsentrasjonene c0 og K: finner x slik at Q(c0 + ν·x) = K ved halvering
 * (bisection). ln Q vokser hele veien fra −∞ (et produkt er brukt opp) til +∞ (en reaktant er brukt opp), så det finnes
 * alltid nøyaktig én løsning, og halveringen finner den uansett hvor stor eller liten K er.
 */
export function solveEquilibrium(nu: readonly number[], c0: readonly number[], K: number): EquilibriumResult {
  const q0 = quotient(nu, c0);
  const [lo0, hi0] = extentBounds(nu, c0);
  if (!(K > 0) || !Number.isFinite(K) || !(hi0 > lo0) || !Number.isFinite(lo0) || !Number.isFinite(hi0)) {
    return { x: 0, c: c0.map((c) => Math.max(0, c)), q0, iterations: 0 };
  }
  const lnK = Math.log(K);
  const g = (x: number) => {
    let s = -lnK;
    for (let i = 0; i < nu.length; i++) {
      const v = nu[i]!;
      if (v === 0) continue;
      const c = (c0[i] ?? 0) + v * x;
      s += v * Math.log(Math.max(c, 0));
    }
    return s;
  };
  let lo = lo0;
  let hi = hi0;
  let it = 0;
  while (it < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo), Math.abs(hi))) {
    const mid = (lo + hi) / 2;
    if (mid <= lo || mid >= hi) break;
    if (g(mid) < 0) lo = mid;
    else hi = mid;
    it++;
  }
  const x = (lo + hi) / 2;
  return { x, c: nu.map((v, i) => Math.max(0, (c0[i] ?? 0) + v * x)), q0, iterations: it };
}

/** Hvilken vei reaksjonen går for å nå likevekt: Q < K mot høyre, Q > K mot venstre. */
export function direction(q: number, K: number, tol = 1e-6): 'høyre' | 'venstre' | 'likevekt' {
  if (Number.isNaN(q)) return 'likevekt';
  if (q === Infinity) return 'venstre';
  if (Math.abs(Math.log(Math.max(q, 1e-300) / K)) < tol) return 'likevekt';
  return q < K ? 'høyre' : 'venstre';
}

export interface IceSpecies {
  /** Formelen («H2», «HI») eller en bokstav («A») i de generelle reaksjonene. */
  formula: string;
  /** Koeffisient med fortegn: −1 for reaktanten A, +2 for produktet 2 C. */
  nu: number;
}

export interface IcePreset {
  id: string;
  label: string;
  species: IceSpecies[];
  /** Fast K fra data, eller null når eleven velger K selv. */
  K: number | null;
  /** Når og hvor K gjelder («ved 430 °C»). */
  Ktext?: string;
  /** Startkonsentrasjoner (mol/L). */
  c0: number[];
  /** Bokstaver i stedet for formler. */
  generic?: boolean;
  /** Tilstand som vises i likningen. */
  state?: 'g' | 'l';
}

/**
 * Forvalg til likevektsberegningen. K-verdiene er vanlige lærebokverdier (Kc): H₂ + I₂ ⇌ 2 HI K = 54 ved 430 °C,
 * N₂O₄ ⇌ 2 NO₂ K = 4,6 · 10⁻³ ved 25 °C, N₂ + 3 H₂ ⇌ 2 NH₃ K = 0,50 ved 400 °C, 2 SO₂ + O₂ ⇌ 2 SO₃ K = 2,8 · 10² ved
 * 1000 K (Chang, Chemistry), og forestringen etansyre + etanol K ≈ 4 (Berthelot; vannet er et produkt og er med i K).
 */
export const ICE_PRESETS: IcePreset[] = [
  {
    id: 'hi',
    label: 'H₂ + I₂ ⇌ 2 HI',
    species: [
      { formula: 'H2', nu: -1 },
      { formula: 'I2', nu: -1 },
      { formula: 'HI', nu: 2 },
    ],
    K: 54,
    Ktext: 'ved 430 °C',
    c0: [1, 1, 0],
    state: 'g',
  },
  {
    id: 'n2o4',
    label: 'N₂O₄ ⇌ 2 NO₂',
    species: [
      { formula: 'N2O4', nu: -1 },
      { formula: 'NO2', nu: 2 },
    ],
    K: 4.6e-3,
    Ktext: 'ved 25 °C',
    c0: [0.5, 0],
    state: 'g',
  },
  {
    id: 'nh3',
    label: 'N₂ + 3 H₂ ⇌ 2 NH₃',
    species: [
      { formula: 'N2', nu: -1 },
      { formula: 'H2', nu: -3 },
      { formula: 'NH3', nu: 2 },
    ],
    K: 0.5,
    Ktext: 'ved 400 °C',
    c0: [1, 1.5, 0],
    state: 'g',
  },
  {
    id: 'so3',
    label: '2 SO₂ + O₂ ⇌ 2 SO₃',
    species: [
      { formula: 'SO2', nu: -2 },
      { formula: 'O2', nu: -1 },
      { formula: 'SO3', nu: 2 },
    ],
    K: 280,
    Ktext: 'ved 1000 K',
    c0: [0.5, 0.5, 0],
    state: 'g',
  },
  {
    id: 'ester',
    label: 'Forestring: etansyre + etanol',
    species: [
      { formula: 'CH3COOH', nu: -1 },
      { formula: 'C2H5OH', nu: -1 },
      { formula: 'CH3COOC2H5', nu: 1 },
      { formula: 'H2O', nu: 1 },
    ],
    K: 4,
    Ktext: 'ved romtemperatur (omtrent)',
    c0: [1, 1, 0, 0],
    state: 'l',
  },
  {
    id: 'ab-cd',
    label: 'A + B ⇌ C + D',
    species: [
      { formula: 'A', nu: -1 },
      { formula: 'B', nu: -1 },
      { formula: 'C', nu: 1 },
      { formula: 'D', nu: 1 },
    ],
    K: null,
    c0: [1, 0.5, 0, 0],
    generic: true,
  },
  {
    id: 'a-2c',
    label: 'A ⇌ 2 C',
    species: [
      { formula: 'A', nu: -1 },
      { formula: 'C', nu: 2 },
    ],
    K: null,
    c0: [1, 0],
    generic: true,
  },
  {
    id: 'ab-2c',
    label: 'A + B ⇌ 2 C',
    species: [
      { formula: 'A', nu: -1 },
      { formula: 'B', nu: -1 },
      { formula: 'C', nu: 2 },
    ],
    K: null,
    c0: [1, 1, 0],
    generic: true,
  },
  {
    id: 'a3b-2c',
    label: 'A + 3 B ⇌ 2 C',
    species: [
      { formula: 'A', nu: -1 },
      { formula: 'B', nu: -3 },
      { formula: 'C', nu: 2 },
    ],
    K: null,
    c0: [1, 1.5, 0],
    generic: true,
  },
  {
    id: '2ab-2c',
    label: '2 A + B ⇌ 2 C',
    species: [
      { formula: 'A', nu: -2 },
      { formula: 'B', nu: -1 },
      { formula: 'C', nu: 2 },
    ],
    K: null,
    c0: [1, 1, 0],
    generic: true,
  },
];

/** Likningen som tekst til kit-ets Reaksjon («H2(g) + I2(g) ⇌ 2 HI(g)»). Bare for forvalg med ekte formler. */
export function iceEquation(p: IcePreset): string {
  const side = (list: IceSpecies[]) =>
    list.map((s) => `${Math.abs(s.nu) === 1 ? '' : `${Math.abs(s.nu)} `}${s.formula}${p.state && !p.generic ? `(${p.state})` : ''}`).join(' + ');
  return `${side(p.species.filter((s) => s.nu < 0))} ⇌ ${side(p.species.filter((s) => s.nu > 0))}`;
}

/* ====================================================================== */
/* Likevekt innstilles: kinetikk                                            */
/* ====================================================================== */

export interface KineticsSample {
  t: number;
  /** Konsentrasjonene (mol/L) i samme rekkefølge som artene i systemet. */
  c: number[];
  /** Farten mot høyre og mot venstre (mol/(L·s)). */
  rf: number;
  rb: number;
  q: number;
}

/** Summen kf + kb for A ⇌ B (1/s): bestemmer hvor fort likevekten innstilles (tidskonstant 1/(kf + kb)). */
export const AB_RATE_SUM = 0.8;

/** Fartskonstantene for A ⇌ B med likevektskonstant K = kf/kb. */
export function abRateConstants(K: number): { kf: number; kb: number } {
  return { kf: (AB_RATE_SUM * K) / (1 + K), kb: AB_RATE_SUM / (1 + K) };
}

/**
 * A ⇌ B med fart mot høyre kf·[A] og mot venstre kb·[B] (første orden begge veier). Eksakt løsning:
 * [A](t) = [A]ₗ + ([A]₀ − [A]ₗ)·e^(−(kf+kb)t), der [A]ₗ = ([A]₀ + [B]₀)·kb/(kf + kb).
 */
export function simulateAB(a0: number, b0: number, K: number, tMax: number, n = 200): KineticsSample[] {
  const { kf, kb } = abRateConstants(K);
  const S = a0 + b0;
  const aEq = (S * kb) / (kf + kb);
  const out: KineticsSample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (tMax * i) / n;
    const A = aEq + (a0 - aEq) * Math.exp(-(kf + kb) * t);
    const B = S - A;
    out.push({ t, c: [A, B], rf: kf * A, rb: kb * B, q: quotient([-1, 1], [A, B]) });
  }
  return out;
}

/** Fartskonstanten mot høyre for H₂ + I₂ → 2 HI i modellen (L/(mol·s)). Tidsskalaen er valgt for visningen. */
export const HI_KF = 0.6;
/** K for H₂ + I₂ ⇌ 2 HI ved 430 °C. */
export const HI_K = 54;

/**
 * H₂ + I₂ ⇌ 2 HI med fart mot høyre r_f = kf·[H₂][I₂] og mot venstre r_b = kb·[HI]², kb = kf/K. Løses med RK4 (fast
 * steg). d[H₂]/dt = d[I₂]/dt = −(r_f − r_b), d[HI]/dt = 2(r_f − r_b).
 */
export function simulateHI(h0: number, i0: number, hi0: number, tMax: number, n = 200, K = HI_K, kf = HI_KF): KineticsSample[] {
  const kb = kf / K;
  const net = (x: number) => {
    const H = Math.max(0, h0 - x);
    const I = Math.max(0, i0 - x);
    const HI = Math.max(0, hi0 + 2 * x);
    return kf * H * I - kb * HI * HI;
  };
  const sub = 10;
  const dt = tMax / n / sub;
  let x = 0;
  const out: KineticsSample[] = [];
  const sample = (t: number) => {
    const c = [Math.max(0, h0 - x), Math.max(0, i0 - x), Math.max(0, hi0 + 2 * x)];
    out.push({ t, c, rf: kf * c[0]! * c[1]!, rb: kb * c[2]! * c[2]!, q: quotient([-1, -1, 2], c) });
  };
  sample(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < sub; j++) {
      const k1 = net(x);
      const k2 = net(x + (dt / 2) * k1);
      const k3 = net(x + (dt / 2) * k2);
      const k4 = net(x + dt * k3);
      x += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    sample((tMax * i) / n);
  }
  return out;
}

/** Verdien i en tidsserie ved tiden t (lineær interpolasjon). */
export function sampleAt(samples: KineticsSample[], t: number): KineticsSample {
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (t <= first.t) return first;
  if (t >= last.t) return last;
  const step = (last.t - first.t) / (samples.length - 1);
  const i = Math.min(samples.length - 2, Math.floor((t - first.t) / step));
  const a = samples[i]!;
  const b = samples[i + 1]!;
  const u = (t - a.t) / (b.t - a.t);
  const c = a.c.map((v, k) => v + (b.c[k]! - v) * u);
  return { t, c, rf: a.rf + (b.rf - a.rf) * u, rb: a.rb + (b.rb - a.rb) * u, q: a.q + (b.q - a.q) * u };
}

/* ---------- Partikkelbildet: tilfeldige omdanninger med fast frø ---------- */

export interface ParticleEvent {
  t: number;
  /** Plassene (partiklene) som endres, og hva de blir til (indeks i artslista). */
  slots: number[];
  to: number[];
  /** Reaksjonen mot høyre (true) eller mot venstre. */
  forward: boolean;
}

export interface ParticleRun {
  /** Arten på hver plass ved t = 0 (indeks i artslista). */
  initial: number[];
  events: ParticleEvent[];
}

/**
 * Stokastisk simulering (Gillespie) av A ⇌ B med nA og nB partikler: hver A blir til B med fart kf, hver B til A med
 * fart kb. Gjennomsnittet følger simulateAB, men omdanningene fortsetter i begge retninger også ved likevekt.
 */
export function stochasticAB(nA: number, nB: number, K: number, tMax: number, seed = 1): ParticleRun {
  const { kf, kb } = abRateConstants(K);
  const rnd = seededRandom(seed);
  const initial = [...Array.from({ length: nA }, () => 0), ...Array.from({ length: nB }, () => 1)];
  shuffle(initial, rnd);
  const state = [...initial];
  const events: ParticleEvent[] = [];
  let t = 0;
  for (let guard = 0; guard < 20000; guard++) {
    const a = state.filter((s) => s === 0).length;
    const b = state.length - a;
    const af = kf * a;
    const ab = kb * b;
    const total = af + ab;
    if (!(total > 0)) break;
    t += -Math.log(1 - rnd()) / total;
    if (t > tMax) break;
    const forward = rnd() * total < af;
    const from = forward ? 0 : 1;
    const slot = pickSlot(state, from, rnd);
    state[slot] = 1 - from;
    events.push({ t, slots: [slot], to: [1 - from], forward });
  }
  return { initial, events };
}

/**
 * Stokastisk simulering av H₂ + I₂ ⇌ 2 HI med molekyler på faste plasser (arter: 0 = H₂, 1 = I₂, 2 = HI). Mot høyre
 * blir ett H₂ og ett I₂ til to HI; mot venstre blir to HI til H₂ og I₂, så antall molekyler er alltid det samme.
 * `omega` = antall molekyler per mol/L. Fartene følger massevirkningsloven: kf·nH₂·nI₂/Ω og kb·nHI(nHI − 1)/Ω.
 */
export function stochasticHI(nH2: number, nI2: number, nHI: number, omega: number, tMax: number, seed = 1, K = HI_K, kf = HI_KF): ParticleRun {
  const kb = kf / K;
  const rnd = seededRandom(seed);
  const initial = [...Array.from({ length: nH2 }, () => 0), ...Array.from({ length: nI2 }, () => 1), ...Array.from({ length: nHI }, () => 2)];
  shuffle(initial, rnd);
  const state = [...initial];
  const events: ParticleEvent[] = [];
  let t = 0;
  for (let guard = 0; guard < 20000; guard++) {
    const h = state.filter((s) => s === 0).length;
    const i = state.filter((s) => s === 1).length;
    const hi = state.length - h - i;
    const af = (kf * h * i) / omega;
    const ab = (kb * hi * (hi - 1)) / omega;
    const total = af + ab;
    if (!(total > 0)) break;
    t += -Math.log(1 - rnd()) / total;
    if (t > tMax) break;
    if (rnd() * total < af) {
      const s1 = pickSlot(state, 0, rnd);
      const s2 = pickSlot(state, 1, rnd);
      state[s1] = 2;
      state[s2] = 2;
      events.push({ t, slots: [s1, s2], to: [2, 2], forward: true });
    } else {
      const s1 = pickSlot(state, 2, rnd);
      state[s1] = 0;
      const s2 = pickSlot(state, 2, rnd);
      state[s2] = 1;
      events.push({ t, slots: [s1, s2], to: [0, 1], forward: false });
    }
  }
  return { initial, events };
}

function shuffle<T>(a: T[], rnd: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
}

function pickSlot(state: number[], kind: number, rnd: () => number): number {
  const idx: number[] = [];
  state.forEach((s, i) => s === kind && idx.push(i));
  return idx[Math.floor(rnd() * idx.length)] ?? 0;
}

/** Arten på hver plass ved tiden t, og hvor lenge siden hver plass sist ble endret (Infinity hvis aldri). */
export function particleStateAt(run: ParticleRun, t: number): { kind: number[]; since: number[]; forward: (boolean | null)[] } {
  const kind = [...run.initial];
  const since = run.initial.map(() => Infinity);
  const forward: (boolean | null)[] = run.initial.map(() => null);
  for (const e of run.events) {
    if (e.t > t) break;
    e.slots.forEach((s, k) => {
      kind[s] = e.to[k]!;
      since[s] = t - e.t;
      forward[s] = e.forward;
    });
  }
  return { kind, since, forward };
}

/** Antall omdanninger mot høyre og mot venstre i tidsrommet (t − vindu, t]. */
export function recentEvents(run: ParticleRun, t: number, window = 1): { forward: number; backward: number } {
  let forward = 0;
  let backward = 0;
  for (const e of run.events) {
    if (e.t > t) break;
    if (e.t > t - window) {
      if (e.forward) forward++;
      else backward++;
    }
  }
  return { forward, backward };
}

/* ====================================================================== */
/* Le Chateliers prinsipp                                                   */
/* ====================================================================== */

/** Likevektskonstanten ved temperaturen T (K) etter van 't Hoffs likning, med ΔH (kJ/mol) som konstant. */
export function vantHoff(K0: number, T0K: number, T: number, dH: number): number {
  return K0 * Math.exp(((-dH * 1000) / R_GAS) * (1 / T - 1 / T0K));
}

export type LcSystemId = 'haber' | 'tiocyanat' | 'kobolt';

export interface LcSpecies {
  formula: string;
  /** Koeffisient med fortegn (negativ for reaktanter). */
  nu: number;
  name: string;
  /** Med i K (vann som løsemiddel er ikke med). */
  inK: boolean;
}

export interface LcSystem {
  id: LcSystemId;
  name: string;
  /** Likningen til kit-ets Reaksjon. */
  equation: string;
  species: LcSpecies[];
  /** K ved T0. */
  K0: number;
  /** Temperaturen K0 gjelder ved (K). */
  T0: number;
  /** ΔH for reaksjonen slik den er skrevet (kJ/mol). */
  dH: number;
  /** Gassreaksjon (volum og trykk), ellers vannløsning (fortynning). */
  gas: boolean;
  /** Stoffmengdene som blandes (mol, samme rekkefølge som species; 0 for løsemiddel) i volumet V0 (L). */
  mix: number[];
  V0: number;
  /** Temperaturområdet til glidebryteren (°C). */
  tRange: [number, number];
  /** Visningsenhet for konsentrasjonen: 1 = mol/L, 1000 = mmol/L. */
  unitScale: number;
}

/**
 * De tre systemene.
 * - Haber–Bosch: K = 0,50 ved 400 °C og ΔH = −92 kJ (lærebokverdier). Med van 't Hoff gir det K ≈ 0,1 ved 472 °C,
 *   som stemmer med tabellverdien 0,105.
 * - Jern(III)tiocyanat: K ≈ 9 · 10² ved 25 °C (lav ionestyrke). Reaksjonen er svakt eksoterm; verdiene for ΔH i
 *   litteraturen spriker, så vi bruker −30 kJ/mol som modellverdi (fortegnet er det viktige: rødfargen blir svakere
 *   når løsningen varmes).
 * - Koboltklorid: endoterm mot høyre (rosa → blå ved oppvarming). K og ΔH (+50 kJ/mol) er modellverdier valgt så
 *   blandingen er fiolett ved 25 °C med 6 mol/L Cl⁻, slik som i skoleforsøket.
 */
export const LC_SYSTEMS: LcSystem[] = [
  {
    id: 'haber',
    name: 'Ammoniakk',
    equation: 'N2(g) + 3 H2(g) ⇌ 2 NH3(g)',
    species: [
      { formula: 'N2', nu: -1, name: 'nitrogen', inK: true },
      { formula: 'H2', nu: -3, name: 'hydrogen', inK: true },
      { formula: 'NH3', nu: 2, name: 'ammoniakk', inK: true },
    ],
    K0: 0.5,
    T0: 400 + T0,
    dH: -92,
    gas: true,
    mix: [1, 3, 0],
    V0: 1,
    tRange: [200, 700],
    unitScale: 1,
  },
  {
    id: 'tiocyanat',
    name: 'Jern(III)tiocyanat',
    equation: 'Fe^3+(aq) + SCN^-(aq) ⇌ FeSCN^2+(aq)',
    species: [
      { formula: 'Fe^3+', nu: -1, name: 'jern(III)ioner', inK: true },
      { formula: 'SCN^-', nu: -1, name: 'tiocyanationer', inK: true },
      { formula: 'FeSCN^2+', nu: 1, name: 'jern(III)tiocyanationer', inK: true },
    ],
    K0: 900,
    T0: 25 + T0,
    dH: -30,
    gas: false,
    mix: [0.002, 0.002, 0],
    V0: 1,
    tRange: [0, 80],
    unitScale: 1000,
  },
  {
    id: 'kobolt',
    name: 'Koboltklorid',
    equation: '[Co(H2O)6]^2+(aq) + 4 Cl^-(aq) ⇌ [CoCl4]^2-(aq) + 6 H2O(l)',
    species: [
      { formula: '[Co(H2O)6]^2+', nu: -1, name: 'heksaakvakobolt(II)ioner', inK: true },
      { formula: 'Cl^-', nu: -4, name: 'kloridioner', inK: true },
      { formula: '[CoCl4]^2-', nu: 1, name: 'tetraklorokoboltat(II)ioner', inK: true },
      { formula: 'H2O', nu: 6, name: 'vann', inK: false },
    ],
    K0: 1 / 6 ** 4,
    T0: 25 + T0,
    dH: 50,
    gas: false,
    mix: [0.05, 6, 0, 0],
    V0: 1,
    tRange: [0, 100],
    unitScale: 1,
  },
];

export function lcSystem(id: LcSystemId): LcSystem {
  return LC_SYSTEMS.find((s) => s.id === id) ?? LC_SYSTEMS[0]!;
}

export type Disturbance =
  | { kind: 'stoff'; index: number; factor: number }
  | { kind: 'volum'; V: number }
  | { kind: 'temperatur'; T: number }
  | { kind: 'katalysator' };

export interface LcState {
  /** Stoffmengder (mol) for artene som er med i K (samme indekser som species; 0 for løsemiddel). */
  n: number[];
  V: number;
  /** Temperatur (K). */
  T: number;
  K: number;
  c: number[];
  q: number;
}

export interface LcResult {
  before: LcState;
  /** Rett etter forstyrrelsen, før likevekten har forskjøvet seg. */
  after: LcState;
  /** Ny likevekt. */
  final: LcState;
  /** Omsetningen (mol) fra «rett etter» til ny likevekt: positiv mot høyre. */
  shift: number;
  direction: 'høyre' | 'venstre' | 'ingen';
}

const kIdx = (s: LcSystem) => s.species.map((x, i) => (x.inK ? i : -1)).filter((i) => i >= 0);

function stateOf(s: LcSystem, n: number[], V: number, T: number): LcState {
  const K = vantHoff(s.K0, s.T0, T, s.dH);
  const idx = kIdx(s);
  const c = n.map((x) => x / V);
  return {
    n,
    V,
    T,
    K,
    c,
    q: quotient(
      idx.map((i) => s.species[i]!.nu),
      idx.map((i) => c[i]!),
    ),
  };
}

/** Løser likevekten for artene i K (stoffmengder n i volumet V ved T). Løsemiddelet endres ikke. */
export function equilibrate(s: LcSystem, n: number[], V: number, T: number): { state: LcState; shift: number } {
  const idx = kIdx(s);
  const K = vantHoff(s.K0, s.T0, T, s.dH);
  const nu = idx.map((i) => s.species[i]!.nu);
  const r = solveEquilibrium(
    nu,
    idx.map((i) => n[i]! / V),
    K,
  );
  const out = [...n];
  idx.forEach((i, k) => (out[i] = r.c[k]! * V));
  return { state: stateOf(s, out, V, T), shift: r.x * V };
}

/** Likevekten før, tilstanden rett etter forstyrrelsen og den nye likevekten. */
export function leChatelier(s: LcSystem, d: Disturbance): LcResult {
  const before = equilibrate(s, s.mix, s.V0, s.T0).state;
  let n = [...before.n];
  let V = before.V;
  let T = before.T;
  if (d.kind === 'stoff') n = n.map((x, i) => (i === d.index ? x * Math.max(0, d.factor) : x));
  else if (d.kind === 'volum') V = Math.max(1e-6, d.V);
  else if (d.kind === 'temperatur') T = d.T;
  const after = stateOf(s, n, V, T);
  const eq = equilibrate(s, n, V, T);
  const scale = Math.max(...before.n.map((x, i) => (s.species[i]!.inK ? Math.abs(x) : 0)), 1e-12);
  const dir = Math.abs(eq.shift) < 1e-6 * scale ? 'ingen' : eq.shift > 0 ? 'høyre' : 'venstre';
  return { before, after, final: eq.state, shift: eq.shift, direction: dir };
}

/** Totaltrykket (bar) i en ideell gassblanding: p = n·R·T/V. */
export function gasPressure(nTotal: number, V: number, T: number): number {
  return (nTotal * R_GAS * T) / (V / 1000) / 1e5;
}

/**
 * Konsentrasjonene over tid til grafen: likevekt før (t < 0), sprang ved t = 0 (stoff tilsatt, volum endret) og så
 * en jevn tilnærming til ny likevekt, x(t) = x·(1 − e^(−t/τ)). Formen på kurvene er forenklet; endepunktene er regnet
 * ut fra K. En katalysator gir samme likevekt, bare raskere.
 */
export function lcTimeline(r: LcResult, tau: number, t: number): number[] {
  if (t < 0) return r.before.c;
  const u = 1 - Math.exp(-t / tau);
  return r.after.c.map((c, i) => c + (r.final.c[i]! - c) * u);
}

/* ====================================================================== */
/* Reaksjonsfart og kollisjonsteori                                         */
/* ====================================================================== */

/**
 * Komplementær feilfunksjon (Numerical Recipes, «erfcc»): Tsjebysjov-tilnærming med relativ feil under 1,2 · 10⁻⁷ for
 * alle x, også langt ute i halen.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/**
 * Maxwell–Boltzmann-fordelingen av kinetisk energi (per mol) ved temperaturen T (K):
 * f(E) = 2/√π · (RT)^(−3/2) · √E · e^(−E/RT), med E i kJ/mol. Arealet under kurven er 1.
 */
export function energyDensity(E: number, T: number): number {
  if (!(E > 0)) return 0;
  const kT = (R_GAS * T) / 1000;
  return (2 / Math.sqrt(Math.PI)) * Math.sqrt(E) * kT ** -1.5 * Math.exp(-E / kT);
}

/** Andelen partikler med energi minst Ea (kJ/mol) ved T (K): erfc(√x) + 2√(x/π)·e^(−x), x = Ea/RT. */
export function fractionAbove(Ea: number, T: number): number {
  if (!(Ea > 0)) return 1;
  const x = Ea / ((R_GAS * T) / 1000);
  return erfc(Math.sqrt(x)) + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x);
}

/** Middelenergien 3/2·RT (kJ/mol). */
export const meanEnergy = (T: number) => (1.5 * R_GAS * T) / 1000;

/**
 * Hvor mange ganger raskere reaksjonen går ved T2 enn ved T1: andelen med nok energi øker, og partiklene kolliderer
 * litt oftere fordi de beveger seg raskere (√T).
 */
export function temperatureFactor(Ea: number, T1: number, T2: number): number {
  return (fractionAbove(Ea, T2) / fractionAbove(Ea, T1)) * Math.sqrt(T2 / T1);
}

/** Arrhenius-forholdet e^(−Ea/R·(1/T2 − 1/T1)), som regelen «10 °C dobler farten» bygger på. */
export function arrheniusFactor(Ea: number, T1: number, T2: number): number {
  return Math.exp(((-Ea * 1000) / R_GAS) * (1 / T2 - 1 / T1));
}

/** Katalysatoren senker aktiveringsenergien til denne andelen (modell). */
export const CATALYST_FACTOR = 0.6;

/* ---------- Partikkelboks: syre mot fast stoff (overflate og konsentrasjon) ---------- */

export interface SolidPiece {
  x: number;
  y: number;
  s: number;
}

/** Boksen i modellenheter (bredde × høyde). */
export const BOX_W = 1.6;
export const BOX_H = 1;
/** Sidekanten til det faste stoffet før det deles opp. */
export const SOLID_SIDE = 0.42;
export const PARTICLE_R = 0.022;

/**
 * Det faste stoffet delt i k × k like biter (i planet). Den samlede mengden er den samme, men omkretsen (overflaten)
 * blir k ganger så stor. Bitene spres ut litt, som knust marmor på bunnen.
 */
export function solidPieces(k: number): SolidPiece[] {
  const n = Math.max(1, Math.round(k));
  const s = SOLID_SIDE / n;
  const gap = n === 1 ? 0 : s * 0.9;
  const span = n * s + (n - 1) * gap;
  const x0 = BOX_W / 2 - span / 2;
  const y0 = BOX_H * 0.6 - span / 2;
  const out: SolidPiece[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push({ x: x0 + i * (s + gap), y: y0 + j * (s + gap), s });
  return out;
}

/** Samlet omkrets (overflate i planet) av bitene. */
export function solidSurface(pieces: SolidPiece[]): number {
  return pieces.reduce((sum, p) => sum + 4 * p.s, 0);
}

export interface BoxHit {
  t: number;
  x: number;
  y: number;
  /** Kollisjonen hadde nok energi (E ≥ Ea) og førte til reaksjon. */
  effective: boolean;
}

export interface BoxRun {
  n: number;
  dt: number;
  frames: number;
  /** Posisjoner: frames × n × 2 (x, y). */
  pos: Float32Array;
  hits: BoxHit[];
  tMax: number;
}

/**
 * Syrepartikler (H₃O⁺) som beveger seg rett fram og spretter mot veggene og mot bitene av det faste stoffet. Hvert
 * treff på overflaten er en kollisjon; den er effektiv med sannsynligheten pEffective. Regnet ut steg for steg med
 * fast frø, så samme innstillinger alltid gir samme film.
 */
export function simulateBox(opts: { n: number; pieces: SolidPiece[]; speed: number; pEffective: number; tMax: number; dt?: number; seed?: number }): BoxRun {
  const { n, pieces, speed, pEffective, tMax } = opts;
  const dt = opts.dt ?? 1 / 50;
  const rnd = seededRandom(opts.seed ?? 3);
  const r = PARTICLE_R;
  const inside = (x: number, y: number) => pieces.some((p) => x > p.x - r && x < p.x + p.s + r && y > p.y - r && y < p.y + p.s + r);
  const px: number[] = [];
  const py: number[] = [];
  const vx: number[] = [];
  const vy: number[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 100; tries++) {
      x = r + rnd() * (BOX_W - 2 * r);
      y = r + rnd() * (BOX_H - 2 * r);
      if (!inside(x, y)) break;
    }
    const a = rnd() * Math.PI * 2;
    // Litt ulik fart for hver partikkel (fordeling av energi)
    const v = speed * (0.6 + 0.8 * rnd());
    px.push(x);
    py.push(y);
    vx.push(v * Math.cos(a));
    vy.push(v * Math.sin(a));
  }
  const frames = Math.round(tMax / dt) + 1;
  const pos = new Float32Array(frames * n * 2);
  const hits: BoxHit[] = [];
  const lastHit = new Array<number>(n).fill(-1);
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    for (let i = 0; i < n; i++) {
      if (f > 0) {
        let x = px[i]! + vx[i]! * dt;
        let y = py[i]! + vy[i]! * dt;
        if (x < r) ((x = 2 * r - x), (vx[i] = Math.abs(vx[i]!)));
        if (x > BOX_W - r) ((x = 2 * (BOX_W - r) - x), (vx[i] = -Math.abs(vx[i]!)));
        if (y < r) ((y = 2 * r - y), (vy[i] = Math.abs(vy[i]!)));
        if (y > BOX_H - r) ((y = 2 * (BOX_H - r) - y), (vy[i] = -Math.abs(vy[i]!)));
        for (const p of pieces) {
          const l = p.x - r;
          const rr = p.x + p.s + r;
          const tp = p.y - r;
          const b = p.y + p.s + r;
          if (x <= l || x >= rr || y <= tp || y >= b) continue;
          // Sprett ut av den nærmeste siden
          const d = [x - l, rr - x, y - tp, b - y];
          const m = Math.min(...d);
          let hx = x;
          let hy = y;
          if (m === d[0]) ((x = l), (vx[i] = -Math.abs(vx[i]!)), (hx = p.x));
          else if (m === d[1]) ((x = rr), (vx[i] = Math.abs(vx[i]!)), (hx = p.x + p.s));
          else if (m === d[2]) ((y = tp), (vy[i] = -Math.abs(vy[i]!)), (hy = p.y));
          else ((y = b), (vy[i] = Math.abs(vy[i]!)), (hy = p.y + p.s));
          hx = Math.min(p.x + p.s, Math.max(p.x, hx));
          hy = Math.min(p.y + p.s, Math.max(p.y, hy));
          if (t - lastHit[i]! > 0.05) {
            hits.push({ t, x: hx, y: hy, effective: rnd() < pEffective });
            lastHit[i] = t;
          }
        }
        px[i] = x;
        py[i] = y;
      }
      pos[(f * n + i) * 2] = px[i]!;
      pos[(f * n + i) * 2 + 1] = py[i]!;
    }
  }
  return { n, dt, frames, pos, hits, tMax };
}

/** Posisjonen til partikkel i ved tiden t (filmen går i ring). */
export function boxPosition(run: BoxRun, i: number, t: number): { x: number; y: number } {
  const f = Math.min(run.frames - 1, Math.max(0, Math.floor((((t % run.tMax) + run.tMax) % run.tMax) / run.dt)));
  return { x: run.pos[(f * run.n + i) * 2]!, y: run.pos[(f * run.n + i) * 2 + 1]! };
}
