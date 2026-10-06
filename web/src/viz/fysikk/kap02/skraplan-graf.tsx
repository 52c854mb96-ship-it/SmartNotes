/**
 * Grafen til «Kloss på skråplan»: G∥ = G · sin α, den største statiske friksjonen μs·N og friksjonen R som funksjon av
 * vinkelen. Til venstre for grensevinkelen ligger klossen i ro (R = G∥), til høyre glir den (R = μk·N), og avstanden
 * mellom G∥ og R er kraftsummen ΣF = ma.
 */
import { Dot, Figure, Plot, TSub, Txt, VIZ, fmt, linePath, sample, useTextScale } from '../../kit';
import { useNarrow } from './useNarrow';

const RAD = Math.PI / 180;

/** Pen øvre grense for kraftaksen. */
function niceMax(v: number): number {
  for (const c of [10, 20, 25, 40, 50, 60, 80, 100, 120]) if (c >= v) return c;
  return Math.ceil(v / 50) * 50;
}

export interface ForceGraphProps {
  /** Vinkelen nå (grader). */
  alpha: number;
  /** Tyngden G = mg (N). */
  G: number;
  /** Friksjonen som virker nå (N), og om klossen glir. */
  R: number;
  moving: boolean;
  muS: number;
  muK: number;
  /** Grensevinkelen (grader). */
  crit: number;
  /** Den største vinkelen på aksen. */
  alphaMax: number;
}

export function ForceGraph(props: ForceGraphProps) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const gh = narrow ? 560 : 380;
  const yMax = niceMax(props.G);
  return (
    <div ref={ref}>
      <Figure viewBox={`0 0 800 ${gh}`} label="Graf over G∥, største statiske friksjon og friksjonen R som funksjon av vinkelen α" maxHeight={400}>
        <Plot x={{ min: 0, max: props.alphaMax, label: 'Vinkel α (°)' }} y={{ min: 0, max: yMax, label: 'Kraft (N)' }} width={800} height={gh}>
          {(sc) => <GraphContent {...sc} {...props} yMax={yMax} />}
        </Plot>
      </Figure>
    </div>
  );
}

function GraphContent({
  sx,
  sy,
  x0,
  x1,
  y0,
  y1,
  alpha,
  G,
  R,
  moving,
  muS,
  muK,
  crit,
  alphaMax,
  yMax,
}: ForceGraphProps & {
  sx: (v: number) => number;
  sy: (v: number) => number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  yMax: number;
}) {
  const f = useTextScale();
  const mk = Math.min(muK, muS);
  const gPar = (a: number) => G * Math.sin(a * RAD);
  const sMax = (a: number) => muS * G * Math.cos(a * RAD);
  const kin = (a: number) => mk * G * Math.cos(a * RAD);
  const critShown = crit <= alphaMax;
  const cEnd = Math.min(crit, alphaMax);
  const cx = sx(cEnd);
  const restPart = sample(gPar, 0, cEnd, 80);
  const slidePart = critShown ? sample(kin, crit, alphaMax, 80) : [];
  const halo = { stroke: VIZ.surface, strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none', opacity: 0.9 };

  // Sonene: «Ligger i ro» til venstre for grensevinkelen, «Glir» til høyre (bare når det er plass til teksten).
  const zoneY = y1 + 17 * f;
  const fitsRest = cx - x0 > 100 * f;
  const fitsSlide = x1 - cx > 50 * f;
  // Etiketten for grensevinkelen står til venstre for linja når den får plass der, ellers til høyre (kort på mobil).
  const critText = f > 1.3 ? `${fmt(crit, 1)}°` : `grensevinkel ${fmt(crit, 1)}°`;
  const critW = critText.length * 9.4 * f;
  const critLeft = cx - 8 - critW > x0 + 4;
  // Kurveetikettene i høyre kant: R under friksjonskurven (over den helt nederst), G∥ under sin kurve når det er plass
  // mellom kurvene, ellers over.
  const gParEnd = gPar(alphaMax);
  const kinEnd = kin(alphaMax);
  const lh = 22 * f;
  const rBelow = sy(kinEnd) + 26 * f < y0 - 4;
  const rY = rBelow ? sy(kinEnd) + 26 * f : sy(kinEnd) - 10;
  const gBelow = sy(gParEnd) + 26 * f;
  const gRoom = critShown ? Math.min(sy(kinEnd) - 8, rBelow ? Infinity : rY - lh) : y0 - 4;
  const gY = gBelow < gRoom ? gBelow : sy(gParEnd) - 10;

  // Tilstanden nå
  const px = sx(alpha);
  const gNow = gPar(alpha);
  const showSum = moving && gNow - R > yMax * 0.06;
  return (
    <g>
      {critShown && crit >= 0.5 && (
        <>
          <line x1={cx} y1={y1} x2={cx} y2={y0} stroke={VIZ.muted} strokeWidth={1.4} strokeDasharray="5 5" opacity={0.75} />
          <Txt x={critLeft ? cx - 8 : cx + 8} y={y1 + 42 * f} anchor={critLeft ? 'end' : 'start'} size={0.85} muted weight={600}>
            {critText}
          </Txt>
        </>
      )}
      {fitsRest && (
        <Txt x={(x0 + cx) / 2} y={zoneY} size={0.85} muted weight={650}>
          Ligger i ro
        </Txt>
      )}
      {critShown && fitsSlide && (
        <Txt x={(cx + x1) / 2} y={zoneY} size={0.85} muted weight={650}>
          Glir
        </Txt>
      )}

      {/* Største statiske friksjon μs·N (stiplet) */}
      <path d={linePath(sample(sMax, 0, alphaMax, 120), sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={2.2} strokeDasharray="7 6" opacity={0.85} />
      {/* G∥ = G · sin α */}
      <path d={linePath(sample(gPar, 0, alphaMax, 120), sx, sy)} {...halo} />
      <path d={linePath(sample(gPar, 0, alphaMax, 120), sx, sy)} fill="none" stroke={VIZ.gravity} strokeWidth={2.8} />
      {/* Friksjonen R: like stor som G∥ i ro (tegnet tykt under G∥), så μk·N når klossen glir */}
      <path d={linePath(restPart, sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path d={linePath(restPart, sx, sy)} fill="none" stroke={VIZ.gravity} strokeWidth={2.2} />
      {critShown && (
        <>
          <line x1={cx} y1={sy(gPar(cEnd))} x2={cx} y2={sy(kin(cEnd))} stroke={VIZ.friction} strokeWidth={2} strokeDasharray="3 4" />
          <path d={linePath(slidePart, sx, sy)} {...halo} />
          <path d={linePath(slidePart, sx, sy)} fill="none" stroke={VIZ.friction} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      <Txt x={x1 - 4} y={gY} anchor="end" color={VIZ.gravity} weight={700}>
        G<TSub>∥</TSub>
      </Txt>
      {critShown && (
        <Txt x={x1 - 4} y={rY} anchor="end" color={VIZ.friction} weight={700}>
          R = μ<TSub>k</TSub>N
        </Txt>
      )}
      {muS > 0.04 && (
        <Txt x={sx(1.2)} y={muS > 0.3 ? sy(sMax(1.2)) + 26 * f : sy(sMax(1.2)) - 11} anchor="start" color={VIZ.friction} weight={700}>
          μ<TSub>s</TSub>N
        </Txt>
      )}

      {/* Tilstanden nå: hjelpelinje ned til vinkelaksen, R (fylt prikk), og kraftsummen G∥ − R når klossen glir */}
      <line x1={px} y1={sy(Math.max(gNow, R))} x2={px} y2={y0} stroke={VIZ.ink} strokeWidth={1.2} strokeDasharray="3 4" opacity={0.55} />
      {showSum && (
        <g>
          <line x1={px + 12} y1={sy(gNow)} x2={px + 12} y2={sy(R)} stroke={VIZ.ink} strokeWidth={1.6} />
          <line x1={px + 7} y1={sy(gNow)} x2={px + 17} y2={sy(gNow)} stroke={VIZ.ink} strokeWidth={1.6} />
          <line x1={px + 7} y1={sy(R)} x2={px + 17} y2={sy(R)} stroke={VIZ.ink} strokeWidth={1.6} />
          <Txt x={px + 22} y={(sy(gNow) + sy(R)) / 2 + 6} anchor="start" size={0.9} weight={700}>
            ΣF = ma
          </Txt>
          <circle cx={px} cy={sy(gNow)} r={9} fill={VIZ.surface} opacity={0.9} />
          <Dot x={px} y={sy(gNow)} r={6} color={VIZ.gravity} />
        </g>
      )}
      <circle cx={px} cy={sy(R)} r={11} fill={VIZ.surface} opacity={0.9} />
      <Dot x={px} y={sy(R)} r={7.5} color={VIZ.ink} />
    </g>
  );
}
