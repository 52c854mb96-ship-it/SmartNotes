import { describe, expect, it } from 'vitest';
import { grunnvannGeometri } from '../kit/vann';
import { AVSTAND_MAKS_M, AVSTAND_MIN_M, GRADIENT, MATERIAL_VALG, PUMPERATER_LS, bronnstatus } from './model-grunnvann';
import {
  AKER_TIL,
  ELV_X,
  X_MAKS,
  X_MIN,
  bakkeZ,
  bronnPlass,
  fjellZ,
  fjelloverflateZ,
  forbiSti,
  merkeSti,
  oppsett,
  overflatePx,
  overhoyde,
  plasser,
  senkningPx,
  speilPx,
  speilZ,
  sprekker,
  stromlinjer,
  sx,
  sy,
} from './grunnvann-scene';

const OPPSETT = [oppsett(1), oppsett(1.85)];

describe('Terrenget', () => {
  it('bakken ligger over speilet overalt utenom i elva, og fjellet under speilet', () => {
    for (let X = X_MIN; X <= X_MAKS; X += 2) {
      const fraElva = Math.abs(X - ELV_X);
      if (fraElva > 35) expect(bakkeZ(X) - speilZ(X, GRADIENT)).toBeGreaterThan(2);
      else if (fraElva > 26) expect(bakkeZ(X) - speilZ(X, GRADIENT)).toBeGreaterThan(0.3);
      expect(speilZ(X, GRADIENT) - fjellZ(X)).toBeGreaterThan(17);
      expect(fjelloverflateZ(X)).toBeLessThan(bakkeZ(X) - 1.5);
    }
    expect(bakkeZ(ELV_X)).toBeLessThan(speilZ(ELV_X, GRADIENT) - 1);
  });

  it('speilet står over bakken i elva, så Grunnvannssnitt tegner den', () => {
    for (const o of OPPSETT) {
      const g = grunnvannGeometri({ w: o.w, h: o.h, overflate: overflatePx(o), speil: speilPx(o, null, GRADIENT) });
      expect(g.innsjoer).toHaveLength(1);
      const elv = g.innsjoer[0]!;
      expect(elv.fra).toBeGreaterThan(sx(o, 120));
      expect(elv.til).toBeLessThan(sx(o, X_MAKS));
      expect(elv.til - elv.fra).toBeGreaterThan(40);
    }
  });

  it('overhøyden er ca. 7 på PC og ca. 10 på mobil', () => {
    expect(overhoyde(oppsett(1))).toBeGreaterThan(6);
    expect(overhoyde(oppsett(1))).toBeLessThan(8.5);
    expect(overhoyde(oppsett(1.85))).toBeGreaterThan(8);
    expect(overhoyde(oppsett(1.85))).toBeLessThan(12);
  });
});

describe('Senkningstrakten', () => {
  it('full senkning ved brønnen, 0 ved påvirkningsradien og ved elva', () => {
    for (const o of OPPSETT) {
      const b = bronnstatus('sand', 5)!;
      const xb = sx(o, 0);
      expect(senkningPx(o, b, xb)).toBeCloseTo(b.senkning, 10);
      expect(senkningPx(o, b, xb + o.bronnHalv + 1)).toBeLessThan(b.senkning);
      // Trakten starter ved brønnveggen, så den slutter litt utenfor R
      expect(senkningPx(o, b, sx(o, -b.R - 12))).toBe(0);
      expect(senkningPx(o, b, sx(o, ELV_X - 20))).toBe(0);
      expect(senkningPx(o, null, xb)).toBe(0);
    }
  });

  it('trakten i leire er smal, men synes', () => {
    const o = oppsett(1);
    const b = bronnstatus('leire', 5)!;
    const xb = sx(o, 0);
    expect(senkningPx(o, b, xb + o.bronnHalv + 6)).toBeGreaterThan(0.5);
    expect(senkningPx(o, b, xb + o.bronnHalv + 14)).toBe(0);
  });

  it('speilet holder seg inne i snittet og over bunnen for alle valg', () => {
    for (const o of OPPSETT) {
      for (const id of MATERIAL_VALG) {
        for (const q of PUMPERATER_LS) {
          const b = bronnstatus(id, q);
          const sp = speilPx(o, b, GRADIENT);
          for (let x = 0; x <= o.w; x += 7) {
            const y = sp(x);
            expect(Number.isFinite(y)).toBe(true);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(sy(o, fjellZ(sxX(o, x)) + 3));
          }
        }
      }
    }
  });
});

const sxX = (o: ReturnType<typeof oppsett>, x: number) => X_MIN + x / o.px;

describe('Plassene', () => {
  it('huset kommer aldri borti åkeren, og brønnen og vannverket står mellom huset og elva', () => {
    for (const o of OPPSETT) {
      for (let L = AVSTAND_MIN_M; L <= AVSTAND_MAKS_M; L += 10) {
        const p = plasser(o, L);
        expect(p.hus - 4.7 * o.pxBygg).toBeGreaterThan(sx(o, AKER_TIL) + 2);
        expect(p.hus + 4.7 * o.pxBygg).toBeLessThan(p.lekk.x);
        expect(p.lekk.x).toBeLessThan(sx(o, 0) - o.bronnHalv);
        expect(p.vannverk + 13.6 * o.pxBygg).toBeLessThan(sx(o, ELV_X - 20));
        expect(p.lekk.y).toBeGreaterThan(sy(o, bakkeZ(-L)));
      }
    }
  });

  it('etikettene i snittet (PC) får plass mellom vannverket og elva', () => {
    const o = oppsett(1);
    const p = plasser(o, 60);
    const g = grunnvannGeometri({ w: o.w, h: o.h, overflate: overflatePx(o), speil: speilPx(o, bronnstatus('sand', 20), GRADIENT) });
    const elv = g.innsjoer[0]!;
    // «Grunnvannsspeil» (ca. 110 enheter) etter symbolet
    expect(p.etikettX + 4 + 10 + 115).toBeLessThan(elv.fra);
  });

  it('brønnen går ned til bunnen av laget, og filteret ligger under speilet også ved største senkning', () => {
    for (const o of OPPSETT) {
      for (const id of MATERIAL_VALG) {
        const plass = bronnPlass(o, id);
        const b = bronnstatus(id, 20)!;
        const vannstand = speilPx(o, b, GRADIENT)(plass.x);
        expect(plass.bunn).toBeGreaterThan(vannstand + 10);
        if (plass.filter) expect(plass.filter[0]).toBeGreaterThan(vannstand);
        expect(plass.inntak).toBeGreaterThan(vannstand);
        expect(plass.inntak).toBeLessThan(plass.bunn + 0.01);
      }
    }
  });
});

describe('Veiene', () => {
  it('merkene går under speilet fra kilden til inntaket i brønnen', () => {
    for (const o of OPPSETT) {
      for (const id of MATERIAL_VALG) {
        const b = bronnstatus(id, 5);
        const sp = speilPx(o, b, GRADIENT);
        const plass = bronnPlass(o, id);
        for (const L of [AVSTAND_MIN_M, 60, AVSTAND_MAKS_M, 240]) {
          const sti = merkeSti(o, sp, plass, L, 10);
          const start = sti(0);
          const slutt = sti(1);
          expect(start.x).toBeCloseTo(sx(o, -L), 6);
          expect(slutt.x).toBeCloseTo(plass.x - o.bronnHalv, 6);
          expect(Math.abs(slutt.y - plass.inntak)).toBeLessThan(6 * o.k);
          for (let u = 0; u <= 1; u += 0.05) {
            const p = sti(u);
            expect(p.y).toBeGreaterThan(sp(p.x));
          }
        }
        const forbi = forbiSti(o, sp, 10);
        expect(forbi(1).x).toBeCloseTo(sx(o, ELV_X - 4), 6);
        expect(Number.isFinite(forbi(Number.NaN).y)).toBe(true);
      }
    }
  });

  it('strømlinjene og sprekkene er endelige og ligger i snittet', () => {
    for (const o of OPPSETT) {
      const sp = speilPx(o, bronnstatus('sand', 5), GRADIENT);
      for (const linje of stromlinjer(o, sp)) {
        expect(linje.length).toBeGreaterThan(4);
        for (const [x, y] of linje) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(o.w);
          expect(y).toBeGreaterThan(sp(x) - 0.01);
          expect(y).toBeLessThan(o.h);
        }
      }
      const s = sprekker(o);
      expect(s.length).toBeGreaterThan(20);
      expect(sprekker(o)).toEqual(s);
      for (const linje of s) for (const [x, y] of linje) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
  });
});
