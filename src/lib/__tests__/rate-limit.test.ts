import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to reset module state between tests, so we use vi.isolateModules or just reset manually.
// Instead, let's mock Date.now and re-import for isolation using dynamic imports.

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("allows first 10 requests", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit("1.2.3.4");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks 11th request", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      checkRateLimit("1.2.3.5");
    }
    const result = checkRateLimit("1.2.3.5");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { checkRateLimit } = await import("../rate-limit");

    for (let i = 0; i < 10; i++) {
      checkRateLimit("1.2.3.6");
    }
    // Still blocked
    expect(checkRateLimit("1.2.3.6").allowed).toBe(false);

    // Advance time past window
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    const result = checkRateLimit("1.2.3.6");
    expect(result.allowed).toBe(true);
  });

  it("different IPs have independent limits", async () => {
    const { checkRateLimit } = await import("../rate-limit");
    for (let i = 0; i < 10; i++) {
      checkRateLimit("10.0.0.1");
    }
    // 10.0.0.1 should be blocked
    expect(checkRateLimit("10.0.0.1").allowed).toBe(false);
    // 10.0.0.2 should still be allowed
    expect(checkRateLimit("10.0.0.2").allowed).toBe(true);
  });
});
