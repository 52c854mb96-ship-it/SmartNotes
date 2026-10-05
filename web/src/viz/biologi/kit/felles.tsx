/**
 * Små felles hjelpere for biologifigurene: skalering på mobil, unike SVG-id-er, markering (glorie) og etiketter med
 * strek til det de peker på.
 */
import { useId, type ReactNode } from 'react';
import { VIZ, useTextScale } from '../../kit';
import { Txt } from '../../kjemi/kit/txt';

/**
 * Hvor mye små figurer (partikler, organismesymboler) bør forstørres for å kunne sees: 1 på PC, ca. 1,5 på mobil.
 * Samme faktor som `useAtomScale` i kjemi. Bare inne i en <Figure>. Gang dine egne avstander med den også.
 */
export function useBioScale(): number {
  return Math.max(1, useTextScale() * 0.85);
}

/**
 * Faktor for strektykkelser: 1 på PC, ca. 1,35 på mobil, så tynne streker ikke forsvinner når figuren skaleres ned.
 * Primitivene i biologi-kit-et bruker den selv.
 */
export function useLineScale(): number {
  return Math.max(1, useTextScale() * 0.75);
}

/** Gyldig og unik id for clipPath/mask (useId kan inneholde tegn som ikke passer i url(#…)). */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Felles egenskaper for celledeler, membranproteiner og organismesymboler. */
export interface MarkProps {
  /** Fremhev delen med en farget glorie (f.eks. den eleven har valgt). */
  highlight?: boolean;
  /** Ton ned delen (f.eks. alt som ikke er valgt). */
  dim?: boolean;
}

/** Gjennomsiktighet for nedtonede deler. */
export const DIM_OPACITY = 0.32;

/** Glorie bak en form: samme sti tegnet med bred, gjennomsiktig strek i kantfargen. Tegnes før selve formen. */
export function Halo({ d, color, width = 10 }: { d: string; color: string; width?: number }) {
  const lw = useLineScale();
  return (
    <path d={d} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={width * lw} strokeLinejoin="round" strokeLinecap="round" />
  );
}

export interface EtikettProps {
  /** Punktet etiketten peker på. */
  x: number;
  y: number;
  /** Grunnlinjen til teksten. */
  lx: number;
  ly: number;
  children: ReactNode;
  /** Standard: 'start' når teksten står til høyre for punktet, ellers 'end'. */
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  /** Uthevet tekst (f.eks. den valgte delen). */
  strong?: boolean;
  /** Relativ tekststørrelse (1 = vanlig etikett), standard 0,85. */
  size?: number;
  /** Ingen prikk i enden av streken. */
  noDot?: boolean;
}

/**
 * Etikett med tynn strek til det den peker på, som i lærebokfigurer:
 *   <Etikett x={mito.x} y={mito.y} lx={620} ly={80}>Mitokondrie</Etikett>
 * Teksten vokser på mobil (som <Txt>), så sett av god plass til den.
 */
export function Etikett({ x, y, lx, ly, children, anchor, color, strong, size = 0.85, noDot }: EtikettProps) {
  const f = useTextScale();
  const a = anchor ?? (lx >= x ? 'start' : 'end');
  const ex = a === 'start' ? lx - 5 : a === 'end' ? lx + 5 : lx;
  // Midt på teksthøyden (grunnlinja minus ca. en tredjedel av skrifthøyden)
  const ey = a === 'middle' ? (ly > y ? ly - 15 * f * size : ly + 6) : ly - 5.5 * f * size;
  return (
    <g>
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={color ?? VIZ.muted} strokeWidth={1.3} strokeLinecap="round" />
      {!noDot && <circle cx={x} cy={y} r={2.8} fill={color ?? VIZ.ink} stroke={VIZ.surface} strokeWidth={1.2} />}
      <Txt x={lx} y={ly} anchor={a} size={size} weight={strong ? 700 : 560} color={color}>
        {children}
      </Txt>
    </g>
  );
}
