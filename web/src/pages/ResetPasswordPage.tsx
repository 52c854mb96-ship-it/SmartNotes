import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { api, errorMessage } from '../api';
import { PasswordField } from '../components/PasswordField';
import { Spinner } from '../components/Status';
import { useOnline } from '../lib/connectivity';
import { finishLogin } from '../lib/login';
import { AuthIntro } from './LoginPage';

/** Koden i lenken (`/nytt-passord#<kode>`). */
function tokenFromLink(): string {
  const token = window.location.hash.replace(/^#/, '');
  return /^[\w-]{20,200}$/.test(token) ? token : '';
}

/** Fjerner koden fra adressefeltet, så den ikke blir liggende i historikken. */
export function useStripHash(): void {
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { online } = useOnline();
  const [token] = useState(tokenFromLink);
  useStripHash();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'sync'>(null);

  useEffect(() => {
    document.title = 'Nytt passord – SmartNotes';
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    if (password !== repeat) {
      setError('Passordene er ikke like.');
      return;
    }
    setError(null);
    setBusy('save');
    try {
      const res = await api.resetPassword({ token, password });
      setBusy('sync');
      if (!(await finishLogin(res.user))) {
        setBusy(null);
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Passordet ble ikke endret.'));
      setBusy(null);
    }
  };

  return (
    <div className="login-page">
      <main className="login-card">
        <AuthIntro />
        <h2 className="login-heading">Nytt passord</h2>
        {!token ? (
          <p className="form-error" role="alert">
            Lenken mangler koden. Be den som inviterte deg om en ny lenke.
          </p>
        ) : (
          <form onSubmit={submit} className="login-form">
            <PasswordField
              id="reset-password"
              label="Nytt passord"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              disabled={!!busy}
              autoFocus
              hint="Minst 8 tegn. Du blir logget ut på alle andre enheter."
            />
            <PasswordField
              id="reset-repeat"
              label="Gjenta passordet"
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
              disabled={!!busy}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!online && <p className="form-hint">Du er offline. Koble til nettet for å lagre passordet.</p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!busy || !password || !repeat}>
              {busy ? <Spinner size={16} /> : <KeyRound size={18} aria-hidden />}
              {busy === 'sync' ? 'Henter notatene dine …' : busy === 'save' ? 'Lagrer …' : 'Lagre og logg inn'}
            </button>
          </form>
        )}
        <p className="login-switch">
          <Link to="/logg-inn">Til innloggingen</Link>
        </p>
      </main>
    </div>
  );
}
