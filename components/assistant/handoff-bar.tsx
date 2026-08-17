"use client";

import { ArrowLeft, X } from 'lucide-react';
import type { AssistantEntity } from '@/lib/assistant/types';

const LABEL: Record<AssistantEntity, string> = {
  companies: 'Companies',
  events: 'Events',
  people: 'People',
};

/**
 * Shown on the target page after an automatic navigation.
 *
 * A page changing under the user is disorienting even when the routing is
 * right, and at 0.75 confidence it will sometimes be wrong — so the jump is
 * always reversible in one click.
 */
export function HandoffBar({
  from,
  onBack,
  onDismiss,
}: {
  from: AssistantEntity;
  onBack: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1E40AF] dark:border-[#1E3A5F] dark:bg-[#0F1D33] dark:text-[#93C5FD]">
      <span>Moved from {LABEL[from]} to answer your question.</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 underline">
          <ArrowLeft className="h-3 w-3" />
          Go back
        </button>
        <button type="button" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
