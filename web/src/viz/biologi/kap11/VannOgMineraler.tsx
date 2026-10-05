import { useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Etikett,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  fmtPct,
  mixColor,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  DEFICIENCY_LIMIT,
  NUTRIENTS,
  RT_L_MPA,
  deficiency,
  growth,
  guttation,
  leafSymptom,
  rootUptake,
  type GuttationResult,
  type NutrientId,
  type NutrientLevels,
  type RootParams,
  type RootResult,
} from './model';

type Mode = 'rot' | 'rottrykk' | 'mangel';
const MODES: { value: Mode; label: string }[] = [
  { value: 'rot', label: 'Opptak i rota' },
  { value: 'rottrykk', label: 'Rottrykk og guttasjon' },
  { value: 'mangel', label: 'Næringsmangel' },
];

const C_WATER = BIO.vann;
const C_ION = BIO.opplost;

export default function VannOgMineraler() {
  const [mode, setMode] = useState<Mode>('rot');
  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg visning" options={MODES} value={mode} onChange={setMode} />
      </Toolbar>
      {mode === 'rot' ? <Opptak /> : mode === 'rottrykk' ? <Rottrykk /> : <Mangel />}
    </VizLayout>
  );
}

/* ====================================================================== */
/* 1. Opptak i rota                                                         */
/* ====================================================================== */

const ROOT_PRESETS: { id: string; label: string; p: RootParams }[] = [
  { id: 'hage', label: 'Vanlig hagejord', p: { ions: 5, o2: 100, salt: 0 } },
  { id: 'vannmettet', label: 'Vannmettet jord', p: { ions: 5, o2: 5, salt: 0 } },
  { id: 'veisalt', label: 'Veisalt', p: { ions: 5, o2: 100, salt: 150 } },
  { id: 'sjo', label: 'Sjøsprøyt', p: { ions: 5, o2: 100, salt: 300 } },
];

function Opptak() {
  const [p, setP] = useState<RootParams>(ROOT_PRESETS[0]!.p);
  const r = rootUptake(p);
  const clock = useSimClock({ tMax: 600, loop: true });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const preset = ROOT_PRESETS.find((x) => x.p.ions === p.ions && x.p.o2 === p.o2 && x.p.salt === p.salt)?.id ?? null;
  const set = (k: keyof RootParams) => (v: number) => setP((o) => ({ ...o, [k]: v }));
  const waterDir = Math.abs(r.water) < 0.03 ? 'ingen' : r.water > 0 ? 'inn' : 'ut';
  return (
    <>
      <Toolbar>
        <Forvalg label="Jord" options={ROOT_PRESETS.map((x) => ({ value: x.id, label: x.label }))} value={preset} onPick={(id) => setP(ROOT_PRESETS.find((x) => x.id === id)!.p)} />
      </Toolbar>
      <Controls>
        <Slider label="Næringssalter i jordvannet" value={p.ions} onChange={set('ions')} min={0} max={20} step={0.5} unit="mmol/L" decimals={1} />
        <Slider label="O₂ i jorda" ariaLabel="Oksygen i jorda" value={p.o2} onChange={set('o2')} min={0} max={100} step={5} unit="% av godt luftet jord" />
        <Slider label="Salt (NaCl) i jordvannet" value={p.salt} onChange={set('salt')} min={0} max={300} step={10} unit="mmol/L" />
      </Controls>
      <Toolbar>
        <PlayBar clock={clock} time={`${fmt(clock.t, 0)} s`} />
      </Toolbar>
      <div ref={ref}>
        <RootScene r={r} p={p} f={f} t={clock.t} />
      </div>
      <Legend
        items={[
          { color: C_WATER, label: 'Vann' },
          { color: C_ION, label: 'Mineralioner (næringssalter)' },
          { color: BIO.atp, label: 'Ionepumpe (aktiv transport, bruker ATP)' },
          { color: VIZ.ink, label: 'Casparys bånd (vanntett)' },
        ]}
      />
      <Readouts>
        <Readout label="Aktivt ioneopptak" value={fmtPct(r.uptake)} unit="av maks" tone={C_ION} />
        <Readout label="ATP fra celleånding i rota" value={fmtPct(r.atp)} tone={BIO.atp} />
        <Readout label="Oppløste stoffer i rota" value={fmt(r.osmIn, 2)} unit={`osmol/L (jordvann ${fmt(r.osmOut, 2)})`} />
        <Readout label="Vannet går" value={waterDir === 'inn' ? 'Inn i rota' : waterDir === 'ut' ? 'Ut av rota' : 'Ingen vei'} tone={C_WATER} />
      </Readouts>
      <Formula label="Osmose">
        <FormulaLine>
          Vannpotensial ψ = −RT · c: ute {fmt(r.psiOut, 2)} MPa, i rota {fmt(r.psiIn, 2)} MPa (RT = {fmt(RT_L_MPA, 2)} L · MPa/mol ved 20 °C)
        </FormulaLine>
        <FormulaLine>
          Vannet går mot lavest vannpotensial: {waterDir === 'inn' ? 'inn i rota' : waterDir === 'ut' ? 'ut av rota' : 'ingen netto strøm'}
        </FormulaLine>
      </Formula>
      <Explain>{rootText(p, r, waterDir)}</Explain>
    </>
  );
}

const SOIL_DOTS = (() => {
  const r = seededRandom(13);
  return Array.from({ length: 60 }, () => ({ u: r(), v: r(), k: r() }));
})();

function RootScene({ r, p, f, t }: { r: RootResult; p: RootParams; f: number; t: number }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const top = narrow ? 64 * f : 34 * f;
  const bandH = narrow ? 300 : 230;
  const y0 = top;
  const y1 = y0 + bandH;
  const H = Math.round(y1 + 50 * f + (narrow ? 30 * f : 0));
  // Sonene fra venstre: jord, rothårcelle, bark, endodermis, xylem
  const z = { soil: [20, 230], hair: [230, 330], cortex: [330, 560], endo: [560, 620], xyl: [620, 780] } as const;
  const midY = (y0 + y1) / 2;
  const salt = Math.min(1, p.salt / 300);
  const soilFill = mixColor(BIO.vannFyll, BIO.opplost, 0.1 + 0.25 * salt);
  const waterSpeed = Math.max(-0.12, Math.min(0.12, r.water * 0.08));
  const ionSpeed = 0.08 * r.uptake;
  // Vannets vei (gjennom celleveggene og så gjennom endodermiscellene) som en brutt linje fra jorda til xylemet
  const lanes = [0.25, 0.5, 0.75].map((v) => y0 + bandH * v);
  const waterPath = (y: number): [number, number][] => [
    [z.soil[0] + 10, y],
    [z.hair[0] - 60, midY + (y - midY) * 0.25],
    [z.hair[1], y],
    [z.endo[0] - 4, y],
    [z.endo[0] + 30, midY + (y - midY) * 0.3],
    [z.xyl[0] + 50, y],
  ];
  const along = (pts: [number, number][], u: number): [number, number] => {
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
    const tot = seg.reduce((a, b) => a + b, 0);
    let left = u * tot;
    for (let i = 0; i < seg.length; i++) {
      if (left <= seg[i]! || i === seg.length - 1) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        const s = Math.min(1, left / (seg[i]! || 1));
        return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
      }
      left -= seg[i]!;
    }
    return pts[pts.length - 1]!;
  };
  const nIons = Math.round(4 + Math.min(16, p.ions));
  const cortexCells = [0, 1, 2].flatMap((c) => [0, 1, 2].map((rr) => ({ c, rr })));
  const cw = (z.cortex[1] - z.cortex[0]) / 3;
  const ch = bandH / 3;
  const labels: { x: number; text: string; row: number }[] = [
    { x: (z.soil[0] + z.soil[1]) / 2, text: 'jord', row: 0 },
    { x: (z.hair[0] + z.hair[1]) / 2, text: 'rothårcelle', row: 1 },
    { x: (z.cortex[0] + z.cortex[1]) / 2, text: 'bark', row: 0 },
    { x: (z.endo[0] + z.endo[1]) / 2, text: 'endodermis', row: 1 },
    { x: (z.xyl[0] + z.xyl[1]) / 2, text: 'xylem', row: 0 },
  ];
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 900 : H}
      label={`Snitt fra jorda inn til xylemet i rota. Ioneopptaket er ${fmtPct(r.uptake)} av maks, og vannet går ${r.water > 0.03 ? 'inn i' : r.water < -0.03 ? 'ut av' : 'verken inn i eller ut av'} rota.`}
    >
      {labels.map((l) => (
        <Txt key={l.text} x={l.x} y={narrow ? 22 * f + l.row * 26 * f : 22 * f} weight={700} size={0.8}>
          {l.text}
        </Txt>
      ))}
      {/* Jord med jordpartikler og jordvann */}
      <rect x={z.soil[0]} y={y0} width={z.soil[1] - z.soil[0]} height={bandH} rx={12} style={{ fill: soilFill }} />
      {[
        [60, 0.15, 26],
        [150, 0.3, 22],
        [80, 0.62, 30],
        [175, 0.8, 24],
        [40, 0.92, 18],
      ].map(([x, v, rr], i) => (
        <circle key={i} cx={x} cy={y0 + bandH * v!} r={rr} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.5) }} stroke={BIO.ved} strokeWidth={1.2} />
      ))}
      {/* Luftlommer med O₂ (færre i vannmettet jord) */}
      {Array.from({ length: Math.round((p.o2 / 100) * 5) }, (_, i) => (
        <circle key={`a${i}`} cx={50 + i * 36} cy={y0 + bandH * (0.42 + (i % 2) * 0.1)} r={9} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.2} />
      ))}
      {/* Rothårcellen med det lange rothåret ut i jorda */}
      <path
        d={`M${z.hair[0]},${y0 + 6} H${z.hair[1] - 4} V${y1 - 6} H${z.hair[0]} V${midY + 16} H${z.soil[0] + 40} Q${z.soil[0] + 24},${midY} ${z.soil[0] + 40},${midY - 16} H${z.hair[0]} Z`}
        fill={BIO.cytoplasma}
        stroke={BIO.cellevegg.line}
        strokeWidth={2.4}
      />
      <ellipse cx={(z.hair[0] + z.hair[1]) / 2 + 10} cy={y0 + bandH * 0.3} rx={20} ry={14} fill={BIO.kjerne.fill} stroke={BIO.kjerne.line} strokeWidth={1.5} />
      {/* Ionepumper i membranen til rothåret */}
      {[0.5].map((v) => (
        <g key={v}>
          <rect x={z.hair[0] - 70} y={midY - 22} width={22} height={44} rx={8} fill={BIO.atp} opacity={0.85} />
          <Txt x={z.hair[0] - 59} y={midY - 28} size={0.62} weight={700} color={BIO.atp}>
            ATP
          </Txt>
        </g>
      ))}
      {/* Barken: celler med celleveggene som vannvei */}
      {cortexCells.map(({ c, rr }) => (
        <rect
          key={`${c}-${rr}`}
          x={z.cortex[0] + c * cw + 3}
          y={y0 + rr * ch + 3}
          width={cw - 6}
          height={ch - 6}
          rx={12}
          fill={BIO.cytoplasma}
          stroke={BIO.cellevegg.line}
          strokeWidth={1.6}
        />
      ))}
      {/* Endodermis med Casparys bånd */}
      {[0, 1, 2, 3].map((rr) => (
        <rect
          key={`e${rr}`}
          x={z.endo[0] + 3}
          y={y0 + rr * (bandH / 4) + 3}
          width={z.endo[1] - z.endo[0] - 6}
          height={bandH / 4 - 6}
          rx={6}
          fill={BIO.cytoplasma}
          stroke={BIO.cellevegg.line}
          strokeWidth={1.6}
        />
      ))}
      {[1, 2, 3].map((rr) => (
        <rect key={`c${rr}`} x={z.endo[0] + 8} y={y0 + rr * (bandH / 4) - 4} width={z.endo[1] - z.endo[0] - 16} height={8} fill={VIZ.ink} opacity={0.75} />
      ))}
      {/* Xylem */}
      <rect x={z.xyl[0] + 10} y={y0} width={z.xyl[1] - z.xyl[0] - 10} height={bandH} rx={14} fill={BIO.vannFyll} stroke={C_WATER} strokeWidth={2.5} />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`r${i}`} x1={z.xyl[0] + 14} x2={z.xyl[1] - 4} y1={y0 + (i + 0.5) * (bandH / 8)} y2={y0 + (i + 0.5) * (bandH / 8)} stroke={C_WATER} strokeWidth={1} opacity={0.35} />
      ))}
      {r.water > 0.03 && (
        <g>
          <Arrow x1={z.xyl[1] - 40} y1={y1 - 20} x2={z.xyl[1] - 40} y2={y0 + 24} color={C_WATER} width={4} head={12} />
          <Txt x={z.xyl[1] - 48} y={midY + 6} anchor="end" size={0.7} weight={650} color={C_WATER}>
            opp
          </Txt>
        </g>
      )}

      {/* Vann (blå) og ioner (fiolette) som beveger seg */}
      {lanes.flatMap((y, li) =>
        Array.from({ length: 6 }, (_, i) => {
          const pts = waterPath(y);
          const u = (((i / 6 + li * 0.11 + waterSpeed * t) % 1) + 1) % 1;
          const [x, yy] = along(pts, u);
          return <circle key={`w${li}-${i}`} cx={x} cy={yy} r={3.4 * k} fill={C_WATER} stroke={VIZ.surface} strokeWidth={1} />;
        }),
      )}
      {SOIL_DOTS.slice(0, nIons).map((d, i) => {
        // Ionene i jorda står (nesten) stille; de som tas opp, går gjennom pumpen og videre inn
        const inside = d.k < r.uptake;
        if (!inside) {
          return <circle key={`i${i}`} cx={z.soil[0] + 14 + d.u * 180} cy={y0 + 10 + d.v * (bandH - 20)} r={3 * k} fill={C_ION} opacity={0.85} />;
        }
        const pts: [number, number][] = [
          [z.soil[0] + 14 + d.u * 150, y0 + 10 + d.v * (bandH - 20)],
          [z.hair[0] - 59, midY],
          [z.hair[1], y0 + 20 + d.v * (bandH - 40)],
          [z.xyl[0] + 40, y0 + 20 + d.v * (bandH - 40)],
        ];
        const u = (d.u + ionSpeed * t) % 1;
        const [x, y] = along(pts, u);
        return <circle key={`i${i}`} cx={x} cy={y} r={3 * k} fill={C_ION} stroke={VIZ.surface} strokeWidth={0.8} />;
      })}
      {/* Netto vannstrøm over membranen til rothåret */}
      {Math.abs(r.water) > 0.03 && (
        <Arrow
          x1={r.water > 0 ? z.hair[0] - 30 : z.hair[0] + 30}
          y1={y1 - 26}
          x2={r.water > 0 ? z.hair[0] + 30 : z.hair[0] - 30}
          y2={y1 - 26}
          color={C_WATER}
          width={5}
          head={14}
        />
      )}
      <Etikett
        x={(z.endo[0] + z.endo[1]) / 2}
        y={y0 + (3 * bandH) / 4}
        lx={(z.endo[0] + z.endo[1]) / 2}
        ly={y1 + 30 * f + (narrow ? 30 * f : 0)}
        anchor="middle"
        size={0.75}
      >
        Casparys bånd
      </Etikett>
      <Txt x={z.soil[0] + 4} y={y1 + 30 * f} anchor="start" size={0.75} weight={650}>
        jordvann {fmt(r.osmOut, 2)} osmol/L
      </Txt>
      <Txt
        x={narrow ? z.soil[0] + 4 : (z.hair[0] + z.cortex[1]) / 2}
        y={y1 + 30 * f + (narrow ? 30 * f : 0)}
        anchor={narrow ? 'start' : 'middle'}
        size={0.75}
        weight={650}
      >
        i rota {fmt(r.osmIn, 2)} osmol/L
      </Txt>
    </Figure>
  );
}

function rootText(p: RootParams, r: RootResult, dir: 'inn' | 'ut' | 'ingen'): ReactNode {
  const way = (
    <p>
      <strong>Veien inn.</strong> Rothårene gir rota en enorm overflate. Vann og ioner kan gå gjennom celleveggene i barken, men i endodermis
      stopper det vanntette Casparys bånd veien gjennom veggene. Der må alt passere gjennom en cellemembran, så rota kan velge hvilke stoffer
      som slipper inn i xylemet.
    </p>
  );
  const ions = (
    <p>
      <strong>Aktiv transport av ioner.</strong> Næringssaltene (f.eks. NO₃⁻, K⁺ og H₂PO₄⁻) er det mer av inne i rota enn i jordvannet, så de
      må pumpes inn mot konsentrasjonsgradienten. Det koster ATP fra celleåndingen, som trenger O₂.{' '}
      {r.atp < 0.5
        ? `Nå er jorda så vannmettet at røttene bare får ${fmtPct(r.atp)} av vanlig ATP-produksjon, og ioneopptaket faller til ${fmtPct(r.uptake)}. Derfor kan planter «drukne» i vannmettet jord.`
        : p.ions < 1
          ? 'Det er nesten ingen næringssalter i jordvannet, så pumpene har lite å ta opp.'
          : `Opptaket er ${fmtPct(r.uptake)} av det største mulige; ved høye konsentrasjoner er pumpeproteinene fullt opptatt (metning).`}
    </p>
  );
  const water =
    dir === 'ut' ? (
      <p>
        <strong>Salt jord tørker ut planten.</strong> Med {fmt(p.salt, 0)} mmol/L NaCl er det flere oppløste stoffer i jordvannet ({fmt(r.osmOut, 2)}{' '}
        osmol/L) enn i rota ({fmt(r.osmIn, 2)} osmol/L). Da går vannet ut av rota ved osmose, selv om jorda er våt. Det kalles fysiologisk tørke,
        og er grunnen til at veisalt og sjøsprøyt skader planter langs veier og kysten.
      </p>
    ) : (
      <p>
        <strong>Vann ved osmose.</strong>{' '}
        {r.uptake > 0.05
          ? 'Fordi ionene pumpes inn, er det flere oppløste stoffer i rota'
          : 'Ionepumpene står nesten stille, men rotcellene har likevel flere oppløste stoffer'}{' '}
        ({fmt(r.osmIn, 2)} osmol/L) enn jordvannet ({fmt(r.osmOut, 2)} osmol/L). Vannet går derfor inn i rota ved osmose, uten at planten bruker
        energi på selve vannet.
        {p.salt > 0 ? ` Saltet i jorda gjør forskjellen mindre, så det går mindre vann inn.` : ''}
      </p>
    );
  return (
    <>
      {water}
      {ions}
      {way}
    </>
  );
}

/* ====================================================================== */
/* 2. Rottrykk og guttasjon                                                 */
/* ====================================================================== */

type Time = 'dag' | 'natt';

function Rottrykk() {
  const [time, setTime] = useState<Time>('natt');
  const [rh, setRh] = useState(95);
  const [soil, setSoil] = useState(90);
  const g = useMemo(() => guttation({ night: time === 'natt', rh, soil }), [time, rh, soil]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  return (
    <>
      <Toolbar>
        <Segmented
          label="Tid på døgnet"
          options={[
            { value: 'dag', label: 'Dag' },
            { value: 'natt', label: 'Natt' },
          ]}
          value={time}
          onChange={setTime}
        />
      </Toolbar>
      <Controls>
        <Slider label="Luftfuktighet" value={rh} onChange={setRh} min={40} max={100} step={5} unit="%" />
        <Slider label="Vann i jorda" value={soil} onChange={setSoil} min={20} max={100} step={5} unit="% av feltkapasitet" />
      </Controls>
      <div ref={ref}>
        <GuttationScene g={g} f={f} night={time === 'natt'} />
      </div>
      <Legend
        items={[
          { color: C_WATER, label: 'Vann i xylemet og guttasjonsdråper' },
          { color: C_ION, label: 'Ioner pumpet inn i xylemet' },
        ]}
      />
      <Readouts>
        <Readout label="Rottrykk" value={fmt(g.rootPressure, 2)} unit="MPa" tone={C_ION} />
        <Readout label="Transpirasjon" value={fmt(g.E, 2)} unit="mmol/(m² · s)" />
        <Readout label="Trykk i xylemet i bladet" value={fmt(g.xylem, 2)} unit={g.xylem >= 0 ? 'MPa (overtrykk)' : 'MPa (sug)'} tone={C_WATER} />
        <Readout label="Guttasjon" value={g.guttation > 0.05 ? 'Ja' : 'Nei'} unit={g.guttation > 0.05 ? 'dråper i bladkanten' : undefined} tone={g.guttation > 0.05 ? C_WATER : undefined} />
      </Readouts>
      <Formula label="Trykket i xylemet">
        <FormulaLine>
          Rottrykket ({fmt(g.rootPressure, 2)} MPa) presser vann opp, transpirasjonen ({fmt(g.E, 2)} mmol/(m² · s)) drar vann ut av bladet.
        </FormulaLine>
        <FormulaLine>
          {g.xylem >= 0
            ? `Rottrykket vinner: overtrykk på ${fmt(g.xylem, 2)} MPa presser vann ut gjennom hydatodene.`
            : `Transpirasjonen vinner: xylemet er under spenning (${fmt(g.xylem, 2)} MPa), og ingen dråper presses ut.`}
        </FormulaLine>
      </Formula>
      <Explain>{guttationText(g, time === 'natt', rh, soil)}</Explain>
    </>
  );
}

/** Marikåpeblad sett ovenfra: rundt, grunt lappet blad med tagget kant. Gir omrisset og spissene i kanten. */
function alchemilla(cx: number, cy: number, R: number): { d: string; tips: [number, number][] } {
  const lobes = 9;
  const teethPerLobe = 3;
  const n = lobes * teethPerLobe;
  const pts: string[] = [];
  const tips: [number, number][] = [];
  // Bladet har et smalt innsnitt ved bladstilken (nederst)
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + 0.3 + (i / n) * (Math.PI * 2 - 0.6);
    const lobe = Math.cos(((i % teethPerLobe) / teethPerLobe - 0.5) * Math.PI) * 0.06;
    const r = R * (0.95 + lobe);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    tips.push([x, y]);
    // Liten innbuktning mellom tennene
    if (i < n) {
      const a2 = a + (Math.PI * 2 - 0.6) / n / 2;
      const r2 = R * (0.88 + lobe);
      pts.push(`${(cx + Math.cos(a2) * r2).toFixed(1)},${(cy + Math.sin(a2) * r2).toFixed(1)}`);
    }
  }
  return { d: `M${cx},${cy + R * 0.25} L${pts.join(' L')} Z`, tips };
}

function GuttationScene({ g, f, night }: { g: GuttationResult; f: number; night: boolean }) {
  const narrow = f > 1.3;
  const k = Math.max(1, f * 0.85);
  const titleH = 28 * f;
  const H = narrow ? Math.round(titleH * 2 + 380 + 330 + 30) : Math.round(titleH + 360);
  // Venstre: planten med rot, xylem og trykkmåler; høyre: marikåpeblad ovenfra
  const A = narrow ? { x: 20, y: titleH, w: 760, h: 330 } : { x: 20, y: titleH, w: 360, h: 340 };
  const B = narrow ? { x: 20, y: A.y + A.h + titleH + 16, w: 760, h: 380 } : { x: 400, y: titleH, w: 380, h: 340 };
  const leaf = alchemilla(B.x + B.w / 2, B.y + B.h * 0.48, Math.min(B.w, B.h) * 0.38);
  const drops = Math.round(g.guttation * leaf.tips.length);
  const dropR = (3.5 + 3 * g.guttation) * k;
  // Trykkmåleren: fra −1 MPa (sug) til +0,2 MPa (overtrykk)
  const gx = A.x + A.w * 0.88;
  const gTop = A.y + 30;
  const gBot = A.y + A.h - 30;
  const pToY = (p: number) => gTop + ((0.2 - Math.max(-1, Math.min(0.2, p))) / 1.2) * (gBot - gTop);
  const sx = A.x + A.w * 0.4;
  const gy = A.y + A.h * 0.55;
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1200 : H}
      label={`${night ? 'Natt' : 'Dag'}. Rottrykk ${fmt(g.rootPressure, 2)} MPa, trykk i xylemet ${fmt(g.xylem, 2)} MPa. ${g.guttation > 0.05 ? 'Vanndråper presses ut i bladkanten (guttasjon).' : 'Ingen guttasjon.'}`}
    >
      <rect x={A.x} y={A.y} width={A.w} height={gy - A.y} rx={12} fill={night ? VIZ.bodyStrong : BIO.vannFyll} opacity={night ? 0.5 : 0.35} />
      <Txt x={A.x + 4} y={A.y - 10} anchor="start" weight={700}>
        Rottrykk
      </Txt>
      {/* Jord og rot */}
      <rect x={A.x} y={gy} width={A.w} height={A.y + A.h - gy} rx={10} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.25) }} />
      <path d={`M${sx},${gy} Q${sx - 6},${gy + 60} ${sx - 40},${A.y + A.h - 12}`} fill="none" stroke={BIO.ved} strokeWidth={5} strokeLinecap="round" />
      <path d={`M${sx},${gy + 14} Q${sx + 20},${gy + 60} ${sx + 50},${A.y + A.h - 26}`} fill="none" stroke={BIO.ved} strokeWidth={3.5} strokeLinecap="round" />
      {/* Stengel med xylem og et blad */}
      <line x1={sx} x2={sx} y1={gy} y2={A.y + 40} stroke={BIO.plante.line} strokeWidth={10} strokeLinecap="round" />
      <line x1={sx} x2={sx} y1={gy + 40} y2={A.y + 40} stroke={C_WATER} strokeWidth={3.5} />
      <path d={`M${sx},${A.y + 70} Q${sx + 60},${A.y + 30} ${sx + 110},${A.y + 60} Q${sx + 60},${A.y + 90} ${sx},${A.y + 70} Z`} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.6} />
      <path d={`M${sx},${A.y + 110} Q${sx - 60},${A.y + 70} ${sx - 110},${A.y + 100} Q${sx - 60},${A.y + 130} ${sx},${A.y + 110} Z`} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.6} />
      {g.guttation > 0.05 &&
        [
          [sx + 110, A.y + 60],
          [sx - 110, A.y + 100],
        ].map(([x, y], i) => <path key={i} d={dropPath(x!, y! + 4, dropR)} fill={C_WATER} opacity={0.85} />)}
      {/* Ioner pumpes inn i xylemet i rota, vannet følger etter */}
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={sx - 14 + i * 14} cy={gy + 36} r={3.6 * k} fill={C_ION} />
      ))}
      {g.xylem >= 0 ? (
        <Arrow x1={sx - 22} y1={gy + 20} x2={sx - 22} y2={A.y + 140} color={C_WATER} width={3.5} head={11} label="presses opp" labelX={sx - 30} labelY={(gy + A.y + 140) / 2} labelAnchor="end" />
      ) : (
        <Arrow x1={sx - 22} y1={gy + 20} x2={sx - 22} y2={A.y + 140} color={C_WATER} width={2.5} head={10} dashed label="dras opp" labelX={sx - 30} labelY={(gy + A.y + 140) / 2} labelAnchor="end" />
      )}
      {/* Trykkmåler for xylemet i bladet */}
      <rect x={gx - 12} y={gTop} width={24} height={gBot - gTop} rx={8} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.5} />
      <line x1={gx - 18} x2={gx + 18} y1={pToY(0)} y2={pToY(0)} stroke={VIZ.ink} strokeWidth={2} />
      <rect
        x={gx - 8}
        y={Math.min(pToY(0), pToY(g.xylem))}
        width={16}
        height={Math.abs(pToY(g.xylem) - pToY(0))}
        rx={4}
        fill={g.xylem >= 0 ? C_WATER : BIO.dod}
      />
      <Txt x={gx - 20} y={pToY(0) + 6} anchor="end" size={0.72} weight={650}>
        0
      </Txt>
      <Txt x={gx} y={gTop - 8} size={0.7} muted>
        overtrykk
      </Txt>
      <Txt x={gx} y={gBot + 20 * f} size={0.7} muted>
        sug
      </Txt>

      {/* Marikåpe ovenfra */}
      <Txt x={B.x + 4} y={B.y - 10} anchor="start" weight={700}>
        Marikåpe (<tspan fontStyle="italic">Alchemilla</tspan>) om morgenen
      </Txt>
      <rect x={B.x} y={B.y} width={B.w} height={B.h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <path d={leaf.d} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={2} strokeLinejoin="round" />
      {Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI / 2 + 0.3 + ((i + 0.5) / 9) * (Math.PI * 2 - 0.6);
        const cx = B.x + B.w / 2;
        const cy = B.y + B.h * 0.48;
        const R = Math.min(B.w, B.h) * 0.38;
        return <line key={i} x1={cx} y1={cy + R * 0.25} x2={cx + Math.cos(a) * R * 0.85} y2={cy + Math.sin(a) * R * 0.85} stroke={BIO.plante.line} strokeWidth={1.4} opacity={0.6} />;
      })}
      <line x1={B.x + B.w / 2} x2={B.x + B.w / 2} y1={B.y + B.h * 0.48 + Math.min(B.w, B.h) * 0.1} y2={B.y + B.h - 10} stroke={BIO.plante.line} strokeWidth={4} />
      {leaf.tips.slice(0, leaf.tips.length).map(([x, y], i) => {
        // Dråpene kommer først på noen tenner, så på alle (jevnt fordelt)
        const show = i % 2 === 0 && drops > 0 && (i * 7) % leaf.tips.length < drops;
        return show ? <circle key={i} cx={x} cy={y} r={dropR} fill={C_WATER} opacity={0.85} stroke={VIZ.surface} strokeWidth={1.2} /> : null;
      })}
      <Txt x={B.x + B.w / 2} y={B.y + B.h - 14} size={0.75} weight={650} color={g.guttation > 0.05 ? C_WATER : VIZ.muted}>
        {g.guttation > 0.05 ? 'dråper fra hydatodene i bladkanten' : 'ingen dråper'}
      </Txt>
    </Figure>
  );
}

function dropPath(x: number, y: number, r: number): string {
  return `M${x},${y - r * 1.4} Q${x + r},${y - r * 0.2} ${x + r},${y + r * 0.3} A${r},${r} 0 1 1 ${x - r},${y + r * 0.3} Q${x - r},${y - r * 0.2} ${x},${y - r * 1.4} Z`;
}

function guttationText(g: GuttationResult, night: boolean, rh: number, soil: number): ReactNode {
  const how = (
    <p>
      <strong>Rottrykk.</strong> Cellene i rota pumper ioner inn i xylemet med aktiv transport. Da blir det høy konsentrasjon av oppløste stoffer
      der, og vann går inn ved osmose og presser vannsøylen oppover med et trykk på opptil ca. {fmt(0.15, 2)} MPa. Om våren, før bjørka har fått
      blader, er det rottrykket som presser opp bjørkesevja folk tapper.
    </p>
  );
  if (g.guttation > 0.05)
    return (
      <>
        <p>
          <strong>Guttasjon.</strong> {night ? 'Om natta' : 'Nå'} er lufta så fuktig ({fmt(rh, 0)} %) at bladene nesten ikke mister vann ved
          transpirasjon. Rottrykket presser likevel vann opp, og vannet presses ut som dråper gjennom små åpninger i bladkanten (hydatoder).
          Dråpene på tuppen av tennene på marikåpe en tidlig morgen er altså ikke dugg: dugg legger seg over hele bladet når vanndamp i lufta
          kondenserer.
        </p>
        {how}
      </>
    );
  return (
    <>
      <p>
        <strong>Ingen guttasjon.</strong>{' '}
        {soil < 40
          ? `Jorda er for tørr (${fmt(soil, 0)} %) til at rota bygger opp rottrykk.`
          : night
            ? `Lufta er for tørr (${fmt(rh, 0)} %): selv om natta fordamper nok vann til at transpirasjonen tar unna det rottrykket presser opp.`
            : 'Om dagen er spalteåpningene åpne, og transpirasjonen drar vannet opp mye raskere enn rottrykket presser det. Xylemet er under spenning (sug), så det blir ingen dråper.'}
      </p>
      {how}
    </>
  );
}

/* ====================================================================== */
/* 3. Næringsmangel                                                         */
/* ====================================================================== */

const FULL: NutrientLevels = { N: 100, P: 100, K: 100, Mg: 100 };
const MANGEL_PRESETS: { id: string; label: string; v: NutrientLevels }[] = [
  { id: 'full', label: 'Full gjødsling', v: FULL },
  { id: 'N', label: 'Lite N', v: { ...FULL, N: 20 } },
  { id: 'P', label: 'Lite P', v: { ...FULL, P: 20 } },
  { id: 'K', label: 'Lite K', v: { ...FULL, K: 20 } },
  { id: 'Mg', label: 'Lite Mg', v: { ...FULL, Mg: 20 } },
];

function Mangel() {
  // Start med nitrogenmangel (forhåndsvalget «Lite N»), så symptomene synes med en gang
  const [v, setV] = useState<NutrientLevels>(MANGEL_PRESETS[1]!.v);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const gr = growth(v);
  const preset = MANGEL_PRESETS.find((p) => (Object.keys(FULL) as NutrientId[]).every((k) => p.v[k] === v[k]))?.id ?? null;
  const deficient = NUTRIENTS.filter((n) => v[n.id] < DEFICIENCY_LIMIT);
  return (
    <>
      <Toolbar>
        <Forvalg label="Jord" options={MANGEL_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={preset} onPick={(id) => setV(MANGEL_PRESETS.find((p) => p.id === id)!.v)} />
      </Toolbar>
      <Controls>
        {NUTRIENTS.map((n) => (
          <Slider
            key={n.id}
            label={`${n.name} (${n.id})`}
            value={v[n.id]}
            onChange={(x) => setV((o) => ({ ...o, [n.id]: x }))}
            min={0}
            max={100}
            step={5}
            unit="% av behovet"
          />
        ))}
      </Controls>
      <div ref={ref}>
        <DeficiencyScene v={v} f={f} />
      </div>
      <Legend
        items={[
          { color: BIO.plante.line, label: 'Friskt blad' },
          { color: BIO.golgi.line, label: 'Gult: klorose (N, Mg)' },
          { color: BIO.sir.V, label: 'Rødlilla (P)' },
          { color: BIO.ved, label: 'Brune bladkanter (K)' },
        ]}
      />
      <Readouts>
        <Readout label="Vekst" value={fmtPct(gr.growth)} unit="av full vekst" tone={BIO.plante.line} />
        <Readout label="Begrensende næringsstoff" value={gr.limiting ? NUTRIENTS.find((n) => n.id === gr.limiting)!.name : 'Ingen'} />
        <Readout label="Mangelsymptomer" value={deficient.length ? deficient.map((n) => n.id).join(', ') : 'Ingen'} />
      </Readouts>
      <Formula label="Minimumsloven">
        <FormulaLine>
          Vekst = minste tilgang = min({(Object.keys(FULL) as NutrientId[]).map((k) => `${k} ${fmt(v[k], 0)} %`).join(', ')}) = {fmtPct(gr.growth)}
        </FormulaLine>
      </Formula>
      <Explain>{mangelText(v, gr)}</Explain>
    </>
  );
}

function DeficiencyScene({ v, f }: { v: NutrientLevels; f: number }) {
  const narrow = f > 1.3;
  const titleH = 28 * f;
  const P = narrow ? { x: 20, y: titleH, w: 760, h: 440 } : { x: 20, y: titleH, w: 440, h: 380 };
  const B = narrow ? { x: 20, y: P.y + P.h + titleH + 16, w: 760, h: 300 } : { x: 480, y: titleH, w: 300, h: 380 };
  const H = Math.round(B.y + B.h + 6);
  const gr = growth(v);
  const def = { N: deficiency(v.N), P: deficiency(v.P), K: deficiency(v.K), Mg: deficiency(v.Mg) };
  const sx = P.x + P.w / 2;
  const gy = P.y + P.h * 0.86;
  const heightFull = P.h * 0.8;
  const h = heightFull * (0.3 + 0.7 * gr.growth);
  const nLeaves = 6;
  const leafLen = P.w * 0.3 * (0.65 + 0.35 * gr.growth);
  const rootDepth = (P.y + P.h - gy) * (0.5 + 0.5 * (1 - def.P));
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1300 : H}
      label={`Plante som vokser ${fmtPct(gr.growth)} av full vekst. ${gr.limiting ? `Begrenset av ${gr.limiting}.` : 'Ingen mangel.'}`}
    >
      <Txt x={P.x + 4} y={P.y - 10} anchor="start" weight={700}>
        Planten (eldste blader nederst)
      </Txt>
      <rect x={P.x} y={gy} width={P.w} height={P.y + P.h - gy} rx={10} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.22) }} />
      <line x1={P.x} x2={P.x + P.w} y1={gy} y2={gy} stroke={BIO.ved} strokeWidth={2} />
      {/* Røtter: svakere rotvekst ved fosformangel */}
      {[-1, -0.4, 0.3, 1].map((s, i) => (
        <path key={i} d={`M${sx},${gy} q${s * 30},${rootDepth * 0.5} ${s * 60},${rootDepth * (0.75 + 0.2 * (i % 2))}`} fill="none" stroke={BIO.ved} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {/* Stengel */}
      <line x1={sx} x2={sx} y1={gy} y2={gy - h} stroke={BIO.plante.line} strokeWidth={6 * (0.6 + 0.4 * gr.growth)} strokeLinecap="round" />
      {Array.from({ length: nLeaves }, (_, i) => {
        const age = 1 - i / (nLeaves - 1);
        const y = gy - h * (0.15 + (0.8 * i) / (nLeaves - 1));
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <SymptomLeaf
            key={i}
            x={sx}
            y={y}
            len={leafLen * (0.75 + 0.25 * age)}
            side={side}
            s={{ N: leafSymptom(def.N, age), P: leafSymptom(def.P, age), K: leafSymptom(def.K, age), Mg: leafSymptom(def.Mg, age) }}
          />
        );
      })}
      <line x1={P.x + P.w - 30} x2={P.x + P.w - 30} y1={gy} y2={gy - heightFull} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 5" />
      <Txt x={P.x + P.w - 36} y={gy - heightFull + 14} anchor="end" size={0.72} muted>
        full høyde
      </Txt>
      <MinimumBars box={B} v={v} limiting={gr.limiting} />
    </Figure>
  );
}

function SymptomLeaf({ x, y, len, side, s }: { x: number; y: number; len: number; side: number; s: Record<NutrientId, number> }) {
  // Bladet peker ut og litt opp; nervene går fra midtribben
  const ang = side < 0 ? 200 : -20;
  const a = (ang * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.3;
  const ny = Math.cos(a) * len * 0.3;
  const mx = x + Math.cos(a) * len * 0.5;
  const my = y + Math.sin(a) * len * 0.5;
  const d = `M${x},${y} Q${mx + nx},${my + ny} ${tx},${ty} Q${mx - nx},${my - ny} ${x},${y} Z`;
  // Farger: gult ved N-mangel (hele bladet) og Mg-mangel (mellom nervene), rødlilla ved P-mangel
  const yellowAll = s.N;
  const yellowBetween = s.Mg;
  const yellow = mixColor(BIO.golgi.fill, BIO.golgi.line, 0.45);
  let fill = mixColor(BIO.plante.fill, yellow, Math.min(1, yellowAll + yellowBetween));
  fill = mixColor(fill, BIO.sir.V, 0.6 * s.P);
  const vein = mixColor(BIO.plante.line, BIO.golgi.line, yellowAll * 0.8);
  const veins = [0.3, 0.5, 0.7].flatMap((u) => {
    const bx = x + Math.cos(a) * len * u;
    const by = y + Math.sin(a) * len * u;
    const l = len * 0.22 * (1 - Math.abs(u - 0.45));
    const aa = a + 0.9;
    const ab = a - 0.9;
    return [
      `M${bx},${by} l${Math.cos(aa) * l},${Math.sin(aa) * l}`,
      `M${bx},${by} l${Math.cos(ab) * l},${Math.sin(ab) * l}`,
    ];
  });
  return (
    <g>
      <path d={d} style={{ fill }} stroke={vein} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Brune, svidde bladkanter ved K-mangel */}
      {s.K > 0.02 && <path d={d} fill="none" stroke={BIO.ved} strokeWidth={2 + 7 * s.K} strokeLinejoin="round" opacity={0.85} />}
      <line x1={x} y1={y} x2={tx} y2={ty} style={{ stroke: yellowBetween > 0.05 ? BIO.plante.line : vein }} strokeWidth={yellowBetween > 0.05 ? 3 : 1.6} />
      {veins.map((v, i) => (
        <path key={i} d={v} fill="none" style={{ stroke: yellowBetween > 0.05 ? BIO.plante.line : vein }} strokeWidth={yellowBetween > 0.05 ? 2.6 : 1.2} />
      ))}
    </g>
  );
}

function MinimumBars({ box, v, limiting }: { box: { x: number; y: number; w: number; h: number }; v: NutrientLevels; limiting: NutrientId | null }) {
  const f = useTextScale();
  const ids: NutrientId[] = ['N', 'P', 'K', 'Mg'];
  const top = box.y + 24 * f;
  const bottom = box.y + box.h - 30 * f;
  const yOf = (p: number) => bottom - (p / 100) * (bottom - top);
  const bw = box.w / 6;
  const min = Math.min(...ids.map((k) => v[k]));
  return (
    <g>
      <Txt x={box.x + 4} y={box.y - 10} anchor="start" weight={700}>
        Minimumsloven
      </Txt>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      <line x1={box.x + 10} x2={box.x + box.w - 10} y1={yOf(DEFICIENCY_LIMIT)} y2={yOf(DEFICIENCY_LIMIT)} stroke={VIZ.muted} strokeWidth={1.4} strokeDasharray="4 4" />
      <Txt x={box.x + 12} y={yOf(DEFICIENCY_LIMIT) - 6} anchor="start" size={0.65} muted>
        mangelgrense
      </Txt>
      {ids.map((k, i) => {
        const x = box.x + bw * (0.9 + i * 1.15);
        const on = k === limiting;
        return (
          <g key={k}>
            <rect x={x} y={top} width={bw} height={bottom - top} rx={6} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
            <rect x={x} y={yOf(v[k])} width={bw} height={bottom - yOf(v[k])} rx={6} fill={on ? BIO.golgi.line : BIO.plante.line} opacity={on ? 0.9 : 0.55} />
            <Txt x={x + bw / 2} y={bottom + 22 * f} weight={700} size={0.85}>
              {k}
            </Txt>
          </g>
        );
      })}
      {/* Veksten følger den laveste staven */}
      <line x1={box.x + 10} x2={box.x + box.w - 10} y1={yOf(min)} y2={yOf(min)} stroke={VIZ.ink} strokeWidth={2.5} />
      <Txt x={box.x + 14} y={yOf(min) - 8} anchor="start" size={0.72} weight={700}>
        vekst {fmtPct(min / 100)}
      </Txt>
    </g>
  );
}

function mangelText(v: NutrientLevels, gr: { growth: number; limiting: NutrientId | null }): ReactNode {
  const deficient = NUTRIENTS.filter((n) => v[n.id] < DEFICIENCY_LIMIT);
  const law = (
    <p>
      <strong>Minimumsloven (Liebig).</strong> Planten vokser bare så mye som det næringsstoffet det er minst av, tillater
      {gr.limiting ? `, her ${NUTRIENTS.find((n) => n.id === gr.limiting)!.name.toLowerCase()} (${fmt(v[gr.limiting], 0)} %)` : ''}. Det hjelper
      ikke å gi mer av de andre: da må du gi mer av det som mangler. Derfor inneholder kunstgjødsel ofte både N, P og K.
    </p>
  );
  const mobile = (
    <p>
      Alle de fire stoffene er mobile i planten: ved mangel flytter planten dem fra de eldste bladene til de yngste, som vokser. Derfor kommer
      symptomene først på de nederste bladene. Stoffer som ikke kan flyttes, som kalsium og jern, gir symptomer på de yngste bladene i stedet.
    </p>
  );
  if (deficient.length === 0)
    return (
      <>
        <p>
          <strong>Ingen mangel.</strong> Planten får nok av alle de fire næringsstoffene og vokser {fmtPct(gr.growth)} av full vekst. Flytt en
          glidebryter under {DEFICIENCY_LIMIT} % for å se mangelsymptomer.
        </p>
        {law}
      </>
    );
  return (
    <>
      <p>
        {deficient.map((n, i) => (
          <span key={n.id}>
            {i > 0 ? ' ' : ''}
            <strong>
              {n.name} ({n.id}):
            </strong>{' '}
            brukes til {n.role}, og tas opp som {n.ions}. Mangel gir {n.symptom}.
          </span>
        ))}
      </p>
      {law}
      {mobile}
    </>
  );
}
