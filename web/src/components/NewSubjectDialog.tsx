import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createSubject } from '../actions';
import { errorMessage } from '../api';
import type { SubjectProfile } from '@smartnotes/shared';
import { useOnline } from '../lib/connectivity';
import { PROFILES, PROFILE_ORDER } from '../lib/subjects';
import { newSubjectStore, toast } from '../lib/ui';
import { Modal } from './Modal';

export function NewSubjectDialog() {
  const open = newSubjectStore.use();
  return (
    <Modal
      open={open}
      onClose={() => newSubjectStore.set(false)}
      title="Nytt fag"
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={() => newSubjectStore.set(false)}>
            Avbryt
          </button>
          <button type="submit" form="new-subject-form" className="btn btn-primary">
            Opprett fag
          </button>
        </>
      }
    >
      {open && <NewSubjectForm />}
    </Modal>
  );
}

function NewSubjectForm() {
  const navigate = useNavigate();
  const { online } = useOnline();
  const [name, setName] = useState('');
  const [textbook, setTextbook] = useState('');
  const [profile, setProfile] = useState<SubjectProfile>('physics');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!online) {
      setError('Du må være på nett for å opprette et fag.');
      return;
    }
    if (!name.trim()) {
      setError('Gi faget et navn.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const subject = await createSubject(name.trim(), textbook.trim() || null, profile);
      newSubjectStore.set(false);
      toast(`«${subject.name}» er opprettet.`, { kind: 'success' });
      navigate(`/fag/${subject.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke opprette faget.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="new-subject-form" className="stack" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Navn</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="F.eks. Kjemi 2"
          maxLength={100}
          data-autofocus
          required
        />
      </label>
      <label className="field">
        <span className="field-label">
          Lærebok / emne <span className="optional">(valgfri)</span>
        </span>
        <input
          type="text"
          value={textbook}
          onChange={(e) => setTextbook(e.target.value)}
          placeholder="F.eks. Kjemi 2 (Aschehoug)"
          maxLength={200}
        />
      </label>
      <fieldset className="field profile-choice">
        <legend className="field-label">Fagtype</legend>
        <p className="muted small">Bestemmer instruksene til Claude, PDF-malen og fargene i appen.</p>
        <div className="profile-options">
          {PROFILE_ORDER.map((id) => {
            const { label, template, Icon } = PROFILES[id];
            return (
              <label key={id} className={`profile-option${profile === id ? ' is-on' : ''}`}>
                <input type="radio" name="profile" value={id} checked={profile === id} onChange={() => setProfile(id)} />
                <Icon size={18} aria-hidden />
                <span className="profile-option-text">
                  <span className="profile-option-label">{label}</span>
                  <span className="profile-option-meta">PDF-mal: {template}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {!online && <p className="form-hint">Du må være på nett for å opprette et fag.</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
