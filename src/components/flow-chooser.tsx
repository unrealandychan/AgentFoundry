"use client";

interface FlowChooserProperties {
  onChoose: (mode: "build" | "skill-download" | "skill-builder") => void;
}

export function FlowChooser({ onChoose }: FlowChooserProperties) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-indigo-100 bg-white/80 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="size-8 rounded-lg bg-indigo-600" />
          <span className="text-lg font-bold text-slate-900">AgentFoundry</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
            What do you want to do?
          </h1>
          <p className="text-lg text-slate-500">
            Build a full agent project from scratch, or grab a skill pack to drop into your existing
            workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Build with Template */}
          <button
            type="button"
            onClick={() => onChoose("build")}
            className="group flex flex-col items-start rounded-2xl border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-indigo-100 text-3xl transition-colors group-hover:bg-indigo-200">
              🏗️
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">Build with Template</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              Start from a pre-built template (Next.js, Python agent, RAG, MCP, and more). Pick
              skills, configure integrations, preview the file tree, test your agent live, and
              download a ready-to-run ZIP.
            </p>
            <ul className="mb-8 space-y-1.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-indigo-400" />
                8-step guided wizard
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-indigo-400" />
                Live agent test before download
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-indigo-400" />
                Full project ZIP with setup scripts
              </li>
            </ul>
            <span className="mt-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-indigo-700">
              Start building →
            </span>
          </button>

          {/* Download Skill */}
          <button
            type="button"
            onClick={() => onChoose("skill-download")}
            className="group flex flex-col items-start rounded-2xl border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-emerald-400 hover:shadow-md"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-emerald-100 text-3xl transition-colors group-hover:bg-emerald-200">
              🧩
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">Download a Skill</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              Already have a project? Browse the skill library, pick the behaviour packs you need,
              and download them as <code className="rounded bg-slate-100 px-1">SKILL.md</code> files
              ready to drop into your <code className="rounded bg-slate-100 px-1">skills/</code>{" "}
              folder.
            </p>
            <ul className="mb-8 space-y-1.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Filter by tag or category
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Select any combination of skills
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                ZIP of SKILL.md files — drop-in ready
              </li>
            </ul>
            <span className="mt-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-emerald-700">
              Browse skills →
            </span>
          </button>

          {/* Build a Skill */}
          <button
            type="button"
            onClick={() => onChoose("skill-builder")}
            className="group flex flex-col items-start rounded-2xl border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-violet-400 hover:shadow-md"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-violet-100 text-3xl transition-colors group-hover:bg-violet-200">
              🔨
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">Build a Skill</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-500">
              Write or generate your own <code className="rounded bg-slate-100 px-1">SKILL.md</code>{" "}
              from scratch. Get real-time structure scoring, AI-powered completion, and download
              when ready.
            </p>
            <ul className="mb-8 space-y-1.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" />
                Live lint score as you type
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" />
                Generate full skill from a description
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" />
                AI completes missing sections
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" />
                One-click SKILL.md download
              </li>
            </ul>
            <span className="mt-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-violet-700">
              Open builder →
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
