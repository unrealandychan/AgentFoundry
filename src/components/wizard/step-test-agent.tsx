"use client";

import { useMemo, useState, useRef, useCallback, Fragment } from "react";
import type { GenerationJob } from "@/types";
import { compose } from "@/lib/composer";
import { getSkills } from "@/lib/registry";
import { isJobReady } from "@/lib/job-utils";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface AgentDefinition {
  id: string;
  name: string;
  instructions: string;
}

// Max chars sent per agent. GPT-4o context is 128 K tokens; 24 000 chars ≈ 6 000 tokens
// leaving ample room for conversation history and workspace files.
const MAX_INSTRUCTIONS_CHARS = 24_000;

/**
 * Smart truncation: preserves the role/persona opening (most important for
 * model behaviour) and the output-format/constraints tail (most important for
 * response quality). Middle "phase" sections are trimmed first.
 */
function truncateInstructions(text: string): string {
  if (text.length <= MAX_INSTRUCTIONS_CHARS) return text;

  const keepHead = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.6); // 14 400 chars
  const keepTail = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.35); // 8 400 chars
  const notice = "\n\n[... middle sections trimmed to fit context window ...]\n\n";

  return text.slice(0, keepHead) + notice + text.slice(text.length - keepTail);
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  agentName?: string;
}

const MODELS = [
  { id: "gpt-4o-mini", label: "gpt-4o-mini", note: "Fast & cheap — good for testing" },
  { id: "gpt-4o", label: "gpt-4o", note: "Smarter, slower" },
  { id: "gpt-4.1", label: "gpt-4.1", note: "Latest GPT-4 series" },
  { id: "gpt-5.4", label: "gpt-5.4", note: "Most capable (Apr 2026)" },
];

// Approximate pricing per 1 M tokens (input / output) — used only for rough estimates
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "gpt-5.4": { inputPer1M: 10, outputPer1M: 30 },
};

function estimateCost(model: string, charsIn: number, charsOut: number): string {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  const tokensIn = charsIn / 4;
  const tokensOut = charsOut / 4;
  const cost =
    (tokensIn / 1_000_000) * pricing.inputPer1M + (tokensOut / 1_000_000) * pricing.outputPer1M;
  if (cost < 0.000_01) return "< $0.00001";
  return `~$${cost.toFixed(5)}`;
}

// Stable palette — agent i gets color i % 6
const AGENT_COLORS = [
  "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200",
  "bg-purple-100 text-purple-700 border-purple-200",
];

function agentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length] ?? AGENT_COLORS[0];
}

// ── Tab helpers ───────────────────────────────────────────────────────────────

function buildTabClass(active: boolean, colorClass: string | undefined): string {
  if (!active) return "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300";
  return colorClass ? `border-current ${colorClass}` : "border-indigo-600 text-indigo-700 dark:text-indigo-300";
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

function chatEmptyMessage(agentCount: number, hasMessages: boolean, isFiltered: boolean): string {
  if (agentCount === 0) return "Go back and choose a template to enable the agent.";
  if (isFiltered && hasMessages) return "No messages from this agent yet.";
  return "Send a message to test the agent.";
}

// ── Lightweight markdown renderer ───────────────────────────────────────────

function inlineMarkdown(text: string): React.ReactNode[] {
  // Process inline: **bold**, *italic*, `code`, and plain text
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-gray-200 dark:bg-gray-700 px-1 py-0.5 text-[0.8em] font-mono text-slate-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let index = 0;
  let blockKey = 0;

  while (index < lines.length) {
    const line = lines[index];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index++]);
      }
      nodes.push(
        <pre
          key={blockKey++}
          className="my-2 overflow-x-auto rounded-lg bg-gray-800 px-4 py-3 text-[0.8em] leading-relaxed text-gray-100"
        >
          <code className={lang ? `language-${lang}` : ""}>{codeLines.join("\n")}</code>
        </pre>,
      );
      index++;
      continue;
    }

    // ATX Headings
    const h3 = /^### (.+)/.exec(line);
    const h2 = /^## (.+)/.exec(line);
    const h1 = /^# (.+)/.exec(line);
    if (h3) {
      nodes.push(
        <h3 key={blockKey++} className="mb-1 mt-3 text-sm font-semibold text-slate-900 dark:text-white">
          {inlineMarkdown(h3[1])}
        </h3>,
      );
      index++;
      continue;
    }
    if (h2) {
      nodes.push(
        <h2 key={blockKey++} className="mb-1 mt-3 text-base font-bold text-slate-900 dark:text-white">
          {inlineMarkdown(h2[1])}
        </h2>,
      );
      index++;
      continue;
    }
    if (h1) {
      nodes.push(
        <h1 key={blockKey++} className="mb-1 mt-3 text-lg font-bold text-slate-900 dark:text-white">
          {inlineMarkdown(h1[1])}
        </h1>,
      );
      index++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2));
        index++;
      }
      nodes.push(
        <blockquote
          key={blockKey++}
          className="my-1 border-l-4 border-indigo-300 pl-3 text-slate-600 italic"
        >
          {quoteLines.map((ql, qi) => (
            <Fragment key={qi}>
              {inlineMarkdown(ql)}
              {qi < quoteLines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // GFM table  (line has at least one |)
    if (/^\|.+\|/.test(line) && index + 1 < lines.length && /^\|[ :|-]+\|/.test(lines[index + 1])) {
      const headers = line
        .split("|")
        .filter((_, index_, array) => index_ > 0 && index_ < array.length - 1)
        .map((col) => col.trim());
      index += 2; // skip header + separator rows
      const rows: string[][] = [];
      while (index < lines.length && /^\|.+\|/.test(lines[index])) {
        rows.push(
          lines[index]
            .split("|")
            .filter((_, index_, array) => index_ > 0 && index_ < array.length - 1)
            .map((col) => col.trim()),
        );
        index++;
      }
      nodes.push(
        <div key={blockKey++} className="my-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                {headers.map((header, hi) => (
                  <th key={hi} className="py-1 pr-4 font-semibold text-slate-800">
                    {inlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-200 dark:border-gray-700">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1 pr-4 text-slate-700 dark:text-slate-300">
                      {inlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list  (- item or * item)
    if (/^[*-] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[*-] /.test(lines[index])) {
        items.push(lines[index].slice(2));
        index++;
      }
      nodes.push(
        <ul key={blockKey++} className="my-1 list-disc pl-5">
          {items.map((item, ii) => (
            <li key={ii} className="my-0 text-slate-700 dark:text-slate-300">
              {inlineMarkdown(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list  (1. item)
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\. /, ""));
        index++;
      }
      nodes.push(
        <ol key={blockKey++} className="my-1 list-decimal pl-5">
          {items.map((item, ii) => (
            <li key={ii} className="my-0 text-slate-700 dark:text-slate-300">
              {inlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={blockKey++} className="my-2 border-gray-200 dark:border-gray-700" />);
      index++;
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      index++;
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <p key={blockKey++} className="my-1 text-slate-800">
        {inlineMarkdown(line)}
      </p>,
    );
    index++;
  }

  return <>{nodes}</>;
}

function ChatBubble({ message, agentIndex }: { message: ChatMessage; agentIndex: number }) {
  const isUser = message.role === "user";
  const isCoordinator = agentIndex === -1;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && message.agentName && (
        <span
          className={`mb-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isCoordinator ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700" : agentColor(agentIndex)
          }`}
        >
          {message.agentName}
        </span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : (isCoordinator
              ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200"
              : "bg-gray-100 dark:bg-gray-800 text-slate-800 dark:text-slate-100")
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm">{renderMarkdown(message.content)}</div>
        )}
      </div>
    </div>
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
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Approximate token / cost tracking
  const [totalCharsIn, setTotalCharsIn] = useState(0);
  const [totalCharsOut, setTotalCharsOut] = useState(0);
  const bottomReference = useRef<HTMLDivElement>(null);

  // Tab state: "all" | agent id | "summary"
  const [activeTab, setActiveTab] = useState("all");
  // Summary panel state
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Each selected skill becomes a standalone sub-agent with its own instructions
  const agentDefs = useMemo((): AgentDefinition[] => {
    if (!isJobReady(job)) return [];
    const selectedSkills = getSkills(job.skillIds, job.extraSkills ?? []);
    if (selectedSkills.length > 0) {
      return selectedSkills.map((s) => ({
        id: s.id,
        name: s.title,
        instructions: truncateInstructions(s.personaText),
      }));
    }
    // No skills selected — fall back to composed system prompt as a single agent
    try {
      const { systemPrompt } = compose(job);
      return [
        {
          id: "agent",
          name: job.projectName || "Agent",
          instructions: truncateInstructions(systemPrompt),
        },
      ];
    } catch {
      return [];
    }
  }, [job]);

  // Map agentId → roster index for stable colouring
  const agentIndexMap = useMemo(
    () => new Map(agentDefs.map((a, index) => [a.id, index])),
    [agentDefs],
  );

  const isMultiAgent = agentDefs.length > 1;

  const systemPrompt = useMemo(() => {
    if (!isJobReady(job)) return "";
    try {
      return compose(job).systemPrompt;
    } catch {
      return "";
    }
  }, [job]);

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadError(null);
      const uploaded: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("file", file);
        try {
          const res = await fetch("/api/workspace/upload", { method: "POST", body: formData });
          if (res.ok) {
            const data = (await res.json()) as { name: string };
            uploaded.push(data.name);
          } else {
            const data = (await res.json()) as { error?: string };
            setUploadError(data.error ?? "Upload failed");
          }
        } catch {
          setUploadError("Upload failed — check the file type and size (max 2 MB).");
        }
      }
      if (uploaded.length > 0) {
        setWorkspaceFiles((previous) => {
          const seen = new Set(previous);
          return [...previous, ...uploaded.filter((n) => !seen.has(n))];
        });
      }
      setUploading(false);
    },
    [sessionId],
  );

  const filteredMessages = useMemo((): ChatMessage[] => {
    if (activeTab === "all") return messages;
    const targetAgent = agentDefs.find((agent) => agent.id === activeTab);
    if (!targetAgent) return messages;
    return messages.filter(
      (message) => message.role === "user" || message.agentName === targetAgent.name,
    );
  }, [messages, activeTab, agentDefs]);

  const generateSummary = useCallback(async () => {
    if (messages.length === 0 || summarizing) return;
    setSummarizing(true);
    setSummaryError(null);
    setSummary("");

    try {
      const response = await fetch("/api/test-agent/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(({ role, content, agentName }) => ({ role, content, agentName })),
          agents: agentDefs.map(({ id, name }) => ({ id, name })),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Summarize failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        const chunk = decoder.decode(value, { stream: !done });
        if (chunk) setSummary((previous) => previous + chunk);
      }
    } catch (error_) {
      setSummaryError(error_ instanceof Error ? error_.message : "Failed to generate summary");
    } finally {
      setSummarizing(false);
    }
  }, [messages, agentDefs, summarizing]);

  async function send() {
    if (!input.trim() || loading || agentDefs.length === 0) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    // Capture history BEFORE adding the new user message
    const priorMessages = [...messages];
    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setLoading(true);
    setThinkingAgent(null);
    setError(null);

    // Accumulate input chars for cost estimate (system prompts + history + user message)
    const systemChars = agentDefs.reduce((acc, a) => acc + a.instructions.length, 0);
    const historyChars = priorMessages.reduce((acc, m) => acc + m.content.length, 0);
    setTotalCharsIn((c) => c + systemChars + historyChars + userMessage.content.length);

    // Seed one empty placeholder for the first responding agent
    setMessages((previous) => [
      ...previous,
      { role: "assistant", content: "", agentName: undefined },
    ]);

    try {
      const response = await fetch("/api/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents: agentDefs,
          message: userMessage.content,
          history: priorMessages.map(({ role, content, agentName }) => ({
            role,
            content,
            agentName,
          })),
          model,
          sessionId,
          collaborate: collaborate && agentDefs.length > 1,
          reflective,
          rounds,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      // Each agent segment starts with a JSON header line: {"agentId":"...","agentName":"..."}\n
      // then the streamed text. In collaborate mode there are multiple such segments.
      let headerBuffer = "";
      let headerParsed = false;

      const appendToLast = (delta: string) => {
        setMessages((previous) => {
          const updated = [...previous];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + delta };
          }
          return updated;
        });
      };

      const setLastAgentName = (name: string) => {
        setThinkingAgent(name);
        setMessages((previous) => {
          const updated = [...previous];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, agentName: name };
          }
          return updated;
        });
      };

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        const chunk = decoder.decode(value, { stream: !done });

        if (headerParsed) {
          // Check if a new agent header starts inside this chunk (collaborate mode)
          // A new header looks like: \n{"agentId":
          const newHeaderMatch = chunk.indexOf('\n{"agentId"');
          if (newHeaderMatch !== -1) {
            // Flush text before the new header into the current bubble
            const textBefore = chunk.slice(0, newHeaderMatch);
            if (textBefore) appendToLast(textBefore);

            // Start a new empty bubble for the next agent
            setMessages((previous) => [
              ...previous,
              { role: "assistant", content: "", agentName: undefined },
            ]);
            headerParsed = false;
            headerBuffer = chunk.slice(newHeaderMatch + 1); // skip the leading \n

            // Re-process the new header immediately if it contains a newline
            const innerNewline = headerBuffer.indexOf("\n");
            if (innerNewline !== -1) {
              try {
                const header = JSON.parse(headerBuffer.slice(0, innerNewline)) as {
                  agentId: string;
                  agentName: string;
                };
                setLastAgentName(header.agentName);
              } catch {
                /* treat as content */
              }
              const rest = headerBuffer.slice(innerNewline + 1);
              headerBuffer = "";
              headerParsed = true;
              if (rest) appendToLast(rest);
            }
          } else if (chunk) {
            appendToLast(chunk);
          }
        } else {
          // Accumulate until we see the newline that terminates the header JSON
          headerBuffer += chunk;
          const newlineIndex = headerBuffer.indexOf("\n");
          if (newlineIndex !== -1) {
            try {
              const header = JSON.parse(headerBuffer.slice(0, newlineIndex)) as {
                agentId: string;
                agentName: string;
              };
              setLastAgentName(header.agentName);
            } catch {
              /* treat whole buffer as content */
            }
            const rest = headerBuffer.slice(newlineIndex + 1);
            headerBuffer = "";
            headerParsed = true;
            if (rest) appendToLast(rest);
          }
        }
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Something went wrong");
      setMessages((previous) => previous.slice(0, -1));
    } finally {
      // Accumulate output chars for cost estimate (from all assistant messages added this turn)
      setMessages((current) => {
        const outChars = current
          .filter((m) => m.role === "assistant")
          .reduce((acc, m) => acc + m.content.length, 0);
        setTotalCharsOut(outChars);
        return current;
      });
      setLoading(false);
      setThinkingAgent(null);
      bottomReference.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

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
          <span className="font-medium text-slate-600">Model</span>
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

        {/* Reflect toggle — Coordinator enforces iterative reasoning before final answers */}
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
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
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
              <p className="font-mono text-sm font-semibold text-slate-800">
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
                    className="rounded-full border border-slate-200 dark:border-gray-700 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 font-mono text-xs text-slate-600"
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
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
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
                    setMessages([]);
                    setSummary("");
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
                    onClick={() => void generateSummary()}
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
                  <pre className="whitespace-pre-wrap rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 font-sans text-sm leading-relaxed text-slate-800">
                    {summary}
                  </pre>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void generateSummary()}
                      disabled={summarizing}
                      className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:bg-gray-900 disabled:opacity-40"
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
                          <span className="font-medium text-slate-600">{thinkingAgent}</span> is
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
                <div ref={bottomReference} />
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
                    if (event.key === "Enter") void send();
                  }}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => void send()}
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
