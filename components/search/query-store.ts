"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Browser-local store of natural-language searches, shared by the Companies
 * "Find anything" panel and the Events Explorer. Entries are tagged by `type`
 * so each surface only sees its own history while the storage, shape and UI
 * stay common.
 */

export type SavedQueryKind = "lead_query" | "event_query" | "people_query";

export type SavedQueryChip = { label: string; value: string };

export type SavedQuery = {
  id: string;
  type: SavedQueryKind;
  /** The raw sentence the user typed. */
  query: string;
  /** How the assistant read it, rendered as chips on the card. */
  chips: SavedQueryChip[];
  createdAt: number;
  saved: boolean;
  /**
   * Opaque snapshot of the search state, so "View" can restore the exact
   * search rather than re-asking the model.
   */
  payload?: unknown;
};

const STORAGE_KEY = "pcx_search_queries";
const MAX_RECENT = 12;
/** Broadcasts writes so every mounted panel re-reads, including in this tab. */
const CHANGE_EVENT = "pcx:search-queries-changed";

function readAll(): SavedQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedQuery[]) : [];
  } catch {
    // Corrupt entry — start clean rather than breaking the panel.
    return [];
  }
}

function writeAll(entries: SavedQuery[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage disabled — history is a convenience, not a
    // requirement, so drop it silently.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function useQueryStore(type: SavedQueryKind) {
  const [entries, setEntries] = useState<SavedQuery[]>([]);

  useEffect(() => {
    const sync = () => setEntries(readAll().filter((entry) => entry.type === type));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [type]);

  /** Records a search, replacing any earlier identical query. Returns its id. */
  const record = useCallback(
    (entry: Omit<SavedQuery, "id" | "type" | "createdAt" | "saved">) => {
      const all = readAll();
      const query = entry.query.trim();
      const previous = all.find(
        (item) => item.type === type && item.query.toLowerCase() === query.toLowerCase()
      );
      const next: SavedQuery = {
        id: previous?.id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        saved: previous?.saved ?? false,
        createdAt: Date.now(),
        ...entry,
        query,
      };

      // Trim only unsaved history for this type; saved entries are pinned and
      // other surfaces' entries are left alone.
      let unsavedSeen = 0;
      const kept = all
        .filter((item) => item.id !== next.id)
        .filter((item) => {
          if (item.type !== type || item.saved) return true;
          unsavedSeen += 1;
          return unsavedSeen < MAX_RECENT;
        });

      writeAll([next, ...kept]);
      return next.id;
    },
    [type]
  );

  const toggleSaved = useCallback((id: string) => {
    writeAll(
      readAll().map((entry) => (entry.id === id ? { ...entry, saved: !entry.saved } : entry))
    );
  }, []);

  const remove = useCallback((id: string) => {
    writeAll(readAll().filter((entry) => entry.id !== id));
  }, []);

  const sorted = [...entries].sort((left, right) => right.createdAt - left.createdAt);

  return {
    recent: sorted,
    saved: sorted.filter((entry) => entry.saved),
    record,
    toggleSaved,
    remove,
  };
}
