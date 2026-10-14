# Status for SmartNotes

> **Det eleven skriver i chatten, går alltid foran det som står her.** Denne fila er et øyeblikksbilde som gjør det lett å starte en ny økt uten å miste sammenhengen. Den ble sist oppdatert 14. oktober 2026 (morgen), etter nattarbeidet 13.–14. oktober (#22–#30) og stegene eleven gjorde i Railway og Anthropic Console etterpå (se «Status hos eleven»). Nattarbeidet er ferdig; planen, loggen, morgenrapporten og valgene nattøkta tok på egen hånd, står i [NATTPLAN.md](NATTPLAN.md). Kjør `git fetch origin main && git log origin/main` for å se det som har skjedd etter dette.

Arkitektur og kodekonvensjoner står i [CLAUDE.md](../CLAUDE.md). Elevens egen dokumentasjon står i [README.md](../README.md) og [OPPSETT.md](OPPSETT.md).

## Hva appen er

SmartNotes er en personlig app for en elev på VG2. Eleven tar bilder av håndskrevne notater eller laster opp PDF-er. Claude leser dem og skriver dem om til LaTeX, og serveren lager pene PDF-er. Notatene sorteres etter fag, kapittel og delkapittel i læreboka.

- **Fag:** Fysikk 1, Kjemi 1 og Biologi 1, alle etter LK20, med SmartNotes' egne temaer (ingen lærebok innebygd; eleven kan importere sin egen innholdsfortegnelse). Geofag 1 (LK20, GFG01-03) legges ikke inn av seg selv, men kan legges til med «Legg til fag» → «Fra læreplanen».
- **Hvem bruker den:** eleven (eieren, brukernavn `eier`) har bare Fysikk 1. Kjemi 1, Biologi 1 og Geofag 1 er for andre elever, som kan registrere seg med en invitasjon fra eieren. Per 14. oktober er ingen andre invitert ennå.
- **Hvordan den kjører:** en PWA som fungerer uten nett, og én server (Docker) på Railway som synkroniserer alle enhetene (Mac, PC, iPad og mobil).
- **Språk:** alt eleven ser, er på bokmål: appen, feilmeldingene og PDF-malene. Koden bruker engelske navn.

## Hva appen kan i dag

Alt dette ligger i `main`. Railway legger ut `main` av seg selv, og eleven bekreftet 14. oktober at siste deploy stemmer med `main` (#30). At «Wait for CI» er på under Settings → Source, er ikke uttrykkelig bekreftet (se «Status hos eleven»).

| Funksjon | Kort beskrivelse | Hvor i koden |
|---|---|---|
| Kontoer | Eieren inviterer elever med en kode i Innstillinger. Eleven lager en konto med brukernavn, passord og fag, og ser bare sine egne fag og notater. Eieren ser brukerne med forbruk, lager lenker for nytt passord og kan stenge en konto. Gratiskontoer konverterer med Haiku 5.5. | `server/src/auth.ts`, `server/src/routes/admin.ts`, `web/src/lib/account.ts`, `web/src/pages/settings/AccountAdmin.tsx` |
| Kvoter for gratiskontoer | Per norsk døgn: 15 sider, 2 kortstokker og 3 innholdsfortegnelser med AI, høyst 20 notater i kø, og et felles dagsbudsjett på 30 kroner for alle gratiskontoene. Over kvoten venter notatet til midnatt («Dagens kvote er brukt – konverteres i morgen»). Køen tar notatene fra brukerne etter tur. Eieren har ingen tak. Innstillinger → Konto viser dagens forbruk. | `server/src/quota.ts`, tabellen `quota_log` |
| Personvern og vilkår | Personvernerklæring, vilkår og en side om trygg og ærlig bruk av AI, lenket fra innloggingen, registreringen og Innstillinger. Nye elever godtar vilkårene ved registrering. Ansvarlig og kontakt kommer fra variabler i Railway («[Fylles inn]» når de mangler). PDF-ene merkes «AI-generert med SmartNotes», og «Meld fra» går til kontakten. «Slett kontoen» sletter alt eleven har på serveren. | `web/src/pages/LegalPages.tsx`, `server/src/routes/account.ts` |
| Forside | En kort presentasjon og fagene som kort i fagets farger, med antall notater, når noe sist ble endret og «Fortsett i …». Appen åpner ikke et fag av seg selv. | `web/src/pages/HomePage.tsx` |
| Konvertering | Sider → Claude (bilde) → LaTeX → PDF. Notatet gjengis tro mot originalen, og mulige feil markeres med en merknad i stedet for å rettes. Enkle figurer tegnes på nytt i TikZ, og kompliserte klippes ut. Kompileringsfeil rettes automatisk i inntil to runder for eieren (`LATEX_FIX_ATTEMPTS`) og minst tre for gratiskontoene. | `server/src/pipeline/` |
| Fag og temaer | Kompetansemål (ordrett fra Udir) og egne temaer for fire fag. Deltemaer finnes for Fysikk 1 og Geofag 1; i Kjemi 1 og Biologi 1 kan eleven legge dem inn fra sin egen lærebok. Claude velger tema og eventuelt deltema, og eleven kan flytte notatet selv. «Legg til fag» lager et fag fra læreplanen eller et tomt fag. | `server/src/presets.ts`, `server/src/profiles/`, `web/src/components/NewSubjectDialog.tsx` |
| Import av innholdsfortegnelse | Tekst eller bilder → kapitler med delkapitler, koblet til kompetansemålene. | `server/src/toc.ts`, `web/src/pages/settings/ChapterImport.tsx` |
| Søk | Ctrl/Cmd+K søker i titler og innhold, også uten nett. | `web/src/components/SearchPalette.tsx` |
| Visualiseringer | 129 interaktive forklaringer, ordnet etter kapittel: 56 i fysikk, 31 i kjemi og 42 i biologi. Fysikk kapittel 1–4 har illustrert utseende (ekte gjenstander, lys, skygge og kraftpiler), praktiske situasjoner og to eksempeloppgaver per kapittel, der løsningen vises trinn for trinn. | `web/src/viz/` (les `README.md` der) |
| Flashcards | Eleven velger notater og vanskelighetsgrad, og Claude lager en kortstokk. Eleven vurderer selv hvert svar fra 1 til 4 (Feil, Delvis, Bra, Perfekt). Etter runden velger eleven hva som skal repeteres. Kortstokker og fremgang synkroniseres, og øving fungerer uten nett. | `server/src/flashcards/`, `web/src/flashcards/` |
| Samle-PDF | Et helt kapittel eller hele faget som én PDF med innholdsliste. | `server/src/pipeline/bundle.ts` |
| Offline og synk | Dexie (IndexedDB) er kilden lokalt. Opplastinger uten nett havner i en kø, og PDF-ene hentes på forhånd. | `web/src/db.ts`, `web/src/sync.ts` |
| Rediger LaTeX | Eleven kan se og endre LaTeX-koden og kompilere på nytt. | `web/src/pages/note/LatexTab.tsx` |
| Prøv med Haiku | Et ferdig notat konverteres én gang til med Haiku 5.5 fra de samme sidene, og vises ved siden av den vanlige versjonen. Notatet endres ikke. Haiku tenker grundigere enn Sonnet, og begge får de presise reglene (versjon 4). Eleven vurderer «Haiku er god nok» eller «Sonnet er bedre», og Innstillinger viser oppsummeringen per instruksversjon. | `server/src/pipeline/compare.ts`, `server/src/profiles/precise.ts`, `web/src/pages/ComparePage.tsx` |
| Sikkerhetskopi | Innstillinger → «Sikkerhetskopi» laster ned alt på serveren som én `.tar.gz`: en kopi av databasen (uten innlogginger) og filene til notatene. Viser størrelsen og når kopien sist ble tatt. Gjenoppretting er ikke bygd inn. | `server/src/backup.ts`, `server/src/routes/backup.ts` |
| Forbruk av AI | Hvert AI-kall logges med tokens og beregnet pris, også når det feiler. Innstillingene viser forbruket per måned, per type og per modell. | `server/src/usage.ts`, tabellen `usage_log` |
| AI-leverandør per oppgave | Claude eller en lokal modell gjennom Ollama, valgt per oppgave (konvertering, kort, innholdsfortegnelse). Claude er standard. | `server/src/pipeline/providers.ts`, `ollama.ts` |
| Hjemmemaskin | Serveren kan sende AI-kallene til en PC eller Mac hjemme som kjører Ollama. Av som standard. | `server/src/remote/`, [HJEMMEMASKIN.md](HJEMMEMASKIN.md) |
| Måleverktøy | Sammenligner modeller på elevens egne sider og lager en rapport med karakterfelter. | `npm run eval`, [MALING.md](MALING.md) |
| Design | Tre kolonner på store skjermer, og lyst, mørkt eller systemtema. Hvert fag har sine egne farger og sin egen PDF-mal: fysikk «Blekk» og «Klassisk», kjemi «Tavle» og «Moderne», biologi «Salvie» og «Lærebok», geofag «Fjell» og «Atlas». | `web/src/styles/`, `server/latex/` |

**Claude-oppsett nå:** alle oppgaver går til Claude, med mindre `AI_PROVIDER…` er satt i Railway (se README). Eierens notater konverteres med Claude Sonnet 5.5 med middels grundighet (`effort: medium`). Gratiskontoene konverterer alltid med Claude Haiku 5.5 hos Anthropic (`FREE_CONVERT_MODEL`), med høy grundighet, minst tre rettingsrunder og Sonnet ved avslag, uansett hva `AI_PROVIDER_CONVERT` sier. Alle Claude-modellene får de presise reglene (seksjon 7 i instruksen, `server/src/profiles/precise.ts`, versjon 4): navngitte formelbokser, merknad bare ved sikre feil, `\uleselig` bare når sammenhengen ikke avgjør, utregninger samlet og maler for tegningene i hvert fag. Kortstokker og innholdsfortegnelser bruker Claude Haiku 5.5, som koster en tjuendedel; avslår Haiku, prøves Sonnet. Opus 5.5 er grundigere, men koster det dobbelte, og kan slås på med `CLAUDE_MODEL=claude-opus-5-5`. Se `server/src/config.ts` (`claudeModels`).

**Kostnad (beregnet, ikke målt):** en side koster ca. 0,25 kr, og et notat på 5 sider ca. 1,35 kr. En kortstokk (Haiku 5.5) koster noen få øre (ca. 0,05–0,15 kr), og under 1,50 kr for de største. Vanlig bruk i tre fag koster rundt 40 kr i måneden til Claude, og mindre med bare Fysikk 1. Railway-abonnementet (ca. 55 kr i måneden) har eleven fra før, og forbruket til serveren dekkes helt eller delvis av det som er inkludert i abonnementet. Alle tallene står i dokumentet [Kostnader for SmartNotes](https://claude.ai/code/artifact/e5b19b9d-07c0-4c20-bc21-d453fe1ada01), som er privat for eleven. Det er et Claude Docs-dokument: les det med Claude Docs-verktøyet (`read` med ref `{"object":"project","id":"e5b19b9d-07c0-4c20-bc21-d453fe1ada01"}`, deretter fanen). Artifact-verktøyet viser ikke innholdet.

## Hva som er gjort

Alt ble bygget 4.–14. oktober 2026 og flettet inn i `main` gjennom disse pull requestene:

| PR | Innhold |
|---|---|
| [#1](https://github.com/52c854mb96-ship-it/SmartNotes/pull/1) | Grunnmuren: server, konverteringskø, PWA med offline-synk og opplastingskø, tre kolonner, søk, delkapitler og kompetansemål, 36 fysikkvisualiseringer, import av innholdsfortegnelse, Railway-oppsett og Safari-rettelser. Alle tre fag med læreboksett, instrukser, PDF-mal og fargetema: fysikk («Blekk», «Klassisk»), kjemi («Tavle», «Moderne») og biologi («Salvie», «Lærebok») |
| [#2](https://github.com/52c854mb96-ship-it/SmartNotes/pull/2) | Kjemi 1: 31 visualiseringer for kapittel 1–8, og byggeklosser for kjemi og biologi (`viz/kjemi/kit/`, `viz/biologi/kit/`) |
| [#3](https://github.com/52c854mb96-ship-it/SmartNotes/pull/3) | Biologi 1: alle 42 visualiseringer for kapittel 1–15 ferdig bygget, kontrollert og koblet inn (mange av filene kom allerede med i #2) |
| [#4](https://github.com/52c854mb96-ship-it/SmartNotes/pull/4) | Flashcards: kortstokker fra notatene, øving med vurdering 1–4, repetisjon og effekter |
| [#5](https://github.com/52c854mb96-ship-it/SmartNotes/pull/5) | Billigere Claude: Sonnet 5.5 og middels grundighet som standard |
| [#6](https://github.com/52c854mb96-ship-it/SmartNotes/pull/6) | Overlevering: denne fila og oppstart for nye økter |
| [#7](https://github.com/52c854mb96-ship-it/SmartNotes/pull/7) | Illustrerte visualiseringer, del 1: byggeklosser for illustrert realisme (`viz/kit/scene/`), eksempeloppgaver (`viz/kit/eksempel.tsx`, egen gruppe på sidene) og fysikk kapittel 1–4 (16 oppgraderte, 12 nye praktiske og 8 eksempeloppgaver). Resten står i [VISUALISERINGER-PLAN.md](VISUALISERINGER-PLAN.md) |
| [#8](https://github.com/52c854mb96-ship-it/SmartNotes/pull/8) | Nye versjoner tas i bruk også i Safari på Mac: appen merker selv at serveren har en nyere versjon og sier fra («En ny versjon av SmartNotes er klar»), og ser etter oppdateringer når fanen blir synlig igjen |
| [#9](https://github.com/52c854mb96-ship-it/SmartNotes/pull/9) | Overlevering: workflow-skriptene og katalogene for resten av visualiseringene i `docs/workflows/`, og planen for neste økt |
| [#10](https://github.com/52c854mb96-ship-it/SmartNotes/pull/10) | Feilretting: når eleven byttet notat i notatlisten eller søket, kunne PDF-en til forrige notat bli stående. Hvert notat får nå sin egen visning (`key` i `NotePage.tsx`) |
| [#11](https://github.com/52c854mb96-ship-it/SmartNotes/pull/11) | Forbrukslogg: hvert AI-kall logges (`usage_log`), og forbruket vises i innstillingene |
| [#12](https://github.com/52c854mb96-ship-it/SmartNotes/pull/12) | AI-lag: Claude eller lokal AI (Ollama) per oppgave, og måleverktøyet `npm run eval` |
| [#13](https://github.com/52c854mb96-ship-it/SmartNotes/pull/13) | Hjemmemaskin: kø på serveren og klienten `npm run homeworker`, med rettelser etter en sikkerhetsgjennomgang. Av som standard |
| [#14](https://github.com/52c854mb96-ship-it/SmartNotes/pull/14) | Lokal AI: Qwen3.5 som standard, én side per kall, reparasjon av LaTeX i JSON, riktig cache-pris for Sonnet 5.5, og denne fila |
| [#15](https://github.com/52c854mb96-ship-it/SmartNotes/pull/15) | Navneopprydding: fagoppsett etter læreplanen (`server/src/presets.ts`) med SmartNotes' egne temaer i stedet for lærebøkenes innholdsfortegnelser, og ingen forlagsnavn. De gamle id-ene er aliaser, så eksisterende fag legges ikke inn på nytt |
| [#16](https://github.com/52c854mb96-ship-it/SmartNotes/pull/16) | Haiku 5.5 for kortstokker og innholdsfortegnelser, med Sonnet som reserve ved avslag. Konverteringen blir på Sonnet til sammenligningen er gjort |
| [#17](https://github.com/52c854mb96-ship-it/SmartNotes/pull/17) | Sikkerhetskopi fra appen: «Last ned sikkerhetskopi» i innstillingene, fordi backup av volumet i Railway krever Pro-planen. Retter også et sikkerhetshull fra starten: adresser med prosentkoder (`/%61pi/...`) slapp forbi innloggingen |
| [#18](https://github.com/52c854mb96-ship-it/SmartNotes/pull/18) | Oppfølging etter en ny gjennomgang: filene til notatene skrives atomisk, så kopien holder seg uendret mens den lastes ned, tryggere steg for gjenoppretting, og lagrede PDF-er hentes på nytt etter en gjenoppretting |
| [#19](https://github.com/52c854mb96-ship-it/SmartNotes/pull/19) | «Prøv med Haiku» på notatene: Haiku-versjonen ved siden av den vanlige, med elevens vurdering og en oppsummering i innstillingene |
| [#20](https://github.com/52c854mb96-ship-it/SmartNotes/pull/20) | Haiku-instrukser versjon 2 etter elevens kommentarer på tre notater: eget tillegg for Haiku med navngitte formelbokser, færre merknader, utregninger samlet på én side og TikZ-maler, høyere grundighet, og vurderinger per instruksversjon. Retter også fire feller for alle modeller (LaTeX i metadata slettet figurene, «35 %» kuttet resten av linjen, boksnavn og tomme linjer i formler) |
| [#21](https://github.com/52c854mb96-ship-it/SmartNotes/pull/21) | Nattplanen for 13.–14. oktober ([NATTPLAN.md](NATTPLAN.md)) og elevens beslutninger fra kvelden |
| [#22](https://github.com/52c854mb96-ship-it/SmartNotes/pull/22) | Instrukser versjon 3: de presise reglene (seksjon 7) for alle Claude-modeller, `\uleselig` bare når sammenhengen ikke avgjør, og maler for tegninger i kjemi og biologi |
| [#23](https://github.com/52c854mb96-ship-it/SmartNotes/pull/23) | Opphavsrett: `LICENSE`, lisenslista i appen (Innstillinger → «Om SmartNotes» → «Lisenser»), kompetansemålene kontrollert mot Udir med NLOD-henvisning, og navnet på læreboka bare når brukeren har skrevet det selv |
| [#24](https://github.com/52c854mb96-ship-it/SmartNotes/pull/24) | Geofag 1: fagprofil, PDF-malen «Atlas», fargetemaet «Fjell», kompetansemålene fra Udir og «Legg til fag» fra læreplanen (legges ikke inn av seg selv). Instrukser versjon 4 med enheter uten æ, ø, å og ° i `\qty` og `\unit` |
| [#25](https://github.com/52c854mb96-ship-it/SmartNotes/pull/25) | Forside: kort presentasjon og fagene som kort i fagets farger, «Fortsett i …» og «Legg til fag». Appen åpner ikke lenger et fag av seg selv |
| [#26](https://github.com/52c854mb96-ship-it/SmartNotes/pull/26) | Kontoer på serveren: brukere, invitasjoner, innlogging med brukernavn, eierskap på hver rute, eierens ruter og Haiku for gratiskontoer |
| [#27](https://github.com/52c854mb96-ship-it/SmartNotes/pull/27) | Kontoer i appen: innlogging med brukernavn, registrering med invitasjon, nytt passord, kontobytte på en enhet og eierens sider i Innstillinger |
| [#28](https://github.com/52c854mb96-ship-it/SmartNotes/pull/28) | Kvoter for gratiskontoer: sider, kortstokker og innholdsfortegnelser per norsk døgn, tak på køen, dagsbudsjett, rettferdig kø og utklipp som JPEG |
| [#29](https://github.com/52c854mb96-ship-it/SmartNotes/pull/29) | Personvern og vilkår: egne sider, godkjenning ved registrering, «AI-generert» i PDF-ene og i appen, «Meld fra» og «Slett kontoen» |
| [#30](https://github.com/52c854mb96-ship-it/SmartNotes/pull/30) | Morgenrapporten for natt til 14. oktober (nederst i [NATTPLAN.md](NATTPLAN.md)) |
| [#31](https://github.com/52c854mb96-ship-it/SmartNotes/pull/31) | Status etter natten: hva eleven har gjort i Railway og Anthropic Console, hva som venter, og oppstartsprompten for neste økt. Rettet utdaterte påstander i dokumentene (Geofag 1, delkapitler, ekte Claude), og `FREE_DAILY_BUDGET_NOK=0` slår nå av dagsbudsjettet, slik README sier |

**Tester:** omtrent 2 530 enhetstester (307 på serveren og 2 224 i web-appen, de fleste for modellene bak visualiseringene; kvotene testes med falsk klokke), 39 ende-til-ende-tester i Chromium (PC og mobil, inkludert at en ny versjon tas i bruk, at riktig PDF vises når man bytter notat, at sikkerhetskopien lastes ned, hele flyten for «Prøv med Haiku», lisenssiden, «Legg til fag» med Geofag 1, forsiden, invitasjon og registrering, nytt passord, kontobytte, personvernsidene og «Slett kontoen») og egne tester for Safari og iPad (WebKit). CI kjører tre jobber: `test`, `webkit` og `docker`.

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
- **Kostnad:** Sonnet 5.5 med middels grundighet for elevens egne notater ([PR #5](https://github.com/52c854mb96-ship-it/SmartNotes/pull/5)).
- **Motor per bruker (13. oktober, kveld):** Sonnet lager elevens egne notater, med omtrent de samme konkrete instruksene som Haiku fikk i versjon 2. Andre brukere får Haiku 5.5 med Haiku-tillegget og høy grundighet. Sonnet blir en pro-funksjon når pro bygges. Før det satser vi fullt på gratistilbudet med tak (15 sider og 2 kortstokker per dag) for å bygge en kundebase, og godtar å tape litt penger.
- **Resultatet av Haiku versjon 2 (13. oktober):** Haiku ble god nok på 3 av 3 notater (Virkningsgrad, Kinetisk energi, Potensiell energi), og på Luftmotstand og terminalfart. Eleven synes Haiku er bedre enn Sonnet på enkelte områder, som å vise formlene tydelig med farger. Det eneste som må rettes: Haiku setter `\uleselig` på ord den ikke klarer å tolke helt, og skal heller lese dem ut fra sammenhengen.
- **Kontoer og personvern (13. oktober, kveld):** invitasjonskode som eieren lager i Innstillinger, brukernavn og passord uten e-post, og engangslenke ved glemt passord. Ansvarlig og kontakt i personvernerklæringen og vilkårene kommer fra variabler i Railway; eleven fylte dem inn 14. oktober.
- **Valgene nattøkta tok på egen hånd (14. oktober):** lisensteksten, Udirs skrivemåte for nye fag, lærebøker fra tidligere versjoner, Geofag 1 etter GFG01-03, brukernavnet `eier`, aldersgrensen 15 år, at kortstokker og innholdsfortegnelser for elever går til samme AI som eierens, kontosperren, kvotene, utklipp som JPEG, at `source/` beholdes, slettede notater som gravsteiner, «AI-generert» på PDF-er fra før og driftsloggen. De står med begrunnelse under «Spørsmål til eleven» i [NATTPLAN.md](NATTPLAN.md). Eleven har ikke svart på dem ennå; spør før noe av det endres.
- **Fag og forside (13. oktober, kveld):** Geofag 1 legges til for andre brukere; eleven har bare Fysikk 1. Appen skal ha en forside med en kort presentasjon og fagene som kort, i stedet for å åpne fysikk av seg selv.
- **Haiku 5.5 (12. oktober):** kortstokker og innholdsfortegnelser går til Haiku. Konverteringen per bruker er bestemt 13. oktober (se «Motor per bruker» over).
- **Haiku-instruksene (13. oktober):** etter sammenligning av tre notater (Haiku god nok på 0 av 3) valgte eleven først et eget tillegg for Haiku, så Sonnets instrukser og notater ikke endres (endret samme kveld: Sonnet skal også få dem), høyere grundighet for Haiku, og at sammenligningene lages på nytt i appen og vurderes per instruksversjon. Kommentarene eleven ga: Haiku brukte for få fargede bokser for de sentrale formlene (Sonnet navngir formelen), merket en formel som ble bygd videre på som skrivefeil, delte en utregning over to sider, og klipte ut tegninger der eleven vil ha dem tegnet i TikZ. Eleven liker at Haiku har færre merknader.
- **Prioritet (11. oktober):** å få ned kostnadene, så flere kan bruke appen, går foran visualiseringene. Fysikk kapittel 5–10 haster ikke. Målet er ingen eller lav kostnad, dekket av pro-brukere: en gratisversjon og en betalt pro-versjon med kvoter per dag, og lokal AI der det lønner seg. Planen står på en [privat side for eleven](https://claude.ai/artifact/RyN9UDgBgDiHQdXaFRpvck). Les den med Artifact-verktøyet (`action: "read"`). Den ligger ikke i repoet, fordi repoet er offentlig og planen handler om alder, familie og juss.
- **Første brukere:** venner og klassen.
- **Maskiner for lokal AI:** en PC med RTX 4060 (8 GB) og elevens Mac med M4 og 16 GB. En Mac mini som står på hele døgnet, kan bli aktuell senere. Maskinene står bare på deler av dagen foreløpig.
- **Opphavsrett:** forlagsnavn og bøkenes innholdsfortegnelser skal ut. Bruk bare kilder vi har lov til, som kompetansemålene fra Udir (NLOD). Navneoppryddingen er gjort i #15. Eleven valgte å beholde rekkefølgen i Fysikk 1 og la fagene som allerede finnes, stå som de er.
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
  - Jobb på grenen som øktinstruksene oppgir. Hver økt har fått sin egen, for eksempel `claude/smartnotes-offline-app-j25mqo` og `claude/blissful-lamport-eh0x58`.
  - Lag en PR mot `main`, og flett den selv når CI er grønn. Eleven har godkjent dette: «Ja, flett inn selv».
  - Etter flettingen nullstilles arbeidsgrenen fra `main`.
- **Commit- og PR-tekst:** skriv på bokmål. Bruk attribusjonslinjene som systemet oppgir, og nevn ellers ikke hvilken modell du selv kjører på. Modellene appen bruker (for eksempel `claude-sonnet-5-5` i `server/src/config.ts`), kan nevnes som vanlig.
- **Før push:** kjør `npm run typecheck`, `npm test`, `npm run build` og `npm run test:e2e`, i den rekkefølgen (ende-til-ende-testene bruker det ferdige bygget). CI kjører i tillegg WebKit og Docker. I en ny container må TeX Live installeres først (se `CLAUDE.md`).
- **Hemmeligheter:** be aldri eleven lime inn API-nøkler eller passord i chatten. De hører hjemme i Railway-variabler eller i `.env`.
- **Manuelt arbeid:** eleven ordner selv det som skjer i Railway og Anthropic Console. Gi trinnvise instrukser med nøyaktige verdier som kan kopieres rett inn.
- **Store oppgaver:**
  - Workflows og agenter er greit, så lenge oppgavene er strukturerte og ikke går i beina på hverandre.
  - Natt til 12. oktober fikk Claude lov til å flette alt som er grønt, etter grundig egenkontroll. Store valg som krever eleven (Railway, betaling, juss, navneoppryddingen), venter på eleven.
  - Natt til 14. oktober gjaldt det samme, også for PR-er som endrer databasen, og nattøkta spurte ikke eleven (valgene står under «Spørsmål til eleven» i [NATTPLAN.md](NATTPLAN.md)). Natta er over; nå gjelder de vanlige avtalene over, med oppklaringsspørsmål før en ny funksjon.
  - Hvis eleven ber deg jobbe lenge, for eksempel over natten, sørger du for at arbeidet fortsetter av seg selv når bruksgrensen er nullstilt.
  - Legg vekt på feilsøking og finpuss underveis.
- **Denne fila:** oppdater `docs/STATUS.md` når en større oppgave er ferdig. Oppdater også `CLAUDE.md` når arkitekturen endres.

## Status hos eleven (Railway og Anthropic Console)

Eleven gjør selv det som skjer i Railway og Anthropic Console. Dette er det eleven har sagt i chatten; det som ikke står her, er ikke bekreftet, så spør heller enn å anta.

**Gjort 14. oktober** (stegene i morgenrapporten nederst i [NATTPLAN.md](NATTPLAN.md)):
1. **Steg 1:** siste deploy i Railway stemmer med `main` (#30). Railway legger altså ut `main`; at «Wait for CI» er på under Settings → Source, er ikke uttrykkelig bekreftet.
2. **Steg 2:** sikkerhetskopi tatt etter at den nye versjonen var lagt ut (Innstillinger → «Sikkerhetskopi»).
3. **Steg 3:** `PRIVACY_CONTROLLER_NAME` og `PRIVACY_CONTACT` er satt i Railway. Verdiene står bare der (de er ikke i repoet).
4. **Steg 5:** månedlig grense i Anthropic Console → Settings → Limits er satt. Planen foreslo 20 USD med varsel ved 10 USD; de faktiske verdiene er elevens.

**Venter på eleven** (eleven tar stilling til dem senere; ikke gjør dem, og ikke mas):
1. **Steg 4, prøve registreringen på Railway:** Innstillinger → «Inviter en elev» → «Lag invitasjon», åpne lenken i et privat vindu eller på mobilen, lag en testkonto, last opp ett notat og se at det konverteres, og slett så testkontoen med Innstillinger → Konto → «Slett kontoen». Kontoene er ennå ikke prøvd ende til ende på produksjon.
2. **Steg 6, en voksen leser personvernerklæringen og vilkårene** i appen, og sjekker det erklæringen med vilje ikke påstår noe om: hvilken region Railway-tjenesten og volumet ligger i, hvor lenge Railway beholder driftsloggen, og hva Anthropics vilkår for API-et sier om lagring og trening. Planen anbefaler også at en voksen eier API-kontoen før andre bruker appen.
3. **Steg 7, invitere en annen elev:** lag en ny invitasjon først når eleven skal få den (Innstillinger → «Inviter en elev» → «Lag invitasjon», se «Inviter en elev» i [OPPSETT.md](OPPSETT.md)), og send lenken privat. En invitasjon virker én gang og i 14 dager, så den fra steg 4 kan ikke brukes igjen, heller ikke etter at testkontoen er slettet.
4. **Spørsmålene nattøkta har til eleven** (se «Valg eleven har tatt» over).

**Ellers, ikke bekreftet:**
1. **Hvis eleven bare vil ha Fysikk 1:**
   - Legg til variabelen `SEED_TEXTBOOKS` med verdien `fysikk-1-lk20`.
   - Er Kjemi 1 og Biologi 1 allerede lagt inn, slettes de i appen: tannhjulet på fagsiden → **Slett faget**. Faget legges ikke inn igjen av seg selv. Vil eleven ha det senere, kan det legges til igjen med «Legg til fag» → «Fra læreplanen», med temaene og kompetansemålene, men uten notatene, kortstokkene og en eventuell importert innholdsfortegnelse.
2. **Variabler:** `CLAUDE_MODEL`, `CLAUDE_MODEL_FLASHCARDS`, `CLAUDE_MODEL_TOC` og `CLAUDE_EFFORT` bør ikke være satt, ellers overstyrer de standardverdiene. `TRUST_PROXY_HOPS` skal heller ikke settes (standarden 1 er riktig for Railway). Kvotene (`FREE_*`) har standardverdier og trenger ingen variabler.
3. **Lokal AI og hjemmemaskin** trenger ingen nye variabler før eleven vil prøve dem. Alt er av som standard, og forbruksloggen virker uten oppsett.

## Kjente begrensninger og åpne spørsmål

- **Lokal AI og hjemmemaskinen er ikke prøvd med en ekte modell:** ollama.com og Hugging Face er blokkert i skyøkten, så alt er testet med en falsk AI. Målingen i [MALING.md](MALING.md) må kjøres på elevens egne maskiner.
- **Ikke testet med ekte Claude i skyøktene:** skyøktene har ingen API-nøkkel, så alle tester bruker en falsk Claude (`SMARTNOTES_FAKE_CLAUDE=1`). Eleven har konvertert egne fysikknotater med Sonnet 5.5 på Railway og sammenlignet dem med Haiku (instruksversjon 1 og 2, #19 og #20). Dette er ikke prøvd på ekte notater: de presise reglene i versjon 4 (både for Sonnet og for Haiku), Geofag 1, gratiskontoene (Haiku med høy grundighet), kvotene mot det Anthropic Console viser, og hvor gode kortstokkene blir. Se «Ikke testet med ekte Claude» i morgenrapporten nederst i [NATTPLAN.md](NATTPLAN.md). [OPPSETT.md](OPPSETT.md) forklarer hvordan eleven kan gi skyøktene en nøkkel.
- **Kostnadene er beregnet, ikke målt:** valutakursen (10,50 kr per dollar) og Railway-prisen er omtrentlige, fordi nettverket i økten blokkerte kildene. Det faktiske forbruket står i Anthropic Console under **Usage**.
- **Kjemi 1 og Biologi 1 har bare temaer:** SmartNotes' eget oppsett (#15) har åtte temaer i hvert fag uten deltemaer, så alle visualiseringene i kjemi og biologi har `sections: []` og vises under temaet. I biologi er mappene `kap01`–`kap15` emner som hører til temaene 1–8 (se `web/src/viz/README.md`). Eleven kan importere innholdsfortegnelsen i sin egen bok for å få delkapitler til notatene.
- **Geofag 1 er nytt:** det har ingen visualiseringer ennå, og instruksene og tegnemalene er bare prøvd med falsk Claude (malene kompileres i testene).
- **Visualiseringene er halvveis:** fysikk kapittel 5–10 har ennå det gamle utseendet og mangler nye praktiske visualiseringer og eksempeloppgaver. Kjemi og biologi er ikke påbegynt (et halvferdig forsøk på å pusse opp byggeklossene ble tatt ut igjen før PR #7). Dette venter til kostnadsarbeidet har kommet lenger, etter elevens ønske. Planen og elevens valg står i [VISUALISERINGER-PLAN.md](VISUALISERINGER-PLAN.md), og skriptene står i [docs/workflows/](workflows/README.md).
- **Rottegnet (√) i `FormulaLine`** står litt for lavt. Kapittel 4 retter det lokalt; det bør rettes i `viz/kit/` for alle.
- **De nye visualiseringene er ikke prøvd på en ekte iPad eller iPhone,** bare i WebKit-testene i CI.
- **Kvotene er gjettet, ikke målt:** 15 sider, 2 kortstokker og 3 innholdsfortegnelser per døgn og 30 kroner i dagsbudsjett er planens forslag. De kan endres med variablene `FREE_*` i Railway (se README). Det første notatet i et døgn får starte selv om det har flere sider enn taket.
- **Dagsbudsjettet og grensen i Anthropic Console:** 30 kroner per døgn for gratiskontoene samlet kan over en måned bli mer enn månedsgrensen i Anthropic Console (planens forslag var 20 USD, rundt 210 kroner; elevens faktiske grense står bare der). Når den grensen er nådd, avviser Anthropic alle kall, også eierens konverteringer. Før en større beta bør `FREE_DAILY_BUDGET_NOK` og grensen passe sammen.
- **Personvernerklæringen er ikke juridisk kontrollert:** den er skrevet nøytralt etter det koden gjør, og ansvarlig og kontakt er fylt inn. Den sier ikke hvor Railway kjører serveren (region), hvor lenge Railway beholder driftsloggen, eller hva Anthropic gjør med dataene (den viser til Anthropics egne vilkår). Det skal en voksen sjekke (steg 6, venter på eleven).
- **Registreringen er ikke prøvd på Railway:** invitasjon, registrering, kvoter og «Slett kontoen» er testet i testene (også ende til ende i nettleseren), men ikke på produksjonsserveren (steg 4, venter på eleven).
- **«AI-generert» i PDF-ene:** PDF-er som lages fra 14. oktober, har merket. Et notat som var ferdig fra før, får det når det kompileres på nytt (samle-PDF-ene lages på nytt av seg selv). Notatsiden i appen viser merket for alle notater.
- **Kontoer:** eieren (deg) og elever med invitasjon. Det er ingen e-post i appen, så en lenke for nytt passord går alltid gjennom eieren. Rull ikke tilbake i Railway til en versjon fra før kontoene etter at en elev har registrert seg.
- **Udir:** `data.udir.no` og `www.udir.no` svarer i skyøkta fra 13. oktober (kveld). Kompetansemålene er kontrollert ord for ord mot Grep (se `server/test/fixtures/udir-kompetansemaal.json`).
- **Repoet er offentlig med «alle rettigheter forbeholdt»** (`LICENSE`). Lisensene til pakkene i appen står under Innstillinger → «Om SmartNotes» → «Lisenser». Privat repo senere er fortsatt mulig; det ville trolig bruke opp de gratis CI-minuttene.
- **Flashcards:** trykker eleven «Angre forrige» etter at en ny beste rekke er sendt til serveren, blir rekka ikke lavere igjen, fordi serveren beholder den høyeste.
- **Stor hovedbunt:** hovedbunten i web-appen er rundt 710 kB (ca. 220 kB komprimert). KaTeX og visualiseringene lastes allerede først når de trengs.
- **Sikkerhetskopi:** eleven laster ned kopien selv fra innstillingene (#17). Backup av volumet i Railway krever Pro-planen, og eleven har trolig Hobby (ca. 55 kr i måneden). Gjenoppretting er ikke bygd inn: arkivet pakkes ut, og innholdet legges i `/data` mens serveren står stille (se OPPSETT.md).

## Naturlige neste steg

Dette er bare forslag. Eleven bestemmer rekkefølgen. Detaljene står i bolkene i [planen](https://claude.ai/artifact/RyN9UDgBgDiHQdXaFRpvck).

**Natt til 14. oktober (ferdig):** alle fem fasene i [NATTPLAN.md](NATTPLAN.md) er flettet (#22–#29): kvalitet og opphavsrett, Geofag 1, forside, kontoer, kvoter og personvern. Det som gjenstår før en annen elev registrerer seg, gjør eleven selv (se «Status hos eleven»). Forslagene under er det som kommer etterpå.

1. **Elevens beslutninger:** eleven svarer på det som fortsatt står åpent i del 7 av planen, særlig hvem som eier API-kontoen (planen anbefaler en voksen før betaen; en del av steg 6 i «Status hos eleven», ikke mas om det) og om repoet skal bli privat senere (i dag offentlig med «alle rettigheter forbeholdt», #23). Motoren er bestemt (se «Motor per bruker» over): Sonnet for eierens notater og Haiku 5.5 for gratiskontoene (#26). Ikke spør om den på nytt; lokal AI blir først aktuelt etter målingen (punkt 3).
2. **Etter navneoppryddingen (#15):** sjekk at eleven ikke har fått doble fag, og at visualiseringene fortsatt vises på notatene.
3. **Måling (bolk 1):** eleven kjører `npm run eval` med Sonnet, Haiku og 3–5 lokale modeller på 10–20 egne sider, setter karakterer og sender CSV-fila. Uten dette er alle tall om kvalitet gjetninger.
4. **Haiku (bolk 2):** ferdig for denne runden: Haiku versjon 2 ble god nok på alle notatene eleven vurderte (#20). Rettelsen av `\uleselig` og de presise reglene for Sonnet er flettet (#22, instruksversjon 3; versjon 4 kom med Geofag 1 i #24). Senere tiltak hvis kvaliteten faller: notatet i biter på 2–3 sider per kall, retting som endrer bare linjene med feil, alle kompileringsfeil i én runde, og utklipp i stedet for TikZ når en tegning ikke kompilerer.
5. **Kontoer, kvoter og personvern (bolk 4–6):** ferdig (#26–#29). Neste: en lukket beta for venner og klassen (bolk 7) når stegene i «Status hos eleven» er gjort, og pro-nivået med Sonnet (bolk 12).
6. **Reserven for hjemmemaskinen (bolk 8):** ventetid per nivå og Haiku i stedet for Sonnet. Til da bør `REMOTE_FALLBACK` stå på `none`.
7. **Visualiseringene:** fysikk kapittel 5–10, deretter kjemi, biologi og geofag. Skriptene og fremgangsmåten står i [docs/workflows/README.md](workflows/README.md), og fremdriften i [VISUALISERINGER-PLAN.md](VISUALISERINGER-PLAN.md).
8. **Prøve med ekte Claude:** konverter noen vanskelige fysikknotater og lag et par kortstokker. Se særlig etter om de presise reglene (versjon 4) følges: navngitte formelbokser, få merknader, `\uleselig` bare når sammenhengen ikke avgjør, og tegnemalene. Prøv også en gratiskonto (Haiku med høy grundighet) og Geofag 1. Juster så instruksene etter resultatet: `server/src/profiles/` (`precise.ts` og fagprofilene) og `server/src/flashcards/prompt.ts`.
9. **Delkapitler for Kjemi 1 og Biologi 1:** når noen har bøkene, importeres innholdsfortegnelsen. Etterpå kan visualiseringene kobles til delkapitlene.
10. **Mer i flashcards:** «Lag flere kort» i en kortstokk som finnes fra før, og eksport, for eksempel til CSV eller Anki.
11. **Mindre hovedbunt** og **gjenoppretting av sikkerhetskopi fra appen.**
12. **Spørsmålene fra nattøkta:** for eksempel om alle ferdige notater skal kompileres på nytt, så PDF-ene fra før også får merket «AI-generert», og om navnet ditt skal stå i `LICENSE`.

## Oppstart av en ny økt

Eleven limer inn denne prompten i en ny økt. Den ber Claude lese seg opp og så vente på oppgaven i neste melding:

```text
Hei! Dette er en ny økt i SmartNotes. Før du gjør noe annet:

1. Les `CLAUDE.md`, så `docs/STATUS.md` (særlig «Status hos eleven», «Kjente begrensninger og åpne spørsmål» og «Naturlige neste steg»), og deretter morgenrapporten og «Spørsmål til eleven» i `docs/NATTPLAN.md`. Kjør `git fetch origin main` og `git log --oneline -15 origin/main` for å se om noe er nyere enn STATUS.
2. Ikke endre kode, ikke lag PR og ikke start workflows ennå. Skal du kjøre testene senere i økta, installerer du TeX Live først (kommandoen står i `CLAUDE.md`).

Svar meg så kort, på bokmål:
- status i 3–5 linjer: det som sist er flettet, og hva som kjører på Railway;
- det som venter på meg (stegene i morgenrapporten som ikke er gjort, og spørsmålene nattøkta har til meg);
- 3–5 forslag til hva vi kan gjøre nå, med det du anbefaler først og én setning om hvorfor.

Avslutt med å spørre hva jeg vil gjøre. Oppgaven kommer i neste melding fra meg. Husk avtalene i `CLAUDE.md` og STATUS: bokmål, analogier når noe er nytt, oppklaringsspørsmål samlet før en ny funksjon, PR som du fletter selv når CI er grønn, og aldri be meg lime inn nøkler eller passord.
```

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
