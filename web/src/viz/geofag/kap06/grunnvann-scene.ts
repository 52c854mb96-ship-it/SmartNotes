/**
 * Oppsettet av snittet i «Grunnvann» (k6-grunnvann): terrenget, grunnvannsspeilet, fjelloverflaten, elva og hvor
 * brønnen, huset, åkeren og fjøset står, i meter (X fra brønnen, Z over et nullnivå) og i figurens enheter. Ren logikk
 * uten React, så den kan testes for alle kombinasjoner på glidebryterne.
 *
 * Snittet er 520 m langt og 30 m høyt, så høydene er overdrevet (overhøyde ca. 7 på PC og ca. 10 på mobil). Husene og
 * brønnen er tegnet større enn målestokken, så de synes.
 */
import { snittblokkPerspektiv } from '../kit/snitt';
import { BRONN_RADIUS_M, senkningVed, type Bronnstatus, type MaterialValg } from './model-grunnvann';

/** Snittets ender (m fra brønnen, negativt oppstrøms mot venstre). */
export const X_MIN = -320;
export const X_MAKS = 200;
/** Toppen og bunnen av snittboksen (m over nullnivået). */
export const Z_TOPP = 30.2;
export const Z_BUNN = -5;
/** Midten av elva (m fra brønnen) og vannstanden i elva (m). */
export const ELV_X = 160;
export const ELV_Z = 20.3;
/** Gradienten fra den andre sida av dalen inn mot elva. */
const GRADIENT_HOYRE = 0.01;
/** Åkeren (m fra brønnen) og fjøset bak den. */
export const AKER_FRA = -275;
export const AKER_TIL = -212;
export const FJOS_X = -298;
/** Hvor langt fra kanten på kloakkledningen huset står (m oppstrøms). */
export const HUS_AVSTAND = 22;
/** Dybden til kloakkledningen under bakken (m). */
export const KLOAKK_DYBDE = 1.8;
/** Tykkelsen på morenen over fjellet når materialet er oppsprukket fjell (m). */
export const MORENE_OVER_FJELL = 2.6;
/** Snittets dybde inn i blokka (perspektiv). */
export const BLOKK_DYBDE = 50;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Bakken (m) i avstanden X fra brønnen: en flate som heller svakt mot elva og en dal der elva renner. */
export function bakkeZ(X: number): number {
  const base = 29.6 - 0.0062 * (X - X_MIN);
  const u = (X - ELV_X) / 30;
  const dal = 8.3 * Math.exp(-(u * u * u * u));
  return base - dal;
}

/** Grunnvannsspeilet (m) uten pumping: faller mot elva fra begge sider (gradienten i modellen fra venstre). */
export function speilZ(X: number, gradient: number): number {
  return X <= ELV_X ? ELV_Z + gradient * (ELV_X - X) : ELV_Z + GRADIENT_HOYRE * (X - ELV_X);
}

/** Toppen av det tette fjellet under løsmassene (m), litt bølget. */
export function fjellZ(X: number): number {
  return 0.9 + 0.7 * Math.sin(X / 47 + 0.6) + 0.35 * Math.sin(X / 19);
}

/** Toppen av fjellet når hele laget er oppsprukket fjell: like under bakken, med et tynt morenedekke. */
export function fjelloverflateZ(X: number): number {
  return bakkeZ(X) - MORENE_OVER_FJELL - 0.6 * Math.sin(X / 23);
}

/** Oppsettet av figuren for tekstskaleringen f (1 på PC, ca. 1,8 på mobil) og symbolskaleringen k. */
export interface Oppsett {
  W: number;
  H: number;
  /** Smal skjerm (mobil): etikettene i snittet byttes ut med en forklaring under figuren. */
  smal: boolean;
  f: number;
  k: number;
  /** Øverste venstre hjørne av snittboksen i figuren, og størrelsen. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Perspektivet på blokka. */
  dx: number;
  dy: number;
  /** Figurens enheter per meter vannrett og loddrett. */
  px: number;
  pz: number;
  /** Figurens enheter per meter for husene (større enn målestokken, så de synes). */
  pxBygg: number;
  /** Halve bredden på brønnen i figuren. */
  bronnHalv: number;
}

/** Oppsettet for tekstskaleringen `f` og symbolskaleringen `k` (useGeoScale). */
export function oppsett(fInn: number, kInn?: number): Oppsett {
  const f = Number.isFinite(fInn) && fInn > 1 ? fInn : 1;
  const k = kInn !== undefined && Number.isFinite(kInn) && kInn >= 1 ? kInn : Math.max(1, 0.85 * f);
  const smal = f > 1.3;
  const W = 800;
  const H = Math.round(500 + 300 * (f - 1));
  const { dx, dy } = snittblokkPerspektiv(BLOKK_DYBDE);
  const x0 = 12;
  const y0 = Math.round(105 + 125 * (f - 1));
  const w = W - x0 - dx - 10;
  const h = H - y0 - 20;
  return {
    W,
    H,
    smal,
    f,
    k,
    x0,
    y0,
    w,
    h,
    dx,
    dy,
    px: w / (X_MAKS - X_MIN),
    pz: h / (Z_TOPP - Z_BUNN),
    pxBygg: 4 + 1.2 * (k - 1),
    bronnHalv: 7 * k,
  };
}

/** Fra meter til snittets koordinater (vannrett). */
export function sx(o: Oppsett, X: number): number {
  return (X - X_MIN) * o.px;
}
/** Fra snittets koordinater til meter (vannrett). */
export function sxTilX(o: Oppsett, x: number): number {
  return X_MIN + x / o.px;
}
/** Fra høyde (m) til snittets koordinater (loddrett, y nedover). */
export function sy(o: Oppsett, Z: number): number {
  return (Z_TOPP - Z) * o.pz;
}

/** Overhøyden: hvor mye høydene er strukket i forhold til lengdene. */
export function overhoyde(o: Oppsett): number {
  return o.pz / o.px;
}

/** Bakken i snittets koordinater. */
export function overflatePx(o: Oppsett): (x: number) => number {
  return (x) => sy(o, bakkeZ(sxTilX(o, x)));
}

/**
 * Hvor mye (m) speilet er senket i snittpunktet x: Thiem fra brønnveggen og utover, så trakten starter i full dybde
 * der brønnen er tegnet. Trakter som er smalere enn `minPx` i figuren (leire), strekkes til `minPx`, så de synes. Mot
 * elva dempes senkningen til 0 ved breddene, fordi elva holder vannstanden (forenklet).
 */
export function senkningPx(o: Oppsett, b: Bronnstatus | null, x: number, minPx = 12 * o.k): number {
  if (!b || !(b.Q > 0)) return 0;
  const xb = sx(o, 0);
  const avstand = Math.abs(x - xb);
  if (avstand <= o.bronnHalv) return b.senkning;
  const traktPx = Math.max(1e-6, (b.R - BRONN_RADIUS_M) * o.px);
  const strekk = Math.max(1, minPx / traktPx);
  const r = BRONN_RADIUS_M + (avstand - o.bronnHalv) / (o.px * strekk);
  let s = senkningVed(b, r);
  const X = sxTilX(o, x);
  if (X > 0) s *= clamp(1 - (X / (ELV_X - 22)) ** 2, 0, 1);
  return s;
}

/** Grunnvannsspeilet i snittets koordinater, med senkningstrakten rundt brønnen. */
export function speilPx(o: Oppsett, b: Bronnstatus | null, gradient: number): (x: number) => number {
  return (x) => sy(o, speilZ(sxTilX(o, x), gradient) - senkningPx(o, b, x));
}

/** Toppen av fjellet (tett fjell under løsmassene, eller fjelloverflaten under morenen) i snittets koordinater. */
export function fjellPx(o: Oppsett, valg: MaterialValg): (x: number) => number {
  const f = valg === 'oppsprukket-fjell' ? fjelloverflateZ : fjellZ;
  return (x) => sy(o, f(sxTilX(o, x)));
}

/** Bunnen av det vannførende laget (det tette fjellet, eller der sprekkene blir få i fjell) i snittets koordinater. */
export function lagBunnPx(o: Oppsett): (x: number) => number {
  return (x) => sy(o, fjellZ(sxTilX(o, x)));
}

/** Brønnen: bakken, bunnen og filteret (y i snittets koordinater). */
export interface BronnPlass {
  x: number;
  bakke: number;
  bunn: number;
  /** Filteret (løsmassebrønn), eller null i fjell. */
  filter: readonly [number, number] | null;
  /** Toppen av fjellet ved brønnen (fjellbrønn), eller null. */
  fjell: number | null;
  /** Midten av filteret (eller det åpne hullet i fjell): der vannet går inn. */
  inntak: number;
}

/** Hvor brønnen står og hvor dyp den er. */
export function bronnPlass(o: Oppsett, valg: MaterialValg): BronnPlass {
  const x = sx(o, 0);
  const bakke = sy(o, bakkeZ(0));
  if (valg === 'oppsprukket-fjell') {
    const bunn = sy(o, -3.2);
    return { x, bakke, bunn, filter: null, fjell: sy(o, fjelloverflateZ(0)), inntak: sy(o, 5) };
  }
  const bunn = sy(o, fjellZ(0) + 0.5);
  const filter = [sy(o, 7), bunn] as const;
  return { x, bakke, bunn, filter, fjell: null, inntak: (filter[0] + filter[1]) / 2 };
}

/** Plassene til tingene på bakken (snittets koordinater, før perspektivet). */
export interface Plasser {
  /** Der kloakkledningen lekker (x) og dybden (y). */
  lekk: { x: number; y: number };
  /** Huset (midt på bakken foran). */
  hus: number;
  /** Åkeren fra og til, og midten der nitratet regnes fra. */
  akerFra: number;
  akerTil: number;
  aker: number;
  fjos: number;
  /** Vannverket (midt på bakken foran) og der ledningen fra brønnen ender. */
  vannverk: number;
  ledningTil: number;
  /** Etikettene i snittet (PC): x for sonenavnene. */
  etikettX: number;
}

/** Plassene for avstanden L (m) fra kloakkledningen til brønnen. */
export function plasser(o: Oppsett, L: number): Plasser {
  const xb = sx(o, 0);
  const lekkX = sx(o, -L);
  const vannverk = xb + o.bronnHalv + 12 + 9.4 * o.pxBygg;
  return {
    lekk: { x: lekkX, y: sy(o, bakkeZ(-L) - KLOAKK_DYBDE) },
    hus: sx(o, -L - HUS_AVSTAND),
    akerFra: sx(o, AKER_FRA),
    akerTil: sx(o, AKER_TIL),
    aker: sx(o, (AKER_FRA + AKER_TIL) / 2),
    fjos: sx(o, FJOS_X),
    vannverk,
    ledningTil: vannverk - 4 * o.pxBygg,
    etikettX: vannverk - 2 * o.pxBygg,
  };
}

/**
 * Veien et merke tar i den mettede sonen fra kilden (avstanden L oppstrøms) til inntaket i brønnen: like under speilet
 * det meste av veien, og ned til filteret nær brønnen. `u` går fra 0 ved kilden til 1 ved brønnen. `dybde` er hvor
 * langt under speilet merket går (figurens enheter).
 */
export function merkeSti(
  o: Oppsett,
  speil: (x: number) => number,
  plass: BronnPlass,
  L: number,
  dybde: number,
  tilBronn = true,
): (u: number) => { x: number; y: number } {
  const x0 = sx(o, -L);
  const x1 = tilBronn ? plass.x - o.bronnHalv : plass.x;
  const bunn = lagBunnPx(o);
  return (uInn: number) => {
    const u = clamp(Number.isFinite(uInn) ? uInn : 0, 0, 1);
    const x = x0 + (x1 - x0) * u;
    const sp = speil(x);
    const grunn = sp + dybde;
    // Til brønnen: like under speilet det meste av veien og ned til filteret til slutt. Forbi brønnen: like under speilet.
    const e = tilBronn ? u * u * u : 0;
    const y = (1 - e) * grunn + e * plass.inntak;
    return { x, y: clamp(y, sp + 4 * o.k, bunn(x) - 4 * o.k) };
  };
}

/** Vei videre fra brønnen til elva når brønnen ikke pumper (u fra 0 ved brønnen til 1 ved elvebunnen). */
export function forbiSti(o: Oppsett, speil: (x: number) => number, dybde: number): (u: number) => { x: number; y: number } {
  const x0 = sx(o, 0);
  const x1 = sx(o, ELV_X - 4);
  const bunn = sy(o, bakkeZ(ELV_X - 4)) + 3 * o.k;
  return (uInn: number) => {
    const u = clamp(Number.isFinite(uInn) ? uInn : 0, 0, 1);
    const x = x0 + (x1 - x0) * u;
    const grunn = speil(x) + dybde;
    const e = u * u;
    return { x, y: (1 - e) * grunn + e * bunn };
  };
}

/**
 * Strømlinjene (punkter i snittets koordinater) på tre dyp i den mettede sonen. Uten pumping går de fra venstre kant
 * til elva. Når brønnen pumper, ender linjene fra venstre i inntaket (snittet går gjennom brønnen, så alt vannet
 * oppstrøms i snittet havner der), og nye linjer starter nedstrøms for vannskillet ved brønnen (`stagnasjon`, avstanden
 * i figurens enheter der strømmen snur) og går til elva.
 */
export function stromlinjer(
  o: Oppsett,
  speil: (x: number) => number,
  pumping?: { inntak: number; stagnasjon: number },
): (readonly [number, number])[][] {
  const bunn = lagBunnPx(o);
  const elvBunn = sy(o, bakkeZ(ELV_X)) + 2 * o.k;
  const xb = sx(o, 0);
  const dyp = (x: number, d: number): readonly [number, number] => {
    const sp = speil(x);
    return [x, sp + d * (bunn(x) - sp)];
  };
  const tilElva = (d: number, i: number, fraX: number): (readonly [number, number])[] => {
    const pkt: (readonly [number, number])[] = [];
    for (const X of [-30, 60]) {
      const x = sx(o, X);
      if (x > fraX + 12 * o.k) pkt.push(dyp(x, d));
    }
    const x120 = sx(o, 118);
    const sp120 = speil(x120);
    if (x120 > fraX + 12 * o.k) pkt.push([x120, sp120 + 0.55 * d * (bunn(x120) - sp120)]);
    pkt.push([sx(o, ELV_X - 10 + 7 * i), elvBunn + 4 * o.k * (1 + i * 0.6)]);
    return pkt;
  };
  return [0.3, 0.56, 0.82].flatMap((d, i) => {
    const venstre = [X_MIN + 4, -230, -130].map((X) => dyp(sx(o, X), d));
    if (!pumping) return [[...venstre, ...tilElva(d, i, -Infinity)]];
    const mot = dyp(sx(o, -30), d);
    const inn: readonly [number, number] = [xb - o.bronnHalv - 1, pumping.inntak + (i - 1) * 3 * o.k];
    const forBronn: readonly [number, number] = [xb - 16 * o.k, (mot[1] + 2 * inn[1]) / 3];
    const linjer: (readonly [number, number])[][] = [[...venstre, mot, forBronn, inn]];
    const start = xb + Math.max(pumping.stagnasjon, o.bronnHalv + 8 * o.k);
    if (start < sx(o, ELV_X - 30)) linjer.push([dyp(start, d), ...tilElva(d, i, start)]);
    return linjer;
  });
}

/** Avstanden (figurens enheter) fra brønnen til der strømmen snur nedstrøms: tilstrømningen fra elvesida. */
export function tilstromningHoyre(o: Oppsett, b: Bronnstatus | null, K: number, gradient: number, b0: number): number {
  if (!b || !(b.Q > 0) || !(K > 0) || !(gradient > 0)) return 0;
  const stagnasjon = b.Q / (2 * Math.PI * b0 * K * gradient);
  const m = Math.min(stagnasjon, b.R, 100);
  return Number.isFinite(m) ? m * o.px : 0;
}

/** Sprekkene i fjellet (snittets koordinater): mest loddrette, noen slake, færre mot dypet. Fast frø. */
export function sprekker(o: Oppsett, seed = 7): (readonly [number, number])[][] {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const topp = fjellPx(o, 'oppsprukket-fjell');
  const bunn = sy(o, Z_BUNN);
  const ut: (readonly [number, number])[][] = [];
  const n = 26;
  for (let j = 0; j < n; j++) {
    const x = ((j + 0.2 + 0.6 * rnd()) / n) * o.w;
    const y0 = topp(x) + 2;
    const lengde = (0.35 + 0.55 * rnd()) * (bunn - y0);
    const helning = (rnd() - 0.5) * 0.5;
    const pkt: (readonly [number, number])[] = [[x, y0]];
    const steg = 5;
    for (let i = 1; i <= steg; i++) {
      const yy = y0 + (lengde * i) / steg;
      pkt.push([x + helning * (yy - y0) + (rnd() - 0.5) * 8 * o.k, yy]);
    }
    ut.push(pkt);
    if (rnd() < 0.55) {
      // En slak sprekk ut fra den loddrette
      const a = pkt[1 + Math.floor(rnd() * 3)]!;
      const len = (20 + 40 * rnd()) * o.k * (rnd() < 0.5 ? -1 : 1);
      ut.push([a, [a[0] + len * 0.5, a[1] + 3 + 4 * rnd()], [a[0] + len, a[1] + 6 + 8 * rnd()]]);
    }
  }
  return ut;
}
