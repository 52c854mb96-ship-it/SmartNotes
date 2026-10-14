/**
 * Svaralternativer (flervalg) til en kortstokk som finnes. Claude lager dem bare når eleven ber om det: knappen
 * «Lag svaralternativer», så «Lager svaralternativer …» mens jobben går, og feilmeldingen med «Prøv igjen» hvis den
 * feiler. Krever nett. For gratiskontoer teller det som én kortstokk i dagens kvote (feilen fra serveren vises som ved en
 * ny kortstokk). `ChoicesPanel` står i fanen «Alle kort»; `ChoicesHelp` er forklaringen ved velgeren når Flervalg ikke
 * kan velges.
 */
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { CircleAlert, ListChecks, RotateCcw, X } from 'lucide-react';
import type { Deck, Flashcard } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { useAccount } from '../lib/account';
import { useOnline } from '../lib/connectivity';
import { requestChoices } from './actions';
import { hasChoices } from './model';

/** «Lag svaralternativer» og «Prøv igjen»: samme kall, med feilmeldingen fra serveren (kvote, nett) når det feiler. */
function useRequestChoices(deckId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestChoices(deckId);
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke lage svaralternativer.'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, start };
}

/**
 * Status og knapp for svaralternativene i kortstokken. Viser ingenting når alle kortene har dem og ingen jobb går.
 * `intro` erstatter overskriften (forklaringen ved velgeren), og `onClose` gir en «Lukk»-knapp.
 */
export function ChoicesPanel({
  deck,
  cards,
  intro,
  onClose,
  panelRef,
}: {
  deck: Deck;
  cards: Flashcard[];
  intro?: ReactNode;
  onClose?: () => void;
  panelRef?: Ref<HTMLElement>;
}) {
  const { online } = useOnline();
  const free = useAccount()?.plan === 'free';
  const request = useRequestChoices(deck.id);
  const missing = cards.filter((c) => !hasChoices(c)).length;
  const have = cards.length - missing;
  const close = onClose && (
    <button type="button" className="icon-btn fc-choices-close" aria-label="Lukk" onClick={onClose}>
      <X size={18} aria-hidden />
    </button>
  );
  const offline = !online && <span className="muted small">Krever nett.</span>;
  const failure = request.error && (
    <p className="form-error" role="alert">
      {request.error}
    </p>
  );

  if (deck.choicesStatus === 'generating') {
    return (
      <section ref={panelRef} className="fc-choices is-busy" tabIndex={-1} aria-live="polite">
        <span className="spinner" aria-hidden />
        <div className="fc-choices-body">
          <p className="fc-choices-title">Lager svaralternativer …</p>
          <p className="fc-choices-text">
            Claude skriver tre gale svar som ligner det riktige, til kortene som mangler dem. Du kan øve imens.
          </p>
        </div>
        {close}
      </section>
    );
  }

  // En feil står til eleven prøver igjen, men ikke når kortene har fått alternativer på annen måte (skrevet selv).
  if (deck.choicesStatus === 'failed' && missing > 0) {
    return (
      <section ref={panelRef} className="fc-choices is-error" tabIndex={-1} role="alert">
        <CircleAlert size={20} aria-hidden />
        <div className="fc-choices-body">
          <p className="fc-choices-title">Svaralternativene kunne ikke lages</p>
          <p className="fc-choices-text">{deck.choicesError ?? 'Ukjent feil.'}</p>
          <div className="fc-choices-actions">
            <button type="button" className="btn btn-sm" disabled={request.busy || !online} onClick={() => void request.start()}>
              <RotateCcw size={15} aria-hidden /> Prøv igjen
            </button>
            {offline}
          </div>
          {failure}
        </div>
        {close}
      </section>
    );
  }

  if (missing === 0) return null;
  const status =
    have === 0
      ? 'Ingen av kortene har svaralternativer ennå.'
      : `${have} av ${cards.length} kort har svaralternativer. Kort med lange svar får ofte ingen, men du kan skrive dem selv når du redigerer kortet.`;
  return (
    <section ref={panelRef} className="fc-choices" tabIndex={-1} aria-label="Svaralternativer">
      <ListChecks size={20} aria-hidden />
      <div className="fc-choices-body">
        {intro ?? <p className="fc-choices-title">Flervalg</p>}
        <p className="fc-choices-text">
          {status} Claude kan lage tre gale svar som ligner det riktige{have > 0 ? ' til resten' : ''}.
          {free && ' Det teller som én kortstokk i dagens kvote.'}
        </p>
        <div className="fc-choices-actions">
          <button type="button" className="btn btn-sm" disabled={request.busy || !online} onClick={() => void request.start()}>
            {request.busy ? 'Starter …' : 'Lag svaralternativer'}
          </button>
          {offline}
        </div>
        {failure}
      </div>
      {close}
    </section>
  );
}

/**
 * Forklaringen ved velgeren når Flervalg ikke kan velges (ingen kort i utvalget har svaralternativer), med
 * `ChoicesPanel` under. Når alternativene er klare, gir «Øv med flervalg» formen. Får fokus når eleven åpner den
 * (`autoFocus`), så skjermlesere leser den.
 */
export function ChoicesHelp({
  deck,
  cards,
  ready,
  autoFocus,
  onPractice,
  onClose,
}: {
  deck: Deck;
  cards: Flashcard[];
  /** Kort i utvalget har svaralternativer: Flervalg kan velges. */
  ready: boolean;
  autoFocus: boolean;
  onPractice: () => void;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  if (ready && deck.choicesStatus !== 'generating') {
    return (
      <section ref={ref} className="fc-choices is-ready" tabIndex={-1} aria-live="polite">
        <ListChecks size={20} aria-hidden />
        <div className="fc-choices-body">
          <p className="fc-choices-title">Nå kan du øve med flervalg</p>
          <div className="fc-choices-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={onPractice}>
              Øv med flervalg
            </button>
          </div>
        </div>
        {onClose && (
          <button type="button" className="icon-btn fc-choices-close" aria-label="Lukk" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        )}
      </section>
    );
  }

  const deckHas = cards.some(hasChoices);
  const intro = deckHas ? (
    <p className="fc-choices-title">Ingen av kortene i utvalget har svaralternativer</p>
  ) : (
    <p className="fc-choices-title">Flervalg trenger svaralternativer</p>
  );
  const allHave = cards.every(hasChoices);
  if (allHave && deck.choicesStatus !== 'generating') {
    // Alle kortene har alternativer, men ikke de i utvalget (et tomt utvalg): bare forklaringen.
    return (
      <section ref={ref} className="fc-choices" tabIndex={-1}>
        <ListChecks size={20} aria-hidden />
        <div className="fc-choices-body">
          {intro}
          <p className="fc-choices-text">Velg et annet notat eller en annen korttype.</p>
        </div>
        {onClose && (
          <button type="button" className="icon-btn fc-choices-close" aria-label="Lukk" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        )}
      </section>
    );
  }
  return <ChoicesPanel deck={deck} cards={cards} intro={intro} onClose={onClose} panelRef={ref} />;
}
