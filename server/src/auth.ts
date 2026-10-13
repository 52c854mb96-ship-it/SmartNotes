import { timingSafeEqual, createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser, LoginRequest, LoginResponse, MeResponse, PublicPresetsResponse, RegisterRequest, ResetPasswordRequest } from '@smartnotes/shared';
import type { Config } from './config.js';
import { OWNER_ID, type Repo, type UserRow } from './db.js';
import { HttpError, badRequest } from './errors.js';
import {
  hashPassword,
  hashToken,
  passwordQueueFull,
  newToken,
  normalizeInviteCode,
  normalizeUsername,
  passwordProblem,
  usernameProblem,
  verifyPassword,
} from './passwords.js';
import { SUBJECT_PRESETS } from './presets.js';

export const SESSION_COOKIE = 'sn_session';
/** En enhet som har logget inn før, rammes ikke av kontosperren (ellers kunne hvem som helst sperre eieren ute). */
export const DEVICE_COOKIE = 'sn_device';
/** Mutasjoner må ha denne headeren – nettlesere sender den ikke ved CSRF fra andre sider. */
export const CSRF_HEADER = 'x-smartnotes';
/** Kontoen appen tror den er logget inn som. Stemmer den ikke med økten (en annen fane logget inn), svarer serveren 409. */
export const ACCOUNT_HEADER = 'x-smartnotes-account';

export type Access = 'public' | 'user' | 'owner' | 'worker';

/**
 * Tilgang per rute, med metode og rute slik Fastify registrerer dem. Serveren starter ikke hvis en /api-rute mangler
 * her (sjekkes i `onRoute`), så en ny rute må tas stilling til. `owner` er bare for eieren; andre får 404.
 */
export const ROUTE_ACCESS: Record<string, Access> = {
  'GET /api/health': 'public',
  'POST /api/auth/login': 'public',
  'POST /api/auth/logout': 'public',
  'GET /api/auth/me': 'public',
  'POST /api/auth/register': 'public',
  'POST /api/auth/reset': 'public',
  'GET /api/auth/presets': 'public',

  'GET /api/sync': 'user',
  'GET /api/presets': 'user',
  'POST /api/subjects': 'user',
  'POST /api/subjects/from-preset': 'user',
  'PATCH /api/subjects/:id': 'user',
  'DELETE /api/subjects/:id': 'user',
  'GET /api/subjects/:id/pdf': 'user',
  'POST /api/subjects/:id/chapters': 'user',
  'POST /api/subjects/:id/chapters/bulk': 'user',
  'POST /api/subjects/:id/chapters/parse': 'user',
  'POST /api/subjects/:id/chapters/extract': 'user',
  'POST /api/subjects/:id/chapters/reorder': 'user',
  'PATCH /api/chapters/:id': 'user',
  'DELETE /api/chapters/:id': 'user',
  'GET /api/chapters/:id/pdf': 'user',
  'POST /api/notes': 'user',
  'PATCH /api/notes/:id': 'user',
  'DELETE /api/notes/:id': 'user',
  'POST /api/notes/:id/retry': 'user',
  'GET /api/notes/:id/pdf': 'user',
  'GET /api/notes/:id/latex': 'user',
  'PUT /api/notes/:id/latex': 'user',
  'GET /api/notes/:id/tex': 'user',
  'GET /api/notes/:id/pages': 'user',
  'GET /api/notes/:id/pages/:index': 'user',
  'POST /api/decks': 'user',
  'PATCH /api/decks/:id': 'user',
  'DELETE /api/decks/:id': 'user',
  'POST /api/decks/:id/retry': 'user',
  'POST /api/decks/:id/cards': 'user',
  'PATCH /api/cards/:id': 'user',
  'DELETE /api/cards/:id': 'user',
  'POST /api/flashcards/progress': 'user',
  'GET /api/quota': 'user',

  'GET /api/ai/status': 'owner',
  'GET /api/usage': 'owner',
  'GET /api/backup/status': 'owner',
  'GET /api/backup': 'owner',
  'GET /api/compare/summary': 'owner',
  'GET /api/notes/:id/compare': 'owner',
  'POST /api/notes/:id/compare': 'owner',
  'GET /api/notes/:id/compare/pdf': 'owner',
  'PUT /api/notes/:id/compare/rating': 'owner',
  'GET /api/admin/users': 'owner',
  'POST /api/admin/users/:id/reset-link': 'owner',
  'POST /api/admin/users/:id/disable': 'owner',
  'POST /api/admin/users/:id/enable': 'owner',
  'PATCH /api/admin/me': 'owner',
  'GET /api/admin/invites': 'owner',
  'POST /api/admin/invites': 'owner',
  'DELETE /api/admin/invites/:id': 'owner',

  'POST /api/worker/claim': 'worker',
  'POST /api/worker/tasks/:id/heartbeat': 'worker',
  'POST /api/worker/tasks/:id/result': 'worker',
};

/** Nøkkelen i `ROUTE_ACCESS` (HEAD følger GET). */
export function routeKey(method: string, url: string): string {
  return `${method === 'HEAD' ? 'GET' : method} ${url}`;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Brukeren som er logget inn (satt av auth-hooken), eller null. */
    user: UserRow | null;
  }
}

export function authUser(u: UserRow): AuthUser {
  return { id: u.id, username: u.username, plan: u.plan };
}

/** Den innloggede brukeren i en rute som krever innlogging. */
export function requireUser(req: FastifyRequest): UserRow {
  if (!req.user) throw new HttpError(401, 'unauthorized', 'Du må logge inn.');
  return req.user;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();

function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(sha256(given.normalize('NFC')), sha256(expected.normalize('NFC')));
}

/** Enkel begrensning av forsøk per nøkkel (i minnet). Gamle nøkler ryddes bort, så kartet ikke vokser fritt. */
export class AttemptLimiter {
  private readonly attempts = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs = 15 * 60_000,
  ) {}

  private recent(key: string): number[] {
    const list = (this.attempts.get(key) ?? []).filter((t) => t > Date.now() - this.windowMs);
    if (list.length === 0) this.attempts.delete(key);
    else this.attempts.set(key, list);
    return list;
  }

  blocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  fail(key: string): void {
    const list = this.recent(key);
    list.push(Date.now());
    this.attempts.set(key, list);
    if (this.attempts.size > 10_000) {
      for (const k of [...this.attempts.keys()].slice(0, 1_000)) this.recent(k);
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Gir tilbake det siste forsøket (et forsøk som ble reservert før passordsjekken, og som lyktes). */
  refund(key: string): void {
    const list = this.attempts.get(key);
    if (!list) return;
    list.pop();
    if (list.length === 0) this.attempts.delete(key);
  }
}

/** Sperren per konto: 10 feil fra ukjente enheter innen 15 minutter gir 15 minutters sperre (bare for ukjente enheter). */
const ACCOUNT_LOCK = { max: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
const TOO_MANY = 'For mange feil forsøk. Vent et kvarter og prøv igjen.';
const WRONG = 'Feil brukernavn eller passord.';
const LOCKED = 'Kontoen er sperret i et kvarter etter for mange feil forsøk fra en ny enhet. Prøv igjen senere.';

export function registerAuth(app: FastifyInstance, repo: Repo, config: Config): void {
  // Per IP og brukernavn, og en romsligere grense per IP (en hel skole kan ha samme adresse).
  const pairLimiter = new AttemptLimiter(10);
  const ipLimiter = new AttemptLimiter(50);
  // Brukernavn som ikke finnes, sperres som ekte kontoer etter 10 forsøk, så sperren ikke røper hvilke navn som finnes.
  const unknownLimiter = new AttemptLimiter(ACCOUNT_LOCK.max, ACCOUNT_LOCK.windowMs);
  // Registrering og nytt passord: per IP, så noen ikke kan prøve seg fram til en kode.
  const codeLimiter = new AttemptLimiter(10, 60 * 60_000);

  app.decorateRequest('user', null);

  const sessionUser = (req: FastifyRequest): UserRow | null => {
    const token = req.cookies[SESSION_COOKIE];
    return token ? repo.sessionUser(hashToken(token)) : null;
  };

  // Hver /api-rute må ha en tilgang i ROUTE_ACCESS (sjekkes når rutene registreres, altså ved oppstart).
  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/')) return;
    for (const method of [route.method].flat()) {
      if (!(routeKey(method, route.url) in ROUTE_ACCESS)) {
        throw new Error(`Ruten ${method} ${route.url} mangler i ROUTE_ACCESS (auth.ts).`);
      }
    }
  });

  // Alle /api-kall krever innlogging (unntatt de offentlige), mutasjoner krever CSRF-headeren, og eierrutene krever
  // eieren. Sjekken bruker ruten Fastify fant, ikke adressen slik den ble sendt: `/%61pi/sync` går til samme rute som
  // `/api/sync`, men begynner ikke med «/api/». En adresse uten rute får 404 og gir ingen data.
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const url = req.routeOptions.url;
    if (url === undefined || !url.startsWith('/api/')) return;
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating && req.headers[CSRF_HEADER] !== '1') {
      throw new HttpError(403, 'csrf', 'Forespørselen ble avvist (mangler sikkerhetsheader).');
    }
    const access = ROUTE_ACCESS[routeKey(req.method, url)] ?? 'owner';
    // Hjemmemaskinen logger inn med WORKER_TOKEN i stedet (routes/worker.ts).
    if (access === 'worker') return;
    req.user = sessionUser(req);
    if (access === 'public') return;
    if (!req.user) throw new HttpError(401, 'unauthorized', 'Du må logge inn.');
    const expected = req.headers[ACCOUNT_HEADER];
    if (typeof expected === 'string' && expected !== String(req.user.id)) {
      throw new HttpError(409, 'account_changed', 'Du er logget inn med en annen konto i en annen fane. Last inn siden på nytt.');
    }
    if (access === 'owner' && req.user.plan !== 'owner') throw new HttpError(404, 'not_found', 'Fant ikke det du lette etter.');
  });

  const setSessionCookie = (reply: FastifyReply, token: string, expires: Date) => {
    reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/', expires });
  };
  const startSession = (reply: FastifyReply, req: FastifyRequest, user: UserRow) => {
    const token = newToken();
    const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
    repo.pruneSessions();
    repo.createSession(hashToken(token), user.id, expires, req.headers['user-agent']?.slice(0, 300) ?? null);
    setSessionCookie(reply, token, expires);
  };
  /** Husker enheten for kontoen, så kontosperren ikke gjelder den neste gang. */
  const rememberDevice = (reply: FastifyReply, req: FastifyRequest, userId: number) => {
    const existing = req.cookies[DEVICE_COOKIE];
    const token = existing && existing.length <= 100 ? existing : newToken();
    repo.addDevice(hashToken(token), userId);
    reply.setCookie(DEVICE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/api/auth',
      expires: new Date(Date.now() + 400 * 86_400_000),
    });
  };
  const sessionFor = () => {
    const token = newToken();
    const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
    return { token, expires };
  };

  app.post<{ Body: LoginRequest }>('/api/auth/login', async (req, reply): Promise<LoginResponse> => {
    const ip = req.ip;
    const username = normalizeUsername(typeof req.body?.username === 'string' ? req.body.username : '').slice(0, 64);
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 500) : '';
    const pairKey = `${ip}|${username}`;
    if (pairLimiter.blocked(pairKey) || ipLimiter.blocked(ip)) throw new HttpError(429, 'too_many_attempts', TOO_MANY);
    if (passwordQueueFull()) throw new HttpError(503, 'busy', 'Serveren har mye å gjøre akkurat nå. Prøv igjen om litt.');

    // Eieren logger inn med APP_PASSWORD, som før kontoene, med tomt brukernavn eller sitt eget.
    const owner = repo.getUser(OWNER_ID)!;
    const isOwner = !username || username === owner.username;
    const user: UserRow | null = isOwner ? owner : repo.getUserByName(username);
    const device = req.cookies[DEVICE_COOKIE];
    const knownDevice = !!user && !!device && repo.isKnownDevice(hashToken(device), user.id);

    // Kontosperren gjelder nye enheter og sjekkes før passordet, så svaret er det samme for riktig og feil passord
    // (ellers kunne den som gjetter, se når passordet stemte). Et ukjent brukernavn sperres på samme måte.
    if (!knownDevice) {
      const locked = user ? !!user.locked_until && Date.parse(user.locked_until) > Date.now() : unknownLimiter.blocked(username);
      if (locked) throw new HttpError(429, 'locked', LOCKED);
    }

    // Forsøket telles før passordsjekken (som venter på scrypt), så mange forsøk sendt samtidig ikke slipper forbi
    // grensene. Lykkes det, gis det tilbake.
    pairLimiter.fail(pairKey);
    ipLimiter.fail(ip);
    if (!knownDevice) {
      if (user) repo.recordLoginFailure(user.id, ACCOUNT_LOCK);
      else unknownLimiter.fail(username);
    }

    let ok: boolean;
    if (isOwner) {
      ok = passwordMatches(password, config.appPassword);
      // Den tomme scrypt-sjekken gjør at tiden ikke røper hvem som er eieren.
      await verifyPassword(password, null);
    } else {
      ok = (await verifyPassword(password, user?.password_hash ?? null)) && !!user;
    }
    if (!ok || !user) throw new HttpError(401, 'wrong_password', WRONG);
    pairLimiter.reset(pairKey);
    ipLimiter.refund(ip);
    // Stengt sies bare etter riktig passord, så svaret ikke røper hvilke brukernavn som finnes.
    if (user.disabled) throw new HttpError(403, 'disabled', 'Kontoen er stengt. Snakk med den som inviterte deg.');
    repo.recordLogin(user.id);
    startSession(reply, req, user);
    rememberDevice(reply, req, user.id);
    return { ok: true, user: authUser(repo.getUser(user.id)!) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) repo.deleteSession(hashToken(token));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req): Promise<MeResponse> => ({ authenticated: !!req.user, user: req.user ? authUser(req.user) : null }));

  app.get('/api/auth/presets', async (): Promise<PublicPresetsResponse> => ({
    presets: Object.values(SUBJECT_PRESETS).map((p) => ({ id: p.id, subjectName: p.subjectName, profile: p.profile })),
    minAge: config.accounts.minAge,
  }));

  app.post<{ Body: RegisterRequest }>('/api/auth/register', async (req, reply): Promise<LoginResponse> => {
    const ip = req.ip;
    if (codeLimiter.blocked(ip)) throw new HttpError(429, 'too_many_attempts', 'For mange forsøk. Vent en time og prøv igjen.');
    const b = req.body ?? ({} as RegisterRequest);
    const code = normalizeInviteCode(typeof b.code === 'string' ? b.code.slice(0, 100) : '');
    const codeHash = hashToken(code);
    // Koden sjekkes først, så den som ikke har en kode, ikke får vite hvilke brukernavn som er tatt.
    if (!code || !repo.inviteUsable(codeHash)) {
      codeLimiter.fail(ip);
      throw badRequest('Invitasjonskoden er ugyldig, brukt eller utløpt.');
    }
    const username = normalizeUsername(typeof b.username === 'string' ? b.username : '');
    const usernameError = usernameProblem(username);
    if (usernameError) throw badRequest(usernameError);
    const password = typeof b.password === 'string' ? b.password : '';
    const passwordError = passwordProblem(password);
    if (passwordError) throw badRequest(passwordError);
    if (b.ageConfirmed !== true) throw badRequest(`Du må være minst ${config.accounts.minAge} år for å bruke SmartNotes.`);
    const ids = Array.isArray(b.presetIds) ? [...new Set(b.presetIds.filter((x): x is string => typeof x === 'string'))] : [];
    const presets = ids.map((id) => (Object.hasOwn(SUBJECT_PRESETS, id) ? SUBJECT_PRESETS[id]! : null));
    if (presets.some((p) => p === null) || presets.length > 10) throw badRequest('Ukjent fag i valget.');
    if (presets.length === 0) throw badRequest('Velg minst ett fag.');
    const passwordHash = await hashPassword(password);
    const { token, expires } = sessionFor();
    const res = repo.registerUser({
      codeHash,
      username,
      passwordHash,
      presets: presets.map((p) => p!),
      session: { tokenHash: hashToken(token), expiresAt: expires, userAgent: req.headers['user-agent']?.slice(0, 300) ?? null },
    });
    if (!res.ok) {
      if (res.reason === 'username') throw new HttpError(409, 'username_taken', 'Brukernavnet er tatt. Velg et annet.');
      throw badRequest('Invitasjonskoden er ugyldig, brukt eller utløpt.');
    }
    setSessionCookie(reply, token, expires);
    rememberDevice(reply, req, res.user.id);
    reply.code(201);
    return { ok: true, user: authUser(res.user) };
  });

  app.post<{ Body: ResetPasswordRequest }>('/api/auth/reset', async (req, reply): Promise<LoginResponse> => {
    const ip = req.ip;
    if (codeLimiter.blocked(ip)) throw new HttpError(429, 'too_many_attempts', 'For mange forsøk. Vent en time og prøv igjen.');
    const resetToken = typeof req.body?.token === 'string' ? req.body.token.slice(0, 200) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!resetToken || !repo.passwordResetUsable(hashToken(resetToken))) {
      codeLimiter.fail(ip);
      throw badRequest('Lenken er ugyldig, brukt eller utløpt. Be om en ny.');
    }
    const passwordError = passwordProblem(password);
    if (passwordError) throw badRequest(passwordError);
    const passwordHash = await hashPassword(password);
    const { token, expires } = sessionFor();
    const user = repo.usePasswordReset({
      tokenHash: hashToken(resetToken),
      passwordHash,
      session: { tokenHash: hashToken(token), expiresAt: expires, userAgent: req.headers['user-agent']?.slice(0, 300) ?? null },
    });
    if (!user) throw badRequest('Lenken er ugyldig, brukt eller utløpt. Be om en ny.');
    setSessionCookie(reply, token, expires);
    rememberDevice(reply, req, user.id);
    return { ok: true, user: authUser(user) };
  });
}
