"use client";

import { useState, useEffect } from "react";
import type { GenerationJob, TemplateManifest, TemplateAudience } from "@/types";
import { templates as builtInTemplates } from "@/lib/registry";
import { Tooltip } from "@/components/ui/tooltip";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ─── Audience filter tabs ────────────────────────────────────────────────────

const AUDIENCE_TABS: { label: string; value: TemplateAudience | "all" }[] = [
  { label: "All", value: "all" },
  { label: "💻 Developer", value: "developer" },
  { label: "🎨 Designer", value: "designer" },
  { label: "🧪 QA", value: "qa" },
  { label: "📋 Business", value: "business" },
  { label: "🔬 Researcher", value: "researcher" },
  { label: "📊 Data", value: "data" },
  { label: "🚀 DevOps", value: "devops" },
];

// ─── Tag colour map ───────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  ai: "bg-purple-100 text-purple-700",
  typescript: "bg-blue-100 text-blue-700",
  python: "bg-yellow-100 text-yellow-700",
  web: "bg-green-100 text-green-700",
  cli: "bg-orange-100 text-orange-700",
  rag: "bg-pink-100 text-pink-700",
  mcp: "bg-teal-100 text-teal-700",
  design: "bg-rose-100 text-rose-700",
  qa: "bg-lime-100 text-lime-700",
  testing: "bg-lime-100 text-lime-700",
  prd: "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300",
  planning: "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300",
  marketing: "bg-amber-100 text-amber-700",
  copywriting: "bg-amber-100 text-amber-700",
  data: "bg-cyan-100 text-cyan-700",
  sql: "bg-cyan-100 text-cyan-700",
  devops: "bg-red-100 text-red-700",
  infra: "bg-red-100 text-red-700",
  "no-code": "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  docs: "bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300",
  default: "bg-gray-100 dark:bg-gray-800 text-gray-600",
};

function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? TAG_COLORS.default;
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
  onPreview,
}: {
  template: TemplateManifest;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`template-card-${template.id}`}
      className={`group relative flex w-full flex-col items-start rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300"
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
          ✓
        </span>
      )}

      {/* Emoji + name row */}
      <div className="mb-1 flex items-start gap-2">
        <span className="mt-0.5 text-xl leading-none" aria-hidden="true">
          {template.emoji ?? "📦"}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-1">
          <p className="font-semibold text-slate-900 dark:text-white">{template.name}</p>
          {/* Info icon inline with name */}
          {(template.whyItMatters || template.impact) && (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              // biome-ignore lint: div wrapper only for stopPropagation
              role="none"
            >
              <Tooltip
                placement="bottom"
                title="Why this template?"
                body={`${template.whyItMatters ?? ""}\n\n${template.impact ?? ""}`}
              />
            </div>
          )}
          {"custom" in template && (template as TemplateManifest & { custom?: boolean }).custom && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Custom
            </span>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{template.description}</p>

      {/* Tags */}
      <div className="mb-3 flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span key={tag} className={`rounded px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}>
            {tag}
          </span>
        ))}
      </div>

// Preview link
      <div
        data-testid={`template-preview-${template.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            onPreview();
          }
        }}
        role="none"
        className="mt-auto"
      >
        <span className="text-[11px] font-medium text-indigo-500 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-300">
          👁 Preview AGENTS.md
        </span>
      </div>
    </button>
  );
}

// ─── Blank custom template ────────────────────────────────────────────────────

// ─── Template preview modal ───────────────────────────────────────────────────

function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: TemplateManifest;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch a preview of AGENTS.md via the compose API
    fetch("/api/preview-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: template.id }),
    })
      .then(async (r) => r.json())
      .then((data: { content?: string; error?: string }) => {
        setContent(data.content ?? data.error ?? "Could not load preview.");
      })
      .catch(() => setContent("Failed to fetch preview."))
      .finally(() => setLoading(false));
  }, [template.id]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="none"
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Preview</p>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {template.emoji} {template.name} — AGENTS.md
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="template-preview-close"
            className="rounded-full p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:bg-gray-700 hover:text-slate-700 dark:text-slate-300"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading preview…</p>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function blankCustomTemplate(): TemplateManifest & { custom: boolean } {
  return {
    id: `custom-${Date.now()}`,
    name: "",
    description: "",
    emoji: "✨",
    stack: "",
    audience: "developer",
    tags: [],
    variables: [],
    whyItMatters: "",
    impact: "",
    generatedFiles: [],
    custom: true,
  };
}

// ─── Custom template form ─────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: TemplateAudience[] = [
  "developer",
  "designer",
  "qa",
  "business",
  "researcher",
  "data",
  "devops",
];

function CustomTemplateForm({
  onSave,
  onCancel,
}: {
  onSave: (t: TemplateManifest & { custom: boolean }) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(blankCustomTemplate());
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    if (!draft.name.trim()) {
      setError("Template name is required.");
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onSave({ ...draft, tags });
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-800">✨ Create a Custom Template</h3>
      <div className="space-y-4">
        {/* Name + emoji row */}
        <div className="flex gap-3">
          <div className="w-20">
            <label className="mb-1 block text-xs font-medium text-slate-600">Emoji</label>
            <input
              type="text"
              maxLength={2}
              value={draft.emoji}
              data-testid="custom-template-emoji"
              onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Slack Bot Agent"
              value={draft.name}
              data-testid="custom-template-name"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea
            rows={2}
            placeholder="What is this template for?"
            data-testid="custom-template-description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Stack + Audience row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Stack / Tech</label>
            <input
              type="text"
              placeholder="e.g. Node.js, Slack SDK"
              data-testid="custom-template-stack"
              value={draft.stack}
              onChange={(e) => setDraft({ ...draft, stack: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-600">Audience</label>
            <select
              value={draft.audience}
              data-testid="custom-template-audience"
              onChange={(e) =>
                setDraft({
                  ...draft,
                  audience: e.target.value as TemplateAudience,
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Tags <span className="font-normal text-slate-400 dark:text-slate-500">(comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. slack, bot, ai"
            data-testid="custom-template-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            data-testid="custom-template-cancel"
            className="rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:bg-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            data-testid="custom-template-save"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add Template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main step ────────────────────────────────────────────────────────────────

export function StepChooseTemplate({ job, onUpdateJob, onNext }: StepProperties) {
  const [audienceFilter, setAudienceFilter] = useState<TemplateAudience | "all">("all");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<
    (TemplateManifest & { custom: boolean })[]
  >([]);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateManifest | null>(null);

  const allTemplates = [...builtInTemplates, ...customTemplates];

  const filtered =
    audienceFilter === "all"
      ? allTemplates
      : allTemplates.filter((t) => t.audience === audienceFilter);

  function select(templateId: string) {
    onUpdateJob({ templateId });
  }

  function handleCustomSave(t: TemplateManifest & { custom: boolean }) {
    setCustomTemplates((previous) => [...previous, t]);
    setShowCustomForm(false);
    onUpdateJob({ templateId: t.id });
  }

  return (
    <div>
      {previewTemplate && (
        <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Choose a Starter Template</h2>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Pick the base for your AI agent. Templates are tailored per role — you can also create a
        custom one.
      </p>

      {/* Audience filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {AUDIENCE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setAudienceFilter(tab.value)}
            data-testid={`template-audience-tab-${tab.value}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
              audienceFilter === tab.value
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:text-indigo-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={job.templateId === template.id}
            onSelect={() => select(template.id)}
            onPreview={() => setPreviewTemplate(template)}
          />
        ))}

        {/* + Custom Template card — only visible when form is hidden */}
        {!showCustomForm && (
          <button
            type="button"
            onClick={() => setShowCustomForm(true)}
            className="flex min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white dark:bg-gray-900 p-5 text-slate-400 dark:text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500"
          >
            <span className="text-3xl">＋</span>
            <span className="text-sm font-medium">Custom Template</span>
          </button>
        )}
      </div>

      {/* Custom template form — inline below the grid */}
      {showCustomForm && (
        <div className="mb-6">
          <CustomTemplateForm onSave={handleCustomSave} onCancel={() => setShowCustomForm(false)} />
        </div>
      )}

      {filtered.length === 0 && !showCustomForm && (
        <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          No templates for this audience yet. Create a custom one above!
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!job.templateId}
          data-testid="step-next-button"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next: Add Skills →
        </button>
      </div>
    </div>
  );
}
