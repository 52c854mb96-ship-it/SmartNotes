export const meta = {
  name: 'kjemi-biologi-kit-finpuss',
  description: 'Finpuss av kjemi- og biologi-kit-et i illustrert stil uten å endre API-ene',
  phases: [
    { title: 'Bygg', detail: 'én agent per kit' },
    { title: 'Kontroll', detail: 'visuell kontroll og regresjonssjekk av alle visualiseringene i faget' },
    { title: 'Retting', detail: 'retter funnene' },
  ],
}

// Kjøres med Workflow({ scriptPath: '/home/user/SmartNotes/docs/workflows/kit-finpuss.js', args: { scratch } }) før
// kjemi- og biologikapitlene. Den committer ikke: hovedøkten ser over skjermbildene, kjører testene og committer selv.
if (!args || !args.scratch) throw new Error('args må ha scratch (se docs/workflows/README.md)')
const ROOT = args.root || '/home/user/SmartNotes'
const SCRATCH = args.scratch
const BIN = `${ROOT}/docs/workflows/bin`

const KITS = {
  kjemi: {
    files: 'web/src/viz/kjemi/kit/ (særlig beger.tsx med Begerglass, Erlenmeyerkolbe, Byrette og Partikler, molekyl.tsx med Atom, Bond, VseprMolecule, ElectronShells og WaterMolecule, colors.ts og kjemiens del av styles/viz.css med --kj-*)',
    goal: `Laboratorieutstyret skal se ut som ekte glassutstyr: tykkelse i glasset, refleks, menisk, skala med streker og tall, væske med dybde og lys, og en tydelig stativklemme på byretten. Atomene skal se ut som skyggelagte kuler (radiell toning med lys fra øvre venstre), og bindingene skal ha volum. Elektronskall og partikler skal være rene og tydelige. Fargene (CPK, indikatorer) skal beholde betydningen.`,
    fag: 'kjemi',
    chapters: '1–8',
  },
  biologi: {
    files: 'web/src/viz/biologi/kit/ (celle.tsx med Celle, organellene og Cellemodell, membran.tsx, kromosom.tsx, organismer.tsx med Bakterie, Virus, Sopp, Plante, Tre, Fisk, Fugl, Pattedyr, Insekt, Menneske, blodlegemer og Antistoff, colors.ts og biologiens del av styles/viz.css med --bio-*)',
    goal: `Cellene og organellene skal se ut som gode lærebokillustrasjoner: myk dybde (toninger), lys og skygge, membraner med volum og tydelige men rolige konturer. Organismene (bakterier, virus, dyr, planter, mennesker, blodlegemer) skal bli mer realistiske og pene, men fortsatt enkle og gjenkjennelige i små størrelser. Fargene skal beholde betydningen (BIO-paletten).`,
    fag: 'biologi',
    chapters: '1–15',
  },
}

const COMMON = (k) => `Du forbedrer utseendet til byggeklossene i ${k.files} i SmartNotes. Eleven vil at alle visualiseringene skal få «illustrert realisme»: realistisk utseende som samtidig er maksimalt lett å forstå. Les web/src/viz/README.md, både «Illustrert realisme (scene-kit)» og avsnittet om ${k.fag === 'kjemi' ? 'Kjemi' : 'Biologi'}. Les også web/src/viz/kit/scene/core.tsx og palette.ts, som har toninger, skygger, shade/tint og fargesett du kan bruke. Se scene-kit-galleriet for stilen: cd ${ROOT}/web && PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port 5173 --galleri mekanikk --themes light --widths 1000 --out ${SCRATCH}/kit-${k.fag}/galleri (og --galleri bakgrunn).

MÅL: ${k.goal}

REGLER
- API-ene skal ikke endres: ingen props fjernes eller får ny betydning, og ingen eksporterte navn forsvinner. Nye valgfrie props er greit. Alle ${k.fag}visualiseringene (kapittel ${k.chapters}) bruker kit-et og må fortsatt se riktige ut, med samme plassering og størrelse, så etiketter og piler fortsatt treffer.
- Bare filene i ${k.files}. Endre ikke kapittelmappene, og ikke andre fag.
  - styles/viz.css: endre bare variabler og klasser med prefikset til faget (--${k.fag === 'kjemi' ? 'kj' : 'bio'}-*, .${k.fag === 'kjemi' ? 'kj' : 'bio'}-*). Kit-agenten for det andre faget endrer viz.css samtidig, i sin egen del. Bruk derfor bare små Edit-endringer, les fila rett før hver endring, og skriv aldri hele fila med Write. Legg helst ny CSS i en egen fil i kit-mappa.
- Farger fra CSS-variabler, så både lyst og mørkt tema og fagtemaet virker. Ingen SVG-filtre og ingen <image>. Ytelsen må holde, siden partikler og celler animeres med mange elementer.
- Mobil: sjekk 390 px.
- Ikke commit.

VERKTØY
- Typesjekk: ${BIN}/tsc-sjekk.sh src/viz/${k.fag}
- Tester: cd ${ROOT}/web && npx vitest run src/viz/${k.fag}
- Skjermbilder av hele faget før og etter (regresjon): ${BIN}/shot.sh --fag ${k.fag} --themes light,dark --widths 1000 --out ${SCRATCH}/kit-${k.fag}/<runde>. Én kapittel om gangen går fortere: --chapter N. Ta også 390 px for et utvalg.
- Ta FØR-bilder av hele faget før du endrer noe, så du kan sammenligne.`

const SCHEMA = {
  type: 'object',
  properties: {
    changed: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    risks: { type: 'string' },
  },
  required: ['changed', 'summary', 'risks'],
}
const REVIEW = {
  type: 'object',
  properties: {
    blocking: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['what', 'where', 'fix'] } },
    polish: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['what', 'where', 'fix'] } },
  },
  required: ['blocking', 'polish'],
}

// Dør en agent (f.eks. bruksgrensen), stopper workflowen, så den kan gjenopptas fra hurtigbufferen med samme args.
function need(r, what) {
  if (r === null || r === undefined) throw new Error(`Avbrutt: ${what} ga ikke noe resultat`)
  return r
}

const results = await pipeline(
  ['kjemi', 'biologi'],
  async (fag) => need(await agent(`${COMMON(KITS[fag])}\n\nGjør finpussen. Jobb komponent for komponent og ta skjermbilder underveis. Svar med endrede komponenter, et sammendrag og en vurdering av risiko for regresjoner.`, { label: `kit:${fag}`, phase: 'Bygg', schema: SCHEMA }), `kit:${fag}`),
  (built, fag) =>
    agent(
      `${COMMON(KITS[fag])}\n\nDIN OPPGAVE: streng kontroll av finpussen som nettopp er gjort (rapport: ${JSON.stringify(built)}). Ikke rett noe selv. Ta skjermbilder av ALLE ${fag}visualiseringene i lyst og mørkt tema (1000 px), og et utvalg i 390 px. Se gjennom dem. Sjekk:\n- regresjoner: ting som har flyttet seg, overlapper, er borte eller har feil farge\n- om resultatet faktisk er realistisk og pent\n- at API-et er uendret (les git diff for kit-filene)\n- ytelse: antall elementer i partikkelbilder\nblocking = regresjon, stygt eller feil. polish = konkrete forbedringer.`,
      { label: `kontroll:${fag}`, phase: 'Kontroll', schema: REVIEW },
    ).then((review) => ({ built, review: need(review, `kontroll:${fag}`) })),
  (prev, fag) =>
    prev.review.blocking.length === 0 && prev.review.polish.length === 0
      ? prev
      : agent(
          `${COMMON(KITS[fag])}\n\nDIN OPPGAVE: rett funnene fra kontrollen av finpussen.\n- Rett alle blokkerende funn og de forbedringene som gjør resultatet tydelig bedre.\n- Ta nye skjermbilder av hele faget som regresjonssjekk.\nFunn: ${JSON.stringify(prev.review, null, 1)}\nSvar kort.`,
          { label: `retting:${fag}`, phase: 'Retting' },
        ).then((fixed) => ({ ...prev, fixed: need(fixed, `retting:${fag}`) })),
)
const failed = ['kjemi', 'biologi'].filter((fag, i) => !results[i])
if (failed.length) throw new Error(`Avbrutt: kit-finpussen ble ikke ferdig for ${failed.join(' og ')}. Gjenoppta med samme args.`)
return results
