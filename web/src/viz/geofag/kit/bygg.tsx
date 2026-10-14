/**
 * Bygninger og plattformer i geofagfigurene: `Bygning` (norske bygg sett fra siden i riktige proporsjoner: bolig,
 * hytte, garasje, boligblokk, skole, sykehjem, brannstasjon, fjøs, vannverk og anrikningsverk) og `Plattform`
 * (plattform på havet i stål, betong eller flytende, med valgfrie brønner ned i et snitt).
 *
 * Bygningene gir skala i landskapet og brukes til sikkerhetsklassene for flom og skred (TEK17 § 7-2 og § 7-3): typene
 * dekker alle byggtypene i `BYGGTYPER` (risiko.ts), så `<Bygning type={byggId} />` virker rett fra modellen. Bolighuset
 * bygger på Hus i fysikk/kap03/vannkraft-deler.tsx (kopiert, ikke importert). Samme stil som scene-kit-et: toninger fra
 * core.tsx, SCENE- og PAINTS-farger, tynn kontur, myk skygge og lys fra øvre venstre; tente vinduer i mørkt tema.
 */
import { memo, type ReactNode } from 'react';
import '../../kit/scene/bakgrunn.css';
import { VIZ } from '../../kit/colors';
import { Txt } from '../../kit/txt';
import { ContactShadow, LinearGradient, alpha, materialStops, mix, sceneRandom, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene/core';
import { PAINTS, SCENE, type PaintName } from '../../kit/scene/palette';
import type { ByggtypeId } from './risiko';
import type { SnittPunkt } from './snitt';

type P = readonly [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pts = (p: readonly P[]) => p.map(([px, py], i) => `${i ? 'L' : 'M'}${r1(px)},${r1(py)}`).join('');
const poly = (p: readonly P[]) => `${pts(p)}Z`;

/** Vindusglass: lyseblått om dagen, tente vinduer i skumringen (samme variabel som husene i Landskap). */
const GLASS = 'var(--sc-bakgrunn-vindu)';
/** Tak: mørk skifer eller takstein. */
const TAK = mix(SCENE.stoneDark, PAINTS.svart, 0.35);
/** Mur, puss og betong. */
const PUSS = mix(PAINTS.hvit, SCENE.concrete, 0.4);
/** Beiset tømmer på hytta. */
const TOMMER = mix(SCENE.woodDark, SCENE.wood, 0.25);

/* =====================================================================================================================
 * Mål
 * ================================================================================================================== */

/** Bygningstypene. Alle `ByggtypeId` fra risiko.ts er med (bolig, hytte, garasje, boligblokk, skole, sykehjem, beredskap). */
export type BygningType = 'bolig' | 'hytte' | 'garasje' | 'boligblokk' | 'skole' | 'sykehjem' | 'beredskap' | 'fjos' | 'vannverk' | 'anrikningsverk';

/** Alle bygningstypene i fast rekkefølge (små til store). */
export const BYGNING_TYPER: readonly BygningType[] = ['garasje', 'hytte', 'bolig', 'fjos', 'vannverk', 'beredskap', 'boligblokk', 'skole', 'sykehjem', 'anrikningsverk'];

/** Målene til en bygning i meter. */
export interface BygningMaal {
  /** Navn med stor forbokstav («Bolighus», «Brannstasjon»). */
  navn: string;
  /** Bredden på hovedbygningen (veggene) sett fra siden. */
  bredde: number;
  /** Høyeste punkt over bakken (møne, tårn, pipe). */
  hoyde: number;
  /** Hvor langt figuren går til venstre og høyre for ankerpunktet (negativ til venstre), med takutstikk, rampe og tårn. */
  venstre: number;
  hoyre: number;
  /** Byggtypen i risiko.ts (sikkerhetsklasse for flom og skred), eller null. */
  byggtype: ByggtypeId | null;
  /** Kort beskrivelse av hva som er tegnet. */
  beskrivelse: string;
}

/**
 * Målene til bygningene i meter (omtrentlige, typiske norske bygg), som tegningen følger: 1 m = `pxPerM` i figuren.
 * `venstre` og `hoyre` er utstrekningen fra ankerpunktet, så kapitlene kan sette bygg ved siden av hverandre.
 */
export const BYGNING_MAAL: Readonly<Record<BygningType, BygningMaal>> = {
  garasje: { navn: 'Garasje', bredde: 4.2, hoyde: 3.9, venstre: -2.5, hoyre: 2.5, byggtype: 'garasje', beskrivelse: 'enkel garasje med saltak, sett mot porten' },
  hytte: { navn: 'Hytte', bredde: 6.5, hoyde: 5, venstre: -3.9, hoyre: 3.9, byggtype: 'hytte', beskrivelse: 'laftet hytte med torvtak, sett mot gavlen' },
  bolig: { navn: 'Bolighus', bredde: 8.5, hoyde: 9.3, venstre: -4.7, hoyre: 4.7, byggtype: 'bolig', beskrivelse: 'enebolig i tre i to etasjer, sett mot gavlen' },
  fjos: { navn: 'Fjøs', bredde: 28, hoyde: 13, venstre: -14.4, hoyre: 14.4, byggtype: null, beskrivelse: 'fjøs og låve med låvebru, sett fra langsiden' },
  vannverk: { navn: 'Vannverk', bredde: 16, hoyde: 6.8, venstre: -9.4, hoyre: 13.6, byggtype: null, beskrivelse: 'vannbehandlingsanlegg med rør inn og tank, sett fra langsiden' },
  beredskap: { navn: 'Brannstasjon', bredde: 26, hoyde: 17, venstre: -16.6, hoyre: 13.4, byggtype: 'beredskap', beskrivelse: 'brannstasjon med vognhall og slangetårn (regional beredskap)' },
  boligblokk: { navn: 'Boligblokk', bredde: 24, hoyde: 13.2, venstre: -12.3, hoyre: 12.3, byggtype: 'boligblokk', beskrivelse: 'boligblokk i fire etasjer med balkonger' },
  skole: { navn: 'Skole', bredde: 36, hoyde: 9, venstre: -18.6, hoyre: 18.6, byggtype: 'skole', beskrivelse: 'skole i to etasjer i tegl med inngangsparti' },
  sykehjem: { navn: 'Sykehjem', bredde: 40, hoyde: 10.2, venstre: -20.6, hoyre: 20.6, byggtype: 'sykehjem', beskrivelse: 'sykehjem i to etasjer med valmtak og balkonger' },
  anrikningsverk: { navn: 'Anrikningsverk', bredde: 56, hoyde: 40, venstre: -55, hoyre: 28.2, byggtype: null, beskrivelse: 'trappet industribygg ved en gruve med transportbånd og pipe' },
};

/**
 * Hvor stor en bygning blir i figuren (figurens enheter) med `pxPerM` piksler per meter: bredden på veggene, høyden og
 * utstrekningen til venstre og høyre for ankerpunktet (venstre er negativ). Ugyldig skala gir 0.
 */
export function bygningStorrelse(type: BygningType, pxPerM: number): { bredde: number; hoyde: number; venstre: number; hoyre: number } {
  const m = BYGNING_MAAL[type];
  const p = Number.isFinite(pxPerM) && pxPerM > 0 ? pxPerM : 0;
  return { bredde: m.bredde * p, hoyde: m.hoyde * p, venstre: m.venstre * p, hoyre: m.hoyre * p };
}

/* =====================================================================================================================
 * Bygning
 * ================================================================================================================== */

/** Props til `Bygning`. */
export interface BygningProps {
  /** Midt på bakken under hovedbygningen. */
  x: number;
  y: number;
  type?: BygningType;
  /** Piksler (figurens enheter) per meter. Bruk samme skala i hele figuren, også for personer (1,75 m). Standard 4. */
  pxPerM?: number;
  /** Fargen på kledningen eller fasaden (PAINTS-navn). Standard etter typen (bolig gul, garasje og fjøs rød …). */
  farge?: PaintName;
  /** Speilvend (inngang, rampe og tårn på den andre siden). Lyset kommer fortsatt fra venstre. */
  flip?: boolean;
  /** Snø på taket. */
  sno?: boolean;
  /** Tekst på et skilt på fasaden («Vannverk», «Skole»). Står rett også med `flip`. */
  skilt?: string;
  /** Myk skygge på bakken (standard på). */
  skygge?: boolean;
  dim?: boolean;
}

interface Ctx {
  x: number;
  y: number;
  p: number;
  s: number;
  id: string;
  farge: string;
  sno: boolean;
  /** Nok plass til detaljer (sprosser, kledning, rekkverk). */
  detalj: boolean;
}

/**
 * Norsk bygning sett fra siden i riktige proporsjoner: bolighus i tre (gavlen mot oss), laftet hytte med torvtak,
 * garasje, boligblokk, skole, sykehjem, brannstasjon (`beredskap`), fjøs med låvebru, vannverk og anrikningsverk ved en
 * gruve. Vinduer med glass som lyser i mørkt tema, kledning eller tegl, tak med takutstikk, og myk skygge.
 *
 * Ankerpunkt: (x, y) er midt på bakken under hovedbygningen. Størrelsen følger `pxPerM` (piksler per meter), så en
 * person (1,75 m) og et hus i samme figur får riktige forhold; målene står i `BYGNING_MAAL`, utstrekningen i
 * `bygningStorrelse`. Typene dekker byggtypene i risiko.ts, så sikkerhetsklassene kan vises med riktig bygg:
 *   <Bygning x={300} y={bakke} type="sykehjem" pxPerM={3} />
 *   <Bygning x={520} y={bakke} type={byggId} pxPerM={3} sno />
 */
export const Bygning = memo(function Bygning({ x, y, type = 'bolig', pxPerM = 4, farge, flip, sno = false, skilt, skygge = true, dim }: BygningProps) {
  const s = useStrokeScale();
  const id = useSvgId('bygg');
  const p = fin(pxPerM, 4);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(p > 0)) return null;
  const m = BYGNING_MAAL[type];
  const c: Ctx = { x, y, p, s, id, farge: PAINTS[farge ?? STANDARD_FARGE[type]], sno, detalj: p >= 2.2 };
  const tegn = TEGNING[type];
  const skiltY = y - SKILT_HOYDE[type] * p;
  return (
    <g opacity={dim ? 0.38 : undefined} aria-hidden>
      <LinearGradient id={`${id}v`} x2={1} y2={0} stops={[[0, tint(c.farge, 0.1)], [1, shade(c.farge, 0.14)]]} />
      <LinearGradient id={`${id}t`} stops={materialStops(TAK, 0.9)} />
      {skygge && <ContactShadow cx={x + ((m.venstre + m.hoyre) / 2) * p * (flip ? -1 : 1)} cy={y} rx={((m.hoyre - m.venstre) / 2) * p * 1.05} ry={Math.max(1.5, 0.9 * p)} opacity={0.7} />}
      <g transform={flip ? `translate(${r2(2 * x)} 0) scale(-1 1)` : undefined}>{tegn(c)}</g>
      {skilt && <Skilt x={x} y={skiltY} p={p} s={s} tekst={skilt} />}
    </g>
  );
});

const STANDARD_FARGE: Readonly<Record<BygningType, PaintName>> = {
  bolig: 'gul',
  hytte: 'oransje',
  garasje: 'rod',
  boligblokk: 'hvit',
  skole: 'rod',
  sykehjem: 'hvit',
  beredskap: 'rod',
  fjos: 'rod',
  vannverk: 'hvit',
  anrikningsverk: 'blaa',
};

/** Høyden (m) der skiltet står midt på. */
const SKILT_HOYDE: Readonly<Record<BygningType, number>> = {
  bolig: 6.6,
  hytte: 3.4,
  garasje: 3,
  boligblokk: 10.6,
  skole: 6,
  sykehjem: 6.1,
  beredskap: 6.6,
  fjos: 9,
  vannverk: 4.6,
  anrikningsverk: 24,
};

/* ---------------------------------------------------------------- Felles deler */

/** Vindu med karm (hvit), glass, refleks og sprosser. (x, y) er øverste venstre hjørne. */
function Vindu({ x, y, w, h, c, sprosser = 'kryss', karm = PAINTS.hvit }: { x: number; y: number; w: number; h: number; c: Ctx; sprosser?: 'kryss' | 'loddrett' | 'ingen' | 'rute'; karm?: string }) {
  if (!(w > 0.8) || !(h > 0.8)) return null;
  const t = Math.max(0.45, Math.min(w, h) * 0.1);
  const d = c.detalj && w > 4;
  return (
    <g>
      <rect x={r1(x)} y={r1(y)} width={r1(w)} height={r1(h)} fill={karm} stroke={d ? SCENE.outline : 'none'} strokeWidth={0.5 * c.s} />
      <rect x={r1(x + t)} y={r1(y + t)} width={r1(w - 2 * t)} height={r1(h - 2 * t)} fill={GLASS} />
      {d && <path d={poly([[x + t, y + h * 0.62], [x + w * 0.55, y + t], [x + w * 0.78, y + t], [x + t, y + h - t]])} fill={SCENE.highlight} opacity={0.22} />}
      {d && sprosser !== 'ingen' && (
        <path
          d={
            sprosser === 'kryss'
              ? `M${r1(x + w / 2)},${r1(y)}V${r1(y + h)}M${r1(x)},${r1(y + h / 2)}H${r1(x + w)}`
              : sprosser === 'rute'
                ? `M${r1(x + w / 2)},${r1(y)}V${r1(y + h)}M${r1(x)},${r1(y + h / 3)}H${r1(x + w)}M${r1(x)},${r1(y + (2 * h) / 3)}H${r1(x + w)}`
                : `M${r1(x + w / 2)},${r1(y)}V${r1(y + h)}`
          }
          stroke={karm}
          strokeWidth={t * 0.7}
        />
      )}
      {d && <rect x={r1(x - t * 0.6)} y={r1(y + h)} width={r1(w + t * 1.2)} height={r1(t * 0.9)} fill={shade(karm, 0.15)} />}
    </g>
  );
}

/** Dør med karm. (x, y) er nede til venstre. */
function Dor({ x, y, w, h, c, farge, glass }: { x: number; y: number; w: number; h: number; c: Ctx; farge: string; glass?: boolean }) {
  const t = Math.max(0.4, w * 0.08);
  return (
    <g>
      <rect x={r1(x)} y={r1(y - h)} width={r1(w)} height={r1(h)} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.5 * c.s} />
      <rect x={r1(x + t)} y={r1(y - h + t)} width={r1(w - 2 * t)} height={r1(h - t)} fill={glass ? GLASS : shade(farge, 0.3)} />
      {glass && c.detalj && <path d={`M${r1(x + w / 2)},${r1(y - h + t)}V${r1(y)}`} stroke={PAINTS.hvit} strokeWidth={t * 0.8} />}
      {!glass && c.detalj && <circle cx={r1(x + w * 0.78)} cy={r1(y - h * 0.47)} r={r1(Math.max(0.3, w * 0.05))} fill={SCENE.metalLight} />}
    </g>
  );
}

/** Skygge under takutstikket (lys ovenfra). */
function Takskygge({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <rect x={r1(x)} y={r1(y)} width={r1(w)} height={r1(Math.max(0.5, h))} fill={SCENE.shadow} opacity={0.32} />;
}

/** Saltak sett mot gavlen: vindskier med takutstikk, gavltrekant i veggfargen og eventuelt snø. Toppen er i y − mone. */
function Gavltak({ c, W, vegg, mone, utstikk, tykk, torv, sno }: { c: Ctx; W: number; vegg: number; mone: number; utstikk: number; tykk: number; torv?: boolean; sno?: boolean }) {
  const { x, y, s } = c;
  const L = x - W / 2;
  const T = y - vegg;
  const a = (mone - vegg) / (W / 2);
  const ytreV: P = [L - utstikk, T + a * utstikk - tykk];
  const ytreH: P = [L + W + utstikk, T + a * utstikk - tykk];
  const topp: P = [x, y - mone];
  const indreV: P = [L - utstikk, T + a * utstikk];
  const indreH: P = [L + W + utstikk, T + a * utstikk];
  const indreTopp: P = [x, y - mone + tykk];
  const tak = poly([ytreV, topp, ytreH, indreH, indreTopp, indreV]);
  const torvT = torv ? Math.max(1, tykk * 1.6) : 0;
  return (
    <g>
      <path d={poly([[L, T], [x, y - mone + tykk * 0.9], [L + W, T]])} fill={`url(#${c.id}v)`} />
      <path d={tak} fill={torv ? mix(SCENE.woodDark, SCENE.stoneDark, 0.5) : TAK} stroke={SCENE.outline} strokeWidth={0.6 * s} strokeLinejoin="round" />
      {torv && (
        <g>
          <path
            d={poly([
              [ytreV[0] - 0.2, ytreV[1] + 0.2],
              [x, y - mone],
              [ytreH[0] + 0.2, ytreH[1] + 0.2],
              [ytreH[0], ytreH[1] - torvT],
              [x, y - mone - torvT],
              [ytreV[0], ytreV[1] - torvT],
            ])}
            fill={SCENE.grass}
            stroke={SCENE.grassDark}
            strokeWidth={0.6 * s}
            strokeLinejoin="round"
          />
          {c.detalj && <Straa a={[ytreV[0], ytreV[1] - torvT]} b={[x, y - mone - torvT]} c={c} />}
          {c.detalj && <Straa a={[x, y - mone - torvT]} b={[ytreH[0], ytreH[1] - torvT]} c={c} />}
        </g>
      )}
      {sno && (
        <path
          d={poly([
            [ytreV[0], ytreV[1] - torvT],
            [x, y - mone - torvT],
            [ytreH[0], ytreH[1] - torvT],
            [ytreH[0] - utstikk * 0.3, ytreH[1] - torvT - tykk * 0.9],
            [x, y - mone - torvT - tykk * 1.3],
            [ytreV[0] + utstikk * 0.3, ytreV[1] - torvT - tykk * 0.9],
          ])}
          fill={SCENE.snow}
          stroke={SCENE.snowShade}
          strokeWidth={0.6 * s}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** Gresstrå langs en kant (torvtak, låvebru). */
function Straa({ a, b, c }: { a: P; b: P; c: Ctx }) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(L / Math.max(1.6, 0.35 * c.p)));
  const rnd = sceneRandom(Math.round(a[0] * 7 + b[1]));
  let d = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = a[0] + t * (b[0] - a[0]);
    const py = a[1] + t * (b[1] - a[1]);
    const hh = (0.25 + rnd() * 0.25) * c.p;
    d += `M${r1(px)},${r1(py + 0.3)}l${r1((rnd() - 0.5) * hh * 0.6)},${r1(-hh)}`;
  }
  return <path d={d} stroke={SCENE.grassDark} strokeWidth={Math.max(0.5, 0.08 * c.p) * c.s} strokeLinecap="round" />;
}

/** Tak sett fra langsiden: et bånd fra raft til møne (saltak) eller en trapes (valmtak), med takstein og snø. */
function Langtak({ c, L, R, raft, mone, utstikk, valm = false, sno }: { c: Ctx; L: number; R: number; raft: number; mone: number; utstikk: number; valm?: boolean; sno?: boolean }) {
  const { y, p, s } = c;
  const ty = y - mone;
  const ry = y - raft + utstikk * 0.35;
  const inn = valm ? (mone - raft) * 0.9 : 0;
  const form = poly([
    [L - utstikk, ry],
    [L - utstikk + inn, ty],
    [R + utstikk - inn, ty],
    [R + utstikk, ry],
  ]);
  const radAvstand = Math.max(2.4, 0.42 * p);
  let rader = '';
  if (c.detalj) for (let yy = ty + radAvstand; yy < ry - 0.5; yy += radAvstand) {
    const t = (yy - ty) / (ry - ty);
    rader += `M${r1(L - utstikk + inn * (1 - t))},${r1(yy)}H${r1(R + utstikk - inn * (1 - t))}`;
  }
  return (
    <g>
      <path d={form} fill={`url(#${c.id}t)`} stroke={SCENE.outline} strokeWidth={0.6 * s} strokeLinejoin="round" />
      {rader && <path d={rader} stroke={shade(TAK, 0.3)} strokeWidth={0.45 * s} opacity={0.6} />}
      <path d={`M${r1(L - utstikk + inn)},${r1(ty)}H${r1(R + utstikk - inn)}`} stroke={shade(TAK, 0.35)} strokeWidth={Math.max(0.8, 0.25 * p)} strokeLinecap="round" />
      {sno && (
        <path
          d={poly([
            [L - utstikk + inn * 0.6, ty + (ry - ty) * 0.35],
            [L - utstikk + inn, ty - 0.25 * p],
            [R + utstikk - inn, ty - 0.25 * p],
            [R + utstikk - inn * 0.6, ty + (ry - ty) * 0.35],
          ])}
          fill={SCENE.snow}
          stroke={SCENE.snowShade}
          strokeWidth={0.5 * s}
          opacity={0.95}
        />
      )}
    </g>
  );
}

/** Rekkevis med vinduer: n vinduer jevnt fordelt mellom x1 og x2, med høyde h og overkant i y. */
function Vindusrad({ x1, x2, y, n, w, h, c, sprosser, hopp }: { x1: number; x2: number; y: number; n: number; w: number; h: number; c: Ctx; sprosser?: 'kryss' | 'loddrett' | 'ingen' | 'rute'; hopp?: (i: number) => boolean }) {
  const steg = (x2 - x1) / n;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (hopp && hopp(i) ? null : <Vindu key={i} x={x1 + steg * (i + 0.5) - w / 2} y={y} w={w} h={h} c={c} sprosser={sprosser} />))}
    </>
  );
}

/** Vegg med toning (lys fra venstre) og kontur. */
function Vegg({ c, L, T, W, H, fyll }: { c: Ctx; L: number; T: number; W: number; H: number; fyll?: string }) {
  return <rect x={r1(L)} y={r1(T)} width={r1(W)} height={r1(H)} fill={fyll ?? `url(#${c.id}v)`} stroke={SCENE.outline} strokeWidth={0.6 * c.s} />;
}

/** Stående kledning (loddrette bord). */
function Kledning({ c, L, T, W, H, farge, liggende }: { c: Ctx; L: number; T: number; W: number; H: number; farge: string; liggende?: boolean }) {
  if (!c.detalj) return null;
  const steg = Math.max(1.6, 0.36 * c.p);
  let d = '';
  if (liggende) for (let yy = T + steg; yy < T + H - 0.5; yy += steg) d += `M${r1(L)},${r1(yy)}H${r1(L + W)}`;
  else for (let xx = L + steg; xx < L + W - 0.5; xx += steg) d += `M${r1(xx)},${r1(T + 0.5)}V${r1(T + H - 0.5)}`;
  return <path d={d} stroke={shade(farge, 0.3)} strokeWidth={Math.max(0.35, 0.05 * c.p) * c.s} opacity={0.5} />;
}

/** Sokkel i betong nederst på veggen. */
function Sokkel({ c, L, W, h }: { c: Ctx; L: number; W: number; h: number }) {
  return <rect x={r1(L)} y={r1(c.y - h)} width={r1(W)} height={r1(h)} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.5 * c.s} />;
}

/* ---------------------------------------------------------------- Typene */

const TEGNING: Readonly<Record<BygningType, (c: Ctx) => ReactNode>> = {
  bolig: (c) => {
    const { x, y, p, s, farge } = c;
    const W = 8.5 * p;
    const vegg = 5.6 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const ww = 1.2 * p;
    const wh = 1.3 * p;
    return (
      <g>
        {/* Pipe bak taket */}
        <rect x={r1(x + 1.4 * p)} y={r1(y - 9.3 * p)} width={r1(0.7 * p)} height={r1(2.4 * p)} fill={SCENE.brick} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <Vegg c={c} L={L} T={T} W={W} H={vegg} />
        <Kledning c={c} L={L} T={T} W={W} H={vegg} farge={farge} />
        <Gavltak c={c} W={W} vegg={5.6 * p} mone={8.7 * p} utstikk={0.45 * p} tykk={0.38 * p} sno={c.sno} />
        <Kledning c={c} L={L + W * 0.25} T={T - 2 * p} W={W * 0.5} H={2 * p} farge={farge} />
        <Takskygge x={L} y={T} w={W} h={0.35 * p} />
        <Sokkel c={c} L={L} W={W} h={0.6 * p} />
        {/* Hjørnekasser */}
        <path d={`M${r1(L + 0.12 * p)},${r1(T)}V${r1(y - 0.6 * p)}M${r1(L + W - 0.12 * p)},${r1(T)}V${r1(y - 0.6 * p)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.6, 0.25 * p)} />
        <Vindu x={x - 0.8 * p} y={T - 1.6 * p} w={0.9 * p} h={0.9 * p} c={c} />
        <Vindu x={L + 1.1 * p} y={T + 0.7 * p} w={ww} h={wh} c={c} />
        <Vindu x={L + W - 1.1 * p - ww} y={T + 0.7 * p} w={ww} h={wh} c={c} />
        <Vindu x={L + 1.1 * p} y={T + 3.3 * p} w={ww} h={wh} c={c} />
        <Dor x={L + W - 1.2 * p - 1 * p} y={y - 0.6 * p} w={1 * p} h={2.1 * p} c={c} farge={farge} />
        <rect x={r1(L + W - 2.6 * p)} y={r1(y - 0.6 * p)} width={r1(1.8 * p)} height={r1(0.6 * p)} fill={SCENE.concreteDark} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      </g>
    );
  },

  hytte: (c) => {
    const { x, y, p, s } = c;
    const W = 6.5 * p;
    const vegg = 2.8 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const tommer = mix(TOMMER, c.farge, 0.15);
    const stokk = Math.max(1.4, 0.26 * p);
    let laft = '';
    if (c.detalj) for (let yy = T + stokk; yy < y - 0.3; yy += stokk) laft += `M${r1(L)},${r1(yy)}H${r1(L + W)}`;
    const ender: ReactNode[] = [];
    if (c.detalj)
      for (let yy = T + stokk / 2; yy < y; yy += stokk) {
        for (const ex of [L - 0.3 * p, L + W + 0.3 * p]) ender.push(<ellipse key={`${ex}-${yy}`} cx={r1(ex)} cy={r1(yy)} rx={r1(0.32 * p)} ry={r1(stokk * 0.48)} fill={tint(tommer, 0.25)} stroke={shade(tommer, 0.35)} strokeWidth={0.4 * s} />);
      }
    return (
      <g>
        <LinearGradient id={`${c.id}h`} x2={1} y2={0} stops={[[0, tint(tommer, 0.1)], [1, shade(tommer, 0.2)]]} />
        <rect x={r1(L - 0.35 * p)} y={r1(y - 0.5 * p)} width={r1(W + 0.7 * p)} height={r1(0.5 * p)} fill={SCENE.stone} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <Vegg c={c} L={L} T={T} W={W} H={vegg - 0.5 * p} fyll={`url(#${c.id}h)`} />
        <path d={laft} stroke={shade(tommer, 0.4)} strokeWidth={Math.max(0.4, 0.06 * p) * s} opacity={0.75} />
        {ender}
        <Gavltak c={{ ...c, id: `${c.id}`, farge: tommer }} W={W} vegg={vegg} mone={4.55 * p} utstikk={0.55 * p} tykk={0.22 * p} torv sno={c.sno} />
        <path d={poly([[L, T], [x, y - 4.55 * p + 0.2 * p], [L + W, T]])} fill={`url(#${c.id}h)`} />
        <Takskygge x={L} y={T} w={W} h={0.3 * p} />
        <Vindu x={L + 0.9 * p} y={T + 0.55 * p} w={1.5 * p} h={1.1 * p} c={c} sprosser="rute" />
        <Vindu x={x - 0.4 * p} y={T - 1.05 * p} w={0.8 * p} h={0.7 * p} c={c} sprosser="loddrett" />
        <Dor x={L + W - 2 * p} y={y - 0.5 * p} w={0.9 * p} h={1.95 * p} c={c} farge={tommer} />
      </g>
    );
  },

  garasje: (c) => {
    const { x, y, p, farge } = c;
    const W = 4.2 * p;
    const vegg = 2.6 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const pw = 2.6 * p;
    const ph = 2.15 * p;
    let paneler = '';
    if (c.detalj) for (let i = 1; i < 5; i++) paneler += `M${r1(x - pw / 2)},${r1(y - ph + (i * ph) / 5)}H${r1(x + pw / 2)}`;
    return (
      <g>
        <Vegg c={c} L={L} T={T} W={W} H={vegg} />
        <Kledning c={c} L={L} T={T} W={W} H={vegg} farge={farge} />
        <Gavltak c={c} W={W} vegg={vegg} mone={3.9 * p} utstikk={0.35 * p} tykk={0.28 * p} sno={c.sno} />
        <Takskygge x={L} y={T} w={W} h={0.3 * p} />
        <rect x={r1(x - pw / 2)} y={r1(y - ph)} width={r1(pw)} height={r1(ph)} fill={tint(PAINTS.hvit, 0.1)} stroke={SCENE.outline} strokeWidth={0.5 * c.s} />
        <path d={paneler} stroke={SCENE.concreteDark} strokeWidth={Math.max(0.4, 0.05 * p) * c.s} />
        <path d={`M${r1(L + 0.1 * p)},${r1(T)}V${r1(y)}M${r1(L + W - 0.1 * p)},${r1(T)}V${r1(y)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.5, 0.2 * p)} />
      </g>
    );
  },

  boligblokk: (c) => {
    const { x, y, p, s } = c;
    const W = 24 * p;
    const H = 13.2 * p;
    const L = x - W / 2;
    const T = y - H;
    const etasje = 3 * p;
    const fasade = mix(c.farge, SCENE.brick, 0.25);
    const n = 6;
    const steg = W / n;
    return (
      <g>
        <LinearGradient id={`${c.id}f`} x2={1} y2={0} stops={[[0, tint(fasade, 0.08)], [1, shade(fasade, 0.12)]]} />
        <Vegg c={c} L={L} T={T} W={W} H={H} fyll={`url(#${c.id}f)`} />
        {/* Gesims og flatt tak */}
        <rect x={r1(L - 0.3 * p)} y={r1(T - 0.4 * p)} width={r1(W + 0.6 * p)} height={r1(0.6 * p)} fill={shade(SCENE.metal, 0.25)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {c.sno && <rect x={r1(L - 0.3 * p)} y={r1(T - 0.75 * p)} width={r1(W + 0.6 * p)} height={r1(0.4 * p)} rx={0.2 * p} fill={SCENE.snow} stroke={SCENE.snowShade} strokeWidth={0.5 * s} />}
        <Sokkel c={c} L={L} W={W} h={0.7 * p} />
        {/* Trappeoppgangen midt på: smalt vindusbånd og inngang */}
        <rect x={r1(x - 1.1 * p)} y={r1(T + 0.9 * p)} width={r1(2.2 * p)} height={r1(H - 4.2 * p)} fill={GLASS} stroke={PAINTS.hvit} strokeWidth={Math.max(0.5, 0.18 * p)} />
        {c.detalj && [1, 2, 3].map((e) => <path key={e} d={`M${r1(x - 1.1 * p)},${r1(T + 0.9 * p + e * etasje)}H${r1(x + 1.1 * p)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.5, 0.15 * p)} />)}
        <Dor x={x - 0.9 * p} y={y - 0.7 * p} w={1.8 * p} h={2.4 * p} c={c} farge={fasade} glass />
        {[0, 1, 2, 3].map((e) => (
          <Vindusrad key={e} x1={L} x2={L + W} y={y - 0.7 * p - (e + 1) * etasje + 0.8 * p} n={n} w={1.6 * p} h={1.5 * p} c={c} sprosser="loddrett" hopp={(i) => i === 2 || i === 3 ? Math.abs(L + steg * (i + 0.5) - x) < 2 * p : false} />
        ))}
        {/* Balkonger på de øverste etasjene */}
        {[1, 2, 3].map((e) =>
          [0, 4].map((i) => {
            const bx = L + steg * (i + 0.5) + steg * 0.5;
            const by = y - 0.7 * p - e * etasje;
            return (
              <g key={`${e}-${i}`}>
                <rect x={r1(bx - 1.6 * p)} y={r1(by - 0.25 * p)} width={r1(3.2 * p)} height={r1(0.3 * p)} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.4 * s} />
                <rect x={r1(bx - 1.6 * p)} y={r1(by - 1.25 * p)} width={r1(3.2 * p)} height={r1(1 * p)} fill={alpha(SCENE.glass, 0.55)} stroke={SCENE.metalDark} strokeWidth={Math.max(0.4, 0.08 * p) * s} />
              </g>
            );
          }),
        )}
      </g>
    );
  },

  skole: (c) => {
    const { x, y, p, s } = c;
    const W = 36 * p;
    const vegg = 7.6 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const tegl = mix(c.farge, SCENE.brick, 0.65);
    let fuger = '';
    if (c.detalj && p >= 3) for (let yy = T + 0.5 * p; yy < y - 0.7 * p; yy += 0.5 * p) fuger += `M${r1(L)},${r1(yy)}H${r1(L + W)}`;
    return (
      <g>
        <LinearGradient id={`${c.id}f`} x2={1} y2={0} stops={[[0, tint(tegl, 0.08)], [1, shade(tegl, 0.14)]]} />
        <Langtak c={c} L={L} R={L + W} raft={vegg} mone={9 * p} utstikk={0.7 * p} sno={c.sno} />
        <Vegg c={c} L={L} T={T} W={W} H={vegg} fyll={`url(#${c.id}f)`} />
        {fuger && <path d={fuger} stroke={shade(tegl, 0.3)} strokeWidth={0.35 * s} opacity={0.45} />}
        <Takskygge x={L} y={T} w={W} h={0.45 * p} />
        <Sokkel c={c} L={L} W={W} h={0.7 * p} />
        {/* Store vinduer i bånd, to etasjer; inngangsparti i glass med overbygg */}
        <Vindusrad x1={L + 0.6 * p} x2={L + W - 0.6 * p} y={T + 1 * p} n={9} w={2.6 * p} h={1.8 * p} c={c} sprosser="loddrett" />
        <Vindusrad x1={L + 0.6 * p} x2={L + W - 0.6 * p} y={T + 4.4 * p} n={9} w={2.6 * p} h={1.8 * p} c={c} sprosser="loddrett" hopp={(i) => i === 3} />
        <rect x={r1(L + 12.6 * p)} y={r1(y - 3.4 * p)} width={r1(3.6 * p)} height={r1(2.7 * p)} fill={GLASS} stroke={PAINTS.hvit} strokeWidth={Math.max(0.5, 0.18 * p)} />
        {c.detalj && <path d={`M${r1(L + 14.4 * p)},${r1(y - 3.4 * p)}V${r1(y - 0.7 * p)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.5, 0.15 * p)} />}
        <rect x={r1(L + 11.8 * p)} y={r1(y - 3.95 * p)} width={r1(5.2 * p)} height={r1(0.45 * p)} fill={shade(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      </g>
    );
  },

  sykehjem: (c) => {
    const { x, y, p, s } = c;
    const W = 40 * p;
    const vegg = 6.8 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const tre = mix(SCENE.wood, c.farge, 0.25);
    return (
      <g>
        <Langtak c={c} L={L} R={L + W} raft={vegg} mone={10.2 * p} utstikk={0.6 * p} valm sno={c.sno} />
        <Vegg c={c} L={L} T={T} W={W} H={vegg} />
        {/* Treparti ved inngangen */}
        <rect x={r1(x - 4 * p)} y={r1(T)} width={r1(8 * p)} height={r1(vegg)} fill={tre} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <Kledning c={c} L={x - 4 * p} T={T} W={8 * p} H={vegg} farge={tre} />
        <Takskygge x={L} y={T} w={W} h={0.4 * p} />
        <Sokkel c={c} L={L} W={W} h={0.6 * p} />
        <Vindusrad x1={L + 0.5 * p} x2={x - 4 * p} y={T + 0.8 * p} n={7} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
        <Vindusrad x1={x + 4 * p} x2={L + W - 0.5 * p} y={T + 0.8 * p} n={7} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
        <Vindusrad x1={L + 0.5 * p} x2={x - 4 * p} y={T + 3.9 * p} n={7} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
        <Vindusrad x1={x + 4 * p} x2={L + W - 0.5 * p} y={T + 3.9 * p} n={7} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
        {/* Franske balkonger i andre etasje */}
        {c.detalj &&
          [-14, -7, 7, 14].map((dx) => (
            <path key={dx} d={`M${r1(x + (dx - 1.1) * p)},${r1(T + 1.9 * p)}h${r1(2.2 * p)}`} stroke={SCENE.metalDark} strokeWidth={Math.max(0.5, 0.12 * p) * s} />
          ))}
        <rect x={r1(x - 3 * p)} y={r1(y - 3.3 * p)} width={r1(6 * p)} height={r1(0.45 * p)} fill={shade(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <Dor x={x - 1.2 * p} y={y - 0.6 * p} w={2.4 * p} h={2.3 * p} c={c} farge={tre} glass />
        <Vindu x={x - 3.2 * p} y={T + 0.8 * p} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
        <Vindu x={x + 1.9 * p} y={T + 0.8 * p} w={1.3 * p} h={1.5 * p} c={c} sprosser="loddrett" />
      </g>
    );
  },

  beredskap: (c) => {
    const { x, y, p, s } = c;
    const W = 26 * p;
    const H = 8 * p;
    const L = x - W / 2;
    const T = y - H;
    const fasade = PUSS;
    const port = mix(PAINTS.rod, c.farge, 0.5);
    const tw = 3.6 * p;
    const tx = L - tw + 0.4 * p;
    return (
      <g>
        <LinearGradient id={`${c.id}f`} x2={1} y2={0} stops={[[0, tint(fasade, 0.08)], [1, shade(fasade, 0.14)]]} />
        {/* Slangetårnet */}
        <rect x={r1(tx)} y={r1(y - 17 * p)} width={r1(tw)} height={r1(17 * p)} fill={`url(#${c.id}f)`} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <rect x={r1(tx - 0.2 * p)} y={r1(y - 17.4 * p)} width={r1(tw + 0.4 * p)} height={r1(0.5 * p)} fill={shade(SCENE.metal, 0.25)} />
        {c.detalj && [13.5, 10, 6.5].map((hh) => <Vindu key={hh} x={tx + tw / 2 - 0.5 * p} y={y - hh * p} w={1 * p} h={1.5 * p} c={c} sprosser="ingen" />)}
        <Vegg c={c} L={L} T={T} W={W} H={H} fyll={`url(#${c.id}f)`} />
        <rect x={r1(L - 0.3 * p)} y={r1(T - 0.5 * p)} width={r1(W + 0.6 * p)} height={r1(0.6 * p)} fill={shade(SCENE.metal, 0.25)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {c.sno && <rect x={r1(L - 0.3 * p)} y={r1(T - 0.85 * p)} width={r1(W + 0.6 * p)} height={r1(0.4 * p)} rx={0.2 * p} fill={SCENE.snow} stroke={SCENE.snowShade} strokeWidth={0.5 * s} />}
        <Takskygge x={L} y={T} w={W} h={0.4 * p} />
        {/* Tre porter til vognhallen */}
        {[0, 1, 2].map((i) => {
          const px = L + 1 * p + i * 5 * p;
          let ruter = '';
          if (c.detalj) for (let j = 1; j < 5; j++) ruter += `M${r1(px)},${r1(y - 4.6 * p + j * 0.92 * p)}H${r1(px + 4.2 * p)}`;
          return (
            <g key={i}>
              <rect x={r1(px)} y={r1(y - 4.6 * p)} width={r1(4.2 * p)} height={r1(4.6 * p)} fill={port} stroke={SCENE.outline} strokeWidth={0.5 * s} />
              <rect x={r1(px + 0.4 * p)} y={r1(y - 4.2 * p)} width={r1(3.4 * p)} height={r1(0.9 * p)} fill={GLASS} />
              <path d={ruter} stroke={shade(port, 0.35)} strokeWidth={Math.max(0.4, 0.06 * p) * s} />
            </g>
          );
        })}
        {/* Kontorer i to etasjer */}
        <Vindusrad x1={L + 16.2 * p} x2={L + W - 0.4 * p} y={T + 1.1 * p} n={4} w={1.5 * p} h={1.4 * p} c={c} sprosser="loddrett" />
        <Vindusrad x1={L + 16.2 * p} x2={L + W - 0.4 * p} y={T + 4.6 * p} n={4} w={1.5 * p} h={1.4 * p} c={c} sprosser="loddrett" hopp={(i) => i === 1} />
        <Dor x={L + 18.3 * p} y={y} w={1.4 * p} h={2.2 * p} c={c} farge={fasade} glass />
      </g>
    );
  },

  fjos: (c) => {
    const { x, y, p, s, farge } = c;
    const W = 28 * p;
    const vegg = 6 * p;
    const L = x - W / 2;
    const T = y - vegg;
    const muren = 2.6 * p;
    const dorX = x + 4 * p;
    const lav = mix(SCENE.stone, SCENE.concrete, 0.5);
    return (
      <g>
        <Langtak c={c} L={L} R={L + W} raft={vegg} mone={13 * p} utstikk={0.6 * p} sno={c.sno} />
        <Vegg c={c} L={L} T={T} W={W} H={vegg - muren} />
        <Kledning c={c} L={L} T={T} W={W} H={vegg - muren} farge={farge} />
        <Takskygge x={L} y={T} w={W} h={0.4 * p} />
        {/* Fjøset nede i mur med små vinduer */}
        <rect x={r1(L)} y={r1(y - muren)} width={r1(W)} height={r1(muren)} fill={lav} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <Vindusrad x1={L + 0.5 * p} x2={dorX - 4 * p} y={y - muren + 0.7 * p} n={5} w={1 * p} h={0.75 * p} c={c} sprosser="kryss" />
        <Vindusrad x1={dorX + 4 * p} x2={L + W - 0.5 * p} y={y - muren + 0.7 * p} n={3} w={1 * p} h={0.75 * p} c={c} sprosser="kryss" />
        <path d={`M${r1(L + 0.15 * p)},${r1(T)}V${r1(y - muren)}M${r1(L + W - 0.15 * p)},${r1(T)}V${r1(y - muren)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.6, 0.3 * p)} />
        {/* Låvebrua (jordvoll med steinmur) opp til de store låvedørene */}
        <path
          d={poly([
            [dorX - 4.2 * p, y],
            [dorX - 2.6 * p, y - muren - 0.2 * p],
            [dorX + 2.6 * p, y - muren - 0.2 * p],
            [dorX + 4.2 * p, y],
          ])}
          fill={mix(SCENE.stone, SCENE.soil, 0.25)}
          stroke={SCENE.outline}
          strokeWidth={0.6 * s}
        />
        {c.detalj && <Steinmur c={c} x1={dorX - 4.2 * p} x2={dorX + 4.2 * p} y={y} h={muren + 0.2 * p} inn={1.6 * p} />}
        <path d={`M${r1(dorX - 2.7 * p)},${r1(y - muren - 0.25 * p)}H${r1(dorX + 2.7 * p)}`} stroke={SCENE.grassDark} strokeWidth={Math.max(0.8, 0.35 * p)} strokeLinecap="round" />
        <rect x={r1(dorX - 2 * p)} y={r1(y - muren - 3.6 * p)} width={r1(4 * p)} height={r1(3.4 * p)} fill={shade(farge, 0.08)} stroke={PAINTS.hvit} strokeWidth={Math.max(0.6, 0.22 * p)} />
        {c.detalj && (
          <path
            d={`M${r1(dorX)},${r1(y - muren - 3.6 * p)}V${r1(y - muren - 0.2 * p)}M${r1(dorX - 2 * p)},${r1(y - muren - 3.6 * p)}L${r1(dorX)},${r1(y - muren - 0.2 * p)}M${r1(dorX)},${r1(y - muren - 3.6 * p)}L${r1(dorX + 2 * p)},${r1(y - muren - 0.2 * p)}`}
            stroke={PAINTS.hvit}
            strokeWidth={Math.max(0.5, 0.16 * p)}
          />
        )}
        <Vindu x={L + 4 * p} y={T + 0.8 * p} w={1.2 * p} h={1 * p} c={c} />
        <Vindu x={L + W - 5.2 * p} y={T + 0.8 * p} w={1.2 * p} h={1 * p} c={c} />
      </g>
    );
  },

  vannverk: (c) => {
    const { x, y, p, s } = c;
    const W = 16 * p;
    const L = x - W / 2;
    const fasade = mix(c.farge, SCENE.concrete, 0.45);
    const hV = 6.8 * p;
    const hH = 6 * p;
    const tank = { x: L + W + 4.4 * p, r: 1.9 * p, h: 5 * p };
    return (
      <g>
        <LinearGradient id={`${c.id}f`} x2={1} y2={0} stops={[[0, tint(fasade, 0.08)], [1, shade(fasade, 0.14)]]} />
        <LinearGradient id={`${c.id}m`} x2={1} y2={0} stops={[[0, shade(SCENE.metalLight, 0.1)], [0.35, tint(SCENE.metalLight, 0.45)], [1, shade(SCENE.metal, 0.3)]]} />
        {/* Rentvannstank og røret mellom tanken og bygget */}
        <rect x={r1(L + W - 0.2 * p)} y={r1(y - 1.6 * p)} width={r1(tank.x - tank.r - L - W + 0.4 * p)} height={r1(0.6 * p)} fill={`url(#${c.id}m)`} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <rect x={r1(tank.x - tank.r)} y={r1(y - tank.h)} width={r1(2 * tank.r)} height={r1(tank.h)} fill={`url(#${c.id}m)`} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <ellipse cx={r1(tank.x)} cy={r1(y - tank.h)} rx={r1(tank.r)} ry={r1(0.35 * p)} fill={tint(SCENE.metalLight, 0.3)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {c.detalj && [0.3, 0.6].map((t) => <path key={t} d={`M${r1(tank.x - tank.r)},${r1(y - tank.h * t)}H${r1(tank.x + tank.r)}`} stroke={SCENE.metalDark} strokeWidth={0.4 * s} opacity={0.6} />)}
        {/* Bygget med pulttak */}
        <path d={poly([[L, y], [L, y - hV], [L + W, y - hH], [L + W, y]])} fill={`url(#${c.id}f)`} stroke={SCENE.outline} strokeWidth={0.6 * s} strokeLinejoin="round" />
        <path d={poly([[L - 0.4 * p, y - hV - 0.1 * p], [L + W + 0.4 * p, y - hH - 0.1 * p], [L + W + 0.4 * p, y - hH + 0.4 * p], [L - 0.4 * p, y - hV + 0.4 * p]])} fill={TAK} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {c.sno && <path d={poly([[L - 0.4 * p, y - hV - 0.1 * p], [L + W + 0.4 * p, y - hH - 0.1 * p], [L + W + 0.2 * p, y - hH - 0.5 * p], [L - 0.2 * p, y - hV - 0.5 * p]])} fill={SCENE.snow} stroke={SCENE.snowShade} strokeWidth={0.5 * s} />}
        <Sokkel c={c} L={L} W={W} h={0.6 * p} />
        {/* Høye, smale vinduer og dobbel dør */}
        {[2, 4.4, 9.8, 12.2].map((dx) => (
          <Vindu key={dx} x={L + dx * p} y={y - 5.2 * p} w={1 * p} h={3.6 * p} c={c} sprosser="rute" />
        ))}
        <Dor x={L + 6.4 * p} y={y - 0.6 * p} w={2.6 * p} h={2.6 * p} c={c} farge={mix(PAINTS.blaa, SCENE.metal, 0.4)} />
        {c.detalj && <path d={`M${r1(L + 7.7 * p)},${r1(y - 3 * p)}V${r1(y - 0.6 * p)}`} stroke={PAINTS.hvit} strokeWidth={Math.max(0.4, 0.1 * p)} />}
        {/* Råvannsrøret inn i grunnmuren */}
        <rect x={r1(L - 1.4 * p)} y={r1(y - 1.5 * p)} width={r1(1.6 * p)} height={r1(0.7 * p)} fill={mix(PAINTS.blaa, SCENE.metal, 0.45)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <rect x={r1(L - 1.9 * p)} y={r1(y - 1.75 * p)} width={r1(0.5 * p)} height={r1(1.2 * p)} fill={shade(mix(PAINTS.blaa, SCENE.metal, 0.45), 0.2)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {/* Lufting på taket */}
        <rect x={r1(L + 3 * p)} y={r1(y - hV - 0.9 * p + 0.15 * p)} width={r1(0.8 * p)} height={r1(0.9 * p)} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.4 * s} />
      </g>
    );
  },

  anrikningsverk: (c) => {
    const { x, y, p, s } = c;
    const W = 56 * p;
    const L = x - W / 2;
    const plate = mix(c.farge, SCENE.metal, 0.55);
    const blokker = [
      { x: L, w: 18 * p, h: 30 * p },
      { x: L + 18 * p, w: 20 * p, h: 22 * p },
      { x: L + 38 * p, w: 18 * p, h: 14 * p },
    ];
    // Transportbåndet fra knuseverket på bakken opp til toppen av den høyeste delen
    const a: P = [L - 26 * p, y - 1.5 * p];
    const bb: P = [L + 1 * p, y - 27 * p];
    return (
      <g>
        <LinearGradient id={`${c.id}f`} x2={1} y2={0} stops={[[0, tint(plate, 0.1)], [1, shade(plate, 0.16)]]} />
        {/* Pipe */}
        <rect x={r1(L + 30 * p)} y={r1(y - 40 * p)} width={r1(2.2 * p)} height={r1(18 * p)} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <rect x={r1(L + 29.8 * p)} y={r1(y - 40 * p)} width={r1(2.6 * p)} height={r1(0.8 * p)} fill={SCENE.concreteDark} />
        {blokker.map((bl, i) => (
          <g key={i}>
            <Vegg c={c} L={bl.x} T={y - bl.h} W={bl.w} H={bl.h} fyll={`url(#${c.id}f)`} />
            {c.detalj && <Kledning c={c} L={bl.x} T={y - bl.h} W={bl.w} H={bl.h} farge={plate} />}
            <rect x={r1(bl.x - 0.2 * p)} y={r1(y - bl.h - 0.5 * p)} width={r1(bl.w + 0.4 * p)} height={r1(0.6 * p)} fill={shade(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
            {c.sno && <rect x={r1(bl.x - 0.2 * p)} y={r1(y - bl.h - 0.85 * p)} width={r1(bl.w + 0.4 * p)} height={r1(0.4 * p)} rx={0.2 * p} fill={SCENE.snow} stroke={SCENE.snowShade} strokeWidth={0.5 * s} />}
            <rect x={r1(bl.x + 1 * p)} y={r1(y - bl.h + 2.5 * p)} width={r1(bl.w - 2 * p)} height={r1(1.4 * p)} fill={GLASS} stroke={SCENE.outline} strokeWidth={0.4 * s} />
            {bl.h > 20 * p && <rect x={r1(bl.x + 1 * p)} y={r1(y - bl.h * 0.5)} width={r1(bl.w - 2 * p)} height={r1(1.4 * p)} fill={GLASS} stroke={SCENE.outline} strokeWidth={0.4 * s} />}
          </g>
        ))}
        <rect x={r1(L + 41 * p)} y={r1(y - 5 * p)} width={r1(4.5 * p)} height={r1(5 * p)} fill={shade(plate, 0.35)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        <Transportband a={a} b={bb} c={c} />
        {/* Knuseverk ved foten av båndet */}
        <rect x={r1(a[0] - 3 * p)} y={r1(y - 4 * p)} width={r1(6 * p)} height={r1(4 * p)} fill={`url(#${c.id}f)`} stroke={SCENE.outline} strokeWidth={0.6 * s} />
        <path d={poly([[a[0] - 3.6 * p, y - 4 * p], [a[0] - 2.4 * p, y - 6 * p], [a[0] + 2.4 * p, y - 6 * p], [a[0] + 3.6 * p, y - 4 * p]])} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      </g>
    );
  },
};

/** Steinmur (låvebru): kvadere i rader. */
function Steinmur({ c, x1, x2, y, h, inn }: { c: Ctx; x1: number; x2: number; y: number; h: number; inn: number }) {
  const rad = Math.max(1.6, 0.55 * c.p);
  let d = '';
  let r = 0;
  for (let yy = y - rad; yy > y - h + 0.3; yy -= rad, r++) {
    const t = (y - yy) / h;
    const a = x1 + inn * t;
    const b = x2 - inn * t;
    d += `M${r1(a)},${r1(yy)}H${r1(b)}`;
    const steg = Math.max(2.2, 0.9 * c.p);
    for (let xx = a + (r % 2 ? steg / 2 : steg); xx < b - 0.5; xx += steg) d += `M${r1(xx)},${r1(yy)}v${r1(rad)}`;
  }
  return <path d={d} stroke={shade(SCENE.stoneDark, 0.1)} strokeWidth={0.4 * c.s} opacity={0.6} />;
}

/** Transportbånd i et fagverk fra a (nede) til b (oppe), med bukker. */
function Transportband({ a, b, c }: { a: P; b: P; c: Ctx }) {
  const { p, s, y } = c;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * 1.6 * p;
  const ny = (dx / L) * 1.6 * p;
  const n = Math.max(3, Math.round(L / (2.5 * p)));
  let fag = '';
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const p0: P = [a[0] + dx * t0, a[1] + dy * t0];
    const p1: P = [a[0] + dx * t1, a[1] + dy * t1];
    fag += i % 2 ? `M${r1(p0[0])},${r1(p0[1])}L${r1(p1[0] - nx)},${r1(p1[1] - ny)}` : `M${r1(p0[0] - nx)},${r1(p0[1] - ny)}L${r1(p1[0])},${r1(p1[1])}`;
  }
  const bukker = [0.3, 0.62].map((t) => [a[0] + dx * t, a[1] + dy * t] as P);
  const stal = shade(SCENE.metal, 0.15);
  return (
    <g strokeLinecap="round">
      {bukker.map(([bx, by], i) => (
        <path key={i} d={`M${r1(bx - 1.6 * p)},${r1(y)}L${r1(bx)},${r1(by)}L${r1(bx + 1.6 * p)},${r1(y)}`} fill="none" stroke={stal} strokeWidth={Math.max(0.6, 0.25 * p) * s} />
      ))}
      <path d={poly([a, b, [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]])} fill={alpha(SCENE.metal, 0.35)} stroke="none" />
      <path d={`M${r1(a[0])},${r1(a[1])}L${r1(b[0])},${r1(b[1])}M${r1(a[0] - nx)},${r1(a[1] - ny)}L${r1(b[0] - nx)},${r1(b[1] - ny)}`} stroke={stal} strokeWidth={Math.max(0.6, 0.22 * p) * s} />
      {c.detalj && <path d={fag} stroke={stal} strokeWidth={Math.max(0.4, 0.12 * p) * s} />}
      <path d={poly([[b[0] - 0.4 * p, b[1] + 0.6 * p], [b[0] + 1.8 * p, b[1] + 0.6 * p], [b[0] + 1.8 * p, b[1] - 2.4 * p], [b[0] - 0.4 * p - nx, b[1] - 2.4 * p]])} fill={shade(SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
    </g>
  );
}

/** Skilt på fasaden med tekst (står rett også når bygningen er speilvendt). (x, y) er midten. */
function Skilt({ x, y, p, s, tekst }: { x: number; y: number; p: number; s: number; tekst: string }) {
  const fs = clamp(0.95 * p, 7, 15);
  const w = tekst.length * fs * 0.58 + fs * 1.1;
  const h = fs * 1.5;
  return (
    <g>
      <rect x={r1(x - w / 2)} y={r1(y - h / 2)} width={r1(w)} height={r1(h)} rx={r1(h * 0.18)} fill={tint(SCENE.metalLight, 0.6)} stroke={SCENE.outline} strokeWidth={0.7 * s} />
      <Txt x={r1(x)} y={r1(y + fs * 0.35)} px={fs} weight={650} halo={false} color={SCENE.outline}>
        {tekst}
      </Txt>
    </g>
  );
}

/* =====================================================================================================================
 * Plattform
 * ================================================================================================================== */

/** Plattformtypene. */
export type PlattformType = 'stal' | 'betong' | 'flytende';

/** Norske navn på plattformtypene. */
export const PLATTFORM_NAVN: Readonly<Record<PlattformType, string>> = {
  stal: 'Stålplattform',
  betong: 'Betongplattform',
  flytende: 'Flytende plattform',
};

/** Én brønn fra havbunnen ned i snittet. Alle y-verdier i figurens koordinater. */
export interface PlattformBronn {
  /** Bunnen av brønnen (y), f.eks. i reservoaret. */
  bunn: number;
  /** Der brønnen ender (x). Standard rett under plattformen; en annen x gir en avviksbrønn som bøyer av. */
  til?: number;
  /** Der brønnen begynner å bøye av (y). Standard en tredjedel ned fra havbunnen. */
  knekk?: number;
  /** Ton ned brønnen. */
  dim?: boolean;
}

/** Props til `Plattform`. */
export interface PlattformProps {
  /** Midten av plattformen. */
  x: number;
  /** Havflaten. */
  y: number;
  /** Havbunnen (y). Understellet går ned hit, og brønnene starter her. */
  havbunn: number;
  type?: PlattformType;
  /** Bredden på dekket (figurens enheter). Høyden følger med. Standard 120. */
  size?: number;
  /** Brønner ned i snittet under havbunnen (én eller flere). */
  bronner?: PlattformBronn | readonly PlattformBronn[];
  /** Fakkel med liten flamme på fakkelbommen. */
  fakkel?: boolean;
  /** Speilvend (boretårnet og fakkelbommen på den andre siden). */
  flip?: boolean;
  dim?: boolean;
}

/** Punktene på en plattform (figurens koordinater), til piler og etiketter. */
export interface PlattformPunkter {
  /** Midt på dekket (øverste dekk). */
  dekk: { x: number; y: number };
  /** Toppen av boretårnet. */
  boretaarn: { x: number; y: number };
  /** Der brønnene møter havbunnen. */
  havbunn: { x: number; y: number };
  /** Brønnbanene som punkter (fra havbunnen og ned), én per brønn. */
  bronner: SnittPunkt[][];
  /** Enden av hver brønn. */
  bunn: { x: number; y: number }[];
  /** Tuppen av fakkelbommen. */
  fakkel: { x: number; y: number };
}

interface PlattformGeo {
  W: number;
  u: number;
  yb: number;
  dekkBunn: number;
  dekkTopp: number;
  tx: number;
  taarnTopp: number;
  fx: number;
  fy: number;
  bx: number;
  bronner: { bane: P[]; dim?: boolean }[];
}

function plattformGeo(p: PlattformProps): PlattformGeo {
  const x = fin(p.x, 0);
  const y = fin(p.y, 0);
  const W = Math.max(20, fin(p.size, 120));
  const u = W / 60;
  const yb = Math.max(fin(p.havbunn, y + 60), y + 8 * u);
  const dir = p.flip ? -1 : 1;
  const dekkBunn = y - 20 * u;
  const dekkTopp = dekkBunn - 5 * u;
  const tx = x + dir * 12 * u;
  const taarnTopp = dekkTopp - 50 * u;
  const fx = x - dir * (30 + 30) * u;
  const fy = dekkTopp - 34 * u;
  const bx = x + dir * 10 * u;
  const liste = p.bronner === undefined ? [] : Array.isArray(p.bronner) ? (p.bronner as readonly PlattformBronn[]) : [p.bronner as PlattformBronn];
  const bronner = liste
    .filter((b) => Number.isFinite(b.bunn) && b.bunn > yb + 2)
    .map((b, i) => {
      const x0 = bx + (i - (liste.length - 1) / 2) * 2.2 * u;
      const til = fin(b.til, x0);
      const knekk = clamp(fin(b.knekk, yb + (b.bunn - yb) / 3), yb, b.bunn);
      const bane: P[] = [[x0, yb]];
      if (Math.abs(til - x0) < 1) bane.push([x0, b.bunn]);
      else {
        bane.push([x0, knekk]);
        // Kvadratisk Bézier: loddrett ut fra knekken, nesten vannrett inn i reservoaret
        for (let j = 1; j <= 20; j++) {
          const t = j / 20;
          const q = 1 - t;
          bane.push([q * q * x0 + 2 * q * t * x0 + t * t * til, q * q * knekk + 2 * q * t * b.bunn + t * t * b.bunn]);
        }
      }
      return { bane, dim: b.dim };
    });
  return { W, u, yb, dekkBunn, dekkTopp, tx, taarnTopp, fx, fy, bx, bronner };
}

/**
 * Punktene på en plattform (samme props som `Plattform`): dekket, toppen av boretårnet, der brønnene møter havbunnen,
 * brønnbanene og endene deres, og fakkelen. Til piler (olje og gass opp, CO₂ ned) og etiketter.
 */
export function plattformPunkter(p: PlattformProps): PlattformPunkter {
  const g = plattformGeo(p);
  return {
    dekk: { x: fin(p.x, 0), y: g.dekkTopp },
    boretaarn: { x: g.tx, y: g.taarnTopp },
    havbunn: { x: g.bx, y: g.yb },
    bronner: g.bronner.map((b) => b.bane.map(([px, py]): SnittPunkt => [px, py])),
    bunn: g.bronner.map((b) => {
      const e = b.bane[b.bane.length - 1]!;
      return { x: e[0], y: e[1] };
    }),
    fakkel: { x: g.fx, y: g.fy },
  };
}

/**
 * Plattform på havet sett fra siden: stålunderstell (jacket) med kryssavstivning, betongplattform (Condeep) med skaft på
 * en celleklynge, eller flytende plattform med pongtonger og ankerliner. Dekket har moduler, boligkvarter med helidekk,
 * boretårn, kran og fakkelbom (med flamme når `fakkel`). Delene under vann tegnes halvgjennomsiktige, så havet bak
 * synes, og brønnene (borestrengen, `bronner`) går fra havbunnen ned i snittet, rett ned eller som avviksbrønner.
 *
 * Ankerpunkt: (x, y) er midt på plattformen i havflaten; understellet går ned til `havbunn`. `size` er bredden på
 * dekket, og høyden følger med (boretårnet når ca. 1,25 · size over havet). Tegn havet og snittet først (f.eks.
 * Snittblokk med vann type 'hav'), så plattformen. Bruk `plattformPunkter` for piler:
 *   <Plattform x={300} y={havflate} havbunn={havbunn} type="betong" size={110} bronner={[{ bunn: 380, til: 420 }]} />
 */
export const Plattform = memo(function Plattform(props: PlattformProps) {
  const { x, y, type = 'stal', fakkel, flip, dim } = props;
  const s = useStrokeScale();
  const id = useSvgId('plattform');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const g = plattformGeo(props);
  const { u, yb, dekkBunn, dekkTopp } = g;
  const W = g.W;
  const gul = mix(PAINTS.gul, SCENE.metal, 0.3);
  const betong = SCENE.concrete;
  const stal = shade(SCENE.metal, 0.1);
  const under = <Understell type={type} x={x} y={y} yb={yb} u={u} W={W} dekkBunn={dekkBunn} id={id} s={s} />;
  return (
    <g opacity={dim ? 0.4 : undefined} aria-hidden>
      <defs>
        <clipPath id={`${id}o`}>
          <rect x={r1(x - 8 * W)} y={r1(y - 4 * W)} width={r1(16 * W)} height={r1(4 * W)} />
        </clipPath>
        <clipPath id={`${id}u`}>
          <rect x={r1(x - 8 * W)} y={r1(y)} width={r1(16 * W)} height={r1(Math.max(1, yb - y + 4 * u))} />
        </clipPath>
      </defs>
      <LinearGradient id={`${id}b`} x2={1} y2={0} stops={[[0, tint(betong, 0.15)], [0.4, betong], [1, shade(betong, 0.25)]]} />
      <LinearGradient id={`${id}s`} x2={1} y2={0} stops={[[0, tint(stal, 0.2)], [1, shade(stal, 0.25)]]} />

      {/* Brønnene ned i snittet (under havbunnen) */}
      {g.bronner.map((b, i) => (
        <PlattformBronnTegning key={i} bane={b.bane} u={u} s={s} dim={b.dim} />
      ))}

      {/* Understellet: over vann i full farge, under vann halvgjennomsiktig */}
      <g clipPath={`url(#${id}u)`} opacity={0.62}>
        {under}
      </g>
      <g clipPath={`url(#${id}o)`}>{under}</g>
      {/* Skum ved vannlinja */}
      <Vannlinje type={type} x={x} y={y} u={u} s={s} />

      {/* Dekket med moduler */}
      <g transform={flip ? `translate(${r2(2 * x)} 0) scale(-1 1)` : undefined}>
        <Toppside x={x} u={u} W={W} dekkBunn={dekkBunn} dekkTopp={dekkTopp} id={id} s={s} gul={gul} fakkel={!!fakkel} />
      </g>
    </g>
  );
});

function Understell({ type, x, y, yb, u, W, dekkBunn, id, s }: { type: PlattformType; x: number; y: number; yb: number; u: number; W: number; dekkBunn: number; id: string; s: number }) {
  const stal = shade(SCENE.metal, 0.1);
  if (type === 'betong') {
    const dyp = yb - y;
    const baseH = Math.min(0.36 * dyp, 34 * u);
    const baseB = 1.3 * W;
    const celler = 6;
    const cw = baseB / celler;
    const baseTopp = yb - baseH;
    const skaft = [-0.24, 0.24].map((t) => x + t * W);
    return (
      <g>
        {skaft.map((sx, i) => (
          <path
            key={i}
            d={poly([
              [sx - 6 * u, baseTopp],
              [sx - 3.2 * u, dekkBunn],
              [sx + 3.2 * u, dekkBunn],
              [sx + 6 * u, baseTopp],
            ])}
            fill={`url(#${id}b)`}
            stroke={SCENE.outline}
            strokeWidth={0.7 * s}
          />
        ))}
        {/* Celleklyngen på havbunnen (sylindre med kuppeltak) */}
        <rect x={r1(x - baseB / 2)} y={r1(baseTopp + cw * 0.3)} width={r1(baseB)} height={r1(Math.max(0, baseH - cw * 0.3))} fill={`url(#${id}b)`} stroke={SCENE.outline} strokeWidth={0.7 * s} />
        {Array.from({ length: celler }, (_, i) => {
          const cx = x - baseB / 2 + cw * (i + 0.5);
          return (
            <g key={i}>
              <path d={`M${r1(cx - cw / 2)},${r1(baseTopp + cw * 0.32)}A${r1(cw / 2)},${r1(cw * 0.32)} 0 0 1 ${r1(cx + cw / 2)},${r1(baseTopp + cw * 0.32)}`} fill={tint(SCENE.concrete, 0.1)} stroke={SCENE.outline} strokeWidth={0.6 * s} />
              <path d={`M${r1(cx + cw / 2)},${r1(baseTopp + cw * 0.32)}V${r1(yb)}`} stroke={shade(SCENE.concrete, 0.3)} strokeWidth={0.6 * s} />
            </g>
          );
        })}
      </g>
    );
  }
  if (type === 'flytende') {
    const pongTopp = y + 13 * u;
    const pongH = 8 * u;
    const pb = 1.15 * W;
    const ankre = [-1, 1].map((sgn) => {
      const a: P = [x + sgn * pb * 0.5, pongTopp + pongH * 0.5];
      const spenn = Math.min(1.9 * (yb - y), 2.6 * W);
      const b: P = [x + sgn * (pb * 0.5 + spenn), yb];
      const kontroll: P = [a[0] + sgn * spenn * 0.62, yb - 0.02 * (yb - y)];
      return `M${r1(a[0])},${r1(a[1])}Q${r1(kontroll[0])},${r1(kontroll[1])} ${r1(b[0])},${r1(b[1])}`;
    });
    return (
      <g>
        {ankre.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={shade(SCENE.metalDark, 0.1)} strokeWidth={Math.max(0.8, 0.5 * u) * s} />
        ))}
        {/* Stigerør fra brønnhodet på havbunnen opp til dekket */}
        <path d={`M${r1(x + 10 * u)},${r1(yb)}C${r1(x + 13 * u)},${r1(yb - 0.4 * (yb - y))} ${r1(x + 8 * u)},${r1(y + 0.3 * (yb - y))} ${r1(x + 10 * u)},${r1(dekkBunn)}`} fill="none" stroke={stal} strokeWidth={Math.max(0.8, 0.9 * u) * s} />
        <rect x={r1(x + 8.4 * u)} y={r1(yb - 3.6 * u)} width={r1(3.2 * u)} height={r1(3.6 * u)} fill={mix(PAINTS.gul, SCENE.metal, 0.4)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
        {[-0.38, 0.38].map((t) => (
          <rect key={t} x={r1(x + t * W - 4.5 * u)} y={r1(dekkBunn)} width={r1(9 * u)} height={r1(pongTopp - dekkBunn)} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.7 * s} />
        ))}
        <rect x={r1(x - pb / 2)} y={r1(pongTopp)} width={r1(pb)} height={r1(pongH)} rx={r1(3 * u)} fill={`url(#${id}s)`} stroke={SCENE.outline} strokeWidth={0.7 * s} />
        <rect x={r1(x - pb * 0.3)} y={r1(dekkBunn + 6 * u)} width={r1(pb * 0.6)} height={r1(2 * u)} fill={stal} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      </g>
    );
  }
  // Stålunderstell (jacket): fire bein som spriker mot bunnen, med kryssavstivning og lederør for brønnene
  const dyp = yb - dekkBunn;
  const topp = 0.36 * W;
  const bunn = topp + 0.12 * dyp;
  const nivaa = Math.max(2, Math.round(dyp / (22 * u)));
  const ys = Array.from({ length: nivaa + 1 }, (_, i) => dekkBunn + 6 * u + ((dyp - 6 * u) * i) / nivaa);
  const halv = (yy: number) => topp + ((bunn - topp) * (yy - dekkBunn)) / dyp;
  let kryss = '';
  let bak = '';
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i]!;
    const b = ys[i + 1]!;
    kryss += `M${r1(x - halv(a))},${r1(a)}L${r1(x + halv(b))},${r1(b)}M${r1(x + halv(a))},${r1(a)}L${r1(x - halv(b))},${r1(b)}`;
    kryss += `M${r1(x - halv(b))},${r1(b)}H${r1(x + halv(b))}`;
    bak += `M${r1(x - halv(a) * 0.55)},${r1(a)}L${r1(x + halv(b) * 0.55)},${r1(b)}`;
  }
  const bein = Math.max(1.2, 1.6 * u);
  return (
    <g strokeLinecap="round">
      <path d={bak} stroke={shade(stal, 0.25)} strokeWidth={Math.max(0.6, 0.6 * u) * s} opacity={0.6} />
      {[-0.55, 0.55].map((t) => (
        <path key={t} d={`M${r1(x + t * topp)},${r1(dekkBunn)}L${r1(x + t * bunn)},${r1(yb)}`} stroke={shade(stal, 0.25)} strokeWidth={bein * 0.8} opacity={0.7} />
      ))}
      <path d={kryss} stroke={stal} strokeWidth={Math.max(0.6, 0.75 * u) * s} />
      {[-1, 1].map((t) => (
        <g key={t}>
          <path d={`M${r1(x + t * topp)},${r1(dekkBunn)}L${r1(x + t * bunn)},${r1(yb)}`} stroke={SCENE.outline} strokeWidth={bein + 1.2 * s} />
          <path d={`M${r1(x + t * topp)},${r1(dekkBunn)}L${r1(x + t * bunn)},${r1(yb)}`} stroke={t < 0 ? tint(stal, 0.15) : shade(stal, 0.1)} strokeWidth={bein} />
        </g>
      ))}
      {/* Lederør for brønnene ned til havbunnen */}
      {[8, 10, 12].map((dx) => (
        <path key={dx} d={`M${r1(x + dx * u)},${r1(dekkBunn)}V${r1(yb)}`} stroke={shade(stal, 0.2)} strokeWidth={Math.max(0.5, 0.45 * u) * s} />
      ))}
      {[-1, 1].map((t) => (
        <rect key={`f${t}`} x={r1(x + t * bunn - 2.5 * u)} y={r1(yb - 1.5 * u)} width={r1(5 * u)} height={r1(1.5 * u)} fill={stal} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      ))}
    </g>
  );
}

function Vannlinje({ type, x, y, u, s }: { type: PlattformType; x: number; y: number; u: number; s: number }) {
  const W = 60 * u;
  const steder = type === 'betong' ? [-0.24, 0.24].map((t) => [x + t * W, 3.6 * u] as const) : type === 'flytende' ? [-0.38, 0.38].map((t) => [x + t * W, 4.5 * u] as const) : [-0.37, 0.37].map((t) => [x + t * W, 1.6 * u] as const);
  return (
    <g stroke={SCENE.highlight} strokeLinecap="round" strokeWidth={1.4 * s} opacity={0.9}>
      {steder.map(([sx, b], i) => (
        <path key={i} d={`M${r1(sx - b - 3 * u)},${r1(y)}H${r1(sx - b - 0.5 * u)}M${r1(sx + b + 0.5 * u)},${r1(y)}H${r1(sx + b + 3 * u)}`} />
      ))}
    </g>
  );
}

function Toppside({ x, u, W, dekkBunn, dekkTopp, id, s, gul, fakkel }: { x: number; u: number; W: number; dekkBunn: number; dekkTopp: number; id: string; s: number; gul: string; fakkel: boolean }) {
  const L = x - W / 2;
  const stal = shade(SCENE.metal, 0.1);
  const modul = (mx: number, mw: number, mh: number, farge: string, vinduer = false) => (
    <g key={`${mx}`}>
      <rect x={r1(mx)} y={r1(dekkTopp - mh)} width={r1(mw)} height={r1(mh)} fill={farge} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      <rect x={r1(mx)} y={r1(dekkTopp - mh)} width={r1(mw)} height={r1(mh)} fill={`url(#${id}l)`} />
      {vinduer &&
        [0.25, 0.55].map((t) => (
          <path key={t} d={`M${r1(mx + 1.2 * u)},${r1(dekkTopp - mh + mh * t)}H${r1(mx + mw - 1.2 * u)}`} stroke={GLASS} strokeWidth={Math.max(0.8, 1.6 * u)} strokeDasharray={`${r2(1.6 * u)} ${r2(1 * u)}`} />
        ))}
    </g>
  );
  // Boretårnet: fagverk som smalner oppover
  const tb = 11 * u;
  const tt = 3 * u;
  const tx = x + 12 * u;
  const tTopp = dekkTopp - 50 * u;
  const tBunn = dekkTopp - 9 * u;
  let fag = '';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = tBunn + ((tTopp - tBunn) * i) / n;
    const b = tBunn + ((tTopp - tBunn) * (i + 1)) / n;
    const ha = tb / 2 + ((tt - tb) / 2) * (i / n);
    const hb = tb / 2 + ((tt - tb) / 2) * ((i + 1) / n);
    fag += `M${r1(tx - ha)},${r1(a)}L${r1(tx + hb)},${r1(b)}M${r1(tx + ha)},${r1(a)}L${r1(tx - hb)},${r1(b)}M${r1(tx - hb)},${r1(b)}H${r1(tx + hb)}`;
  }
  // Fakkelbommen ut til venstre, 35° opp
  const fb: P = [L + 2 * u, dekkTopp - 6 * u];
  const ft: P = [x - 60 * u, dekkTopp - 34 * u];
  return (
    <g strokeLinejoin="round">
      <LinearGradient id={`${id}l`} stops={[[0, SCENE.highlight, 0.3], [0.5, SCENE.highlight, 0], [1, SCENE.shadow, 0.25]]} />
      {/* Fakkelbom */}
      <path d={`M${r1(fb[0])},${r1(fb[1])}L${r1(ft[0])},${r1(ft[1])}M${r1(fb[0])},${r1(fb[1] + 2.2 * u)}L${r1(ft[0] + 0.8 * u)},${r1(ft[1] + 1.4 * u)}`} stroke={stal} strokeWidth={Math.max(0.7, 0.8 * u) * s} />
      <path
        d={Array.from({ length: 8 }, (_, i) => {
          const t0 = i / 8;
          const t1 = (i + 1) / 8;
          const a: P = [fb[0] + (ft[0] - fb[0]) * t0, fb[1] + (ft[1] - fb[1]) * t0];
          const b: P = [fb[0] + (ft[0] - fb[0]) * t1, fb[1] + (ft[1] - fb[1]) * t1 + 2 * u * (1 - t1)];
          return `M${r1(a[0])},${r1(a[1] + 2.2 * u * (1 - t0))}L${r1(b[0])},${r1(b[1] - 2 * u * (1 - t1))}`;
        }).join('')}
        stroke={stal}
        strokeWidth={Math.max(0.5, 0.45 * u) * s}
      />
      {fakkel && <Flamme x={ft[0]} y={ft[1]} u={u} s={s} />}
      {/* Dekket (to etasjer med bjelker) */}
      <rect x={r1(L)} y={r1(dekkBunn - 1.4 * u)} width={r1(W)} height={r1(1.4 * u)} fill={stal} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      <rect x={r1(L)} y={r1(dekkTopp)} width={r1(W)} height={r1(1.6 * u)} fill={stal} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      <path d={Array.from({ length: 7 }, (_, i) => `M${r1(L + (W * i) / 6)},${r1(dekkTopp + 1.6 * u)}V${r1(dekkBunn - 1.4 * u)}`).join('')} stroke={stal} strokeWidth={Math.max(0.6, 0.6 * u) * s} />
      {modul(L + 2 * u, 11 * u, 6 * u, mix(PAINTS.hvit, SCENE.metal, 0.25))}
      {/* Boligkvarter med helidekk */}
      {modul(L + 13 * u, 15 * u, 13 * u, mix(PAINTS.hvit, SCENE.concrete, 0.15), true)}
      <path d={poly([[L + 10 * u, dekkTopp - 13.6 * u], [L + 31 * u, dekkTopp - 13.6 * u], [L + 28 * u, dekkTopp - 15 * u], [L + 13 * u, dekkTopp - 15 * u]])} fill={mix(PAINTS.gronn, SCENE.metal, 0.5)} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      <path d={`M${r1(L + 11 * u)},${r1(dekkTopp - 13.6 * u)}L${r1(L + 15 * u)},${r1(dekkTopp - 9 * u)}`} stroke={stal} strokeWidth={Math.max(0.5, 0.5 * u) * s} />
      {/* Livbåter */}
      {[17, 22].map((dx) => (
        <rect key={dx} x={r1(L + dx * u)} y={r1(dekkTopp - 3.2 * u)} width={r1(4 * u)} height={r1(2 * u)} rx={r1(1 * u)} fill={mix(PAINTS.oransje, SCENE.metal, 0.3)} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      ))}
      {modul(x - 2 * u, 8 * u, 7 * u, mix(PAINTS.blaa, SCENE.metal, 0.6))}
      {modul(x + 17 * u, W / 2 - 18 * u, 9 * u, mix(PAINTS.hvit, SCENE.metal, 0.3))}
      {/* Boredekk og boretårn */}
      <rect x={r1(tx - 7 * u)} y={r1(tBunn)} width={r1(14 * u)} height={r1(dekkTopp - tBunn)} fill={mix(PAINTS.hvit, SCENE.metal, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * s} />
      <path d={`M${r1(tx - tb / 2)},${r1(tBunn)}L${r1(tx - tt / 2)},${r1(tTopp)}H${r1(tx + tt / 2)}L${r1(tx + tb / 2)},${r1(tBunn)}`} fill="none" stroke={stal} strokeWidth={Math.max(0.8, 0.8 * u) * s} />
      <path d={fag} stroke={stal} strokeWidth={Math.max(0.4, 0.35 * u) * s} />
      <rect x={r1(tx - tt / 2 - 0.6 * u)} y={r1(tTopp - 2 * u)} width={r1(tt + 1.2 * u)} height={r1(2 * u)} fill={stal} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      {/* Kran */}
      <rect x={r1(x - 6 * u)} y={r1(dekkTopp - 12 * u)} width={r1(2.6 * u)} height={r1(5 * u)} fill={gul} stroke={SCENE.outline} strokeWidth={0.5 * s} />
      <path d={`M${r1(x - 4.7 * u)},${r1(dekkTopp - 11 * u)}L${r1(x - 24 * u)},${r1(dekkTopp - 26 * u)}`} stroke={gul} strokeWidth={Math.max(0.8, 1 * u) * s} strokeLinecap="round" />
      <path d={`M${r1(x - 24 * u)},${r1(dekkTopp - 26 * u)}V${r1(dekkTopp - 17 * u)}`} stroke={SCENE.outline} strokeWidth={0.5 * s} />
    </g>
  );
}

function Flamme({ x, y, u, s }: { x: number; y: number; u: number; s: number }) {
  const h = 7 * u;
  return (
    <g>
      <path d={`M${r1(x)},${r1(y)}C${r1(x - 2.6 * u)},${r1(y - h * 0.4)} ${r1(x - 0.6 * u)},${r1(y - h * 0.7)} ${r1(x + 0.8 * u)},${r1(y - h)}C${r1(x + 1.2 * u)},${r1(y - h * 0.6)} ${r1(x + 2.8 * u)},${r1(y - h * 0.35)} ${r1(x)},${r1(y)}Z`} fill={SCENE.warm} stroke={SCENE.hot} strokeWidth={0.6 * s} />
      <path d={`M${r1(x)},${r1(y)}C${r1(x - 1.2 * u)},${r1(y - h * 0.3)} ${r1(x - 0.2 * u)},${r1(y - h * 0.5)} ${r1(x + 0.4 * u)},${r1(y - h * 0.62)}C${r1(x + 0.8 * u)},${r1(y - h * 0.4)} ${r1(x + 1.2 * u)},${r1(y - h * 0.25)} ${r1(x)},${r1(y)}Z`} fill={tint(SCENE.warm, 0.6)} />
    </g>
  );
}

/** Brønnen i snittet: mørk i lyst tema og lys i mørkt, så den synes mot bergartene. */
const BRONNSTRENG = mix(SCENE.metalDark, VIZ.ink, 0.55);

function PlattformBronnTegning({ bane, u, s, dim }: { bane: readonly P[]; u: number; s: number; dim?: boolean }) {
  if (bane.length < 2) return null;
  const d = pts(bane);
  // Foringsrøret i den øverste delen (tykkere og grått), selve brønnen mørk og smal
  const L = bane.reduce((sum, q, i) => (i ? sum + Math.hypot(q[0] - bane[i - 1]![0], q[1] - bane[i - 1]![1]) : 0), 0);
  const fr = Math.min(L * 0.35, 30 * u);
  const e = bane[bane.length - 1]!;
  return (
    <g opacity={dim ? 0.4 : undefined} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={SCENE.highlight} strokeWidth={Math.max(2.6, 1.6 * u) * s} opacity={0.55} />
      <path d={d} stroke={SCENE.metal} strokeWidth={Math.max(2.2, 1.3 * u) * s} strokeDasharray={`${r2(fr)} ${r2(L + 10)}`} />
      <path d={d} stroke={BRONNSTRENG} strokeWidth={Math.max(1.1, 0.6 * u) * s} />
      <circle cx={r1(e[0])} cy={r1(e[1])} r={r1(Math.max(1.6, 0.9 * u) * s)} fill={BRONNSTRENG} />
    </g>
  );
}
