import { describe, expect, it } from 'vitest';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';
import type { ConversationState } from '@/components/assistant/types';
import type { AssistantEvent } from '@/lib/assistant/types';

const ASSISTANT_ID = 'a1';

function afterSend(message = 'people in Germany'): ConversationState {
  return conversationReducer(emptyConversation(), {
    type: 'send',
    message,
    id: ASSISTANT_ID,
    currentPage: 'people',
  });
}

function feed(state: ConversationState, events: AssistantEvent[]): ConversationState {
  return events.reduce(
    (acc, event) => conversationReducer(acc, { type: 'event', id: ASSISTANT_ID, event }),
    state
  );
}

const inlineRoute: AssistantEvent = {
  type: 'route',
  targetEntity: 'people',
  action: 'answer_inline',
  confidence: 0.95,
  handoffMessage: '',
  interpretedFilters: { countries: ['Germany'] },
  droppedFilters: [],
  crossReference: null,
};

describe('conversationReducer — send', () => {
  it('appends a completed user turn and a pending assistant turn', () => {
    const state = afterSend();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].isComplete).toBe(true);
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].isComplete).toBe(false);
    expect(state.isStreaming).toBe(true);
  });

  it('records the page the question was asked from', () => {
    expect(afterSend().messages[0].entity).toBe('people');
  });
});

describe('conversationReducer — inline answer', () => {
  it('builds a complete assistant turn from the full event sequence', () => {
    const state = feed(afterSend(), [
      inlineRoute,
      { type: 'filters', chips: [{ key: 'countries:Germany', label: 'Country', value: 'Germany' }] },
      { type: 'results', rows: [{ id: 'p1' }], total: 42 },
      { type: 'token', text: 'Found ' },
      { type: 'token', text: '42 contacts.' },
      { type: 'suggestions', items: ['Show me more'] },
      { type: 'done' },
    ]);

    const reply = state.messages[1];
    expect(reply.entity).toBe('people');
    expect(reply.action).toBe('answer_inline');
    expect(reply.chips).toHaveLength(1);
    expect(reply.rows).toHaveLength(1);
    expect(reply.total).toBe(42);
    expect(reply.text).toBe('Found 42 contacts.');
    expect(reply.suggestions).toEqual(['Show me more']);
    expect(reply.isComplete).toBe(true);
    expect(state.isStreaming).toBe(false);
    expect(state.previousEntity).toBe('people');
    expect(state.pendingHandoff).toBeNull();
  });

  it('preserves a null total rather than coercing it to zero', () => {
    const state = feed(afterSend(), [
      { ...inlineRoute, targetEntity: 'companies' },
      { type: 'results', rows: [{ id: 'c1' }], total: null },
      { type: 'done' },
    ]);
    expect(state.messages[1].total).toBeNull();
  });
});

describe('conversationReducer — navigate', () => {
  const navigateRoute: AssistantEvent = {
    type: 'route',
    targetEntity: 'events',
    action: 'navigate',
    confidence: 0.95,
    handoffMessage: "That's a question about events — opening Events.",
    interpretedFilters: { city: 'Berlin' },
    droppedFilters: ['verification'],
    crossReference: null,
  };

  it('records a pending handoff carrying the preset filters and the question', () => {
    const state = feed(afterSend('what conferences are in Berlin'), [
      navigateRoute,
      { type: 'token', text: "That's a question about events." },
      { type: 'done' },
    ]);

    expect(state.pendingHandoff).toEqual({
      from: 'people',
      to: 'events',
      sourceFilters: null,
      presetFilters: { city: 'Berlin' },
      message: 'what conferences are in Berlin',
    });
    expect(state.messages[1].droppedFilters).toEqual(['verification']);
  });

  it('carries no rows', () => {
    const state = feed(afterSend(), [navigateRoute, { type: 'done' }]);
    expect(state.messages[1].rows).toEqual([]);
  });
});

describe('conversationReducer — confirm', () => {
  it('offers suggestions and sets no handoff', () => {
    const state = feed(afterSend('companies and contacts'), [
      {
        type: 'route',
        targetEntity: 'companies',
        action: 'confirm',
        confidence: 0.45,
        handoffMessage: 'Which did you mean?',
        interpretedFilters: {},
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'suggestions', items: ['Search Companies', 'Search People'] },
      { type: 'done' },
    ]);

    expect(state.messages[1].action).toBe('confirm');
    expect(state.messages[1].suggestions).toHaveLength(2);
    expect(state.pendingHandoff).toBeNull();
  });
});

describe('conversationReducer — failures', () => {
  it('marks the turn failed on an error event', () => {
    const state = feed(afterSend(), [
      { type: 'error', code: 'search_failed', message: 'Could not search people' },
    ]);
    expect(state.messages[1].error?.code).toBe('search_failed');
    expect(state.messages[1].isComplete).toBe(true);
    expect(state.error).toBe('Could not search people');
  });

  it('marks an unterminated stream interrupted, keeping the partial answer', () => {
    const partial = feed(afterSend(), [inlineRoute, { type: 'token', text: 'Partial' }]);
    const state = conversationReducer(partial, { type: 'stream_ended', id: ASSISTANT_ID });

    expect(state.messages[1].text).toBe('Partial');
    expect(state.messages[1].error?.code).toBe('interrupted');
    expect(state.isStreaming).toBe(false);
  });

  it('leaves a completed turn alone when the stream ends', () => {
    const done = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    const state = conversationReducer(done, { type: 'stream_ended', id: ASSISTANT_ID });
    expect(state.messages[1].error).toBeNull();
  });

  it('records a request failure', () => {
    const state = conversationReducer(afterSend(), {
      type: 'failed',
      id: ASSISTANT_ID,
      message: 'Request failed (500)',
    });
    expect(state.messages[1].error?.code).toBe('request_failed');
    expect(state.isStreaming).toBe(false);
  });
});

describe('conversationReducer — housekeeping', () => {
  it('clears a pending handoff', () => {
    const withHandoff = feed(afterSend(), [
      {
        type: 'route',
        targetEntity: 'events',
        action: 'navigate',
        confidence: 0.9,
        handoffMessage: 'x',
        interpretedFilters: {},
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'done' },
    ]);
    expect(conversationReducer(withHandoff, { type: 'clear_handoff' }).pendingHandoff).toBeNull();
  });

  it('restores a serialized state', () => {
    const source = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    const restored = conversationReducer(emptyConversation(), {
      type: 'restore',
      state: source,
    });
    expect(restored.messages).toHaveLength(2);
    expect(restored.previousEntity).toBe('people');
  });

  it('resets to empty', () => {
    const source = feed(afterSend(), [inlineRoute, { type: 'done' }]);
    expect(conversationReducer(source, { type: 'reset' })).toEqual(emptyConversation());
  });
});
