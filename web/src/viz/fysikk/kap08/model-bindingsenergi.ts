/**
 * Ren fysikk og plassering for scenen i «Bindingsenergi per nukleon» (ingen React): hvor fort bruddstykkene fra fisjon og
 * fusjon farer av gårde (bevegelsesmengden er bevart), praktiske sammenligninger og hvor de frie nukleonene ligger når
 * kjernen er delt opp. Bindingsenergien og reaksjonene selv står i model.ts.
 */
import { C_LIGHT, MEV, REACTIONS, U_KG, atomicMass, reactionEnergy } from './model';

/** Typisk bevegelsesenergi (MeV) for et nøytron fra fisjon av uran-235 (ca. 2 MeV). */
export const FISSION_NEUTRON_MEV = 2;
/** Brennverdien til steinkull (J/kg), ca. 30 MJ/kg. */
export const COAL_J_PER_KG = 3.0e7;
/** Effekten sola stråler ut (W). */
export const SUN_POWER_W = 3.85e26;

/** Farten (m/s) til en partikkel med masse m (u) og bevegelsesenergi K (MeV): K = ½mv². */
export function speedFromKinetic(K: number, mU: number): number {
  if (!(K >= 0) || !(mU > 0)) return NaN;
  return Math.sqrt((2 * K * MEV) / (mU * U_KG));
}

/**
 * To partikler som farer fra hverandre fra ro: bevegelsesmengden er bevart, så de får like stor bevegelsesmengde
 * i hver sin retning (m_A v_A = m_B v_B). Da får den letteste mest energi: K_A = K · m_B / (m_A + m_B).
 */
export function kineticSplit(K: number, mA: number, mB: number): { KA: number; KB: number; vA: number; vB: number } {
  const KA = (K * mB) / (mA + mB);
  const KB = (K * mA) / (mA + mB);
  return { KA, KB, vA: speedFromKinetic(KA, mA), vB: speedFromKinetic(KB, mB) };
}

export interface Fragment {
  /** Bevegelsesenergi (MeV) og fart (m/s). */
  K: number;
  v: number;
}

/**
 * Fisjonen ²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n: de tre nøytronene får ca. 2 MeV hver, og resten av energien deles mellom
 * bruddstykkene slik at bevegelsesmengden er bevart (urankjernen og det langsomme nøytronet ligger nesten i ro).
 */
export function fissionFragments(): { Q: number; ba: Fragment; kr: Fragment; n: Fragment } {
  const { Q } = reactionEnergy(REACTIONS.fisjon);
  const mBa = atomicMass(56, 141)!;
  const mKr = atomicMass(36, 92)!;
  const mN = atomicMass(0, 1)!;
  const s = kineticSplit(Q - 3 * FISSION_NEUTRON_MEV, mBa, mKr);
  return {
    Q,
    ba: { K: s.KA, v: s.vA },
    kr: { K: s.KB, v: s.vB },
    n: { K: FISSION_NEUTRON_MEV, v: speedFromKinetic(FISSION_NEUTRON_MEV, mN) },
  };
}

/** Fusjonen ²H + ³H → ⁴He + n: energien deles mellom heliumkjernen og nøytronet (bevegelsesmengden er bevart). */
export function fusionFragments(): { Q: number; he: Fragment; n: Fragment } {
  const { Q } = reactionEnergy(REACTIONS.fusjon);
  const s = kineticSplit(Q, atomicMass(2, 4)!, atomicMass(0, 1)!);
  return { Q, he: { K: s.KA, v: s.vA }, n: { K: s.KB, v: s.vB } };
}

/** Hvor mange kilogram kull som gir like mye energi som E joule. */
export function coalEquivalentKg(EJ: number): number {
  return EJ / COAL_J_PER_KG;
}

/** Massen (kg) som blir til energi per sekund når noe stråler ut effekten P (W): Δm/Δt = P / c². */
export function massLossPerSecond(P: number): number {
  return P / (C_LIGHT * C_LIGHT);
}

/* ---------- Plassering av frie nukleoner (scenen) ---------- */

/** Liten tallgenerator med fast frø (mulberry32), så scenen blir lik hver gang. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CloudPoint {
  x: number;
  y: number;
  proton: boolean;
}

/**
 * Z protoner og N nøytroner spredt i en ellipse med halvakser rx og ry rundt (0, 0), som frie nukleoner etter at
 * kjernen er delt opp. Punktene ligger i et sekskantgitter med litt tilfeldig forskyvning, så kulene (radius r) aldri
 * overlapper, og de nærmeste punktene til midten brukes først. Protonene er spredt tilfeldig (fast frø).
 */
export function nucleonCloud(Z: number, N: number, rx: number, ry: number, r: number, seed = 3): CloudPoint[] {
  const A = Math.max(0, Math.round(Z) + Math.round(N));
  if (A === 0 || !(rx > 0) || !(ry > 0) || !(r > 0)) return [];
  const rand = rng(seed);
  // Avstanden i gitteret: så stor som ellipsen gir rom for, men minst 2,5 r (så forskyvningen ikke gir overlapp)
  const area = Math.PI * rx * ry;
  const d = Math.max(2.5 * r, Math.min(7 * r, Math.sqrt((area * 0.82) / A / 0.866)));
  const jit = (d - 2.05 * r) / 2;
  const pts: { x: number; y: number; k: number }[] = [];
  const rows = Math.ceil(ry / (d * 0.866)) + 1;
  const cols = Math.ceil(rx / d) + 1;
  for (let j = -rows; j <= rows; j++) {
    for (let i = -cols; i <= cols; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * d;
      const y = j * d * 0.866;
      const k = (x / rx) ** 2 + (y / ry) ** 2;
      pts.push({ x, y, k });
    }
  }
  pts.sort((a, b) => a.k - b.k || a.y - b.y || a.x - b.x);
  const chosen = pts.slice(0, A).map((p) => {
    const ang = rand() * Math.PI * 2;
    const len = rand() * jit;
    return { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
  });
  // Hvilke som er protoner: tilfeldig utvalg av Z av dem
  const order = chosen.map((_, i) => ({ i, u: rand() })).sort((a, b) => a.u - b.u);
  const isProton = new Array<boolean>(A).fill(false);
  for (let k = 0; k < Math.min(Math.round(Z), A); k++) isProton[order[k]!.i] = true;
  // Tegnes bakfra: øverst først, så de nederste ligger fremst
  return chosen.map((p, i) => ({ ...p, proton: isProton[i]! })).sort((a, b) => a.y - b.y);
}
