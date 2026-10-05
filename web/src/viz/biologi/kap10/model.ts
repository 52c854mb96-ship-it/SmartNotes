/**
 * Transportsystemer i dyr (Bi 1 kapittel 10, KM2 og KM3): ren modell uten React.
 *
 * 1. Blodkretsløp hos ulike dyr: hjerterom, åpent/enkelt/dobbelt kretsløp, blanding av oksygenrikt og oksygenfattig
 *    blod i hjertekammeret, og blodtrykket langs kretsløpet.
 * 2. Motstrøm og medstrøm i gjellene: O₂ i vann og blod langs en gjellelamell (varmeveksler-modellen).
 * 3. Gassutveksling og kroppsstørrelse: hvor langt O₂ når inn ved diffusjon, og hvorfor trakeer, gjeller og lunger
 *    trengs for større dyr.
 */
import { fmt } from '../../kit/format';

/* ====================================================================== */
/* Felles geometri (brukes av animasjonene, testet her)                     */
/* ====================================================================== */

export type Pt = readonly [number, number];

/** Lengden av en brutt linje. */
export function polylineLength(pts: readonly Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

/** Punktet en andel `u` (0–1) av lengden ut langs en brutt linje. */
export function pointAlong(pts: readonly Pt[], u: number): Pt {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0]!;
  const total = polylineLength(pts);
  let left = Math.min(1, Math.max(0, u)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= d || i === pts.length - 1) {
      const s = d > 0 ? Math.min(1, left / d) : 0;
      return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    }
    left -= d;
  }
  return pts[pts.length - 1]!;
}

/**
 * Hvilken del (indeks) og hvor langt inn i den (0–1) en andel `u` av hele kretsløpet ligger, når delene har lengdene
 * `lengths`. `u` går rundt (1,2 → 0,2).
 */
export function locate(lengths: readonly number[], u: number): { index: number; local: number } {
  const total = lengths.reduce((s, l) => s + l, 0);
  if (!(total > 0)) return { index: 0, local: 0 };
  let left = (((u % 1) + 1) % 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (left < l || i === lengths.length - 1) return { index: i, local: l > 0 ? Math.min(1, left / l) : 0 };
    left -= l;
  }
  return { index: lengths.length - 1, local: 1 };
}

/* ====================================================================== */
/* 1. Blodkretsløp hos ulike dyr                                            */
/* ====================================================================== */

export type AnimalId = 'insekt' | 'fisk' | 'amfibie' | 'krypdyr' | 'pattedyr';

export interface Animal {
  id: AnimalId;
  /** Navn i knapperaden. */
  name: string;
  /** Eksempel med vitenskapelig navn (kursiv i figuren). */
  example: string;
  latin: string;
  system: 'åpent' | 'enkelt' | 'dobbelt';
  /** Antall forkamre og hjertekamre (insekt: rørformet hjerte, ryggkaret). */
  atria: number;
  ventricles: number;
  /** Skilleveggen i hjertekammeret: ingen (ett kammer), delvis (krypdyr) eller hel (fugl og pattedyr). */
  septum: 'ingen' | 'delvis' | 'hel';
  /**
   * Blanding m i hjertekammeret: andelen av blodet ut til kroppen som er oksygenfattig blod fra kroppen (og like stor
   * andel av blodet til lungene som er oksygenrikt blod fra lungene). 0 = helt atskilt.
   * Typiske verdier: frosk ca. 0,3–0,4, øgler ca. 0,1–0,2 (varierer mye med aktivitet og dykking), fugl og pattedyr 0.
   */
  mixing: number;
  /** O₂-metning i blodet som forlater gassutvekslingsorganet (gjeller, lunger og hud). */
  gasSat: number;
  /** Organet der blodet tar opp O₂. */
  gasOrgan: string;
  endotherm: boolean;
  /**
   * Stoffskifte i hvile per kg ved vanlig kroppstemperatur, relativt til et krypdyr av samme størrelse (= 1).
   * Fugler og pattedyr ligger typisk 5–10 ganger høyere (Bennett og Ruben 1979; Schmidt-Nielsen, Animal Physiology).
   */
  metabolism: number;
  /** Blodtrykk ut til kroppen (middeltrykk, mmHg), typiske verdier i hvile. */
  pBody: number;
  /** Blodtrykk ut til gassutvekslingsorganet (mmHg). */
  pGas: number;
}

/**
 * Typiske verdier (lærebøker og Hill, Wyse og Anderson: Animal Physiology; Randall 1970 for fisk). Pattedyr: middeltrykk
 * i aorta ca. 95 mmHg (120/80) og ca. 15 mmHg i lungearterien. Fugler har enda høyere trykk (ofte 130–150 mmHg).
 */
export const ANIMALS: readonly Animal[] = [
  {
    id: 'insekt',
    name: 'Insekt',
    example: 'gresshoppe',
    latin: 'Locusta migratoria',
    system: 'åpent',
    atria: 0,
    ventricles: 0,
    septum: 'ingen',
    mixing: 0,
    gasSat: 0,
    gasOrgan: 'trakeer',
    endotherm: false,
    metabolism: 1,
    pBody: 3,
    pGas: 0,
  },
  {
    id: 'fisk',
    name: 'Fisk',
    example: 'regnbueørret',
    latin: 'Oncorhynchus mykiss',
    system: 'enkelt',
    atria: 1,
    ventricles: 1,
    septum: 'ingen',
    mixing: 0,
    gasSat: 0.95,
    gasOrgan: 'gjeller',
    endotherm: false,
    metabolism: 1,
    pBody: 25,
    pGas: 38,
  },
  {
    id: 'amfibie',
    name: 'Amfibie',
    example: 'buttsnutefrosk',
    latin: 'Rana temporaria',
    system: 'dobbelt',
    atria: 2,
    ventricles: 1,
    septum: 'ingen',
    mixing: 0.35,
    gasSat: 0.9,
    gasOrgan: 'lunger og hud',
    endotherm: false,
    metabolism: 1,
    pBody: 32,
    pGas: 32,
  },
  {
    id: 'krypdyr',
    name: 'Krypdyr',
    example: 'firfisle',
    latin: 'Zootoca vivipara',
    system: 'dobbelt',
    atria: 2,
    ventricles: 1,
    septum: 'delvis',
    mixing: 0.15,
    gasSat: 0.95,
    gasOrgan: 'lunger',
    endotherm: false,
    metabolism: 1,
    pBody: 45,
    pGas: 25,
  },
  {
    id: 'pattedyr',
    name: 'Fugl og pattedyr',
    example: 'menneske',
    latin: 'Homo sapiens',
    system: 'dobbelt',
    atria: 2,
    ventricles: 2,
    septum: 'hel',
    mixing: 0,
    gasSat: 0.97,
    gasOrgan: 'lunger',
    endotherm: true,
    metabolism: 7,
    pBody: 95,
    pGas: 15,
  },
];

export function getAnimal(id: AnimalId): Animal {
  return ANIMALS.find((a) => a.id === id) ?? ANIMALS[ANIMALS.length - 1]!;
}

/** Laveste O₂-metning blodet kan ha når det forlater kroppens kapillærer. */
export const MIN_VENOUS_SAT = 0.05;

/**
 * Andelen av O₂-et i blodet som kroppen tar ut på vei gjennom kapillærene (ekstraksjon), fra hvile (0) til hardt
 * arbeid (1): ca. 25 % i hvile og opptil ca. 70 % ved hardt arbeid (pattedyr).
 */
export function extraction(activity: number): number {
  return 0.25 + 0.45 * Math.min(1, Math.max(0, activity));
}

export interface Saturations {
  /** Blodet ut fra gassutvekslingsorganet (gjeller/lunger). */
  gasOut: number;
  /** Blodet ut til kroppen (arterieblod i det store kretsløpet). */
  arterial: number;
  /** Blodet tilbake fra kroppen (veneblod). */
  venous: number;
  /** Blodet ut til gassutvekslingsorganet. */
  toGas: number;
  /** Ekstraksjonen kroppen faktisk får til (lavere enn ønsket når blodet er for fattig på O₂). */
  extracted: number;
}

/**
 * O₂-metningen rundt i kretsløpet i likevekt. Med blanding m i hjertekammeret og ekstraksjon E i kroppen:
 *   arterieblod a = (1 − m) · L + m · v,  veneblod v = a − E  ⇒  a = L − m · E / (1 − m),
 * der L er metningen ut fra lungene. Blodet til lungene blir (1 − m) · v + m · L. Fisk: hjertet har bare veneblod,
 * og blodet går rett fra gjellene til kroppen (a = L). Insekter: hemolymfen frakter ikke O₂ (alle verdier 0).
 */
export function saturations(animal: Animal, activity: number): Saturations {
  if (animal.system === 'åpent') return { gasOut: 0, arterial: 0, venous: 0, toGas: 0, extracted: 0 };
  const L = animal.gasSat;
  const E = extraction(activity);
  if (animal.system === 'enkelt') {
    const venous = Math.max(MIN_VENOUS_SAT, L - E);
    return { gasOut: L, arterial: L, venous, toGas: venous, extracted: L - venous };
  }
  const m = Math.min(0.9, Math.max(0, animal.mixing));
  let arterial = L - (m * E) / (1 - m);
  let venous = arterial - E;
  if (venous < MIN_VENOUS_SAT) {
    venous = MIN_VENOUS_SAT;
    arterial = (1 - m) * L + m * venous;
  }
  return { gasOut: L, arterial, venous, toGas: (1 - m) * venous + m * L, extracted: arterial - venous };
}

/** O₂ levert til kroppen relativt til et pattedyr i hvile: minuttvolum (øker med aktivitet) · O₂ tatt ut. */
export function oxygenDelivery(animal: Animal, activity: number): number {
  const s = saturations(animal, activity);
  const flow = 1 + 3 * Math.min(1, Math.max(0, activity));
  return (flow * s.extracted) / 0.25;
}

/** Del av kretsløpet (i rekkefølge blodet passerer). */
export type SegmentKind = 'pumpe' | 'forkammer' | 'arterie' | 'gass' | 'kropp' | 'vene' | 'kroppshule';

export interface Segment {
  id: string;
  kind: SegmentKind;
  /** Kort navn til figuren og grafen. */
  label: string;
  /** Blodtrykk (mmHg) og O₂-metning ved start og slutt av delen. */
  p0: number;
  p1: number;
  s0: number;
  s1: number;
  /** Relativ lengde i trykkgrafen. */
  len: number;
}

const seg = (id: string, kind: SegmentKind, label: string, p0: number, p1: number, s0: number, s1: number, len: number): Segment => ({
  id,
  kind,
  label,
  p0,
  p1,
  s0,
  s1,
  len,
});

/**
 * Kretsløpet som en rekke deler, i den rekkefølgen blodet passerer dem (dobbelt kretsløp: fra hjertekammeret ut til
 * kroppen, tilbake til hjertet og ut til lungene). Trykkfallet er størst i de små arteriene og kapillærene.
 */
export function circuit(animal: Animal, activity: number): Segment[] {
  const s = saturations(animal, activity);
  const pb = animal.pBody;
  const pg = animal.pGas;
  switch (animal.system) {
    case 'åpent':
      return [
        seg('hjerte', 'pumpe', 'ryggkaret', 1, pb, 0, 0, 0.2),
        seg('aorta', 'arterie', 'ut i hodet', pb, pb * 0.85, 0, 0, 0.15),
        seg('hule', 'kroppshule', 'kroppshulen', pb * 0.85, 0.5, 0, 0, 0.5),
        seg('ostier', 'vene', 'inn i ryggkaret', 0.5, 1, 0, 0, 0.15),
      ];
    case 'enkelt':
      return [
        seg('kammer', 'pumpe', 'hjertekammer', 2, pg, s.venous, s.venous, 0.08),
        seg('bukaorta', 'arterie', 'arterie til gjellene', pg, pg * 0.95, s.venous, s.venous, 0.1),
        seg('gjeller', 'gass', 'gjellene', pg * 0.95, pb, s.venous, s.gasOut, 0.17),
        seg('ryggaorta', 'arterie', 'ryggaorta', pb, pb * 0.9, s.arterial, s.arterial, 0.15),
        seg('kropp', 'kropp', 'kroppen', pb * 0.9, 5, s.arterial, s.venous, 0.2),
        seg('vene', 'vene', 'vener', 5, 2, s.venous, s.venous, 0.18),
        seg('forkammer', 'forkammer', 'forkammer', 2, 2, s.venous, s.venous, 0.12),
      ];
    case 'dobbelt': {
      const twoVentricles = animal.ventricles === 2;
      const kammer = twoVentricles ? 'venstre hjertekammer' : 'hjertekammer';
      const kammerH = twoVentricles ? 'høyre hjertekammer' : 'hjertekammer';
      return [
        seg('kammerV', 'pumpe', kammer, 4, pb, s.gasOut, s.arterial, 0.06),
        seg('aorta', 'arterie', twoVentricles ? 'aorta' : 'arterier', pb, pb * 0.92, s.arterial, s.arterial, 0.09),
        seg('kropp', 'kropp', 'kroppen', pb * 0.92, 10, s.arterial, s.venous, 0.16),
        seg('hulvene', 'vene', 'vener', 10, 3, s.venous, s.venous, 0.1),
        seg('forkammerH', 'forkammer', 'høyre forkammer', 3, 3, s.venous, s.venous, 0.05),
        seg('kammerH', 'pumpe', kammerH, 3, pg, s.venous, s.toGas, 0.06),
        seg('lungearterie', 'arterie', animal.id === 'amfibie' ? 'arterier til lunger og hud' : 'lungearterie', pg, pg * 0.9, s.toGas, s.toGas, 0.09),
        seg('lunger', 'gass', animal.id === 'amfibie' ? 'lunger og hud' : 'lungene', pg * 0.9, 7, s.toGas, s.gasOut, 0.16),
        seg('lungevene', 'vene', 'lungevener', 7, 5, s.gasOut, s.gasOut, 0.1),
        seg('forkammerV', 'forkammer', 'venstre forkammer', 5, 4, s.gasOut, s.gasOut, 0.05),
      ];
    }
  }
}

/** Trykket langs kretsløpet som punkter (x = 0–1 langs kretsløpet, y = mmHg) til grafen. */
export function pressureProfile(segments: readonly Segment[]): [number, number][] {
  const total = segments.reduce((s, g) => s + g.len, 0);
  const pts: [number, number][] = [];
  let x = 0;
  for (const g of segments) {
    if (pts.length === 0) pts.push([0, g.p0]);
    else pts.push([x / total, g.p0]);
    x += g.len;
    pts.push([x / total, g.p1]);
  }
  return pts;
}

/** Midtpunkt og grenser (0–1) for hver del i trykkgrafen. */
export function segmentSpans(segments: readonly Segment[]): { start: number; end: number; mid: number }[] {
  const total = segments.reduce((s, g) => s + g.len, 0);
  let x = 0;
  return segments.map((g) => {
    const start = x / total;
    x += g.len;
    const end = x / total;
    return { start, end, mid: (start + end) / 2 };
  });
}

/** Høyeste trykk i kretsløpet (mmHg). */
export function maxPressure(segments: readonly Segment[]): number {
  return Math.max(...segments.map((g) => Math.max(g.p0, g.p1)));
}

/** Hjerterommene som tekst: «2 forkamre og 1 hjertekammer». */
export function chamberText(a: Animal): string {
  if (a.system === 'åpent') return 'Rørformet hjerte';
  const fk = a.atria === 1 ? '1 forkammer' : `${a.atria} forkamre`;
  const hk = a.ventricles === 1 ? '1 hjertekammer' : `${a.ventricles} hjertekamre`;
  return `${fk} og ${hk}`;
}

/* ====================================================================== */
/* 2. Motstrøm og medstrøm i gjellene                                       */
/* ====================================================================== */

export type Flow = 'motstrom' | 'medstrom';

/**
 * Overføringsevnen NTU (antall overføringsenheter, K/C) per mm lamell. Antatt verdi som gir realistisk O₂-utnyttelse
 * (60–85 %) for lameller på 0,3–1 mm; den virkelige verdien avhenger av vannstrøm, blodstrøm og diffusjonsavstand.
 */
export const NTU_PER_MM = 8;

export interface GillParams {
  flow: Flow;
  /** Lamellens lengde i mm. */
  length: number;
  /** O₂-metningen (%) i blodet som kommer inn i lamellen. */
  bloodIn: number;
  /** O₂ (%) i vannet som kommer inn (luftmettet vann = 100 %). */
  waterIn?: number;
  /**
   * Forholdet mellom vannets og blodets kapasitet (strøm · O₂-kapasitet). 1 = like stor (standard, omtrent som hos fisk
   * i hvile). Større enn 1: mer vann enn blodet «trenger», så vannet tømmes mindre.
   */
  ratio?: number;
}

export interface GillProfile {
  /** O₂ (%) i vannet og i blodet i posisjon x (0–1). Vannet går alltid fra x = 0 til x = 1. */
  water: (x: number) => number;
  blood: (x: number) => number;
  /** Blodet ut av lamellen og vannet ut. */
  bloodOut: number;
  waterOut: number;
  /** Andelen av O₂-et i vannet som tas opp (utnyttelse). */
  utilization: number;
}

/** (1 − e^(−c)) / c, stabil når c ≈ 0. */
function expm1OverC(c: number): number {
  if (Math.abs(c) < 1e-6) return 1 - c / 2 + (c * c) / 6;
  return (1 - Math.exp(-c)) / c;
}

/**
 * O₂ langs en gjellelamell (som en varmeveksler). Vannet strømmer fra x = 0 til 1 og gir fra seg O₂ i takt med
 * forskjellen vann − blod: dW/dx = −a(W − B), a = NTU for vannet; blodet tar opp dB = b(W − B) per lengde, b = a · ratio.
 * - Medstrøm (blodet fra 0 til 1): forskjellen avtar som e^(−(a+b)x), og blodet kan høyst nå snittet av vann og blod.
 * - Motstrøm (blodet fra 1 til 0): forskjellen er nesten den samme langs hele lamellen, så blodet kan nå nesten vannets
 *   metning. Med like kapasiteter (a = b) er forskjellen konstant: Δ = (W_inn − B_inn) / (1 + a).
 * Forenkling: blodets O₂-metning følger partialtrykket (rett linje i stedet for bindingskurven til hemoglobin).
 */
export function gillProfile({ flow, length, bloodIn, waterIn = 100, ratio = 1 }: GillParams): GillProfile {
  const a = Math.max(0, length) * NTU_PER_MM;
  const b = a * Math.max(0.01, ratio);
  const D0 = waterIn - bloodIn;
  if (flow === 'medstrom') {
    const k = a + b;
    const frac = (x: number) => (k > 0 ? 1 - Math.exp(-k * x) : 0);
    const water = (x: number) => waterIn - (k > 0 ? (a / k) * D0 * frac(x) : 0);
    const blood = (x: number) => bloodIn + (k > 0 ? (b / k) * D0 * frac(x) : 0);
    const waterOut = water(1);
    return { water, blood, bloodOut: blood(1), waterOut, utilization: waterIn > 0 ? (waterIn - waterOut) / waterIn : 0 };
  }
  // Motstrøm: Δ(x) = Δ(0) · e^(−c x), c = a − b; W(x) = W_inn − a Δ(0) x · (1 − e^(−cx))/(cx)
  const c = a - b;
  const delta0 = D0 / (a * expm1OverC(c) + Math.exp(-c));
  const water = (x: number) => waterIn - a * delta0 * x * expm1OverC(c * x);
  const blood = (x: number) => water(x) - delta0 * Math.exp(-c * x);
  const waterOut = water(1);
  return { water, blood, bloodOut: blood(0), waterOut, utilization: waterIn > 0 ? (waterIn - waterOut) / waterIn : 0 };
}

/** Den største metningen blodet kan få med medstrøm (uendelig lang lamell): det vektede snittet. */
export function concurrentLimit(waterIn: number, bloodIn: number, ratio = 1): number {
  return (ratio * waterIn + bloodIn) / (ratio + 1);
}

/* ====================================================================== */
/* 3. Gassutveksling og kroppsstørrelse                                     */
/* ====================================================================== */

export type GasId = 'hud' | 'trakeer' | 'gjeller' | 'lunger' | 'fuglelunger';

/** Diffusjonskoeffisienten til O₂ i vann og vev ved ca. 20 °C (m²/s). */
export const D_TISSUE = 2.0e-9;
/** … og i luft (m²/s), ca. 10 000 ganger raskere. */
export const D_AIR = 2.0e-5;
/** O₂ i luftmettet vann ved 20 °C: ca. 9 mg/L = 0,28 mmol/L. */
export const O2_WATER = 0.28;
/** O₂ i luft (21 %) ved 20 °C: p/(RT) = 21 kPa / (8,314 · 293 K) = 8,6 mmol/L, ca. 30 ganger så mye som i vann. */
export const O2_AIR = 8.6;

/**
 * O₂-forbruk (mmol per liter vev per sekund). Små virvelløse dyr i hvile ca. 0,5 mL O₂ per g per time ≈ 0,006; et
 * aktivt insekt ca. 5 mL/(g · h) ≈ 0,06 (ved flukt kan det bli ti ganger mer).
 */
export const Q_SMALL = 0.0062;
export const Q_INSECT = 0.06;
/** Andelen av tverrsnittet som er luftfylte trakeer (antatt; i insekter typisk 5–20 % av volumet). */
export const TRACHEA_FRACTION = 0.05;

/**
 * Den største radiusen (m) der O₂ så vidt når midten av en kuleformet kropp som bruker O₂ jevnt (nulteordens forbruk):
 *   R_c² = 6 · D · c₀ / q   (D · c₀ er hvor godt O₂ leveres inn ved diffusjon).
 * Bare diffusjon gjennom vev fra overflaten: R_c ≈ 0,74 mm. Trakeer: luften diffunderer 10 000 ganger raskere og har
 * 30 ganger mer O₂, så selv om bare 5 % av tverrsnittet er trakeer, blir R_c ≈ 3 cm.
 */
export function criticalRadius(Dc: number, q: number): number {
  return q > 0 ? Math.sqrt((6 * Dc) / q) : Infinity;
}

export const RC_SKIN = criticalRadius(D_TISSUE * O2_WATER, Q_SMALL);
export const RC_TRACHEA = criticalRadius(TRACHEA_FRACTION * D_AIR * O2_AIR, Q_INSECT);

/**
 * Andelen av volumet i en kule med radius R som får O₂ når O₂ bare når inn ved diffusjon (kritisk radius R_c).
 * Når R > R_c blir det en kjerne uten O₂ med radius ρ = sR der 3s² − 2s³ = 1 − (R_c/R)² (c og c′ er 0 i ρ).
 */
export function anoxicCore(R: number, Rc: number): number {
  if (!(R > Rc)) return 0;
  const target = 1 - (Rc / R) ** 2;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (3 * mid * mid - 2 * mid ** 3 < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** O₂ i relativ avstand u fra midten (0 = midten, 1 = overflaten), som andel av O₂ ved overflaten. */
export function o2At(R: number, Rc: number, u: number): number {
  const r = Math.min(1, Math.max(0, u)) * R;
  const Rc2 = Rc * Rc;
  if (R <= Rc) return 1 - (R * R - r * r) / Rc2;
  const rho = anoxicCore(R, Rc) * R;
  if (r <= rho) return 0;
  return Math.max(0, 1 - (R * R - r * r) / Rc2 + (2 * rho ** 3 * (1 / r - 1 / R)) / Rc2);
}

export interface GasStrategy {
  id: GasId;
  name: string;
  /** Eksempeldyr (vitenskapelige navn i kursiv i komponenten). */
  examples: string;
  medium: 'vann' | 'luft' | 'vann eller fuktig luft';
  /** Trenger blodkretsløp for å frakte O₂ videre. */
  needsBlood: boolean;
  /** Tykkelsen på diffusjonsbarrieren mellom vann/luft og blod/celler (µm), null = hele kroppen. */
  barrier: number | null;
  /** Kritisk radius (m) uten blodkretsløp; Infinity når blodet frakter O₂-et. */
  Rc: number;
}

/**
 * Typiske diffusjonsavstander: trakeolene ender helt inntil cellene (< 1 µm); gjeller hos fisk ca. 1–10 µm (bruker
 * 3 µm); luft–blod-barrieren i menneskelunger ca. 0,6 µm (harmonisk middel, Gehr mfl. 1978); hos fugler ca. 0,2 µm
 * (Maina 2006).
 */
export const GAS_STRATEGIES: readonly GasStrategy[] = [
  { id: 'hud', name: 'Gjennom huden', examples: 'flatormer, nesledyr', medium: 'vann eller fuktig luft', needsBlood: false, barrier: null, Rc: RC_SKIN },
  { id: 'trakeer', name: 'Trakeer', examples: 'insekter', medium: 'luft', needsBlood: false, barrier: 0.5, Rc: RC_TRACHEA },
  { id: 'gjeller', name: 'Gjeller', examples: 'fisk', medium: 'vann', needsBlood: true, barrier: 3, Rc: Infinity },
  { id: 'lunger', name: 'Lunger', examples: 'pattedyr', medium: 'luft', needsBlood: true, barrier: 0.6, Rc: Infinity },
  { id: 'fuglelunger', name: 'Fuglelunger', examples: 'fugler', medium: 'luft', needsBlood: true, barrier: 0.2, Rc: Infinity },
];

export function getStrategy(id: GasId): GasStrategy {
  return GAS_STRATEGIES.find((s) => s.id === id) ?? GAS_STRATEGIES[0]!;
}

/** Andelen av kroppen (kule med diameter d i meter) som får nok O₂ med denne løsningen. */
export function o2Coverage(strategy: GasStrategy, d: number): number {
  if (!Number.isFinite(strategy.Rc)) return 1;
  return 1 - anoxicCore(d / 2, strategy.Rc) ** 3;
}

/** Den største kroppsdiameteren (m) der hele kroppen får O₂ (2 R_c), Infinity med blodkretsløp. */
export function maxDiameter(strategy: GasStrategy): number {
  return 2 * strategy.Rc;
}

/** Tid (s) for O₂ å diffundere avstanden x (m) i vev: t ≈ x² / (2D). Dobbel avstand gir fire ganger så lang tid. */
export function diffusionTime(x: number, D = D_TISSUE): number {
  return (x * x) / (2 * D);
}

/**
 * Overflate per volum (per mm) for en kuleformet kropp med diameter d (m): A/V = 4πr² / (4/3 πr³) = 3/r = 6/d.
 * Ti ganger tykkere kropp gir ti ganger mindre overflate per volum: overflaten vokser med d², volumet (og O₂-behovet)
 * med d³.
 */
export function surfacePerVolume(d: number): number {
  return d > 0 ? 6 / (d * 1000) : Infinity;
}

/**
 * Overflaten der gassene utveksles hos et voksent menneske, sammenlignet med hudens (m²): lungene ca. 70 m²
 * (300–500 millioner lungeblærer; Weibel), huden ca. 1,8 m².
 */
export const HUMAN_LUNG_AREA = 70;
export const HUMAN_SKIN_AREA = 1.8;

/** Kroppsstørrelse på glidebryteren: 10^v meter, v fra −4 (0,1 mm) til 0 (1 m). */
export const SIZE_MIN_EXP = -4;
export const SIZE_MAX_EXP = 0;

/** Kjente dyr langs størrelsesaksen (diameter/tykkelse i m). */
export const SIZE_REFERENCES: readonly { d: number; name: string }[] = [
  { d: 2e-4, name: 'hjuldyr' },
  { d: 1e-3, name: 'flatorm (tykkelse)' },
  { d: 5e-3, name: 'maur' },
  { d: 3e-2, name: 'stor bille' },
  { d: 0.1, name: 'sild' },
  { d: 0.3, name: 'menneske' },
];

/** Lengde (m) som tekst: 0,0005 → «0,5 mm», 0,03 → «3 cm», 1,2 → «1,2 m». */
export function formatMeters(m: number): string {
  if (!Number.isFinite(m)) return '–';
  const trim = (s: string) => s.replace(/,0$/, '');
  if (m < 1e-3) return `${trim(fmt(m * 1e6, m < 1e-5 ? 1 : 0))} µm`;
  if (m < 1e-2) return `${trim(fmt(m * 1e3, 1))} mm`;
  if (m < 1) return `${trim(fmt(m * 1e2, m < 0.1 ? 1 : 0))} cm`;
  return `${trim(fmt(m, 1))} m`;
}

/** Varighet (s) som tekst: «0,3 s», «4 min», «7 timer», «2 år». */
export function formatDuration(s: number): string {
  if (!Number.isFinite(s)) return '–';
  const f = (v: number) => fmt(v, v < 10 ? 1 : 0).replace(/,0$/, '');
  if (s < 1e-3) return `${f(s * 1e6)} µs`;
  if (s < 1) return `${f(s * 1e3)} ms`;
  if (s < 60) return `${f(s)} s`;
  if (s < 3600) return `${f(s / 60)} min`;
  if (s < 86400 * 2) return `${f(s / 3600)} timer`;
  if (s < 86400 * 365) return `${f(s / 86400)} døgn`;
  return `${f(s / (86400 * 365))} år`;
}
