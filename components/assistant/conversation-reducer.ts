import type { AssistantEntity, AssistantEvent } from '@/lib/assistant/types';
import {
  emptyConversation,
  emptyMessage,
  type ConversationMessage,
  type ConversationState,
} from './types';

export type ConversationAction =
  | { type: 'send'; message: string; id: string; currentPage: AssistantEntity }
  | { type: 'event'; id: string; event: AssistantEvent }
  | { type: 'stream_ended'; id: string }
  | { type: 'failed'; id: string; message: string }
  | { type: 'clear_handoff' }
  | { type: 'restore'; state: ConversationState }
  | { type: 'reset' };

function patch(
  state: ConversationState,
  id: string,
  changes: Partial<ConversationMessage>
): ConversationState {
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === id ? { ...message, ...changes } : message
    ),
  };
}

function find(state: ConversationState, id: string): ConversationMessage | undefined {
  return state.messages.find((message) => message.id === id);
}

/**
 * The page the question was asked from, recorded on the user turn at `send`.
 *
 * The reducer has no router access, so this is the only reliable source — and
 * it is what "go back" returns to. The fallbacks exist purely so the type is
 * total; in practice the user turn is always present.
 */
function sourcePageOf(state: ConversationState, id: string): AssistantEntity {
  const user = find(state, `${id}-user`);
  return user?.entity ?? state.previousEntity ?? 'people';
}

/**
 * Folds NDJSON events into conversation state.
 *
 * Pure by design: the repo has no way to test React, so every decision the
 * panel appears to make actually happens here, where a node test can reach it.
 */
export function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'send': {
      // The user turn records the page it was asked from — the only place that
      // fact enters the reducer, and what "go back" later depends on.
      const user = {
        ...emptyMessage(`${action.id}-user`, 'user'),
        text: action.message,
        entity: action.currentPage,
      };
      const assistant = emptyMessage(action.id, 'assistant');
      return {
        ...state,
        messages: [...state.messages, user, assistant],
        isStreaming: true,
        error: null,
      };
    }

    case 'event': {
      const event = action.event;

      if (event.type === 'route') {
        const next = patch(state, action.id, {
          entity: event.targetEntity,
          action: event.action,
          confidence: event.confidence,
          filters: event.interpretedFilters,
          droppedFilters: event.droppedFilters,
        });

        // A navigate decision is the only thing that opens a handoff. The
        // question is carried too, because phase two re-sends it verbatim.
        if (event.action !== 'navigate') {
          return { ...next, previousEntity: event.targetEntity };
        }
        return {
          ...next,
          previousEntity: event.targetEntity,
          pendingHandoff: {
            from: sourcePageOf(state, action.id),
            to: event.targetEntity,
            sourceFilters: null,
            presetFilters: event.interpretedFilters,
            message: find(state, `${action.id}-user`)?.text ?? '',
          },
        };
      }

      if (event.type === 'filters') return patch(state, action.id, { chips: event.chips });

      if (event.type === 'results') {
        return patch(state, action.id, { rows: event.rows, total: event.total });
      }

      if (event.type === 'token') {
        const current = find(state, action.id);
        return patch(state, action.id, { text: (current?.text ?? '') + event.text });
      }

      if (event.type === 'suggestions') {
        return patch(state, action.id, { suggestions: event.items });
      }

      if (event.type === 'error') {
        return {
          ...patch(state, action.id, {
            error: { code: event.code, message: event.message },
            isComplete: true,
          }),
          isStreaming: false,
          error: event.message,
        };
      }

      // done
      return { ...patch(state, action.id, { isComplete: true }), isStreaming: false };
    }

    case 'stream_ended': {
      const message = find(state, action.id);
      if (!message || message.isComplete) return { ...state, isStreaming: false };
      // Keep whatever arrived and let the user retry, rather than discarding it.
      return {
        ...patch(state, action.id, {
          isComplete: true,
          error: { code: 'interrupted', message: 'Answer incomplete.' },
        }),
        isStreaming: false,
      };
    }

    case 'failed':
      return {
        ...patch(state, action.id, {
          isComplete: true,
          error: { code: 'request_failed', message: action.message },
        }),
        isStreaming: false,
        error: action.message,
      };

    case 'clear_handoff':
      return { ...state, pendingHandoff: null };

    case 'restore':
      return action.state;

    case 'reset':
      return emptyConversation();

    default:
      return state;
  }
}
