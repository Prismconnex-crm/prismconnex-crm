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

afterEach(() => {
  resetAdapters();
  vi.restoreAllMocks();
});

describe('createAssistantStream — forceEntity', () => {
  it('never calls the model classifier', async () => {
    const classify = vi.fn(async () => ({ entity: 'companies' as const, filters: {} }));

    await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich' },
        classifyWithModel: classify,
      })
    );

    expect(classify).not.toHaveBeenCalled();
  });

  it('answers inline for the forced entity at full confidence', async () => {
    const events = await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich' },
      })
    );

    const route = routeEvent(events);
    expect(route.targetEntity).toBe('events');
    expect(route.action).toBe('answer_inline');
    expect(route.confidence).toBe(1);
    expect(events.map((e) => e.type)).toContain('results');
  });

  it('uses the preset filters verbatim rather than re-parsing the message', async () => {
    const events = await read(
      createAssistantStream({
        message: 'anything at all',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: { city: 'Munich', country: 'Germany' },
      })
    );

    expect(routeEvent(events).interpretedFilters).toMatchObject({
      city: 'Munich',
      country: 'Germany',
    });
  });

  it('cannot produce a second navigation — the bounce is structurally impossible', async () => {
    // The model would route away; forceEntity must win.
    const events = await read(
      createAssistantStream({
        message: 'trade shows in Munich',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
        classifyWithModel: async () => ({ entity: 'companies', filters: {} }),
      })
    );

    expect(routeEvent(events).action).toBe('answer_inline');
    expect(routeEvent(events).targetEntity).toBe('events');
  });

  it('reports no degraded reason — no model was consulted', async () => {
    const events = await read(
      createAssistantStream({
        message: 'anything',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
      })
    );
    expect(routeEvent(events).degraded).toBeUndefined();
  });

  it('surfaces a search failure for the forced entity', async () => {
    const real = adapterFor('events');
    setAdapterForTests('events', {
      ...real,
      search: async () => {
        throw new Error('boom');
      },
    } as never);

    const events = await read(
      createAssistantStream({
        message: 'anything',
        currentPage: 'events',
        forceEntity: 'events',
        presetFilters: {},
      })
    );
    const error = events.find((e) => e.type === 'error');
    if (error?.type !== 'error') throw new Error('expected error event');
    expect(error.code).toBe('search_failed');
  });
});
