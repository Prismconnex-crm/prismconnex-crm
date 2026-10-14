import { describe, expect, it } from 'vitest';
import {
  CreateLeadSchema,
  LEAD_STATUSES,
  LeadListQuerySchema,
  LeadNoteSchema,
  UpdateLeadSchema,
} from '@/models/lead';

describe('CreateLeadSchema', () => {
  it('requires a name', () => {
    expect(CreateLeadSchema.safeParse({ fullName: '   ' }).success).toBe(false);
  });

  it('applies the defaults for a minimal lead', () => {
    const lead = CreateLeadSchema.parse({ fullName: 'Ada Lovelace' });
    expect(lead).toMatchObject({ fullName: 'Ada Lovelace', source: 'MANUAL', status: 'NEW', score: 0 });
  });

  it('turns empty optional form fields into null rather than empty strings', () => {
    const lead = CreateLeadSchema.parse({ fullName: 'Ada', email: '', phone: '  ', nextFollowUpAt: '' });
    expect(lead.email).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.nextFollowUpAt).toBeNull();
  });

  it('rejects a malformed email', () => {
    expect(CreateLeadSchema.safeParse({ fullName: 'Ada', email: 'not-an-email' }).success).toBe(false);
  });

  it('parses a follow-up date into a Date', () => {
    const lead = CreateLeadSchema.parse({ fullName: 'Ada', nextFollowUpAt: '2026-10-05' });
    expect(lead.nextFollowUpAt).toBeInstanceOf(Date);
    expect(lead.nextFollowUpAt?.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('rejects an impossible follow-up date', () => {
    expect(CreateLeadSchema.safeParse({ fullName: 'Ada', nextFollowUpAt: 'soon' }).success).toBe(false);
  });

  it('caps the score at 100', () => {
    expect(CreateLeadSchema.safeParse({ fullName: 'Ada', score: 101 }).success).toBe(false);
  });

  it('keeps an explicit null owner (unassigned) distinct from an omitted one', () => {
    expect(CreateLeadSchema.parse({ fullName: 'Ada', ownerId: null }).ownerId).toBeNull();
    expect(CreateLeadSchema.parse({ fullName: 'Ada' }).ownerId).toBeUndefined();
  });
});

describe('UpdateLeadSchema', () => {
  it('injects no defaults, so a partial PATCH cannot reset untouched fields', () => {
    // CreateLeadSchema.partial() would re-apply status: "NEW" and score: 0.
    expect(UpdateLeadSchema.parse({ jobTitle: 'CTO' })).toEqual({ jobTitle: 'CTO' });
  });

  it('accepts every pipeline status', () => {
    for (const status of LEAD_STATUSES) {
      expect(UpdateLeadSchema.safeParse({ status }).success).toBe(true);
    }
  });
});

describe('LeadListQuerySchema', () => {
  it('defaults and clamps the page size', () => {
    expect(LeadListQuerySchema.parse({}).limit).toBe(50);
    expect(LeadListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects an unknown status filter', () => {
    expect(LeadListQuerySchema.safeParse({ status: 'WON' }).success).toBe(false);
  });
});

describe('LeadNoteSchema', () => {
  it('rejects a blank note', () => {
    expect(LeadNoteSchema.safeParse({ body: '  ' }).success).toBe(false);
  });
});
