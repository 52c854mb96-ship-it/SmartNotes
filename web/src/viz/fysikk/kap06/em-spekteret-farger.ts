/**
 * Fargene på strålingen i «Det elektromagnetiske spekteret» (k6-em-spekteret), like i spekteret og i scenene:
 * radio- og mikrobølger blå, infrarødt mørkerødt, synlig lys i sin egen farge, UV fiolett, røntgen og gamma lilla.
 */
import { VIZ } from '../../kit';
import { bolgelengdeFarge, mix } from '../../kit/scene';
import type { RegionId } from './model-em-spekteret';

/** Fargen til bølgen eller fotonet i området (nm brukes bare for synlig lys). */
export function waveColor(id: RegionId, nm: number): string {
  switch (id) {
    case 'radio':
    case 'mikro':
      return VIZ.series[0]!;
    case 'ir':
      // Mørkerødt som i scene-kit-et, men blandet med blekkfargen så det også synes i mørkt tema
      return mix(bolgelengdeFarge(900, false), VIZ.ink, 0.12);
    case 'synlig':
      return bolgelengdeFarge(nm > 0 ? nm : 550, false);
    case 'uv':
      return bolgelengdeFarge(330, false);
    case 'rontgen':
    case 'gamma':
      return VIZ.series[3]!;
  }
}
