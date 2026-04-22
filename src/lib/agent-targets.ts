import type { AgentTarget } from "@/types";

/**
 * Single source of truth for the agent-target → generated file path mapping.
 * Used by both the domain layer (composer) and the presentation layer (step-agent-target).
 *
 * Keys present here generate an ADDITIONAL platform-specific config file alongside
 * the base AGENTS.md. Targets absent from this map (codex-cli, generic) rely on
 * AGENTS.md as their primary config — no extra file is needed.
 */
export const AGENT_TARGET_FILES: Partial<Record<AgentTarget, string>> = {
  "github-copilot": ".github/copilot-instructions.md",
  "claude-code": "CLAUDE.md",
  cursor: ".cursor/rules",
  windsurf: ".windsurf/rules",
};

/**
 * Returns the primary config file path for a given agent target.
 * Targets without a dedicated file fall back to AGENTS.md.
 */
export function agentTargetFile(target: AgentTarget): string {
  return AGENT_TARGET_FILES[target] ?? "AGENTS.md";
}
