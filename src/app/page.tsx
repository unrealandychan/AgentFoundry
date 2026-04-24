"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenerationJob, WizardState } from "@/types";
import { WizardLayout, TOTAL_STEPS } from "@/components/wizard/wizard-layout";
import { FlowChooser } from "@/components/flow-chooser";
import { SkillDownloadFlow } from "@/components/skill-download-flow";
import { SkillBuilderFlow } from "@/components/skill-builder-flow";
import {
  saveWizardState,
  loadWizardState,
  clearWizardState,
} from "@/lib/wizard-persistence";

type AppMode = "choose" | "build" | "skill-download" | "skill-builder";

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
  const [mode, setMode] = useState<AppMode>("choose");
  const [state, setState] = useState<WizardState>(initialState);

  // On mount: restore persisted wizard state
  useEffect(() => {
    const saved = loadWizardState();
    if (saved) {
      setMode("build");
      setState((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  // Persist wizard state whenever it changes
  useEffect(() => {
    if (mode === "build") {
      saveWizardState(state);
    }
  }, [mode, state]);

  // Clear saved state when the wizard reaches the final Download step
  useEffect(() => {
    if (mode === "build" && state.step === TOTAL_STEPS) {
      clearWizardState();
    }
  }, [mode, state.step]);

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
    clearWizardState();
    setMode("choose");
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
