# Skill Authoring Template & Checklist

## `SKILL.md` Starter (`<100` lines)

```markdown
---
name: <kebab-case-name>
description: >-
  <Third-person summary of what the skill does.> Use when <exact trigger
  conditions, file types, or user intents>.
---

# <Skill Title>

<One-line purpose statement.>

## Workflow
1. **<Step 1>**: <Action + `agx` command or tool seam>.
2. **<Step 2>**: <Decision criteria / invariants>.
3. **Verify**: <Executable check>.
```

## Pre-Commit Checklist
- [ ] `skills/<name>/SKILL.md` is `<100` lines (`wc -l`).
- [ ] `name` matches folder name; `description` is third-person with triggers.
- [ ] Bulky examples/tables live in `skills/<name>/references/`.
- [ ] Deterministic mechanics live in `bin/agx` / `scripts/cli.ts`, not inline shell blocks.
- [ ] `ARCHITECTURE.md` Section 4 table + count updated.
- [ ] `README.md` catalog + count updated.
- [ ] `skills/which-skill/SKILL.md` routing table updated.
- [ ] `./bin/agx god-files --max-lines 300 --strict` passes.
- [ ] `./bin/agx unslop-check --file skills/<name>/SKILL.md --strict` passes.
