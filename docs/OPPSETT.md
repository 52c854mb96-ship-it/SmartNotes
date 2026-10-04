# Oppsett: det du må gjøre selv

Alt som kan gjøres i koden, er gjort. Det som gjenstår, er kontoer, betaling og nøkler som bare du kan opprette. Serveren kjører på **Railway**, der du allerede har abonnement. Følg stegene i rekkefølge. Alt skjer i nettleseren, så du trenger ikke installere noe.

**Tid:** ca. 45 minutter.
**Du trenger:** PC med nettleser, betalingskort til Anthropic, og gjerne mobilen eller iPaden for å teste til slutt.

> **Viktig om nøkler og passord.** API-nøkkelen og app-passordet skal bare limes inn som variabler i Railway (steg 5). Ikke send dem i chat eller e-post, og ikke legg dem i koden. Hvis en nøkkel likevel kommer på avveie, sletter du den hos Anthropic og lager en ny.

## Oversikt

| Steg | Hvor | Hva | Når |
|---|---|---|---|
| 1 | GitHub | Flett koden inn i `main` | når Claude sier at koden er klar |
| 2 | Anthropic | Konto, kreditt, forbruksgrense og API-nøkkel | nå |
| 3 | Passordbehandler | Velg passord til appen | nå |
| 4 | Railway | Importer repoet, region og lagringsvolum | nå |
| 5 | Railway | Variabler og adresse | nå |
| 6 | Railway | Første deploy fra `main` | etter steg 1 |
| 7 | Appen | Logg inn og test et ekte notat | etter steg 6 |
| 8 | Enhetene | Installer appen på iPad, mobil og PC | etter steg 7 |

---

## Steg 1: Flett koden inn i main

Railway henter koden fra grenen `main`. Gjør dette når Claude har sagt at alt er ferdig og testet.

1. Gå til <https://github.com/52c854mb96-ship-it/SmartNotes>.
2. Trykk **Pull requests → New pull request**.
3. Velg **base: `main`** og **compare: `claude/smartnotes-offline-app-j25mqo`**, og trykk **Create pull request**.
4. Vent til sjekken **CI** er grønn (ca. 10 minutter).
5. Trykk **Merge pull request → Confirm merge**.

Du kan også be Claude om å lage pull requesten. Da gjenstår bare punkt 4 og 5.

- [ ] Koden ligger på `main`

## Steg 2: Anthropic (Claude API-nøkkel)

API-kontoen er en egen konto hos Anthropic. Den er ikke den samme som et eventuelt Claude-abonnement, og den betales separat etter forbruk.

1. Gå til <https://console.anthropic.com> og lag en konto.
2. **Billing:** kjøp kreditt, f.eks. 10–20 dollar. Kreditten forhåndsbetales. Slår du av automatisk påfyll, kan du aldri bruke mer enn du har kjøpt.
3. **Limits:** sett en månedlig forbruksgrense, f.eks. 20 dollar.
4. **API keys → Create key:** gi den navnet `smartnotes`.
5. Kopier nøkkelen (den starter med `sk-ant-`). Den vises bare én gang. La fanen stå åpen til steg 5, eller lagre nøkkelen midlertidig i passordbehandleren.

- [ ] Kreditt kjøpt og forbruksgrense satt
- [ ] API-nøkkel laget

## Steg 3: Passord til appen

Velg et langt passord som du bare bruker her, f.eks. fire eller fem tilfeldige ord. Lagre det i passordbehandleren. Du logger inn med dette på alle enhetene dine.

- [ ] Passord valgt og lagret

## Steg 4: Railway – importer repoet og lag lagringsvolum

Railway kjører serveren som synkroniserer enhetene og gjør om notatene til PDF. Navnene på knappene kan variere litt i Railway, men stegene er de samme.

1. Logg inn på <https://railway.com> med kontoen der du har abonnementet.
2. Trykk **New Project → Deploy from GitHub repo** og velg `52c854mb96-ship-it/SmartNotes`. Første gang må du gi Railway tilgang til repoet på GitHub (**Configure GitHub App**).
3. Railway starter et bygg med en gang. Før steg 1 er gjort, finnes bare en tom start på `main`, så dette første bygget **feiler. Det er helt greit**, og du kan se bort fra det.
4. Gi prosjektet navnet `SmartNotes` (prosjektets **Settings**) og tjenesten navnet `smartnotes` (tjenestens **Settings**), hvis Railway har valgt andre navn.
5. **Region:** åpne tjenesten, gå til **Settings → Deploy → Region** og velg **EU West (Amsterdam)**, som er nærmest Norge. Gjør dette før du lager volumet.
6. **Lagringsvolum:** høyreklikk tjenesten i prosjektet (eller trykk **Create → Volume**) og koble et volum til tjenesten med **Mount path `/data`**. Her ligger databasen, originalbildene og PDF-ene.
   - Uten volum forsvinner alle notatene hver gang serveren oppdateres. Sjekk at stien er nøyaktig `/data`, og at volumet er på plass før du laster opp ekte notater.
7. Sjekk at **Serverless** (at appen sover når ingen bruker den) er **av** under **Settings → Deploy**. Det er av som standard. Serveren må være våken for å gjøre om notatene i bakgrunnen.
8. Slå på **Wait for CI** under **Settings → Source**. Da oppdateres serveren bare når testene på GitHub er grønne.

- [ ] Repoet importert, tjenesten i EU West
- [ ] Volum montert på `/data`
- [ ] Wait for CI slått på

## Steg 5: Railway – variabler og adresse

1. Åpne tjenesten og gå til **Variables**. Legg inn disse med **New Variable**:

   | Navn | Verdi |
   |---|---|
   | `APP_PASSWORD` | passordet fra steg 3 |
   | `ANTHROPIC_API_KEY` | API-nøkkelen fra steg 2 |
   | `PORT` | `8080` |

   For API-nøkkelen kan du velge **Seal** i menyen på variabelen. Da kan ingen lese den i Railway etterpå, men den kan byttes ut.
2. Gå til **Settings → Networking** og trykk **Generate Domain**. Velg port **8080** hvis du blir spurt. Du får en adresse som `https://smartnotes-production-xxxx.up.railway.app`. Lagre den, for dette er adressen til appen.
3. Hvis Railway viser en knapp for å ta i bruk endringene (**Deploy** eller **Apply changes**), trykker du på den.

- [ ] Tre variabler lagt inn
- [ ] Adresse laget og lagret

## Steg 6: Første deploy (etter steg 1)

1. Sjekk under **Settings → Source** at tjenesten følger grenen **`main`**.
2. Når koden er flettet inn i `main` (steg 1) og CI er grønn, starter Railway byggingen selv. Første gang tar det 5–10 minutter, fordi LaTeX skal installeres. Starter den ikke, trykker du **Deploy** (eller **Redeploy** på siste deploy) under **Deployments**.
3. Følg med under **Deployments**. Når deployen er grønn (**Active**), er appen klar på adressen fra steg 5.

Senere skjer alt automatisk: hver gang noe flettes inn i `main` og CI er grønn, bygger Railway en ny versjon og bytter over. Notatene ligger trygt på volumet imens.

> **Vil du prøve serveren før steg 1?** Velg grenen `claude/smartnotes-offline-app-j25mqo` under **Settings → Source** i stedet for `main`. Da bygges den nyeste versjonen med en gang, og du kan sjekke at oppsettet virker mens Claude fortsatt jobber. Bytt tilbake til `main` etter steg 1.

- [ ] Første deploy er grønn

## Steg 7: Logg inn og test

1. Åpne adressen fra steg 5 på PC-en og logg inn med passordet.
2. Faget **Fysikk 1** ligger klart med alle kapitlene og delkapitlene fra ERGO Fysikk 1.
3. Trykk **Last opp notater** og last opp et ekte notat på 2–3 sider (bilder eller PDF).
4. Etter 1–3 minutter er PDF-en klar. Sjekk at:
   - notatet havnet i riktig kapittel og delkapittel,
   - formlene og enhetene er riktige,
   - eventuelle merknader fra Claude gir mening.
5. Åpne **Visualiseringer** i sidepanelet og prøv et par av dem.

Hvis noe feiler, se [Feilsøking](#feilsøking) nedenfor.

- [ ] Første notat konvertert

## Steg 8: Installer appen på enhetene

Åpne adressen på hver enhet, logg inn mens du er på nett, og installer:

| Enhet | Slik gjør du |
|---|---|
| iPhone / iPad (Safari) | Del-knappen → **Legg til på Hjem-skjerm** |
| Android (Chrome) | Meny ⋮ → **Installer app** |
| Mac (Chrome / Edge) | Installer-ikonet til høyre i adressefeltet |
| Mac (Safari) | **Arkiv → Legg til i Dock** |
| Windows (Chrome / Edge) | Installer-ikonet i adressefeltet |

Etter første innlogging kan du lese alle notatene uten nett. Notater du laster opp uten nett, sendes automatisk når du er på nett igjen.

- [ ] Installert på alle enhetene

---

## Valgfritt: la Claude teste ekte konvertering

I skyøktene med Claude Code finnes det ingen API-nøkkel, så Claude har bare testet konverteringen med en falsk Claude. Vil du at Claude skal kunne prøve ekte notater i en senere økt, legger du nøkkelen inn i miljøinnstillingene: miljømenyen i tittellinjen på økten → **Edit**, og så en miljøvariabel med navnet `ANTHROPIC_API_KEY`. Den gjelder fra neste økt. Bruken trekkes fra den samme kreditten.

## Hva koster det?

| Hva | Omtrent |
|---|---|
| Railway: serveren (et par hundre MB minne når den står stille) og lagring | noen få dollar i måneden i forbruk, som helt eller delvis dekkes av det som er inkludert i abonnementet ditt |
| Claude: et notat på 5 sider | 3–6 kr |

- Forbruket hos Railway ser du under **Usage** i workspace-innstillingene. Der kan du også sette en øvre grense (**Usage limits**).
- Forbruket hos Claude ser du under **Usage** i Anthropic Console.
- Vil du gjøre Claude-delen billigere, legger du til variabelen `CLAUDE_EFFORT` med verdien `medium` i Railway.

## Sikkerhetskopi

- Åpne volumet i Railway og se etter fanen **Backups**. Der kan du ta sikkerhetskopier for hånd eller på en fast plan, hvis abonnementet ditt har det.
- **Hele faget som PDF** på fagsiden gir deg alle notatene samlet i én PDF.

## Bytte passord eller API-nøkkel

1. Åpne tjenesten i Railway og gå til **Variables**.
2. Endre `APP_PASSWORD` eller `ANTHROPIC_API_KEY`.
3. Trykk **Deploy** (eller **Apply changes**). Serveren starter på nytt med de nye verdiene, og notatene beholdes på volumet.

## Feilsøking

| Hva skjer | Hva du gjør |
|---|---|
| Bygget feiler | Det aller første bygget før steg 1 skal feile (se steg 4). Ellers: se **Build Logs** under **Deployments**. Sjekk at **Root Directory** under **Settings → Source** er tomt, slik at Railway finner `Dockerfile` og `railway.json`. |
| Deployen henger på *healthcheck* | Sjekk at variabelen `PORT` er `8080`, og at adressen under **Networking** peker til port 8080. Se **Deploy Logs**. |
| Notatene er borte etter en oppdatering | Volumet mangler eller er montert feil. Det må være montert på `/data` (steg 4). |
| Innloggingen avvises | Passordet er feil. Bytt passord (se over). |
| Notater feiler med melding om API-nøkkel eller kreditt | Sjekk nøkkelen og kreditten i Anthropic Console. Bytt nøkkel (se over). |
| Appen kan ikke installeres eller virker ikke uten nett | Appen må åpnes via `https://…up.railway.app`, og du må ha logget inn én gang mens du var på nett. |
| Noe annet | Se **Deploy Logs** og **HTTP Logs** for den aktive deployen i Railway. |

## Andre måter å kjøre serveren på

Vil du kjøre serveren på Fly.io eller på en egen maskin hjemme med Docker, står det i [DEPLOY.md](DEPLOY.md).
