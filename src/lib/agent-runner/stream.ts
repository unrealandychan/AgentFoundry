import { Agent, run } from "@openai/agents";
import type { AgentInputItem } from "@openai/agents";
import { RECOMMENDED_PROMPT_PREFIX, type AgentDef } from "./agents";

// ── Shared encoding helpers ────────────────────────────────────────────────

export function encodeHeader(agent: { id: string; name: string }): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ agentId: agent.id, agentName: agent.name }) + "\n",
  );
}

export function encodeTransitionHeader(agent: { id: string; name: string }): Uint8Array {
  return new TextEncoder().encode(
    "\n" + JSON.stringify({ agentId: agent.id, agentName: agent.name }) + "\n",
  );
}

// ── Coordinator helpers ────────────────────────────────────────────────────

const COORDINATOR_ID = "coordinator";
export const COORDINATOR_AGENT_META = { id: COORDINATOR_ID, name: "🔄 Coordinator" };

const COORDINATOR_INSTRUCTIONS =
  "You are a Reflection Coordinator. Evaluate whether an agent's response demonstrates iterative reasoning — it must show explicit reasoning steps, consideration of alternatives or trade-offs, or acknowledgement of uncertainty before settling on a conclusion.\n\nRespond with EXACTLY one of:\n- APPROVED — the response already shows clear reasoning, weighs options, or acknowledges limitations.\n- REVISE: <specific challenge> — the response jumps to a conclusion without visible reasoning. Include 1–2 focused questions or aspects the agent must address before finalising.";

async function coordinatorCheck(
  agentName: string,
  userMessage: string,
  draftResponse: string,
  activeModel: string,
): Promise<{ approved: boolean; feedback: string }> {
  const coordinatorAgent = new Agent({
    name: "Coordinator",
    instructions: COORDINATOR_INSTRUCTIONS,
    model: activeModel,
  });
  const result = await run(
    coordinatorAgent,
    `Agent: ${agentName}\nUser message: ${userMessage}\n\nDraft response:\n${draftResponse}`,
    { maxTurns: 1 },
  );
  const content = result.finalOutput?.trim() ?? "";
  if (content.toUpperCase().startsWith("APPROVED")) return { approved: true, feedback: "" };
  const feedback = content.replace(/^revise:\s*/i, "").trim();
  return {
    approved: false,
    feedback:
      feedback ||
      "Please elaborate your reasoning and consider alternative approaches before settling on an answer.",
  };
}

// ── Stream delta helper ────────────────────────────────────────────────────

function isTextDelta(event: unknown): event is { type: string; data: { type: string; delta: string } } {
  if (typeof event !== "object" || event === null) return false;
  const e = event as Record<string, unknown>;
  if (e["type"] !== "raw_model_stream_event") return false;
  const data = e["data"];
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d["type"] === "output_text_delta" && typeof d["delta"] === "string";
}

// ── Solo streaming ─────────────────────────────────────────────────────────

export function streamSolo(
  entryAgent: Agent,
  agentDefs: AgentDef[],
  conversationInput: AgentInputItem[],
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let headerEmitted = false;

      try {
        const agentStream = await run(entryAgent, conversationInput, {
          stream: true,
          maxTurns: 5,
        });

        for await (const event of agentStream) {
          if (event.type === "agent_updated_stream_event") {
            const updatedAgent = event.agent;
            if (updatedAgent.name !== "Triage") {
              const agentId = updatedAgent.name.toLowerCase().replaceAll(/\s+/g, "-");
              if (headerEmitted) {
                controller.enqueue(encodeTransitionHeader({ id: agentId, name: updatedAgent.name }));
              } else {
                controller.enqueue(encodeHeader({ id: agentId, name: updatedAgent.name }));
              }
              headerEmitted = true;
            }
          }

          if (isTextDelta(event)) {
            if (!headerEmitted) {
              const firstAgent = agentDefs[0];
              controller.enqueue(encodeHeader({ id: firstAgent.id, name: firstAgent.name }));
              headerEmitted = true;
            }
            controller.enqueue(enc.encode(event.data.delta));
          }
        }

        await agentStream.completed;
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
}

// ── Reflect streaming ──────────────────────────────────────────────────────

export function streamReflect(
  entryAgent: Agent,
  agentDefs: AgentDef[],
  conversationInput: AgentInputItem[],
  userMessage: string,
  activeModel: string,
  workspaceContext: string,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const draftResult = await run(entryAgent, conversationInput, { maxTurns: 5 });
        const draftText = draftResult.finalOutput ?? "";

        const activeAgentName = draftResult.lastAgent?.name ?? agentDefs[0]?.name ?? "Agent";
        const activeAgentId = activeAgentName.toLowerCase().replaceAll(/\s+/g, "-");

        let coordinatorFeedback = "";
        try {
          const { approved, feedback } = await coordinatorCheck(activeAgentName, userMessage, draftText, activeModel);
          if (!approved) coordinatorFeedback = feedback;
        } catch {
          /* skip coordinator on error */
        }

        if (coordinatorFeedback) {
          controller.enqueue(encodeHeader(COORDINATOR_AGENT_META));
          controller.enqueue(enc.encode(`**Reflection needed:** ${coordinatorFeedback}`));
          controller.enqueue(encodeTransitionHeader({ id: activeAgentId, name: activeAgentName }));

          const revisedAgent = new Agent({
            name: activeAgentName,
            instructions:
              `${RECOMMENDED_PROMPT_PREFIX}${agentDefs.find((a) => a.name === activeAgentName)?.instructions ?? ""}${workspaceContext}` +
              `\n\n---\n## Revision Required\nAddress these specific points before finalising:\n${coordinatorFeedback}\n\nShow your reasoning explicitly.`,
            model: activeModel,
          });

          const revStream = await run(revisedAgent, conversationInput, { stream: true, maxTurns: 1 });
          for await (const event of revStream) {
            if (isTextDelta(event)) controller.enqueue(enc.encode(event.data.delta));
          }
          await revStream.completed;
        } else {
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
}

// ── Collaborate streaming ──────────────────────────────────────────────────

export function streamCollaborate(
  sdkAgents: Agent[],
  agentDefs: AgentDef[],
  conversationInput: AgentInputItem[],
  userMessage: string,
  activeModel: string,
  reflective: boolean,
  rounds: number,
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      // Use a lightweight routing agent to determine discussion order.
      let orderedAgents = sdkAgents;
      try {
        const agentList = sdkAgents.map((a, i) => `${i}: ${a.name}`).join("\n");
        const routerAgent = new Agent({
          name: "Router",
          instructions: `You are a discussion orchestrator. Order ALL relevant specialists for the user message. Reply with ONLY a comma-separated list of their numeric indices in the order they should speak — no other text.\nSpecialists:\n${agentList}`,
          model: activeModel,
        });
        const routeResult = await run(routerAgent, `Order specialists for: ${userMessage}`, { maxTurns: 1 });
        const raw = routeResult.finalOutput?.trim() ?? "";
        const indices = raw
          .split(",")
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n >= 0 && n < sdkAgents.length);
        const resolved = indices.map((i) => sdkAgents[i]).filter((a): a is Agent => a !== undefined);
        if (resolved.length >= 2) orderedAgents = resolved;
      } catch {
        /* fall back to all agents in original order */
      }

      try {
        let earlyStop = false;
        const priorOutputs: Array<{ name: string; content: string; round: number }> = [];

        for (let round = 1; round <= rounds; round++) {
          for (const agent of orderedAgents) {
            const previousThisRound = priorOutputs.filter((p) => p.round === round);

            let collaborationContext = "";
            if (priorOutputs.length > 0) {
              const allTranscript = priorOutputs
                .map((p) => `[Round ${p.round}] **${p.name}**: ${p.content}`)
                .join("\n\n");
              const isNewRound = previousThisRound.length === 0;
              const roundNote =
                rounds > 1
                  ? (isNewRound
                    ? `\n\n**Round ${round} of ${rounds}**: You have read everyone's Round ${round - 1} views. Now dig deeper — challenge assumptions, propose concrete solutions, or synthesise what's been said into actionable conclusions.`
                    : `\n\n**Round ${round} of ${rounds}, your turn**: Build on what ${previousThisRound.at(-1)?.name} said and advance the discussion.`)
                  : "";
              collaborationContext =
                `\n\n---\n## Discussion so far\n${allTranscript}\n\n` +
                `Now it is your turn. Build on, challenge, or extend what was said. Be direct and specific — don't just agree. Bring your unique perspective as ${agent.name}.` +
                roundNote +
                `\n\nConciseness rule: Keep your reply to 2–3 short paragraphs. Raise one clear point or question for the next agent to pick up.`;
            } else {
              collaborationContext = `\n\nConciseness rule: Keep your opening reply to 2–3 short paragraphs. Introduce your key insight and leave clear room for other specialists to contribute.`;
            }

            const agentDef = agentDefs.find((d) => d.name === agent.name);
            const turnAgent = new Agent({
              name: agent.name,
              instructions: `${RECOMMENDED_PROMPT_PREFIX}${agentDef?.instructions ?? ""}${collaborationContext}`,
              model: activeModel,
            });

            controller.enqueue(
              encodeHeader({ id: agent.name.toLowerCase().replaceAll(/\s+/g, "-"), name: agent.name }),
            );

            let fullText = "";
            try {
              const agentStream = await run(turnAgent, conversationInput, { stream: true, maxTurns: 1 });
              for await (const event of agentStream) {
                if (isTextDelta(event)) {
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

            // ── Coordinator reflection pass ─────────────────────────────
            if (reflective && fullText) {
              try {
                const { approved, feedback } = await coordinatorCheck(agent.name, userMessage, fullText, activeModel);
                if (!approved && feedback) {
                  controller.enqueue(encodeTransitionHeader(COORDINATOR_AGENT_META));
                  controller.enqueue(enc.encode(`**Reflection needed:** ${feedback}`));
                  fullText = "";

                  const agentDef2 = agentDefs.find((d) => d.name === agent.name);
                  const revisedAgent = new Agent({
                    name: agent.name,
                    instructions:
                      `${RECOMMENDED_PROMPT_PREFIX}${agentDef2?.instructions ?? ""}${collaborationContext}` +
                      `\n\n---\n## Revision Required\nAddress these specific points before finalising:\n${feedback}\n\nShow your reasoning explicitly.`,
                    model: activeModel,
                  });
                  controller.enqueue(
                    encodeTransitionHeader({ id: agent.name.toLowerCase().replaceAll(/\s+/g, "-"), name: agent.name }),
                  );

                  const revStream = await run(revisedAgent, conversationInput, { stream: true, maxTurns: 1 });
                  for await (const event of revStream) {
                    if (isTextDelta(event)) {
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

          // ── Early-stop check ─────────────────────────────────────────
          if (!earlyStop && round < rounds) {
            try {
              const transcript = priorOutputs
                .map((p) => `**${p.name}**: ${p.content}`)
                .join("\n\n");
              const convergenceAgent = new Agent({
                name: "ConvergenceChecker",
                instructions:
                  "You decide whether a multi-agent discussion needs more rounds. Reply with ONLY 'CONTINUE' or 'STOP'. Reply 'STOP' when: the user message is casual/conversational, the agents have fully answered the question, or there is clear consensus with nothing new to add. Reply 'CONTINUE' only when there is genuine unresolved disagreement or a complex topic that genuinely benefits from another round.",
                model: activeModel,
              });
              const checkResult = await run(
                convergenceAgent,
                `User message: ${userMessage}\n\nDiscussion after round ${round}:\n${transcript}\n\nShould discussion continue?`,
                { maxTurns: 1 },
              );
              const verdict = (String(checkResult.finalOutput ?? "")).trim().toUpperCase();
              if (verdict.startsWith("STOP")) earlyStop = true;
            } catch {
              /* skip check on error — continue with remaining rounds */
            }
          }

          if (earlyStop) break;
        }

        // ── Summarize agent ────────────────────────────────────────────
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
              if (isTextDelta(event)) controller.enqueue(enc.encode(event.data.delta));
            }
            await sumStream.completed;
          } catch (sumError) {
            const message =
              sumError instanceof Error
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
}
