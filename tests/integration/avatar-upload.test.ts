import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression cover for "Could not upload the image. Please try again." — the
 * generic message every avatar failure used to collapse into.
 *
 * The root cause it guards: Supabase Storage does NOT put the real code in the
 * HTTP status. A missing bucket answers `HTTP 400` with the actual code buried
 * in the JSON body:
 *
 *     {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
 *
 * so branching on `res.status === 404` never matched and the diagnostic
 * messages were unreachable. These tests drive the mapping from the BODY, which
 * is the only place the truth lives.
 */

const ENV = {
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
};

/**
 * Stubs fetch with a Supabase Storage error: HTTP 400 outside, the real code
 * inside.
 *
 * A fresh Response per call, not mockResolvedValue — a Response body can only
 * be read once, so a shared instance makes the second call look like an empty
 * body and quietly changes what is under test.
 */
function stubStorageError(httpStatus: number, body: Record<string, string>) {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: httpStatus,
        headers: { 'content-type': 'application/json' },
      })
  );

  vi.stubGlobal('fetch', mock);
  return mock;
}

function pngFile(size = 1024) {
  return {
    type: 'image/png',
    size,
    arrayBuffer: async () => new ArrayBuffer(size),
  };
}

const USER_ID = '3f7c1e2a-0000-4000-8000-abcdefabcdef';

async function upload(file = pngFile()) {
  const { uploadAvatar } = await import('@/lib/supabase/storage');
  return uploadAvatar({ accessToken: 'user-access-token', userId: USER_ID, file });
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('uploadAvatar — error mapping', () => {
  it('names the missing bucket when Storage reports NoSuchBucket as HTTP 400', async () => {
    stubStorageError(400, {
      statusCode: '404',
      error: 'Bucket not found',
      message: 'Bucket not found',
      code: 'NoSuchBucket',
    });

    await expect(upload()).rejects.toThrow(/not configured|bucket/i);
    await expect(upload()).rejects.toThrow(/003_avatars_storage\.sql/);
  });

  it('reports an RLS rejection as a permission problem, not a generic retry', async () => {
    stubStorageError(400, {
      statusCode: '403',
      error: 'Unauthorized',
      message: 'new row violates row-level security policy',
    });

    await expect(upload()).rejects.toThrow(/not authorized/i);
  });

  it("maps the bucket's own size rejection to the size message", async () => {
    stubStorageError(413, {
      statusCode: '413',
      error: 'Payload too large',
      message: 'The object exceeded the maximum allowed size',
    });

    await expect(upload()).rejects.toThrow(/larger than 5 MB/i);
  });

  it("maps the bucket's own mime rejection to the format message", async () => {
    stubStorageError(415, {
      statusCode: '415',
      error: 'invalid_mime_type',
      message: 'mime type image/svg+xml is not supported',
    });

    await expect(upload()).rejects.toThrow(/unsupported image format/i);
  });

  it('logs the real Supabase error for the developer', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubStorageError(400, { statusCode: '404', code: 'NoSuchBucket', message: 'Bucket not found' });

    await upload().catch(() => {});

    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).toContain('NoSuchBucket');
  });

  it('still falls back to a retry message for an unrecognised failure', async () => {
    stubStorageError(500, { message: 'internal' });

    await expect(upload()).rejects.toThrow(/try again/i);
  });
});

describe('uploadAvatar — success', () => {
  it("writes under the caller's own user id and returns the public URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { publicUrl, objectKey } = await upload();

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain(`/storage/v1/object/avatars/${USER_ID}/`);
    expect(objectKey.startsWith(`${USER_ID}/`)).toBe(true);
    expect(publicUrl).toBe(`${ENV.SUPABASE_URL}/storage/v1/object/public/avatars/${objectKey}`);

    // The user's token, not the anon key, is what the RLS policy checks.
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-access-token');
  });
});

describe('assertUploadableAvatar', () => {
  it('accepts JPG, JPEG, PNG and WebP', async () => {
    const { assertUploadableAvatar } = await import('@/lib/supabase/storage');

    expect(assertUploadableAvatar({ type: 'image/jpeg', size: 10 })).toBe('jpg');
    expect(assertUploadableAvatar({ type: 'image/png', size: 10 })).toBe('png');
    expect(assertUploadableAvatar({ type: 'image/webp', size: 10 })).toBe('webp');
  });

  it('rejects an unsupported format with a readable message', async () => {
    const { assertUploadableAvatar } = await import('@/lib/supabase/storage');

    expect(() => assertUploadableAvatar({ type: 'application/pdf', size: 10 })).toThrow(
      /unsupported image format/i
    );
  });

  it('rejects a file over 5 MB', async () => {
    const { assertUploadableAvatar, MAX_AVATAR_BYTES } = await import('@/lib/supabase/storage');

    expect(MAX_AVATAR_BYTES).toBe(5 * 1024 * 1024);
    expect(() => assertUploadableAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toThrow(
      /larger than 5 MB/i
    );
  });

  it('rejects an empty file', async () => {
    const { assertUploadableAvatar } = await import('@/lib/supabase/storage');

    expect(() => assertUploadableAvatar({ type: 'image/png', size: 0 })).toThrow(/empty/i);
  });
});
