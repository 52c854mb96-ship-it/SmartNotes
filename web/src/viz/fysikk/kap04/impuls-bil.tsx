/**
 * Scenen «bilkollisjon i 50 km/h» i visualiseringen «impuls»: en bil har kjørt rett inn i en fjellskjæring, og
 * fordøra er skåret bort (snittegning), så vi ser føreren, setet, rattet, bilbeltet og kollisjonsputa. Bilen og
 * føreren er tegnet i én skala (205 px/m: bilen er 4,4 m og føreren 1,75 m). Interiøret, veggen og snittet finnes
 * ikke i scene-kit-et, så de er laget lokalt i samme stil (toninger fra core, SCENE- og PAINTS-farger, kontur).
 * (Den egne visualiseringen «krasjtest» viser en kollisjonstest i en hall; her er det en vanlig vei.)
 */
import { memo, type ComponentProps, type ReactNode } from 'react';
import { Txt, VIZ, fmt } from '../../kit';
import {
  BIL_MAAL,
  Bil,
  Callout,
  ContactShadow,
  ForceArrow,
  Himmel,
  Landskap,
  LinearGradient,
  PAINTS,
  Person,
  RadialGradient,
  SCENE,
  ValueTag,
  Vei,
  materialStops,
  mix,
  personPunkter,
  shade,
  tint,
  useStrokeScale,
  useSvgId,
} from '../../kit/scene';
import { impactAt, type ImpactResult } from './model';

/** Piksler per meter (og per centimeter) i bilscenen. */
const K = 205;
const KC = K / 100;
export const CAR_W = 800;
export const CAR_H = 380;
const ROAD_Y = 352;
/** Forsiden av fjellveggen; støtfangeren ligger inntil. */
const WALL_X = 706;
/** Ankerpunktet til bilen (midt mellom hjulene). */
const AX = WALL_X - BIL_MAAL.foran * K;
/** Kraftpila: piksler per kilonewton. Fartspila: piksler per m/s. */
const F_PX_PER_KN = 1.7;
const V_PX_PER_MS = 6.5;

/** Et punkt i bilens koordinater (cm fra ankerpunktet, y opp er negativ) i figuren. */
const P = (x: number, y: number) => ({ x: AX + x * KC, y: ROAD_Y + y * KC });
const PS = (x: number, y: number) => {
  const p = P(x, y);
  return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
};

/** På mobil er figuren høyere, så navnet på sikringen og bremselengden får plass under veien. */
const NARROW_H = CAR_H + 70;

export function carViewBox(narrow: boolean): string {
  return `0 0 ${CAR_W} ${narrow ? NARROW_H : CAR_H}`;
}

export type RestraintId = 'ingen' | 'belte' | 'pute';

interface Posture {
  /** Hofteleddet i bilens koordinater (cm) og overkroppens helning (grader, positiv = forover). */
  hip: [number, number];
  rygg: number;
  nakke: number;
}

interface RestraintSpec {
  name: string;
  /** Holdningen når kraften starter (t = 0) og når føreren står stille (t = Δt). */
  from: Posture;
  to: Posture;
}

const DRIVING: Posture = { hip: [0, -52], rygg: -20, nakke: 14 };

export const RESTRAINTS: Record<RestraintId, RestraintSpec> = {
  // Uten belte fortsetter føreren i 50 km/h til brystet treffer rattet, og stopper når rattet og brystet presses sammen.
  // Hofta har glidd fram på setet, brystet ligger mot rattet og hodet mot frontruta.
  ingen: {
    name: 'Uten bilbelte: treffer rattet',
    from: { hip: [17, -55], rygg: -6, nakke: 12 },
    to: { hip: [22, -56], rygg: -2, nakke: 20 },
  },
  belte: {
    name: 'Med bilbelte',
    from: DRIVING,
    to: { hip: [4, -52], rygg: 10, nakke: 26 },
  },
  pute: {
    name: 'Bilbelte og kollisjonspute',
    from: DRIVING,
    to: { hip: [3, -52], rygg: 7, nakke: 8 },
  },
};

/** Sikringen som hører til en støttid (samme grenser som i forklaringen). */
export function restraintFor(dtMs: number): RestraintId {
  return dtMs < 30 ? 'ingen' : dtMs < 90 ? 'belte' : 'pute';
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Rattet: nav, radius og helning (grader fra loddrett, toppen mot føreren). */
const WHEEL = { hub: [44, -96] as [number, number], r: 19, tilt: 24 };
/** Grepet på rattet (der hendene holder) og pedalene. */
const GRIP: [number, number] = [37, -110];
const PEDAL: [number, number] = [86, -31];
const FOOTREST: [number, number] = [80, -28];

export interface CarSceneProps {
  r: ImpactResult;
  m: number;
  v0: number;
  dtMs: number;
  tMs: number;
  showForces: boolean;
  narrow: boolean;
}

type Feste = ComponentProps<typeof Person>['fest'];
type Pt = { x: number; y: number };

export function CarScene({ r, m, v0, dtMs, tMs, showForces, narrow }: CarSceneProps) {
  const rid = restraintFor(dtMs);
  const spec = RESTRAINTS[rid];
  const st = impactAt(m, v0, dtMs / 1000, tMs / 1000);
  // Holdningen følger hvor langt føreren har kommet i bremsingen (s/s_total).
  const k = r.stopDist > 0 ? Math.min(1, Math.max(0, st.s / r.stopDist)) : 0;
  const pose: Posture = {
    hip: [lerp(spec.from.hip[0], spec.to.hip[0], k), lerp(spec.from.hip[1], spec.to.hip[1], k)],
    rygg: lerp(spec.from.rygg, spec.to.rygg, k),
    nakke: lerp(spec.from.nakke, spec.to.nakke, k),
  };
  const size = 1.75 * K;
  const ledd = { rygg: pose.rygg, nakke: pose.nakke };
  // Ankerpunktet til Person (under setet) regnes ut fra der hofteleddet skal være.
  const rel = personPunkter('sitte', size, ledd, { x: 0, y: 0 }).hofte;
  const hip = P(pose.hip[0], pose.hip[1]);
  const ax = hip.x - rel.x;
  const ay = hip.y - rel.y;
  // Uten belte presses brystet mot rattet, og hendene glir ned på nedre del av rattkransen (så ansiktet synes).
  const grip: [number, number] = rid === 'ingen' ? [WHEEL.hub[0] + 8, WHEEL.hub[1] + 14] : GRIP;
  const fest: Feste = {
    hoyreHand: P(grip[0], grip[1]),
    venstreHand: P(grip[0] + 3, grip[1] + 3),
    hoyreFot: P(PEDAL[0], PEDAL[1]),
    venstreFot: P(FOOTREST[0], FOOTREST[1]),
  };
  const pp = personPunkter('sitte', size, ledd, { x: ax, y: ay, fest });
  const torso = torsoFrame(pp.hofte, pp.nakke);
  const chest = torso.at(0.62, 0);

  const fLen = (st.F / 1000) * F_PX_PER_KN;
  const vLen = st.v * V_PX_PER_MS;
  const belted = rid !== 'ingen';
  const airbag = rid === 'pute';

  // Klipp scenen til utsnittet, så ingenting tegnes utenfor når figuren er bredere enn tegningen.
  const clipId = useSvgId('impuls-utsnitt');
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={0} y={0} width={CAR_W} height={narrow ? NARROW_H : CAR_H} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <Bakgrunn h={narrow ? NARROW_H : CAR_H} />
        <Bil x={AX} y={ROAD_Y} size={BIL_MAAL.lengde * K} lakk="blaa" bremselys />
        <Kabin>
          <Interior />
          <Sete />
          {airbag && <Kollisjonspute press={k} />}
          <Person x={ax} y={ay} size={size} pose="sitte" ledd={ledd} fest={fest} jakke="rod" har="brun" skygge={false} />
          <Ratt />
          {belted && <Belte torso={torso} shoulder={pp.skulder} />}
        </Kabin>
        <Snittkant />
        <Fjellvegg />

        {st.v > 0.05 && (
          <>
            <ForceArrow
              x1={chest.x}
              y1={chest.y}
              x2={chest.x + vLen}
              y2={chest.y}
              color={VIZ.velocity}
              width={6}
              minLength={6}
              origin={!showForces || fLen < 6}
            />
            <ValueTag
              x={Math.max(chest.x + vLen + 30, P(62, 0).x)}
              y={chest.y}
              anchor="start"
              text={`v = ${fmt(st.v * 3.6, 0)} km/h`}
              color={VIZ.velocity}
              size={0.85}
            />
          </>
        )}
        {showForces && (
          <>
            <ForceArrow x1={chest.x} y1={chest.y} x2={chest.x - fLen} y2={chest.y} color={VIZ.applied} origin minLength={6} />
            {st.F > 50 && (
              <ValueTag
                x={Math.min(chest.x - fLen, chest.x - 40)}
                y={chest.y + 32}
                anchor="start"
                text={`F = ${fmt(st.F / 1000, st.F < 10000 ? 1 : 0)} kN`}
                color={VIZ.applied}
                size={0.85}
              />
            )}
          </>
        )}

        <Labels rid={rid} torso={torso} />
        {narrow ? (
          <>
            <ValueTag x={16} y={CAR_H + 32} anchor="start" text={spec.name} size={0.9} />
            <ValueTag x={CAR_W - 16} y={CAR_H + 32} anchor="end" text={`s = ${fmt(r.stopDist * 100, 0)} cm`} size={0.9} />
          </>
        ) : (
          <>
            <ValueTag x={CAR_W - 14} y={26} anchor="end" text={spec.name} size={0.9} />
            <Txt x={CAR_W - 16} y={58} anchor="end" size={0.85} muted>
              Føreren ({fmt(m, 0)} kg) stopper over s = {fmt(r.stopDist * 100, 0)} cm
            </Txt>
          </>
        )}
      </g>
    </g>
  );
}

/**
 * Koordinater langs overkroppen: `at(a, d)` er punktet en andel `a` fra hofta til nakken og `d` cm fram (mot brystet)
 * fra midtlinja. Brukes til beltet, pilene og etikettene.
 */
function torsoFrame(hofte: Pt, nakke: Pt) {
  const dx = nakke.x - hofte.x;
  const dy = nakke.y - hofte.y;
  const len = Math.hypot(dx, dy) || 1;
  const fx = -dy / len;
  const fy = dx / len;
  return {
    at: (a: number, d: number): Pt => ({
      x: hofte.x + dx * a + fx * d * KC,
      y: hofte.y + dy * a + fy * d * KC,
    }),
  };
}
type Torso = ReturnType<typeof torsoFrame>;

/** Etiketter med strek til rattet, beltet og puta, over panseret og på bakdøra. */
function Labels({ rid, torso }: { rid: RestraintId; torso: Torso }) {
  const rim = P(WHEEL.hub[0] + 6, WHEEL.hub[1] + WHEEL.r - 4);
  const belt = torso.at(0.8, 3);
  const bag = P(36, -120);
  const label = P(104, -118);
  return (
    <g>
      {rid === 'ingen' && (
        <Callout x={rim.x} y={rim.y} lx={label.x} ly={label.y} anchor="start">
          Rattet
        </Callout>
      )}
      {rid !== 'ingen' && (
        <Callout x={belt.x} y={belt.y} lx={P(-58, -122).x} ly={P(-58, -122).y} anchor="end">
          Bilbelte
        </Callout>
      )}
      {rid === 'pute' && (
        <Callout x={bag.x} y={bag.y} lx={label.x} ly={label.y} anchor="start">
          Kollisjonspute
        </Callout>
      )}
    </g>
  );
}

/* ---------- Bakgrunn og vegg ---------- */

const Bakgrunn = memo(function Bakgrunn({ h }: { h: number }) {
  return (
    <g aria-hidden>
      <Himmel w={CAR_W} h={ROAD_Y} />
      <Landskap x={0} y={ROAD_Y - 30} w={CAR_W} h={120} type="aaser" seed={3} />
      <Vei x1={0} x2={CAR_W} y={ROAD_Y} horisont={ROAD_Y - 30} depth={h - ROAD_Y} />
    </g>
  );
});

/**
 * Fjellskjæring ved veien: grå fjellflate med sprekker, skifrige lag og de loddrette sporene etter borehullene fra
 * sprengningen (typisk for norske veier). Bilen har kjørt rett inn i den.
 */
const Fjellvegg = memo(function Fjellvegg() {
  const id = useSvgId('impuls-fjell');
  const ss = useStrokeScale();
  const x0 = WALL_X;
  // Fjellflaten er nesten loddrett og litt ujevn; toppen skrår oppover bort fra veien og har gress og lyng.
  const face: [number, number][] = [
    [x0 - 2, ROAD_Y + 6],
    [x0, ROAD_Y - 60],
    [x0 + 5, ROAD_Y - 130],
    [x0 + 2, ROAD_Y - 190],
    [x0 + 9, ROAD_Y - 236],
  ];
  const ridge: [number, number][] = [
    [x0 + 9, ROAD_Y - 236],
    [x0 + 30, ROAD_Y - 252],
    [x0 + 58, ROAD_Y - 262],
    [x0 + 86, ROAD_Y - 280],
    [CAR_W + 4, ROAD_Y - 292],
  ];
  const outline = [...face, ...ridge.slice(1)];
  const d = `M${outline.map(([x, y]) => `${x},${y}`).join(' L')} L${CAR_W + 4},${ROAD_Y + 6} Z`;
  const grass = `M${ridge.map(([x, y]) => `${x},${y}`).join(' L')} L${CAR_W + 4},${ROAD_Y - 280} L${x0 + 86},${ROAD_Y - 268} L${x0 + 58},${ROAD_Y - 251} L${x0 + 30},${ROAD_Y - 242} Z`;
  const hit = P(222, -55);
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, tint(SCENE.stone, 0.2)],
          [0.3, SCENE.stone],
          [1, shade(SCENE.stone, 0.2)],
        ]}
      />
      <path d={d} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={1 * ss} strokeLinejoin="round" />
      {/* Flater i fjellet (skygge der flaten vender bort fra lyset) */}
      <g fill={SCENE.stoneDark} opacity={0.32}>
        <path d={`M${x0 + 5},${ROAD_Y - 130} L${x0 + 40},${ROAD_Y - 168} L${x0 + 34},${ROAD_Y - 112} Z`} />
        <path d={`M${x0 + 2},${ROAD_Y - 190} L${x0 + 46},${ROAD_Y - 226} L${x0 + 58},${ROAD_Y - 180} L${x0 + 8},${ROAD_Y - 160} Z`} />
        <path d={`M${x0 + 2},${ROAD_Y - 40} L${x0 + 30},${ROAD_Y - 76} L${x0 + 62},${ROAD_Y - 34} L${x0 + 26},${ROAD_Y - 6} Z`} />
      </g>
      {/* Skifrige lag (svakt skrå) og sprekker */}
      <g stroke={SCENE.stoneDark} strokeWidth={1.1 * ss} fill="none" opacity={0.7} strokeLinecap="round">
        <path
          d={`M${x0 + 6},${ROAD_Y - 96} l70,-12 M${x0 + 3},${ROAD_Y - 182} l80,-12 M${x0 + 8},${ROAD_Y - 22} l40,-5 M${x0 + 50},${ROAD_Y - 132} l44,-8`}
        />
        <path d={`M${x0 + 40},${ROAD_Y - 100} l6,-36 l-4,-22 M${x0 + 70},${ROAD_Y - 196} l8,40 l-3,26`} />
      </g>
      {/* Sporene etter borehullene fra sprengningen: loddrette renner med lys kant */}
      {[x0 + 24, x0 + 52, x0 + 80].map((x, i) => (
        <g key={x}>
          <line
            x1={x}
            y1={ROAD_Y - 24 - i * 30}
            x2={x + 7}
            y2={ROAD_Y - 244 - i * 10}
            stroke={shade(SCENE.stone, 0.35)}
            strokeWidth={3 * ss}
            strokeLinecap="round"
            opacity={0.55}
          />
          <line
            x1={x + 2.5}
            y1={ROAD_Y - 24 - i * 30}
            x2={x + 9.5}
            y2={ROAD_Y - 244 - i * 10}
            stroke={SCENE.highlight}
            strokeWidth={1 * ss}
            opacity={0.6}
          />
        </g>
      ))}
      <path d={grass} fill={SCENE.grassDark} stroke={SCENE.outline} strokeWidth={0.6 * ss} strokeLinejoin="round" />
      <g stroke={SCENE.grass} strokeWidth={1.4 * ss} strokeLinecap="round">
        {[0.08, 0.2, 0.34, 0.5, 0.66, 0.8, 0.92].map((f) => {
          const x = x0 + 12 + f * (CAR_W - x0 - 12);
          const y = ROAD_Y - 238 - f * 52;
          return <path key={f} d={`M${x},${y} l-3,-7 M${x + 4},${y} l2,-8`} />;
        })}
      </g>
      {/* Sprekker der støtfangeren traff */}
      <path
        d={`M${hit.x + 2},${hit.y - 6} l12,-12 l10,-16 M${hit.x + 2},${hit.y + 4} l18,4 l14,-8 M${hit.x + 2},${hit.y + 14} l10,16 l12,6`}
        fill="none"
        stroke={shade(SCENE.stone, 0.5)}
        strokeWidth={1.3 * ss}
        strokeLinejoin="round"
      />
      <ContactShadow cx={x0 + 40} cy={ROAD_Y + 4} rx={60} ry={5} />
    </g>
  );
});

/* ---------- Kabinen (snittet gjennom fordøra og frontruta) ---------- */

/** Fordøra, sideruta og frontruta, der bilen er «skåret opp» (bilens koordinater i cm). */
const CUT = `M${PS(-27, -25)} L${PS(-29, -145)} L${PS(-4, -147)} C${PS(22, -140)} ${PS(46, -114)} ${PS(70, -97)} L${PS(72, -97)} C${PS(86, -82)} ${PS(94, -62)} ${PS(95, -27)} Z`;

function Kabin({ children }: { children: ReactNode }) {
  const id = useSvgId('impuls-kabin');
  return (
    <g>
      <clipPath id={id}>
        <path d={CUT} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
}

/** Innsiden av bilen: den andre døra og ruta, dashbordet, frontruta, gulvet og pedalene. */
const Interior = memo(function Interior() {
  const id = useSvgId('impuls-interior');
  const ss = useStrokeScale();
  const trim = mix(PAINTS.graa, PAINTS.hvit, 0.35);
  const dark = mix(PAINTS.svart, PAINTS.graa, 0.3);
  const a = P(-40, -160);
  const b = P(110, -10);
  return (
    <g>
      <LinearGradient id={`${id}b`} stops={materialStops(trim, 0.7)} />
      <rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y} fill={`url(#${id}b)`} />
      {/* Taket innvendig og ruta på den andre siden (himmel) */}
      <rect x={a.x} y={a.y} width={b.x - a.x} height={20 * KC} fill={shade(trim, 0.12)} />
      <LinearGradient
        id={`${id}g`}
        stops={[
          [0, tint(SCENE.skyTop, 0.15)],
          [1, SCENE.skyBottom],
        ]}
      />
      <path
        d={`M${PS(-25, -102)} L${PS(-25, -137)} L${PS(-2, -136)} C${PS(18, -131)} ${PS(36, -116)} ${PS(52, -102)} Z`}
        fill={`url(#${id}g)`}
      />
      <path d={`M${PS(-25, -102)} L${PS(56, -102)}`} stroke={shade(trim, 0.35)} strokeWidth={3 * ss} />
      {/* Dørtrekket på den andre døra med armlene */}
      <path d={`M${PS(-30, -100)} L${PS(58, -100)} L${PS(78, -40)} L${PS(-30, -40)} Z`} fill={shade(trim, 0.08)} />
      <path d={`M${PS(-12, -70)} L${PS(36, -70)}`} stroke={shade(trim, 0.3)} strokeWidth={5 * ss} strokeLinecap="round" />
      {/* Dashbord */}
      <LinearGradient id={`${id}d`} stops={materialStops(dark, 0.9)} />
      <path
        d={`M${PS(50, -104)} C${PS(58, -105)} ${PS(68, -103)} ${PS(80, -100)} L${PS(110, -100)} L${PS(110, -30)} L${PS(88, -30)} C${PS(82, -48)} ${PS(72, -62)} ${PS(62, -74)} C${PS(55, -83)} ${PS(49, -94)} ${PS(50, -104)} Z`}
        fill={`url(#${id}d)`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      <path d={`M${PS(53, -102)} L${PS(76, -100)}`} stroke={SCENE.highlight} strokeWidth={1.2 * ss} />
      {/* Frontruta sett fra siden (glasset er skrått) */}
      <path
        d={`M${PS(-2, -145)} C${PS(22, -138)} ${PS(44, -113)} ${PS(66, -99)}`}
        fill="none"
        stroke={tint(SCENE.glassEdge, 0.2)}
        strokeWidth={2.4 * ss}
        opacity={0.8}
      />
      {/* Gulvet og pedalene */}
      <path d={`M${PS(-40, -27)} L${PS(110, -27)} L${PS(110, -10)} L${PS(-40, -10)} Z`} fill={dark} />
      <path
        d={`M${PS(76, -42)} L${PS(88, -34)} L${PS(90, -29)}`}
        fill="none"
        stroke={SCENE.metal}
        strokeWidth={2.6 * ss}
        strokeLinecap="round"
      />
    </g>
  );
});

/** Førersetet: sitteputa, ryggen (lent bakover) og nakkestøtten. */
const Sete = memo(function Sete() {
  const id = useSvgId('impuls-sete');
  const ss = useStrokeScale();
  const fabric = mix(PAINTS.svart, PAINTS.graa, 0.5);
  const head = P(-38, -132);
  return (
    <g>
      <LinearGradient
        id={id}
        x2={1}
        y2={0}
        stops={[
          [0, shade(fabric, 0.2)],
          [0.5, fabric],
          [1, tint(fabric, 0.14)],
        ]}
      />
      {/* Nakkestøtten på to stenger */}
      <path d={`M${PS(-37, -114)} L${PS(-39, -124)} M${PS(-31, -114)} L${PS(-33, -124)}`} stroke={SCENE.metal} strokeWidth={2 * ss} />
      <rect
        x={head.x - 7 * KC}
        y={head.y - 9 * KC}
        width={14 * KC}
        height={18 * KC}
        rx={5 * KC}
        transform={`rotate(-14 ${head.x} ${head.y})`}
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
      />
      {/* Ryggen */}
      <path
        d={`M${PS(-30, -40)} L${PS(-46, -110)} C${PS(-47, -117)} ${PS(-42, -120)} ${PS(-36, -119)} L${PS(-28, -117)} C${PS(-24, -100)} ${PS(-18, -72)} ${PS(-12, -46)} Z`}
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      {/* Sitteputa */}
      <path
        d={`M${PS(-30, -30)} L${PS(-31, -43)} C${PS(-20, -48)} ${PS(10, -49)} ${PS(25, -47)} C${PS(29, -46)} ${PS(29, -40)} ${PS(25, -37)} L${PS(21, -30)} Z`}
        fill={`url(#${id})`}
        stroke={SCENE.outline}
        strokeWidth={0.8 * ss}
        strokeLinejoin="round"
      />
      <path d={`M${PS(-12, -30)} L${PS(-10, -25)} M${PS(14, -30)} L${PS(16, -25)}`} stroke={SCENE.metalDark} strokeWidth={2.6 * ss} />
    </g>
  );
});

/** Rattet sett fra siden (en smal ellipse) på rattstammen. Tegnes over hendene, så de griper rundt det. */
const Ratt = memo(function Ratt() {
  const ss = useStrokeScale();
  const hub = P(WHEEL.hub[0], WHEEL.hub[1]);
  const col = P(68, -82);
  const rim = {
    cx: hub.x,
    cy: hub.y,
    rx: 4.5 * KC,
    ry: WHEEL.r * KC,
    transform: `rotate(${WHEEL.tilt} ${hub.x} ${hub.y})`,
  };
  return (
    <g>
      <line x1={col.x} y1={col.y} x2={hub.x} y2={hub.y} stroke={shade(PAINTS.svart, 0.1)} strokeWidth={6 * KC} strokeLinecap="round" />
      <ellipse {...rim} fill="none" stroke={SCENE.outline} strokeWidth={3.6 * KC + 1.6 * ss} />
      <ellipse {...rim} fill="none" stroke={SCENE.rubber} strokeWidth={3.6 * KC} />
      <ellipse {...rim} fill="none" stroke={SCENE.rubberLight} strokeWidth={1 * ss} opacity={0.8} />
      <circle cx={hub.x} cy={hub.y} r={5 * KC} fill={SCENE.rubberLight} stroke={SCENE.outline} strokeWidth={0.8 * ss} />
    </g>
  );
});

/** Kollisjonsputa fylt med gass foran rattet; den flates litt ut når føreren presses inn i den. */
function Kollisjonspute({ press }: { press: number }) {
  const id = useSvgId('impuls-kpute');
  const ss = useStrokeScale();
  const c = P(27 + 2 * press, -112);
  const rx = (15 - 3 * press) * KC;
  const ry = (27 + 2 * press) * KC;
  const cloth = mix(PAINTS.hvit, PAINTS.graa, 0.1);
  return (
    <g>
      <RadialGradient
        id={id}
        fx={0.35}
        fy={0.3}
        stops={[
          [0, tint(cloth, 0.5)],
          [0.6, cloth],
          [1, shade(cloth, 0.22)],
        ]}
      />
      <ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} fill={`url(#${id})`} stroke={SCENE.outline} strokeWidth={0.9 * ss} />
      <path
        d={`M${c.x - rx * 0.1},${c.y - ry * 0.75} q${rx * 0.35},${ry * 0.3} ${rx * 0.1},${ry * 0.62} M${c.x + rx * 0.3},${c.y + ry * 0.05} q${rx * 0.35},${ry * 0.25} ${rx * 0.1},${ry * 0.55}`}
        fill="none"
        stroke={shade(cloth, 0.3)}
        strokeWidth={1.1 * ss}
        opacity={0.7}
      />
    </g>
  );
}

/**
 * Trepunktsbeltet: fra festet i B-stolpen over den nære skulderen, ned foran brystet til låsen ved hofta, og
 * hoftebeltet bakover til festet ved setet.
 */
function Belte({ torso, shoulder }: { torso: Torso; shoulder: Pt }) {
  const ss = useStrokeScale();
  const anchor = P(-31, -124);
  // Over skulderen, så på skrå over brystet (sett fra siden) ned til låsen foran hofta.
  const over = { x: shoulder.x - 1 * KC, y: shoulder.y - 6 * KC };
  const mid = torso.at(0.5, 8);
  const buckle = torso.at(0.06, 12);
  const lapBack = P(-24, -46);
  const webbing = mix(PAINTS.svart, PAINTS.graa, 0.4);
  const d = `M${anchor.x},${anchor.y} L${over.x},${over.y} Q${mid.x},${mid.y} ${buckle.x},${buckle.y} L${lapBack.x},${lapBack.y}`;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} stroke={SCENE.outline} strokeWidth={4.6 * KC + 1.4 * ss} />
      <path d={d} stroke={webbing} strokeWidth={4.6 * KC} />
      <path d={d} stroke={SCENE.highlight} strokeWidth={0.9 * ss} opacity={0.55} transform="translate(-1 -1)" />
      <rect
        x={buckle.x - 4 * KC}
        y={buckle.y - 2.5 * KC}
        width={8 * KC}
        height={5 * KC}
        rx={1.5}
        fill={SCENE.metal}
        stroke={SCENE.outline}
        strokeWidth={0.7 * ss}
      />
    </g>
  );
}

/** Kanten av snittet: lakken har en tykkelse, så kanten tegnes med en mørk og en lys strek. */
function Snittkant() {
  const ss = useStrokeScale();
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={CUT} stroke={SCENE.outline} strokeWidth={3.6 * ss} />
      <path d={CUT} stroke={tint(PAINTS.blaa, 0.45)} strokeWidth={1.5 * ss} />
    </g>
  );
}
