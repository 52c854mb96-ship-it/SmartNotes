import type { FastifyInstance } from 'fastify';
import type { BackupStatusResponse } from '@smartnotes/shared';
import { backupBytes, createBackup, LAST_BACKUP_KEY } from '../backup.js';
import type { Config } from '../config.js';
import type { Repo } from '../db.js';
import type { Storage } from '../storage.js';

export function registerBackupRoutes(app: FastifyInstance, d: { repo: Repo; storage: Storage; config: Config }): void {
  app.get('/api/backup/status', async (): Promise<BackupStatusResponse> => {
    const last = Number(d.repo.getMeta(LAST_BACKUP_KEY));
    return {
      lastBackupAt: last > 0 ? new Date(last).toISOString() : null,
      approxBytes: await backupBytes(d.storage),
      notes: d.repo.backupSummary().notes,
    };
  });

  // Ingen automatisk HEAD-rute: den ville laget en kopi av databasen som aldri ble sendt.
  app.get('/api/backup', { exposeHeadRoute: false }, async (req, reply) => {
    const { name, stream } = await createBackup(d.repo, d.storage, {
      version: d.config.version,
      onError: (err) => req.log.error({ err }, 'sikkerhetskopien ble avbrutt'),
    });
    // «Sist sendt» settes først når hele arkivet er overlevert til nettet, ikke når nedlastingen avbrytes underveis.
    // En liten kopi kan likevel rekke å bli sendt helt selv om nettleseren avbryter, så det er ingen kvittering.
    reply.raw.once('finish', () => {
      try {
        d.repo.setMeta(LAST_BACKUP_KEY, String(Date.now()));
      } catch (err) {
        req.log.warn({ err }, 'kunne ikke lagre tidspunktet for sikkerhetskopien');
      }
    });
    return reply
      .type('application/gzip')
      .header('Content-Disposition', `attachment; filename="${name}.tar.gz"`)
      .header('Cache-Control', 'no-store')
      .send(stream);
  });
}
