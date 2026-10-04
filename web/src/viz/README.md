# Visualiseringer

Interaktive forklaringer til hvert kapittel i lærebøkene (ERGO Fysikk 1, Kjemi 1 og Bi 1). De vises på `/fag/:fag/visualiseringer` (oversikt) og `/fag/:fag/visualiseringer/k2-friksjon` (én visualisering), og lenkes fra kapittelsiden og notatsiden (etter delkapittel).

**Mønster å følge:** `fysikk/kap02/` (friksjon, kraftpar og koblede klosser), og for kjemi `kjemi/kap01/` og `kjemi/kap03/`. Les dem før du lager nye.

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
