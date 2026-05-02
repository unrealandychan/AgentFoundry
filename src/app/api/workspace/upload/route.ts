import { promises as fs } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { scheduleWorkspaceCleanup } from "@/lib/workspace-cleanup";
import { checkApiKey } from "@/lib/auth";

// Max file size: 2 MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed text file extensions
const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".sh",
  ".ps1",
  ".html",
  ".css",
  ".csv",
  ".xml",
  ".sql",
  ".graphql",
  ".gql",
  ".tf",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
]);

function sanitizeSessionId(sessionId: string): string | null {
  // Only allow alphanumeric, hyphens, and underscores; 8-128 chars
  if (/^[\w-]{8,128}$/.test(sessionId)) return sessionId;
  return null;
}

function sanitizeFileName(name: string): string | null {
  // Strip directory traversal, allow only safe filename characters
  const base = path.basename(name);
  if (/^[\w.-]{1,200}$/.test(base)) return base;
  return null;
}

export async function POST(request: NextRequest) {
  const auth = checkApiKey(request);
  if (!auth.authorized) {
    return Response.json({ error: "Unauthorized", message: auth.reason }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const rawSessionId = formData.get("sessionId");
  if (typeof rawSessionId !== "string") {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }
  const sessionId = sanitizeSessionId(rawSessionId);
  if (!sessionId) {
    return Response.json({ error: "Invalid sessionId format" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 2 MB limit" }, { status: 413 });
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return Response.json(
      { error: `File type '${extension}' is not allowed. Upload plain-text files only.` },
      { status: 415 },
    );
  }

  const safeName = sanitizeFileName(file.name);
  if (!safeName) {
    return Response.json({ error: "Invalid file name" }, { status: 400 });
  }

  const sessionDir = path.join("/tmp", sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const destinationPath = path.join(sessionDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Verify the resolved path is still inside the session directory (path traversal guard)
  const resolvedDestination = path.resolve(destinationPath);
  const resolvedDir = path.resolve(sessionDir);
  if (!resolvedDestination.startsWith(resolvedDir + path.sep)) {
    return Response.json({ error: "Invalid file path" }, { status: 400 });
  }

  await fs.writeFile(destinationPath, buffer);

  scheduleWorkspaceCleanup();
  return Response.json({ name: safeName, size: file.size });
}
