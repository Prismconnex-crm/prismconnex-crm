import { describe, expect, it } from 'vitest';
import {
  backUrl,
  cancelToPhaseTwo,
  goBackTarget,
  handoffUrl,
  HANDOFF_PARAMS,
  phaseTwoRequest,
  producedNavigation,
  supersede,
} from '@/components/assistant/handoff';
import { conversationReducer } from '@/components/assistant/conversation-reducer';
import { emptyConversation } from '@/components/assistant/types';
import type { PendingHandoff } from '@/components/assistant/types';
import type { AssistantEvent } from '@/lib/assistant/types';

const handoff: PendingHandoff = {
  from: 'companies',
  to: 'events',
  sourceFilters: { country: 'Germany', category: 'SaaS' },
  presetFilters: { city: 'Berlin' },
  status: 'counting_down',
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
    sourceFilters: null,
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

const peopleHandoff: PendingHandoff = {
  from: 'people',
  to: 'events',
  sourceFilters: { titles: ['CEO'] },
  presetFilters: { filters: { countries: ['Germany'] }, search: '' },
  message: 'trade shows in Germany',
  status: 'counting_down',
};

describe('handoffUrl', () => {
  it('namespaces its own params so they cannot collide with the page', () => {
    // Events owns `q` (free text) and `from` (an ISO date). Using either here
    // would not throw — the page would just be quietly wrong.
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '?country=Germany&category=Packaging',
      message: 'trade shows in Germany',
      from: 'people',
      conversationId: 'cid-1',
    });

    expect(url).toContain('ask=trade+shows+in+Germany');
    expect(url).toContain('via=people');
    expect(url).toContain('cid=cid-1');
    expect(url).not.toMatch(/[?&]q=/);
    expect(url).not.toMatch(/[?&]from=/);
  });

  it("preserves the target binding's own params", () => {
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '?country=Germany&category=Packaging',
      message: 'x',
      from: 'people',
      conversationId: 'cid-1',
    });
    expect(url).toContain('country=Germany');
    expect(url).toContain('category=Packaging');
  });

  it('works when the target serialises nothing', () => {
    const url = handoffUrl({
      route: '/app/people',
      serializedFilters: '',
      message: 'who are the CEOs',
      from: 'events',
      conversationId: 'cid-1',
    });
    expect(url.startsWith('/app/people?')).toBe(true);
    expect(url).toContain('via=events');
  });

  it('escapes a question containing & and =', () => {
    const url = handoffUrl({
      route: '/app/events',
      serializedFilters: '',
      message: 'shows in R&D = fun?',
      from: 'people',
      conversationId: 'cid-1',
    });
    // Re-parsing must yield the original, not a truncated question.
    const parsed = new URLSearchParams(url.slice(url.indexOf('?')));
    expect(parsed.get('ask')).toBe('shows in R&D = fun?');
  });

  it('names exactly the three reserved params', () => {
    expect(HANDOFF_PARAMS).toEqual(['ask', 'via', 'cid']);
  });
});

describe('backUrl', () => {
  it('restores the source page with the filters it had', () => {
    const url = backUrl({
      route: '/app/people',
      serializedFilters: '?pf=abc123',
      conversationId: 'cid-1',
    });
    expect(url).toContain('pf=abc123');
    expect(url).toContain('cid=cid-1');
  });

  it('carries no ask or via — going back is not asking again', () => {
    const url = backUrl({
      route: '/app/people',
      serializedFilters: '?pf=abc123',
      conversationId: 'cid-1',
    });
    expect(url).not.toContain('ask=');
    expect(url).not.toContain('via=');
  });

  it('works when the source had no filters', () => {
    expect(backUrl({ route: '/app/people', serializedFilters: '', conversationId: 'c' })).toBe(
      '/app/people?cid=c'
    );
  });
});

describe('cancelToPhaseTwo', () => {
  it('asks the TARGET entity while staying on the source page', () => {
    // The rows are still the target's, produced by the target's adapter.
    // Nothing crosses — Spec 1's guarantee is not being weakened.
    expect(cancelToPhaseTwo(peopleHandoff)).toEqual({
      message: 'trade shows in Germany',
      currentPage: 'people',
      forceEntity: 'events',
      presetFilters: { filters: { countries: ['Germany'] }, search: '' },
    });
  });

  it('differs from phaseTwoRequest only in currentPage', () => {
    // phaseTwoRequest runs after arriving; this one runs without moving.
    const arrived = phaseTwoRequest(peopleHandoff);
    const stayed = cancelToPhaseTwo(peopleHandoff);
    expect(stayed.forceEntity).toBe(arrived.forceEntity);
    expect(stayed.presetFilters).toBe(arrived.presetFilters);
    expect(arrived.currentPage).toBe('events');
    expect(stayed.currentPage).toBe('people');
  });
});

describe('supersede', () => {
  it('reports a countdown that a new send must cancel', () => {
    const state = { ...emptyConversation(), pendingHandoff: peopleHandoff };
    expect(supersede(state)).toEqual({ kind: 'cancel', handoff: peopleHandoff });
  });

  it('reports nothing when no handoff is pending', () => {
    expect(supersede(emptyConversation())).toEqual({ kind: 'none' });
  });

  it('leaves an already-cancelled handoff alone', () => {
    const state = {
      ...emptyConversation(),
      pendingHandoff: { ...peopleHandoff, status: 'cancelled' as const },
    };
    expect(supersede(state)).toEqual({ kind: 'none' });
  });

  it('still cancels one that is mid-navigation', () => {
    // The push has fired but phase two has not; a new question wins.
    const navigating = { ...peopleHandoff, status: 'navigating' as const };
    const state = { ...emptyConversation(), pendingHandoff: navigating };
    expect(supersede(state)).toEqual({ kind: 'cancel', handoff: navigating });
  });
});
