/**
 * Faget brukeren sist var i (forsidens «Fortsett i …»). Settes av AppShell for alle sider i et fag: fagsiden, kapitler,
 * notater, kortstokker og visualiseringer. Lagres bare på enheten.
 */
const KEY = 'smartnotes:lastSubject';

export function rememberLastSubject(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignorer (privat modus) */
  }
}

export function lastSubjectId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
