'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildHandoffUrl,
  decideCrossIntent,
  takePendingAsk,
  type SearchDomain,
} from '@/lib/search/cross-intent';

/**
 * Wires one "Find anything" box into cross-page routing.
 *
 * Two halves of the same handoff:
 *
 * - The returned `handOff(question)` is the *send* side. It returns true when
 *   the question belonged to the other page and a navigation was started, so
 *   the caller knows to stop — nothing is ever answered on the wrong page.
 * - `onPendingAsk` is the *receive* side, fired once on mount when this page
 *   was opened with a handed-off question in the URL.
 *
 * Deliberately, `onPendingAsk` is handed the page's own query runner rather
 * than its submit handler: a received question is never re-classified, so a
 * handoff cannot bounce back to where it came from. The same shape the
 * assistant router uses for `forceEntity`.
 *
 * The navigation is `router.push`, so it is a client-side transition — no
 * reload, and Back returns to the page the question was typed on.
 */
export function useAskHandoff(
  domain: SearchDomain,
  onPendingAsk: (question: string) => void
): (question: string) => boolean {
  const router = useRouter();

  // The mount effect must run exactly once — the URL parameter is consumed
  // destructively — but `onPendingAsk` is rebuilt on most renders. Reading it
  // through a ref keeps the effect's dependency list empty without capturing a
  // stale closure.
  const pendingHandler = useRef(onPendingAsk);
  pendingHandler.current = onPendingAsk;

  useEffect(() => {
    const question = takePendingAsk();
    if (question) pendingHandler.current(question);
  }, []);

  return useCallback(
    (question: string) => {
      const decision = decideCrossIntent(question, domain);
      if (decision.kind !== 'handoff') return false;
      router.push(buildHandoffUrl(decision.target, question, domain));
      return true;
    },
    [domain, router]
  );
}
