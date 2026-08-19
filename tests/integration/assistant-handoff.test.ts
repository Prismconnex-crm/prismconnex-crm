import { describe, expect, it } from 'vitest';
import { goBackTarget, phaseTwoRequest, producedNavigation } from '@/components/assistant/handoff';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';
import type { PendingHandoff } from '@/components/assistant/types';
import type { AssistantEvent } from '@/lib/assistant/types';

const handoff: PendingHandoff = {
  from: 'companies',
  to: 'events',
  sourceFilters: { country: 'Germany', category: 'SaaS' },
  presetFilters: { city: 'Berlin' },
  message: 'what conferences are in Berlin',
};

describe('phaseTwoRequest', () => {
  it('targets the destination page', () => {
    expect(phaseTwoRequest(handoff).currentPage).toBe('events');
  });

  it('carries forceEntity so phase two cannot re-classify', () => {
    expect(phaseTwoRequest(handoff).forceEntity).toBe('events');
  });

  it('replays the extracted filters verbatim', () => {
    expect(phaseTwoRequest(handoff).presetFilters).toEqual({ city: 'Berlin' });
  });

  it('re-sends the original question', () => {
    expect(phaseTwoRequest(handoff).message).toBe('what conferences are in Berlin');
  });
});

describe('goBackTarget', () => {
  it('returns the source page and the filters it had before the jump', () => {
    expect(goBackTarget(handoff)).toEqual({
      entity: 'companies',
      filters: { country: 'Germany', category: 'SaaS' },
    });
  });
});

describe('the bounce is structurally impossible', () => {
  function reply(events: AssistantEvent[]) {
    const sent = conversationReducer(emptyConversation(), {
      type: 'send',
      message: 'what conferences are in Berlin',
      id: 'a1',
      currentPage: 'people',
    });
    return events.reduce(
      (acc, event) => conversationReducer(acc, { type: 'event', id: 'a1', event }),
      sent
    );
  }

  it('phase one navigate sets a handoff', () => {
    const state = reply([
      {
        type: 'route',
        targetEntity: 'events',
        action: 'navigate',
        confidence: 0.75,
        handoffMessage: 'opening Events',
        interpretedFilters: { city: 'Berlin' },
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'done' },
    ]);
    expect(producedNavigation(state)).toBe(true);
  });

  it('a forceEntity reply can never produce a second navigation', () => {
    // The server guarantees action: "answer_inline" whenever forceEntity is
    // set (see tests/integration/assistant-force-entity.test.ts). Given that
    // reply shape, the reducer cannot open another handoff.
    const state = reply([
      {
        type: 'route',
        targetEntity: 'events',
        action: 'answer_inline',
        confidence: 1,
        handoffMessage: '',
        interpretedFilters: { city: 'Berlin' },
        droppedFilters: [],
        crossReference: null,
      },
      { type: 'results', rows: [{ slug: 'x' }], total: 1 },
      { type: 'done' },
    ]);

    expect(producedNavigation(state)).toBe(false);
    expect(state.pendingHandoff).toBeNull();
  });

  it('phase two always carries forceEntity, so it always gets that reply shape', () => {
    const request = phaseTwoRequest(handoff);
    expect(request.forceEntity).toBeDefined();
    expect(request.forceEntity).toBe(request.currentPage);
  });
});
