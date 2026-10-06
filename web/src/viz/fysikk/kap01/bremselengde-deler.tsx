/**
 * Egne gjenstander til «Reaksjonslengde og bremselengde» (k1-bremselengde), i samme stil som scene-kit-et:
 * toninger fra core.tsx, SCENE-farger, kontur og myk skygge. Bare denne visualiseringen trenger dem.
 *
 *   <Elg x={x} y={y} m={12} flip glorie />     elgokse sett fra siden (flip: ser mot venstre, mot bilen)
 *   <Veikant y={y} h={40} w={800} type="sno" />  veikanten foran veien (gress eller snø)
 *   <Smell x={x} y={y} r={14} />                 stjerne der bilen treffer elgen
 *
 * `m` er piksler per meter (samme skala som bilen), og (x, y) er på bakken. Gjenstandene har ekte mål.
 */
import { memo, useMemo } from 'react';
import { ContactShadow, LinearGradient, Place, SCENE, SCENE_DIM, materialStops, mix, sceneRandom, shade, tint, useSceneScale, useStrokeScale, useSvgId } from '../../kit/scene';

const r2 = (v: number) => Math.round(v * 100) / 100;
const fin = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/* ------------------------------------------------------------------ Elg */

/**
 * Målene til elgen i meter (en voksen okse), i forhold til ankerpunktet midt mellom hovene når den ser mot høyre.
 * Med `flip` (ser mot venstre) speilvendes alt: brystet er da `bryst` meter til venstre for ankerpunktet.
 */
export const ELG_MAAL = {
  /** Fra ankerpunktet fram til brystet (der en bil treffer). */
  bryst: 0.93,
  /** Fra ankerpunktet fram til mulen (hodet henger fram over brystet). */
  mule: 1.93,
  /** Fra ankerpunktet bak til baken. */
  bak: 1.13,
  /** Mankehøyden (toppen av pukkelen over skuldrene). */
  manke: 2.02,
  /** Høyden til toppen av geviret. */
  hoyde: 2.46,
} as const;

// Elgen tegnes i centimeter, ser mot høyre, med ankerpunktet på bakken midt mellom hovene. x skaleres med 0,93.
const ELK_SX = 0.93;
const ELK_BODY =
  'M-102,-170C-70,-176 -10,-182 24,-194C36,-200 48,-205 60,-204C82,-202 104,-196 122,-188' +
  'C130,-186 138,-184 144,-180C156,-172 170,-164 184,-156C194,-151 202,-146 205,-139C208,-132 206,-125 201,-122' +
  'C196,-119 190,-121 187,-123C182,-122 177,-124 172,-127C162,-131 152,-138 146,-146L140,-149' +
  'C139,-141 137,-131 134,-120C131,-125 129,-132 128,-139' +
  'C118,-137 108,-134 102,-128C98,-123 96,-117 95,-112C70,-104 30,-101 0,-101C-30,-101 -62,-105 -88,-114' +
  'C-108,-118 -122,-132 -123,-150C-123,-160 -115,-168 -102,-170Z';
/** Mørkere mule og munn. */
const ELK_MUZZLE = 'M190,-152C198,-148 204,-143 205,-139C208,-132 206,-125 201,-122C196,-119 190,-121 187,-123C182,-122 177,-124 172,-127C178,-134 184,-143 190,-152Z';
/** Hale: kort stump bak på baken. */
const ELK_TAIL = 'M-118,-160C-124,-158 -128,-150 -126,-142C-122,-146 -119,-152 -116,-156Z';
/** Øret peker bakover og opp. */
const ELK_EAR = 'M128,-186C120,-194 110,-202 98,-208C102,-198 110,-188 120,-182Z';

/** Skovlgevir sett fra siden: en bred skovl bakover og oppover med korte takker langs overkanten og en fremre takk. */
const ELK_ANTLER = (() => {
  // Overkanten: annenhver takk og innhakk, bakfra og fram
  const top: [number, number][] = [
    [58, -214],
    [66, -220],
    [70, -231],
    [80, -228],
    [86, -240],
    [95, -235],
    [102, -245],
    [111, -238],
    [119, -245],
    [126, -236],
    [135, -240],
    [138, -229],
    [148, -228],
  ];
  const pts = top.map(([x, y]) => `${x},${y}`).join('L');
  return `M132,-191C126,-197 118,-201 106,-203C92,-205 76,-206 66,-208C62,-209 59,-211 58,-214L${pts}C146,-221 141,-216 140,-213L152,-214C147,-207 141,-201 136,-196C135,-194 134,-192 132,-191Z`;
})();

/** Ett bein som en avsmalnende form gjennom punktene [x, y, bredde] (ovenfra og ned), med hov nederst. */
function legPath(pts: [number, number, number][]): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, w] = pts[i]!;
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push(`${r2(x + (nx * w) / 2)},${r2(y + (ny * w) / 2)}`);
    right.push(`${r2(x - (nx * w) / 2)},${r2(y - (ny * w) / 2)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

// Beina: nærmeste forbein og bakbein (lysere), de bakerste er forskjøvet og litt mørkere.
const FRONT_LEG: [number, number, number][] = [
  [72, -126, 34],
  [74, -92, 20],
  [77, -58, 13],
  [79, -32, 9],
  [80, -12, 9],
  [81, -5, 10],
];
const HIND_LEG: [number, number, number][] = [
  [-86, -130, 44],
  [-82, -98, 26],
  [-97, -62, 13],
  [-92, -34, 9],
  [-88, -12, 9],
  [-86, -5, 10],
];
const shift = (pts: [number, number, number][], dx: number, dy = 0): [number, number, number][] => pts.map(([x, y, w]) => [x + dx, y + dy, w]);
const LEGS = {
  frontNear: legPath(FRONT_LEG),
  frontFar: legPath(shift(FRONT_LEG, -16)),
  hindNear: legPath(HIND_LEG),
  hindFar: legPath(shift(HIND_LEG, -14)),
};
/** Hovene (mørke kiler) under de fire beina. */
function hoof(x: number): string {
  return `M${x - 6},-9L${x + 5},-9L${x + 8},0L${x - 6},0Z`;
}

/**
 * Lys kant rundt elgen i skumringen (mørkt tema), som fra frontlyktene, så den mørke elgen ikke forsvinner mot
 * asfalten og skogen. Styrken følger scene-kit-ets nattfaktor (`--sc-bakgrunn-stjerner`: 0 i lyst tema, 0,75 i
 * mørkt), så kanten bare synes i mørkt tema.
 */
const NIGHT_GLOW = 'calc(var(--sc-bakgrunn-stjerner, 0) * 0.85)';

/**
 * Elgokse sett fra siden: mørk brun pels med pukkel over skuldrene, lyse «strømper» på beina, langt hode med
 * overhengende mule og «bjelle» under halsen, og skovlgevir. Ser mot høyre; `flip` speilvender (ser mot venstre).
 * Ankerpunkt: på bakken midt mellom hovene. `m` er piksler per meter (elgen er 2,0 m til manken og 2,5 m med gevir).
 * `glorie` gir en lys kant rundt elgen i mørkt tema.
 */
export const Elg = memo(function Elg({
  x,
  y,
  m,
  flip = false,
  glorie = false,
  dim,
  title,
}: {
  x: number;
  y: number;
  m: number;
  flip?: boolean;
  glorie?: boolean;
  dim?: boolean;
  title?: string;
}) {
  const ss = useStrokeScale();
  const id = useSvgId('elg');
  const k = Math.max(0.05, fin(m, 12)) / 100;
  const sw = (w: number) => (w * ss) / k;
  const coat = mix(SCENE.hair, SCENE.trunk, 0.4);
  const coatFar = shade(coat, 0.25);
  const sock = mix(SCENE.stone, SCENE.snowShade, 0.35);
  const antler = mix(SCENE.woodLight, SCENE.gravel, 0.35);
  const legStops = (c: string, s: string) =>
    [
      [0, c],
      [0.42, c],
      [0.6, s],
      [1, shade(s, 0.12)],
    ] as [number, string][];
  return (
    <Place x={x} y={y} flip={flip} opacity={dim ? SCENE_DIM : undefined}>
      {title && <title>{title}</title>}
      <ContactShadow cx={15 * k} cy={0} rx={135 * k} ry={Math.max(2, 10 * k)} />
      <g transform={`scale(${r2(k * ELK_SX)} ${r2(k)})`}>
        <LinearGradient id={`${id}-pels`} stops={materialStops(coat, 1.1)} />
        <LinearGradient id={`${id}-bein`} stops={legStops(coat, sock)} />
        <LinearGradient id={`${id}-beinb`} stops={legStops(coatFar, shade(sock, 0.25))} />
        <LinearGradient id={`${id}-gevir`} stops={materialStops(antler, 1.2)} />
        {/* Lys kant i skumringen: hele silhuetten med tykk, lys strek bak elgen (en bred, svak og en smal, sterkere) */}
        {glorie && (
          <g fill={SCENE.snow} stroke={SCENE.snow} strokeLinejoin="round" strokeLinecap="round" style={{ opacity: NIGHT_GLOW }} aria-hidden>
            {[
              { w: 5.5, o: 0.35 },
              { w: 2.6, o: 0.9 },
            ].map(({ w, o }) => (
              <g key={w} strokeWidth={sw(w)} opacity={o}>
                <path d={LEGS.hindFar + LEGS.frontFar + LEGS.hindNear + LEGS.frontNear} />
                <path d={ELK_ANTLER} transform="translate(12 6) scale(0.94)" />
                <path d={ELK_TAIL + ELK_BODY + ELK_EAR + ELK_ANTLER} />
              </g>
            ))}
          </g>
        )}
        {/* Bakerste bein og gevir (mørkere) */}
        <g stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round">
          <path d={LEGS.hindFar} fill={`url(#${id}-beinb)`} />
          <path d={LEGS.frontFar} fill={`url(#${id}-beinb)`} />
          <path d={hoof(-86 - 14) + hoof(82 - 16)} fill={shade(SCENE.rubber, 0.1)} />
          <path d={ELK_ANTLER} transform="translate(12 6) scale(0.94)" fill={shade(antler, 0.28)} />
        </g>
        {/* Nærmeste bein (toppen skjules av kroppen) */}
        <g stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round">
          <path d={LEGS.hindNear} fill={`url(#${id}-bein)`} />
          <path d={LEGS.frontNear} fill={`url(#${id}-bein)`} />
          <path d={hoof(-86) + hoof(82)} fill={SCENE.rubber} />
        </g>
        {/* Kropp, hode og hale */}
        <path d={ELK_TAIL} fill={coatFar} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        <path d={ELK_BODY} fill={`url(#${id}-pels)`} stroke={SCENE.outline} strokeWidth={sw(1)} strokeLinejoin="round" />
        <path d={ELK_MUZZLE} fill={shade(coat, 0.35)} />
        {/* Lys langs ryggen og mørkere buk */}
        <path d="M-96,-169C-60,-174 0,-180 30,-193C42,-199 52,-200 60,-199C86,-197 108,-190 122,-184" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.6)} strokeLinecap="round" opacity={0.7} />
        <path d="M90,-114C60,-106 30,-104 0,-104C-30,-104 -60,-108 -84,-116" fill="none" stroke={shade(coat, 0.3)} strokeWidth={sw(2.2)} strokeLinecap="round" opacity={0.6} />
        {/* Øre, øye, nesebor og nærmeste gevir */}
        <path d={ELK_EAR} fill={shade(coat, 0.1)} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
        <ellipse cx={153} cy={-171} rx={3.4} ry={2.8} fill={shade(SCENE.rubber, 0.2)} />
        <ellipse cx={199} cy={-136} rx={2.8} ry={2} fill={shade(SCENE.rubber, 0.2)} />
        <path d={ELK_ANTLER} fill={`url(#${id}-gevir)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} strokeLinejoin="round" />
        <path d="M70,-211C86,-212 106,-210 126,-203" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1.4)} strokeLinecap="round" opacity={0.75} />
      </g>
    </Place>
  );
});

/* ------------------------------------------------------------------ Veikant */

/**
 * Veikanten foran veien, sett litt ovenfra: gress (toning og små gresstuster) eller snø (toning og glitter).
 * Tegnes under `Vei` fra `y` og `h` nedover, over hele bredden `w`.
 */
export const Veikant = memo(function Veikant({ y, h, w, type, seed = 41 }: { y: number; h: number; w: number; type: 'gress' | 'sno'; seed?: number }) {
  const id = useSvgId('veikant');
  const ss = useStrokeScale();
  const k = useSceneScale();
  const tex = useMemo(() => {
    const rand = sceneRandom(seed);
    let dark = '';
    let light = '';
    const n = Math.round(w / 11);
    for (let i = 0; i < n; i++) {
      const u = rand();
      const v = rand();
      const xx = u * w;
      const yy = y + 4 + v * Math.max(0, h - 6);
      const s = (2.2 + 2.2 * v) * k;
      if (type === 'gress') {
        const d = `M${r2(xx - s * 0.7)},${r2(yy - s)}L${r2(xx)},${r2(yy)}L${r2(xx + 0.2 * s)},${r2(yy - s * 1.3)}M${r2(xx)},${r2(yy)}L${r2(xx + s * 0.8)},${r2(yy - s * 0.9)}`;
        if (i % 3 === 0) light += d;
        else dark += d;
      } else {
        const r = (0.5 + 0.6 * v) * k;
        const d = `M${r2(xx - r)},${r2(yy)}a${r2(r)},${r2(r)} 0 1,0 ${r2(2 * r)},0a${r2(r)},${r2(r)} 0 1,0 ${r2(-2 * r)},0Z`;
        if (i % 2 === 0) light += d;
        else dark += d;
      }
    }
    return { dark, light };
  }, [w, h, y, type, seed, k]);
  const stops: [number, string][] =
    type === 'gress'
      ? [
          [0, shade(SCENE.grass, 0.04)],
          [0.4, SCENE.grass],
          [1, mix(SCENE.grass, SCENE.grassDark, 0.55)],
        ]
      : [
          [0, SCENE.snow],
          [0.5, mix(SCENE.snow, SCENE.snowShade, 0.35)],
          [1, mix(SCENE.snow, SCENE.snowShade, 0.75)],
        ];
  if (!(h > 0)) return null;
  return (
    <g aria-hidden>
      <LinearGradient id={id} stops={stops} />
      <rect x={0} y={y} width={w} height={h} fill={`url(#${id})`} />
      {type === 'gress' ? (
        <>
          <path d={tex.dark} fill="none" stroke={SCENE.grassDark} strokeWidth={1.1 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          <path d={tex.light} fill="none" stroke={tint(SCENE.grass, 0.35)} strokeWidth={1 * ss} strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
        </>
      ) : (
        <>
          <path d={tex.light} fill={SCENE.highlight} opacity={0.9} />
          <path d={tex.dark} fill={SCENE.snowShade} opacity={0.5} />
        </>
      )}
    </g>
  );
});

/* ------------------------------------------------------------------ Smell */

/** Taggete stjerne der bilen treffer elgen. (x, y) er midten, `r` den ytre radien i figurens enheter. */
export function Smell({ x, y, r }: { x: number; y: number; r: number }) {
  const ss = useStrokeScale();
  if (!(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const pts: string[] = [];
  const n = 9;
  for (let i = 0; i < 2 * n; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rr = i % 2 === 0 ? r * (i % 4 === 0 ? 1 : 0.82) : r * 0.42;
    pts.push(`${r2(x + rr * Math.cos(a))},${r2(y + rr * Math.sin(a))}`);
  }
  return (
    <g aria-hidden>
      <polygon points={pts.join(' ')} fill={SCENE.glow} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" opacity={0.95} />
      <circle cx={x} cy={y} r={r * 0.22} fill={tint(SCENE.glow, 0.6)} />
    </g>
  );
}
