import { Check } from 'lucide-react';
import type { FlashcardChoices } from '@smartnotes/shared';
import { RichText } from './RichText';

/**
 * Svaralternativene til et kort, diskret under svaret («Alle kort» og forhåndsvisningen i redigeringen): det riktige
 * med en hake først, så de gale. Tomme alternativer (et felt eleven ikke har fylt ut ennå) vises ikke.
 */
export function ChoiceSummary({ choices }: { choices: FlashcardChoices }) {
  const wrong = choices.wrong.filter((w) => w.trim());
  return (
    <div className="fc-choice-summary">
      <span className="fc-choice-summary-label">Svaralternativer</span>
      <ul>
        {choices.correct.trim() && (
          <li className="is-right">
            <Check size={15} aria-hidden />
            <span className="sr-only">Riktig: </span>
            <RichText text={choices.correct} />
          </li>
        )}
        {wrong.map((w, i) => (
          <li key={i}>
            <span className="sr-only">Galt: </span>
            <RichText text={w} />
          </li>
        ))}
      </ul>
    </div>
  );
}
