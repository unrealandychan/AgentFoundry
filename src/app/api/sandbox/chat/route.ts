/**
 * /api/sandbox/chat
 *
 * Stateless streaming chat endpoint for the Skill Sandbox.
 * The client owns the full message history and sends it on every request.
 *
 * Request body:
 *   { personaText: string, messages: { role: "user"|"assistant", content: string }[] }
 *
 * Streams Server-Sent Events (text/event-stream):
 *   data: <token>\n\n   — incremental text chunks
 *   data: [DONE]\n\n    — end of stream
 */

import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(32_000),
});

const BodySchema = z.object({
  personaText: z.string().min(1).max(40_000),
  messages: z.array(MessageSchema).min(1).max(200),
});

const MAX_INSTRUCTIONS_CHARS = 24_000;

function truncatePersona(text: string): string {
  if (text.length <= MAX_INSTRUCTIONS_CHARS) return text;
  const keepHead = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.6);
  const keepTail = Math.floor(MAX_INSTRUCTIONS_CHARS * 0.35);
  return (
    text.slice(0, keepHead) +
    "\n\n[... middle sections trimmed to fit context window ...]\n\n" +
    text.slice(text.length - keepTail)
  );
}

function makeClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

export async function POST(request: NextRequest): Promise<Response> {
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

  const { personaText, messages } = parsed.data;
  const systemPrompt = truncatePersona(personaText);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      };

      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) send(JSON.stringify({ text: delta }));
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.replaceAll(/sk-[\w-]+/g, "[REDACTED]")
            : "OpenAI error";
        send(JSON.stringify({ error: message }));
      } finally {
        send("[DONE]");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
