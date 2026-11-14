---
name: add-skill
description: >-
  Guides authoring, registering, and verifying new skills in `agent-skills` in
  compliance with `ARCHITECTURE.md` and `writing-for-agents`. Use when adding a
  new skill to `skills/` or expanding the `agent-skills` catalog.
---

# Add Skill (`agent-skills`)

Author and register new skills in `agent-skills` while preserving token economy, progressive disclosure, and deterministic `agx` boundaries.

## 1. Validate Fit & Boundary
1. Check `ARCHITECTURE.md` (Section 4) and `skills/which-skill/SKILL.md` to confirm no existing skill already covers the intent.
2. Separate **judgment** from **determinism**:
   - **Workflow / judgment** -> `skills/<kebab-name>/SKILL.md`.
   - **Mechanical scans, state, formatting** -> extend `bin/agx` or `scripts/cli.ts` (follow `cli-for-agent`) instead of embedding ad-hoc scripts in `SKILL.md`.
   - **Heavy lookup tables / examples** -> `skills/<kebab-name>/references/*.md`.
3. If scope or triggers are ambiguous, clarify with 1 targeted round (`grill-me` style) before writing files.

## 2. Author `skills/<kebab-name>/SKILL.md`
Follow `writing-for-agents` and `ARCHITECTURE.md` invariants (template in `references/skill-template.md`):
- **Language**: Write `SKILL.md` in English for maximum semantic compression.
- **YAML Frontmatter**: `name` must match the kebab-case directory name; `description` must be third-person with concrete trigger phrases (only `name` + `description` load into initial context).
- **Line Budgets**: Keep `SKILL.md` strictly `<100` lines and every file in the repo `<=300` lines.
- **State Isolation**: Never store runtime state inside `agent-skills/`; per-project state belongs in `<project>/.agents/state/`.
- **Anti-Slop**: Use precise engineering terms (`tracer bullet`, `blast radius`, `god file`, `tautological tests`); zero filler or redundant tutorials.

## 3. Register in Catalog & Router
Update all three discovery surfaces in the same change:
1. `ARCHITECTURE.md`: Add the skill row to Section 4 (`Skill Catalog`) and increment the total skill count.
2. `README.md`: Add the skill summary to the matching catalog section and increment the total skill count.
3. `skills/which-skill/SKILL.md`: Add a `-> <kebab-name>` entry to `## Routing Table`.

`bin/install.sh` discovers `skills/*` dynamically, so no installer edit is required unless a new harness is added.

## 4. Verify Deterministically
Run before finishing:
1. `wc -l skills/<kebab-name>/SKILL.md` (must be `< 100`).
2. `./bin/agx god-files --max-lines 300 --strict`
3. `./bin/agx unslop-check --file skills/<kebab-name>/SKILL.md --strict` (plus any edited `.md` files).
4. If `bin/agx` or `scripts/cli.ts` changed, verify `--help`, `--json`, and invalid-input exit code `1`.
