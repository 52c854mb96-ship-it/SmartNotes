/**
 * Hverdagssituasjonene i «Kjernereaksjoner: α, β og γ» (k8-kjernereaksjoner): hvor hver startkjerne finnes, hvor stor
 * gjenstanden er, og den praktiske koblingen i forklaringen. Ren data og regning (ingen React), så den kan testes.
 */

export type KildeType = 'skifer' | 'vekkerklokke' | 'roykvarsler' | 'ved' | 'banan' | 'blybeholder' | 'sopp' | 'kildeskive' | 'medisinglass';

/** Omgivelsene i nærbildet: labbenk, kjøkkenbenk med fliser, tregulv med fotlist eller himling. */
export type Omgivelse = 'lab' | 'kjokken' | 'gulv' | 'tak';

export interface Kilde {
  /** Startkjernen. */
  Z: number;
  A: number;
  type: KildeType;
  omgivelse: Omgivelse;
  /** Navnet i figuren (kort, så det får plass på mobil). */
  navn: string;
  /** Til figurteksten for skjermlesere. */
  beskrivelse: string;
  /** Største bredde og høyde på gjenstanden (m). */
  bredde: number;
  hoyde: number;
  /** Målet som vises i scenen (m) og retningen. */
  maal: number;
  maalRetning: 'bredde' | 'hoyde';
  /** Den praktiske koblingen: «Det er derfor …». */
  derfor: string;
}

export const KILDER: Kilde[] = [
  {
    Z: 92,
    A: 238,
    type: 'skifer',
    omgivelse: 'lab',
    navn: 'Alunskifer',
    beskrivelse: 'En bit alunskifer, en bergart som inneholder uran, på en labbenk.',
    bredde: 0.078,
    hoyde: 0.03,
    maal: 0.078,
    maalRetning: 'bredde',
    derfor:
      'Det er derfor hus som står på alunskifer, kan få mye radon i kjelleren: uranserien går via radium til radongass, som siver opp fra berggrunnen.',
  },
  {
    Z: 88,
    A: 226,
    type: 'vekkerklokke',
    omgivelse: 'kjokken',
    navn: 'Gammel vekkerklokke',
    beskrivelse: 'En gammel vekkerklokke med selvlysende tall og visere malt med radium.',
    bredde: 0.11,
    hoyde: 0.14,
    maal: 0.14,
    maalRetning: 'hoyde',
    derfor:
      'Det er derfor gamle klokker med selvlysende radiumtall fortsatt stråler: halveringstida er 1600 år, så nesten all radiumen fra 1950 er der ennå.',
  },
  {
    Z: 95,
    A: 241,
    type: 'roykvarsler',
    omgivelse: 'tak',
    navn: 'Røykvarsler',
    beskrivelse: 'En røykvarsler i taket med en liten kilde av americium-241 inni.',
    bredde: 0.11,
    hoyde: 0.035,
    maal: 0.11,
    maalRetning: 'bredde',
    derfor:
      'Det er derfor røykvarsleren er trygg i taket: α-partiklene stopper etter noen få centimeter luft. Inne i varsleren gjør de lufta ledende, og når røyk stopper den svake strømmen, piper den.',
  },
  {
    Z: 6,
    A: 14,
    type: 'ved',
    omgivelse: 'gulv',
    navn: 'Bjørkeved',
    beskrivelse: 'En vedkubbe av bjørk på et tregulv. Alt som har levd, inneholder litt karbon-14.',
    bredde: 0.3,
    hoyde: 0.1,
    maal: 0.3,
    maalRetning: 'bredde',
    derfor:
      'Det er derfor vi kan aldersbestemme tre og bein: et levende tre tar opp nytt C-14 fra lufta, men etter at det er hogd, henfaller C-14 med halveringstid 5730 år uten å bli erstattet.',
  },
  {
    Z: 19,
    A: 40,
    type: 'banan',
    omgivelse: 'kjokken',
    navn: 'Banan',
    beskrivelse: 'En banan på kjøkkenbenken. Bananer har mye kalium, og litt av det er kalium-40.',
    bredde: 0.19,
    hoyde: 0.05,
    maal: 0.19,
    maalRetning: 'bredde',
    derfor:
      'Det er derfor både bananer og kroppen din er litt radioaktive: kalium er livsviktig, og ca. 0,012 % av alt kalium er K-40. I kroppen din henfaller det ca. 4000 K-40-kjerner hvert sekund.',
  },
  {
    Z: 27,
    A: 60,
    type: 'blybeholder',
    omgivelse: 'lab',
    navn: 'Kobolt-60 i bly',
    beskrivelse: 'En strålekilde med kobolt-60 i en tykk blybeholder.',
    bredde: 0.05,
    hoyde: 0.043,
    maal: 0.05,
    maalRetning: 'bredde',
    derfor:
      'Det er derfor kobolt-60 brukes til strålebehandling og til å sterilisere medisinsk utstyr: γ-fotonene fra ⁶⁰Ni* går gjennom mye stoff, og kilden må derfor ligge i tykt bly.',
  },
  {
    Z: 55,
    A: 137,
    type: 'sopp',
    omgivelse: 'kjokken',
    navn: 'Steinsopp',
    beskrivelse: 'To steinsopper fra skogen. Etter Tsjernobyl-ulykken i 1986 kom det cesium-137 ned over deler av Norge.',
    bredde: 0.15,
    hoyde: 0.12,
    maal: 0.12,
    maalRetning: 'hoyde',
    derfor:
      'Det er derfor sopp, sau og rein fra noen fjellområder fortsatt kan ha målbart cesium-137 etter Tsjernobyl-ulykken i 1986: halveringstida er 30 år, så over en tredel av cesiumet er fortsatt igjen.',
  },
  {
    Z: 11,
    A: 22,
    type: 'kildeskive',
    omgivelse: 'lab',
    navn: 'Strålekilde i laben',
    beskrivelse: 'En lukket strålekilde med natrium-22: en plastskive med kilden i midten, i en holder på labbenken.',
    bredde: 0.04,
    hoyde: 0.046,
    maal: 0.025,
    maalRetning: 'hoyde',
    derfor:
      'Det er derfor natrium-22 brukes som positronkilde i laben: positronet møter fort et elektron, og da forsvinner begge og blir til γ-stråling som kan måles.',
  },
  {
    Z: 9,
    A: 18,
    type: 'medisinglass',
    omgivelse: 'lab',
    navn: 'Sporstoff til PET',
    beskrivelse: 'Et medisinglass med sporstoff merket med fluor-18 til en PET-undersøkelse på sykehuset.',
    bredde: 0.03,
    hoyde: 0.056,
    maal: 0.056,
    maalRetning: 'hoyde',
    derfor:
      'Det er derfor fluor-18 brukes ved PET-undersøkelser på sykehuset: halveringstida er bare 110 minutter, så stoffet lages like før undersøkelsen, og nesten alt er borte etter et døgn.',
  },
];

/** Hverdagssituasjonen for startkjernen (U-238 hvis den ikke finnes). */
export function kildeFor(Z: number, A: number): Kilde {
  return KILDER.find((k) => k.Z === Z && k.A === A) ?? KILDER[0]!;
}

/** Skalaen (px/m) som gjør at gjenstanden blir `storrelse` stor (den største av bredden og høyden). */
export function kildeSkala(k: Kilde, storrelse: number): number {
  return storrelse / Math.max(k.bredde, k.hoyde);
}

/** Målet som tekst i centimeter: «7,8 cm», «14 cm». */
export function maalTekst(m: number): string {
  const cm = m * 100;
  const rounded = cm >= 10 ? Math.round(cm) : Math.round(cm * 10) / 10;
  return `${String(rounded).replace('.', ',')} cm`;
}
