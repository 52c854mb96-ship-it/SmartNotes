import { useState, type ReactNode } from 'react';
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
  Plot,
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
  fmtSig,
  linePath,
  mixColor,
  useContainerTextScale,
  useSvgId,
  useTextScale,
} from '../kit';
import {
  D_TISSUE,
  GAS_STRATEGIES,
  O2_AIR,
  O2_WATER,
  RC_SKIN,
  RC_TRACHEA,
  SIZE_MAX_EXP,
  SIZE_MIN_EXP,
  SIZE_REFERENCES,
  anoxicCore,
  diffusionTime,
  formatDuration,
  formatMeters,
  getStrategy,
  surfacePerVolume,
  HUMAN_LUNG_AREA,
  HUMAN_SKIN_AREA,
  maxDiameter,
  o2At,
  o2Coverage,
  type GasId,
  type GasStrategy,
} from './model';
import { GjelleFilament } from './felles';

/** Desimaler for en lengde i mm: 0,05 mm, 1,5 mm, 30 mm, 500 mm. */
const mmDecimals = (mm: number) => (mm < 1 ? 2 : mm < 10 ? 1 : 0);

/** O₂-nivå (0–1) i vevet som farge: grått uten O₂, rødt med mye O₂. */
const o2Color = (level: number) => mixColor(BIO.dod, BIO.oksygenrikt, Math.min(1, Math.max(0, level)));

/** Farger for linjene i grafen. */
const LINE: Record<'hud' | 'trakeer' | 'blod', string> = { hud: BIO.serie[0], trakeer: BIO.serie[1], blod: BIO.serie[2] };
const lineKey = (s: GasStrategy) => (s.id === 'hud' ? 'hud' : s.id === 'trakeer' ? 'trakeer' : 'blod');

export default function RespirasjonHosDyr() {
  const [id, setId] = useState<GasId>('hud');
  const [exp, setExp] = useState(Math.log10(0.003));
  const d = 10 ** exp;
  const R = d / 2;
  const strategy = getStrategy(id);
  const cov = o2Coverage(strategy, d);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const preset = SIZE_REFERENCES.find((r) => Math.abs(Math.log10(r.d) - exp) < 1e-6)?.name ?? null;
  const tCentre = diffusionTime(R);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg gassutveksling" options={GAS_STRATEGIES.map((s) => ({ value: s.id, label: s.name }))} value={id} onChange={setId} />
      </Toolbar>
      <Controls>
        <Slider
          label="Kroppens tykkelse"
          ariaLabel="Kroppens tykkelse (logaritmisk skala)"
          value={exp}
          onChange={setExp}
          min={SIZE_MIN_EXP}
          max={SIZE_MAX_EXP}
          step={0.05}
          format={(v) => formatMeters(10 ** v)}
        />
      </Controls>
      <Toolbar>
        <Forvalg
          label="Omtrent like tykk som"
          options={SIZE_REFERENCES.map((r) => ({ value: r.name, label: r.name, detail: formatMeters(r.d) }))}
          value={preset}
          onPick={(name) => setExp(Math.log10(SIZE_REFERENCES.find((r) => r.name === name)!.d))}
        />
      </Toolbar>

      <div ref={ref}>
        <Scene strategy={strategy} d={d} f={f} cov={cov} />
      </div>
      <Legend
        items={[
          { color: BIO.oksygenrikt, label: 'Vev med nok O₂' },
          { color: BIO.dod, label: 'Vev uten O₂ (cellene dør)' },
          ...(strategy.id === 'trakeer' ? [{ color: BIO.insekt.line, label: 'Trakeer (luftfylte rør)' }] : []),
          ...(strategy.needsBlood ? [{ color: BIO.oksygenrikt, label: 'Kapillærer: blodet frakter O₂', dashed: true }] : []),
        ]}
      />

      <CoverageFigure strategy={strategy} exp={exp} />
      <Legend
        items={[
          { color: LINE.hud, label: 'Bare diffusjon gjennom huden' },
          { color: LINE.trakeer, label: 'Trakeer' },
          { color: LINE.blod, label: 'Gjeller eller lunger med blodkretsløp' },
        ]}
      />

      <Readouts>
        <Readout label="Andel av kroppen med nok O₂" value={fmtPct(cov)} tone={cov < 0.999 ? VIZ.muted : BIO.oksygenrikt} />
        <Readout label="Overflate per volum" value={fmtSig(surfacePerVolume(d), 2)} unit="mm² per mm³" />
        <Readout
          label="Diffusjonsavstand der O₂ tas opp"
          value={strategy.barrier === null ? formatMeters(R) : strategy.id === 'trakeer' ? '< 1 µm' : `ca. ${formatMeters(strategy.barrier * 1e-6)}`}
          unit={strategy.barrier === null ? 'til midten' : strategy.id === 'trakeer' ? 'fra trakeolene' : undefined}
        />
        <Readout
          label="O₂ i omgivelsene"
          value={fmt(strategy.medium === 'luft' ? O2_AIR : O2_WATER, strategy.medium === 'luft' ? 1 : 2)}
          unit={`mmol/L (${strategy.medium === 'luft' ? 'luft' : 'vann'})`}
        />
      </Readouts>

      <Formula label="Diffusjon tar tid">
        <FormulaLine>
          Tid til midten: t ≈ x² / (2D) = ({fmt(R * 1000, mmDecimals(R * 1000))} mm)² / (2 · {fmt(D_TISSUE * 1e6, 3)} mm²/s) ={' '}
          {formatDuration(tCentre)}
        </FormulaLine>
        <FormulaLine>
          Overflate per volum (kule): A/V = 6/d = 6/({fmt(d * 1000, mmDecimals(d * 1000))} mm) = {fmtSig(surfacePerVolume(d), 2)} mm²
          per mm³
        </FormulaLine>
        <FormulaLine>Dobbelt så tykk kropp: fire ganger så lang diffusjonstid og halvparten så mye overflate per volum.</FormulaLine>
        <FormulaLine>Ficks lov: raskere diffusjon med stor overflate, stor forskjell og kort avstand.</FormulaLine>
      </Formula>

      <Explain>{explanation(strategy, d, cov)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Scenen: tverrsnitt av kroppen og gassutvekslingsorganet                  */
/* ====================================================================== */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Scene({ strategy, d, f, cov }: { strategy: GasStrategy; d: number; f: number; cov: number }) {
  const narrow = f > 1.3;
  const titleH = 28 * f;
  const crossH = narrow ? 470 : 330;
  const organH = narrow ? 400 : 330;
  const A: Box = narrow ? { x: 20, y: titleH, w: 760, h: crossH } : { x: 20, y: titleH, w: 370, h: crossH };
  const B: Box = narrow ? { x: 20, y: titleH * 2 + crossH + 20, w: 760, h: organH } : { x: 410, y: titleH, w: 370, h: organH };
  const H = Math.round(B.y + B.h + 10);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1400 : H}
      label={`${strategy.name}: tverrsnitt av en kropp som er ${formatMeters(d)} tykk. ${fmtPct(cov)} av kroppen får nok O₂.`}
    >
      <Txt x={A.x + 4} y={A.y - 10} anchor="start" weight={700}>
        Tverrsnitt av kroppen
      </Txt>
      <CrossSection box={A} strategy={strategy} d={d} f={f} />
      <Txt x={B.x + 4} y={B.y - 10} anchor="start" weight={700}>
        {ORGAN_TITLE[strategy.id]}
      </Txt>
      <rect x={B.x} y={B.y} width={B.w} height={B.h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      {strategy.id === 'hud' && <OrganHud box={B} d={d} />}
      {strategy.id === 'trakeer' && <OrganTrakeer box={B} />}
      {strategy.id === 'gjeller' && <OrganGjeller box={B} />}
      {strategy.id === 'lunger' && <OrganLunger box={B} />}
      {strategy.id === 'fuglelunger' && <OrganFuglelunger box={B} />}
    </Figure>
  );
}

const ORGAN_TITLE: Record<GasId, string> = {
  hud: 'Diffusjon gjennom huden',
  trakeer: 'Trakeer hos insekter',
  gjeller: 'Gjeller hos fisk',
  lunger: 'Lunger hos pattedyr',
  fuglelunger: 'Lunger og luftsekker hos fugler',
};

/* ---------- Tverrsnitt med O₂-kart ---------- */

function CrossSection({ box, strategy, d, f }: { box: Box; strategy: GasStrategy; d: number; f: number }) {
  const clip = useSvgId('kropp');
  const scaleH = 30 * f;
  const Rpx = Math.min(box.w / 2 - 10, (box.h - scaleH) / 2 - 8);
  const cx = box.x + box.w / 2;
  const cy = box.y + (box.h - scaleH) / 2;
  const R = d / 2;
  const blood = strategy.needsBlood;
  const level = (u: number) => (blood ? 0.8 : o2At(R, strategy.Rc, u));
  const rings = 36;
  const core = blood ? 0 : anoxicCore(R, strategy.Rc);
  const coreR = core * Rpx;
  // O₂ når inn denne avstanden (m) uten hjelp
  const reach = blood ? R : R * (1 - core);

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={Rpx} />
        </clipPath>
      </defs>
      {Array.from({ length: rings }, (_, i) => {
        const u = 1 - i / rings;
        // Ugjennomsiktige ringer (blandet med bakgrunnen), så de ikke blir mørkere der de ligger oppå hverandre
        return <circle key={i} cx={cx} cy={cy} r={Rpx * u} style={{ fill: mixColor(VIZ.surface, o2Color(level(u - 0.5 / rings)), 0.5) }} />;
      })}
      {/* Trakeer fra åndehullene langs kanten */}
      {strategy.id === 'trakeer' && (
        <g clipPath={`url(#${clip})`}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + 0.3;
            return <Trachea key={i} cx={cx} cy={cy} R={Rpx} angle={a} />;
          })}
        </g>
      )}
      {/* Kapillærnett: blodet bringer O₂ til alle celler */}
      {blood && (
        <g clipPath={`url(#${clip})`}>
          <CapillaryMesh cx={cx} cy={cy} R={Rpx} />
        </g>
      )}
      <circle cx={cx} cy={cy} r={Rpx} fill="none" stroke={VIZ.ink} strokeOpacity={0.7} strokeWidth={2.5} />
      {coreR > 2 && <circle cx={cx} cy={cy} r={coreR} fill="none" stroke={VIZ.ink} strokeWidth={1.5} strokeDasharray="6 5" />}
      {coreR > 34 * f && (
        <Txt x={cx} y={cy + 6 * f} weight={700} size={0.85}>
          uten O₂
        </Txt>
      )}
      {/* Hvor langt O₂ når inn (når den ikke når midten) */}
      {!blood && core > 0 && (
        <g>
          <line x1={cx + Rpx} x2={cx + coreR} y1={cy} y2={cy} stroke={VIZ.ink} strokeWidth={2} />
          <line x1={cx + Rpx} x2={cx + Rpx} y1={cy - 8} y2={cy + 8} stroke={VIZ.ink} strokeWidth={2} />
          <line x1={cx + coreR} x2={cx + coreR} y1={cy - 8} y2={cy + 8} stroke={VIZ.ink} strokeWidth={2} />
          <Txt x={cx + (Rpx + coreR) / 2} y={cy - 12} size={0.78} weight={650}>
            {formatMeters(reach)}
          </Txt>
        </g>
      )}
      <Txt x={cx} y={box.y + box.h - 6} size={0.85} weight={650}>
        tykkelse {formatMeters(d)}
      </Txt>
    </g>
  );
}

/** Én trake fra kanten innover, med to forgreninger. */
function Trachea({ cx, cy, R, angle }: { cx: number; cy: number; R: number; angle: number }) {
  const pt = (r: number, a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  const [x0, y0] = pt(R, angle);
  const [x1, y1] = pt(R * 0.55, angle);
  const branches = [-0.35, 0.35].map((da) => pt(R * 0.25, angle + da));
  const twigs = [-0.6, -0.15, 0.15, 0.6].map((da) => [pt(R * 0.72, angle + da), pt(R * 0.82, angle + da * 0.4)] as const);
  return (
    <g fill="none" stroke={BIO.insekt.line} strokeLinecap="round">
      <path d={`M${x0},${y0} L${x1},${y1}`} strokeWidth={4} />
      {branches.map(([bx, by], i) => (
        <path key={i} d={`M${x1},${y1} Q${(x1 + bx) / 2},${(y1 + by) / 2} ${bx},${by}`} strokeWidth={2.4} />
      ))}
      {twigs.map(([[ax, ay], [bx, by]], i) => (
        <path key={`t${i}`} d={`M${bx},${by} L${ax},${ay}`} strokeWidth={1.4} opacity={0.8} />
      ))}
      <circle cx={x0} cy={y0} r={5} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.6} />
    </g>
  );
}

/** Kapillærnett i et sekskantmønster (bare til illustrasjon). */
function CapillaryMesh({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  const step = 30;
  const lines: ReactNode[] = [];
  for (const deg of [0, 60, 120]) {
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    for (let o = -R; o <= R; o += step) {
      const px = cx - uy * o;
      const py = cy + ux * o;
      lines.push(
        <line
          key={`${deg}-${o}`}
          x1={px - ux * R}
          y1={py - uy * R}
          x2={px + ux * R}
          y2={py + uy * R}
          stroke={deg === 60 ? BIO.oksygenfattig : BIO.oksygenrikt}
          strokeWidth={2}
          strokeDasharray={deg === 0 ? undefined : '10 6'}
          opacity={0.8}
        />,
      );
    }
  }
  return <g>{lines}</g>;
}

/* ---------- Gassutvekslingsorganene (skjematiske) ---------- */

/** Hjelpere for normaliserte koordinater i boksen. */
const at = (b: Box) => ({ X: (u: number) => b.x + u * b.w, Y: (v: number) => b.y + v * b.h });

function OrganHud({ box, d }: { box: Box; d: number }) {
  const { X, Y } = at(box);
  const f = useTextScale();
  const R = d / 2;
  // Vevet under huden, fra overflaten (øverst) og inn til midten av kroppen (nederst), i fem lag
  const bands = Array.from({ length: 5 }, (_, i) => ({ i, l: o2At(R, RC_SKIN, 1 - (i + 0.5) / 5) }));
  const top = 0.44;
  const bh = 0.09;
  const cells = Array.from({ length: 7 }, (_, i) => i);
  const core = anoxicCore(R, RC_SKIN);
  // Pilene viser hvor langt O₂ når (andel av veien inn til midten)
  const reach = core > 0 ? 1 - core : 1;
  return (
    <g>
      {/* Vann over huden */}
      <rect x={X(0)} y={Y(0)} width={box.w} height={box.h * 0.36} rx={14} fill={BIO.vannFyll} />
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          key={i}
          cx={X(0.06 + (i % 7) * 0.145)}
          cy={Y(0.2 + Math.floor(i / 7) * 0.08 + (i % 2) * 0.025)}
          r={3.6 * Math.max(1, f * 0.85)}
          fill={BIO.oksygenrikt}
          opacity={0.85}
        />
      ))}
      {/* Huden (ett cellelag) */}
      {cells.map((i) => (
        <rect
          key={i}
          x={X(0.02 + i * 0.137)}
          y={Y(0.36)}
          width={box.w * 0.13}
          height={box.h * 0.075}
          rx={4}
          fill={BIO.pattedyr.fill}
          stroke={BIO.pattedyr.line}
          strokeWidth={1.3}
        />
      ))}
      {/* Vevet under: farget etter O₂ */}
      {bands.map(({ i, l }) => (
        <rect key={i} x={X(0.02)} y={Y(top + i * bh)} width={box.w * 0.96} height={box.h * bh} style={{ fill: o2Color(l) }} opacity={0.45} />
      ))}
      <rect x={X(0.02)} y={Y(top)} width={box.w * 0.96} height={box.h * bh * 5} fill="none" stroke={VIZ.grid} strokeWidth={1.2} />
      {[0.2, 0.5, 0.8].map((u) => (
        <Arrow key={u} x1={X(u)} y1={Y(0.2)} x2={X(u)} y2={Y(top + 5 * bh * reach) - 2} color={BIO.oksygenrikt} width={3} head={10} />
      ))}
      <Txt x={X(0.03)} y={Y(0.04) + 12 * f} anchor="start" size={0.78} weight={650} color={BIO.vann}>
        vann eller fuktig luft
      </Txt>
      <Txt x={X(0.97)} y={Y(top) + 14 * f} anchor="end" size={0.72} muted>
        overflaten
      </Txt>
      <Txt x={X(0.97)} y={Y(top + 5 * bh) - 6} anchor="end" size={0.72} muted>
        midten
      </Txt>
      <Txt x={X(0.5)} y={Y(0.985)} size={0.78} weight={650}>
        {core > 0 ? `O₂ når bare ${formatMeters((d / 2) * (1 - core))} inn` : 'O₂ når helt inn til midten'}
      </Txt>
    </g>
  );
}

function OrganTrakeer({ box }: { box: Box }) {
  const { X, Y } = at(box);
  const f = useTextScale();
  const tubeY = Y(0.45);
  const rings = Array.from({ length: 9 }, (_, i) => X(0.13 + i * 0.035));
  const ends = [0.2, 0.4, 0.6, 0.8].map((v) => Y(v));
  return (
    <g>
      {/* Kroppsveggen med åndehull */}
      <rect x={X(0.03)} y={Y(0.06)} width={box.w * 0.07} height={box.h * 0.82} rx={6} fill={BIO.insekt.fill} stroke={BIO.insekt.line} strokeWidth={1.5} />
      <ellipse cx={X(0.065)} cy={tubeY} rx={box.w * 0.035} ry={10} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={1.8} />
      {/* Trake med ringer (spiralfortykkelser) */}
      <rect x={X(0.1)} y={tubeY - 11} width={box.w * 0.36} height={22} rx={10} fill={VIZ.surface} stroke={BIO.insekt.line} strokeWidth={2} />
      {rings.map((x) => (
        <line key={x} x1={x} x2={x} y1={tubeY - 10} y2={tubeY + 10} stroke={BIO.insekt.line} strokeWidth={1.2} opacity={0.7} />
      ))}
      {/* Trakeoler helt inn til muskelcellene */}
      {ends.map((y, i) => (
        <path
          key={i}
          d={`M${X(0.46)},${tubeY} C${X(0.55)},${tubeY} ${X(0.52)},${y} ${X(0.66)},${y}`}
          fill="none"
          stroke={BIO.insekt.line}
          strokeWidth={2.2}
        />
      ))}
      {ends.map((y, i) => (
        <g key={`c${i}`}>
          <rect x={X(0.66)} y={y - box.h * 0.07} width={box.w * 0.3} height={box.h * 0.14} rx={8} fill={BIO.mitokondrie.fill} stroke={BIO.mitokondrie.line} strokeWidth={1.3} opacity={0.9} />
          <ellipse cx={X(0.76)} cy={y} rx={9} ry={4.5} fill="none" stroke={BIO.mitokondrie.line} strokeWidth={1.3} />
          <ellipse cx={X(0.87)} cy={y} rx={9} ry={4.5} fill="none" stroke={BIO.mitokondrie.line} strokeWidth={1.3} />
        </g>
      ))}
      <Arrow x1={X(-0.01) + 2} y1={Y(0.32)} x2={X(0.06)} y2={tubeY - 12} color={BIO.vann} width={2.5} head={9} />
      <Etikett x={X(0.065)} y={tubeY + 10} lx={X(0.03)} ly={Y(0.97)} anchor="start" size={0.78}>
        åndehull
      </Etikett>
      <Etikett x={X(0.3)} y={tubeY - 11} lx={X(0.18)} ly={Y(0.06) + 10 * f} anchor="start" size={0.78}>
        trake
      </Etikett>
      <Etikett x={X(0.58)} y={Y(0.62)} lx={X(0.5)} ly={Y(0.97)} anchor="middle" size={0.78}>
        trakeoler
      </Etikett>
      <Txt x={X(0.81)} y={Y(0.07) + 4 * f} size={0.75} muted>
        muskelceller
      </Txt>
    </g>
  );
}

function OrganGjeller({ box }: { box: Box }) {
  const f = useTextScale();
  // Gjellefilamentet fyller boksen; teksten om motstrøm står nederst
  const inner: Box = { x: box.x + 10, y: box.y + 8, w: box.w - 20, h: box.h - 30 * f - 8 };
  return (
    <g>
      <GjelleFilament box={inner} />
      <Txt x={box.x + box.w / 2} y={box.y + box.h - 12} size={0.75} muted>
        blodet går motsatt vei av vannet (motstrøm)
      </Txt>
    </g>
  );
}

function OrganLunger({ box }: { box: Box }) {
  const { X, Y } = at(box);
  const f = useTextScale();
  const alv = [
    [0.5, 0.42],
    [0.62, 0.36],
    [0.72, 0.48],
    [0.58, 0.6],
    [0.7, 0.68],
    [0.46, 0.68],
    [0.82, 0.58],
  ] as const;
  const r = Math.min(box.w, box.h) * 0.085;
  return (
    <g>
      {/* Bronkiole som ender i lungeblærer */}
      <path
        d={`M${X(0.06)},${Y(0.12)} Q${X(0.3)},${Y(0.18)} ${X(0.5)},${Y(0.42)}`}
        fill="none"
        stroke={BIO.pattedyr.line}
        strokeWidth={18}
        strokeLinecap="round"
        opacity={0.35}
      />
      {alv.map(([u, v], i) => (
        <g key={i}>
          <circle cx={X(u)} cy={Y(v)} r={r} fill={VIZ.surface} stroke={BIO.pattedyr.line} strokeWidth={1.8} />
          <path
            d={`M${X(u) - r},${Y(v)} Q${X(u)},${Y(v) - r * 1.25} ${X(u) + r},${Y(v)}`}
            fill="none"
            stroke={BIO.oksygenfattig}
            strokeWidth={1.6}
            opacity={0.8}
          />
          <path
            d={`M${X(u) - r},${Y(v)} Q${X(u)},${Y(v) + r * 1.25} ${X(u) + r},${Y(v)}`}
            fill="none"
            stroke={BIO.oksygenrikt}
            strokeWidth={1.6}
            opacity={0.8}
          />
        </g>
      ))}
      {/* Luft inn og ut samme vei */}
      <Arrow x1={X(0.08)} y1={Y(0.22)} x2={X(0.32)} y2={Y(0.28)} color={BIO.vann} width={3} head={10} />
      <Arrow x1={X(0.3)} y1={Y(0.36)} x2={X(0.06)} y2={Y(0.3)} color={BIO.vann} width={3} head={10} />
      <Txt x={X(0.04)} y={Y(0.45)} anchor="start" size={0.78} weight={650} color={BIO.vann}>
        inn og ut
      </Txt>
      <Txt x={X(0.04)} y={Y(0.45) + 19 * f * 0.78} anchor="start" size={0.78} weight={650} color={BIO.vann}>
        samme vei
      </Txt>
      <Etikett x={X(0.3)} y={Y(0.2)} lx={X(0.42)} ly={Y(0.08)} anchor="start" size={0.78}>
        bronkiole
      </Etikett>
      <Etikett x={X(0.58) + r * 0.7} y={Y(0.6) + r * 0.7} lx={X(0.5)} ly={Y(0.95)} anchor="middle" size={0.78}>
        lungeblærer med kapillærer
      </Etikett>
    </g>
  );
}

function OrganFuglelunger({ box }: { box: Box }) {
  const { X, Y } = at(box);
  const f = useTextScale();
  const lung = { x: X(0.38), y: Y(0.38), w: box.w * 0.28, h: box.h * 0.24 };
  const midY = lung.y + lung.h / 2;
  return (
    <g>
      {/* Luftrøret inn til lungen */}
      <path d={`M${X(0.02)},${midY} L${lung.x},${midY}`} stroke={BIO.fugl.line} strokeWidth={12} strokeLinecap="round" opacity={0.35} />
      {/* Fremre og bakre luftsekker */}
      <ellipse cx={X(0.2)} cy={Y(0.2)} rx={box.w * 0.12} ry={box.h * 0.1} fill={BIO.fugl.fill} stroke={BIO.fugl.line} strokeWidth={1.8} />
      <ellipse cx={X(0.84)} cy={Y(0.56)} rx={box.w * 0.12} ry={box.h * 0.2} fill={BIO.fugl.fill} stroke={BIO.fugl.line} strokeWidth={1.8} />
      {/* Lungen med parallelle parabronkier */}
      <rect x={lung.x} y={lung.y} width={lung.w} height={lung.h} rx={10} fill={BIO.rodtBlodlegeme.fill} stroke={BIO.rodtBlodlegeme.line} strokeWidth={1.8} />
      {[0.25, 0.75].map((v) => (
        <line key={v} x1={lung.x + 8} x2={lung.x + lung.w - 8} y1={lung.y + lung.h * v} y2={lung.y + lung.h * v} stroke={BIO.rodtBlodlegeme.line} strokeWidth={1.4} opacity={0.7} />
      ))}
      {/* 1: inn gjennom luftrøret, under lungen og til de bakre sekkene */}
      <path
        d={`M${X(0.26)},${midY + 10} Q${X(0.3)},${Y(0.84)} ${X(0.52)},${Y(0.82)}`}
        fill="none"
        stroke={BIO.vann}
        strokeWidth={2.8}
      />
      <Arrow x1={X(0.52)} y1={Y(0.82)} x2={X(0.74)} y2={Y(0.7)} color={BIO.vann} width={2.8} head={10} />
      <Txt x={X(0.4)} y={Y(0.82) + 20 * f} size={0.78} weight={700} color={BIO.vann}>
        1 inn
      </Txt>
      {/* 2: gjennom lungen bakfra og fram, én vei (utånding) */}
      <Arrow x1={X(0.76)} y1={midY} x2={lung.x + 10} y2={midY} color={BIO.vann} width={4} head={12} />
      {/* 3: fra lungen til de fremre sekkene (neste innånding), 4: ut gjennom luftrøret (neste utånding) */}
      <Arrow x1={lung.x + 6} y1={lung.y - 4} x2={X(0.3)} y2={Y(0.27)} color={BIO.vann} width={2.8} head={10} />
      <Arrow x1={X(0.12)} y1={Y(0.29)} x2={X(0.08)} y2={midY - 10} color={BIO.vann} width={2.8} head={10} />
      <Txt x={X(0.03)} y={Y(0.36) + 6 * f} anchor="start" size={0.78} weight={700} color={BIO.vann}>
        4 ut
      </Txt>
      <Txt x={X(0.52)} y={lung.y - 10} size={0.78} weight={650}>
        lunge
      </Txt>
      <Txt x={X(0.52)} y={lung.y + lung.h + 18 * f} size={0.72} weight={700} color={BIO.vann}>
        2 ut · én vei
      </Txt>
      <Txt x={X(0.335)} y={Y(0.375)} anchor="end" size={0.78} weight={700} color={BIO.vann}>
        3 inn
      </Txt>
      <Txt x={X(0.2)} y={Y(0.2) + 5 * f} size={0.72} weight={650}>
        fremre
      </Txt>
      <Txt x={X(0.84)} y={Y(0.56) + 5 * f} size={0.72} weight={650}>
        bakre
      </Txt>
      <Txt x={X(0.97)} y={Y(0.97)} anchor="end" size={0.75} muted>
        luftsekker: fremre og bakre
      </Txt>
    </g>
  );
}

/* ====================================================================== */
/* Graf: andel av kroppen med nok O₂ mot kroppens tykkelse                  */
/* ====================================================================== */

const TICKS = [-4, -3, -2, -1, 0];
const TICK_LABEL: Record<number, string> = { [-4]: '0,1 mm', [-3]: '1 mm', [-2]: '1 cm', [-1]: '10 cm', [0]: '1 m' };

function CoverageFigure({ strategy, exp }: { strategy: GasStrategy; exp: number }) {
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const H = Math.round(320 + 260 * (f - 1));
  const sel = lineKey(strategy);
  const curve = (s: GasStrategy) => {
    const pts: [number, number][] = [];
    for (let v = SIZE_MIN_EXP; v <= SIZE_MAX_EXP + 1e-9; v += 0.02) pts.push([v, 100 * o2Coverage(s, 10 ** v)]);
    return pts;
  };
  const hud = getStrategy('hud');
  const trak = getStrategy('trakeer');
  const blod = getStrategy('lunger');
  const cov = 100 * o2Coverage(strategy, 10 ** exp);
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 800 ${H}`}
        label={`Andel av kroppen som får nok O₂ mot kroppens tykkelse. Bare diffusjon: opptil ca. ${formatMeters(maxDiameter(hud))}. Trakeer: opptil ca. ${formatMeters(
          maxDiameter(trak),
        )}. Med blodkretsløp: alle størrelser.`}
      >
        <Plot
          x={{ min: SIZE_MIN_EXP, max: SIZE_MAX_EXP, label: 'Kroppens tykkelse (logaritmisk skala)', ticks: [] }}
          y={{ min: 0, max: 100, label: 'Får nok O₂ (%)', ticks: [0, 25, 50, 75, 100] }}
          width={800}
          height={H}
        >
          {({ sx, sy, y0, y1 }) => (
            <g>
              {TICKS.map((v) => (
                <g key={v}>
                  <line x1={sx(v)} x2={sx(v)} y1={y0} y2={y1} className="viz-gridline" />
                  {(f <= 1.3 || v % 2 === 0) && (
                    <text x={sx(v)} y={y0 + 22 * f} textAnchor={v === SIZE_MIN_EXP ? 'start' : v === SIZE_MAX_EXP ? 'end' : 'middle'} className="viz-tick">
                      {TICK_LABEL[v]}
                    </text>
                  )}
                </g>
              ))}
              <CoverageLine pts={curve(blod)} color={LINE.blod} on={sel === 'blod'} sx={sx} sy={sy} offset={-3} />
              <CoverageLine pts={curve(trak)} color={LINE.trakeer} on={sel === 'trakeer'} sx={sx} sy={sy} />
              <CoverageLine pts={curve(hud)} color={LINE.hud} on={sel === 'hud'} sx={sx} sy={sy} />
              <LimitLabel x={sx(Math.log10(maxDiameter(hud)))} y={sy(100)} text={`ca. ${formatMeters(2 * RC_SKIN)}`} color={LINE.hud} below />
              <LimitLabel x={sx(Math.log10(2 * RC_TRACHEA))} y={sy(100)} text={`ca. ${formatMeters(2 * RC_TRACHEA)}`} color={LINE.trakeer} below />
              <line x1={sx(exp)} x2={sx(exp)} y1={y0} y2={y1} className="viz-guide" />
              <circle cx={sx(exp)} cy={sy(cov)} r={8} fill={LINE[sel]} stroke={VIZ.surface} strokeWidth={2.5} />
            </g>
          )}
        </Plot>
      </Figure>
    </div>
  );
}

function CoverageLine({
  pts,
  color,
  on,
  sx,
  sy,
  offset = 0,
}: {
  pts: [number, number][];
  color: string;
  on: boolean;
  sx: (v: number) => number;
  sy: (v: number) => number;
  offset?: number;
}) {
  return (
    <path
      d={linePath(pts, sx, (v) => sy(v) + offset)}
      fill="none"
      stroke={color}
      strokeWidth={on ? 4 : 2.2}
      opacity={on ? 1 : 0.55}
      strokeLinejoin="round"
    />
  );
}

function LimitLabel({ x, y, text, color, below }: { x: number; y: number; text: string; color: string; below?: boolean }) {
  const f = useTextScale();
  return (
    <g>
      <circle cx={x} cy={y} r={4} fill={color} />
      <Txt x={x - 6} y={below ? y + 22 * f : y - 10} anchor="end" size={0.78} weight={650} color={color}>
        {text}
      </Txt>
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(s: GasStrategy, d: number, cov: number): ReactNode {
  const size = formatMeters(d);
  const t = formatDuration(diffusionTime(d / 2));
  const fails = cov < 0.999;
  switch (s.id) {
    case 'hud':
      return (
        <>
          <p>
            {fails ? (
              <>
                <strong>For tykk til bare å puste gjennom huden.</strong> O₂ diffunderer inn fra overflaten, men cellene på veien bruker det
                opp. I en kropp som er {size} tykk, når O₂ ikke fram til cellene i midten (grått): bare {fmtPct(cov)} av kroppen får nok. Det
                ville tatt ca. {t} for O₂ å diffundere inn til midten.
              </>
            ) : (
              <>
                <strong>Liten nok til diffusjon.</strong> Kroppen er bare {size} tykk, så O₂ når inn til midten ved diffusjon gjennom huden
                (ca. {t}). Dyret trenger verken gjeller, lunger eller blod for å få O₂.
              </>
            )}
          </p>
          <p>
            Diffusjon går raskt over korte avstander, men tida øker med kvadratet av avstanden: med vanlig stoffskifte holder det bare for en
            kropp som er opptil ca. {formatMeters(2 * RC_SKIN)} tykk. Samtidig vokser overflaten med kvadratet av størrelsen, mens volumet (og
            O₂-behovet) vokser med kubikken: ti ganger tykkere kropp har ti ganger mindre overflate per volum. Dyr som bare puster gjennom huden, er derfor små (hjuldyr), flate
            (flatormer, og bendelormen kan bli flere meter lang) eller har lite levende vev (maneter). Meitemarken puster også gjennom huden,
            men den har blodkretsløp som frakter O₂ videre innover.
          </p>
        </>
      );
    case 'trakeer':
      return (
        <>
          <p>
            <strong>Luften føres helt inn til cellene.</strong> Insekter har luftfylte rør, trakeer, som går fra åndehull på siden av
            kroppen og forgrener seg til tynne trakeoler som ender inntil hver celle. O₂ diffunderer omtrent 10 000 ganger raskere i luft enn
            i vann, og luft inneholder ca. 30 ganger så mye O₂. Derfor trenger insekter ikke blod til å frakte O₂.
          </p>
          <p>
            {fails ? (
              <>
                Men også i trakeene må O₂ diffundere, og i en kropp som er {size} tykk, går det for sakte: bare {fmtPct(cov)} av kroppen får
                nok O₂.{' '}
              </>
            ) : (
              <>En kropp som er {size} tykk, får O₂ til alle cellene. </>
            )}
            Trakeene setter en grense for hvor store insekter kan bli: de største billene er bare noen få centimeter tykke (her ca.{' '}
            {formatMeters(2 * RC_TRACHEA)}). Store insekter pumper luft inn og ut ved å bevege bakkroppen.
          </p>
        </>
      );
    case 'gjeller':
      return (
        <>
          <p>
            <strong>Gjeller og blod.</strong> Gjellene er tynne utvekster med enorm overflate: hver gjellebue har mange gjellefilamenter, og
            hvert filament har tettpakkede lameller. Vannet strømmer mellom lamellene, og avstanden til blodet er bare noen få mikrometer.
            Blodet går motsatt vei av vannet (motstrøm), så fisken kan ta opp mye av O₂-et i vannet.
          </p>
          <p>
            Blodkretsløpet frakter O₂-et videre, så hver celle har en kapillær like ved seg. Derfor får hele kroppen O₂ selv om fisken er{' '}
            {size} tykk; ved diffusjon alene ville det tatt ca. {t} å nå midten. Vann har lite O₂ og er tungt å flytte, så fisken må pumpe mye
            vann over gjellene.
          </p>
        </>
      );
    case 'lunger':
      return (
        <>
          <p>
            <strong>Lunger og blod.</strong> Lungene ligger inne i kroppen, så den tynne overflaten holdes fuktig uten å tørke ut. Hos
            mennesket gir 300–500 millioner lungeblærer (alveoler) en samlet overflate på ca. {fmt(HUMAN_LUNG_AREA, 0)} m², omtrent{' '}
            {fmt(HUMAN_LUNG_AREA / HUMAN_SKIN_AREA, 0)} ganger så mye som huden (ca. {fmt(HUMAN_SKIN_AREA, 1)} m²), og luften er bare ca. 0,6 µm
            fra blodet. Blodkretsløpet frakter O₂ videre til alle cellene, så kroppen kan bli stor: diffusjon alene ville
            brukt ca. {t} inn til midten av en kropp som er {size} tykk.
          </p>
          <p>
            Luften går inn og ut samme vei (som tidevann). Noe brukt luft blir alltid igjen i lungene, så luften i lungeblærene har bare ca.
            14 % O₂ mot 21 % i lufta ute.
          </p>
        </>
      );
    case 'fuglelunger':
      return (
        <>
          <p>
            <strong>Luftsekker og én vei gjennom lungene.</strong> Fugler har stive lunger og flere luftsekker som virker som belger. Én porsjon
            luft bruker to pust på veien: ved innånding (1) går frisk luft til de bakre luftsekkene, ved utånding (2) presses den fra de bakre
            sekkene gjennom lungene, ved neste innånding (3) går den videre til de fremre sekkene, og ved neste utånding (4) går den ut gjennom
            luftrøret. Lufta strømmer derfor én vei gjennom de tynne rørene i lungene (parabronkiene) både når fuglen puster inn og ut, og
            lungene får hele tida frisk luft.
          </p>
          <p>
            Avstanden mellom luft og blod er bare ca. 0,2 µm, tynnere enn hos pattedyr. Sammen med et effektivt blodkretsløp gjør dette at
            fugler kan fly i tynn luft: stripegås (<em>Anser indicus</em>) krysser Himalaya i opptil ca. 7 000 meters høyde.
          </p>
        </>
      );
  }
}
