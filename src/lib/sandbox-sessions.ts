/**
 * sandbox-sessions.ts
 *
 * localStorage-backed store for Skill Sandbox sessions.
 * All operations are synchronous (localStorage is sync).
 */

import type { SandboxSession, SandboxMessage } from "@/types";

const STORAGE_KEY = "agentfoundry_sandbox_sessions_v1";
const MAX_SESSIONS = 50;

function loadAll(): SandboxSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SandboxSession[];
  } catch {
    return [];
  }
}

function saveAll(sessions: SandboxSession[]): void {
  if (typeof window === "undefined") return;
  // Keep most recent MAX_SESSIONS only
  const trimmed = sessions.slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function listSessions(): SandboxSession[] {
  return loadAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getSession(id: string): SandboxSession | null {
  return loadAll().find((s) => s.id === id) ?? null;
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
  const all = loadAll();
  saveAll([session, ...all]);
  return session;
}

export function appendMessage(
  sessionId: string,
  message: Omit<SandboxMessage, "createdAt">,
): SandboxSession | null {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const updated: SandboxSession = {
    ...all[idx],
    messages: [
      ...all[idx].messages,
      { ...message, createdAt: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  saveAll(all);
  return updated;
}

export function updateLastMessage(
  sessionId: string,
  content: string,
): SandboxSession | null {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const msgs = [...all[idx].messages];
  if (msgs.length === 0) return null;
  msgs[msgs.length - 1] = { ...msgs.at(-1)!, content };

  const updated: SandboxSession = {
    ...all[idx],
    messages: msgs,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  saveAll(all);
  return updated;
}

export function renameSession(id: string, name: string): void {
  const all = loadAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], name, updatedAt: new Date().toISOString() };
  saveAll(all);
}

export function deleteSession(id: string): void {
  saveAll(loadAll().filter((s) => s.id !== id));
}
