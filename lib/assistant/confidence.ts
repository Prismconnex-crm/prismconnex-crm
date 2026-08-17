import type { ClassifyResult } from './classify';
import type { AssistantEntity, RouteAction } from './types';

/** Above this margin the deterministic classifier is treated as decisive. */
export const CLEAR_MARGIN = 0.34;
/** Below this confidence we ask instead of navigating. Spec rule 5. */
export const CONFIRM_THRESHOLD = 0.6;

export type ResolveInput = {
  /** What the model chose, or null if it could not be consulted. */
  modelEntity: AssistantEntity | null;
  deterministic: ClassifyResult;
  currentPage: AssistantEntity;
  /** Entity of the previous turn, for follow-ups like "show me more". */
  previousEntity?: AssistantEntity | null;
  hasApiKey: boolean;
};

export type ResolveOutput = {
  targetEntity: AssistantEntity;
  action: RouteAction;
  confidence: number;
};

/**
 * Turns two independent classifier opinions into a target and an action.
 *
 * The model is never asked how confident it is — LLM self-reported confidence
 * sits near 0.9 for almost every input, which would mean the confirm-gate never
 * fires. Agreement between two independent methods is the honest signal.
 */
export function resolveRoute(input: ResolveInput): ResolveOutput {
  const { modelEntity, deterministic, currentPage, previousEntity, hasApiKey } = input;

  const decide = (targetEntity: AssistantEntity, confidence: number): ResolveOutput => {
    if (confidence < CONFIRM_THRESHOLD) {
      return { targetEntity, action: 'confirm', confidence };
    }
    return {
      targetEntity,
      action: targetEntity === currentPage ? 'answer_inline' : 'navigate',
      confidence,
    };
  };

  // No entity signal anywhere: a greeting, a how-to, or a follow-up like
  // "show me more". Rule 7 — the previous turn's entity wins over the page.
  if (!modelEntity && !deterministic.winner) {
    return decide(previousEntity ?? currentPage, 1);
  }

  const clear = deterministic.margin >= CLEAR_MARGIN;

  if (!hasApiKey || !modelEntity) {
    const target = deterministic.winner ?? previousEntity ?? currentPage;
    return decide(target, clear ? 0.7 : 0.4);
  }

  // The model saw a signal the word list missed — trust it, but not fully.
  if (!deterministic.winner) return decide(modelEntity, 0.75);

  if (modelEntity === deterministic.winner) {
    return decide(modelEntity, clear ? 0.95 : 0.75);
  }

  // Genuine disagreement. Prefer the model's reading, but ask.
  return decide(modelEntity, 0.45);
}
