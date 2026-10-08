/**
 * Scenen i «Varmepumpe eller panelovn»: et rødt trehus i snitt en vinterkveld. Utedelen står på et stativ ute i
 * snøen, rørene går i en kabelkanal gjennom veggen til innedelen høyt på veggen i stua, og under vinduet står en
 * panelovn. Brede energipiler viser effektene: varme fra uteluften Q_k og elektrisk energi W inn i varmepumpa,
 * varme Q_v ut i stua. Bredden er proporsjonal med effekten (fast skala px/kW), så Q_v = Q_k + W synes.
 */
import { useMemo } from 'react';
import { TSub, Txt, fmt, useTextScale } from '../../kit';
import { Gran, Himmel, Landskap, Ledning, Panelovn, Stikkontakt, Underlag, ValueTag } from '../../kit/scene';
import type { HeatPumpState } from './model-varmepumpe';
import {
  Energipil,
  FLOW,
  Gulvlampe,
  HusInne,
  HusSnitt,
  Innedel,
  Kabelkanal,
  Utedel,
  Vindu,
  ceilAt,
  innedelMaal,
  utedelMaal,
  type HusGeo,
} from './varmepumpe-deler';

export type Heater = 'pumpe' | 'ovn';

export interface SceneGeo extends HusGeo {
  horizon: number;
  /** Bredden på pilene per kW effekt. */
  pxPerKW: number;
  sun: { x: number; y: number; r: number };
  trees: { x: number; y: number; size: number; seed: number }[];
}

export const SCENE_WIDE: SceneGeo = {
  W: 800,
  H: 440,
  px: 100,
  ground: 384,
  gulvY: 349,
  eave: 349 - 2.4 * 100,
  wallX: 352,
  wt: 24,
  slope: 0.28,
  horizon: 300,
  pxPerKW: 6,
  sun: { x: 196, y: 258, r: 12 },
  trees: [
    { x: 46, y: 326, size: 118, seed: 2 },
    { x: 104, y: 316, size: 82, seed: 5 },
  ],
};

export const SCENE_NARROW: SceneGeo = {
  W: 560,
  H: 480,
  px: 84,
  ground: 422,
  gulvY: 422 - 0.35 * 84,
  eave: 422 - 0.35 * 84 - 2.4 * 84,
  wallX: 200,
  wt: 20,
  slope: 0.28,
  horizon: 350,
  pxPerKW: 5,
  sun: { x: 62, y: 250, r: 10 },
  trees: [{ x: 30, y: 372, size: 96, seed: 2 }],
};

/** Plasseringen av alt i scenen (regnet ut fra geometrien, så det smale oppsettet følger med). */
export function sceneLayout(g: SceneGeo) {
  const inL = g.wallX + g.wt;
  const roomW = g.W - inL;
  const unitW = 0.85 * g.px;
  const unitX = g.wallX - 0.5 * g.px - unitW / 2;
  const inW = 0.92 * g.px;
  const inX = inL + 0.45 * g.px + inW / 2;
  const inTop = g.eave + 0.16 * g.px;
  const winW = g.px;
  const winH = 1.15 * g.px;
  const winX = inL + 0.7 * roomW;
  const winTop = g.gulvY - 0.8 * g.px - winH;
  const ovnW = g.px;
  const ovnY = g.gulvY + 2;
  const ovnH = 0.4 * ovnW;
  const ovnTop = ovnY - 0.32 * ovnH - ovnH;
  const socket = { x: winX - ovnW / 2 - 0.85 * g.px, y: g.gulvY - 0.3 * g.px, size: 0.15 * g.px };
  return {
    inL,
    unit: { x: unitX, w: unitW, m: utedelMaal(unitX, g.ground, unitW) },
    indoor: { x: inX, top: inTop, w: inW, m: innedelMaal(inX, inTop, inW) },
    win: { x: winX, top: winTop, w: winW, h: winH },
    ovn: { x: winX, y: ovnY, w: ovnW, h: ovnH, top: ovnTop, mid: ovnTop + ovnH / 2, left: winX - ovnW / 2 },
    socket,
  };
}

export interface VarmepumpeSceneProps {
  geo: SceneGeo;
  s: HeatPumpState;
  heater: Heater;
  /** Vis temperaturen i kuldemediet på ute- og innedelen. */
  showRefrigerant: boolean;
}

/** Hvor mye snø: full snø ved 0 °C og kaldere, ingen over 3 °C. */
export function snowAmount(tOut: number): number {
  return Math.max(0, Math.min(1, (3 - tOut) / 3));
}

function Background({ g, winter }: { g: SceneGeo; winter: boolean }) {
  return useMemo(
    () => (
      <g>
        <Himmel w={g.W} h={g.horizon + 2} sol={g.sun} skyer={1} seed={4} />
        <Landskap x={0} y={g.horizon} w={g.wallX + 20} h={0.55 * g.px} type="skog" seed={6} />
        <Underlag x1={0} x2={g.wallX + 2} y={g.ground} depth={g.H - g.ground} type={winter ? 'sno' : 'gress'} horisont={g.horizon} seed={3} />
        {g.trees.map((t) => (
          <Gran key={t.x} x={t.x} y={t.y} size={t.size} sno={winter} seed={t.seed} />
        ))}
      </g>
    ),
    [g, winter],
  );
}

export function VarmepumpeScene({ geo: g, s, heater, showRefrigerant }: VarmepumpeSceneProps) {
  const f = useTextScale();
  const L = sceneLayout(g);
  const winter = s.tOut <= 1;
  const sno = snowAmount(s.tOut);
  const pumpOn = heater === 'pumpe';
  const { unit, indoor, win, ovn, socket } = L;
  const um = unit.m;
  const im = indoor.m;
  const narrow = g.W < 700;
  const k = g.pxPerKW / 1000;

  // Kabelkanalen: fra innedelen langs veggen, gjennom ytterveggen og ned til utedelen
  const ductX = g.wallX - 0.05 * g.px;
  const duct: [number, number][] = [
    [im.left + 2, im.pipe.y],
    [ductX, im.pipe.y],
    [ductX, um.pipe.y],
    [um.right + 2, um.pipe.y],
  ];
  const ductW = 0.085 * g.px;

  // Energipilene (bredde = effekt · px/kW)
  const wPump = s.pump.W * k;
  const wQk = s.pump.Qk * k;
  const wQv = s.need * k;
  const snowTop = um.top - 0.075 * unit.w * sno;
  const qk = { x1: 0.08 * g.wallX, y: um.top + 0.5 * um.h, x2: um.left - 5 };
  const wArrow = { x: um.right - 0.19 * unit.w, y1: snowTop - 0.75 * g.px, y2: snowTop - 3 };
  const qv = { x: indoor.x, y1: im.bottom + 0.2 * im.h, y2: im.bottom + 0.2 * im.h + 0.95 * g.px };
  const ovnW = { x1: socket.x + 0.6 * socket.size, x2: ovn.left - 4, y: ovn.mid };
  const ovnQ = { x: ovn.x, y1: ovn.top - 4, y2: ovn.top - 4 - 0.95 * g.px };

  // Skiltene
  const tagSize = narrow ? 0.85 : 0.9;
  const tagW = (text: string) => Math.max(17 * f * tagSize * 1.6, text.length * 17 * f * tagSize * 0.6 + 16 * f);
  const tagH = 17 * f * tagSize * 1.55;
  const outText = `Ute: ${fmt(s.tOut, 0)} °C`;
  const inText = `Inne: ${fmt(s.tIn, 0)} °C`;
  const inTagW = tagW(inText);
  const inTagX = g.W - 8 - inTagW / 2;
  const inTagY = Math.max(ceilAt(g, inTagX - inTagW / 2), ceilAt(g, inTagX + inTagW / 2)) + tagH / 2 + 8;
  const coldText = narrow ? `${fmt(s.refrigerant.evap, 0)} °C` : `Kuldemediet: ${fmt(s.refrigerant.evap, 0)} °C`;
  const hotText = narrow ? `${fmt(s.refrigerant.cond, 0)} °C` : `Kuldemediet: ${fmt(s.refrigerant.cond, 0)} °C`;
  const coldTag = { x: Math.max(4 + tagW(coldText) / 2, Math.min(g.wallX - 6 - tagW(coldText) / 2, unit.x)), y: g.ground + 0.5 * (g.H - g.ground) };
  const hotTag = { x: im.right + 8, y: im.top + im.h / 2 };

  const sub = (main: string, s2: string) => (
    <>
      {main}
      <TSub>{s2}</TSub>
    </>
  );

  return (
    <g>
      <Background g={g} winter={winter} />

      {/* Inne i stua: vindu, panelovn med stikkontakt og innedelen høyt på veggen */}
      <HusInne g={g}>
        <Gulvlampe x={g.W - 0.32 * g.px} y={g.gulvY + 0.06 * g.px} h={1.5 * g.px} />
        <Vindu x={win.x} top={win.top} w={win.w} h={win.h} sno={winter} />
        <Ledning
          points={[
            [socket.x, socket.y + 0.75 * socket.size],
            [socket.x, g.gulvY - 3],
            [ovn.left + 0.12 * ovn.w, g.gulvY - 3],
            [ovn.left + 0.12 * ovn.w, ovn.top + ovn.h - 2],
          ]}
          farge="svart"
          bredde={0.03 * g.px}
          hjornerradius={0.06 * g.px}
        />
        <Stikkontakt x={socket.x} y={socket.y} size={socket.size} stopsel />
        <Panelovn x={ovn.x} y={ovn.y} w={ovn.w} paa={!pumpOn} />
        <Innedel x={indoor.x} y={indoor.top} w={indoor.w} paa={pumpOn} />
      </HusInne>

      <Kabelkanal points={duct} bredde={ductW} />
      <HusSnitt g={g} sno={winter} />
      {/* Rørgjennomføringen i veggen */}
      <rect x={g.wallX - 1} y={im.pipe.y - ductW / 2} width={g.wt + 2} height={ductW} fill="var(--sc-plastic)" opacity={0.9} />
      <Utedel x={unit.x} y={g.ground} w={unit.w} sno={sno} paa={pumpOn} vifte={pumpOn ? 18 : 40} />

      {/* Energipilene */}
      {pumpOn ? (
        <g>
          <Energipil x1={qk.x1} y1={qk.y} x2={qk.x2} y2={qk.y} bredde={wQk} farge={FLOW.Qk} boelger={narrow ? 1.5 : 2} />
          <Txt x={qk.x1 + 2} y={qk.y + Math.max(0.75 * wQk + 3, 6) + 20 * f} anchor="start" color={FLOW.Qk} weight={720}>
            {sub('Q', 'k')}
          </Txt>
          <Energipil x1={wArrow.x} y1={wArrow.y1} x2={wArrow.x} y2={wArrow.y2} bredde={wPump} farge={FLOW.W} />
          <Txt x={wArrow.x - Math.max(wPump / 2, 6) - 8 * f} y={wArrow.y1 + 18 * f} anchor="end" color={FLOW.W} weight={720}>
            W
          </Txt>
          <Energipil x1={qv.x} y1={qv.y1} x2={qv.x} y2={qv.y2} bredde={wQv} farge={FLOW.Qv} boelger={1.5} />
          <Txt x={qv.x + wQv / 2 + 12 * f} y={(qv.y1 + qv.y2) / 2 + 6 * f} anchor="start" color={FLOW.Qv} weight={720}>
            {sub('Q', 'v')}
          </Txt>
        </g>
      ) : (
        <g>
          <Energipil x1={ovnW.x1} y1={ovnW.y} x2={ovnW.x2} y2={ovnW.y} bredde={wQv} farge={FLOW.W} />
          <Txt x={(ovnW.x1 + ovnW.x2) / 2} y={ovnW.y - wQv / 2 - 10 * f} anchor="middle" color={FLOW.W} weight={720}>
            W
          </Txt>
          <Energipil x1={ovnQ.x} y1={ovnQ.y1} x2={ovnQ.x} y2={ovnQ.y2} bredde={wQv} farge={FLOW.Qv} boelger={1.5} />
          <Txt x={ovnQ.x + wQv / 2 + 12 * f} y={(ovnQ.y1 + ovnQ.y2) / 2 + 6 * f} anchor="start" color={FLOW.Qv} weight={720}>
            {sub('Q', 'v')}
          </Txt>
        </g>
      )}

      {/* Temperaturene */}
      <ValueTag x={Math.max(8 + tagW(outText) / 2, 0.42 * g.wallX)} y={10 + tagH / 2 + 4 * f} text={outText} color={FLOW.Qk} size={tagSize} />
      <ValueTag x={inTagX} y={inTagY} text={inText} color={FLOW.Qv} size={tagSize} />
      {pumpOn && showRefrigerant && (
        <g>
          <ValueTag x={coldTag.x} y={coldTag.y} text={coldText} color={FLOW.Qk} size={tagSize} />
          <ValueTag x={hotTag.x} y={hotTag.y} text={hotText} color={FLOW.Qv} size={tagSize} anchor="start" />
        </g>
      )}
    </g>
  );
}
