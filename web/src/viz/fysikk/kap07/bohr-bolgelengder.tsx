/**
 * Bølgelengdene til alle overgangene opp til n = 6 i «Bohrs atommodell», på en logaritmisk akse: én rad per serie,
 * med ultrafiolett, synlig lys og infrarødt markert øverst. Regnbuen i det synlige området følger den logaritmiske
 * aksen, så fargen rett over en linje er fargen til linja.
 */
import { useId, type ReactNode } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { SCENE, alpha, useStrokeScale } from '../../kit/scene';
import { nmText } from './bohr-atom';
import { N_TOP } from './bohr-nivaer';
import { seriesName, transitionPhoton, VISIBLE_MAX, VISIBLE_MIN, wavelengthColor, wavelengthToRgb } from './model';

const LOG_MIN = Math.log10(80);
const LOG_MAX = Math.log10(8000);

export function WavelengthAxis({
  upper,
  lower,
  height,
  seriesColor,
}: {
  upper: number;
  lower: number;
  height: number;
  seriesColor: (nLower: number) => string;
}) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const gradId = `rainbow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const x0 = 30;
  const x1 = 770;
  const sx = (nm: number) => x0 + ((Math.log10(nm) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (x1 - x0);
  const barY = 34 * f;
  const barH = 18;
  const rowsTop = barY + barH + 18;
  const axisY = height - 56 * f;
  const rowH = (axisY - rowsTop - 10) / 5;
  const selNm = transitionPhoton(upper, lower).lambda * 1e9;
  const ticks = [100, 200, 500, 1000, 2000, 5000];
  // Fargestoppene står der bølgelengden er på den logaritmiske aksen
  const span = Math.log10(VISIBLE_MAX) - Math.log10(VISIBLE_MIN);
  const stops: ReactNode[] = [];
  for (let nm = VISIBLE_MIN; nm <= VISIBLE_MAX; nm += 10) {
    stops.push(
      <stop key={nm} offset={`${((Math.log10(nm) - Math.log10(VISIBLE_MIN)) / span) * 100}%`} stopColor={wavelengthColor(nm, 'black')} />,
    );
  }
  const selX = sx(selNm);
  const labelAnchor = selX > 680 ? 'end' : selX < 120 ? 'start' : 'middle';
  const selColor = wavelengthColor(selNm, seriesColor(lower));

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {stops}
        </linearGradient>
      </defs>
      {/* Områdene: ultrafiolett, synlig, infrarødt */}
      <rect x={sx(80)} y={barY} width={sx(VISIBLE_MIN) - sx(80)} height={barH} rx={4} fill={VIZ.series[3]} opacity={0.18} />
      <rect x={sx(VISIBLE_MAX)} y={barY} width={sx(8000) - sx(VISIBLE_MAX)} height={barH} rx={4} fill={VIZ.series[1]} opacity={0.18} />
      <rect x={sx(VISIBLE_MIN)} y={barY} width={sx(VISIBLE_MAX) - sx(VISIBLE_MIN)} height={barH} fill={`url(#${gradId})`} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
      {/* Områdenavnet skjules der etiketten til det valgte fotonet står */}
      {selNm >= VISIBLE_MIN && (
        <Txt x={(sx(80) + sx(VISIBLE_MIN)) / 2} y={barY - 10} muted size={0.85}>
          ultrafiolett
        </Txt>
      )}
      {selNm <= VISIBLE_MAX && (
        <Txt x={(sx(VISIBLE_MAX) + sx(8000)) / 2} y={barY - 10} muted size={0.85}>
          infrarødt
        </Txt>
      )}

      {/* Én rad per serie */}
      {[1, 2, 3, 4, 5].map((L) => {
        const y = rowsTop + (L - 1) * rowH;
        const uppers: number[] = [];
        for (let n = L + 1; n <= N_TOP; n++) uppers.push(n);
        const nms = uppers.map((n) => transitionPhoton(n, L).lambda * 1e9);
        const longest = Math.max(...nms);
        const shortest = Math.min(...nms);
        const right = sx(longest) + 10 < x1 - 120 * f * 0.6;
        const active = L === lower;
        return (
          <g key={L}>
            {active && <rect x={x0 - 6} y={y - 2} width={x1 - x0 + 12} height={rowH} rx={6} fill={alpha(VIZ.grid, 0.22)} />}
            {nms.map((v, i) => {
              const sel = active && uppers[i] === upper;
              const real = L === 2 && wavelengthToRgb(v);
              return (
                <line
                  key={v}
                  x1={sx(v)}
                  x2={sx(v)}
                  y1={y + 2}
                  y2={y + rowH - 4}
                  stroke={real ? wavelengthColor(v, seriesColor(L)) : seriesColor(L)}
                  strokeWidth={(sel ? 5 : 2.5) * ss}
                  strokeLinecap="round"
                  opacity={active ? 1 : 0.55}
                />
              );
            })}
            <Txt
              x={right ? sx(longest) + 12 : sx(shortest) - 12}
              y={y + rowH / 2 + 6}
              anchor={right ? 'start' : 'end'}
              color={active ? seriesColor(L) : undefined}
              muted={!active}
              weight={active ? 700 : 500}
              size={0.9}
            >
              {seriesName(L)}
            </Txt>
          </g>
        );
      })}

      {/* Valgt linje: markør i fotonets farge over stripa */}
      <line x1={selX} x2={selX} y1={barY + barH} y2={rowsTop + (lower - 1) * rowH + 2} className="viz-guide" />
      <path
        d={`M${selX} ${barY + barH + 1}L${selX - 6 * ss} ${barY + barH + 12 * ss}L${selX + 6 * ss} ${barY + barH + 12 * ss}Z`}
        fill={selColor}
        stroke={SCENE.outline}
        strokeWidth={0.9 * ss}
      />
      <Txt x={selX} y={barY - 10} anchor={labelAnchor} weight={700}>
        {nmText(selNm)} nm
      </Txt>

      {/* Akse */}
      <line x1={x0} x2={x1} y1={axisY} y2={axisY} className="viz-axis" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={axisY} y2={axisY + 6} className="viz-axis" />
          <text x={sx(t)} y={axisY + 22 * f} textAnchor="middle" className="viz-tick">
            {fmt(t, 0)}
          </text>
        </g>
      ))}
      <text x={x1} y={height - 6} textAnchor="end" className="viz-axis-label">
        bølgelengde λ (nm, logaritmisk akse)
      </text>
    </>
  );
}
