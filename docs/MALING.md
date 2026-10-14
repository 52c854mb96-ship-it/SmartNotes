# Måle modeller på dine egne notater

Før vi bytter fra Claude til en lokal modell, må vi vite hvor god den lokale modellen faktisk er på *dine* notater. Måleverktøyet kjører de samme notatsidene gjennom flere modeller og lager en rapport der du ser resultatene side ved side.

Tenk på det som en blindtest av brus: alle får smake det samme, og du gir karakter. Tallene (tid, pris og likhet) hjelper, men det er karakterene dine som avgjør.

## Hva verktøyet gjør

For hvert notat og hver modell:

1. Modellen leser sidebildene og skriver LaTeX, akkurat som i appen.
2. Figurene klippes ut, og PDF-en lages med samme mal som i appen. Kompilerer den ikke, får modellen inntil to forsøk på å rette koden.
3. Verktøyet måler tid, tokens og pris (Claude etter listepris, lokale modeller koster 0), og hvor likt modellen leste notatet som referansen.
4. Med `--flashcards` lager hver modell også en kortstokk av referansens LaTeX, så alle får samme utgangspunkt.

Til slutt skrives `rapport.html` (åpnes i nettleseren) og `resultater.json`.

## 1. Gjør klar notatene

Lag en mappe med 10–20 sider du kjenner godt. Ta med både lette og vanskelige sider: mye matte, figurer, rotete håndskrift og en side med kjemiske formler hvis du har.

```
notater/
  Newtons lover/      ← en undermappe er ett notat (sidene i alfabetisk rekkefølge)
    side1.jpg
    side2.jpg
  Bevegelse.pdf       ← en løs fil er et eget notat
  Energi.jpg
```

Bilder (JPEG, PNG, HEIC) og PDF-er fungerer, akkurat som i appen.

## 2. Installer Ollama og hent modellene

1. Last ned Ollama fra [ollama.com/download](https://ollama.com/download) (Windows og Mac) og installer.
2. Åpne en terminal (PowerShell på Windows, Terminal på Mac) og hent modellene du vil teste, for eksempel:

```bash
ollama pull qwen3.5:9b
ollama pull qwen3.5:4b
ollama pull gemma4:e4b-it-qat
ollama pull ministral-3:8b
```

Dette passer for maskinene dine (navnene er fra oktober 2026; feiler en nedlasting, sjekk navnet på [ollama.com/library](https://ollama.com/library)):

- **Start med `qwen3.5:9b`** (leser bilder, Apache 2.0-lisens, omtrent 6–7 GB). Den passer akkurat på RTX 4060 med 8 GB og går fint på en Mac med 16 GB.
- **`qwen3.5:4b`** er raskere og mindre, til sammenligning.
- **`gemma4:e4b-it-qat` og `ministral-3:8b`** er andre modeller med Apache 2.0-lisens som er verdt å prøve. Havner figurene feil for dem, prøv `@thousandths-yx` eller `@pixels` etter navnet i målingen.
- **Unngå** Llama-bildemodellene (lisensen har egne regler for EU/EØS) og Qwen2.5-VL 3B (bare for forskning). Appen skal selges, så lisensen må tillate det.

Anslaget er 45–90 sekunder per side på RTX 4060 og 1,5–3 minutter per side på M4. Det er ikke målt, så målingen viser hva som faktisk gjelder.

## 3. Kjør målingen

Du trenger repoet på maskinen og Node.js 22 eller nyere ([nodejs.org](https://nodejs.org)), og i tillegg enten Docker eller LaTeX.

### Med Docker (enklest hvis du har Docker Desktop)

Docker-bildet til appen har LaTeX innebygd. Kjør dette fra mappen der repoet ligger:

```bash
docker build -t smartnotes .
docker run --rm -v "$PWD/maling:/data" -e OLLAMA_URL=http://host.docker.internal:11434 smartnotes \
  node server/dist/cli/eval.js /data/notater --models "ollama:qwen3.5:9b,ollama:qwen3.5:4b" --out /data/resultat
```

Legg notatmappen i `maling/notater` først. Rapporten havner i `maling/resultat/rapport.html`. På Windows (PowerShell) skriver du `${PWD}` i stedet for `$PWD`. På Linux legger du til `--add-host=host.docker.internal:host-gateway`.

Får du «Fikk ikke kontakt med den lokale AI-en», må Ollama lytte på alle adresser. Avslutt Ollama, sett miljøvariabelen `OLLAMA_HOST` til `0.0.0.0` og start Ollama igjen.

### Uten Docker

Installer LaTeX først: MacTeX på Mac ([tug.org/mactex](https://tug.org/mactex/)) eller TeX Live på Windows ([tug.org/texlive](https://tug.org/texlive/)). For PDF-er trenger du også poppler (`brew install poppler` på Mac). På Windows er det enklest å bruke bilder, eller Docker. Kjør så fra mappen der repoet ligger:

```bash
npm ci
npm run eval --workspace server -- notater --models "ollama:qwen3.5:9b,ollama:qwen3.5:4b"
```

### Med Claude som sammenligning

Det mest nyttige er å ha med Claude som referanse, slik at du ser hvor langt de lokale modellene er fra det appen gir i dag. Da trenger du en API-nøkkel fra [console.anthropic.com](https://console.anthropic.com). Legg den i terminalen (ikke i chatten og ikke i git):

```bash
# Mac
export ANTHROPIC_API_KEY=din-nøkkel
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="din-nøkkel"
```

Med Docker legger du til `-e ANTHROPIC_API_KEY` i `docker run`. Eksempel med Sonnet 5.5 som referanse, Haiku 5.5 og to lokale modeller:

```bash
npm run eval --workspace server -- notater --flashcards \
  --models "anthropic:claude-sonnet-5-5,anthropic:claude-haiku-5-5,ollama:qwen3.5:9b,ollama:qwen3.5:4b"
```

20 sider koster omtrent 5 kr med Sonnet 5.5 og rundt 25 øre med Haiku 5.5 (beregnet, ikke målt). Haiku 5.5 leser bilder i like høy oppløsning som Sonnet 5.5. En modell som ikke gjør det, avvises med en feilmelding i stedet for å klippe figurene feil. Se likevel nøye på figurene: hvor godt modellen plasserer boksene, varierer.

## Valg

| Valg | Betydning |
|---|---|
| `--models` | Kommaliste. `anthropic:<modell>`, `ollama:<modell>` eller `fake` (testinnhold, for å prøve verktøyet). Etter en Ollama-modell kan du skrive hvordan den oppgir figurbokser: `@thousandths` (standard, Qwen3.5 og Qwen3-VL), `@thousandths-yx` (y før x, prøv det hvis figurene havner feil med Gemma) eller `@pixels` (Qwen2.5-VL) |
| `--subject` | `physics` (standard), `chemistry`, `biology` eller `geoscience`, altså hvilke instrukser og hvilken PDF-mal som brukes |
| `--reference` | Modellen de andre sammenlignes med. Standard er den første i listen |
| `--flashcards` | Lag også kortstokker |
| `--chapters` | Kapitler modellen kan velge mellom, for eksempel `"1 Bevegelse;2 Krefter"`. Uten dette er kapittelet fast, og modellen kan bare konsentrere seg om å lese |
| `--out` | Mappen for resultatene. Standard er `maling-<dato og tid>` der du står |

Ollama-innstillingene fra README gjelder også her, for eksempel `OLLAMA_IMAGE_MAX_EDGE`, `OLLAMA_NUM_CTX` og `OLLAMA_PAGES_PER_CALL` (standard én side per kall).

## 4. Les rapporten

- **Oversikten øverst** viser per modell hvor mange notater som ble til en PDF uten feil, hvor mange rettinger som trengtes, sekunder og kroner per side, og likhet med referansen.
- **Likhet** er bare et grovt mål på hvor likt modellen leste notatet som referansen, regnet i ord. Det sier ikke hvem som har rett, og 90 % kan fortsatt bety en feil i en viktig formel.
- **Karakterene** setter du selv under hver PDF, fra 1 til 5, på tekst, matte, figurer og helhet. Snittet for «Helhet» vises i oversikten. Med «Last ned karakterene (CSV)» kan du lagre dem og sende dem til Claude i neste økt.

En lokal modell er god nok for gratisversjonen hvis den får helhetskarakter 4 eller bedre på de fleste notatene, og ikke gjør feil i formler som ikke blir markert.
