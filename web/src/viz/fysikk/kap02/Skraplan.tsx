import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Controls,
  Explain,
  Formula,
  FormulaLine,
  Legend,
  PlayControls,
  Readout,
  Readouts,
  Segmented,
  Slider,
  Sub,
  Toggle,
  Toolbar,
  VIZ,
  VizLayout,
  fmt,
  useSimClock,
} from '../../kit';
import { criticalAngleDeg, incline } from './model';
import { BLOCK_MATERIALS, TILT_RUN, blockSize, slideRoom, tiltEnd, tiltState, type BlockMaterial } from './model-skraplan';
import { ForceGraph } from './skraplan-graf';
import { SkraplanScene } from './skraplan-scene';

const RAD = Math.PI / 180;
const ALPHA_MAX = TILT_RUN.alphaMaxDeg;
/** Avspillingen varer høyst så lenge (s). Med μs ≤ 1 glir klossen før 46°, og har glidd SLIDE_MAX før ca. 10 s. */
const T_MAX = 16;
/** Avspillingen stopper når klossen har glidd så langt (m), før den kommer ned til gradskiva og stoppeklossen. */
const SLIDE_MAX = 0.25;

const MATERIALS: BlockMaterial[] = ['tre', 'metall', 'gummi', 'is'];
const MATERIAL_NAME: Record<BlockMaterial, string> = { tre: 'Tre', metall: 'Aluminium', gummi: 'Gummi', is: 'Is' };
/** Klossen i teksten: «en trekloss på …». */
const BLOCK_NAME: Record<BlockMaterial, string> = { tre: 'en trekloss', metall: 'en aluminiumskloss', gummi: 'en gummikloss', is: 'en isblokk' };
const BLOCK_NAME_DEF: Record<BlockMaterial, string> = { tre: 'Treklossen', metall: 'Aluminiumsklossen', gummi: 'Gummiklossen', is: 'Isblokken' };

interface State {
  alpha: number;
  m: number;
  muS: number;
  muK: number;
  material: BlockMaterial;
}

export default function Skraplan() {
  const [s, setS] = useState<State>({ alpha: 20, m: 4, ...pick(BLOCK_MATERIALS.tre), material: 'tre' });
  const [showForces, setShowForces] = useState(true);
  const [parts, setParts] = useState(true);

  // Forsøket: planken løftes 6° i sekundet fra vannrett til klossen glir, og klossen glir ned til stoppeklossen.
  const size = blockSize(s.m, s.material);
  const room = Math.min(SLIDE_MAX, slideRoom(size.length));
  const input = { m: s.m, muS: s.muS, muK: s.muK };
  const tEnd = useMemo(() => tiltEnd({ m: s.m, muS: s.muS, muK: s.muK }, TILT_RUN, room, T_MAX), [s.m, s.muS, s.muK, room]);
  const clock = useSimClock({ tMax: tEnd });
  const p = clock.t > 0 ? tiltState(input, TILT_RUN, clock.t) : null;

  // Forsøket starter med vannrett planke, så «Start på nytt» går tilbake dit.
  useEffect(() => {
    if (clock.playing) setS((prev) => (prev.alpha === 0 ? prev : { ...prev, alpha: 0 }));
  }, [clock.playing]);

  const alpha = p ? p.alphaDeg : s.alpha;
  const base = incline({ alphaDeg: alpha, m: s.m, muS: s.muS, muK: s.muK });
  const r = p ? { ...base, moving: p.moving, R: p.R, a: p.a } : base;
  const crit = criticalAngleDeg(s.muS);
  const kinetic = criticalAngleDeg(Math.min(s.muK, s.muS));
  const slide = p ? Math.min(p.s, room) : 0;
  const dA = p ? 1 : 0;
  const aText = fmt(alpha, dA);

  // En glidebryter eller en ny kloss stopper avspillingen og tar med seg vinkelen derfra.
  const update = (patch: Partial<State>) => {
    const cur = Math.round(alpha);
    clock.reset();
    setS((prev) => {
      const next = { ...prev, alpha: cur, ...patch };
      // μk ≤ μs: den som flyttes, dytter den andre.
      if (patch.muS !== undefined) next.muK = Math.min(next.muK, next.muS);
      if (patch.muK !== undefined) next.muS = Math.max(next.muS, next.muK);
      return next;
    });
  };

  const preset = BLOCK_MATERIALS[s.material];
  const custom = Math.abs(preset.muS - s.muS) > 1e-9 || Math.abs(preset.muK - s.muK) > 1e-9;
  const status = r.moving ? (p ? `Klossen glir, v = ${fmt(p.v, 2)} m/s` : 'Klossen glir nedover') : 'Klossen ligger i ro';

  return (
    <VizLayout>
      <Controls>
        <Slider label="Vinkel α" value={alpha} onChange={(a) => update({ alpha: a })} min={0} max={ALPHA_MAX} step={1} format={(v) => `${fmt(v, 0)}°`} />
        <Slider label="Masse m" value={s.m} onChange={(m) => update({ m })} min={1} max={10} step={0.5} unit="kg" decimals={1} />
        <Slider
          label={
            <>
              Statisk friksjonstall μ<Sub>s</Sub>
            </>
          }
          ariaLabel="Statisk friksjonstall"
          value={s.muS}
          onChange={(muS) => update({ muS })}
          min={0}
          max={1}
          step={0.05}
          decimals={2}
        />
        <Slider
          label={
            <>
              Glidefriksjonstall μ<Sub>k</Sub>
            </>
          }
          ariaLabel="Glidefriksjonstall"
          value={s.muK}
          onChange={(muK) => update({ muK })}
          min={0}
          max={1}
          step={0.05}
          decimals={2}
        />
      </Controls>
      <Toolbar>
        <Segmented
          label="Velg kloss"
          options={MATERIALS.map((k) => ({ value: k, label: MATERIAL_NAME[k] }))}
          value={s.material}
          onChange={(material) => update({ material, ...pick(BLOCK_MATERIALS[material]) })}
        />
        <PlayControls clock={clock} decimals={1} />
      </Toolbar>
      <Toolbar>
        <Toggle label="Vis krefter" checked={showForces} onChange={setShowForces} />
        <Toggle label="Vis komponentene av G" checked={parts} onChange={setParts} />
      </Toolbar>

      <SkraplanScene
        alphaDeg={alpha}
        material={s.material}
        m={s.m}
        size={size}
        slide={slide}
        f={r}
        showForces={showForces}
        parts={parts}
        status={status}
        label={`${cap(BLOCK_NAME[s.material])} på ${fmt(s.m, 1)} kg på en planke som er løftet til ${aText} grader. ${
          r.moving ? 'Klossen glir nedover.' : 'Klossen ligger i ro.'
        }`}
      />

      <ForceGraph alpha={alpha} G={r.G} R={r.R} moving={r.moving} muS={s.muS} muK={s.muK} crit={crit} alphaMax={ALPHA_MAX} />
      <Legend
        items={[
          {
            color: VIZ.gravity,
            label: (
              <span>
                G<Sub>∥</Sub> = G · sin α
              </span>
            ),
          },
          { color: VIZ.friction, label: 'Friksjon R når klossen slippes i ro' },
          {
            color: VIZ.friction,
            dashed: true,
            label: (
              <span>
                Største statiske friksjon μ<Sub>s</Sub>N
              </span>
            ),
          },
        ]}
      />

      <Readouts>
        <Readout label="Normalkraft N = G · cos α" value={fmt(r.N, 1)} unit="N" tone={VIZ.normal} />
        <Readout
          label={
            <>
              G<Sub>∥</Sub> = G · sin α
            </>
          }
          value={fmt(r.Gpar, 1)}
          unit="N"
          tone={VIZ.gravity}
        />
        <Readout
          label={
            r.moving ? (
              <>
                Glidefriksjon R = μ<Sub>k</Sub>N
              </>
            ) : (
              <>
                Statisk friksjon R = G<Sub>∥</Sub>
              </>
            )
          }
          value={fmt(r.R, 1)}
          unit="N"
          tone={VIZ.friction}
        />
        <Readout label="Akselerasjon a" value={fmt(r.a, 2)} unit="m/s²" tone={VIZ.acceleration} />
      </Readouts>

      <Formula label="Utregning">
        <FormulaLine>
          G<Sub>∥</Sub> = G · sin α = {fmt(r.G, 1)} N · sin {aText}° = {fmt(r.Gpar, 1)} N
        </FormulaLine>
        <FormulaLine>
          N = G<Sub>⊥</Sub> = G · cos α = {fmt(r.G, 1)} N · cos {aText}° = {fmt(r.N, 1)} N
        </FormulaLine>
        {r.moving ? (
          <FormulaLine>
            a = g(sin α − μ<Sub>k</Sub> cos α) = 9,81 m/s² · (sin {aText}° − {fmt(Math.min(s.muK, s.muS), 2)} · cos {aText}°) = {fmt(r.a, 2)}{' '}
            m/s²
          </FormulaLine>
        ) : (
          <FormulaLine>
            R = G<Sub>∥</Sub> = {fmt(r.R, 1)} N ≤ μ<Sub>s</Sub>N = {fmt(r.Rmax, 1)} N
          </FormulaLine>
        )}
      </Formula>

      <Explain>
        {p !== null ? (
          r.moving ? (
            <p>
              <strong>Klossen glir.</strong>{' '}
              {crit < 0.05 ? (
                <>Uten statisk friksjon er det ingenting som holder klossen igjen, så den begynte å gli med en gang planken ble løftet.</>
              ) : (
                <>
                  Den begynte å gli ved {fmt(crit, 1)}°, der G<Sub>∥</Sub> ble større enn den største statiske friksjonen μ<Sub>s</Sub>N, altså der
                  tan α = μ<Sub>s</Sub>.
                </>
              )}{' '}
              Planken ble løftet{' '}
              {fmt(TILT_RUN.reactionDeg, 0)}° til før du stoppet, og nå virker glidefriksjonen R = μ<Sub>k</Sub>N = {fmt(r.R, 1)} N. Kraftsummen
              langs planken gir a = g(sin α − μ<Sub>k</Sub> cos α) = {fmt(r.a, 2)} m/s², så farten øker hele veien ned
              {p.v > 0 ? <> (nå {fmt(p.v, 2)} m/s)</> : null}. Slik måler man μ<Sub>s</Sub> i laben: les av vinkelen der klossen begynner å gli,
              og regn ut μ<Sub>s</Sub> = tan α.
            </p>
          ) : (
            <p>
              <strong>Planken løftes {fmt(TILT_RUN.omegaDeg, 0)}° i sekundet.</strong> Klossen ligger i ro, fordi den statiske friksjonen
              vokser i takt med G<Sub>∥</Sub>: R = G<Sub>∥</Sub> = {fmt(r.R, 1)} N. Men den kan ikke bli større enn μ<Sub>s</Sub>N ={' '}
              {fmt(r.Rmax, 1)} N, og μ<Sub>s</Sub>N blir mindre jo brattere planken er. Ved grensevinkelen {fmt(crit, 1)}° tar G<Sub>∥</Sub>{' '}
              igjen, og klossen begynner å gli.
            </p>
          )
        ) : s.alpha === 0 ? (
          <p>
            <strong>Planken ligger vannrett.</strong> Tyngden har ingen komponent langs planken, så det trengs ingen friksjon for å holde
            klossen i ro, og N = G = {fmt(r.G, 1)} N. Øk vinkelen, eller trykk «Spill av» for å løfte planken jevnt, og se hvordan G
            <Sub>∥</Sub> vokser mens N blir mindre.
          </p>
        ) : r.moving ? (
          <p>
            <strong>Klossen glir.</strong> G<Sub>∥</Sub> = {fmt(r.Gpar, 1)} N er større enn den største statiske friksjonen μ<Sub>s</Sub>N ={' '}
            {fmt(r.Rmax, 1)} N, fordi tan α = {fmt(Math.tan(alpha * RAD), 2)} er større enn μ<Sub>s</Sub> = {fmt(s.muS, 2)}. Nå virker
            glidefriksjonen R = μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N, og kraftsummen langs planken gir a = g(sin α − μ<Sub>k</Sub> cos α) ={' '}
            {fmt(r.a, 2)} m/s². Massen forkortes bort, så en tung og en lett kloss av samme materiale får samme akselerasjon.
          </p>
        ) : (
          <p>
            <strong>Klossen ligger i ro.</strong> Den statiske friksjonen er like stor som G<Sub>∥</Sub> = {fmt(r.Gpar, 1)} N, så kraftsummen
            er null, og normalkraften N = G<Sub>⊥</Sub> = {fmt(r.N, 1)} N er mindre enn G = {fmt(r.G, 1)} N. Klossen begynner å gli over
            grensevinkelen {fmt(crit, 1)}°, der tan α = μ<Sub>s</Sub>.
            {alpha > kinetic + 1e-9 && (
              <>
                {' '}
                Gir du den et lite dytt nå, fortsetter den å gli, fordi glidefriksjonen μ<Sub>k</Sub>N = {fmt(r.Rk, 1)} N er mindre enn G
                <Sub>∥</Sub>.
              </>
            )}
          </p>
        )}
        <p>
          {custom ? (
            <>
              Du har endret friksjonstallene. For {BLOCK_NAME[s.material]} på en tørr treplanke er typiske verdier μ<Sub>s</Sub> ≈{' '}
              {fmt(preset.muS, 2)} og μ<Sub>k</Sub> ≈ {fmt(preset.muK, 2)}.
            </>
          ) : (
            <>
              {BLOCK_NAME_DEF[s.material]} på den tørre treplanken har typisk μ<Sub>s</Sub> ≈ {fmt(preset.muS, 2)} og μ<Sub>k</Sub> ≈{' '}
              {fmt(preset.muK, 2)}, så den begynner å gli ved ca. {fmt(criticalAngleDeg(preset.muS), 0)}°. {PRACTICAL[s.material]}
            </>
          )}
        </p>
        {showForces && parts && alpha > 0 && (
          <p>
            De stiplete pilene er bare G delt opp langs og vinkelrett på planken, ikke nye krefter: regn med enten G eller G<Sub>∥</Sub> og G
            <Sub>⊥</Sub>, aldri begge. I ro er R like lang som G<Sub>∥</Sub> og N like lang som G<Sub>⊥</Sub>, så kreftene opphever hverandre.
          </p>
        )}
      </Explain>
    </VizLayout>
  );
}

/** En kort praktisk kobling for hver kloss. */
const PRACTICAL: Record<BlockMaterial, ReactNode> = {
  tre: (
    <>
      Det er derfor en haug med kløyvd ved raser ut hvis sidene blir brattere enn omtrent 25–30°: da glir ved mot ved, og den statiske
      friksjonen klarer ikke lenger å holde igjen.
    </>
  ),
  metall: (
    <>
      Aluminium mot tre glir lettere enn tre mot tre. Det er derfor en metallboks fort sklir av en skrå hylle eller et panser, mens en trekloss
      blir liggende.
    </>
  ),
  gummi: (
    <>
      Gummi har stort friksjonstall. Det er derfor sko har gummisåler, og hvorfor en sklisikker gummimatte holder mobilen på plass på dashbordet
      i en bratt bakke.
    </>
  ),
  is: (
    <>
      Våt is er svært glatt. Det er derfor snø og is kan skli av et tak som bare er litt bratt, og hvorfor en isbit sklir av en skjærefjøl du så
      vidt løfter i den ene enden.
    </>
  ),
};

function pick({ muS, muK }: { muS: number; muK: number }) {
  return { muS, muK };
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
