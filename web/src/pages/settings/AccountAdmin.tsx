import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, KeyRound, Lock, LockOpen, UserPlus } from 'lucide-react';
import type { AdminUser, InviteSummary } from '@smartnotes/shared';
import { api, errorMessage } from '../../api';
import { Spinner } from '../../components/Status';
import { OWNER_ID, planLabel, useAccount } from '../../lib/account';
import { useOnline } from '../../lib/connectivity';
import { formatChangedDay, kroner, plural } from '../../lib/format';
import { confirmDialog, toast } from '../../lib/ui';
import { rememberAccount } from '../../sync';

/**
 * Eierens kort i Innstillinger: invitasjoner, brukerne og eierens brukernavn. Serveren svarer 404 på alt dette for
 * andre enn eieren; kortene vises bare for eieren.
 */

async function copy(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} er kopiert.`, { kind: 'success' });
  } catch {
    toast('Kunne ikke kopiere. Merk teksten og kopier den selv.', { kind: 'error' });
  }
}

/** En kode eller lenke som skal gis videre, med kopieringsknapp. */
function CopyField({ id, label, value, what }: { id: string; label: string; value: string; what: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="input-with-action">
        <input id={id} type="text" className="mono-input" value={value} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn" onClick={() => void copy(value, what)}>
          <Copy size={16} aria-hidden /> Kopier
        </button>
      </span>
    </div>
  );
}

const INVITE_STATUS: Record<InviteSummary['status'], string> = {
  active: 'Aktiv',
  used: 'Brukt',
  expired: 'Utløpt',
  revoked: 'Trukket tilbake',
};

function inviteDetail(i: InviteSummary): string {
  if (i.status === 'used') return `av «${i.usedBy ?? 'ukjent'}» ${formatChangedDay(i.usedAt)}`;
  if (i.status === 'active') return `gjelder til ${formatChangedDay(i.expiresAt)}`;
  if (i.status === 'expired') return `utløp ${formatChangedDay(i.expiresAt)}`;
  return `laget ${formatChangedDay(i.createdAt)}`;
}

export function InviteCard() {
  const { online } = useOnline();
  const [invites, setInvites] = useState<InviteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    api
      .invites(signal)
      .then((r) => {
        setInvites(r.invites);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!signal?.aborted) setError(errorMessage(err, 'Kunne ikke hente invitasjonene.'));
      });
  }, []);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [online, load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.createInvite();
      setCreated({ code: res.code, expiresAt: res.invite.expiresAt });
      load();
    } catch (err) {
      toast(errorMessage(err, 'Invitasjonen ble ikke laget.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (i: InviteSummary) => {
    const ok = await confirmDialog({
      title: 'Trekke tilbake invitasjonen?',
      body: `Koden som slutter på ${i.codeHint}, kan ikke lenger brukes til å lage en konto.`,
      confirmLabel: 'Trekk tilbake',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.revokeInvite(i.id);
      if (created && created.code.replace(/-/g, '').endsWith(i.codeHint)) setCreated(null);
      load();
    } catch (err) {
      toast(errorMessage(err, 'Invitasjonen ble ikke trukket tilbake.'), { kind: 'error' });
    }
  };

  const link = created ? `${window.location.origin}/registrer#kode=${created.code}` : '';
  const shown = invites?.slice(0, 10) ?? [];
  return (
    <section className="card" aria-labelledby="invite-h">
      <div className="card-head">
        <h2 id="invite-h" className="card-title">
          Inviter en elev
        </h2>
        <p className="card-text">
          Lag en invitasjonskode og gi den til eleven. Koden kan brukes én gang og gjelder i 14 dager. Eleven lager kontoen sin
          med lenken, eller med «Lag en konto» på innloggingssiden.
        </p>
      </div>
      {created && (
        <div className="invite-created stack">
          <CopyField id="invite-link" label="Lenke til eleven" value={link} what="Lenken" />
          <CopyField id="invite-code" label="Invitasjonskode" value={created.code} what="Koden" />
          <p className="form-hint">Koden vises bare nå. Gjelder til {formatChangedDay(created.expiresAt)}.</p>
        </div>
      )}
      <div className="card-actions">
        <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={busy || !online}>
          {busy ? <Spinner size={16} /> : <UserPlus size={17} aria-hidden />} Lag invitasjon
        </button>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så invitasjonene kan ikke hentes nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !invites ? (
        <div className="skeleton skeleton-line" />
      ) : invites.length > 0 ? (
        <ul className="admin-list" role="list" aria-label="Invitasjoner">
          {shown.map((i) => (
            <li key={i.id} className="admin-row">
              <div className="admin-row-main">
                <span className="admin-row-title">
                  Kode som slutter på <span className="mono">{i.codeHint}</span>
                </span>
                <span className="muted small">
                  <span className={`badge ${i.status === 'active' ? 'badge-accent' : 'badge-neutral'}`}>{INVITE_STATUS[i.status]}</span>{' '}
                  {inviteDetail(i)}
                </span>
              </div>
              {i.status === 'active' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revoke(i)}>
                  Trekk tilbake
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function lastLogin(u: AdminUser): string {
  return u.lastLoginAt ? `sist innlogget ${formatChangedDay(u.lastLoginAt)}` : 'har ikke logget inn';
}

export function UsersCard() {
  const { online } = useOnline();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<number, { url: string; expiresAt: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    api
      .adminUsers(signal)
      .then((r) => {
        setUsers(r.users);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!signal?.aborted) setError(errorMessage(err, 'Kunne ikke hente brukerne.'));
      });
  }, []);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [online, load]);

  const resetLink = async (u: AdminUser) => {
    const ok = await confirmDialog({
      title: `Lenke for nytt passord til «${u.username}»?`,
      body: 'Eleven velger et nytt passord med lenken og blir logget ut på alle andre enheter. Lenken kan brukes én gang og gjelder i 48 timer. En eldre lenke slutter å virke.',
      confirmLabel: 'Lag lenke',
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      const res = await api.resetLink(u.id);
      setLinks((l) => ({ ...l, [u.id]: { url: `${window.location.origin}/nytt-passord#${res.token}`, expiresAt: res.expiresAt } }));
    } catch (err) {
      toast(errorMessage(err, 'Lenken ble ikke laget.'), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const setDisabled = async (u: AdminUser, disable: boolean) => {
    if (disable) {
      const ok = await confirmDialog({
        title: `Stenge kontoen til «${u.username}»?`,
        body: 'Eleven blir logget ut overalt og kan ikke logge inn før du åpner kontoen igjen. Notatene blir liggende, og notater i køen konverteres ikke mens kontoen er stengt.',
        confirmLabel: 'Steng kontoen',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(u.id);
    try {
      await (disable ? api.disableUser(u.id) : api.enableUser(u.id));
      setLinks((l) => {
        const { [u.id]: _gone, ...rest } = l;
        return rest;
      });
      load();
    } catch (err) {
      toast(errorMessage(err, 'Endringen ble ikke lagret.'), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card" aria-labelledby="users-h">
      <div className="card-head">
        <h2 id="users-h" className="card-title">
          Brukere
        </h2>
        <p className="card-text">Alle som har en konto på serveren, med AI-forbruket de siste 30 dagene.</p>
      </div>
      {!online ? (
        <p className="muted">Du er offline, så brukerne kan ikke hentes nå.</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !users ? (
        <div className="skeleton skeleton-line" />
      ) : (
        <ul className="admin-list" role="list" aria-label="Brukere">
          {users.map((u) => (
            <li key={u.id} className="admin-row admin-row-user">
              <div className="admin-row-main">
                <span className="admin-row-title">
                  {u.username}{' '}
                  <span className={`badge ${u.plan === 'owner' ? 'badge-accent' : 'badge-neutral'}`}>{planLabel(u.plan)}</span>
                  {u.disabled && <span className="badge badge-danger">Stengt</span>}
                </span>
                <span className="muted small">
                  Laget {formatChangedDay(u.createdAt)}, {lastLogin(u)} · {plural(u.usage30d.calls, 'AI-kall', 'AI-kall')},{' '}
                  {plural(u.usage30d.pages, 'side', 'sider')}, {kroner(u.usage30d.costNok)}
                </span>
                {links[u.id] && (
                  <CopyField
                    id={`reset-${u.id}`}
                    label={`Lenke for nytt passord (gjelder til ${formatChangedDay(links[u.id]!.expiresAt)})`}
                    value={links[u.id]!.url}
                    what="Lenken"
                  />
                )}
              </div>
              {u.id !== OWNER_ID && (
                <div className="admin-row-actions">
                  {!u.disabled && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resetLink(u)} disabled={busy === u.id}>
                      <KeyRound size={15} aria-hidden /> Nytt passord
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void setDisabled(u, !u.disabled)}
                    disabled={busy === u.id}
                  >
                    {u.disabled ? <LockOpen size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
                    {u.disabled ? 'Åpne kontoen' : 'Steng kontoen'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Eierens brukernavn (eieren logger inn med det og APP_PASSWORD, eller med passordet alene). */
export function OwnerNameForm() {
  const account = useAccount();
  const { online } = useOnline();
  const [name, setName] = useState(account?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName(account?.username ?? ''), [account?.username]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.renameOwner(name.trim());
      await rememberAccount(res.user);
      toast('Brukernavnet er lagret.', { kind: 'success' });
    } catch (err) {
      setError(errorMessage(err, 'Brukernavnet ble ikke lagret.'));
    } finally {
      setBusy(false);
    }
  };

  const unchanged = name.trim().toLocaleLowerCase('nb') === account?.username;
  return (
    <form onSubmit={save} className="stack">
      <div className="field">
        <label className="field-label" htmlFor="owner-name">
          Brukernavnet ditt
        </label>
        <span className="input-with-action">
          <input
            id="owner-name"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            aria-describedby="owner-name-hint"
          />
          <button type="submit" className="btn" disabled={busy || !online || unchanged || !name.trim()}>
            {busy ? <Spinner size={16} /> : null} Lagre
          </button>
        </span>
        <p id="owner-name-hint" className="form-hint">
          På en ny enhet logger du inn med dette brukernavnet og passordet i APP_PASSWORD, eller med passordet alene.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
