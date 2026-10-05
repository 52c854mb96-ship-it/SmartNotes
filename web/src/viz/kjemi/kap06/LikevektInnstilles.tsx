import { useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Figure,
  Formel,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Reaksjon,
  Plot,
  Readout,
  Readouts,
  Segmented,
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
  jiggle,
  linePath,
  niceTicks,
  placeParticles,
  scaleLinear,
  superscript,
  useContainerTextScale,
  useSimClock,
  type Box,
} from '../kit';
import {
  HI_K,
  particleStateAt,
  recentEvents,
  sampleAt,
  simulateAB,
  simulateHI,
  stochasticAB,
  stochasticHI,
  type KineticsSample,
  type ParticleRun,
} from './model';

type Sys = 'AB' | 'HI';

const T_MAX = 10;
const K_LADDER = [0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10];
/** Partikler per mol/L i partikkelbildet. */
const OMEGA: Record<Sys, number> = { AB: 15, HI: 12 };
const FWD = VIZ.series[2]!;
const BWD = VIZ.series[4]!;

interface SpeciesInfo {
  key: string;
  label: ReactNode;
  svg: ReactNode;
  text: string;
  color: string;
}

const SPECIES: Record<Sys, SpeciesInfo[]> = {
  AB: [
    { key: 'A', label: 'A', svg: 'A', text: 'A', color: VIZ.series[0]! },
    { key: 'B', label: 'B', svg: 'B', text: 'B', color: VIZ.series[1]! },
  ],
  HI: [
    { key: 'H2', label: <Formel f="H2" />, svg: <TFormel f="H2" />, text: 'H₂', color: VIZ.series[0]! },
    { key: 'I2', label: <Formel f="I2" />, svg: <TFormel f="I2" />, text: 'I₂', color: VIZ.series[3]! },
    { key: 'HI', label: <Formel f="HI" />, svg: <TFormel f="HI" />, text: 'HI', color: VIZ.series[1]! },
  ],
};

export default function LikevektInnstilles() {
  const [sys, setSys] = useState<Sys>('AB');
  const [a0, setA0] = useState(1.6);
  const [b0, setB0] = useState(0);
  const [kIdx, setKIdx] = useState(6);
  const [h0, setH0] = useState(1);
  const [i0, setI0] = useState(1);
  const [hi0, setHi0] = useState(0);
  const clock = useSimClock({ tMax: T_MAX });
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const K = sys === 'AB' ? (K_LADDER[kIdx] ?? 1) : HI_K;
  const om = OMEGA[sys];
  const samples = useMemo(() => (sys === 'AB' ? simulateAB(a0, b0, K, T_MAX, 240) : simulateHI(h0, i0, hi0, T_MAX, 240)), [sys, a0, b0, K, h0, i0, hi0]);
  const run = useMemo(
    () =>
      sys === 'AB'
        ? stochasticAB(Math.round(a0 * om), Math.round(b0 * om), K, T_MAX + 1, 17)
        : stochasticHI(Math.round(h0 * om), Math.round(i0 * om), Math.round(hi0 * om), om, T_MAX + 1, 23),
    [sys, a0, b0, K, h0, i0, hi0, om],
  );
  const t = clock.t;
  const now = sampleAt(samples, t);
  const species = SPECIES[sys];
  const total = sys === 'AB' ? a0 + b0 : h0 + i0 + hi0;
  const stuck = total === 0 || (sys === 'HI' && hi0 === 0 && (h0 === 0 || i0 === 0));
  const phase = phaseOf(samples, now, K, stuck);
  const boxH = f > 1.3 ? Math.round(60 * f + 380 + 60 * f + qkHeight(f)) : Math.round(40 * f + 340);
  const plotH = Math.round(300 + 220 * (f - 1));

  const changeSys = (s: Sys) => {
    setSys(s);
    clock.reset();
  };

  return (
    <VizLayout>
      <Toolbar>
        <Segmented
          label="Reaksjon"
          options={[
            { value: 'AB', label: 'A ⇌ B' },
            { value: 'HI', label: <Reaksjon r="H2 + I2 ⇌ 2 HI" states={false} /> },
          ]}
          value={sys}
          onChange={changeSys}
        />
      </Toolbar>
      <Controls>
        {sys === 'AB' ? (
          <>
            <Slider
              label={
                <>
                  [A]<Sub>0</Sub>
                </>
              }
              ariaLabel="Startkonsentrasjon av A"
              value={a0}
              onChange={setA0}
              min={0}
              max={2}
              step={0.1}
              unit="mol/L"
              decimals={1}
            />
            <Slider
              label={
                <>
                  [B]<Sub>0</Sub>
                </>
              }
              ariaLabel="Startkonsentrasjon av B"
              value={b0}
              onChange={setB0}
              min={0}
              max={2}
              step={0.1}
              unit="mol/L"
              decimals={1}
            />
            <Slider
              label="Likevektskonstant K"
              value={kIdx}
              onChange={setKIdx}
              min={0}
              max={K_LADDER.length - 1}
              step={1}
              format={(i) => fmt(K_LADDER[i] ?? 1, (K_LADDER[i] ?? 1) < 1 ? 1 : 0)}
            />
          </>
        ) : (
          <>
            <Slider
              label={
                <>
                  [H<Sub>2</Sub>]<Sub>0</Sub>
                </>
              }
              ariaLabel="Startkonsentrasjon av hydrogen"
              value={h0}
              onChange={setH0}
              min={0}
              max={1.5}
              step={0.1}
              unit="mol/L"
              decimals={1}
            />
            <Slider
              label={
                <>
                  [I<Sub>2</Sub>]<Sub>0</Sub>
                </>
              }
              ariaLabel="Startkonsentrasjon av jod"
              value={i0}
              onChange={setI0}
              min={0}
              max={1.5}
              step={0.1}
              unit="mol/L"
              decimals={1}
            />
            <Slider
              label={
                <>
                  [HI]<Sub>0</Sub>
                </>
              }
              ariaLabel="Startkonsentrasjon av hydrogenjodid"
              value={hi0}
              onChange={setHi0}
              min={0}
              max={1.5}
              step={0.1}
              unit="mol/L"
              decimals={1}
            />
          </>
        )}
      </Controls>
      <PlayControls clock={clock} decimals={1} />

      <div ref={ref}>
        <Figure
          viewBox={`0 0 800 ${boxH}`}
          label={`Partikkelbilde ved t = ${fmt(t, 1)} s og reaksjonskvotienten Q = ${fmtSig(now.q, 3)} sammenlignet med K = ${fmtSig(K, 3)}.`}
          caption={`Partikkelbildet er en tilfeldig simulering med ${om} partikler per mol/L, så antallet svinger litt rundt likevekten. Ringene viser partikler som nettopp har reagert.`}
          maxHeight={boxH}
        >
          <BoxScene sys={sys} run={run} t={t} f={f} q={now.q} K={K} stuck={stuck} />
        </Figure>
      </div>
      <Legend
        items={[
          ...species.map((s) => ({ color: s.color, label: <span>{s.label}</span> })),
          { color: FWD, label: 'Har nettopp reagert mot høyre' },
          { color: BWD, label: 'Har nettopp reagert mot venstre' },
        ]}
      />

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Konsentrasjonene over tid. Ved t = ${fmt(t, 1)} s: ${species.map((s, i) => `${s.text} ${fmtSig(now.c[i] ?? 0, 3)} mol/L`).join(', ')}.`}
        caption="Konsentrasjonene endrer seg raskt i starten og flater ut når likevekten er nådd. Den loddrette streken er tiden nå."
        maxHeight={plotH}
      >
        <ConcPlot samples={samples} species={species} t={t} height={plotH} f={f} />
      </Figure>

      <Figure
        viewBox={`0 0 800 ${plotH}`}
        label={`Farten mot høyre og mot venstre over tid. Ved t = ${fmt(t, 1)} s er de ${fmtSig(now.rf, 3)} og ${fmtSig(now.rb, 3)} mol/(L·s).`}
        caption="Likevekt: farten mot høyre er lik farten mot venstre. Fartskonstantene (tidsskalaen) er valgt for visningen."
        maxHeight={plotH}
      >
        <RatePlot samples={samples} t={t} height={plotH} f={f} stuck={stuck} />
      </Figure>
      <Legend
        items={[
          { color: FWD, label: 'Fart mot høyre' },
          { color: BWD, label: 'Fart mot venstre', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Q nå" value={stuck ? '–' : fmtSig(now.q, 3)} tone={qColor(now.q, K)} />
        <Readout label={sys === 'HI' ? 'K ved 430 °C' : 'K'} value={fmtSig(K, 3)} />
        <Readout label="Fart mot høyre" value={fmtSig(now.rf, 2)} unit="mol/(L·s)" tone={FWD} />
        <Readout label="Fart mot venstre" value={fmtSig(now.rb, 2)} unit="mol/(L·s)" tone={BWD} />
      </Readouts>

      <Formula label="Likevektsuttrykket">
        {sys === 'AB' ? (
          <FormulaLine>
            Q = [B] / [A] = {fmtSig(now.c[1] ?? 0, 3)} / {fmtSig(now.c[0] ?? 0, 3)} = {stuck ? '–' : fmtSig(now.q, 3)} &nbsp; ved likevekt er Q = K ={' '}
            {fmtSig(K, 3)}
          </FormulaLine>
        ) : (
          <FormulaLine>
            Q = [HI]<Sup>2</Sup> / ([H<Sub>2</Sub>] · [I<Sub>2</Sub>]) = {fmtSig(now.c[2] ?? 0, 3)}
            <Sup>2</Sup> / ({fmtSig(now.c[0] ?? 0, 3)} · {fmtSig(now.c[1] ?? 0, 3)}) = {stuck ? '–' : fmtSig(now.q, 3)} &nbsp; ved likevekt er Q = K = {HI_K}
          </FormulaLine>
        )}
      </Formula>

      <Explain>{explanation(sys, phase, now, K, t)}</Explain>
    </VizLayout>
  );
}

/* ---------- Tilstand og forklaring ---------- */

type Phase = 'tom' | 'stopp' | 'likevekt-fra-start' | 'likevekt' | 'høyre' | 'venstre';

function phaseOf(samples: KineticsSample[], now: KineticsSample, K: number, stuck: boolean): Phase {
  if (stuck) return now.c.every((c) => c === 0) ? 'tom' : 'stopp';
  const off = (q: number) => Math.abs(Math.log(Math.max(q, 1e-300) / K));
  const q0 = samples[0]!.q;
  if (q0 !== Infinity && off(q0) < 0.01) return 'likevekt-fra-start';
  if (now.q !== Infinity && off(now.q) < 0.03) return 'likevekt';
  return now.q < K ? 'høyre' : 'venstre';
}

function qColor(q: number, K: number): string | undefined {
  if (!Number.isFinite(q) && q !== Infinity) return undefined;
  if (q !== Infinity && Math.abs(Math.log(Math.max(q, 1e-300) / K)) < 0.03) return VIZ.ink;
  return q < K ? FWD : BWD;
}

function explanation(sys: Sys, phase: Phase, now: KineticsSample, K: number, t: number): ReactNode {
  const r =
    sys === 'AB' ? (
      'A blir til B'
    ) : (
      <>
        H<Sub>2</Sub> og I<Sub>2</Sub> blir til HI
      </>
    );
  const l =
    sys === 'AB' ? (
      'B blir til A'
    ) : (
      <>
        HI blir til H<Sub>2</Sub> og I<Sub>2</Sub>
      </>
    );
  const misconception = (
    <p>
      Likevekt betyr <em>ikke</em> at det er like mye av hvert stoff, og heller ikke at reaksjonen har stoppet. Partiklene i boksen fortsetter å reagere begge
      veier, men like mange reagerer hver vei per sekund, så konsentrasjonene holder seg konstante. Det kalles dynamisk likevekt.
    </p>
  );
  switch (phase) {
    case 'tom':
      return <p>Det er ingen partikler i blandingen. Velg en startkonsentrasjon større enn null.</p>;
    case 'stopp':
      return (
        <p>
          Ingenting kan skje: for å lage HI trengs både H<Sub>2</Sub> og I<Sub>2</Sub>, og det finnes ikke HI som kan spaltes. Øk den andre
          startkonsentrasjonen.
        </p>
      );
    case 'likevekt-fra-start':
      return (
        <>
          <p>
            <strong>Blandingen er i likevekt allerede fra start:</strong> Q = K, så farten mot høyre er like stor som farten mot venstre, og konsentrasjonene
            endrer seg ikke.
          </p>
          {misconception}
        </>
      );
    case 'likevekt':
      return (
        <>
          <p>
            <strong>Likevekt etter omtrent {fmt(t, 1)} s:</strong> Q = K = {fmtSig(K, 3)}, og farten er like stor begge veier ({fmtSig(now.rf, 2)} mol/(L·s)).{' '}
            {sys === 'AB'
              ? `Forholdet [B]/[A] er alltid ${fmtSig(K, 3)} ved likevekt, uansett hvor mye du starter med.`
              : 'Du kan starte med bare HI, og ende opp i den samme likevekten som fra H₂ og I₂.'}
          </p>
          {misconception}
        </>
      );
    case 'høyre':
      return (
        <>
          <p>
            <strong>
              {t === 0 ? 'I starten' : 'Nå'} er Q = {fmtSig(now.q, 3)} mindre enn K = {fmtSig(K, 3)},
            </strong>{' '}
            så reaksjonen går netto mot høyre: {r} raskere enn {l}. Etter hvert som reaktantene brukes opp, avtar farten mot høyre, og farten mot venstre øker
            fordi det blir mer produkt.
            {t === 0 ? ' Trykk «Spill av» og følg kurvene til farten er lik begge veier.' : ''}
          </p>
          <p>Partiklene vil ikke noe: de kolliderer tilfeldig, og det er bare antallet som avgjør hvor ofte hver reaksjon skjer.</p>
        </>
      );
    case 'venstre':
      return (
        <>
          <p>
            <strong>
              {t === 0 ? 'I starten' : 'Nå'} er Q {now.q === Infinity ? 'uendelig stor' : `= ${fmtSig(now.q, 3)}`}, altså større enn K = {fmtSig(K, 3)},
            </strong>{' '}
            så reaksjonen går netto mot venstre: {l} raskere enn {r}. Det er for mye produkt i forhold til likevekten.
            {t === 0 ? ' Trykk «Spill av» og se konsentrasjonene nærme seg likevekten.' : ''}
          </p>
          <p>En likevekt kan altså nås fra begge sider. Det er K, ikke startblandingen, som bestemmer hvor likevekten ligger.</p>
        </>
      );
  }
}

/* ---------- Figur 1: partikkelbildet og Q mot K ---------- */

const qkHeight = (f: number) => Math.round(150 * f);

function BoxScene({ sys, run, t, f, q, K, stuck }: { sys: Sys; run: ParticleRun; t: number; f: number; q: number; K: number; stuck: boolean }) {
  const narrow = f > 1.3;
  const k = Math.max(1, 0.85 * f);
  const box: Box = narrow ? { x: 20, y: 60 * f, w: 760, h: 380 } : { x: 14, y: 40 * f, w: 430, h: 290 };
  const species = SPECIES[sys];
  const n = run.initial.length;
  const r = sys === 'AB' ? 11 * k : 15 * k;
  const pad = 6 * k;
  const placed = useMemo(
    () => placeParticles({ x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad }, [{ n, r: r + 1 }], 5, 2),
    [n, box.x, box.y, box.w, box.h, r, pad],
  );
  const st = particleStateAt(run, t);
  const counts = species.map((_, i) => st.kind.filter((x) => x === i).length);
  const recent = recentEvents(run, t, 1);
  const qk = narrow ? { x: 20, y: box.y + box.h + 64 * f, w: 760 } : { x: 476, y: box.y + Math.max(20, (box.h - qkHeight(f)) / 2), w: 304 };
  return (
    <g>
      <Txt x={box.x} y={box.y - 14 * f} anchor="start" size={0.9} weight={650}>
        {species.map((s, i) => (
          <tspan key={s.key} style={{ fill: s.color }} dx={i === 0 ? 0 : 14}>
            {s.svg}: {counts[i]}
          </tspan>
        ))}
      </Txt>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={12} fill={VIZ.surface} stroke={VIZ.muted} strokeWidth={1.5} />
      {placed.map((p, i) => {
        const pos = jiggle(p, t * 2, 4 * k);
        const kind = st.kind[i] ?? 0;
        const since = st.since[i] ?? Infinity;
        const fresh = since < 0.6;
        const ring = fresh ? (st.forward[i] ? FWD : BWD) : null;
        const angle = (p.phase * 180) / Math.PI + t * 20 * (i % 2 ? 1 : -1);
        return (
          <g key={i}>
            {ring && <circle cx={pos.x} cy={pos.y} r={r + 6 * k} fill="none" stroke={ring} strokeWidth={3 * k} opacity={1 - since / 0.6} />}
            {sys === 'AB' ? <AbParticle x={pos.x} y={pos.y} r={r} kind={kind} /> : <HiMolecule x={pos.x} y={pos.y} k={k} kind={kind} angle={angle} />}
          </g>
        );
      })}
      <Txt x={box.x} y={box.y + box.h + 24 * f} anchor="start" size={0.8} muted>
        Siste sekund: {recent.forward} mot høyre, {recent.backward} mot venstre
      </Txt>
      <QkScale x={qk.x} y={qk.y} w={qk.w} f={f} q={q} K={K} stuck={stuck} />
    </g>
  );
}

function AbParticle({ x, y, r, kind }: { x: number; y: number; r: number; kind: number }) {
  const c = kind === 0 ? VIZ.series[0]! : VIZ.series[1]!;
  return (
    <g>
      {kind === 0 ? <circle cx={x} cy={y} r={r} fill={c} /> : <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.35} fill={c} />}
      <text x={x} y={y + r * 0.42} textAnchor="middle" style={{ fill: VIZ.surface, fontSize: r * 1.2, fontWeight: 700 }}>
        {kind === 0 ? 'A' : 'B'}
      </text>
    </g>
  );
}

/** Toatomig molekyl: H₂ (to små hvite), I₂ (to store fiolette) eller HI. */
function HiMolecule({ x, y, k, kind, angle }: { x: number; y: number; k: number; kind: number; angle: number }) {
  const rh = 6.5 * k;
  const ri = 10.5 * k;
  const [r1, r2, e1, e2] = kind === 0 ? [rh, rh, 'H', 'H'] : kind === 1 ? [ri, ri, 'I', 'I'] : [rh, ri, 'H', 'I'];
  const d = (r1 + r2) * 0.75;
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const c1 = atomColors(e1);
  const c2 = atomColors(e2);
  // Sentrum midt mellom atomene
  const p1 = { x: x - (ux * d) / 2, y: y - (uy * d) / 2 };
  const p2 = { x: x + (ux * d) / 2, y: y + (uy * d) / 2 };
  return (
    <g>
      <circle cx={p1.x} cy={p1.y} r={r1} fill={c1.fill} stroke={c1.line} strokeWidth={1.3} />
      <circle cx={p2.x} cy={p2.y} r={r2} fill={c2.fill} stroke={c2.line} strokeWidth={1.3} />
    </g>
  );
}

/** Logaritmisk skala med K fast og Q som flytter seg mot K. */
function QkScale({ x, y, w, f, q, K, stuck }: { x: number; y: number; w: number; f: number; q: number; K: number; stuck: boolean }) {
  const e0 = Math.floor(Math.log10(K)) - 3;
  const e1 = e0 + 7;
  const sx = scaleLinear([e0, e1], [x + 10, x + w - 10]);
  const axisY = y + 66 * f;
  const lq = q === Infinity ? e1 : q > 0 ? Math.log10(q) : e0;
  const qx = sx(Math.min(e1, Math.max(e0, lq)));
  const kx = sx(Math.log10(K));
  const dir = stuck || Number.isNaN(q) ? null : q !== Infinity && Math.abs(Math.log(Math.max(q, 1e-300) / K)) < 0.03 ? 'lik' : q < K ? 'høyre' : 'venstre';
  const step = w < 400 ? 2 : 1;
  const ticks: number[] = [];
  for (let e = e0; e <= e1; e++) ticks.push(e);
  const qText = stuck || Number.isNaN(q) ? 'Q: –' : q === Infinity ? 'Q → ∞' : q === 0 ? 'Q = 0' : `Q = ${fmtSig(q, 2)}`;
  const color = dir === 'høyre' ? FWD : dir === 'venstre' ? BWD : VIZ.ink;
  return (
    <g>
      <Txt x={x} y={y} anchor="start" size={0.9} weight={650}>
        Reaksjonskvotienten Q mot K
      </Txt>
      <line x1={x + 10} x2={x + w - 10} y1={axisY} y2={axisY} className="viz-axis" />
      {ticks.map((e) => (
        <g key={e}>
          <line x1={sx(e)} x2={sx(e)} y1={axisY - 5} y2={axisY + 5} className="viz-axis" />
          {(e - e0) % step === 0 && (
            <text x={sx(e)} y={axisY + 24 * f} textAnchor="middle" className="viz-tick">
              10{superscript(e)}
            </text>
          )}
        </g>
      ))}
      <line x1={kx} x2={kx} y1={axisY - 30 * f} y2={axisY + 6} stroke={VIZ.ink} strokeWidth={3} />
      <Txt x={kx} y={axisY - 36 * f} size={0.85} weight={700}>
        K = {fmtSig(K, 3)}
      </Txt>
      {!(stuck || Number.isNaN(q)) && (
        <g>
          {dir !== 'lik' && Math.abs(kx - qx) > 16 && (
            <line x1={qx} x2={kx + (qx < kx ? -8 : 8)} y1={axisY + 44 * f} y2={axisY + 44 * f} stroke={color} strokeWidth={2.5} />
          )}
          {dir !== 'lik' && Math.abs(kx - qx) > 16 && (
            <polygon
              points={`${kx + (qx < kx ? -2 : 2)},${axisY + 44 * f} ${kx + (qx < kx ? -12 : 12)},${axisY + 44 * f - 5} ${kx + (qx < kx ? -12 : 12)},${axisY + 44 * f + 5}`}
              fill={color}
            />
          )}
          <circle cx={qx} cy={axisY} r={8 * Math.max(1, 0.85 * f)} fill={color} stroke={VIZ.surface} strokeWidth={2} />
          <Txt
            x={Math.min(x + w - 4, Math.max(x + 4, qx))}
            y={axisY + 70 * f}
            anchor={qx < x + 60 ? 'start' : qx > x + w - 60 ? 'end' : 'middle'}
            size={0.85}
            weight={700}
            color={color}
          >
            {qText}
          </Txt>
        </g>
      )}
      <Txt x={x} y={axisY + 100 * f} anchor="start" size={0.8} muted>
        {dir === 'høyre'
          ? 'Q < K: netto reaksjon mot høyre'
          : dir === 'venstre'
            ? 'Q > K: netto reaksjon mot venstre'
            : dir === 'lik'
              ? 'Q = K: likevekt'
              : 'Ingen reaksjon'}
      </Txt>
    </g>
  );
}

/* ---------- Figur 2 og 3: grafer ---------- */

function cursorX(sx: (v: number) => number, t: number) {
  return sx(Math.min(T_MAX, Math.max(0, t)));
}

function ConcPlot({ samples, species, t, height, f }: { samples: KineticsSample[]; species: SpeciesInfo[]; t: number; height: number; f: number }) {
  const cMax = Math.max(0.5, ...samples.flatMap((s) => s.c)) * 1.1;
  const now = sampleAt(samples, t);
  return (
    <Plot
      x={{ min: 0, max: T_MAX, label: 'tid t (s)', ticks: niceTicks(0, T_MAX, f > 1.3 ? 5 : 10) }}
      y={{ min: 0, max: cMax, label: 'konsentrasjon (mol/L)', decimals: cMax < 2 ? 1 : 0, ticks: niceTicks(0, cMax, f > 1.3 ? 4 : 5) }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, y1 }) => (
        <g>
          <line x1={cursorX(sx, t)} x2={cursorX(sx, t)} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          {species.map((s, i) => (
            <path
              key={s.key}
              d={linePath(
                samples.map((x) => [x.t, x.c[i] ?? 0]),
                sx,
                sy,
              )}
              fill="none"
              stroke={s.color}
              strokeWidth={3}
            />
          ))}
          {species.map((s, i) => (
            <circle
              key={`d${s.key}`}
              cx={cursorX(sx, t)}
              cy={sy(now.c[i] ?? 0)}
              r={6 * Math.max(1, 0.85 * f)}
              fill={s.color}
              stroke={VIZ.surface}
              strokeWidth={2}
            />
          ))}
        </g>
      )}
    </Plot>
  );
}

function RatePlot({ samples, t, height, f, stuck }: { samples: KineticsSample[]; t: number; height: number; f: number; stuck: boolean }) {
  const rMax = Math.max(0.05, ...samples.flatMap((s) => [s.rf, s.rb])) * 1.1;
  const now = sampleAt(samples, t);
  // Når er farten lik begge veier (innen 3 % av største fart)?
  const eq = stuck ? undefined : samples.find((_, i) => i > 0 && samples.slice(i).every((x) => Math.abs(x.rf - x.rb) < 0.03 * rMax));
  return (
    <Plot
      x={{ min: 0, max: T_MAX, label: 'tid t (s)', ticks: niceTicks(0, T_MAX, f > 1.3 ? 5 : 10) }}
      y={{ min: 0, max: rMax, label: 'fart (mol/(L·s))', decimals: rMax < 0.5 ? 2 : 1, ticks: niceTicks(0, rMax, f > 1.3 ? 4 : 5) }}
      width={800}
      height={height}
    >
      {({ sx, sy, y0, y1, x1 }) => (
        <g>
          {eq && (
            <g>
              <rect x={sx(eq.t)} y={y1} width={Math.max(0, x1 - sx(eq.t))} height={y0 - y1} fill={VIZ.muted} opacity={0.12} />
              {x1 - sx(eq.t) > 110 * f && (
                <Txt x={(sx(eq.t) + x1) / 2} y={y1 + 22 * f} size={0.8} weight={650} muted>
                  likevekt
                </Txt>
              )}
            </g>
          )}
          <line x1={cursorX(sx, t)} x2={cursorX(sx, t)} y1={y0} y2={y1} stroke={VIZ.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          <path
            d={linePath(
              samples.map((x) => [x.t, x.rf]),
              sx,
              sy,
            )}
            fill="none"
            stroke={FWD}
            strokeWidth={3}
          />
          <path
            d={linePath(
              samples.map((x) => [x.t, x.rb]),
              sx,
              sy,
            )}
            fill="none"
            stroke={BWD}
            strokeWidth={3}
            strokeDasharray="9 5"
          />
          <circle cx={cursorX(sx, t)} cy={sy(now.rf)} r={6 * Math.max(1, 0.85 * f)} fill={FWD} stroke={VIZ.surface} strokeWidth={2} />
          <circle cx={cursorX(sx, t)} cy={sy(now.rb)} r={6 * Math.max(1, 0.85 * f)} fill={BWD} stroke={VIZ.surface} strokeWidth={2} />
        </g>
      )}
    </Plot>
  );
}
