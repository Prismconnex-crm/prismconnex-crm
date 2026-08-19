import { emptyConversation, type ConversationState } from './types';

/** sessionStorage, not localStorage: a refresh keeps the thread, a new tab does not. */
export const SESSION_KEY = 'pcx_assistant_conversation';

export function serializeConversation(state: ConversationState): string {
  return JSON.stringify({
    messages: state.messages,
    previousEntity: state.previousEntity,
  });
}

/**
 * Restores a thread, never throwing.
 *
 * `isStreaming` and `pendingHandoff` are deliberately NOT restored: the request
 * that was in flight is gone, and the navigation it implied either already
 * happened or never will. Restoring either would strand the UI.
 */
export function restoreConversation(raw: string | null): ConversationState {
  if (!raw) return emptyConversation();

  try {
    const parsed = JSON.parse(raw) as Partial<ConversationState>;
    if (!Array.isArray(parsed.messages)) return emptyConversation();

    return {
      ...emptyConversation(),
      messages: parsed.messages,
      previousEntity: parsed.previousEntity ?? null,
    };
  } catch {
    // Corrupt entry — start clean rather than breaking the panel, matching
    // components/search/query-store.ts.
    return emptyConversation();
  }
}
