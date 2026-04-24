import { describe, it, expect } from "vitest";
import { lintSkill } from "@/lib/skill-linter";

// ── Helpers ─────────────────────────────────────────────────────────────────

const PERFECT_SKILL = `---
name: test-skill
title: "Test Skill"
description: "A comprehensive test skill for unit testing."
user-invocable: true
tags: [testing, qa]
compatibility: [generic]
---

# Test Skill — QA Expert

You are a senior QA engineer. Your job is to ensure software quality across all
stages of the development lifecycle.

## Phase 1 — Analyse

Review the input carefully and identify all issues. Examine the code, configuration,
or artefact under test with a methodical approach.

List every problem you find, ranked by severity. Be thorough and precise in your
analysis. Consider edge cases, boundary conditions, and failure modes. Document
your findings clearly with direct evidence from the provided content. Cross-reference
related issues where patterns emerge, and note any systemic risks.

## Phase 2 — Report

Produce a structured report. Include your recommendations for fixes and preventative
measures for the future.

The report should be actionable, prioritised, and specific. Each issue should include
a suggested remediation with clear reasoning. Provide estimated effort levels where
possible. Distinguish between blocking defects and advisory improvements so the
recipient can triage effectively.

## Output Format

Return a markdown report with sections: Summary, Issues (ranked by severity), and
Recommendations. Use tables where appropriate for clarity. Include a defect count
at the top.

## Constraints

- Maximum 2000 words per report.
- Use plain English, no jargon.
- Always include a severity rating: Critical / High / Medium / Low.
- Never fabricate issues that are not evidenced in the input.
`;

function makeSkill(overrides: Record<string, string> = {}) {
  const base = {
    frontmatter: `---
name: my-skill
title: "My Skill"
description: "Does something useful."
user-invocable: true
tags: [generic]
compatibility: [generic]
---`,
    body: `
# My Skill — A Helper

You are a helpful assistant. Your job is to help with tasks.

## Phase 1 — Do Thing

Carefully do the thing. Think step by step, consider all edge cases,
and produce a thorough result. The more detail you provide, the better.

## Phase 2 — Review Result

Review what you produced in Phase 1. Verify correctness and completeness.
Make corrections as needed. Add missing details. Confirm your output
addresses the original request fully.

## Output Format

Return a structured markdown response with clear sections and labels.
Include a summary at the top and detailed results below.

## Constraints

- Be concise but complete.
- Never skip steps.
- Always verify your output.
`,
  };
  const content = (overrides.frontmatter ?? base.frontmatter) + "\n" + (overrides.body ?? base.body);
  return content;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("lintSkill", () => {
  describe("perfect skill", () => {
    it("scores 100 and returns grade A", () => {
      const result = lintSkill(PERFECT_SKILL);
      expect(result.score).toBe(result.maxScore);
      expect(result.grade).toBe("A");
    });

    it("all checks pass", () => {
      const result = lintSkill(PERFECT_SKILL);
      for (const check of result.checks) {
        expect(check.passed, `check ${check.id} should pass`).toBe(true);
        expect(check.earned).toBe(check.points);
      }
    });

    it("maxScore equals sum of all check points", () => {
      const result = lintSkill(PERFECT_SKILL);
      const sumPoints = result.checks.reduce((acc, c) => acc + c.points, 0);
      expect(result.maxScore).toBe(sumPoints);
      // Sanity: maxScore should be a positive integer
      expect(result.maxScore).toBeGreaterThan(0);
    });
  });

  describe("missing frontmatter", () => {
    it("fails has-frontmatter check", () => {
      const result = lintSkill("# My Skill\n\nYou are a helper.\n");
      const check = result.checks.find((c) => c.id === "has-frontmatter")!;
      expect(check.passed).toBe(false);
      expect(check.earned).toBe(0);
    });

    it("returns grade F when frontmatter is absent", () => {
      const result = lintSkill("Just plain text without any structure whatsoever.");
      expect(result.grade).toBe("F");
    });
  });

  describe("frontmatter fields", () => {
    it("fails frontmatter-name when name is missing", () => {
      const content = makeSkill({
        frontmatter: `---
title: "No Name Skill"
description: "Missing name field."
user-invocable: true
---`,
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "frontmatter-name")!;
      expect(check.passed).toBe(false);
    });

    it("passes frontmatter-name when name is present", () => {
      const result = lintSkill(makeSkill());
      const check = result.checks.find((c) => c.id === "frontmatter-name")!;
      expect(check.passed).toBe(true);
    });

    it("fails frontmatter-description when description is missing", () => {
      const content = makeSkill({
        frontmatter: `---
name: my-skill
title: "My Skill"
user-invocable: true
---`,
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "frontmatter-description")!;
      expect(check.passed).toBe(false);
    });

    it("fails frontmatter-invocable when user-invocable is missing", () => {
      const content = makeSkill({
        frontmatter: `---
name: my-skill
title: "My Skill"
description: "Does things."
---`,
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "frontmatter-invocable")!;
      expect(check.passed).toBe(false);
    });

    it("fails frontmatter-invocable when user-invocable is false", () => {
      const content = makeSkill({
        frontmatter: `---
name: my-skill
title: "My Skill"
description: "Does things."
user-invocable: false
---`,
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "frontmatter-invocable")!;
      expect(check.passed).toBe(false);
    });
  });

  describe("h1 heading", () => {
    it("fails h1-heading when no H1 is present", () => {
      const content = makeSkill({
        body: "\nYou are a helper.\n\n## Phase 1\n\nDo things.\n\n## Output Format\n\nReturn markdown.\n\n## Constraints\n\nNone.",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "h1-heading")!;
      expect(check.passed).toBe(false);
    });

    it("passes h1-heading when H1 is present", () => {
      const result = lintSkill(makeSkill());
      const check = result.checks.find((c) => c.id === "h1-heading")!;
      expect(check.passed).toBe(true);
    });
  });

  describe("persona statement", () => {
    it("fails persona-statement when 'You are' is absent", () => {
      const content = makeSkill({
        body: "\n# My Skill — Helper\n\nThis is a skill for testing.\n\n## Phase 1\n\nDo thing.\n\n## Phase 2\n\nDone.\n\n## Output Format\n\nMarkdown.\n\n## Constraints\n\nNone.",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "persona-statement")!;
      expect(check.passed).toBe(false);
    });

    it("passes persona-statement with 'you are' (case-insensitive)", () => {
      const result = lintSkill(makeSkill());
      const check = result.checks.find((c) => c.id === "persona-statement")!;
      expect(check.passed).toBe(true);
    });
  });

  describe("phase sections", () => {
    it("fails phase-sections with only 1 H2", () => {
      const content = makeSkill({
        body: "\n# My Skill — Helper\n\nYou are a helper.\n\n## Phase 1\n\nDo the thing thoroughly.\n\n",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "phase-sections")!;
      expect(check.passed).toBe(false);
    });

    it("passes phase-sections with 2+ H2s", () => {
      const result = lintSkill(makeSkill());
      const check = result.checks.find((c) => c.id === "phase-sections")!;
      expect(check.passed).toBe(true);
    });

    it("fails output-format when ## Output Format is absent", () => {
      const content = makeSkill({
        body: "\n# My Skill\n\nYou are a helper.\n\n## Phase 1\n\nDo things.\n\n## Phase 2\n\nDone.\n\n## Constraints\n\nBe careful.",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "output-format")!;
      expect(check.passed).toBe(false);
    });

    it("fails constraints when ## Constraints is absent", () => {
      const content = makeSkill({
        body: "\n# My Skill\n\nYou are a helper.\n\n## Phase 1\n\nDo things.\n\n## Phase 2\n\nDone.\n\n## Output Format\n\nReturn markdown.\n",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "constraints")!;
      expect(check.passed).toBe(false);
    });
  });

  describe("min-length", () => {
    it("fails when body is under 150 words", () => {
      const content = makeSkill({
        body: "\n# Tiny\n\nYou are a helper. Do things.\n\n## A\n\nShort.\n\n## B\n\nAlso short.\n\n## Output Format\n\nMarkdown.\n\n## Constraints\n\nBe good.",
      });
      const result = lintSkill(content);
      const check = result.checks.find((c) => c.id === "min-length")!;
      expect(check.passed).toBe(false);
    });

    it("passes when body has 150+ words", () => {
      const result = lintSkill(PERFECT_SKILL);
      const check = result.checks.find((c) => c.id === "min-length")!;
      expect(check.passed).toBe(true);
    });
  });

  describe("grade boundaries", () => {
    it("returns B for score between 75% and 89%", () => {
      // Score 81/90 = 90% — need to craft a skill that gets ~80%
      // Skip output-format (15pts) and constraints (10pts) = 65/90 = 72% → C
      // Skip only constraints (10pts) = 80/90 = 88.8% → B
      const content = makeSkill({
        body: `
# My Skill — Helper

You are a helpful assistant. Your job is to help with tasks.

## Phase 1 — Do Thing

Carefully do the thing. Think step by step, consider all edge cases,
and produce a thorough result. The more detail you provide, the better.

## Phase 2 — Review Result

Review what you produced in Phase 1. Verify correctness and completeness.
Make corrections as needed. Add missing details. Confirm your output
addresses the original request fully.

## Output Format

Return a structured markdown response with clear sections and labels.
Include a summary at the top and detailed results below.
`,
      });
      const result = lintSkill(content);
      // constraints check fails → -10pts = 80/90 = 88.8% → B
      expect(result.grade).toBe("B");
    });

    it("returns F for empty string", () => {
      const result = lintSkill("");
      expect(result.grade).toBe("F");
    });
  });

  describe("check structure integrity", () => {
    it("always returns a consistent number of checks", () => {
      const countFull = lintSkill(PERFECT_SKILL).checks.length;
      const countEmpty = lintSkill("").checks.length;
      // Both runs must return same number of checks
      expect(countFull).toBe(countEmpty);
      // Should have at least 8 meaningful checks
      expect(countFull).toBeGreaterThanOrEqual(8);
    });

    it("earned never exceeds points for any check", () => {
      const result = lintSkill(PERFECT_SKILL);
      for (const check of result.checks) {
        expect(check.earned).toBeLessThanOrEqual(check.points);
      }
    });

    it("score equals sum of earned values", () => {
      const result = lintSkill(PERFECT_SKILL);
      const sumEarned = result.checks.reduce((acc, c) => acc + c.earned, 0);
      expect(result.score).toBe(sumEarned);
    });

    it("detail is always a non-empty string", () => {
      for (const content of [PERFECT_SKILL, "", "no frontmatter"]) {
        const result = lintSkill(content);
        for (const check of result.checks) {
          expect(check.detail, `check ${check.id} detail`).toBeTruthy();
        }
      }
    });
  });
});
