---
name: which-skill
description: >-
  Recommends the best agent-skills workflow or sequence for the user's current
  task without executing it prematurely. Use when the user asks which skill to
  use or seems unsure where to start.
---

# Which Skill (Catalog Router)

Map the user's current situation to the shortest effective skill sequence. Recommend only; do not execute unless asked.

## Routing Table
- **New or unconfigured repo** -> `setup`
- **Non-trivial human change request (pre-edit check)** -> `clarify`
- **Fuzzy idea or big feature** -> `grill-me` -> `ubiquitous-language` -> `design-an-interface` -> `to-spec`
- **Scoped task needing a pre-code plan** -> `plan`
- **Two competing architectures** -> `arena` -> `design-an-interface`
- **Unfamiliar code (*how* it works)** -> `bro`
- **Unfamiliar code (*why* it exists)** -> `why`
- **Implementing a slice or bug fix** -> `tdd`
- **Designing, critiquing, or polishing frontend / native UI** -> `impeccable`
- **Multi-ticket / parallelizable batch** -> `orchestrate`
- **Autonomous execution until goal/plan(s) pass** -> `goal`
- **New/updated agent CLI tool** -> `cli-for-agent`
- **Authoring/tightening skills or rules** -> `writing-for-agents`
- **Adding a new skill to `agent-skills`** -> `add-skill`
- **Analyzing telemetry, costs, or skill/agx usage** -> `telemetry-analyst`
- **Auditing `sh` vs `agx` usage or enforcing `agx`-first habits** -> `agx-first`
- **Pre-PR safety & quality** -> `blast-radius` -> `interrogate` -> `verify-loop` -> `unslop` -> `pr`
- **Filing GitHub issues or opening/updating PRs** -> `issue-pr`
- **Delegating full GitHub tasks (`/gh`: issues, PRs, CI/reviews, releases)** -> `gh`
- **Context getting full / pausing** -> `handoff`
- **Out-of-scope debt noticed mid-task** -> `pattern-buffer`
- **Repeated user corrections** -> `mine-transcripts`

## Output
Reply with:
1. The recommended skill (or 2-3 step chain) and why it fits.
2. The exact first command or prompt to kick it off.
