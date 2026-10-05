import { useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Legend,
  Plot,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  linePath,
  mixColor,
  roundedRectPath,
  sample,
  useContainerTextScale,
  useLineScale,
  useTextScale,
  type BioPaint,
} from '../kit';
import {
  ENZYMES,
  NUTRIENTS,
  STATIONS,
  T_OPT,
  activity,
  activityPH,
  activityT,
  enzymeState,
  fragments,
  nativeFraction,
  type EnzymeId,
  type EnzymeState,
  type Nutrient,
  type StationId,
} from './model';

type Mode = 'kanal' | 'enzym';

const ENZYME_COLOR: Record<EnzymeId, string> = {
  amylase: BIO.sukker,
  pepsin: BIO.signal,
  trypsin: BIO.serie[0],
  lipase: BIO.serie[2],
};

export default function FordoyelseOgEnzymer() {
  const [mode, setMode] = useState<Mode>('kanal');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Velg visning"
          options={[
            { value: 'kanal', label: 'Fordøyelseskanalen' },
            { value: 'enzym', label: 'Enzymaktivitet' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Toolbar>
      {mode === 'kanal' ? <Tract /> : <Enzymes />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* Fordøyelseskanalen                                                       */
/* ====================================================================== */

const NUTRIENT_OPTIONS: { value: Nutrient; label: string }[] = [
  { value: 'stivelse', label: 'Stivelse' },
  { value: 'protein', label: 'Proteiner' },
  { value: 'fett', label: 'Fett' },
];

function Tract() {
  const [nutrient, setNutrient] = useState<Nutrient>('stivelse');
  const [station, setStation] = useState(2);
  const st = STATIONS[station]!;
  const d = st.digested[nutrient];
  const enz = st.enzymes[nutrient];
  const info = NUTRIENTS[nutrient];
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const absorbedHere = st.absorbs;
  const short = enz.length === 0 ? 'Ingen' : `${capitalize(enz[0]!.split(' (')[0]!)}${enz.length > 1 ? ' m.fl.' : ''}`;
  return (
    <>
      <Toolbar>
        <Segmented label="Næringsstoff" options={NUTRIENT_OPTIONS} value={nutrient} onChange={setNutrient} />
      </Toolbar>
      <Controls>
        <Slider
          label="Hvor er maten?"
          value={station}
          onChange={setStation}
          min={0}
          max={STATIONS.length - 1}
          step={1}
          format={(v) => STATIONS[v]?.name ?? ''}
        />
      </Controls>
      <div ref={ref}>
        <TractFigure nutrient={nutrient} station={st.id} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.sukker, label: 'Maten (her er den nå)' },
          { color: ENZYME_COLOR.trypsin, label: 'Organ som lager enzymer eller galle til denne delen' },
          { color: BIO.oksygenrikt, label: 'Til blodet' },
          { color: BIO.lipidHode, label: 'Til lymfen' },
        ]}
      />
      <Readouts>
        <Readout label="pH her" value={fmt(st.pH, 0)} />
        <Readout label={`${info.name} brutt ned`} value={fmtPct(d)} />
        <Readout label="Enzymer her" value={short} />
        <Readout
          label="Tas opp"
          value={absorbedHere ? `Til ${info.to}` : station === STATIONS.length - 1 ? 'Vann og salter' : 'Nei, ikke ennå'}
        />
      </Readouts>
      <Explain>{tractText(nutrient, st.id, d)}</Explain>
    </>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tegningen av fordøyelseskanalen (venstre) og molekylene der maten er nå (høyre). */
function TractFigure({ nutrient, station, f }: { nutrient: Nutrient; station: StationId; f: number }) {
  const narrow = f > 1.3;
  const tractH = 470;
  const molH = Math.round(narrow ? 360 + 220 * (f - 1) : 470);
  const H = narrow ? tractH * 1.3 + molH + 20 : tractH;
  const st = STATIONS.find((s) => s.id === station)!;
  return (
    <Figure
      viewBox={`0 0 800 ${Math.round(H)}`}
      maxHeight={narrow ? 1500 : Math.round(H * 1.15)}
      label={`Fordøyelseskanalen med maten i ${st.name.toLowerCase()}. ${NUTRIENTS[nutrient].name}: ${fmtPct(st.digested[nutrient])} brutt ned.`}
    >
      <g transform={narrow ? 'translate(110 0) scale(1.3)' : 'translate(4 0)'}>
        <TractDrawing station={station} nutrient={nutrient} narrow={narrow} />
      </g>
      <g transform={narrow ? `translate(0 ${tractH * 1.3 + 20})` : 'translate(440 0)'}>
        <MoleculePanel nutrient={nutrient} station={station} w={narrow ? 800 : 358} h={molH} />
      </g>
    </Figure>
  );
}

function TractDrawing({ station, nutrient, narrow }: { station: StationId; nutrient: Nutrient; narrow: boolean }) {
  const lw = useLineScale();
  const on = (id: StationId) => id === station;
  const tube = (d: string, active: boolean, key: string) => (
    <g key={key}>
      <path
        d={d}
        fill="none"
        stroke={BIO.er.line}
        strokeWidth={22}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 0.9 : 0.35}
      />
      <path
        d={d}
        fill="none"
        stroke={active ? BIO.golgi.fill : BIO.er.fill}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
  const helper = (paint: BioPaint, active: boolean) => ({
    fill: active ? mixColor(paint.fill, ENZYME_COLOR.trypsin, 0.35) : paint.fill,
    stroke: active ? ENZYME_COLOR.trypsin : paint.line,
    strokeWidth: (active ? 3 : 1.5) * lw,
  });
  // Hjelpeorganer som leverer enzymer eller galle der maten er nå
  const saliva = station === 'munn' && nutrient === 'stivelse';
  const pancreas = station === 'tynntarm';
  const bile = station === 'tynntarm' && nutrient === 'fett';
  // Maten (bolus) der den er nå
  const bolus: Record<StationId, { x: number; y: number }> = {
    munn: { x: 180, y: 42 },
    magesekk: { x: 215, y: 175 },
    tynntarm: { x: 190, y: 330 },
    tykktarm: { x: 300, y: 330 },
  };
  const b = bolus[station];
  const smallIntestine =
    'M200,215 C200,250 150,250 130,265 S150,300 190,295 S260,290 250,315 S180,340 150,340 S140,375 190,372 S250,360 255,385';
  const largeIntestine =
    'M255,400 C290,400 305,395 305,370 L305,245 C305,232 295,228 280,228 L105,228 C90,228 85,235 85,250 L85,400 C85,420 110,425 150,425 L180,425 L180,455';
  const label = (x: number, y: number, text: string, anchor: 'start' | 'end', strong = false) => (
    <Txt x={x} y={y} anchor={anchor} size={narrow ? 0.62 : 0.72} weight={strong ? 750 : 560} muted={!strong}>
      {text}
    </Txt>
  );
  return (
    <g>
      {/* Munn og spiserør */}
      <ellipse
        cx={180}
        cy={40}
        rx={34}
        ry={18}
        fill={on('munn') ? BIO.golgi.fill : BIO.er.fill}
        stroke={BIO.er.line}
        strokeWidth={(on('munn') ? 3 : 1.5) * lw}
      />
      <ellipse cx={240} cy={52} rx={16} ry={10} {...helper(BIO.lysosom, saliva)} />
      {tube('M180,58 L180,140', false, 'spiserør')}
      {/* Lever og galleblære (kroppens høyre side er til venstre i figuren) */}
      <path
        d="M40,150 C40,120 90,108 160,118 C185,122 190,140 175,160 C150,190 80,195 55,180 C44,173 40,162 40,150 Z"
        {...helper(BIO.mitokondrie, bile)}
      />
      <ellipse cx={120} cy={196} rx={14} ry={10} {...helper(BIO.kloroplast, bile)} />
      {/* Magesekk */}
      <path
        d="M180,138 C180,138 200,132 230,140 C270,150 285,185 265,205 C250,220 215,222 205,212"
        fill="none"
        stroke={BIO.er.line}
        strokeWidth={46}
        strokeLinecap="round"
        opacity={on('magesekk') ? 0.9 : 0.35}
      />
      <path
        d="M180,138 C180,138 200,132 230,140 C270,150 285,185 265,205 C250,220 215,222 205,212"
        fill="none"
        stroke={on('magesekk') ? BIO.golgi.fill : BIO.er.fill}
        strokeWidth={38}
        strokeLinecap="round"
      />
      {/* Bukspyttkjertel */}
      <path d="M215,235 C240,226 280,228 300,238 C290,248 250,250 222,246 Z" {...helper(BIO.golgi, pancreas)} />
      {/* Tykktarm og tynntarm */}
      {tube(largeIntestine, on('tykktarm'), 'tykktarm')}
      {tube(smallIntestine, on('tynntarm'), 'tynntarm')}
      <circle cx={b.x} cy={b.y} r={11} fill={BIO.sukker} stroke={VIZ.surface} strokeWidth={2 * lw} />
      {/* Navn */}
      {label(130, 30, 'Munnen', 'end', on('munn'))}
      {label(262, 46, 'Spyttkjertel', 'start', saliva)}
      {label(70, 156, 'Leveren', 'start', bile)}
      {label(100, 214, 'Galleblæren', 'end', bile)}
      {label(300, 160, 'Magesekken', 'start', on('magesekk'))}
      {label(305, 250, 'Bukspyttkjertelen', 'start', pancreas)}
      {label(74, 300, 'Tykktarmen', 'end', on('tykktarm'))}
      {label(270, 300, 'Tynntarmen', 'start', on('tynntarm'))}
      {label(190, 452, 'Endetarmen', 'start')}
      {label(190, 100, 'Spiserøret', 'start')}
    </g>
  );
}

/** Molekylene: kjeder som deles i mindre biter, og opptak i en tarmtott i tynntarmen. */
function MoleculePanel({ nutrient, station, w, h }: { nutrient: Nutrient; station: StationId; w: number; h: number }) {
  const lw = useLineScale();
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  const st = STATIONS.find((s) => s.id === station)!;
  const info = NUTRIENTS[nutrient];
  const d = st.digested[nutrient];
  const pieces = nutrient === 'fett' ? [] : fragments(info.units, d);
  const unit = Math.min(30 * k, (w - 40) / (info.units + 2));
  const head = 30 * f;
  const x0 = 20;
  let x = x0;
  let y = head + (w < 500 ? 44 : 24) * f + 30 + unit / 2;
  const placed: { pieceIndex: number; x: number; y: number; len: number }[] = [];
  pieces.forEach((len, i) => {
    const width = len * unit + 14;
    if (x + width > w - 10) {
      x = x0;
      y += unit + 24;
    }
    placed.push({ pieceIndex: i, x, y, len });
    x += width + 6;
  });
  const enz = st.enzymes[nutrient];
  const absorbed = st.absorbs;
  const after = station === 'tykktarm';
  const villusX = w - 70 * k;
  const villusY = h - 150 * k;
  return (
    <g>
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <Txt x={x0} y={head} anchor="start" weight={700}>
        {`${st.name} (pH ${fmt(st.pH, 0)})`}
      </Txt>
      <Txt x={x0} y={head + 24 * f} anchor="start" size={0.78} muted>
        {enz.length
          ? w < 500
            ? 'Virker her:'
            : `Virker her: ${enz.join(', ')}`
          : after
            ? 'Næringsstoffene er allerede tatt opp'
            : 'Ingen enzymer for dette her'}
      </Txt>
      {enz.length > 0 && w < 500 && (
        <Txt x={x0} y={head + 44 * f} anchor="start" size={0.78} muted>
          {enz.join(', ')}
        </Txt>
      )}
      {after ? (
        <g>
          <Txt x={w / 2} y={h / 2 - 10} size={0.85}>
            Her tas vann og salter opp.
          </Txt>
          <Txt x={w / 2} y={h / 2 + 16} size={0.8} muted>
            Fiber (cellulose) går videre ut.
          </Txt>
        </g>
      ) : nutrient === 'fett' ? (
        <g transform={`translate(0 ${head + (w < 500 ? 44 : 24) * f + 16}) scale(${k})`}>
          <FatMolecules station={station} w={w / k} y={20} lw={lw} ts={1 / k} />
        </g>
      ) : (
        placed.map((p, i) => (
          <g key={i}>
            {p.len > 1 && (
              <line x1={p.x + unit / 2} x2={p.x + (p.len - 0.5) * unit} y1={p.y} y2={p.y} stroke={VIZ.muted} strokeWidth={2.5 * lw} />
            )}
            {Array.from({ length: p.len }, (_, j) => {
              const cx = p.x + (j + 0.5) * unit;
              const idx = placed.slice(0, i).reduce((s, q) => s + q.len, 0) + j;
              return nutrient === 'stivelse' ? (
                <Hexagon key={j} x={cx} y={p.y} r={unit * 0.42} lw={lw} />
              ) : (
                <circle key={j} cx={cx} cy={p.y} r={unit * 0.38} fill={BIO.serie[idx % 4]} stroke={VIZ.surface} strokeWidth={1.2 * lw} />
              );
            })}
          </g>
        ))
      )}
      {!after && nutrient !== 'fett' && (
        <Txt x={x0} y={y + unit + 20} anchor="start" size={0.75} muted>
          {d === 0 ? `${info.name}: lange kjeder` : d >= 1 ? `Ferdig: ${info.product}` : `${fmtPct(d)} brutt ned til mindre biter`}
        </Txt>
      )}
      {absorbed && (
        <g>
          {/* Tarmtott med blodkapillær og lymfeåre (tegnet rundt 0,0 og skalert på mobil) */}
          <g transform={`translate(${villusX} ${villusY}) scale(${k})`}>
            <path d="M-40,130 L-40,30 C-40,-10 40,-10 40,30 L40,130" fill={BIO.cytoplasma} stroke={BIO.membran} strokeWidth={2 * lw} />
            <path d="M-24,128 L-24,35 C-24,10 24,10 24,35 L24,128" fill="none" stroke={BIO.oksygenrikt} strokeWidth={4 * lw} />
            <line x1={0} x2={0} y1={40} y2={128} stroke={BIO.lipidHode} strokeWidth={6 * lw} strokeLinecap="round" />
          </g>
          <Txt x={villusX} y={villusY - 10 * k - 8} size={0.72} muted>
            Tarmtott
          </Txt>
          <Arrow
            x1={villusX - 120 * k}
            y1={villusY + 50 * k}
            x2={nutrient === 'fett' ? villusX - 4 : villusX - 26 * k}
            y2={villusY + 60 * k}
            color={nutrient === 'fett' ? BIO.lipidHode : BIO.oksygenrikt}
            width={4}
            head={11}
          />
          <Txt
            x={villusX - 124 * k}
            y={villusY + 46 * k}
            anchor="end"
            size={0.75}
            weight={650}
            color={nutrient === 'fett' ? BIO.lipidHode : BIO.oksygenrikt}
          >
            {nutrient === 'fett' ? 'til lymfen' : 'til blodet'}
          </Txt>
        </g>
      )}
    </g>
  );
}

function Hexagon({ x, y, r, lw }: { x: number; y: number; r: number; lw: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={BIO.sukker} stroke={VIZ.surface} strokeWidth={1.2 * lw} />;
}

/** Fett: store dråper i magesekken, små dråper (galle) og fettsyrer + glyserol i tynntarmen. */
function FatMolecules({ station, w, y, lw, ts }: { station: StationId; w: number; y: number; lw: number; ts: number }) {
  const tri = (x: number, yy: number, tails: number, key: string) => (
    <g key={key}>
      <rect x={x - 6} y={yy - 22} width={12} height={44} rx={4} fill={BIO.golgi.fill} stroke={BIO.golgi.line} strokeWidth={1.2 * lw} />
      {[-14, 0, 14].slice(0, tails).map((dy, i) => (
        <path
          key={i}
          d={`M${x + 6},${yy + dy} l10,-5 l10,5 l10,-5 l10,5 l10,-5`}
          fill="none"
          stroke={BIO.lipidHode}
          strokeWidth={3 * lw}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
  const freeAcid = (x: number, yy: number, key: string) => (
    <path
      key={key}
      d={`M${x},${yy} l10,-5 l10,5 l10,-5 l10,5 l10,-5`}
      fill="none"
      stroke={BIO.lipidHode}
      strokeWidth={3 * lw}
      strokeLinecap="round"
    />
  );
  if (station === 'munn')
    return (
      <g>
        <circle
          cx={w / 2 - 40}
          cy={y + 50}
          r={58}
          fill={mixColor(BIO.lipidHode, BIO.cytoplasma, 0.6)}
          stroke={BIO.lipidHode}
          strokeWidth={2 * lw}
        />
        {tri(w / 2 - 70, y + 50, 3, 'a')}
        <Txt x={w / 2 - 40} y={y + 132} size={0.75 * ts} muted>
          Fettdråpe: hele triglyserider
        </Txt>
      </g>
    );
  if (station === 'magesekk')
    return (
      <g>
        <circle
          cx={w / 2 - 40}
          cy={y + 50}
          r={58}
          fill={mixColor(BIO.lipidHode, BIO.cytoplasma, 0.6)}
          stroke={BIO.lipidHode}
          strokeWidth={2 * lw}
        />
        {tri(w / 2 - 70, y + 50, 2, 'a')}
        {freeAcid(w / 2 + 40, y + 20, 'f1')}
        <Txt x={w / 2 - 40} y={y + 132} size={0.75 * ts} muted>
          Litt fett brytes ned av magelipase
        </Txt>
      </g>
    );
  // Tynntarmen: galle deler dråpen i små dråper, lipase spalter til fettsyrer og glyserol
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={40 + i * 34}
          cy={y + 30 + (i % 2) * 22}
          r={14}
          fill={mixColor(BIO.lipidHode, BIO.cytoplasma, 0.6)}
          stroke={BIO.lipidHode}
          strokeWidth={1.5 * lw}
        />
      ))}
      <Txt x={20} y={y + 92} anchor="start" size={0.72 * ts} muted>
        Galle: små dråper
      </Txt>
      <rect x={180} y={y + 4} width={12} height={44} rx={4} fill={BIO.golgi.fill} stroke={BIO.golgi.line} strokeWidth={1.2 * lw} />
      <Txt x={186} y={y + 70} size={0.72 * ts} muted>
        glyserol
      </Txt>
      {[0, 1, 2].map((i) => freeAcid(220, y + 8 + i * 18, `fa${i}`))}
      <Txt x={250} y={y + 70} anchor="start" size={0.72 * ts} muted>
        fettsyrer
      </Txt>
    </g>
  );
}

function tractText(n: Nutrient, s: StationId, d: number): ReactNode {
  const texts: Record<Nutrient, Record<StationId, ReactNode>> = {
    stivelse: {
      munn: (
        <p>
          <strong>Stivelse i munnen.</strong> Vi tygger maten i små biter, og spyttet inneholder enzymet amylase, som begynner å bryte ned
          stivelse (lange kjeder av glukose) til maltose. Bare en liten del rekker å bli brutt ned før vi svelger.
        </p>
      ),
      magesekk: (
        <p>
          <strong>Stivelse i magesekken.</strong> Spyttamylasen virker en stund inne i matklumpen, men når magesyren (saltsyre, pH ca. 2)
          har trengt inn, slutter den å virke. Magesekken lager ikke enzymer som bryter ned stivelse. Nå er ca. {fmtPct(d)} brutt ned.
        </p>
      ),
      tynntarm: (
        <p>
          <strong>Stivelse i tynntarmen.</strong> Bukspyttkjertelen sender amylase til tynntarmen, og enzymer i tarmveggen (maltase) deler
          maltose til glukose. Glukose tas opp gjennom tarmtottene og går med blodet via portåra til leveren.
        </p>
      ),
      tykktarm: (
        <p>
          <strong>Tykktarmen.</strong> Glukosen er allerede tatt opp i tynntarmen. I tykktarmen tas vann og salter opp, og bakterier bryter
          ned noe av fiberet vi ikke kan fordøye selv.
        </p>
      ),
    },
    protein: {
      munn: (
        <p>
          <strong>Proteiner i munnen.</strong> Tyggingen deler maten i mindre biter, men det finnes ingen enzymer i spyttet som bryter ned
          proteiner. De lange aminosyrekjedene er hele.
        </p>
      ),
      magesekk: (
        <p>
          <strong>Proteiner i magesekken.</strong> Magesaften inneholder saltsyre og pepsin. Det sure miljøet (pH ca. 2) gjør at proteinene
          folder seg ut, og pepsin, som virker best ved lav pH, deler dem i kortere peptider. Ca. {fmtPct(d)} er brutt ned.
        </p>
      ),
      tynntarm: (
        <p>
          <strong>Proteiner i tynntarmen.</strong> Bukspyttkjertelen sender basisk saft med trypsin, som virker best ved pH ca. 8. Trypsin
          og peptidaser i tarmveggen deler peptidene helt ned til aminosyrer, som tas opp i blodet gjennom tarmtottene.
        </p>
      ),
      tykktarm: (
        <p>
          <strong>Tykktarmen.</strong> Aminosyrene er allerede tatt opp i tynntarmen. Her tas vann og salter opp.
        </p>
      ),
    },
    fett: {
      munn: (
        <p>
          <strong>Fett i munnen.</strong> Fett (triglyserider: glyserol med tre fettsyrer) løser seg ikke i vann og danner dråper. Nesten
          ingenting brytes ned i munnen.
        </p>
      ),
      magesekk: (
        <p>
          <strong>Fett i magesekken.</strong> Magesekken knar maten, og litt fett brytes ned av magelipase, men det meste av fettet er
          fortsatt i store dråper.
        </p>
      ),
      tynntarm: (
        <p>
          <strong>Fett i tynntarmen.</strong> Galle fra leveren (lagret i galleblæren) inneholder ingen enzymer, men deler fettet i små
          dråper (emulgering), så lipase fra bukspyttkjertelen får en mye større overflate å virke på. Lipase spalter fettet til fettsyrer
          og glyserol. Disse tas opp i tarmtottene, bygges om til fett og går ut i lymfen, ikke rett i blodet.
        </p>
      ),
      tykktarm: (
        <p>
          <strong>Tykktarmen.</strong> Fettet er allerede tatt opp i tynntarmen. Her tas vann og salter opp.
        </p>
      ),
    },
  };
  return (
    <>
      {texts[n][s]}
      <p>
        Fordøyelse betyr at store molekyler (makromolekyler) brytes ned til små byggesteiner som kan tas opp gjennom tarmveggen. Hvert enzym
        bryter bare ned én type stoff, og virker best ved pH-en der det skal virke.
      </p>
    </>
  );
}

/* ====================================================================== */
/* Enzymaktivitet                                                           */
/* ====================================================================== */

const PLACES = [
  { value: 'munn', label: 'Munnen', pH: 7 },
  { value: 'magesekk', label: 'Magesekken', pH: 2 },
  { value: 'tynntarm', label: 'Tynntarmen', pH: 8 },
] as const;

const STATE_LABEL: Record<EnzymeState, string> = {
  aktivt: 'Aktivt',
  kaldt: 'Langsomt (kaldt)',
  denaturert: 'Denaturert',
  'feil-ph': 'Feil pH',
  varmet: 'Denaturert',
};

function Enzymes() {
  const [id, setId] = useState<EnzymeId>('pepsin');
  const [pH, setPH] = useState(2);
  const [T, setT] = useState(37);
  const [heated, setHeated] = useState(false);
  const e = ENZYMES[id];
  const a = activity(e, pH, T, heated);
  const state = enzymeState(e, pH, T, heated);
  const place = PLACES.find((p) => Math.abs(p.pH - pH) < 1e-9)?.value ?? null;
  return (
    <>
      <Toolbar>
        <Segmented
          label="Enzym"
          options={(Object.keys(ENZYMES) as EnzymeId[]).map((k) => ({ value: k, label: ENZYMES[k].name }))}
          value={id}
          onChange={setId}
        />
      </Toolbar>
      <Controls>
        <Slider label="pH" value={pH} onChange={setPH} min={0} max={14} step={0.1} decimals={1} />
        <Slider label="Temperatur" value={T} onChange={setT} min={0} max={80} step={1} unit="°C" />
      </Controls>
      <Toolbar>
        <Forvalg
          label="pH som i"
          options={PLACES.map((p) => ({ value: p.value, label: p.label, detail: `pH ${p.pH}` }))}
          value={place}
          onPick={(v) => setPH(PLACES.find((p) => p.value === v)!.pH)}
        />
        <Toggle label="Varmet til 70 °C og avkjølt igjen" checked={heated} onChange={setHeated} />
      </Toolbar>

      <EnzymeShape state={state} a={a} color={ENZYME_COLOR[id]} />
      <ActivityPlots id={id} pH={pH} T={T} heated={heated} />
      <Legend
        items={(Object.keys(ENZYMES) as EnzymeId[]).map((k) => ({
          color: ENZYME_COLOR[k],
          label: `${ENZYMES[k].name} (optimum pH ${fmt(ENZYMES[k].optPH, 0)})`,
        }))}
      />

      <Readouts>
        <Readout label="Aktivitet" value={fmtPct(a)} unit="av maks" tone={ENZYME_COLOR[id]} />
        <Readout label="Effekt av pH" value={fmtPct(activityPH(e, pH))} />
        <Readout label="Effekt av temperatur" value={heated ? '0 %' : fmtPct(activityT(T))} />
        <Readout label="Enzymet er" value={STATE_LABEL[state]} />
      </Readouts>

      <Explain>{enzymeText(id, pH, T, heated, a, state)}</Explain>
    </>
  );
}

/** Enzym og substrat som lås og nøkkel: passer når enzymet har riktig form, ødelagt aktivt sete ved feil pH og denaturering. */
function EnzymeShape({ state, a, color }: { state: EnzymeState; a: number; color: string }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const lw = useLineScale();
  const narrow = f > 1.3;
  const k = Math.min(1.5, Math.max(1, f * 0.85));
  const H = Math.round(200 + 190 * (f - 1));
  const cx = narrow ? 400 : 300;
  const R = 70 * k;
  const cy = narrow ? 40 + R + 8 : H / 2 + 6;
  const fits = state === 'aktivt' || state === 'kaldt';
  const denat = state === 'denaturert' || state === 'varmet';
  const distorted = state === 'feil-ph';
  // Det aktive setet: en hakk øverst i enzymet
  const notch = distorted
    ? `L${cx + 26},${cy - R + 6} L${cx + 6},${cy - R + 34} L${cx - 22},${cy - R + 16} L${cx - 30},${cy - R + 4}`
    : `L${cx + 22},${cy - R + 2} L${cx + 22},${cy - R + 32} L${cx - 22},${cy - R + 32} L${cx - 22},${cy - R + 2}`;
  const enzymePath = `M${cx - R},${cy} C${cx - R},${cy - R * 0.7} ${cx - R * 0.6},${cy - R} ${cx - 30},${cy - R + 4} ${notch} C${cx + R * 0.6},${cy - R} ${cx + R},${cy - R * 0.7} ${cx + R},${cy} C${cx + R},${cy + R * 0.8} ${cx - R},${cy + R * 0.8} ${cx - R},${cy} Z`;
  const substrateY = fits ? cy - R + 18 : cy - R - 34;
  const coil = Array.from({ length: 40 }, (_, i) => {
    const x = cx - 110 + i * 5.5;
    const y = cy + Math.sin(i * 0.9) * 22 + Math.sin(i * 0.37) * 14;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const text: Record<EnzymeState, string> = {
    aktivt: 'Substratet passer i det aktive setet',
    kaldt: 'Passer, men molekylene beveger seg sakte',
    'feil-ph': 'Feil pH endrer formen på det aktive setet',
    denaturert: 'For varmt: proteinet har mistet formen',
    varmet: 'Varig ødelagt: formen kommer ikke tilbake',
  };
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${H}`} label={`Enzym og substrat: ${text[state]}. Aktivitet ${fmtPct(a)}.`}>
        {denat ? (
          <path d={coil} fill="none" stroke={color} strokeWidth={7 * lw} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        ) : (
          <path d={enzymePath} fill={mixColor(BIO.cytoplasma, color, 0.35)} stroke={color} strokeWidth={2.5 * lw} strokeLinejoin="round" />
        )}
        {!denat && (
          <Txt x={cx} y={cy + 20} size={0.8} weight={650}>
            Enzym
          </Txt>
        )}
        <path
          d={roundedRectPath(cx - 20, substrateY - 14, 40, 30, 6)}
          fill={BIO.sukker}
          stroke={VIZ.surface}
          strokeWidth={1.5 * lw}
          transform={distorted ? `rotate(-18 ${cx} ${substrateY})` : undefined}
        />
        {!fits && (
          <Txt x={cx + 34} y={substrateY + 5} anchor="start" size={0.75} muted>
            substrat
          </Txt>
        )}
        {state === 'kaldt' && (
          <Txt x={cx} y={cy - R - 28} size={0.75} muted>
            få støt per sekund
          </Txt>
        )}
        <Txt x={f > 1.3 ? 400 : 470} y={f > 1.3 ? H - 12 : cy + 6} anchor={f > 1.3 ? 'middle' : 'start'} size={0.85} weight={650}>
          {text[state]}
        </Txt>
      </Figure>
    </div>
  );
}

function ActivityPlots({ id, pH, T, heated }: { id: EnzymeId; pH: number; T: number; heated: boolean }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const narrow = f > 1.3;
  const h = Math.round(300 + 240 * (f - 1));
  const w = narrow ? 800 : 400;
  const H = narrow ? 2 * h : h;
  const e = ENZYMES[id];
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        maxHeight={narrow ? 1400 : Math.round(H * 1.15)}
        label={`Aktiviteten til ${e.name.toLowerCase()} som funksjon av pH og temperatur.`}
      >
        <Plot
          x={{ min: 0, max: 14, label: 'pH', ticks: [0, 2, 4, 6, 8, 10, 12, 14] }}
          y={{ min: 0, max: 100, label: 'Aktivitet (%)', ticks: [0, 50, 100] }}
          width={w}
          height={h}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              {(Object.keys(ENZYMES) as EnzymeId[]).map((k) => (
                <path
                  key={k}
                  d={linePath(
                    sample((p) => activityPH(ENZYMES[k], p) * 100, 0, 14, 200),
                    sx,
                    sy,
                  )}
                  fill="none"
                  stroke={ENZYME_COLOR[k]}
                  strokeWidth={k === id ? 3.4 : 1.6}
                  opacity={k === id ? 1 : 0.4}
                />
              ))}
              <line x1={sx(pH)} x2={sx(pH)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(pH)} cy={sy(activityPH(e, pH) * 100)} r={7} fill={ENZYME_COLOR[id]} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
        <g transform={narrow ? `translate(0 ${h})` : 'translate(400 0)'}>
          <Plot
            x={{ min: 0, max: 80, label: 'Temperatur (°C)', ticks: [0, 20, 40, 60, 80] }}
            y={{ min: 0, max: 100, label: 'Aktivitet (%)', ticks: [0, 50, 100] }}
            width={w}
            height={h}
          >
            {({ sx, sy, y0, y1 }) => (
              <g>
                <rect x={sx(T_OPT + 8)} y={y1} width={sx(80) - sx(T_OPT + 8)} height={y0 - y1} fill={BIO.sir.I} opacity={0.06} />
                <path
                  d={linePath(
                    sample((t) => activityT(t) * 100, 0, 80, 200),
                    sx,
                    sy,
                  )}
                  fill="none"
                  stroke={ENZYME_COLOR[id]}
                  strokeWidth={3.4}
                />
                <path
                  d={linePath(
                    sample((t) => nativeFraction(t) * 100, 0, 80, 200),
                    sx,
                    sy,
                  )}
                  fill="none"
                  stroke={VIZ.muted}
                  strokeWidth={1.6}
                  strokeDasharray="6 5"
                />
                <Txt x={sx(78)} y={y1 + 18 * f} anchor="end" size={0.72} muted>
                  denaturert
                </Txt>
                <line x1={sx(T)} x2={sx(T)} y1={y0} y2={y1} className="viz-guide" />
                <circle
                  cx={sx(T)}
                  cy={sy(heated ? 0 : activityT(T) * 100)}
                  r={7}
                  fill={ENZYME_COLOR[id]}
                  stroke={VIZ.surface}
                  strokeWidth={2.5}
                />
              </g>
            )}
          </Plot>
        </g>
      </Figure>
      <Legend items={[{ color: VIZ.muted, label: 'Andel enzymer med riktig form', dashed: true }]} />
    </div>
  );
}

function enzymeText(id: EnzymeId, pH: number, T: number, heated: boolean, a: number, state: EnzymeState): ReactNode {
  const e = ENZYMES[id];
  const intro = (
    <p>
      <strong>{e.name}</strong> lages i {e.source} og bryter ned {e.substrate} til {e.product} i {e.where}. Den virker best ved pH ca.{' '}
      {fmt(e.optPH, 0)} og rundt {fmt(Math.round(T_OPT / 5) * 5 - 3, 0)}–{fmt(Math.round(T_OPT), 0)} °C. Nå er aktiviteten {fmtPct(a)} av
      det høyeste.
    </p>
  );
  let now: ReactNode;
  switch (state) {
    case 'aktivt':
      now = (
        <p>
          Enzymet har riktig form, og substratet passer i det aktive setet som en nøkkel i en lås. Enzymet blir ikke brukt opp: det kan
          bryte ned mange tusen molekyler i sekundet.
        </p>
      );
      break;
    case 'kaldt':
      now = (
        <p>
          Ved {fmt(T, 0)} °C går reaksjonen langsomt fordi molekylene beveger seg sakte og møtes sjeldnere. Enzymet er ikke ødelagt: varmes
          det opp igjen, virker det som før. Derfor holder maten seg lenger i kjøleskapet.
        </p>
      );
      break;
    case 'feil-ph':
      now = (
        <p>
          Ved pH {fmt(pH, 1)} endres ladningene i det aktive setet, så det får feil form og substratet passer ikke. Det er derfor{' '}
          {id === 'pepsin'
            ? 'pepsin slutter å virke når maten kommer ut i den basiske tynntarmen'
            : id === 'amylase'
              ? 'spyttamylasen slutter å virke når maten blir sur i magesekken'
              : 'enzymene fra bukspyttkjertelen ikke virker i den sure magesekken'}
          .
        </p>
      );
      break;
    case 'denaturert':
      now = (
        <p>
          Ved {fmt(T, 0)} °C rister molekylene så kraftig at de svake bindingene som holder proteinet i riktig form, brytes. Enzymet{' '}
          <strong>denatureres</strong>: det aktive setet forsvinner, og aktiviteten faller brått. Høy feber er farlig av samme grunn.
        </p>
      );
      break;
    case 'varmet':
      now = (
        <p>
          Enzymet har vært varmet til 70 °C og er denaturert. Selv om det avkjøles igjen, får det ikke tilbake formen: denaturering er
          varig, slik et kokt egg ikke blir rått igjen. Sammenlign med kulde, som bare gjør enzymet langsomt.
        </p>
      );
      break;
  }
  return (
    <>
      {intro}
      {now}
      {heated ? null : (
        <p>
          Enzymer er proteiner. Reaksjonsfarten øker med temperaturen (omtrent dobbelt så fort for hver 10 °C) helt til enzymet begynner å
          denatureres over ca. 45 °C.
        </p>
      )}
    </>
  );
}
