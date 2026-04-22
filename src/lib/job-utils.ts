import type { GenerationJob } from "@/types";

/**
 * Type guard: confirms a partial GenerationJob has the minimum fields
 * required to run composition (templateId must be present and non-empty).
 *
 * Centralised here to avoid duplicating the guard across wizard steps.
 */
export function isJobReady(job: Partial<GenerationJob>): job is GenerationJob {
  return Boolean(job.templateId);
}
