/**
 * Egne gjenstander til «Streknings-ATK» (k1-fartskontroll), i samme stil som scene-kit-et: toninger fra core.tsx,
 * SCENE- og PAINTS-farger, kontur og myk skygge. Bare dette kapittelet trenger dem.
 *
 *   <AtkKamera x={x} y={y} m={30} blits />                 ATK-kamera på stolpe med styreskap
 *   <Fartsskilt x={x} y={y} m={30} grense={80} atk />       skiltstolpe med fartsgrense (og ATK-skilt under)
 *   <Kantstolpe x={x} y={y} m={30} />                       kantstolpe langs veikanten
 *   <Instrumentpanel x={16} y={16} R={70} fart={104} snitt={98} grense={80} snittFarge={VIZ.series[1]} />
 *
 * `m` er piksler per meter (samme skala som bilen), og (x, y) er foten på bakken. Gjenstandene har ekte mål.
 */
import { Txt, VIZ, fmt } from '../../kit';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
  type GradientStop,
} from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/** Sylinder sett fra siden med lys fra venstre (stolper): mørk kant, høylys, farge, skygge. */
function cylinderStops(color: string): GradientStop[] {
  return [
    [0, shade(color, 0.22)],
    [0.18, tint(color, 0.4)],
    [0.4, color],
    [0.8, shade(color, 0.16)],
    [1, shade(color, 0.3)],
  ];
}

/* ------------------------------------------------------------------ ATK-kamera */

/** Mål på ATK-kameraet i meter. */
export const ATK_KAMERA_MAAL = {
  /** Høyden fra bakken til toppen av kamerahuset. */
  hoyde: 4.75,
  /** Hvor langt kamerahuset stikker ut til venstre for stolpen (mot trafikken som kommer). */
  utstikk: 1.3,
} as const;

/**
 * ATK-kamera (fotoboks) på en stolpe ved veien, sett fra siden: grått kamerahus med solskjerm og linse mot
 * trafikken som kommer fra venstre, blitsenhet under, og styreskap ved foten. Med `blits` lyser blitsen.
 * Ankerpunkt: foten av stolpen på bakken. Kamerahuset er 4,3–4,75 m over bakken.
 */
export function AtkKamera({ x, y, m, blits = false }: { x: number; y: number; m: number; blits?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('atk-kamera');
  const k = Math.max(0.5, fin(m, 30));
  const sw = (px: number) => r2((px * ss) / k);
  const housing = tint(PAINTS.graa, 0.45);
  return (
    <g aria-hidden>
      <ContactShadow cx={x + 0.15 * k} cy={y} rx={0.75 * k} ry={0.12 * k} />
      <g transform={`translate(${r2(x)} ${r2(y)}) scale(${r2(k)})`}>
        <LinearGradient id={`${id}-p`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
        <LinearGradient id={`${id}-h`} stops={materialStops(housing, 1.2)} />
        <LinearGradient id={`${id}-s`} stops={materialStops(PAINTS.graa, 0.9)} />
        <LinearGradient id={`${id}-b`} stops={materialStops(SCENE.concrete)} />
        {/* Fundament og styreskap */}
        <rect x={-0.4} y={-0.14} width={1.15} height={0.16} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <rect x={0.13} y={-1.2} width={0.52} height={1.06} rx={0.04} fill={`url(#${id}-s)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
        <path d="M0.17,-1.13H0.61M0.17,-0.2H0.61" stroke={SCENE.highlight} strokeWidth={sw(0.8)} />
        <rect x={0.53} y={-0.75} width={0.04} height={0.16} rx={0.02} fill={shade(PAINTS.graa, 0.45)} />
        {/* Stolpen */}
        <rect x={-0.08} y={-4.3} width={0.16} height={4.18} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
        {/* Arm og brakett */}
        <path d="M-0.08,-4.22L-0.36,-4.22L-0.36,-4.3L-0.08,-4.3Z" fill={shade(SCENE.metal, 0.2)} stroke={SCENE.outline} strokeWidth={sw(0.7)} />
        {/* Blitsenheten under kamerahuset */}
        <rect x={-1.02} y={-4.22} width={0.44} height={0.3} rx={0.04} fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <rect x={-1.07} y={-4.18} width={0.07} height={0.22} rx={0.02} fill={blits ? SCENE.glow : shade(PAINTS.rod, 0.45)} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        {/* Kamerahuset med solskjerm og linse mot venstre */}
        <rect x={-1.18} y={-4.62} width={1.0} height={0.4} rx={0.05} fill={`url(#${id}-h)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
        <path d="M-1.3,-4.62L-0.12,-4.62L-0.12,-4.75L-1.22,-4.75Z" fill={shade(housing, 0.12)} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
        <path d="M-1.14,-4.57H-0.24" stroke={SCENE.highlight} strokeWidth={sw(1)} />
        <rect x={-1.26} y={-4.53} width={0.09} height={0.22} rx={0.02} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={sw(0.6)} />
        <rect x={-1.25} y={-4.5} width={0.03} height={0.08} fill={SCENE.highlight} opacity={0.7} />
        <path d="M-0.36,-4.3L-0.36,-4.22" stroke={SCENE.outline} strokeWidth={sw(0.7)} />
      </g>
      {blits && (
        <>
          <RadialGradient
            id={`${id}-g`}
            stops={[
              [0, SCENE.glow, 0.95],
              [0.35, SCENE.glow, 0.45],
              [1, SCENE.glow, 0],
            ]}
          />
          <ellipse cx={x - 1.06 * k} cy={y - 4.07 * k} rx={0.85 * k} ry={0.6 * k} fill={`url(#${id}-g)`} />
        </>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ Skilt */

/** Hvitt skjold med rød kant og tallet i svart, som skilt 362 «Fartsgrense». Sentrert i (cx, cy) med radius r. */
export function FartsgrenseSkjold({ cx, cy, r, grense }: { cx: number; cy: number; r: number; grense: number }) {
  const ss = useStrokeScale();
  const text = fmt(grense, 0);
  return (
    <g aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke={PAINTS.rod} strokeWidth={r * 0.2} />
      <Txt x={cx} y={cy + r * 0.25} px={r * (text.length > 2 ? 0.62 : 0.74)} weight={760} color={PAINTS.svart} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

/**
 * Skiltstolpe med fartsgrense (rundt skilt, 0,8 m) og, med `atk`, det blå skiltet «Automatisk trafikkontroll»
 * (kamera) under. Skiltene er vendt mot leseren, slik lærebokillustrasjoner gjør. Ankerpunkt: foten av stolpen.
 */
export function Fartsskilt({ x, y, m, grense, atk = false }: { x: number; y: number; m: number; grense: number; atk?: boolean }) {
  const ss = useStrokeScale();
  const id = useSvgId('fartsskilt');
  const k = Math.max(0.5, fin(m, 30));
  const top = 2.75;
  const rSign = 0.4 * k;
  const signY = y - (top - 0.4) * k;
  const atkS = 0.56 * k;
  const atkY = signY + rSign + 0.1 * k;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={0.3 * k} ry={0.07 * k} />
      <LinearGradient id={`${id}-p`} x2={1} y2={0} stops={cylinderStops(SCENE.metal)} />
      <rect x={x - 0.04 * k} y={y - top * k + 0.2 * k} width={0.08 * k} height={(top - 0.2) * k} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <FartsgrenseSkjold cx={x} cy={signY} r={rSign} grense={grense} />
      {atk && (
        <g>
          <rect x={x - atkS / 2} y={atkY} width={atkS} height={atkS} rx={atkS * 0.08} fill={PAINTS.blaa} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
          <rect x={x - atkS * 0.44} y={atkY + atkS * 0.06} width={atkS * 0.88} height={atkS * 0.88} rx={atkS * 0.05} fill="none" stroke={PAINTS.hvit} strokeWidth={Math.max(0.6, atkS * 0.03)} />
          {/* Kamerasymbol: hus, linse og søker */}
          <rect x={x - atkS * 0.27} y={atkY + atkS * 0.36} width={atkS * 0.54} height={atkS * 0.34} rx={atkS * 0.05} fill={PAINTS.hvit} />
          <rect x={x - atkS * 0.12} y={atkY + atkS * 0.28} width={atkS * 0.2} height={atkS * 0.1} rx={atkS * 0.02} fill={PAINTS.hvit} />
          <circle cx={x} cy={atkY + atkS * 0.53} r={atkS * 0.11} fill={PAINTS.blaa} />
          <circle cx={x} cy={atkY + atkS * 0.53} r={atkS * 0.055} fill={PAINTS.hvit} />
        </g>
      )}
    </g>
  );
}

/** Kantstolpe (hvit med svart topp og refleks), ca. 1 m høy. Ankerpunkt: foten. */
export function Kantstolpe({ x, y, m }: { x: number; y: number; m: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('kantstolpe');
  const k = Math.max(0.5, fin(m, 30));
  const w = Math.max(2.5, 0.11 * k);
  const h = 1.0 * k;
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={w * 1.4} ry={Math.max(1.5, 0.05 * k)} opacity={0.8} />
      <LinearGradient id={`${id}-w`} x2={1} y2={0} stops={cylinderStops(PAINTS.hvit)} />
      <rect x={x - w / 2} y={y - h} width={w} height={h} fill={`url(#${id}-w)`} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x - w / 2} y={y - h} width={w} height={h * 0.2} fill={PAINTS.svart} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      <rect x={x - w * 0.3} y={y - h * 0.16} width={w * 0.6} height={h * 0.09} fill={PAINTS.gul} />
    </g>
  );
}

/* ------------------------------------------------------------------ Instrumentpanel */

/** Største fart på speedometeret (km/h). */
const SPEEDO_MAX = 160;

/** Vinkelen på speedometeret for farten v (km/h): 0 nede til venstre (−135°), 160 nede til høyre (+135°), med klokka fra rett opp. */
function speedoAngle(v: number): number {
  const c = Math.min(SPEEDO_MAX * 1.02, Math.max(0, fin(v, 0)));
  return ((-135 + (270 * c) / SPEEDO_MAX) * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${r2(x0)},${r2(y0)}A${r2(r)},${r2(r)} 0 ${large} 1 ${r2(x1)},${r2(y1)}`;
}

/** Bredden og høyden på instrumentpanelet med radius R på speedometeret. */
export function instrumentpanelSize(R: number): { w: number; h: number } {
  const pad = 0.16 * R;
  return { w: 2.45 * R + 2 * pad, h: pad + 2 * R + 0.16 * R + 0.4 * R + pad };
}

/**
 * Instrumentpanelet i bilen: et speedometer med viser og digitalt tall (momentanfarten) og kjørecomputeren under,
 * som viser snittfarten siden kamera A. Det røde feltet på skiven er over fartsgrensen, og fartsgrenseskiltet
 * (som bilen leser fra skiltene) står oppe til høyre. (x, y) er øverste venstre hjørne, R radien på speedometeret.
 * `fart` og `snitt` i km/h (`snitt` NaN før bilen har kjørt). Viseren har fartsfargen (VIZ.velocity).
 */
export function Instrumentpanel({
  x,
  y,
  R,
  fart,
  snitt,
  grense,
  snittFarge,
}: {
  x: number;
  y: number;
  R: number;
  fart: number;
  snitt: number;
  grense: number;
  snittFarge: string;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('instrument');
  const pad = 0.16 * R;
  const { w, h } = instrumentpanelSize(R);
  const cx = x + pad + R;
  const cy = y + pad + R;
  const a = speedoAngle(fart);
  const ticks: string[] = ['', ''];
  for (let v = 0; v <= SPEEDO_MAX; v += 10) {
    const big = v % 20 === 0;
    const t = speedoAngle(v);
    const [x0, y0] = polar(cx, cy, 0.83 * R, t);
    const [x1, y1] = polar(cx, cy, (big ? 0.7 : 0.76) * R, t);
    ticks[big ? 0 : 1] += `M${r2(x0)},${r2(y0)}L${r2(x1)},${r2(y1)}`;
  }
  const labels = [40, 80, 120];
  // Viseren: spiss ytterst, bred ved navet og en kort hale på motsatt side
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const P = (along: number, across: number) => `${r2(cx + ux * along * R - uy * across * R)},${r2(cy + uy * along * R + ux * across * R)}`;
  const needle = `M${P(0.8, 0)}L${P(0, 0.038)}L${P(-0.16, 0)}L${P(0, -0.038)}Z`;
  const signR = 0.27 * R;
  const signX = x + w - pad - signR;
  const signY = y + pad + signR;
  const lcdY = cy + R + 0.16 * R;
  const lcdH = 0.4 * R;
  const snittText = `Snitt ${Number.isFinite(snitt) ? fmt(snitt, 0) : '–'} km/h`;
  return (
    <g role="img" aria-label={`Speedometeret viser ${fmt(fart, 0)} km/h. ${Number.isFinite(snitt) ? `Kjørecomputeren viser snittfart ${fmt(snitt, 0)} km/h.` : 'Ingen snittfart ennå.'}`}>
      <LinearGradient
        id={`${id}-p`}
        stops={[
          [0, tint(PAINTS.svart, 0.14)],
          [1, shade(PAINTS.svart, 0.3)],
        ]}
      />
      <RadialGradient
        id={`${id}-b`}
        fx={0.34}
        fy={0.28}
        stops={[
          [0, SCENE.metalLight],
          [0.6, SCENE.metal],
          [1, SCENE.metalDark],
        ]}
      />
      <RadialGradient
        id={`${id}-f`}
        cy={0.42}
        r={0.6}
        stops={[
          [0, tint(PAINTS.svart, 0.1)],
          [1, shade(PAINTS.svart, 0.45)],
        ]}
      />
      <rect x={x} y={y} width={w} height={h} rx={0.2 * R} fill={`url(#${id}-p)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <path d={`M${r2(x + 0.2 * R)},${r2(y + 1.2 * ss)}H${r2(x + w - 0.2 * R)}`} stroke={SCENE.highlight} strokeWidth={1 * ss} opacity={0.6} />
      {/* Skiven */}
      <circle cx={cx} cy={cy} r={R} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <circle cx={cx} cy={cy} r={0.92 * R} fill={`url(#${id}-f)`} />
      <path d={arc(cx, cy, 0.86 * R, speedoAngle(grense), speedoAngle(SPEEDO_MAX))} fill="none" stroke={tint(PAINTS.rod, 0.15)} strokeWidth={0.06 * R} opacity={0.95} />
      <path d={ticks[1]} stroke={PAINTS.hvit} strokeWidth={Math.max(0.7, 0.012 * R) * ss} opacity={0.75} />
      <path d={ticks[0]} stroke={PAINTS.hvit} strokeWidth={Math.max(1.2, 0.028 * R) * ss} />
      {labels.map((v) => {
        const [lx, ly] = polar(cx, cy, 0.53 * R, speedoAngle(v));
        return (
          <Txt key={v} x={lx} y={ly + 0.09 * R} px={0.2 * R} weight={650} color={PAINTS.hvit} halo={false}>
            {v}
          </Txt>
        );
      })}
      {/* Digital fart */}
      <Txt x={cx} y={cy + 0.5 * R} px={0.34 * R} weight={760} color={tint(VIZ.velocity, 0.3)} halo={false}>
        {fmt(fart, 0)}
      </Txt>
      <Txt x={cx} y={cy + 0.7 * R} px={0.14 * R} weight={600} color={PAINTS.hvit} halo={false}>
        km/h
      </Txt>
      {/* Viseren */}
      <path d={needle} fill={VIZ.velocity} stroke={shade(VIZ.velocity, 0.45)} strokeWidth={0.8 * ss} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={0.1 * R} fill={`url(#${id}-b)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path d={arc(cx, cy, 0.86 * R, -2.2, -1.2)} fill="none" stroke={alpha(SCENE.metalLight, 0.9)} strokeWidth={0.035 * R} strokeLinecap="round" opacity={0.35} />
      {/* Fartsgrensen som bilen har lest fra skiltene */}
      <FartsgrenseSkjold cx={signX} cy={signY} r={signR} grense={grense} />
      {/* Kjørecomputeren */}
      <rect x={x + pad} y={lcdY} width={w - 2 * pad} height={lcdH} rx={0.06 * R} fill={SCENE.display} stroke={shade(SCENE.metal, 0.4)} strokeWidth={0.7 * ss} />
      <Txt x={x + w / 2} y={lcdY + lcdH * 0.68} px={0.25 * R} weight={700} color={tint(snittFarge, 0.2)} halo={false}>
        {snittText}
      </Txt>
    </g>
  );
}
