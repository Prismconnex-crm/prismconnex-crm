import { describe, expect, it } from 'vitest';
import { resolveRoute } from '@/lib/assistant/confidence';
import type { ClassifyResult } from '@/lib/assistant/classify';
import type { AssistantEntity } from '@/lib/assistant/types';

function deterministic(winner: AssistantEntity | null, margin: number): ClassifyResult {
  return { scores: { companies: 0, events: 0, people: 0 }, winner, margin };
}

describe('resolveRoute — confidence table', () => {
  it('agrees with a clear margin -> 0.95, routes', () => {
    const out = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.8),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.95);
    expect(out.targetEntity).toBe('events');
    expect(out.action).toBe('navigate');
  });

  it('agrees with a narrow margin -> 0.75, still routes', () => {
    const out = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.1),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.75);
    expect(out.action).toBe('navigate');
  });

  it('disagrees -> 0.45, confirms, and prefers the model entity', () => {
    const out = resolveRoute({
      modelEntity: 'companies',
      deterministic: deterministic('events', 0.9),
      currentPage: 'people',
      hasApiKey: true,
    });
    expect(out.confidence).toBe(0.45);
    expect(out.action).toBe('confirm');
    expect(out.targetEntity).toBe('companies');
  });

  it('no key with a clear margin -> 0.70, routes', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic('people', 0.8),
      currentPage: 'events',
      hasApiKey: false,
    });
    expect(out.confidence).toBe(0.7);
    expect(out.action).toBe('navigate');
  });

  it('no key with a narrow margin -> 0.40, confirms', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic('people', 0.1),
      currentPage: 'events',
      hasApiKey: false,
    });
    expect(out.confidence).toBe(0.4);
    expect(out.action).toBe('confirm');
  });

  it('answers inline when the target matches the current page', () => {
    const out = resolveRoute({
      modelEntity: 'people',
      deterministic: deterministic('people', 0.9),
      currentPage: 'people',
      hasApiKey: true,
    });
    expect(out.action).toBe('answer_inline');
  });

  it('no signal at all -> current page, confidence 1, inline', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic(null, 0),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(out.targetEntity).toBe('companies');
    expect(out.confidence).toBe(1);
    expect(out.action).toBe('answer_inline');
  });

  it('no signal inherits the previous entity over the current page', () => {
    const out = resolveRoute({
      modelEntity: null,
      deterministic: deterministic(null, 0),
      currentPage: 'companies',
      previousEntity: 'events',
      hasApiKey: true,
    });
    expect(out.targetEntity).toBe('events');
    expect(out.action).toBe('navigate');
  });

  it('never confirms above the 0.6 threshold', () => {
    const routed = resolveRoute({
      modelEntity: 'events',
      deterministic: deterministic('events', 0.1),
      currentPage: 'companies',
      hasApiKey: true,
    });
    expect(routed.confidence).toBeGreaterThanOrEqual(0.6);
    expect(routed.action).not.toBe('confirm');
  });
});
