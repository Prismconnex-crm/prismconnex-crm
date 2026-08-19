"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Globe, Phone, Sparkles, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABELS, VERIFICATION_LABELS } from "@/lib/people/vocabulary";
import type { Person } from "@/types/people";

/**
 * The person detail, as a right-hand slide-over rather than a permanently
 * docked third column — the two-panel layout must match Companies, so detail
 * has to float above it.
 *
 * Focus is trapped while open and restored to whatever opened it, so keyboard
 * users are not dumped at the top of the document on close.
 */
export function PeopleDetailSlideover({
  person,
  isSaved,
  onClose,
  onToggleSaved,
  onFindSimilar,
}: {
  person: Person | null;
  isSaved: boolean;
  onClose: () => void;
  onToggleSaved: (person: Person) => void;
  onFindSimilar: (person: Person) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!person) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      // Trap: cycle focus inside the panel.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [person, onClose]);

  return (
    <AnimatePresence>
      {person ? (
        <>
          <motion.button
            type="button"
            aria-label="Close contact details"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default bg-slate-900/30 backdrop-blur-[2px] dark:bg-black/50"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${person.firstName} ${person.lastName} details`}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl outline-none dark:border-[#22304A] dark:bg-[#111B2E]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-[56px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 shadow-sm dark:border-[#22304A] dark:bg-[#16233A]">
                  <span className="text-[22px] font-bold text-slate-700 dark:text-slate-300">
                    {person.firstName[0]}
                    {person.lastName[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] font-bold leading-tight text-slate-900 dark:text-white">
                    {person.firstName} {person.lastName}
                  </h2>
                  <span className="mt-1 inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-400">
                    {person.company}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={isSaved ? "Remove from Saved People" : "Save person"}
                  onClick={() => onToggleSaved(person)}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-500 dark:hover:bg-[#22304A]"
                >
                  <Star className={cn("size-4", isSaved && "fill-amber-400 text-amber-400")} />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-[#22304A] dark:hover:text-slate-300"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <button className="h-8 w-full rounded-[6px] bg-indigo-600 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                Add to CRM
              </button>
              <button className="h-8 w-full rounded-[6px] border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-[#E5E7EB] dark:hover:bg-[#16233A]">
                Add to Sequence
              </button>
            </div>

            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-[#22304A]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Work email
                  </p>
                  <p className="mb-1 truncate text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]" title={person.workEmail}>
                    {person.workEmail}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                      person.verification === "verified"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : person.verification === "needs_verification"
                          ? "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                          : "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                    )}
                  >
                    {VERIFICATION_LABELS[person.verification]}
                    <BadgeCheck className="size-2.5" />
                  </span>
                </div>
                <div className="border-l border-slate-100 pl-3 dark:border-[#22304A]">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Country
                  </p>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]">
                    <Globe className="size-3.5 text-indigo-500" />
                    {person.country}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Phone
                  </p>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB]">
                    <Phone className="size-3.5 text-slate-400" />
                    {person.phone ?? "—"}
                  </p>
                </div>
                <div className="border-l border-slate-100 pl-3 dark:border-[#22304A]">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Title
                  </p>
                  <p className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-[#E5E7EB]">
                    {person.title}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  LinkedIn URL
                </p>
                <div className="flex h-8 w-full items-center rounded-[6px] border border-slate-200 bg-slate-50 px-2.5 dark:border-[#22304A] dark:bg-[#0B1220]">
                  {person.linkedinUrl ? (
                    <a
                      href={person.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[12px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {person.linkedinUrl}
                    </a>
                  ) : (
                    <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                      Not provided
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 rounded-[6px] border border-slate-200 bg-slate-50 p-2.5 text-[12px] dark:border-[#22304A] dark:bg-[#0B1220]">
                <div className="font-medium text-slate-500 dark:text-slate-400">Source</div>
                <div className="font-semibold text-slate-900 dark:text-[#E5E7EB]">
                  {SOURCE_LABELS[person.source] ?? person.source}
                </div>
                <div className="font-medium text-slate-500 dark:text-slate-400">Fetched</div>
                <div className="font-semibold text-slate-900 dark:text-[#E5E7EB]">
                  {person.fetchedAt}
                </div>
                <div className="font-medium text-slate-500 dark:text-slate-400">Confidence</div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400">
                  {person.confidence}%
                </div>
              </div>

              <button
                type="button"
                onClick={() => onFindSimilar(person)}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] border border-indigo-200 bg-white text-[12px] font-bold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-[#16233A] dark:text-indigo-400 dark:hover:bg-[#22304A]"
              >
                <Sparkles className="size-3.5" />
                Find similar
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
