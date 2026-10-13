import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Passordfelt med knapp for å vise passordet (innlogging, registrering og nytt passord). */
export function PasswordField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const hintId = props.hint ? `${props.id}-hint` : undefined;
  const describedBy = [hintId, props.describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={props.id}>
        {props.label}
      </label>
      <span className="input-with-inner-action">
        <input
          id={props.id}
          type={show ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          autoFocus={props.autoFocus}
          required
          aria-invalid={props.invalid || undefined}
          aria-describedby={describedBy}
          disabled={props.disabled}
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
      {props.hint && (
        <p id={hintId} className="form-hint">
          {props.hint}
        </p>
      )}
    </div>
  );
}
