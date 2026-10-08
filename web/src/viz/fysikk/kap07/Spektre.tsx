import { useMemo, useState, type ReactNode } from 'react';
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
import { Lysstraale, SCENE, Sol, Spektrum, alpha, mix } from '../../kit/scene';
import { placeLabels } from './labels';
import {
  colorName,
  elementLines,
  nearestLine,
  photonFromWavelength,
  strongestLine,
  SPECTRUM_SYMBOL,
  SUN_LINES,
  sunLinesOf,
  VISIBLE_MAX,
  VISIBLE_MIN,
  type SpectralLine,
  type SpectrumElement,
} from './model';
import { textWidthEm, Txt } from './parts';
import {
  BenkeNavn,
  Gasskolbe,
  Glodelampe,
  LabRom,
  Prisme,
  Skjerm,
  SkjermMarkor,
  SkjermSpekter,
  Spalteplate,
  Spektralror,
  Straale,
  Vifte,
  type SceneLine,
} from './spektre-deler';
import { spektreScene, tubeRgb, type SpectrumMode, type SpektreScene } from './spektre-scene';
import { rgbText } from './bohr-scene';
import { useFigureTextScale } from './useNarrow';

type Mode = SpectrumMode;

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

/** Gassen i kolben (absorpsjon). */
const GAS_NAME: Record<SpectrumElement, string> = {
  hydrogen: 'hydrogengass',
  helium: 'heliumgass',
  natrium: 'natriumdamp',
  kvikksolv: 'kvikksølvdamp',
};

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
  const g = useMemo(() => spektreScene(f, mode), [f, mode]);
  const D = diagramLayout(f, sun, mode !== 'kontinuerlig');
  const spectrumName =
    mode === 'kontinuerlig' ? 'Kontinuerlig spekter' : `${mode === 'emisjon' ? 'Emisjonsspekter' : 'Absorpsjonsspekter'} for ${ELEMENT_NAME[el]}`;

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
        <Figure viewBox={`0 0 800 ${g.height}`} label={sceneLabel(mode, el)} maxHeight={480}>
          <LabScene g={g} mode={mode} el={el} lines={lines} cursor={cursor} hit={hit} />
        </Figure>
        <Figure
          viewBox={`0 0 800 ${D.height}`}
          label={`${spectrumName} fra 380 til 750 nm${sun ? ', sammenlignet med sollys' : ''}. Markøren står på ${cursor} nm.`}
          maxHeight={420}
        >
          <SpectrumDiagram mode={mode} el={el} sun={sun} cursor={cursor} lines={lines} L={D} />
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

function sceneLabel(mode: Mode, el: SpectrumElement): string {
  const src =
    mode === 'kontinuerlig'
      ? 'Lys fra en glødelampe'
      : mode === 'emisjon'
        ? `Lys fra et spektralrør med ${ELEMENT_NAME[el]}`
        : `Lys fra en glødelampe gjennom en kolbe med kald ${GAS_NAME[el]}`;
  const result =
    mode === 'kontinuerlig'
      ? 'et sammenhengende fargebånd fra rødt til fiolett'
      : mode === 'emisjon'
        ? 'noen få fargede linjer'
        : 'et fargebånd med mørke linjer';
  return `${src} går gjennom en spalte og et glassprisme i en mørk skolelab. Prismet sprer lyset, og på skjermen blir det ${result}.`;
}

/* ---------- Scenen ---------- */

function LabScene({
  g,
  mode,
  el,
  lines,
  cursor,
  hit,
}: {
  g: SpektreScene;
  mode: Mode;
  el: SpectrumElement;
  lines: SpectralLine[];
  cursor: number;
  hit: SpectralLine | null;
}) {
  const tube = rgbText(tubeRgb(el));
  const emission = mode === 'emisjon';
  const light = emission ? tube : SCENE.glow;
  // Linjer som ligger tettere enn 1,5 nm (natriumets D-linjer), blir én stråle i scenen.
  const sceneLines: SceneLine[] = mode === 'kontinuerlig' ? [] : mergeClose(lines, 1.5).map((l) => ({ nm: l.nm, I: l.I }));
  const mark = hit ? (sceneLines.find((l) => Math.abs(l.nm - hit.nm) < 1.6)?.nm ?? null) : null;
  const p = g.prism;
  const dir = { x: p.inPt.x - g.src.x, y: p.inPt.y - g.src.y };
  const len = Math.hypot(dir.x, dir.y);
  const u = { x: dir.x / len, y: dir.y / len };
  const start = emission ? 0.006 * g.S : (30 / 108) * g.bulbSize;
  const from = { x: g.src.x + u.x * start, y: g.src.y + u.y * start };
  const slit = { x: g.slit.x, y: g.slit.y };
  return (
    <LabRom g={g} light={light}>
      {emission ? <Spektralror g={g} glow={tube} symbol={SPECTRUM_SYMBOL[el]} /> : <Glodelampe g={g} />}
      {/* Lyset fra kilden fram til spalten (svakere: bare litt av det går gjennom) */}
      {emission ? (
        <Straale from={from} to={slit} color={tube} width={4.5} strength={0.75} />
      ) : (
        <Lysstraale x1={from.x} y1={from.y} x2={slit.x} y2={slit.y} hvit bredde={4.5} styrke={0.8} pil={mode !== 'absorpsjon'} />
      )}
      {mode === 'absorpsjon' && <Gasskolbe g={g} tintColor={rgbText(tubeRgb(el))} />}
      <Spalteplate g={g} lit={emission ? tube : mix(SCENE.star, SCENE.glow, 0.4)} />
      {emission ? (
        <Straale from={slit} to={p.inPt} color={tube} width={2.6} />
      ) : (
        <Lysstraale x1={slit.x} y1={slit.y} x2={p.inPt.x} y2={p.inPt.y} hvit bredde={2.6} />
      )}
      <Skjerm g={g}>
        <SkjermSpekter g={g} mode={mode} lines={sceneLines} mark={mark} />
      </Skjerm>
      <Prisme g={g} />
      {/* Inne i glasset går lyset vannrett (minste avbøyning) */}
      <line
        x1={p.inPt.x}
        y1={p.inPt.y}
        x2={p.outPt.x}
        y2={p.outPt.y}
        stroke={emission ? tube : alpha(SCENE.star, 0.9)}
        strokeWidth={2.4 * Math.min(g.k, 1.3)}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Vifte g={g} mode={mode} lines={sceneLines} mark={mark} />
      <SkjermMarkor g={g} nm={cursor} />
      <BenkeNavn g={g} />
    </LabRom>
  );
}

/* ---------- Diagrammet under scenen ---------- */

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
  height: number;
}

function diagramLayout(f: number, sun: boolean, labels: boolean): Layout {
  const title = 26 * f;
  // To rader med bølgelengder over linjene (ikke i det kontinuerlige spekteret)
  const row1 = title + 30 * f;
  const row0 = row1 + 24 * f;
  // Plass til markørtrekanten over spekteret (den vokser litt på mobil), så den ikke går inn i etikettene
  const tri = Math.min(Math.max(1, f), 1.5);
  const barTop = (labels ? row0 + 10 : title + 16) + 13 * tri;
  const barH = 62 + 24 * f;
  const tickY = barTop + barH + 30 + 17 * f;
  const axisTitle = tickY + 26 * f;
  const sunTitle = axisTitle + 40 * f;
  const sunTop = sunTitle + 14;
  const sunH = 44 + 18 * f;
  const height = Math.round(sun ? sunTop + sunH + 16 + 12 * tri : axisTitle + 14);
  return { title, row1, row0, barTop, barH, tickY, axisTitle, sunTitle, sunTop, sunH, height };
}

function SpectrumDiagram({
  mode,
  el,
  sun,
  cursor,
  lines,
  L,
}: {
  mode: Mode;
  el: SpectrumElement;
  sun: boolean;
  cursor: number;
  lines: SpectralLine[];
  /** Plasseringen, regnet ut med den samme tekstskalaen som høyden. */
  L: Layout;
}) {
  const fReal = useTextScale();
  // Etiketter over linjene (de sterkeste), i to rader så de ikke overlapper. Hydrogen: de fire Balmer-linjene øyet ser
  // tydelig (Hα–Hδ), ikke de svake under 400 nm.
  const labelled = mode === 'kontinuerlig' ? [] : mergeClose(lines.filter(hasLabel));
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
  const sunR = 9 * tri;

  return (
    <>
      <Txt x={X0} y={L.title} anchor="start" muted>
        {title}
      </Txt>

      {/* Spekteret: de samme fargene som på skjermen i scenen, lagt vannrett med en bølgelengdeskala */}
      <Spektrum
        x={X0}
        y={L.barTop}
        w={X1 - X0}
        h={L.barH}
        type={mode}
        linjer={mode === 'kontinuerlig' ? [] : lines.map((l) => ({ nm: l.nm, styrke: l.I }))}
      />

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
          <Spektrum
            x={X0}
            y={L.sunTop}
            w={X1 - X0}
            h={L.sunH}
            type="absorpsjon"
            linjer={SUN_LINES.map((l) => ({ nm: l.nm, styrke: l.I }))}
          />
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
                <path d={`M${sx(l.nm)},${L.sunTop + L.sunH + 4} l${-6 * tri},${10 * tri} h${12 * tri} z`} fill={VIZ.ink} />
              </g>
            ))}
          <Sol x={X0 + sunR} y={L.sunTitle - 6 * tri} r={sunR} korona={0.35} flekker={0} />
          <Txt x={X0 + 2 * sunR + 8} y={L.sunTitle} anchor="start" muted>
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

/** Linjer som får bølgelengden skrevet over seg: de sterke, og hydrogenlinjene som ikke er svake. */
function hasLabel(l: SpectralLine): boolean {
  if (l.faint) return false;
  return l.from !== undefined || l.I >= 0.3;
}

/** Slår sammen linjer som ligger nærmere enn `gap` nm (f.eks. natriumets D-linjer), og beholder den sterkeste. */
function mergeClose(lines: SpectralLine[], gap = 3): SpectralLine[] {
  const sorted = [...lines].sort((a, b) => a.nm - b.nm);
  const out: SpectralLine[] = [];
  for (const l of sorted) {
    const last = out[out.length - 1];
    if (last && l.nm - last.nm < gap) {
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

/* ---------- Forklaringen ---------- */

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
  let practical: ReactNode = null;
  if (mode === 'kontinuerlig') {
    main = (
      <>
        <strong>Kontinuerlig spekter.</strong> Glødetråden i lampa er et fast stoff som er over {'2\u00a0000\u00a0°C'} varmt. Et glødende fast stoff eller
        en tett gass, som overflaten til sola, sender ut alle bølgelengder, så prismet sprer lyset til et fargebånd uten hull. {at} Fiolett
        lys brytes mest i prismet og har mest energi per foton, rødt brytes minst og har minst energi.
      </>
    );
    practical = (
      <>
        Det er derfor en regnbue har fargene i samme rekkefølge som spekteret på skjermen: vanndråpene sorterer sollyset etter
        bølgelengde, akkurat som prismet. (I figuren er spredningen forstørret: i et vanlig glassprisme er det bare 1–2 grader mellom
        rødt og fiolett.)
      </>
    );
  } else if (mode === 'emisjon') {
    main = (
      <>
        <strong>Emisjonsspekter.</strong> Høy spenning over spektralrøret får den tynne gassen av {name} til å lyse. Atomene sender bare ut
        lys med bestemte bølgelengder, så prismet gir noen få fargede linjer på skjermen i stedet for et fargebånd. Hver linje er fotoner
        fra én overgang mellom to energinivåer, E = hf = E<sub>øvre</sub> − E<sub>nedre</sub>
        {el === 'hydrogen' ? ', her Balmer-serien ned til n = 2' : ''}. {hitText(hit)} Linjemønsteret er et fingeravtrykk: ingen andre
        grunnstoffer har akkurat de samme linjene.
      </>
    );
    practical = emissionPractical(el);
  } else {
    main = (
      <>
        <strong>Absorpsjonsspekter.</strong> Hvitt lys fra glødelampa går gjennom en kolbe med {GAS_NAME[el]} som er mye kaldere enn
        glødetråden. Atomene tar bare opp fotoner med nøyaktig den energien som passer til et sprang mellom to nivåer. De bølgelengdene
        mangler i lyset som går videre, så det blir mørke linjer i fargebåndet på skjermen, på nøyaktig samme plass som de lyse linjene i
        emisjonsspekteret. {hitText(hit, true)} {absorptionNote(el)}
      </>
    );
    if (!sun)
      practical = (
        <>
          Det er slik vi finner ut hva atmosfæren til sola og stjernene består av: slå på «Sammenlign med sollys» og se etter de samme
          mørke linjene.
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
          ved overflaten til sola er nesten ingen heliumatomer i disse nivåene. Men under en solformørkelse i 1868 så man en lys gul linje
          ved 588 nm i lyset fra de ytterste gasslagene til sola. Den passet ikke med noe kjent grunnstoff, og slik ble helium oppdaget
          før det var funnet på jorda. Navnet kommer fra helios, det greske ordet for sol.
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
      {practical && <p>{practical}</p>}
      {sunText && <p>{sunText}</p>}
    </>
  );
}

/** En praktisk kobling for hvert grunnstoff i emisjonsspekteret. */
function emissionPractical(el: SpectrumElement): ReactNode {
  if (el === 'hydrogen')
    return (
      <>
        Det er derfor hydrogenrøret lyser rosa-lilla: øyet ser blandingen av linjene, og den røde Hα-linja er sterkest. Prismet skiller
        dem fra hverandre igjen. Du ser fire tydelige linjer, Hα–Hδ. Linjene under 400 nm (Hε og videre) er så svake og så langt ut
        mot fiolett at øyet knapt ser dem.
      </>
    );
  if (el === 'natrium')
    return (
      <>
        Det er derfor gamle gatelys med natriumdamp lyser gult: nesten alt lyset er de to D-linjene ved 589 nm, så under slike lys ser
        alle farger gule eller grå ut.
      </>
    );
  if (el === 'helium')
    return (
      <>
        Det er derfor lysrørene i reklameskilt har ulike farger: hver gass lyser med sine egne linjer, helium laksrosa og neon
        rødoransje.
      </>
    );
  return (
    <>
      Det er derfor lysstoffrør inneholder kvikksølvdamp: gassen sender ut ultrafiolett lys og noen få synlige linjer, og et hvitt
      lysstoff på innsiden av glasset gjør det ultrafiolette lyset om til synlig lys.
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
        {hit.faint ? ' Linja er svak og knapt synlig for øyet.' : ''}
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
