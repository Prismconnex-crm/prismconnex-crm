"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { conversationReducer } from './conversation-reducer';
import { phaseTwoRequest } from './handoff';
import { bindingFor, hasBinding } from './registry';
import { restoreConversation, serializeConversation, SESSION_KEY } from './session-mirror';
import { readAssistantStream } from './stream-reader';
import { emptyConversation, type ConversationState } from './types';
import type { AssistantEntity } from '@/lib/assistant/types';

const ENDPOINT = '/api/assistant/chat';

export type SendInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  forceEntity?: AssistantEntity;
  presetFilters?: unknown;
};

type ContextValue = {
  state: ConversationState;
  send: (input: SendInput) => Promise<void>;
  retry: (currentPage: AssistantEntity) => Promise<void>;
  stop: () => void;
  reset: () => void;
  clearHandoff: () => void;
};

const AssistantContext = createContext<ContextValue | null>(null);

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns the conversation for the whole app.
 *
 * Mounted inside AppShell, which persists across section navigation in the App
 * Router — that is what lets the thread survive a handoff with plain React
 * state rather than a storage round-trip.
 */
export function AssistantConversationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, emptyConversation);
  const router = useRouter();
  const pathname = usePathname();

  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<SendInput | null>(null);
  const phaseTwoRef = useRef<string | null>(null);
  const previousEntityRef = useRef<AssistantEntity | null>(null);

  previousEntityRef.current = state.previousEntity;

  // Restore once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restored = restoreConversation(window.sessionStorage.getItem(SESSION_KEY));
    if (restored.messages.length > 0) {
      dispatch({ type: 'restore', state: restored });
    }
  }, []);

  // Mirror on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, serializeConversation(state));
    } catch {
      // Storage full or blocked — the in-memory thread still works.
    }
  }, [state]);

  const run = useCallback(async (input: SendInput) => {
    const controller = new AbortController();
    abortRef.current = controller;
    lastSendRef.current = input;

    const id = newId();
    dispatch({ type: 'send', message: input.message, id, currentPage: input.currentPage });

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          currentPage: input.currentPage,
          activeFilters: input.activeFilters,
          previousEntity: previousEntityRef.current,
          forceEntity: input.forceEntity,
          presetFilters: input.presetFilters,
          page: 1,
        }),
        signal: controller.signal,
      });

      await readAssistantStream(response, (event) => {
        dispatch({ type: 'event', id, event });
      });

      dispatch({ type: 'stream_ended', id });
    } catch (caught) {
      if ((caught as Error).name === 'AbortError') {
        dispatch({ type: 'stream_ended', id });
      } else {
        const message = caught instanceof Error ? caught.message : 'Something went wrong.';
        dispatch({ type: 'failed', id, message });
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  // Navigate on a pending handoff, then issue phase two on arrival.
  useEffect(() => {
    const handoff = state.pendingHandoff;
    if (!handoff) return;
    // events/companies bindings land in Spec 2b; until then the handoff line
    // is shown and nothing navigates, rather than throwing.
    if (!hasBinding(handoff.to)) return;

    const target = bindingFor(handoff.to).route;

    if (pathname !== target) {
      router.push(target);
      return;
    }

    // Arrived. Issue phase two exactly once per handoff.
    const key = `${handoff.to}:${handoff.message}`;
    if (phaseTwoRef.current === key) return;
    phaseTwoRef.current = key;

    void run(phaseTwoRequest(handoff));
  }, [state.pendingHandoff, pathname, router, run]);

  const value = useMemo<ContextValue>(
    () => ({
      state,
      send: run,
      retry: async (currentPage: AssistantEntity) => {
        const last = lastSendRef.current;
        if (!last) return;
        await run({ ...last, currentPage });
      },
      stop: () => abortRef.current?.abort(),
      reset: () => {
        abortRef.current?.abort();
        phaseTwoRef.current = null;
        dispatch({ type: 'reset' });
      },
      clearHandoff: () => dispatch({ type: 'clear_handoff' }),
    }),
    [state, run]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantConversation(): ContextValue {
  const value = useContext(AssistantContext);
  if (!value) {
    throw new Error('useAssistantConversation must be used inside AssistantConversationProvider');
  }
  return value;
}
