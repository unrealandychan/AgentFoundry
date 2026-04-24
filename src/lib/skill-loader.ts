/**
 * skill-loader.ts
 *
 * Reads skills from the canonical `skills/<id>/SKILL.md` files on disk.
 * The SKILL.md frontmatter is the single source of truth — no skills.json needed.
 *
 * Required frontmatter fields:
 *   name          — kebab-case id (must match the folder name)
 *   title         — human-readable name shown in the UI
 *   description   — one-sentence description
 *   tags          — YAML list e.g. [engineering, production]
 *   compatibility — YAML list e.g. [nextjs, python, generic]
 *
 * Optional frontmatter fields:
 *   tooltip       — short hover tooltip for the skill card
 *   user-invocable — true/false
 *
 * The `personaText` field is extracted from the first "You are …" paragraph
 * in the body so it doesn't need to be duplicated in the frontmatter.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { SkillManifest } from "@/types";

/** Extract the full instruction body from the skill markdown (everything after the # Title heading). */
function extractPersonaText(body: string): string {
  // Strip the top-level # heading line (first non-empty line starting with #)
  const withoutTitle = body.replace(/^\s*#[^\n]*\n/, "").trimStart();
  return withoutTitle.trim();
}

/** Coerce a string or string[] YAML value into string[]. */
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // "a, b, c" or "a b c"
  return value.split(/[\s,]+/).filter(Boolean);
}

// ── Public API ────────────────────────────────────────────────────────────────

const SKILLS_DIR = path.join(process.cwd(), "skills");

/**
 * Parse raw SKILL.md string content into a SkillManifest.
 * `id` is used as a fallback when the frontmatter `name` field is absent.
 * Returns null if required fields (name/title/description) are missing.
 */
export function parseSkillContent(id: string, content: string): SkillManifest | null {
  let parsed;
  try {
    parsed = matter(content);
  } catch {
    return null;
  }

  const { data: fm, content: body } = parsed;
  const skillId = (fm["name"] as string | undefined) ?? id;
  const title = (fm["title"] as string | undefined) ?? "";
  const description = (fm["description"] as string | undefined) ?? "";

  if (!skillId || !title || !description) return null;

  return {
    id: skillId,
    title,
    description,
    personaText: extractPersonaText(body),
    tags: toArray(fm["tags"] as string | string[] | undefined),
    compatibility: toArray(fm["compatibility"] as string | string[] | undefined),
    tooltip: fm["tooltip"] as string | undefined,
  };
}

/**
 * Serialize a SkillManifest back to SKILL.md string format.
 * Used when persisting skills via file-backed stores (Local or S3).
 */
export function serializeSkillToMarkdown(skill: SkillManifest): string {
  const safeTitle = skill.title.replaceAll(String.raw`"`, String.raw`\"`);
  const safeDescription = skill.description.replaceAll(String.raw`"`, String.raw`\"`);

  const frontmatterLines = [
    "---",
    `name: ${skill.id}`,
    `title: "${safeTitle}"`,
    `description: "${safeDescription}"`,
    "user-invocable: true",
    `tags: [${skill.tags.join(", ")}]`,
    `compatibility: [${skill.compatibility.join(", ")}]`,
  ];

  if (skill.tooltip) {
    const safeTooltip = skill.tooltip.replaceAll(String.raw`"`, String.raw`\"`);
    frontmatterLines.push(`tooltip: "${safeTooltip}"`);
  }

  const bodyLines = ["---", "", `# ${skill.title}`, ""];

  if (skill.personaText) {
    bodyLines.push(skill.personaText, "");
  }

  return [...frontmatterLines, ...bodyLines].join("\n");
}

/**
 * Load a single skill from `skills/<id>/SKILL.md`.
 * Returns null if the file doesn't exist or is missing required fields.
 */
export async function loadSkillFromDisk(id: string): Promise<SkillManifest | null> {
  const content = await readFile(path.join(SKILLS_DIR, id, "SKILL.md"), "utf8").catch(() => null);
  if (content === null) return null;
  return parseSkillContent(id, content);
}

/**
 * Load all skills from the `skills/` directory.
 * Entries without a valid SKILL.md (e.g. `shared/`) are silently skipped.
 */
export async function loadAllSkillsFromDisk(): Promise<SkillManifest[]> {
  let entries: string[];
  try {
    entries = await readdir(SKILLS_DIR);
  } catch {
    return [];
  }

  const results = await Promise.all(entries.map(async (entry) => loadSkillFromDisk(entry)));
  return results.filter((skill): skill is SkillManifest => skill !== null);
}
