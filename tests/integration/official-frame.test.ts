import { describe, expect, it } from 'vitest';
import { UNCHECKED, frameVerdict, officialViewMode } from '@/lib/find-shows/official-frame';

// Whether an official exhibitor page may be shown inside Prismconnex: read from the official site's own headers.

const ORIGIN = 'https://app.prismconnex.com';
const page = (headers: Record<string, string> = {}, status = 200, url = 'https://show.example/exhibitors/acme') => ({ status, url, headers });

describe('official pages inside Prismconnex', () => {
  it('frames a page that sets no framing restriction', () => {
    expect(frameVerdict(page(), ORIGIN)).toEqual({ frame: 'allowed', reason: null });
  });

  it('respects X-Frame-Options', () => {
    expect(frameVerdict(page({ 'x-frame-options': 'DENY' }), ORIGIN).frame).toBe('blocked');
    expect(frameVerdict(page({ 'x-frame-options': 'SAMEORIGIN' }), ORIGIN).reason).toContain('X-Frame-Options');
  });

  it('respects CSP frame-ancestors, which takes precedence over X-Frame-Options', () => {
    expect(frameVerdict(page({ 'content-security-policy': "default-src 'self'; frame-ancestors 'self'" }), ORIGIN).frame).toBe('blocked');
    expect(frameVerdict(page({ 'content-security-policy': "frame-ancestors 'none'" }), ORIGIN).frame).toBe('blocked');
    expect(frameVerdict(page({ 'content-security-policy': 'frame-ancestors *' }), ORIGIN).frame).toBe('allowed');
    expect(frameVerdict(page({ 'content-security-policy': 'frame-ancestors https://*.prismconnex.com', 'x-frame-options': 'DENY' }), ORIGIN).frame).toBe('allowed');
    expect(frameVerdict(page({ 'content-security-policy': 'frame-ancestors https://partner.example' }), ORIGIN).frame).toBe('blocked');
    // A policy without frame-ancestors says nothing about framing.
    expect(frameVerdict(page({ 'content-security-policy': "default-src 'self'" }), ORIGIN).frame).toBe('allowed');
  });

  it('does not frame a page kept behind the official site’s own sign-in, or one that is gone', () => {
    expect(frameVerdict(page({}, 200, 'https://show.example/login?returnUrl=%2Fexhibitors%2Facme'), ORIGIN)).toMatchObject({ frame: 'blocked', reason: expect.stringContaining('signed in') });
    expect(frameVerdict(page({}, 401), ORIGIN).frame).toBe('blocked');
    expect(frameVerdict(page({}, 404), ORIGIN).frame).toBe('blocked');
  });

  it('does not confirm what could not be checked — a bot wall, a refusal, a server error — and says why', () => {
    expect(frameVerdict({ ...page({}, 403), challenged: true }, ORIGIN)).toEqual({ frame: 'unknown', reason: UNCHECKED.botWall });
    expect(frameVerdict(page({}, 202), ORIGIN)).toEqual({ frame: 'unknown', reason: UNCHECKED.botWall });
    expect(frameVerdict(page({}, 503), ORIGIN)).toEqual({ frame: 'unknown', reason: UNCHECKED.unreachable });
  });

  it('frames a confirmed page, tries an unconfirmed one, and explains only a confirmed refusal', () => {
    expect(officialViewMode(frameVerdict(page(), ORIGIN).frame)).toBe('frame');
    // Bot protection, a refusal to answer, a server error: not a refusal to be framed — the browser decides.
    expect(officialViewMode(frameVerdict({ ...page({}, 403), challenged: true }, ORIGIN).frame)).toBe('try-frame');
    expect(officialViewMode(frameVerdict(page({}, 202), ORIGIN).frame)).toBe('try-frame');
    expect(officialViewMode(frameVerdict(page({}, 503), ORIGIN).frame)).toBe('try-frame');
    expect(officialViewMode(frameVerdict(page({ 'x-frame-options': 'DENY' }), ORIGIN).frame)).toBe('fallback');
    expect(officialViewMode(frameVerdict(page({ 'content-security-policy': "frame-ancestors 'self'" }), ORIGIN).frame)).toBe('fallback');
    expect(officialViewMode(frameVerdict(page({}, 401), ORIGIN).frame)).toBe('fallback');
  });
});
