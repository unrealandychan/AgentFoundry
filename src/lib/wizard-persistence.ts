import type { WizardState } from "@/types";

const STORAGE_KEY = "agentfoundry:wizard-state";
const STORAGE_VERSION = 1;

interface PersistedData {
  version: number;
  state: Partial<WizardState>;
}

export function saveWizardState(state: Partial<WizardState>): void {
  if (typeof window === "undefined") return;
  try {
    const data: PersistedData = { version: STORAGE_VERSION, state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* localStorage unavailable (e.g. private browsing) — ignore */
  }
}

export function loadWizardState(): Partial<WizardState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedData;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

export function clearWizardState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
