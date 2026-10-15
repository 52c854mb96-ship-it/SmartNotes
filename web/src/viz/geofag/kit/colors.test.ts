import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mix } from '../../kit/scene/core';
import { GEO, MAGMA_GLOD, MAGMA_GLOD_STOPP, bergartFarge, fareFarge, gehaltFarge, hoydelagFarge, tidFarge, type GeoPaint } from './colors';
import { deltaE, hex, kontrast, type Tema } from './testfarger';
import { geoHoyde } from './felles';
import { MONSTER_IDS } from './typer';

// Vitest gjør CSS-importer om til tomme strenger (også ?raw), så fila leses direkte
const css = readFileSync(new URL('./geofag.css', import.meta.url), 'utf8');

/** Variablene i én blokk som `{ navn: verdi }`. */
function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--geo-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

function blokk(start: string): string {
  const i = css.indexOf(start);
  expect(i, `fant ikke «${start}» i geofag.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', i + start.length - 1);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

/** Alle `var(--geo-…)` som GEO bruker (rekursivt). */
function brukte(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') for (const m of v.matchAll(/var\((--geo-[a-z0-9-]+)\)/g)) out.add(m[1]!);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) brukte(x, out);
  return out;
}

const lys = vars(blokk(':root {'));
const morkSystem = vars(blokk(":root:not([data-theme='light']) {"));
const morkValgt = vars(blokk(":root[data-theme='dark'] {"));

describe('geofag.css', () => {
  it('har de samme variablene i lyst og mørkt tema, og like verdier i begge mørke blokkene', () => {
    expect(Object.keys(morkSystem).sort()).toEqual(Object.keys(lys).sort());
    expect(morkValgt).toEqual(morkSystem);
  });

  it('definerer hver farge GEO bruker', () => {
    const mangler = [...brukte(GEO)].filter((n) => !(n in lys));
    expect(mangler).toEqual([]);
    expect(brukte(GEO).size).toBe(Object.keys(lys).length);
  });

  it('bruker bare hex-farger (ingen VIZ-farger på bergarter og landskap)', () => {
    for (const [n, v] of [...Object.entries(lys), ...Object.entries(morkSystem)]) {
      expect(v, n).toMatch(/^#[0-9a-f]{6}$/);
      // VIZ.gravity og rustaksenten i «Fjell» skal ikke brukes rett
      expect(['#d4622a', '#f08a55', '#8f4b2e', '#e09a72'], n).not.toContain(v);
    }
  });

  it('skiller magma og lava tydelig fra G-pila og aksenten', () => {
    const avstand = (a: string, b: string) => {
      const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const [x, y] = [c(a), c(b)];
      return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
    };
    for (const n of ['--geo-magma', '--geo-lava']) {
      expect(avstand(lys[n]!, '#d4622a'), n).toBeGreaterThan(60);
      expect(avstand(lys[n]!, '#8f4b2e'), n).toBeGreaterThan(60);
      expect(avstand(morkSystem[n]!, '#f08a55'), n).toBeGreaterThan(60);
      expect(avstand(morkSystem[n]!, '#e09a72'), n).toBeGreaterThan(60);
    }
  });
});

describe('GEO', () => {
  it('har fyll og kant for hver bergart', () => {
    for (const id of MONSTER_IDS) {
      const p: GeoPaint = bergartFarge(id);
      expect(p.fill).toBe(`var(--geo-rock-${id})`);
      expect(p.line).toBe(`var(--geo-rock-${id}-line)`);
    }
    expect(Object.keys(GEO.bergart).sort()).toEqual([...MONSTER_IDS].sort());
  });

  it('har skalaer med riktig lengde', () => {
    expect(GEO.hoydelag).toHaveLength(6);
    expect(GEO.gehalt).toHaveLength(5);
    expect(GEO.fare).toHaveLength(4);
  });

  it('velger trinn i skalaene og tåler ugyldige tall', () => {
    expect(gehaltFarge(0)).toBe(GEO.gehalt[0]);
    expect(gehaltFarge(1)).toBe(GEO.gehalt[4]);
    expect(gehaltFarge(0.5)).toBe(GEO.gehalt[2]);
    expect(gehaltFarge(Number.NaN)).toBe(GEO.gehalt[0]);
    expect(fareFarge(2.4)).toBe(GEO.fare[2]);
    expect(fareFarge(9)).toBe(GEO.fare[3]);
    expect(fareFarge(Number.NEGATIVE_INFINITY)).toBe(GEO.fare[0]);
    expect(hoydelagFarge(1200, 0, 1200)).toBe(GEO.hoydelag[5]);
    expect(hoydelagFarge(100, 0, 1200)).toBe(GEO.hoydelag[0]);
    expect(hoydelagFarge(100, 500, 500)).toBe(GEO.hoydelag[0]);
    expect(tidFarge('devon')).toBe('var(--geo-tid-devon)');
    expect(tidFarge('finnes-ikke')).toBe('var(--viz-body)');
  });
});

describe('geoHoyde', () => {
  it('gir H + 260 · (f − 1) og tåler ugyldige tall', () => {
    expect(geoHoyde(1, 320)).toBe(320);
    expect(geoHoyde(1.8, 320)).toBe(528);
    expect(geoHoyde(0.5, 320)).toBe(320);
    expect(geoHoyde(Number.NaN, 320)).toBe(320);
    expect(geoHoyde(2, Number.POSITIVE_INFINITY)).toBe(260);
  });
});

describe('fargene skiller seg der de brukes sammen', () => {
  const g = (navn: string) => `var(--geo-${navn})`;
  const skilles = (a: string, b: string, tema: Tema) => kontrast(a, b, tema) >= 1.25 || deltaE(a, b, tema) >= 12;

  it('sedimentlag som ofte ligger oppå hverandre, skilles i mørkt tema', () => {
    const grupper = [
      ['sandstein', 'siltstein', 'leirskifer', 'kalkstein', 'konglomerat', 'kvartsitt'],
      ['sand', 'grus', 'leire', 'morene', 'silt', 'breelv', 'kvikkleire'],
    ];
    for (const gr of grupper)
      for (let i = 0; i < gr.length; i++)
        for (let j = i + 1; j < gr.length; j++) {
          const [a, b] = [g(`rock-${gr[i]}`), g(`rock-${gr[j]}`)];
          expect(skilles(a, b, 'mork'), `${gr[i]} / ${gr[j]}: ${hex(a, 'mork')} ${hex(b, 'mork')}`).toBe(true);
        }
  });

  it('har synlige polaritetsstriper i begge temaer (normal sterk, omvendt lys, ikke invertert)', () => {
    const [n, o] = [GEO.polaritet.normal, GEO.polaritet.omvendt];
    for (const tema of ['lys', 'mork'] as Tema[]) {
      expect(kontrast(n.fill, o.fill, tema), tema).toBeGreaterThanOrEqual(1.8);
      // Omvendt er den lyse i begge temaer
      expect(kontrast(o.fill, '#000000', tema)).toBeGreaterThan(kontrast(n.fill, '#000000', tema));
    }
    expect(kontrast(n.fill, '#1f2225', 'mork')).toBeGreaterThanOrEqual(1.8);
    expect(kontrast(o.fill, '#1f2225', 'mork')).toBeGreaterThanOrEqual(1.8);
    // I lyst tema er omvendt nesten hvit; kanten må synes mot en hvit flate
    expect(kontrast(o.line, '#ffffff', 'lys')).toBeGreaterThanOrEqual(3);
  });

  it('har høydelag der nabolagene skilles i mørkt tema', () => {
    for (let i = 1; i < GEO.hoydelag.length; i++) {
      expect(kontrast(GEO.hoydelag[i]!, GEO.hoydelag[i - 1]!, 'mork'), `høydelag ${i - 1}–${i}`).toBeGreaterThanOrEqual(1.2);
      // Kotene synes på alle lagene
      expect(kontrast(GEO.kote, GEO.hoydelag[i]!, 'mork')).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('holder magmaen slik den faktisk tegnes (kanaler, kamre, krater) unna G-pila og aksenten', () => {
    const brukt = [GEO.magma.fill, MAGMA_GLOD.kjerne, MAGMA_GLOD.midt, MAGMA_GLOD.kanal, ...MAGMA_GLOD_STOPP.map((s) => s[1]), mix(GEO.lava.fill, GEO.magma.fill, 0.12), GEO.lava.fill];
    for (const tema of ['lys', 'mork'] as Tema[])
      for (const c of brukt) {
        expect(deltaE(c, 'var(--viz-gravity)', tema), `${hex(c, tema)} mot G (${tema})`).toBeGreaterThan(20);
        const aksent = tema === 'lys' ? '#8f4b2e' : '#e09a72';
        expect(deltaE(c, aksent, tema), `${hex(c, tema)} mot aksenten (${tema})`).toBeGreaterThan(20);
      }
  });

  it('skiller avrenning fra nedbør og fra VIZ.velocity, og CO₂ og luft fra grunnvann', () => {
    for (const tema of ['lys', 'mork'] as Tema[]) {
      expect(deltaE(GEO.avrenning, GEO.nedbor, tema), tema).toBeGreaterThan(20);
      expect(deltaE(GEO.avrenning, 'var(--viz-velocity)', tema), tema).toBeGreaterThan(30);
      expect(kontrast(GEO.co2.fill, GEO.grunnvann.fill, tema), tema).toBeGreaterThanOrEqual(1.4);
      expect(kontrast(GEO.luft.fill, GEO.grunnvann.fill, tema), tema).toBeGreaterThanOrEqual(1.5);
      expect(deltaE(GEO.nitrat.fill, GEO.olje.fill, tema), tema).toBeGreaterThan(12);
    }
    expect(kontrast(GEO.gehalt[0], '#1f2225', 'mork')).toBeGreaterThanOrEqual(1.5);
  });
});
