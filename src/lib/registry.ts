import type { TemplateManifest, SkillManifest, IntegrationManifest } from "@/types";
import {
  TemplateManifestSchema,
  SkillManifestSchema,
  IntegrationManifestSchema,
} from "@/lib/schemas";
import rawTemplates from "@/registry/templates.json";
import rawSkills from "@/registry/skills.json";
import rawIntegrations from "@/registry/integrations.json";

export const templates: TemplateManifest[] = rawTemplates.map((item) =>
  TemplateManifestSchema.parse(item),
);

export const skills: SkillManifest[] = rawSkills.map((item) => SkillManifestSchema.parse(item));

export const integrations: IntegrationManifest[] = rawIntegrations.map((item) =>
  IntegrationManifestSchema.parse(item),
);

export function getTemplate(id: string): TemplateManifest | undefined {
  return templates.find((template) => template.id === id);
}

export function getSkills(ids: string[], extra: SkillManifest[] = []): SkillManifest[] {
  const all = [
    ...skills,
    ...extra.filter((skill) => !skills.some((existing) => existing.id === skill.id)),
  ];
  return all.filter((skill) => ids.includes(skill.id));
}

export function getIntegrations(ids: string[]): IntegrationManifest[] {
  return integrations.filter((integration) => ids.includes(integration.id));
}
