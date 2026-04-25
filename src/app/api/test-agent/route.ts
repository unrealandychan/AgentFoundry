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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildWorkspaceContext(sessionId: string | undefined): Promise<string> {
  if (!sessionId || !/^[\w-]{8,128}$/.test(sessionId)) return "";
  const sessionDir = path.join("/tmp", sessionId);
  try {
    const files = await fs.readdir(sessionDir);
    const entries: string[] = [];
    for (const filename of files.slice(0, 20)) {
      if (!/^[\w.-]{1,200}$/.test(filename)) continue;
      const filePath = path.join(sessionDir, filename);
      if (!filePath.startsWith(sessionDir + path.sep) && filePath !== sessionDir) continue;
      try {
        const content = await fs.readFile(filePath, "utf8");
        entries.push(`### ${filename}\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``);
      } catch {
        /* skip */
      }
    }
    if (entries.length > 0) {
      return `\n\n---\n## Workspace Files\n${entries.join("\n\n")}`;
    }
  } catch {
    /* no session dir */
  }
  return "";
}

function encodeHeader(agent: { id: string; name: string }): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ agentId: agent.id, agentName: agent.name }) + "\n",
  );
}

function encodeTransitionHeader(agent: { id: string; name: string }): Uint8Array {
  return new TextEncoder().encode(
    "\n" + JSON.stringify({ agentId: agent.id, agentName: agent.name }) + "\n",
  );
}

const COORDINATOR_ID = "coordinator";
const COORDINATOR_AGENT_META = { id: COORDINATOR_ID, name: "🔄 Coordinator" };

const COORDINATOR_INSTRUCTIONS =
  "You are a Reflection Coordinator. Evaluate whether an agent's response demonstrates iterative reasoning — it must show explicit reasoning steps, consideration of alternatives or trade-offs, or acknowledgement of uncertainty before settling on a conclusion.\n\nRespond with EXACTLY one of:\n- APPROVED — the response already shows clear reasoning, weighs options, or acknowledges limitations.\n- REVISE: <specific challenge> — the response jumps to a conclusion without visible reasoning. Include 1–2 focused questions or aspects the agent must address before finalising.";

async function coordinatorCheck(
  agentName: string,
  userMessage: string,
  draftResponse: string,
): Promise<{ approved: boolean; feedback: string }> {
  const coordinatorAgent = new Agent({
    name: "Coordinator",
    instructions: COORDINATOR_INSTRUCTIONS,
    model: "gpt-4o-mini",
  });
  const result = await run(
    coordinatorAgent,
    `Agent: ${agentName}\nUser message: ${userMessage}\n\nDraft response:\n${draftResponse}`,
    // maxTurns:1 is intentional here — coordinator makes a single pass judgment.
    { maxTurns: 1 },
  );
  const content = (result.finalOutput as string | undefined)?.trim() ?? "";
  if (content.toUpperCase().startsWith("APPROVED")) return { approved: true, feedback: "" };
  const feedback = content.replace(/^REVISE:\s*/i, "").trim();
  return {
    approved: false,
    feedback:
      feedback ||
      "Please elaborate your reasoning and consider alternative approaches before settling on an answer.",
  };
}

// Build a history array from the prior chat turns into AgentInputItem format.
function buildHistory(
  history: Array<{ role: "user" | "assistant"; content: string; agentName?: string }>,
): AgentInputItem[] {
  return history.map((h): AgentInputItem => {
    const text = h.agentName ? `[${h.agentName}]: ${h.content}` : h.content;
    if (h.role === "assistant") {
      return { role: "assistant", status: "completed", content: [{ type: "output_text", text }] };
    }
    return { role: "user", content: text };
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rateLimit = checkRateLimit(ip);
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

  // Configure the SDK model provider so OPENAI_BASE_URL is respected. The SDK does not
  // auto-read OPENAI_BASE_URL — we pass it explicitly via OpenAIProvider.
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  setDefaultModelProvider(new OpenAIProvider({ apiKey, ...(baseURL ? { baseURL } : {}) }));
  // Use Chat Completions API (universally supported by proxies). The SDK defaults to
  // the newer Responses API (/v1/responses) which many proxies don't implement.
  setOpenAIAPI("chat_completions");
  // Disable tracing globally — it always targets api.openai.com regardless of baseURL,
  // causing 401s when using a proxy key. Per-run tracingDisabled is not supported in
  // @openai/agents 0.8.3, so the global call is the correct approach here.
  setTracingDisabled(true);

  const { agents, message: userMessage, history, model, sessionId, collaborate, reflective, rounds } =
    parsed.data;

  const workspaceContext = await buildWorkspaceContext(sessionId);
  const activeModel = model ?? "gpt-4o-mini";

  const { sdkAgents, entryAgent } = createAgents(agents, activeModel, workspaceContext);

  const historyItems = buildHistory(history ?? []);
  const conversationInput = [...historyItems, { role: "user" as const, content: userMessage }];
  const conversationInput: AgentInputItem[] = [
    ...historyItems,
    { role: "user", content: userMessage },
  ];

  // ── Collaborate mode — each agent speaks in turn ──────────────────────────
  if (collaborate && sdkAgents.length > 1) {
    // Use original agent order — no extra LLM router call needed.
    // The SDK's native handoff mechanism (used in single-agent mode below) already
    // handles intelligent routing. In collaborate mode we want ALL agents to speak,
    // so we simply iterate in the defined order.
    const orderedAgents = sdkAgents;

    const ROUNDS = rounds ?? 2;
    const enc = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const priorOutputs: Array<{ name: string; content: string; round: number }> = [];

        try {
          let earlyStop = false;

          for (let round = 1; round <= ROUNDS; round++) {
            for (const agent of orderedAgents) {
              const previousThisRound = priorOutputs.filter((p) => p.round === round);

              let collaborationContext = "";
              if (priorOutputs.length > 0) {
                const allTranscript = priorOutputs
                  .map((p) => `[Round ${p.round}] **${p.name}**: ${p.content}`)
                  .join("\n\n");
                const isNewRound = previousThisRound.length === 0;
                const roundNote =
                  ROUNDS > 1
                    ? isNewRound
                      ? `\n\n**Round ${round} of ${ROUNDS}**: You have read everyone's Round ${round - 1} views. Now dig deeper — challenge assumptions, propose concrete solutions, or synthesise what's been said into actionable conclusions.`
                      : `\n\n**Round ${round} of ${ROUNDS}, your turn**: Build on what ${previousThisRound.at(-1)?.name} said and advance the discussion.`
                    : "";
                collaborationContext =
                  `\n\n---\n## Discussion so far\n${allTranscript}\n\n` +
                  `Now it is your turn. Build on, challenge, or extend what was said. Be direct and specific — don't just agree. Bring your unique perspective as ${agent.name}.` +
                  roundNote +
                  `\n\nConciseness rule: Keep your reply to 2–3 short paragraphs. Raise one clear point or question for the next agent to pick up.`;
              } else {
                collaborationContext = `\n\nConciseness rule: Keep your opening reply to 2–3 short paragraphs. Introduce your key insight and leave clear room for other specialists to contribute.`;
              }

              // Create a per-turn agent with the collaboration context injected.
              const turnAgent = new Agent({
                name: agent.name,
                instructions: `${RECOMMENDED_PROMPT_PREFIX}${agent.instructions}${collaborationContext}`,
                model: activeModel,
              });

              controller.enqueue(
                encodeHeader({ id: agent.name.toLowerCase().replace(/\s+/g, "-"), name: agent.name }),
              );

              let fullText = "";
              try {
                const agentStream = await run(turnAgent, conversationInput, {
                  stream: true,
                  // maxTurns:5 allows multi-step tool use within each agent's turn.
                  // Previously hardcoded to 1 which cut off agents mid-reasoning.
                  maxTurns: 5,
                });

                for await (const event of agentStream) {
                  if (
                    event.type === "raw_model_stream_event" &&
                    "data" in event &&
                    event.data &&
                    typeof event.data === "object" &&
                    "type" in event.data &&
                    event.data.type === "output_text_delta" &&
                    "delta" in event.data &&
                    typeof event.data.delta === "string"
                  ) {
                    fullText += event.data.delta;
                    controller.enqueue(enc.encode(event.data.delta));
                  }
                }
                await agentStream.completed;
              } catch (agentError) {
                const message =
                  agentError instanceof Error
                    ? agentError.message.replaceAll(/sk-[\w-]+/g, "[REDACTED]")
                    : "Agent error";
                controller.enqueue(enc.encode(`[Error: ${message}]`));
              }

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
                    const revStream = await run(revisedAgent, conversationInput, {
                      stream: true,
                      // maxTurns:5 allows multi-step reasoning during revision.
                      maxTurns: 5,
                    });
                    for await (const event of revStream) {
                      if (
                        event.type === "raw_model_stream_event" &&
                        "data" in event &&
                        event.data &&
                        typeof event.data === "object" &&
                        "type" in event.data &&
                        event.data.type === "output_text_delta" &&
                        "delta" in event.data &&
                        typeof event.data.delta === "string"
                      ) {
                        fullText += event.data.delta;
                        controller.enqueue(enc.encode(event.data.delta));
                      }
                    }
                    await revStream.completed;
                  }
                } catch {
                  /* skip coordinator on error — don't block the conversation */
                }
              }

              priorOutputs.push({ name: agent.name, content: fullText, round });
              controller.enqueue(enc.encode("\n"));
            }

            // ── Early-stop check — skip remaining rounds if discussion has converged ──
            if (!earlyStop && round < ROUNDS) {
              try {
                const transcript = priorOutputs
                  .map((p) => `**${p.name}**: ${p.content}`)
                  .join("\n\n");
                const convergenceAgent = new Agent({
                  name: "ConvergenceChecker",
                  instructions: "You decide whether a multi-agent discussion needs more rounds. Reply with ONLY 'CONTINUE' or 'STOP'. Reply 'STOP' when: the user message is casual/conversational, the agents have fully answered the question, or there is clear consensus with nothing new to add. Reply 'CONTINUE' only when there is genuine unresolved disagreement or a complex topic that genuinely benefits from another round.",
                  model: "gpt-4o-mini",
                });
                const checkResult = await run(
                  convergenceAgent,
                  `User message: ${userMessage}\n\nDiscussion after round ${round}:\n${transcript}\n\nShould discussion continue?`,
                  { maxTurns: 1 },
                );
                const verdict = (String(checkResult.finalOutput ?? "")).trim().toUpperCase();
                if (verdict.startsWith("STOP")) {
                  earlyStop = true;
                }
              } catch {
                /* skip check on error — continue with remaining rounds */
              }
            }

            if (earlyStop) break;
          }

          // ── Summarize agent — synthesise all contributions into a final answer ──
          if (priorOutputs.length > 0) {
            const SUMMARIZER_META = { id: "summarizer", name: "📝 Summary" };
            controller.enqueue(encodeTransitionHeader(SUMMARIZER_META));

            const transcript = priorOutputs
              .map((p) => `[Round ${p.round}] **${p.name}**: ${p.content}`)
              .join("\n\n");

            const summarizerAgent = new Agent({
              name: "Summarizer",
              instructions: `${RECOMMENDED_PROMPT_PREFIX}You are a synthesis agent. You have just observed a multi-agent discussion. Your job is to produce a single, clear, final answer to the user's question by synthesising the key insights from all contributors. Be concise and direct. Do not repeat what each agent said — merge the best ideas into one coherent response.`,
              model: activeModel,
            });

            try {
              const sumStream = await run(
                summarizerAgent,
                `User question: ${userMessage}\n\n---\n## Agent discussion\n${transcript}\n\n---\nProvide the final synthesised answer.`,
                { stream: true, maxTurns: 1 },
              );
              for await (const event of sumStream) {
                if (
                  event.type === "raw_model_stream_event" &&
                  "data" in event &&
                  event.data &&
                  typeof event.data === "object" &&
                  "type" in event.data &&
                  event.data.type === "output_text_delta" &&
                  "delta" in event.data &&
                  typeof event.data.delta === "string"
                ) {
                  controller.enqueue(enc.encode(event.data.delta));
                }
              }
              await sumStream.completed;
            } catch (sumError) {
              const message = sumError instanceof Error
                ? sumError.message.replaceAll(/sk-[\w-]+/g, "[REDACTED]")
                : "Summarizer error";
              controller.enqueue(enc.encode(`[Error: ${message}]`));
            }
          }

          controller.close();
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ERR_STREAM_PREMATURE_CLOSE" || code === "ERR_STREAM_DESTROYED") {
            try { controller.close(); } catch { /* already closed */ }
          } else {
            controller.error(error);
          }
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...rateLimitHeaders },
    });
  }

  // ── Single-agent mode — triage via SDK handoffs ───────────────────────────
  // If multiple agents are configured, create a triage agent that hands off to
  // the best specialist. The SDK resolves routing automatically via the LLM.
  let entryAgent: Agent;

  if (sdkAgents.length === 1) {
    entryAgent = sdkAgents[0]!;
  } else {
    // Each specialist gets a handoffDescription so the triage agent can route.
    const specialistsWithDesc = agents.map(
      (def, i) =>
        new Agent({
          name: def.name,
          instructions: `${RECOMMENDED_PROMPT_PREFIX}${def.instructions}${workspaceContext}`,
          model: activeModel,
          handoffDescription: `Routes to ${def.name} — use when the query best matches this specialist.`,
        }),
    );

    entryAgent = new Agent({
      name: "Triage",
      instructions: `${RECOMMENDED_PROMPT_PREFIX}You are a routing agent. Do not answer the user directly. Choose the best specialist and hand off to them. Never respond with your own text.`,
      model: activeModel,
      handoffs: specialistsWithDesc.map((a) => handoff(a)),
    });
  }

  // ── Reflective single-agent mode ──────────────────────────────────────────
  if (reflective) {
    const reflectReadable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          // Step 1: get the draft (non-streaming to allow coordinator to review it).
          const draftResult = await run(entryAgent, conversationInput, { maxTurns: 5 });
          const draftText = draftResult.finalOutput as string | undefined ?? "";

          // Identify which agent produced the final output (may be a handoff target).
          const activeAgentName = draftResult.lastAgent?.name ?? agents[0]?.name ?? "Agent";
          const activeAgentId = activeAgentName.toLowerCase().replace(/\s+/g, "-");

          // Step 2: coordinator review.
          let coordinatorFeedback = "";
          try {
            const { approved, feedback } = await coordinatorCheck(
              activeAgentName,
              userMessage,
              draftText,
            );
            if (!approved) coordinatorFeedback = feedback;
          } catch {
            /* skip coordinator on error */
          }

          if (coordinatorFeedback) {
            // Show coordinator feedback, then stream a revised response.
            controller.enqueue(encodeHeader(COORDINATOR_AGENT_META));
            controller.enqueue(enc.encode(`**Reflection needed:** ${coordinatorFeedback}`));
            controller.enqueue(encodeTransitionHeader({ id: activeAgentId, name: activeAgentName }));

            const revisedAgent = new Agent({
              name: activeAgentName,
              instructions:
                `${RECOMMENDED_PROMPT_PREFIX}${agents.find((a) => a.name === activeAgentName)?.instructions ?? ""}${workspaceContext}` +
                `\n\n---\n## Revision Required\nAddress these specific points before finalising:\n${coordinatorFeedback}\n\nShow your reasoning explicitly.`,
              model: activeModel,
            });

            // Use result.history from the draft run so the revised agent has full context
            // of what was already said — avoids reconstructing history manually.
            const revInput: AgentInputItem[] = [
              ...((draftResult.history ?? []) as AgentInputItem[]),
              {
                role: "user",
                content: `Please revise your answer. Coordinator feedback:\n${coordinatorFeedback}`,
              },
            ];

            const revStream = await run(revisedAgent, revInput, {
              stream: true,
              maxTurns: 5,
            });
            for await (const event of revStream) {
              if (
                event.type === "raw_model_stream_event" &&
                "data" in event &&
                event.data &&
                typeof event.data === "object" &&
                "type" in event.data &&
                event.data.type === "output_text_delta" &&
                "delta" in event.data &&
                typeof event.data.delta === "string"
              ) {
                controller.enqueue(enc.encode(event.data.delta));
              }
            }
            await revStream.completed;
          } else {
            // Draft approved — emit it as the agent's response.
            controller.enqueue(encodeHeader({ id: activeAgentId, name: activeAgentName }));
            controller.enqueue(enc.encode(draftText));
          }
          controller.close();
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ERR_STREAM_PREMATURE_CLOSE" || code === "ERR_STREAM_DESTROYED") {
            try { controller.close(); } catch { /* already closed */ }
          } else {
            controller.error(error);
          }
        }
      },
    });
    return new Response(reflectReadable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...rateLimitHeaders },
    });
  }

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...rateLimitHeaders },
  });

  // Fire-and-forget: clean up /tmp workspace dirs older than 1 hour
  scheduleWorkspaceCleanup();
}
