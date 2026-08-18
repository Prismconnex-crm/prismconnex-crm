"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import type { Person, VerificationStatus } from "@/types/people";

/**
 * The shared People table. Used both for the capped inline table inside a chat
 * reply and for the full paginated Results view, so a cell can never render
 * differently in the two places.
 */

function initials(person: Person): string {
  return `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();
}

const STATUS_STYLES: Record<VerificationStatus, string> = {
  verified:
    "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  needs_verification:
    "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  invalid:
    "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="h-[48px]">
          <td colSpan={7} className="px-4">
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-[#16233A]" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function PeopleResultsTable({
  people,
  selectedIds,
  savedIds,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = "No contacts match — try relaxing verification or confidence.",
  onToggleSelect,
  onToggleSaved,
  onOpenPerson,
}: {
  people: Person[];
  selectedIds: Set<string>;
  savedIds: Set<string>;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  onToggleSelect: (id: string) => void;
  onToggleSaved: (person: Person) => void;
  onOpenPerson: (person: Person) => void;
}) {
  if (!isLoading && people.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-[#22304A] dark:bg-[#111B2E]">
        <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">{emptyMessage}</p>
      </div>
    );
  }

  return (
    // The table scrolls inside its own container so the page body never scrolls
    // horizontally, on any breakpoint.
    <div className="overflow-x-auto rounded-[12px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
      <table className="w-full min-w-[900px] whitespace-nowrap text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220]">
          <tr className="text-[12px] text-slate-500 dark:text-slate-400">
            <th className="w-[44px] px-4 py-2.5 font-medium">
              <span className="sr-only">Select</span>
            </th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 font-medium">Platform Score</th>
            <th className="px-3 py-2.5 font-medium">Company</th>
            <th className="px-3 py-2.5 font-medium">Work Email</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
          {isLoading ? (
            <SkeletonRows rows={skeletonRows} />
          ) : (
            people.map((person) => {
              const isSelected = selectedIds.has(person.id);
              const isSaved = savedIds.has(person.id);
              return (
                <tr
                  key={person.id}
                  onClick={() => onOpenPerson(person)}
                  className={cn(
                    "group h-[48px] cursor-pointer border-l-2 transition-colors",
                    isSelected
                      ? "border-l-indigo-500 bg-indigo-50/50 dark:bg-[#16233A]/80"
                      : "border-l-transparent hover:bg-slate-50 dark:hover:bg-[#16233A]/40"
                  )}
                >
                  <td className="px-4" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${person.firstName} ${person.lastName}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(person.id)}
                      className="size-3.5 cursor-pointer accent-indigo-600"
                    />
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm",
                          isSelected ? "bg-indigo-500" : "bg-slate-300 dark:bg-[#22304A]"
                        )}
                      >
                        {initials(person)}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-[13px] font-semibold",
                            isSelected
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-900 dark:text-[#E5E7EB]"
                          )}
                        >
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="max-w-[160px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {person.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={isSaved ? "Remove from Saved People" : "Save person"}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleSaved(person);
                        }}
                        className="ml-1 rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-amber-500 dark:text-slate-600 dark:hover:bg-[#22304A]"
                      >
                        <Star className={cn("size-3.5", isSaved && "fill-amber-400 text-amber-400")} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1.5">
                      <Star
                        className={cn(
                          "size-3.5",
                          person.platformScore >= 90
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 dark:text-slate-600"
                        )}
                      />
                      <span className="font-medium text-slate-700 dark:text-[#E5E7EB]">
                        {person.platformScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 font-medium text-slate-700 dark:text-slate-400">
                    {person.company}
                  </td>
                  <td className="px-3 font-medium text-slate-900 dark:text-[#E5E7EB]">
                    {person.workEmail}
                  </td>
                  <td className="px-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                        STATUS_STYLES[person.verification]
                      )}
                    >
                      {VERIFICATION_LABELS[person.verification]}
                    </span>
                  </td>
                  <td className="px-3">
                    <div className="flex w-[70px] items-center gap-2">
                      <span className="font-mono text-[12px] font-medium text-slate-700 dark:text-white">
                        {person.confidence}%
                      </span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0B1220]">
                        <div
                          className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                          style={{ width: `${person.confidence}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
