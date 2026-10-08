export const meta = {
  name: 'kjemi-biologi-kapitler',
  description: 'Finpuss av eksisterende visualiseringer, én ny per kapittel, kontroll, retting og commit (kjemi eller biologi)',
  phases: [
    { title: 'Bygg', detail: 'finpuss av eksisterende og én ny per kapittel' },
    { title: 'Kontroll', detail: 'faglig og visuell kontroll' },
    { title: 'Retting', detail: 'retter funnene per visualisering' },
    { title: 'Avslutning', detail: 'sluttsjekk og commit per kapittel' },
  ],
}

// Kjøres med Workflow({ scriptPath: '/home/user/SmartNotes/docs/workflows/kjemi-biologi-kapittel.js', args }), der args er
// { fag: 'kjemi' | 'biologi', chapters: [kapitler fra kjemi-biologi-katalog.json], scratch, branch, trailers }.
// Ta to–tre kapitler per kjøring. Kjør kit-finpuss.js (og kontroller og commit den) før kapitlene. Se README.md.
if (!args || !args.fag || !args.chapters || !args.scratch || !args.branch || !args.trailers) {
  throw new Error('args må ha fag, chapters, scratch, branch og trailers (se docs/workflows/README.md)')
}
const ROOT = args.root || '/home/user/SmartNotes'
const SCRATCH = args.scratch
const BIN = `${ROOT}/docs/workflows/bin`
const BRANCH = args.branch
const TRAILERS = args.trailers
const FAG = args.fag // 'kjemi' | 'biologi'
const BOOK = FAG === 'kjemi' ? 'Kjemi 1 (Aschehoug, LK20)' : 'Biologi 1 (Bi 1, Gyldendal, LK20)'
const FAGNAVN = FAG === 'kjemi' ? 'kjemi' : 'biologi'

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['ferdig', 'delvis', 'mislyktes'] },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    openIssues: { type: 'string' },
  },
  required: ['id', 'status', 'files', 'summary', 'openIssues'],
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'polish'] },
          what: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'severity', 'what', 'fix'],
      },
    },
  },
  required: ['findings'],
}

function common(ch) {
  const NN = ch.no.padStart(2, '0')
  const DIR = `web/src/viz/${FAG}/kap${NN}`
  const OUT = `${SCRATCH}/${FAG}-kap${NN}`
  return {
    NN,
    DIR,
    OUT,
    text: `Du jobber med de interaktive visualiseringene i SmartNotes (web/src/viz/), faget ${FAGNAVN} (${BOOK}). Eleven vil ha bedre visualiseringer: et realistisk utseende som samtidig er maksimalt lett å forstå, praktiske situasjoner og (der det passer) eksempeloppgaver i eksamensstil. Kvalitet er viktigere enn fart.

KAPITTEL ${ch.no} ${ch.title}. Mappe: ${DIR}/. Delkapitlene i dette faget er ikke bekreftet (bortsett fra kjemi kapittel 1), så nye oppføringer bruker sections: [] (kjemi kapittel 1: velg blant 1.1–1.5 som de eksisterende).

LES FØRST (grundig):
- web/src/viz/README.md: «Illustrert realisme (scene-kit)», «Eksempeloppgaver», «Regler» og hele avsnittet om ${FAG === 'kjemi' ? 'Kjemi' : 'Biologi'} (byggeklosser, farger, konvensjoner, fallgruver).
- Kit-et for faget, web/src/viz/${FAG}/kit/ (finpusset i illustrert stil med kit-finpuss.js før kapitlene). Les JSDoc.
- Scene-kit-et, web/src/viz/kit/scene/ (index.ts og JSDoc i familiefilene). Bruk det for scener og bakgrunner: laboratorium (Rom, Underlag type labbenk, Bord), natur (Himmel, Landskap, Terreng, Vann, Gran, Lauvtre), personer (Person), varme og elektrisitet (lab).
- Skjermbilder av galleriet, eller ta egne: cd ${ROOT}/web && PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port 5173 --galleri alle --themes light --widths 1000 --out ${OUT}/galleri
- web/src/viz/kit/eksempel.tsx og mønsteret web/src/viz/fysikk/kap02/EksSkraplan.tsx (for eksempeloppgaver).
- Alle filene i kapittelmappen din.

ARBEIDSREGLER
- Endre bare filer i ${DIR}/. Ikke endre kit/, ${FAG}/kit/, scene-kit-et, styles, README eller andre kapitler. Mangler en byggekloss, lag den lokalt i kapittelmappa (egen fil, samme stil), og nevn det i rapporten.
- En annen agent kan jobbe i samme kapittelmappe samtidig. Derfor:
  - Nye visualiseringer har modellen i en egen fil, model-<id>.ts, med tester i model-<id>.test.ts.
  - index.ts endres med små, presise Edit-endringer. Les fila rett før.
  - Eksisterende visualiseringer kan bruke og endre model.ts.
- Fag:
  - Hold deg til pensum i ${BOOK} og kompetansemålene (se server/src/textbooks.ts).
  - Begreper og konvensjoner som i README-avsnittet for faget.
  - Faglig riktig først: all regning i rene funksjoner med vitest-tester.
- Språk: bokmål, stor forbokstav bare først, ingen emojier, desimalkomma via fmt eller fmtSig, ekte minus (−).
- Opphavsrett: alt innhold er eget. Kopier aldri ekte eksamens- eller læreboksoppgaver eller figurer.
- Ende-til-ende-testene (e2e/) bruker noen titler og tekster, for eksempel «Syre-base-titrering» i kjemi kapittel 7 og «Vaksiner og flokkimmunitet» i biologi kapittel 15. Sjekk med grep -rn i e2e/ før du endrer en title eller en tekst eleven ser, og la det som testene bruker, stå.
- Verktøy: maskinen deles av mange agenter, så bruk disse.
  - Typesjekk: ${BIN}/tsc-sjekk.sh src/viz/${FAG}/kap${NN}
  - Tester: cd ${ROOT}/web && npx vitest run src/viz/${FAG}/kap${NN}
  - Skjermbilder: ${BIN}/shot.sh --fag ${FAG} --ids k${ch.no}-a,k${ch.no}-b --out ${OUT}/<runde>. Det gir lyst og mørkt tema, i 1000 og 390 px. --extremes setter glidebryterne til min og maks, og --steps gir hvert steg i en eksempeloppgave. Vite kjører på port 5173.
  - Forhåndsvisning: http://localhost:5173/viz-preview.html?fag=${FAG}&id=k${ch.no}-<id>&theme=dark
  - Se på skjermbildene med Read-verktøyet, og vurder dem som en kritisk illustratør og lærer. Fagtemaet (${FAG === 'kjemi' ? '«Tavle», mørkegrønn flate i mørkt tema' : '«Salvie», varmt papir og dempet grønt'}) gjelder i forhåndsvisningen.
- Ikke commit. Et eget steg gjør det.`,
  }
}

function polishPrompt(ch, id) {
  const c = common(ch)
  return `${c.text}

DIN OPPGAVE: visuell finpuss av den eksisterende visualiseringen «${id}» (nøkkel k${ch.no}-${id}) i illustrert stil.
- Behold id-en, læringsmålet, modellen og testene. Rett feil hvis du finner noen.
- Løft utseendet:
  - ekte utstyr og situasjoner der det finnes en scene, for eksempel en labbenk, en innsjø eller et menneske
  - lys og skygge, dempede bakgrunner og tydelige symboler
  - god plass og ingen overlapp
  - lesbart på mobil og i mørkt tema
- Diagrammer, grafer og partikkelbilder kan forbli skjematiske, men skal se gjennomarbeidet ut.
- Legg gjerne til en praktisk kobling til hverdagen i forklaringen hvis den mangler.
- Ikke gjør om på noe som allerede fungerer godt bare for å endre det. Målet er tydelig bedre kvalitet.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - minst to runder med skjermbilder (også --extremes) som du har sett på og rettet etter
Svar med id, status, filer, sammendrag og det som er uløst.`
}

function newPrompt(ch, item) {
  const c = common(ch)
  if (item.kind === 'eksempel') {
    return `${c.text}

DIN OPPGAVE: lag eksempeloppgaven «${item.id}» (nøkkel k${ch.no}-${item.id}, kind: 'eksempel'): ${item.idea}
- Følg «Eksempeloppgaver» i README og mønsteret EksSkraplan.tsx:
  - egen oppgavetekst i eksamensstil med en konkret situasjon
  - 3–5 deloppgaver som blir gradvis vanskeligere
  - 1–3 steg per deloppgave som forklarer hvorfor, med utregning med levende tall og svar
  - tips og vanlige feil
  - en illustrert figur som bygger seg opp
  - gjerne 2–3 tallsett, og test at alle gir fornuftige svar
- Modellen ligger i ${c.DIR}/model-${item.id}.ts med tester.
- Registrer den sist i ${c.DIR}/index.ts med kind: 'eksempel' og en id som starter med eks-.
- Sjekk med --steps at figuren stemmer med hvert steg.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - skjermbilder av alle stegene i lyst og mørkt tema og på mobil, som du har sett på og rettet etter
Svar med id, status, filer, sammendrag og det som er uløst.`
  }
  return `${c.text}

DIN OPPGAVE: lag den nye visualiseringen «${item.id}» (nøkkel k${ch.no}-${item.id}): ${item.idea}
- En praktisk situasjon fra hverdagen som gjør faget konkret.
- Interaktiv: glidebrytere, valg, avspilling eller klikk. Explain endrer seg med tilstanden og retter opp misoppfatninger.
- Illustrert realisme.
- Modellen ligger i ${c.DIR}/model-${item.id}.ts med tester.
- Registrer den i ${c.DIR}/index.ts:
  - god title (stor forbokstav bare først), summary og keywords, med kompetansemål (KMx) som søkeord
  - plassert der den hører hjemme faglig, før eventuelle eksempeloppgaver
- Du kan justere idéen hvis du ser en bedre måte å lære det samme på innenfor pensum. Forklar i så fall hvorfor.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - minst to runder med skjermbilder (også --extremes) som du har sett på og rettet etter
Svar med id, status, filer, sammendrag og det som er uløst.`
}

// Dør en agent (f.eks. bruksgrensen), stopper workflowen, så den kan gjenopptas fra hurtigbufferen med samme args.
function need(r, what) {
  if (r === null || r === undefined) throw new Error(`Avbrutt: ${what} ga ikke noe resultat`)
  return r
}

function chunks(arr, n) {
  const res = []
  for (let i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n))
  return res
}

async function doChapter(ch) {
  const c = common(ch)
  const L = `${FAG[0]}${ch.no}`
  // Bygg: finpuss (sekvensielt) og nye (sekvensielt) parallelt
  const trackA = async () => {
    const out = []
    for (const id of ch.polish) out.push(need(await agent(polishPrompt(ch, id), { label: `finpuss:${L}-${id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `finpuss:${L}-${id}`))
    return out
  }
  const trackB = async () => {
    const out = []
    for (const item of ch.news) out.push(need(await agent(newPrompt(ch, item), { label: `ny:${L}-${item.id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `ny:${L}-${item.id}`))
    return out
  }
  const tracks = await parallel([trackA, trackB])
  if (tracks.some((t) => !t)) throw new Error(`${L}: byggingen ble avbrutt`)
  const built = tracks.flat()
  const reports = JSON.stringify(built, null, 1)
  const allIds = [...ch.polish, ...ch.news.map((n) => n.id)]

  const faglig = (ids) => `${c.text}

DIN OPPGAVE: streng faglig kontroll av ${ids.map((i) => `k${ch.no}-${i}`).join(', ')}. Du er ${FAGNAVN}lærer på VG2 og sensor. Ikke rett noe selv. Lag en liste med funn.
Les koden og testene, og kjør testene. Sjekk:
- at det er faglig riktig (regn etter)
- begreper, konvensjoner og symboler
- at tekst, figur og tall stemmer med hverandre
- at forklaringene retter opp misoppfatninger
- for eksempeloppgaver: eksamensnivå, at oppgaven er original, begrunnede steg, gjeldende siffer og alle tallsettene
- pensum, språk og stor forbokstav bare først
blocking = feil fag, feil tall, misvisende forklaring eller brudd på reglene. polish = konkrete forbedringer.
Byggerapportene: ${reports}`

  const visuell = (ids) => `${c.text}

DIN OPPGAVE: streng visuell kontroll av ${ids.map((i) => `k${ch.no}-${i}`).join(', ')}. Du er en erfaren lærebokillustratør og UX-designer. Ikke rett noe selv. Lag en liste med funn.
Ta skjermbilder: ${BIN}/shot.sh --fag ${FAG} --ids ${ids.map((i) => `k${ch.no}-${i}`).join(',')} --extremes --steps --out ${c.OUT}/visuell-${ids[0]}. Se på hvert bilde. Sjekk:
- realisme og et profesjonelt uttrykk
- tydelighet
- overlapp, og ting som går ut av figuren
- mobil (390 px) og mørkt tema i fagtemaet
- tom plass
- konsistens med resten av faget og scene-kit-galleriet
- NaN og feil i konsollen
blocking = stygt, uleselig, overlapp, feil eller forvirrende. polish = konkrete forbedringer.
Byggerapportene: ${reports}`

  const reviewJobs = []
  for (const ids of chunks(allIds, 5)) reviewJobs.push(() => agent(faglig(ids), { label: `faglig:${L}-${ids[0]}…`, phase: 'Kontroll', schema: FINDINGS_SCHEMA }))
  for (const ids of chunks(allIds, 3)) reviewJobs.push(() => agent(visuell(ids), { label: `visuell:${L}-${ids[0]}…`, phase: 'Kontroll', schema: FINDINGS_SCHEMA }))
  const reviews = await parallel(reviewJobs)
  if (reviews.some((r) => !r)) throw new Error(`${L}: kontrollen ble avbrutt`)
  const findings = reviews.flatMap((r) => r.findings || [])

  const byId = {}
  for (const f of findings) {
    const id = String(f.id).replace(/^k\d+-/, '')
    ;(byId[id] = byId[id] || []).push(f)
  }
  for (const id of Object.keys(byId)) {
    const fixed = await agent(
      `${c.text}

DIN OPPGAVE: rett funnene fra kontrollen av «${id}» (nøkkel k${ch.no}-${id}).
- Rett alle blokkerende funn.
- Rett også forbedringene som gjør resultatet tydelig bedre. Begrunn kort de du lar være.
- Kontrollørene kan ta feil: er du sikker på at et funn er feil, så forklar hvorfor i stedet for å rette.
- Kjør typesjekk og tester, og ta nye skjermbilder (--extremes, og --steps for eksempeloppgaver) til alt er i orden.
Funn: ${JSON.stringify(byId[id], null, 1)}
Svar kort med hva du rettet og hva du lot være.`,
      { label: `rett:${L}-${id}`, phase: 'Retting' },
    )
    need(fixed, `rett:${L}-${id}`)
  }

  const final = await agent(
    `${c.text}

DIN OPPGAVE: sluttsjekk av ${FAGNAVN} kapittel ${ch.no} før commit.
1. Kjør typesjekk og testene for kapittelet, og rett feil i kapittelmappa.
2. Ta skjermbilder: ${BIN}/shot.sh --fag ${FAG} --chapter ${ch.no} --extremes --out ${c.OUT}/slutt. Det skal ikke være noen FEIL (konsollfeil, NaN eller sidelengs scrolling). Rett tydelige feil.
3. Sjekk at rekkefølgen i index.ts er fornuftig og at det ikke ligger løse filer igjen.
4. Commit kapittelet, bare din mappe. Andre kapitler committer kanskje samtidig, så prøv på nytt med noen sekunders pause ved låsfeil (index.lock). Bruk nøyaktig denne meldingen (tittel, tom linje, signaturlinjene), for eksempel med git commit -F og en heredoc:
-----
${FAG === 'kjemi' ? 'Kjemi' : 'Biologi'} kapittel ${ch.no}: finpuss i illustrert stil og ny visualisering

${TRAILERS}
-----
   cd ${ROOT} && git add ${c.DIR} && git commit -F <fil eller heredoc> -- ${c.DIR}
   for i in 1 2 3 4; do git push -q origin ${BRANCH} && break; sleep $((2**i)); done
Svar med en kort rapport på bokmål: hva som er nytt og finpusset, hva som ble rettet og hva som er usikkert.`,
    { label: `slutt:${L}`, phase: 'Avslutning' },
  )
  need(final, `slutt:${L}`)
  return { chapter: ch.no, built: built.map((b) => ({ id: b.id, status: b.status })), findings: findings.length, final }
}

const results = await pipeline(args.chapters, (ch) => doChapter(ch))
return { fag: FAG, results }
