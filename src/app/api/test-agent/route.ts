import type { NextRequest } from "next/server";
import { setDefaultModelProvider, setOpenAIAPI, setTracingDisabled, OpenAIProvider } from "@openai/agents";
import { TestAgentRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { scheduleWorkspaceCleanup } from "@/lib/workspace-cleanup";
import { buildWorkspaceContext } from "@/lib/agent-runner/workspace";
import { buildHistory } from "@/lib/agent-runner/history";
import { createAgents } from "@/lib/agent-runner/agents";
import { streamSolo, streamReflect, streamCollaborate } from "@/lib/agent-runner/stream";

export async function POST(request: NextRequest) {
  // checkRateLimit imported for future use (reserved hook)
  void checkRateLimit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = TestAgentRequestSchema.safeParse(body);
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

  // Configure the SDK model provider so OPENAI_BASE_URL is respected. The SDK does not
  // auto-read OPENAI_BASE_URL — we pass it explicitly via OpenAIProvider.
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  setDefaultModelProvider(new OpenAIProvider({ apiKey, ...(baseURL ? { baseURL } : {}) }));
  // Use Chat Completions API (universally supported by proxies). The SDK defaults to
  // the newer Responses API (/v1/responses) which many proxies don't implement.
  setOpenAIAPI("chat_completions");
  // Disable tracing — it always targets api.openai.com regardless of baseURL, causing
  // 401s when using a proxy key. Safe to disable globally.
  setTracingDisabled(true);

  const { agents, message: userMessage, history, model, sessionId, collaborate, reflective, rounds } =
    parsed.data;

  const workspaceContext = await buildWorkspaceContext(sessionId);
  const activeModel = model ?? "gpt-4o-mini";

  const { sdkAgents, entryAgent } = createAgents(agents, activeModel, workspaceContext);

  const historyItems = buildHistory(history ?? []);
  const conversationInput = [...historyItems, { role: "user" as const, content: userMessage }];

  scheduleWorkspaceCleanup();

  let readable: ReadableStream;

  if (collaborate && sdkAgents.length > 1) {
    readable = streamCollaborate(
      sdkAgents,
      agents,
      conversationInput,
      userMessage,
      activeModel,
      reflective ?? false,
      rounds ?? 2,
    );
  } else if (reflective) {
    readable = streamReflect(entryAgent, agents, conversationInput, userMessage, activeModel, workspaceContext);
  } else {
    readable = streamSolo(entryAgent, agents, conversationInput);
  }

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
