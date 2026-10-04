import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { fmt } from './format';

export interface SimClock {
  /** Simulert tid i sekunder. */
  t: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Tilbake til t = 0 (og pause). */
  reset: () => void;
  setT: (t: number) => void;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Klokke for animasjoner: teller simulert tid med requestAnimationFrame mens den spiller.
 * Stopper ved `tMax` (eller går rundt når `loop` er satt). Starter på pause.
 */
export function useSimClock({ tMax, speed = 1, loop = false }: { tMax: number; speed?: number; loop?: boolean }): SimClock {
  const [t, setTState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(0);
  const last = useRef<number | null>(null);

  const setT = useCallback((v: number) => {
    tRef.current = v;
    setTState(v);
  }, []);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      const prev = last.current ?? now;
      last.current = now;
      const dt = Math.min(0.05, (now - prev) / 1000) * speed;
      let next = tRef.current + dt;
      if (next >= tMax) {
        if (loop) next = next % tMax;
        else {
          setT(tMax);
          setPlaying(false);
          return;
        }
      }
      setT(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, tMax, speed, loop, setT]);

  const play = useCallback(() => {
    if (tRef.current >= tMax && !loop) setT(0);
    setPlaying(true);
  }, [tMax, loop, setT]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? setPlaying(false) : play()), [playing, play]);
  const reset = useCallback(() => {
    setPlaying(false);
    setT(0);
  }, [setT]);

  return { t, playing, play, pause, toggle, reset, setT };
}

/** Spill/pause, start på nytt og tidsvisning. */
export function PlayControls({ clock, decimals = 2, label = 't' }: { clock: SimClock; decimals?: number; label?: string }) {
  return (
    <div className="viz-play">
      <button type="button" className="btn btn-sm" onClick={clock.toggle} aria-pressed={clock.playing}>
        {clock.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {clock.playing ? 'Pause' : 'Spill av'}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={clock.reset}>
        <RotateCcw size={16} aria-hidden />
        Start på nytt
      </button>
      <span className="viz-play-time" aria-live="off">
        {label} = {fmt(clock.t, decimals)}&nbsp;s
      </span>
      {prefersReducedMotion() && <span className="viz-play-note">Animasjoner er redusert i systeminnstillingene.</span>}
    </div>
  );
}
