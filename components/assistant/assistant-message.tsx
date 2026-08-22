"use client";

import { bindingFor, hasBinding } from './registry';
import type { ConversationMessage } from './types';
import type { AssistantEntity } from '@/lib/assistant/types';

const ENTITY_LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

/**
 * One turn.
 *
 * Rows are delegated to the binding for the turn's entity. That is always the
 * current page's entity, because a navigate turn carries no rows at all — the
 * Spec 1 stream guarantee is what makes this safe.
 */
export function AssistantMessage({
  message,
  rowContext,
  onSuggestion,
  onRetry,
  onConfirm,
  onApplyFilters,
}: {
  message: ConversationMessage;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
  /** Answer the router's `confirm` question by naming an entity. */
  onConfirm?: (entity: AssistantEntity) => void;
  /** Push this turn's interpreted filters onto the live page. */
  onApplyFilters?: (filters: unknown) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl bg-[#1B6DFF] px-4 py-2 text-[13px] text-white">
          {message.text}
        </p>
      </div>
    );
  }

  const entity = message.entity;
  const showRows = message.rows.length > 0 && entity !== null && hasBinding(entity);

  /**
   * A handoff turn's sentence arrives TWICE: once as `handoffMessage` on the
   * route event, and again as the token stream, because lib/assistant/stream.ts
   * chunks the same `handoffLine()` into tokens so the typing animation matches
   * the model path. The badge and the confirm card already render it, so the
   * prose paragraph below would print it a second time.
   */
  const proseDuplicatesHandoff =
    message.handoffMessage !== null &&
    (message.action === 'navigate' || message.action === 'confirm');

  return (
    <div className="space-y-3">
      {message.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.chips.map((chip) => (
            <span
              key={chip.key}
              className="rounded-full border border-[#E2E8F0] px-2.5 py-1 text-[12px] text-[#475569] dark:border-[#22304A] dark:text-[#94A3B8]"
            >
              {chip.label}: {chip.value}
            </span>
          ))}
          {onApplyFilters && message.filters != null && (
            <button
              type="button"
              onClick={() => onApplyFilters(message.filters)}
              className="rounded-full border border-dashed border-[#94A3B8] px-2.5 py-1 text-[12px] text-[#475569] dark:border-[#475569] dark:text-[#94A3B8]"
            >
              Apply filters
            </button>
          )}
        </div>
      )}

      {/* `confirm` creates no pendingHandoff, so nothing here can navigate —
          it only re-asks with the entity the user named. */}
      {message.action === 'confirm' && message.handoffMessage && onConfirm && entity && (
        <div className="space-y-2 rounded-lg border border-[#E2E8F0] px-3 py-2 dark:border-[#22304A]">
          <p className="text-[13px] text-[#0F172A] dark:text-[#E2E8F0]">
            {message.handoffMessage}
          </p>
          <button
            type="button"
            onClick={() => onConfirm(entity)}
            className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[12px] dark:border-[#22304A]"
          >
            {ENTITY_LABEL[entity]}
          </button>
        </div>
      )}

      {/* A navigate turn carries no rows by design. Until the target has a
          binding (companies, before Spec 3b) this badge and sentence are the
          whole answer — an explanation of where it lives, with no button that
          would promise to fetch it. */}
      {message.action === 'navigate' && message.handoffMessage && entity && (
        <div className="flex items-center gap-2 text-[12px] text-[#1E40AF] dark:text-[#93C5FD]">
          <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium dark:bg-[#0F1D33]">
            {ENTITY_LABEL[entity]}
          </span>
          <span>{message.handoffMessage}</span>
        </div>
      )}

      {message.droppedFilters.length > 0 && (
        <p className="text-[12px] text-[#94A3B8]">
          Dropped {message.droppedFilters.join(', ')} — no equivalent on this page.
        </p>
      )}

      {showRows && entity && (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] dark:border-[#22304A]">
          {bindingFor(entity).renderRows(message.rows, rowContext as never)}
          {/* total is null when counting is too slow — render an absent count,
              never "0 results". */}
          {typeof message.total === 'number' && (
            <p className="border-t border-[#E2E8F0] px-3 py-2 text-[12px] text-[#64748B] dark:border-[#22304A]">
              {message.total} match{message.total === 1 ? '' : 'es'}
            </p>
          )}
        </div>
      )}

      {message.text && !proseDuplicatesHandoff && (
        <p className="text-[13px] leading-relaxed text-[#0F172A] dark:text-[#E2E8F0]">
          {message.text}
        </p>
      )}

      {/* Server-gated to admins: a non-admin's payload never carries the text,
          so this renders nothing rather than being hidden. Amber, not red —
          the answer above it is correct, merely not model-ranked. */}
      {message.notice && (
        <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {message.notice}
        </p>
      )}

      {message.error && (
        <div className="flex items-center gap-2 text-[12px] text-[#DC2626]">
          <span>{message.error.message}</span>
          <button type="button" onClick={onRetry} className="underline">
            Retry
          </button>
        </div>
      )}

      {message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSuggestion(item)}
              className="rounded-full border border-[#E2E8F0] px-3 py-1 text-[12px] text-[#475569] hover:bg-[#F8FAFC] dark:border-[#22304A] dark:text-[#94A3B8] dark:hover:bg-[#111B2E]"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
