import { describe, expect, it } from 'vitest';
import {
  alderFraForhold,
  alderFraMengder,
  alderFraRest,
  datterForhold,
  egnet,
  gjenvaerende,
  ISOTOP_IDS,
  ISOTOPER,
  konkordia,
  korrigerForReservoar,
  MARIN_RESERVOARALDER,
  nullstilles,
  tilsynelatendeAlder,
} from './datering';

describe('isotopsystemene', () => {
  it('har halveringstidene fra Steiger og Jäger og 5730 år for C-14', () => {
    // λ = ln 2 / t½
    expect(Math.LN2 / ISOTOPER['u-pb'].halveringstid).toBeCloseTo(1.55125e-10, 13);
    expect(Math.LN2 / ISOTOPER['u-pb'].andreKjede!.halveringstid).toBeCloseTo(9.8485e-10, 12);
    expect(Math.LN2 / ISOTOPER['k-ar'].halveringstid).toBeCloseTo(5.543e-10, 12);
    expect(ISOTOPER['c-14'].halveringstid).toBe(5730);
    expect(ISOTOPER['k-ar'].forgrening).toBeCloseTo(0.105, 3);
  });

  it('er tre systemer uten Rb–Sr, med fornuftige måleområder', () => {
    expect(ISOTOP_IDS).toEqual(['u-pb', 'k-ar', 'c-14']);
    expect(Object.keys(ISOTOPER)).not.toContain('rb-sr');
    for (const id of ISOTOP_IDS) {
      const s = ISOTOPER[id];
      expect(s.id).toBe(id);
      expect(s.maleomrade.min).toBeLessThan(s.maleomrade.max);
      expect(s.forgrening).toBeGreaterThan(0);
      expect(s.forgrening).toBeLessThanOrEqual(1);
    }
    expect(ISOTOPER['c-14'].maleomrade.max).toBe(50_000);
  });

  it('zirkon har høyest lukketemperatur, biotitt lavere enn hornblende', () => {
    const tc = (id: 'u-pb' | 'k-ar', m: string) => ISOTOPER[id].mineraler.find((x) => x.mineral === m)!.lukketemperatur;
    expect(tc('u-pb', 'zirkon')).toBeGreaterThanOrEqual(900);
    expect(tc('k-ar', 'biotitt')).toBeLessThan(tc('k-ar', 'hornblende'));
    expect(ISOTOPER['c-14'].mineraler).toHaveLength(0);
  });
});

describe('henfall og forhold', () => {
  it('halvparten er igjen etter én halveringstid', () => {
    expect(gjenvaerende(0, 'c-14')).toBe(1);
    expect(gjenvaerende(5730, 'c-14')).toBeCloseTo(0.5, 12);
    expect(gjenvaerende(2 * 4.468e9, 'u-pb')).toBeCloseTo(0.25, 12);
    expect(gjenvaerende(10, 10)).toBeCloseTo(0.5, 12);
  });

  it('datter/mor er 1 etter én halveringstid uten forgrening', () => {
    expect(datterForhold(4.468e9, 'u-pb')).toBeCloseTo(1, 12);
    expect(datterForhold(0, 'k-ar')).toBe(0);
    // K–Ar: bare omtrent en tidel blir argon
    expect(datterForhold(1.25e9, 'k-ar')).toBeCloseTo(0.105, 3);
  });

  it('alderFraForhold er det motsatte av datterForhold', () => {
    for (const id of ISOTOP_IDS) {
      for (const t of [1e3, 1e5, 1e7, 1e9, 3.5e9]) {
        const r = datterForhold(t, id);
        // C-14 etter milliarder av år: forholdet er ikke lenger et endelig tall
        if (r === null) {
          expect(id).toBe('c-14');
          continue;
        }
        expect(alderFraForhold(r, id)! / t).toBeCloseTo(1, 9);
      }
    }
  });

  it('alder fra mengder og fra rest', () => {
    // 75 % datter og 25 % mor = to halveringstider
    expect(alderFraMengder(75, 25, 'u-pb')! / (2 * 4.468e9)).toBeCloseTo(1, 12);
    expect(alderFraRest(0.25, 'c-14')).toBeCloseTo(2 * 5730, 6);
    expect(alderFraRest(1, 'c-14')).toBe(0);
  });

  it('gir null i stedet for NaN eller Infinity', () => {
    expect(gjenvaerende(-1, 'c-14')).toBeNull();
    expect(gjenvaerende(Number.NaN, 'c-14')).toBeNull();
    expect(gjenvaerende(1, 0)).toBeNull();
    expect(gjenvaerende(1, -5)).toBeNull();
    expect(datterForhold(1e300, 1)).toBeNull();
    expect(alderFraForhold(-0.1, 'k-ar')).toBeNull();
    expect(alderFraForhold(Number.POSITIVE_INFINITY, 'k-ar')).toBeNull();
    // P = 0: alderen kan ikke bestemmes
    expect(alderFraMengder(10, 0, 'u-pb')).toBeNull();
    expect(alderFraMengder(-1, 5, 'u-pb')).toBeNull();
    expect(alderFraRest(0, 'c-14')).toBeNull();
    expect(alderFraRest(1.2, 'c-14')).toBeNull();
    expect(egnet('c-14', Number.NaN)).toBeNull();
  });

  it('vet hva som kan dateres', () => {
    expect(egnet('c-14', 10_000)).toBe('egnet');
    expect(egnet('c-14', 1e6)).toBe('for-gammel');
    expect(egnet('u-pb', 10_000)).toBe('for-ung');
    expect(egnet('u-pb', 1e9)).toBe('egnet');
    expect(egnet('k-ar', 1e6)).toBe('egnet');
  });

  it('konkordia: begge kjedene gir samme alder for et uforstyrret korn', () => {
    const p = konkordia(1e9)!;
    expect(alderFraForhold(p.y, 'u-pb')! / 1e9).toBeCloseTo(1, 9);
    expect(alderFraForhold(p.x, ISOTOPER['u-pb'].andreKjede!.halveringstid)! / 1e9).toBeCloseTo(1, 9);
    expect(konkordia(-1)).toBeNull();
  });
});

describe('oppvarming og lukketemperatur', () => {
  it('kort, svak oppvarming lar klokkene være', () => {
    const r = nullstilles('k-ar', 100, 1e5)!;
    for (const m of r) expect(m.status).toBe('urort');
  });

  it('400 °C i en million år nullstiller biotitt, men ikke zirkon', () => {
    const kar = nullstilles('k-ar', 400, 1e6)!;
    expect(kar.find((m) => m.mineral === 'biotitt')!.status).toBe('nullstilt');
    expect(kar.find((m) => m.mineral === 'hornblende')!.andelTapt).toBeLessThan(0.5);
    const upb = nullstilles('u-pb', 400, 1e6)!;
    expect(upb.find((m) => m.mineral === 'zirkon')!.status).toBe('urort');
  });

  it('zirkon tåler 700 °C i ti millioner år, men nullstilles nær smeltepunktet', () => {
    expect(nullstilles('u-pb', 700, 1e7)!.find((m) => m.mineral === 'zirkon')!.status).toBe('urort');
    expect(nullstilles('u-pb', 1100, 1e6)!.find((m) => m.mineral === 'zirkon')!.status).toBe('nullstilt');
  });

  it('ved lukketemperaturen i en million år lekker omtrent 63 % ut', () => {
    const biotitt = nullstilles('k-ar', 300, 1e6)!.find((m) => m.mineral === 'biotitt')!;
    expect(biotitt.andelTapt).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(biotitt.status).toBe('delvis');
  });

  it('tapet øker med temperatur og tid', () => {
    let forrige = -1;
    for (const T of [100, 200, 300, 400, 500]) {
      const a = nullstilles('k-ar', T, 1e6)!.find((m) => m.mineral === 'muskovitt')!.andelTapt;
      expect(a).toBeGreaterThanOrEqual(forrige);
      forrige = a;
    }
    const kort = nullstilles('k-ar', 350, 1e4)!.find((m) => m.mineral === 'biotitt')!.andelTapt;
    const lang = nullstilles('k-ar', 350, 1e7)!.find((m) => m.mineral === 'biotitt')!.andelTapt;
    expect(lang).toBeGreaterThan(kort);
  });

  it('C-14 nullstilles ikke av varme, og ugyldige tall gir null', () => {
    expect(nullstilles('c-14', 800, 1e6)).toEqual([]);
    expect(nullstilles('k-ar', Number.NaN, 1e6)).toBeNull();
    expect(nullstilles('k-ar', 300, -1)).toBeNull();
    expect(nullstilles('k-ar', -300, 1)).toBeNull();
    // Svært kaldt og svært lenge: ingen NaN
    for (const m of nullstilles('u-pb', -270, 1e12)!) expect(m.andelTapt).toBe(0);
    for (const m of nullstilles('k-ar', 5000, 1e12)!) expect(m.andelTapt).toBe(1);
  });

  it('tilsynelatende alder ligger mellom oppvarmingen og dannelsen', () => {
    const dannet = 1.6e9;
    const oppv = 4e8;
    expect(tilsynelatendeAlder(dannet, oppv, 0, 'k-ar')! / dannet).toBeCloseTo(1, 9);
    expect(tilsynelatendeAlder(dannet, oppv, 1, 'k-ar')! / oppv).toBeCloseTo(1, 9);
    const delvis = tilsynelatendeAlder(dannet, oppv, 0.5, 'k-ar')!;
    expect(delvis).toBeGreaterThan(oppv);
    expect(delvis).toBeLessThan(dannet);
    expect(tilsynelatendeAlder(1e8, 2e8, 0.5, 'k-ar')).toBeNull();
    expect(tilsynelatendeAlder(1e8, 5e7, 1.5, 'k-ar')).toBeNull();
  });
});

describe('reservoaralder', () => {
  it('trekker fra omtrent 400 år og går aldri under null', () => {
    expect(MARIN_RESERVOARALDER).toBe(400);
    expect(korrigerForReservoar(5000)).toBe(4600);
    expect(korrigerForReservoar(200)).toBe(0);
    expect(korrigerForReservoar(Number.NaN)).toBeNull();
  });
});
