/**
 * Gult lys: stoppe eller kjøre videre? (1D) Ren fysikk for k1-gult-lys, uten React.
 *
 * Lyset blir gult i t = 0. Fronten av bilen er da D meter før stopplinja, og bilen har farten v₀. Positiv retning
 * er kjøreretningen, og posisjonen s er fronten av bilen målt fra stopplinja (negativ før linja).
 *
 * - Stoppe: konstant fart i reaksjonstiden t_r, deretter konstant akselerasjon −a til bilen står stille.
 *   Stopplengden er s_r + s_b = v₀·t_r + v₀²/(2a). Bilen stopper før linja når D ≥ stopplengden.
 * - Kjøre videre: bilen holder farten v₀ (gasser ikke). Den rekker over krysset når hele bilen er ute av krysset
 *   før lyset blir rødt: D + b + l ≤ v₀·t_g, der b er krysset (fra stopplinja til andre siden) og l bilens lengde.
 *   Reaksjonstiden spiller ingen rolle her, for sjåføren trenger ikke gjøre noe.
 *
 * Dilemmasonen er avstandene der ingen av delene går: v₀·t_g − (b + l) < D < v₀·t_r + v₀²/(2a).
 */

export const kmhToMs = (kmh: number): number => kmh / 3.6;
export const msToKmh = (ms: number): number => ms * 3.6;

/* ---------- Krysset ---------- */

/** Bilens lengde (m), samme som bilen i scene-kit-et (BIL_MAAL.lengde). */
export const CAR_LENGTH = 4.4;

/**
 * Krysset sett fra bilen, i meter fra stopplinja: gangfeltet ligger like etter stopplinja, så kommer tverrveien.
 * `bredde` er fra stopplinja til andre siden av tverrveien: der må bakenden av bilen være før det blir rødt.
 */
export const KRYSS = {
  gangfelt: { fra: 1, til: 4 },
  tverrvei: { fra: 5, til: 15 },
  bredde: 15,
} as const;

/** Strekningen bilen må kjøre etter stopplinja før den er helt ute av krysset: b + l (m). */
export const CLEAR_DISTANCE = KRYSS.bredde + CAR_LENGTH;

/** Typisk bremseakselerasjon (m/s²): en rolig oppbremsing og full bremsing på tørr asfalt. */
export const BRAKE = { rolig: 3, full: 8 } as const;

/* ---------- Grensene ---------- */

export interface YellowInput {
  /** Farten når lyset blir gult (m/s). */
  v0: number;
  /** Reaksjonstiden (s). */
  tr: number;
  /** Bremseakselerasjonen, størrelsen (m/s²). */
  a: number;
  /** Gultiden: tiden fra lyset blir gult til det blir rødt (s). */
  tg: number;
}

/** Reaksjonslengden s_r = v₀·t_r (m). */
export function reactionDistance({ v0, tr }: YellowInput): number {
  return Math.max(0, v0) * Math.max(0, tr);
}

/** Bremselengden s_b = v₀²/(2a) (m), fra v² − v₀² = 2·(−a)·s med v = 0. */
export function brakingDistance({ v0, a }: YellowInput): number {
  const v = Math.max(0, v0);
  if (v === 0) return 0;
  return a > 0 ? (v * v) / (2 * a) : Infinity;
}

/** Stopplengden s_r + s_b (m): bilen kan stoppe før linja når D er minst så lang. */
export function stopDistance(input: YellowInput): number {
  return reactionDistance(input) + brakingDistance(input);
}

/** Strekningen bilen kjører med konstant fart mens lyset er gult: v₀·t_g (m). */
export function yellowDistance({ v0, tg }: YellowInput): number {
  return Math.max(0, v0) * Math.max(0, tg);
}

/**
 * Den største avstanden D bilen kan ha når lyset blir gult og likevel komme helt over krysset før rødt:
 * v₀·t_g − (b + l). Negativ når bilen ikke rekker det selv om den står ved stopplinja.
 */
export function goLimit(input: YellowInput, clear = CLEAR_DISTANCE): number {
  return yellowDistance(input) - clear;
}

/**
 * Den laveste farten (m/s) som rekker helt over krysset på gultiden selv fra stopplinja: v·t_g = b + l.
 * Saktere biler har negativ grense for å rekke over (goLimit < 0): de er for sakte, ikke for langt unna.
 */
export function minGoSpeed(tg: number, clear = CLEAR_DISTANCE): number {
  return tg > 0 ? clear / tg : Infinity;
}

export type Situation = 'stopp' | 'kjor' | 'dilemma' | 'begge';

const EPS = 1e-9;

/** Kan bilen stoppe før linja (D ≥ stopplengden)? Står den akkurat på linja, regnes det som at den rekker det. */
export function canStop(input: YellowInput, D: number): boolean {
  return D >= stopDistance(input) - EPS;
}

/** Rekker bilen helt over krysset før rødt (D ≤ v₀·t_g − (b + l))? */
export function canGo(input: YellowInput, D: number, clear = CLEAR_DISTANCE): boolean {
  return D <= goLimit(input, clear) + EPS;
}

/** Hva sjåføren kan gjøre med avstanden D: bare stoppe, bare kjøre, begge deler, eller ingen av delene (dilemma). */
export function situation(input: YellowInput, D: number, clear = CLEAR_DISTANCE): Situation {
  const s = canStop(input, D);
  const g = canGo(input, D, clear);
  return s && g ? 'begge' : s ? 'stopp' : g ? 'kjor' : 'dilemma';
}

export interface Zones {
  /** Stopplengden: bilen kan stoppe når D ≥ dStop. */
  dStop: number;
  /** Grensen for å rekke over: bilen rekker det når D ≤ dGo (kan være negativ). */
  dGo: number;
  /** Dilemmasonen [fra, til] i meter før stopplinja, eller null når den ikke finnes. */
  dilemma: [number, number] | null;
  /** Avstandene der begge deler går [fra, til], eller null. */
  option: [number, number] | null;
}

/** Sonene foran stopplinja for en fart: der bilen bare kan kjøre, dilemmasonen eller begge, og der den kan stoppe. */
export function zones(input: YellowInput, clear = CLEAR_DISTANCE): Zones {
  const dStop = stopDistance(input);
  const dGo = goLimit(input, clear);
  const goTop = Math.max(0, dGo);
  return {
    dStop,
    dGo,
    dilemma: dStop > goTop + EPS ? [goTop, dStop] : null,
    option: dGo >= dStop - EPS ? [dStop, dGo] : null,
  };
}

/** Lengden av dilemmasonen (m), 0 når den ikke finnes. */
export function dilemmaLength(input: YellowInput, clear = CLEAR_DISTANCE): number {
  const z = zones(input, clear);
  return z.dilemma ? z.dilemma[1] - z.dilemma[0] : 0;
}

/**
 * Bremseakselerasjonen som trengs for å stoppe akkurat ved stopplinja fra avstanden D: bilen bremser på
 * strekningen D − v₀·t_r, så a = v₀²/(2(D − v₀·t_r)). Uendelig når bilen er forbi linja før sjåføren begynner å bremse.
 */
export function requiredDeceleration(input: YellowInput, D: number): number {
  const v = Math.max(0, input.v0);
  if (v === 0) return 0;
  const room = D - reactionDistance(input);
  return room > EPS ? (v * v) / (2 * room) : Infinity;
}

/**
 * Den korteste gultiden som fjerner dilemmasonen ved farten v₀: v₀·t_g − (b + l) ≥ v₀·t_r + v₀²/(2a) gir
 * t_g ≥ t_r + v₀/(2a) + (b + l)/v₀.
 */
export function yellowNeeded(input: YellowInput, clear = CLEAR_DISTANCE): number {
  const v = Math.max(0, input.v0);
  if (v === 0) return Infinity;
  return input.tr + v / (2 * input.a) + clear / v;
}

/**
 * Fartene (m/s) der det ikke finnes noen dilemmasone, med gitt t_r, a og t_g: v·(t_g − t_r) − v²/(2a) − (b + l) ≥ 0
 * gir v = a·((t_g − t_r) ± √((t_g − t_r)² − 2(b + l)/a)). Null når dilemmasonen finnes ved alle farter.
 */
export function noDilemmaSpeeds({ tr, a, tg }: Omit<YellowInput, 'v0'>, clear = CLEAR_DISTANCE): [number, number] | null {
  const d = tg - tr;
  if (!(a > 0) || d <= 0) return null;
  const disc = d * d - (2 * clear) / a;
  if (disc < 0) return null;
  const r = Math.sqrt(disc);
  return [a * (d - r), a * (d + r)];
}

/* ---------- Bevegelsen for hvert valg ---------- */

export type Plan = 'bremse' | 'kjore';

/** Strekningen bilen har kjørt t sekunder etter at lyset ble gult, når sjåføren bremser. */
function brakeTravel({ v0, tr, a }: YellowInput, t: number): number {
  const v = Math.max(0, v0);
  const tt = Math.max(0, t);
  if (tt <= tr) return v * tt;
  const tb = Math.min(tt - tr, a > 0 ? v / a : Infinity);
  return v * tr + v * tb - 0.5 * a * tb * tb;
}

/** Fronten av bilen (m fra stopplinja, negativ før linja) t sekunder etter at lyset ble gult. */
export function planPosition(input: YellowInput, D: number, plan: Plan, t: number): number {
  const tt = Math.max(0, t);
  return -D + (plan === 'kjore' ? Math.max(0, input.v0) * tt : brakeTravel(input, tt));
}

/** Farten (m/s) t sekunder etter at lyset ble gult. */
export function planVelocity(input: YellowInput, plan: Plan, t: number): number {
  const v = Math.max(0, input.v0);
  if (plan === 'kjore' || t <= input.tr) return v;
  return Math.max(0, v - input.a * (t - input.tr));
}

/** Akselerasjonen (m/s²) t sekunder etter at lyset ble gult: −a mens bilen bremser, ellers 0. */
export function planAcceleration(input: YellowInput, plan: Plan, t: number): number {
  if (plan === 'kjore' || t <= input.tr) return 0;
  return planVelocity(input, plan, t) > 0 ? -input.a : 0;
}

/** Tiden bilen bruker på å stoppe: t_r + v₀/a. */
export function stopTime({ v0, tr, a }: YellowInput): number {
  return tr + Math.max(0, v0) / a;
}

export type StopPlace = 'foer' | 'over-linja' | 'gangfelt' | 'krysset' | 'forbi';

export interface StopOutcome {
  /** Fronten når bilen står stille (m fra stopplinja). */
  stopAt: number;
  /** Når bilen står stille (s). */
  tStop: number;
  /** Hvor bilen står: før linja, litt over linja, i gangfeltet, i krysset eller forbi krysset. */
  place: StopPlace;
  /** Avstanden igjen til linja (m) når bilen stopper før den, ellers 0. */
  margin: number;
  /** Hvor langt over linja fronten er (m), ellers 0. */
  over: number;
}

/** Hvor bilen ender når sjåføren bremser. */
export function stopOutcome(input: YellowInput, D: number): StopOutcome {
  const stopAt = -D + stopDistance(input);
  const tStop = stopTime(input);
  const rear = stopAt - CAR_LENGTH;
  const place: StopPlace =
    stopAt <= EPS
      ? 'foer'
      : stopAt <= KRYSS.gangfelt.fra
        ? 'over-linja'
        : stopAt <= KRYSS.tverrvei.fra
          ? 'gangfelt'
          : rear < KRYSS.bredde
            ? 'krysset'
            : 'forbi';
  return { stopAt, tStop, place, margin: Math.max(0, -stopAt), over: Math.max(0, stopAt) };
}

export type GoStatus = 'over' | 'i-krysset' | 'rodt';

export interface GoOutcome {
  /** Når fronten passerer stopplinja (s). */
  tLine: number;
  /** Når bakenden er ute av krysset (s). */
  tClear: number;
  /** Fronten når lyset blir rødt (m fra stopplinja). */
  atRed: number;
  /** Over krysset før rødt, fortsatt i krysset når det blir rødt, eller ikke kommet til linja (kjører på rødt). */
  status: GoStatus;
  /** Strekningen som mangler når det blir rødt (m), 0 når bilen rekker det. */
  missing: number;
  /** Tidsmarginen t_g − t_ut (s): positiv når bilen er ute før rødt. */
  margin: number;
}

/** Hva som skjer når sjåføren kjører videre med konstant fart. */
export function goOutcome(input: YellowInput, D: number, clear = CLEAR_DISTANCE): GoOutcome {
  const v = Math.max(0, input.v0);
  const tLine = v > 0 ? Math.max(0, D) / v : Infinity;
  const tClear = v > 0 ? (Math.max(0, D) + clear) / v : Infinity;
  const atRed = planPosition(input, D, 'kjore', input.tg);
  const status: GoStatus = tClear <= input.tg + EPS ? 'over' : tLine <= input.tg + EPS ? 'i-krysset' : 'rodt';
  return {
    tLine,
    tClear,
    atRed,
    status,
    missing: Math.max(0, D + clear - yellowDistance(input)),
    margin: input.tg - tClear,
  };
}

/** Hvor lenge avspillingen varer for valget: til bilen står, eller litt etter rødt og etter at den er ute av krysset. */
export function planEndTime(input: YellowInput, D: number, plan: Plan): number {
  if (plan === 'bremse') return Math.min(30, stopTime(input) + 0.4);
  const go = goOutcome(input, D);
  return Math.min(30, Math.max(input.tg, Number.isFinite(go.tClear) ? go.tClear : input.tg) + 0.6);
}

/* ---------- Utsnittet av veien i scenen ---------- */

/** Så mye av veien scenen viser etter stopplinja (m): krysset, en bil og litt luft. */
export const VIEW_AHEAD = KRYSS.bredde + CAR_LENGTH + 7;

/**
 * Utsnittet av veien (m fra stopplinja) som scenen viser: fra litt bak bilen (eller litt forbi stopplengden, så
 * sonen der bilen kan stoppe synes) til litt forbi krysset. Stopplengden og grensen for å rekke over tas bare med
 * så lenge utsnittet ikke blir mer enn 1,6 ganger så langt som det bilen trenger (ellers blir bilen for liten).
 * Venstre kant er et helt antall tiere, så skalaen bare endrer seg i sprang når glidebryterne flyttes.
 */
export function sceneRange(D: number, z: Pick<Zones, 'dStop' | 'dGo'>): { min: number; max: number } {
  const base = Math.max(0, D) + CAR_LENGTH + 2;
  const cap = Math.max(60, 1.6 * base);
  let need = base;
  for (const d of [z.dStop + 12, z.dGo + 6]) if (Number.isFinite(d) && d > need && d <= cap) need = d;
  const left = Math.min(130, Math.ceil(need / 10 - 1e-9) * 10);
  return { min: -left, max: VIEW_AHEAD };
}

/* ---------- Grafen ---------- */

/** Et pent tall ≥ v til toppen av en akse: 60, 70, 80, 100, 120, 140, 160, 200, 250 … */
export function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const m = [1, 1.2, 1.4, 1.6, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].find((c) => c * mag >= v - 1e-9 * mag) ?? 10;
  return Math.round(m * mag * 1e6) / 1e6;
}

/**
 * Toppen av avstandsaksen i grafen (m): plass til punktet (v₀, D) og grensene ved farten v₀, minst 60 m og
 * høyst 250 m (lengre stopplengder klippes).
 */
export function graphTop(input: YellowInput, D: number): number {
  const z = zones(input);
  const want = 1.15 * Math.max(D, Number.isFinite(z.dStop) ? z.dStop : 0, z.dGo);
  return niceCeil(Math.min(250, Math.max(60, want)));
}

/** Glidebryterne for fart (km/h) og avstand (m): grafen runder et klikk til de samme stegene. */
export const SLIDERS = { kmh: { min: 20, max: 90, step: 5 }, D: { min: 0, max: 100, step: 1 } } as const;

/** Fart og avstand fra et punkt i grafen (km/h, m), rundet til stegene på glidebryterne og holdt innenfor dem. */
export function pickValues(kmh: number, D: number): [number, number] {
  const r = (v: number, s: { min: number; max: number; step: number }) =>
    Math.min(s.max, Math.max(s.min, Math.round((Number.isFinite(v) ? v : s.min) / s.step) * s.step));
  return [r(kmh, SLIDERS.kmh), r(D, SLIDERS.D)];
}
