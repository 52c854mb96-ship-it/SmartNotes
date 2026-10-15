/**
 * Kotekart og terrengprofil (k9-kotekart): et tenkt norsk landskap som kotekart med høydelag, ekvidistanse, målestokk,
 * elv, vann og vannskille. Eleven legger profillinja A–B (retning og plassering), ser terrengprofilet under med
 * overhøyde som kan endres, og flytter punktet P langs linja for å lese av høyde og helning (grader og prosent) og
 * avstanden mellom kotene. Kotekrysningene merkes langs linja og i profilet, slik et profil tegnes for hånd.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  FlateForklaring,
  Formula,
  FormulaLine,
  Forvalg,
  GEO,
  Kotekart,
  Lupe,
  Profildiagram,
  Readout,
  Readouts,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  glattSti,
  helning,
  hoydeVed,
  hoydelagFor,
  jevnLinje,
  kartSkala,
  koter,
  tekstBredde,
  useContainerTextScale,
  useGeoScale,
  useGeoStroke,
  useTextScale,
  type Helning,
  type Hoydefelt,
  type KartElv,
  type KartInnsjo,
  type KartSkala,
  type KartMerke,
  type KartVannskille,
  type KotekartInfo,
  type LogPlotSkalaer,
  type ProfilPunkt,
} from '../kit';
import { Dimension, SCENE, mix } from '../../kit/scene';
import {
  FORSKYVNING_MAKS,
  FORSKYVNING_STEG,
  FORVALG,
  KART,
  PAPIR_MAALESTOKK,
  RETNING_MAKS,
  RETNING_MIN,
  RETNING_STEG,
  STEDER,
  brattklasse,
  elveLop,
  elvekryssinger,
  fmtAvstand,
  helningLangsLinja,
  hoyestePunkt,
  iInnsjo,
  innsjo,
  kompassretning,
  kotavstand,
  kotekrysninger,
  landskap,
  nedborfeltAreal,
  papirLengde,
  profilFor,
  profillinje,
  projiserPaaLinje,
  punktPaaLinje,
  vannIProfil,
  vistVinkel,
  type Elvekryssing,
  type Forvalg as ForvalgData,
  type Innsjo,
  type Kotavstand,
  type Kotekrysning,
  type Profillinje,
} from './model-kotekart';

type Ekv = '10' | '20' | '50';
type P = [number, number];

/** Kartet fyller hele bredden av figuren: 800 enheter for 4 km, så 0,2 enheter per meter. */
const KART_B = 800;
const KART_H = (KART_B * KART.lengde) / KART.bredde;

/** Vannfargene, som i `Kotekart` og `Profildiagram` (vannflate og strandlinje/elv). */
const VANN_FYLL = mix(SCENE.waterLight, VIZ.surface, 0.35);
const VANN_LINJE = mix(SCENE.water, VIZ.ink, 0.22);
/** Papirfargen i et kotekart uten høydelag, som i `Kotekart`. */
const PAPIR = mix(VIZ.surface, GEO.hoydelag[2]!, 0.28);

/** Kotene som linjer i meter (til lupa). */
type KoteLinjer = { tykk: boolean; linjer: [number, number][][] }[];

/* ================================================================================================ Faste data */

/** Det som ikke endrer seg: innsjøen, elvene, merkene og nedbørfeltet (regnes ut én gang). */
interface Faste {
  sjo: Innsjo | null;
  elver: { punkter: P[]; navn: string }[];
  kartElver: KartElv[];
  /**
   * Elvene på smal skjerm: uten navnet på Fossbekken. Kartet er så lite der at navnet havner like ved profillinja over
   * dalen, der P og lupa ofte står (Kotekart holder navnene unna linja, men vet ikke hvor P er).
   */
  kartElverSmal: KartElv[];
  innsjoer: KartInnsjo[];
  vannskiller: KartVannskille[];
  merker: KartMerke[];
  /** Merkene på smal skjerm: åsene bare med høyden, så det lille kartet ikke blir fullt av tekst rundt P og lupa. */
  merkerSmal: KartMerke[];
  areal: number | null;
  topp: { p: P; z: number };
}

function lagFaste(felt: Hoydefelt): Faste {
  const sjo = innsjo(felt, STEDER.vann.punkt, STEDER.vann.niva);
  const elver = elveLop(felt, sjo);
  const bekk = elver[1]?.punkter ?? [];
  const sidebekk = elver[2]?.punkter ?? [];
  const topp = hoyestePunkt(felt, STEDER.topp.p, 250);
  const kollen = hoyestePunkt(felt, STEDER.aasNord.p, 250);
  const rasen = hoyestePunkt(felt, STEDER.aasSor.p, 250);
  const hus = STEDER.hus.map((p): KartMerke => ({ p, symbol: 'hus' }));
  const kartElver: KartElv[] = [
    { fra: STEDER.elv.fra, navn: STEDER.elv.navn },
    { punkter: jevnLinje(bekk, false, 3), navn: STEDER.bekk.navn, bredde: [1.1, 2.2] },
    { punkter: jevnLinje(sidebekk, false, 3), bredde: [1, 1.8] },
  ];
  return {
    sjo,
    elver,
    // Dalelva følger terrenget av seg selv (flytvei i Kotekart); bekkene stopper der de renner ut i vannet eller elva.
    kartElver,
    kartElverSmal: kartElver.map((e) => (e.navn === STEDER.bekk.navn ? { ...e, navn: undefined } : e)),
    innsjoer: [{ punkt: STEDER.vann.punkt, niva: STEDER.vann.niva, navn: STEDER.vann.navn }],
    // Uten navn: det ville stått midt i feltet ved Langvatnet og sagt lite; forklaringen og tegnforklaringen sier hva det er
    vannskiller: [{ utlop: STEDER.utlop.p }],
    merker: [
      { p: topp, symbol: 'topp', navn: STEDER.topp.navn },
      { p: kollen, symbol: 'topp', navn: STEDER.aasNord.navn },
      { p: rasen, symbol: 'topp', navn: STEDER.aasSor.navn },
      ...hus,
    ],
    merkerSmal: [{ p: topp, symbol: 'topp', navn: STEDER.topp.navn }, { p: kollen, symbol: 'topp' }, { p: rasen, symbol: 'topp' }, ...hus],
    areal: nedborfeltAreal(felt),
    topp: { p: topp, z: hoydeVed(felt, topp[0], topp[1]) ?? felt.max },
  };
}

/* ================================================================================================ Tilstanden */

/** Alt som regnes ut fra valgene: profilet, kotekrysningene, punktet P og målingene der. */
interface Beregning {
  linje: Profillinje;
  prof: ProfilPunkt[];
  kryss: Kotekrysning[];
  vann: [number, number][];
  elvKryss: Elvekryssing[];
  zMin: number;
  zMax: number;
  ekv: number;
  overhoyde: number;
  t: number;
  P: P;
  sP: number;
  /** P ligger i Langvatnet. */
  iVann: boolean;
  /** Høyden i P (vannflaten når P ligger i vannet). */
  zP: number | null;
  /** Bratteste helning i P (null i vannet). */
  h: Helning | null;
  /** Avstanden mellom kotene ved P (null når det er flatt eller i vannet). */
  ka: Kotavstand | null;
  /** Helningen langs linja ved P (grader, + når terrenget stiger mot B). */
  langs: number | null;
}

function beregn(felt: Hoydefelt, faste: Faste, linje: Profillinje, t: number, ekv: number, overhoyde: number): Beregning {
  const prof = profilFor(felt, linje, 400);
  const sjo = faste.sjo;
  const kryss = kotekrysninger(prof, ekv).filter((k) => !iInnsjo(felt, sjo, k.x, k.y));
  const zs = prof.map((p) => p.z);
  const P = punktPaaLinje(linje, t);
  const iVann = iInnsjo(felt, sjo, P[0], P[1]);
  const zTerreng = hoydeVed(felt, P[0], P[1]);
  return {
    linje,
    prof,
    kryss,
    vann: vannIProfil(felt, sjo, prof),
    elvKryss: elvekryssinger(linje, faste.elver),
    zMin: zs.length ? Math.min(...zs) : felt.min,
    zMax: zs.length ? Math.max(...zs) : felt.max,
    ekv,
    overhoyde,
    t,
    P,
    sP: t * linje.lengde,
    iVann,
    zP: iVann && sjo ? sjo.niva : zTerreng,
    h: iVann ? null : helning(felt, P[0], P[1]),
    ka: iVann ? null : kotavstand(felt, P[0], P[1], ekv),
    langs: iVann ? 0 : helningLangsLinja(felt, linje, t),
  };
}

/* ================================================================================================ Komponenten */

export default function KotekartOgProfil() {
  const start = FORVALG[0]!;
  const [retning, setRetning] = useState(start.retning);
  const [forskyvning, setForskyvning] = useState(start.forskyvning);
  const [pPst, setPPst] = useState(Math.round(start.t * 100));
  const [overhoyde, setOverhoyde] = useState(2);
  const [ekvValg, setEkvValg] = useState<Ekv>('20');
  const [lag, setLag] = useState(true);
  const [visFelt, setVisFelt] = useState(true);
  const [lupe, setLupe] = useState(true);
  const [refProfil, fProfil] = useContainerTextScale<HTMLDivElement>();

  const felt = landskap();
  const faste = useMemo(() => lagFaste(felt), [felt]);
  const ekv = Number(ekvValg);
  const linje = useMemo(() => profillinje(retning, forskyvning) ?? profillinje(start.retning, start.forskyvning)!, [retning, forskyvning, start.retning, start.forskyvning]);
  const b = useMemo(() => beregn(felt, faste, linje, pPst / 100, ekv, overhoyde), [felt, faste, linje, pPst, ekv, overhoyde]);
  const forvalg = FORVALG.find((v) => v.retning === retning && v.forskyvning === forskyvning)?.id ?? null;
  const velg = (v: ForvalgData) => {
    setRetning(v.retning);
    setForskyvning(v.forskyvning);
    setPPst(Math.round(v.t * 100));
  };
  const lagListe = useMemo(() => (lag ? hoydelagFor(felt, ekv) : []), [felt, ekv, lag]);
  // Kotene som linjer i meter, til lupa: de samme kotene som Kotekart gir barna sine (`koter` med ekvidistansen), regnet
  // her fordi lupa tegnes utenfor det memoiserte kartet, så kartet ikke tegnes på nytt når P flyttes
  const koteLinjer = useMemo(() => koter(felt, ekv).map((kt) => ({ tykk: kt.tykk, linjer: kt.linjer.map((l) => l.punkter) })), [felt, ekv]);
  const lupeFarge = lag ? (lagListe.find((l) => b.zP !== null && b.zP >= l.fra && b.zP <= l.til)?.farge ?? VIZ.surface) : PAPIR;
  const velgT = useCallback((t: number) => setPPst(Math.round(t * 100)), []);
  // Høyere på mobil, men ikke så mye som geoHoyde: profilet skal fylle plottet også med liten overhøyde
  const H = Math.round(320 + 150 * (Math.max(1, fProfil) - 1));

  return (
    <VizLayout>
      <Controls>
        <Slider label="Retning fra A mot B" ariaLabel="Retning fra A mot B" value={retning} onChange={setRetning} min={RETNING_MIN} max={RETNING_MAKS} step={RETNING_STEG} format={(v) => `${fmt(v, 0)}° (mot ${kompassretning(v)})`} />
        <Slider
          label="Flytt linja sidelengs"
          value={forskyvning}
          onChange={setForskyvning}
          min={-FORSKYVNING_MAKS}
          max={FORSKYVNING_MAKS}
          step={FORSKYVNING_STEG}
          format={(v) => (v === 0 ? 'gjennom midten' : `${fmt(Math.abs(v), 0)} m mot ${v > 0 ? 'høyre' : 'venstre'}`)}
        />
        <Slider label="Punktet P langs linja" value={pPst} onChange={setPPst} min={0} max={100} step={1} format={(v) => `${fmtAvstand((v / 100) * linje.lengde)} fra A`} />
        <Slider label="Overhøyde i profilet" value={overhoyde} onChange={setOverhoyde} min={1} max={10} step={1} format={(v) => (v === 1 ? '1 (ingen)' : `${fmt(v, 0)} ganger`)} />
      </Controls>
      <Toolbar>
        <Forvalg<ForvalgData['id']> label="Profillinje" options={FORVALG.map((v) => ({ value: v.id, label: v.navn }))} value={forvalg} onPick={(id) => velg(FORVALG.find((v) => v.id === id)!)} />
      </Toolbar>
      <Toolbar>
        {/* Forvalg (ikke Segmented) så ordet «Ekvidistanse» står synlig foran knappene, som «Profillinje» over */}
        <Forvalg<Ekv>
          label="Ekvidistanse"
          options={[
            { value: '10', label: '10 m' },
            { value: '20', label: '20 m' },
            { value: '50', label: '50 m' },
          ]}
          value={ekvValg}
          onPick={setEkvValg}
        />
        <Toggle label="Høydelag og relieff" checked={lag} onChange={setLag} />
        <Toggle label="Nedbørfelt" checked={visFelt} onChange={setVisFelt} />
        <Toggle label="Lupe ved P" checked={lupe} onChange={setLupe} />
      </Toolbar>

      <Figure viewBox={`0 0 ${KART_B} ${fmt(KART_H, 0)}`} label={kartTekst(b, faste)} maxHeight={640} caption="Trykk på kartet eller i profilet (eller dra med musa) for å flytte P langs linja.">
        <Kartfigur felt={felt} faste={faste} b={b} lag={lag} visFelt={visFelt} lupe={lupe && !b.iVann ? { koteLinjer, farge: lupeFarge } : null} onVelgT={velgT} />
      </Figure>
      <FlateForklaring
        items={[
          ...lagListe.map((l) => ({ farge: l.farge, label: `${fmt(l.fra, 0)}–${fmt(l.til, 0)} m o.h.` })),
          { farge: GEO.kote, label: `Koter hver ${fmt(ekv, 0)}. m (tellekote hver ${fmt(5 * ekv, 0)}. m)`, form: 'linje' },
          { farge: { fill: VANN_FYLL, line: VANN_LINJE }, label: 'Vann' },
          { farge: VANN_LINJE, label: 'Elv', form: 'linje' },
          ...(visFelt ? [{ farge: GEO.vannskille, label: 'Vannskille', form: 'linje' as const, stiplet: true }] : []),
          { farge: VIZ.ink, label: 'Profillinje A–B med kotekrysninger', form: 'linje' },
        ]}
      />

      <div ref={refProfil}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          label={profilTekst(b)}
          maxHeight={fProfil > 1.3 ? 760 : 420}
          caption={b.overhoyde === 1 ? 'Ingen overhøyde: høydene og lengdene er tegnet i samme målestokk.' : `Overhøyde ${fmt(b.overhoyde, 0)} ganger: høydene er strukket ${fmt(b.overhoyde, 0)} ganger i forhold til lengdene.`}
        >
          <Profilfigur felt={felt} faste={faste} b={b} H={H} onVelgT={velgT} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Høyde i P" value={b.zP === null ? '–' : `${fmt(b.zP, 0)} m o.h.`} />
        <Readout label="Helning i P" value={b.iVann ? '0° (vann)' : b.h ? `${fmt(b.h.grader, 0)}°` : '–'} />
        <Readout label="Helning i prosent" value={b.iVann ? '0 %' : b.h ? `${fmt(b.h.prosent, 0)} %` : '–'} />
        <Readout label="Avstand mellom kotene ved P" value={b.ka ? `${fmt(b.ka.d, 0)} m` : '–'} />
      </Readouts>

      <Formula label="Fra kartet til tall">
        {b.ka ? (
          <>
            <FormulaLine>
              tan α ≈ ekvidistanse / avstand mellom kotene = {fmt(b.ekv, 0)} m / {fmt(b.ka.d, 0)} m = {fmt(b.ekv / b.ka.d, 2)}
            </FormulaLine>
            <FormulaLine>
              α ≈ {fmt(b.ka.grader, 0)}°, og i prosent: 100 · {fmt(b.ekv / b.ka.d, 2)} = {fmt((100 * b.ekv) / b.ka.d, 0)} %
            </FormulaLine>
          </>
        ) : (
          <FormulaLine>tan α = ekvidistanse / avstand mellom kotene {b.iVann ? '(P ligger i vannet, som er flatt)' : '(ved P er det for langt til neste kote)'}</FormulaLine>
        )}
        <FormulaLine>
          A–B = {fmtAvstand(b.linje.lengde)}. I 1 : {fmt(PAPIR_MAALESTOKK, 0)}: {fmt(b.linje.lengde, 0)} m · 100 / {fmt(PAPIR_MAALESTOKK, 0)} = {fmt(papirLengde(b.linje.lengde) ?? NaN, 1)} cm på kartet
        </FormulaLine>
        {b.overhoyde > 1 && b.langs !== null && Math.abs(b.langs) >= 1 && (
          <FormulaLine>
            Overhøyde {fmt(b.overhoyde, 0)}: tan(vist) = {fmt(b.overhoyde, 0)} · tan {fmt(Math.abs(b.langs), 0)}°, så {fmt(Math.abs(b.langs), 0)}° ser ut som {fmt(Math.abs(vistVinkel(b.langs, b.overhoyde) ?? NaN), 0)}°
          </FormulaLine>
        )}
      </Formula>

      <Explain>{forklaring(b, faste, visFelt, lupe)}</Explain>
    </VizLayout>
  );
}

/* ================================================================================================ Kartet */

/** Kotekartet med profillinja, kotekrysningene, punktet P og flata eleven peker på. */
const Kartfigur = memo(function Kartfigur({
  felt,
  faste,
  b,
  lag,
  visFelt,
  lupe,
  onVelgT,
}: {
  felt: Hoydefelt;
  faste: Faste;
  b: Beregning;
  lag: boolean;
  visFelt: boolean;
  lupe: { koteLinjer: KoteLinjer; farge: string } | null;
  onVelgT: (t: number) => void;
}) {
  const S = kartSkala(felt, KART_B);
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const { linje } = b;
  const L = Math.hypot(S.px(linje.B[0]) - S.px(linje.A[0]), S.py(linje.B[1]) - S.py(linje.A[1])) || 1;
  // Normalen på linja i figuren, til merkene der linja krysser en kote
  const nx = -(S.py(linje.B[1]) - S.py(linje.A[1])) / L;
  const ny = (S.px(linje.B[0]) - S.px(linje.A[0])) / L;
  const [px, py] = S.punkt(b.P);
  const smal = f > 1.3;
  const merker = smal ? faste.merkerSmal : faste.merker;
  // Flatene kartet selv har satt tekst og symboler på (navn, merker, A og B, nordpila og målestokken), fra Kotekart sine
  // barn. Kartet er memoisert, så de meldes inn i en tilstand når linja eller valgene endres (før skjermen tegnes).
  const [opptatt, setOpptatt] = useState<readonly Boks[]>([]);
  // Lupa og P-etiketten holder seg unna dem, og P-etiketten også unna lupa
  const plass = lupe ? lupePlass(S, b, nx, ny, k, opptatt) : null;
  const hindre: Boks[] = [...opptatt];
  if (plass) hindre.push([plass.x - plass.r, plass.y - plass.r, plass.x + plass.r, plass.y + plass.r]);
  // Lupas ring rundt P (utsnittet) skal ikke gå gjennom bokstaven
  const ring = plass ? plass.r / plass.faktor : 0;
  const etikett = pEtikett(px, py, nx, ny, hindre, f, k, [S.x0, S.y0, S.x0 + S.w, S.y0 + S.h], ring);
  // Kartet tegnes bare på nytt når linja, ekvidistansen eller valgene endres, ikke når P flyttes
  const [ax, ay] = linje.A;
  const [bx, by] = linje.B;
  const elver = smal ? faste.kartElverSmal : faste.kartElver;
  const kart = useMemo(
    () => (
      <Kotekart
        felt={felt}
        width={KART_B}
        ekvidistanse={b.ekv}
        hoydelag={lag}
        relieff={lag}
        innsjoer={faste.innsjoer}
        elver={elver}
        vannskiller={visFelt ? faste.vannskiller : undefined}
        merker={merker}
        profil={{ A: [ax, ay], B: [bx, by] }}
      >
        {(_S, info) => <MeldOpptatt info={info} onEndret={setOpptatt} />}
      </Kotekart>
    ),
    [felt, b.ekv, lag, faste, elver, visFelt, merker, ax, ay, bx, by],
  );
  return (
    <g>
      {kart}
      {/* Kotekrysningene langs linja: korte tverrstreker, lengre på tellekotene */}
      <g pointerEvents="none">
        {b.kryss.map((kr, i) => {
          const [x, y] = S.punkt([kr.x, kr.y]);
          const l = (kr.tykk ? 7 : 4.5) * k;
          return <line key={i} x1={x - nx * l} y1={y - ny * l} x2={x + nx * l} y2={y + ny * l} stroke={VIZ.ink} strokeWidth={(kr.tykk ? 2.2 : 1.5) * ss} strokeLinecap="round" />;
        })}
      </g>
      <PekeFlate
        x={0}
        y={0}
        w={KART_B}
        h={KART_H}
        label="Kotekartet"
        onPek={(fx, fy) => onVelgT(projiserPaaLinje(linje, [S.mx(fx), S.my(fy)]))}
      />
      <PunktP x={px} y={py} etikett={etikett} />
      {lupe && plass && <LupeVedP S={S} b={b} plass={plass} koteLinjer={lupe.koteLinjer} farge={lupe.farge} />}
    </g>
  );
});

/**
 * Melder flatene `Kotekart` har satt tekst og symboler på (`KotekartInfo.opptatt`) til Kartfigur, bare når de endres
 * (før skjermen tegnes, så lupa og P-etiketten aldri står ett bilde på feil sted).
 */
function MeldOpptatt({ info, onEndret }: { info: KotekartInfo; onEndret: (b: readonly Boks[]) => void }) {
  const bokser = info.opptatt.map((o): Boks => [o.x0, o.y0, o.x1, o.y1]);
  const nokkel = bokser.map((bk) => bk.map((v) => Math.round(v)).join(',')).join(';');
  const siste = useRef(bokser);
  siste.current = bokser;
  useLayoutEffect(() => {
    onEndret(siste.current);
  }, [nokkel, onEndret]);
  return null;
}

/** Hvor lupa står (midten), radiusen og forstørrelsen. */
interface LupePlass {
  x: number;
  y: number;
  r: number;
  faktor: number;
}

/**
 * Plassen til lupa ved P: vinkelrett ut fra linja (først den ene siden, så den andre, så skrått), innenfor kartet og
 * unna `hindre` (navnene, merkene, A og B, nordpila og målestokken på kartet). Forstørrelsen velges så mållinja mellom
 * kotene får plass (høyst 8 ganger).
 */
function lupePlass(S: KartSkala, b: Beregning, nx: number, ny: number, k: number, hindre: readonly Boks[]): LupePlass {
  const [px, py] = S.punkt(b.P);
  // Litt mindre på mobil, der kartet er lite fra før
  const r = (k > 1.2 ? 51 : 60) * k;
  const dPx = b.ka ? b.ka.d * S.k : null;
  const faktor = dPx ? Math.max(2, Math.min(8, (1.45 * r) / dPx)) : 6;
  const avstand = r + 24 * k;
  const retninger: P[] = [
    [nx, ny],
    [-nx, -ny],
    [nx + ny, ny - nx],
    [nx - ny, ny + nx],
    [-nx + ny, -ny - nx],
    [-nx - ny, -ny + nx],
  ];
  // Først like ved linja, så lenger ut (når P ligger ved kanten eller målestokken), så rundt P i alle retninger
  const kandidater: P[] = [
    ...[1, 1.7].flatMap((m) =>
      retninger.map(([a, c]): P => {
        const l = Math.hypot(a, c) || 1;
        return [px + (a / l) * avstand * m, py + (c / l) * avstand * m];
      }),
    ),
    ...[1, 1.4, 1.9, 2.5].flatMap((m) => Array.from({ length: 16 }, (_, i): P => [px + Math.cos((i * Math.PI) / 8) * avstand * m, py + Math.sin((i * Math.PI) / 8) * avstand * m])),
  ];
  // Profillinja i figuren: lupa skal ikke ligge over den
  const [ax, ay] = S.punkt(b.linje.A);
  const [bx, by] = S.punkt(b.linje.B);
  const tilLinja = (cx: number, cy: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const u = Math.min(1, Math.max(0, ((cx - ax) * dx + (cy - ay) * dy) / L2));
    return Math.hypot(cx - ax - u * dx, cy - ay - u * dy);
  };
  const inne = ([cx, cy]: P) => cx - r > 4 && cx + r < KART_B - 4 && cy - r > 4 && cy + r < KART_H - 4;
  // Hvor mye lupa dekker (flaten av hindringene under kvadratet rundt lupa, og et tillegg når den ligger over linja)
  const dekker = ([cx, cy]: P) =>
    hindre.reduce((sum, o) => sum + Math.max(0, Math.min(cx + r, o[2]) - Math.max(cx - r, o[0])) * Math.max(0, Math.min(cy + r, o[3]) - Math.max(cy - r, o[1])), 0) +
    (tilLinja(cx, cy) < r + 4 * k ? 4 * r * r : 0);
  const fri = kandidater.find((c) => inne(c) && dekker(c) === 0);
  // Ingen ledig plass: den plassen inne i kartet som dekker minst
  const best = fri ?? kandidater.filter(inne).reduce<P | null>((a, c) => (a === null || dekker(c) < dekker(a) ? c : a), null);
  const [x, y] = best ?? [Math.min(KART_B - r - 6, Math.max(r + 6, kandidater[0]![0])), Math.min(KART_H - r - 6, Math.max(r + 6, kandidater[0]![1]))];
  return { x, y, r, faktor };
}

/**
 * Lupe ved P: kotene rundt P forstørret, med en mållinje mellom koten under og koten over P (målt rett på kotene) og
 * høyden på de to kotene. Lupa står ved siden av linja, der den får plass innenfor kartet.
 */
function LupeVedP({ S, b, plass, koteLinjer, farge }: { S: KartSkala; b: Beregning; plass: LupePlass; koteLinjer: KoteLinjer; farge: string }) {
  const k = useGeoScale();
  const f = useTextScale();
  const [px, py] = S.punkt(b.P);
  const { x: lx, y: ly, r, faktor } = plass;
  // Kotebitene innenfor utsnittet (i figurens koordinater)
  const Rm = (r / faktor / S.k) * 1.15;
  const naer = (q: readonly [number, number]) => Math.hypot(q[0] - b.P[0], q[1] - b.P[1]) <= Rm;
  const biter: { d: string; tykk: boolean }[] = [];
  for (const kt of koteLinjer) {
    for (const linje of kt.linjer) {
      let run: [number, number][] = [];
      linje.forEach((q, i) => {
        const med = naer(q) || (linje[i + 1] !== undefined && naer(linje[i + 1]!)) || (i > 0 && naer(linje[i - 1]!));
        if (med) run.push(S.punkt(q));
        else if (run.length) {
          if (run.length > 1) biter.push({ d: glattSti(run), tykk: kt.tykk });
          run = [];
        }
      });
      if (run.length > 1) biter.push({ d: glattSti(run), tykk: kt.tykk });
    }
  }
  const tilLupe = (q: readonly [number, number]): P => {
    const [x, y] = S.punkt(q);
    return [lx + (x - px) * faktor, ly + (y - py) * faktor];
  };
  const ka = b.ka;
  const a = ka ? tilLupe(ka.fra) : null;
  const c = ka ? tilLupe(ka.til) : null;
  const L = a && c ? Math.hypot(c[0] - a[0], c[1] - a[1]) : 0;
  const ux = a && c && L > 0 ? (c[0] - a[0]) / L : 0;
  const uy = a && c && L > 0 ? (c[1] - a[1]) / L : 0;
  const tPx = 17 * 0.66 * f;
  // Høyden på kotene ved endene av mållinja, holdt inne i kartet
  const kotetall = (q: P, retning: 1 | -1, z: number) => {
    const tekst = fmt(z, 0);
    const halv = tekstBredde(tekst, tPx) / 2 + 2;
    const x = Math.min(KART_B - 4 - halv, Math.max(4 + halv, q[0] + retning * ux * (8 * k + tPx)));
    const y = Math.min(KART_H - 4, Math.max(4 + tPx, q[1] + retning * uy * (8 * k + tPx) + tPx * 0.35));
    return { x, y, tekst };
  };
  const tallUnder = a && ka ? kotetall(a, -1, ka.under) : null;
  const tallOver = c && ka ? kotetall(c, 1, ka.over) : null;
  return (
    <g pointerEvents="none">
      <Lupe x={lx} y={ly} r={r} fra={{ x: px, y: py }} forstorr={{ faktor, x: px, y: py }} bakgrunn={farge}>
        <g fill="none" stroke={GEO.kote} strokeLinejoin="round">
          {biter.map((bt, i) => (
            <path key={i} d={bt.d} strokeWidth={bt.tykk ? 2.6 : 1.3} />
          ))}
        </g>
      </Lupe>
      {a && c && ka && L > 4 && (
        <g>
          <Dimension x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} label={`${fmt(ka.d, 0)} m`} labelSize={0.72} />
          {[tallUnder, tallOver].map(
            (t, i) =>
              t && (
                <Txt key={i} x={t.x} y={t.y} size={0.66} weight={650} color={GEO.kote}>
                  {t.tekst}
                </Txt>
              ),
          )}
        </g>
      )}
      <circle cx={lx} cy={ly} r={3.2 * k} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2} />
    </g>
  );
}

/** Et rektangel [x0, y0, x1, y1] i figuren. */
type Boks = [number, number, number, number];

/**
 * Midten av P-etiketten: vinkelrett ut fra linja (først på den ene siden, så den andre, så skrått), der den ikke
 * overlapper hindringene og holder seg innenfor rammen.
 */
function pEtikett(px: number, py: number, nx: number, ny: number, hindre: readonly Boks[], f: number, k: number, ramme: Boks, ring = 0): P {
  const h = 17 * 0.92 * f;
  const w = h * 0.75;
  const d = Math.max(9 * k + h * 0.6, ring + 3 + h * 0.55);
  const retninger: P[] = [
    [nx, ny],
    [-nx, -ny],
    [nx + ny, ny - nx],
    [nx - ny, ny + nx],
    [-nx + ny, -ny - nx],
    [-nx - ny, -ny + nx],
  ];
  const kandidater = retninger.map(([a, c]): P => {
    const l = Math.hypot(a, c) || 1;
    return [px + (a / l) * d, py + (c / l) * d];
  });
  const ledig = ([cx, cy]: P) => {
    const bx: Boks = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
    if (bx[0] < ramme[0] + 2 || bx[1] < ramme[1] + 2 || bx[2] > ramme[2] - 2 || bx[3] > ramme[3] - 2) return false;
    return !hindre.some((o) => bx[0] < o[2] && o[0] < bx[2] && bx[1] < o[3] && o[1] < bx[3]);
  };
  const fri = kandidater.find(ledig);
  if (fri) return fri;
  // Ingen ledig plass: den som dekker minst (og helst er inne i kartet)
  const dekker = ([cx, cy]: P) =>
    hindre.reduce((sum, o) => sum + Math.max(0, Math.min(cx + w / 2, o[2]) - Math.max(cx - w / 2, o[0])) * Math.max(0, Math.min(cy + h / 2, o[3]) - Math.max(cy - h / 2, o[1])), 0) +
    (cx - w / 2 < ramme[0] + 2 || cx + w / 2 > ramme[2] - 2 || cy - h / 2 < ramme[1] + 2 || cy + h / 2 > ramme[3] - 2 ? 1e6 : 0);
  return kandidater.reduce((a, c) => (dekker(c) < dekker(a) ? c : a), kandidater[0]!);
}

/** Punktet P: ring med prikk og bokstaven P (samme merke på kartet og i profilet). */
function PunktP({ x, y, etikett }: { x: number; y: number; etikett?: P }) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const [tx, ty] = etikett ?? [x + 11 * k + 5 * f, y - 9 * k - 5 * f];
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={7.5 * k} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2.4 * ss} />
      <circle cx={x} cy={y} r={2.6 * k} fill={VIZ.ink} />
      <Txt x={tx} y={ty + 17 * 0.92 * f * 0.35} size={0.92} weight={750}>
        P
      </Txt>
    </g>
  );
}

/**
 * Gjennomsiktig flate eleven peker på (til P). Med mus kan P dras; med berøring velger et trykk punktet, så siden
 * fortsatt kan rulles (som `PickArea` i fysikk/kap01/gult-lys-graf.tsx).
 */
function PekeFlate({ x, y, w, h, label, onPek }: { x: number; y: number; w: number; h: number; label: string; onPek: (fx: number, fy: number) => void }) {
  const drar = useRef(false);
  const sisteType = useRef('');
  const pek = (e: ReactPointerEvent<SVGRectElement> | ReactMouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) onPek(p.x, p.y);
  };
  return (
    <rect
      x={x}
      y={y}
      width={Math.max(0, w)}
      height={Math.max(0, h)}
      fill="transparent"
      aria-label={label}
      style={{ cursor: 'crosshair' }}
      onPointerDown={(e) => {
        sisteType.current = e.pointerType;
        if (e.pointerType !== 'mouse') return;
        drar.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pek(e);
      }}
      onPointerMove={(e) => {
        if (drar.current) pek(e);
      }}
      onPointerUp={() => {
        drar.current = false;
      }}
      onPointerCancel={() => {
        drar.current = false;
      }}
      onClick={(e) => {
        if (sisteType.current === 'mouse') return;
        pek(e);
      }}
    />
  );
}

/* ================================================================================================ Profilet */

/**
 * Terrengprofilet langs A–B med nøyaktig overhøyde (kit-ets `Profildiagram` med `tilpass`): plottet fyller bredden når
 * profilet får plass i høyden, og blir smalere (mindre målestokk, samme overhøyde) når overhøyden er så stor at profilet
 * ellers ville gått ut av plottet. Langvatnet tegnes av Profildiagram (`innsjoer`), med samme vann som på kartet.
 * Overhøyden står i bildeteksten, ikke i plottet, der den ville kollidert med A og B når plottet blir smalt.
 */
const Profilfigur = memo(function Profilfigur({ felt, faste, b, H, onVelgT }: { felt: Hoydefelt; faste: Faste; b: Beregning; H: number; onVelgT: (t: number) => void }) {
  return (
    <Profildiagram felt={felt} A={b.linje.A} B={b.linje.B} width={800} height={H} overhoyde={b.overhoyde} tilpass visOverhoyde={false} innsjoer={faste.innsjoer}>
      {(s) => <Profiltillegg s={s} b={b} onVelgT={onVelgT} />}
    </Profildiagram>
  );
});

/** Det som tegnes oppå profilet: kotekrysningene, elvene, P og flata eleven peker på. */
function Profiltillegg({ s, b, onVelgT }: { s: LogPlotSkalaer; b: Beregning; onVelgT: (t: number) => void }) {
  const k = useGeoScale();
  const ss = useGeoStroke();
  const f = useTextScale();
  const { sx, sy, x0, x1, y0, y1, clip } = s;
  const L = b.linje.lengde;

  const pX = sx(b.sP);
  const pY = b.zP === null ? NaN : sy(b.zP);
  const navnPx = 17 * 0.68 * f;
  return (
    <g>
      <g clipPath={clip}>
        {/* Kotekrysningene: et merke på profilet for hver kote linja krysser, som når profilet tegnes for hånd */}
        {b.kryss.map((kr, i) => (
          <circle key={i} cx={sx(kr.s)} cy={sy(kr.hoyde)} r={(kr.tykk ? 3.4 : 2.4) * k} fill={kr.tykk ? VIZ.ink : VIZ.surface} stroke={VIZ.ink} strokeWidth={1.3 * ss} />
        ))}
        {/* P: loddrett hjelpelinje ned til avstandsaksen */}
        {Number.isFinite(pY) && <line x1={pX} x2={pX} y1={pY} y2={y0} stroke={VIZ.ink} strokeWidth={1.2 * ss} strokeDasharray={`${4 * ss} ${4 * ss}`} opacity={0.7} />}
      </g>
      {/* Elvene der profilet krysser dem (ikke inne i vannet, der elva bare renner gjennom) */}
      {elvEtiketter(b, s, navnPx, k, [pX - 12 * k, pY - 12 * k - 17 * 0.92 * f, pX + 12 * k + 17 * 0.92 * f, pY + 12 * k]).map((e, i) => (
        <g key={i} pointerEvents="none">
          <polygon points={`${e.x},${e.y - 3 * k} ${e.x - 5 * k},${e.y - 12 * k} ${e.x + 5 * k},${e.y - 12 * k}`} fill={VANN_LINJE} />
          {e.tekst && e.rad > 0 && <line x1={e.x} x2={e.x} y1={e.y - 12 * k} y2={e.ty + 3} stroke={VANN_LINJE} strokeWidth={1 * ss} />}
          {e.tekst && (
            <Txt x={e.tx} y={e.ty} anchor={e.anchor} size={0.68} weight={650} color={VANN_LINJE}>
              {e.navn}
            </Txt>
          )}
        </g>
      ))}
      <PekeFlate x={x0} y={y1} w={x1 - x0} h={y0 - y1} label="Terrengprofilet" onPek={(fx) => onVelgT(L > 0 ? Math.min(1, Math.max(0, s.ix(fx) / L)) : 0)} />
      {/* P-etiketten skrått over punktet, på den siden der terrenget faller (så den ikke havner på profillinja) */}
      <PunktP x={pX} y={pY} etikett={profilEtikett(pX, pY, b.langs ?? 0, x0, x1, f, k)} />
    </g>
  );
}

/** Midten av P-etiketten i profilet: opp og ut til den siden terrenget heller ned mot, innenfor plottet. */
function profilEtikett(x: number, y: number, langs: number, x0: number, x1: number, f: number, k: number): P {
  const h = 17 * 0.92 * f;
  const dx = 9 * k + h * 0.5;
  let side = langs > 0 ? -1 : 1;
  if (x + side * (dx + h) > x1) side = -1;
  if (x + side * (dx + h) < x0) side = 1;
  return [x + side * dx, y - 9 * k - h * 0.45];
}

/** Plassen til elvenavnene over profilet: over kryssingen, og en rad høyere når to navn ellers ville overlappet. */
function elvEtiketter(b: Beregning, s: LogPlotSkalaer, navnPx: number, k: number, hindring?: Boks) {
  const ut: { x: number; y: number; tx: number; ty: number; rad: number; anchor: 'start' | 'middle' | 'end'; navn: string; tekst: boolean; boks: Boks }[] = [];
  for (const e of b.elvKryss) {
    if (b.vann.some(([a, c]) => e.s >= a - 15 && e.s <= c + 15)) continue;
    const z = hoydeVedProfil(b.prof, e.s);
    if (z === null) continue;
    const x = s.sx(e.s);
    const y = s.sy(z);
    // Krysser linja samme elv flere ganger like ved hverandre (elva slynger seg), får den navnet bare én gang
    const navngitt = ut.some((o) => o.navn === e.navn && o.tekst && Math.abs(o.x - x) < 70);
    const w = tekstBredde(e.navn, navnPx);
    const anchor = x + w / 2 > s.x1 ? 'end' : x - w / 2 < s.x0 ? 'start' : 'middle';
    const venstre = anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2;
    if (navngitt) {
      ut.push({ x, y, tx: x, ty: y, rad: 0, anchor, navn: e.navn, tekst: false, boks: [x, y, x, y] });
      continue;
    }
    let rad = 0;
    let boks: Boks = [venstre - 3, 0, venstre + w + 3, 0];
    for (; rad < 4; rad++) {
      const ty = y - 16 * k - rad * navnPx * 1.25;
      boks = [venstre - 3, ty - navnPx * 0.85, venstre + w + 3, ty + navnPx * 0.3];
      const over = (o: Boks) => boks[0] < o[2] && o[0] < boks[2] && boks[1] < o[3] && o[1] < boks[3];
      if (!ut.some((o) => over(o.boks)) && !(hindring && over(hindring))) break;
    }
    ut.push({ x, y, tx: x, ty: y - 16 * k - rad * navnPx * 1.25, rad, anchor, navn: e.navn, tekst: true, boks });
  }
  return ut;
}

/** Høyden i profilet ved avstanden s fra A (lineært mellom profilpunktene). */
function hoydeVedProfil(prof: readonly ProfilPunkt[], s: number): number | null {
  if (prof.length < 2 || !Number.isFinite(s)) return null;
  const i = prof.findIndex((p) => p.s >= s);
  if (i < 0) return prof[prof.length - 1]!.z;
  if (i === 0) return prof[0]!.z;
  const a = prof[i - 1]!;
  const c = prof[i]!;
  const t = c.s > a.s ? (s - a.s) / (c.s - a.s) : 0;
  return a.z + (c.z - a.z) * t;
}

/* ================================================================================================ Tekst */

function kartTekst(b: Beregning, faste: Faste): string {
  return `Kotekart over et tenkt landskap med ${STEDER.topp.navn} (${fmt(faste.topp.z, 0)} m o.h.), ${STEDER.vann.navn}, ${STEDER.elv.navn} og ${STEDER.bekk.navn}. Profillinja går ${fmtAvstand(b.linje.lengde)} fra A mot ${kompassretning(b.linje.lengde > 0 ? retningAv(b.linje) : 0)}, og P ligger ${b.zP === null ? '' : `${fmt(b.zP, 0)} m o.h.`}`;
}

function profilTekst(b: Beregning): string {
  return `Terrengprofil fra A til B med overhøyde ${fmt(b.overhoyde, 0)}: fra ${fmt(b.zMin, 0)} til ${fmt(b.zMax, 0)} m o.h. over ${fmtAvstand(b.linje.lengde)}.`;
}

/** Kompassretningen fra A mot B i grader. */
function retningAv(linje: Profillinje): number {
  return ((Math.atan2(linje.B[0] - linje.A[0], -(linje.B[1] - linje.A[1])) * 180) / Math.PI + 360) % 360;
}

const BRATT_TEKST = {
  flatt: 'Terrenget er nesten flatt her',
  slakt: 'Terrenget er slakt her',
  middels: 'Terrenget er middels bratt her',
  bratt: 'Terrenget er bratt her',
  skredterreng: 'Terrenget er svært bratt her',
} as const;

/** Forklaringen under figurene, som endrer seg med valgene. */
function forklaring(b: Beregning, faste: Faste, visFelt: boolean, lupe: boolean): ReactNode {
  const avsnitt: ReactNode[] = [];
  const ekv = fmt(b.ekv, 0);

  // Punktet P
  if (b.iVann) {
    avsnitt.push(
      <p key="p">
        P ligger i {STEDER.vann.navn}, og vannflata ligger {b.zP === null ? '–' : fmt(b.zP, 0)} m o.h. Kartet viser ingen koter under vannet, så hvor dypt det er, må måles med lodd eller ekkolodd (profilet viser bunnen i det tenkte landskapet).
      </p>,
    );
  } else if (b.h) {
    const klasse = brattklasse(b.h.grader) ?? 'flatt';
    const kotene = b.ka
      ? `Kotene ved P ligger ca. ${fmt(b.ka.d, 0)} m fra hverandre${lupe ? ` (lupa: fra koten på ${fmt(b.ka.under, 0)} m til koten på ${fmt(b.ka.over, 0)} m, målt rett på kotene)` : ' (målt rett på kotene)'}, og hver kote er ${ekv} m høyere enn den forrige.`
      : `Det er langt til nærmeste kote på minst én side av P, så terrenget heller lite.`;
    const tett = klasse === 'flatt' || klasse === 'slakt' ? 'Langt mellom kotene betyr slakt terreng.' : 'Tette koter betyr bratt terreng: samme høydeforskjell på kortere vei.';
    const skred = klasse === 'skredterreng' ? ' Brattere enn ca. 30° er det terreng der snøskred kan løsne, så slike lier står på aktsomhetskartene for snøskred.' : '';
    avsnitt.push(
      <p key="p">
        {BRATT_TEKST[klasse]}: {fmt(b.h.grader, 0)}° eller {fmt(b.h.prosent, 0)} %. {kotene} {tett}
        {skred}
      </p>,
    );
  }

  // Profilet og overhøyden
  const vist = b.langs !== null && b.overhoyde > 1 ? vistVinkel(b.langs, b.overhoyde) : null;
  const langsTekst =
    b.langs !== null && Math.abs(b.langs) >= 1 && vist !== null
      ? ` Ved P heller terrenget ${fmt(Math.abs(b.langs), 0)}° langs linja, men i profilet ser det ut som ${fmt(Math.abs(vist), 0)}°.`
      : '';
  avsnitt.push(
    <p key="o">
      Profilet går fra {fmt(b.zMin, 0)} til {fmt(b.zMax, 0)} m o.h. over {fmtAvstand(b.linje.lengde)}.{' '}
      {b.overhoyde === 1
        ? 'Uten overhøyde er høydene og lengdene tegnet i samme målestokk, og selv bratte lier ser slake ut: et landskap er mye lengre enn det er høyt.'
        : `Med overhøyde ${fmt(b.overhoyde, 0)} er høydene strukket ${fmt(b.overhoyde, 0)} ganger, så formene synes bedre, men alle skråninger ser brattere ut enn de er.${langsTekst}`}{' '}
      Hvert merke på linja er en kote den krysser. Slik tegner du profilet for hånd: legg en papirstrimmel langs A–B, merk av kotene med høyden, og overfør merkene til et rutenett med høyden oppover.
    </p>,
  );

  // Elva og nedbørfeltet
  const elvTekst = `Der ${STEDER.elv.navn} og ${STEDER.bekk.navn} renner, danner kotene en V som peker oppover dalen, mot høyere terreng: elva har gravd seg ned, så kotene må gå et stykke oppover dalen før de kan krysse den.`;
  const feltTekst = visFelt
    ? ` Vannskillet (stiplet) går langs toppene og ryggene. Alt regn og smeltevann innenfor renner til ${STEDER.elv.navn} der den forlater kartet: nedbørfeltet er ca. ${faste.areal === null ? '–' : fmt(faste.areal, 1)} km². Jo større nedbørfelt, desto mer vann kan elva få i en flom.`
    : ' Slå på nedbørfeltet for å se vannskillet: grensen mellom vannet som renner til elva, og vannet som renner andre veier.';
  avsnitt.push(
    <p key="e">
      {elvTekst}
      {feltTekst}
    </p>,
  );
  return <>{avsnitt}</>;
}
