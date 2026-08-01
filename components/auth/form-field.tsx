'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const FIELD_CLASSES =
  'w-full rounded-lg border bg-[#0F1829] px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-1';
const FIELD_IDLE = 'border-[#22304A] focus:border-indigo-500 focus:ring-indigo-500/40';
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
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-300">
        {label}
        {optionalLabel ? (
          <span className="ml-1 font-normal text-slate-500">{optionalLabel}</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${FIELD_CLASSES} ${error ? FIELD_INVALID : FIELD_IDLE}`}
      />
      {error ? (
        <p id={errorId} className="text-[12px] text-red-400">
          {error}
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
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-300">
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
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-300 focus:outline-none focus-visible:text-indigo-400"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-[12px] text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
