# Workflows for visualiseringene

Dette er skriptene som bygde fysikk kapittel 1–4 i økten 5.–6. oktober 2026 ([PR #7](https://github.com/52c854mb96-ship-it/SmartNotes/pull/7)). De brukes videre til resten av arbeidet i [VISUALISERINGER-PLAN.md](../VISUALISERINGER-PLAN.md): først fysikk kapittel 5–10, deretter kjemi og biologi. Skriptene kjøres med Workflow-verktøyet i Claude Code.

| Fil | Hva den gjør |
|---|---|
| `fysikk-kapittel.js` | Ett fysikkapittel fra start til slutt, i fire faser. **Bygg:** oppgraderer de eksisterende visualiseringene og lager nye og eksempeloppgaver, i to parallelle spor. **Kontroll:** faglig og visuell kontroll i bunker på fire. **Retting:** retter funnene i bunker på tre. **Avslutning:** en sluttsjekk, og så commit og push av kapittelmappa. |
| `fysikk-katalog.json` | Argumentene for hvert kapittel: tittel, delkapitler, hva som skal oppgraderes (med idé), nye visualiseringer og eksempeloppgaver. Kapittel 1–4 er ferdige (`"done": true`, og skriptet nekter å kjøre dem), og 5–10 gjenstår. |
| `kit-finpuss.js` | Løfter byggeklossene i `viz/kjemi/kit/` og `viz/biologi/kit/` til illustrert stil uten å endre API-ene. Hvert fag får tre agenter etter hverandre: bygg, kontroll og retting. Skriptet committer ikke. |
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
4. Lag galleribildene av scene-kit-et, ett per familie. Agentene ser på dem i stedet for å lese alle familiefilene, og de lager dem ikke selv:
   ```bash
   cd /home/user/SmartNotes/web && for g in bakgrunn felles figurer kjerne kjoretoy lab mekanikk rom; do PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port 5173 --galleri $g --themes light --widths 1000 --out <scratch>/galleri-alle; done
   ```
   Det gir `galleri-<familie>-light-1000.png` i `<scratch>/galleri-alle/`.
5. Finn verdiene til argumentene som alle skriptene trenger:
   - `scratch`: mappen for midlertidige filer i økten (scratchpad). Skjermbildene havner her.
   - `branch`: arbeidsgrenen som instruksene for økten oppgir.
   - `trailers`: de to signaturlinjene for commits fra økten, `Co-Authored-By: …` og `Claude-Session: …`, skilt med et ekte linjeskift (skriptene sjekker det). Ta dem fra instruksene i den nye økten. Bruk ikke linjene fra en gammel økt.
6. Før en logg over kjøringene i `<scratch>/kjoringer.md`: kjøre-id (`wf_…`), skript og de nøyaktige `args` for hver kjøring. Du trenger dem for å gjenoppta etter bruksgrensen.
7. Skal arbeidet fortsette av seg selv etter bruksgrensen (eleven sier det i prompten), så sett opp en påminnelse **før** den første workflowen. Når grensen først er nådd, kan økten ikke gjøre noe selv. Lag en Routine som fyrer hver time inn i denne økten (`create_trigger` i MCP-serveren claude-code-remote, cron `0 * * * *`), med en tekst som: «Sjekk workflowene i `<scratch>/kjoringer.md`. Gjenoppta de som er avbrutt (resumeFromRunId og samme args), og start neste steg i VISUALISERINGER-PLAN.md når et steg er ferdig.» Slett den med `delete_trigger` når alt er flettet, eller når eleven sier stopp.
8. Anbefalt før fysikk 5–10 (hovedøkten gjør det selv, agentene får ikke endre `kit/`): rett rottegnet sentralt. `.viz-root` i `web/src/styles/viz.css` bruker `var(--font)`, som tegner √ for lavt. Kapittel 4 bruker lokalt fontlista `'Cambria Math', 'STIX Two Math', Cambria, Georgia, 'Times New Roman', serif` (se `EksBallistiskPendel.tsx`). Flytt den inn i `.viz-root`, så får kapittel 5 og 9, som bruker √, rettelsen.

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

- Send `args` som ekte JSON, ikke som en tekststreng. Kapittelobjektet skriver du ut med for eksempel `node -e 'console.log(JSON.stringify(require("./docs/workflows/fysikk-katalog.json")["5"]))'` fra repoet.
- **Før kjøre-id-en (`wf_…`) og de nøyaktige `args` inn i `<scratch>/kjoringer.md`.** Du trenger dem for å gjenoppta.
- Et kapittel bruker 14–16 agenter. Til slutt committer og pusher workflowen kapittelmappa selv med meldingen «Fysikk kapittel N: illustrerte visualiseringer, nye praktiske og eksempeloppgaver». Klarer slutt-agenten ikke å committe og pushe, stopper workflowen med «Avbrutt». Da committer og pusher du mappa for hånd (å gjenoppta gir samme resultat fra hurtigbufferen).
- Agentene endrer bare filer i `web/src/viz/fysikk/kapNN/`. Mangler noe i scene-kit-et, lager de det lokalt i kapittelmappa.

**Når alle kapitlene er ferdige**, gjør hovedøkten dette:
1. Kjør `npm run typecheck`, `npm test`, `npm run build` og `npm run test:e2e`, og se på noen av skjermbildene selv.
2. Oppdater tallene i `docs/STATUS.md` og fremdriften i planfila.
3. Lag én PR for fysikk 5–10 til `main`, vent til CI er grønn (`test`, `webkit` og `docker`), flett den og nullstill arbeidsgrenen fra `main`.
   - Bruk GitHub-verktøyene: `create_pull_request`, `merge_pull_request` (squash, som tidligere PR-er) og `subscribe_pr_activity` for CI-hendelser. `gh` er ikke tilgjengelig i skyøktene.

## Kjemi og biologi

Rekkefølgen og PR-ene følger elevens valg «én PR per fag»: fysikk 5–10, så kjemi (med kit-finpussen for begge fag), så biologi.

1. **Først kit-et:** kjør `kit-finpuss.js` med `args: { scratch }`.
   - Den kan gjerne kjøre mens fysikk 9–10 går, men commit den først etter at fysikk-PR-en er flettet, så den kommer med i kjemi-PR-en.
   - Skriptet committer ikke. Se på før- og etter-bildene i `<scratch>/kit-kjemi/` og `<scratch>/kit-biologi/`, kjør typesjekk og testene, og commit selv.
   - Et halvferdig forsøk 6. oktober ble avbrutt av bruksgrensen og tatt ut igjen. Det må derfor kontrolleres ordentlig denne gangen.
2. **Så kapitlene:** kjør `kjemi-biologi-kapittel.js` med `args: { fag: 'kjemi' | 'biologi', chapters: [...], scratch, branch, trailers }`.
   - `chapters` er to–tre kapitler fra `kjemi-biologi-katalog.json`, for eksempel `require("./docs/workflows/kjemi-biologi-katalog.json").kjemi.slice(0, 3)` (lista starter på kapittel 1).
   - Skriptet kjører kapitlene i parallell, så hold totalt rundt fire kapitler i gang samtidig.
   - Hvert kapittel committes for seg. Et kapittel som blir avbrutt, stopper workflowen med «Avbrutt» når de andre er ferdige.
3. **Til slutt:** samme sjekker som for fysikk, én PR for kjemi og én for biologi, flettet når CI er grønn. Fjern planfila når alt er ferdig (punkt 7 i planen).

## Når bruksgrensen stopper arbeidet

Agentene dør når bruksgrensen nås. Skriptene oppdager det (`need()`) og stopper med feilen «Avbrutt: …».

- **Slik gjenopptar du:** bruk samme skript, den lagrede kjøre-id-en og **nøyaktig samme `args`**:
  ```js
  Workflow({ scriptPath: '…/fysikk-kapittel.js', resumeFromRunId: 'wf_…', args: { /* samme som før */ } })
  ```
  Ferdige agenter hentes da fra hurtigbufferen, og arbeidet fortsetter der det stoppet.
- **Fortsettelse av seg selv:** i forrige økt sørget en påminnelse hver time for at arbeidet fortsatte av seg selv etter bruksgrensen (se punkt 7 under «Før du starter»). Om det skal gjelde, bestemmer eleven i chatten.
- **Bare i samme økt:** gjenopptak virker bare i økten som startet kjøringen. Ledetekstene inneholder scratch-mappa og signaturlinjene, som er andre i en ny økt, og kjøre-id-en ligger i den gamle økten. Står et kapittel halvferdig når en økt slutter, ser neste økt på `git status` for `web/src/viz/<fag>/kapNN/`. Den fullfører og committer for hånd, eller rydder mappa (`git checkout -- <mappa>` og `git clean -fd <mappa>`) og kjører kapittelet på nytt.
- **Etter en omstart:** maskinen kan starte på nytt mens økten står. Filene ligger da fortsatt der, men Vite må startes på nytt (punkt 3 over).

## Erfaringer fra forrige økt

- **Hold tokenbruken nede:** fysikk 5–10 bruker det slanke oppsettet.
  - Agentene leser `web/src/viz/kit/scene/API.md` i stedet for hele familiefilene og ser på galleribildene.
  - Kontrollen går i bunker på fire, og rettingen i bunker på tre.
- **Ende-til-ende-testene avhenger av noen titler og tekster:**
  - Fysikk kapittel 2: «Statisk friksjon og glidefriksjon», «Kassen står i ro.», «Kassen glir.», glidebryteren «Dytt F», «Kraftpar: bok, bord og jord», «Gravitasjonsparet» og «Jorda trekker boka nedover». Noen av disse brukes både i `visualizations.spec.ts` og `safari.spec.ts`, som også bruker CSS-klassen `.viz-figure svg`.
  - Kjemi kapittel 7: «Syre-base-titrering».
  - Biologi kapittel 15: «Vaksiner og flokkimmunitet».

  Skriptene ber agentene la dem stå. Nye titler og sammendrag må heller ikke inneholde dem, siden lenkene finnes med regex, og to treff får testen til å feile. Kjør likevel `npm run test:e2e` før PR-en. `safari.spec.ts` kjøres bare i CI (WebKit), så søk i `e2e/` etter tekster som er endret.
- **Låser:** `bin/shot.sh` og `bin/tsc-sjekk.sh` bruker låser i `/tmp`. Kjør derfor ikke Playwright eller `tsc` direkte fra agentene.
- **Ikke stopp ditt eget skall:** vær forsiktig med `pkill -f` når du rydder opp gamle serverprosesser. Mønsteret kan treffe skallet ditt hvis teksten også står i kommandoen.
- **Kjent feil:** rottegnet (√) står litt for lavt i formlene. Se punkt 8 under «Før du starter».
