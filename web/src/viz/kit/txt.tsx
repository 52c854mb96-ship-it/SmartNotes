import type { CSSProperties, ReactNode } from 'react';

export interface TxtProps {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  color?: string;
  /**
   * Relativ størrelse: 1 = vanlig etikett (17 i figurens enheter på PC, vokser på mobil som .viz-label).
   * 0,8 gir mindre tekst, 1,4 en overskrift. Teksten følger alltid mobilskaleringen.
   */
  size?: number;
  /** Fast skriftstørrelse i figurens enheter (vokser ikke på mobil). Bruk bare for tekst som skal passe i en form. */
  px?: number;
  weight?: number;
  muted?: boolean;
  /** Lys kant rundt teksten så den kan leses oppå streker (standard). Slå av for tekst inne i fylte former. */
  halo?: boolean;
  /** Tekst for skjermlesere når teksten ikke kan leses høyt som den står. */
  title?: string;
}

/**
 * Tekst i en kjemifigur med egen farge og størrelse. Som kit-ets <Label>, men med relativ størrelse som følger
 * mobilskaleringen: <Txt x={…} y={…} size={0.85} color={KJEMI.minus}>δ−</Txt>.
 */
export function Txt({ x, y, children, anchor = 'middle', color, size, px, weight, muted, halo = true, title }: TxtProps) {
  const style: CSSProperties & Record<'--kj-fs', number | undefined> = {
    fill: color,
    fontSize: px,
    fontWeight: weight,
    '--kj-fs': size,
  };
  return (
    <text x={x} y={y} textAnchor={anchor} className={`kj-txt${muted ? ' is-muted' : ''}${halo ? '' : ' no-halo'}`} style={style}>
      {title && <title>{title}</title>}
      {children}
    </text>
  );
}
