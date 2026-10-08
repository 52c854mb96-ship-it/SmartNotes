/**
 * Spektrumpanelet i «Stjernespekter»: øverst lysstyrken fra stjernen som graf (med det kontinuerlige spekteret uten
 * atmosfære stiplet), under det stjernespekteret slik kameraet ser det (mørke linjer i regnbuen), og så
 * laboratoriespektrene til de fem grunnstoffene (lyse linjer på mørk bunn) på samme bølgelengdeakse. Treff vises med
 * en stiplet linje opp til stjernespekteret, linjer som mangler i stjernen med ×, og trekantene over stjernespekteret
 * viser hvilke mørke linjer som er forklart (fylt, i fargen til grunnstoffet) og hvilke som ikke er det ennå (hule).
 */
import { useMemo, type MouseEvent } from 'react';
import { Txt, VIZ, fmt, linePath, useTextScale } from '../../kit';
import { LinearGradient, SCENE, Spektrum, alpha, bolgelengdeFarge, useStrokeScale, useSvgId } from '../../kit/scene';
import {
  ELEMENTS,
  ELEMENT_ORDER,
  RANGE,
  STARS,
  continuum,
  labLines,
  type Analysis,
  type ElementId,
  type StarId,
} from './model-stjernespekter';

/** Fargen til hvert grunnstoff (samme i figuren, scenen og forklaringen). */
export const ELEMENT_COLOR: Record<ElementId, string> = {
  H: VIZ.series[0]!,
  He: VIZ.series[1]!,
  Na: VIZ.series[2]!,
  Ca: VIZ.series[3]!,
  Fe: VIZ.series[4]!,
};

const r1 = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);

/** Målene i panelet; høyden avhenger av tekstskalaen f (mobil), så figuren kan få riktig viewBox før den tegnes. */
export function panelLayout(f: number) {
  const k = Math.max(1, 0.85 * f);
  const fs = 17 * f;
  const W = 800;
  const labelW = 78 + 52 * (f - 1);
  const x0 = 10 + labelW;
  const x1 = W - 16;
  const gy0 = 10 + fs * 1.05;
  const GH = 112 + 70 * (f - 1);
  const gy1 = gy0 + GH;
  const mk = 8 * k;
  const sy0 = gy1 + 7 + mk + 3;
  const SH = 30 * k;
  const RH = 22 * k;
  const gap = 13 * k;
  const ry0 = sy0 + SH + gap;
  const rows = ELEMENT_ORDER.map((_, i) => ry0 + i * (RH + gap));
  const last = (rows[rows.length - 1] ?? ry0) + RH;
  const H = Math.round(last + 6 * k + fs * 0.75 + 12);
  return { k, fs, W, labelW, x0, x1, gy0, gy1, mk, sy0, SH, RH, gap, rows, last, H };
}

export interface SpektrumPanelProps {
  star: StarId;
  analysis: Analysis;
  /** Punktene i grafen (λ i nm, relativ lysstyrke). */
  curve: [number, number][];
  selected: number;
  onSelect: (index: number) => void;
  onToggle: (id: ElementId) => void;
}

export function SpektrumPanel({ star, analysis, curve, selected, onSelect, onToggle }: SpektrumPanelProps) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const L = panelLayout(f);
  const { x0, x1, gy0, gy1, sy0, SH, RH, gap, rows, last, k, mk } = L;
  const rainbow = useSvgId('stj-regnbue');
  const dimId = useSvgId('stj-demp');
  const areaId = useSvgId('stj-areal');
  const T = STARS[star].T;
  const sx = (nm: number) => x0 + ((nm - RANGE[0]) / (RANGE[1] - RANGE[0])) * (x1 - x0);
  const sy = (v: number) => gy1 - (v / 1.08) * (gy1 - gy0);
  const pxPerNm = (x1 - x0) / (RANGE[1] - RANGE[0]);
  const lines = analysis.lines;
  const sel = lines[selected]?.line;

  const rainbowStops = useMemo(() => {
    const out: [number, string][] = [];
    for (let nm = RANGE[0]; nm <= RANGE[1] + 1e-6; nm += 10) out.push([(nm - RANGE[0]) / (RANGE[1] - RANGE[0]), bolgelengdeFarge(nm)]);
    return out;
  }, []);
  // Stjernespekteret er svakere der stjernen lyser lite (blått i kjølige stjerner, rødt i varme).
  const dimStops = useMemo(() => {
    const out: [number, string, number][] = [];
    for (let nm = RANGE[0]; nm <= RANGE[1] + 1e-6; nm += 20) out.push([(nm - RANGE[0]) / (RANGE[1] - RANGE[0]), SCENE.space, 0.6 * (1 - continuum(nm, T))]);
    return out;
  }, [T]);
  const paths = useMemo(() => {
    const line = linePath(curve, sx, sy);
    const cont: [number, number][] = [];
    for (let nm = RANGE[0]; nm <= RANGE[1] + 1e-6; nm += 2) cont.push([nm, continuum(nm, T)]);
    const area = `${line}L${r1(sx(RANGE[1]))} ${r1(gy1)}L${r1(sx(RANGE[0]))} ${r1(gy1)}Z`;
    return { line, cont: linePath(cont, sx, sy), area };
    // sx og sy er gitt av layouten (f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curve, T, f]);

  const ticks = [400, 450, 500, 550, 600, 650, 700];
  const tickY = last + 6 * k + L.fs * 0.75;

  /** Klikk i grafen eller stjernespekteret: velg den nærmeste mørke linja. */
  const pick = (e: MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    const nm = RANGE[0] + ((p.x - x0) / (x1 - x0)) * (RANGE[1] - RANGE[0]);
    let best = 0;
    lines.forEach((l, i) => {
      if (Math.abs(l.line.nm - nm) < Math.abs((lines[best]?.line.nm ?? Infinity) - nm)) best = i;
    });
    onSelect(best);
  };

  const strip = (y: number, h: number) => (
    <rect x={x0} y={r1(y)} width={r1(x1 - x0)} height={r1(h)} rx={2} fill="none" stroke={SCENE.outline} strokeWidth={1 * ss} />
  );

  return (
    <g>
      <LinearGradient id={rainbow} x1={x0} y1={0} x2={x1} y2={0} userSpace stops={rainbowStops} />
      <LinearGradient id={dimId} x1={x0} y1={0} x2={x1} y2={0} userSpace stops={dimStops} />
      <LinearGradient id={areaId} x1={x0} y1={0} x2={x1} y2={0} userSpace stops={rainbowStops.map(([o, c]) => [o, c, 0.3])} />

      {/* Venstre kolonne: aksetittel for grafen og navnene på radene */}
      <text
        x={r1(x0 - 14 * f)}
        y={r1((gy0 + gy1) / 2)}
        textAnchor="middle"
        className="viz-axis-label"
        transform={`rotate(-90 ${r1(x0 - 14 * f)} ${r1((gy0 + gy1) / 2)})`}
      >
        Lysstyrke
      </text>
      <Txt x={x0 - 8} y={sy0 + SH / 2 + 0.3 * L.fs * 0.78} anchor="end" size={0.78} weight={700}>
        {STARS[star].name}
      </Txt>

      {/* Stiplede linjer fra treffene i laboratoriet opp til stjernespekteret (bak stripene) */}
      {ELEMENT_ORDER.map((id, i) => {
        const st = analysis.elements[id];
        if (!st.on) return null;
        const y = rows[i] ?? 0;
        return labLines(id)
          .filter((l) => !st.missing.includes(l))
          .map((l) => (
            <line
              key={`${id}-${l.nm}`}
              x1={r1(sx(l.nm))}
              x2={r1(sx(l.nm))}
              y1={r1(y)}
              y2={r1(sy0 + SH)}
              stroke={ELEMENT_COLOR[id]}
              strokeWidth={1.6 * ss}
              strokeDasharray={`${3 * ss} ${3 * ss}`}
            />
          ));
      })}

      {/* Grafen: lysstyrken fra stjernen */}
      <line x1={x0} x2={x1} y1={r1(gy1)} y2={r1(gy1)} className="viz-axis" />
      <line x1={x0} x2={x0} y1={r1(gy0)} y2={r1(gy1)} className="viz-axis" />
      {[0.5, 1].map((v) => (
        <line key={v} x1={x0} x2={x1} y1={r1(sy(v))} y2={r1(sy(v))} className="viz-gridline" />
      ))}
      <path d={paths.area} fill={`url(#${areaId})`} />
      <path d={paths.cont} fill="none" stroke={VIZ.muted} strokeWidth={1.4 * ss} strokeDasharray={`${5 * ss} ${4 * ss}`} />
      <path d={paths.line} fill="none" stroke={VIZ.ink} strokeWidth={1.7 * ss} strokeLinejoin="round" />

      {/* Trekanter: hvilke mørke linjer er forklart? */}
      {lines.map((s, i) => {
        const x = sx(s.line.nm);
        const by = sy0 - 3;
        const w = 4.2 * k;
        const d = `M${r1(x - w)} ${r1(by - mk)}L${r1(x + w)} ${r1(by - mk)}L${r1(x)} ${r1(by)}Z`;
        const c = s.explainedBy ? ELEMENT_COLOR[s.explainedBy] : null;
        return c ? (
          <path key={i} d={d} fill={c} stroke={VIZ.surface} strokeWidth={0.8 * ss} />
        ) : (
          <path key={i} d={d} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.2 * ss} strokeLinejoin="round" />
        );
      })}

      {/* Stjernespekteret: regnbue med mørke linjer, svakere der stjernen lyser lite */}
      <rect x={x0} y={r1(sy0)} width={r1(x1 - x0)} height={r1(SH)} rx={2} fill={SCENE.space} />
      <rect x={x0} y={r1(sy0)} width={r1(x1 - x0)} height={r1(SH)} rx={2} fill={`url(#${rainbow})`} />
      <rect x={x0} y={r1(sy0)} width={r1(x1 - x0)} height={r1(SH)} rx={2} fill={`url(#${dimId})`} />
      {lines.map((s, i) => {
        const fwhm = 2.355 * s.line.sigma * pxPerNm;
        const core = Math.max(1.8 * ss, fwhm);
        const x = sx(s.line.nm);
        return (
          <g key={i}>
            <rect x={r1(x - core)} y={r1(sy0)} width={r1(core * 2)} height={r1(SH)} fill={SCENE.space} opacity={0.4 * s.line.depth} />
            <rect x={r1(x - core / 2)} y={r1(sy0)} width={r1(core)} height={r1(SH)} fill={SCENE.space} opacity={Math.min(1, 0.15 + s.line.depth)} />
          </g>
        );
      })}
      {strip(sy0, SH)}

      {/* Laboratoriespektrene */}
      {ELEMENT_ORDER.map((id, i) => {
        const st = analysis.elements[id];
        const y = rows[i] ?? 0;
        return (
          <g key={id} onClick={() => onToggle(id)} style={{ cursor: 'pointer' }}>
            <rect x={10} y={r1(y - gap / 2)} width={r1(x1 - 10)} height={r1(RH + gap)} fill="transparent" />
            {st.on ? (
              <Spektrum x={x0} y={y} w={x1 - x0} h={RH} type="emisjon" fra={RANGE[0]} til={RANGE[1]} linjer={labLines(id).map((l) => ({ nm: l.nm, styrke: 0.55 + 0.45 * l.I }))} />
            ) : (
              <>
                {/* Ugjennomsiktig bunn, så de stiplede treff-linjene fra radene under ikke går gjennom teksten */}
                <rect x={x0} y={r1(y)} width={r1(x1 - x0)} height={r1(RH)} rx={2} fill={VIZ.surface} />
                <rect
                  x={x0}
                  y={r1(y)}
                  width={r1(x1 - x0)}
                  height={r1(RH)}
                  rx={2}
                  fill={alpha(VIZ.muted, 0.1)}
                  stroke={alpha(VIZ.muted, 0.6)}
                  strokeWidth={1 * ss}
                  strokeDasharray={`${4 * ss} ${4 * ss}`}
                />
                <text x={r1((x0 + x1) / 2)} y={r1(y + RH / 2 + 4.5 * f)} textAnchor="middle" className="viz-tick">
                  av (klikk eller bruk bryteren)
                </text>
              </>
            )}
            <Txt x={x0 - 8} y={y + RH / 2 - 0.05 * L.fs} anchor="end" size={0.86} weight={700} color={st.on ? ELEMENT_COLOR[id] : VIZ.muted}>
              {id}
            </Txt>
            <Txt x={x0 - 8} y={y + RH / 2 + 0.62 * L.fs} anchor="end" size={0.6} muted>
              {ELEMENTS[id].name}
            </Txt>
            {/* × over laboratorielinjer som ikke finnes i stjernen */}
            {st.on &&
              st.missing.map((l) => {
                const x = sx(l.nm);
                const cy = y - gap / 2;
                const a = 3.6 * k;
                return (
                  <path
                    key={l.nm}
                    d={`M${r1(x - a)} ${r1(cy - a)}L${r1(x + a)} ${r1(cy + a)}M${r1(x + a)} ${r1(cy - a)}L${r1(x - a)} ${r1(cy + a)}`}
                    stroke={VIZ.ink}
                    strokeWidth={1.8 * ss}
                    strokeLinecap="round"
                  />
                );
              })}
          </g>
        );
      })}

      {/* Bølgelengdeaksen under radene */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={r1(sx(v))} x2={r1(sx(v))} y1={r1(last)} y2={r1(last + 5 * ss)} stroke={VIZ.muted} strokeWidth={1.1 * ss} />
          {v < 700 && (
            <text x={r1(sx(v))} y={r1(tickY)} textAnchor="middle" className="viz-tick">
              {v}
            </text>
          )}
        </g>
      ))}
      <text x={x1} y={r1(tickY)} textAnchor="end" className="viz-tick">
        nm
      </text>

      {/* Valgt linje: markør gjennom alt */}
      {sel && (
        <g pointerEvents="none">
          <line
            x1={r1(sx(sel.nm))}
            x2={r1(sx(sel.nm))}
            y1={r1(gy0)}
            y2={r1(last)}
            stroke={VIZ.ink}
            strokeWidth={1.3 * ss}
            strokeDasharray={`${2 * ss} ${3 * ss}`}
            opacity={0.85}
          />
          <Txt
            x={Math.min(x1, Math.max(x0, sx(sel.nm)))}
            y={gy0 - 4}
            anchor={sx(sel.nm) > x1 - 50 * f ? 'end' : sx(sel.nm) < x0 + 50 * f ? 'start' : 'middle'}
            size={0.78}
            weight={700}
          >
            {`${fmt(sel.nm, 1)} nm`}
          </Txt>
        </g>
      )}

      {/* Klikk i grafen eller stjernespekteret for å velge en linje */}
      <rect x={x0} y={r1(gy0)} width={r1(x1 - x0)} height={r1(sy0 + SH - gy0)} fill="transparent" style={{ cursor: 'pointer' }} onClick={pick} />
    </g>
  );
}
