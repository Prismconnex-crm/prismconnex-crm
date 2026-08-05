"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type QueryChip = {
  /** Stable identity for the chip, unique within a row. */
  id: string;
  /** Dimension name, e.g. "Region". */
  label: string;
  /** Applied value, e.g. "Europe". */
  value: string;
};

/**
 * The "how your query was read" chips. Same visual as the Companies finder
 * cards, plus one-click removal so a misread filter can be dropped without
 * hunting for it in the rail.
 */
export function FilterChips({
  chips,
  onRemove,
  className,
  emptyLabel,
}: {
  chips: QueryChip[];
  onRemove?: (chip: QueryChip) => void;
  className?: string;
  emptyLabel?: string;
}) {
  if (chips.length === 0) {
    return emptyLabel ? (
      <p className={cn("text-[11px] text-slate-400 dark:text-slate-500", className)}>{emptyLabel}</p>
    ) : null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-[11px] text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
        >
          <span className="text-slate-500 dark:text-slate-500">{chip.label}:</span>
          <span className="max-w-[180px] truncate font-semibold text-slate-800 dark:text-slate-100">
            {chip.value}
          </span>
          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove ${chip.label} ${chip.value}`}
              onClick={() => onRemove(chip)}
              className="ml-0.5 flex size-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="size-3" />
            </button>
          ) : (
            <span className="w-1" />
          )}
        </span>
      ))}
    </div>
  );
}
