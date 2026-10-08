/**
 * Figuren til «Halveringstid»: en prøve på labbenken med et geiger-müller-rør over seg og et telleapparat som klikker
 * for hvert henfall, og ved siden av (under på mobil) et forstørret utsnitt med 400 av kjernene i prøven. Strålingen
 * følger fysikken: β og γ går langt i luft, α stopper etter noen centimeter (og inne i glasset med kjellerluft).
 * Alt i én skala P (px/m).
 */
import { useMemo } from 'react';
import { Txt, VIZ, fmt } from '../../kit';
import { Atomkjerne, Callout, Elektron, Foton, RadialGradient, Rom, SCENE, Underlag, alpha, shade, sphereStops, useStrokeScale, useSvgId } from '../../kit/scene';
import { nuclideText } from '../kap07/elements';
import { COUNTER, GM, GmRor, Klemme, Lydbuer, SAMPLE_GEOM, Sample, Stativ, Telleapparat, Varselskilt, type SampleType } from './halveringstid-deler';
import type { HalfLifePreset } from './model';
import { ALPHA_RANGE_AIR, anyAngle, decayedCount, freshDecays, trackLength, upwardAngle, type EmissionDraw } from './model-halveringstid';

export const W = 800;
/** Avstanden fra toppen av prøven til vinduet på røret (m). */
const GAP = 0.015;

export const MOTHER = VIZ.series[1]!;
export const DAUGHTER = VIZ.muted;
/** Stråling og kjerner som akkurat har henfalt. */
export const FRESH = VIZ.series[4]!;

type Radiation = 'alfa' | 'alfa-inne' | 'beta' | 'gamma';

/** Prøven til hvert stoff, med navnet i figuren og strålingen som kommer ut av den. */
export const SAMPLES: Record<string, { type: SampleType; name: string; rad: Radiation }> = {
  c14: { type: 'trekull', name: 'Trekull fra et ildsted', rad: 'beta' },
  i131: { type: 'medisinglass', name: 'Medisin med jod-131', rad: 'gamma' },
  rn222: { type: 'glass', name: 'Kjellerluft med radon', rad: 'alfa-inne' },
  co60: { type: 'blybeholder', name: 'Strålekilde med kobolt-60', rad: 'gamma' },
  u238: { type: 'skifer', name: 'Alunskifer med uran', rad: 'alfa' },
};

export function sampleFor(p: HalfLifePreset) {
  return SAMPLES[p.id] ?? SAMPLES.c14!;
}

export interface HlLayout {
  narrow: boolean;
  f: number;
  H: number;
  P: number;
  benchY: number;
  sceneBottom: number;
  counterX: number;
  rodX: number;
  tubeX: number;
  /** Høyre kant for strålingen i scenen (panelet ligger til høyre på PC). */
  sceneRight: number;
  panel: {
    x: number;
    y: number;
    w: number;
    h: number;
    cols: number;
    cell: number;
    gridX: number;
    gridY: number;
    titleY: number;
    captionY: number;
    stripY: number;
  };
}

/** Plassen til alt i figuren. PC: scenen til venstre og kjernene til høyre. Mobil: scenen øverst og kjernene under. */
export function hlLayout(narrow: boolean, f: number, n: number): HlLayout {
  const P = narrow ? 1700 : 1000;
  const x0 = narrow ? 20 : 14;
  const benchY = narrow ? Math.round(36 + 0.245 * P) : 330;
  const sceneBottom = narrow ? benchY + 48 : 0;
  const px = narrow ? 20 : 452;
  const py = narrow ? sceneBottom + 18 : 12;
  const pw = narrow ? 760 : 336;
  const cols = narrow ? 25 : 20;
  const rows = Math.ceil(n / cols);
  const cell = narrow ? (pw - 28) / cols : 14;
  const titleY = py + 10 + 15 * f;
  const captionY = titleY + 6 + 13 * f;
  const stripY = captionY + 12 + 12 * f;
  const gridY = stripY + 12 + 9 * f;
  const ph = gridY - py + rows * cell + 14;
  const H = Math.round(py + ph + (narrow ? 6 : 10));
  return {
    narrow,
    f,
    H,
    P,
    benchY,
    sceneBottom: narrow ? sceneBottom : H,
    counterX: x0 + 0.09 * P,
    rodX: x0 + 0.215 * P,
    tubeX: x0 + 0.345 * P,
    sceneRight: narrow ? W - 6 : px - 8,
    panel: { x: px, y: py, w: pw, h: ph, cols, cell, gridX: px + (pw - cols * cell) / 2, gridY, titleY, captionY, stripY },
  };
}

/** Sporet til strålingen fra én kjerne i figurens enheter: start, retning (y opp) og lengde. */
interface Track {
  x: number;
  y: number;
  ang: number;
  len: number;
}

function emissionTrack(rad: Radiation, type: SampleType, d: EmissionDraw, L: HlLayout): Track {
  const g = SAMPLE_GEOM[type];
  let ox = 0;
  let oy = 0;
  let ang = Math.PI / 2;
  let range = 0.09;
  const edge = 2 * Math.abs(d.u - 0.5);
  switch (rad) {
    case 'beta':
      ox = (d.u - 0.5) * 0.7 * g.w;
      oy = g.h * (0.95 - 0.3 * edge * edge);
      ang = upwardAngle(d.w, 80);
      range = 0.13;
      break;
    case 'alfa':
      ox = (d.u - 0.5) * 0.75 * g.w;
      oy = g.h * (0.97 - 0.1 * edge);
      ang = upwardAngle(d.w, 84);
      range = ALPHA_RANGE_AIR;
      break;
    case 'gamma':
      if (type === 'blybeholder') {
        // Blyet skjermer til sidene: γ-strålingen kommer bare ut gjennom åpningen på toppen
        ox = (d.u - 0.5) * 0.008;
        oy = 0.037;
        ang = upwardAngle(d.w, 36);
      } else {
        ox = (d.u - 0.5) * 0.55 * g.w;
        oy = g.h * (0.1 + 0.26 * d.v);
        ang = upwardAngle(d.w, 88);
      }
      range = 0.2;
      break;
    case 'alfa-inne': {
      const b = g.inner ?? { x0: -g.w / 2, y0: 0, x1: g.w / 2, y1: g.h };
      ox = b.x0 + d.u * (b.x1 - b.x0);
      oy = b.y0 + d.v * (b.y1 - b.y0);
      ang = anyAngle(d.w);
      range = trackLength(ox, oy, ang, ALPHA_RANGE_AIR, b);
      break;
    }
  }
  // α og β som treffer vinduet på røret, stopper der (de blir registrert)
  if (rad === 'alfa' || rad === 'beta') {
    const s = Math.sin(ang);
    if (s > 0) {
      const dw = (g.h + GAP - oy) / s;
      if (dw < range && Math.abs(ox + dw * Math.cos(ang)) <= GM.r) range = dw;
    }
  }
  const x = L.tubeX + ox * L.P;
  const y = L.benchY - oy * L.P;
  // Hold strålingen inne i scenen
  const len = trackLength(x, -y, ang, range * L.P, { x0: 6, y0: -(L.benchY - 1), x1: L.sceneRight, y1: -6 });
  return { x, y, ang, len };
}

/** Laboratoriescenen: rom, benk, telleapparat, stativ med geiger-müller-rør, prøven og strålingen. */
export function LabScene({
  L,
  p,
  times,
  draws,
  t,
  showRadiation,
}: {
  L: HlLayout;
  p: HalfLifePreset;
  times: number[];
  draws: EmissionDraw[];
  t: number;
  showRadiation: boolean;
}) {
  const ss = useStrokeScale();
  const { P, benchY, tubeX, counterX, rodX, f } = L;
  const sample = sampleFor(p);
  const g = SAMPLE_GEOM[sample.type];
  const windowY = benchY - (g.h + GAP) * P;
  const clampY = windowY - 0.06 * P;
  const capTop = windowY - (GM.len + GM.cap + GM.bnc) * P;
  const counterTop = benchY - COUNTER.h * P;
  const counterRight = counterX + (COUNTER.w / 2) * P;
  const fresh = freshDecays(times, t);
  const count = decayedCount(times, t);
  const newest = fresh.reduce((m, d) => Math.min(m, d.age), 1);
  const blink = fresh.length > 0 ? Math.max(0, 1 - newest / 0.45) : 0;

  const backdrop = useMemo(() => {
    const depth = L.sceneBottom - benchY;
    return (
      <>
        <Rom x={0} y={0} w={W} h={L.sceneBottom} gulvY={benchY + 0.8 * depth} gulv="betong" />
        <Underlag x1={0} x2={W} y={benchY} depth={depth} type="labbenk" />
      </>
    );
  }, [L.sceneBottom, benchY]);

  const hw = (g.w / 2) * P + 6;
  const sampleBox = { x0: tubeX - hw, y0: benchY - g.h * P - 6, x1: tubeX + hw, y1: benchY + 5 };
  const pan = L.panel;
  const wedge = L.narrow
    ? [
        [sampleBox.x0, sampleBox.y1, pan.x + 14, pan.y],
        [sampleBox.x1, sampleBox.y1, pan.x + pan.w - 14, pan.y],
      ]
    : [
        [sampleBox.x1, sampleBox.y0, pan.x, pan.y + 14],
        [sampleBox.x1, sampleBox.y1, pan.x, pan.y + pan.h - 14],
      ];
  const cableX = counterRight + 0.025 * P;
  const connY = benchY - COUNTER.connY * P;

  return (
    <g>
      {backdrop}
      <Varselskilt x={counterX} y={benchY - 0.25 * P} P={P} />
      <Telleapparat x={counterX} y={benchY} P={P} count={count} blink={blink} />
      <Lydbuer
        x={counterX - (COUNTER.w / 2) * P - 0.002 * P}
        y={counterTop + 0.031 * P}
        P={P}
        n={Math.min(3, fresh.length)}
        strength={blink > 0 ? 0.4 + 0.6 * blink : 0}
        color={FRESH}
      />
      <Stativ rodX={rodX} benchY={benchY} clampY={clampY} tubeX={tubeX} P={P} />
      <Sample type={sample.type} x={tubeX} y={benchY} P={P} />

      {showRadiation &&
        fresh.map(({ i, age }) => {
          const d = draws[i];
          if (!d) return null;
          return <Radiation key={i} rad={sample.rad} track={emissionTrack(sample.rad, sample.type, d, L)} age={age} P={P} />;
        })}

      <GmRor x={tubeX} windowY={windowY} P={P} />
      <Klemme x={tubeX} y={clampY} P={P} />
      <Cable
        points={[
          [tubeX, capTop + 2],
          [tubeX, capTop - 0.02 * P],
          [cableX, capTop - 0.02 * P],
          [cableX, connY],
          [counterRight + 0.008 * P, connY],
        ]}
        r={0.012 * P}
      />

      {/* Utsnittet som er forstørret */}
      <rect
        x={sampleBox.x0}
        y={sampleBox.y0}
        width={sampleBox.x1 - sampleBox.x0}
        height={sampleBox.y1 - sampleBox.y0}
        rx={6}
        fill="none"
        stroke={VIZ.ink}
        strokeWidth={1.3 * ss}
        strokeDasharray={`${5 * ss} ${4 * ss}`}
        opacity={0.55}
      />
      {wedge.map(([x1, y1, x2, y2], k) => (
        <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={VIZ.ink} strokeWidth={1.1 * ss} opacity={0.35} />
      ))}

      <Callout x={counterX - 0.052 * P} y={counterTop + 2} lx={counterX - 0.04 * P} ly={counterTop - 0.014 * P - 9 * f} anchor="start">
        Geigerteller
      </Callout>
    </g>
  );
}

/** Kabel fra røret til telleapparatet: svart, rund, med myke bøyer. */
function Cable({ points, r }: { points: [number, number][]; r: number }) {
  const ss = useStrokeScale();
  let d = '';
  points.forEach(([x, y], i) => {
    if (i === 0) {
      d += `M${x},${y}`;
      return;
    }
    const prev = points[i - 1]!;
    const next = points[i + 1];
    if (!next) {
      d += ` L${x},${y}`;
      return;
    }
    const lenIn = Math.hypot(x - prev[0], y - prev[1]);
    const lenOut = Math.hypot(next[0] - x, next[1] - y);
    const rr = Math.min(r, lenIn / 2, lenOut / 2);
    const ax = x - ((x - prev[0]) / (lenIn || 1)) * rr;
    const ay = y - ((y - prev[1]) / (lenIn || 1)) * rr;
    const bx = x + ((next[0] - x) / (lenOut || 1)) * rr;
    const by = y + ((next[1] - y) / (lenOut || 1)) * rr;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  });
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} stroke={SCENE.outline} strokeWidth={6 * ss} />
      <path d={d} stroke={SCENE.rubber} strokeWidth={4.4 * ss} />
      <path d={d} stroke={SCENE.rubberLight} strokeWidth={1.2 * ss} opacity={0.7} transform="translate(-0.8 -0.8)" />
    </g>
  );
}

/** Strålingen fra ett henfall: α (heliumkjerne med tett spor), β (elektron med tynt spor) eller γ (foton). */
function Radiation({ rad, track, age, P }: { rad: Radiation; track: Track; age: number; P: number }) {
  const ss = useStrokeScale();
  // Strålingen farer raskt ut (starter litt utenfor overflaten, så partiklene ikke klumper seg på prøven). Partikkelen
  // forsvinner kort etter at den har stoppet (α i lufta eller mot glasset, β og γ i vinduet eller ut av bildet),
  // mens sporet blekner litt saktere.
  const reach = Math.min(1, 0.12 + age * 1.76);
  const gone = Math.max(0, Math.min(1, (0.78 - age) / 0.28));
  const dx = Math.cos(track.ang);
  const dy = -Math.sin(track.ang);
  const dist = reach * track.len;
  const x = track.x + dx * dist;
  const y = track.y + dy * dist;
  if (rad === 'gamma') {
    const packet = Math.min(dist, 0.022 * P);
    if (packet < 4 || gone <= 0) return null;
    return (
      <g opacity={gone}>
        <Foton x1={x - dx * packet} y1={y - dy * packet} x2={x} y2={y} bolgelengde={0.002} farge={FRESH} amplitude={0.0024 * P} svingninger={5} />
      </g>
    );
  }
  const alphaParticle = rad !== 'beta';
  return (
    <g>
      <line
        x1={track.x}
        y1={track.y}
        x2={x}
        y2={y}
        stroke={FRESH}
        strokeWidth={(alphaParticle ? 2.6 : 1.3) * ss}
        strokeLinecap="round"
        opacity={0.6 * (1 - age)}
      />
      {gone > 0 && (
        <g opacity={gone}>
          {alphaParticle ? <Atomkjerne x={x} y={y} Z={2} N={2} r={0.0027 * P} tegn={false} /> : <Elektron x={x} y={y} r={0.004 * P} tegn={false} />}
        </g>
      )}
    </g>
  );
}

/** Tekstbredde (omtrent) for en etikett med relativ størrelse `size`, så ikonene i reaksjonslinja får plass. */
function textWidth(s: string, size: number, f: number): number {
  const fs = 17 * size * f;
  let w = 0;
  for (const ch of s) w += /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺̄]/.test(ch) ? 0.42 * fs : ch === ' ' ? 0.3 * fs : 0.62 * fs;
  return w;
}

/**
 * Det forstørrede utsnittet: 400 av kjernene i prøven i et rutenett. Kjerner som ikke har henfalt, er blanke oransje
 * kuler; de som har henfalt (datterkjernen), er grå. En kjerne som akkurat har henfalt, får en ring, og strålingen
 * farer ut av den. Øverst står reaksjonen for ett henfall.
 */
export function NucleusPanel({
  L,
  p,
  times,
  draws,
  t,
  showRadiation,
}: {
  L: HlLayout;
  p: HalfLifePreset;
  times: number[];
  draws: EmissionDraw[];
  t: number;
  showRadiation: boolean;
}) {
  const id = useSvgId('hl-kjerne');
  const ss = useStrokeScale();
  const { panel: pn, f } = L;
  const sample = sampleFor(p);
  const fresh = new Map(freshDecays(times, t).map((d) => [d.i, d.age] as const));
  const c = pn.cell;
  const iconR = 6.5 * Math.max(1, 0.85 * f);
  const rows = Math.ceil(times.length / pn.cols);
  const gridBox: [number, number, number, number] = [pn.gridX - 5, pn.gridY - 5, pn.gridX + pn.cols * c + 5, pn.gridY + rows * c + 5];

  // Reaksjonslinja: ¹⁴C → ¹⁴N + e⁻ + ν̄ (+ γ)
  const iso = nuclideText(p.Z, p.A);
  const strip: { kind: 'mother' | 'daughter' | 'alfa' | 'beta' | 'text'; label: string }[] = [
    { kind: 'mother', label: iso },
    { kind: 'text', label: '→' },
    { kind: 'daughter', label: p.daughter },
    { kind: 'text', label: '+' },
    p.decay === 'α' ? { kind: 'alfa', label: 'α' } : { kind: 'beta', label: 'e⁻' },
  ];
  if (p.decay !== 'α') strip.push({ kind: 'text', label: '+ ν̄' });
  if (sample.rad === 'gamma') strip.push({ kind: 'text', label: '+ γ' });
  const size = 0.8;
  let cx = pn.x + 14;
  const items = strip.map((it) => {
    const icon = it.kind === 'text' ? 0 : 2 * iconR + 4;
    const x = cx;
    cx += icon + textWidth(it.label, size, f) + 8 * f;
    return { ...it, x, icon };
  });

  return (
    <g>
      <RadialGradient id={`${id}m`} fx={0.35} fy={0.32} stops={sphereStops(MOTHER)} />
      <RadialGradient id={`${id}d`} fx={0.35} fy={0.32} stops={sphereStops(DAUGHTER)} />
      {/* Skygge og panel */}
      <rect x={pn.x + 2} y={pn.y + 5} width={pn.w} height={pn.h} rx={14} fill={SCENE.shadow} opacity={0.55} />
      <rect x={pn.x} y={pn.y} width={pn.w} height={pn.h} rx={14} fill={VIZ.surface} stroke={SCENE.outline} strokeWidth={1.2 * ss} />
      <Txt x={pn.x + 14} y={pn.titleY} anchor="start" size={0.85} weight={700} halo={false}>
        {sample.name}
      </Txt>
      <Txt x={pn.x + 14} y={pn.captionY} anchor="start" size={0.72} muted halo={false}>
        Forstørret modell: {times.length} av kjernene
      </Txt>
      {items.map((it, k) => {
        const tx = it.x + it.icon;
        const ty = pn.stripY + 5.5 * f;
        return (
          <g key={k}>
            {it.kind === 'mother' && <circle cx={it.x + iconR} cy={pn.stripY} r={iconR} fill={`url(#${id}m)`} stroke={shade(MOTHER, 0.35)} strokeWidth={0.8 * ss} />}
            {it.kind === 'daughter' && <circle cx={it.x + iconR} cy={pn.stripY} r={iconR} fill={`url(#${id}d)`} stroke={shade(DAUGHTER, 0.35)} strokeWidth={0.8 * ss} />}
            {it.kind === 'alfa' && <Atomkjerne x={it.x + iconR} y={pn.stripY} Z={2} N={2} r={iconR * 0.55} tegn={false} />}
            {it.kind === 'beta' && <Elektron x={it.x + iconR} y={pn.stripY} r={iconR * 0.7} tegn={false} />}
            <Txt x={tx} y={ty} anchor="start" size={size} weight={it.kind === 'text' ? 500 : 650} halo={false}>
              {it.label}
            </Txt>
          </g>
        );
      })}
      <rect
        x={pn.gridX - 6}
        y={pn.gridY - 6}
        width={pn.cols * c + 12}
        height={rows * c + 12}
        rx={8}
        fill={alpha(VIZ.muted, 0.07)}
      />
      {times.map((tau, i) => {
        const x = pn.gridX + (i % pn.cols) * c + c / 2;
        const y = pn.gridY + Math.floor(i / pn.cols) * c + c / 2;
        const alive = tau > t;
        const age = fresh.get(i);
        if (alive) return <circle key={i} cx={x} cy={y} r={c * 0.4} fill={`url(#${id}m)`} />;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={c * 0.34} fill={`url(#${id}d)`} opacity={0.85} />
            {age !== undefined && (
              <>
                <circle cx={x} cy={y} r={c * 0.56} fill="none" stroke={FRESH} strokeWidth={2 * ss} opacity={1 - 0.6 * age} />
                {showRadiation && <FreshDot x={x} y={y} c={c} age={age} w={draws[i]?.w ?? 0} box={gridBox} />}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function FreshDot({ x, y, c, age, w, box }: { x: number; y: number; c: number; age: number; w: number; box: [number, number, number, number] }) {
  const a = anyAngle(w);
  const d = (0.55 + 0.5 * age) * c;
  const r = Math.max(1.6, 0.13 * c);
  // Hold prikken inne i rutenettet (kjernene i kanten sender den ellers ut av panelet)
  const cx = Math.min(box[2] - r, Math.max(box[0] + r, x + Math.cos(a) * d));
  const cy = Math.min(box[3] - r, Math.max(box[1] + r, y - Math.sin(a) * d));
  return <circle cx={cx} cy={cy} r={r} fill={FRESH} opacity={1 - age} />;
}

/** Kort tekst for figuren til skjermlesere. */
export function sceneLabel(p: HalfLifePreset, n: number, nLeft: number, time: string): string {
  const s = sampleFor(p);
  return `${s.name} under et geiger-müller-rør koblet til en teller. Forstørret: ${n} kjerner, og etter ${time} er ${nLeft} igjen (${fmt((100 * nLeft) / n, 0)} %).`;
}
