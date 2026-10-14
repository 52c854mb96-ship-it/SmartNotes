import { useEffect, useRef, useState } from 'react';
import type { Flashcard, FlashcardKind } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { Modal } from '../components/Modal';
import { toast } from '../lib/ui';
import { createCard, updateCard } from './actions';
import { ChoiceSummary } from './ChoiceSummary';
import { MAX_CHOICE_CHARS, WRONG_CHOICES, choiceFieldsOf, readChoiceFields, type ChoiceField, type ChoiceFields } from './choices';
import { KIND_HINT, KIND_LABEL, KINDS } from './labels';
import { hasChoices } from './model';
import { backToText, parseBackLine, textToBack } from './richtext';
import { RichParagraphs, RichText } from './RichText';

/**
 * Redigerer et kort, eller lager et nytt (card = null). Svaralternativene til flervalg er valgfrie: tomme felt gir et
 * kort uten (og fjerner dem fra et kort som hadde dem). Feltene sjekkes med de samme reglene og meldingene som serveren
 * (`readChoiceFields`).
 */
export function CardEditor({
  open,
  deckId,
  card,
  onClose,
}: {
  open: boolean;
  deckId: string;
  card: Flashcard | null;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<FlashcardKind>('concept');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [detail, setDetail] = useState('');
  const [choiceFields, setChoiceFields] = useState<ChoiceFields>(() => choiceFieldsOf(null));
  const [choicesOpen, setChoicesOpen] = useState(false);
  /** Feltet for svaralternativer som har feil (markeres og får fokus). */
  const [badChoice, setBadChoice] = useState<ChoiceField | null>(null);
  const choiceRefs = useRef<Partial<Record<string, HTMLInputElement | null>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(card?.kind ?? 'concept');
    setFront(card?.front ?? '');
    setBack(card ? backToText(card.back) : '');
    setDetail(card?.detail ?? '');
    setChoiceFields(choiceFieldsOf(card?.choices));
    setChoicesOpen(hasChoices(card ?? undefined));
    setBadChoice(null);
    setError(null);
  }, [open, card]);

  const setCorrect = (correct: string) => {
    setBadChoice(null);
    setChoiceFields((f) => ({ ...f, correct }));
  };
  const setWrong = (i: number, text: string) => {
    setBadChoice(null);
    setChoiceFields((f) => ({ ...f, wrong: f.wrong.map((w, j) => (j === i ? text : w)) }));
  };
  const anyChoice = choiceFields.correct.trim() !== '' || choiceFields.wrong.some((w) => w.trim() !== '');

  const lines = textToBack(back);
  const save = async () => {
    if (!front.trim()) return setError('Spørsmålet kan ikke være tomt.');
    if (!lines.length) return setError('Svaret må ha minst ett punkt.');
    const read = readChoiceFields(choiceFields);
    if (!read.ok) {
      setChoicesOpen(true);
      setBadChoice(read.field);
      setError(read.error);
      // Feltet kan ligge i en lukket del: fokus etter at den er åpnet.
      setTimeout(() => choiceRefs.current[String(read.field)]?.focus(), 0);
      return;
    }
    setBadChoice(null);
    setBusy(true);
    setError(null);
    try {
      // `choices` sendes alltid: null gir et kort uten svaralternativer (og fjerner dem ved redigering).
      const input = { kind, front: front.trim(), back: lines, detail: detail.trim(), choices: read.choices };
      if (card) await updateCard(card.id, input);
      else await createCard(deckId, input);
      toast(card ? 'Kortet er lagret.' : 'Kortet er lagt til.', { kind: 'success' });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke lagre kortet.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      title={card ? 'Rediger kortet' : 'Nytt kort'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Avbryt
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Lagrer …' : card ? 'Lagre' : 'Legg til'}
          </button>
        </>
      }
    >
      <form
        className="stack fc-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset className="field profile-choice">
          <legend className="field-label">Korttype</legend>
          <div className="profile-options">
            {KINDS.map((k) => (
              <label key={k} className={`profile-option${kind === k ? ' is-on' : ''}`}>
                <input type="radio" name="fc-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                <span className="profile-option-text">
                  <span className="profile-option-label">{KIND_LABEL[k]}</span>
                  <span className="profile-option-meta">{KIND_HINT[k]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span className="field-label">Spørsmål</span>
          <textarea rows={2} value={front} onChange={(e) => setFront(e.currentTarget.value)} maxLength={500} data-autofocus />
        </label>
        <label className="field">
          <span className="field-label">Svar</span>
          <textarea rows={5} value={back} onChange={(e) => setBack(e.currentTarget.value)} />
          <span className="field-note">
            Ett punkt per linje. Skriv **fet** for nøkkelbegreper og $formel$ for formler, f.eks. $v = \frac{'{s}{t}'}$. En linje som
            starter med ! blir en overskrift.
          </span>
        </label>
        <label className="field">
          <span className="field-label">
            Detaljert forklaring <span className="optional">(valgfritt)</span>
          </span>
          <textarea rows={4} value={detail} onChange={(e) => setDetail(e.currentTarget.value)} maxLength={4000} />
        </label>
        <details className="fc-editor-choices" open={choicesOpen} onToggle={(e) => setChoicesOpen(e.currentTarget.open)}>
          <summary>
            Svaralternativer til flervalg <span className="optional">(valgfritt)</span>
          </summary>
          <div className="fc-editor-choices-body">
            <p className="field-note">
              Skriv det riktige svaret kort, på én linje, og tre gale svar som ligner det. La alle feltene stå tomme for et kort
              uten svaralternativer.
            </p>
            <label className="field">
              <span className="field-label">Kort riktig svar</span>
              <input
                ref={(el) => {
                  choiceRefs.current.correct = el;
                }}
                type="text"
                value={choiceFields.correct}
                maxLength={MAX_CHOICE_CHARS}
                aria-invalid={badChoice === 'correct' || undefined}
                onChange={(e) => setCorrect(e.currentTarget.value)}
              />
            </label>
            <fieldset className="field fc-editor-wrong">
              <legend className="field-label">Gale svar</legend>
              {Array.from({ length: WRONG_CHOICES }, (_, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    choiceRefs.current[String(i)] = el;
                  }}
                  type="text"
                  aria-label={`Galt svar ${i + 1}`}
                  value={choiceFields.wrong[i] ?? ''}
                  maxLength={MAX_CHOICE_CHARS}
                  aria-invalid={badChoice === i || undefined}
                  onChange={(e) => setWrong(i, e.currentTarget.value)}
                />
              ))}
            </fieldset>
            {anyChoice && (
              <div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setChoiceFields(choiceFieldsOf(null));
                    setBadChoice(null);
                  }}
                >
                  Fjern svaralternativene
                </button>
              </div>
            )}
          </div>
        </details>
        {(front.trim() || lines.length > 0) && (
          <div className="fc-preview" aria-label="Forhåndsvisning">
            <span className="field-label">Forhåndsvisning</span>
            <div className="fc-preview-card">
              <p className="fc-question">
                <RichText text={front} />
              </p>
              <ul className="fc-answer">
                {lines.map((line, i) => {
                  const l = parseBackLine(line);
                  return (
                    <li key={i} className={l.label ? 'is-label' : undefined}>
                      <RichText text={l.text} />
                    </li>
                  );
                })}
              </ul>
              {detail.trim() && (
                <div className="fc-detail">
                  <RichParagraphs text={detail} />
                </div>
              )}
              {anyChoice && <ChoiceSummary choices={choiceFields} />}
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
