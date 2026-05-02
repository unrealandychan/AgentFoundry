import { describe, it, expect } from "vitest";
import { compose } from "@/lib/composer";
import type { ComposedFile, GenerationJob, SkillManifest } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function file(files: ComposedFile[], path: string): string {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`File not found in composed output: ${path}`);
  return found.content;
}

function hasFile(files: ComposedFile[], path: string): boolean {
  return files.some((f) => f.path === path);
}

// ── Base jobs ─────────────────────────────────────────────────────────────────

const NODE_JOB: GenerationJob = {
  templateId: "nextjs-ai-app",
  skillIds: [],
  extraSkills: [],
  integrationIds: [],
  agentTarget: "cursor",
  scriptType: "both",
  variables: {},
  projectName: "my-node-app",
};

const PYTHON_JOB: GenerationJob = {
  templateId: "python-agent",
  skillIds: [],
  extraSkills: [],
  integrationIds: [],
  agentTarget: "cursor",
  scriptType: "both",
  variables: {},
  projectName: "my-python-app",
};

// ── Fixtures: custom skills ───────────────────────────────────────────────────

const SKILL_A: SkillManifest = {
  id: "skill-a",
  title: "Skill A",
  description: "First custom skill.",
  personaText: "You are skill A persona.",
  tags: ["testing", "a"],
  compatibility: ["generic"],
};

const SKILL_B: SkillManifest = {
  id: "skill-b",
  title: "Skill B",
  description: "Second custom skill.",
  personaText: "You are skill B persona.",
  tags: ["testing", "b"],
  compatibility: ["nextjs"],
};

const SKILL_QUOTES: SkillManifest = {
  id: "quote-skill",
  title: "Quote Skill",
  description: "It's a skill with 'single' quotes.",
  personaText: "You handle it's edge cases.",
  tags: ["quotes"],
  compatibility: ["generic"],
};

// ─────────────────────────────────────────────────────────────────────────────
// compose() — error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("compose() — error handling", () => {
  it("throws for an unknown templateId", () => {
    const job: GenerationJob = { ...NODE_JOB, templateId: "does-not-exist" };
    expect(() => compose(job)).toThrow("Unknown template: does-not-exist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compose() — file set
// ─────────────────────────────────────────────────────────────────────────────

describe("compose() — output file set", () => {
  it("always includes the base set of files", () => {
    const { files } = compose(NODE_JOB);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("README.md");
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain(".env.example");
    expect(paths).toContain("mcp.json");
    expect(paths).toContain("setup.sh");
    expect(paths).toContain("setup.ps1");
    expect(paths).toContain("starter.yaml");
  });

  it("returns a non-empty systemPrompt", () => {
    const { systemPrompt } = compose(NODE_JOB);
    expect(typeof systemPrompt).toBe("string");
    expect(systemPrompt.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildMcpConfig — mcp.json
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMcpConfig (via mcp.json)", () => {
  it("produces an object with mcpServers key when no integrations are selected", () => {
    const { files } = compose(NODE_JOB);
    const parsed = JSON.parse(file(files, "mcp.json"));
    expect(parsed).toHaveProperty("mcpServers");
    expect(Object.keys(parsed.mcpServers)).toHaveLength(0);
  });

  it("includes the correct server entry for filesystem-mcp integration", () => {
    const job: GenerationJob = { ...NODE_JOB, integrationIds: ["filesystem-mcp"] };
    const { files } = compose(job);
    const parsed = JSON.parse(file(files, "mcp.json"));
    expect(parsed.mcpServers).toHaveProperty("filesystem");
    expect(parsed.mcpServers.filesystem.command).toBe("npx");
    expect(parsed.mcpServers.filesystem.args).toContain(
      "@modelcontextprotocol/server-filesystem",
    );
  });

  it("merges servers from multiple integrations", () => {
    const job: GenerationJob = {
      ...NODE_JOB,
      integrationIds: ["filesystem-mcp", "memory-mcp"],
    };
    const { files } = compose(job);
    const parsed = JSON.parse(file(files, "mcp.json"));
    expect(parsed.mcpServers).toHaveProperty("filesystem");
    expect(parsed.mcpServers).toHaveProperty("memory");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildEnvironmentExample — .env.example
// ─────────────────────────────────────────────────────────────────────────────

describe("buildEnvironmentExample (via .env.example)", () => {
  it("reports no variables required when there are no integrations", () => {
    const { files } = compose(NODE_JOB);
    const content = file(files, ".env.example");
    expect(content).toContain("No environment variables required.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildAgentsFile — AGENTS.md
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAgentsFile (via AGENTS.md)", () => {
  it("falls back to 'No skills configured.' when no skills are provided", () => {
    const { files } = compose(NODE_JOB);
    expect(file(files, "AGENTS.md")).toContain("No skills configured.");
  });

  it("does not include the skills-directory reference when there are no skills", () => {
    const { files } = compose(NODE_JOB);
    expect(file(files, "AGENTS.md")).not.toContain("skills/");
  });

  it("includes a section for each skill when multiple skills are provided", () => {
    const job: GenerationJob = {
      ...NODE_JOB,
      skillIds: ["skill-a", "skill-b"],
      extraSkills: [SKILL_A, SKILL_B],
    };
    const { files } = compose(job);
    const agentsMd = file(files, "AGENTS.md");
    expect(agentsMd).toContain("## Skill A");
    expect(agentsMd).toContain(SKILL_A.personaText);
    expect(agentsMd).toContain("## Skill B");
    expect(agentsMd).toContain(SKILL_B.personaText);
  });

  it("adds the skills-directory reference when skills are present", () => {
    const job: GenerationJob = {
      ...NODE_JOB,
      skillIds: ["skill-a"],
      extraSkills: [SKILL_A],
    };
    const { files } = compose(job);
    expect(file(files, "AGENTS.md")).toContain("skills/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-skill merging
// ─────────────────────────────────────────────────────────────────────────────

describe("multi-skill merging", () => {
  const job: GenerationJob = {
    ...NODE_JOB,
    skillIds: ["skill-a", "skill-b"],
    extraSkills: [SKILL_A, SKILL_B],
  };

  it("generates a SKILL.md file for each selected skill", () => {
    const { files } = compose(job);
    expect(hasFile(files, "skills/skill-a/SKILL.md")).toBe(true);
    expect(hasFile(files, "skills/skill-b/SKILL.md")).toBe(true);
  });

  it("does not generate skill files for skills not in skillIds", () => {
    const { files } = compose(job);
    expect(hasFile(files, "skills/quote-skill/SKILL.md")).toBe(false);
  });

  it("merges all skill personas into the system prompt", () => {
    const { systemPrompt } = compose(job);
    expect(systemPrompt).toContain(SKILL_A.personaText);
    expect(systemPrompt).toContain(SKILL_B.personaText);
  });

  it("separates skill sections in the system prompt with ---", () => {
    const { systemPrompt } = compose(job);
    expect(systemPrompt).toContain("---");
  });

  it("returns 'You are a helpful AI assistant.' when no skills are selected", () => {
    const { systemPrompt } = compose(NODE_JOB);
    expect(systemPrompt).toBe("You are a helpful AI assistant.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSkillFileContent — YAML escaping
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSkillFileContent (via skills/<id>/SKILL.md)", () => {
  const job: GenerationJob = {
    ...NODE_JOB,
    skillIds: ["quote-skill"],
    extraSkills: [SKILL_QUOTES],
  };

  it("generates a SKILL.md for the skill", () => {
    const { files } = compose(job);
    expect(hasFile(files, "skills/quote-skill/SKILL.md")).toBe(true);
  });

  it("escapes single quotes in the description with a backslash", () => {
    const { files } = compose(job);
    const content = file(files, "skills/quote-skill/SKILL.md");
    // Single quotes in description are replaced with \' so the YAML single-quoted scalar is valid.
    // Input:  "It's a skill with 'single' quotes."
    // Output: description: 'It\'s a skill with \'single\' quotes.'
    expect(content).toContain("description: 'It\\'s a skill with \\'single\\' quotes.'");
  });

  it("includes the skill id, tags, and compatibility in the frontmatter", () => {
    const { files } = compose(job);
    const content = file(files, "skills/quote-skill/SKILL.md");
    expect(content).toContain("name: quote-skill");
    expect(content).toContain("tags: [quotes]");
    expect(content).toContain("compatibility: [generic]");
  });

  it("includes the skill title as an H1 heading", () => {
    const { files } = compose(job);
    const content = file(files, "skills/quote-skill/SKILL.md");
    expect(content).toContain("# Quote Skill");
  });

  it("includes the personaText in the body", () => {
    const { files } = compose(job);
    const content = file(files, "skills/quote-skill/SKILL.md");
    expect(content).toContain(SKILL_QUOTES.personaText);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSetupSh — Python vs Node template detection
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSetupSh — template detection (via setup.sh)", () => {
  it("uses 'npm install' for a Node.js template", () => {
    const { files } = compose(NODE_JOB);
    const sh = file(files, "setup.sh");
    expect(sh).toContain("npm install");
    expect(sh).not.toContain("pip install");
  });

  it("uses 'pip install' for a Python template", () => {
    const { files } = compose(PYTHON_JOB);
    const sh = file(files, "setup.sh");
    expect(sh).toContain("pip install -r requirements.txt");
    expect(sh).not.toContain("npm install");
  });

  it("checks for node/npm prerequisites on a Node.js template", () => {
    const { files } = compose(NODE_JOB);
    const sh = file(files, "setup.sh");
    expect(sh).toContain("node");
    expect(sh).toContain("npm");
  });

  it("checks for python/pip prerequisites on a Python template", () => {
    const { files } = compose(PYTHON_JOB);
    const sh = file(files, "setup.sh");
    expect(sh).toContain("python3");
    expect(sh).toContain("pip");
  });

  it("includes the projectName in setup.sh", () => {
    const { files } = compose(NODE_JOB);
    expect(file(files, "setup.sh")).toContain("my-node-app");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildAgentTargetFile — agent-target specific config file
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAgentTargetFile (agent-target config file)", () => {
  it("generates .cursor/rules for the 'cursor' target", () => {
    const { files } = compose({ ...NODE_JOB, agentTarget: "cursor" });
    expect(hasFile(files, ".cursor/rules")).toBe(true);
  });

  it("generates .github/copilot-instructions.md for the 'github-copilot' target", () => {
    const { files } = compose({ ...NODE_JOB, agentTarget: "github-copilot" });
    expect(hasFile(files, ".github/copilot-instructions.md")).toBe(true);
  });

  it("generates CLAUDE.md for the 'claude-code' target", () => {
    const { files } = compose({ ...NODE_JOB, agentTarget: "claude-code" });
    expect(hasFile(files, "CLAUDE.md")).toBe(true);
  });

  it("does not generate an extra target file for the 'codex-cli' target", () => {
    const { files } = compose({ ...NODE_JOB, agentTarget: "codex-cli" });
    // codex-cli is not in AGENT_TARGET_FILES — no extra file beyond the base set
    const extraPaths = files
      .map((f) => f.path)
      .filter(
        (p) =>
          !["README.md", "AGENTS.md", ".env.example", "mcp.json", "setup.sh", "setup.ps1", "starter.yaml"].includes(p) &&
          !p.startsWith("skills/"),
      );
    expect(extraPaths).toHaveLength(0);
  });

  it("target file contains the system prompt", () => {
    const job: GenerationJob = {
      ...NODE_JOB,
      skillIds: ["skill-a"],
      extraSkills: [SKILL_A],
      agentTarget: "cursor",
    };
    const { files, systemPrompt } = compose(job);
    expect(file(files, ".cursor/rules")).toContain(systemPrompt);
  });
});
