import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  FlateForklaring,
  Formula,
  FormulaLine,
  GEO,
  PLATE_BREDDE_KM,
  PlayBar,
  Plategrense,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  TETTHETER,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtAlder,
  fmtTall,
  havbunnsalder,
  magnetiskeStriper,
  plategrenseGeometri,
  tekstBredde,
  useContainerTextScale,
  useSimClock,
  useSvgId,
  useTextScale,
  type FlateForklaringPunkt,
  type PlateAnker,
  type PlateBoks,
  type PlategrenseGeometri,
  type PlategrenseProps,
  type PlategrenseType,
  type SubduksjonVariant,
} from '../kit';
import { Callout, ForceArrow, Himmel, LinearGradient, ValueTag } from '../../kit/scene';
import {
  AVSPILLING,
  DYP_KOEFFISIENT,
  GRENSE_TYPER,
  KM_PER_MA,
  KRAFT_FORHOLD,
  PLUME_TEMPERATUR,
  POTENSIELL_TEMPERATUR,
  RYGG_DYP,
  fjellkjede,
  havdybde,
  lengdeTilDyp,
  plateavstand,
  platePunktVed,
  skjelvdybder,
  smeltestart,
  tidTilDyp,
  vulkanAlder,
} from './model-plategrenser';
import {
  HavProfil,
  KJEDE_AVSTAND,
  KollisjonSnitt,
  SmelteDiagram,
  SubduksjonSnitt,
  VulkankjedeDiagram,
  havProfilHoyde,
  kjedeHoyde,
  kollisjonHoyde,
  smelteForklaring,
  smelteHoyde,
  subduksjonHoyde,
  subduksjonOverdrivelse,
} from './plategrenser-deler';

const TYPER: { value: PlategrenseType; label: string }[] = [
  { value: 'spredning', label: 'Spredningsrygg' },
  { value: 'subduksjon', label: 'Subduksjon' },
  { value: 'kollisjon', label: 'Kollisjon' },
  { value: 'transform', label: 'Transformforkastning' },
  { value: 'varmt-punkt', label: 'Varmt punkt (inne på en plate)' },
];

const VARIANTER: { value: SubduksjonVariant; label: string }[] = [
  { value: 'hav-kontinent', label: 'Hav mot kontinent' },
  { value: 'hav-hav', label: 'Hav mot hav' },
];

const B = 800;
const MARG = 14;
const TETTHET_MANTEL = TETTHETER.mantel;

/** Halve bredden på spredningsblokka (km): ryggen står midt i. */
const KANT_KM = PLATE_BREDDE_KM.spredning / 2;

const r2 = (v: number): number => Math.round(v * 100) / 100;
const tall = (v: number | null | undefined, d = 0): string => (v === null || v === undefined || !Number.isFinite(v) ? '–' : fmt(v, d));
const tallT = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? '–' : fmtTall(Math.round(v)));
const fartTekst = (v: number): string => fmt(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
/** Halve farten: 2 → «2», 2,5 → «2,5», 0,75 → «0,75». */
const halvTekst = (v: number): string => fmt(v, Number.isInteger(Math.round(v * 100) / 100) ? 0 : Number.isInteger(Math.round(v * 1000) / 100) ? 1 : 2);

/** Navnet med ubestemt artikkel: «en spredningsrygg», «et varmt punkt». */
function medArtikkel(type: PlategrenseType): string {
  return `${type === 'varmt-punkt' ? 'et' : 'en'} ${GRENSE_TYPER[type].navn.toLowerCase()}`;
}

/** Teksten ved avspillingen: spredning og transform viser de siste 5 millioner årene fram til i dag. */
function tidTekst(type: PlategrenseType, t: number, tMax: number): string {
  if (type === 'spredning' || type === 'transform') {
    const siden = Math.max(0, tMax - t);
    return siden < 0.05 ? 'I dag' : `For ${fmtAlder(siden, { siden: true, enhet: 'millioner', desimaler: 1 })}`;
  }
  if (type === 'kollisjon') return t < 0.05 ? 'Kontinentene møtes' : `${fmtAlder(t, { enhet: 'millioner', desimaler: 0 })} etter at kontinentene møttes`;
  return t < 0.05 ? 'Start' : `Etter ${fmtAlder(t, { enhet: 'millioner', desimaler: 1 })}`;
}

/**
 * «Platene beveger seg: rygg, grop og fjellkjede» (k2-plategrenser, Geofag 1 tema 2, deltema 2.2 og 2.3): et
 * blokkdiagram av en plategrense (kit-ets `Plategrense`) der eleven velger type, setter platefarten og spiller av
 * millioner av år, med et diagram under som viser det blokka ikke kan vise i målestokk: havdypet bort fra ryggen,
 * plata og jordskjelvene i en subduksjonssone, fjellkjeden og fjellroten ved en kollisjon, vulkankjeden over et varmt
 * punkt, eller (med «Hvor smelter det?») temperatur og smeltepunkt mot dypet. Referansevisualisering for geofag-kit-et.
 */
export default function Plategrenser() {
  const [type, setType] = useState<PlategrenseType>('spredning');
  const [variant, setVariant] = useState<SubduksjonVariant>('hav-kontinent');
  const [fart, setFart] = useState(4);
  const [krefter, setKrefter] = useState(false);
  const [smelting, setSmelting] = useState(false);
  const tMax = AVSPILLING[type];
  const clock = useSimClock({ tMax, speed: tMax / 8 });
  const { setT, pause } = clock;
  // Figuren viser i dag (slutten av avspillingen) til eleven trykker «Spill av», som starter fra begynnelsen.
  useLayoutEffect(() => {
    pause();
    setT(tMax);
  }, [type, tMax, setT, pause]);
  const t = Math.min(Math.max(0, clock.t), tMax);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const kjede = fjellkjede(fart, type === 'kollisjon' ? t : 0);

  const fartEtikett: Record<PlategrenseType, string> = {
    spredning: 'Spredningsfart (platene fra hverandre)',
    subduksjon: 'Platefart (platene mot hverandre)',
    kollisjon: 'Platefart (platene mot hverandre)',
    transform: 'Platefart (platene forbi hverandre)',
    'varmt-punkt': 'Platefart over det varme punktet',
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg type plategrense" options={TYPER} value={type} onChange={setType} />
      </Toolbar>
      {type === 'subduksjon' && (
        <Toolbar>
          <Segmented label="Hvilke plater møtes" options={VARIANTER} value={variant} onChange={setVariant} />
        </Toolbar>
      )}
      <Controls>
        <Slider
          label={fartEtikett[type]}
          value={fart}
          onChange={setFart}
          min={1}
          max={10}
          step={0.5}
          unit="cm/år"
          decimals={1}
        />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={tidTekst(type, t, tMax)} />
        <Toggle label="Vis krefter" checked={krefter} onChange={setKrefter} />
        <Toggle label="Hvor smelter det?" checked={smelting} onChange={setSmelting} />
      </Toolbar>

      <div ref={ref}>
        <Scene type={type} variant={variant} fart={fart} t={t} krefter={krefter} smelting={smelting} f={f} />
      </div>
      <FlateForklaring items={sceneForklaring(type, krefter)} />

      {smelting ? (
        <>
          <Figure
            viewBox={`0 0 ${B} ${smelteHoyde(f)}`}
            label={`Temperatur og smeltepunkt mot dypet under ${medArtikkel(type)}.`}
            caption="Forenklede, omtrentlige kurver. Der temperaturen er høyere enn smeltepunktet, smelter en liten del av mantelen."
          >
            <SmelteDiagram type={type} height={smelteHoyde(f)} />
          </Figure>
          <FlateForklaring items={smelteForklaring(type)} />
        </>
      ) : (
        <Diagram type={type} variant={variant} fart={fart} t={t} tMax={tMax} f={f} />
      )}

      <Readouts>{maalinger(type, variant, fart, t)}</Readouts>
      <Formula label="Utregning">{utregning(type, variant, fart, t)}</Formula>
      <Explain>{forklaring({ type, variant, fart, t, tMax, krefter, smelting, kjedeHoyde: kjede?.hoyde ?? null, tykkelse: kjede?.tykkelse ?? null })}</Explain>
    </VizLayout>
  );
}

/* =====================================================================================================================
 * Blokka
 * ================================================================================================================== */

type BlokkGrunnlag = Omit<PlategrenseProps, 'x' | 'y' | 'w' | 'h' | 'children'>;

/** Plasserer blokka så den fyller bredden, med `topp` enheter fri plass øverst, og gir viewBox-høyden. */
function oppsett(base: BlokkGrunnlag, f: number, topp: number) {
  const hAndel = (base.type === 'transform' ? 0.46 : 0.42) * (1 + 0.24 * Math.max(0, f - 1));
  const x = MARG;
  let w = B - 2 * MARG;
  let g = plategrenseGeometri({ ...base, x, y: 0, w, h: w * hAndel }, f);
  if (g && g.dx > 0) {
    w = B - 2 * MARG - g.dx;
    g = plategrenseGeometri({ ...base, x, y: 0, w, h: w * hAndel }, f);
  }
  const h = w * hAndel;
  const y = topp - (g?.ramme.y0 ?? 0);
  const H = Math.round((g ? g.ramme.y1 - g.ramme.y0 : h) + topp + 10);
  return { props: { ...base, x, y, w, h } as PlategrenseProps, H };
}

interface SceneProps {
  type: PlategrenseType;
  variant: SubduksjonVariant;
  fart: number;
  t: number;
  krefter: boolean;
  smelting: boolean;
  f: number;
}

/** Høyden på etiketten over figuren («Konstruktiv (divergerende) plategrense»). */
const overskriftHoyde = (f: number): number => Math.round(17 * 0.84 * f * 1.3 + 8);

/** Plass over blokka til etiketten med fagordene og merknaden om stripene (spredning). */
function toppPlass(type: PlategrenseType, f: number): number {
  const linje = 17 * 0.74 * f * 1.3;
  return overskriftHoyde(f) + (type === 'spredning' ? Math.round(linje + 14) : 10);
}

function Scene({ type, variant, fart, t, krefter, smelting, f }: SceneProps) {
  const base: BlokkGrunnlag = { type, variant, fart, t, striper: type === 'spredning' || type === 'transform', etiketter: true };
  const topp = toppPlass(type, f);
  const { props, H } = oppsett(base, f, topp);
  const g0 = plategrenseGeometri(props, f);
  const horisont = g0 && type !== 'transform' ? (g0.havniva ?? g0.profil(g0.x + 1)) - g0.dy + 1 : null;
  const info = GRENSE_TYPER[type];
  return (
    <Figure
      viewBox={`0 0 ${B} ${H}`}
      maxHeight={Math.round(H * 1.05)}
      label={`Blokkdiagram av ${medArtikkel(type)}: ${info.bevegelse} Platefart ${fartTekst(fart)} cm per år.`}
      caption={type === 'transform' ? 'Sett ovenfra, som et kart over havbunnen.' : 'Loddrett er ikke i målestokk: litosfæren og skorpa er tegnet mye tykkere enn de er.'}
    >
      {horisont !== null && g0 && <Himmelstripe y={Math.max(0, horisont - 2.4 * g0.dy)} h={horisont - Math.max(0, horisont - 2.4 * g0.dy)} />}
      <Txt x={MARG} y={r2(overskriftHoyde(f) - 8)} anchor="start" size={0.84} weight={700}>
        {info.etikett}
      </Txt>
      <Plategrense {...props}>{(g) => <Overlegg g={g} type={type} fart={fart} t={t} krefter={krefter} smelting={smelting} topp={topp} />}</Plategrense>
    </Figure>
  );
}

/** En smal stripe himmel bak blokka, tonet ut oppover (ingen hard kant i lufta). */
function Himmelstripe({ y, h }: { y: number; h: number }) {
  const ned = useSvgId('himmel-ned');
  return (
    <g transform={`translate(0 ${r2(y)})`}>
      <Himmel x={0} y={0} w={B} h={r2(h)} />
      <LinearGradient
        id={ned}
        stops={[
          [0, VIZ.surface, 1],
          [0.5, VIZ.surface, 0],
        ]}
      />
      <rect x={0} y={0} width={B} height={r2(h)} fill={`url(#${ned})`} />
    </g>
  );
}

type Boks = Pick<PlateBoks, 'x0' | 'y0' | 'x1' | 'y1'>;

/** Boksen en tekst tar med grunnlinje `y` (samme mål som Txt: 17 · size · f). */
function tekstBoks(x: number, y: number, tekst: string, size: number, f: number, anchor: 'start' | 'middle' | 'end'): Boks {
  const fs = 17 * size * f;
  const b = tekstBredde(tekst, fs);
  const x0 = anchor === 'end' ? x - b : anchor === 'middle' ? x - b / 2 : x;
  return { x0: x0 - 3, y0: y - fs * 0.9, x1: x0 + b + 3, y1: y + fs * 0.3 };
}

const overlapper = (a: Boks, b: Boks): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** En kraftpil fra et ankerpunkt i retningen ankeret gir, med etikett ved pila. */
interface Kraftpil {
  key: string;
  anker: PlateAnker;
  lengde: number;
  farge: string;
  etikett: string;
  stiplet?: boolean;
}

/** Det visualiseringen tegner oppå blokka: kraftpiler, merknader om smelting og stripene. */
function Overlegg({ g, type, fart, t, krefter, smelting, topp }: { g: PlategrenseGeometri; type: PlategrenseType; fart: number; t: number; krefter: boolean; smelting: boolean; topp: number }) {
  const f = useTextScale();
  const smal = f > 1.35;
  // Kit-et velger kraftankrene så en pil på inntil 0,11 · w med etikett ved spissen er fri for lagnavn og fartspiler.
  const L = 0.055 * g.w;
  const LS = 0.72;
  const a = g.ankere;
  const ka = g.kraftankre;
  const deler: ReactNode[] = [];

  // Merknad: stripene vises bare for de siste 5 millioner årene
  if (type === 'spredning') {
    const st = magnetiskeStriper(fart, t);
    const ytterst = st.length > 0 ? st[st.length - 1]!.til / g.kmPerPx : 0;
    const xr = g.x + g.w / 2;
    if (g.w / 2 - ytterst > 30) {
      const x = xr - (ytterst + g.w / 2) / 2;
      deler.push(
        <Callout key="striper" x={r2(x)} y={r2(g.profil(x) + 2)} lx={r2(Math.max(g.x + 4, x - 12))} ly={r2(topp - 8)} anchor="start" size={0.74}>
          {smal ? 'Eldre havbunn: stripene vises ikke' : 'Eldre havbunn: stripene fortsetter, men vises ikke her'}
        </Callout>,
      );
    }
  }

  // Kraftpilene fra kit-ets kraftankre (fri for kit-ets lagnavn og fartspiler)
  const piler: Kraftpil[] = [];
  if (krefter) {
    if (type === 'spredning') {
      for (const n of ['ryggskyvVenstre', 'ryggskyvHoyre'] as const) {
        const p = ka[n];
        if (p?.retning) piler.push({ key: n, anker: p, lengde: L * KRAFT_FORHOLD.ryggskyv, farge: VIZ.applied, etikett: 'Ryggskyv' });
      }
    }
    if (type === 'subduksjon' && ka.platetrekk?.retning) {
      piler.push({ key: 'trekk', anker: ka.platetrekk, lengde: L * KRAFT_FORHOLD.platetrekk, farge: VIZ.gravity, etikett: 'Platetrekk' });
    }
    if (type === 'kollisjon') {
      for (const n of ['kollisjonVenstre', 'kollisjonHoyre'] as const) {
        const p = ka[n];
        if (p?.retning) piler.push({ key: n, anker: p, lengde: L * 1.4, farge: VIZ.applied, etikett: 'Skyv' });
      }
    }
    if (type === 'varmt-punkt' && ka.plateVenstre) {
      // Trekket virker på hele plata langt unna: pila står helt til høyre, midt i litosfæren (fri for vulkaner, plumen
      // og etiketter), og peker samme vei som plata flytter seg.
      const x = g.x + 0.985 * g.w;
      const anker: PlateAnker = { x, y: 0.62 * (a.plateVenstre ?? ka.plateVenstre).y + 0.38 * g.profil(x), retning: [-1, 0] };
      piler.push({ key: 'trekk', anker, lengde: L * 1.9, farge: VIZ.gravity, etikett: 'Platetrekk', stiplet: true });
    }
  }

  // Flatene som allerede er tatt (kit-ets lagnavn og fartspiler, kraftpilene og etikettene), så merknadene holder seg unna
  const hindre: Boks[] = [...g.opptatt];
  const inne = (b: Boks) => b.x0 >= g.x + 2 && b.x1 <= g.x + g.w - 2 && b.y0 >= g.y + 4 && b.y1 <= g.y + g.h - 2;
  for (const p of piler) {
    const [ux, uy] = p.anker.retning ?? [1, 0];
    const x2 = p.anker.x + p.lengde * ux;
    const y2 = p.anker.y + p.lengde * uy;
    // Etiketten over en vannrett pil (der kit-et har holdt plass fri) og ved spissen av en skrå
    const vannrett = Math.abs(uy) < 0.35;
    const anchor: 'start' | 'middle' | 'end' = vannrett ? 'middle' : ux >= 0 ? 'start' : 'end';
    const lx = vannrett ? (p.anker.x + x2) / 2 : x2 + (ux >= 0 ? 8 : -8);
    const ly = vannrett ? Math.min(p.anker.y, y2) - 8 : y2 + 6;
    hindre.push({ x0: Math.min(p.anker.x, x2) - 8, y0: Math.min(p.anker.y, y2) - 8, x1: Math.max(p.anker.x, x2) + 8, y1: Math.max(p.anker.y, y2) + 8 });
    // På smal skjerm vises etiketten bare når den får plass inne i blokka uten å dekke noe; fargeforklaringen har navnet
    const boks = tekstBoks(lx, ly, p.etikett, LS, f, anchor);
    const visEtikett = !smal || (inne(boks) && !hindre.some((h) => overlapper(boks, h)));
    if (visEtikett) hindre.push(boks);
    deler.push(
      <ForceArrow
        key={p.key}
        x1={r2(p.anker.x)}
        y1={r2(p.anker.y)}
        x2={r2(x2)}
        y2={r2(y2)}
        color={p.farge}
        width={6.5}
        dashed={p.stiplet}
        origin={!p.stiplet}
        label={visEtikett ? p.etikett : undefined}
        labelX={r2(lx)}
        labelY={r2(ly)}
        labelAnchor={anchor}
        labelSize={LS}
      />,
    );
  }

  /**
   * En merknad med strek til `punkt`: prøver kandidatene (grunnlinje og anker) i rekkefølge og velger den første der
   * teksten holder seg inne i blokka og fri for lagnavn, fartspiler, kraftpiler og etiketter.
   */
  const merknad = (key: string, punkt: { x: number; y: number }, tekst: string, kandidater: { lx: number; ly: number; anchor: 'start' | 'middle' | 'end' }[]) => {
    const valgt =
      kandidater.find((k) => {
        const b = tekstBoks(k.lx, k.ly, tekst, 0.74, f, k.anchor);
        return inne(b) && !hindre.some((h) => overlapper(b, h));
      }) ?? kandidater[0]!;
    hindre.push(tekstBoks(valgt.lx, valgt.ly, tekst, 0.74, f, valgt.anchor));
    deler.push(
      <Callout key={key} x={r2(punkt.x)} y={r2(punkt.y)} lx={r2(valgt.lx)} ly={r2(valgt.ly)} anchor={valgt.anchor} size={0.74}>
        {tekst}
      </Callout>,
    );
  };

  if (smelting) {
    if (type === 'spredning' && a.smeltesone) {
      const p = a.smeltesone;
      merknad('smelt', { x: p.x + 0.04 * g.w, y: p.y }, smal ? 'Smelter delvis' : 'Mantelen stiger og smelter delvis', [
        { lx: p.x + 0.16 * g.w, ly: g.y + 0.84 * g.h, anchor: 'start' },
        { lx: p.x + 0.12 * g.w, ly: g.y + 0.94 * g.h, anchor: 'start' },
        { lx: p.x - 0.16 * g.w, ly: g.y + 0.84 * g.h, anchor: 'end' },
      ]);
    }
    if (type === 'subduksjon' && a.smeltesone) {
      // Til høyre over mantelkilen, unna platetrekket, vulkanen og lagnavnene
      const p = a.smeltesone;
      const kile = a.mantelkile ?? p;
      const hoyre = g.x + g.w - 6;
      const y0 = Math.min(kile.y, p.y);
      merknad('smelt', p, smal ? 'Vann gir smelting' : 'Vann fra plata gir smelting', [
        { lx: hoyre, ly: y0 - 8 * f, anchor: 'end' },
        { lx: hoyre, ly: y0 + 14 * f, anchor: 'end' },
        { lx: hoyre, ly: y0 - 30 * f, anchor: 'end' },
        { lx: hoyre, ly: kile.y + 30 * f, anchor: 'end' },
        { lx: p.x + 0.09 * g.w, ly: g.y + 0.88 * g.h, anchor: 'start' },
        { lx: p.x - 0.06 * g.w, ly: g.y + 0.96 * g.h, anchor: 'end' },
      ]);
    }
    if (type === 'varmt-punkt' && a.varmtPunkt) {
      const p = a.varmtPunkt;
      merknad('smelt', { x: p.x - 0.06 * g.w, y: p.y }, 'Plumen smelter delvis', [
        { lx: p.x - 0.2 * g.w, ly: g.y + (smal ? 0.74 : 0.86) * g.h, anchor: 'end' },
        { lx: p.x - 0.2 * g.w, ly: g.y + 0.95 * g.h, anchor: 'end' },
        { lx: p.x - 0.12 * g.w, ly: g.y + 0.66 * g.h, anchor: 'end' },
      ]);
    }
    if (type === 'kollisjon' && a.fjellrot) {
      deler.push(<ValueTag key="smelt" x={r2(a.fjellrot.x + 0.08 * g.w)} y={r2(g.y + 0.88 * g.h)} text="Lite smelting her" size={0.74} />);
    }
    if (type === 'transform') {
      // Nederst på kartet: øverst står kit-ets «Spredningsrygg» og fartspilene
      deler.push(<ValueTag key="smelt" x={r2(g.x + 0.36 * g.w)} y={r2(g.y + g.h - (17 * f * 0.74 * 1.55) / 2 - 8)} text="Ingen smelting" size={0.74} />);
    }
  }
  return <g>{deler}</g>;
}

/** Forklaringen av fargene under blokka. */
function sceneForklaring(type: PlategrenseType, krefter: boolean): FlateForklaringPunkt[] {
  const items: FlateForklaringPunkt[] = [{ farge: VIZ.velocity, label: type === 'transform' ? 'Platebevegelse' : 'Platebevegelse og strømning i mantelen', form: 'linje' }];
  items.push({ farge: GEO.fare[1], label: 'Jordskjelv', form: 'stjerne' });
  if (type !== 'transform') items.push({ farge: GEO.magma, label: 'Magma og delvis smeltet mantel' });
  if (type === 'subduksjon') items.push({ farge: GEO.grunnvann.line, label: 'Vann fra plata', form: 'linje', stiplet: true });
  if (type === 'spredning' || type === 'transform') {
    items.push({ farge: GEO.polaritet.normal, label: 'Normal polaritet (som i dag)' });
    items.push({ farge: GEO.polaritet.omvendt, label: 'Omvendt polaritet' });
  }
  if (krefter) {
    if (type === 'spredning' || type === 'kollisjon') items.push({ farge: VIZ.applied, label: type === 'spredning' ? 'Ryggskyv' : 'Skyv bakfra', form: 'linje' });
    if (type === 'subduksjon' || type === 'varmt-punkt')
      items.push({ farge: VIZ.gravity, label: type === 'subduksjon' ? 'Platetrekk' : 'Platetrekk langt unna', form: 'linje', stiplet: type === 'varmt-punkt' });
  }
  return items;
}

/* =====================================================================================================================
 * Diagrammet under blokka
 * ================================================================================================================== */

function Diagram({ type, variant, fart, t, tMax, f }: { type: PlategrenseType; variant: SubduksjonVariant; fart: number; t: number; tMax: number; f: number }) {
  const kjede = useMemo(() => fjellkjede(fart, t), [fart, t]);
  // Vulkanene over det varme punktet, de samme som i blokka (alderen og hvilke som er aktive avhenger ikke av størrelsen)
  const vulkaner = useMemo(
    () => (type === 'varmt-punkt' ? (plategrenseGeometri({ type, fart, t, w: 1000, h: 420 })?.vulkaner ?? []) : []),
    [type, fart, t],
  );
  if (type === 'spredning') {
    const H = havProfilHoyde(f);
    return (
      <>
        <Figure
          viewBox={`0 0 ${B} ${H}`}
          label={`Havdypet mot avstanden fra ryggen ved ${fartTekst(fart)} cm per år: havbunnen blir eldre og dypere bort fra ryggen.`}
          caption="Havbunnen blir eldre og dypere bort fra ryggen. Høyden er sterkt overdrevet."
        >
          <HavProfil fart={fart} t={t} height={H} />
        </Figure>
      </>
    );
  }
  if (type === 'subduksjon') {
    const H = subduksjonHoyde(f);
    const s = plateavstand(fart, t) ?? 0;
    return (
      <>
        <Figure
          viewBox={`0 0 ${B} ${H}`}
          maxHeight={Math.round(H * 1.05)}
          label="Snitt i målestokk gjennom en subduksjonssone med jordskjelvene langs plata ned til ca. 700 km."
          caption={
            subduksjonOverdrivelse(f) > 1
              ? `Dypet er overdrevet ${fmt(subduksjonOverdrivelse(f), 1)} ganger. Hver stjerne er et jordskjelv.`
              : 'I målestokk (1 km bortover = 1 km nedover). Hver stjerne er et jordskjelv.'
          }
        >
          <SubduksjonSnitt variant={variant} s={s} andel={tMax > 0 ? t / tMax : 1} height={H} />
        </Figure>
        <FlateForklaring
          items={[
            { farge: GEO.fare[1], label: 'Jordskjelv', form: 'stjerne' },
            { farge: GEO.fare[3], label: 'De nyeste skjelvene (under avspilling)', form: 'stjerne' },
            { farge: VIZ.velocity, label: 'Havbunn som var i havgropa ved start', form: 'prikk' },
          ]}
        />
      </>
    );
  }
  if (type === 'kollisjon' && kjede) {
    const H = kollisjonHoyde(f);
    return (
      <Figure
        viewBox={`0 0 ${B} ${H}`}
        label={`Snitt gjennom en kollisjon: fjellkjede ca. ${tallT(kjede.hoyde)} m høy og fjellrot ${tall(kjede.rot)} km.`}
        caption="Høyden er overdrevet. Tykk skorpe flyter høyere, som et tykt isfjell: et lite fjell over og en stor rot under."
      >
        <KollisjonSnitt kjede={kjede} fart={fart} height={H} />
      </Figure>
    );
  }
  if (type === 'varmt-punkt') {
    const H = kjedeHoyde(f);
    return (
      <Figure
        viewBox={`0 0 ${B} ${H}`}
        label="Alderen på vulkanene mot avstanden fra det varme punktet."
        caption="Vulkanene i blokka: jo lenger fra det varme punktet, jo eldre. Helningen gir platefarten."
      >
        <VulkankjedeDiagram fart={fart} vulkaner={vulkaner} height={H} />
      </Figure>
    );
  }
  return null;
}

/* =====================================================================================================================
 * Tall, utregning og forklaring
 * ================================================================================================================== */

function maalinger(type: PlategrenseType, variant: SubduksjonVariant, fart: number, t: number): ReactNode {
  const halv = fart / 2;
  const skjelv = skjelvdybder(type);
  const skjelvTekst = skjelv.maks >= 700 ? '0–700' : `0–${skjelv.maks}`;
  if (type === 'spredning') {
    const alder = havbunnsalder(KANT_KM, fart);
    return (
      <>
        <Readout label="Hver plate flytter seg" value={halvTekst(halv)} unit="cm/år" tone={VIZ.velocity} />
        <Readout label="Ny havbunn per million år" value={tallT(plateavstand(fart, 1))} unit="km" />
        <Readout label={`Alder ${KANT_KM} km fra ryggen`} value={alder === null ? '–' : fmt(alder, alder < 10 ? 1 : 0)} unit="millioner år" />
        <Readout label="Havdyp der" value={tallT(alder === null ? null : havdybde(alder))} unit="m" />
      </>
    );
  }
  if (type === 'subduksjon') {
    const s = plateavstand(fart, t) ?? 0;
    const p = platePunktVed(variant, s);
    return (
      <>
        <Readout label="Havbunn som har gått ned" value={tallT(s)} unit="km" tone={VIZ.velocity} />
        <Readout label="Den har nådd" value={p ? fmt(Math.round(p.z / 5) * 5, 0) : '–'} unit="km dyp" />
        <Readout label="Tid ned til 660 km" value={tall(tidTilDyp(variant, fart), 0)} unit="millioner år" />
        <Readout label="Jordskjelv" value={skjelvTekst} unit="km dyp" />
      </>
    );
  }
  if (type === 'kollisjon') {
    const k = fjellkjede(fart, t);
    return (
      <>
        <Readout label="Skjøvet sammen" value={tallT(k?.sammenskyving)} unit="km" tone={VIZ.velocity} />
        <Readout label="Skorpetykkelse" value={tall(k?.tykkelse)} unit="km" />
        <Readout label="Middelhøyde" value={tallT(k ? Math.round(k.hoyde / 100) * 100 : null)} unit="m" />
        <Readout label="Fjellrot" value={tall(k?.rot)} unit="km" />
      </>
    );
  }
  if (type === 'transform') {
    return (
      <>
        <Readout label="Forskjøvet siden start" value={tallT(plateavstand(fart, t))} unit="km" tone={VIZ.velocity} />
        <Readout label="Jordskjelv" value={skjelvTekst} unit="km dyp" />
        <Readout label="Vulkaner" value="Ingen" />
      </>
    );
  }
  const hvert = vulkanAlder(KJEDE_AVSTAND, fart);
  return (
    <>
      <Readout label="Plata har flyttet seg" value={tallT(plateavstand(fart, t))} unit="km" tone={VIZ.velocity} />
      <Readout label="Ny vulkan omtrent hvert" value={hvert === null ? '–' : fmt(hvert, hvert < 10 ? 1 : 0)} unit="millioner år" />
      <Readout label="Jordskjelv" value={skjelvTekst} unit="km dyp" />
    </>
  );
}

function utregning(type: PlategrenseType, variant: SubduksjonVariant, fart: number, t: number): ReactNode {
  const kmPerMa = fart * KM_PER_MA;
  const v = fmtTall(kmPerMa);
  const enhet = (
    <FormulaLine>
      v = {fartTekst(fart)} cm/år = {v} km per million år (1 cm · 1 000 000 = 10 km)
    </FormulaLine>
  );
  if (type === 'spredning') {
    const halv = fart / 2;
    const vh = fmt(halv * KM_PER_MA, Math.abs(halv * KM_PER_MA - Math.round(halv * KM_PER_MA)) < 0.01 ? 0 : 1);
    const alder = havbunnsalder(KANT_KM, fart);
    const d = alder === null ? null : havdybde(alder);
    return (
      <>
        {enhet}
        <FormulaLine>
          v<Sub>halv</Sub> = v / 2 = {vh} km per million år (hver plate)
        </FormulaLine>
        <FormulaLine>
          alder = avstand / v<Sub>halv</Sub> = {KANT_KM} km / {vh} km per million år = {tall(alder, alder !== null && alder < 10 ? 1 : 0)} millioner år
        </FormulaLine>
        <FormulaLine>
          havdyp ≈ {RYGG_DYP} m + {DYP_KOEFFISIENT} m · √{tall(alder, 1)} ≈ {tallT(d)} m
        </FormulaLine>
      </>
    );
  }
  if (type === 'subduksjon') {
    const L = lengdeTilDyp(variant, 660);
    return (
      <>
        {enhet}
        <FormulaLine>
          s = v · t = {v} km per million år · {fmt(t, 1)} millioner år = {tallT(plateavstand(fart, t))} km
        </FormulaLine>
        <FormulaLine>
          ned til 660 km: t = s / v = {tallT(L)} km / {v} km per million år ≈ {tall(tidTilDyp(variant, fart), 0)} millioner år
        </FormulaLine>
      </>
    );
  }
  if (type === 'kollisjon') {
    const k = fjellkjede(fart, t);
    const dT = k ? k.tykkelse - 35 : null;
    return (
      <>
        {enhet}
        <FormulaLine>
          s = v · t = {v} km per million år · {fmt(t, 0)} millioner år = {tallT(k?.sammenskyving)} km
        </FormulaLine>
        <FormulaLine>
          Δ = skorpa blir {tall(dT)} km tykkere (forenklet: høyst ca. 35 km)
        </FormulaLine>
        <FormulaLine>
          høyde = Δ · (ρ<Sub>m</Sub> − ρ<Sub>s</Sub>) / ρ<Sub>m</Sub> = {tall(dT)} km · ({fmt(TETTHET_MANTEL, 1)} − {fmt(TETTHETER.skorpeKontinentSnitt, 1)}) / {fmt(TETTHET_MANTEL, 1)} ={' '}
          {tall(k ? k.hoyde / 1000 : null, 1)} km
        </FormulaLine>
        <FormulaLine>
          rot = Δ · ρ<Sub>s</Sub> / ρ<Sub>m</Sub> = {tall(dT)} km · {fmt(TETTHETER.skorpeKontinentSnitt, 1)} / {fmt(TETTHET_MANTEL, 1)} = {tall(k?.rot)} km
        </FormulaLine>
      </>
    );
  }
  if (type === 'transform') {
    return (
      <>
        {enhet}
        <FormulaLine>
          s = v · t = {v} km per million år · {fmt(t, 1)} millioner år = {tallT(plateavstand(fart, t))} km
        </FormulaLine>
      </>
    );
  }
  const a500 = vulkanAlder(500, fart);
  return (
    <>
      {enhet}
      <FormulaLine>
        alder = avstand / v = 500 km / {v} km per million år = {tall(a500, a500 !== null && a500 < 10 ? 1 : 0)} millioner år
      </FormulaLine>
      <FormulaLine>v = avstand / alder (slik måles platefarten over et varmt punkt)</FormulaLine>
    </>
  );
}

interface ForklaringInn {
  type: PlategrenseType;
  variant: SubduksjonVariant;
  fart: number;
  t: number;
  tMax: number;
  krefter: boolean;
  smelting: boolean;
  kjedeHoyde: number | null;
  tykkelse: number | null;
}

function forklaring({ type, variant, fart, t, tMax, krefter, smelting, kjedeHoyde, tykkelse }: ForklaringInn): ReactNode {
  const halv = fart / 2;
  const avsnitt: ReactNode[] = [];
  const spiller = t < tMax - 1e-6;
  if (type === 'spredning') {
    const alder = havbunnsalder(KANT_KM, fart);
    avsnitt.push(
      <>
        Ved en <strong>spredningsrygg</strong> (konstruktiv eller divergerende plategrense) beveger platene seg fra hverandre, her med {halvTekst(halv)} cm/år hver.
        Magma fyller sprekken og stivner til ny havbunn av basalt. Havbunnen blir eldre bort fra ryggen ({KANT_KM} km ut er den ca. {tall(alder, alder !== null && alder < 10 ? 1 : 0)}{' '}
        millioner år), og den blir dypere fordi plata kjøles ned, trekker seg sammen og blir tyngre. Lava som stivner, låser retningen på jordas magnetfelt, som snur med ujevne
        mellomrom. Derfor ligger stripene med normal og omvendt polaritet likt på begge sider av ryggen, som et speilbilde.{' '}
        {spiller ? 'Se stripene vokse ut fra ryggen etter hvert som ny havbunn dannes.' : 'Spill av for å se stripene vokse ut fra ryggen de siste 5 millioner årene.'} Eksempler: Den
        midtatlantiske ryggen (ca. 2–3 cm/år) og Island.
      </>,
    );
  } else if (type === 'subduksjon') {
    const s = plateavstand(fart, t) ?? 0;
    const p = platePunktVed(variant, s);
    avsnitt.push(
      <>
        Ved en <strong>subduksjonssone</strong> (destruktiv eller konvergerende plategrense) beveger platene seg mot hverandre. Havbunnsplata er kald og tung, så den går ned under{' '}
        {variant === 'hav-kontinent' ? 'kontinentet' : 'den andre havbunnsplata'} og lager en havgrop. Jordskjelvene følger plata ned langs en skrå sone, fra grunne ved havgropa til
        ca. 700 km dyp (snittet under er i målestokk). Over stedet der plata er ca. 100 km dyp, ligger{' '}
        {variant === 'hav-kontinent' ? 'en rekke vulkaner i en fjellkjede, som i Andesfjellene' : 'en bue av vulkanøyer, som Marianene og Japan'}.{' '}
        {t > 0.05 && p ? `Havbunn som var i havgropa for ${fmtAlder(t, { enhet: 'millioner', desimaler: 1 })} siden, er nå ca. ${fmt(Math.round(p.z / 5) * 5, 0)} km dypt.` : ''}
      </>,
    );
  } else if (type === 'kollisjon') {
    avsnitt.push(
      <>
        Ved en <strong>kollisjon</strong> (konvergerende plategrense) møtes to kontinenter. Kontinentalskorpa er for lett til å synke ned i mantelen, så den presses sammen, foldes
        og blir tykkere. Den tykke skorpa flyter høyere, som et tykt isfjell: fjellkjeden løftes, og under den stikker en enda større fjellrot ned i mantelen (isostasi).{' '}
        {t > 0.05
          ? `${fmtAlder(t, { enhet: 'millioner', desimaler: 0 })} etter at kontinentene møttes, er skorpa ca. ${tall(tykkelse)} km tykk og fjellkjeden ca. ${tallT(kjedeHoyde === null ? null : Math.round(kjedeHoyde / 100) * 100)} m høy i snitt.`
          : 'Spill av for å se fjellkjeden løftes.'}{' '}
        Himalaya er en slik fjellkjede i dag: India har presset mot Eurasia i ca. 50 millioner år. Berggrunnen i store deler av Norge er rester av den kaledonske
        fjellkjeden, som ble dannet på samme måte for ca. 430–400 millioner år siden og siden er tæret ned av erosjon. Høyden fjellene i Norge har i dag, kommer av
        senere hevning og isens erosjon, ikke av den gamle kollisjonen.
      </>,
    );
  } else if (type === 'transform') {
    avsnitt.push(
      <>
        Ved en <strong>transformforkastning</strong> (konservativ plategrense) glir platene forbi hverandre. Ingen havbunn dannes eller forsvinner, og det er ingen vulkaner. Mellom
        de to ryggstykkene beveger platene seg hver sin vei langs forkastningen; utenfor beveger begge sider seg samme vei, og bruddsonen er bare et arr i havbunnen. Friksjonen holder
        platene fast, så spenningen bygger seg opp og utløses i grunne, men ofte kraftige jordskjelv. San Andreas-forkastningen i California er en transformforkastning på land.
      </>,
    );
  } else {
    avsnitt.push(
      <>
        Et <strong>varmt punkt</strong> er ikke en plategrense: det ligger inne på en plate. En søyle av varm stein (en mantelplume) stiger fra dypt i mantelen, smelter delvis når
        trykket faller, og magmaen bryter gjennom plata og bygger en vulkan. Plata glir over det varme punktet med {fartTekst(fart)} cm/år, så vulkanen blir ført bort og slukner,
        og en ny vokser opp over det varme punktet. Slik blir det en kjede av vulkaner som blir eldre, lavere og mer nedtæret bort fra det (Hawaii). Island er både en spredningsrygg og
        et varmt punkt: plumen under ryggen gir så mye magma at ryggen står over havet.
      </>,
    );
  }

  if (krefter) {
    const tekst: Record<PlategrenseType, string> = {
      spredning:
        'Ryggskyv (grønne piler) kommer av at plata ligger høyt ved den varme ryggen og glir ned og bort fra den. Platetrekk, tyngden av en kald plate som synker i en subduksjonssone, virker der platene går ned, langt utenfor figuren. Det er trolig den største drivkraften.',
      subduksjon:
        'Platetrekk (oransje pil) er tyngden av den kalde, tunge plata som synker og trekker resten av plata etter seg. Det er trolig den største drivkraften. I tillegg skyver ryggskyvet bakfra, fra ryggen der plata ble dannet.',
      kollisjon:
        'Kontinentene skyves og trekkes av krefter andre steder (grønne piler): ryggskyv bak og trekk fra havbunnsplata som gikk ned før kontinentene møttes. Når fjellkjeden blir høy og tung, motsetter den seg mer sammenskyving.',
      transform:
        'Ved transformforkastningen virker ingen drivkraft. Platene drives av ryggskyv ved ryggene og platetrekk i subduksjonssoner andre steder.',
      'varmt-punkt':
        'Det varme punktet flytter ikke plata. Den trekkes av platetrekk der den går ned i subduksjonssoner langt unna (stiplet oransje pil).',
    };
    avsnitt.push(
      <>
        <strong>Kreftene:</strong> {tekst[type]} Mantelkonveksjonen og platene er samme system: platene er den kalde, øverste delen av strømningen. Mantelen er ikke et
        transportbånd som drar platene med seg; det er mest platene som synker og skyves, og mantelen som strømmer med.
      </>,
    );
  }

  if (smelting) {
    const rygg = smeltestart(POTENSIELL_TEMPERATUR);
    const plume = smeltestart(PLUME_TEMPERATUR);
    const tekst: Record<PlategrenseType, ReactNode> = {
      spredning: (
        <>
          Under ryggen stiger mantelen. Den blir nesten ikke kaldere når den stiger, men smeltepunktet synker når trykket faller, så ca. {tall(rygg === null ? null : Math.round(rygg / 5) * 5)}{' '}
          km nede blir mantelen varmere enn smeltepunktet og smelter delvis (dekompresjonssmelting). Smelten er lettere enn steinen rundt og stiger opp i ryggen.
        </>
      ),
      subduksjon: (
        <>
          Mantelkilen over plata er ikke varm nok til å smelte tørr. Men når plata er ca. 100 km dyp, presses vann ut av mineralene i den. Vannet senker smeltepunktet i mantelkilen
          med flere hundre grader, så den smelter delvis. Derfor ligger vulkanene på en linje et stykke inn fra havgropa.
        </>
      ),
      kollisjon: <>Nesten ingen steder: mantelen stiger ikke, og ingen plate tar vann ned. Litt granitt kan likevel dannes når den tykke skorpa blir varm dypt nede.</>,
      transform: <>Ingen steder: mantelen stiger ikke, og ingen plate tar vann ned. Derfor er det ingen vulkaner langs en transformforkastning.</>,
      'varmt-punkt': (
        <>
          Plumen er ca. 200 °C varmere enn mantelen ellers, så den når smeltepunktet allerede ca. {tall(plume === null ? null : Math.round(plume / 5) * 5)} km nede, under den tykke
          plata.
        </>
      ),
    };
    avsnitt.push(
      <>
        <strong>Hvor smelter det?</strong> {tekst[type]}
      </>,
    );
  }

  avsnitt.push(
    <>
      Platene flyter ikke på flytende magma: astenosfæren er fast stein, men så varm at den kan flyte svært langsomt, som is i en bre. Bare en liten del smelter, der trykket faller
      eller vann kommer til. Jordskjelv ved {GRENSE_TYPER[type].navn.toLowerCase()}: {skjelvdybder(type).tekst}.
    </>,
  );

  return (
    <>
      {avsnitt.map((a, i) => (
        <p key={i}>{a}</p>
      ))}
    </>
  );
}

