/**
 * Spekteret (k6-em-spekteret): hele det elektromagnetiske spekteret på en logaritmisk skala fra 1 km til 0,1 pm,
 * med områdene, en skjematisk bølge som blir kortere mot høyre, tre akser (λ, f og E) som leses av med markøren,
 * eksemplene fra hverdagen som prikker, og synlig lys forstørret over spekteret. Eleven drar markøren langs spekteret
 * eller i den forstørrede regnbuen.
 */
import { useMemo, type PointerEvent } from 'react';
import { Figure, Txt, VIZ } from '../../kit';
import { LinearGradient, SCENE, Spektrum, alpha, bolgelengdeFarge, useStrokeScale, useSvgId } from '../../kit/scene';
import {
  EXAMPLES,
  LAMBDA_ION,
  REGIONS,
  VISIBLE_MAX,
  VISIBLE_MIN,
  bandPos,
  chirpPhase,
  energyEv,
  energyTicks,
  fmtEv,
  fmtFreq,
  fmtLambda,
  fmtLambdaTick,
  fmtPow,
  freqTicks,
  frequency,
  lambdaAtPos,
  lambdaTicks,
  nearestExample,
  regionOf,
  type ExampleId,
  type RegionId,
  type Tick,
} from './model-em-spekteret';
import { waveColor } from './em-spekteret-farger';

const X0 = 50;
const X1 = 780;
const r1 = (v: number) => Math.round(v * 10) / 10;
const xAt = (p: number) => X0 + (X1 - X0) * p;
const xOf = (lambda: number) => xAt(bandPos(lambda));

/** Hvor mye plass en tekst tar (figurens enheter): ca. 0,56 · skriftstørrelsen per tegn. */
const textW = (t: string, fs: number) => t.length * fs * 0.56;

/** Navnene i spekteret: to linjer der det er trangt (UV er bare 1,6 tierpotenser bred). */
function regionLines(id: RegionId, narrow: boolean): string[] {
  switch (id) {
    case 'radio':
      return narrow ? ['Radio-', 'bølger'] : ['Radiobølger'];
    case 'mikro':
      return narrow ? ['Mikro-', 'bølger'] : ['Mikrobølger'];
    case 'ir':
      return ['Infrarødt'];
    case 'synlig':
      return [];
    case 'uv':
      return narrow ? ['UV'] : ['Ultra-', 'fiolett'];
    case 'rontgen':
      return ['Røntgen'];
    case 'gamma':
      return ['Gamma'];
  }
}

export function bandLayout(f: number, s: number) {
  const fs = 17 * f; // vanlig etikett
  const narrow = f > 1.3;
  const zx0 = narrow ? 230 : 300;
  const zx1 = narrow ? 780 : 640;
  const yS = 10 + 15 * f; // overkanten av den forstørrede regnbuen
  const hS = 20 * s;
  const yB = yS + hS + 30 * s; // overkanten av spekteret
  const hB = 14 + 2 * 0.82 * fs * 1.1 + 22 * s;
  const rowH = 14 + 22 * f;
  const rows = [0, 1, 2].map((i) => yB + hB + 4 + i * rowH);
  const yI = rows[2]! + rowH * 0.9; // klammene for ioniserende stråling
  const H = Math.round(yI + 12 + 14 * f);
  return { fs, narrow, zx0, zx1, yS, hS, yB, hB, rowH, rows, yI, H };
}

export interface BandProps {
  lambda: number;
  f: number;
  s: number;
  onLambda: (lambda: number) => void;
  onExample: (id: ExampleId) => void;
}

export function SpektrumBand({ lambda, f, s, onLambda, onExample }: BandProps) {
  const L = bandLayout(f, s);
  const ss = useStrokeScale();
  const id = useSvgId('em-band');
  const { fs, narrow, zx0, zx1, yS, hS, yB, hB, rows, yI, H } = L;
  const xm = xOf(lambda);
  const nm = lambda * 1e9;
  const visible = lambda >= VISIBLE_MIN && lambda <= VISIBLE_MAX;
  const near = nearestExample(lambda);
  const reg = regionOf(lambda);
  const markColor = visible ? bolgelengdeFarge(nm, false) : waveColor(reg.id, nm);

  // Den skjematiske bølgen: én sti per område (egen farge)
  const yW = yB + hB - 8 - 11 * s;
  const amp = 7.5 * s;
  const waves = useMemo(() => {
    const w = X1 - X0;
    const lMax = 150;
    const lMin = 5;
    return REGIONS.filter((r) => r.id !== 'synlig').map((r) => {
      const xa = xOf(r.fra);
      const xb = xOf(r.til);
      let d = '';
      let x = xa;
      while (x <= xb + 1e-6) {
        const u = x - X0;
        const y = yW - amp * Math.sin(chirpPhase(u, w, lMax, lMin));
        d += `${d ? 'L' : 'M'}${r1(x)},${r1(y)}`;
        const L = lMax * (lMin / lMax) ** (u / w);
        x += Math.max(0.35, L / 14);
      }
      return { id: r.id, d };
    });
  }, [yW, amp]);

  const pick = (e: PointerEvent<SVGRectElement>, zoom: boolean) => {
    const svg = e.currentTarget.ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    if (zoom) {
      // Samme retning som spekteret: rødt (750 nm) til venstre, fiolett (380 nm) til høyre
      const t = Math.min(1, Math.max(0, (p.x - zx0) / (zx1 - zx0)));
      onLambda((750 - t * 370) * 1e-9);
    } else {
      onLambda(lambdaAtPos((p.x - X0) / (X1 - X0)));
    }
  };
  const dragHandlers = (zoom: boolean) => ({
    onPointerDown: (e: PointerEvent<SVGRectElement>) => {
      pick(e, zoom);
      if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<SVGRectElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e, zoom);
    },
  });

  // Aksene: λ, f og E. Verdien ved markøren står i et skilt; tall som kolliderer med skiltet skjules.
  const tickFs = 0.78 * fs;
  const axes: { sym: string; ticks: Tick[]; label: (k: number) => string; value: string }[] = [
    { sym: 'λ', ticks: lambdaTicks(), label: fmtLambdaTick, value: fmtLambda(lambda) },
    { sym: 'f', ticks: freqTicks(), label: (k) => fmtPow(k, 'Hz'), value: fmtFreq(frequency(lambda)) },
    { sym: 'E', ticks: energyTicks(), label: (k) => fmtPow(k, 'eV'), value: fmtEv(energyEv(lambda)) },
  ];

  const xv0 = xOf(VISIBLE_MAX);
  const xv1 = xOf(VISIBLE_MIN);
  const xIon = xOf(LAMBDA_ION);
  const zoomX = (n: number) => zx0 + ((750 - n) / 370) * (zx1 - zx0);
  const zoomTicks = narrow ? [700, 550, 400] : [700, 650, 600, 550, 500, 450, 400];

  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      label="Det elektromagnetiske spekteret fra radiobølger til gammastråling på en logaritmisk skala, med akser for bølgelengde, frekvens og fotonenergi. Dra markøren langs spekteret."
    >
      <LinearGradient id={`${id}-bg`} stops={[[0, alpha(VIZ.muted, 0.05)], [1, alpha(VIZ.muted, 0.14)]]} />

      {/* Synlig lys, forstørret */}
      <Txt x={zx0 - 12} y={yS + hS / 2 + 0.3 * fs} anchor="end" weight={650} size={0.9}>
        Synlig lys
      </Txt>
      {zoomTicks.map((n) => (
        <g key={n}>
          <line x1={zoomX(n)} x2={zoomX(n)} y1={yS - 4 * ss} y2={yS} stroke={VIZ.muted} strokeWidth={1.2 * ss} />
          <Txt x={zoomX(n)} y={yS - 6 * ss} size={0.72} muted>
            {n === 400 ? '400 nm' : String(n)}
          </Txt>
        </g>
      ))}
      <g transform={`translate(${zx0 + zx1} 0) scale(-1 1)`}>
        <Spektrum x={zx0} y={yS} w={zx1 - zx0} h={hS} />
      </g>
      <path
        d={`M${zx0},${yS + hS}L${xv0},${yB}M${zx1},${yS + hS}L${xv1},${yB}`}
        stroke={VIZ.muted}
        strokeWidth={1.1 * ss}
        strokeDasharray={`${4 * ss} ${3 * ss}`}
        fill="none"
      />
      <path d={`M${zx0},${yS + hS}L${xv0},${yB}L${xv1},${yB}L${zx1},${yS + hS}Z`} fill={alpha(VIZ.muted, 0.08)} />
      <rect x={zx0 - 6} y={yS - 6} width={zx1 - zx0 + 12} height={hS + 12} fill="transparent" style={{ cursor: 'ew-resize', touchAction: 'pan-y' }} aria-hidden {...dragHandlers(true)} />
      {visible && (
        <g pointerEvents="none">
          <line x1={zoomX(nm)} x2={zoomX(nm)} y1={yS - 2} y2={yS + hS + 2} stroke={VIZ.surface} strokeWidth={5 * ss} />
          <line x1={zoomX(nm)} x2={zoomX(nm)} y1={yS - 2} y2={yS + hS + 2} stroke={VIZ.ink} strokeWidth={2.2 * ss} />
        </g>
      )}

      {/* Spekteret: områdene, skillelinjene og bølgen */}
      <rect x={X0} y={yB} width={X1 - X0} height={hB} rx={6 * ss} fill={`url(#${id}-bg)`} stroke={SCENE.outline} strokeWidth={1.1 * ss} />
      {REGIONS.map((r, i) => {
        const xa = xOf(r.fra);
        const xb = xOf(r.til);
        const lines = regionLines(r.id, narrow);
        const lfs = 0.82 * fs;
        const top = yB + 8 + (lines.length === 1 ? 0.55 * lfs : 0) + 0.85 * lfs;
        return (
          <g key={r.id}>
            {i % 2 === 1 && r.id !== 'synlig' && <rect x={xa} y={yB + 0.5} width={xb - xa} height={hB - 1} fill={alpha(VIZ.muted, 0.07)} />}
            {i > 0 && <line x1={xa} x2={xa} y1={yB} y2={yB + hB} stroke={alpha(VIZ.muted, 0.55)} strokeWidth={1 * ss} />}
            {lines.map((t, j) => (
              <Txt key={t} x={(xa + xb) / 2} y={top + j * lfs * 1.08} size={0.82} weight={620} color={reg.id === r.id ? VIZ.ink : undefined} muted={reg.id !== r.id}>
                {t}
              </Txt>
            ))}
          </g>
        );
      })}
      <g transform={`translate(${xv0 + xv1} 0) scale(-1 1)`}>
        <Spektrum x={xv0} y={yB + 1} w={xv1 - xv0} h={hB - 2} />
      </g>
      {waves.map((w) => (
        <path key={w.id} d={w.d} fill="none" stroke={waveColor(w.id, 0)} strokeWidth={1.7 * ss} strokeLinejoin="round" opacity={reg.id === w.id ? 1 : 0.6} />
      ))}

      {/* Eksemplene fra hverdagen */}
      {EXAMPLES.map((e) => {
        const x = xOf(e.lambda);
        const on = e.id === near.id;
        return (
          <g key={e.id} style={{ cursor: 'pointer' }} onClick={() => onExample(e.id)} aria-hidden>
            <circle cx={x} cy={yB} r={11 * s} fill="transparent" />
            <circle cx={x} cy={yB} r={(on ? 5.5 : 4.2) * s} fill={on ? VIZ.ink : VIZ.surface} stroke={on ? VIZ.surface : VIZ.ink} strokeWidth={(on ? 2 : 1.5) * ss} />
          </g>
        );
      })}

      {/* Markørstreken (under skiltene på aksene) */}
      <g pointerEvents="none">
        <line x1={xm} x2={xm} y1={yW} y2={rows[2]! + 2} stroke={VIZ.surface} strokeWidth={5.5 * ss} strokeLinecap="round" />
        <line x1={xm} x2={xm} y1={yW} y2={rows[2]! + 2} stroke={VIZ.ink} strokeWidth={2.2 * ss} strokeLinecap="round" />
      </g>

      {/* Aksene under spekteret */}
      {axes.map((a, i) => {
        const y = rows[i]!;
        const valW = textW(a.value, tickFs) + 16 * f;
        const vx = Math.min(X1 - valW / 2, Math.max(X0 + valW / 2, xm));
        const labelY = y + 6 * ss + 0.8 * tickFs;
        return (
          <g key={a.sym}>
            <Txt x={22} y={y + 0.5 * fs} size={1} weight={700} anchor="middle">
              <tspan fontStyle="italic">{a.sym}</tspan>
            </Txt>
            <line x1={X0} x2={X1} y1={y} y2={y} stroke={VIZ.muted} strokeWidth={1 * ss} />
            {a.ticks.map((t) => {
              const x = xAt(t.p);
              const txt = a.label(t.k);
              const tw = textW(txt, tickFs);
              const hide = !t.major || Math.abs(x - vx) < (tw + valW) / 2 + 6 || x - tw / 2 < 30 + 8 * (f - 1) || x + tw / 2 > 800;
              return (
                <g key={t.k}>
                  <line x1={x} x2={x} y1={y} y2={y + (t.major ? 6 : 3.5) * ss} stroke={VIZ.muted} strokeWidth={(t.major ? 1.3 : 1) * ss} />
                  {!hide && (
                    <Txt x={x} y={labelY} size={0.78} muted>
                      {txt}
                    </Txt>
                  )}
                </g>
              );
            })}
            <rect x={vx - valW / 2} y={labelY - 0.95 * tickFs} width={valW} height={1.3 * tickFs} rx={0.4 * tickFs} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.3 * ss} />
            <Txt x={vx} y={labelY} size={0.78} weight={720} halo={false}>
              {a.value}
            </Txt>
          </g>
        );
      })}

      {/* Ioniserende eller ikke */}
      {[
        { a: X0, b: xIon - 3, t: 'Ikke ioniserende', c: VIZ.muted },
        { a: xIon + 3, b: X1, t: narrow ? 'Ioniserende' : 'Ioniserende stråling (E > 10 eV)', c: VIZ.ink },
      ].map((k) => (
        <g key={k.t}>
          <path d={`M${k.a},${yI - 7 * ss}V${yI}H${k.b}V${yI - 7 * ss}`} fill="none" stroke={k.c} strokeWidth={1.3 * ss} />
          <Txt x={(k.a + k.b) / 2} y={yI + 6 + 0.75 * fs} size={0.8} weight={k.c === VIZ.ink ? 680 : 560} muted={k.c !== VIZ.ink}>
            {k.t}
          </Txt>
        </g>
      ))}

      {/* Klikk- og dra-flate over spekteret og aksene */}
      <rect
        x={X0 - 10}
        y={yB + 8 * s}
        width={X1 - X0 + 20}
        height={rows[2]! - yB}
        fill="transparent"
        style={{ cursor: 'ew-resize', touchAction: 'pan-y' }}
        aria-hidden
        {...dragHandlers(false)}
      />

      {/* Markøren */}
      <g pointerEvents="none">
        <circle cx={xm} cy={yW} r={8.5 * s} fill={markColor} stroke={VIZ.ink} strokeWidth={2.2 * ss} />
        <circle cx={xm} cy={yW} r={8.5 * s + 2.5 * ss} fill="none" stroke={VIZ.surface} strokeWidth={1.6 * ss} />
      </g>
    </Figure>
  );
}
