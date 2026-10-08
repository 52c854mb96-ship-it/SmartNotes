/**
 * Bølgelengdene i luft og vann ved samme frekvens (k6-ekko): to utsnitt av like lang strekning med lydbølgen som
 * fortetninger (sterk farge) og fortynninger (svak farge). λ = v / f, så bølgelengden i vann er 4,4 ganger lengre.
 */
import { Figure, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Dimension, SCENE, alpha, useStrokeScale, useSvgId } from '../../kit/scene';
import { SOUND } from './ekko-torden';
import { LYDFART, STOFF, stripLength, wavelength, type Situasjon, type Stoff } from './model-ekko';

/** Tall med tre gjeldende siffer: 6,80 · 30,0 · 1,70. */
export function fmt3(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return fmt(v, 0);
  return fmt(v, Math.max(0, 2 - Math.floor(Math.log10(v) + 1e-9)));
}

/** Lengde med passende enhet: «6,80 m» eller «30,0 mm». */
export function fmtLength(m: number): string {
  return m >= 1 ? `${fmt3(m)} m` : `${fmt3(m * 1000)} mm`;
}

const X0 = 40;
const X1 = 760;

export function bolgelengdeHeight(f: number): number {
  const lh = 17 * f;
  const row = lh + 10 + (30 + 6 * (f - 1)) + 26;
  return Math.round(8 + 2 * row + 18 + lh + 10);
}

export function BolgelengdeFigur({ sit, fHz, height }: { sit: Situasjon; fHz: number; height: number }) {
  const label = `To utsnitt på ${sit === 'torden' ? '80 m' : '80 mm'} med lyd på samme frekvens. I luft er bølgelengden ${fmtLength(wavelength(LYDFART.luft, fHz))}, i vann ${fmtLength(wavelength(LYDFART.vann, fHz))}.`;
  return (
    <Figure viewBox={`0 0 800 ${height}`} label={label} maxHeight={420}>
      <Strips sit={sit} fHz={fHz} />
    </Figure>
  );
}

function Strips({ sit, fHz }: { sit: Situasjon; fHz: number }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const id = useSvgId('ekko-lambda');
  const S = stripLength(sit);
  const pxPerM = (X1 - X0) / S;
  const lh = 17 * f;
  const sh = 30 + 6 * (f - 1);
  const rowH = lh + 10 + sh + 26;
  const unit = sit === 'torden' ? 'm' : 'mm';
  const unitScale = sit === 'torden' ? 1 : 1000;
  const rows: Stoff[] = ['luft', 'vann'];
  const axisY = 8 + 2 * rowH + 4;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((q) => q * S);
  return (
    <g>
      {rows.map((stoff, i) => {
        const v = LYDFART[stoff];
        const lam = wavelength(v, fHz);
        const lamPx = lam * pxPerM;
        const active = STOFF[sit] === stoff;
        const y0 = 8 + i * rowH;
        const sy = y0 + lh + 10;
        const dimY = sy + sh + 13;
        const bg = stoff === 'luft' ? SCENE.skyBottom : SCENE.waterLight;
        const gid = `${id}${stoff}`;
        return (
          <g key={stoff}>
            <Txt x={X0} y={y0 + lh} anchor="start" size={0.92} weight={active ? 700 : 560} muted={!active}>
              {stoff === 'luft' ? 'Luft' : 'Vann'}, v = {fmt(v, 0)} m/s: λ = v / f = {fmtLength(lam)}
            </Txt>
            <defs>
              <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={X0} y1={0} x2={X0 + lamPx} y2={0} spreadMethod="repeat">
                <stop offset={0} style={{ stopColor: SOUND, stopOpacity: 0.8 }} />
                <stop offset={0.25} style={{ stopColor: SOUND, stopOpacity: 0.4 }} />
                <stop offset={0.5} style={{ stopColor: SOUND, stopOpacity: 0.04 }} />
                <stop offset={0.75} style={{ stopColor: SOUND, stopOpacity: 0.4 }} />
                <stop offset={1} style={{ stopColor: SOUND, stopOpacity: 0.8 }} />
              </linearGradient>
            </defs>
            <g opacity={active ? 1 : 0.62}>
              <rect x={X0} y={sy} width={X1 - X0} height={sh} rx={4} fill={bg} />
              <rect x={X0} y={sy} width={X1 - X0} height={sh} rx={4} fill={`url(#${gid})`} />
              <rect x={X0} y={sy} width={X1 - X0} height={sh} rx={4} fill="none" stroke={alpha(VIZ.ink, 0.35)} strokeWidth={1 * ss} />
            </g>
            <Dimension x1={X0} y1={dimY} x2={X0 + lamPx} y2={dimY} color={active ? VIZ.ink : VIZ.muted} />
            <Txt x={X0 + lamPx + 7} y={dimY + 5 * f} anchor="start" size={0.85} weight={650} muted={!active}>
              λ
            </Txt>
          </g>
        );
      })}
      {/* Målestokk felles for begge utsnittene */}
      <line x1={X0} y1={axisY} x2={X1} y2={axisY} stroke={VIZ.muted} strokeWidth={1 * ss} />
      {ticks.map((x, i) => (
        <g key={i}>
          <line x1={X0 + x * pxPerM} y1={axisY} x2={X0 + x * pxPerM} y2={axisY + 6} stroke={VIZ.muted} strokeWidth={1 * ss} />
          <Txt x={X0 + x * pxPerM} y={axisY + 8 + lh} size={0.8} muted anchor={i === ticks.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
            {fmt(x * unitScale, 0)}
            {i === ticks.length - 1 ? ` ${unit}` : ''}
          </Txt>
        </g>
      ))}
    </g>
  );
}
