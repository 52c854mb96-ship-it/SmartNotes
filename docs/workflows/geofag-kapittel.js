export const meta = {
  name: 'geofag-tema',
  description: 'Visualiseringer og eksempeloppgaver for ett tema i Geofag 1: bygg, kontroll, retting og commit',
  phases: [
    { title: 'Bygg', detail: 'visualiseringene i to spor' },
    { title: 'Eksempler', detail: 'eksempeloppgavene, som kan bruke modellene fra visualiseringene' },
    { title: 'Kontroll', detail: 'faglig og visuell kontroll i bunker på fire' },
    { title: 'Retting', detail: 'retter funnene i bunker på tre' },
    { title: 'Avslutning', detail: 'sluttsjekk av temaet og commit' },
  ],
}

// Kjøres med Workflow({ scriptPath: '<arbeidskopien>/docs/workflows/geofag-kapittel.js', args }), der args er
// { tema: geofag-katalog.json.temaer["N"], scratch, branch, trailers, root, port, push }. Se «Geofag» i
// docs/workflows/README.md. NOTES er limt inn fra geofag-katalog.json (feltet notater).
if (!args || !args.tema || !args.scratch || !args.branch || !args.trailers || !args.root || !args.port) {
  throw new Error('args må ha tema, scratch, branch, trailers, root og port (se docs/workflows/README.md)')
}
if (!args.trailers.includes('\n') || args.trailers.includes('\\n')) {
  throw new Error('args.trailers må være to linjer skilt med et ekte linjeskift (Co-Authored-By og Claude-Session)')
}
const ROOT = args.root
const SCRATCH = args.scratch
const PORT = args.port
const BIN = `${ROOT}/docs/workflows/bin`
const BRANCH = args.branch
const TRAILERS = args.trailers
const PUSH = args.push !== false
const NOTES = "Omfang i katalogen (anbefalt variant): 35 visualiseringer og 15 eksempeloppgaver, 50 i alt. Tema 1: 2 + 1, tema 2: 3 + 2, tema 3: 6 + 1, tema 4: 3 + 2, tema 5: 6 + 2, tema 6: 4 + 2, tema 7: 4 + 2, tema 8: 4 + 2, tema 9: 3 + 1. Tre av dem (k2-plategrenser, k6-grunnvann og k9-kotekart) lages som referanser i kit-kjøringen og står som reviewOnly i temaene.\n\nEndret etter kontrollene: fire nye visualiseringer fyller hull i kompetansemålene: mineralgrupper (KM3, 3.1), sedimentare-bergarter (KM3), istider (5.2) og malmleting («danning og kartlegging» i KM9). De er egne oppføringer og ikke moduser, fordi flere oppføringer allerede var for tette for én agent. eks-snoskred er byttet ut med eks-fjellskred (fjellskred og flodbølge er den mest særnorske skredfaren). Forvitring er flyttet til tema 5 som k5-forvitring med 1.2 som ekstra deltema, så den vises på temasiden for tema 5 (ChapterPage bruker vizForChapter) og fortsatt ved notater i 1.2 (vizForSection). eks-nitrat heter nå eks-bronn og sammenligner smittestoffer, ikke nitrat, med kravet om 60 døgns oppholdstid. k2-plategrenser har fått tittelen «Platene beveger seg: rygg, grop og fjellkjede», som ikke er lik deltematittelen. De tetteste oppføringene (jordsystemene, karbonkretslop, plategrenser, vulkaner, relativ-alder, vannets-kretslop, isbre, forvitring, losmasser, malmleting, petroleumssystem) har en kjerne og et tillegg: agenten gjør kjernen ferdig før tillegget, og kontrollen godtar et enklere tillegg. Alt som kan velges i figuren, har en HTML-kontroll (knapper, Segmented eller Select) som hovedvei, og bygget på tomter i risiko står på faste tomter.\n\nLokale deler og eier: se den siste kit-oppføringen. Eksempeloppgavene bygges etter visualiseringene og kan importere eierens filer. Det som har flere visualiseringer som brukere (Plattform, Demning, Lupe, LogPlot), ligger i kit-et. Dette finnes ikke i scene-kit-et og lages lokalt eller i geofag-kit-et: regnvær og overskyet himmel (skydekke-laget i Nedbor), redskaper i hånda til Person (festes med personPunkter), skip, fly, traktor, fabrikkpipe og målestasjon.\n\nDekning: alle 26 deltemaer (2 + 3 + 3 + 3 + 4 + 3 + 3 + 3 + 2) har minst én oppføring, og hver oppføring har minst ett deltema i sitt eget tema. KM1 (tema 1, forvitring, istider, landheving, losmasser, co2-lagring), KM2 (tema 2), KM3 (tema 3, med mineralgrupper og sedimentære bergarter), KM4 (tema 4, eks-havbunnsspredning, eks-skjellsand), KM5 (relativ-alder, geologisk-tid, losmasser, landheving, eks-steinprove, eks-pukk, eks-skjellsand, sikteanalyse, kvikkleire), KM6 (tema 5), KM7 (tema 6, eks-vannforing), KM8 (grunnvann, drikkevann, eks-bronn, eks-nedborfelt), KM9 (tema 7, med dannelse og kartlegging i malmleting og seismikk i petroleumssystem), KM10 (tema 8, vulkaner, plategrenser, eks-jordskjelv, avrenning, eks-elveforbygning), KM11 (skraaning, flomfrekvens, risiko, eks-fjellskred, eks-boligfelt, kotekart), KM12 (tema 9). KM-kodene skrives også som søkeord, som i biologi. Fortsatt tynt: innsjøer i 6.2 og grunnvarme i 7.2 (begge i reserven), og KM5, KM11 og KM12 forutsetter eget feltarbeid, som visualiseringene bare kan støtte.\n\nReserve (alternativ C): seismiske-bolger (2.1, strålegang og skyggesone), vulkan-og-klima (1.2, nedkjøling etter store utbrudd), bergvarme (7.2, energibrønn og geotermi), innsjo (6.2, lagdeling og sirkulasjon rundt 4 °C), jorderosjon (5.4, kantsoner), avsetningsrate (4.1, borekjerne, varv og alder–dyp) og eks-snoskred (8.1, α–β-modellen; løsningen må da si at modellen gir hvor langt et skred kan nå, og at sikkerhetsklassen krever en vurdering av hvor ofte det skjer).\n\nAvgrensning mot andre fag: fysikk har halveringstid, strålingsbalanse, vannkraft og skråplanet med friksjon og planlegger c14 og varmepumpe. Geofag vinkles mot mineral, isotopsystem og lukketemperatur (C-14 holdes kort: hva som kan dateres, reservoareffekt og kalibrering), tilbakekobling i jordsystemene, poretrykk og kohesjon i skråningen, og vann som ressurs. Titlene skal være ulike, og søkeordene viser til det andre faget. Innad i geofag er oppføringene vinklet ulikt: losmasser (dannelse) mot sikteanalyse (metode), risiko (kart og klasser) mot eks-boligfelt (regning), plategrenser mot eks-havbunnsspredning, malmleting (dannelse og leting) mot malm (økonomi), og isbre, istider og landheving (én bre, klimasyklusene, jordskorpa).\n\nFakta som må sjekkes mot kilden og skrives i koden før de låses i tester: ICS-kartet versjon 2023/09 (devon 419,62), polaritetsskalaen for 0–5 millioner år, PREM, Shiklomanov 1993 og Trenberth mfl. 2007, IPCC AR6 figur 5.12, impulsresponsen i Joos mfl. 2013, Sclater og Christie 1980, Berger 1978 og EPICA Dome C (Jouzel mfl. 2007), NGU og NGF (korngrenser og løsmassenavn), NVE (kvikkleire 0,5 og 2 kPa, veileder 1/2019, klimapåslag, sikkerhetsmargin), TEK17 § 7-2 og § 7-3, Mattilsynet (60 døgns oppholdstid), Hjulström 1935 (avlest, med toleranser), marin grense og tidspunkt for isfrihet (Oslo ca. 220 m og ca. 10 800 år siden, Trondheim ca. 175 m), det globale havnivået etter istida, vannforbruk og lekkasje i Norge, metallinnhold i jordskorpa, CO₂-tetthet og VEI-tabellen. Er en verdi usikker, skriver teksten «omtrent» eller bruker egne tall. C-14 regnes med 5730 år og kalles «forenklet alder».\n\nE2e-tekster som ingen ny tittel eller sammendrag får inneholde: «Statisk friksjon og glidefriksjon», «Kassen står i ro.», «Kassen glir.», «Dytt F», «Kraftpar: bok, bord og jord», «Gravitasjonsparet», «Jorda trekker boka nedover», «Syre-base-titrering», «Vaksiner og flokkimmunitet» og nå «Platene beveger seg: rygg, grop og fjellkjede». I tillegg får ingen tittel være lik en av de 26 deltematitlene i Geofag 1, fordi VizCard har deltematitlene inne i lenka: en test som leter etter «Plategrenser og platebevegelser», ville truffet både visualiseringen og eks-havbunnsspredning. Ingen titler i katalogen bryter dette.\n\nNaN- og Infinity-feller: alder når P = 0, F når β = 0, 1/p når p = 0, Darcy og reisetid når L eller K er 0, Thiem når r = 0, grensegehalt når prisen er 0, log av 0 i Hjulström, LogPlot og VEI (tefravolum 0), ekvidistanse 0, d10 under minste sikt, ankomsttid når fjorddybden er 0, magnetisk anomali når z = 0 og porøsitet ved svært stort dyp. Modellen gir null, og komponenten viser «–» eller en forklaring. viz-shot leser textContent uten ordgrense, så formler som NaNO₃ skrives med Formel eller TFormel, og en tekstbit som slutter på «Na», skal ikke stå rett før en som starter på «N» (Nedbør, Norge, N 45° Ø).\n\nKonvensjoner til README-avsnittet «Geofag»: begreper som i Geofag 1 og hos Udir (geosfæren, hydrosfæren, atmosfæren, biosfæren; litosfære, astenosfære, nedre mantel; spredningsrygg, subduksjon, kollisjon, transformforkastning, med begge sett fagord: konstruktiv eller divergerende, destruktiv eller konvergerende, konservativ; hyposenter og episenter; dypbergart, gangbergart, dagbergart; mineralgruppe, silikat; diagenese; superposisjon, gjennomskjæring, diskordans; akkumulasjon, ablasjon, likevektslinje; morene, breelvavsetning, marin grense, isostasi; grunnvannsspeil, mettet og umettet sone; kildebergart, reservoarbergart, takbergart, felle; gjentaksintervall; strøk og fall, ekvidistanse, overhøyde). Enheter: «millioner år» i løpende tekst (fmtAlder), cm per år, m o.h., mm, m³/s, kPa, Pa·s. Eksempeloppgavene er alltid tenkte steder med egne tall; ekte steder brukes som eksempler i forklaringene (se spørsmål 3)."

const T = args.tema
const NN = T.no.padStart(2, '0')
const REL = `web/src/viz/geofag/kap${NN}`
const DIR = `${ROOT}/${REL}`
const OUT = `${SCRATCH}/geofag-kap${NN}`
const SECTIONS = T.sections.map((s) => `${s.code} ${s.title} (${s.km.join(', ')})`).join('; ')
const SECTION_TITLES = T.sections.map((s) => `«${s.title}»`).join(', ')

const COMMON = `Du jobber med de interaktive visualiseringene i SmartNotes (web/src/viz/), faget Geofag 1 (GFG01-03, LK20). Eleven vil ha visualiseringer bygd på samme måte som i fysikk, kjemi og biologi: praktiske situasjoner, eksempeloppgaver i eksamensstil og et realistisk utseende («illustrert realisme») som samtidig er maksimalt lett å forstå. Dette er den delen av appen elevene skal bruke mest, fordi den ikke koster penger å bruke. Kvalitet er viktigere enn fart.

ARBEIDSKOPI: alt arbeid skjer i ${ROOT} (en egen git-arbeidskopi på grenen ${BRANCH}). Bruk ALLTID absolutte stier under ${ROOT}. /home/user/SmartNotes/web, /home/user/SmartNotes/server osv. (uten .claude/worktrees/geofag) er en ANNEN kopi som andre agenter jobber i: les, endre eller kjør aldri noe der. Får du ikke skrevet under ${ROOT}, svar med status «mislyktes» i stedet for å skrive et annet sted.

TEMA ${T.no} ${T.title}. Deltemaer: ${SECTIONS}. Mappe: ${DIR}/.
Lokale deler i temaet (bare eieren lager dem; andre i temaet kan importere dem når eieren er ferdig): ${T.lokalt.length ? T.lokalt.join('; ') : 'ingen planlagt'}.

LES FØRST (og spar på lesingen):
- ${ROOT}/web/src/viz/README.md: «Illustrert realisme (scene-kit)», «Eksempeloppgaver», «Oppbygning av én visualisering» og «Regler».
- ${ROOT}/web/src/viz/geofag/kit/API.md (geofag-kit-et: farger, lagmønstre, snitt, tektonikk, vann, landskap, korn, stein, kart, diagrammer og rene hjelpere) og galleribildene i ${SCRATCH}/galleri-geo/. Les bare kildefila til komponentene og hjelperne du faktisk bruker.
- ${ROOT}/web/src/viz/kit/scene/API.md og galleribildene i ${SCRATCH}/galleri-alle/ når du trenger himmel, personer eller gjenstander.
- Referansene som viser stilen: k2-plategrenser (${ROOT}/web/src/viz/geofag/kap02), k6-grunnvann (kap06) og k9-kotekart (kap09). For eksempeloppgaver: ${ROOT}/web/src/viz/kit/eksempel.tsx og ${ROOT}/web/src/viz/fysikk/kap02/EksSkraplan.tsx.
- Filene i temamappen din som oppgaven gjelder.

ARBEIDSREGLER
- Endre bare filer i ${DIR}/. Ikke endre geofag-kit-et, scene-kit-et, det felles kit-et, styles, README eller andre temaer. Mangler noe i kit-et, lag det lokalt i temamappa (egen fil, samme stil og GEO-farger) og nevn det i rapporten.
- Import: import { … } from '../kit' (geofag-kit-et, som også eksporterer det felles kit-et og de generelle hjelperne fra kjemi og biologi) og scene-kit-et fra '../../kit/scene'.
- Flere agenter jobber i samme temamappe samtidig. Derfor har hver visualisering og eksempeloppgave modellen i en egen fil, model-<id>.ts, med tester i model-<id>.test.ts, og index.ts endres med små, presise Edit-endringer (les fila rett før du endrer den).
- Fag: Geofag 1 etter læreplanen og deltemaene over. Begreper, enheter og kilder som i de faglige notatene under. Ekte steder og kjente hendelser kan nevnes kort i forklaringene (elevens valg: for eksempel Oslofeltet, Jostedalsbreen, Sleipner, Åknes og Gjerdrum 2020); eksempeloppgavene bruker alltid tenkte steder med egne tall. Er en verdi usikker, skriv «omtrent» eller bruk egne tall.
- Kraftpiler og «Vis krefter» bare der det faktisk er krefter (skråningen, platedrivkrefter); farter og strømning tegnes med VIZ.velocity. VIZ-farger brukes aldri på bergarter og landskap.
- All regning i rene funksjoner med vitest-tester (kjente verdier, grensetilfeller, alle tallsett), og null i stedet for NaN eller Infinity (komponenten viser «–» eller en forklaring).
- Alt eleven kan velge i figuren, har en HTML-kontroll (Segmented, knapper eller Select) som hovedvei. Tette visualiseringer har en kjerne og et tillegg: gjør kjernen ferdig først.
- Mobil: figurene skaleres ned til ca. 330 px og teksten blir ca. 1,8 ganger større. Gjør scener og plott høyere på mobil (H = 320 + 260 · (f − 1)), bruk useGeoScale/useGeoStroke, og legg etiketter i egen kolonne der snittene er brede.
- Språk: bokmål, stor forbokstav bare først (aldri bare store bokstaver), ingen emojier. Desimalkomma via fmt(), ekte minus (−), mellomrom før enhet, «millioner år» i løpende tekst (fmtAlder).
- VizMeta: id i små bokstaver med bindestrek (eksempeloppgaver starter med eks- og har kind: 'eksempel'), chapter '${T.no}', sections med deltemakodene over (minst ett i dette temaet), title med stor forbokstav bare først, summary på 1–2 setninger, keywords med kompetansemålene (for eksempel 'KM6').
- Ingen tittel kan være lik en deltematittel (${SECTION_TITLES} eller andre i Geofag 1), og titler og sammendrag kan ikke inneholde tekster som e2e-testene leter etter (se notatene).
- Opphavsrett: eksempeloppgaver og situasjoner er egne, med egen tekst og egne tall. Kopier aldri ekte eksamens- eller læreboksoppgaver, og gjenfortell dem heller ikke.
- Verktøy (maskinen deles av mange agenter, så bruk disse i stedet for tsc og Playwright direkte):
  - Typesjekk: ${BIN}/tsc-sjekk.sh src/viz/geofag/kap${NN}
  - Tester: cd ${ROOT}/web && npx vitest run src/viz/geofag/kap${NN}
  - Skjermbilder: SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids k${T.no}-a,k${T.no}-b --out ${OUT}/<runde> (lyst og mørkt, 1000 og 390 px; --extremes setter glidebryterne til min og maks, --steps gir hvert steg i en eksempeloppgave). Vite kjører fra arbeidskopien på port ${PORT}.
  - viz-shot flytter bare glidebrytere. Har visualiseringen Segmented, knapper, forvalg eller avspilling, så lag et lite Playwright-skript i ${OUT}/ som klikker gjennom dem og tar bilder (bruk PW_CHROMIUM=/opt/pw-browsers/chromium og http://localhost:${PORT}/viz-preview.html?fag=geofag&id=k${T.no}-<id>&theme=dark).
  - Se på skjermbildene med Read og vurder dem som en kritisk illustratør og geofaglærer: ser det ekte og profesjonelt ut, er det lett å forstå, overlapper noe på mobil, fungerer mørkt tema med fagtemaet «Fjell»?
- Ikke commit. Et eget steg gjør det.

FAGLIGE NOTATER FRA PLANLEGGINGEN:
${NOTES}`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['ferdig', 'delvis', 'mislyktes'] },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string', description: 'Hva visualiseringen/oppgaven viser' },
    kitWishes: { type: 'string', description: 'Det som manglet i kit-et og ble laget lokalt, ellers tom' },
    openIssues: { type: 'string', description: 'Det som ikke ble bra nok eller må sjekkes, ellers tom' },
  },
  required: ['id', 'status', 'files', 'summary', 'kitWishes', 'openIssues'],
}
const FINAL_SCHEMA = {
  type: 'object',
  properties: {
    commit: { type: 'string', description: 'Full sha for commiten med temaet, eller tom hvis den mangler' },
    pushed: { type: 'boolean' },
    report: { type: 'string' },
  },
  required: ['commit', 'pushed', 'report'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'id-en i index.ts (uten k-prefiks), f.eks. isbre eller eks-skjellsand' },
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

const describe = (item) => `Tittel: «${item.title}». Deltemaer: ${item.sections.join(', ')}. Kompetansemål: ${item.km.join(', ')}.
Idé: ${item.idea}
Modell: ${item.model}
Scenebehov: ${item.sceneNeeds}`

function vizPrompt(item) {
  return `${COMMON}

DIN OPPGAVE: lag visualiseringen «${item.id}» (nøkkel k${T.no}-${item.id}).
${describe(item)}
- Interaktiv: glidebrytere, valg, avspilling eller dra. Explain endrer seg med tilstanden og forklarer det eleven ser, også vanlige misoppfatninger.
- Gjerne en graf, avlesninger og en utregning med levende tall. Illustrert realisme med geofag-kit-et og scene-kit-et.
- Modellen i ${DIR}/model-${item.id}.ts med tester i model-${item.id}.test.ts. Komponenten i en egen fil med standardeksport.
- Registrer den i ${DIR}/index.ts der den hører hjemme faglig (det grunnleggende først, eksempeloppgavene sist).
- Du kan justere idéen hvis du ser en bedre måte å lære det samme på innenfor læreplanen; forklar i så fall hvorfor i rapporten.
- Ferdig betyr: typesjekk og tester er grønne, minst to runder skjermbilder (også --extremes og klikk gjennom valgene) som du har sett på og rettet etter, og det ser profesjonelt ut i lyst og mørkt tema og på mobil.
Svar med id, status, filer, sammendrag, kitWishes og det som er uløst.`
}

function examplePrompt(item) {
  return `${COMMON}

DIN OPPGAVE: lag eksempeloppgaven «${item.id}» (nøkkel k${T.no}-${item.id}, kind: 'eksempel').
${describe(item)}
- Følg «Eksempeloppgaver» i README og mønsteret EksSkraplan.tsx: egen oppgavetekst i eksamensstil med en konkret, tenkt situasjon; 3–5 deloppgaver som blir gradvis vanskeligere, gjerne med en «Vis at …» eller «Forklar …»; 1–3 steg per deloppgave som forklarer hvorfor, med utregning med levende tall og svar; tips og vanlige feil (pitfall); en illustrert figur som bygger seg opp med stegene; gjerne 2–3 tallsett, og test at alle gir fornuftige svar.
- Modellen i ${DIR}/model-${item.id}.ts med tester. Tallene i teksten, utregningen og svaret kommer fra samme funksjon. Du kan importere modeller og lokale deler fra visualiseringene i temaet (de er ferdige).
- Registrer den sist i ${DIR}/index.ts med kind: 'eksempel'.
- Nivået skal ligne prøver og eksamen i Geofag 1, men oppgaven skal være din egen.
- Sjekk med --steps at figuren stemmer med hvert steg.
- Ferdig betyr: typesjekk og tester er grønne, og skjermbilder av alle stegene i lyst og mørkt tema og på mobil som du har sett på og rettet etter.
Svar med id, status, filer, sammendrag, kitWishes og det som er uløst.`
}

const vizItems = T.viz || []
const examples = T.examples || []
const allIds = [...vizItems.map((v) => v.id), ...examples.map((e) => e.id), ...(T.reviewOnly || [])]

function need(r, what) {
  if (r === null || r === undefined) throw new Error(`Avbrutt: ${what} ga ikke noe resultat`)
  return r
}

async function track(items) {
  const out = []
  for (const item of items) out.push(need(await agent(vizPrompt(item), { label: `viz:k${T.no}-${item.id}`, phase: 'Bygg', schema: BUILD_SCHEMA }), `viz:${item.id}`))
  return out
}

phase('Bygg')
// Spor A tar plassene 1, 3, 5 … og spor B plassene 2, 4, 6 …, så det grunnleggende kommer først i begge.
const tracks = await parallel([() => track(vizItems.filter((_, i) => i % 2 === 0)), () => track(vizItems.filter((_, i) => i % 2 === 1))])
if (tracks.some((t) => !t)) throw new Error(`Tema ${T.no}: byggingen ble avbrutt`)

phase('Eksempler')
const exs = await parallel(examples.map((item) => () => agent(examplePrompt(item), { label: `eksempel:k${T.no}-${item.id}`, phase: 'Eksempler', schema: BUILD_SCHEMA })))
if (exs.some((r) => !r)) throw new Error(`Tema ${T.no}: eksempeloppgavene ble avbrutt`)
const built = [...tracks.flat(), ...exs]
log(`Tema ${T.no}: ${built.length} bygget (${built.filter((b) => b.status !== 'ferdig').length} ikke helt ferdige)`)

function chunks(arr, n) {
  const res = []
  for (let i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n))
  return res
}
const reports = JSON.stringify(built, null, 1)

const kontroll = (ids) => `${COMMON}

DIN OPPGAVE: streng kontroll av ${ids.map((i) => `k${T.no}-${i}`).join(', ')} i tema ${T.no}, både faglig og visuelt. Du er geofaglærer og sensor på VG2 og har et skarpt øye for illustrasjon og UX. Ikke rett noe selv. Lag en liste med funn.

FAGLIG: les komponenten, modellen og testene, og kjør testene. Sjekk:
- geofaget og tallene (regn etter selv, og sjekk kildene i kommentarene)
- at tekst, figur og svar stemmer med hverandre
- begreper og enheter som i Geofag 1 og hos Udir
- at forklaringene retter opp misoppfatninger
- for eksempeloppgavene: eksamensstil, at oppgaven er original og bruker tenkte steder, begrunnede steg, gjeldende siffer og alle tallsettene
- læreplanen, språk og stor forbokstav bare først, KM-koder i keywords, og at ingen tittel er lik en deltematittel

VISUELT: ta skjermbilder med SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids ${ids.map((i) => `k${T.no}-${i}`).join(',')} --extremes --steps --out ${OUT}/kontroll-${ids[0]}. Se på bildene i 1000 px lyst og 390 px mørkt; ta de andre bare der du er i tvil. Klikk også gjennom Segmented, knapper og avspilling med et lite Playwright-skript. Sjekk:
- realisme og et profesjonelt uttrykk, og at kit-et brukes slik det er ment
- overlapp, eller ting som går ut av figuren
- mobil og mørkt tema med «Fjell»
- at figuren stemmer med hvert steg
- NaN og feil i konsollen

blocking = feil fag eller feil tall, misvisende forklaring, stygt, uleselig, overlapp eller brudd på reglene. polish = konkrete forbedringer (bare de som betyr noe). Vær konkret og kort.
Byggerapportene: ${reports}`

phase('Kontroll')
const reviewJobs = []
for (const ids of chunks(allIds, 4)) reviewJobs.push(() => agent(kontroll(ids), { label: `kontroll:k${T.no}-${ids[0]}…`, phase: 'Kontroll', schema: FINDINGS_SCHEMA }))
const reviews = await parallel(reviewJobs)
if (reviews.some((r) => !r)) throw new Error(`Tema ${T.no}: kontrollen ble avbrutt`)
const findings = reviews.flatMap((r) => r.findings || [])
log(`Tema ${T.no}: ${findings.filter((f) => f.severity === 'blocking').length} blokkerende og ${findings.filter((f) => f.severity === 'polish').length} forbedringer`)

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

DIN OPPGAVE: rett funnene fra kontrollen av ${ids.map((i) => `k${T.no}-${i}`).join(', ')}.
- Rett alle blokkerende funn.
- Rett også forbedringene som gjør resultatet tydelig bedre. Begrunn kort de du lar være.
- Kontrolløren kan ta feil: er du sikker på at et funn er feil, så forklar hvorfor.
- Kjør typesjekk og tester, og ta nye skjermbilder (--extremes, og --steps for eksempeloppgaver) av det du har endret, til alt er i orden.
Funn: ${JSON.stringify(list, null, 1)}
Svar kort med hva du rettet og hva du lot være.`,
    { label: `rett:k${T.no}-${ids[0]}…`, phase: 'Retting' },
  )
  need(r, `rett:${ids.join(',')}`)
  fixes.push({ ids, result: r })
}

phase('Avslutning')
const pushStep = PUSH
  ? `for i in 1 2 3 4; do git -C ${ROOT} push -q origin ${BRANCH} && break; sleep $((2**i)); done`
  : `# push er av (args.push = false): commiten blir liggende lokalt i arbeidskopien`
const final = await agent(
  `${COMMON}

DIN OPPGAVE: sluttsjekk av hele tema ${T.no} før commit.
1. Kjør typesjekk (${BIN}/tsc-sjekk.sh src/viz/geofag/kap${NN}) og testene for temaet. Rett eventuelle feil i temamappa.
2. Ta skjermbilder av hele temaet: SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --chapter ${T.no} --extremes --themes light,dark --out ${OUT}/slutt. Skriptet skal avslutte uten FEIL (ingen konsollfeil, ingen NaN og ingen sidelengs scrolling). Se raskt over bildene for tydelige feil og rett dem.
3. Sjekk at index.ts har en fornuftig rekkefølge (det grunnleggende først, eksempeloppgavene sist), at alle id-er, deltemaer og KM-koder stemmer, og at det ikke ligger løse filer igjen (ubrukte filer, testskript, skjermbilder).
4. Commit${PUSH ? ' og push' : ''} temaet. Bare din mappe skal med, og andre temaer kan committe samtidig (derfor løkka). Heredoc-en er commit-meldingen: tittel, tom linje og signaturlinjene. Kjør nøyaktig dette:
cd ${ROOT}
for i in 1 2 3 4 5 6; do git add ${REL} && git commit -q -F - -- ${REL} <<'MELDING' && break
Geofag tema ${T.no}: ${T.title}, visualiseringer og eksempeloppgaver

${TRAILERS}
MELDING
sleep $((i*3)); done
${pushStep}
git log -1 --format=%H -- ${REL}; git status --short ${REL}; git status -sb | head -1
git -C /home/user/SmartNotes status --porcelain
5. Sjekk at commiten finnes og at git status for mappa er tom${PUSH ? ', og at grenen ikke ligger foran origin (ingen «ahead»)' : ''}. Viser den siste kommandoen filer under web/src/viz/geofag i hovedkopien, har noe havnet feil sted: si fra i rapporten (ikke slett noe der).
Svar med commit (full sha), pushed (${PUSH ? 'true bare hvis push lyktes og mappa er ren' : 'true hvis commiten finnes og mappa er ren, siden push er av'}) og en kort rapport på bokmål: hva temaet nå inneholder, hva som ble rettet, kit-ønskene, og det som fortsatt er usikkert eller ikke testet.`,
  { label: `slutt:k${T.no}`, phase: 'Avslutning', schema: FINAL_SCHEMA },
)

need(final, `slutt:k${T.no}`)
if (!final.commit || !final.pushed) {
  throw new Error(`Avbrutt: tema ${T.no} ble ikke committet${PUSH ? ' og pushet' : ''} (${final.report}). Commit mappa for hånd.`)
}
return { tema: T.no, built, findings: findings.length, fixes: fixes.map((f) => f.ids), kitWishes: built.map((b) => b.kitWishes).filter(Boolean), final }
