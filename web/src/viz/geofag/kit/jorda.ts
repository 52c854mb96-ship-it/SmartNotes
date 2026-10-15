/**
 * Jordas indre: lagene (kjemisk og mekanisk inndeling), en forenklet PREM-modell for tetthet, tyngdeakselerasjon,
 * trykk og seismiske farter mot dypet, en omtrentlig temperaturkurve og tettheter for vann, is, skorpe og mantel.
 * Ren logikk uten React.
 *
 * Enheter: dyp i km fra overflaten (0–6371), tetthet i g/cm³ (gang med 1000 for kg/m³), g i m/s², trykk i GPa,
 * temperatur i °C og farter i km/s. Alle funksjoner gir null for dyp utenfor 0–6371 km eller ugyldige tall.
 *
 *   lagVed(2000, 'mekanisk')?.navn   // 'nedre mantel'
 *   tetthetVed(3000)                 // ≈ 9,9 (ytre kjerne)
 *   trykkVed(6371)                   // ≈ 364 GPa
 *   vsVed(3000)                      // 0: S-bølger går ikke gjennom den flytende ytre kjernen
 */

/** Jordas middelradius i km. */
export const JORDRADIUS = 6371;

/**
 * Dybden til Moho (skorpas underkant) i km: typisk kontinent, havbunn og under høye fjellkjeder. Kilde: avrundede
 * lærebokverdier (kontinentalskorpa er 30–70 km, havbunnsskorpa omtrent 7 km).
 */
export const MOHO = { kontinent: 35, hav: 7, fjellkjede: 70 } as const;

/** Skorpetype i de forenklede profilene: kontinental skorpe 0–35 km eller havbunnsskorpe 0–7 km (dyp fra havbunnen). */
export type Skorpe = 'kontinent' | 'hav';

/** Tilstand i et lag. */
export type Tilstand = 'fast' | 'seigtflytende' | 'flytende';

/** Ett lag i jordas indre. */
export interface JordLag {
  /** Nøkkel; samme navn som fargene i `GEO` der de finnes (`litosfare`, `astenosfare`, `nedreMantel` …). */
  id: 'skorpe' | 'ovreMantel' | 'nedreMantel' | 'ytreKjerne' | 'indreKjerne' | 'litosfare' | 'astenosfare';
  /** Navn i løpende tekst: «ytre kjerne». */
  navn: string;
  /** Øverste dyp i km. */
  topp: number;
  /** Nederste dyp i km. */
  bunn: number;
  tilstand: Tilstand;
  /**
   * Hovedgruppen i den kjemiske inndelingen (skorpe, mantel eller kjerne), til å slå sammen lag. Litosfæren regnes
   * til mantelen, fordi den mest består av mantel (skorpa er bare den øverste delen).
   */
  del: 'skorpe' | 'mantel' | 'kjerne';
  /** Hva laget er bygd av og hvordan det oppfører seg. */
  beskrivelse: string;
}

/*
 * Kilde: grensene i PREM (Dziewonski og Anderson 1981), avrundet slik lærebøkene oppgir dem: kjerne–mantel-grensen
 * 2891 km, indre kjerne fra 5150 km (PREM: 5149,5), nedre mantel fra 660 km (PREM legger grensen på 670 km).
 * Skorpa er 35 km (kontinent, 30–70 km) og havbunnsskorpa omtrent 7 km. Litosfæren er her 100 km (omtrent 100 km
 * under gammel havbunn, 100–200 km under gamle kontinenter). I den mekaniske inndelingen regnes hele den øvre
 * mantelen under litosfæren med til astenosfæren; den mest seigtflytende delen ligger omtrent 100–250 km ned.
 */
/**
 * Jordas lag med dyp (km), tilstand og beskrivelse i to inndelinger: `kjemisk` (skorpe, øvre og nedre mantel, ytre og
 * indre kjerne) og `mekanisk` (litosfære, astenosfære, nedre mantel, ytre og indre kjerne). Se også `lagVed`.
 */
export const JORDAS_LAG: { readonly kjemisk: readonly JordLag[]; readonly mekanisk: readonly JordLag[] } = {
  kjemisk: [
    {
      id: 'skorpe',
      navn: 'skorpe',
      topp: 0,
      bunn: MOHO.kontinent,
      tilstand: 'fast',
      del: 'skorpe',
      beskrivelse: 'Granittisk kontinentalskorpe (30–70 km) og basaltisk havbunnsskorpe (omtrent 7 km).',
    },
    {
      id: 'ovreMantel',
      navn: 'øvre mantel',
      topp: MOHO.kontinent,
      bunn: 660,
      tilstand: 'fast',
      del: 'mantel',
      beskrivelse: 'Peridotitt (mest olivin). Fast, men så varm at den kan sige over millioner av år.',
    },
    {
      id: 'nedreMantel',
      navn: 'nedre mantel',
      topp: 660,
      bunn: 2891,
      tilstand: 'fast',
      del: 'mantel',
      beskrivelse: 'Samme grunnstoffer som den øvre mantelen, men i tettere mineraler på grunn av trykket.',
    },
    {
      id: 'ytreKjerne',
      navn: 'ytre kjerne',
      topp: 2891,
      bunn: 5150,
      tilstand: 'flytende',
      del: 'kjerne',
      beskrivelse: 'Flytende jern og nikkel. Strømmer i den lager jordas magnetfelt.',
    },
    {
      id: 'indreKjerne',
      navn: 'indre kjerne',
      topp: 5150,
      bunn: JORDRADIUS,
      tilstand: 'fast',
      del: 'kjerne',
      beskrivelse: 'Fast jern og nikkel: trykket er så høyt at metallet ikke smelter, selv om det er varmest her.',
    },
  ],
  mekanisk: [
    {
      id: 'litosfare',
      navn: 'litosfære',
      topp: 0,
      bunn: 100,
      tilstand: 'fast',
      del: 'mantel',
      beskrivelse: 'Skorpa og den øverste, stive delen av mantelen. Delt i plater.',
    },
    {
      id: 'astenosfare',
      navn: 'astenosfære',
      topp: 100,
      bunn: 660,
      tilstand: 'seigtflytende',
      del: 'mantel',
      beskrivelse: 'Varm og plastisk mantel som platene glir på. Nesten helt fast, men kan sige.',
    },
    {
      id: 'nedreMantel',
      navn: 'nedre mantel',
      topp: 660,
      bunn: 2891,
      tilstand: 'fast',
      del: 'mantel',
      beskrivelse: 'Fast og stivere enn astenosfæren (mesosfæren).',
    },
    {
      id: 'ytreKjerne',
      navn: 'ytre kjerne',
      topp: 2891,
      bunn: 5150,
      tilstand: 'flytende',
      del: 'kjerne',
      beskrivelse: 'Flytende jern og nikkel.',
    },
    {
      id: 'indreKjerne',
      navn: 'indre kjerne',
      topp: 5150,
      bunn: JORDRADIUS,
      tilstand: 'fast',
      del: 'kjerne',
      beskrivelse: 'Fast jern og nikkel.',
    },
  ],
};

/** Gyldig dyp (km) i jorda? */
const gyldig = (d: number): boolean => Number.isFinite(d) && d >= 0 && d <= JORDRADIUS;

/**
 * Laget et dyp (km) ligger i, i kjemisk eller mekanisk inndeling. På en grense gis laget under. Null utenfor jorda.
 */
export function lagVed(dybde: number, inndeling: 'kjemisk' | 'mekanisk' = 'kjemisk'): JordLag | null {
  if (!gyldig(dybde)) return null;
  const lag = JORDAS_LAG[inndeling];
  for (let i = lag.length - 1; i >= 0; i--) {
    const l = lag[i]!;
    if (dybde >= l.topp) return l;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Tettheter

/*
 * Kilde: avrundede lærebokverdier i g/cm³: ferskvann 1,000 (ved 4 °C), sjøvann omtrent 1,025, is 0,917 (ren is ved
 * 0 °C), kontinentalskorpe omtrent 2,7, havbunnsskorpe omtrent 2,9 og den øverste mantelen omtrent 3,3 (PREM: 3,38
 * like under Moho). Til isostasi (landheving) og oppdrift.
 */
/**
 * Tettheter i g/cm³ (omtrentlige lærebokverdier): ferskvann, sjøvann, is, kontinentalskorpe, havbunnsskorpe og den
 * øverste mantelen. Til isostasi (landheving, `isostatiskNedsynking`) og oppdrift (isfjell, havis).
 */
export const TETTHETER = {
  vann: 1.0,
  sjovann: 1.025,
  is: 0.917,
  skorpeKontinent: 2.7,
  skorpeHav: 2.9,
  mantel: 3.3,
} as const;

/**
 * Hvor mye en last (f.eks. en isbre, `tykkelse` i m) trykker jordskorpa ned når den er i likevekt (isostasi):
 * tykkelse · ρ_last / ρ_mantel. 3000 m is gir omtrent 830 m. Null for negative eller ugyldige tall og tetthet ≤ 0.
 */
export function isostatiskNedsynking(tykkelse: number, lastTetthet: number = TETTHETER.is, mantelTetthet: number = TETTHETER.mantel): number | null {
  if (![tykkelse, lastTetthet, mantelTetthet].every(Number.isFinite)) return null;
  if (tykkelse < 0 || lastTetthet < 0 || mantelTetthet <= 0) return null;
  return (tykkelse * lastTetthet) / mantelTetthet;
}

// ---------------------------------------------------------------------------------------------------------------
// Forenklet PREM

interface Egenskaper {
  /** g/cm³ */
  rho: number;
  /** km/s */
  vp: number;
  /** km/s */
  vs: number;
}

/*
 * Kilde: PREM (Preliminary Reference Earth Model, Dziewonski og Anderson 1981, tabell I), isotrop versjon, med
 * polynomer i x = r/6371 km. Forenklet her: PREMs havlag (3 km) og to skorpelag er byttet ut med én skorpe med
 * lærebokverdier (kontinent 0–35 km: 2,7 g/cm³, vp 6,3 km/s, vs 3,6 km/s; havbunn 0–7 km: 2,9 g/cm³, vp 6,5 km/s,
 * vs 3,7 km/s, omtrentlige), og PREMs øverste mantellag (LID og lavfartssonen) er ført opp til Moho.
 */
const SKORPE_VERDIER: Record<Skorpe, Egenskaper> = {
  kontinent: { rho: TETTHETER.skorpeKontinent, vp: 6.3, vs: 3.6 },
  hav: { rho: TETTHETER.skorpeHav, vp: 6.5, vs: 3.7 },
};

/** Radiene (km) til grensene i PREM under skorpa, fra sentrum og ut. */
export const PREM_GRENSER_RADIUS = [1221.5, 3480, 3630, 5600, 5701, 5771, 5971, 6151] as const;

/** PREM under skorpa ved radius r (km). På en grense gis verdien i laget under (nærmest sentrum). */
function premMantelOgKjerne(r: number): Egenskaper {
  const x = r / JORDRADIUS;
  const x2 = x * x;
  const x3 = x2 * x;
  if (r <= 1221.5) {
    // Indre kjerne
    return { rho: 13.0885 - 8.8381 * x2, vp: 11.2622 - 6.364 * x2, vs: 3.6678 - 4.4475 * x2 };
  }
  if (r <= 3480) {
    // Ytre kjerne (flytende: vs = 0)
    return {
      rho: 12.5815 - 1.2638 * x - 3.6426 * x2 - 5.5281 * x3,
      vp: 11.0487 - 4.0362 * x + 4.8023 * x2 - 13.5732 * x3,
      vs: 0,
    };
  }
  const rhoNedre = 7.9565 - 6.4761 * x + 5.5283 * x2 - 3.0807 * x3;
  if (r <= 3630) {
    // D″, nederst i mantelen
    return {
      rho: rhoNedre,
      vp: 15.3891 - 5.3181 * x + 5.5242 * x2 - 2.5514 * x3,
      vs: 6.9254 + 1.4672 * x - 2.0834 * x2 + 0.9783 * x3,
    };
  }
  if (r <= 5600) {
    return {
      rho: rhoNedre,
      vp: 24.952 - 40.4673 * x + 51.4832 * x2 - 26.6419 * x3,
      vs: 11.1671 - 13.7818 * x + 17.4575 * x2 - 9.2777 * x3,
    };
  }
  if (r <= 5701) {
    return {
      rho: rhoNedre,
      vp: 29.2766 - 23.6027 * x + 5.5242 * x2 - 2.5514 * x3,
      vs: 22.3459 - 17.2473 * x - 2.0834 * x2 + 0.9783 * x3,
    };
  }
  if (r <= 5771) {
    // Overgangssonen
    return { rho: 5.3197 - 1.4836 * x, vp: 19.0957 - 9.8672 * x, vs: 9.9839 - 4.9324 * x };
  }
  if (r <= 5971) {
    return { rho: 11.2494 - 8.0298 * x, vp: 39.7027 - 32.6166 * x, vs: 22.3512 - 18.5856 * x };
  }
  if (r <= 6151) {
    return { rho: 7.1089 - 3.8045 * x, vp: 20.3926 - 12.2569 * x, vs: 8.9496 - 4.4597 * x };
  }
  // Lavfartssonen og LID, ført opp til Moho
  return { rho: 2.691 + 0.6924 * x, vp: 4.1875 + 3.9382 * x, vs: 2.1519 + 2.3481 * x };
}

function egenskaper(dybde: number, skorpe: Skorpe): Egenskaper {
  if (dybde < MOHO[skorpe]) return SKORPE_VERDIER[skorpe];
  return premMantelOgKjerne(JORDRADIUS - dybde);
}

/** Tetthet (g/cm³) ved et dyp (km), forenklet PREM. På en grense gis verdien i laget under. */
export function tetthetVed(dybde: number, skorpe: Skorpe = 'kontinent'): number | null {
  return gyldig(dybde) ? egenskaper(dybde, skorpe).rho : null;
}

/** P-bølgefart (km/s) ved et dyp (km), forenklet PREM. Faller brått inn i den flytende ytre kjernen. */
export function vpVed(dybde: number, skorpe: Skorpe = 'kontinent'): number | null {
  return gyldig(dybde) ? egenskaper(dybde, skorpe).vp : null;
}

/** S-bølgefart (km/s) ved et dyp (km), forenklet PREM. 0 i den flytende ytre kjernen (S-bølger går ikke gjennom væske). */
export function vsVed(dybde: number, skorpe: Skorpe = 'kontinent'): number | null {
  return gyldig(dybde) ? egenskaper(dybde, skorpe).vs : null;
}

/** Dyp (km) der egenskapene hopper i den forenklede modellen: Moho og grensene i PREM. Til plott med brå sprang. */
export function grenseDyp(skorpe: Skorpe = 'kontinent'): number[] {
  return [MOHO[skorpe], ...[...PREM_GRENSER_RADIUS].reverse().map((r) => JORDRADIUS - r)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------------------------------------------
// Masse, tyngde og trykk (integrert én gang per skorpetype)

const G = 6.674e-11;

interface Profil {
  /** Masse innenfor radius r = i km (kg), i = 0 … 6371. */
  masse: Float64Array;
  /** Trykk ved dyp d = i km (Pa), i = 0 … 6371. */
  trykk: Float64Array;
}

const profiler: Partial<Record<Skorpe, Profil>> = {};

function profil(skorpe: Skorpe): Profil {
  const lagret = profiler[skorpe];
  if (lagret) return lagret;
  const n = JORDRADIUS;
  const masse = new Float64Array(n + 1);
  // Massen i kuleskall på 1 km, med tettheten midt i skallet
  for (let r = 1; r <= n; r++) {
    const rm = r - 0.5;
    const rho = egenskaper(JORDRADIUS - rm, skorpe).rho * 1000;
    const r1 = (r - 1) * 1000;
    const r2 = r * 1000;
    masse[r] = masse[r - 1]! + ((4 / 3) * Math.PI * (r2 ** 3 - r1 ** 3)) * rho;
  }
  const trykk = new Float64Array(n + 1);
  // Trykket øker med ρ · g · Δh nedover fra overflaten
  for (let d = 1; d <= n; d++) {
    const dm = d - 0.5;
    const rm = JORDRADIUS - dm;
    const rho = egenskaper(dm, skorpe).rho * 1000;
    const m = (masse[Math.floor(rm)]! + masse[Math.ceil(rm)]!) / 2;
    const g = rm > 0 ? (G * m) / (rm * 1000) ** 2 : 0;
    trykk[d] = trykk[d - 1]! + rho * g * 1000;
  }
  const p = { masse, trykk };
  profiler[skorpe] = p;
  return p;
}

function interpoler(tabell: Float64Array, i: number): number {
  const a = Math.floor(i);
  const b = Math.min(tabell.length - 1, a + 1);
  const t = i - a;
  return tabell[a]! * (1 - t) + tabell[b]! * t;
}

/** Jordas masse (kg) etter den forenklede modellen (omtrent 5,97 · 10²⁴ kg). */
export function jordasMasse(skorpe: Skorpe = 'kontinent'): number {
  return profil(skorpe).masse[JORDRADIUS]!;
}

/**
 * Tyngdeakselerasjon (m/s²) ved et dyp (km): g = G · M(r) / r², der M(r) er massen innenfor radien. Omtrent 9,8 ved
 * overflaten, størst (omtrent 10,7) ved kjerne–mantel-grensen og 0 i sentrum.
 */
export function gVed(dybde: number, skorpe: Skorpe = 'kontinent'): number | null {
  if (!gyldig(dybde)) return null;
  const r = JORDRADIUS - dybde;
  if (r <= 0) return 0;
  const m = interpoler(profil(skorpe).masse, r);
  return (G * m) / (r * 1000) ** 2;
}

/** Trykk (GPa) ved et dyp (km): omtrent 136 GPa ved kjerne–mantel-grensen og omtrent 364 GPa i sentrum. */
export function trykkVed(dybde: number, skorpe: Skorpe = 'kontinent'): number | null {
  if (!gyldig(dybde)) return null;
  return interpoler(profil(skorpe).trykk, dybde) / 1e9;
}

// ---------------------------------------------------------------------------------------------------------------
// Temperatur

/*
 * Kilde: omtrentlig temperaturkurve (geoterm) under et kontinent, satt sammen av lærebokverdier: omtrent 10 °C ved
 * overflaten, omtrent 500 °C ved Moho, omtrent 1300 °C ved bunnen av litosfæren (100 km), omtrent 1500 °C ved 410 km
 * og 1600 °C ved 660 km, omtrent 2300 °C øverst i D″, omtrent 3700 °C (omtrent 4000 K) ved kjerne–mantel-grensen
 * (Lay mfl. 2008), omtrent 5400 °C ved den indre kjernen og omtrent 5500 °C i sentrum. Estimatene for kjernen spriker
 * med flere hundre grader; skriv alltid «omtrent».
 */
const GEOTERM: readonly (readonly [dybde: number, temperatur: number])[] = [
  [0, 10],
  [MOHO.kontinent, 500],
  [100, 1300],
  [410, 1500],
  [660, 1600],
  [2740, 2300],
  [2891, 3700],
  [5150, 5400],
  [JORDRADIUS, 5500],
];

/** Temperatur (°C) ved et dyp (km), omtrentlig og lineært mellom kjente punkter (geotermen under et kontinent). */
export function temperaturVed(dybde: number): number | null {
  if (!gyldig(dybde)) return null;
  for (let i = 1; i < GEOTERM.length; i++) {
    const [d1, t1] = GEOTERM[i]!;
    const [d0, t0] = GEOTERM[i - 1]!;
    if (dybde <= d1) return t0 + ((t1 - t0) * (dybde - d0)) / (d1 - d0);
  }
  return GEOTERM.at(-1)![1];
}
