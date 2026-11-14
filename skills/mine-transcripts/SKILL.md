---
name: mine-transcripts
description: >-
  Mines past agent JSONL conversation logs to surface user corrections and
  repeated interventions, converting them into deterministic CLI checks, lint
  rules, or updated skills. Use during retrospectives or skill maintenance.
---

# Mine Transcripts (Codify Interventions)

Never guess what skills or rules you need next. Extract them from real human corrections in conversation logs.

## Protocol
1. **Extract Candidates**: Run `agx mine --limit 30 --json` (or `--transcript <path/to/transcript.jsonl>`).
2. **Inspect Context**: For each flagged `step` where the user redirected, corrected, or rejected agent behavior, read only the surrounding lines in `transcript.jsonl` to see *what* the agent got wrong.
3. **Cluster Failure Modes**: Group repeated interventions by root cause:
   - **Mechanical / Checkable** (e.g., forgot lint, bloated file, slop phrase, wrong command flags)
   - **Judgment / Workflow** (e.g., coded before aligning, missed downstream contract, weak tests)
4. **Harden Into Permanent Fixes** (in priority order):
   1. Encode into a lint rule, type constraint, or `agx` subcommand (highest reliability, zero token tax).
   2. Update an existing `SKILL.md` or `rules/AGENTS.md` (follow `writing-for-agents` token budget).
   3. Author a new skill only if no existing skill owns that workflow boundary.
5. **Verify**: Run `agx rubric score --json` on the modified customization repo.
