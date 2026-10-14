import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../api';
import { Modal } from '../../components/Modal';
import { PasswordField } from '../../components/PasswordField';
import { Spinner } from '../../components/Status';
import { useOnline } from '../../lib/connectivity';
import { toast } from '../../lib/ui';
import { logoutAndClear } from '../../sync';

/**
 * «Slett kontoen»: sletter alt brukeren har på serveren (fag, notater, PDF-er, kortstokker, forbruk) og så alt på
 * enheten. Passordet bekrefter at det er brukeren selv. Eieren har ikke knappen (serveren sier også nei).
 */
export function DeleteAccount({ username }: { username: string }) {
  const navigate = useNavigate();
  const { online } = useOnline();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      // Serveren har slettet økten; tøm enheten også.
      await logoutAndClear();
      toast('Kontoen og alt du hadde i SmartNotes, er slettet.', { kind: 'success' });
      navigate('/logg-inn', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Kontoen ble ikke slettet.'));
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-danger-outline" onClick={() => setOpen(true)} disabled={!online} title={online ? undefined : 'Krever nett'}>
        <Trash2 size={17} aria-hidden /> Slett kontoen …
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Slette kontoen?"
        size="sm"
        busy={busy}
        footer={
          <>
            <button type="button" className="btn" onClick={close} disabled={busy}>
              Avbryt
            </button>
            <button type="submit" form="delete-account-form" className="btn btn-danger" disabled={busy || !password}>
              {busy ? <Spinner size={16} /> : <Trash2 size={17} aria-hidden />} Slett for godt
            </button>
          </>
        }
      >
        <form id="delete-account-form" onSubmit={submit} className="stack">
          <p className="confirm-body">
            Kontoen «{username}» og alt du har i SmartNotes, slettes fra serveren: fag, notater, PDF-er, kortstokker og loggen over
            AI-bruken. Det kan ikke angres. Vil du beholde noe, last ned PDF-ene først.
          </p>
          <PasswordField
            id="delete-account-password"
            label="Passordet ditt"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={busy}
            autoFocus
            invalid={!!error}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
