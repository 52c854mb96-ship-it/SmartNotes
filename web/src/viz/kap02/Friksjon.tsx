import { useState } from 'react';
import {
  Arrow,
  Block,
  Controls,
  Dot,
  Explain,
  Figure,
  Ground,
  Label,
  Legend,
  Plot,
  Readout,
  Readouts,
  Slider,
  Sub,
  TSub,
  VIZ,
  VizLayout,
  fmt,
} from '../kit';
import { friction } from './model';

const F_MAX = 80;
/** Piksler per newton i scenen. */
const PX_PER_N = 1.8;

interface State {
  F: number;
  m: number;
  muS: number;
  muK: number;
  moving: boolean;
}

export default function Friksjon() {
  const [s, setS] = useState<State>({ F: 12, m: 6, muS: 0.5, muK: 0.3, moving: false });
  const update = (patch: Partial<State>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      // μk ≤ μs: den som flyttes, dytter den andre.
      if (patch.muS !== undefined) next.muK = Math.min(next.muK, next.muS);
      if (patch.muK !== undefined) next.muK = Math.min(next.muK, next.muS);
      return { ...next, moving: friction({ ...next, wasMoving: prev.moving }).moving };
    });
  const r = friction({ ...s, wasMoving: s.moving });

  return (
    <VizLayout>
      <Controls>
        <Slider label="Dytt F" value={s.F} onChange={(F) => update({ F })} min={0} max={F_MAX} step={0.5} unit="N" decimals={1} />
        <Slider label="Masse m" value={s.m} onChange={(m) => update({ m })} min={1} max={8} step={0.5} unit="kg" decimals={1} />
        <Slider
          label={
            <>
              Statisk friksjonstall μ<Sub>s</Sub>
            </>
          }
          ariaLabel="Statisk friksjonstall"
          value={s.muS}
          onChange={(muS) => update({ muS })}
          min={0.1}
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
          min={0.05}
          max={1}
          step={0.05}
          decimals={2}
        />
      </Controls>

      <Scene F={s.F} m={s.m} N={r.N} R={r.R} moving={r.moving} a={r.a} />

      <Figure viewBox="0 0 800 400" label="Graf over friksjonskraften R som funksjon av dyttet F">
        <Plot x={{ min: 0, max: F_MAX, label: 'Dytt F (N)' }} y={{ min: 0, max: F_MAX, label: 'Friksjon R (N)' }} width={800} height={400}>
          {({ sx, sy, x1 }) => {
            const peak = Math.min(r.Rmax, F_MAX);
            return (
              <g>
                {/* Gren for en kloss som allerede glir (mellom μk·N og μs·N) */}
                <line x1={sx(r.Rk)} y1={sy(r.Rk)} x2={sx(peak)} y2={sy(r.Rk)} stroke={VIZ.friction} strokeWidth={2.5} strokeDasharray="6 6" opacity={0.7} />
                <polyline
                  points={`${sx(0)},${sy(0)} ${sx(peak)},${sy(peak)}`}
                  fill="none"
                  stroke={VIZ.friction}
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                />
                {r.Rmax < F_MAX && (
                  <>
                    <line x1={sx(peak)} y1={sy(peak)} x2={sx(peak)} y2={sy(r.Rk)} className="viz-guide" />
                    <line x1={sx(peak)} y1={sy(r.Rk)} x2={x1} y2={sy(r.Rk)} stroke={VIZ.friction} strokeWidth={3.5} />
                    {/* Etikettene flyttes så de ikke går ut av grafen eller overlapper hverandre */}
                    <Label
                      x={peak > F_MAX * 0.55 ? sx(peak) - 10 : sx(peak) + 8}
                      y={sy(peak) - 10}
                      anchor={peak > F_MAX * 0.55 ? 'end' : 'start'}
                      color={VIZ.friction}
                    >
                      μ<TSub>s</TSub>N = {fmt(r.Rmax, 1)} N
                    </Label>
                    <Label x={x1 - 4} y={r.Rmax - r.Rk < 12 && r.Rk > 15 ? sy(r.Rk) + 30 : sy(r.Rk) - 12} anchor="end" color={VIZ.friction}>
                      μ<TSub>k</TSub>N = {fmt(r.Rk, 1)} N
                    </Label>
                  </>
                )}
                <Dot x={sx(s.F)} y={sy(r.R)} color={VIZ.ink} />
              </g>
            );
          }}
        </Plot>
      </Figure>
      <Legend
        items={[
          { color: VIZ.friction, label: 'Friksjon når du øker dyttet fra null' },
          { color: VIZ.friction, label: 'Når klossen allerede glir', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Normalkraft N = mg" value={fmt(r.N, 1)} unit="N" tone={VIZ.normal} />
        <Readout label={
            r.moving ? (
              <>
                Glidefriksjon R = μ<Sub>k</Sub>N
              </>
            ) : (
              'Statisk friksjon R = F'
            )
          } value={fmt(r.R, 1)} unit="N" tone={VIZ.friction} />
        <Readout label="Akselerasjon a" value={fmt(r.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
      </Readouts>

      <Explain>
        {r.moving ? (
          <p>
            <strong>Klossen glir.</strong> Glidefriksjonen er konstant, R = μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N, uansett hvor hardt du dytter.
            Resten av kraften gir akselerasjon: a = (F − R)/m = ({fmt(s.F, 1)} N − {fmt(r.Rk, 1)} N)/{fmt(s.m, 1)} kg ={' '}
            {fmt(r.a, 2)} m/s². Klossen fortsetter å gli helt til dyttet blir mindre enn {fmt(r.Rk, 1)} N, selv om det trengs{' '}
            {fmt(r.Rmax, 1)} N for å få den i gang.
          </p>
        ) : (
          <p>
            <strong>Klossen står i ro.</strong> Den statiske friksjonen blir nøyaktig like stor som dyttet, R = F = {fmt(s.F, 1)} N, så
            kraftsummen er null. Den kan bli opptil μ<Sub>s</Sub>N = {fmt(r.Rmax, 1)} N. Dytt hardere enn det, så begynner klossen å gli,
            og friksjonen faller til glidefriksjonen μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N.
          </p>
        )}
      </Explain>
    </VizLayout>
  );
}

function Scene({ F, m, N, R, moving, a }: { F: number; m: number; N: number; R: number; moving: boolean; a: number }) {
  const floorY = 250;
  const w = 96 + m * 8;
  const h = 80;
  const cx = 450;
  const left = cx - w / 2;
  const top = floorY - h;
  const cy = top + h / 2;
  const len = (v: number) => v * PX_PER_N;
  const aLen = Math.min(220, 24 + a * 22);
  return (
    <Figure
      viewBox="0 0 800 380"
      label={`Kloss på ${fmt(m, 1)} kg som dyttes med ${fmt(F, 1)} N. ${moving ? 'Klossen glir.' : 'Klossen står i ro.'}`}
      maxHeight={360}
    >
      <Ground x1={30} x2={770} y={floorY} />
      <Block x={left} y={top} w={w} h={h} />
      <Label x={left + w + 12} y={top + 22} anchor="start" muted>
        {fmt(m, 1)} kg
      </Label>
      <Arrow x1={cx + 14} y1={floorY} x2={cx + 14} y2={floorY - len(N)} color={VIZ.normal} label="N" labelAnchor="start" labelX={cx + 26} labelY={floorY - len(N) + 12} />
      <Arrow x1={cx - 14} y1={cy} x2={cx - 14} y2={cy + len(N)} color={VIZ.gravity} label="G" labelAnchor="end" labelX={cx - 26} labelY={cy + len(N)} />
      <Arrow x1={left - len(F)} y1={cy} x2={left} y2={cy} color={VIZ.applied} label="F" labelX={left - len(F) - 10} labelY={cy + 6} labelAnchor="end" />
      <Arrow x1={cx} y1={floorY + 5} x2={cx - len(R)} y2={floorY + 5} color={VIZ.friction} label="R" labelX={cx - len(R) - 10} labelY={floorY + 28} labelAnchor="end" />
      {moving && <Arrow x1={left} y1={70} x2={left + aLen} y2={70} color={VIZ.acceleration} width={2.5} label="a" labelAnchor="start" labelX={left + aLen + 10} labelY={76} />}
      <Label x={40} y={40} anchor="start" muted>
        {moving ? 'Klossen glir' : 'Klossen står i ro'}
      </Label>
    </Figure>
  );
}
