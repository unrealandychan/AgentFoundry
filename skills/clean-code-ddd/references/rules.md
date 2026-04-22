# Clean Code + DDD — Review Rules

This reference is used by the `clean-code-ddd` skill when reviewing code.

## Clean Code Rules

### Naming

- [ ] Names reveal intent — a reader should understand purpose without additional context
- [ ] Function names are verbs; class/type names are nouns
- [ ] No abbreviations unless universally understood (e.g. `id`, `url`, `api`)
- [ ] No names differing only by number suffix (`data1`, `data2`) — name the distinction
- [ ] Boolean names are questions: `isActive`, `hasPermission`, `canEdit`
- [ ] Magic numbers replaced by named constants

### Functions

- [ ] Each function does exactly one thing (Single Responsibility)
- [ ] Function body is ≤ 20 lines as a strong nudge
- [ ] Max 3 parameters; use an options object for more
- [ ] No side effects that are not obvious from the name
- [ ] Early returns preferred over deeply nested conditionals (max 2 levels)

### Classes / Modules

- [ ] Class has a single, clearly stated responsibility
- [ ] No "god objects" that know or do too much
- [ ] Dependencies injected; no hardcoded `new SomethingExpensive()` inside methods
- [ ] Interfaces are narrow — prefer small, focused contracts

### Duplication

- [ ] No copy-paste code — extract shared logic
- [ ] If logic appears ≥ 3 times, it should be a named function

### Error Handling

- [ ] Errors are thrown/returned with a meaningful message
- [ ] No silent `catch` that swallows exceptions
- [ ] Caller-facing errors are user-readable; internal errors preserve stack context

---

## Domain-Driven Design Rules

### Ubiquitous Language

- [ ] Code names match the business/domain vocabulary exactly
- [ ] No "Manager", "Helper", "Util" classes — name what the domain calls it
- [ ] A domain expert could read the code and recognise the concepts

### Bounded Contexts

- [ ] Each context owns its domain types — no leaking raw DB models across contexts
- [ ] Cross-context communication happens through well-defined interfaces or events
- [ ] Context map is implicit in module/package boundaries

### Aggregates

- [ ] Each Aggregate has a single Aggregate Root
- [ ] External references to aggregate internals go through the root
- [ ] Aggregates enforce invariants; state changes go through methods, not direct field writes

### Repositories

- [ ] Repositories abstract persistence for Aggregates only
- [ ] No repository per entity — only per Aggregate Root
- [ ] Repository interface is defined in the domain layer; implementation is in infrastructure

### Value Objects

- [ ] Values without identity are Value Objects (immutable, equality by value)
- [ ] Value Objects validate themselves on construction

---

## Common Smells to Flag

| Smell               | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| Feature Envy        | Method uses another object's data more than its own                    |
| Data Clumps         | Groups of fields that always appear together (extract to Value Object) |
| Primitive Obsession | Raw strings/ints for domain concepts (use `Email`, `Money`, `UserId`)  |
| Long Parameter List | More than 3–4 params → use a parameters object or rethink design       |
| Divergent Change    | One class changes for multiple unrelated reasons                       |
| Shotgun Surgery     | One logical change requires editing many classes                       |
