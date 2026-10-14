import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PracticePass } from '../db';
import { plural } from '../lib/format';
import { CardFace } from './CardFace';
import { Choice } from './Choice';
import { burst, centerOf } from './effects';
import { classicKeys, usePracticeKeys } from './keys';
import { OWN_CARDS, stepPass, toggleMark } from './model';
import type { Session } from './session';

/**
 * Klassisk: eleven blar gjennom alle kortene i utvalget, også de mestrede, snur dem og går videre. Kort hen vil øve mer
 * på, kan merkes. Ingen vurdering, så nivåene, rekka og «Beste» står urørt, og det er ingen effekter per kort (det blir
 * slitsomt når man blar fort), bare partikler når bunken er ferdig.
 */
export function ClassicPass({
  session,
  pass,
  setPass,
}: {
  session: Session;
  pass: PracticePass;
  setPass: Dispatch<SetStateAction<PracticePass | null>>;
}) {
  const { current, groupName, face, tick, liveRef } = session;
  const { show, cardRef } = face;
  const total = pass.ids.length;
  const marked = !!current && pass.marked.includes(current.id);

  const go = useCallback(
    (step: 1 | -1) => {
      const next = stepPass(pass, step);
      if (next === pass) return;
      tick();
      const center = centerOf(cardRef.current);
      setPass(next);
      show('question');
      if (next.index === next.ids.length) {
        burst(center, 26);
        if (liveRef.current) liveRef.current.textContent = `Du har gått gjennom ${plural(total, 'kort', 'kort')}.`;
      }
    },
    [pass, tick, cardRef, setPass, show, liveRef, total],
  );

  const mark = useCallback(() => {
    if (!current) return;
    tick();
    setPass((p) => (p ? toggleMark(p, current.id) : p));
  }, [current, tick, setPass]);

  usePracticeKeys(
    classicKeys({ flip: face.flip, next: () => go(1), prev: () => go(-1), mark, toggleDetail: face.toggleDetail }),
    session.keysOn,
  );

  if (pass.index >= total) return <ClassicDone session={session} pass={pass} onBack={() => go(-1)} />;

  const pct = Math.round(((pass.index + 1) / total) * 100);
  return (
    <>
      <div className="fc-status">
        <span>
          Kort {pass.index + 1} av {total}
        </span>
        {pass.marked.length > 0 && <span>{plural(pass.marked.length, 'merket', 'merket')}</span>}
      </div>
      <div
        className="fc-bar fc-bar-thin"
        role="progressbar"
        aria-label="Fremdrift i gjennomgangen"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div style={{ width: `${pct}%` }} />
      </div>

      {current && (
        <>
          <CardFace
            card={current}
            source={groupName(current.noteId ?? OWN_CARDS)}
            face={face}
            prompt="Svar i hodet før du snur."
            marked={marked}
          />
          <div className="fc-nav" role="group" aria-label="Bla i kortene">
            <button type="button" className="fc-nav-prev" disabled={pass.index === 0} onClick={() => go(-1)}>
              <ChevronLeft size={18} aria-hidden /> Forrige
            </button>
            <button type="button" className="fc-nav-mark" aria-pressed={marked} onClick={mark}>
              <Bookmark size={17} aria-hidden /> Merk
            </button>
            <button type="button" className="fc-nav-next" onClick={() => go(1)}>
              Neste <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <p className="fc-keys">
            <span>
              <kbd>Mellomrom</kbd> snu
            </span>
            <span>
              <kbd>←</kbd> <kbd>→</kbd> forrige og neste
            </span>
            <span>
              <kbd>M</kbd> merk
            </span>
            <span>
              <kbd>D</kbd> detaljert forklaring
            </span>
          </p>
        </>
      )}
    </>
  );
}

/** Etter gjennomgangen i Klassisk: en rask runde med de merkede, en ny gjennomgang eller Mestring. */
function ClassicDone({ session, pass, onBack }: { session: Session; pass: PracticePass; onBack: () => void }) {
  const { filter, restart } = session;
  const total = pass.ids.length;
  if (total === 0) {
    return (
      <section className="fc-done" aria-live="polite">
        <h2>Ingen kort med dette utvalget</h2>
        <p className="muted">Velg et annet notat eller en annen korttype.</p>
      </section>
    );
  }
  const marked = pass.marked;
  return (
    <section className="fc-done is-win" aria-live="polite">
      <h2>Du har gått gjennom {plural(total, 'kort', 'kort')}</h2>
      <p className="muted">
        {marked.length > 0 && `Du merket ${plural(marked.length, 'kort', 'kort')}. `}
        Klassisk endrer ikke mestringen, så nivåene er som før.
      </p>
      <h3 className="fc-repeat-title">Gå videre</h3>
      <div className="fc-repeat">
        {marked.length > 0 && (
          <Choice
            primary
            label={marked.length === 1 ? 'Rask runde med det merkede kortet' : `Rask runde med de ${marked.length} merkede`}
            meta="Ett riktig svar per kort, og svarene flytter nivåene"
            onClick={() => restart({ ...filter, mode: 'quick', subset: marked, subsetKind: 'repeat', seen: [] })}
          />
        )}
        <Choice
          primary={marked.length === 0}
          label="Bla gjennom på nytt"
          meta={`${plural(total, 'kort', 'kort')} fra starten`}
          onClick={() => restart({ ...filter })}
        />
        <Choice
          label="Bytt til mestring"
          meta="Grundig: kortene kommer igjen til du kan dem"
          onClick={() => restart({ ...filter, mode: 'mastery', subset: null, seen: [] })}
        />
      </div>
      <div className="fc-sub">
        <button type="button" className="link-btn" onClick={onBack}>
          <ChevronLeft size={15} aria-hidden /> Tilbake til siste kort
        </button>
      </div>
    </section>
  );
}
