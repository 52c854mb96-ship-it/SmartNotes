/**
 * Galleri for diagrammene og kartene i geofag-kit-et (?galleri=geo-kart): LogPlot (log–log, semilog, høyreakse,
 * tierpotenser og egne akseverdier), Klimadiagram (grått og farget med markert måned), GeoTidslinje (vannrett med
 * flagg, loddrett, zoom med Zoomtrakt og nummererte merker, logaritmisk og i tusen år), Kotekart (fjordlandskap,
 * nedbørfelt, faresoner på dempet grunnkart og et rent kotekart), høydelagene og Profildiagram (med og uten overhøyde).
 * Tallene er tenkte eller omtrentlige.
 */
import { useMemo } from 'react';
import { VIZ } from '../../../kit/colors';
import { Txt } from '../../../kit/txt';
import { fmt } from '../../../kit/format';
import { linePath } from '../../../kit/svg';
import { alpha } from '../../../kit/scene/core';
import { GEO } from '../colors';
import { geoHoyde, useGeoScale, useGeoStroke } from '../felles';
import { GeoTidslinje, Klimadiagram, LogPlot, Zoomtrakt, tidslinjeGeometri, type TidsHendelse } from '../diagram';
import { Kotekart, Profildiagram, hoydelagFor, ekvidistanseFor } from '../kotekart';
import { helning, hoydefelt, type Hoydefelt } from '../kart';
import { GEO_HENDELSER, periodeVed } from '../geotid';
import { HJULSTROM_D, KORNKLASSER, avsetningsfart, erosjonsfart, lognormalKurve } from '../kornstorrelse';
import { GalleryGrid, GalleryItem } from './felles';

/* ---------------------------------------------------------------- LogPlot */

function logRekke(a: number, b: number, n: number): number[] {
  const la = Math.log10(a);
  const lb = Math.log10(b);
  return Array.from({ length: n + 1 }, (_, i) => 10 ** (la + ((lb - la) * i) / n));
}

function Hjulstrom({ f }: { f: number }) {
  const ss = useGeoStroke();
  const H = geoHoyde(f, 420);
  const ds = logRekke(HJULSTROM_D[0], HJULSTROM_D[1], 120);
  const ero = ds.map((d) => [d, erosjonsfart(d) ?? NaN] as [number, number]);
  const avs = ds.map((d) => [d, avsetningsfart(d) ?? NaN] as [number, number]);
  return (
    <LogPlot
      width={800}
      height={H}
      clip
      x={{ min: 0.001, max: 1000, log: true, label: 'Kornstørrelse (mm)' }}
      y={{ min: 0.001, max: 10, log: true, label: 'Fart (m/s)' }}
    >
      {({ sx, sy, x0, x1, y0, y1 }) => {
        const over = `${linePath(ero, sx, sy)}L${x1},${y1}L${x0},${y1}Z`;
        const under = `${linePath(avs, sx, sy)}L${x1},${y0}L${x0},${y0}Z`;
        return (
          <g>
            <path d={over} fill={alpha(GEO.erosjon, 0.1)} />
            <path d={under} fill={alpha(GEO.avsetning, 0.12)} />
            {KORNKLASSER.slice(1, 4).map((kk) => (
              <line key={kk.id} x1={sx(kk.min)} x2={sx(kk.min)} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeDasharray="4 4" />
            ))}
            {KORNKLASSER.slice(0, 5).map((kk) => (
              <Txt key={kk.id} x={Math.max(x0 + 22 * f, sx(Math.sqrt(Math.max(kk.min, 0.001) * (kk.max ?? 1000))))} y={y1 + 20 * f} size={0.7} muted>
                {kk.navn.charAt(0).toUpperCase() + kk.navn.slice(1)}
              </Txt>
            ))}
            <path d={linePath(ero, sx, sy)} fill="none" stroke={GEO.erosjon} strokeWidth={3 * ss} />
            <path d={linePath(avs, sx, sy)} fill="none" stroke={GEO.avsetning} strokeWidth={3 * ss} />
            <Txt x={sx(0.004)} y={sy(3)} size={0.95} weight={700} color={GEO.erosjon}>
              Erosjon
            </Txt>
            <Txt x={sx(3)} y={sy(0.12)} size={0.95} weight={700}>
              Transport
            </Txt>
            <Txt x={sx(0.03)} y={sy(0.003)} size={0.95} weight={700} color={GEO.avsetning}>
              Avsetning
            </Txt>
          </g>
        );
      }}
    </LogPlot>
  );
}

function Kornkurve({ f }: { f: number }) {
  const ss = useGeoStroke();
  const k = useGeoScale();
  const H = geoHoyde(f, 340);
  const ds = logRekke(0.001, 100, 100);
  const a = lognormalKurve(0.25, 0.5, ds) ?? [];
  const b = lognormalKurve(1.5, 2.2, ds) ?? [];
  return (
    <LogPlot width={800} height={H} x={{ min: 0.001, max: 100, log: true, label: 'Kornstørrelse (mm)' }} y={{ min: 0, max: 100, label: 'Gjennomgang (%)' }}>
      {({ sx, sy, y0, y1 }) => (
        <g>
          {KORNKLASSER.slice(0, 4).map((kk, i) => (
            <g key={kk.id}>
              <rect
                x={sx(Math.max(kk.min, 0.001))}
                y={y1}
                width={sx(Math.min(kk.max ?? 100, 100)) - sx(Math.max(kk.min, 0.001))}
                height={y0 - y1}
                fill={alpha(VIZ.muted, i % 2 ? 0.1 : 0.04)}
              />
              <Txt x={(sx(Math.max(kk.min, 0.001)) + sx(Math.min(kk.max ?? 100, 100))) / 2} y={y0 - 10} size={0.72} muted>
                {kk.navn.charAt(0).toUpperCase() + kk.navn.slice(1)}
              </Txt>
            </g>
          ))}
          <path d={linePath(a.map((p) => [p.d, p.gjennomgang]), sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3 * ss} />
          <path d={linePath(b.map((p) => [p.d, p.gjennomgang]), sx, sy)} fill="none" stroke={VIZ.series[3]} strokeWidth={3 * ss} />
          <circle cx={sx(0.25)} cy={sy(50)} r={5 * k} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={1.5} />
          <Txt x={sx(0.25) - 10} y={sy(50) - 10} anchor="end" size={0.78} color={VIZ.series[0]}>
            Godt sortert sand
          </Txt>
          <Txt x={sx(4) + 8} y={sy(62)} anchor="start" size={0.78} color={VIZ.series[3]}>
            Dårlig sortert morene
          </Txt>
        </g>
      )}
    </LogPlot>
  );
}

function Viskositet({ f }: { f: number }) {
  const ss = useGeoStroke();
  const H = geoHoyde(f, 340);
  const si = Array.from({ length: 31 }, (_, i) => 45 + i);
  const eta = si.map((s) => [s, 10 ** (2 + (s - 45) * 0.22)] as [number, number]);
  const temp = si.map((s) => [s, 1200 - (s - 45) * 13] as [number, number]);
  return (
    <LogPlot
      width={800}
      height={H}
      x={{ min: 45, max: 75, label: 'SiO₂ i magmaen (%)' }}
      y={{ min: 10, max: 1e9, log: true, label: 'Viskositet (Pa·s)', color: VIZ.series[0] }}
      y2={{ min: 700, max: 1250, label: 'Temperatur (°C)', color: GEO.fare[3] }}
    >
      {({ sx, sy, sy2 }) => (
        <g>
          <path d={linePath(eta, sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3 * ss} />
          <path d={linePath(temp, sx, sy2)} fill="none" stroke={GEO.fare[3]} strokeWidth={3 * ss} strokeDasharray="9 6" />
          <Txt x={sx(54) - 8} y={sy(10 ** 4.6)} anchor="end" size={0.8} color={VIZ.series[0]}>
            Basalt: tyntflytende
          </Txt>
          <Txt x={sx(69)} y={sy(10 ** 7.4) + 30 * f} anchor="start" size={0.8} color={VIZ.series[0]}>
            Ryolitt: seig
          </Txt>
        </g>
      )}
    </LogPlot>
  );
}

const VEI = [
  { vei: 0, lo: 1e3, hi: 1e4 },
  { vei: 1, lo: 1e4, hi: 1e6 },
  { vei: 2, lo: 1e6, hi: 1e7 },
  { vei: 3, lo: 1e7, hi: 1e8 },
  { vei: 4, lo: 1e8, hi: 1e9 },
  { vei: 5, lo: 1e9, hi: 1e10 },
  { vei: 6, lo: 1e10, hi: 1e11 },
  { vei: 7, lo: 1e11, hi: 1e12 },
  { vei: 8, lo: 1e12, hi: 1e13 },
];

function VeiStolper({ f }: { f: number }) {
  const ss = useGeoStroke();
  const H = geoHoyde(f, 320);
  return (
    <LogPlot
      width={800}
      height={H}
      x={{ min: -0.6, max: 8.6, ticks: [0, 1, 2, 3, 4, 5, 6, 7, 8], label: 'VEI (vulkanutbruddsindeks)', grid: false }}
      y={{ min: 1e3, max: 1e13, log: true, form: 'potens', label: 'Tefra (m³)' }}
    >
      {({ sx, sy, y0 }) => (
        <g>
          {VEI.map((v) => (
            <rect
              key={v.vei}
              x={sx(v.vei) - 26}
              y={sy(v.hi)}
              width={52}
              height={y0 - sy(v.hi)}
              fill={alpha(GEO.aske.fill, 0.9)}
              stroke={GEO.aske.line}
              strokeWidth={1.3 * ss}
            />
          ))}
          <line x1={sx(-0.5)} x2={sx(8.5)} y1={sy(1e9)} y2={sy(1e9)} stroke={VIZ.ink} strokeDasharray="6 5" strokeWidth={1.3 * ss} />
          <Txt x={sx(0)} y={sy(1e9) - 8} anchor="start" size={0.74}>
            1 km³ = 10⁹ m³
          </Txt>
        </g>
      )}
    </LogPlot>
  );
}

function Flomfrekvens({ f }: { f: number }) {
  const ss = useGeoStroke();
  const k = useGeoScale();
  const H = geoHoyde(f, 320);
  const u = 120;
  const b = 35;
  const Q = (T: number) => u + b * -Math.log(-Math.log(1 - 1 / T));
  const linje = logRekke(1.01, 1000, 80).map((T) => [T, Q(T)] as [number, number]);
  const obs = [1.1, 1.4, 1.9, 2.6, 3.4, 4.5, 6.3, 9, 14, 24, 45].map((T, i) => [T, Q(T) + (i % 3 === 0 ? 9 : i % 3 === 1 ? -7 : 3)] as [number, number]);
  return (
    <LogPlot
      width={800}
      height={H}
      x={{ min: 1, max: 1000, log: true, ticks: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], label: 'Gjentaksintervall (år)' }}
      y={{ min: 0, max: 450, label: 'Vannføring (m³/s)' }}
    >
      {({ sx, sy, y1 }) => (
        <g>
          <path d={linePath(linje, sx, sy)} fill="none" stroke={VIZ.series[0]} strokeWidth={3 * ss} />
          {obs.map(([T, q], i) => (
            <circle key={i} cx={sx(T)} cy={sy(q)} r={4.5 * k} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.8 * ss} />
          ))}
          <line x1={sx(200)} x2={sx(200)} y1={sy(Q(200))} y2={y1} stroke={GEO.fare[3]} strokeWidth={1.6 * ss} strokeDasharray="5 4" />
          <Txt x={sx(200) - 6} y={y1 + 16 * f} anchor="end" size={0.74} color={GEO.fare[3]}>
            {`200-årsflom ≈ ${fmt(Q(200), 0)} m³/s`}
          </Txt>
        </g>
      )}
    </LogPlot>
  );
}

/* ---------------------------------------------------------------- Klimadiagram */

// Tenkte stasjoner med tall i et vanlig norsk leie (ikke målinger).
const KYST_T = [2.1, 2.0, 3.4, 6.0, 9.6, 12.4, 14.5, 14.6, 11.9, 8.8, 5.2, 2.8];
const KYST_P = [210, 160, 175, 110, 95, 115, 135, 175, 245, 250, 245, 230];
const INNLAND_T = [-11.2, -10.1, -6.0, -0.8, 5.6, 10.1, 12.4, 11.1, 6.5, 0.9, -5.3, -9.4];
const INNLAND_P = [35, 28, 26, 30, 45, 65, 85, 75, 55, 45, 38, 36];

/* ---------------------------------------------------------------- Tidslinjer */

const UTVALG: TidsHendelse[] = GEO_HENDELSER.filter((h) =>
  ['Jorda og solsystemet dannes', 'Eldste sikre spor av liv (stromatolitter)', 'Oksygen hoper seg opp i atmosfæren', 'Den kaledonske fjellkjeden dannes', 'Den største masseutdøingen (slutten av perm)', 'Masseutdøing: dinosaurene (unntatt fuglene) dør ut'].includes(h.tekst),
);

function TidslinjeFull({ f }: { f: number }) {
  const alder = 150;
  const loddrett = f > 1.3;
  return loddrett ? (
    <GeoTidslinje x={6} y={20} width={788} height={geoHoyde(f, 300) + 420 - 40} retning="loddrett" hendelser={UTVALG} markor={alder} markert={periodeVed(alder)?.id ?? null} />
  ) : (
    <GeoTidslinje x={20} y={8} width={760} height={geoHoyde(f, 300) - 16} hendelser={UTVALG} markor={alder} markert={periodeVed(alder)?.id ?? null} />
  );
}

const FANEROZOISKE: TidsHendelse[] = GEO_HENDELSER.filter((h) => h.alder <= 540 && h.alder > 1).map((h) => ({ ...h, farge: h.norsk ? GEO.vannskille : undefined }));

/** Den nummererte listen trenger mer plass på mobil. */
const zoomHoyde = (f: number) => geoHoyde(f, 420) + (f > 1.3 ? 320 : 0);

function TidslinjeZoom({ f }: { f: number }) {
  const topp = { x: 20, y: 8, width: 760, height: 46 * f + 52 * f, niva: ['eon'] as const, samlePrekambrium: true, akse: true, utsnitt: { fra: 538.8, til: 0 } };
  const gTopp = tidslinjeGeometri({ ...topp, niva: ['eon'] }, f);
  const y2 = topp.y + topp.height + 40 * f;
  const bunn = { x: 20, y: y2, width: 760, height: zoomHoyde(f) - y2 - 6, fra: 538.8, til: 0, niva: ['era', 'periode'] as const, hendelser: FANEROZOISKE };
  const gBunn = tidslinjeGeometri({ ...bunn, niva: ['era', 'periode'] }, f);
  const a = gTopp.s(538.8);
  const b = gTopp.s(0);
  return (
    <g>
      <GeoTidslinje {...topp} niva={['eon']} />
      <Zoomtrakt
        fra={[
          [a, gTopp.akseLinje + 30 * f],
          [b, gTopp.akseLinje + 30 * f],
        ]}
        til={[
          [gBunn.p0, gBunn.hendelser.q0],
          [gBunn.p1, gBunn.hendelser.q0],
        ]}
      />
      <GeoTidslinje {...bunn} niva={['era', 'periode']} />
    </g>
  );
}

function TidslinjeKenozoikum({ f }: { f: number }) {
  const hendelser: TidsHendelse[] = [
    { alder: 66, tekst: 'Dinosaurene (unntatt fuglene) dør ut' },
    { alder: 55, tekst: 'Nord-Atlanteren åpner seg', farge: GEO.vannskille },
    { alder: 34, tekst: 'Is på Antarktis' },
    { alder: 2.58, tekst: 'Istidene begynner' },
  ];
  return <GeoTidslinje x={8} y={18} width={504} height={geoHoyde(f, 560) - 36} retning="loddrett" fra={66} til={0} niva={['periode', 'epoke']} hendelser={hendelser} />;
}

function TidslinjeLog({ f }: { f: number }) {
  const hendelser: TidsHendelse[] = [
    { alder: 0.0117, tekst: 'Holocen' },
    { alder: 0.02, tekst: 'Siste istids maksimum' },
    { alder: 0.3, tekst: 'Moderne mennesker' },
    { alder: 66, tekst: 'Dinosaurene dør ut' },
    { alder: 2400, tekst: 'Oksygen i lufta' },
  ];
  return (
    <GeoTidslinje
      x={20}
      y={8}
      width={760}
      height={geoHoyde(f, 260) - 16}
      skala="log"
      fra={4567}
      til={0.001}
      niva={['eon', 'periode', 'epoke']}
      hendelser={hendelser}
      markor={0.0117}
      markorTekst=""
    />
  );
}

function TidslinjeTusen({ f }: { f: number }) {
  const hendelser: TidsHendelse[] = GEO_HENDELSER.filter((h) => h.alder <= 0.03).map((h) => ({ ...h, tekst: h.omtrent ? `${h.tekst} (omtrent)` : h.tekst }));
  return (
    <GeoTidslinje
      x={20}
      y={8}
      width={760}
      height={geoHoyde(f, 220) - 16}
      fra={0.03}
      til={0}
      niva={['periode', 'epoke']}
      hendelser={hendelser}
      markor={0.0108}
      markorTekst="Isen har smeltet bort fra kysten (tenkt sted)"
    />
  );
}

/* ---------------------------------------------------------------- Kart */

function useFjord(): Hoydefelt {
  return useMemo(
    () =>
      hoydefelt(
        11,
        [
          { type: 'plan', z0: 50, helningX: 0.13, helningY: 0 },
          {
            type: 'dal',
            punkter: [
              [-200, 820],
              [700, 800],
              [1400, 780],
              [1900, 740],
              [2600, 560],
            ],
            dybde: 230,
            bredde: 560,
            form: 'U',
          },
          { type: 'topp', x: 1900, y: 260, hoyde: 560, radius: 680 },
          { type: 'topp', x: 650, y: 280, hoyde: 420, radius: 520 },
          { type: 'topp', x: 1500, y: 1380, hoyde: 250, radius: 560 },
          { type: 'kjegle', x: 450, y: 1360, hoyde: 230, radius: 420 },
          { type: 'senkning', x: 2050, y: 1330, dybde: 70, radius: 260 },
        ],
        { bredde: 2400, lengde: 1600, celle: 20, ujevnhet: 14, bolgelengde: 300 },
      )!,
    [],
  );
}

function useNedborfelt(): Hoydefelt {
  return useMemo(
    () =>
      hoydefelt(
        4,
        [
          { type: 'plan', z0: 320, helningX: 0, helningY: -0.12 },
          {
            type: 'dal',
            punkter: [
              [900, -50],
              [950, 500],
              [1000, 900],
              [1050, 1450],
            ],
            dybde: 120,
            bredde: 700,
            form: 'V',
          },
          {
            type: 'dal',
            punkter: [
              [1850, 80],
              [1400, 600],
              [1000, 900],
            ],
            dybde: 90,
            bredde: 520,
            form: 'V',
          },
          {
            type: 'rygg',
            punkter: [
              [150, -50],
              [320, 700],
              [220, 1450],
            ],
            hoyde: 150,
            bredde: 620,
          },
          {
            type: 'rygg',
            punkter: [
              [2050, 600],
              [1750, 1450],
            ],
            hoyde: 120,
            bredde: 520,
          },
          { type: 'topp', x: 480, y: 280, hoyde: 180, radius: 450 },
        ],
        { bredde: 2000, lengde: 1400, celle: 20, ujevnhet: 10, bolgelengde: 300 },
      )!,
    [],
  );
}

function useFarekart(): Hoydefelt {
  return useMemo(
    () =>
      hoydefelt(
        8,
        [
          { type: 'plan', z0: 20, helningX: -0.004, helningY: 0 },
          { type: 'topp', x: 700, y: -150, hoyde: 270, radius: 750 },
          { type: 'topp', x: 1600, y: -100, hoyde: 220, radius: 700 },
          {
            type: 'dal',
            punkter: [
              [-50, 1150],
              [700, 1080],
              [1300, 1180],
              [2050, 1100],
            ],
            dybde: 6,
            bredde: 260,
            form: 'U',
          },
          { type: 'topp', x: 1650, y: 1450, hoyde: 60, radius: 420 },
        ],
        { bredde: 2000, lengde: 1400, celle: 20, ujevnhet: 2, bolgelengde: 260 },
      )!,
    [],
  );
}

function useEnkelt(): Hoydefelt {
  return useMemo(
    () =>
      hoydefelt(
        2,
        [
          { type: 'plan', z0: 120, helningX: 0.02, helningY: 0 },
          { type: 'kjegle', x: 520, y: 520, hoyde: 180, radius: 480 },
          { type: 'topp', x: 1180, y: 700, hoyde: 120, radius: 420 },
          { type: 'senkning', x: 900, y: 1000, dybde: 25, radius: 200 },
        ],
        { bredde: 1600, lengde: 1200, celle: 20, ujevnhet: 4, bolgelengde: 260 },
      )!,
    [],
  );
}

const FJORD_PROFIL = { A: [1000, 110] as const, B: [1150, 1540] as const };

function Fjordkart() {
  const felt = useFjord();
  return (
    <Kotekart
      felt={felt}
      width={800}
      hav={0}
      innsjoer={[{ punkt: [2050, 1330], niva: 400, navn: 'Storvatnet' }]}
      elver={[{ fra: [2300, 660], navn: 'Dalelva' }, { fra: [1180, 330] }, { fra: [2050, 1330] }]}
      merker={[
        { p: [1900, 260], symbol: 'topp', navn: 'Høgfjellet' },
        { p: [650, 280], symbol: 'topp' },
        { p: [1330, 620], symbol: 'hus' },
        { p: [1380, 590], symbol: 'hus' },
        { p: [1420, 640], symbol: 'hus' },
        { p: [1470, 600], symbol: 'hus' },
      ]}
      profil={{ A: FJORD_PROFIL.A, B: FJORD_PROFIL.B }}
    />
  );
}

function Nedborfeltkart() {
  const felt = useNedborfelt();
  return (
    <Kotekart
      felt={felt}
      width={800}
      elver={[{ fra: [930, 30], navn: 'Storelva' }, { fra: [1800, 140], navn: 'Sidebekken' }]}
      vannskiller={[{ utlop: [1250, 720], navn: 'Nedbørfelt' }]}
    />
  );
}

function Farekart() {
  const felt = useFarekart();
  return (
    <Kotekart
      felt={felt}
      width={800}
      ekvidistanse={10}
      dempet
      elver={[{ fra: [10, 1150], navn: 'Elva' }]}
      soner={[
        { verdi: (x, _y, z) => 18.5 - 0.004 * x - z, farge: GEO.nedbor, navn: 'Flomsone', fyll: 0.22, kant: 'stiplet', etikett: [1000, 1270] },
        {
          verdi: (x, y) => (helning(felt, x, y)?.grader ?? 0) - 25,
          farge: GEO.fare[3]!,
          skravur: true,
          fyll: 0.1,
          navn: 'Bratt (over 25°)',
          etikett: [1150, 300],
        },
      ]}
      merker={[
        { p: [520, 1060], symbol: 'hus' },
        { p: [580, 1010], symbol: 'hus' },
        { p: [1250, 820], symbol: 'hus', navn: 'Skole' },
        { p: [1500, 900], symbol: 'hus' },
      ]}
    />
  );
}

function Enkeltkart() {
  const felt = useEnkelt();
  return (
    <Kotekart
      felt={felt}
      width={800}
      ekvidistanse={10}
      hoydelag={false}
      relieff={false}
      maalestokk={10000}
      kotetallRetning="terreng"
      innsjoer={[{ punkt: [900, 1000], niva: 140 }]}
      merker={[
        { p: [520, 520], symbol: 'topp', navn: 'Varden' },
        { p: [1180, 700], symbol: 'topp' },
        { p: [1350, 1050], symbol: 'bronn', navn: 'Brønn' },
        { p: [1250, 250], symbol: 'kryss', navn: 'P' },
      ]}
      profil={{ A: [150, 520], B: [1500, 700], navn: ['A', 'B'] }}
    />
  );
}

function FjordProfil({ f, overhoyde }: { f: number; overhoyde: number | null }) {
  const felt = useFjord();
  return <Profildiagram felt={felt} A={FJORD_PROFIL.A} B={FJORD_PROFIL.B} hav={0} height={geoHoyde(f, 260)} overhoyde={overhoyde} />;
}

/** Tre ruter per rad på mobil, ellers fem på én rad. */
const lagKolonner = (f: number) => (f > 1.3 ? 3 : 5);
const lagRadH = (f: number) => 40 + 30 * f;

function HoydelagTekst({ f }: { f: number }) {
  const felt = useFjord();
  const lag = hoydelagFor(felt, ekvidistanseFor(felt), 0);
  const kol = lagKolonner(f);
  const cw = 760 / kol;
  return (
    <g>
      {lag.map((l, i) => {
        const x = 20 + (i % kol) * cw;
        const y = 12 + Math.floor(i / kol) * lagRadH(f);
        return (
          <g key={i}>
            <rect x={x} y={y} width={cw - 16} height={26} rx={4} fill={l.farge} stroke={VIZ.muted} strokeWidth={1} />
            <Txt x={x + (cw - 16) / 2} y={y + 30 + 17 * 0.72 * f} size={0.72} muted>
              {i === lag.length - 1 ? `over ${fmt(l.fra, 0)} m` : `${fmt(l.fra, 0)}–${fmt(l.til, 0)} m`}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- Galleriet */

export default function Galleri() {
  return (
    <GalleryGrid>
      <GalleryItem
        wide
        title="LogPlot: log–log (Hjulströms diagram, omtrentlige kurver)"
        note="x og y log: true, clip. Tierpotenser på norsk (0,001 … 1000), svake hjelpelinjer ved 2–9, etikettene tynnes ut på mobil. Høyde geoHoyde(f, 420)."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 420)}`}
      >
        {(f) => <Hjulstrom f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="LogPlot: semilog (kornfordelingskurver fra lognormalKurve)"
        note="x log, y lineær 0–100 %. Kornklassene som bånd bak kurvene."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}
      >
        {(f) => <Kornkurve f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="LogPlot med høyreakse (y2) og farget akse"
        note="y log med color, y2 lineær med color; barna får sy2. Tenkte, omtrentlige kurver."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 340)}`}
      >
        {(f) => <Viskositet f={f} />}
      </GalleryItem>
      <GalleryItem
        title="LogPlot: tierpotenser (form: 'potens')"
        note="VEI-skalaen: hvert trinn er ti ganger mer tefra."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 320)}`}
      >
        {(f) => <VeiStolper f={f} />}
      </GalleryItem>
      <GalleryItem
        title="LogPlot: egne akseverdier (ticks 1, 2, 5 …)"
        note="Flomfrekvens med tenkte målinger og en Gumbel-kurve."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 320)}`}
      >
        {(f) => <Flomfrekvens f={f} />}
      </GalleryItem>
      <GalleryItem
        title="Klimadiagram (grått, som PDF-malen)"
        note="sted og visSnitt; temperaturaksen −10 til 20 °C og nedbøraksen med samme rutenett (klimaAkser). Tenkt kyststasjon."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 320)}`}
      >
        <Klimadiagram temperatur={KYST_T} nedbor={KYST_P} sted="Kyststasjon (tenkt)" visSnitt />
      </GalleryItem>
      <GalleryItem
        title="Klimadiagram (farget, 0 °C-linje, markert januar)"
        note="farget, nullLinje, markert={0}. Tenkt innlandsstasjon."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 320)}`}
      >
        <Klimadiagram temperatur={INNLAND_T} nedbor={INNLAND_P} sted="Innlandsstasjon (tenkt)" farget nullLinje markert={0} />
      </GalleryItem>
      <GalleryItem
        wide
        title="GeoTidslinje: hele jordas historie med hendelser"
        note="niva eon, era og periode; hendelser fra GEO_HENDELSER; markor={150} og markert={periodeVed(150).id}. Loddrett på mobil (retning='loddrett' når f > 1,3)."
        viewBox={(f) => (f > 1.3 ? `0 0 800 ${geoHoyde(f, 300) + 420}` : `0 0 800 ${geoHoyde(f, 300)}`)}
      >
        {(f) => <TidslinjeFull f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="GeoTidslinje: zoom med utsnitt og Zoomtrakt"
        note="Øverst samlePrekambrium og utsnitt fanerozoikum; under fra={538.8} med eraer, perioder og elleve hendelser (norske i lilla). For trangt til flagg, så merkene nummereres med en liste over. tidslinjeGeometri gir punktene til trakten."
        viewBox={(f) => `0 0 800 ${zoomHoyde(f)}`}
      >
        {(f) => <TidslinjeZoom f={f} />}
      </GalleryItem>
      <GalleryItem
        title="GeoTidslinje loddrett (kenozoikum, perioder og epoker)"
        note="retning='loddrett', fra={66}: eldst nederst som ICS-kartet, tekstene til høyre."
        viewBox={(f) => `0 0 520 ${geoHoyde(f, 560)}`}
      >
        {(f) => <TidslinjeKenozoikum f={f} />}
      </GalleryItem>
      <GalleryItem
        title="GeoTidslinje logaritmisk"
        note="skala='log', fra={4567}, til={0.001}: holocen og istida får plass ved siden av milliardene. Aksen skriver «1 mill. år» osv."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 260)}`}
      >
        {(f) => <TidslinjeLog f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="GeoTidslinje: de siste 30 000 årene (tusen år)"
        note="fra={0.03}: enheten blir tusen år siden av seg selv; perioder og epoker, hendelser og en markør med egen tekst."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 220)}`}
      >
        {(f) => <TidslinjeTusen f={f} />}
      </GalleryItem>
      <GalleryItem
        wide
        title="Kotekart: fjordlandskap"
        note="hav={0}, innsjø, elver med flytvei (navnet der elva ikke deler løp med en annen), topper med høyde, hus og profillinje A–B. Høydelag, relieff fra nordvest, tellekoter med lesbare tall som holder seg unna navn og merker, nordpil, målestokk og ekvidistanse."
        viewBox="0 0 800 533.34"
      >
        <Fjordkart />
      </GalleryItem>
      <GalleryItem
        wide
        title="Høydelagene (hoydelagFor, til en tegnforklaring)"
        note="I en visualisering passer Legend (HTML under figuren) best; her som SVG-ruter."
        viewBox={(f) => `0 0 800 ${12 + Math.ceil(5 / lagKolonner(f)) * lagRadH(f)}`}
      >
        {(f) => <HoydelagTekst f={f} />}
      </GalleryItem>
      <GalleryItem
        title="Profildiagram langs A–B (overhøyde 1)"
        note="overhoyde={1}: riktige forhold, så fjellsidene blir slake."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 260)}`}
      >
        {(f) => <FjordProfil f={f} overhoyde={1} />}
      </GalleryItem>
      <GalleryItem
        title="Profildiagram langs A–B (fyller høyden)"
        note="Uten overhoyde fyller profilet høyden, og overhøyden skrives."
        viewBox={(f) => `0 0 800 ${geoHoyde(f, 260)}`}
      >
        {(f) => <FjordProfil f={f} overhoyde={null} />}
      </GalleryItem>
      <GalleryItem title="Kotekart: nedbørfelt" note="vannskiller med utløp og navn: nedbørfeltet til Sidebekken ved utløpsmerket; to elver fra flytvei med navn." viewBox="0 0 800 560">
        <Nedborfeltkart />
      </GalleryItem>
      <GalleryItem
        title="Kotekart: faresoner"
        note="dempet grunnkart; soner med verdi(x, y, z): flomsone under en skrå flomlinje (stiplet) og bratte skråninger over 25° fra helning() (skravur)."
        viewBox="0 0 800 560"
      >
        <Farekart />
      </GalleryItem>
      <GalleryItem
        title="Kotekart: rent kotekart som på en prøve"
        note="hoydelag={false}, relieff={false}, ekvidistanse={10}, maalestokk={10000}, kotetallRetning='terreng' (toppen av tallene peker oppover i terrenget, som på norske kart); merker: topp, brønn og kryss."
        viewBox="0 0 800 600"
      >
        <Enkeltkart />
      </GalleryItem>
    </GalleryGrid>
  );
}
