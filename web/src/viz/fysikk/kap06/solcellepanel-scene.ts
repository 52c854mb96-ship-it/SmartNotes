/**
 * Geometrien i scenen for k6-solcellepanel (ren, uten React): hvor panelet og normalen er, hvor sola tegnes,
 * lysbuntet som treffer panelet og vinkelbuene. Vinkler i grader. Retninger i figurens koordinater (y nedover).
 */

export interface Pt {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;

/**
 * Flaten til et Solcellepanel på stolpe (scene-kit-et) med ankerpunkt (x, y), bredde w, vinkel β og strekfaktor ss:
 * midten av flaten (på toppen av stolpen), den nedre (venstre) og øvre (høyre) enden av midtlinja, normalen (enhetsvektor
 * opp mot venstre) og høyden på stolpen. Regnes som i komponenten, så strålene treffer midt på flaten.
 */
export function panelFace(x: number, y: number, w: number, beta: number, ss = 1) {
  const th = Math.min(90, Math.max(0, Number.isFinite(beta) ? beta : 0)) * RAD;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const dd = w * 0.2;
  const dy = -dd * (0.2 + 0.8 * c);
  const thick = Math.max(2.6 * ss, w * 0.03);
  const ty = c * thick;
  const postH = Math.max(w * 0.55, (w * s) / 2 - dy / 2 + ty + w * 0.1);
  const center = { x, y: y - postH };
  return {
    center,
    e1: { x: x - (w * c) / 2, y: y - postH + (w * s) / 2 },
    e2: { x: x + (w * c) / 2, y: y - postH - (w * s) / 2 },
    normal: { x: -s, y: -c },
    postH,
  };
}

/** Retningen sollyset går (fra sola mot bakken) med solhøyden h: mot høyre og nedover når sola står til venstre (i sør). */
export function sunRay(h: number): Pt {
  return { x: Math.cos(h * RAD), y: Math.sin(h * RAD) };
}

/** Punktet en avstand d tilbake langs sollyset fra p (mot sola). */
export function towardSun(p: Pt, h: number, d: number): Pt {
  const u = sunRay(h);
  return { x: p.x - d * u.x, y: p.y - d * u.y };
}

/**
 * Hvor sola tegnes: på linja fra p mot sola, så langt ut som mulig innenfor x ≥ xMin og y ≥ yMin. Strålene er
 * parallelle, så retningen er det som betyr noe, ikke avstanden.
 */
export function sunPosition(p: Pt, h: number, xMin: number, yMin: number): Pt {
  const u = sunRay(h);
  const rx = u.x > 1e-9 ? (p.x - xMin) / u.x : Infinity;
  const ry = u.y > 1e-9 ? (p.y - yMin) / u.y : Infinity;
  const R = Math.max(0, Math.min(rx, ry));
  return towardSun(p, h, R);
}

/** Lysbuntet som treffer panelet fra e1 til e2: firkanten fra panelet og avstanden L bakover mot sola. */
export function beamPolygon(e1: Pt, e2: Pt, h: number, L: number): Pt[] {
  return [e1, e2, towardSun(e2, h, L), towardSun(e1, h, L)];
}

/** Bredden på lysbuntet vinkelrett på strålene når panelet er w bredt: w · cos θ = w · sin(h + β). */
export function beamWidth(w: number, h: number, beta: number): number {
  return Math.abs(w * Math.sin((h + beta) * RAD));
}

/**
 * Tverrsnittet av lysbuntet («vinduet» lyset går gjennom) en avstand D foran midten av panelet: to punkter vinkelrett
 * på strålene, w · cos θ fra hverandre.
 */
export function beamWindow(center: Pt, h: number, w: number, beta: number, D: number): [Pt, Pt] {
  const q = towardSun(center, h, D);
  const u = sunRay(h);
  const half = beamWidth(w, h, beta) / 2;
  // Vinkelrett på strålene; a går opp mot høyre (mot den øvre enden av panelet)
  const a = { x: u.y, y: -u.x };
  return [
    { x: q.x - half * a.x, y: q.y - half * a.y },
    { x: q.x + half * a.x, y: q.y + half * a.y },
  ];
}

/** Retningsvinkelen (grader, figurens koordinater: 0 = mot høyre, 90 = nedover) mot sola med solhøyden h. */
export function sunDirAngle(h: number): number {
  return 180 + h;
}

/** Retningsvinkelen til normalen for et panel med vinkelen β (opp mot venstre). */
export function normalDirAngle(beta: number): number {
  return 270 - beta;
}

/** Punktet en avstand r fra c i retningen a (grader, figurens koordinater). */
export function polar(c: Pt, r: number, a: number): Pt {
  return { x: c.x + r * Math.cos(a * RAD), y: c.y + r * Math.sin(a * RAD) };
}

/** Vinkelbue med radius r rundt c fra retningen a0 til a1 (grader, figurens koordinater). Tom når vinkelen er under 0,5°. */
export function arcPath(c: Pt, r: number, a0: number, a1: number): string {
  if (!(Math.abs(a1 - a0) >= 0.5) || !(r > 0)) return '';
  const p0 = polar(c, r, a0);
  const p1 = polar(c, r, a1);
  const sweep = a1 > a0 ? 1 : 0;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const f = (v: number) => Math.round(v * 100) / 100;
  return `M${f(p0.x)},${f(p0.y)}A${f(r)},${f(r)} 0 ${large} ${sweep} ${f(p1.x)},${f(p1.y)}`;
}

/**
 * Plassen i scenen for tekstskaleringen f, gjenstandsskalaen s og bredden W på viewBox-en (800 på PC, 600 på mobil,
 * så gjenstandene blir større på en smal skjerm).
 */
export function solcelleLayout(f: number, s: number, W = 800) {
  const H = Math.round(400 + 170 * (f - 1));
  const gy = H - 58 - 30 * (f - 1); // der stolpen står
  const hz = gy - 64 - 6 * (f - 1); // horisonten
  const pw = 150 * Math.min(1.3, s); // panelet (1,7 m)
  const px = W - 330 + 40 * (f - 1); // foten av stolpen
  const hytteW = W < 700 ? 150 : 170;
  const hytteX = W - 124 + 24 * (f - 1); // midten av hytta (lenger bak)
  return { W, H, gy, hz, pw, px, hytteX, hytteW, hytteY: hz + 24, sunXMin: 46 * s, sunYMin: 40 * s };
}

/** Om punktet q er inne i lysbuntet (med en margin m) som treffer et panel med midten c og bredden w. */
export function insideBeam(q: Pt, c: Pt, h: number, w: number, beta: number, m = 0): boolean {
  const u = sunRay(h);
  const a = { x: u.y, y: -u.x };
  const d = { x: q.x - c.x, y: q.y - c.y };
  const p = d.x * a.x + d.y * a.y;
  const t = -(d.x * u.x + d.y * u.y);
  return Math.abs(p) < beamWidth(w, h, beta) / 2 + m && t > -m;
}

/** Punktet like utenfor den øvre kanten av lysbuntet (på den siden der panelet stiger), en avstand gap fra kanten, ut fra midten c. */
export function besideBeam(c: Pt, h: number, w: number, beta: number, gap: number): Pt {
  const u = sunRay(h);
  const a = { x: u.y, y: -u.x };
  const r = beamWidth(w, h, beta) / 2 + gap;
  return { x: c.x + a.x * r, y: c.y + a.y * r };
}

/** Avstanden fra punktet p til linjestykket fra a til b. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Om en tekstlinje fra x0 til x1 med midten i høyden ym holder avstanden `clear` til alle linjestykkene (stråler,
 * normalen, panelet). Sjekker punkter langs midtlinja av teksten.
 */
export function labelClear(x0: number, x1: number, ym: number, segments: [Pt, Pt][], clear: number): boolean {
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const p = { x: x0 + ((x1 - x0) * i) / n, y: ym };
    for (const [a, b] of segments) if (segmentDistance(p, a, b) < clear) return false;
  }
  return true;
}
