"use client";

import { useState } from "react";
import type { SkillManifest } from "@/types";

interface ImportedRepo {
  repoName: string;
  repoDescription: string;
  skills: SkillManifest[];
  rawFiles: { path: string; content: string }[];
  detectedFolders: string[];
}

interface GitHubImportPanelProperties {
  onImport: (skills: SkillManifest[]) => void;
}

// Trending Claude Code skills repos with parseable skill content (Apr 2026)
const TRENDING_REPOS = [
  {
    slug: "forrestchang/andrej-karpathy-skills",
    label: "karpathy-skills",
    description: "Andrej Karpathy's curated agent skills — skills/ folder with SKILL.md files",
  },
  {
    slug: "danielmiessler/fabric",
    label: "fabric",
    description: "500+ prompt patterns for AI augmentation — patterns/ folder",
  },
  {
    slug: "anthropics/anthropic-cookbook",
    label: "anthropic-cookbook",
    description: "Official Claude prompt recipes, agents, and guides",
  },
  {
    slug: "openai/openai-cookbook",
    label: "openai-cookbook",
    description: "OpenAI examples, agent patterns, and prompt guides",
  },
  {
    slug: "f/awesome-chatgpt-prompts",
    label: "awesome-prompts",
    description: "Curated community prompt collection",
  },
  {
    slug: "travisvn/awesome-claude-skills",
    label: "awesome-claude-skills",
    description: "Curated index of Claude skills, resources & workflow tools",
  },
];

// Build a map from file path → content so each skill card can show a preview
function buildPreviewMap(
  skills: SkillManifest[],
  rawFiles: { path: string; content: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const skill of skills) {
    // Try to find the raw file whose path contains the skill id or title
    const idSlug = skill.id.toLowerCase().replaceAll(/[^\da-z]/g, "-");
    const match = rawFiles.find(
      (f) =>
        f.path.toLowerCase().includes(idSlug) ||
        f.path
          .toLowerCase()
          .replaceAll(/[^\da-z]/g, "-")
          .includes(idSlug) ||
        f.path.toLowerCase().includes(skill.title.toLowerCase().split(" ")[0]),
    );
    if (match) map[skill.id] = match.content;
  }
  return map;
}

export function GitHubImportPanel({ onImport }: GitHubImportPanelProperties) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportedRepo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);

  async function handleFetch(repoUrl?: string) {
    const target = (repoUrl ?? url).trim();
    if (!target || loading) return;
    if (repoUrl) setUrl(`https://github.com/${repoUrl}`);
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedIds(new Set());
    setOpenPreviewId(null);

    try {
      const response = await fetch("/api/import-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: target.startsWith("http") ? target : `https://github.com/${target}`,
        }),
      });
      const data = (await response.json()) as ImportedRepo & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setSelectedIds(new Set(data.skills.map((skill) => skill.id)));
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleSkill(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    if (!result) return;
    const chosen = result.skills.filter((skill) => selectedIds.has(skill.id));
    onImport(chosen);
    setResult(null);
    setUrl("");
    setOpenPreviewId(null);
  }

  const previewMap = result ? buildPreviewMap(result.skills, result.rawFiles) : {};

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <h3 className="mb-1 font-semibold text-slate-800">Import from GitHub</h3>
      <p className="mb-3 text-xs text-slate-500">
        Paste a public GitHub repo URL. We&apos;ll scan for{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs">skills/</code>,{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs">prompts/</code>,{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs">CLAUDE.md</code>,{" "}
        <code className="rounded bg-white px-1 py-0.5 text-xs">AGENTS.md</code>, and similar files.
      </p>

      {/* Trending recommendations */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
          ⭐ Trending Skill Repos
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TRENDING_REPOS.map((repo) => (
            <button
              key={repo.slug}
              type="button"
              title={repo.description}
              onClick={() => void handleFetch(repo.slug)}
              disabled={loading}
              className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100 disabled:opacity-40"
            >
              {repo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          placeholder="https://github.com/owner/repo"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleFetch();
          }}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={() => void handleFetch()}
          disabled={!url.trim() || loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{result.repoName}</p>
              <p className="text-xs text-slate-500">{result.repoDescription}</p>
            </div>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
              {result.skills.length} skill{result.skills.length === 1 ? "" : "s"} found
            </span>
          </div>

          {result.detectedFolders.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {result.detectedFolders.map((folder) => (
                <span
                  key={folder}
                  className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-500"
                >
                  /{folder}
                </span>
              ))}
            </div>
          )}

          {result.skills.length === 0 ? (
            <p className="text-sm text-slate-500">No skill files found in this repo.</p>
          ) : (
            <div className="mb-3 flex flex-col gap-2">
              {result.skills.map((skill) => {
                const previewContent = previewMap[skill.id];
                const isPreviewOpen = openPreviewId === skill.id;
                return (
                  <div
                    key={skill.id}
                    className={`rounded-lg border transition ${
                      selectedIds.has(skill.id)
                        ? "border-indigo-400 bg-white"
                        : "border-transparent bg-white/60 opacity-60"
                    }`}
                  >
                    {/* Select row */}
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className="flex w-full items-start gap-2 p-3 text-left"
                    >
                      <div
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 ${
                          selectedIds.has(skill.id)
                            ? "border-indigo-600 bg-indigo-600"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedIds.has(skill.id) && (
                          <span className="text-[10px] text-white">✓</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{skill.title}</p>
                        <p className="truncate text-xs text-slate-500">{skill.description}</p>
                      </div>
                      {/* Preview toggle */}
                      {previewContent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPreviewId(isPreviewOpen ? null : skill.id);
                          }}
                          className="ml-auto shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                        >
                          {isPreviewOpen ? "▲ Hide" : "📄 Preview"}
                        </button>
                      )}
                    </button>

                    {/* Inline preview panel */}
                    {isPreviewOpen && previewContent && (
                      <div className="border-t border-dashed border-indigo-200 px-3 pb-3 pt-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Source file preview
                        </p>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                          {previewContent.length > 1500
                            ? `${previewContent.slice(0, 1500)}\n\n… (truncated)`
                            : previewContent}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {result.skills.length > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              Add {selectedIds.size} skill{selectedIds.size === 1 ? "" : "s"} to my pack
            </button>
          )}
        </div>
      )}
    </div>
  );
}
