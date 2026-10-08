# Arbeidsplan: bedre visualiseringer (oktober 2026)

> Arbeidsfil for arbeidet med visualiseringene, som startet 5. oktober 2026. Den viser hva eleven har bestemt, og
> hvor langt arbeidet har kommet, så det kan fortsette i en ny økt. Slettes eller flyttes inn i `docs/STATUS.md` når
> alt er ferdig. **Det eleven skriver i chatten, går foran denne fila.**
>
> **Slik fortsetter du:** les [docs/workflows/README.md](workflows/README.md). Der står skriptene som ble brukt, argumentene for hvert kapittel, hvordan arbeidet gjenopptas etter bruksgrensen, og erfaringene fra første økt.

## Elevens bestilling

- Satse mest på det som ikke koster penger å bruke: visualiseringene.
- Flere visualiseringer med **praktiske situasjoner** og **eksempeloppgaver i eksamensstil**.
- **Realistisk utseende** som samtidig er så lett å forstå som mulig.
- Fysikk først og mest, deretter kjemi og biologi. Bruk workflows.

## Valg eleven har tatt (5. oktober)

1. **Omfang:** fysikk tungt.
   - **Fysikk:** alle 36 eksisterende får nytt, illustrert utseende. I tillegg kommer ca. 25–30 nye med praktiske situasjoner og to eksempeloppgaver per kapittel.
   - **Kjemi og biologi:** ca. én ny per kapittel og visuell finpuss av de eksisterende.
2. **Eksempeloppgaver:** gjennomgått eksempel. Oppgaven og løsningen vises trinn for trinn med figur, og det er ingen svarfelt.
   - Oppgavene skal ligne eksamensoppgaver, men være **egne**: egen tekst, egne tall og egne situasjoner.
   - **Aldri kopier eller gjenfortell ekte eksamens- eller læreboksoppgaver.** Det handler om opphavsrett, siden appen kan bli brukt av andre og kanskje koste penger.
3. **Utseende:** illustrert realisme, som gode lærebokillustrasjoner.
   - Ekte gjenstander med lys, skygge og materialer.
   - Kraft- og fartspiler oppå, som kan slås av og på.
   - Ingen nye npm-pakker og ingen 3D. Lyst og mørkt tema, mobil.
4. **Ingen pilot:** kjør alt med en gang. Én PR per fag, med fysikk først. Flett selv når CI er grønn.
5. **Fortsett automatisk (gjaldt økten 5.–6. oktober):**
   - Etter fysikk går arbeidet rett videre med kjemi og biologi.
   - Stopper bruksgrensen arbeidet, skal det fortsette av seg selv når grensen er nullstilt. Det sørget en gjentakende påminnelse i økten for.
6. **Pause (6. oktober):** eleven ba om at arbeidet stopper når de pågående workflowene er ferdige, og at ikke noe nytt startes før eleven sier fra. Påminnelsen er slått av. Dette går foran punkt 5.
7. **Neste økt (8. oktober):** eleven vil at neste økt fortsetter med visualiseringene på samme måte som i økten 5.–6. oktober. Rekkefølgen er resten av fysikk først (kapittel 5–10, fysikk prioriteres), deretter kjemi og biologi.

## Fremdrift

Merk av her når en del er ferdig, og commit + push. Grenen er `claude/blissful-lamport-eh0x58`.

- [x] 0. Plan, påminnelse og TeX Live
- [x] 1. Grunnmur
  - [x] `viz/kit/scene/`: materialer, skygger, bakgrunner, underlag og gjenstander, lyst og mørkt tema (seks familier, bygget, kontrollert og rettet)
  - [x] Eksempeloppgaver: `viz/kit/eksempel.tsx`, `kind: 'eksempel'` i `VizMeta`, egen gruppe på sidene
  - [x] Referanse: eksempeloppgaven `k2-eks-skraplan` (kapittelagentene oppgraderer og lager nye etter stilguiden)
  - [x] README i `viz/` med stilguide for illustrert realisme og eksempeloppgaver
- [ ] 2. Fysikk (kapittel 1–10): oppgradere, lage nye, lage eksempler, kontrollere og rette. Én workflow per kapittel, og hvert kapittel committes for seg («Fysikk kapittel N: …»).
  - Ferdige og flettet i PR #7: kapittel 1 (4 oppgraderte, 3 nye, 2 eksempeloppgaver), 2 (6, 3, 2), 3 (3, 3, 2) og 4 (3, 3, 2).
  - Gjenstår: kapittel 5–10. Bruk `docs/workflows/fysikk-kapittel.js` med kapittelet fra `docs/workflows/fysikk-katalog.json`. Katalogen under er samme innhold i kortform.
- [ ] 2b. Finpuss av kjemi- og biologi-kit-et. Et forsøk ble avbrutt av bruksgrensen før kontroll og tatt ut igjen før PR #7. Kjør `docs/workflows/kit-finpuss.js` på nytt før punkt 4, kontroller resultatet og commit.
- [ ] 3. PR for fysikk, CI grønn, flettet. PR #7 tok grunnmuren og kapittel 1–4. Kapittel 5–10 får en egen PR.
- [ ] 4. Kjemi (kapittel 1–8): `docs/workflows/kjemi-biologi-kapittel.js` med kapitlene fra `docs/workflows/kjemi-biologi-katalog.json`
- [ ] 5. Biologi (kapittel 1–15): samme skript og katalog
- [ ] 6. PR for kjemi og biologi, CI grønn, flettet
- [ ] 7. `docs/STATUS.md` og `CLAUDE.md` oppdatert, denne fila fjernet

## Katalog for fysikk (forslag; kapittelagenten kan justere)

Nøkkel = `k{kapittel}-{id}`. Eksempeloppgaver har id som starter med `eks-`.

| Kap. | Nye praktiske | Eksempeloppgaver |
|---|---|---|
| 1 | `fartskontroll` streknings-ATK (snittfart og momentanfart), `forbikjoring` forbikjøring på landeveien, `gult-lys` gult lys: stoppe eller kjøre? | `eks-vt-graf` bil i bytrafikk, les av v-t-grafen; `eks-kast-balkong` ball kastet opp fra en balkong |
| 2 | `strikkhopp` strikkhopp (kraft som ikke er konstant), `fore-og-bremsing` friksjon og føre (tørr asfalt, regn, snø, is, ABS), `tautrekking` tautrekking og Newtons 3. lov | `eks-skraplan` kasse som sklir ned en rampe; `eks-trinse` vogn og lodd over en trinse |
| 3 | `berg-og-dal` berg-og-dal-bane, `vannkraft` vannkraftverk, `sykkel-bakke` sykkel opp bakken (effekt) | `eks-akebakke` akebrett med friksjon; `eks-kran` byggekran (arbeid, effekt, virkningsgrad) |
| 4 | `krasjtest` knusesone, bilbelte og kollisjonspute, `curling` støt mellom curlingsteiner, `ballspark` kraft-tid-graf og impuls | `eks-ballistisk-pendel`; `eks-vognstot` vogner som henger sammen etter støtet |
| 5 | `dekktrykk` dekktrykk om vinteren, `vannkoker` effekt, tid og varmetap, `varmepumpe` varmepumpe (varmefaktor) | `eks-kalorimeter` metallbit i vann; `eks-gass` gass i en sylinder (pV = nRT, kelvin) |
| 6 | `ekko` lyd, ekko og avstand til lynet, `solcellepanel` innstråling og vinkel, `em-spekteret` spekteret i hverdagen | `eks-sola` sola som svart legeme; `eks-bolge` bølger (λ, f, v) |
| 7 | `nordlys` farger fra eksiterte atomer, `rutherford` spredningsforsøket, `stjernespekter` finn grunnstoffene i en stjerne | `eks-hydrogen` overgang i hydrogen; `eks-foton` fotoner fra en laserpeker |
| 8 | `c14` karbondatering, `kjedereaksjon` fisjon og kjedereaksjon, `skjerming` α, β og γ gjennom papir, aluminium og bly | `eks-massedefekt` energi fra massedefekt; `eks-aktivitet` aktivitet og halveringstid |
| 9 | `parallakse` avstand til nære stjerner, `grunnstoffenes-opprinnelse` hvor grunnstoffene kommer fra, `sola-massetap` sola taper masse (E = mc²) | `eks-stjerne` radius fra temperatur og luminositet; `eks-lysaar` lysår og hvor gammelt lyset er |
| 10 | `sikringsskap` hvor mange apparater tåler kursen, `maaleoppsett` amperemeter og voltmeter riktig koblet, `elbil-lading` lading: energi, effekt og pris | `eks-kobling` kombinert kobling; `eks-panelovn` panelovn (strøm, resistans, energi, kostnad) |

## Kjemi og biologi (forslag)

Hvert kapittel får finpuss av de eksisterende visualiseringene i illustrert stil (laboratorieutstyr, løsninger og celler med lys og skygge) og én ny.

| Kjemi | Ny |
|---|---|
| 1 Kjemiske bindinger | `sape` såpe og fett: like løser like |
| 2 Egenskaper og reaksjoner | `offeranode` rust og offeranode på en båt (redoks og spenningsrekka) |
| 3 Støkiometri | `eks-stokiometri` eksempeloppgave: propanbrenner på hytta (mol, begrensende reaktant, utbytte) |
| 4 Termokjemi | `varme-og-kuldepose` eksoterm og endoterm i praksis |
| 5 Organisk kjemi | `destillasjon` raffineri: fraksjonert destillasjon av råolje |
| 6 Likevekter | `eks-likevekt` eksempeloppgave: ammoniakksyntesen (K og Le Chatelier) |
| 7 Syrer og baser | `eks-titrering` eksempeloppgave: titrering av eddik |
| 8 Miljøanalyse | `forsuring` sur nedbør og kalking av innsjøer |

| Biologi | Ny |
|---|---|
| 1 Liv | `mikroskop` mikroskopet: forstørrelse og hva du kan se |
| 2 Systematikk | `bestemmelsesnokkel` artsbestemmelse med nøkkel |
| 3 Biologisk mangfold | `fremmed-art` en fremmed art sprer seg |
| 4 Forvaltning | `lakselus` lakselus, oppdrett og villaks |
| 5 Cellestrukturer | `proteinets-vei` fra DNA til ferdig protein ut av cella |
| 6 Transport i celler | `salting` hvorfor salt og sukker konserverer mat |
| 7 Celledeling | `eks-mitosefaser` eksempeloppgave: hvor lang tid tar hver fase (telle celler) |
| 8 Kommunikasjon | `refleks` refleksbuen: hånda på en varm kokeplate |
| 9 Transport i mennesket | `trening-og-puls` puls og oksygenopptak under trening |
| 10 Transport i dyr | `oksygen-i-vann` oksygen i vann og fisk (temperatur) |
| 11 Planter | `potometer` potometerforsøket: mål vannopptaket |
| 12 Planter, signaler | `etylen` banan og etylen: frukt som modner |
| 13 Formering | `vegetativ-formering` jordbær og potet: ukjønnet formering i praksis |
| 14 Sykdommer | `handvask` håndvask og bakterier |
| 15 Bekjempelse | `antigendrift` hvorfor det trengs ny influensavaksine hvert år |
