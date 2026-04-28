import { Agent, handoff } from "@openai/agents";

// Defined inline — @openai/agents-core is a transitive dep nested inside @openai/agents
// and is not resolvable as a top-level import.
export const RECOMMENDED_PROMPT_PREFIX = `# System context\nYou are part of a multi-agent system called the Agents SDK, designed to make agent coordination and execution easy. Agents uses two primary abstractions: **Agents** and **Handoffs**. An agent encompasses instructions and tools and can hand off a conversation to another agent when appropriate. Handoffs are achieved by calling a handoff function, generally named \`transfer_to_<agent_name>\`. Transfers between agents are handled seamlessly in the background; do not mention or draw attention to these transfers in your conversation with the user.`;

export interface AgentDef {
  id: string;
  name: string;
  instructions: string;
}

export interface CreatedAgents {
  sdkAgents: Agent[];
  entryAgent: Agent;
}

export function createAgents(
  agentDefs: AgentDef[],
  activeModel: string,
  workspaceContext: string,
): CreatedAgents {
  const sdkAgents = agentDefs.map(
    (a) =>
      new Agent({
        name: a.name,
        instructions: `${RECOMMENDED_PROMPT_PREFIX}${a.instructions}${workspaceContext}`,
        model: activeModel,
      }),
  );

  let entryAgent: Agent;

  if (sdkAgents.length === 1) {
    entryAgent = sdkAgents[0]!;
  } else {
    const specialistsWithDesc = agentDefs.map(
      (def) =>
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

  return { sdkAgents, entryAgent };
}
