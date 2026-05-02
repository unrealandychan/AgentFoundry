/**
 * Unit + integration tests for src/app/api/import-repo/route.ts
 *
 * Pure functions (parseRepoUrl, extractSection, extractSkillFromMarkdown) are
 * imported directly after being exported from the route module.
 *
 * The POST handler is tested with vi.spyOn(global, "fetch") to avoid real
 * network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseRepoUrl,
  extractSection,
  extractSkillFromMarkdown,
} from "@/app/api/import-repo/route";

// ─── helpers ──────────────────────────────────────────────────────────────────

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/import-repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockFetchOnce(body: unknown, status = 200): void {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function mockFetchText(text: string, status = 200): void {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(text, { status }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// parseRepoUrl
// ─────────────────────────────────────────────────────────────────────────────

describe("parseRepoUrl", () => {
  it("parses a standard github.com URL", () => {
    expect(parseRepoUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("strips .git suffix", () => {
    expect(parseRepoUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for non-github hostname", () => {
    expect(parseRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for github URL with only owner (no repo)", () => {
    expect(parseRepoUrl("https://github.com/owner")).toBeNull();
  });

  it("returns null for a malformed URL (no scheme)", () => {
    expect(parseRepoUrl("github.com/owner/repo")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseRepoUrl("")).toBeNull();
  });

  it("handles extra path segments (keeps first two)", () => {
    const result = parseRepoUrl("https://github.com/owner/repo/tree/main");
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractSection
// ─────────────────────────────────────────────────────────────────────────────

describe("extractSection", () => {
  const md = `# Title

## Description

This is the description paragraph.

## Instructions

Follow these steps carefully.

## Other

Other content.
`;

  it("extracts a named section", () => {
    const result = extractSection(md, "Description");
    expect(result).toContain("This is the description paragraph");
  });

  it("extracts the first matching heading from multiple candidates", () => {
    const result = extractSection(md, "Overview", "Description");
    expect(result).toContain("This is the description paragraph");
  });

  it("returns empty string when heading not found", () => {
    expect(extractSection(md, "NonExistent")).toBe("");
  });

  it("returns empty string on empty content", () => {
    expect(extractSection("", "Description")).toBe("");
  });

  it("extracts Instructions section", () => {
    const result = extractSection(md, "Instructions");
    expect(result).toContain("Follow these steps carefully");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractSkillFromMarkdown
// ─────────────────────────────────────────────────────────────────────────────

describe("extractSkillFromMarkdown", () => {
  it("uses # heading as title", () => {
    const md = "# My Skill\n\nSome long description text here that goes over 30 chars.\n";
    const skill = extractSkillFromMarkdown(md, "skills/my-skill.md", "my-repo");
    expect(skill.title).toBe("My Skill");
  });

  it("falls back to parent folder name when no # heading", () => {
    const md = "Some long description text here that is well over 30 characters.\n";
    const skill = extractSkillFromMarkdown(md, "skills/my-skill.md", "my-repo");
    expect(skill.title).toBe("skills");
  });

  it("uses ## Description section for description", () => {
    const md = "# Title\n\n## Description\n\nThis is the skill description text.\n\n## Instructions\n\nDo stuff.\n";
    const skill = extractSkillFromMarkdown(md, "skills/title.md", "repo");
    expect(skill.description).toContain("This is the skill description text");
  });

  it("falls back to first substantive line when no description section", () => {
    const md = "# Title\n\nA short fallback description that is longer than 30 characters.\n";
    const skill = extractSkillFromMarkdown(md, "skills/title.md", "repo");
    expect(skill.description).toContain("A short fallback description");
  });

  it("uses ## Instructions section as personaText", () => {
    const md = "# Title\n\n## Description\n\nDesc.\n\n## Instructions\n\nYou are a helpful assistant.\n";
    const skill = extractSkillFromMarkdown(md, "skills/title.md", "repo");
    expect(skill.personaText).toContain("You are a helpful assistant");
  });

  it("falls back to full content as personaText when no structured sections", () => {
    const md = "# Title\n\nJust plain content without structured sections here.\n";
    const skill = extractSkillFromMarkdown(md, "skills/title.md", "repo");
    expect(skill.personaText).toContain("Just plain content");
  });

  it("builds correct id from path", () => {
    const skill = extractSkillFromMarkdown("# T\n\nlong enough content here", "skills/my-skill.md", "repo");
    expect(skill.id).toBe("imported-skills-my-skill-md");
  });

  it("always includes 'imported' and repoName in tags", () => {
    const skill = extractSkillFromMarkdown("# T\n\nsome content here", "path.md", "my-repo");
    expect(skill.tags).toContain("imported");
    expect(skill.tags).toContain("my-repo");
  });

  it("caps description at 200 chars", () => {
    const longDesc = "A".repeat(300);
    const md = `# T\n\n## Description\n\n${longDesc}\n`;
    const skill = extractSkillFromMarkdown(md, "p.md", "repo");
    expect(skill.description.length).toBeLessThanOrEqual(200);
  });

  it("caps personaText at 4000 chars", () => {
    const longContent = "X".repeat(5000);
    const skill = extractSkillFromMarkdown(longContent, "p.md", "repo");
    expect(skill.personaText.length).toBeLessThanOrEqual(4000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import-repo
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/import-repo", () => {
  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/import-repo/route");
    const req = new Request("http://localhost/api/import-repo", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid json/i);
  });

  it("returns 400 for missing repoUrl field", async () => {
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({}) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-github URL", async () => {
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://gitlab.com/owner/repo" }) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid github url/i);
  });

  it("returns 404 when GitHub repo not found", async () => {
    mockFetchOnce({ message: "Not Found" }, 404);
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/nonexistent" }) as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 429 when GitHub API rate limit hit (403)", async () => {
    mockFetchOnce({ message: "Forbidden" }, 403);
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/repo" }) as any);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
  });

  it("returns 429 when GitHub API rate limit hit (429)", async () => {
    mockFetchOnce({ message: "Too Many Requests" }, 429);
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/repo" }) as any);
    expect(res.status).toBe(429);
  });

  it("returns 502 for unexpected GitHub error", async () => {
    mockFetchOnce({ message: "Server Error" }, 500);
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/repo" }) as any);
    expect(res.status).toBe(502);
  });

  it("returns 200 with skills when skill folder found", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    // 1. Meta fetch
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: "my-repo", description: "A repo", default_branch: "main" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 2. Root contents (has a "skills" dir)
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: "skills", path: "skills", type: "dir", download_url: null },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 3. Contents of skills/
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            name: "assistant.md",
            path: "skills/assistant.md",
            type: "file",
            download_url: "https://raw.githubusercontent.com/owner/my-repo/main/skills/assistant.md",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 4. File content fetch
    fetchSpy.mockResolvedValueOnce(
      new Response(
        "# Assistant\n\nYou are a helpful assistant with detailed instructions here.\n",
        { status: 200 },
      ),
    );

    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/my-repo" }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repoName).toBe("my-repo");
    expect(Array.isArray(body.skills)).toBe(true);
    expect(body.skills.length).toBeGreaterThan(0);
    expect(body.skills[0].title).toBe("Assistant");
  });

  it("falls back to README when no skill folders found", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    // 1. Meta
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ name: "simple-repo", description: null, default_branch: "main" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 2. Root contents (no skill folders, only README)
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            name: "README.md",
            path: "README.md",
            type: "file",
            download_url: "https://raw.githubusercontent.com/owner/simple-repo/main/README.md",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    // 3. README content
    fetchSpy.mockResolvedValueOnce(
      new Response(
        "# Simple Repo\n\nThis is a simple repository with more than fifty characters of content here.\n",
        { status: 200 },
      ),
    );

    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/simple-repo" }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skills.length).toBe(1);
    expect(body.detectedFolders).toContain("README.md (fallback)");
  });

  it("returns 502 when fetch throws (network error)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network failure"));
    const { POST } = await import("@/app/api/import-repo/route");
    const res = await POST(jsonReq({ repoUrl: "https://github.com/owner/repo" }) as any);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/network failure/i);
  });
});
