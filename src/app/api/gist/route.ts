import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import { compose } from "@/lib/composer";
import { GenerationJobSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

// githubToken is intentionally NOT part of the request body.
// Tokens in JSON bodies appear in server access-logs and error-reporting tools
// (Datadog, Sentry, Next.js default logging). The caller must pass the token
// via the Authorization header instead:
//   Authorization: Bearer <github_token>
const RequestSchema = z.object({
  job: GenerationJobSchema,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1";
  const rateLimit = await checkRateLimit(ip);
  const rateLimitHeaders = {
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  };
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  // ── Extract GitHub token from Authorization header ────────────────────────
  // Expected: "Authorization: Bearer <token>"
  // Empty / missing header → fall through to ZIP fallback.
  const authHeader = request.headers.get("Authorization") ?? "";
  const githubToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

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

  const { job } = parsed.data;
  const pkg = compose(job);

  // ── Fallback: no token → return a ZIP blob ────────────────────────────────
  if (!githubToken) {
    const zip = new JSZip();
    for (const file of pkg.files) {
      if (file.content.length > 100_000) continue;
      zip.file(file.path, file.content);
    }
    if (zip.files && Object.keys(zip.files).length === 0) {
      return NextResponse.json({ error: "No files to export" }, { status: 400 });
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${job.projectName ?? "agent-starter"}.zip"`,
        "X-Fallback": "zip",
      },
    });
  }

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
