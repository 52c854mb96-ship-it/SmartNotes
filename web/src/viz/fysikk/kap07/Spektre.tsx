import { useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  fmtSci,
  useTextScale,
} from '../../kit';
import { placeLabels } from './labels';
import {
  colorName,
  elementLines,
  nearestLine,
  photonFromWavelength,
  strongestLine,
  SUN_LINES,
  sunLinesOf,
  VISIBLE_MAX,
  VISIBLE_MIN,
  wavelengthColor,
  type SpectralLine,
  type SpectrumElement,
} from './model';
import { textWidthEm, Txt } from './parts';
import { useFigureTextScale } from './useNarrow';

type Mode = 'kontinuerlig' | 'emisjon' | 'absorpsjon';

const MODES: { value: Mode; label: string }[] = [
  { value: 'kontinuerlig', label: 'Kontinuerlig' },
  { value: 'emisjon', label: 'Emisjon' },
  { value: 'absorpsjon', label: 'Absorpsjon' },
];

const ELEMENTS: { value: SpectrumElement; label: string }[] = [
  { value: 'hydrogen', label: 'Hydrogen' },
  { value: 'helium', label: 'Helium' },
  { value: 'natrium', label: 'Natrium' },
  { value: 'kvikksolv', label: 'Kvikksølv' },
];

/** Navn på grunnstoffene bak linjene i sollys. */
const SUN_ELEMENT_NAMES: Record<string, string> = {
  H: 'hydrogen',
  Na: 'natrium',
  Ca: 'kalsium',
  Fe: 'jern',
  Mg: 'magnesium',
  'O₂': 'oksygen i jordatmosfæren',
};

const ELEMENT_NAME: Record<SpectrumElement, string> = {
  hydrogen: 'hydrogen',
  helium: 'helium',
  natrium: 'natrium',
  kvikksolv: 'kvikksølv',
};

/** Fysisk mørke (ingen lys) i spekterfigurene. Fargene i spektrene er lysets egne farger, ikke temafarger. */
const DARK = 'rgb(6, 7, 12)';

const X0 = 40;
const X1 = 760;
const sx = (nm: number) => X0 + ((nm - VISIBLE_MIN) / (VISIBLE_MAX - VISIBLE_MIN)) * (X1 - X0);

export default function Spektre() {
  const [mode, setMode] = useState<Mode>('emisjon');
  const [el, setEl] = useState<SpectrumElement>('hydrogen');
  const [sun, setSun] = useState(false);
  const [cursor, setCursor] = useState(() => Math.round(strongestLine(elementLines('hydrogen'))?.nm ?? 550));
  const [figRef, f] = useFigureTextScale<HTMLDivElement>();

  const lines = elementLines(el);
  const changeElement = (next: SpectrumElement) => {
    setEl(next);
    const s = strongestLine(elementLines(next));
    if (s) setCursor(Math.round(s.nm));
  };
  const p = photonFromWavelength(cursor);
  const hit = mode === 'kontinuerlig' ? null : nearestLine(lines, cursor, 2);
  const sunHit = sun ? nearestLine(SUN_LINES, cursor, 1.5) : null;

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg type spekter" options={MODES} value={mode} onChange={setMode} />
        {mode !== 'kontinuerlig' && <Segmented label="Velg grunnstoff" options={ELEMENTS} value={el} onChange={changeElement} />}
        <Toggle label="Sammenlign med sollys" checked={sun} onChange={setSun} />
      </Toolbar>
      <Controls>
        <Slider label="Markør λ" value={cursor} onChange={setCursor} min={VISIBLE_MIN} max={VISIBLE_MAX} step={1} unit="nm" />
      </Controls>

      <div ref={figRef}>
        <Figure
          viewBox={`0 0 800 ${figureHeight(f, sun, mode !== 'kontinuerlig')}`}
          label={`${mode === 'kontinuerlig' ? 'Kontinuerlig spekter' : `${mode === 'emisjon' ? 'Emisjonsspekter' : 'Absorpsjonsspekter'} for ${ELEMENT_NAME[el]}`} fra 380 til 750 nm${sun ? ', sammenlignet med sollys' : ''}. Markøren står på ${cursor} nm.`}
          maxHeight={560}
        >
          <SpectrumScene mode={mode} el={el} sun={sun} cursor={cursor} lines={lines} scale={f} />
        </Figure>
      </div>

      <Readouts>
        <Readout label="Bølgelengde λ" value={fmt(cursor, 0)} unit="nm" />
        <Readout label="Frekvens f = c/λ" value={fmtSci(p.f, 2)} unit="Hz" />
        <Readout label="Fotonenergi E = hf" value={fmt(p.eV, 2)} unit="eV" />
        {mode === 'kontinuerlig' ? (
          <Readout label="Farge" value={capitalize(colorName(cursor))} />
        ) : (
          <Readout label="Linje ved markøren" value={hit ? lineName(hit, mode === 'absorpsjon') : 'Ingen'} />
        )}
      </Readouts>

      <Explain>{explanation(mode, el, sun, cursor, p.eV, hit, sunHit)}</Explain>
    </VizLayout>
  );
}

interface Layout {
  title: number;
  row1: number;
  row0: number;
  barTop: number;
  barH: number;
  tickY: number;
  axisTitle: number;
  sunTitle: number;
  sunTop: number;
  sunH: number;
  sunLabels: number;
  height: number;
}

function layout(f: number, sun: boolean, labels: boolean): Layout {
  const title = 26 * f;
  // To rader med bølgelengder over linjene (ikke i det kontinuerlige spekteret)
  const row1 = title + 30 * f;
  const row0 = row1 + 24 * f;
  // Plass til markørtrekanten over spekteret (den vokser litt på mobil), så den ikke går inn i etikettene
  const tri = Math.min(Math.max(1, f), 1.5);
  const barTop = (labels ? row0 + 10 : title + 16) + 13 * tri;
  const barH = 70 + 30 * f;
  const tickY = barTop + barH + 34 + 18 * f;
  const axisTitle = tickY + 26 * f;
  const sunTitle = axisTitle + 40 * f;
  const sunTop = sunTitle + 12;
  const sunH = 50 + 20 * f;
  const sunLabels = sunTop + sunH + 18;
  const height = sun ? sunLabels + 4 : axisTitle + 14;
  return { title, row1, row0, barTop, barH, tickY, axisTitle, sunTitle, sunTop, sunH, sunLabels, height };
}

function figureHeight(f: number, sun: boolean, labels: boolean): number {
  return Math.round(layout(f, sun, labels).height);
}

function SpectrumScene({
  mode,
  el,
  sun,
  cursor,
  lines,
  scale,
}: {
  mode: Mode;
  el: SpectrumElement;
  sun: boolean;
  cursor: number;
  lines: SpectralLine[];
  /** Tekstskalaen som høyden ble regnet ut med. */
  scale: number;
}) {
  const fReal = useTextScale();
  const L = layout(scale, sun, mode !== 'kontinuerlig');
  const gradId = `spekter-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const stops: ReactNode[] = [];
  for (let nm = VISIBLE_MIN; nm <= VISIBLE_MAX; nm += 5) {
    stops.push(
      <stop key={nm} offset={`${((nm - VISIBLE_MIN) / (VISIBLE_MAX - VISIBLE_MIN)) * 100}%`} stopColor={wavelengthColor(nm, DARK)} />,
    );
  }

  // Etiketter over linjene (de sterkeste), i to rader så de ikke overlapper
  const labelled = mode === 'kontinuerlig' ? [] : mergeClose(lines.filter((l) => l.I >= 0.3));
  const fontPx = 17 * fReal;
  // De sterkeste linjene får etikett først, så de viktigste ikke faller bort når det er trangt (mobil)
  const rows = placeLabels(
    labelled.map((l) => ({ x: sx(l.nm), width: textWidthEm(fmt(l.nm, 0)) * fontPx * 1.12, priority: l.I })),
    2,
    18,
  );
  const title =
    mode === 'kontinuerlig'
      ? 'Kontinuerlig spekter (glødende fast stoff)'
      : `${mode === 'emisjon' ? 'Emisjonsspekter' : 'Absorpsjonsspekter'}: ${ELEMENT_NAME[el]}`;
  const ticks = [400, 450, 500, 550, 600, 650, 700, 750];
  const matches = sunLinesOf(el);
  const cx = sx(cursor);
  // Markøren blir litt større på mobil
  const tri = Math.min(Math.max(1, fReal), 1.5);

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          {stops}
        </linearGradient>
      </defs>

      <Txt x={X0} y={L.title} anchor="start" muted>
        {title}
      </Txt>

      {/* Spekteret */}
      {mode === 'emisjon' ? (
        <rect x={X0} y={L.barTop} width={X1 - X0} height={L.barH} fill={DARK} />
      ) : (
        <rect x={X0} y={L.barTop} width={X1 - X0} height={L.barH} fill={`url(#${gradId})`} />
      )}
      {mode === 'emisjon' &&
        lines.map((l) => {
          const c = wavelengthColor(l.nm, DARK);
          const w = 2.5 + 2 * l.I;
          return (
            <g key={l.nm}>
              <rect x={sx(l.nm) - w * 1.6} y={L.barTop} width={w * 3.2} height={L.barH} fill={c} opacity={0.22 * l.I} />
              <rect x={sx(l.nm) - w / 2} y={L.barTop} width={w} height={L.barH} fill={c} opacity={0.45 + 0.55 * l.I} />
            </g>
          );
        })}
      {/* Forenkling som i læreboka: absorpsjonslinjene tegnes på de samme stedene som emisjonslinjene. (I virkeligheten
          absorberer en gass bare fra nivåer som er besatt, så noen linjer er mye svakere i absorpsjon.) */}
      {mode === 'absorpsjon' &&
        lines.map((l) => (
          <rect
            key={l.nm}
            x={sx(l.nm) - 1.5 - l.I}
            y={L.barTop}
            width={3 + 2 * l.I}
            height={L.barH}
            fill={DARK}
            opacity={0.5 + 0.5 * l.I}
          />
        ))}
      <rect x={X0} y={L.barTop} width={X1 - X0} height={L.barH} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />

      {/* Bølgelengden til linjene */}
      {labelled.map((l, i) => {
        const r = rows[i] ?? -1;
        if (r < 0) return null;
        const y = r === 0 ? L.row0 : L.row1;
        return (
          <g key={l.nm}>
            {r === 1 && <line x1={sx(l.nm)} x2={sx(l.nm)} y1={y + 6} y2={L.barTop - 4} className="viz-guide" />}
            <Txt x={sx(l.nm)} y={y} size={fontPx}>
              {fmt(l.nm, 0)}
            </Txt>
          </g>
        );
      })}

      {/* Akse */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={L.barTop + L.barH} y2={L.barTop + L.barH + 6} className="viz-axis" />
          <text x={sx(t)} y={L.tickY} textAnchor="middle" className="viz-tick">
            {t}
          </text>
        </g>
      ))}
      <text x={(X0 + X1) / 2} y={L.axisTitle} textAnchor="middle" className="viz-axis-label">
        bølgelengde λ (nm)
      </text>

      {/* Sollys med Fraunhofer-linjer */}
      {sun && (
        <>
          <rect x={X0} y={L.sunTop} width={X1 - X0} height={L.sunH} fill={`url(#${gradId})`} />
          {SUN_LINES.map((l) => (
            <rect
              key={l.nm}
              x={sx(l.nm) - 0.8 - l.I}
              y={L.sunTop}
              width={1.6 + 2 * l.I}
              height={L.sunH}
              fill={DARK}
              opacity={0.45 + 0.55 * l.I}
            />
          ))}
          <rect x={X0} y={L.sunTop} width={X1 - X0} height={L.sunH} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
          {/* Linjene fra grunnstoffet som også finnes i sollyset */}
          {mode !== 'kontinuerlig' &&
            mergeClose(matches).map((l) => (
              <g key={l.nm}>
                <line
                  x1={sx(l.nm)}
                  x2={sx(l.nm)}
                  y1={L.axisTitle + 8}
                  y2={L.sunTop - 2}
                  stroke={VIZ.ink}
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                />
                <path d={`M${sx(l.nm)},${L.sunTop + L.sunH + 4} l-6,10 h12 z`} fill={VIZ.ink} />
              </g>
            ))}
          <Txt x={X0} y={L.sunTitle} anchor="start" muted>
            Sollys
          </Txt>
          {mode !== 'kontinuerlig' && matches.length > 0 && (
            <Txt x={X1} y={L.sunTitle} anchor="end" muted>
              ▲ = linjer fra {ELEMENT_NAME[el]}
            </Txt>
          )}
          {mode !== 'kontinuerlig' && matches.length === 0 && (
            <Txt x={X1} y={L.sunTitle} anchor="end" muted>
              ingen linjer fra {ELEMENT_NAME[el]}
            </Txt>
          )}
        </>
      )}

      {/* Markøren: trekanter over og under spekteret, så linjene under ikke dekkes */}
      <g>
        <path d={`M${cx},${L.barTop - 1} l${-8 * tri},${-13 * tri} h${16 * tri} z`} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1.5} />
        <path
          d={`M${cx},${L.barTop + L.barH + 1} l${-8 * tri},${13 * tri} h${16 * tri} z`}
          fill={VIZ.ink}
          stroke={VIZ.surface}
          strokeWidth={1.5}
        />
      </g>
    </>
  );
}

/** Slår sammen linjer som ligger nærmere enn 3 nm (f.eks. natriumets D-linjer), og beholder den sterkeste. */
function mergeClose(lines: SpectralLine[]): SpectralLine[] {
  const sorted = [...lines].sort((a, b) => a.nm - b.nm);
  const out: SpectralLine[] = [];
  for (const l of sorted) {
    const last = out[out.length - 1];
    if (last && l.nm - last.nm < 3) {
      if (l.I > last.I) out[out.length - 1] = l;
    } else out.push(l);
  }
  return out;
}

/** «Hα (3 → 2)» ved emisjon, «Hα (2 → 3)» ved absorpsjon (elektronet løftes opp). */
function lineName(l: SpectralLine, absorption: boolean): string {
  if (l.from !== undefined && l.to !== undefined) {
    const [a, b] = absorption ? [l.to, l.from] : [l.from, l.to];
    return `${l.name ?? ''} (${a} → ${b})`.trim();
  }
  return l.name ? `${l.name} (${fmt(l.nm, 1)} nm)` : `${fmt(l.nm, 1)} nm`;
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);
}

function explanation(
  mode: Mode,
  el: SpectrumElement,
  sun: boolean,
  cursor: number,
  eV: number,
  hit: SpectralLine | null,
  sunHit: SpectralLine | null,
): ReactNode {
  const name = ELEMENT_NAME[el];
  const at = (
    <>
      Ved markøren er λ = {cursor} nm ({colorName(cursor)}), og hvert foton har energien E = hc/λ = {fmt(eV, 2)} eV.
    </>
  );
  let main: ReactNode;
  if (mode === 'kontinuerlig') {
    main = (
      <>
        <strong>Kontinuerlig spekter.</strong> Et glødende fast stoff eller en tett gass, som overflaten til sola, sender ut alle
        bølgelengder, så fargene går over i hverandre uten hull. {at} Fiolett lys har mest energi per foton, rødt minst.
      </>
    );
  } else if (mode === 'emisjon') {
    main = (
      <>
        <strong>Emisjonsspekter.</strong> En tynn, varm gass av {name} sender bare ut lys med bestemte bølgelengder. Hver linje er fotoner
        fra én overgang mellom to energinivåer, E = hf = E<sub>øvre</sub> − E<sub>nedre</sub>
        {el === 'hydrogen' ? ', her Balmer-serien ned til n = 2' : ''}. {hitText(hit)} Linjemønsteret er et fingeravtrykk: ingen andre
        grunnstoffer har akkurat de samme linjene.
      </>
    );
  } else {
    main = (
      <>
        <strong>Absorpsjonsspekter.</strong> Når hvitt lys går gjennom en gass av {name} som er kaldere enn lyskilden, tar atomene bare opp
        fotoner med nøyaktig den energien som passer til et sprang mellom to nivåer. De bølgelengdene mangler i lyset som slipper gjennom,
        og vi ser mørke linjer på nøyaktig samme plass som de lyse linjene i emisjonsspekteret. {hitText(hit, true)} {absorptionNote(el)}
      </>
    );
  }

  let sunText: ReactNode = null;
  if (sun) {
    if (mode === 'kontinuerlig')
      sunText = (
        <>
          Sollyset ser nesten kontinuerlig ut, men har mørke linjer: gassen i atmosfæren til sola absorberer bestemte bølgelengder.
          {sunHit?.element ? ` Markøren står på en linje fra ${SUN_ELEMENT_NAMES[sunHit.element] ?? sunHit.element}.` : ''}
        </>
      );
    else if (el === 'hydrogen')
      sunText = (
        <>
          Sollyset har mørke linjer fordi gassen i atmosfæren til sola absorberer. Hydrogenlinjene Hα, Hβ, Hγ og Hδ finnes blant dem, så
          sola inneholder hydrogen. Slik finner vi ut hva fjerne stjerner består av.
        </>
      );
    else if (el === 'natrium')
      sunText = (
        <>
          Sollyset har mørke linjer fordi gassen i atmosfæren til sola absorberer. De to mørke linjene ved 589 nm passer nøyaktig med
          natrium, så det finnes natrium i sola. Slik finner vi ut hva fjerne stjerner består av.
        </>
      );
    else if (el === 'helium')
      sunText = (
        <>
          Helium gir ingen tydelige mørke linjer i sollyset: de synlige heliumlinjene starter i nivåer høyt over grunntilstanden, og selv
          ved overflaten til sola er nesten ingen heliumatomer i disse nivåene. Men under en solformørkelse i 1868 så man en lys gul linje ved 588 nm i
          lyset fra de ytterste gasslagene til sola. Den passet ikke med noe kjent grunnstoff, og slik ble helium oppdaget før det var
          funnet på jorda. Navnet kommer fra helios, det greske ordet for sol.
        </>
      );
    else
      sunText = (
        <>Ingen av kvikksølvlinjene passer med de mørke linjene i sollyset, så vi ser ikke spor av kvikksølv i sola på denne måten.</>
      );
  }
  return (
    <>
      <p>{main}</p>
      {sunText && <p>{sunText}</p>}
    </>
  );
}

/**
 * Forenklingen i absorpsjonsspekteret: en gass tar bare opp lys i sprang fra nivåer der det faktisk er atomer, og i en
 * kald gass er nesten alle i grunntilstanden.
 */
function absorptionNote(el: SpectrumElement): ReactNode {
  if (el === 'hydrogen')
    return (
      <>
        (Forenklet: de synlige linjene er sprang fra n = 2. I en kald hydrogengass er nesten alle atomene i n = 1, og da tas bare
        ultrafiolett lys opp. I atmosfæren til sola er gassen så varm at en liten andel av atomene er i n = 2, og fordi det er så
        mye hydrogen der, blir linjene likevel tydelige.)
      </>
    );
  if (el === 'natrium')
    return <>De gule D-linjene er sprang fra grunntilstanden, så selv en ganske kald natriumdamp tar opp lys ved 589 nm.</>;
  return (
    <>
      (Forenklet: de synlige linjene til {ELEMENT_NAME[el]} starter i nivåer høyt over grunntilstanden, så de blir bare tydelige i
      absorpsjon når gassen er svært varm.)
    </>
  );
}

function hitText(hit: SpectralLine | null, absorption = false): ReactNode {
  if (!hit) return null;
  if (hit.from !== undefined && hit.to !== undefined)
    return absorption ? (
      <>
        Markøren står på {hit.name}: fotonet løfter elektronet fra n = {hit.to} til n = {hit.from}.
      </>
    ) : (
      <>
        Markøren står på {hit.name}, overgangen fra n = {hit.from} til n = {hit.to}.
      </>
    );
  return hit.name ? (
    <>
      Markøren står på {hit.name}-linja ved {fmt(hit.nm, 1)} nm.
    </>
  ) : (
    <>Markøren står på linja ved {fmt(hit.nm, 1)} nm.</>
  );
}
