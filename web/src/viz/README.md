# Visualiseringer

Interaktive forklaringer til hvert kapittel i ERGO Fysikk 1. De vises på `/fag/:fag/visualiseringer` (oversikt) og `/fag/:fag/visualiseringer/k2-friksjon` (én visualisering), og lenkes fra kapittelsiden og notatsiden (etter delkapittel).

**Mønster å følge:** `kap02/` (friksjon, kraftpar og koblede klosser). Les dem før du lager nye.

## Struktur

```
viz/
  kit/            felles byggeklosser – importer alt fra '../kit'
  kapNN/
    index.ts      liste med VizMeta for kapittelet (rekkefølgen = rekkefølgen på siden)
    model.ts      ren fysikk uten React (testes)
    model.test.ts vitest-tester av modellen
    Navn.tsx      én komponent per visualisering, `export default`
  registry.ts     samler alle kapitlene (endres ikke når du legger til visualiseringer)
  preview.tsx     forhåndsvisning uten resten av appen (kun utvikling)
```

`index.ts`:

```ts
{
  id: 'friksjon',               // små bokstaver og bindestrek; URL-nøkkel blir k2-friksjon
  chapter: '2',
  sections: ['2C'],             // delkapitlene i ERGO (se server/src/textbooks.ts)
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
- **Fysikk:** riktig først. Legg all regning i `model.ts` som rene funksjoner, og test dem (kjente lærebokeksempler, grensetilfeller, bevaringslover). Ingen tilfeldige tall.
- **Tydelig:** figuren skal fylle viewBox-en (ikke mye tom plass), piler skal være lange nok til å sees (velg en skala px/N som passer verdiområdet), og etiketter skal ikke overlappe ved standardverdiene.
- **Mobil:** figuren skaleres ned til ca. 330 px bredde, og da blir teksten i SVG-en større (se `useTextScale`). Gi etikettene luft, og sjekk skjermbilde på 390 px.
- **Tema:** ingen faste farger i SVG (bruk `VIZ` og CSS-klassene i `styles/viz.css`), så både lyst og mørkt tema fungerer.
- **Avhengigheter:** ingen nye npm-pakker. Ingen nettverkskall, ingen `localStorage`.
- **Animasjon:** bare med `useSimClock` (starter på pause). Figuren må gi mening også uten å spille av.
- **Typer:** `noUncheckedIndexedAccess` er på – `arr[i]` kan være `undefined`.
- **Egne filer:** endre bare filer i ditt eget `kapNN/`. Trenger du en ny felles byggekloss, lag den lokalt i kapittelmappen.

## Utvikling og kontroll

```bash
cd web
npx vite --port 5173                       # http://localhost:5173/viz-preview.html?id=k2-friksjon&theme=dark
npx vitest run src/viz/kap02               # modelltester
npx tsc -p tsconfig.json --noEmit          # typer
node scripts/viz-shot.mjs --port 5173 --chapter 2 --out /tmp/shots   # skjermbilder (lyst/mørkt, 1000/390 px)
```

Forhåndsvisningen trenger ikke server eller innlogging, og laster bare kapittelet som vises.
