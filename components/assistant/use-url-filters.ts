"use client";

import { useCallback, useEffect, useState } from 'react';
import { bindingFor } from './registry';
import type { AssistantEntity } from '@/lib/assistant/types';

/** The slice of PageBinding this hook needs, without its row-context generic. */
type PageBindingLike<F> = {
  emptyFilters(): F;
  serializeFilters(filters: F): string;
  parseFilters(search: string): F;
};

/**
 * Filter state that lives in the URL, so it survives a handoff, browser back
 * and a refresh.
 *
 * Generalises what components/events/event-list-view.tsx already does.
 *
 * `useSearchParams` is deliberately avoided: in Next 14 it forces the reading
 * subtree into a Suspense boundary. components/auth/sign-in-form.tsx records
 * the same decision independently.
 *
 * The URL is read in an effect, never in the render initializer. Parsing during
 * render makes the server produce an unfiltered list and the client a filtered
 * one — a hydration mismatch.
 */
export function useUrlFilters<F>(entity: AssistantEntity): {
  filters: F;
  setFilters: (next: F) => void;
  isHydrated: boolean;
} {
  const binding = bindingFor(entity) as unknown as PageBindingLike<F>;
  const [filters, setState] = useState<F>(() => binding.emptyFilters());
  const [isHydrated, setIsHydrated] = useState(false);

  // Read once on mount, and again whenever the user moves through history.
  useEffect(() => {
    const read = () => setState(binding.parseFilters(window.location.search));
    read();
    setIsHydrated(true);
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [binding]);

  const setFilters = useCallback(
    (next: F) => {
      setState(next);
      if (typeof window === 'undefined') return;
      // replaceState, not router.replace: this only needs to keep the address
      // bar shareable, and avoids re-running the RSC payload on every checkbox
      // click. It also keeps filter edits out of the history stack, so a
      // debounced facet toggle does not become a back-button step.
      const search = binding.serializeFilters(next);
      window.history.replaceState(null, '', `${window.location.pathname}${search}`);
    },
    [binding]
  );

  return { filters, setFilters, isHydrated };
}
