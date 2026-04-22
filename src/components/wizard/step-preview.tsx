"use client";

import { useMemo, useState } from "react";
import type { GenerationJob, ComposedFile } from "@/types";
import { compose } from "@/lib/composer";
import { getTemplate } from "@/lib/registry";
import { isJobReady } from "@/lib/job-utils";

interface StepProperties {
  job: Partial<GenerationJob>;
  onUpdateJob: (partial: Partial<GenerationJob>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DEFAULT_JOB: GenerationJob = {
  templateId: "",
  skillIds: [],
  extraSkills: [],
  integrationIds: [],
  agentTarget: "generic",
  scriptType: "both",
  variables: {},
  projectName: "my-project",
};

function FileTree({
  files,
  selected,
  onSelect,
}: {
  files: ComposedFile[];
  selected: string;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onSelect(file.path)}
          className={`rounded px-3 py-1.5 text-left font-mono text-sm transition ${
            selected === file.path
              ? "bg-indigo-100 text-indigo-800"
              : "text-slate-600 hover:bg-gray-100"
          }`}
        >
          {file.path}
        </button>
      ))}
    </div>
  );
}

export function StepPreview({ job, onNext, onBack }: StepProperties) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const readyJob = isJobReady(job) ? job : { ...DEFAULT_JOB, ...job };
  const template = job.templateId ? getTemplate(job.templateId) : undefined;

  async function downloadZip() {
    if (!job.templateId || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to generate package");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${job.projectName ?? "agent-starter"}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadDone(true);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const composed = useMemo(() => {
    if (!isJobReady(readyJob) || !readyJob.templateId) return null;
    try {
      return compose(readyJob);
    } catch {
      return null;
    }
  }, [readyJob]);

  const files = composed?.files ?? [];
  const activeFile = files.find((file) => file.path === selectedPath) ?? files[0];

  if (!template) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        Please go back and choose a template first.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-slate-900">Preview</h2>
      <p className="mb-6 text-slate-500">
        Review the files that will be included in your downloaded package.
      </p>
      <div className="mb-6 flex gap-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="w-56 shrink-0 border-r border-gray-100 p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Files
          </p>
          <FileTree files={files} selected={activeFile?.path ?? ""} onSelect={setSelectedPath} />
        </div>
        <div className="min-w-0 flex-1 p-4">
          {activeFile && (
            <>
              <p className="mb-2 font-mono text-xs text-slate-400">{activeFile.path}</p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs text-slate-700 leading-relaxed">
                {activeFile.content}
              </pre>
            </>
          )}
        </div>
      </div>

      {downloadError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {downloadError}
        </div>
      )}
      {downloadDone && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          ✓ Downloaded! Check your downloads folder.
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 font-medium text-slate-700 transition hover:bg-gray-50"
        >
          ← Back
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void downloadZip()}
            disabled={downloading || !job.templateId}
            className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-5 py-2.5 font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40"
          >
            {downloading ? "Generating…" : "⬇ Download ZIP"}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition hover:bg-indigo-700"
          >
            Next: Test Agent →
          </button>
        </div>
      </div>
    </div>
  );
}
