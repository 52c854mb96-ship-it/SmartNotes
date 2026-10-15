/**
 * Galleri for landskapsfamilien (?galleri=geo-landskap): Isbre (dalbre med etiketter, soner og strømlinjer, en bre som
 * har trukket seg tilbake med bresjø og gamle morener, en bre i likevekt, en dal uten bre, innlandsis med og uten
 * isostasi og landet etter at isen er borte, havis med smeltedammer og isfjell), Elveleie (lengdeprofil med soner, med
 * demning og som slamstrøm, tverrsnitt med flomlinjer, målepunkter og forbygning, kart med meandre, kroksjø og rett
 * kanal) og Fjellside, Bekk og Demning (kopiert fra fysikkens vannkraftverk, med løsmasser og berggrunn).
 */
import type { ReactNode } from 'react';
import { Himmel, Terreng, Vann } from '../../../kit/scene';
import { fmt } from '../../../kit/format';
import { Txt } from '../../../kit/txt';
import { geoHoyde } from '../felles';
import {
  Bekk,
  Demning,
  Elveleie,
  Fjellside,
  Isbre,
  TVERRPROFIL_STANDARD,
  demningMaal,
  elveleieGeometri,
  isbreGeometri,
  likevektsFront,
  tverrsnittAreal,
  tverrsnittPaneler,
  type ElveleieProps,
  type IsbreProps,
  type Malepunkt,
} from '../landskap';
import type { SnittPunkt } from '../snitt';
import { GalleryGrid, GalleryItem } from './felles';

/** Bredden etikettkolonnen trenger for tekster med `tegn` tegn (Txt 0,8, pluss strek og marg). */
const etikettPlass = (tegn: number, f: number) => tegn * 0.58 * 17 * 0.8 * f + 36;

type Uten<T> = Omit<T, 'x' | 'y' | 'w' | 'h'>;
type Ramme = { x: number; y: number; w: number; h: number; dx: number };

/**
 * Plasserer en blokk (Isbre eller Elveleie) i en figur med bredden `W`: blokka og etikettkolonnen fyller bredden, og
 * rammen (fjellsiden, sonene, aksene) starter øverst til venstre. Gir x, y og w og høyden figuren trenger.
 */
function plasser(geo: (w: number) => Ramme | null, W: number, kolonne: number): { x: number; y: number; w: number; hoyde: number } {
  const venstre = 12;
  // Dybden og venstremargen avhenger av w, så vi regner tre ganger
  let w = Math.max(100, W * 0.7);
  for (let i = 0; i < 3; i++) {
    const g = geo(w);
    w = Math.max(100, W - venstre - 10 - kolonne - (g?.dx ?? 0) + (g ? g.x : 0));
  }
  const g = geo(w);
  const x = venstre - (g ? g.x : 0);
  const y = 8 - (g ? g.y : 0);
  return { x, y, w, hoyde: y + (g ? g.y + g.h : 0) + 8 };
}

function isbreRute(p: Uten<IsbreProps>, W: number, H: (f: number) => number, kolonne: (f: number) => number = () => 0) {
  const sted = (f: number) => {
    const h = H(f);
    const geo = (w: number) => {
      const g = isbreGeometri({ ...p, x: 0, y: 0, w, h } as IsbreProps, f);
      return g ? { ...g.ramme, dx: g.dx } : null;
    };
    return { h, ...plasser(geo, W, kolonne(f)) };
  };
  return {
    viewBox: (f: number) => `0 0 ${W} ${Math.round(sted(f).hoyde)}`,
    children: (f: number) => {
      const { x, y, w, h, hoyde } = sted(f);
      return (
        <g>
          <Himmel w={W} h={hoyde} sol={{ x: W * 0.9, y: 26, r: 13 }} skyer={p.type === 'havis' ? 2 : 1} />
          <Isbre {...(p as IsbreProps)} x={x} y={y} w={w} h={h} />
        </g>
      );
    },
  };
}

function elvRute(p: Uten<ElveleieProps>, W: number, H: (f: number) => number, kolonne: (f: number) => number = () => 0, himmel = true) {
  const sted = (f: number) => {
    const h = H(f);
    const geo = (w: number) => {
      const g = elveleieGeometri({ ...p, x: 0, y: 0, w, h } as ElveleieProps, f);
      return g ? { ...g.ramme, dx: g.dx } : null;
    };
    return { h, ...plasser(geo, W, kolonne(f)) };
  };
  return {
    viewBox: (f: number) => `0 0 ${W} ${Math.round(sted(f).hoyde)}`,
    children: (f: number) => {
      const { x, y, w, h, hoyde } = sted(f);
      return (
        <g>
          {himmel && <Himmel w={W} h={hoyde} sol={{ x: W * 0.9, y: 26, r: 13 }} skyer={1} />}
          <Elveleie {...(p as ElveleieProps)} x={x} y={y} w={w} h={h} />
        </g>
      );
    },
  };
}

/** Fjellside, bekk og demning i et lite vannkraftlandskap: magasin bak demningen, bekken ned fjellsida. */
function FjellsideScene() {
  const terreng: SnittPunkt[] = [
    [0, 92],
    [60, 88],
    [130, 104],
    [210, 150],
    [290, 182],
    [372, 196],
    [470, 236],
    [560, 262],
    [800, 268],
  ];
  const dam = { x: 372, y: 196, hoyde: 46 };
  const m = demningMaal(dam);
  const niva = (m?.krone.y ?? 150) + 6;
  const bekk: SnittPunkt[] = [
    [40, 89],
    [110, 99],
    [190, 140],
    [262, 172],
    [300, 182],
  ];
  return (
    <g>
      <Himmel w={800} h={300} sol={{ x: 700, y: 50 }} skyer={2} />
      <Vann x={180} y={niva} w={192} h={200 - niva} />
      <Terreng points={terreng} bottom={300} type="gress" />
      <Fjellside terreng={terreng} bunn={300} losmasse={{ type: 'morene', tykkelse: 10 }} />
      <Bekk leie={bekk} />
      <Demning {...dam} />
      <Txt x={600} y={240} anchor="middle" size={0.8} weight={650}>
        Fjellside med morene
      </Txt>
    </g>
  );
}

export default function GalleriLandskap() {
  const W = 800;
  const kol = (n: number) => (f: number) => etikettPlass(n, f);

  /* ---------- Isbre ---------- */
  const dalbre: Uten<IsbreProps> = { etiketter: true, soner: true, strom: true };
  const tilbake: Uten<IsbreProps> = { front: 0.47, likevektslinje: 1300, endemorene: [0.69, 0.76], etiketter: true };
  const ela = 1200;
  const frontL = likevektsFront(ela) ?? 0;
  const likevekt: Uten<IsbreProps> = { front: frontL, likevektslinje: ela, soner: true };
  const tom: Uten<IsbreProps> = { front: 0, endemorene: [0.62, 0.74], likevektslinje: 1900 };
  const inn: Uten<IsbreProps> = { type: 'innlandsis', etiketter: true, strom: true };
  const iso: Uten<IsbreProps> = { type: 'innlandsis', isostasi: true, tykkelse: 3000, etiketter: true };
  const etter: Uten<IsbreProps> = { type: 'innlandsis', isostasi: true, tykkelse: 0, nedsynking: 700, havniva: -60, etiketter: true };
  const havis: Uten<IsbreProps> = { type: 'havis', dekning: 0.85, smeltedammer: true, etiketter: true };
  const isfjell: Uten<IsbreProps> = { type: 'havis', dekning: 0.35, isfjell: true, tykkelse: 3 };
  const ytter: Uten<IsbreProps> = { front: 1, likevektslinje: 300, tykkelse: 600, endemorene: [Number.NaN, 2], hoyder: { topp: 100, bunn: 900 } };

  /* ---------- Elveleie ---------- */
  const lengde: Uten<ElveleieProps> = { soner: true, etiketter: true };
  const grumsete: Uten<ElveleieProps> = { klarhet: 'grumsete', soner: 'lop', vannforing: 1 };
  const demning: Uten<ElveleieProps> = { klarhet: 'grumsete', demning: { u: 0.42 }, etiketter: true };
  const slam: Uten<ElveleieProps> = { klarhet: 'slamstrom', vannforing: 0.8, fjellvegg: false };
  const flomlinjer = [
    { niva: 4.3, navn: '10-årsflom' },
    { niva: 5.4, navn: '200-årsflom' },
  ];
  const tverr: Uten<ElveleieProps> = { visning: 'tverr', vannstand: 3.1, flomlinjer, etiketter: true, akser: true };
  const malepunkter: Malepunkt[] = [
    { x: 47, fart: 0.35 },
    { x: 53, fart: 0.8 },
    { x: 59, fart: 1.15 },
    { x: 65, fart: 1.05 },
    { x: 71, fart: 0.6 },
    { x: 76, fart: 0.25 },
  ];
  const q = tverrsnittPaneler(TVERRPROFIL_STANDARD, 3.1, malepunkter);
  const maaling: Uten<ElveleieProps> = { visning: 'tverr', vannstand: 3.1, malepunkter, dybde: 0 };
  const flom: Uten<ElveleieProps> = { visning: 'tverr', vannstand: 5.2, forbygning: [{ x: 88, hoyde: 2.2, bredde: 3 }], klarhet: 'grumsete', etiketter: true };
  const meandre: Uten<ElveleieProps> = { visning: 'ovenfra', kroksjo: true, prosesser: true, strom: true, etiketter: true };
  const rett: Uten<ElveleieProps> = { visning: 'ovenfra', form: 'rett' };
  const slynget: Uten<ElveleieProps> = { visning: 'ovenfra', slyngning: 1, svinger: 3, klarhet: 'grumsete' };

  const a1 = isbreRute(dalbre, W, (f) => geoHoyde(f, 270), kol(16));
  const a2 = isbreRute(tilbake, W, (f) => geoHoyde(f, 250), kol(16));
  const a3 = isbreRute(likevekt, 400, (f) => geoHoyde(f, 180));
  const a4 = isbreRute(tom, 400, (f) => geoHoyde(f, 180));
  const a5 = isbreRute(inn, W, (f) => geoHoyde(f, 250), kol(12));
  const a6 = isbreRute(iso, W, (f) => geoHoyde(f, 290), kol(12));
  const a7 = isbreRute(etter, W, (f) => geoHoyde(f, 250), kol(12));
  // Havis har innholdet øverst: på mobil trengs bare plass til etikettene, ikke et dypere hav
  const a8 = isbreRute(havis, W, (f) => 170 + 110 * (f - 1), kol(22));
  const a9 = isbreRute(isfjell, 400, (f) => geoHoyde(f, 170));
  const a10 = isbreRute(ytter, 400, (f) => geoHoyde(f, 160));
  const b1 = elvRute(lengde, W, (f) => geoHoyde(f, 250), kol(15));
  const b2 = elvRute(grumsete, 400, (f) => geoHoyde(f, 190));
  const b3 = elvRute(demning, W, (f) => geoHoyde(f, 250), kol(15));
  const b4 = elvRute(slam, 400, (f) => geoHoyde(f, 190));
  const b5 = elvRute(tverr, W, (f) => geoHoyde(f, 230), kol(13), false);
  const b6 = elvRute(maaling, 400, (f) => geoHoyde(f, 200), () => 0, false);
  const b7 = elvRute(flom, 400, (f) => geoHoyde(f, 200), kol(12), false);
  const b8 = elvRute(meandre, W, (f) => geoHoyde(f, 300), kol(12), false);
  const b9 = elvRute(rett, 400, (f) => geoHoyde(f, 220), () => 0, false);
  const b10 = elvRute(slynget, 400, (f) => geoHoyde(f, 220), () => 0, false);
  const rute = (o: { viewBox: (f: number) => string; children: (f: number) => ReactNode }) => ({ viewBox: o.viewBox, children: o.children });
  return (
    <GalleryGrid>
      <GalleryItem wide title="Isbre: dalbre med etiketter, soner og strømlinjer" note="Standardverdiene: likevektslinje 1100 m o.h., front 0,62, tykkelse 320 m; etiketter, soner og strom." {...rute(a1)} />
      <GalleryItem
        wide
        title="Isbre: breen har trukket seg tilbake"
        note="front 0,47, likevektslinje 1300, endemorene [0,69, 0,76]: bresjø bak den innerste morenen og sidemorene høyt i dalsiden."
        {...rute(a2)}
      />
      <GalleryItem title={`Dalbre i likevekt (likevektslinje ${ela} m o.h.)`} note={`likevektsFront(${ela}) = ${fmt(frontL, 2)} (AAR 0,6); soner.`} {...rute(a3)} />
      <GalleryItem title="Dalen uten bre" note="front 0, endemorene [0,62, 0,74], likevektslinje 1900: bunnmorene, morener og bresjø." {...rute(a4)} />
      <GalleryItem wide title="Isbre: innlandsis med strømlinjer" note="tykkelse 2500 m, senter 0,42, etiketter og strom." {...rute(a5)} />
      <GalleryItem wide title="Innlandsis med isostasi" note="tykkelse 3000 m, isostasi: skorpa trykkes ned omtrent 0,28 · tykkelsen." {...rute(a6)} />
      <GalleryItem wide title="Etter istida: isen er borte, landet er fortsatt trykt ned" note="tykkelse 0, nedsynking 700 m, havnivå −60 m." {...rute(a7)} />
      <GalleryItem wide title="Havis med smeltedammer" note="dekning 0,85, tykkelse 2 m, smeltedammer og etiketter." {...rute(a8)} />
      <GalleryItem title="Havis og isfjell" note="dekning 0,35, tykkelse 3 m, isfjell (ikke i samme målestokk)." {...rute(a9)} />
      <GalleryItem title="Ytterpunkter: dalbre" note="front 1, likevektslinje 300, tykkelse 600, ugyldige morener og høyder (topp under bunn)." {...rute(a10)} />

      <GalleryItem wide title="Elveleie: lengdeprofil fra fjell til delta" note="Standardverdiene med soner (erosjon, transport, avsetning) og etiketter." {...rute(b1)} />
      <GalleryItem title="Grumsete vann i flom" note={`klarhet="grumsete", vannforing 1, soner="lop".`} {...rute(b2)} />
      <GalleryItem title="Slamstrøm" note={`klarhet="slamstrom", vannforing 0,8, uten dalside.`} {...rute(b4)} />
      <GalleryItem wide title="Elveleie med demning" note="demning ved 0,42: magasinet fanger slammet (sand ved innløpet, leire på bunnen), og vannet nedenfor blir klart." {...rute(b3)} />
      <GalleryItem wide title="Elveleie: tverrsnitt med flomlinjer" note="vannstand 3,1 m, flomlinjer for 10- og 200-årsflom, akser og etiketter." {...rute(b5)} />
      <GalleryItem
        title="Målevertikaler (midtseksjonsmetoden)"
        note={`6 vertikaler med fart, dybde 0: areal ${fmt(q?.areal ?? Number.NaN, 0)} m², vannføring ${fmt(q?.vannforing ?? Number.NaN, 0)} m³/s (tverrsnittAreal ${fmt(tverrsnittAreal(TVERRPROFIL_STANDARD, 3.1) ?? Number.NaN, 0)} m²).`}
        {...rute(b6)}
      />
      <GalleryItem title="Flom over flomsletta" note="vannstand 5,2 m, forbygning på høyre bredd (2,2 m høy), grumsete vann." {...rute(b7)} />
      <GalleryItem wide title="Elveleie ovenfra: meandre med kroksjø" note="slyngning 0,7, 2 svinger, kroksjø, prosesser, strømlinjer og etiketter." {...rute(b8)} />
      <GalleryItem title="Rett kanal med forbygning" note={`form="rett": steinsatte bredder og spor etter de gamle svingene.`} {...rute(b9)} />
      <GalleryItem title="Sterkt slynget og grumsete" note="slyngning 1, 3 svinger (flere blir lagt til når de ikke får plass)." {...rute(b10)} />

      <GalleryItem wide title="Fjellside, Bekk og Demning" note="Fjellside med morene over berget, bekk og demning med magasin (scene-kit-ets Vann)." viewBox="0 0 800 300">
        <FjellsideScene />
      </GalleryItem>
      <GalleryItem title="Fjellside med berggrunn" note={`berggrunn="granitt", losmasse morene 16, mark="sno".`} viewBox="0 0 400 220">
        <Himmel w={400} h={220} />
        <Fjellside
          terreng={[
            [0, 40],
            [90, 52],
            [180, 104],
            [280, 150],
            [400, 170],
          ]}
          bunn={220}
          mark="sno"
          berggrunn="granitt"
          losmasse={{ type: 'morene', tykkelse: 16 }}
        />
      </GalleryItem>
      <GalleryItem title="Bekk: klart, grumsete og slamstrøm" note="dybde 4, 6 og 8 med samme leie; t gir krusninger som renner nedover." viewBox="0 0 400 200">
        <Himmel w={400} h={200} />
        {(['klar', 'grumsete', 'slamstrom'] as const).map((k, i) => {
          const x0 = 8 + i * 131;
          const leie: SnittPunkt[] = [
            [x0, 70],
            [x0 + 40, 92],
            [x0 + 85, 130],
            [x0 + 122, 140],
          ];
          return (
            <g key={k}>
              <Terreng points={leie} bottom={200} type="gress" glatt />
              <Bekk leie={leie} klarhet={k} dybde={4 + 2 * i} seed={i + 2} />
              <Txt x={x0 + 61} y={178} size={0.8} weight={650}>
                {k === 'klar' ? 'Klar' : k === 'grumsete' ? 'Grumsete' : 'Slamstrøm'}
              </Txt>
            </g>
          );
        })}
      </GalleryItem>
      <GalleryItem title="Demning: med rekkverk, terskel og speilvendt" note="hoyde 60, 18 og 40; flip legger magasinet til høyre." viewBox="0 0 400 200">
        <Himmel w={400} h={200} />
        <Vann x={0} y={98} w={70} h={62} />
        <Vann x={348} y={124} w={52} h={36} />
        <Terreng
          points={[
            [0, 160],
            [400, 160],
          ]}
          bottom={200}
          type="grus"
        />
        <Demning x={70} y={160} hoyde={60} />
        <Demning x={210} y={160} hoyde={18} rekkverk={false} />
        <Demning x={348} y={160} hoyde={40} flip />
        <Txt x={96} y={188} size={0.75} weight={600}>
          Demning
        </Txt>
        <Txt x={222} y={188} size={0.75} weight={600}>
          Terskel
        </Txt>
        <Txt x={330} y={188} size={0.75} weight={600}>
          flip
        </Txt>
      </GalleryItem>
    </GalleryGrid>
  );
}
