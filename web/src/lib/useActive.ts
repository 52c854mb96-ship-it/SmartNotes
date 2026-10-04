import { matchPath, useLocation } from 'react-router';
import { useNote } from '../data';

/** Hvilket fag/kapittel som er «aktivt» ut fra URL-en (også på notatsiden). */
export function useActiveIds(): { subjectId?: string; chapterId?: string; noteId?: string } {
  const { pathname } = useLocation();
  const chapterMatch = matchPath('/fag/:subjectId/kapittel/:chapterId/*', pathname);
  const subjectMatch = matchPath('/fag/:subjectId/*', pathname);
  const noteMatch = matchPath('/notat/:noteId', pathname);
  const note = useNote(noteMatch?.params.noteId);

  if (noteMatch) {
    return {
      noteId: noteMatch.params.noteId,
      subjectId: note?.subjectId,
      chapterId: note ? (note.chapterId ?? 'uten') : undefined,
    };
  }
  if (chapterMatch) {
    return { subjectId: chapterMatch.params.subjectId, chapterId: chapterMatch.params.chapterId };
  }
  if (subjectMatch) return { subjectId: subjectMatch.params.subjectId };
  return {};
}
