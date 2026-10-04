import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { app, worker } = await buildApp(config);

if (config.fakeClaude) app.log.warn('SMARTNOTES_FAKE_CLAUDE er på – notater konverteres med testinnhold, ikke Claude.');
if (!process.env.APP_PASSWORD) app.log.warn('APP_PASSWORD er ikke satt – bruker utviklingspassordet «smartnotes».');

worker.start();
await app.listen({ port: config.port, host: config.host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'avslutter');
    void app.close().then(() => process.exit(0));
  });
}
