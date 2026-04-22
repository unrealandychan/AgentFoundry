"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenerationJob, WizardState } from "@/types";
import { WizardLayout, TOTAL_STEPS } from "@/components/wizard/wizard-layout";
import { FlowChooser } from "@/components/flow-chooser";
import { SkillDownloadFlow } from "@/components/skill-download-flow";
import { SkillBuilderFlow } from "@/components/skill-builder-flow";

type AppMode = "choose" | "build" | "skill-download" | "skill-builder";

const STORAGE_KEY = "agentfoundry_wizard_v1";

const initialJob: Partial<GenerationJob> = {
  skillIds: [],
  integrationIds: [],
  agentTarget: "generic",
  scriptType: "both",
  variables: {},
  projectName: "",
};

const initialState: WizardState = { step: 1, job: initialJob };

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return "choose";
      const parsed = JSON.parse(raw) as { mode?: AppMode };
      return parsed.mode === "build" ? "build" : "choose";
    } catch {
      return "choose";
    }
  });
  const [state, setState] = useState<WizardState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState;
      const parsed = JSON.parse(raw) as { state?: WizardState };
      return parsed.state ?? initialState;
    } catch {
      return initialState;
    }
  });

  // Persist to localStorage whenever mode or wizard state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, state }));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [mode, state]);

  const updateJob = useCallback((partial: Partial<GenerationJob>) => {
    setState((previous) => ({
      ...previous,
      job: { ...previous.job, ...partial },
    }));
  }, []);

  const goNext = useCallback(() => {
    setState((previous) => ({
      ...previous,
      step: Math.min(previous.step + 1, TOTAL_STEPS),
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((previous) => ({
      ...previous,
      step: Math.max(previous.step - 1, 1),
    }));
  }, []);

  function goHome() {
    setMode("choose");
    // Clear persisted state so the next build starts fresh
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState(initialState);
  }

  if (mode === "choose") {
    return <FlowChooser onChoose={setMode} />;
  }

  if (mode === "skill-download") {
    return <SkillDownloadFlow onBack={goHome} />;
  }

  if (mode === "skill-builder") {
    return <SkillBuilderFlow onBack={goHome} />;
  }

  return (
    <WizardLayout
      state={state}
      totalSteps={TOTAL_STEPS}
      onNext={goNext}
      onBack={goBack}
      onUpdateJob={updateJob}
      onHome={goHome}
    />
  );
}
