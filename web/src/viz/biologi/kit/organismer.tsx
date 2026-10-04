/**
 * Enkle, rolige symboler for organismer, smittestoffer og celler som går igjen i mange kapitler: geometriske former,
 * farget med BIO (fyll + kant), ikke tegneserie.
 *
 *   <Bakterie x={100} y={80} form="stav" size={40} />
 *   <Virus x={200} y={80} type="kappekledd" />
 *   <Menneske x={300} y={80} paint={{ fill: BIO.sir.I, line: BIO.sir.I }} />
 *
 * `size` er omtrent bredden eller høyden symbolet fyller (figurenheter). Symbolene vokser ikke av seg selv på mobil:
 * gang med `useBioScale()` hvis de står alene og skal kunne sees. Alle har `rotate`, `highlight`, `dim` og `title`
 * (tekst for skjermlesere) og kan farges om med `paint`.
 */
import type { ReactNode } from 'react';
import { VIZ } from '../../kit';
import { BIO, type BioPaint } from './colors';
import { DIM_OPACITY, useLineScale, type MarkProps } from './felles';

export interface GlyphProps extends MarkProps {
  x: number;
  y: number;
  /** Omtrentlig størrelse (bredde/høyde) i figurens enheter. */
  size?: number;
  rotate?: number;
  /** Andre farger enn standard, f.eks. tilstanden i en smittemodell. */
  paint?: BioPaint;
  /** Tekst for skjermlesere. */
  title?: string;
}

/** Symbolene tegnes i en boks på 40 × 40 rundt (0, 0) og skaleres til `size`. */
const BASE = 40;

function Glyph({
  x,
  y,
  size = BASE,
  rotate,
  dim,
  highlight,
  title,
  line,
  children,
}: GlyphProps & { line: string; children: (sw: (w: number) => number) => ReactNode }) {
  const lw = useLineScale();
  const k = size / BASE;
  // Strektykkelse i figurens enheter uansett størrelse
  const sw = (w: number) => (w * lw) / k;
  return (
    <g transform={`translate(${x} ${y})${rotate ? ` rotate(${rotate})` : ''} scale(${k})`} opacity={dim ? DIM_OPACITY : undefined}>
      {title && <title>{title}</title>}
      {highlight && <circle r={24} fill={line} opacity={0.16} />}
      {children(sw)}
    </g>
  );
}

/* ---------- Mikroorganismer og virus ---------- */

export type BakterieForm = 'stav' | 'kokk' | 'spiril';

/** Bakterie: stav (bacill), kokk (kule) eller spiril (skrue). Med `flagell` får den en svepe. */
export function Bakterie({
  form = 'stav',
  flagell = false,
  paint = BIO.bakterie,
  ...g
}: GlyphProps & { form?: BakterieForm; flagell?: boolean }) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          {flagell && form !== 'spiril' && (
            <path
              d={form === 'stav' ? 'M19,0 q4,-5 8,0 t8,0 t6,0' : 'M11,0 q4,-5 8,0 t8,0 t6,0'}
              fill="none"
              stroke={paint.line}
              strokeWidth={sw(1.4)}
              strokeLinecap="round"
            />
          )}
          {form === 'stav' && (
            <g>
              <rect x={-19} y={-8} width={38} height={16} rx={8} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
              <path
                d="M-10,1 q3,-4 6,0 t6,0 t6,0"
                fill="none"
                stroke={paint.line}
                strokeWidth={sw(1.1)}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
            </g>
          )}
          {form === 'kokk' && (
            <g>
              <circle r={11} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
              <path
                d="M-5,1 q2.5,-4 5,0 t5,0"
                fill="none"
                stroke={paint.line}
                strokeWidth={sw(1.1)}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
            </g>
          )}
          {form === 'spiril' && (
            <path
              d="M-19,4 c5,-14 9,-14 12,-4 s7,10 12,0 s7,-10 12,0 s5,6 6,4"
              fill="none"
              stroke={paint.line}
              strokeWidth={sw(6.5)}
              strokeLinecap="round"
            />
          )}
          {form === 'spiril' && (
            <path
              d="M-19,4 c5,-14 9,-14 12,-4 s7,10 12,0 s7,-10 12,0 s5,6 6,4"
              fill="none"
              stroke={paint.fill}
              strokeWidth={sw(3.6)}
              strokeLinecap="round"
            />
          )}
        </g>
      )}
    </Glyph>
  );
}

/** Virus: bakteriofag (hode, hale og halefibre) eller kappekledd virus (lipidkappe med piggproteiner rundt kapsidet). */
export function Virus({ type = 'kappekledd', paint = BIO.virus, ...g }: GlyphProps & { type?: 'bakteriofag' | 'kappekledd' }) {
  const hex = (r: number, cy = 0) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) =>
        type === 'bakteriofag' ? (
          <g>
            <polygon points={hex(10, -9)} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} strokeLinejoin="round" />
            <path d="M-4,-10 q2,-4 4,0 t4,0" fill="none" stroke={BIO.dna} strokeWidth={sw(1.2)} strokeLinecap="round" />
            <rect x={-2.6} y={0.5} width={5.2} height={12} rx={1} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
            <line x1={-6.5} y1={13} x2={6.5} y2={13} stroke={paint.line} strokeWidth={sw(1.8)} strokeLinecap="round" />
            {[-1, 1].map((s) => (
              <path
                key={s}
                d={`M${s * 3},13 L${s * 10},18 L${s * 13},14 M${s * 5},13 L${s * 7},20`}
                fill="none"
                stroke={paint.line}
                strokeWidth={sw(1.3)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ) : (
          <g>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const c = Math.cos(a);
              const s = Math.sin(a);
              return (
                <g key={i}>
                  <line x1={c * 14} y1={s * 14} x2={c * 18} y2={s * 18} stroke={paint.line} strokeWidth={sw(1.3)} />
                  <circle cx={c * 18.5} cy={s * 18.5} r={1.9} fill={BIO.antigen} />
                </g>
              );
            })}
            <circle r={14} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
            <polygon points={hex(7.5)} fill="none" stroke={paint.line} strokeWidth={sw(1.2)} strokeLinejoin="round" />
            <path d="M-4,0.5 q2,-3.5 4,0 t4,0" fill="none" stroke={BIO.dna} strokeWidth={sw(1.1)} strokeLinecap="round" />
          </g>
        )
      }
    </Glyph>
  );
}

/** Sopp (fruktlegeme): hatt med skiver under og stilk. */
export function Sopp({ paint = BIO.sopp, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <path
            d="M-4.5,-1 L-5.5,18 Q0,20 5.5,18 L4.5,-1 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.5)}
            strokeLinejoin="round"
          />
          <path
            d="M-18,0 Q-18,-17 0,-17 Q18,-17 18,0 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.6)}
            strokeLinejoin="round"
          />
          {[-12, -6, 0, 6, 12].map((x) => (
            <line key={x} x1={x} y1={-0.5} x2={x * 0.7} y2={3.5} stroke={paint.line} strokeWidth={sw(1)} strokeLinecap="round" />
          ))}
        </g>
      )}
    </Glyph>
  );
}

/* ---------- Planter ---------- */

const leaf = (x: number, y: number, len: number, angle: number) => {
  const a = (angle * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.32;
  const ny = Math.cos(a) * len * 0.32;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  return `M${x},${y} Q${mx + nx},${my + ny} ${tx},${ty} Q${mx - nx},${my - ny} ${x},${y} Z`;
};

/** Liten urt: stengel med blader. */
export function Plante({ paint = BIO.plante, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <path d="M0,19 Q-2,4 0,-16" fill="none" stroke={paint.line} strokeWidth={sw(1.8)} strokeLinecap="round" />
          {[leaf(-0.6, 8, 15, -150), leaf(-0.4, 2, 15, -30), leaf(-0.6, -7, 12, -140), leaf(-0.2, -11, 11, -45)].map((d, i) => (
            <path key={i} d={d} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} strokeLinejoin="round" />
          ))}
          <line x1={-12} y1={19} x2={12} y2={19} stroke={VIZ.muted} strokeWidth={sw(1.4)} strokeLinecap="round" />
        </g>
      )}
    </Glyph>
  );
}

/** Tre: stamme og rund krone (løvtre), eller `bartre` med spiss krone. */
export function Tre({ paint = BIO.plante, bartre = false, ...g }: GlyphProps & { bartre?: boolean }) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <rect x={-2.8} y={4} width={5.6} height={16} rx={1.5} fill={BIO.ved} />
          {bartre ? (
            <path
              d="M0,-20 L10,-6 H5 L13,7 H-13 L-5,-6 H-10 Z"
              fill={paint.fill}
              stroke={paint.line}
              strokeWidth={sw(1.6)}
              strokeLinejoin="round"
            />
          ) : (
            <g>
              {/* Omriss først, så fyll oppå: bare ytterkanten av de tre sirklene synes */}
              {[
                [0, -8, 13],
                [-9, -1, 9],
                [9, -1, 9],
              ].map(([cx, cy, r], i) => (
                <circle key={`o${i}`} cx={cx} cy={cy} r={r} fill={paint.line} stroke={paint.line} strokeWidth={sw(3.2)} />
              ))}
              {[
                [0, -8, 13],
                [-9, -1, 9],
                [9, -1, 9],
              ].map(([cx, cy, r], i) => (
                <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={paint.fill} />
              ))}
            </g>
          )}
        </g>
      )}
    </Glyph>
  );
}

/* ---------- Dyr ---------- */

/** Fisk sett fra siden (mot høyre). */
export function Fisk({ paint = BIO.fisk, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <path d="M8,0 L19,-8 L17,0 L19,8 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} strokeLinejoin="round" />
          <path
            d="M-19,0 Q-12,-11 2,-9 Q10,-6 12,0 Q10,6 2,9 Q-12,11 -19,0 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.6)}
            strokeLinejoin="round"
          />
          <path d="M-3,-9 Q0,-14 6,-12 L4,-7" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.3)} strokeLinejoin="round" />
          <path d="M-9,-5 Q-7,0 -9,5" fill="none" stroke={paint.line} strokeWidth={sw(1.1)} strokeLinecap="round" />
          <circle cx={-13} cy={-2.5} r={1.7} fill={paint.line} />
        </g>
      )}
    </Glyph>
  );
}

/** Fugl sett fra siden (mot høyre). */
export function Fugl({ paint = BIO.fugl, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <path d="M14,-6 L20,-4 L14,-2 Z" fill={BIO.sukker} stroke={paint.line} strokeWidth={sw(1)} strokeLinejoin="round" />
          <path d="M-10,3 L-20,-3 L-18,5 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} strokeLinejoin="round" />
          <line x1={-2} y1={10} x2={-3} y2={17} stroke={paint.line} strokeWidth={sw(1.4)} strokeLinecap="round" />
          <line x1={3} y1={10} x2={3} y2={17} stroke={paint.line} strokeWidth={sw(1.4)} strokeLinecap="round" />
          <ellipse cx={0} cy={3} rx={12} ry={8} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <circle cx={10} cy={-5} r={6} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <path d="M-7,0 Q1,-3 7,2 Q0,8 -7,0 Z" fill={paint.line} opacity={0.35} />
          <circle cx={11.5} cy={-6} r={1.4} fill={paint.line} />
        </g>
      )}
    </Glyph>
  );
}

/** Pattedyr (firbeint, generelt) sett fra siden (mot høyre). */
export function Pattedyr({ paint = BIO.pattedyr, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          {[-10, -5, 6, 11].map((x, i) => (
            <line key={i} x1={x} y1={4} x2={x + (i % 2 ? 1 : -1)} y2={17} stroke={paint.line} strokeWidth={sw(2.6)} strokeLinecap="round" />
          ))}
          <path d="M-15,-2 Q-21,-4 -20,-11" fill="none" stroke={paint.line} strokeWidth={sw(2)} strokeLinecap="round" />
          <path d="M9,-4 L14,-10" stroke={paint.line} strokeWidth={sw(5)} strokeLinecap="round" />
          <ellipse cx={-2} cy={0} rx={14} ry={7.5} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          <path d="M11,-14 L13,-20 L16,-14 Z" fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.2)} strokeLinejoin="round" />
          <path
            d="M10,-9 Q11,-15 17,-14 L21,-10 Q19,-7 15,-7 Q11,-6 10,-9 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.5)}
            strokeLinejoin="round"
          />
          <circle cx={15.5} cy={-11.3} r={1.2} fill={paint.line} />
        </g>
      )}
    </Glyph>
  );
}

/** Insekt sett ovenfra: hode, bryst og bakkropp, seks bein og antenner. */
export function Insekt({ paint = BIO.insekt, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          {[-1, 1].map((s) => (
            <g key={s} fill="none" stroke={paint.line} strokeWidth={sw(1.3)} strokeLinecap="round" strokeLinejoin="round">
              <path d={`M${s * 2},-16 Q${s * 5},-20 ${s * 8},-19`} />
              <path d={`M${s * 3},-7 L${s * 10},-11 L${s * 13},-9`} />
              <path d={`M${s * 3.5},-4 L${s * 11},-3 L${s * 14},0`} />
              <path d={`M${s * 3},-1 L${s * 9},5 L${s * 11},10`} />
            </g>
          ))}
          <ellipse cx={0} cy={8} rx={5.5} ry={10} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <ellipse cx={0} cy={-5} rx={4.2} ry={4.8} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <circle cx={0} cy={-13} r={3.2} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.4)} />
          {[3, 7, 11].map((y) => (
            <line key={y} x1={-4.6} y1={y} x2={4.6} y2={y} stroke={paint.line} strokeWidth={sw(0.9)} strokeOpacity={0.6} />
          ))}
        </g>
      )}
    </Glyph>
  );
}

/** Menneske som piktogram (hode og overkropp). Brukes bl.a. som individ i smittemodeller (farg med `paint`). */
export function Menneske({ paint = BIO.menneske, ...g }: GlyphProps) {
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          <circle cy={-11} r={7.5} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.5)} />
          <path
            d="M-13,19 V7 Q-13,-1 -4,-1 H4 Q13,-1 13,7 V19 Z"
            fill={paint.fill}
            stroke={paint.line}
            strokeWidth={sw(1.5)}
            strokeLinejoin="round"
          />
        </g>
      )}
    </Glyph>
  );
}

/* ---------- Blodceller og immunforsvar ---------- */

/**
 * Rødt blodlegeme sett ovenfra (bikonkav skive med lys midte).
 * `swelling` 0–1: sveller mot kuleform (den lyse midten forsvinner). `crenation` 0–1: skrumper med takkete kant.
 * `burst`: har sprukket (hemolyse) og vises som et tomt «spøkelse» med hemoglobin som lekker ut.
 */
export function RodtBlodlegeme({
  swelling = 0,
  crenation = 0,
  burst = false,
  paint = BIO.rodtBlodlegeme,
  ...g
}: GlyphProps & { swelling?: number; crenation?: number; burst?: boolean }) {
  const sw0 = Math.min(1, Math.max(0, swelling));
  const cr = Math.min(1, Math.max(0, crenation));
  const R = 17;
  let outline: string;
  if (cr > 0.01) {
    const n = 16;
    const pts: string[] = [];
    for (let i = 0; i <= n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2;
      const r = R * (1 - 0.06 * cr) + R * 0.13 * cr * Math.max(0, Math.cos(a * n)) ** 3;
      pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
    }
    outline = `M${pts.join(' L')} Z`;
  } else outline = `M${-R},0 A${R},${R} 0 1 0 ${R},0 A${R},${R} 0 1 0 ${-R},0 Z`;
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) =>
        burst ? (
          <g>
            <circle r={R} fill={paint.fill} opacity={0.18} />
            <circle r={R} fill="none" stroke={paint.line} strokeWidth={sw(1.3)} strokeDasharray="7 5" opacity={0.7} />
            {[
              [24, -6, 2.4],
              [21, 11, 1.8],
              [-23, 9, 2.1],
              [-8, -24, 1.7],
              [10, 23, 2.2],
              [-20, -14, 1.5],
            ].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={paint.line} opacity={0.65} />
            ))}
          </g>
        ) : (
          <g>
            <path d={outline} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} strokeLinejoin="round" />
            {sw0 < 0.95 && <circle r={R * 0.46 * (1 - sw0 * 0.7)} fill={paint.line} opacity={0.22 * (1 - sw0)} />}
          </g>
        )
      }
    </Glyph>
  );
}

export type HvittBlodlegemeType = 'granulocytt' | 'lymfocytt' | 'makrofag';

/** Hvitt blodlegeme: granulocytt (kjerne med lapper), lymfocytt (stor rund kjerne) eller makrofag (med utløpere). */
export function HvittBlodlegeme({ type = 'granulocytt', paint = BIO.immuncelle, ...g }: GlyphProps & { type?: HvittBlodlegemeType }) {
  const blob = 'M-17,2 Q-19,-12 -7,-16 Q2,-21 9,-14 Q20,-14 18,-3 Q23,8 12,13 Q5,22 -5,16 Q-19,17 -17,2 Z';
  return (
    <Glyph {...g} line={paint.line}>
      {(sw) => (
        <g>
          {type === 'makrofag' ? (
            <path d={blob} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} strokeLinejoin="round" />
          ) : (
            <circle r={type === 'lymfocytt' ? 14 : 17} fill={paint.fill} stroke={paint.line} strokeWidth={sw(1.6)} />
          )}
          {type === 'lymfocytt' && <circle cx={1} cy={1} r={10} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={sw(1.3)} />}
          {type === 'granulocytt' && (
            <path
              d="M-9,-2 a4.6,4.6 0 1 1 6,-4 a4.6,4.6 0 0 1 7,1 a4.6,4.6 0 1 1 2,8 a4.6,4.6 0 0 1 -8,2 a4.6,4.6 0 1 1 -7,-7 Z"
              fill={BIO.kjerne.fill}
              stroke={BIO.kjerne.line}
              strokeWidth={sw(1.3)}
              strokeLinejoin="round"
            />
          )}
          {type === 'makrofag' && (
            <ellipse cx={-2} cy={0} rx={7} ry={5.5} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={sw(1.3)} />
          )}
        </g>
      )}
    </Glyph>
  );
}

/** Antistoff: Y-formet protein med to tunge og to lette kjeder; antigenet bindes ytterst på armene. */
export function Antistoff({ paint, ...g }: GlyphProps) {
  const c = paint?.line ?? BIO.antistoff;
  return (
    <Glyph {...g} line={c}>
      {(sw) => (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0,17 V2 L-11,-12 M0,2 L11,-12" stroke={c} strokeWidth={sw(4.4)} />
          <path d="M-6.5,-1 L-15.5,-12.5 M6.5,-1 L15.5,-12.5" stroke={c} strokeWidth={sw(2.6)} opacity={0.75} />
        </g>
      )}
    </Glyph>
  );
}

/* ---------- Etter navn ---------- */

export type OrganismeType =
  | 'bakterie'
  | 'kokk'
  | 'spiril'
  | 'virus'
  | 'bakteriofag'
  | 'sopp'
  | 'plante'
  | 'tre'
  | 'bartre'
  | 'fisk'
  | 'fugl'
  | 'pattedyr'
  | 'insekt'
  | 'menneske'
  | 'rodtBlodlegeme'
  | 'hvittBlodlegeme'
  | 'antistoff';

/** Norske navn til etiketter og skjermlesere. */
export const ORGANISME_NAVN: Record<OrganismeType, string> = {
  bakterie: 'stavbakterie',
  kokk: 'kokk (kulebakterie)',
  spiril: 'spiril (skruebakterie)',
  virus: 'kappekledd virus',
  bakteriofag: 'bakteriofag',
  sopp: 'sopp',
  plante: 'plante',
  tre: 'løvtre',
  bartre: 'bartre',
  fisk: 'fisk',
  fugl: 'fugl',
  pattedyr: 'pattedyr',
  insekt: 'insekt',
  menneske: 'menneske',
  rodtBlodlegeme: 'rødt blodlegeme',
  hvittBlodlegeme: 'hvitt blodlegeme',
  antistoff: 'antistoff',
};

/** Hvilket som helst av symbolene etter navn, f.eks. i en næringskjede: <Organisme type="fisk" x y size />. */
export function Organisme({ type, ...g }: GlyphProps & { type: OrganismeType }) {
  const t = g.title ?? ORGANISME_NAVN[type];
  switch (type) {
    case 'bakterie':
      return <Bakterie {...g} title={t} form="stav" />;
    case 'kokk':
      return <Bakterie {...g} title={t} form="kokk" />;
    case 'spiril':
      return <Bakterie {...g} title={t} form="spiril" />;
    case 'virus':
      return <Virus {...g} title={t} type="kappekledd" />;
    case 'bakteriofag':
      return <Virus {...g} title={t} type="bakteriofag" />;
    case 'sopp':
      return <Sopp {...g} title={t} />;
    case 'plante':
      return <Plante {...g} title={t} />;
    case 'tre':
      return <Tre {...g} title={t} />;
    case 'bartre':
      return <Tre {...g} title={t} bartre />;
    case 'fisk':
      return <Fisk {...g} title={t} />;
    case 'fugl':
      return <Fugl {...g} title={t} />;
    case 'pattedyr':
      return <Pattedyr {...g} title={t} />;
    case 'insekt':
      return <Insekt {...g} title={t} />;
    case 'menneske':
      return <Menneske {...g} title={t} />;
    case 'rodtBlodlegeme':
      return <RodtBlodlegeme {...g} title={t} />;
    case 'hvittBlodlegeme':
      return <HvittBlodlegeme {...g} title={t} />;
    case 'antistoff':
      return <Antistoff {...g} title={t} />;
  }
}
