import { describe, expect, it } from 'vitest';
import {
  restoreConversation,
  serializeConversation,
  SESSION_KEY,
} from '@/components/assistant/session-mirror';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';

function sampleState() {
  const sent = conversationReducer(emptyConversation(), {
    type: 'send',
    message: 'people in Germany',
    id: 'a1',
    currentPage: 'people',
    sourceFilters: null,
  });
  return conversationReducer(sent, {
    type: 'event',
    id: 'a1',
    event: {
      type: 'route',
      targetEntity: 'people',
      action: 'answer_inline',
      confidence: 0.95,
      handoffMessage: '',
      interpretedFilters: { countries: ['Germany'] },
      droppedFilters: [],
      crossReference: null,
    },
  });
}

describe('session mirror', () => {
  it('exposes a namespaced storage key', () => {
    expect(SESSION_KEY).toMatch(/^pcx/);
  });

  it('round-trips a conversation', () => {
    const state = sampleState();
    const restored = restoreConversation(serializeConversation(state));
    expect(restored.messages).toHaveLength(2);
    expect(restored.messages[1].entity).toBe('people');
    expect(restored.previousEntity).toBe('people');
  });

  it('never restores a mid-flight streaming state', () => {
    const state = sampleState();
    expect(state.isStreaming).toBe(true);
    expect(restoreConversation(serializeConversation(state)).isStreaming).toBe(false);
  });

  it('drops a pending handoff — the navigation already happened or did not', () => {
    const state = { ...sampleState(), pendingHandoff: { from: 'people', to: 'events' } as never };
    expect(restoreConversation(serializeConversation(state)).pendingHandoff).toBeNull();
  });

  it('returns an empty conversation for null', () => {
    expect(restoreConversation(null)).toEqual(emptyConversation());
  });

  it('returns an empty conversation for corrupt JSON rather than throwing', () => {
    expect(() => restoreConversation('{not json')).not.toThrow();
    expect(restoreConversation('{not json')).toEqual(emptyConversation());
  });

  it('returns an empty conversation when messages is not an array', () => {
    expect(restoreConversation(JSON.stringify({ messages: 'nope' }))).toEqual(emptyConversation());
  });
});
