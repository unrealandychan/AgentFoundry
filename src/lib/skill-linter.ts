/**
 * Skill linter — checks SKILL.md content against the canonical structure.
 * Pure function, no I/O, no dependencies.
 */

export interface LintCheck {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  earned: number;
  hint: string;
  /** Content-aware diagnostic: what was found / what is specifically wrong. */
  detail: string;
}

export interface LintResult {
  score: number;
  maxScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: LintCheck[];
}

function parseFrontmatter(content: string): { body: string; fm: string } {
  if (!content.startsWith("---")) return { body: content, fm: "" };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { body: content, fm: "" };
  return {
    fm: content.slice(3, end),
    body: content.slice(end + 4),
  };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Extract the value of a frontmatter field, or "" if absent. */
function fmField(fm: string, field: string): string {
  const match = new RegExp(`^\\s*${field}\\s*:\\s*(.+)`, "m").exec(fm);
  return match ? match[1].trim() : "";
}

/** Return all ## headings found in body, in order. */
function listH2s(body: string): string[] {
  return (body.match(/^##\s+.+/gm) ?? []).map((heading) => heading.replace(/^##\s+/, "").trim());
}

/** First non-empty line of the body. */
function firstBodyLine(body: string): string {
  return body.split("\n").find((line) => line.trim()) ?? "(empty)";
}

/** Format a list of section names as a quoted comma-separated string. */
function formatSections(sections: string[]): string {
  return sections.map((heading) => `"${heading}"`).join(", ");
}

function invocableDetail(value: string): string {
  if (value === "true") return "user-invocable: true ✓";
  if (value) return `user-invocable: ${value} — must be exactly \`true\`.`;
  return "No `user-invocable` field found. Add `user-invocable: true` to the frontmatter.";
}

function phaseSectionDetail(sections: string[]): string {
  if (sections.length >= 2) {
    return `Found ${sections.length} sections: ${formatSections(sections)} ✓`;
  }
  if (sections.length === 1) {
    return `Only 1 section found: "${sections[0]}". Add at least one more \`##\` phase (e.g. \`## Phase 2 — Output\`).`;
  }
  return "No `##` sections found. Add phases like `## Phase 1 — Analyze`, `## Phase 2 — Output`.";
}

function missingSectionDetail(sectionName: string, sections: string[], addHint: string): string {
  if (sections.length > 0) {
    return `No \`## ${sectionName}\` section. Current sections: ${formatSections(sections)}. ${addHint}`;
  }
  return `No sections at all. ${addHint}`;
}

export function lintSkill(content: string): LintResult {
  const { fm, body } = parseFrontmatter(content);
  const h2s = listH2s(body);
  const words = wordCount(body);
  const nameValue = fmField(fm, "name");
  const descValue = fmField(fm, "description");
  const invocableValue = fmField(fm, "user-invocable");
  const h1Match = /^#\s+\S.+/m.exec(body);
  const personaMatch = /you are\b.+/i.exec(body);
  const hasOutputFormat = /^##\s+output format/im.test(body);
  const hasConstraints = /^##\s+constraints?/im.test(body);

  const checks: LintCheck[] = [
    // ── Frontmatter ──────────────────────────────────────────────
    {
      id: "has-frontmatter",
      label: "YAML frontmatter block",
      passed: fm !== "",
      points: 8,
      earned: 0,
      hint: "Wrap the top of the file with --- ... --- and add fields inside.",
      detail:
        fm === ""
          ? "No `---` block found at the start of the file. The file must begin with `---` followed by YAML fields and closing `---`."
          : "Frontmatter block found ✓",
    },
    {
      id: "frontmatter-name",
      label: "`name` field in frontmatter",
      passed: /^\s*name\s*:/m.test(fm),
      points: 10,
      earned: 0,
      hint: "Add `name: your-skill-name` (kebab-case) inside the frontmatter block.",
      detail:
        nameValue === ""
          ? "No `name:` field in frontmatter. Add: `name: your-skill-name` (kebab-case, e.g. `code-reviewer`)."
          : `name: ${nameValue} ✓`,
    },
    {
      id: "frontmatter-description",
      label: "`description` field in frontmatter",
      passed: /^\s*description\s*:/m.test(fm),
      points: 10,
      earned: 0,
      hint: 'Add `description: "Short description. Usage: /skill-name [args]"` in frontmatter.',
      detail:
        descValue === ""
          ? 'No `description:` field in frontmatter. Add: `description: "One sentence. Usage: /skill-name [args]"`.'
          : `description: ${descValue} ✓`,
    },
    {
      id: "frontmatter-invocable",
      label: "`user-invocable: true` in frontmatter",
      passed: /^\s*user-invocable\s*:\s*true/m.test(fm),
      points: 5,
      earned: 0,
      hint: "Add `user-invocable: true` so the skill appears in agent rosters.",
      detail: invocableDetail(invocableValue),
    },

    // ── H1 heading & persona ──────────────────────────────────────
    {
      id: "h1-heading",
      label: "H1 title heading (`# Title — Role`)",
      passed: h1Match !== null,
      points: 8,
      earned: 0,
      hint: "Add a `# Skill Name — Short Role Description` line after the frontmatter.",
      detail:
        h1Match === null
          ? `No \`# Heading\` found after frontmatter. First body line is: \`${firstBodyLine(body)}\`. Add a title like \`# Code Reviewer — Automated Review Agent\`.`
          : `Found: \`${h1Match[0].trim()}\` ✓`,
    },
    {
      id: "persona-statement",
      label: "Persona statement (`You are …`)",
      passed: personaMatch !== null,
      points: 10,
      earned: 0,
      hint: 'Open the body with "You are a [role]. Your job is to …" to define the AI persona.',
      detail:
        personaMatch === null
          ? `No "You are …" statement found. First body line is: \`${firstBodyLine(body)}\`. Add an opening like "You are a senior code reviewer. Your job is to …".`
          : `Found: "${personaMatch[0].trim().slice(0, 80)}${personaMatch[0].length > 80 ? "…" : ""}" ✓`,
    },

    // ── Phases / H2 sections ──────────────────────────────────────
    {
      id: "phase-sections",
      label: "At least 2 `##` sections (phases / steps)",
      passed: h2s.length >= 2,
      points: 15,
      earned: 0,
      hint: "Break the skill into phases using `## Phase N — Name` headings (minimum 2 phases).",
      detail: phaseSectionDetail(h2s),
    },
    {
      id: "output-format",
      label: "`## Output Format` section",
      passed: hasOutputFormat,
      points: 15,
      earned: 0,
      hint: "Add a `## Output Format` section that shows the exact structure the AI should return.",
      detail: hasOutputFormat
        ? "`## Output Format` section found ✓"
        : missingSectionDetail(
            "Output Format",
            h2s,
            "Add `## Output Format` with a template showing exactly what to return.",
          ),
    },
    {
      id: "constraints",
      label: "`## Constraints` section",
      passed: hasConstraints,
      points: 10,
      earned: 0,
      hint: "Add a `## Constraints` section listing hard rules (character limits, tone, etc.).",
      detail: hasConstraints
        ? "`## Constraints` section found ✓"
        : missingSectionDetail(
            "Constraints",
            h2s,
            "Add `## Constraints` listing non-negotiable rules.",
          ),
    },

    // ── Content depth ─────────────────────────────────────────────
    {
      id: "min-length",
      label: "Minimum content depth (≥ 150 words in body)",
      passed: words >= 150,
      points: 9,
      earned: 0,
      hint: `Body is ${words} words. Add more instructions to reach 150+.`,
      detail:
        words >= 150
          ? `Body has ${words} words ✓`
          : `Body has only ${words} words — ${150 - words} more words needed. Expand the phase instructions, add examples, or flesh out constraints.`,
    },
  ];

  // Apply earned points
  for (const check of checks) {
    check.earned = check.passed ? check.points : 0;
  }

  const maxScore = checks.reduce((accumulator, c) => accumulator + c.points, 0);
  const score = checks.reduce((accumulator, c) => accumulator + c.earned, 0);

  const pct = score / maxScore;
  let grade: LintResult["grade"];
  if (pct >= 0.9) grade = "A";
  else if (pct >= 0.75) grade = "B";
  else if (pct >= 0.55) grade = "C";
  else if (pct >= 0.35) grade = "D";
  else grade = "F";

  return { score, maxScore, grade, checks };
}
