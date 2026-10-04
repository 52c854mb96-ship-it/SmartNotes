import { useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Legend,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toolbar,
  VIZ,
  VizLayout,
  clamp,
  fmt,
  fmtSci,
  scaleLinear,
  useTextScale,
} from '../kit';
import { fmtPow10, fmtSig, fmtYears, yearsParts } from './format';
import {
  M_SUPERNOVA,
  MAIN_SEQUENCE,
  STARS,
  SUN_T,
  UNIVERSE_AGE,
  WD_RADIUS,
  luminosityFromRT,
  msLifetime,
  msLuminosity,
  msRadius,
  msTemperature,
  radiusFromLT,
  starColor,
  wienPeak,
  type Star,
  type StarClass,
} from './model';
import { Select, Tag, textWidth, useNarrow } from './parts';

type Mode = 'stjerner' | 'masse';
const MODES: { value: Mode; label: string }[] = [
  { value: 'stjerner', label: 'Kjente stjerner' },
  { value: 'masse', label: 'Lag en hovedseriestjerne' },
];

/** Aksene: log T fra ca. 45 000 K (venstre) til 2 400 K (høyre), log L fra 10⁻⁴·⁵ til 10⁶·³. */
const LOGT_HOT = Math.log10(45000);
const LOGT_COLD = Math.log10(2400);
const LOGL_MIN = -4.5;
const LOGL_MAX = 6.3;
/** Massebryteren går i log M (solmasser): 10^−0,7 ≈ 0,2 til 10^1,4 ≈ 25. */
const LOGM_MIN = -0.7;
const LOGM_MAX = 1.4;

const CLASS_NAME: Record<StarClass, string> = {
  hovedserie: 'Hovedseriestjerne',
  kjempe: 'Kjempe',
  superkjempe: 'Superkjempe',
  'hvit-dverg': 'Hvit dverg',
};

const REGION = {
  ms: VIZ.series[0],
  giant: VIZ.series[1],
  supergiant: VIZ.series[4],
  wd: VIZ.series[3],
};

export default function HrDiagram() {
  const [mode, setMode] = useState<Mode>('stjerner');
  const [starId, setStarId] = useState('sola');
  const [logM, setLogM] = useState(0.3);
  const star = STARS.find((s) => s.id === starId) ?? STARS[0]!;
  const M = 10 ** logM;
  const [wrapRef, narrow] = useNarrow<HTMLDivElement>();
  const H = narrow ? 760 : 520;

  const pick = (id: string) => {
    setStarId(id);
    setMode('stjerner');
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg visning" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'stjerner' ? (
        <Toolbar>
          <Select
            label="Stjerne"
            value={star.id}
            options={[...STARS].sort((a, b) => a.name.localeCompare(b.name, 'nb')).map((s) => ({ value: s.id, label: s.name }))}
            onChange={setStarId}
          />
        </Toolbar>
      ) : (
        <Controls>
          <Slider
            label="Masse M"
            value={logM}
            onChange={setLogM}
            min={LOGM_MIN}
            max={LOGM_MAX}
            step={0.01}
            format={(v) => `${fmtSig(10 ** v, 2)} M☉`}
            ariaLabel="Masse i solmasser"
          />
        </Controls>
      )}

      <div ref={wrapRef}>
        <Figure
          viewBox={`0 0 800 ${H}`}
          label={
            mode === 'stjerner'
              ? `HR-diagram med ${STARS.length} kjente stjerner. Valgt: ${star.name}, ${fmt(star.T, 0)} K og ${fmtSig(star.L)} solluminositeter.`
              : `HR-diagram med en hovedseriestjerne på ${fmtSig(M, 2)} solmasser.`
          }
          maxHeight={600}
        >
          <Diagram H={H} mode={mode} star={star} M={M} narrow={narrow} onPick={pick} />
        </Figure>
      </div>
      <Legend
        items={[
          { color: REGION.ms, label: 'Hovedserien' },
          { color: REGION.giant, label: 'Kjemper' },
          { color: REGION.supergiant, label: 'Superkjemper' },
          { color: REGION.wd, label: 'Hvite dverger' },
          { color: VIZ.muted, label: 'Lik radius', dashed: true },
        ]}
      />

      {mode === 'stjerner' ? <StarReadouts star={star} /> : <MassReadouts M={M} />}
      <Explain>{mode === 'stjerner' ? starExplanation(star) : massExplanation(M)}</Explain>
    </VizLayout>
  );
}

function StarReadouts({ star }: { star: Star }) {
  const R = radiusFromLT(star.L, star.T);
  return (
    <>
      <Readouts>
        <Readout label="Temperatur T" value={fmt(star.T, 0)} unit="K" />
        <Readout label="Luminositet L" value={fmtSig(star.L, 2)} unit="L☉" />
        <Readout label="Radius R" value={fmtSig(R, 2)} unit="R☉" />
        <Readout
          label={
            <>
              Toppen i spekteret λ<Sub>maks</Sub>
            </>
          }
          value={fmt(wienPeak(star.T) * 1e9, 0)}
          unit="nm"
        />
      </Readouts>
      <Formula label="Radius og bølgelengde fra strålingslovene">
        <FormulaLine>
          L = 4πR²σT⁴ gir R/R☉ = √(L/L☉) · (T☉/T)² = √{fmtSig(star.L, 2)} · ({fmt(SUN_T, 0)} K / {fmt(star.T, 0)} K)² = {fmtSig(R, 2)}
        </FormulaLine>
        <FormulaLine>
          λ<Sub>maks</Sub> = b/T = 2,90 · 10⁻³ m·K / {fmt(star.T, 0)} K = {fmt(wienPeak(star.T) * 1e9, 0)} nm
        </FormulaLine>
      </Formula>
    </>
  );
}

function MassReadouts({ M }: { M: number }) {
  const L = msLuminosity(M);
  const T = msTemperature(M);
  const t = msLifetime(M);
  return (
    <>
      <Readouts>
        <Readout label="Luminositet L" value={fmtSig(L, 2)} unit="L☉" />
        <Readout label="Temperatur T" value={fmt(Math.round(T / 10) * 10, 0)} unit="K" />
        <Readout label="Radius R" value={fmtSig(msRadius(M), 2)} unit="R☉" />
        <Readout label="Levetid på hovedserien" value={yearsParts(t).value} unit={yearsParts(t).unit} />
      </Readouts>
      <Formula label="Luminositet og levetid for en hovedseriestjerne">
        <FormulaLine>
          L/L☉ = (M/M☉)<sup>3,5</sup> = {fmtSig(M, 2)}<sup>3,5</sup> = {fmtSig(L, 2)}
        </FormulaLine>
        <FormulaLine>
          t ≈ 10¹⁰ år · (M/M☉)<sup>−2,5</sup> = 10¹⁰ år · {fmtSig(M, 2)}<sup>−2,5</sup> = {fmtSci(t, 1)} år
        </FormulaLine>
      </Formula>
    </>
  );
}

function Diagram({
  H,
  mode,
  star,
  M,
  narrow,
  onPick,
}: {
  H: number;
  mode: Mode;
  star: Star;
  M: number;
  narrow: boolean;
  onPick: (id: string) => void;
}) {
  const f = useTextScale();
  const clipId = useId();
  const m = { top: 40 * f, right: 16, bottom: 56 * f, left: 74 * f };
  const x0 = m.left;
  const x1 = 800 - m.right;
  const y0 = H - m.bottom;
  const y1 = m.top;
  const sx = scaleLinear([LOGT_HOT, LOGT_COLD], [x0, x1]);
  const sy = scaleLinear([LOGL_MIN, LOGL_MAX], [y0, y1]);
  const P = (T: number, L: number) => [sx(Math.log10(T)), sy(Math.log10(L))] as const;
  const path = (pts: (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const dim = mode === 'masse' ? 0.45 : 1;

  // Lik radius: L = R²(T/T☉)⁴ er rette linjer i et log–log-diagram.
  const radiusLine = (R: number) => path([P(45000, luminosityFromRT(R, 45000)), P(2400, luminosityFromRT(R, 2400))]);
  const msPath = path(MAIN_SEQUENCE.map(([T, l]) => P(T, 10 ** l)));
  const wdPath = path([P(32000, luminosityFromRT(WD_RADIUS, 32000)), P(5200, luminosityFromRT(WD_RADIUS, 5200))]);

  const xTicks = [40000, 20000, 10000, 5000, 3000];
  const yTicks = [-4, -2, 0, 2, 4, 6];
  const classes: [string, number, number][] = [
    ['O', 45000, 30000],
    ['B', 30000, 10000],
    ['A', 10000, 7500],
    ['F', 7500, 6000],
    ['G', 6000, 5200],
    ['K', 5200, 3700],
    ['M', 3700, 2400],
  ];

  const tagged = STARS.filter((s) => s.id === star.id || (!narrow && mode === 'stjerner' && s.tag));
  const msStar = { T: msTemperature(M), L: msLuminosity(M) };
  const [mx, my] = P(msStar.T, msStar.L);
  const massTicks = [0.5, 1, 2, 5, 10, 20];
  // Etiketten «Hovedserien» flyttes ned når hjelpelinjen fra den valgte stjernen ville gått gjennom den.
  const msLabelLogL = mode === 'masse' && Math.abs(Math.log10(msStar.L) - 1.2) < 0.4 ? 0.2 : 1.0;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
        </clipPath>
      </defs>

      {/* Rutenett og akser */}
      {Array.from({ length: 11 }, (_, i) => -4 + i).map((l) => (
        <line key={`gl${l}`} x1={x0} x2={x1} y1={sy(l)} y2={sy(l)} className="viz-gridline" />
      ))}
      {xTicks.map((T) => (
        <line key={`gt${T}`} x1={sx(Math.log10(T))} x2={sx(Math.log10(T))} y1={y0} y2={y1} className="viz-gridline" />
      ))}
      <line x1={x0} x2={x1} y1={y0} y2={y0} className="viz-axis" />
      <line x1={x0} x2={x0} y1={y0} y2={y1} className="viz-axis" />
      {xTicks.map((T) => (
        <text key={`xt${T}`} x={sx(Math.log10(T))} y={y0 + 22 * f} textAnchor="middle" className="viz-tick">
          {fmt(T, 0)}
        </text>
      ))}
      {yTicks.map((l) => (
        <text key={`yt${l}`} x={x0 - 10} y={sy(l) + 5 * f} textAnchor="end" className="viz-tick">
          {fmtPow10(l)}
        </text>
      ))}
      <text x={(x0 + x1) / 2} y={H - 10} textAnchor="middle" className="viz-axis-label">
        {narrow ? 'Overflatetemperatur T (K)' : 'Overflatetemperatur T (K) – varmest til venstre'}
      </text>
      <text x={18 * f} y={(y0 + y1) / 2} textAnchor="middle" className="viz-axis-label" transform={`rotate(-90 ${18 * f} ${(y0 + y1) / 2})`}>
        Luminositet L (L☉)
      </text>
      {classes.map(([c, hot, cold]) => (
        <text key={c} x={(sx(Math.log10(hot)) + sx(Math.log10(cold))) / 2} y={y1 - 12 * f} textAnchor="middle" className="viz-tick">
          {c}
        </text>
      ))}

      <g clipPath={`url(#${clipId})`}>
        {/* Områdene */}
        <path d={msPath} fill="none" stroke={REGION.ms} strokeOpacity={0.16} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
        <ellipse cx={sx(Math.log10(4400))} cy={sy(2.0)} rx={sx(Math.log10(3500)) - sx(Math.log10(4400))} ry={sy(1) - sy(2.0) + 6} fill={REGION.giant} fillOpacity={0.14} />
        <rect
          x={sx(Math.log10(13500))}
          y={sy(6.15)}
          width={sx(Math.log10(3250)) - sx(Math.log10(13500))}
          height={sy(2.95) - sy(6.15)}
          rx={30}
          fill={REGION.supergiant}
          fillOpacity={0.12}
        />
        <path d={wdPath} fill="none" stroke={REGION.wd} strokeOpacity={0.16} strokeWidth={40} strokeLinecap="round" />

        {/* Linjer med lik radius */}
        {[0.01, 1, 100].map((R) => (
          <path key={R} d={radiusLine(R)} className="viz-guide" strokeOpacity={0.55} />
        ))}
      </g>
      {mode === 'stjerner' && (
        <g>
          <RadiusTag R={1} sx={sx} sy={sy} logT={4.6} />
          <RadiusTag R={100} sx={sx} sy={sy} logT={3.43} anchor="end" />
          <RadiusTag R={0.01} sx={sx} sy={sy} logT={4.64} anchor="start" />
        </g>
      )}

      {!narrow && (
        <g>
          <Tag x={sx(Math.log10(30000))} y={sy(msLabelLogL)} color={REGION.ms} anchor="middle" weight={650}>
            Hovedserien
          </Tag>
          <Tag x={sx(Math.log10(3500)) - 4} y={sy(0.55)} color={REGION.giant} anchor="end" weight={650}>
            Kjemper
          </Tag>
          <Tag x={sx(Math.log10(6300))} y={sy(5.95)} color={REGION.supergiant} anchor="middle" weight={650}>
            Superkjemper
          </Tag>
          <Tag x={sx(Math.log10(26000))} y={sy(-2.7)} color={REGION.wd} anchor="start" weight={650}>
            Hvite dverger
          </Tag>
        </g>
      )}

      {/* Massemerker langs hovedserien */}
      {mode === 'masse' &&
        massTicks
          // Merker nær den valgte massen skjules, så etikettene ikke kolliderer.
          .filter((mm) => Math.abs(Math.log10(mm / M)) > 0.2)
          .map((mm) => {
          const [x, y] = P(msTemperature(mm), msLuminosity(mm));
          const text = `${fmt(mm, mm < 1 ? 1 : 0)} M☉`;
          // Merket står under til venstre for hovedserien, eller over til høyre når det ikke er plass.
          const below = x - 22 - textWidth(text.length, f) * 0.8 > x0 + 6;
          return (
            <g key={mm}>
              <line x1={x} y1={y} x2={below ? x - 18 : x + 18} y2={below ? y + 22 : y - 22} stroke={VIZ.muted} strokeWidth={1.2} />
              <text x={below ? x - 20 : x + 20} y={below ? y + 22 + 12 * f : y - 26} textAnchor={below ? 'end' : 'start'} className="viz-tick">
                {text}
              </text>
            </g>
          );
        })}

      {/* Stjernene */}
      <g opacity={dim}>
        {STARS.map((s) => {
          const [x, y] = P(s.T, s.L);
          const R = radiusFromLT(s.L, s.T);
          const r = clamp(4.5 + 1.6 * (Math.log10(R) + 2), 4.5, 13);
          const selected = mode === 'stjerner' && s.id === star.id;
          return (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={s.name}
              style={{ cursor: 'pointer' }}
              onClick={() => onPick(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(s.id);
                }
              }}
            >
              <circle cx={x} cy={y} r={Math.max(r, 12)} fill="transparent" />
              <circle cx={x} cy={y} r={r} fill={starColor(s.T)} stroke={VIZ.ink} strokeOpacity={0.45} strokeWidth={1.2} />
              {selected && <circle cx={x} cy={y} r={r + 6} fill="none" stroke={VIZ.ink} strokeWidth={2.5} />}
            </g>
          );
        })}
      </g>
      {mode === 'stjerner' &&
        tagged.map((s) => {
          const [x, y] = P(s.T, s.L);
          const R = radiusFromLT(s.L, s.T);
          const r = clamp(4.5 + 1.6 * (Math.log10(R) + 2), 4.5, 13) + 8;
          const w = textWidth(s.name.length, f);
          const selected = s.id === star.id;
          // Navnet til høyre, med mindre det går ut av figuren (eller stjernen ber om noe annet).
          let side = s.tag ?? 'right';
          if (selected && !s.tag) side = x + r + w > x1 ? 'left' : 'right';
          if (side === 'right' && x + r + w > 800) side = 'left';
          if (side === 'left' && x - r - w < x0) side = 'right';
          const pos =
            side === 'right'
              ? { x: x + r, y: y + 6 * f, anchor: 'start' as const }
              : side === 'left'
                ? { x: x - r, y: y + 6 * f, anchor: 'end' as const }
                : side === 'above'
                  ? { x, y: y - r - 2, anchor: 'middle' as const }
                  : { x, y: y + r + 14 * f, anchor: 'middle' as const };
          return (
            <Tag key={s.id} x={pos.x} y={pos.y} anchor={pos.anchor} weight={selected ? 750 : 600} muted={!selected}>
              {s.name}
            </Tag>
          );
        })}

      {/* Stjerne laget med massebryteren */}
      {mode === 'masse' && (
        <g>
          <line x1={x0} x2={mx} y1={my} y2={my} className="viz-guide" />
          <line x1={mx} x2={mx} y1={my} y2={y0} className="viz-guide" />
          <circle cx={mx} cy={my} r={clamp(7 + 2 * Math.log10(M) * 2, 6, 14)} fill={starColor(msStar.T)} stroke={VIZ.ink} strokeWidth={2.5} />
          {mx + 22 + textWidth(7, f) < x1 ? (
            <Tag x={mx + 22} y={my - 12} anchor="start" weight={700}>
              {fmtSig(M, 2)} M☉
            </Tag>
          ) : (
            // Ingen plass til høyre: under til venstre, der massemerkene langs hovedserien ikke står.
            <Tag x={mx - 16} y={my + 20 + 14 * f} anchor="end" weight={700}>
              {fmtSig(M, 2)} M☉
            </Tag>
          )}
        </g>
      )}
    </g>
  );
}

/** Etikett langs en linje med lik radius (L = R²(T/T☉)⁴), plassert ved log T = `logT`. */
function RadiusTag({
  R,
  sx,
  sy,
  logT,
  anchor = 'middle',
}: {
  R: number;
  sx: (v: number) => number;
  sy: (v: number) => number;
  logT: number;
  anchor?: 'start' | 'middle' | 'end';
}) {
  const f = useTextScale();
  const logL = 2 * Math.log10(R) + 4 * (logT - Math.log10(SUN_T));
  const x = sx(logT);
  const y = sy(logL);
  // Retningen mot kaldere stjerner (mot høyre og nedover i figuren).
  const angle = (Math.atan2(sy(logL - 0.4) - y, sx(logT - 0.1) - x) * 180) / Math.PI;
  return (
    <text x={x} y={y} transform={`rotate(${angle} ${x} ${y}) translate(0 ${-6 * f})`} textAnchor={anchor} className="viz-tick">
      {R === 1 ? '1 R☉' : R === 100 ? '100 R☉' : '0,01 R☉'}
    </text>
  );
}

function starExplanation(star: Star): ReactNode {
  const R = radiusFromLT(star.L, star.T);
  let type: ReactNode;
  switch (star.cls) {
    case 'hovedserie':
      type = (
        <>
          Den fusjonerer hydrogen til helium i kjernen{star.id === 'sola' ? '' : ', slik sola gjør'}. Hvor på hovedserien en stjerne ligger, bestemmes av massen:
          tyngre stjerner er både varmere og mye lyssterkere.
        </>
      );
      break;
    case 'kjempe':
      type = (
        <>
          Hydrogenet i kjernen er brukt opp, og stjerna har svellet opp til ca. {fmtSig(R, 2)} ganger solas radius. Overflaten er
          kaldere enn sola, men den enorme overflaten gjør at den likevel lyser {fmtSig(star.L, 2)} ganger så sterkt.
        </>
      );
      break;
    case 'superkjempe':
      type = (
        <>
          En stor og tung stjerne som har brukt opp hydrogenet i kjernen, med ca. {fmtSig(R, 2)} ganger så stor radius som sola.
          Superkjemper over ca. 8 M☉ ender som supernova og etterlater en nøytronstjerne eller et svart hull.
        </>
      );
      break;
    case 'hvit-dverg':
      type = (
        <>
          Den er den utbrente kjernen etter en stjerne på under ca. 8 M☉. Overflaten er{' '}
          {star.T > SUN_T ? 'varmere enn' : 'omtrent like varm som'} solas, men radiusen er bare {fmtSig(R, 2)} R☉, omtrent som jorda,
          så den lyser svakt. Det er ingen fusjon der, så den avkjøles langsomt.
        </>
      );
      break;
  }
  return (
    <p>
      <strong>
        {star.name} er en {CLASS_NAME[star.cls].toLocaleLowerCase('nb')}.
      </strong>{' '}
      {star.fact} {type} Husk at temperaturen øker mot <em>venstre</em> i et HR-diagram.
    </p>
  );
}

function massExplanation(M: number): ReactNode {
  const L = msLuminosity(M);
  const t = msLifetime(M);
  const heavy = M > 1.05;
  const light = M < 0.95;
  return (
    <p>
      <strong>
        {fmtSig(M, 2)} solmasser gir L = {fmtSig(L, 2)} L☉.
      </strong>{' '}
      {heavy
        ? `Stjerna har ${fmtSig(M, 2)} ganger så mye hydrogen som sola, men bruker det ${fmtSig(L, 2)} ganger så fort. `
        : light
          ? `Stjerna har bare ${fmtSig(M, 2)} ganger så mye hydrogen som sola, men bruker det ${fmtSig(1 / L, 2)} ganger så sakte. `
          : 'Dette er sola. '}
      Levetiden er drivstoff delt på forbruk, t ∝ M/L = M<sup>−2,5</sup>, så den blir {fmtYears(t)}.{' '}
      {t > UNIVERSE_AGE
        ? 'Det er lenger enn universets alder (13,8 milliarder år), så ingen så lette stjerner har rukket å forlate hovedserien ennå.'
        : M >= M_SUPERNOVA
          ? 'Så tunge stjerner lever kort og ender som supernova.'
          : 'Når hydrogenet i kjernen er brukt opp, sveller den opp til en rød kjempe.'}
    </p>
  );
}

