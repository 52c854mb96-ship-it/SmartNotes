import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UsageSummaryResponse } from '@smartnotes/shared';
import type { Config } from '../config.js';
import type { Repo } from '../db.js';
import { summarizeUsage } from '../usage.js';
import { parse } from './library.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function registerUsageRoutes(app: FastifyInstance, d: { repo: Repo; config: Config }): void {
  app.get('/api/usage', async (req): Promise<UsageSummaryResponse> => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }), req.query);
    const since = Date.now() - days * DAY_MS;
    return summarizeUsage(d.repo.usageSince(since), { days, since, usdNok: d.config.usdNok });
  });
}
