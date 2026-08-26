import { adapterFor } from './registry';
import type { AssistantEntity } from './types';

/**
 * Translates one page's active filters onto another entity's schema.
 *
 * Each adapter decides what it can accept; anything without a counterpart is
 * dropped rather than guessed, and reported back so the UI can say what it lost
 * instead of losing it silently.
 */
export function translateFilters(input: {
  from: AssistantEntity;
  to: AssistantEntity;
  filters: Record<string, unknown>;
}): { filters: Record<string, unknown>; dropped: string[] } {
  if (input.from === input.to) {
    return { filters: input.filters, dropped: [] };
  }

  const { filters, dropped } = adapterFor(input.to).carryOver(input.filters);
  return { filters: filters as Record<string, unknown>, dropped };
}
