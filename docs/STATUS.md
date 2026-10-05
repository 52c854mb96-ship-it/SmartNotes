# Status for SmartNotes

> **Det eleven skriver i chatten, går alltid foran det som står her.** Denne fila er et øyeblikksbilde som gjør det lett å starte en ny økt uten å miste sammenhengen. Den ble sist oppdatert 5. oktober 2026, i PR #6 (overleveringen). Kjør `git fetch origin main && git log origin/main` for å se det som har skjedd etterpå.

Arkitektur og kodekonvensjoner står i [CLAUDE.md](../CLAUDE.md). Elevens egen dokumentasjon står i [README.md](../README.md) og [OPPSETT.md](OPPSETT.md).

## Hva appen er

SmartNotes er en personlig app for en elev på VG2. Eleven tar bilder av håndskrevne notater eller laster opp PDF-er. Claude leser dem og skriver dem om til LaTeX, og serveren lager pene PDF-er. Notatene sorteres etter fag, kapittel og delkapittel i læreboka.

- **Fag:** Fysikk 1 (ERGO Fysikk 1), Kjemi 1 (Aschehoug) og Biologi 1 (Bi 1, Gyldendal), alle etter LK20.
- **Hvem bruker den:** eleven har bare Fysikk 1. Kjemi 1 og Biologi 1 er laget for at andre skal kunne bruke appen senere.
- **Hvordan den kjører:** en PWA som fungerer uten nett, og én server (Docker) på Railway som synkroniserer alle enhetene (Mac, PC, iPad og mobil).
- **Språk:** alt eleven ser, er på bokmål: appen, feilmeldingene og PDF-malene. Koden bruker engelske navn.

## Hva appen kan i dag

Alt dette ligger i `main`. Railway skal deploye automatisk fra `main` når CI er grønn, men oppsettet hos eleven er ikke bekreftet (se «Kan være ugjort hos eleven»).

| Funksjon | Kort beskrivelse | Hvor i koden |
|---|---|---|
| Konvertering | Sider → Claude (bilde) → LaTeX → PDF. Notatet gjengis tro mot originalen, og mulige feil markeres med en merknad i stedet for å rettes. Enkle figurer tegnes på nytt i TikZ, og kompliserte klippes ut. Kompileringsfeil rettes automatisk i inntil to runder. | `server/src/pipeline/` |
| Fag og lærebøker | Kapitler og kompetansemål (ordrett fra Udir) for tre læreboksett. Delkapitler finnes foreløpig for Fysikk 1 og kapittel 1 i Kjemi 1. Claude velger kapittel og eventuelt delkapittel, og eleven kan flytte notatet selv. | `server/src/textbooks.ts`, `server/src/profiles/` |
| Import av innholdsfortegnelse | Tekst eller bilder → kapitler med delkapitler, koblet til kompetansemålene. | `server/src/toc.ts`, `web/src/pages/settings/ChapterImport.tsx` |
| Søk | Ctrl/Cmd+K søker i titler og innhold, også uten nett. | `web/src/components/SearchPalette.tsx` |
| Visualiseringer | 109 interaktive forklaringer, ordnet etter kapittel: 36 i fysikk, 31 i kjemi og 42 i biologi. | `web/src/viz/` (les `README.md` der) |
| Flashcards | Eleven velger notater og vanskelighetsgrad, og Claude lager en kortstokk. Eleven vurderer selv hvert svar fra 1 til 4 (Feil, Delvis, Bra, Perfekt). Etter runden velger eleven hva som skal repeteres. Kortstokker og fremgang synkroniseres, og øving fungerer uten nett. | `server/src/flashcards/`, `web/src/flashcards/` |
| Samle-PDF | Et helt kapittel eller hele faget som én PDF med innholdsliste. | `server/src/pipeline/bundle.ts` |
| Offline og synk | Dexie (IndexedDB) er kilden lokalt. Opplastinger uten nett havner i en kø, og PDF-ene hentes på forhånd. | `web/src/db.ts`, `web/src/sync.ts` |
| Rediger LaTeX | Eleven kan se og endre LaTeX-koden og kompilere på nytt. | `web/src/pages/note/LatexTab.tsx` |
| Design | Tre kolonner på store skjermer, og lyst, mørkt eller systemtema. Hvert fag har sine egne farger og sin egen PDF-mal: fysikk «Blekk» og «Klassisk», kjemi «Tavle» og «Moderne», biologi «Salvie» og «Lærebok». | `web/src/styles/`, `server/latex/` |

**Claude-oppsett nå:** Claude Sonnet 5.5 med middels grundighet (`effort: medium`) ved konvertering. Eleven valgte dette for å holde kostnadene nede. Opus 5.5 er grundigere, men koster det dobbelte, og kan slås på med `CLAUDE_MODEL=claude-opus-5-5`. Se `server/src/config.ts`.

**Kostnad (beregnet, ikke målt):** en side koster ca. 0,25 kr, og et notat på 5 sider ca. 1,35 kr. En kortstokk koster 0,50–2 kr, og opptil ca. 5 kr for de største. Vanlig bruk i tre fag koster rundt 40 kr i måneden til Claude, og mindre med bare Fysikk 1. Railway-abonnementet (ca. 55 kr i måneden) har eleven fra før, og forbruket til serveren dekkes helt eller delvis av det som er inkludert i abonnementet. Alle tallene står i dokumentet [Kostnader for SmartNotes](https://claude.ai/code/artifact/e5b19b9d-07c0-4c20-bc21-d453fe1ada01), som er privat for eleven. Det er et Claude Docs-dokument: les det med Claude Docs-verktøyet (`read` med ref `{"object":"project","id":"e5b19b9d-07c0-4c20-bc21-d453fe1ada01"}`, deretter fanen). Artifact-verktøyet viser ikke innholdet.

## Hva som er gjort

Alt ble bygget 4. og 5. oktober 2026 og flettet inn i `main` gjennom fem pull requests:

| PR | Innhold |
|---|---|
| [#1](https://github.com/52c854mb96-ship-it/SmartNotes/pull/1) | Grunnmuren: server, konverteringskø, PWA med offline-synk og opplastingskø, tre kolonner, søk, delkapitler og kompetansemål, 36 fysikkvisualiseringer, import av innholdsfortegnelse, Railway-oppsett og Safari-rettelser. Alle tre fag med læreboksett, instrukser, PDF-mal og fargetema: fysikk («Blekk», «Klassisk»), kjemi («Tavle», «Moderne») og biologi («Salvie», «Lærebok») |
| [#2](https://github.com/52c854mb96-ship-it/SmartNotes/pull/2) | Kjemi 1: 31 visualiseringer for kapittel 1–8, og byggeklosser for kjemi og biologi (`viz/kjemi/kit/`, `viz/biologi/kit/`) |
| [#3](https://github.com/52c854mb96-ship-it/SmartNotes/pull/3) | Biologi 1: alle 42 visualiseringer for kapittel 1–15 ferdig bygget, kontrollert og koblet inn (mange av filene kom allerede med i #2) |
| [#4](https://github.com/52c854mb96-ship-it/SmartNotes/pull/4) | Flashcards: kortstokker fra notatene, øving med vurdering 1–4, repetisjon og effekter |
| [#5](https://github.com/52c854mb96-ship-it/SmartNotes/pull/5) | Billigere Claude: Sonnet 5.5 og middels grundighet som standard |

**Tester:** omtrent 1 000 enhetstester (77 på serveren og 921 i web-appen), 12 ende-til-ende-tester i Chromium (PC og mobil) og egne tester for Safari og iPad (WebKit). CI kjører tre jobber: `test`, `webkit` og `docker`. Alle var grønne på `main` etter PR #5.

## Valg eleven har tatt

Ikke endre disse uten å spørre først.

- **Notatene:** de skal være tro mot originalen. Mulige feil markeres med en merknad og rettes aldri i stillhet. Figurer tegnes på nytt i TikZ når de er enkle, og klippes ut fra bildet ellers.
- **Design:** fargene og PDF-malene per fag som i tabellen over, og tre kolonner.
- **UI-stil:** stor forbokstav bare i starten av setninger og navn, aldri bare store bokstaver. Ingen emojier, et rolig uttrykk og bare CSS-variabler. Dette kommer fra elevens tidligere prosjekt Momentum.
- **Flashcards:**
  - Repetisjon er bare et valg etter runden: «De du ikke kunne», «Også de du var usikker på» eller «Alle på nytt». Det er bevisst ingen planlegging over flere dager.
  - Vanskelighetsgraden styrer både hva slags kort som lages og hvor lange svarene er.
  - Kortstokkene lagres på serveren og synkroniseres.
  - Øvingsreglene og effektene er hentet fra en flashcard-fil eleven laget tidligere. Fila ligger ikke i repoet, men reglene står i `web/src/flashcards/model.ts` og effektene i `web/src/flashcards/effects.ts`. Eleven har sagt at effektene var bra.
- **Kostnad:** Sonnet 5.5 med middels grundighet ([PR #5](https://github.com/52c854mb96-ship-it/SmartNotes/pull/5)).
- **Drift:** Railway, ikke Fly.io, fordi eleven allerede har abonnement der. Railway deployer fra `main` med «Wait for CI».
- **Innholdsfortegnelser:** importen for Kjemi 1 og Biologi 1 er utsatt, fordi eleven ikke har de fagene.

## Arbeidsavtaler

- **Språk:**
  - Svar eleven på bokmål, kort og konkret.
  - Eleven liker analogier når noe nytt skal forklares.
- **Før en ny funksjon:**
  - Eleven vil gjerne få oppklaringsspørsmål først.
  - Still dem samlet, med det anbefalte valget først.
- **Når noe er ferdig:** gi en kort rapport. Si tydelig hva som ikke er testet, for eksempel med ekte Claude.
- **Git:**
  - Jobb på grenen som øktinstruksene oppgir. Hittil har det vært `claude/smartnotes-offline-app-j25mqo`.
  - Lag en PR mot `main`, og flett den selv når CI er grønn. Eleven har godkjent dette: «Ja, flett inn selv».
  - Etter flettingen nullstilles arbeidsgrenen fra `main`.
- **Commit- og PR-tekst:** skriv på bokmål. Bruk attribusjonslinjene som systemet oppgir, og nevn ellers ikke hvilken modell du selv kjører på. Modellene appen bruker (for eksempel `claude-sonnet-5-5` i `server/src/config.ts`), kan nevnes som vanlig.
- **Før push:** kjør `npm run typecheck`, `npm test`, `npm run build` og `npm run test:e2e`, i den rekkefølgen (ende-til-ende-testene bruker det ferdige bygget). CI kjører i tillegg WebKit og Docker. I en ny container må TeX Live installeres først (se `CLAUDE.md`).
- **Hemmeligheter:** be aldri eleven lime inn API-nøkler eller passord i chatten. De hører hjemme i Railway-variabler eller i `.env`.
- **Manuelt arbeid:** eleven ordner selv det som skjer i Railway og Anthropic Console. Gi trinnvise instrukser med nøyaktige verdier som kan kopieres rett inn.
- **Store oppgaver:**
  - Workflows og agenter er greit, så lenge oppgavene er strukturerte og ikke går i beina på hverandre.
  - Hvis eleven ber deg jobbe lenge, for eksempel over natten, sørger du for at arbeidet fortsetter av seg selv når bruksgrensen er nullstilt.
  - Legg vekt på feilsøking og finpuss underveis.
- **Denne fila:** oppdater `docs/STATUS.md` når en større oppgave er ferdig. Oppdater også `CLAUDE.md` når arkitekturen endres.

## Kan være ugjort hos eleven

Det er ikke bekreftet at eleven har gjort dette i Railway. Spør heller enn å anta.

1. **Settings → Source:** grenen skal være `main`, og «Wait for CI» skal være på.
2. **Hvis eleven bare vil ha Fysikk 1:**
   - Legg til variabelen `SEED_TEXTBOOKS` med verdien `ergo-fysikk-1`.
   - Er Kjemi 1 og Biologi 1 allerede lagt inn, slettes de i appen: tannhjulet på fagsiden → **Slett faget**. Et slettet fag kommer ikke tilbake.
3. **Variabler:** `CLAUDE_MODEL` og `CLAUDE_EFFORT` bør ikke være satt, ellers overstyrer de de nye standardverdiene.

## Kjente begrensninger og åpne spørsmål

- **Ikke testet med ekte Claude:** skyøktene har ingen API-nøkkel, så alle tester bruker en falsk Claude (`SMARTNOTES_FAKE_CLAUDE=1`). Det er ennå ikke prøvd hvordan Sonnet 5.5 med middels grundighet konverterer ekte notater, eller hvor gode kortene i flashcards blir. [OPPSETT.md](OPPSETT.md) forklarer hvordan eleven kan gi skyøktene en nøkkel.
- **Kostnadene er beregnet, ikke målt:** valutakursen (10,50 kr per dollar) og Railway-prisen er omtrentlige, fordi nettverket i økten blokkerte kildene. Det faktiske forbruket står i Anthropic Console under **Usage**.
- **Kjemi 1 og Biologi 1 mangler delkapitler:** bare kapittel 1 i kjemi har delkapitler (1.1–1.5, der 1.3 er mest usikker). De fire visualiseringene i kjemi kapittel 1 er koblet til delkapitlene. De andre i kjemi og alle i biologi er koblet per kapittel (`sections: []`). Noen kapitteltitler er heller ikke bekreftet: kapittel 2 i kjemi og kapittel 8, 13 og 15 i biologi.
- **Bare én bruker:** appen har ett passord og én database. Vil andre bruke den i dag, trenger de hver sin egen server.
- **Flashcards:** trykker eleven «Angre forrige» etter at en ny beste rekke er sendt til serveren, blir rekka ikke lavere igjen, fordi serveren beholder den høyeste.
- **Stor hovedbunt:** hovedbunten i web-appen er rundt 710 kB (ca. 220 kB komprimert). KaTeX og visualiseringene lastes allerede først når de trengs.
- **Sikkerhetskopi:** de eneste sikkerhetskopiene er volumbackupen i Railway (hvis abonnementet har den) og samle-PDF-ene. Det finnes ingen eksport av hele databasen.

## Naturlige neste steg

Dette er bare forslag. Eleven bestemmer rekkefølgen.

1. **Prøve med ekte Claude:** konverter noen vanskelige fysikknotater og lag et par kortstokker. Juster så instruksene etter resultatet: `server/src/profiles/physics.ts` og `server/src/flashcards/prompt.ts`.
2. **Vise faktisk forbruk i appen:** tokenbruken lagres i dag i `notes.usage`, `decks.usage` og `meta.json` i notatmappen, men bare for siste vellykkede kjøring. «Konverter på nytt» og nye forsøk på en kortstokk overskriver tallene, og import av innholdsfortegnelser og mislykkede forsøk lagres ikke. Feltene synkroniseres heller ikke til klienten, og det finnes verken tidsstempel per kall eller pristabell. En riktig månedssum trenger derfor trolig en egen logg (for eksempel tabellen `usage_log` med tid, type, modell og tokens) som alle Claude-kall skriver til, og et eget API-endepunkt. Den falske Claude rapporterer 0 tokens.
3. **Flere brukere på samme server:** dette gjør at andre elever kan bruke appen. Det krever:
   - brukerkontoer, med `user_id` på fag, notater og kortstokker
   - synk per bruker
   - invitasjon eller registrering
   - en avklaring av hvem som betaler for Claude, og eventuelt kvoter

   Oppgaven er stor, så still oppklaringsspørsmål før du begynner.
4. **Delkapitler for Kjemi 1 og Biologi 1:** når noen har bøkene, importeres innholdsfortegnelsen. Etterpå kan visualiseringene kobles til delkapitlene.
5. **Mer i flashcards:**
   - «Lag flere kort» i en kortstokk som finnes fra før
   - eksport, for eksempel til CSV eller Anki
6. **Mindre hovedbunt:** del koden opp i flere biter.
7. **Sikkerhetskopi fra appen:** eksport av hele databasen og filene fra innstillingene.

## Nyttige kommandoer

```bash
SMARTNOTES_FAKE_CLAUDE=1 npm run dev   # server på :8787, web på :5173, med falsk Claude
npm run typecheck && npm test && npm run build
npm run test:e2e                       # Chromium, PC og mobil
npm run test:e2e:webkit                # Safari og iPad (krever WebKit, som bare finnes i CI-jobben `webkit`)
node web/scripts/viz-shot.mjs --fag kjemi --chapter 3 --out /tmp/shots   # skjermbilder; krever Vite på :5173 (ellers --port)
```

- **Forhåndsvisning av én visualisering uten API-server og innlogging:** `http://localhost:5173/viz-preview.html?fag=kjemi&id=k3-stoffmengde&theme=dark` (krever at Vite kjører, for eksempel med `npm run dev`).
- **Prøve konvertering fra kommandolinjen (bare fysikkprofilen):** `npm run convert --workspace server -- "$PWD/side1.jpg" --out /tmp/test --chapters "1 Fysikk og måling;2 Bevegelse"`. Bruk absolutt sti til bildene, fordi skriptet kjører i `server/`. Dette krever `ANTHROPIC_API_KEY`.
