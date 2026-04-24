/**
 * Integration tests for AgentFoundry API routes.
 *
 * Route handlers are imported directly and called with `new Request(...)`.
 * External dependencies (skill-store, OpenAI, GitHub fetch) are vi.mock'd.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SkillManifest } from "@/types";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SAMPLE_SKILL: SkillManifest = {
  id: "test-skill",
  title: "Test Skill",
  description: "A test skill.",
  personaText: "You are a test agent.",
  tags: ["test"],
  compatibility: ["generic"],
};

// ─── Mock skill store ─────────────────────────────────────────────────────────

const mockStore = {
  list: vi.fn<[], Promise<SkillManifest[]>>(),
  get: vi.fn<[string], Promise<SkillManifest | null>>(),
  create: vi.fn<[SkillManifest], Promise<SkillManifest>>(),
  update: vi.fn<[string, Partial<SkillManifest>], Promise<SkillManifest | null>>(),
  delete: vi.fn<[string], Promise<boolean>>(),
};

vi.mock("@/lib/skill-store", () => ({
  getSkillStore: () => mockStore,
  _resetSkillStore: vi.fn(),
}));

// Mock skill-bindings so download route's getSkillFileBinding() doesn't touch disk
const mockBinding = {
  listIds: vi.fn<[], Promise<string[]>>(),
  readFile: vi.fn<[string], Promise<string | null>>(),
  writeFile: vi.fn<[string, string], Promise<void>>(),
  deleteFile: vi.fn<[string], Promise<boolean>>(),
};

vi.mock("@/lib/skill-bindings", () => ({
  getSkillFileBinding: () => mockBinding,
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function jsonReq(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(url = "http://localhost/api/test"): Request {
  return new Request(url, { method: "GET" });
}

// ─────────────────────────────────────────────────────────────────────────────
// skills/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/skills", () => {
  beforeEach(() => {
    mockStore.list.mockResolvedValue([SAMPLE_SKILL]);
  });
  afterEach(() => vi.clearAllMocks());

  it("returns skill list with 200", async () => {
    const { GET } = await import("@/app/api/skills/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("test-skill");
  });

  it("returns 500 when store throws", async () => {
    mockStore.list.mockRejectedValue(new Error("db error"));
    const { GET } = await import("@/app/api/skills/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/db error/);
  });
});

describe("POST /api/skills", () => {
  afterEach(() => vi.clearAllMocks());

  it("creates a skill and returns 201", async () => {
    mockStore.create.mockResolvedValue(SAMPLE_SKILL);
    const { POST } = await import("@/app/api/skills/route");
    const res = await POST(jsonReq(SAMPLE_SKILL) as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("test-skill");
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/skills/route");
    const req = new Request("http://localhost/api/skills", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/skills/route");
    const res = await POST(jsonReq({ id: "x" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 409 when skill already exists", async () => {
    mockStore.create.mockRejectedValue(new Error('A skill with id "test-skill" already exists.'));
    const { POST } = await import("@/app/api/skills/route");
    const res = await POST(jsonReq(SAMPLE_SKILL) as any);
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// skills/[id]/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/skills/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns skill with 200", async () => {
    mockStore.get.mockResolvedValue(SAMPLE_SKILL);
    const { GET } = await import("@/app/api/skills/[id]/route");
    const res = await GET(getReq() as any, { params: { id: "test-skill" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("test-skill");
  });

  it("returns 404 when not found", async () => {
    mockStore.get.mockResolvedValue(null);
    const { GET } = await import("@/app/api/skills/[id]/route");
    const res = await GET(getReq() as any, { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/skills/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("updates skill and returns 200", async () => {
    const updated = { ...SAMPLE_SKILL, title: "Updated" };
    mockStore.update.mockResolvedValue(updated);
    const { PUT } = await import("@/app/api/skills/[id]/route");
    const res = await PUT(jsonReq({ title: "Updated" }, "PUT") as any, {
      params: { id: "test-skill" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated");
  });

  it("returns 404 when skill does not exist", async () => {
    mockStore.update.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/skills/[id]/route");
    const res = await PUT(jsonReq({ title: "x" }, "PUT") as any, { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const { PUT } = await import("@/app/api/skills/[id]/route");
    const req = new Request("http://localhost", {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req as any, { params: { id: "x" } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/skills/[id]", () => {
  afterEach(() => vi.clearAllMocks());

  it("deletes skill and returns 204", async () => {
    mockStore.delete.mockResolvedValue(true);
    const { DELETE } = await import("@/app/api/skills/[id]/route");
    const res = await DELETE(getReq() as any, { params: { id: "test-skill" } });
    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    mockStore.delete.mockResolvedValue(false);
    const { DELETE } = await import("@/app/api/skills/[id]/route");
    const res = await DELETE(getReq() as any, { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// skills/download/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/skills/download", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns a zip file with 200", async () => {
    mockStore.get.mockResolvedValue(SAMPLE_SKILL);
    mockBinding.readFile.mockResolvedValue("# Test Skill\n\nContent here.");
    const { POST } = await import("@/app/api/skills/download/route");
    const res = await POST(jsonReq({ skillIds: ["test-skill"] }) as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/zip");
  });

  it("returns 400 for empty skillIds", async () => {
    const { POST } = await import("@/app/api/skills/download/route");
    const res = await POST(jsonReq({ skillIds: [] }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing skillIds", async () => {
    const { POST } = await import("@/app/api/skills/download/route");
    const res = await POST(jsonReq({}) as any);
    expect(res.status).toBe(400);
  });

  it("returns 404 when none of the requested skills exist", async () => {
    mockStore.get.mockResolvedValue(null);
    const { POST } = await import("@/app/api/skills/download/route");
    const res = await POST(jsonReq({ skillIds: ["ghost"] }) as any);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/skills/download/route");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// skill-builder/route.ts
// ─────────────────────────────────────────────────────────────────────────────

// Mock OpenAI so no real API calls are made
const MOCK_SKILL_CONTENT =
  "---\nname: test-skill\ndescription: \"Test. Usage: /test-skill\"\nuser-invocable: true\n---\n\n# Test Skill — Role Declaration\n\nYou are a test agent. Your job is to test things. Follow these phases exactly.\n\n---\n\n## Phase 1 — Parse Arguments\n\nParse the user input carefully.\n\n## Phase 2 — Execute\n\nExecute the task.\n\n## Output Format\n\n```\nResult: {output}\n```\n\n## Constraints\n\n- Hard rule 1\n- Hard rule 2";

vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content: MOCK_SKILL_CONTENT } }],
  });

  function MockOpenAI() {
    return {
      chat: { completions: { create: mockCreate } },
    };
  }

  return { default: MockOpenAI };
});

describe("POST /api/skill-builder", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns ndjson stream for action=generate", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { POST } = await import("@/app/api/skill-builder/route");
    const res = await POST(
      jsonReq({ action: "generate", name: "My Skill", purpose: "This is a test skill purpose" }) as any,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("ndjson");
    // read the stream
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.type).toBe("done");
  });

  it("returns ndjson stream for action=complete with good content", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { POST } = await import("@/app/api/skill-builder/route");
    // Provide content that passes the linter so we get immediate done without OpenAI call
    const goodContent = `---
name: test-skill
description: "Test skill. Usage: /test-skill [arg]"
user-invocable: true
---

# Test Skill — Role Declaration

You are a test agent. Your job is to do testing. Follow these phases exactly.

---

## Phase 1 — Parse Arguments

Parse the user input.

## Phase 2 — Execute

Execute the task as required.

## Output Format

\`\`\`
Result: {output}
\`\`\`

## Constraints

- Hard rule 1
- Hard rule 2`;
    const res = await POST(jsonReq({ action: "complete", content: goodContent }) as any);
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid action", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { POST } = await import("@/app/api/skill-builder/route");
    const res = await POST(jsonReq({ action: "invalid" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for generate missing name", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { POST } = await import("@/app/api/skill-builder/route");
    const res = await POST(jsonReq({ action: "generate", purpose: "Something meaningful here" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 503 when OPENAI_API_KEY not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const { POST } = await import("@/app/api/skill-builder/route");
    const res = await POST(
      jsonReq({ action: "generate", name: "x", purpose: "Long enough purpose here" }) as any,
    );
    expect(res.status).toBe(503);
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns 400 for invalid JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const { POST } = await import("@/app/api/skill-builder/route");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generate/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/generate", () => {
  afterEach(() => vi.clearAllMocks());

  const validJob = {
    templateId: "nextjs-ai-app",
    skillIds: [],
    integrationIds: [],
    agentTarget: "github-copilot",
    scriptType: "sh",
    variables: { projectName: "test-app" },
    projectName: "test-app",
  };

  it("returns a zip file for valid job", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const res = await POST(jsonReq(validJob) as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/zip");
  });

  it("returns 400 for missing templateId", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const { templateId: _removed, ...bad } = validJob;
    const res = await POST(jsonReq(bad) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// preview-template/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/preview-template", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns content for valid templateId", async () => {
    const { POST } = await import("@/app/api/preview-template/route");
    const res = await POST(jsonReq({ templateId: "nextjs-ai-app" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.content).toBe("string");
    expect(body.content.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown templateId", async () => {
    const { POST } = await import("@/app/api/preview-template/route");
    const res = await POST(jsonReq({ templateId: "does-not-exist" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing templateId", async () => {
    const { POST } = await import("@/app/api/preview-template/route");
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/preview-template/route");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gist/route.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/gist", () => {
  afterEach(() => vi.clearAllMocks());

  const validGistBody = {
    job: {
      templateId: "nextjs-ai-app",
      projectName: "my-project",
      skillIds: [],
      integrationIds: [],
      agentTarget: "openai-agents",
      workspaceContext: "",
    },
    githubToken: "ghp_testtoken123456",
  };

  it("returns gist url on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ html_url: "https://gist.github.com/abc", id: "abc" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { POST } = await import("@/app/api/gist/route");
    const res = await POST(jsonReq(validGistBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://gist.github.com/abc");
  });

  it("returns 401 when GitHub returns 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );
    const { POST } = await import("@/app/api/gist/route");
    const res = await POST(jsonReq(validGistBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing githubToken", async () => {
    const { POST } = await import("@/app/api/gist/route");
    const { githubToken: _removed, ...bad } = validGistBody;
    const res = await POST(jsonReq(bad));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing job", async () => {
    const { POST } = await import("@/app/api/gist/route");
    const res = await POST(jsonReq({ githubToken: "tok" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/gist/route");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
