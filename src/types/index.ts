import type { z } from "zod";
import type { AgentTargetSchema, ScriptTypeSchema } from "@/lib/schemas";

export type AgentTarget = z.infer<typeof AgentTargetSchema>;
export type ScriptType = z.infer<typeof ScriptTypeSchema>;

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  required: boolean;
}

export type TemplateAudience =
  | "developer"
  | "designer"
  | "qa"
  | "business"
  | "researcher"
  | "data"
  | "devops";

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  emoji: string;
  stack: string;
  audience: TemplateAudience;
  tags: string[];
  variables: TemplateVariable[];
  whyItMatters: string;
  impact: string;
  generatedFiles: string[];
}

export interface SkillManifest {
  id: string;
  title: string;
  description: string;
  personaText: string;
  tags: string[];
  compatibility: string[];
  tooltip?: string;
}

export interface McpServer {
  name: string;
  package: string;
  description: string;
}

export interface IntegrationManifest {
  id: string;
  name: string;
  description: string;
  category?: string;
  mcpServers: McpServer[];
  envVars: string[];
  installHint?: string;
  tooltip?: string;
}

export interface GenerationJob {
  templateId: string;
  skillIds: string[];
  /** Full manifests for skills not in the built-in registry (custom / GitHub-imported). */
  extraSkills: SkillManifest[];
  integrationIds: string[];
  agentTarget: AgentTarget;
  scriptType: ScriptType;
  variables: Record<string, string>;
  projectName: string;
}

export interface WizardState {
  step: number;
  job: Partial<GenerationJob>;
}

export interface ComposedFile {
  path: string;
  content: string;
}

export interface ComposedPackage {
  files: ComposedFile[];
  systemPrompt: string;
}
