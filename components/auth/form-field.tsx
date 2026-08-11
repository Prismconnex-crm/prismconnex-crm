'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

/**
 * Field styling, light-mode first with the original dark hexes preserved as
 * `dark:` variants. The accent is the shared `brand` token (#005C9D, defined
 * in app/globals.css) — the same colour as the Login / Sign Up tabs and the
 * primary buttons, so a focused field reads as part of the same set rather
 * than a second, near-miss blue.
 *
 *   light -> surface #F8FAFC, border slate-300, text #111827
 *   dark  -> surface #0F1829, border #22304A,   text #FFFFFF
 *
 * The focus border is the one place that *does* have to switch. #005C9D is
 * 6.96:1 on the light surface but only 2.55:1 on #0F1829 — under the 3:1 WCAG
 * 1.4.11 floor for a non-text state indicator, and unlike the logo a focus ring
 * gets no logotype exemption. Dark mode therefore steps up to `brand-hover`
 * (#0086E6, 4.69:1), the same substitution the dark-mode link text makes.
 */
const FIELD_CLASSES =
  'w-full rounded-lg border bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#111827] placeholder-slate-400 transition-colors focus:outline-none focus:ring-1 dark:bg-[#0F1829] dark:text-white dark:placeholder-slate-500';
const FIELD_IDLE =
  'border-slate-300 focus:border-brand focus:ring-brand/40 dark:border-[#22304A] dark:focus:border-brand-hover dark:focus:ring-brand-hover/40';
const FIELD_INVALID = 'border-red-500/60 focus:border-red-500 focus:ring-red-500/40';

type FormFieldProps = {
  name: string;
  label: string;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  defaultValue?: string;
  optionalLabel?: string;
  /**
   * Pass `value` to drive the input from state (the Company Name field, which
   * is written both by the user and by domain detection). Omit it and the
   * input stays uncontrolled, which is what every other field here relies on —
   * they are read from FormData on submit.
   */
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Muted helper line under the input. Not an error; styled neutrally. */
  hint?: string;
  /** Shows a spinner inside the field while a background lookup is running. */
  busy?: boolean;
};

/** Label + input + inline error, matching the red error styling used app-wide. */
export function FormField({
  name,
  label,
  error,
  type = 'text',
  placeholder,
  autoComplete,
  defaultValue,
  optionalLabel,
  value,
  onChange,
  onBlur,
  hint,
  busy,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // An input may be controlled or uncontrolled but never both, and switching
  // between the two mid-life logs a React warning.
  const isControlled = value !== undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {label}
        {optionalLabel ? (
          <span className="ml-1 font-normal text-slate-500 dark:text-slate-500">{optionalLabel}</span>
        ) : null}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...(isControlled ? { value } : { defaultValue })}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`${FIELD_CLASSES} ${busy ? 'pr-11' : ''} ${error ? FIELD_INVALID : FIELD_IDLE}`}
        />
        {busy ? (
          <span className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        // role="status" so the auto-fill is announced politely rather than
        // interrupting a screen reader mid-field.
        <p id={hintId} role="status" className="text-[12px] text-slate-500 dark:text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type PasswordFieldProps = Omit<FormFieldProps, 'type' | 'optionalLabel'> & {
  showLabel: string;
  hideLabel: string;
};

/** Password input with a show/hide toggle. Used for password and confirm-password. */
export function PasswordField({
  name,
  label,
  error,
  placeholder,
  autoComplete,
  defaultValue,
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${FIELD_CLASSES} pr-11 ${error ? FIELD_INVALID : FIELD_IDLE}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:text-brand dark:text-slate-500 dark:hover:text-slate-300 dark:focus-visible:text-brand-hover"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
