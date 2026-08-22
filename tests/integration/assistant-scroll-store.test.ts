import { beforeEach, describe, expect, it } from 'vitest';

import {
  readScroll,
  resetScrollsForTests,
  saveScroll,
  scrollKey,
} from '@/components/assistant/scroll-store';

beforeEach(() => {
  resetScrollsForTests();
});

describe('scrollKey', () => {
  it('separates entities within one conversation', () => {
    expect(scrollKey('c1', 'people')).not.toBe(scrollKey('c1', 'events'));
  });

  it('separates conversations for one entity', () => {
    expect(scrollKey('c1', 'people')).not.toBe(scrollKey('c2', 'people'));
  });

  it('is stable for the same pair', () => {
    expect(scrollKey('c1', 'people')).toBe(scrollKey('c1', 'people'));
  });
});

describe('saveScroll / readScroll', () => {
  it('returns 0 for a key never written — a fresh thread starts at the top', () => {
    expect(readScroll(scrollKey('c1', 'people'))).toBe(0);
  });

  it('round-trips an offset', () => {
    saveScroll(scrollKey('c1', 'people'), 420);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(420);
  });

  it('keeps entities from overwriting each other', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'events'), 250);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
    expect(readScroll(scrollKey('c1', 'events'))).toBe(250);
  });

  it('keeps conversations from overwriting each other', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c2', 'people'), 250);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
    expect(readScroll(scrollKey('c2', 'people'))).toBe(250);
  });

  it('overwrites on the same key', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'people'), 300);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(300);
  });

  it('ignores a non-finite offset rather than poisoning the key', () => {
    saveScroll(scrollKey('c1', 'people'), 100);
    saveScroll(scrollKey('c1', 'people'), Number.NaN);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(100);
  });

  it('clamps a negative offset to 0', () => {
    saveScroll(scrollKey('c1', 'people'), -50);
    expect(readScroll(scrollKey('c1', 'people'))).toBe(0);
  });
});
