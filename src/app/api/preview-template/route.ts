import { NextResponse } from "next/server";
import { z } from "zod";
import { getTemplate } from "@/lib/registry";
import { compose } from "@/lib/composer";

const RequestSchema = z.object({
  templateId: z.string().min(1).max(200),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { templateId } = parsed.data;
  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Compose a minimal job to get the AGENTS.md content
  const job = {
    templateId,
    projectName: template.name,
    skillIds: [],
    integrationIds: [],
    agentTarget: "openai-agents" as const,
    workspaceContext: "",
  };

  const pkg = compose(job);
  const agentsFile = pkg.files.find((f) => f.path === "AGENTS.md");
  const content = agentsFile?.content ?? "AGENTS.md not found for this template.";

  return NextResponse.json({ content });
}
