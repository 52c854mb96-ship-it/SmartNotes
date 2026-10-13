import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { LogIn } from 'lucide-react';
import { api, errorMessage } from '../api';
import { Logo } from '../components/Logo';
import { PasswordField } from '../components/PasswordField';
import { Spinner } from '../components/Status';
import { useAuth, useOnline } from '../lib/connectivity';
import { finishLogin } from '../lib/login';

/** Innledningen på innloggingssidene: hva SmartNotes er, og at betaen er lukket. */
export function AuthIntro() {
  return (
    <div className="login-brand">
      <Logo size={56} />
      <h1>SmartNotes</h1>
      <p className="login-tagline">Håndskrevne notater blir til ryddige PDF-er, sortert etter tema i faget.</p>
      <p className="login-about">
        For Fysikk 1, Kjemi 1, Biologi 1 og Geofag 1 i videregående. SmartNotes er i en lukket beta: du trenger en
        invitasjon fra en som bruker appen.
      </p>
    </div>
  );
}

/** Siden brukeren var på vei til, ellers forsiden (appen åpner ikke et fag av seg selv). */
export function afterLoginTarget(from: string | undefined): string {
  return from && from.startsWith('/') && !from.startsWith('//') && !/^\/(logg-inn|registrer|nytt-passord)/.test(from) ? from : '/';
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { online } = useOnline();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'login' | 'sync'>(null);
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    document.title = 'Logg inn – SmartNotes';
  }, []);

  if (auth === 'ok' && !busy) return <Navigate to={afterLoginTarget(from)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setError(null);
    setBusy('login');
    try {
      const res = await api.login({ username: username.trim(), password });
      setBusy('sync');
      const result = await finishLogin(res.user);
      if (!result) {
        setBusy(null);
        return;
      }
      // Etter et kontobytte hører siden brukeren var på vei til, til den forrige kontoen.
      navigate(result === 'replaced' ? '/' : afterLoginTarget(from), { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Innloggingen feilet.'));
      setBusy(null);
    }
  };

  return (
    <div className="login-page">
      <main className="login-card">
        <AuthIntro />
        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="login-username">
              Brukernavn
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={!!busy}
              aria-describedby="login-username-hint"
            />
            <p id="login-username-hint" className="form-hint">
              Eieren av serveren kan la feltet stå tomt.
            </p>
          </div>
          <PasswordField
            id="login-password"
            label="Passord"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={!!busy}
            invalid={!!error}
            describedBy={error ? 'login-error' : undefined}
          />
          {error && (
            <p id="login-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          {!online && <p className="form-hint">Du er offline. Koble til nettet for å logge inn.</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!busy || !password}>
            {busy ? <Spinner size={16} /> : <LogIn size={18} aria-hidden />}
            {busy === 'sync' ? 'Henter notatene dine …' : busy === 'login' ? 'Logger inn …' : 'Logg inn'}
          </button>
        </form>
        <p className="login-switch">
          Har du fått en invitasjonskode? <Link to="/registrer">Lag en konto</Link>
        </p>
      </main>
    </div>
  );
}
