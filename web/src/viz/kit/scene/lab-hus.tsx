/**
 * Familien «lab», del 3: strøm i huset og energi. Stikkontakt, sikring, sikringsskap, solcellepanel og panelovn.
 * Eksporteres videre fra lab.tsx.
 */
import { useTextScale } from '../controls';
import { ContactShadow, LinearGradient, RadialGradient, shade, sphereStops, tint, useStrokeScale, useSvgId } from './core';
import { PAINTS, SCENE } from './palette';
import { LAB, ObjectFrame, ObjText, boxStops, circlePath, cylinderStops, fin, r2, useLocalStroke } from './lab-felles';

/* ------------------------------------------------------------------ Stikkontakt */

export interface StikkontaktProps {
  /** Midten av dekselet (ankerpunktet). */
  x: number;
  y: number;
  /** Bredden (og høyden) på dekselet (standard 70). Et ekte deksel er ca. 8 cm. */
  size?: number;
  /**
   * Et vinklet støpsel står i, med ledningen rett ned. Ledningen slutter i (x, y + 0,75 · size), der du kan fortsette
   * med <Ledning farge="svart"> (samme tykkelse).
   */
  stopsel?: boolean;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Norsk jordet stikkontakt (Schuko) i veggen, sett forfra: hvitt deksel, rund fordypning med to hull, jordklemmer
 * oppe og nede og skrue i midten. (x, y) er midten av dekselet.
 *   <Stikkontakt x={120} y={200} size={64} stopsel />
 */
export function Stikkontakt({ x, y, size = 70, stopsel = false, rotate, dim, title }: StikkontaktProps) {
  const S = Math.max(6, fin(size, 70));
  const k = S / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('stikkontakt');
  const pl = SCENE.plastic;
  const ol = { stroke: SCENE.outline, strokeWidth: sw(0.9) };
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <LinearGradient id={`${id}-f`} x2={1} y2={1} stops={[[0, tint(pl, 0.3)], [0.5, pl], [1, shade(pl, 0.12)]]} />
      <LinearGradient id={`${id}-w`} x2={1} y2={1} stops={[[0, shade(pl, 0.32)], [0.55, shade(pl, 0.1)], [1, tint(pl, 0.3)]]} />
      <LinearGradient id={`${id}-m`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
      <rect x={-45} y={-43} width={100} height={100} rx={12} fill={SCENE.shadow} opacity={0.5} />
      <rect x={-50} y={-50} width={100} height={100} rx={12} fill={`url(#${id}-f)`} {...ol} />
      <rect x={-44.5} y={-44.5} width={89} height={89} rx={8.5} fill="none" stroke={shade(pl, 0.1)} strokeWidth={sw(1)} />
      <circle cx={0} cy={0} r={25.5} fill={`url(#${id}-w)`} {...ol} />
      <circle cx={0} cy={0} r={21} fill={shade(pl, 0.07)} />
      <path d="M-5.5,-25.6h11v6h-11ZM-5.5,19.6h11v6h-11Z" fill={`url(#${id}-m)`} {...ol} />
      <path d={`${circlePath(-12, 0, 3.4)}${circlePath(12, 0, 3.4)}`} fill={SCENE.rubber} stroke={shade(pl, 0.35)} strokeWidth={sw(0.8)} />
      <circle cx={0} cy={0} r={2.8} fill={tint(SCENE.metal, 0.2)} {...ol} />
      <path d="M-1.9,1.9L1.9,-1.9" stroke={shade(SCENE.metal, 0.45)} strokeWidth={0.9} />
      {stopsel && (
        <g>
          <RadialGradient id={`${id}-p`} fx={0.36} fy={0.3} stops={sphereStops(PAINTS.svart)} />
          <LinearGradient id={`${id}-r`} x2={1} y2={0} stops={cylinderStops(PAINTS.svart, 1.4)} />
          <path d="M0,40V75" stroke={shade(PAINTS.svart, 0.5)} strokeWidth={r2(sw(5) + sw(1.8))} strokeLinecap="round" />
          <path d="M0,40V75" stroke={PAINTS.svart} strokeWidth={r2(sw(5))} strokeLinecap="round" />
          <path d="M-8,17L-4.6,41Q0,43.4 4.6,41L8,17Z" fill={`url(#${id}-r)`} {...ol} />
          <circle cx={0} cy={0} r={23.5} fill={`url(#${id}-p)`} {...ol} />
          <circle cx={0} cy={0} r={17} fill="none" stroke={tint(PAINTS.svart, 0.22)} strokeWidth={1.2} />
          <path d="M-14,-11Q-6,-17.5 3,-17" fill="none" stroke={SCENE.highlight} strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Sikring */

export interface SikringProps {
  /** Midten av sikringen (ankerpunktet). */
  x: number;
  y: number;
  /** Høyden (standard 90). Bredden er 0,21 · size, som en ekte automatsikring (18 × 85 mm). */
  size?: number;
  /**
   * Sikringen har gått (løst ut): vippen står nede og er litt mørkere, og vinduet over vippen viser grønt i stedet for
   * rødt. Vippen glir mykt mellom stillingene.
   */
  gaatt?: boolean;
  /** Merkingen under vippen, f.eks. «16 A». */
  merking?: string;
  rotate?: number;
  dim?: boolean;
  title?: string;
}

/** Fargen i indikatorvinduet: rødt når sikringen er på (kontaktene sluttet), grønt når den har gått. */
function indicatorColor(gaatt: boolean | undefined): string {
  return gaatt ? PAINTS.gronn : PAINTS.rod;
}

/** Toningen på vippen: mørk plast, litt mørkere når sikringen har gått. */
function leverStops(gaatt: boolean | undefined): [number, string][] {
  const c = gaatt ? shade(SCENE.rubberLight, 0.22) : SCENE.rubberLight;
  return [
    [0, tint(c, 0.3)],
    [1, c],
  ];
}

/**
 * Automatsikring for en kurs, sett forfra: hvitt hus med skruer oppe og nede, et lite vindu som viser rødt (på) eller
 * grønt (gått), og en vippe som står oppe (på) eller nede (gått). (x, y) er midten.
 *   <Sikring x={200} y={160} size={120} gaatt={I > 16} merking="16 A" />
 */
export function Sikring({ x, y, size = 90, gaatt = false, merking, rotate, dim, title }: SikringProps) {
  const S = Math.max(10, fin(size, 90));
  const k = S / 100;
  const sw = useLocalStroke(k);
  const id = useSvgId('sikring');
  const pl = SCENE.plastic;
  const print = shade(pl, 0.74);
  const ol = { stroke: SCENE.outline, strokeWidth: sw(0.9) };
  const label = merking ?? '';
  return (
    <ObjectFrame x={x} y={y} k={k} rotate={rotate} dim={dim} title={title}>
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={boxStops(pl, 1.2)} />
      <LinearGradient id={`${id}-v`} stops={leverStops(gaatt)} />
      <RadialGradient id={`${id}-s`} fx={0.36} fy={0.32} stops={sphereStops(SCENE.metal)} />
      <rect x={-10.5} y={-50} width={21} height={100} rx={2.5} fill={`url(#${id}-b)`} {...ol} />
      <path d="M-6.5,-45h13v10.5h-13ZM-6.5,34.5h13v10.5h-13Z" fill={shade(pl, 0.42)} />
      <path d={`${circlePath(0, -39.8, 4)}${circlePath(0, 39.8, 4)}`} fill={`url(#${id}-s)`} {...ol} />
      <path d="M-2.5,-39.8H2.5M-2.5,39.8H2.5" stroke={shade(SCENE.metal, 0.5)} strokeWidth={1.1} />
      {/* Indikatorvindu */}
      <rect x={-4.6} y={-31.6} width={9.2} height={4.6} rx={1} fill={indicatorColor(gaatt)} stroke={shade(pl, 0.55)} strokeWidth={sw(0.8)} />
      <rect x={-10.5} y={-25} width={21} height={50} rx={1.5} fill={tint(pl, 0.2)} {...ol} />
      <rect x={-4.6} y={-16} width={9.2} height={32} rx={2} fill={shade(pl, 0.55)} />
      <ObjText x={7.6} y={-12} size={4.6} fill={print} weight={700}>
        I
      </ObjText>
      <ObjText x={7.6} y={8} size={4.6} fill={print} weight={700}>
        O
      </ObjText>
      <g className="sc-ease" style={{ transform: `translateY(${gaatt ? 17 : 0}px)` }}>
        <rect x={-5.6} y={-17.5} width={11.2} height={17} rx={2.6} fill={`url(#${id}-v)`} {...ol} />
        <path d="M-3.4,-15.6H3.4" stroke={SCENE.highlight} strokeWidth={1} strokeLinecap="round" opacity={gaatt ? 0.6 : 1} />
      </g>
      {label && (
        <ObjText x={0} y={22.2} size={Math.min(6, 18 / Math.max(1, label.length * 0.6))} fill={print} weight={750}>
          {label}
        </ObjText>
      )}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Sikringsskap */

/** Omtrentlig bredde på et tegn i halvfet skrift, som andel av skriftstørrelsen (målt: 0,57 SF, 0,66 DejaVu). */
const CHAR_W = 0.62;
/** Minste skriftstørrelse for navnene (figurens enheter, vokser ikke på mobil): 0,65 av vanlig etikettstørrelse. */
const NAME_FLOOR = 17 * 0.72 * 0.65;

/** Mulige linjeskift i et navn: ved mellomrom, bindestrek eller myk bindestrek (U+00AD). Det beste skiftet først. */
function splitName(navn: string): [string, string] | null {
  let best: [string, string] | null = null;
  let bestLen = Infinity;
  for (let i = 1; i < navn.length - 1; i++) {
    const ch = navn[i];
    let a: string;
    let b: string;
    if (ch === ' ') {
      a = navn.slice(0, i);
      b = navn.slice(i + 1);
    } else if (ch === '-' || ch === '­') {
      a = `${navn.slice(0, i)}-`;
      b = navn.slice(i + 1);
    } else continue;
    a = a.replace(/­/g, '').trim();
    b = b.replace(/­/g, '').trim();
    const len = Math.max(a.length, b.length);
    if (a && b && len < bestLen) {
      best = [a, b];
      bestLen = len;
    }
  }
  return best;
}

interface NameFit {
  /** Navnet uten myke bindestreker. */
  full: string;
  split: [string, string] | null;
  /** Største størrelse navnet får plass med (på én eller to linjer). */
  best: number;
}

export interface SikringsKurs {
  /**
   * Navnet på kursen, f.eks. «Kjøkken». Lange navn brytes til to linjer ved mellomrom eller bindestrek; skriv en myk
   * bindestrek (­) der et langt ord kan deles: 'Varme­kabler'. Passer det fortsatt ikke, forkortes det med «…».
   */
  navn: string;
  /** Sikringen har gått (vippen nede, grønt i vinduet). */
  gaatt?: boolean;
  /** Merkingen under sikringen, f.eks. «16 A». */
  merking?: string;
}

export interface SikringsskapProps {
  /** Midten av skapet (ankerpunktet). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Kursene fra venstre mot høyre (mer enn ti kurser fordeles på to rader). */
  kurser: SikringsKurs[];
  dim?: boolean;
  title?: string;
}

/**
 * Sikringsskap uten dør, sett forfra: én automatsikring per kurs med navnet over og merkingen under. Den som har gått,
 * har vippen nede og grønt i vinduet (de andre rødt). Alle navnene har samme størrelse; lange navn brytes til to linjer
 * og forkortes med «…» bare når de fortsatt ikke får plass (hele navnet står da i <title>). Gjør skapet bredt eller
 * bruk få kurser når navnene skal kunne leses på mobil, eller pek på én kurs med <Callout>. (x, y) er midten.
 *   <Sikringsskap x={400} y={170} w={360} h={220} kurser={[{ navn: 'Kjøkken', merking: '16 A' }, { navn: 'Bad', gaatt: true }]} />
 */
export function Sikringsskap({ x, y, w, h, kurser, dim, title }: SikringsskapProps) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const id = useSvgId('sikringsskap');
  const W = Math.max(40, fin(w, 300));
  const H = Math.max(40, fin(h, 200));
  const list = kurser.length > 0 ? kurser : [{ navn: '' }];
  const n = list.length;
  const rows = n > 10 ? 2 : 1;
  const cols = Math.ceil(n / rows);
  const left = -W / 2;
  const top = -H / 2;
  const pad = Math.min(W, H) * 0.07;
  const iw = W - 2 * pad;
  const ih = H - 2 * pad;
  const colW = iw / cols;
  const rowH = ih / rows;
  const pl = SCENE.plastic;
  const print = shade(pl, 0.76);
  const want = 17 * f * 0.72;
  // Én skriftstørrelse for alle navnene: den største som alle får plass med (på én eller to linjer), men ikke under
  // NAME_FLOOR. Navn som ikke får plass da, forkortes.
  const labelH = rowH * 0.3;
  const room = colW * 0.92;
  const oneMax = labelH * 0.6;
  const twoMax = (labelH * 0.86) / 2.25;
  const fits: NameFit[] = list.map((k) => {
    const full = (k.navn ?? '').replace(/­/g, '');
    const one = Math.min(want, oneMax, room / (Math.max(1, full.length) * CHAR_W));
    const split = splitName(k.navn ?? '');
    const two = split ? Math.min(want, twoMax, room / (Math.max(split[0].length, split[1].length) * CHAR_W)) : 0;
    return { full, split, best: Math.max(one, two) };
  });
  const smallest = Math.min(...fits.map((t) => (t.full ? t.best : want)));
  const nameFs = Math.min(want, oneMax, Math.max(smallest, NAME_FLOOR));
  const layout = fits.map((t) => {
    if (!t.full) return null;
    if (t.full.length * CHAR_W * nameFs <= room + 0.01) return { lines: [t.full], cut: false };
    if (t.split && nameFs <= twoMax + 0.01 && Math.max(t.split[0].length, t.split[1].length) * CHAR_W * nameFs <= room + 0.01) {
      return { lines: t.split, cut: false };
    }
    const keep = Math.max(1, Math.floor(room / (CHAR_W * nameFs)) - 1);
    return { lines: [`${t.full.slice(0, keep).trimEnd()}…`], cut: true };
  });
  const marks = list.map((k) => Math.min(want * 0.92, (colW * 0.9) / (Math.max(1, (k.merking ?? '').length) * CHAR_W), rowH * 0.14));
  const markFs = Math.min(nameFs, ...marks);
  const ol = r2(1 * ss);
  return (
    <ObjectFrame x={x} y={y} dim={dim} title={title}>
      <LinearGradient id={`${id}-c`} x2={1} y2={1} stops={[[0, tint(pl, 0.25)], [0.6, pl], [1, shade(pl, 0.1)]]} />
      <LinearGradient id={`${id}-b`} x2={1} y2={0} stops={boxStops(tint(pl, 0.25), 1.2)} />
      <LinearGradient id={`${id}-v`} stops={leverStops(false)} />
      <LinearGradient id={`${id}-g`} stops={leverStops(true)} />
      <rect x={r2(left + W * 0.02)} y={r2(top + H * 0.03)} width={r2(W)} height={r2(H)} rx={r2(Math.min(W, H) * 0.035)} fill={SCENE.shadow} opacity={0.5} />
      <rect x={r2(left)} y={r2(top)} width={r2(W)} height={r2(H)} rx={r2(Math.min(W, H) * 0.035)} fill={`url(#${id}-c)`} stroke={SCENE.outline} strokeWidth={ol} />
      <rect
        x={r2(left + pad * 0.45)}
        y={r2(top + pad * 0.45)}
        width={r2(W - pad * 0.9)}
        height={r2(H - pad * 0.9)}
        rx={r2(Math.min(W, H) * 0.02)}
        fill={shade(pl, 0.05)}
        stroke={shade(pl, 0.18)}
        strokeWidth={ol}
      />
      {Array.from({ length: rows }, (_, row) => {
        const rowTop = top + pad + row * rowH;
        const zoneTop = rowTop + rowH * 0.34;
        const zoneH = rowH * 0.46;
        const markY = zoneTop + zoneH + rowH * 0.13;
        const bh = Math.min(zoneH * 0.94, colW * 0.6 * 2.5);
        const bw = bh / 2.5;
        const cy = zoneTop + zoneH / 2;
        const items = list.slice(row * cols, row * cols + cols);
        const x0 = left + pad;
        const stripTop = rowTop + labelH * 0.08;
        const stripMid = stripTop + labelH * 0.45;
        // Indikatorvinduene: rødt for kursene som er på, grønt for dem som har gått (én sti per farge).
        const windows = (tripped: boolean) =>
          items
            .map((kurs, j) => {
              if (Boolean(kurs.gaatt) !== tripped) return '';
              const cx = x0 + colW * (j + 0.5);
              return `M${r2(cx - bw * 0.24)},${r2(cy - bh * 0.455)}h${r2(bw * 0.48)}v${r2(bh * 0.075)}h${r2(-bw * 0.48)}Z`;
            })
            .join('');
        const onWin = windows(false);
        const offWin = windows(true);
        return (
          <g key={row}>
            <rect x={r2(x0)} y={r2(stripTop)} width={r2(iw)} height={r2(labelH * 0.9)} rx={r2(Math.min(4, labelH * 0.1))} fill={tint(pl, 0.55)} stroke={shade(pl, 0.2)} strokeWidth={r2(0.7 * ss)} />
            <rect x={r2(x0 + colW * 0.06)} y={r2(cy - bh * 0.56)} width={r2(colW * (items.length - 0.12))} height={r2(bh * 1.12)} rx={r2(bw * 0.08)} fill={shade(pl, 0.5)} />
            {items.map((_, j) => {
              const cx = x0 + colW * (j + 0.5);
              return <rect key={j} x={r2(cx - bw / 2)} y={r2(cy - bh / 2)} width={r2(bw)} height={r2(bh)} rx={r2(bw * 0.1)} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={ol} />;
            })}
            <path
              d={items
                .map((_, j) => {
                  const cx = x0 + colW * (j + 0.5);
                  return `M${r2(cx - bw * 0.22)},${r2(cy - bh * 0.3)}h${r2(bw * 0.44)}v${r2(bh * 0.64)}h${r2(-bw * 0.44)}Z`;
                })
                .join('')}
              fill={shade(pl, 0.55)}
            />
            {onWin && <path d={onWin} fill={indicatorColor(false)} stroke={shade(pl, 0.55)} strokeWidth={r2(0.6 * ss)} />}
            {offWin && <path d={offWin} fill={indicatorColor(true)} stroke={shade(pl, 0.55)} strokeWidth={r2(0.6 * ss)} />}
            {items.map((kurs, j) => {
              const cx = x0 + colW * (j + 0.5);
              return (
                <rect
                  key={j}
                  className="sc-ease"
                  style={{ transform: `translateY(${r2(kurs.gaatt ? bh * 0.33 : 0)}px)` }}
                  x={r2(cx - bw * 0.27)}
                  y={r2(cy - bh * 0.33)}
                  width={r2(bw * 0.54)}
                  height={r2(bh * 0.34)}
                  rx={r2(bw * 0.12)}
                  fill={`url(#${id}-${kurs.gaatt ? 'g' : 'v'})`}
                  stroke={SCENE.outline}
                  strokeWidth={ol}
                />
              );
            })}
            {items.map((_, j) => {
              const lay = layout[row * cols + j];
              if (!lay) return null;
              const cx = x0 + colW * (j + 0.5);
              const two = lay.lines.length === 2;
              const text = (key?: number) => (
                <ObjText key={key} x={cx} y={stripMid + nameFs * (two ? -0.575 + 0.35 : 0.35)} size={nameFs} fill={print} weight={650}>
                  {two ? (
                    <>
                      <tspan x={r2(cx)}>{lay.lines[0]}</tspan>
                      <tspan x={r2(cx)} dy={r2(nameFs * 1.15)}>
                        {lay.lines[1]}
                      </tspan>
                    </>
                  ) : (
                    lay.lines[0]
                  )}
                </ObjText>
              );
              return lay.cut ? (
                <g key={j}>
                  <title>{fits[row * cols + j]!.full}</title>
                  {text()}
                </g>
              ) : (
                text(j)
              );
            })}
            {items.map((kurs, j) =>
              kurs.merking ? (
                <ObjText key={j} x={x0 + colW * (j + 0.5)} y={markY + markFs * 0.35} size={markFs} fill={print} weight={700}>
                  {kurs.merking}
                </ObjText>
              ) : null,
            )}
          </g>
        );
      })}
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Solcellepanel */

export interface SolcellepanelProps {
  /** Festepunktet: foten av stolpen på bakken, eller nederste kant av panelet på taket (ankerpunktet). */
  x: number;
  y: number;
  /** Bredden på panelet langs skråningen (standard 200). Et ekte panel er ca. 1,7 m. */
  w?: number;
  /** Vinkelen fra vannrett i grader (0–90). Panelet dreier om toppen av stolpen. */
  vinkel?: number;
  /**
   * På en stolpe (standard: toppen av stolpen er minst 0,55 · w over bakken, høyere når panelet er bratt) eller rett på
   * en flate med samme helning: et tak, eller en fasade med `vinkel={90}` (panelet sitter på venstre side av veggen).
   */
  montering?: 'stolpe' | 'tak';
  /** Standard: panelet stiger mot høyre og vender mot øvre venstre. `flip` speilvender. */
  flip?: boolean;
  dim?: boolean;
  title?: string;
}

/**
 * Solcellepanel med blå celler i aluminiumsramme, sett litt ovenfra og fra venstre, så cellene synes fra 0° (flatt)
 * til 90° (loddrett fasade). Nærmeste kant følger `vinkel` nøyaktig, så du kan tegne innstrålingsvinkelen mot den.
 *   <Solcellepanel x={300} y={300} w={220} vinkel={40} />
 *   <Solcellepanel x={120} y={180} w={160} vinkel={30} montering="tak" />
 *   <Solcellepanel x={260} y={290} w={80} vinkel={90} montering="tak" />  // på en fasade (vegg i x = 260)
 */
export function Solcellepanel({ x, y, w = 200, vinkel = 35, montering = 'stolpe', flip, dim, title }: SolcellepanelProps) {
  const ss = useStrokeScale();
  const id = useSvgId('solcelle');
  const Wp = Math.max(20, fin(w, 200));
  const th = (Math.min(90, Math.max(0, fin(vinkel, 35))) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const ax = Wp * c;
  const ay = -Wp * s;
  // Dybden (bakover i bildet) dreier med panelet: rett opp når det ligger flatt, mot venstre når det står loddrett.
  // Da har flaten synlig areal og celler fra 0° til 90°, mens nærmeste kant følger vinkelen nøyaktig.
  const dd = Wp * 0.2;
  const dx = -dd * 0.6 * s;
  const dy = -dd * (0.2 + 0.8 * c);
  const thick = Math.max(2.6 * ss, Wp * 0.03);
  const tx = s * thick;
  const ty = c * thick;
  const roof = montering === 'tak';
  // Stolpen blir høyere når panelet er bratt, så nederste hjørne alltid er minst 0,1 · w over bakken.
  const postH = Math.max(Wp * 0.55, (Wp * s) / 2 - dy / 2 + ty + Wp * 0.1);
  let n0x: number;
  let n0y: number;
  if (roof) {
    const so = Wp * 0.035;
    n0x = Wp * 0.02 * c - s * (so + thick);
    n0y = -Wp * 0.02 * s - c * (so + thick);
  } else {
    // Midten av flaten ligger på toppen av stolpen; nærmeste kant er en halv dybde foran.
    n0x = -ax / 2 - dx / 2;
    n0y = -postH - dy / 2 - ay / 2;
  }
  const n1x = n0x + ax;
  const n1y = n0y + ay;
  const P = (px: number, py: number) => `${r2(px)},${r2(py)}`;
  const face = `M${P(n0x, n0y)}L${P(n1x, n1y)}L${P(n1x + dx, n1y + dy)}L${P(n0x + dx, n0y + dy)}Z`;
  const band = `M${P(n0x, n0y)}L${P(n1x, n1y)}L${P(n1x + tx, n1y + ty)}L${P(n0x + tx, n0y + ty)}Z`;
  const sil = `M${P(n0x + dx, n0y + dy)}L${P(n1x + dx, n1y + dy)}L${P(n1x, n1y)}L${P(n1x + tx, n1y + ty)}L${P(n0x + tx, n0y + ty)}L${P(n0x, n0y)}Z`;
  let grid = '';
  for (let i = 1; i < 10; i++) {
    const px = n0x + (ax * i) / 10;
    const py = n0y + (ay * i) / 10;
    grid += `M${P(px, py)}L${P(px + dx, py + dy)}`;
  }
  for (let j = 1; j < 4; j++) grid += `M${P(n0x + (dx * j) / 4, n0y + (dy * j) / 4)}L${P(n1x + (dx * j) / 4, n1y + (dy * j) / 4)}`;
  // Brakett under midten av panelet
  const mx = (n0x + n1x) / 2 + tx;
  const my = (n0y + n1y) / 2 + ty;
  const pw = Math.max(4 * ss, Wp * 0.04);
  return (
    <ObjectFrame x={x} y={y} flip={flip} dim={dim} title={title}>
      <LinearGradient
        id={`${id}-f`}
        x2={1}
        y2={1}
        stops={[
          [0, shade(LAB.solar, 0.15)],
          [0.38, LAB.solar],
          [0.5, tint(LAB.solar, 0.32)],
          [0.6, LAB.solar],
          [1, shade(LAB.solar, 0.22)],
        ]}
      />
      <LinearGradient id={`${id}-p`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
      {!roof && (
        <>
          <ContactShadow cx={Wp * 0.06} cy={-1} rx={Wp * (0.18 + 0.32 * c)} ry={Wp * 0.035} />
          <rect x={r2(-pw / 2)} y={r2(-postH)} width={r2(pw)} height={r2(postH)} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={r2(ss)} />
          <path
            d={`M${P(-Wp * 0.07, 0)}L${P(-Wp * 0.05, -Wp * 0.035)}L${P(Wp * 0.05, -Wp * 0.035)}L${P(Wp * 0.07, 0)}Z`}
            fill={SCENE.concrete}
            stroke={SCENE.outline}
            strokeWidth={r2(ss)}
          />
          <path
            d={`M${P(-pw * 0.9, -postH + pw * 0.4)}L${P(mx - pw * 0.2, my)}L${P(pw * 0.9, -postH + pw * 0.4)}Z`}
            fill={shade(SCENE.metal, 0.2)}
            stroke={SCENE.outline}
            strokeWidth={r2(ss)}
            strokeLinejoin="round"
          />
        </>
      )}
      {roof && (
        <path
          d={[0.18, 0.82]
            .map((t) => {
              const bx = n0x + ax * t + tx;
              const by = n0y + ay * t + ty;
              const rx = Wp * (0.02 + 0.96 * t) * c;
              const ry = -Wp * (0.02 + 0.96 * t) * s;
              return `M${P(bx - c * pw * 0.4, by + s * pw * 0.4)}L${P(rx - c * pw * 0.5, ry + s * pw * 0.5)}L${P(rx + c * pw * 0.5, ry - s * pw * 0.5)}L${P(bx + c * pw * 0.4, by - s * pw * 0.4)}Z`;
            })
            .join('')}
          fill={shade(SCENE.metal, 0.15)}
          stroke={SCENE.outline}
          strokeWidth={r2(0.8 * ss)}
        />
      )}
      <path d={band} fill={tint(SCENE.metal, 0.15)} />
      <path d={face} fill={`url(#${id}-f)`} stroke={tint(SCENE.metal, 0.35)} strokeWidth={r2(1.8 * ss)} strokeLinejoin="round" />
      <path d={grid} stroke={LAB.solarLine} strokeWidth={r2(0.7 * ss)} opacity={0.65} />
      <path d={`M${P(n0x, n0y)}L${P(n1x, n1y)}`} stroke={SCENE.highlight} strokeWidth={r2(1.2 * ss)} />
      <path d={sil} fill="none" stroke={SCENE.outline} strokeWidth={r2(ss)} strokeLinejoin="round" />
    </ObjectFrame>
  );
}

/* ------------------------------------------------------------------ Panelovn */

export interface PanelovnProps {
  /** Midt på bunnen: under føttene, eller underkanten av ovnen med `fotter={false}` (ankerpunktet). */
  x: number;
  y: number;
  /** Bredden (standard 220). En vanlig panelovn er ca. 1 m bred og 0,4 m høy. */
  w?: number;
  /** Høyden på selve ovnen uten føtter (standard 0,4 · w). Føttene er 0,32 · h. */
  h?: number;
  /** Ovnen er på: lampen lyser, varm luft stiger fra risten og veggen over blir varm. */
  paa?: boolean;
  /** Står på føtter (standard). Uten føtter henger den på veggen. */
  fotter?: boolean;
  /** Tid i sekunder (fra useSimClock): den varme lufta bølger. Uten tid står bølgene stille. */
  tid?: number;
  dim?: boolean;
  title?: string;
}

/**
 * Panelovn i hvit lakk, sett forfra: rist for varm luft oppe, luftinntak nede og termostat med lampe til høyre. Når
 * den er på, stiger varm luft fra risten. (x, y) er midt på bunnen.
 *   <Panelovn x={400} y={300} w={240} paa={on} tid={clock.t} />
 */
export function Panelovn({ x, y, w = 220, h, paa = false, fotter = true, tid, dim, title }: PanelovnProps) {
  const ss = useStrokeScale();
  const id = useSvgId('panelovn');
  const W = Math.max(30, fin(w, 220));
  const Hh = Math.max(12, fin(h, W * 0.4));
  const fh = fotter ? Hh * 0.32 : 0;
  const top = -fh - Hh;
  const bot = -fh;
  const white = PAINTS.hvit;
  const rx = Math.min(Hh * 0.08, 7);
  const slotW = Math.max(1.6 * ss, Hh * 0.028);
  const gap = Math.max(5, W * 0.024);
  let slots = '';
  const sx0 = -W / 2 + W * 0.05;
  const sx1 = W / 2 - W * 0.17;
  // Rist for varm luft oppe og luftinntak nede (samme sti, så det ikke blir flere elementer).
  for (let sx = sx0; sx <= sx1; sx += gap) {
    slots += `M${r2(sx)},${r2(top + Hh * 0.09)}V${r2(top + Hh * 0.2)}`;
  }
  for (let sx = sx0; sx <= W / 2 - W * 0.05; sx += gap) {
    slots += `M${r2(sx)},${r2(top + Hh * 0.83)}V${r2(top + Hh * 0.9)}`;
  }
  const tx0 = W / 2 - W * 0.13;
  const tw = W * 0.095;
  const kr = Math.min(Hh * 0.085, W * 0.028);
  const waves: string[] = [];
  if (paa) {
    const t = tid === undefined || !Number.isFinite(tid) ? 0 : tid;
    const span = Hh * 0.8;
    const amp = Math.max(2, W * 0.012);
    for (let i = 0; i < 4; i++) {
      const wx = -W * 0.3 + i * W * 0.18;
      let d = '';
      for (let j = 0; j <= 10; j++) {
        const u = j / 10;
        const px = wx + amp * Math.sin(u * Math.PI * 2.4 - t * 3 + i * 1.7) * (0.5 + u);
        const py = top - Hh * 0.08 - u * span;
        d += `${j ? 'L' : 'M'}${r2(px)},${r2(py)}`;
      }
      waves.push(d);
    }
  }
  return (
    <ObjectFrame x={x} y={y} dim={dim} title={title}>
      <LinearGradient id={`${id}-b`} stops={[[0, tint(white, 0.3)], [0.45, white], [1, shade(white, 0.12)]]} />
      {paa && (
        <>
          <RadialGradient id={`${id}-g`} stops={[[0, SCENE.warm, 0.3], [0.6, SCENE.warm, 0.12], [1, SCENE.warm, 0]]} />
          <LinearGradient id={`${id}-h`} userSpace x1={0} y1={r2(top - Hh * 0.08)} x2={0} y2={r2(top - Hh * 0.9)} stops={[[0, SCENE.warm, 0.9], [1, SCENE.warm, 0]]} />
          <ellipse cx={0} cy={r2(top - Hh * 0.1)} rx={r2(W * 0.62)} ry={r2(Hh * 0.75)} fill={`url(#${id}-g)`} />
        </>
      )}
      {fotter && <ContactShadow cx={0} cy={0} rx={W * 0.45} ry={Math.max(3, Hh * 0.05)} />}
      <rect x={r2(-W / 2 + W * 0.015)} y={r2(top + Hh * 0.06)} width={r2(W)} height={r2(Hh)} rx={r2(rx)} fill={SCENE.shadow} opacity={0.45} />
      {fotter && (
        <path
          d={[-1, 1]
            .map((sd) => {
              const lx = sd * W * 0.36;
              const lw = Math.max(3, W * 0.02);
              return `M${r2(lx - lw / 2)},${r2(bot)}V${r2(-Math.max(2, fh * 0.14))}H${r2(lx - lw * 1.7)}V0H${r2(lx + lw * 1.7)}V${r2(-Math.max(2, fh * 0.14))}H${r2(lx + lw / 2)}V${r2(bot)}Z`;
            })
            .join('')}
          fill={shade(white, 0.15)}
          stroke={SCENE.outline}
          strokeWidth={r2(0.9 * ss)}
          strokeLinejoin="round"
        />
      )}
      <rect x={r2(-W / 2)} y={r2(top)} width={r2(W)} height={r2(Hh)} rx={r2(rx)} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={r2(ss)} />
      <path d={`M${r2(-W / 2 + rx)},${r2(top + 1.2 * ss)}H${r2(W / 2 - rx)}`} stroke={SCENE.highlight} strokeWidth={r2(1.4 * ss)} strokeLinecap="round" />
      <path d={slots} stroke={shade(white, 0.42)} strokeWidth={r2(slotW)} strokeLinecap="round" />
      <rect
        x={r2(tx0)}
        y={r2(top + Hh * 0.09)}
        width={r2(tw)}
        height={r2(Hh * 0.36)}
        rx={r2(Math.min(4, Hh * 0.05))}
        fill={shade(white, 0.06)}
        stroke={shade(white, 0.28)}
        strokeWidth={r2(0.8 * ss)}
      />
      <circle cx={r2(tx0 + tw * 0.34)} cy={r2(top + Hh * 0.27)} r={r2(kr)} fill={tint(white, 0.2)} stroke={shade(white, 0.45)} strokeWidth={r2(0.9 * ss)} />
      <path d={`M${r2(tx0 + tw * 0.34)},${r2(top + Hh * 0.27 - kr * 0.85)}V${r2(top + Hh * 0.27 - kr * 0.25)}`} stroke={shade(white, 0.55)} strokeWidth={r2(1.1 * ss)} strokeLinecap="round" />
      {paa && (
        <>
          <RadialGradient id={`${id}-l`} stops={[[0, SCENE.glow, 0.9], [0.4, SCENE.warm, 0.4], [1, SCENE.warm, 0]]} />
          <circle cx={r2(tx0 + tw * 0.76)} cy={r2(top + Hh * 0.27)} r={r2(kr * 1.6)} fill={`url(#${id}-l)`} />
        </>
      )}
      <circle
        cx={r2(tx0 + tw * 0.76)}
        cy={r2(top + Hh * 0.27)}
        r={r2(Math.max(1.6 * ss, kr * 0.38))}
        fill={paa ? SCENE.warm : shade(white, 0.3)}
        stroke={SCENE.outline}
        strokeWidth={r2(0.6 * ss)}
      />
      {waves.length > 0 && (
        <path d={waves.join('')} fill="none" stroke={`url(#${id}-h)`} strokeWidth={r2(2.2 * ss)} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </ObjectFrame>
  );
}
