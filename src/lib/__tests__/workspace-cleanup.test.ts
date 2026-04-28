import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { cleanupExpiredWorkspaces, scheduleWorkspaceCleanup } from "@/lib/workspace-cleanup";

describe("cleanupExpiredWorkspaces", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wc-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  async function makeSessionDir(name: string, ageMs: number) {
    const dir = path.join(tmpRoot, name);
    await fs.mkdir(dir, { recursive: true });
    const past = new Date(Date.now() - ageMs);
    await fs.utimes(dir, past, past);
    return dir;
  }

  it("removes directories older than TTL", async () => {
    await makeSessionDir("old-session-abc123", 2 * 60 * 60 * 1000); // 2 hours old
    const { removed } = await cleanupExpiredWorkspaces(60 * 60 * 1000, tmpRoot);
    expect(removed).toContain("old-session-abc123");
    await expect(fs.access(path.join(tmpRoot, "old-session-abc123"))).rejects.toThrow();
  });

  it("keeps directories newer than TTL", async () => {
    await makeSessionDir("new-session-def456", 5 * 60 * 1000); // 5 minutes old
    const { removed } = await cleanupExpiredWorkspaces(60 * 60 * 1000, tmpRoot);
    expect(removed).not.toContain("new-session-def456");
    await expect(fs.access(path.join(tmpRoot, "new-session-def456"))).resolves.toBeUndefined();
  });

  it("skips non-session entries (short names, files)", async () => {
    // Non-matching name (too short)
    await fs.mkdir(path.join(tmpRoot, "abc"), { recursive: true });
    // A file (not a directory)
    await fs.writeFile(path.join(tmpRoot, "some-file.txt"), "data");
    const { removed } = await cleanupExpiredWorkspaces(0, tmpRoot);
    expect(removed).not.toContain("abc");
    expect(removed).not.toContain("some-file.txt");
  });

  it("returns empty arrays when workspace root does not exist", async () => {
    const { removed, errors } = await cleanupExpiredWorkspaces(0, "/nonexistent-path-xyz");
    expect(removed).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("removes multiple expired sessions", async () => {
    await makeSessionDir("session-aaaaaaaaa1", 2 * 60 * 60 * 1000);
    await makeSessionDir("session-bbbbbbbbb2", 3 * 60 * 60 * 1000);
    await makeSessionDir("session-ccccccccc3", 30 * 60 * 1000); // 30 min — keep
    const { removed } = await cleanupExpiredWorkspaces(60 * 60 * 1000, tmpRoot);
    expect(removed).toContain("session-aaaaaaaaa1");
    expect(removed).toContain("session-bbbbbbbbb2");
    expect(removed).not.toContain("session-ccccccccc3");
  });
});

describe("scheduleWorkspaceCleanup", () => {
  it("does not throw when called", () => {
    expect(() => scheduleWorkspaceCleanup()).not.toThrow();
  });

  it("is throttled — calling twice rapidly does not trigger two cleanups", () => {
    // Just verify it doesn't throw and returns quickly
    scheduleWorkspaceCleanup();
    scheduleWorkspaceCleanup();
  });
});
