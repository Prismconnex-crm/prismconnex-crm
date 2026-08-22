import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  credentialNotice,
  modelCredentialStatus,
  noteModelAuthFailure,
  noteModelSuccess,
  resetModelCredentialForTests,
} from '@/lib/assistant/model-config';

/**
 * "Missing" is readable from the environment. "Invalid" is not — a key is only
 * known to be bad once the API rejects it — so it is observed from a live 401
 * and remembered against the key that earned it.
 */
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('@anthropic-ai/sdk');
  delete process.env.ANTHROPIC_API_KEY;
  resetModelCredentialForTests();
});

describe('modelCredentialStatus', () => {
  it('reports missing when the variable is unset', () => {
    expect(modelCredentialStatus()).toEqual({ state: 'missing' });
  });

  it('treats a whitespace-only value as missing, matching the Supabase reader', () => {
    process.env.ANTHROPIC_API_KEY = '   ';
    expect(modelCredentialStatus()).toEqual({ state: 'missing' });
  });

  it('reports ok for a set key that has not been rejected', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';
    expect(modelCredentialStatus()).toEqual({ state: 'ok' });
  });

  it('reports invalid after the API rejects that key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';
    noteModelAuthFailure(401);
    expect(modelCredentialStatus()).toEqual({ state: 'invalid', httpStatus: 401 });
  });

  it('clears the rejection after a later call succeeds', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';
    noteModelAuthFailure(401);
    noteModelSuccess();
    expect(modelCredentialStatus()).toEqual({ state: 'ok' });
  });

  it('does not blame a newly pasted key for the old one being rejected', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';
    noteModelAuthFailure(401);

    // Operator pastes a different key. Nothing has rejected THIS one yet, so
    // the banner must not keep accusing it until a call happens to succeed.
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fresh';
    expect(modelCredentialStatus()).toEqual({ state: 'ok' });
  });

  it('ignores non-auth failures — a timeout says nothing about the key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';
    noteModelAuthFailure(529);
    expect(modelCredentialStatus()).toEqual({ state: 'ok' });
  });

  it('reports missing rather than invalid when the key is removed after a rejection', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';
    noteModelAuthFailure(401);
    delete process.env.ANTHROPIC_API_KEY;
    expect(modelCredentialStatus()).toEqual({ state: 'missing' });
  });
});

describe('credentialNotice', () => {
  it('is null when the credential is fine, so callers render nothing', () => {
    expect(credentialNotice({ state: 'ok' })).toBeNull();
  });

  it('names the variable when it is unset', () => {
    const notice = credentialNotice({ state: 'missing' });
    expect(notice).toContain('ANTHROPIC_API_KEY');
    expect(notice).toMatch(/not set/i);
  });

  it('says the key was rejected, not that it is absent', () => {
    const notice = credentialNotice({ state: 'invalid', httpStatus: 401 });
    expect(notice).toContain('401');
    expect(notice).toMatch(/rejected/i);
    // The whole point: a set-but-bad key must not read as an absent one.
    expect(notice).not.toMatch(/not set|not configured/i);
  });

  it('never leaks the key itself', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-supersecret';
    noteModelAuthFailure(401);
    expect(credentialNotice(modelCredentialStatus())).not.toContain('supersecret');
  });
});

describe('createModelClassifier credential reporting', () => {
  /**
   * vi.resetModules() gives the dynamically-imported route.ts a FRESH copy of
   * model-config, with its own module-level `rejectedKey`. The status must
   * therefore be read from that same copy — asserting against this file's
   * static import reads a different instance, which the route never wrote to.
   */
  async function loadClassifierAndConfig() {
    const [route, config] = await Promise.all([
      import('@/lib/assistant/route'),
      import('@/lib/assistant/model-config'),
    ]);
    return { createModelClassifier: route.createModelClassifier, config };
  }

  it('records a 401 so the next status read reports invalid', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';

    // The SDK is loaded through a dynamic import inside the classifier, so the
    // rejection is injected by stubbing that module rather than the network.
    // Registered BEFORE the route import: doMock only affects later imports.
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => {
            throw Object.assign(new Error('API key is invalid.'), { status: 401 });
          },
        };
      },
    }));

    const { createModelClassifier, config } = await loadClassifierAndConfig();

    // Degrades to null rather than throwing — behaviour is unchanged.
    await expect(createModelClassifier()('shows in germany')).resolves.toBeNull();

    expect(config.modelCredentialStatus()).toEqual({ state: 'invalid', httpStatus: 401 });
  }, 30000);

  it('leaves the status ok when the classifier fails for a non-auth reason', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => {
            throw Object.assign(new Error('overloaded'), { status: 529 });
          },
        };
      },
    }));

    const { createModelClassifier, config } = await loadClassifierAndConfig();

    await expect(createModelClassifier()('shows in germany')).resolves.toBeNull();

    expect(config.modelCredentialStatus()).toEqual({ state: 'ok' });
  }, 30000);

  it('clears a remembered rejection once a call succeeds', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-recovering';

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => ({
            content: [{ type: 'tool_use', name: 'route_to_events', input: { region: 'Europe' } }],
          }),
        };
      },
    }));

    const { createModelClassifier, config } = await loadClassifierAndConfig();

    // Rejected on the same instance the route will later clear.
    config.noteModelAuthFailure(401);
    expect(config.modelCredentialStatus()).toEqual({ state: 'invalid', httpStatus: 401 });

    await expect(createModelClassifier()('shows in germany')).resolves.toEqual({
      entity: 'events',
      filters: { region: 'Europe' },
    });

    expect(config.modelCredentialStatus()).toEqual({ state: 'ok' });
  }, 30000);
});
