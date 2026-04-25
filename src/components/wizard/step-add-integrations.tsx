"use client";

import { useState, useMemo } from "react";
import type { GenerationJob, IntegrationManifest } from "@/types";
import { integrations } from "@/lib/registry";
import { Tooltip } from "@/components/ui/tooltip";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

// MCPs recommended per skill — derived from skill purpose, shown before the full list
const SKILL_INTEGRATION_RECOMMENDATIONS: Record<string, string[]> = {
  // Dev skills
  "clean-code-ddd": ["filesystem-mcp", "git-mcp"],
  "commit-hygiene": ["git-mcp", "github-mcp", "gitlab-mcp"],
  "senior-engineer": ["filesystem-mcp", "git-mcp", "e2b-mcp", "basic-coding-mcp"],
  debugger: ["filesystem-mcp", "git-mcp", "sentry-mcp"],
  "test-engineer": [
    "filesystem-mcp",
    "puppeteer-mcp",
    "playwright-mcp",
    "e2b-mcp",
    "qa-bundle-mcp",
  ],
  "refactoring-expert": ["filesystem-mcp", "git-mcp"],
  "security-reviewer": ["filesystem-mcp", "brave-search-mcp", "sentry-mcp", "security-bundle-mcp"],
  "coding-mentor": ["filesystem-mcp", "fetch-mcp", "deepwiki-mcp"],
  // Content & writing skills
  "documentation-writer": ["filesystem-mcp", "notion-mcp", "github-mcp", "documentation-mcp"],
  "technical-writer": ["filesystem-mcp", "notion-mcp", "github-mcp", "documentation-mcp"],
  "spec-writer": ["sequential-thinking-mcp", "notion-mcp", "linear-mcp", "planning-mcp"],
  "brand-voice-guardian": ["notion-mcp", "figma-mcp"],
  "social-media-creator": ["brave-search-mcp", "tavily-mcp", "notion-mcp", "marketing-bundle-mcp"],
  "email-marketing-writer": ["notion-mcp", "hubspot-mcp", "marketing-bundle-mcp"],
  "customer-success-writer": ["notion-mcp", "slack-mcp", "hubspot-mcp"],
  "pitch-deck-writer": ["sequential-thinking-mcp", "notion-mcp"],
  "market-research-analyst": [
    "brave-search-mcp",
    "tavily-mcp",
    "sequential-thinking-mcp",
    "research-mcp",
  ],
  // Design & UX
  "ux-researcher": ["notion-mcp", "sequential-thinking-mcp", "figma-mcp", "design-bundle-mcp"],
  // Sales skills
  "sales-copywriter": ["hubspot-mcp", "brave-search-mcp", "notion-mcp", "sales-crm-bundle-mcp"],
  "prospect-researcher": ["hubspot-mcp", "brave-search-mcp", "attio-mcp", "sales-crm-bundle-mcp"],
  // Legal skills
  "legal-proofreader": [
    "notion-mcp",
    "sequential-thinking-mcp",
    "filesystem-mcp",
    "legal-bundle-mcp",
  ],
  "contract-reviewer": [
    "notion-mcp",
    "sequential-thinking-mcp",
    "filesystem-mcp",
    "legal-bundle-mcp",
  ],
  // HR skills
  "onboarding-coordinator": ["notion-mcp", "slack-mcp", "memory-mcp", "hr-bundle-mcp"],
};

const CATEGORIES = [
  "All",
  "Dev Tools",
  "Databases",
  "Search & RAG",
  "Productivity",
  "CRM",
  "Cloud & Infra",
  "Browser & QA",
  "Design",
  "General",
] as const;
type Category = (typeof CATEGORIES)[number];

function McpCard({
  integration,
  selected,
  onToggle,
}: {
  integration: IntegrationManifest;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full flex-col rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${
        selected ? "border-teal-500 bg-teal-50 dark:bg-teal-950 dark:border-teal-400" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-teal-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex size-4 shrink-0 items-center justify-center rounded border-2 ${
            selected ? "border-teal-600 bg-teal-600 dark:border-teal-400 dark:bg-teal-400" : "border-gray-300"
          }`}
        >
          {selected && <span className="text-[10px] text-white">✓</span>}
        </div>
        <p className="font-semibold text-slate-900 dark:text-white">{integration.name}</p>
        {integration.tooltip && (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            <Tooltip title="What this adds" body={integration.tooltip} />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{integration.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {integration.mcpServers.map((server) => (
          <span
            key={server.name}
            className="rounded bg-teal-100 dark:bg-teal-900 px-1.5 py-0.5 text-xs text-teal-700 dark:text-teal-300"
          >
            {server.name}
          </span>
        ))}
      </div>
      {integration.installHint && (
        <pre className="mt-2 overflow-x-auto rounded bg-slate-900 px-2 py-1.5 text-[10px] leading-relaxed text-green-400">
          {integration.installHint}
        </pre>
      )}
    </button>
  );
}

export function StepAddIntegrations({ job, onUpdateJob, onNext, onBack }: StepProperties) {
  const selectedIds = job.integrationIds ?? [];
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category>("All");

  const individualServers = integrations.filter((index) => index.mcpServers.length === 1);
  const bundles = integrations.filter((index) => index.mcpServers.length > 1);

  const filteredIndividual = useMemo(
    () =>
      categoryFilter === "All"
        ? individualServers
        : individualServers.filter((i) => i.category === categoryFilter),
    [individualServers, categoryFilter],
  );

  // Collect unique recommended integration IDs from all selected skills
  const recommendedIds = new Set(
    new Set(
      (job.skillIds ?? []).flatMap((skillId) => SKILL_INTEGRATION_RECOMMENDATIONS[skillId] ?? []),
    ),
  );
  const recommendedIntegrations = integrations.filter((index) => recommendedIds.has(index.id));

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return null; // null = show normal sections
    return integrations.filter(
      (index) =>
        index.name.toLowerCase().includes(q) ||
        index.description.toLowerCase().includes(q) ||
        index.mcpServers.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [q]);

  function toggleIntegration(integrationId: string) {
    const updated = selectedIds.includes(integrationId)
      ? selectedIds.filter((id) => id !== integrationId)
      : [...selectedIds, integrationId];
    onUpdateJob({ integrationIds: updated });
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Add MCP Integrations</h2>
      <p className="mb-4 text-slate-500 dark:text-slate-400">
        Select MCP servers to embed in <code className="rounded bg-gray-100 dark:bg-gray-800 px-1">mcp.json</code>.
        Install hints are shown for fast bootstrapping. You can skip this step.
      </p>

      {/* Search bar */}
      <div className="relative mb-6">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-9 pr-4 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results */}
      {filtered === null ? (
        <>
          {/* Skill-based recommendations */}
          {recommendedIntegrations.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-1 font-semibold text-slate-700 dark:text-slate-300">⭐ Recommended for your skills</h3>
              <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
                Based on the skills you selected — these MCPs unlock the most value for your agent.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommendedIntegrations.map((integration) => (
                  <McpCard
                    key={integration.id}
                    integration={integration}
                    selected={selectedIds.includes(integration.id)}
                    onToggle={() => toggleIntegration(integration.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">Individual MCP Servers</h3>
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            Official reference servers from modelcontextprotocol.io — install with a single{" "}
            <code className="rounded bg-gray-100 dark:bg-gray-800 px-1">npx</code> command.
          </p>
          {/* Category filter tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === cat
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIndividual.length === 0 ? (
              <p className="col-span-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No servers in this category.
              </p>
            ) : (
              filteredIndividual.map((integration) => (
                <McpCard
                  key={integration.id}
                  integration={integration}
                  selected={selectedIds.includes(integration.id)}
                  onToggle={() => toggleIntegration(integration.id)}
                />
              ))
            )}
          </div>

          <h3 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">Curated Bundles</h3>
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            Pre-selected combinations for common agent workflows.
          </p>
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((integration) => (
              <McpCard
                key={integration.id}
                integration={integration}
                selected={selectedIds.includes(integration.id)}
                onToggle={() => toggleIntegration(integration.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No integrations match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((integration) => (
                  <McpCard
                    key={integration.id}
                    integration={integration}
                    selected={selectedIds.includes(integration.id)}
                    onToggle={() => toggleIntegration(integration.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
          Next: Agent Target →
        </button>
      </div>
    </div>
  );
}
