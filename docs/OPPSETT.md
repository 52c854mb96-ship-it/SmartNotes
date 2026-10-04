# Oppsett: det du må gjøre selv

Alt som kan gjøres i koden, er gjort. Det som gjenstår, er kontoer, betaling og nøkler som bare du kan opprette. Følg stegene i rekkefølge. Alt skjer i nettleseren, så du trenger ikke installere noe.

**Tid:** ca. 45–60 minutter.
**Du trenger:** PC med nettleser, betalingskort, og gjerne mobilen eller iPaden for å teste til slutt.

> **Viktig om nøkler og passord.** API-nøkkelen og app-passordet skal bare limes inn i feltene for *secrets* på GitHub (steg 5). Ikke send dem i chat eller e-post, og ikke legg dem i koden. Hvis en nøkkel likevel kommer på avveie, sletter du den hos Anthropic og lager en ny.

## Oversikt

| Steg | Hvor | Hva |
|---|---|---|
| 1 | GitHub | Flett koden inn i `main` |
| 2 | Anthropic | Konto, kreditt, forbruksgrense og API-nøkkel |
| 3 | Passordbehandler | Velg passord til appen |
| 4 | Fly.io | Konto, betalingskort, token og app-navn |
| 5 | GitHub | Legg inn tre secrets og én variabel |
| 6 | GitHub Actions | Kjør «første oppsett» og «deploy» |
| 7 | Appen | Logg inn og test et ekte notat |
| 8 | Enhetene | Installer appen på iPad, mobil og PC |

---

## Steg 1: Flett koden inn i main

Knappene for oppsett og deploy i GitHub Actions vises bare når filene ligger på `main`.

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

## Steg 4: Fly.io (serveren)

Fly.io kjører serveren som synkroniserer enhetene og gjør om notatene til PDF.

1. Gå til <https://fly.io> og trykk **Sign up**. Du kan logge inn med GitHub.
2. Legg inn betalingskort under **Billing**. Fly.io krever det også for små apper.
3. Lag et token som GitHub kan bruke. I dashbordet velger du organisasjonen **Personal**, går til **Tokens** og lager et **organisasjonstoken** (org token). Det må være et organisasjonstoken, fordi det skal kunne opprette appen. Kopier tokenet.
   - Finner du ikke valget, kan du lage tokenet i en terminal i stedet: installer `flyctl` (<https://fly.io/docs/flyctl/install/>), kjør `fly auth login` og så `fly tokens create org`.
4. Velg et navn på appen: små bokstaver, tall og bindestrek, og det må være unikt hos Fly.io, f.eks. `smartnotes-dittnavn`. Adressen blir `https://smartnotes-dittnavn.fly.dev`.

- [ ] Fly.io-konto med betalingskort
- [ ] Organisasjonstoken kopiert
- [ ] App-navn valgt

## Steg 5: Legg inn nøkler og navn på GitHub

På GitHub går du til repoet og velger **Settings → Secrets and variables → Actions**.

Under fanen **Secrets** trykker du **New repository secret** tre ganger:

| Navn | Verdi |
|---|---|
| `FLY_API_TOKEN` | tokenet fra steg 4 |
| `ANTHROPIC_API_KEY` | API-nøkkelen fra steg 2 |
| `APP_PASSWORD` | passordet fra steg 3 |

Under fanen **Variables** trykker du **New repository variable**:

| Navn | Verdi |
|---|---|
| `FLY_APP` | app-navnet fra steg 4, f.eks. `smartnotes-dittnavn` |

Secrets er kryptert. Ingen kan lese dem igjen, heller ikke du, men de kan byttes ut.

- [ ] Tre secrets og én variabel lagt inn

## Steg 6: Opprett og start serveren

1. Gå til fanen **Actions** i repoet.
2. Velg **Fly.io – første oppsett** i listen til venstre, trykk **Run workflow** (gren `main`) og så den grønne knappen. Det tar ca. ett minutt. Workflowen oppretter appen og et lagringsvolum på 3 GB i Stockholm, og lagrer passordet og API-nøkkelen hos Fly.io.
3. Velg **Deploy til Fly.io** og trykk **Run workflow**. Første gang tar det 5–10 minutter, fordi LaTeX skal installeres i serveren. Når den er grønn, står adressen til appen nederst i loggen for siste steg.

Senere skjer deploy automatisk: hver gang noe flettes inn i `main` og CI er grønn, oppdateres serveren.

- [ ] «Første oppsett» er grønn
- [ ] «Deploy» er grønn

## Steg 7: Logg inn og test

1. Åpne `https://<app-navnet>.fly.dev` på PC-en og logg inn med passordet.
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
| Fly.io: maskin med 1 GB minne og 3 GB lagring | 60–70 kr i måneden (se <https://fly.io/pricing>) |
| Claude: et notat på 5 sider | 3–6 kr |

Forbruket hos Claude ser du under **Usage** i Anthropic Console. Vil du gjøre det billigere, kan du endre `CLAUDE_EFFORT = "high"` til `"medium"` i `fly.toml`.

## Sikkerhetskopi

- Fly.io tar automatisk et øyeblikksbilde av lagringsvolumet hver dag og beholder det i noen dager. Du finner dem under appen i Fly.io-dashbordet, eller med `fly volumes snapshots list`.
- Vil du ha en egen kopi av databasen: `fly ssh sftp get /data/smartnotes.db ./smartnotes-backup.db` (krever `flyctl`).
- **Hele faget som PDF** på fagsiden gir deg alle notatene samlet i én PDF.

## Bytte passord eller API-nøkkel

1. Oppdater `APP_PASSWORD` eller `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions**.
2. Kjør **Fly.io – første oppsett** på nytt. Det som finnes fra før, hoppes over, og de nye verdiene lagres.
3. Kjør **Deploy til Fly.io**, så tar serveren i bruk de nye verdiene.

## Feilsøking

| Hva skjer | Hva du gjør |
|---|---|
| «Fly.io – første oppsett» sier «Mangler …» | En secret eller variabelen mangler eller er stavet feil. Se steg 5. |
| «Opprett appen» feiler med *unauthorized* eller *not found* | Tokenet er feil type eller utløpt. Lag et nytt **organisasjonstoken** (steg 4) og bytt ut `FLY_API_TOKEN`. |
| «Opprett appen» sier at navnet er tatt | Velg et annet navn og endre variabelen `FLY_APP`. |
| Deploy er grønn, men innloggingen avvises | Passordet er feil. Bytt passord (se over). |
| Notater feiler med melding om API-nøkkel eller kreditt | Sjekk nøkkelen og kreditten i Anthropic Console. Bytt nøkkel (se over). |
| Appen kan ikke installeres eller virker ikke uten nett | Appen må åpnes via `https://…fly.dev`, og du må ha logget inn én gang mens du var på nett. |
| Noe annet | Se loggen i Fly.io-dashbordet (appen → **Monitoring**), eller `fly logs --app <app-navnet>`. |

## Andre måter å kjøre serveren på

Vil du bruke terminalen (`flyctl`) i stedet for GitHub Actions, eller kjøre serveren på en egen maskin hjemme med Docker, står det i [DEPLOY.md](DEPLOY.md).
