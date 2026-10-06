import { describe, expect, it } from 'vitest';
import {
  COM_HEIGHT,
  RIDER_TOP,
  STEP_COUNT,
  SLED_LENGTH,
  S_DIM_OFFSET,
  angleMark,
  framePoint,
  boxesOverlap,
  figureSpec,
  flatLupeMap,
  riderRing,
  scaleBarForce,
  scaleBarTextW,
  ledgerRows,
  riderBox,
  sceneLayout,
  speedArrow,
  spotFrame,
  tagBox,
  terrainPoints,
  type Box,
  type Spot,
} from './eks-akebakke-scene';
import { SLED_TASKS, solveSledTask } from './model-eks-akebakke';

const STATES = [...Array.from({ length: STEP_COUNT + 1 }, (_, i) => ({ step: i, showAll: false })), { step: STEP_COUNT, showAll: true }];
const SCREENS = [
  { name: 'PC', narrow: false, f: 1, k: 1 },
  { name: 'mobil', narrow: true, f: 1.8, k: 1.53 },
];

describe('figuren steg for steg', () => {
  it('akeren er der deloppgaven handler om', () => {
    expect(figureSpec(1, false).rider).toBe('A');
    expect(figureSpec(2, false).rider).toBe('B');
    expect(figureSpec(4, false).rider).toBe('B');
    expect(figureSpec(5, false).rider).toBe('mid');
    expect(figureSpec(6, false).rider).toBe('flat');
    expect(figureSpec(7, false).rider).toBe('C');
    expect(figureSpec(5, false).slopeForces).toBe('Fmot');
    expect(figureSpec(6, false).flatLupe).toBe(true);
    // I e) kommer friksjonen fra snøen først, og luftmotstanden når den er regnet ut
    expect(figureSpec(8, false).slopeForces).toBe('muN');
    expect(figureSpec(9, false).slopeForces).toBe('split');
    expect(figureSpec(10, false).rider).toBe('Cest');
    expect(figureSpec(0, true).rider).toBe('C');
  });

  it('energipanelet fylles rad for rad og tømmes aldri', () => {
    const level = (step: number) => {
      const l = figureSpec(step, false).ledger;
      if (!l) return 0;
      return (l.A ? 1 : 0) + ['off', 'ideal', 'unknown', 'heat'].indexOf(l.B) + (l.C ? 1 : 0);
    };
    for (let i = 1; i <= STEP_COUNT; i++) expect(level(i)).toBeGreaterThanOrEqual(level(i - 1));
    expect(figureSpec(0, false).ledger).toBeNull();
    expect(figureSpec(0, true).ledger).toEqual({ A: true, B: 'heat', C: true });
  });
});

describe('energipanelet', () => {
  it('alle radene er like lange som E_A i alle tallsettene (energien er bevart)', () => {
    for (const task of SLED_TASKS) {
      const s = solveSledTask(task);
      for (const { step, showAll } of STATES) {
        const ledger = figureSpec(step, showAll).ledger;
        if (!ledger) continue;
        for (const row of ledgerRows(s, ledger)) {
          const sum = row.segments.reduce((a, b) => a + b.E, 0);
          expect(sum).toBeCloseTo(s.EA, 9);
          for (const seg of row.segments) expect(seg.E).toBeGreaterThan(0);
        }
      }
    }
  });

  it('den kinetiske energien i B blir termisk energi på flaten (samme bredde i rad B og C)', () => {
    const s = solveSledTask(SLED_TASKS[0]!);
    const rows = ledgerRows(s, { A: true, B: 'heat', C: true });
    const B = rows.find((r) => r.id === 'B')!;
    const C = rows.find((r) => r.id === 'C')!;
    expect(B.segments[0]).toEqual({ kind: 'Ek', E: s.EkB });
    expect(C.segments[0]).toEqual({ kind: 'heatFlat', E: s.EkB });
    expect(C.segments[1]!.E).toBeCloseTo(B.segments[1]!.E, 12);
  });
});

describe('utformingen av scenen', () => {
  for (const screen of SCREENS) {
    for (const [i, task] of SLED_TASKS.entries()) {
      const s = solveSledTask(task);
      describe(`${screen.name}, tallsett ${i + 1}`, () => {
        for (const { step, showAll } of STATES) {
          const spec = figureSpec(step, showAll);
          const L = sceneLayout(task, s, { narrow: screen.narrow, camera: spec.camera, f: screen.f, k: screen.k });
          const label = showAll ? 'hele løsningen' : `steg ${step}`;
          // Akerne som er i utsnittet (toppen A er utenfor flate-utsnittet)
          const visible: Spot[] = [spec.rider, ...spec.ghosts].filter((p) => !(spec.camera === 'flate' && p === 'A'));
          // Verdiskiltene: farten på toppen, i B og v = 0 der akeren stopper (samme tekst som i figuren)
          const tagText = (p: Spot): string | null =>
            p === 'A' && spec.v0
              ? 'v₀ = 1,5 m/s'
              : p === 'B' && spec.speedB !== 'off'
                ? 'v = 12,2 m/s'
                : p === spec.rider && (p === 'C' || p === 'Cest')
                  ? 'v = 0'
                  : null;

          it(`${label}: skalaen og høydene er fornuftige`, () => {
            expect(L.ppm).toBeGreaterThan(8);
            expect(L.ppm).toBeLessThan(30);
            expect(L.groundY).toBeLessThan(L.H);
            expect(L.H).toBeLessThan(560);
            if (spec.camera !== 'flate') expect(L.topY).toBeGreaterThan(0);
          });

          it(`${label}: akerne og skiltene er inni figuren`, () => {
            for (const p of visible) {
              const b = riderBox(L, spotFrame(L, task, s, p));
              expect(b.x).toBeGreaterThan(-1);
              expect(b.x + b.w).toBeLessThan(L.W + 1);
              expect(b.y).toBeGreaterThan(0);
              const text = tagText(p);
              if (text) {
                const t = tagBox(L, spotFrame(L, task, s, p), text);
                expect(t.y).toBeGreaterThan(0);
                expect(t.x).toBeGreaterThan(-1);
                expect(t.x + t.w).toBeLessThan(L.W + 1);
              }
            }
          });

          if (L.panel) {
            const panel = L.panel;
            it(`${label}: energipanelet dekker ikke akerne, skiltene eller fartspilene`, () => {
              for (const p of visible) {
                const fr = spotFrame(L, task, s, p);
                expect(boxesOverlap(riderBox(L, fr), panel, 4)).toBe(false);
                const text = tagText(p);
                if (text) expect(boxesOverlap(tagBox(L, fr, text), panel, 4)).toBe(false);
              }
              if (spec.speedB !== 'off') {
                const a = speedArrow(L, spotFrame(L, task, s, 'B'), s.vIdeal);
                const arrow: Box = { x: a.x1, y: a.y1 - 12, w: a.x2 - a.x1, h: 24 };
                expect(boxesOverlap(arrow, panel)).toBe(false);
              }
            });
          }

          if (spec.slopeForces !== 'off' || spec.flatForces) {
            it(`${label}: kraftpilene holder seg i bakken (til høyre for A) og inni figuren, og er lange nok til å leses`, () => {
              const fr = spotFrame(L, task, s, spec.rider);
              const e = spec.slopeForces === 'muN' || spec.slopeForces === 'split';
              const k = e ? L.kFe : L.kF;
              const force = spec.flatForces ? s.Rflat : spec.slopeForces === 'Fmot' ? s.Fmot : s.muN;
              // μN begynner bakerst under brettet, de andre i tyngdepunktet
              const start = e ? framePoint(fr, -0.36 * SLED_LENGTH * L.rppm, 0) : framePoint(fr, 0, COM_HEIGHT * L.rppm);
              const tipX = start.x - fr.tx * force * k;
              expect(tipX).toBeGreaterThan(spec.flatForces ? 20 : L.X(0) + 20 * L.f);
              // Lengden står i forhold til kraften (fast skala px/N)
              expect(force * k).toBeGreaterThan(40);
              // Luftmotstanden i e) er en pil, ikke bare en pilspiss (ca. 2,5 pilspisser lang)
              if (spec.slopeForces === 'split') expect(s.L * k).toBeGreaterThan(27 * Math.max(1, 0.75 * L.f));
            });
          }

          if (spec.slopeForces !== 'off' || spec.flatForces) {
            it(`${label}: målestokken oppe til venstre er fri for trærne, toppen, lupen og energipanelet`, () => {
              const k = spec.slopeForces === 'muN' || spec.slopeForces === 'split' ? L.kFe : L.kF;
              const F = scaleBarForce(k, 60 * L.f);
              const box: Box = { x: L.scaleBar.x, y: L.scaleBar.y - 14 * L.f, w: scaleBarTextW(L.f) + 8 * L.f + F * k, h: 24 * L.f };
              expect(F * k).toBeGreaterThan(35 * L.f);
              expect(F * k).toBeLessThan(110 * L.f);
              // Granene på toppen er 4,2 m høye, og toppen A har bokstaven over seg (toppen er utenfor utsnittet av flaten)
              if (spec.camera !== 'flate') {
                const treeTop = L.Y(task.h) - 4.2 * L.ppm;
                expect(box.y + box.h).toBeLessThan(Math.min(treeTop, L.Y(task.h) - 30 * L.f));
              }
              expect(box.y + box.h).toBeLessThan(L.horizon - 20 * L.f);
              if (L.panel) expect(boxesOverlap(box, L.panel, 6)).toBe(false);
              if (L.lupe && spec.flatLupe) expect(box.x + box.w).toBeLessThan(L.lupe.x - L.lupe.r - 6);
            });
          }

          if (spec.flatLupe) {
            it(`${label}: lupen med G og N er inni figuren, fri for akeren, pilene og panelet, og G = N`, () => {
              const lupe = L.lupe!;
              const tag = L.lupeTag!;
              expect(lupe.x - lupe.r).toBeGreaterThan(0);
              expect(lupe.x + lupe.r).toBeLessThan(L.W);
              expect(lupe.y - lupe.r).toBeGreaterThan(0);
              const fr = spotFrame(L, task, s, spec.rider);
              const ring = riderRing(L, fr);
              expect(Math.hypot(ring.x - lupe.x, ring.y - lupe.y)).toBeGreaterThan(ring.r + lupe.r + 10);
              // Skiltet under lupen er over flaten og ikke oppå akeren
              const tagBoxL: Box = { x: tag.x - 68 * L.f, y: tag.y - 14 * L.f, w: 136 * L.f, h: 28 * L.f };
              expect(tagBoxL.y + tagBoxL.h).toBeLessThan(L.groundY);
              expect(tagBoxL.x + tagBoxL.w).toBeLessThan(L.W);
              for (const p of visible) expect(boxesOverlap(riderBox(L, spotFrame(L, task, s, p)), tagBoxL, 4), p).toBe(false);
              if (L.panel) {
                expect(lupe.x + lupe.r + 6).toBeLessThan(L.panel.x);
                expect(tagBoxL.x + tagBoxL.w).toBeLessThan(L.panel.x + L.panel.w);
              }
              // R og v på flaten går ikke inn i lupen
              const com = framePoint(fr, 0, COM_HEIGHT * L.rppm);
              expect(com.y - lupe.y).toBeGreaterThan(lupe.r + 10);
              const m = flatLupeMap(lupe, s.G, L.f);
              expect(m.G.y2 - m.G.y1).toBeCloseTo(m.N.y1 - m.N.y2, 9);
              expect(m.N.x1 - m.G.x1).toBeGreaterThan(24);
              for (const [x, y] of [
                [m.G.x1, m.G.y1],
                [m.G.x2, m.G.y2],
                [m.N.x1, m.N.y1],
                [m.N.x2, m.N.y2],
              ] as const)
                expect(Math.hypot(x - lupe.x, y - lupe.y)).toBeLessThan(lupe.r - 4);
            });
          }

          if (spec.angle) {
            it(`${label}: vinkelbuen er nær B, α står inne i vinkelen og s-målet krysser ikke vinkelen`, () => {
              const a = angleMark(L, task, s);
              const al = (s.alphaDeg * Math.PI) / 180;
              const cross = (S_DIM_OFFSET * L.f) / Math.sin(al);
              expect(a.r).toBeLessThan(a.rho - a.glyphW / 2 - 4 * L.f);
              expect(a.leg).toBeLessThan(cross - 4 * L.f);
              expect(a.rho + a.glyphW / 2).toBeLessThan(cross - 8 * L.f);
              // Bokstaven får plass mellom den vannrette linja og bakken
              const cx = a.rho * Math.cos(al / 2);
              const cy = a.rho * Math.sin(al / 2);
              expect(cy - a.glyphH / 2).toBeGreaterThan(2 * L.f);
              expect((cx - a.glyphW / 2) * Math.tan(al) - (cy + a.glyphH / 2)).toBeGreaterThan(2 * L.f);
              // … og står ikke under brettet
              const fr = spotFrame(L, task, s, 'mid');
              const glyph: Box = { x: L.X(s.run) - cx - a.glyphW / 2, y: L.groundY - cy - a.glyphH / 2, w: a.glyphW, h: a.glyphH };
              const sled = SLED_LENGTH * L.rppm;
              const sledBox: Box = {
                x: framePoint(fr, -0.4 * sled, 0).x,
                y: framePoint(fr, -0.4 * sled, 0).y - 6,
                w: framePoint(fr, 0.64 * sled, 0).x - framePoint(fr, -0.4 * sled, 0).x,
                h: framePoint(fr, 0.64 * sled, 0).y - framePoint(fr, -0.4 * sled, 0).y + 12,
              };
              expect(boxesOverlap(glyph, sledBox)).toBe(false);
            });
          }

          it(`${label}: akeren på flaten står mot snøen (horisonten er over akeren)`, () => {
            expect(L.horizon).toBeLessThan(L.groundY - RIDER_TOP * L.rppm - 4);
            expect(L.horizon).toBeGreaterThan(0);
          });

          if (spec.speedB !== 'off') {
            it(`${label}: fartspila uten friksjon og etiketten får plass til høyre for B`, () => {
              const a = speedArrow(L, spotFrame(L, task, s, 'B'), s.vIdeal);
              expect(a.x2 + 24 * L.f).toBeLessThan(L.W);
            });
          }
        }

        it('akeren på toppen står på flaten foran A, og i B på flaten etter bakken', () => {
          const L = sceneLayout(task, s, { narrow: screen.narrow, camera: 'bakke', f: screen.f, k: screen.k });
          const sled = SLED_LENGTH * L.rppm;
          const A = spotFrame(L, task, s, 'A');
          expect(A.x + 0.62 * sled).toBeLessThanOrEqual(L.X(0) + 1e-9);
          expect(A.rotate).toBe(0);
          const B = spotFrame(L, task, s, 'B');
          expect(B.x - 0.38 * sled).toBeGreaterThan(L.X(L.run));
        });

        it('bakken har riktig helning i figuren, og overflaten går fra venstre til høyre', () => {
          for (const camera of ['bakke', 'flate', 'alt'] as const) {
            const L = sceneLayout(task, s, { narrow: screen.narrow, camera, f: screen.f, k: screen.k });
            const pts = terrainPoints(L, task.h);
            for (let j = 1; j < pts.length; j++) expect(pts[j]![0]).toBeGreaterThanOrEqual(pts[j - 1]![0] - 1e-9);
            const mid = spotFrame(L, task, s, 'mid');
            expect(mid.rotate).toBeCloseTo(s.alphaDeg, 6);
            // Midt i bakken ligger på linja fra A til B
            const t = (mid.x - L.X(0)) / (L.X(L.run) - L.X(0));
            expect(mid.y).toBeCloseTo(L.Y(task.h) + t * (L.groundY - L.Y(task.h)), 6);
          }
        });
      });
    }
  }
});
