'use client';

import { motion, useReducedMotion } from 'framer-motion';

export type AuthTab = 'login' | 'signup';

export const AUTH_TAB_IDS: Record<AuthTab, { tab: string; panel: string }> = {
  login: { tab: 'auth-tab-login', panel: 'auth-panel-login' },
  signup: { tab: 'auth-tab-signup', panel: 'auth-panel-signup' },
};

const ORDER: AuthTab[] = ['login', 'signup'];

/**
 * Login / Sign Up segmented control.
 *
 * The active pill is a `layoutId` element so framer-motion slides it between
 * the two tabs instead of cross-fading two separate backgrounds. Arrow keys
 * move between tabs, which is what `role="tablist"` promises to assistive tech.
 */
export function AuthTabs({
  value,
  onChange,
  loginLabel,
  signUpLabel,
  ariaLabel,
}: {
  value: AuthTab;
  onChange: (tab: AuthTab) => void;
  loginLabel: string;
  signUpLabel: string;
  ariaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const tabs: Array<{ id: AuthTab; label: string }> = [
    { id: 'login', label: loginLabel },
    { id: 'signup', label: signUpLabel },
  ];

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = ORDER[(ORDER.indexOf(value) + delta + ORDER.length) % ORDER.length];
    onChange(next);
    document.getElementById(AUTH_TAB_IDS[next].tab)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-[#F8FAFC] p-1 transition-colors dark:border-[#22304A] dark:bg-[#0F1829]"
    >
      {tabs.map(({ id, label }) => {
        const active = id === value;

        return (
          <button
            key={id}
            id={AUTH_TAB_IDS[id].tab}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={AUTH_TAB_IDS[id].panel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            className={`relative rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
              // The active pill is the brand blue in both themes, so its label
              // stays white either way; only the inactive label needs to switch.
              active
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="auth-tab-indicator"
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-brand shadow-lg shadow-brand/20"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 34 }
                }
              />
            ) : null}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
