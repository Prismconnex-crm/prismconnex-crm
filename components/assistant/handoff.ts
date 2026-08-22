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

/**
 * The three params the handoff owns.
 *
 * Deliberately NOT `q`, `from` or `filters`: `lib/events/filters.ts` already
 * claims `q` for the sidebar's free-text box and `from` for dateFrom as an ISO
 * date. Reusing either would put the whole question into a text filter, or a
 * page name into a date — and neither throws, which is what makes it dangerous.
 * Any future page-owned param must avoid these three names.
 */
export const HANDOFF_PARAMS = ['ask', 'via', 'cid'] as const;

export type HandoffUrlInput = {
  /** The target binding's route, e.g. "/app/events". */
  route: string;
  /** The target binding's own serializeFilters output — leading `?`, or ''. */
  serializedFilters: string;
  /** The question, replayed on arrival. */
  message: string;
  /** Where it was asked from, so the target can offer a way back. */
  from: AssistantEntity;
  conversationId: string;
};

export type BackUrlInput = {
  route: string;
  serializedFilters: string;
  conversationId: string;
};

/** The target route carrying the target's own filters plus ask/via/cid. */
export function handoffUrl(input: HandoffUrlInput): string {
  // URLSearchParams handles the escaping, so a question containing & or = does
  // not truncate the query string.
  const params = new URLSearchParams(input.serializedFilters);
  params.set('ask', input.message);
  params.set('via', input.from);
  params.set('cid', input.conversationId);
  return `${input.route}?${params.toString()}`;
}

/** The source route with its restored filters. No ask/via — this is not a question. */
export function backUrl(input: BackUrlInput): string {
  const params = new URLSearchParams(input.serializedFilters);
  params.set('cid', input.conversationId);
  return `${input.route}?${params.toString()}`;
}

/**
 * The re-ask used when the user cancels, or the jump fails.
 *
 * Spec 1 guarantees a navigate turn carries no rows, so there is no inline
 * answer to fall back on — the question has to be asked again. It is asked with
 * `forceEntity` set to the TARGET, so the target's adapter answers and the
 * target's binding renders the rows, while `currentPage` stays the source page
 * because we never left it. Nothing crosses entities.
 */
export function cancelToPhaseTwo(handoff: PendingHandoff): PhaseTwoRequest {
  return {
    message: handoff.message,
    currentPage: handoff.from,
    forceEntity: handoff.to,
    presetFilters: handoff.presetFilters,
  };
}

export type SupersedeDecision =
  | { kind: 'none' }
  | { kind: 'cancel'; handoff: PendingHandoff };

/**
 * What a new question does to a navigation that has not finished.
 *
 * Rapid consecutive cross-entity questions must cancel the pending jump rather
 * than race it — otherwise the second answer arrives and the first navigation
 * then fires underneath it.
 */
export function supersede(state: ConversationState): SupersedeDecision {
  const handoff = state.pendingHandoff;
  if (!handoff || handoff.status === 'cancelled') return { kind: 'none' };
  return { kind: 'cancel', handoff };
}
