import { describe, expect, it } from 'vitest';
import {
  COM_HEIGHT,
  arrowHitsBox,
  GPAR_MIN,
  G_ARROW_M,
  SPEED_ARROW_LIFT,
  barHeight,
  boxesOverlap,
  cameraX,
  facing,
  framePoint,
  gparVisible,
  riderFrame,
  sceneForces,
  sceneLayout,
  segmentHitsBox,
  shownState,
  speedArrow,
  speedLabelPlace,
  textBox,
  textWidth,
  viewLayout,
} from './energibevaring-scene';
import { TRACK_TOP, makeTrack, simulateTrack } from './model';

const KINDS = ['rampe', 'bakke'] as const;
const G = 9.81;

describe('utformingen av scenen', () => {
  for (const kind of KINDS)
    for (const narrow of [false, true]) {
      const L = sceneLayout(kind, narrow);
      const tr = makeTrack(kind);
      const name = `${kind}, ${narrow ? 'mobil' : 'PC'}`;

      it(`${name}: samme skala vannrett og loddrett, og hele banen innenfor scenen (akebakken: innenfor verden)`, () => {
        expect(L.X(1) - L.X(0)).toBeCloseTo(L.ppm, 9);
        expect(L.Y(0) - L.Y(1)).toBeCloseTo(L.ppm, 9);
        expect(L.X(tr.xMin)).toBeGreaterThanOrEqual(0);
        if (kind === 'rampe') {
          expect(L.X(tr.xMax)).toBeLessThanOrEqual(L.freeRight);
          expect(L.worldW).toBeCloseTo(L.viewW, 6);
        } else {
          expect(L.X(tr.xMax)).toBeLessThanOrEqual(L.worldW);
          expect(L.worldW).toBeGreaterThan(2 * L.viewW);
        }
        // Rekkverket (1 m over plattformen) og toppene får plass
        expect(L.Y(TRACK_TOP + 1)).toBeGreaterThan(0);
        expect(L.sceneH).toBeGreaterThan(L.Y(0) + 30);
        expect(L.H).toBeGreaterThanOrEqual(L.sceneH);
        expect(L.groundY).toBeGreaterThanOrEqual(L.Y(0));
        expect(L.horizon).toBeLessThan(L.groundY);
      });

      it(`${name}: stolpene får plass i kortet, og den høyeste starthøyden når ikke over kortet`, () => {
        const B = L.bars;
        const c = B.card;
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(L.W);
        expect(c.y + c.h).toBeLessThanOrEqual(L.H);
        expect(B.base).toBeLessThan(c.y + c.h);
        const m = 100;
        // E₀ for h₀ = 5,5 m står under overskriften i kortet (og tallet over stolpen får plass)
        expect(B.base - barHeight(B, m * G * 5.5, m, G)).toBeGreaterThan(c.y + 40);
        if (narrow) expect(c.y).toBeGreaterThanOrEqual(L.sceneH);
        else expect(c.x).toBeGreaterThan(L.freeRight);
      });

      it(`${name}: fartspila og etiketten holder seg inne i scenen for alle posisjoner med h₀ = 5,5 m (også løftet)`, () => {
        const f = narrow ? 1.84 : 1;
        for (let x = tr.xMin; x <= tr.xMax; x += 0.05) {
          const h = tr.height(x);
          if (h > 5.5) continue;
          const v = Math.sqrt(2 * G * (5.5 - h));
          for (const [sv, lift] of [
            [1, 0],
            [-1, 0],
            [1, SPEED_ARROW_LIFT],
            [-1, SPEED_ARROW_LIFT],
          ] as const) {
            const V = viewLayout(L, cameraX(L, x, sv * v, tr.slope(x)));
            const fr = riderFrame(tr, V, x);
            const a = speedArrow(fr, kind, L.ppm, sv * v, lift);
            expect(a.x2).toBeGreaterThan(0);
            expect(a.x2).toBeLessThan(L.freeRight);
            expect(a.y2).toBeGreaterThan(0);
            expect(a.y2).toBeLessThan(L.sceneH - 4);
            const text = `v = ${v.toFixed(1)} m/s`;
            const lab = speedLabelPlace({ ...a, text, f, right: L.freeRight, top: 0, bottom: L.sceneH - 8 });
            const w = textWidth(text, 0.9, f);
            const left = lab.anchor === 'start' ? lab.x : lab.x - w;
            expect(left).toBeGreaterThanOrEqual(5.9);
            expect(left + w).toBeLessThanOrEqual(L.freeRight + 0.1);
            expect(lab.y).toBeLessThanOrEqual(L.sceneH - 8);
          }
        }
      });
    }

  it('på PC har E_p-stolpen samme høyde som brettet står over nullnivået, og E₀ ligger på linja for h₀', () => {
    for (const kind of KINDS) {
      const L = sceneLayout(kind, false);
      expect(L.bars.beside).toBe(true);
      expect(L.bars.base).toBeCloseTo(L.Y(0), 9);
      for (const [m, h] of [
        [20, 0.5],
        [50, 2.15],
        [100, 5.5],
      ] as const)
        expect(L.bars.base - barHeight(L.bars, m * G * h, m, G)).toBeCloseTo(L.Y(h), 9);
    }
  });

  it('tallene som vises, går opp: hver linje i utregningen regnet av tallene som står der', () => {
    // Uten friksjon: E = E₀, E_p av h med to desimaler, E_k = E − E_p
    const a = shownState({ h: 2.4986, d: 20, m: 50, E0: 50 * G * 4, mu: 0 });
    expect(a.h).toBe(2.5);
    expect(a.Ep).toBe(1226); // 50 · 9,81 · 2,50 = 1 226,25, samme som mg · 2,5 m i forklaringen
    expect(a.E).toBe(1962);
    expect(a.Ek).toBe(736);
    expect(a.Epint + a.Ekint).toBe(a.Eint);
    expect(a.fromEnergy).toBe(false);
    expect(a.v).toBeCloseTo(Math.sqrt((2 * 736) / 50), 12);
    // Med friksjon: W_R av s med to desimaler, E = E₀ + W_R med én desimal (E₀ = 490,5 J, som før ga 491 − 471 = 19)
    const b = shownState({ h: 0, d: 40.0349, m: 20, E0: 490.5, mu: 0.06 });
    expect(b.s).toBe(40.03);
    expect(b.heat).toBe(471.2);
    expect(b.E).toBe(19.3);
    expect(b.Eint).toBe(19);
    // I ro med friksjon: E_k = 0 og E_p = E, og h regnes av energien (ellers kunne avrundingen gitt E_p = 2 J og E = 1 J)
    const c = shownState({ h: 0.0072, d: 41.553, m: 20, E0: 490.5, mu: 0.06, still: true });
    expect(c.fromEnergy).toBe(true);
    expect(c.E).toBe(1.4);
    expect(c.Ep).toBe(1.4);
    expect(c.Ek).toBe(0);
    expect(c.v).toBe(0);
    expect(c.Epint).toBe(c.Eint);
    expect(c.h).toBe(0.01);
    // Like ved et vendepunkt (ikke helt i ro) der avrundingen av h ville gitt E_p > E: også da E_k = 0 og h av energien
    const t = shownState({ h: 2.126, d: 31.23, m: 50, E0: 50 * G * 4, mu: 0.06 });
    expect(t.fromEnergy).toBe(true);
    expect(t.Ep).toBe(t.E);
    expect(t.Epint).toBe(t.Eint);
    // Uten friksjon er h i ro alltid h₀ (start og vendepunkter), så der brukes E_p = mgh som ellers
    expect(shownState({ h: 3.9996, d: 30, m: 50, E0: 50 * G * 4, mu: 0, still: true }).fromEnergy).toBe(false);
    for (let i = 0; i < 400; i++) {
      const m = 20 + (i % 81);
      const h0 = 0.5 + ((i * 7) % 51) / 10;
      const h = (h0 * ((i * 13) % 100)) / 100;
      const mu = i % 2 ? 0.06 : 0;
      const E0 = m * G * h0;
      // Fysisk mulig: friksjonen har ikke tatt mer enn det som er over E_p nå
      const d = mu ? ((((i * 31) % 100) / 100) * (E0 - m * G * h)) / (mu * m * G) : ((i * 31) % 900) / 10;
      const S = shownState({ h, d, m, E0, mu });
      expect(S.Ep).toBe(Math.round(m * G * S.h));
      expect(Math.abs(S.Ep - m * G * h)).toBeLessThanOrEqual(m * G * 0.005 + 0.5);
      if (mu) expect(S.E).toBeCloseTo(Math.round(E0 * 10) / 10 - S.heat, 9);
      else expect(S.E).toBe(Math.round(E0));
      expect(S.Ep + S.Ek).toBeCloseTo(S.E, 9);
      expect(S.Epint + S.Ekint).toBe(S.Eint);
      expect(S.Ek).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(S.v)).toBe(true);
    }
  });

  it('stolpehøyden er aldri negativ eller NaN', () => {
    const B = sceneLayout('rampe', true).bars;
    expect(barHeight(B, -5, 50, G)).toBe(0);
    expect(barHeight(B, 100, 0, G)).toBe(0);
    expect(barHeight(B, Number.NaN, 50, G)).toBe(0);
  });

  it('personene blir større på mobil, men skalaen er lik i begge retninger', () => {
    for (const kind of KINDS) expect(sceneLayout(kind, true).ppm).toBeGreaterThan(sceneLayout(kind, false).ppm);
  });
});

describe('kameraet i akebakken', () => {
  it('står stille i halfpipen', () => {
    const L = sceneLayout('rampe', true);
    for (const x of [0, 3, 6, 12]) expect(cameraX(L, x, 5, 0.3)).toBe(0);
  });

  for (const narrow of [false, true])
    it(`${narrow ? 'mobil' : 'PC'}: følger akebrettet jevnt, holder det godt inne i utsnittet og går aldri utenfor verden`, () => {
      const L = sceneLayout('bakke', narrow);
      const tr = makeTrack('bakke');
      for (const [h0, mu] of [
        [5.5, 0],
        [4, 0.06],
        [2, 0],
      ] as const) {
        const sim = simulateTrack({ track: tr, h0, m: 50, mu, tMax: 40 });
        let prev: number | null = null;
        for (const s of sim.samples) {
          const cam = cameraX(L, s.x, s.v, tr.slope(s.x));
          expect(cam).toBeGreaterThanOrEqual(0);
          expect(cam).toBeLessThanOrEqual(L.worldW - L.viewW + 1e-9);
          const xv = L.X(s.x) - cam;
          // Personen står mellom 25 % og 75 % av utsnittet (eller nærmere kanten bare helt ute ved toppene)
          const atEnd = cam < 1e-9 || cam > L.worldW - L.viewW - 1e-9;
          if (!atEnd) {
            expect(xv).toBeGreaterThan(0.25 * L.viewW);
            expect(xv).toBeLessThan(0.75 * L.viewW);
          }
          expect(xv).toBeGreaterThan(0.6 * L.ppm);
          expect(xv).toBeLessThan(L.viewW - 0.6 * L.ppm);
          // Ingen hopp: høyst ca. 12 m/s · 0,02 s pluss litt for at kameraet ser framover
          if (prev !== null) expect(Math.abs(cam - prev)).toBeLessThan(0.6 * L.ppm);
          prev = cam;
        }
      }
    });

  it('ser nedover bakken når akebrettet står i ro i starten, så kulen kommer inn i bildet', () => {
    const L = sceneLayout('bakke', false);
    const tr = makeTrack('bakke');
    const x = 4.27; // h₀ ≈ 4 m
    const cam = cameraX(L, x, 0, tr.slope(x));
    expect(L.X(x) - cam).toBeLessThan(0.36 * L.viewW);
  });
});

describe('personen på banen', () => {
  it('rammen har enhetsvektorer der normalen står vinkelrett på tangenten og peker opp', () => {
    for (const kind of KINDS) {
      const tr = makeTrack(kind);
      const L = sceneLayout(kind, false);
      for (let x = tr.xMin; x <= tr.xMax; x += 0.37) {
        const fr = riderFrame(tr, L, x);
        expect(Math.hypot(fr.tx, fr.ty)).toBeCloseTo(1, 12);
        expect(Math.hypot(fr.nx, fr.ny)).toBeCloseTo(1, 12);
        expect(fr.tx * fr.nx + fr.ty * fr.ny).toBeCloseTo(0, 12);
        expect(fr.ny).toBeLessThan(0);
        expect(fr.x).toBeCloseTo(L.X(x), 9);
        expect(fr.y).toBeCloseTo(L.Y(tr.height(x)), 9);
        // Dreiningen følger tangenten (grader med klokka i SVG)
        expect(Math.tan((fr.rotate * Math.PI) / 180)).toBeCloseTo(fr.ty / fr.tx, 9);
      }
      // På bunnen er brettet vannrett, og et punkt 1 m ut fra banen står rett over
      const bottom = riderFrame(tr, L, tr.xBottom);
      expect(bottom.rotate).toBeCloseTo(0, 9);
      const up = framePoint(bottom, 0, L.ppm);
      expect(up.x).toBeCloseTo(bottom.x, 9);
      expect(up.y).toBeCloseTo(L.Y(1), 9);
    }
  });

  it('skateren ser i fartsretningen, og i ro dit tyngden vil dra den', () => {
    expect(facing(3, 0)).toBe(1);
    expect(facing(-3, 0)).toBe(-1);
    // I ro på venstre vegg (banen stiger mot venstre, h′ < 0): ruller mot høyre
    expect(facing(0, -1.2)).toBe(1);
    expect(facing(0, 1.2)).toBe(-1);
    expect(facing(0, 0)).toBe(1);
  });

  it('fartspila er proporsjonal med farten og peker langs banen', () => {
    const tr = makeTrack('rampe');
    const L = sceneLayout('rampe', false);
    const fr = riderFrame(tr, L, 3);
    const a = speedArrow(fr, 'rampe', L.ppm, 4);
    const b = speedArrow(fr, 'rampe', L.ppm, 8);
    const len = (q: typeof a) => Math.hypot(q.x2 - q.x1, q.y2 - q.y1);
    expect(len(b) / len(a)).toBeCloseTo(2, 9);
    expect(((a.x2 - a.x1) * fr.ty - (a.y2 - a.y1) * fr.tx) / len(a)).toBeCloseTo(0, 9);
    const back = speedArrow(fr, 'rampe', L.ppm, -4);
    expect(Math.sign(back.x2 - back.x1)).toBe(-1);
    expect(len(speedArrow(fr, 'rampe', L.ppm, 0))).toBe(0);
  });

  it('simuleringen holder personen innenfor den delen av verden som tegnes', () => {
    for (const kind of KINDS)
      for (const narrow of [false, true]) {
        const L = sceneLayout(kind, narrow);
        const sim = simulateTrack({ track: makeTrack(kind), h0: 5.5, m: 50, mu: 0, tMax: 30 });
        for (const s of sim.samples) {
          expect(s.x).toBeGreaterThan(L.xLeft + 0.5);
          expect(s.x).toBeLessThan(L.xRight - 0.5);
        }
      }
  });
});

describe('kreftene', () => {
  it('G er loddrett og like lang for alle masser, og G∥ er komponenten av G langs banen', () => {
    for (const kind of KINDS) {
      const tr = makeTrack(kind);
      for (const narrow of [false, true]) {
        const L = sceneLayout(kind, narrow);
        for (const m of [20, 50, 100])
          for (let x = tr.xMin + 0.05; x < tr.xMax; x += 0.41) {
            const fr = riderFrame(tr, L, x);
            const F = sceneForces(fr, kind, L.ppm, m, G, 3, 0);
            // Én skala for alle kreftene: k px/N, og G blir G_ARROW_M meter lang
            expect(F.k * m * G).toBeCloseTo(G_ARROW_M[kind] * L.ppm, 9);
            expect(F.G.x2).toBeCloseTo(F.G.x1, 9);
            expect(F.G.y2 - F.G.y1).toBeCloseTo(G_ARROW_M[kind] * L.ppm, 9);
            // Angrepspunktet er tyngdepunktet over brettet
            const com = framePoint(fr, 0, COM_HEIGHT[kind] * L.ppm);
            expect(F.com.x).toBeCloseTo(com.x, 9);
            expect(F.com.y).toBeCloseTo(com.y, 9);
            // G∥ = G · sin θ, med fortegn ned bakken (−mg · h′/√(1 + h′²))
            const k = tr.slope(x);
            const sin = k / Math.sqrt(1 + k * k);
            expect(F.GparN).toBeCloseTo(-m * G * sin, 9);
            expect(!!F.Gpar).toBe(gparVisible(kind, L.ppm, k));
            if (!F.Gpar) {
              expect(Math.abs(F.GparN) * F.k).toBeLessThan(GPAR_MIN);
              continue;
            }
            expect(Math.hypot(F.Gpar.x2 - F.Gpar.x1, F.Gpar.y2 - F.Gpar.y1)).toBeGreaterThanOrEqual(GPAR_MIN - 1e-9);
            const px = F.Gpar.x2 - F.Gpar.x1;
            const py = F.Gpar.y2 - F.Gpar.y1;
            expect(Math.hypot(px, py)).toBeCloseTo(m * G * Math.abs(sin) * F.k, 9);
            // Langs banen, og resten av G (G⊥) står vinkelrett på banen
            expect(px * fr.ty - py * fr.tx).toBeCloseTo(0, 9);
            const gx = F.G.x2 - F.G.x1 - px;
            const gy = F.G.y2 - F.G.y1 - py;
            expect(gx * fr.tx + gy * fr.ty).toBeCloseTo(0, 6);
            // Ned bakken: høyden minker i retning G∥
            expect(tr.height(x + (Math.sign(px) * 0.01) / L.ppm)).toBeLessThan(tr.height(x) + 1e-12);
          }
      }
    }
  });

  it('R peker mot farten, er like stor som friksjonen i samme skala, og mangler i ro eller uten friksjon', () => {
    const tr = makeTrack('rampe');
    const L = sceneLayout('rampe', false);
    const fr = riderFrame(tr, L, 3);
    const m = 50;
    const R = 0.06 * m * G;
    for (const v of [4, -4]) {
      const F = sceneForces(fr, 'rampe', L.ppm, m, G, v, R);
      expect(F.R).not.toBeNull();
      const rx = F.R!.x2 - F.R!.x1;
      const ry = F.R!.y2 - F.R!.y1;
      expect(Math.hypot(rx, ry)).toBeCloseTo(R * F.k, 9);
      // Motsatt av fartsretningen (v > 0 er mot høyre langs banen)
      expect(Math.sign(rx * fr.tx + ry * fr.ty)).toBe(-Math.sign(v));
    }
    expect(sceneForces(fr, 'rampe', L.ppm, m, G, 0, R).R).toBeNull();
    expect(sceneForces(fr, 'rampe', L.ppm, m, G, 4, 0).R).toBeNull();
  });

  it('G-pila holder seg inne i scenen i bunnen av banen', () => {
    for (const kind of KINDS)
      for (const narrow of [false, true]) {
        const L = sceneLayout(kind, narrow);
        const tr = makeTrack(kind);
        const F = sceneForces(riderFrame(tr, L, tr.xBottom), kind, L.ppm, 100, G, 0, 0);
        expect(F.G.y2).toBeLessThan(L.sceneH - 8);
      }
  });
});

describe('plassering av etiketter', () => {
  it('tekstboksen følger ankeret, og bokser som bare berører hverandre, overlapper ikke', () => {
    const a = textBox(100, 50, 60, 'start', 1, 1);
    expect(a.x0).toBeLessThan(100);
    expect(a.x1).toBeGreaterThan(160);
    expect(a.y0).toBeLessThan(50);
    const m = textBox(100, 50, 60, 'middle', 1, 1);
    expect((m.x0 + m.x1) / 2).toBeCloseTo(100, 9);
    const e = textBox(100, 50, 60, 'end', 1, 1);
    expect(e.x1).toBeGreaterThan(100);
    expect(e.x1).toBeLessThan(106);
    expect(boxesOverlap(a, m)).toBe(true);
    expect(boxesOverlap({ x0: 0, x1: 10, y0: 0, y1: 10 }, { x0: 10, x1: 20, y0: 0, y1: 10 })).toBe(false);
    // Større tekst på mobil gir høyere boks
    expect(textBox(0, 0, 10, 'start', 1, 1.84).y0).toBeLessThan(a.y0 - 50);
  });

  it('en pil treffer en boks ved siden av spissen (spissen er bredere enn skaftet), men ikke en boks lenger unna', () => {
    // Loddrett pil ned, 100 lang, tykkelse 6: spissen er 2 · 8,7 bred, skaftet 6
    const seg = { x1: 100, y1: 0, x2: 100, y2: 100 };
    const nearHead = { x0: 111, x1: 150, y0: 85, y1: 100 };
    const nearShaft = { x0: 107, x1: 150, y0: 20, y1: 35 };
    expect(arrowHitsBox(seg, nearHead, 6, 1)).toBe(true);
    expect(arrowHitsBox(seg, nearShaft, 6, 1)).toBe(false);
    expect(arrowHitsBox(seg, { ...nearHead, x0: 115 }, 6, 1)).toBe(false);
    // Større strekskala (mobil) gir bredere spiss
    expect(arrowHitsBox(seg, { ...nearHead, x0: 115 }, 6, 1.6)).toBe(true);
    // Under spissen
    expect(arrowHitsBox(seg, { x0: 80, x1: 120, y0: 101, y1: 120 }, 6, 1)).toBe(true);
    expect(arrowHitsBox(seg, { x0: 80, x1: 120, y0: 106, y1: 120 }, 6, 1)).toBe(false);
  });

  it('et linjestykke treffer boksen bare når det går gjennom den', () => {
    const box = { x0: 40, x1: 60, y0: 40, y1: 60 };
    expect(segmentHitsBox({ x: 0, y: 0 }, { x: 100, y: 100 }, box)).toBe(true);
    expect(segmentHitsBox({ x: 0, y: 100 }, { x: 30, y: 70 }, box)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 100 }, { x: 30, y: 70 }, box, 15)).toBe(true);
  });
});
