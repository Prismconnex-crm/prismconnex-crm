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
