# SmartNotes

Last opp bilder eller PDF-er av de håndskrevne notatene dine, og få dem tilbake som pene LaTeX-PDF-er. Notatene sorteres automatisk etter lærebokas kapitler. Appen fungerer både på og uten nett, og synkroniseres mellom Mac, PC, iPad og mobil.

Foreløpig er appen laget for **fysikk**. Andre fag kommer senere, og arkitekturen er klar for dem (se [Nye fag](#nye-fag)).

## Hva appen gjør

- **Sidebar med fag og kapitler.** Klikk på et fag for å se kapitlene fra læreboka, og på et kapittel for å se notatene i det.
- **Opplasting.** Ta bilder med mobilen, eller last opp PDF-er fra f.eks. GoodNotes eller Notability. Claude leser håndskriften og skriver notatet om til LaTeX:
  - Tro mot originalen. Innholdet endres ikke, men mulige feil (f.eks. regnefeil) markeres med en *merknad*.
  - Formler, enheter (siunitx, desimalkomma) og vektorer settes riktig.
  - Enkle tegninger tegnes på nytt i TikZ, som kraftdiagrammer, grafer og kretser. Kompliserte tegninger klippes ut fra originalbildet.
  - Definisjoner, viktige formler, eksempler og oppgaver får hver sin fargede boks.
  - Ord som er vanskelige å lese, markeres med ?.
- **Kapittelsortering.** Legg inn lærebokas innholdsfortegnelse (lim inn tekst eller ta bilde av den). Da plasserer Claude hvert notat i riktig kapittel, og du kan flytte det selv.
- **Samle-PDF.** Last ned et helt kapittel eller hele faget som én PDF med innholdsliste.
- **Offline.**
  - Alle ferdige PDF-er lagres på enheten og kan leses uten nett.
  - Notater du laster opp uten nett, legges i kø og sendes automatisk når du er på nett igjen.
  - Konverteringen skjer på serveren, så du kan lukke appen så snart opplastingen er sendt.
- **Rediger LaTeX.** Du kan se og redigere LaTeX-koden og lage PDF-en på nytt.

## Slik henger det sammen

```
 iPad / mobil / PC                                  Server (Docker, f.eks. på Fly.io)
┌──────────────────────────┐   HTTPS + synk    ┌──────────────────────────────────────┐
│ Web-app (PWA)            │ ────────────────▶ │ API (Fastify) + SQLite               │
│ • IndexedDB: fag, kap.,  │                   │ Kø: bilder → Claude → LaTeX → PDF    │
│   notater, PDF-er        │ ◀──────────────── │ • TeX Live (latexmk/pdflatex)        │
│ • Opplastingskø offline  │   PDF-er, status  │ • Claude API (håndskrift + LaTeX)    │
│ • Service worker         │                   │ • Lagrer originaler, .tex og .pdf    │
└──────────────────────────┘                   └──────────────────────────────────────┘
```

| Mappe | Innhold |
|---|---|
| `web/` | Web-appen: React, Vite, Dexie (IndexedDB), pdf.js og service worker |
| `server/` | API, konverteringskø, Claude-integrasjon, LaTeX-kompilering og samle-PDF-er |
| `server/latex/physics/preamble.tex` | LaTeX-malen for fysikk (pakker, bokser, sidehode) |
| `server/src/profiles/physics.ts` | Instruksene Claude får for fysikknotater |
| `shared/` | Felles TypeScript-typer for API-et |

## Kom i gang lokalt

Du trenger Node.js 22+ og TeX Live med noen pakker. På Ubuntu/Debian:

```bash
sudo apt-get install texlive-latex-base texlive-latex-recommended texlive-latex-extra \
  texlive-science texlive-pictures texlive-lang-european texlive-fonts-recommended \
  lmodern latexmk poppler-utils
```

På macOS: installer [MacTeX](https://www.tug.org/mactex/) og `brew install poppler`.

```bash
npm install
cp .env.example .env            # fyll inn APP_PASSWORD og ANTHROPIC_API_KEY
export $(grep -v '^#' .env | xargs)
npm run dev                     # server på :8787, web-app på http://localhost:5173
```

Uten API-nøkkel kan du bruke en falsk Claude som lager testnotater:

```bash
SMARTNOTES_FAKE_CLAUDE=1 npm run dev
```

## Ta i bruk på ekte (synk mellom enheter)

Se **[docs/DEPLOY.md](docs/DEPLOY.md)** for en steg-for-steg-guide til Fly.io (ca. 40–60 kr/mnd) eller egen maskin med Docker.

**API-nøkkelen ligger bare på serveren** (`ANTHROPIC_API_KEY`). Den sendes aldri til nettleseren og skal aldri sjekkes inn i git.

## Konfigurasjon

| Variabel | Standard | Beskrivelse |
|---|---|---|
| `APP_PASSWORD` | – (påkrevd i produksjon) | Passordet du logger inn med |
| `ANTHROPIC_API_KEY` | – | Claude API-nøkkel |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modellen som leser notatene |
| `CLAUDE_EFFORT` | `high` | Hvor grundig Claude jobber: `low` / `medium` / `high` / `xhigh` / `max` |
| `CLAUDE_FALLBACKS` | `true` | Hvis Claudes sikkerhetsfiltre ved en feil avslår et notat, prøves en anbefalt reservemodell automatisk |
| `SEED_TEXTBOOK` | `ergo-fysikk-1` | Lærebok som fag og kapitler lages fra ved første oppstart (`none` = tomt fag «Fysikk»). Se `server/src/textbooks.ts` |
| `DATA_DIR` | `./data` | Database, originaler og PDF-er |
| `PORT` | `8787` (`8080` i Docker) | |
| `MAX_PAGES_PER_NOTE` | `30` | Maks sider per opplasting |
| `LATEX_FIX_ATTEMPTS` | `2` | Antall runder med automatisk retting av LaTeX-feil |
| `WORKER_CONCURRENCY` | `1` | Antall notater som konverteres samtidig |
| `COOKIE_SECURE` | `true` i produksjon | Krever HTTPS for innloggingen |
| `SMARTNOTES_FAKE_CLAUDE` | `0` | `1` gir testinnhold uten å kalle Claude |

## Hva koster det?

Hver side sendes som et bilde i høy oppløsning (ca. 4 600 tokens). Med Claude Opus 5.5 ($4 per million input-tokens og $20 per million output-tokens, der tenkning regnes som output) koster et notat på 5 sider omtrent **3–6 kroner**, avhengig av hvor mye som står på sidene. Instruksene caches mellom notater, og det gjør det litt billigere. `CLAUDE_EFFORT=medium` reduserer kostnaden ytterligere. Hvor mange tokens hvert notat brukte, lagres i `meta.json` i notatets mappe på serveren.

## Personvern

Bildene av notatene sendes til Anthropics API for å bli lest. Originalene, LaTeX-koden og PDF-ene lagres bare på din egen server og på enhetene dine.

## Utvikling og tester

```bash
npm run typecheck     # TypeScript for alle pakker
npm test              # servertester (enhet + API med ekte LaTeX og falsk Claude)
npm run build         # bygger web-app og server
npm run test:e2e      # ende-til-ende i Chromium (offline, kø, synk)
```

Prøv konverteringen på ekte notater uten å gå via appen. Det er nyttig når du vil justere instruksene til Claude:

```bash
ANTHROPIC_API_KEY=... npm run convert --workspace server -- ~/Bilder/side1.jpg ~/Bilder/side2.jpg \
  --out /tmp/test --chapters "1 Fysikk og måling;2 Bevegelse;3 Newtons lover"
```

## Nye fag

Hvert fag har en *profil* med LaTeX-mal og instrukser til Claude:

1. Lag `server/latex/<fag>/preamble.tex` (ta utgangspunkt i fysikk).
2. Lag `server/src/profiles/<fag>.ts` med instrukser, og registrer profilen i `server/src/profiles/index.ts`.
3. Legg til profil-id-en i `SubjectProfile` i `shared/src/index.ts`, og gjør den valgbar i web-appen.
