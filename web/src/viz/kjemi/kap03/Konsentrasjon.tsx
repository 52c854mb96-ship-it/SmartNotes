import { useId, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Partikler,
  Readout,
  Readouts,
  Select,
  Slider,
  Sub,
  TFormel,
  TSub,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtSig,
  formula,
  formulaText,
  mixColor,
  molarMass,
  useContainerTextScale,
  type Box,
  type ParticleGroup,
} from '../kit';
import { FLASKS, PIPETTES, SOLUTES, dilution, ladder, solutionInfo, type SolutionInfo, type Solute } from './model';

/** Stamløsningen lages i 100–1000 mL (i 50 mL ville de største massene ikke løst seg). */
const STOCK_FLASKS = FLASKS.filter((v) => v >= 100);
/** Masser med «pene» verdier fra 0,01 g. */
const MASSES = ladder(-2, 2);
/** Konsentrasjon per prikk i utsnittet (mol/L) og flest prikker per partikkeltype. */
const C_PER_DOT = 0.025;
const MAX_DOTS = 25;
/** Kobber(II)ioner i vann er blå. Fargen blandes fra kit-ets blåtoner (ingen egne fargekoder). */
const CU_BLUE = mixColor(KJEMI.indicator.btbBasisk, KJEMI.ph[4]!, 0.45);
/** Konsentrasjonen (mol/L) som gir absorbans 1 i figuren. */
const C_ABS1 = 0.25;

/** Tall med høyst tre gjeldende siffer uten unødvendige nuller: 4 → «4», 2,5 → «2,5», 6,667 → «6,67». */
function fmtTrim(v: number): string {
  const r = Number(v.toPrecision(3));
  return fmt(r, (String(r).split('.')[1] ?? '').length);
}

/** Fargestyrke etter Beer–Lamberts lov: andelen lys som absorberes er 1 − 10^(−A), og A er proporsjonal med c. */
const liquidFor = (s: Solute, c: number) => (s.colored ? mixColor(KJEMI.liquid, CU_BLUE, (1 - 10 ** (-c / C_ABS1)) * 0.92) : KJEMI.liquid);

export default function Konsentrasjon() {
  const [sid, setSid] = useState(SOLUTES[0]!.id);
  const s = SOLUTES.find((x) => x.id === sid) ?? SOLUTES[0]!;
  const masses = MASSES.filter((m) => m <= s.mMax + 1e-9);
  const [mi, setMi] = useState(MASSES.indexOf(5));
  const [vi, setVi] = useState(STOCK_FLASKS.indexOf(250));
  const [p1, setP1] = useState(PIPETTES.indexOf(25));
  const [v2i, setV2i] = useState(FLASKS.indexOf(100));
  const [ref, f] = useContainerTextScale<HTMLDivElement>();

  const m = masses[Math.min(mi, masses.length - 1)] ?? 1;
  const V = STOCK_FLASKS[vi] ?? 250;
  const V1 = PIPETTES[p1] ?? 25;
  const V2 = FLASKS[v2i] ?? 100;
  const M = molarMass(s.formula);
  const sol = solutionInfo(M, m, V, s.densitySlope);
  const dil = dilution(sol.c, V1, V2);
  const sol2 = solutionInfo(M, (m * V1) / V, V2, s.densitySlope);

  const choose = (id: string) => {
    const next = SOLUTES.find((x) => x.id === id) ?? s;
    setSid(id);
    // Behold massen hvis den finnes for det nye stoffet, ellers den største som er lov.
    const allowed = MASSES.filter((x) => x <= next.mMax + 1e-9);
    setMi(Math.min(mi, allowed.length - 1));
  };

  // På mobil tegnes figuren i en smalere viewBox (440 bred), så glassene og prikkene blir store nok.
  const narrow = f > 1.3;
  const fi = narrow ? 1 : f;
  const L = sceneLayout(narrow, fi);

  return (
    <VizLayout>
      <Toolbar>
        <Select
          label="Stoff"
          value={sid}
          onChange={choose}
          options={SOLUTES.map((x) => ({
            value: x.id,
            label: `${x.name} (${formulaText(x.formula)})`,
          }))}
        />
      </Toolbar>
      <Controls>
        <Slider
          label={
            <>
              Masse m(
              <Formel f={s.formula} />)
            </>
          }
          ariaLabel="Masse stoff"
          value={Math.min(mi, masses.length - 1)}
          onChange={setMi}
          min={0}
          max={masses.length - 1}
          step={1}
          format={(i) => `${fmtSig(masses[i] ?? 1, 2)} g`}
        />
        <Slider label="Målekolbe V" value={vi} onChange={setVi} min={0} max={STOCK_FLASKS.length - 1} step={1} format={(i) => `${fmt(STOCK_FLASKS[i] ?? 250, 0)} mL`} />
        <Slider
          label={
            <>
              Pipette V<Sub>1</Sub>
            </>
          }
          ariaLabel="Pipettevolum"
          value={p1}
          onChange={setP1}
          min={0}
          max={PIPETTES.length - 1}
          step={1}
          format={(i) => `${fmt(PIPETTES[i] ?? 25, 0)} mL`}
        />
        <Slider
          label={
            <>
              Ny målekolbe V<Sub>2</Sub>
            </>
          }
          ariaLabel="Volum etter fortynning"
          value={v2i}
          onChange={setV2i}
          min={0}
          max={FLASKS.length - 1}
          step={1}
          format={(i) => `${fmt(FLASKS[i] ?? 100, 0)} mL`}
        />
      </Controls>

      <div ref={ref}>
        <Figure
          viewBox={`0 0 ${L.W} ${L.H}`}
          label={`${fmtSig(m, 2)} g ${s.name} løst til ${fmt(V, 0)} mL gir ${fmtSig(sol.c)} mol/L. ${fmt(V1, 0)} mL av løsningen fortynnet til ${fmt(V2, 0)} mL gir ${fmtSig(dil.c2)} mol/L.`}
          caption={`Prikkene viser et like stort utsnitt av hver løsning, så tettheten viser konsentrasjonen: hver prikk er ${fmt(C_PER_DOT, 3)} mol/L (høyst ${MAX_DOTS} av hver). Vannmolekylene er ikke tegnet.`}
          maxHeight={L.H}
        >
          <Scene s={s} m={m} V={V} V1={V1} V2={V2} c1={sol.c} c2={dil.c2} L={L} f={fi} />
        </Figure>
      </div>
      <Legend
        items={
          s.ions
            ? s.ions.map((ion) => ({
                color: formula(ion.formula).charge > 0 ? KJEMI.plus : KJEMI.minus,
                label: (
                  <span>
                    <Formel f={ion.formula} state="aq" /> ({formula(ion.formula).charge > 0 ? 'positivt ion' : 'negativt ion'})
                  </span>
                ),
              }))
            : [{ color: KJEMI.molecule, label: <span>glukosemolekyler (<Formel f={s.formula} />)</span> }]
        }
      />

      <Readouts>
        <Readout
          label={
            <>
              Konsentrasjon c<Sub>1</Sub>
            </>
          }
          value={fmtSig(sol.c)}
          unit="mol/L"
          tone={VIZ.series[0]}
        />
        <Readout label="Massekonsentrasjon" value={fmtSig(sol.gPerL)} unit="g/L" />
        <Readout label="Masseprosent" value={fmtSig(sol.massPercent)} unit="%" />
        <Readout
          label={
            <>
              Etter fortynning c<Sub>2</Sub>
            </>
          }
          value={fmtSig(dil.c2)}
          unit="mol/L"
          tone={VIZ.series[0]}
        />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          n = m / M = {fmtSig(m)} g / {fmt(M, 2)} g/mol = {fmtSig(sol.n)} mol
        </FormulaLine>
        <FormulaLine>
          c<Sub>1</Sub> = n / V = {fmtSig(sol.n)} mol / {fmt(V / 1000, 3)} L = {fmtSig(sol.c)} mol/L
        </FormulaLine>
        <FormulaLine>
          m / V = {fmtSig(m)} g / {fmt(V / 1000, 3)} L = {fmtSig(sol.gPerL)} g/L = {fmtSig(sol.mgPerL)} mg/L
        </FormulaLine>
        <FormulaLine>
          masseprosent = m / m(løsning) · 100 % = {fmtSig(m)} g / {fmtSig(sol.mSolution, 4)} g · 100 % = {fmtSig(sol.massPercent)} % = {fmtSig(sol.ppm)} ppm
        </FormulaLine>
        <FormulaLine>
          c<Sub>1</Sub>V<Sub>1</Sub> = c<Sub>2</Sub>V<Sub>2</Sub> → c<Sub>2</Sub> = {fmtSig(sol.c)} mol/L · {fmt(V1, 0)} mL / {fmt(V2, 0)} mL = {fmtSig(dil.c2)} mol/L ={' '}
          {fmtSig(sol2.mgPerL)} mg/L
        </FormulaLine>
      </Formula>

      <Explain>{explanation(s, m, V, V1, V2, sol, sol2, dil)}</Explain>
    </VizLayout>
  );
}

/* ---------- Figur ---------- */

interface SceneLayout {
  narrow: boolean;
  W: number;
  R: number;
  neckW: number;
  neckH: number;
  top: number;
  cx1: number;
  cx2: number;
  px: number;
  /** Sentrum av kulene. */
  cy: number;
  bottom: number;
  /** Utsnitt under glassene (bare på mobil). */
  zoomY: number;
  zoomR: number;
  textY: number;
  H: number;
}

function sceneLayout(narrow: boolean, f: number): SceneLayout {
  const top = 30 * f + 14;
  if (!narrow) {
    const R = 92;
    const neckH = 112;
    const cy = top + neckH + 0.95 * R;
    const bottom = cy + 0.8 * R;
    const textY = bottom + 34 * f;
    return {
      narrow,
      W: 800,
      R,
      neckW: 32,
      neckH,
      top,
      cx1: 175,
      cx2: 625,
      px: 400,
      cy,
      bottom,
      zoomY: 0,
      zoomR: 0,
      textY,
      H: Math.round(textY + 2 * 28 * f + 10),
    };
  }
  const R = 58;
  const neckH = 74;
  const cy = top + neckH + 0.95 * R;
  const bottom = cy + 0.8 * R;
  const zoomR = 96;
  const zoomY = bottom + 30 + zoomR;
  const textY = zoomY + zoomR + 30 * f;
  return {
    narrow,
    W: 440,
    R,
    neckW: 22,
    neckH,
    top,
    cx1: 82,
    cx2: 358,
    px: 220,
    cy,
    bottom,
    zoomY,
    zoomR,
    textY,
    H: Math.round(textY + 2 * 26 * f + 12),
  };
}

function dotGroups(s: Solute, c: number): ParticleGroup[] {
  const dots = Math.min(MAX_DOTS, Math.round(c / C_PER_DOT));
  // Lys kant rundt prikkene, så de synes også i en farget (blå) løsning.
  if (!s.ions) return [{ n: dots, r: 4.2, fill: KJEMI.molecule, line: VIZ.surface }];
  return s.ions.map((ion) => {
    const q = formula(ion.formula).charge;
    return { n: dots * ion.count, r: q > 0 ? 4 : 5, fill: q > 0 ? KJEMI.plus : KJEMI.minus, line: VIZ.surface };
  });
}

/** Prikkene i utsnittet, eller en merknad når løsningen er for fortynnet til å gi én prikk. */
function Dots({ box, groups, seed }: { box: Box; groups: ParticleGroup[]; seed: number }) {
  if (groups.every((g) => g.n === 0))
    return (
      <Txt x={box.x + box.w / 2} y={box.y + box.h / 2 + 5} size={0.75} muted>
        for fortynnet
      </Txt>
    );
  return <Partikler box={box} groups={groups} seed={seed} />;
}

/** Målekolbe: kule med flat bunn, lang hals og et kalibreringsmerke. Fylt helt opp til merket. */
function Malekolbe({
  cx,
  L,
  liquid,
  label,
  labelLeft,
  children,
}: {
  cx: number;
  L: SceneLayout;
  liquid: string;
  label: string;
  /** Etiketten til venstre for halsen (kolben helt til høyre på mobil, så «1 000 mL» får plass). */
  labelLeft?: boolean;
  children?: (box: Box) => ReactNode;
}) {
  const id = `kj-kolbe${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { R, neckW, top, cy } = L;
  const hw = neckW / 2;
  const join = cy - Math.sqrt(R * R - hw * hw);
  const by = cy + 0.8 * R;
  const bx = 0.6 * R;
  const outline = `M${cx - hw - 4},${top} L${cx - hw},${top + 4} L${cx - hw},${join} A${R},${R} 0 0 0 ${cx - bx},${by} L${cx + bx},${by} A${R},${R} 0 0 0 ${cx + hw},${join} L${cx + hw},${top + 4} L${cx + hw + 4},${top}`;
  const mark = top + L.neckH * 0.32;
  const s = R * 1.2;
  const box: Box = { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
  return (
    <g>
      <clipPath id={id}>
        <path d={`${outline} Z`} />
      </clipPath>
      <path d={`${outline} Z`} fill={KJEMI.glassFill} />
      <g clipPath={`url(#${id})`}>
        <rect x={cx - R - 2} y={mark} width={2 * R + 4} height={by - mark + 2} fill={liquid} />
        <line x1={cx - hw} y1={mark} x2={cx + hw} y2={mark} stroke={KJEMI.liquidLine} strokeWidth={2} />
        {children?.(box)}
      </g>
      <ellipse
        cx={cx - R * 0.45}
        cy={cy - R * 0.35}
        rx={R * 0.12}
        ry={R * 0.3}
        transform={`rotate(30 ${cx - R * 0.45} ${cy - R * 0.35})`}
        fill={KJEMI.glassShine}
      />
      <path d={outline} fill="none" stroke={KJEMI.glass} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Kalibreringsmerket går rundt halsen */}
      <line x1={cx - hw - 3} y1={mark} x2={cx + hw + 3} y2={mark} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={labelLeft ? cx - hw - 10 : cx + hw + 10} y={mark + 6} anchor={labelLeft ? 'end' : 'start'} size={0.85} weight={700}>
        {label}
      </Txt>
    </g>
  );
}

/** Fullpipette: rør med en kule på midten og ett merke over kula. */
function Pipette({ x, y, h, liquid, volume, f }: { x: number; y: number; h: number; liquid: string; volume: number; f: number }) {
  const stem = 5.5;
  const bulbRx = 17;
  const bulbRy = h * 0.17;
  const bulbCy = y + h * 0.5;
  const tip = y + h;
  const mark = y + h * 0.2;
  const shape = `M${x - stem},${y} L${x - stem},${bulbCy - bulbRy + 4} Q${x - bulbRx},${bulbCy - bulbRy + 6} ${x - bulbRx},${bulbCy} Q${x - bulbRx},${bulbCy + bulbRy - 6} ${x - stem},${bulbCy + bulbRy - 4} L${x - stem},${tip - 26} L${x - 1.5},${tip} L${x + 1.5},${tip} L${x + stem},${tip - 26} L${x + stem},${bulbCy + bulbRy - 4} Q${x + bulbRx},${bulbCy + bulbRy - 6} ${x + bulbRx},${bulbCy} Q${x + bulbRx},${bulbCy - bulbRy + 6} ${x + stem},${bulbCy - bulbRy + 4} L${x + stem},${y}`;
  const id = `kj-pip${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <g>
      <clipPath id={id}>
        <path d={`${shape} Z`} />
      </clipPath>
      <path d={`${shape} Z`} fill={KJEMI.glassFill} />
      <rect x={x - bulbRx - 2} y={mark} width={2 * bulbRx + 4} height={tip - mark} fill={liquid} clipPath={`url(#${id})`} />
      <path d={shape} fill="none" stroke={KJEMI.glass} strokeWidth={2} strokeLinejoin="round" />
      <line x1={x - stem - 4} y1={mark} x2={x + stem + 4} y2={mark} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={x + stem + 10} y={mark + 6} anchor="start" size={0.85} weight={700}>
        {fmt(volume, 0)} mL
      </Txt>
      <Txt x={x} y={y - 12 * f} size={0.85} muted>
        pipette
      </Txt>
    </g>
  );
}

function Scene({
  s,
  m,
  V,
  V1,
  V2,
  c1,
  c2,
  L,
  f,
}: {
  s: Solute;
  m: number;
  V: number;
  V1: number;
  V2: number;
  c1: number;
  c2: number;
  L: SceneLayout;
  f: number;
}) {
  const liq1 = liquidFor(s, c1);
  const liq2 = liquidFor(s, c2);
  const g1 = dotGroups(s, c1);
  const g2 = dotGroups(s, c2);
  const dish = { x: L.narrow ? 30 : 36, y: L.top + 8 };
  const pipTop = L.top + 20;
  const pipH = L.bottom - pipTop - 12;
  const arrowY = L.cy - 10;
  const arrow = (x1: number, x2: number) => (
    <g>
      <line x1={x1} y1={arrowY} x2={x2 - 12} y2={arrowY} stroke={VIZ.muted} strokeWidth={2.5} />
      <polygon points={`${x2},${arrowY} ${x2 - 13},${arrowY - 7} ${x2 - 13},${arrowY + 7}`} fill={VIZ.muted} />
    </g>
  );
  const texts = (cx: number, title: string, line2: ReactNode, c: number, idx: 1 | 2) => (
    <g>
      <Txt x={cx} y={L.textY} muted size={L.narrow ? 0.95 : 0.85}>
        {title}
      </Txt>
      <Txt x={cx} y={L.textY + 26 * f} weight={700} color={VIZ.series[0]} size={L.narrow ? 0.95 : 1}>
        c<TSub>{idx}</TSub> = {fmtSig(c)} mol/L
      </Txt>
      <Txt x={cx} y={L.textY + 50 * f} size={L.narrow ? 0.9 : 0.8} muted>
        {line2}
      </Txt>
    </g>
  );
  return (
    <g>
      {/* Veieskål med stoffet (på mobil står massen i teksten under) */}
      {!L.narrow && (
        <g>
          <ellipse cx={dish.x + 40} cy={dish.y + 22} rx={40} ry={9} fill={VIZ.body} stroke={VIZ.muted} strokeWidth={1.5} />
          <path
            d={`M${dish.x + 40 - 8 - 14 * Math.min(1, m / 10)},${dish.y + 20} Q${dish.x + 40},${dish.y + 6 - 12 * Math.min(1, m / 10)} ${dish.x + 40 + 8 + 14 * Math.min(1, m / 10)},${dish.y + 20} Z`}
            fill={VIZ.surface}
            stroke={VIZ.muted}
            strokeWidth={1.2}
          />
          <Txt x={dish.x + 40} y={dish.y + 52 * Math.max(1, f * 0.9)} size={0.8} weight={650}>
            {fmtSig(m, 2)} g <TFormel f={s.formula} />
          </Txt>
          <path
            d={`M${dish.x + 84},${dish.y + 18} Q${L.cx1 - 40},${dish.y - 6} ${L.cx1 - L.neckW / 2 - 8},${L.top + 12}`}
            fill="none"
            stroke={VIZ.muted}
            strokeWidth={1.8}
            strokeDasharray="5 4"
          />
        </g>
      )}

      <Malekolbe cx={L.cx1} L={L} liquid={liq1} label={`${fmt(V, 0)} mL`}>
        {L.narrow ? undefined : (box) => <Dots box={box} groups={g1} seed={7} />}
      </Malekolbe>
      <Malekolbe cx={L.cx2} L={L} liquid={liq2} label={`${fmt(V2, 0)} mL`} labelLeft={L.narrow}>
        {L.narrow ? undefined : (box) => <Dots box={box} groups={g2} seed={9} />}
      </Malekolbe>
      <Pipette x={L.px} y={pipTop} h={pipH} liquid={liq1} volume={V1} f={f} />
      {arrow(L.cx1 + L.R + 8, L.px - 26)}
      {arrow(L.px + 26, L.cx2 - L.R - 8)}

      {L.narrow && (
        <g>
          {[
            { cx: L.cx1, zx: L.W * 0.25, g: g1, liq: liq1, seed: 7 },
            { cx: L.cx2, zx: L.W * 0.75, g: g2, liq: liq2, seed: 9 },
          ].map((z) => {
            const side = L.zoomR * 1.3;
            return (
              <g key={z.zx}>
                <line x1={z.cx} y1={L.bottom + 4} x2={z.zx} y2={L.zoomY - L.zoomR} stroke={KJEMI.glass} strokeWidth={1.5} strokeDasharray="5 5" />
                <circle cx={z.zx} cy={L.zoomY} r={L.zoomR} fill={z.liq} stroke={KJEMI.glass} strokeWidth={2.5} />
                <Dots
                  box={{
                    x: z.zx - side / 2,
                    y: L.zoomY - side / 2,
                    w: side,
                    h: side,
                  }}
                  groups={z.g}
                  seed={z.seed}
                />
              </g>
            );
          })}
        </g>
      )}
      {texts(
        L.narrow ? L.W * 0.25 : L.cx1,
        'Stamløsning',
        L.narrow ? (
          <>
            {fmtSig(m, 2)} g <TFormel f={s.formula} /> i {fmt(V, 0)} mL
          </>
        ) : (
          <>
            {fmtSig(m, 2)} g fylt opp til {fmt(V, 0)} mL
          </>
        ),
        c1,
        1,
      )}
      {texts(
        L.narrow ? L.W * 0.75 : L.cx2,
        L.narrow ? 'Fortynnet' : 'Fortynnet løsning',
        L.narrow ? (
          <>
            {fmt(V1, 0)} mL til {fmt(V2, 0)} mL
          </>
        ) : (
          <>
            {fmt(V1, 0)} mL fylt opp til {fmt(V2, 0)} mL
          </>
        ),
        c2,
        2,
      )}
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(
  s: Solute,
  m: number,
  V: number,
  V1: number,
  V2: number,
  sol: SolutionInfo,
  sol2: SolutionInfo,
  dil: { c2: number; n: number; factor: number },
): ReactNode {
  const F = <Formel f={s.formula} />;
  const dilute = sol.gPerL < 10;
  return (
    <>
      <p>
        <strong>
          c = n / V = {fmtSig(sol.n)} mol / {fmt(V / 1000, 3)} L = {fmtSig(sol.c)} mol/L.
        </strong>{' '}
        Først regnes massen om til stoffmengde, n = m/M. Konsentrasjonen er stoffmengde per liter <em>løsning</em>, ikke per liter vann: {fmtSig(m, 2)} g {F}{' '}
        løses i litt vann i målekolben, og så fylles det opp med vann til merket på {fmt(V, 0)} mL.
      </p>
      <p>
        Samme løsning i andre enheter: {fmtSig(sol.gPerL)} g/L = {fmtSig(sol.mgPerL)} mg/L, og masseprosenten er {fmtSig(sol.massPercent)} %.{' '}
        {dilute ? (
          <>
            For en så fortynnet vannløsning er 1 mg/L nesten nøyaktig 1 ppm, fordi 1 L løsning veier omtrent 1 kg. Derfor oppgis forurensning i vann ofte i mg/L
            eller ppm.
          </>
        ) : (
          <>
            1 mg/L er bare omtrent 1 ppm når løsningen er fortynnet. Her er tettheten {fmt(sol.density, 3)} g/mL, så 1 L veier {fmtSig(sol.density * 1000, 4)}{' '}
            g, og ppm-verdien ({fmtSig(sol.ppm)}) blir lavere enn mg/L-verdien.
          </>
        )}
      </p>
      <p>
        <strong>Fortynning:</strong>{' '}
        {dil.factor === 1 ? (
          <>
            Pipetten og den nye kolben har samme volum, så løsningen blir ikke fortynnet: c<Sub>2</Sub> = c<Sub>1</Sub>.
          </>
        ) : (
          <>
            Pipetten flytter {fmt(V1, 0)} mL, altså n = c<Sub>1</Sub> · V<Sub>1</Sub> = {fmtSig(dil.n)} mol, over i den nye kolben. Stoffmengden endres ikke
            når du fyller opp med vann til {fmt(V2, 0)} mL, så c<Sub>1</Sub>V<Sub>1</Sub> = c<Sub>2</Sub>V<Sub>2</Sub> gir c<Sub>2</Sub> = {fmtSig(dil.c2)} mol/L (
            {fmtSig(sol2.mgPerL)} mg/L). Volumet blir {fmtTrim(dil.factor)} ganger så stort, så konsentrasjonen blir {fmtTrim(dil.factor)} ganger så liten.
          </>
        )}
      </p>
      {s.colored && (
        <p>
          Vannfritt <Formel f="CuSO4" /> er et gråhvitt pulver. Den blå fargen kommer fra <Formel f="Cu^2+" state="aq" />, og den blir svakere jo mer løsningen
          fortynnes. Sammenhengen mellom farge og konsentrasjon er grunnlaget for å måle konsentrasjon med spektrofotometer. På skolelaboratoriet veier en ofte
          ut blå krystaller av <Formel f="CuSO4·5H2O" /> i stedet. Da må krystallvannet regnes med i den molare massen (M = {fmt(molarMass('CuSO4·5H2O'), 2)}{' '}
          g/mol), ellers regner du ut en for høy konsentrasjon.
        </p>
      )}
    </>
  );
}
