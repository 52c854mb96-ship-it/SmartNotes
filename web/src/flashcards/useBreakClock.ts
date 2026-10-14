import { useCallback, useState } from 'react';
import { BREAK_MS, addActiveTime } from './model';

/**
 * Pauseklokka per kortstokk lever utenfor komponenten, så den teller videre når man bytter fane eller side og kommer
 * tilbake (inaktiv tid over 2 minutter teller uansett ikke).
 */
const breakClocks = new Map<string, { sinceBreak: number; lastAction: number; due: boolean }>();

function breakClock(deckId: string) {
  let c = breakClocks.get(deckId);
  if (!c) breakClocks.set(deckId, (c = { sinceBreak: 0, lastAction: Date.now(), due: false }));
  return c;
}

export interface BreakClock {
  /** Eleven har øvd i 30 minutter: varselet om pause vises. */
  due: boolean;
  /** Når pausen begynte (null = ingen pause). */
  pausedAt: number | null;
  paused: boolean;
  /** En handling i øvingen: tiden siden forrige handling teller som øving. Gjelder alle formene. */
  tick: () => void;
  /** «Ta pause»: pauseskjermen vises. */
  startPause: () => void;
  /** «Fortsett» uten pause: varselet forsvinner og klokka begynner på nytt. */
  skipBreak: () => void;
  /** Pausen er over («Fortsett å øve»). */
  endPause: () => void;
}

/** Pausepåminnelsen etter 30 minutter aktiv øving i kortstokken. */
export function useBreakClock(deckId: string): BreakClock {
  const clock = breakClock(deckId);
  const [due, setDueState] = useState(clock.due);
  const setDue = useCallback(
    (value: boolean) => {
      clock.due = value;
      setDueState(value);
    },
    [clock],
  );
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const tick = useCallback(() => {
    const now = Date.now();
    clock.sinceBreak = addActiveTime(clock.sinceBreak, clock.lastAction, now);
    clock.lastAction = now;
    if (clock.sinceBreak >= BREAK_MS) setDue(true);
  }, [clock, setDue]);
  const startPause = useCallback(() => {
    setDue(false);
    setPausedAt(Date.now());
  }, [setDue]);
  const skipBreak = useCallback(() => {
    setDue(false);
    clock.sinceBreak = 0;
  }, [clock, setDue]);
  const endPause = useCallback(() => {
    setPausedAt(null);
    clock.sinceBreak = 0;
    clock.lastAction = Date.now();
  }, [clock]);
  return { due, pausedAt, paused: pausedAt !== null, tick, startPause, skipBreak, endPause };
}
