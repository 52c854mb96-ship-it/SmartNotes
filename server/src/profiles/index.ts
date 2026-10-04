import fs from 'node:fs';
import type { SubjectProfile } from '@smartnotes/shared';
import { biologyProfile } from './biology.js';
import { chemistryProfile } from './chemistry.js';
import { physicsProfile } from './physics.js';
import type { Profile } from './types.js';

export type { Profile } from './types.js';

const PROFILES: Record<SubjectProfile, Profile> = {
  physics: physicsProfile,
  chemistry: chemistryProfile,
  biology: biologyProfile,
};

export const PROFILE_IDS = Object.keys(PROFILES) as SubjectProfile[];

export function getProfile(id: string): Profile {
  return PROFILES[id as SubjectProfile] ?? physicsProfile;
}

export function isProfile(id: string): id is SubjectProfile {
  return id in PROFILES;
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
