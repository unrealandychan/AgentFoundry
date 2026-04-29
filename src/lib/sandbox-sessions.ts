/**
 * sandbox-sessions.ts  — dual-layer persistence for Skill Sandbox sessions.
 *
 * Problem (issue #35):
 *   The original implementation stored sessions ONLY in localStorage.
 *   Clearing browser storage, switching browsers, or opening a private tab
 *   silently discarded all history.
 *
 * Solution — two-layer strategy:
 *   1. Server API  (/api/sandbox/sessions)  — source of truth.
 *      Backed by the same storage adapter as SkillStore (file / S3 / MongoDB).
 *      Survives browser clears, tab switches, and private browsing.
 *
 *   2. localStorage cache — optimistic UI.
 *      Written immediately on every mutation so the UI feels instant.
 *      Hydrated from the server on first load; acts as a fallback when the
 *      server is unreachable.
 *
 * API availability:
 *   Server calls are fire-and-forget for writes (we never await them in the
 *   hot path) so latency is invisible to the user.  Reads always try the server
 *   first and fall back to the local cache.
 */

import type { SandboxSession, SandboxMessage } from "@/types";

// ─── localStorage cache ────────────────────────────────────────────────────────

const STORAGE_KEY = "agentfoundry_sandbox_sessions_v1";
const MAX_SESSIONS = 50;

function localLoad(): SandboxSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SandboxSession[];
  } catch {
    return [];
  }
}

function localSave(sessions: SandboxSession[]): void {
  if (typeof window === "undefined") return;
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // QuotaExceededError — evict oldest sessions and retry once
    const smaller = trimmed.slice(0, Math.floor(trimmed.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller));
    } catch {
      /* silent — server remains the source of truth */
    }
  }
}

// ─── Server API helpers ────────────────────────────────────────────────────────

const API_BASE = "/api/sandbox/sessions";

async function serverList(): Promise<SandboxSession[] | null> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return null;
    return (await res.json()) as SandboxSession[];
  } catch {
    return null;
  }
}

async function serverGet(id: string): Promise<SandboxSession | null> {
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as SandboxSession;
  } catch {
    return null;
  }
}

function serverWrite(path: string, method: string, body: unknown): void {
  // Fire-and-forget — errors are non-fatal (localStorage is the fallback)
  fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {/* silent */});
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * List sessions — tries server first, falls back to localStorage.
 * Updates localStorage cache when server returns fresh data.
 */
export async function listSessions(): Promise<SandboxSession[]> {
  const serverData = await serverList();
  if (serverData !== null) {
    localSave([...serverData].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ));
    return serverData.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  // Server unavailable — use local cache
  return localLoad().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Get a single session — tries server first, falls back to localStorage.
 */
export async function getSession(id: string): Promise<SandboxSession | null> {
  const serverData = await serverGet(id);
  if (serverData !== null) return serverData;
  return localLoad().find((s) => s.id === id) ?? null;
}

export function createSession(
  skillId: string | undefined,
  personaText: string,
  name: string,
): SandboxSession {
  const now = new Date().toISOString();
  const session: SandboxSession = {
    id: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    skillId,
    personaText,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  // Optimistic local write
  const all = localLoad();
  localSave([session, ...all]);

  // Async server write (fire-and-forget)
  serverWrite(API_BASE, "POST", session);

  return session;
}

export function appendMessage(
  sessionId: string,
  message: Omit<SandboxMessage, "createdAt">,
): SandboxSession | null {
  const all = localLoad();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const updated: SandboxSession = {
    ...all[idx]!,
    messages: [
      ...all[idx]!.messages,
      { ...message, createdAt: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  localSave(all);

  serverWrite(`${API_BASE}/${sessionId}`, "PATCH", updated);

  return updated;
}

export function updateLastMessage(
  sessionId: string,
  content: string,
): SandboxSession | null {
  const all = localLoad();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const msgs = [...all[idx]!.messages];
  if (msgs.length === 0) return null;
  msgs[msgs.length - 1] = { ...msgs.at(-1)!, content };

  const updated: SandboxSession = {
    ...all[idx]!,
    messages: msgs,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  localSave(all);

  serverWrite(`${API_BASE}/${sessionId}`, "PATCH", updated);

  return updated;
}

export function renameSession(id: string, name: string): void {
  const all = localLoad();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const updated = { ...all[idx]!, name, updatedAt: new Date().toISOString() };
  all[idx] = updated;
  localSave(all);

  serverWrite(`${API_BASE}/${id}`, "PATCH", { name });
}

export function deleteSession(id: string): void {
  localSave(localLoad().filter((s) => s.id !== id));
  serverWrite(`${API_BASE}/${id}`, "DELETE", null);
}
