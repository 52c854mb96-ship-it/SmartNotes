// Starter den ferdigbygde serveren for ende-til-ende-tester: falsk Claude, midlertidig datamappe.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-e2e-'));
const child = spawn(process.execPath, ['server/dist/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.E2E_PORT ?? '8790',
    DATA_DIR: dataDir,
    APP_PASSWORD: 'e2e-passord',
    COOKIE_SECURE: 'false',
    SMARTNOTES_FAKE_CLAUDE: '1',
    FAKE_CLAUDE_DELAY_MS: '1500',
    LOG_LEVEL: 'warn',
  },
});
const stop = () => {
  child.kill('SIGTERM');
  fs.rmSync(dataDir, { recursive: true, force: true });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
