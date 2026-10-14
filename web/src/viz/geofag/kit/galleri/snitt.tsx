/**
 * Galleri for snittfamilien (?galleri=geo-snitt): Snittblokk med flattliggende lag og innsjø, folder med berggrunnskart
 * på toppen, normal- og reversforkastning, relativ alder (forkastning, diskordans, gang og magmakammer), kyst med fjord og
 * snø, innlandsis, felle for olje og gass (barn med useSnittblokk) og ytterpunkter; Lagpakke med etiketter til høyre og
 * under, kornstørrelsesprofil og ytterpunkter; Borekjerne med varv, prøver, brudd og etiketter.
 */
import { VIZ } from '../../../kit/colors';
import { Txt } from '../../../kit/txt';
import { alpha } from '../../../kit/scene';
import { GEO } from '../colors';
import { geoHoyde } from '../felles';
import {
  Borekjerne,
  Lagpakke,
  SnittGang,
  SnittMagmakammer,
  Snittblokk,
  lagflate,
  lagpakkeOppsett,
  snittblokkPerspektiv,
  useSnittblokk,
  type LagpakkeLag,
  type SnittLag,
} from '../snitt';
import { GalleryGrid, GalleryItem } from './felles';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Bredden etikettkolonnen trenger for tekster med `tegn` tegn (Txt 0,8, pluss strek og marg). */
const etikettPlass = (tegn: number, f: number) => tegn * 0.58 * 17 * 0.8 * f + 36;

/* ---------------------------------------------------------------- Snittblokk */

function Flattliggende({ f }: { f: number }) {
  const H = geoHoyde(f, 340);
  const dybde = 90;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const w = 800 - 20 - dx - etikettPlass(16, f);
  const h = H - dy - 30;
  const dal = (x: number) => 46 + 30 * Math.exp(-(((x - 0.42 * w) / 70) ** 2));
  const lag: SnittLag[] = [
    { type: 'gneis', topp: (x) => 0.82 * h + 7 * Math.sin(x / 37), navn: 'Gneis (grunnfjell)' },
    { type: 'konglomerat', topp: 0.72 * h, erosjon: true },
    { type: 'sandstein', topp: 0.56 * h },
    { type: 'leirskifer', topp: 0.43 * h, undertekst: 'med fossiler' },
    { type: 'kalkstein', topp: 0.3 * h },
    { type: 'morene', topp: dal },
  ];
  return (
    <Snittblokk x={20} y={dy + 8} w={w} h={h} dybde={dybde} lag={lag} vann={{ niva: 58, fra: 0.2 * w, til: 0.65 * w }} etiketter />
  );
}

function Folder({ f }: { f: number }) {
  const H = geoHoyde(f, 360);
  const dybde = 150;
  const vinkel = 30;
  const { dx, dy } = snittblokkPerspektiv(dybde, vinkel);
  const w = 800 - 20 - dx - etikettPlass(18, f);
  const h = H - dy - 30;
  const fold = { amplitude: 0.17 * h, bolgelengde: 0.95 * w, midt: 0.3 * w };
  const lag: SnittLag[] = [
    { type: 'kalkstein', topp: lagflate(0.86 * h, fold) },
    { type: 'sandstein', topp: lagflate(0.7 * h, fold) },
    { type: 'leirskifer', topp: lagflate(0.55 * h, fold) },
    { type: 'siltstein', topp: lagflate(0.42 * h, fold) },
    { type: 'konglomerat', topp: lagflate(0.3 * h, fold) },
    { type: 'leirskifer', topp: lagflate(-0.3 * h, fold), navn: 'Leirskifer (yngst)' },
  ];
  return (
    <>
      <Snittblokk x={20} y={dy + 8} w={w} h={h} dybde={dybde} vinkel={vinkel} lag={lag} overflate={0.3 * h} mark="kart" etiketter />
      <Txt x={20 + 0.3 * w} y={r2(dy + 8 + h + 22)} size={0.72} muted>
        antiklinal
      </Txt>
      <Txt x={20 + 0.775 * w} y={r2(dy + 8 + h + 22)} size={0.72} muted>
        synklinal
      </Txt>
    </>
  );
}

const flate: SnittLag[] = [
  { type: 'granitt', topp: 150 },
  { type: 'kalkstein', topp: 120 },
  { type: 'sandstein', topp: 86 },
  { type: 'leirskifer', topp: 62 },
  { type: 'siltstein', topp: 40 },
];

function Normal() {
  return <Snittblokk x={16} y={34} w={300} h={180} dybde={70} lag={flate} forkastninger={[{ x: 120, y: 40, fall: 60, sprang: 36 }]} />;
}

function Revers() {
  return (
    <Snittblokk
      x={16}
      y={34}
      w={300}
      h={180}
      dybde={70}
      lag={flate}
      mark="jord"
      forkastninger={[{ x: 190, y: 40, fall: 45, heller: 'venstre', sprang: -34 }]}
    />
  );
}

function RelativAlder({ f }: { f: number }) {
  const H = geoHoyde(f, 330);
  const dybde = 80;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const w = 800 - 40 - dx;
  const h = H - dy - 26;
  const skra = (y0: number) => lagflate(y0, { fall: 24, midt: 0.5 * w });
  const disk = (x: number) => 0.38 * h + 6 * Math.sin(x / 41) + 3 * Math.sin(x / 13);
  const lag: SnittLag[] = [
    { type: 'kalkstein', topp: skra(0.7 * h) },
    { type: 'leirskifer', topp: skra(0.5 * h) },
    { type: 'sandstein', topp: skra(0.3 * h) },
    { type: 'siltstein', topp: -h },
    { type: 'konglomerat', topp: 0.3 * h, bunn: disk, erosjon: true },
    { type: 'sandstein', topp: 0.18 * h },
    { type: 'leire', topp: 0.06 * h },
  ];
  const bokstav = (x: number, y: number, t: string) => (
    <g key={t}>
      <circle cx={x} cy={y} r={12 * Math.max(1, 0.85 * f)} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.4} />
      <Txt x={x} y={r2(y + 17 * 0.8 * f * 0.35)} size={0.8} weight={700} halo={false}>
        {t}
      </Txt>
    </g>
  );
  return (
    <Snittblokk
      x={20}
      y={dy + 6}
      w={w}
      h={h}
      dybde={dybde}
      lag={lag}
      forkastninger={[{ x: 0.66 * w, y: 0.4 * h, fall: 64, sprang: 0.11 * h, lag: 4 }]}
      over={[
        bokstav(0.12 * w, 0.85 * h, 'A'),
        bokstav(0.32 * w, 0.7 * h, 'B'),
        bokstav(0.12 * w, 0.52 * h, 'C'),
        bokstav(0.86 * w, 0.62 * h, 'D'),
        bokstav(0.5 * w, 0.335 * h, 'E'),
        bokstav(0.5 * w, 0.17 * h, 'F'),
        bokstav(0.6 * w, 0.66 * h, 'G'),
        bokstav(0.25 * w, 0.95 * h, 'H'),
      ]}
    >
      <SnittMagmakammer x={0.38 * w} y={h * 1.02} rx={0.16 * w} ry={0.1 * h} tilforsel={false} />
      <SnittGang fra={[0.4 * w, h]} til={[0.57 * w, 0.3 * h]} bredde={13} />
    </Snittblokk>
  );
}

function KystOgFjord({ f }: { f: number }) {
  const H = geoHoyde(f, 330);
  const dybde = 90;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const w = 800 - 40 - dx;
  const h = H - dy - 26;
  const P: [number, number][] = [
    [0, 0.62],
    [0.08, 0.56],
    [0.14, 0.4],
    [0.18, 0.3],
    [0.24, 0.12],
    [0.3, 0.05],
    [0.36, 0.14],
    [0.4, 0.34],
    [0.43, 0.62],
    [0.47, 0.7],
    [0.53, 0.7],
    [0.57, 0.6],
    [0.61, 0.3],
    [0.68, 0.1],
    [0.74, 0.02],
    [0.8, 0.14],
    [0.86, 0.3],
    [0.93, 0.36],
    [1, 0.38],
  ];
  const profil = (x: number) => {
    const t = x / w;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1]!;
      const b = P[i]!;
      if (t <= b[0]) {
        const u = (t - a[0]) / (b[0] - a[0]);
        const s = u * u * (3 - 2 * u);
        return h * (a[1] + (b[1] - a[1]) * s);
      }
    }
    return h * P[P.length - 1]![1];
  };
  const lag: SnittLag[] = [
    { type: 'gneis', topp: -h },
    {
      type: 'granitt',
      punkter: [
        [0.62 * w, h + 10],
        [0.64 * w, 0.62 * h],
        [0.7 * w, 0.42 * h],
        [0.8 * w, 0.46 * h],
        [0.86 * w, 0.66 * h],
        [0.88 * w, h + 10],
      ],
    },
    {
      type: 'leire',
      punkter: [
        [0.4 * w, 0.6 * h],
        [0.6 * w, 0.6 * h],
        [0.565 * w, 0.7 * h],
        [0.53 * w, 0.76 * h],
        [0.47 * w, 0.76 * h],
        [0.435 * w, 0.7 * h],
      ],
    },
  ];
  // Leira i fjordbunnen slutter ved bakken
  const bunn = (x: number) => Math.min(profil(x), 0.66 * h);
  return (
    <Snittblokk
      x={20}
      y={dy + 6}
      w={w}
      h={h}
      dybde={dybde}
      lag={lag}
      overflate={(x) => (x > 0.42 * w && x < 0.58 * w ? bunn(x) : profil(x))}
      mark={(_x, y) => (y < 0.16 * h ? 'sno' : y < 0.33 * h ? 'fjell' : 'gress')}
      vann={[
        { niva: 0.44 * h, til: 0.2 * w, type: 'hav' },
        { niva: 0.44 * h, fra: 0.38 * w, til: 0.62 * w, type: 'fjord' },
      ]}
    />
  );
}

function Innlandsis() {
  const w = 330;
  const h = 150;
  const bakke = (x: number) => 92 + 14 * Math.exp(-(((x - 170) / 110) ** 2)) + 3 * Math.sin(x / 19);
  return (
    <Snittblokk
      x={14}
      y={66}
      w={w}
      h={h}
      dybde={60}
      lag={[
        { type: 'gneis', topp: -100 },
        { type: 'morene', topp: (x) => bakke(x) - 4, bunn: (x) => bakke(x) + 5 },
      ]}
      overflate={bakke}
      mark="fjell"
      is={{ topp: (x) => 98 - 52 * Math.sqrt(Math.max(0, 1 - ((x - 170) / 150) ** 2)) }}
    />
  );
}

/** Olje, gass og vann i reservoaret under takbergarten (barn av Snittblokk, tegnet med useSnittblokk). */
function Hydrokarboner({
  reservoarTopp,
  reservoarBunn,
  gassOlje,
  oljeVann,
}: {
  reservoarTopp: (x: number) => number;
  reservoarBunn: (x: number) => number;
  gassOlje: number;
  oljeVann: number;
}) {
  const blokk = useSnittblokk();
  if (!blokk) return null;
  const xs = Array.from({ length: 161 }, (_, i) => (blokk.w * i) / 160);
  /** Delen av reservoaret mellom to kontakter (gass–olje, olje–vann). */
  const sone = (fra: number, til: number) => {
    const inne = xs.filter((x) => reservoarTopp(x) < til);
    if (inne.length < 2) return '';
    const topp = inne.map((x) => `${r2(x)} ${r2(Math.max(reservoarTopp(x), fra))}`);
    const bunn = [...inne].reverse().map((x) => `${r2(x)} ${r2(Math.min(reservoarBunn(x), til))}`);
    return `M${topp.join('L')}L${bunn.join('L')}Z`;
  };
  return (
    <g>
      <path d={sone(-1e3, gassOlje)} fill={alpha(GEO.gass.fill, 0.62)} stroke={GEO.gass.line} strokeWidth={1.2} />
      <path d={sone(gassOlje, oljeVann)} fill={alpha(GEO.olje.fill, 0.62)} stroke={GEO.olje.line} strokeWidth={1.2} />
    </g>
  );
}

function Felle({ f }: { f: number }) {
  const H = geoHoyde(f, 340);
  const dybde = 80;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const w = 800 - 20 - dx - etikettPlass(13, f);
  const h = H - dy - 26;
  const kuppel = { kuppel: { hoyde: 0.22 * h, bredde: 0.17 * w }, midt: 0.48 * w };
  const res = lagflate(0.52 * h, kuppel);
  const lag: SnittLag[] = [
    { type: 'leirskifer', topp: lagflate(0.8 * h, kuppel), navn: 'Kildebergart', undertekst: 'leirskifer' },
    { type: 'siltstein', topp: lagflate(0.68 * h, kuppel) },
    { type: 'sandstein', topp: res, navn: 'Reservoar', undertekst: 'sandstein' },
    { type: 'leirskifer', topp: lagflate(0.4 * h, kuppel), navn: 'Takbergart', undertekst: 'leirskifer' },
    { type: 'siltstein', topp: lagflate(0.26 * h, { ...kuppel, kuppel: { hoyde: 0.1 * h, bredde: 0.2 * w } }) },
    { type: 'leire', topp: lagflate(-0.2 * h, {}), navn: 'Havbunnsleire' },
  ];
  return (
    <Snittblokk
      x={20}
      y={dy + 8}
      w={w}
      h={h}
      dybde={dybde}
      lag={lag}
      overflate={0.16 * h}
      vann={{ niva: 0.02 * h, type: 'hav' }}
      etiketter
      over={
        <g>
          <line x1={r2(0.48 * w)} x2={r2(0.48 * w)} y1={r2(0.16 * h)} y2={r2(0.42 * h)} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="5 4" />
          {/* Midt i gass- og oljesonen ved toppen av kuppelen (reservoartoppen ligger der i 0,30 · h) */}
          <Txt x={r2(0.48 * w + 8)} y={r2(0.335 * h + 17 * 0.7 * f * 0.35)} anchor="start" size={0.7} weight={650}>
            Gass
          </Txt>
          <Txt x={r2(0.48 * w + 8)} y={r2(0.41 * h + 17 * 0.7 * f * 0.35)} anchor="start" size={0.7} weight={650}>
            Olje
          </Txt>
        </g>
      }
    >
      <Hydrokarboner reservoarTopp={res} reservoarBunn={lagflate(0.68 * h, kuppel)} gassOlje={0.37 * h} oljeVann={0.45 * h} />
    </Snittblokk>
  );
}

function Ytterpunkter({ f }: { f: number }) {
  const mobil = f > 1.3;
  const ting: SnittLag[] = [
    { type: 'basalt', topp: 30 },
    { type: 'aske', topp: 18 },
    { type: 'basalt', topp: 4 },
  ];
  const tull: SnittLag[] = [
    { type: 'sandstein', topp: Number.NaN },
    { type: 'kalkstein', topp: () => Number.NaN },
    { type: 'leire', punkter: [[0, 0], [Number.NaN, 4]] },
  ];
  // På mobil står blokkene under hverandre: den bratte blokka trenger plass til bakkanten (dy ≈ 140) over seg
  const a = mobil ? { x: 30, y: 0 } : { x: 20, y: 60 };
  const b = mobil ? { x: 30, y: 270 } : { x: 282, y: 60 };
  const c = mobil ? { x: 30, y: 475 } : { x: 544, y: 60 };
  return (
    <>
      <Snittblokk x={a.x} y={a.y} w={mobil ? 700 : 220} h={150} dybde={0} lag={flate} forkastninger={[{ x: 110, sprang: 60, fall: 89 }]} />
      <Snittblokk x={b.x} y={b.y + 40} w={mobil ? 520 : 150} h={110} dybde={mobil ? 160 : 110} vinkel={60} lag={ting} mark="sno" />
      <Snittblokk x={c.x} y={c.y} w={mobil ? 700 : 220} h={150} dybde={50} lag={tull} vann={{ niva: Number.NaN }} />
      <Txt x={c.x + (mobil ? 350 : 110)} y={c.y + 80} size={0.75} muted>
        Ugyldige tall
      </Txt>
    </>
  );
}

function GangerOgKammer({ f }: { f: number }) {
  const H = geoHoyde(f, 300);
  const dybde = 70;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const w = 800 - 40 - dx;
  const h = H - dy - 26;
  const lag: SnittLag[] = [
    { type: 'glimmerskifer', topp: 0.75 * h },
    { type: 'kvartsitt', topp: 0.62 * h },
    { type: 'sandstein', topp: 0.45 * h },
    { type: 'leirskifer', topp: 0.25 * h },
    { type: 'kalkstein', topp: 0.12 * h },
  ];
  return (
    <Snittblokk x={20} y={dy + 6} w={w} h={h} dybde={dybde} lag={lag} mark="fjell">
      <SnittMagmakammer x={0.2 * w} y={0.82 * h} rx={0.12 * w} ry={0.12 * h} stivnet="granitt" tilforsel={false} />
      <SnittGang fra={[0.04 * w, 0.535 * h]} til={[0.4 * w, 0.535 * h]} bredde={14} type="gabbro" />
      <SnittMagmakammer x={0.68 * w} y={0.84 * h} rx={0.14 * w} ry={0.11 * h} kanal={0.75 * w} />
      <SnittGang fra={[0.5 * w, h + 5]} til={[0.46 * w, 0]} bredde={12} smelte seed={7} />
    </Snittblokk>
  );
}

/* ---------------------------------------------------------------- Lagpakke */

const sedimenter: LagpakkeLag[] = [
  { type: 'gneis', tykkelse: 6, navn: 'Grunnfjell (gneis)' },
  { type: 'konglomerat', tykkelse: 4, erosjon: true },
  { type: 'sandstein', tykkelse: 10, tekst: 'skråsjikt' },
  { type: 'leirskifer', tykkelse: 7, tekst: 'trilobitter' },
  { type: 'kalkstein', tykkelse: 9 },
  { type: 'morene', tykkelse: 3, erosjon: true },
];

const losmasser: LagpakkeLag[] = [
  { type: 'gneis', tykkelse: 1.5, navn: 'Berggrunn' },
  { type: 'morene', tykkelse: 3, erosjon: true },
  { type: 'breelv', tykkelse: 2.5 },
  { type: 'leire', tykkelse: 5, navn: 'Marin leire' },
  { type: 'kvikkleire', tykkelse: 2.2, uthevet: true },
  { type: 'leire', tykkelse: 1.2, navn: 'Marin leire' },
  { type: 'sand', tykkelse: 1.6, navn: 'Strandsand' },
  { type: 'torv', tykkelse: 0.8 },
];

function LagpakkeHoyre() {
  return <Lagpakke x={10} y={8} bredde={380} hoyde={230} lag={sedimenter} />;
}
const hoyreBoks = (f: number) => `0 0 400 ${lagpakkeOppsett({ bredde: 380, hoyde: 230, lag: sedimenter }, f).hoyde + 16}`;

function LagpakkeKorn() {
  return <Lagpakke x={10} y={8} bredde={380} hoyde={220} lag={losmasser} etiketter="under" profil="korn" gress kolonne={190} />;
}
const kornBoks = (f: number) =>
  `0 0 400 ${lagpakkeOppsett({ bredde: 380, hoyde: 220, lag: losmasser, etiketter: 'under', profil: 'korn', kolonne: 190 }, f).hoyde + 16}`;

const mange: LagpakkeLag[] = Array.from({ length: 12 }, (_, i) => ({
  type: (['sandstein', 'leirskifer', 'kalkstein', 'kull', 'siltstein', 'aske'] as const)[i % 6]!,
  tykkelse: i === 4 ? 0 : i === 7 ? Number.NaN : 0.4 + (i % 3) * 0.5,
}));
const tynn: LagpakkeLag[] = [{ type: 'salt', tykkelse: 0.004, navn: 'Saltlag' }];

function LagpakkeYtter({ f }: { f: number }) {
  const a = lagpakkeOppsett({ bredde: 190, hoyde: 200, lag: tynn }, f);
  return (
    <>
      <Lagpakke x={6} y={8} bredde={190} hoyde={200} lag={tynn} />
      <Lagpakke x={206} y={8} bredde={190} hoyde={200} lag={mange} yngre={false} etiketter="ingen" />
      <Lagpakke x={6} y={a.hoyde + 30} bredde={380} hoyde={60} lag={[]} />
    </>
  );
}
const ytterBoks = (f: number) =>
  `0 0 400 ${Math.max(lagpakkeOppsett({ bredde: 190, hoyde: 200, lag: tynn }, f).hoyde, lagpakkeOppsett({ bredde: 190, hoyde: 200, lag: mange, yngre: false, etiketter: 'ingen' }, f).hoyde) + 30}`;

function LagpakkeBred({ f }: { f: number }) {
  return <Lagpakke x={20} y={10} bredde={760} hoyde={geoHoyde(f, 260) - 60} lag={losmasser} />;
}
const bredBoks = (f: number) => `0 0 800 ${lagpakkeOppsett({ bredde: 760, hoyde: geoHoyde(f, 260) - 60, lag: losmasser }, f).hoyde + 20}`;

/* ---------------------------------------------------------------- Borekjerne */

const kjerneSediment: LagpakkeLag[] = [
  { type: 'morene', tykkelse: 0.9 },
  { type: 'leire', tykkelse: 1.6, varv: 18, navn: 'Varvig leire' },
  { type: 'siltstein', tykkelse: 0.3, navn: 'Silt' },
  { type: 'torv', tykkelse: 0.7 },
];
const kjerneBerg: LagpakkeLag[] = [
  { type: 'granitt', tykkelse: 12 },
  { type: 'diabas', tykkelse: 3 },
  { type: 'gneis', tykkelse: 9 },
  { type: 'kvartsitt', tykkelse: 6, erosjon: true },
];

function Borekjerner({ f }: { f: number }) {
  const mobil = f > 1.3;
  // På mobil: to og to kjerner, bredere (figuren krymper til ca. 330 px) og med plass til etikettene
  const H = mobil ? 270 : 280;
  const rad2 = mobil ? H + 110 : 0;
  const b = mobil ? 1.45 : 1;
  return (
    <>
      <Borekjerne
        x={mobil ? 140 : 90}
        y={mobil ? 44 : 34}
        bredde={56 * b}
        hoyde={H}
        lag={kjerneSediment}
        dybdeakse
        prover={[
          { dybde: 0.35, navn: 'Prøve A', tekst: 'C-14: 9 800 år' },
          { dybde: 2.9, navn: 'Prøve B', tekst: 'C-14: 11 600 år' },
        ]}
      />
      <Borekjerne x={mobil ? 560 : 310} y={mobil ? 44 : 34} bredde={46 * b} hoyde={H} lag={kjerneBerg} etiketter brudd={4} dybdeakse />
      <Borekjerne x={mobil ? 140 : 530} y={34 + rad2} bredde={18 * b} hoyde={H} lag={sedimenter} brudd={2} />
      <Borekjerne
        x={mobil ? 420 : 630}
        y={34 + rad2}
        bredde={70 * b}
        hoyde={H}
        lag={[{ type: 'leire', tykkelse: 1, varv: 60 }]}
        prover={[{ dybde: 0.5, navn: 'Varvtelling' }, { dybde: 7 }]}
      />
    </>
  );
}

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem
        wide
        title="Snittblokk: flattliggende lag over grunnfjell, innsjø og etiketter"
        note="Standard overflate (toppen av berggrunnen) med en forsenkning, vann={{ niva, fra, til }}, erosjon på konglomeratet (diskordans mot grunnfjellet), etiketter i egen kolonne."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}
      >
        {(f) => <Flattliggende f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title={`Snittblokk: folder med berggrunnskart på toppen (mark="kart")`}
        note="lagflate(y0, { amplitude, bolgelengde, midt, fall }) for alle lagene, flat erodert overflate, dybde 150 og vinkel 30. Utgående lag gjentar seg symmetrisk om folden."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 360)}`}
      >
        {(f) => <Folder f={f} />}
      </GalleryItem>
      <GalleryItem title="Normalforkastning med skrent" note="sprang 36, fall 60, heller mot høyre; overflaten følger berggrunnen." viewBox="0 0 400 230">
        <Normal />
      </GalleryItem>
      <GalleryItem title="Reversforkastning" note={`sprang −34, fall 45, heller mot venstre, mark="jord".`} viewBox="0 0 400 230">
        <Revers />
      </GalleryItem>
      <GalleryItem
        wide
        title="Relativ alder: skrå lag, forkastning, diskordans, gang og magmakammer"
        note="Forkastningen skjærer bare de fire eldste lagene (lag: 4), konglomeratet ligger på en erosjonsflate, og gangen (SnittGang) fra magmakammeret skjærer alt opp til sandsteinen F. Bokstavene er tegnet med over."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 330)}`}
      >
        {(f) => <RelativAlder f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Kyst og fjord: hav, fjord, fjell med snø, granitt og leire i fjordbunnen"
        note="overflate som funksjon, mark som funksjon av høyden (snø, fjell, gress), to vannflater (hav og fjord), polygoner for granitten og leira."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 330)}`}
      >
        {(f) => <KystOgFjord f={f} />}
      </GalleryItem>
      <GalleryItem title="Innlandsis over grunnfjell" note={`is={{ topp }} over en morene på gneis, mark="fjell" der isen slutter.`} viewBox="0 0 400 230">
        <Innlandsis />
      </GalleryItem>
      <GalleryItem wide title="Ganger og magmakammer" note="Pluton (stivnet), lagergang i gabbro, magmakammer med kanal til overflaten og en smeltet gang." viewBox={(f) => `0 0 800 ${geoHoyde(f, 300)}`}>
        {(f) => <GangerOgKammer f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Felle for olje og gass under havet (barn med useSnittblokk)"
        note="Kuppel med lagflate(y0, { kuppel }), hav over havbunnen, gass og olje tegnet som barn i snittets koordinater, borehull og tekst med over."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}
      >
        {(f) => <Felle f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Ytterpunkter: uten perspektiv, bratt perspektiv og ugyldige lag"
        note="dybde 0 med nesten loddrett forkastning (fall 89, halvpilene flyttes ned under skrenten), dybde 110 og vinkel 60 på en smal blokk, og lag med ugyldige tall: en topp som ikke er et tall og et polygon med ugyldige punkter tegnes ikke, mens en funksjon som gir et ugyldig tall, regnes som 0 (her kalksteinen)."
        viewBox={(f) => (f > 1.3 ? '0 0 800 645' : '0 0 800 250')}
      >
        {(f) => <Ytterpunkter f={f} />}
      </GalleryItem>
      <GalleryItem title="Lagpakke: etiketter til høyre" note="Dybdeakse, pil «yngre», tekst under navnet og erosjonsflater (bølget)." viewBox={hoyreBoks}>
        <LagpakkeHoyre />
      </GalleryItem>
      <GalleryItem title="Lagpakke: kornstørrelsesprofil, etiketter under" note={`profil="korn", etiketter="under", gress, uthevet kvikkleire.`} viewBox={kornBoks}>
        <LagpakkeKorn />
      </GalleryItem>
      <GalleryItem title="Lagpakke: ytterpunkter" note="Ett tynt lag (0,004 m), tolv lag (to med tykkelse 0 eller ugyldig) uten pil og etiketter, og en tom liste." viewBox={ytterBoks}>
        {(f) => <LagpakkeYtter f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title={`Lagpakke i full bredde (etiketter="auto": til høyre når de får plass)`}
        note="Høyden følger geoHoyde, så kolonnen blir høyere på mobil."
        viewBox={bredBoks}
      >
        {(f) => <LagpakkeBred f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Borekjerner: varv og C-14-prøver, fjellkjerne med brudd og etiketter, smal kjerne og 60 varv"
        viewBox={(f) => (f > 1.3 ? '0 0 800 760' : '0 0 800 360')}
      >
        {(f) => <Borekjerner f={f} />}
      </GalleryItem>
    </GalleryGrid>
  );
}
