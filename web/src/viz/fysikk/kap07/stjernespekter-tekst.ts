/** Tekstene i «Stjernespekter» som endrer seg med tilstanden (bokmål). Ren tekst, så de kan testes uten React. */
import { fmt } from '../../kit/format';
import {
  ELEMENTS,
  STARS,
  elementNameCap,
  labLines,
  peakWavelength,
  photon,
  presentElements,
  type Analysis,
  type ElementId,
  type StarId,
  type StarLine,
} from './model-stjernespekter';

/** 22000 → «22 000» (mellomrom mellom tusener, som i norsk). */
export function fmtThousands(v: number): string {
  return fmt(v, 0);
}

/** «hydrogen», «hydrogen og kalsium», «hydrogen, natrium og jern». */
export function listNames(ids: readonly ElementId[]): string {
  const n = ids.map((id) => ELEMENTS[id].name);
  if (n.length <= 1) return n[0] ?? '';
  return `${n.slice(0, -1).join(', ')} og ${n[n.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toLocaleUpperCase('nb') + s.slice(1);
}

/** Første avsnitt: hvor langt eleven har kommet, og hva som passer og ikke. */
export function progressText(star: StarId, a: Analysis, on: readonly ElementId[]): string {
  const s = STARS[star];
  if (on.length === 0) {
    return `${s.name} har ${a.total} mørke linjer i den delen av spekteret vi ser. Slå på grunnstoffene ett om gangen. Finnes grunnstoffet i atmosfæren til stjernen, treffer alle linjene fra laboratoriet en mørk linje (stiplet strek opp). En linje som ikke finnes i stjernen, får et kryss.`;
  }
  if (a.solved) {
    return `Alle de ${a.total} mørke linjene er forklart: atmosfæren til ${s.name} inneholder ${listNames(a.found)}. Ingen av de andre grunnstoffene passer. (Forenklet: figuren viser bare linjer fra disse fem grunnstoffene. Et ekte stjernespekter har tusenvis av linjer.)`;
  }
  const parts: string[] = [];
  if (a.found.length > 0) {
    parts.push(`${cap(listNames(a.found))} passer: alle linjene ${a.found.length > 1 ? 'deres ' : ''}fra laboratoriet treffer mørke linjer i stjernen.`);
  }
  if (a.wrong.length > 0) {
    parts.push(
      `${cap(listNames(a.wrong))} passer ikke: ingen av linjene finnes i stjernen (kryssene), så ${a.wrong.length > 1 ? 'de gir' : 'det gir'} ingen linjer i atmosfæren til ${s.name}.`,
    );
  }
  const left = a.total - a.explained;
  if (left > 0) {
    parts.push(`${left} av ${a.total} mørke linjer er ikke forklart ennå (hule trekanter).`);
  } else if (a.wrong.length > 0) {
    parts.push(`Alle linjene er forklart, men slå av ${listNames(a.wrong)}: et grunnstoff må ha alle linjene sine i stjernen for å telle.`);
  }
  const present = presentElements(star);
  if (on.includes('He') && !present.includes('He') && present.includes('Na')) {
    parts.push('Se nøye på den gule linja til helium (587,6 nm). Den ligger bare 1,4 nm fra de gule D-linjene til natrium (589,0 og 589,6 nm), men treffer ikke.');
  } else if (on.includes('Na') && !present.includes('Na') && present.includes('He')) {
    parts.push('De gule D-linjene til natrium (589,0 og 589,6 nm) ligger bare 1,4 nm fra den gule heliumlinja (587,6 nm), men treffer ikke.');
  }
  return parts.join(' ');
}

/** Hvilken overgang en hydrogenlinje er («fra n = 2 til n = 4»). */
export function hydrogenTransition(line: StarLine): string {
  return `fra n = 2 til n = ${line.lab.n ?? '?'}`;
}

/** Andre avsnitt: hvorfor linjene er mørke, med den valgte linja som eksempel. */
export function darkLineText(line: StarLine | undefined, explainedBy: ElementId | null): string {
  const intro =
    'Hvorfor er linjene mørke? Det indre av stjernen er varm, tett gass som sender ut lys med alle bølgelengder (det kontinuerlige spekteret, stiplet i grafen). På vei ut går lyset gjennom atmosfæren, som er tynnere og kjøligere. Et atom der kan bare ta opp et foton som har nøyaktig den energien som skal til for å løfte et elektron til et høyere energinivå: fotonenergien hf må være lik forskjellen ΔE mellom de to nivåene.';
  const outro =
    'Etter kort tid sender atomet energien ut igjen, men i en tilfeldig retning. Derfor når mindre av akkurat denne bølgelengden fram til oss, og linja blir mørkere enn omgivelsene, men ikke helt svart.';
  if (!line) return `${intro} ${outro}`;
  const p = photon(line.nm);
  const at = `Linja ved ${fmt(line.nm, 1)} nm`;
  let mid: string;
  if (explainedBy === 'H') mid = `${at} er hydrogen som løftes ${hydrogenTransition(line)}: fotonene har E = ${fmt(p.eV, 2)} eV.`;
  else if (explainedBy) mid = `${at} kommer fra ${ELEMENTS[explainedBy].name}: fotonene har E = ${fmt(p.eV, 2)} eV.`;
  else mid = `${at} har fotoner med E = ${fmt(p.eV, 2)} eV. Hvilket grunnstoff har en linje akkurat der?`;
  return `${intro} ${mid} ${outro}`;
}

/** Tredje avsnitt: temperaturen (formen på grafen og hvilke linjer som synes) og en vanlig misforståelse. */
export function temperatureText(star: StarId, a: Analysis): string {
  const s = STARS[star];
  const peak = peakWavelength(s.T);
  const graph =
    peak < 380
      ? `Formen på grafen viser temperaturen: ${s.name} (ca. ${fmtThousands(s.T)} K) lyser sterkest i ultrafiolett (Wiens forskyvningslov: λ = b/T ≈ ${fmt(peak, 0)} nm), så kurven faller mot rødt, og stjernen ser ${s.colorWord} ut.`
      : `Formen på grafen viser temperaturen: ${s.name} (ca. ${fmtThousands(s.T)} K) lyser sterkest ved λ = b/T ≈ ${fmt(peak, 0)} nm (Wiens forskyvningslov), og stjernen ser ${s.colorWord} ut.`;
  let more: string;
  switch (star) {
    case 'bellatrix':
      more = `Bare i så varme stjerner blir heliumatomene løftet til nivåene ca. 20 eV over grunntilstanden, og bare derfra kan helium ta opp synlig lys. Vanlig misforståelse: at stjerner uten heliumlinjer ikke har helium. Capella og sola har også mye helium (omtrent en firedel av massen), men atmosfæren er for kald til at helium gir linjer i synlig lys.${
        a.found.includes('He')
          ? ' Helium ble faktisk oppdaget i sola i 1868, som en ukjent gul linje ved 587,6 nm i lyset fra solranden under en solformørkelse, før stoffet var funnet på jorda.'
          : ''
      }`;
      break;
    case 'vega':
      more =
        'Hydrogenlinjene er sterkest og bredest i stjerner på omtrent 10 000 K, som Vega. Linjene i synlig lys er overganger fra n = 2, så bare hydrogenatomer som allerede er i n = 2, kan ta opp disse fotonene. I kjøligere stjerner er nesten alle atomene i grunntilstanden n = 1, og i mye varmere stjerner har mange mistet elektronet sitt. Vanlig misforståelse: at Vega bare består av hydrogen og litt kalsium. Vega har også helium og jern, men ved denne temperaturen gir de bare svake eller ingen linjer i synlig lys.';
      break;
    case 'capella':
      more =
        'Capella er to gule kjempestjerner så tett sammen at vi ser dem som én, med omtrent samme temperatur som sola (5 800 K). Derfor ligner spekteret solspekteret: sterke kalsiumlinjer ved 393 og 397 nm, de gule D-linjene fra natrium og mange jernlinjer. Vanlig misforståelse: at stjernen er mest jern fordi jern gir flest linjer. Den er mest hydrogen (ca. 70 % av massen). Jern har mange elektroner og derfor mange energinivåer, så det gir mange linjer selv om det er lite jern.';
      break;
    default:
      more =
        'Arcturus er kjøligere enn sola. Nesten alle hydrogenatomene er i grunntilstanden n = 1 og kan ikke ta opp synlig lys, så hydrogenlinjene blir svake. Metallene natrium, kalsium og jern gir derimot sterke linjer. Vanlig misforståelse: at svake hydrogenlinjer betyr lite hydrogen. Også Arcturus er mest hydrogen; temperaturen avgjør hvor sterke linjene blir.';
  }
  return `${graph} ${more}`;
}

/** Linje i utregningen som sammenligner med laboratoriet (andre grunnstoffer enn hydrogen). */
export function labMatchText(line: StarLine, explainedBy: ElementId | null, on: readonly ElementId[]): string {
  if (explainedBy) {
    const lab = labLines(explainedBy).find((l) => Math.abs(l.nm - line.nm) < 1);
    return `${elementNameCap(explainedBy)} i laboratoriet: lys linje ved ${fmt(lab?.nm ?? line.nm, 1)} nm, samme foton`;
  }
  return on.length === 0
    ? 'Slå på et grunnstoff for å sammenligne med laboratoriet'
    : `Ingen av grunnstoffene du har slått på, har en linje ved ${fmt(line.nm, 1)} nm`;
}
