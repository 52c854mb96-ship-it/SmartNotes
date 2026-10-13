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
  - fyll inn ansvarlig og kontakt (variablene i Railway);
  - la gjerne en forelder lese personvernerklæringen og vilkårene;
  - sett en månedlig grense i Anthropic Console → Settings → Limits (planens forslag: grense 20 USD, varsel ved 10 USD);
  - planen anbefaler også at en voksen eier API-kontoen før andre bruker appen.

## Spørsmål til eleven

Nattøkta skriver her de valgene den har tatt på egen hånd, så eleven kan se over dem om morgenen.

- **Lisensen** nevner GitHub-kontoen (52c854mb96-ship-it) som rettighetshaver, ikke navnet ditt, fordi repoet er offentlig. Vil du ha navnet ditt der, endrer du første linje i `LICENSE`.
- **Fysikk 1 KM3:** Udir skriver selv «problemsstillinger» (med s). Nye fag får Udirs skrivemåte ordrett; faget ditt har fortsatt «problemstillinger». Vil du ha det likt Udir, kan faget legges inn på nytt eller målet rettes i en senere økt.
- **Lærebøker som tidligere versjoner la inn** («ERGO Fysikk 1» og lignende) vises ikke lenger i samle-PDF-ene og sendes ikke til AI-en. Bruker du faktisk den boka og vil ha navnet med, skriver du det på nytt i faginnstillingene med litt annen tekst, for eksempel «ERGO Fysikk 1, Aschehoug».

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
- Kl. 23.20: PR [#22](https://github.com/52c854mb96-ship-it/SmartNotes/pull/22) (fase 1a) er flettet etter grønn CI, og grenen er nullstilt fra `main`.
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

## Morgenrapport

*(skrives av nattøkta når alt er ferdig, eller om morgenen 14. oktober)*
