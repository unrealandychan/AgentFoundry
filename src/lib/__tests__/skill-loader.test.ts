import { describe, it, expect } from "vitest";
import { parseSkillContent, serializeSkillToMarkdown } from "@/lib/skill-loader";

// ── Fixtures ────────────────────────────────────────────────────────────────

const VALID_MD = `---
name: code-reviewer
title: "Code Reviewer"
description: "Reviews code for quality and bugs."
user-invocable: true
tags: [engineering, qa]
compatibility: [nextjs, python, generic]
tooltip: "Automated code review"
---

# Code Reviewer — Quality Gate

You are a senior code reviewer. Your job is to find bugs.
`;

const MINIMAL_MD = `---
name: minimal-skill
title: "Minimal"
description: "A minimal skill."
tags: []
compatibility: []
---

# Minimal

You are minimal.
`;

const COLON_IN_VALUE_MD = `---
name: advanced-skill
title: "Advanced Skill: With Colon"
description: "A skill with colon in title."
user-invocable: true
tags: [advanced, testing]
compatibility: [generic]
---

# Advanced Skill

You are advanced.
`;

// ── parseSkillContent ─────────────────────────────────────────────────────────

describe("parseSkillContent", () => {
  it("parses a fully valid SKILL.md into a SkillManifest", () => {
    const result = parseSkillContent("code-reviewer", VALID_MD);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("code-reviewer");
    expect(result!.title).toBe("Code Reviewer");
    expect(result!.description).toBe("Reviews code for quality and bugs.");
    expect(result!.tags).toEqual(["engineering", "qa"]);
    expect(result!.compatibility).toEqual(["nextjs", "python", "generic"]);
    expect(result!.tooltip).toBe("Automated code review");
  });

  it("extracts personaText (body without H1 heading)", () => {
    const result = parseSkillContent("code-reviewer", VALID_MD);
    expect(result!.personaText).toContain("You are a senior code reviewer");
    expect(result!.personaText).not.toMatch(/^#\s/m);
  });

  it("uses frontmatter name over provided id", () => {
    const result = parseSkillContent("wrong-id", VALID_MD);
    expect(result!.id).toBe("code-reviewer");
  });

  it("falls back to provided id when frontmatter name is absent", () => {
    const noNameMd = VALID_MD.replace("name: code-reviewer\n", "");
    const result = parseSkillContent("fallback-id", noNameMd);
    expect(result!.id).toBe("fallback-id");
  });

  it("parses tags as array from flow sequence", () => {
    const result = parseSkillContent("code-reviewer", VALID_MD);
    expect(Array.isArray(result!.tags)).toBe(true);
    expect(result!.tags).toHaveLength(2);
  });

  it("returns null when title is missing", () => {
    const noTitle = VALID_MD.replace('title: "Code Reviewer"\n', "");
    const result = parseSkillContent("code-reviewer", noTitle);
    expect(result).toBeNull();
  });

  it("returns null when description is missing", () => {
    const noDesc = VALID_MD.replace('description: "Reviews code for quality and bugs."\n', "");
    const result = parseSkillContent("code-reviewer", noDesc);
    expect(result).toBeNull();
  });

  it("returns null when there is no frontmatter", () => {
    const result = parseSkillContent("bare-id", "# Just a heading\n\nNo frontmatter here.");
    expect(result).toBeNull();
  });

  it("handles empty tags array", () => {
    const result = parseSkillContent("minimal-skill", MINIMAL_MD);
    expect(result!.tags).toEqual([]);
  });

  it("handles tooltip being absent (undefined)", () => {
    const result = parseSkillContent("minimal-skill", MINIMAL_MD);
    expect(result!.tooltip).toBeUndefined();
  });

  it("handles titles with colons (gray-matter parses correctly)", () => {
    const result = parseSkillContent("advanced-skill", COLON_IN_VALUE_MD);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Advanced Skill: With Colon");
  });
});

// ── serializeSkillToMarkdown ──────────────────────────────────────────────────

describe("serializeSkillToMarkdown", () => {
  const SKILL = {
    id: "code-reviewer",
    title: "Code Reviewer",
    description: "Reviews code for quality and bugs.",
    personaText: "You are a senior code reviewer. Your job is to find bugs.",
    tags: ["engineering", "qa"],
    compatibility: ["nextjs", "python"],
    tooltip: undefined,
  };

  it("produces a string starting with ---", () => {
    const md = serializeSkillToMarkdown(SKILL);
    expect(md.startsWith("---")).toBe(true);
  });

  it("includes all frontmatter fields", () => {
    const md = serializeSkillToMarkdown(SKILL);
    expect(md).toContain("name: code-reviewer");
    expect(md).toContain('title: "Code Reviewer"');
    expect(md).toContain('description: "Reviews code for quality and bugs."');
    expect(md).toContain("user-invocable: true");
    expect(md).toContain("tags: [engineering, qa]");
    expect(md).toContain("compatibility: [nextjs, python]");
  });

  it("includes an H1 heading with skill title", () => {
    const md = serializeSkillToMarkdown(SKILL);
    expect(md).toContain("# Code Reviewer");
  });

  it("includes personaText in body", () => {
    const md = serializeSkillToMarkdown(SKILL);
    expect(md).toContain("You are a senior code reviewer");
  });

  it("omits tooltip field when tooltip is undefined", () => {
    const md = serializeSkillToMarkdown(SKILL);
    expect(md).not.toContain("tooltip:");
  });

  it("includes tooltip field when tooltip is set", () => {
    const md = serializeSkillToMarkdown({ ...SKILL, tooltip: "My tooltip" });
    expect(md).toContain('tooltip: "My tooltip"');
  });

  it("round-trips: serialize → parse → same fields", () => {
    const md = serializeSkillToMarkdown(SKILL);
    const parsed = parseSkillContent(SKILL.id, md);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(SKILL.id);
    expect(parsed!.title).toBe(SKILL.title);
    expect(parsed!.description).toBe(SKILL.description);
    expect(parsed!.tags).toEqual(SKILL.tags);
    expect(parsed!.compatibility).toEqual(SKILL.compatibility);
  });

  it("escapes double quotes in title", () => {
    const md = serializeSkillToMarkdown({ ...SKILL, title: 'Say "Hello"' });
    // Should not break frontmatter parsing
    const parsed = parseSkillContent("x", md);
    expect(parsed!.title).toBe('Say "Hello"');
  });
});
