import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Spinner } from '../components/Status';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** Samme form som `web/build/licenses.ts` skriver til `licenses.json` når appen bygges. */
interface LicenseFile {
  packages: { name: string; version: string; license: string; author: string | null; url: string | null; text: number | null }[];
  texts: string[];
}

type State = { kind: 'loading' } | { kind: 'ready'; file: LicenseFile } | { kind: 'missing' };

/** «Om SmartNotes» → «Lisenser»: pakkene med åpen kildekode som følger med appen, med lisenstekstene. */
export function LicensesPage() {
  useDocumentTitle('Lisenser');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/licenses.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        const file = (await res.json()) as LicenseFile;
        if (alive) setState({ kind: 'ready', file });
      } catch {
        if (alive) setState({ kind: 'missing' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page page-narrow">
      <nav className="breadcrumb" aria-label="Brødsmuler">
        <Link to="/innstillinger">
          <ChevronLeft size={16} aria-hidden />
          Innstillinger
        </Link>
      </nav>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Lisenser</h1>
        </div>
      </header>

      <section className="card" aria-labelledby="licenses-own-h">
        <div className="card-head">
          <h2 id="licenses-own-h" className="card-title">
            SmartNotes
          </h2>
        </div>
        <p className="card-text">
          SmartNotes er ikke åpen kildekode: alle rettigheter er forbeholdt (se LICENSE i kildekoden). Appen bygger på pakkene med
          åpen kildekode under, og lisensene deres gjelder for dem.
        </p>
        <p className="card-text">
          Kompetansemålene inneholder data under{' '}
          <a href="https://data.norge.no/nlod/no/2.0" target="_blank" rel="noopener noreferrer">norsk lisens for offentlige data (NLOD)</a>{' '}
          tilgjengeliggjort av Utdanningsdirektoratet (<a href="https://data.udir.no" target="_blank" rel="noopener noreferrer">data.udir.no</a>). PDF-ene settes med LaTeX og fontene som følger med TeX
          Live, under sine egne frie lisenser: blant annet Latin Modern (GUST Font License), Computer Modern og AMS-fontene
          (SIL Open Font License) og URW-fontene som brukes i stedet for Helvetica og Palatino. Matematikken i appen vises med
          KaTeX-fontene (SIL Open Font License, se lista under).
        </p>
      </section>

      <section className="card" aria-labelledby="licenses-list-h">
        <div className="card-head">
          <h2 id="licenses-list-h" className="card-title">
            Pakker med åpen kildekode
          </h2>
          {state.kind === 'ready' && (
            <p className="card-text">Disse pakkene er med i appen på denne enheten. Trykk på en pakke for å lese lisensen.</p>
          )}
        </div>
        {state.kind === 'loading' && <Spinner size={18} />}
        {state.kind === 'missing' && (
          <p className="card-text">Fant ikke lisenslista. Den lages når appen bygges, og hentes fra serveren, så den krever nett.</p>
        )}
        {state.kind === 'ready' && (
          <ul className="license-list" role="list">
            {state.file.packages.map((p) => (
              <li key={`${p.name}@${p.version}`}>
                <details className="license-item">
                  <summary>
                    <span className="license-name">{p.name}</span>
                    <span className="muted small">
                      {p.version} · {p.license}
                    </span>
                  </summary>
                  <div className="license-body">
                    {(p.author || p.url) && (
                      <p className="small">
                        {p.author && <span>{p.author}</span>}
                        {p.author && p.url && ' · '}
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer">
                            {p.url.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </p>
                    )}
                    {p.text !== null && state.file.texts[p.text] ? (
                      <pre className="license-text">{state.file.texts[p.text]}</pre>
                    ) : (
                      <p className="small muted">Pakken har ingen egen lisensfil. Lisensen er {p.license}.</p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
