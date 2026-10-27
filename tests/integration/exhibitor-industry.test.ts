import { describe, expect, it } from 'vitest';
import { classifyIndustry, INDUSTRIES } from '@/lib/events/industry';

/**
 * These cases are the real misclassifications the first version produced
 * against the 316 BETT exhibitors, kept so the thresholds cannot quietly drift
 * back. Each one names the company it came from.
 */
describe('classifyIndustry', () => {
  it('reads the sector from a company that states it plainly', () => {
    const result = classifyIndustry(
      'School analytics with 4Matrix. Unlock the stories behind your data. '
        + 'School data and progress tracking for every multi academy trust.',
      '4Matrix'
    );
    expect(result.industry).toBe('School Data & Analytics');
    expect(result.reason).toBe('ok');
  });

  it('records the phrases that decided the verdict', () => {
    const result = classifyIndustry('Secure and govern every AI agent with one AI platform.', 'Airia');
    expect(result.industry).toBe('Artificial Intelligence');
    expect(result.evidence).toContain('ai agent');
  });

  it('uses the company name when the site says nothing useful', () => {
    // abcsprachen.ch has <title>Home</title> and no meta description at all.
    const result = classifyIndustry('Home. abc sprachen. +41 78 631 30 75', 'abc Virtual Reality Language Learning');
    expect(result.industry).toBe('Language Learning');
    expect(result.evidence).toContain('name:language learning');
  });

  it('treats a sector word in the name as identifying, not merely suggestive', () => {
    // Booster Robotics scored 2 before name hits were floored at strong weight.
    const result = classifyIndustry('Humanoid robots for research and education.', 'Booster Robotics Technology Co.,Ltd.');
    expect(result.industry).toBe('STEM & Robotics');
  });

  it('lets the name settle a contest between two services a supplier sells', () => {
    // Advanced IT Services scored higher on cyber security than on IT services.
    const result = classifyIndustry(
      'UK-wide IT support, installations and connectivity for schools. Cyber security and Cyber Essentials. Network infrastructure and broadband.',
      'Advanced IT Services'
    );
    expect(result.industry).toBe('Information Technology & Services');
  });

  it('does not let a single qualification subject reclassify an exam board', () => {
    // AQA came out as a sports supplier because it offers a PE qualification.
    const result = classifyIndustry('AQA. Physical Education. Find past papers and specifications.', 'AQA');
    expect(result.industry).not.toBe('Sports & Physical Education');
  });

  it('does not let a product feature outrank what the company actually is', () => {
    // "professional development" made a publisher a teacher-training provider.
    const result = classifyIndustry(
      'McGraw Hill. Supporting educators with professional development.',
      'McGraw Hill'
    );
    expect(result.industry).not.toBe('Teacher Training & Development');
  });

  it('does not infer a sector from conditions an article happens to mention', () => {
    // BBC Education became a SEN supplier off autism and ADHD article tags.
    const result = classifyIndustry(
      'The best of the BBC, with the latest news and sport headlines. Autism. ADHD.',
      'BBC Education'
    );
    expect(result.industry).not.toBe('Special Educational Needs');
  });

  it('keeps a kit maker in its own sector when it also ships teaching material', () => {
    // ACEBOTT lost to Publishing because its kits come with lesson plans.
    const result = classifyIndustry(
      'ACEBOTT is a trusted brand for STEAM kits, ESP32 kits and robot kits, with lesson plans and textbooks included.',
      'ACEBOTT Co., Ltd.'
    );
    expect(result.industry).toBe('STEM & Robotics');
  });

  it('returns nothing when two sectors are within a point of each other', () => {
    const result = classifyIndustry('Interactive whiteboard and school furniture and classroom furniture supplier.', 'Generic Supplier');
    expect(['too-close', 'ok']).toContain(result.reason);
    if (result.reason === 'too-close') expect(result.industry).toBeNull();
  });

  it('returns nothing rather than guessing from marketing copy', () => {
    const result = classifyIndustry(
      'We create experiences that move people. Imagine a space that instantly captivates everyone who enters.',
      'Generic Brand'
    );
    expect(result.industry).toBeNull();
    expect(result.reason).toBe('no-signal');
  });

  it('reports no-text when there is nothing to read', () => {
    expect(classifyIndustry('', '').reason).toBe('no-text');
  });

  it('matches on word boundaries so short terms cannot fire inside longer words', () => {
    // "ai" must not match "available", "stem" must not match "system".
    const result = classifyIndustry('Our system is available to every customer in the region.', 'Nondescript Ltd');
    expect(result.industry).toBeNull();
  });

  it('only ever returns a sector from the published vocabulary', () => {
    const result = classifyIndustry('Managed IT services and IT support for schools.', 'Some Reseller');
    if (result.industry) expect(INDUSTRIES).toContain(result.industry);
  });
});
