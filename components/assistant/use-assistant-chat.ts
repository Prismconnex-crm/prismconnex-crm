"use client";

import { useCallback } from 'react';
import { useAssistantConversation } from './assistant-provider';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * The panel's view of the shared conversation, scoped to one page.
 *
 * Thin by design — everything it appears to decide is decided in
 * conversation-reducer.ts and handoff.ts, which are node-testable.
 */
export function useAssistantChat({
  currentPage,
  activeFilters,
}: {
  currentPage: AssistantEntity;
  activeFilters?: Record<string, unknown>;
}) {
  const { state, send, retry, stop, reset, clearHandoff } = useAssistantConversation();

  const sendMessage = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || state.isStreaming) return;
      await send({ message: question, currentPage, activeFilters });
    },
    [send, currentPage, activeFilters, state.isStreaming]
  );

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    pendingHandoff: state.pendingHandoff,
    send: sendMessage,
    retry: useCallback(() => retry(currentPage), [retry, currentPage]),
    stop,
    reset,
    clearHandoff,
  };
}
