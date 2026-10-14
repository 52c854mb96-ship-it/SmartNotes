/**
 * Enkel statistikk for feltdata og måleserier i geofag: middelverdi, standardavvik, standardfeil, median, lineær
 * regresjon og normalfordelingen. Ren logikk uten React.
 *
 * Alle funksjonene gir `null` (aldri `NaN` eller `Infinity`) når serien er tom, for kort eller inneholder ugyldige tall,
 * så komponenten kan vise «–» eller en forklaring.
 *
 *   middel([12.1, 11.8, 12.4])            // 12,1
 *   standardavvik([12.1, 11.8, 12.4])     // utvalgsstandardavvik (n − 1)
 *   lineaerRegresjon([0, 1, 2], [1, 3, 5]) // { stigning: 2, konstantledd: 1, r2: 1, n: 3 }
 *   normalKumulativ(1.96)                 // 0,975
 */

/** True når lista har minst `min` elementer og bare endelige tall. */
function gyldig(verdier: readonly number[], min: number): boolean {
  if (verdier.length < min) return false;
  for (const v of verdier) if (!Number.isFinite(v)) return false;
  return true;
}

/**
 * Middelverdien (aritmetisk gjennomsnitt) av en måleserie. Tom serie eller ugyldige tall gir null.
 *
 * @param verdier Målingene.
 */
export function middel(verdier: readonly number[]): number | null {
  if (!gyldig(verdier, 1)) return null;
  // Summerer avvikene fra første verdi, så like målinger gir nøyaktig den verdien (og standardavvik nøyaktig 0).
  const v0 = verdier[0]!;
  let sum = 0;
  for (const v of verdier) sum += v - v0;
  return v0 + sum / verdier.length;
}

/** Valg til `standardavvik`. */
export interface StandardavvikValg {
  /**
   * `false` (standard): utvalgsstandardavviket med n − 1 i nevneren, som i skolestatistikken for målinger.
   * `true`: populasjonsstandardavviket med n i nevneren.
   */
  populasjon?: boolean;
}

/**
 * Standardavviket til en måleserie (spredningen rundt middelverdien). Utvalgsstandardavviket (n − 1) er standard og
 * krever minst to målinger; ellers null. Like målinger gir 0.
 *
 * @param verdier Målingene.
 * @param valg `{ populasjon: true }` for n i nevneren.
 */
export function standardavvik(verdier: readonly number[], valg: StandardavvikValg = {}): number | null {
  const populasjon = valg.populasjon ?? false;
  if (!gyldig(verdier, populasjon ? 1 : 2)) return null;
  const v0 = verdier[0]!;
  let sumAvvik = 0;
  for (const v of verdier) sumAvvik += v - v0;
  const m = sumAvvik / verdier.length;
  let ss = 0;
  for (const v of verdier) ss += (v - v0 - m) ** 2;
  return Math.sqrt(ss / (populasjon ? verdier.length : verdier.length - 1));
}

/**
 * Standardfeilen til middelverdien, s/√n: hvor usikker middelverdien er når hver måling har spredningen s. Krever
 * minst to målinger; ellers null.
 *
 * @param verdier Målingene.
 */
export function standardfeil(verdier: readonly number[]): number | null {
  const s = standardavvik(verdier);
  return s === null ? null : s / Math.sqrt(verdier.length);
}

/**
 * Medianen: den midterste verdien når serien er sortert (gjennomsnittet av de to midterste ved et partall). Tom serie
 * eller ugyldige tall gir null.
 *
 * @param verdier Målingene (endres ikke).
 */
export function median(verdier: readonly number[]): number | null {
  if (!gyldig(verdier, 1)) return null;
  const s = [...verdier].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Resultatet av `lineaerRegresjon`: linja y = stigning · x + konstantledd. */
export interface Regresjon {
  /** Stigningstallet a i y = a · x + b. */
  stigning: number;
  /** Konstantleddet b i y = a · x + b. */
  konstantledd: number;
  /**
   * Forklaringsgraden R² (0–1): hvor stor del av variasjonen i y linja forklarer. 1 når alle y er like (linja treffer
   * alle punktene).
   */
  r2: number;
  /** Antall punkter. */
  n: number;
}

/**
 * Lineær regresjon med minste kvadraters metode: den rette linja som passer best til punktene (x, y), f.eks. alder mot
 * dyp i en borekjerne eller landheving mot tid. Krever minst to punkter med ulik x og like lange lister; ellers null.
 *
 * @param x x-verdiene.
 * @param y y-verdiene (samme lengde som x).
 */
export function lineaerRegresjon(x: readonly number[], y: readonly number[]): Regresjon | null {
  if (x.length !== y.length || !gyldig(x, 2) || !gyldig(y, 2)) return null;
  const mx = middel(x)!;
  const my = middel(y)!;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  // Alle x like: ingen entydig linje. Relativ terskel, så avrundingsfeil ikke gir en enorm stigning.
  if (sxx <= 1e-24 * Math.max(1, mx * mx) * x.length) return null;
  const stigning = sxy / sxx;
  const konstantledd = my - stigning * mx;
  const r2 = syy === 0 ? 1 : Math.min(1, Math.max(0, (sxy * sxy) / (sxx * syy)));
  return { stigning, konstantledd, r2, n: x.length };
}

/*
 * Normalfordelingen: Abramowitz og Stegun 1964, formel 26.2.17 (største feil 7,5 · 10⁻⁸), og den inverse etter
 * Acklam 2003 (relativ feil under 1,2 · 10⁻⁹). Brukes til kornfordelinger som er normalfordelte i φ (lognormale i mm).
 */

/**
 * Den kumulative standardnormalfordelingen Φ(z): sannsynligheten for at en standard normalfordelt variabel er mindre
 * enn z. Ugyldig z gir null; svært store |z| gir 0 eller 1.
 *
 * @param z Antall standardavvik fra middelverdien.
 */
export function normalKumulativ(z: number): number | null {
  if (Number.isNaN(z)) return null;
  if (z > 40) return 1;
  if (z < -40) return 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const hale = (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? 1 - hale : hale;
}

/**
 * Den inverse av `normalKumulativ`: z slik at Φ(z) = p. Gir null når p ikke ligger strengt mellom 0 og 1.
 *
 * @param p Sannsynlighet, 0 < p < 1.
 */
export function normalKvantil(p: number): number | null {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lav = 0.02425;
  if (p < lav) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - lav) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}
