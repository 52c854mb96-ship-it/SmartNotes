/**
 * Tastaturet i øvingen. Hver form har sitt eget tastekart (`KeyMap`), og `usePracticeKeys` lytter på vinduet så
 * snarveiene virker uansett hvor på siden fokus står, unntatt i felt, faner, menyer og åpne dialoger.
 */
import { useEffect, useRef } from 'react';
import type { Grade } from './model';

/**
 * Handlingene en form har på tastaturet, etter `KeyboardEvent.key`. Bokstaver står med liten bokstav og gjelder begge
 * (`d` er også Shift+D). Mellomrom (`' '`) og `Enter` gjør ingenting når fokus står på en knapp, lenke eller
 * `<summary>`, for der betyr de å trykke på den.
 */
export type KeyMap = Partial<Record<string, () => void>>;

/**
 * Fokus i faner, menyer og radiogrupper (f.eks. «Øvingsform»): piltastene og tallene hører til dem, ikke til øvingen.
 * Svaralternativene i Flervalg står i en vanlig `group`, så tallene virker der.
 */
export function inWidget(el: Element | null): boolean {
  return !!el?.closest('[role="tablist"], [role="menu"], [role="listbox"], [role="radiogroup"]');
}

export function isEditable(el: Element | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** Mellomrom og Enter på en knapp, lenke eller `<summary>` trykker på den. */
function activates(el: Element | null): boolean {
  return el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el?.tagName === 'SUMMARY';
}

/** Navnet en tast har i et tastekart: bokstaver med liten bokstav, andre taster som `KeyboardEvent.key`. */
export const keyName = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/** Lytter etter tastene i `keys` så lenge `enabled` er sann. Kartet kan endres fra gang til gang uten ny lytter. */
export function usePracticeKeys(keys: KeyMap, enabled: boolean): void {
  const keysRef = useRef(keys);
  keysRef.current = keys;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const focused = document.activeElement;
      if (isEditable(focused) || inWidget(focused)) return;
      const key = keyName(e.key);
      const action = keysRef.current[key];
      if (!action) return;
      if (key === ' ' || key === 'Enter') {
        if (activates(focused)) return;
        e.preventDefault();
      }
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/**
 * Mestring: mellomrom eller Enter snur, 1–4 vurderer, venstre pil er «Feil» (1) og høyre pil «Bra» (3), Z angrer og
 * D viser den detaljerte forklaringen.
 */
export function masteryKeys(h: {
  flip: () => void;
  rate: (grade: Grade) => void;
  undo: () => void;
  toggleDetail: () => void;
}): KeyMap {
  return {
    ' ': h.flip,
    Enter: h.flip,
    '1': () => h.rate(1),
    '2': () => h.rate(2),
    '3': () => h.rate(3),
    '4': () => h.rate(4),
    ArrowLeft: () => h.rate(1),
    ArrowRight: () => h.rate(3),
    z: h.undo,
    d: h.toggleDetail,
  };
}

/**
 * Rask runde (og kortene uten luke i Luketekst): mellomrom eller Enter snur, venstre pil er «Kunne ikke» og høyre pil
 * «Kunne» (de samme pilene som «Feil» og «Bra» i Mestring), Z angrer og D viser forklaringen. Tallene er av.
 */
export function quickKeys(h: { flip: () => void; answer: (known: boolean) => void; undo: () => void; toggleDetail: () => void }): KeyMap {
  return {
    ' ': h.flip,
    Enter: h.flip,
    ArrowLeft: () => h.answer(false),
    ArrowRight: () => h.answer(true),
    z: h.undo,
    d: h.toggleDetail,
  };
}

/** Klassisk: mellomrom eller Enter snur, pilene går til forrige og neste kort, M merker og D viser forklaringen. */
export function classicKeys(h: {
  flip: () => void;
  next: () => void;
  prev: () => void;
  mark: () => void;
  toggleDetail: () => void;
}): KeyMap {
  return {
    ' ': h.flip,
    Enter: h.flip,
    ArrowRight: h.next,
    ArrowLeft: h.prev,
    m: h.mark,
    d: h.toggleDetail,
  };
}

/**
 * Luketekst, kort med luke. Før svaret er sjekket, flytter mellomrom og Enter fokus til feltet (i feltet sjekker Enter
 * og Esc viser svaret, se `ClozeRound`). Etter sjekken går mellomrom, Enter og høyre pil til neste kort. Z angrer, og
 * D viser forklaringen når svaret er sjekket.
 */
export function clozeKeys(h: {
  checked: boolean;
  focusField: () => void;
  next: () => void;
  undo: () => void;
  toggleDetail: () => void;
}): KeyMap {
  if (!h.checked) return { ' ': h.focusField, Enter: h.focusField, z: h.undo };
  return { ' ': h.next, Enter: h.next, ArrowRight: h.next, z: h.undo, d: h.toggleDetail };
}

/**
 * Flervalg, kort med svaralternativer. Før svaret velger 1–4 alternativet med det nummeret (bare så mange tall som det
 * er alternativer). Etter svaret går mellomrom, Enter og høyre pil til neste kort, og D viser forklaringen når den
 * vises (`toggleDetail`, bare etter et galt svar). Z angrer.
 */
export function choiceKeys(h: {
  answered: boolean;
  count: number;
  pick: (index: number) => void;
  next: () => void;
  undo: () => void;
  toggleDetail?: () => void;
}): KeyMap {
  if (!h.answered) {
    const keys: KeyMap = { z: h.undo };
    for (let i = 0; i < Math.min(h.count, 9); i++) keys[String(i + 1)] = () => h.pick(i);
    return keys;
  }
  const keys: KeyMap = { ' ': h.next, Enter: h.next, ArrowRight: h.next, z: h.undo };
  if (h.toggleDetail) keys.d = h.toggleDetail;
  return keys;
}
