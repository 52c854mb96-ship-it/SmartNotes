import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectLicenses, licenseAllowed, licenseOf, ownLicenseText, packageDirOf, virtualPackageOf } from './licenses';

function fakePackage(root: string, name: string, pkg: Record<string, unknown>, files: Record<string, string> = {}): string {
  const dir = path.join(root, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...pkg }));
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), text);
  return dir;
}

describe('lisenslista for web-appen', () => {
  it('finner pakken en modul kommer fra, også med scope, nøstede pakker og spørrestreng', () => {
    expect(packageDirOf('/app/node_modules/react/cjs/react.production.js')).toBe('/app/node_modules/react');
    expect(packageDirOf('/app/node_modules/@scope/pakke/dist/a.js')).toBe('/app/node_modules/@scope/pakke');
    expect(packageDirOf('/app/node_modules/a/node_modules/b/index.js')).toBe('/app/node_modules/a/node_modules/b');
    expect(packageDirOf('/app/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url')).toBe('/app/node_modules/pdfjs-dist');
    expect(packageDirOf('/app/web/src/main.tsx')).toBeNull();
    expect(packageDirOf('/app/node_modules/@scope')).toBeNull();
  });

  it('kjenner igjen hjelpekoden fra byggeverktøyene', () => {
    expect(virtualPackageOf('\0rolldown/runtime.js')).toBe('rolldown');
    expect(virtualPackageOf('\0vite/preload-helper.js')).toBe('vite');
    expect(virtualPackageOf('/@vite-plugin-pwa/virtual:pwa-register')).toBe('vite-plugin-pwa');
    expect(virtualPackageOf('/app/web/src/main.tsx')).toBeNull();
  });

  it('leser lisensfeltet i alle vanlige former', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT');
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC');
    expect(licenseOf({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe('(MIT OR Apache-2.0)');
    expect(licenseOf({})).toBeNull();
  });

  it('godtar bare lisenser som tillater at koden følger med appen', () => {
    expect(licenseAllowed('MIT')).toBe(true);
    expect(licenseAllowed('(MIT OR GPL-3.0)')).toBe(true);
    expect(licenseAllowed('MIT AND Apache-2.0')).toBe(true);
    expect(licenseAllowed('GPL-3.0-only')).toBe(false);
    expect(licenseAllowed('MIT AND GPL-2.0')).toBe(false);
    expect(licenseAllowed('SEE LICENSE IN LICENSE.txt')).toBe(false);
  });

  it('tar bare Vites egen lisens, ikke lisensene til pakkene Vite har bakt inn i seg selv', () => {
    expect(ownLicenseText('# MIT License\r\n\r\nCopyright Vite\r\n\r\n# Licenses of bundled dependencies\r\nannet')).toBe('# MIT License\n\nCopyright Vite');
    expect(ownLicenseText('MIT\n\nCopyright\n')).toBe('MIT\n\nCopyright');
  });

  it('samler pakkene med lisenstekst, én gang per tekst, og stopper ved en lisens som ikke er tillatt', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smartnotes-lisenser-'));
    try {
      const mit = 'MIT License\n\nCopyright (c) Noen';
      const a = fakePackage(root, 'a', { license: 'MIT', author: 'Ola Nordmann <ola@example.com>', repository: 'github:ola/a' }, { LICENSE: mit });
      const b = fakePackage(root, '@x/b', { license: 'MIT', homepage: 'https://b.example' }, { 'LICENSE.md': `${mit}\r\n` });
      const c = fakePackage(root, 'c', { license: 'ISC' });
      const file = collectLicenses([b, a, c, a]);
      expect(file.packages.map((p) => p.name)).toEqual(['@x/b', 'a', 'c']);
      expect(file.texts).toEqual([mit]);
      expect(file.packages[1]).toMatchObject({ license: 'MIT', author: 'Ola Nordmann', url: 'https://github.com/ola/a', text: 0 });
      expect(file.packages[0]).toMatchObject({ url: 'https://b.example', text: 0 });
      expect(file.packages[2]).toMatchObject({ license: 'ISC', text: null });

      const gpl = fakePackage(root, 'gpl', { license: 'GPL-3.0-only' });
      const none = fakePackage(root, 'ingen', {});
      expect(() => collectLicenses([a, gpl, none])).toThrow(/gpl@1\.0\.0 har lisensen «GPL-3\.0-only»[\s\S]*ingen@1\.0\.0 oppgir ingen lisens/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
