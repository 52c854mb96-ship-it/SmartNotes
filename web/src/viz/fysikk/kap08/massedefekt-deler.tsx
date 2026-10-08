/**
 * Egne gjenstander til eksempeloppgaven «Energi fra en kjernereaksjon» (scene-kit-et har dem ikke): en skålvekt
 * (Roberval-vekt med skålene oppå), en kullhaug, en lagertank for bensin og en gassflaske. Samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE-farger, kontur og myk skygge.
 */
import { useMemo, type ReactNode } from 'react';
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  sceneRandom,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------- Skålvekt ---------- */

export interface SkaalvektProps {
  /** Midt på bunnen av kassen (på benken). */
  x: number;
  y: number;
  /** Avstanden fra midten til hver skål (figurens enheter). Resten av målene følger denne. */
  arm: number;
  /** Radius til skålene. */
  skaal: number;
  /** Hvor mye venstre skål står lavere enn høyre (figurens enheter, negativt = høyre er lavere). */
  utslag: number;
  /** Innholdet i skålene, tegnet oppå: (x, y) er midt på skålen der ting kan ligge. */
  venstre?: (x: number, y: number) => ReactNode;
  hoyre?: (x: number, y: number) => ReactNode;
  /** Tekst foran på kassen under hver skål (f.eks. massen). */
  merkeVenstre?: ReactNode;
  merkeHoyre?: ReactNode;
}

/** Høyden på kassen og hvor høyt skålene står over kassen (i forhold til `arm`). */
export function skaalvektMaal(arm: number) {
  const box = Math.max(46, arm * 0.3);
  const post = Math.max(24, arm * 0.16);
  return { box, post, width: 2 * arm + Math.max(50, arm * 0.36) };
}

/**
 * Skålvekt (Roberval-vekt): en kasse i tre med en stang opp til hver skål. Skålene holder seg vannrette, og den tyngste
 * siden synker. En viser foran på kassen peker mot den tyngste siden. (x, y) er midt på bunnen av kassen.
 */
export function Skaalvekt({ x, y, arm, skaal, utslag, venstre, hoyre, merkeVenstre, merkeHoyre }: SkaalvektProps) {
  const ss = useStrokeScale();
  const wood = useSvgId('vekt-tre');
  const front = useSvgId('vekt-front');
  const metal = useSvgId('vekt-metall');
  const pan = useSvgId('vekt-skaal');
  const plate = useSvgId('vekt-skilt');
  const { box, post, width } = skaalvektMaal(arm);
  const top = y - box;
  const lip = Math.max(5, box * 0.12);
  const xl = x - arm;
  const xr = x + arm;
  const panY = (side: -1 | 1) => top - post + (side < 0 ? utslag / 2 : -utslag / 2);
  const yl = panY(-1);
  const yr = panY(1);
  const depth = skaal * 0.22;
  // Viseren foran på kassen: dreier mot den tyngste siden (maks 24°).
  const tilt = Math.max(-24, Math.min(24, (-utslag / Math.max(1, arm)) * 260));
  const pivotY = y - box * 0.18;
  const needle = box * 0.62;
  const ang = (tilt * Math.PI) / 180;
  const tipX = x + Math.sin(ang) * needle;
  const tipY = pivotY - Math.cos(ang) * needle;
  const plateW = Math.min(width * 0.16, box * 1.5);

  const drawPan = (cx: number, cy: number) => (
    <g>
      {/* Stanga ned i kassen, med en liten krage. */}
      <rect x={cx - 3.2 * ss} y={cy} width={6.4 * ss} height={top - cy + 2} fill={`url(#${metal})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={cx - 9 * ss} y={top - 4 * ss} width={18 * ss} height={5 * ss} rx={2 * ss} fill={shade(SCENE.metal, 0.15)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={cx - 11 * ss} y={cy + 2} width={22 * ss} height={5 * ss} rx={2 * ss} fill={shade(SCENE.metal, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Skålen: en grunn bolle i messing med blank kant. */}
      <path
        d={`M${r2(cx - skaal)} ${r2(cy)} Q${r2(cx - skaal * 0.82)} ${r2(cy + depth)} ${r2(cx)} ${r2(cy + depth)} Q${r2(cx + skaal * 0.82)} ${r2(cy + depth)} ${r2(cx + skaal)} ${r2(cy)} Z`}
        fill={`url(#${pan})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      <ellipse cx={cx} cy={cy} rx={skaal} ry={Math.max(2.5, skaal * 0.07)} fill={tint(SCENE.gold, 0.25)} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={cx} cy={cy} rx={skaal * 0.9} ry={Math.max(1.6, skaal * 0.045)} fill={shade(SCENE.gold, 0.08)} />
    </g>
  );

  return (
    <g>
      <LinearGradient id={wood} stops={materialStops(SCENE.wood, 0.9)} />
      <LinearGradient id={front} stops={[[0, SCENE.wood], [1, shade(SCENE.wood, 0.28)]]} />
      <LinearGradient id={metal} x2={1} y2={0} stops={[[0, shade(SCENE.metal, 0.2)], [0.35, tint(SCENE.metalLight, 0.3)], [1, shade(SCENE.metal, 0.3)]]} />
      <LinearGradient id={pan} stops={[[0, tint(SCENE.gold, 0.15)], [1, shade(SCENE.gold, 0.35)]]} />
      <LinearGradient id={plate} stops={materialStops(tint(SCENE.metalLight, 0.35), 0.6)} />
      <ContactShadow cx={x} cy={y} rx={width * 0.54} />
      {/* Kassen: lokk med kant og en framside med to merkeskilt og viseren. */}
      <rect x={x - width / 2} y={top + lip} width={width} height={box - lip} rx={3 * ss} fill={`url(#${front})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x - width / 2 - 4 * ss} y={top} width={width + 8 * ss} height={lip} rx={2 * ss} fill={`url(#${wood})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <line x1={x - width / 2 + 3} y1={top + lip + 2} x2={x + width / 2 - 3} y2={top + lip + 2} stroke={alpha(SCENE.highlight, 0.35)} strokeWidth={1.2 * ss} />
      {/* Skiltet med skalaen og viseren. */}
      <rect x={x - plateW / 2} y={top + lip + box * 0.1} width={plateW} height={box * 0.74 - lip} rx={3 * ss} fill={`url(#${plate})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {[-20, -10, 0, 10, 20].map((d) => {
        const a = (d * Math.PI) / 180;
        const r1 = needle * 0.86;
        const rr = needle * (d === 0 ? 0.68 : 0.76);
        return (
          <line
            key={d}
            x1={x + Math.sin(a) * rr}
            y1={pivotY - Math.cos(a) * rr}
            x2={x + Math.sin(a) * r1}
            y2={pivotY - Math.cos(a) * r1}
            stroke={shade(SCENE.metalDark, 0.3)}
            strokeWidth={(d === 0 ? 1.6 : 1) * ss}
          />
        );
      })}
      <line x1={x} y1={pivotY} x2={tipX} y2={tipY} stroke={shade(SCENE.metalDark, 0.45)} strokeWidth={2 * ss} strokeLinecap="round" />
      <circle cx={x} cy={pivotY} r={2.8 * ss} fill={SCENE.gold} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {merkeVenstre}
      {merkeHoyre}
      {drawPan(xl, yl)}
      {drawPan(xr, yr)}
      {venstre?.(xl, yl)}
      {hoyre?.(xr, yr)}
    </g>
  );
}

/* ---------- Kullhaug ---------- */

/**
 * Kullhaug sett fra siden: en kjegle med rasvinkel ca. 35° og ujevn kant, svarte klumper med blanke flater og lys fra
 * venstre. (x, y) er midt på bakken under haugen, `r` er halve bredden og `h` høyden (figurens enheter).
 */
export function Kullhaug({ x, y, r, h, seed = 3 }: { x: number; y: number; r: number; h: number; seed?: number }) {
  const ss = useStrokeScale();
  const body = useSvgId('kull');
  const sheen = useSvgId('kull-glans');
  const coal = mix(SCENE.rubber, SCENE.stoneDark, 0.25);
  const { outline, lumps } = useMemo(() => {
    const rnd = sceneRandom(seed);
    const n = 22;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x - r + 2 * r * t;
      // Kjegle med litt avrundet topp; små hakk langs kanten.
      const u = Math.abs(2 * t - 1);
      const prof = u < 0.12 ? 1 - 0.5 * (u * u) / 0.12 - 0.06 : 1 - u;
      const jag = i === 0 || i === n ? 0 : (rnd() - 0.5) * Math.min(6, h * 0.05);
      pts.push(`${r2(px)},${r2(y - Math.max(0, prof) * h + jag)}`);
    }
    const out: { x: number; y: number; s: number; light: number }[] = [];
    const count = Math.round(Math.min(90, Math.max(18, (r * h) / 70)));
    for (let i = 0; i < count; i++) {
      const t = rnd();
      const u = Math.abs(2 * t - 1);
      const top = y - (1 - u) * h * 0.94;
      const py = top + rnd() * (y - top) * 0.92;
      const s = Math.max(1.6, Math.min(5, h * 0.035)) * (0.7 + rnd() * 0.7);
      out.push({ x: x - r + 2 * r * t, y: py, s, light: t < 0.5 ? 0.35 + rnd() * 0.3 : 0.12 + rnd() * 0.2 });
    }
    return { outline: `M${r2(x - r)},${r2(y)} L${pts.join(' L')} L${r2(x + r)},${r2(y)} Z`, lumps: out };
  }, [x, y, r, h, seed]);
  return (
    <g>
      <LinearGradient id={body} x2={1} y2={0} stops={[[0, tint(coal, 0.16)], [0.45, coal], [1, shade(coal, 0.35)]]} />
      <RadialGradient id={sheen} cx={0.38} cy={0.25} r={0.6} stops={[[0, alpha(SCENE.highlight, 0.22)], [1, alpha(SCENE.highlight, 0)]]} />
      <ContactShadow cx={x + r * 0.08} cy={y} rx={r * 1.08} />
      <path d={outline} fill={`url(#${body})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <path d={outline} fill={`url(#${sheen})`} />
      {lumps.map((l, i) => (
        <g key={i}>
          <path
            d={`M${r2(l.x - l.s)},${r2(l.y)} L${r2(l.x - l.s * 0.3)},${r2(l.y - l.s * 0.8)} L${r2(l.x + l.s)},${r2(l.y - l.s * 0.35)} L${r2(l.x + l.s * 0.6)},${r2(l.y + l.s * 0.5)} Z`}
            fill={shade(coal, 0.25)}
          />
          <path
            d={`M${r2(l.x - l.s * 0.7)},${r2(l.y - l.s * 0.1)} L${r2(l.x - l.s * 0.25)},${r2(l.y - l.s * 0.65)} L${r2(l.x + l.s * 0.5)},${r2(l.y - l.s * 0.35)} Z`}
            fill={alpha(SCENE.highlight, l.light)}
          />
        </g>
      ))}
    </g>
  );
}

/* ---------- Lagertank ---------- */

/**
 * Lagertank for drivstoff (hvit stålsylinder) sett fra siden: svakt hvelvet tak, sveisesømmer mellom platene, en
 * trapp som går på skrå opp langs veggen og et rekkverk på taket. (x, y) er midt på bakken under tanken; `w` er
 * diameteren og `h` høyden på veggen (figurens enheter).
 */
export function Lagertank({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ss = useStrokeScale();
  const wall = useSvgId('tank-vegg');
  const roof = useSvgId('tank-tak');
  const base = PAINTS.hvit;
  const left = x - w / 2;
  const top = y - h;
  const dome = Math.max(3, w * 0.07);
  const rings = Math.max(2, Math.round(h / Math.max(10, w * 0.14)));
  const rail = Math.max(4, h * 0.08);
  return (
    <g>
      <LinearGradient
        id={wall}
        x2={1}
        y2={0}
        stops={[
          [0, shade(base, 0.22)],
          [0.3, tint(base, 0.2)],
          [0.65, base],
          [1, shade(base, 0.3)],
        ]}
      />
      <LinearGradient id={roof} x2={1} y2={0} stops={[[0, shade(base, 0.1)], [0.35, tint(base, 0.3)], [1, shade(base, 0.25)]]} />
      <ContactShadow cx={x + w * 0.06} cy={y} rx={w * 0.62} />
      <rect x={left} y={top} width={w} height={h} fill={`url(#${wall})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {Array.from({ length: rings - 1 }, (_, i) => {
        const yy = top + ((i + 1) * h) / rings;
        return <line key={i} x1={left + 1} y1={yy} x2={left + w - 1} y2={yy} stroke={alpha(SCENE.outline, 0.35)} strokeWidth={0.8 * ss} />;
      })}
      {/* Trappa på skrå opp langs veggen, med rekkverk. */}
      <line x1={left + w * 0.08} y1={y - 1} x2={left + w * 0.62} y2={top + 2} stroke={shade(SCENE.metalDark, 0.1)} strokeWidth={2.4 * ss} strokeLinecap="round" />
      <line
        x1={left + w * 0.08}
        y1={y - 1 - rail}
        x2={left + w * 0.62}
        y2={top + 2 - rail}
        stroke={shade(SCENE.metalDark, 0.1)}
        strokeWidth={1.2 * ss}
        strokeLinecap="round"
      />
      {/* Taket: et lavt hvelv med rekkverk langs kanten. */}
      <path
        d={`M${r2(left - 1)} ${r2(top)} Q${r2(x)} ${r2(top - 2 * dome)} ${r2(left + w + 1)} ${r2(top)} Z`}
        fill={`url(#${roof})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      <path
        d={`M${r2(left + w * 0.55)} ${r2(top - dome * 0.95 - rail)} L${r2(left + w)} ${r2(top - rail)}`}
        stroke={shade(SCENE.metalDark, 0.1)}
        strokeWidth={1.2 * ss}
        fill="none"
      />
      {[0.55, 0.7, 0.85, 1].map((t) => {
        const px = left + w * t;
        const py = top - dome * 4 * (t - (t * t)) * 0.95;
        return <line key={t} x1={px} y1={py} x2={px} y2={py - rail} stroke={shade(SCENE.metalDark, 0.1)} strokeWidth={1 * ss} />;
      })}
      {/* Fot i betong. */}
      <rect x={left - w * 0.03} y={y - Math.max(2, h * 0.03)} width={w * 1.06} height={Math.max(2, h * 0.03)} fill={SCENE.concrete} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/* ---------- Gassflaske ---------- */

/**
 * Gassflaske i stål, stående: sylinder med avrundet skulder, farget skulder (rød for hydrogen, brun for
 * helium, som fargekoden på norske gassflasker), ventil og beskyttelseskrage. (x, y) er midt på bunnen, `h` høyden.
 */
export function Gassflaske({ x, y, h, skulder }: { x: number; y: number; h: number; skulder: string }) {
  const ss = useStrokeScale();
  const body = useSvgId('flaske');
  const cap = useSvgId('flaske-skulder');
  const valve = useSvgId('flaske-ventil');
  const w = h * 0.3;
  const left = x - w / 2;
  const bodyTop = y - h * 0.78;
  const shoulder = w * 0.5;
  const steel = mix(SCENE.metal, PAINTS.graa, 0.5);
  const cylinder = (c: string): [number, string][] => [
    [0, shade(c, 0.25)],
    [0.28, tint(c, 0.28)],
    [0.62, c],
    [1, shade(c, 0.35)],
  ];
  return (
    <g>
      <LinearGradient id={body} x2={1} y2={0} stops={cylinder(steel)} />
      <LinearGradient id={cap} x2={1} y2={0} stops={cylinder(skulder)} />
      <LinearGradient id={valve} x2={1} y2={0} stops={cylinder(SCENE.copper)} />
      <ContactShadow cx={x + w * 0.1} cy={y} rx={w * 0.75} />
      <path
        d={`M${r2(left)} ${r2(y - 2)} L${r2(left)} ${r2(bodyTop)} Q${r2(left)} ${r2(bodyTop - shoulder)} ${r2(x)} ${r2(bodyTop - shoulder)} Q${r2(left + w)} ${r2(bodyTop - shoulder)} ${r2(left + w)} ${r2(bodyTop)} L${r2(left + w)} ${r2(y - 2)} Q${r2(x)} ${r2(y + 2)} ${r2(left)} ${r2(y - 2)} Z`}
        fill={`url(#${body})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      {/* Fargen på skulderen viser gassen. */}
      <path
        d={`M${r2(left)} ${r2(bodyTop + h * 0.04)} L${r2(left)} ${r2(bodyTop)} Q${r2(left)} ${r2(bodyTop - shoulder)} ${r2(x)} ${r2(bodyTop - shoulder)} Q${r2(left + w)} ${r2(bodyTop - shoulder)} ${r2(left + w)} ${r2(bodyTop)} L${r2(left + w)} ${r2(bodyTop + h * 0.04)} Z`}
        fill={`url(#${cap})`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
        strokeLinejoin="round"
      />
      {/* Ventil med håndhjul og krage. */}
      <rect x={x - w * 0.12} y={bodyTop - shoulder - h * 0.09} width={w * 0.24} height={h * 0.1} fill={`url(#${valve})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x - w * 0.3} y={bodyTop - shoulder - h * 0.12} width={w * 0.6} height={h * 0.035} rx={h * 0.015} fill={shade(SCENE.metalDark, 0.1)} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={x + w * 0.12} y={bodyTop - shoulder - h * 0.065} width={w * 0.2} height={h * 0.03} fill={`url(#${valve})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Blank stripe der lyset treffer. */}
      <rect x={left + w * 0.2} y={bodyTop + h * 0.08} width={w * 0.08} height={h * 0.56} rx={w * 0.04} fill={alpha(SCENE.highlight, 0.35)} />
    </g>
  );
}
