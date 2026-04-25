"use client";

import type { GenerationJob } from "@/types";
import { getSkills, getTemplate } from "@/lib/registry";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

function Field({
  label,
  value,
  placeholder,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const base =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400";
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          rows={4}
          data-testid={`customize-field-${label.toLowerCase().replaceAll(/\s+/g, "-")}`}
          onChange={(event) => onChange(event.target.value)}
          className={base}
        />
      ) : (
        <input
type="text"
        value={value}
        placeholder={placeholder}
        data-testid={`customize-field-${label.toLowerCase().replaceAll(/\s+/g, "-")}`}
        onChange={(event) => onChange(event.target.value)}
          className={base}
        />
      )}
    </div>
  );
}

export function StepCustomize({ job, onUpdateJob, onNext, onBack }: StepProperties) {
  const template = job.templateId ? getTemplate(job.templateId) : undefined;
  const selectedSkills = getSkills(job.skillIds ?? [], job.extraSkills ?? []);
  const variables = job.variables ?? {};
  const projectName = job.projectName ?? "";

  function setVariable(key: string, value: string) {
    onUpdateJob({ variables: { ...variables, [key]: value } });
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900">Customize</h2>
      <p className="mb-6 text-slate-500">Set your project name and configure template variables.</p>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-slate-800">Project</h3>
        <Field
          label="Project Name"
          value={projectName}
          placeholder={template?.variables[0]?.defaultValue ?? "my-project"}
          onChange={(value) => onUpdateJob({ projectName: value })}
        />
      </div>

      {(template?.variables ?? []).length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 font-semibold text-slate-800">Template Variables</h3>
          <div className="flex flex-col gap-4">
            {template?.variables.map((variable) => (
              <Field
                key={variable.key}
                label={variable.label}
                value={variables[variable.key] ?? variable.defaultValue}
                placeholder={variable.defaultValue}
                onChange={(value) => setVariable(variable.key, value)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedSkills.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 font-semibold text-slate-800">Selected Skills</h3>
          <ul className="space-y-2">
            {selectedSkills.map((skill) => (
              <li key={skill.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span className="font-medium text-slate-800">{skill.title}</span>
                <span className="text-slate-500">— {skill.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          data-testid="step-back-button"
          className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 font-medium text-slate-700 transition hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          data-testid="step-next-button"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition hover:bg-indigo-700"
        >
          Next: Preview →
        </button>
      </div>
    </div>
  );
}
