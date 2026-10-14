export const meta = {
  name: 'geofag-kit',
  description: 'Byggeklossene for geofag-visualiseringene (farger, mønstre, hjelpere, komponenter, galleri) og tre referansevisualiseringer, med kontroll og retting',
  phases: [
    { title: 'Grunnmur', detail: 'farger og mønstre, data, beregning, eksporter' },
    { title: 'Komponenter', detail: 'seks familier i tre runder, så API.md og galleribilder' },
    { title: 'Referanser', detail: 'k2-plategrenser, k6-grunnvann og k9-kotekart' },
    { title: 'Kontroll', detail: 'faglig og API, visuelt' },
    { title: 'Retting', detail: 'kit-et først, så referansene' },
    { title: 'Avslutning', detail: 'API.md, galleri, typesjekk, tester og skjermbilder' },
  ],
}

// Kjøres med Workflow({ scriptPath: '<arbeidskopien>/docs/workflows/geofag-kit.js', args: { scratch, root, port } })
// før temaene (se «Geofag» i docs/workflows/README.md). Den committer ikke: hovedøkten ser over galleriet og
// referansene, kjører testene og committer selv. KIT, REFS og NOTES er limt inn fra geofag-katalog.json
// (felt kit, referanser og notater); endres katalogen, limes de inn på nytt.
if (!args || !args.scratch || !args.root || !args.port) throw new Error('args må ha scratch, root og port (se docs/workflows/README.md)')
const ROOT = args.root
const SCRATCH = args.scratch
const PORT = args.port
const BIN = `${ROOT}/docs/workflows/bin`
const KIT_DIR = `${ROOT}/web/src/viz/geofag/kit`
const KIT = [{"name": "geofag/kit/index.ts", "what": "Én import for alt i kapitlene: import { Slider, Figure, LagMonstre, GEO, … } from '../kit'. Eksporterer hele det felles kit-et ('../../kit') og navngitte re-eksporter (ikke export *) av de generelle hjelperne fra kjemi (seededRandom, placeParticles, jiggle, Box, Txt, Select, useContainerTextScale, Formel, TFormel, Reaksjon, TReaksjon, Begerglass, mixColor, fmtSig) og biologi (Etikett, Forvalg, PlayBar, fmtPct, fmtCount, solveOde), så felles navn som useSvgId bare kommer én gang, pluss alt under, og importerer geofag.css. Scene-kit-et importeres for seg fra '../../kit/scene'. Ingen navn kolliderer med scene-kit-et (Terreng, Vann, Landskap, Himmel, Underlag, Sol, Planet, Kloss, Termometer), det felles kit-et (Block, Label, Ground, Plot, Formula, clamp), biologi (Plante, Tre, Etikett) eller fysikkens lokale JordSnitt, FjellSnitt og Hus. Eksportlinjene for hjelperne legges inn i fase 1d, ikke av agentene som skriver hjelperne."}, {"name": "typer.ts (lages av hovedøkten i infra)", "what": "MonsterId med lista over mønstre, ordrett i ledeteksten til agentene i fase 1: granitt, gneis, basalt, gabbro, diabas, sandstein, siltstein, leirskifer, glimmerskifer, kalkstein, marmor, kvartsitt, konglomerat, salt, kull, morene, breelv, leire, kvikkleire, sand, grus, torv, ur, aske og malmsone. monstre.tsx og bergarter.ts importerer typen herfra, så de kan skrives samtidig uten å vente på hverandre."}, {"name": "colors.ts og geofag.css (GEO, --geo-*)", "what": "Tre blokker som --kj-*: lyst tema, mørkt via prefers-color-scheme (:root:not([data-theme='light'])) og [data-theme='dark'], kontrollert mot «Fjell» (mørk flate #1f2225, rustaksent #e09a72/#8f4b2e). Jordas indre: skorpeKontinent, skorpeHav, litosfare, astenosfare, nedreMantel, ytreKjerne, indreKjerne, magma, lava, aske (magma og lava skal ikke ligne VIZ.gravity #d4622a eller aksenten). Bergarter med { fill, line } for hver MonsterId. Vann og is: grunnvann, umettet, bre, firn, havis. Kart: kote, hoydelag[0..5], vannskille. Prosesser: nedbor, fordamping, avrenning, erosjon, avsetning. Ressurser: olje, gass, co2, gehalt[0..4] (sekvensiell). Datering: morIsotop, datterIsotop, polaritet.normal og .omvendt. Risiko: fare[0..3]. Tid: tid.* (dempede periodefarger). VIZ-farger brukes aldri på bergarter; farter og strømning tegnes med VIZ.velocity, og krefter (skråningen, platetrekk og ryggskyv) med VIZ som i fysikk."}, {"name": "felles.tsx", "what": "useGeoScale() (1 på PC, ca. 1,5 på telefon: k = max(1, 0,85 · f), til krystaller, korn, isotopprikker og symboler) og useGeoStroke() (strektykkelser i mønstre og koter), bygd på useSceneScale og useStrokeScale, og geoHoyde(f, H) = H + 260 · (f − 1) for høyere viewBox på mobil."}, {"name": "Rene hjelpere med tester (data)", "what": "geotid.ts (GEOLOGISK_TID etter ICS-kartet versjon 2023/09, devon 419,62; periodeVed, tilDognet, fmtAlder som aldri skriver «Ma» i løpende tekst), datering.ts (ISOTOPER for U–Pb, K–Ar og C-14 med halveringstid, forgrening, mineraler, lukketemperatur og måleområde, uten Rb–Sr; gjenvaerende, datterForhold, alderFraForhold, nullstilles(system, toppTemperatur, varighet), MARIN_RESERVOARALDER), mineraler.ts (MINERALER med gruppe og aniongruppe, SILIKATSTRUKTURER, RISSETESTER, MOHS_ABSOLUTT, muligeMineraler), bergarter.ts (BERGARTER med gruppe, dannelse, tekstur, tetthetsintervall, MonsterId og norske eksempler; MAGMATISKE med ni ruter, NORSKE_MAGMATISKE, SEDIMENTARE, METAMORFE, klassifiserMagmatisk, SYKLUS) og jorda.ts (JORDAS_LAG med nedre mantel, forenklet PREM: tetthetVed, gVed, trykkVed, temperaturVed, vpVed, vsVed; tettheter for vann, sjøvann, is, skorpe og mantel). Kilde i en kommentar ved hver tabell, og alle funksjoner gir null i stedet for NaN eller Infinity."}, {"name": "Rene hjelpere med tester (beregning)", "what": "kornstorrelse.ts (KORNKLASSER, phi, Hjulström-kurvene, kornTilstand(d, v, iBevegelse), synkefart, kumulativKurve, dPersentil, graderingstall, krumningstall, sortering etter Folk og Ward), hydrologi.ts (GLOBALE_RESERVOARER, GLOBALE_STROMMER, oppholdstid, vannbalanse, MATERIALER, darcy, porefart, senkning, sannsynlighetIPerioden, plotteposisjon, gumbelTilpasning, flomMedGjentaksintervall), risiko.ts (SIKKERHETSKLASSER for flom og skred etter TEK17 § 7-2 og § 7-3, oppfyller, forventetSkade, risikoklasse; kvikkleire utenfor de årlige klassene, slik at eks-boligfelt virker selv om risiko kuttes), akser.ts (scaleLog, logTicks og tierpotenser skrevet på norsk, til LogPlot), kart.ts (hoydefelt, koter, terrengprofil, helning, vannskille, kartavstand) og statistikk.ts (middel, standardavvik, median, lineaerRegresjon). Empiriske kurver merket omtrentlige, toleranser i testene og null i stedet for NaN eller Infinity."}, {"name": "monstre.tsx: LagMonstre og lagFyll", "what": "Én <defs> med et SVG-mønster per MonsterId, som på geologiske kart og i PDF-malen «Atlas»: sandstein prikker, siltstein korte streker og prikker, leirskifer skrå streker, kalkstein murstein, marmor murstein med årer, granitt små kryss, basalt og diabas v-er, gneis bølgete bånd, kvartsitt tette prikker, konglomerat ringer, salt kryssraster, kull tett mørk fyll med tynne linjer, morene kantete steiner i fin masse, breelv sorterte prikker med skråsjikt, leire vannrette streker, kvikkleire stiplet, torv strå, ur kantete blokker, aske prikker og malmsone flekker. lagFyll(type) gir url(#…) og strekfarge. Strektykkelser fra useGeoStroke, kontur rundt hvert lag og nok kontrast i mørkt tema."}, {"name": "snitt.tsx: Snittblokk, Lagpakke og Borekjerne", "what": "Snittblokk: blokkdiagram med overflaten oppå i svakt perspektiv (terreng, vann, hav, fjord eller isdekke) og snittet foran; lag gis som funksjoner av x eller polygoner, og barna tegnes i snittets koordinater og klippes til snittet (fold, forkastning, gang, diskordans, magmakammer). Lagpakke: lagrekke med eldste lag nederst ({ type, tykkelse, navn }), pil «yngre», dybdeakse og etiketter i egen kolonne som flytter seg under figuren på smal skjerm. Borekjerne: stående sylinder med lys og skygge, lagene fra en Lagpakke-liste, valgfrie varv og prøvemerker."}, {"name": "tektonikk.tsx: JordasIndre, Plategrense og Vulkan", "what": "JordasIndre: kule med utskåret kile eller helt snitt, lagene etter radiene i jorda.ts (skorpa gjort tykk nok til å synes), kjemisk eller mekanisk inndeling, dybdemarkør og ankerpunkter for etiketter. Plategrense type «spredning» | «subduksjon» (variant hav–kontinent og hav–hav) | «kollisjon» | «transform» (ovenfra) | «varmt-punkt» (inne på en plate), med litosfære, astenosfære, magma, smeltesoner (dekompresjon under ryggen, mantelkilen over plata), havgrop, skjelvsone, ankerpunkter for kraftpiler (platetrekk, ryggskyv), valgfrie magnetiske striper (bare 0–5 millioner år) og props t (millioner år) og fart. Vulkan type «skjold» | «strato» (også erodert), krater, magmakammer i snitt, lavastrøm, lavafontene og askesky (utbrudd 0–1), uten filtre."}, {"name": "landskap.tsx: Isbre, Elveleie, Fjellside, Bekk og Demning", "what": "Isbre: «dalbre» (firn, sprekker, likevektslinje som prop, front som prop, endemorene, sidemorene, bresjø), «innlandsis» (tykkelse som prop) og «havis». Elveleie: «lengde» (fra fjell til delta, vannflate og korn på bunnen), «tverr» (vannstand, flomlinjer, flomslette, målepunkter) og «ovenfra» (meandre eller rett kanal); vannet klart, grumsete eller slamstrøm. Fjellside, Bekk og Demning kopiert fra fysikk/kap03/vannkraft-deler.tsx (FjellSnitt, Bekk, Demning) med nye navn og GEO-farger, ikke importert på tvers. Demning blir i kit-et fordi både hjulstrom og drikkevann bruker den."}, {"name": "vann.tsx: Grunnvannssnitt, Bronn, Nedbor og Stromlinjer", "what": "Grunnvannssnitt: umettet sone, kapillærsone, grunnvannsspeil (profilfunksjon, så det kan vise senkningstrakt eller skråning) og mettet sone. Bronn: borebrønn i fjell, gravd brønn, observasjonsbrønn og energibrønn med foringsrør, filter, pumpe og vannstand (også som borehull). Nedbor: regn eller snø med intensitet, vind og fast frø, bygd på Regn og Snofall fra fysikk/kap02/fore-og-bremsing-deler.tsx (kopiert), med et valgfritt skydekke-lag for overskyet vær og regnvær, siden Himmel i scene-kit-et bare har sol og haugskyer. Stromlinjer: piler langs en sti med tykkelse etter mengde og valgfri bevegelse med t (mantelstrøm, isstrøm, grunnvann, karbon- og vannstrømmer, bølgefront); fargen velges av kapittelet."}, {"name": "korn.tsx: Korn, Kornpakning og Kornkurve", "what": "Korn: ett korn med størrelse, rundhet (kantet til godt rundet) og bergartsfarge, lys fra øvre venstre, størrelse ganget med useGeoScale. Kornpakning: utsnitt (lupe) med pakkede korn og porer fylt med vann, olje, gass, CO₂, luft eller sement, eller leirpartikler, sortering som prop, plassering med placeParticles og fast frø. Kornkurve: kumulativ kornfordeling på LogPlot med bånd for leire, silt, sand og grus, høyere viewBox på mobil."}, {"name": "bygg.tsx: Bygning og Plattform", "what": "Bygning: norsk trehus, hytte, garasje, skole, sykehjem, fjøs, vannverk og anrikningsverk sett fra siden, i riktige proporsjoner (px per m som prop), bygd på Hus i fysikk/kap03 (kopiert, nytt navn); gir skala og brukes til sikkerhetsklassene. Plattform: plattform på havet med valgfri borestreng ned i et snitt, i kit-et fordi petroleumssystem, co2-lagring, eks-oljefelt og eks-jordskjelv bruker den (to av dem bygges samtidig i tema 7)."}, {"name": "diagram.tsx og kotekart.tsx: LogPlot, Klimadiagram, GeoTidslinje og Kotekart", "what": "LogPlot: plott med logaritmisk x, y eller begge (akser.ts, tierpotenser på norsk) og en valgfri ekstra høyreakse, i samme stil som Plot i det felles kit-et (som bare har lineære akser og ingen høyreakse); brukes av hjulstrom, vulkaner, Kornkurve, sikteanalyse og flomfrekvens i stedet for lokale akser. Klimadiagram: nedbør som grå søyler mot høyre akse og temperatur som mørk kurve mot venstre akse, som malen i PDF-ene, bygd på LogPlot med lineære akser, valgfri 0 °C-linje, H = 320 + 260 · (f − 1). GeoTidslinje: tidsakse i millioner år, tusen år eller år, lineær eller logaritmisk, med periodebånd fra GEOLOGISK_TID, zoom og hendelsesmerker, vannrett eller loddrett. Kotekart: kart fra et høydefelt i kart.ts med høydelag, koter (hver femte tykk med tall), elv, vann, kystlinje, vannskille, soner (faresoner, nedbørfelt, arealbruk), nordpil, målestokk og valgfri profillinje; tekst vokser på mobil."}, {"name": "stein.tsx: Krystall, Steinprove og Lupe", "what": "Krystall form «prisme» (kvarts, zirkon) | «rombeeder» (kalkspat) | «terning» (pyritt, halitt, blyglans) | «oktaeder» (magnetitt, flusspat) | «tavle» (glimmer, biotitt, sanidin) | «dodekaeder» (granat), med glans, farge fra mineraler.ts og valgfrie isotopprikker. Steinprove: håndstykke med tekstur etter bergart (kornstørrelse, foliasjon, porfyr, lag, fossilavtrykk, glass), rundslipt eller kantet. Lupe: forstørrer et utsnitt gitt som children (brukes i mange temaer). Størrelser med useGeoScale. Kompass, Geologhammer, Strekplate og Syreflaske har bare én bruker og lages lokalt i kap09 og kap03."}, {"name": "galleri/ og API.md", "what": "Seks gallerisider (geo-kart, geo-snitt, geo-tektonikk, geo-vann, geo-landskap, geo-stein) som forhåndsvisningen viser med ?galleri=geo-<familie> (fagtemaet «Fjell» settes), så galleri-shot.mjs --galleri geo-snitt virker. API.md genereres fra JSDoc av web/scripts/kit-api.mjs (nytt og committet, så det kan kjøres igjen når kit-et endres; kan også lage scene-kit-ets API.md), med kort oversikt per fil; kapittelagentene leser den og galleribildene i stedet for kildefilene."}, {"name": "Lokalt i temaene (ikke i kit-et)", "what": "Brukes bare av én visualisering (og eventuelt eksempeloppgavene i samme tema) og lages i kapittelmappa av eieren: Seismogram (kap02, eks-jordskjelv), model-plategrenser.ts med POLARITET (kap02, plategrenser), felt-deler.tsx med Strekplate og Syreflaske (kap03, bestem-mineralet), tetraedertegningen (kap03, mineralgrupper), målesylinder og kjøkkenvekt (kap03, eks-steinprove), fossiler.tsx (kap04, relativ-alder), dalprofilet (kap05, isbre), Skandinavia-kartet (kap05, istider), jordprofilet (kap05, losmasser), fly med magnetometer (kap07, malmleting), Dagbrudd, Lastebil og deponi (kap07, malm), det seismiske snittet (kap07, petroleumssystem), skip (kap02 og kap07, hver sin), Skredbane (kap08, skraaning), leirpartikler (kap08, kvikkleire), Kompass og Geologhammer (kap09, strok-og-fall) og Siktesats (kap09, sikteanalyse). Ingen to visualiseringer deler en lokal del."}]
const REFS = [{"id": "plategrenser", "title": "Platene beveger seg: rygg, grop og fjellkjede", "sections": ["2.2", "2.3"], "km": ["KM2", "KM10"], "idea": "Referansevisualisering, lages i kit-kjøringen. Et snitt gjennom litosfæren og astenosfæren der eleven velger type med Segmented. Kjerne: spredningsrygg (konstruktiv eller divergerende plategrense; Den midtatlantiske ryggen), subduksjon (destruktiv eller konvergerende; hav mot kontinent eller hav mot hav) og kollisjon mellom kontinenter (Himalaya i dag, den kaledonske fjellkjeden for ca. 430–400 millioner år siden). Eleven setter platefarten (1–10 cm per år) og spiller av millioner av år: ny havbunn dannes og blir eldre og dypere bort fra ryggen, med magnetiske striper som speiler hverandre de siste 5 millioner årene (eldre havbunn tegnes uten striper, med en tekst om at stripene fortsetter, men ikke vises her); havplata dykker ned med jordskjelv langs en skrå sone og vulkaner over; og en fjellkjede løftes ved kollisjon. Bryteren «Vis krefter» viser drivkreftene som kraftpiler i VIZ-farger, platetrekk (den kalde, tunge plata synker) og ryggskyv, og teksten sier at mantelkonveksjonen og platene er samme system, ikke et transportbånd som drar platene. Bryteren «Hvor smelter det?» viser dekompresjonssmelting under ryggen (mantelen stiger, trykket faller, og den smelter delvis) og vann fra plata som senker smeltepunktet i mantelkilen over subduksjonssonen, så eleven ser hvorfor vulkanene ligger der de ligger (2.3). Tillegg: transformforkastning (konservativ, sett ovenfra) og «Varmt punkt (inne på en plate)», der Explain sier at et varmt punkt ikke er en plategrense, og at Island er både rygg og varmt punkt. Fartspiler i VIZ.velocity viser bevegelsen, markører viser hvor dypt jordskjelvene skjer, og Explain tar opp at platene ikke flyter på flytende magma. Etikettene og søkeordene har begge sett med fagord.", "model": "model-plategrenser.ts (i kap02): plateavstand(v, t) (1 cm/år = 10 km per million år), havbunnsalder(x, halvfart), havdybde(alder) = 2500 + 350 · √(alder i millioner år) m (flater ut etter ca. 70 millioner år), POLARITET for de siste ca. 5 millioner år (Brunhes–Matuyama ved 0,78 millioner år; kilde i koden), striper(halvfart, tMax) (bare 0–5 millioner år, tomt utenfor), skjelvdybder(type), solidus(z, vann) og adiabat(z) (forenklede kurver, merket omtrentlige, med kilde) og GRENSE_TYPER (fagord i begge sett, bevegelse, drivkraft, landformer, vulkanisme, smelting, skjelvdyp, eksempler; varmt punkt merket som «ikke plategrense»). Tester: 2 cm/år i 100 millioner år gir 2000 km; havdybden er 2500 m ved ryggen og ca. 5000 m ved 50 millioner år; stripene er symmetriske om ryggen med bredde halvfart · varighet og tomme for alder over 5 millioner år; adiabaten under ryggen krysser tørr solidus mellom ca. 50 og 120 km dyp; våt solidus ligger minst 200 °C under tørr; alle felt er fylt ut for hver type.", "sceneNeeds": "Geofag-kit: Plategrense (alle fem typene, med litosfære, astenosfære, magma, smeltesoner og mantelstrøm), Vulkan, LagMonstre (basalt for havskorpe, granitt for kontinentalskorpe), Stromlinjer og PlayBar med «millioner år». Scene-kit: Vann (havet), en smal stripe Himmel, Landskap type «fjell», ForceArrow i VIZ.velocity for platefarten og ForceArrow i VIZ-kraftfarger for platetrekk og ryggskyv.", "no": "2"}, {"id": "grunnvann", "title": "Grunnvann: grunnvannsspeil, brønn og Darcys lov", "sections": ["6.2", "6.3"], "km": ["KM7", "KM8"], "idea": "Referansevisualisering, lages i kit-kjøringen. Et snitt gjennom en løsmasseavsetning og fjellet under med umettet sone, grunnvannsspeil og mettet sone, der grunnvannet strømmer fra høyt til lavt terreng og kommer ut i en elv. Eleven velger materiale (grus, sand, silt, leire eller oppsprukket fjell) og pumperate, og ser i en lupe at vannet ligger i porer og sprekker, ikke i underjordiske innsjøer, og at farten varierer fra meter per døgn i grus til millimeter per år i leire. Brønnen senker grunnvannsspeilet i en senkningstrakt, dyp og smal i tette masser og grunn og vid i grus. Et smittemerke fra en lekk kloakkledning eller husdyrgjødsel flytter seg mot brønnen, med antall døgn sammenlignet med kravet om minst 60 døgns oppholdstid i grunnen; kravet er en hygienisk barriere, fordi bakterier og virus dør eller holdes tilbake underveis. Bryteren «Nitrat» viser at nitrat fra en gjødslet åker ikke brytes ned i oksygenrikt grunnvann, men kommer fram uansett, bare senere og mer fortynnet, så tiltakene er sikringssone og mindre gjødsling. Eleven skal lære porøsitet, hydraulisk ledningsevne og grunnvannsspeil, og hvorfor breelvavsetninger er gode grunnvannsmagasiner.", "model": "Bygger på hydrologi.ts i kit-et: MATERIALER (hydraulisk ledningsevne, f.eks. grus ca. 10⁻², sand 10⁻⁴, silt 10⁻⁶, leire 10⁻⁹ m/s, oppsprukket fjell 10⁻⁷–10⁻⁵, og effektiv porøsitet), darcy(K, gradient), porefart(q, n) og senkning(r, Q, T, R) etter Thiem (forenklet, r minst brønnradien). model-grunnvann.ts: reisetid(avstand, i, K, n), smittebarriere(reisetid) (minst 60 døgn; kravet kontrollert mot Mattilsynets veileder til drikkevannsforskriften og NGU, kilde i koden) og nitratVedBronn(c₀, fortynning) uten nedbrytning. Tester: q = K · i; porefarten er større enn q; senkningen er null ved påvirkningsradien og øker inn mot brønnen; reisetid = L/v; L = 0 eller gradient 0 gir aldri Infinity i teksten; leire gir mye lengre reisetid enn grus; nitratet når fram med c₀/fortynning uansett reisetid.", "sceneNeeds": "Geofag-kit: Grunnvannssnitt, Bronn (borebrønn med pumpe og filter), LagMonstre (grus, sand, leire, fjell), Kornpakning (porene i en lupe), Stromlinjer (GEO.grunnvann) og Bygning (vannverk, hus og fjøs). Scene-kit: Himmel, Landskap type «aaser», Terreng type «gress», Gran, Vann (elva) og Dimension. Lokalt i kap06 (eier: grunnvann): åker og kloakkledning.", "no": "6"}, {"id": "kotekart", "title": "Kotekart og terrengprofil", "sections": ["9.1", "9.2"], "km": ["KM12", "KM11"], "idea": "Referansevisualisering, lages i kit-kjøringen. Et kotekart over et tenkt norsk landskap (dal, åser, en topp, et vann og en elv) med høydelag, ekvidistanse og målestokk, der eleven legger en profillinje mellom A og B og ser terrengprofilet under, med overhøyde som kan endres. Eleven peker på et punkt og får høyde og helning i grader og prosent, og ser at tette koter betyr bratt terreng og at koter som danner en V oppover dalen, viser en elv. Vannskillet for elva tegnes, så eleven ser nedbørfeltet (kobling til tema 6 og 8). Profilet ligner terrengprofilet i SmartNotes' PDF-mal, så eleven kjenner det igjen fra notatene.", "model": "Bygger på kart.ts i kit-et: hoydefelt(frø, former), koter(felt, ekvidistanse) (marching squares med sammenhengende linjer), terrengprofil(felt, A, B, n), helning(felt, x, y), vannskille(felt, utlop) (enkel D8) og kartavstand(maalestokk). model-kotekart.ts har det visningen trenger (forvalg for A og B, overhøyde). Tester: et skråplan gir riktig helning og rette, parallelle koter; kotene rundt en kjegle er sirkler; profilet starter og slutter i høyden til A og B; alle punktene i nedbørfeltet renner til utløpet; ekvidistanse 0 gir ingen uendelig løkke.", "sceneNeeds": "Geofag-kit: Kotekart (høydelag GEO.hoydelag, koter GEO.kote, kotetall, elv, vann, nordpil, målestokk, profillinje) og Plot for profilet. Scene-kit: Terreng (profilet fylt), Gran og Dimension. A og B styres med glidebrytere for retning og plassering; dra-punkter er valgfrie (pekerhåndtering som i fysikk/kap01/gult-lys-graf.tsx).", "no": "9"}]
const NOTES = "Omfang i katalogen (anbefalt variant): 35 visualiseringer og 15 eksempeloppgaver, 50 i alt. Tema 1: 2 + 1, tema 2: 3 + 2, tema 3: 6 + 1, tema 4: 3 + 2, tema 5: 6 + 2, tema 6: 4 + 2, tema 7: 4 + 2, tema 8: 4 + 2, tema 9: 3 + 1. Tre av dem (k2-plategrenser, k6-grunnvann og k9-kotekart) lages som referanser i kit-kjøringen og står som reviewOnly i temaene.\n\nEndret etter kontrollene: fire nye visualiseringer fyller hull i kompetansemålene: mineralgrupper (KM3, 3.1), sedimentare-bergarter (KM3), istider (5.2) og malmleting («danning og kartlegging» i KM9). De er egne oppføringer og ikke moduser, fordi flere oppføringer allerede var for tette for én agent. eks-snoskred er byttet ut med eks-fjellskred (fjellskred og flodbølge er den mest særnorske skredfaren). Forvitring er flyttet til tema 5 som k5-forvitring med 1.2 som ekstra deltema, så den vises på temasiden for tema 5 (ChapterPage bruker vizForChapter) og fortsatt ved notater i 1.2 (vizForSection). eks-nitrat heter nå eks-bronn og sammenligner smittestoffer, ikke nitrat, med kravet om 60 døgns oppholdstid. k2-plategrenser har fått tittelen «Platene beveger seg: rygg, grop og fjellkjede», som ikke er lik deltematittelen. De tetteste oppføringene (jordsystemene, karbonkretslop, plategrenser, vulkaner, relativ-alder, vannets-kretslop, isbre, forvitring, losmasser, malmleting, petroleumssystem) har en kjerne og et tillegg: agenten gjør kjernen ferdig før tillegget, og kontrollen godtar et enklere tillegg. Alt som kan velges i figuren, har en HTML-kontroll (knapper, Segmented eller Select) som hovedvei, og bygget på tomter i risiko står på faste tomter.\n\nLokale deler og eier: se den siste kit-oppføringen. Eksempeloppgavene bygges etter visualiseringene og kan importere eierens filer. Det som har flere visualiseringer som brukere (Plattform, Demning, Lupe, LogPlot), ligger i kit-et. Dette finnes ikke i scene-kit-et og lages lokalt eller i geofag-kit-et: regnvær og overskyet himmel (skydekke-laget i Nedbor), redskaper i hånda til Person (festes med personPunkter), skip, fly, traktor, fabrikkpipe og målestasjon.\n\nDekning: alle 26 deltemaer (2 + 3 + 3 + 3 + 4 + 3 + 3 + 3 + 2) har minst én oppføring, og hver oppføring har minst ett deltema i sitt eget tema. KM1 (tema 1, forvitring, istider, landheving, losmasser, co2-lagring), KM2 (tema 2), KM3 (tema 3, med mineralgrupper og sedimentære bergarter), KM4 (tema 4, eks-havbunnsspredning, eks-skjellsand), KM5 (relativ-alder, geologisk-tid, losmasser, landheving, eks-steinprove, eks-pukk, eks-skjellsand, sikteanalyse, kvikkleire), KM6 (tema 5), KM7 (tema 6, eks-vannforing), KM8 (grunnvann, drikkevann, eks-bronn, eks-nedborfelt), KM9 (tema 7, med dannelse og kartlegging i malmleting og seismikk i petroleumssystem), KM10 (tema 8, vulkaner, plategrenser, eks-jordskjelv, avrenning, eks-elveforbygning), KM11 (skraaning, flomfrekvens, risiko, eks-fjellskred, eks-boligfelt, kotekart), KM12 (tema 9). KM-kodene skrives også som søkeord, som i biologi. Fortsatt tynt: innsjøer i 6.2 og grunnvarme i 7.2 (begge i reserven), og KM5, KM11 og KM12 forutsetter eget feltarbeid, som visualiseringene bare kan støtte.\n\nReserve (alternativ C): seismiske-bolger (2.1, strålegang og skyggesone), vulkan-og-klima (1.2, nedkjøling etter store utbrudd), bergvarme (7.2, energibrønn og geotermi), innsjo (6.2, lagdeling og sirkulasjon rundt 4 °C), jorderosjon (5.4, kantsoner), avsetningsrate (4.1, borekjerne, varv og alder–dyp) og eks-snoskred (8.1, α–β-modellen; løsningen må da si at modellen gir hvor langt et skred kan nå, og at sikkerhetsklassen krever en vurdering av hvor ofte det skjer).\n\nAvgrensning mot andre fag: fysikk har halveringstid, strålingsbalanse, vannkraft og skråplanet med friksjon og planlegger c14 og varmepumpe. Geofag vinkles mot mineral, isotopsystem og lukketemperatur (C-14 holdes kort: hva som kan dateres, reservoareffekt og kalibrering), tilbakekobling i jordsystemene, poretrykk og kohesjon i skråningen, og vann som ressurs. Titlene skal være ulike, og søkeordene viser til det andre faget. Innad i geofag er oppføringene vinklet ulikt: losmasser (dannelse) mot sikteanalyse (metode), risiko (kart og klasser) mot eks-boligfelt (regning), plategrenser mot eks-havbunnsspredning, malmleting (dannelse og leting) mot malm (økonomi), og isbre, istider og landheving (én bre, klimasyklusene, jordskorpa).\n\nFakta som må sjekkes mot kilden og skrives i koden før de låses i tester: ICS-kartet versjon 2023/09 (devon 419,62), polaritetsskalaen for 0–5 millioner år, PREM, Shiklomanov 1993 og Trenberth mfl. 2007, IPCC AR6 figur 5.12, impulsresponsen i Joos mfl. 2013, Sclater og Christie 1980, Berger 1978 og EPICA Dome C (Jouzel mfl. 2007), NGU og NGF (korngrenser og løsmassenavn), NVE (kvikkleire 0,5 og 2 kPa, veileder 1/2019, klimapåslag, sikkerhetsmargin), TEK17 § 7-2 og § 7-3, Mattilsynet (60 døgns oppholdstid), Hjulström 1935 (avlest, med toleranser), marin grense og tidspunkt for isfrihet (Oslo ca. 220 m og ca. 10 800 år siden, Trondheim ca. 175 m), det globale havnivået etter istida, vannforbruk og lekkasje i Norge, metallinnhold i jordskorpa, CO₂-tetthet og VEI-tabellen. Er en verdi usikker, skriver teksten «omtrent» eller bruker egne tall. C-14 regnes med 5730 år og kalles «forenklet alder».\n\nE2e-tekster som ingen ny tittel eller sammendrag får inneholde: «Statisk friksjon og glidefriksjon», «Kassen står i ro.», «Kassen glir.», «Dytt F», «Kraftpar: bok, bord og jord», «Gravitasjonsparet», «Jorda trekker boka nedover», «Syre-base-titrering», «Vaksiner og flokkimmunitet» og nå «Platene beveger seg: rygg, grop og fjellkjede». I tillegg får ingen tittel være lik en av de 26 deltematitlene i Geofag 1, fordi VizCard har deltematitlene inne i lenka: en test som leter etter «Plategrenser og platebevegelser», ville truffet både visualiseringen og eks-havbunnsspredning. Ingen titler i katalogen bryter dette.\n\nNaN- og Infinity-feller: alder når P = 0, F når β = 0, 1/p når p = 0, Darcy og reisetid når L eller K er 0, Thiem når r = 0, grensegehalt når prisen er 0, log av 0 i Hjulström, LogPlot og VEI (tefravolum 0), ekvidistanse 0, d10 under minste sikt, ankomsttid når fjorddybden er 0, magnetisk anomali når z = 0 og porøsitet ved svært stort dyp. Modellen gir null, og komponenten viser «–» eller en forklaring. viz-shot leser textContent uten ordgrense, så formler som NaNO₃ skrives med Formel eller TFormel, og en tekstbit som slutter på «Na», skal ikke stå rett før en som starter på «N» (Nedbør, Norge, N 45° Ø).\n\nKonvensjoner til README-avsnittet «Geofag»: begreper som i Geofag 1 og hos Udir (geosfæren, hydrosfæren, atmosfæren, biosfæren; litosfære, astenosfære, nedre mantel; spredningsrygg, subduksjon, kollisjon, transformforkastning, med begge sett fagord: konstruktiv eller divergerende, destruktiv eller konvergerende, konservativ; hyposenter og episenter; dypbergart, gangbergart, dagbergart; mineralgruppe, silikat; diagenese; superposisjon, gjennomskjæring, diskordans; akkumulasjon, ablasjon, likevektslinje; morene, breelvavsetning, marin grense, isostasi; grunnvannsspeil, mettet og umettet sone; kildebergart, reservoarbergart, takbergart, felle; gjentaksintervall; strøk og fall, ekvidistanse, overhøyde). Enheter: «millioner år» i løpende tekst (fmtAlder), cm per år, m o.h., mm, m³/s, kPa, Pa·s. Eksempeloppgavene er alltid tenkte steder med egne tall; ekte steder brukes som eksempler i forklaringene (se spørsmål 3)."

const kit = (name) => {
  const k = KIT.find((x) => x.name.startsWith(name))
  if (!k) throw new Error(`Fant ikke kit-oppføringen «${name}»`)
  return `«${k.name}»: ${k.what}`
}

const COMMON = `Du bygger byggeklossene til de interaktive visualiseringene i Geofag 1 (GFG01-03, LK20) i SmartNotes, en app for elever på videregående. Eleven vil ha visualiseringer bygd på samme måte som i fysikk, kjemi og biologi: «illustrert realisme» (som gode, moderne lærebokillustrasjoner: ekte landskap, stein, vann og is med lys og skygge) som samtidig er maksimalt lett å forstå. Byggeklossene du lager, brukes av rundt 50 visualiseringer og eksempeloppgaver, så kvalitet og et ryddig API er viktigere enn fart.

ARBEIDSKOPI: alt arbeid skjer i ${ROOT} (en egen git-arbeidskopi). Bruk ALLTID absolutte stier under ${ROOT}. /home/user/SmartNotes/web, /home/user/SmartNotes/server osv. (uten .claude/worktrees/geofag) er en ANNEN kopi som andre agenter jobber i: les, endre eller kjør aldri noe der. Får du ikke skrevet under ${ROOT}, svar med status «mislyktes» i stedet for å skrive et annet sted.

LES FØRST (spar på lesingen):
- ${ROOT}/web/src/viz/README.md: «Illustrert realisme (scene-kit)», «Regler», og avsnittene «Kjemi» og «Biologi» som mønster for et fag-kit (kit-tabell, farger med { fill, line }, fallgruver på mobil).
- ${ROOT}/web/src/viz/kit/scene/API.md (oversikt over scene-kit-et) og bare kildefilene til det du bruker (core.tsx har toninger, skygger, shade/tint/mix og useSceneScale/useStrokeScale).
- Galleribildene av scene-kit-et i ${SCRATCH}/galleri-alle/ (galleri-<familie>-light-1000.png).
- ${ROOT}/web/src/viz/biologi/kit/index.ts og colors.ts, og --bio-* i ${ROOT}/web/src/styles/viz.css (slik et fag-kit er bygd opp).
- Fagtemaet «Fjell» (data-subject="geoscience") i ${ROOT}/web/src/styles/subjects.css.
- Mønstrene og tegnemalene i PDF-malen «Atlas»: ${ROOT}/server/latex/geoscience/preamble.tex og geofag-delen av ${ROOT}/server/src/profiles/precise.ts.

PLANEN FOR HELE KIT-ET (du lager bare din del, men API-et skal henge sammen):
${KIT.map((k) => `- ${k.name}: ${k.what}`).join('\n')}

FAGLIGE NOTATER FRA PLANLEGGINGEN (konvensjoner, kilder, NaN-feller, e2e-tekster og avgrensning):
${NOTES}

REGLER
- Alt ligger i ${KIT_DIR}/ (og galleri/ der). Endre ikke det felles kit-et, scene-kit-et, kjemi, biologi, fysikk, styles/viz.css eller andre filer utenfor din del. Geofag-fargene ligger i ${KIT_DIR}/geofag.css, som index.ts importerer.
- Illustrert realisme etter README: toninger fra core.tsx, kontur, myk skygge; ingen SVG-filtre og ingen <image>. Bare CSS-variabler (--geo-* i lyst tema, mørkt via prefers-color-scheme med :root:not([data-theme='light']) og via [data-theme='dark'], som --kj-*). Mørkt tema er skumring, ikke invertert. Sjekk mot «Fjell» (mørk flate #1f2225, rustaksent).
- VIZ-fargene (web/src/viz/kit/colors.ts) brukes aldri på bergarter eller landskap; farter og strømning tegnes med VIZ.velocity, krefter med VIZ som i fysikk. Magma og lava skal tydelig skille seg fra VIZ.gravity og rustaksenten.
- Mobil: figurene skaleres ned til ca. 330 px og teksten blir ca. 1,8 ganger større (useTextScale). Bruk useGeoScale/useGeoStroke (felles.tsx) for symboler, korn og streker, og gi brede snitt etiketter i egen kolonne.
- Navn: ingen eksporterte navn kan kollidere med scene-kit-et (Terreng, Vann, Landskap, Himmel, Underlag, Sol, Planet, Kloss, Termometer …), det felles kit-et (Block, Label, Ground, Plot, Formula, clamp …), kjemi (Atom, Formel …) eller biologi (Plante, Tre, Etikett …). Norske navn på komponenter, engelske eller norske på funksjoner som i resten av kit-et.
- JSDoc på hver eksport: første avsnitt sier hva den er og ankerpunktet (det blir API.md), og props forklares.
- Rene hjelpere har kilden i en kommentar ved hver tabell, toleranser i testene for avleste kurver, og gir null i stedet for NaN eller Infinity. Usikre tall merkes «omtrent».
- Språk: bokmål, stor forbokstav bare først, ingen emojier. Tall med fmt() (desimalkomma), ekte minus (−) og mellomrom før enhet.
- Typer: noUncheckedIndexedAccess er på. Ingen nye npm-pakker, ingen nettverkskall, ingen localStorage, ingen Math.random (bruk seededRandom).
- Ikke commit.

VERKTØY (maskinen deles av mange agenter):
- Typesjekk: ${BIN}/tsc-sjekk.sh src/viz/geofag
- Tester: cd ${ROOT}/web && npx vitest run src/viz/geofag
- Galleri (Vite kjører fra arbeidskopien på port ${PORT}): cd ${ROOT}/web && flock /tmp/smartnotes-shot-1.lock env PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/galleri-shot.mjs --port ${PORT} --galleri geo-<familie> --themes light,dark --widths 1000,390 --out ${SCRATCH}/galleri-geo
- Forhåndsvisning: http://localhost:${PORT}/viz-preview.html?galleri=geo-<familie>&theme=dark (og ?fag=geofag&id=k2-plategrenser for en visualisering)
- Skjermbilder av visualiseringer: SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids k2-plategrenser --extremes --out ${SCRATCH}/geo-kit/<runde>
- Se på bildene med Read og vurder dem som en kritisk illustratør og geofaglærer.`

const RESULT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ferdig', 'delvis', 'mislyktes'] },
    files: { type: 'array', items: { type: 'string' } },
    exports: { type: 'string', description: 'Eksporterte navn med kort beskrivelse og viktige props' },
    summary: { type: 'string' },
    openIssues: { type: 'string' },
  },
  required: ['status', 'files', 'exports', 'summary', 'openIssues'],
}

function need(r, what) {
  if (r === null || r === undefined) throw new Error(`Avbrutt: ${what} ga ikke noe resultat`)
  if (r.status === 'mislyktes') throw new Error(`Avbrutt: ${what} mislyktes (${r.openIssues || r.summary})`)
  return r
}

// ---------- Fase 1: grunnmur ----------
phase('Grunnmur')
const MONSTER = 'MonsterId og MONSTER_IDS finnes allerede i kit/typer.ts (granitt, gneis, basalt, gabbro, diabas, sandstein, siltstein, leirskifer, glimmerskifer, kalkstein, marmor, kvartsitt, konglomerat, salt, kull, morene, breelv, leire, kvikkleire, sand, grus, torv, ur, aske og malmsone). Importer dem derfra; endre ikke lista.'
const FAMILIES = ['diagram', 'kotekart', 'snitt', 'tektonikk', 'vann', 'bygg', 'landskap', 'korn', 'stein']

const p1 = await parallel([
  () =>
    agent(
      `${COMMON}

DIN OPPGAVE (fase 1a): farger, mønstre og rammen for kit-et.
- ${kit('colors.ts')}
- ${kit('felles.tsx')}
- ${kit('monstre.tsx')}
- ${MONSTER}
- ${KIT_DIR}/index.ts: re-eksporterer hele det felles kit-et (export * from '../../kit') og NAVNGITTE re-eksporter (ikke export *) av de generelle hjelperne fra kjemi og biologi som kit-oppføringen «geofag/kit/index.ts» lister opp, importerer './geofag.css', og eksporterer dine egne filer. Legg også inn export * fra hver familiefil (${FAMILIES.map((f) => `./${f}`).join(', ')}) og lag dem som tomme moduler («export {};» med en kort kommentar om hva som skal dit), så typesjekken er grønn og ingen andre i fase 2 trenger å røre index.ts. Hjelperne i fase 1b og 1c (geotid, datering, mineraler, bergarter, jorda, kornstorrelse, hydrologi, risiko, akser, kart, statistikk) legges inn i index.ts av en egen agent etterpå; ikke rør dem.
- ${KIT_DIR}/galleri/felles.tsx: rammen for galleriet (som web/src/viz/kit/scene/galleri/felles.tsx, med geofag.css), og ${KIT_DIR}/galleri/monstre.tsx som viser alle mønstrene som lagruter med navn, og fargene, i lyst og mørkt tema. Ta bilder med galleri-shot.mjs (--galleri geo-monstre) og se på dem: synes mønstrene, også i mørkt tema og på 390 px?
Ferdig når typesjekken er grønn og galleribildene ser profesjonelle ut.`,
      { label: 'grunnmur: farger og mønstre', phase: 'Grunnmur', schema: RESULT },
    ),
  () =>
    agent(
      `${COMMON}

DIN OPPGAVE (fase 1b): rene datahjelpere med vitest-tester, i ${KIT_DIR}/ (geotid.ts, datering.ts, mineraler.ts, bergarter.ts og jorda.ts, med *.test.ts ved siden av).
- ${kit('Rene hjelpere med tester (data)')}
- ${MONSTER}
- Ingen React her. Ikke rør index.ts (en egen agent legger inn eksportene). Kilde i en kommentar ved hver tabell. Er du usikker på et tall, skriv det som omtrentlig og si det i rapporten.
Ferdig når typesjekk og tester er grønne.`,
      { label: 'grunnmur: data', phase: 'Grunnmur', schema: RESULT },
    ),
])
for (const [i, r] of p1.entries()) need(r, `grunnmur ${i ? 'data' : 'farger'}`)
const p1c = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (fase 1c): rene beregningshjelpere med vitest-tester, i ${KIT_DIR}/ (kornstorrelse.ts, hydrologi.ts, risiko.ts, akser.ts, kart.ts og statistikk.ts, med *.test.ts).
- ${kit('Rene hjelpere med tester (beregning)')}
- Ingen React her. Ikke rør index.ts. Kilde i en kommentar ved hver tabell, toleranser i testene for avleste kurver (Hjulström), og null i stedet for NaN eller Infinity.
Ferdig når typesjekk og tester er grønne.`,
    { label: 'grunnmur: beregning', phase: 'Grunnmur', schema: RESULT },
  ),
  'grunnmur beregning',
)
const p1d = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (fase 1d): legg eksportene for hjelperne (geotid, datering, mineraler, bergarter, jorda, kornstorrelse, hydrologi, risiko, akser, kart, statistikk) inn i ${KIT_DIR}/index.ts, og sjekk at ingen eksporterte navn kolliderer med det felles kit-et, scene-kit-et, kjemi eller biologi (bruk navngitte eksporter der det trengs). Rett navnekollisjoner i hjelperne selv hvis det er enklest, og oppdater testene. Kjør typesjekk og alle testene for src/viz/geofag.
Rapportene fra fase 1: ${JSON.stringify([...p1, p1c].map((r) => ({ files: r.files, exports: r.exports, openIssues: r.openIssues })), null, 1)}`,
    { label: 'grunnmur: eksporter', phase: 'Grunnmur', schema: RESULT },
  ),
  'grunnmur eksporter',
)
const base = JSON.stringify([...p1, p1c, p1d].map((r) => ({ files: r.files, exports: r.exports })), null, 1)

// ---------- Fase 2: komponenter ----------
phase('Komponenter')
const FAMILY_JOBS = [
  [
    { key: 'kart', files: 'diagram.tsx og kotekart.tsx', items: ['diagram.tsx og kotekart.tsx'] },
    { key: 'snitt', files: 'snitt.tsx', items: ['snitt.tsx'] },
  ],
  [
    { key: 'tektonikk', files: 'tektonikk.tsx', items: ['tektonikk.tsx'] },
    { key: 'vann', files: 'vann.tsx og bygg.tsx', items: ['vann.tsx', 'bygg.tsx'] },
  ],
  [
    { key: 'landskap', files: 'landskap.tsx', items: ['landskap.tsx'] },
    { key: 'stein', files: 'korn.tsx og stein.tsx', items: ['korn.tsx', 'stein.tsx'] },
  ],
]
const familyReports = []
for (const round of FAMILY_JOBS) {
  const rs = await parallel(
    round.map((fam) => () =>
      agent(
        `${COMMON}

DIN OPPGAVE (fase 2, familien «${fam.key}»): komponentene i ${fam.files} i ${KIT_DIR}/.
${fam.items.map((i) => `- ${kit(i)}`).join('\n')}
- Filene finnes som tomme moduler og er allerede eksportert fra index.ts (export *). Ikke rør index.ts eller andre familier. Bygg på grunnmuren (farger, mønstre, felles.tsx og hjelperne) og på familiene som alt er ferdige (se rapportene). Importer innad i kit-et fra filene direkte (ikke fra index.ts), så det ikke blir sirkulære importer.
- Lag galleriet ${KIT_DIR}/galleri/${fam.key}.tsx (standardeksport, bruker galleri/felles.tsx) som viser alle komponentene i flere varianter og med props i ytterkant, og ta bilder: --galleri geo-${fam.key}. Se på dem i lyst og mørkt tema, 1000 og 390 px, og rett til de ser ut som gode lærebokillustrasjoner.
Grunnmuren: ${base}
Ferdige familier: ${JSON.stringify(familyReports.map((r) => ({ key: r.key, files: r.files, exports: r.exports })), null, 1)}
Ferdig når typesjekk og tester er grønne og galleriet ser profesjonelt ut.`,
        { label: `komponenter: ${fam.key}`, phase: 'Komponenter', schema: RESULT },
      ).then((r) => (r ? { ...r, key: fam.key } : r)),
    ),
  )
  for (const [i, r] of rs.entries()) familyReports.push(need(r, `komponenter ${round[i].key}`))
}

const api = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (etter fase 2): oversikten over kit-et.
- Skriv ${ROOT}/web/scripts/kit-api.mjs: lager en API.md fra JSDoc i en kit-mappe med TypeScript-kompilatoren som allerede er installert (import ts from 'typescript'), i samme form som ${ROOT}/web/src/viz/kit/scene/API.md (les den: kort oversikt per fil med eksporterte navn, første avsnitt av JSDoc og viktige props). Bruk: node scripts/kit-api.mjs src/viz/geofag/kit > src/viz/geofag/kit/API.md (og den skal også kunne lage scene-kit-ets API.md uten store forskjeller fra dagens).
- Lag ${KIT_DIR}/API.md med skriptet, og les den: mangler JSDoc noe sted, så legg det til i kildefila (bare kommentarer).
- Ta galleribildene av alle familiene (--galleri geo-alle og hver geo-<familie>) til ${SCRATCH}/galleri-geo/.
Rapportene fra familiene: ${JSON.stringify(familyReports.map((r) => ({ key: r.key, files: r.files, exports: r.exports, openIssues: r.openIssues })), null, 1)}`,
    { label: 'API.md og galleri', phase: 'Komponenter', schema: RESULT },
  ),
  'API.md',
)

// ---------- Fase 3: referanser ----------
phase('Referanser')
const REF_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['ferdig', 'delvis', 'mislyktes'] },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    kitIssues: { type: 'string', description: 'Det som mangler i kit-et eller er vanskelig å bruke, med forslag' },
    openIssues: { type: 'string' },
  },
  required: ['id', 'status', 'files', 'summary', 'kitIssues', 'openIssues'],
}
const refPrompt = (r) => {
  const NN = r.no.padStart(2, '0')
  const DIR = `${ROOT}/web/src/viz/geofag/kap${NN}`
  return `${COMMON}

DIN OPPGAVE (fase 3, referanse): lag visualiseringen «${r.id}» (nøkkel k${r.no}-${r.id}) i ${DIR}/, slik temaagentene senere skal lage sine. Den viser om kit-et virker i praksis.
- Tittel: «${r.title}». Deltemaer: ${r.sections.join(', ')}. Kompetansemål: ${r.km.join(', ')} (skriv dem også i keywords).
- Idé: ${r.idea}
- Modell: ${r.model}
- Scenebehov: ${r.sceneNeeds}
- Følg «Oppbygning av én visualisering» og «Illustrert realisme» i README. Import: import { … } from '../kit' (geofag-kit-et, som også eksporterer det felles kit-et) og scene-kit-et fra '../../kit/scene'. Les ${KIT_DIR}/API.md og galleribildene i ${SCRATCH}/galleri-geo/ i stedet for kildefilene, og les bare kildefila til komponentene du bruker.
- Modellen i ${DIR}/model-${r.id}.ts med tester i model-${r.id}.test.ts. Komponenten i en egen fil med standardeksport. Registrer den i ${DIR}/index.ts (VizMeta: id, chapter '${r.no}', sections, title, summary, keywords, load).
- Endre IKKE kit-et. Mangler noe, lag det lokalt i ${DIR}/ og beskriv det i kitIssues (også det som var tungvint).
- Alt eleven kan velge i figuren, har en HTML-kontroll (Segmented, knapper eller Select) som hovedvei. Ekte steder og kjente hendelser kan nevnes kort i forklaringene.
- Typesjekk (${BIN}/tsc-sjekk.sh src/viz/geofag/kap${NN}), tester (cd ${ROOT}/web && npx vitest run src/viz/geofag/kap${NN}), og minst to runder skjermbilder: SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids k${r.no}-${r.id} --extremes --out ${SCRATCH}/geo-ref/${r.id}-<runde>. viz-shot flytter bare glidebrytere: klikk også gjennom Segmented, knapper og avspilling med et lite Playwright-skript i ${SCRATCH} hvis visualiseringen har det.
Svar med id, status, filer, sammendrag, kitIssues og det som er uløst.`
}
const refs = []
for (const pair of [REFS.slice(0, 2), REFS.slice(2)]) {
  const rs = await parallel(pair.map((r) => () => agent(refPrompt(r), { label: `referanse: k${r.no}-${r.id}`, phase: 'Referanser', schema: REF_SCHEMA })))
  for (const [i, r] of rs.entries()) refs.push(need(r, `referanse ${pair[i].id}`))
}

// ---------- Fase 4: kontroll ----------
phase('Kontroll')
const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          where: { type: 'string', description: 'Fil, komponent eller referanse' },
          severity: { type: 'string', enum: ['blocking', 'polish'] },
          what: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['where', 'severity', 'what', 'fix'],
      },
    },
  },
  required: ['findings'],
}
const all = JSON.stringify({ base: [...p1, p1c, p1d].map((r) => r.files), families: familyReports.map((r) => ({ key: r.key, exports: r.exports })), refs }, null, 1)
const reviews = await parallel([
  () =>
    agent(
      `${COMMON}

DIN OPPGAVE (kontroll, faglig og API): du er geofaglærer på VG2 og en nøye kodeleser. Ikke rett noe selv; lag en liste med funn.
- Hjelperne: stemmer tallene og kildene (ICS, PREM, Hjulström, TEK17, NVE, halveringstider osv., se de faglige notatene), er testene meningsfulle, og gir alt null i stedet for NaN eller Infinity?
- API-et: eksporterer index.ts alt, uten navnekollisjoner? Er props og navn konsekvente mellom familiene? Er JSDoc og API.md til å stole på?
- De tre referansene: faglig riktige, begreper som i Geofag 1, og forklaringer som retter opp misoppfatninger.
Kjør typesjekk og testene. blocking = feil fag, feil tall, brudd på reglene eller noe som gjør kit-et vanskelig å bruke riktig; polish = konkrete forbedringer.
Oversikt: ${all}`,
      { label: 'kontroll: faglig og API', phase: 'Kontroll', schema: FINDINGS },
    ),
  () =>
    agent(
      `${COMMON}

DIN OPPGAVE (kontroll, visuelt): du er en kritisk illustratør. Ikke rett noe selv; lag en liste med funn.
- Ta nye bilder av alle gallerisidene (--galleri geo-alle, lyst og mørkt, 1000 og 390 px) og av referansene (SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids ${REFS.map((r) => `k${r.no}-${r.id}`).join(',')} --extremes --themes light,dark --out ${SCRATCH}/geo-kit/kontroll).
- Sjekk realisme og et profesjonelt uttrykk, kontrast mellom lagene i mørkt tema med «Fjell», at mønstrene synes, at magma og lava ikke ligner VIZ.gravity eller aksenten, overlapp og tekst som går ut av figuren på 390 px, og NaN i teksten.
blocking = stygt, uleselig, overlapp, feil farger eller brudd på reglene; polish = konkrete forbedringer.
Oversikt: ${all}`,
      { label: 'kontroll: visuelt', phase: 'Kontroll', schema: FINDINGS },
    ),
])
for (const [i, r] of reviews.entries()) need(r, `kontroll ${i ? 'visuelt' : 'faglig'}`)
const findings = reviews.flatMap((r) => r.findings || [])
log(`Kit-kontroll: ${findings.filter((f) => f.severity === 'blocking').length} blokkerende og ${findings.filter((f) => f.severity === 'polish').length} forbedringer`)

// ---------- Fase 5: retting ----------
phase('Retting')
const kitFix = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (retting av kit-et): rett funnene som gjelder kit-filene i ${KIT_DIR}/, og kitIssues fra referansene som hører hjemme i kit-et (det flere visualiseringer vil trenge). Rett alle blokkerende, og forbedringene som gjør kit-et tydelig bedre. Kontrolløren kan ta feil; begrunn kort det du lar være. Ikke rør referansemappene (kap02, kap06, kap09): en egen agent tilpasser dem etterpå. Kjør typesjekk og tester, og ta nye galleribilder av det du har endret.
Funn: ${JSON.stringify(findings, null, 1)}
kitIssues fra referansene: ${JSON.stringify(refs.map((r) => ({ id: r.id, kitIssues: r.kitIssues })), null, 1)}
Svar med status, filer, og i exports: hvilke API-er og props som er endret eller nye.`,
    { label: 'retting: kit', phase: 'Retting', schema: RESULT },
  ),
  'retting kit',
)
const refFix = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (retting av referansene): rett funnene som gjelder referansene (${REFS.map((r) => `k${r.no}-${r.id}`).join(', ')}) i kap02, kap06 og kap09, og tilpass dem til endringene i kit-et (se under). Erstatt lokale deler med kit-komponenter der kit-et nå har dem. Ikke rør kit-et. Kjør typesjekk, tester og skjermbilder (--extremes) til alt er i orden.
Funn: ${JSON.stringify(findings, null, 1)}
Endringer i kit-et: ${JSON.stringify(kitFix, null, 1)}
Svar med status, filer og hva du rettet.`,
    { label: 'retting: referanser', phase: 'Retting', schema: RESULT },
  ),
  'retting referanser',
)

// ---------- Fase 6: avslutning ----------
phase('Avslutning')
const final = need(
  await agent(
    `${COMMON}

DIN OPPGAVE (avslutning): gjør kit-et klart for temaene.
1. cd ${ROOT}/web && node scripts/kit-api.mjs src/viz/geofag/kit > src/viz/geofag/kit/API.md, og se at den er oppdatert.
2. Galleribildene på nytt til ${SCRATCH}/galleri-geo/ (alle familiene, lyst og mørkt, 1000 og 390 px).
3. ${BIN}/tsc-sjekk.sh src/viz/geofag og cd ${ROOT}/web && npx vitest run src/viz/geofag: rett det som feiler.
4. SHOT_PORT=${PORT} ${BIN}/shot.sh --fag geofag --ids ${REFS.map((r) => `k${r.no}-${r.id}`).join(',')} --extremes --themes light,dark --out ${SCRATCH}/geo-kit/slutt skal avslutte uten FEIL.
5. git -C ${ROOT} status --short: bare filer under web/src/viz/geofag/ og web/scripts/kit-api.mjs skal være nye eller endret (fjern løse testskript og skjermbilder i repoet). Sjekk også git -C /home/user/SmartNotes status --porcelain for filer som har havnet i hovedkopien ved en feil, og si fra om dem (ikke slett noe der).
Svar med status, filer og en kort rapport på bokmål om hva kit-et nå inneholder og hva som er usikkert.`,
    { label: 'avslutning', phase: 'Avslutning', schema: RESULT },
  ),
  'avslutning',
)
return { base: [...p1, p1c, p1d], families: familyReports, api, refs, findings, kitFix, refFix, final }
