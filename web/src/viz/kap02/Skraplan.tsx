import { useState } from 'react';
import {
  Arrow,
  Block,
  Controls,
  Dot,
  Explain,
  Figure,
  Formula,
  FormulaLine,
  Ground,
  Label,
  Legend,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TSub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  linePath,
  sample,
  useTextScale,
} from '../kit';
import { criticalAngleDeg, incline, type InclineResult } from './model';
import { useNarrow } from './useNarrow';

const RAD = Math.PI / 180;
const ALPHA_MAX = 60;

interface State {
  alpha: number;
  m: number;
  muS: number;
  muK: number;
}

export default function Skraplan() {
  const [s, setS] = useState<State>({ alpha: 20, m: 4, muS: 0.5, muK: 0.3 });
  const [parts, setParts] = useState(true);
  const update = (patch: Partial<State>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      // μk ≤ μs: den som flyttes, dytter den andre.
      if (patch.muS !== undefined) next.muK = Math.min(next.muK, next.muS);
      if (patch.muK !== undefined) next.muS = Math.max(next.muS, next.muK);
      return next;
    });
  const r = incline({ alphaDeg: s.alpha, m: s.m, muS: s.muS, muK: s.muK });
  const crit = criticalAngleDeg(s.muS);
  const kinetic = criticalAngleDeg(s.muK);
  const [graphRef, narrow] = useNarrow<HTMLDivElement>();
  const graphH = narrow ? 460 : 360;

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Vinkel α"
          value={s.alpha}
          onChange={(alpha) => update({ alpha })}
          min={0}
          max={ALPHA_MAX}
          step={1}
          format={(v) => `${fmt(v, 0)}°`}
        />
        <Slider label="Masse m" value={s.m} onChange={(m) => update({ m })} min={1} max={10} step={0.5} unit="kg" decimals={1} />
        <Slider
          label={
            <>
              Statisk friksjonstall μ<Sub>s</Sub>
            </>
          }
          ariaLabel="Statisk friksjonstall"
          value={s.muS}
          onChange={(muS) => update({ muS })}
          min={0}
          max={1}
          step={0.05}
          decimals={2}
        />
        <Slider
          label={
            <>
              Glidefriksjonstall μ<Sub>k</Sub>
            </>
          }
          ariaLabel="Glidefriksjonstall"
          value={s.muK}
          onChange={(muK) => update({ muK })}
          min={0}
          max={1}
          step={0.05}
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <Toggle label="Vis komponentene av G" checked={parts} onChange={setParts} />
      </Toolbar>

      <Figure
        viewBox="0 0 800 400"
        label={`Kloss på ${fmt(s.m, 1)} kg på et skråplan med vinkel ${fmt(s.alpha, 0)} grader. ${r.moving ? 'Klossen glir nedover.' : 'Klossen ligger i ro.'}`}
        maxHeight={420}
      >
        <Scene alpha={s.alpha} m={s.m} r={r} parts={parts} />
      </Figure>

      <div ref={graphRef}>
        <Figure viewBox={`0 0 800 ${graphH}`} label="Graf over G∥, største statiske friksjon og friksjonen R som funksjon av vinkelen α">
          <ForceGraph alpha={s.alpha} r={r} muS={s.muS} muK={s.muK} crit={crit} height={graphH} />
        </Figure>
      </div>
      <Legend
        items={[
          {
            color: VIZ.gravity,
            label: (
              <span>
                G<Sub>∥</Sub> = G · sin α
              </span>
            ),
          },
          { color: VIZ.friction, label: 'Friksjon R når klossen slippes i ro' },
          {
            color: VIZ.friction,
            dashed: true,
            label: (
              <span>
                Største statiske friksjon μ<Sub>s</Sub>N
              </span>
            ),
          },
        ]}
      />

      <Readouts>
        <Readout label="Normalkraft N = G · cos α" value={fmt(r.N, 1)} unit="N" tone={VIZ.normal} />
        <Readout
          label={
            <>
              G<Sub>∥</Sub> = G · sin α
            </>
          }
          value={fmt(r.Gpar, 1)}
          unit="N"
          tone={VIZ.gravity}
        />
        <Readout
          label={
            r.moving ? (
              <>
                Glidefriksjon R = μ<Sub>k</Sub>N
              </>
            ) : (
              <>
                Statisk friksjon R = G<Sub>∥</Sub>
              </>
            )
          }
          value={fmt(r.R, 1)}
          unit="N"
          tone={VIZ.friction}
        />
        <Readout label="Akselerasjon a" value={fmt(r.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          G<Sub>∥</Sub> = G · sin α = {fmt(r.G, 1)} N · sin {fmt(s.alpha, 0)}° = {fmt(r.Gpar, 1)} N
        </FormulaLine>
        <FormulaLine>
          N = G<Sub>⊥</Sub> = G · cos α = {fmt(r.G, 1)} N · cos {fmt(s.alpha, 0)}° = {fmt(r.N, 1)} N
        </FormulaLine>
        {r.moving ? (
          <FormulaLine>
            a = g(sin α − μ<Sub>k</Sub> cos α) = 9,81 m/s² · (sin {fmt(s.alpha, 0)}° − {fmt(Math.min(s.muK, s.muS), 2)} · cos{' '}
            {fmt(s.alpha, 0)}°) = {fmt(r.a, 2)} m/s²
          </FormulaLine>
        ) : (
          <FormulaLine>
            R = G<Sub>∥</Sub> = {fmt(r.R, 1)} N ≤ μ<Sub>s</Sub>N = {fmt(r.Rmax, 1)} N
          </FormulaLine>
        )}
      </Formula>

      <Explain>
        {s.alpha === 0 ? (
          <p>
            <strong>Vannrett underlag.</strong> Tyngden har ingen komponent langs underlaget, så det trengs ingen friksjon for å holde
            klossen i ro, og N = G = {fmt(r.G, 1)} N. Øk vinkelen og se hvordan G<Sub>∥</Sub> vokser mens N blir mindre.
          </p>
        ) : r.moving ? (
          <p>
            <strong>Klossen glir.</strong> G<Sub>∥</Sub> = {fmt(r.Gpar, 1)} N er større enn den største statiske friksjonen μ<Sub>s</Sub>N ={' '}
            {fmt(r.Rmax, 1)} N, fordi tan α = {fmt(Math.tan(s.alpha * RAD), 2)} er større enn μ<Sub>s</Sub>. Nå virker glidefriksjonen R = μ
            <Sub>k</Sub>N = {fmt(r.Rk, 1)} N, og kraftsummen langs planet gir a = g(sin α − μ<Sub>k</Sub> cos α) = {fmt(r.a, 2)} m/s².
            Massen forkortes bort, så en tung og en lett kloss får samme akselerasjon.
          </p>
        ) : (
          <p>
            <strong>Klossen ligger i ro.</strong> Den statiske friksjonen er like stor som G<Sub>∥</Sub> = {fmt(r.Gpar, 1)} N, så
            kraftsummen er null, og normalkraften N = G<Sub>⊥</Sub> = {fmt(r.N, 1)} N er mindre enn G = {fmt(r.G, 1)} N. Klossen begynner å
            gli over grensevinkelen {fmt(crit, 1)}°, der tan α = μ<Sub>s</Sub>.
            {s.alpha > kinetic + 1e-9 && (
              <>
                {' '}
                Gir du den et lite dytt nå, fortsetter den å gli, fordi glidefriksjonen μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N er mindre enn G
                <Sub>∥</Sub>.
              </>
            )}
          </p>
        )}
        {parts && s.alpha > 0 && (
          <p>
            De stiplete pilene er bare G delt opp langs og vinkelrett på planet, ikke nye krefter: regn med enten G eller G<Sub>∥</Sub> og G
            <Sub>⊥</Sub>, aldri begge.
          </p>
        )}
      </Explain>
    </VizLayout>
  );
}

interface Pt {
  x: number;
  y: number;
}
const add = (p: Pt, v: Pt, k = 1): Pt => ({ x: p.x + v.x * k, y: p.y + v.y * k });

// Scenen (viewBox 800 × 400). Klossen står (nesten) fast, og skråplanet dreies rundt kontaktpunktet P0.
const P0_X = 340;
/** Lavest mulige kontaktpunkt (ved små vinkler, der N-pila er lang). */
const P0_Y_MAX = 228;
const X_LEFT = 30;
const X_RIGHT = 770;
const Y_TOP = 14;
const GROUND = 385;
/** Lengden på G-pila i piksler. De andre kreftene tegnes i samme skala. */
const LG = 150;

function Scene({ alpha, m, r, parts }: { alpha: number; m: number; r: InclineResult; parts: boolean }) {
  const f = useTextScale();
  const al = alpha * RAD;
  const c = Math.cos(al);
  const sn = Math.sin(al);
  /** Retning nedover langs planet og normalen ut fra planet. */
  const d: Pt = { x: c, y: sn };
  const n: Pt = { x: sn, y: -c };

  const w = 70 + m * 5;
  const h = 46 + m * 2.4;
  // Ved bratte vinkler er N-pila kort, så klossen løftes til N-spissen ligger like under toppen. Da får
  // G-pila og vinkelen ved foten av planet plass hver for seg i stedet for å havne oppå hverandre.
  const P0: Pt = { x: P0_X, y: Math.min(P0_Y_MAX, Y_TOP + 50 + c * (h / 2 + LG * c)) };

  // Skråplanet: linjen P0 + d·t, klippet mot figurkanten og bakken.
  let tL = (X_LEFT - P0.x) / c;
  if (P0.y + tL * sn < Y_TOP) tL = (Y_TOP - P0.y) / sn;
  let tR = sn > 1e-9 ? (GROUND - P0.y) / sn : Infinity;
  const cornerVisible = P0.x + tR * c <= X_RIGHT;
  if (!cornerVisible) tR = (X_RIGHT - P0.x) / c;
  const left = add(P0, d, tL);
  const right = add(P0, d, tR);

  const C = add(P0, n, h / 2);
  const k = LG / r.G;

  const gTip = add(C, { x: 0, y: 1 }, LG);
  const parTip = add(C, d, r.Gpar * k);
  const perpTip = add(C, n, -r.Gperp * k);
  const nTip = add(C, n, r.N * k);
  const rStart = add(P0, n, 3);
  const rTip = add(rStart, d, -r.R * k);

  const aLen = Math.min(200, 26 + r.a * 20);
  const aFrom = add(add(C, n, h / 2 + 26 + 10 * f), d, 14);
  const aTo = add(aFrom, d, aLen);

  // Vinkelen α mellom planet og det vannrette (ved foten, eller ved figurkanten når foten er utenfor)
  const arcR = 80;
  const arcStart = { x: right.x - arcR, y: right.y };
  const arcEnd = add(right, d, -arcR);
  const arcLabel = { x: right.x - (arcR + 22 * f) * Math.cos(al / 2), y: right.y - (arcR + 22 * f) * Math.sin(al / 2) + 6 };
  // Vinkelen mellom G og G⊥ er også α
  const smallR = 46;
  const smallEnd = add(C, { x: -sn, y: c }, smallR);
  const smallLabel = add(C, { x: -Math.sin(al / 2), y: Math.cos(al / 2) }, smallR + 16);

  return (
    <>
      <path
        d={`M ${left.x} ${left.y} L ${right.x} ${right.y} L ${right.x} ${GROUND} L ${left.x} ${GROUND} Z`}
        fill={VIZ.body}
        className="viz-block"
        strokeLinejoin="round"
      />
      <Ground x1={20} x2={780} y={GROUND} />
      {alpha > 0 && (
        <>
          {!cornerVisible && <line x1={right.x} y1={right.y} x2={right.x - arcR - 40} y2={right.y} className="viz-guide" />}
          <path d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} className="viz-guide" />
          <Label x={arcLabel.x} y={arcLabel.y} anchor="middle">
            α
          </Label>
        </>
      )}

      <Block x={C.x - w / 2} y={C.y - h / 2} w={w} h={h} rotate={alpha} />

      {parts && alpha > 0 && (
        <g>
          <line x1={parTip.x} y1={parTip.y} x2={gTip.x} y2={gTip.y} className="viz-guide" />
          <line x1={perpTip.x} y1={perpTip.y} x2={gTip.x} y2={gTip.y} className="viz-guide" />
          <Arrow x1={C.x} y1={C.y} x2={parTip.x} y2={parTip.y} color={VIZ.gravity} dashed width={2.5} />
          <Arrow x1={C.x} y1={C.y} x2={perpTip.x} y2={perpTip.y} color={VIZ.gravity} dashed width={2.5} />
          {alpha >= 25 && (
            <>
              <path d={`M ${C.x} ${C.y + smallR} A ${smallR} ${smallR} 0 0 1 ${smallEnd.x} ${smallEnd.y}`} className="viz-guide" />
              <Label x={smallLabel.x} y={smallLabel.y + 6} muted>
                α
              </Label>
            </>
          )}
          <Label x={parTip.x + 10} y={parTip.y + 10} anchor="start" color={VIZ.gravity}>
            G<TSub>∥</TSub>
          </Label>
          <Label x={perpTip.x - 10} y={perpTip.y + 6} anchor="end" color={VIZ.gravity}>
            G<TSub>⊥</TSub>
          </Label>
        </g>
      )}

      <Arrow
        x1={C.x}
        y1={C.y}
        x2={gTip.x}
        y2={gTip.y}
        color={VIZ.gravity}
        label="G"
        labelAnchor="start"
        labelX={gTip.x + 10}
        labelY={gTip.y + 2}
      />
      <Arrow
        x1={C.x}
        y1={C.y}
        x2={nTip.x}
        y2={nTip.y}
        color={VIZ.normal}
        label="N"
        labelAnchor="start"
        labelX={nTip.x + 10}
        labelY={nTip.y + 8}
      />
      <Arrow
        x1={rStart.x}
        y1={rStart.y}
        x2={rTip.x}
        y2={rTip.y}
        color={VIZ.friction}
        label="R"
        labelAnchor="end"
        labelX={rTip.x - 8}
        labelY={rTip.y - 6}
        minLength={4}
      />
      {r.moving && (
        <Arrow
          x1={aFrom.x}
          y1={aFrom.y}
          x2={aTo.x}
          y2={aTo.y}
          color={VIZ.acceleration}
          width={2.5}
          label="a"
          labelAnchor="start"
          labelX={aTo.x + 10}
          labelY={aTo.y + 6}
        />
      )}

      <Label x={780} y={36} anchor="end" muted>
        {r.moving ? 'Klossen glir nedover' : 'Klossen ligger i ro'}
      </Label>
    </>
  );
}

function niceMax(v: number): number {
  for (const c of [10, 20, 25, 40, 50, 60, 80, 100, 120]) if (c >= v) return c;
  return Math.ceil(v / 50) * 50;
}

function ForceGraph({
  alpha,
  r,
  muS,
  muK,
  crit,
  height,
}: {
  alpha: number;
  r: InclineResult;
  muS: number;
  muK: number;
  crit: number;
  height: number;
}) {
  const f = useTextScale();
  const G = r.G;
  const yMax = niceMax(G);
  const gPar = (a: number) => G * Math.sin(a * RAD);
  const sMax = (a: number) => muS * G * Math.cos(a * RAD);
  const kin = (a: number) => Math.min(muK, muS) * G * Math.cos(a * RAD);
  const critShown = crit <= ALPHA_MAX;
  return (
    <Plot x={{ min: 0, max: ALPHA_MAX, label: 'Vinkel α (°)' }} y={{ min: 0, max: yMax, label: 'Kraft (N)' }} width={800} height={height}>
      {({ sx, sy, x0, y0, y1 }) => {
        const restPart = sample(gPar, 0, Math.min(crit, ALPHA_MAX), 80);
        const slidePart = critShown ? sample(kin, crit, ALPHA_MAX, 80) : [];
        // Etiketten for grensevinkelen står til venstre for linja når den får plass der, ellers til høyre.
        const critText = `grensevinkel ${fmt(crit, 1)}°`;
        const right = crit >= 20 && sx(crit) - 8 - critText.length * 9.6 * f > x0 + 4;
        return (
          <g>
            <path
              d={linePath(sample(sMax, 0, ALPHA_MAX, 120), sx, sy)}
              fill="none"
              stroke={VIZ.friction}
              strokeWidth={2}
              strokeDasharray="7 6"
            />
            <path d={linePath(sample(gPar, 0, ALPHA_MAX, 120), sx, sy)} fill="none" stroke={VIZ.gravity} strokeWidth={2.5} />
            {critShown && crit >= 0.5 && (
              <>
                <line x1={sx(crit)} y1={y0} x2={sx(crit)} y2={y1 + 8 * f} className="viz-guide" />
                <Label x={right ? sx(crit) - 8 : sx(crit) + 8} y={y1 + 20 * f} anchor={right ? 'end' : 'start'} muted>
                  {critText}
                </Label>
              </>
            )}
            <path d={linePath(restPart, sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={6} strokeLinejoin="round" />
            {critShown && (
              <path d={linePath(slidePart, sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={3.5} strokeLinejoin="round" />
            )}
            {/* I ro er R = G∥: G∥ tegnes tynt oppå friksjonen, så begge linjene syns */}
            <path d={linePath(restPart, sx, sy)} fill="none" stroke={VIZ.gravity} strokeWidth={2} />
            <Label x={sx(ALPHA_MAX - 1)} y={sy(gPar(ALPHA_MAX - 1)) + 28 * f} anchor="end" color={VIZ.gravity}>
              G<TSub>∥</TSub>
            </Label>
            {muS > 0.04 && (
              <Label x={sx(1.5)} y={muS > 0.3 ? sy(sMax(1.5)) + 26 * f : sy(sMax(1.5)) - 10} anchor="start" color={VIZ.friction}>
                μ<TSub>s</TSub>N
              </Label>
            )}
            <Dot x={sx(alpha)} y={sy(r.R)} color={VIZ.ink} />
          </g>
        );
      }}
    </Plot>
  );
}
