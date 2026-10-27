import { describe, expect, it } from 'vitest';
import {
  directoryProfileUrl,
  extractDirectoryCategories,
  extractDirectoryDescription,
  htmlToText,
} from '@/lib/exhibitors/bett-directory';

/** Markup shaped like a real BETT profile page. */
const PROFILE = `
<div class="m-exhibitor-entry__item__header__infos">
  <div class="m-exhibitor-entry__item__header__infos__stand">SD20</div>
  <ul class="m-exhibitor-entry__item__header__infos__categories">
    <li class="m-exhibitor-entry__item__header__infos__categories__item">
      <i class="m-exhibitor-entry__item__header__infos__categories__item__split">|</i>
      Management Solutions
    </li>
    <li class="m-exhibitor-entry__item__header__infos__categories__item">
      <i class="m-exhibitor-entry__item__header__infos__categories__item__split">|</i>
      No
    </li>
  </ul>
</div>
<div class="m-exhibitor-entry__item__body">
  <div class="m-exhibitor-entry__item__body__description">
    <p><strong>Transform your school&rsquo;s analytics with 4Matrix.</strong></p>
    <ul>
      <li>Easy data import tool for all major MIS</li>
      <li>Pupil photos visible within tools and reports</li>
    </ul>
  </div>
</div>`;

describe('BETT directory profile parsing', () => {
  it('reads the description the exhibitor wrote for the show', () => {
    const description = extractDirectoryDescription(PROFILE);
    expect(description).toContain("Transform your school’s analytics with 4Matrix");
  });

  it('separates bullet points into sentences rather than running them together', () => {
    // The first version produced "...for all major MIS Pupil photos visible
    // within tools and reports", which reads as one broken sentence.
    const description = extractDirectoryDescription(PROFILE) ?? '';
    expect(description).toContain('for all major MIS. Pupil photos');
    expect(description).not.toContain('MIS Pupil photos');
  });

  it('reads the show\'s own category tags', () => {
    expect(extractDirectoryCategories(PROFILE)).toEqual(['Management Solutions']);
  });

  it('drops the stray yes/no field that leaks into the category list', () => {
    expect(extractDirectoryCategories(PROFILE)).not.toContain('No');
  });

  it('returns nothing when the page has no description block', () => {
    expect(extractDirectoryDescription('<div>nothing here</div>')).toBeNull();
    expect(extractDirectoryCategories('<div>nothing here</div>')).toEqual([]);
  });

  it('rejects a description too short to be worth showing', () => {
    const thin = '<div class="m-exhibitor-entry__item__body__description"><p>Hello.</p></div>';
    expect(extractDirectoryDescription(thin)).toBeNull();
  });

  it('decodes entities rather than leaving them raw', () => {
    // The closing </p> ends the sentence, so a full stop is expected here.
    expect(htmlToText('<p>Smith &amp; Co &ndash; &ldquo;learning&rdquo;</p>')).toBe(
      'Smith & Co – “learning”.'
    );
  });

  it('does not leave doubled or leading punctuation behind', () => {
    const text = htmlToText('<p>One.</p><p>Two.</p><li>Three</li>');
    expect(text).toBe('One. Two. Three.');
    expect(text.startsWith('.')).toBe(false);
  });

  it('rewrites a stored detail URL to the path that actually resolves', () => {
    // The stored form 301s to the listing; only /exhibitors/<slug> serves a profile.
    expect(
      directoryProfileUrl('https://uk.bettshow.com/solution-providers/exhibitors/4matrix')
    ).toBe('https://uk.bettshow.com/exhibitors/4matrix');
  });

  it('returns no URL when there is no stored source', () => {
    expect(directoryProfileUrl(null)).toBeNull();
  });
});
