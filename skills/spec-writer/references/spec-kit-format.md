# Spec Kit Format Reference

This reference is used by the `spec-writer` skill.

## Document Structure

A production-ready Spec Kit consists of three documents:

```
spec.md      — What and why (requirements, acceptance criteria)
plan.md      — How (approach, architecture decisions, risks)
tasks.md     — When and who (ordered work breakdown)
```

---

## spec.md Template

```markdown
# [Feature Name] Spec

## Problem Statement

<!-- 2-4 sentences: what is broken or missing, and who is affected -->

## Proposed Solution

<!-- High-level approach. Implementation-agnostic unless stack is decided. -->

## Goals

- [ ] Goal 1 (measurable)
- [ ] Goal 2

## Non-Goals

- Explicitly out of scope: …

## Acceptance Criteria

- [ ] AC1: Given [context], when [action], then [outcome]
- [ ] AC2: …

## Open Questions

| #   | Question | Owner | Status |
| --- | -------- | ----- | ------ |
| 1   | …        | …     | Open   |

## Dependencies

- Depends on: …
- Blocks: …
```

---

## plan.md Template

```markdown
# [Feature Name] Implementation Plan

## Approach

<!-- 3-5 sentences describing the technical approach -->

## Architecture Decisions

| Decision | Option Chosen | Rationale |
| -------- | ------------- | --------- |
| …        | …             | …         |

## Affected Files / Modules

- `src/…` — reason

## Risks

| Risk | Likelihood   | Mitigation |
| ---- | ------------ | ---------- |
| …    | Low/Med/High | …          |

## Testing Strategy

- Unit: …
- Integration: …
- E2E: …
```

---

## tasks.md Template

```markdown
# [Feature Name] Tasks

## Phase 1: Foundation

- [ ] T1: Set up data model / schema
- [ ] T2: Add migration

## Phase 2: Core Logic

- [ ] T3: Implement service layer
- [ ] T4: Add unit tests for service

## Phase 3: API / UI

- [ ] T5: Add API endpoint
- [ ] T6: Add UI component
- [ ] T7: Integration test

## Phase 4: Polish

- [ ] T8: Error handling and edge cases
- [ ] T9: Documentation
- [ ] T10: Performance check
```

---

## Writing Good Acceptance Criteria

Use **Given / When / Then** (Gherkin-style):

```
Given a logged-in user with the "editor" role,
When they submit the publish form with all required fields,
Then the article status changes to "published" and they receive a confirmation email.
```

Rules:

- Each AC tests exactly ONE behaviour
- Quantify where possible — "within 500ms", "no more than 3 steps"
- Avoid implementation details ("clicks button X") — describe outcome
- Cover the unhappy path: add a "Given … When … Then error message…" AC for key failure modes

---

## Common Spec Pitfalls

| Pitfall              | Fix                                                                    |
| -------------------- | ---------------------------------------------------------------------- |
| "Should be fast"     | "Response time < 500ms at p95"                                         |
| "Users will like it" | Write a measurable goal (task completion rate, etc.)                   |
| Missing non-goals    | Explicitly list things out of scope to prevent scope creep             |
| No open questions    | List at least the riskiest unknown                                     |
| Tasks not ordered    | Tasks must be in dependency order — later tasks depend on earlier ones |
