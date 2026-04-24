# CI Pipeline Setup

AgentFoundry uses GitHub Actions for continuous integration.

## Workflow: `.github/workflows/ci.yml`

> **Note:** Due to GitHub PAT scope limitations, the workflow file must be added
> manually. Copy the YAML below into `.github/workflows/ci.yml` in your repo.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
          retention-days: 7

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run TypeScript type check
        run: npx tsc --noEmit

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [test, typecheck]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js app
        run: npm run build
        env:
          OPENAI_API_KEY: sk-placeholder
          MONGODB_URI: mongodb://localhost:27017/agentfoundry
```

## Jobs

| Job | Trigger | Purpose |
|-----|---------|---------|
| `test` | push/PR | Run 51 Vitest unit tests, upload coverage artifact |
| `typecheck` | push/PR | `tsc --noEmit` — catch type errors without building |
| `lint` | push/PR | ESLint with TypeScript + Unicorn + SonarJS rules |
| `build` | push/PR | `next build` — needs `test` + `typecheck` to pass first |

## Features

- **Concurrency cancellation** — stale runs on the same branch are auto-cancelled
- **Node 20 + npm cache** — faster installs via `actions/setup-node` cache
- **Coverage artifact** — uploaded on every test run, retained 7 days
- **Build gating** — `build` only runs if `test` and `typecheck` pass

## Local equivalent

```bash
npm test                   # unit tests
npx tsc --noEmit           # type check
npm run lint               # lint
npm run build              # production build
```
