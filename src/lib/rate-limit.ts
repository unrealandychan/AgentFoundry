/**
 * Rate-limiting layer with serverless-safe persistence.
 *
 * Strategy (in priority order):
 *  1. Upstash Redis  — when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 *     Uses a sliding-window algorithm that survives across serverless cold-starts / replicas.
 *  2. In-memory Map  — fallback for local development or environments without Redis.
 *     Works fine for a single long-running process, but resets on every cold-start.
 *
 * Usage:
 *   const result = await checkRateLimit(ip);
 *   if (!result.allowed) return new Response("Too Many Requests", { status: 429 });
 */

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

// ─── Upstash path ────────────────────────────────────────────────────────────

let _upstashLimiter: import("@upstash/ratelimit").Ratelimit | null = null;

async function getUpstashLimiter(): Promise<
  import("@upstash/ratelimit").Ratelimit | null
> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (_upstashLimiter) return _upstashLimiter;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  _upstashLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
    analytics: false,
    prefix: "af_rl",
  });

  return _upstashLimiter;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const _memStore = new Map<string, RateLimitEntry>();

function checkRateLimitMemory(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();

  // Evict stale entries
  for (const [key, entry] of _memStore.entries()) {
    if (now > entry.resetAt) _memStore.delete(key);
  }

  const entry = _memStore.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_SECONDS * 1_000;
    _memStore.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const limiter = await getUpstashLimiter();

  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(ip);
    return { allowed: success, remaining, resetAt: reset };
  }

  // Graceful fallback — works locally or when Redis is not configured
  return checkRateLimitMemory(ip);
}
