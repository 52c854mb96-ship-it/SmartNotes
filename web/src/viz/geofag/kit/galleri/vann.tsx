/**
 * Galleri for vannfamilien (?galleri=geo-vann): Grunnvannssnitt (innsjø og nydannelse fra regn, senkningstrakt rundt to
 * brønner, fjellbrønn og energibrønn), alle brønntypene, Nedbor (regn, snø og sludd, intensitet, skydekke), Skydekke,
 * Stromlinjer (vannets kretsløp med bredde etter mengde, alle stilene, mantelkonveksjon og isstrøm), Bygning (alle
 * typene i samme skala med en person, farger, snø, skilt og liten skala i et landskap) og Plattform (stål, betong og
 * flytende over et reservoar, og CO₂-injeksjon langs brønnen).
 */
import type { ReactNode } from 'react';
import { VIZ } from '../../../kit/colors';
import { Txt } from '../../../kit/txt';
import { fmt } from '../../../kit/format';
import { Himmel, Landskap, Person, Terreng } from '../../../kit/scene';
import { GEO } from '../colors';
import { geoHoyde } from '../felles';
import { GLOBALE_STROMMER } from '../hydrologi';
import { Snittblokk, lagflate, snittblokkPerspektiv, type SnittLag } from '../snitt';
import {
  BRONN_NAVN,
  Bronn,
  Grunnvannssnitt,
  Nedbor,
  Skydekke,
  Stromlinjer,
  grunnvannGeometri,
  senkningstrakt,
  stromBredde,
  type BronnType,
  type GrunnLag,
  type StromStil,
} from '../vann';
import { BYGNING_MAAL, Bygning, Plattform, bygningStorrelse, plattformPunkter, type BygningType } from '../bygg';
import { GalleryGrid, GalleryItem } from './felles';

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Bredden etikettkolonnen trenger for tekster med `tegn` tegn (Txt 0,8, pluss strek og marg). */
const etikettPlass = (tegn: number, f: number) => tegn * 0.58 * 17 * 0.8 * f + 36;

/* ---------------------------------------------------------------- Grunnvannssnitt */

function InnsjoOgRegn({ f }: { f: number }) {
  const H = geoHoyde(f, 420);
  const dybde = 60;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const top = 110;
  const w = 800 - 16 - dx - etikettPlass(16, f);
  const h = H - top - 24;
  const g0 = (x: number) => 40 + 80 * (x / w);
  const dal = (x: number) => Math.exp(-(((x - 0.74 * w) / (0.07 * w)) ** 2));
  const overflate = (x: number) => g0(x) + 36 * dal(x);
  const speil = (x: number) => g0(x) + 58 * (1 - Math.exp(-(((x - 0.74 * w) / (0.26 * w)) ** 2)));
  const fjell = (x: number) => 0.8 * h + 8 * Math.sin(x / 45);
  const lag: GrunnLag[] = [
    { type: 'granitt', topp: fjell, navn: 'Fjell (granitt)' },
    { type: 'sand', navn: 'Sand og grus' },
  ];
  const g = grunnvannGeometri({ w, h, overflate, speil });
  const hx = 0.2 * w;
  const bx = 0.31 * w;
  const flyt = [0.62, 0.72, 0.84].map((d, i) => {
    const x0 = (0.06 + 0.06 * i) * w;
    const y0 = g.speil(x0) + 14 + 18 * i;
    return [
      [x0, y0],
      [0.35 * w, (g.speil(0.35 * w) + d * h) / 2 + 6 * i],
      [0.6 * w, d * h * 0.92],
      [0.74 * w - 10 + 10 * i, g.overflate(0.74 * w) + 6],
    ] as const;
  });
  return (
    <g>
      <Grunnvannssnitt
        x={16}
        y={top}
        w={w}
        h={h}
        dybde={dybde}
        overflate={overflate}
        speil={speil}
        lag={lag}
        etiketter="hoyre"
        over={
          <>
            <Bygning x={hx} y={g.overflate(hx) + 1} type="bolig" pxPerM={3} />
            <Bronn x={bx} y={g.overflate(bx)} bunn={g.speil(bx) + 70} vannstand={g.speil(bx)} type="losmasse" tilkobling="venstre" tilkoblingLengde={bx - hx - 18} />
            <Nedbor x={0} y={-top + 4} w={0.5 * w} h={top + 60} intensitet={0.55} vind={0.25} skydekke={{ tetthet: 0.75, hoyde: 50, avrundet: true }} bakke={(x) => g.overflate(x) - dy * 0.5} />
          </>
        }
      >
        <Stromlinjer stil="linje" farge={VIZ.velocity} avstand={110} linjer={flyt.map((p) => ({ punkter: p }))} />
      </Grunnvannssnitt>
    </g>
  );
}

function Senkningstrakt({ f }: { f: number }) {
  const H = geoHoyde(f, 330);
  const w = 760;
  const h = H - 40;
  const x0 = 20;
  const y0 = 20;
  const grunn = 0.42 * h;
  const bronner = [
    { x: 0.34 * w, senkning: 46, radius: 240, rBronn: 8 },
    { x: 0.7 * w, senkning: 30, radius: 200, rBronn: 8 },
  ];
  const speil = senkningstrakt(grunn, ...bronner);
  const overflate = 0.14 * h;
  const lag: GrunnLag[] = [
    { type: 'granitt', topp: (x) => 0.9 * h + 5 * Math.sin(x / 50) },
    { type: 'grus' },
  ];
  const g = grunnvannGeometri({ w, h, overflate, speil });
  const ox = 0.52 * w;
  return (
    <Grunnvannssnitt
      x={x0}
      y={y0}
      w={w}
      h={h}
      dybde={0}
      overflate={overflate}
      speil={speil}
      lag={lag}
      etiketter="inne"
      over={
        <>
          <path d={`M0 ${r2(grunn)}H${w}`} fill="none" stroke={GEO.grunnvann.line} strokeWidth={1.6} strokeDasharray="6 5" opacity={0.85} />
          <Txt x={w - 8} y={r2(grunn - 7)} anchor="end" size={0.7} color={GEO.grunnvann.line}>
            Speilet før pumping
          </Txt>
          {bronner.map((b, i) => (
            <Bronn key={i} x={b.x} y={g.overflate(b.x)} bunn={0.86 * h} vannstand={g.speil(b.x)} type="losmasse" filter={[0.62 * h, 0.86 * h]} />
          ))}
          <Bronn x={ox} y={g.overflate(ox)} bunn={0.8 * h} vannstand={g.speil(ox)} type="observasjon" peilebaand />
        </>
      }
    />
  );
}

function FjellOgEnergi({ f }: { f: number }) {
  const H = geoHoyde(f, 360);
  const dybde = 50;
  const { dx, dy } = snittblokkPerspektiv(dybde);
  const top = 50;
  const w = 800 - 16 - dx - etikettPlass(18, f);
  const h = H - top - 20;
  const overflate = (x: number) => 30 + 26 * Math.sin((x / w) * Math.PI * 0.9) * -1 + 40;
  const fjell = (x: number) => 0.38 * h + 14 * Math.sin(x / 60 + 1);
  const speil = (x: number) => overflate(x) + 30 + 26 * (x / w);
  const lag: GrunnLag[] = [
    { type: 'granitt', topp: fjell, navn: 'Granitt (grunnfjell)' },
    { type: 'morene', navn: 'Morene' },
  ];
  const g = grunnvannGeometri({ w, h, overflate, speil });
  const a = 0.3 * w;
  const b = 0.72 * w;
  return (
    <Grunnvannssnitt
      x={16}
      y={top}
      w={w}
      h={h}
      dybde={dybde}
      overflate={overflate}
      speil={speil}
      lag={lag}
      etiketter="hoyre"
      over={
        <>
          <Bygning x={0.12 * w} y={g.overflate(0.12 * w) - dy * 0.3} type="hytte" pxPerM={3.2} sno />
          <Bronn x={a} y={g.overflate(a)} bunn={h - 10} fjell={fjell(a)} vannstand={g.speil(a)} type="fjell" tilkobling="venstre" tilkoblingLengde={a - 0.12 * w - 16} />
          <Bygning x={0.9 * w} y={g.overflate(0.9 * w) - dy * 0.3} type="bolig" pxPerM={3.2} farge="hvit" />
          <Bronn x={b} y={g.overflate(b)} bunn={h - 6} fjell={fjell(b)} vannstand={g.speil(b)} type="energi" tilkobling="hoyre" tilkoblingLengde={0.9 * w - b - 16} />
        </>
      }
    />
  );
}

const BRONN_TYPER: readonly BronnType[] = ['fjell', 'losmasse', 'gravd', 'observasjon', 'energi', 'borehull'];

function AlleBronner({ f }: { f: number }) {
  const k = Math.max(1, 0.85 * f);
  const kol = f > 1.3 ? 3 : 6;
  const cw = 800 / kol;
  const ch = 230 + 40 * (f - 1);
  return (
    <g>
      {BRONN_TYPER.map((type, i) => {
        const cx = (i % kol) * cw;
        const cy = Math.floor(i / kol) * ch + 4;
        const w = cw - 14;
        const h = ch - 40 * f;
        const fjellTopp = type === 'fjell' || type === 'energi' || type === 'borehull' ? 0.42 * h : 0.85 * h;
        const lag: GrunnLag[] = [
          { type: 'granitt', topp: fjellTopp },
          { type: type === 'gravd' ? 'morene' : 'sand' },
        ];
        const ov = 0.2 * h;
        const sp = type === 'gravd' ? 0.42 * h : 0.36 * h;
        const x = w / 2;
        const bunn = type === 'gravd' ? 0.6 * h : h - 8;
        return (
          <g key={type} transform={`translate(${r2(cx + 7)} ${r2(cy)})`}>
            <Txt x={x} y={16 * f} size={0.78} weight={650}>
              {BRONN_NAVN[type]}
            </Txt>
            <Grunnvannssnitt
              x={0}
              y={24 * f}
              w={w}
              h={h}
              dybde={0}
              overflate={ov}
              speil={sp}
              lag={lag}
              kapillar={false}
              speilMerke={false}
              skygge={false}
              over={
                <Bronn
                  x={x}
                  y={ov}
                  bunn={bunn}
                  fjell={type === 'fjell' || type === 'energi' ? fjellTopp : undefined}
                  vannstand={sp}
                  type={type}
                  tilkobling={type === 'energi' || type === 'fjell' ? 'hoyre' : undefined}
                  tilkoblingLengde={w / 2 - 14 * k}
                  peilebaand={type === 'observasjon'}
                  pumpe={type === 'gravd' ? true : undefined}
                />
              }
            />
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Nedbør og skydekke */

const NEDBOR_SCENER: readonly { tittel: string; type: 'regn' | 'sno' | 'sludd'; intensitet: number; vind: number; sky?: number; sno?: boolean }[] = [
  { tittel: 'Lett regn (intensitet 0,2)', type: 'regn', intensitet: 0.2, vind: 0.1 },
  { tittel: 'Styrtregn med vind og skydekke', type: 'regn', intensitet: 1, vind: 0.5, sky: 0.95 },
  { tittel: 'Snø med skydekke', type: 'sno', intensitet: 0.6, vind: 0.3, sky: 0.45, sno: true },
  { tittel: 'Sludd mot venstre', type: 'sludd', intensitet: 0.65, vind: -0.45, sky: 0.7 },
];

function NedborScener({ f }: { f: number }) {
  const kol = f > 1.3 ? 1 : 2;
  const cw = 800 / kol;
  const ch = 200 + 70 * (f - 1);
  return (
    <g>
      {NEDBOR_SCENER.map((sc, i) => {
        const x = (i % kol) * cw + 4;
        const y = Math.floor(i / kol) * ch + 4;
        const w = cw - 8;
        const h = ch - 8;
        const bakke = (sx: number) => y + h * 0.78 - 16 * Math.sin(((sx - x) / w) * Math.PI);
        const punkter = Array.from({ length: 21 }, (_, j) => [x + (w * j) / 20, bakke(x + (w * j) / 20)] as const);
        const skyH = 0.3 * h;
        const sky = sc.sky !== undefined ? { tetthet: sc.sky, hoyde: skyH, utenSkyer: true } : undefined;
        return (
          <g key={i}>
            <clipPath id={`gv-nedbor-${i}`}>
              <rect x={x} y={y} width={w} height={h} rx={8} />
            </clipPath>
            <g clipPath={`url(#gv-nedbor-${i})`}>
              <Himmel x={x} y={y} w={w} h={h} sol={sc.sky !== undefined ? { x: x + w * 0.8, y: y + h * 0.42 } : { x: x + w * 0.82, y: y + 40 }} skyer={sc.sky !== undefined ? 0 : 1} seed={i + 2} />
              {sc.sky !== undefined && <Skydekke x={x} y={y} w={w} h={skyH} tetthet={sc.sky} himmel={h * 0.8} seed={i + 4 + 3} />}
              <Landskap x={x} y={y + h * 0.66} w={w} h={h * 0.3} type={sc.sno ? 'fjell' : 'aaser'} seed={i + 1} />
              <Terreng points={punkter} bottom={y + h} type={sc.sno ? 'sno' : 'gress'} glatt />
              <Nedbor x={x} y={y} w={w} h={h} type={sc.type} intensitet={sc.intensitet} vind={sc.vind} skydekke={sky} bakke={bakke} seed={i + 4} />
            </g>
            <Txt x={x + 10} y={y + h - 10} anchor="start" size={0.74} weight={650}>
              {sc.tittel}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function Intensitet({ f }: { f: number }) {
  const kol = f > 1.3 ? 1 : 3;
  const cw = 800 / kol;
  const ch = 190 + 60 * (f - 1);
  return (
    <g>
      {[0.1, 0.5, 1].map((I, i) => {
        const x = (i % kol) * cw + 4;
        const y = Math.floor(i / kol) * ch + 4;
        const w = cw - 8;
        const h = ch - 8;
        const bakke = y + h * 0.82;
        return (
          <g key={I}>
            <clipPath id={`gv-int-${i}`}>
              <rect x={x} y={y} width={w} height={h} rx={8} />
            </clipPath>
            <g clipPath={`url(#gv-int-${i})`}>
              <Himmel x={x} y={y} w={w} h={h} />
              <Skydekke x={x} y={y} w={w} h={0.3 * h} tetthet={0.3 + 0.6 * I} himmel={0.82 * h} seed={12} />
              <Landskap x={x} y={bakke} w={w} h={h * 0.25} type="by" seed={3} />
              <Terreng points={[[x, bakke], [x + w, bakke]]} bottom={y + h} type="asfalt" />
              <Nedbor x={x} y={y} w={w} h={h} intensitet={I} vind={0.2} skydekke={{ tetthet: 0.3 + 0.6 * I, hoyde: 0.3 * h, utenSkyer: true }} bakke={bakke} seed={9} />
            </g>
            <Txt x={x + 10} y={y + h - 8} anchor="start" size={0.74} weight={650}>
              {`intensitet ${fmt(I, 1)}`}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

function Skydekker({ f }: { f: number }) {
  const kol = f > 1.3 ? 2 : 4;
  const cw = 800 / kol;
  const ch = 150 + 50 * (f - 1);
  const varianter = [
    { t: 0, himmel: false, tekst: 'tetthet 0' },
    { t: 0.5, himmel: false, tekst: 'tetthet 0,5' },
    { t: 1, himmel: false, tekst: 'tetthet 1' },
    { t: 0.6, himmel: true, tekst: 'himmel (grått slør)' },
  ];
  return (
    <g>
      {varianter.map((v, i) => {
        const x = (i % kol) * cw + 4;
        const y = Math.floor(i / kol) * ch + 4;
        const w = cw - 8;
        const h = ch - 8;
        return (
          <g key={i}>
            <clipPath id={`gv-sky-${i}`}>
              <rect x={x} y={y} width={w} height={h} rx={8} />
            </clipPath>
            <g clipPath={`url(#gv-sky-${i})`}>
              <Himmel x={x} y={y} w={w} h={h} sol={{ x: x + w * 0.75, y: y + h * 0.55 }} />
              <Skydekke x={x} y={y} w={w} h={h * 0.42} tetthet={v.t} himmel={v.himmel ? h * 0.84 : undefined} seed={i + 3} />
              <Landskap x={x} y={y + h * 0.84} w={w} h={h * 0.3} type="skog" seed={i} />
            </g>
            <Txt x={x + 8} y={y + h - 8} anchor="start" size={0.72} weight={650}>
              {v.tekst}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Strømmer */

function Kretslop({ f }: { f: number }) {
  const H = geoHoyde(f, 340);
  const hav = 0.56 * 800;
  const bakke = H - 70;
  const maks = Math.max(...GLOBALE_STROMMER.map((s) => s.mengde));
  const m = (id: string) => GLOBALE_STROMMER.find((s) => s.id === id)?.mengde ?? 0;
  const b = (id: string) => stromBredde(m(id), maks, 26, 3);
  const tall = (id: string) => `${fmt(m(id) / 1000, 0)}`;
  const land: [number, number][] = [
    [0, bakke - 70],
    [120, bakke - 90],
    [260, bakke - 40],
    [hav - 30, bakke - 4],
    [hav + 10, bakke + 2],
  ];
  return (
    <g>
      <Himmel w={800} h={bakke} />
      <Terreng points={land} bottom={H} type="gress" glatt />
      <rect x={hav} y={bakke} width={800 - hav} height={H - bakke} fill="var(--sc-water)" />
      <Stromlinjer
        farge={GEO.fordamping}
        labelSize={0.74}
        linjer={[
          { punkter: [[640, bakke - 6], [610, 160], [560, 70]], bredde: b('fordamping-hav'), label: `Fordamping ${tall('fordamping-hav')}`, labelSide: 'venstre' },
          { punkter: [[150, bakke - 96], [170, 170], [200, 92]], bredde: b('fordamping-land'), label: `Fordamping ${tall('fordamping-land')}`, labelSide: 'venstre' },
        ]}
      />
      <Stromlinjer
        farge={GEO.nedbor}
        labelSize={0.74}
        linjer={[
          { punkter: [[700, 70], [730, 160], [740, bakke - 6]], bredde: b('nedbor-hav'), label: `Nedbør ${tall('nedbor-hav')}`, labelSide: 'hoyre', labelPos: 0.14 },
          { punkter: [[300, 80], [270, 160], [250, bakke - 50]], bredde: b('nedbor-land'), label: `Nedbør ${tall('nedbor-land')}`, labelSide: 'hoyre' },
        ]}
      />
      <Stromlinjer farge={GEO.avrenning} labelSize={0.74} linjer={[{ punkter: [[300, bakke - 28], [380, bakke - 12], [470, bakke + 18]], bredde: b('avrenning'), label: `Avrenning ${tall('avrenning')}`, labelSide: 'hoyre' }]} />
      <Stromlinjer farge={GEO.fordamping} stil="stiplet" bredde={2.4} labelSize={0.7} linjer={[{ punkter: [[520, 52], [330, 52]], label: `Vanndamp mot land ${tall('avrenning')}`, labelSide: 'venstre' }]} />
      <Txt x={14} y={H - 14} anchor="start" size={0.7} muted>
        1000 km³ per år (Trenberth mfl. 2007)
      </Txt>
    </g>
  );
}

const STILER: readonly StromStil[] = ['baand', 'linje', 'stiplet', 'prikker', 'front'];

function Stiler({ f }: { f: number }) {
  const rad = 62 + 22 * (f - 1);
  return (
    <g>
      {STILER.map((stil, i) => {
        const y = 40 * f + i * rad;
        const punkter = [
          [150, y],
          [330, y - 18],
          [520, y + 16],
          [760, y - 4],
        ] as const;
        return (
          <g key={stil}>
            <Txt x={14} y={y + 5} anchor="start" size={0.76} weight={650}>
              {`stil="${stil}"`}
            </Txt>
            <Stromlinjer stil={stil} farge={i === 0 ? GEO.avrenning : VIZ.velocity} punkter={punkter} bredde={stil === 'baand' ? 12 : stil === 'front' ? 30 : undefined} t={1.2} />
          </g>
        );
      })}
    </g>
  );
}

function Mantel({ f }: { f: number }) {
  const H = geoHoyde(f, 260);
  const celle = (cx: number, retning: 1 | -1) => {
    const rx = 150;
    const ry = (H - 80) / 2 - 10;
    const cy = 40 + (H - 80) / 2;
    const pkt = Array.from({ length: 12 }, (_, i) => {
      const a = (retning * i * 2 * Math.PI) / 12;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
    });
    return pkt;
  };
  return (
    <g>
      <rect x={20} y={30} width={760} height={H - 60} rx={10} fill={GEO.astenosfare.fill} stroke={GEO.astenosfare.line} strokeWidth={1.2} />
      <Stromlinjer stil="linje" farge={VIZ.velocity} lukket bredde={3} t={0} linjer={[{ punkter: celle(225, -1) }, { punkter: celle(575, 1) }]} />
      <Txt x={400} y={24} size={0.74} muted>
        Lukket sløyfe (lukket): konveksjonsceller
      </Txt>
    </g>
  );
}

function Isstrom({ f }: { f: number }) {
  const H = geoHoyde(f, 240);
  const bunn = (x: number) => H - 30 - 30 * Math.sin((x / 800) * Math.PI) - (x / 800) * 60;
  const topp = (x: number) => 60 + (x / 800) * 90 + 10 * Math.sin(x / 90);
  const xs = Array.from({ length: 21 }, (_, i) => (i * 800) / 20);
  const linjer = [0.2, 0.45, 0.7, 0.9].map((t) => ({
    punkter: xs.slice(1, 19).map((x) => [x, topp(x) + t * (bunn(x) - topp(x))] as const),
    bredde: 1.4 + 2.2 * (1 - t),
  }));
  return (
    <g>
      <path
        d={`M0 ${r2(topp(0))}${xs.map((x) => `L${r2(x)} ${r2(topp(x))}`).join('')}L800 ${r2(bunn(800))}${[...xs].reverse().map((x) => `L${r2(x)} ${r2(bunn(x))}`).join('')}Z`}
        fill={GEO.bre.fill}
        stroke={GEO.bre.line}
        strokeWidth={1.4}
      />
      <Stromlinjer stil="linje" farge={VIZ.velocity} linjer={linjer} avstand={150} t={2} />
      <Txt x={400} y={24} size={0.74} muted>
        Isstrøm: raskest øverst (tykkere linje)
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Bygninger */

/** Byggene i rader i samme skala: fyller radene fra venstre, med plass til navnet under hvert bygg. */
function byggRader(f: number): { p: number; rader: { type: BygningType; x: number }[][]; hoyder: number[]; total: number } {
  const p = 4.4;
  const rekkefolge: BygningType[] = ['garasje', 'hytte', 'bolig', 'fjos', 'vannverk', 'beredskap', 'boligblokk', 'skole', 'sykehjem', 'anrikningsverk'];
  const rader: { type: BygningType; x: number }[][] = [[]];
  let x = 40 * f;
  for (const t of rekkefolge) {
    const st = bygningStorrelse(t, p);
    const navn = BYGNING_MAAL[t].navn.length * 0.58 * 17 * 0.66 * f;
    const bredde = Math.max(st.hoyre - st.venstre, navn) + 16 * f;
    if (x + bredde > 796 && rader[rader.length - 1]!.length > 0) {
      rader.push([]);
      x = 8;
    }
    const sentrum = x + (bredde - (st.hoyre - st.venstre)) / 2 - st.venstre;
    rader[rader.length - 1]!.push({ type: t, x: sentrum });
    x += bredde;
  }
  const hoyder = rader.map((r) => Math.max(...r.map((e) => BYGNING_MAAL[e.type].hoyde)) * p + 48 * f);
  return { p, rader, hoyder, total: hoyder.reduce((a, b) => a + b, 0) + 16 };
}

function AlleBygg({ f }: { f: number }) {
  const { p, rader, hoyder } = byggRader(f);
  let y = 8;
  return (
    <g>
      {rader.map((rad, ri) => {
        const bakke = y + hoyder[ri]! - 34 * f;
        y += hoyder[ri]!;
        return (
          <g key={ri}>
            <line x1={0} x2={800} y1={bakke} y2={bakke} stroke="var(--sc-soil-dark)" strokeWidth={1.5} />
            {ri === 0 && <Person x={18 * f} y={bakke} size={1.75 * p} />}
            {ri === 0 && (
              <Txt x={18 * f} y={bakke + 16 * f} size={0.6} muted>
                1,75 m
              </Txt>
            )}
            {rad.map(({ type: t, x: cx }) => (
              <g key={t}>
                <Bygning x={cx} y={bakke} type={t} pxPerM={p} />
                <Txt x={cx} y={bakke + 16 * f} size={0.66} weight={600}>
                  {BYGNING_MAAL[t].navn}
                </Txt>
                <Txt x={cx} y={bakke + 29 * f} size={0.56} muted>
                  {`${fmt(BYGNING_MAAL[t].hoyde, 0)} m høy`}
                </Txt>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Varianter({ f }: { f: number }) {
  const p = 8;
  const bakke = 104 + 30 * (f - 1);
  const ting: { x: number; el: (x: number) => ReactNode; tekst: string }[] = [
    { x: 52, el: (x) => <Bygning x={x} y={bakke} type="bolig" pxPerM={p} farge="rod" />, tekst: 'rod' },
    { x: 152, el: (x) => <Bygning x={x} y={bakke} type="bolig" pxPerM={p} farge="hvit" sno />, tekst: 'hvit, sno' },
    { x: 236, el: (x) => <Bygning x={x} y={bakke} type="garasje" pxPerM={p} farge="graa" />, tekst: 'garasje' },
    { x: 322, el: (x) => <Bygning x={x} y={bakke} type="hytte" pxPerM={p} sno />, tekst: 'hytte, sno' },
    { x: 510, el: (x) => <Bygning x={x} y={bakke} type="vannverk" pxPerM={p * 0.75} skilt="Vannverk" />, tekst: 'skilt="Vannverk"' },
    { x: 720, el: (x) => <Bygning x={x} y={bakke} type="bolig" pxPerM={p} flip dim />, tekst: 'flip, dim' },
  ];
  return (
    <g>
      <line x1={0} x2={800} y1={bakke} y2={bakke} stroke="var(--sc-soil-dark)" strokeWidth={1.5} />
      {ting.map((t) => (
        <g key={t.tekst}>
          {t.el(t.x)}
          <Txt x={t.x} y={bakke + 18 * f} size={0.62} muted>
            {t.tekst}
          </Txt>
        </g>
      ))}
    </g>
  );
}

function Bygd({ f }: { f: number }) {
  const H = geoHoyde(f, 230);
  const bakke = (x: number) => H - 60 - 40 * Math.exp(-(((x - 160) / 140) ** 2)) + 10 * Math.sin(x / 70);
  const punkter = Array.from({ length: 41 }, (_, i) => [i * 20, bakke(i * 20)] as const);
  const p = 1.3;
  const hus: { x: number; type: BygningType; farge?: 'rod' | 'hvit' | 'gul' }[] = [
    { x: 90, type: 'hytte' },
    { x: 200, type: 'bolig', farge: 'hvit' },
    { x: 240, type: 'bolig', farge: 'rod' },
    { x: 330, type: 'fjos' },
    { x: 440, type: 'skole' },
    { x: 540, type: 'bolig' },
    { x: 620, type: 'sykehjem' },
    { x: 720, type: 'garasje' },
  ];
  return (
    <g>
      <Himmel w={800} h={H} sol={{ x: 700, y: 50 }} skyer={2} />
      <Landskap x={0} y={H - 90} w={800} h={110} type="fjell" />
      <Terreng points={punkter} bottom={H} type="gress" glatt />
      {hus.map((h, i) => (
        <Bygning key={i} x={h.x} y={bakke(h.x) + 1} type={h.type} pxPerM={p} farge={h.farge} />
      ))}
      <Txt x={14} y={H - 14} anchor="start" size={0.7}>
        pxPerM 1,3: detaljene forsvinner, formene står igjen
      </Txt>
    </g>
  );
}

/* ---------------------------------------------------------------- Plattformer */

function Plattformer({ f }: { f: number }) {
  const H = geoHoyde(f, 440);
  const dybde = 70;
  const { dx } = snittblokkPerspektiv(dybde);
  const top = 150;
  const w = 800 - 16 - dx;
  const h = H - top - 16;
  const havbunn = 0.2 * h;
  const kuppel = (y0: number) => lagflate(y0, { kuppel: { hoyde: 0.12 * h, bredde: 0.5 * w }, midt: 0.55 * w });
  const lag: SnittLag[] = [
    { type: 'kalkstein', topp: kuppel(0.78 * h) },
    { type: 'sandstein', topp: kuppel(0.6 * h), navn: 'Reservoar' },
    { type: 'leirskifer', topp: kuppel(0.5 * h) },
    { type: 'siltstein', topp: 0.36 * h },
    { type: 'leire', topp: havbunn },
  ];
  const typer = [
    { x: 0.2 * w, type: 'stal' as const, size: 0.17 * w, bronner: [{ bunn: 0.62 * h, til: 0.36 * w }], fakkel: true },
    { x: 0.55 * w, type: 'betong' as const, size: 0.16 * w, bronner: [{ bunn: 0.5 * h }, { bunn: 0.54 * h, til: 0.72 * w, knekk: 0.38 * h }] },
    { x: 0.84 * w, type: 'flytende' as const, size: 0.13 * w, bronner: [] },
  ];
  return (
    <Snittblokk
      x={16}
      y={top}
      w={w}
      h={h}
      dybde={dybde}
      lag={lag}
      overflate={havbunn}
      vann={{ niva: 0, type: 'hav' }}
      over={
        <>
          {typer.map((t) => (
            <Plattform key={t.type} x={t.x} y={0} havbunn={havbunn} type={t.type} size={t.size} bronner={t.bronner} fakkel={t.fakkel} />
          ))}
          {typer.map((t) => (
            <Txt key={`t${t.type}`} x={t.x} y={r2(havbunn + 16 * f)} size={0.66} weight={650}>
              {`type="${t.type}"`}
            </Txt>
          ))}
        </>
      }
    />
  );
}

function Co2Injeksjon({ f }: { f: number }) {
  const H = geoHoyde(f, 340);
  const top = 120;
  const w = 768;
  const h = H - top - 12;
  const havbunn = 0.18 * h;
  const lag: SnittLag[] = [
    { type: 'sandstein', topp: lagflate(0.62 * h, { fall: 4 }), navn: 'Lager' },
    { type: 'leirskifer', topp: lagflate(0.48 * h, { fall: 4 }) },
    { type: 'sand', topp: havbunn },
  ];
  const plattform = { x: 0.3 * w, y: 0, havbunn, type: 'stal' as const, size: 150, bronner: [{ bunn: 0.8 * h, til: 0.62 * w, knekk: 0.4 * h }] };
  const pkt = plattformPunkter(plattform);
  const bane = pkt.bronner[0] ?? [];
  return (
    <Snittblokk
      x={16}
      y={top}
      w={w}
      h={h}
      dybde={0}
      lag={lag}
      overflate={havbunn}
      vann={{ niva: 0, type: 'hav' }}
      over={
        <>
          <Plattform {...plattform} />
          <Stromlinjer stil="prikker" farge={GEO.co2.line} punkter={[[pkt.dekk.x + 10, pkt.dekk.y + 30], [pkt.havbunn.x, pkt.havbunn.y], ...bane.slice(1)]} glatt={false} t={0.6} label="CO₂ ned" labelPos={0.2} labelSide="hoyre" />
          <Txt x={r2(0.62 * w + 12)} y={r2(0.8 * h - 8)} anchor="start" size={0.7} color={GEO.co2.line} weight={650}>
            plattformPunkter → Stromlinjer
          </Txt>
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- Galleriet */

export default function GalleriVann() {
  return (
    <GalleryGrid>
      <GalleryItem
        wide
        title="Grunnvannssnitt: nydannelse fra regn, strømning mot innsjøen og etiketter i kolonne"
        note={'lag=[granitt, sand], overflate og speil som funksjoner (speilet står over bakken i dalen → innsjø), etiketter="hoyre", Stromlinjer stil="linje" som barn (klippes til bakken), Bygning, Bronn (løsmasse, tilkobling) og Nedbor med skydekke i over.'}
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 420)}`}
      >
        {(f) => <InnsjoOgRegn f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Grunnvannssnitt: senkningstrakt rundt to brønner som pumper"
        note={'speil={senkningstrakt(grunn, brønn1, brønn2)}, dybde={0} (flatt snitt), etiketter="inne", løsmassebrønner med filter og pumpe, observasjonsbrønn med peilebånd. Den stiplede linja tegner kapittelet selv.'}
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 330)}`}
      >
        {(f) => <Senkningstrakt f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Grunnvannssnitt: borebrønn i fjell og energibrønn"
        note={'Morene over granitt, skrånende speil. Bronn type="fjell" (foringsrør ned i fjellet, dykkpumpe, ledning til hytta) og type="energi" (kollektorslange med bunnlodd, slanger til huset).'}
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 360)}`}
      >
        {(f) => <FjellOgEnergi f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Bronn: alle typene"
        note="fjell, losmasse, gravd (med sugerør), observasjon (med peilebånd), energi og borehull; ▽ ved vannstanden."
        viewBox={(f) => `0 0 800 ${Math.ceil(6 / (f > 1.3 ? 3 : 6)) * (230 + 40 * (f - 1)) + 8}`}
      >
        {(f) => <AlleBronner f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Nedbor: regn, snø og sludd over et landskap" note="Med bakke stopper dråpene ved terrenget; kraftig regn gir sprut og regnslør under skydekket. Skydekke med himmel gjør solskinnshimmelen grå." viewBox={(f) => `0 0 800 ${(f > 1.3 ? 4 : 2) * (200 + 70 * (f - 1)) + 8}`}>
        {(f) => <NedborScener f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Nedbor: intensitet 0,1, 0,5 og 1" note="Tettheten og lengden på stripene følger intensiteten; regnsløret kommer over 0,35." viewBox={(f) => `0 0 800 ${(f > 1.3 ? 3 : 1) * (190 + 60 * (f - 1)) + 8}`}>
        {(f) => <Intensitet f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Skydekke: tetthet og grått slør" note="Tegn Skydekke rett etter Himmel og før landskapet; med himmel blir hele himmelen overskyet." viewBox={(f) => `0 0 800 ${(f > 1.3 ? 2 : 1) * (150 + 50 * (f - 1)) + 8}`}>
        {(f) => <Skydekker f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Stromlinjer: vannets kretsløp med bredde etter mengden" note="stromBredde(mengde, maks) fra GLOBALE_STROMMER; fargene GEO.fordamping, GEO.nedbor og GEO.avrenning; stiplet linje for vanndamp." viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}>
        {(f) => <Kretslop f={f} />}
      </GalleryItem>
      <GalleryItem title="Stromlinjer: stilene" note="baand, linje, stiplet, prikker og front (t = 1,2 s)." viewBox={(f) => `0 0 800 ${Math.round(40 * f + 5 * (62 + 22 * (f - 1)))}`}>
        {(f) => <Stiler f={f} />}
      </GalleryItem>
      <GalleryItem title="Stromlinjer: mantelkonveksjon" note="lukket: piler langs hele sløyfa, ingen ende." viewBox={(f) => `0 0 800 ${geoHoyde(f, 260)}`}>
        {(f) => <Mantel f={f} />}
      </GalleryItem>
      <GalleryItem title="Stromlinjer: isstrøm i en bre" note="Tykkere linjer der isen går raskest." viewBox={(f) => `0 0 800 ${geoHoyde(f, 240)}`}>
        {(f) => <Isstrom f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Bygning: alle typene i samme skala (4,4 px per m) med en person på 1,75 m" note="Typene dekker byggtypene i risiko.ts (garasje, hytte, bolig, boligblokk, skole, sykehjem, beredskap) pluss fjøs, vannverk og anrikningsverk." viewBox={(f) => `0 0 800 ${Math.round(byggRader(f).total)}`}>
        {(f) => <AlleBygg f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Bygning: farger, snø, skilt, flip og dim" note="8 px per m (vannverket 6)." viewBox={(f) => `0 0 800 ${Math.round(130 + 50 * (f - 1))}`}>
        {(f) => <Varianter f={f} />}
      </GalleryItem>
      <GalleryItem title="Bygning: liten skala i et landskap" viewBox={(f) => `0 0 800 ${geoHoyde(f, 230)}`}>
        {(f) => <Bygd f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Plattform: stål, betong og flytende over et reservoar" note={'Snittblokk med vann type="hav" og en kuppelfelle; brønner rett ned og avviksbrønner (til, knekk). Delene under vann er halvgjennomsiktige.'} viewBox={(f) => `0 0 800 ${geoHoyde(f, 440)}`}>
        {(f) => <Plattformer f={f} />}
      </GalleryItem>
      <GalleryItem wide title="Plattform: CO₂-injeksjon langs brønnbanen" note="plattformPunkter gir brønnbanen; Stromlinjer stil=&quot;prikker&quot; i GEO.co2.line viser CO₂ på vei ned." viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}>
        {(f) => <Co2Injeksjon f={f} />}
      </GalleryItem>
    </GalleryGrid>
  );
}
