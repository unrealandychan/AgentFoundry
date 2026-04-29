import type { GenerationJob } from "@/types";

/**
 * Type guard: confirms a partial GenerationJob has ALL the fields
 * required to run composition without throwing.
 *
 * Centralised here to avoid duplicating the guard across wizard steps.
 *
 * Required fields:
 *  - templateId   — selects the template to compose
 *  - agentTarget  — determines which agent config files to emit
 *  - scriptType   — sh / ps1 / both
 *  - projectName  — used as ZIP root folder name and in README
 */
export function isJobReady(job: Partial<GenerationJob>): job is GenerationJob {
  return Boolean(
    job.templateId &&
    job.agentTarget &&
    job.scriptType &&
    job.projectName,
  );
}
