import { Pause, Play, RotateCcw } from 'lucide-react';
import type { SimClock } from '../kit';

/**
 * Som <PlayControls> i kit-et, men tida vises med egen tekst og enhet (f.eks. «t = 11 460 år»), fordi klokka her
 * teller halveringstider og ikke sekunder.
 */
export function PlayBar({ clock, time }: { clock: SimClock; time: string }) {
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
        t = {time}
      </span>
    </div>
  );
}
