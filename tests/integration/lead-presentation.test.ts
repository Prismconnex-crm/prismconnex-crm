import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STATUSES,
  describeFollowUp,
  leadInitials,
  statusLabel,
  toDateInputValue,
} from '@/lib/leads/presentation';

describe('lead presentation helpers', () => {
  it('labels every status, and falls back to the raw value for an unknown one', () => {
    expect(statusLabel('NEW')).toBe('New');
    expect(statusLabel('NURTURING')).toBe('Nurturing');
    expect(statusLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });

  it('leaves Lost out of the pipeline columns', () => {
    expect(PIPELINE_STATUSES).not.toContain('LOST');
    expect(PIPELINE_STATUSES[0]).toBe('NEW');
  });

  it('builds initials from up to two words', () => {
    expect(leadInitials('Ada Lovelace')).toBe('AL');
    expect(leadInitials('ada')).toBe('A');
    expect(leadInitials('  ')).toBe('?');
  });

  it('describes a follow-up relative to today', () => {
    const now = new Date(2026, 8, 30, 15, 0); // 30 Sep 2026, local time

    expect(describeFollowUp(null, now)).toBeNull();
    expect(describeFollowUp('2026-09-30T00:00:00.000Z', now)).toEqual({ label: 'Today', overdue: false });
    expect(describeFollowUp('2026-10-01T00:00:00.000Z', now)).toEqual({ label: 'Tomorrow', overdue: false });
    expect(describeFollowUp('2026-09-28T00:00:00.000Z', now)).toEqual({ label: 'Overdue · 28 Sept 2026', overdue: true });
    expect(describeFollowUp('2026-10-20T00:00:00.000Z', now)?.overdue).toBe(false);
  });

  it('turns a stored follow-up into a date input value', () => {
    expect(toDateInputValue('2026-10-05T00:00:00.000Z')).toBe('2026-10-05');
    expect(toDateInputValue(null)).toBe('');
  });
});
