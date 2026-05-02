import type { NextRequest } from "next/server";
import JSZip from "jszip";
import { GenerationJobSchema } from "@/lib/schemas";
import { compose } from "@/lib/composer";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const rateLimit = await checkRateLimit(ip);
  const rateLimitHeaders = {
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  };
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GenerationJobSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let composed;
  try {
    composed = compose(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Composition failed";
    return Response.json({ error: message }, { status: 422 });
  }

  const zip = new JSZip();
  const folder = zip.folder(parsed.data.projectName);
  if (!folder) {
    return Response.json({ error: "Failed to create ZIP folder" }, { status: 500 });
  }

  for (const file of composed.files) {
    folder.file(file.path, file.content);
  }

  const zipBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const blob = new Blob([zipBuffer.buffer as ArrayBuffer], { type: "application/zip" });

  return new Response(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${parsed.data.projectName}.zip"`,
    },
  });
}
