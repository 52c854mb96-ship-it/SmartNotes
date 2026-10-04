import { useId, useState, type ReactNode } from 'react';
import {
  Arrow,
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
  fmt,
  fmtSci,
  useTextScale,
} from '../kit';
import {
  colorName,
  levelEnergyEV,
  levelEnergyJ,
  REGION_NAMES,
  seriesName,
  sigDecimals,
  spectralRegion,
  transitionPhoton,
  VISIBLE_MAX,
  VISIBLE_MIN,
  wavelengthColor,
  wavelengthToRgb,
} from './model';
import { PhotonWave, Txt } from './parts';
import { useNarrow } from './useNarrow';

type Mode = 'emisjon' | 'absorpsjon';

const MODES: { value: Mode; label: string }[] = [
  { value: 'emisjon', label: 'Emisjon: elektronet faller ned' },
  { value: 'absorpsjon', label: 'Absorpsjon: elektronet løftes opp' },
];

/** Høyeste nivå i figuren. */
const N_TOP = 6;
/** Farge for hver serie (nederste nivå 1–5). */
const SERIES_COLOR = [VIZ.series[3]!, VIZ.series[0]!, VIZ.series[1]!, VIZ.series[2]!, VIZ.series[4]!];
const seriesColor = (nLower: number) => SERIES_COLOR[nLower - 1] ?? VIZ.ink;

export default function BohrHydrogen() {
  const [mode, setMode] = useState<Mode>('emisjon');
  const [upper, setUpper] = useState(3);
  const [lower, setLower] = useState(2);
  const [ref, narrow] = useNarrow<HTMLDivElement>();

  // Nederste nivå er alltid under øverste: den som flyttes, dytter den andre.
  const changeUpper = (n: number) => {
    setUpper(n);
    if (lower >= n) setLower(n - 1);
  };
  const changeLower = (n: number) => {
    setLower(n);
    if (upper <= n) setUpper(n + 1);
  };

  const p = transitionPhoton(upper, lower);
  const nm = p.lambda * 1e9;
  const region = spectralRegion(nm);
  const [from, to] = mode === 'emisjon' ? [upper, lower] : [lower, upper];
  const levelsH = narrow ? 900 : 440;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg emisjon eller absorpsjon" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      <Controls>
        <Slider label="Øverste nivå" value={upper} onChange={changeUpper} min={2} max={N_TOP} step={1} format={(v) => `n = ${v}`} />
        <Slider label="Nederste nivå" value={lower} onChange={changeLower} min={1} max={N_TOP - 1} step={1} format={(v) => `n = ${v}`} />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${levelsH}`}
          label={`Energinivåene i hydrogen. ${mode === 'emisjon' ? 'Emisjon' : 'Absorpsjon'}: elektronet går fra n = ${from} til n = ${to}, og fotonet har bølgelengde ${fmt(nm, 0)} nm.`}
          maxHeight={narrow ? 900 : 440}
        >
          <LevelDiagram upper={upper} lower={lower} mode={mode} narrow={narrow} height={levelsH} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${narrow ? 430 : 270}`}
        label={`Bølgelengdene til alle overgangene opp til n = 6 på en logaritmisk akse. Det valgte fotonet har ${fmt(nm, 0)} nm (${REGION_NAMES[region]}).`}
      >
        <WavelengthAxis upper={upper} lower={lower} height={narrow ? 430 : 270} />
      </Figure>
      <Legend items={[1, 2, 3, 4, 5].map((n) => ({ color: seriesColor(n), label: `${seriesName(n)} (ned til n = ${n})` }))} />

      <Readouts>
        <Readout label="Fotonenergi" value={fmt(p.eV, sigDecimals(p.eV))} unit="eV" />
        <Readout label="Fotonenergi i joule" value={fmtSci(p.E, 2)} unit="J" />
        <Readout label="Frekvens f" value={fmtSci(p.f, 2)} unit="Hz" />
        <Readout label="Bølgelengde λ" value={fmt(nm, 0)} unit="nm" />
      </Readouts>

      <Formula label="Fotonenergi, frekvens og bølgelengde">
        <FormulaLine>
          E<Sub>n</Sub> = −2,18 · 10⁻¹⁸ J / n²
        </FormulaLine>
        <FormulaLine>
          E<Sub>foton</Sub> = E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> = ({fmtSci(levelEnergyJ(upper), 2)} J) − (
          {fmtSci(levelEnergyJ(lower), 2)} J)
        </FormulaLine>
        <FormulaLine>
          E<Sub>foton</Sub> = {fmtSci(p.E, 2)} J = {fmt(p.eV, sigDecimals(p.eV))} eV
        </FormulaLine>
        <FormulaLine>
          f = E/h = {fmtSci(p.E, 2)} J / 6,63 · 10⁻³⁴ J·s = {fmtSci(p.f, 2)} Hz
        </FormulaLine>
        <FormulaLine>
          λ = c/f = 3,00 · 10⁸ m/s / {fmtSci(p.f, 2)} Hz = {fmt(nm, 0)} nm
        </FormulaLine>
      </Formula>

      <Explain>{explanation(mode, upper, lower, p.eV, nm)}</Explain>
    </VizLayout>
  );
}

interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  eMin: number;
  eMax: number;
  /** Nivålinjene går fra lineX0 til lineX1. */
  lineX0: number;
  lineX1: number;
}

function yOf(pn: Panel, E: number): number {
  return pn.y + pn.h - ((E - pn.eMin) / (pn.eMax - pn.eMin)) * pn.h;
}

function LevelDiagram({
  upper,
  lower,
  mode,
  narrow,
  height,
}: {
  upper: number;
  lower: number;
  mode: Mode;
  narrow: boolean;
  height: number;
}) {
  const f = useTextScale();
  const clipId = `bohr-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const head = 34 * Math.min(f, 1.5);

  const main: Panel = narrow
    ? { x: 0, y: 24, w: 800, h: 380, eMin: -14.2, eMax: 0.4, lineX0: 200, lineX1: 520 }
    : { x: 0, y: 24, w: 440, h: 392, eMin: -14.2, eMax: 0.4, lineX0: 116, lineX1: 300 };
  const zoom: Panel = narrow
    ? { x: 0, y: 470 + head, w: 800, h: height - 470 - head - 24, eMin: -1.68, eMax: 0.12, lineX0: 200, lineX1: 540 }
    : { x: 456, y: 24 + head, w: 344, h: height - 48 - head, eMin: -1.68, eMax: 0.12, lineX0: 500, lineX1: 682 };

  // Rammen rundt området som er forstørret
  const zTop = yOf(main, zoom.eMax);
  const zBot = yOf(main, zoom.eMin);

  // Overgangene i samme serie (samme nederste nivå) tegnes svakt ved siden av den valgte
  const seriesUppers: number[] = [];
  for (let n = lower + 1; n <= N_TOP; n++) seriesUppers.push(n);
  const color = seriesColor(lower);
  const nm = transitionPhoton(upper, lower).lambda * 1e9;
  const photonColor = wavelengthToRgb(nm) ? wavelengthColor(nm, color) : color;

  const arrowX = (pn: Panel, n: number) => {
    const span = pn.lineX1 - pn.lineX0;
    const count = N_TOP - lower;
    return pn.lineX0 + span * 0.14 + (n - lower - 1) * Math.min(36, (span * 0.62) / Math.max(1, count - 1));
  };

  const transitions = (pn: Panel, clip: boolean) => (
    <g clipPath={clip ? `url(#${clipId})` : undefined}>
      {seriesUppers.map((n) => {
        const selected = n === upper;
        const x = arrowX(pn, n);
        const [a, b] = mode === 'emisjon' ? [n, lower] : [lower, n];
        return (
          <Arrow
            key={n}
            x1={x}
            y1={yOf(pn, levelEnergyEV(a))}
            x2={x}
            y2={yOf(pn, levelEnergyEV(b))}
            color={color}
            width={selected ? 4 : 2}
            head={selected ? 13 : 9}
            dashed={!selected}
            minLength={4}
          />
        );
      })}
    </g>
  );

  // Fotonet tegnes der overgangen synes best: i forstørrelsen når begge nivåene er med der. Det starter til høyre for
  // den siste pilen i serien, så bølgen ikke krysser de stiplede overgangene.
  const inZoom = lower >= 3;
  const pn = inZoom ? zoom : main;
  const ax = arrowX(pn, N_TOP);
  const eTop = inZoom ? levelEnergyEV(upper) : Math.min(levelEnergyEV(upper), zoom.eMin - 0.1);
  const yPh = (yOf(pn, levelEnergyEV(lower)) + yOf(pn, eTop)) / 2;
  const phEnd = inZoom ? pn.lineX1 - 6 : pn.lineX1 + (narrow ? 170 : 110);
  const [px0, px1] = [ax + 16, Math.max(ax + 60, phEnd)];

  const levelLabel = (pnl: Panel, n: number, text: string) => {
    const y = yOf(pnl, levelEnergyEV(n));
    const on = n === upper || n === lower;
    return (
      <Txt x={pnl.lineX0 - 12} y={y + 6} anchor="end" weight={on ? 700 : 500}>
        {text}
      </Txt>
    );
  };

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={zoom.x} y={zoom.y - 8} width={zoom.w} height={zoom.h + 16} />
        </clipPath>
      </defs>

      {/* Energiakse */}
      <Arrow x1={22} y1={main.y + main.h} x2={22} y2={main.y} color={VIZ.muted} width={1.5} head={9} />
      <Txt x={36} y={main.y + 14} anchor="start" muted>
        E
      </Txt>

      {/* Hovedfiguren i riktig skala */}
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <line
          key={n}
          x1={main.lineX0}
          x2={main.lineX1}
          y1={yOf(main, levelEnergyEV(n))}
          y2={yOf(main, levelEnergyEV(n))}
          stroke={n === upper || n === lower ? VIZ.ink : VIZ.muted}
          strokeWidth={n === upper || n === lower ? 2.5 : 1.5}
        />
      ))}
      <line x1={main.lineX0} x2={main.lineX1} y1={yOf(main, 0)} y2={yOf(main, 0)} className="viz-guide" />
      {[1, 2].map((n) => (
        <g key={n}>
          {levelLabel(main, n, `n = ${n}`)}
          <Txt x={main.lineX0 - 12} y={yOf(main, levelEnergyEV(n)) + 6 + 22 * f} anchor="end" muted>
            {fmt(levelEnergyEV(n), sigDecimals(levelEnergyEV(n)))} eV
          </Txt>
        </g>
      ))}
      <rect
        x={main.lineX0 - 6}
        y={zTop}
        width={main.lineX1 - main.lineX0 + 12}
        height={zBot - zTop}
        fill="none"
        stroke={VIZ.muted}
        strokeDasharray="4 4"
        strokeWidth={1.2}
        rx={4}
      />
      <Txt x={main.lineX0 - 12} y={(zTop + zBot) / 2 + 6} anchor="end" muted>
        n ≥ 3
      </Txt>
      {transitions(main, false)}

      {/* Forstørrelse av nivåene nær null */}
      <rect
        x={zoom.x + 4}
        y={zoom.y - head}
        width={zoom.w - 8}
        height={zoom.h + head + 10}
        rx={10}
        fill="none"
        stroke={VIZ.grid}
        strokeWidth={1.5}
      />
      <Txt x={zoom.x + 18} y={zoom.y - head + 24 * Math.min(f, 1.5)} anchor="start" muted>
        Forstørret: n = 3 til ∞
      </Txt>
      {[7, 8, 9, 10, 12, 15].map((n) => (
        <line
          key={n}
          x1={zoom.lineX0}
          x2={zoom.lineX1}
          y1={yOf(zoom, levelEnergyEV(n))}
          y2={yOf(zoom, levelEnergyEV(n))}
          stroke={VIZ.grid}
          strokeWidth={1.5}
        />
      ))}
      {[3, 4, 5, 6].map((n) => (
        <g key={n}>
          <line
            x1={zoom.lineX0}
            x2={zoom.lineX1}
            y1={yOf(zoom, levelEnergyEV(n))}
            y2={yOf(zoom, levelEnergyEV(n))}
            stroke={n === upper || n === lower ? VIZ.ink : VIZ.muted}
            strokeWidth={n === upper || n === lower ? 2.5 : 1.5}
          />
          {levelLabel(zoom, n, narrow ? `n = ${n}` : String(n))}
          <Txt x={zoom.lineX1 + 8} y={yOf(zoom, levelEnergyEV(n)) + 6} anchor="start" muted>
            {fmt(levelEnergyEV(n), sigDecimals(levelEnergyEV(n)))} eV
          </Txt>
        </g>
      ))}
      <line x1={zoom.lineX0} x2={zoom.lineX1} y1={yOf(zoom, 0)} y2={yOf(zoom, 0)} className="viz-guide" />
      <Txt x={zoom.lineX0 - 12} y={yOf(zoom, 0) + 6} anchor="end">
        {narrow ? 'n = ∞' : '∞'}
      </Txt>
      <Txt x={zoom.lineX1 + 8} y={yOf(zoom, 0) + 6} anchor="start" muted>
        0 eV
      </Txt>
      {transitions(zoom, true)}

      {/* Fotonet: ut fra atomet ved emisjon, inn ved absorpsjon */}
      {mode === 'emisjon' ? (
        <PhotonWave x1={px0} y1={yPh} x2={px1} y2={yPh} color={photonColor} />
      ) : (
        <PhotonWave x1={px1} y1={yPh} x2={px0} y2={yPh} color={photonColor} />
      )}
    </>
  );
}

const LOG_MIN = Math.log10(80);
const LOG_MAX = Math.log10(8000);

function WavelengthAxis({ upper, lower, height }: { upper: number; lower: number; height: number }) {
  const f = useTextScale();
  const gradId = `rainbow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const x0 = 30;
  const x1 = 770;
  const sx = (nm: number) => x0 + ((Math.log10(nm) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (x1 - x0);
  const barY = 34 * f;
  const barH = 16;
  const rowsTop = barY + barH + 18;
  const axisY = height - 56 * f;
  const rowH = (axisY - rowsTop - 10) / 5;
  const selNm = transitionPhoton(upper, lower).lambda * 1e9;
  const ticks = [100, 200, 500, 1000, 2000, 5000];
  const stops: ReactNode[] = [];
  for (let nm = VISIBLE_MIN; nm <= VISIBLE_MAX; nm += 10) {
    stops.push(
      <stop key={nm} offset={`${((nm - VISIBLE_MIN) / (VISIBLE_MAX - VISIBLE_MIN)) * 100}%`} stopColor={wavelengthColor(nm, 'black')} />,
    );
  }
  const selX = sx(selNm);
  const labelAnchor = selX > 680 ? 'end' : selX < 120 ? 'start' : 'middle';

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {stops}
        </linearGradient>
      </defs>
      {/* Områdene: ultrafiolett, synlig, infrarødt */}
      <rect x={sx(80)} y={barY} width={sx(VISIBLE_MIN) - sx(80)} height={barH} fill={VIZ.series[3]} opacity={0.18} />
      <rect x={sx(VISIBLE_MIN)} y={barY} width={sx(VISIBLE_MAX) - sx(VISIBLE_MIN)} height={barH} fill={`url(#${gradId})`} />
      <rect x={sx(VISIBLE_MAX)} y={barY} width={sx(8000) - sx(VISIBLE_MAX)} height={barH} fill={VIZ.series[1]} opacity={0.18} />
      {/* Områdenavnet skjules der etiketten til det valgte fotonet står */}
      {selNm >= VISIBLE_MIN && (
        <Txt x={(sx(80) + sx(VISIBLE_MIN)) / 2} y={barY - 10} muted>
          UV
        </Txt>
      )}
      {selNm <= VISIBLE_MAX && (
        <Txt x={(sx(VISIBLE_MAX) + sx(8000)) / 2} y={barY - 10} muted>
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
                  strokeWidth={sel ? 5 : 2.5}
                  opacity={active ? 1 : 0.55}
                />
              );
            })}
            <Txt
              x={right ? sx(longest) + 10 : sx(shortest) - 10}
              y={y + rowH / 2 + 6}
              anchor={right ? 'start' : 'end'}
              color={active ? seriesColor(L) : undefined}
              muted={!active}
              weight={active ? 700 : 500}
            >
              {seriesName(L)}
            </Txt>
          </g>
        );
      })}

      {/* Valgt linje */}
      <line x1={selX} x2={selX} y1={barY + barH} y2={rowsTop + (lower - 1) * rowH + 2} className="viz-guide" />
      <Txt x={selX} y={barY - 10} anchor={labelAnchor} weight={700}>
        {fmt(selNm, 0)} nm
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

function explanation(mode: Mode, upper: number, lower: number, eV: number, nm: number): ReactNode {
  const region = spectralRegion(nm);
  const series = seriesName(lower);
  const visibleBalmer = lower === 2 && region === 'synlig';
  const where =
    region === 'uv' ? (
      <>ultrafiolett, fordi spranget ned til n = 1 er så stort</>
    ) : region === 'ir' ? (
      <>infrarødt, fordi nivåene ligger tett og fotonet får lite energi</>
    ) : (
      <>synlig lys med {colorName(nm)} farge</>
    );
  const seriesText = visibleBalmer ? (
    <>Overgangene ned til n = 2 kalles Balmer-serien, og de fire første er synlige.</>
  ) : (
    <>
      Overgangene ned til n = {lower} kalles {series}-serien.
    </>
  );
  const ionize =
    lower === 1 ? (
      <> Fra grunntilstanden n = 1 trengs {fmt(-levelEnergyEV(1), 1)} eV for å rive løs elektronet helt (ionisering, E = 0).</>
    ) : null;
  const ionizeAbs =
    lower === 1 ? (
      <>
        {' '}
        Unntaket er fotoner med mer enn {fmt(-levelEnergyEV(1), 1)} eV: de kan alltid tas opp, for de river løs elektronet helt
        (ionisering, E = 0).
      </>
    ) : null;
  if (mode === 'emisjon')
    return (
      <p>
        <strong>Emisjon.</strong> Elektronet faller fra n = {upper} til n = {lower} og sender ut ett foton med energi lik forskjellen mellom
        nivåene: E = hf = E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> = {fmt(eV, sigDecimals(eV))} eV. Det gir λ = {fmt(nm, 0)} nm, som er{' '}
        {where}. {seriesText}
        {ionize} Bohrs modell gir riktige nivåer for hydrogen, men virker ikke for atomer med flere elektroner.
      </p>
    );
  return (
    <p>
      <strong>Absorpsjon.</strong> Atomet tar bare opp et foton som har nøyaktig energien E<Sub>{upper}</Sub> − E<Sub>{lower}</Sub> ={' '}
      {fmt(eV, sigDecimals(eV))} eV (λ = {fmt(nm, 0)} nm, {region === 'synlig' ? `synlig lys med ${colorName(nm)} farge` : REGION_NAMES[region]}). Da løftes elektronet
      fra n = {lower} til n = {upper}. Fotoner med litt mer eller litt mindre energi går rett gjennom, fordi elektronet ikke kan være mellom
      nivåene.{ionizeAbs}
    </p>
  );
}
