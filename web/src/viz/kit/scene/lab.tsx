/**
 * Scene-kit, familien «lab»: varme og elektrisitet, tegnet som lærebokillustrasjoner (lys fra øvre venstre, myke
 * skygger, tynn kontur). Gjenstandene tar tilstanden inn som props (temperatur, lysstyrke, effekt, tid) og har ingen
 * egne klokker.
 *
 *   import { Batteri, batteriPoler, Ledning, Lyspaere, lyspaerePoler, Multimeter } from '../../kit/scene';
 *   const b = batteriPoler({ x: 160, y: 200, size: 90 });
 *   <Batteri x={160} y={200} size={90} />
 *
 * Varme: Termometer, Vannkoker, Kokeplate, Kasserolle, Isbit, Panelovn.
 * Strømkrets: Batteri (+ batteriPoler), Lyspaere (+ lyspaerePoler), Motstand, Multimeter (+ multimeterPunkter),
 * Ledning (med strømprikker), Bryter (+ bryterPoler).
 * I huset: Stikkontakt, Sikring, Sikringsskap, Solcellepanel.
 *
 * Ankerpunkt: det som står på noe, har (x, y) midt på bunnen (laveste punkt), og `rotate` dreier om det:
 * termometer (bunnen av kula), vannkoker, kokeplate, kasserolle, isbit, lyspære (sokkelen eller fatningen), bryter
 * (bunnen av sokkelen, ikke midten: knivbryteren står på bordet), panelovn og solcellepanel (foten av stolpen).
 * Det som henger på veggen eller ligger i en krets, har (x, y) i midten: stikkontakt, sikring, sikringsskap, batteri
 * og multimeter. Motstand og ledning går mellom punkter. Koble ledninger til batteriPoler, lyspaerePoler,
 * bryterPoler og multimeterPunkter (samme props som gjenstanden), ikke til egne anslag.
 * `size` er alltid i figurens enheter; JSDoc for hver gjenstand sier hva den måler. Gjenstandene vokser ikke på mobil
 * av seg selv: gang size med useSceneScale() der de skal kunne leses (f.eks. tallene i et multimeter).
 * Fysikken skal stemme i det som vises: spenningen på batteriet passer typen (AA 1,5 V, flatbatteri 4,5 V, 9 V,
 * bilbatteri 12 V), og i kretser med batterier brukes den lille lab-pæra i fatning (standard med `fatning`).
 */
import './lab.css';

export { Termometer, Vannkoker, Kokeplate, Kasserolle, Isbit } from './lab-varme';
export type { TermometerProps, VannkokerProps, KokeplateProps, KasserolleProps, IsbitProps } from './lab-varme';
export { Batteri, batteriPoler, Lyspaere, lyspaerePoler, Motstand, Multimeter, multimeterPunkter, Ledning, Bryter, bryterPoler } from './lab-krets';
export type {
  BatteriProps,
  BatteriType,
  LyspaereProps,
  LyspaereModell,
  MotstandProps,
  MultimeterProps,
  MultimeterModus,
  LedningProps,
  LedningFarge,
  BryterProps,
} from './lab-krets';
export { Stikkontakt, Sikring, Sikringsskap, Solcellepanel, Panelovn } from './lab-hus';
export type { StikkontaktProps, SikringProps, SikringsKurs, SikringsskapProps, SolcellepanelProps, PanelovnProps } from './lab-hus';
