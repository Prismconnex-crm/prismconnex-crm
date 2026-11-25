import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exhibitorCardAction, exhibitorOfficialWebsite } from '@/lib/exhibitors/card-links';

const links = (overrides: { website?: string | null; profileUrl?: string | null; directoryUrl?: string | null }) => ({
  website: null,
  profileUrl: null,
  directoryUrl: null,
  ...overrides,
});

describe('CRM exhibitor card links', () => {
  it('shows a verified official website as the card link and the View detail target', () => {
    const ex = links({ website: 'https://www.acme.at/', profileUrl: 'https://www.gastmesse.at/en/aussteller/acme', directoryUrl: 'https://www.gastmesse.at/en/ausstellerverzeichnis/' });
    expect(exhibitorOfficialWebsite(ex)).toBe('https://www.acme.at/');
    expect(exhibitorCardAction(ex)).toEqual({ href: 'https://www.acme.at/', label: 'View detail' });
  });

  it('leaves the website blank without a website, and View detail opens the exhibitor’s own directory profile', () => {
    const ex = links({ profileUrl: 'https://www.gastmesse.at/en/aussteller/acme', directoryUrl: 'https://www.gastmesse.at/en/ausstellerverzeichnis/' });
    expect(exhibitorOfficialWebsite(ex)).toBeNull();
    expect(exhibitorCardAction(ex)).toEqual({ href: 'https://www.gastmesse.at/en/aussteller/acme', label: 'View detail' });
  });

  it('offers Open show directory only when the event’s own directory URL is the one link the row has', () => {
    expect(exhibitorCardAction(links({ directoryUrl: 'https://www.gastmesse.at/en/ausstellerverzeichnis/' }))).toEqual({
      href: 'https://www.gastmesse.at/en/ausstellerverzeichnis/',
      label: 'Open show directory',
    });
  });

  it('shows no link at all — no guessed or borrowed directory — when the row has none', () => {
    expect(exhibitorCardAction(links({}))).toBeNull();
    expect(exhibitorCardAction(links({ website: '', profileUrl: '  ' }))).toBeNull();
  });

  it('never treats an unsafe address as a website or link', () => {
    const ex = links({ website: 'javascript:alert(1)', profileUrl: 'data:text/html,hi', directoryUrl: 'https://user:pw@example.com/' });
    expect(exhibitorOfficialWebsite(ex)).toBeNull();
    expect(exhibitorCardAction(ex)).toBeNull();
  });

  it('the CRM Exhibitors components carry no missing-website placeholder or another event’s directory', () => {
    for (const file of ['components/crm/bett-exhibitor-grid.tsx', 'components/events/exhibitors-panel.tsx']) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/No official (site|website)/i);
      expect(source, file).not.toMatch(/Directory only/);
      expect(source, file).not.toContain('bettshow.com');
    }
  });
});
