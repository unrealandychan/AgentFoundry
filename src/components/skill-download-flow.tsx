"use client";

import { useState, useEffect, useCallback } from "react";
import type { SkillManifest } from "@/types";
import { skills as staticSkills } from "@/lib/registry";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Category config (mirrors step-add-skills) ────────────────────────────────

const CATEGORIES = [
  {
    key: "engineering",
    label: "🔧 Engineering",
    description: "Code quality, testing, debugging, security",
  },
  { key: "workflow", label: "⚙️ Workflow", description: "Commits, planning, mentoring" },
  {
    key: "documentation",
    label: "📝 Documentation",
    description: "Docs, onboarding, API references",
  },
  {
    key: "marketing",
    label: "📣 Marketing & Business",
    description: "Copy, campaigns, presentations",
  },
  { key: "other", label: "📦 Other", description: "Uncategorised skills" },
] as const;

type SkillCategory = (typeof CATEGORIES)[number]["key"];

const SKILL_CATEGORY: Record<string, SkillCategory> = {
  "clean-code-ddd": "engineering",
  "senior-engineer": "engineering",
  debugger: "engineering",
  "test-engineer": "engineering",
  "refactoring-expert": "engineering",
  "security-reviewer": "engineering",
  "commit-hygiene": "workflow",
  "coding-mentor": "workflow",
  "spec-writer": "workflow",
  "documentation-writer": "documentation",
  "brand-voice-guardian": "marketing",
  "social-media-creator": "marketing",
  "email-marketing-writer": "marketing",
  "customer-success-writer": "marketing",
  "pitch-deck-writer": "marketing",
  "market-research-analyst": "marketing",
};

function categoryOf(id: string): SkillCategory {
  return SKILL_CATEGORY[id] ?? "other";
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  selected,
  onToggle,
}: {
  skill: SkillManifest;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${
        selected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-400"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300"
      }`}
    >
      <div
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          selected ? "border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400" : "border-gray-300 bg-white dark:bg-gray-900"
        }`}
      >
        {selected && <span className="text-xs text-white">✓</span>}
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-1">
          <p className="font-semibold text-slate-900 dark:text-white">{skill.title}</p>
          {skill.tooltip && <Tooltip title="What this skill adds" body={skill.tooltip} />}
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{skill.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <span key={tag} className="rounded bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Main flow ────────────────────────────────────────────────────────────────

interface SkillDownloadFlowProperties {
  onBack: () => void;
}

export function SkillDownloadFlow({ onBack }: SkillDownloadFlowProperties) {
  const [skills, setSkills] = useState<SkillManifest[]>(staticSkills);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Fetch from /api/skills so MongoDB skills appear when configured
  useEffect(() => {
    fetch("/api/skills")
      .then(async (r) => r.json())
      .then((data: SkillManifest[]) => {
        if (Array.isArray(data)) setSkills(data);
      })
      .catch(() => {
        /* keep static fallback */
      });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(skills.map((s) => s.id)));
  }, [skills]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  // Filter skills based on search + category
  const visibleSkills = skills.filter((s) => {
    const matchCat = activeCategory === "all" || categoryOf(s.id) === activeCategory;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  // Group by category for display
  const grouped = (
    activeCategory === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.key === activeCategory)
  )
    .map((cat) => ({
      ...cat,
      skills: visibleSkills.filter((s) => categoryOf(s.id) === cat.key),
    }))
    .filter((cat) => cat.skills.length > 0);

  async function download() {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/skills/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [...selectedIds] }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "skills.zip";
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-indigo-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-6 py-5 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-indigo-600" />
            <span className="text-lg font-bold text-slate-900 dark:text-white">AgentFoundry</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">Download Skills</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-slate-500 dark:text-slate-400 transition hover:text-slate-800"
            >
              ← Back
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Download Skill Packs</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Select the skills you need. Each skill downloads as a{" "}
            <code className="rounded bg-slate-100 dark:bg-gray-700 px-1 text-xs">SKILL.md</code> file — drop it into
            your project&apos;s <code className="rounded bg-slate-100 dark:bg-gray-700 px-1 text-xs">skills/</code>{" "}
            folder and reference it from your agent&apos;s{" "}
            <code className="rounded bg-slate-100 dark:bg-gray-700 px-1 text-xs">AGENTS.md</code>.
          </p>
        </div>

        {/* Search + category tabs */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            placeholder="Search skills…"
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
          <div className="flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-white dark:bg-gray-900 text-slate-600 border border-gray-200 dark:border-gray-700 hover:bg-slate-50 dark:bg-gray-900"
              }`}
            >
              All
            </button>
            {CATEGORIES.filter((c) => c.key !== "other").map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  activeCategory === cat.key
                    ? "bg-slate-800 text-white"
                    : "bg-white dark:bg-gray-900 text-slate-600 border border-gray-200 dark:border-gray-700 hover:bg-slate-50 dark:bg-gray-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Select all / clear */}
        <div className="mb-6 flex items-center gap-3 text-xs">
          <button type="button" onClick={selectAll} className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Select all
          </button>
          <span className="text-slate-300">|</span>
          <button type="button" onClick={clearAll} className="text-slate-500 dark:text-slate-400 hover:underline">
            Clear
          </button>
          <span className="ml-auto text-slate-400 dark:text-slate-500">
            {selectedIds.size === 0
              ? "No skills selected"
              : `${selectedIds.size} skill${selectedIds.size === 1 ? "" : "s"} selected`}
          </span>
        </div>

        {/* Skill grid grouped by category */}
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No skills match your search.</p>
        )}
        {grouped.map((cat) => (
          <div key={cat.key} className="mb-8">
            <div className="mb-3 flex items-baseline gap-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{cat.label}</p>
              <span className="text-xs text-slate-400 dark:text-slate-500">{cat.description}</span>
              <span className="ml-auto rounded-full bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                {cat.skills.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cat.skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  selected={selectedIds.has(skill.id)}
                  onToggle={() => toggle(skill.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Sticky download bar */}
        <div className="sticky bottom-0 -mx-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/90 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              {downloadError && <p className="text-sm text-red-600">{downloadError}</p>}
              {!downloadError && selectedIds.size > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ready to download <strong>{selectedIds.size}</strong> skill
                  {selectedIds.size === 1 ? "" : "s"} as{" "}
                  <code className="rounded bg-slate-100 dark:bg-gray-700 px-1 text-xs">skills.zip</code>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void download()}
              disabled={selectedIds.size === 0 || downloading}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              {downloading ? "Preparing…" : "⬇ Download skills.zip"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
