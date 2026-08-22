"use client";

import { useCallback } from 'react';
import { useAssistantConversation } from './assistant-provider';
import { useUrlFilters } from './use-url-filters';
import type { AssistantEntity } from '@/lib/assistant/types';

/**
 * The panel's view of the shared conversation, scoped to one page.
 *
 * Thin by design — everything it appears to decide is decided in
 * conversation-reducer.ts and handoff.ts, which are node-testable.
 *
 * It reads the page's filters from the URL itself rather than taking them as a
 * prop, which is what let `activeFilters` and `onGoBack` be deleted from the
 * panel's signature instead of duplicated onto a third page.
 */
export function useAssistantChat({ entity }: { entity: AssistantEntity }) {
  const { state, conversationId, send, retry, stop, reset, clearHandoff, cancelHandoff } =
    useAssistantConversation();
  const { filters } = useUrlFilters<unknown>(entity);

  const sendMessage = useCallback(
    async (message: string) => {
      const question = message.trim();
      if (!question || state.isStreaming) return;
      await send({
        message: question,
        currentPage: entity,
        activeFilters: filters as Record<string, unknown>,
        // The same value, for two different jobs: the server carries it across
        // entities, and the reducer keeps it so "go back" can restore it.
        sourceFilters: filters,
      });
    },
    [send, entity, filters, state.isStreaming]
  );

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    pendingHandoff: state.pendingHandoff,
    handoffWarning: state.handoffWarning,
    /** Keys the panel's saved scroll offset. */
    conversationId,
    send: sendMessage,
    retry: useCallback(() => retry(entity), [retry, entity]),
    stop,
    reset,
    clearHandoff,
    cancelHandoff,
  };
}
