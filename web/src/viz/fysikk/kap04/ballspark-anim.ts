/**
 * Bevegelsen i scenen til «ballspark» (ren geometri uten React, så den kan testes): hvor ballen er og hvor flat den
 * er presset, og hvordan foten, racketen eller kølla svinger inn mot ballen, følger den under treffet og fortsetter
 * etterpå. Fysikken (kraft, impuls, fart og strekning) kommer fra model-ballspark.ts; resten er en enkel modell av
 * svingen som bare skal se riktig ut.
 *
 * Figurens koordinater: x mot høyre, y nedover, K piksler per meter.
 */
import { kickAt, squashMax, type PulseShape, type SportSpec } from './model-ballspark';

export type Pt = { x: number; y: number };

export interface Shot {
  sport: SportSpec;
  /** Største kraft (N), kontakttid (ms) og form på kraftkurven. */
  Fmax: number;
  dtMs: number;
  shape: PulseShape;
}

export interface BallPose {
  /** Midten av ballen (x) slik den tegnes. */
  cx: number;
  /** Vannrett og loddrett skalering: ballen presses flat (sx < 1) og buler litt ut (sy > 1). */
  sx: number;
  sy: number;
  /** Baksiden av ballen (der foten, racketen eller kølla presser). */
  back: number;
  /** Hvor mye ballen er presset sammen (andel av radien). */
  q: number;
}

/**
 * Ballen ved tiden t (ms) etter at treffet begynner. `x0` er midten av ballen før treffet og `R` radien i
 * figurens enheter. Massesenteret flytter seg s(t) fra modellen, og ballen presses sammen like mye som kraften
 * (som en fjær): q(t) = q_maks · F(t)/F_maks.
 */
export function ballPose(shot: Shot, K: number, x0: number, R: number, tMs: number): BallPose {
  const { sport, Fmax, dtMs, shape } = shot;
  const st = kickAt(sport.m, Fmax, dtMs / 1000, shape, tMs / 1000);
  const q = Fmax > 0 ? (squashMax(sport, Fmax, dtMs) * st.F) / Fmax : 0;
  const delta = q * R;
  const cx = x0 + st.s * K + delta / 2;
  const sx = 1 - q / 2;
  return { cx, sx, sy: 1 + q / 4, back: cx - R * sx, q };
}

export interface Swing {
  /** Treffpunktet på foten, racketen eller kølla i det treffet begynner (figurens koordinater). */
  contact: Pt;
  /** Punktet svingen går rundt (kneet, skulderen, hendene). */
  pivot: Pt;
}

export interface HitterPose {
  /** Dreiningen (grader med klokka, som SVG `rotate`) rundt `pivot`. */
  angle: number;
  pivot: Pt;
  /** Vannrett forskyvning etter dreiningen (figurens enheter). */
  dx: number;
  /** Treffpunktet etter dreining og forskyvning. */
  contact: Pt;
}

/** Hvor mye av vinkelfarten som er igjen under og etter treffet (foten bremses av ballen, Newtons 3. lov). */
const DURING = 0.35;
const AFTER = 0.8;
/** Største dreining (rad) før og etter treffet, så foten eller kølla ikke svinger rundt. */
const MAX_TURN = (75 * Math.PI) / 180;

function rotate(p: Pt, c: Pt, a: number): Pt {
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
}

/**
 * Foten, racketen eller kølla ved tiden t (ms). Den svinger rundt `pivot` med farten u = v/speedRatio i treffpunktet
 * (v = farten ballen får), treffer baksiden av ballen ved t = 0 og følger den mens de er i kontakt. Etterpå
 * fortsetter den saktere enn ballen, så ballen slipper. `x0` og `R` som i ballPose.
 */
export function hitterPose(shot: Shot, K: number, x0: number, R: number, swing: Swing, vEnd: number, tMs: number): HitterPose {
  const { pivot, contact } = swing;
  const radius = Math.hypot(contact.x - pivot.x, contact.y - pivot.y) / K;
  const u = vEnd / shot.sport.speedRatio;
  const omega = radius > 0 ? u / radius : 0;
  // Treffpunktet skal gå mot høyre: med klokka rundt et punkt under, mot klokka rundt et punkt over.
  const sign = pivot.y > contact.y ? 1 : -1;
  const dt = shot.dtMs / 1000;
  const turnAt = (tS: number): number => {
    const th = tS <= 0 ? omega * tS : tS <= dt ? DURING * omega * tS : DURING * omega * dt + AFTER * omega * (tS - dt);
    return Math.max(-MAX_TURN, Math.min(MAX_TURN, th)) * sign;
  };
  const t = tMs / 1000;
  const a = turnAt(t);
  const c = rotate(contact, pivot, a);
  let dx = 0;
  if (t > 0) {
    const tc = Math.min(t, dt);
    const back = ballPose(shot, K, x0, R, tc * 1000).back;
    dx = back - rotate(contact, pivot, turnAt(tc)).x;
  }
  return { angle: (a * 180) / Math.PI, pivot, dx, contact: { x: c.x + dx, y: c.y } };
}
