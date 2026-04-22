# Conventional Commits Reference

This reference is used by the `commit-hygiene` skill.

## Format

```
type(scope): subject

[optional body]

[optional footer(s)]
```

---

## Types

| Type       | When to use                                                               |
| ---------- | ------------------------------------------------------------------------- |
| `feat`     | New feature visible to the end user                                       |
| `fix`      | Bug fix visible to the end user                                           |
| `docs`     | Documentation changes only                                                |
| `style`    | Code style — whitespace, formatting, missing semicolons (no logic change) |
| `refactor` | Code change that is neither a bug fix nor a feature                       |
| `perf`     | Code change that improves performance                                     |
| `test`     | Adding or correcting tests                                                |
| `chore`    | Build process, dependency updates, CI, tooling changes                    |
| `revert`   | Reverts a previous commit                                                 |
| `release`  | Bumps version, prepares changelog                                         |

---

## Subject Rules

- Lowercase, imperative mood: **"add user auth"** not "Added user auth" or "Adds user auth"
- No trailing period
- Minimum 10 characters, maximum 72 characters
- Describes **what** the commit does, not **why** (use body for why)

---

## Scope Examples

Scope is optional but strongly recommended for larger codebases.

```
feat(auth): add OAuth2 login with GitHub
fix(api): handle 429 rate-limit response from OpenAI
docs(readme): update quick start setup steps
chore(deps): bump vitest from 1.6.0 to 2.1.0
```

---

## Breaking Changes

Add `!` before the colon, or include `BREAKING CHANGE:` footer:

```
feat(api)!: change response shape for /users endpoint

BREAKING CHANGE: responses now use { data, meta } envelope
```

---

## Multi-line Body Example

```
fix(payments): prevent double-charge on network timeout

The Stripe webhook was not idempotent — a retry after a network
timeout would re-process the charge. Added idempotency key derived
from the payment intent ID.

Closes #412
```

---

## husky + commitlint Quick Setup

```bash
npm install --save-dev husky @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };

# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

---

## Common Violations

| Violation        | Example                                                         | Fix                               |
| ---------------- | --------------------------------------------------------------- | --------------------------------- |
| Wrong mood       | "Added login"                                                   | "add login"                       |
| No type          | "fix crash on mobile"                                           | "fix: crash on mobile"            |
| Subject too long | "feat: implement the new user authentication system with OAuth" | Shorten to ≤72 chars              |
| Vague subject    | "fix stuff"                                                     | Describe the specific thing fixed |
| bypass hook      | `git commit --no-verify`                                        | Fix the commit message instead    |
