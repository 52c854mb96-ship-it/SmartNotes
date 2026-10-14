import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BYGNING_MAAL, BYGNING_TYPER, Bygning, PLATTFORM_NAVN, Plattform, bygningStorrelse, plattformPunkter, type PlattformType } from './bygg';
import { BYGGTYPE_IDS } from './risiko';

const svg = (child: ReactNode) => renderToStaticMarkup(createElement('svg', null, child));
const UGYLDIG = /NaN|Infinity|undefined/;

describe('BYGNING_MAAL', () => {
  it('har mål for alle typene, med utstrekning som rommer veggene', () => {
    expect(new Set(BYGNING_TYPER).size).toBe(BYGNING_TYPER.length);
    expect(Object.keys(BYGNING_MAAL).sort()).toEqual([...BYGNING_TYPER].sort());
    for (const t of BYGNING_TYPER) {
      const m = BYGNING_MAAL[t];
      expect(m.bredde).toBeGreaterThan(0);
      expect(m.hoyde).toBeGreaterThan(0);
      expect(m.venstre).toBeLessThanOrEqual(-m.bredde / 2);
      expect(m.hoyre).toBeGreaterThanOrEqual(m.bredde / 2);
      expect(m.navn[0]).toBe(m.navn[0]!.toUpperCase());
    }
  });

  it('dekker alle byggtypene i risiko.ts (sikkerhetsklassene)', () => {
    const dekket = new Set(BYGNING_TYPER.map((t) => BYGNING_MAAL[t].byggtype).filter((b) => b !== null));
    for (const id of BYGGTYPE_IDS) expect(dekket.has(id)).toBe(true);
    // Typene med samme navn som byggtypen peker på den
    for (const id of BYGGTYPE_IDS) if ((BYGNING_TYPER as readonly string[]).includes(id)) expect(BYGNING_MAAL[id as 'bolig'].byggtype).toBe(id);
  });

  it('har omtrent riktige proporsjoner (et bolighus er høyere enn en garasje og lavere enn en boligblokk)', () => {
    expect(BYGNING_MAAL.bolig.hoyde).toBeGreaterThan(BYGNING_MAAL.garasje.hoyde);
    expect(BYGNING_MAAL.boligblokk.hoyde).toBeGreaterThan(BYGNING_MAAL.bolig.hoyde);
    expect(BYGNING_MAAL.sykehjem.bredde).toBeGreaterThan(BYGNING_MAAL.bolig.bredde * 3);
  });
});

describe('bygningStorrelse', () => {
  it('skalerer målene med pxPerM', () => {
    const s = bygningStorrelse('bolig', 10);
    expect(s.bredde).toBeCloseTo(85, 9);
    expect(s.hoyde).toBeCloseTo(BYGNING_MAAL.bolig.hoyde * 10, 9);
    expect(s.venstre).toBeLessThan(0);
    expect(s.hoyre).toBeGreaterThan(0);
  });

  it('gir 0 for ugyldig skala', () => {
    for (const p of [Number.NaN, -1, 0, Number.POSITIVE_INFINITY]) {
      const s = bygningStorrelse('skole', p);
      expect([s.bredde, s.hoyde, s.venstre, s.hoyre].every((v) => v === 0)).toBe(true);
    }
  });
});

describe('plattformPunkter', () => {
  const base = { x: 400, y: 100, havbunn: 300, size: 120 };

  it('legger dekket over havet, boretårnet over dekket og brønnene fra havbunnen', () => {
    const p = plattformPunkter({ ...base, bronner: [{ bunn: 500 }, { bunn: 520, til: 600 }] });
    expect(p.dekk.y).toBeLessThan(100);
    expect(p.boretaarn.y).toBeLessThan(p.dekk.y);
    expect(p.havbunn.y).toBe(300);
    expect(p.bronner).toHaveLength(2);
    expect(p.bronner[0]![0]![1]).toBe(300);
    expect(p.bunn[0]!.y).toBeCloseTo(500, 9);
    expect(p.bunn[1]).toEqual({ x: 600, y: 520 });
    // Avviksbrønnen går loddrett ut fra knekken og ender nesten vannrett
    const b = p.bronner[1]!;
    const sist = b[b.length - 1]!;
    const nest = b[b.length - 2]!;
    expect(Math.abs(sist[1] - nest[1])).toBeLessThan(Math.abs(sist[0] - nest[0]));
  });

  it('dropper brønner som ikke når under havbunnen, og speilvender med flip', () => {
    const p = plattformPunkter({ ...base, bronner: [{ bunn: 200 }, { bunn: Number.NaN }] });
    expect(p.bronner).toHaveLength(0);
    const v = plattformPunkter({ ...base, flip: true });
    expect(v.boretaarn.x).toBeLessThan(400);
    expect(v.fakkel.x).toBeGreaterThan(400);
  });

  it('gir endelige tall for ugyldige verdier', () => {
    const p = plattformPunkter({ x: Number.NaN, y: Number.NaN, havbunn: Number.NaN, size: Number.NaN, bronner: { bunn: 1e9, til: Number.NaN, knekk: Number.NaN } });
    const tall = [p.dekk.x, p.dekk.y, p.boretaarn.x, p.boretaarn.y, p.havbunn.x, p.havbunn.y, p.fakkel.x, p.fakkel.y, ...p.bronner.flat(2), ...p.bunn.flatMap((q) => [q.x, q.y])];
    for (const v of tall) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('komponentene', () => {
  it('tegner alle bygningstypene i stor og liten skala, med alle valg, uten NaN', () => {
    for (const type of BYGNING_TYPER) {
      for (const pxPerM of [0.8, 4, 12]) {
        const ut = svg(createElement(Bygning, { x: 200, y: 300, type, pxPerM, sno: true, flip: pxPerM > 5, skilt: 'Vannverk' }));
        expect(ut).not.toMatch(UGYLDIG);
        expect(ut.length).toBeGreaterThan(200);
      }
    }
    expect(svg(createElement(Bygning, { x: 0, y: 0, pxPerM: Number.NaN }))).not.toMatch(UGYLDIG);
    expect(svg(createElement(Bygning, { x: Number.NaN, y: 0 }))).toBe('<svg></svg>');
  });

  it('tegner alle plattformtypene med brønner og fakkel uten NaN', () => {
    for (const type of Object.keys(PLATTFORM_NAVN) as PlattformType[]) {
      const ut = svg(createElement(Plattform, { x: 300, y: 100, havbunn: 260, type, size: 120, fakkel: true, flip: type === 'betong', bronner: [{ bunn: 400, til: 500 }, { bunn: 380 }] }));
      expect(ut).not.toMatch(UGYLDIG);
      const grunt = svg(createElement(Plattform, { x: 300, y: 100, havbunn: 90, type, size: Number.NaN }));
      expect(grunt).not.toMatch(UGYLDIG);
    }
    expect(svg(createElement(Plattform, { x: Number.NaN, y: 0, havbunn: 10 }))).toBe('<svg></svg>');
  });
});
