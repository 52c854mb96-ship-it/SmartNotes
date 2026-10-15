import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import KotekartOgProfil from './KotekartOgProfil';

/** Ingen NaN, Infinity eller undefined i det som tegnes eller skrives (viz-shot leter etter dem uten ordgrense). */
const feiltall = /NaN|Infinity|undefined/;

let feil: unknown[][] = [];
beforeEach(() => {
  feil = [];
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    feil.push(a);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Kotekart og terrengprofil', () => {
  it('tegnes uten feiltall og uten advarsler, med A og B bare én gang på kartet', () => {
    const html = renderToStaticMarkup(createElement(KotekartOgProfil));
    expect(html).not.toMatch(feiltall);
    expect(feil.map((a) => String(a[0]).slice(0, 80))).toEqual([]);
    // Kit-ets Kotekart tegner A og B (over målestokken); visualiseringen tegner dem ikke en gang til.
    // Profildiagrammet har også A og B, så de står to ganger i alt.
    const bokstav = (b: string) => (html.match(new RegExp(`>${b}</text>`, 'g')) ?? []).length;
    expect(bokstav('A')).toBe(2);
    expect(bokstav('B')).toBe(2);
    // Overhøyden står i bildeteksten under profilet, ikke i plottet (der den kolliderte med A og B)
    expect(html).toContain('Overhøyde 2 ganger: høydene er strukket 2 ganger');
  });
});
