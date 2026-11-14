---
name: goal
description: >-
  Runs an autonomous execution loop until a scoped goal, single plan, or
  multiple plans pass binary exit criteria. Use when the user asks for goal
  mode, potato mode, or to work autonomously until finished.
---

# Goal (Autonomous Execution Loop)

Execute a scoped goal, one plan, or a sequence of plans end-to-end until binary exit criteria pass—without pausing for mid-run confirmation.

## Protocol
1. **Lock Goal & Exit Criteria (`clarify`)**:
   - If the goal, scope, or acceptance checks are ambiguous, run `clarify` once upfront to lock them.
   - Skip `clarify` if the user already supplied a concrete plan or explicit exit commands.
   - Define binary exit criteria (tests, typecheck, build, `agx rubric`, or `verify-loop` probes).
2. **Load or Initialize State**:
   - **Existing plan(s)**: Resume `.agents/state/plan.json` or register all target plans/slices via `agx plan init --goal "<goal>" --tasks '<json>'`, and initialize `.agents/state/rubric.json` via `agx rubric init` if absent.
   - **New multi-step goal**: Persist vertical slices via `agx plan init --goal "<goal>" --tasks '<json>'` and checks via `agx rubric init`.
   - **Single-slice goal**: Track exit checks directly with `agx rubric init` or explicit verification commands.
3. **Autonomous Loop**:
   - **Multi-plan or >1 slice (required delegation)**: Run `orchestrate` (`agx plan next --json`, `implementer` per unblocked slice with disjoint `files[]`, and `reviewer` before marking `done`). Never write application code across multiple slices in the parent coordinator.
   - **Single-slice goal**: Implement directly with `tdd`, then run `verify-loop`.
   - Log out-of-scope footguns with `agx buffer add` instead of expanding scope.
   - Run `verify-loop` / `agx rubric score --json`, mark completed slices `agx plan update --id <id> --status done --handoff "<proof>"`, and continue immediately to the next slice.
4. **Circuit Breaker**:
   - Pause and escalate to the user only if:
     - A hard blocker occurs (missing credentials, permissions, or contradictory requirements), or
     - 3 consecutive attempts on the same failure make no measurable progress.
5. **Exit Gate**:
   - Finish only when all target plans/tasks are `done` and `agx rubric score --strict` + `agx blast` + `agx god-files --max-lines 300 --strict` pass. Report exact commands and observed results.
