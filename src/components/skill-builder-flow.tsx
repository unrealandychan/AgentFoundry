"use client";

import { useState, useMemo, useCallback } from "react";
import { lintSkill } from "@/lib/skill-linter";
import type { LintResult } from "@/lib/skill-linter";
import { ThemeToggle } from "@/components/theme-toggle";

interface SkillBuilderFlowProperties {
  onBack: () => void;
}

const STARTER_TEMPLATE = `---
name: my-skill
description: "Short description. Usage: /my-skill [input] [--flag value]"
user-invocable: true
---

# My Skill — Role Declaration

You are a [role]. Your job is to [goal]. Follow these phases exactly.

---

## Phase 1 — Parse Arguments

Parse the input provided after /my-skill.

## Output Format

\`\`\`
[Show the exact structure here]
\`\`\`

## Constraints

- Hard rule 1
- Hard rule 2
`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface IterProgress {
  iteration: number;
  score: number;
  grade: string;
}

type NdjsonLine = {
  type: "progress" | "done" | "error";
  iteration?: number;
  score?: number;
  grade?: string;
  failing?: string[];
  content?: string;
  error?: string;
};

// ── NDJSON stream reader ──────────────────────────────────────────────────────

async function readNdjsonStream(response: Response, onLine: (data: NdjsonLine) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onLine(JSON.parse(line) as NdjsonLine);
      } catch {
        /* skip malformed lines */
      }
    }
  }
  // Flush remainder
  if (buf.trim()) {
    try {
      onLine(JSON.parse(buf) as NdjsonLine);
    } catch {
      /* ignore */
    }
  }
}

// ── Iteration track ───────────────────────────────────────────────────────────

const GRADE_PILL: Record<string, string> = {
  A: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200",
  B: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  C: "bg-amber-100 text-amber-700 border border-amber-200",
  D: "bg-orange-100 text-orange-700 border border-orange-200",
  F: "bg-red-100 text-red-700 border border-red-200",
};

function IterationTrack({ items, running }: { items: IterProgress[]; running: boolean }) {
  if (items.length === 0 && !running) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.length === 0 && running && (
        <span className="animate-pulse text-[11px] text-violet-500">Generating iteration #1…</span>
      )}
      {items.map((item, index) => {
        const passed = item.score >= 85;
        const isLast = index === items.length - 1;
        return (
          <span key={item.iteration} className="flex items-center gap-1">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${GRADE_PILL[item.grade] ?? ""}`}
              title={`Iteration ${item.iteration}`}
            >
              #{item.iteration} {item.grade} · {item.score}/100{passed ? " ✅" : ""}
            </span>
            {!isLast && <span className="text-slate-300 text-[10px]">→</span>}
          </span>
        );
      })}
      {running && items.length > 0 && (
        <span className="animate-pulse text-[11px] text-violet-500">refining…</span>
      )}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  let color: string;
  if (pct >= 0.9) color = "#10b981";
  else if (pct >= 0.75) color = "#6366f1";
  else if (pct >= 0.55) color = "#f59e0b";
  else if (pct >= 0.35) color = "#f97316";
  else color = "#ef4444";

  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="mx-auto block">
      <circle cx="52" cy="52" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="52"
        cy="52"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 52 52)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text x="52" y="56" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

const GRADE_STYLES: Record<string, string> = {
  A: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  B: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
  C: "bg-amber-100 text-amber-700",
  D: "bg-orange-100 text-orange-700",
  F: "bg-red-100 text-red-700",
};

// ── Score panel ───────────────────────────────────────────────────────────────

function ScorePanel({ result }: { result: LintResult }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-l border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="text-center">
        <ScoreRing score={result.score} max={result.maxScore} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {result.score} / {result.maxScore} pts
        </p>
        <span
          className={`mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-bold ${GRADE_STYLES[result.grade]}`}
        >
          Grade {result.grade}
        </span>
      </div>

      <hr className="border-slate-100 dark:border-gray-700" />

      <ul className="flex flex-col gap-2">
        {result.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2">
            <span
              className={`mt-0.5 shrink-0 text-base ${check.passed ? "text-emerald-500" : "text-slate-300"}`}
            >
              {check.passed ? "✅" : "⬜"}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-medium leading-snug ${check.passed ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}
              >
                {check.label}
              </p>
              {!check.passed && (
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{check.hint}</p>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-slate-300">+{check.points}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ── Generate form ─────────────────────────────────────────────────────────────

interface GenerateFormProperties {
  onGenerated: (content: string) => void;
}

function GenerateForm({ onGenerated }: GenerateFormProperties) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [iterations, setIterations] = useState<IterProgress[]>([]);

  function reset() {
    setOpen(false);
    setName("");
    setPurpose("");
    setIterations([]);
    setError("");
  }

  function addIter(item: IterProgress) {
    setIterations((previous) => {
      const index = previous.findIndex((index_) => index_.iteration === item.iteration);
      if (index >= 0) {
        const u = [...previous];
        u[index] = item;
        return u;
      }
      return [...previous, item];
    });
  }

  async function handleGenerate() {
    if (!name.trim() || !purpose.trim()) return;
    setLoading(true);
    setError("");
    setIterations([]);

    try {
      const res = await fetch("/api/skill-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", name: name.trim(), purpose: purpose.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Generation failed");
        return;
      }

      let finalContent = "";

      await readNdjsonStream(res, (data) => {
        if (data.type === "error") {
          setError(data.error ?? "Generation failed");
          return;
        }
        if (data.iteration !== undefined && data.score !== undefined && data.grade !== undefined) {
          const item: IterProgress = {
            iteration: data.iteration,
            score: data.score,
            grade: data.grade,
          };
          addIter(item);
        }
        if (data.type === "done" && data.content) {
          finalContent = data.content;
        }
      });

      if (finalContent) {
        onGenerated(finalContent);
        reset();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:bg-violet-900"
      >
        ✨ Generate with AI
      </button>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-end gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          Skill name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. code-reviewer"
          disabled={loading}
          className="w-44 rounded-md border border-violet-200 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          What should it do?
        </label>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Review code for bugs and suggest improvements"
          disabled={loading}
          className="w-56 rounded-md border border-violet-200 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
          onKeyDown={(e) => e.key === "Enter" && void handleGenerate()}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={loading || !name.trim() || !purpose.trim()}
        className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "Running…" : "Generate"}
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={loading}
        className="rounded-lg px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 disabled:opacity-40"
      >
        ✕
      </button>

      {/* Live iteration track */}
      {(loading || iterations.length > 0) && (
        <div className="w-full pt-1">
          <IterationTrack items={iterations} running={loading} />
        </div>
      )}

      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export function SkillBuilderFlow({ onBack }: SkillBuilderFlowProperties) {
  const [content, setContent] = useState(STARTER_TEMPLATE);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completeIterations, setCompleteIterations] = useState<IterProgress[]>([]);

  const lintResult = useMemo(() => lintSkill(content), [content]);

  function addCompleteIter(item: IterProgress) {
    setCompleteIterations((previous) => {
      const index = previous.findIndex((index_) => index_.iteration === item.iteration);
      if (index >= 0) {
        const u = [...previous];
        u[index] = item;
        return u;
      }
      return [...previous, item];
    });
  }

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    setCompleteError("");
    setCompleteIterations([]);

    try {
      const res = await fetch("/api/skill-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", content }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setCompleteError(data.error ?? "Completion failed");
        return;
      }

      let finalContent = "";

      await readNdjsonStream(res, (data) => {
        if (data.type === "error") {
          setCompleteError(data.error ?? "Completion failed");
          return;
        }
        if (data.iteration !== undefined && data.score !== undefined && data.grade !== undefined) {
          const item: IterProgress = {
            iteration: data.iteration,
            score: data.score,
            grade: data.grade,
          };
          addCompleteIter(item);
        }
        if (data.type === "done" && data.content) {
          finalContent = data.content;
        }
      });

      if (finalContent) setContent(finalContent);
    } catch {
      setCompleteError("Network error — try again");
    } finally {
      setCompleting(false);
    }
  }, [content]);

  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SKILL.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-violet-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-violet-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-6 py-4 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-800"
        >
          ← Home
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-lg">🔨</span>
          <span className="font-bold text-slate-900 dark:text-white">Skill Builder</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <GenerateForm onGenerated={setContent} />
          <ThemeToggle />
        </div>
      </header>

      {/* Body: editor + score */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex flex-1 flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-300"
            style={{ minHeight: "calc(100vh - 160px)" }}
          />

          {/* Editor footer */}
          <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={completing}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {completing ? (
                  <>
                    <span className="animate-spin inline-block">⟳</span> Refining…
                  </>
                ) : (
                  <>✨ Complete with AI</>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:bg-gray-900"
              >
                ⬇ Download SKILL.md
              </button>

              {completeError && <p className="text-xs text-red-500">{completeError}</p>}

              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                {content.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            {/* Iteration progress for Complete */}
            {(completing || completeIterations.length > 0) && (
              <IterationTrack items={completeIterations} running={completing} />
            )}
          </div>
        </div>

        {/* Score panel */}
        <ScorePanel result={lintResult} />
      </div>
    </div>
  );
}
