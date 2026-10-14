# Nattplan 13.–14. oktober 2026

> Planen for nattarbeidet som starter i en ny økt 13. oktober ca. kl. 21–22 og fortsetter til alt er ferdig. Eleven bestemte innholdet i chatten 13. oktober (se «Beslutninger»). **Det eleven skriver i chatten, går foran denne fila.** Les også [STATUS.md](STATUS.md) og [CLAUDE.md](../CLAUDE.md).

Nøkkelordet er **«no rush»**: alt bygges strukturert og profesjonelt, med tester og gjennomgang før hver fletting. Arbeidet fortsetter så lenge det er noe igjen, også etter at bruksgrensen er nullstilt.

## Beslutninger (13. oktober, kveld)

Dette er bestemt. Ikke spør eleven om det på nytt.

- **Motor per bruker:**
  - **Elevens egne notater** lages av Sonnet 5.5, med omtrent de samme konkrete instruksene som Haiku fikk i versjon 2. Grundigheten forblir `medium`.
  - **Andre brukere** får Haiku 5.5 med Haiku-tillegget og høy grundighet, slik sammenligningen kjører i dag.
  - **Sonnet blir en pro-funksjon** når pro bygges, men ikke i natt. Før det satser vi fullt på gratistilbudet (med tak) for å bygge en kundebase, og godtar å tape litt penger.
- **Resultatet av Haiku versjon 2:** Haiku ble god nok på 3 av 3 notater (Virkningsgrad, Kinetisk energi, Potensiell energi), og også på Luftmotstand og terminalfart. Det eneste eleven vil ha rettet: Haiku setter `\uleselig` (spørsmålstegn) på ord den ikke klarer å tolke helt. Den skal heller lese ordet ut fra ordene rundt og sammenhengen.
- **Gratistak:** 15 sider og 2 kortstokker per dag (norsk døgn, `Europe/Oslo`). Taket skal kunne endres med en variabel på serveren. Det kan utvides når kundebasen er etablert.
- **Kontoer:** invitasjonskode som eleven (eieren) lager i Innstillinger og sender privat. Den nye brukeren velger brukernavn og passord, uten e-post. Glemt passord løses med en engangslenke som eieren lager.
- **Ansvarlig i personvernerklæringen og vilkårene:** står åpent. Tekstene skrives med en tydelig plassholder for navn og kontakt, som eieren fyller inn senere (helst gjennom variabler på serveren, så det ikke krever ny kode).
- **Nytt fag:** Geofag 1 (LK20). Eleven har selv bare Fysikk 1. Kjemi 1, Biologi 1 og Geofag 1 er for andre brukere.
- **Forside:** appen skal ikke lenger åpne fysikk automatisk, fordi ikke alle har fysikk. Den skal ha en forside som kort forteller hva SmartNotes er, og der brukeren trykker på faget sitt og kommer til fagsiden.
- **Fletting:** flett hver PR selv når CI er grønn, også PR-er som endrer databasen. Eleven tok sikkerhetskopi 13. oktober, og godtar i verste fall å miste én natts arbeid.
- **Test i morgen:** eleven vil gjerne la en annen elev registrere seg 14. oktober. Da må kontoer, kvoter og personvern være ferdige og flettet.

## Slik jobber nattøkta

1. **Oppstart:**
   - Les `CLAUDE.md`, `docs/STATUS.md` og denne fila, med loggen nederst.
   - Installer TeX Live (kommandoen står i `CLAUDE.md`).
   - Sjekk om `data.udir.no` og `www.udir.no` svarer.
2. **Fortsettelse etter bruksgrensen:** lag én rutine med `create_trigger` som vekker denne økta hver time, og noter id-en i loggen. Bruk:
   - cron: `0 * * * *`
   - `initiation`: `human_request`
   - prompt: «Fortsett nattarbeidet etter docs/NATTPLAN.md …»

   Når alt er ferdig og morgenrapporten er skrevet, slett rutinen med `delete_trigger`.
3. **Én fase om gangen, i rekkefølgen under.** Hver fase går slik:
   1. Les koden som berøres.
   2. Skriv en kort design i loggen.
   3. Bygg og skriv tester.
   4. Kjør `npm run typecheck`, `npm test`, `npm run build` og `npm run test:e2e`.
   5. Kjør en gjennomgang med uavhengige kontrollører, der hvert funn etterprøves (Workflow). Rett det som bekreftes, med en test som feiler uten rettelsen.
   6. Lag en PR mot `main` og flett den når CI er grønn.
   7. Nullstill arbeidsgrenen fra `main`.
   8. Oppdater `STATUS.md`, `CLAUDE.md` og loggen.
4. **Store faser kan deles i flere PR-er**, for eksempel kontoer på serveren og kontoer i appen. Hver PR skal stå på egne ben, med grønn CI.
5. **Ikke spør eleven i natt**, eleven sover. Dukker det opp et valg som ikke står her, velg det tryggeste alternativet som er lett å angre. Skriv valget under «Spørsmål til eleven» nederst, og fortsett.
6. **Ting bare eleven kan gjøre** settes på morgenlista nederst, aldri som et hinder midt i natta:
   - steg i Railway og Anthropic Console;
   - juss og avtaler;
   - nettverkstilgang i skymiljøet.
7. **Ingen ekte Claude-kall:** økta har ingen API-nøkkel. Alt testes med `SMARTNOTES_FAKE_CLAUDE=1` og falske tjenester i testene. Si tydelig i PR-ene hva som ikke er testet med ekte Claude.
8. **Databaseendringer:**
   - Bare nye migreringer, aldri endringer i gamle. Ingen sletting av kolonner eller data.
   - Test hver migrering på en database som har dagens `user_version` og ekte innhold: lag den fra skjemaet i `main` med noen fag, notater, kortstokker og sammenligninger, og sjekk at alt er der etterpå.
   - Synkede rader som får nye felt, skal få en ny `db.version` på klienten som nullstiller `meta.syncCursor` (se `CLAUDE.md`).
9. **Commit og push ofte**, minst etter hvert steg, så ingenting går tapt hvis containeren startes på nytt.

## Fasene

### Fase 1: Kvalitet og opphavsrett

**1a. Kvalitet i notatene** (egen PR):
- **`\uleselig` ut fra sammenhengen** (elevens eneste klage på versjon 2). Ny regel i Haiku-tillegget (`server/src/profiles/haiku.ts`, seksjon 7.3):
  - Les et ord ut fra ordene rundt, faget og formelen før `\uleselig` brukes.
  - Bruk `\uleselig` bare når to lesninger fortsatt er mulige og de betyr noe forskjellig.
  - Et ord som kan leses sikkert ut fra sammenhengen, skrives uten markering.
  - Øk `HAIKU_PROMPT_VERSION` til 3, siden versjon 2 er vurdert av eleven, og legg inn det nye fingeravtrykket i `server/test/haiku.test.ts`.
- **Sonnet får de konkrete instruksene:** tillegget gjøres modellnøytralt («Extra rules for this model» → for eksempel «Precise rules»), og legges til for alle Claude-modeller i `systemPromptFor`.
  - Bare for Haiku: `HAIKU_CLOSING` og høy grundighet i sammenligningen.
  - Sonnet beholder `effort: medium`.
  - Ollama-profilene endres ikke.
  - Oppdater testene som i dag sjekker at Sonnet får instruksen uendret, og kommentarene i `haiku.ts` og `CLAUDE.md`.
  - Tenk på hvordan versjonen telles: sammenligningen vurderer Haiku, men elevens egne notater lages nå også med tillegget.
- **Kjemi, biologi og geofag med Haiku:** tillegget har TikZ-maler bare for fysikk.
  - Legg til noen få maler som kompilerer, og test dem i `haiku.test.ts` slik fysikkmalene testes:
    - kjemi: reaksjonsligning med `\ce`, en enkel `chemfig`-struktur og et energidiagram med pgfplots;
    - biologi: krysningsskjema som tabell og et enkelt flytskjema.
  - Ellers gjelder regelen om å klippe ut kompliserte tegninger.

**1b. Opphavsrett** (egen PR):
- **Lisens:** `LICENSE` med «Alle rettigheter forbeholdt» (planens beslutning 10, anbefalt: offentlig repo med egen lisens nå). Nevn den i README.
- **Lisenser for tredjepartskode:** lag en liste over lisensene til pakkene som havner i web-bunten, når appen bygges, og vis den i appen under «Om SmartNotes» → «Lisenser».
  - Sjekk at fonter og ikoner (lucide) har lisenser som tillater dette.
  - Bruk en vanlig, liten løsning, eller et eget skript over `node_modules` under bygging.
- **Kompetansemålene:**
  - Kontroller `FYSIKK1_AIMS` og målene for Kjemi 1 og Biologi 1 ord for ord mot Udirs Grep (`data.udir.no`).
  - Er domenet blokkert, ikke dikt opp eller «rett» noe. Skriv det på morgenlista, så en senere økt gjør det.
- **NLOD:** sjekk at «Om SmartNotes» og der kompetansemålene vises, oppgir kilden slik NLOD krever («Inneholder data under norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Utdanningsdirektoratet»), og at appen sier at den ikke er tilknyttet Udir eller noe forlag.
- **Lærebøker** (rest fra planens bolk 3):
  - Navnet på læreboka skal ikke stå i undertittelen på samle-PDF-ene (`bundle.ts`) med mindre brukeren har skrevet det selv.
  - Det skal bare sendes til AI-en når brukeren har skrevet det selv.
  - Søk etter forlagsnavn i koden: bare aliasene og testene for dem skal gi treff.
- **Eksempeloppgavene i visualiseringene** skal være egne, ikke kopierte (regelen i `CLAUDE.md`). Gjør en rask stikkprøve og noter resultatet.

### Fase 2: Geofag 1

En PR, eller to om den blir stor. Den skal følge det som er bygget for opphavsrett og kvalitet i fase 1.
- **Ny profil `geoscience`:**
  - `shared` (`SubjectProfile`), `server/src/profiles/geoscience.ts`, registrering i `profiles/index.ts` og `web/src/lib/subjects.tsx`.
  - Systeminstruksen dekker det geofag-notater har: kart og profiler, bergartenes kretsløp, platetektonikk, vær og klima, hav og strømmer, enheter og diagrammer.
  - Hold instruksen fri for datoer og id-er, så den caches.
  - Lag `tocPrompt` gjennom `toc-prompt.ts`.
- **PDF-mal og fargetema:**
  - `server/latex/geoscience/preamble.tex` med eget uttrykk, og samme bokser og makroer som de andre malene (`formel`, `definisjon`, `eksempel`, `oppgave`, `losning`, `husk`, `merknad`, `\uleselig`, `\originalfigur`).
  - Fargetema i `web/src/styles/subjects.css` og tidlig i `index.html`, slik kjemi «Tavle» og biologi «Salvie» er laget. Gi det et eget navn.
- **Fagoppsett i `server/src/presets.ts`:** `geofag-1-lk20` med kompetansemålene for Geofag 1 (GEO01-02, fra Udir, ordrett) og SmartNotes' egne temaer og deltemaer. Ingen lærebok eller innholdsfortegnelse fra en bok.
  - Kan ikke målene hentes fra Udir, bygg resten. Legg inn målene med en tydelig merknad om at de ikke er kontrollert, og en test eller sjekk som minner om det. Skriv det på morgenlista.
  - **Geofag 1 skal ikke legges inn automatisk** i elevens eksisterende database (eleven har ikke faget). Sjekk hvordan `SEED_TEXTBOOKS` og `seeded_presets` virker i `db.ts`, og sørg for at et nytt oppsett ikke dukker opp hos eksisterende brukere uten at de velger det.
  - Nye brukere velger fag ved registrering (fase 4). Eieren kan legge faget til selv. Finnes det ingen måte å legge til et fag fra et oppsett i appen, lag «Legg til fag» med valg mellom oppsettene.
- **Haiku-tillegget for geofag:**
  - tegn enkle profiler og klimadiagram på nytt (pgfplots);
  - klipp ut kart og fotografier;
  - malene kompileres i testene.
- **Visualiseringer for geofag** er ikke med i natt. Skriv det som et senere steg i STATUS.
- **Tester:** profiltestene, seedingen (ingen doble fag, ikke lagt inn hos eksisterende brukere), malene, `samlet.test.ts` (går over alle profiler) og ende-til-ende-testen for fag og fargetema.

### Fase 3: Forside

Egen PR, før kontoene.
- **I dag** sender `web/src/pages/HomePage.tsx` brukeren rett til forrige fag eller det første faget, altså fysikk for eleven. Det skal bort.
- **Den nye forsiden:**
  - kort forteller hva SmartNotes gjør, med noen få setninger og rolig uttrykk;
  - viser brukerens fag som kort i fagets farger, med antall notater, sist endret og en lenke til fagsiden;
  - kan ha en liten «Fortsett der du slapp»-lenke, men sender ikke brukeren videre av seg selv;
  - har «Legg til fag» (fra oppsettene, se fase 2) og den tomme tilstanden for en bruker uten fag.
- **Sidepanelet og logoen** fører til forsiden.
- **Følg UI-reglene:** stor forbokstav bare i starten av setninger og navn, ingen emojier, bare CSS-variabler, tre kolonner på store skjermer, og fungerer på mobil og iPad.
- **Ende-til-ende-tester:**
  - åpne appen → forsiden;
  - trykk på et fag → fagsiden;
  - ingen automatisk videresending.
- **I fase 4** får innloggingssiden også en kort presentasjon av appen (de fire fagene, lukket beta med invitasjon), og forsiden viser fagene til brukeren som er logget inn.

### Fase 4: Kontoer

Planens bolk 4, tilpasset beslutningene over. Trolig to PR-er: server og app.
- **Database:**
  - Tabellene `users` (plan `owner` | `free`, med plass til `pro` senere) og `invites`.
  - `user_id` på alle tabeller med brukerdata: `sessions`, `subjects`, `chapters`, `notes`, `decks`, `cards`, `usage_log`, `note_comparisons`, `comparison_ratings` og eventuelle andre.
  - Indeksen `(user_id, rev)`.
  - En rad uten `user_id` er usynlig for alle.
- **Eieren:**
  - Eieren er bruker nr. 1 og får alle eksisterende data.
  - Enhetene som er logget inn i dag, skal forbli innlogget og trenger ingen ny synk.
  - Eieren logger inn med `APP_PASSWORD` som før. Bestem et brukernavn for eieren (for eksempel valgt i Innstillinger, med en standardverdi), og skriv i OPPSETT hvordan eieren logger inn på en ny enhet.
- **Eierskap:**
  - `Repo` får eierskapssjekk overalt (`forUser`).
  - `Repo.sync` filtrerer på `user_id`. Tett hullene planen nevner: `getNoteByClientId`, `applyProgress` og `repo.sync(0)` i `library.ts`.
  - Lag en tabelldrevet test der bruker B prøver bruker A sine id-er på **hver** rute og skal få 404.
- **Innlogging:**
  - Brukernavn og passord med scrypt (`node:crypto`).
  - Sperre ved feil passord per konto. I dag stenger 50 feil ute alle.
  - `trustProxy` med riktig antall ledd.
  - Auth-hooken bestemmer fortsatt ut fra ruten (`req.routeOptions.url`).
- **Invitasjoner:**
  - Eieren lager en kode i Innstillinger («Inviter en elev»), som gjelder én gang i 14 dager. Eieren ser koden, kopierer den og kan trekke den tilbake.
  - Registrering med kode, brukernavn, passord og fagvalg (Fysikk 1, Kjemi 1, Biologi 1, Geofag 1).
  - Aldersspørsmål ved registrering med grense 15 år (planens anbefaling; legg den i en variabel og noter den under «Spørsmål til eleven»).
- **Eierens adminside i Innstillinger:**
  - liste over brukere med plan, opprettet og forbruk;
  - engangslenke for nytt passord;
  - stenge en konto.
- **Modell per plan:**
  - eier: konverteringsmodellen (`CLAUDE_MODEL`, Sonnet) med instruksene fra fase 1a;
  - `free`: Haiku 5.5 med Haiku-tillegget og høy grundighet;
  - kortstokker og innholdsfortegnelser: Haiku for alle, som i dag.
  - Reserve ved avslag som i dag (`RefusalFallback`). Skriv på morgenlista at et avslag hos en gratisbruker da går til Sonnet.
- **Bare for eieren:** «Prøv med Haiku» og sammenligningen, sikkerhetskopi (hele databasen) og forbruket for alle.
- **Appen:**
  - `web/src/sync.ts` lagrer konto-id-en i Dexie.
  - En enhet uten lagret konto-id (eierens enheter i dag) tar over som eier og beholder opplastingskøen.
  - Logger en *annen* konto inn, tømmes de lokale dataene, også køen og bufferen. Si fra i appen først.
- **Dokumentasjon:** OPPSETT (slik inviterer du en elev), STATUS («Bare én bruker» fjernes) og CLAUDE.md.

### Fase 5: Kvoter og personvern

Planens bolk 5a og 6. To PR-er.

**5a. Kvoter og ro på serveren:**
- **Gratistak:**
  - `FREE_PAGES_PER_DAY=15` og `FREE_DECKS_PER_DAY=2` som standard, telt per norsk døgn.
  - Eieren har ikke tak.
  - Sidene telles når konverteringen starter (også «Konverter på nytt»).
- **Over taket:**
  - Aldri `429` til opplastingskøen, for da prøver appen på nytt i det uendelige.
  - Notatet venter heller til i morgen og viser «Dagens kvote er brukt – konverteres i morgen».
  - En kortstokk over taket får en tydelig norsk melding.
- **Innholdsfortegnelse med AI:** et lite dagstak for gratisbrukere (for eksempel 3, i en variabel). Noter det under «Spørsmål til eleven».
- **Rettferdig kø:** `claimNextQueued` tar neste bruker etter tur, ikke bare det eldste notatet. Legg også et tak på antall notater i kø per gratisbruker.
- **Pengegrense:** et dagsbudsjett for gratisbrukernes samlede AI-forbruk, i en variabel med en standard på noen titalls kroner. Over budsjettet venter gratisjobbene til neste dag. Eieren rammes aldri.
- **Lagring:** utklipp som JPEG der det er trygt. Slett `source/` etter vellykket konvertering bare hvis «Konverter på nytt» og sikkerhetskopien virker uten den (sjekk koden).
- **Forbruksloggen** får `user_id` og antall sider.
- **Tester:**
  - falsk klokke rundt midnatt;
  - kvoten brukt opp;
  - to brukere med full kø får tur annenhver gang.

**5b. Personvern og vilkår:**
- **Tekstene:**
  - Personvernerklæring og vilkår på enkel bokmål, som egne sider i appen.
  - Lenker på innloggingssiden og i Innstillinger.
  - Brukeren må godta dem ved registrering.
  - Ansvarlig og kontakt er plassholdere som fylles fra variabler på serveren, for eksempel `PRIVACY_CONTROLLER_NAME` og `PRIVACY_CONTACT`, med synlig «[Fylles inn]» når de mangler.
- **Vilkårene:**
  - last bare opp det du har rett til;
  - bare til egen læring, og ingen deling;
  - ikke lever AI-tekst som eget arbeid der det ikke er lov;
  - innhold kan fjernes etter varsel.
- **Personvernerklæringen** sier hva som lagres, at notatene sendes til Anthropic for konvertering og ligger på Railway, hvor lenge data beholdes, og hvordan man sletter.
  - Ikke påstå noe om Anthropic eller Railway som ikke er sjekket. Skriv heller nøytralt og sett det på morgenlista.
- **I appen:**
  - merket «AI-generert» på notater og PDF-er, for eksempel diskret i bunnteksten;
  - en kort side om trygg og ærlig bruk av AI i skolearbeidet;
  - en «Meld fra»-lenke til kontakten.
- **«Slett konto»** sletter brukerens rader og filer, og testes. Eieren kan ikke slette seg selv.
- **Forbruksloggen** skal ikke inneholde noe innhold fra notatene (sjekk).

## Klar for en testelev?

Eleven vil la en annen elev registrere seg 14. oktober. Dette må være på plass først:

- fase 4 og 5 er flettet og lagt ut på Railway;
- en invitasjon er laget og registreringen testet ende til ende;
- tak, kø og «Slett konto» virker.

Skriv tydelig i morgenrapporten om alt dette er på plass, og hva som eventuelt mangler.

## Morgenlista: det eleven gjør selv

**Før nattøkta starter:**
1. **Sikkerhetskopi:** Innstillinger → «Sikkerhetskopi» → last ned. Den forrige er fra tidligere i dag, og notatene etterpå er ikke med i den.
2. **Nettverkstilgang for Udir:** i miljøet for skyøkta (miljømenyen i tittellinjen → Edit → Network access), legg til disse under Allowed domains, og la «Allow package managers» stå på:
   ```
   data.udir.no
   www.udir.no
   ```

**Om morgenen** (nattøkta fyller ut lista):
- Les morgenrapporten nederst i denne fila.
- **Før en annen elev logger inn:**
  - fyll inn ansvarlig og kontakt: variablene `PRIVACY_CONTROLLER_NAME` og `PRIVACY_CONTACT` i Railway (steg i OPPSETT.md, «Personvern og vilkår»);
  - sjekk det personvernerklæringen ikke påstår noe om, fordi det ikke kunne sjekkes i natt: hvilken region Railway-tjenesten og volumet ligger i (Settings i Railway), hvor lenge Railway beholder driftsloggen, og hva Anthropics vilkår for API-et sier om lagring og trening på dataene;
  - la gjerne en forelder lese personvernerklæringen og vilkårene;
  - sett en månedlig grense i Anthropic Console → Settings → Limits (planens forslag: grense 20 USD, varsel ved 10 USD);
  - planen anbefaler også at en voksen eier API-kontoen før andre bruker appen.
- **Ikke rull tilbake** i Railway (Deployments → Redeploy på en gammel versjon) til en versjon fra før kontoene etter at en elev har registrert seg: den gamle versjonen kjenner ikke kontoene og ville vist elevens fag og notater som dine.
- **Avslag hos en gratiskonto:** avslår Haiku et notat (sikkerhetsfilteret), prøves det på nytt med Sonnet, som koster mer. Det er som for kortstokkene i dag.

## Spørsmål til eleven

Nattøkta skriver her de valgene den har tatt på egen hånd, så eleven kan se over dem om morgenen.

- **Lisensen** nevner GitHub-kontoen (52c854mb96-ship-it) som rettighetshaver, ikke navnet ditt, fordi repoet er offentlig. Vil du ha navnet ditt der, endrer du første linje i `LICENSE`.
- **Fysikk 1 KM3:** Udir skriver selv «problemsstillinger» (med s). Nye fag får Udirs skrivemåte ordrett; faget ditt har fortsatt «problemstillinger». Vil du ha det likt Udir, kan faget legges inn på nytt eller målet rettes i en senere økt.
- **Lærebøker som tidligere versjoner la inn** («ERGO Fysikk 1» og lignende) vises ikke lenger i samle-PDF-ene og sendes ikke til AI-en. Bruker du faktisk den boka og vil ha navnet med, skriver du det på nytt i faginnstillingene med litt annen tekst, for eksempel «ERGO Fysikk 1, Aschehoug».
- **Geofag 1** er etter Udirs læreplan GFG01-03. Planens «GEO01-02» er geografi, og GFG01-02 er utgått.
- **Brukernavnet ditt** er `eier`. Du kan fortsatt logge inn med passordet alene (tomt brukernavn), og du kan endre navnet i Innstillinger → Konto.
- **Aldersgrensen** er 15 år, som planen anbefalte (`MIN_AGE` i Railway).
- **Kortstokker og innholdsfortegnelser for andre elever** går til den samme AI-en som dine (standard Haiku hos Anthropic). Slår du på hjemmemaskinen for disse oppgavene, gjelder det også elevene, og notatene deres behandles da på din maskin. Konverteringen deres går alltid til Haiku hos Anthropic.
- **Kvotene for gratiskontoer** (kan endres med variabler i Railway): 15 sider (`FREE_PAGES_PER_DAY`), 2 kortstokker (`FREE_DECKS_PER_DAY`) og 3 innholdsfortegnelser med AI (`FREE_TOC_PER_DAY`) per døgn, høyst 20 notater i kø (`FREE_QUEUE_MAX`) og et felles dagsbudsjett på 30 kroner (`FREE_DAILY_BUDGET_NOK`). Det første notatet i et døgn får starte selv om det har flere sider enn taket.
- **Utklipp** lagres som JPEG når det sparer minst 30 prosent, ellers som PNG. **Originalfilene** (`source/`) slettes ikke etter konverteringen, fordi «Konverter på nytt», «Prøv med Haiku» og sikkerhetskopien trenger dem.
- **Slettede notater:** bildene og PDF-ene slettes med en gang, men tittelen og teksten blir liggende i databasen merket som slettet (det trengs for synken til enhetene) til eleven sletter kontoen. Personvernerklæringen sier det.
- **«AI-generert» på PDF-er fra før:** merket kommer når notatet kompileres på nytt. Jeg har ikke kompilert alle notatene dine på nytt i natt (det ville tatt tid på serveren og endret PDF-ene uten at du ba om det). Si fra hvis du vil det.
- **Driftsloggen** på serveren (Railway) har IP-adressen og adressen til hver forespørsel, som den har hatt hele tiden. Den slettes ikke ved «Slett kontoen». Personvernerklæringen sier det.
- **Kontosperren** gjelder nå også deg: 10 feil passord fra nye enheter i løpet av et kvarter sperrer kontoen for nye enheter i et kvarter. Enheter du har logget inn fra før, slipper alltid inn. Før kontoene stengte 50 feil ute alle.

## Logg

Nattøkta skriver hva den har gjort, med tidspunkt, PR-lenker og hva som er neste steg, slik at arbeidet kan fortsette fra hvilken som helst økt.

- 13. oktober, kveld: planen er laget i økta som flettet #20. Nattøkta har ikke startet.
- 13. oktober kl. 21.13: nattøkta har startet.
  - Rutine for vekking hver time: `trig_012T5E4abuLufG4xWyNs5BfB` (cron `13 * * * *` UTC, bundet til denne økta). Slettes med `delete_trigger` når morgenrapporten er skrevet.
  - Udir svarer nå: `data.udir.no` (JSON for FYS01-02 hentet) og `www.udir.no` (200). Kompetansemålene kan kontrolleres i fase 1b og hentes for Geofag 1 i fase 2.
  - TeX Live installeres. Neste steg: fase 1a (kvalitet i notatene).
- Kl. 21.30, fase 1a (kvalitet i notatene), design:
  - `profiles/haiku.ts` → `profiles/precise.ts`, «de presise reglene» (`# 7. Precise rules`). `systemPromptFor` legger dem til for alle `claude-*`-modeller (`usesPreciseRules`); Ollama får grunninstruksen som før. `Profile.haikuAddendum` → `preciseRules`.
  - Ny seksjon 7.4 om utydelig håndskrift: les ut fra sammenhengen, skriv ordet uten markering når én lesning gir mening, og bruk `\uleselig` bare når to lesninger med ulik mening er mulige. Den erstatter uttrykkelig regelen i seksjon 1, og en test sjekker at hvert «replaces "…"» siterer grunninstruksen ordrett.
  - Maler i 7.7: kjemi (`\ce` med tilstander og ΔH, likevekt, `chemfig` for etanol, energidiagram i TikZ, titreringskurve i pgfplots) og biologi (krysningsskjema som tabell, flytskjema, kretsløp). De kompileres i testene, og jeg har sett på PDF-ene.
  - Bare Haiku får `HAIKU_CLOSING` (nå også med regelen om `\uleselig`). Sonnet og Opus avslutter med `CLOSING` («Svar med <latex> og <metadata> som beskrevet», samme rekkefølge som 7.1) og beholder `effort: medium`.
  - Versjon: `PROMPT_VERSION` = 3 teller hele instruksen (reglene for alle Claude-modeller, Haikus avslutning og oppsettet i sammenligningen). En sammenligning vurderer fortsatt Haiku; den vanlige versjonen av et notat har reglene bare hvis den er konvertert etter at versjon 3 er lagt ut. Ingen databaseendring.
  - typecheck, test (213 + 2204), build og e2e (20) er grønne. Gjennomgang med kontrollører pågår.
- Kl. 22.45, fase 1a, gjennomgang (Workflow med fire kontrollører og én skeptiker per funn, 16 agenter): 12 funn, 4 bekreftet, alle rettet med test:
  - Rettingsinstruksen sa at en figur i en boks er en typisk feil, mens reglene nå tillater det (det kompilerer). Fjernet i alle tre fag; nye tester: rettingsinstruksen gir ingen råd reglene opphever, og en figur i hver boks kompilerer med alle malene.
  - ΔH-pila i energidiagrammet gikk gjennom «Produkter» når reaksjonen er endoterm. Flyttet; test på avstanden.
  - CLAUDE.md og `ollama.ts` sa at Ollama får de samme instruksene som Claude, og at metadata kommer først. Rettet.
  - I tillegg tre presiseringer som skeptikerne avviste, men som er billige: kjemimalene kan bruke syntaks fra seksjon 3 og 4, 7.3 viser til feilene seksjon 1 nevner (også ubalanserte likninger), og helt uleselig tekst skrives fortsatt `\uleselig{[uleselig]}`. Krysningsskjema som rutenett stemmer nå med seksjon 3 i biologi.
  - Fingeravtrykket for versjon 3 er oppdatert (versjonen er ikke lagt ut ennå).
- Fase 1b bygges parallelt i en egen arbeidskopi (`/home/user/sn-1b`, lokal gren `local/fase-1b`), og fase 2 i `/home/user/sn-2` oppå 1a og 1b. De flettes inn i rekkefølge etter at 1a er flettet.
- Kl. 22.28: PR [#22](https://github.com/52c854mb96-ship-it/SmartNotes/pull/22) (fase 1a) er flettet etter grønn CI, og grenen er nullstilt fra `main`.
- Fase 1b (opphavsrett), design og resultat:
  - `LICENSE` (alle rettigheter forbeholdt; navnet på eieren står ikke, bare GitHub-kontoen) og `"license": "UNLICENSED"` i package.json. Omtalt i README.
  - Lisenslista lages under byggingen (`web/build/licenses.ts`, ingen nye pakker): alle moduler fra `node_modules` som er med i bunten (også CSS), kopierte filer, hjelpekoden fra Vite og rolldown, service workeren (Workbox, workbox-build og modullasteren), fonter (KaTeX-fontene under SIL OFL 1.1) og kode som er bakt inn i en pakke (core-js i pdf.js). En lisens som ikke er godkjent, eller en font uten oppføring, stopper byggingen. Vises under Innstillinger → «Om SmartNotes» → «Lisenser».
  - Kompetansemålene for Fysikk 1, Kjemi 1 og Biologi 1 er kontrollert ord for ord mot Udirs Grep (bokmål): alt stemmer, bortsett fra Fysikk 1 KM3, der Udir selv skriver «problemsstillinger». Appen bruker nå Udirs skrivemåte for nye fag; elevens eksisterende fag er ikke endret (se «Spørsmål til eleven»). En test sammenligner med Udir-data i `server/test/fixtures/udir-kompetansemaal.json`.
  - NLOD-henvisning med lenke til lisensen og data.udir.no der kompetansemålene vises og i «Om SmartNotes», og at appen ikke er tilknyttet Udir eller noe forlag.
  - Læreboka i faget står i samle-PDF-ene og sendes til AI-en bare når brukeren har skrevet den selv; lærebøkene tidligere versjoner la inn («ERGO Fysikk 1» osv.), kjennes igjen og regnes ikke med. Feltet i faget endres ikke.
  - Forlagsnavn i koden: en test sjekker at de bare står i de gamle id-ene og lærebøkene som kjennes igjen.
  - Stikkprøve av eksempeloppgavene i visualiseringene (4 av 8: kast fra balkong, trinse, akebakke, ballistisk pendel): egne tekster og egne tall i klassiske situasjoner, uten henvisninger til bøker eller eksamener.
  - Gjennomgang (18 agenter): 15 funn, 9 bekreftet og rettet med tester (KaTeX-fontene stod som MIT, CSS fra pakker ble ikke sjekket, core-js i pdf.js manglet, modullasteren i service workeren manglet, NOTICE-filer, SPDX-uttrykk med parenteser, NLOD uten lenke, fontomtalen og en gammel rad i README).
  - Geofag 1 er etter Udir GFG01-03 (kompetansemålsett KV972, 12 mål). Planens «GEO01-02» er geografi, og GFG01-02 er utgått.
- Kl. 22.52: PR [#23](https://github.com/52c854mb96-ship-it/SmartNotes/pull/23) (fase 1b) er flettet etter grønn CI. Tidene i loggen er norsk tid (kl. 23.20 over var feil; #22 ble flettet 22.28).
- Fase 2 (Geofag 1), design og resultat (bygget i `/home/user/sn-2` mens 1b ventet på CI, så lagt oppå `main`):
  - Ny profil `geoscience`: systeminstruks for kart og profiler, bergartenes kretsløp, platetektonikk, vær og klima, hav og strømmer (uten datoer og id-er), `tocPrompt` gjennom `toc-prompt.ts`, PDF-malen «Atlas» (`server/latex/geoscience/preamble.tex`: Charter og grotesk i overskriftene, samme bokser og makroer som de andre, mhchem, pgfplots og mønstre) og fargetemaet «Fjell» (rust og leire på steingrått, også tidlig i `index.html`). Ingen visualiseringer ennå (`[]` i registeret).
  - Fagoppsettet `geofag-1-lk20`: de 12 kompetansemålene i GFG01-03 ordrett fra Udir (kontrollert mot Grep, lagt til i Udir-testen) og SmartNotes' egne 9 temaer med deltemaer. Ingen lærebok.
  - Geofag legges ikke inn av seg selv: `DEFAULT_SEED_PRESETS` er nå de tre fagene som fantes, og et nytt oppsett skal aldri inn i den lista. «Legg til fag» har fått valget «Fra læreplanen» (`GET /api/presets`, `POST /api/subjects/from-preset`, `Repo.addPreset`, som også merker oppsettet som lagt inn). Fag eleven har, kan ikke velges en gang til.
  - De presise reglene for geofag (7.7): klimadiagram (søyler og kurve med to akser), terrengprofil, lagrekke og kretsløp tegnes på nytt; kart, landskapsskisser og bilder klippes ut. Malene er uten farger, og etikettene i lagrekka står fast i forhold til søylen. Ny regel for alle fag: enheter i `\qty` og `\unit` har bare a–z, fordi siunitx mister æ, ø, å og ° uten feilmelding. Normalisereren retter det samme i ettertid (`°C` → `\degreeCelsius`, ellers tallet med enheten som tekst).
  - `PROMPT_VERSION` = 4 (versjon 3 er lagt ut), med nytt fingeravtrykk.
  - Gjennomgang (Workflow med tre kontrollører og én skeptiker per funn): 12 funn, 10 bekreftet (to var samme funn om farger) og rettet med tester: dokumentasjonen av `SEED_TEXTBOOKS`, farger i malene, eval-feilmeldingen manglet geofag, «Legg til fag» ventet på hele synken uten å vise at den jobbet og navigerte etter at dialogen var lukket, fokus i dialogen, ukjent profil i oppsettlista, e2e-testen var avhengig av rekkefølgen på prosjektene, enheter med æ, ø, å og °, og etikettene i lagrekka.
  - typecheck, test (239 + 2214), build og e2e (24) er grønne lokalt etter at fase 2 ble lagt oppå `main`.
  - Etter at fase 2 ble lagt oppå `main`: rettingsinstruksen for geofag sa fortsatt at en figur i en boks er en typisk feil (rettet i de andre fagene i #22); fjernet, og testen for det går over alle fag.
- Kl. 23.25: PR [#24](https://github.com/52c854mb96-ship-it/SmartNotes/pull/24) (fase 2, Geofag 1) er flettet etter grønn CI.
- Fase 3 (forside), design og resultat:
  - `HomePage.tsx` sender ikke lenger brukeren videre. Forsiden har en kort presentasjon («Ta bilde av de håndskrevne notatene dine …»), fagene som kort i fagets farger (ikon, navn, antall notater og «Sist endret», fra Dexie så det virker uten nett), «Fortsett i …» som snarvei til faget brukeren sist var i, «Legg til fag» og en tom tilstand uten fag.
  - Logoen i sidepanelet og i topplinjen på mobil fører til forsiden. Etter innlogging går appen til siden brukeren var på vei til, ellers til forsiden.
  - Fargene på kortene kommer fra egne `--profile-*`-variabler per fag i `styles/subjects.css`, også i mørkt tema.
  - E2e: alle testene åpner fagene fra forsiden (`openSubjectFromHome` i `e2e/helpers.ts`), og `forside.spec.ts` sjekker forsiden, trykk på et fag, logoen og at ingenting sender brukeren videre.
  - Gjennomgang (tre kontrollører og én skeptiker per funn): 5 funn, 2 bekreftet og rettet med tester: «Fortsett i …» fulgte bare fagsiden, ikke kapitler, notater og søket (flyttet til `AppShell`, `lib/lastSubject.ts`), og kortene viste «Ingen notater ennå» et øyeblikk før tallene kom. I tillegg venter e2e-hjelperen nå til innloggingen er ferdig (avvist som feil, men billig).
  - typecheck, test (239 + 2216), build og e2e (26) er grønne lokalt.
- Kl. 23.58: PR [#25](https://github.com/52c854mb96-ship-it/SmartNotes/pull/25) (fase 3, forside) er flettet etter grønn CI.
- Fase 4 (kontoer), serverdelen, design og resultat (bygget i `/home/user/sn-4` mens fase 2 og 3 ventet):
  - Migrering 7: `users` (eieren er bruker 1 med brukernavnet `eier` og får alt som finnes), `user_sessions` (innloggingene fra før kopieres, så enhetene forblir innlogget; den gamle tabellen blir stående for en tilbakerulling), `user_devices`, `invites` og `password_resets`. `user_id INTEGER NOT NULL DEFAULT 1` på fag, kapitler, notater, kortstokker, kort, sammenligninger, vurderinger og forbruksloggen, indeksen `(user_id, rev)`, og triggere som hindrer at eieren av en rad endres. Ingen rad får ny `rev`, så ingen enhet trenger ny synk. Testet på en database med dagens versjon og ekte innhold.
  - Eierskap: alle rutene går gjennom `repo.forUser(id)` (`UserRepo`), som sjekker eieren før noe leses eller endres og svarer 404 ellers. `ROUTE_ACCESS` i `auth.ts` gir hver rute en tilgang (offentlig, bruker, eier, hjemmemaskin), og serveren starter ikke hvis en rute mangler. En tabelldrevet test lar brukerne prøve hverandres id-er på hver rute i fire retninger (elev mot elev, elev mot eier, eier mot elev), og sjekker at ingenting endres.
  - Innlogging: brukernavn og passord (scrypt). Eieren bruker `APP_PASSWORD` med tomt brukernavn eller sitt eget, som før. Grenser per adresse, per adresse og brukernavn, og per konto for nye enheter (enheter som har logget inn før, er unntatt, så ingen kan sperre en elev ute). `trustProxy` stoler på ett ledd (`TRUST_PROXY_HOPS`).
  - Invitasjoner (kode som vises én gang, gjelder én gang i 14 dager), registrering med alder (15 år) og fagvalg, engangslenke for nytt passord (48 timer, logger ut overalt), og eierens ruter for brukere, invitasjoner, stenging og eget brukernavn.
  - Modell per plan: gratiskontoer konverterer med Haiku 5.5 hos Anthropic (høy grundighet, minst tre rettingsrunder, Sonnet ved avslag), uansett hva `AI_PROVIDER_CONVERT` sier; eieren med Sonnet som før. Forbruksloggen får `user_id` og antall sider.
  - Kl. 00.20: PR [#26](https://github.com/52c854mb96-ship-it/SmartNotes/pull/26) (kontoer på serveren) er laget, og flettet kl. 00.32 etter grønn CI.
  - Gjennomgang (fire kontrollører og én skeptiker per funn, 21 agenter): 17 funn, 12 bekreftet (noen var samme funn fra flere) og rettet med tester: forsøk på innlogging sendt samtidig slapp forbi grensene (nå telles de før passordsjekken), kontosperren røpet når passordet stemte (nå sjekkes den før passordet), eieren hadde ingen grense per konto uten brukernavn, stengte kontoer avbrøt ikke kallene på hjemmemaskinen og ikke kortstokker som var i gang, forbruksloggen talte filer i stedet for sider for en PDF, sikkerhetskopien kunne ha slettede koder i ledige sider i databasefila (nå `secure_delete` og `VACUUM`), oppsettet for gratiskontoene var ikke testet, og CLAUDE.md beskrev ikke `jobScope`. I tillegg glemmes kjente enheter ved nytt passord og stenging (avvist som funn, men billig).
- Fase 4 (kontoer), appen, design og resultat (bygget i `/home/user/sn-4b`):
  - Kontoen lagres i Dexie og sendes med hver forespørsel. Svarer serveren 409 (en annen fane har logget inn med en annen konto), lastes siden på nytt én gang.
  - En enhet uten lagret konto (eierens enheter i dag) tas over av eieren og beholder opplastingskøen. Logger en annen konto inn, spør appen først og sletter så de lokale dataene, også køen og sidebildene i bufferen.
  - Innloggingssiden har brukernavn (tomt for eieren) og en kort presentasjon (de fire fagene, lukket beta med invitasjon). Nye sider: `/registrer` (koden fra lenken) og `/nytt-passord` (koden fra lenken fjernes fra adressefeltet).
  - Innstillinger: kontoen med plan, eierens brukernavn, «Inviter en elev» (koden og lenken kan kopieres, og koden kan trekkes tilbake) og «Brukere» (plan, sist innlogget, forbruk, lenke for nytt passord, stenge). Eierens kort og «Prøv med Haiku» vises ikke for andre.
  - Gjennomgang (tre kontrollører og én skeptiker per funn, 19 agenter): 16 funn, 11 bekreftet og rettet med tester:
    - registrering eller nytt passord mens en annen konto var logget inn, kunne laste siden på nytt midt i dialogen (nå spør appen før forespørselen sendes, og synken står stille under byttet);
    - en opplasting i en annen fane kunne skrive den forrige kontoens notat inn etter slettingen (nå sjekkes kontoen i hver transaksjon);
    - utlogging uten nett lot økten leve, og neste oppstart logget rett inn igjen;
    - 409 på en opplasting ble en varig feil;
    - etter et kontobytte gikk appen til den forrige kontoens side;
    - registreringen kunne ikke prøve å hente fagene på nytt, og koden forsvant ved ny lasting;
    - det manglet tester for en enhet fra før kontoene med kø og for registrering i samme fane.
  - Kl. 01.16: PR [#27](https://github.com/52c854mb96-ship-it/SmartNotes/pull/27) (kontoer i appen) er laget, og flettet kl. 01.28 etter grønn CI. Grenen er nullstilt fra `main`.
- Fase 5a (kvoter), design og resultat (bygget i `/home/user/sn-5`):
  - Migrering 8: `quota_log` (sider, kortstokker og innholdsfortegnelser per bruker med tidspunkt; en tilbakebetaling er en rad med −1) og `users.last_claim_rev` for køturen. Ingenting som finnes, endres. Testet på en database med dagens versjon og ekte innhold.
  - Døgnet er norsk (`osloDay`, Europe/Oslo), også de dagene sommertiden skifter (23 og 25 timer).
  - Sider: telles når konverteringen starter, én gang per konvertering eleven ber om (opplasting eller «Konverter på nytt»). Over taket venter notatet til midnatt med «Dagens kvote er brukt – konverteres i morgen …», uten å regnes som et mislykket forsøk. Det første notatet i et døgn får alltid starte, så et langt notat ikke venter for alltid.
  - Kortstokker (2) og innholdsfortegnelser med AI (3) per døgn gir 429 med en norsk melding. En tekst-innholdsfortegnelse over taket tolkes fortsatt, bare uten koblingen til kompetansemålene.
  - Køen: høyst 20 notater i kø per gratiskonto (403 `queue_full`, aldri 429, så opplastingskøen i appen ikke prøver i det uendelige). Neste notat tas fra den brukeren som har ventet lengst på tur.
  - Dagsbudsjett: 30 kroner til listepris for alle gratiskontoene samlet. Over budsjettet venter gratisjobbene til neste døgn; eieren rammes aldri.
  - Innstillinger → Konto viser dagens forbruk for gratiskontoer (`GET /api/quota`).
  - Utklipp lagres som JPEG når det sparer minst 30 prosent. `source/` beholdes: «Konverter på nytt», sammenligningen og sikkerhetskopien trenger den.
  - Gjennomgang (tre kontrollører; skeptikerne stoppet på øktgrensen, så jeg vurderte funnene selv): 10 funn, 8 bekreftet og rettet med tester:
    - et nytt forsøk etter en midlertidig feil talte sidene igjen og kunne vente på kvoten (nå bare forsøk 1);
    - køen brukte den ekte klokka, kvotene den falske (nå samme klokke, også i testene);
    - «Konverter på nytt» og opplastinger sendt samtidig slapp forbi taket på køen;
    - et nytt forsøk på en kortstokk slapp forbi dagsbudsjettet;
    - en innholdsfortegnelse ble gitt tilbake også når AI-en hadde svart (og kallet var betalt), og tilbakebetalingen etter midnatt havnet i feil døgn;
    - en modell som mangler i pristabellen, ble regnet som gratis i dagsbudsjettet (nå den dyreste prisen);
    - et utklipp fra en tidligere kjøring med den andre filendelsen ble liggende, og LaTeX kunne ta det gamle.
  - Kl. 01.38: PR [#28](https://github.com/52c854mb96-ship-it/SmartNotes/pull/28) (kvoter) er laget, og flettet kl. 01.52 etter grønn CI. Grenen er nullstilt fra `main`.
- Fase 5b (personvern og vilkår), design og resultat (bygget i `/home/user/sn-5b`):
  - Egne sider som kan leses uten innlogging: personvernerklæring (`/personvern`), vilkår (`/vilkar`) og «Trygg og ærlig bruk av AI» (`/ai-bruk`), på enkel bokmål. Lenker fra innloggingen, registreringen, nytt passord og Innstillinger.
  - Ansvarlig og kontakt kommer fra `PRIVACY_CONTROLLER_NAME` og `PRIVACY_CONTACT` (`GET /api/legal`), med «[Fylles inn]» i rødt når de mangler.
  - Registreringen krever at eleven godtar vilkårene og personvernerklæringen (`users.terms_accepted_at`).
  - Vilkårene: bare egne notater, bare egen læring og ingen deling, ikke lever AI-tekst som eget arbeid der det ikke er lov, AI-en kan ta feil, og innhold kan fjernes etter varsel.
  - Personvernerklæringen sier hva som lagres (også nettleseren per innlogging og driftsloggen med IP-adresser), at bildene sendes til Anthropic og dataene ligger hos Railway (uten påstander om hva de gjør, se morgenlista), hvor lenge, hvem som ser hva, og hvordan man sletter.
  - «AI-generert med SmartNotes» nederst på sidene i PDF-ene (felles tillegg i malen, så også samle-PDF-ene) og på notatsiden, og «Meld fra» til kontakten.
  - «Slett kontoen» (Innstillinger → Konto, med passordet) sletter alle radene og filene til eleven, også samle-PDF-ene, økter, enheter og forbruksloggen. Eieren kan ikke slette seg selv. Forbruksloggen har ikke noe innhold fra notatene (testet).
  - Gjennomgang (tre kontrollører og én skeptiker per funn, 20 agenter): 17 funn, 13 bekreftet (9 ulike) og rettet med tester:
    - passordsjekken ved sletting talte forsøkene etter scrypt, så forsøk sendt samtidig slapp forbi grensen, og den kunne fylle køen for passordsjekker (nå som ved innloggingen);
    - slettingen avbrøt bare kallene på hjemmemaskinen for notater, ikke kortstokker og innholdsfortegnelser;
    - et AI-kall som var i gang, kunne skrive en ny rad i forbruksloggen for den slettede brukeren;
    - samle-PDF-er ble liggende når et notat, et kapittel eller et fag ble slettet, og en som ble laget mens noe ble slettet;
    - personvernerklæringen nevnte ikke nettleseren som lagres per innlogging eller driftsloggen med IP-adresser;
    - sidene viste «[Fylles inn]» og standardtallene mens de lastet og uten nett (nå huskes det siste svaret);
    - lagrede samle-PDF-er fikk ikke bunnteksten (nøkkelen tar nå med det felles tillegget), og teksten lovet merket også på PDF-er fra før;
    - morgenlista manglet punktene om Railway og Anthropic som ikke er sjekket.
  - typecheck, test (306 + 2224), build og e2e (39) er grønne lokalt.
  - Kl. 02.18: PR [#29](https://github.com/52c854mb96-ship-it/SmartNotes/pull/29) (personvern og vilkår) er laget, og flettet kl. 02.33 etter grønn CI. Grenen er nullstilt fra `main`.
- Kl. 02.40: alle fem fasene er ferdige. Morgenrapporten under er skrevet (PR [#30](https://github.com/52c854mb96-ship-it/SmartNotes/pull/30)), og rutinen `trig_012T5E4abuLufG4xWyNs5BfB` er slettet.

## Morgenrapport

Skrevet av nattøkta 14. oktober kl. 02.40. Alle fem fasene er ferdige, og alt er flettet inn i `main` etter grønn CI.

### Flettet i natt

| PR | Fase | Innhold |
|---|---|---|
| [#22](https://github.com/52c854mb96-ship-it/SmartNotes/pull/22) | 1a | Instrukser versjon 3: de presise reglene for alle Claude-modeller, `\uleselig` bare når sammenhengen ikke avgjør, og tegnemaler for kjemi og biologi |
| [#23](https://github.com/52c854mb96-ship-it/SmartNotes/pull/23) | 1b | Opphavsrett: `LICENSE`, lisenslista i appen, kompetansemålene kontrollert mot Udir med NLOD-henvisning |
| [#24](https://github.com/52c854mb96-ship-it/SmartNotes/pull/24) | 2 | Geofag 1: fagprofil, PDF-malen «Atlas», fargetemaet «Fjell» og «Legg til fag» fra læreplanen |
| [#25](https://github.com/52c854mb96-ship-it/SmartNotes/pull/25) | 3 | Forside med fagene som kort |
| [#26](https://github.com/52c854mb96-ship-it/SmartNotes/pull/26) | 4 | Kontoer på serveren: brukere, invitasjoner, innlogging med brukernavn, eierskap på hver rute, Haiku for gratiskontoer |
| [#27](https://github.com/52c854mb96-ship-it/SmartNotes/pull/27) | 4 | Kontoer i appen: registrering med invitasjon, nytt passord, kontobytte, «Inviter en elev» og «Brukere» |
| [#28](https://github.com/52c854mb96-ship-it/SmartNotes/pull/28) | 5a | Kvoter for gratiskontoer, tak på køen, dagsbudsjett, rettferdig kø og utklipp som JPEG |
| [#29](https://github.com/52c854mb96-ship-it/SmartNotes/pull/29) | 5b | Personvern og vilkår, «AI-generert» i PDF-ene, «Meld fra» og «Slett kontoen» |
| [#30](https://github.com/52c854mb96-ship-it/SmartNotes/pull/30) | – | Denne morgenrapporten |

Hver fase ble gjennomgått av uavhengige kontrollører (Workflow), og hvert bekreftet funn er rettet med en test. Tallene står i loggen over.

### Ikke testet med ekte Claude

Skyøkta har ingen API-nøkkel, så alt er testet med en falsk Claude. Dette er ikke prøvd på ekte notater:

- **De presise reglene** (versjon 4) med Sonnet og Haiku: om formelboksene, merknadene, `\uleselig` og tegnemalene blir brukt slik reglene sier. Malene kompilerer i testene, men det sier ikke hvordan modellen bruker dem.
- **Geofag 1:** hele konverteringen, også klimadiagram, terrengprofil og lagrekke.
- **Gratiskontoene:** at Haiku 5.5 med høy grundighet og tre rettingsrunder gir gode nok notater, og at et avslag går videre til Sonnet.
- **Kvotene og dagsbudsjettet** regner med listeprisene i koden. Det er ikke sammenlignet med det Anthropic Console faktisk viser.
- **Innholdsfortegnelse med AI og kortstokker** for en elev (samme kode som for deg, men med elevens tak).

Ikke prøvd på en ekte iPad eller iPhone, bare i nettlesertestene (Chromium og WebKit).

### Klar for en testelev?

**Koden er klar, men ikke prøvd på Railway.** Det som må være på plass, og hvor det står:

- Fase 4 og 5 er flettet: **ja** (#26–#29). Lagt ut på Railway: **ikke sjekket** (nattøkta har ikke tilgang til Railway). Railway skal legge ut `main` av seg selv når CI er grønn.
- En invitasjon er laget og registreringen testet ende til ende: **i testene ja, på Railway nei**. Det gjør du i punkt 4 under.
- Tak, kø og «Slett konto» virker: **ja i testene** (falsk klokke for kvotene, og sletting som fjerner alt og ikke noe annet).

Gjør punktene under i rekkefølge, så er appen klar for en annen elev.

### Morgenlista i rekkefølge

1. **Sjekk at den nye versjonen er lagt ut:** Railway → tjenesten → **Deployments**. Den øverste skal være grønn og ha meldingen «Morgenrapport for natt til 14. oktober (#30)» (eller #29). Logg inn i appen som før (passordet ditt, brukernavnet kan stå tomt). Brukernavnet ditt er `eier`, og du kan endre det i Innstillinger → Konto.
2. **Ta en sikkerhetskopi:** Innstillinger → «Sikkerhetskopi» → last ned, før noen andre registrerer seg.
3. **Variabler i Railway** (tjenesten → **Variables**, så **Deploy**):
   - `PRIVACY_CONTROLLER_NAME`: navnet til den som er ansvarlig for personopplysningene (deg eller en forelder);
   - `PRIVACY_CONTACT`: en e-postadresse (eller annen kontakt) for personvern, sletting og «Meld fra».
   - Kvotene trenger ingen variabler. Vil du endre dem, står `FREE_PAGES_PER_DAY`, `FREE_DECKS_PER_DAY`, `FREE_TOC_PER_DAY`, `FREE_QUEUE_MAX` og `FREE_DAILY_BUDGET_NOK` i README. `TRUST_PROXY_HOPS` skal ikke settes (standarden 1 er riktig for Railway).
4. **Prøv registreringen selv:** Innstillinger → **Inviter en elev** → **Lag invitasjon**, åpne lenken i et privat vindu eller på mobilen, og lag en testkonto. Last opp ett notat, og se at det konverteres. Slett så testkontoen med Innstillinger → Konto → **Slett kontoen**.
5. **Anthropic Console** → Settings → **Limits**: sett en månedlig grense (planens forslag: 20 USD, varsel ved 10 USD).
6. **La en voksen lese** personvernerklæringen og vilkårene i appen, og sjekke det erklæringen med vilje ikke påstår noe om: hvilken region Railway-tjenesten og volumet ligger i, hvor lenge Railway beholder driftsloggen, og hva Anthropics vilkår for API-et sier om lagring og trening. Planen anbefaler også at en voksen eier API-kontoen før andre bruker appen.
7. **Send invitasjonen** til eleven.

Og hele tiden:
- **Ikke rull tilbake** i Railway til en versjon fra før kontoene etter at en elev har registrert seg. Den gamle versjonen kjenner ikke kontoene og ville vist elevens fag og notater som dine.
- **Avslag hos en gratiskonto:** avslår Haiku et notat, prøves det på nytt med Sonnet, som koster mer.

### Se gjerne over

Valgene nattøkta tok på egen hånd, står under «Spørsmål til eleven» over: blant annet lisensteksten, aldersgrensen, kvotene, at kontosperren nå også gjelder deg, at slettede notater blir liggende som tittel og tekst merket som slettet, og at PDF-er fra før får merket «AI-generert» først når de kompileres på nytt.

Rutinen som vekket nattøkta hver time (`trig_012T5E4abuLufG4xWyNs5BfB`), er slettet.
