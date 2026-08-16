"use client";

import { cn } from "@/lib/utils";

/**
 * Sits directly above the results table. The selection state is real; the three
 * actions are wired to their handlers but their side effects are a follow-up
 * (spec: "the toolbar ships wired to selection state, but Verify/Sequence/Merge
 * are follow-ups"). They are disabled with nothing selected so they never look
 * broken.
 */
export function PeopleBulkToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onVerifyEmails,
  onAddToSequence,
  onMerge,
}: {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onVerifyEmails: () => void;
  onAddToSequence: () => void;
  onMerge: () => void;
}) {
  const actionClass = (enabled: boolean) =>
    cn(
      "h-7 rounded-[6px] border px-2.5 text-[12px] font-medium shadow-sm transition-colors",
      enabled
        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#16233A] dark:text-[#E5E7EB] dark:hover:bg-[#22304A]"
        : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-600"
    );

  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 border-r border-slate-200 pr-3 dark:border-[#22304A]">
          <input
            type="checkbox"
            checked={allSelected && totalCount > 0}
            onChange={onToggleSelectAll}
            className="size-3.5 cursor-pointer accent-indigo-600"
          />
          <span className="text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB]">
            Select all
          </span>
        </label>
        <button type="button" disabled={!hasSelection} onClick={onVerifyEmails} className={actionClass(hasSelection)}>
          Verify emails
        </button>
        <button type="button" disabled={!hasSelection} onClick={onAddToSequence} className={actionClass(hasSelection)}>
          Add to Sequence
        </button>
        <button type="button" disabled={selectedCount < 2} onClick={onMerge} className={actionClass(selectedCount >= 2)}>
          Merge
        </button>
      </div>
      <div className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 dark:border-[#22304A] dark:bg-[#16233A]">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-white">
          {selectedCount} selected
        </span>
      </div>
    </div>
  );
}
