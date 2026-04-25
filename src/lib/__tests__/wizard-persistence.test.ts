import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveWizardState,
  loadWizardState,
  clearWizardState,
} from "@/lib/wizard-persistence";
import type { WizardState } from "@/types";

const STORAGE_KEY = "agentfoundry:wizard-state";

const mockState: Partial<WizardState> = {
  step: 3,
  job: {
    templateId: "basic-agent",
    skillIds: ["web-search"],
    integrationIds: [],
    variables: {},
    projectName: "my-agent",
  },
};

// Use a real in-memory localStorage-like store
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  // Clear the store and all mock call history before each test
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.clearAllMocks();
});

describe("saveWizardState", () => {
  it("stores the correct structure in localStorage", () => {
    saveWizardState(mockState);
    expect(localStorageMock.setItem).toHaveBeenCalledOnce();
    const [calledKey, calledValue] = localStorageMock.setItem.mock.calls[0];
    expect(calledKey).toBe(STORAGE_KEY);
    const parsed = JSON.parse(calledValue as string);
    expect(parsed.version).toBe(1);
    expect(parsed.state).toEqual(mockState);
  });
});

describe("loadWizardState", () => {
  it("returns null when nothing is saved", () => {
    expect(loadWizardState()).toBeNull();
  });

  it("returns null on version mismatch", () => {
    store[STORAGE_KEY] = JSON.stringify({ version: 999, state: mockState });
    expect(loadWizardState()).toBeNull();
  });

  it("returns the saved state on version match", () => {
    store[STORAGE_KEY] = JSON.stringify({ version: 1, state: mockState });
    const result = loadWizardState();
    expect(result).toEqual(mockState);
  });
});

describe("clearWizardState", () => {
  it("removes the storage key", () => {
    store[STORAGE_KEY] = JSON.stringify({ version: 1, state: mockState });
    clearWizardState();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(store[STORAGE_KEY]).toBeUndefined();
  });
});

describe("error handling", () => {
  it("handles localStorage.getItem throwing (private browsing simulation)", () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error("SecurityError: localStorage is not available");
    });
    expect(() => loadWizardState()).not.toThrow();
    expect(loadWizardState()).toBeNull();
  });

  it("handles localStorage.setItem throwing without propagating", () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveWizardState(mockState)).not.toThrow();
  });
});
