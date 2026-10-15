import type { VizMeta } from '../../types';

/** Geofag 1, tema 6 (Vann på jorda). Deltemaene står i `sections` (som i fysikk). */
const viz: VizMeta[] = [
  {
    id: 'grunnvann',
    chapter: '6',
    sections: ['6.2', '6.3'],
    title: 'Grunnvann: grunnvannsspeil, brønn og Darcys lov',
    summary:
      'Velg grus, sand, silt, leire eller oppsprukket fjell og en pumperate, og se senkningstrakten rundt brønnen, vannet i porene og hvor lang tid smittestoffer fra en lekk kloakkledning og nitrat fra en åker bruker til drikkevannet.',
    keywords: [
      'grunnvann',
      'grunnvannsspeil',
      'umettet sone',
      'mettet sone',
      'kapillærsone',
      'porøsitet',
      'effektiv porøsitet',
      'hydraulisk ledningsevne',
      'Darcys lov',
      'porefart',
      'brønn',
      'senkningstrakt',
      'påvirkningsradius',
      'grunnvannsmagasin',
      'breelvavsetning',
      'oppholdstid',
      '60 døgn',
      'hygienisk barriere',
      'sikringssone',
      'drikkevann',
      'nitrat',
      'forurensning',
      'KM7',
      'KM8',
    ],
    load: () => import('./Grunnvann'),
  },
];

export default viz;
