/**
 * Små felles hjelpere for geofagfigurene: hvor mye symboler og streker skal vokse på mobil, og hvor høy viewBox-en bør
 * være når teksten blir større. Bygd på `useSceneScale` og `useStrokeScale` i scene-kit-et, så geofag og scenene
 * vokser likt.
 */
import { useSceneScale, useStrokeScale } from '../../kit/scene/core';

/**
 * Hvor mye små figurer (krystaller, korn, isotopprikker, symboler, mønstre) bør forstørres for å kunne sees: 1 på PC,
 * ca. 1,5 på telefon (k = max(1, 0,85 · f), der f er tekstskaleringen). Bare inne i en <Figure>. Gang dine egne
 * avstander med den også, ellers overlapper symbolene på mobil.
 */
export function useGeoScale(): number {
  return useSceneScale();
}

/**
 * Faktor for strektykkelser i mønstre, koter og konturer: 1 på PC, ca. 1,35 på telefon (max(1, 0,75 · f)), så tynne
 * streker ikke forsvinner når figuren skaleres ned. Bare inne i en <Figure>.
 */
export function useGeoStroke(): number {
  return useStrokeScale();
}

/**
 * Høyden på viewBox-en for en figur med grunnhøyde `H` når teksten vokser med faktoren `f` (fra
 * `useContainerTextScale`): H + 260 · (f − 1). Grafer, kart og snitt blir da høyere på mobil, så aksetitler og etiketter
 * får plass. Ugyldig eller for liten `f` behandles som 1. Passer ikke for figurer med låst forhold mellom bredde og høyde
 * (fast overhøyde, kart i målestokk): der blir figuren bare høyere og smalere; bruk en mindre økning (f.eks.
 * 320 + 150 · (f − 1)) eller `Profildiagram` med `tilpass`.
 *   const [ref, f] = useContainerTextScale<HTMLDivElement>();
 *   <div ref={ref}><Figure viewBox={`0 0 800 ${geoHoyde(f, 320)}`} …>…</Figure></div>
 */
export function geoHoyde(f: number, H: number): number {
  const k = Number.isFinite(f) ? Math.max(1, f) : 1;
  const h = Number.isFinite(H) ? H : 0;
  return Math.round(h + 260 * (k - 1));
}
