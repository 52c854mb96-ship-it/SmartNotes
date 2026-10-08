/**
 * Ren geometri, farger og tidslinje for scenen i «Bohrs atommodell» (ingen React), så den kan testes:
 * banene i riktig forhold (r = n² · a₀), målestokken, fargen til et hydrogenrør, lupens tangenter, fotonene som
 * går forbi ved absorpsjon og avspillingen (elektronet som hopper og fotonet som flyr).
 */
import { BALMER_STRENGTH, C_LIGHT, E_CHARGE, H_PLANCK, hydrogenVisibleLines, levelEnergyEV, wavelengthToRgb, type Photon } from './model';

/* ---------- Banene ---------- */

/** Bohr-radien a₀: radien til den innerste banen i hydrogen (m), 0,053 nm. */
export const BOHR_RADIUS = 5.29e-11;

/** Radien til bane n i Bohrs modell (m): r = n² · a₀. */
export function orbitRadius(n: number): number {
  return n * n * BOHR_RADIUS;
}

/**
 * Radien til bane n i figuren (px) når bane `upper` skal ha radien `rFit`. Én skala for alle banene, så forholdet
 * mellom dem blir riktig: bane 6 er 36 ganger så stor som bane 1.
 */
export function orbitPx(n: number, upper: number, rFit: number): number {
  return (rFit * orbitRadius(n)) / orbitRadius(upper);
}

/** Skalaen i figuren (px per nm) når bane `upper` har radien `rFit`. */
export function pxPerNm(upper: number, rFit: number): number {
  return rFit / (orbitRadius(upper) * 1e9);
}

const BAR_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];

/** Målestokk: den lengste runde lengden (nm) som får plass innenfor `maxPx`. */
export function scaleBar(pxNm: number, maxPx: number): { nm: number; px: number } {
  let best = BAR_STEPS[0]!;
  for (const s of BAR_STEPS) if (s * pxNm <= maxPx) best = s;
  return { nm: best, px: best * pxNm };
}

/* ---------- Fargen til et hydrogenrør ---------- */

/**
 * Relativ styrke til de synlige Balmer-linjene i en gassutladning (Hα, Hβ, Hγ, Hδ, Hε, Hζ, Hη): de samme vektene som
 * spekteret i «Spektre» bruker (BALMER_STRENGTH i model.ts). Hα er omtrent tre ganger så sterk som Hβ.
 */
export const BALMER_WEIGHTS = BALMER_STRENGTH;

/**
 * Fargen et hydrogenrør lyser med: summen av de synlige Balmer-linjene (fargene lagt sammen som lys), skalert så den
 * sterkeste kanalen er 255. Det gir den rosa-lilla fargen vi ser i spektralrør med hydrogen.
 */
export function dischargeRgb(): [number, number, number] {
  const sum = [0, 0, 0];
  hydrogenVisibleLines().forEach((line) => {
    const w = line.I;
    const rgb = wavelengthToRgb(line.nm);
    if (!rgb || w === 0) return;
    for (let c = 0; c < 3; c++) sum[c]! += w * rgb[c]!;
  });
  const max = Math.max(...sum, 1e-9);
  return [0, 1, 2].map((c) => Math.round((255 * sum[c]!) / max)) as [number, number, number];
}

export function rgbText([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/* ---------- Lupen ---------- */

export interface Pt {
  x: number;
  y: number;
}

export interface Circle extends Pt {
  r: number;
}

/**
 * De to ytre tangentene mellom sirklene a og b (strekene fra ringen i scenen til lupen). Hver tangent er et par
 * punkter: tangeringspunktet på a og på b. Null hvis den ene sirkelen ligger inne i den andre.
 */
export function outerTangents(a: Circle, b: Circle): [[Pt, Pt], [Pt, Pt]] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (!(d > Math.abs(b.r - a.r))) return null;
  const base = Math.atan2(dy, dx);
  // Normalen n til tangenten oppfyller n · (b − a) = a.r − b.r.
  const phi = Math.acos((a.r - b.r) / d);
  const side = (s: 1 | -1): [Pt, Pt] => {
    const ang = base + s * phi;
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    return [
      { x: a.x + a.r * nx, y: a.y + a.r * ny },
      { x: b.x + b.r * nx, y: b.y + b.r * ny },
    ];
  };
  return [side(1), side(-1)];
}

/* ---------- Fotoner som går forbi ved absorpsjon ---------- */

/** Energien (eV) til fotonet ved overgangen mellom nivåene a og b. */
function gapEV(a: number, b: number): number {
  return Math.abs(levelEnergyEV(a) - levelEnergyEV(b));
}

/** Fotonet med energien `eV`: E = hf og λ = c/f, med konstantene i modellen. */
export function photonFromEV(eV: number): Photon {
  const E = eV * E_CHARGE;
  const f = E / H_PLANCK;
  return { E, eV, f, lambda: C_LIGHT / f };
}

/**
 * To fotoner som går rett gjennom gassen ved absorpsjon fra nivå `lower`: ett med litt mer og ett med litt mindre
 * energi enn overgangen lower → upper. Energiene ligger midt mellom to linjer, så de passer ikke med noen overgang,
 * og fotonet med mer energi har alltid for lite til å ionisere atomet.
 */
export function passingPhotons(upper: number, lower: number): { more: Photon; less: Photon } {
  const e = gapEV(upper, lower);
  const next = gapEV(upper + 1, lower);
  const prev = upper - 1 > lower ? gapEV(upper - 1, lower) : 0.7 * e;
  return { more: photonFromEV((e + next) / 2), less: photonFromEV((e + prev) / 2) };
}

/* ---------- Avspillingen ---------- */

/** Tidslinjen for avspillingen (s): elektronet hopper ved `jump`, og hele forløpet tar `total`. */
export const BOHR_ANIM = { total: 3.4, jump: 1.3, fade: 0.8 } as const;

/** Vinkelfarten (rad/s) i figuren på bane n: de indre banene går fortere rundt, som i Bohrs modell. */
export function orbitOmega(n: number): number {
  return 4.2 / Math.max(1, n) ** 0.8;
}

/**
 * Hvor elektronet er ved tiden t: på startbanen før spranget og på sluttbanen etter (det er aldri mellom banene).
 * `angle` er vinkelen (rad, mot klokka med y opp), og den er lik `alpha` i øyeblikket elektronet hopper.
 */
export function electronAt(t: number, start: number, end: number, alpha: number, tJump: number = BOHR_ANIM.jump): { n: number; angle: number; jumped: boolean } {
  if (t < tJump) return { n: start, angle: alpha - orbitOmega(start) * (tJump - t), jumped: false };
  return { n: end, angle: alpha + orbitOmega(end) * (t - tJump), jumped: true };
}

/** Hvor synlig «spøkelset» på startbanen og spranget er like etter at elektronet har hoppet (1 → 0). */
export function jumpTrace(t: number, tJump: number = BOHR_ANIM.jump, fade: number = BOHR_ANIM.fade): number {
  if (t < tJump) return 0;
  return Math.max(0, 1 - (t - tJump) / fade);
}

/**
 * Et foton som sendes ut fra x0 ved tiden tEmit og flyr mot høyre med farten v (px/s) til xEnd. Gir halen og hodet
 * (x) til bølgepakken med lengde L, eller null når fotonet ikke synes.
 */
export function emittedPhoton(t: number, x0: number, xEnd: number, L: number, v: number, tEmit: number): [number, number] | null {
  const head = x0 + v * (t - tEmit);
  if (!(head > x0)) return null;
  const tail = Math.max(x0, head - L);
  if (tail >= xEnd) return null;
  return [tail, Math.min(head, xEnd)];
}

/**
 * Et foton som kommer inn fra venstre (fra xStart) og flyr mot høyre med farten v. Hodet er ved xHit ved tiden tHit.
 * Er `stop` satt, tas fotonet opp der (pakken forsvinner inn i atomet); ellers fortsetter det til xEnd.
 */
export function incomingPhoton(
  t: number,
  xStart: number,
  xHit: number,
  tHit: number,
  L: number,
  v: number,
  end: { stop: number } | { xEnd: number },
): [number, number] | null {
  const head = xHit + v * (t - tHit);
  const limit = 'stop' in end ? end.stop : end.xEnd;
  const tail = head - L;
  if (head <= xStart || tail >= limit) return null;
  return [Math.max(tail, xStart), Math.min(head, limit)];
}

/**
 * Farten og tidspunktet for absorpsjonen: fotonene kommer inn i lupen (hodet ved xStart) etter `lead` sekunder, så
 * elektronet rekker å gå litt rundt først. Det riktige fotonet treffer elektronet (xHit) ved tHit, og de andre har
 * forlatt figuren (halen ved xEnd) når avspillingen slutter.
 */
export function absorptionTiming(
  xStart: number,
  xHit: number,
  xEnd: number,
  L: number,
  total: number = BOHR_ANIM.total,
  lead = 0.45,
): { v: number; tHit: number } {
  const v = (xEnd + L - xStart) / (total - lead);
  return { v, tHit: lead + (xHit - xStart) / v };
}

/** Farten til fotonet ved emisjon, så det har forlatt figuren (halen ved xEnd) like før avspillingen slutter. */
export function emissionSpeed(x0: number, xEnd: number, L: number, tEmit: number, total: number = BOHR_ANIM.total): number {
  return (xEnd + L - x0) / Math.max(0.2, total - tEmit - 0.05);
}
