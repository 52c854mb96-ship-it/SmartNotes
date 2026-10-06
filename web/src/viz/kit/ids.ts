import { useId } from 'react';

/** Gyldig og unik id for clipPath, mask og gradienter (useId kan inneholde tegn som ikke passer i url(#…)). */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
