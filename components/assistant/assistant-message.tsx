"use client";

import { bindingFor, hasBinding } from './registry';
import type { ConversationMessage } from './types';

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
}: {
  message: ConversationMessage;
  /** The page's own row handlers, forwarded opaquely to its binding. */
  rowContext?: unknown;
  onSuggestion: (text: string) => void;
  onRetry: () => void;
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

      {message.text && (
        <p className="text-[13px] leading-relaxed text-[#0F172A] dark:text-[#E2E8F0]">
          {message.text}
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
