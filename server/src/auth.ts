import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LoginRequest, MeResponse } from '@smartnotes/shared';
import type { Config } from './config.js';
import type { Repo } from './db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'sn_session';
/** Mutasjoner må ha denne headeren – nettlesere sender den ikke ved CSRF fra andre sider. */
export const CSRF_HEADER = 'x-smartnotes';

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const hashToken = (t: string) => sha256(t).toString('hex');

function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(sha256(given), sha256(expected));
}

/** Enkel begrensning av innloggingsforsøk per IP (i minnet). */
class LoginLimiter {
  private readonly attempts = new Map<string, number[]>();
  constructor(
    private readonly max = 10,
    private readonly windowMs = 15 * 60_000,
  ) {}

  blocked(ip: string): boolean {
    const list = (this.attempts.get(ip) ?? []).filter((t) => t > Date.now() - this.windowMs);
    this.attempts.set(ip, list);
    return list.length >= this.max;
  }

  fail(ip: string): void {
    const list = this.attempts.get(ip) ?? [];
    list.push(Date.now());
    this.attempts.set(ip, list);
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/me', '/api/auth/logout']);

export function registerAuth(app: FastifyInstance, repo: Repo, config: Config): void {
  const limiter = new LoginLimiter();

  const sessionValid = (req: FastifyRequest): boolean => {
    const token = req.cookies[SESSION_COOKIE];
    return !!token && repo.validSession(hashToken(token));
  };

  // Alle /api-kall krever innlogging (unntatt noen få), og mutasjoner krever CSRF-headeren.
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const url = req.url.split('?')[0]!;
    if (!url.startsWith('/api/')) return;
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (mutating && req.headers[CSRF_HEADER] !== '1') {
      throw new HttpError(403, 'csrf', 'Forespørselen ble avvist (mangler sikkerhetsheader).');
    }
    if (PUBLIC_PATHS.has(url)) return;
    if (!sessionValid(req)) throw new HttpError(401, 'unauthorized', 'Du må logge inn.');
  });

  app.post<{ Body: LoginRequest }>('/api/auth/login', async (req, reply: FastifyReply) => {
    const ip = req.ip;
    if (limiter.blocked(ip)) throw new HttpError(429, 'too_many_attempts', 'For mange feil forsøk. Vent et kvarter og prøv igjen.');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!passwordMatches(password, config.appPassword)) {
      limiter.fail(ip);
      throw new HttpError(401, 'wrong_password', 'Feil passord.');
    }
    limiter.reset(ip);
    const token = randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
    repo.pruneSessions();
    repo.createSession(hashToken(token), expires, req.headers['user-agent']?.slice(0, 300) ?? null);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      path: '/',
      expires,
    });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) repo.deleteSession(hashToken(token));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', async (req): Promise<MeResponse> => ({ authenticated: sessionValid(req) }));
}
