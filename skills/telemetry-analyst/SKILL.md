---
name: telemetry-analyst
description: >-
  Retrieves and analyzes agent-skills telemetry (token usage, costs, cache hit
  rates, skill activations, subagents, and agx CLI adoption) using a low-cost
  digest workflow. Use when asked to analyze, audit, or diagnose agent runs.
---

# Telemetry Analyst

Diagnose whether `agent-skills` is working as intended without wasting tokens on raw logs.

## Workflow
1. **Delegate or Run Digest**:
   - Prefer invoking the `telemetry-analyst` subagent with `Model: "flash"` (include `agx telemetry report --digest --json` output in the prompt when already captured, or let it run `agx telemetry report --digest` directly).
   - For a single quick lookup, run `agx telemetry report --digest` directly.
2. **Drill Down on Outliers Only**:
   - Inspect flagged session IDs with `agx telemetry report --conversation <id>`.
   - Extract repeated user corrections with `agx mine --transcript <path> --limit 20`.
3. **Harden**: Convert recurring telemetry failures into `agx buffer add` entries, `agx` checks, or `SKILL.md` trigger improvements.
