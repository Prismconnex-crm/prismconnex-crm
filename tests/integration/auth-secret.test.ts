import { afterEach, describe, expect, it, vi } from 'vitest';
import { signLocalSession, verifyLocalSession } from '@/lib/auth';

const payload = { sub: 'user-1', email: 'a@b.com', workspaceId: 'ws-1' };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('session signing secret', () => {
  it('refuses to sign a session in production when AUTH_SECRET is unset', async () => {
    // With the old hardcoded fallback, anyone who read the source could mint a
    // valid pcx_session for any user on a misconfigured deploy.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');

    await expect(signLocalSession(payload)).rejects.toThrow(/AUTH_SECRET/);
  });

  it('refuses to verify a session in production when AUTH_SECRET is unset', async () => {
    vi.stubEnv('AUTH_SECRET', 'a-real-secret-that-is-long-enough-000');
    const token = await signLocalSession(payload);

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');

    await expect(verifyLocalSession(token)).rejects.toThrow(/AUTH_SECRET/);
  });

  it('still signs with the dev fallback outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_SECRET', '');

    const token = await signLocalSession(payload);
    await expect(verifyLocalSession(token)).resolves.toMatchObject({ sub: 'user-1' });
  });
});
