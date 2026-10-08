/**
 * Ren fysikk for «Lyd og ekko» (k6-ekko), ingen React: lyd går med konstant fart, så s = v · t.
 * Lyn og torden: d = v · t (lyden går én vei). Ekkolodd: lydpulsen går ned og opp igjen, så 2d = v · t.
 * Bølgelengden λ = v / f: frekvensen bestemmes av kilden, farten av stoffet lyden går i.
 */

/* ---------- Konstanter (verdiene i ERGO Fysikk 1) ---------- */

/** Lydfarten i luft (m/s), ved ca. 15 °C. */
export const V_LUFT = 340;
/** Lydfarten i vann (m/s), sjøvann og ferskvann rundt 1500 m/s. */
export const V_VANN = 1500;
/** Lysfarten c (m/s). */
export const C_LYS = 3.0e8;
/** Høyden (m) vi regner lyden fra «toppen av lynet» fra, for å forklare at tordenen ruller. */
export const LYN_HOYDE = 3000;

export type Situasjon = 'torden' | 'ekkolodd';
export type Stoff = 'luft' | 'vann';

/** Lydfarten i stoffet (m/s). */
export const LYDFART: Record<Stoff, number> = { luft: V_LUFT, vann: V_VANN };

/** Stoffet lyden går i, i hver situasjon. */
export const STOFF: Record<Situasjon, Stoff> = { torden: 'luft', ekkolodd: 'vann' };

/**
 * Glidebryterne. Tiden t er det eleven måler (s). Frekvensen f er i Hz for tordenen (den dype rumlingen) og i kHz
 * for ekkoloddet (ultralyd), med samme tall: 20–200.
 */
export const SLIDERS = {
  torden: {
    t: { min: 2, max: 30, step: 0.5, start: 6 },
    f: { min: 20, max: 200, step: 5, start: 50 },
  },
  ekkolodd: {
    t: { min: 0.03, max: 0.32, step: 0.002, start: 0.2 },
    f: { min: 20, max: 200, step: 5, start: 50 },
  },
} as const;

/** Frekvensen på glidebryteren i hertz: Hz for tordenen, kHz for ekkoloddet. */
export function frequencyHz(sit: Situasjon, sliderValue: number): number {
  return sit === 'ekkolodd' ? sliderValue * 1000 : sliderValue;
}

/* ---------- Lyn og torden ---------- */

/** Avstanden til lynet når tordenen kommer t sekunder etter lynet: d = v · t (lyset regnes som momentant). */
export function lightningDistance(t: number, v = V_LUFT): number {
  return v * t;
}

/** Tiden lyset bruker på strekningen d: d / c. */
export function lightTime(d: number, c = C_LYS): number {
  return d / c;
}

/**
 * Avstanden når vi også tar med tiden lyset bruker: Δt = d/v − d/c, så d = Δt / (1/v − 1/c).
 * Den skiller seg fra v · Δt med under en milliondel, så lyset kan trygt regnes som momentant.
 */
export function exactLightningDistance(dt: number, v = V_LUFT, c = C_LYS): number {
  return dt / (1 / v - 1 / c);
}

/** Tommelfingerregelen: avstanden i kilometer er sekundene delt på 3 (lyden går ca. 1 km på 3 s). */
export function ruleOfThumbKm(t: number): number {
  return t / 3;
}

/**
 * Hvor mye senere lyden fra høyden h i lynkanalen kommer enn lyden fra nedslaget (s), for en lytter på bakken i
 * avstanden d fra nedslaget: (√(d² + h²) − d) / v. Derfor ruller tordenen i flere sekunder.
 */
export function rumbleDelay(d: number, h = LYN_HOYDE, v = V_LUFT): number {
  return (Math.hypot(d, h) - d) / v;
}

/* ---------- Ekkolodd ---------- */

/** Dybden når ekkoet kommer tilbake etter t: lyden går ned og opp, så 2d = v · t og d = v · t / 2. */
export function echoDepth(t: number, v = V_VANN): number {
  return (v * t) / 2;
}

/** Tiden fra pulsen sendes til ekkoet er tilbake: t = 2d / v. */
export function echoTime(d: number, v = V_VANN): number {
  return (2 * d) / v;
}

export type PulsFase = 'ned' | 'opp' | 'tilbake';

/**
 * Hvor lydpulsen er ved tiden tau etter at den ble sendt (dybden d, farten v): avstanden fra båten (m), fasen og
 * hvor langt den har gått. Den går ned til bunnen på tiden d / v og opp igjen på like lang tid.
 */
export function echoPulse(tau: number, d: number, v = V_VANN): { phase: PulsFase; depth: number; travelled: number } {
  const t = Math.max(0, tau);
  const travelled = Math.min(v * t, 2 * d);
  if (travelled >= 2 * d) return { phase: 'tilbake', depth: 0, travelled: 2 * d };
  if (travelled <= d) return { phase: 'ned', depth: travelled, travelled };
  return { phase: 'opp', depth: 2 * d - travelled, travelled };
}

/* ---------- Bølgelengde ---------- */

/** Bølgelengden λ = v / f (m). Ugyldig (NaN) når f ≤ 0. */
export function wavelength(v: number, f: number): number {
  return f > 0 ? v / f : NaN;
}

/**
 * Lengden på utsnittet i figuren med bølgelengdene (m): 80 m for tordenen og 80 mm for ekkoloddet. Med
 * frekvensene på glidebryteren får det plass til mellom 1 og 50 bølgelengder i både luft og vann.
 */
export function stripLength(sit: Situasjon): number {
  return sit === 'torden' ? 80 : 0.08;
}

/* ---------- Avspilling ---------- */

/**
 * Hvor lenge animasjonen går (simulert tid i s) og hvor fort den spilles av. Tordenen går i sanntid når den er kort
 * (så eleven kan telle sekundene), ellers raskere, så den aldri varer over 8 s. Ekkoloddet går i sakte film, ca. 4 s.
 */
export function playback(sit: Situasjon, T: number): { tEnd: number; speed: number } {
  if (sit === 'torden') {
    const tEnd = T + Math.max(1, 0.1 * T);
    return { tEnd, speed: Math.max(1, tEnd / 8) };
  }
  const tEnd = 1.15 * T;
  return { tEnd, speed: tEnd / 4 };
}

/** Hvor sterkt lynglimtet lyser ved tiden tau (s): 1 i nedslaget, avtar til 0 etter 0,3 s. */
export function flashStrength(tau: number): number {
  if (!(tau >= 0)) return 0;
  return Math.max(0, 1 - tau / 0.3);
}
