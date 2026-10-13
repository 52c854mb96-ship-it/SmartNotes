import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lisensene til pakkene som havner i web-appen («Om SmartNotes» → «Lisenser»). Under byggingen samles hver modul fra
 * `node_modules` som faktisk er med i bunten, og pakken den hører til, skrives til `licenses.json` med navn, versjon,
 * lisens og lisensteksten. En pakke med en lisens som ikke er på lista under, stopper byggingen, så en ny avhengighet
 * med en lisens som ikke tillater at koden følger med appen, ikke slipper gjennom uten at noen ser på den.
 *
 * Tenk på det som innholdsfortegnelsen på en matvare: alt som er i pakka, står på etiketten, og det som ikke er lov,
 * kommer ikke i pakka.
 */

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  author: string | null;
  url: string | null;
  /** Indeks i `texts`, eller null når pakken ikke har en egen lisensfil. */
  text: number | null;
}

export interface LicenseFile {
  packages: LicenseEntry[];
  /** Lisenstekstene, hver bare én gang (mange pakker har samme tekst). */
  texts: string[];
}

/** Lisenser som tillater at koden følger med appen, med lisensteksten. Alt annet stopper byggingen. */
export const ALLOWED_LICENSES = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense', 'CC0-1.0', 'OFL-1.1']);

/**
 * Pakker som er med i appen uten å gå gjennom Vite: service workeren lages av Workbox etter selve byggingen, med
 * kjøretidsmodulene under (`generateSW` i vite.config.ts, med precache, ruter, strategier, utløp og «cacheable response»),
 * malen til `sw.js` fra workbox-build og modullasteren øverst i `sw.js` fra rollup-plugin-off-main-thread.
 */
export const SERVICE_WORKER_PACKAGES = [
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
  'workbox-expiration',
  'workbox-cacheable-response',
  'workbox-build',
  '@trickfilm400/rollup-plugin-off-main-thread',
];

/**
 * Fonter som har en annen lisens enn pakken de ligger i. En font fra en pakke som ikke står her, stopper byggingen, så
 * lisensen til nye fonter blir sjekket. KaTeX-fontene er under SIL Open Font License 1.1 (navnetabellen i fontfilene).
 */
export const FONT_LICENSES: Record<string, { name: string; license: string; copyright: string; textFile: string }> = {
  katex: {
    name: 'KaTeX-fontene',
    license: 'OFL-1.1',
    copyright:
      'Copyright (c) 2009-2010, Design Science, Inc. (www.mathjax.org)\nCopyright (c) 2014-2018 Khan Academy (www.khanacademy.org),\nwith Reserved Font Names KaTeX_AMS, KaTeX_Caligraphic, KaTeX_Fraktur, KaTeX_Main, KaTeX_Math, KaTeX_SansSerif, KaTeX_Script, KaTeX_Size1–4 and KaTeX_Typewriter.',
    textFile: 'OFL-1.1.txt',
  },
};

/**
 * Kode fra andre som en pakke har bakt inn i seg selv, og som bare kan kjennes igjen i den ferdige koden. pdf.js har
 * core-js (MIT) med en lisensmerknad der versjonen står; finnes merket, tas core-js med i lista.
 */
export const EMBEDDED_CODE: { pattern: RegExp; name: string; license: string; copyright: RegExp; url: string }[] = [
  {
    pattern: /zloirock\/core-js\/blob\/v(\d+\.\d+\.\d+)\/LICENSE/,
    name: 'core-js',
    license: 'MIT',
    copyright: /copyright:\s*[`'"]([^`'"]*Denis Pushkarev[^`'"]*)[`'"]/,
    url: 'https://github.com/zloirock/core-js',
  },
];

const FONT_FILE = /\.(woff2?|ttf|otf|eot)$/i;
const STYLESHEET = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/i;

/** MIT-lisensen med en copyright-linje (for kode som er bakt inn uten egen lisensfil). */
function mitText(copyright: string): string {
  return `MIT License\n\n${copyright}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
}

/**
 * Hjelpekode som byggeverktøyene legger inn i bunten som virtuelle moduler (uten sti i node_modules), og pakken den
 * kommer fra: Rolldowns kjøretid, Vites forhåndslasting og registreringen av service workeren.
 */
export const VIRTUAL_MODULES: [RegExp, string][] = [
  [/^\0rolldown\//, 'rolldown'],
  [/^\0vite\//, 'vite'],
  [/virtual:pwa-register/, 'vite-plugin-pwa'],
];

/** Pakken en virtuell modul kommer fra (se `VIRTUAL_MODULES`), ellers null. */
export function virtualPackageOf(id: string): string | null {
  return VIRTUAL_MODULES.find(([re]) => re.test(id))?.[1] ?? null;
}

/** Mappen til pakken en modul kommer fra (`…/node_modules/navn` eller `…/node_modules/@scope/navn`), ellers null. */
export function packageDirOf(id: string): string | null {
  const file = id.replace(/^\0/, '').split('?')[0]!.split(path.sep).join('/');
  const marker = '/node_modules/';
  const at = file.lastIndexOf(marker);
  if (at < 0) return null;
  const parts = file.slice(at + marker.length).split('/');
  const depth = parts[0]?.startsWith('@') ? 2 : 1;
  if (parts.length <= depth || !parts[depth - 1]) return null;
  return `${file.slice(0, at)}${marker}${parts.slice(0, depth).join('/')}`;
}

/** Lisensfeltet i package.json som én SPDX-tekst («MIT», «(MIT OR Apache-2.0)»), eller null. */
export function licenseOf(pkg: Record<string, unknown>): string | null {
  const field = pkg.license ?? pkg.licenses;
  if (typeof field === 'string') return field.trim() || null;
  const types = (Array.isArray(field) ? field : [field])
    .map((l) => (l && typeof l === 'object' && typeof (l as { type?: unknown }).type === 'string' ? (l as { type: string }).type : null))
    .filter((t): t is string => t !== null);
  if (types.length === 0) return null;
  return types.length === 1 ? types[0]! : `(${types.join(' OR ')})`;
}

/**
 * Om et SPDX-uttrykk er tillatt: ett av alternativene ved OR, alle delene ved AND (AND binder sterkere enn OR, og
 * parenteser respekteres). «X WITH unntak» er tillatt når X er det. Alt annet (ukjente tegn, «SEE LICENSE IN …») er
 * ikke tillatt.
 */
export function licenseAllowed(spdx: string): boolean {
  const tokens = spdx.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const or = (): boolean | null => {
    let left = and();
    while (left !== null && peek()?.toUpperCase() === 'OR') {
      i++;
      const right = and();
      left = right === null ? null : left || right;
    }
    return left;
  };
  const and = (): boolean | null => {
    let left = atom();
    while (left !== null && peek()?.toUpperCase() === 'AND') {
      i++;
      const right = atom();
      left = right === null ? null : left && right;
    }
    return left;
  };
  const atom = (): boolean | null => {
    const t = tokens[i++];
    if (t === undefined || t === ')') return null;
    if (t === '(') {
      const inner = or();
      return tokens[i++] === ')' ? inner : null;
    }
    if (['AND', 'OR', 'WITH'].includes(t.toUpperCase())) return null;
    if (peek()?.toUpperCase() === 'WITH') {
      i++;
      if (tokens[i++] === undefined) return null;
    }
    return ALLOWED_LICENSES.has(t);
  };
  const result = or();
  return result === true && i === tokens.length;
}

function authorOf(pkg: Record<string, unknown>): string | null {
  const a = pkg.author;
  if (typeof a === 'string') return a.replace(/\s*[<(].*$/, '').trim() || null;
  if (a && typeof a === 'object' && typeof (a as { name?: unknown }).name === 'string') return (a as { name: string }).name;
  return null;
}

function urlOf(pkg: Record<string, unknown>): string | null {
  if (typeof pkg.homepage === 'string' && /^https?:\/\//.test(pkg.homepage)) return pkg.homepage;
  const repo = pkg.repository;
  const raw = typeof repo === 'string' ? repo : repo && typeof repo === 'object' ? (repo as { url?: unknown }).url : null;
  if (typeof raw !== 'string') return null;
  const url = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
  if (/^https?:\/\//.test(url)) return url;
  // «github:eier/navn» eller bare «eier/navn».
  const short = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(url);
  return short ? `https://github.com/${short[1]}` : null;
}

/** Lisensfila i pakkemappen (LICENSE, LICENCE, LICENSE.md, COPYING …), eller null. */
export function licenseTextFile(dir: string): string | null {
  return firstFile(dir, /^(licen[sc]e|copying)([.-].*)?$/i);
}

/**
 * NOTICE-fila (Apache-lisensen krever at den følger med), eller null. THIRD-PARTY-LICENSE-filer tas ikke med: de gjelder
 * pakkene et verktøy (som rolldown) er bygd av, ikke koden som havner i appen.
 */
export function noticeFile(dir: string): string | null {
  return firstFile(dir, /^notice([.-].*)?$/i);
}

function firstFile(dir: string, pattern: RegExp): string | null {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const match = names.filter((n) => pattern.test(n)).sort();
  return match.length > 0 ? path.join(dir, match[0]!) : null;
}

/**
 * Pakkens egen lisenstekst. Vite legger lisensene til alle pakkene den har bakt inn i seg selv, i samme fil; de
 * gjelder Vite som verktøy, ikke hjelpekoden i appen, så bare den første delen tas med.
 */
export function ownLicenseText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bundled = /^#+ Licenses of bundled dependencies/im.exec(normalized);
  return (bundled ? normalized.slice(0, bundled.index) : normalized).trim();
}

/** En oppføring som ikke er en npm-pakke med egen package.json (fonter og kode bakt inn i en pakke). */
export interface ExtraEntry {
  name: string;
  version: string;
  license: string;
  author: string | null;
  url: string | null;
  text: string | null;
}

/** Lager lisenslista for pakkemappene. Kaster med en norsk melding når en lisens mangler eller ikke er tillatt. */
export function collectLicenses(dirs: Iterable<string>, extras: ExtraEntry[] = []): LicenseFile {
  const byName = new Map<string, LicenseEntry & { textValue: string | null }>();
  const problems: string[] = [];
  for (const dir of dirs) {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as Record<string, unknown>;
    } catch {
      continue; // en undermappe uten package.json (f.eks. dist-mapper med «type»-fil) hører til pakken over
    }
    const name = typeof pkg.name === 'string' ? pkg.name : path.basename(dir);
    const version = typeof pkg.version === 'string' ? pkg.version : '';
    const key = `${name}@${version}`;
    if (byName.has(key)) continue;
    const license = licenseOf(pkg);
    if (!license) problems.push(`${key} oppgir ingen lisens`);
    else if (!licenseAllowed(license)) problems.push(`${key} har lisensen «${license}», som ikke er på lista over tillatte lisenser`);
    const file = licenseTextFile(dir);
    const notice = noticeFile(dir);
    const texts = [
      file ? ownLicenseText(fs.readFileSync(file, 'utf8')) : null,
      notice ? fs.readFileSync(notice, 'utf8').replace(/\r\n/g, '\n').trim() : null,
    ].filter((t): t is string => !!t);
    byName.set(key, {
      name,
      version,
      license: license ?? 'ukjent',
      author: authorOf(pkg),
      url: urlOf(pkg),
      text: null,
      textValue: texts.length > 0 ? texts.join('\n\n---\n\n') : null,
    });
  }
  for (const e of extras) {
    const key = `${e.name}@${e.version}`;
    if (byName.has(key)) continue;
    if (!licenseAllowed(e.license)) problems.push(`${key} har lisensen «${e.license}», som ikke er på lista over tillatte lisenser`);
    byName.set(key, { name: e.name, version: e.version, license: e.license, author: e.author, url: e.url, text: null, textValue: e.text });
  }
  if (problems.length > 0) {
    throw new Error(`Lisenssjekken for web-appen stoppet byggingen:\n- ${problems.join('\n- ')}\nSe web/build/licenses.ts.`);
  }
  const texts: string[] = [];
  const index = new Map<string, number>();
  const packages = [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'))
    .map(({ textValue, ...entry }) => {
      if (textValue !== null) {
        let i = index.get(textValue);
        if (i === undefined) {
          i = texts.push(textValue) - 1;
          index.set(textValue, i);
        }
        entry.text = i;
      }
      return entry;
    });
  return { packages, texts };
}

/** Det byggingen ga fra seg, slik `generateBundle` ser det (bare feltene lisenslista trenger). */
export type BundleOutput =
  | { type: 'chunk'; code: string; modules: Record<string, { renderedLength: number }> }
  | { type: 'asset'; fileName: string; source: string | Uint8Array; originalFileNames?: readonly string[] };

/**
 * Går gjennom bunten: mappene til pakkene som er med, og oppføringene for fonter og innebygd kode. CSS-moduler teller
 * selv om de har lengde 0 i JavaScript-biten (CSS-en trekkes ut i en egen fil).
 */
export function scanBundle(root: string, outputs: Iterable<BundleOutput>): { dirs: Set<string>; extras: ExtraEntry[] } {
  const dirs = new Set<string>();
  const extras = new Map<string, ExtraEntry>();
  const scanCode = (code: string) => {
    for (const e of EMBEDDED_CODE) {
      const m = e.pattern.exec(code);
      if (!m) continue;
      const copyright = e.copyright.exec(code)?.[1] ?? null;
      extras.set(e.name, {
        name: e.name,
        version: m[1]!,
        license: e.license,
        author: null,
        url: e.url,
        text: e.license === 'MIT' && copyright ? mitText(copyright) : null,
      });
    }
  };
  for (const out of outputs) {
    if (out.type === 'chunk') {
      for (const [id, mod] of Object.entries(out.modules)) {
        const file = id.replace(/^\0/, '').split('?')[0]!;
        if (mod.renderedLength === 0 && !STYLESHEET.test(file)) continue;
        const virtual = virtualPackageOf(id);
        const dir = virtual ? resolvePackageDir(root, virtual) : packageDirOf(id);
        if (dir) dirs.add(dir);
      }
      scanCode(out.code);
    } else {
      // Filer som kopieres som de er (f.eks. pdf.js-workeren og KaTeX-fontene).
      for (const original of out.originalFileNames ?? []) {
        const full = path.resolve(root, original);
        const dir = packageDirOf(full);
        if (!dir) continue;
        if (FONT_FILE.test(full)) {
          const name = dir.slice(dir.lastIndexOf('/node_modules/') + '/node_modules/'.length);
          const font = FONT_LICENSES[name];
          if (!font) throw new Error(`Lisenssjekken for web-appen stoppet byggingen:\n- fonten ${original} fra ${name} står ikke i FONT_LICENSES (web/build/licenses.ts). Sjekk lisensen i fontfila.`);
          const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version?: string };
          extras.set(font.name, {
            name: font.name,
            version: pkg.version ?? '',
            license: font.license,
            author: null,
            url: null,
            text: `${font.copyright}\n\n${fs.readFileSync(path.join(HERE, 'texts', font.textFile), 'utf8').trim()}`,
          });
        }
        dirs.add(dir);
      }
      if (/\.(m?js)$/.test(out.fileName)) scanCode(typeof out.source === 'string' ? out.source : Buffer.from(out.source).toString('utf8'));
    }
  }
  return { dirs, extras: [...extras.values()] };
}

/** Vite-pluginen: skriver `licenses.json` ved siden av appen når den bygges. */
export function thirdPartyLicenses(root: string): Plugin {
  return {
    name: 'smartnotes-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      const { dirs, extras } = scanBundle(root, Object.values(bundle) as BundleOutput[]);
      for (const name of SERVICE_WORKER_PACKAGES) dirs.add(resolvePackageDir(root, name));
      const file = collectLicenses(dirs, extras);
      this.emitFile({ type: 'asset', fileName: 'licenses.json', source: JSON.stringify(file) });
    },
  };
}

/** Mappen til en pakke slik Node finner den fra `root` (opp gjennom node_modules-mappene). */
export function resolvePackageDir(root: string, name: string): string {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) throw new Error(`Fant ikke pakken ${name} for lisenslista.`);
  }
}
