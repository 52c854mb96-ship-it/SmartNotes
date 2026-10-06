# Visualiseringer

Interaktive forklaringer til hvert kapittel i lærebøkene (ERGO Fysikk 1, Kjemi 1 og Bi 1). De vises på `/fag/:fag/visualiseringer` (oversikt) og `/fag/:fag/visualiseringer/k2-friksjon` (én visualisering), og lenkes fra kapittelsiden og notatsiden (etter delkapittel).

**Mønster å følge:** `fysikk/kap02/` (friksjon, kraftpar og koblede klosser), og for kjemi `kjemi/kap01/` og `kjemi/kap03/`. Les dem før du lager nye.

**Nytt fra oktober 2026:** visualiseringene tegnes i **illustrert realisme** med scene-kit-et (`kit/scene/`), og hvert kapittel får **eksempeloppgaver** med løsning steg for steg (`kit/eksempel.tsx`). Les de to avsnittene om dette under før du lager eller endrer noe. Mønster for eksempeloppgavene: `fysikk/kap02/EksSkraplan.tsx`.

## Struktur

```
viz/
  kit/              felles byggeklosser – importer alt fra '../../kit'
  fysikk/           Fysikk 1 (ERGO Fysikk 1); kjemi/ og biologi/ er bygd opp på samme måte
    index.ts        samler kapitlene i faget (legg til nye kapitler her)
    kapNN/
      index.ts      liste med VizMeta for kapittelet (rekkefølgen = rekkefølgen på siden)
      model.ts      ren fysikk/kjemi/biologi uten React (testes)
      model.test.ts vitest-tester av modellen
      Navn.tsx      én komponent per visualisering, `export default`
  registry.ts       fagtype → visualiseringer (endres ikke når du legger til visualiseringer)
  preview.tsx       forhåndsvisning uten resten av appen (kun utvikling)
```

`index.ts`:

```ts
{
  id: 'friksjon',               // små bokstaver og bindestrek; URL-nøkkel blir k2-friksjon
  chapter: '2',
  sections: ['2C'],             // delkapitlene i læreboka (se server/src/textbooks.ts); kan være tom i kjemi/biologi
  title: 'Statisk friksjon og glidefriksjon',   // stor forbokstav bare i første ord
  summary: 'Én til to setninger om hva du kan utforske.',
  keywords: ['friksjonstall'],
  load: () => import('./Friksjon'),
}
```

## Oppbygning av én visualisering

Rekkefølge inne i `<VizLayout>`:

1. `<Controls>` med `<Slider>` (og/eller `<Toolbar>` med `<Segmented>`, `<Toggle>`, `<PlayControls>`)
2. Én eller to `<Figure viewBox="0 0 800 H">` (SVG). Bruk `<Plot>` for grafer.
3. `<Legend>` hvis fargene trenger forklaring
4. `<Readouts>` med 2–4 `<Readout>` (store tall)
5. `<Formula>` med utregning med levende tall (valgfritt)
6. `<Explain>` – kort tekst som **endrer seg med tilstanden** og forklarer hva eleven ser

## Illustrert realisme (scene-kit)

Eleven vil at visualiseringene skal se **ekte** ut og samtidig være **maksimalt lette å forstå**. Tenk en god, moderne lærebokillustrasjon: en ekte bil på en vei med himmel og landskap bak, en trekasse på en planke, en heis med en person på en badevekt. Fysikken (kraftpiler, fartspiler, mål og tall) legges tydelig oppå.

### Grunnregelen: dempet scene, tydelig fysikk

- Scenen bruker naturlige, dempede farger fra `SCENE` og `PAINTS` (CSS-variabler `--sc-*` i `kit/scene/scene.css`, lyst og mørkt tema).
- Fysiske størrelser bruker alltid `VIZ`-fargene (G oransje, N blå, R lilla, F grønn, v turkis, a magenta). Bruk dem aldri på gjenstander.
- Pilene er tykke `ForceArrow` med glorie, så de synes oppå himmel, asfalt og snø. Etiketter og mål har også glorie (`Txt`, `Dimension`, `Callout`, `ValueTag`).
- Lengden på pilene er proporsjonal med størrelsen, med én fast skala (px/N) i hele figuren. Skalaen kan avhenge av tallsettet, men aldri av hvilken kraft det er.
- Gi eleven en bryter for kreftene der scenen ellers blir rotete: `<Toggle label="Vis krefter" …>`. Standard er på når kreftene er poenget.

### Bruk

```tsx
import { Himmel, Landskap, Vei, Bil, ForceArrow, Dimension, ValueTag, SCENE } from '../../kit/scene';
```

Scene-kit-et importeres for seg selv, ikke fra `../../kit`, så navnene ikke kolliderer med kjemi- og biologi-kit-et. **Kort oversikt over alt i kit-et: `kit/scene/API.md`** (generert fra JSDoc; les den først, og bare kildefilene for det du bruker). `index.ts` laster også `scene.css`. Gjenstandene ses i galleriet: `http://localhost:5173/viz-preview.html?galleri=alle&theme=dark` (eller `?galleri=kjoretoy` osv.). Skjermbilder: `node scripts/galleri-shot.mjs --port 5173 --galleri alle --out /tmp/galleri`.

| Fil | Innhold |
|---|---|
| `palette.ts` | `SCENE.*` (himmel, landskap, underlag, materialer, hud, rom, skygge), `PAINTS` (rod, blaa, gronn, gul, oransje, lilla, hvit, graa, svart) og `paint()` |
| `core.tsx` | `shade`, `tint`, `alpha`, `mix` (fargeblanding som følger temaet), `LinearGradient`, `RadialGradient`, `materialStops`, `sphereStops`, `ContactShadow`, `Place`, `useSceneScale`, `useStrokeScale`, `sceneRandom(frø)`, `useSvgId`, `SceneObjectProps`, `SCENE_DIM` |
| `overlay.tsx` | `ForceArrow` (tykk pil, `dashed` for komponenter, `origin` for angrepspunktet), `Dimension` (mållinje), `Callout` (etikett med strek), `ValueTag` (skilt med verdi), `SpeedLines` (fartsstreker) |
| `bakgrunn.tsx` | himmel, landskap, trær, underlag og terreng av ulike typer, vei, rom og vann |
| `kjoretoy.tsx` | bil, sykkel, akebrett, kjelke, labvogn, heis og berg-og-dal-vogn |
| `figurer.tsx` | personer i mange positurer (skjelett med leddvinkler), fallskjerm |
| `mekanikk.tsx` | kasse, kloss, ball, curlingstein, trinse, tau, fjær, strikk, kraftmåler, badevekt, bord, rampe, lodd, målebånd og stoppeklokke |
| `lab.tsx` | termometer, vannkoker, kokeplate, kasserolle, isbit, batteri, lyspære, motstand, multimeter, ledning, bryter, stikkontakt, sikring og sikringsskap, solcellepanel og panelovn |
| `rom.tsx` | stjernehimmel, stjerner med farge etter temperatur, sola, planeter, tåker, atomkjerner, nukleoner og elektroner, fotoner, lysstråler og spektre |

Se JSDoc i hver fil for props og ankerpunkt. Gjenstander som står på noe, har `(x, y)` midt på kontaktflaten, så de kan settes rett på et underlag og dreies med et skråplan (`rotate` dreier om ankerpunktet).

### Slik bygges en scene

1. **Bakgrunn:** himmel, landskap eller rom. Hold den rolig, uten detaljer som konkurrerer med fysikken.
2. **Underlag og terreng:** riktig type, for eksempel tørr asfalt, snø, is, gress eller tregulv. Typen kan selv være en del av fysikken (friksjonstallet).
3. **Gjenstander:** i riktige proporsjoner etter én fast skala px/m i hele figuren. En bil er 4,4 m og en person 1,75 m. Bruk myke skygger.
4. **Fysikken oppå:** piler, mål, etiketter og skilt med verdier. De skal ikke overlappe hverandre ved standardverdiene.
5. **Tekst** i figuren bare der den hjelper. Forklaringen hører hjemme i `Explain` under figuren.

Ytterligere regler:
- **Skjematisk er lov når det er tydeligst:** grafer, energistolper, spektre, HR-diagram og periodesystem forblir rene diagrammer, men får samme stil (glorie, farger og typografi). Ikke tving en illustrasjon inn der en graf forklarer bedre. Mange visualiseringer har både en scene og en graf.
- **Egne gjenstander** som bare ett kapittel trenger, lages i kapittelmappen etter samme stil (toninger fra `core.tsx`, `SCENE`-farger, kontur, myk skygge) og legges i en egen fil (f.eks. `kap05/varmepumpe-deler.tsx`).
- **Ytelse:** ingen SVG-filtre og ingen bilder (`<image>`). Statiske bakgrunner kan memoiseres (`useMemo`) når figuren animeres.
- **Mobil:** gjenstandene vokser ikke av seg selv på mobil. Gang størrelser med `useSceneScale()` når små ting må synes, og sjekk skjermbilder på 390 px.
- **Mørkt tema** er skumring, ikke invertert. Sjekk alltid begge temaene.

## Eksempeloppgaver

Hvert kapittel har eksempeloppgaver: en oppgave i eksamensstil med deloppgaver og løsningen steg for steg, med en figur som bygger seg opp. Eleven blar gjennom løsningen. Det er ingen svarfelt.

**Opphavsrett:** oppgavene skal **ligne** eksamensoppgaver i form og nivå, men være **egne**: egen tekst, egne tall og egne situasjoner. Kopier aldri, og gjenfortell aldri, ekte eksamensoppgaver, læreboksoppgaver eller oppgaver fra andre nettsider. Appen kan bli brukt av andre og kanskje koste penger.

**Mønster:** `fysikk/kap02/EksSkraplan.tsx` (med `RAMP_TASKS` og `solveRampTask` i `kap02/model.ts`).

```ts
{
  id: 'eks-skraplan',          // starter alltid med «eks-» (registry.test.ts sjekker det)
  kind: 'eksempel',
  chapter: '2',
  sections: ['2C', '2E'],
  title: 'Kasse som sklir ned en rampe',
  summary: 'Krefter, dekomponering av tyngden, Newtons 2. lov, fart nederst og grensevinkelen, steg for steg.',
  keywords: [...],
  load: () => import('./EksSkraplan'),
}
```

Komponenten bruker `<WorkedExample>` fra `../../kit` i stedet for `VizLayout`:

| Prop | Innhold |
|---|---|
| `intro` | Oppgaveteksten: en kort, konkret situasjon med tallene, slik en eksamensoppgave innleder. |
| `given` | Tallene kort («m = 25 kg»), som brikker. |
| `parts` | Deloppgavene a), b), c) … i eksamensstil: «Tegn kreftene …», «Vis at …», «Hvor stor …», «Bestem …», «Forklar hvorfor …». Bruk gjerne en «Vis at»-oppgave, så eleven kan gå videre selv om svaret på forrige deloppgave mangler. |
| `steps` | Løsningen, 1–3 steg per deloppgave. Hvert steg har `title` (hva vi gjør), `body` (hvorfor), `math` (utregning med levende tall), `answer` (på siste steg i deloppgaven), og gjerne `tip` eller `pitfall` (en vanlig feil). |
| `figure` | `({ step, part, showAll }) => <Figure …>`. Figuren bygger seg opp: kreftene kommer når de blir tegnet, komponentene når de blir regnet ut, og gjenstanden flytter seg når deloppgaven handler om et annet tidspunkt. Med `showAll` vises alt. |
| `variants` | Valgfritt: 2–3 tallsett («Tallsett 1, 2, 3»). Hele teksten og løsningen regnes ut fra tallsettet. Test i `model.test.ts` at alle tallsettene gir fysisk fornuftige svar. |

**Innhold og nivå:**
- Det som typisk kommer på prøver og eksamen i faget: regneoppgaver med flere trinn, tolking av grafer, «forklar» og «vurder».
- 3–5 deloppgaver som bygger på hverandre og blir gradvis vanskeligere, og som bruker flere delkapitler.
- Hvert steg forklarer **hvorfor** vi gjør det, ikke bare hva: hvilken lov, hvilket system, hvilken positiv retning og hvilken formel, og hvorfor akkurat den.
- `pitfall` brukes for typiske feil: N = G på skråplan, celsius i stedet for kelvin, glemt kvadrat, feil friksjonstall, fortegn.
- **Tall:** regn alltid videre med uavrundede verdier fra modellen. Vis mellomsvar med ett siffer mer enn svaret, og svar med fornuftig antall gjeldende siffer og enhet. Tallene i oppgaveteksten, utregningen og svaret skal komme fra samme modellfunksjon, så de alltid stemmer med hverandre.
- **Språk:** som i eksamensoppgaver, kort og presist, på bokmål.
- **Figuren** følger «Illustrert realisme» over.

## Byggeklosser (`kit/`)

| Del | Bruk |
|---|---|
| `Slider` | `label`, `value`, `onChange`, `min`, `max`, `step`, `unit`, `decimals`. `ariaLabel` når etiketten inneholder `<Sub>`. |
| `Segmented` | Én av flere visninger, f.eks. «Hele systemet · Kloss A · Kloss B». |
| `Toggle` | Av/på, f.eks. «Med luftmotstand». |
| `useSimClock` + `PlayControls` | Animasjon. Starter på pause. `clock.t` er simulert tid i sekunder. |
| `Figure` | Responsiv SVG. Gi den en beskrivende `label` for skjermlesere. |
| `Plot` | Akser, rutenett og akseverdier. Barna får `sx`, `sy` (fysiske verdier → SVG). |
| `linePath`, `sample`, `niceTicks`, `scaleLinear` | Grafer. |
| `Arrow` | Kraft-, fart- og akselerasjonspiler. `label`, `labelX/Y`, `labelAnchor`, `dashed`. |
| `Block`, `Ground`, `Spring`, `Boundary`, `Dot`, `Label` | Legemer, underlag, fjær, systemgrense, markør, tekst. |
| `TSub`, `TSup` | Senket/hevet skrift **inne i SVG-tekst**: `μ<TSub>s</TSub>N`. |
| `Sub`, `Sup` | Senket/hevet skrift i vanlig HTML (glidebrytere, formler, forklaring). |
| `Readouts`/`Readout`, `Formula`/`FormulaLine`, `Explain`, `Legend` | Under figuren. |
| `fmt(v, d)`, `fmtUnit`, `fmtSci` | Norske tall: desimalkomma, «–» for ugyldige tall, `6,63 · 10⁻³⁴`. |
| `VIZ` | Faste farger (CSS-variabler). |
| `G_EARTH` | 9,81 m/s². |
| `useTextScale()` | Hvor mye større teksten er på mobil (1 på PC, ca. 1,8 på mobil). Bare inne i en `<Figure>`. |

### Farger

Bruk alltid `VIZ.*`, aldri egne fargekoder. Samme størrelse har samme farge i alle visualiseringene:

| Farge | Størrelse |
|---|---|
| `VIZ.gravity` (oransje) | tyngde G, gravitasjon |
| `VIZ.normal` (blå) | normalkraft N |
| `VIZ.friction` (lilla) | friksjon R, luftmotstand L |
| `VIZ.applied` (grønn) | ytre kraft F, dytt, drag |
| `VIZ.tension` (grå) | snordrag S, fjærkraft |
| `VIZ.velocity` (turkis) | fart v |
| `VIZ.acceleration` (magenta) | akselerasjon a |
| `VIZ.series[0..4]` | andre grafer i fast rekkefølge |
| `VIZ.ink`, `VIZ.muted`, `VIZ.grid`, `VIZ.body`, `VIZ.bodyStrong` | tekst, hjelpelinjer, legemer |

## Regler

- **Språk:** norsk bokmål. Stor forbokstav bare i første ord (aldri STORE BOKSTAVER), ingen emojier. Fysikkbegreper og symboler som i ERGO Fysikk 1: G, N, R (friksjon), L (luftmotstand), S (snordrag), F; v, a, s, t; E<sub>k</sub>, E<sub>p</sub>, W, P, p (bevegelsesmengde), I (impuls).
- **Tall:** alltid `fmt()` (desimalkomma). Enheter med mellomrom: `12,0 N`, `1,50 m/s²`. Bruk `·` for gange og `−` (ekte minus) i tekst.
- **Fysikk:** riktig først. Legg all regning i `model.ts` som rene funksjoner, og test dem (kjente lærebokeksempler, grensetilfeller, bevaringslover). Tilfeldige tall bare der fysikken er statistisk (f.eks. radioaktivt henfall), og da fra en enkel tallgenerator med fast frø, så tester og skjermbilder blir like hver gang.
- **Ytterverdier:** alle kombinasjoner av glidebryterne skal gi fornuftige figurer uten `NaN`, piler som går ut av figuren eller tekst som overlapper (sjekk med `--extremes`).
- **Tydelig:** figuren skal fylle viewBox-en (ikke mye tom plass), piler skal være lange nok til å sees (velg en skala px/N som passer verdiområdet), og etiketter skal ikke overlappe ved standardverdiene.
- **Mobil:** figuren skaleres ned til ca. 330 px bredde, og da blir teksten i SVG-en større (se `useTextScale`). Gi etikettene luft, og sjekk skjermbilde på 390 px.
- **Tema:** ingen faste farger i SVG (bruk `VIZ` og CSS-klassene i `styles/viz.css`), så både lyst og mørkt tema fungerer.
- **Avhengigheter:** ingen nye npm-pakker. Ingen nettverkskall, ingen `localStorage`.
- **Animasjon:** bare med `useSimClock` (starter på pause). Figuren må gi mening også uten å spille av.
- **Typer:** `noUncheckedIndexedAccess` er på – `arr[i]` kan være `undefined`.
- **Egne filer:** endre bare filer i ditt eget `<fag>/kapNN/`. Trenger du en ny felles byggekloss, lag den lokalt i kapittelmappen.

## Utvikling og kontroll

```bash
cd web
npx vite --port 5173                       # http://localhost:5173/viz-preview.html?id=k2-friksjon&theme=dark  (kjemi: &fag=kjemi)
npx vitest run src/viz/fysikk/kap02        # modelltester
npx tsc -p tsconfig.json --noEmit          # typer
node scripts/viz-shot.mjs --port 5173 --chapter 2 --out /tmp/shots   # skjermbilder (lyst/mørkt, 1000/390 px)
node scripts/viz-shot.mjs --port 5173 --chapter 2 --out /tmp/shots --extremes --themes light   # også min/maks
```

Forhåndsvisningen trenger ikke server eller innlogging, og laster bare kapittelet som vises.

## Kjemi

Kjemi 1 (Aschehoug, LK20 KJE01-02). Samme oppbygning og regler som fysikk, med egne byggeklosser i `kjemi/kit/`.
**Mønster å følge:** `kjemi/kap01/Bindingstype.tsx` (velg grunnstoffer, ΔEN-skala, atomer og ioner) og `kjemi/kap03/Stoffmengde.tsx` (mol-brua, formelfelt, begerglass med partikler, logaritmisk skala).

```
viz/kjemi/
  index.ts          samler kapitlene i kapittelrekkefølge (legg til `...kapNN` her)
  kit/              kjemiens byggeklosser – og hele det felles kit-et: importer ALT fra '../kit'
  kapNN/            index.ts, model.ts, model.test.ts, Navn.tsx (som i fysikk)
```

`import { Slider, Figure, Formel, Atom, KJEMI, fmtSig } from '../kit';` – `kjemi/kit/index.ts` eksporterer også `viz/kit`, så du trenger bare én import. Delkapitler: kapittel 1 har 1.1–1.5 (`sections: ['1.4']`); for kapittel 2–8 er de ikke bekreftet ennå, så bruk `sections: []` (vises da under kapittelet).

### Byggeklosser (`kjemi/kit/`)

| Del | Bruk |
|---|---|
| **Data** `grunnstoffer.ts` | `getElement('Na' \| 11)` (eller `undefined`), `element('O')` (kaster), `ELEMENTS`, `elementsInPeriod(p)`, `elementsInGroup(g)`, `mainGroupInPeriod(p)`, `isMetal(e)`, `isNonmetal(e)`, `ionSymbol('Mg', 2)` → «Mg²⁺», `chargeText(-2)` → «2−», `chargeSuperscript`, `ionShells(e, q)`, `capitalize`, `ALL_SYMBOLS`. |
| `Element` | `Z`, `symbol`, `name` (bokmål), `molarMass`, `unstable?`, `group` (1–18, null for U), `period`, `block`, `category`, `phase` (s/l/g ved 25 °C), `electronegativity` (null for He, Ne, Ar), `covalentRadius` (pm), `ionicRadius` ({ ladning: pm }), `ionizationEnergy` (kJ/mol), `subshells`, `configuration` («1s² 2s² 2p⁴»), `configurationShort` («[He] 2s² 2p⁴»), `shells` (etter n), `bohrShells` (Z ≤ 20, ellers null), `valenceElectrons` (hovedgruppene), `ions` (vanligste først). |
| **Formler** `formel.ts` | `parseFormula(s)` → `{ ok, formula }` eller `{ ok: false, error }` (norsk feilmelding), `formula(s)` (kaster), `formulaText(f)` → «Ca(OH)₂», `molarMass(f)`, `molarMassTerms(f)` (M = Σ antall · M, med andeler), `atomCount(f)`. Forstår `H2O`, `Ca(OH)2`, `CuSO4·5H2O` (også `.` og `*`), `[Cu(NH3)4]^2+`, `SO4^2-`, `Fe3+`, `NH4+`, `SO42-`, Unicode (`SO₄²⁻`), tilstand `(aq)`, `(s)`, `(l)`, `(g)` og elektron `e-`. |
| **Likninger** `formel.ts` | `parseReaction('2 H2 + O2 → 2 H2O')` (pil `→`/`->`, likevekt `⇌`/`<=>`; `+` mellom stoffer må ha mellomrom), `reaction(s)`, `reactionText(r)`, `checkBalance(r)` (atomer og ladning per side), `balanceCoefficients(['C3H8', 'O2'], ['CO2', 'H2O'])` → `[1, 5, 3, 4]`, `coefText(0.5)` → «½». Strukturert form: `{ reactants: [{ coef, formula, state? }], products, equilibrium? }`. |
| **Visning** `Formel.tsx` | `<Formel f="Cu^2+" state="aq" coef={2} />` i HTML (Readout-etiketter, Explain, Formula), `<TFormel f="SO4^2-" />` inne i SVG-tekst, `<Reaksjon r="…" states />` og `<TReaksjon r="…" />`. Ugyldige formler vises som rå tekst. |
| **Tall** `format.ts` | `fmtSig(v, sig = 3)` – gjeldende siffer: 0,555 · 18,0 · 3,34 · 10²³. |
| **Tekst** `txt.tsx` | `<Txt x y size={0.85} color={KJEMI.minus} weight anchor muted halo>` – SVG-tekst der `size` er relativ (1 = vanlig etikett) og vokser på mobil; `px` gir fast størrelse. |
| **Kontroller** `controls.tsx` | `<Select label value options onChange>` (tekstene må være ren tekst: bruk `formulaText`), `<FormulaField label value onChange result?>` (viser formelen pent eller feilmeldingen), `<ElementPicker label elements selected badges onPick detail showGroups>` (lite periodesystem), `useContainerTextScale()` → `[ref, f]` (tekstskaleringen figuren vil få, for å velge viewBox-høyde før figuren tegnes). |
| **Molekyler** `molekyl.tsx` | `useAtomScale()` (k = 1 på PC, ca. 1,5 på mobil), `<Atom x y el charge? partial="plus"\|"minus" partialAngle label r ring dim>`, `<Bond a b order={1\|2\|3} stereo="wedge"\|"hash" dashed>` (stopper ved kanten av kulene), `<LonePair at angle>`, `<DipoleArrow from to>` (fra δ+ til δ−), `<AngleArc x y from to r label>`, `<VseprMolecule x y geometry center ligands orders showAngle partials>`, `<ElectronShells x y el shells? charge layout="even"\|"pairs" gained emptyShell>` (Bohr-modell, valensskallet fremhevet), `shellRadius`, `<WaterMolecule x y angle size>`. |
| **Geometri** `geometri.ts` | `polar(x, y, L, grader)`, `angleOf`, `atomRadius(el, { charge, scale })`, `trimSegment`, `vsepr(geometri, { x, y, bond, rotate, angle })`, `vseprGeometry(bindinger, frie par)`, `GEOMETRIES` (navn, vinkel 180°, 120°, 109,5°, 107°, 104,5°). Vinkler i grader mot klokka med y opp. |
| **Lab** `beger.tsx` | `<Begerglass x y w h level liquid marks label>{(box) => …}</Begerglass>`, `<Erlenmeyerkolbe …>` (samme props; `level` er andel av den koniske delen), `<Byrette x y h reading capacity={50} showReading dripping>`, `byretteTipLength(k)`, `<Partikler box groups={[{ n, r, fill, label, render? }]} seed t?>` (spredt uten overlapp, fast frø; med `t` fra `useSimClock` beveger de seg litt). |
| **Tilfeldig** `random.ts` | `seededRandom(frø)`, `placeParticles(box, grupper, frø)`, `jiggle(p, t, amplitude)`. Aldri `Math.random`. |
| **Farger** `colors.ts` | `KJEMI.*`, `atomColors('O')` → `{ fill, line, ink }`, `mixColor(a, b, t)` (CSS `color-mix`), `phColor(pH)` (universalindikator), `btbColor(pH)`, `phenolphthaleinColor(pH)`. |

### Farger (`KJEMI`, `--kj-*` i `styles/viz.css`)

| Farge | Bruk |
|---|---|
| `atomColors(symbol)` | CPK-inspirert: H hvit, C grå, N blå, O rød, F lysegrønn, Cl grønn, Br rødbrun, I fiolett, S gul, P oransje, alkalimetaller fiolett, jordalkalimetaller blågrønn, andre metaller stålgrå, halvmetaller beige, edelgasser cyan, resten rosa. Bruk alltid `ink` til tekst inne i kula (H har mørk tekst også i mørkt tema). |
| `KJEMI.plus` / `KJEMI.minus` | positiv / negativ ladning: δ+ og δ−, kationer og anioner, H₃O⁺ og OH⁻ |
| `KJEMI.electron`, `KJEMI.valence`, `KJEMI.shell`, `KJEMI.cloud` | elektroner, valenselektroner, skallringer, elektronsky |
| `KJEMI.bond`, `KJEMI.hbond` | kovalente bindinger, hydrogenbindinger og andre svake bindinger (stiplet) |
| `KJEMI.bondType.upolar/polar/ionisk/metallisk` | bindingstyper |
| `KJEMI.molecule` | nøytrale molekyler i partikkelbilder |
| `KJEMI.glass`, `glassFill`, `glassShine`, `liquid`, `liquidLine` | glassutstyr og vann/fargeløs løsning |
| `KJEMI.indicator.*`, `KJEMI.ph[0..6]` | bromtymolblått (gult/grønt/blått), fenolftalein (fargeløs/rosa), universalindikator ved pH 1, 3 … 13 |
| `KJEMI.exo` / `KJEMI.endo` | eksoterm (ΔH < 0) / endoterm (ΔH > 0) |
| `KJEMI.oxidation` / `KJEMI.reduction` | oksidasjon / reduksjon |

### Data og kilder

- **Molar masse:** IUPAC, forkortet til 4–5 gjeldende siffer som i lærebøkene (H 1,008, C 12,01, O 16,00, Na 22,99, Cl 35,45). Med disse verdiene blir M(Ca(OH)₂) = 74,10 g/mol (bøker som bruker O = 15,999 skriver 74,09).
- **Elektronegativitet:** Pauling (reviderte verdier, som i CRC). **Atomradius:** kovalent radius (Cordero mfl. 2008) – ett datasett; edelgassenes verdier er ikke sammenlignbare med resten av perioden. **Ioneradius:** Shannon (1976). **Ioniseringsenergi:** NIST, omregnet til kJ/mol.
- **Elektronkonfigurasjon:** sortert etter skall som hos NIST (Fe = [Ar] 3d⁶ 4s²), med de kjente unntakene (Cr, Cu, Mo, Ag, Au …). `bohrShells` er lærebokas skallmodell (2, 8, 8, 2) for Z ≤ 20.

### Kjemikonvensjoner

- Begreper og symboler som i Kjemi 1: stoffmengde n (mol), molar masse M (g/mol), masse m (g), konsentrasjon c (mol/L), volum V (L), antall partikler N, Avogadros tall N<sub>A</sub> = 6,022 · 10²³ /mol, reaksjonsentalpi ΔH i kJ (negativ = eksoterm), K<sub>w</sub> = 1,0 · 10⁻¹⁴ ved 25 °C, pH = −lg[H₃O⁺], elektronegativitet EN og ΔEN.
- Tilstandssymboler (aq), (s), (l), (g); reaksjonspil → og likevektspil ⇌; ladning hevet etter formelen (SO₄²⁻, Fe³⁺); ekte minustegn (−).
- Stoffnavn etter IUPAC på norsk: natriumklorid, karbondioksid, svoveldioksid, hydrogenklorid, kalsiumkarbonat, ammoniakk, glukose.
- Tall med riktig antall gjeldende siffer (`fmtSig`), molare masser med to desimaler (18,02 g/mol).
- Partikler: molekyler (molekylære stoffer), formelenheter (ioniske stoffer), atomer, ioner.

### Fallgruver

- **Mobil:** atomer, bindinger og elektroner vokser med `k = useAtomScale()` (ca. 1,5 på telefon). Gang dine egne avstander med `k` (bindingslengder, plass mellom molekyler), ellers overlapper de på mobil. Trenger du viewBox-høyden før figuren tegnes, bruk `useContainerTextScale()` og regn `k = max(1, 0,85 · f)`.
- **«NaN» i teksten:** `viz-shot.mjs` feiler hvis teksten i visualiseringen inneholder «NaN». `Formel`, `TFormel` og `formulaText` setter inn et usynlig tegn mellom Na og N (NaNO₃), men skriver du symbolene selv (f.eks. «Na» rett etterfulgt av «N» i to `<Txt>`), kan sjekken slå til.
- **Navnekollisjoner:** det felles kit-et har allerede `Formula` (formelboksen) og `Block` (kloss). Kjemiens typer heter derfor `ParsedFormula` og `ElementBlock`.
- **Flertydige ioner:** `Fe3+` tolkes som Fe³⁺, `NH4+` som NH₄⁺ og `SO42-` som SO₄²⁻. Skriv `^` (`SO4^2-`) i faste formler i koden, så er det entydig.
- **Farger:** bruk `KJEMI`/`atomColors`, aldri hex-koder. Overganger (indikator som skifter farge) lages med `mixColor`, som gir CSS `color-mix` og virker i begge temaer.
- **Partikler:** plasseringen regnes ut på nytt bare når boksen, gruppene eller frøet endres. Tettheten av prikker bør bety noe (i kap03 er utsnittet like stort for alle volum, så tettheten viser konsentrasjonen).

### Forhåndsvisning og skjermbilder

```bash
cd web
npx vite --port 5173                                     # http://localhost:5173/viz-preview.html?fag=kjemi&id=k1-bindingstype&theme=dark
npx vitest run src/viz/kjemi                             # data, formler, geometri og modeller
node scripts/viz-shot.mjs --port 5173 --fag kjemi --chapter 3 --out /tmp/shots
node scripts/viz-shot.mjs --port 5173 --fag kjemi --chapter 3 --out /tmp/shots --extremes --themes light
```

`?fag=kjemi` gir også kjemitemaet «Tavle» (`data-subject="chemistry"`, mørkegrønn flate i mørkt tema), så sjekk at fargene dine synes der.

## Biologi

Biologi 1 (Bi 1, Gyldendal, 3. utgave 2021, LK20 BIO01-02). Samme oppbygning og regler som fysikk og kjemi, med egne byggeklosser i `biologi/kit/`.
**Mønster å følge:** `biologi/kap06/DiffusjonOgOsmose.tsx` (tre forsøk i én visualisering med `Segmented`, partikler som krysser en membran, graf over tid, celler i løsning) og `biologi/kap15/Flokkimmunitet.tsx` (SIR-modell, forhåndsvalg, rutenett med individer, avspilling i døgn).

```
viz/biologi/
  index.ts          samler kapitlene i kapittelrekkefølge (legg til `...kapNN` her)
  kit/              biologiens byggeklosser – og hele det felles kit-et: importer ALT fra '../kit'
  kapNN/            index.ts, model.ts, model.test.ts, Navn.tsx (som i fysikk)
```

`import { Slider, Figure, Celle, Mitokondrie, BIO, solveSir, fmtPct } from '../kit';` – `biologi/kit/index.ts` eksporterer også `viz/kit` og de generelle hjelperne fra kjemi-kit-et: `seededRandom`, `placeParticles`, `jiggle`, `Box`, `Txt`, `Select`, `useContainerTextScale`, `Partikler`, `Begerglass`, `mixColor`, `fmtSig`. Bruk dem, ikke kopier dem.

**Delkapitler:** innholdsfortegnelsen i Bi 1 er ikke bekreftet, så alle biologivisualiseringer har `sections: []` (de vises under kapittelet). Kapitlene (`server/src/textbooks.ts`): 1 Liv, 2 Systematikk, 3 Biologisk mangfold, 4 Forvaltning av naturressurser, 5 Cellestrukturer og cellefunksjon, 6 Transport og kommunikasjon i celler, 7 Celledeling, 8 Kommunikasjonssystemer i mennesket, 9 Transportsystemer i mennesket, 10 Transportsystemer i dyr, 11 Transportsystemer i planter, 12 Kommunikasjon og bevegelse i planter, 13 Formering, 14 Mikrobielle og virale sykdommer, 15 Bekjempelse av mikrobielle og virale sykdommer. Skriv kompetansemålene (KM1–KM11) som søkeord, f.eks. `keywords: [..., 'KM5']`.

### Byggeklosser (`biologi/kit/`)

| Del | Bruk |
|---|---|
| **Celler** `celle.tsx` | `<Celle type="dyr"\|"plante"\|"bakterie" x y w h highlight? dim?>{organeller}</Celle>` tegner cytoplasma og cellemembran (dobbel strek); plantecellen får cellevegg og stor vakuole (`vakuole={0.6}` = andel, `protoplast={0.7}` = plasmolyse, `ytre` = fyllet mellom vegg og membran), bakteriecellen kapsel, cellevegg, flageller (`flageller={2}`), nukleoid, plasmider og ribosomer. Barna klippes til innsiden av membranen. `cellInterior(type, box, protoplast)` gir plassen innenfor membranen. |
| **Organeller** | `<Cellekjerne x y r ry kjernelegeme kromatin>` (dobbel membran med porer), `<Mitokondrie x y w h rotate>` (cristae), `<Kloroplast x y w h grana>`, `<EndoplasmatiskNettverk x y w h kornet sekker bue>` (`bue` = krumningsradius, så kornet ER ligger rundt kjernen), `<Golgiapparat x y w h sekker>`, `<Ribosomer x y w h n seed>`, `<Lysosom x y r>`, `<Vakuole x y w h>`, `<Vesikkel x y r paint>`, `<Cytoskjelett x y w h n>`. Alle er sentrert i (x, y), har `rotate` (grader med klokka), `highlight` (glorie i kantfargen) og `dim` (nedtonet). Standardstørrelsene passer i en celle på ca. 400 × 300. |
| **Cellemodell** | `<Cellemodell type x y w h highlight="mitokondrie" dimOthers>` = ferdig celle med organellene på faste plasser. `organelleLayout(type, box)` gir de samme plassene (`{ id, x, y, w, h, rotate }`), så du kan sette `<Etikett>` uten å tegne cella først. `ORGANELLER[id]` = `{ navn, kort, funksjon }` (lærebokformuleringer; `kort` = «Kornet ER» til trange etiketter), `CELL_PARTS[type]` = delene i hver celletype. |
| **Membran** `membran.tsx` | `<Membran x y length thickness={44} vertical skip>` = lipiddobbeltlag (hoder og haler). Proteiner sentrert i membranen: `<Kanalprotein open>`, `<Akvaporin>`, `<Baereprotein state={0..1}>` (0 = åpen mot side A, 1 = mot side B), `<NaKPumpe state fosfat>`, `<Reseptor bound>`. Gi lipidene plass med `skip={[proteinSlot(y, 'kanal')]}`. Vannrett: side A (utsiden) over, B (cytoplasma) under; `vertical`: A til venstre, B til høyre. |
| **Partikler gjennom membranen** `transport.ts` | `planCrossings({ n: [nA, nB], rates: [A→B, B→A], tMax, seed, gates, transit })` planlegger alle kryssingene på forhånd (like rater = diffusjon, én rate 0 = aktiv transport, `gates` = antall kanaler/pumper). `<MembranPartikler tracks t geometry fill>` tegner dem ved tiden t; `geometry: CrossingGeometry` = `{ a, b, orientation, at, thickness, gates?: posisjoner, r, speed?, jitter? }`. `countSides(tracks, t)`, `crossingCounts(tracks, t)` → `[A→B, B→A]`, `expectedSideA(spec, t)` (gjennomsnittet), `trackPosition(track, t, geometry)`. Samme t gir alltid samme bilde, også baklengs. |
| **Kromosomer** `kromosom.tsx` | `<Kromosom x y lengde par opphav="mor"\|"far" kromatider={1\|2} sentromer rot segmenter>` (to søsterkromatider i X-form), `<Kromatide … armU armL kondensert>`. `<Delingsfigur deling="mitose"\|"meiose1"\|"meiose2" fase n={2\|3} box overkrysning orientering replikert>` tegner hele cella i en fase (cellemembran, kjerne som løses opp, spole, ekvatorplan, kromosomer) – bytt `fase`, så glir kromatidene til nye plasser. |
| **Kromosomlogikk** `kromosomer.ts` | `layoutPhase(opts)` → `{ celler, innsnoring, kjerner, spoler, ekvatorplan, kromatider, sentromerer, kromosomtall }` (rent, testet), `chromosomeSet(n)`, `FASER`, `faseNavn('metafase', 'meiose1')` → «metafase I», `cellOutlinePath(a, b?)` (celle eller to celler med innsnøring), `smoothClosedPath(punkter)`, `insideEllipse`. Overkrysning: mor b og far a bytter enden av den lange armen; `orientering[par] = true` sender mors kromosom til venstre i metafase I (uavhengig fordeling). |
| **Organismer** `organismer.tsx` | `<Bakterie form="stav"\|"kokk"\|"spiril" flagell>`, `<Virus type="kappekledd"\|"bakteriofag">`, `<Sopp>`, `<Plante>`, `<Tre bartre>`, `<Fisk>`, `<Fugl>`, `<Pattedyr>`, `<Insekt>`, `<Menneske>`, `<RodtBlodlegeme swelling crenation burst>`, `<HvittBlodlegeme type="granulocytt"\|"lymfocytt"\|"makrofag">`, `<Antistoff>`, og `<Organisme type="fisk">` etter navn (`ORGANISME_NAVN`). Felles props: `x y size rotate paint highlight dim title`. `size` ≈ bredden/høyden (standard 40). |
| **Modeller** `modeller.ts` | RK4 med fast steg: `solveOde(f, y0, { tMax, dt, nonNegative })` → `{ t, y }`, `valueAt(sol, t)`, `column(sol, j)`, `points(sol, j, skala)` (til `linePath`), `rk4Step`. Vekst: `exponential(N0, r, t)`, `doublingTime(r)`, `logistic(N0, r, K, t)`, `logisticRate(N, r, K)`, `exponentialDerivs`, `logisticDerivs`. Høsting: `solveHarvest(N0, r, K, { kind: 'kvote', H } \| { kind: 'andel', h })`, `msy(r, K)` → `{ N: K/2, yield: rK/4, rate: r/2 }`, `quotaEquilibria`, `proportionalEquilibrium`, `harvestRate`. Rovdyr–byttedyr: `solveLotkaVolterra({ a, b, c, d }, bytte0, rov0, opts)` (kolonne 0 = byttedyr, 1 = rovdyr), `lotkaVolterraEquilibrium`, `lotkaVolterraInvariant`. Smitte: `solveSir({ R0, D, I0, p, e }, opts)` → `{ t, S, I, R, V, sol }`, `sirStats` → `{ peak, peakTime, totalInfected }`, `herdImmunityThreshold(R0)`, `requiredCoverage(R0, e)`, `effectiveR(R0, S)`, `finalSize(R0, s0)`, `sirStart`. Bakterier: `bacterialGrowth(p, t)`, `growthPhase(p, t)`, `growthPhaseEnds(p)`, `GROWTH_PHASE_NAMES`, `countAfter(N0, t, g)`, `generations`, `generationTime`, `timeToReach`, `rateFromGenerationTime`. |
| **Kontroller** `controls.tsx` | `<Forvalg label options={[{ value, label, detail }]} value={match \| null} onPick>` (forhåndsvalg der ingen trenger å være valgt, f.eks. sykdommer som setter en glidebryter), `<PlayBar clock time="dag 34">` (som `PlayControls`, men med egen tidstekst: døgn, timer, år). |
| **Hjelpere** `felles.tsx`, `format.ts` | `useBioScale()` (1 på PC, ca. 1,5 på mobil, til symboler og partikler), `useLineScale()` (strektykkelser), `useSvgId(prefiks)` (id til clipPath), `<Etikett x y lx ly strong>` (etikett med strek til det den peker på), `<Halo d color>`, `DIM_OPACITY`, `fmtPct(0.456)` → «46 %» (`< 1 %` for små andeler), `fmtCount(2097152)` → «2 097 152». |
| **Farger** `colors.ts` | `BIO.*` (se under), `kromosomFarge(par, 'mor'\|'far')`, typen `BioPaint = { fill, line }`. |

### Farger (`BIO`, `--bio-*` i `styles/viz.css`)

Celledeler og organismer har `{ fill, line }`: lys fyll og mettet kant i lyst tema, mørk fyll og lys kant i mørkt tema (som atomene i kjemi). Tekst oppå fylte former skrives med `VIZ.ink`.

| Farge | Bruk |
|---|---|
| `BIO.cytoplasma`, `BIO.membran`, `BIO.lipidHode`, `BIO.lipidHale` | cytoplasma (krem), cellemembran og fosfolipider (brunoransje) |
| `BIO.kjerne`, `BIO.kjernelegeme`, `BIO.dna` | cellekjerne, kjernelegeme og DNA/kromatin (fiolett) |
| `BIO.mitokondrie`, `BIO.kloroplast`, `BIO.klorofyll` | mitokondrier (laks), kloroplaster og klorofyll/grana (grønn) |
| `BIO.cellevegg`, `BIO.vakuole`, `BIO.er`, `BIO.golgi`, `BIO.lysosom`, `BIO.ribosom`, `BIO.cytoskjelett`, `BIO.kapsel` | cellevegg (oliven), vakuole (lyseblå), ER (rosa), golgi og vesikler (gul), lysosom (blågrønn), ribosomer (mørke prikker), cytoskjelett (grå), bakteriekapsel (gjennomsiktig) |
| `BIO.protein`, `BIO.atp`, `BIO.signal` | membranproteiner (rolig grå, så partiklene synes), ATP/aktiv transport (oransje), signalstoff/hormon (magenta) |
| `BIO.opplost`, `BIO.natrium`, `BIO.kalium`, `BIO.vann`, `BIO.vannFyll`, `BIO.sukker` | oppløst stoff (fiolett), Na⁺ og K⁺, vann/xylem (blå) og fyll for vann og løsninger, sukker/floem (rav) |
| `BIO.oksygenrikt`, `BIO.oksygenfattig` | oksygenrikt blod (rødt) og oksygenfattig blod (blått, som i lærebøkene) |
| `BIO.rodtBlodlegeme`, `BIO.immuncelle`, `BIO.antistoff`, `BIO.antigen` | røde blodlegemer, hvite blodlegemer/immunceller (blå), antistoffer (gull), antigener (rød) |
| `BIO.bakterie`, `BIO.virus`, `BIO.sopp`, `BIO.plante`, `BIO.ved`, `BIO.pattedyr`, `BIO.fisk`, `BIO.fugl`, `BIO.insekt`, `BIO.menneske`, `BIO.dod` | organismer og smittestoffer; `dod` = døde celler/individer (grå) |
| `BIO.kromosom.mor[0..2]`, `BIO.kromosom.far[0..2]` | homologe par: fra mor varme farger (rød, oransje, magenta), fra far kalde (blå, blågrønn, fiolett) |
| `BIO.sir.S`, `.I`, `.R`, `.V` | mottakelige (stålblå), smittet (rød), immune etter sykdom (grønn), vaksinert og immun (fiolett) |
| `BIO.byttedyr`, `BIO.rovdyr`, `BIO.baereevne`, `BIO.hosting`, `BIO.serie[0..3]` | populasjonskurver: byttedyr (grønn), rovdyr (rust), bæreevnen K (grå, stiplet), høsting (fiolett), andre serier |

Blanding (f.eks. saltløsning som blir sterkere): `mixColor(BIO.vannFyll, BIO.opplost, t)`.

### Biologikonvensjoner

- Begreper som i norske Biologi 1-bøker: celleånding, fotosyntese, cellemembran, cellevegg, cytoplasma, cellekjerne, kjernelegeme, mitokondrie, kloroplast, kornet og glatt endoplasmatisk nettverk (kornet ER, glatt ER), golgiapparat, ribosom, lysosom, vakuole, diffusjon, fasilitert diffusjon, osmose, aktiv transport, kanalprotein, bæreprotein, natrium-kalium-pumpe, akvaporin, reseptor, signalstoff, hypoton/isoton/hyperton, hemolyse, plasmolyse, turgor, mitose, meiose, interfase, profase, metafase, anafase, telofase, cytokinese, homologe kromosomer, søsterkromatider, sentromer, overkrysning, haploid/diploid (n, 2n), homeostase, negativ tilbakekobling, smittsomhet, basisreproduksjonstall R<sub>0</sub>, flokkimmunitet, vaksinasjonsdekning, antibiotikaresistens, bæreevne, bestand.
- Vitenskapelige navn i kursiv i HTML: `<em>Escherichia coli</em>`, `<em>Homo sapiens</em>`. I SVG: `<tspan fontStyle="italic">`.
- Enheter: konsentrasjon i mmol/L eller mol/L, saltløsning i % NaCl (fysiologisk saltvann 0,9 %), tid i s, døgn, timer eller år (bruk `PlayBar` med egen tidstekst), andeler med `fmtPct`.
- Modeller: alltid deterministiske (RK4 med fast steg, tilfeldige tall med frø). Skriv i forklaringen hva som er forenklet (f.eks. «alle møter alle like ofte»).
- Misoppfatninger er et mål i seg selv: partikler «vil» ikke noe (diffusjon er tilfeldig bevegelse med netto transport ned gradienten), det er vannet som flytter seg ved osmose, smitten stopper fordi mange er immune, ikke fordi smittestoffet forsvinner.

### Fallgruver

- **Mobil:** figuren skaleres ned til ca. 330 px, og teksten blir ca. 1,8 ganger større (`useTextScale()`/`useContainerTextScale()` → `f`). Symboler, partikler og organeller blir **ikke** større av seg selv: gang radier og størrelser med `useBioScale()` (eller `k = max(1, 0,85 · f)`) når de skal kunne sees. Gjør grafer og scener høyere på mobil (`H = 320 + 260 · (f − 1)` for en `Plot`), ellers blir de flate og aksetitlene klippes.
- **To figurer ved siden av hverandre** (f.eks. blodlegeme og plantecelle) blir for små på mobil: legg dem under hverandre når `f > 1,3` og tegn dem større (se `CellScene` i kap06).
- **Lange etiketter:** «Kornet endoplasmatisk nettverk» får ikke plass på mobil. Bruk `ORGANELLER[id].kort` eller sett etikettene i en egen kolonne.
- **Etiketter i `Legend` med `<Sub>`:** pakk teksten i `<span>…</span>`, ellers blir senket skrift et eget flex-element med mellomrom («p c»).
- **Partikler som flytter seg:** bruk `planCrossings` (plan på forhånd) eller `placeParticles` i en enhetsboks og skaler posisjonene til boksen (som sukkeret i osmoseforsøket). `Partikler` fra kjemi plasserer på nytt når boksen endres, og hopper da hvis boksen endres for hver ramme.
- **Animasjon av kromosomer:** `Kromatide` flyttes med CSS-transform (klassen `bio-anim`). Gi hver kromatide en fast `key` (`layoutPhase` gjør det), ellers glir de ikke.
- **Kromosomer på mobil:** kromosomlengden i `Delingsfigur` følger høyden på `box` (metafasen i mitose må få plass langs ekvatorplanet). Gjør boksen og viewBox-en høyere på mobil, f.eks. `h = 340 + 220 · (f − 1)`, ellers blir kromosomene små. Meiose II tegner to celler (og fire i telofasen) i samme boks.
- **«NaN» i teksten:** `viz-shot.mjs` feiler på «NaN», «Infinity» og «undefined». `rbcVolume(0)` er uendelig – vis «Sprukket» i stedet for tallet.
- **Navnekollisjoner:** det felles kit-et har allerede `Block`, `Label`, `Formula`; kjemi har `Atom`, `Formel`. Biologinavnene er norske (`Celle`, `Membran`, `Kromosom`) og modellfunksjonene engelske (`solveSir`, `logistic`).

### Forhåndsvisning og skjermbilder

```bash
cd web
npx vite --port 5173                                     # http://localhost:5173/viz-preview.html?fag=biologi&id=k6-diffusjon-og-osmose&theme=dark
npx vitest run src/viz/biologi                           # kit-modeller, kromosomlogikk, membrantransport og kapittelmodeller
node scripts/viz-shot.mjs --port 5173 --fag biologi --chapter 6 --out /tmp/shots
node scripts/viz-shot.mjs --port 5173 --fag biologi --chapter 6 --out /tmp/shots --extremes --themes light
```

`?fag=biologi` gir også biologitemaet «Salvie» (`data-subject="biology"`, varmt papir og dempet grønn, mørk grønngrå flate i mørkt tema). `viz-shot` flytter bare glidebrytere: klikk også gjennom `Segmented`-valg, forhåndsvalg og avspilling med et eget Playwright-skript før du er ferdig.
