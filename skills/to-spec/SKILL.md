---
name: to-spec
description: >-
  Converts an aligned design or requirements doc into a token-lean technical
  specification and vertically-sliced tracer-bullet tickets. Use after grill-me
  or when breaking down a feature for implementation or orchestration.
---

# To Spec & Tracer-Bullet Tickets

Turn resolved decisions into an executable spec and vertically-sliced, independently verifiable work items.

## Protocol
1. **Reject Horizontal Layer-Cake Slicing**: Never split work into isolated "DB ticket -> API ticket -> UI ticket" layers that cannot be verified end-to-end until the end.
2. **Define the Technical Spec** (keep concise, pointer-heavy):
   - **Invariants & Non-Goals**: Hard constraints and explicit exclusions.
   - **Data & Contract Deltas**: Exact files, schema diffs, and public types.
   - **Verification Plan**: Exact `agx rubric` checks, tests, or browser flows proving completion.
3. **Slice into Tracer Bullets**: Each ticket must cut top-to-bottom through a thin usable slice and include:
   - `id`, `owner` role, and strict `files` ownership boundary (avoid overlapping edits in parallel work)
   - `dependsOn` edges
   - Binary acceptance check (exact command or UI interaction that passes)
4. **Persist for Execution**: If multi-agent or >3 tickets, initialize `.agents/state/plan.json` via:
   `agx plan init --goal "<goal>" --tasks '<json-array>'`
