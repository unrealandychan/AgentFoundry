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
  /** All specialist agents created from agentDefs. */
  sdkAgents: Agent[];
  /**
   * The agent that should receive the first user message.
   * - Single-agent: same object as sdkAgents[0].
   * - Multi-agent:  a Triage router that hands off to the specialists.
   *                 sdkAgents are the exact same objects wired into the router's
   *                 handoffs array (no orphan duplicates).
   */
  entryAgent: Agent;
}

/**
 * Build the agent graph for a run.
 *
 * Bug fix (issue #34): the previous implementation created TWO sets of Agent
 * objects in the multi-agent case — `sdkAgents` (plain, no handoffDescription)
 * and `specialistsWithDesc` (with handoffDescription).  The Triage router was
 * wired to `specialistsWithDesc`, so `sdkAgents` was a completely unused orphan.
 *
 * Now only one set of specialist agents is created (with handoffDescription so
 * they work correctly in both single- and multi-agent topologies).  The returned
 * `sdkAgents` and the router's handoffs array reference the same objects.
 */
export function createAgents(
  agentDefs: AgentDef[],
  activeModel: string,
  workspaceContext: string,
): CreatedAgents {
  // Single set of specialist agents — always include handoffDescription so
  // they are ready to be used in a multi-agent handoff topology without needing
  // a second pass.
  const sdkAgents = agentDefs.map(
    (def) =>
      new Agent({
        name: def.name,
        instructions: `${RECOMMENDED_PROMPT_PREFIX}${def.instructions}${workspaceContext}`,
        model: activeModel,
        handoffDescription: `Routes to ${def.name} — use when the query best matches this specialist.`,
      }),
  );

  let entryAgent: Agent;

  if (sdkAgents.length === 1) {
    // Single agent — use it directly as the entry point.
    entryAgent = sdkAgents[0]!;
  } else {
    // Multi-agent — create a triage router that hands off to the specialists.
    // We reuse the same sdkAgents objects (no orphan duplicates).
    entryAgent = new Agent({
      name: "Triage",
      instructions: `${RECOMMENDED_PROMPT_PREFIX}You are a routing agent. Do not answer the user directly. Choose the best specialist and hand off to them. Never respond with your own text.`,
      model: activeModel,
      handoffs: sdkAgents.map((a) => handoff(a)),
    });
  }

  return { sdkAgents, entryAgent };
}
