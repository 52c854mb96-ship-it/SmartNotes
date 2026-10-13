import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Passord, brukernavn og koder for kontoene. Passordene lagres med scrypt (`node:crypto`), aldri i klartekst. Tenk på
 * scrypt som en kvern som tar tid med vilje: å sjekke ett passord tar et lite øyeblikk, men å prøve millioner tar år.
 */

const N = 16_384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const OPTIONS: ScryptOptions = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 };

/** Høyst to beregninger samtidig: scrypt bruker Nodes trådpool, som også filer, zlib og sharp trenger. */
const MAX_PARALLEL = 2;
let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function derive(password: string, salt: Buffer, opts: ScryptOptions, keylen: number): Promise<Buffer> {
  return limited(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFC'), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
      }),
  );
}

/** `scrypt$N$r$p$salt$hash` (salt og hash i base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, OPTIONS, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** En hash som aldri stemmer, men som tar like lang tid å sjekke (ukjent brukernavn, eierens innlogging). */
const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(KEYLEN).toString('base64url')}`;

/** Om passordet stemmer med hashen. Med `null` sjekkes mot en hash som aldri stemmer, så tiden blir den samme. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? DUMMY_HASH).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), { N: Number(n), r: Number(r), p: Number(p), maxmem: OPTIONS.maxmem }, expected.length);
  return stored !== null && expected.length > 0 && timingSafeEqual(key, expected);
}

/** Passordregel: 8 til 200 tegn. Gir en norsk feilmelding, eller null når passordet er godt nok. */
export function passwordProblem(password: string): string | null {
  const n = [...password.normalize('NFC')].length;
  if (n < 8) return 'Passordet må ha minst 8 tegn.';
  if (n > 200) return 'Passordet kan ha høyst 200 tegn.';
  return null;
}

/** Brukernavn lagres med små bokstaver (NFC), uten mellomrom rundt. */
export function normalizeUsername(name: string): string {
  return name.normalize('NFC').trim().toLocaleLowerCase('nb');
}

/** 3–32 tegn: bokstaver a–å, tall, punktum, bindestrek og understrek. */
export function usernameProblem(username: string): string | null {
  if (username.length < 3 || username.length > 32) return 'Brukernavnet må ha 3–32 tegn.';
  if (!/^[a-z0-9æøå._-]+$/.test(username)) return 'Brukernavnet kan bare ha bokstaver, tall, punktum, bindestrek og understrek.';
  return null;
}

/** Bokstaver og tall som ikke kan forveksles (ikke I, O, 0 eller 1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Ny invitasjonskode, «ABCD-EFGH-JKLM» (12 tegn, om lag 60 bit). */
export function newInviteCode(): string {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]!);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

/** Koden slik den sammenlignes: store bokstaver, uten bindestreker og mellomrom. */
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Tilfeldig token (økter, enheter, lenker for nytt passord). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hemmeligheter lagres bare som hash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
