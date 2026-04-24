import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkApiKey } from "@/lib/auth";

describe("checkApiKey", () => {
  const originalEnv = process.env.AGENT_FOUNDRY_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENT_FOUNDRY_API_KEY;
    } else {
      process.env.AGENT_FOUNDRY_API_KEY = originalEnv;
    }
  });

  it("allows all requests when env var is not set (local dev mode)", () => {
    delete process.env.AGENT_FOUNDRY_API_KEY;
    const req = new Request("http://localhost/api/skills", { method: "POST" });
    expect(checkApiKey(req)).toEqual({ authorized: true });
  });

  it("allows correct Bearer token", () => {
    process.env.AGENT_FOUNDRY_API_KEY = "secret-key";
    const req = new Request("http://localhost/api/skills", {
      method: "POST",
      headers: { Authorization: "Bearer secret-key" },
    });
    expect(checkApiKey(req)).toEqual({ authorized: true });
  });

  it("allows correct X-API-Key header", () => {
    process.env.AGENT_FOUNDRY_API_KEY = "secret-key";
    const req = new Request("http://localhost/api/skills", {
      method: "POST",
      headers: { "X-API-Key": "secret-key" },
    });
    expect(checkApiKey(req)).toEqual({ authorized: true });
  });

  it("rejects wrong token", () => {
    process.env.AGENT_FOUNDRY_API_KEY = "secret-key";
    const req = new Request("http://localhost/api/skills", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    const result = checkApiKey(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("Invalid");
  });

  it("rejects missing header when env var is set", () => {
    process.env.AGENT_FOUNDRY_API_KEY = "secret-key";
    const req = new Request("http://localhost/api/skills", { method: "POST" });
    const result = checkApiKey(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("Missing");
  });
});
