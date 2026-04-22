import { z } from "zod";

// 32 000 chars ≈ 8 000 tokens — well within GPT-4o's 128 K context window.
const MAX_INSTRUCTIONS_CHARS = 32_000;

export const TemplateVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  defaultValue: z.string(),
  required: z.boolean(),
});

export const TemplateManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  emoji: z.string().optional().default("📦"),
  stack: z.string(),
  audience: z
    .enum(["developer", "designer", "qa", "business", "researcher", "data", "devops"])
    .optional()
    .default("developer"),
  tags: z.array(z.string()),
  variables: z.array(TemplateVariableSchema),
  whyItMatters: z.string().optional().default(""),
  impact: z.string().optional().default(""),
  generatedFiles: z.array(z.string()).optional().default([]),
});

export const SkillManifestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  personaText: z.string(),
  tags: z.array(z.string()),
  compatibility: z.array(z.string()),
  tooltip: z.string().optional(),
});

export const McpServerSchema = z.object({
  name: z.string().min(1),
  package: z.string().min(1),
  description: z.string(),
});

export const IntegrationManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().optional(),
  mcpServers: z.array(McpServerSchema),
  envVars: z.array(z.string()),
  installHint: z.string().optional(),
  tooltip: z.string().optional(),
});

export const AgentTargetSchema = z.enum([
  "github-copilot",
  "claude-code",
  "cursor",
  "codex-cli",
  "windsurf",
  "generic",
]);

export const ScriptTypeSchema = z.enum(["sh", "ps1", "both"]);

export const ImportRepoRequestSchema = z.object({
  repoUrl: z.string().min(1, "repoUrl is required"),
});

export const GenerationJobSchema = z.object({
  templateId: z.string().min(1),
  skillIds: z.array(z.string()),
  extraSkills: z.array(SkillManifestSchema).optional().default([]),
  integrationIds: z.array(z.string()),
  agentTarget: AgentTargetSchema,
  scriptType: ScriptTypeSchema,
  variables: z.record(z.string(), z.string()),
  projectName: z.string().min(1),
});

export const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  // 32 000 chars ≈ ~8 000 tokens — well within GPT-4o's 128 K context window.
  instructions: z.string().min(1).max(MAX_INSTRUCTIONS_CHARS),
});

export const ChatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
  agentName: z.string().optional(),
});

export const TestAgentRequestSchema = z.object({
  agents: z.array(AgentDefinitionSchema).min(1).max(16),
  message: z.string().min(1).max(4000),
  history: z.array(ChatHistoryMessageSchema).max(40).optional().default([]),
  model: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-5.4"]).optional().default("gpt-4o-mini"),
  sessionId: z.string().min(1).max(128).optional(),
  collaborate: z.boolean().optional().default(false),
  reflective: z.boolean().optional().default(false),
  rounds: z.number().int().min(1).max(5).optional().default(2),
});

export const SummarizeMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
  agentName: z.string().optional(),
});

export const SummarizeChatRequestSchema = z.object({
  messages: z.array(SummarizeMessageSchema).min(1).max(200),
  agents: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1) }))
    .min(1)
    .max(16),
});
