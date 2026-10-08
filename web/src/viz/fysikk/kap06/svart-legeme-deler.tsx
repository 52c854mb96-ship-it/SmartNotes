/**
 * Egne gjenstander til k6-svart-legeme: et mørkt verksted (plankevegg og betonggulv), en ambolt på en stubbe og et
 * glødende smijern i en smietang, i samme stil som scene-kit-et (toninger fra core.tsx, SCENE-farger, kontur og myk
 * skygge). Fargen på gløden er fysisk (fra temperaturen), så den er lik i lyst og mørkt tema.
 */
import type { ReactNode } from 'react';
import { ContactShadow, LinearGradient, RadialGradient, SCENE, alpha, materialStops, mix, shade, tint, useStrokeScale, useSvgId } from '../../kit/scene';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** rgb-tekst fra en sRGB-trippel (0–255). */
export const rgbText = ([r, g, b]: [number, number, number]) => `rgb(${r} ${g} ${b})`;

/** Veggen i verkstedet om kvelden: mørke, loddrette planker. Samme mørke i begge temaer, så gløden synes. */
export const VERKSTED = {
  vegg: mix(SCENE.woodDark, SCENE.space, 0.62),
  veggLys: mix(SCENE.wood, SCENE.space, 0.5),
  gulv: mix(SCENE.concreteDark, SCENE.space, 0.6),
  gulvKant: mix(SCENE.concrete, SCENE.space, 0.45),
};

/**
 * Mørkt verksted: plankevegg fra (x, y) og ned til gulvet i `gulvY`, og et betonggulv fra gulvY til y + h.
 * Tegnes først; gjenstandene settes på gulvet (y = gulvY + litt) eller på et bord.
 */
export function Verksted({ x, y, w, h, gulvY }: { x: number; y: number; w: number; h: number; gulvY: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('verksted');
  const plank = 34;
  const lines: ReactNode[] = [];
  for (let px = x + plank * 0.6, i = 0; px < x + w; px += plank, i++) {
    lines.push(<line key={i} x1={r1(px)} y1={y} x2={r1(px)} y2={gulvY} stroke={shade(VERKSTED.vegg, 0.45)} strokeWidth={r1(1.2 * ss)} />);
    lines.push(<line key={`l${i}`} x1={r1(px + 1.4)} y1={y} x2={r1(px + 1.4)} y2={gulvY} stroke={VERKSTED.veggLys} strokeWidth={0.6} opacity={0.35} />);
  }
  return (
    <g aria-hidden>
      <LinearGradient id={`${id}-v`} stops={[[0, shade(VERKSTED.vegg, 0.25)], [0.7, VERKSTED.vegg], [1, shade(VERKSTED.vegg, 0.1)]]} />
      <LinearGradient id={`${id}-g`} stops={[[0, VERKSTED.gulvKant], [0.25, VERKSTED.gulv], [1, shade(VERKSTED.gulv, 0.3)]]} />
      <rect x={x} y={y} width={w} height={gulvY - y} fill={`url(#${id}-v)`} />
      {lines}
      {/* Fotlist og gulv */}
      <rect x={x} y={gulvY - 5} width={w} height={5} fill={shade(VERKSTED.veggLys, 0.2)} />
      <rect x={x} y={gulvY} width={w} height={y + h - gulvY} fill={`url(#${id}-g)`} />
    </g>
  );
}

/**
 * Lyset fra en glødende gjenstand på vegg og gulv: en myk, svak flekk i glødefargen. `styrke` 0–1.
 * Legges etter veggen og før gjenstandene.
 */
export function Lysskjaer({ x, y, rx, ry, farge, styrke }: { x: number; y: number; rx: number; ry: number; farge: string; styrke: number }) {
  const id = useSvgId('skjaer');
  if (!(styrke > 0.01)) return null;
  return (
    <g aria-hidden>
      <RadialGradient id={id} stops={[[0, farge, 0.42 * styrke], [0.45, farge, 0.16 * styrke], [1, farge, 0]]} />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${id})`} />
    </g>
  );
}

/**
 * Ambolt på en trestubbe, sett fra siden med hornet mot venstre. Ankerpunkt: (x, y) er midt under stubben på gulvet.
 * `size` er lengden på ambolten fra hornspissen til hælen; banen (den flate toppen) ligger 0,45 · size over
 * stubben, og stubben er `stubbe` høy. Bruk amboltBane for å legge noe på banen.
 */
export function Ambolt({ x, y, size, stubbe }: { x: number; y: number; size: number; stubbe: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('ambolt');
  const k = size / 100;
  const sw = (v: number) => r1((v * ss) / k);
  const stW = 64;
  const stH = stubbe / k;
  const steel = mix(SCENE.metalDark, SCENE.space, 0.35);
  const wood = mix(SCENE.wood, SCENE.space, 0.35);
  return (
    <g aria-hidden>
      <ContactShadow cx={x} cy={y} rx={size * 0.42} ry={size * 0.035} />
      <g transform={`translate(${r1(x)} ${r1(y)}) scale(${r1(k * 1000) / 1000})`}>
        <LinearGradient id={`${id}-s`} x2={1} y2={0} stops={[[0, shade(wood, 0.35)], [0.3, tint(wood, 0.08)], [0.75, wood], [1, shade(wood, 0.45)]]} />
        <LinearGradient id={`${id}-a`} stops={materialStops(steel, 1.3)} />
        <LinearGradient id={`${id}-b`} stops={[[0, tint(steel, 0.45)], [1, tint(steel, 0.1)]]} />
        {/* Stubben */}
        <path
          d={`M${-stW / 2},0L${-stW / 2 + 2},${-stH}L${stW / 2 - 2},${-stH}L${stW / 2},0Z`}
          fill={`url(#${id}-s)`}
          stroke={SCENE.outline}
          strokeWidth={sw(1)}
          strokeLinejoin="round"
        />
        <path
          d={`M-18,-3L-17,${-stH + 4}M-4,-2L-4.5,${-stH + 3}M12,-3L13,${-stH + 5}M24,-2L25,${-stH + 4}`}
          stroke={shade(wood, 0.5)}
          strokeWidth={sw(1.1)}
          opacity={0.6}
        />
        <ellipse cx={0} cy={-stH} rx={stW / 2 - 2} ry={3} fill={tint(wood, 0.2)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        {/* Selve ambolten: føtter, liv, hæl, bane og horn */}
        <g transform={`translate(0 ${-stH})`}>
          <path
            d="M-27,0L-27,-3Q-18,-5 -14,-12Q-11,-20 -17,-27Q-26,-30 -34,-33Q-44,-36 -50,-38.6Q-42,-44 -22,-45L50,-45L50,-35Q38,-32 26,-28Q17,-22 19,-12Q22,-5 31,-3L31,0Z"
            fill={`url(#${id}-a)`}
            stroke={SCENE.outline}
            strokeWidth={sw(1)}
            strokeLinejoin="round"
          />
          {/* Banen (herdet stålplate) med lys kant */}
          <path d="M-22,-45L50,-45L50,-40.5L-20,-40.5Z" fill={`url(#${id}-b)`} />
          <path d="M-21,-45H49" stroke={SCENE.highlight} strokeWidth={sw(1.2)} opacity={0.45} strokeLinecap="round" />
          <path d="M-48,-38.8Q-38,-43 -22,-44" fill="none" stroke={SCENE.highlight} strokeWidth={sw(1)} opacity={0.35} strokeLinecap="round" />
          {/* Hullet i hælen og skillet mellom føttene */}
          <rect x={38} y={-44.6} width={4} height={2.4} fill={shade(steel, 0.6)} />
          <path d="M-6,0Q2,-4 10,0" fill={shade(steel, 0.5)} stroke={SCENE.outline} strokeWidth={sw(0.8)} />
        </g>
      </g>
    </g>
  );
}

/** Punktet midt på banen til en ambolt (samme props som Ambolt), og hvor langt banen går til hver side. */
export function amboltBane({ x, y, size, stubbe }: { x: number; y: number; size: number; stubbe: number }) {
  const k = size / 100;
  return { x: x + 14 * k, y: y - stubbe - 45 * k, venstre: x - 22 * k, hoyre: x + 50 * k };
}

/**
 * Glødende smijern holdt i en smietang: en firkantstang som gløder i fargen `glod` (fysisk farge fra temperaturen)
 * i den varme enden og blir mørkere mot tanga. (x, y) er undersiden av den glødende enden, som ligger på banen; stanga
 * går mot høyre (lengde `size`, tykkelse 0,1 · size), og tanga stikker videre ut mot høyre og litt ned.
 */
export function Smijern({ x, y, size, glod, styrke = 1 }: { x: number; y: number; size: number; glod: string; styrke?: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('smijern');
  const k = size / 100;
  const sw = (v: number) => r1((v * ss) / k);
  const st = Math.min(1, Math.max(0, styrke));
  const steel = mix(SCENE.metalDark, SCENE.space, 0.3);
  const hot = tint(glod, 0.45 * st);
  const tongs = 'M88,-7.5Q118,-8 150,2M88,-2.5Q118,-1 149,10';
  return (
    <g aria-hidden>
      <g transform={`translate(${r1(x)} ${r1(y)}) scale(${r1(k * 1000) / 1000})`}>
        {/* Gløden rundt den varme enden */}
        <RadialGradient id={`${id}-h`} stops={[[0, glod, 0.8 * st], [0.28, glod, 0.36 * st], [0.6, glod, 0.1 * st], [1, glod, 0]]} />
        <ellipse cx={24} cy={-6} rx={64} ry={36} fill={`url(#${id}-h)`} />
        <LinearGradient
          id={`${id}-j`}
          x2={1}
          y2={0}
          stops={[
            [0, hot],
            [0.3, hot],
            [0.5, glod],
            [0.68, mix(glod, steel, 0.6)],
            [0.82, steel],
            [1, shade(steel, 0.2)],
          ]}
        />
        {/* Tanga: to lange skaft som går ut til høyre og litt ned */}
        <path d={tongs} fill="none" stroke={SCENE.outline} strokeWidth={sw(5)} strokeLinecap="round" />
        <path d={tongs} fill="none" stroke={steel} strokeWidth={sw(3)} strokeLinecap="round" />
        <path d="M88,-7.5Q118,-8 150,2" fill="none" stroke={tint(steel, 0.4)} strokeWidth={sw(0.9)} strokeLinecap="round" opacity={0.6} />
        {/* Stanga */}
        <rect x={0} y={-10} width={100} height={10} rx={1.5} fill={`url(#${id}-j)`} stroke={SCENE.outline} strokeWidth={sw(0.9)} />
        <path d="M2,-8.6H46" stroke={tint(glod, 0.75)} strokeWidth={sw(1.6)} strokeLinecap="round" opacity={0.9 * st} />
        {/* Kjeften på tanga griper om enden av stanga */}
        <path d="M80,-12.5Q90,-13.5 95,-7.5L88,-7.5Q86,-10.5 80,-10.5Z" fill={steel} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
        <path d="M80,2.5Q90,3.5 95,-2.5L88,-2.5Q86,0.5 80,0.5Z" fill={steel} stroke={SCENE.outline} strokeWidth={sw(0.8)} strokeLinejoin="round" />
        {/* Et par gnister over den varme enden */}
        <g fill={tint(glod, 0.65)} opacity={0.9 * st}>
          <circle cx={16} cy={-24} r={1.5} />
          <circle cx={32} cy={-32} r={1.1} />
          <circle cx={6} cy={-36} r={1} />
          <circle cx={24} cy={-44} r={0.8} />
        </g>
      </g>
    </g>
  );
}

/**
 * Ledning fra taket med en enkel lampeholder i svart bakelitt, som en glødelampe kan henge i.
 * (x, y1) er taket, (x, y2) er bunnen av holderen der pærens sokkel begynner.
 */
export function Lampeholder({ x, y1, y2, size }: { x: number; y1: number; y2: number; size: number }) {
  const ss = useStrokeScale();
  const id = useSvgId('lampeholder');
  const w = size * 0.2;
  const h = size * 0.2;
  const black = mix(SCENE.rubber, SCENE.space, 0.2);
  return (
    <g aria-hidden>
      <LinearGradient id={id} x2={1} y2={0} stops={[[0, tint(black, 0.2)], [0.35, tint(black, 0.08)], [1, shade(black, 0.3)]]} />
      <line x1={x} y1={y1} x2={x} y2={y2 - h} stroke={SCENE.outline} strokeWidth={r1(3.2 * ss)} />
      <line x1={x} y1={y1} x2={x} y2={y2 - h} stroke={tint(black, 0.25)} strokeWidth={r1(1.6 * ss)} />
      <path
        d={`M${r1(x - w * 0.32)},${r1(y2 - h)}L${r1(x + w * 0.32)},${r1(y2 - h)}L${r1(x + w / 2)},${r1(y2 - h * 0.25)}L${r1(x + w / 2)},${r1(y2)}L${r1(x - w / 2)},${r1(y2)}L${r1(x - w / 2)},${r1(y2 - h * 0.25)}Z`}
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={r1(1 * ss)}
        strokeLinejoin="round"
      />
      <line x1={r1(x - w / 2)} y1={r1(y2 - h * 0.25)} x2={r1(x + w / 2)} y2={r1(y2 - h * 0.25)} stroke={alpha(SCENE.highlight, 0.4)} strokeWidth={r1(0.8 * ss)} />
    </g>
  );
}
