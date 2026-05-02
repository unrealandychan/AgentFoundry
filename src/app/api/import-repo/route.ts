import type { NextRequest } from "next/server";
import type { SkillManifest } from "@/types";
import { ImportRepoRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

interface GitHubRepoMeta {
  name: string;
  description: string | null;
  default_branch: string;
}

interface ParsedImport {
  repoName: string;
  repoDescription: string;
  skills: SkillManifest[];
  rawFiles: { path: string; content: string }[];
  detectedFolders: string[];
}

const SKILL_FOLDER_SIGNALS = new Set([
  "skills",
  "prompts",
  "patterns",
  "instructions",
  "agents",
  ".github",
  ".cursor",
]);

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchGitHubContents(
  owner: string,
  repo: string,
  path: string,
): Promise<GitHubContent[]> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (response.status === 403 || response.status === 429) {
    throw new Error(
      "GitHub API rate limit reached. Set GITHUB_TOKEN in your .env.local to raise the limit.",
    );
  }
  if (!response.ok) return [];
  const data: unknown = await response.json();
  // contents API returns an array for dirs, an object for files
  return Array.isArray(data) ? (data as GitHubContent[]) : [];
}

async function fetchFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!response.ok) return "";
  return response.text();
}

/** Extract a named section (## Heading) from markdown, returns its body text. */
export function extractSection(content: string, ...headings: string[]): string {
  for (const heading of headings) {
    // Match ## Heading\n...content...until next ## or end of string
    const pattern = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, "im");
    const match = pattern.exec(content);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

export function extractSkillFromMarkdown(content: string, path: string, repoName: string): SkillManifest {
  const lines = content.split("\n");

  // Title: prefer # heading, else parent folder name, else repo name
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine
    ? titleLine.replace(/^#\s+/, "").trim()
    : (path.split("/").at(-2) ?? repoName);

  // Description: prefer ## Description section, else first substantive non-heading paragraph
  const sectionDesc = extractSection(content, "Description", "Overview", "About");
  const description = sectionDesc
    ? (sectionDesc.split("\n")[0]?.trim() ?? "")
    : (lines
        .find(
          (l) =>
            l.trim().length > 30 && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("-"),
        )
        ?.trim() ?? `Imported from ${repoName}`);

  // personaText: prefer structured skill sections, fall back to full content
  const personaText =
    extractSection(
      content,
      "Instructions",
      "Persona",
      "System Prompt",
      "Behavior",
      "Role",
      "Prompt",
    ) || content.slice(0, 4000);

  return {
    id: `imported-${path.replaceAll("/", "-").replaceAll(".", "-")}`,
    title,
    description: description.slice(0, 200),
    personaText: personaText.slice(0, 4000),
    tags: ["imported", repoName],
    compatibility: ["generic"],
  };
}

async function scanSkillFolders(
  owner: string,
  repo: string,
  rootContents: GitHubContent[],
): Promise<{
  skills: SkillManifest[];
  rawFiles: { path: string; content: string }[];
  detectedFolders: string[];
}> {
  const skills: SkillManifest[] = [];
  const rawFiles: { path: string; content: string }[] = [];
  const detectedFolders: string[] = [];

  const skillDirectories = rootContents.filter(
    (item) => item.type === "dir" && SKILL_FOLDER_SIGNALS.has(item.name.toLowerCase()),
  );

  // Budget: max 15 API calls and 20 files to stay inside unauthenticated rate limits
  let apiCalls = 0;
  const MAX_API_CALLS = 15;
  const MAX_FILES = 20;

  async function collectMdFiles(dirPath: string, depth: number): Promise<void> {
    if (depth > 3 || apiCalls >= MAX_API_CALLS || skills.length >= MAX_FILES) return;
    apiCalls++;
    const entries = await fetchGitHubContents(owner, repo, dirPath);
    for (const entry of entries) {
      if (skills.length >= MAX_FILES) break;
      if (entry.type === "file" && entry.download_url && /\.(md|txt)$/i.test(entry.name)) {
        if (/^(readme|license|changelog|contributing|code_of_conduct|security)/i.test(entry.name))
          continue;
        const content = await fetchFileContent(entry.download_url);
        if (content.trim().length < 50) continue;
        rawFiles.push({ path: entry.path, content });
        skills.push(extractSkillFromMarkdown(content, entry.path, repo));
      } else if (entry.type === "dir" && apiCalls < MAX_API_CALLS) {
        await collectMdFiles(entry.path, depth + 1);
      }
    }
  }

  for (const dir of skillDirectories) {
    detectedFolders.push(dir.path);
    await collectMdFiles(dir.path, 1);
  }

  const topLevelMd = rootContents.filter(
    (item) =>
      item.type === "file" &&
      item.download_url &&
      /^(claude|agents|skill|skills|copilot-instructions|system[_-]?prompt)\.md$/i.test(item.name),
  );

  for (const file of topLevelMd) {
    if (!file.download_url) continue;
    const content = await fetchFileContent(file.download_url);
    rawFiles.push({ path: file.path, content });
    if (!skills.some((skill) => skill.personaText === content)) {
      skills.push(extractSkillFromMarkdown(content, file.path, repo));
    }
  }

  return { skills, rawFiles, detectedFolders };
}

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1";
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

  const parsed = ImportRepoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const repoUrl = parsed.data.repoUrl.trim();
  const parsedUrl = parseRepoUrl(repoUrl);
  if (!parsedUrl) {
    return Response.json(
      { error: "Invalid GitHub URL. Must be https://github.com/owner/repo" },
      { status: 400 },
    );
  }

  const { owner, repo } = parsedUrl;

  try {
    const metaResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
      cache: "no-store",
    });

    if (!metaResponse.ok) {
      const status = metaResponse.status;
      if (status === 404) {
        return Response.json({ error: "Repository not found or is private" }, { status: 404 });
      }
      if (status === 403 || status === 429) {
        return Response.json(
          {
            error:
              "GitHub API rate limit reached. Add GITHUB_TOKEN to .env.local to increase the limit.",
          },
          { status: 429 },
        );
      }
      return Response.json({ error: `GitHub API error (HTTP ${status})` }, { status: 502 });
    }

    const meta = (await metaResponse.json()) as GitHubRepoMeta;
    const rootContents = await fetchGitHubContents(owner, repo, "");
    const { skills, rawFiles, detectedFolders } = await scanSkillFolders(owner, repo, rootContents);

    // Fallback: if no structured skill folders found, use README.md as a single skill
    if (skills.length === 0) {
      const readme = rootContents.find(
        (f) => f.type === "file" && f.download_url && /^readme\.md$/i.test(f.name),
      );
      if (readme?.download_url) {
        const content = await fetchFileContent(readme.download_url);
        if (content.trim().length > 50) {
          rawFiles.push({ path: readme.path, content });
          skills.push(extractSkillFromMarkdown(content, readme.path, repo));
          detectedFolders.push("README.md (fallback)");
        }
      }
    }

    const result: ParsedImport = {
      repoName: meta.name,
      repoDescription: meta.description ?? `Imported from github.com/${owner}/${repo}`,
      skills,
      rawFiles,
      detectedFolders,
    };

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 502 });
  }
}
