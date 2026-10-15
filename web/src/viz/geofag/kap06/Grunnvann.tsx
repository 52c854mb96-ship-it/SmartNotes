import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bronn,
  Bygning,
  Controls,
  Explain,
  Figure,
  Flagg,
  FlateForklaring,
  Formula,
  FormulaLine,
  GEO,
  Grunnvannssnitt,
  Kornpakning,
  Lupe,
  PlayBar,
  Readout,
  Readouts,
  SEK_PER_DOGN,
  Segmented,
  Slider,
  Stromlinjer,
  Sub,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  paaToppen,
  reisetidDarcy,
  seededRandom,
  tekstBredde,
  useContainerTextScale,
  useGeoScale,
  useGeoStroke,
  useSimClock,
  useTextScale,
  type GrunnLag,
} from '../kit';
import { Dimension, Gran, Himmel, Landskap } from '../../kit/scene';
import {
  AKER_AVSTAND_M,
  AVSTAND_MAKS_M,
  AVSTAND_MIN_M,
  AVSTAND_STEG_M,
  BRONN_RADIUS_M,
  GRADIENT,
  KRAV_OPPHOLDSTID_DOGN,
  MATERIAL_KNAPP,
  MATERIAL_MONSTER,
  MATERIAL_VALG,
  NITRAT_FORTYNNING,
  NITRAT_GRENSEVERDI,
  NITRAT_UNDER_AKER,
  PUMPERATER_LS,
  PUMPETID_DOGN,
  avstandEtter,
  avstandForReisetid,
  bronnstatus,
  fmtAvstand,
  fmtFart,
  fmtLs,
  fmtVarighet,
  materiale,
  nitratVedBronn,
  reiseTabell,
  reisetidMotBronn,
  smitteIgjen,
  smittebarriere,
  strom,
  strommodell,
  type Bronnstatus,
  type MaterialValg,
  type ReiseTabell,
} from './model-grunnvann';
import {
  BLOKK_DYBDE,
  ELV_X,
  ELV_Z,
  FJOS_X,
  bronnPlass,
  fjellPx,
  forbiSti,
  lagBunnPx,
  merkeSti,
  oppsett,
  overflatePx,
  overhoyde,
  plasser,
  speilPx,
  sprekker,
  stromlinjer,
  sx,
  sy,
  tilstromningHoyre,
  type Oppsett,
} from './grunnvann-scene';
import { AkerFlate, Fartsstige, Kloakkledning, LeirUtsnitt, Matjord, MerkeVei, Merker, PoreStrom, Sigevann, SprekkeUtsnitt, Sprekker, type Merke, type StigeMerke } from './grunnvann-deler';

/** Hvor lenge avspillingen varer (s). Modelltida på klokka strekkes så merkene rekker fram til brønnen. */
const SPILLETID = 12;
/** Fargen på smittestoffet fra kloakken og på nitratet fra åkeren (merker, fane, tekst og streker). */
const SMITTE = GEO.smitte.line;
const NITRAT = GEO.nitrat.line;
/** Hvor mange merker som er på vei samtidig når avspillingen har gått en stund. */
const MERKER_SMITTE = 18;
const MERKER_NITRAT = 22;

const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Alt modellen gir for ett sett med valg. */
export interface Beregning {
  valg: MaterialValg;
  qLs: number;
  L: number;
  nitrat: boolean;
  bronn: Bronnstatus | null;
  pumper: boolean;
  /** Porefarten uten pumping (m/s) og Darcy-hastigheten. */
  v: number | null;
  q: number | null;
  /** Reisetiden (døgn) fra kloakkledningen til brønnen med og uten pumping, og fra åkeren. */
  tSmitte: number | null;
  tSmitteUten: number | null;
  tNitrat: number | null;
  /** Når brønnen ikke pumper: tida (døgn) fra brønnen videre til elva. */
  tForbi: number;
  /** Avstanden (m) til 60-døgnsgrensen, eller null når den er utenfor rekkevidde. */
  x60: number | null;
  tabSmitte: ReiseTabell | null;
  tabNitrat: ReiseTabell | null;
  /** Modelltida (døgn) hele avspillingen dekker. */
  spenn: number;
  nitratVedBronn: number | null;
}

/** Regner ut alt for valget: brønnen, farten, reisetidene, 60-døgnsgrensen og hvor lang avspillingen er. */
export function beregn(valg: MaterialValg, qLs: number, L: number, nitrat: boolean): Beregning {
  const bronn = bronnstatus(valg, qLs);
  const sm = strommodell(valg, bronn);
  const st = strom(valg);
  const m = materiale(valg);
  const pumper = (bronn?.Q ?? 0) > 0;
  const tSmitte = reisetidMotBronn(L, sm);
  const tNitrat = reisetidMotBronn(AKER_AVSTAND_M, sm);
  const tForbi = !pumper && st && st.v > 0 ? (ELV_X - 4) / st.v / SEK_PER_DOGN : 0;
  const totS = tSmitte === null ? 0 : tSmitte + tForbi;
  const totN = tNitrat === null ? 0 : tNitrat + tForbi;
  const spenn = 1.08 * Math.max(totS, nitrat ? totN : 0);
  return {
    valg,
    qLs,
    L,
    nitrat,
    bronn,
    pumper,
    v: st?.v ?? null,
    q: st?.q ?? null,
    tSmitte,
    tSmitteUten: reisetidDarcy(L, GRADIENT, m.K, m.effektivPorositet),
    tNitrat,
    tForbi,
    x60: avstandForReisetid(KRAV_OPPHOLDSTID_DOGN, sm),
    tabSmitte: reiseTabell(L, sm),
    tabNitrat: nitrat ? reiseTabell(AKER_AVSTAND_M, sm) : null,
    spenn: spenn > 0 && Number.isFinite(spenn) ? spenn : 1,
    nitratVedBronn: nitratVedBronn(NITRAT_UNDER_AKER, NITRAT_FORTYNNING),
  };
}

/** Visningsfarten (figurens enheter per sekund) for strømpilene: rask i grus, nesten stille i leire. */
function visningsfart(v: number | null, maks = 60): number {
  if (v === null || !(v > 0)) return 0;
  const lo = Math.log10(2.5e-10);
  const hi = Math.log10(2e-4);
  return 2 + (maks - 2) * clamp((Math.log10(v) - lo) / (hi - lo), 0, 1);
}

const MATERIAL_NAVN: Readonly<Record<MaterialValg, string>> = {
  grus: 'Grus (breelvavsetning)',
  sand: 'Sand',
  silt: 'Silt',
  leire: 'Leire',
  'oppsprukket-fjell': 'Oppsprukket fjell (gneis)',
};

/* =====================================================================================================================
 * Snittet
 * ================================================================================================================== */

interface FigurProps {
  o: Oppsett;
  b: Beregning;
  /** Modelltida (døgn) for merkene. */
  tau: number;
  /** Klokka (s) for strømpilene og sigevannet. */
  t: number;
}

/** Snittet gjennom dalen med himmel, landskap, grunnvann, brønn, kilder og merker. Eksportert for testene. */
export function GrunnvannFigur({ o, b, tau, t }: FigurProps) {
  const k = useGeoScale();
  const { valg, bronn, pumper, L } = b;
  const ov = useMemo(() => overflatePx(o), [o]);
  const sp = useMemo(() => speilPx(o, bronn, GRADIENT), [o, bronn]);
  const fjell = useMemo(() => fjellPx(o, valg), [o, valg]);
  const bunn = useMemo(() => lagBunnPx(o), [o]);
  const plass = useMemo(() => bronnPlass(o, valg), [o, valg]);
  const p = useMemo(() => plasser(o, L), [o, L]);
  const lag = useMemo<GrunnLag[]>(
    () =>
      valg === 'oppsprukket-fjell'
        ? [
            { type: 'gneis', topp: fjell },
            { type: 'morene' },
          ]
        : [
            { type: 'granitt', topp: fjell, tett: true },
            { type: MATERIAL_MONSTER[valg] },
          ],
    [valg, fjell],
  );
  const stiS = useMemo(() => merkeSti(o, sp, plass, L, 9 * o.k, pumper), [o, sp, plass, L, pumper]);
  const stiN = useMemo(() => merkeSti(o, sp, plass, AKER_AVSTAND_M, 24 * o.k, pumper), [o, sp, plass, pumper]);
  const forbi = useMemo(() => forbiSti(o, sp, 9 * o.k), [o, sp]);
  const forbiN = useMemo(() => forbiSti(o, sp, 24 * o.k), [o, sp]);
  const sprekkLinjer = useMemo(() => (valg === 'oppsprukket-fjell' ? sprekker(o) : []), [o, valg]);
  const fart = visningsfart(b.v);

  // Veiene merkene tar (stiplet, så figuren gir mening før avspillingen)
  const veiS = useMemo(() => vei(stiS, pumper ? null : forbi), [stiS, forbi, pumper]);
  const veiN = useMemo(() => vei(stiN, pumper ? null : forbiN), [stiN, forbiN, pumper]);

  const reiseS = useMemo<MerkeReise | null>(
    () => (b.tabSmitte && b.tSmitte !== null ? { tab: b.tabSmitte, tTil: b.tSmitte, tForbi: b.tForbi, L, sti: stiS, forbi: pumper ? null : forbi } : null),
    [b.tabSmitte, b.tSmitte, b.tForbi, L, stiS, forbi, pumper],
  );
  const reiseN = useMemo<MerkeReise | null>(
    () =>
      b.nitrat && b.tabNitrat && b.tNitrat !== null ? { tab: b.tabNitrat, tTil: b.tNitrat, tForbi: b.tForbi, L: AKER_AVSTAND_M, sti: stiN, forbi: pumper ? null : forbiN } : null,
    [b.nitrat, b.tabNitrat, b.tNitrat, b.tForbi, stiN, forbiN, pumper],
  );
  const merkerS = useMemo(() => (reiseS ? merker(reiseS, tau, MERKER_SMITTE, 'smitte', o.k) : []), [reiseS, tau, o.k]);
  const merkerN = useMemo(() => (reiseN ? merker(reiseN, tau, MERKER_NITRAT, 'nitrat', o.k) : []), [reiseN, tau, o.k]);
  const faneS = useMemo(() => (reiseS ? fane(reiseS, tau, 'smitte', o.k) : []), [reiseS, tau, o.k]);
  const faneN = useMemo(() => (reiseN ? fane(reiseN, tau, 'nitrat', o.k) : []), [reiseN, tau, o.k]);

  // 60-døgnsgrensen: en stiplet linje i snittet, eller en pil mot venstre når den ligger utenfor figuren
  const x60px = b.x60 === null ? null : sx(o, -b.x60);
  const grenseInne = x60px !== null && x60px > 6 && plass.x - x60px > o.bronnHalv + 20 * k;
  const grenseUte = b.x60 === null || (x60px !== null && x60px <= 6);

  // Strømlinjene: mot elva, eller inn i brønnen fra venstre når den pumper. Fra elvesida strømmer vannet tilbake til
  // brønnen innenfor vannskillet (stagnasjonspunktet), og forbi det ut i elva.
  const stagnasjon = useMemo(() => tilstromningHoyre(o, bronn, materiale(valg).K, GRADIENT, 20), [o, bronn, valg]);
  const linjer = useMemo(() => stromlinjer(o, sp, pumper ? { inntak: plass.inntak, stagnasjon } : undefined), [o, sp, pumper, plass, stagnasjon]);
  const inn = useMemo(() => {
    if (!pumper || !(stagnasjon > 22 * k)) return [];
    const x0 = plass.x + Math.min(stagnasjon, 120 * k);
    return [
      [
        [x0, plass.inntak + 0.4 * (bunn(x0) - plass.inntak)],
        [plass.x + 0.5 * (x0 - plass.x), plass.inntak + 6 * k],
        [plass.x + o.bronnHalv + 2, plass.inntak + 2 * k],
      ] as (readonly [number, number])[],
    ];
  }, [pumper, stagnasjon, k, plass, bunn, o]);
  /** Nesten stillestående vann (leire) tegnes nedtonet. */
  const stille = (b.v ?? 0) < 1e-8;

  const aker = { fra: p.akerFra, til: p.akerTil };
  // Punkter på toppflaten av blokka (kit-ets paaToppen, i snittets koordinater som i `over`)
  const topp = (x: number, t: number) => paaToppen({ overflate: ov, dx: o.dx, dy: o.dy }, x, t) ?? { x, y: ov(x) };
  const husBakke = topp(p.hus, 0.35);
  const vannverk = topp(p.vannverk, 0.42);
  const fjos = topp(sx(o, FJOS_X), 0.8);
  const granA = topp(sx(o, 104), 0.25);
  const granB = topp(sx(o, 193), 0.55);
  const granC = topp(sx(o, 118), 0.85);
  const ledningLengde = Math.max(6, p.ledningTil - plass.x - o.bronnHalv);

  // Horisonten ligger litt under den laveste bakkanten (ved elva), så landskapet ikke får glipe
  const horisont = o.y0 + sy(o, ELV_Z) - o.dy + 8;
  const smal = o.smal;

  return (
    <g>
      <Himmel w={800} h={horisont + 6} sol={{ x: 744, y: 36 + 22 * (o.f - 1), r: 17 + 6 * (o.f - 1) }} skyer={1} seed={4} />
      <Landskap x={0} y={horisont} w={800} h={Math.min(120, horisont - 56 * o.f)} type="aaser" seed={5} />
      <Grunnvannssnitt
        x={o.x0}
        y={o.y0}
        w={o.w}
        h={o.h}
        dybde={BLOKK_DYBDE}
        overflate={ov}
        speil={sp}
        kapillar={smal ? 16 : 12}
        lag={lag}
        etiketter="inne"
        etikettX={p.etikettX}
        unnga={[plass.x, p.lekk.x, ...(b.nitrat ? [p.aker] : []), ...(grenseInne && x60px !== null ? [x60px] : [])]}
        speilMerke={smal ? undefined : p.etikettX + 4}
        over={
          <>
            <Gran x={r2(granC.x)} y={r2(granC.y)} size={34 * k} seed={3} />
            <Bygning x={r2(fjos.x)} y={r2(fjos.y)} type="fjos" pxPerM={0.8 * o.pxBygg} />
            <AkerFlate fra={aker.fra} til={aker.til} overflate={ov} dx={o.dx} dy={o.dy} />
            <Bygning x={r2(husBakke.x)} y={r2(husBakke.y)} type="bolig" pxPerM={o.pxBygg} farge="hvit" />
            <Bygning x={r2(vannverk.x)} y={r2(vannverk.y)} type="vannverk" pxPerM={o.pxBygg} />
            <Gran x={r2(granB.x)} y={r2(granB.y)} size={38 * k} seed={7} />
            <Bronn
              x={plass.x}
              y={plass.bakke}
              bunn={plass.bunn}
              type={valg === 'oppsprukket-fjell' ? 'fjell' : 'losmasse'}
              vannstand={sp(plass.x)}
              fjell={plass.fjell ?? undefined}
              filter={plass.filter ?? undefined}
              tilkobling="hoyre"
              tilkoblingLengde={ledningLengde}
            />
            <Gran x={r2(granA.x)} y={r2(granA.y)} size={44 * k} seed={2} />
          </>
        }
      >
        <Matjord fra={aker.fra} til={aker.til} overflate={ov} tykkelse={0.5 * o.pz} />
        {sprekkLinjer.length > 0 && <Sprekker linjer={sprekkLinjer} speil={sp} bredde={o.w} hoyde={o.h} />}
        <Stromlinjer stil="linje" farge={VIZ.velocity} t={t} fart={fart} avstand={95} dim={stille} linjer={linjer.map((l) => ({ punkter: l }))} />
        {inn.length > 0 && <Stromlinjer stil="linje" farge={VIZ.velocity} t={t} fart={fart} avstand={60} dim={stille} linjer={inn.map((l) => ({ punkter: l }))} />}
        <LagNavn o={o} valg={valg} bunn={bunn} />
        {grenseInne && x60px !== null && <Grense x={x60px} topp={sp(x60px) + 3} bunn={bunn(x60px) - 3} />}
        {grenseUte && <GrenseUte avstand={b.x60} y={sp(6) + 0.7 * (bunn(6) - sp(6))} />}
        <Kloakkledning x1={p.hus + 6 * o.k} x2={p.lekk.x} y={p.lekk.y} bakke={ov(p.hus + 6 * o.k)} />
        <Sigevann x={p.lekk.x} topp={p.lekk.y + 3 * o.k} speil={sp} farge={SMITTE} t={t} seed={4} />
        {b.nitrat && <Sigevann x={p.aker} topp={ov(p.aker) + 0.5 * o.pz} speil={sp} farge={NITRAT} bredde={0.8 * (p.akerTil - p.akerFra)} n={4} t={t} seed={8} />}
        {b.nitrat && <MerkeVei punkter={veiN} farge={NITRAT} />}
        <MerkeVei punkter={veiS} farge={SMITTE} />
        {b.nitrat && <Fane biter={faneN} farge={NITRAT} />}
        <Fane biter={faneS} farge={SMITTE} />
        {b.nitrat && <Merker merker={merkerN} farge={NITRAT} r={2.4} />}
        <Merker merker={merkerS} farge={SMITTE} r={2.7} />
      </Grunnvannssnitt>
      <g transform={`translate(${r2(o.x0)} ${r2(o.y0)})`}>
        <Avstandsmal fra={p.lekk.x} til={plass.x} y={Math.min(ov(p.lekk.x), ov(plass.x)) - o.dy - 9 * k} L={L} />
      </g>
      <Flagg
        x0={8}
        x1={o.W - 8}
        flagg={[
          { tekst: 'Gjødslet åker', x: o.x0 + p.aker + 0.45 * o.dx, y: o.y0 + ov(p.aker) - 0.45 * o.dy, farge: b.nitrat ? NITRAT : VIZ.ink },
          { tekst: 'Lekk kloakkledning', x: o.x0 + p.lekk.x, y: o.y0 + p.lekk.y - 4 * k, farge: SMITTE },
          { tekst: pumper ? 'Brønn som pumper' : 'Brønn', x: o.x0 + plass.x, y: o.y0 + plass.bakke - 13 * k, farge: VIZ.ink },
        ]}
        basis={Math.min(o.y0 + husBakke.y - 9.3 * o.pxBygg, o.y0 + vannverk.y - 6.8 * o.pxBygg, o.y0 + plass.bakke - 13 * k) - 14 * o.f}
      />
    </g>
  );
}

/** Punktene langs veien til et merke (til brønnen, eller forbi den til elva). */
function vei(sti: (u: number) => { x: number; y: number }, forbi: ((u: number) => { x: number; y: number }) | null): (readonly [number, number])[] {
  const ut: (readonly [number, number])[] = [];
  for (let i = 0; i <= 30; i++) {
    const q = sti(i / 30);
    ut.push([q.x, q.y]);
  }
  if (forbi) {
    for (let i = 1; i <= 16; i++) {
      const q = forbi(i / 16);
      ut.push([q.x, q.y]);
    }
  }
  return ut;
}

/** Veien et merke tar fra kilden: reisetabellen, tidene og stiene i figuren. */
interface MerkeReise {
  tab: ReiseTabell;
  /** Tida (døgn) fra kilden til brønnen. */
  tTil: number;
  /** Tida (døgn) videre fra brønnen til elva når brønnen ikke pumper (ellers 0). */
  tForbi: number;
  L: number;
  sti: (u: number) => { x: number; y: number };
  forbi: ((u: number) => { x: number; y: number }) | null;
}

/** Hvor et merke er etter `alder` døgn, og hvor stor andel av veien det har gått (0–1). Null når det er framme. */
function vedAlder(m: MerkeReise, alder: number): { x: number; y: number; andel: number } | null {
  const total = m.tTil + (m.forbi ? m.tForbi : 0);
  if (!(total > 0) || !(alder >= 0) || alder >= total) return null;
  if (alder < m.tTil) {
    const r = avstandEtter(m.tab, alder);
    const u = m.L > BRONN_RADIUS_M ? (m.L - r) / (m.L - BRONN_RADIUS_M) : 1;
    const p = m.sti(u);
    return { ...p, andel: m.forbi ? (u * m.tTil) / total : u };
  }
  if (!m.forbi) return null;
  const p = m.forbi((alder - m.tTil) / Math.max(1e-9, m.tForbi));
  return { ...p, andel: alder / total };
}

/**
 * Merkene langs veien ved modelltida `tau`: ett merke slippes jevnlig fra kilden, så det til slutt ligger en hel rekke
 * på vei. Smittestoffene dør underveis (færre merker jo eldre de er), nitratet sprer seg og blir blekere.
 */
function merker(m: MerkeReise, tau: number, antall: number, type: 'smitte' | 'nitrat', k: number): Merke[] {
  const total = m.tTil + (m.forbi ? m.tForbi : 0);
  if (!(total > 0) || !(tau > 0)) return [];
  const d = total / antall;
  const ut: Merke[] = [];
  const forste = Math.max(0, Math.ceil((tau - total) / d));
  const siste = Math.floor(tau / d);
  for (let e = forste; e <= siste && ut.length < antall + 2; e++) {
    const alder = tau - e * d;
    const p = vedAlder(m, alder);
    if (!p) continue;
    const rnd = seededRandom(e * 7919 + (type === 'smitte' ? 13 : 71));
    const dod = rnd();
    const jy = rnd() - 0.5;
    const jx = rnd() - 0.5;
    const spredning = type === 'smitte' ? 3 + 9 * Math.sqrt(p.andel) : 5 + 16 * Math.sqrt(p.andel);
    const a = type === 'smitte' ? (smitteIgjen(alder) > dod ? 1 : 0) : 0.95 - 0.45 * p.andel;
    if (a <= 0) continue;
    ut.push({ x: p.x + jx * (4 + 10 * p.andel) * k, y: p.y + jy * spredning * k, a });
  }
  return ut;
}

/**
 * Fanen bak merkene: et bånd fra kilden fram til fronten (der det eldste merket er), bredere jo lenger det har gått.
 * Smittestoffet blekner med alderen (de dør), nitratet holder seg og blir bare litt blekere når det sprer seg.
 */
function fane(m: MerkeReise, tau: number, type: 'smitte' | 'nitrat', k: number): FaneBit[] {
  const total = m.tTil + (m.forbi ? m.tForbi : 0);
  const slutt = Math.min(tau, total * 0.9999);
  if (!(total > 0) || !(slutt > 0)) return [];
  const n = 48;
  const pkt: { x: number; y: number; w: number; a: number }[] = [];
  for (let j = 0; j <= n; j++) {
    const alder = (slutt * j) / n;
    const p = vedAlder(m, alder);
    if (!p) break;
    const w = type === 'smitte' ? (5 + 9 * Math.sqrt(p.andel)) * k : (7 + 18 * Math.sqrt(p.andel)) * k;
    const a = type === 'smitte' ? 0.5 * smitteIgjen(alder) : 0.42 * (1 - 0.5 * p.andel);
    pkt.push({ x: p.x, y: p.y, w, a });
  }
  return baand(pkt);
}

/** Ett stykke av fanen: en firkant langs veien med egen gjennomsiktighet. */
export interface FaneBit {
  d: string;
  a: number;
}

/** Gjør punkter med bredde og gjennomsiktighet om til firkanter som henger sammen uten overlapp (et bånd). */
function baand(pkt: readonly { x: number; y: number; w: number; a: number }[]): FaneBit[] {
  if (pkt.length < 2) return [];
  const kant = pkt.map((p, i) => {
    const a = pkt[Math.max(0, i - 1)]!;
    const b = pkt[Math.min(pkt.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    return { o: [p.x + (nx * p.w) / 2, p.y + (ny * p.w) / 2] as const, u: [p.x - (nx * p.w) / 2, p.y - (ny * p.w) / 2] as const };
  });
  const ut: FaneBit[] = [];
  for (let i = 1; i < pkt.length; i++) {
    const a = kant[i - 1]!;
    const b = kant[i]!;
    const alfa = (pkt[i - 1]!.a + pkt[i]!.a) / 2;
    if (alfa < 0.01) continue;
    ut.push({ d: `M${r2(a.o[0])} ${r2(a.o[1])}L${r2(b.o[0])} ${r2(b.o[1])}L${r2(b.u[0])} ${r2(b.u[1])}L${r2(a.u[0])} ${r2(a.u[1])}Z`, a: alfa });
  }
  return ut;
}

/** Tegner fanen. */
function Fane({ biter, farge }: { biter: readonly FaneBit[]; farge: string }) {
  return (
    <g>
      {biter.map((b, i) => (
        <path key={i} d={b.d} fill={farge} stroke={farge} strokeWidth={0.4} strokeOpacity={r2(b.a)} fillOpacity={r2(b.a)} />
      ))}
    </g>
  );
}

/** Navnet på det vannførende laget og fjellet under, nede til venstre i snittet. */
function LagNavn({ o, valg, bunn }: { o: Oppsett; valg: MaterialValg; bunn: (x: number) => number }) {
  const f = o.f;
  const x = 10;
  const y = bunn(x);
  if (valg === 'oppsprukket-fjell') {
    return (
      <Txt x={x} y={r2(o.h - 12 * f)} anchor="start" size={0.78} weight={650}>
        {MATERIAL_NAVN[valg]}
      </Txt>
    );
  }
  return (
    <g>
      <Txt x={x} y={r2(y - 9 * f)} anchor="start" size={0.78} weight={650}>
        {MATERIAL_NAVN[valg]}
      </Txt>
      <Txt x={x} y={r2(Math.min(o.h - 6 * f, y + 19 * f))} anchor="start" size={0.74} weight={650}>
        Tett fjell
      </Txt>
    </g>
  );
}

/** 60-døgnsgrensen: en stiplet loddrett linje med tekst. */
function Grense({ x, topp, bunn }: { x: number; topp: number; bunn: number }) {
  const s = useGeoStroke();
  const f = useTextScale();
  if (!(bunn - topp > 10)) return null;
  const ty = topp + 0.7 * (bunn - topp);
  // Teksten står til venstre for linja (bort fra brønnen), eller til høyre når den ikke får plass der
  const venstre = x - 6 * f - tekstBredde('60 døgn', 17 * 0.74 * f) > 4;
  return (
    <g>
      <line x1={r2(x)} x2={r2(x)} y1={r2(topp)} y2={r2(bunn)} stroke={VIZ.surface} strokeWidth={4 * s} opacity={0.6} />
      <line x1={r2(x)} x2={r2(x)} y1={r2(topp)} y2={r2(bunn)} stroke={SMITTE} strokeWidth={2 * s} strokeDasharray={`${r2(6 * s)} ${r2(4 * s)}`} />
      <Txt x={r2(venstre ? x - 6 * f : x + 6 * f)} y={r2(ty)} anchor={venstre ? 'end' : 'start'} size={0.74} weight={700} color={SMITTE}>
        60 døgn
      </Txt>
    </g>
  );
}

/** 60-døgnsgrensen ligger utenfor figuren: en pil mot venstre med avstanden. */
function GrenseUte({ avstand, y }: { avstand: number | null; y: number }) {
  const s = useGeoStroke();
  const f = useTextScale();
  const tekst = avstand === null ? '60 døgn: svært langt unna' : `60 døgn: ${fmtAvstand(avstand)} unna`;
  const x = 8;
  return (
    <g>
      <path d={`M${r2(x + 12 * f)} ${r2(y - 5 * f)}L${r2(x)} ${r2(y)}L${r2(x + 12 * f)} ${r2(y + 5 * f)}`} fill="none" stroke={SMITTE} strokeWidth={2 * s} strokeLinejoin="round" strokeLinecap="round" />
      <Txt x={r2(x + 17 * f)} y={r2(y + 5 * f)} anchor="start" size={0.74} weight={700} color={SMITTE}>
        {tekst}
      </Txt>
    </g>
  );
}

/** Mållinje over bakken mellom kloakkledningen og brønnen. */
function Avstandsmal({ fra, til, y, L }: { fra: number; til: number; y: number; L: number }) {
  const f = useTextScale();
  if (!(til - fra > 6)) return null;
  const tekst = `${fmt(L, 0)} m`;
  // Teksten står mellom strekene fra flaggene; får den ikke plass, står bare pilene
  const plass = til - fra > tekstBredde(tekst, 17 * 0.78 * f) + 14 * f;
  return <Dimension x1={fra} y1={y} x2={til} y2={y} label={plass ? tekst : undefined} labelSize={0.78} offset={0} color={VIZ.ink} />;
}

/* =====================================================================================================================
 * Porene i lupa og fartsstigen
 * ================================================================================================================== */

/** Hvordan utsnittet i lupa ser ut for hvert materiale: mediankornet, sortering, rundhet og målestokken. */
export const LUPE: Readonly<Record<'grus' | 'sand' | 'silt', { korn: number; d50: number; skala: number; tekst: string; sortering: number; rundhet: 'rundet' | 'noe-rundet' | 'kantrundet' }>> = {
  grus: { korn: 1 / 5.5, d50: 8, skala: 10, tekst: '1 cm', sortering: 0.9, rundhet: 'rundet' },
  sand: { korn: 1 / 11, d50: 0.4, skala: 1, tekst: '1 mm', sortering: 0.45, rundhet: 'noe-rundet' },
  silt: { korn: 1 / 15, d50: 0.03, skala: 0.1, tekst: '0,1 mm', sortering: 0.6, rundhet: 'kantrundet' },
};

/** Høyden på figuren med lupene for tekstskaleringen f. */
export function poreHoyde(f: number): number {
  return f > 1.3 ? Math.round(360 + 2 * 150 + 140 * f + 300) : 300;
}

/** Lupene (umettet og mettet sone) og fartsstigen. Eksportert for testene. */
export function PoreFigur({ valg, t, f }: { valg: MaterialValg; t: number; f: number }) {
  const k = useGeoScale();
  const smal = f > 1.3;
  const r = smal ? 150 : 92;
  const tittelY = smal ? 30 * f : 40;
  const cy = tittelY + 14 * f + r + 6;
  const c1 = smal ? 200 : 118;
  const c2 = smal ? 600 : 340;
  const bunnTekst = cy + r + 26 * f;
  const fart = visningsfart(strom(valg)?.v ?? null, 26);
  const merker: StigeMerke[] = MATERIAL_VALG.map((id) => {
    const v = strom(id)?.v ?? 0;
    return { id, navn: MATERIAL_KNAPP[id], v, tekst: fmtFart(v) };
  });
  const stige = smal ? { x: 300, y: bunnTekst + 64 * f, h: poreHoyde(f) - bunnTekst - 64 * f - 30 } : { x: 568, y: 44, h: 228 };
  const tekster = undertekster(valg);
  return (
    <g>
      <Txt x={c1} y={r2(tittelY)} size={0.86} weight={700}>
        Umettet sone
      </Txt>
      <Txt x={c2} y={r2(tittelY)} size={0.86} weight={700}>
        Mettet sone
      </Txt>
      <Lupe x={c1} y={r2(cy)} r={r} handtak={null} malestokk={malestokk(valg, r, k)}>
        {({ r: lr }) => <Utsnitt valg={valg} r={lr} fyll="luft" t={t} fart={fart} />}
      </Lupe>
      <Lupe x={c2} y={r2(cy)} r={r} handtak={null} malestokk={malestokk(valg, r, k)}>
        {({ r: lr }) => <Utsnitt valg={valg} r={lr} fyll="vann" t={t} fart={fart} />}
      </Lupe>
      <Txt x={c1} y={r2(bunnTekst)} size={0.74} color={VIZ.muted}>
        {tekster[0]}
      </Txt>
      <Txt x={c2} y={r2(bunnTekst)} size={0.74} color={VIZ.muted}>
        {tekster[1]}
      </Txt>
      <Txt x={stige.x} y={r2(stige.y - 22 * f)} size={0.8} weight={700} anchor="middle">
        Porefart uten pumping
      </Txt>
      <Fartsstige x={stige.x} y={stige.y} h={stige.h} merker={merker} valgt={valg} />
    </g>
  );
}

function undertekster(valg: MaterialValg): readonly [string, string] {
  if (valg === 'oppsprukket-fjell') return ['Luft og vann i sprekkene', 'Vann fyller sprekkene'];
  if (valg === 'leire') return ['Vannhinner rundt flakene', 'Bitte små porer fulle av vann'];
  return ['Luft og vannhinner rundt kornene', 'Vann fyller alle porene'];
}

function malestokk(valg: MaterialValg, r: number, k: number): { lengde: number; tekst: string } {
  if (valg === 'leire') return { lengde: 0.32 * r, tekst: '0,005 mm' };
  if (valg === 'oppsprukket-fjell') return { lengde: 0.45 * r, tekst: '5 mm' };
  const l = LUPE[valg];
  const kornPx = 2 * l.korn * r * k;
  return { lengde: Math.min(0.8 * r, (l.skala / l.d50) * kornPx), tekst: l.tekst };
}

/** Fast frø til kornpakningen per materiale, så lupa ser lik ut hver gang. */
export const KORN_FRO: Readonly<Record<'grus' | 'sand' | 'silt', number>> = { grus: 4, sand: 2, silt: 3 };

/**
 * Innholdet i én lupe: korn og porer, leirflak eller sprekker i fjell. Vannet i porene beveger seg med `t`. Kornpakning
 * husker kornene selv, så bare strømmen i porene (barnet) tegnes på nytt for hver ramme i avspillingen.
 */
function Utsnitt({ valg, r, fyll, t, fart }: { valg: MaterialValg; r: number; fyll: 'vann' | 'luft'; t: number; fart: number }) {
  if (valg === 'oppsprukket-fjell') return <SprekkeUtsnitt r={r} fyll={fyll} t={t} fart={fart} />;
  if (valg === 'leire') return <LeirUtsnitt r={r} fyll={fyll} />;
  const l = LUPE[valg];
  return (
    <Kornpakning x={0} y={0} r={r} ramme={false} fyll={fyll} korn={l.korn * r} sortering={l.sortering} rundhet={l.rundhet} type={MATERIAL_MONSTER[valg]} seed={KORN_FRO[valg]}>
      {fyll === 'vann' ? (g) => <PoreStrom g={g} t={t} fart={fart} /> : null}
    </Kornpakning>
  );
}

/* =====================================================================================================================
 * Visualiseringen
 * ================================================================================================================== */

export default function Grunnvann() {
  const [valg, setValg] = useState<MaterialValg>('sand');
  const [qi, setQi] = useState(() => Math.max(0, PUMPERATER_LS.indexOf(5)));
  const [L, setL] = useState(60);
  const [nitrat, setNitrat] = useState(false);
  const clock = useSimClock({ tMax: SPILLETID });
  const { reset } = clock;
  useEffect(() => {
    reset();
  }, [valg, nitrat, reset]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const [ref2, f2] = useContainerTextScale<HTMLDivElement>();
  const qLs = PUMPERATER_LS[qi] ?? 5;
  const b = useMemo(() => beregn(valg, qLs, L, nitrat), [valg, qLs, L, nitrat]);
  const o = useMemo(() => oppsett(f), [f]);
  const tau = (clock.t / SPILLETID) * b.spenn;
  const bronn = b.bronn;
  const barriere = smittebarriere(b.tSmitte, valg);
  const m = materiale(valg);

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Pumperate Q"
          ariaLabel="Pumperate"
          value={qi}
          onChange={setQi}
          min={0}
          max={PUMPERATER_LS.length - 1}
          step={1}
          format={(i) => fmtLs((PUMPERATER_LS[i] ?? 0) / 1000)}
        />
        <Slider label="Avstand fra kloakkledningen til brønnen L" ariaLabel="Avstand fra kloakkledningen til brønnen" value={L} onChange={setL} min={AVSTAND_MIN_M} max={AVSTAND_MAKS_M} step={AVSTAND_STEG_M} unit="m" />
      </Controls>
      <Toolbar>
        <Segmented<MaterialValg> label="Materiale i grunnen" options={MATERIAL_VALG.map((id) => ({ value: id, label: MATERIAL_KNAPP[id] }))} value={valg} onChange={setValg} />
      </Toolbar>
      <Toolbar>
        <Toggle label="Nitrat fra åkeren" checked={nitrat} onChange={setNitrat} />
        <PlayBar clock={clock} time={`${fmtVarighet(tau)} i grunnen`} />
      </Toolbar>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${o.W} ${o.H}`}
          label={figurTekst(b)}
          maxHeight={o.smal ? 900 : 560}
          caption={`Snitt gjennom en dal med elv. Høydene er strukket omtrent ${fmt(overhoyde(o), 0)} ganger, og husene og brønnen er tegnet større enn målestokken.`}
        >
          <GrunnvannFigur o={o} b={b} tau={tau} t={clock.t} />
        </Figure>
      </div>
      <FlateForklaring
        items={[
          { farge: GEO.grunnvann.line, label: 'Grunnvannsspeil: over er umettet sone, under er mettet sone', form: 'linje' },
          { farge: VIZ.velocity, label: 'Grunnvannet strømmer', form: 'linje' },
          { farge: SMITTE, label: 'Smittestoff fra kloakken', form: 'prikk' },
          { farge: SMITTE, label: valg === 'oppsprukket-fjell' ? '60 døgn med snittfarten (ikke nok i fjell)' : '60 døgn fra brønnen', form: 'linje', stiplet: true },
          ...(nitrat ? [{ farge: NITRAT, label: 'Nitrat fra åkeren', form: 'prikk' as const }] : []),
        ]}
      />

      <div ref={ref2}>
        <Figure viewBox={`0 0 800 ${poreHoyde(f2)}`} label={`Lupe: ${MATERIAL_KNAPP[valg].toLowerCase()} over og under grunnvannsspeilet, og porefarten i de fem materialene`} maxHeight={f2 > 1.3 ? 1100 : 320}>
          <PoreFigur valg={valg} t={clock.t} f={f2} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Porefart v (uten pumping)" value={fmtFart(b.v)} />
        <Readout label="Reisetid fra kloakken" value={fmtVarighet(b.tSmitte)} tone={barriere && !barriere.oppfylt ? SMITTE : undefined} />
        <Readout label="Senkning i brønnen" value={bronn ? `${fmt(bronn.senkning, bronn.senkning < 1 ? 2 : 1)} m` : '–'} />
        <Readout label={bronn?.torr ? 'Brønnen gir (mer går ikke)' : 'Brønnen gir'} value={bronn ? fmtLs(bronn.Q) : '–'} />
        {nitrat && <Readout label="Nitrat i brønnen" value={b.nitratVedBronn === null ? '–' : `${fmt(b.nitratVedBronn, 0)} mg/l`} tone={NITRAT} />}
      </Readouts>

      <Formula label="Darcys lov, porefart og reisetid">
        <FormulaLine>
          Darcys lov: q = K · i = {fmtSci(m.K, 1)} m/s · {fmt(GRADIENT, 3)} = {b.q === null ? '–' : fmtSci(b.q, 1)} m/s
        </FormulaLine>
        <FormulaLine>
          Porefart: v = q / n<Sub>e</Sub> = {b.q === null ? '–' : fmtSci(b.q, 1)} m/s / {fmt(m.effektivPorositet, m.effektivPorositet < 0.01 ? 3 : 2)} = {b.v === null ? '–' : fmtSci(b.v, 1)} m/s ≈ {fmtFart(b.v)}
        </FormulaLine>
        <FormulaLine>
          Reisetid uten pumping: t = L / v = {fmt(L, 0)} m / {fmtFart(b.v)} ≈ {fmtVarighet(b.tSmitteUten)}
        </FormulaLine>
        {b.pumper && (
          <FormulaLine>
            Med pumping ({fmtLs(bronn?.Q ?? 0)}) trekker senkningstrakten vannet raskere inn: t ≈ {fmtVarighet(b.tSmitte)}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{forklaring(b)}</Explain>
    </VizLayout>
  );
}

/** Pumperate (m³/s) i liter i timen med to gjeldende siffer: 0,21 l/s → «740», 19,6 l/s → «71 000». */
function fmtLiterITimen(Q: number): string {
  const lt = Q * 1000 * 3600;
  if (!(lt > 0)) return '0';
  const e = Math.floor(Math.log10(lt)) - 1;
  const v = Math.round(lt / 10 ** e) * 10 ** e;
  return fmt(v, v < 10 ? 1 : 0);
}

/** Beskrivelsen av figuren for skjermlesere. */
function figurTekst(b: Beregning): string {
  return `Snitt gjennom ${MATERIAL_NAVN[b.valg].toLowerCase()} med grunnvannsspeil, en brønn som pumper ${fmtLs(b.bronn?.Q ?? 0)}, en lekk kloakkledning ${fmt(b.L, 0)} m fra brønnen og ei elv der grunnvannet kommer ut.`;
}

/** Forklaringen under figuren, som endrer seg med valgene. */
export function forklaring(b: Beregning): ReactNode {
  const m = materiale(b.valg);
  const bronn = b.bronn;
  const v = fmtFart(b.v);
  const K = fmtSci(m.K, 0);
  const avsnitt: ReactNode[] = [];

  // Materialet
  const mat: Record<MaterialValg, string> = {
    grus: `Grus har store porer som henger sammen: K ≈ ${K} m/s, og grunnvannet går ca. ${v}. Breelvavsetninger er sand og grus som smeltevannet fra isen sorterte og la igjen. De er tykke, slipper vannet lett gjennom og ligger ofte ved elver som fyller dem på igjen, så de er de beste grunnvannsmagasinene vi har (et av de største er Gardermoen-deltaet på Romerike).`,
    sand: `Sand har mindre porer enn grus: K ≈ ${K} m/s, og grunnvannet går ca. ${v}. Sand gir mye vann og renser det godt på veien, så mange vannverk henter grunnvann fra sand- og grusavsetninger.`,
    silt: `Silt har små porer: K ≈ ${K} m/s, og grunnvannet går bare ca. ${v}. Vannet strømmer så tregt til brønnen at den gir lite.`,
    leire: `Leire er nesten halvparten porer, men porene er så små at vannet nesten står stille: K ≈ ${K} m/s, ca. ${v}. Leira holder på vannet og slipper det nesten ikke fra seg, så den er et tett lag, ikke et magasin.`,
    'oppsprukket-fjell': `I fjellet står vannet i sprekker, ikke i porer, og sprekkene er bare omtrent 1 % av volumet. Snittfarten er ca. ${v}, men vannet går i noen få åpne sprekker og kan komme mye fortere fram.`,
  };
  avsnitt.push(
    <p key="m">
      {mat[b.valg]} Grunnvannet står ikke i underjordiske innsjøer: det fyller porene og sprekkene (lupa). Over grunnvannsspeilet er det både luft og vann i porene (umettet sone), under er alt fylt med vann (mettet sone).
    </p>,
  );

  // Brønnen og senkningstrakten
  if (bronn && b.pumper) {
    const R = bronn.R;
    const form = R > 400 ? ' Trakten er grunn og svært vid, fordi vannet strømmer lett til.' : R < 60 ? ' Trakten er dyp og smal, fordi vannet strømmer så tregt til.' : '';
    const torr = bronn.torr
      ? ` Mer enn ${fmtLs(bronn.Qmaks)} (ca. ${fmtLiterITimen(bronn.Qmaks)} liter i timen) klarer ikke brønnen: da synker vannet ned til pumpen, og brønnen går tørr.`
      : '';
    avsnitt.push(
      <p key="b">
        Brønnen pumper {fmtLs(bronn.Q)} og senker grunnvannsspeilet {fmt(bronn.senkning, bronn.senkning < 1 ? 2 : 1)} m. Etter {PUMPETID_DOGN} døgn merkes senkningstrakten ca. {fmtAvstand(R)} ut fra brønnen.{form}
        {torr}
      </p>,
    );
  } else {
    avsnitt.push(
      <p key="b">
        Brønnen pumper ikke: grunnvannsspeilet heller jevnt mot elva, og grunnvannet strømmer forbi brønnen og ut i elva. Dra i pumperaten for å se senkningstrakten.
      </p>,
    );
  }

  // Smittestoffer og 60-døgnskravet (gjelder løsmasser, ikke fjell)
  const ts = b.tSmitte;
  const bar = smittebarriere(ts, b.valg);
  const grense = b.x60 === null ? 'svært langt' : fmtAvstand(b.x60);
  if (bar?.status === 'fjell') {
    avsnitt.push(
      <p key="s">
        Med snittfarten bruker vannet ca. {fmtVarighet(ts)} fra den lekke kloakkledningen til brønnen ({bar.langNok ? 'mer' : 'mindre'} enn {KRAV_OPPHOLDSTID_DOGN} døgn). Men kravet om minst{' '}
        {KRAV_OPPHOLDSTID_DOGN} døgns oppholdstid i grunnen gjelder grunnvann i løsmasser. I fjell går vannet i noen få åpne sprekker og kan komme mye fortere fram enn snittet, så
        fjellet regnes ikke som en hygienisk barriere, uansett hva reisetiden ser ut til å være. En fjellbrønn trenger en annen barriere, for eksempel UV-behandling eller
        desinfeksjon med klor, og bør ligge godt unna kilder til smitte.
      </p>,
    );
  } else if (bar && bar.oppfylt) {
    avsnitt.push(
      <p key="s">
        Fra den lekke kloakkledningen bruker vannet ca. {fmtVarighet(ts)} til brønnen. Det er mer enn kravet om minst {KRAV_OPPHOLDSTID_DOGN} døgns oppholdstid i grunnen (veiledningen til drikkevannsforskriften), så løsmassene regnes som en hygienisk barriere: de
        fleste bakterier og virus dør eller fester seg til kornene underveis.
      </p>,
    );
  } else {
    avsnitt.push(
      <p key="s">
        Fra den lekke kloakkledningen bruker vannet bare ca. {fmtVarighet(ts)} til brønnen, mindre enn kravet om minst {KRAV_OPPHOLDSTID_DOGN} døgn i grunnen. Smittestoffer kan nå drikkevannet. Med denne pumperaten må kilder til smitte ligge minst ca. {grense} fra
        brønnen (den stiplede linja), eller brønnen må pumpe mindre.
      </p>,
    );
  }

  if (b.nitrat) {
    const c = b.nitratVedBronn;
    avsnitt.push(
      <p key="n">
        Nitrat brytes ikke ned i oksygenrikt grunnvann. Fra åkeren, {AKER_AVSTAND_M} m unna, når det brønnen etter ca. {fmtVarighet(b.tNitrat)}, fortynnet fra ca. {NITRAT_UNDER_AKER} til ca. {c === null ? '–' : fmt(c, 0)} mg/l (grenseverdien i drikkevann er{' '}
        {NITRAT_GRENSEVERDI} mg/l). Lang oppholdstid hjelper derfor ikke mot nitrat. Det som virker, er en sikringssone rundt brønnen der det ikke gjødsles, og mindre gjødsling.
      </p>,
    );
  }
  return <>{avsnitt}</>;
}
