import { describe, expect, it } from 'vitest';
import {
  COM_HEIGHT,
  STEP_COUNT,
  SLED_LENGTH,
  framePoint,
  boxesOverlap,
  figureSpec,
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
    expect(figureSpec(8, false).slopeForces).toBe('split');
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
            it(`${label}: kraftpilene holder seg i bakken (til høyre for A) og inni figuren`, () => {
              const fr = spotFrame(L, task, s, spec.rider);
              const com = framePoint(fr, 0, COM_HEIGHT * L.rppm);
              const force = spec.flatForces ? s.Rflat : spec.slopeForces === 'R' ? s.R : s.muN;
              const tipX = com.x - fr.tx * force * L.kF;
              expect(tipX).toBeGreaterThan(spec.flatForces ? 20 : L.X(0) + 20 * L.f);
              // Lengden står i forhold til kraften (fast skala px/N)
              expect(Math.hypot(fr.tx, fr.ty) * force * L.kF).toBeGreaterThan(40);
            });
          }

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
