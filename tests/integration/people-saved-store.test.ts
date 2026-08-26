import { describe, expect, it } from 'vitest';
import {
  SAVED_PEOPLE_STORAGE_KEY,
  isPersonSaved,
  readSavedPeople,
  toggleSavedPerson,
  writeSavedPeople,
} from '@/lib/people/saved-store';
import type { Person } from '@/types/people';

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map),
  };
}

function makePerson(id: string): Person {
  return {
    id,
    firstName: 'Sarah',
    lastName: 'Miller',
    title: 'Marketing Manager',
    seniority: 'Manager',
    department: 'Marketing',
    company: 'NovaAI',
    companyDomain: 'novaai.de',
    companyHeadcount: '51-200',
    industry: 'Artificial Intelligence',
    country: 'Germany',
    location: 'Berlin, Germany',
    workEmail: 'sarah.miller@novaai.de',
    phone: null,
    linkedinUrl: null,
    verification: 'verified',
    confidence: 91,
    platformScore: 98,
    source: 'user_import',
    keywords: ['automation'],
    buyingIntent: 'high',
    fetchedAt: '2026-02-01',
    lastActiveAt: '2026-08-01',
  };
}

describe('saved people store', () => {
  it('starts empty', () => {
    expect(readSavedPeople(makeStorage())).toEqual([]);
  });

  it('round-trips through storage', () => {
    const storage = makeStorage();
    writeSavedPeople(storage, [makePerson('p1')]);
    expect(readSavedPeople(storage).map((person) => person.id)).toEqual(['p1']);
  });

  it('toggles a person in and back out', () => {
    const storage = makeStorage();
    expect(toggleSavedPerson(storage, makePerson('p1')).map((p) => p.id)).toEqual(['p1']);
    expect(toggleSavedPerson(storage, makePerson('p1'))).toEqual([]);
  });

  it('never stores the same person twice', () => {
    const storage = makeStorage();
    writeSavedPeople(storage, [makePerson('p1'), makePerson('p1')]);
    expect(readSavedPeople(storage)).toHaveLength(1);
  });

  it('survives a corrupt entry rather than throwing', () => {
    const storage = makeStorage({ [SAVED_PEOPLE_STORAGE_KEY]: '{not json' });
    expect(readSavedPeople(storage)).toEqual([]);
  });

  it('ignores a stored value that is not an array', () => {
    const storage = makeStorage({ [SAVED_PEOPLE_STORAGE_KEY]: '{"nope":true}' });
    expect(readSavedPeople(storage)).toEqual([]);
  });

  it('reports membership', () => {
    expect(isPersonSaved([makePerson('p1')], 'p1')).toBe(true);
    expect(isPersonSaved([makePerson('p1')], 'p2')).toBe(false);
  });

  it('does not throw when storage refuses to write', () => {
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeSavedPeople(readOnly, [makePerson('p1')])).not.toThrow();
  });
});
