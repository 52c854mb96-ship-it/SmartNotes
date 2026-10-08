/**
 * Scenen i karbon-14-dateringen (k8-c14): en labbenk med prøven og C-14-måleren, og en lupe som viser 100 av
 * C-14-atomene i prøven. Atomene henfaller ett og ett (til N-14) i en fast, tilfeldig rekkefølge når andelen går ned.
 * På mobil står lupa over benken, så både atomene og gjenstandene blir store nok.
 */
import { useMemo } from 'react';
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { RadialGradient, Rom, Underlag, shade, sphereStops, useSceneScale, useStrokeScale, useSvgId } from '../../kit/scene';
import {
  BeinIPetriskal,
  C14Maaler,
  FossiltBein,
  Lupe,
  Planke,
  Proveglass,
  Stottann,
  TrekullIPetriskal,
  beinSpot,
  fossilSpot,
  plankeSpot,
  proveglassSpot,
  stottannSpot,
  trekullSpot,
  type ZoomSpot,
} from './c14-deler';
import { LUPE_ATOMS, decayRanks, lupePositions, remainingOf, type SampleId } from './model-c14';

export const SCENE_W = 800;

/** Korte navn under prøven på benken. */
export const SHORT_NAMES: Record<SampleId | 'egen', string> = {
  vikingskip: 'Eikeplanke fra vikingskip',
  otzi: 'Bein fra Ötzi',
  ildsted: 'Trekull fra ildsted',
  mammut: 'Støttann fra mammut',
  dinosaur: 'Fossilt dinosaurbein',
  egen: 'Ukjent prøve',
};

interface Layout {
  h: number;
  benchY: number;
  horizon: number;
  meter: { x: number; w: number };
  sample: { x: number; k: number };
  lupe: { cx: number; cy: number; R: number; atomR: number; captionY: number };
  labelY: number;
  /** Vindu i veggen (bare på PC, der det er plass). */
  window: number | null;
  /** Forklaring av atomfargene: øverste venstre punkt. */
  key: { x: number; y: number; short: boolean };
}

/** Plasseringen av alt i scenen. På mobil (`narrow`) står lupa over benken. */
export function c14Layout(narrow: boolean): Layout {
  if (narrow) {
    return {
      h: 740,
      benchY: 600,
      horizon: 528,
      meter: { x: 175, w: 250 },
      sample: { x: 565, k: 1.45 },
      lupe: { cx: 400, cy: 262, R: 178, atomR: 11, captionY: 50 },
      labelY: 676,
      window: null,
      key: { x: 36, y: 118, short: true },
    };
  }
  return {
    h: 380,
    benchY: 300,
    horizon: 236,
    meter: { x: 128, w: 172 },
    sample: { x: 365, k: 1 },
    lupe: { cx: 636, cy: 182, R: 132, atomR: 7.6, captionY: 30 },
    labelY: 342,
    window: 128,
    key: { x: 312, y: 66, short: false },
  };
}

/** Prøven på benken og punktet lupa forstørrer. */
function sampleObject(id: SampleId | null, x: number, y: number, k: number): { node: React.ReactNode; spot: ZoomSpot; spotX: number; spotY: number } {
  const at = (spot: ZoomSpot) => ({ spot, spotX: x + spot.dx, spotY: y + spot.dy });
  switch (id) {
    case 'vikingskip': {
      const size = 250 * k;
      return { node: <Planke x={x} y={y} size={size} />, ...at(plankeSpot(size)) };
    }
    case 'otzi': {
      const size = 190 * k;
      return { node: <BeinIPetriskal x={x} y={y} size={size} />, ...at(beinSpot(size)) };
    }
    case 'ildsted': {
      const size = 190 * k;
      return { node: <TrekullIPetriskal x={x} y={y} size={size} />, ...at(trekullSpot(size)) };
    }
    case 'mammut': {
      const size = 270 * k;
      return { node: <Stottann x={x} y={y} size={size} />, ...at(stottannSpot(size)) };
    }
    case 'dinosaur': {
      const size = 250 * k;
      return { node: <FossiltBein x={x} y={y} size={size} />, ...at(fossilSpot(size)) };
    }
    default: {
      const size = 92 * k;
      return { node: <Proveglass x={x} y={y} size={size} />, ...at(proveglassSpot(size)) };
    }
  }
}

export function C14Scene({ sample, p, narrow, measuring }: { sample: SampleId | null; p: number; narrow: boolean; measuring: boolean }) {
  const L = c14Layout(narrow);
  const s = useSceneScale();
  const positions = useMemo(() => lupePositions(LUPE_ATOMS), []);
  const ranks = useMemo(() => decayRanks(LUPE_ATOMS), []);
  const left = remainingOf(LUPE_ATOMS, p);
  const atoms = positions.map((q, i) => ({ ...q, c14: (ranks[i] ?? 0) < left }));
  const objY = L.benchY - 4;
  const obj = sampleObject(sample, L.sample.x, objY, L.sample.k);
  const pctText = `${fmt(p * 100, 1)} %`;
  const atomR = L.lupe.atomR * Math.max(1, s / 1.5);

  return (
    <g>
      <Rom x={0} y={0} w={SCENE_W} h={L.h} gulvY={L.h - 10} gulv="betong" vindu={L.window !== null} vinduX={L.window ?? undefined} />
      <Underlag x1={-10} x2={SCENE_W + 10} y={L.benchY} depth={L.h - L.benchY + 4} type="labbenk" horisont={L.horizon} />
      <C14Maaler x={L.meter.x} y={L.benchY - 8} w={L.meter.w} label="C-14 igjen" value={pctText} measuring={measuring} />
      {obj.node}
      <Lupe cx={L.lupe.cx} cy={L.lupe.cy} R={L.lupe.R} spot={{ x: obj.spotX, y: obj.spotY, r: obj.spot.r }} atoms={atoms} atomR={atomR} />
      <AtomKey x={L.key.x} y={L.key.y} r={atomR} short={L.key.short} />
      <Txt x={L.lupe.cx} y={L.lupe.captionY} weight={700}>
        {left} av {LUPE_ATOMS} C-14-atomer igjen
      </Txt>
      <Txt x={L.meter.x} y={L.labelY} size={0.85} weight={600}>
        C-14-måler
      </Txt>
      <Txt x={L.sample.x} y={L.labelY} size={0.85} weight={600}>
        {SHORT_NAMES[sample ?? 'egen']}
      </Txt>
    </g>
  );
}

/** Forklaring av atomfargene i lupa: C-14 og N-14 (henfalt). */
function AtomKey({ x, y, r, short }: { x: number; y: number; r: number; short: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const idC = useSvgId('c14-nokkel');
  const idN = useSvgId('n14-nokkel');
  const row = 30 * f;
  const rows: { id: string; color: string; text: string; dim: boolean }[] = [
    { id: idC, color: VIZ.series[1]!, text: 'C-14', dim: false },
    { id: idN, color: VIZ.muted, text: short ? 'N-14' : 'N-14 (henfalt)', dim: true },
  ];
  return (
    <g>
      <RadialGradient id={idC} fx={0.35} fy={0.35} stops={sphereStops(VIZ.series[1]!)} />
      <RadialGradient id={idN} fx={0.35} fy={0.35} stops={sphereStops(VIZ.muted)} />
      {rows.map((q, i) => (
        <g key={q.id}>
          <circle
            cx={x + r}
            cy={y + i * row}
            r={r}
            fill={`url(#${q.id})`}
            stroke={shade(q.color, 0.35)}
            strokeWidth={0.8 * ss}
            opacity={q.dim ? 0.55 : 1}
          />
          <Txt x={x + 2 * r + 8} y={y + i * row + 5.5 * f} anchor="start" size={0.85} weight={650}>
            {q.text}
          </Txt>
        </g>
      ))}
    </g>
  );
}
