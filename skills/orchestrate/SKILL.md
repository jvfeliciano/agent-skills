---
name: orchestrate
description: >-
  Runs a Chief-of-Staff Coordinator loop that triages incoming batches, prevents
  duplicate work, manages .agents/state/plan.json, and dispatches isolated
  workers. Use for multi-ticket features, bug batches, or parallel subagents.
---

# Orchestrate (Chief of Staff Coordinator)

Act as Executive Chef, not line cook. Decompose, isolate ownership, delegate, and verify handoffs.

## Rules
1. **Scope Gate (1-2 File Bypass)**: If the task targets 1-2 already-named/open files (`<30` steps), do NOT fan out into `scout`/`implementer`/`reviewer` subagents; execute `plan` + direct implementation in one warm session (optionally one `reviewer` pass at the end).
2. **Coordinator Does Zero App Coding**: For multi-file/parallel batches, stay in triage, state management, delegation, and verification.
3. **Skip Redundant `scout`**: Do not spawn `scout` when target files are already named or open; pass exact `file:line` targets directly to workers.
4. **Cluster Before Spawning**: Group overlapping bugs or specs sharing a root cause before launching workers so parallel agents do not duplicate effort or collide.
5. **Strict File Ownership**: Assign disjoint `files` per active worker in `.agents/state/plan.json` (or use `agx worktree create --name <slug>` / `swarm` `workspace: "share"` when files overlap).
6. **Explicit Model Tiering & 25-Step Worker Cap**: Never leave `Model` as `inherit` for routine workers. Pass `Model: "flash"` for `scout`, `telemetry-analyst`, and scoped `implementer`/`reviewer` slices; cap each worker prompt at `<=25` steps with one binary verification command.
7. **40-Step Wave Ceiling**: Keep each coordinator wave under ~40 steps. Before hitting 40 steps, checkpoint completed/in-progress tasks via `agx plan update` and emit a `handoff` summary for the next wave.

## Protocol
1. **Initialize State**: Create the DAG via `agx plan init --goal "<goal>" --tasks '<json>'` (or `to-spec`).
2. **Query Next Frontier**: Run `agx plan next --json` to get unblocked pending tasks.
3. **Dispatch Workers**: Launch subagents (`invoke_subagent`, `swarm`, or `run_workflow`) with:
   - Exact task `id`, owned files, invariants, and binary acceptance command.
   - Instruction to run `agx buffer add` for out-of-scope footguns instead of expanding scope.
4. **Verify & Advance**: When a worker finishes, inspect its evidence (`blast-radius` / `verify-loop`), mark `agx plan update --id <id> --status done --handoff "<proof>"`, and repeat `agx plan next` until complete.
