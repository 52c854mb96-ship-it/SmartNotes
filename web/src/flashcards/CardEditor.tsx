import { useEffect, useState } from 'react';
import type { Flashcard, FlashcardKind } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { Modal } from '../components/Modal';
import { toast } from '../lib/ui';
import { createCard, updateCard } from './actions';
import { KIND_HINT, KIND_LABEL, KINDS } from './labels';
import { backToText, parseBackLine, textToBack } from './richtext';
import { RichParagraphs, RichText } from './RichText';

/** Redigerer et kort, eller lager et nytt (card = null). */
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(card?.kind ?? 'concept');
    setFront(card?.front ?? '');
    setBack(card ? backToText(card.back) : '');
    setDetail(card?.detail ?? '');
    setError(null);
  }, [open, card]);

  const lines = textToBack(back);
  const save = async () => {
    if (!front.trim()) return setError('Spørsmålet kan ikke være tomt.');
    if (!lines.length) return setError('Svaret må ha minst ett punkt.');
    setBusy(true);
    setError(null);
    try {
      const input = { kind, front: front.trim(), back: lines, detail: detail.trim() };
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
