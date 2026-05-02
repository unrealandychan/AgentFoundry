# Release Notes

## v0.11.0 — Security Hardening, Test Coverage, Refactoring & Bug Fixes
**2026-05-02**

### Security

- **Rate limiting on all API routes** — `checkRateLimit()` applied to every outbound API route (test-agent, summarize, skill-builder, import-repo, generate). Prevents abuse and API cost explosion from unauthenticated callers. (PR #62)
- **Auth guard on skill download & sandbox endpoints** — `/api/skills/download` and sandbox-related endpoints now require authentication before serving content. (PR #63)
- **YAML injection prevention in `buildSkillFileContent()`** — replaced hand-rolled YAML template literal with `yaml.stringify()` from the `yaml` package. Prevents colon / newline injection attacks in generated SKILL.md files. (#42)
- **Path traversal confirmed mitigated** — `upload/route.ts` `sanitizeSessionId()` guard verified and documented; no additional code change needed. (#46)

### Fixed

- **`coordinatorCheck()` now respects active model** — the coordinator and convergence agents previously hard-coded `gpt-4o-mini`. They now accept and forward the `model` param chosen by the user in the UI. (PR #58, #48)
- **MongoDB unsafe casts replaced with Zod validation** — all `as unknown as SkillManifest` and `as unknown as SandboxSession[]` patterns in `skill-store.ts` and `sandbox-session-store.ts` replaced with `SkillManifestSchema.safeParse()` / runtime type guards. Throws descriptive errors on invalid data instead of silently passing bad shapes. (PR #60, #44)
- **S3 `FileBackedSkillStore.list()` concurrency cap** — `Promise.all()` over all S3 objects now batched in chunks of 10 to prevent socket exhaustion on large buckets. (#53)
- **`/api/health` endpoint added** — new `GET /api/health` route returns `{ status: "ok", timestamp }` for load-balancer and uptime-monitor probes. (#50)
- **`SummarizeMessageSchema` de-duplicated** — aliased to `ChatHistoryMessageSchema`; duplicate Zod schema definition removed. (PR #59, #45)
- **Sandbox session persistence** — sandbox session state now persisted server-side with `localStorage` as a fallback. Session survives page refresh. (#35)
- **Orphan SDK agents in multi-agent `createAgents()`** — unused `sdkAgents` map entries are now cleaned up after each run to prevent memory leaks. (#34)
- **Custom skills missing from wizard downstream steps** — `GET /api/skills` now merges registry + store results so custom and imported skills appear in Customize, Preview, Test Agent, and ZIP. (#33)
- **ReDoS risk in frontmatter parser** — replaced custom regex frontmatter parser with `gray-matter` which handles malformed YAML safely. (#32)
- **GitHub token moved to Authorization header** — `GITHUB_TOKEN` now sent as `Authorization: Bearer …` instead of a request body field, matching GitHub API spec. (#31)
- **OpenAI SDK provider initialised once** — provider was being re-instantiated on every request; moved to module-level singleton to avoid performance and connection-pool issues. (#30)
- **Docker `COPY` for optional `public/` directory** — `Dockerfile` now uses glob pattern so builds succeed even when the `public/` folder is absent. (PR #57)
- **`npm test` script alias added** — `package.json` now exposes a bare `test` script that delegates to `vitest run`, fixing CI pipelines that call `npm test`. (PR #55, #37)
- **Vitest mock pollution fixed** — global `beforeEach(vi.resetAllMocks())` added to `api-routes.test.ts` so cross-test mock state bleed no longer causes false positives. (#54)

### Refactored

- **`step-test-agent.tsx` God Component split** — 1135-line monolith broken into focused modules: (#43)
  - `src/components/wizard/utils/chatUtils.ts` — constants, interfaces, pure helpers (`truncateInstructions`, `estimateCost`, `agentColor`, `inlineMarkdown`, `renderMarkdown`)
  - `src/components/wizard/ChatBubble.tsx` — isolated chat bubble sub-component
  - `src/components/wizard/hooks/useAgentDefs.ts` — derives `agentDefs`, `agentIndexMap`, `systemPrompt` from `job`
  - `src/components/wizard/hooks/useTestAgentChat.ts` — all chat state + streaming `sendMessage`, `uploadFiles`, `clearHistory`
  - `src/components/wizard/hooks/useSummary.ts` — summary panel state + `generateSummary`
  - Main component reduced from **1135 → 525 lines**
- **`isTextDelta()` uses official SDK types** — replaced `event: unknown` + manual `Record<string, unknown>` casting with `RunStreamEvent` union type, `instanceof RunRawModelStreamEvent` guard, and `StreamEventTextStream` from `@openai/agents`. (#52)
- **Shared `MessageSchema` extracted** — `ChatHistoryMessageSchema` and `SummarizeMessageSchema` now share a single base schema definition in `schemas.ts`. (PR #59)

### Tests

- **`composer.ts` unit tests** — ZIP assembly logic, `buildSkillFileContent()`, and `compose()` covered by vitest tests. (PR #56)
- **`import-repo` route unit tests** — 32 tests added in `src/lib/__tests__/import-repo.test.ts` covering `parseRepoUrl`, `extractSection`, `extractSkillFromMarkdown`, and the POST handler (rate limit, 404, successful import, README fallback, network errors). (#47)

### Roadmap updates

- ✅ **Dark mode** shipped (was P3) — removed from backlog.

---

## v0.10.0 — Full MCP Registry Expansion, Category Filtering & New Templates/Skills
**2026-04-17**

### Added

#### MCP Integration Registry
- **35 individual MCP servers** across 9 categories (up from 7). New entries:
  - **Dev Tools** — GitLab
  - **Databases** — Supabase, MySQL, MongoDB, Redis
  - **Search & RAG** — Tavily Search, Exa Search, Firecrawl, DeepWiki
  - **Productivity** — Linear, Zapier
  - **CRM** — HubSpot, Salesforce, Attio
  - **Cloud & Infra** — AWS, Google Cloud, Kubernetes
  - **Browser & QA** — Playwright
  - **Design** — Figma
  - **General** — Composio
- **15 curated bundles** (up from 5). New bundles: Google Workspace, Legal & Compliance, HR Onboarding, Sales & CRM, Design & UX, DevOps & Cloud. Each ships with a `tooltip` and `installHint`.
- **`category` field** on `IntegrationManifest` (TypeScript type + Zod schema) — optional string that identifies the server's domain.

#### Integrations Step UI
- **Category filter tabs** on the Add Integrations step — pill buttons (All / Dev Tools / Databases / Search & RAG / Productivity / CRM / Cloud & Infra / Browser & QA / Design / General) filter the individual servers grid in real time. "All" is the default.
- Empty state shown when no servers match the selected category.
- `categoryFilter` state added to `StepAddIntegrations`; `filteredIndividual` derived via `useMemo`.

#### Skill Recommendations
- `SKILL_INTEGRATION_RECOMMENDATIONS` map expanded from 16 → 30 skills:
  - **ux-researcher** → Notion, Sequential Thinking, Figma, Design & UX Bundle
  - **technical-writer** → Filesystem, Notion, GitHub, Documentation Bundle
  - **sales-copywriter** → HubSpot, Brave Search, Notion, Sales & CRM Bundle
  - **prospect-researcher** → HubSpot, Brave Search, Attio, Sales & CRM Bundle
  - **legal-proofreader** → Notion, Sequential Thinking, Filesystem, Legal Bundle
  - **contract-reviewer** → Notion, Sequential Thinking, Filesystem, Legal Bundle
  - **onboarding-coordinator** → Notion, Slack, Memory, HR Bundle
  - Existing skills updated with richer recommendations (e.g. `test-engineer` now includes Playwright, `brand-voice-guardian` includes Figma, `email-marketing-writer` includes HubSpot)

#### New Templates (3)
- **Legal & Compliance Agent** ⚖️ — contract review, policy audit, redline generation
- **HR Onboarding Agent** 🤝 — welcome packets, FAQs, 30-60-90 day plans
- **Sales Outreach Agent** 📞 — prospect research, personalised cold email, CRM logging

#### New Skills (7 SKILL.md files)
- **UX Researcher** — study design, discussion guides, affinity mapping, JTBD synthesis
- **Technical Writer** — Diátaxis framework (tutorial/how-to/reference/explanation/changelog)
- **Sales Copywriter** — AIDA/PAS frameworks, 3-touch email sequences, LinkedIn outreach
- **Legal Proofreader** — clause checklist, risk table, redline suggestions, mandatory disclaimer
- **Contract Reviewer** — risk-tiered (🔴/🟠/🟡/🟢) SaaS/NDA/MSA audit + GDPR/CCPA compliance overlay
- **Onboarding Coordinator** — welcome packet, 18-question FAQ (4 categories), 30-60-90 plan
- **Prospect Researcher** — company profile, decision-maker dossier, pain hypothesis, CRM entry output

### Changed
- `IntegrationManifest` TypeScript interface and `IntegrationManifestSchema` Zod schema — `category?: string` field added (optional, non-breaking).
- All 14 existing individual server entries in `integrations.json` backfilled with `category` values.

---

## v0.9.0 — Custom Skill Creation, Tabbed Test Agent & Full Skill Instructions

**2026-04-17**

### Added

- **Inline skill creation** — a "+ Create a custom skill…" panel on the Add Skills step lets users define a skill by form (Title, Description, Instructions/Persona, Tags) without leaving the wizard. Clicking "Save & Add Skill" calls `POST /api/skills`, persists the skill to disk/S3/MongoDB via the active binding, auto-adds it to a "✏️ My Skills" section, and auto-selects it.
- **Tab per agent + Summary tab** in the Test Agent step — each agent gets its own conversation tab so multi-agent sessions are easy to follow. A dedicated **Summary** tab calls a new `/api/test-agent/summarize` endpoint and renders a structured summary (`## Summary`, `### Topics Discussed`, `### Agent Contributions`, `### Key Decisions & Outcomes`, `### Suggested Next Steps`).
- **`/api/test-agent/summarize`** streaming endpoint — accepts `{ messages, agents }` (Zod-validated), calls GPT-4o-mini, returns `text/plain` streaming.
- **`SummarizeChatRequestSchema`** / **`SummarizeMessageSchema`** added to `src/lib/schemas.ts`.
- **`extraSkills: SkillManifest[]`** field added to `GenerationJob` type and `GenerationJobSchema` — carries full manifests for non-registry skills (custom-created or GitHub-imported) through every wizard stage.
- **`getSkills(ids, extra?)`** — registry lookup now accepts an optional second argument and merges `extra` manifests before filtering, so custom/imported skills resolve correctly in Customize, Preview, Test Agent, and ZIP generation.
- **Markdown rendering in chat bubbles** — custom zero-dependency `renderMarkdown()` renders fenced code blocks, headings, bold/italic, inline code, blockquotes, GFM tables, ordered/unordered lists, and `---` rules. No external ESM packages needed.
- **localStorage wizard persistence** — wizard state (`step`, `job`) is saved to `localStorage` under key `agentfoundry_wizard_v1`. Lazy `useState` initializers make this SSR-safe. `goHome()` clears the stored state. Only `"build"` mode is restored on refresh.
- **`@tailwindcss/typography`** installed and wired into `tailwind.config.ts`.

### Fixed

- **Custom and imported skills now appear in all downstream wizard steps** — Customize, Preview, Test Agent, and the downloaded ZIP. Previously, skills not in the built-in registry were silently dropped because `getSkills()` only searched `skills.json`.
- **`extraSkills` sync via `useEffect`** — the Add Skills step uses a `useEffect` to declaratively push `[...customSkills, ...importedSkills]` into `job.extraSkills` on every change, replacing fragile conditional guards in event handlers that could silently skip the update.
- **Full skill body now used as agent instructions** — `extractPersonaText()` in `skill-loader.ts` previously used a regex to grab only the first "You are…" paragraph. It now returns the entire body after the `# Title` heading, so all phases, tables, output format rules, and constraints flow through to the OpenAI system prompt.
- **`ERR_INCOMPLETE_CHUNKED_ENCODING`** — `max_tokens: 350` cap in collaborate mode, `max_tokens: 600` in single-agent mode, plus conciseness instructions injected into prompts.
- **`ERR_STREAM_PREMATURE_CLOSE` / "failed to pipe response"** — `ReadableStream` now calls `controller.close()` on success and `controller.error(err)` on real errors; client disconnects (stream destroyed) are handled silently. Fixed in both collaborate and single-agent paths.
- **`AgentDefinitionSchema.instructions` limit** raised from 4 000 to 32 000 chars (named constant `MAX_INSTRUCTIONS_CHARS`). All real skills (up to ~10 KB) now pass validation without truncation.
- **`step-preview.tsx` `DEFAULT_JOB`** updated to include `extraSkills: []` to satisfy the updated `GenerationJob` type.
- **Custom skills seeded on mount** — on returning to the Add Skills step, the API response is diffed against the static registry; non-registry skills are automatically placed into the "✏️ My Skills" section and into `customSkills` state.

### Changed

- **`AgentDefinitionSchema.instructions`** — max raised from 4 000 → 32 000 chars. A `truncateInstructions()` utility in `step-test-agent.tsx` applies smart section-priority trimming at 24 000 chars (60% head / 35% tail) if a skill ever exceeds that threshold.
- **`extractPersonaText()`** rewritten — returns full skill body instead of first "You are…" paragraph.
- **Stream error handling** refactored — `finally { controller.close() }` pattern removed from both streaming paths; replaced with explicit `close` on success and `error` on failure.

---

## v0.8.0 — Pluggable Skill Storage Bindings

**2026-04-17**

### Added

- **`SkillFileBinding` interface** (`src/lib/skill-bindings.ts`) — pluggable storage abstraction for raw SKILL.md files with four operations: `listIds`, `readFile`, `writeFile`, `deleteFile`.
- **`LocalSkillBinding`** — default binding. Reads and writes `skills/<id>/SKILL.md` files on disk. Full CRUD with no extra configuration. `create` writes a new folder + file; `update` rewrites the SKILL.md in place; `delete` removes the folder.
- **`S3SkillBinding`** — cloud binding activated by setting `S3_BUCKET`. Each skill lives at `{S3_PREFIX}{id}/SKILL.md` in the configured bucket. Full CRUD via the AWS SDK (`@aws-sdk/client-s3`). Configure via:
  - `S3_BUCKET` (required) — bucket name
  - `S3_REGION` (optional, default `us-east-1`)
  - `S3_PREFIX` (optional, default `skills/`)
  - Standard AWS credential chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, `~/.aws/credentials`, IAM roles.
- **`getSkillFileBinding()` factory** — selects the binding at startup: `S3_BUCKET` set → S3; otherwise → Local.
- **`FileBackedSkillStore`** in `skill-store.ts` — replaces the old read-only `LocalSkillStore`. Uses any `SkillFileBinding` and supports full CRUD for all binding types. Factory priority: `MONGODB_URI` → MongoDB; `S3_BUCKET` → S3; default → Local disk.
- **`parseSkillContent(id, content)`** exported from `skill-loader.ts` — shared parser used by `FileBackedSkillStore` and any future binding.
- **`serializeSkillToMarkdown(skill)`** exported from `skill-loader.ts` — serializes a `SkillManifest` back to SKILL.md string for create/update writes.
- Download route (`/api/skills/download`) now uses the active binding's `readFile()` for ZIP assembly — works correctly when S3 is configured.
- CRUD API routes (`POST /api/skills`, `PUT /api/skills/:id`, `DELETE /api/skills/:id`) no longer restricted to MongoDB; all work with Local and S3 bindings too.

### Changed

- `LocalSkillStore` removed; replaced by `FileBackedSkillStore(LocalSkillBinding)`.
- `.env.sample` should be updated with `S3_BUCKET`, `S3_REGION`, `S3_PREFIX` entries.

### Added dependency

- `@aws-sdk/client-s3` — loaded by the S3 binding; zero impact on Local/MongoDB paths.

---

## v0.7.0 — Skill Builder

**2026-04-17**

### Added

- **Skill Builder** — new third entry point on the home screen. A split-panel editor lets users write a `SKILL.md` from scratch or generate one from a name + one-sentence description.
- **Live lint scoring** — as you type, a score ring (0–100) and grade badge (A–F) update in real time against 10 structural checks: YAML frontmatter, `name` / `description` / `user-invocable` fields, H1 heading, persona statement, phase sections, `## Output Format`, `## Constraints`, and minimum content depth. Each failing check shows an inline hint explaining exactly what to add.
- **AI generation** (`✨ Generate with AI`) — an expand-in-place form in the header accepts a skill name and purpose; hitting Generate calls `/api/skill-builder` (GPT-4o mini) and fills the editor with a complete, structured `SKILL.md`.
- **AI completion** (`✨ Complete with AI`) — sends the current editor content to the API and receives a version with all missing sections filled in, preserving everything the user already wrote.
- **One-click download** — the `⬇ Download SKILL.md` button exports the current editor content as a file.
- **`/api/skill-builder` route** — POST endpoint with two actions: `generate` (name + purpose → full skill) and `complete` (partial content → filled-in skill). Uses the same `OPENAI_API_KEY` / `OPENAI_BASE_URL` config as the rest of the app.
- **`src/lib/skill-linter.ts`** — pure, dependency-free scoring library. Returns `{ score, maxScore, grade, checks }` and can be reused server-side in future validation flows.
- **Home screen 3-column layout** — the three entry-point cards (Build with Template, Download a Skill, Build a Skill) now sit in a uniform 3-up row at all `sm`+ breakpoints.

---

## v0.6.0 — Rebranding + UX Overhaul + GitHub Import Fixes

**2026-04-17**

### Added

- **AgentFoundry rebrand** — the project is now called **AgentFoundry**. All UI labels, generated file headers, MongoDB database name, Docker image/container names, npm package name, and documentation updated throughout.
- **Test Agent split-panel layout** — the Test Agent step is now a true left/right layout: a compact **config bar** (model selector + security badge + system prompt toggle) sits above a split view with the workspace panel on the left and the chat interface on the right. Input bar is fixed to the bottom of the chat panel.
- **GitHub Import: rate-limit budget** — the repo scanner now caps itself at 15 API calls and 20 files per import, preventing unauthenticated rate-limit exhaustion (60 req/hr). Errors from GitHub (403/429) now surface as a readable message instead of a silent 502.
- **GitHub Import: `GITHUB_TOKEN` support** — set `GITHUB_TOKEN` in `.env.local` to raise the API limit to 5 000 req/hr and reliably scan large repos like `danielmiessler/fabric`.
- **GitHub Import: README.md fallback** — if no `skills/`, `prompts/`, or `patterns/` folder is found, the repo's `README.md` is imported as a single skill so no scan ever returns empty.
- **GitHub Import: structured section extraction** — `personaText` now extracts the `## Instructions`, `## Persona`, `## System Prompt`, `## Behavior`, `## Role`, or `## Prompt` section from each file instead of dumping raw content. Descriptions prefer `## Description` / `## Overview` sections.
- **GitHub Import: deeper recursive scan** — scans up to 3 directory levels inside skill folders, correctly handling `skills/{name}/SKILL.md` layouts used by most Claude Code skill repos.
- **GitHub Import: curated trending repos** — quick-pick buttons updated to repos with real parseable skill content: `forrestchang/andrej-karpathy-skills`, `danielmiessler/fabric`, `anthropics/anthropic-cookbook`, `openai/openai-cookbook`, `f/awesome-chatgpt-prompts`, `travisvn/awesome-claude-skills`.
- **GitHub Import: expanded folder signals** — scanner now also detects `patterns/` and `instructions/` directories.

### Fixed

- `next: { revalidate: 0 }` replaced with `cache: "no-store"` on all GitHub API fetches (correct for Next.js 14 Route Handlers — `revalidate` was silently ignored in route context).
- `fetchGitHubContents` now validates the response is an array before casting (GitHub returns an object, not an array, when a path points to a single file).
- Regex `\z` (PCRE-only) replaced with valid JS pattern — section extraction now works correctly in all runtimes.
- 502 "Bad Gateway" on GitHub Import caused by unhandled rate-limit throws inside recursive scanner — all errors now caught and returned as structured JSON with correct HTTP status.

### Changed

- Removed verbose **OpenAI Agents SDK info banner** from Test Agent step (reduced visual noise).
- Removed **star counts** from GitHub Import quick-pick buttons.
- Test Agent model selector moved from its own `<div>` block into the unified config bar.

---

## v0.5.0 — Dual Entry Flow + Standalone Skill Download

**2026-04-17**

### Added

- **Flow chooser landing screen** — the app now opens on a two-card chooser: **Build with Template** (full 8-step wizard) or **Download a Skill** (standalone skill browser). Users can return to this screen at any time via the **← Home** link in the wizard header.
- **Download Skill flow** (`src/components/skill-download-flow.tsx`) — browse all skills with a search box and category tab filter (All / Engineering / Workflow / Documentation / Marketing), select any combination with Select All / Clear shortcuts, then download a `skills.zip` in one click.
- **`/api/skills/download`** POST endpoint — accepts `{ skillIds: string[] }` (Zod-validated, 1–50 IDs), fetches each skill via `getSkillStore()`, assembles `skills/{id}/SKILL.md` entries in a ZIP via JSZip, and returns `application/zip`.
- **`INSTALL.md`** included in every `skills.zip` — explains how to copy the `skills/` folder into an existing project and reference it from `AGENTS.md` or an `Agent()` constructor.
- **`← Home` navigation in wizard** — the logo and "← Home" text in the wizard header invoke `onHome()`, resetting both the app mode and wizard state so users start fresh.

---

## v0.4.0 — Server-side API Key + Configurable Base URL + Session Workspace

**2026-04-17**

### Added

- **Server-side OpenAI key** — `OPENAI_API_KEY` is now read exclusively from the server environment. The browser never handles the key. A `503` is returned with a clear message if the key is missing.
- **Configurable `OPENAI_BASE_URL`** — set this env var to point the chat proxy at any OpenAI-compatible API: Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), Azure OpenAI, or any self-hosted endpoint.
- **Session workspace** — users can upload text files (`.md`, `.ts`, `.py`, `.json`, `.yaml`, `.sh`, `.sql`, `.tf`, `.go`, and 30+ more extensions) from the Test Agent step. Files are stored under `/tmp/{sessionId}/` on the server and automatically injected as a `## Workspace Files` context block into every agent's system prompt for that session.
- **`/api/workspace/upload`** endpoint — multipart `POST {sessionId, file}` with full security: session ID regex validation, filename sanitisation, path traversal guard, 2 MB size cap, text-extension allowlist (~40 types).
- **Workspace panel UI** — drag-and-drop or click-to-browse file upload area on the Test Agent step showing uploaded file pills. Files are scoped to the current browser session via a client-generated UUID.

### Changed

- **Removed OpenAI API key input** from the Test Agent UI — replaced with a green server-configuration status banner.
- `TestAgentRequestSchema` — `apiKey` field removed; optional `sessionId` field added.
- `.env.sample` — added `OPENAI_BASE_URL` with commented examples for common providers; updated comment on `OPENAI_API_KEY` to reflect server-only usage.

### Security

- API key never transmitted from browser to server.
- Workspace files capped at 20 per session, 8 000 chars per file in injected context.
- Session IDs validated server-side on both upload and test-agent routes.

---

## v0.3.0 — GitHub Import + Expanded MCP Registry

**2026-04-17**

### Added

- **GitHub repo import** (`/api/import-repo`): paste any public GitHub URL; the app scans for `skills/`, `prompts/`, `agents/`, `.github/`, `.cursor/` folders and top-level `CLAUDE.md` / `AGENTS.md` files, parses each Markdown file into a `SkillManifest`, and lets you select which to add
- **GitHub Import Panel** UI component on the Skills step — includes a "Try it" deep-link to `forrestchang/andrej-karpathy-skills` as a working example
- **7 individual MCP server entries** in the integrations registry (Filesystem, Memory, Fetch, Sequential Thinking, Git, GitHub, Time) — all sourced from the official `modelcontextprotocol.io` reference servers
- `installHint` field on every integration — shown as a dark terminal block in the UI for fast one-line copy-paste bootstrapping
- Skills step now renders **Imported Skills** and **Built-in Skills** sections separately

### Changed

- Integrations step now splits MCP servers into **Individual Servers** and **Curated Bundles** sections
- `IntegrationManifest` type and Zod schema updated with optional `installHint`

---

## v0.2.0 — OpenAI SDK Live Agent Test + ZIP Export

**2026-04-17**

### Added

- **Step 6: Test Your Agent** — streaming OpenAI chat in-browser using the composed system prompt; API key never stored or logged; key redacted from error messages
- **`/api/test-agent`** route — proxies to OpenAI with streaming, validates `sk-` key format
- **`/api/generate`** route — assembles a ZIP via JSZip containing: `README.md`, `AGENTS.md`, `SKILLS.md`, `.env.example`, `mcp.json`, `setup.sh`, `setup.ps1`, `starter.yaml`, and agent-target-specific files
- **Agent-target-specific output**: `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules`, `.windsurf/rules` generated depending on target selection
- **Step 5: File Tree Preview** — browse every generated file before downloading

### Changed

- Wizard extended from 5 to 7 steps; test step inserted between Preview and Download
- Download step now shows full file manifest before triggering the ZIP request

---

## v0.1.0 — MVP App Shell

**2026-04-17**

### Added

- Next.js 14 App Router project scaffold with TypeScript + Tailwind CSS
- 7-step wizard layout with step indicator and navigation
- **Template registry** (6 starters): Next.js AI App, Python Agent, CLI AI Tool, RAG Application, Copilot Coding Assistant, MCP Research Agent
- **Skill registry** (10 built-in packs): Clean Code+DDD, Commit Hygiene, Coding Mentor, Senior Engineer, Debugger, Test Engineer, Refactoring Expert, Security Reviewer, Documentation Writer, Spec Writer
- **Integration registry** (5 bundles): Basic Coding, Research, GitHub Coding, Documentation, Planning
- `composer.ts` — merges template + skills + integrations into a `ComposedPackage` with full file list and system prompt
- Zod schemas for all inputs (`GenerationJobSchema`, `TestAgentRequestSchema`)
- ESLint, Prettier, husky, lint-staged configuration

---

## Roadmap / Next TODOs

> These are the recommended next steps, ordered by impact.

### P0 — Must-have before public launch

- [ ] **User accounts + saved presets** — let users save their composer configuration and return to it; enable shareable load URLs (`?preset=...`)
- [ ] **Template file scaffolding** — currently the ZIP contains agent config only; generate actual project source files per template (e.g. Next.js pages, Python agent entrypoint, `requirements.txt`) so the downloaded project is immediately runnable
- [ ] **Compatibility validation** — warn when an MCP config requires a runtime (e.g. Python-based `mcp-server-git`) that conflicts with the selected template stack

### P1 — Quality and trust

- [ ] **Multi-turn chat in Test Agent** — currently single-turn; add full conversation history to enable back-and-forth testing
- [ ] **Model selector in Test Agent** — allow choosing `gpt-4o`, `gpt-4o-mini`, `o3-mini` for cost/quality tradeoffs
- [ ] **Import from private repos via GitHub OAuth** — today import is public-only; add optional OAuth flow so users can scan their own private repos
- [ ] **SKILL.md format support** — detect and parse the `skills/{name}/SKILL.md` structure used by the Claude Code plugin ecosystem (e.g. `forrestchang/andrej-karpathy-skills`)
- [ ] **Skill editor** — let users edit the `personaText` of any skill inline before composing

### P2 — Scale and community

- [ ] **Community skill marketplace** — allow publishing and discovering skills from the registry; add ratings and version metadata
- [ ] **"Open in GitHub" / "Create repo"** — after download, offer a one-click flow to push the generated package to a new GitHub repo via the GitHub API
- [ ] **Reproducibility: "Edit and Regenerate"** — parse `starter.yaml` to reload a previous session so users can iterate on their pack
- [ ] **MCP health check** — verify each selected MCP server is installable before including it in the generated config
- [ ] **Template versioning** — pin template and skill pack versions so compositions stay stable over time

### P3 — Polish

- [ ] **Dark mode**
- [ ] **Template search and filter by tag**
- [ ] **GitHub import pagination** — currently scans only the first level of each skill folder; add recursive scanning for deeper repos
- [ ] **Export to Backstage Software Template format** — for teams already using Backstage
