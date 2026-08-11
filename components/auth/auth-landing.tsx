'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/auth-shell';
import { AUTH_TAB_IDS, AuthTabs, type AuthTab } from '@/components/auth/auth-tabs';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';

const TAB_PATHS: Record<AuthTab, string> = {
  login: '/auth/sign-in',
  signup: '/auth/sign-up',
};

/**
 * The auth landing page: tabs plus whichever form is active, inside the
 * two-column shell.
 *
 * `/auth/sign-in` and `/auth/sign-up` both render this — only `defaultTab`
 * differs — so every existing link and redirect to either route still lands on
 * the right form. Switching tabs is pure state: the address bar is corrected
 * with `history.replaceState` rather than `router.push`, which keeps the URL
 * shareable without unmounting the page or hitting the server.
 */
export function AuthLanding({ defaultTab = 'login' }: { defaultTab?: AuthTab }) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const t = useTranslations('auth.tabs');
  const reduceMotion = useReducedMotion();

  const selectTab = (next: AuthTab) => {
    if (next === tab) return;
    setTab(next);
    window.history.replaceState(null, '', TAB_PATHS[next]);
  };

  return (
    <AuthShell>
      <AuthTabs
        value={tab}
        onChange={selectTab}
        loginLabel={t('login')}
        signUpLabel={t('signUp')}
        ariaLabel={t('ariaLabel')}
      />

      {/* mode="wait" so the outgoing form is gone before the incoming one
          mounts — the two differ a lot in height, and overlapping them mid
          transition makes the column jump. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          id={AUTH_TAB_IDS[tab].panel}
          role="tabpanel"
          aria-labelledby={AUTH_TAB_IDS[tab].tab}
          tabIndex={-1}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
          className="mt-8 focus:outline-none"
        >
          {tab === 'login' ? (
            <SignInForm onSwitchToSignUp={() => selectTab('signup')} />
          ) : (
            <SignUpForm />
          )}
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
