import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure Upstash env vars are absent so we always exercise the in-memory fallback
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("allows first 10 requests", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit("1.2.3.4");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks 11th request", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("1.2.3.5");
    }
    const result = await checkRateLimit("1.2.3.5");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { checkRateLimit } = await import("../rate-limit");

    for (let i = 0; i < 10; i++) {
      await checkRateLimit("1.2.3.6");
    }
    // Still blocked
    expect((await checkRateLimit("1.2.3.6")).allowed).toBe(false);

    // Advance time past window
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    const result = await checkRateLimit("1.2.3.6");
    expect(result.allowed).toBe(true);
  });

  it("different IPs have independent limits", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      await checkRateLimit("10.0.0.1");
    }
    // 10.0.0.1 should be blocked
    expect((await checkRateLimit("10.0.0.1")).allowed).toBe(false);
    // 10.0.0.2 should still be allowed
    expect((await checkRateLimit("10.0.0.2")).allowed).toBe(true);
  });
});
