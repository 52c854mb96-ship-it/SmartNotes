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
- **Temaer og deltemaer.** Fagene legges inn etter læreplanene (LK20) med kompetansemålene fra Udir og SmartNotes' egne temaer: Fysikk 1 (10 temaer med 29 deltemaer), Kjemi 1 (8 temaer) og Biologi 1 (8 temaer). Claude plasserer hvert notat på riktig tema og deltema, og du kan flytte det selv. Vil du heller ha kapitlene i din egen lærebok, tar du bilde av innholdsfortegnelsen. Da legges kapitlene og delkapitlene inn for deg og kobles til de samme kompetansemålene.
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
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Modellen som leser notatene og retter LaTeX (`claude-opus-5-5` er grundigere, men koster det dobbelte). Må lese bilder i høy oppløsning, ellers avvises konverteringen |
| `CLAUDE_MODEL_FLASHCARDS` | `claude-haiku-5-5` | Modellen som lager kortstokkene. Avslår Haiku, prøves `CLAUDE_MODEL` |
| `CLAUDE_MODEL_TOC` | `claude-haiku-5-5` | Modellen som leser innholdsfortegnelser og kobler delkapitler til kompetansemål |
| `CLAUDE_EFFORT` | `medium` | Hvor grundig Claude jobber ved konvertering: `low` / `medium` / `high` / `xhigh` / `max` |
| `CLAUDE_FALLBACKS` | `true` | Hvis Claudes sikkerhetsfiltre ved en feil avslår et notat, prøves en anbefalt reservemodell automatisk |
| `SEED_TEXTBOOKS` | alle | Fagoppsett (fag, temaer, deltemaer og kompetansemål) som legges inn, hvert bare én gang. Kommaliste, f.eks. `fysikk-1-lk20,kjemi-1-lk20`, eller `none` for et tomt fag. De gamle id-ene virker fortsatt. Se `server/src/presets.ts` |
| `DATA_DIR` | `./data` | Database, originaler og PDF-er |
| `PORT` | `8787` (`8080` i Docker) | |
| `MAX_PAGES_PER_NOTE` | `30` | Maks sider per opplasting |
| `LATEX_FIX_ATTEMPTS` | `2` | Antall runder med automatisk retting av LaTeX-feil |
| `WORKER_CONCURRENCY` | `1` | Antall notater som konverteres samtidig |
| `COOKIE_SECURE` | `true` i produksjon | Krever HTTPS for innloggingen |
| `SMARTNOTES_FAKE_CLAUDE` | `0` | `1` gir testinnhold uten å kalle Claude |
| `USD_NOK` | `10.5` | Kurs fra dollar til kroner i oversikten «Forbruk av AI» i innstillingene |

### Lokal AI med Ollama (valgfritt)

Appen kan bruke en lokal modell via [Ollama](https://ollama.com) i stedet for Claude, for én oppgave eller for alle. Claude er fortsatt standard. Ollama må kjøre på en maskin serveren når fram til (for eksempel samme maskin under utvikling).

| Variabel | Standard | Beskrivelse |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | `anthropic` (Claude), `ollama` (lokal modell på samme maskin som serveren) eller `remote` (hjemmemaskinen, se under) for alle oppgaver |
| `AI_PROVIDER_CONVERT` / `AI_PROVIDER_FLASHCARDS` / `AI_PROVIDER_TOC` | som `AI_PROVIDER` | Unntak per oppgave: konvertering (og retting av LaTeX), kortstokker, innholdsfortegnelser (og kompetansemål) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Adressen til Ollama |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Modellen som leser bilder (må støtte bilder). Bruk modeller med en lisens som tillater salg, for eksempel Apache 2.0 (Qwen3.5, Qwen3-VL, Gemma 4, Ministral 3). Unngå Llama-bildemodellene og Qwen2.5-VL 3B |
| `OLLAMA_TEXT_MODEL` | som `OLLAMA_MODEL` | Modellen for ren tekst: retting av LaTeX, kortstokker og kompetansemål |
| `OLLAMA_IMAGE_MAX_EDGE` | `1600` | Lengste kant på sidebildene som sendes (piksler). Mindre er raskere, men gir dårligere lesing |
| `OLLAMA_NUM_CTX` | `16384` | Minste kontekstvindu i tokens. Appen gjør det større for store notater, opp til `OLLAMA_MAX_CTX` |
| `OLLAMA_MAX_CTX` | `32768` | Største kontekstvindu. Større vindu bruker mer minne på skjermkortet; er notatet for stort, får du beskjed om å dele det opp |
| `OLLAMA_THINK` | `false` | `true` lar modeller som kan tenke, tenke før de svarer. Det tar tid og plass, så det er av som standard |
| `OLLAMA_MAX_TOKENS` | `8192` | Maks lengde på svaret |
| `OLLAMA_TIMEOUT_MS` | `900000` | Hvor lenge serveren venter på svar (15 minutter). Svaret strømmes, så lange svar avbrytes ikke underveis |
| `OLLAMA_BOX_UNITS` | `thousandths` | Hvordan modellen oppgir figurbokser: `thousandths`, tusendeler 0–1000 som [x0, y0, x1, y1] (Qwen3.5, Qwen3-VL), `thousandths-yx` (samme, men y først) eller `pixels` (Qwen2.5-VL) |
| `OLLAMA_PAGES_PER_CALL` | `1` | Sider per kall ved konvertering. Små modeller gjør det bedre med én side om gangen; `0` sender alle sidene samtidig |
| `OLLAMA_KEEP_ALIVE` | `10m` | Hvor lenge Ollama holder modellen i minnet etter et kall |

Eksempel: konverter lokalt, men lag kortstokker med Claude:

```bash
ollama pull qwen3.5:9b
AI_PROVIDER_CONVERT=ollama npm run dev
```

Lokal AI koster ingenting i forbruksoversikten (strømmen regnes ikke med). Kvaliteten avhenger mye av modellen og maskinen; mål den på dine egne notater før du bytter for alvor ([docs/MALING.md](docs/MALING.md)).

### Hjemmemaskin (valgfritt)

Serveren på Railway kan sende AI-kallene til en PC eller Mac hjemme som kjører Ollama. Hjemmemaskinen henter kallene selv over HTTPS, så ingen porter må åpnes. Oppsett trinn for trinn: [docs/HJEMMEMASKIN.md](docs/HJEMMEMASKIN.md).

| Variabel (serveren) | Standard | Beskrivelse |
|---|---|---|
| `WORKER_TOKEN` | – | Hemmelig nøkkel (minst 32 tegn) som hjemmemaskinen logger inn med. Uten den er hjemmemaskin-API-et av |
| `AI_PROVIDER_CONVERT` osv. | – | `remote` sender oppgaven til hjemmemaskinen |
| `REMOTE_FALLBACK` | `none` | `anthropic` bruker Claude når ingen hjemmemaskin er på nett, også for kall som allerede venter |
| `REMOTE_MAX_WAIT_MS` | `43200000` | Hvor lenge et notat kan vente på hjemmemaskinen før det gir opp (12 timer) |
| `REMOTE_LEASE_MS` | `60000` | Hvor lenge et kall er reservert uten livstegn fra hjemmemaskinen (minst 10 s) |
| `REMOTE_MAX_RUN_MS` | `7200000` | Hvor lenge hjemmemaskinen kan jobbe med ett kall før det stoppes, selv med livstegn (2 timer) |
| `REMOTE_ONLINE_MS` | `120000` | En hjemmemaskin regnes som på nett hvis den har vært i kontakt så nylig (minst 60 s) |

## Hva koster det?

Hver side sendes som et bilde i høy oppløsning (ca. 4 800 tokens). Med Claude Sonnet 5.5 ($2 per million input-tokens og $10 per million output-tokens, der tenkning regnes som output) og middels grundighet koster en side omtrent **0,25 kr**, og et notat på 5 sider omtrent **1–1,50 kr**, avhengig av hvor mye som står på sidene. Kortstokker og innholdsfortegnelser lages med Claude Haiku 5.5, som koster en tjuendedel: en kortstokk koster noen få øre (ca. 0,05–0,15 kr), og under 1,50 kr for de aller største. Med vanlig bruk i tre fag blir det rundt 40 kr i måneden til Claude. Instruksene caches mellom notater, og det gjør det litt billigere. Hvor mange tokens hvert notat brukte, lagres i `meta.json` i notatets mappe på serveren.

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
