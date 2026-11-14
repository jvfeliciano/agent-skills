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
1. **Coordinator Does Zero App Coding**: Stay in triage, state management, delegation, and verification.
2. **Cluster Before Spawning**: Group overlapping bugs or specs sharing a root cause before launching workers so parallel agents do not duplicate effort or collide.
3. **Strict File Ownership**: Assign disjoint `files` per active worker in `.agents/state/plan.json` (or use `swarm` `workspace: "share"` / `"branch"` when files overlap).

## Protocol
1. **Initialize State**: Create the DAG via `agx plan init --goal "<goal>" --tasks '<json>'` (or `to-spec`).
2. **Query Next Frontier**: Run `agx plan next --json` to get unblocked pending tasks.
3. **Dispatch Workers**: Launch subagents (`invoke_subagent`, `swarm`, or `run_workflow`) with:
   - Exact task `id`, owned files, invariants, and binary acceptance command.
   - Instruction to run `agx buffer add` for out-of-scope footguns instead of expanding scope.
4. **Verify & Advance**: When a worker finishes, inspect its evidence (`blast-radius` / `verify-loop`), mark `agx plan update --id <id> --status done --handoff "<proof>"`, and repeat `agx plan next` until complete.
