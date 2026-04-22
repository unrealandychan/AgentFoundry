import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { lintSkill } from "@/lib/skill-linter";
import type { LintResult } from "@/lib/skill-linter";

const GenerateSchema = z.object({
  action: z.literal("generate"),
  name: z.string().min(1).max(80),
  purpose: z.string().min(10).max(600),
});

const CompleteSchema = z.object({
  action: z.literal("complete"),
  content: z.string().min(1).max(40_000),
});

const BodySchema = z.discriminatedUnion("action", [GenerateSchema, CompleteSchema]);

const MAX_ITER = 5;
const PASS_SCORE = 85;

function makeClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

const SKILL_FORMAT_SYSTEM = `You are a SKILL.md expert. Skills follow this exact structure:

\`\`\`
---
name: kebab-case-name
description: "One sentence. Usage: /skill-name [arg] [--flag value]"
user-invocable: true
---

# Skill Title — Role Declaration

You are a [role]. Your job is to [goal]. Follow these phases exactly.

---

## Phase 1 — Parse Arguments

...instructions...

## Phase 2 — [Next Step]

...instructions...

## Output Format

\`\`\`
[exact template of what to produce]
\`\`\`

## Constraints

- Hard rule 1
- Hard rule 2
\`\`\`

Rules you must follow:
- Always include all frontmatter fields (name, description, user-invocable)
- The H1 must state the persona ("You are a …")
- Use numbered phases for multi-step workflows
- Output Format must show the exact structure
- Constraints must list non-negotiable rules
- Body should be 200–600 words (not too short, not bloated)
- Output only the raw SKILL.md content — no extra commentary`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeJSON(data: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data) + "\n");
}

function buildRefinePrompt(content: string, lint: LintResult): string {
  const failingLines = lint.checks
    .filter((c) => !c.passed)
    .map(
      (c) =>
        `### ❌ ${c.label} (${c.points} pts)\n` + `Diagnosis: ${c.detail}\n` + `Fix: ${c.hint}`,
    )
    .join("\n\n");

  const passingLines = lint.checks
    .filter((c) => c.passed)
    .map((c) => `- ✅ ${c.label}: ${c.detail}`)
    .join("\n");

  return (
    `## Skill Review — Score: ${lint.score}/100 (Grade ${lint.grade})\n\n` +
    `### What you already got right:\n${passingLines}\n\n` +
    `### What must be fixed to reach ${PASS_SCORE}+:\n\n${failingLines}\n\n` +
    `### Current content:\n\`\`\`markdown\n${content}\n\`\`\`\n\n` +
    `Return the complete corrected SKILL.md — fix EVERY failing check above. No commentary.`
  );
}

// ── Agentic loop ──────────────────────────────────────────────────────────────
// Generates → lints → refines in a loop until score ≥ PASS_SCORE or MAX_ITER.
// Streams NDJSON progress lines: { type, iteration, score, grade, failing, content? }

async function runAgenticLoop(
  client: OpenAI,
  firstPrompt: string,
  controller: ReadableStreamDefaultController,
) {
  let content = "";
  let lint: LintResult | null = null;

  for (let iter = 1; iter <= MAX_ITER; iter++) {
    const userPrompt = iter === 1 ? firstPrompt : buildRefinePrompt(content, lint!);

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SKILL_FORMAT_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: iter === 1 ? 0.6 : 0.25,
        max_tokens: 1400,
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      // Strip markdown code fences the model sometimes wraps around the output
      content = raw
        .replace(/^```\w*\n?/, "")
        .replace(/\n?```\s*$/, "")
        .trim();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replaceAll(/sk-[\w-]+/g, "[REDACTED]")
          : "OpenAI error";
      controller.enqueue(encodeJSON({ type: "error", error: message }));
      return;
    }

    lint = lintSkill(content);
    const passed = lint.score >= PASS_SCORE;
    const isLast = passed || iter === MAX_ITER;

    controller.enqueue(
      encodeJSON({
        type: isLast ? "done" : "progress",
        iteration: iter,
        score: lint.score,
        grade: lint.grade,
        failing: lint.checks.filter((c) => !c.passed).map((c) => c.label),
        ...(isLast ? { content } : {}),
      }),
    );

    if (isLast) break;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

function ndjsonStream(
  function_: (ctrl: ReadableStreamDefaultController) => void | Promise<void>,
): Response {
  return new Response(
    new ReadableStream({
      async start(ctrl) {
        await function_(ctrl);
        ctrl.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } },
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const client = makeClient();
  if (!client) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on this server." },
      { status: 503 },
    );
  }

  if (parsed.data.action === "generate") {
    const { name, purpose } = parsed.data;
    const firstPrompt =
      `Generate a complete SKILL.md for a skill called "${name}".\n` +
      `What it should do: ${purpose}\n\n` +
      `Produce a well-structured SKILL.md following the format exactly.`;

    return ndjsonStream(async (ctrl) => runAgenticLoop(client, firstPrompt, ctrl));
  }

  // action === "complete"
  const { content } = parsed.data;
  const lint = lintSkill(content);

  // Already passing — echo back immediately without burning tokens
  if (lint.score >= PASS_SCORE) {
    return ndjsonStream((ctrl) => {
      ctrl.enqueue(
        encodeJSON({
          type: "done",
          iteration: 1,
          score: lint.score,
          grade: lint.grade,
          failing: [],
          content,
        }),
      );
    });
  }

  return ndjsonStream(async (ctrl) =>
    runAgenticLoop(client, buildRefinePrompt(content, lint), ctrl),
  );
}
