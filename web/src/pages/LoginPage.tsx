import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { api, errorMessage } from '../api';
import { db } from '../db';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Status';
import { useAuth, useOnline } from '../lib/connectivity';
import { afterLogin } from '../sync';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { online } = useOnline();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'login' | 'sync'>(null);
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    document.title = 'Logg inn – SmartNotes';
  }, []);

  if (auth === 'ok' && !busy) return <Navigate to={from && from !== '/logg-inn' ? from : '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setError(null);
    setBusy('login');
    try {
      await api.login(password);
      setBusy('sync');
      await afterLogin();
      const first = (await db.subjects.orderBy('position').first())?.id;
      navigate(from && from !== '/' && from !== '/logg-inn' ? from : first ? `/fag/${first}` : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Innloggingen feilet.'));
      setBusy(null);
    }
  };

  return (
    <div className="login-page">
      <main className="login-card">
        <div className="login-brand">
          <Logo size={56} />
          <h1>SmartNotes</h1>
          <p className="login-tagline">Håndskrevne notater blir til pene PDF-er – sortert etter kapittel.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span className="field-label">Passord</span>
            <span className="input-with-action">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                disabled={!!busy}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Skjul passord' : 'Vis passord'}
                aria-pressed={show}
              >
                {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </span>
          </label>
          {error && (
            <p id="login-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          {!online && (
            <p className="form-hint">Du er offline. Koble til nettet for å logge inn.</p>
          )}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!busy || !password}>
            {busy ? <Spinner size={16} /> : <LogIn size={18} aria-hidden />}
            {busy === 'sync' ? 'Henter notatene dine …' : busy === 'login' ? 'Logger inn …' : 'Logg inn'}
          </button>
        </form>
      </main>
    </div>
  );
}
