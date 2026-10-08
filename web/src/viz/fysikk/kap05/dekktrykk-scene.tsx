/**
 * Scenen til «Dekktrykk om vinteren»: en garasje i snitt med varmt lys til venstre og en snødekt innkjørsel en kald
 * vinterdag til høyre. Bilen fylles i garasjen og ruller ut, og lupa viser dekktrykkmåleren på ventilen til
 * forhjulet. Termometrene og skiltene langs underkanten viser temperaturen i garasjen, ute og i lufta i dekket.
 * Alle lengder i én skala (PX_PER_M): bilen er 4,4 m og garasjen 6,5 m.
 */
import { useMemo } from 'react';
import { Figure, VIZ, fmt, useTextScale } from '../../kit';
import { BIL_MAAL, Bil, Gran, Himmel, Landskap, Termometer, Underlag, ValueTag, hjulvinkelFraStrekning } from '../../kit/scene';
import { DEKK } from './model-dekktrykk';
import { Dekkmaaler, Garasje, Kompressor, Utetermometer, useNarrow, type GarasjeGeo } from './dekktrykk-deler';

const W = 800;
/** Piksler per meter for alle lengder i scenen. */
const PX_PER_M = 55;
const CAR_SIZE = BIL_MAAL.lengde * PX_PER_M;
const WHEEL_DX = (BIL_MAAL.akselavstand / 2) * PX_PER_M;
const WHEEL_R = BIL_MAAL.hjulradius * PX_PER_M;
/** Garasjen (ytterkanten av veggene). */
const GX0 = 14;
const GX1 = 372;
/** Ankerpunktet til bilen (midt mellom hjulene) inne i garasjen og parkert ute. */
const CAR_IN = 222;
const CAR_OUT = 600;
/** Utetermometeret står mellom garasjen og bilen. */
const OUT_X = 440;

interface Geo {
  H: number;
  ground: number;
  horizon: number;
  lupe: { cx: number; cy: number; r: number };
  sun: { x: number; y: number; r: number };
}

/** PC: bred scene. Mobil: høyere himmel, så lupa med måleren kan bli stor nok til å leses. */
const WIDE: Geo = { H: 400, ground: 330, horizon: 252, lupe: { cx: 692, cy: 118, r: 92 }, sun: { x: 540, y: 196, r: 13 } };
const NARROW: Geo = { H: 620, ground: 540, horizon: 462, lupe: { cx: 594, cy: 212, r: 192 }, sun: { x: 110, y: 120, r: 18 } };

export interface DekktrykkSceneProps {
  /** Temperaturen i garasjen, ute og i lufta i dekket nå (°C). */
  tGarage: number;
  tOutside: number;
  tTyre: number;
  /** Det måleren viser nå og det dekket ble fylt til (bar). */
  gauge: number;
  filled: number;
  drive: number;
  label: string;
}

export function DekktrykkScene(props: DekktrykkSceneProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const geo = narrow ? NARROW : WIDE;
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 ${W} ${geo.H}`} label={props.label} maxHeight={narrow ? 620 : 440}>
        <SceneContent {...props} geo={geo} />
      </Figure>
    </div>
  );
}

function Background({ geo }: { geo: Geo }) {
  return useMemo(() => {
    const g: GarasjeGeo = { x0: GX0, x1: GX1, ground: geo.ground, px: PX_PER_M, bottom: geo.H };
    return (
      <g>
        <Himmel w={W} h={geo.horizon + 2} sol={geo.sun} skyer={2} seed={7} />
        <Landskap x={0} y={geo.horizon} w={W} h={70} type="skog" seed={3} />
        <Underlag x1={0} x2={W} y={geo.ground} depth={geo.H - geo.ground} type="sno" horisont={geo.horizon} seed={5} />
        <Gran x={528} y={geo.horizon + 22} size={92} sno seed={2} />
        <Gran x={566} y={geo.horizon + 14} size={66} sno seed={4} />
        <Garasje {...g} />
      </g>
    );
  }, [geo]);
}

function SceneContent({ tGarage, tOutside, tTyre, gauge, filled, drive, geo }: DekktrykkSceneProps & { geo: Geo }) {
  const f = useTextScale();
  const { ground } = geo;
  const carX = CAR_IN + (CAR_OUT - CAR_IN) * drive;
  const dist = (carX - CAR_IN) / PX_PER_M;
  const wheel = { x: carX + WHEEL_DX, y: ground - WHEEL_R, r: WHEEL_R * 0.62 };
  const tagY = ground + Math.min(0.5 * (geo.H - ground), 30 + 6 * f);
  const inThermo = { x: GX0 + 0.22 * PX_PER_M + 0.5 * PX_PER_M, bulb: ground - 0.78 * PX_PER_M, h: 1.25 * PX_PER_M };
  // Skiltene står under det de hører til, men skyves til siden så de aldri overlapper (kortere tekst på mobil)
  const compact = f > 1.3;
  const tagSize = compact ? 0.8 : 0.85;
  const tagW = (text: string) => text.length * 17 * f * tagSize * 0.6 + 16 * f;
  const garageText = compact ? `Garasjen ${fmt(tGarage, 0)} °C` : `I garasjen: ${fmt(tGarage, 0)} °C`;
  const outText = compact ? `Ute ${fmt(tOutside, 0)} °C` : `Ute: ${fmt(tOutside, 0)} °C`;
  const tyreT = fmt(tTyre, Math.abs(tTyre - Math.round(tTyre)) < 0.05 ? 0 : 1);
  const tyreText = compact ? `Dekket ${tyreT} °C` : `I dekket: ${tyreT} °C`;
  const outL = OUT_X - tagW(outText) / 2;
  const outR = OUT_X + tagW(outText) / 2;
  const garageTagX = Math.max(4 + tagW(garageText) / 2, Math.min((GX0 + GX1) / 2, outL - 8 - tagW(garageText) / 2));
  const tyreTagX = Math.min(W - 4 - tagW(tyreText) / 2, Math.max(wheel.x, outR + 8 + tagW(tyreText) / 2));
  return (
    <g>
      <Background geo={geo} />

      {/* Inne i garasjen: kompressor og termometer på veggen */}
      <Kompressor x={inThermo.x} y={ground} size={0.62 * PX_PER_M} />
      <Termometer x={inThermo.x} y={inThermo.bulb} h={inThermo.h} temp={tGarage} min={-30} max={40} skala="ingen" />

      {/* Utetermometeret på stolpen */}
      <Utetermometer x={OUT_X} ground={ground - 4} bulb={ground - 0.62 * PX_PER_M} h={2.0 * PX_PER_M} temp={tOutside} />

      <Bil x={carX} y={ground} size={CAR_SIZE} lakk="blaa" hjulvinkel={hjulvinkelFraStrekning(dist)} bremselys={drive > 0 && drive < 1} />

      {/* Lupa med dekktrykkmåleren på ventilen til forhjulet */}
      <Dekkmaaler cx={geo.lupe.cx} cy={geo.lupe.cy} r={geo.lupe.r} value={gauge} filled={filled} max={DEKK.gaugeMax} target={wheel} />

      {/* Temperaturene langs underkanten, rett under det de hører til */}
      <ValueTag x={garageTagX} y={tagY} text={garageText} color={VIZ.series[1]} size={tagSize} />
      <ValueTag x={OUT_X} y={tagY} text={outText} color={VIZ.series[0]} size={tagSize} />
      {drive >= 0.6 && <ValueTag x={tyreTagX} y={tagY} text={tyreText} color={VIZ.ink} size={tagSize} />}
    </g>
  );
}
