import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { SummarizeChatRequestSchema } from "@/lib/schemas";

const SUMMARY_SYSTEM = `You are a session summarizer for a multi-agent AI system.
Given the conversation transcript below, write a concise structured Markdown summary.

Use EXACTLY this structure (no other headings):

## Summary

### Topics Discussed
- one bullet per distinct topic

### Agent Contributions
- **Agent Name**: what they specifically contributed

### Key Decisions & Outcomes
- one bullet per concrete decision or output produced

### Suggested Next Steps
- [ ] one actionable checkbox item

Rules: 150–250 words total. Be specific and actionable. Do not quote the transcript verbatim.`;

function buildTranscript(
  messages: Array<{ role: "user" | "assistant"; content: string; agentName?: string }>,
): string {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "User" : (message.agentName ?? "Agent");
      return `**${speaker}**: ${message.content}`;
    })
    .join("\n\n");
}

/** POST /api/test-agent/summarize — streams a structured Markdown summary of a chat session */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SummarizeChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on this server. Add it to .env.local." },
      { status: 503 },
    );
  }

  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  const transcript = buildTranscript(parsed.data.messages);

  const aiStream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    max_tokens: 600,
    messages: [
      { role: "system", content: SUMMARY_SYSTEM },
      {
        role: "user",
        content: `Here is the conversation transcript:\n\n${transcript}\n\nWrite the structured summary now.`,
      },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
