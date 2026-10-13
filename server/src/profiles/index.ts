import fs from 'node:fs';
import type { SubjectProfile } from '@smartnotes/shared';
import { biologyProfile } from './biology.js';
import { chemistryProfile } from './chemistry.js';
import { geoscienceProfile } from './geoscience.js';
import { physicsProfile } from './physics.js';
import type { Profile } from './types.js';

export type { Profile } from './types.js';

const PROFILES: Record<SubjectProfile, Profile> = {
  physics: physicsProfile,
  chemistry: chemistryProfile,
  biology: biologyProfile,
  geoscience: geoscienceProfile,
};

export const PROFILE_IDS = Object.keys(PROFILES) as SubjectProfile[];

export function getProfile(id: string): Profile {
  return PROFILES[id as SubjectProfile] ?? physicsProfile;
}

export function isProfile(id: string): id is SubjectProfile {
  return id in PROFILES;
}

/** Claude-modellene får de presise reglene (`profiles/precise.ts`) etter grunninstruksen. */
export function usesPreciseRules(model: string): boolean {
  return model.startsWith('claude-');
}

/** Bare Haiku får de viktigste reglene gjentatt til slutt (`HAIKU_CLOSING`). */
export function usesHaikuClosing(model: string): boolean {
  return model.startsWith('claude-haiku');
}

/** Systeminstruksen for konvertering og retting med denne modellen. Stabil per fag og modell, så den caches. */
export function systemPromptFor(profile: Profile, model: string): string {
  return usesPreciseRules(model) ? `${profile.systemPrompt}\n\n${profile.preciseRules}` : profile.systemPrompt;
}

const preambleCache = new Map<string, string>();

export function readPreamble(profile: Profile): string {
  let p = preambleCache.get(profile.id);
  if (!p) {
    p = fs.readFileSync(profile.preamblePath, 'utf8');
    preambleCache.set(profile.id, p);
  }
  return p;
}
