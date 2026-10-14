import { describe, expect, it } from 'vitest';
import {
  bergart,
  BERGART_IDS,
  BERGARTER,
  bergarterIGruppe,
  gruppeForStadium,
  KJEMI_KLASSER,
  kjemiFraSiO2,
  klassifiserKlastisk,
  klassifiserMagmatisk,
  MAGMATISKE,
  METAMORFE,
  NORSKE_MAGMATISKE,
  SEDIMENTARE,
  SYKLUS,
} from './bergarter';
import { MINERALER } from './mineraler';
import { MONSTER_IDS, type MonsterId } from './typer';

/** Mønstrene som er bergarter (resten er løsmasser, aske og malmsone). */
const BERGARTSMONSTRE: MonsterId[] = [
  'granitt',
  'gneis',
  'basalt',
  'gabbro',
  'diabas',
  'sandstein',
  'siltstein',
  'leirskifer',
  'glimmerskifer',
  'kalkstein',
  'marmor',
  'kvartsitt',
  'konglomerat',
  'salt',
  'kull',
];

describe('bergartstabellen', () => {
  it('har gyldige verdier for hver bergart', () => {
    for (const id of BERGART_IDS) {
      const b = BERGARTER[id];
      expect(b.id).toBe(id);
      expect(MONSTER_IDS).toContain(b.monster);
      expect(b.tetthet[0]).toBeLessThan(b.tetthet[1]);
      expect(b.tetthetTypisk).toBeGreaterThanOrEqual(b.tetthet[0]);
      expect(b.tetthetTypisk).toBeLessThanOrEqual(b.tetthet[1]);
      expect(b.tekstur.length).toBeGreaterThan(0);
      for (const m of b.mineraler) expect(MINERALER[m], `${id}: ${m}`).toBeDefined();
      expect(b.navn).toBe(b.navn.toLowerCase());
      if (b.fra) for (const f of b.fra) expect(BERGARTER[f]).toBeDefined();
    }
  });

  it('hvert bergartsmønster har en bergart med samme id', () => {
    for (const m of BERGARTSMONSTRE) {
      const b = bergart(m);
      expect(b, m).not.toBeNull();
      expect(b!.monster).toBe(m);
    }
    expect(bergart('finnes-ikke')).toBeNull();
  });

  it('undergruppen passer med gruppen', () => {
    const lov = {
      magmatisk: ['dypbergart', 'gangbergart', 'dagbergart'],
      sedimentar: ['klastisk', 'kjemisk', 'biogen'],
      metamorf: ['foliert', 'ikke-foliert'],
    };
    for (const id of BERGART_IDS) {
      const b = BERGARTER[id];
      expect(lov[b.gruppe]).toContain(b.undergruppe);
      if (b.gruppe === 'magmatisk') {
        const forventet = { dypbergart: 'dyp', gangbergart: 'gang', dagbergart: 'dag' } as const;
        expect(b.forekomst).toBe(forventet[b.undergruppe as keyof typeof forventet]);
      }
      if (b.gruppe === 'metamorf') {
        expect(b.grad).toBeDefined();
        expect(b.fra?.length).toBeGreaterThan(0);
      }
    }
  });

  it('typiske tettheter i riktig rekkefølge', () => {
    expect(BERGARTER.granitt.tetthetTypisk).toBeLessThan(BERGARTER.basalt.tetthetTypisk);
    expect(BERGARTER.basalt.tetthetTypisk).toBeLessThan(BERGARTER.peridotitt.tetthetTypisk);
    expect(BERGARTER.kull.tetthetTypisk).toBeLessThan(BERGARTER.salt.tetthetTypisk);
    expect(BERGARTER.salt.tetthetTypisk).toBeLessThan(BERGARTER.sandstein.tetthetTypisk);
    expect(BERGARTER.eklogitt.tetthetTypisk).toBeGreaterThan(BERGARTER.gabbro.tetthetTypisk);
  });

  it('larvikitt er med som norsk bergart', () => {
    expect(NORSKE_MAGMATISKE).toContain('larvikitt');
    expect(BERGARTER.larvikitt.norske.join(' ')).toContain('Larvik');
    for (const id of NORSKE_MAGMATISKE) {
      expect(BERGARTER[id].gruppe).toBe('magmatisk');
      expect(MAGMATISKE.some((r) => r.id === id)).toBe(false);
    }
  });
});

describe('magmatiske bergarter', () => {
  it('ni ruter, én per kombinasjon, som stemmer med bergartene', () => {
    expect(MAGMATISKE).toHaveLength(9);
    const nokler = new Set(MAGMATISKE.map((r) => `${r.kjemi}-${r.forekomst}`));
    expect(nokler.size).toBe(9);
    for (const r of MAGMATISKE) {
      expect(BERGARTER[r.id].kjemi).toBe(r.kjemi);
      expect(BERGARTER[r.id].forekomst).toBe(r.forekomst);
    }
  });

  it('SiO₂-klassene henger sammen og gir riktig kjemi', () => {
    for (let k = 1; k < KJEMI_KLASSER.length; k++) expect(KJEMI_KLASSER[k]!.sio2[0]).toBe(KJEMI_KLASSER[k - 1]!.sio2[1]);
    expect(kjemiFraSiO2(72)).toBe('sur');
    expect(kjemiFraSiO2(63)).toBe('sur');
    expect(kjemiFraSiO2(58)).toBe('intermediaer');
    expect(kjemiFraSiO2(49)).toBe('basisk');
    expect(kjemiFraSiO2(42)).toBe('ultrabasisk');
    expect(kjemiFraSiO2(80)).toBe('sur');
    expect(kjemiFraSiO2(90)).toBeNull();
    expect(kjemiFraSiO2(Number.NaN)).toBeNull();
  });

  it('klassifiserer fra kjemi og kornstørrelse', () => {
    expect(klassifiserMagmatisk({ sio2: 72, kornMm: 4 })?.id).toBe('granitt');
    expect(klassifiserMagmatisk({ sio2: 49, kornMm: 0.2 })?.id).toBe('basalt');
    expect(klassifiserMagmatisk({ kjemi: 'basisk', forekomst: 'gang' })?.id).toBe('diabas');
    expect(klassifiserMagmatisk({ kjemi: 'intermediaer', forekomst: 'dag' })?.id).toBe('andesitt');
    expect(klassifiserMagmatisk({ sio2: 42, kornMm: 3 })?.id).toBe('peridotitt');
    expect(klassifiserMagmatisk({ sio2: 74, glass: true })?.id).toBe('obsidian');
    expect(klassifiserMagmatisk({ kjemi: 'basisk', glass: true })?.id).toBe('basalt');
  });

  it('gir null når noe mangler eller er ugyldig', () => {
    expect(klassifiserMagmatisk({ sio2: 72 })).toBeNull();
    expect(klassifiserMagmatisk({ kornMm: 3 })).toBeNull();
    expect(klassifiserMagmatisk({ sio2: 95, kornMm: 3 })).toBeNull();
    expect(klassifiserMagmatisk({ sio2: 60, kornMm: Number.NaN })).toBeNull();
    expect(klassifiserMagmatisk({ kjemi: 'ultrabasisk', forekomst: 'dag' })).toBeNull();
  });
});

describe('sedimentære og metamorfe bergarter', () => {
  it('listene har riktig gruppe og dekker hele tabellen', () => {
    for (const id of SEDIMENTARE) expect(BERGARTER[id].gruppe).toBe('sedimentar');
    for (const id of METAMORFE) expect(BERGARTER[id].gruppe).toBe('metamorf');
    expect(bergarterIGruppe('sedimentar').map((b) => b.id).sort()).toEqual([...SEDIMENTARE].sort());
    expect(bergarterIGruppe('metamorf').map((b) => b.id).sort()).toEqual([...METAMORFE].sort());
  });

  it('klastiske bergarter etter kornstørrelse (grensene 0,002, 0,063 og 2 mm)', () => {
    expect(klassifiserKlastisk(0.001)?.id).toBe('leirskifer');
    expect(klassifiserKlastisk(0.002)?.id).toBe('siltstein');
    expect(klassifiserKlastisk(0.03)?.id).toBe('siltstein');
    expect(klassifiserKlastisk(0.063)?.id).toBe('sandstein');
    expect(klassifiserKlastisk(0.5)?.id).toBe('sandstein');
    expect(klassifiserKlastisk(10)?.id).toBe('konglomerat');
    expect(klassifiserKlastisk(10, true)?.id).toBe('breksje');
    expect(klassifiserKlastisk(-1)).toBeNull();
    expect(klassifiserKlastisk(Number.NaN)).toBeNull();
  });

  it('kornintervallene passer med klassifiseringen', () => {
    for (const id of SEDIMENTARE) {
      const b = BERGARTER[id];
      if (!b.kornMm) continue;
      const midt = b.kornMm[0] === 0 ? b.kornMm[1] / 2 : Math.sqrt(b.kornMm[0] * b.kornMm[1]);
      const k = klassifiserKlastisk(midt);
      expect(k?.kornMm).toEqual(b.kornMm);
    }
  });

  it('den folierte rekken går fra lav til høy grad', () => {
    const rang = { lav: 0, middels: 1, hoy: 2 };
    const rekke = ['takskifer', 'fyllitt', 'glimmerskifer', 'gneis'] as const;
    for (let k = 1; k < rekke.length; k++) {
      expect(rang[BERGARTER[rekke[k]!].grad!]).toBeGreaterThanOrEqual(rang[BERGARTER[rekke[k - 1]!].grad!]);
    }
    expect(BERGARTER.marmor.fra).toContain('kalkstein');
    expect(BERGARTER.kvartsitt.fra).toContain('sandstein');
  });
});

describe('bergartenes kretsløp', () => {
  it('alle stadier kan nås og forlates', () => {
    const ids = SYKLUS.stadier.map((s) => s.id);
    for (const s of ids) {
      expect(SYKLUS.overganger.some((o) => o.fra === s)).toBe(true);
      expect(SYKLUS.overganger.some((o) => o.til === s)).toBe(true);
    }
    for (const o of SYKLUS.overganger) {
      expect(ids).toContain(o.fra);
      expect(ids).toContain(o.til);
      expect(o.fra).not.toBe(o.til);
    }
  });

  it('sedimenter blir stein ved diagenese, og bare magma blir magmatisk bergart', () => {
    const tilSedimentar = SYKLUS.overganger.filter((o) => o.til === 'sedimentar');
    expect(tilSedimentar.map((o) => o.prosess)).toEqual(['diagenese']);
    const tilMagmatisk = SYKLUS.overganger.filter((o) => o.til === 'magmatisk');
    expect(tilMagmatisk.map((o) => o.fra)).toEqual(['magma']);
    expect(gruppeForStadium('metamorf')).toBe('metamorf');
    expect(gruppeForStadium('magma')).toBeNull();
  });
});
