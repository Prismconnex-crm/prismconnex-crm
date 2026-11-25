import { describe, expect, it } from 'vitest';
import { classifyGeneralIndustry, decideExhibitorIndustry, GENERAL_INDUSTRIES } from '@/lib/exhibitors/general-industry';

describe('classifyGeneralIndustry', () => {
  it.each([
    ['Precision torque wrenches and CNC machining centres for metalworking.', 'Acme GmbH', 'Industrial Machinery & Engineering'],
    ['Küchenfertige Frischsalate und Gemüse, hausgemachte Feinkost.', 'Kugler Feinkost GmbH', 'Food & Beverage'],
    ['Active pharmaceutical ingredients and CDMO services.', 'Zhejiang Medicine Co', 'Pharmaceuticals & Biotech'],
    ['', 'Booster Robotics Technology Co.', 'Automation & Robotics'],
    ['Pelletheizungen und Wärmepumpen — erneuerbare Energie für Ihr Zuhause.', 'ÖkoFEN', 'Energy & Utilities'],
    ['Diamond and gold jewellery manufacturer and wholesaler.', 'Shree Gems', 'Jewellery & Watches'],
  ])('%s → %s', (text, name, expected) => {
    expect(classifyGeneralIndustry(text, name).industry).toBe(expected);
  });

  it('does not match a keyword inside another word ("art" in "start")', () => {
    expect(classifyGeneralIndustry('We help you start fast.', 'Smart Start Ltd').industry).toBeNull();
  });

  it('leaves vague copy unclassified instead of guessing', () => {
    expect(classifyGeneralIndustry('We deliver solutions and services for our customers.', 'Global Partners').industry).toBeNull();
  });

  it('only ever returns a published sector', () => {
    const r = classifyGeneralIndustry('hotel catering foodservice', 'X');
    expect(r.industry === null || GENERAL_INDUSTRIES.includes(r.industry)).toBe(true);
  });
});

describe('decideExhibitorIndustry', () => {
  const base = { companyName: 'Global Partners', description: null, categories: [], descriptionSource: null, showName: 'MEDICA 2026', showCategories: ['Medical', 'Healthcare'] };

  it("uses the company's own text when it decides", () => {
    const d = decideExhibitorIndustry({ ...base, companyName: 'Acme Packaging Solutions', descriptionSource: 'acme.com' });
    expect(d).toEqual({ industry: 'Packaging', evidence: expect.arrayContaining(['name:packaging']), source: 'own-text:acme.com' });
  });

  it("falls back to the show's sector, labelled as the show's", () => {
    expect(decideExhibitorIndustry(base)).toEqual({ industry: 'Health & Medical', evidence: ['exhibits at MEDICA 2026'], source: 'show-category' });
  });

  it('gives no fallback for a "General" show', () => {
    expect(decideExhibitorIndustry({ ...base, showCategories: ['General'] })).toBeNull();
  });
});
