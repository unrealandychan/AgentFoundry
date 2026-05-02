import { useState, useCallback } from "react";
import type { AgentDefinition, ChatMessage } from "../utils/chatUtils";

interface UseSummaryReturn {
  summary: string;
  summarizing: boolean;
  summaryError: string | null;
  generateSummary: (messages: ChatMessage[], agentDefs: AgentDefinition[]) => Promise<void>;
}

export function useSummary(): UseSummaryReturn {
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const generateSummary = useCallback(
    async (messages: ChatMessage[], agentDefs: AgentDefinition[]) => {
      if (messages.length === 0 || summarizing) return;
      setSummarizing(true);
      setSummaryError(null);
      setSummary("");

      try {
        const response = await fetch("/api/test-agent/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messages.map(({ role, content, agentName }) => ({ role, content, agentName })),
            agents: agentDefs.map(({ id, name }) => ({ id, name })),
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Summarize failed");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response body");

        let done = false;
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          const chunk = decoder.decode(value, { stream: !done });
          if (chunk) setSummary((previous) => previous + chunk);
        }
      } catch (error_) {
        setSummaryError(error_ instanceof Error ? error_.message : "Failed to generate summary");
      } finally {
        setSummarizing(false);
      }
    },
    [summarizing],
  );

  return { summary, summarizing, summaryError, generateSummary };
}
