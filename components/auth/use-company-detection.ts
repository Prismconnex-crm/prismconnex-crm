'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { companyDomainFromEmail } from '@/lib/auth/email-domain';

/** How long to wait after the last keystroke before looking a domain up. */
const DEBOUNCE_MS = 400;

/**
 * Fills the sign-up form's Company Name field from the email domain.
 *
 * Owns three pieces of state the form would otherwise tangle together: the
 * field value, whether a lookup is in flight, and whether the current value
 * came from detection or from the user.
 *
 * Rules it enforces:
 * - The user always wins. After any keystroke in the Company Name field, its
 *   value is never overwritten by a later detection.
 * - A miss clears an auto-filled value rather than leaving a stale company
 *   attached to a changed email address.
 * - Nothing ever surfaces an error. A failed request is indistinguishable from
 *   "no company found".
 */
export function useCompanyDetection() {
  const [companyName, setCompanyName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Refs, not state: these must be read synchronously inside async callbacks
  // that were created before the re-render, where state would be stale.
  const userEditedRef = useRef(false);
  // Monotonic id; only the newest request may write. Without this a slow reply
  // for an earlier address can land after a newer one and overwrite it.
  const requestIdRef = useRef(0);
  // Skips re-requesting a domain that was just resolved, so tabbing out of an
  // unchanged email field costs nothing.
  const lastDomainRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Writes a detection result, unless the user has taken over the field. */
  const applyResult = useCallback((name: string | null) => {
    if (userEditedRef.current) return;
    setCompanyName(name ?? '');
    setAutoFilled(Boolean(name));
  }, []);

  const lookup = useCallback(
    async (email: string) => {
      const domain = companyDomainFromEmail(email);

      // Not a usable corporate domain yet — still typing, or a personal
      // mailbox. Drop any previously detected name so it cannot outlive the
      // address it came from.
      if (!domain) {
        requestIdRef.current += 1;
        lastDomainRef.current = null;
        setDetecting(false);
        applyResult(null);
        return;
      }

      if (domain === lastDomainRef.current) return;
      lastDomainRef.current = domain;

      const requestId = (requestIdRef.current += 1);
      setDetecting(true);

      try {
        const res = await fetch(
          `/api/companies/by-domain?domain=${encodeURIComponent(domain)}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = await res.json();

        if (requestId !== requestIdRef.current) return;
        applyResult(res.ok ? (data?.company?.name ?? null) : null);
      } catch {
        // Offline or aborted. Silence is the specified behaviour: no error,
        // and no change to whatever the field already holds.
        if (requestId === requestIdRef.current) lastDomainRef.current = null;
      } finally {
        if (requestId === requestIdRef.current) setDetecting(false);
      }
    },
    [applyResult]
  );

  /** Debounced: called on every keystroke in the email field. */
  const onEmailChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void lookup(value), DEBOUNCE_MS);
    },
    [lookup]
  );

  /** Immediate: the address is finished when the user leaves the field. */
  const onEmailBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void lookup(event.target.value);
    },
    [lookup]
  );

  /** Any manual edit hands the field to the user permanently. */
  const onCompanyNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    userEditedRef.current = true;
    setAutoFilled(false);
    setCompanyName(event.target.value);
  }, []);

  return {
    companyName,
    /** True while a lookup is in flight — drives the field's spinner. */
    detecting,
    /** True when the current value was filled by detection, not typed. */
    autoFilled,
    onEmailChange,
    onEmailBlur,
    onCompanyNameChange,
  };
}
