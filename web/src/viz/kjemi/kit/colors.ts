/**
 * Faste farger for kjemivisualiseringene. Verdiene er CSS-variabler (styles/viz.css, blokken «Kjemi») og fungerer i
 * både lyst og mørkt tema, også med kjemitemaet «Tavle». Bruk aldri egne fargekoder i komponentene.
 */
import { getElement, type Category } from './grunnstoffer';

export interface AtomColors {
  /** Fyllfarge for atomkula. */
  fill: string;
  /** Kantfarge (mettet utgave av samme farge). */
  line: string;
  /** Tekstfarge for symbolet inne i kula. */
  ink: string;
}

const v = (name: string) => `var(--kj-${name})`;
const atom = (name: string, ink = 'atom-ink'): AtomColors => ({ fill: v(name), line: v(`${name}-line`), ink: v(ink) });

/** CPK-inspirerte farger for de vanligste grunnstoffene; resten får farge etter kategori. */
const BY_SYMBOL: Record<string, AtomColors> = {
  H: atom('h', 'h-ink'),
  C: atom('c'),
  N: atom('n'),
  O: atom('o'),
  F: atom('f'),
  Cl: atom('cl'),
  Br: atom('br'),
  I: atom('i'),
  S: atom('s'),
  P: atom('p'),
};

const BY_CATEGORY: Record<Category, AtomColors> = {
  alkalimetall: atom('alkali'),
  jordalkalimetall: atom('alkaline'),
  overgangsmetall: atom('metal'),
  'annet metall': atom('metal'),
  lantanoid: atom('metal'),
  aktinoid: atom('metal'),
  halvmetall: atom('metalloid'),
  'ikke-metall': atom('other'),
  halogen: atom('other'),
  edelgass: atom('noble'),
};

/** Fargene til et grunnstoff (symbol eller Z). Ukjente grunnstoffer får fargen «annet». */
export function atomColors(symbolOrZ: string | number): AtomColors {
  const e = getElement(symbolOrZ);
  if (!e) return atom('other');
  return BY_SYMBOL[e.symbol] ?? BY_CATEGORY[e.category];
}

/**
 * Blanding av to farger (også CSS-variabler) med CSS `color-mix`: t = 0 gir `a`, t = 1 gir `b`.
 * Brukes f.eks. når en indikator skifter farge gradvis.
 */
export function mixColor(a: string, b: string, t: number): string {
  const p = Math.round(Math.min(1, Math.max(0, t)) * 1000) / 10;
  if (p <= 0) return a;
  if (p >= 100) return b;
  return `color-mix(in srgb, ${b} ${p}%, ${a})`;
}

/** Universalindikator: fargene ved pH 1, 3, 5, 7, 9, 11 og 13. */
const PH_STOPS = [1, 3, 5, 7, 9, 11, 13] as const;

export const KJEMI = {
  /** Atomfarger per grunnstoff: bruk `atomColors('O')` (gir fill, line og ink). */
  atom: atomColors,
  /** Elektroner i indre skall. */
  electron: v('electron'),
  /** Valenselektroner og valensskallet. */
  valence: v('valence'),
  /** Skallringer i Bohr-modellen. */
  shell: v('shell'),
  /** Positiv ladning: δ+, kationer, H₃O⁺. */
  plus: v('plus'),
  /** Negativ ladning: δ−, anioner, OH⁻. */
  minus: v('minus'),
  /** Elektronsky (gjennomsiktig fyll). */
  cloud: v('cloud'),
  /** Kovalente bindinger (streker). */
  bond: v('bond'),
  /** Hydrogenbindinger og andre svake bindinger (stiplet). */
  hbond: v('hbond'),
  /** Bindingstyper på ΔEN-skalaen. */
  bondType: {
    upolar: v('nonpolar'),
    polar: v('polar'),
    ionisk: v('ionic'),
    metallisk: v('metallic'),
  },
  /** Nøytrale molekyler i partikkelbilder (f.eks. glukose i vann). */
  molecule: v('molecule'),
  /** Laboratorieutstyr og væsker. */
  glass: v('glass'),
  glassFill: v('glass-fill'),
  glassShine: v('glass-shine'),
  /** Vann eller fargeløs løsning. */
  liquid: v('liquid'),
  /** Væskeoverflaten (menisken). */
  liquidLine: v('liquid-line'),
  /** Fargen i selve glasset (veggtykkelse og toning), og refleksene. Brukes av Begerglass, Erlenmeyerkolbe og Byrette. */
  glassTint: v('glass-tint'),
  glassWall: v('glass-wall'),
  glassGlint: v('glass-glint'),
  /** Streker på skalaen (byrette, volummerker). */
  scaleInk: v('scale-ink'),
  /** Stativ og klemme (stål), gummi på klemmebakkene og kranen på byretten (PTFE). */
  stand: v('stand'),
  rubber: v('rubber'),
  stopcock: v('ptfe'),
  /** Myk skygge under utstyr og tynn kontur på metalldeler. */
  shadow: v('shadow'),
  outline: v('outline'),
  /** Indikatorer. Fenolftalein er fargeløs i sur og nøytral løsning (bruk `liquid`) og rosa i basisk (pH > ca. 8,2). */
  indicator: {
    btbSur: v('btb-acid'),
    btbNoytral: v('btb-neutral'),
    btbBasisk: v('btb-base'),
    fenolftaleinFargelos: v('liquid'),
    fenolftaleinRosa: v('php-pink'),
  },
  /** Universalindikator ved pH 1, 3, 5, 7, 9, 11 og 13 (rød → oransje → gul → grønn → blågrønn → blå → fiolett). */
  ph: PH_STOPS.map((p) => v(`ph-${p}`)),
  /** Energi: eksoterm (ΔH < 0, varme avgis) og endoterm (ΔH > 0, varme tas opp). */
  exo: v('exo'),
  endo: v('endo'),
  /** Redoks: oksidasjon (avgir elektroner) og reduksjon (tar opp elektroner). */
  oxidation: v('oxidation'),
  reduction: v('reduction'),
  /** Tekst inne i atomkuler. */
  atomInk: v('atom-ink'),
} as const;

/** Universalindikatorfargen ved en pH-verdi (0–14), blandet jevnt mellom fargene ved pH 1, 3, …, 13. */
export function phColor(pH: number): string {
  const p = Math.min(13, Math.max(1, pH));
  const i = Math.min(PH_STOPS.length - 2, Math.floor((p - 1) / 2));
  const t = (p - PH_STOPS[i]!) / 2;
  return mixColor(KJEMI.ph[i]!, KJEMI.ph[i + 1]!, t);
}

/**
 * Bromtymolblått: gult under pH ca. 6,0, grønt rundt 7 og blått over ca. 7,6. Gir en jevn overgang i omslagsområdet.
 */
export function btbColor(pH: number): string {
  const { btbSur, btbNoytral, btbBasisk } = KJEMI.indicator;
  if (pH <= 6.0) return btbSur;
  if (pH < 6.8) return mixColor(btbSur, btbNoytral, (pH - 6.0) / 0.8);
  if (pH <= 7.0) return btbNoytral;
  if (pH < 7.6) return mixColor(btbNoytral, btbBasisk, (pH - 7.0) / 0.6);
  return btbBasisk;
}

/** Fenolftalein: fargeløs under pH ca. 8,2, rosa over ca. 10, gradvis imellom. */
export function phenolphthaleinColor(pH: number): string {
  const { fenolftaleinFargelos, fenolftaleinRosa } = KJEMI.indicator;
  if (pH <= 8.2) return fenolftaleinFargelos;
  if (pH >= 10) return fenolftaleinRosa;
  return mixColor(fenolftaleinFargelos, fenolftaleinRosa, (pH - 8.2) / 1.8);
}
