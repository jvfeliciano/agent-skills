---
name: plan
description: >-
  Creates a concise, file-grounded implementation plan with exact file targets,
  vertical steps, and binary verification checks before coding. Use when the
  user asks for a plan on a scoped task without full multi-agent orchestration.
---

# Plan (Scoped Implementation Plan)

Turn a scoped task into an executable, file-grounded plan before editing code. Escalate to `grill-me` if major architectural branches are unresolved, or `orchestrate` if splitting across parallel workers.

## Protocol
1. **Orient**: Run `agx context --json` and locate relevant symbols/files (`rg -n`, bounded reads). Do not guess paths or behavior.
2. **Resolve Blockers**: If a requirement or trade-off is ambiguous, ask 1 targeted question before finalizing.
3. **Structure the Plan**:
   - **Goal & Non-Goals**: 1-2 lines on scope boundaries.
   - **Files & Deltas**: Exact paths, symbols, and invariants (flag any file nearing the 300-line ceiling).
   - **Vertical Steps**: Ordered tracer-bullet slices that can be verified incrementally.
   - **Verification**: Exact commands (`test`, `typecheck`, `agx blast`, `agx god-files --max-lines 300`) or live probes to run after the final edit.
4. **Persist Appropriately**:
   - **Single-session task**: Present the plan in chat; wait for confirmation before editing if the user asked for a plan first.
   - **Multi-step / resumable task**: Persist to `.agents/state/plan.json` via `agx plan init --goal "<goal>" --tasks '<json>'` (or `docs/plans/<slug>.md` if the repo tracks plans).
