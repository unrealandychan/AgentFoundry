/**
 * Workspace cleanup utility for /tmp session directories.
 *
 * Session directories are created under /tmp/<sessionId> by:
 *   - /api/workspace/upload  (file uploads)
 *   - /api/test-agent        (reads workspace files for context)
 *
 * Without cleanup, these accumulate indefinitely on long-running servers.
 * This module provides:
 *   - cleanupExpiredWorkspaces()  — removes dirs older than TTL_MS (default 1h)
 *   - scheduleWorkspaceCleanup() — runs cleanup lazily, at most once per INTERVAL_MS
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOT = "/tmp";
const SESSION_DIR_PATTERN = /^[\w-]{8,128}$/; // matches sessionId format
const TTL_MS = 60 * 60 * 1000; // 1 hour
const INTERVAL_MS = 10 * 60 * 1000; // run at most every 10 minutes

let lastCleanupAt = 0;

/**
 * Remove all /tmp/<sessionId> directories whose mtime is older than TTL_MS.
 * Safe to call concurrently — individual rm errors are swallowed.
 */
export async function cleanupExpiredWorkspaces(
  ttlMs = TTL_MS,
  workspaceRoot = WORKSPACE_ROOT
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];
  const now = Date.now();

  let entries: string[];
  try {
    entries = await fs.readdir(workspaceRoot);
  } catch {
    return { removed, errors };
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!SESSION_DIR_PATTERN.test(entry)) return;
      const dirPath = path.join(workspaceRoot, entry);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) return;
        const ageMs = now - stat.mtimeMs;
        if (ageMs > ttlMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          removed.push(entry);
        }
      } catch (error) {
        errors.push(`${entry}: ${String(error)}`);
      }
    })
  );

  return { removed, errors };
}

/**
 * Schedule a lazy cleanup — runs at most once per INTERVAL_MS.
 * Call this at the end of any request handler that uses /tmp workspaces.
 * Fire-and-forget: does not await, never throws.
 */
export function scheduleWorkspaceCleanup(): void {
  const now = Date.now();
  if (now - lastCleanupAt < INTERVAL_MS) return;
  lastCleanupAt = now;

  // Run in background — intentionally not awaited
  cleanupExpiredWorkspaces().catch(() => {
    // silent — cleanup failures must never affect request responses
  });
}
