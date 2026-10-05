# SmartNotes

Last opp bilder eller PDF-er av de håndskrevne notatene dine, og få dem tilbake som pene LaTeX-PDF-er. Notatene sorteres automatisk etter lærebokas kapitler. Appen fungerer både på og uten nett, og synkroniseres mellom Mac, PC, iPad og mobil.

Appen er laget for **Fysikk 1**, **Kjemi 1** og **Biologi 1** (VG2, LK20). Hvert fag har sin egen LaTeX-mal, sitt eget fargetema og egne instrukser til Claude, og flere fag kan legges til (se [Nye fag](#nye-fag)).

## Hva appen gjør

- **Sidebar med fag og kapitler.** Klikk på et fag for å se kapitlene fra læreboka, og på et kapittel for å se notatene i det.
- **Opplasting.** Ta bilder med mobilen, eller last opp PDF-er fra f.eks. GoodNotes eller Notability. Claude leser håndskriften og skriver notatet om til LaTeX:
  - Tro mot originalen. Innholdet endres ikke, men mulige feil (f.eks. regnefeil) markeres med en *merknad*.
  - Formler, enheter (siunitx, desimalkomma) og vektorer settes riktig.
  - Enkle tegninger tegnes på nytt i TikZ, som kraftdiagrammer, grafer og kretser. Kompliserte tegninger klippes ut fra originalbildet.
  - Definisjoner, viktige formler, eksempler og oppgaver får hver sin fargede boks.
  - Ord som er vanskelige å lese, markeres med ?.
- **Kapitler og delkapitler.** Fagene legges inn etter lærebøkene: ERGO Fysikk 1 (alle kapitler og delkapitler, 1A–10D), Kjemi 1 fra Aschehoug (8 kapitler) og Bi 1 fra Gyldendal (15 kapitler). Claude plasserer hvert notat på riktig kapittel og delkapittel, og du kan flytte det selv. Mangler delkapitlene, tar du bilde av innholdsfortegnelsen i boka. Da legges kapitlene og delkapitlene inn og kobles til kompetansemålene. Det samme gjelder andre lærebøker.
- **Kompetansemål.** Hvert delkapittel er koblet til kompetansemålene i faget (Fysikk 1: KM1–KM14, Kjemi 1: KM1–KM17, Biologi 1: KM1–KM11, ordrett fra Udir), så du kan se og filtrere notatene etter mål før eksamen.
- **Søk.** Ctrl/Cmd+K søker i titler og innholdet i alle notatene, også uten nett.
- **Tre kolonner.** På iPad og PC ser du kapitler, notater og PDF side om side. Lys, mørk eller systemtema, og hvert fag har sine egne farger (fysikk «Blekk», kjemi «Tavle», biologi «Salvie») og sin egen PDF-mal (Klassisk, Moderne og Lærebok).
- **Visualiseringer.** Interaktive forklaringer til hvert kapittel, der du styrer situasjonen selv med glidebrytere og knapper. I fysikk: friksjon, kraftpar, energibevaring, støt, bølger, Bohrs atommodell, halveringstid og koblinger. I kjemi: elektronkonfigurasjon, molekylform, redoks, balansering, entalpi, organisk navnsetting, likevekt, titrering og spektrofotometri. I biologi: klassifisering og slektskapstrær, diffusjon og osmose, mitose og meiose, nerveimpulsen, blodsukkerregulering, gassutveksling, transpirasjon, smittespredning, flokkimmunitet og antibiotikaresistens. Tallene, grafene og forklaringen oppdateres mens du drar. De ligger under **Visualiseringer** i sidepanelet og lenkes fra kapitlene og notatene.
- **Flashcards.** Marker notatene du vil øve på (hele kapitler eller delkapitler med ett trykk) og velg vanskelighetsgrad: lett (begreper og fakta, korte svar), middels (forklare sammenhenger), vanskelig (drøfte og regne, utfyllende svar) eller blandet. Claude lager spørsmål og svar, med formler der det trengs. Du snur kortet, vurderer svaret fra 1 (feil) til 4 (perfekt) og går rett videre til neste kort. Kort du ikke kunne, kommer igjen etter noen få andre, og et kort er mestret når du har svart riktig på det flere ganger. Etter runden velger du om du vil repetere bare de du ikke kunne, også de du var usikker på, eller alle. Kortstokkene og fremgangen synkes mellom enhetene, og enkeltkort kan redigeres eller slettes. Flashcards ligger i sidepanelet under hvert fag.
- **Samle-PDF.** Last ned et helt kapittel eller hele faget som én PDF med innholdsliste.
- **Offline.**
  - Alle ferdige PDF-er lagres på enheten og kan leses uten nett.
  - Notater du laster opp uten nett, legges i kø og sendes automatisk når du er på nett igjen.
  - Flashcards kan øves uten nett. Fremgangen sendes når du er på nett igjen.
  - Konverteringen skjer på serveren, så du kan lukke appen så snart opplastingen er sendt.
- **Rediger LaTeX.** Du kan se og redigere LaTeX-koden og lage PDF-en på nytt.

## Slik henger det sammen

```
 iPad / mobil / PC                                  Server (Docker, f.eks. på Railway)
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
| `server/latex/<fag>/preamble.tex` | LaTeX-malene (`physics`, `chemistry`, `biology`): pakker, bokser, sidehode |
| `server/src/profiles/<fag>.ts` | Instruksene Claude får for notater i faget |
| `server/src/textbooks.ts` | Lærebøkene: kapitler, delkapitler og kompetansemål |
| `web/src/viz/` | Visualiseringene, én mappe per fag og kapittel |
| `server/src/flashcards/` | Instruksene til Claude og bakgrunnsjobben som lager flashcards |
| `web/src/flashcards/` | Øvingen med flashcards (reglene i `model.ts`) og visning av formler med KaTeX |
| `shared/` | Felles TypeScript-typer for API-et |

## Kom i gang lokalt

Du trenger Node.js 22+ og TeX Live med noen pakker. På Ubuntu/Debian:

```bash
sudo apt-get install texlive-latex-base texlive-latex-recommended texlive-latex-extra \
  texlive-science texlive-pictures texlive-plain-generic texlive-lang-european texlive-fonts-recommended \
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

Se **[docs/OPPSETT.md](docs/OPPSETT.md)** for en trinnvis instruks for alt du må ordne selv: API-nøkkel, serveren på Railway og installering på enhetene. [docs/DEPLOY.md](docs/DEPLOY.md) beskriver også Fly.io og hvordan du kjører serveren hjemme med Docker.

**API-nøkkelen ligger bare på serveren** (`ANTHROPIC_API_KEY`). Den sendes aldri til nettleseren og skal aldri sjekkes inn i git.

## Konfigurasjon

| Variabel | Standard | Beskrivelse |
|---|---|---|
| `APP_PASSWORD` | – (påkrevd i produksjon) | Passordet du logger inn med |
| `ANTHROPIC_API_KEY` | – | Claude API-nøkkel |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Modellen som leser notatene og lager kortene (`claude-opus-5-5` er grundigere, men koster det dobbelte) |
| `CLAUDE_EFFORT` | `medium` | Hvor grundig Claude jobber ved konvertering: `low` / `medium` / `high` / `xhigh` / `max` |
| `CLAUDE_FALLBACKS` | `true` | Hvis Claudes sikkerhetsfiltre ved en feil avslår et notat, prøves en anbefalt reservemodell automatisk |
| `SEED_TEXTBOOKS` | alle kjente | Læreboksett (fag, kapitler, delkapitler og kompetansemål) som legges inn, hvert bare én gang. Kommaliste, f.eks. `ergo-fysikk-1,aschehoug-kjemi-1`, eller `none` for et tomt fag. Se `server/src/textbooks.ts` |
| `DATA_DIR` | `./data` | Database, originaler og PDF-er |
| `PORT` | `8787` (`8080` i Docker) | |
| `MAX_PAGES_PER_NOTE` | `30` | Maks sider per opplasting |
| `LATEX_FIX_ATTEMPTS` | `2` | Antall runder med automatisk retting av LaTeX-feil |
| `WORKER_CONCURRENCY` | `1` | Antall notater som konverteres samtidig |
| `COOKIE_SECURE` | `true` i produksjon | Krever HTTPS for innloggingen |
| `SMARTNOTES_FAKE_CLAUDE` | `0` | `1` gir testinnhold uten å kalle Claude |

## Hva koster det?

Hver side sendes som et bilde i høy oppløsning (ca. 4 800 tokens). Med Claude Sonnet 5.5 ($2 per million input-tokens og $10 per million output-tokens, der tenkning regnes som output) og middels grundighet koster en side omtrent **0,25 kr**, og et notat på 5 sider omtrent **1–1,50 kr**, avhengig av hvor mye som står på sidene. En kortstokk med flashcards koster omtrent 0,50–2 kr, opptil ca. 5 kr for de største. Med vanlig bruk i tre fag blir det rundt 40 kr i måneden til Claude. Instruksene caches mellom notater, og det gjør det litt billigere. Hvor mange tokens hvert notat brukte, lagres i `meta.json` i notatets mappe på serveren.

## Personvern

Bildene av notatene sendes til Anthropics API for å bli lest. Originalene, LaTeX-koden og PDF-ene lagres bare på din egen server og på enhetene dine.

## Utvikling og tester

Hva som er gjort, valgene som er tatt og forslag til neste steg står i **[docs/STATUS.md](docs/STATUS.md)**.

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

Hvert fag har en *profil* med LaTeX-mal, fargetema og instrukser til Claude. Fysikk, kjemi og biologi finnes allerede. Slik legger du til et nytt:

1. Lag `server/latex/<fag>/preamble.tex` (ta utgangspunkt i en av de tre malene).
2. Lag `server/src/profiles/<fag>.ts` med instrukser, og registrer profilen i `server/src/profiles/index.ts`.
3. Legg til profil-id-en i `SubjectProfile` i `shared/src/index.ts` og i `web/src/lib/subjects.tsx` (navn, ikon og PDF-mal), og eventuelt et fargetema i `web/src/styles/subjects.css`.
4. Valgfritt: et læreboksett i `server/src/textbooks.ts` (kapitler, delkapitler og kompetansemål), som legges inn ved neste oppstart.
5. Valgfritt: visualiseringer i `web/src/viz/<fag>/` (se `web/src/viz/README.md`).
