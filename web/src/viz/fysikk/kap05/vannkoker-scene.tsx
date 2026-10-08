/**
 * Scenen i «Vannkoker eller kokeplate»: en kjøkkenbenk med vannkokeren til venstre og en kasserolle på en
 * frittstående kokeplate til høyre, begge koblet til hver sin stikkontakt. Bølgete piler viser varmetapet
 * (lengden er proporsjonal med den tapte effekten), og skilt over apparatene viser temperaturen i vannet.
 */
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Kasserolle, Kokeplate, Ledning, Rom, Stikkontakt, Vannkoker } from '../../kit/scene';
import type { BoilRun, HeatState } from './model-vannkoker';
import { Kjokken, Kopp, VarmetapPil } from './vannkoker-deler';

export const KETTLE_COLOR = VIZ.series[2];
export const POT_COLOR = VIZ.series[3];
export const LOSS_COLOR = VIZ.series[1];
export const WATER_COLOR = VIZ.series[0];
/** Største effekt på glidebryteren (W); kokeplata gløder i forhold til denne. */
export const P_MAX = 3000;
/** Største tapte effekt per pil (W): halvparten av (1 − 0,5) · 3000 W. */
const LOSS_PER_ARROW_MAX = 750;

export interface SceneLayout {
  W: number;
  H: number;
  tileTop: number;
  backY: number;
  counterY: number;
  frontY: number;
  edgeBot: number;
  doorW: number;
  kettleX: number;
  kettleSoloX: number;
  kettleSize: number;
  plateX: number;
  plateW: number;
  potW: number;
  socket: number;
  socketY: number;
  kettleSocketX: number;
  plateSocketX: number;
  tagY: number;
  /** Lengden på en varmetapspil ved største tap (px). */
  arrowMax: number;
}

export const SCENE_WIDE: SceneLayout = {
  W: 800,
  H: 410,
  tileTop: 170,
  backY: 288,
  counterY: 300,
  frontY: 312,
  edgeBot: 324,
  doorW: 200,
  kettleX: 235,
  kettleSoloX: 420,
  kettleSize: 175,
  plateX: 585,
  plateW: 215,
  potW: 150,
  socket: 50,
  socketY: 224,
  kettleSocketX: 95,
  plateSocketX: 742,
  tagY: 62,
  arrowMax: 92,
};

export const SCENE_NARROW: SceneLayout = {
  W: 560,
  H: 460,
  tileTop: 205,
  backY: 320,
  counterY: 332,
  frontY: 344,
  edgeBot: 356,
  doorW: 186,
  kettleX: 140,
  kettleSoloX: 300,
  kettleSize: 150,
  plateX: 390,
  plateW: 176,
  potW: 120,
  socket: 42,
  socketY: 262,
  kettleSocketX: 40,
  plateSocketX: 520,
  tagY: 78,
  arrowMax: 78,
};

export interface DeviceView {
  run: BoilRun;
  state: HeatState;
}

/** Hvor mye damp vi ser: litt fra 75 °C, full damp og bobler først når vannet koker. */
function steam(T: number, done: boolean): number {
  if (done || T >= 99.5) return 1;
  return Math.min(0.28, Math.max(0, (T - 75) / 25) * 0.28);
}

export function KitchenScene({
  lay,
  kettle,
  pot,
  P,
  liters,
  lid,
  anim,
}: {
  lay: SceneLayout;
  kettle: DeviceView;
  /** Kasserollen på kokeplata, eller null når den ikke er med. */
  pot: DeviceView | null;
  P: number;
  liters: number;
  lid: boolean;
  /** Tid til animasjon av damp og bobler (avspillingssekunder). */
  anim: number;
}) {
  const f = useTextScale();
  const { W, H, counterY, backY } = lay;
  const kx = pot ? lay.kettleX : lay.kettleSoloX;
  const ks = lay.kettleSize;
  const ksx = pot ? lay.kettleSocketX : lay.kettleSoloX - 0.8 * ks;
  const cordY = backY + 5;
  const sockBot = lay.socketY + 0.75 * lay.socket;
  const pxPerW = lay.arrowMax / LOSS_PER_ARROW_MAX;
  /** Bred figur: plass til hele navnet og effekten på skapdøra. */
  const wide = W >= 700;

  // Kokeplata og kasserollen (oppskriften i JSDoc til Kokeplate)
  const px = lay.plateX;
  const potY = counterY - 0.3 * lay.plateW + 0.08 * lay.potW;
  const rimY = potY - 0.57 * lay.potW;

  const kOn = !kettle.state.done;
  const kLoss = kOn ? kettle.run.lossPower : 0;
  const kLen = (kLoss / 2) * pxPerW;
  // Varmetapet fra vannkokeren stiger fra lokket (til venstre går det fri av tuten).
  const kLeft = { x: kx - 0.15 * ks, y: counterY - 0.93 * ks };
  const kRight = { x: kx + 0.15 * ks, y: counterY - 0.93 * ks };

  const pOn = pot ? !pot.state.done : false;
  const pLoss = pot && pOn ? pot.run.lossPower : 0;
  const pLen = (pLoss / 2) * pxPerW;
  // Fra kasserollen og den varme plata stiger varmen langs sidene og ut av kanten.
  const pLeft = { x: px - 0.5 * lay.potW - 2, y: rimY + 0.02 * lay.potW };
  const pRight = { x: px + 0.5 * lay.potW + 2, y: rimY + 0.02 * lay.potW };
  const ANG = 28;
  const tipOf = (p: { x: number; y: number }, ang: number, L: number) => ({
    x: p.x + Math.sin((ang * Math.PI) / 180) * L,
    y: p.y - Math.cos((ang * Math.PI) / 180) * L,
  });
  const kTip = tipOf(kRight, ANG, Math.max(kLen, 8));
  const pTip = tipOf(pRight, ANG, Math.max(pLen, 8));

  return (
    <g>
      <Rom x={0} y={0} w={W} h={H} gulvY={H} gulv="fliser" />
      <Kjokken
        W={W}
        H={H}
        tileTop={lay.tileTop}
        backY={backY}
        counterY={counterY}
        frontY={lay.frontY}
        edgeBot={lay.edgeBot}
        doorW={lay.doorW}
        doorCenters={pot ? [kx, px] : [kx]}
      />

      {/* Stikkontaktene med ledningene bak apparatene */}
      <Stikkontakt x={ksx} y={lay.socketY} size={lay.socket} stopsel />
      <Ledning points={[[ksx, sockBot], [ksx, cordY], [kx + 0.1 * ks, cordY]]} farge="svart" hjornerradius={10} bredde={4} />
      {pot && (
        <>
          <Stikkontakt x={lay.plateSocketX} y={lay.socketY} size={lay.socket} stopsel />
          <Ledning points={[[lay.plateSocketX, sockBot], [lay.plateSocketX, cordY], [px, cordY]]} farge="svart" hjornerradius={10} bredde={4} />
        </>
      )}

      <Vannkoker
        x={kx}
        y={counterY}
        size={ks}
        paa={kOn}
        vann={0.1 + 0.85 * Math.min(1, liters / 1.75)}
        damp={steam(kettle.state.T, kettle.state.done)}
        tid={anim}
        title={`Vannkoker, ${fmt(kettle.state.T, 0)} °C`}
      />
      {/* Uten kokeplata: en krus med tepose venter ved siden av vannkokeren */}
      {!pot && <Kopp x={kx + 0.8 * ks} y={counterY + 2} size={0.38 * ks} />}
      {pot && (
        <>
          <Kokeplate x={px} y={counterY} w={lay.plateW} effekt={pOn ? Math.min(1, P / P_MAX) : 0} />
          <Kasserolle
            x={px}
            y={potY}
            w={lay.potW}
            vann={Math.min(0.85, 0.12 + 0.7 * (liters / 1.75))}
            damp={steam(pot.state.T, pot.state.done) * (lid ? 0.6 : 1)}
            lokk={lid}
            snitt
            tid={anim}
            title={`Kasserolle på kokeplate, ${fmt(pot.state.T, 0)} °C`}
          />
        </>
      )}

      {/* Varmetapet: to piler per apparat, lengden proporsjonal med den tapte effekten */}
      {kOn && (
        <>
          <VarmetapPil x={kLeft.x} y={kLeft.y} angle={-ANG} length={kLen} color={LOSS_COLOR} />
          <VarmetapPil x={kRight.x} y={kRight.y} angle={ANG} length={kLen} color={LOSS_COLOR} />
          <LossLabel x={kTip.x + 6 * f} y={Math.min(kTip.y - 2, counterY - ks - 6 * f)} watt={kLoss} anchor="start" />
        </>
      )}
      {pot && pOn && (
        <>
          <VarmetapPil x={pLeft.x} y={pLeft.y} angle={-ANG} length={pLen} color={LOSS_COLOR} />
          <VarmetapPil x={pRight.x} y={pRight.y} angle={ANG} length={pLen} color={LOSS_COLOR} />
          {/* Over skaftet, også når pilene er korte */}
          <LossLabel x={pTip.x + 6 * f} y={Math.min(pTip.y - 2, rimY - 34 * f)} watt={pLoss} anchor="start" />
        </>
      )}

      {/* Temperaturen i vannet */}
      <TempTag x={kx} y={lay.tagY} view={kettle} color={KETTLE_COLOR} />
      {pot && <TempTag x={px} y={lay.tagY} view={pot} color={POT_COLOR} />}

      {/* Navn og virkningsgrad på skapdørene */}
      <DeviceLabel x={kx} y={lay.edgeBot + 44 * f} name="Vannkoker" eta={kettle.run.heater.eta} P={wide ? P : undefined} color={KETTLE_COLOR} />
      {pot && (
        <DeviceLabel
          x={px}
          y={lay.edgeBot + 44 * f}
          name={wide ? (lid ? 'Kasserolle med lokk' : 'Kasserolle uten lokk') : 'Kasserolle'}
          eta={pot.run.heater.eta}
          P={wide ? P : undefined}
          color={POT_COLOR}
        />
      )}
    </g>
  );
}

function TempTag({ x, y, view, color }: { x: number; y: number; view: DeviceView; color: string }) {
  const f = useTextScale();
  return (
    <g>
      {view.state.done && (
        <Txt x={x} y={y - 28 * f} size={0.82} weight={680} color={color}>
          Kokt etter {fmt(view.run.t, 0)} s
        </Txt>
      )}
      <ValueTagLite x={x} y={y} text={`${fmt(view.state.T, 0)} °C`} color={color} />
    </g>
  );
}

/** Skilt med temperaturen (som ValueTag i kit-et, men med fast bredde så det ikke hopper når tallet endres). */
function ValueTagLite({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const f = useTextScale();
  const fs = 17 * f * 1.05;
  const w = 6 * fs * 0.6 + 18 * f;
  const h = fs * 1.6;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h * 0.32} fill={VIZ.surface} stroke={color} strokeWidth={1.6} opacity={0.97} />
      <Txt x={x} y={y + fs * 0.35} size={1.05} weight={760} color={color} halo={false}>
        {text}
      </Txt>
    </g>
  );
}

function LossLabel({ x, y, watt, anchor }: { x: number; y: number; watt: number; anchor: 'start' | 'end' }) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={y} anchor={anchor} size={0.85} weight={720} color={LOSS_COLOR}>
        {fmt(watt, 0)} W
      </Txt>
      <Txt x={x} y={y + 18 * f} anchor={anchor} size={0.74} muted>
        varmetap
      </Txt>
    </g>
  );
}

function DeviceLabel({ x, y, name, eta, P, color }: { x: number; y: number; name: string; eta: number; P?: number; color: string }) {
  const f = useTextScale();
  return (
    <g>
      <Txt x={x} y={y} size={0.92} weight={740} color={color}>
        {name}
      </Txt>
      <Txt x={x} y={y + 22 * f} size={0.82} muted>
        {P !== undefined ? `P = ${fmt(P, 0)} W, ` : ''}η = {fmt(eta * 100, 0)} %
      </Txt>
    </g>
  );
}
