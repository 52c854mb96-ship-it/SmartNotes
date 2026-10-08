/**
 * Gjenstandene i laboratoriescenen til «Halveringstid»: prøvene (trekull, medisinglass, glass med kjellerluft,
 * strålekilde i blybeholder og alunskifer), geiger-müller-røret på stativ og telleapparatet med display og høyttaler.
 * Samme stil som scene-kit-et: toninger fra core.tsx, SCENE-farger, kontur og myk skygge. Alle mål er i meter og
 * tegnes med skalaen P (px/m), så proporsjonene er riktige.
 *
 * Ankerpunkt for prøvene: (x, y) er midt på bunnen, på benken. y-aksen peker ned som i SVG.
 */
import {
  ContactShadow,
  LinearGradient,
  PAINTS,
  RadialGradient,
  SCENE,
  alpha,
  materialStops,
  mix,
  shade,
  sphereStops,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';

export type SampleType = 'trekull' | 'medisinglass' | 'glass' | 'blybeholder' | 'skifer';

/** Målene til prøvene (m): bredde og høyde over benken. `inner` er luftrommet i glasset (y opp fra benken). */
export const SAMPLE_GEOM: Record<SampleType, { w: number; h: number; inner?: { x0: number; y0: number; x1: number; y1: number } }> = {
  trekull: { w: 0.07, h: 0.032 },
  medisinglass: { w: 0.03, h: 0.056 },
  glass: { w: 0.056, h: 0.064, inner: { x0: -0.024, y0: 0.004, x1: 0.024, y1: 0.047 } },
  blybeholder: { w: 0.05, h: 0.045 },
  skifer: { w: 0.078, h: 0.03 },
};

/** Geiger-müller-røret (m): lengde, radius, endelokket og kontakten på toppen. */
export const GM = { len: 0.12, r: 0.0135, cap: 0.016, bnc: 0.01 } as const;

/** Telleapparatet (m). Kontakten for kabelen sitter på høyre side, `connY` over benken. */
export const COUNTER = { w: 0.15, h: 0.085, connY: 0.05 } as const;

const r2 = (v: number) => Math.round(v * 100) / 100;
const pts = (list: [number, number][]) => list.map(([a, b]) => `${r2(a)},${r2(b)}`).join(' ');

/** Prøven av riktig type. */
export function Sample({ type, x, y, P }: { type: SampleType; x: number; y: number; P: number }) {
  switch (type) {
    case 'trekull':
      return <Trekull x={x} y={y} P={P} />;
    case 'medisinglass':
      return <Medisinglass x={x} y={y} P={P} />;
    case 'glass':
      return <Glasskrukke x={x} y={y} P={P} />;
    case 'blybeholder':
      return <Blybeholder x={x} y={y} P={P} />;
    case 'skifer':
      return <Skifer x={x} y={y} P={P} />;
  }
}

/** Faresymbolet for ioniserende stråling: svart trekløver på gul bunn. (x, y) er midten, `r` radien til skiltet. */
export function Faresymbol({ x, y, r, bunn = true }: { x: number; y: number; r: number; bunn?: boolean }) {
  const R = r * 0.17;
  const ri = R * 1.5;
  const ro = R * 4.9;
  const blade = (deg: number) => {
    const a1 = ((deg - 30) * Math.PI) / 180;
    const a2 = ((deg + 30) * Math.PI) / 180;
    const p = (rr: number, a: number) => `${r2(x + rr * Math.cos(a))},${r2(y + rr * Math.sin(a))}`;
    return `M${p(ri, a1)} L${p(ro, a1)} A${r2(ro)} ${r2(ro)} 0 0 1 ${p(ro, a2)} L${p(ri, a2)} A${r2(ri)} ${r2(ri)} 0 0 0 ${p(ri, a1)} Z`;
  };
  return (
    <g aria-hidden>
      {bunn && <circle cx={x} cy={y} r={r} fill={PAINTS.gul} stroke={shade(PAINTS.gul, 0.45)} strokeWidth={Math.max(0.5, r * 0.06)} />}
      <circle cx={x} cy={y} r={R} fill={PAINTS.svart} />
      {[90, 210, 330].map((d) => (
        <path key={d} d={blade(d)} fill={PAINTS.svart} />
      ))}
    </g>
  );
}

/**
 * Varselskilt på veggen i laben: gul trekant med svart kant og strålingssymbolet, og teksten «Radioaktive kilder».
 * (x, y) er midt på overkanten.
 */
export function Varselskilt({ x, y, P }: { x: number; y: number; P: number }) {
  const ss = useStrokeScale();
  const w = 0.072 * P;
  const h = 0.092 * P;
  const tri = 0.058 * P;
  const ty = y + 0.008 * P;
  const th = (tri * Math.sqrt(3)) / 2;
  const fs = 0.0105 * P;
  return (
    <g aria-hidden>
      <rect x={x - w / 2 + 1.5} y={y + 2.5} width={w} height={h} rx={0.004 * P} fill={SCENE.shadow} opacity={0.5} />
      <rect x={x - w / 2} y={y} width={w} height={h} rx={0.004 * P} fill={PAINTS.hvit} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path
        d={`M${r2(x)},${r2(ty)} L${r2(x + tri / 2)},${r2(ty + th)} L${r2(x - tri / 2)},${r2(ty + th)} Z`}
        fill={PAINTS.gul}
        stroke={PAINTS.svart}
        strokeWidth={0.0035 * P}
        strokeLinejoin="round"
      />
      <Faresymbol x={x} y={ty + th * 0.64} r={tri * 0.24} bunn={false} />
      {['Radioaktive', 'kilder'].map((t, i) => (
        <text key={t} x={x} y={ty + th + 0.013 * P + i * fs * 1.15} textAnchor="middle" style={{ fill: PAINTS.svart, fontSize: fs, fontWeight: 700 }}>
          {t}
        </text>
      ))}
    </g>
  );
}

/** Bit av trekull fra et gammelt ildsted: svart, matt glinsende, med de typiske terningformede sprekkene. */
function Trekull({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-kull');
  const ss = useStrokeScale();
  const { w, h } = SAMPLE_GEOM.trekull;
  const W = w * P;
  const Hh = h * P;
  const base = mix(SCENE.rubber, SCENE.woodDark, 0.22);
  const at = (fx: number, fy: number): [number, number] => [x + fx * W, y - fy * Hh];
  const outline: [number, number][] = [
    at(-0.5, 0),
    at(-0.49, 0.4),
    at(-0.4, 0.78),
    at(-0.16, 0.96),
    at(0.12, 1),
    at(0.33, 0.88),
    at(0.47, 0.58),
    at(0.5, 0.14),
    at(0.45, 0),
  ];
  const top: [number, number][] = [at(-0.4, 0.78), at(-0.16, 0.96), at(0.12, 1), at(0.33, 0.88), at(0.18, 0.74), at(-0.06, 0.76), at(-0.3, 0.66)];
  const cracks = [
    `M${pts([at(-0.47, 0.42), at(-0.2, 0.47), at(0.1, 0.43), at(0.46, 0.5)])}`,
    `M${pts([at(-0.2, 0.78), at(-0.18, 0.47)])}`,
    `M${pts([at(0.2, 0.86), at(0.22, 0.45)])}`,
    `M${pts([at(-0.32, 0.45), at(-0.3, 0.03)])}`,
    `M${pts([at(0.06, 0.44), at(0.08, 0.02)])}`,
    `M${pts([at(0.36, 0.48), at(0.33, 0.06)])}`,
  ];
  return (
    <g>
      <title>Trekull</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.55} />
      <LinearGradient id={id} stops={materialStops(base, 1.4)} />
      <polygon points={pts(outline)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      <polygon points={pts(top)} fill={tint(base, 0.2)} opacity={0.75} />
      {cracks.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={shade(base, 0.6)} strokeWidth={1.1 * ss} strokeLinecap="round" />
      ))}
      {/* Glinsende kanter langs sprekkene (trekull har en svak, sølvaktig glans) */}
      <path
        d={`M${pts([at(-0.44, 0.49), at(-0.22, 0.53)])} M${pts([at(-0.15, 0.82), at(-0.15, 0.55)])} M${pts([at(0.25, 0.84), at(0.26, 0.55)])}`}
        fill="none"
        stroke={tint(base, 0.55)}
        strokeWidth={0.9 * ss}
        strokeLinecap="round"
        opacity={0.7}
      />
    </g>
  );
}

/** Lite medisinglass med gummikork og aluminiumshette, litt væske og en etikett med faresymbolet. */
function Medisinglass({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-glass');
  const ss = useStrokeScale();
  const { w, h } = SAMPLE_GEOM.medisinglass;
  const W = w * P;
  const Hh = h * P;
  const bodyTop = y - 0.72 * Hh;
  const neckW = 0.62 * W;
  const capW = 0.72 * W;
  const capTop = y - Hh;
  const capBot = y - 0.8 * Hh;
  const level = y - 0.42 * Hh;
  const rr = 0.14 * W;
  const body = `M${r2(x - W / 2)},${r2(bodyTop + rr)} V${r2(y - rr)} Q${r2(x - W / 2)},${r2(y)} ${r2(x - W / 2 + rr)},${r2(y)} H${r2(x + W / 2 - rr)} Q${r2(x + W / 2)},${r2(y)} ${r2(x + W / 2)},${r2(y - rr)} V${r2(bodyTop + rr)} Q${r2(x + W / 2)},${r2(bodyTop)} ${r2(x + neckW / 2)},${r2(bodyTop - 0.02 * Hh)} V${r2(capBot)} H${r2(x - neckW / 2)} V${r2(bodyTop - 0.02 * Hh)} Q${r2(x - W / 2)},${r2(bodyTop)} ${r2(x - W / 2)},${r2(bodyTop + rr)} Z`;
  return (
    <g>
      <title>Medisinglass med jod-131</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.62} />
      <LinearGradient
        id={`${id}l`}
        x2={1}
        y2={0}
        stops={[
          [0, alpha(SCENE.water, 0.55)],
          [0.5, alpha(tint(SCENE.water, 0.3), 0.4)],
          [1, alpha(shade(SCENE.water, 0.2), 0.6)],
        ]}
      />
      {/* Væsken */}
      <path
        d={`M${r2(x - W / 2 + 1.2)},${r2(level)} V${r2(y - rr)} Q${r2(x - W / 2 + 1.2)},${r2(y - 1.2)} ${r2(x - W / 2 + rr)},${r2(y - 1.2)} H${r2(x + W / 2 - rr)} Q${r2(x + W / 2 - 1.2)},${r2(y - 1.2)} ${r2(x + W / 2 - 1.2)},${r2(y - rr)} V${r2(level)} Z`}
        fill={`url(#${id}l)`}
      />
      <line x1={x - W / 2 + 1.5} y1={level} x2={x + W / 2 - 1.5} y2={level} stroke={alpha(tint(SCENE.water, 0.4), 0.9)} strokeWidth={1 * ss} />
      {/* Glasset */}
      <path d={body} fill={alpha(SCENE.glass, 0.22)} stroke={SCENE.glassEdge} strokeWidth={1.1 * ss} strokeLinejoin="round" />
      {/* Etikett med faresymbol */}
      <rect x={x - W / 2 + 0.5} y={y - 0.6 * Hh} width={W - 1} height={0.3 * Hh} fill={PAINTS.hvit} stroke={alpha(SCENE.outline, 0.5)} strokeWidth={0.6 * ss} />
      <Faresymbol x={x - W * 0.16} y={y - 0.45 * Hh} r={0.1 * Hh} />
      <line x1={x + W * 0.06} y1={y - 0.49 * Hh} x2={x + W * 0.4} y2={y - 0.49 * Hh} stroke={alpha(SCENE.outline, 0.7)} strokeWidth={1.1 * ss} />
      <line x1={x + W * 0.06} y1={y - 0.41 * Hh} x2={x + W * 0.32} y2={y - 0.41 * Hh} stroke={alpha(SCENE.outline, 0.45)} strokeWidth={1 * ss} />
      {/* Gummikork og aluminiumshette */}
      <LinearGradient
        id={`${id}c`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.15)],
          [0.3, tint(SCENE.metalLight, 0.35)],
          [0.65, SCENE.metal],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <rect x={x - capW / 2} y={capTop} width={capW} height={capBot - capTop + 1} rx={1.5} fill={`url(#${id}c)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <rect x={x - capW * 0.28} y={capTop - 0.03 * Hh} width={capW * 0.56} height={0.05 * Hh} rx={1} fill={shade(PAINTS.rod, 0.15)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      {/* Refleks i glasset */}
      <line x1={x - W * 0.3} y1={bodyTop + rr} x2={x - W * 0.3} y2={y - 0.66 * Hh} stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" opacity={0.75} />
      <line x1={x - W * 0.3} y1={y - 0.25 * Hh} x2={x - W * 0.3} y2={y - rr} stroke={SCENE.highlight} strokeWidth={1.6 * ss} strokeLinecap="round" opacity={0.6} />
    </g>
  );
}

/** Lite sylteglass med skrulokk, fylt med luft fra en kjeller med mye radon. Strålingen (α) stopper i luften inne i glasset. */
function Glasskrukke({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-krukke');
  const ss = useStrokeScale();
  const { w, h } = SAMPLE_GEOM.glass;
  const W = w * P;
  const Hh = h * P;
  const glassTop = y - 0.81 * Hh;
  const lidTop = y - Hh;
  const lidW = W * 0.9;
  const neckW = W * 0.84;
  const rr = 0.16 * W;
  const body = `M${r2(x - W / 2)},${r2(glassTop + rr * 1.3)} V${r2(y - rr)} Q${r2(x - W / 2)},${r2(y)} ${r2(x - W / 2 + rr)},${r2(y)} H${r2(x + W / 2 - rr)} Q${r2(x + W / 2)},${r2(y)} ${r2(x + W / 2)},${r2(y - rr)} V${r2(glassTop + rr * 1.3)} Q${r2(x + W / 2)},${r2(glassTop + rr * 0.2)} ${r2(x + neckW / 2)},${r2(glassTop)} H${r2(x - neckW / 2)} Q${r2(x - W / 2)},${r2(glassTop + rr * 0.2)} ${r2(x - W / 2)},${r2(glassTop + rr * 1.3)} Z`;
  return (
    <g>
      <title>Glass med kjellerluft</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.6} />
      <RadialGradient
        id={`${id}a`}
        cx={0.4}
        cy={0.45}
        r={0.7}
        stops={[
          [0, alpha(SCENE.skyBottom, 0.35)],
          [1, alpha(SCENE.glass, 0.25)],
        ]}
      />
      <path d={body} fill={`url(#${id}a)`} stroke={SCENE.glassEdge} strokeWidth={1.2 * ss} strokeLinejoin="round" />
      {/* Bunnen av glasset sett litt ovenfra */}
      <path
        d={`M${r2(x - W / 2 + rr * 0.6)},${r2(y - 2.5)} Q${r2(x)},${r2(y - 5.5)} ${r2(x + W / 2 - rr * 0.6)},${r2(y - 2.5)}`}
        fill="none"
        stroke={alpha(SCENE.glassEdge, 0.6)}
        strokeWidth={1 * ss}
      />
      {/* Etikett */}
      <rect x={x - W * 0.3} y={y - 0.5 * Hh} width={W * 0.6} height={0.2 * Hh} rx={1.5} fill={PAINTS.hvit} stroke={alpha(SCENE.outline, 0.5)} strokeWidth={0.6 * ss} opacity={0.95} />
      <line x1={x - W * 0.22} y1={y - 0.43 * Hh} x2={x + W * 0.2} y2={y - 0.43 * Hh} stroke={alpha(SCENE.outline, 0.7)} strokeWidth={1.1 * ss} />
      <line x1={x - W * 0.22} y1={y - 0.36 * Hh} x2={x + W * 0.06} y2={y - 0.36 * Hh} stroke={alpha(SCENE.outline, 0.45)} strokeWidth={1 * ss} />
      {/* Skrulokk */}
      <LinearGradient
        id={`${id}l`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.gold, 0.2)],
          [0.3, tint(SCENE.gold, 0.35)],
          [0.7, SCENE.gold],
          [1, shade(SCENE.gold, 0.35)],
        ]}
      />
      <rect x={x - lidW / 2} y={lidTop} width={lidW} height={glassTop - lidTop + 1.5} rx={2} fill={`url(#${id}l)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {[0.3, 0.55, 0.8].map((k) => (
        <line
          key={k}
          x1={x - lidW / 2 + 1}
          y1={lidTop + k * (glassTop - lidTop)}
          x2={x + lidW / 2 - 1}
          y2={lidTop + k * (glassTop - lidTop)}
          stroke={shade(SCENE.gold, 0.35)}
          strokeWidth={0.7 * ss}
          opacity={0.6}
        />
      ))}
      {/* Reflekser i glasset */}
      <path
        d={`M${r2(x - W * 0.36)},${r2(glassTop + rr * 1.4)} V${r2(y - 0.56 * Hh)} M${r2(x - W * 0.36)},${r2(y - 0.26 * Hh)} V${r2(y - rr * 1.1)}`}
        stroke={SCENE.highlight}
        strokeWidth={2 * ss}
        strokeLinecap="round"
        opacity={0.7}
        fill="none"
      />
      <path d={`M${r2(x + W * 0.38)},${r2(glassTop + rr * 1.6)} V${r2(y - rr * 1.4)}`} stroke={SCENE.highlight} strokeWidth={1 * ss} strokeLinecap="round" opacity={0.45} fill="none" />
    </g>
  );
}

/** Strålekilde: en liten stålkapsel med kobolt-60 i en tykk blybeholder (blyet skjermer strålingen til sidene). */
function Blybeholder({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-bly');
  const ss = useStrokeScale();
  const W = 0.05 * P;
  const potH = 0.034 * P;
  const ry = 0.006 * P;
  const top = y - potH;
  const lead = mix(SCENE.metalDark, PAINTS.blaa, 0.12);
  const capW = 0.013 * P;
  const capH = 0.009 * P;
  return (
    <g>
      <title>Strålekilde i blybeholder</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.6} />
      <LinearGradient
        id={`${id}s`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(lead, 0.1)],
          [0.28, tint(lead, 0.3)],
          [0.6, lead],
          [1, shade(lead, 0.4)],
        ]}
      />
      <path
        d={`M${r2(x - W / 2)},${r2(top)} V${r2(y - ry * 0.6)} A${r2(W / 2)} ${r2(ry * 0.6)} 0 0 0 ${r2(x + W / 2)},${r2(y - ry * 0.6)} V${r2(top)} Z`}
        fill={`url(#${id}s)`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
      <ellipse cx={x} cy={top} rx={W / 2} ry={ry} fill={tint(lead, 0.18)} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <ellipse cx={x} cy={top + ry * 0.12} rx={W * 0.2} ry={ry * 0.45} fill={shade(lead, 0.55)} />
      {/* Stålkapselen med kilden stikker opp av hullet */}
      <LinearGradient
        id={`${id}k`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metalLight, 0.1)],
          [0.3, tint(SCENE.metalLight, 0.5)],
          [1, shade(SCENE.metal, 0.3)],
        ]}
      />
      <rect x={x - capW / 2} y={top - capH} width={capW} height={capH + ry * 0.2} fill={`url(#${id}k)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <ellipse cx={x} cy={top - capH} rx={capW / 2} ry={ry * 0.32} fill={tint(SCENE.metalLight, 0.4)} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <Faresymbol x={x - W * 0.04} y={y - potH * 0.48} r={0.0085 * P} />
    </g>
  );
}

/** Bit av alunskifer (svart skifer med uran fra Oslo-feltet): flate lag og rustbrune flekker der den har forvitret. */
function Skifer({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-skifer');
  const ss = useStrokeScale();
  const { w, h } = SAMPLE_GEOM.skifer;
  const W = w * P;
  const Hh = h * P;
  const base = mix(SCENE.stoneDark, SCENE.rubber, 0.45);
  const rust = mix(PAINTS.oransje, SCENE.soil, 0.45);
  const at = (fx: number, fy: number): [number, number] => [x + fx * W, y - fy * Hh];
  const outline: [number, number][] = [
    at(-0.5, 0),
    at(-0.47, 0.42),
    at(-0.5, 0.6),
    at(-0.43, 0.93),
    at(0.18, 1),
    at(0.43, 0.9),
    at(0.5, 0.56),
    at(0.46, 0.3),
    at(0.5, 0),
  ];
  const topFace: [number, number][] = [at(-0.43, 0.93), at(0.18, 1), at(0.43, 0.9), at(0.4, 0.8), at(0.12, 0.86), at(-0.4, 0.8)];
  const layer = (fy: number, wob: number) => `M${pts([at(-0.49, fy), at(-0.2, fy + wob), at(0.15, fy - wob * 0.6), at(0.49, fy + wob * 0.4)])}`;
  return (
    <g>
      <title>Alunskifer</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.56} />
      <LinearGradient id={id} stops={materialStops(base, 1.2)} />
      <polygon points={pts(outline)} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      {[
        [0.22, 0.03, 0.5],
        [0.44, -0.03, 0.4],
        [0.64, 0.02, 0.55],
      ].map(([fy, wob, o]) => (
        <path key={fy} d={layer(fy!, wob!)} fill="none" stroke={shade(base, 0.55)} strokeWidth={1.1 * ss} opacity={o} strokeLinecap="round" />
      ))}
      {[0.33, 0.55].map((fy) => (
        <path key={fy} d={layer(fy, 0.02)} fill="none" stroke={tint(base, 0.3)} strokeWidth={0.8 * ss} opacity={0.45} strokeLinecap="round" />
      ))}
      <polygon points={pts(topFace)} fill={tint(base, 0.22)} opacity={0.8} />
      {/* Rustbrune flekker der skiferen har forvitret */}
      <ellipse cx={x + W * 0.24} cy={y - Hh * 0.5} rx={W * 0.09} ry={Hh * 0.13} fill={rust} opacity={0.55} />
      <ellipse cx={x - W * 0.3} cy={y - Hh * 0.28} rx={W * 0.06} ry={Hh * 0.09} fill={rust} opacity={0.45} />
      <ellipse cx={x - W * 0.05} cy={y - Hh * 0.9} rx={W * 0.08} ry={Hh * 0.05} fill={rust} opacity={0.4} />
    </g>
  );
}

/**
 * Geiger-müller-rør som henger loddrett med vinduet ned mot prøven: metallrør, trykt etikett, tynt vindu i nederkant og
 * et svart endelokk med kontakt for kabelen. `windowY` er underkanten (vinduet).
 */
export function GmRor({ x, windowY, P }: { x: number; windowY: number; P: number }) {
  const id = useSvgId('hl-gm');
  const ss = useStrokeScale();
  const r = GM.r * P;
  const top = windowY - GM.len * P;
  const capTop = top - GM.cap * P;
  const ring = 0.009 * P;
  return (
    <g>
      <title>Geiger-müller-rør</title>
      <LinearGradient
        id={`${id}m`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.22)],
          [0.22, tint(SCENE.metalLight, 0.45)],
          [0.55, SCENE.metal],
          [1, shade(SCENE.metal, 0.38)],
        ]}
      />
      <LinearGradient
        id={`${id}p`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.rubber, 0.1)],
          [0.25, tint(SCENE.rubber, 0.25)],
          [1, shade(SCENE.rubber, 0.3)],
        ]}
      />
      {/* Kontakten og endelokket */}
      <rect x={x - 0.004 * P} y={capTop - GM.bnc * P} width={0.008 * P} height={GM.bnc * P + 1} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <path
        d={`M${r2(x - r * 1.04)},${r2(top + 1)} V${r2(capTop + r * 0.35)} Q${r2(x - r * 1.04)},${r2(capTop)} ${r2(x - r * 0.6)},${r2(capTop)} H${r2(x + r * 0.6)} Q${r2(x + r * 1.04)},${r2(capTop)} ${r2(x + r * 1.04)},${r2(capTop + r * 0.35)} V${r2(top + 1)} Z`}
        fill={`url(#${id}p)`}
        stroke={SCENE.outline}
        strokeWidth={1 * ss}
      />
      {/* Røret */}
      <rect x={x - r} y={top} width={2 * r} height={windowY - ring - top} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Trykt etikett rundt røret */}
      <rect x={x - r} y={top + 0.035 * P} width={2 * r} height={0.026 * P} fill={alpha(SCENE.plastic, 0.85)} stroke={alpha(SCENE.outline, 0.5)} strokeWidth={0.6 * ss} />
      <line x1={x - r * 0.55} y1={top + 0.044 * P} x2={x + r * 0.55} y2={top + 0.044 * P} stroke={alpha(SCENE.outline, 0.8)} strokeWidth={1.2 * ss} />
      <line x1={x - r * 0.55} y1={top + 0.052 * P} x2={x + r * 0.3} y2={top + 0.052 * P} stroke={alpha(SCENE.outline, 0.5)} strokeWidth={1 * ss} />
      {/* Ringen rundt vinduet og selve vinduet (tynn glimmer) */}
      <rect x={x - r * 1.1} y={windowY - ring} width={2.2 * r} height={ring} rx={1.2} fill={`url(#${id}m)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x - r * 0.8} y={windowY - 0.0022 * P} width={1.6 * r} height={0.0026 * P} rx={0.8} fill={mix(SCENE.woodDark, SCENE.rubber, 0.5)} />
    </g>
  );
}

/** Stativ med tung fot, stang, muffe, arm og klemme rundt røret. Klemmen tegnes for seg (etter røret), så den ligger foran. */
export function Stativ({ rodX, benchY, clampY, tubeX, P }: { rodX: number; benchY: number; clampY: number; tubeX: number; P: number }) {
  const id = useSvgId('hl-stativ');
  const ss = useStrokeScale();
  const footH = 0.014 * P;
  const rodW = 0.009 * P;
  const rodTop = clampY - 0.035 * P;
  const armH = 0.007 * P;
  const boss = { w: 0.024 * P, h: 0.022 * P };
  const footL = rodX - 0.022 * P;
  const footR = rodX + 0.075 * P;
  return (
    <g>
      <title>Stativ</title>
      <ContactShadow cx={(footL + footR) / 2} cy={benchY} rx={(footR - footL) * 0.55} />
      <LinearGradient id={`${id}f`} stops={materialStops(SCENE.metalDark, 1.2)} />
      <LinearGradient
        id={`${id}r`}
        x2={1}
        y2={0}
        stops={[
          [0, shade(SCENE.metal, 0.2)],
          [0.3, tint(SCENE.metalLight, 0.5)],
          [1, shade(SCENE.metal, 0.35)],
        ]}
      />
      <LinearGradient id={`${id}a`} stops={materialStops(SCENE.metal, 1.4)} />
      <rect x={footL} y={benchY - footH} width={footR - footL} height={footH} rx={0.003 * P} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={rodX - rodW / 2} y={rodTop} width={rodW} height={benchY - footH - rodTop + 1} rx={rodW / 2} fill={`url(#${id}r)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      {/* Arm fra muffen til klemmen */}
      <rect x={rodX} y={clampY - armH / 2} width={tubeX - rodX} height={armH} fill={`url(#${id}a)`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      {/* Muffe med skrue */}
      <rect x={rodX - boss.w / 2} y={clampY - boss.h / 2} width={boss.w} height={boss.h} rx={0.003 * P} fill={`url(#${id}f)`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={rodX - boss.w / 2 - 0.009 * P} y={clampY - 0.002 * P} width={0.009 * P} height={0.004 * P} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={rodX - boss.w / 2 - 0.011 * P} cy={clampY} r={0.0045 * P} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/** Klemmen rundt røret (tegnes etter røret). */
export function Klemme({ x, y, P }: { x: number; y: number; P: number }) {
  const id = useSvgId('hl-klemme');
  const ss = useStrokeScale();
  const r = GM.r * P;
  const h = 0.014 * P;
  return (
    <g>
      <LinearGradient id={id} stops={materialStops(SCENE.metalDark, 1.3)} />
      <rect x={x - r - 0.004 * P} y={y - h / 2} width={2 * r + 0.008 * P} height={h} rx={0.003 * P} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} />
      <rect x={x + r + 0.004 * P} y={y - 0.002 * P} width={0.008 * P} height={0.004 * P} fill={SCENE.metalDark} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
      <circle cx={x + r + 0.014 * P} cy={y} r={0.004 * P} fill={SCENE.rubber} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
}

/**
 * Telleapparatet: kasse med display som viser antall klikk, høyttaler (rist til venstre), lampe som blinker ved hvert
 * klikk og to knapper. (x, y) er midt på bunnen. Kabelen fra røret kobles i kontakten på høyre side.
 */
export function Telleapparat({ x, y, P, count, blink }: { x: number; y: number; P: number; count: number; blink: number }) {
  const id = useSvgId('hl-teller');
  const ss = useStrokeScale();
  const W = COUNTER.w * P;
  const Hh = COUNTER.h * P;
  const left = x - W / 2;
  const top = y - Hh;
  const housing = mix(PAINTS.graa, PAINTS.blaa, 0.4);
  const panel = { x: left + 0.007 * P, y: top + 0.009 * P, w: W - 0.014 * P, h: Hh - 0.02 * P };
  const disp = { x: x - 0.036 * P, y: top + 0.016 * P, w: 0.098 * P, h: 0.03 * P };
  const spk = { x: left + 0.026 * P, y: top + 0.031 * P };
  const led = { x: spk.x, y: top + 0.064 * P };
  const on = blink > 0;
  return (
    <g>
      <title>Telleapparat</title>
      <ContactShadow cx={x} cy={y} rx={W * 0.55} />
      <LinearGradient id={`${id}h`} stops={materialStops(housing, 1.1)} />
      <LinearGradient id={`${id}p`} stops={materialStops(SCENE.plastic, 0.6)} />
      {/* Føtter */}
      {[-0.38, 0.38].map((k) => (
        <rect key={k} x={x + k * W - 0.008 * P} y={y - 0.004 * P} width={0.016 * P} height={0.004 * P} rx={1} fill={SCENE.rubber} />
      ))}
      {/* Kontakten på høyre side */}
      <rect x={left + W - 1} y={y - COUNTER.connY * P - 0.004 * P} width={0.009 * P} height={0.008 * P} fill={SCENE.metal} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      <rect x={left} y={top} width={W} height={Hh - 0.003 * P} rx={0.007 * P} fill={`url(#${id}h)`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      <rect x={left + 0.004 * P} y={top + 0.0015 * P} width={W - 0.008 * P} height={0.003 * P} rx={1} fill={tint(housing, 0.35)} opacity={0.8} />
      <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={0.004 * P} fill={`url(#${id}p)`} stroke={alpha(SCENE.outline, 0.6)} strokeWidth={0.8 * ss} />
      {/* Displayet */}
      <rect x={disp.x - 0.002 * P} y={disp.y - 0.002 * P} width={disp.w + 0.004 * P} height={disp.h + 0.004 * P} rx={0.003 * P} fill={shade(SCENE.plastic, 0.45)} />
      <rect x={disp.x} y={disp.y} width={disp.w} height={disp.h} rx={0.002 * P} fill={SCENE.display} />
      <text
        x={disp.x + disp.w - 0.006 * P}
        y={disp.y + disp.h * 0.78}
        textAnchor="end"
        style={{
          fill: SCENE.displayText,
          fontSize: 0.024 * P,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontWeight: 600,
          letterSpacing: 0.002 * P,
        }}
      >
        {String(count)}
      </text>
      <text x={disp.x + 0.004 * P} y={disp.y + disp.h * 0.4} style={{ fill: alpha(SCENE.displayText, 0.65), fontSize: 0.0072 * P, fontWeight: 600 }}>
        klikk
      </text>
      {/* Høyttaler */}
      {[-1, 0, 1].flatMap((i) =>
        [-1, 0, 1].map((j) => (
          <circle key={`${i}${j}`} cx={spk.x + i * 0.0055 * P} cy={spk.y + j * 0.0055 * P} r={0.0016 * P} fill={shade(SCENE.plastic, 0.55)} />
        )),
      )}
      {/* Lampa som blinker ved hvert klikk */}
      {on && (
        <>
          <RadialGradient
            id={`${id}g`}
            stops={[
              [0, SCENE.hot, 0.55 * blink],
              [1, SCENE.hot, 0],
            ]}
          />
          <circle cx={led.x} cy={led.y} r={0.012 * P} fill={`url(#${id}g)`} />
        </>
      )}
      <circle cx={led.x} cy={led.y} r={0.0032 * P} fill={on ? tint(SCENE.hot, 0.25) : shade(SCENE.plastic, 0.35)} stroke={SCENE.outline} strokeWidth={0.6 * ss} />
      {/* Knapper */}
      {[0.022, 0.044].map((k) => (
        <g key={k}>
          <RadialGradient id={`${id}k${k * 1000}`} fx={0.35} fy={0.35} stops={sphereStops(shade(SCENE.plastic, 0.3))} />
          <circle cx={x + k * P} cy={led.y} r={0.0052 * P} fill={`url(#${id}k${k * 1000})`} stroke={SCENE.outline} strokeWidth={0.7 * ss} />
        </g>
      ))}
    </g>
  );
}

/** Lydbuer fra høyttaleren når telleren klikker. `n` (1–3) buer, `strength` 0–1 (hvor nylig det siste klikket var). */
export function Lydbuer({ x, y, P, n, strength, color }: { x: number; y: number; P: number; n: number; strength: number; color: string }) {
  const ss = useStrokeScale();
  if (!(n > 0) || !(strength > 0)) return null;
  const arcs = [0.008, 0.014, 0.02].slice(0, Math.min(3, n));
  return (
    <g aria-hidden opacity={Math.min(1, strength)}>
      {arcs.map((rr, i) => {
        const R = rr * P;
        const a1 = (145 * Math.PI) / 180;
        const a2 = (215 * Math.PI) / 180;
        return (
          <path
            key={i}
            d={`M${r2(x + R * Math.cos(a1))},${r2(y + R * Math.sin(a1))} A${r2(R)} ${r2(R)} 0 0 1 ${r2(x + R * Math.cos(a2))},${r2(y + R * Math.sin(a2))}`}
            fill="none"
            stroke={color}
            strokeWidth={2 * ss}
            strokeLinecap="round"
            opacity={1 - i * 0.22}
          />
        );
      })}
    </g>
  );
}
