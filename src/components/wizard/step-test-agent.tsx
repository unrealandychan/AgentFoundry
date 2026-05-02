"use client";

import { useState, useRef, useMemo } from "react";
import type { GenerationJob } from "@/types";
import { ChatBubble } from "./ChatBubble";
import { useAgentDefs } from "./hooks/useAgentDefs";
import { useTestAgentChat } from "./hooks/useTestAgentChat";
import { useSummary } from "./hooks/useSummary";
import { MODELS, agentColor, buildTabClass, chatEmptyMessage, estimateCost } from "./utils/chatUtils";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

function TabPill({
  label,
  active,
  colorClass,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  colorClass?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const stateClass = buildTabClass(active, colorClass);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-t-md border-b-2 px-3 py-1.5 text-xs font-medium transition ${stateClass} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}

export function StepTestAgent({ job, onNext, onBack }: StepProperties) {
  // Stable session ID for this component mount — used as workspace folder key on the server
  const sessionId = useRef<string>(
    typeof crypto === "undefined" ? Math.random().toString(36).slice(2) : crypto.randomUUID(),
  ).current;

  const [model, setModel] = useState("gpt-4o-mini");
  const [collaborate, setCollaborate] = useState(true);
  const [rounds, setRounds] = useState(2);
  const [reflective, setReflective] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  // Tab state: "all" | agent id | "summary"
  const [activeTab, setActiveTab] = useState("all");

  const { agentDefs, agentIndexMap, systemPrompt } = useAgentDefs(job);

  const {
    messages,
    loading,
    thinkingAgent,
    error,
    input,
    setInput,
    workspaceFiles,
    uploading,
    uploadError,
    totalCharsIn,
    totalCharsOut,
    bottomRef,
    sendMessage,
    uploadFiles,
    clearHistory,
  } = useTestAgentChat({ agentDefs, systemPrompt, sessionId, model, collaborate, rounds, reflective });

  const { summary, summarizing, summaryError, generateSummary } = useSummary();

  const isMultiAgent = agentDefs.length > 1;

  const filteredMessages = useMemo(() => {
    if (activeTab === "all") return messages;
    const targetAgent = agentDefs.find((agent) => agent.id === activeTab);
    if (!targetAgent) return messages;
    return messages.filter(
      (message) => message.role === "user" || message.agentName === targetAgent.name,
    );
  }, [messages, activeTab, agentDefs]);

  return (
    <div className="flex flex-col">
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Test Your Agent</h2>
      <p className="mb-3 text-slate-500 dark:text-slate-400">
        Chat live with your composed agent{isMultiAgent ? "s" : ""} before downloading.
        {isMultiAgent && collaborate
          ? ` Agents debate in ${rounds} round${rounds > 1 ? "s" : ""} — each reads the full transcript and builds on, challenges, or extends what was said.`
          : (isMultiAgent
            ? " An orchestrator routes each message to the best specialist."
            : "")}
        {reflective
          ? " A Coordinator reviews each draft and requests iteration if the reasoning is too shallow."
          : ""}
      </p>

      {/* ── Limitations disclaimer ─────────────────────────────────────────── */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
        <span className="mt-0.5 shrink-0 text-base leading-none">⚠️</span>
        <div>
          <span className="font-semibold">Preview mode — behaviour only.</span> This sandbox tests
          how your agent <em>thinks and responds</em>, but it is not a full runtime. MCP tool calls,
          external API integrations, memory, and any other skill-defined capabilities are
          <strong> not active</strong> here — they will be available once you download and run the
          generated project. Use this step to validate tone, reasoning style, and persona before
          downloading.
        </div>
      </div>

      {/* ── Config bar ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
        {/* Security badge */}
        <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <span>🔒</span>
          <span>
            Server-side key via <code className="rounded bg-emerald-50 dark:bg-emerald-950 px-1">OPENAI_API_KEY</code>
          </span>
        </span>

        <div className="hidden h-4 w-px bg-gray-200 dark:bg-gray-700 sm:block" />

        {/* Model selector */}
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Model</span>
          <select
            value={model}
            data-testid="model-selector"
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} title={m.note}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {systemPrompt && (
          <>
            <div className="hidden h-4 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:bg-gray-900"
            >
              🧩 System Prompt
              <span className="ml-1 text-slate-400 dark:text-slate-500">{showPrompt ? "▲" : "▼"}</span>
            </button>
          </>
        )}

        {/* Collaborate toggle — only meaningful with multiple agents */}
        {isMultiAgent && (
          <>
            <div className="hidden h-4 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
            <button
              type="button"
              onClick={() => setCollaborate((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                collaborate
                  ? "border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
                  : "border-gray-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-gray-900"
              }`}
            >
              🗣 Collaborate
              <span
                className={`ml-1 size-2 rounded-full ${collaborate ? "bg-violet-500" : "bg-gray-300"}`}
              />
            </button>
            {/* Rounds selector — visible only when Collaborate is on */}
            {collaborate && (
              <label className="flex items-center gap-1.5 text-xs">
                <span className="font-medium text-violet-700 dark:text-violet-300">Rounds</span>
                <select
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="rounded-md border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-950 px-1.5 py-1 text-xs text-violet-800 dark:text-violet-300 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {/* Reflect toggle */}
        <>
          <div className="hidden h-4 w-px bg-gray-200 dark:bg-gray-700 sm:block" />
          <button
            type="button"
            onClick={() => setReflective((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              reflective
                ? "border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                : "border-gray-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-gray-900"
            }`}
          >
            🔄 Reflect
            <span
              className={`ml-1 size-2 rounded-full ${reflective ? "bg-amber-500" : "bg-gray-300"}`}
            />
          </button>
        </>
      </div>

      {/* Collapsible system prompt */}
      {showPrompt && systemPrompt && (
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 pb-4 pt-3">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-100">
            {systemPrompt}
          </pre>
        </div>
      )}

      {/* ── Left / Right split ────────────────────────────────────────────── */}
      <div className="mb-5 flex min-h-[520px] gap-4">
        {/* LEFT — workspace context */}
        <div className="flex w-64 flex-shrink-0 flex-col gap-4">
          {/* Agent roster */}
          {agentDefs.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isMultiAgent ? `${agentDefs.length} Sub-Agents` : "Agent"}
              </p>
              <div className="flex flex-wrap gap-2">
                {agentDefs.map((agent, index) => (
                  <span
                    key={agent.id}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${agentColor(index)}`}
                  >
                    {agent.name}
                  </span>
                ))}
                {reflective && (
                  <span className="rounded-full border border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    🔄 Coordinator
                  </span>
                )}
              </div>
              {isMultiAgent && (
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  {collaborate
                    ? `🗣 ${rounds} round${rounds > 1 ? "s" : ""} — agents debate and build on each other's responses.`
                    : "✦ Orchestrator routes each message to the best specialist."}
                </p>
              )}
              {reflective && (
                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  🔄 Coordinator reviews each response and requests iteration if reasoning is
                  shallow.
                </p>
              )}
            </div>
          )}

          {/* Token / cost estimate */}
          {(totalCharsIn > 0 || totalCharsOut > 0) && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                💰 Est. Cost
              </p>
              <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                {estimateCost(model, totalCharsIn, totalCharsOut)}
              </p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                ~{Math.round(totalCharsIn / 4).toLocaleString()} in&nbsp;/&nbsp; ~
                {Math.round(totalCharsOut / 4).toLocaleString()} out tokens
              </p>
              <p className="mt-1 text-[10px] text-slate-300">Rough estimate — chars÷4</p>
            </div>
          )}

          {/* Workspace file upload */}
          <div className="flex flex-1 flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              📁 Workspace Files
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {workspaceFiles.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Drop files here to give agents context from your workspace.
                </p>
              ) : (
                workspaceFiles.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-slate-200 dark:border-gray-700 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 font-mono text-xs text-slate-600 dark:text-slate-300"
                  >
                    {name}
                  </span>
                ))
              )}
            </div>
            <label
              className="mt-auto flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500 transition hover:border-indigo-300 hover:text-indigo-500"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadFiles(e.dataTransfer.files);
              }}
            >
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              {uploading ? (
                "Uploading…"
              ) : (
                <>
                  <span className="mb-1 text-lg">📂</span>
                  <span>Click or drop files</span>
                  <span className="mt-0.5 text-[10px] text-slate-300">
                    max 2 MB · text files only
                  </span>
                </>
              )}
            </label>
            {uploadError && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{uploadError}</p>}
          </div>
        </div>

        {/* RIGHT — chat */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {/* ── Tab bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-0.5 overflow-x-auto rounded-t-xl border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 pt-1">
            <TabPill label="All" active={activeTab === "all"} onClick={() => setActiveTab("all")} />
            {isMultiAgent &&
              agentDefs.map((agent, index) => (
                <TabPill
                  key={agent.id}
                  label={agent.name}
                  active={activeTab === agent.id}
                  colorClass={agentColor(index)}
                  onClick={() => setActiveTab(agent.id)}
                />
              ))}
            <div className="ml-auto flex shrink-0 items-center gap-1 pb-1">
              <TabPill
                label="✦ Summary"
                active={activeTab === "summary"}
                disabled={messages.length === 0}
                onClick={() => setActiveTab("summary")}
              />
              {messages.length > 0 && (
                <button
                  type="button"
                  title="Clear conversation"
                  onClick={() => {
                    clearHistory();
                    setActiveTab("all");
                  }}
                  className="rounded px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500 transition hover:text-red-500"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {activeTab === "summary" ? (
            /* ── Summary panel ────────────────────────────────────────────── */
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {!summary && !summarizing && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="mb-2 text-4xl">✦</span>
                  <p className="mb-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                    Generate a structured summary of the conversation — topics discussed, what each
                    agent contributed, key decisions, and suggested next steps.
                  </p>
                  <button
                    type="button"
                    onClick={() => void generateSummary(messages, agentDefs)}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                  >
                    ✦ Generate Summary
                  </button>
                </div>
              )}
              {summarizing && !summary && (
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                  <span className="inline-block size-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  Generating summary…
                </div>
              )}
              {summary && (
                <div className="flex flex-col gap-3">
                  <pre className="whitespace-pre-wrap rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                    {summary}
                  </pre>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void generateSummary(messages, agentDefs)}
                      disabled={summarizing}
                      className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:bg-gray-900 disabled:opacity-40"
                    >
                      ↺ Regenerate
                    </button>
                    {summarizing && (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                        <span className="inline-block size-2.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                        Regenerating…
                      </span>
                    )}
                  </div>
                  {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}
                </div>
              )}
              {summaryError && !summary && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {summaryError}
                </div>
              )}
            </div>
          ) : (
            /* ── Chat panel ───────────────────────────────────────────────── */
            <>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {filteredMessages.length === 0 && (
                  <p className="text-center text-sm text-slate-400 dark:text-slate-500">
                    {chatEmptyMessage(agentDefs.length, messages.length > 0, activeTab !== "all")}
                  </p>
                )}
                {filteredMessages.map((message, index) => {
                  const agentIndex =
                    message.agentName === "🔄 Coordinator"
                      ? -1
                      : (message.agentName === undefined
                        ? 0
                        : (agentIndexMap.get(
                            agentDefs.find((agent) => agent.name === message.agentName)?.id ?? "",
                          ) ?? 0));
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable list
                    <ChatBubble key={index} message={message} agentIndex={agentIndex} />
                  );
                })}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-sm text-slate-400 dark:text-slate-500">
                      {thinkingAgent ? (
                        <span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">{thinkingAgent}</span> is
                          thinking…
                        </span>
                      ) : (
                        "Thinking…"
                      )}
                    </div>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input bar */}
              <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 p-3">
                <input
                  type="text"
                  data-testid="chat-input"
                  value={input}
                  placeholder="Send a message…"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void sendMessage();
                  }}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  data-testid="chat-send-button"
                  disabled={!input.trim() || loading || agentDefs.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          data-testid="step-back-button"
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-2.5 font-medium text-slate-700 dark:text-slate-300 transition hover:bg-gray-50 dark:bg-gray-800"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          data-testid="step-next-button"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition hover:bg-indigo-700"
        >
          Looks good — Download →
        </button>
      </div>
    </div>
  );
}
