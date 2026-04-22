import { NextResponse } from "next/server";
import { z } from "zod";
import { compose } from "@/lib/composer";
import type { GenerationJob } from "@/types";

const JobSchema = z.object({
  templateId: z.string().min(1).max(200),
  projectName: z.string().min(1).max(200),
  skillIds: z.array(z.string()).default([]),
  integrationIds: z.array(z.string()).default([]),
  agentTarget: z
    .enum(["openai-agents", "cursor", "claude", "windsurf", "vscode"])
    .default("openai-agents"),
  workspaceContext: z.string().max(4000).optional().default(""),
});

const RequestSchema = z.object({
  job: JobSchema,
  githubToken: z.string().min(1).max(500),
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
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { job, githubToken } = parsed.data;
  const pkg = compose(job as GenerationJob);

  // Build Gist files object — include text files only (AGENTS.md, README.md, etc.)
  const gistFiles: Record<string, { content: string }> = {};
  for (const file of pkg.files) {
    // Skip binary-like or very large files
    if (file.content.length > 100_000) continue;
    // Use the basename as Gist filename; prefix nested paths with dashes
    const filename = file.path.replaceAll("/", "-");
    gistFiles[filename] = { content: file.content };
  }

  if (Object.keys(gistFiles).length === 0) {
    return NextResponse.json({ error: "No files to export" }, { status: 400 });
  }

  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      description: `AgentFoundry: ${job.projectName}`,
      public: false,
      files: gistFiles,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // Don't forward raw GitHub error text verbatim; just map status codes
    if (response.status === 401) {
      return NextResponse.json({ error: "GitHub token is invalid or expired." }, { status: 401 });
    }
    if (response.status === 422) {
      return NextResponse.json(
        { error: "Gist validation failed. Check file content." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: `GitHub returned ${response.status}` },
      { status: response.status >= 500 ? 502 : response.status },
    );
  }

  const data = (await response.json()) as { html_url?: string; id?: string };
  return NextResponse.json({ url: data.html_url, id: data.id });
}
