"use client";

import { useEffect, useRef } from "react";
import type { GenerationJob, WizardState } from "@/types";
import { StepChooseTemplate } from "@/components/wizard/step-choose-template";
import { StepAddSkills } from "@/components/wizard/step-add-skills";
import { StepAddIntegrations } from "@/components/wizard/step-add-integrations";
import { StepAgentTarget } from "@/components/wizard/step-agent-target";
import { StepCustomize } from "@/components/wizard/step-customize";
import { StepPreview } from "@/components/wizard/step-preview";
import { StepTestAgent } from "@/components/wizard/step-test-agent";
import { StepDownload } from "@/components/wizard/step-download";

const STEP_LABELS = [
  "Template",
  "Skills",
  "Integrations",
  "Agent Target",
  "Customize",
  "Preview",
  "Test Agent",
  "Download",
];

export const TOTAL_STEPS = STEP_LABELS.length;

interface WizardLayoutProperties {
  state: WizardState;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onHome: () => void;
}

function StepBadge({ index, current }: { index: number; current: number }) {
  const step = index + 1;
  const isDone = step < current;
  const isActive = step === current;
  const base =
    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold";
  const variant = isActive
    ? "bg-indigo-600 text-white"
    : isDone
      ? "bg-indigo-100 text-indigo-700"
      : "bg-gray-100 text-gray-400";
  return <div className={`${base} ${variant}`}>{step}</div>;
}

function StepIndicator({ current }: { current: number }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, index) => (
        <div key={label} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <StepBadge index={index} current={current} />
            <span
              className={`hidden text-xs sm:block ${index + 1 === current ? "font-semibold text-indigo-600" : "text-gray-400"}`}
            >
              {label}
            </span>
          </div>
          {index < STEP_LABELS.length - 1 && (
            <div className="mb-4 h-px w-6 shrink-0 bg-gray-200 sm:w-10" />
          )}
        </div>
      ))}
    </nav>
  );
}

function renderStep(
  step: number,
  job: Partial<GenerationJob>,
  onUpdateJob: (partial: Partial<GenerationJob>) => void,
  onNext: () => void,
  onBack: () => void,
) {
  const properties = { job, onUpdateJob, onNext, onBack };
  const stepMap: Record<number, React.ReactElement> = {
    1: <StepChooseTemplate {...properties} />,
    2: <StepAddSkills {...properties} />,
    3: <StepAddIntegrations {...properties} />,
    4: <StepAgentTarget {...properties} />,
    5: <StepCustomize {...properties} />,
    6: <StepPreview {...properties} />,
    7: <StepTestAgent {...properties} />,
    8: <StepDownload {...properties} />,
  };
  return stepMap[step] ?? null;
}

export function WizardLayout({
  state,
  onNext,
  onBack,
  onUpdateJob,
  onHome,
}: WizardLayoutProperties) {
  const mainReference = useRef<HTMLDivElement>(null);

  // Scroll to top of content area whenever the active step changes
  useEffect(() => {
    mainReference.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-indigo-100 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onHome}
              className="flex items-center gap-3 transition hover:opacity-75"
              title="Back to home"
            >
              <div className="size-8 rounded-lg bg-indigo-600" />
              <span className="text-lg font-bold text-slate-900">AgentFoundry</span>
            </button>
            <span
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition"
              onClick={onHome}
            >
              ← Home
            </span>
          </div>
          <StepIndicator current={state.step} />
        </div>
      </header>
      <main ref={mainReference} className="mx-auto max-w-5xl px-6 py-8">
        {renderStep(state.step, state.job, onUpdateJob, onNext, onBack)}
      </main>
    </div>
  );
}
