import type { NextRequest } from "next/server";
import { setDefaultModelProvider, setOpenAIAPI, setTracingDisabled, OpenAIProvider } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";
import { TestAgentRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { scheduleWorkspaceCleanup } from "@/lib/workspace-cleanup";
import { buildWorkspaceContext } from "@/lib/agent-runner/workspace";
import { buildHistory } from "@/lib/agent-runner/history";
import { createAgents } from "@/lib/agent-runner/agents";
import { streamSolo, streamReflect, streamCollaborate } from "@/lib/agent-runner/stream";

// ── Module-level SDK initialisation (runs once per cold-start) ───────────────
//
// Calling setDefaultModelProvider() on every request causes a race condition:
// concurrent requests may overwrite each other's provider mid-flight.
// Initialising once at module load is safe because env vars are immutable at
// runtime and the SDK provider is process-wide state.

function initSDK() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return; // handled per-request below
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  setDefaultModelProvider(new OpenAIProvider({ apiKey, ...(baseURL ? { baseURL } : {}) }));
  // Use Chat Completions API (universally supported by proxies). The SDK defaults to
  // the newer Responses API (/v1/responses) which many proxies don't implement.
  setOpenAIAPI("chat_completions");
  // Disable tracing globally — it always targets api.openai.com regardless of baseURL,
  // causing 401s when using a proxy key.
  setTracingDisabled(true);
}

initSDK();

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rateLimit = await checkRateLimit(ip);
  const rateLimitHeaders = {
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  };
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: rateLimitHeaders });
  }

  const parsed = TestAgentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on this server. Add it to .env.local." },
      { status: 503, headers: rateLimitHeaders },
    );
  }


  const { agents, message: userMessage, history, model, sessionId, collaborate, reflective, rounds } =
    parsed.data;

  const workspaceContext = await buildWorkspaceContext(sessionId);
  const activeModel = model ?? "gpt-4o-mini";

  const { sdkAgents, entryAgent } = createAgents(agents, activeModel, workspaceContext);

  const historyItems = buildHistory(history ?? []);
  const conversationInput: AgentInputItem[] = [
    ...historyItems,
    { role: "user", content: userMessage },
  ];

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

  // Fire-and-forget: clean up /tmp workspace dirs older than 1 hour
  scheduleWorkspaceCleanup();

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...rateLimitHeaders },
  });
}
