"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { conversationReducer } from './conversation-reducer';
import { cancelToPhaseTwo, handoffUrl, phaseTwoRequest, supersede } from './handoff';
import { bindingFor, hasBinding } from './registry';
import { restoreConversation, serializeConversation, sessionKeyFor } from './session-mirror';
import { readAssistantStream } from './stream-reader';
import { emptyConversation, type ConversationState } from './types';
import type { AssistantEntity } from '@/lib/assistant/types';

const ENDPOINT = '/api/assistant/chat';

/** Long enough to read the card and press Cancel; short enough not to feel stuck. */
const HANDOFF_DELAY_MS = 1500;

/** Matches the endpoint's own cap, so a pasted cid cannot be rejected by us. */
const MAX_CONVERSATION_ID = 64;

export type SendInput = {
  message: string;
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
  /** The asking page's live filters, recorded so "go back" can restore them. */
  sourceFilters?: unknown;
  forceEntity?: AssistantEntity;
  presetFilters?: unknown;
};

type ContextValue = {
  state: ConversationState;
  conversationId: string;
  send: (input: SendInput) => Promise<void>;
  retry: (currentPage: AssistantEntity) => Promise<void>;
  stop: () => void;
  reset: () => void;
  clearHandoff: () => void;
  cancelHandoff: () => void;
};

const AssistantContext = createContext<ContextValue | null>(null);

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The thread's identity, stable across navigation.
 *
 * Read from `?cid=` first so a pasted handoff link rejoins its own thread
 * rather than starting a new one; generated otherwise. Never read during
 * render — see the mount effect.
 */
function newConversationId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const [conversationId, setConversationId] = useState<string>(newConversationId);

  /** The armed countdown. Held here, not in the card, so cancelling is a ref op. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Lets callbacks read current state without re-creating themselves. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Adopt the id from the URL, then restore that thread. Both happen in an
  // effect: reading window during render is a hydration mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('cid');
    const id = fromUrl && fromUrl.length <= MAX_CONVERSATION_ID ? fromUrl : conversationId;
    if (id !== conversationId) setConversationId(id);

    const restored = restoreConversation(window.sessionStorage.getItem(sessionKeyFor(id)));
    if (restored.messages.length > 0) {
      dispatch({ type: 'restore', state: restored });
    }
    // Mount only: adopting a new cid mid-session would abandon the live thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror on change, under this conversation's own key.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(sessionKeyFor(conversationId), serializeConversation(state));
    } catch {
      // Storage full or blocked — the in-memory thread still works.
    }
  }, [state, conversationId]);

  const run = useCallback(async (input: SendInput) => {
    // A new question supersedes a navigation that has not landed. Without this
    // the second answer arrives and the first push then fires underneath it.
    if (supersede(stateRef.current).kind === 'cancel') {
      clearTimer();
      dispatch({ type: 'cancel_handoff' });
    }

    const controller = new AbortController();
    abortRef.current = controller;
    lastSendRef.current = input;

    const id = newId();
    dispatch({
      type: 'send',
      message: input.message,
      id,
      currentPage: input.currentPage,
      sourceFilters: input.sourceFilters ?? null,
    });

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
          conversationId,
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
  }, [conversationId, clearTimer]);

  // Arm the countdown, then navigate; issue phase two on arrival.
  useEffect(() => {
    const handoff = state.pendingHandoff;
    if (!handoff) return;

    // No binding means no way to render the target's rows on the client. Show
    // the explanation and stop — no countdown, no navigation, no false promise
    // that pressing something will fetch it. Companies until Spec 3b.
    if (!hasBinding(handoff.to)) return;

    // Cancelled handoffs are kept so the re-ask and the banner can use them;
    // they must not navigate.
    if (handoff.status === 'cancelled') return;

    const binding = bindingFor(handoff.to);

    if (pathname !== binding.route) {
      if (handoff.status === 'navigating') return; // push already fired
      if (timerRef.current !== null) return; // already armed

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dispatch({ type: 'handoff_navigating' });
        try {
          // router.push, not replaceState: a handoff IS a navigation and SHOULD
          // be a history entry — that is what makes browser back work.
          router.push(
            handoffUrl({
              route: binding.route,
              serializedFilters: (
                binding as unknown as { serializeFilters(filters: unknown): string }
              ).serializeFilters(handoff.presetFilters),
              message: handoff.message,
              from: handoff.from,
              conversationId,
            })
          );
        } catch {
          dispatch({
            type: 'handoff_failed',
            reason: 'Could not open that page — answering here instead.',
          });
        }
      }, HANDOFF_DELAY_MS);

      return () => clearTimer();
    }

    // Arrived. Issue phase two exactly once per handoff.
    const key = `${handoff.to}:${handoff.message}`;
    if (phaseTwoRef.current === key) return;
    phaseTwoRef.current = key;

    void run(phaseTwoRequest(handoff));
  }, [state.pendingHandoff, pathname, router, run, conversationId, clearTimer]);

  const value = useMemo<ContextValue>(
    () => ({
      state,
      conversationId,
      send: run,
      retry: async (currentPage: AssistantEntity) => {
        const last = lastSendRef.current;
        if (!last) return;
        await run({ ...last, currentPage });
      },
      stop: () => abortRef.current?.abort(),
      reset: () => {
        abortRef.current?.abort();
        clearTimer();
        phaseTwoRef.current = null;
        dispatch({ type: 'reset' });
      },
      clearHandoff: () => dispatch({ type: 'clear_handoff' }),
      cancelHandoff: () => {
        clearTimer();
        const decision = supersede(stateRef.current);
        dispatch({ type: 'cancel_handoff' });
        // Spec 1 guarantees a navigate turn carries no rows, so there is no
        // inline answer to fall back on — the question has to be asked again,
        // with the TARGET's adapter answering it in place.
        if (decision.kind === 'cancel') void run(cancelToPhaseTwo(decision.handoff));
      },
    }),
    [state, run, conversationId, clearTimer]
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
