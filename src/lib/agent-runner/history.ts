import type { AgentInputItem } from "@openai/agents";

export function buildHistory(
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
