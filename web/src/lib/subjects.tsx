import { Atom, FlaskConical, Leaf, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import type { SubjectProfile } from '@smartnotes/shared';

/** Det appen vet om hver fagtype: navn, ikon og LaTeX-mal. Fargene ligger i styles/subjects.css. */
export const PROFILES: Record<SubjectProfile, { label: string; template: string; Icon: ComponentType<LucideProps> }> = {
  physics: { label: 'Fysikk', template: 'Klassisk', Icon: Atom },
  chemistry: { label: 'Kjemi', template: 'Moderne', Icon: FlaskConical },
  biology: { label: 'Biologi', template: 'Lærebok', Icon: Leaf },
};

export const PROFILE_ORDER: SubjectProfile[] = ['physics', 'chemistry', 'biology'];

export function profileOf(value: string | null | undefined): SubjectProfile {
  return value === 'chemistry' || value === 'biology' ? value : 'physics';
}

export function SubjectIcon({ profile, ...props }: { profile: string | null | undefined } & LucideProps) {
  const { Icon } = PROFILES[profileOf(profile)];
  return <Icon aria-hidden {...props} />;
}
