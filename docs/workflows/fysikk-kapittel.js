export const meta = {
  name: 'fysikk-kapittel-slank',
  description: 'Oppgrader, lag nye visualiseringer og eksempeloppgaver, kontroller og rett for ett fysikkapittel',
  phases: [
    { title: 'Bygg', detail: 'to spor: oppgradering av eksisterende, og nye visualiseringer + eksempeloppgaver' },
    { title: 'Kontroll', detail: 'faglig og visuell kontroll i mindre bunker' },
    { title: 'Retting', detail: 'retter funnene per visualisering' },
    { title: 'Avslutning', detail: 'sluttsjekk av hele kapittelet og commit' },
  ],
}

// Kjøres med Workflow({ scriptPath: '/home/user/SmartNotes/docs/workflows/fysikk-kapittel.js', args }), der args er
// { chapter: <ett kapittel fra fysikk-katalog.json>, scratch, branch, trailers }. Se docs/workflows/README.md.
if (!args || !args.chapter || !args.scratch || !args.branch || !args.trailers) {
  throw new Error('args må ha chapter, scratch, branch og trailers (se docs/workflows/README.md)')
}
const ROOT = args.root || '/home/user/SmartNotes'
const SCRATCH = args.scratch
const BIN = `${ROOT}/docs/workflows/bin`
const BRANCH = args.branch
const TRAILERS = args.trailers

const CH = args.chapter
const NN = CH.no.padStart(2, '0')
const DIR = `web/src/viz/fysikk/kap${NN}`
const SECTIONS = CH.sections.map((s) => `${s.code} ${s.title}`).join(', ')
const OUT = `${SCRATCH}/fysikk-kap${NN}`

const COMMON = `Du jobber med de interaktive visualiseringene i SmartNotes (web/src/viz/), faget fysikk (ERGO Fysikk 1, LK20). Eleven vil ha flere og bedre visualiseringer: praktiske situasjoner fra hverdagen, eksempeloppgaver i eksamensstil og et realistisk utseende som samtidig er maksimalt lett å forstå. Dette er den delen av appen eleven skal bruke mest, fordi den ikke koster penger å bruke. Kvalitet er viktigere enn fart.

KAPITTEL ${CH.no} ${CH.title}. Delkapitler: ${SECTIONS}. Mappe: ${DIR}/.

LES FØRST (og spar på lesingen, bruksgrensen er knapp):
- web/src/viz/README.md, særlig «Illustrert realisme (scene-kit)», «Eksempeloppgaver», «Oppbygning av én visualisering» og «Regler».
- web/src/viz/kit/scene/API.md: kort oversikt over alt i scene-kit-et. Les bare kildefila (JSDoc og props) for de komponentene du faktisk bruker. Ikke les hele familiefilene.
- Galleriet: se bare bildet av familien du trenger, i ${SCRATCH}/galleri-alle/ (galleri-<familie>-light-1000.png). Finnes de ikke, lag dem: cd ${ROOT}/web && PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port 5173 --galleri alle --themes light --widths 1000 --out ${SCRATCH}/galleri-alle
- Mønstre: web/src/viz/kit/eksempel.tsx og web/src/viz/fysikk/kap02/EksSkraplan.tsx (bare for eksempeloppgaver). Gjerne én ferdig oppgradert visualisering i kap01–kap04 for å se stilen.
- Filene i kapittelmappen din som oppgaven gjelder.

ARBEIDSREGLER
- Endre bare filer i ${DIR}/. Ikke endre kit/, scene-kit-et, styles, README eller andre kapitler. Mangler noe i scene-kit-et, lag det lokalt i kapittelmappa (egen fil, samme stil: toninger fra core.tsx, SCENE-farger, kontur, myk skygge), og nevn det i rapporten.
- En annen agent kan jobbe i samme kapittelmappe samtidig (oppgraderingene og de nye visualiseringene går parallelt). Derfor:
  - Nye visualiseringer og eksempeloppgaver har modellen i en egen fil, model-<id>.ts, med tester i model-<id>.test.ts. De bruker ikke model.ts.
  - index.ts endres med små, presise Edit-endringer. Les fila rett før du endrer den.
  - Eksisterende visualiseringer kan bruke og endre model.ts og model.test.ts.
- Fag:
  - Hold deg til pensum i ERGO Fysikk 1 (LK20) og delkapitlene over. Ikke ta inn Fysikk 2-stoff (sirkelbevegelse, bevegelsesmengde i to dimensjoner, induksjon, fotoelektrisk effekt, relativitetsteori, kvantefysikk utover Bohrs modell).
  - Konstanter som i boka: g = 9,81 m/s², c = 3,00 · 10⁸ m/s, h = 6,63 · 10⁻³⁴ J s, e = 1,60 · 10⁻¹⁹ C, u = 1,66 · 10⁻²⁷ kg.
  - Symbolene står i README.
- Fysikken skal være riktig: all regning i rene funksjoner med vitest-tester (kjente verdier, grensetilfeller, bevaringslover og alle tallsett).
- Språk: bokmål, stor forbokstav bare først (aldri bare store bokstaver), ingen emojier. Desimalkomma via fmt(), ekte minus (−) og mellomrom før enhet.
- Opphavsrett: eksempeloppgaver og situasjoner er egne, med egen tekst og egne tall. Kopier aldri ekte eksamens- eller læreboksoppgaver, og gjenfortell dem heller ikke.
- Ende-til-ende-testene (e2e/) bruker noen titler og tekster i visualiseringene. Sjekk med grep -rn i e2e/ før du endrer en title eller en tekst eleven ser, og la det som testene bruker, stå.
- Verktøy: maskinen deles av mange agenter, så bruk disse i stedet for å kjøre tsc og Playwright direkte.
  - Typesjekk: ${BIN}/tsc-sjekk.sh src/viz/fysikk/kap${NN}
  - Tester: cd ${ROOT}/web && npx vitest run src/viz/fysikk/kap${NN}
  - Skjermbilder: ${BIN}/shot.sh --ids k${CH.no}-a,k${CH.no}-b --out ${OUT}/<navn-på-runde>. Det gir lyst og mørkt tema, i 1000 og 390 px. --extremes setter glidebryterne til min og maks, og --steps gir hvert steg i en eksempeloppgave. Vite kjører på port 5173.
  - Forhåndsvisning i nettleseren: http://localhost:5173/viz-preview.html?id=k${CH.no}-<id>&theme=dark
  - Se på skjermbildene med Read-verktøyet, og vurder dem som en kritisk illustratør og lærer: Ser det ekte og profesjonelt ut? Er det lett å forstå? Synes pilene? Overlapper noe på mobil? Fungerer mørkt tema?
- Ikke commit. Et eget steg gjør det.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['ferdig', 'delvis', 'mislyktes'] },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: 'Hva visualiseringen/oppgaven nå viser og hva som er nytt' },
    openIssues: { type: 'string', description: 'Det som ikke ble bra nok eller må sjekkes, ellers tom' },
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
          id: { type: 'string', description: 'id-en i index.ts (uten k-prefiks), f.eks. friksjon eller eks-trinse' },
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

function upgradePrompt(item) {
  return `${COMMON}

DIN OPPGAVE: oppgrader den eksisterende visualiseringen «${item.id}» (nøkkel k${CH.no}-${item.id}) til illustrert realisme.${item.hint ? `\nIdé fra hovedagenten: ${item.hint}` : ''}
- Behold id-en, læringsmålet og fysikken (modellen og testene). Rett feil hvis du finner noen.
- Tegn scenen på nytt med scene-kit-et:
  - en ekte, gjenkjennelig situasjon, gjerne hverdagslig og norsk
  - riktige proporsjoner etter én skala px/m
  - en dempet scene med tydelige VIZ-piler, mål og verdiskilt oppå
  - en bryter «Vis krefter» der scenen ellers blir rotete
- Grafer og diagrammer forblir diagrammer, men skal se gjennomarbeidet ut og henge visuelt sammen med scenen.
- Oppdater forklaringstekstene, title (bare hvis det trengs), summary og keywords så de passer scenen. Legg gjerne til en kort praktisk kobling i Explain («Det er derfor …»).
- Ingen funksjonalitet skal forsvinne, og avspilling og interaktivitet skal virke som før eller bedre.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - minst to runder med skjermbilder (også --extremes) som du har sett på og rettet etter
  - det ser profesjonelt ut i lyst og mørkt tema og på mobil
Svar med id, status, filer, sammendrag og det som er uløst.`
}

function newPrompt(item) {
  return `${COMMON}

DIN OPPGAVE: lag den nye visualiseringen «${item.id}» (nøkkel k${CH.no}-${item.id}): ${item.idea}
- En praktisk situasjon fra hverdagen som gjør fysikken konkret.
- Interaktiv: glidebrytere, valg, avspilling eller dra. Explain endrer seg med tilstanden og forklarer det eleven ser, også misoppfatninger.
- Gjerne en graf, avlesninger og en utregning med levende tall.
- Illustrert realisme med scene-kit-et.
- Modellen ligger i ${DIR}/model-${item.id}.ts med tester i model-${item.id}.test.ts.
- Registrer den i ${DIR}/index.ts:
  - delkapitler fra listen over
  - en god title (stor forbokstav bare først), summary på 1–2 setninger, og keywords (også kompetansemål, f.eks. KM5)
  - plassert der den hører hjemme faglig (før eksempeloppgavene)
- Du kan justere idéen hvis du ser en bedre måte å lære det samme på innenfor pensum. Forklar i så fall hvorfor i rapporten.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - minst to runder med skjermbilder (også --extremes) som du har sett på og rettet etter
  - det ser profesjonelt ut i lyst og mørkt tema og på mobil
Svar med id, status, filer, sammendrag og det som er uløst.`
}

function examplePrompt(item) {
  return `${COMMON}

DIN OPPGAVE: lag eksempeloppgaven «${item.id}» (nøkkel k${CH.no}-${item.id}, kind: 'eksempel'): ${item.idea}
- Følg «Eksempeloppgaver» i README og mønsteret EksSkraplan.tsx:
  - egen oppgavetekst i eksamensstil med en konkret situasjon
  - 3–5 deloppgaver som blir gradvis vanskeligere, gjerne med en «Vis at …»
  - 1–3 steg per deloppgave som forklarer hvorfor, med utregning med levende tall og svar
  - tips og vanlige feil (pitfall)
  - en illustrert figur som bygger seg opp med stegene
  - gjerne 2–3 tallsett, og test at alle gir fornuftige svar
- Modellen ligger i ${DIR}/model-${item.id}.ts med tester. Tallene i teksten, utregningen og svaret kommer fra samme funksjon.
- Registrer den i ${DIR}/index.ts med kind: 'eksempel'. Id-en starter med eks-, og eksempeloppgavene står sist i kapittelet.
- Nivå og innhold skal ligne det som kommer på heldagsprøver og eksamen i Fysikk 1, men oppgaven skal være din egen.
- Sjekk med --steps at figuren stemmer med hvert steg.
- Ferdig betyr:
  - typesjekk og tester er grønne
  - skjermbilder av alle stegene i lyst og mørkt tema og på mobil, som du har sett på og rettet etter
Svar med id, status, filer, sammendrag og det som er uløst.`
}

const upgrades = CH.upgrades || []
const news = CH.news || []
const examples = CH.examples || []
const allIds = [...upgrades.map((u) => u.id), ...news.map((n) => n.id), ...examples.map((e) => e.id), ...(CH.reviewOnly || [])]

// Dør en agent (f.eks. bruksgrensen), stopper workflowen, så den kan gjenopptas fra hurtigbufferen.
function need(r, what) {
  if (r === null || r === undefined) throw new Error(`Avbrutt: ${what} ga ikke noe resultat`)
  return r
}

async function trackA() {
  const out = []
  for (const item of upgrades) {
    out.push(need(await agent(upgradePrompt(item), { label: `oppgrader:k${CH.no}-${item.id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `oppgrader:${item.id}`))
  }
  return out
}

async function trackB() {
  const out = []
  for (const item of news) out.push(need(await agent(newPrompt(item), { label: `ny:k${CH.no}-${item.id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `ny:${item.id}`))
  for (const item of examples) out.push(need(await agent(examplePrompt(item), { label: `eksempel:k${CH.no}-${item.id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `eksempel:${item.id}`))
  return out
}

phase('Bygg')
const tracks = await parallel([trackA, trackB])
if (tracks.some((t) => !t)) throw new Error(`Kapittel ${CH.no}: byggingen ble avbrutt`)
const built = tracks.flat()
log(`Kapittel ${CH.no}: ${built.length} bygget (${built.filter((b) => b.status !== 'ferdig').length} ikke helt ferdige)`)

// Kontroll i bunker, så hver kontrollør kan se nøye på alle skjermbildene.
function chunks(arr, n) {
  const res = []
  for (let i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n))
  return res
}
const reports = JSON.stringify(built, null, 1)

const kontroll = (ids) => `${COMMON}

DIN OPPGAVE: streng kontroll av ${ids.map((i) => `k${CH.no}-${i}`).join(', ')} i kapittel ${CH.no}, både faglig og visuelt. Du er fysikklærer og sensor på VG2 og har et skarpt øye for illustrasjon og UX. Ikke rett noe selv. Lag en liste med funn.

FAGLIG: les komponenten, modellen og testene, og kjør testene. Sjekk:
- fysikken og tallene (regn etter selv)
- at tekst, figur og svar stemmer med hverandre
- begreper og symboler som i ERGO Fysikk 1
- at forklaringene retter opp misoppfatninger
- for eksempeloppgavene: eksamensstil, at oppgaven er original, begrunnede steg, gjeldende siffer og alle tallsettene
- pensum (ikke Fysikk 2), språk og stor forbokstav bare først

VISUELT: ta skjermbilder med ${BIN}/shot.sh --ids ${ids.map((i) => `k${CH.no}-${i}`).join(',')} --extremes --steps --out ${OUT}/kontroll-${ids[0]}. Se på bildene i 1000 px lyst og 390 px mørkt. Ta de andre bare der du er i tvil. Sjekk:
- realisme og et profesjonelt uttrykk
- tydelige piler
- overlapp, eller ting som går ut av figuren
- mobil og mørkt tema
- at figuren stemmer med hvert steg
- NaN og feil i konsollen

blocking = feil fysikk eller feil tall, misvisende forklaring, stygt, uleselig, overlapp eller brudd på reglene. polish = konkrete forbedringer (bare de som betyr noe). Vær konkret og kort.
Byggerapportene: ${reports}`

phase('Kontroll')
const reviewJobs = []
for (const ids of chunks(allIds, 4)) reviewJobs.push(() => agent(kontroll(ids), { label: `kontroll:k${CH.no}-${ids[0]}…`, phase: 'Kontroll', schema: FINDINGS_SCHEMA }))
const reviews = await parallel(reviewJobs)
if (reviews.some((r) => !r)) throw new Error(`Kapittel ${CH.no}: kontrollen ble avbrutt`)
const findings = reviews.flatMap((r) => r.findings || [])
log(`Kapittel ${CH.no}: ${findings.filter((f) => f.severity === 'blocking').length} blokkerende og ${findings.filter((f) => f.severity === 'polish').length} forbedringer`)

phase('Retting')
const byId = {}
for (const f of findings) {
  const id = String(f.id).replace(/^k\d+-/, '')
  ;(byId[id] = byId[id] || []).push(f)
}
const fixes = []
for (const ids of chunks(Object.keys(byId), 3)) {
  const list = ids.map((id) => ({ id, funn: byId[id] }))
  const r = await agent(
    `${COMMON}

DIN OPPGAVE: rett funnene fra kontrollen av ${ids.map((i) => `k${CH.no}-${i}`).join(', ')}.
- Rett alle blokkerende funn.
- Rett også forbedringene som gjør resultatet tydelig bedre. Begrunn kort de du lar være.
- Kontrolløren kan ta feil: er du sikker på at et funn er feil, så forklar hvorfor.
- Kjør typesjekk og tester, og ta nye skjermbilder (--extremes, og --steps for eksempeloppgaver) av det du har endret, til alt er i orden.
Funn: ${JSON.stringify(list, null, 1)}
Svar kort med hva du rettet og hva du lot være.`,
    { label: `rett:k${CH.no}-${ids[0]}…`, phase: 'Retting' },
  )
  need(r, `rett:${ids.join(',')}`)
  fixes.push({ ids, result: r })
}

phase('Avslutning')
const final = await agent(
  `${COMMON}

DIN OPPGAVE: sluttsjekk av hele kapittel ${CH.no} før commit.
1. Kjør typesjekk (${BIN}/tsc-sjekk.sh src/viz/fysikk/kap${NN}) og testene for kapittelet. Rett eventuelle feil i kapittelmappa.
2. Ta skjermbilder av hele kapittelet: ${BIN}/shot.sh --chapter ${CH.no} --extremes --themes light,dark --out ${OUT}/slutt. Skriptet skal avslutte uten FEIL, altså uten konsollfeil, uten NaN og uten sidelengs scrolling. Se raskt over bildene for tydelige feil og rett dem.
3. Sjekk at index.ts har en fornuftig rekkefølge (det grunnleggende først, nye praktiske der de hører hjemme, eksempeloppgavene sist), at alle id-er og delkapitler stemmer, og at det ikke ligger løse filer igjen (for eksempel ubrukte filer eller testskript).
4. Commit kapittelet, bare din mappe. Andre kapitler committer kanskje samtidig, så prøv på nytt med noen sekunders pause ved låsfeil (index.lock). Bruk nøyaktig denne meldingen (tittel, tom linje, signaturlinjene), for eksempel med git commit -F og en heredoc:
-----
Fysikk kapittel ${CH.no}: illustrerte visualiseringer, nye praktiske og eksempeloppgaver

${TRAILERS}
-----
   cd ${ROOT} && git add ${DIR} && git commit -F <fil eller heredoc> -- ${DIR}
   Push deretter med nye forsøk ved feil: for i in 1 2 3 4; do git push -q origin ${BRANCH} && break; sleep $((2**i)); done
Svar med en kort rapport på bokmål: hva kapittelet nå inneholder (nye, oppgraderte og eksempeloppgaver), hva som ble rettet, og det som fortsatt er usikkert eller ikke testet.`,
  { label: `slutt:k${CH.no}`, phase: 'Avslutning' },
)

need(final, `slutt:k${CH.no}`)
return { chapter: CH.no, built, findings: findings.length, fixes: fixes.map((f) => f.ids), final }
