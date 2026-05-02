import { useMemo } from "react";
import type { GenerationJob } from "@/types";
import { compose } from "@/lib/composer";
import { getSkills } from "@/lib/registry";
import { isJobReady } from "@/lib/job-utils";
import { truncateInstructions } from "../utils/chatUtils";
import type { AgentDefinition } from "../utils/chatUtils";

export function useAgentDefs(job: Partial<GenerationJob>): {
  agentDefs: AgentDefinition[];
  agentIndexMap: Map<string, number>;
  systemPrompt: string;
} {
  const agentDefs = useMemo((): AgentDefinition[] => {
    if (!isJobReady(job)) return [];
    const selectedSkills = getSkills(job.skillIds, job.extraSkills ?? []);
    if (selectedSkills.length > 0) {
      return selectedSkills.map((s) => ({
        id: s.id,
        name: s.title,
        instructions: truncateInstructions(s.personaText),
      }));
    }
    // No skills selected — fall back to composed system prompt as a single agent
    try {
      const { systemPrompt } = compose(job);
      return [
        {
          id: "agent",
          name: job.projectName || "Agent",
          instructions: truncateInstructions(systemPrompt),
        },
      ];
    } catch {
      return [];
    }
  }, [job]);

  // Map agentId → roster index for stable colouring
  const agentIndexMap = useMemo(
    () => new Map(agentDefs.map((a, index) => [a.id, index])),
    [agentDefs],
  );

  const systemPrompt = useMemo(() => {
    if (!isJobReady(job)) return "";
    try {
      return compose(job).systemPrompt;
    } catch {
      return "";
    }
  }, [job]);

  return { agentDefs, agentIndexMap, systemPrompt };
}
