import { describe, expect, it } from 'vitest';
import { formatChangedDay } from './format';

describe('formatChangedDay', () => {
  const now = new Date(2026, 9, 14, 9, 30);
  it('sier «i dag» og «i går», ellers datoen (med år bare når det er et annet år)', () => {
    expect(formatChangedDay(new Date(2026, 9, 14, 0, 5).toISOString(), now)).toBe('i dag');
    expect(formatChangedDay(new Date(2026, 9, 13, 23, 50).toISOString(), now)).toBe('i går');
    expect(formatChangedDay(new Date(2026, 9, 3, 12).toISOString(), now)).toBe('3. okt.');
    expect(formatChangedDay(new Date(2025, 9, 3, 12).toISOString(), now)).toBe('3. okt. 2025');
  });
  it('gir tom tekst uten gyldig tidspunkt', () => {
    expect(formatChangedDay(null, now)).toBe('');
    expect(formatChangedDay('ugyldig', now)).toBe('');
  });
});
