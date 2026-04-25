"use client";

import { useState } from "react";
import type { GenerationJob } from "@/types";
import { getTemplate, getSkills, getIntegrations } from "@/lib/registry";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-32 shrink-0 font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

// ── Agents SDK snippet ────────────────────────────────────────────────────────

const PYTHON_SNIPPET = (name: string) => `\
from agents import Agent, Runner
import asyncio

agent = Agent(
    name="${name}",
    instructions=open("AGENTS.md").read(),
)

async def main():
    result = await Runner.run(agent, "Hello!")
    print(result.final_output)

asyncio.run(main())`;

const TS_SNIPPET = (name: string) => `\
import { Agent, run } from "@openai/agents";
import { readFileSync } from "fs";

const agent = new Agent({
  name: "${name}",
  instructions: readFileSync("AGENTS.md", "utf8"),
});

const result = await run(agent, "Hello!");
console.log(result.finalOutput);`;

function AgentsSdkSnippet({ projectName }: { projectName: string }) {
  const [lang, setLang] = useState<"python" | "ts">("python");
  const [open, setOpen] = useState(false);
  const code = lang === "python" ? PYTHON_SNIPPET(projectName) : TS_SNIPPET(projectName);
  return (
    <div className="mb-6 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="sdk-snippet-toggle"
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          🤖 Agents SDK Quick-Start
        </span>
        <span className="text-xs text-indigo-400">{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Ready-to-run harness using the OpenAI Agents SDK. Your{" "}
            <code className="rounded bg-white dark:bg-gray-900 px-1 font-mono text-xs">AGENTS.md</code> becomes the
            system prompt.
          </p>
          <div className="mb-2 flex gap-2">
            {(["python", "ts"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                data-testid={`sdk-lang-${l}`}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  lang === l
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-gray-900 text-slate-600 border border-gray-200 dark:border-gray-700 hover:bg-slate-50 dark:bg-gray-900"
                }`}
              >
                {l === "python" ? "🐍 Python" : "🔷 TypeScript"}
              </button>
            ))}
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-[0.75rem] leading-relaxed text-slate-100">
            {code}
          </pre>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            Install: <code className="font-mono">pip install openai-agents</code> (Python) ·{" "}
            <code className="font-mono">npm i @openai/agents</code> (TypeScript)
          </p>
        </div>
      )}
    </div>
  );
}

// ── Export as GitHub Gist ─────────────────────────────────────────────────────

function GistExport({ job }: { job: Partial<GenerationJob> }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [gistUrl, setGistUrl] = useState<string | null>(null);
  const [gistError, setGistError] = useState<string | null>(null);

  async function createGist() {
    if (!token.trim() || !job.templateId) return;
    setLoading(true);
    setGistError(null);
    setGistUrl(null);
    try {
      const response = await fetch("/api/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, githubToken: token.trim() }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Gist creation failed");
      setGistUrl(data.url ?? null);
    } catch (error) {
      setGistError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="gist-export-toggle"
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          🐙 Export as GitHub Gist
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export all generated files as a private GitHub Gist. Paste a{" "}
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=AgentFoundry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 underline"
            >
              personal access token
            </a>{" "}
            with <code className="rounded bg-white dark:bg-gray-900 px-1 font-mono text-xs">gist</code> scope.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="ghp_…"
              data-testid="gist-token-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={() => void createGist()}
              data-testid="gist-create-button"
              disabled={loading || !token.trim() || !job.templateId}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {loading ? "Creating…" : "Create Gist"}
            </button>
          </div>
          {gistError && (
            <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {gistError}
            </p>
          )}
          {gistUrl && (
            <p className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              ✓ Gist created:{" "}
              <a href={gistUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {gistUrl}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function StepDownload({ job, onBack }: StepProperties) {
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = job.templateId ? getTemplate(job.templateId) : undefined;
  const selectedSkills = getSkills(job.skillIds ?? [], job.extraSkills ?? []);
  const selectedIntegrations = getIntegrations(job.integrationIds ?? []);

  async function downloadZip() {
    if (!job.templateId || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to generate package");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${job.projectName ?? "agent-starter"}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (!template) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-6 text-amber-800 dark:text-amber-200">
        Please go back and choose a template first.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Download Your Package</h2>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Your starter package is ready. Download a ZIP with all generated files and setup scripts.
      </p>

      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h3 className="mb-4 font-semibold text-slate-800">Package Summary</h3>
        <div className="flex flex-col gap-2">
          <SummaryRow label="Template" value={template.name} />
          <SummaryRow label="Project" value={job.projectName ?? "—"} />
          <SummaryRow label="Agent Target" value={job.agentTarget ?? "generic"} />
          <SummaryRow
            label="Skills"
            value={
              selectedSkills.length > 0 ? selectedSkills.map((s) => s.title).join(", ") : "None"
            }
          />
          <SummaryRow
            label="Integrations"
            value={
              selectedIntegrations.length > 0
                ? selectedIntegrations.map((index) => index.name).join(", ")
                : "None"
            }
          />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Included Files
        </p>
        <div className="grid grid-cols-2 gap-1 font-mono text-xs text-slate-600 sm:grid-cols-3">
          {[
            "README.md",
            "AGENTS.md",
            "skills/*/SKILL.md",
            ".env.example",
            "mcp.json",
            "setup.sh",
            "setup.ps1",
            "starter.yaml",
          ].map((file) => (
            <span key={file}>{file}</span>
          ))}
        </div>
      </div>

      {/* ── Agents SDK code snippet ──────────────────────────────────────── */}
      <AgentsSdkSnippet projectName={job.projectName ?? "my-agent"} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {done && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Downloaded successfully! Check your downloads folder.
        </div>
      )}

      {/* ── Export as GitHub Gist ─────────────────────────────────────────── */}
      <GistExport job={job} />

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
          onClick={() => void downloadZip()}
          data-testid="download-zip-button"
          disabled={downloading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {downloading ? "Generating…" : "⬇ Download ZIP"}
        </button>
      </div>
    </div>
  );
}
