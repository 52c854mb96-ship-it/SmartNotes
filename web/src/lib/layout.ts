import { matchPath } from 'react-router';
import { listCollapsedStore } from './ui';
import { WIDE_QUERY, useMediaQuery } from './media';

/** Ruter som får notatlisten (midtkolonnen) i tre-kolonne-oppsettet. */
export function isListRoute(pathname: string): boolean {
  return (
    !!matchPath('/fag/:subjectId', pathname) ||
    !!matchPath('/fag/:subjectId/kapittel/:chapterId', pathname) ||
    !!matchPath('/fag/:subjectId/kapittel/:chapterId/pdf', pathname) ||
    !!matchPath('/notat/:noteId', pathname)
  );
}

/** Om notatlisten faktisk vises ved siden av innholdet (bred skjerm og ikke skjult). */
export function useListPaneShown(): boolean {
  const wide = useMediaQuery(WIDE_QUERY);
  const collapsed = listCollapsedStore.use();
  return wide && !collapsed;
}
