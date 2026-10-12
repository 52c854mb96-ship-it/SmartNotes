# Hjemmemaskinen: lokal AI på din egen PC eller Mac

Med hjemmemaskinen leser en lokal AI-modell notatene i stedet for Claude. Modellen kjører på din PC eller på en Mac mini, og da koster det bare strøm. Serveren på Railway gjør alt annet som før, som sidebilder, LaTeX, PDF og synk.

**Slik fungerer det:** tenk på serveren som et restaurantkjøkken og hjemmemaskinen som en kokk som jobber hjemmefra. Når en bestilling kommer inn (et notat skal konverteres), legger kjøkkenet en lapp i en kurv. Hjemmemaskinen spør kjøkkenet jevnlig om det ligger lapper der, tar én, lager retten og leverer den tilbake. Underveis sier den fra at den fortsatt jobber. Forsvinner den midt i (strømbrudd, lokket lukket), går lappen tilbake i kurven etter et minutt.

- Hjemmemaskinen kobler seg bare *ut* til serveren over HTTPS. Du trenger ikke åpne porter i ruteren.
- Er hjemmemaskinen av, venter notatene i appen med teksten «Venter på AI-maskinen». Med `REMOTE_FALLBACK=anthropic` brukes Claude i stedet. Det gjelder også når hjemmemaskinen blir borte mens et notat venter: etter omtrent to minutter uten livstegn går notatet til Claude.
- Sletter du et notat som venter, fjernes det fra kurven, og hjemmemaskinen bruker ikke tid på det.
- Hjemmemaskinen får bare det den trenger for å svare (sidebildene og instruksene), og sletter sidebildene når den er ferdig.

Dette er en første versjon. Den er testet med en falsk AI i skyen, men ikke med en ekte modell på en ekte PC eller Mac. Kjør først målingen i [MALING.md](MALING.md), slik at du vet at modellen er god nok.

## 1. Lag en hemmelig nøkkel

Hjemmemaskinen logger inn på serveren med en lang, tilfeldig nøkkel (`WORKER_TOKEN`). Lag den på maskinen din, og ikke lim den inn i chatten:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 2. Slå det på i Railway

Åpne prosjektet i Railway, gå til **Variables** og legg til:

| Variabel | Verdi |
|---|---|
| `WORKER_TOKEN` | nøkkelen fra trinn 1 |
| `AI_PROVIDER_CONVERT` | `remote` |
| `REMOTE_FALLBACK` | `none` (standard). Med `anthropic` går kallene til Claude når hjemmemaskinen er av |

Reserven (`REMOTE_FALLBACK=anthropic`) bruker samme Claude-modell som oppgaven ellers ville brukt (i dag Sonnet 5.5 for konvertering og Haiku 5.5 for kortstokker og innholdsfortegnelser), og den tar over med en gang. Mens hjemmemaskinen er av, koster det altså like mye som uten hjemmemaskin. La den stå på `none` hvis notatene heller kan vente.

Med `AI_PROVIDER_CONVERT` går bare konverteringen til hjemmemaskinen. Vil du også lage kortstokkene der, legger du til `AI_PROVIDER_FLASHCARDS` med verdien `remote`. Med `AI_PROVIDER` = `remote` går alt dit, også import av innholdsfortegnelser.

Railway starter serveren på nytt etter endringen. Under **Innstillinger → Server** i appen står det nå «Ingen hjemmemaskin på nett».

## 3. Gjør klar maskinen

1. Installer [Node.js 22 eller nyere](https://nodejs.org) og [Ollama](https://ollama.com/download).
2. Hent modellen du valgte etter målingen, for eksempel:

   ```bash
   ollama pull qwen3.5:9b
   ```

3. Hent koden og installer:

   ```bash
   git clone https://github.com/52c854mb96-ship-it/SmartNotes.git
   cd SmartNotes
   npm ci
   ```

4. Lag en fil som heter `.env` i mappen `SmartNotes`, med dette innholdet (bytt ut verdiene):

   ```
   SMARTNOTES_URL=https://din-app.up.railway.app
   WORKER_TOKEN=nøkkelen-fra-trinn-1
   WORKER_NAME=Eskils PC
   OLLAMA_MODEL=qwen3.5:9b
   ```

   `.env` står allerede i `.gitignore` og blir aldri sjekket inn.

   På Windows kan du lage filen i Notisblokk: velg **Fil → Lagre som**, sett **Filtype** til **Alle filer (\*.\*)** og skriv `.env` som filnavn. Ellers lagres den som `.env.txt`, og hjemmemaskinen finner den ikke.

5. Start hjemmemaskinen:

   ```bash
   npm run homeworker --workspace server
   ```

   Når det står «Koblet til … Venter på oppgaver …», er alt klart. I appen står det nå «Hjemmemaskin på nett: Eskils PC».

Vinduet må være åpent så lenge maskinen skal jobbe. Du stopper med Ctrl+C. Da gjør den ferdig oppgaven som pågår og leverer svaret før den stopper. Trykker du Ctrl+C en gang til, stopper den med en gang, og lappen går tilbake i kurven etter et minutt.

## Valg på hjemmemaskinen

| Variabel | Standard | Betydning |
|---|---|---|
| `WORKER_NAME` | maskinnavnet | Navnet som vises i appen |
| `WORKER_HOURS` | hele døgnet | Når maskinen tar imot oppgaver, for eksempel `16-23,0-7` (fra 16:00 til 07:59). Nyttig på en maskin som også brukes til annet arbeid |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Modellen som leser bildene |
| `OLLAMA_TEXT_MODEL` | som `OLLAMA_MODEL` | Modellen for ren tekst (retting og kort) |
| `OLLAMA_BOX_UNITS` | `thousandths` | Hvordan modellen oppgir figurbokser. `pixels` for Qwen2.5-VL, `thousandths-yx` hvis y kommer først |

De andre `OLLAMA_`-innstillingene står i README.

## Windows-PC med RTX 4060

- **Strøm og hvilemodus:** PC-en tar bare imot oppgaver når den er våken. Under **Innstillinger → System → Strøm** kan du la den holde seg våken når den er koblet til strøm, mens hjemmemaskinen skal jobbe.
- **Start automatisk ved pålogging:** lag en fil `hjemmemaskin.bat` i `SmartNotes`-mappen:

  ```bat
  cd /d "%~dp0"
  npm run homeworker --workspace server
  pause
  ```

  Trykk Windows-tasten + R, skriv `shell:startup` og legg en snarvei til filen i mappen som åpnes. `pause` holder vinduet åpent hvis hjemmemaskinen stopper med en feil, så du rekker å lese meldingen.
- **Ikke klikk i vinduet:** i det klassiske konsollvinduet setter et klikk vinduet i merkemodus, og da står programmet stille til du trykker Esc. Bruker du Windows Terminal (standard i Windows 11), skjer ikke dette.

## Mac mini som står på hele døgnet

Hvis du får bruke farens Mac mini, bør hjemmemaskinen ikke gå i veien for arbeidet hans:

- **Egen brukerkonto:** lag en standardbruker «SmartNotes» under **Systeminnstillinger → Brukere og grupper**, og installer alt der. Da kommer hjemmemaskinen ikke til filene hans.
- **Arbeidstid:** sett `WORKER_HOURS` til timene han ikke trenger maskinen, for eksempel `17-23,0-7`.
- **Minne:** sett `OLLAMA_KEEP_ALIVE=5m` på hjemmemaskinen, så modellen frigjøres fra minnet fem minutter etter siste oppgave.
- **Start automatisk:** lagre dette som `~/Library/LaunchAgents/no.smartnotes.hjemmemaskin.plist` i SmartNotes-brukeren (bytt ut stien hvis repoet ligger et annet sted):

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>Label</key><string>no.smartnotes.hjemmemaskin</string>
    <key>WorkingDirectory</key><string>/Users/smartnotes/SmartNotes</string>
    <key>ProgramArguments</key>
    <array><string>/bin/zsh</string><string>-lc</string><string>npm run homeworker --workspace server</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>60</integer>
    <key>StandardOutPath</key><string>/Users/smartnotes/hjemmemaskin.log</string>
    <key>StandardErrorPath</key><string>/Users/smartnotes/hjemmemaskin.log</string>
  </dict>
  </plist>
  ```

  Aktiver den i Terminal (som SmartNotes-brukeren) med:

  ```bash
  launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/no.smartnotes.hjemmemaskin.plist
  ```

  `KeepAlive` starter den på nytt hvis den stopper, og `ThrottleInterval` gjør at det skjer høyst én gang i minuttet, for eksempel når nøkkelen er feil. Loggen står i `hjemmemaskin.log`. Den kjører når SmartNotes-brukeren er logget inn, også i bakgrunnen mens en annen bruker bruker maskinen. Ollama-appen må også starte ved pålogging. Det er et valg i menylinjeikonet til Ollama.

Om dette fungerer helt uten pålogging etter en omstart, er ikke prøvd ennå. Inntil videre må noen logge inn på SmartNotes-brukeren én gang etter hver omstart.

## Feilsøking

| Melding | Hva du gjør |
|---|---|
| «Serveren godtok ikke WORKER_TOKEN» | Nøkkelen i `.env` er ikke lik den i Railway. Sjekk at det ikke er mellomrom på slutten |
| «Serveren har ikke slått på hjemmemaskinen» | `WORKER_TOKEN` mangler i Railway, eller `SMARTNOTES_URL` er feil |
| «Hjemmemaskinen har en annen versjon …» | Kjør `git pull` og `npm ci`, og start hjemmemaskinen på nytt |
| «Fikk ikke kontakt med den lokale AI-en (Ollama …)» | Start Ollama |
| «Modellen … finnes ikke i Ollama» | Kjør kommandoen `ollama pull …` som står i meldingen |
| «Den lokale maskinen har ikke nok minne …» | Velg en mindre modell, eller sett `OLLAMA_IMAGE_MAX_EDGE` lavere (for eksempel `1280`) |
