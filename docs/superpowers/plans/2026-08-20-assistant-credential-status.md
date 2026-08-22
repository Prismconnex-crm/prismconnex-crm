# Assistant Model Credential Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the assistant say which credential problem it actually has — unset versus rejected — instead of reporting a present-but-invalid key as "not configured".

**Architecture:** One new pure module, `lib/assistant/model-config.ts`, owns the credential status. "Missing" is read from the environment; "invalid" cannot be known without calling the API, so it is *observed* — `createModelClassifier` reports a 401/403 back to the module, and the next request reads it. The status is surfaced to admins only. The legacy Companies pane is fixed separately, because it already receives the right reason from its route and merely discards it.

**Tech Stack:** TypeScript, Next.js 14 App Router, Vitest (node environment, `@/` alias), `@anthropic-ai/sdk` (loaded via dynamic import at request time).

## Global Constraints

- Model stays `claude-sonnet-5` in `lib/assistant/route.ts`. Do not change it.
- `ANTHROPIC_API_KEY` is server-side only. It must never be added to a `NEXT_PUBLIC_` variable, a client component, or a response payload. Only the derived *notice text* crosses to the client, and only for admins.
- Never include the key, or any part of it, in a log line or an error message.
- No new npm dependency.
- The suite must pass without a valid API key — every test mocks the model.
- A missing or rejected key must keep degrading to the existing keyword fallback. This work changes diagnostics, never behaviour.
- Existing assistant tests (12 files, `tests/integration/assistant-*.test.ts`) must stay green.

---

### Task 1: The credential status module

**Files:**
- Create: `lib/assistant/model-config.ts`
- Test: `tests/integration/assistant-model-config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ModelCredentialStatus = { state: 'ok' } | { state: 'missing' } | { state: 'invalid'; httpStatus: number }`
  - `modelCredentialStatus(): ModelCredentialStatus`
  - `noteModelAuthFailure(httpStatus: number): void`
  - `noteModelSuccess(): void`
  - `credentialNotice(status: ModelCredentialStatus): string | null`
  - `resetModelCredentialForTests(): void`

- [x] **Step 1: Write the failing test**

Create `tests/integration/assistant-model-config.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-model-config.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/model-config"`.

- [x] **Step 3: Write minimal implementation**

Create `lib/assistant/model-config.ts`:

```typescript
/**
 * The single reader for ANTHROPIC_API_KEY's usability.
 *
 * `lib/assistant/route.ts` previously asked `Boolean(process.env.ANTHROPIC_API_KEY)`,
 * which answers "is the variable non-empty" and calls that "configured". A key
 * that is present and rejected therefore reported as configured, failed at call
 * time, and surfaced to the user as "not configured" — naming the wrong cause
 * and sending the reader to the wrong file.
 *
 * Two states are distinguishable, and only one of them is readable up front:
 *
 *   missing — the variable is unset or blank. Known from the environment.
 *   invalid — the variable is set and the API rejected it. NOT knowable without
 *             calling, so it is observed: the classifier reports a 401/403 here
 *             and the next request reads it back.
 *
 * There is deliberately no startup probe. The app must boot without network.
 *
 * Server-only. The key never leaves this module — callers get a status and a
 * notice string, never the value.
 */

export type ModelCredentialStatus =
  | { state: 'ok' }
  | { state: 'missing' }
  | { state: 'invalid'; httpStatus: number };

/** Trimmed, so a whitespace-only value reads as missing — as in lib/supabase/config.ts. */
function readKey(): string {
  const value = process.env.ANTHROPIC_API_KEY;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The key that was rejected, and with what.
 *
 * Stored as the key itself rather than a bare flag so that pasting a new key
 * clears the accusation immediately. With a flag, a fresh key would keep
 * reporting invalid until a call happened to succeed — which is exactly the
 * stale-diagnostic problem this module exists to end.
 */
let rejectedKey: string | null = null;
let rejectedStatus = 0;

/** Records an auth rejection. Non-auth failures say nothing about the key. */
export function noteModelAuthFailure(httpStatus: number): void {
  if (httpStatus !== 401 && httpStatus !== 403) return;
  rejectedKey = readKey();
  rejectedStatus = httpStatus;
}

/** A successful call proves the current key is good. */
export function noteModelSuccess(): void {
  rejectedKey = null;
  rejectedStatus = 0;
}

export function modelCredentialStatus(): ModelCredentialStatus {
  const key = readKey();
  if (!key) return { state: 'missing' };
  if (rejectedKey !== null && rejectedKey === key) {
    return { state: 'invalid', httpStatus: rejectedStatus };
  }
  return { state: 'ok' };
}

/**
 * Operator-facing copy. Null when there is nothing wrong, so a caller can
 * render the result directly without re-testing the state.
 */
export function credentialNotice(status: ModelCredentialStatus): string | null {
  switch (status.state) {
    case 'ok':
      return null;
    case 'missing':
      return (
        'AI search is falling back to keyword search: ANTHROPIC_API_KEY is not set. ' +
        'Add it to .env.local and restart the dev server.'
      );
    case 'invalid':
      return (
        `AI search is falling back to keyword search: the configured ANTHROPIC_API_KEY ` +
        `was rejected by Anthropic (HTTP ${status.httpStatus}). The variable is set — ` +
        `the key itself is not valid. Replace it with a working key from ` +
        `console.anthropic.com.`
      );
  }
}

/** Test seam — clears the observed rejection between cases. */
export function resetModelCredentialForTests(): void {
  rejectedKey = null;
  rejectedStatus = 0;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/assistant-model-config.test.ts`
Expected: PASS — 12 tests.

- [x] **Step 5: Commit**

```bash
git add lib/assistant/model-config.ts tests/integration/assistant-model-config.test.ts
git commit -m "feat(assistant): distinguish an unset key from a rejected one"
```

---

### Task 2: Report auth outcomes from the classifier

**Files:**
- Modify: `lib/assistant/route.ts` (`isConfigured` at :24-26, `createModelClassifier` at :107-150)
- Test: `tests/integration/assistant-model-config.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `noteModelAuthFailure`, `noteModelSuccess`, `modelCredentialStatus` from Task 1.
- Produces: `isConfigured()` keeps its signature and call sites; it now delegates to `modelCredentialStatus()`.

- [x] **Step 1: Write the failing test**

Append to `tests/integration/assistant-model-config.test.ts`:

```typescript
describe('createModelClassifier credential reporting', () => {
  it('records a 401 so the next status read reports invalid', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-rejected';

    const { createModelClassifier } = await import('@/lib/assistant/route');

    // The SDK is loaded through a dynamic import inside the classifier, so the
    // rejection is injected by stubbing that module rather than the network.
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => {
            throw Object.assign(new Error('API key is invalid.'), { status: 401 });
          },
        };
      },
    }));

    const classify = createModelClassifier();
    // Degrades to null rather than throwing — behaviour is unchanged.
    await expect(classify('shows in germany')).resolves.toBeNull();

    expect(modelCredentialStatus()).toEqual({ state: 'invalid', httpStatus: 401 });
  });

  it('leaves the status ok when the classifier fails for a non-auth reason', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';

    const { createModelClassifier } = await import('@/lib/assistant/route');

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: async () => {
            throw Object.assign(new Error('overloaded'), { status: 529 });
          },
        };
      },
    }));

    const classify = createModelClassifier();
    await expect(classify('shows in germany')).resolves.toBeNull();

    expect(modelCredentialStatus()).toEqual({ state: 'ok' });
  });
});
```

Add `vi` to the vitest import at the top of the file:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
```

And add `vi.resetModules()` plus `vi.doUnmock('@anthropic-ai/sdk')` to the existing `beforeEach`:

```typescript
beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('@anthropic-ai/sdk');
  delete process.env.ANTHROPIC_API_KEY;
  resetModelCredentialForTests();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-model-config.test.ts`
Expected: FAIL — the 401 case reports `{ state: 'ok' }`, because nothing records the rejection yet.

- [x] **Step 3: Write minimal implementation**

In `lib/assistant/route.ts`, add to the imports at the top:

```typescript
import {
  modelCredentialStatus,
  noteModelAuthFailure,
  noteModelSuccess,
} from './model-config';
```

Replace `isConfigured` (currently lines 24-26):

```typescript
/**
 * Kept for its existing call sites. "Configured" now means the credential is
 * usable, not merely present — a key the API has rejected is not configured in
 * any sense the caller cares about.
 */
export function isConfigured(): boolean {
  return modelCredentialStatus().state === 'ok';
}
```

In `createModelClassifier`, record the outcome. After the `response` is awaited and before the content loop:

```typescript
      // Proves the current key works; clears any remembered rejection.
      noteModelSuccess();

      for (const block of response.content) {
```

And in the `catch`, before `logClassifierFailure(error)`:

```typescript
    } catch (error) {
      // A 401/403 is a fact about the credential, not just this request, so it
      // outlives the call. Everything else stays a one-off failure.
      noteModelAuthFailure((error as { status?: number } | null)?.status ?? 0);

      // Any failure degrades to the deterministic classifier rather than
      // surfacing an error — but it is logged, because a bad key, a 404 and a
      // timeout are otherwise indistinguishable from a genuine no-tool-call.
      logClassifierFailure(error);
      return null;
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-model-config.test.ts tests/integration/assistant-route.test.ts`
Expected: PASS — the new file's 14 tests plus the existing route tests, unchanged.

- [x] **Step 5: Commit**

```bash
git add lib/assistant/route.ts tests/integration/assistant-model-config.test.ts
git commit -m "feat(assistant): remember a rejected key so the status can report it"
```

---

### Task 3: Surface the notice to admins only

**Files:**
- Modify: `app/api/assistant/chat/route.ts` (`POST` at :44)
- Test: `tests/integration/assistant-credential-notice.test.ts`

**Interfaces:**
- Consumes: `credentialNotice`, `modelCredentialStatus` from Task 1; `resolveTenant` from `@/lib/auth/tenant`; `Role` from `@/lib/rbac/authorize`.
- Produces: the chat response may carry `credentialNotice: string` — present only for `ADMIN`, absent for every other role and for unauthenticated callers.

- [x] **Step 1: Write the failing test**

Create `tests/integration/assistant-credential-notice.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetModelCredentialForTests } from '@/lib/assistant/model-config';

/**
 * The notice names a server-side configuration fault, so it is admin-only. The
 * gate is server-side: a non-admin must not be able to read the text out of the
 * payload, which rules out shipping it and hiding it in CSS.
 *
 * The fallback itself is NOT gated — every role keeps getting keyword results.
 * Only the explanation is privileged.
 */
const mocks = vi.hoisted(() => ({
  resolveTenant: vi.fn(),
}));

vi.mock('@/lib/auth/tenant', () => ({
  resolveTenant: mocks.resolveTenant,
}));

beforeEach(() => {
  vi.resetModules();
  resetModelCredentialForTests();
  delete process.env.ANTHROPIC_API_KEY; // -> state: 'missing'
  mocks.resolveTenant.mockReset();
});

async function post(body: unknown) {
  const { POST } = await import('@/app/api/assistant/chat/route');
  const response = await POST(
    new Request('http://localhost/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, text: await response.text() };
}

describe('credential notice gating', () => {
  it('includes the notice for an admin', async () => {
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
      workspaceId: 'w1',
      role: 'ADMIN',
    });

    const { text } = await post({ message: 'shows in germany', currentPage: 'events' });

    expect(text).toContain('ANTHROPIC_API_KEY');
  });

  it('omits it entirely for a non-admin — not merely hidden', async () => {
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u2',
      email: 'b@example.com',
      workspaceId: 'w1',
      role: 'SALES_REP',
    });

    const { text } = await post({ message: 'shows in germany', currentPage: 'events' });

    expect(text).not.toContain('ANTHROPIC_API_KEY');
    expect(text).not.toContain('credentialNotice');
  });

  it('omits it when there is no session at all', async () => {
    // resolveTenant RESOLVES null for a signed-out caller — it does not throw.
    // Reading .role off that null is the obvious way to break this route.
    mocks.resolveTenant.mockResolvedValue(null);

    const { text } = await post({ message: 'shows in germany', currentPage: 'events' });

    expect(text).not.toContain('ANTHROPIC_API_KEY');
  });

  it('still answers when the credential is fine, with no notice', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid';
    mocks.resolveTenant.mockResolvedValue({
      userId: 'u1',
      email: 'a@example.com',
      workspaceId: 'w1',
      role: 'ADMIN',
    });

    const { status, text } = await post({ message: 'shows in germany', currentPage: 'events' });

    expect(status).toBe(200);
    expect(text).not.toContain('credentialNotice');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/assistant-credential-notice.test.ts`
Expected: FAIL — the admin case does not contain `ANTHROPIC_API_KEY`, because the route emits no notice.

- [x] **Step 3: Write minimal implementation**

In `app/api/assistant/chat/route.ts`, add imports:

```typescript
import { credentialNotice, modelCredentialStatus } from '@/lib/assistant/model-config';
import { resolveTenant } from '@/lib/auth/tenant';
import { Role } from '@/lib/rbac/authorize';
```

Add this helper above `POST`:

```typescript
/**
 * The notice describes a server misconfiguration, so only an admin sees it.
 *
 * This route is deliberately not tenant-gated — the assistant answers from
 * shared catalogs — and adding an auth requirement here would change who can
 * use it. The tenant lookup exists solely to decide whether to EXPLAIN the
 * degradation, never whether to answer.
 *
 * `resolveTenant()` resolves `null` for a signed-out caller rather than
 * throwing (lib/auth/tenant.ts:37), so the null branch is the normal path for
 * anonymous use, not an error case. The try/catch is for database trouble
 * underneath it: a failed lookup must cost the caller a notice, never a reply.
 */
async function adminCredentialNotice(): Promise<string | null> {
  const notice = credentialNotice(modelCredentialStatus());
  if (!notice) return null;

  try {
    const tenant = await resolveTenant();
    return tenant?.role === Role.ADMIN ? notice : null;
  } catch {
    return null;
  }
}
```

Then, in `POST`, compute it and attach it to the response body. Immediately before the route builds its successful response, add:

```typescript
    const notice = await adminCredentialNotice();
```

and spread it into the response payload, so the key is absent rather than null when there is nothing to say:

```typescript
      ...(notice ? { credentialNotice: notice } : {}),
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/assistant-credential-notice.test.ts`
Expected: PASS — 4 tests.

Then confirm nothing regressed:

Run: `npx vitest run --no-file-parallelism tests/integration/assistant-route.test.ts tests/integration/assistant-stream.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/api/assistant/chat/route.ts tests/integration/assistant-credential-notice.test.ts
git commit -m "feat(assistant): explain a degraded classifier to admins only"
```

---

### Task 4: Stop the Companies pane discarding the reason

**Files:**
- Modify: `components/crm/companies-section.tsx` (state at :642, handler at :881-897, JSX at :1230-1234)

**Interfaces:**
- Consumes: the existing `/api/companies/ask` response, which already returns
  `{ intent: 'unavailable', reason: 'missing_api_key' | 'invalid_api_key' }`
  (see `app/api/companies/ask/route.ts`). Nothing server-side changes.
- Produces: nothing other tasks depend on.

**Why this is separate:** this pane is deleted in Phase 3 (Spec 3b). It is fixed
now anyway because it is the box the user actually sees, and the fix is three
small edits to code that already has the right data — the route computes
`invalid_api_key` correctly via `describeAssistantFailure` and the client throws
it away.

- [x] **Step 1: Widen the state from a boolean to the reason**

Replace line 642:

```tsx
  const [askUnavailable, setAskUnavailable] = useState(false);
```

with:

```tsx
  /**
   * Null when fine, otherwise WHY the assistant is unavailable. Was a boolean,
   * which is what forced the message to hardcode one cause: the route sends
   * `reason: 'invalid_api_key'` for a key the API rejected, and a boolean has
   * nowhere to put it, so a set-but-invalid key read as "not configured".
   */
  const [askUnavailable, setAskUnavailable] = useState<
    null | "missing_api_key" | "invalid_api_key"
  >(null);
```

- [x] **Step 2: Keep the reason when the request comes back**

Replace line 881:

```tsx
      setAskUnavailable(false);
```

with:

```tsx
      setAskUnavailable(null);
```

Replace lines 895-897:

```tsx
          if (result?.intent === "unavailable") {
            setAskUnavailable(true);
          }
```

with:

```tsx
          if (result?.intent === "unavailable") {
            setAskUnavailable(
              result.reason === "invalid_api_key" ? "invalid_api_key" : "missing_api_key"
            );
          }
```

- [x] **Step 3: Render the reason the route actually sent**

Replace lines 1230-1234:

```tsx
            {askUnavailable ? (
              <p className="mt-2 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                Event search is unavailable — ANTHROPIC_API_KEY is not configured.
              </p>
            ) : null}
```

with:

```tsx
            {askUnavailable ? (
              <p className="mt-2 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                {askUnavailable === "invalid_api_key"
                  ? "Event search is unavailable — the configured ANTHROPIC_API_KEY was rejected (HTTP 401). The variable is set; the key itself is not valid."
                  : "Event search is unavailable — ANTHROPIC_API_KEY is not set."}
              </p>
            ) : null}
```

- [x] **Step 4: Verify the whole thing compiles and lints**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`.

- [x] **Step 5: Commit**

```bash
git add components/crm/companies-section.tsx
git commit -m "fix(companies): report a rejected key as rejected, not absent"
```

---

### Task 5: Full-suite verification

**Files:** none modified.

- [x] **Step 1: Run the full suite sequentially**

Run: `npx vitest run --no-file-parallelism`

Sequential is deliberate: `tests/integration/password-reset.test.ts` has a known
flake in its fetch-call-count assertions when the machine is under heavy
parallel I/O. It is unrelated to this work and must not be "fixed" by editing
`services/auth.service.ts`, which awaits correctly.

Expected: all files pass.

- [~] **Step 2: Confirm the key never reaches the client bundle** — SKIPPED, deliberately

Not run: CLAUDE.md forbids `npm run build` unless explicitly asked (the C:
drive has filled and frozen the machine before), and the owner confirmed the
skip on 2026-08-22.

Verified statically instead, which is sufficient here:
- `lib/assistant/model-config.ts` is imported by exactly two server modules —
  `app/api/assistant/chat/route.ts` and `lib/assistant/route.ts`.
- No `'use client'` file imports model-config, `lib/assistant/route.ts` or
  `lib/assistant/stream.ts`.
- The module never returns the key: callers get a status and a notice string.
- Next.js only inlines `NEXT_PUBLIC_*` into client bundles; a bare
  `process.env.ANTHROPIC_API_KEY` in client code compiles to `undefined`.

Run the build+grep whenever one is being done anyway, as confirmation.

- [x] **Step 3: Commit nothing; report**

No commit. Report the suite result, the build result, and the grep result.

Note for the reporter: a green suite is **not** evidence that live classification
works. Every test here mocks the SDK. The live model path stays unverified until
a valid `ANTHROPIC_API_KEY` is present — at which point the intended manual check
is to ask the assistant a cross-entity question and confirm no notice appears.

---

## Execution notes (2026-08-22)

Two places where the plan as written could not be followed literally. Both are
worth knowing before Phase 4, which adds two more modules of the same shape.

**Task 3 delivered the notice as a stream event, not a JSON field.** The plan
said to spread `...(notice ? { credentialNotice: notice } : {})` "into the
response payload". There is no payload: `POST /api/assistant/chat` returns an
NDJSON `ReadableStream`, and its own header comment requires that an assistant
problem reach the client as a stream event so there is exactly one code path.
So `AssistantEvent` gained `{ type: 'notice'; text: string }`, emitted straight
after the `route` verdict — which keeps its place as the first event — so the
confirm, navigate and inline branches all carry it.

That change had a consequence the plan could not have anticipated: the client
reducer's final `return` is an unguarded fall-through meaning "done". Any event
it does not match explicitly ends the turn — marking the message complete and
clearing `isStreaming`. A `notice` arriving mid-stream would therefore truncate
the very answer it annotates. `conversation-reducer.ts` now matches `'notice'`
explicitly, with tests covering it.

**The classifier tests must read status from the route's own module instance.**
The plan's Task 2 test asserts on a statically imported `modelCredentialStatus`
while `beforeEach` calls `vi.resetModules()` and then dynamically imports
`route.ts`. That gives route.ts a *fresh* `model-config` with its own
`rejectedKey`, so the route writes to one instance and the test reads another —
both assertions fail as exact mirror images. The tests now import model-config
in the same tick as route.ts and assert against that copy.

**This trap applies directly to Phase 4.** `cache.ts` and `query-log.ts` are
both specced as process-local module state, exactly like `rejectedKey`. Any test
that combines `vi.resetModules()` with a dynamic import will silently get two
copies of them. The cheaper habit, used by `assistant-credential-notice.test.ts`
and the twelve older assistant files: skip `resetModules` entirely, use static
imports and the `setAdapterForTests` / `resetAdapters` seam.

**Cost of `vi.resetModules()` here.** Re-importing `lib/assistant/route.ts`
re-transforms its whole adapter graph — measured at ~12s cold, which overruns
vitest's 5s default. The three tests that need it carry an explicit 30s timeout.

**Every test mocks the SDK.** A test that merely sets a set-looking
`ANTHROPIC_API_KEY` makes the stream construct a real client and call Anthropic
for real. `assistant-credential-notice.test.ts` stubs `@anthropic-ai/sdk` at
module level; without it that file spent ~3.6s on live network calls.
