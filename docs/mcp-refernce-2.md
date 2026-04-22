Yes — you should explicitly label **which presets need Python, JavaScript/Node, Go, or just shell scripts**. That matters because different parts of your product need different runtime support: MCP servers often need a language runtime, while agent instruction files usually do not. Spec Kit also makes script type explicit by supporting both Bash and PowerShell variants for automation. [github.github](https://github.github.com/spec-kit/installation.html)

A practical rule is: **Skills usually need no runtime, MCP often needs a runtime, and setup/install scripts usually need shell or PowerShell**. GitHub Copilot instruction files are plain Markdown and do not require Python, JS, or Go support by themselves. [docs.github](https://docs.github.com/zh/copilot/how-tos/configure-custom-instructions/add-repository-instructions)

## Runtime model

Use these categories in your app:

| Type                   | Usually needs runtime? | Common runtime                                                                                                                                                                       |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skill                  | Usually no             | None; plain Markdown/YAML/JSON [docs.github](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)                                       |
| MCP config only        | Sometimes no           | None if only generating `mcp.json`; runtime is needed by the actual server [modelcontextprotocol](https://modelcontextprotocol.io/examples)                                          |
| MCP server             | Yes                    | Python, Node/JS, or Go depending on implementation [modelcontextprotocol](https://modelcontextprotocol.io/docs/develop/build-server)                                                 |
| Setup script           | Yes                    | Shell (`sh`) or PowerShell (`ps1`) [github.github](https://github.github.com/spec-kit/quickstart.html)                                                                               |
| Repo instruction files | No                     | Markdown files like `.github/copilot-instructions.md` or `AGENTS.md` [docs.github](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions) |

## What needs Python

Python is best when the preset includes a **real MCP server**, data tooling, scripting-heavy automation, or AI workflows. MCP server guides and examples explicitly show Python as a supported implementation path. [gofastmcp](https://gofastmcp.com/tutorials/create-mcp-server)

Good presets that should support Python:

- **AI agent builder pack** — useful if you want a local MCP server, prompt tools, or memory server in Python. [modelcontextprotocol](https://modelcontextprotocol.io/docs/develop/build-server)
- **Data engineer pack** — Python is natural for ETL, notebooks, scripts, and validation jobs.
- **Research assistant pack** — Python works well for scraping, parsing, and tool orchestration. [digitalocean](https://www.digitalocean.com/community/tutorials/mcp-server-python)
- **MCP server starter pack** — Python is one of the clearest first-class choices for implementing custom MCP servers. [github](https://github.com/ruslanmv/Simple-MCP-Server-with-Python)
- **Spec-to-code automation pack** — Python is good for generating files, parsing manifests, and CLI helpers.

Use Python when:

- the pack includes backend automation,
- the MCP server is custom,
- there is data parsing or AI orchestration,
- or users may want a CLI with good scripting ergonomics.

## What needs JavaScript / Node

JavaScript or TypeScript is best when the starter is **web-first**, tied to frontend tooling, or meant to integrate naturally with modern app stacks. MCP implementations and examples also commonly use TypeScript/Node. [stainless](https://www.stainless.com/mcp/mcp-sdk-comparison-python-vs-typescript-vs-go-implementations)

Good presets that should support JS/Node:

- **General coding assistant** for web app repos
- **Copilot-ready repo pack** for React/Next.js/Node projects
- **Open-source maintainer pack** for NPM libraries and JS monorepos
- **AI web app starter** combining frontend app + MCP config
- **GitHub coding pack** if your export includes CLI helpers in Node
- **MCP server starter pack** when targeting TypeScript developers. [lobehub](https://lobehub.com/zh/mcp/tsubot-mcp-server-sample01)

Use JS/Node when:

- the template is a web app,
- the repo already uses `package.json`,
- users want browser tooling,
- or the MCP server should align with frontend/full-stack JavaScript teams.

## What needs Go

Go is best for **fast CLI tools, lightweight daemons, infra tooling, and teams that want a single compiled binary**. Go is also part of the MCP implementation landscape, though it is usually less beginner-friendly than Python or Node for rapid customization. [stainless](https://www.stainless.com/mcp/mcp-sdk-comparison-python-vs-typescript-vs-go-implementations)

Good presets that should support Go:

- **Cloud deployment pack**
- **Infra automation pack**
- **MCP server starter pack** for teams wanting a compiled service
- **DevOps assistant pack**
- **CLI tool generator**

Use Go when:

- performance and distribution matter,
- you want one binary with minimal runtime installation,
- or the target users are platform engineers / infra teams.

## What only needs shell or PowerShell

Some presets do **not** need Python, JS, or Go at all if they only generate files and setup commands. Spec Kit’s documentation is a good reference here because it separates script type choice from agent/template choice. [github.github](https://github.github.com/spec-kit/quickstart.html)

These can be shell/PowerShell only:

- **Spec writer pack**
- **Documentation writer pack**
- **Repo onboarding pack**
- **Copilot instructions pack**
- **AGENTS.md generator**
- **Basic project bootstrap pack**
- **Repo hygiene pack**

These mostly generate:

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `README.md`
- `spec.md`
- `plan.md`
- `tasks.md`
- `setup.sh`
- `setup.ps1`

No Python/JS/Go runtime is required unless you also generate an executable helper CLI. [docs.github](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)

## Recommended mapping

Here is a practical mapping for your catalog.

| Preset                      | Skill                          | MCP                         | Script/runtime support                                                                                                                                                                                              |
| --------------------------- | ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General coding assistant    | Senior engineer                | Filesystem, Git, Fetch      | Shell/PowerShell only by default; add JS if template is Node-based [github](https://github.com/modelcontextprotocol/servers)                                                                                        |
| Copilot-ready repo pack     | Senior engineer, test engineer | Optional Filesystem/Git     | No Python/Go needed; shell + Markdown files are enough [docs.github](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)                                              |
| Spec-driven feature pack    | Spec writer, planner           | Sequential Thinking, Memory | Shell/PowerShell only for docs bootstrap; Python optional for advanced automation [github](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) |
| AI agent builder pack       | Spec writer, senior engineer   | Memory, Fetch, Filesystem   | Python or JS recommended; shell scripts also needed [modelcontextprotocol](https://modelcontextprotocol.io/docs/develop/build-server)                                                                               |
| Debug and fix pack          | Debugger                       | Filesystem, Git, Memory     | Shell/PowerShell only by default; Python optional for log tooling                                                                                                                                                   |
| Documentation pack          | Documentation writer           | Filesystem, Fetch           | Shell/PowerShell only [docs.github](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)                                                                               |
| MCP server starter pack     | Backend engineer               | Custom MCP server           | Python, JS, or Go required depending on selected implementation [modelcontextprotocol](https://modelcontextprotocol.io/docs/develop/build-server)                                                                   |
| Open-source maintainer pack | Refactorer, docs writer        | GitHub, Git, Filesystem     | Shell/PowerShell; JS often useful for OSS repos using Node [modelcontextprotocol](https://modelcontextprotocol.io/examples)                                                                                         |
| Cloud deployment pack       | Cloud architect                | Filesystem, Fetch, Git      | Shell/PowerShell by default; Go or Python optional for helper CLI                                                                                                                                                   |
| Data engineer pack          | Data engineer                  | Filesystem, Fetch, Memory   | Python strongly recommended                                                                                                                                                                                         |

## Best product rule

I would add a field like this to every preset:

- `runtimeRequired`: `none | shell | powershell | python | node | go | multiple`
- `runtimeOptional`: array
- `generatedArtifacts`: array
- `mcpServerImplementation`: `config-only | python | node | go`

That makes the UI much clearer. A user should immediately see:

- **No runtime needed**
- **Needs Python 3.11+**
- **Needs Node 20+**
- **Needs Go 1.22+**
- **Generates shell + PowerShell scripts**

## Good defaults

For v1, I would standardize like this:

- **Skills** → no runtime
- **Instruction packs** → no runtime
- **Bootstrap/setup** → always generate both `setup.sh` and `setup.ps1` when possible, since Spec Kit shows that cross-platform script support is useful. [github.github](https://github.github.com/spec-kit/installation.html)
- **Custom MCP servers** → let user choose Python or Node first; add Go later, because Python and TypeScript are the most approachable starting points in current MCP docs and examples. [modelcontextprotocol](https://modelcontextprotocol.io/docs/develop/build-server)

## Simple user-facing labels

In the UI, show badges like:

- `No runtime`
- `Shell + PowerShell`
- `Python`
- `Node.js`
- `Go`
- `Python or Node`
- `Config only`

That will make the catalog much easier to scan.

## My recommendation

If you want a simple launch strategy:

- Start with **skills and script packs that need no runtime**
- Add **Python + Node** as first-class runtime options for MCP server presets
- Add **Go** later for infra / CLI / high-performance templates

That sequencing is practical because not every preset needs code execution support, while MCP server builders clearly benefit from language-specific implementations. [lobehub](https://lobehub.com/zh/mcp/tsubot-mcp-server-sample01)

If you want, I can next make you a **table of 20 preset ideas with columns for Skill, MCP, scripts, and required runtime**.
