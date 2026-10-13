import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { addPresetSubject, createSubject } from '../actions';
import { api, errorMessage } from '../api';
import type { SubjectPresetSummary, SubjectProfile } from '@smartnotes/shared';
import { useOnline } from '../lib/connectivity';
import { plural } from '../lib/format';
import { PROFILES, PROFILE_ORDER } from '../lib/subjects';
import { newSubjectStore, toast } from '../lib/ui';
import { Modal } from './Modal';
import { Spinner } from './Status';

type Mode = 'preset' | 'custom';

/**
 * «Legg til fag»: et fag fra oppsettene etter læreplanen (temaer, deltemaer og kompetansemål fra Udir), eller et eget
 * fag med bare navn og fagtype.
 */
export function NewSubjectDialog() {
  const open = newSubjectStore.use();
  const [mode, setMode] = useState<Mode>('preset');
  useEffect(() => {
    if (open) setMode('preset');
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={() => newSubjectStore.set(false)}
      title="Legg til fag"
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={() => newSubjectStore.set(false)}>
            Avbryt
          </button>
          <button type="submit" form="new-subject-form" className="btn btn-primary">
            {mode === 'preset' ? 'Legg til faget' : 'Opprett fag'}
          </button>
        </>
      }
    >
      {open && (
        <>
          <div className="segmented subject-mode" role="radiogroup" aria-label="Hva slags fag">
            {(
              [
                ['preset', 'Fra læreplanen'],
                ['custom', 'Eget fag'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                className="segment"
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'preset' ? <PresetForm /> : <CustomForm />}
        </>
      )}
    </Modal>
  );
}

function PresetForm() {
  const navigate = useNavigate();
  const { online } = useOnline();
  const [presets, setPresets] = useState<SubjectPresetSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    api
      .presets(ctrl.signal)
      .then((res) => {
        setPresets(res.presets);
        setChosen((cur) => cur ?? res.presets.find((p) => !p.added)?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoadError(errorMessage(err, 'Kunne ikke hente fagene.'));
      });
    return () => ctrl.abort();
  }, [online]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!online) {
      setError('Du må være på nett for å legge til et fag.');
      return;
    }
    const preset = presets?.find((p) => p.id === chosen);
    if (!preset || preset.added) {
      setError('Velg et fag du ikke har fra før.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const subject = await addPresetSubject(preset.id);
      newSubjectStore.set(false);
      toast(`«${subject.name}» er lagt til.`, { kind: 'success' });
      navigate(`/fag/${subject.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Kunne ikke legge til faget.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="new-subject-form" className="stack" onSubmit={submit}>
      <p className="muted small">
        Faget får egne temaer og kompetansemålene fra læreplanen (LK20). Har du en lærebok, kan du senere hente inn
        innholdsfortegnelsen i faginnstillingene.
      </p>
      {!online && <p className="form-hint">Du må være på nett for å legge til et fag.</p>}
      {online && !presets && !loadError && <Spinner size={18} />}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {presets && (
        <fieldset className="field profile-choice">
          <legend className="sr-only">Fag</legend>
          <div className="profile-options">
            {presets.map((p) => {
              const { Icon } = PROFILES[p.profile];
              return (
                <label key={p.id} className={`profile-option${chosen === p.id ? ' is-on' : ''}${p.added ? ' is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="preset"
                    value={p.id}
                    checked={chosen === p.id}
                    disabled={p.added}
                    onChange={() => setChosen(p.id)}
                  />
                  <Icon size={18} aria-hidden />
                  <span className="profile-option-text">
                    <span className="profile-option-label">{p.subjectName}</span>
                    <span className="profile-option-meta">
                      {p.added
                        ? 'Du har dette faget'
                        : `${plural(p.chapterCount, 'tema', 'temaer')} · ${plural(p.aimCount, 'kompetansemål', 'kompetansemål')}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function CustomForm() {
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
          placeholder="F.eks. navnet på læreboka di"
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
