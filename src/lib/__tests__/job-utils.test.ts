import { describe, it, expect } from "vitest";
import { isJobReady } from "@/lib/job-utils";
import type { GenerationJob } from "@/types";

describe("isJobReady", () => {
  const FULL_JOB: GenerationJob = {
    templateId: "typescript-ai-agent",
    skillIds: ["senior-engineer"],
    extraSkills: [],
    integrationIds: [],
    agentTarget: "cursor",
    scriptType: "both",
    variables: { projectName: "my-app" },
    projectName: "my-app",
  };

  it("returns true for a full GenerationJob", () => {
    expect(isJobReady(FULL_JOB)).toBe(true);
  });

  it("returns true for a partial job that has templateId", () => {
    expect(isJobReady({ templateId: "some-template" })).toBe(true);
  });

  it("returns false for empty object", () => {
    expect(isJobReady({})).toBe(false);
  });

  it("returns false when templateId is empty string", () => {
    expect(isJobReady({ templateId: "" })).toBe(false);
  });

  it("returns false when templateId is undefined", () => {
    expect(isJobReady({ templateId: undefined })).toBe(false);
  });

  it("acts as a type guard — TypeScript narrows to GenerationJob", () => {
    const partial: Partial<GenerationJob> = { templateId: "my-template" };
    if (isJobReady(partial)) {
      // This should compile without error — templateId is string, not undefined
      const id: string = partial.templateId;
      expect(id).toBe("my-template");
    } else {
      throw new Error("Expected isJobReady to return true");
    }
  });
});
