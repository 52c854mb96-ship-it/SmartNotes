import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserPlus } from 'lucide-react';
import type { PublicPresetsResponse } from '@smartnotes/shared';
import { api, errorMessage } from '../api';
import { PasswordField } from '../components/PasswordField';
import { Spinner } from '../components/Status';
import { useAccount } from '../lib/account';
import { useAuth, useOnline } from '../lib/connectivity';
import { cancelSwitch, confirmBeforeSwitch, finishLogin } from '../lib/login';
import { SubjectIcon } from '../lib/subjects';
import { AuthIntro } from './LoginPage';
import { useStripHash } from './ResetPasswordPage';

const CODE_KEY = 'smartnotes-invite-code';

/**
 * Koden fra invitasjonslenken (`/registrer#kode=…`). Den fjernes fra adressefeltet, men huskes i fanen
 * (sessionStorage), så en ny lasting av siden ikke mister den.
 */
function codeFromLink(): string {
  const m = /(?:^#|&)kode=([^&]+)/.exec(window.location.hash);
  try {
    if (m) {
      const code = decodeURIComponent(m[1]!);
      sessionStorage.setItem(CODE_KEY, code);
      return code;
    }
    return sessionStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function forgetCode(): void {
  try {
    sessionStorage.removeItem(CODE_KEY);
  } catch {
    /* privat modus */
  }
}

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { online } = useOnline();
  const [code, setCode] = useState(codeFromLink);
  useStripHash();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [age, setAge] = useState(false);
  const [presets, setPresets] = useState<PublicPresetsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'register' | 'sync'>(null);
  const account = useAccount();

  const [reload, setReload] = useState(0);

  useEffect(() => {
    document.title = 'Lag en konto – SmartNotes';
  }, []);

  // Fagene hentes på nytt når nettet kommer tilbake, eller når brukeren trykker «Prøv igjen».
  useEffect(() => {
    if (presets || !online) return;
    const ctrl = new AbortController();
    setLoadError(null);
    api
      .authPresets(ctrl.signal)
      .then(setPresets)
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoadError(errorMessage(err, 'Fikk ikke hentet fagene.'));
      });
    return () => ctrl.abort();
  }, [online, reload, presets]);

  const minAge = presets?.minAge ?? 15;
  const ready = !!code.trim() && !!username.trim() && !!password && chosen.length > 0 && age;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    // Er en annen konto logget inn her, spør først (en ny konto er alltid en annen konto).
    const asked = await confirmBeforeSwitch('register');
    if (asked === 'cancel') return;
    setBusy('register');
    let registered = false;
    try {
      const res = await api.register({ code: code.trim(), username: username.trim(), password, presetIds: chosen, ageConfirmed: age });
      registered = true;
      forgetCode();
      setBusy('sync');
      if (!(await finishLogin(res.user, { asked: asked === 'asked' }))) {
        setBusy(null);
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      if (!registered) cancelSwitch();
      setError(errorMessage(err, 'Kontoen ble ikke laget.'));
      setBusy(null);
    }
  };

  const toggle = (id: string, on: boolean) => setChosen((list) => (on ? [...list, id] : list.filter((x) => x !== id)));

  return (
    <div className="login-page">
      <main className="login-card">
        <AuthIntro />
        <h2 className="login-heading">Lag en konto</h2>
        {auth === 'ok' && account && !busy && (
          <p className="field-note">
            Du er logget inn som «{account.username}» på denne enheten. Lager du en ny konto, byttes kontoen her.
          </p>
        )}
        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label className="field-label" htmlFor="register-code">
              Invitasjonskode
            </label>
            <input
              id="register-code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="mono-input"
              placeholder="ABCD-EFGH-JKLM"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!!busy}
              required
              autoFocus={!code}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="register-username">
              Brukernavn
            </label>
            <input
              id="register-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!!busy}
              required
              autoFocus={!!code}
              aria-describedby="register-username-hint"
            />
            <p id="register-username-hint" className="form-hint">
              3–32 tegn: bokstaver, tall, punktum, bindestrek og understrek. Ikke bruk fullt navn.
            </p>
          </div>
          <PasswordField
            id="register-password"
            label="Passord"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={!!busy}
            hint="Minst 8 tegn. Bruk et passord du ikke bruker andre steder."
          />
          <fieldset className="field register-subjects">
            <legend className="field-label">Fag</legend>
            {presets ? (
              presets.presets.map((p) => (
                <label key={p.id} className="check-row">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={chosen.includes(p.id)}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                    disabled={!!busy}
                  />
                  <SubjectIcon profile={p.profile} size={18} />
                  <span>{p.subjectName}</span>
                </label>
              ))
            ) : loadError ? (
              <div className="form-error-row">
                <p className="form-error">{loadError}</p>
                <button type="button" className="btn btn-sm" onClick={() => setReload((n) => n + 1)} disabled={!online}>
                  Prøv igjen
                </button>
              </div>
            ) : (
              <p className="form-progress">
                <Spinner size={14} /> Henter fagene …
              </p>
            )}
            <p className="form-hint">Du kan legge til flere fag senere.</p>
          </fieldset>
          <label className="check-row">
            <input type="checkbox" className="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} disabled={!!busy} />
            <span>Jeg er minst {minAge} år</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {!online && <p className="form-hint">Du er offline. Koble til nettet for å lage en konto.</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!!busy || !ready}>
            {busy ? <Spinner size={16} /> : <UserPlus size={18} aria-hidden />}
            {busy === 'sync' ? 'Henter fagene dine …' : busy === 'register' ? 'Lager kontoen …' : 'Lag konto'}
          </button>
        </form>
        <p className="login-switch">
          Har du allerede en konto? <Link to="/logg-inn">Logg inn</Link>
        </p>
      </main>
    </div>
  );
}
