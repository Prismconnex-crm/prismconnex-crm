"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Person } from '@/types/people';

/**
 * Saved People, browser-local.
 *
 * Mirrors `components/search/query-store.ts` rather than the workspace-scoped
 * `/api/saved-companies` table, because People has no persisted model (spec
 * decision 1: the dataset is a committed seed, no database). Everything goes
 * through this one file, so promoting it to an API later is a single-file
 * change.
 *
 * The pure functions take an injected storage object so they can be unit-tested
 * in vitest's `node` environment, where `localStorage` does not exist.
 */

export const SAVED_PEOPLE_STORAGE_KEY = 'pcx_saved_people';
const CHANGE_EVENT = 'pcx:saved-people-changed';

export type SavedPeopleStorage = Pick<Storage, 'getItem' | 'setItem'>;

function dedupe(people: Person[]): Person[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    if (!person?.id || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
}

export function readSavedPeople(storage: SavedPeopleStorage): Person[] {
  try {
    const raw = storage.getItem(SAVED_PEOPLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupe(parsed as Person[]) : [];
  } catch {
    // Corrupt entry — start clean rather than breaking the tab.
    return [];
  }
}

export function writeSavedPeople(storage: SavedPeopleStorage, people: Person[]): void {
  try {
    storage.setItem(SAVED_PEOPLE_STORAGE_KEY, JSON.stringify(dedupe(people)));
  } catch {
    // Quota exceeded or storage disabled — saving is a convenience, not a
    // requirement, so drop it silently.
  }
}

export function toggleSavedPerson(storage: SavedPeopleStorage, person: Person): Person[] {
  const current = readSavedPeople(storage);
  const next = current.some((entry) => entry.id === person.id)
    ? current.filter((entry) => entry.id !== person.id)
    : [...current, person];
  writeSavedPeople(storage, next);
  return next;
}

export function isPersonSaved(people: readonly Person[], id: string): boolean {
  return people.some((person) => person.id === id);
}

/** React binding. Broadcasts writes so every mounted view re-reads. */
export function useSavedPeople() {
  const [saved, setSaved] = useState<Person[]>([]);

  useEffect(() => {
    const sync = () => setSaved(readSavedPeople(window.localStorage));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((person: Person) => {
    setSaved(toggleSavedPerson(window.localStorage, person));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isSaved = useCallback((id: string) => isPersonSaved(saved, id), [saved]);

  return { saved, toggle, isSaved };
}
