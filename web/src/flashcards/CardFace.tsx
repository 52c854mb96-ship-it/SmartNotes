import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Flashcard } from '@smartnotes/shared';
import { KIND_LABEL } from './labels';
import { MASTER, levelOf } from './model';
import { parseBackLine } from './richtext';
import { RichParagraphs, RichText } from './RichText';

/** Siden av kortet som vises. */
export type Side = 'question' | 'answer';

/** Kortet som vises i øvingen: om det er snudd, den detaljerte forklaringen og hvor fokus skal. Felles for formene. */
export interface CardFaceState {
  flipped: boolean;
  detailOpen: boolean;
  /** Snur kortet (begge veier). Lukker forklaringen når det snus tilbake. */
  flip: () => void;
  /** Viser eller skjuler den detaljerte forklaringen. Snur kortet først hvis det ikke er snudd. */
  toggleDetail: () => void;
  /**
   * Viser spørsmålet eller svaret uten forklaringen, f.eks. etter en vurdering eller en angring. Med `focus` flyttes
   * fokus dit etter neste visning; en ny runde lar fokus stå.
   */
  show: (side: Side, focus?: boolean) => void;
  /** Flytter fokus til siden som vises (etter pausen). */
  refocus: () => void;
  cardRef: RefObject<HTMLDivElement | null>;
  questionRef: RefObject<HTMLParagraphElement | null>;
  answerRef: RefObject<HTMLUListElement | null>;
}

/**
 * Tilstanden til kortet som vises. `tick` kalles for hver handling (pauseklokka). Etter snu og vurdering flyttes
 * fokus til svaret eller det nye spørsmålet, så skjermlesere leser det opp og fokus ikke blir stående på en knapp som
 * forsvant eller ble deaktivert, men bare når fokus ikke står utenfor `root` (f.eks. i sidepanelet).
 */
export function useCardFace(card: Flashcard | undefined, tick: () => void, root: RefObject<HTMLElement | null>): CardFaceState {
  const [flipped, setFlipped] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const answerRef = useRef<HTMLUListElement>(null);
  const focusNext = useRef<Side | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const activeEl = document.activeElement;
    if (activeEl && activeEl !== document.body && !root.current?.contains(activeEl)) return;
    (target === 'answer' ? answerRef.current : questionRef.current)?.focus({ preventScroll: true });
  });

  const flip = useCallback(() => {
    if (!card) return;
    tick();
    if (flipped) setDetailOpen(false);
    focusNext.current = flipped ? 'question' : 'answer';
    setFlipped(!flipped);
  }, [card, flipped, tick]);

  const toggleDetail = useCallback(() => {
    if (!card?.detail) return;
    tick();
    if (!detailOpen && !flipped) {
      setFlipped(true);
      focusNext.current = 'answer';
    }
    setDetailOpen(!detailOpen);
  }, [card, detailOpen, flipped, tick]);

  const show = useCallback((side: Side, focus = true) => {
    setFlipped(side === 'answer');
    setDetailOpen(false);
    if (focus) focusNext.current = side;
  }, []);

  const refocus = useCallback(() => {
    focusNext.current = flipped ? 'answer' : 'question';
  }, [flipped]);

  return { flipped, detailOpen, flip, toggleDetail, show, refocus, cardRef, questionRef, answerRef };
}

/** Øverst på kortet: notatet det er laget fra, et merke (Klassisk), nivået og korttypen. */
export function CardMeta({ card, source, marked = false }: { card: Flashcard; source: string; marked?: boolean }) {
  return (
    <div className="fc-meta">
      <span className="fc-source">{source}</span>
      <span className="fc-meta-right">
        {marked && <span className="fc-marked">Merket</span>}
        <span className="fc-dots" role="img" aria-label={`Nivå ${levelOf(card)} av ${MASTER}`}>
          {Array.from({ length: MASTER }, (_, i) => (
            <i key={i} className={i < levelOf(card) ? 'is-on' : undefined} />
          ))}
        </span>
        <span className={`fc-tag fc-tag-${card.kind}`}>{KIND_LABEL[card.kind]}</span>
      </span>
    </div>
  );
}

/**
 * Kortet: notatet det er laget fra, nivået og korttypen øverst, så spørsmålet, svaret når det er snudd, og den
 * detaljerte forklaringen. Et trykk på kortet snur det. `prompt` står under spørsmålet til kortet er snudd (Klassisk),
 * og `marked` viser at eleven har merket kortet.
 */
export function CardFace({
  card,
  source,
  face,
  prompt,
  marked = false,
}: {
  card: Flashcard;
  source: string;
  face: CardFaceState;
  prompt?: string;
  marked?: boolean;
}) {
  const { flipped, flip } = face;
  return (
    <div
      ref={face.cardRef}
      className={`fc-card${flipped ? ' is-flipped' : ''}${marked ? ' is-marked' : ''}`}
      onClick={(e) => {
        if ((e.target as Element).closest('.fc-detail-btn, .fc-detail, .fc-flip-hint, input')) return;
        flip();
      }}
    >
      <CardMeta card={card} source={source} marked={marked} />
      <p ref={face.questionRef} className="fc-question" tabIndex={-1}>
        <RichText text={card.front} />
      </p>
      {prompt && !flipped && <p className="fc-prompt">{prompt}</p>}
      {flipped ? (
        <ul ref={face.answerRef} className="fc-answer" tabIndex={-1} aria-label="Svar">
          {card.back.map((line, i) => {
            const l = parseBackLine(line);
            return (
              <li key={i} className={l.label ? 'is-label' : undefined}>
                <RichText text={l.text} />
              </li>
            );
          })}
        </ul>
      ) : (
        <button type="button" className="fc-flip-hint" onClick={flip}>
          Trykk for å snu kortet
        </button>
      )}
      <CardDetail card={card} face={face} />
    </div>
  );
}

/** Knappen «Detaljert forklaring» og forklaringen. */
export function CardDetail({ card, face }: { card: Flashcard; face: CardFaceState }) {
  const { detailOpen, toggleDetail } = face;
  if (!card.detail) return null;
  return (
    <>
      <button type="button" className="fc-detail-btn" aria-expanded={detailOpen} onClick={toggleDetail}>
        {detailOpen ? 'Skjul detaljert forklaring' : 'Detaljert forklaring'}
      </button>
      {detailOpen && (
        <div className="fc-detail">
          <RichParagraphs text={card.detail} />
        </div>
      )}
    </>
  );
}
