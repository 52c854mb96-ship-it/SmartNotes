import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

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
 * kjøretidsmodulene under (`generateSW` i vite.config.ts, med precache, ruter, strategier, utløp og «cacheable response»).
 */
export const SERVICE_WORKER_PACKAGES = [
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
  'workbox-expiration',
  'workbox-cacheable-response',
];

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

/** Om et SPDX-uttrykk er tillatt: ett av alternativene ved OR, alle delene ved AND. */
export function licenseAllowed(spdx: string): boolean {
  const expr = spdx.replace(/[()]/g, ' ').trim();
  return expr.split(/\s+OR\s+/i).some((alt) => alt.split(/\s+AND\s+/i).every((part) => ALLOWED_LICENSES.has(part.trim())));
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
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const match = names.filter((n) => /^(licen[sc]e|copying)([.-].*)?$/i.test(n)).sort();
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

/** Lager lisenslista for pakkemappene. Kaster med en norsk melding når en lisens mangler eller ikke er tillatt. */
export function collectLicenses(dirs: Iterable<string>): LicenseFile {
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
    byName.set(key, {
      name,
      version,
      license: license ?? 'ukjent',
      author: authorOf(pkg),
      url: urlOf(pkg),
      text: null,
      textValue: file ? ownLicenseText(fs.readFileSync(file, 'utf8')) : null,
    });
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

/** Vite-pluginen: skriver `licenses.json` ved siden av appen når den bygges. */
export function thirdPartyLicenses(root: string): Plugin {
  return {
    name: 'smartnotes-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      const dirs = new Set<string>();
      for (const out of Object.values(bundle)) {
        if (out.type === 'chunk') {
          for (const [id, mod] of Object.entries(out.modules)) {
            if (mod.renderedLength === 0) continue;
            const virtual = virtualPackageOf(id);
            const dir = virtual ? resolvePackageDir(root, virtual) : packageDirOf(id);
            if (dir) dirs.add(dir);
          }
        } else {
          // Filer som kopieres som de er (f.eks. pdf.js-workeren og KaTeX-fontene).
          for (const original of out.originalFileNames ?? []) {
            const dir = packageDirOf(path.resolve(root, original));
            if (dir) dirs.add(dir);
          }
        }
      }
      for (const name of SERVICE_WORKER_PACKAGES) dirs.add(resolvePackageDir(root, name));
      const file = collectLicenses(dirs);
      this.emitFile({ type: 'asset', fileName: 'licenses.json', source: JSON.stringify(file) });
    },
  };
}

/** Mappen til en pakke slik Node finner den fra `root` (opp gjennom node_modules-mappene). */
function resolvePackageDir(root: string, name: string): string {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (path.dirname(dir) === dir) throw new Error(`Fant ikke pakken ${name} for lisenslista.`);
  }
}
