# AgentFoundry — Project TODO

> Last updated: 2025-07-10
> Track feature status across all sessions here.

---

## Legend

| Status | Meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| ✅     | Shipped — live in main branch                                             |
| 🔄     | In progress                                                               |
| 📋     | Planned (P0 = must-have, P1 = high-value, P2 = nice-to-have, P3 = future) |
| ❌     | Deprioritised / won't do                                                  |

---

## Phase 1 — App Shell ✅

- ✅ Next.js 14 App Router + TypeScript + Tailwind setup
- ✅ 8-step wizard layout with step indicator
- ✅ `WizardState` + `GenerationJob` types
- ✅ Registry loading (templates, skills, integrations)

## Phase 2 — Composition Engine + ZIP ✅

- ✅ `composer.ts` — merges template + skills + integrations → `ComposedPackage`
- ✅ `/api/generate` — assembles ZIP (JSZip, `uint8array` → `Blob`)
- ✅ All 7 output files generated (AGENTS.md, .github/copilot-instructions.md, CLAUDE.md, .cursor/rules, .windsurf/rules, mcp.json, install.sh)
- ✅ `/api/test-agent` — streaming OpenAI proxy (key never stored)

## Phase 3 — GitHub Import + Expanded Registry ✅

- ✅ `/api/import-repo` — scans public GitHub repos for skill files
- ✅ `github-import-panel.tsx` — in-wizard GitHub scan UI
- ✅ 5 hardcoded trending repos (karpathy-skills, fabric, anthropic-cookbook, awesome-chatgpt-prompts, openai-cookbook)
- ✅ Skill file preview (expand raw markdown before confirming import)
- ✅ Expanded MCP registry: 7 individual servers + 5 bundles (12 integrations total)
- ✅ `README.md` + `RELEASE-NOTES.md`

## Phase 4 — Dynamic Templates + Tooltips ✅

- ✅ 12 templates across 7 audience personas (developer, designer, QA, business, researcher, data, devops)
- ✅ Audience filter tabs on template step
- ✅ Custom template form (name, emoji, audience, stack, tags) with inline save
- ✅ `Tooltip` (ⓘ) component — wired to template cards, skill cards, integration cards, agent target buttons
- ✅ `whyItMatters` + `impact` + `generatedFiles` fields on every template
- ✅ `tooltip` field on every skill and integration

## Phase 5 — Agent Target Step + Non-Dev Skills ✅

- ✅ **Agent Target extracted to its own dedicated wizard step** (was buried in Integrations)
- ✅ Rich agent target cards with emoji, generated file badge, description, and tooltip
- ✅ 6 new marketer / business / non-dev skill packs:
  - Brand Voice Guardian
  - Social Media Content Creator
  - Email Marketing Copywriter
  - Customer Success Messaging
  - Pitch Deck & Presentation Writer
  - Market Research Analyst
- ✅ Total skills: 16 (10 developer + 6 business/marketing)

## Phase 6 — Agent Testing Improvements ✅

- ✅ Model selector (gpt-4o-mini, gpt-4o, gpt-4.1, gpt-5.4)
- ✅ Collapsible system prompt preview (shows AGENTS.md content being sent)
- ✅ OpenAI Agents SDK info panel with `Runner.run()` + `SandboxRunConfig` guidance
- ✅ `.env.sample` with full configuration reference (OpenAI, Anthropic, GitHub, MCP, Pinecone)

## Phase 7 — P0/P1 Feature Completion ✅

- ✅ **Multi-turn conversation history** — full message history sent to API across all 5 completion paths
- ✅ **Token count / estimated cost** — chars÷4 estimate with per-model pricing in sidebar
- ✅ **Clear conversation button** — visible in tab bar
- ✅ **Download from preview step** — ZIP download directly from step 6
- ✅ **Saved sessions** — localStorage persistence (`agentfoundry_wizard_v1`)
- ✅ **Template preview** — "👁 Preview AGENTS.md" button on every template card; modal via `/api/preview-template`
- ✅ **More templates** — Legal & Compliance Agent ⚖️, HR Onboarding Agent 🤝, Sales Outreach Agent 📞 (13 total)
- ✅ **More skills** — UX Researcher, Technical Writer, Sales Copywriter, Legal Proofreader (20 total)
- ✅ **MCP Brave Search integration** — `brave-search-mcp` in integrations.json
- ✅ **Export as Gist** — `/api/gist` route + collapsible PAT-input UI in download step
- ✅ **Agents SDK code snippet** — collapsible Python + TypeScript quick-start in download step

---

## Backlog

### P0 — Must ship soon

- ✅ Add `.gitignore` with `.env.local` and common ignores
- ✅ Validate API key format on client before sending (save a round-trip)
- ✅ Add "Clear conversation" button in test agent step
- ✅ Show token count / estimated cost in test step sidebar

### P1 — High value

- ✅ **Multi-turn conversation history** — send full message history to API (currently single-turn)
- ✅ **Download from preview step** — allow ZIP download directly from step 6 without going to step 8
- ✅ **Saved sessions** — `localStorage` persistence of wizard state across refreshes
- ✅ **Template preview** — show the generated `AGENTS.md` content before confirming template selection
- ✅ **More templates** — Legal / Compliance Agent, HR Onboarding Agent, Sales Outreach Agent
- ✅ **More skills** — UX Researcher, Technical Writer, Sales Copywriter, Legal Proofreader
- ✅ **MCP Brave Search integration** — Fetch + Brave for better web research agents
- ✅ **Export as Gist** — publish generated files directly to GitHub Gist
- ✅ **Agents SDK code snippet** — show ready-to-run Python / TypeScript code using the SDK

### P2 — Nice to have

- 📋 **Dark mode** — Tailwind `dark:` variant support
- 📋 **Shareable links** — encode wizard state in URL for sharing configs
- 📋 **Import from Claude project** — CLAUDE.md and AGENTS.md from existing projects
- 📋 **Sandbox provider selection** — let users pick E2B, Modal, or Vercel for generated sandbox config
- 📋 **Variable interpolation in skills** — `{{PROJECT_NAME}}` substitution in personaText
- 📋 **Skill composer** — create custom skills with a form (like custom templates)
- 📋 **Linting output** — run `eslint`/`biome` check on generated files before ZIP

### P3 — Future / Exploratory

- 📋 **TypeScript Agents SDK support** — when OpenAI ships TS support (announced as upcoming)
- 📋 **Subagent orchestration config** — multi-agent manifest generation
- 📋 **Code mode** — generate executable agent starters (not just config)
- 📋 **Hosted gallery** — community-submitted agent configs with ratings
- 📋 **Vercel / Railway deploy button** — one-click deploy of generated Next.js agent projects
- 📋 **MCP server marketplace** — browse and add third-party MCP servers from a registry

---

## Known Issues

| Issue                                              | Status        | Notes                                        |
| -------------------------------------------------- | ------------- | -------------------------------------------- |
| husky `.git can't be found` warning                | ✅ Harmless   | No git repo initialised in dev; not blocking |
| `next.config.ts` not supported by Next.js 14       | ✅ Fixed      | Renamed to `next.config.mjs` (ESM)           |
| `Buffer` not assignable to `BodyInit` in ZIP route | ✅ Fixed      | `uint8array` → `Blob` wrapper                |
| Biome `noArrayIndexKey` warning in ChatBubble      | ✅ Suppressed | Stable list, intentional                     |

---

## Architecture Notes

- **Framework**: Next.js 14.2 App Router, TypeScript strict, Tailwind CSS 3
- **Validation**: Zod on all API inputs
- **ZIP**: JSZip (server-side), `uint8array` → `Blob` response
- **Streaming**: `ReadableStream` from OpenAI SDK → browser `getReader()`
- **Wizard**: client-only `useState<WizardState>` in `page.tsx`, no server state
- **Registry**: static JSON files loaded + validated via `registry.ts`
- **Agents SDK mapping**: system prompt → `Agent(instructions=...)`, mcp.json → MCP tool list, AGENTS.md → harness context file
