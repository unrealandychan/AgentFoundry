"use client";

import { Suspense } from "react";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Fragment,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SandboxSession } from "@/types";
import { skills as staticSkills } from "@/lib/registry";
import {
  listSessions,
  getSession,
  createSession,
  appendMessage,
  updateLastMessage,
  renameSession,
  deleteSession,
} from "@/lib/sandbox-sessions";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Session list (left panel) ─────────────────────────────────────────────────

interface SessionListProps {
  sessions: SandboxSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function SessionList({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const commitEdit = (id: string) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="font-semibold text-slate-800 text-sm">🧪 Sandbox</span>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 transition"
          title="New session"
        >
          + New
        </button>
      </div>

      {/* Session list */}
      <ul className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-slate-400">
            No sessions yet.
            <br />
            Pick a skill below to start.
          </li>
        )}
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={`group w-full rounded-lg mx-1 px-3 py-2.5 text-left transition ${
                activeId === s.id
                  ? "bg-indigo-100 text-indigo-900"
                  : "hover:bg-gray-100 text-slate-700"
              }`}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitEdit(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(s.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded border border-indigo-300 bg-white px-1 py-0.5 text-xs outline-none"
                />
              ) : (
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium leading-tight">
                      {s.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(s.updatedAt)} · {s.messages.length} msg
                    </p>
                  </div>
                  {/* Actions shown on hover */}
                  <div className="hidden gap-1 group-hover:flex">
                    <button
                      type="button"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(s.id, s.name);
                      }}
                      className="rounded p-0.5 text-slate-400 hover:text-indigo-600"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s.id);
                      }}
                      className="rounded p-0.5 text-slate-400 hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Quick-start skill picker */}
      <div className="border-t border-gray-200 px-3 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quick start
        </p>
        <div className="flex flex-wrap gap-1">
          {staticSkills.slice(0, 8).map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => onSelect(`__new__${sk.id}`)}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-700 transition"
              title={sk.description}
            >
              {sk.title}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ── Chat panel (right) ────────────────────────────────────────────────────────

interface ChatPanelProps {
  session: SandboxSession;
  onMessagesChange: () => void;
}

function ChatPanel({ session, onMessagesChange }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);

    // Persist user message
    appendMessage(session.id, { role: "user", content: text });
    onMessagesChange();

    // Placeholder for assistant
    appendMessage(session.id, { role: "assistant", content: "" });
    onMessagesChange();

    try {
      const updated = await getSession(session.id);
      if (!updated) return;

      const resp = await fetch("/api/sandbox/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaText: session.personaText,
          messages: updated.messages
            .slice(0, -1) // exclude empty placeholder
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        updateLastMessage(session.id, "⚠️ Request failed.");
        onMessagesChange();
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        streamDone = done;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as { text?: string; error?: string };
            if (chunk.error) {
              assembled = `⚠️ ${chunk.error}`;
            } else if (chunk.text) {
              assembled += chunk.text;
            }
            updateLastMessage(session.id, assembled);
            onMessagesChange();
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }, [input, streaming, session, onMessagesChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Persona header */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <p className="text-sm font-semibold text-slate-800">{session.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
          {session.personaText.slice(0, 120)}…
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {session.messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Send a message to start testing this skill.
          </div>
        )}
        {session.messages.map((msg, i) => (
          <Fragment key={i}>
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-slate-800"
                }`}
              >
                {msg.content || (
                  <span className="animate-pulse text-slate-400">▋</span>
                )}
              </div>
            </div>
            {msg.role === "assistant" && msg.content && (
              <p className="text-right text-xs text-slate-300">
                {formatTime(msg.createdAt)}
              </p>
            )}
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!input.trim() || streaming}
            className="h-10 w-10 rounded-xl bg-indigo-600 text-white text-lg font-bold hover:bg-indigo-700 disabled:opacity-40 transition flex items-center justify-center"
          >
            {streaming ? (
              <span className="animate-spin text-sm">⏳</span>
            ) : (
              "↑"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main sandbox page ─────────────────────────────────────────────────────────

function SandboxInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sessions, setSessions] = useState<SandboxSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SandboxSession | null>(null);

  // Load sessions from server (with localStorage fallback) on mount + handle ?skill= query param
  useEffect(() => {
    void listSessions().then((all) => {
      setSessions(all);

      const skillParam = searchParams.get("skill");
      const sessionParam = searchParams.get("session");

      if (sessionParam) {
        const found = all.find((s) => s.id === sessionParam);
        if (found) {
          setActiveId(found.id);
          setActiveSession(found);
          return;
        }
      }

      if (skillParam) {
        const skill = staticSkills.find((s) => s.id === skillParam);
        if (skill) {
          handleNewFromSkill(skill.id, skill.personaText, skill.title);
          return;
        }
      }

      if (all.length > 0) {
        setActiveId(all[0]!.id);
        setActiveSession(all[0]!);
      }
    });
  }, []);

  function handleNewFromSkill(skillId: string, personaText: string, skillTitle: string) {
    const name = `${skillTitle} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const session = createSession(skillId, personaText, name);
    void listSessions().then((all) => setSessions(all));
    setActiveId(session.id);
    setActiveSession(session);
    router.replace(`/sandbox?session=${session.id}`);
  }

  function handleNew() {
    const first = staticSkills[0];
    if (first) {
      handleNewFromSkill(first.id, first.personaText, first.title);
    } else {
      const session = createSession(undefined, "You are a helpful assistant.", "New session");
      void listSessions().then((all) => setSessions(all));
      setActiveId(session.id);
      setActiveSession(session);
    }
  }

  function handleSelect(id: string) {
    if (id.startsWith("__new__")) {
      const skillId = id.replace("__new__", "");
      const skill = staticSkills.find((s) => s.id === skillId);
      if (skill) handleNewFromSkill(skill.id, skill.personaText, skill.title);
      return;
    }
    void getSession(id).then((found) => {
      if (!found) return;
      setActiveId(id);
      setActiveSession(found);
      router.replace(`/sandbox?session=${id}`);
    });
  }

  function handleRename(id: string, name: string) {
    renameSession(id, name);
    void listSessions().then((all) => {
      setSessions(all);
      if (activeSession?.id === id) {
        const updated = all.find((s) => s.id === id) ?? null;
        setActiveSession(updated);
      }
    });
  }

  function handleDelete(id: string) {
    deleteSession(id);
    void listSessions().then((all) => {
      setSessions(all);
      if (activeId === id) {
        const next = all[0] ?? null;
        setActiveId(next?.id ?? null);
        setActiveSession(next);
        router.replace(next ? `/sandbox?session=${next.id}` : "/sandbox");
      }
    });
  }

  function refreshActiveSession() {
    if (!activeId) return;
    void getSession(activeId).then((updated) => {
      setActiveSession(updated);
    });
    void listSessions().then((all) => setSessions(all));
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top nav */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <a href="/" className="text-sm text-slate-500 hover:text-indigo-600 transition">
          ← AgentFoundry
        </a>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800">Skill Sandbox</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <SessionList
          sessions={sessions}
          activeId={activeId}
          onSelect={handleSelect}
          onNew={handleNew}
          onRename={handleRename}
          onDelete={handleDelete}
        />

        {activeSession ? (
          <ChatPanel
            key={activeSession.id}
            session={activeSession}
            onMessagesChange={refreshActiveSession}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-4xl">🧪</p>
            <p className="text-slate-500 text-sm max-w-xs">
              Pick a skill from the sidebar or click <strong>+ New</strong> to start a sandbox session.
            </p>
            <button
              type="button"
              onClick={handleNew}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
            >
              + New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SandboxPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>}>
      <SandboxInner />
    </Suspense>
  );
}
