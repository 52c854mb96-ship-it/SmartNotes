# Workflows for visualiseringene

Dette er skriptene som bygde fysikk kapittel 1–4 i økten 5.–6. oktober 2026 ([PR #7](https://github.com/52c854mb96-ship-it/SmartNotes/pull/7)). De brukes videre til resten av arbeidet i [VISUALISERINGER-PLAN.md](../VISUALISERINGER-PLAN.md): først fysikk kapittel 5–10, deretter kjemi og biologi. Skriptene kjøres med Workflow-verktøyet i Claude Code.

| Fil | Hva den gjør |
|---|---|
| `fysikk-kapittel.js` | Ett fysikkapittel fra start til slutt, i fire faser. **Bygg:** oppgraderer de eksisterende visualiseringene og lager nye og eksempeloppgaver, i to parallelle spor. **Kontroll:** faglig og visuell kontroll i bunker på fire. **Retting:** retter funnene i bunker på tre. **Avslutning:** en sluttsjekk, og så commit og push av kapittelmappa. |
| `fysikk-katalog.json` | Argumentene for hvert kapittel: tittel, delkapitler, hva som skal oppgraderes (med idé), nye visualiseringer og eksempeloppgaver. Kapittel 1–4 er ferdige, og 5–10 gjenstår. |
| `kit-finpuss.js` | Løfter byggeklossene i `viz/kjemi/kit/` og `viz/biologi/kit/` til illustrert stil uten å endre API-ene. Én agent per fag tar seg av byggingen, kontrollen og rettingen. Skriptet committer ikke. |
| `kjemi-biologi-kapittel.js` | Kapitler i kjemi eller biologi. De eksisterende visualiseringene finpusses, og hvert kapittel får én ny. Etterpå følger faglig og visuell kontroll, retting, og til slutt commit og push per kapittel. |
| `kjemi-biologi-katalog.json` | Argumentene for kjemi 1–8 og biologi 1–15: alle eksisterende id-er (`polish`) og den nye visualiseringen (`news`, eventuelt `kind: 'eksempel'`). |
| `bin/tsc-sjekk.sh` | Typesjekk under en lås, filtrert på en mappe, siden mange agenter deler maskinen. |
| `bin/shot.sh` | Skjermbilder med `web/scripts/viz-shot.mjs` under en lås, med høyst to Chromium samtidig. |

## Før du starter (ny container)

1. Installer pakkene: kjør `npm ci` i `/home/user/SmartNotes` hvis `node_modules` mangler.
2. Installer TeX Live, som trengs for `npm test` på serveren. Kommandoen står i [CLAUDE.md](../../CLAUDE.md) under «Commands».
3. Start Vite på port 5173. Agentene tar skjermbilder via `viz-preview.html`:
   ```bash
   cd /home/user/SmartNotes/web && nohup npx vite --port 5173 --strictPort > <scratch>/vite.log 2>&1 &
   ```
   Start den på nytt hvis maskinen har startet om, for eksempel etter en pause i økten.
4. Lag galleribildene av scene-kit-et, som agentene ser på i stedet for å lese alle familiefilene:
   ```bash
   cd /home/user/SmartNotes/web && PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port 5173 --galleri alle --themes light --widths 1000 --out <scratch>/galleri-alle
   ```
5. Finn verdiene til argumentene som alle skriptene trenger:
   - `scratch`: mappen for midlertidige filer i økten (scratchpad). Skjermbildene havner her.
   - `branch`: arbeidsgrenen som instruksene for økten oppgir.
   - `trailers`: de to signaturlinjene for commits fra økten, `Co-Authored-By: …` og `Claude-Session: …`, skilt med linjeskift. Ta dem fra instruksene i den nye økten. Bruk ikke linjene fra en gammel økt.

Ikke kjør `playwright install`: Chromium er forhåndsinstallert. WebKit (Safari) kjøres bare i CI-jobben `webkit`.

## Fysikk kapittel 5–10

Kjør én workflow per kapittel, med høyst fire samtidig, for eksempel kapittel 5–8 først og så 9–10. Flere samtidig gjorde at bruksgrensen kom raskere, og maskinen ble treg.

```js
Workflow({
  scriptPath: '/home/user/SmartNotes/docs/workflows/fysikk-kapittel.js',
  args: {
    chapter: { /* hele objektet for kapittelet fra fysikk-katalog.json, f.eks. katalog["5"] */ },
    scratch: '<scratch>',
    branch: '<arbeidsgrenen>',
    trailers: 'Co-Authored-By: …\nClaude-Session: …',
  },
})
```

- Send `args` som ekte JSON, ikke som en tekststreng.
- **Lagre kjøre-id-en (`wf_…`) og de nøyaktige `args` i en fil i scratch.** Du trenger dem for å gjenoppta.
- Et kapittel bruker omtrent 16–18 agenter. Til slutt committer og pusher workflowen kapittelmappa selv med meldingen «Fysikk kapittel N: illustrerte visualiseringer, nye praktiske og eksempeloppgaver».
- Agentene endrer bare filer i `web/src/viz/fysikk/kapNN/`. Mangler noe i scene-kit-et, lager de det lokalt i kapittelmappa.

**Når alle kapitlene er ferdige**, gjør hovedøkten dette:
1. Kjør `npm run typecheck`, `npm test`, `npm run build` og `npm run test:e2e`, og se på noen av skjermbildene selv.
2. Oppdater tallene i `docs/STATUS.md` og fremdriften i planfila.
3. Lag én PR for fysikk 5–10 til `main`, vent til CI er grønn (`test`, `webkit` og `docker`), flett den og nullstill arbeidsgrenen fra `main`.

## Kjemi og biologi

1. **Først kit-et:** kjør `kit-finpuss.js` med `args: { scratch }`.
   - Skriptet committer ikke. Se på før- og etter-bildene i `<scratch>/kit-kjemi/` og `<scratch>/kit-biologi/`, kjør typesjekk og testene, og commit selv.
   - Et halvferdig forsøk 6. oktober ble avbrutt av bruksgrensen og tatt ut igjen. Det må derfor kontrolleres ordentlig denne gangen.
2. **Så kapitlene:** kjør `kjemi-biologi-kapittel.js` med `args: { fag: 'kjemi' | 'biologi', chapters: [...], scratch, branch, trailers }`.
   - `chapters` er to–tre kapitler fra `kjemi-biologi-katalog.json`.
   - Skriptet kjører kapitlene i parallell, så hold totalt rundt fire kapitler i gang samtidig.
   - Hvert kapittel committes for seg.
3. **Til slutt:** samme sjekker som for fysikk. Lag én PR for kjemi og biologi (eller én per fag), flett den når CI er grønn, og fjern planfila når alt er ferdig (punkt 7 i planen).

## Når bruksgrensen stopper arbeidet

Agentene dør når bruksgrensen nås. Skriptene oppdager det (`need()`) og stopper med feilen «Avbrutt: …».

- **Slik gjenopptar du:** bruk samme skript, den lagrede kjøre-id-en og **nøyaktig samme `args`**:
  ```js
  Workflow({ scriptPath: '…/fysikk-kapittel.js', resumeFromRunId: 'wf_…', args: { /* samme som før */ } })
  ```
  Ferdige agenter hentes da fra hurtigbufferen, og arbeidet fortsetter der det stoppet.
- **Fortsettelse av seg selv:** i forrige økt sørget en påminnelse hver time for at arbeidet fortsatte av seg selv etter bruksgrensen. Mot slutten ba eleven likevel om at ingenting nytt skulle startes nær grensen. Følg det eleven skriver i chatten.
- **Etter en omstart:** maskinen kan starte på nytt mens økten står. Filene ligger da fortsatt der, men Vite må startes på nytt (punkt 3 over).

## Erfaringer fra forrige økt

- **Hold tokenbruken nede:** fysikk 5–10 bruker det slanke oppsettet.
  - Agentene leser `web/src/viz/kit/scene/API.md` i stedet for hele familiefilene og ser på galleribildene.
  - Kontrollen går i bunker på fire, og rettingen i bunker på tre.
- **Ende-til-ende-testene avhenger av noen titler og tekster:**
  - Fysikk kapittel 2: «Statisk friksjon og glidefriksjon», «Kassen står i ro.», «Kassen glir.», «Koblede klosser», «Kraftpar: bok, bord og jord» og «Gravitasjonsparet». Noen av disse brukes både i `visualizations.spec.ts` og `safari.spec.ts`.
  - Kjemi kapittel 7: «Syre-base-titrering».
  - Biologi kapittel 15: «Vaksiner og flokkimmunitet».

  Skriptene ber agentene la dem stå. Kjør likevel `npm run test:e2e` før PR-en. `safari.spec.ts` kjøres bare i CI (WebKit), så søk i `e2e/` etter tekster som er endret.
- **Låser:** `bin/shot.sh` og `bin/tsc-sjekk.sh` bruker låser i `/tmp`. Kjør derfor ikke Playwright eller `tsc` direkte fra agentene.
- **Ikke stopp ditt eget skall:** vær forsiktig med `pkill -f` når du rydder opp gamle serverprosesser. Mønsteret kan treffe skallet ditt hvis teksten også står i kommandoen.
- **Kjent feil:** rottegnet (√) i `FormulaLine` står litt for lavt. Kapittel 4 retter det lokalt. Det bør rettes sentralt i `web/src/viz/kit/`, som en liten egen oppgave.
