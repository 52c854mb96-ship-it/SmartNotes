import { describe, expect, it } from 'vitest';
import { TETTHETER, havbunnsalder, magnetiskeStriper, type PlategrenseType } from '../kit';
import {
  AVSPILLING,
  GRENSE_TYPER,
  POLARITET,
  SKJELV_KLASSER,
  SMELTING,
  STRIPER_MAKS,
  VULKAN_PLATEDYP,
  adiabat,
  avstandVedDyp,
  fjellkjede,
  geoterm,
  havdybde,
  havdybdeVed,
  isostasi,
  lengdeTilDyp,
  plateavstand,
  plateProfil,
  platePunktVed,
  polaritet,
  skjelvKatalog,
  skjelvKlasse,
  skjelvdybder,
  skorpefortykning,
  smeltesone,
  smeltestart,
  solidus,
  striper,
  stripeVed,
  tidTilDyp,
  trykk,
  vulkanAlder,
} from './model-plategrenser';

const TYPER: PlategrenseType[] = ['spredning', 'subduksjon', 'kollisjon', 'transform', 'varmt-punkt'];

describe('platebevegelse og havbunnens alder', () => {
  it('2 cm/år i 100 millioner år gir 2000 km (1 cm/år = 10 km per million år)', () => {
    expect(plateavstand(2, 100)).toBeCloseTo(2000, 9);
    expect(plateavstand(1, 1)).toBeCloseTo(10, 9);
    expect(plateavstand(0, 50)).toBe(0);
  });

  it('gir null for negative og ugyldige tall', () => {
    expect(plateavstand(-1, 10)).toBeNull();
    expect(plateavstand(2, -1)).toBeNull();
    expect(plateavstand(Number.NaN, 1)).toBeNull();
    expect(plateavstand(2, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('bruker full spredningsfart som kit-et: 4 cm/år gir 2 cm/år per side og 10 millioner år 200 km ut', () => {
    // Kit-ets havbunnsalder tar spredningsfarten (begge platene); hver side flytter seg med halvparten.
    expect(havbunnsalder(200, 4)).toBeCloseTo(10, 9);
    expect(havbunnsalder(-200, 4)).toBeCloseTo(10, 9);
    expect(havdybdeVed(200, 4)).toBeCloseTo(havdybde(10)!, 9);
    expect(havdybdeVed(-200, 4)).toBeCloseTo(havdybde(10)!, 9);
    // Stripene her og i kit-et ligger likt: Brunhes er 0,781 · 20 km bred ved 4 cm/år
    const her = striper(4).filter((p) => p.fra >= 0);
    const kit = magnetiskeStriper(4, 5);
    expect(her[0]!.til).toBeCloseTo(kit[0]!.til, 6);
    expect(her[her.length - 1]!.til).toBeCloseTo(kit[kit.length - 1]!.til, 6);
  });
});

describe('havdypet', () => {
  it('er 2500 m ved ryggen og ca. 5000 m ved 50 millioner år', () => {
    expect(havdybde(0)).toBe(2500);
    expect(havdybde(50)).toBeGreaterThan(4900);
    expect(havdybde(50)).toBeLessThan(5100);
    expect(havdybde(25)).toBeCloseTo(2500 + 350 * 5, 6);
  });

  it('øker hele tiden med alderen, glatt ved 70 millioner år, og flater ut under ca. 6400 m', () => {
    let forrige = -Infinity;
    for (let a = 0; a <= 300; a += 0.5) {
      const d = havdybde(a)!;
      expect(d).toBeGreaterThan(forrige);
      expect(d).toBeLessThan(6400);
      forrige = d;
    }
    expect(havdybde(70.001)! - havdybde(69.999)!).toBeLessThan(0.1);
    // Mindre økning de neste 100 millioner årene etter 100 enn de første 30
    expect(havdybde(200)! - havdybde(100)!).toBeLessThan(havdybde(30)! - havdybde(0)!);
  });

  it('gir null for negative og ugyldige aldre, og havdybdeVed følger farten', () => {
    expect(havdybde(-1)).toBeNull();
    expect(havdybde(Number.NaN)).toBeNull();
    expect(havdybdeVed(1000, 4)).toBeCloseTo(havdybde(50)!, 9);
    expect(havdybdeVed(1000, 0)).toBeNull();
    expect(havdybdeVed(1000, -2)).toBeNull();
    expect(havdybdeVed(Number.NaN, 4)).toBeNull();
  });
});

describe('magnetiske striper', () => {
  it('polaritetstabellen starter med Brunhes (normal) til 0,78 millioner år og slutter ved 5', () => {
    expect(POLARITET[0]!.navn).toBe('Brunhes');
    expect(POLARITET[0]!.normal).toBe(true);
    expect(POLARITET[0]!.til).toBeCloseTo(0.78, 2);
    expect(POLARITET[POLARITET.length - 1]!.til).toBe(STRIPER_MAKS);
    for (let i = 1; i < POLARITET.length; i++) expect(POLARITET[i]!.fra).toBeCloseTo(POLARITET[i - 1]!.til, 9);
    expect(polaritet(0.5)).toBe(true);
    expect(polaritet(1.5)).toBe(false);
    expect(polaritet(6)).toBeNull();
  });

  it('er symmetriske om ryggen med bredde spredningsfart/2 · varighet', () => {
    const h = 2;
    const s = striper(2 * h);
    const hoyre = s.filter((p) => p.fra >= 0);
    const venstre = s.filter((p) => p.til <= 0);
    expect(hoyre.length).toBe(venstre.length);
    expect(hoyre.length).toBe(POLARITET.length);
    for (const p of hoyre) {
      const speil = venstre.find((q) => Math.abs(q.fra + p.til) < 1e-9 && Math.abs(q.til + p.fra) < 1e-9);
      expect(speil).toBeDefined();
      expect(speil!.normal).toBe(p.normal);
      expect(p.til - p.fra).toBeCloseTo(h * 10 * (p.alderTil - p.alderFra), 9);
    }
    // Brunhes: 0,781 millioner år · 20 km per million år
    expect(hoyre[0]!.til).toBeCloseTo(0.781 * 20, 6);
    expect(Math.max(...hoyre.map((p) => p.til))).toBeCloseTo(h * 10 * STRIPER_MAKS, 9);
  });

  it('er tomme for havbunn eldre enn 5 millioner år', () => {
    const v = 6;
    const ytterst = (v / 2) * 10 * STRIPER_MAKS;
    expect(stripeVed(ytterst + 1, v)).toBeNull();
    expect(stripeVed(-ytterst - 1, v)).toBeNull();
    expect(stripeVed(ytterst - 1, v)).not.toBeNull();
    // tMax over 5 gir det samme som 5
    expect(striper(v, 20)).toEqual(striper(v, 5));
    expect(striper(v, 2).every((p) => p.alderTil <= 2 + 1e-9)).toBe(true);
    expect(striper(0)).toEqual([]);
    expect(striper(Number.NaN)).toEqual([]);
    expect(striper(2, 0)).toEqual([]);
  });
});

describe('jordskjelv', () => {
  it('bare subduksjonssoner har skjelv dypere enn 100 km, ned til ca. 700 km', () => {
    for (const t of TYPER) {
      const s = skjelvdybder(t);
      if (t === 'subduksjon') expect(s.maks).toBe(700);
      else expect(s.maks).toBeLessThanOrEqual(100);
      expect(s.typisk).toBeLessThanOrEqual(s.maks);
      expect(s.klasser.length).toBeGreaterThan(0);
      expect(s.tekst.length).toBeGreaterThan(10);
    }
    expect(skjelvdybder('spredning').maks).toBeLessThanOrEqual(10);
    expect(skjelvdybder('subduksjon').klasser).toEqual(['grunne', 'middels', 'dype']);
  });

  it('deler inn i grunne, middels dype og dype skjelv', () => {
    expect(SKJELV_KLASSER.map((k) => [k.fra, k.til])).toEqual([
      [0, 70],
      [70, 300],
      [300, 700],
    ]);
    expect(skjelvKlasse(10)).toBe('grunne');
    expect(skjelvKlasse(150)).toBe('middels');
    expect(skjelvKlasse(600)).toBe('dype');
    expect(skjelvKlasse(800)).toBeNull();
    expect(skjelvKlasse(Number.NaN)).toBeNull();
  });

  it('skjelvkatalogen ligger langs plata, ned til ca. 700 km, og er lik for samme frø', () => {
    for (const v of ['hav-kontinent', 'hav-hav'] as const) {
      const k = skjelvKatalog(v);
      expect(k.length).toBeGreaterThan(100);
      expect(k).toEqual(skjelvKatalog(v));
      for (const s of k) {
        expect(Number.isFinite(s.x) && Number.isFinite(s.z)).toBe(true);
        expect(s.z).toBeGreaterThan(0);
        expect(s.z).toBeLessThanOrEqual(700);
        expect(s.tid).toBeGreaterThanOrEqual(0);
        expect(s.tid).toBeLessThan(1);
      }
      const grunne = k.filter((s) => s.z < 70).length;
      const dype = k.filter((s) => s.z >= 300).length;
      expect(grunne).toBeGreaterThan(dype);
      expect(dype).toBeGreaterThan(5);
    }
  });
});

describe('plata i en subduksjonssone', () => {
  it('går ned til 700 km, slakere under et kontinent enn under en øybue', () => {
    const hk = plateProfil('hav-kontinent');
    const hh = plateProfil('hav-hav');
    expect(hk[hk.length - 1]!.z).toBeCloseTo(700, 6);
    expect(hh[hh.length - 1]!.z).toBeCloseTo(700, 6);
    expect(hk[hk.length - 1]!.x).toBeGreaterThan(hh[hh.length - 1]!.x);
    for (let i = 1; i < hk.length; i++) expect(hk[i]!.z).toBeGreaterThanOrEqual(hk[i - 1]!.z);
  });

  it('vulkanene ligger 150–300 km fra havgropa, der plata er ca. 100 km dyp', () => {
    for (const v of ['hav-kontinent', 'hav-hav'] as const) {
      const x = avstandVedDyp(v, VULKAN_PLATEDYP)!;
      expect(x).toBeGreaterThan(150);
      expect(x).toBeLessThan(320);
    }
    expect(avstandVedDyp('hav-kontinent', 800)).toBeNull();
  });

  it('havbunn som går inn i havgropa, når 660 km etter 10–30 millioner år ved 5–7 cm/år', () => {
    const L = lengdeTilDyp('hav-kontinent', 660)!;
    expect(L).toBeGreaterThan(660);
    expect(tidTilDyp('hav-kontinent', 7)).toBeCloseTo(L / 70, 9);
    expect(tidTilDyp('hav-kontinent', 7)!).toBeGreaterThan(10);
    expect(tidTilDyp('hav-kontinent', 5)!).toBeLessThan(30);
    expect(tidTilDyp('hav-kontinent', 0)).toBeNull();
    const p = platePunktVed('hav-hav', 300)!;
    expect(p.s).toBe(300);
    expect(p.z).toBeGreaterThan(100);
    expect(platePunktVed('hav-hav', -1)).toBeNull();
    expect(platePunktVed('hav-hav', 1e6)!.z).toBeCloseTo(700, 6);
  });
});

describe('hvor smelter mantelen?', () => {
  it('trykket er ca. 1 GPa per 31 km', () => {
    expect(trykk(31)).toBeCloseTo(1, 1);
    expect(trykk(-1)).toBeNull();
  });

  it('tørr solidus er ca. 1120 °C ved overflaten og stiger med dypet', () => {
    expect(solidus(0)).toBeCloseTo(1120.661, 3);
    // Ca. 1500 °C ved 100 km (p ≈ 3,24 GPa), som JSDoc-en sier
    expect(solidus(100)!).toBeGreaterThan(1480);
    expect(solidus(100)!).toBeLessThan(1510);
    for (let z = 5; z <= 300; z += 5) expect(solidus(z)!).toBeGreaterThan(solidus(z - 5)!);
    expect(solidus(-1)).toBeNull();
    expect(solidus(Number.NaN, true)).toBeNull();
  });

  it('adiabaten under ryggen krysser tørr solidus mellom ca. 50 og 120 km dyp', () => {
    const z = smeltestart()!;
    expect(z).toBeGreaterThan(50);
    expect(z).toBeLessThan(120);
    expect(adiabat(z)!).toBeGreaterThan(solidus(z)! - 1);
    expect(adiabat(z + 5)!).toBeLessThan(solidus(z + 5)!);
    // En varmere plume begynner å smelte dypere
    expect(smeltestart(1550)!).toBeGreaterThan(z + 30);
  });

  it('våt solidus ligger minst 200 °C under tørr (30–300 km)', () => {
    for (let z = 30; z <= 300; z += 5) expect(solidus(z)! - solidus(z, true)!).toBeGreaterThanOrEqual(200);
  });

  it('smelter under ryggen, i mantelkilen og under det varme punktet, men ikke ved kollisjon og transform', () => {
    const rygg = smeltesone(SMELTING.spredning)!;
    expect(rygg.til).toBeGreaterThan(50);
    expect(rygg.fra).toBeLessThan(20);
    const kile = smeltesone(SMELTING.subduksjon)!;
    expect(kile.fra).toBeGreaterThanOrEqual(80);
    expect(kile.til).toBeLessThanOrEqual(150);
    // Uten vann ville mantelkilen ikke smeltet
    expect(smeltesone({ ...SMELTING.subduksjon, vann: false })).toBeNull();
    const plume = smeltesone(SMELTING['varmt-punkt'])!;
    expect(plume.til).toBeGreaterThan(rygg.til);
    expect(smeltesone(SMELTING.kollisjon)).toBeNull();
    expect(smeltesone(SMELTING.transform)).toBeNull();
  });

  it('geotermen er 0 °C ved overflaten og følger adiabaten under litosfæren', () => {
    expect(geoterm(0, 70)).toBe(0);
    expect(geoterm(100, 70)).toBe(adiabat(100));
    expect(geoterm(35, 70)!).toBeCloseTo(adiabat(70)! / 2, 9);
    expect(geoterm(10, 0)).toBe(adiabat(10));
    expect(geoterm(10, -1)).toBeNull();
  });
});

describe('kollisjon og isostasi', () => {
  it('høyde + rot = fortykningen, og roten er mye større enn fjellet', () => {
    const iso = isostasi(30)!;
    expect(iso.hoyde + iso.rot).toBeCloseTo(30, 9);
    expect(iso.rot / iso.hoyde).toBeCloseTo(2.8 / 0.5, 6);
    expect(TETTHETER.skorpeKontinentSnitt).toBe(2.8);
    expect(isostasi(-1)).toBeNull();
    expect(isostasi(10, 3.4)).toBeNull();
  });

  it('skorpa blir høyst ca. dobbelt så tykk, og Himalaya får ca. 5 km middelhøyde', () => {
    expect(skorpefortykning(0)).toBe(0);
    expect(skorpefortykning(1e6)!).toBeCloseTo(35, 6);
    const h = fjellkjede(4.5, 50)!;
    expect(h.tykkelse).toBeGreaterThan(65);
    expect(h.tykkelse).toBeLessThanOrEqual(70);
    expect(h.hoyde).toBeGreaterThan(4500);
    expect(h.hoyde).toBeLessThan(5500);
    expect(fjellkjede(4, 0)!.hoyde).toBe(0);
    expect(fjellkjede(-1, 10)).toBeNull();
  });
});

describe('varmt punkt', () => {
  it('alder = avstand / fart', () => {
    expect(vulkanAlder(800, 8)).toBeCloseTo(10, 9);
    expect(vulkanAlder(800, 0)).toBeNull();
  });
});

describe('fakta om hver type', () => {
  it('alle felt er fylt ut for hver type, med begge sett fagord', () => {
    for (const t of TYPER) {
      const g = GRENSE_TYPER[t];
      for (const tekst of [g.navn, g.kort, g.etikett, g.bevegelse, g.drivkraft, g.vulkanisme, g.smelting, g.skjelvdyp]) expect(tekst.trim().length).toBeGreaterThan(2);
      // Etiketten over figuren må få plass på mobil
      expect(g.etikett.length).toBeLessThanOrEqual(40);
      expect(g.fagord.length).toBeGreaterThanOrEqual(2);
      expect(g.landformer.length).toBeGreaterThanOrEqual(2);
      expect(g.eksempler.length).toBeGreaterThanOrEqual(2);
      expect(AVSPILLING[t]).toBeGreaterThan(0);
    }
    expect(GRENSE_TYPER.spredning.fagord).toEqual(expect.arrayContaining(['konstruktiv plategrense', 'divergerende plategrense']));
    expect(GRENSE_TYPER.subduksjon.fagord).toEqual(expect.arrayContaining(['destruktiv plategrense', 'konvergerende plategrense']));
    expect(GRENSE_TYPER.transform.fagord).toContain('konservativ plategrense');
    expect(GRENSE_TYPER['varmt-punkt'].plategrense).toBe(false);
    expect(GRENSE_TYPER['varmt-punkt'].fagord).toContain('ikke en plategrense');
    expect(TYPER.filter((t) => GRENSE_TYPER[t].plategrense)).toHaveLength(4);
  });
});
