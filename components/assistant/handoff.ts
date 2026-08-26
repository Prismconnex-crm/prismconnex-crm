import type { AssistantEntity } from '@/lib/assistant/types';
import type { ConversationState, PendingHandoff } from './types';

export type PhaseTwoRequest = {
  message: string;
  currentPage: AssistantEntity;
  forceEntity: AssistantEntity;
  presetFilters: unknown;
};

/**
 * The follow-up request issued on arrival at the target page.
 *
 * `forceEntity` is what prevents an infinite bounce: without it the server
 * would classify the question again from the target page's perspective and
 * could route straight back. See the bounce test.
 */
export function phaseTwoRequest(handoff: PendingHandoff): PhaseTwoRequest {
  return {
    message: handoff.message,
    currentPage: handoff.to,
    forceEntity: handoff.to,
    presetFilters: handoff.presetFilters,
  };
}

/** Where "go back" returns to, with the filters that page had before the jump. */
export function goBackTarget(handoff: PendingHandoff): {
  entity: AssistantEntity;
  filters: unknown;
} {
  return { entity: handoff.from, filters: handoff.sourceFilters };
}

/** True when the latest turn asked the client to navigate. */
export function producedNavigation(state: ConversationState): boolean {
  return state.pendingHandoff !== null;
}
