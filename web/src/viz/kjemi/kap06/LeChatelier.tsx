import { useState, type ReactNode } from 'react';
import {
  Begerglass,
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  KJEMI,
  Legend,
  Partikler,
  Reaksjon,
  Readout,
  Readouts,
  Segmented,
  Select,
  Slider,
  Sub,
  Sup,
  TFormel,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  atomColors,
  fmt,
  fmtSig,
  formulaText,
  linePath,
  mixColor,
  niceTicks,
  Plot,
  useContainerTextScale,
  type ParticleGroup,
} from '../kit';
import { T0, gasPressure, lcSystem, lcTimeline, leChatelier, type Disturbance, type LcResult, type LcState, type LcSystem, type LcSystemId } from './model';

type Kind = Disturbance['kind'];

/** Standardvalg per system: hvilket stoff som endres, og temperaturen etter oppvarming. */
const DEFAULTS: Record<LcSystemId, { species: number; T: number; V: number }> = {
  haber: { species: 0, T: 500, V: 0.5 },
  tiocyanat: { species: 1, T: 60, V: 2 },
  kobolt: { species: 1, T: 70, V: 2 },
};

/** Farger for kurvene, per system og art. */
const COLORS: Record<LcSystemId, string[]> = {
  haber: [VIZ.series[0]!, VIZ.series[2]!, VIZ.series[1]!],
  tiocyanat: [VIZ.series[3]!, VIZ.series[0]!, KJEMI.ph[0]!],
  kobolt: [KJEMI.indicator.fenolftaleinRosa, VIZ.series[2]!, KJEMI.ph[5]!],
};

/** Artene som tegnes i grafen (Cl⁻ i koboltsystemet er 100 ganger så konsentrert og ville skjult resten). */
const PLOTTED: Record<LcSystemId, number[]> = {
  haber: [0, 1, 2],
  tiocyanat: [0, 1, 2],
  kobolt: [0, 2],
};

const TAU = 1.4;
const T_BEFORE = -2;
const T_AFTER = 8;

export default function LeChatelier() {
  const [sid, setSid] = useState<LcSystemId>('kobolt');
  const [kind, setKind] = useState<Kind>('temperatur');
  const [species, setSpecies] = useState(DEFAULTS.kobolt.species);
  const [factor, setFactor] = useState(2);
  const [V, setV] = useState(DEFAULTS.kobolt.V);
  const [Tc, setTc] = useState(DEFAULTS.kobolt.T);
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const s = lcSystem(sid);
  const d: Disturbance =
    kind === 'stoff' ? { kind, index: species, factor } : kind === 'volum' ? { kind, V } : kind === 'temperatur' ? { kind, T: Tc + T0 } : { kind };
  const r = leChatelier(s, d);
  const panelH = panelHeight(f);
  const plotH = Math.round(290 + 210 * (f - 1));

  const changeSystem = (id: LcSystemId) => {
    setSid(id);
    setSpecies(DEFAULTS[id].species);
    setTc(DEFAULTS[id].T);
    setV(DEFAULTS[id].V);
  };
  const kIndices = s.species.map((x, i) => (x.inK ? i : -1)).filter((i) => i >= 0);

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Likevekt"
          options={[
            { value: 'haber', label: 'Ammoniakk' },
            { value: 'tiocyanat', label: 'Jern(III)tiocyanat' },
            { value: 'kobolt', label: 'Koboltklorid' },
          ]}
          value={sid}
          onChange={changeSystem}
        />
      </Toolbar>
      <Toolbar>
        <Segmented
          label="Hva vil du endre?"
          options={[
            { value: 'stoff', label: 'Stoffmengde' },
            { value: 'volum', label: s.gas ? 'Volum (trykk)' : 'Fortynning' },
            { value: 'temperatur', label: 'Temperatur' },
            { value: 'katalysator', label: 'Katalysator' },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'stoff' && (
          <Select
            label="Stoff"
            value={String(species)}
            options={kIndices.map((i) => ({
              value: String(i),
              label: formulaText(s.species[i]!.formula),
            }))}
            onChange={(v) => setSpecies(Number(v))}
          />
        )}
      </Toolbar>
      {kind !== 'katalysator' && (
        <Controls>
          {kind === 'stoff' && (
            <Slider
              label={<>Mengde {<Formel f={s.species[species]!.formula} />} etter endringen</>}
              ariaLabel="Mengde etter endringen"
              value={factor}
              onChange={setFactor}
              min={0.1}
              max={3}
              step={0.1}
              format={(v) => (Math.abs(v - 1) < 1e-9 ? 'uendret' : `× ${fmt(v, 1)} (${v > 1 ? 'tilsatt' : 'fjernet'})`)}
            />
          )}
          {kind === 'volum' &&
            (s.gas ? (
              <Slider label="Volum V" value={V} onChange={setV} min={0.25} max={2} step={0.05} unit="L" decimals={2} />
            ) : (
              <Slider label="Volum etter fortynning" value={V} onChange={setV} min={1} max={4} step={0.1} format={(v) => `× ${fmt(v, 1)}`} />
            ))}
          {kind === 'temperatur' && <Slider label="Temperatur" value={Tc} onChange={setTc} min={s.tRange[0]} max={s.tRange[1]} step={5} unit="°C" />}
        </Controls>
      )}

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${panelH}`}
          label={`${s.name}: likevekt før, rett etter endringen og ny likevekt. Likevekten forskyves ${r.direction === 'ingen' ? 'ikke' : `mot ${r.direction}`}.`}
          caption={
            s.gas
              ? 'Hver kule-figur er et molekyl (8 molekyler per mol). Høyden på gassen viser volumet, men er ikke i skala.'
              : s.id === 'kobolt'
                ? 'Fargen blandes ut fra andelen rosa [Co(H₂O)₆]²⁺ og blått [CoCl₄]²⁻. Lys farge betyr fortynnet løsning.'
                : 'Den røde fargen kommer fra FeSCN²⁺: jo høyere konsentrasjon, jo sterkere farge.'
          }
          maxHeight={panelH}
        >
          <Panels s={s} r={r} f={f} H={panelH} />
        </Figure>
      </div>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Konsentrasjonene før og etter endringen ved t = 0.`}
        caption="Likevekt før (t < 0), endringen ved t = 0 og den nye likevekten. Endepunktene er regnet ut fra K; formen på kurvene er forenklet."
        maxHeight={plotH}
      >
        <TimePlot s={s} r={r} height={plotH} f={f} tau={kind === 'katalysator' ? 0.4 : TAU} />
      </Figure>
      <Legend
        items={PLOTTED[s.id].map((i) => ({
          color: COLORS[s.id][i]!,
          label: (
            <span>
              <Formel f={s.species[i]!.formula} />
            </span>
          ),
        }))}
      />

      <Readouts>
        <Readout label="Q rett etter" value={fmtSig(r.after.q, 3)} />
        <Readout label={kind === 'temperatur' ? `K ved ${fmt(Tc, 0)} °C` : 'K'} value={fmtSig(r.final.K, 2)} />
        <Readout
          label="Likevekten forskyves"
          value={r.direction === 'ingen' ? 'Ikke' : `Mot ${r.direction}`}
          tone={r.direction === 'høyre' ? VIZ.series[2] : r.direction === 'venstre' ? VIZ.series[4] : undefined}
        />
        {systemReadout(s, r)}
      </Readouts>

      <Formula label="Likevektsuttrykk">
        <FormulaLine>
          <Reaksjon r={s.equation} /> &nbsp; {`ΔH\u00a0${s.dH < 0 ? '<' : '>'}\u00a00`}
        </FormulaLine>
        <FormulaLine>
          K = <KExpr s={s} />
          {s.id === 'kobolt' ? ' (vann er løsemiddel og står ikke i K)' : ''}
        </FormulaLine>
        <FormulaLine>
          Rett etter: Q = {fmtSig(r.after.q, 3)} og K = {fmtSig(r.after.K, 3)}, så Q {r.direction === 'høyre' ? '<' : r.direction === 'venstre' ? '>' : '='} K
          {r.direction === 'ingen' ? ' (ingen forskyvning)' : ` (netto mot ${r.direction} til Q = K)`}
        </FormulaLine>
        {kind === 'temperatur' && (
          <>
            <FormulaLine>
              K(T) = K<Sub>0</Sub> · e<Sup>−ΔH/R · (1/T − 1/T₀)</Sup> = {fmtSig(s.K0, 3)} · e
              <Sup>{fmtSig(((-s.dH * 1000) / 8.314) * (1 / (Tc + T0) - 1 / s.T0), 2)}</Sup> = {fmtSig(r.final.K, 3)}
            </FormulaLine>
            <FormulaLine>
              Van 't Hoffs likning, forenklet: ΔH = {fmt(s.dH, 0)} kJ/mol regnes som konstant{s.id === 'haber' ? '' : ' (modellverdi)'}, T<Sub>0</Sub> ={' '}
              {fmt(s.T0 - T0, 0)} °C.
            </FormulaLine>
          </>
        )}
      </Formula>

      <Explain>{explanation(s, kind, d, r)}</Explain>
    </VizLayout>
  );
}

/** Komplekse ioner skrives uten egne hakeparenteser inne i konsentrasjonsklammene: [CoCl₄²⁻]. */
const concForm = (f: string) => f.replace(/^\[(.*)\](\^.*)$/, '$1$2');

function KExpr({ s }: { s: LcSystem }) {
  const term = (i: number) => {
    const x = s.species[i]!;
    return (
      <span key={i}>
        [<Formel f={concForm(x.formula)} />]{Math.abs(x.nu) > 1 && <Sup>{Math.abs(x.nu)}</Sup>}
      </span>
    );
  };
  const prod = s.species.map((x, i) => (x.inK && x.nu > 0 ? i : -1)).filter((i) => i >= 0);
  const reac = s.species.map((x, i) => (x.inK && x.nu < 0 ? i : -1)).filter((i) => i >= 0);
  return (
    <>
      {prod.map(term)} / (
      {reac.map((i, k) => (
        <span key={i}>
          {k > 0 && ' · '}
          {term(i)}
        </span>
      ))}
      )
    </>
  );
}

function systemReadout(s: LcSystem, r: LcResult): ReactNode {
  if (s.id === 'haber') {
    const p = gasPressure(
      r.final.n.reduce((a, b) => a + b, 0),
      r.final.V,
      r.final.T,
    );
    return <Readout label="Trykk (ideell gass)" value={fmt(p, 0)} unit="bar" />;
  }
  if (s.id === 'tiocyanat') return <Readout label="Rødt FeSCN²⁺" value={fmtSig(r.final.c[2]! * 1000, 3)} unit="mmol/L" tone={KJEMI.ph[0]} />;
  const b = blueShare(r.final);
  return <Readout label="Andel blått kompleks" value={fmt(b * 100, 0)} unit="%" tone={mixColor(KJEMI.indicator.fenolftaleinRosa, KJEMI.ph[5]!, b)} />;
}

const blueShare = (st: LcState) => st.c[2]! / Math.max(1e-12, st.c[0]! + st.c[2]!);

/* ---------- Figur 1: før, rett etter, ny likevekt ---------- */

const vesselH = (f: number) => (f > 1.3 ? 300 : 200);
const panelHeight = (f: number) => Math.round(34 * f + vesselH(f) + 70 * f);

function solutionColor(s: LcSystem, st: LcState): string {
  if (s.id === 'tiocyanat') {
    const fe = mixColor(KJEMI.liquid, KJEMI.indicator.btbSur, Math.min(1, st.c[0]! / 0.004) * 0.45);
    return mixColor(fe, KJEMI.ph[0]!, Math.min(1, st.c[2]! / 0.0018) * 0.95);
  }
  const base = mixColor(KJEMI.indicator.fenolftaleinRosa, KJEMI.ph[5]!, blueShare(st));
  const total = (st.c[0]! + st.c[2]!) / 0.05;
  return mixColor(KJEMI.liquid, base, 0.15 + 0.8 * Math.min(1, total));
}

function Panels({ s, r, f, H }: { s: LcSystem; r: LcResult; f: number; H: number }) {
  const states: { title: string; st: LcState; note: string }[] = [
    { title: 'Likevekt før', st: r.before, note: 'Q = K' },
    {
      title: 'Rett etter',
      st: r.after,
      note: r.direction === 'ingen' ? 'Q = K' : r.direction === 'høyre' ? 'Q < K' : 'Q > K',
    },
    { title: 'Ny likevekt', st: r.final, note: 'Q = K' },
  ];
  const w = 800 / 3;
  const vessel = vesselH(f);
  const narrow = f > 1.3;
  const top = 34 * f;
  const cylW = narrow ? 220 : 160;
  // Molekylene får samme størrelse i alle tre sylindrene: så store som mulig (større på mobil), men så de får plass i den
  // minste gassmengden uten å overlappe
  const k = Math.max(1, 0.85 * f);
  const molScale = s.gas
    ? Math.min(
        k,
        ...states.map((p) => {
          const g = gasBox(0, top, vessel, cylW, p.st.V);
          const need = p.st.n.reduce((sum, x, i) => sum + Math.round(x * MOLECULES_PER_MOL) * (2 * (MOL_R[i] ?? 10) + 2) ** 2, 0);
          return Math.sqrt((0.55 * g.w * g.h) / Math.max(1, need));
        }),
      )
    : 1;
  return (
    <g>
      {states.map((p, i) => {
        const x = i * w;
        const cx = x + w / 2;
        return (
          <g key={p.title}>
            <Txt x={cx} y={22 * f} size={0.9} weight={700}>
              {p.title}
            </Txt>
            {s.gas ? (
              <Cylinder cx={cx} y={top} h={vessel} w={cylW} st={p.st} seed={i === 0 ? 3 : i === 1 ? 3 : 5} scale={molScale} />
            ) : (
              <Beaker s={s} cx={cx} y={top} h={vessel} w={narrow ? 200 : 150} st={p.st} />
            )}
            <Txt x={cx} y={top + vessel + 26 * f} size={narrow ? 0.75 : 0.8} weight={650}>
              {panelValue(s, p.st)}
            </Txt>
            <Txt
              x={cx}
              y={top + vessel + 52 * f}
              size={narrow ? 0.75 : 0.8}
              muted={i !== 1}
              weight={600}
              color={i === 1 && r.direction !== 'ingen' ? (r.direction === 'høyre' ? VIZ.series[2] : VIZ.series[4]) : undefined}
            >
              {p.note}
            </Txt>
            {i < 2 && (
              <Txt x={x + w} y={top + vessel / 2} size={1.3} weight={700} muted>
                →
              </Txt>
            )}
          </g>
        );
      })}
      <rect x={0} y={0} width={800} height={H} fill="none" stroke="none" />
    </g>
  );
}

function panelValue(s: LcSystem, st: LcState): ReactNode {
  if (s.id === 'haber')
    return (
      <>
        <TFormel f="NH3" /> {fmtSig(st.c[2]!, 2)} mol/L
      </>
    );
  if (s.id === 'tiocyanat')
    return (
      <>
        <TFormel f="FeSCN^2+" /> {fmtSig(st.c[2]! * 1000, 2)} mmol/L
      </>
    );
  return <>{fmt(blueShare(st) * 100, 0)} % blått</>;
}

function Beaker({ s, cx, y, h, w, st }: { s: LcSystem; cx: number; y: number; h: number; w: number; st: LcState }) {
  const level = Math.min(0.92, 0.2 + 0.18 * st.V);
  return <Begerglass x={cx - w / 2} y={y + 6} w={w} h={h - 12} level={level} liquid={solutionColor(s, st)} />;
}

/** Antall molekyler som tegnes per mol, og radiusen (før skalering) til N₂, H₂ og NH₃. */
const MOLECULES_PER_MOL = 8;
const MOL_R = [9, 6, 10];

/** Gassrommet under stempelet. Høyden følger volumet, men ikke i skala (√V), så også et lite volum får plass. */
function gasBox(cx: number, y: number, h: number, w: number, V: number) {
  const gh = Math.max(36, (h - 16) * Math.sqrt(V / 2));
  return { x: cx - w / 2 + 6, y: y + h - gh + 4, w: w - 12, h: gh - 10, top: y + h - gh };
}

/** Sylinder med stempel: gassvolumet (høyden) og molekylene N₂, H₂ og NH₃. */
function Cylinder({ cx, y, h, w, st, seed, scale }: { cx: number; y: number; h: number; w: number; st: LcState; seed: number; scale: number }) {
  const box = gasBox(cx, y, h, w, st.V);
  const gy = box.top;
  const n = st.n.map((x) => Math.round(x * MOLECULES_PER_MOL));
  const nC = atomColors('N');
  const hC = atomColors('H');
  const groups: ParticleGroup[] = [
    {
      n: n[0]!,
      r: MOL_R[0]! * scale,
      render: ({ x, y: yy, r, angle }) => <Diatomic x={x} y={yy} r={r * 0.5} angle={angle} fill={nC.fill} line={nC.line} />,
    },
    {
      n: n[1]!,
      r: MOL_R[1]! * scale,
      render: ({ x, y: yy, r, angle }) => <Diatomic x={x} y={yy} r={r * 0.52} angle={angle} fill={hC.fill} line={hC.line} />,
    },
    {
      n: n[2]!,
      r: MOL_R[2]! * scale,
      render: ({ x, y: yy, r, angle }) => (
        <g>
          {[0, 120, 240].map((a) => {
            const t = ((a + angle) * Math.PI) / 180;
            return (
              <circle key={a} cx={x + Math.cos(t) * r * 0.55} cy={yy + Math.sin(t) * r * 0.55} r={r * 0.32} fill={hC.fill} stroke={hC.line} strokeWidth={1} />
            );
          })}
          <circle cx={x} cy={yy} r={r * 0.5} fill={nC.fill} stroke={nC.line} strokeWidth={1.3} />
        </g>
      ),
    },
  ];
  return (
    <g>
      <rect x={cx - w / 2} y={y} width={w} height={h} rx={8} fill={KJEMI.glassFill} stroke={KJEMI.glass} strokeWidth={2} />
      <rect x={cx - w / 2 + 3} y={gy - 12} width={w - 6} height={12} rx={3} fill={VIZ.bodyStrong} />
      <rect x={cx - 6} y={y - 6} width={12} height={Math.max(0, gy - 12 - y + 6)} fill={VIZ.body} />
      <Partikler box={{ x: box.x, y: box.y, w: box.w, h: box.h }} groups={groups} seed={seed} gap={1} />
    </g>
  );
}

function Diatomic({ x, y, r, angle, fill, line }: { x: number; y: number; r: number; angle: number; fill: string; line: string }) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a) * r * 0.75;
  const dy = Math.sin(a) * r * 0.75;
  return (
    <g>
      <circle cx={x - dx} cy={y - dy} r={r} fill={fill} stroke={line} strokeWidth={1.2} />
      <circle cx={x + dx} cy={y + dy} r={r} fill={fill} stroke={line} strokeWidth={1.2} />
    </g>
  );
}

/* ---------- Figur 2: konsentrasjon mot tid ---------- */

function TimePlot({ s, r, height, f, tau }: { s: LcSystem; r: LcResult; height: number; f: number; tau: number }) {
  const scale = s.unitScale;
  const idx = PLOTTED[s.id];
  const ts: number[] = [];
  for (let i = 0; i <= 60; i++) ts.push(T_BEFORE + (0 - T_BEFORE) * (i / 60) - (i === 60 ? 1e-9 : 0));
  for (let i = 0; i <= 200; i++) ts.push((T_AFTER * i) / 200);
  const series = idx.map((k) => ts.map((t) => [t, lcTimeline(r, tau, t)[k]! * scale] as [number, number]));
  const vMax = Math.max(1e-9, ...series.flatMap((p) => p.map(([, v]) => v))) * 1.15;
  const unit = scale === 1000 ? 'mmol/L' : 'mol/L';
  return (
    <Plot
      x={{
        min: T_BEFORE,
        max: T_AFTER,
        label: 'Tid (forenklet tidsskala)',
        ticks: niceTicks(T_BEFORE, T_AFTER, f > 1.3 ? 5 : 10),
      }}
      y={{
        min: 0,
        max: vMax,
        label: `Konsentrasjon (${unit})`,
        decimals: vMax < 0.5 ? 2 : vMax < 5 ? 1 : 0,
        ticks: niceTicks(0, vMax, f > 1.3 ? 4 : 5),
      }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, y1 }) => (
        <g>
          <rect x={sx(T_BEFORE)} y={y1} width={sx(0) - sx(T_BEFORE)} height={y0 - y1} fill={VIZ.muted} opacity={0.08} />
          <line x1={sx(0)} x2={sx(0)} y1={y0} y2={y1} stroke={VIZ.ink} strokeWidth={1.5} strokeDasharray="5 4" />
          <Txt x={sx(0) + 8} y={y1 + 18 * f} anchor="start" size={0.8} weight={650}>
            Endring
          </Txt>
          {series.map((pts, j) => {
            // En kurve som ligger oppå en tidligere (f.eks. [Fe³⁺] = [SCN⁻] før endringen), tegnes stiplet så begge synes
            const hidden = series.slice(0, j).some((q) => pts.some(([, v], m) => m <= 60 && Math.abs(v - q[m]![1]) < 0.01 * vMax));
            return (
              <path
                key={j}
                d={linePath(pts, sx, sy)}
                fill="none"
                stroke={COLORS[s.id][idx[j]!]}
                strokeWidth={3}
                strokeDasharray={hidden ? '9 7' : undefined}
              />
            );
          })}
        </g>
      )}
    </Plot>
  );
}

/* ---------- Forklaring ---------- */

function explanation(s: LcSystem, kind: Kind, d: Disturbance, r: LcResult): ReactNode {
  const dirText = r.direction === 'høyre' ? 'mot høyre' : r.direction === 'venstre' ? 'mot venstre' : 'ikke';
  const result =
    s.id === 'haber' ? (
      r.direction === 'høyre' ? (
        <>Det dannes mer ammoniakk.</>
      ) : r.direction === 'venstre' ? (
        <>Noe av ammoniakken spaltes til nitrogen og hydrogen.</>
      ) : null
    ) : s.id === 'tiocyanat' ? (
      r.direction === 'høyre' ? (
        <>Løsningen blir mer rød, fordi det dannes mer FeSCN²⁺.</>
      ) : r.direction === 'venstre' ? (
        <>Den røde fargen blir svakere, fordi FeSCN²⁺ spaltes.</>
      ) : null
    ) : r.direction === 'høyre' ? (
      <>Løsningen blir mer blå, fordi det dannes mer [CoCl₄]²⁻.</>
    ) : r.direction === 'venstre' ? (
      <>Løsningen blir mer rosa, fordi det dannes mer [Co(H₂O)₆]²⁺.</>
    ) : null;
  let main: ReactNode;
  switch (kind) {
    case 'stoff': {
      const dd = d as Extract<Disturbance, { kind: 'stoff' }>;
      const sp = s.species[dd.index]!;
      const added = dd.factor > 1;
      if (Math.abs(dd.factor - 1) < 1e-9) {
        main = <p>Mengden er ikke endret, så likevekten er den samme. Flytt glidebryteren for å tilsette eller fjerne stoff.</p>;
        break;
      }
      main = (
        <>
          <p>
            <strong>
              Du {added ? 'tilsatte' : 'fjernet'} <Formel f={sp.formula} />.
            </strong>{' '}
            Rett etter er Q {r.after.q < r.after.K ? 'mindre' : 'større'} enn K, så likevekten forskyves {dirText}: systemet{' '}
            {added ? 'bruker opp noe av det du tilsatte' : 'lager noe av det du fjernet'}. {result}
          </p>
          <p>
            Forskyvningen motvirker bare en del av endringen: [
            <Formel f={sp.formula} />] ender på {fmtSig(r.final.c[dd.index]! * s.unitScale, 3)} {s.unitScale === 1000 ? 'mmol/L' : 'mol/L'}, mellom verdien før
            ({fmtSig(r.before.c[dd.index]! * s.unitScale, 3)}) og rett etter ({fmtSig(r.after.c[dd.index]! * s.unitScale, 3)}). K er den samme, for temperaturen
            er ikke endret.
            {s.id === 'kobolt' && dd.index === 1 && !added ? ' I laboratoriet kan du fjerne kloridioner ved å tilsette sølvnitrat, så AgCl felles ut.' : ''}
            {s.id === 'kobolt' && dd.index === 1 && added ? ' I laboratoriet tilsetter du konsentrert saltsyre.' : ''}
          </p>
        </>
      );
      break;
    }
    case 'volum': {
      const dv = d as Extract<Disturbance, { kind: 'volum' }>;
      if (s.gas) {
        const smaller = dv.V < s.V0;
        main =
          Math.abs(dv.V - s.V0) < 1e-9 ? (
            <p>Volumet er det samme som før (1 L), så ingenting skjer. Gjør volumet mindre eller større.</p>
          ) : (
            <p>
              <strong>
                Du gjorde volumet {smaller ? 'mindre' : 'større'}, så trykket {smaller ? 'økte' : 'sank'}.
              </strong>{' '}
              Likevekten forskyves mot siden med {smaller ? 'færrest' : 'flest'} gassmolekyler: til venstre er det 1 + 3 = 4 molekyler, til høyre 2. Den
              forskyves derfor {dirText}. {result} {smaller ? 'Derfor bruker ammoniakkfabrikker høyt trykk, ofte rundt 200 bar.' : ''}
            </p>
          );
      } else {
        const left = s.species.filter((x) => x.inK && x.nu < 0).reduce((a, x) => a - x.nu, 0);
        const right = s.species.filter((x) => x.inK && x.nu > 0).reduce((a, x) => a + x.nu, 0);
        main =
          Math.abs(dv.V - 1) < 1e-9 ? (
            <p>Løsningen er ikke fortynnet. Flytt glidebryteren for å tilsette vann.</p>
          ) : (
            <p>
              <strong>Du fortynnet løsningen med vann,</strong> så alle konsentrasjonene ble {fmt(dv.V, 1)} ganger mindre. Likevekten forskyves mot siden med
              flest oppløste partikler: {left} til venstre og {right} til høyre
              {s.id === 'kobolt' ? ' (vann er løsemiddelet og telles ikke)' : ''}. Den forskyves derfor {dirText}. {result} Fargen blir altså svakere enn
              fortynningen alene skulle tilsi.
            </p>
          );
      }
      break;
    }
    case 'temperatur': {
      const dt = d as Extract<Disturbance, { kind: 'temperatur' }>;
      const warmer = dt.T > s.T0 + 1e-9;
      const colder = dt.T < s.T0 - 1e-9;
      const endoRight = s.dH > 0;
      main =
        !warmer && !colder ? (
          <p>Temperaturen er den samme som før ({fmt(s.T0 - T0, 0)} °C). Flytt glidebryteren for å varme opp eller kjøle ned.</p>
        ) : (
          <p>
            <strong>
              Reaksjonen mot høyre er {endoRight ? 'endoterm' : 'eksoterm'} (ΔH {endoRight ? '>' : '<'} 0).
            </strong>{' '}
            Når du {warmer ? 'varmer opp' : 'kjøler ned'}, fremmes den retningen som {warmer ? 'tar opp' : 'gir fra seg'} varme, altså{' '}
            {warmer === endoRight ? 'mot høyre' : 'mot venstre'}. {result} Temperatur er den eneste endringen som endrer K: K går fra {fmtSig(r.before.K, 3)}{' '}
            til {fmtSig(r.final.K, 3)}.
            {s.id === 'haber'
              ? ' Lav temperatur gir mest ammoniakk, men da går reaksjonen for sakte. Industrien velger derfor et kompromiss rundt 400–450 °C med jernkatalysator.'
              : ''}
          </p>
        );
      break;
    }
    case 'katalysator':
      main = (
        <p>
          <strong>En katalysator forskyver ikke likevekten.</strong> Den senker aktiveringsenergien for reaksjonen begge veier, så farten mot høyre og mot
          venstre øker like mange ganger. Likevekten nås raskere, men den ligger på samme sted, og K er uendret.
          {s.id === 'haber' ? ' I Haber–Bosch-prosessen brukes jern som katalysator for at likevekten skal innstilles raskt nok.' : ''}
        </p>
      );
      break;
  }
  return (
    <>
      {main}
      <p>
        Le Chateliers prinsipp: når en likevekt forstyrres, forskyves den slik at forstyrrelsen motvirkes. Bak prinsippet ligger Q og K: likevekten forskyves
        til Q er lik K igjen.
      </p>
    </>
  );
}
