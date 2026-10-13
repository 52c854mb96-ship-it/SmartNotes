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

function useLegal(): LegalInfo | null {
  const [info, setInfo] = useState<LegalInfo | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .legal(ctrl.signal)
      .then(setInfo)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  return info;
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
  const info = useLegal();
  return (
    <LegalLayout title="Personvernerklæring" updated="14. oktober 2026">
      <h2>Hvem er ansvarlig</h2>
      <p>
        Ansvarlig for personopplysningene i SmartNotes er <strong>{info?.controllerName ?? MISSING}</strong>. Spørsmål, ønske om
        innsyn eller sletting sender du til <ContactLink contact={info?.contact} subject="Personvern i SmartNotes" />.
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
          kontoen din ikke sperres for deg når noen andre prøver feil passord.
        </li>
        <li>
          En logg over AI-bruken: tidspunkt, modell, antall tokens og sider og beregnet pris. Den har ikke noe av innholdet i
          notatene.
        </li>
      </ul>
      <p>SmartNotes har ingen reklame, ingen sporing og ingen analyseverktøy.</p>

      <h2>Hvor dataene er, og hvem som får dem</h2>
      <ul>
        <li>Dataene ligger på serveren til SmartNotes, som kjører hos skytjenesten Railway.</li>
        <li>
          For å lese notatene sendes bildene av sidene til Anthropic, selskapet bak AI-modellen Claude. Teksten i notatene sendes
          også dit når du lager en kortstokk, og innholdsfortegnelser når du lar AI-en lese dem. Hvordan Anthropic behandler og
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
        gang, mens tittelen og teksten blir liggende i databasen, merket som slettet, til du sletter kontoen. Kopien på en enhet
        slettes når du logger ut der. Sikkerhetskopier som eieren har lastet ned, kan fortsatt inneholde dataene dine til de
        slettes.
      </p>

      <h2>Slik sletter du</h2>
      <p>
        Innstillinger → Konto → «Slett kontoen» sletter alt du har på serveren: fag, notater, PDF-er, kortstokker og loggen over
        AI-bruken. Det kan ikke angres.
      </p>

      <h2>Rettighetene dine</h2>
      <p>
        Du kan be om innsyn i, retting av og sletting av opplysningene om deg, og du kan klage til Datatilsynet. Kontakt{' '}
        <ContactLink contact={info?.contact} subject="Personvern i SmartNotes" />.
      </p>
    </LegalLayout>
  );
}

export function TermsPage() {
  const info = useLegal();
  return (
    <LegalLayout title="Vilkår" updated="14. oktober 2026">
      <p>
        SmartNotes er i en lukket beta. Appen er gratis, uten garantier, og kan endres eller legges ned. Ansvarlig er{' '}
        <strong>{info?.controllerName ?? MISSING}</strong>.
      </p>
      <h2>For å bruke SmartNotes</h2>
      <ul>
        <li>Du må være minst {info?.minAge ?? 15} år.</li>
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
        En gratiskonto kan konvertere {info?.freePagesPerDay ?? 15} sider og lage {info?.freeDecksPerDay ?? 2} kortstokker per
        døgn. Notater over kvoten konverteres neste døgn.
      </p>
      <h2>Innhold og misbruk</h2>
      <p>
        Innhold som bryter vilkårene, kan fjernes etter varsel, og kontoen kan stenges. Ser du noe som ikke hører hjemme her, kan du
        melde fra til <ContactLink contact={info?.contact} subject="Melding om innhold i SmartNotes" />.
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
        fra notatene dine.
      </p>
      <h2>AI-en kan ta feil</h2>
      <ul>
        <li>Les gjennom PDF-en, særlig formler, tall og enheter.</li>
        <li>Ta merknadene på alvor, og sjekk dem mot boka eller læreren.</li>
        <li>Et spørsmål eller svar i en kortstokk kan være feil. Stoler du ikke på det, slett kortet.</li>
      </ul>
      <h2>I skolearbeidet</h2>
      <ul>
        <li>Følg reglene skolen din har for bruk av AI.</li>
        <li>
          PDF-ene er merket «AI-generert». Ikke lever dem som innlevering eller bruk dem på en prøve der det ikke er lov.
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
