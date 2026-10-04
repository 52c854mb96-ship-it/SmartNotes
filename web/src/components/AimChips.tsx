import type { CompetenceAim } from '@smartnotes/shared';
import { compareAimCodes } from '../lib/curriculum';

/** Små brikker for kompetansemål (KM5, KM7 …) med målteksten som verktøytips. */
export function AimChips({
  codes,
  aims,
  size = 'md',
  label = 'Kompetansemål',
}: {
  codes: string[];
  aims: Map<string, CompetenceAim>;
  size?: 'sm' | 'md';
  label?: string;
}) {
  if (!codes.length) return null;
  const sorted = [...new Set(codes)].sort(compareAimCodes);
  return (
    <ul className={`aim-chips${size === 'sm' ? ' is-sm' : ''}`} aria-label={label} role="list">
      {sorted.map((code) => {
        const text = aims.get(code)?.text;
        return (
          <li key={code} className="aim-chip" title={text ? `${code}: ${text}` : code}>
            {code}
            {text && <span className="sr-only">: {text}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Delkapittel-koden som liten monospace-merkelapp. */
export function SectionCode({ code, title }: { code: string; title?: string }) {
  return (
    <span className="section-code" title={title ? `${code} ${title}` : undefined}>
      {code}
    </span>
  );
}
