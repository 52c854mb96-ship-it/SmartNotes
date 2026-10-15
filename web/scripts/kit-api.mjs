#!/usr/bin/env node
/**
 * Lager en kort API-oversikt (API.md) for en kit-mappe fra JSDoc, med TypeScript-kompilatoren.
 *
 * Bruk (fra web/):
 *   node scripts/kit-api.mjs src/viz/geofag/kit > src/viz/geofag/kit/API.md
 *   node scripts/kit-api.mjs src/viz/kit/scene --kort > src/viz/kit/scene/API.md
 *
 * Skriptet leser index.ts i mappa og går gjennom eksportene i samme rekkefølge:
 *   - `export * from './fil'` i mappa gir et avsnitt per fil («## fil.tsx») med det fila eksporterer: først
 *     deklarasjonene i fila, så det den sender videre fra andre filer.
 *   - `export * from '../annet-kit'` utenfor mappa gir én linje med navnene (de står i det kit-ets egen dokumentasjon).
 *   - `export { a, b } from '../../kjemi/kit/fil'` utenfor mappa gir et avsnitt per kit med de lånte navnene.
 * Hvert navn får første avsnitt av JSDoc-en sin (fram til første tomme linje eller @-tagg), samlet på én linje. Sier
 * ikke første avsnitt hvor ankerpunktet er, tas teksten i et senere avsnitt som begynner med «Ankerpunkt» med (uten
 * kodeeksemplene). Kodeeksempler (linjer med innrykk) og JSX-tagger i teksten står i backticks.
 * Uten --kort får komponentene også en linje med props (valgfri med ?, standardverdi med =, typen når den ikke er
 * number, string eller boolean), funksjonene parameterne og det de gir (→), avsnittene første avsnitt av
 * filkommentaren, og typene står samlet til slutt i hvert avsnitt. Med --kort blir det som scene-kit-ets API.md:
 * bare navn og første avsnitt for verdiene.
 *
 * Valg:
 *   --kort                  bare navn og første avsnitt (ingen props, parametre, filkommentarer eller typer)
 *   --tittel <tekst>        overskriften (standard «Scene-kit» for kit/scene, «Geofag-kit» for geofag/kit)
 *   --import <sti>          importstien fra en kapittelmappe (standard ../kit for <fag>/kit, ellers ../../<sti>)
 *   --galleri-prefiks <p>   prefikset i ?galleri= (standard «geo-» for geofag/kit, ellers ingenting)
 * Navn uten JSDoc skrives til stderr, så de kan få en kommentar i kildefila.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

// ---------------------------------------------------------------- argumenter

const args = process.argv.slice(2);
const valg = { kort: false, tittel: null, import: null, galleriPrefiks: null };
let mappeArg = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--kort') valg.kort = true;
  else if (a === '--tittel') valg.tittel = args[++i] ?? null;
  else if (a === '--import') valg.import = args[++i] ?? null;
  else if (a === '--galleri-prefiks') valg.galleriPrefiks = args[++i] ?? '';
  else if (a === '-h' || a === '--help') {
    process.stdout.write('Bruk: node scripts/kit-api.mjs <kit-mappe> [--kort] [--tittel T] [--import STI] [--galleri-prefiks P] > API.md\n');
    process.exit(0);
  } else if (a.startsWith('-')) feil(`Ukjent valg ${a}`);
  else if (mappeArg === null) mappeArg = a;
  else feil(`Bare én kit-mappe, fikk også ${a}`);
}
if (!mappeArg) feil('Mangler kit-mappe, f.eks. node scripts/kit-api.mjs src/viz/geofag/kit > src/viz/geofag/kit/API.md');

function feil(tekst) {
  process.stderr.write(`kit-api: ${tekst}\n`);
  process.exit(1);
}

const kitDir = path.resolve(mappeArg);
const indexPath = ['index.ts', 'index.tsx'].map((f) => path.join(kitDir, f)).find((f) => fs.existsSync(f));
if (!indexPath) feil(`Fant ikke index.ts i ${kitDir}`);

const posix = (p) => p.split(path.sep).join('/');
/** Mappa som ligger under src/viz (for overskrift og importsti), f.eks. «geofag/kit» eller «kit/scene». */
const vizRoot = (() => {
  let d = kitDir;
  while (d !== path.dirname(d)) {
    if (path.basename(d) === 'viz' && path.basename(path.dirname(d)) === 'src') return d;
    d = path.dirname(d);
  }
  return null;
})();
const relViz = vizRoot ? posix(path.relative(vizRoot, kitDir)) : posix(path.basename(kitDir));
/** web/ (mappa med package.json), så kommandoen i overskriften kan kjøres derfra. */
const webDir = (() => {
  let d = kitDir;
  while (d !== path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    d = path.dirname(d);
  }
  return process.cwd();
})();
const relWeb = posix(path.relative(webDir, kitDir));

const stiDeler = relViz.split('/');
const stor = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const tittel =
  valg.tittel ??
  (relViz === 'kit' ? 'Felles kit' : stiDeler.at(-1) === 'kit' && stiDeler.length > 1 ? `${stor(stiDeler.at(-2))}-kit` : `${stor(stiDeler.at(-1))}-kit`);
const importSti = valg.import ?? (stiDeler.length === 2 && stiDeler[1] === 'kit' ? '../kit' : `../../${relViz}`);
const galleriPrefiks = valg.galleriPrefiks ?? (relViz === 'geofag/kit' ? 'geo-' : '');

// ---------------------------------------------------------------- program og typesjekker

const configPath = ts.findConfigFile(kitDir, ts.sys.fileExists, 'tsconfig.json');
let options = { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true };
if (configPath) {
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  if (parsed) options = parsed.options;
}
const program = ts.createProgram({ rootNames: [indexPath], options: { ...options, noEmit: true } });
const checker = program.getTypeChecker();
const indexFile = program.getSourceFile(indexPath);
if (!indexFile) feil(`Kunne ikke lese ${indexPath}`);

const inniKit = (fileName) => !path.relative(kitDir, fileName).startsWith('..') && !path.isAbsolute(path.relative(kitDir, fileName));

/** Kildefila en modulsti (i en import- eller eksportsetning) peker på. */
function modulFil(spec) {
  const sym = checker.getSymbolAtLocation(spec);
  const decl = sym?.declarations?.find(ts.isSourceFile);
  return decl ?? null;
}

function lokalSymbol(sym) {
  return sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

function eksporterteSymboler(sf) {
  const modul = checker.getSymbolAtLocation(sf);
  const map = new Map();
  if (!modul) return map;
  for (const s of checker.getExportsOfModule(modul)) map.set(s.getName(), s);
  return map;
}

const harEksport = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/**
 * Navnene en fil eksporterer, i rekkefølgen API.md skal ha: først deklarasjonene i fila (i kilderekkefølge), så det
 * fila sender videre (`export { … } from`, `export { … }` og `export * from`).
 */
function navnIFil(sf, sett = new Set()) {
  if (sett.has(sf.fileName)) return [];
  sett.add(sf.fileName);
  const egne = [];
  const videre = [];
  for (const st of sf.statements) {
    if (harEksport(st)) {
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) egne.push(d.name.text);
      } else if (st.name && ts.isIdentifier(st.name)) egne.push(st.name.text);
    } else if (ts.isExportDeclaration(st)) {
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) videre.push(el.name.text);
      } else if (!st.exportClause && st.moduleSpecifier) {
        const under = modulFil(st.moduleSpecifier);
        if (under) videre.push(...navnIFil(under, sett));
      }
    }
  }
  return [...new Set([...egne, ...videre])];
}

// ---------------------------------------------------------------- JSDoc

/** Rå JSDoc-blokker (`/** … *\/`) rett før en deklarasjon; for en variabel er det blokkene før `export const`. */
function jsDocBlokker(decl) {
  return ts.getJSDocCommentsAndTags(decl).filter((n) => n.kind === ts.SyntaxKind.JSDoc);
}

function blokkTekst(sf, blokk) {
  return sf.text.slice(blokk.pos, blokk.end);
}

/** Avsnittene i en JSDoc-kommentar (fram til første @-tagg), hvert som linjer med innrykket etter « * ». */
function avsnittene(raw) {
  if (!raw) return [];
  const body = raw.replace(/^\/\*\*/, '').replace(/\*\/\s*$/, '');
  const avsnitt = [];
  let ut = [];
  for (const linje of body.split('\n')) {
    const l = linje.replace(/^\s*\* ?/, '').replace(/\s+$/, '');
    if (/^\s*@\w/.test(l)) break;
    if (!l.trim()) {
      if (ut.length) avsnitt.push(ut);
      ut = [];
      continue;
    }
    ut.push(l);
  }
  if (ut.length) avsnitt.push(ut);
  return avsnitt;
}

/** Linjene i første avsnitt av en JSDoc-kommentar (fram til tom linje eller @-tagg), med innrykket etter « * ». */
function avsnittLinjer(raw) {
  return avsnittene(raw)[0] ?? [];
}

/**
 * Teksten i et senere avsnitt som begynner med «Ankerpunkt», uten kodeeksemplene, når første avsnitt ikke sier hvor
 * ankerpunktet er. Ankerpunktet er det viktigste å vite før en komponent kan brukes.
 */
function ankerAvsnitt(raw) {
  const alle = avsnittene(raw);
  const forste = (alle[0] ?? []).join(' ');
  if (/ankerpunkt/i.test(forste)) return '';
  const anker = alle.slice(1).find((a) => /^\s*Ankerpunkt/i.test(a[0] ?? ''));
  if (!anker) return '';
  const biter = deler(anker);
  return biter
    .map((b, i) => {
      if (b.type === 'kode') return '';
      // Teksten foran et eksempel som ikke tas med, slutter med punktum i stedet for kolon.
      const tekst = biter[i + 1]?.type === 'kode' ? b.tekst.replace(/:$/, '.') : b.tekst;
      return taggerSomKode(lenker(b.type === 'punkt' ? `– ${tekst}` : tekst));
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

const lenker = (s) => s.replace(/\{@link(?:code|plain)?\s+([^}|\s]+)(?:[|\s]+([^}]*))?\}/g, (_, navn, tekst) => (tekst?.trim() ? tekst.trim() : navn));

/** Kode i en tekstlinje: `kode`, eller ``kode`` når koden selv har backticks. */
const kode = (s) => (s.includes('`') ? `\`\` ${s} \`\`` : `\`${s}\``);

/** JSX-tagger i løpende tekst («en <Figure>», «<sub>/<sup>») i backticks, så Markdown ikke leser dem som HTML. */
function taggerSomKode(s) {
  return s
    .split(/(`[^`]*`)/)
    .map((bit, i) => (i % 2 === 1 ? bit : bit.replace(/<\/?[A-Za-z][\w.]*(?:\s[^<>]*)?\/?>/g, (m) => kode(m))))
    .join('');
}

/**
 * Deler linjene i tekst, punkter («- …» med fortsettelseslinjer) og kode (linjer med innrykk som ikke hører til et
 * punkt, som eksemplene i JSDoc-en: «*   <Snittblokk … />»). Gir bitene i rekkefølge.
 */
function deler(linjer) {
  const biter = [];
  let punktInnrykk = -1;
  for (const l of linjer) {
    const innrykk = l.length - l.trimStart().length;
    const t = l.trim();
    if (/^[-•] /.test(t)) {
      biter.push({ type: 'punkt', tekst: t.slice(2) });
      punktInnrykk = innrykk;
      continue;
    }
    const sist = biter.at(-1);
    if (punktInnrykk >= 0 && innrykk > punktInnrykk && sist?.type === 'punkt') {
      sist.tekst += ` ${t}`;
      continue;
    }
    punktInnrykk = -1;
    const type = innrykk >= 2 ? 'kode' : 'tekst';
    if (sist?.type === type) sist.tekst += ` ${t}`;
    else biter.push({ type, tekst: t });
  }
  return biter;
}

/**
 * Første avsnitt av en JSDoc-kommentar på én linje. Med --kort som før (linjene skjøtes med mellomrom); ellers står
 * kodeeksemplene i backticks, så de ikke leses som HTML.
 */
function forsteAvsnitt(raw) {
  const linjer = avsnittLinjer(raw);
  if (valg.kort) return lenker(linjer.map((l) => l.trim()).join(' ')).trim();
  return deler(linjer)
    .map((b) => (b.type === 'kode' ? kode(b.tekst) : taggerSomKode(lenker(b.type === 'punkt' ? `– ${b.tekst}` : b.tekst))))
    .join(' ')
    .trim();
}

/** Første avsnitt av en filkommentar som Markdown: punktlister blir egne linjer. */
function forsteAvsnittBlokk(raw) {
  const ut = [];
  for (const b of deler(avsnittLinjer(raw))) {
    if (b.type === 'punkt') ut.push(`- ${taggerSomKode(lenker(b.tekst))}`);
    else if (b.type === 'kode') ut.push(kode(b.tekst));
    else ut.push(taggerSomKode(lenker(b.tekst)));
  }
  return ut.join('\n');
}

/**
 * Filkommentaren øverst i en fil: den første JSDoc-blokken når fila begynner med en import eller eksport fra en annen
 * fil, eller når det står flere JSDoc-blokker før den første setningen (da hører den siste til setningen).
 */
function filKommentar(sf) {
  const forste = sf.statements[0];
  if (!forste) return '';
  const blokker = ts
    .getLeadingCommentRanges(sf.text, 0)
    ?.filter((r) => r.kind === ts.SyntaxKind.MultiLineCommentTrivia && sf.text.startsWith('/**', r.pos));
  if (!blokker?.length) return '';
  const erImport = ts.isImportDeclaration(forste) || (ts.isExportDeclaration(forste) && forste.moduleSpecifier);
  if (!erImport && blokker.length < 2) return '';
  const b = blokker[0];
  return sf.text.slice(b.pos, b.end);
}

const filKommentarer = new Map();
function erFilKommentar(sf, raw) {
  if (!filKommentarer.has(sf.fileName)) filKommentarer.set(sf.fileName, filKommentar(sf));
  return raw && raw === filKommentarer.get(sf.fileName);
}

/** Første avsnitt av JSDoc-en til et symbol (siste blokk før deklarasjonen, ikke filkommentaren). */
function dokumentasjon(sym) {
  for (const decl of sym.declarations ?? []) {
    const sf = decl.getSourceFile();
    const blokker = jsDocBlokker(decl);
    const siste = blokker.at(-1);
    if (!siste) continue;
    const raw = blokkTekst(sf, siste);
    if (erFilKommentar(sf, raw)) continue;
    const tekst = forsteAvsnitt(raw);
    const anker = valg.kort ? '' : ankerAvsnitt(raw);
    if (tekst) return anker ? `${tekst} ${anker}` : tekst;
  }
  return '';
}

// ---------------------------------------------------------------- typer, parametre og props

const FORMAT =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.WriteArrowStyleSignature;

/** Props som sier hvor en komponent står, og som derfor står først i props-linja. */
const PLASS_PROPS = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'at']);
/** Props som sier hvor stor en komponent er (avgjør om basistypen eller de egne props kommer først). */
const STORRELSE_PROPS = new Set(['w', 'h', 'r', 'size', 'bredde', 'hoyde', 'width', 'height']);

/** Typer som ikke skrives i props-linja, fordi de er selvsagte. */
const SKJULTE_TYPER = new Set(['number', 'string', 'boolean', 'ReactNode', 'React.ReactNode', 'any', 'unknown']);

/** Alle navnene kit-et eksporterer (en type med et annet aliasnavn skrives ut, så leseren ser hva den er). */
const alleEksporter = new Set(
  (() => {
    const modul = checker.getSymbolAtLocation(indexFile);
    return modul ? checker.getExportsOfModule(modul).map((s) => s.getName()) : [];
  })(),
);

function typeTekst(type, ved) {
  // Unioner av tall (0 | 2 | 1 | 3 | null) i stigende rekkefølge, med null og undefined til slutt.
  if (type.isUnion() && !type.aliasSymbol && type.types.some((t) => t.isNumberLiteral())) {
    const tall = type.types.filter((t) => t.isNumberLiteral());
    const resten = type.types.filter((t) => !t.isNumberLiteral());
    if (resten.every((t) => t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))) {
      const ledd = tall.map((t) => t.value).sort((a, b) => a - b).map(String);
      return [...ledd, ...resten.map((t) => (t.flags & ts.TypeFlags.Null ? 'null' : 'undefined'))].join(' | ');
    }
  }
  const s = checker.typeToString(type, ved, FORMAT).replace(/import\("[^"]*"\)\./g, '');
  // Et lokalt alias (type Fn = (x: number) => number) sier ingenting utenfor fila: skriv det ut.
  const alias = type.aliasSymbol;
  const fraBibliotek = alias?.declarations?.some((d) => d.getSourceFile().fileName.includes('node_modules'));
  if (alias && !fraBibliotek && !alleEksporter.has(alias.getName()) && /^\w+$/.test(s)) {
    return checker.typeToString(type, ved, FORMAT | ts.TypeFormatFlags.InTypeAlias).replace(/import\("[^"]*"\)\./g, '');
  }
  return s;
}

/**
 * Fjerner `undefined` (og `null`) fra en typetekst: «ReactNode | undefined» → «ReactNode», og parentesene som da blir
 * stående alene rundt en funksjonstype: «((g: X) => ReactNode)» → «(g: X) => ReactNode».
 */
function utenUndefined(s) {
  let t = s.replace(/(^|\s\|\s)(undefined|null)(?=\s\||$)/g, '').replace(/^\s*\|\s*/, '').trim();
  if (t.startsWith('(') && t.endsWith(')')) {
    let dybde = 0;
    let hele = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') dybde++;
      else if (t[i] === ')') dybde--;
      if (dybde === 0 && i < t.length - 1) {
        hele = false;
        break;
      }
    }
    if (hele) t = t.slice(1, -1);
  }
  return t;
}

/** Ett ledd i en union eller en egen type, kortet ned: objekter som { a, b? }, funksjoner som (a, b) => …. */
function kortLedd(t, ved, maks) {
  const s = typeTekst(t, ved);
  if (s.length <= maks) return s.replace(/;\s*\}/g, ' }');
  const kall = t.getCallSignatures();
  if (kall.length) {
    const r = typeTekst(kall[0].getReturnType(), ved);
    return `(${kall[0].parameters.map((p) => p.getName()).join(', ')}) => ${r.length <= 24 ? r : '…'}`;
  }
  const felter = t.isUnion() || t.isIntersection() ? [] : t.getProperties();
  if (felter.length) {
    const navn = felter.map((p) => p.getName() + (p.flags & ts.SymbolFlags.Optional ? '?' : ''));
    const vis = navn.length > 8 ? [...navn.slice(0, 8), '…'] : navn;
    return `{ ${vis.join(', ')} }`;
  }
  return `${s.slice(0, Math.max(12, maks - 1))}…`;
}

/** Kort, lesbar type (props, returverdier), eller '' når den er selvsagt. Lange unioner og objekter kortes ned. */
function kortType(type, ved, maks = 64) {
  const s = utenUndefined(typeTekst(type, ved));
  if (SKJULTE_TYPER.has(s)) return '';
  if (s.length <= maks) return s.replace(/;\s*\}/g, ' }');
  const t = checker.getNonNullableType(type);
  if (!t.isUnion()) return kortLedd(t, ved, maks);
  // Unionen ledd for ledd: true | false blir boolean, objekter og funksjoner kortes ned, og resten blir «…».
  const ledd = [];
  let bool = false;
  for (const m of t.types) {
    if (m.flags & ts.TypeFlags.BooleanLiteral) {
      if (!bool) ledd.push('boolean');
      bool = true;
      continue;
    }
    ledd.push(kortLedd(m, ved, 40));
  }
  const ut = [];
  let lengde = 0;
  for (const l of ledd) {
    if (ut.length && lengde + l.length > maks) {
      ut.push('…');
      break;
    }
    ut.push(l);
    lengde += l.length + 3;
  }
  return ut.join(' | ');
}

/** Funksjonsnoden bak en eksport: function X, const X = (…) => …, const X = memo(function X(…)) eller forwardRef. */
function funksjonsnode(decl) {
  if (ts.isFunctionDeclaration(decl)) return decl;
  if (ts.isVariableDeclaration(decl) && decl.initializer) {
    let init = decl.initializer;
    while (ts.isCallExpression(init) && init.arguments[0]) init = init.arguments[0];
    while (ts.isParenthesizedExpression(init) || ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init)) init = init.expression;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
  }
  return null;
}

/** Standardverdiene i et destrukturert argument: { x = 0, type = 'bolig' } eller const { … } = props i kroppen. */
function standardverdier(fn) {
  const ut = new Map();
  const param = fn?.parameters[0];
  if (!param) return ut;
  const fra = (mønster) => {
    for (const el of mønster.elements) {
      if (!el.initializer) continue;
      const navn = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : ts.isIdentifier(el.name) ? el.name.text : null;
      if (!navn) continue;
      const tekst = el.initializer.getText().replace(/\s+/g, ' ');
      if (tekst.length <= 28) ut.set(navn, tekst);
    }
  };
  if (ts.isObjectBindingPattern(param.name)) fra(param.name);
  else if (ts.isIdentifier(param.name) && fn.body && ts.isBlock(fn.body)) {
    const pNavn = param.name.text;
    for (const st of fn.body.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (ts.isObjectBindingPattern(d.name) && d.initializer && ts.isIdentifier(d.initializer) && d.initializer.text === pNavn) fra(d.name);
      }
    }
  }
  return ut;
}

/** Props-linja til en komponent: `x = 0`, `lag: SnittLag[]`, `type?: 'a' | 'b'` … */
function propsLinje(sym, decl) {
  const type = checker.getTypeOfSymbolAtLocation(sym, decl);
  const sig = type.getCallSignatures()[0];
  const param = sig?.parameters[0];
  if (!param) return '';
  const pType = checker.getTypeOfSymbolAtLocation(param, decl);
  const alle = checker.getPropertiesOfType(pType);
  if (!alle.length) return '';
  // Rekkefølgen: plassering (x, y …) først, så den delen (basistypen fra extends eller de egne props) som har
  // størrelsen (w, h, r, size …), og til slutt resten, hver del i kilderekkefølge.
  const egne = new Set((pType.aliasSymbol ?? pType.getSymbol())?.declarations ?? []);
  const arvet = (p) => egne.size > 0 && !(p.declarations ?? []).some((d) => egne.has(d.parent));
  const plass = (p) => PLASS_PROPS.has(p.getName());
  const storrelse = (liste) => liste.some((p) => STORRELSE_PROPS.has(p.getName()));
  const base = alle.filter((p) => !plass(p) && arvet(p));
  const eget = alle.filter((p) => !plass(p) && !arvet(p));
  const forst = storrelse(base) || !storrelse(eget) ? [base, eget] : [eget, base];
  const props = [...alle.filter(plass), ...forst.flat()];
  const std = standardverdier(funksjonsnode(decl));
  return props
    .map((p) => {
      const navn = p.getName();
      const valgfri = (p.flags & ts.SymbolFlags.Optional) !== 0;
      // Typen slik den står i kildefila (samme rekkefølge og aliasnavn), ellers fra typesjekkeren.
      const pd = p.declarations?.[0];
      let skrevet = pd && ts.isPropertySignature(pd) && pd.type ? utenUndefined(pd.type.getText().replace(/\s+/g, ' ')).replace(/;\s*\}/g, ' }') : null;
      if (skrevet !== null && /^\w+$/.test(skrevet) && pd?.type) {
        // Et navn som ikke eksporteres noe sted (en lokal type i fila), sier ingenting for leseren: skriv det ut.
        const typ = checker.getTypeAtLocation(pd.type);
        const dekl = (typ.aliasSymbol ?? typ.getSymbol())?.declarations?.[0];
        if (dekl && !dekl.getSourceFile().fileName.includes('node_modules') && !harEksport(dekl)) skrevet = null;
      }
      const t =
        skrevet !== null && skrevet.length <= 64
          ? SKJULTE_TYPER.has(skrevet)
            ? ''
            : skrevet
          : kortType(checker.getTypeOfSymbolAtLocation(p, decl), decl);
      const d = std.get(navn);
      let s = navn;
      if (valgfri && d === undefined) s += '?';
      if (t) s += `: ${t}`;
      if (d !== undefined) s += ` = ${d}`;
      return `\`${s}\``;
    })
    .join(', ');
}

/** Parameterlista til en funksjon: (lag, forkastninger?, h) eller ({ w, h, overflate?, … }). */
function parametre(sig, decl) {
  return sig.parameters
    .map((p) => {
      const pd = p.valueDeclaration;
      const valgfri = pd && ts.isParameter(pd) && (pd.questionToken || pd.initializer || pd.dotDotDotToken);
      const rest = pd && ts.isParameter(pd) && pd.dotDotDotToken ? '...' : '';
      if (pd && ts.isParameter(pd) && ts.isObjectBindingPattern(pd.name)) {
        const navn = pd.name.elements.map((el) => (el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.getText()));
        const vis = navn.length > 8 ? [...navn.slice(0, 8), '…'] : navn;
        return `{ ${vis.join(', ')} }${valgfri ? '?' : ''}`;
      }
      if (pd && ts.isParameter(pd) && ts.isArrayBindingPattern(pd.name)) return pd.name.getText();
      return `${rest}${p.getName()}${valgfri && !rest ? '?' : ''}`;
    })
    .join(', ');
}

/** Det en funksjon gir, kortet ned som props-typene, men med `| null` beholdt (null betyr ugyldige tall). */
function returTekst(sig, decl) {
  const r = sig.getReturnType();
  const s = typeTekst(r, decl).replace(/;\s*\}/g, ' }');
  if (s === 'void') return '';
  if (s.length <= 56) return s;
  const kort = kortType(r, decl, 48);
  const kanNull = r.isUnion() && r.types.some((t) => t.flags & ts.TypeFlags.Null);
  return kanNull && !/\| null$/.test(kort) ? `${kort} | null` : kort;
}

/** Typen til en konstant (ISOTOPER: Readonly<Record<IsotopId, Isotopsystem>>), eller '' når den er lang eller selvsagt. */
function konstantType(decl) {
  if (!ts.isVariableDeclaration(decl)) return '';
  const s = decl.type ? decl.type.getText().replace(/\s+/g, ' ') : typeTekst(checker.getTypeAtLocation(decl), decl);
  if (s.length > 56 || /[{]/.test(s) || SKJULTE_TYPER.has(s) || /^(-?\d|'|")/.test(s)) return '';
  return s;
}

// ---------------------------------------------------------------- oppføringer

const manglerDok = [];

/** Komponenter har navn som LagFlate eller GeoTidslinje (ikke GEO eller MONSTER_NAVN). */
const erKomponentnavn = (navn) => /^[A-Z][A-Z]?[a-z]/.test(navn);

function oppforing(sym, navn, fil, kilde = '') {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  const dok = dokumentasjon(sym);
  if (!dok) manglerDok.push(`${fil}: ${navn}`);
  if (valg.kort) return `- **${navn}**${dok ? `: ${dok}` : ''}`;

  let hode = `**${navn}**`;
  let props = '';
  if (decl) {
    const type = checker.getTypeOfSymbolAtLocation(sym, decl);
    const sig = type.getCallSignatures()[0];
    const fn = funksjonsnode(decl);
    if (sig && fn) {
      if (erKomponentnavn(navn)) props = propsLinje(sym, decl);
      else {
        const r = returTekst(sig, decl);
        hode += `(${parametre(sig, decl)})${r ? ` → ${kode(r)}` : ''}`;
      }
    } else {
      const k = konstantType(decl);
      if (k) hode += ` (\`${k}\`)`;
    }
  }
  if (kilde) hode += ` (${kilde})`;
  const linjer = [`- ${hode}${dok ? `: ${dok}` : ''}`];
  if (props) linjer.push(`  - Props: ${props}`);
  return linjer.join('\n');
}

/** En type i «Typer»-lista: Navn, Navn = 'a' | 'b' eller Navn { felt, felt? }. */
function typeOppforing(sym, navn) {
  const decl = sym.declarations?.[0];
  if (!decl) return `\`${navn}\``;
  if (/Props$/.test(navn)) return `\`${navn}\``;
  const type = checker.getDeclaredTypeOfSymbol(sym);
  if (ts.isTypeAliasDeclaration(decl) && type.isUnion() && type.types.every((t) => t.isLiteral() || t.flags & ts.TypeFlags.BooleanLiteral)) {
    // Rekkefølgen fra kildefila (typesjekkeren ordner leddene etter når typene ble laget).
    const ledd = ts.isUnionTypeNode(decl.type)
      ? decl.type.types.map((n) => n.getText().replace(/"/g, "'"))
      : type.types.map((t) => typeTekst(t, decl));
    let s = '';
    for (const l of ledd) {
      if (s && s.length + l.length > 80) {
        s += ' | …';
        break;
      }
      s += s ? ` | ${l}` : l;
    }
    return `\`${navn} = ${s}\``;
  }
  if (ts.isTypeAliasDeclaration(decl) && ts.isTupleTypeNode(decl.type)) return `\`${navn} = ${decl.type.getText().replace(/\s+/g, ' ')}\``;
  const felter = type.isUnion() || type.getCallSignatures().length ? [] : type.getProperties();
  if (felter.length && felter.length <= 14) {
    const f = felter.map((p) => p.getName() + (p.flags & ts.SymbolFlags.Optional ? '?' : ''));
    return `\`${navn} { ${f.join(', ')} }\``;
  }
  return `\`${navn}\``;
}

function avsnittForFil(sf, navnListe, sett, overskrift, notat) {
  const eksporter = eksporterteSymboler(sf);
  const verdier = [];
  const typer = [];
  for (const navn of navnListe) {
    if (sett.has(navn)) continue;
    const sym = lokalSymbol(eksporter.get(navn));
    if (!sym) continue;
    sett.add(navn);
    if (sym.flags & ts.SymbolFlags.Value) verdier.push(oppforing(sym, navn, path.basename(sf.fileName)));
    else typer.push(typeOppforing(sym, navn));
  }
  if (!verdier.length && (valg.kort || !typer.length)) return '';
  const linjer = [`## ${overskrift}`];
  if (!valg.kort) {
    const intro = forsteAvsnittBlokk(filKommentar(sf));
    if (intro) linjer.push(intro, '');
    else if (notat) linjer.push(notat, '');
  }
  linjer.push(...verdier);
  if (!valg.kort && typer.length) linjer.push(`- Typer: ${typer.join(', ')}`);
  return linjer.join('\n');
}

// ---------------------------------------------------------------- gå gjennom index.ts

const sett = new Set();
const avsnitt = [];
/** Lånte navn fra andre kit (navngitte re-eksporter), samlet per kit-mappe i den rekkefølgen de står. */
const lant = new Map();

function etterfolgendeKommentar(st) {
  const r = ts.getTrailingCommentRanges(indexFile.text, st.end)?.[0];
  if (!r) return '';
  return indexFile.text.slice(r.pos, r.end).replace(/^\/\/\s?/, '').trim();
}

for (const st of indexFile.statements) {
  if (!ts.isExportDeclaration(st) || !st.moduleSpecifier) continue;
  const sf = modulFil(st.moduleSpecifier);
  if (!sf) continue;
  const rel = posix(path.relative(kitDir, sf.fileName));
  if (inniKit(sf.fileName)) {
    const navn = st.exportClause && ts.isNamedExports(st.exportClause) ? st.exportClause.elements.map((e) => e.name.text) : navnIFil(sf);
    const tekst = avsnittForFil(sf, navn, sett, rel, etterfolgendeKommentar(st));
    if (tekst) avsnitt.push(tekst);
    continue;
  }
  const relV = vizRoot ? posix(path.relative(vizRoot, sf.fileName)) : rel;
  if (!st.exportClause) {
    // Hele kit-et sendes videre: bare navnene (verdiene) på én linje.
    const eksporter = eksporterteSymboler(sf);
    const verdier = [...eksporter.keys()].filter((n) => !sett.has(n) && lokalSymbol(eksporter.get(n)).flags & ts.SymbolFlags.Value);
    verdier.forEach((n) => sett.add(n));
    if (valg.kort || !verdier.length) continue;
    const mappe = posix(path.dirname(relV));
    const kilde = `viz/${path.basename(sf.fileName).startsWith('index.') ? mappe : relV}`;
    const navn = mappe === 'kit' ? `det felles kit-et (\`${kilde}\`)` : `\`${kilde}\``;
    avsnitt.push(
      [
        `## Fra ${navn}`,
        `Alt fra \`${kilde}\` følger med (props og bruk står i viz/README.md og i kildefilene der): ${verdier.map((n) => `\`${n}\``).join(', ')}.`,
      ].join('\n'),
    );
    continue;
  }
  if (!ts.isNamedExports(st.exportClause)) continue;
  const kit = relV.split('/').slice(0, 2).join('/');
  const liste = lant.get(kit) ?? [];
  liste.push({ sf, navn: st.exportClause.elements.map((e) => e.name.text), fil: path.basename(sf.fileName) });
  lant.set(kit, liste);
}

if (!valg.kort && lant.size) {
  const lantAvsnitt = [];
  for (const [kit, liste] of lant) {
    const linjer = [];
    for (const { sf, navn, fil } of liste) {
      const eksporter = eksporterteSymboler(sf);
      for (const n of navn) {
        if (sett.has(n)) continue;
        const sym = lokalSymbol(eksporter.get(n));
        if (!sym || !(sym.flags & ts.SymbolFlags.Value)) continue;
        sett.add(n);
        linjer.push(oppforing(sym, n, fil, fil));
      }
    }
    if (linjer.length) lantAvsnitt.push([`## Fra \`viz/${kit}\``, ...linjer].join('\n'));
  }
  // De lånte hjelperne står etter det felles kit-et og før kit-ets egne filer, som i index.ts.
  const forsteLokale = avsnitt.findIndex((a) => !a.startsWith('## Fra '));
  avsnitt.splice(forsteLokale < 0 ? avsnitt.length : forsteLokale, 0, ...lantAvsnitt);
}

// ---------------------------------------------------------------- overskrift og utskrift

const galleriDir = path.join(kitDir, 'galleri');
const familier = fs.existsSync(galleriDir)
  ? fs
      .readdirSync(galleriDir)
      .filter((f) => f.endsWith('.tsx') && f !== 'felles.tsx')
      .map((f) => f.replace(/\.tsx$/, ''))
      .sort()
  : [];

const hode = [`# ${tittel}: kort API-oversikt`, ''];
const forklaring = valg.kort
  ? ''
  : ' Komponentene har en linje med props (`navn?` er valgfri, `= verdi` er standardverdien, og typen står når den ikke er number, string eller boolean), funksjonene har parameterne og det de gir (→), og typene står til slutt i hvert avsnitt.';
hode.push(
  `Generert fra JSDoc (første avsnitt) for alt som eksporteres fra \`${relViz}\`.${forklaring} Les kildefila bare for komponentene du faktisk bruker (props og ankerpunkt står i JSDoc der).`,
);
const bilder = familier.length
  ? ` Bilder av alt: \`viz-preview.html?galleri=${galleriPrefiks}alle\`, eller én familie med \`?galleri=${galleriPrefiks}<familie>\` (${familier.join(', ')}).`
  : '';
hode.push(`Importer fra \`${importSti}\`.${bilder}`);
hode.push(`Lag fila på nytt fra web/ med \`node scripts/kit-api.mjs ${relWeb}${valg.kort ? ' --kort' : ''} > ${relWeb}/API.md\`.`);

process.stdout.write(`${[hode.join('\n'), ...avsnitt].join('\n\n')}\n`);

if (manglerDok.length) process.stderr.write(`kit-api: ${manglerDok.length} navn uten JSDoc:\n  ${manglerDok.join('\n  ')}\n`);
