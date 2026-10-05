/**
 * Effektene fra originalen: lysende kant, risting ved feil, ✓/✕ som spretter opp, partikler og meldinger øverst.
 * Elementene legges rett i <body> (som i originalen) og fjernes selv etter animasjonen. Fargene er CSS-variabler
 * (se styles/flashcards.css). Med «redusert bevegelse» droppes partiklene, og ristingen erstattes av bare farge.
 */
import type { Effects, Tone } from './model';

export interface Point {
  x: number;
  y: number;
}

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Starter en CSS-animasjon på nytt ved å fjerne klassen, tvinge omtegning og legge den til igjen. */
function restartClass(el: Element, cls: string, all: string[], ms: number): void {
  el.classList.remove(...all);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  clearTimeout(timers.get(el));
  timers.set(
    el,
    setTimeout(() => el.classList.remove(cls), ms),
  );
}

const FLASH = ['fc-fx-ok', 'fc-fx-ok-big', 'fc-fx-bad', 'fc-fx-mid'];

export function flash(card: Element | null, kind: Effects['flash']): void {
  if (card) restartClass(card, `fc-fx-${kind}`, FLASH, 950);
}

export function bump(el: Element | null): void {
  if (el) restartClass(el, 'fc-bump', ['fc-bump'], 400);
}

export function pop(text: string, tone: Tone, word: boolean, p: Point): void {
  const el = document.createElement('div');
  el.className = `fc-pop fc-pop-${tone}${word ? ' fc-pop-word' : ''}`;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

const PARTICLE_COLORS = ['var(--fc-good)', 'var(--fc-great)', 'var(--fc-flame)', 'var(--fc-spark-1)', 'var(--fc-spark-2)'];

export function burst(p: Point, n: number): void {
  if (n <= 0 || reduceMotion()) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fc-particle';
    el.setAttribute('aria-hidden', 'true');
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 150;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.background = PARTICLE_COLORS[i % PARTICLE_COLORS.length]!;
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
    el.style.setProperty('--rot', `${Math.random() * 540 - 270}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }
}

/** Melding øverst på skjermen (milepæler). Leses også opp av skjermlesere via `live`-elementet. */
export function toast(text: string, tone: 'ok' | 'flame', live: Element | null): void {
  const el = document.createElement('div');
  el.className = `fc-toast fc-toast-${tone}`;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2300);
  if (live) live.textContent = text;
}

export function centerOf(el: Element | null): Point {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
