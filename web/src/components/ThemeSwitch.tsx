import { useId, type KeyboardEvent } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_OPTIONS, setTheme, themeStore, type ThemePref } from '../lib/theme';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Valg av fargetema som radiogruppe.
 * `segmented`: med tekst (Innstillinger). `compact`: bare ikoner (sidepanelet).
 */
export function ThemeSwitch({ variant = 'segmented' }: { variant?: 'segmented' | 'compact' }) {
  const current = themeStore.use();
  const labelId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = THEME_OPTIONS.findIndex((o) => o.value === current);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % THEME_OPTIONS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    if (next < 0) return;
    e.preventDefault();
    const value = THEME_OPTIONS[next]!.value;
    setTheme(value);
    e.currentTarget.querySelector<HTMLElement>(`[data-value="${value}"]`)?.focus();
  };

  const compact = variant === 'compact';
  return (
    <div
      role="radiogroup"
      aria-labelledby={compact ? undefined : labelId}
      aria-label={compact ? 'Tema' : undefined}
      className={compact ? 'theme-switch is-compact' : 'segmented theme-switch'}
      onKeyDown={onKeyDown}
    >
      {!compact && (
        <span id={labelId} className="sr-only">
          Tema
        </span>
      )}
      {THEME_OPTIONS.map((o) => {
        const Icon = ICONS[o.value as ThemePref];
        const checked = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={compact ? o.label : undefined}
            title={compact ? `Tema: ${o.label}` : undefined}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            className={compact ? 'theme-option' : 'segment'}
            onClick={() => setTheme(o.value)}
          >
            <Icon size={compact ? 15 : 16} aria-hidden />
            {!compact && o.label}
          </button>
        );
      })}
    </div>
  );
}
