"use client";

import type { GenerationJob, AgentTarget } from "@/types";
import { Tooltip } from "@/components/ui/tooltip";
import { agentTargetFile } from "@/lib/agent-targets";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

const AGENT_TARGETS: {
  id: AgentTarget;
  label: string;
  emoji: string;
  generatedFile: string;
  description: string;
  tooltip: string;
}[] = [
  {
    id: "github-copilot",
    label: "GitHub Copilot",
    emoji: "🤖",
    generatedFile: agentTargetFile("github-copilot"),
    description:
      "Works inside VS Code, JetBrains, and GitHub.com. Reads workspace instructions to adapt suggestions.",
    tooltip:
      "Generates .github/copilot-instructions.md. Copilot injects this on every suggestion so your rules, conventions, and persona travel with the repo — no manual context pasting needed.",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    emoji: "🧠",
    generatedFile: agentTargetFile("claude-code"),
    description:
      "Anthropic's terminal-based agentic coding tool. Reads CLAUDE.md on every session start.",
    tooltip:
      "Generates CLAUDE.md at your project root. Claude Code reads it at session startup to learn your project's context, constraints, trusted commands, and preferred workflows — including MCP server config.",
  },
  {
    id: "cursor",
    label: "Cursor",
    emoji: "⚡",
    generatedFile: agentTargetFile("cursor"),
    description:
      "AI-first code editor. Rule files are injected into every chat and autocomplete context window.",
    tooltip:
      "Generates .cursor/rules. Cursor injects these rules project-wide into every AI context window, controlling both autocomplete behaviour and chat persona across the whole team.",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    emoji: "🖥️",
    generatedFile: agentTargetFile("codex-cli"),
    description:
      "OpenAI's agentic CLI tool. Uses AGENTS.md to understand project structure and available commands.",
    tooltip:
      "Generates AGENTS.md — the standard agentic manifest supported by the OpenAI Agents SDK. Codex CLI reads this to understand where code lives, what commands are available, and how to run tests.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    emoji: "🌊",
    generatedFile: agentTargetFile("windsurf"),
    description: "Codeium's agentic editor. Cascade AI reads rules before every multi-step task.",
    tooltip:
      "Generates .windsurf/rules. Windsurf Cascade loads this before every agentic run to apply your persona, style constraints, and test commands — preventing the agent from going off-script.",
  },
  {
    id: "generic",
    label: "Generic / Other",
    emoji: "📄",
    generatedFile: agentTargetFile("generic"),
    description:
      "Universal format. Works with any tool that reads AGENTS.md — including the OpenAI Agents SDK.",
    tooltip:
      "Generates only AGENTS.md. This is the portable baseline. Use it if you're unsure which tool you'll use, if you're building with the OpenAI Agents SDK directly, or if you want a template that works everywhere.",
  },
];

export function StepAgentTarget({ job, onUpdateJob, onNext, onBack }: StepProperties) {
  const selected = job.agentTarget ?? "generic";

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Choose Your Agent Platform</h2>
      <p className="mb-2 text-slate-500 dark:text-slate-400">
        This determines which config file gets generated. Pick the AI coding tool you plan to use.
      </p>
      <div className="mb-5 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <strong>Why this matters:</strong> Each platform reads a different file to load your
        agent&apos;s persona, rules, and MCP servers. Choosing the wrong platform means your config
        is never read — and your agent runs without context.
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TARGETS.map((agent) => {
          const isSelected = selected === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onUpdateJob({ agentTarget: agent.id })}
              data-testid={`agent-target-card-${agent.id}`}
              className={`group relative flex flex-col rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300"
              }`}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-400 text-xs text-white dark:text-gray-900 font-bold">
                  ✓
                </span>
              )}

              {/* Emoji + label */}
              <div className="mb-1 flex items-center gap-2">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {agent.emoji}
                </span>
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{agent.label}</p>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="none"
                  >
                    <Tooltip
                      placement="bottom"
                      title={`${agent.label} target`}
                      body={agent.tooltip}
                    />
                  </div>
                </div>
              </div>

              {/* Generated file badge */}
              <code className="mb-2 w-fit rounded bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                {agent.generatedFile}
              </code>

              <p className="text-sm leading-snug text-slate-500 dark:text-slate-400">{agent.description}</p>
            </button>
          );
        })}
      </div>

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
          Next: Customize →
        </button>
      </div>
    </div>
  );
}
