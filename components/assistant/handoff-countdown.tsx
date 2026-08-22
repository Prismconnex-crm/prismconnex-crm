"use client";

import { ArrowRight } from 'lucide-react';
import type { AssistantEntity } from '@/lib/assistant/types';

const LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

/**
 * The card shown while a handoff is counting down.
 *
 * Presentational only. The timer itself lives in the provider, so cancellation
 * and supersession are ref-and-reducer operations that a node test can drive
 * rather than component lifecycle that nothing here can test.
 */
export function HandoffCountdown({
  to,
  message,
  onCancel,
}: {
  to: AssistantEntity;
  message: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1E40AF] dark:border-[#1E3A5F] dark:bg-[#0F1D33] dark:text-[#93C5FD]">
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-[#1E40AF] px-2 py-0.5 text-[10px] font-medium text-white dark:bg-[#93C5FD] dark:text-[#0F1D33]">
          {LABEL[to]}
        </span>
        <span>{message}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1 opacity-70">
          Opening {LABEL[to]}
          <ArrowRight className="h-3 w-3" />
        </span>
        <button type="button" onClick={onCancel} className="underline">
          Cancel
        </button>
      </span>
    </div>
  );
}
