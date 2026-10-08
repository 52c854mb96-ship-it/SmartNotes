/**
 * Scenen i «Spesifikk varmekapasitet»: to like kokeplater på en labbenk. På hver plate står enten en kasserolle
 * med væske (i snitt, så væska og termometeret synes) eller en metallkloss med termometeret i et hull. Alt er
 * tegnet med én skala (px/m), så samme masse gir ulik størrelse. En felles stoppeklokke står mellom platene.
 * Skilt over stoffene viser temperaturen, og bølgete piler (lengde ∝ effekten) viser energien inn i stoffet.
 */
import type { ReactNode } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Kasserolle, Kokeplate, Rom, SCENE, Stoppeklokke, Termometer, Underlag, ValueTag, alpha, useStrokeScale } from '../../kit/scene';
import type { HeatingState, Material } from './model';
import { SIZES, SYMBOL, blockDiameter, potFill, steamAmount, volume } from './varmekapasitet-scene';
import { Metallkloss, VarmePil, metalColor } from './varmekapasitet-deler';

/** Fargen på energien (varmen) inn i stoffet: samme som Q i «Termofysikkens første lov». */
export const HEAT_COLOR = VIZ.series[1];
/** Største effekt på glidebryteren (W): kokeplata gløder i forhold til denne. */
export const P_MAX = 2000;

export interface SceneLayout {
  W: number;
  H: number;
  /** Skala: piksler per meter. */
  K: number;
  /** Midten av de to kokeplatene. */
  cx: [number, number];
  /** Benkeplata (der kokeplatene står). */
  benchY: number;
  /** Midten av temperaturskiltene. */
  tagY: number;
  watch: { x: number; y: number; r: number };
  /** Lengden på varmepila ved største effekt (px). */
  arrowMax: number;
}

export const SCENE_WIDE: SceneLayout = {
  W: 800,
  H: 444,
  K: 800,
  cx: [228, 572],
  benchY: 334,
  tagY: 38,
  watch: { x: 400, y: 84, r: 34 },
  arrowMax: 48,
};

/**
 * Smal skjerm: platene står tettere, så gjenstandene blir større. Skaftene på kasserollene går da litt ut av
 * bildet (som et utsnitt), og stoppeklokka står mellom termometrene.
 */
export const SCENE_NARROW: SceneLayout = {
  W: 520,
  H: 384,
  K: 600,
  cx: [128, 392],
  benchY: 270,
  tagY: 30,
  watch: { x: 260, y: 62, r: 24 },
  arrowMax: 38,
};

export interface StationView {
  mat: Material;
  color: string;
  /** Tilstanden nå (temperatur, tilført energi, koking, fordampet masse). */
  state: HeatingState;
  /** Plata er på (ønsket temperatur ikke nådd ennå). */
  on: boolean;
  /** Tiden det tar å nå ønsket temperatur (Infinity hvis væsken koker først). */
  tDone: number;
}

export function HeatScene({
  lay,
  stations,
  m,
  P,
  t,
  T1,
  anim,
  showEnergy,
}: {
  lay: SceneLayout;
  stations: [StationView, StationView];
  m: number;
  P: number;
  t: number;
  T1: number;
  /** Tid til animasjon av damp og bobler (avspillingssekunder). */
  anim: number;
  showEnergy: boolean;
}) {
  const { W, H, benchY, watch } = lay;
  return (
    <g>
      <Rom x={-4} y={0} w={W + 8} h={H} gulvY={H - 6} gulv="betong" />
      <Underlag x1={-4} x2={W + 4} y={benchY} depth={H - benchY + 4} type="labbenk" />

      {stations.map((s, i) => (
        <Station key={i} lay={lay} view={s} cx={lay.cx[i as 0 | 1]} inward={i === 0 ? 1 : -1} m={m} P={P} T1={T1} anim={anim} showEnergy={showEnergy} />
      ))}

      {/* Felles stoppeklokke: begge platene ble slått på samtidig */}
      <Stoppeklokke x={watch.x} y={watch.y} r={watch.r} t={t} desimaler={0} title={`Stoppeklokke: ${fmt(t, 0)} s`} />
    </g>
  );
}

function Station({
  lay,
  view,
  cx,
  inward,
  m,
  P,
  T1,
  anim,
  showEnergy,
}: {
  lay: SceneLayout;
  view: StationView;
  cx: number;
  /** +1 når midten av figuren er til høyre for stasjonen (den venstre), ellers −1. */
  inward: 1 | -1;
  m: number;
  P: number;
  T1: number;
  anim: number;
  showEnergy: boolean;
}) {
  const f = useTextScale();
  const { K, benchY } = lay;
  const { mat, state, on, color } = view;
  const liquid = mat.boil !== undefined;
  const plateW = SIZES.plate * K;
  const plateCY = benchY - 0.304 * plateW;
  const thermoH = SIZES.thermometer * K;
  const tw = Math.max(7, 0.06 * thermoH);
  const arrowLen = (P / P_MAX) * lay.arrowMax;

  let body: ReactNode;
  let arrows: number[] = [];
  let arrowY = plateCY;
  if (liquid) {
    const potW = SIZES.pot * K;
    const k = potW / 100;
    const potY = plateCY + 0.08 * potW;
    const floorY = potY - 10.5 * k;
    const rimY = potY - 58 * k;
    const v = potFill(volume(mat.id, Math.max(0, m - state.evaporated)));
    const surfY = potY + (-10.5 - v * 45) * k;
    // Termometeret står på bunnen og lener seg mot kanten av kasserollen (innover mot midten av figuren)
    const bx = cx + inward * 0.3 * potW;
    const lean = (Math.atan((0.465 * potW - 0.3 * potW) / (floorY - rimY)) * 180) / Math.PI;
    arrows = [cx - inward * 0.3 * potW, cx - inward * 0.04 * potW];
    arrowY = floorY + 0.05 * potW;
    body = (
      <>
        <Kasserolle
          x={cx}
          y={potY}
          w={potW}
          vann={v}
          damp={steamAmount(mat, state.T, state.boiling)}
          snitt
          flip={inward > 0}
          tid={anim}
          title={`Kasserolle med ${fmt(m, 2)} kg ${mat.name.toLowerCase()}`}
        />
        <Termometer
          x={bx}
          y={floorY - 1}
          h={thermoH}
          temp={state.T}
          min={0}
          max={100}
          skala={inward > 0 ? 'hoyre' : 'venstre'}
          rotate={inward * lean}
          title={`Termometer: ${fmt(state.T, 1)} °C`}
        />
        {/* Den nederste delen av termometeret står i væska */}
        {v > 0 && surfY < floorY && (
          <rect x={cx - 48.5 * k} y={surfY} width={97 * k} height={floorY - surfY} fill={alpha(SCENE.water, 0.32)} />
        )}
      </>
    );
  } else {
    const d = Math.max(4, blockDiameter(mat.id, m) * K);
    const h = d;
    const hr = 0.62 * tw;
    const hx = cx + inward * Math.max(0, Math.min(0.2 * d, d / 2 - hr - 2));
    const top = plateCY - h;
    const lean = 10;
    const dep = Math.min(0.6 * h, 1.7 * tw);
    const ax = hx - inward * dep * Math.sin((lean * Math.PI) / 180);
    const ay = top + dep * Math.cos((lean * Math.PI) / 180);
    arrows = [d > 34 ? cx - inward * 0.25 * d : cx];
    arrowY = plateCY + 2;
    body = (
      <Metallkloss
        x={cx}
        y={plateCY}
        d={d}
        h={h}
        color={metalColor(mat.id)}
        symbol={SYMBOL[mat.id]}
        symbolX={cx + inward * 0.18 * d}
        hole={{ x: hx, r: hr }}
        title={`Kloss av ${mat.name.toLowerCase()}, ${fmt(m, 2)} kg`}
      >
        <Termometer
          x={ax}
          y={ay}
          h={thermoH}
          temp={state.T}
          min={0}
          max={100}
          skala={inward > 0 ? 'hoyre' : 'venstre'}
          rotate={inward * lean}
          title={`Termometer: ${fmt(state.T, 1)} °C`}
        />
      </Metallkloss>
    );
  }

  // Skiltet med temperaturen over stoffet, litt ut fra midten så det ikke dekker termometeret
  const tagX = cx - inward * 44 * f;
  const status = !on
    ? `Nådde ${fmt(T1, 0)} °C etter ${fmt(view.tDone, 0)} s`
    : state.boiling
      ? `Koker ved ${fmt(mat.boil ?? 0, 0)} °C`
      : `P = ${fmt(P, 0)} W til ${fmt(T1, 0)} °C`;

  return (
    <g>
      <Kokeplate x={cx} y={benchY} w={plateW} effekt={on ? Math.min(1, P / P_MAX) : 0} title={on ? `Kokeplate, ${fmt(P, 0)} W` : 'Kokeplate, slått av'} />
      {body}
      {showEnergy && on && arrows.map((x, j) => <VarmePil key={j} x={x} y={arrowY} length={arrowLen} color={HEAT_COLOR} />)}

      <ValueTag x={tagX} y={lay.tagY} text={`${fmt(state.T, 1)} °C`} color={color} size={1.1} />
      {showEnergy && (
        <Txt x={tagX} y={lay.tagY + 34 * f} size={0.82} weight={700} color={HEAT_COLOR}>
          Q = {fmt(state.Q / 1000, 1)} kJ
        </Txt>
      )}

      {/* Navn, varmekapasitet og status på et skilt foran på benken */}
      <LabelCard
        x={cx}
        y={benchY + 12 * f}
        lines={[
          { text: `${mat.name}, ${fmt(m, 2)} kg`, size: 0.95, weight: 760, color },
          { text: `c = ${fmt(mat.c, 0)} J/(kg·K)`, size: 0.8, muted: true },
          on && !state.boiling ? { text: status, size: 0.8, weight: 680, color: HEAT_COLOR } : { text: status, size: 0.8, weight: 650, muted: true },
        ]}
      />
    </g>
  );
}

interface CardLine {
  text: string;
  size: number;
  weight?: number;
  color?: string;
  muted?: boolean;
}

/** Skilt med noen linjer tekst (ren tekst, så bredden kan anslås). (x, y) er midt på overkanten. */
function LabelCard({ x, y, lines }: { x: number; y: number; lines: CardLine[] }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const pad = 9 * f;
  const heights = lines.map((l) => 17 * f * l.size * 1.32);
  const w = Math.max(...lines.map((l) => l.text.length * 17 * f * l.size * 0.56)) + 2 * pad + 6;
  const h = heights.reduce((a, b) => a + b, 0) + 1.3 * pad;
  let yy = y + pad * 0.65;
  return (
    <g>
      <rect x={x - w / 2} y={y} width={w} height={h} rx={7 * f} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1 * ss} opacity={0.95} />
      {lines.map((l, i) => {
        const lh = heights[i] ?? 0;
        yy += lh;
        return (
          <Txt key={i} x={x} y={yy - lh * 0.28} size={l.size} weight={l.weight} color={l.color} muted={l.muted} halo={false}>
            {l.text}
          </Txt>
        );
      })}
    </g>
  );
}
