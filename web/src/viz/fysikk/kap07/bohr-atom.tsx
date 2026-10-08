/**
 * Lupen i «Bohrs atommodell»: ett hydrogenatom med banene i riktig forhold (r = n² · a₀), elektronet som hopper
 * mellom to baner, og fotonet som sendes ut (emisjon) eller tas opp (absorpsjon). Ved absorpsjon kommer også to
 * fotoner med litt mer og litt mindre energi, og de går rett gjennom. Når den innerste banen blir for liten til å
 * synes, viser en liten lupe kjernen og bane n = 1 (eller 2) forstørret.
 */
import { Txt, VIZ, fmt, useTextScale } from '../../kit';
import { Elektron, Foton, Nukleon, RadialGradient, SCENE, ValueTag, alpha, shade, tint, useSceneScale, useStrokeScale, useSvgId } from '../../kit/scene';
import {
  BOHR_ANIM,
  absorptionTiming,
  electronAt,
  emissionSpeed,
  emittedPhoton,
  incomingPhoton,
  jumpTrace,
  orbitPx,
  passingPhotons,
  pxPerNm,
  scaleBar,
  type Circle,
  type Pt,
} from './bohr-scene';
import { LupeKant, NightTxt } from './bohr-deler';
import { REGION_NAMES, colorName, roundSig, sigDecimals, spectralRegion, transitionPhoton } from './model';

export type Mode = 'emisjon' | 'absorpsjon';

/** Vinkelen (grader, mot klokka med y opp) der elektronet hopper: oppe til høyre ved emisjon, oppe til venstre ved absorpsjon. */
const ALPHA = { emisjon: 30, absorpsjon: 140 } as const;

export interface AtomLupeProps {
  c: Circle;
  mode: Mode;
  upper: number;
  lower: number;
  /** Tiden i avspillingen (s), eller null for oppsummeringen (alt på én gang). */
  t: number | null;
  /** Høyre kant for fotonene som går ut av lupen. */
  xEnd: number;
  /** Fargen til serien (spranget). */
  color: string;
}

/** Bølgelengden med tre gjeldende siffer, uten enhet: «657», «93,8», «7 470». */
export function nmText(nm: number): string {
  const r = roundSig(nm, 3);
  return fmt(r, sigDecimals(r));
}

/** Fotonenergien med tre gjeldende siffer, uten enhet: «1,89», «0,167», «13,2». */
export function eVText(eV: number): string {
  const r = roundSig(eV, 3);
  return fmt(r, sigDecimals(r));
}

/** Tekst som beskriver lyset: «rødt lys», «ultrafiolett (usynlig)». */
export function lightText(nm: number): string {
  const region = spectralRegion(nm);
  if (region !== 'synlig') return `${REGION_NAMES[region]} (usynlig)`;
  // «lys» er intetkjønn: rødt, gult, grønt, blått og blågrønt lys (fiolett og oransje bøyes ikke)
  const NEUTER: Record<string, string> = { rød: 'rødt', gul: 'gult', grønn: 'grønt', blå: 'blått', blågrønn: 'blågrønt' };
  const name = colorName(nm);
  return `${NEUTER[name] ?? name} lys`;
}

export function AtomLupe({ c, mode, upper, lower, t, xEnd, color }: AtomLupeProps) {
  const k = useSceneScale();
  const f = useTextScale();
  const ss = useStrokeScale();
  const bgId = useSvgId('bohr-atom-bg');
  const clipId = useSvgId('bohr-atom-clip');
  const { x: cx, y: cy, r: Rb } = c;
  const rFit = 0.7 * Rb;
  const re = 8 * k;
  const rp = 6.5 * k;
  const minR = rp + re + 4 * k;
  const rPx = (n: number) => orbitPx(n, upper, rFit);
  const a = (ALPHA[mode] * Math.PI) / 180;
  const at = (r: number, ang: number): Pt => ({ x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) });
  const [start, end] = mode === 'emisjon' ? [upper, lower] : [lower, upper];

  // Liten lupe når den nederste banen er for liten til at elektronet får plass mellom kjernen og banen
  const inset = rPx(lower) < minR;
  const ringR = Math.max(10 * k, rPx(lower) + 5 * k);
  const Ci: Circle = { x: cx + 0.45 * Rb, y: cy + 0.42 * Rb, r: 0.27 * Rb };
  const rIn = (n: number) => 0.55 * Ci.r * (n / lower) ** 2;
  const small = (n: number) => inset && n <= lower;
  /** Der elektronet er tegnet på bane n ved vinkelen ang (i den lille lupen hvis banen er for liten). */
  const spot = (n: number, ang: number): Pt => (small(n) ? { x: Ci.x + rIn(n) * Math.cos(ang), y: Ci.y - rIn(n) * Math.sin(ang) } : at(rPx(n), ang));
  /** Enden av spranget i den store lupen: på banen, eller på ringen rundt kjernen når banen er for liten. */
  const jumpEnd = (n: number): Pt => (small(n) ? at(ringR, a) : at(rPx(n), a));

  // Fotonet (samme ved emisjon og absorpsjon)
  const ph = transitionPhoton(upper, lower);
  const nm = ph.lambda * 1e9;

  // Tidslinje: ved emisjon hopper elektronet ved BOHR_ANIM.jump, ved absorpsjon når fotonet treffer.
  const target = jumpEnd(lower);
  const yAbs = target.y;
  const chordLeft = (y: number) => cx - Math.sqrt(Math.max(0, Rb * Rb - (y - cy) ** 2));
  const xHit = target.x - (small(lower) ? 3 * k : re + 3 * k);
  const xStart = chordLeft(yAbs);
  const Labs = Math.max(40, Math.min(150 * k, xHit - xStart - 6));
  const timing = absorptionTiming(xStart, xHit, xEnd, Labs);
  const tJ = mode === 'emisjon' ? BOHR_ANIM.jump : timing.tHit;
  const animated = t !== null;
  const e = animated ? electronAt(t, start, end, a, tJ) : { n: end, angle: a, jumped: true };
  const trace = animated ? jumpTrace(t, tJ) : 1;

  // Banene: alle som får plass i lupen, de to i overgangen tydeligst
  const orbits: number[] = [];
  for (let n = 1; n <= 12; n++) {
    const r = rPx(n);
    if (r > Rb - 8) break;
    if (r >= rp + 2) orbits.push(n);
  }
  const fsPx = 17 * f * 0.78;
  // Etiketten står like over banen (utenfor den), så streken aldri går gjennom teksten. Den trenger plass opp til
  // neste bane (eller kanten av lupen).
  const labelGap = 4 * ss;
  const labelRoom = labelGap + fsPx * 0.78 + 3 * ss;
  const labelled: number[] = [];
  orbits.forEach((n, i) => {
    const r = rPx(n);
    const sel = n === upper || n === lower;
    const next = i + 1 < orbits.length ? rPx(orbits[i + 1]!) : Rb;
    if (r < minR || next - r < labelRoom) return;
    if (!sel && r < 26 * k) return;
    labelled.push(n);
  });
  // Målestokken nederst, i ringen mellom den ytterste banen (0,7 R) og kanten av lupen, med teksten til venstre
  const barFs = 17 * f * 0.7;
  const barText = (nm: number) => `${fmt(nm, nm < 0.1 ? 2 : nm < 1 ? 1 : 0)} nm`;
  const barY = cy + 0.8 * Rb;
  const barHalf = Math.sqrt(Math.max(0, (Rb - 8 * ss) ** 2 - (barY - cy + 5 * ss) ** 2));
  const bar = scaleBar(pxPerNm(upper, rFit), Math.min(0.34 * Rb, 2 * barHalf - 8 * ss - barFs * 0.58 * 6));
  const barTextW = barText(bar.nm).length * barFs * 0.58;
  const barX0 = cx - (bar.px + 8 * ss + barTextW) / 2 + barTextW + 8 * ss;

  return (
    <g>
      <circle cx={cx + 2.5} cy={cy + 4} r={Rb + 3} fill={SCENE.shadow} opacity={0.22} />
      <RadialGradient id={bgId} stops={[[0, SCENE.spaceGlow], [1, SCENE.space]]} />
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={Rb} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx} cy={cy} r={Rb} fill={`url(#${bgId})`} />
        {orbits.map((n) => {
          const sel = n === upper || n === lower;
          return (
            <circle
              key={n}
              cx={cx}
              cy={cy}
              r={rPx(n)}
              fill="none"
              stroke={alpha(SCENE.star, sel ? 0.8 : 0.26)}
              strokeWidth={(sel ? 1.7 : 1.1) * ss}
              strokeDasharray={sel ? undefined : `${4 * ss} ${4 * ss}`}
            />
          );
        })}
        {labelled.map((n) => {
          const sel = n === upper || n === lower;
          return (
            <NightTxt key={n} x={cx} y={cy - rPx(n) - labelGap} size={0.78} weight={sel ? 700 : 500} muted={!sel}>
              {sel ? `n = ${n}` : n}
            </NightTxt>
          );
        })}
        <Nukleon x={cx} y={cy} r={rp} type="proton" />
        {inset && <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={alpha(SCENE.star, 0.75)} strokeWidth={1.2 * ss} strokeDasharray={`${3 * ss} ${3 * ss}`} />}

        {/* Målestokk */}
        <g>
          <line x1={barX0} x2={barX0 + bar.px} y1={barY} y2={barY} stroke={SCENE.star} strokeWidth={2 * ss} strokeLinecap="round" />
          {[0, bar.px].map((dx) => (
            <line key={dx} x1={barX0 + dx} x2={barX0 + dx} y1={barY - 5 * ss} y2={barY + 5 * ss} stroke={SCENE.star} strokeWidth={1.6 * ss} />
          ))}
          <NightTxt x={barX0 - 8 * ss} y={barY + barFs * 0.34} size={0.7} anchor="end" muted>
            {barText(bar.nm)}
          </NightTxt>
        </g>
      </g>

      {inset && <InsetLupe Ci={Ci} lower={lower} rIn={rIn} rp={rp} ring={{ x: cx, y: cy, r: ringR }} />}

      {/* Spranget mellom banene og elektronet */}
      {trace > 0 && <JumpArrow from={jumpEnd(start)} to={jumpEnd(end)} gapFrom={small(start) ? 2 * k : re + 3 * k} gapTo={small(end) ? 2 * k : re + 4 * k} color={color} opacity={trace} />}
      {trace > 0 && (
        <g opacity={trace}>
          <Elektron x={spot(start, a).x} y={spot(start, a).y} r={re} dim />
        </g>
      )}
      <Elektron x={spot(e.n, e.angle).x} y={spot(e.n, e.angle).y} r={re} />

      <LupeKant c={c} shadow={false} />

      {mode === 'emisjon' ? (
        <EmissionPhoton from={at(rPx(upper), a)} re={re} nm={nm} eV={ph.eV} c={c} xEnd={xEnd} t={t} tJ={tJ} />
      ) : (
        <AbsorptionPhotons
          c={c}
          y={yAbs}
          xStart={xStart}
          xHit={xHit}
          L={Labs}
          v={timing.v}
          tHit={timing.tHit}
          xEnd={xEnd}
          t={t}
          nm={nm}
          upper={upper}
          lower={lower}
          chordLeft={chordLeft}
        />
      )}
    </g>
  );
}

/** Stiplet, svakt buet pil for spranget mellom to baner. */
function JumpArrow({ from, to, gapFrom, gapTo, color, opacity }: { from: Pt; to: Pt; gapFrom: number; gapTo: number; color: string; opacity: number }) {
  const ss = useStrokeScale();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > gapFrom + gapTo + 10)) return null;
  const ux = dx / len;
  const uy = dy / len;
  const p0 = { x: from.x + ux * gapFrom, y: from.y + uy * gapFrom };
  const p1 = { x: to.x - ux * gapTo, y: to.y - uy * gapTo };
  const bend = Math.min(0.2 * len, 24);
  const ctrl = { x: (p0.x + p1.x) / 2 - uy * bend, y: (p0.y + p1.y) / 2 + ux * bend };
  // Retningen inn mot spissen følger kurven
  const tx = p1.x - ctrl.x;
  const ty = p1.y - ctrl.y;
  const tl = Math.hypot(tx, ty) || 1;
  const hx = tx / tl;
  const hy = ty / tl;
  const hl = 11 * ss;
  const hw = 6 * ss;
  const bx = p1.x - hx * hl;
  const by = p1.y - hy * hl;
  const light = tint(color, 0.35);
  const d = `M${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${bx} ${by}`;
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={shade(color, 0.55)} strokeWidth={4.6 * ss} strokeLinecap="round" opacity={0.6} />
      <path d={d} fill="none" stroke={light} strokeWidth={2.6 * ss} strokeDasharray={`${7 * ss} ${4.5 * ss}`} strokeLinecap="round" />
      <path d={`M${p1.x} ${p1.y}L${bx - hy * hw} ${by + hx * hw}L${bx + hy * hw} ${by - hx * hw}Z`} fill={light} stroke={shade(color, 0.55)} strokeWidth={1 * ss} strokeLinejoin="round" />
    </g>
  );
}

/** Liten lupe med kjernen og de innerste banene forstørret, med streker fra ringen rundt kjernen. */
function InsetLupe({ Ci, lower, rIn, rp, ring }: { Ci: Circle; lower: number; rIn: (n: number) => number; rp: number; ring: Circle }) {
  const ss = useStrokeScale();
  const f = useTextScale();
  const clip = useSvgId('bohr-inset');
  const bg = useSvgId('bohr-inset-bg');
  const dx = Ci.x - ring.x;
  const dy = Ci.y - ring.y;
  const d = Math.hypot(dx, dy);
  const lines: [Pt, Pt][] = [];
  if (d > Ci.r + ring.r) {
    const base = Math.atan2(dy, dx);
    const phi = Math.acos((ring.r - Ci.r) / d);
    for (const s of [1, -1]) {
      const ang = base + s * phi;
      lines.push([
        { x: ring.x + ring.r * Math.cos(ang), y: ring.y + ring.r * Math.sin(ang) },
        { x: Ci.x + Ci.r * Math.cos(ang), y: Ci.y + Ci.r * Math.sin(ang) },
      ]);
    }
  }
  const ns: number[] = [];
  for (let n = 1; n <= lower; n++) if (rIn(n) >= rp + 2) ns.push(n);
  const fsPx = 17 * f * 0.72;
  return (
    <g>
      {lines.map(([p, q], i) => (
        <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={alpha(SCENE.star, 0.55)} strokeWidth={1 * ss} />
      ))}
      <RadialGradient id={bg} stops={[[0, SCENE.spaceGlow], [1, SCENE.space]]} />
      <defs>
        <clipPath id={clip}>
          <circle cx={Ci.x} cy={Ci.y} r={Ci.r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx={Ci.x} cy={Ci.y} r={Ci.r} fill={`url(#${bg})`} />
        {ns.map((n) => (
          <circle key={n} cx={Ci.x} cy={Ci.y} r={rIn(n)} fill="none" stroke={alpha(SCENE.star, n === lower ? 0.8 : 0.3)} strokeWidth={(n === lower ? 1.6 : 1) * ss} />
        ))}
        <Nukleon x={Ci.x} y={Ci.y} r={rp} type="proton" />
        <NightTxt x={Ci.x} y={Ci.y + rIn(lower) + 3 * ss + fsPx * 0.78} size={0.72} weight={700}>
          {`n = ${lower}`}
        </NightTxt>
      </g>
      <circle cx={Ci.x} cy={Ci.y} r={Ci.r} fill="none" stroke={alpha(SCENE.star, 0.7)} strokeWidth={1.4 * ss} />
    </g>
  );
}

/** Fotonet som sendes ut: fra elektronets startplass på den ytre banen og mot høyre, ut av lupen. */
function EmissionPhoton({ from, re, nm, eV, c, xEnd, t, tJ }: { from: Pt; re: number; nm: number; eV: number; c: Circle; xEnd: number; t: number | null; tJ: number }) {
  const f = useTextScale();
  const k = useSceneScale();
  const x0 = from.x + re + 6 * k;
  const L = Math.min(230 * k, 0.75 * (xEnd - x0));
  const span = t === null ? ([x0, x0 + L] as [number, number]) : emittedPhoton(t, x0, xEnd, L, emissionSpeed(x0, xEnd, L, tJ), tJ);
  const text = `${nmText(nm)} nm · ${eVText(eV)} eV`;
  // Samme bredde som ValueTag regner ut, så skiltet ikke går ut over kanten av figuren
  const fs = 17 * f * 0.9;
  const tagW = Math.max(fs * 1.6, text.length * fs * 0.6 + 16 * f);
  const tagX = Math.min((c.x + c.r + xEnd) / 2, xEnd - 2 - tagW / 2);
  return (
    <g>
      {span && span[1] - span[0] >= 16 && <Foton x1={span[0]} y1={from.y} x2={span[1]} y2={from.y} bolgelengde={nm} amplitude={8 * k} fase={t === null ? 0 : -t * 14} />}
      {(t === null || t >= tJ) && (
        <>
          <ValueTag x={tagX} y={from.y - 30 * f} text={text} />
          <Txt x={tagX} y={from.y + 34 * f} size={0.8} muted>
            {lightText(nm)}
          </Txt>
        </>
      )}
    </g>
  );
}

/**
 * Fotonene ved absorpsjon: det riktige tas opp av elektronet, de to andre (litt mer og litt mindre energi) går rett
 * gjennom og ut av lupen.
 */
function AbsorptionPhotons({
  c,
  y,
  xStart,
  xHit,
  L,
  v,
  tHit,
  xEnd,
  t,
  nm,
  upper,
  lower,
  chordLeft,
}: {
  c: Circle;
  y: number;
  xStart: number;
  xHit: number;
  L: number;
  v: number;
  tHit: number;
  xEnd: number;
  t: number | null;
  nm: number;
  upper: number;
  lower: number;
  chordLeft: (y: number) => number;
}) {
  const f = useTextScale();
  const k = useSceneScale();
  const ss = useStrokeScale();
  const { more, less } = passingPhotons(upper, lower);
  // Utenfor den ytterste banen (0,7 R) og målestokken (0,8 R), så banene deres går forbi atomet
  const dy = 0.89 * c.r;
  const pass = [
    { y: c.y - dy, nm: more.lambda * 1e9, below: true },
    { y: c.y + dy, nm: less.lambda * 1e9, below: false },
  ];
  // Det riktige fotonet tas opp i det det treffer elektronet: pakken blekner bort på et øyeblikk.
  const hit = t === null || t >= tHit ? ([Math.max(xStart, xHit - L), xHit] as [number, number]) : incomingPhoton(t, xStart, xHit, tHit, L, v, { stop: xHit });
  const hitOpacity = t === null || t < tHit ? 1 : Math.max(0, 1 - (t - tHit) / 0.2);
  const labelX = (c.x + c.r + xEnd) / 2;
  return (
    <g>
      {hit && hit[1] - hit[0] >= 16 && hitOpacity > 0 && (
        <g opacity={hitOpacity}>
          <Foton x1={hit[0]} y1={y} x2={hit[1]} y2={y} bolgelengde={nm} amplitude={7 * k} fase={t === null ? 0 : -Math.min(t, tHit) * 14} />
        </g>
      )}
      {hitOpacity > 0 && (
        <NightTxt x={Math.max(xStart + 30 * f, xHit - L / 2)} y={y + 14 * k + 17 * f} size={0.75} weight={700} anchor="middle">
          {nmText(nm)} nm
        </NightTxt>
      )}
      {pass.map((p, i) => {
        const x0 = chordLeft(p.y);
        const span = t === null ? ([xEnd - 4 - L, xEnd - 4] as [number, number]) : incomingPhoton(t, x0, xHit, tHit, L, v, { xEnd });
        const region = spectralRegion(p.nm);
        const fs = 17 * f * 0.75;
        // Teksten står mellom de to fotonene (under det øverste, over det nederste), så den ikke går ut av figuren
        const ty = p.below ? p.y + 6 * k + 8 * f + fs * 0.78 : p.y - 6 * k - 8 * f;
        const xOut = 2 * c.x - x0;
        const dash = `${2 * ss} ${5 * ss}`;
        return (
          <g key={i}>
            {/* Svak, rett bane gjennom gassen: fotonet går forbi atomet uten å bli tatt opp (lys inne i lupen, grå utenfor) */}
            <line x1={x0 + 2} x2={xOut - 2} y1={p.y} y2={p.y} stroke={SCENE.star} strokeWidth={1.3 * ss} strokeDasharray={dash} strokeLinecap="round" opacity={0.55} />
            <line x1={xOut + 4} x2={xEnd - 4} y1={p.y} y2={p.y} stroke={VIZ.muted} strokeWidth={1.3 * ss} strokeDasharray={dash} strokeLinecap="round" opacity={0.7} />
            {span && span[1] - span[0] >= 16 && (
              <Foton x1={span[0]} y1={p.y} x2={span[1]} y2={p.y} bolgelengde={p.nm} amplitude={6 * k} fase={t === null ? 0 : -t * 14} />
            )}
            <Txt x={labelX} y={ty} size={0.75} muted>
              {`${nmText(p.nm)} nm${region === 'synlig' ? '' : ` (${REGION_NAMES[region]})`} går gjennom`}
            </Txt>
          </g>
        );
      })}
    </g>
  );
}
