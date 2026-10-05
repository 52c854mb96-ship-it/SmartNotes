import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, ZoomIn, ZoomOut } from 'lucide-react';
import {
  BIO,
  Controls,
  Explain,
  Figure,
  Legend,
  Readout,
  Readouts,
  Slider,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  fmtSci,
  useContainerTextScale,
  useSimClock,
  useTextScale,
} from '../kit';
import { ART_H, ART_W, drawing, type Column, type Drawing } from './Nivategninger';
import {
  LEVELS,
  LEVEL_COUNT,
  SCALE_MAX_EXP,
  SCALE_MIN_EXP,
  fmtLength,
  italicSegments,
  levelAt,
  ordersOfMagnitude,
  plain,
  scalePos,
  wrapText,
  type Level,
} from './model';

const COL: Record<Column, string> = { human: BIO.serie[0], forest: BIO.serie[2] };
const COLUMN_NAME: Record<Column, string> = { human: 'I menneskekroppen', forest: 'I en norsk granskog' };
/** Sekunder per nivå når nivåene spilles av. */
const STEP = 1.6;
/** Det som kan sees med elektronmikroskop, lysmikroskop og med øynene (m). */
const BANDS = [
  { from: 1e-9, to: 2e-7, color: BIO.serie[3], label: 'Elektronmikroskop (ned til ca. 1 nm)' },
  { from: 2e-7, to: 1e-4, color: BIO.serie[0], label: 'Lysmikroskop (ned til ca. 0,2 µm)' },
  { from: 1e-4, to: 1e8, color: BIO.serie[2], label: 'Med det blotte øye (fra ca. 0,1 mm)' },
];

export default function Organisasjonsnivaer() {
  const [idx, setIdx] = useState(2);
  const clock = useSimClock({ tMax: STEP * (LEVEL_COUNT - 1) + 0.2 });
  const start = useRef(0);
  const shown = clock.playing ? Math.min(LEVEL_COUNT - 1, start.current + Math.floor(clock.t / STEP)) : idx;
  const { playing, t } = clock;
  // Når avspillingen stopper (pause eller slutt), blir nivået som vises stående
  useEffect(() => {
    if (!playing && t > 0) setIdx(Math.min(LEVEL_COUNT - 1, start.current + Math.floor(t / STEP)));
  }, [playing, t]);
  const L = levelAt(shown);
  const go = (i: number) => {
    clock.reset();
    setIdx(Math.min(LEVEL_COUNT - 1, Math.max(0, i)));
  };
  const play = () => {
    if (clock.playing) {
      clock.pause();
      return;
    }
    start.current = idx >= LEVEL_COUNT - 1 ? 0 : idx;
    if (idx >= LEVEL_COUNT - 1) setIdx(0);
    clock.reset();
    clock.play();
  };
  const [rulerRef, fr] = useContainerTextScale<HTMLDivElement>();
  const [panelRef, fp] = useContainerTextScale<HTMLDivElement>();

  return (
    <VizLayout>
      <Controls>
        <Slider
          label="Organisasjonsnivå"
          value={shown}
          onChange={go}
          min={0}
          max={LEVEL_COUNT - 1}
          step={1}
          format={(v) => `${levelAt(v).name} (${Math.round(v) + 1} av ${LEVEL_COUNT})`}
        />
      </Controls>
      <Toolbar>
        <div className="viz-play">
          <button type="button" className="btn btn-sm" onClick={() => go(shown - 1)} disabled={shown <= 0}>
            <ZoomIn size={16} aria-hidden />
            Zoom inn
          </button>
          <button type="button" className="btn btn-sm" onClick={() => go(shown + 1)} disabled={shown >= LEVEL_COUNT - 1}>
            <ZoomOut size={16} aria-hidden />
            Zoom ut
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={play} aria-pressed={clock.playing}>
            {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {clock.playing ? 'Pause' : 'Spill av alle nivåene'}
          </button>
        </div>
      </Toolbar>

      <div ref={rulerRef}>
        <Ruler current={shown} f={fr} />
      </div>
      <Legend items={BANDS.map((b) => ({ color: b.color, label: b.label }))} />

      <div ref={panelRef}>
        <Panels L={L} f={fp} />
      </div>
      <Legend
        items={[
          { color: COL.human, label: 'Eksempel fra menneskekroppen' },
          { color: COL.forest, label: 'Eksempel fra granskogen' },
          { color: VIZ.ink, label: 'Stiplet ring: en enhet fra nivået under', dashed: true },
        ]}
      />

      <Readouts>
        <Readout label="Nivå" value={L.name} unit={`${shown + 1} av ${LEVEL_COUNT}`} />
        <Readout label={<>{rich(L.human.name)} ({L.human.measure})</>} value={fmtLength(L.human.size)} tone={COL.human} />
        <Readout label={<>{rich(L.forest.name)} ({L.forest.measure})</>} value={fmtLength(L.forest.size)} tone={COL.forest} />
        <Readout label="Liv på dette nivået" value={L.living ? 'Ja' : 'Nei'} tone={L.living ? COL.forest : VIZ.muted} />
      </Readouts>

      <Explain>{explanation(L)}</Explain>
    </VizLayout>
  );
}

/** Tekst med *kursiv* i HTML. */
function rich(text: string): ReactNode {
  return italicSegments(text).segments.map((p, i) => (p.italic ? <em key={i}>{p.text}</em> : <span key={i}>{p.text}</span>));
}

/** Linjer med *kursiv* i SVG (kursiv kan fortsette over linjeskift). */
function svgLines(lines: string[]): ReactNode[] {
  let it = false;
  return lines.map((line, i) => {
    const r = italicSegments(line, it);
    it = r.endItalic;
    return (
      <tspan key={i}>
        {r.segments.map((p, j) => (
          <tspan key={j} fontStyle={p.italic ? 'italic' : undefined}>
            {p.text}
          </tspan>
        ))}
      </tspan>
    );
  });
}

/* ---------- Størrelsesskala ---------- */

const RX0 = 34;
const RX1 = 766;
const rx = (m: number) => RX0 + (RX1 - RX0) * scalePos(m);

const DECADE_LABELS: Record<number, string> = { [-9]: '1 nm', [-6]: '1 µm', [-3]: '1 mm', 0: '1 m', 3: '1 km', 6: '1 000 km' };

function Ruler({ current, f }: { current: number; f: number }) {
  const L = levelAt(current);
  const k = Math.max(1, 0.85 * f);
  const titleY = 18 * f;
  const tagHY = titleY + 28 * f;
  const dotHY = tagHY + 16 * f;
  const axisY = dotHY + 16 * k;
  const bandY = axisY + 4;
  const labelY = bandY + 10 + 16 * f;
  const dotFY = labelY + 14 * f;
  const tagFY = dotFY + 30 * f;
  const H = Math.round(tagFY + 12);
  const ticks: ReactNode[] = [];
  for (let e = SCALE_MIN_EXP; e <= SCALE_MAX_EXP; e++) {
    const x = rx(10 ** e);
    const major = DECADE_LABELS[e] !== undefined;
    ticks.push(<line key={e} x1={x} x2={x} y1={axisY - (major ? 9 : 5)} y2={axisY} stroke={VIZ.muted} strokeWidth={major ? 1.8 : 1.2} />);
  }
  // Etikett over/under prikken, men innenfor figuren
  const tag = (x: number, y: number, text: string, color: string) => {
    const w = plain(text).length * 0.56 * 17 * 0.82 * f;
    const anchor = x - w / 2 < 4 ? 'start' : x + w / 2 > 796 ? 'end' : 'middle';
    const tx = anchor === 'start' ? Math.max(4, x - 12) : anchor === 'end' ? Math.min(796, x + 12) : x;
    return (
      <Txt x={tx} y={y} anchor={anchor} size={0.82} weight={700} color={color}>
        {svgLines([text])}
      </Txt>
    );
  };
  const hx = rx(L.human.size);
  const fx = rx(L.forest.size);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label={`Logaritmisk størrelsesskala fra 1 nm til 100 000 km. ${L.name}: ${plain(L.human.name)} er ${fmtLength(L.human.size)}, ${plain(L.forest.name).toLowerCase()} er ${fmtLength(L.forest.size)}.`}
      caption="Logaritmisk skala: hvert merke er ti ganger større enn merket til venstre. Prikkene er alle de elleve nivåene."
    >
      <Txt x={4} y={titleY} anchor="start" size={0.78} muted>
        Ekte størrelse
      </Txt>
      {BANDS.map((b) => (
        <rect key={b.label} x={rx(b.from)} y={bandY} width={Math.max(0, rx(b.to) - rx(b.from))} height={10} fill={b.color} opacity={0.4} />
      ))}
      <line x1={hx} x2={hx} y1={dotHY} y2={axisY} stroke={COL.human} strokeWidth={2} />
      <line x1={fx} x2={fx} y1={axisY} y2={dotFY} stroke={COL.forest} strokeWidth={2} strokeOpacity={0.7} />
      <line x1={RX0} x2={RX1} y1={axisY} y2={axisY} stroke={VIZ.ink} strokeWidth={1.8} />
      {ticks}
      {Object.entries(DECADE_LABELS).map(([e, text]) => (
        <Txt key={e} x={rx(10 ** Number(e))} y={labelY} size={0.78} muted>
          {text}
        </Txt>
      ))}
      {/* Alle nivåene som små prikker, det valgte stort */}
      {LEVELS.map((l, i) =>
        i === current ? null : (
          <g key={l.id} opacity={0.5}>
            <circle cx={rx(l.human.size)} cy={dotHY} r={3 * k} fill={COL.human} />
            <circle cx={rx(l.forest.size)} cy={dotFY} r={3 * k} fill={COL.forest} />
          </g>
        ),
      )}
      <circle cx={hx} cy={dotHY} r={7 * k} fill={COL.human} stroke={VIZ.surface} strokeWidth={2} />
      <circle cx={fx} cy={dotFY} r={7 * k} fill={COL.forest} stroke={VIZ.surface} strokeWidth={2} />
      {tag(hx, tagHY, `${L.human.name}: ${fmtLength(L.human.size)}`, COL.human)}
      {tag(fx, tagFY, `${L.forest.name}: ${fmtLength(L.forest.size)}`, COL.forest)}
    </Figure>
  );
}

/* ---------- To paneler: menneskekroppen og skogen ---------- */

function Panels({ L, f }: { L: Level; f: number }) {
  const narrow = f > 1.3;
  const W = narrow ? 760 : 370;
  const headH = 22 * f + 26 * f + 10;
  const artH = narrow ? 470 : 236;
  const maxChars = Math.floor((W - 8) / (0.8 * 17 * f * 0.6));
  const detailLines = (c: Column) => wrapText(L[c].detail, maxChars);
  const nLines = Math.max(detailLines('human').length, detailLines('forest').length);
  const block = headH + artH + 14 + nLines * 21 * f + 6;
  const panels: { c: Column; x: number; y: number }[] = [
    { c: 'human', x: 20, y: 0 },
    { c: 'forest', x: narrow ? 20 : 410, y: narrow ? block + 16 : 0 },
  ];
  const H = Math.round(narrow ? 2 * block + 16 : block);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1600 : H}
      label={`${L.name}. I menneskekroppen: ${plain(L.human.name)}, ${fmtLength(L.human.size)}. I granskogen: ${plain(L.forest.name)}, ${fmtLength(L.forest.size)}.`}
      caption="Tegningene er forenklet og ikke i samme målestokk. Den ekte størrelsen står ved hakeparentesen."
    >
      {panels.map(({ c, x, y }) => (
        <g key={c}>
          <Txt x={x + 4} y={y + 18 * f} anchor="start" size={0.78} muted>
            {COLUMN_NAME[c]}
          </Txt>
          <Txt x={x + 4} y={y + 18 * f + 26 * f} anchor="start" size={1.05} weight={700} color={COL[c]}>
            {svgLines([L[c].name])}
          </Txt>
          <rect x={x} y={y + headH} width={W} height={artH} rx={12} fill={VIZ.surface} stroke={COL[c]} strokeOpacity={0.5} strokeWidth={1.5} />
          <Art d={drawing(L.id, c)} x={x} y={y + headH} w={W} h={artH} color={COL[c]} size={fmtLength(L[c].size)} />
          {svgLines(detailLines(c)).map((line, i) => (
            <Txt key={i} x={x + 4} y={y + headH + artH + 10 + (i + 1) * 21 * f} anchor="start" size={0.8} muted>
              {line}
            </Txt>
          ))}
        </g>
      ))}
    </Figure>
  );
}

/** Tegningen skalert inn i boksen, med hakeparentes, enhet fra nivået under og etiketter. */
function Art({ d, x, y, w, h, color, size }: { d: Drawing; x: number; y: number; w: number; h: number; color: string; size: string }) {
  const f = useTextScale();
  // Plass til hakeparentesen og etikettene rundt tegningen
  const pad = 24 * f;
  const s = Math.min((w - 2 * pad) / ART_W, (h - 2 * pad) / ART_H);
  const ox = x + (w - ART_W * s) / 2;
  const oy = y + (h - ART_H * s) / 2;
  const P = (px: number, py: number): [number, number] => [ox + px * s, oy + py * s];
  const b = d.bracket;
  const [bx1, by1] = P(b.x1, b.y1);
  const [bx2, by2] = P(b.x2, b.y2);
  const vertical = b.side === 'left' || b.side === 'right';
  const tick = 6;
  const bracketPath = vertical
    ? `M${bx1 + (b.side === 'left' ? tick : -tick)},${by1} H${bx1} V${by2} H${bx2 + (b.side === 'left' ? tick : -tick)}`
    : `M${bx1},${by1 + (b.side === 'above' ? tick : -tick)} V${by1} H${bx2} V${by2 + (b.side === 'above' ? tick : -tick)}`;
  const mid: [number, number] = [(bx1 + bx2) / 2, (by1 + by2) / 2];
  const label = (() => {
    if (b.side === 'above') return { x: mid[0], y: mid[1] - 8, anchor: 'middle' as const };
    if (b.side === 'below') return { x: mid[0], y: mid[1] + 20 * f, anchor: 'middle' as const };
    if (b.side === 'left') return { x: mid[0] - 8, y: mid[1] + 6 * f, anchor: 'end' as const };
    return { x: mid[0] + 8, y: mid[1] + 6 * f, anchor: 'start' as const };
  })();
  // Etiketten skal ikke gå ut av boksen
  const sizeW = size.length * 0.58 * 17 * 0.85 * f;
  let lx = label.x;
  let anchor = label.anchor;
  if (anchor === 'start' && lx + sizeW > x + w - 4) {
    anchor = 'end';
    lx = x + w - 6;
  }
  if (anchor === 'end' && lx - sizeW < x + 4) {
    anchor = 'start';
    lx = x + 6;
  }
  const u = d.unit;
  return (
    <g>
      <g transform={`translate(${ox} ${oy}) scale(${s})`}>{d.art}</g>
      {(d.labels ?? []).map((l, i) => {
        const [tx, ty] = P(l.x, l.y);
        const at = l.at ? P(l.at[0], l.at[1]) : null;
        return (
          <g key={i}>
            {at && <line x1={at[0]} y1={at[1]} x2={tx} y2={ty + (ty > at[1] ? -14 * f : 4)} stroke={VIZ.muted} strokeWidth={1.2} />}
            {at && <circle cx={at[0]} cy={at[1]} r={2.6} fill={VIZ.ink} stroke={VIZ.surface} strokeWidth={1} />}
            <Txt x={tx} y={ty} anchor={l.anchor ?? 'middle'} size={0.76} muted>
              {l.text}
            </Txt>
          </g>
        );
      })}
      {u &&
        (() => {
          const [ux, uy] = P(u.x, u.y);
          const r = u.r * s;
          const pos =
            u.side === 'above'
              ? { x: ux, y: uy - r - 8, a: 'middle' as const }
              : u.side === 'below'
                ? { x: ux, y: uy + r + 18 * f, a: 'middle' as const }
                : u.side === 'left'
                  ? { x: ux - r - 6, y: uy + 5 * f, a: 'end' as const }
                  : { x: ux + r + 6, y: uy + 5 * f, a: 'start' as const };
          return (
            <g>
              <circle cx={ux} cy={uy} r={r} fill="none" stroke={VIZ.ink} strokeWidth={1.8} strokeDasharray="5 4" />
              <Txt x={pos.x} y={pos.y} anchor={pos.a} size={0.78} weight={650}>
                {u.label}
              </Txt>
            </g>
          );
        })()}
      <path d={bracketPath} fill="none" stroke={color} strokeWidth={2} />
      <Txt x={lx} y={label.y} anchor={anchor} size={0.85} weight={700} color={color}>
        {size}
      </Txt>
    </g>
  );
}

/* ---------- Forklaring ---------- */

function explanation(L: Level): ReactNode {
  let extra: ReactNode;
  switch (L.id) {
    case 'molekyl':
    case 'organell':
      extra = (
        <>
          Livet starter ikke her: <strong>cellen er det laveste nivået som er levende</strong>. Zoom ut for å se hva som skjer når
          molekylene og organellene virker sammen.
        </>
      );
      break;
    case 'celle':
      extra = (
        <>
          Hos encellede organismer, som bakterier og gjær, er cellen og organismen det samme, så de hopper over vev, organ og
          organsystem.
        </>
      );
      break;
    case 'populasjon':
    case 'samfunn':
    case 'okosystem':
      extra = (
        <>
          Høyere nivå betyr ikke alltid større område: tarmen din er et lite økosystem med flere hundre arter. Det som skiller
          populasjon, samfunn og økosystem, er hva vi tar med: <strong>én art</strong>, <strong>alle artene</strong>, eller{' '}
          <strong>artene og det ikke-levende miljøet</strong>.
        </>
      );
      break;
    case 'biosfaere':
      extra = (
        <>
          Fra DNA-molekylet til jorda er det omtrent {Math.round(ordersOfMagnitude(LEVELS[0]!.human.size, L.human.size))} tierpotenser:
          jorda er ca. {fmtSci(L.human.size / LEVELS[0]!.human.size, 1)} ganger bredere enn et DNA-molekyl. Likevel påvirker nivåene hverandre begge veier, for eksempel når en mutasjon i DNA endrer en
          hel populasjon.
        </>
      );
      break;
    default:
      extra = (
        <>
          Hvert nivå består av enheter fra nivået under (den stiplede ringen), men har egenskaper som delene ikke har hver for seg. Det
          kalles <strong>emergente egenskaper</strong>.
        </>
      );
  }
  return (
    <>
      <p>
        <strong>{L.name}:</strong> {L.definition} Består av {L.consistsOf}.
      </p>
      <p>
        <strong>Ny egenskap på dette nivået:</strong> {L.emergent}
      </p>
      <p>{extra}</p>
    </>
  );
}
