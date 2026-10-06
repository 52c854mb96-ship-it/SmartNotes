/**
 * Frilegemediagram for det valgte systemet i «Bil med tilhenger» (k2-koblede-klosser): G og N er 4–18 ganger så store
 * som F og S, så de får ikke plass i scenen i samme målestokk. Her tegnes alle kreftene på systemet fra tyngdepunktet
 * i én egen målestokk (G er alltid like lang), så eleven ser hvor store G og N er, og at de opphever hverandre.
 */
import { Figure, Txt, VIZ, fmt, G_EARTH, useTextScale } from '../../kit';
import { ForceArrow, alpha, useStrokeScale } from '../../kit/scene';
import { roundSig, type TowSystem } from './model-koblede-klosser';
import { useNarrow } from './useNarrow';

/** Piler kortere enn dette tegnes ikke; da står bare etiketten med verdien. */
const MIN_ARROW = 8;

const WHAT: Record<TowSystem['view'], string> = { system: 'hele vogntoget', henger: 'hengeren', bil: 'bilen' };

/** G og N med tre gjeldende siffer: «13 700 N». */
export function fmtSig(v: number): string {
  const r = roundSig(v);
  return fmt(r.value, r.decimals);
}

interface Layout {
  w: number;
  h: number;
  /** Tyngdepunktet til legemet i diagrammet. */
  cx: number;
  cy: number;
  /** Lengden på G og N (figurens enheter). */
  len: number;
  /** Klossen som står for systemet. */
  bw: number;
  bh: number;
  /** Teksten: venstre kant og første linje, og om den står over diagrammet (mobil) eller til venstre (PC). */
  tx: number;
  ty: number;
}

const WIDE: Layout = { w: 800, h: 330, cx: 560, cy: 165, len: 132, bw: 64, bh: 40, tx: 40, ty: 92 };
const NARROW: Layout = { w: 440, h: 490, cx: 220, cy: 310, len: 132, bw: 60, bh: 38, tx: 20, ty: 34 };

export function Frilegemediagram({ sys }: { sys: TowSystem }) {
  const [ref, narrow] = useNarrow<HTMLDivElement>();
  const L = narrow ? NARROW : WIDE;
  const G = sys.mass * G_EARTH;
  return (
    <div ref={ref}>
      <Figure
        viewBox={`0 0 ${L.w} ${L.h}`}
        label={`Frilegemediagram for ${WHAT[sys.view]} i egen målestokk: tyngden G = ${fmtSig(G)} N ned og normalkraften N = ${fmtSig(G)} N opp, ${horizontalText(sys)}.`}
        maxHeight={narrow ? 540 : 350}
      >
        <Content sys={sys} L={L} narrow={narrow} />
      </Figure>
    </div>
  );
}

function horizontalText(sys: TowSystem): string {
  const ext = sys.forces.filter((f) => !f.internal);
  return ext.map((f) => `${f.name} = ${fmt(Math.abs(f.value), 0)} N ${f.value > 0 ? 'fremover' : 'bakover'}`).join(' og ');
}

function Content({ sys, L, narrow }: { sys: TowSystem; L: Layout; narrow: boolean }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const G = sys.mass * G_EARTH;
  // Én målestokk for alle kreftene i diagrammet: G (og N) er alltid `len` lang.
  const k = G > 0 ? L.len / G : 0;
  const { cx, cy, bw, bh } = L;
  const ext = sys.forces.filter((fc) => !fc.internal);
  const mass = `m = ${fmt(sys.mass, 0)} kg`;
  const lines = [
    mass,
    'Alle kreftene i samme målestokk,',
    'men en annen enn i bildet over.',
    'G og N er like store og opphever',
    'hverandre.',
    ...(sys.view === 'system' ? ['Kreftene i hengerfestet er indre', 'og er ikke med.'] : []),
  ];
  // På mobil står teksten over diagrammet med lengre linjer.
  const shown = narrow
    ? [
        mass,
        'Alle kreftene i samme målestokk,',
        'men en annen enn i bildet over.',
        ...(sys.view === 'system' ? ['Kreftene i hengerfestet er indre.'] : []),
      ]
    : lines;
  const lineH = 22 * f;
  return (
    <g>
      <Txt x={L.tx} y={L.ty} anchor="start" size={1.05} weight={760}>
        Frilegemediagram for {WHAT[sys.view]}
      </Txt>
      {shown.map((t, i) => (
        <Txt key={i} x={L.tx} y={L.ty + (i + 1) * lineH + 4 * f} anchor="start" size={0.85} weight={560} muted>
          {t}
        </Txt>
      ))}

      {/* Legemet: en liten, gjennomsiktig kloss for systemet, så også korte piler synes oppå den */}
      <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={7} fill={alpha(VIZ.bodyStrong, 0.28)} stroke={VIZ.muted} strokeWidth={1.4 * ss} />

      {G > 0 && (
        <>
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy - G * k} color={VIZ.normal} label={`N = ${fmtSig(G)} N`} labelAnchor="start" labelX={cx + 12} labelY={cy - G * k + 14 * f} />
          <ForceArrow x1={cx} y1={cy} x2={cx} y2={cy + G * k} color={VIZ.gravity} label={`G = ${fmtSig(G)} N`} labelAnchor="start" labelX={cx + 12} labelY={cy + G * k - 4 * f} origin />
        </>
      )}
      {ext.map((fc, i) => {
        const len = Math.abs(fc.value) * k;
        if (!(Math.abs(fc.value) > 0)) return null;
        const dir = fc.value > 0 ? 1 : -1;
        const tip = cx + dir * len;
        const color = fc.name === 'F' ? VIZ.applied : VIZ.tension;
        const text = `${fc.name} = ${fmt(Math.abs(fc.value), 0)} N`;
        // Etiketten står utenfor klossen, på den siden pila peker.
        const lx = dir > 0 ? Math.max(tip, cx + bw / 2) + 8 : Math.min(tip, cx - bw / 2) - 8;
        // F og S peker hver sin vei (bilen), så etikettene kan stå på samme høyde.
        const ly = cy + 6 * f;
        return len >= MIN_ARROW ? (
          <ForceArrow key={i} x1={cx} y1={cy} x2={tip} y2={cy} color={color} width={6} label={text} labelAnchor={dir > 0 ? 'start' : 'end'} labelX={lx} labelY={ly} />
        ) : (
          <Txt key={i} x={lx} y={ly} anchor={dir > 0 ? 'start' : 'end'} color={color} weight={720}>
            {text}
          </Txt>
        );
      })}
    </g>
  );
}
