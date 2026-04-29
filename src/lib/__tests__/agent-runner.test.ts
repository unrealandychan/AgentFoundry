import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @openai/agents ────────────────────────────────────────────────────────
// vi.mock is hoisted, so the factory must not reference variables defined below.
const mockHandoff = vi.fn((agent: unknown) => ({ __handoff: agent }));

vi.mock("@openai/agents", () => {
  class MockAgent {
    name: string;
    instructions: string;
    model: string;
    handoffDescription?: string;
    handoffs?: unknown[];

    constructor(opts: {
      name: string;
      instructions: string;
      model: string;
      handoffDescription?: string;
      handoffs?: unknown[];
    }) {
      this.name = opts.name;
      this.instructions = opts.instructions;
      this.model = opts.model;
      this.handoffDescription = opts.handoffDescription;
      this.handoffs = opts.handoffs;
    }
  }

  return {
    Agent: MockAgent,
    // Use a stable re-export wrapper so the top-level mockHandoff spy is called
    handoff: (...args: unknown[]) => mockHandoff(...args),
  };
});

// ── Subject ────────────────────────────────────────────────────────────────────
import { createAgents } from "@/lib/agent-runner/agents";

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEFS = [
  { id: "a1", name: "Alpha", instructions: "Do alpha things." },
  { id: "a2", name: "Beta", instructions: "Do beta things." },
];

const MODEL = "gpt-4o";
const CTX = "\n\n[workspace context]";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("createAgents", () => {
  describe("single-agent mode", () => {
    it("returns one sdkAgent and sets entryAgent to the same object", () => {
      const { sdkAgents, entryAgent } = createAgents([DEFS[0]!], MODEL, CTX);
      expect(sdkAgents).toHaveLength(1);
      expect(entryAgent).toBe(sdkAgents[0]);
    });

    it("does NOT create a Triage router", () => {
      const { entryAgent } = createAgents([DEFS[0]!], MODEL, CTX);
      expect(entryAgent.name).toBe("Alpha");
    });
  });

  describe("multi-agent mode", () => {
    it("returns sdkAgents with one entry per def", () => {
      const { sdkAgents } = createAgents(DEFS, MODEL, CTX);
      expect(sdkAgents).toHaveLength(2);
      expect(sdkAgents.map((a) => a.name)).toEqual(["Alpha", "Beta"]);
    });

    it("creates a Triage router as entryAgent", () => {
      const { entryAgent } = createAgents(DEFS, MODEL, CTX);
      expect(entryAgent.name).toBe("Triage");
    });

    it("wires Triage handoffs to the SAME sdkAgents objects (no orphans)", () => {
      const { sdkAgents, entryAgent } = createAgents(DEFS, MODEL, CTX);

      // handoff() should have been called once per specialist
      expect(mockHandoff).toHaveBeenCalledTimes(2);

      // Each call to handoff() should have received the corresponding sdkAgent
      expect(mockHandoff).toHaveBeenNthCalledWith(1, sdkAgents[0]);
      expect(mockHandoff).toHaveBeenNthCalledWith(2, sdkAgents[1]);

      // entryAgent.handoffs should be the wrapped results
      expect(entryAgent.handoffs).toHaveLength(2);
    });

    it("gives every specialist a handoffDescription", () => {
      const { sdkAgents } = createAgents(DEFS, MODEL, CTX);
      for (const agent of sdkAgents) {
        expect(agent.handoffDescription).toBeDefined();
        expect(agent.handoffDescription).not.toBe("");
      }
    });

    it("entryAgent is NOT one of the sdkAgents", () => {
      const { sdkAgents, entryAgent } = createAgents(DEFS, MODEL, CTX);
      expect(sdkAgents).not.toContain(entryAgent);
    });
  });

  describe("instructions composition", () => {
    it("prepends RECOMMENDED_PROMPT_PREFIX to each specialist", () => {
      const { sdkAgents } = createAgents([DEFS[0]!], MODEL, CTX);
      expect(sdkAgents[0]!.instructions).toContain("multi-agent system");
      expect(sdkAgents[0]!.instructions).toContain("Do alpha things.");
      expect(sdkAgents[0]!.instructions).toContain("[workspace context]");
    });
  });
});
