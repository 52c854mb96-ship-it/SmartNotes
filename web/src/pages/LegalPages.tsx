import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type { LegalInfo } from '@smartnotes/shared';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { useAuth } from '../lib/connectivity';

/**
 * Personvernerklæringen, vilkårene og siden om trygg og ærlig bruk av AI. Sidene kan leses uten innlogging (de lenkes
 * fra innloggingssiden og registreringen). Ansvarlig og kontakt kommer fra serveren (PRIVACY_CONTROLLER_NAME,
 * PRIVACY_CONTACT); mangler de, står det «[Fylles inn]».
 */

const MISSING = '[Fylles inn]';
const CACHE_KEY = 'smartnotes-legal';

/** Opplysningene fra serveren, eller hvorfor de mangler ennå: de hentes, eller enheten er uten nett. */
type Legal = { info: LegalInfo; state: 'ok' } | { info: null; state: 'loading' | 'offline' };

function cached(): LegalInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as LegalInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Henter ansvarlig, kontakt og tallene fra serveren. Det siste svaret huskes på enheten, så sidene er riktige også uten
 * nett. «[Fylles inn]» vises bare når serveren har svart at verdien mangler.
 */
function useLegal(): Legal {
  const [legal, setLegal] = useState<Legal>(() => {
    const info = cached();
    return info ? { info, state: 'ok' } : { info: null, state: 'loading' };
  });
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .legal(ctrl.signal)
      .then((info) => {
        setLegal({ info, state: 'ok' });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(info));
        } catch {
          /* privat modus */
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLegal((l) => (l.info ? l : { info: null, state: 'offline' }));
      });
    return () => ctrl.abort();
  }, []);
  return legal;
}

/** En verdi fra serveren som ikke er hentet ennå. */
function Pending({ state }: { state: 'loading' | 'offline' }) {
  return <span className="muted">{state === 'loading' ? '…' : '(krever nett)'}</span>;
}

/** Ansvarlig: navnet, «[Fylles inn]» når det mangler på serveren, eller en plassholder mens det hentes. */
function Controller({ legal }: { legal: Legal }) {
  if (!legal.info) return <Pending state={legal.state} />;
  return legal.info.controllerName ? <strong>{legal.info.controllerName}</strong> : <strong className="legal-missing">{MISSING}</strong>;
}

function Contact({ legal, subject }: { legal: Legal; subject: string }) {
  if (!legal.info) return <Pending state={legal.state} />;
  return <ContactLink contact={legal.info.contact} subject={subject} />;
}

/** Et tall fra serveren (alder, kvoter), eller en plassholder mens det hentes. */
function Num({ legal, value }: { legal: Legal; value: (info: LegalInfo) => number }) {
  return legal.info ? <>{value(legal.info)}</> : <Pending state={legal.state} />;
}

/** Kontakten som lenke når det er en e-postadresse, ellers som tekst. */
export function ContactLink({ contact, subject }: { contact: string | null | undefined; subject?: string }) {
  if (!contact) return <span className="legal-missing">{MISSING}</span>;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    const href = `mailto:${contact}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
    return <a href={href}>{contact}</a>;
  }
  return <span>{contact}</span>;
}

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const auth = useAuth();
  useEffect(() => {
    document.title = `${title} – SmartNotes`;
  }, [title]);
  return (
    <div className="legal-page">
      <main className="legal-card">
        <Link to={auth === 'ok' ? '/innstillinger' : '/logg-inn'} className="legal-back">
          <ArrowLeft size={16} aria-hidden /> {auth === 'ok' ? 'Til innstillingene' : 'Til innloggingen'}
        </Link>
        <div className="legal-brand">
          <Logo size={32} />
          <span>SmartNotes</span>
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="muted small">Sist endret {updated}.</p>
        <div className="legal-body">{children}</div>
        <nav className="legal-nav" aria-label="Personvern og vilkår">
          <Link to="/personvern">Personvern</Link>
          <Link to="/vilkar">Vilkår</Link>
          <Link to="/ai-bruk">Trygg og ærlig bruk av AI</Link>
        </nav>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  const legal = useLegal();
  return (
    <LegalLayout title="Personvernerklæring" updated="14. oktober 2026">
      <h2>Hvem er ansvarlig</h2>
      <p>
        Ansvarlig for personopplysningene i SmartNotes er <Controller legal={legal} />. Spørsmål, ønske om innsyn eller sletting
        sender du til <Contact legal={legal} subject="Personvern i SmartNotes" />.
      </p>

      <h2>Hva som lagres</h2>
      <ul>
        <li>
          Brukernavnet ditt og passordet ditt. Passordet lagres bare som en kryptografisk hash, aldri slik du skrev det. Appen
          spør ikke om navn, e-post eller telefonnummer.
        </li>
        <li>Når kontoen ble laget, når du sist logget inn, og at du har bekreftet alderen og godtatt vilkårene.</li>
        <li>
          Bildene og PDF-ene du laster opp, og det SmartNotes lager av dem: LaTeX-kode, PDF-er, kortstokker og fremgangen din i
          øvingen.
        </li>
        <li>
          Innloggingene dine og enhetene du har logget inn fra, som tilfeldige koder i informasjonskapsler. Enhetskoden gjør at
          kontoen din ikke sperres for deg når noen andre prøver feil passord. Til hver innlogging lagres også hvilken nettleser
          og hvilket system den kom fra, slik nettleseren selv oppgir det.
        </li>
        <li>
          En logg over AI-bruken: tidspunkt, modell, antall tokens og sider og beregnet pris. Den har ikke noe av innholdet i
          notatene.
        </li>
        <li>
          En driftslogg på serveren med tidspunkt, IP-adresse og adresse (URL) for hver forespørsel, og feilmeldinger fra
          oppsettet av PDF-ene, som kan ta med et lite utdrag av teksten i et notat. Loggen brukes til drift og sikkerhet.
        </li>
      </ul>
      <p>SmartNotes har ingen reklame, ingen sporing og ingen analyseverktøy.</p>

      <h2>Hvor dataene er, og hvem som får dem</h2>
      <ul>
        <li>Dataene ligger på serveren til SmartNotes, som kjører hos skytjenesten Railway. Driftsloggen ligger også der.</li>
        <li>
          For å lese notatene sendes bildene av sidene til Anthropic, selskapet bak AI-modellen Claude. Teksten i notatene sendes
          også dit når du lager en kortstokk, spørsmålene og svarene på kortene (også kort du har skrevet eller endret selv) når
          du ber om svaralternativer, og innholdsfortegnelser når du lar AI-en lese dem. Hvordan Anthropic behandler og
          lagrer dataene, står i Anthropics egne vilkår og personvernerklæring. Eieren av serveren kan la noen av oppgavene kjøres
          på en egen maskin i stedet.
        </li>
        <li>
          I appen ser bare du notatene dine. Eieren av serveren har teknisk tilgang til databasen og filene (for drift og
          sikkerhetskopier), og ser i appen brukernavnet ditt, når du sist logget inn og hvor mye AI du har brukt.
        </li>
        <li>En kopi av notatene ligger også på enhetene der du har logget inn, så du kan lese dem uten nett.</li>
      </ul>

      <h2>Hvor lenge</h2>
      <p>
        Dataene blir liggende til du sletter dem eller kontoen. Sletter du et notat, slettes bildene og PDF-ene fra serveren med en
        gang (også samle-PDF-ene for kapittelet og faget), mens tittelen og teksten blir liggende i databasen, merket som slettet,
        til du sletter kontoen. Kopien på en enhet slettes når du logger ut der. Sikkerhetskopier som eieren har lastet ned, kan
        fortsatt inneholde dataene dine til de slettes. Driftsloggen slettes ikke når du sletter kontoen; hvor lenge den
        beholdes, bestemmes av oppsettet hos Railway.
      </p>

      <h2>Slik sletter du</h2>
      <p>
        Innstillinger → Konto → «Slett kontoen» sletter alt du har på serveren: fag, notater, PDF-er, kortstokker, innloggingene og
        loggen over AI-bruken (ikke driftsloggen). Det kan ikke angres.
      </p>

      <h2>Rettighetene dine</h2>
      <p>
        Du kan be om innsyn i, retting av og sletting av opplysningene om deg, og du kan klage til Datatilsynet. Kontakt{' '}
        <Contact legal={legal} subject="Personvern i SmartNotes" />.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  const legal = useLegal();
  return (
    <LegalLayout title="Vilkår" updated="14. oktober 2026">
      <p>
        SmartNotes er i en lukket beta. Appen er gratis, uten garantier, og kan endres eller legges ned. Ansvarlig er{' '}
        <Controller legal={legal} />.
      </p>
      <h2>For å bruke SmartNotes</h2>
      <ul>
        <li>
          Du må være minst <Num legal={legal} value={(i) => i.minAge} /> år.
        </li>
        <li>
          Last bare opp det du har rett til: dine egne notater. Ikke last opp andres materiale, som sider fra lærebøker, uten
          lov.
        </li>
        <li>SmartNotes er bare til din egen læring. Ikke del kontoen, og ikke del innholdet videre.</li>
        <li>
          Ikke lever tekst som AI-en har laget, som ditt eget arbeid der det ikke er lov. Følg reglene på skolen din (se{' '}
          <Link to="/ai-bruk">Trygg og ærlig bruk av AI</Link>).
        </li>
        <li>AI-en kan ta feil. Les gjennom notatene og kortene, og sjekk dem mot boka.</li>
      </ul>
      <h2>Gratiskontoen</h2>
      <p>
        En gratiskonto kan konvertere <Num legal={legal} value={(i) => i.freePagesPerDay} /> sider og lage{' '}
        <Num legal={legal} value={(i) => i.freeDecksPerDay} /> kortstokker per døgn. Svaralternativer til en kortstokk som
        finnes, teller som én kortstokk. Notater over kvoten konverteres neste døgn.
      </p>
      <h2>Innhold og misbruk</h2>
      <p>
        Innhold som bryter vilkårene, kan fjernes etter varsel, og kontoen kan stenges. Ser du noe som ikke hører hjemme her, kan du
        melde fra til <Contact legal={legal} subject="Melding om innhold i SmartNotes" />.
      </p>
    </LegalLayout>
  );
}

export function AiUsePage() {
  return (
    <LegalLayout title="Trygg og ærlig bruk av AI" updated="14. oktober 2026">
      <h2>Hva AI-en gjør</h2>
      <p>
        AI-en leser håndskriften din og setter den opp som et ryddig dokument. Den skal ikke skrive nye notater for deg: innholdet
        skal være ditt, og mulige feil markeres med en merknad i stedet for å rettes i stillhet. Kortstokkene lages også av AI-en,
        fra notatene dine, og når du ber om det, lager den svaralternativer til flervalg.
      </p>
      <h2>AI-en kan ta feil</h2>
      <ul>
        <li>Les gjennom PDF-en, særlig formler, tall og enheter.</li>
        <li>Ta merknadene på alvor, og sjekk dem mot boka eller læreren.</li>
        <li>Et spørsmål eller svar i en kortstokk kan være feil. Stoler du ikke på det, slett kortet.</li>
        <li>
          Et svaralternativ som skal være galt, kan også være riktig. Stoler du ikke på det, rett eller fjern alternativene når du
          redigerer kortet.
        </li>
      </ul>
      <h2>I skolearbeidet</h2>
      <ul>
        <li>Følg reglene skolen din har for bruk av AI.</li>
        <li>
          PDF-ene som lages nå, er merket «AI-generert» nederst på sidene. Ikke lever dem som innlevering eller bruk dem på en
          prøve der det ikke er lov.
        </li>
        <li>Blir du spurt om du har brukt AI, si det som det er.</li>
      </ul>
      <h2>Personvern</h2>
      <p>
        Ikke last opp opplysninger om andre, som navn, bilder av folk eller noe som er privat. Les{' '}
        <Link to="/personvern">personvernerklæringen</Link> for hva som lagres og hvor.
      </p>
    </LegalLayout>
  );
}
