import { useState, type ReactNode } from 'react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  Pattedyr,
  Plante,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Tre,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  niceTicks,
  sample,
  useContainerTextScale,
  useSvgId,
  type BioPaint,
} from '../kit';
import {
  KM_PER_DEGREE,
  LAND,
  LAPSE_RATE,
  LAT_GRADIENT,
  LAT_MAX,
  LAT_MIN,
  SPECIES,
  landSegments,
  niceAxis,
  shiftPerDegreeAltitude,
  shiftPerDegreeLatitude,
  speciesRange,
  tempAtAltitude,
  tempAtLatitude,
  type Band,
  type RangeMode,
  type RangeResult,
  type Species,
  type SpeciesId,
} from './model';

const MODES: { value: RangeMode; label: string }[] = [
  { value: 'hoyde', label: 'Opp i fjellet' },
  { value: 'nord', label: 'Nordover' },
];

const DT_MAX = 5;
const ALT_MAX = 2600;
/** Tapt område (skravert) og klimasonen med oppvarming (leveområde, grønt for alle artene). */
const C_LOST = BIO.rovdyr;
const C_ZONE = BIO.plante.line;

const paintOf = (kind: Species['kind']): BioPaint => (kind === 'pattedyr' ? BIO.pattedyr : BIO.plante);

export default function KlimaOgUtbredelse() {
  const [mode, setMode] = useState<RangeMode>('hoyde');
  const [dT, setDT] = useState(2);
  const [Tmin, setTmin] = useState(4.5);
  const [Tmax, setTmax] = useState(9.5);
  const [peak, setPeak] = useState(2000);
  const [kind, setKind] = useState<Species['kind']>('pattedyr');
  const preset = SPECIES.find((s) => Math.abs(s.Tmin - Tmin) < 1e-9 && Math.abs(s.Tmax - Tmax) < 1e-9) ?? null;
  const sp = { Tmin, Tmax };
  const res = speciesRange(sp, dT, mode, peak);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const name = preset?.name ?? 'Arten';
  const paint = paintOf(preset?.kind ?? kind);
  const zone: BioPaint = { fill: BIO.plante.fill, line: C_ZONE };
  const pick = (id: SpeciesId) => {
    const s = SPECIES.find((x) => x.id === id)!;
    setTmin(s.Tmin);
    setTmax(s.Tmax);
    setKind(s.kind);
  };
  const shift = mode === 'hoyde' ? dT * shiftPerDegreeAltitude() : dT * shiftPerDegreeLatitude();
  const fmtBand = (b: Band | null) =>
    !b ? 'Ingen' : mode === 'hoyde' ? `${fmt(b.from, 0)}–${fmt(b.to, 0)} m` : `${fmt(b.from, 1)}–${fmt(b.to, 1)}° N`;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Temperaturgradient" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Art"
          options={SPECIES.map((s) => ({ value: s.id, label: s.name, detail: `${fmt(s.Tmin, 1)}–${fmt(s.Tmax, 1)} °C` }))}
          value={preset?.id ?? null}
          onPick={pick}
        />
      </Toolbar>
      <Controls>
        <Slider label="Oppvarming" value={dT} onChange={setDT} min={0} max={DT_MAX} step={0.1} decimals={1} unit="°C" />
        <Slider
          label="Kaldeste juli arten tåler"
          value={Tmin}
          onChange={(v) => {
            setTmin(v);
            if (v > Tmax - 1) setTmax(v + 1);
          }}
          min={0}
          max={18}
          step={0.5}
          decimals={1}
          unit="°C"
        />
        <Slider
          label="Varmeste juli arten tåler"
          value={Tmax}
          onChange={(v) => {
            setTmax(v);
            if (v < Tmin + 1) setTmin(v - 1);
          }}
          min={2}
          max={20}
          step={0.5}
          decimals={1}
          unit="°C"
        />
        {mode === 'hoyde' && <Slider label="Fjelltoppen" value={peak} onChange={setPeak} min={800} max={2500} step={50} unit="moh." />}
      </Controls>

      <div ref={ref}>
        {mode === 'hoyde' ? (
          <Mountain res={res} peak={peak} dT={dT} f={f} paint={zone} glyphPaint={paint} kind={preset?.kind ?? kind} name={name} Tmin={Tmin} Tmax={Tmax} />
        ) : (
          <North res={res} dT={dT} f={f} paint={zone} name={name} />
        )}
      </div>
      <Legend
        items={[
          { color: C_ZONE, label: `Passende klima med ${fmt(dT, 1)} °C oppvarming` },
          { color: VIZ.ink, label: 'Grensene i dag', dashed: true },
          { color: C_LOST, label: 'Skravert: tapt område' },
        ]}
      />

      <AreaPlot Tmin={Tmin} Tmax={Tmax} mode={mode} peak={peak} dT={dT} f={f} color={C_ZONE} />

      <Readouts>
        <Readout label={mode === 'hoyde' ? 'Passende høyde i dag' : 'Passende klima i dag'} value={fmtBand(res.today)} />
        <Readout label={`Med ${fmt(dT, 1)} °C oppvarming`} value={fmtBand(res.future)} tone={C_ZONE} />
        <Readout
          label={mode === 'hoyde' ? 'Areal igjen' : 'Land igjen'}
          value={res.remaining === null ? '–' : fmtPct(res.remaining)}
          unit={res.remaining === null ? undefined : 'av i dag'}
          tone={res.remaining !== null && res.remaining < 1 ? C_LOST : undefined}
        />
        <Readout
          label="Sonen flytter seg"
          value={fmt(shift, 0)}
          unit={mode === 'hoyde' ? 'm oppover' : 'km nordover'}
        />
      </Readouts>

      <Formula label="Hvor langt klimasonen flytter seg">
        {mode === 'hoyde' ? (
          <>
            <FormulaLine>
              Temperaturen synker ca. {fmt(LAPSE_RATE * 100, 1)} °C per 100 m: {fmt(dT, 1)} °C / {fmt(LAPSE_RATE * 100, 1)} °C per 100 m ={' '}
              {fmt(shift, 0)} m oppover
            </FormulaLine>
            <FormulaLine>
              Areal på et kjegleformet fjell: arealet over høyden h er ∝ (H − h)², så høydebelter nær toppen er små
            </FormulaLine>
          </>
        ) : (
          <>
            <FormulaLine>
              Julitemperaturen synker ca. {fmt(LAT_GRADIENT, 2)} °C per breddegrad: {fmt(dT, 1)} / {fmt(LAT_GRADIENT, 2)} ={' '}
              {fmt(dT / LAT_GRADIENT, 1)} breddegrader
            </FormulaLine>
            <FormulaLine>
              {fmt(dT / LAT_GRADIENT, 1)} breddegrader · {KM_PER_DEGREE} km = {fmt(shift, 0)} km nordover
            </FormulaLine>
          </>
        )}
      </Formula>

      <Explain>{explanation({ mode, res, dT, name, preset, peak, shift, Tmin })}</Explain>
    </VizLayout>
  );
}

/* ---------- Fjellet ---------- */

function Mountain({
  res,
  peak,
  dT,
  f,
  paint,
  glyphPaint,
  kind,
  name,
  Tmin,
  Tmax,
}: {
  res: RangeResult;
  peak: number;
  dT: number;
  f: number;
  paint: BioPaint;
  glyphPaint: BioPaint;
  kind: Species['kind'];
  name: string;
  Tmin: number;
  Tmax: number;
}) {
  const clip = useSvgId('fjell');
  const hatch = useSvgId('tapt');
  const k = Math.max(1, f * 0.85);
  const H = Math.round(400 + 340 * (f - 1));
  const top = 28 * f + 12;
  const bottom = H - 14;
  const axisX = 64 * f;
  const xL = axisX + 16;
  const xR = 788;
  const xc = xL + 0.52 * (xR - xL);
  const yOf = (alt: number) => bottom - ((bottom - top) * alt) / ALT_MAX;
  const altAt = (x: number) => {
    const d = x < xc ? (xc - x) / (xc - xL) : (x - xc) / (xR - xc);
    return peak * Math.max(0, Math.min(1, (1 - d) ** (x < xc ? 1.15 : 1.35)));
  };
  const profile = sample(altAt, xL, xR, 160);
  const d = `M${xL},${bottom} ${profile.map(([x, a]) => `L${x.toFixed(1)},${yOf(a).toFixed(1)}`).join(' ')} L${xR},${bottom} Z`;
  const ticks = niceTicks(0, ALT_MAX, 5).filter((v) => v <= ALT_MAX);
  // Høyden der et belte krysser skråningene (for organismene)
  const xAtAlt = (alt: number, side: -1 | 1) => {
    let lo = side < 0 ? xL : xc;
    let hi = side < 0 ? xc : xR;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const a = altAt(mid);
      if (side < 0 ? a < alt : a > alt) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const fu = res.future;
  const td = res.today;
  // Tapt: den delen av dagens belte som ikke er med lenger
  const lost: Band[] = [];
  if (td) {
    if (!fu) lost.push(td);
    else {
      if (fu.from > td.from) lost.push({ from: td.from, to: Math.min(td.to, fu.from) });
      if (fu.to < td.to) lost.push({ from: Math.max(td.from, fu.to), to: td.to });
    }
  }
  const size = 30 * k;
  const candidates =
    fu && fu.to - fu.from > 40
      ? [
          { alt: fu.from + (fu.to - fu.from) * 0.35, side: -1 as const },
          { alt: fu.from + (fu.to - fu.from) * 0.6, side: 1 as const },
          { alt: fu.from + (fu.to - fu.from) * 0.25, side: 1 as const },
        ]
      : [];
  // Nær toppen er skråningene nær hverandre: dropp symboler som ville ligget oppå et annet
  const glyphs: { x: number; y: number }[] = [];
  for (const g of candidates) {
    const p = { x: xAtAlt(g.alt, g.side) + g.side * -size * 0.9, y: yOf(g.alt) - size * 0.1 };
    if (glyphs.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > size * 1.05)) glyphs.push(p);
  }
  const Glyph = kind === 'pattedyr' ? Pattedyr : kind === 'tre' ? Tre : Plante;
  const label = `Fjell med topp på ${fmt(peak, 0)} m. ${name} har passende klima ${td ? `fra ${fmt(td.from, 0)} til ${fmt(td.to, 0)} m i dag` : 'ingen steder i dag'}, og ${fu ? `fra ${fmt(fu.from, 0)} til ${fmt(fu.to, 0)} m` : 'ingen steder'} med ${fmt(dT, 1)} °C oppvarming.`;
  return (
    <Figure viewBox={`0 0 800 ${H}`} maxHeight={H} label={label} caption="Høyde over havet. Julitemperaturen ved havnivået er 16 °C i dag (Sør-Norge, forenklet).">
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={C_LOST} strokeWidth={3.2} />
        </pattern>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={axisX} x2={xR} y1={yOf(v)} y2={yOf(v)} className="viz-gridline" />
          <Txt x={axisX - 8} y={yOf(v) + 5 * f} anchor="end" size={0.8} muted>
            {fmt(v, 0)}
          </Txt>
        </g>
      ))}
      <Txt x={axisX - 8} y={top - 12} anchor="end" size={0.8} muted>
        moh.
      </Txt>
      <path d={d} fill={VIZ.body} stroke={VIZ.muted} strokeWidth={1.5} strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>
        {fu && <rect x={xL} y={yOf(fu.to)} width={xR - xL} height={yOf(fu.from) - yOf(fu.to)} fill={paint.line} opacity={0.42} />}
        {lost.map((b, i) => (
          <rect key={i} x={xL} y={yOf(b.to)} width={xR - xL} height={yOf(b.from) - yOf(b.to)} fill={`url(#${hatch})`} opacity={0.75} />
        ))}
      </g>
      {/* Grensene i dag */}
      {td &&
        [td.from, td.to].map((a, i) =>
          a > 0.5 && a < peak - 0.5 ? (
            <line key={i} x1={xAtAlt(a, -1) - 14} x2={xAtAlt(a, 1) + 14} y1={yOf(a)} y2={yOf(a)} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="7 5" />
          ) : null,
        )}
      {glyphs.map((g, i) => (
        <Glyph key={i} x={g.x} y={g.y} size={size} paint={glyphPaint} />
      ))}
      {/* Temperaturgrensene med oppvarming, til høyre */}
      {fu &&
        [
          { alt: fu.to, T: Tmin, show: fu.to < peak - 1, dy: -7 },
          {
            alt: fu.from,
            T: Tmax,
            show: fu.from > 1 && (yOf(fu.from) + 22 * f < bottom || yOf(fu.from) - yOf(fu.to) > 44 * f),
            dy: yOf(fu.from) + 22 * f < bottom ? 20 * f : -7,
          },
        ].map((e, i) =>
          e.show ? (
            <g key={i}>
              <line x1={xAtAlt(e.alt, 1)} x2={xR} y1={yOf(e.alt)} y2={yOf(e.alt)} stroke={paint.line} strokeWidth={1.5} strokeDasharray="2 4" />
              <Txt x={xR - 4} y={yOf(e.alt) + e.dy} anchor="end" size={0.8} color={paint.line} weight={700}>
                {fmt(e.T, 1)} °C i juli
              </Txt>
            </g>
          ) : null,
        )}
      <circle cx={xc} cy={yOf(peak)} r={4} fill={VIZ.ink} />
      <Txt x={xc} y={yOf(peak) - 10} size={0.85} weight={700}>
        {fmt(peak, 0)} m
      </Txt>
      {!fu && (
        <Txt x={xc} y={yOf(peak * 0.38)} weight={700} color={C_LOST} size={0.95}>
          {res.today ? 'Ingen steder høyere å gå' : 'Ikke passende klima på fjellet'}
        </Txt>
      )}
      <line x1={axisX} x2={xR} y1={bottom} y2={bottom} stroke={VIZ.muted} strokeWidth={1.5} />
    </Figure>
  );
}

/* ---------- Nordover ---------- */

const PLACES: { name: string; lat: number; short?: boolean }[] = [
  { name: 'Lindesnes', lat: 58, short: true },
  { name: 'Trondheim', lat: 63.4 },
  { name: 'Bodø', lat: 67.3 },
  { name: 'Nordkapp', lat: 71.2, short: true },
  { name: 'Bjørnøya', lat: 74.4 },
  { name: 'Svalbard', lat: 78.6, short: true },
];

function North({ res, dT, f, paint, name }: { res: RangeResult; dT: number; f: number; paint: BioPaint; name: string }) {
  const hatch = useSvgId('tapt-nord');
  const narrow = f > 1.3;
  const x0 = 30;
  const x1 = 770;
  const xOf = (lat: number) => x0 + ((x1 - x0) * (lat - LAT_MIN)) / (LAT_MAX - LAT_MIN);
  const titleY = 22 * f;
  const stripTop = titleY + 18 * f;
  const stripH = 90 + 80 * (f - 1);
  const stripBot = stripTop + stripH;
  const placeY = stripBot + 24 * f;
  const tickY = placeY + (narrow ? 26 * f : 26 * f);
  const tempTitleY = tickY + 34 * f;
  const tempY = tempTitleY + 26 * f;
  const H = Math.round(tempY + 16);
  const fu = res.future;
  const td = res.today;
  const futureLand = landSegments(fu);
  const todayLand = landSegments(td);
  const lost: Band[] = [];
  for (const s of todayLand) {
    if (!fu) lost.push(s);
    else {
      if (fu.from > s.from) lost.push({ from: s.from, to: Math.min(s.to, fu.from) });
      if (fu.to < s.to) lost.push({ from: Math.max(s.from, fu.to), to: s.to });
    }
  }
  const degTicks = [60, 65, 70, 75, 80];
  const tempTicks = narrow ? [60, 70, 80] : degTicks;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Lavlandet fra Lindesnes til Svalbard. ${name} har passende klima ${td ? `fra ${fmt(td.from, 1)} til ${fmt(td.to, 1)} grader nord i dag` : 'ingen steder i dag'}.`}
      caption="Land (grått) og hav (blått) langs en linje fra Lindesnes til nordspissen av Svalbard. Bare lavlandet, uten fjell."
    >
      <defs>
        <pattern id={hatch} patternUnits="userSpaceOnUse" width={9} height={9} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={C_LOST} strokeWidth={3.2} />
        </pattern>
      </defs>
      <Txt x={x0} y={titleY} anchor="start" muted size={0.85}>
        Sør
      </Txt>
      <Txt x={x1} y={titleY} anchor="end" muted size={0.85}>
        Nord
      </Txt>
      <rect x={x0} y={stripTop} width={x1 - x0} height={stripH} rx={10} fill={BIO.vannFyll} />
      {LAND.map((l) => (
        <rect
          key={l.name}
          x={xOf(l.from)}
          y={stripTop + 8}
          width={Math.max(4, xOf(l.to) - xOf(l.from))}
          height={stripH - 16}
          rx={6}
          fill={VIZ.body}
          stroke={VIZ.muted}
          strokeWidth={1.2}
        />
      ))}
      {futureLand.map((s, i) => (
        <rect key={`f${i}`} x={xOf(s.from)} y={stripTop + 8} width={Math.max(3, xOf(s.to) - xOf(s.from))} height={stripH - 16} fill={paint.line} opacity={0.5} />
      ))}
      {lost.map((s, i) => (
        <rect key={`l${i}`} x={xOf(s.from)} y={stripTop + 8} width={Math.max(3, xOf(s.to) - xOf(s.from))} height={stripH - 16} fill={`url(#${hatch})`} opacity={0.8} />
      ))}
      {/* Klimasonen i dag (også over havet) */}
      {td && (
        <rect
          x={xOf(td.from)}
          y={stripTop + 2}
          width={Math.max(2, xOf(td.to) - xOf(td.from))}
          height={stripH - 4}
          fill="none"
          stroke={VIZ.ink}
          strokeWidth={2}
          strokeDasharray="7 5"
          rx={4}
        />
      )}
      {fu && (
        <line x1={xOf(fu.from)} x2={xOf(fu.to)} y1={stripTop + stripH / 2} y2={stripTop + stripH / 2} stroke={paint.line} strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" />
      )}
      {PLACES.filter((p) => !narrow || p.short).map((p) => (
        <g key={p.name}>
          <line x1={xOf(p.lat)} x2={xOf(p.lat)} y1={stripBot} y2={stripBot + 6} stroke={VIZ.muted} strokeWidth={1.5} />
          <Txt
            x={Math.min(x1, Math.max(x0, xOf(p.lat)))}
            y={placeY}
            anchor={p.lat <= 58 ? 'start' : p.lat > 80 ? 'end' : 'middle'}
            size={0.8}
          >
            {p.name}
          </Txt>
        </g>
      ))}
      {(narrow ? [60, 70, 80] : degTicks).map((lat) => (
        <Txt key={lat} x={xOf(lat)} y={tickY} size={0.75} muted>
          {lat}° N
        </Txt>
      ))}
      <Txt x={x0} y={tempTitleY} anchor="start" size={0.8} muted>
        Julitemperatur med {fmt(dT, 1)} °C oppvarming:
      </Txt>
      {tempTicks.map((lat) => (
        <Txt key={lat} x={xOf(lat)} y={tempY} size={0.85} weight={700} color={paint.line}>
          {fmt(tempAtLatitude(lat, dT), 1)} °C
        </Txt>
      ))}
    </Figure>
  );
}

/* ---------- Areal mot oppvarming ---------- */

function AreaPlot({
  Tmin,
  Tmax,
  mode,
  peak,
  dT,
  f,
  color,
}: {
  Tmin: number;
  Tmax: number;
  mode: RangeMode;
  peak: number;
  dT: number;
  f: number;
  color: string;
}) {
  const H = Math.round(300 + 240 * (f - 1));
  const val = (x: number) => {
    const r = speciesRange({ Tmin, Tmax }, x, mode, peak);
    return mode === 'hoyde' ? r.areaFuture * 100 : r.areaFuture * KM_PER_DEGREE;
  };
  const pts = sample(val, 0, DT_MAX, 100);
  const vMax = Math.max(...pts.map(([, v]) => v));
  const { max: yMax, ticks } = niceAxis(Math.max(mode === 'hoyde' ? 5 : 100, vMax * 1.05), 4);
  const now = val(dT);
  const today = val(0);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      label={`Areal med passende klima som funksjon av oppvarmingen. I dag ${fmt(today, 0)}, med ${fmt(dT, 1)} °C oppvarming ${fmt(now, 0)}.`}
    >
      <Plot
        x={{ min: 0, max: DT_MAX, label: 'Oppvarming (°C)' }}
        y={{ min: 0, max: yMax, label: mode === 'hoyde' ? 'Areal (% av fjellet)' : 'Land med passende klima (km)', ticks }}
        width={800}
        height={H}
      >
        {({ sx, sy, y0, y1 }) => (
          <g>
            <path d={`${linePath(pts, sx, sy)} L${sx(DT_MAX)},${sy(0)} L${sx(0)},${sy(0)} Z`} fill={color} opacity={0.15} />
            <line x1={sx(0)} x2={sx(DT_MAX)} y1={sy(today)} y2={sy(today)} stroke={VIZ.ink} strokeWidth={1.8} strokeDasharray="7 5" />
            <path d={linePath(pts, sx, sy)} fill="none" stroke={color} strokeWidth={3.5} />
            <line x1={sx(dT)} x2={sx(dT)} y1={y0} y2={y1} className="viz-guide" />
            <circle cx={sx(dT)} cy={sy(now)} r={7} fill={color} stroke={VIZ.surface} strokeWidth={2.5} />
          </g>
        )}
      </Plot>
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

function explanation({
  mode,
  res,
  dT,
  name,
  preset,
  peak,
  shift,
  Tmin,
}: {
  mode: RangeMode;
  res: RangeResult;
  dT: number;
  name: string;
  preset: Species | null;
  peak: number;
  shift: number;
  Tmin: number;
}): ReactNode {
  const where = mode === 'hoyde' ? `${fmt(shift, 0)} m oppover` : `ca. ${fmt(shift, 0)} km nordover`;
  const latin = preset ? (
    <>
      {' '}
      (<em>{preset.latin}</em>)
    </>
  ) : null;
  const move = (
    <p>
      Arter flytter seg ikke fordi de «vil». Individer som havner utenfor toleranseområdet, klarer seg dårligere og får færre avkom, mens frø
      og unge dyr som sprer seg til steder der klimaet nå passer, kan etablere seg der. Planter og trær sprer seg sakte, så de henger ofte
      etter klimaet.
    </p>
  );
  const measures = (
    <p>
      Tiltak: kutte utslippene av klimagasser, verne store, sammenhengende fjellområder, og unngå inngrep som hytter, veier og kraftlinjer som
      stykker opp leveområdene.{preset?.id === 'fjellrev' ? ' For fjellreven drives det også avl og utsetting av unger fra avlsstasjoner.' : ''}
    </p>
  );
  const lowland =
    mode === 'nord' ? (
      <p>
        Langs denne linja er det bare lavlandet. I fjellet er det kaldere, så mange fjellarter finnes også langt sør i Norge, høyt oppe (se
        «Opp i fjellet»).
      </p>
    ) : null;
  const speciesNote: Partial<Record<SpeciesId, ReactNode>> = {
    fjellrev: (
      <p>
        Fjellreven er truet i Norge. Den øvre temperaturgrensen er ikke varmen i seg selv, men <strong>konkurranse</strong>: når det blir
        varmere, flytter rødreven (velg den) oppover og tar over leveområdene og maten. Dette er et eksempel på at biotiske og abiotiske
        faktorer virker sammen.
      </p>
    ),
    issoleie: (
      <p>
        Issoleie er den karplanten som vokser høyest i Norge, helt opp mot 2400 m i Jotunheimen. Høyfjellsplanter tåler kulde godt, men taper
        konkurransen mot større og raskere planter når de kommer opp i høyden.
      </p>
    ),
    fjellbjork: (
      <p>
        Fjellbjørka danner skoggrensen, der julitemperaturen er rundt 10 °C. Når skoggrensen flytter seg opp, gror snaufjellet igjen med
        bjørk og busker, og fjellartene mister leveområder nedenfra.
      </p>
    ),
    rodrev: (
      <p>
        Rødreven er en generalist som lever fra lavlandet og opp i fjellet. Den får <strong>større</strong> område når det blir varmere, og
        konkurrerer da med fjellreven.
      </p>
    ),
  };
  const note = preset ? speciesNote[preset.id] : null;
  if (!res.today) {
    // For kaldt overalt (selv ved havnivået / lengst sør) eller for varmt overalt (selv på toppen / lengst nord)?
    const tooCold = mode === 'hoyde' ? tempAtAltitude(0) < Tmin : tempAtLatitude(LAT_MIN) < Tmin;
    const arrives = !!res.future && res.areaFuture > 0;
    return (
      <>
        <p>
          <strong>Ikke passende klima {mode === 'hoyde' ? 'på dette fjellet' : 'i lavlandet'} i dag.</strong> Med dette toleranseområdet er det{' '}
          {tooCold
            ? `for kaldt ${mode === 'hoyde' ? `selv ved havnivået (${fmt(tempAtAltitude(0), 0)} °C i juli)` : 'selv lengst sør'}`
            : `for varmt ${mode === 'hoyde' ? `selv på toppen (${fmt(peak, 0)} m)` : 'overalt på land'}`}
          .{' '}
          {arrives
            ? `Med ${fmt(dT, 1)} °C oppvarming får ${name.toLowerCase()} passende klima her, så arten kan spre seg hit og bli en ny art i området. Slik kommer sørlige arter nordover og oppover når klimaet blir varmere.`
            : mode === 'hoyde'
              ? tooCold
                ? 'Øk oppvarmingen eller velg en art.'
                : 'Gjør fjellet høyere eller velg en art.'
              : 'Velg en art, eller se på fjellet i stedet.'}
        </p>
        {move}
      </>
    );
  }
  if (dT < 0.05)
    return (
      <>
        <p>
          <strong>Klimaet i dag.</strong> {name}
          {latin} har passende klima der julitemperaturen er innenfor toleranseområdet. Temperaturen synker{' '}
          {mode === 'hoyde' ? 'oppover i fjellet' : 'nordover'}, så arten finnes i et belte. Øk oppvarmingen for å se hva som skjer.
        </p>
        {note}
        {move}
      </>
    );
  const pct = res.remaining === null ? '' : fmtPct(res.remaining);
  let main: ReactNode;
  if (res.gone)
    main = (
      <p>
        <strong>Ingen steder igjen.</strong> Med {fmt(dT, 1)} °C oppvarming flytter klimasonen seg {where}, og da ligger hele sonen{' '}
        {mode === 'hoyde' ? `over toppen av fjellet (${fmt(peak, 0)} m)` : 'nord for det siste landet (Svalbard)'}. Det finnes ikke noe{' '}
        {mode === 'hoyde' ? 'høyere' : 'lenger nord'} å flytte til, så {name.toLowerCase()} forsvinner herfra.{' '}
        {mode === 'hoyde'
          ? 'Arter på isolerte fjelltopper kan ikke bare flytte til et annet fjell: dalene imellom er for varme.'
          : 'Havet er en barriere som de fleste landlevende arter ikke kommer over.'}
      </p>
    );
  else if (res.squeezed || (res.remaining !== null && res.remaining < 0.999))
    main = (
      <p>
        <strong>Klimasonen krymper.</strong> Med {fmt(dT, 1)} °C oppvarming flytter klimasonen seg {where}.{' '}
        {mode === 'hoyde'
          ? res.squeezed
            ? 'Den nedre grensen går oppover, men den øvre kan ikke det: det finnes ikke noe høyere enn toppen. '
            : 'Fjellet blir smalere oppover, så det er mindre areal høyere oppe. '
          : res.squeezed
            ? 'Den sørlige grensen går nordover, men landet slutter. '
            : 'Noe av det nye området ligger ute i havet. '}
        Arealet blir {pct} av det arten har i dag.
      </p>
    );
  else
    main = (
      <p>
        <strong>Klimasonen flytter seg, men blir ikke mindre.</strong> Med {fmt(dT, 1)} °C oppvarming flytter den seg {where}
        {res.remaining !== null && res.remaining > 1.001 ? `, og arealet blir ${pct} av i dag` : ''}. Arter fra lavlandet kan få større
        områder, og da møter fjellartene nye konkurrenter.
      </p>
    );
  return (
    <>
      {main}
      {note}
      {lowland}
      {move}
      {res.remaining !== null && res.remaining < 0.999 ? measures : null}
    </>
  );
}
