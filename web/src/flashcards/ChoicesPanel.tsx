/**
 * Svaralternativer (flervalg) til en kortstokk som finnes. Claude lager dem bare når eleven ber om det: knappen
 * «Lag svaralternativer», så «Lager svaralternativer …» mens jobben går, og feilmeldingen med «Prøv igjen» hvis den
 * feiler. Krever nett. For gratiskontoer teller det som én kortstokk i dagens kvote (feilen fra serveren vises som ved en
 * ny kortstokk). Kort Claude har fått uten å gi brukbare alternativer (`choicesDeclined`), tilbys ikke igjen: er det bare
 * slike igjen, står en rolig linje om å skrive dem selv i stedet for knappen. `ChoicesPanel` står i fanen «Alle kort»;
 * `ChoicesHelp` er forklaringen ved velgeren når Flervalg ikke kan velges.
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react';
import { CircleAlert, ListChecks, RotateCcw, X } from 'lucide-react';
import type { Deck, Flashcard } from '@smartnotes/shared';
import { errorMessage } from '../api';
import { useAccount } from '../lib/account';
import { useOnline } from '../lib/connectivity';
import { plural } from '../lib/format';
import { requestChoices } from './actions';
import { choiceCounts, hasChoices } from './model';

/** «Lag svaralternativer» og «Prøv igjen»: samme kall, med feilmeldingen fra serveren (kvote, nett) når det feiler. */
function useRequestChoices(deckId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Gir true når jobben er startet. */
  const start = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await requestChoices(deckId);
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke lage svaralternativer.'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, start };
}

/** Fokus står ikke noe sted (elementet som hadde det, er tatt bort). */
const focusLost = () => !document.activeElement || document.activeElement === document.body;

/**
 * Status og knapp for svaralternativene i kortstokken. Viser ingenting når alle kortene har dem og ingen jobb går.
 * `intro` erstatter overskriften (forklaringen ved velgeren), og `onClose` gir en «Lukk»-knapp.
 *
 * Knappene forsvinner når jobben starter, så fokus flyttes først til panelet (samme element gjennom «Lager …» og en
 * eventuell feil). Forsvinner hele panelet etterpå (alle kortene fikk alternativer), får `onGone` flytte fokus videre.
 */
export function ChoicesPanel({
  deck,
  cards,
  intro,
  onClose,
  onGone,
  panelRef,
}: {
  deck: Deck;
  cards: Flashcard[];
  intro?: ReactNode;
  onClose?: () => void;
  /** Panelet forsvant etter et trykk her, og fokus sto ingen steder: flytt det til et sted i nærheten. */
  onGone?: () => void;
  panelRef?: Ref<HTMLElement>;
}) {
  const { online } = useOnline();
  const free = useAccount()?.plan === 'free';
  const request = useRequestChoices(deck.id);
  const { have, untried, declined } = choiceCounts(cards);
  const generating = deck.choicesStatus === 'generating';
  const failed = deck.choicesStatus === 'failed' && untried > 0;
  const visible = generating || failed || untried > 0 || declined > 0;

  const sectionRef = useRef<HTMLElement | null>(null);
  const setSection = useCallback(
    (el: HTMLElement | null) => {
      sectionRef.current = el;
      if (typeof panelRef === 'function') panelRef(el);
      else if (panelRef) panelRef.current = el;
    },
    [panelRef],
  );
  /** Eleven startet jobben i dette panelet (bare da flyttes fokus når panelet forsvinner). */
  const requestedHere = useRef(false);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && requestedHere.current && focusLost()) onGone?.();
    if (!visible) requestedHere.current = false;
    wasVisible.current = visible;
  }, [visible, onGone]);

  const start = async (e: MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    requestedHere.current = true;
    // Knappen forsvinner når jobben starter: fokus står på panelet, som blir stående gjennom «Lager …».
    sectionRef.current?.focus({ preventScroll: true });
    const ok = await request.start();
    // Feilet kallet (kvote, nett), står knappen igjen: fokus tilbake dit når den er klar igjen.
    if (!ok) setTimeout(() => button.isConnected && button.focus({ preventScroll: true }), 0);
  };

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

  if (generating) {
    return (
      <section ref={setSection} className="fc-choices is-busy" tabIndex={-1} aria-live="polite">
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
  if (failed) {
    return (
      <section ref={setSection} className="fc-choices is-error" tabIndex={-1} role="alert">
        <CircleAlert size={20} aria-hidden />
        <div className="fc-choices-body">
          <p className="fc-choices-title">Svaralternativene kunne ikke lages</p>
          <p className="fc-choices-text">{deck.choicesError ?? 'Ukjent feil.'}</p>
          <div className="fc-choices-actions">
            <button type="button" className="btn btn-sm" disabled={request.busy || !online} onClick={(e) => void start(e)}>
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

  if (!visible) return null;
  const title = intro ?? <p className="fc-choices-title">Flervalg</p>;

  // Bare kort Claude allerede har prøvd, mangler alternativer: ingen knapp (et nytt forsøk ville gitt det samme).
  if (untried === 0) {
    return (
      <section ref={setSection} className="fc-choices" tabIndex={-1} aria-label="Svaralternativer">
        <ListChecks size={20} aria-hidden />
        <div className="fc-choices-body">
          {title}
          <p className="fc-choices-text">
            {have > 0
              ? `${have} av ${cards.length} kort har svaralternativer. Claude fant ingen gode til de andre, ofte fordi svaret er for langt til flervalg.`
              : 'Claude fant ingen gode svaralternativer til kortene, ofte fordi svarene er for lange til flervalg.'}{' '}
            Du kan skrive dem selv når du redigerer et kort.
          </p>
        </div>
        {close}
      </section>
    );
  }

  const offer =
    have === 0 && declined === 0
      ? 'Ingen av kortene har svaralternativer ennå. Claude kan lage tre gale svar som ligner det riktige, til hvert kort.'
      : `${have === 0 ? 'Ingen av kortene har svaralternativer ennå.' : `${have} av ${cards.length} kort har svaralternativer.`} Claude kan prøve å lage dem til ${plural(untried, 'kort', 'kort')} som mangler dem.`;
  return (
    <section ref={setSection} className="fc-choices" tabIndex={-1} aria-label="Svaralternativer">
      <ListChecks size={20} aria-hidden />
      <div className="fc-choices-body">
        {title}
        <p className="fc-choices-text">
          {offer}
          {free && ' Det teller som én kortstokk i dagens kvote.'}
        </p>
        <div className="fc-choices-actions">
          <button type="button" className="btn btn-sm" disabled={request.busy || !online} onClick={(e) => void start(e)}>
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
 * (`autoFocus`), så skjermlesere leser den, og når den bytter til «Nå kan du øve med flervalg» mens fokus ikke står
 * noe sted (knappen eleven trykket på, er borte).
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
  const showReady = ready && deck.choicesStatus !== 'generating';
  useEffect(() => {
    if (showReady && focusLost()) ref.current?.focus({ preventScroll: true });
  }, [showReady]);

  const closeButton = onClose && (
    <button type="button" className="icon-btn fc-choices-close" aria-label="Lukk" onClick={onClose}>
      <X size={18} aria-hidden />
    </button>
  );

  if (showReady) {
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
        {closeButton}
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
        {closeButton}
      </section>
    );
  }
  return <ChoicesPanel deck={deck} cards={cards} intro={intro} onClose={onClose} panelRef={ref} />;
}
