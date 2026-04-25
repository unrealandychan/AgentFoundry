"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { GenerationJob, SkillManifest, TemplateManifest } from "@/types";
import { skills as staticSkills, templates } from "@/lib/registry";
import { GitHubImportPanel } from "@/components/wizard/github-import-panel";
import { Tooltip } from "@/components/ui/tooltip";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ─── Category config ──────────────────────────────────────────────────────────

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
  {
    key: "sales",
    label: "💼 Sales",
    description: "Cold outreach, copywriting, prospect research",
  },
  {
    key: "legal",
    label: "⚖️ Legal & Compliance",
    description: "Contract review, risk, redlines",
  },
  {
    key: "hr",
    label: "🤝 HR & People",
    description: "Onboarding, welcome packs, 30-60-90 plans",
  },
  {
    key: "design",
    label: "🎨 Design & UX",
    description: "User research, JTBD, affinity mapping",
  },
] as const;

type SkillCategory = (typeof CATEGORIES)[number]["key"];

const SKILL_CATEGORY: Record<string, SkillCategory> = {
  // Engineering
  "clean-code-ddd": "engineering",
  "senior-engineer": "engineering",
  debugger: "engineering",
  "test-engineer": "engineering",
  "refactoring-expert": "engineering",
  "security-reviewer": "engineering",
  // Workflow
  "commit-hygiene": "workflow",
  "coding-mentor": "workflow",
  "spec-writer": "workflow",
  // Documentation
  "documentation-writer": "documentation",
  "technical-writer": "documentation",
  // Marketing & Business
  "brand-voice-guardian": "marketing",
  "social-media-creator": "marketing",
  "email-marketing-writer": "marketing",
  "customer-success-writer": "marketing",
  "pitch-deck-writer": "marketing",
  "market-research-analyst": "marketing",
  // Sales
  "sales-copywriter": "sales",
  "prospect-researcher": "sales",
  // Legal & Compliance
  "legal-proofreader": "legal",
  "contract-reviewer": "legal",
  // HR & People
  "onboarding-coordinator": "hr",
  // Design & UX
  "ux-researcher": "design",
};

// ─── Recommendation engine ────────────────────────────────────────────────────

function getRecommendedIds(template: TemplateManifest | undefined): string[] {
  if (!template) return [];
  const { audience, tags } = template;
  const ids = new Set<string>();

  if (audience === "developer") {
    ids.add("senior-engineer");
    ids.add("clean-code-ddd");
    ids.add("commit-hygiene");
    if (tags.some((t) => ["ai", "python", "typescript", "web"].includes(t))) {
      ids.add("security-reviewer");
    }
    if (tags.some((t) => ["testing", "qa"].includes(t))) {
      ids.add("test-engineer");
    }
  }

  if (audience === "qa" || tags.some((t) => ["qa", "testing"].includes(t))) {
    ids.add("test-engineer");
    ids.add("debugger");
    ids.add("documentation-writer");
  }

  if (audience === "researcher" || tags.some((t) => ["rag", "mcp"].includes(t))) {
    ids.add("documentation-writer");
    ids.add("spec-writer");
    ids.add("security-reviewer");
  }

  if (audience === "designer") {
    ids.add("documentation-writer");
    ids.add("spec-writer");
    ids.add("coding-mentor");
  }

  if (audience === "business") {
    ids.add("spec-writer");
    ids.add("documentation-writer");
    if (tags.some((t) => ["marketing", "copywriting"].includes(t))) {
      ids.add("brand-voice-guardian");
      ids.add("social-media-creator");
      ids.add("email-marketing-writer");
    } else if (tags.some((t) => ["legal", "compliance", "contracts"].includes(t))) {
      ids.add("legal-proofreader");
      ids.add("contract-reviewer");
    } else if (tags.some((t) => ["hr", "onboarding", "people", "hiring"].includes(t))) {
      ids.add("onboarding-coordinator");
      ids.add("technical-writer");
    } else if (tags.some((t) => ["sales", "outreach", "crm", "prospecting"].includes(t))) {
      ids.add("sales-copywriter");
      ids.add("prospect-researcher");
    } else {
      ids.add("pitch-deck-writer");
      ids.add("market-research-analyst");
    }
  }

  if (audience === "data") {
    ids.add("senior-engineer");
    ids.add("documentation-writer");
    ids.add("security-reviewer");
  }

  if (audience === "devops") {
    ids.add("security-reviewer");
    ids.add("commit-hygiene");
    ids.add("test-engineer");
  }

  return [...ids];
}

// ─── Create skill panel ──────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\s\w-]/g, "")
    .trim()
    .replaceAll(/\s+/g, "-");
}

function CreateSkillPanel({ onCreated }: { onCreated: (skill: SkillManifest) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [persona, setPersona] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400";

  const handleSave = useCallback(async () => {
    if (!title.trim() || !persona.trim()) {
      setError("Title and instructions are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const skill: SkillManifest = {
      id: slugify(title) || `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || title.trim(),
      personaText: persona.trim(),
      tags,
      compatibility: ["generic"],
    };
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skill),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save skill");
      }
      onCreated(skill);
      setTitle("");
      setDescription("");
      setPersona("");
      setTagsRaw("");
      setOpen(false);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [title, description, persona, tagsRaw, onCreated]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="create-skill-open-button"
        className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:border-indigo-400 hover:text-indigo-600 dark:text-indigo-400"
      >
        <span className="text-lg leading-none">+</span>
        Create a custom skill…
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-semibold text-slate-900 dark:text-white">✏️ Create Custom Skill</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            data-testid="custom-skill-title"
            value={title}
            placeholder="e.g. Podcast Script Writer"
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Short description</label>
          <input
            type="text"
            data-testid="custom-skill-description"
            value={description}
            placeholder="One-line summary shown on the skill card"
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Instructions / Persona <span className="text-red-500">*</span>
          </label>
          <textarea
            data-testid="custom-skill-persona"
            value={persona}
            placeholder={`You are an expert podcast script writer.\nWrite engaging, conversational scripts…`}
            rows={5}
            onChange={(event) => setPersona(event.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            These instructions become the agent's system prompt when this skill is selected.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Tags <span className="text-slate-400 dark:text-slate-500">(comma-separated)</span>
          </label>
          <input
            type="text"
            data-testid="custom-skill-tags"
            value={tagsRaw}
            placeholder="e.g. writing, audio, marketing"
            onChange={(event) => setTagsRaw(event.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 dark:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            data-testid="custom-skill-save"
            disabled={saving || !title.trim() || !persona.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save & Add Skill"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  selected,
  onToggle,
  highlighted = false,
}: {
  skill: SkillManifest;
  selected: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      data-testid={`skill-card-${skill.id}`}
      className={`group relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${
        selected
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400"
          : (highlighted
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-500 hover:border-indigo-300"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300")
      }`}
    >
      {/* Checkbox toggle — takes up most of the card */}
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-start gap-3 text-left"
        aria-label={`${selected ? "Deselect" : "Select"} ${skill.title}`}
      >
        <div
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            selected ? "border-indigo-600 bg-indigo-600 dark:border-indigo-400 dark:bg-indigo-400" : "border-gray-300 bg-white dark:bg-gray-900"
          }`}
        >
          {selected && <span className="text-xs text-white">✓</span>}
        </div>
        <div>
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

      {/* ▶ Test button — appears on hover */}
      <a
        href={`/sandbox?skill=${skill.id}`}
        target="_blank"
        rel="noreferrer"
        data-testid={`skill-test-${skill.id}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-3 top-3 hidden rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 shadow-sm transition hover:bg-indigo-50 group-hover:flex"
        title="Open in Skill Sandbox"
      >
        ▶ Test
      </a>
    </div>
  );
}

export function StepAddSkills({ job, onUpdateJob, onNext, onBack }: StepProperties) {
  const selectedIds = job.skillIds ?? [];
  const staticIds = useMemo(() => new Set(staticSkills.map((s) => s.id)), []);

  // Seed local display state from job.extraSkills (restored from localStorage or parent)
  const [importedSkills, setImportedSkills] = useState<SkillManifest[]>(() =>
    (job.extraSkills ?? []).filter((s) => !staticIds.has(s.id)),
  );
  const [customSkills, setCustomSkills] = useState<SkillManifest[]>([]);
  const [builtInSkills, setBuiltInSkills] = useState<SkillManifest[]>(staticSkills);
  const [skillsLoading, setSkillsLoading] = useState(false);

  useEffect(() => {
    setSkillsLoading(true);
    fetch("/api/skills")
      .then(async (res) => res.json())
      .then((data: SkillManifest[]) => {
        if (!Array.isArray(data)) return;
        setBuiltInSkills(data);
        const userCreated = data.filter((s) => !staticIds.has(s.id));
        if (userCreated.length > 0) {
          setCustomSkills((previous) => {
            const previousIds = new Set(previous.map((s) => s.id));
            const merged = [...previous];
            for (const skill of userCreated) {
              if (!previousIds.has(skill.id)) merged.push(skill);
            }
            return merged;
          });
        }
      })
      .catch(() => {
        /* keep static fallback on error */
      })
      .finally(() => setSkillsLoading(false));
  }, [staticIds]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === job.templateId),
    [job.templateId],
  );

  const recommendedIds = useMemo(
    () => new Set(getRecommendedIds(selectedTemplate)),
    [selectedTemplate],
  );

  // Keep job.extraSkills in sync with the local display arrays.
  // onUpdateJob is stable (useCallback [] in page.tsx) — intentionally omitted from deps.
  useEffect(() => {
    const allExtra = [...customSkills, ...importedSkills];
    onUpdateJob({ extraSkills: allExtra });
  }, [customSkills, importedSkills, onUpdateJob]);

  function toggle(skillId: string) {
    const updated = selectedIds.includes(skillId)
      ? selectedIds.filter((id) => id !== skillId)
      : [...selectedIds, skillId];
    onUpdateJob({ skillIds: updated });
  }

  function handleImport(skills: SkillManifest[]) {
    setImportedSkills((previous) => {
      const merged = [...previous];
      for (const skill of skills) {
        if (!merged.some((existing) => existing.id === skill.id)) merged.push(skill);
      }
      return merged;
    });
    const newIds = skills
      .filter((skill) => !selectedIds.includes(skill.id))
      .map((skill) => skill.id);
    if (newIds.length > 0) onUpdateJob({ skillIds: [...selectedIds, ...newIds] });
  }

  function handleCreated(skill: SkillManifest) {
    setCustomSkills((previous) =>
      previous.some((existing) => existing.id === skill.id) ? previous : [...previous, skill],
    );
    if (!selectedIds.includes(skill.id)) {
      onUpdateJob({ skillIds: [...selectedIds, skill.id] });
    }
  }

  const recommendedSkills = builtInSkills.filter((s) => recommendedIds.has(s.id));
  const skillsByCategory = CATEGORIES.map((cat) => ({
    ...cat,
    skills: builtInSkills.filter(
      (s) => SKILL_CATEGORY[s.id] === cat.key && !recommendedIds.has(s.id),
    ),
  })).filter((cat) => cat.skills.length > 0);

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Add Skill Packs</h2>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Select built-in skills or import from a public GitHub repo. You can skip this step.
        {skillsLoading && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">Loading skills…</span>}
      </p>

      <div className="mb-6">
        <GitHubImportPanel onImport={handleImport} />
      </div>

      <div className="mb-6">
        <CreateSkillPanel onCreated={handleCreated} />
      </div>

      {/* Custom skills created inline */}
      {customSkills.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">✏️ My Skills</p>
            <span className="text-xs text-slate-400 dark:text-slate-500">Created by you</span>
            <span className="ml-auto rounded-full bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
              {customSkills.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {customSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                selected={selectedIds.includes(skill.id)}
                onToggle={() => toggle(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Imported skills */}
      {importedSkills.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">📥 Imported Skills</p>
            <span className="text-xs text-slate-400 dark:text-slate-500">From GitHub</span>
            <span className="ml-auto rounded-full bg-slate-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
              {importedSkills.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {importedSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                selected={selectedIds.includes(skill.id)}
                onToggle={() => toggle(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommended for selected template */}
      {recommendedSkills.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-baseline gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              ⭐ Recommended for {selectedTemplate?.name ?? "this template"}
            </p>
            <span className="text-xs text-slate-400 dark:text-slate-500">Best match based on your template</span>
            <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
              {recommendedSkills.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recommendedSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                selected={selectedIds.includes(skill.id)}
                highlighted
                onToggle={() => toggle(skill.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Remaining skills grouped by category */}
      {skillsByCategory.map((cat) => (
        <div key={cat.key} className="mb-6">
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
                selected={selectedIds.includes(skill.id)}
                onToggle={() => toggle(skill.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          data-testid="skills-back-button"
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
          Next: Integrations →
        </button>
      </div>
    </div>
  );
}
