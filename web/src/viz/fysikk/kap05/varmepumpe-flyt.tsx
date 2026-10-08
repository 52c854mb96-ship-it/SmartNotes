/**
 * Energiflytdiagrammet i «Varmepumpe eller panelovn»: energien per døgn gjennom varmepumpa og gjennom panelovnene,
 * med samme skala. Begge gir huset like mye varme Q_v (like brede piler ut), men varmepumpa henter det meste fra
 * uteluften (Q_k) og trenger bare W = Q_v / ε fra strømnettet.
 */
import { TSub, Txt, VIZ, fmt, useTextScale } from '../../kit';
import { useStrokeScale } from '../../kit/scene';
import type { HeatPumpState } from './model-varmepumpe';
import { FLOW } from './varmepumpe-deler';

const r1 = (v: number) => Math.round(v * 10) / 10;

interface FlowLayout {
  W: number;
  /** Venstre ende av pilene inn, boksen og spissen på pila ut. */
  xIn: number;
  box0: number;
  box1: number;
  xTip: number;
  /** Bredden på pila ut (varmen til huset). */
  band: number;
  /** Mellomrom mellom de to pilene inn til varmepumpa. */
  gap: number;
  /** Tekstskaleringen figuren regner med når høyden velges. */
  f: number;
}

export const FLOW_WIDE: FlowLayout = { W: 800, xIn: 16, box0: 330, box1: 470, xTip: 784, band: 56, gap: 12, f: 1 };
export const FLOW_NARROW: FlowLayout = { W: 560, xIn: 8, box0: 180, box1: 346, xTip: 552, band: 50, gap: 10, f: 1.25 };

function rowHeights(L: FlowLayout, f: number) {
  const lh = 17 * f;
  const title = 14 + lh;
  const pump = lh + 12 + L.band + L.gap + 10 + lh + 8;
  const panel = lh + 12 + L.band + 8;
  return { lh, title, pump, panel, gapRows: 16, pad: 6 };
}

/** Høyden på figuren (før tekstskaleringen er kjent brukes L.f). */
export function flowHeight(L: FlowLayout): number {
  const h = rowHeights(L, L.f);
  return Math.ceil(h.title + h.pump + h.gapRows + h.panel + h.pad);
}

const kWh = (v: number) => `${fmt(v, 1)} kWh`;

export function EnergiFlyt({ s, L }: { s: HeatPumpState; L: FlowLayout }) {
  const f = useTextScale();
  const ss = useStrokeScale();
  const h = rowHeights(L, Math.max(f, L.f));
  const narrow = L.W < 700;
  const Qv = s.day.pump.Qv;
  const k = Qv > 0 ? L.band / Qv : 0;
  const hW = Math.max(1.5, s.day.pump.W * k);
  const hQk = Math.max(0, L.band - hW);

  const pumpTop = h.title;
  const panelTop = h.title + h.pump + h.gapRows;

  return (
    <g>
      <Txt x={L.xIn} y={h.title - 14} anchor="start" size={0.85} muted>
        Energi per døgn, {fmt(s.tOut, 0)} °C ute og {fmt(s.tIn, 0)} °C inne
      </Txt>
      <Row
        L={L}
        top={pumpTop}
        lh={h.lh}
        name="Varmepumpe"
        cop={`ε = ${fmt(s.cop, 1)}`}
        hW={hW}
        hQk={hQk}
        labels={{
          W: narrow ? null : 'Strøm fra nettet: ',
          Qk: narrow ? null : 'Varme fra uteluften: ',
          Qv: narrow ? null : 'Varme til huset: ',
        }}
        values={{ W: s.day.pump.W, Qk: s.day.pump.Qk, Qv }}
        ss={ss}
      />
      <Row
        L={L}
        top={panelTop}
        lh={h.lh}
        name="Panelovner"
        cop="ε = 1"
        hW={L.band}
        hQk={0}
        labels={{
          W: narrow ? null : 'Strøm fra nettet: ',
          Qk: null,
          Qv: narrow ? null : 'Varme til huset: ',
        }}
        values={{ W: s.day.panel.W, Qk: 0, Qv: s.day.panel.Qv }}
        ss={ss}
      />
    </g>
  );
}

function Row({
  L,
  top,
  lh,
  name,
  cop,
  hW,
  hQk,
  labels,
  values,
  ss,
}: {
  L: FlowLayout;
  top: number;
  lh: number;
  name: string;
  cop: string;
  hW: number;
  hQk: number;
  labels: { W: string | null; Qk: string | null; Qv: string | null };
  values: { W: number; Qk: number; Qv: number };
  ss: number;
}) {
  const bandTop = top + lh + 12;
  const out = L.band;
  const hasQk = hQk > 0.5;
  const gap = hasQk ? L.gap : 0;
  // W øverst, rett inn i boksen
  const wBand = `M${r1(L.xIn)},${r1(bandTop)}H${r1(L.box0 + 2)}V${r1(bandTop + hW)}H${r1(L.xIn)}Z`;
  // Q_k under, med et mellomrom som lukkes mot boksen
  const a0 = bandTop + hW + gap;
  const a1 = bandTop + hW;
  const xc0 = L.xIn + 0.42 * (L.box0 - L.xIn);
  const xc1 = L.box0 - 0.12 * (L.box0 - L.xIn);
  const xm = (xc0 + xc1) / 2;
  const qkBand = hasQk
    ? `M${r1(L.xIn)},${r1(a0)}H${r1(xc0)}C${r1(xm)},${r1(a0)} ${r1(xm)},${r1(a1)} ${r1(xc1)},${r1(a1)}H${r1(L.box0 + 2)}V${r1(a1 + hQk)}H${r1(xc1)}C${r1(xm)},${r1(a1 + hQk)} ${r1(xm)},${r1(a0 + hQk)} ${r1(xc0)},${r1(a0 + hQk)}H${r1(L.xIn)}Z`
    : '';
  // Pila ut: like bred som det som kommer inn
  const head = Math.min(26, 0.45 * out + 6);
  const flare = Math.max(6, 0.18 * out);
  const xb = L.xTip - head;
  const outBand = `M${r1(L.box1 - 2)},${r1(bandTop)}H${r1(xb)}V${r1(bandTop - flare)}L${r1(L.xTip)},${r1(bandTop + out / 2)}L${r1(xb)},${r1(bandTop + out + flare)}V${r1(bandTop + out)}H${r1(L.box1 - 2)}Z`;
  const boxTop = bandTop - 8;
  const boxBot = bandTop + out + 8;
  const boxMid = (boxTop + boxBot) / 2;
  const bottomOfInputs = bandTop + hW + gap + hQk;
  const valueText = (prefix: string | null, sym: string, sub: string | null, v: number) => (
    <>
      {prefix}
      {sym}
      {sub && <TSub>{sub}</TSub>} = {kWh(v)}
    </>
  );
  return (
    <g>
      <path d={wBand} fill={FLOW.W} opacity={0.9} />
      {hasQk && <path d={qkBand} fill={FLOW.Qk} opacity={0.9} />}
      <path d={outBand} fill={FLOW.Qv} opacity={0.9} />
      <path d={outBand} fill="none" stroke={VIZ.ink} strokeOpacity={0.25} strokeWidth={0.8 * ss} />
      <rect
        x={L.box0}
        y={boxTop}
        width={L.box1 - L.box0}
        height={boxBot - boxTop}
        rx={10}
        fill={VIZ.surface}
        stroke={VIZ.muted}
        strokeWidth={1.2 * ss}
      />
      <Txt x={(L.box0 + L.box1) / 2} y={boxMid - 3} weight={700} halo={false} size={L.W < 700 ? 0.92 : 1}>
        {name}
      </Txt>
      <Txt x={(L.box0 + L.box1) / 2} y={boxMid + lh - 1} size={0.85} muted halo={false}>
        {cop}
      </Txt>

      <Txt x={L.xIn} y={bandTop - 8} anchor="start" color={FLOW.W} weight={680}>
        {valueText(labels.W, 'W', null, values.W)}
      </Txt>
      {hasQk && (
        <Txt x={L.xIn} y={bottomOfInputs + 8 + lh * 0.8} anchor="start" color={FLOW.Qk} weight={680}>
          {valueText(labels.Qk, 'Q', 'k', values.Qk)}
        </Txt>
      )}
      <Txt x={L.xTip} y={bandTop - Math.max(8, 0.18 * out) - 6} anchor="end" color={FLOW.Qv} weight={680}>
        {valueText(labels.Qv, 'Q', 'v', values.Qv)}
      </Txt>
    </g>
  );
}
