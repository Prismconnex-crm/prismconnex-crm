import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_EXHIBITORS_MESSAGE, exhibitorsPanelView } from '@/lib/find-shows/exhibitors-panel-view';
import type { ExhibitorCard, ExhibitorDirectory, ExhibitorStatus } from '@/lib/find-shows/exhibitors';

const card = (id: string, name: string) => ({ id, name, booths: [] }) as unknown as ExhibitorCard;

const directory = (status: ExhibitorStatus, overrides: Partial<ExhibitorDirectory> = {}): ExhibitorDirectory => ({
  status,
  source: null,
  exhibitors: [],
  reason: '',
  checkedAt: '2026-10-24T00:00:00.000Z',
  rejected: [],
  ...overrides,
});

const ready = (value: ExhibitorDirectory) => ({ status: 'ready' as const, directory: value });

describe('Exhibitors tab view', () => {
  it('while loading shows only the skeleton, with no count even when the catalog has one', () => {
    expect(exhibitorsPanelView({ status: 'loading' }, null)).toEqual({ count: null, body: 'loading' });
    expect(exhibitorsPanelView({ status: 'loading' }, 420)).toEqual({ count: null, body: 'loading' });
  });

  it('a list with exhibitors shows them and their count', () => {
    const list = directory('VERIFIED_LIST', { exhibitors: [card('a', 'Acme GmbH'), card('b', 'Bosch')] });
    expect(exhibitorsPanelView(ready(list), null)).toEqual({ count: 2, body: 'list' });
    expect(exhibitorsPanelView(ready({ ...list, total: 900 }), 5)).toEqual({ count: 900, body: 'list' });
  });

  it('a confirmed-empty answer is the empty state, without a placeholder count', () => {
    for (const status of ['NO_VERIFIED_DIRECTORY', 'VERIFIED_EMPTY_DIRECTORY', 'VERIFIED_LIST'] as const) {
      expect(exhibitorsPanelView(ready(directory(status)), null)).toEqual({ count: null, body: 'empty' });
      expect(exhibitorsPanelView(ready(directory(status)), 0)).toEqual({ count: null, body: 'empty' });
    }
  });

  it('a failed request is its own state, never the empty state, and has no placeholder count', () => {
    expect(exhibitorsPanelView({ status: 'error' }, null)).toEqual({ count: null, body: 'failed' });
    expect(exhibitorsPanelView({ status: 'error' }, 0)).toEqual({ count: null, body: 'failed' });
    expect(exhibitorsPanelView(ready(directory('DISCOVERY_INCOMPLETE')), null)).toEqual({ count: null, body: 'failed' });
  });

  it('the empty state uses the exact message', () => {
    expect(EMPTY_EXHIBITORS_MESSAGE).toBe('Official exhibitor information is not available yet.');
  });

  it('the panel renders the empty message only for the empty state, and never "TBA"', () => {
    const source = readFileSync(resolve(__dirname, '../../components/find-shows/exhibitors-directory-panel.tsx'), 'utf8');
    expect(source).not.toMatch(/TBA/);
    expect(source).toMatch(/view\.body === 'empty'[\s\S]{0,600}\{EMPTY_EXHIBITORS_MESSAGE\}/);
    expect(source.match(/EMPTY_EXHIBITORS_MESSAGE/g)).toHaveLength(2); // the import and the one use
  });
});
