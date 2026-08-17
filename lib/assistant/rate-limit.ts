/**
 * In-memory per-IP token bucket. Process-local by design — no dependency.
 *
 * One bucket for the whole assistant. It was deliberately kept separate from
 * the old lib/people/chat-stream.ts bucket so the two endpoints could not
 * consume each other's budget; that transport is now deleted.
 */
const BUCKET_CAPACITY = 20;
const REFILL_PER_SECOND = 0.5;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = buckets.get(key) ?? { tokens: BUCKET_CAPACITY, updatedAt: now };
  const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
  const tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / REFILL_PER_SECOND) };
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetAssistantRateLimiter(): void {
  buckets.clear();
}
