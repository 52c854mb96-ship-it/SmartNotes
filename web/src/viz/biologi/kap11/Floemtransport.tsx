import { useMemo, useState, type ReactNode } from 'react';
import {
  Arrow,
  BIO,
  Controls,
  Explain,
  Figure,
  Forvalg,
  Formula,
  FormulaLine,
  Legend,
  PlayBar,
  Readout,
  Readouts,
  Select,
  Slider,
  Toggle,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmt,
  mixColor,
  seededRandom,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import {
  NODES,
  ORGANS,
  PARENT,
  SEASONS,
  matchSeason,
  phloem,
  stemDirection,
  type NodeId,
  type OrganId,
  type PhloemResult,
  type Role,
  type Roles,
} from './model';

const C_SUGAR = BIO.sukker;
const C_WATER = BIO.vann;

/** Korte navn i bestemt form til tekst og etiketter. */
const NAME: Record<OrganId, string> = { skudd: 'skuddspissen', blomster: 'blomstene', blader: 'bladene', knoll: 'knollene', rot: 'røttene' };
const LABEL: Record<OrganId, string> = { skudd: 'Skuddspiss', blomster: 'Blomster', blader: 'Blader', knoll: 'Knoller', rot: 'Røtter' };
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'kilde', label: 'kilde' },
  { value: 'sluk', label: 'sluk' },
  { value: 'av', label: 'ingen' },
];

const list = (ids: OrganId[]) =>
  ids.length === 0 ? 'ingen' : ids.length === 1 ? NAME[ids[0]!] : `${ids.slice(0, -1).map((i) => NAME[i]).join(', ')} og ${NAME[ids[ids.length - 1]!]}`;

export default function Floemtransport() {
  const [roles, setRoles] = useState<Roles>(SEASONS[1]!.roles);
  const [girdled, setGirdled] = useState(false);
  const [light, setLight] = useState(100);
  const clock = useSimClock({ tMax: 600, loop: true });
  const r = useMemo(() => phloem(roles, girdled, light / 100), [roles, girdled, light]);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const season = matchSeason(roles);
  const dir = stemDirection(r);
  const sources = ORGANS.filter((o) => r.net[o.id] > 1e-6).map((o) => o.id);
  const sinks = ORGANS.filter((o) => r.net[o.id] < -1e-6).map((o) => o.id);
  const pMax = Math.max(...NODES.map((n) => r.pressure[n]));

  return (
    <VizLayout>
      <Toolbar>
        <Forvalg
          label="Årstid"
          options={SEASONS.map((s) => ({ value: s.id, label: s.name, detail: s.detail }))}
          value={season}
          onPick={(id) => setRoles(SEASONS.find((s) => s.id === id)!.roles)}
        />
      </Toolbar>
      <Toolbar>
        {ORGANS.map((o) => (
          <Select
            key={o.id}
            label={LABEL[o.id]}
            value={roles[o.id]}
            options={ROLE_OPTIONS}
            onChange={(v) => setRoles((old) => ({ ...old, [o.id]: v }))}
          />
        ))}
      </Toolbar>
      <Controls>
        <Slider label="Lys på bladene" value={light} onChange={setLight} min={0} max={100} step={5} unit="%" />
      </Controls>
      <Toolbar>
        <Toggle label="Ringbarking: fjern floemet rundt stengelen" checked={girdled} onChange={setGirdled} />
        <PlayBar clock={clock} time={`${fmt(clock.t, 0)} s`} />
      </Toolbar>

      <div ref={ref}>
        <Scene roles={roles} r={r} f={f} t={clock.t} girdled={girdled} sources={sources} sinks={sinks} />
      </div>
      <Legend
        items={[
          { color: C_SUGAR, label: 'Floem med sukker (tykkere = mer sukker)' },
          { color: C_WATER, label: 'Xylem med vann' },
          { color: BIO.plante.line, label: 'Kilde: laster sukker inn' },
          { color: VIZ.muted, label: 'Sluk: tar sukker ut', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Kilder" value={sources.length ? sources.map((i) => LABEL[i]).join(', ') : 'Ingen'} tone={BIO.plante.line} />
        <Readout label="Sluk" value={sinks.length ? sinks.map((i) => LABEL[i]).join(', ') : 'Ingen'} />
        <Readout
          label="Sukkeret i stengelen går"
          value={girdled ? 'Stopper ved ringen' : dir === 'ned' ? 'Nedover' : dir === 'opp' ? 'Oppover' : 'Står stille'}
          tone={C_SUGAR}
        />
        <Readout label="Største trykkforskjell i silrørene" value={fmt(pMax, 2)} unit="MPa" />
      </Readouts>

      <Formula label="Sukker inn og ut">
        {r.total > 1e-6 ? (
          <>
            <FormulaLine>
              {ORGANS.filter((o) => Math.abs(r.net[o.id]) > 1e-6)
                .map((o) => `${LABEL[o.id]} ${r.net[o.id] > 0 ? '+' : '−'}${fmt(Math.abs(r.net[o.id]), 2)}`)
                .join(' · ')}
            </FormulaLine>
            <FormulaLine>
              Relative enheter: + lastes inn, − tas ut. Summen er 0: det kildene laster inn, tar slukene ut
              {girdled && r.surplus > 1e-6 ? ' (unntatt det som hoper seg opp over ringen)' : ''}.
            </FormulaLine>
          </>
        ) : (
          <FormulaLine>Ingen organer laster sukker inn eller ut nå{girdled && r.surplus > 1e-6 ? ': sukkeret hoper seg opp over ringen' : ''}.</FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(roles, r, girdled, sources, sinks, season, light)}</Explain>
    </VizLayout>
  );
}

/* ====================================================================== */
/* Scenen                                                                   */
/* ====================================================================== */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Scene({
  roles,
  r,
  f,
  t,
  girdled,
  sources,
  sinks,
}: {
  roles: Roles;
  r: PhloemResult;
  f: number;
  t: number;
  girdled: boolean;
  sources: OrganId[];
  sinks: OrganId[];
}) {
  const narrow = f > 1.3;
  const titleH = 26 * f;
  const P: Box = narrow ? { x: 20, y: titleH, w: 760, h: 620 } : { x: 20, y: titleH, w: 440, h: 470 };
  const M: Box = narrow ? { x: 20, y: P.y + P.h + titleH + 24, w: 760, h: 380 } : { x: 480, y: titleH, w: 300, h: 470 };
  const H = Math.round(M.y + M.h + 8);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1500 : H}
      label={`Potetplante. Kilder: ${list(sources)}. Sluk: ${list(sinks)}. Sukkeret strømmer fra kildene til slukene.`}
    >
      <Txt x={P.x + 4} y={P.y - 10} anchor="start" weight={700}>
        Potetplante (<tspan fontStyle="italic">Solanum tuberosum</tspan>)
      </Txt>
      <PlantPanel box={P} roles={roles} r={r} t={t} girdled={girdled} />
      <Txt x={M.x + 4} y={M.y - 10} anchor="start" weight={700}>
        Trykkstrømmodellen
      </Txt>
      <MunchPanel box={M} r={r} t={t} source={sources[0] ?? null} sink={strongestSink(r, sinks)} narrow={narrow} />
    </Figure>
  );
}

function strongestSink(r: PhloemResult, sinks: OrganId[]): OrganId | null {
  if (sinks.length === 0) return null;
  return sinks.reduce((a, b) => (r.net[b] < r.net[a] ? b : a));
}

/* ---------- Planten ---------- */

type Pt = readonly [number, number];

function pointOn(pts: readonly Pt[], u: number): Pt {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let left = Math.min(1, Math.max(0, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]! || i === seg.length - 1) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const s = seg[i]! > 0 ? Math.min(1, left / seg[i]!) : 0;
      return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    }
    left -= seg[i]!;
  }
  return pts[pts.length - 1]!;
}

const pathD = (pts: readonly Pt[]) => `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`;

function PlantPanel({ box, roles, r, t, girdled }: { box: Box; roles: Roles; r: PhloemResult; t: number; girdled: boolean }) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  const X = (u: number) => box.x + u * box.w;
  const Y = (v: number) => box.y + v * box.h;
  const sx = X(0.5);
  const gy = Y(0.56);
  const pos: Record<NodeId, Pt> = {
    skudd: [sx, Y(0.05)],
    blomster: [sx, Y(0.16)],
    blader: [sx, Y(0.33)],
    fot: [sx, gy],
    knoll: [X(0.77), Y(0.83)],
    rot: [X(0.3), Y(0.9)],
  };
  // Grenene fra hver node til forelderen (stengel, stolon, rot)
  const edges: Record<Exclude<NodeId, 'fot'>, Pt[]> = {
    skudd: [pos.skudd, pos.blomster],
    blomster: [pos.blomster, pos.blader],
    blader: [pos.blader, pos.fot],
    knoll: [pos.knoll, [X(0.7), Y(0.7)], [X(0.56), gy + 18], pos.fot],
    rot: [pos.rot, [X(0.4), Y(0.74)], [sx - 6, gy + 20], pos.fot],
  };
  const flowMax = Math.max(0.2, ...NODES.map((n) => Math.abs(r.flow[n])));
  const width = (q: number) => 2 + (10 * Math.abs(q)) / flowMax;
  const pMax = Math.max(1e-6, ...NODES.map((n) => r.pressure[n]));
  const leafSide = [-1, 1] as const;
  const leaflet = (x: number, y: number, len: number, ang: number) => {
    const a = (ang * Math.PI) / 180;
    const tx = x + Math.cos(a) * len;
    const ty = y + Math.sin(a) * len;
    const nx = -Math.sin(a) * len * 0.3;
    const ny = Math.cos(a) * len * 0.3;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    return `M${x},${y} Q${mx + nx},${my + ny} ${tx},${ty} Q${mx - nx},${my - ny} ${x},${y} Z`;
  };
  const girdleY = Y(0.46);
  const role = (id: OrganId) => roles[id];
  const roleColor = (id: OrganId) => (r.net[id] > 1e-6 ? BIO.plante.line : r.net[id] < -1e-6 ? VIZ.ink : VIZ.muted);
  const roleText = (id: OrganId) =>
    role(id) === 'av' ? 'ingen rolle' : r.net[id] > 1e-6 ? 'kilde' : r.net[id] < -1e-6 ? 'sluk' : role(id) === 'kilde' ? 'kilde (fullt)' : 'sluk (sulter)';
  // Bladene: to sammensatte blader fra bladnoden
  const leafBase = pos.blader;
  const leaves = leafSide.map((side) => {
    const end: Pt = [leafBase[0] + side * box.w * 0.34, leafBase[1] - box.h * 0.04];
    return { side, end };
  });
  // Blomsterstand til høyre for blomsternoden
  const flowerEnd: Pt = [pos.blomster[0] + box.w * 0.16, pos.blomster[1] - box.h * 0.03];
  const sugarDots = (pts: readonly Pt[], q: number, n: number, seed: number) => {
    if (Math.abs(q) < 1e-6) return null;
    // Positiv q: fra noden mot forelderen (pts[0] → siste)
    const speed = 0.12 * Math.min(1.5, Math.abs(q) / flowMax + 0.3);
    return Array.from({ length: n }, (_, i) => {
      const u0 = (i / n + seed * 0.13 + speed * t) % 1;
      const u = q > 0 ? u0 : 1 - u0;
      const [x, y] = pointOn(pts, u);
      return <circle key={i} cx={x} cy={y} r={3.4 * k} fill={C_SUGAR} stroke={VIZ.surface} strokeWidth={1} />;
    });
  };
  const chevron = (pts: readonly Pt[], q: number) => {
    if (Math.abs(q) < 1e-6) return null;
    const a = pointOn(pts, 0.48);
    const b = pointOn(pts, 0.52);
    const dir = q > 0 ? 1 : -1;
    const ang = (Math.atan2((b[1] - a[1]) * dir, (b[0] - a[0]) * dir) * 180) / Math.PI;
    const m = pointOn(pts, 0.5);
    const h = 9 + width(q) * 0.4;
    return <polygon points={`${h},0 ${-h * 0.7},${-h * 0.8} ${-h * 0.7},${h * 0.8}`} transform={`translate(${m[0]} ${m[1]}) rotate(${ang})`} fill={VIZ.ink} opacity={0.7} />;
  };
  // Organenes egen sukkerstrøm mellom organet og noden (blader og blomster sitter på korte grener)
  const organLinks: { id: OrganId; pts: Pt[] }[] = [
    ...leaves.map((l) => ({ id: 'blader' as OrganId, pts: [l.end, leafBase] as Pt[] })),
    { id: 'blomster', pts: [flowerEnd, pos.blomster] },
  ];
  const labelPos: Record<OrganId, { x: number; y: number; anchor: 'start' | 'end' }> = {
    skudd: { x: sx + 16, y: Y(0.05) + 6 * f, anchor: 'start' },
    blomster: { x: flowerEnd[0] + 22, y: flowerEnd[1] + 6 * f, anchor: 'start' },
    blader: { x: X(0.02), y: Y(0.4) + 16 * f, anchor: 'start' },
    knoll: { x: X(0.98), y: Y(0.97), anchor: 'end' },
    rot: { x: X(0.02), y: Y(0.97), anchor: 'start' },
  };

  return (
    <g>
      {/* Jord */}
      <rect x={box.x} y={gy} width={box.w} height={box.y + box.h - gy} rx={10} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.22) }} />
      <line x1={box.x} x2={box.x + box.w} y1={gy} y2={gy} stroke={BIO.ved} strokeWidth={2} />

      {/* Stengel, stolon og røtter (plantevev) */}
      <path d={pathD([pos.skudd, pos.fot])} stroke={BIO.plante.line} strokeWidth={16} strokeLinecap="round" opacity={0.35} />
      <path d={pathD(edges.knoll)} fill="none" stroke={BIO.ved} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
      <path d={pathD(edges.rot)} fill="none" stroke={BIO.ved} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
      {[-1, 1].map((s) => (
        <path key={s} d={`M${pos.rot[0] + 40},${pos.rot[1] - 50} q${s * 30},20 ${s * 40},56`} fill="none" stroke={BIO.ved} strokeWidth={3} opacity={0.5} />
      ))}
      {/* Blader */}
      {leaves.map((l) => (
        <g key={l.side}>
          <line x1={leafBase[0]} y1={leafBase[1]} x2={l.end[0]} y2={l.end[1]} stroke={BIO.plante.line} strokeWidth={4} opacity={0.5} />
          {[0.35, 0.65, 1].map((u, i) => {
            const bx = leafBase[0] + (l.end[0] - leafBase[0]) * u;
            const by = leafBase[1] + (l.end[1] - leafBase[1]) * u;
            const len = box.w * (i === 2 ? 0.1 : 0.085);
            return (
              <g key={u}>
                {i < 2 ? (
                  <>
                    <path d={leaflet(bx, by, len, -90 + l.side * 12)} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.4} />
                    <path d={leaflet(bx, by, len, 90 + l.side * 12)} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.4} />
                  </>
                ) : (
                  <path d={leaflet(bx - (l.side * len) / 2, by, len, l.side > 0 ? 0 : 180)} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.4} />
                )}
              </g>
            );
          })}
        </g>
      ))}
      {/* Blomster */}
      <line x1={pos.blomster[0]} y1={pos.blomster[1]} x2={flowerEnd[0]} y2={flowerEnd[1]} stroke={BIO.plante.line} strokeWidth={3} opacity={0.5} />
      {[
        [0, 0],
        [16, -12],
        [18, 12],
      ].map(([dx, dy], i) => (
        <g key={i} transform={`translate(${flowerEnd[0] + dx!} ${flowerEnd[1] + dy!})`}>
          {Array.from({ length: 5 }, (_, j) => {
            const a = (j / 5) * Math.PI * 2;
            return <circle key={j} cx={Math.cos(a) * 6 * k} cy={Math.sin(a) * 6 * k} r={4.6 * k} fill={VIZ.surface} stroke={BIO.kromosom.far[2]} strokeWidth={1.3} />;
          })}
          <circle r={3 * k} fill={BIO.sukker} />
        </g>
      ))}
      {/* Skuddspiss */}
      <path d={leaflet(pos.skudd[0], pos.skudd[1] + 8, box.w * 0.05, -60)} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.3} />
      <path d={leaflet(pos.skudd[0], pos.skudd[1] + 8, box.w * 0.05, -120)} fill={BIO.plante.fill} stroke={BIO.plante.line} strokeWidth={1.3} />
      {/* Knoll */}
      <ellipse cx={pos.knoll[0]} cy={pos.knoll[1]} rx={box.w * 0.1} ry={box.h * 0.055} style={{ fill: mixColor(VIZ.surface, BIO.ved, 0.45) }} stroke={BIO.ved} strokeWidth={2} />
      {[
        [-0.04, -0.01],
        [0.03, 0.015],
      ].map(([du, dv], i) => (
        <circle key={i} cx={pos.knoll[0] + du! * box.w} cy={pos.knoll[1] + dv! * box.h} r={2.5} fill={BIO.ved} />
      ))}

      {/* Floemet: bredden følger sukkerstrømmen */}
      {(Object.keys(edges) as (keyof typeof edges)[]).map((n) => (
        <path
          key={n}
          d={pathD(edges[n])}
          fill="none"
          stroke={C_SUGAR}
          strokeWidth={width(r.flow[n])}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={Math.abs(r.flow[n]) > 1e-6 ? 0.85 : 0.3}
        />
      ))}
      {organLinks.map((o, i) => (
        <path key={`o${i}`} d={pathD(o.pts)} fill="none" stroke={C_SUGAR} strokeWidth={width(r.net[o.id] / (o.id === 'blader' ? 2 : 1))} strokeLinecap="round" opacity={Math.abs(r.net[o.id]) > 1e-6 ? 0.85 : 0.3} />
      ))}
      {(Object.keys(edges) as (keyof typeof edges)[]).map((n) => (
        <g key={`c${n}`}>{chevron(edges[n], r.flow[n])}</g>
      ))}
      {organLinks.map((o, i) => (
        <g key={`oc${i}`}>{chevron(o.pts, r.net[o.id])}</g>
      ))}
      {(Object.keys(edges) as (keyof typeof edges)[]).map((n, i) => (
        <g key={`d${n}`}>{sugarDots(edges[n], r.flow[n], 4, i)}</g>
      ))}
      {organLinks.map((o, i) => (
        <g key={`od${i}`}>{sugarDots(o.pts, r.net[o.id], 3, i + 5)}</g>
      ))}
      {/* Trykket i silrørene ved nodene */}
      {NODES.map((n) => (
        <circle
          key={`p${n}`}
          cx={pos[n][0]}
          cy={pos[n][1]}
          r={7 * k}
          style={{ fill: mixColor(VIZ.surface, C_SUGAR, 0.15 + (0.85 * r.pressure[n]) / pMax) }}
          stroke={VIZ.ink}
          strokeWidth={1.5}
        />
      ))}
      {/* Ringbarking */}
      {girdled && (
        <g>
          {r.surplus > 1e-6 && <ellipse cx={sx} cy={girdleY - 22} rx={16} ry={14} fill={C_SUGAR} opacity={0.45} />}
          <rect x={sx - 14} y={girdleY - 10} width={28} height={20} rx={4} fill={VIZ.surface} stroke={VIZ.ink} strokeWidth={2} strokeDasharray="4 3" />
          <Txt x={sx + 22} y={girdleY + 6} anchor="start" size={0.75} weight={700}>
            ringbarket
          </Txt>
        </g>
      )}
      {/* Etiketter med rolle */}
      {ORGANS.map((o) => {
        const l = labelPos[o.id];
        return (
          <Txt key={o.id} x={l.x} y={l.y} anchor={l.anchor} size={0.78} weight={700}>
            {LABEL[o.id]}:{' '}
            <tspan style={{ fill: roleColor(o.id) }} fontWeight={r.net[o.id] > 1e-6 ? 800 : 600}>
              {roleText(o.id)}
            </tspan>
          </Txt>
        );
      })}
    </g>
  );
}

/* ---------- Münch: kilde → sluk ---------- */

const MUNCH_DOTS = (() => {
  const r = seededRandom(31);
  return Array.from({ length: 40 }, () => ({ u: r(), v: r(), keep: r() }));
})();

function MunchPanel({
  box,
  r,
  t,
  source,
  sink,
  narrow,
}: {
  box: Box;
  r: PhloemResult;
  t: number;
  source: OrganId | null;
  sink: OrganId | null;
  narrow: boolean;
}) {
  const f = useTextScale();
  const k = Math.max(1, f * 0.85);
  const active = r.total > 1e-6 && source !== null && sink !== null;
  // Stående rør på PC (høy, smal boks), liggende på mobil (bred boks). Kilden øverst eller til venstre.
  const vertical = !narrow;
  const lh = 18 * f * 0.72;
  const tubeW = vertical ? 50 : 58;
  const gap = vertical ? 64 : 92;
  const nameH = 30 * f;
  const sieve: Box = vertical
    ? { x: box.x + box.w / 2 - gap / 2 - tubeW, y: box.y + nameH + 54, w: tubeW, h: box.h - 2 * nameH - 108 }
    : { x: box.x + 56, y: box.y + nameH + 70, w: box.w - 112, h: tubeW };
  const xylem: Box = vertical
    ? { x: box.x + box.w / 2 + gap / 2, y: sieve.y, w: tubeW, h: sieve.h }
    : { x: sieve.x, y: sieve.y + tubeW + gap, w: sieve.w, h: tubeW };
  /** Punkt en andel u langs røret; `across` på tvers (0 = venstre/øvre kant, 1 = høyre/nedre kant). */
  const along = (u: number, b: Box, across = 0.5): Pt => (vertical ? [b.x + b.w * across, b.y + b.h * u] : [b.x + b.w * u, b.y + b.h * across]);
  const speed = active ? 0.08 : 0;
  const srcName = source ? LABEL[source] : 'Kilde';
  const sinkName = sink ? LABEL[sink] : 'Sluk';
  // Sukker inn og ut: piler utenfra (fra venstre på PC, ovenfra på mobil)
  const sugarIn = along(0.08, sieve, 0);
  const sugarOut = along(0.92, sieve, 0);
  const d = vertical ? 44 : 50;
  const [inX, inY] = sugarIn;
  const [outX, outY] = sugarOut;
  // Vann mellom rørene
  const wIn1 = along(0.16, xylem, 0);
  const wIn2 = along(0.16, sieve, 1);
  const wOut1 = along(0.84, sieve, 1);
  const wOut2 = along(0.84, xylem, 0);
  const mid1 = along(0.43, sieve, 0.5);
  const mid2 = along(0.57, sieve, 0.5);
  const pHigh = along(0.28, sieve, 0.5);
  const pLow = along(0.72, sieve, 0.5);
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="none" stroke={VIZ.grid} strokeWidth={1.5} />
      {/* Silrør (floem) med silplater */}
      <rect x={sieve.x} y={sieve.y} width={sieve.w} height={sieve.h} rx={10} style={{ fill: mixColor(VIZ.surface, C_SUGAR, 0.12) }} stroke={C_SUGAR} strokeWidth={2.5} />
      {[0.2, 0.5, 0.8].map((u) => {
        const [a1, b1] = along(u, sieve, 0);
        const [a2, b2] = along(u, sieve, 1);
        return <line key={u} x1={a1} y1={b1} x2={a2} y2={b2} stroke={C_SUGAR} strokeWidth={2} strokeDasharray="4 4" />;
      })}
      {/* Vedrør (xylem) */}
      <rect x={xylem.x} y={xylem.y} width={xylem.w} height={xylem.h} rx={10} fill={BIO.vannFyll} stroke={C_WATER} strokeWidth={2.5} />
      {/* Sukker: tett ved kilden, glissent ved sluket */}
      {MUNCH_DOTS.map((dot, i) => {
        const u = (dot.u + speed * t) % 1;
        if (active ? dot.keep > 1 - 0.75 * u : dot.keep > 0.5) return null;
        const [x, y] = along(0.04 + 0.92 * u, sieve, 0.15 + 0.7 * dot.v);
        return <circle key={i} cx={x} cy={y} r={3.4 * k} fill={C_SUGAR} opacity={0.9} />;
      })}
      {active && (
        <g>
          {vertical ? (
            <>
              <Arrow x1={inX - d} y1={inY} x2={inX - 3} y2={inY} color={C_SUGAR} width={4} head={11} />
              <Arrow x1={outX - 3} y1={outY} x2={outX - d} y2={outY} color={C_SUGAR} width={4} head={11} />
              <Txt x={inX - d / 2} y={inY - 12} size={0.72} weight={650} color={C_SUGAR}>
                sukker inn
              </Txt>
              <Txt x={outX - d / 2} y={outY + 12 + lh} size={0.72} weight={650} color={C_SUGAR}>
                sukker ut
              </Txt>
            </>
          ) : (
            <>
              <Arrow x1={inX} y1={inY - d} x2={inX} y2={inY - 3} color={C_SUGAR} width={4} head={11} />
              <Arrow x1={outX} y1={outY - 3} x2={outX} y2={outY - d} color={C_SUGAR} width={4} head={11} />
              <Txt x={inX + 12} y={inY - d / 2 + 6} anchor="start" size={0.72} weight={650} color={C_SUGAR}>
                sukker inn
              </Txt>
              <Txt x={outX - 12} y={outY - d / 2 + 6} anchor="end" size={0.72} weight={650} color={C_SUGAR}>
                sukker ut
              </Txt>
            </>
          )}
          <Arrow x1={wIn1[0]} y1={wIn1[1]} x2={wIn2[0]} y2={wIn2[1]} color={C_WATER} width={3} head={10} />
          <Arrow x1={wOut1[0]} y1={wOut1[1]} x2={wOut2[0]} y2={wOut2[1]} color={C_WATER} width={3} head={10} />
          {vertical ? (
            <>
              <Txt x={xylem.x + xylem.w + 6} y={wIn1[1] - 2} anchor="start" size={0.7} weight={650} color={C_WATER}>
                vann
              </Txt>
              <Txt x={xylem.x + xylem.w + 6} y={wIn1[1] - 2 + lh} anchor="start" size={0.7} weight={650} color={C_WATER}>
                inn
              </Txt>
              <Txt x={xylem.x + xylem.w + 6} y={wOut2[1] - 2} anchor="start" size={0.7} weight={650} color={C_WATER}>
                vann
              </Txt>
              <Txt x={xylem.x + xylem.w + 6} y={wOut2[1] - 2 + lh} anchor="start" size={0.7} weight={650} color={C_WATER}>
                ut
              </Txt>
            </>
          ) : (
            <>
              <Txt x={wIn1[0] + 10} y={(wIn1[1] + wIn2[1]) / 2 + 6} anchor="start" size={0.72} weight={650} color={C_WATER}>
                vann inn (osmose)
              </Txt>
              <Txt x={wOut1[0] - 10} y={(wOut1[1] + wOut2[1]) / 2 + 6} anchor="end" size={0.72} weight={650} color={C_WATER}>
                vann ut
              </Txt>
            </>
          )}
          <Arrow x1={mid1[0]} y1={mid1[1]} x2={mid2[0]} y2={mid2[1]} color={VIZ.ink} width={3.5} head={12} />
        </g>
      )}
      {/* Trykket i silrøret og navnene på rørene */}
      {vertical ? (
        <>
          <Txt x={pHigh[0]} y={pHigh[1] - 2} size={0.7} weight={700}>
            høyt
          </Txt>
          <Txt x={pHigh[0]} y={pHigh[1] - 2 + lh} size={0.7} weight={700}>
            trykk
          </Txt>
          <Txt x={pLow[0]} y={pLow[1] - 2} size={0.7} weight={700}>
            lavt
          </Txt>
          <Txt x={pLow[0]} y={pLow[1] - 2 + lh} size={0.7} weight={700}>
            trykk
          </Txt>
          <Txt x={sieve.x + sieve.w / 2} y={sieve.y - 10} size={0.7} weight={650} color={C_SUGAR}>
            floem
          </Txt>
          <Txt x={xylem.x + xylem.w / 2} y={xylem.y - 10} size={0.7} weight={650} color={C_WATER}>
            xylem
          </Txt>
        </>
      ) : (
        <>
          <Txt x={pHigh[0]} y={pHigh[1] + 6 * f} size={0.72} weight={700}>
            høyt trykk
          </Txt>
          <Txt x={pLow[0]} y={pLow[1] + 6 * f} size={0.72} weight={700}>
            lavt trykk
          </Txt>
          <Txt x={xylem.x + xylem.w / 2} y={xylem.y + xylem.h / 2 + 6 * f} size={0.72} weight={650} color={C_WATER}>
            xylem (vann)
          </Txt>
        </>
      )}
      {/* Navnene på kilden og sluket */}
      <Txt
        x={vertical ? box.x + box.w / 2 : box.x + 14}
        y={box.y + 24 * f}
        anchor={vertical ? 'middle' : 'start'}
        weight={700}
        size={0.85}
        color={BIO.plante.line}
      >
        {active ? `${srcName} (kilde)` : 'Kilde'}
      </Txt>
      <Txt
        x={vertical ? box.x + box.w / 2 : box.x + box.w - 14}
        y={vertical ? box.y + box.h - 12 : box.y + 24 * f}
        anchor={vertical ? 'middle' : 'end'}
        weight={700}
        size={0.85}
      >
        {active ? `${sinkName} (sluk)` : 'Sluk'}
      </Txt>
      {!active && (
        <Txt x={box.x + box.w / 2} y={vertical ? box.y + box.h / 2 : xylem.y + xylem.h + 26 * f} size={0.75} weight={650} muted>
          ingen strøm
        </Txt>
      )}
    </g>
  );
}

/* ====================================================================== */
/* Forklaring                                                               */
/* ====================================================================== */

function explanation(
  roles: Roles,
  r: PhloemResult,
  girdled: boolean,
  sources: OrganId[],
  sinks: OrganId[],
  season: string | null,
  light: number,
): ReactNode {
  const munch = (
    <p>
      <strong>Trykkstrømmodellen.</strong> I en kilde pumper følgecellene sukrose inn i silrørene med aktiv transport (det koster ATP).
      Da blir det høy konsentrasjon av sukker, vann strømmer inn fra xylemet ved osmose, og trykket stiger. I et sluk tas sukkeret ut, vannet
      går ut igjen, og trykket blir lavt. Floemsaften strømmer fra høyt mot lavt trykk, altså fra kilde til sluk, og den kan gå både opp og
      ned i planten. Vannet i xylemet går derimot alltid oppover.
    </p>
  );
  let now: ReactNode;
  if (sources.length === 0 || sinks.length === 0) {
    const has = (rr: Role) => ORGANS.some((o) => roles[o.id] === rr);
    const why = !has('kilde')
      ? 'Det finnes ingen kilde som kan laste sukker inn i floemet.'
      : !has('sluk')
        ? 'Det finnes ingen sluk som kan ta imot sukkeret, så det blir ingen trykkforskjell.'
        : girdled
          ? 'Kildene og slukene er på hver sin side av ringen, så sukkeret kommer ikke fram.'
          : 'Bladene får ikke lys, så de lager ikke sukker ved fotosyntese og kan ikke være kilder.';
    now = (
      <p>
        <strong>Ingen sukkerstrøm.</strong> {why} Uten forskjell i trykk mellom to steder i silrørene strømmer ingenting.
      </p>
    );
  } else {
    const dir = stemDirection(r);
    now = (
      <p>
        {girdled ? (
          <>
            Kildene er {list(sources)}, og slukene er {list(sinks)}.{' '}
          </>
        ) : season === 'var' ? (
          <>
            <strong>Vår:</strong> settepoteten har ingen grønne blader ennå. Stivelsen i knollen brytes ned til sukker, som sendes{' '}
            <strong>oppover</strong> til skuddspissen, de unge bladene og røttene. Knollen er altså en kilde om våren.{' '}
          </>
        ) : season === 'sommer' ? (
          <>
            <strong>Sommer:</strong> de fullt utvokste bladene lager mer sukker ved fotosyntese enn de bruker selv, og er kilder. Sukkeret går
            både opp til skuddspissen og blomstene og <strong>ned</strong> til røttene og de nye knollene.{' '}
          </>
        ) : season === 'host' ? (
          <>
            <strong>Sensommer:</strong> blomstringen er over, og knollene er det sterkeste sluket. Sukkeret går <strong>ned</strong> og lagres
            som stivelse i knollene, klart til neste vår.{' '}
          </>
        ) : (
          <>
            Kildene er {list(sources)}, og slukene er {list(sinks)}.{' '}
          </>
        )}
        {girdled
          ? ''
          : dir === 'ned'
            ? 'I stengelen over bakken går sukkeret nedover.'
            : dir === 'opp'
              ? 'I stengelen over bakken går sukkeret oppover.'
              : 'Det går ikke noe sukker gjennom stengelen mellom bladene og bakken.'}
        {light < 40 && roles.blader === 'kilde' ? ' Med lite lys lager bladene lite sukker, så det blir mindre å sende.' : ''}
      </p>
    );
  }
  const girdle = girdled ? (
    <p>
      <strong>Ringbarking.</strong> Floemet ligger ytterst, rett under barken, mens xylemet ligger lenger inn. Når en ring av barken fjernes,
      kan vannet fortsatt gå opp, men sukkeret kommer ikke forbi ringen.{' '}
      {r.deficit > 1e-6 ? `Delene under ringen (${list(ORGANS.filter((o) => component(o.id) === 'under' && roles[o.id] === 'sluk').map((o) => o.id))}) får ikke sukker og sulter etter hvert. ` : ''}
      {r.surplus > 1e-6 ? 'Over ringen hoper sukkeret seg opp, og barken sveller. ' : ''}
      Et tre som ringbarkes, dør derfor etter en stund, fordi røttene ikke får næring.
    </p>
  ) : null;
  return (
    <>
      {now}
      {girdle}
      {munch}
    </>
  );
}

/** Om et organ er over eller under ringen (ringen sitter i stengelen mellom bladene og bakken). */
function component(id: OrganId): 'over' | 'under' {
  let n: NodeId | null = id;
  while (n) {
    if (n === 'blader') return 'over';
    n = PARENT[n];
  }
  return 'under';
}
