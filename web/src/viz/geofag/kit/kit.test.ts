import { describe, expect, it } from 'vitest';
import * as geo from './index';
import * as felles from '../../kit';
import * as scene from '../../kit/scene';
import * as kjemi from '../../kjemi/kit';
import * as biologi from '../../biologi/kit';
import * as geotid from './geotid';
import * as datering from './datering';
import * as mineraler from './mineraler';
import * as bergarter from './bergarter';
import * as jorda from './jorda';
import * as kornstorrelse from './kornstorrelse';
import * as hydrologi from './hydrologi';
import * as risiko from './risiko';
import * as akser from './akser';
import * as kart from './kart';
import * as statistikk from './statistikk';

// Navnene som index.ts med vilje henter fra kjemi- og biologi-kit-et (navngitte re-eksporter). Typer finnes ikke ved
// kjøretid; dem sjekker tsc (to `export *` med samme navn gir en typefeil i index.ts).
const FRA_KJEMI = [
  'seededRandom',
  'placeParticles',
  'jiggle',
  'Select',
  'useContainerTextScale',
  'Formel',
  'TFormel',
  'Reaksjon',
  'TReaksjon',
  'Begerglass',
  'mixColor',
  'fmtSig',
];
const FRA_BIOLOGI = ['Etikett', 'Forvalg', 'PlayBar', 'fmtPct', 'fmtCount', 'solveOde'];

/** Fysikkens lokale deler som geofag kopierer med nye navn (Fjellside, Bygning) og ikke må skygge for. */
const FYSIKK_LOKALE = ['JordSnitt', 'FjellSnitt', 'Hus'];

const HJELPERE = { geotid, datering, mineraler, bergarter, jorda, kornstorrelse, hydrologi, risiko, akser, kart, statistikk };

const navn = (m: object) => new Set(Object.keys(m));
const geoNavn = navn(geo);
const fellesNavn = navn(felles);
/** Navnene geofag-kit-et legger til selv (uten det felles kit-et og re-eksportene). */
const egne = [...geoNavn].filter((n) => !fellesNavn.has(n) && !FRA_KJEMI.includes(n) && !FRA_BIOLOGI.includes(n));

describe('geofag/kit/index.ts', () => {
  it('eksporterer hele det felles kit-et', () => {
    for (const n of fellesNavn) expect(geoNavn.has(n), n).toBe(true);
  });

  it('eksporterer hver hjelper (samme objekt som i fila)', () => {
    for (const [fil, modul] of Object.entries(HJELPERE)) {
      const eksporter = Object.entries(modul);
      expect(eksporter.length, fil).toBeGreaterThan(0);
      for (const [n, verdi] of eksporter) expect((geo as Record<string, unknown>)[n], `${fil}: ${n}`).toBe(verdi);
    }
  });

  it('henter de generelle hjelperne fra kjemi og biologi, ikke egne kopier', () => {
    for (const n of FRA_KJEMI) expect((geo as Record<string, unknown>)[n], n).toBe((kjemi as Record<string, unknown>)[n]);
    for (const n of FRA_BIOLOGI) expect((geo as Record<string, unknown>)[n], n).toBe((biologi as Record<string, unknown>)[n]);
  });

  it('har ingen egne navn som kolliderer med scene-kit-et, kjemi, biologi eller fysikkens lokale deler', () => {
    const sceneNavn = navn(scene);
    const kjemiNavn = navn(kjemi);
    const biologiNavn = navn(biologi);
    expect(egne.length).toBeGreaterThan(100);
    expect(egne.filter((n) => sceneNavn.has(n))).toEqual([]);
    expect(egne.filter((n) => kjemiNavn.has(n))).toEqual([]);
    expect(egne.filter((n) => biologiNavn.has(n))).toEqual([]);
    expect(FYSIKK_LOKALE.filter((n) => geoNavn.has(n))).toEqual([]);
    // Scene-kit-et importeres for seg i kapitlene, så heller ikke det felles kit-et eller re-eksportene må finnes der
    expect([...geoNavn].filter((n) => sceneNavn.has(n) && !fellesNavn.has(n))).toEqual([]);
  });
});

describe('geofag-kit-et henger sammen på tvers av filene', () => {
  it('har en periodefarge i GEO.tid for hvert intervall i GEOLOGISK_TID og for prekambrium', () => {
    const ider = [...geotid.GEOLOGISK_TID.map((i) => i.id), geotid.PREKAMBRIUM.id];
    for (const id of ider) expect(Object.keys(geo.GEO.tid), id).toContain(id);
    expect(Object.keys(geo.GEO.tid).sort()).toEqual([...new Set(ider)].sort());
  });

  it('har en farge og et mønster for hver bergart og hvert grunnmateriale', () => {
    for (const id of bergarter.BERGART_IDS) {
      const b = bergarter.BERGARTER[id];
      expect(geo.MONSTER_IDS, id).toContain(b.monster);
      expect(geo.GEO.bergart[b.monster], id).toBeDefined();
    }
    for (const m of hydrologi.MATERIALER) if (m.monster) expect(geo.MONSTER_IDS, m.id).toContain(m.monster);
  });

  it('bruker bare mineraler som finnes i MINERALER', () => {
    for (const id of bergarter.BERGART_IDS)
      for (const m of bergarter.BERGARTER[id].mineraler) expect(mineraler.MINERAL_IDS, `${id}: ${m}`).toContain(m);
  });

  it('bruker mineralene i MINERALER i dateringstabellen, utenom aksessoriske mineraler som bare dateres', () => {
    // Monazitt og titanitt finnes bare i dateringstabellen (ingen farge eller krystallform i mineraler.ts ennå)
    const bareDatering = ['monazitt', 'titanitt'];
    const ukjente = datering.ISOTOP_IDS.flatMap((id) => datering.ISOTOPER[id].mineraler.map((m) => m.mineral)).filter(
      (m) => !(mineraler.MINERAL_IDS as readonly string[]).includes(m),
    );
    expect(ukjente.filter((m) => !bareDatering.includes(m))).toEqual([]);
  });
});
