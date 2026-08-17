import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistantStream } from '@/lib/assistant/stream';
import { adapterFor, resetAdapters, setAdapterForTests } from '@/lib/assistant/registry';
import type { AssistantEvent } from '@/lib/assistant/types';

async function read(stream: ReadableStream<Uint8Array>): Promise<AssistantEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AssistantEvent);
}

function routeEvent(events: AssistantEvent[]) {
  const first = events[0];
  if (first.type !== 'route') throw new Error('expected a route event first');
  return first;
}

function prose(events: AssistantEvent[]): string {
  return events
    .filter((e): e is Extract<AssistantEvent, { type: 'token' }> => e.type === 'token')
    .map((e) => e.text)
    .join('');
}

afterEach(() => {
  resetAdapters();
  vi.restoreAllMocks();
});

describe('createAssistantStream — ordering', () => {
  it('emits route first, then filters, results, tokens, done', async () => {
    const events = await read(
      createAssistantStream({
        message: 'verified marketing managers in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
      })
    );
    const types = events.map((e) => e.type);

    expect(types[0]).toBe('route');
    expect(types).toContain('filters');
    expect(types).toContain('results');
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');
    expect(types.indexOf('results')).toBeLessThan(types.indexOf('token'));
  });
});

describe('createAssistantStream — navigate', () => {
  it('never emits results for a cross-entity question', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what conferences are in Berlin next month',
        currentPage: 'companies',
        classifyWithModel: async () => ({ entity: 'events', filters: { city: 'Berlin' } }),
      })
    );

    expect(routeEvent(events).action).toBe('navigate');
    expect(routeEvent(events).targetEntity).toBe('events');
    expect(events.map((e) => e.type)).not.toContain('results');
  });

  it('emits a handoff message as prose', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what conferences are in Berlin',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'events', filters: {} }),
      })
    );
    expect(prose(events).toLowerCase()).toContain('events');
  });

  it('carries the source page filters onto the target entity', async () => {
    const events = await read(
      createAssistantStream({
        message: 'what events are happening there',
        currentPage: 'companies',
        activeFilters: { country: 'Germany' },
        classifyWithModel: async () => ({ entity: 'events', filters: {} }),
      })
    );
    // Carried onto the events shape: array-valued, nested under `filters`.
    const carried = routeEvent(events).interpretedFilters as {
      filters: { countries: string[] };
    };
    expect(carried.filters.countries).toEqual(['Germany']);
  });
});

describe('createAssistantStream — confirm', () => {
  it('never calls search when the classifiers disagree', async () => {
    const real = adapterFor('companies');
    const search = vi.fn(real.search);
    setAdapterForTests('companies', { ...real, search } as never);

    const events = await read(
      createAssistantStream({
        message: 'trade shows in London',
        currentPage: 'people',
        // Deterministic says events; the model says companies.
        classifyWithModel: async () => ({ entity: 'companies', filters: {} }),
      })
    );

    expect(routeEvent(events).action).toBe('confirm');
    expect(search).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toContain('suggestions');
    expect(events.map((e) => e.type)).not.toContain('results');
  });
});

describe('createAssistantStream — degradation', () => {
  it('marks no_tool_call and still answers when the model classifies nothing', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => null,
      })
    );
    expect(routeEvent(events).degraded).toBe('no_tool_call');
    expect(events.map((e) => e.type)).toContain('token');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('survives a classifier that throws', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => {
          throw new Error('network down');
        },
      })
    );
    expect(routeEvent(events).degraded).toBe('model_error');
    expect(events[events.length - 1].type).toBe('done');
  });

  it('completes the answer from the template when the generator dies mid-prose', async () => {
    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
        generateAnswer: async function* () {
          yield 'Partial';
          throw new Error('model died');
        },
      })
    );
    expect(prose(events)).toContain('Partial');
    expect(prose(events).length).toBeGreaterThan('Partial'.length);
    expect(events[events.length - 1].type).toBe('done');
  });

  it('emits an error event when the adapter search throws', async () => {
    const real = adapterFor('people');
    setAdapterForTests('people', {
      ...real,
      search: async () => {
        throw new Error('boom');
      },
    } as never);

    const events = await read(
      createAssistantStream({
        message: 'people in Germany',
        currentPage: 'people',
        classifyWithModel: async () => ({ entity: 'people', filters: {} }),
      })
    );
    const error = events.find((e) => e.type === 'error');
    expect(error).toBeDefined();
    if (error?.type !== 'error') throw new Error('expected error event');
    expect(error.code).toBe('search_failed');
    expect(error.message).toContain('people');
  });
});

describe('createAssistantStream — inline', () => {
  it('reports a null total for companies without saying zero', async () => {
    const real = adapterFor('companies');
    setAdapterForTests('companies', {
      ...real,
      search: async () => ({ rows: [{ id: 'c1', name: 'Acme' }], total: null }),
    } as never);

    const events = await read(
      createAssistantStream({
        message: 'SaaS companies in Germany',
        currentPage: 'companies',
        classifyWithModel: async () => ({ entity: 'companies', filters: { category: 'SaaS' } }),
      })
    );
    const results = events.find((e) => e.type === 'results');
    if (results?.type !== 'results') throw new Error('expected results event');
    expect(results.total).toBeNull();
    expect(prose(events)).not.toMatch(/\b0\b/);
  });
});
