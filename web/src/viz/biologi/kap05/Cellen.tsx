import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  BIO,
  Bakterie,
  CELL_PARTS,
  Celle,
  Cellekjerne,
  Cellemodell,
  Etikett,
  Explain,
  Figure,
  Forvalg,
  Kloroplast,
  Mitokondrie,
  ORGANELLER,
  Readout,
  Readouts,
  Segmented,
  Toolbar,
  Txt,
  VIZ,
  VizLayout,
  blobPath,
  capsulePath,
  cellInterior,
  organelleLayout,
  roundedRectPath,
  useContainerTextScale,
  type Box,
  type Celletype,
  type OrganelleId,
  type PlacedOrganelle,
} from '../kit';
import { CELLETYPER, DELER, SAMMENLIGNING, defaultPart, hasPart, spreadLabels, type Forekomst } from './model';

const TYPES: { value: Celletype; label: string }[] = [
  { value: 'dyr', label: 'Dyrecelle' },
  { value: 'plante', label: 'Plantecelle' },
  { value: 'bakterie', label: 'Bakteriecelle' },
];

const C_SEL = BIO.signal;

export default function Cellen() {
  const [type, setType] = useState<Celletype>('dyr');
  const [part, setPart] = useState<OrganelleId>('mitokondrie');
  const [ref, f] = useContainerTextScale<HTMLDivElement>();
  const selected = hasPart(type, part) ? part : defaultPart(type);
  const changeType = (t: Celletype) => {
    setType(t);
    if (!hasPart(t, part)) setPart(defaultPart(t));
  };
  const info = CELLETYPER[type];
  const others = (['dyr', 'plante', 'bakterie'] as Celletype[]).filter((t) => t !== type && hasPart(t, selected));

  return (
    <VizLayout>
      <Toolbar>
        <Segmented label="Velg celletype" options={TYPES} value={type} onChange={changeType} />
      </Toolbar>
      <Toolbar>
        <Forvalg
          label="Del"
          options={CELL_PARTS[type].map((id) => ({ value: id, label: ORGANELLER[id].kort }))}
          value={selected}
          onPick={setPart}
        />
      </Toolbar>

      <div ref={ref}>
        <CellFigure type={type} selected={selected} onPick={setPart} f={f} />
      </div>

      <Readouts>
        <Readout label="Valgt del" value={ORGANELLER[selected].navn} tone={C_SEL} />
        <Readout label="Celletype" value={info.gruppe === 'eukaryot' ? 'Eukaryot' : 'Prokaryot'} />
        <Readout label="Typisk størrelse" value={`${info.min}–${info.max}`} unit="µm" />
        <Readout
          label="Finnes også i"
          value={others.length ? others.map((t) => (t === 'dyr' ? 'dyreceller' : t === 'plante' ? 'planteceller' : 'bakterier')).join(' og ') : 'Ingen av de andre'}
        />
      </Readouts>

      <SizeFigure type={type} f={f} />
      <CompareFigure type={type} selected={selected} onPick={setPart} f={f} />

      <Explain>{explanation(type, selected)}</Explain>
    </VizLayout>
  );
}

/* ---------- Cellen med etiketter ---------- */

function cellBox(type: Celletype, narrow: boolean, top: number): Box {
  if (narrow) {
    const w = 720;
    const h = type === 'bakterie' ? 330 : type === 'plante' ? 560 : 540;
    return { x: 40, y: top, w, h };
  }
  if (type === 'bakterie') return { x: 210, y: top + 40, w: 380, h: 190 };
  return { x: 220, y: top, w: 360, h: type === 'plante' ? 300 : 290 };
}

function CellFigure({ type, selected, onPick, f }: { type: Celletype; selected: OrganelleId; onPick: (id: OrganelleId) => void; f: number }) {
  const narrow = f > 1.3;
  const top = narrow ? 30 * f + 26 : 16;
  const box = cellBox(type, narrow, top);
  const layout = organelleLayout(type, box);
  const parts = CELL_PARTS[type];
  const anchor = (id: OrganelleId) => layout.find((p) => p.id === id)!;
  const H = Math.round(narrow ? box.y + box.h + 16 : Math.max(box.y + box.h + 16, 16 + parts.length * 15 + 40));
  const mid = box.x + box.w / 2;
  // Etiketter i to kolonner (PC): venstre for delene til venstre for midten, ellers høyre
  const cols = { left: [] as OrganelleId[], right: [] as OrganelleId[] };
  for (const id of parts) (anchor(id).x < mid ? cols.left : cols.right).push(id);
  const gap = 27 * f;
  const placed = new Map<OrganelleId, number>();
  if (!narrow)
    for (const side of ['left', 'right'] as const) {
      const ids = cols[side];
      const ys = spreadLabels(
        ids.map((id) => anchor(id).y + 5),
        gap,
        22,
        H - 8,
      );
      ids.forEach((id, i) => placed.set(id, ys[i]!));
    }
  const sel = anchor(selected);
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 900 : H}
      label={`${CELLETYPER[type].navn} med ${ORGANELLER[selected].navn.toLowerCase()} fremhevet. Trykk på en del for å velge den.`}
      caption={narrow ? 'Trykk på en del av cellen for å velge den.' : 'Trykk på en del av cellen eller på et navn for å velge den. Ikke i målestokk.'}
    >
      <Cellemodell type={type} x={box.x} y={box.y} w={box.w} h={box.h} highlight={selected} dimOthers />
      <HitAreas type={type} box={box} layout={layout} onPick={onPick} />
      {narrow ? (
        <Etikett x={sel.x} y={sel.y} lx={400} ly={30 * f} anchor="middle" strong color={C_SEL} size={1}>
          {ORGANELLER[selected].navn}
        </Etikett>
      ) : (
        parts.map((id) => {
          const a = anchor(id);
          const left = a.x < mid;
          const on = id === selected;
          return (
            <g key={id} onClick={() => onPick(id)} style={{ cursor: 'pointer' }}>
              <Etikett
                x={a.x}
                y={a.y}
                lx={left ? box.x - 26 : box.x + box.w + 26}
                ly={placed.get(id)!}
                anchor={left ? 'end' : 'start'}
                strong={on}
                color={on ? C_SEL : undefined}
                size={on ? 0.92 : 0.82}
                noDot={!on}
              >
                {ORGANELLER[id].kort}
              </Etikett>
            </g>
          );
        })
      )}
    </Figure>
  );
}

/** Usynlige trykkflater over hver del av cellen. */
function HitAreas({ type, box, layout, onPick }: { type: Celletype; box: Box; layout: PlacedOrganelle[]; onPick: (id: OrganelleId) => void }) {
  const hit = (id: OrganelleId, key: string, el: ReactNode) => (
    <g
      key={key}
      role="button"
      aria-label={ORGANELLER[id].navn}
      tabIndex={-1}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(id);
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') onPick(id);
      }}
    >
      {el}
    </g>
  );
  const inv = { fill: 'transparent', stroke: 'none' } as const;
  const ring = (d: string, w: number) => <path d={d} fill="none" stroke="transparent" strokeWidth={w} style={{ pointerEvents: 'stroke' }} />;
  const out: ReactNode[] = [];
  if (type === 'dyr') {
    const d = blobPath(box.x + box.w / 2, box.y + box.h / 2, box.w / 2 - 4, box.h / 2 - 4, 0.045, 4, 11);
    out.push(hit('cytoplasma', 'cyt', <path d={d} {...inv} />));
    out.push(hit('cellemembran', 'mem', ring(d, 16)));
  } else if (type === 'plante') {
    const inner = cellInterior('plante', box, 1);
    const proto = roundedRectPath(inner.x, inner.y, inner.w, inner.h, 10);
    out.push(hit('cytoplasma', 'cyt', <path d={proto} {...inv} />));
    out.push(hit('cellevegg', 'wall', ring(roundedRectPath(box.x + 3, box.y + 3, box.w - 6, box.h - 6, 14), 12)));
    out.push(hit('cellemembran', 'mem', ring(proto, 10)));
  } else {
    const inner = cellInterior('bakterie', box, 1);
    const gw = inner.w + 12;
    const gh = inner.h + 12;
    const cx = inner.x + inner.w / 2;
    const cy = inner.y + inner.h / 2;
    const cap = Math.min(10, box.h * 0.08);
    out.push(hit('cytoplasma', 'cyt', <path d={capsulePath(cx, cy, gw - 9, gh - 9)} {...inv} />));
    out.push(hit('flagell', 'fla', <rect x={cx + gw / 2 + 2} y={cy - gh * 0.3} width={box.x + box.w - (cx + gw / 2)} height={gh * 0.6} {...inv} />));
    out.push(hit('kapsel', 'cap', ring(capsulePath(cx, cy, gw + 2 * cap, gh + 2 * cap), cap + 6)));
    out.push(hit('cellevegg', 'wall', ring(capsulePath(cx, cy, gw, gh), 8)));
    out.push(hit('cellemembran', 'mem', ring(capsulePath(cx, cy, gw - 9, gh - 9), 7)));
    out.push(
      hit(
        'plasmid',
        'pl2',
        <circle cx={cx + gw * 0.22} cy={cy + gh * 0.2} r={Math.max(10, gh * 0.11)} {...inv} />,
      ),
    );
  }
  layout.forEach((p, i) => {
    if (p.w <= 0 || p.h <= 0) {
      if (p.id === 'ribosomer') out.push(hit(p.id, `r${i}`, <circle cx={p.x} cy={p.y} r={16} {...inv} />));
      return;
    }
    if (['cellemembran', 'cytoplasma', 'cellevegg', 'kapsel', 'flagell'].includes(p.id)) return;
    const rx = p.id === 'vakuole' ? p.w / 2 - 6 : p.w / 2 + 6;
    const ry = p.id === 'vakuole' ? p.h / 2 - 6 : p.h / 2 + 6;
    out.push(
      hit(
        p.id,
        `o${i}`,
        <ellipse cx={p.x} cy={p.y} rx={Math.max(8, rx)} ry={Math.max(8, ry)} transform={p.rotate ? `rotate(${p.rotate} ${p.x} ${p.y})` : undefined} {...inv} />,
      ),
    );
  });
  // Kjernelegemet ligger inne i kjernen: tegnes sist så det kan velges
  const nucleolus = layout.find((p) => p.id === 'kjernelegeme');
  if (nucleolus) out.push(hit('kjernelegeme', 'nl', <circle cx={nucleolus.x} cy={nucleolus.y} r={Math.max(9, nucleolus.w / 2 + 3)} {...inv} />));
  // Vakuolen først (stor), så resten oppå
  return <g>{out}</g>;
}

/* ---------- Størrelsesforhold ---------- */

function SizeFigure({ type, f }: { type: Celletype; f: number }) {
  const k = Math.max(1, f * 0.85);
  // 6,4 figurenheter per µm: plantecellen (50 µm) blir 320 bred
  const s = 6.4;
  const base = 30 + 250;
  const H = Math.round(base + 60 * f + 8);
  const plant = { x: 30, y: base - 40 * s * 0.85, w: 50 * s, h: 40 * s * 0.85 };
  const animal = { x: 420, y: base - 18 * s, w: 20 * s, h: 18 * s };
  const bx = 650;
  const by = base - 6;
  const label = (x: number, name: string, size: string, on: boolean) => (
    <g>
      <Txt x={x} y={base + 26 * f} weight={on ? 700 : 560} color={on ? C_SEL : undefined} size={0.85}>
        {name}
      </Txt>
      <Txt x={x} y={base + 50 * f} muted size={0.8}>
        {size}
      </Txt>
    </g>
  );
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={H}
      label="Plantecelle, dyrecelle og bakterie i riktig størrelsesforhold."
      caption="I riktig størrelsesforhold: en typisk plantecelle (50 µm), dyrecelle (20 µm) og bakterie (2 µm)."
    >
      <Celle type="plante" x={plant.x} y={plant.y} w={plant.w} h={plant.h} vakuole={0.6}>
        <Kloroplast x={plant.x + plant.w * 0.2} y={plant.y + 26} w={40} h={18} grana={2} />
        <Kloroplast x={plant.x + plant.w * 0.75} y={plant.y + plant.h - 26} w={40} h={18} grana={2} />
        <Cellekjerne x={plant.x + plant.w * 0.82} y={plant.y + 34} r={18} kromatin={false} />
      </Celle>
      <Celle type="dyr" x={animal.x} y={animal.y} w={animal.w} h={animal.h}>
        <Cellekjerne x={animal.x + animal.w * 0.5} y={animal.y + animal.h * 0.5} r={22} kromatin={false} />
        <Mitokondrie x={animal.x + animal.w * 0.24} y={animal.y + animal.h * 0.3} w={26} h={12} rotate={60} />
      </Celle>
      <Bakterie x={bx} y={by} size={2 * s} form="stav" title="Bakterie" />
      <circle cx={bx} cy={by} r={18 * k} fill="none" stroke={type === 'bakterie' ? C_SEL : VIZ.muted} strokeWidth={1.5} strokeDasharray="4 4" />
      {label(plant.x + plant.w / 2, 'Plantecelle', 'ca. 50 µm', type === 'plante')}
      {label(animal.x + animal.w / 2, 'Dyrecelle', 'ca. 20 µm', type === 'dyr')}
      {label(bx + (f > 1.3 ? 40 : 0), 'Bakterie', 'ca. 2 µm', type === 'bakterie')}
      {/* Målestokk: 10 µm */}
      <line x1={800 - 30 - 10 * s} x2={800 - 30} y1={28} y2={28} stroke={VIZ.ink} strokeWidth={3} />
      <line x1={800 - 30 - 10 * s} x2={800 - 30 - 10 * s} y1={22} y2={34} stroke={VIZ.ink} strokeWidth={2} />
      <line x1={800 - 30} x2={800 - 30} y1={22} y2={34} stroke={VIZ.ink} strokeWidth={2} />
      <Txt x={800 - 30 - 5 * s} y={28 + 24 * f} size={0.8}>
        10 µm
      </Txt>
    </Figure>
  );
}

/* ---------- Sammenligning ---------- */

const MARK: Record<Forekomst, string> = { ja: 'ja', nei: '–', noen: 'noen' };

function CompareFigure({ type, selected, onPick, f }: { type: Celletype; selected: OrganelleId; onPick: (id: OrganelleId) => void; f: number }) {
  const narrow = f > 1.3;
  const rowH = 30 * f;
  const head = 30 * f + 28 * f;
  const H = Math.round(head + SAMMENLIGNING.length * rowH + 10);
  const labelX = 10;
  const colX: Record<Celletype, number> = narrow ? { dyr: 400, plante: 560, bakterie: 715 } : { dyr: 430, plante: 575, bakterie: 720 };
  const colW = narrow ? 150 : 140;
  const types: Celletype[] = ['dyr', 'plante', 'bakterie'];
  const names: Record<Celletype, string> = { dyr: 'Dyr', plante: 'Plante', bakterie: 'Bakterie' };
  return (
    <Figure
      viewBox={`0 0 800 ${H}`}
      maxHeight={narrow ? 1200 : H}
      label="Sammenligning av hvilke deler dyreceller, planteceller og bakterier har."
      caption="Eukaryote celler (dyr og plante) har cellekjerne og organeller med membran. Prokaryote celler (bakterier) har ikke det."
    >
      <rect x={colX[type] - colW / 2} y={4} width={colW} height={H - 8} rx={10} fill={C_SEL} opacity={0.09} />
      <Txt x={(colX.dyr + colX.plante) / 2} y={22 * f} muted size={0.8}>
        Eukaryote
      </Txt>
      <line x1={colX.dyr - 50} x2={colX.plante + 50} y1={22 * f + 8} y2={22 * f + 8} stroke={VIZ.muted} strokeWidth={1.2} />
      <Txt x={colX.bakterie} y={22 * f} muted size={0.8}>
        Prokaryot
      </Txt>
      {types.map((t) => (
        <Txt key={t} x={colX[t]} y={head - 12} weight={700} size={0.9} color={t === type ? C_SEL : undefined}>
          {names[t]}
        </Txt>
      ))}
      {SAMMENLIGNING.map((row, i) => {
        const y = head + i * rowH;
        const target = row.part[type];
        const on = target === selected;
        return (
          <g key={row.navn} onClick={target ? () => onPick(target) : undefined} style={{ cursor: target ? 'pointer' : undefined }}>
            <rect x={4} y={y} width={792} height={rowH} rx={6} fill={on ? C_SEL : i % 2 ? VIZ.grid : 'transparent'} opacity={on ? 0.16 : 0.35} />
            <Txt x={labelX + 6} y={y + rowH / 2 + 6 * f} anchor="start" size={0.85} weight={on ? 700 : 560}>
              {row.navn}
            </Txt>
            {types.map((t) => {
              const v = row[t];
              return v === 'ja' ? (
                <circle key={t} cx={colX[t]} cy={y + rowH / 2} r={7 * Math.max(1, f * 0.8)} fill={BIO.plante.line} />
              ) : (
                <Txt key={t} x={colX[t]} y={y + rowH / 2 + 6 * f} muted size={0.8}>
                  {MARK[v]}
                </Txt>
              );
            })}
          </g>
        );
      })}
    </Figure>
  );
}

/* ---------- Forklaring ---------- */

function explanation(type: Celletype, id: OrganelleId): ReactNode {
  const d = DELER[id];
  const typeText: Record<Celletype, ReactNode> = {
    dyr: (
      <p>
        <strong>Dyrecellen er eukaryot:</strong> arvestoffet ligger i en cellekjerne, og cellen har organeller med membran rundt (mitokondrier,
        ER, golgiapparat, lysosomer). Den har ikke cellevegg, kloroplaster eller stor vakuole, så den kan endre form, men tåler dårlig å ta
        opp mye vann.
      </p>
    ),
    plante: (
      <p>
        <strong>Plantecellen er også eukaryot.</strong> Den har det meste av det dyrecellen har, og i tillegg cellevegg av cellulose,
        kloroplaster og en stor vakuole (som også gjør mye av jobben lysosomene gjør i dyreceller). Legg merke til at den <em>også</em> har
        mitokondrier: planter lager glukose ved fotosyntese og bruker den i celleåndingen, akkurat som dyr.
      </p>
    ),
    bakterie: (
      <p>
        <strong>Bakterien er prokaryot:</strong> den har ingen cellekjerne og ingen organeller med membran. Arvestoffet ligger fritt i
        cytoplasmaet. Den er også mye mindre: <em>Escherichia coli</em> er ca. 2 µm lang, mens en dyrecelle er 10–30 µm. Men den har
        cellemembran, cytoplasma, ribosomer og DNA, som alle celler.
      </p>
    ),
  };
  return (
    <>
      <p>
        <strong>{ORGANELLER[id].navn}.</strong> {d.struktur} {d.funksjon}
      </p>
      {d.merk && <p>{d.merk}</p>}
      {typeText[type]}
    </>
  );
}
